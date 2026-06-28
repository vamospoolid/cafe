import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Get active shift for logged in user (or any active open shift)
router.get('/current', authenticateToken, async (req: Request, res: Response) => {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' },
      include: { user: { select: { name: true, username: true } } }
    });
    res.json(activeShift);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengecek shift aktif' });
  }
});

// Get all shifts (for admin / supervisor history)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shifts = await prisma.shift.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { id: 'desc' }
    });
    res.json(shifts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data shift' });
  }
});

// Open a new shift
router.post('/open', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { saldoAwal } = req.body;

    const existingActive = await prisma.shift.findFirst({
      where: { status: 'Open' }
    });

    if (existingActive) {
      return res.status(400).json({ error: 'Masih ada shift yang aktif. Harap tutup shift sebelumnya.' });
    }

    const shift = await prisma.shift.create({
      data: {
        userId,
        saldoAwal: Number(saldoAwal) || 0,
        status: 'Open'
      }
    });

    res.status(201).json(shift);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuka shift' });
  }
});

// GET current shift summary (pre-reconciliation)
router.get('/current-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' },
      include: { user: { select: { name: true, username: true } } }
    });

    if (!activeShift) {
      return res.status(404).json({ error: 'Tidak ada shift aktif' });
    }

    // Fix #1 (backward-compatible): Gunakan paidAt jika tersedia, fallback ke createdAt untuk order lama
    // Ini memastikan order lama (paidAt=null) tetap terhitung, dan order baru diatribusikan ke shift yang benar
    const activeOrders = await prisma.order.findMany({
      where: {
        status: 'Paid',
        OR: [
          // Order baru: paidAt tersedia dan dalam rentang shift
          { paidAt: { gte: activeShift.waktuBuka } },
          // Order lama (legacy): paidAt belum diisi, fallback ke createdAt
          { paidAt: null, createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });

    const getCashPortion = (paymentMethod: string | null, total: number) => {
      if (!paymentMethod) return 0;
      const pm = paymentMethod.trim();
      if (pm.toLowerCase() === 'cash' || pm.toLowerCase() === 'tunai') return total;
      if (pm.startsWith('Split')) {
        const match = pm.match(/Tunai Rp([\d\.]+)/);
        if (match && match[1]) {
          return Number(match[1].replace(/\./g, '')) || 0;
        }
      }
      return 0;
    };

    const getNonCashPortion = (paymentMethod: string | null, total: number) => {
      if (!paymentMethod) return 0;
      const pm = paymentMethod.trim();
      const lowerPm = pm.toLowerCase();
      if (lowerPm === 'cash' || lowerPm === 'tunai') return 0;
      if (lowerPm === 'qris' || lowerPm === 'debit' || lowerPm === 'transfer' || lowerPm === 'credit' || lowerPm === 'non-tunai') return total;
      if (pm.startsWith('Split')) {
        const cashMatch = pm.match(/Tunai Rp([\d\.]+)/);
        const cashAmt = cashMatch ? Number(cashMatch[1].replace(/\./g, '')) || 0 : 0;
        return Math.max(0, total - cashAmt);
      }
      return total;
    };

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    const cashFlows = await prisma.cashFlow.findMany({
      where: { date: { gte: activeShift.waktuBuka } }
    });

    const manualCashIn = cashFlows.filter(cf => cf.type === 'Pemasukan').reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);

    const expectedCash = activeShift.saldoAwal + cashSalesIncome + manualCashIn - manualCashOut;

    res.json({
      activeShift,
      expectedCash,
      expectedNonCash: nonCashSalesIncome,
      cashSales: cashSalesIncome,
      nonCashSales: nonCashSalesIncome,
      manualCashIn,
      manualCashOut
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat ringkasan shift' });
  }
});

// Close active shift
router.post('/close', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { saldoFisikLaci } = req.body;

    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' }
    });

    if (!activeShift) {
      return res.status(400).json({ error: 'Tidak ada shift yang aktif untuk ditutup.' });
    }

    // Fix #1 (backward-compatible): Gunakan paidAt jika tersedia, fallback ke createdAt untuk order lama
    const activeOrders = await prisma.order.findMany({
      where: {
        status: 'Paid',
        OR: [
          // Order baru: paidAt tersedia dan dalam rentang shift
          { paidAt: { gte: activeShift.waktuBuka } },
          // Order lama (legacy): paidAt belum diisi, fallback ke createdAt
          { paidAt: null, createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });

    const getCashPortion = (paymentMethod: string | null, total: number) => {
      if (!paymentMethod) return 0;
      const pm = paymentMethod.trim();
      if (pm.toLowerCase() === 'cash' || pm.toLowerCase() === 'tunai') {
        return total;
      }
      if (pm.startsWith('Split')) {
        const match = pm.match(/Tunai Rp([\d\.]+)/);
        if (match && match[1]) {
          const cleanNum = match[1].replace(/\./g, '');
          return Number(cleanNum) || 0;
        }
      }
      return 0;
    };

    const getNonCashPortion = (paymentMethod: string | null, total: number) => {
      if (!paymentMethod) return 0;
      const pm = paymentMethod.trim();
      const lowerPm = pm.toLowerCase();
      if (lowerPm === 'cash' || lowerPm === 'tunai') return 0;
      if (lowerPm === 'qris' || lowerPm === 'debit' || lowerPm === 'transfer' || lowerPm === 'credit' || lowerPm === 'non-tunai') return total;
      if (pm.startsWith('Split')) {
        const cashMatch = pm.match(/Tunai Rp([\d\.]+)/);
        const cashAmt = cashMatch ? Number(cashMatch[1].replace(/\./g, '')) || 0 : 0;
        return Math.max(0, total - cashAmt);
      }
      return total;
    };

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung pengeluaran/pemasukan manual kas (CashFlow)
    const cashFlows = await prisma.cashFlow.findMany({
      where: {
        date: { gte: activeShift.waktuBuka }
      }
    });

    const manualCashIn = cashFlows.filter(cf => cf.type === 'Pemasukan').reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);

    const saldoSistem = activeShift.saldoAwal + cashSalesIncome + manualCashIn - manualCashOut;
    const fisikLaci = Number(saldoFisikLaci) || 0;
    const selisih = fisikLaci - saldoSistem;

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        waktuTutup: new Date(),
        saldoSistem,
        saldoElektronik: nonCashSalesIncome,
        saldoFisikLaci: fisikLaci,
        selisih,
        status: 'Closed'
      }
    });

    res.json(closedShift);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menutup shift' });
  }
});

export default router;
