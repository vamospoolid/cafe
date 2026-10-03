import prisma from '../db';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TenantContext, TenantContextData } from '../utils/tenantContext';
import { AuthRequest } from './authMiddleware';


import { cacheService } from '../services/CacheService';

/**
 * Invalidate all cache entries that reference a specific tenantId.
 * Must be called whenever platform admin changes a tenant's status (suspend/activate).
 */
export async function invalidateTenantCache(tenantId: string): Promise<void> {
  await cacheService.invalidateTenant(tenantId);
}

/**
 * Clear all tenant cache entries. Used for testing or emergency reset.
 */
export async function clearAllTenantCache(): Promise<void> {
  await cacheService.clearAll();
}

export async function resolveTenantFromRequest(req: Request): Promise<{ id: string; slug: string; status: string } | null> {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const hostString = Array.isArray(host) ? host[0] : host;

  // 1. Coba dari custom header 'x-tenant-slug' atau 'x-tenant-id'
  const headerSlug = req.headers['x-tenant-slug'] as string;
  const headerTenantId = req.headers['x-tenant-id'] as string;

  if (headerSlug) {
    const data = await cacheService.remember(`cache:tenant:slug:${headerSlug}`, 600, async () => {
      const tenant = await prisma.tenant.findUnique({ where: { slug: headerSlug } });
      return tenant ? { id: tenant.id, slug: tenant.slug, status: tenant.status } : null;
    });
    if (data) return data;
  }

  if (headerTenantId) {
    const data = await cacheService.remember(`cache:tenant:id:${headerTenantId}`, 600, async () => {
      const tenant = await prisma.tenant.findUnique({ where: { id: headerTenantId } });
      return tenant ? { id: tenant.id, slug: tenant.slug, status: tenant.status } : null;
    });
    if (data) return data;
  }

  // 2. Coba lookup langsung dari Custom Domain (e.g. pos.vamospool.id atau kasir.mukiramen.com)
  const hostClean = hostString.split(':')[0].toLowerCase();
  if (hostClean && hostClean !== 'localhost' && hostClean !== '127.0.0.1') {
    const data = await cacheService.remember(`cache:tenant:domain:${hostClean}`, 600, async () => {
      const tenantByDomain = await prisma.tenant.findFirst({ where: { customDomain: hostClean } });
      return tenantByDomain ? { id: tenantByDomain.id, slug: tenantByDomain.slug, status: tenantByDomain.status } : null;
    });
    if (data) return data;
  }

  // 3. Coba ekstrak subdomain dari hostname (e.g. mukiramen.codenusa.id atau cafe.codenusa.id)
  const hostParts = hostClean.split('.');
  if (hostParts.length >= 3) {
    const subdomain = hostParts[0].toLowerCase();
    if (subdomain === 'cafe') {
      const data = await cacheService.remember(`cache:tenant:slug:cafe_default`, 600, async () => {
        const tenant = await prisma.tenant.findFirst({
          where: { OR: [{ slug: 'mukiramen' }, { id: 'tenant-vamos-pool' }, { slug: 'vamospool' }, { slug: 'cafe' }] }
        });
        return tenant ? { id: tenant.id, slug: tenant.slug, status: tenant.status } : null;
      });
      if (data) return data;
    } else if (subdomain !== 'app' && subdomain !== 'api' && subdomain !== 'admin' && subdomain !== 'www') {
      const data = await cacheService.remember(`cache:tenant:slug:${subdomain}`, 600, async () => {
        const tenant = await prisma.tenant.findUnique({ where: { slug: subdomain } });
        return tenant ? { id: tenant.id, slug: tenant.slug, status: tenant.status } : null;
      });
      if (data) return data;
    }
  }

  return null;
}

export const tenantResolverMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 1. Ekstrak Bearer Token lebih dahulu untuk menjamin JWT memiliki otoritas tertinggi
    let resolvedTenantId: string | undefined = req.user?.tenantId;
    let resolvedOutletId: string | undefined = req.user?.outletId;
    let tenantSlug = ''; // Tidak ada hardcode fallback — resolusi harus dari token/host

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const tokenStr = authHeader.split(' ')[1];
        const decoded = jwt.decode(tokenStr) as any;
        if (decoded && decoded.tenantId) {
          resolvedTenantId = decoded.tenantId;
          if (decoded.outletId) resolvedOutletId = decoded.outletId;
        }
      } catch {
        // Abaikan jika token rusak/invalid, akan ditangani oleh authenticateToken
      }
    }

    // 2. Jika tidak ada di JWT, gunakan header kustom
    if (!resolvedTenantId) {
      resolvedTenantId = (req.headers['x-tenant-id'] as string) || undefined;
      tenantSlug = (req.headers['x-tenant-slug'] as string) || '';
    }

    if (resolvedTenantId) {
      (req as any).tenantId = resolvedTenantId;
    }
    if (resolvedOutletId) {
      (req as any).outletId = resolvedOutletId;
    }

    const contextData: TenantContextData = {
      tenantId: resolvedTenantId || undefined,
      tenantSlug,
      outletId: resolvedOutletId,
      userId: req.user?.id,
      role: req.user?.role,
      permissions: Array.isArray(req.user?.permissions) ? req.user?.permissions : [],
      isPlatformAdmin: req.user?.isPlatformAdmin || false
    };

    // Jalankan seluruh lifecycle request berikutnya di dalam TenantContext AsyncLocalStorage
    TenantContext.run(contextData, () => {
      next();
    });
  } catch (error) {
    console.error('TenantResolver Middleware Error:', error);
    next();
  }
};
