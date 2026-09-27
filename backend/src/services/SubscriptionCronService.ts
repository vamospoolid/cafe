import prisma from '../db';
import { invalidateTenantCache } from '../middlewares/tenantResolver';
import { emitToTenant } from '../index';
import { AuditLogger } from './AuditLogger';

export interface SubscriptionAuditSummary {
  invoicesGenerated: number;
  trialsExpired: number;
  subscriptionsExpired: number;
  tenantsSuspended: number;
  timestamp: Date;
}

export class SubscriptionCronService {
  private static instance: SubscriptionCronService;
  private isRunning: boolean = false;

  public static getInstance(): SubscriptionCronService {
    if (!SubscriptionCronService.instance) {
      SubscriptionCronService.instance = new SubscriptionCronService();
    }
    return SubscriptionCronService.instance;
  }

  /**
   * 1. Auto-Invoice Generation (H-7 s/d H-1 sebelum masa aktif berakhir)
   * Menemukan subscription aktif yang akan berakhir dalam 7 hari dan otomatis
   * menerbitkan invoice baru (UNPAID) jika belum ada invoice aktif.
   */
  public async processExpiringSubscriptions(now: Date = new Date()): Promise<number> {
    const h7Threshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let count = 0;

    // Cari subscription aktif yang jatuh tempo antara sekarang dan 7 hari ke depan
    const expiringSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: now,
          lte: h7Threshold
        }
      },
      include: {
        tenant: true,
        plan: true
      }
    });

    for (const sub of expiringSubs) {
      // Periksa apakah sudah ada invoice UNPAID untuk subscription ini
      const existingUnpaidInvoice = await prisma.invoice.findFirst({
        where: {
          tenantId: sub.tenantId,
          status: 'UNPAID',
          createdAt: {
            gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // dalam 14 hari terakhir
          }
        }
      });

      if (!existingUnpaidInvoice && sub.plan) {
        const dateStr = now.toISOString().slice(0, 7).replace('-', '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;
        const amount = sub.amount > 0 ? sub.amount : sub.plan.priceMonthly;

        const newInvoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            planId: sub.planId,
            amount,
            taxAmount: 0,
            totalAmount: amount,
            status: 'UNPAID',
            dueDate: sub.currentPeriodEnd,
            paymentMethod: 'MIDTRANS_SNAP'
          }
        });

        // Buat PaymentTransaction PENDING untuk Midtrans Snap
        await prisma.paymentTransaction.create({
          data: {
            tenantId: sub.tenantId,
            invoiceId: newInvoice.id,
            gateway: 'MIDTRANS',
            gatewayOrderId: `SAAS-${invoiceNumber}`,
            amount,
            status: 'PENDING'
          }
        });

        // Notifikasi via Socket.IO ke room tenant
        emitToTenant(sub.tenantId, 'subscription:invoice_created', {
          invoiceNumber: newInvoice.invoiceNumber,
          dueDate: newInvoice.dueDate,
          totalAmount: newInvoice.totalAmount,
          planName: sub.plan.name
        });

        count++;
        console.log(`[SubscriptionCron] Auto-generated invoice ${invoiceNumber} for tenant ${sub.tenant.name}`);
      }
    }

    return count;
  }

  /**
   * 2. Process Expired Trials (TRIAL -> GRACE_PERIOD)
   * Mengubah tenant berstatus TRIAL yang trialEndsAt < now menjadi GRACE_PERIOD.
   */
  public async processExpiredTrials(now: Date = new Date()): Promise<number> {
    let count = 0;

    const expiredTrials = await prisma.tenant.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: {
          lt: now
        }
      },
      include: {
        plan: true
      }
    });

    for (const tenant of expiredTrials) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'GRACE_PERIOD' }
      });

      // Invalidate cache
      invalidateTenantCache(tenant.id);

      // Pastikan ada invoice untuk aktivasi jika belum pernah dibuat
      const existingInvoice = await prisma.invoice.findFirst({
        where: { tenantId: tenant.id, status: 'UNPAID' }
      });

      if (!existingInvoice) {
        const plan = tenant.plan || await prisma.plan.findFirst({ where: { isActive: true } });
        if (plan) {
          const dateStr = now.toISOString().slice(0, 7).replace('-', '');
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;
          const amount = plan.priceMonthly;

          const inv = await prisma.invoice.create({
            data: {
              invoiceNumber,
              tenantId: tenant.id,
              planId: plan.id,
              amount,
              taxAmount: 0,
              totalAmount: amount,
              status: 'UNPAID',
              dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 hari jatuh tempo
              paymentMethod: 'MIDTRANS_SNAP'
            }
          });

          await prisma.paymentTransaction.create({
            data: {
              tenantId: tenant.id,
              invoiceId: inv.id,
              gateway: 'MIDTRANS',
              gatewayOrderId: `SAAS-${invoiceNumber}`,
              amount,
              status: 'PENDING'
            }
          });
        }
      }

      // Notifikasi real-time
      emitToTenant(tenant.id, 'tenant:status_changed', {
        status: 'GRACE_PERIOD',
        reason: 'TRIAL_EXPIRED',
        daysLeft: 3
      });

      count++;
      console.log(`[SubscriptionCron] Trial expired for tenant ${tenant.name} -> GRACE_PERIOD`);
    }

    return count;
  }

  /**
   * 3. Process Expired Subscriptions (ACTIVE -> PAST_DUE / GRACE_PERIOD)
   * Mengubah subscription yang currentPeriodEnd < now menjadi PAST_DUE
   * dan mengubah tenant aktif terkait menjadi GRACE_PERIOD.
   */
  public async processExpiredSubscriptions(now: Date = new Date()): Promise<number> {
    let count = 0;

    const expiredSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lt: now
        }
      },
      include: {
        tenant: true
      }
    });

    for (const sub of expiredSubs) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE' }
      });

      // Update tenant status menjadi GRACE_PERIOD jika masih ACTIVE
      if (sub.tenant && sub.tenant.status === 'ACTIVE') {
        await prisma.tenant.update({
          where: { id: sub.tenantId },
          data: { status: 'GRACE_PERIOD' }
        });

        invalidateTenantCache(sub.tenantId);

        emitToTenant(sub.tenantId, 'tenant:status_changed', {
          status: 'GRACE_PERIOD',
          reason: 'SUBSCRIPTION_EXPIRED',
          daysLeft: 3
        });
      }

      count++;
      console.log(`[SubscriptionCron] Subscription expired for tenant ${sub.tenant?.name} -> PAST_DUE & GRACE_PERIOD`);
    }

    return count;
  }

  /**
   * 4. Enforce Grace Period Cutoff (GRACE_PERIOD -> SUSPENDED)
   * Menemukan tenant yang telah melewati batas toleransi grace period (default: 3 hari)
   * dan menegakkan penangguhan (SUSPENDED), menginvalidasi cache, serta memblokir kasir.
   */
  public async processGracePeriodCutoff(now: Date = new Date(), graceDays: number = 3): Promise<number> {
    let count = 0;
    const cutoffThresholdMs = graceDays * 24 * 60 * 60 * 1000;

    const graceTenants = await prisma.tenant.findMany({
      where: {
        status: 'GRACE_PERIOD'
      },
      include: {
        subscriptions: {
          orderBy: { currentPeriodEnd: 'desc' },
          take: 1
        }
      }
    });

    for (const tenant of graceTenants) {
      // Tentukan waktu dasar berakhirnya akses
      const latestSub = tenant.subscriptions[0];
      const expiryBase = latestSub?.currentPeriodEnd || tenant.trialEndsAt || tenant.updatedAt;

      const elapsedMs = now.getTime() - expiryBase.getTime();

      // Jika telah melewati grace period toleransi (3 hari)
      if (elapsedMs >= cutoffThresholdMs) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: 'SUSPENDED' }
        });

        // Set status subscription menjadi EXPIRED
        if (latestSub && latestSub.status === 'PAST_DUE') {
          await prisma.subscription.update({
            where: { id: latestSub.id },
            data: { status: 'EXPIRED' }
          });
        }

        // Invalidate tenant cache seketika
        invalidateTenantCache(tenant.id);

        // Audit log platform
        await AuditLogger.log({
          tenantId: null, // Platform-level
          action: 'TENANT_AUTO_SUSPENDED',
          resource: 'SUBSCRIPTION_CRON',
          resourceId: tenant.id,
          description: `Penangguhan otomatis tenant ${tenant.name} karena masa tenggang pembayaran (${graceDays} hari) habis.`,
          severity: 'CRITICAL'
        });

        // Notifikasi pemblokiran real-time ke room tenant kasir & dashboard
        emitToTenant(tenant.id, 'tenant:suspended', {
          message: 'Masa tenggang langganan telah berakhir. Akses kasir dinonaktifkan sementara.',
          tenantId: tenant.id,
          tenantName: tenant.name
        });

        count++;
        console.log(`[SubscriptionCron] Tenant ${tenant.name} AUTO-SUSPENDED after ${graceDays} days grace period.`);
      }
    }

    return count;
  }

  /**
   * Eksekusi satu siklus penuh audit langganan
   */
  public async runSubscriptionAuditCycle(now: Date = new Date()): Promise<SubscriptionAuditSummary> {
    if (this.isRunning) {
      console.log('[SubscriptionCron] Cycle already running. Skipping concurrent invocation.');
      return {
        invoicesGenerated: 0,
        trialsExpired: 0,
        subscriptionsExpired: 0,
        tenantsSuspended: 0,
        timestamp: now
      };
    }

    this.isRunning = true;
    try {
      const invoicesGenerated = await this.processExpiringSubscriptions(now);
      const trialsExpired = await this.processExpiredTrials(now);
      const subscriptionsExpired = await this.processExpiredSubscriptions(now);
      const tenantsSuspended = await this.processGracePeriodCutoff(now);

      return {
        invoicesGenerated,
        trialsExpired,
        subscriptionsExpired,
        tenantsSuspended,
        timestamp: now
      };
    } catch (error) {
      console.error('[SubscriptionCron] Error in runSubscriptionAuditCycle:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

export const subscriptionCronService = SubscriptionCronService.getInstance();
