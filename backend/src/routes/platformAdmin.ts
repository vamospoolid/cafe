import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

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
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          outlets: true,
          _count: {
            select: {
              memberships: true,
              orders: true,
              outlets: true
            }
          }
        }
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
        _sum: { total: true },
        _count: { id: true }
      }).catch(() => ({ _sum: { total: 0 }, _count: { id: 0 } }))
    ]);

    // Calculate MRR (Monthly Recurring Revenue)
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

    for (const t of tenants) {
      if (t.status === 'ACTIVE') activeTenantsCount++;
      else if (t.status === 'TRIAL') trialTenantsCount++;
      else if (t.status === 'SUSPENDED') suspendedTenantsCount++;

      const currentSub = t.subscriptions[0];
      const planCode = currentSub?.plan?.code || 'STARTER';
      planDistribution[planCode] = (planDistribution[planCode] || 0) + 1;
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
        totalCollectedRevenue,
        pendingInvoicesCount,
        activeSubscriptionsCount
      },
      planDistribution,
      recentTenants: tenants.slice(0, 5).map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        createdAt: t.createdAt,
        outletsCount: t._count.outlets,
        usersCount: t._count.memberships,
        ordersCount: t._count.orders,
        plan: t.subscriptions[0]?.plan?.name || 'Starter Plan'
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

    await AuditLogger.log({
      tenantId: id,
      action: 'TENANT_UPDATE',
      resource: 'PLATFORM_ADMIN',
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

    const currentExpiry = sub?.currentPeriodEnd || tenant?.trialEndsAt || new Date();
    const newExpiry = new Date(new Date(currentExpiry).getTime() + days * 24 * 60 * 60 * 1000);

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

    await AuditLogger.log({
      tenantId: id,
      action: 'SUBSCRIPTION_UPDATE',
      resource: 'PLATFORM_ADMIN',
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

    // Extend / Activate Subscription for 30 days
    if (invoice.subscriptionId) {
      const sub = await prisma.subscription.findUnique({ where: { id: invoice.subscriptionId } });
      const currentExpiry = sub?.currentPeriodEnd || new Date();
      const baseDate = new Date(currentExpiry).getTime() > Date.now() ? new Date(currentExpiry) : new Date();
      const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: newExpiry
        }
      });
    }

    // Activate Tenant
    if (invoice.tenantId) {
      await prisma.tenant.update({
        where: { id: invoice.tenantId },
        data: { status: 'ACTIVE' }
      });
    }

    await AuditLogger.log({
      tenantId: invoice.tenantId,
      action: 'INVOICE_PAID',
      resource: 'PLATFORM_ADMIN',
      description: `Memverifikasi pembayaran invoice manual ${invoice.invoiceNumber} senilai Rp ${invoice.amount.toLocaleString('id-ID')}`,
      severity: 'WARNING'
    }, req);

    return res.json({
      success: true,
      message: `Pembayaran Invoice #${invoice.invoiceNumber} berhasil diverifikasi! Masa aktif tenant ${invoice.tenant?.name || ''} aktif 30 hari.`,
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

    // Issue Token with Target Tenant Context
    const token = jwt.sign({
      id: user.id,
      username: user.username,
      tenantId: tenant.id,
      outletId: outlet?.id || 'outlet-default',
      role: 'OWNER',
      permissions
    }, JWT_SECRET, { expiresIn: '7d' });

    await AuditLogger.log({
      tenantId: tenant.id,
      action: 'SWITCH_TENANT',
      resource: 'PLATFORM_ADMIN',
      description: `Platform Developer melakukan impersonasi / masuk ke tenant ${tenant.name}`,
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

export default router;
