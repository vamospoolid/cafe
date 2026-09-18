import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { TenantContext } from '../utils/tenantContext';

const prisma = new PrismaClient();

export interface AuditLogInput {
  tenantId?: string | null;
  outletId?: string | null;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;      // e.g. 'LOGIN', 'LOGOUT', 'ORDER_VOID', 'ORDER_REFUND', 'PRICE_CHANGE', 'STOCK_ADJUST', 'USER_CREATE', 'SETTINGS_UPDATE'
  resource: string;    // e.g. 'AUTH', 'ORDER', 'PRODUCT', 'INVENTORY', 'USER', 'SETTINGS', 'BILLING', 'FINANCE'
  resourceId?: string | number | null;
  description?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AuditLogFilter {
  outletId?: string;
  userId?: number;
  action?: string;
  resource?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class AuditLogger {
  /**
   * Log an immutable audit event to database.
   * Resilient: Errors during logging are caught and will not disrupt the parent transaction/request.
   */
  static async log(input: AuditLogInput, req?: Request): Promise<void> {
    try {
      const tenantId = input.tenantId ?? 
        (req as any)?.tenantId ?? 
        (req as any)?.user?.tenantId ?? 
        TenantContext.getTenantId() ?? 
        null;

      const outletId = input.outletId ?? 
        (req as any)?.outletId ?? 
        (req as any)?.user?.outletId ?? 
        TenantContext.getOutletId() ?? 
        null;

      const userId = input.userId ?? 
        (req as any)?.user?.id ?? 
        (req as any)?.user?.userId ?? 
        null;

      const userName = input.userName ?? 
        (req as any)?.user?.name ?? 
        (req as any)?.user?.username ?? 
        null;

      const userRole = input.userRole ?? 
        (req as any)?.user?.role ?? 
        (req as any)?.user?.activeRole ?? 
        null;

      let ipAddress = input.ipAddress;
      if (!ipAddress && req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
          ipAddress = forwarded.split(',')[0].trim();
        } else if (Array.isArray(forwarded)) {
          ipAddress = forwarded[0];
        } else {
          ipAddress = req.ip || req.socket?.remoteAddress || null;
        }
      }

      const userAgent = input.userAgent ?? (req?.headers['user-agent'] ? String(req.headers['user-agent']).substring(0, 500) : null);

      const stringifyVal = (val: any): string | null => {
        if (val === undefined || val === null) return null;
        if (typeof val === 'string') return val;
        try {
          return JSON.stringify(val);
        } catch {
          return String(val);
        }
      };

      await prisma.auditLog.create({
        data: {
          tenantId,
          outletId,
          userId: userId ? Number(userId) : null,
          userName: userName ? String(userName) : null,
          userRole: userRole ? String(userRole) : null,
          action: input.action.toUpperCase(),
          resource: input.resource.toUpperCase(),
          resourceId: input.resourceId !== undefined && input.resourceId !== null ? String(input.resourceId) : null,
          description: input.description || null,
          oldValue: stringifyVal(input.oldValue),
          newValue: stringifyVal(input.newValue),
          ipAddress: ipAddress ? String(ipAddress) : null,
          userAgent: userAgent ? String(userAgent) : null,
          severity: input.severity || 'INFO'
        }
      });
    } catch (err: any) {
      console.error('[AuditLogger] Failed to write audit log entry:', err?.message || err);
    }
  }

  /**
   * Retrieve paginated and filtered audit logs for a tenant.
   */
  static async getLogs(tenantId: string, filter: AuditLogFilter = {}) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId
    };

    if (filter.outletId) {
      where.outletId = filter.outletId;
    }

    if (filter.userId) {
      where.userId = Number(filter.userId);
    }

    if (filter.action) {
      where.action = filter.action.toUpperCase();
    }

    if (filter.resource) {
      where.resource = filter.resource.toUpperCase();
    }

    if (filter.severity) {
      where.severity = filter.severity.toUpperCase();
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { userName: { contains: q, mode: 'insensitive' } },
        { resourceId: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          outlet: {
            select: { id: true, name: true, code: true }
          },
          user: {
            select: { id: true, name: true, username: true, role: true }
          }
        }
      })
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Export all audit logs matching filter for export (max 1000 items).
   */
  static async exportLogs(tenantId: string, filter: AuditLogFilter = {}) {
    const where: any = { tenantId };

    if (filter.outletId) where.outletId = filter.outletId;
    if (filter.userId) where.userId = Number(filter.userId);
    if (filter.action) where.action = filter.action.toUpperCase();
    if (filter.resource) where.resource = filter.resource.toUpperCase();
    if (filter.severity) where.severity = filter.severity.toUpperCase();

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        outlet: { select: { name: true, code: true } },
        user: { select: { name: true, username: true } }
      }
    });
  }

  /**
   * Get analytical summary for audit trail dashboard.
   */
  static async getSummary(tenantId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalLogs, criticalCount, warningCount, recentLogs, topActions] = await Promise.all([
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, severity: 'CRITICAL' } }),
      prisma.auditLog.count({ where: { tenantId, severity: 'WARNING' } }),
      prisma.auditLog.count({ where: { tenantId, createdAt: { gte: last24h } } }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { tenantId },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 5
      })
    ]);

    return {
      totalLogs,
      criticalCount,
      warningCount,
      activityLast24h: recentLogs,
      topActions: topActions.map(a => ({
        action: a.action,
        count: a._count.action
      }))
    };
  }
}
