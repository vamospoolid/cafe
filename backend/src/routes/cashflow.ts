import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { getCustomDateRange } from '../utils/dateHelper';
import { emitToTenant } from '../index';
import prisma from '../db';

const router = Router();

// Helper untuk mengekstrak porsi pembayaran tunai dari Order
const getOrderCashPortion = (paymentMethod: string | null, total: number): number => {
  if (!paymentMethod) return 0;
  const pm = paymentMethod.trim().toLowerCase();
  if (pm === 'cash' || pm === 'tunai') return total;
  if (pm.startsWith('split')) {
    const match = paymentMethod.match(/Tunai\s+(?:Rp)+\s*([\d\.]+)/i);
    if (match && match[1]) return Number(match[1].replace(/\./g, '')) || 0;
  }
  return 0;
};

// GET /api/cashflow/summary - Agregasi Metrik Kas Operasional, Laci Kasir, Approval, dan Burn Rate
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId && !(req as any).user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const baseWhere: any = {};
    if (tenantId) baseWhere.tenantId = tenantId;

    // 1. Kas Operasional (Petty Cash Toko) - Approved
    const opInAgg = await prisma.cashFlow.aggregate({
      where: { ...baseWhere, cashPocket: 'KAS_OPERASIONAL', type: 'Pemasukan', status: 'APPROVED' },
      _sum: { amount: true }
    });
    const opOutAgg = await prisma.cashFlow.aggregate({
      where: { ...baseWhere, cashPocket: 'KAS_OPERASIONAL', type: 'Pengeluaran', status: 'APPROVED' },
      _sum: { amount: true }
    });
    const operationalIn = opInAgg._sum.amount || 0;
    const operationalOut = opOutAgg._sum.amount || 0;
    const operationalBalance = operationalIn - operationalOut;

    // 2. Laci Kasir (Sales Drawer) - Menghitung Modal Awal + Omset Tunai POS + Manual In/Out Laci
    let drawerBalance = 0;
    const shiftWhere: any = { status: 'Open' };
    if (tenantId) shiftWhere.tenantId = tenantId;
    const activeShift = await prisma.shift.findFirst({
      where: shiftWhere
    });

    if (activeShift) {
      // Hitung order berstatus Paid sejak shift dibuka (dengan fallback createdAt jika paidAt null)
      const orderWhere: any = {
        status: 'Paid',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { paidAt: null, createdAt: { gte: activeShift.waktuBuka } }
        ]
      };
      if (tenantId) orderWhere.tenantId = tenantId;
      const activeOrders = await prisma.order.findMany({
        where: orderWhere,
        select: { paymentMethod: true, total: true }
      });

      const cashSalesIncome = activeOrders.reduce((sum, o) => sum + getOrderCashPortion(o.paymentMethod, o.total), 0);

      // Pelunasan piutang tunai selama shift aktif
      const debtWhere: any = { createdAt: { gte: activeShift.waktuBuka } };
      if (tenantId) debtWhere.tenantId = tenantId;
      const debtPayments = await prisma.debtPayment.findMany({
        where: debtWhere
      });
      const cashDebtIncome = debtPayments
        .filter(dp => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
        .reduce((sum, dp) => sum + dp.amountPaid, 0);

      // Mutasi kas laci kasir manual
      const drInAgg = await prisma.cashFlow.aggregate({
        where: { 
          ...baseWhere, 
          cashPocket: 'LACI_KASIR', 
          type: 'Pemasukan', 
          status: 'APPROVED', 
          date: { gte: activeShift.waktuBuka } 
        },
        _sum: { amount: true }
      });
      const drOutAgg = await prisma.cashFlow.aggregate({
        where: { 
          ...baseWhere, 
          cashPocket: 'LACI_KASIR', 
          type: 'Pengeluaran', 
          status: 'APPROVED', 
          date: { gte: activeShift.waktuBuka } 
        },
        _sum: { amount: true }
      });

      const drawerIn = drInAgg._sum.amount || 0;
      const drawerOut = drOutAgg._sum.amount || 0;
      drawerBalance = (activeShift.saldoAwal || 0) + cashSalesIncome + cashDebtIncome + drawerIn - drawerOut;
    } else {
      // Jika shift sedang tutup, ambil saldo laci dari shift terakhir
      const lastShiftWhere: any = {};
      if (tenantId) lastShiftWhere.tenantId = tenantId;
      const lastShift = await prisma.shift.findFirst({
        where: lastShiftWhere,
        orderBy: { id: 'desc' }
      });
      drawerBalance = lastShift ? (lastShift.saldoFisikLaci ?? lastShift.saldoSistem ?? 0) : 0;
    }

    // 3. Antrean Approval Owner (Pending)
    const pendingAgg = await prisma.cashFlow.aggregate({
      where: { ...baseWhere, status: 'PENDING' },
      _sum: { amount: true },
      _count: { id: true }
    });
    const pendingAmount = pendingAgg._sum.amount || 0;
    const pendingCount = pendingAgg._count.id || 0;

    // 4. Daily Burn Rate (Rata-rata belanja kas operasional dalam 30 hari terakhir)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const burnRateAgg = await prisma.cashFlow.aggregate({
      where: {
        ...baseWhere,
        cashPocket: 'KAS_OPERASIONAL',
        type: 'Pengeluaran',
        status: 'APPROVED',
        date: { gte: thirtyDaysAgo }
      },
      _sum: { amount: true }
    });
    const total30DaysExpense = burnRateAgg._sum.amount || 0;
    const dailyBurnRate = Math.round(total30DaysExpense / 30);

    res.json({
      operationalBalance,
      operationalIn,
      operationalOut,
      drawerBalance,
      pendingCount,
      pendingAmount,
      dailyBurnRate
    });
  } catch (error) {
    console.error('Error in cashflow summary:', error);
    res.status(500).json({ error: 'Gagal memuat ringkasan arus kas' });
  }
});

// GET /api/cashflow - List arus kas dengan filter lengkap
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, pocket, status, search, startDate, endDate, tzOffset } = req.query;
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId && !(req as any).user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    const whereClause: any = tenantId ? { tenantId } : {};

    if (type && type !== 'ALL') whereClause.type = type;
    if (pocket && pocket !== 'ALL') {
      const pStr = String(pocket).toUpperCase();
      whereClause.cashPocket = (pStr === 'DRAWER' || pStr === 'LACI_KASIR') ? 'LACI_KASIR' : 'KAS_OPERASIONAL';
    }
    if (status && status !== 'ALL') whereClause.status = status;
    
    if (startDate && endDate) {
      const { startUtc, endUtc } = getCustomDateRange(startDate as string, endDate as string, tzOffset as string || -420);
      whereClause.date = { gte: startUtc, lte: endUtc };
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      whereClause.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const cashflows = await prisma.cashFlow.findMany({
      where: whereClause,
      include: { 
        user: { select: { id: true, name: true, role: true } }
      },
      orderBy: { date: 'desc' }
    });

    // Enrich with approver details and linked ingredient details in batch
    const approverIds = Array.from(new Set(cashflows.map(c => c.approvedBy).filter((id): id is number => typeof id === 'number' && id > 0)));
    const ingredientIds = Array.from(new Set(cashflows.map(c => c.linkedIngredientId).filter((id): id is number => typeof id === 'number' && id > 0)));

    const [approvers, ingredients] = await Promise.all([
      approverIds.length > 0
        ? prisma.user.findMany({
            where: {
              id: { in: approverIds },
              // Anti-cross-tenant: hanya approver yang terdaftar sebagai member aktif tenant ini
              memberships: { some: { tenantId, status: 'ACTIVE' } }
            },
            select: { id: true, name: true, role: true }
          })
        : [],
      ingredientIds.length > 0
        ? prisma.ingredient.findMany({
            where: {
              id: { in: ingredientIds },
              tenantId  // Anti-cross-tenant: hanya ingredient milik tenant ini
            },
            select: { id: true, name: true, unit: true, stock: true }
          })
        : []
    ]);

    const approverMap = new Map(approvers.map(a => [a.id, a]));
    const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

    const enrichedCashflows = cashflows.map(cf => ({
      ...cf,
      approver: cf.approvedBy ? approverMap.get(cf.approvedBy) || null : null,
      linkedIngredient: cf.linkedIngredientId ? ingredientMap.get(cf.linkedIngredientId) || null : null
    }));

    res.json(enrichedCashflows);
  } catch (error) {
    console.error('Error fetching cashflow:', error);
    res.status(500).json({ error: 'Gagal mengambil arus kas' });
  }
});

// POST /api/cashflow - Catat pengajuan atau transaksi kas
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { 
      type, 
      category, 
      subCategory, 
      amount, 
      description, 
      pocket = 'OPERATIONAL', 
      receiptUrl, 
      autoStock = false, 
      ingredientId,
      ingredientQty = 1,
      status: requestedStatus
    } = req.body;

    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenantId;

    if (!tenantId && !user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!type || !category || !amount || !description) {
      return res.status(400).json({ error: 'Tipe, kategori, nominal, dan keterangan wajib diisi' });
    }

    // Role-based status determination
    const isAdminOrOwner = user.role === 'Admin' || user.role === 'Owner' || user.isPlatformAdmin;
    let finalStatus = 'APPROVED';

    if (!isAdminOrOwner && type === 'Pengeluaran') {
      // Kasir selalu mengajukan pengeluaran sebagai PENDING approval
      finalStatus = 'PENDING';
    } else if (isAdminOrOwner && requestedStatus) {
      finalStatus = requestedStatus;
    } else if (type === 'Pemasukan') {
      // Pemasukan kas selalu langsung APPROVED
      finalStatus = 'APPROVED';
    }

    const pocketUpper = String(pocket || 'OPERATIONAL').toUpperCase();
    const mappedCashPocket = (pocketUpper === 'DRAWER' || pocketUpper === 'LACI_KASIR') ? 'LACI_KASIR' : 'KAS_OPERASIONAL';

    const cashflow = await prisma.cashFlow.create({
      data: {
        tenantId,
        cashPocket: mappedCashPocket,
        type,
        category,
        amount: Number(amount),
        description,
        receiptImage: receiptUrl || null,
        status: finalStatus,
        userId: user.id,
        approvedBy: finalStatus === 'APPROVED' ? user.id : null,
        approvedAt: finalStatus === 'APPROVED' ? new Date() : null,
        linkedIngredientId: ingredientId ? Number(ingredientId) : null,
        restockQty: ingredientId ? (Number(ingredientQty) || 1) : null
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    // Jika langsung approved dan autoStock aktif
    if (finalStatus === 'APPROVED' && autoStock && ingredientId) {
      try {
        const qtyNum = Number(ingredientQty) || 1;
        await prisma.ingredient.update({
          where: { id: Number(ingredientId) },
          data: { stock: { increment: qtyNum } }
        });
        await prisma.ingredientLog.create({
          data: {
            tenantId,
            ingredientId: Number(ingredientId),
            change: qtyNum,
            cost: Number(amount),
            type: 'Restock',
            reason: `Petty Cash Restock: ${description}`,
            userId: user.id
          }
        });
      } catch (stkErr) {
        console.warn('[CashFlow] Failed to auto-increment stock:', stkErr);
      }
    }

    // Socket Notification — hanya ke tenant terkait
    const cashflowTenantId = (req as any).user?.tenantId;
    if (cashflowTenantId) {
      if (finalStatus === 'PENDING') {
        emitToTenant(cashflowTenantId, 'cashflow:pending', cashflow);
        emitToTenant(cashflowTenantId, 'notification:new', {
          title: 'Pengajuan Kasir Baru',
          message: `${user.name} mengajukan ${cashflow.category}: Rp ${cashflow.amount.toLocaleString('id-ID')}`,
          type: 'CASHFLOW_PENDING',
          cashflowId: cashflow.id
        });
      } else {
        emitToTenant(cashflowTenantId, 'cashflow:updated', cashflow);
      }
    }

    res.status(201).json(cashflow);
  } catch (error) {
    console.error('Error saving cashflow:', error);
    res.status(500).json({ error: 'Gagal menyimpan transaksi kas' });
  }
});

// PATCH /api/cashflow/:id/approve - Persetujuan oleh Owner / Admin
router.patch('/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdminOrOwner = user.role === 'Admin' || user.role === 'Owner' || user.isPlatformAdmin;

    if (!isAdminOrOwner) {
      return res.status(403).json({ error: 'Hanya Owner atau Admin yang dapat menyetujui pengeluaran' });
    }

    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId && !(req as any).user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    // IDOR Guard: verifikasi kepemilikan tenant sebelum approve
    const existingWhere: any = { id: Number(id) };
    if (tenantId) existingWhere.tenantId = tenantId;
    const existing = await prisma.cashFlow.findFirst({
      where: existingWhere
    });
    if (!existing) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    // Idempotent protection: jika sudah disetujui, return langsung
    if (existing.status === 'APPROVED') {
      return res.json(existing);
    }

    const updated = await prisma.cashFlow.update({
      where: { id: Number(id) },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectionReason: null
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    if (tenantId) {
      emitToTenant(tenantId, 'cashflow:approved', updated);
      emitToTenant(tenantId, 'notification:new', {
        title: 'Pengeluaran Disetujui',
        message: `Pengeluaran ${updated.description} (Rp ${updated.amount.toLocaleString('id-ID')}) telah disetujui`,
        type: 'CASHFLOW_APPROVED'
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error approving cashflow:', error);
    res.status(500).json({ error: 'Gagal menyetujui pengeluaran' });
  }
});

// PATCH /api/cashflow/:id/reject - Penolakan oleh Owner / Admin
router.patch('/:id/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdminOrOwner = user.role === 'Admin' || user.role === 'Owner' || user.isPlatformAdmin;

    if (!isAdminOrOwner) {
      return res.status(403).json({ error: 'Hanya Owner atau Admin yang dapat menolak pengeluaran' });
    }

    const { id } = req.params;
    const { reason } = req.body;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId && !(req as any).user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    // IDOR Guard: verifikasi kepemilikan tenant
    const existingWhere: any = { id: Number(id) };
    if (tenantId) existingWhere.tenantId = tenantId;
    const existing = await prisma.cashFlow.findFirst({
      where: existingWhere
    });
    if (!existing) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const updated = await prisma.cashFlow.update({
      where: { id: Number(id) },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Ditolak oleh Owner',
        approvedBy: user.id,
        approvedAt: new Date()
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    if (tenantId) {
      emitToTenant(tenantId, 'cashflow:rejected', updated);
      emitToTenant(tenantId, 'notification:new', {
        title: 'Pengeluaran Ditolak',
        message: `Pengajuan ${updated.description} ditolak: ${reason || 'Tidak disetujui'}`,
        type: 'CASHFLOW_REJECTED'
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting cashflow:', error);
    res.status(500).json({ error: 'Gagal menolak pengeluaran' });
  }
});

// DELETE /api/cashflow/:id - Hapus transaksi
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const tenantId = user?.tenantId;

    if (!tenantId && !user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    // IDOR Guard: verifikasi kepemilikan tenant
    const existingWhere: any = { id: Number(id) };
    if (tenantId) existingWhere.tenantId = tenantId;
    const existing = await prisma.cashFlow.findFirst({
      where: existingWhere
    });
    if (!existing) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const isAdminOrOwner = user.role === 'Admin' || user.role === 'Owner' || user.isPlatformAdmin;
    const isOwnerOfRecord = existing.userId === user.id && existing.status === 'PENDING';

    if (!isAdminOrOwner && !isOwnerOfRecord) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus transaksi ini' });
    }

    await prisma.cashFlow.delete({ where: { id: Number(id) } });

    if (tenantId) {
      emitToTenant(tenantId, 'cashflow:deleted', { id: Number(id) });
    }

    res.json({ message: 'Transaksi arus kas berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting cashflow:', error);
    res.status(500).json({ error: 'Gagal menghapus arus kas' });
  }
});

export default router;
