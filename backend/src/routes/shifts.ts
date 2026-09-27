import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { io, emitToTenant } from '../index';
import { TenantContext } from '../utils/tenantContext';
import { evaluateOperatingStatus } from '../utils/operatingHoursHelper';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();

// Kategori CashFlow yang dihasilkan sistem secara otomatis dan TIDAK BOLEH dihitung ulang sebagai kas manual kasir
export const EXCLUDED_SHIFT_CASH_CATEGORIES = [
  'Pembayaran Piutang',
  'Pembayaran Piutang - Tunai',
  'Pembayaran Piutang - Non-Tunai',
  'Pengembalian Kasbon - Non-Tunai',
  'Uang Muka Reservasi - Non-Tunai',
  'Uang Muka Reservasi',
  'Saldo Awal Shift',
  'Omset POS - Tunai',
  'Omset POS - Non-Tunai',
  'PENJUALAN_SPK - Non-Tunai'
];

// Kategori Pengeluaran Non-Tunai (Transfer Bank Kantor / Tempo) yang TIDAK BOLEH memotong uang fisik kasir shift
export const NON_CASH_EXPENSE_CATEGORIES = [
  'Pembelian Stok - Bank',
  'Pembelian Stok - Tempo'
];

// Shared helpers untuk menghitung porsi kas per metode pembayaran
export const getCashPortion = (paymentMethod: string | null, total: number): number => {
  if (!paymentMethod) return 0;
  const pm = paymentMethod.trim();
  if (pm.toLowerCase() === 'cash' || pm.toLowerCase() === 'tunai') return total;
  if (pm.startsWith('Split')) {
    const match = pm.match(/(?:Tunai|Cash)\s*(?:Rp)?\s*([\d\.]+)/i);
    if (match && match[1]) return Number(match[1].replace(/\./g, '')) || 0;
  }
  return 0;
};

export const getNonCashPortion = (paymentMethod: string | null, total: number): number => {
  if (!paymentMethod) return 0;
  const pm = paymentMethod.trim();
  const lp = pm.toLowerCase();
  if (lp === 'cash' || lp === 'tunai') return 0;
  if (lp === 'piutang') return 0;
  if (lp === 'qris' || lp === 'debit' || lp === 'transfer' || lp === 'credit' || lp === 'non-tunai') return total;
  if (pm.startsWith('Split')) {
    const cashMatch = pm.match(/(?:Tunai|Cash)\s*(?:Rp)?\s*([\d\.]+)/i);
    const cashAmt = cashMatch ? Number(cashMatch[1].replace(/\./g, '')) || 0 : 0;
    return Math.max(0, total - cashAmt);
  }
  return total;
};

// Get active shift for logged in user (terisolasi per kasir & tenant)
const handleGetActiveShift = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const outletId = (req.query.outletId as string) || user?.outletId || TenantContext.getOutletId();

    // 1. Utamakan shift aktif milik kasir yang sedang login
    let activeShift = null;
    if (user?.id) {
      activeShift = await prisma.shift.findFirst({
        where: { 
          status: 'Open',
          userId: user.id,
          tenantId,
          ...(outletId ? { outletId } : {})
        },
        include: { user: { select: { name: true, username: true } } }
      });
    }

    // 2. Fallback jika user adalah supervisor/owner yang ingin melihat shift buka di toko
    if (!activeShift) {
      activeShift = await prisma.shift.findFirst({
        where: { 
          status: 'Open',
          tenantId,
          ...(outletId ? { outletId } : {})
        },
        include: { user: { select: { name: true, username: true } } }
      });
    }

    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const operatingStatus = evaluateOperatingStatus(settings);

    if (!activeShift) {
      return res.json(null);
    }

    res.json({
      ...activeShift,
      operatingStatus
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengecek shift aktif' });
  }
};

router.get('/current', authenticateToken, handleGetActiveShift);
router.get('/active', authenticateToken, handleGetActiveShift);


// Get all shifts (for admin / supervisor history) — dengan rekap finansial lengkap terisolasi per Tenant
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const shifts = await prisma.shift.findMany({
      where: { tenantId },
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

    // Fetch semua order, cashflow, debtpayment dalam rentang global milik tenant ini sekaligus
    const [allOrders, allCashFlows, allDebtPayments] = await Promise.all([
      prisma.order.findMany({
        where: {
          tenantId,
          OR: [
            { paidAt: { gte: earliestOpen, lte: latestClose } },
            { paidAt: null, createdAt: { gte: earliestOpen, lte: latestClose } }
          ]
        },
        select: { status: true, paymentMethod: true, total: true, paidAt: true, createdAt: true }
      }),
      prisma.cashFlow.findMany({
        where: { 
          tenantId,
          date: { gte: earliestOpen, lte: latestClose } 
        },
        select: { type: true, amount: true, category: true, date: true, cashPocket: true }
      }),
      prisma.debtPayment.findMany({
        where: { 
          tenantId,
          createdAt: { gte: earliestOpen, lte: latestClose } 
        },
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

      // CashFlow dalam shift ini (hanya yang masuk laci kasir)
      const shiftCashFlows = allCashFlows.filter(cf => inRange(cf.date));
      const manualCashIn = shiftCashFlows
        .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
        .reduce((s, cf) => s + cf.amount, 0);
      const manualCashOut = shiftCashFlows
        .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
        .reduce((s, cf) => s + cf.amount, 0);

      // Pelunasan Piutang dalam shift ini
      const shiftDebtPayments = allDebtPayments.filter(dp => inRange(dp.createdAt));
      const cashDebtIncome = shiftDebtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
        .reduce((s, dp) => s + dp.amountPaid, 0);
      const nonCashDebtIncome = shiftDebtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
        .reduce((s, dp) => s + dp.amountPaid, 0);

      const calculatedSaldoSistem = shift.saldoAwal + cashSales + cashDebtIncome + manualCashIn - manualCashOut;
      const calculatedSaldoElektronik = nonCashSales + nonCashDebtIncome;
      const finalSaldoSistem = shift.saldoSistem ?? calculatedSaldoSistem;
      const finalSaldoElektronik = shift.saldoElektronik ?? calculatedSaldoElektronik;
      const variance = shift.selisih ?? ((shift.saldoFisikLaci || 0) - finalSaldoSistem);
      const varianceStatus = variance === 0 ? 'MATCHED' : variance < 0 ? 'SHORT' : 'OVER';

      return {
        ...shift,
        orderCount: paidOrders.length,
        cashSales,
        nonCashSales,
        voidCount,
        voidCashTotal,
        voidNonCashTotal,
        manualCashIn,
        manualCashOut,
        cashDebtIncome,
        nonCashDebtIncome,
        saldoSistem: finalSaldoSistem,
        saldoElektronik: finalSaldoElektronik,
        variance,
        varianceStatus
      };
    });

    res.json(enrichedShifts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data shift' });
  }
});

// Open a new shift - Terisolasi per Tenant
router.post('/open', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = req.body.outletId || user?.outletId || TenantContext.getOutletId();
    if (!outletId) {
      return res.status(400).json({ error: 'Outlet ID wajib ditentukan untuk membuka shift kasir.' });
    }
    const userId = user?.id || 1;
    const { saldoAwal } = req.body;

    const existingActive = await prisma.shift.findFirst({
      where: { 
        status: 'Open',
        tenantId,
        outletId
      }
    });

    if (existingActive) {
      return res.status(400).json({ error: 'Masih ada shift yang aktif di outlet ini. Harap tutup shift sebelumnya.' });
    }

    // Evaluasi Jam Operasional Toko
    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const evalResult = evaluateOperatingStatus(settings, new Date());
    let openingPunctuality = 'ON_TIME';
    let lateOpenMinutes = 0;
    let supervisorOverride: string | null = null;

    if (settings?.enforceOperatingHours && !evalResult.canOpenShiftNormal) {
      const supervisorPin = req.body.supervisorPin ? String(req.body.supervisorPin).trim() : null;
      if (!supervisorPin) {
        return res.status(400).json({
          error: evalResult.message,
          code: 'OUTSIDE_OPERATING_HOURS',
          requiresSupervisorPin: true,
          operatingStatus: evalResult
        });
      }

      // Verifikasi Supervisor PIN
      const supervisor = await prisma.user.findFirst({
        where: {
          status: 'Aktif',
          role: { in: ['OWNER', 'Owner', 'ADMIN', 'Admin', 'MANAGER', 'Manager', 'SUPERVISOR', 'Supervisor'] },
          OR: [
            { pin: supervisorPin },
            { memberships: { some: { tenantId, pin: supervisorPin, status: 'ACTIVE' } } }
          ],
          memberships: { some: { tenantId, status: 'ACTIVE' } }
        },
        select: { id: true, name: true, username: true, role: true }
      });

      if (!supervisor) {
        return res.status(401).json({
          error: 'PIN Supervisor tidak valid atau pengguna tidak berwenang meng-override jadwal.',
          code: 'INVALID_SUPERVISOR_PIN',
          requiresSupervisorPin: true
        });
      }

      openingPunctuality = 'OVERRIDE';
      supervisorOverride = `${supervisor.name || supervisor.username} (${supervisor.role})`;

      await AuditLogger.log({
        tenantId,
        outletId,
        userId: supervisor.id,
        userName: supervisor.name || supervisor.username,
        userRole: supervisor.role,
        action: 'SHIFT_OVERRIDE_OUTSIDE_HOURS',
        resource: 'SHIFT',
        severity: 'WARNING',
        description: `Otorisasi buka shift kasir di luar jam operasional oleh ${supervisor.name || supervisor.username}: ${evalResult.message}`
      });
    } else {
      if (evalResult.isLateOpening) {
        openingPunctuality = 'LATE';
        lateOpenMinutes = evalResult.lateOpenMinutes;
      } else if (evalResult.status === 'PREPARATION_WINDOW') {
        openingPunctuality = 'EARLY';
      }
    }

    const shift = await prisma.shift.create({
      data: {
        tenantId,
        outletId,
        userId,
        saldoAwal: Number(saldoAwal) || 0,
        status: 'Open',
        openingPunctuality,
        lateOpenMinutes,
        supervisorOverride
      } as any,
      include: {
        user: { select: { name: true, username: true } }
      }
    });

    // Broadcast ke client di room tenant ini saja
    emitToTenant(tenantId, 'shift:status_change', { status: 'Open', shift });

    res.status(201).json(shift);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuka shift' });
  }
});

// GET current shift summary (pre-reconciliation & blind closing support) - Terisolasi per Tenant
router.get('/current-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const isBlind = req.query.blind === 'true';
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const outletId = (req.query.outletId as string) || user?.outletId || TenantContext.getOutletId();

    const activeShift = await prisma.shift.findFirst({
      where: { 
        status: 'Open',
        tenantId,
        ...(outletId ? { outletId } : {})
      },
      include: { user: { select: { id: true, name: true, username: true, role: true } } }
    });

    if (!activeShift) {
      return res.status(404).json({ error: 'Tidak ada shift aktif' });
    }

    // Jika mode Blind Closing, jangan bocorkan nominal uang & omset ke kasir sebelum menghitung fisik
    if (isBlind) {
      return res.json({
        isBlind: true,
        activeShift: {
          id: activeShift.id,
          waktuBuka: activeShift.waktuBuka,
          userId: activeShift.userId,
          user: activeShift.user
        }
      });
    }

    // Gunakan paidAt jika tersedia, fallback ke createdAt untuk order lama milik tenant ini
    const activeOrders = await prisma.order.findMany({
      where: {
        tenantId,
        status: 'Paid',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { paidAt: null, createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung transaksi Void selama shift milik tenant ini
    const voidOrders = await prisma.order.findMany({
      where: {
        tenantId,
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
      where: { 
        tenantId,
        date: { gte: activeShift.waktuBuka } 
      }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { 
        tenantId,
        createdAt: { gte: activeShift.waktuBuka } 
      }
    });

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const nonCashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows
      .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const spkNonCashIncome = cashFlows
      .filter(cf => cf.category === 'PENJUALAN_SPK - Non-Tunai')
      .reduce((sum, cf) => sum + cf.amount, 0);

    // Catatan: cashSalesIncome hanya menghitung pesanan berstatus 'Paid'.
    const expectedCash = activeShift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
    const expectedNonCash = nonCashSalesIncome + nonCashDebtIncome + spkNonCashIncome;

    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const operatingStatus = evaluateOperatingStatus(settings);

    res.json({
      activeShift,
      operatingStatus,
      isBlind: false,
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

// Close active shift (Blind closing with denominations & cash variance reconciliation) - Terisolasi per Tenant
router.post('/close', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { saldoFisikLaci, denominations, varianceReason, forceClose } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = req.body.outletId || (req.query.outletId as string) || user?.outletId || TenantContext.getOutletId();

    const activeShift = await prisma.shift.findFirst({
      where: { 
        status: 'Open',
        tenantId,
        ...(outletId ? { outletId } : {})
      },
      include: { user: { select: { id: true, name: true, username: true, role: true } } }
    });

    if (!activeShift) {
      return res.status(400).json({ error: 'Tidak ada shift yang aktif untuk ditutup.' });
    }

    // 1. Proteksi Pesanan Belum Lunas (Unpaid / Pending Dine-In Orders milik tenant ini)
    const pendingOrders = await prisma.order.findMany({
      where: {
        tenantId,
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

    // Gunakan paidAt jika tersedia, fallback ke createdAt untuk order lama milik tenant ini
    const activeOrders = await prisma.order.findMany({
      where: {
        tenantId,
        status: 'Paid',
        OR: [
          { paidAt: { gte: effectiveStart, lte: effectiveEnd } },
          { paidAt: null, createdAt: { gte: effectiveStart, lte: effectiveEnd } }
        ]
      }
    });

    const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSalesIncome = activeOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung transaksi Void selama shift milik tenant ini
    const voidOrders = await prisma.order.findMany({
      where: {
        tenantId,
        status: 'Void',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });
    const voidCashTotal = voidOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const voidNonCashTotal = voidOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // Hitung pengeluaran/pemasukan manual kas (CashFlow milik tenant)
    const cashFlows = await prisma.cashFlow.findMany({
      where: { 
        tenantId,
        date: { gte: activeShift.waktuBuka } 
      }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { 
        tenantId,
        createdAt: { gte: activeShift.waktuBuka } 
      }
    });

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const nonCashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows
      .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const spkNonCashIncome = cashFlows
      .filter(cf => cf.category === 'PENJUALAN_SPK - Non-Tunai')
      .reduce((sum, cf) => sum + cf.amount, 0);

    // Saldo sistem kas dihitung dari kas masuk bersih yang sah
    const saldoSistem = activeShift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
    const saldoElektronik = nonCashSalesIncome + nonCashDebtIncome + spkNonCashIncome;
    const fisikLaci = Number(saldoFisikLaci) || 0;
    const selisih = Math.round((fisikLaci - saldoSistem) * 100) / 100;
    const varianceStatus = selisih === 0 ? 'MATCHED' : selisih < 0 ? 'SHORT' : 'OVER';

    const denominationsStr = denominations ? (typeof denominations === 'object' ? JSON.stringify(denominations) : String(denominations)) : null;
    const cleanVarianceReason = varianceReason ? String(varianceReason).trim() : null;

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        waktuTutup: new Date(),
        saldoSistem,
        saldoElektronik,
        saldoFisikLaci: fisikLaci,
        selisih,
        denominations: denominationsStr,
        varianceReason: cleanVarianceReason,
        status: 'Closed'
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    // ── Catat ke Audit Log Sistem ──────────────────────────────────────
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          outletId,
          userId: user?.id || activeShift.userId,
          userName: user?.name || user?.username || activeShift.user?.name || 'Kasir',
          userRole: user?.role || 'cashier',
          action: 'SHIFT_CLOSE',
          resource: 'FINANCE',
          resourceId: `shift_${closedShift.id}`,
          severity: selisih < 0 ? 'WARNING' : 'INFO',
          description: `Tutup Shift #${closedShift.id} oleh ${user?.name || user?.username || 'Kasir'}. Fisik: Rp ${fisikLaci.toLocaleString('id-ID')}, Sistem: Rp ${saldoSistem.toLocaleString('id-ID')}, Selisih: Rp ${selisih.toLocaleString('id-ID')} (${varianceStatus})${cleanVarianceReason ? ` | Alasan: ${cleanVarianceReason}` : ''}`,
          oldValue: JSON.stringify({ status: 'Open', saldoAwal: activeShift.saldoAwal }),
          newValue: JSON.stringify({
            saldoSistem,
            saldoFisikLaci: fisikLaci,
            selisih,
            varianceStatus,
            varianceReason: cleanVarianceReason,
            denominations: denominationsStr
          })
        }
      });
    } catch (auditErr) {
      console.error('Gagal mencatat audit log shift close:', auditErr);
    }

    // ── AUTO-CATAT ke Arus Kas / Petty Cash Milik Tenant ────────────────
    const userId = user?.id || 1;
    const cashFlowEntries: any[] = [];

    // 1. Saldo awal shift (modal kasir buka)
    if (activeShift.saldoAwal > 0) {
      cashFlowEntries.push({
        tenantId,
        outletId,
        type: 'Pemasukan',
        category: 'Saldo Awal Shift',
        amount: activeShift.saldoAwal,
        description: `Modal awal kasir saat buka shift — tutup shift #${closedShift.id}`,
        userId,
        date: activeShift.waktuBuka,
        cashPocket: 'LACI_KASIR',
        status: 'APPROVED'
      });
    }

    // 2. Omset tunai dari POS
    if (cashSalesIncome > 0) {
      cashFlowEntries.push({
        tenantId,
        outletId,
        type: 'Pemasukan',
        category: 'Omset POS - Tunai',
        amount: cashSalesIncome,
        description: `Omset penjualan tunai (${activeOrders.filter(o => getCashPortion(o.paymentMethod, o.total) > 0).length} transaksi) — shift #${closedShift.id}`,
        userId,
        date: closedShift.waktuTutup || new Date(),
        cashPocket: 'LACI_KASIR',
        status: 'APPROVED'
      });
    }

    // 3. Omset non-tunai (QRIS / Transfer / Debit) — dicatat informatif
    if (nonCashSalesIncome > 0) {
      cashFlowEntries.push({
        tenantId,
        outletId,
        type: 'Pemasukan',
        category: 'Omset POS - Non Tunai (QRIS/Transfer)',
        amount: nonCashSalesIncome,
        description: `Omset penjualan non-tunai/QRIS/transfer — shift #${closedShift.id} (tidak mempengaruhi kas laci)`,
        userId,
        date: closedShift.waktuTutup || new Date(),
        cashPocket: 'LACI_KASIR',
        status: 'APPROVED'
      });
    }

    // 4. Pelunasan piutang tunai (jika ada)
    if (cashDebtIncome > 0) {
      cashFlowEntries.push({
        tenantId,
        outletId,
        type: 'Pemasukan',
        category: 'Pelunasan Piutang - Tunai',
        amount: cashDebtIncome,
        description: `Pembayaran piutang tunai yang diterima — shift #${closedShift.id}`,
        userId,
        date: closedShift.waktuTutup || new Date(),
        cashPocket: 'LACI_KASIR',
        status: 'APPROVED'
      });
    }

    // Bulk create semua entri CashFlow sekaligus
    if (cashFlowEntries.length > 0) {
      await prisma.cashFlow.createMany({ data: cashFlowEntries });
    }
    // ── END AUTO-CATAT ───────────────────────────────────────────────────

    // Broadcast ke room tenant terkait bahwa shift telah ditutup
    emitToTenant(tenantId, 'shift:status_change', { status: 'Closed', shift: closedShift });

    res.json({
      ...closedShift,
      expectedCash: saldoSistem,
      expectedNonCash: saldoElektronik,
      variance: selisih,
      varianceStatus,
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

// GET Z-Report Data for a Shift (Detailed breakdown for 58/80mm thermal print & audit view) - Terisolasi per Tenant
router.get('/:id/z-report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shiftId = Number(req.params.id);
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const shift = await prisma.shift.findFirst({
      where: { 
        id: shiftId,
        tenantId
      },
      include: { user: { select: { id: true, name: true, username: true, role: true } } }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift tidak ditemukan' });
    }

    const shiftStart = new Date(shift.waktuBuka);
    const shiftEnd = new Date(shift.waktuTutup || Date.now());
    const effectiveTenantId = shift.tenantId || tenantId;

    // Fetch orders in shift range belonging to this tenant
    const orders = await prisma.order.findMany({
      where: {
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
        OR: [
          { paidAt: { gte: shiftStart, lte: shiftEnd } },
          { paidAt: null, createdAt: { gte: shiftStart, lte: shiftEnd } }
        ]
      },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    const paidOrders = orders.filter(o => o.status === 'Paid');
    const voidOrders = orders.filter(o => o.status === 'Void');

    // Sales by Category
    const categoryBreakdown: { [categoryName: string]: { qty: number; total: number } } = {};
    for (const order of paidOrders) {
      for (const item of order.items) {
        const catName = item.product?.category?.name || 'Lain-lain';
        if (!categoryBreakdown[catName]) {
          categoryBreakdown[catName] = { qty: 0, total: 0 };
        }
        categoryBreakdown[catName].qty += item.qty;
        categoryBreakdown[catName].total += item.subtotal;
      }
    }

    // Payment Methods Breakdown
    const paymentMethodsBreakdown: { [method: string]: { count: number; total: number } } = {};
    for (const order of paidOrders) {
      const pm = (order.paymentMethod || 'Tunai').trim();
      if (!paymentMethodsBreakdown[pm]) {
        paymentMethodsBreakdown[pm] = { count: 0, total: 0 };
      }
      paymentMethodsBreakdown[pm].count += 1;
      paymentMethodsBreakdown[pm].total += order.total;
    }

    // Financial Totals
    const grossSales = paidOrders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalDiscount = paidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const totalTax = paidOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const totalServiceCharge = paidOrders.reduce((sum, o) => sum + (o.serviceCharge || 0), 0);
    const netSales = paidOrders.reduce((sum, o) => sum + o.total, 0);

    const cashSales = paidOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const nonCashSales = paidOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    // CashFlows & Debt Payments milik tenant
    const cashFlows = await prisma.cashFlow.findMany({
      where: { 
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
        date: { gte: shiftStart, lte: shiftEnd } 
      }
    });
    const debtPayments = await prisma.debtPayment.findMany({
      where: { 
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
        createdAt: { gte: shiftStart, lte: shiftEnd } 
      }
    });

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows
      .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const voidCashTotal = voidOrders.reduce((sum, o) => sum + getCashPortion(o.paymentMethod, o.total), 0);
    const voidNonCashTotal = voidOrders.reduce((sum, o) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

    let parsedDenominations: any = null;
    if (shift.denominations) {
      try {
        parsedDenominations = JSON.parse(shift.denominations);
      } catch (e) {
        parsedDenominations = shift.denominations;
      }
    }

    const variance = shift.selisih ?? ((shift.saldoFisikLaci || 0) - (shift.saldoSistem || 0));
    const varianceStatus = variance === 0 ? 'MATCHED' : variance < 0 ? 'SHORT' : 'OVER';

    res.json({
      shift: {
        id: shift.id,
        waktuBuka: shift.waktuBuka,
        waktuTutup: shift.waktuTutup,
        status: shift.status,
        saldoAwal: shift.saldoAwal,
        saldoSistem: shift.saldoSistem,
        saldoElektronik: shift.saldoElektronik,
        saldoFisikLaci: shift.saldoFisikLaci,
        selisih: shift.selisih,
        varianceReason: shift.varianceReason,
        denominations: parsedDenominations,
        user: shift.user
      },
      summary: {
        totalOrders: paidOrders.length,
        grossSales,
        totalDiscount,
        totalTax,
        totalServiceCharge,
        netSales,
        cashSales,
        nonCashSales,
        manualCashIn,
        manualCashOut,
        cashDebtIncome,
        voidCount: voidOrders.length,
        voidCashTotal,
        voidNonCashTotal,
        variance,
        varianceStatus
      },
      categoryBreakdown,
      paymentMethodsBreakdown,
      voidOrders: voidOrders.map(v => ({
        id: v.id,
        orderNumber: v.orderNumber,
        total: v.total,
        paymentMethod: v.paymentMethod,
        createdAt: v.createdAt
      }))
    });
  } catch (error) {
    console.error('Gagal memuat Z-Report shift:', error);
    res.status(500).json({ error: 'Gagal memuat data Z-Report shift' });
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
      if (!shift.tenantId) continue;
      const now = new Date();
      const activeOrders = await prisma.order.findMany({
        where: {
          tenantId: shift.tenantId,
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
        where: { 
          tenantId: shift.tenantId,
          date: { gte: shift.waktuBuka, lte: now } 
        }
      });
      const manualCashIn = cashFlows
        .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
        .reduce((sum, cf) => sum + cf.amount, 0);
      const manualCashOut = cashFlows
        .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
        .reduce((sum, cf) => sum + cf.amount, 0);

      const debtPayments = await prisma.debtPayment.findMany({
        where: { 
          tenantId: shift.tenantId,
          createdAt: { gte: shift.waktuBuka, lte: now } 
        }
      });
      const cashDebtIncome = debtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
        .reduce((sum, dp) => sum + dp.amountPaid, 0);

      const spkNonCash = cashFlows
        .filter(cf => cf.category === 'PENJUALAN_SPK - Non-Tunai')
        .reduce((sum, cf) => sum + cf.amount, 0);

      const expectedCash = shift.saldoAwal + cashSales + cashDebtIncome + manualCashIn - manualCashOut;
      const expectedNonCash = nonCashSales + spkNonCash;

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

      if (shift.tenantId) {
        emitToTenant(shift.tenantId, 'shift:status_change', { status: 'Closed', shift: closed });
      }
    }

    console.log(`[Auto-EOD Cutoff] Berhasil menutup ${openShifts.length} shift kasir gantung secara otomatis.`);
    return { count: openShifts.length };
  } catch (error) {
    console.error('Error running shift auto cutoff:', error);
    return { count: 0 };
  }
}

// POST Force Close Shift by Admin / Supervisor - Terisolasi per Tenant
router.post('/:id/force-close', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shiftId = Number(req.params.id);
    const { saldoFisikLaci = 0, catatan = '' } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const userRole = (user?.role || '').toLowerCase();

    if (!['admin', 'owner', 'superadmin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ error: 'Hanya Admin/Owner yang berwenang melakukan Force Close Shift.' });
    }

    const shift = await prisma.shift.findFirst({
      where: { 
        id: shiftId,
        tenantId
      },
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
        tenantId,
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
      where: { 
        tenantId,
        date: { gte: effectiveStart, lte: effectiveEnd } 
      }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { 
        tenantId,
        createdAt: { gte: effectiveStart, lte: effectiveEnd } 
      }
    });

    const cashDebtIncome = debtPayments
      .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, dp) => sum + dp.amountPaid, 0);

    const manualCashIn = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const manualCashOut = cashFlows
      .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category) && cf.cashPocket === 'LACI_KASIR')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const spkNonCashIncome = cashFlows
      .filter(cf => cf.category === 'PENJUALAN_SPK - Non-Tunai')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const expectedCash = shift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
    const expectedNonCash = nonCashSalesIncome + spkNonCashIncome;

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

    emitToTenant(shift.tenantId || tenantId, 'shift:status_change', { status: 'Closed', shift: closedShift });

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

