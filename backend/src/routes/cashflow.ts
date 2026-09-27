import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { getCustomDateRange } from '../utils/dateHelper';
import { TenantContext } from '../utils/tenantContext';
import { AuditLogger } from '../services/AuditLogger';
import { emitToTenant } from '../index';

const router = Router();

// Helper to determine if user has Owner / Admin / Manager privileges
function isApproverRole(role?: string, isPlatformAdmin?: boolean): boolean {
  if (isPlatformAdmin) return true;
  if (!role) return false;
  const upper = role.toUpperCase();
  return ['OWNER', 'ADMIN', 'SUPERADMIN', 'MANAGER'].includes(upper);
}

// ─── 1. GET ALL CASH FLOWS (Filtered & Enriched) ──────────────────────────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, tzOffset, cashPocket, status, resolutionAction, category } = req.query;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    const whereClause: any = { tenantId };
    
    if (type) {
      whereClause.type = type;
    }
    if (cashPocket) {
      whereClause.cashPocket = cashPocket;
    }
    if (status) {
      whereClause.status = status;
    }
    if (resolutionAction) {
      whereClause.resolutionAction = resolutionAction;
    }
    if (category) {
      whereClause.category = { contains: category as string, mode: 'insensitive' };
    }
    
    if (startDate && endDate) {
      const { startUtc, endUtc } = getCustomDateRange(startDate as string, endDate as string, (tzOffset as string) || -420);
      whereClause.date = { gte: startUtc, lte: endUtc };
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
            where: { id: { in: approverIds } },
            select: { id: true, name: true, role: true }
          })
        : [],
      ingredientIds.length > 0
        ? prisma.ingredient.findMany({
            where: { id: { in: ingredientIds } },
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
    console.error('[CASHFLOW] Error fetching cash flows:', error);
    res.status(500).json({ error: 'Gagal mengambil arus kas' });
  }
});

// ─── 2. GET SUMMARY (Dual-Pocket Balances & Approval Counts) ───────────────────
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Ambil seluruh cashflow tenant untuk kalkulasi dual pocket
    const allCashflows = await prisma.cashFlow.findMany({
      where: { tenantId },
      select: {
        type: true,
        amount: true,
        cashPocket: true,
        status: true,
        resolutionAction: true
      }
    });

    let kasOperasionalIn = 0;
    let kasOperasionalOut = 0;
    let laciKasirIn = 0;
    let laciKasirOut = 0;

    let pendingApprovalsCount = 0;
    let pendingApprovalsAmount = 0;
    let rejectedCount = 0;
    let rejectedAmount = 0;

    for (const cf of allCashflows) {
      const pocket = cf.cashPocket || 'KAS_OPERASIONAL';
      const isApproved = cf.status === 'APPROVED';

      if (cf.status === 'PENDING_APPROVAL') {
        pendingApprovalsCount++;
        pendingApprovalsAmount += cf.amount;
      } else if (cf.status === 'REJECTED' && cf.resolutionAction === 'NONE') {
        rejectedCount++;
        rejectedAmount += cf.amount;
      }

      if (isApproved) {
        if (pocket === 'KAS_OPERASIONAL') {
          if (cf.type === 'Pemasukan' || cf.type === 'IN') kasOperasionalIn += cf.amount;
          else if (cf.type === 'Pengeluaran' || cf.type === 'OUT') kasOperasionalOut += cf.amount;
        } else if (pocket === 'LACI_KASIR') {
          if (cf.type === 'Pemasukan' || cf.type === 'IN') laciKasirIn += cf.amount;
          else if (cf.type === 'Pengeluaran' || cf.type === 'OUT') laciKasirOut += cf.amount;
        }
      }
    }

    res.json({
      kasOperasional: {
        balance: kasOperasionalIn - kasOperasionalOut,
        totalIn: kasOperasionalIn,
        totalOut: kasOperasionalOut,
        pendingApprovalsCount,
        pendingApprovalsAmount,
        rejectedCount,
        rejectedAmount
      },
      laciKasir: {
        balance: laciKasirIn - laciKasirOut,
        totalIn: laciKasirIn,
        totalOut: laciKasirOut
      }
    });
  } catch (error) {
    console.error('[CASHFLOW] Error calculating summary:', error);
    res.status(500).json({ error: 'Gagal menghitung ringkasan kas' });
  }
});

// ─── 3. GET OPERATIONAL ANALYTICS (Daily Burn Rate & Breakdown) ───────────────
router.get('/operational-analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Default range: 30 hari terakhir jika tidak ditentukan
    let dateFilter: any = {};
    if (startDate && endDate) {
      const { startUtc, endUtc } = getCustomDateRange(startDate as string, endDate as string, (tzOffset as string) || -420);
      dateFilter = { gte: startUtc, lte: endUtc };
    } else {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      dateFilter = { gte: thirtyDaysAgo, lte: now };
    }

    const expenses = await prisma.cashFlow.findMany({
      where: {
        tenantId,
        type: 'Pengeluaran',
        status: 'APPROVED',
        cashPocket: 'KAS_OPERASIONAL',
        date: dateFilter
      },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { date: 'asc' }
    });

    const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Hitung rentang hari untuk Daily Burn Rate
    const daysCount = Math.max(1, Math.round(((dateFilter.lte?.getTime?.() || Date.now()) - (dateFilter.gte?.getTime?.() || Date.now())) / (1000 * 60 * 60 * 24)) || 1);
    const dailyBurnRate = Math.round(totalExpenseAmount / daysCount);

    // Kategori Breakdown Kafe
    const categoryTotals: Record<string, { total: number; count: number }> = {
      'Bahan Dapur & Minuman (COGS)': { total: 0, count: 0 },
      'Utilitas & Operasional (Listrik, Gas, Galon)': { total: 0, count: 0 },
      'Kemasan & Packaging': { total: 0, count: 0 },
      'Kebersihan & Perlengkapan Bar': { total: 0, count: 0 },
      'SDM & Uang Makan Staf': { total: 0, count: 0 },
      'Lainnya / Biaya Darurat': { total: 0, count: 0 }
    };

    const emergencyProcurements: any[] = [];

    for (const exp of expenses) {
      const catLower = exp.category.toLowerCase();
      const descLower = exp.description.toLowerCase();

      // Deteksi belanja darurat (quick chips / linked ingredient)
      if (
        exp.linkedIngredientId ||
        descLower.includes('galon') ||
        descLower.includes('gas lpg') ||
        descLower.includes('es batu') ||
        descLower.includes('susu') ||
        descLower.includes('darurat') ||
        catLower.includes('darurat')
      ) {
        emergencyProcurements.push({
          id: exp.id,
          date: exp.date,
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          receiptImage: exp.receiptImage,
          spentBy: exp.user?.name || 'Kasir'
        });
      }

      if (catLower.includes('makanan') || catLower.includes('minuman') || catLower.includes('bahan')) {
        categoryTotals['Bahan Dapur & Minuman (COGS)'].total += exp.amount;
        categoryTotals['Bahan Dapur & Minuman (COGS)'].count += 1;
      } else if (catLower.includes('utilitas') || catLower.includes('operasional') || catLower.includes('listrik') || catLower.includes('gas')) {
        categoryTotals['Utilitas & Operasional (Listrik, Gas, Galon)'].total += exp.amount;
        categoryTotals['Utilitas & Operasional (Listrik, Gas, Galon)'].count += 1;
      } else if (catLower.includes('kemasan') || catLower.includes('packaging') || catLower.includes('cup')) {
        categoryTotals['Kemasan & Packaging'].total += exp.amount;
        categoryTotals['Kemasan & Packaging'].count += 1;
      } else if (catLower.includes('kebersihan') || catLower.includes('sabun') || catLower.includes('perawatan')) {
        categoryTotals['Kebersihan & Perlengkapan Bar'].total += exp.amount;
        categoryTotals['Kebersihan & Perlengkapan Bar'].count += 1;
      } else if (catLower.includes('sdm') || catLower.includes('makan') || catLower.includes('lembur')) {
        categoryTotals['SDM & Uang Makan Staf'].total += exp.amount;
        categoryTotals['SDM & Uang Makan Staf'].count += 1;
      } else {
        categoryTotals['Lainnya / Biaya Darurat'].total += exp.amount;
        categoryTotals['Lainnya / Biaya Darurat'].count += 1;
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals).map(([cat, data]) => ({
      category: cat,
      total: data.total,
      count: data.count,
      percentage: totalExpenseAmount > 0 ? Number(((data.total / totalExpenseAmount) * 100).toFixed(1)) : 0
    }));

    res.json({
      periodDays: daysCount,
      totalExpenseAmount,
      dailyBurnRate,
      categoryBreakdown,
      emergencyProcurementsCount: emergencyProcurements.length,
      emergencyProcurements: emergencyProcurements.slice(-15).reverse()
    });
  } catch (error) {
    console.error('[CASHFLOW] Error computing operational analytics:', error);
    res.status(500).json({ error: 'Gagal menghitung analitik operasional' });
  }
});

// ─── 4. POST NEW CASH FLOW (Standard & Backwards Compatible) ──────────────────
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      type,
      category,
      amount,
      description,
      cashPocket = 'KAS_OPERASIONAL',
      receiptImage = null,
      linkedIngredientId = null,
      restockQty = null
    } = req.body;

    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;

    if (!type || !category || !amount || !description) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Nominal transaksi harus berupa angka positif' });
    }

    const canApprove = isApproverRole(user?.role, user?.isPlatformAdmin);
    
    // Aturan status: Jika pengeluaran dicatat oleh kasir/staff, status otomatis PENDING_APPROVAL.
    // Jika dicatat oleh Owner/Admin atau jika berupa Pemasukan kas, status langsung APPROVED, kecuali jika eksplisit diminta PENDING_APPROVAL untuk simulasi.
    let initialStatus: string;
    if (req.body.status && ['PENDING_APPROVAL', 'APPROVED'].includes(req.body.status)) {
      initialStatus = req.body.status;
    } else {
      initialStatus = (type === 'Pengeluaran' && !canApprove) ? 'PENDING_APPROVAL' : 'APPROVED';
    }
    const approvedBy = initialStatus === 'APPROVED' ? userId : null;
    const approvedAt = initialStatus === 'APPROVED' ? new Date() : null;

    const parsedIngId = linkedIngredientId ? Number(linkedIngredientId) : null;
    const parsedRestockQty = restockQty ? Number(restockQty) : null;

    const cashflow = await prisma.cashFlow.create({
      data: {
        tenantId,
        outletId,
        type,
        category,
        amount: numAmount,
        description,
        userId,
        cashPocket,
        status: initialStatus,
        receiptImage,
        approvedBy,
        approvedAt,
        linkedIngredientId: parsedIngId,
        restockQty: parsedRestockQty
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    // Jika langsung APPROVED dan ada linked ingredient + restockQty > 0, auto restock
    if (initialStatus === 'APPROVED' && parsedIngId && parsedRestockQty && parsedRestockQty > 0) {
      try {
        await prisma.ingredient.update({
          where: { id: parsedIngId },
          data: { stock: { increment: parsedRestockQty } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId,
            ingredientId: parsedIngId,
            change: parsedRestockQty,
            cost: numAmount,
            type: 'Restock',
            reason: 'Kulakan Kas Operasional Kasir',
            description,
            referenceId: `CASHFLOW-${cashflow.id}`,
            userId
          }
        });

        emitToTenant(tenantId, 'menu:stock_sync', { ingredientId: parsedIngId });
      } catch (ingErr) {
        console.error('[CASHFLOW] Gagal auto-restock linked ingredient:', ingErr);
      }
    }

    // Audit Logger
    await AuditLogger.log({
      tenantId,
      outletId,
      userId,
      userName: user?.name,
      userRole: user?.role,
      action: initialStatus === 'PENDING_APPROVAL' ? 'CASHFLOW_EXPENSE_REQUESTED' : 'CASHFLOW_CREATE',
      resource: 'FINANCE',
      resourceId: cashflow.id,
      description: `Pencatatan kas [${type} - ${cashPocket}] Rp ${numAmount.toLocaleString('id-ID')} (${initialStatus})`
    }, req);

    // Socket Real-time Emit
    emitToTenant(tenantId, 'cashflow:created', cashflow);

    res.status(201).json(cashflow);
  } catch (error) {
    console.error('[CASHFLOW] Error creating cash flow:', error);
    res.status(500).json({ error: 'Gagal menyimpan arus kas' });
  }
});

// ─── 5. POST REQUEST EXPENSE (Cashier Quick 1-Click Operational Expense) ───────
router.post('/request-expense', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      category,
      amount,
      description,
      receiptImage,
      linkedIngredientId,
      restockQty
    } = req.body;

    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;

    if (!category || !amount || !description) {
      return res.status(400).json({ error: 'Kategori, nominal, dan keterangan belanja wajib diisi' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Nominal harus berupa angka positif' });
    }

    const canApprove = isApproverRole(user?.role, user?.isPlatformAdmin);
    const initialStatus = canApprove ? 'APPROVED' : 'PENDING_APPROVAL';

    const parsedIngId = linkedIngredientId ? Number(linkedIngredientId) : null;
    const parsedRestockQty = restockQty ? Number(restockQty) : null;

    const cashflow = await prisma.cashFlow.create({
      data: {
        tenantId,
        outletId,
        type: 'Pengeluaran',
        category,
        amount: numAmount,
        description,
        userId,
        cashPocket: 'KAS_OPERASIONAL',
        status: initialStatus,
        receiptImage: receiptImage || null,
        approvedBy: initialStatus === 'APPROVED' ? userId : null,
        approvedAt: initialStatus === 'APPROVED' ? new Date() : null,
        linkedIngredientId: parsedIngId,
        restockQty: parsedRestockQty
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    // Auto-restock jika langsung APPROVED
    if (initialStatus === 'APPROVED' && parsedIngId && parsedRestockQty && parsedRestockQty > 0) {
      try {
        await prisma.ingredient.update({
          where: { id: parsedIngId },
          data: { stock: { increment: parsedRestockQty } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId,
            ingredientId: parsedIngId,
            change: parsedRestockQty,
            cost: numAmount,
            type: 'Restock',
            reason: 'Kulakan Kas Operasional Kasir',
            description,
            referenceId: `CASHFLOW-${cashflow.id}`,
            userId
          }
        });

        emitToTenant(tenantId, 'menu:stock_sync', { ingredientId: parsedIngId });
      } catch (ingErr) {
        console.error('[CASHFLOW] Gagal auto-restock linked ingredient:', ingErr);
      }
    }

    await AuditLogger.log({
      tenantId,
      outletId,
      userId,
      userName: user?.name,
      userRole: user?.role,
      action: 'EXPENSE_REQUESTED',
      resource: 'FINANCE',
      resourceId: cashflow.id,
      description: `Pengajuan belanja operasional Rp ${numAmount.toLocaleString('id-ID')} (${initialStatus})`
    }, req);

    emitToTenant(tenantId, 'cashflow:requested', cashflow);
    emitToTenant(tenantId, 'cashflow:created', cashflow);

    res.status(201).json(cashflow);
  } catch (error) {
    console.error('[CASHFLOW] Error requesting expense:', error);
    res.status(500).json({ error: 'Gagal mengajukan pengeluaran operasional' });
  }
});

// ─── 6. PATCH APPROVE EXPENSE (Owner / Admin Only) ────────────────────────────
router.patch('/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!isApproverRole(user?.role, user?.isPlatformAdmin)) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Owner / Manajer yang dapat menyetujui pengeluaran.' });
    }

    const cashflow = await prisma.cashFlow.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!cashflow) {
      return res.status(404).json({ error: 'Data pengeluaran tidak ditemukan atau bukan milik tenant ini' });
    }

    if (cashflow.status === 'APPROVED') {
      return res.status(400).json({ error: 'Pengeluaran ini sudah disetujui sebelumnya' });
    }

    const updated = await prisma.cashFlow.update({
      where: { id: cashflow.id },
      data: {
        status: 'APPROVED',
        approvedBy: user?.id || null,
        approvedAt: new Date(),
        rejectionReason: null,
        resolutionAction: 'NONE'
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    // Auto-restock ingredient jika ada relasi
    if (updated.linkedIngredientId && updated.restockQty && updated.restockQty > 0) {
      try {
        await prisma.ingredient.update({
          where: { id: updated.linkedIngredientId },
          data: { stock: { increment: updated.restockQty } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId: updated.outletId || user?.outletId,
            ingredientId: updated.linkedIngredientId,
            change: updated.restockQty,
            cost: updated.amount,
            type: 'Restock',
            reason: 'Kulakan Kas Operasional Kasir (Disetujui Owner)',
            description: updated.description,
            referenceId: `CASHFLOW-${updated.id}`,
            userId: user?.id
          }
        });

        emitToTenant(tenantId, 'menu:stock_sync', { ingredientId: updated.linkedIngredientId });
      } catch (ingErr) {
        console.error('[CASHFLOW] Gagal auto-restock saat approve:', ingErr);
      }
    }

    await AuditLogger.log({
      tenantId,
      outletId: updated.outletId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      action: 'EXPENSE_APPROVED',
      resource: 'FINANCE',
      resourceId: updated.id,
      description: `Pengeluaran #${updated.id} disetujui oleh ${user?.name || 'Owner'} (Rp ${updated.amount.toLocaleString('id-ID')})`
    }, req);

    emitToTenant(tenantId, 'cashflow:approved', updated);
    emitToTenant(tenantId, 'cashflow:updated', updated);

    res.json({ message: 'Pengeluaran berhasil disetujui', cashflow: updated });
  } catch (error) {
    console.error('[CASHFLOW] Error approving expense:', error);
    res.status(500).json({ error: 'Gagal menyetujui pengeluaran' });
  }
});

// ─── 7. PATCH REJECT EXPENSE (Owner / Admin Only) ─────────────────────────────
router.patch('/:id/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!isApproverRole(user?.role, user?.isPlatformAdmin)) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Owner / Manajer yang dapat menolak pengeluaran.' });
    }

    if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Alasan penolakan wajib diisi agar kasir dapat menindaklanjuti.' });
    }

    const cashflow = await prisma.cashFlow.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!cashflow) {
      return res.status(404).json({ error: 'Data pengeluaran tidak ditemukan atau bukan milik tenant ini' });
    }

    const updated = await prisma.cashFlow.update({
      where: { id: cashflow.id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
        approvedBy: user?.id || null,
        approvedAt: new Date(),
        resolutionAction: 'NONE'
      },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    await AuditLogger.log({
      tenantId,
      outletId: updated.outletId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      action: 'EXPENSE_REJECTED',
      resource: 'FINANCE',
      resourceId: updated.id,
      description: `Pengeluaran #${updated.id} ditolak: ${rejectionReason.trim()}`
    }, req);

    emitToTenant(tenantId, 'cashflow:rejected', updated);
    emitToTenant(tenantId, 'cashflow:updated', updated);

    res.json({ message: 'Pengeluaran ditolak', cashflow: updated });
  } catch (error) {
    console.error('[CASHFLOW] Error rejecting expense:', error);
    res.status(500).json({ error: 'Gagal menolak pengeluaran' });
  }
});

// ─── 8. PATCH REVISE REJECTED EXPENSE (Cashier Resubmit) ──────────────────────
router.patch('/:id/revise', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { receiptImage, amount, description, category } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const cashflow = await prisma.cashFlow.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!cashflow) {
      return res.status(404).json({ error: 'Catatan pengeluaran tidak ditemukan' });
    }

    const updateData: any = {
      status: 'PENDING_APPROVAL',
      resolutionAction: 'REVISE',
      rejectionReason: null
    };

    if (receiptImage !== undefined) updateData.receiptImage = receiptImage;
    if (amount !== undefined && Number(amount) > 0) updateData.amount = Number(amount);
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;

    const updated = await prisma.cashFlow.update({
      where: { id: cashflow.id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    await AuditLogger.log({
      tenantId,
      outletId: updated.outletId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      action: 'EXPENSE_REVISED',
      resource: 'FINANCE',
      resourceId: updated.id,
      description: `Pengeluaran #${updated.id} direvisi dan diajukan ulang oleh kasir`
    }, req);

    emitToTenant(tenantId, 'cashflow:requested', updated);
    emitToTenant(tenantId, 'cashflow:updated', updated);

    res.json({ message: 'Pengeluaran berhasil direvisi dan diajukan ulang ke Owner', cashflow: updated });
  } catch (error) {
    console.error('[CASHFLOW] Error revising expense:', error);
    res.status(500).json({ error: 'Gagal merevisi pengeluaran' });
  }
});

// ─── 9. POST CONVERT REJECTED EXPENSE TO EMPLOYEE LOAN (Kasbon Staf) ──────────
router.post('/:id/convert-to-loan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!isApproverRole(user?.role, user?.isPlatformAdmin)) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Owner / Manajer yang dapat mengalihkan pengeluaran ke kasbon.' });
    }

    const cashflow = await prisma.cashFlow.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!cashflow) {
      return res.status(404).json({ error: 'Catatan pengeluaran tidak ditemukan' });
    }

    if (cashflow.status !== 'REJECTED') {
      return res.status(400).json({ error: 'Hanya pengeluaran yang berstatus DITOLAK yang dapat dialihkan ke kasbon staf.' });
    }

    if (cashflow.resolutionAction === 'CONVERT_LOAN') {
      return res.status(400).json({ error: 'Pengeluaran ini sudah pernah dialihkan ke kasbon sebelumnya.' });
    }

    // Buat kasbon staf di tabel EmployeeLoan
    const loanReason = `Pengalihan kas operasional ditolak: ${cashflow.description} (Alasan: ${cashflow.rejectionReason || 'Tidak ada nota sah'})`;

    const loan = await prisma.employeeLoan.create({
      data: {
        tenantId,
        userId: cashflow.userId,
        amount: cashflow.amount,
        remaining: cashflow.amount,
        source: 'KAS_OPERASIONAL',
        reason: loanReason,
        status: 'Belum Lunas',
        approvedBy: user?.name || 'Owner'
      }
    });

    // Update status resolution di cashflow
    const updatedCashflow = await prisma.cashFlow.update({
      where: { id: cashflow.id },
      data: {
        resolutionAction: 'CONVERT_LOAN'
      }
    });

    await AuditLogger.log({
      tenantId,
      outletId: cashflow.outletId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      action: 'EXPENSE_CONVERTED_TO_LOAN',
      resource: 'FINANCE',
      resourceId: cashflow.id,
      description: `Pengeluaran #${cashflow.id} Rp ${cashflow.amount.toLocaleString('id-ID')} dialihkan ke Kasbon Staf #${loan.id}`
    }, req);

    emitToTenant(tenantId, 'cashflow:updated', updatedCashflow);

    res.json({
      message: `Dana Rp ${cashflow.amount.toLocaleString('id-ID')} berhasil dialihkan ke Kasbon Karyawan.`,
      loan,
      cashflow: updatedCashflow
    });
  } catch (error) {
    console.error('[CASHFLOW] Error converting to loan:', error);
    res.status(500).json({ error: 'Gagal mengalihkan pengeluaran ke kasbon staf' });
  }
});

// ─── 10. DELETE CASH FLOW ─────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const existing = await prisma.cashFlow.findFirst({
      where: {
        id: Number(id),
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Catatan arus kas tidak ditemukan atau bukan milik tenant ini' });
    }

    // Role guard: Kasir hanya boleh menghapus transaksi miliknya sendiri yang masih PENDING_APPROVAL
    const canManageAll = isApproverRole(user?.role, user?.isPlatformAdmin);
    if (!canManageAll && (existing.userId !== user?.id || existing.status !== 'PENDING_APPROVAL')) {
      return res.status(403).json({ error: 'Hanya Owner atau pembuat pengajuan yang berstatus Pending yang dapat menghapus catatan ini.' });
    }

    await prisma.cashFlow.delete({ where: { id: existing.id } });

    await AuditLogger.log({
      tenantId,
      outletId: existing.outletId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      action: 'CASHFLOW_DELETE',
      resource: 'FINANCE',
      resourceId: existing.id,
      description: `Penghapusan catatan kas #${existing.id} [${existing.type}] Rp ${existing.amount.toLocaleString('id-ID')}`
    }, req);

    emitToTenant(tenantId, 'cashflow:deleted', { id: existing.id });

    res.json({ message: 'Arus kas berhasil dihapus' });
  } catch (error) {
    console.error('[CASHFLOW] Error deleting cash flow:', error);
    res.status(500).json({ error: 'Gagal menghapus arus kas' });
  }
});

export default router;
