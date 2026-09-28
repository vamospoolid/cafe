import { Router } from 'express';
import { authenticateToken } from '../../middlewares/authMiddleware';
import { tenantResolverMiddleware } from '../../middlewares/tenantResolver';
import { requireBusinessType } from '../../middlewares/requireBusinessType';

import serviceTypesRouter from './serviceTypes';
import vehiclesRouter from './vehicles';
import workOrdersRouter from './workOrders';
import mechanicsRouter from './mechanics';
import invoicesRouter from './invoices';
import reportsRouter from './reports';
import partRequestsRouter from './partRequests';
import supplierInvoicesRouter from './supplierInvoices';
import prisma from '../../db';

const router = Router();

// ─── TRIPLE GUARD: Authentication + Tenant Context + Bengkel Vertical Guard ──
router.use(authenticateToken);
router.use(tenantResolverMiddleware);
router.use(requireBusinessType('BENGKEL'));

// Status / Health check for Bengkel Vertical
router.get('/status', async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const [pendingSpk, activeSpk, totalMechanics] = await Promise.all([
      prisma.workOrder.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.workOrder.count({ where: { tenantId, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'] } } }),
      prisma.mechanicProfile.count({ where: { tenantId } })
    ]);

    res.json({
      vertical: 'BENGKEL',
      tenantId,
      status: 'OPERATIONAL',
      activeSPK: activeSpk,
      pendingSPK: pendingSpk,
      totalMechanics
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat status bengkel' });
  }
});

// ─── Mount Bengkel Modules ──────────────────────────────────────────────────
router.use('/service-types', serviceTypesRouter);
router.use('/vehicles', vehiclesRouter);
router.use('/work-orders', workOrdersRouter);
router.use('/mechanics', mechanicsRouter);
router.use('/invoices', invoicesRouter);
router.use('/reports', reportsRouter);
router.use('/part-requests', partRequestsRouter);
router.use('/supplier-invoices', supplierInvoicesRouter);

export default router;

