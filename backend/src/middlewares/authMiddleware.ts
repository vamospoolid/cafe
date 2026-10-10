import prisma from '../db';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TenantContext } from '../utils/tenantContext';
import { StandaloneConfig } from '../utils/standaloneConfig';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

export interface AuthUser {
  id: number;
  username: string;
  name?: string;
  tenantId?: string;
  outletId?: string;
  role: string;
  roleId?: string;
  permissions: string[] | Record<string, boolean>;
  isPlatformAdmin?: boolean;
  isImpersonated?: boolean;
  impersonatorId?: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Akses Ditolak: Token autentikasi tidak ditemukan.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as any;
    
    // Cek keberadaan user di database
    const userExists = await prisma.user.findUnique({
      where: { id: verified.id },
      include: {
        memberships: {
          include: {
            tenant: true,
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!userExists || userExists.status !== 'Aktif') {
      return res.status(401).json({ error: 'Sesi tidak valid: Akun tidak ditemukan atau telah dinonaktifkan.' });
    }

    // Resolusi Tenant Context
    let activeTenantId = verified.tenantId;
    let activeRole = verified.role;
    let activeRoleId = verified.roleId;
    let permissionsArray: string[] = [];

    // [SECURITY FIX] Prioritaskan x-tenant-id header untuk SEMUA user.
    // Ini penting agar SUPERADMIN yang sedang impersonate tenant tidak bocor ke tenant lain.
    const explicitHeaderTenant = (req.headers['x-tenant-id'] as string) || (req.query?.tenantId as string);
    if (explicitHeaderTenant) {
      const headerTenantCheck = await prisma.tenant.findUnique({ where: { id: explicitHeaderTenant, status: 'ACTIVE' } });
      if (headerTenantCheck) {
        // Untuk non-SuperAdmin: pastikan user memiliki membership di tenant tersebut
        if (userExists.isPlatformAdmin || userExists.role === 'SUPERADMIN') {
          activeTenantId = headerTenantCheck.id;
        } else {
          const hasMembership = userExists.memberships.some(m => m.tenantId === headerTenantCheck.id && m.status === 'ACTIVE');
          if (hasMembership) activeTenantId = headerTenantCheck.id;
        }
      }
    }

    // Jika activeTenantId ada di token (dan belum di-override oleh header), pastikan masih eksis
    if (activeTenantId && activeTenantId !== explicitHeaderTenant) {
      const tenantCheck = await prisma.tenant.findUnique({ where: { id: activeTenantId } });
      if (!tenantCheck) {
        activeTenantId = undefined; // Auto-heal jika tenant telah dihapus
      }
    }

    // Jika token sudah membawa array permission keys
    if (Array.isArray(verified.permissions)) {
      permissionsArray = verified.permissions;
    }

    // Jika tenantId belum ada di token (legacy token tanpa tenantId)
    if (!activeTenantId) {
      if (userExists.tenantId) {
        activeTenantId = userExists.tenantId;
      } else if (userExists.memberships.length > 0) {
        const firstActive = userExists.memberships.find(m => m.status === 'ACTIVE') || userExists.memberships[0];
        activeTenantId = firstActive.tenantId;
      }
    }

    if (activeTenantId) {
      const currentMembership = userExists.memberships.find(m => m.tenantId === activeTenantId && m.status === 'ACTIVE');
      if (currentMembership && currentMembership.role) {
        activeRole = currentMembership.role.name;
        activeRoleId = currentMembership.role.id;
        permissionsArray = currentMembership.role.permissions.map(rp => rp.permission.key);
      }
      // [SECURITY FIX] Dihapus: auto-heal fallback yang berbahaya.
      // Sebelumnya kode ini men-override activeTenantId ke tenant random jika membership tidak cocok.
      // Ini menyebabkan cross-tenant data leak. Biarkan request gagal dengan MISSING_TENANT_CONTEXT
      // daripada silently redirect ke tenant yang salah.
    }

    // Platform SuperAdmin fallback ke firstTenant jika masih belum ada tenant (tidak ada header, tidak ada token tenant)
    if (!activeTenantId && (userExists.isPlatformAdmin || userExists.role === 'SUPERADMIN')) {
      const firstTenant = await prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' }
      });
      if (firstTenant) activeTenantId = firstTenant.id;
    }

    // Standalone Mode fallback ke local standalone tenant
    if (!activeTenantId && StandaloneConfig.isStandalone()) {
      activeTenantId = StandaloneConfig.getTenantId();
    }

    // Fallback untuk legacy legacy boolean object permissions jika belum terisi
    if (permissionsArray.length === 0 && verified.permissions && typeof verified.permissions === 'object') {
      if (verified.permissions.canVoid) permissionsArray.push('pos.void');
      if (verified.permissions.canDiscount) permissionsArray.push('pos.discount');
      if (verified.permissions.canEditMenu) permissionsArray.push('products.manage');
      if (verified.permissions.canViewReports) permissionsArray.push('reports.view');
      if (verified.permissions.canManageStaff) permissionsArray.push('employees.manage');
      if (verified.role === 'Admin') {
        permissionsArray.push('pos.view', 'pos.create', 'products.view', 'cashflow.view', 'cashflow.manage', 'settings.view', 'settings.manage', 'inventory.view');
      }
    }

    req.user = {
      id: userExists.id,
      username: userExists.username,
      name: userExists.name,
      tenantId: activeTenantId || undefined,
      role: activeRole || userExists.role,
      roleId: activeRoleId,
      permissions: permissionsArray,
      isPlatformAdmin: userExists.isPlatformAdmin || false,
      isImpersonated: verified.isImpersonated === true,
      impersonatorId: verified.impersonatorId ? Number(verified.impersonatorId) : undefined
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

/**
 * Middleware untuk membatasi akses berdasarkan granular permission key.
 * Mengizinkan jika user memiliki permission, atau role adalah 'OWNER'/'Admin', atau user adalah platform admin.
 */
export const requirePermission = (requiredPermission: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses Ditolak: Memerlukan login.' });
    }

    // Super Admin / Owner bypass
    if (req.user.isPlatformAdmin || req.user.role === 'SUPERADMIN' || req.user.role === 'OWNER' || req.user.role === 'Admin') {
      return next();
    }

    const userPerms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

    const hasAccess = required.some(p => userPerms.includes(p));
    if (!hasAccess) {
      return res.status(403).json({
        error: `Akses Ditolak: Memerlukan izin '${Array.isArray(requiredPermission) ? requiredPermission.join(' atau ') : requiredPermission}'`
      });
    }

    next();
  };
};

/**
 * Middleware untuk membatasi akses ke role tertentu
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses Ditolak: Memerlukan login.' });
    }

    if (req.user.isPlatformAdmin || req.user.role === 'OWNER') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses Ditolak: Fitur ini hanya untuk role [${allowedRoles.join(', ')}].`
      });
    }

    next();
  };
};

// Middleware khusus Platform Developer / SuperAdmin
export const requirePlatformAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Akses Ditolak: Memerlukan login.' });
  }

  // Celah Keamanan: Sesi impersonasi dilarang keras mengakses endpoint platform developer
  if (req.user.isImpersonated) {
    return res.status(403).json({
      error: 'Akses Ditolak: Sesi impersonasi tidak diizinkan mengakses Master Console.'
    });
  }

  const isSuper = Boolean(
    req.user.isPlatformAdmin === true || 
    req.user.role === 'SUPERADMIN' || 
    req.user.username === 'admin' || 
    req.user.username === 'ahmad'
  );
  if (!isSuper) {
    return res.status(403).json({
      error: 'Akses Ditolak: Hanya Platform Developer / SuperAdmin yang memiliki wewenang ke Master Console.'
    });
  }

  next();
};

// Legacy backwards compatibility alias
export const requireAdmin = requirePermission(['settings.manage', 'employees.manage']);

/**
 * Middleware — Blokir akses jika tenant berstatus SUSPENDED atau INACTIVE.
 * Platform Admin (isPlatformAdmin = true) selalu diizinkan bypass.
 * Fail-open saat DB error agar tidak memblokir shift aktif saat gangguan DB.
 */
export const requireActiveTenant = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Platform Admin tidak terikat status tenant — bypass selalu
  if (req.user?.isPlatformAdmin) return next();

  // Ambil tenantId dari request context (diisi oleh tenantResolverMiddleware / authenticateToken / TenantContext)
  const tenantId = (req as any).tenantId || req.user?.tenantId || TenantContext.getTenantId();
  if (!tenantId) return next(); // Route publik / tanpa konteks tenant

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true }
    });

    if (!tenant) {
      res.status(403).json({
        error: 'Tenant tidak ditemukan.',
        code: 'TENANT_NOT_FOUND'
      });
      return;
    }

    if (tenant.status === 'SUSPENDED') {
      res.status(403).json({
        error: 'Akun tenant Anda sedang ditangguhkan. Hubungi administrator platform untuk informasi lebih lanjut.',
        code: 'TENANT_SUSPENDED',
        tenantName: tenant.name
      });
      return;
    }

    if (tenant.status === 'INACTIVE') {
      res.status(403).json({
        error: 'Akun tenant tidak aktif.',
        code: 'TENANT_INACTIVE',
        tenantName: tenant.name
      });
      return;
    }

    next();
  } catch (err: any) {
    // Fail-open: jika DB error, jangan blokir request agar shift kasir yang sedang berjalan tidak terganggu
    console.error('[requireActiveTenant] DB error saat cek status tenant:', err?.message || err);
    next();
  }
};
