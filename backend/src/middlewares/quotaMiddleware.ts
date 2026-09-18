import { Request, Response, NextFunction } from 'express';
import { quotaService } from '../services/QuotaService';
import { TenantContext } from '../utils/tenantContext';

/**
 * Middleware untuk memastikan tenant tidak melampaui batas kuota paket langganannya
 * Contoh penggunaan: router.post('/', requireQuota('product'), createProductHandler);
 */
export function requireQuota(resourceType: 'outlet' | 'user' | 'product') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      // Platform admin bypass kuota
      if (user?.isPlatformAdmin || TenantContext.isPlatformAdmin()) {
        return next();
      }

      const tenantId = TenantContext.getTenantId() || user?.tenantId || (req.headers['x-tenant-id'] as string) || 'tenant-default-muki';

      let checkResult;
      if (resourceType === 'outlet') {
        checkResult = await quotaService.canCreateOutlet(tenantId);
      } else if (resourceType === 'user') {
        checkResult = await quotaService.canCreateUser(tenantId);
      } else {
        checkResult = await quotaService.canCreateProduct(tenantId);
      }

      if (!checkResult.allowed) {
        return res.status(403).json({
          error: `Batas kuota ${resourceType} telah tercapai (${checkResult.current}/${checkResult.max}).`,
          code: 'QUOTA_EXCEEDED',
          resource: resourceType,
          current: checkResult.current,
          max: checkResult.max,
          message: 'Silakan upgrade paket langganan bisnis Anda untuk menambah kapasitas kuota.'
        });
      }

      next();
    } catch (err) {
      console.error(`[requireQuota Middleware Error for '${resourceType}']`, err);
      next(err);
    }
  };
}
