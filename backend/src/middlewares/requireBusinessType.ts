import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import prisma from '../db';
import { cacheService } from '../services/CacheService';
import { TenantContext } from '../utils/tenantContext';

/**
 * Middleware to restrict access based on Tenant's businessType (e.g. BENGKEL, CAFE).
 * Ensures zero cross-vertical feature bleeding.
 */
export function requireBusinessType(allowedType: string | string[]) {
  const allowed = Array.isArray(allowedType) ? allowedType : [allowedType];

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId || TenantContext.getTenantId();

      if (!tenantId) {
        return res.status(400).json({
          error: 'Konteks tenant diperlukan untuk mengakses modul vertikal ini.'
        });
      }

      // Check tenant businessType with cache
      const businessType = await cacheService.remember(
        `cache:tenant:businessType:${tenantId}`,
        300,
        async () => {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { businessType: true }
          });
          return tenant?.businessType || 'CAFE';
        }
      );

      if (!allowed.includes(businessType)) {
        return res.status(403).json({
          error: `Modul Khusus: Fitur ini dirancang khusus untuk jenis usaha [${allowed.join(', ')}]. Akun Anda saat ini terdaftar dengan profil [${businessType}]. Silakan akses menu Pengaturan jika ingin mengubah profil bisnis.`,
          requiredBusinessType: allowed,
          currentBusinessType: businessType
        });
      }

      // Attach businessType to req for convenient downstream use
      (req as any).businessType = businessType;

      next();
    } catch (err) {
      console.error('requireBusinessType Middleware Error:', err);
      return res.status(500).json({ error: 'Gagal memvalidasi jenis usaha tenant' });
    }
  };
}
