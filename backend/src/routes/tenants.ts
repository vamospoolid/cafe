import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { quotaService } from '../services/QuotaService';
import { featureService } from '../services/FeatureService';
import { AuditLogger } from '../services/AuditLogger';
import prisma from '../db';

const router = Router();

/**
 * GET /api/tenants/my-subscription
 * Mengambil detail paket langganan aktif, sisa masa aktif/trial, kuota pemakaian, dan status fitur
 */
router.get('/my-subscription', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

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

    const plan = {
      id: 'plan-standalone-enterprise',
      name: 'Lisensi Standalone Enterprise (Permanen)',
      code: 'STANDALONE',
      priceMonthly: 0,
      priceYearly: 0,
      maxOutlets: 999999,
      maxUsers: 999999,
      maxProducts: 999999
    };

    // Ambil pemakaian kuota saat ini (Unlimited)
    const usageData = await quotaService.getUsageAndLimits(tenantId).catch(() => ({
      quotas: {
        outlets: { used: tenant._count.outlets, max: plan.maxOutlets, remaining: 999999, isExceeded: false },
        users: { used: tenant._count.memberships, max: plan.maxUsers, remaining: 999999, isExceeded: false },
        products: { used: tenant._count.products, max: plan.maxProducts, remaining: 999999, isExceeded: false }
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
        status: 'ACTIVE',
        ownerName: tenant.ownerName,
        phone: tenant.phone,
        email: tenant.email,
        trialEndsAt: null
      },
      subscription: {
        status: 'ACTIVE',
        planName: plan.name,
        planCode: plan.code,
        priceMonthly: 0,
        priceYearly: 0,
        billingCycle: 'LIFETIME',
        currentPeriodStart: tenant.createdAt,
        currentPeriodEnd: null,
        daysRemaining: 999999,
        isTrial: false,
        isSuspended: false,
        isGracePeriod: false
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
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

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
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
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
