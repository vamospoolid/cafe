import prisma from '../db';
import { Request, Response, NextFunction } from 'express';
import { featureService } from '../services/FeatureService';
import { TenantContext } from '../utils/tenantContext';
import { StandaloneConfig } from '../utils/standaloneConfig';

/**
 * Middleware untuk memvalidasi apakah tenant aktif memiliki hak akses ke fitur tertentu pada paket SaaS.
 * Jika dalam mode Standalone (beli-putus offline), semua fitur diizinkan penuh (100% unlocked).
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Bypass untuk mode Standalone Desktop / Offline
    if (StandaloneConfig.isStandalone()) {
      return next();
    }

    const user = (req as any).user;

    // 2. Platform Admin / Superadmin bypass gating
    if (user?.role === 'SUPERADMIN' || user?.isPlatformAdmin || user?.username === 'developer') {
      return next();
    }

    // 3. Resolve tenantId
    const tenantId = (req as any).tenantId || user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || null;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    try {
      const isAllowed = await featureService.isEnabled(tenantId, featureKey);
      if (!isAllowed) {
        return res.status(403).json({
          error: `Fitur '${featureKey}' tidak aktif atau tidak termasuk dalam paket langganan Anda. Silakan upgrade paket.`,
          code: 'FEATURE_LOCKED',
          featureKey
        });
      }
      return next();
    } catch (err) {
      console.error(`[requireFeature] Error checking feature ${featureKey}:`, err);
      return next(); // Fail-safe agar tidak menghalangi operasional jika cache transient error
    }
  };
}

