import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';
import { emitToTenant } from '../index';

const router = Router();

function getTenantId(req: Request): string | undefined {
  const user = (req as AuthRequest).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
}

function tenantWhere(tenantId: string | undefined): { tenantId: string } {
  if (!tenantId) throw new Error('MISSING_TENANT_ID: Debt query requires tenant context');
  return { tenantId };
}

// Router-level fail-closed guard: all debt operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context tidak tersedia. Silakan login ulang.', 
      code: 'MISSING_TENANT_CONTEXT' 
    });
  }
  next();
});

// GET all debts with optional filters (status, customerId) - Scoped to tenant
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { status, customerId } = req.query;
    const whereClause: any = {
      ...tenantWhere(tenantId)
    };

    if (status) {
      whereClause.status = String(status);
    }
    if (customerId) {
      whereClause.customerId = Number(customerId);
    }

    const debts = await prisma.debt.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            tier: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            createdAt: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(debts);
  } catch (error) {
    console.error('Fetch Debts Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data piutang' });
  }
});

// GET debts for a specific customer - Scoped to tenant
router.get('/customer/:customerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { customerId } = req.params;

    const debts = await prisma.debt.findMany({
      where: { 
        customerId: Number(customerId),
        ...tenantWhere(tenantId)
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            createdAt: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(debts);
  } catch (error) {
    console.error('Fetch Customer Debts Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data piutang pelanggan' });
  }
});

// POST payment for a debt (partial/full payment) - Scoped to tenant
router.post('/:id/payments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
    const outletId = user?.outletId;
    const { id } = req.params;
    const { amountPaid, paymentMethod } = req.body;
    const userId = user?.id || 1;

    if (!amountPaid || Number(amountPaid) <= 0) {
      return res.status(400).json({ error: 'Jumlah pembayaran harus lebih besar dari 0' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Metode pembayaran wajib diisi' });
    }

    const debtId = Number(id);
    const payAmt = Number(amountPaid);

    // Run within transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current debt scoped to tenant
      const debt = await tx.debt.findFirst({
        where: { 
          id: debtId,
          ...tenantWhere(tenantId)
        },
        include: { 
          customer: true,
          order: true
        }
      });

      if (!debt) {
        throw new Error('Data piutang tidak ditemukan');
      }

      if (debt.status === 'Lunas' || debt.remaining <= 0) {
        throw new Error('Piutang ini sudah lunas');
      }

      if (payAmt > debt.remaining) {
        throw new Error(`Jumlah pembayaran melebihi sisa piutang (Sisa: Rp ${debt.remaining.toLocaleString('id-ID')})`);
      }

      const newRemaining = Math.max(0, debt.remaining - payAmt);
      const newStatus = newRemaining === 0 ? 'Lunas' : 'Belum Lunas';

      // 2. Create Debt Payment record
      await tx.debtPayment.create({
        data: {
          tenantId,
          debtId,
          amountPaid: payAmt,
          paymentMethod,
          userId
        }
      });

      // 3. Update Debt remaining and status
      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          remaining: newRemaining,
          status: newStatus
        },
        include: {
          customer: true,
          order: true,
          payments: true
        }
      });

      // 4. Create Cash Flow record for both cash and electronic debt payments
      const isCash = paymentMethod.toLowerCase() === 'tunai' || paymentMethod.toLowerCase() === 'cash';
      const orderInfo = debt.order ? ` untuk Order ${debt.order.orderNumber}` : '';
      await tx.cashFlow.create({
        data: {
          tenantId,
          outletId,
          type: 'Pemasukan',
          category: isCash ? 'Pembayaran Piutang - Tunai' : 'Pembayaran Piutang - Non-Tunai',
          cashPocket: isCash ? 'LACI_KASIR' : 'KAS_OPERASIONAL',
          status: 'APPROVED',
          amount: payAmt,
          description: `Pelunasan piutang via ${paymentMethod} dari member ${debt.customer.name}${orderInfo}`,
          userId
        }
      });

      return updatedDebt;
    });

    if (tenantId) {
      emitToTenant(tenantId, 'debt:updated', result);
      emitToTenant(tenantId, 'cashflow:created', { type: 'Pemasukan', amount: payAmt });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Process Debt Payment Error:', error);
    res.status(400).json({ error: error.message || 'Gagal memproses pembayaran piutang' });
  }
});

export default router;
