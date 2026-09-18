import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { TenantContext, TenantContextData } from '../utils/tenantContext';
import { AuthRequest } from './authMiddleware';

const prisma = new PrismaClient();

// Cache slug-to-tenant in memory for fast resolution
const tenantCache = new Map<string, { id: string; slug: string; status: string }>();

export async function resolveTenantFromRequest(req: Request): Promise<{ id: string; slug: string; status: string } | null> {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const hostString = Array.isArray(host) ? host[0] : host;

  // 1. Coba dari custom header 'x-tenant-slug' atau 'x-tenant-id'
  const headerSlug = req.headers['x-tenant-slug'] as string;
  const headerTenantId = req.headers['x-tenant-id'] as string;

  if (headerSlug) {
    if (tenantCache.has(headerSlug)) return tenantCache.get(headerSlug)!;
    const tenant = await prisma.tenant.findUnique({ where: { slug: headerSlug } });
    if (tenant) {
      const data = { id: tenant.id, slug: tenant.slug, status: tenant.status };
      tenantCache.set(headerSlug, data);
      return data;
    }
  }

  if (headerTenantId) {
    if (tenantCache.has(headerTenantId)) return tenantCache.get(headerTenantId)!;
    const tenant = await prisma.tenant.findUnique({ where: { id: headerTenantId } });
    if (tenant) {
      const data = { id: tenant.id, slug: tenant.slug, status: tenant.status };
      tenantCache.set(headerTenantId, data);
      return data;
    }
  }

  // 2. Coba ekstrak subdomain dari hostname (e.g. mukiramen.codenusa.id)
  const hostParts = hostString.split(':')[0].split('.');
  if (hostParts.length >= 3) {
    const subdomain = hostParts[0].toLowerCase();
    if (subdomain !== 'app' && subdomain !== 'api' && subdomain !== 'admin' && subdomain !== 'www') {
      if (tenantCache.has(subdomain)) return tenantCache.get(subdomain)!;
      const tenant = await prisma.tenant.findUnique({ where: { slug: subdomain } });
      if (tenant) {
        const data = { id: tenant.id, slug: tenant.slug, status: tenant.status };
        tenantCache.set(subdomain, data);
        return data;
      }
    }
  }

  return null;
}

export const tenantResolverMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let resolvedTenantId = req.user?.tenantId;
    let resolvedOutletId = req.user?.outletId;
    let tenantSlug = 'mukiramen';

    // Jika ada header subdomain atau custom header, resolusikan
    const resolvedFromHeader = await resolveTenantFromRequest(req);
    if (resolvedFromHeader) {
      resolvedTenantId = resolvedFromHeader.id;
      tenantSlug = resolvedFromHeader.slug;
    }

    // Jika belum teresolusi, coba intip dari JWT Bearer Token (jika ada)
    if (!resolvedTenantId) {
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
    }

    if (!resolvedTenantId) {
      resolvedTenantId = 'tenant-default-muki';
    }

    const contextData: TenantContextData = {
      tenantId: resolvedTenantId,
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
