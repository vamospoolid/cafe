import { Request, Response, NextFunction } from 'express';
import { featureService } from '../services/FeatureService';
import { TenantContext } from '../utils/tenantContext';

/**
 * Middleware untuk memvalidasi apakah tenant aktif memiliki hak akses ke fitur tertentu
 * Contoh: router.use('/kds', requireFeature('pos.kds'), kdsRoutes);
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      // Super admin platform selalu bypass feature check
      if (user?.isPlatformAdmin || TenantContext.isPlatformAdmin()) {
        return next();
      }

      // Resolusi tenant ID
      const tenantId = TenantContext.getTenantId() || user?.tenantId || (req.headers['x-tenant-id'] as string) || 'tenant-default-muki';

      const isAllowed = await featureService.isEnabled(tenantId, featureKey);

      if (!isAllowed) {
        return res.status(403).json({
          error: `Fitur '${featureKey}' tidak aktif pada paket langganan bisnis Anda.`,
          featureKey,
          code: 'FEATURE_NOT_INCLUDED',
          message: 'Silakan upgrade paket langganan Anda untuk mengakses fitur ini.'
        });
      }

      next();
    } catch (err) {
      console.error(`[requireFeature Middleware Error for '${featureKey}']`, err);
      next(err);
    }
  };
}
