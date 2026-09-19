import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { quotaService } from '../services/QuotaService';
import { featureService } from '../services/FeatureService';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/tenants/my-subscription
 * Mengambil detail paket langganan aktif, sisa masa aktif/trial, kuota pemakaian, dan status fitur
 */
router.get('/my-subscription', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            outlets: true,
            memberships: true,
            products: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Data tenant tidak ditemukan' });
    }

    const currentSub = tenant.subscriptions[0];
    const plan = currentSub?.plan || tenant.plan || {
      id: 'plan-starter-default',
      name: 'Paket Starter UMKM',
      code: 'STARTER',
      priceMonthly: 99000,
      priceYearly: 990000,
      maxOutlets: 1,
      maxUsers: 3,
      maxProducts: 100
    };

    // Hitung sisa hari aktif
    const now = new Date();
    const expiryDate = currentSub?.currentPeriodEnd || tenant.trialEndsAt || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const diffTime = new Date(expiryDate).getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Ambil pemakaian kuota saat ini
    const usageData = await quotaService.getUsageAndLimits(tenantId).catch(() => ({
      quotas: {
        outlets: { used: tenant._count.outlets, max: plan.maxOutlets, remaining: Math.max(0, plan.maxOutlets - tenant._count.outlets), isExceeded: tenant._count.outlets >= plan.maxOutlets },
        users: { used: tenant._count.memberships, max: plan.maxUsers, remaining: Math.max(0, plan.maxUsers - tenant._count.memberships), isExceeded: tenant._count.memberships >= plan.maxUsers },
        products: { used: tenant._count.products, max: plan.maxProducts, remaining: Math.max(0, plan.maxProducts - tenant._count.products), isExceeded: tenant._count.products >= plan.maxProducts }
      }
    }));

    // Ambil daftar fitur yang aktif
    const activeFeatures = await featureService.getTenantFeatures(tenantId).catch(() => []);

    return res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        ownerName: tenant.ownerName,
        phone: tenant.phone,
        email: tenant.email,
        trialEndsAt: tenant.trialEndsAt
      },
      subscription: {
        status: currentSub?.status || tenant.status,
        planName: plan.name,
        planCode: plan.code,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        billingCycle: currentSub?.billingCycle || 'MONTHLY',
        currentPeriodStart: currentSub?.currentPeriodStart || tenant.createdAt,
        currentPeriodEnd: expiryDate,
        daysRemaining,
        isTrial: tenant.status === 'TRIAL',
        isSuspended: tenant.status === 'SUSPENDED',
        isGracePeriod: tenant.status === 'GRACE_PERIOD'
      },
      quotas: usageData.quotas,
      features: activeFeatures
    });
  } catch (error: any) {
    console.error('[Tenant Subscription API Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat status langganan tenant' });
  }
});

/**
 * GET /api/tenants/profile
 * Mengambil profil bisnis tenant
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        outlets: {
          orderBy: { createdAt: 'asc' }
        },
        plan: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    }

    return res.json({
      success: true,
      tenant
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memuat profil tenant' });
  }
});

/**
 * PATCH /api/tenants/profile
 * Memperbarui data profil bisnis tenant oleh Owner
 */
router.patch('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const { name, ownerName, phone, email, notes, logoUrl } = req.body;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(ownerName !== undefined ? { ownerName: ownerName?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {})
      }
    });

    await AuditLogger.log({
      tenantId,
      action: 'TENANT_UPDATE',
      resource: 'SETTINGS',
      description: `Memperbarui profil bisnis tenant: ${updated.name}`,
      severity: 'INFO'
    }, req);

    return res.json({
      success: true,
      message: 'Profil bisnis berhasil disimpan',
      tenant: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memperbarui profil bisnis' });
  }
});

export default router;
