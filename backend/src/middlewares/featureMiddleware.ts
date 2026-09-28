import prisma from '../db';
import { Request, Response, NextFunction } from 'express';
import { featureService } from '../services/FeatureService';
import { TenantContext } from '../utils/tenantContext';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

/**
 * Middleware untuk memvalidasi apakah tenant aktif memiliki hak akses ke fitur tertentu
 * Contoh: router.use('/kds', requireFeature('pos.kds'), kdsRoutes);
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let user = (req as any).user;
      
      // Jika route memasang requireFeature sebelum authenticateToken, periksa header Authorization
      if (!user && req.headers['authorization']) {
        try {
          const authHeader = req.headers['authorization'];
          const token = authHeader && authHeader.split(' ')[1];
          if (token) {
            const verified = jwt.verify(token, JWT_SECRET) as any;
            if (verified) {
              user = verified;
              (req as any).user = verified;
            }
          }
        } catch (e) {}
      }
      
      // Super admin platform selalu bypass feature check
      if (user?.isPlatformAdmin || TenantContext.isPlatformAdmin()) {
        return next();
      }

      // Resolusi tenant ID (Header, Query, or Tenant Context)
      let tenantId = TenantContext.getTenantId() || user?.tenantId || (req.headers['x-tenant-id'] as string) || (req.query?.tenantId as string);
      if (!tenantId && req.query?.tenant) {
        const tenant = await prisma.tenant.findUnique({ where: { slug: String(req.query.tenant) } });
        if (tenant) tenantId = tenant.id;
      }
      if (!tenantId) return res.status(400).json({ error: 'Tenant context required', code: 'MISSING_TENANT_CONTEXT' });

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
