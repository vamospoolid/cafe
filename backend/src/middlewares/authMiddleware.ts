import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';
const prisma = new PrismaClient();

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

    // Jika token sudah membawa array permission keys
    if (Array.isArray(verified.permissions)) {
      permissionsArray = verified.permissions;
    }

    // Jika tenantId belum ada di token (legacy) atau ingin me-refresh dari membership
    if (!activeTenantId && userExists.memberships.length > 0) {
      const firstActive = userExists.memberships.find(m => m.status === 'ACTIVE') || userExists.memberships[0];
      activeTenantId = firstActive.tenantId;
      if (firstActive.role) {
        activeRole = firstActive.role.name;
        activeRoleId = firstActive.role.id;
        permissionsArray = firstActive.role.permissions.map(rp => rp.permission.key);
      }
    } else if (activeTenantId) {
      const currentMembership = userExists.memberships.find(m => m.tenantId === activeTenantId && m.status === 'ACTIVE');
      if (currentMembership && currentMembership.role) {
        activeRole = currentMembership.role.name;
        activeRoleId = currentMembership.role.id;
        permissionsArray = currentMembership.role.permissions.map(rp => rp.permission.key);
      }
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
      tenantId: activeTenantId || 'tenant-default-muki',
      role: activeRole || userExists.role,
      roleId: activeRoleId,
      permissions: permissionsArray,
      isPlatformAdmin: userExists.isPlatformAdmin || false
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
    if (req.user.isPlatformAdmin || req.user.role === 'OWNER' || req.user.role === 'Admin') {
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

  const isSuper = req.user.isPlatformAdmin === true || req.user.role === 'SUPERADMIN' || req.user.role === 'OWNER';
  if (!isSuper) {
    return res.status(403).json({
      error: 'Akses Ditolak: Hanya Platform Developer / SuperAdmin yang memiliki wewenang ke Master Console.'
    });
  }

  next();
};

// Legacy backwards compatibility alias
export const requireAdmin = requirePermission(['settings.manage', 'employees.manage']);
