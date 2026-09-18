import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware';
import { featureService } from '../services/FeatureService';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

/**
 * GET /api/features/my-features
 * Mengambil daftar seluruh feature keys yang aktif untuk tenant saat ini
 */
router.get('/my-features', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId || 'tenant-default-muki';

    const features = await featureService.getTenantFeatures(tenantId);
    return res.json({
      tenantId,
      features
    });
  } catch (err: any) {
    console.error('[Feature API /my-features Error]', err);
    return res.status(500).json({ error: 'Gagal memuat fitur tenant' });
  }
});

/**
 * GET /api/features/tenant-plan
 * Mengambil informasi paket aktif, batas kuota, dan pemakaian tenant
 */
router.get('/tenant-plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId || 'tenant-default-muki';

    const info = await featureService.getTenantPlanAndLimits(tenantId);
    return res.json(info);
  } catch (err: any) {
    console.error('[Feature API /tenant-plan Error]', err);
    return res.status(500).json({ error: 'Gagal memuat info plan tenant' });
  }
});

/**
 * GET /api/features/all
 * Mengambil semua registry master fitur di sistem
 */
router.get('/all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const all = await featureService.getAllFeatures();
    return res.json(all);
  } catch (err: any) {
    console.error('[Feature API /all Error]', err);
    return res.status(500).json({ error: 'Gagal memuat master fitur' });
  }
});

/**
 * GET /api/features/plans
 * Mengambil daftar seluruh SaaS plans yang tersedia
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await featureService.getAllPlans();
    return res.json(plans);
  } catch (err: any) {
    console.error('[Feature API /plans Error]', err);
    return res.status(500).json({ error: 'Gagal memuat master SaaS plans' });
  }
});

/**
 * POST /api/features/override
 * Mengelola add-on override (Grant / Revoke) untuk tenant
 */
router.post('/override', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { targetTenantId, featureKey, isEnabled, expiresAt } = req.body;
    if (!targetTenantId || !featureKey) {
      return res.status(400).json({ error: 'targetTenantId dan featureKey wajib diisi' });
    }

    if (isEnabled === false) {
      await featureService.revokeTenantFeature(targetTenantId, featureKey);
      return res.json({ success: true, message: `Fitur '${featureKey}' berhasil dinonaktifkan untuk tenant ini.` });
    } else {
      const expDate = expiresAt ? new Date(expiresAt) : undefined;
      await featureService.grantTenantFeature(targetTenantId, featureKey, expDate);
      return res.json({ success: true, message: `Fitur '${featureKey}' berhasil diaktifkan untuk tenant ini.` });
    }
  } catch (err: any) {
    console.error('[Feature API /override Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal mengubah status override fitur' });
  }
});

/**
 * POST /api/features/change-plan
 * Mengubah paket SaaS langganan tenant
 */
router.post('/change-plan', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { targetTenantId, planCode } = req.body;
    const tenantId = targetTenantId || TenantContext.getTenantId() || user?.tenantId;

    if (!tenantId || !planCode) {
      return res.status(400).json({ error: 'tenantId dan planCode wajib diisi' });
    }

    const plan = await (featureService as any)['prisma']?.plan?.findUnique({ where: { code: planCode } }) 
      || await require('@prisma/client').PrismaClient ? new (require('@prisma/client').PrismaClient)().plan.findUnique({ where: { code: planCode } }) : null;

    if (!plan) {
      return res.status(404).json({ error: `Paket '${planCode}' tidak ditemukan` });
    }

    const prismaClient = new (require('@prisma/client').PrismaClient)();
    await prismaClient.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id }
    });

    featureService.clearCache(tenantId);

    return res.json({
      success: true,
      message: `Paket tenant berhasil diubah menjadi ${plan.name}`,
      plan
    });
  } catch (err: any) {
    console.error('[Feature API /change-plan Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal mengganti paket tenant' });
  }
});

/**
 * GET /api/features/tenants-overview
 * Mengambil ringkasan semua tenant beserta paket dan fiturnya (Platform Admin / Owner)
 */
router.get('/tenants-overview', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const prismaClient = new (require('@prisma/client').PrismaClient)();
    const tenants = await prismaClient.tenant.findMany({
      include: {
        plan: true,
        featureOverrides: {
          include: { feature: true }
        },
        _count: {
          select: { outlets: true, memberships: true, products: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(tenants);
  } catch (err: any) {
    console.error('[Feature API /tenants-overview Error]', err);
    return res.status(500).json({ error: 'Gagal memuat ringkasan tenant' });
  }
});

export default router;
