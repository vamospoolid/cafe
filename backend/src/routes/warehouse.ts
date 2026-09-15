import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io } from '../index';
import { syncMenuSoldOutStatus } from './ingredients';

const router = Router();
const prisma = new PrismaClient();

// Helper generate Invoice/Req numbers
function generateDocNumber(prefix: string) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${dateStr}-${rand}`;
}

// ─── 1. DASHBOARD & STATS ──────────────────────────────────────────────────
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      select: {
        id: true,
        name: true,
        warehouseStock: true,
        warehouseMinStock: true,
        buyPrice: true,
        unit: true,
        purchaseUnit: true,
        conversionRatio: true
      }
    });

    const totalAssetValue = ingredients.reduce((sum, item) => sum + (item.warehouseStock * item.buyPrice), 0);
    const lowStockItems = ingredients.filter(item => item.warehouseMinStock > 0 && item.warehouseStock <= item.warehouseMinStock);

    // Owner Finance Aggregations
    const ownerTxns = await prisma.ownerFundTransaction.findMany();
    const totalCapitalIn = ownerTxns
      .filter(t => t.type === 'CAPITAL_IN')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTransferredToResto = ownerTxns
      .filter(t => t.type === 'TRANSFER_TO_RESTO')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalReimbursedToOwner = ownerTxns
      .filter(t => t.type === 'REIMBURSEMENT_PAID')
      .reduce((sum, t) => sum + t.amount, 0);

    const currentOwnerPayable = Math.max(0, totalTransferredToResto - totalReimbursedToOwner);

    // Recent Requisitions
    const recentTransfers = await prisma.warehouseRequisition.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { name: true } },
        items: true
      }
    });

    // Recent Inbounds
    const recentInbounds = await prisma.warehouseInbound.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { name: true } },
        items: true
      }
    });

    res.json({
      totalAssetValue,
      totalCapitalIn,
      totalTransferredToResto,
      totalReimbursedToOwner,
      currentOwnerPayable,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      totalIngredients: ingredients.length,
      recentTransfers,
      recentInbounds
    });
  } catch (error: any) {
    console.error('Error fetching warehouse dashboard:', error);
    res.status(500).json({ error: 'Gagal memuat dashboard gudang: ' + error.message });
  }
});

// ─── 2. STOK GUDANG PUSAT ─────────────────────────────────────────────────
router.get('/stock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const where: any = {};

    if (category && typeof category === 'string') {
      where.category = category;
    }
    if (search && typeof search === 'string') {
      where.name = { contains: search };
    }

    const ingredients = await prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        supplier: { select: { id: true, name: true, phone: true } }
      }
    });

    res.json(ingredients);
  } catch (error: any) {
    console.error('Error fetching warehouse stock:', error);
    res.status(500).json({ error: 'Gagal mengambil stok gudang: ' + error.message });
  }
});

// ─── 3. BARANG MASUK (INBOUND DARI SUPPLIER VIA DANA OWNER) ───────────────
router.post('/inbound', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { supplierId, supplierName, paymentSource, notes, date, items } = req.body;
    const userId = (req as any).user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar item belanja wajib diisi' });
    }

    const invoiceNumber = generateDocNumber('INB');
    let totalAmount = 0;

    // Process items & calculate
    const processedItems: any[] = [];
    for (const it of items) {
      const pQty = Number(it.purchaseQty) || 0;
      const cRatio = Number(it.conversionRatio) || 1;
      const pPrice = Number(it.purchasePrice) || 0;

      if (pQty <= 0) continue;

      const baseQty = pQty * cRatio;
      const basePrice = cRatio > 0 ? (pPrice / cRatio) : pPrice;
      const subtotal = pQty * pPrice;
      totalAmount += subtotal;

      processedItems.push({
        ingredientId: Number(it.ingredientId),
        itemName: it.itemName || 'Bahan',
        purchaseUnit: it.purchaseUnit || 'Karton',
        purchaseQty: pQty,
        conversionRatio: cRatio,
        baseQty,
        purchasePrice: pPrice,
        basePrice,
        subtotal
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada item dengan jumlah valid' });
    }

    // Database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Inbound record
      const inbound = await tx.warehouseInbound.create({
        data: {
          invoiceNumber,
          supplierId: supplierId ? Number(supplierId) : null,
          supplierName: supplierName || null,
          userId,
          totalAmount,
          paymentSource: paymentSource || 'DANA_PRIBADI_OWNER',
          notes,
          date: date ? new Date(date) : new Date(),
          items: {
            create: processedItems
          }
        },
        include: { items: true }
      });

      // 2. Update each ingredient warehouse stock & latest purchase unit info
      for (const it of processedItems) {
        await tx.ingredient.update({
          where: { id: it.ingredientId },
          data: {
            warehouseStock: { increment: it.baseQty },
            buyPrice: it.basePrice > 0 ? it.basePrice : undefined,
            purchaseUnit: it.purchaseUnit,
            conversionRatio: it.conversionRatio
          }
        });
      }

      // 3. If funded by Central/Holding Capital, record to Owner/Central Fund Ledger
      if ((paymentSource || 'DANA_PRIBADI_OWNER') === 'DANA_PRIBADI_OWNER') {
        await tx.ownerFundTransaction.create({
          data: {
            type: 'CAPITAL_IN',
            amount: totalAmount,
            referenceType: 'INBOUND',
            referenceId: invoiceNumber,
            description: `Penerimaan pasokan gudang via modal pusat (${processedItems.length} item - ${invoiceNumber})`,
            userId,
            date: date ? new Date(date) : new Date()
          }
        });
      }

      return inbound;
    });

    if (io) {
      io.emit('warehouse:stock_updated', { type: 'INBOUND', invoiceNumber });
    }

    res.status(201).json({
      message: 'Barang masuk gudang berhasil dicatat',
      inbound: result
    });
  } catch (error: any) {
    console.error('Error creating warehouse inbound:', error);
    res.status(500).json({ error: 'Gagal mencatat barang masuk: ' + error.message });
  }
});

router.get('/inbounds', authenticateToken, async (req: Request, res: Response) => {
  try {
    const inbounds = await prisma.warehouseInbound.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
        items: {
          include: { ingredient: { select: { name: true, unit: true } } }
        }
      }
    });
    res.json(inbounds);
  } catch (error: any) {
    console.error('Error fetching inbounds:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat barang masuk' });
  }
});

// ─── VOID / KOREKSI INBOUND (tidak hapus — audit trail tetap ada) ─────────
router.post('/inbounds/:id/void', authenticateToken, async (req: Request, res: Response) => {
  try {
    const inboundId = Number(req.params.id);
    const { voidReason } = req.body;
    const userId = (req as any).user.id;

    if (!voidReason || !voidReason.trim()) {
      return res.status(400).json({ error: 'Alasan pembatalan wajib diisi untuk keperluan audit.' });
    }

    const inbound = await prisma.warehouseInbound.findUnique({
      where: { id: inboundId },
      include: { items: true }
    });

    if (!inbound) return res.status(404).json({ error: 'Data penerimaan tidak ditemukan.' });
    if (inbound.isVoided) return res.status(400).json({ error: 'Penerimaan ini sudah dibatalkan sebelumnya.' });

    await prisma.$transaction(async (tx) => {
      // 1. Mark inbound as voided
      await tx.warehouseInbound.update({
        where: { id: inboundId },
        data: {
          isVoided: true,
          voidReason: voidReason.trim(),
          voidedAt: new Date()
        }
      });

      // 2. Reverse warehouse stock untuk setiap item
      for (const it of inbound.items) {
        await tx.ingredient.update({
          where: { id: it.ingredientId },
          data: { warehouseStock: { decrement: it.baseQty } }
        });
      }

      // 3. Reverse ledger modal pusat jika sumber dana adalah Modal Pusat
      if (inbound.paymentSource === 'DANA_PRIBADI_OWNER') {
        await tx.ownerFundTransaction.create({
          data: {
            type: 'CAPITAL_IN',
            amount: -inbound.totalAmount, // Negatif = reversal
            referenceType: 'VOID_INBOUND',
            referenceId: inbound.invoiceNumber,
            description: `KOREKSI/VOID: Pembatalan penerimaan ${inbound.invoiceNumber} — ${voidReason}`,
            userId,
            date: new Date()
          }
        });
      }
    });

    if (io) io.emit('warehouse:stock_updated', { type: 'VOID_INBOUND', invoiceNumber: inbound.invoiceNumber });

    res.json({ message: `Penerimaan ${inbound.invoiceNumber} berhasil dibatalkan. Stok sudah dikembalikan.` });
  } catch (error: any) {
    console.error('Error voiding inbound:', error);
    res.status(500).json({ error: 'Gagal membatalkan penerimaan: ' + error.message });
  }
});

// ─── 4. STOCK OPNAME GUDANG PUSAT ─────────────────────────────────────────

router.post('/opname', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ingredientId, actualStock, reason, notes } = req.body;
    const userId = (req as any).user.id;

    if (!ingredientId || actualStock === undefined) {
      return res.status(400).json({ error: 'ID Bahan dan Stok Fisik wajib diisi' });
    }

    const ing = await prisma.ingredient.findUnique({ where: { id: Number(ingredientId) } });
    if (!ing) return res.status(404).json({ error: 'Bahan baku tidak ditemukan' });

    const diff = Number(actualStock) - ing.warehouseStock;

    const updated = await prisma.ingredient.update({
      where: { id: Number(ingredientId) },
      data: { warehouseStock: Number(actualStock) }
    });

    if (io) {
      io.emit('warehouse:stock_updated', { type: 'OPNAME', ingredientId: ing.id });
    }

    res.json({
      message: 'Stok fisik gudang berhasil disesuaikan',
      difference: diff,
      ingredient: updated
    });
  } catch (error: any) {
    console.error('Error opname warehouse:', error);
    res.status(500).json({ error: 'Gagal melakukan opname gudang: ' + error.message });
  }
});

// ─── 5. PERMINTAAN & TRANSFER DARI GUDANG KE DAPUR (REQUISITION) ─────────
router.get('/transfers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const transfers = await prisma.warehouseRequisition.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
        items: {
          include: { ingredient: { select: { name: true, unit: true, purchaseUnit: true, conversionRatio: true } } }
        }
      }
    });
    res.json(transfers);
  } catch (error: any) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ error: 'Gagal memuat daftar permintaan transfer' });
  }
});

router.post('/transfers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { notes, items } = req.body;
    const userId = (req as any).user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar bahan yang diminta wajib diisi' });
    }

    // Get settings for transfer pricing
    const settings = await prisma.settings.findFirst();
    const pricingMode = settings?.warehouseTransferPricing || 'AT_COST';
    const markupPercent = Number(settings?.warehouseMarkupPercent) || 0;

    const reqNumber = generateDocNumber('REQ');
    let totalTransferCost = 0;
    const processedItems: any[] = [];

    for (const it of items) {
      const ing = await prisma.ingredient.findUnique({ where: { id: Number(it.ingredientId) } });
      if (!ing) continue;

      const rQty = Number(it.requestedQty) || 0;
      if (rQty <= 0) continue;

      // Determine base quantity
      const isPurchaseUnit = it.requestedUnit === ing.purchaseUnit && (ing.conversionRatio || 1) > 0;
      const baseQty = isPurchaseUnit ? (rQty * (ing.conversionRatio || 1)) : rQty;

      // Determine unit transfer price
      let transferPrice = ing.buyPrice || 0;
      if (pricingMode === 'MARKUP' && markupPercent > 0) {
        transferPrice = transferPrice * (1 + markupPercent / 100);
      }

      const subtotal = baseQty * transferPrice;
      totalTransferCost += subtotal;

      processedItems.push({
        ingredientId: ing.id,
        itemName: ing.name,
        requestedUnit: it.requestedUnit || ing.unit,
        requestedQty: rQty,
        baseQty,
        transferPrice,
        subtotal
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada item permintaan yang valid' });
    }

    const requisition = await prisma.warehouseRequisition.create({
      data: {
        reqNumber,
        requestedById: userId,
        status: 'PENDING',
        totalTransferCost,
        notes,
        items: {
          create: processedItems
        }
      },
      include: {
        requestedBy: { select: { name: true } },
        items: true
      }
    });

    if (io) {
      io.emit('warehouse:transfer_created', requisition);
    }

    res.status(201).json({
      message: 'Permintaan bahan ke Gudang Pusat berhasil dibuat',
      requisition
    });
  } catch (error: any) {
    console.error('Error creating transfer request:', error);
    res.status(500).json({ error: 'Gagal membuat permintaan bahan: ' + error.message });
  }
});

// Approve transfer request by Warehouse staff / Admin
router.put('/transfers/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = (req as any).user.id;

    const reqDoc = await prisma.warehouseRequisition.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!reqDoc) return res.status(404).json({ error: 'Dokumen permintaan tidak ditemukan' });
    if (reqDoc.status !== 'PENDING') {
      return res.status(400).json({ error: `Dokumen sudah dalam status ${reqDoc.status}` });
    }

    const updated = await prisma.warehouseRequisition.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date()
      },
      include: {
        items: true,
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } }
      }
    });

    if (io) {
      io.emit('warehouse:transfer_approved', updated);
    }

    res.json({ message: 'Permintaan bahan telah disetujui untuk dikirim', requisition: updated });
  } catch (error: any) {
    console.error('Error approving transfer:', error);
    res.status(500).json({ error: 'Gagal menyetujui transfer: ' + error.message });
  }
});

// Batalkan Permintaan Bahan yang masih PENDING (Dibatalkan oleh Koki / Pemohon)
router.post('/transfers/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;
    const userId = (req as any).user.id;

    const reqDoc = await prisma.warehouseRequisition.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!reqDoc) return res.status(404).json({ error: 'Dokumen permintaan tidak ditemukan' });
    if (reqDoc.status !== 'PENDING') {
      return res.status(400).json({ error: `Permintaan sudah berstatus ${reqDoc.status} dan tidak dapat dibatalkan.` });
    }

    const updated = await prisma.warehouseRequisition.update({
      where: { id },
      data: {
        status: 'VOIDED',
        isVoided: true,
        voidReason: reason || 'Dibatalkan oleh pemohon',
        approvedById: userId
      }
    });

    if (io) {
      io.emit('warehouse:transfer_cancelled', updated);
      io.emit('warehouse:stock_updated', { type: 'TRANSFER_CANCELLED', reqNumber: reqDoc.reqNumber });
    }

    res.json({ message: `Permintaan ${reqDoc.reqNumber} berhasil dibatalkan.`, requisition: updated });
  } catch (error: any) {
    console.error('Error cancelling transfer:', error);
    res.status(500).json({ error: 'Gagal membatalkan permintaan: ' + error.message });
  }
});

// Receive transfer items in Kitchen (Dapur Muki)
// Trigger: Deduct warehouse stock, increase kitchen stock, record Muki expense / owner payable
router.put('/transfers/:id/receive', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = (req as any).user.id;

    const reqDoc = await prisma.warehouseRequisition.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!reqDoc) return res.status(404).json({ error: 'Dokumen permintaan tidak ditemukan' });
    if (reqDoc.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Barang sudah pernah diterima sebelumnya' });
    }

    // Execute atomic transfer transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update each ingredient: decrease warehouseStock, increase kitchen stock
      for (const it of reqDoc.items) {
        const ing = await tx.ingredient.findUnique({ where: { id: it.ingredientId } });
        if (!ing) continue;

        // Potong gudang
        await tx.ingredient.update({
          where: { id: it.ingredientId },
          data: {
            warehouseStock: { decrement: it.baseQty },
            stock: { increment: it.baseQty }
          }
        });

        // Catat mutasi log dapur Muki Ramen
        await tx.ingredientLog.create({
          data: {
            ingredientId: it.ingredientId,
            change: it.baseQty,
            cost: it.subtotal,
            type: 'Distribusi',
            referenceId: reqDoc.reqNumber,
            description: `Terima dari Gudang Pusat: ${it.requestedQty} ${it.requestedUnit} (${it.baseQty} ${ing.unit})`,
            userId
          }
        });
      }

      // 2. Catat ke Rekonsiliasi Settlement Modal Pusat: Distribusi Bahan ke Unit Operasional
      await tx.ownerFundTransaction.create({
        data: {
          type: 'TRANSFER_TO_RESTO',
          amount: reqDoc.totalTransferCost,
          referenceType: 'REQUISITION',
          referenceId: reqDoc.reqNumber,
          description: `Distribusi bahan ke Dapur Cabang via ${reqDoc.reqNumber} (${reqDoc.items.length} item)`,
          userId,
          date: new Date()
        }
      });

      // 3. Update status requisition
      const updated = await tx.warehouseRequisition.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date()
        },
        include: {
          items: { include: { ingredient: true } },
          requestedBy: { select: { name: true } }
        }
      });

      return updated;
    });

    // Sinkronisasi menu sold-out realtime
    await syncMenuSoldOutStatus();

    if (io) {
      io.emit('warehouse:stock_updated', { type: 'TRANSFER_RECEIVED', reqNumber: reqDoc.reqNumber });
    }

    res.json({
      message: 'Bahan baku berhasil diterima di Dapur Cabang dan tercatat dalam settlement distribusi modal pusat',
      requisition: result
    });
  } catch (error: any) {
    console.error('Error receiving transfer in kitchen:', error);
    res.status(500).json({ error: 'Gagal konfirmasi penerimaan barang: ' + error.message });
  }
});

// ─── 6. REKONSILIASI & SETTLEMENT MODAL PUSAT ─────────────────────────────
router.get('/owner-finance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.ownerFundTransaction.findMany({
      orderBy: { date: 'desc' },
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    const totalCapitalIn = transactions
      .filter(t => t.type === 'CAPITAL_IN')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTransferredToResto = transactions
      .filter(t => t.type === 'TRANSFER_TO_RESTO')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalReimbursedToOwner = transactions
      .filter(t => t.type === 'REIMBURSEMENT_PAID')
      .reduce((sum, t) => sum + t.amount, 0);

    const currentOwnerPayable = Math.max(0, totalTransferredToResto - totalReimbursedToOwner);

    res.json({
      summary: {
        totalCapitalIn,
        totalTransferredToResto,
        totalReimbursedToOwner,
        currentOwnerPayable
      },
      transactions
    });
  } catch (error: any) {
    console.error('Error fetching owner finance ledger:', error);
    res.status(500).json({ error: 'Gagal mengambil data buku besar modal: ' + error.message });
  }
});

// Settlement / Pencairan pengembalian dana ke entitas pusat
router.post('/owner-finance/reimburse', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, paymentMethod, deductFromMukiCash, deductFromBranchCash, notes } = req.body;
    const shouldDeductCash = deductFromBranchCash || deductFromMukiCash;
    const userId = (req as any).user.id;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Jumlah pembayaran settlement tidak valid' });
    }

    const refNumber = generateDocNumber('SETTLE');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Catat transaksi settlement modal pusat
      const txn = await tx.ownerFundTransaction.create({
        data: {
          type: 'REIMBURSEMENT_PAID',
          amount: numAmount,
          referenceType: 'REIMBURSEMENT',
          referenceId: refNumber,
          description: `Settlement / Pengembalian ke Pusat (${paymentMethod || 'Transfer'}): ${notes || 'Penyelesaian bahan baku didistribusikan ke outlet'}`,
          userId,
          date: new Date()
        }
      });

      // 2. Jika dipilih potong kas operasional cabang
      if (shouldDeductCash) {
        await tx.cashFlow.create({
          data: {
            type: 'Pengeluaran',
            category: 'Settlement Modal Pusat',
            amount: numAmount,
            description: `Settlement bahan baku ke Entitas Pusat (${refNumber}) - ${notes || ''}`,
            userId,
            date: new Date()
          }
        });
      }

      return txn;
    });

    if (io) {
      io.emit('warehouse:owner_reimbursed', result);
    }

    res.status(201).json({
      message: 'Pembayaran pengembalian dana ke owner berhasil dicatat',
      transaction: result
    });
  } catch (error: any) {
    console.error('Error reimbursing owner:', error);
    res.status(500).json({ error: 'Gagal memproses pengembalian dana owner: ' + error.message });
  }
});

// ─── 5. PENJUALAN UMUM & B2B GUDANG PUSAT (WHOLESALE SALES) ────────────────
// Mengeluarkan bahan baku dari Gudang Pusat ke pihak luar/mitra tanpa mengganggu arus kas kasir

// GET all B2B sales
router.get('/sales', authenticateToken, async (req: Request, res: Response) => {
  try {
    const sales = await (prisma as any).warehouseSale.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        soldBy: { select: { id: true, name: true } },
        items: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } }
          }
        }
      }
    });
    res.json(sales);
  } catch (error: any) {
    console.error('Error fetching warehouse sales:', error);
    res.status(500).json({ error: 'Gagal memuat riwayat penjualan gudang: ' + error.message });
  }
});

// GET single B2B sale by ID
router.get('/sales/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const sale = await (prisma as any).warehouseSale.findUnique({
      where: { id },
      include: {
        soldBy: { select: { id: true, name: true } },
        items: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } }
          }
        }
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Faktur penjualan B2B tidak ditemukan' });
    }

    res.json(sale);
  } catch (error: any) {
    console.error('Error fetching sale detail:', error);
    res.status(500).json({ error: 'Gagal memuat detail penjualan: ' + error.message });
  }
});

// CREATE B2B Sale
router.post('/sales', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      paymentMethod = 'TRANSFER',
      paymentStatus = 'PAID',
      notes,
      items
    } = req.body;
    const userId = (req as any).user.id;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'Nama pembeli / mitra wajib diisi' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu item barang yang dijual' });
    }

    const invoiceNumber = generateDocNumber('INV-B2B');

    // Process & calculate items
    let totalAmount = 0;
    let totalHppCost = 0;
    const processedItems: any[] = [];

    for (const it of items) {
      const ingId = Number(it.ingredientId);
      const saleQty = Number(it.saleQty) || 0;
      const unitSalePrice = Number(it.unitSalePrice) || 0;

      if (!ingId || saleQty <= 0) continue;

      const ing = await prisma.ingredient.findUnique({ where: { id: ingId } });
      if (!ing) continue;

      const conversionRatio = Number(it.conversionRatio) || ing.conversionRatio || 1;
      const baseQty = saleQty * conversionRatio;

      // Check warehouse stock availability
      if (ing.warehouseStock < baseQty) {
        return res.status(400).json({
          error: `Stok gudang untuk ${ing.name} tidak mencukupi. Tersedia: ${ing.warehouseStock} ${ing.unit}, Dibutuhkan: ${baseQty} ${ing.unit}`
        });
      }

      // HPP calculation per sale unit
      const unitCostPrice = Number(it.unitCostPrice) || (ing.buyPrice * conversionRatio);
      const subtotalCost = saleQty * unitCostPrice;
      const subtotal = saleQty * unitSalePrice;
      const profit = subtotal - subtotalCost;

      totalAmount += subtotal;
      totalHppCost += subtotalCost;

      processedItems.push({
        ingredientId: ingId,
        itemName: ing.name,
        saleUnit: it.saleUnit || ing.purchaseUnit || ing.unit,
        saleQty,
        conversionRatio,
        baseQty,
        unitCostPrice,
        unitSalePrice,
        subtotalCost,
        subtotal,
        profit
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Item penjualan tidak valid' });
    }

    const grossProfit = totalAmount - totalHppCost;

    // Atomic transaction
    const saleResult = await prisma.$transaction(async (tx: any) => {
      // 1. Create WarehouseSale
      const createdSale = await tx.warehouseSale.create({
        data: {
          invoiceNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone ? customerPhone.trim() : null,
          customerAddress: customerAddress ? customerAddress.trim() : null,
          paymentMethod,
          paymentStatus,
          totalAmount,
          totalHppCost,
          grossProfit,
          notes,
          soldById: userId,
          items: {
            create: processedItems
          }
        },
        include: {
          items: true,
          soldBy: { select: { id: true, name: true } }
        }
      });

      // 2. Decrement warehouse stock & write IngredientLog
      for (const it of processedItems) {
        await tx.ingredient.update({
          where: { id: it.ingredientId },
          data: {
            warehouseStock: { decrement: it.baseQty }
          }
        });

        await tx.ingredientLog.create({
          data: {
            ingredientId: it.ingredientId,
            change: -it.baseQty,
            cost: it.subtotalCost,
            type: 'Penjualan B2B',
            referenceId: invoiceNumber,
            description: `Penjualan grosir B2B ke ${customerName}: ${it.saleQty} ${it.saleUnit} (${it.baseQty} dasar)`,
            userId
          }
        });
      }

      // 3. Catat penerimaan ke Rekening Pusat / Owner Fund (jika status PAID)
      // ARUS KAS KAFE (CashFlow) SAMA SEKALI TIDAK TERSENTUH!
      if (paymentStatus === 'PAID') {
        await tx.ownerFundTransaction.create({
          data: {
            type: 'B2B_SALES_REVENUE',
            amount: totalAmount,
            referenceType: 'WAREHOUSE_SALE',
            referenceId: invoiceNumber,
            description: `Penerimaan Penjualan B2B dari ${customerName} (${paymentMethod}) - Laba: Rp ${grossProfit.toLocaleString('id-ID')}`,
            userId,
            date: new Date()
          }
        });
      }

      return createdSale;
    });

    if (io) {
      io.emit('warehouse:sale_created', saleResult);
      io.emit('warehouse:stock_updated', { type: 'SALE_B2B', invoiceNumber });
    }

    res.status(201).json({
      message: `Penjualan B2B (${invoiceNumber}) berhasil disimpan`,
      sale: saleResult
    });
  } catch (error: any) {
    console.error('Error creating warehouse sale:', error);
    res.status(500).json({ error: 'Gagal membuat penjualan B2B: ' + error.message });
  }
});

// VOID B2B Sale (Koreksi salah input)
router.post('/sales/:id/void', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { voidReason } = req.body;
    const userId = (req as any).user.id;

    if (!voidReason || !voidReason.trim()) {
      return res.status(400).json({ error: 'Alasan pembatalan penjualan wajib diisi' });
    }

    const sale = await (prisma as any).warehouseSale.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!sale) return res.status(404).json({ error: 'Faktur penjualan tidak ditemukan' });
    if (sale.isVoided) return res.status(400).json({ error: 'Faktur penjualan ini sudah pernah dibatalkan' });

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Kembalikan stok ke Gudang Pusat
      for (const it of sale.items) {
        await tx.ingredient.update({
          where: { id: it.ingredientId },
          data: {
            warehouseStock: { increment: it.baseQty }
          }
        });

        await tx.ingredientLog.create({
          data: {
            ingredientId: it.ingredientId,
            change: it.baseQty,
            cost: it.subtotalCost,
            type: 'Void Penjualan B2B',
            referenceId: sale.invoiceNumber,
            description: `Void Penjualan B2B (${sale.invoiceNumber}): ${voidReason}`,
            userId
          }
        });
      }

      // 2. Tandai sale isVoided
      const updatedSale = await tx.warehouseSale.update({
        where: { id },
        data: {
          isVoided: true,
          voidReason: voidReason.trim(),
          voidedAt: new Date()
        }
      });

      // 3. Batalkan di OwnerFund jika sebelumnya terbayar
      if (sale.paymentStatus === 'PAID') {
        await tx.ownerFundTransaction.create({
          data: {
            type: 'VOID_B2B_SALES',
            amount: -sale.totalAmount,
            referenceType: 'WAREHOUSE_SALE_VOID',
            referenceId: sale.invoiceNumber,
            description: `Koreksi/Batal Penjualan B2B ${sale.invoiceNumber}: ${voidReason}`,
            userId,
            date: new Date()
          }
        });
      }

      return updatedSale;
    });

    if (io) {
      io.emit('warehouse:sale_voided', result);
      io.emit('warehouse:stock_updated', { type: 'SALE_B2B_VOIDED', invoiceNumber: sale.invoiceNumber });
    }

    res.json({
      message: `Faktur penjualan ${sale.invoiceNumber} berhasil dibatalkan dan stok dikembalikan`,
      sale: result
    });
  } catch (error: any) {
    console.error('Error voiding warehouse sale:', error);
    res.status(500).json({ error: 'Gagal membatalkan penjualan: ' + error.message });
  }
});

export default router;

