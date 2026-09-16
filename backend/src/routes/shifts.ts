import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io } from '../index';

const router = Router();
const prisma = new PrismaClient();

// Shared helpers untuk menghitung porsi kas per metode pembayaran
const getCashPortion = (paymentMethod: string | null, total: number): number => {
  if (!paymentMethod) return 0;
  const pm = paymentMethod.trim();
  if (pm.toLowerCase() === 'cash' || pm.toLowerCase() === 'tunai') return total;
  if (pm.startsWith('Split')) {
    const match = pm.match(/Tunai\s+(?:Rp)+\s*([\d\.]+)/i);
    if (match && match[1]) return Number(match[1].replace(/\./g, '')) || 0;
  }
  return 0;
};

const getNonCashPortion = (paymentMethod: string | null, total: number): number => {
  if (!paymentMethod) return 0;
  const pm = paymentMethod.trim();
  const lp = pm.toLowerCase();
  if (lp === 'cash' || lp === 'tunai') return 0;
  if (lp === 'piutang') return 0;
  if (lp === 'qris' || lp === 'debit' || lp === 'transfer' || lp === 'credit' || lp === 'non-tunai') return total;
  if (pm.startsWith('Split')) {
    const cashMatch = pm.match(/Tunai\s+(?:Rp)+\s*([\d\.]+)/i);
    const cashAmt = cashMatch ? Number(cashMatch[1].replace(/\./g, '')) || 0 : 0;
    return Math.max(0, total - cashAmt);
  }
  return total;
};

// Get active shift for logged in user (or any active open shift)
const handleGetActiveShift = async (req: Request, res: Response) => {
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
};

router.get('/current', authenticateToken, handleGetActiveShift);
router.get('/active', authenticateToken, handleGetActiveShift);


// Get all shifts (for admin / supervisor history) — dengan rekap finansial lengkap
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shifts = await prisma.shift.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { id: 'desc' }
    });

    if (shifts.length === 0) return res.json([]);

    // Tentukan rentang tanggal keseluruhan untuk fetch data sekaligus (efisien / batch)
    const now = new Date();
    const earliestOpen = shifts.reduce((min, s) => s.waktuBuka < min ? s.waktuBuka : min, shifts[0].waktuBuka);
    const latestClose = shifts.reduce((max, s) => {
      const t = s.waktuTutup || now;
      return t > max ? t : max;
    }, shifts[0].waktuTutup || now);

    // Fetch semua order, cashflow, debtpayment dalam rentang global sekaligus
    const [allOrders, allCashFlows, allDebtPayments] = await Promise.all([
      prisma.order.findMany({
        where: {
          OR: [
            { paidAt: { gte: earliestOpen, lte: latestClose } },
            { paidAt: null, createdAt: { gte: earliestOpen, lte: latestClose } }
          ]
        },
        select: { status: true, paymentMethod: true, total: true, paidAt: true, createdAt: true }
      }),
      prisma.cashFlow.findMany({
        where: { date: { gte: earliestOpen, lte: latestClose } },
        select: { type: true, amount: true, category: true, date: true }
      }),
      prisma.debtPayment.findMany({
        where: { createdAt: { gte: earliestOpen, lte: latestClose } },
        select: { paymentMethod: true, amountPaid: true, createdAt: true }
      })
    ]);

    // Hitung data finansial per shift
    const enrichedShifts = shifts.map(shift => {
      // Proteksi jika waktu buka dan tutup terbalik karena timezone/device clock
      const rawStart = new Date(shift.waktuBuka).getTime();
      const rawEnd = new Date(shift.waktuTutup || now).getTime();
      const shiftStart = new Date(Math.min(rawStart, rawEnd));
      const shiftEnd = new Date(Math.max(rawStart, rawEnd));

      const inRange = (ts: Date | null | undefined): boolean => {
        if (!ts) return false;
        const t = new Date(ts).getTime();
        return t >= shiftStart.getTime() && t <= shiftEnd.getTime();
      };

      // Order dalam shift ini
      const shiftOrders = allOrders.filter(o => inRange(o.paidAt ?? o.createdAt));
      const paidOrders = shiftOrders.filter(o => o.status === 'Paid');
      const voidOrders = shiftOrders.filter(o => o.status === 'Void');

      const cashSales = paidOrders.reduce((s, o) => s + getCashPortion(o.paymentMethod, o.total), 0);
      const nonCashSales = paidOrders.reduce((s, o) => s + getNonCashPortion(o.paymentMethod, o.total), 0);
      const voidCount = voidOrders.length;
      const voidCashTotal = voidOrders.reduce((s, o) => s + getCashPortion(o.paymentMethod, o.total), 0);
      const voidNonCashTotal = voidOrders.reduce((s, o) => s + getNonCashPortion(o.paymentMethod, o.total), 0);

      // CashFlow dalam shift ini
      const shiftCashFlows = allCashFlows.filter(cf => inRange(cf.date));
      const manualCashIn = shiftCashFlows
        .filter(cf => cf.type === 'Pemasukan' && cf.category !== 'Pembayaran Piutang')
        .reduce((s, cf) => s + cf.amount, 0);
      const manualCashOut = shiftCashFlows
        .filter(cf => cf.type === 'Pengeluaran')
        .reduce((s, cf) => s + cf.amount, 0);

      // Debt payments dalam shift ini
      const shiftDebtPayments = allDebtPayments.filter(dp => inRange(dp.createdAt));
      const cashDebtIncome = shiftDebtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
        .reduce((s, dp) => s + dp.amountPaid, 0);
      const nonCashDebtIncome = shiftDebtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
        .reduce((s, dp) => s + dp.amountPaid, 0);

      return {
        ...shift,
        cashSales,
        nonCashSales,
        voidCount,
        voidCashTotal,
        voidNonCashTotal,
        manualCashIn,
        manualCashOut,
        cashDebtIncome,
        nonCashDebtIncome
      };
    });

    res.json(enrichedShifts);
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
      },
      include: {
        user: { select: { name: true, username: true } }
      }
    });

    // Broadcast ke seluruh client real-time
    io.emit('shift:status_change', { status: 'Open', shift });

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

    // Gunakan paidAt jika tersedia, fallback ke createdAt untuk order lama
    const activeOrders = await prisma.order.findMany({
      where: {
        status: 'Paid',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { paidAt: null, createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung transaksi Void selama shift
    const voidOrders = await prisma.order.findMany({
      where: {
        status: 'Void',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });
    const voidCashTotal = voidOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const voidNonCashTotal = voidOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    const cashFlows = await prisma.cashFlow.findMany({
      where: { date: { gte: activeShift.waktuBuka } }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { createdAt: { gte: activeShift.waktuBuka } }
    });

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const nonCashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && cf.category !== 'Pembayaran Piutang')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);

    // Catatan: cashSalesIncome hanya menghitung pesanan berstatus 'Paid'.
    // Pesanan 'Void' otomatis sudah tidak masuk ke cashSalesIncome, sehingga tidak dikurangkan ganda.
    const expectedCash = activeShift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
    const expectedNonCash = nonCashSalesIncome + nonCashDebtIncome;

    res.json({
      activeShift,
      expectedCash,
      expectedNonCash,
      cashSales: cashSalesIncome,
      nonCashSales: nonCashSalesIncome,
      voidCount: voidOrders.length,
      voidCashTotal,
      voidNonCashTotal,
      manualCashIn,
      manualCashOut,
      cashDebtIncome,
      nonCashDebtIncome
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat ringkasan shift' });
  }
});

// Close active shift
router.post('/close', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { saldoFisikLaci, forceClose } = req.body;

    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' }
    });

    if (!activeShift) {
      return res.status(400).json({ error: 'Tidak ada shift yang aktif untuk ditutup.' });
    }

    // 1. Proteksi Pesanan Belum Lunas (Unpaid / Pending Dine-In Orders)
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'Pending',
        createdAt: { gte: activeShift.waktuBuka }
      },
      include: { table: true }
    });

    if (pendingOrders.length > 0 && !forceClose) {
      const pendingTableNames = pendingOrders.map(o => o.table?.tableNo ? `Meja ${o.table.tableNo}` : `#${o.orderNumber}`).join(', ');
      return res.status(400).json({
        error: `Masih terdapat ${pendingOrders.length} pesanan aktif belum lunas (${pendingTableNames}). Harap selesaikan pembayaran terlebih dahulu sebelum menutup shift.`,
        hasPendingOrders: true,
        pendingOrdersCount: pendingOrders.length,
        pendingTables: pendingTableNames
      });
    }

    // Proteksi rentang waktu
    const shiftOpenTime = new Date(activeShift.waktuBuka);
    const shiftCloseTime = new Date();
    const effectiveStart = shiftOpenTime < shiftCloseTime ? shiftOpenTime : shiftCloseTime;
    const effectiveEnd = shiftOpenTime < shiftCloseTime ? shiftCloseTime : shiftOpenTime;

    // Gunakan paidAt jika tersedia, fallback ke createdAt untuk order lama
    const activeOrders = await prisma.order.findMany({
      where: {
        status: 'Paid',
        OR: [
          { paidAt: { gte: effectiveStart, lte: effectiveEnd } },
          { paidAt: null, createdAt: { gte: effectiveStart, lte: effectiveEnd } }
        ]
      }
    });

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung transaksi Void selama shift
    const voidOrders = await prisma.order.findMany({
      where: {
        status: 'Void',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });
    const voidCashTotal = voidOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const voidNonCashTotal = voidOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung pengeluaran/pemasukan manual kas (CashFlow)
    const cashFlows = await prisma.cashFlow.findMany({
      where: { date: { gte: activeShift.waktuBuka } }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { createdAt: { gte: activeShift.waktuBuka } }
    });

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const nonCashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && cf.category !== 'Pembayaran Piutang')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);

    // Saldo sistem kas dihitung dari kas masuk bersih yang sah (Void otomatis sudah tidak masuk di cashSalesIncome)
    const saldoSistem = activeShift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
    const saldoElektronik = nonCashSalesIncome + nonCashDebtIncome;
    const fisikLaci = Number(saldoFisikLaci) || 0;
    const selisih = fisikLaci - saldoSistem;

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        waktuTutup: new Date(),
        saldoSistem,
        saldoElektronik,
        saldoFisikLaci: fisikLaci,
        selisih,
        status: 'Closed'
      }
    });

    // ── AUTO-CATAT ke Arus Kas / Petty Cash ─────────────────────────────
    // Agar halaman Arus Kas menampilkan pemasukan lengkap (bukan selalu minus)
    const userId = (req as any).user.id;

    const cashFlowEntries: any[] = [];

    // 1. Saldo awal shift (modal kasir buka)
    if (activeShift.saldoAwal > 0) {
      cashFlowEntries.push({
        type: 'Pemasukan',
        category: 'Saldo Awal Shift',
        amount: activeShift.saldoAwal,
        description: `Modal awal kasir saat buka shift — tutup shift #${closedShift.id}`,
        userId,
        date: activeShift.waktuBuka
      });
    }

    // 2. Omset tunai dari POS
    if (cashSalesIncome > 0) {
      cashFlowEntries.push({
        type: 'Pemasukan',
        category: 'Omset POS - Tunai',
        amount: cashSalesIncome,
        description: `Omset penjualan tunai (${activeOrders.filter(o => getCashPortion(o.paymentMethod, o.total) > 0).length} transaksi) — shift #${closedShift.id}`,
        userId,
        date: closedShift.waktuTutup || new Date()
      });
    }

    // 3. Omset non-tunai (QRIS / Transfer / Debit) — dicatat informatif
    if (nonCashSalesIncome > 0) {
      cashFlowEntries.push({
        type: 'Pemasukan',
        category: 'Omset POS - Non Tunai (QRIS/Transfer)',
        amount: nonCashSalesIncome,
        description: `Omset penjualan non-tunai/QRIS/transfer — shift #${closedShift.id} (tidak mempengaruhi kas laci)`,
        userId,
        date: closedShift.waktuTutup || new Date()
      });
    }

    // 4. Pelunasan piutang tunai (jika ada)
    if (cashDebtIncome > 0) {
      cashFlowEntries.push({
        type: 'Pemasukan',
        category: 'Pelunasan Piutang - Tunai',
        amount: cashDebtIncome,
        description: `Pembayaran piutang tunai yang diterima — shift #${closedShift.id}`,
        userId,
        date: closedShift.waktuTutup || new Date()
      });
    }

    // Bulk create semua entri CashFlow sekaligus
    if (cashFlowEntries.length > 0) {
      await prisma.cashFlow.createMany({ data: cashFlowEntries });
    }
    // ── END AUTO-CATAT ───────────────────────────────────────────────────

    // Broadcast ke seluruh client bahwa shift telah ditutup
    io.emit('shift:status_change', { status: 'Closed', shift: closedShift });

    res.json({
      ...closedShift,
      cashSales: cashSalesIncome,
      nonCashSales: nonCashSalesIncome,
      voidCount: voidOrders.length,
      voidCashTotal,
      voidNonCashTotal,
      manualCashIn,
      manualCashOut,
      cashDebtIncome,
      nonCashDebtIncome
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menutup shift' });
  }
});

// ─── Force Close & Auto-Cutoff EOD Shift ──────────────────────────────

export async function runShiftAutoCutoff(): Promise<{ count: number }> {
  try {
    const sixteenHoursAgo = new Date(Date.now() - (16 * 60 * 60 * 1000));
    const openShifts = await prisma.shift.findMany({
      where: {
        status: 'Open',
        waktuBuka: { lt: sixteenHoursAgo }
      },
      include: { user: true }
    });

    if (openShifts.length === 0) return { count: 0 };

    for (const shift of openShifts) {
      const now = new Date();
      const activeOrders = await prisma.order.findMany({
        where: {
          status: 'Paid',
          OR: [
            { paidAt: { gte: shift.waktuBuka, lte: now } },
            { paidAt: null, createdAt: { gte: shift.waktuBuka, lte: now } }
          ]
        }
      });

      const cashSales = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
      const nonCashSales = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

      const cashFlows = await prisma.cashFlow.findMany({
        where: { date: { gte: shift.waktuBuka, lte: now } }
      });
      const manualCashIn = cashFlows.filter(cf => cf.type === 'Pemasukan' && cf.category !== 'Pembayaran Piutang').reduce((sum, cf) => sum + cf.amount, 0);
      const manualCashOut = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);

      const debtPayments = await prisma.debtPayment.findMany({
        where: { createdAt: { gte: shift.waktuBuka, lte: now } }
      });
      const cashDebtIncome = debtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
        .reduce((sum, dp) => sum + dp.amountPaid, 0);

      const expectedCash = shift.saldoAwal + cashSales + cashDebtIncome + manualCashIn - manualCashOut;
      const expectedNonCash = nonCashSales;

      const closed = await prisma.shift.update({
        where: { id: shift.id },
        data: {
          waktuTutup: now,
          status: 'Closed',
          saldoSistem: expectedCash,
          saldoElektronik: expectedNonCash,
          saldoFisikLaci: expectedCash,
          selisih: 0
        }
      });

      io.emit('shift:status_change', { status: 'Closed', shift: closed });
    }

    console.log(`[Auto-EOD Cutoff] Berhasil menutup ${openShifts.length} shift kasir gantung secara otomatis.`);
    return { count: openShifts.length };
  } catch (error) {
    console.error('Error running shift auto cutoff:', error);
    return { count: 0 };
  }
}

// POST Force Close Shift by Admin / Supervisor
router.post('/:id/force-close', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shiftId = Number(req.params.id);
    const { saldoFisikLaci = 0, catatan = '' } = req.body;
    const userRole = ((req as any).user?.role || '').toLowerCase();

    if (!['admin', 'owner', 'superadmin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ error: 'Hanya Admin/Owner yang berwenang melakukan Force Close Shift.' });
    }

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { user: true }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift tidak ditemukan' });
    }

    if (shift.status === 'Closed') {
      return res.status(400).json({ error: 'Shift ini sudah dalam status tertutup.' });
    }

    const shiftOpenTime = new Date(shift.waktuBuka);
    const shiftCloseTime = new Date();
    const effectiveStart = shiftOpenTime < shiftCloseTime ? shiftOpenTime : shiftCloseTime;
    const effectiveEnd = shiftOpenTime < shiftCloseTime ? shiftCloseTime : shiftOpenTime;

    const activeOrders = await prisma.order.findMany({
      where: {
        status: 'Paid',
        OR: [
          { paidAt: { gte: effectiveStart, lte: effectiveEnd } },
          { paidAt: null, createdAt: { gte: effectiveStart, lte: effectiveEnd } }
        ]
      }
    });

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    const cashFlows = await prisma.cashFlow.findMany({
      where: { date: { gte: effectiveStart, lte: effectiveEnd } }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { createdAt: { gte: effectiveStart, lte: effectiveEnd } }
    });

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && cf.category !== 'Pembayaran Piutang')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);

    const expectedCash = shift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
    const expectedNonCash = nonCashSalesIncome;

    const actualCash = Number(saldoFisikLaci);
    const selisih = actualCash - expectedCash;

    const closedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        waktuTutup: shiftCloseTime,
        status: 'Closed',
        saldoSistem: expectedCash,
        saldoElektronik: expectedNonCash,
        saldoFisikLaci: actualCash,
        selisih
      },
      include: {
        user: { select: { name: true, username: true } }
      }
    });

    io.emit('shift:status_change', { status: 'Closed', shift: closedShift });

    res.json({
      message: `Shift #${shiftId} berhasil ditutup paksa oleh Admin`,
      shift: closedShift,
      expectedCash,
      saldoFisikLaci: actualCash,
      selisih
    });
  } catch (error) {
    console.error('Error force closing shift:', error);
    res.status(500).json({ error: 'Gagal melakukan force close shift' });
  }
});

// POST Manual Trigger Auto Cutoff Shift
router.post('/auto-cutoff', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await runShiftAutoCutoff();
    res.json({ message: `Auto Cut-off selesai. ${result.count} shift gantung tertutup otomatis.`, result });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menjalankan auto-cutoff shift' });
  }
});

export default router;

