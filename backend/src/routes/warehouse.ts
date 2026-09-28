import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { io, emitToTenant } from '../index';
import { syncMenuSoldOutStatus } from './ingredients';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Router-level fail-closed guard: all warehouse operations require authentication & tenant context
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

function getTenantId(req: Request): string | undefined {
  const user = (req as AuthRequest).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || undefined;
}

function getOutletId(req: Request): string | undefined {
  const user = (req as AuthRequest).user;
  return user?.outletId || TenantContext.getOutletId() || (req.headers['x-outlet-id'] as string) || undefined;
}

// Helper generate Invoice/Req numbers
function generateDocNumber(prefix: string) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${dateStr}-${rand}`;
}

// ─── 1. DASHBOARD & STATS ──────────────────────────────────────────────────
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const tenantWhere = { tenantId };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    const isRetailOrBengkel = tenant?.businessType === 'RETAIL' || tenant?.businessType === 'BENGKEL';

    let totalAssetValue = 0;
    let lowStockCount = 0;
    let lowStockItems: any[] = [];
    let totalItems = 0;

    if (isRetailOrBengkel) {
      const products = await prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          stock: true,
          minStock: true,
          buyPrice: true,
          baseUom: true,
          category: { select: { name: true } }
        }
      });

      totalAssetValue = products.reduce((sum, item) => sum + (item.stock * (item.buyPrice || 0)), 0);
      lowStockItems = products
        .filter(item => item.minStock > 0 && item.stock <= item.minStock)
        .map(p => ({
          id: p.id,
          name: p.name,
          warehouseStock: p.stock,
          warehouseMinStock: p.minStock,
          unit: p.baseUom || 'Pcs',
          buyPrice: p.buyPrice,
          category: p.category?.name || (tenant?.businessType === 'BENGKEL' ? 'Suku Cadang' : 'Barang Dagangan')
        }));
      lowStockCount = lowStockItems.length;
      totalItems = products.length;
    } else {
      const ingredients = await prisma.ingredient.findMany({
        where: tenantWhere,
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

      totalAssetValue = ingredients.reduce((sum, item) => sum + (item.warehouseStock * item.buyPrice), 0);
      lowStockItems = ingredients.filter(item => item.warehouseMinStock > 0 && item.warehouseStock <= item.warehouseMinStock);
      lowStockCount = lowStockItems.length;
      totalItems = ingredients.length;
    }

    // Owner Finance Aggregations
    const ownerTxns = await prisma.ownerFundTransaction.findMany({
      where: tenantWhere
    });
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
      where: tenantWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { name: true } },
        items: {
          include: {
            ingredient: { select: { name: true, unit: true } },
            product: { select: { name: true, baseUom: true } }
          }
        }
      }
    });

    // Recent Inbounds
    const recentInbounds = await prisma.warehouseInbound.findMany({
      where: tenantWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { name: true } },
        items: {
          include: {
            ingredient: { select: { name: true, unit: true } },
            product: { select: { name: true, baseUom: true } }
          }
        }
      }
    });

    res.json({
      totalAssetValue,
      totalCapitalIn,
      totalTransferredToResto,
      totalReimbursedToOwner,
      currentOwnerPayable,
      lowStockCount,
      lowStockItems,
      totalIngredients: totalItems,
      recentTransfers,
      recentInbounds,
      businessType: tenant?.businessType || 'CAFE'
    });
  } catch (error: any) {
    console.error('Error fetching warehouse dashboard:', error);
    res.status(500).json({ error: 'Gagal memuat dashboard gudang: ' + error.message });
  }
});

// ─── 2. STOK GUDANG PUSAT ─────────────────────────────────────────────────
router.get('/stock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { category, search } = req.query;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    const isRetailOrBengkel = tenant?.businessType === 'RETAIL' || tenant?.businessType === 'BENGKEL';

    if (isRetailOrBengkel) {
      const where: any = { tenantId, deletedAt: null };
      if (category && typeof category === 'string' && category !== 'Semua') {
        where.category = { name: category };
      }
      if (search && typeof search === 'string') {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const products = await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } }
        }
      });

      const mapped = products.map(p => ({
        id: p.id,
        productId: p.id,
        name: p.name,
        category: p.category?.name || (tenant?.businessType === 'BENGKEL' ? 'Suku Cadang' : 'Barang Dagangan'),
        unit: p.baseUom || 'Pcs',
        purchaseUnit: p.baseUom || 'Pcs',
        conversionRatio: 1,
        warehouseStock: p.stock,
        warehouseMinStock: p.minStock,
        stock: p.stock,
        buyPrice: p.buyPrice,
        sellPrice: p.sellPrice,
        supplier: null,
        storageLocation: p.storageLocation || null,
        brand: p.brand || null,
        isProduct: true
      }));

      return res.json(mapped);
    }

    const where: any = { tenantId };
    if (category && typeof category === 'string' && category !== 'Semua') {
      where.category = category;
    }
    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
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

    const tenantId = getTenantId(req);
    const outletId = getOutletId(req);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    const isRetailOrBengkel = tenant?.businessType === 'RETAIL' || tenant?.businessType === 'BENGKEL';

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

      const isProduct = Boolean(it.productId || it.isProduct || isRetailOrBengkel);
      const itemId = Number(it.productId || it.ingredientId);
      const sellingPrice = Number(it.sellingPrice) || 0;

      // Validate tenant ownership if product
      if (isProduct && itemId) {
        const validProduct = await prisma.product.findFirst({
          where: { id: itemId, tenantId, deletedAt: null }
        });
        if (!validProduct) {
          return res.status(400).json({ error: `Barang dagangan #${itemId} tidak valid atau bukan milik toko Anda` });
        }
      }

      processedItems.push({
        tenantId,
        ingredientId: !isProduct ? itemId : null,
        productId: isProduct ? itemId : null,
        itemName: it.itemName || (isProduct ? 'Barang' : 'Bahan'),
        purchaseUnit: it.purchaseUnit || (isProduct ? 'Pcs' : 'Karton'),
        purchaseQty: pQty,
        conversionRatio: cRatio,
        baseQty,
        purchasePrice: pPrice,
        basePrice,
        subtotal,
        sellingPrice // Stored for product price sync in transaction
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada item dengan jumlah valid' });
    }

    // Nested Foreign Key Injection Prevention: Validate supplierId belongs to active tenant
    if (supplierId) {
      const validSupplier = await prisma.supplier.findFirst({
        where: { id: Number(supplierId), tenantId, deletedAt: null }
      });
      if (!validSupplier) {
        return res.status(400).json({ error: 'Supplier yang dipilih tidak valid, sudah dihapus, atau bukan milik outlet Anda' });
      }
    }

    // Database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Inbound record (Central Warehouse is scoped at tenant level)
      // Note: filter out sellingPrice from Prisma create payload
      const dbItemsPayload = processedItems.map(({ sellingPrice: _, ...dbItem }) => dbItem);

      const inbound = await tx.warehouseInbound.create({
        data: {
          tenantId,
          invoiceNumber,
          supplierId: supplierId ? Number(supplierId) : null,
          supplierName: supplierName || null,
          userId,
          totalAmount,
          paymentSource: paymentSource || 'DANA_PRIBADI_OWNER',
          notes,
          date: date ? new Date(date) : new Date(),
          items: {
            create: dbItemsPayload
          }
        },
        include: { items: true }
      });

      // 2. Update each ingredient / product stock and dynamic selling price
      for (const it of processedItems) {
        if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: {
              stock: { increment: Math.round(it.baseQty) },
              buyPrice: it.basePrice > 0 ? it.basePrice : undefined,
              sellPrice: it.sellingPrice > 0 ? it.sellingPrice : undefined // Update harga jual kasir POS langsung!
            }
          });
        } else if (it.ingredientId) {
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
      }

      // 3. Catat transaksi keuangan berdasarkan sumber dana
      const source = paymentSource || 'DANA_PRIBADI_OWNER';
      if (source === 'KASIR_PETTY_CASH' || source === 'KASIR') {
        const catName = tenant?.businessType === 'BENGKEL'
          ? 'Belanja Sparepart (Gudang)'
          : isRetailOrBengkel
          ? 'Kulakan & Stok Dagangan'
          : 'Belanja Bahan Baku (Gudang)';
        const descName = isRetailOrBengkel
          ? `Kulakan stok barang masuk gudang (${processedItems.length} item - ${invoiceNumber})`
          : `Belanja bahan masuk gudang (${processedItems.length} item - ${invoiceNumber})`;

        // Potong kas kecil / laci kasir
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId,
            type: 'Pengeluaran',
            category: catName,
            amount: totalAmount,
            description: descName,
            userId,
            date: date ? new Date(date) : new Date()
          }
        });
      } else {
        // Modal Owner / Transfer Bank (Tidak memotong laci kasir)
        await tx.ownerFundTransaction.create({
          data: {
            tenantId,
            type: 'CAPITAL_IN',
            amount: totalAmount,
            referenceType: 'INBOUND',
            referenceId: invoiceNumber,
            description: isRetailOrBengkel
              ? `Penerimaan pasokan barang kulakan via dana owner/bank (${processedItems.length} item - ${invoiceNumber})`
              : `Penerimaan pasokan gudang via dana owner/bank (${processedItems.length} item - ${invoiceNumber})`,
            userId,
            date: date ? new Date(date) : new Date()
          }
        });
      }

      return inbound;
    });

    if (tenantId) {
      emitToTenant(tenantId, 'warehouse:stock_updated', { type: 'INBOUND', invoiceNumber });
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
    const tenantId = getTenantId(req);
    const inbounds = await prisma.warehouseInbound.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
        items: {
          include: {
            ingredient: { select: { name: true, unit: true } },
            product: { select: { name: true, baseUom: true } }
          }
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
    const tenantId = getTenantId(req);

    if (!voidReason || !voidReason.trim()) {
      return res.status(400).json({ error: 'Alasan pembatalan wajib diisi untuk keperluan audit.' });
    }

    const inbound = await prisma.warehouseInbound.findFirst({
      where: { id: inboundId, tenantId },
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
        if (it.productId) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: Math.round(it.baseQty) } }
          });
        } else if (it.ingredientId) {
          await tx.ingredient.update({
            where: { id: it.ingredientId },
            data: { warehouseStock: { decrement: it.baseQty } }
          });
        }
      }

      // 3. Reverse ledger modal pusat jika sumber dana adalah Modal Pusat
      if (inbound.paymentSource === 'DANA_PRIBADI_OWNER') {
        await tx.ownerFundTransaction.create({
          data: {
            tenantId,
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

    const targetTenantId = inbound.tenantId || tenantId;
    if (targetTenantId) emitToTenant(targetTenantId, 'warehouse:stock_updated', { type: 'VOID_INBOUND', invoiceNumber: inbound.invoiceNumber });

    res.json({ message: `Penerimaan ${inbound.invoiceNumber} berhasil dibatalkan. Stok sudah dikembalikan.` });
  } catch (error: any) {
    console.error('Error voiding inbound:', error);
    res.status(500).json({ error: 'Gagal membatalkan penerimaan: ' + error.message });
  }
});

// ─── 4. STOCK OPNAME GUDANG PUSAT ─────────────────────────────────────────

router.post('/opname', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ingredientId, productId, actualStock, reason, notes } = req.body;
    const userId = (req as any).user.id;
    const tenantId = getTenantId(req);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    const isRetailOrBengkel = tenant?.businessType === 'RETAIL' || tenant?.businessType === 'BENGKEL';
    const isProd = Boolean(productId || (isRetailOrBengkel && ingredientId));
    const targetId = Number(productId || ingredientId);

    if (!targetId || actualStock === undefined) {
      return res.status(400).json({ error: 'ID Item dan Stok Fisik wajib diisi' });
    }

    if (isProd) {
      const prod = await prisma.product.findFirst({ where: { id: targetId, tenantId, deletedAt: null } });
      if (!prod) return res.status(404).json({ error: 'Produk tidak ditemukan' });

      const diff = Number(actualStock) - prod.stock;
      const updated = await prisma.product.update({
        where: { id: targetId },
        data: { stock: Math.round(Number(actualStock)) }
      });

      if (tenantId) {
        emitToTenant(tenantId, 'warehouse:stock_updated', { type: 'OPNAME', productId: prod.id });
      }

      return res.json({
        message: 'Stok fisik produk berhasil disesuaikan',
        difference: diff,
        product: updated
      });
    }

    const ing = await prisma.ingredient.findFirst({ where: { id: targetId, tenantId } });
    if (!ing) return res.status(404).json({ error: 'Bahan baku tidak ditemukan' });

    const diff = Number(actualStock) - ing.warehouseStock;

    const updated = await prisma.ingredient.update({
      where: { id: targetId },
      data: { warehouseStock: Number(actualStock) }
    });

    if (tenantId) {
      emitToTenant(tenantId, 'warehouse:stock_updated', { type: 'OPNAME', ingredientId: ing.id });
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
    const tenantId = getTenantId(req);
    const transfers = await prisma.warehouseRequisition.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
        items: {
          include: {
            ingredient: { select: { name: true, unit: true, purchaseUnit: true, conversionRatio: true } },
            product: { select: { name: true, baseUom: true } }
          }
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

    const tenantId = getTenantId(req);
    const outletId = getOutletId(req);

    // Get settings for transfer pricing
    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const pricingMode = settings?.warehouseTransferPricing || 'AT_COST';
    const markupPercent = Number(settings?.warehouseMarkupPercent) || 0;

    const reqNumber = generateDocNumber('REQ');
    let totalTransferCost = 0;
    const processedItems: any[] = [];

    for (const it of items) {
      const ing = await prisma.ingredient.findFirst({ where: { id: Number(it.ingredientId), tenantId } });
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
        tenantId,
        outletId,
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

    if (tenantId) {
      emitToTenant(tenantId, 'warehouse:transfer_created', requisition);
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

// ─── 5b. DISTRIBUSI LANGSUNG (1-KLIK) GUDANG KE DAPUR ─────────────────────
// Langsung potong stok gudang, tambah stok dapur, dan hitung nilai uang HPP pemakaian
router.post('/quick-distribute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { notes, items, targetCategory } = req.body;
    const userId = (req as any).user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar item yang didistribusikan wajib diisi' });
    }

    const reqNumber = generateDocNumber('DIST');
    let totalTransferCost = 0;
    const processedItems: any[] = [];

    const tenantId = getTenantId(req);
    const outletId = getOutletId(req);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    const isRetailOrBengkel = tenant?.businessType === 'RETAIL' || tenant?.businessType === 'BENGKEL';

    // Validasi & Siapkan data (Scoped to active tenant)
    for (const it of items) {
      const isProduct = Boolean(it.productId || it.isProduct || isRetailOrBengkel);
      const itemId = Number(it.productId || it.ingredientId);
      const rQty = Number(it.requestedQty) || 0;
      if (rQty <= 0) continue;

      if (isProduct) {
        const prod = await prisma.product.findFirst({
          where: { id: itemId, tenantId, deletedAt: null }
        });
        if (!prod) continue;

        const baseQty = rQty;
        if (prod.stock < baseQty) {
          return res.status(400).json({
            error: `Stok gudang untuk "${prod.name}" tidak mencukupi. Tersedia: ${prod.stock} ${prod.baseUom || 'Pcs'}, diminta: ${baseQty} ${prod.baseUom || 'Pcs'}`
          });
        }

        const transferPrice = prod.buyPrice || 0;
        const subtotal = baseQty * transferPrice;
        totalTransferCost += subtotal;

        processedItems.push({
          productId: prod.id,
          ingredientId: null,
          itemName: prod.name,
          requestedUnit: it.requestedUnit || prod.baseUom || 'Pcs',
          requestedQty: rQty,
          baseQty,
          transferPrice,
          subtotal,
          isProduct: true
        });
      } else {
        const ing = await prisma.ingredient.findFirst({
          where: { id: itemId, tenantId, deletedAt: null }
        });
        if (!ing) continue;

        const isPurchaseUnit = it.requestedUnit === ing.purchaseUnit && (ing.conversionRatio || 1) > 0;
        const baseQty = isPurchaseUnit ? (rQty * (ing.conversionRatio || 1)) : rQty;

        if (ing.warehouseStock < baseQty) {
          return res.status(400).json({
            error: `Stok gudang untuk "${ing.name}" tidak mencukupi. Tersedia di gudang: ${ing.warehouseStock} ${ing.unit}, diminta: ${baseQty} ${ing.unit}`
          });
        }

        const transferPrice = ing.buyPrice || 0;
        const subtotal = baseQty * transferPrice;
        totalTransferCost += subtotal;

        processedItems.push({
          ingredientId: ing.id,
          productId: null,
          itemName: ing.name,
          requestedUnit: it.requestedUnit || ing.unit,
          requestedQty: rQty,
          baseQty,
          transferPrice,
          subtotal,
          isProduct: false
        });
      }
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada item dengan jumlah valid untuk didistribusikan' });
    }

    // Eksekusi transaksi atomik
    const defaultNotes = isRetailOrBengkel
      ? (tenant?.businessType === 'BENGKEL' ? 'Keluarkan sparepart ke pit servis' : 'Pindah stok ke rak display / etalase kasir')
      : 'Distribusi langsung dari Gudang ke Dapur/Bar';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat dokumen distribusi dengan status langsung RECEIVED
      const requisition = await tx.warehouseRequisition.create({
        data: {
          tenantId,
          outletId,
          reqNumber,
          requestedById: userId,
          approvedById: userId,
          status: 'RECEIVED',
          totalTransferCost,
          notes: notes || defaultNotes,
          requestedAt: new Date(),
          approvedAt: new Date(),
          receivedAt: new Date(),
          items: {
            create: processedItems.map(p => ({
              tenantId,
              ingredientId: p.ingredientId,
              productId: p.productId,
              itemName: p.itemName,
              requestedUnit: p.requestedUnit,
              requestedQty: p.requestedQty,
              baseQty: p.baseQty,
              transferPrice: p.transferPrice,
              subtotal: p.subtotal
            }))
          }
        },
        include: {
          requestedBy: { select: { name: true } },
          items: true
        }
      });

      // 2. Update stok
      for (const it of processedItems) {
        if (it.isProduct && it.productId) {
          // Untuk Retail/Bengkel: stok tetap di toko atau dipindahkan ke etalase kasir
          // Jika diperlukan update storageLocation atau catatan
        } else if (it.ingredientId) {
          const affected = await tx.$executeRaw`
            UPDATE "Ingredient"
            SET "warehouseStock" = "warehouseStock" - ${it.baseQty},
                "stock" = "stock" + ${it.baseQty}
            WHERE "id" = ${it.ingredientId} AND "warehouseStock" >= ${it.baseQty}
          `;

          if (affected === 0) {
            const ing = await tx.ingredient.findFirst({ where: { id: it.ingredientId, tenantId } });
            throw new Error(`Stok gudang untuk "${it.itemName}" tidak mencukupi saat proses distribusi (Tersisa: ${ing?.warehouseStock ?? 0} ${ing?.unit || ''}, diminta: ${it.baseQty} ${ing?.unit || ''}).`);
          }

          const ing = await tx.ingredient.findFirst({ where: { id: it.ingredientId, tenantId } });

          // 3. Catat log mutasi dapur
          await tx.ingredientLog.create({
            data: {
              tenantId,
              outletId,
              ingredientId: it.ingredientId,
              change: it.baseQty,
              cost: it.subtotal,
              type: 'Distribusi',
              referenceId: reqNumber,
              description: `Distribusi Gudang ➔ ${targetCategory || 'Dapur'}: ${it.requestedQty} ${it.requestedUnit} (${it.baseQty} ${ing?.unit || ''})`,
              userId
            }
          });
        }
      }

      // 4. Catat transaksi modal pusat / transfer biaya
      const targetName = isRetailOrBengkel
        ? (tenant?.businessType === 'BENGKEL' ? 'Pit Servis Mekanik' : 'Rak Display Kasir')
        : 'Dapur/Bar';

      await tx.ownerFundTransaction.create({
        data: {
          tenantId,
          type: 'TRANSFER_TO_RESTO',
          amount: totalTransferCost,
          referenceType: 'REQUISITION',
          referenceId: reqNumber,
          description: `Distribusi barang ke ${targetName} (${processedItems.length} item - ${reqNumber})`,
          userId,
          date: new Date()
        }
      });

      return requisition;
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    // Sinkronisasi status menu sold out jika ada Kafe
    if (!isRetailOrBengkel) {
      await syncMenuSoldOutStatus();
    }

    if (tenantId) {
      emitToTenant(tenantId, 'warehouse:stock_updated', { type: 'QUICK_DISTRIBUTE', reqNumber });
    }

    const successMsg = isRetailOrBengkel
      ? (tenant?.businessType === 'BENGKEL' ? `Pengeluaran ${processedItems.length} part ke pit servis berhasil!` : `Pindah stok ${processedItems.length} barang ke rak display berhasil!`)
      : `Distribusi ${processedItems.length} bahan ke dapur berhasil diselesaikan!`;

    res.status(201).json({
      message: successMsg,
      requisition: result
    });
  } catch (error: any) {
    console.error('Error during quick distribute:', error);
    res.status(500).json({ error: 'Gagal mendistribusikan bahan ke dapur: ' + error.message });
  }
});

// ─── 5c. LAPORAN PEMAKAIAN / DISTRIBUSI DAPUR ─────────────────────────────
router.get('/kitchen-usage-report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { startDate, endDate } = req.query;

    const where: any = {
      status: 'RECEIVED',
      tenantId
    };

    if (startDate && endDate) {
      where.receivedAt = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const requisitions = await prisma.warehouseRequisition.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            ingredient: { select: { name: true, category: true, unit: true } }
          }
        }
      }
    });

    const totalCost = requisitions.reduce((sum, r) => sum + (r.totalTransferCost || 0), 0);

    // Grouping by category
    const categoryTotals: Record<string, number> = { FOOD: 0, DRINK: 0, PACKAGING: 0, OTHER: 0 };
    for (const r of requisitions) {
      for (const it of r.items) {
        const cat = it.ingredient?.category || 'OTHER';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (it.subtotal || 0);
      }
    }

    res.json({
      totalCost,
      totalDistributions: requisitions.length,
      categoryTotals,
      requisitions
    });
  } catch (error: any) {
    console.error('Error fetching kitchen usage report:', error);
    res.status(500).json({ error: 'Gagal mengambil laporan pemakaian dapur' });
  }
});

// Approve transfer request by Warehouse staff / Admin
router.put('/transfers/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = (req as any).user.id;
    const tenantId = getTenantId(req);

    const reqDoc = await prisma.warehouseRequisition.findFirst({
      where: { id, tenantId },
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

    const targetTenantId = updated.tenantId || tenantId;
    if (targetTenantId) {
      emitToTenant(targetTenantId, 'warehouse:transfer_approved', updated);
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
    const tenantId = getTenantId(req);

    const reqDoc = await prisma.warehouseRequisition.findFirst({
      where: { id, tenantId },
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

    const targetTenantId = updated.tenantId || tenantId;
    if (targetTenantId) {
      emitToTenant(targetTenantId, 'warehouse:transfer_cancelled', updated);
      emitToTenant(targetTenantId, 'warehouse:stock_updated', { type: 'TRANSFER_CANCELLED', reqNumber: reqDoc.reqNumber });
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
    const tenantId = getTenantId(req);

    const reqDoc = await prisma.warehouseRequisition.findFirst({
      where: { id, tenantId },
      include: { items: true }
    });

    if (!reqDoc) return res.status(404).json({ error: 'Dokumen permintaan tidak ditemukan' });
    if (reqDoc.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Barang sudah pernah diterima sebelumnya' });
    }

    // Execute atomic transfer transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update each ingredient: decrease warehouseStock, increase kitchen stock dengan Atomic Guard
      for (const it of reqDoc.items) {
        if (it.ingredientId) {
          const ingId = it.ingredientId;
          const affected = await tx.$executeRaw`
            UPDATE "Ingredient"
            SET "warehouseStock" = "warehouseStock" - ${it.baseQty},
                "stock" = "stock" + ${it.baseQty}
            WHERE "id" = ${ingId} AND "warehouseStock" >= ${it.baseQty}
          `;

          if (affected === 0) {
            const ing = await tx.ingredient.findFirst({ where: { id: ingId, tenantId } });
            throw new Error(`Stok gudang pusat untuk "${it.itemName}" tidak mencukupi untuk disalurkan ke dapur (Tersisa: ${ing?.warehouseStock ?? 0} ${ing?.unit || ''}, diminta: ${it.baseQty} ${ing?.unit || ''}).`);
          }

          const ing = await tx.ingredient.findFirst({ where: { id: ingId, tenantId } });

          // Catat mutasi log dapur Muki Ramen
          await tx.ingredientLog.create({
            data: {
              tenantId,
              outletId: reqDoc.outletId,
              ingredientId: ingId,
              change: it.baseQty,
              cost: it.subtotal,
              type: 'Distribusi',
              referenceId: reqDoc.reqNumber,
              description: `Terima dari Gudang Pusat: ${it.requestedQty} ${it.requestedUnit} (${it.baseQty} ${ing?.unit || ''})`,
              userId
            }
          });
        }
      }

      // 2. Catat ke Rekonsiliasi Settlement Modal Pusat: Distribusi Bahan ke Unit Operasional
      await tx.ownerFundTransaction.create({
        data: {
          tenantId,
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
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    // Sinkronisasi menu sold-out realtime
    await syncMenuSoldOutStatus();

    const targetTenantId = result.tenantId || tenantId;
    if (targetTenantId) {
      emitToTenant(targetTenantId, 'warehouse:stock_updated', { type: 'TRANSFER_RECEIVED', reqNumber: reqDoc.reqNumber });
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
    const tenantId = getTenantId(req);
    const transactions = await prisma.ownerFundTransaction.findMany({
      where: { tenantId },
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
    const tenantId = getTenantId(req);
    const outletId = getOutletId(req);
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
          tenantId,
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
            tenantId,
            outletId,
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

    if (tenantId) {
      emitToTenant(tenantId, 'warehouse:owner_reimbursed', result);
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
    const tenantId = getTenantId(req);
    const sales = await (prisma as any).warehouseSale.findMany({
      where: { tenantId },
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
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const sale = await (prisma as any).warehouseSale.findFirst({
      where: { id, tenantId },
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

    const tenantId = getTenantId(req);
    const grossProfit = totalAmount - totalHppCost;

    // Atomic transaction
    const saleResult = await prisma.$transaction(async (tx: any) => {
      // 1. Create WarehouseSale
      const createdSale = await tx.warehouseSale.create({
        data: {
          tenantId,
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

      // 2. Decrement warehouse stock dengan Atomic Guard & write IngredientLog
      for (const it of processedItems) {
        const affected = await tx.$executeRaw`
          UPDATE "Ingredient"
          SET "warehouseStock" = "warehouseStock" - ${it.baseQty}
          WHERE "id" = ${it.ingredientId} AND "warehouseStock" >= ${it.baseQty}
        `;

        if (affected === 0) {
          const ing = await tx.ingredient.findFirst({ where: { id: it.ingredientId, tenantId } });
          throw new Error(`Stok gudang untuk "${it.itemName}" tidak mencukupi untuk transaksi B2B (Tersisa: ${ing?.warehouseStock ?? 0}, diminta: ${it.baseQty}).`);
        }

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
            tenantId,
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
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    if (tenantId) {
      emitToTenant(tenantId, 'warehouse:sale_created', saleResult);
      emitToTenant(tenantId, 'warehouse:stock_updated', { type: 'SALE_B2B', invoiceNumber });
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
    const tenantId = getTenantId(req);

    if (!voidReason || !voidReason.trim()) {
      return res.status(400).json({ error: 'Alasan pembatalan penjualan wajib diisi' });
    }

    const sale = await (prisma as any).warehouseSale.findFirst({
      where: { id, tenantId },
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

    const targetTenantId = result.tenantId || tenantId;
    if (targetTenantId) {
      emitToTenant(targetTenantId, 'warehouse:sale_voided', result);
      emitToTenant(targetTenantId, 'warehouse:stock_updated', { type: 'SALE_B2B_VOIDED', invoiceNumber: sale.invoiceNumber });
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

