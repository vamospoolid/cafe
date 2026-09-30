import prisma from '../db';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { invalidateTenantCache } from '../middlewares/tenantResolver';
import { BackupService } from '../services/BackupService';
import { backupCronService } from '../services/BackupCronService';
import { emitToTenant } from '../index';
import { featureService } from '../services/FeatureService';
import fs from 'fs';
import path from 'path';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

function sanitizeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * GET /api/platform-admin/overview
 * Master metrics for SaaS Developer / Platform Executive
 */
router.get('/overview', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      tenants,
      outlets,
      users,
      subscriptions,
      invoices,
      orders
    ] = await Promise.all([
      prisma.tenant.findMany({
        include: {
          plan: true,
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          outlets: {
            orderBy: { createdAt: 'asc' }
          },
          memberships: {
            include: {
              user: true,
              role: true
            }
          },
          _count: {
            select: {
              memberships: true,
              orders: true,
              outlets: true,
              products: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.outlet.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.subscription.findMany({
        include: { plan: true }
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.aggregate({
        where: { status: { notIn: ['CANCELLED', 'VOID'] } },
        _sum: { total: true },
        _count: { id: true }
      }).catch(() => ({ _sum: { total: 0 }, _count: { id: 0 } }))
    ]);

    // Calculate MRR & Subscription metrics
    let mrr = 0;
    let activeSubscriptionsCount = 0;
    let trialTenantsCount = 0;
    let activeTenantsCount = 0;
    let suspendedTenantsCount = 0;

    const planDistribution: Record<string, number> = {
      STARTER: 0,
      GROWTH: 0,
      BUSINESS: 0,
      ENTERPRISE: 0
    };

    for (const sub of subscriptions) {
      if (sub.status === 'ACTIVE') {
        activeSubscriptionsCount++;
        const price = sub.plan?.priceMonthly || 0;
        if (sub.billingCycle === 'YEARLY') {
          mrr += Math.round((sub.plan?.priceYearly || price * 12) / 12);
        } else {
          mrr += price;
        }
      }
    }

    const now = new Date();
    const renewalRadar: any[] = [];
    const upsellRadar: any[] = [];
    const tenantGMVList: any[] = [];

    for (const t of tenants) {
      if (t.status === 'ACTIVE') activeTenantsCount++;
      else if (t.status === 'TRIAL') trialTenantsCount++;
      else if (t.status === 'SUSPENDED') suspendedTenantsCount++;

      const currentSub = t.subscriptions[0];
      const plan = currentSub?.plan || t.plan;
      const planCode = plan?.code || 'STARTER';
      const planName = plan?.name || 'Paket Starter UMKM';
      planDistribution[planCode] = (planDistribution[planCode] || 0) + 1;

      const ownerMember = t.memberships.find(m => m.role?.name === 'OWNER' || m.role?.name === 'Admin') || t.memberships[0];
      const outletPhone = t.outlets[0]?.phone;
      const phone = t.phone || outletPhone || '';
      let waNumber = phone.replace(/[^0-9]/g, '');
      if (waNumber.startsWith('0')) waNumber = '62' + waNumber.slice(1);

      const ownerName = t.ownerName || ownerMember?.user?.name || ownerMember?.user?.username || 'Owner';

      // 1. Renewal Radar (Expiring in <= 7 days or already expired)
      const expiryDate = currentSub?.currentPeriodEnd || t.trialEndsAt;
      if (expiryDate) {
        const diffMs = new Date(expiryDate).getTime() - now.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7) {
          renewalRadar.push({
            id: t.id,
            name: t.name,
            slug: t.slug,
            ownerName,
            phone,
            waNumber: waNumber || null,
            email: t.email,
            status: t.status,
            planName,
            planCode,
            priceMonthly: plan?.priceMonthly || 99000,
            expiryDate,
            daysLeft,
            isPastDue: daysLeft <= 0,
            isTrial: t.status === 'TRIAL'
          });
        }
      }

      // 2. Upsell Radar (High Quota Saturation >= 80% or Full)
      const maxOutlets = plan?.maxOutlets ?? 1;
      const maxUsers = plan?.maxUsers ?? 3;
      const maxProducts = plan?.maxProducts ?? 100;

      const usedOutlets = t._count.outlets;
      const usedUsers = t._count.memberships;
      const usedProducts = t._count.products;

      const isOutletFull = usedOutlets >= maxOutlets;
      const isUserFull = usedUsers >= maxUsers;
      const isProductHigh = usedProducts >= maxProducts * 0.8;

      if (isOutletFull || isUserFull || isProductHigh) {
        let suggestedPlan = 'GROWTH';
        let reason = '';
        if (planCode === 'STARTER') {
          suggestedPlan = 'GROWTH (3 Cabang & 15 Staf)';
          reason = isOutletFull ? `Cabang telah mencapai kuota maksimal (${usedOutlets}/${maxOutlets})` : `Akun staf telah penuh (${usedUsers}/${maxUsers})`;
        } else if (planCode === 'GROWTH') {
          suggestedPlan = 'BUSINESS (10 Cabang & Unlimited Menu)';
          reason = isOutletFull ? `Cabang telah penuh (${usedOutlets}/${maxOutlets})` : `Staf mendekati kapasitas (${usedUsers}/${maxUsers})`;
        } else {
          suggestedPlan = 'ENTERPRISE (Custom Solution)';
          reason = 'Penggunaan sumber daya skala enterprise';
        }

        upsellRadar.push({
          id: t.id,
          name: t.name,
          slug: t.slug,
          ownerName,
          phone,
          waNumber: waNumber || null,
          currentPlan: planName,
          currentPlanCode: planCode,
          suggestedPlan,
          reason,
          utilization: {
            outlets: `${usedOutlets} / ${maxOutlets}`,
            users: `${usedUsers} / ${maxUsers}`,
            products: `${usedProducts} / ${maxProducts}`
          }
        });
      }

      // 3. Top GMV Merchants Telemetry
      tenantGMVList.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        ownerName,
        phone,
        waNumber: waNumber || null,
        planName,
        ordersCount: t._count.orders,
        outletsCount: t._count.outlets,
        createdAt: t.createdAt
      });
    }

    // Invoices breakdown
    let totalCollectedRevenue = 0;
    let pendingInvoicesCount = 0;
    for (const inv of invoices) {
      if (inv.status === 'PAID') {
        totalCollectedRevenue += inv.totalAmount || inv.amount;
      } else if (inv.status === 'UNPAID') {
        pendingInvoicesCount++;
      }
    }

    const arpu = activeSubscriptionsCount > 0 ? Math.round(mrr / activeSubscriptionsCount) : 0;

    return res.json({
      metrics: {
        totalTenants: tenants.length,
        activeTenants: activeTenantsCount,
        trialTenants: trialTenantsCount,
        suspendedTenants: suspendedTenantsCount,
        totalOutlets: outlets,
        totalUsers: users,
        totalOrdersAllTime: orders._count?.id || 0,
        totalGMVAllTime: orders._sum?.total || 0,
        mrr,
        arr: mrr * 12,
        arpu,
        totalCollectedRevenue,
        pendingInvoicesCount,
        activeSubscriptionsCount
      },
      planDistribution,
      renewalRadar: renewalRadar.sort((a, b) => a.daysLeft - b.daysLeft),
      upsellRadar: upsellRadar.slice(0, 10),
      topMerchants: tenantGMVList.sort((a, b) => b.ordersCount - a.ordersCount).slice(0, 5),
      recentTenants: tenants.slice(0, 5).map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        createdAt: t.createdAt,
        outletsCount: t._count.outlets,
        usersCount: t._count.memberships,
        ordersCount: t._count.orders,
        plan: t.subscriptions[0]?.plan?.name || t.plan?.name || 'Paket Starter'
      }))
    });
  } catch (error: any) {
    console.error('[Platform Admin API /overview Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat analitik platform' });
  }
});

/**
 * GET /api/platform-admin/tenants
 * List all registered tenants with full telemetry
 */
router.get('/tenants', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        plan: true,
        outlets: true,
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        memberships: {
          include: {
            user: true,
            role: true
          }
        },
        _count: {
          select: {
            orders: true,
            outlets: true,
            memberships: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = tenants.map(t => {
      const ownerMember = t.memberships.find(m => m.role?.name === 'OWNER' || m.role?.name === 'Admin') || t.memberships[0];
      const currentSub = t.subscriptions[0];
      const outletPhone = t.outlets[0]?.phone;

      // Prioritas phone: t.phone -> outletPhone -> ''
      const phone = t.phone || outletPhone || '';
      // Format WhatsApp compatible number (e.g., 0812... -> 62812...)
      let waNumber = phone.replace(/[^0-9]/g, '');
      if (waNumber.startsWith('0')) {
        waNumber = '62' + waNumber.slice(1);
      }

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        ownerName: t.ownerName || ownerMember?.user?.name || ownerMember?.user?.username || 'Owner',
        phone: t.phone || outletPhone || '',
        waNumber: waNumber || null,
        email: t.email || '',
        notes: t.notes || '',
        createdAt: t.createdAt,
        trialEndsAt: t.trialEndsAt,
        owner: {
          id: ownerMember?.user?.id,
          name: t.ownerName || ownerMember?.user?.name || ownerMember?.user?.username || 'Owner',
          username: ownerMember?.user?.username
        },
        subscription: currentSub ? {
          id: currentSub.id,
          status: currentSub.status,
          planName: currentSub.plan?.name || 'Growth Plan',
          planCode: currentSub.plan?.code || 'GROWTH',
          maxOutlets: currentSub.plan?.maxOutlets ?? 1,
          maxUsers: currentSub.plan?.maxUsers ?? 3,
          maxProducts: currentSub.plan?.maxProducts ?? 100,
          billingCycle: currentSub.billingCycle,
          currentPeriodEnd: currentSub.currentPeriodEnd
        } : (t.plan ? {
          id: null,
          status: t.status,
          planName: t.plan.name,
          planCode: t.plan.code,
          maxOutlets: t.plan.maxOutlets,
          maxUsers: t.plan.maxUsers,
          maxProducts: t.plan.maxProducts,
          billingCycle: 'MONTHLY',
          currentPeriodEnd: t.trialEndsAt
        } : null),
        outletsCount: t._count.outlets,
        usersCount: t._count.memberships,
        ordersCount: t._count.orders
      };
    });

    return res.json({
      success: true,
      total: formatted.length,
      tenants: formatted
    });
  } catch (error: any) {
    console.error('[Platform Admin API /tenants Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat daftar tenant' });
  }
});

/**
 * PATCH & POST /api/platform-admin/tenants/:id/status
 * Suspend, Activate, or set Trial for a tenant
 */
const handleStatusUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'TRIAL', 'GRACE_PERIOD', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid. Pilihan: ACTIVE, SUSPENDED, TRIAL, GRACE_PERIOD' });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: { status }
    });

    // Invalidate tenant cache agar suspensi efektif real-time tanpa server restart
    invalidateTenantCache(id);

    // SAA-005: Kirim broadcast real-time ke seluruh terminal POS & Dashboard tenant
    if (status === 'SUSPENDED' || status === 'INACTIVE') {
      emitToTenant(id, 'tenant:suspended', {
        status,
        message: status === 'SUSPENDED'
          ? 'Akses tenant telah ditangguhkan oleh platform. Hubungi administrator.'
          : 'Akses tenant telah dinonaktifkan.'
      });
      emitToTenant(id, 'tenant:status_changed', { status });
    } else if (status === 'ACTIVE') {
      emitToTenant(id, 'tenant:reactivated', { message: 'Akses tenant telah diaktifkan kembali.' });
      emitToTenant(id, 'tenant:status_changed', { status });
    }

    await AuditLogger.log({
      tenantId: null,    // Platform-level event — tidak boleh masuk namespace tenant
      action: 'TENANT_UPDATE',
      resource: 'PLATFORM_ADMIN',
      resourceId: id,
      description: `Mengubah status tenant ${updated.name} menjadi ${status}`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Status tenant ${updated.name} berhasil diubah ke ${status}`,
      tenant: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memperbarui status tenant' });
  }
};
router.patch('/tenants/:id/status', authenticateToken, requirePlatformAdmin, handleStatusUpdate);
router.post('/tenants/:id/status', authenticateToken, requirePlatformAdmin, handleStatusUpdate);

/**
 * PATCH /api/platform-admin/tenants/:id/plan
 * Switch / Upgrade SaaS Plan for a tenant and update subscription
 */
router.patch('/tenants/:id/plan', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { planId, billingCycle = 'MONTHLY' } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Paket langganan (Plan) tidak ditemukan' });
    }

    // Update Tenant planId
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: { planId }
    });

    // Update or create active subscription
    const existingSub = await prisma.subscription.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' }
    });

    if (existingSub) {
      await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId,
          status: 'ACTIVE',
          billingCycle
        }
      });
    } else {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + (billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000);
      const planAmount = (billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly) || 0;
      await prisma.subscription.create({
        data: {
          tenantId: id,
          planId,
          status: 'ACTIVE',
          billingCycle,
          amount: planAmount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd
        }
      });
    }

    // Invalidate tenant and feature cache agar perubahan paket efektif instan
    invalidateTenantCache(id);
    featureService.clearCache(id);
    emitToTenant(id, 'tenant:status_changed', { planId, planName: plan.name, planCode: plan.code });

    await AuditLogger.log({
      tenantId: id,
      action: 'SUBSCRIPTION_UPDATE',
      resource: 'PLATFORM_ADMIN',
      description: `Mengubah paket tenant ${updatedTenant.name} menjadi ${plan.name} (${plan.code})`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Paket tenant ${updatedTenant.name} berhasil diubah ke ${plan.name}`,
      tenant: updatedTenant,
      plan
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengubah paket tenant' });
  }
});

/**
 * PATCH /api/platform-admin/tenants/:id/contact
 * Update tenant CRM contact details (ownerName, phone, email, notes)
 */
router.patch('/tenants/:id/contact', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { ownerName, phone, email, notes } = req.body;

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(ownerName !== undefined ? { ownerName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(notes !== undefined ? { notes } : {})
      }
    });

    await AuditLogger.log({
      tenantId: id,
      action: 'TENANT_UPDATE',
      resource: 'PLATFORM_ADMIN',
      description: `Memperbarui data kontak CRM tenant ${updated.name}`,
      severity: 'INFO'
    }, req);

    return res.json({
      success: true,
      message: `Data kontak tenant ${updated.name} berhasil diperbarui`,
      tenant: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memperbarui kontak tenant' });
  }
});

/**
 * POST /api/platform-admin/tenants/:id/extend-trial
 * Extend trial or subscription by N days
 */
router.post('/tenants/:id/extend-trial', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { days = 14 } = req.body;

    const sub = await prisma.subscription.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' }
    });

    const tenant = await prisma.tenant.findUnique({ where: { id } });

    const currentExpiryTime = sub?.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).getTime()
      : (tenant?.trialEndsAt ? new Date(tenant.trialEndsAt).getTime() : 0);
    // SAA-003: Jika sudah expired di masa lampau, perpanjangan dimulai dari waktu sekarang (Date.now())
    const baseTime = Math.max(Date.now(), currentExpiryTime);
    const newExpiry = new Date(baseTime + Math.max(1, Number(days)) * 24 * 60 * 60 * 1000);

    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: newExpiry
        }
      });
    }

    // Also activate tenant status and update trialEndsAt
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        trialEndsAt: newExpiry
      }
    });

    // Invalidate tenant cache agar status ACTIVE efektif real-time
    invalidateTenantCache(id);
    emitToTenant(id, 'tenant:status_changed', { status: 'ACTIVE', trialEndsAt: newExpiry });
    emitToTenant(id, 'tenant:reactivated', { message: `Masa aktif telah diperpanjang +${days} hari.` });

    await AuditLogger.log({
      tenantId: null,    // Platform-level event — tidak boleh masuk namespace tenant
      action: 'SUBSCRIPTION_UPDATE',
      resource: 'PLATFORM_ADMIN',
      resourceId: id,
      description: `Memperpanjang masa aktif tenant ${id} sebanyak +${days} hari sampai ${newExpiry.toISOString()}`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Masa aktif ${updatedTenant.name} berhasil diperpanjang +${days} hari (hingga ${newExpiry.toLocaleDateString('id-ID')})`,
      tenant: updatedTenant
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memperpanjang masa aktif' });
  }
});

/**
 * GET /api/platform-admin/tenants/:id/details
 * Deep inspector data for a specific tenant (outlets, users, overrides, plan, invoices)
 */
router.get('/tenants/:id/details', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        outlets: true,
        plan: {
          include: {
            features: {
              include: { feature: true }
            }
          }
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
        },
        memberships: {
          include: {
            user: true,
            role: true
          }
        },
        featureOverrides: {
          include: { feature: true }
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            orders: true,
            products: true,
            categories: true,
            ingredients: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    }

    const allPlans = await prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' }
    });

    const allFeatures = await prisma.feature.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }]
    });

    return res.json({
      success: true,
      tenant,
      allPlans,
      allFeatures
    });
  } catch (error: any) {
    console.error('[Platform Admin /tenants/:id/details Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat detail tenant' });
  }
});

/**
 * POST /api/platform-admin/tenants/:id/change-plan
 * Change tenant plan from Platform Developer Console
 */
router.post('/tenants/:id/change-plan', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { planCode } = req.body;

    if (!planCode) {
      return res.status(400).json({ error: 'planCode wajib diisi' });
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      return res.status(404).json({ error: `Paket '${planCode}' tidak ditemukan` });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        planId: plan.id,
        status: 'ACTIVE'
      }
    });

    // Update current active subscription if exists
    const currentSub = await prisma.subscription.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' }
    });

    if (currentSub) {
      await prisma.subscription.update({
        where: { id: currentSub.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE'
        }
      });
    }

    // SAA-002: Flush in-memory tenant cache agar limit kuota paket baru langsung aktif
    invalidateTenantCache(id);
    emitToTenant(id, 'tenant:plan_changed', {
      planId: plan.id,
      planName: plan.name,
      planCode: plan.code,
      message: `Paket tenant telah diubah ke ${plan.name}`
    });

    await AuditLogger.log({
      tenantId: id,
      action: 'PLAN_CHANGE_FORCE',
      resource: 'PLATFORM_ADMIN',
      description: `Developer mengubah paket tenant ${updated.name} menjadi ${plan.name} (${plan.code})`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Paket tenant ${updated.name} berhasil diubah ke ${plan.name}`,
      tenant: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengubah paket tenant' });
  }
});

/**
 * POST /api/platform-admin/tenants/:id/override-feature
 * Grant or revoke a custom add-on feature override for tenant
 */
router.post('/tenants/:id/override-feature', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = String(req.params.id);
    const { featureKey, isEnabled, expiresAt } = req.body;

    const { featureService } = require('../services/FeatureService');

    if (isEnabled === false) {
      await featureService.revokeTenantFeature(tenantId, featureKey);
      return res.json({
        success: true,
        message: `Fitur '${featureKey}' berhasil dicabut dari tenant ini.`
      });
    } else {
      const expDate = expiresAt ? new Date(expiresAt) : undefined;
      await featureService.grantTenantFeature(tenantId, featureKey, expDate);
      return res.json({
        success: true,
        message: `Fitur '${featureKey}' berhasil diaktifkan sebagai custom add-on!`
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memproses override fitur' });
  }
});

/**
 * GET /api/platform-admin/invoices
 * List all subscription invoices with filter
 */
router.get('/invoices', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        tenant: true,
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.totalAmount || inv.amount,
      status: inv.status,
      paymentMethod: inv.paymentMethod || 'MANUAL_TRANSFER',
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
      tenant: {
        id: inv.tenant?.id,
        name: inv.tenant?.name,
        slug: inv.tenant?.slug
      },
      plan: inv.plan?.name || 'Paket Langganan'
    }));

    return res.json({
      success: true,
      total: formatted.length,
      invoices: formatted
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memuat daftar invoice' });
  }
});

/**
 * POST /api/platform-admin/invoices/:id/verify
 * 1-Click Approve / Verify Manual Bank Transfer Proof
 */
router.post('/invoices/:id/verify', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  const { featureService } = require('../services/FeatureService');
  try {
    const id = String(req.params.id);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        tenant: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    }

    // Update invoice to PAID
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod: invoice.paymentMethod || 'MANUAL_TRANSFER_VERIFIED'
      }
    });

    // SAA-001: Hitung perpanjangan berdasarkan billingCycle (YEARLY = 365 hari, MONTHLY = 30 hari)
    let daysToAdd = 30;
    let isYearly = false;
    let newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (invoice.subscriptionId) {
      const sub = await prisma.subscription.findUnique({ where: { id: invoice.subscriptionId } });
      isYearly = sub?.billingCycle === 'YEARLY';
      daysToAdd = isYearly ? 365 : 30;

      const currentExpiry = sub?.currentPeriodEnd || new Date();
      const baseDate = new Date(currentExpiry).getTime() > Date.now() ? new Date(currentExpiry) : new Date();
      newExpiry = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: newExpiry
        }
      });
    }

    // Activate Tenant — update planId agar fitur plan baru langsung aktif
    if (invoice.tenantId) {
      await prisma.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          status: 'ACTIVE',
          trialEndsAt: newExpiry,
          ...(invoice.planId ? { planId: invoice.planId } : {}) // ← FIX: set plan baru
        }
      });

      // Flush feature cache agar plan baru langsung berlaku tanpa tunggu 60 detik
      featureService.clearCache(invoice.tenantId);

      // Flush tenant resolver cache & emit socket real-time
      invalidateTenantCache(invoice.tenantId);
      emitToTenant(invoice.tenantId, 'subscription:renewed', {
        status: 'ACTIVE',
        planId: invoice.planId,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        currentPeriodEnd: newExpiry
      });
      emitToTenant(invoice.tenantId, 'tenant:status_changed', {
        status: 'ACTIVE',
        planId: invoice.planId
      });
    }

    await AuditLogger.log({
      tenantId: invoice.tenantId,
      action: 'INVOICE_PAID',
      resource: 'PLATFORM_ADMIN',
      description: `Memverifikasi pembayaran invoice manual ${invoice.invoiceNumber} senilai Rp ${invoice.amount.toLocaleString('id-ID')} (${daysToAdd} hari / ${isYearly ? 'Tahunan' : 'Bulanan'})`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Pembayaran Invoice #${invoice.invoiceNumber} berhasil diverifikasi! Masa aktif tenant ${invoice.tenant?.name || ''} aktif +${daysToAdd} hari (${isYearly ? '1 Tahun' : '1 Bulan'}).`,
      invoice: updatedInvoice
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memverifikasi invoice' });
  }
});

/**
 * POST /api/platform-admin/tenants/:id/impersonate
 * 1-Click Login / Impersonate as Tenant Owner
 */
router.post('/tenants/:id/impersonate', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        outlets: true,
        memberships: {
          include: {
            user: true,
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    }

    const ownerMember = tenant.memberships.find((m: any) => m.role?.name === 'OWNER' || m.role?.name === 'Admin') || tenant.memberships[0];
    const user = ownerMember?.user || req.user;
    const outlet = tenant.outlets[0];

    const permissions = ownerMember?.role?.permissions?.map((rp: any) => rp.permission.key) || [
      'pos.view', 'pos.create', 'products.view', 'products.manage', 'settings.manage', 'reports.view'
    ];

    // SAA-004 & SEC-001: Issue Token dengan claim isImpersonated & identitas asli admin, durasi terbatas 1 hari
    const token = jwt.sign({
      id: user.id,
      username: user.username,
      tenantId: tenant.id,
      outletId: outlet?.id || 'outlet-default',
      role: 'OWNER',
      permissions,
      isImpersonated: true,
      impersonatorId: req.user?.id,
      impersonatorUsername: req.user?.username
    }, JWT_SECRET, { expiresIn: '1d' });

    await AuditLogger.log({
      tenantId: tenant.id,
      action: 'SWITCH_TENANT',
      resource: 'PLATFORM_ADMIN',
      description: `Platform Developer ${req.user?.username || 'SuperAdmin'} (ID: ${req.user?.id}) melakukan impersonasi ke tenant ${tenant.name} sebagai ${user.username}`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Berhasil masuk ke ruang kerja tenant ${tenant.name}`,
      token,
      user: {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        role: 'OWNER',
        tenantId: tenant.id,
        outletId: outlet?.id,
        permissions
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal melakukan impersonasi tenant' });
  }
});

/**
 * ─── MASTER PLAN & FEATURE MONETIZATION ENDPOINTS ─────────────────────────
 */

/**
 * GET /api/platform-admin/plans
 * Get all SaaS plans with feature mappings and tenant subscriber count
 */
router.get('/plans', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        features: {
          include: {
            feature: true
          }
        },
        _count: {
          select: {
            tenants: true,
            subscriptions: true
          }
        }
      },
      orderBy: { priceMonthly: 'asc' }
    });

    return res.json({
      success: true,
      plans
    });
  } catch (error: any) {
    console.error('[Platform Admin /plans Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat data master paket' });
  }
});

/**
 * PUT /api/platform-admin/plans/:id
 * Update plan details (pricing, quotas, name, limits)
 */
router.put('/plans/:id', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      maxOutlets,
      maxUsers,
      maxProducts,
      isActive
    } = req.body;

    const updated = await prisma.plan.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name) : undefined,
        description: description !== undefined ? String(description) : undefined,
        priceMonthly: priceMonthly !== undefined ? Number(priceMonthly) : undefined,
        priceYearly: priceYearly !== undefined ? Number(priceYearly) : undefined,
        maxOutlets: maxOutlets !== undefined ? Number(maxOutlets) : undefined,
        maxUsers: maxUsers !== undefined ? Number(maxUsers) : undefined,
        maxProducts: maxProducts !== undefined ? Number(maxProducts) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined
      }
    });

    await AuditLogger.log({
      tenantId: 'PLATFORM_GLOBAL',
      action: 'PLAN_UPDATE',
      resource: 'PLATFORM_ADMIN',
      description: `Memperbarui konfigurasi harga/kuota paket ${updated.name} (${updated.code})`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Paket ${updated.name} berhasil diperbarui!`,
      plan: updated
    });
  } catch (error: any) {
    console.error('[Platform Admin Update Plan Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memperbarui paket' });
  }
});

/**
 * GET /api/platform-admin/features
 * List all registered features grouped by module
 */
router.get('/features', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const features = await prisma.feature.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }]
    });

    return res.json({
      success: true,
      features
    });
  } catch (error: any) {
    console.error('[Platform Admin /features Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat katalog fitur' });
  }
});

/**
 * POST /api/platform-admin/plans/:id/toggle-feature
 * Toggle a feature key in a specific Plan
 */
router.post('/plans/:id/toggle-feature', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const planId = String(req.params.id);
    const { featureId, enabled } = req.body;

    if (!featureId) {
      return res.status(400).json({ error: 'featureId wajib diisi' });
    }

    const existing = await prisma.planFeature.findFirst({
      where: { planId, featureId }
    });

    let actionTaken = '';
    if (enabled && !existing) {
      await prisma.planFeature.create({
        data: { planId, featureId }
      });
      actionTaken = 'ENABLED';
    } else if (!enabled && existing) {
      await prisma.planFeature.deleteMany({
        where: { planId, featureId }
      });
      actionTaken = 'DISABLED';
    }

    return res.json({
      success: true,
      message: `Fitur berhasil di-${actionTaken === 'ENABLED' ? 'aktifkan' : 'nonaktifkan'} untuk paket ini.`,
      action: actionTaken
    });
  } catch (error: any) {
    console.error('[Platform Admin Toggle Feature Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal mengubah status fitur paket' });
  }
});

/**
 * GET /api/platform-admin/database-stats
 * Comprehensive real-time metrics, table row counts, and latency for PostgreSQL database
 */
router.get('/database-stats', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');

    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - t0);

    const [
      tenantCount,
      outletCount,
      userCount,
      orderCount,
      productCount,
      categoryCount,
      ingredientCount,
      ingredientLogCount,
      invoiceCount,
      subscriptionCount,
      paymentTxCount,
      auditLogCount,
      tableCount,
      cashFlowCount
    ] = await Promise.all([
      prisma.tenant.count().catch(() => 0),
      prisma.outlet.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.order.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.category.count().catch(() => 0),
      prisma.ingredient.count().catch(() => 0),
      prisma.ingredientLog.count().catch(() => 0),
      prisma.invoice.count().catch(() => 0),
      prisma.subscription.count().catch(() => 0),
      prisma.paymentTransaction.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
      prisma.table.count().catch(() => 0),
      prisma.cashFlow.count().catch(() => 0)
    ]);

    const totalRecords = 
      tenantCount + outletCount + userCount + orderCount + 
      productCount + categoryCount + ingredientCount + ingredientLogCount + 
      invoiceCount + subscriptionCount + paymentTxCount + auditLogCount + 
      tableCount + cashFlowCount;

    return res.json({
      success: true,
      engine: isPostgres ? 'PostgreSQL 16' : 'SQLite (Embedded)',
      status: 'CONNECTED',
      latencyMs: Math.max(1, latencyMs),
      poolStatus: 'Healthy (Max: 20 connections)',
      uptimeSeconds: Math.round(process.uptime()),
      totalRecords,
      counts: {
        tenants: tenantCount,
        outlets: outletCount,
        users: userCount,
        orders: orderCount,
        products: productCount,
        categories: categoryCount,
        ingredients: ingredientCount,
        ingredientLogs: ingredientLogCount,
        invoices: invoiceCount,
        subscriptions: subscriptionCount,
        paymentTransactions: paymentTxCount,
        auditLogs: auditLogCount,
        tables: tableCount,
        cashFlows: cashFlowCount
      }
    });
  } catch (error: any) {
    console.error('[Platform Admin /database-stats Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat statistik database' });
  }
});

/**
 * GET /api/platform-admin/database-backup
 * Direct stream of safe parametric SQL dump or snapshot for Platform Developers
 */
router.get('/database-backup', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const isConfirmed = req.query.confirm === 'true' || req.headers['x-confirm-backup'] === 'true';
    if (!isConfirmed) {
      return res.status(400).json({
        error: 'Konfirmasi keamanan diperlukan: Tambahkan query parameter ?confirm=true atau header x-confirm-backup: true untuk mengunduh dump database platform.',
        code: 'CONFIRMATION_REQUIRED'
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const clientIp = req.ip || req.socket?.remoteAddress || 'Unknown IP';
    
    await AuditLogger.log({
      tenantId: 'PLATFORM_GLOBAL',
      action: 'DATABASE_BACKUP_EXPORT',
      resource: 'PLATFORM_ADMIN',
      description: `Developer ${req.user?.username || 'SuperAdmin'} (ID: ${req.user?.id}) mengunduh full backup database platform dari IP ${clientIp}.`,
      severity: 'CRITICAL'
    }, req);

    // Forward to existing safe backup export in database route or direct JSON/SQL stream
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');

    if (isPostgres) {
      try {
        const { spawn } = require('child_process');
        const path = require('path');
        const fs = require('fs');

        const parsedUrl = new URL(dbUrl);
        const host = parsedUrl.hostname || 'localhost';
        const port = parsedUrl.port || '5432';
        const user = parsedUrl.username || 'postgres';
        const password = parsedUrl.password || '';
        const dbName = parsedUrl.pathname.replace(/^\//, '') || 'poscafe_db';

        const dumpArgs = [
          '-h', host,
          '-p', port,
          '-U', user,
          '-d', dbName,
          '--clean',
          '--if-exists'
        ];

        const tempDumpPath = path.join(process.cwd(), `temp_platform_backup_${Date.now()}.sql`);
        const fileStream = fs.createWriteStream(tempDumpPath);

        const pgDumpProcess = spawn('pg_dump', dumpArgs, {
          env: { ...process.env, PGPASSWORD: password }
        });

        pgDumpProcess.stdout.pipe(fileStream);

        pgDumpProcess.on('error', () => {
          fileStream.close();
          try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
          exportFullPlatformJsonSnapshot(res, timestamp);
        });

        pgDumpProcess.on('close', (code: number) => {
          fileStream.close();
          if (code === 0 && fs.existsSync(tempDumpPath) && fs.statSync(tempDumpPath).size > 100) {
            return res.download(tempDumpPath, `codenusa-platform-backup-${timestamp}.sql`, () => {
              try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
            });
          } else {
            try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
            exportFullPlatformJsonSnapshot(res, timestamp);
          }
        });
        return;
      } catch (err) {
        console.warn('[Platform Backup] pg_dump failed, falling back to JSON snapshot:', err);
      }
    }

    await exportFullPlatformJsonSnapshot(res, timestamp);
  } catch (error: any) {
    console.error('[Platform Admin Backup Error]', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal memproses backup database' });
    }
  }
});

async function exportFullPlatformJsonSnapshot(res: Response, timestamp: string) {
  const [
    tenants, outlets, users, roles, permissions, plans, features,
    categories, products, orders, invoices, subscriptions, auditLogs
  ] = await Promise.all([
    prisma.tenant.findMany(),
    prisma.outlet.findMany(),
    prisma.user.findMany(),
    prisma.role.findMany(),
    prisma.permission.findMany(),
    prisma.plan.findMany(),
    prisma.feature.findMany(),
    prisma.category.findMany(),
    prisma.product.findMany(),
    prisma.order.findMany(),
    prisma.invoice.findMany(),
    prisma.subscription.findMany(),
    prisma.auditLog.findMany({ take: 1000, orderBy: { createdAt: 'desc' } })
  ]);

  const payload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      platform: 'Codenusa SaaS POS',
      version: '2.4.0',
      totalEntities: 13
    },
    tenants,
    outlets,
    users,
    roles,
    permissions,
    plans,
    features,
    categories,
    products,
    orders,
    invoices,
    subscriptions,
    auditLogs
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="codenusa-saas-snapshot-${timestamp}.json"`);
  return res.send(JSON.stringify(payload, null, 2));
}

/**
 * GET /api/platform-admin/broadcasts
 * Get all active and past system broadcasts for Platform Developer Console
 */
router.get('/broadcasts', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { broadcastService } = require('../services/BroadcastService');
    const broadcasts = broadcastService.getAll();
    return res.json({
      success: true,
      broadcasts
    });
  } catch (error: any) {
    console.error('[Platform Admin /broadcasts Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat siaran' });
  }
});

/**
 * POST /api/platform-admin/broadcasts
 * Create a new emergency warning / maintenance broadcast to tenant POS & Dashboards
 */
router.post('/broadcasts', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { broadcastService } = require('../services/BroadcastService');
    const { title, message, type, targetTenantId } = req.body;

    // SEC-003: Sanitasi payload broadcast untuk menangkal Stored XSS di POS terminal
    const cleanTitle = sanitizeHtml(String(title || '').trim());
    const cleanMessage = sanitizeHtml(String(message || '').trim());

    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ error: 'Judul dan pesan siaran wajib diisi' });
    }

    let targetTenantName: string | null = null;
    if (targetTenantId) {
      const targetTenant = await prisma.tenant.findUnique({
        where: { id: targetTenantId }
      });
      targetTenantName = targetTenant ? targetTenant.name : null;
    }

    const created = broadcastService.create({
      title: cleanTitle,
      message: cleanMessage,
      type: type || 'WARNING',
      targetTenantId: targetTenantId || null,
      targetTenantName
    });

    // Broadcast secara real-time jika ditargetkan ke tenant tertentu
    if (targetTenantId) {
      emitToTenant(targetTenantId, 'system:broadcast', created);
    }

    await AuditLogger.log({
      tenantId: targetTenantId || 'PLATFORM_GLOBAL',
      action: 'SYSTEM_BROADCAST_CREATED',
      resource: 'PLATFORM_ADMIN',
      description: `Developer mempublikasikan siaran '${cleanTitle}' (${type || 'WARNING'}) ke ${targetTenantName ? `Tenant ${targetTenantName}` : 'Semua Tenant'}.`,
      severity: type === 'DANGER' ? 'CRITICAL' : 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: 'Siaran pengumuman berhasil dipublikasikan!',
      broadcast: created
    });
  } catch (error: any) {
    console.error('[Platform Admin Create Broadcast Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal membuat siaran pengumuman' });
  }
});

/**
 * DELETE /api/platform-admin/broadcasts/:id
 * Delete / revoke an active broadcast
 */
router.delete('/broadcasts/:id', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { broadcastService } = require('../services/BroadcastService');
    const id = String(req.params.id);
    const success = broadcastService.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'Siaran tidak ditemukan' });
    }

    await AuditLogger.log({
      tenantId: 'PLATFORM_GLOBAL',
      action: 'SYSTEM_BROADCAST_DELETED',
      resource: 'PLATFORM_ADMIN',
      description: `Developer menghapus siaran pengumuman ID: ${id}`,
      severity: 'INFO'
    }, req);

    return res.json({
      success: true,
      message: 'Siaran berhasil dihapus'
    });
  } catch (error: any) {
    console.error('[Platform Admin Delete Broadcast Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal menghapus siaran' });
  }
});

/**
 * GET /api/platform-admin/active-broadcasts
 * Public / Tenant endpoint to fetch currently active broadcasts for their workspace & POS
 */
router.get('/active-broadcasts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { broadcastService } = require('../services/BroadcastService');
    const tenantId = req.user?.tenantId || null;
    const active = broadcastService.getActiveForTenant(tenantId);
    return res.json({
      success: true,
      broadcasts: active
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat siaran aktif' });
  }
});

/**
 * GET /api/platform-admin/tenants/:tenantId/apk-status
 * Check status of built APKs for a tenant
 */
router.get('/tenants/:tenantId/apk-status', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = String(req.params.tenantId);
    const fs = require('fs');
    const path = require('path');

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] }
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });

    const cleanSlug = tenant.slug.replace(/[^a-z0-9]/g, '');
    const releaseDir = path.resolve(process.cwd(), '..', 'release');

    const cashierApk = path.join(releaseDir, `${cleanSlug}-pos-cashier.apk`);
    const staffApk = path.join(releaseDir, `${cleanSlug}-staff.apk`);

    const hasCashier = fs.existsSync(cashierApk);
    const hasStaff = fs.existsSync(staffApk);

    const cashierStats = hasCashier ? fs.statSync(cashierApk) : null;
    const staffStats = hasStaff ? fs.statSync(staffApk) : null;

    return res.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      cashier: {
        exists: hasCashier,
        fileName: `${cleanSlug}-pos-cashier.apk`,
        sizeMb: cashierStats ? (cashierStats.size / (1024 * 1024)).toFixed(2) : null,
        updatedAt: cashierStats ? cashierStats.mtime : null
      },
      staff: {
        exists: hasStaff,
        fileName: `${cleanSlug}-staff.apk`,
        sizeMb: staffStats ? (staffStats.size / (1024 * 1024)).toFixed(2) : null,
        updatedAt: staffStats ? staffStats.mtime : null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gagal mengecek status APK' });
  }
});

/**
 * POST /api/platform-admin/tenants/:tenantId/build-apk
 * Trigger branded APK generation
 */
router.post('/tenants/:tenantId/build-apk', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = String(req.params.tenantId);
    const { target = 'all', env = 'prod' } = req.body;
    const { spawn } = require('child_process');
    const path = require('path');

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] }
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });

    // Sanitasi dan whitelist parameter agar kebal terhadap shell/command injection
    const ALLOWED_TARGETS = ['all', 'kasir', 'staf', 'staff', 'pos'];
    const ALLOWED_ENVS = ['prod', 'production', 'staging', 'dev', 'development'];

    const safeSlug = tenant.slug.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeTarget = ALLOWED_TARGETS.includes(String(target).toLowerCase()) ? String(target).toLowerCase() : 'all';
    const safeEnv = ALLOWED_ENVS.includes(String(env).toLowerCase()) ? String(env).toLowerCase() : 'prod';

    const scriptPath = path.resolve(process.cwd(), '..', 'scripts', 'generate_branded_apk.js');
    const args = [scriptPath, `--tenant=${safeSlug}`, `--target=${safeTarget}`, `--env=${safeEnv}`];

    // Eksekusi di latar belakang menggunakan spawn tanpa shell interpreter (kebal command injection)
    const child = spawn('node', args, {
      cwd: path.resolve(process.cwd(), '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';
    child.stdout?.on('data', (d: any) => { stdoutData += d.toString(); });
    child.stderr?.on('data', (d: any) => { stderrData += d.toString(); });

    child.on('close', (code: number) => {
      if (code !== 0) {
        console.error(`[APK BUILD ERROR code=${code}]`, stderrData);
      } else {
        console.log('[APK BUILD SUCCESS]', stdoutData);
      }
    });

    await AuditLogger.log({
      tenantId: tenant.id,
      action: 'BRANDED_APK_BUILD_REQUESTED',
      resource: 'MOBILE_APP',
      description: `Developer memicu build APK Branded untuk tenant: ${tenant.name} (${target})`,
      severity: 'INFO'
    }, req);

    return res.json({
      success: true,
      message: `Proses build APK untuk "${tenant.name}" telah dimulai di latar belakang. Silakan refresh status dalam beberapa saat.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gagal memulai build APK' });
  }
});

/**
 * GET /api/platform-admin/tenants/:tenantId/download-apk/:type
 * Download compiled APK file
 */
router.get('/tenants/:tenantId/download-apk/:type', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = String(req.params.tenantId);
    const type = String(req.params.type);
    const fs = require('fs');
    const path = require('path');

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }] }
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });

    const cleanSlug = tenant.slug.replace(/[^a-z0-9]/g, '');
    const releaseDir = path.resolve(process.cwd(), '..', 'release');
    const fileName = type === 'staff' ? `${cleanSlug}-staff.apk` : `${cleanSlug}-pos-cashier.apk`;
    const filePath = path.join(releaseDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File APK ${fileName} belum dibuat atau tidak ditemukan.` });
    }

    return res.download(filePath, fileName);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gagal mengunduh file APK' });
  }
});

/**
 * ─── Platform Backup & Disaster Recovery Management ────────────────────────
 */

/**
 * GET /api/platform-admin/backups
 * Menampilkan daftar seluruh berkas cadangan dengan klasifikasi GFS & status integritas
 */
router.get('/backups', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const backups = BackupService.listBackups();
    const cronStatus = backupCronService.getStatus();
    return res.json({
      success: true,
      total: backups.length,
      cronStatus,
      backups
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil daftar backup' });
  }
});

/**
 * POST /api/platform-admin/backups/create
 * Membuat backup on-demand (Full Platform atau Scoped Tenant)
 */
router.post('/backups/create', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { scope, tenantId, isEncrypted, compress } = req.body;
    const backup = await BackupService.createBackup({
      scope: scope || (tenantId ? 'TENANT' : 'FULL'),
      tenantId: tenantId || null,
      isEncrypted: isEncrypted !== false,
      compress: compress !== false,
      type: 'json'
    });

    await AuditLogger.log({
      tenantId: tenantId || null,
      action: 'DATABASE_BACKUP_CREATED',
      resource: 'PLATFORM_ADMIN',
      resourceId: backup.filename,
      description: `Platform Admin ${req.user?.username || 'SuperAdmin'} membuat backup terenkripsi (${backup.sizeFormatted}).`,
      severity: 'WARNING'
    }, req);

    return res.status(201).json({
      success: true,
      message: 'Backup database berhasil dibuat',
      backup
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal membuat backup database' });
  }
});

/**
 * POST /api/platform-admin/backups/purge
 * Menjalankan pembersihan retensi berkas (GFS Policy atau custom retentionDays)
 */
router.post('/backups/purge', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { retentionDays, useGfs } = req.body;
    const days = retentionDays ? parseInt(retentionDays, 10) : (useGfs === false ? 30 : undefined);
    const result = BackupService.purgeOldBackups(days);

    await AuditLogger.log({
      tenantId: null,
      action: 'DATABASE_BACKUP_PURGED',
      resource: 'PLATFORM_ADMIN',
      description: `Pembersihan retensi backup dijalankan: ${result.deletedCount} berkas dipangkas (${result.freedFormatted} dibebaskan).`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Pembersihan retensi selesai. ${result.deletedCount} berkas cadangan dihapus.`,
      result
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal membersihkan backup lama' });
  }
});

/**
 * POST /api/platform-admin/backups/restore
 * Melakukan pemulihan disaster recovery dari snapshot
 */
router.post('/backups/restore', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { fileName, targetTenantId } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'Parameter fileName wajib disertakan' });
    }

    const result = await BackupService.restoreBackup(fileName, targetTenantId);

    await AuditLogger.log({
      tenantId: targetTenantId || null,
      action: 'DATABASE_RESTORE',
      resource: 'PLATFORM_ADMIN',
      resourceId: fileName,
      description: `Disaster recovery restore dieksekusi dari ${fileName} (${result.durationMs} ms).`,
      severity: 'CRITICAL'
    }, req);

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memulihkan database dari snapshot' });
  }
});

/**
 * GET /api/platform-admin/backups/verify/:fileName
 * Verifikasi keaslian dan integritas berkas cadangan (Anti-Tamper check)
 */
router.get('/backups/verify/:fileName', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const fileName = String(req.params.fileName);
    const verification = BackupService.verifyBackupIntegrity(fileName);
    return res.json({
      success: true,
      fileName,
      isValid: verification.isValid,
      error: verification.error,
      metadata: verification.metadata
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memverifikasi integritas berkas' });
  }
});

/**
 * GET /api/platform-admin/backups/download/:fileName
 * Mengunduh berkas snapshot aman
 */
router.get('/backups/download/:fileName', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const fileName = path.basename(String(req.params.fileName)); // sanitize
    const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'db');
    const filePath = path.join(BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Berkas backup tidak ditemukan' });
    }

    return res.download(filePath, fileName);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengunduh berkas backup' });
  }
});

/**
 * GET /api/platform-admin/backups/cron-status
 * Status background cron backup 03:00 WIB
 */
router.get('/backups/cron-status', authenticateToken, requirePlatformAdmin, async (_req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    status: backupCronService.getStatus()
  });
});

export default router;


