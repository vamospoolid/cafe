import { Router, Response } from 'express';
import { authenticateToken, requirePermission } from '../middlewares/authMiddleware';
import { AuditLogger, AuditLogFilter } from '../services/AuditLogger';

const router = Router();

// Protect all audit log routes with authentication
router.use(authenticateToken);

/**
 * GET /api/audit-logs/summary
 * Summary statistics for the Audit Trail view
 */
router.get('/summary', requirePermission('audit.view'), async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const summary = await AuditLogger.getSummary(tenantId);
    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching audit log summary:', error);
    res.status(500).json({ error: 'Failed to retrieve audit log summary' });
  }
});

/**
 * GET /api/audit-logs
 * Paginated and filtered audit trail logs
 */
router.get('/', requirePermission('audit.view'), async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const filter: AuditLogFilter = {
      outletId: req.query.outletId as string,
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      action: req.query.action as string,
      resource: req.query.resource as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20
    };

    const result = await AuditLogger.getLogs(tenantId, filter);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

/**
 * GET /api/audit-logs/export
 * Export audit logs (JSON or CSV)
 */
router.get('/export', requirePermission('audit.view'), async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const format = (req.query.format as string || 'json').toLowerCase();
    const filter: AuditLogFilter = {
      outletId: req.query.outletId as string,
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      action: req.query.action as string,
      resource: req.query.resource as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const logs = await AuditLogger.exportLogs(tenantId, filter);

    if (format === 'csv') {
      const headers = ['ID', 'Timestamp', 'User', 'Role', 'Outlet', 'Action', 'Resource', 'ResourceID', 'Severity', 'Description', 'IP Address'];
      const rows = logs.map(l => [
        `"${l.id}"`,
        `"${l.createdAt.toISOString()}"`,
        `"${l.userName || l.user?.name || '-'}"`,
        `"${l.userRole || '-'}"`,
        `"${l.outlet?.name || '-'}"`,
        `"${l.action}"`,
        `"${l.resource}"`,
        `"${l.resourceId || '-'}"`,
        `"${l.severity}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${l.ipAddress || '-'}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    res.json(logs);
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;
