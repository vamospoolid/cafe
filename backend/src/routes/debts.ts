import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET all debts with optional filters (status, customerId)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, customerId } = req.query;
    const whereClause: any = {};

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

// GET debts for a specific customer
router.get('/customer/:customerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const debts = await prisma.debt.findMany({
      where: { customerId: Number(customerId) },
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

// POST payment for a debt (partial/full payment)
router.post('/:id/payments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amountPaid, paymentMethod } = req.body;
    const userId = (req as any).user.id;

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
      // 1. Fetch current debt
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
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
      const payment = await tx.debtPayment.create({
        data: {
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

      // 4. Create Cash Flow record if payment method is cash ("Tunai" or "Cash")
      const isCash = paymentMethod.toLowerCase() === 'tunai' || paymentMethod.toLowerCase() === 'cash';
      if (isCash) {
        const orderInfo = debt.order ? ` untuk Order ${debt.order.orderNumber}` : '';
        await tx.cashFlow.create({
          data: {
            type: 'Pemasukan',
            category: 'Pembayaran Piutang',
            amount: payAmt,
            description: `Pelunasan piutang dari member ${debt.customer.name}${orderInfo}`,
            userId
          }
        });
      }

      return updatedDebt;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Process Debt Payment Error:', error);
    res.status(400).json({ error: error.message || 'Gagal memproses pembayaran piutang' });
  }
});

export default router;
