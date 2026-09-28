import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Router-level fail-closed guard: all purchase order operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const user = (req as AuthRequest).user;
  const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context tidak tersedia. Silakan login ulang.', 
      code: 'MISSING_TENANT_CONTEXT' 
    });
  }
  next();
});

export const generatePoNumber = async (tenantId?: string): Promise<string> => {
  if (!tenantId) {
    throw new Error('MISSING_TENANT_ID: generatePoNumber requires valid tenantId');
  }
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.purchaseOrder.count({
    where: {
      poNumber: { startsWith: `PO-${dateStr}` },
      tenantId
    }
  });
  return `PO-${dateStr}-${String(count + 1).padStart(3, '0')}`;
};

// GET all POs - Terisolasi per Tenant
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, supplierId } = req.query;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const where: any = { tenantId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = Number(supplierId);

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        user: { select: { name: true } },
        _count: { select: { items: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pos);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data Purchase Order' });
  }
});

// GET single PO detail - Terisolasi per Tenant
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: Number(id),
        tenantId
      },
      include: {
        supplier: true,
        user: { select: { name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
            ingredient: { select: { id: true, name: true, unit: true } }
          }
        }
      }
    });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    res.json(po);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil detail PO' });
  }
});

// POST create PO baru - Terisolasi per Tenant & Outlet
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;
    const { supplierId, notes, items } = req.body;
    // items: Array<{ productId?, ingredientId?, itemName, unit, qtyOrdered, unitPrice }>

    if (!supplierId) return res.status(400).json({ error: 'Supplier wajib dipilih' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'PO harus memiliki minimal 1 item' });

    // Validate supplier belongs to active tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: Number(supplierId), tenantId }
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier tidak ditemukan atau bukan milik tenant ini' });

    // Validate nested items belong to active tenant
    const productIds = items.filter((i: any) => i.productId).map((i: any) => Number(i.productId));
    if (productIds.length > 0) {
      const validProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, tenantId }
      });
      if (validProducts.length !== new Set(productIds).size) {
        return res.status(400).json({ error: 'Satu atau lebih produk tidak ditemukan atau bukan milik tenant ini' });
      }
    }

    const ingredientIds = items.filter((i: any) => i.ingredientId).map((i: any) => Number(i.ingredientId));
    if (ingredientIds.length > 0) {
      const validIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId }
      });
      if (validIngredients.length !== new Set(ingredientIds).size) {
        return res.status(400).json({ error: 'Satu atau lebih bahan baku tidak ditemukan atau bukan milik tenant ini' });
      }
    }

    const poNumber = await generatePoNumber(tenantId);
    const totalAmount = items.reduce((sum: number, i: any) => sum + (Number(i.qtyOrdered) * Number(i.unitPrice)), 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        outletId,
        poNumber,
        supplierId: Number(supplierId),
        userId,
        notes,
        totalAmount,
        status: 'Draft',
        items: {
          create: items.map((item: any) => ({
            tenantId,
            productId: item.productId ? Number(item.productId) : null,
            ingredientId: item.ingredientId ? Number(item.ingredientId) : null,
            itemName: item.itemName,
            unit: item.unit,
            qtyOrdered: Number(item.qtyOrdered),
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.qtyOrdered) * Number(item.unitPrice)
          }))
        }
      },
      include: { supplier: true, items: true }
    });
    res.status(201).json(po);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat Purchase Order' });
  }
});

// PUT update PO (hanya jika Draft) - Terisolasi per Tenant
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { supplierId, notes, items } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: Number(id),
        tenantId
      }
    });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    if (po.status !== 'Draft') return res.status(400).json({ error: 'Hanya PO berstatus Draft yang dapat diubah' });

    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: Number(supplierId), tenantId }
      });
      if (!supplier) return res.status(404).json({ error: 'Supplier tidak ditemukan atau bukan milik tenant ini' });
    }

    if (items) {
      const productIds = items.filter((i: any) => i.productId).map((i: any) => Number(i.productId));
      if (productIds.length > 0) {
        const validProducts = await prisma.product.findMany({
          where: { id: { in: productIds }, tenantId }
        });
        if (validProducts.length !== new Set(productIds).size) {
          return res.status(400).json({ error: 'Satu atau lebih produk tidak ditemukan atau bukan milik tenant ini' });
        }
      }

      const ingredientIds = items.filter((i: any) => i.ingredientId).map((i: any) => Number(i.ingredientId));
      if (ingredientIds.length > 0) {
        const validIngredients = await prisma.ingredient.findMany({
          where: { id: { in: ingredientIds }, tenantId }
        });
        if (validIngredients.length !== new Set(ingredientIds).size) {
          return res.status(400).json({ error: 'Satu atau lebih bahan baku tidak ditemukan atau bukan milik tenant ini' });
        }
      }
    }

    const totalAmount = items
      ? items.reduce((sum: number, i: any) => sum + (Number(i.qtyOrdered) * Number(i.unitPrice)), 0)
      : po.totalAmount;

    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: Number(id) } });
        await tx.purchaseOrderItem.createMany({
          data: items.map((item: any) => ({
            tenantId,
            poId: Number(id),
            productId: item.productId ? Number(item.productId) : null,
            ingredientId: item.ingredientId ? Number(item.ingredientId) : null,
            itemName: item.itemName,
            unit: item.unit,
            qtyOrdered: Number(item.qtyOrdered),
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.qtyOrdered) * Number(item.unitPrice)
          }))
        });
      }
      return tx.purchaseOrder.update({
        where: { id: Number(id) },
        data: { supplierId: supplierId ? Number(supplierId) : undefined, notes, totalAmount },
        include: { supplier: true, items: true }
      });
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui PO' });
  }
});

// PATCH send PO → status: Dikirim - Terisolasi per Tenant
router.patch('/:id/send', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: Number(id),
        tenantId
      }
    });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    if (po.status !== 'Draft') return res.status(400).json({ error: 'Hanya PO Draft yang bisa dikirim' });

    const updated = await prisma.purchaseOrder.update({
      where: { id: Number(id) },
      data: { status: 'Dikirim', orderedAt: new Date() }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengubah status PO' });
  }
});

// PATCH receive PO → proses penerimaan barang + update stok bahan/produk + pengeluaran kas proporsional
router.patch('/:id/receive', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { receivedItems, paymentSource = 'BANK_TRANSFER' } = req.body;
    // receivedItems: Array<{ itemId: number, qtyReceived: number }>
    // paymentSource: 'CASH_DRAWER' | 'BANK_TRANSFER' | 'SUPPLIER_CREDIT'
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: Number(id),
        tenantId
      },
      include: { items: true, supplier: true }
    });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    if (po.status === 'Diterima' || po.status === 'Dibatalkan') {
      return res.status(400).json({ error: `PO berstatus ${po.status} tidak dapat diproses` });
    }

    const result = await prisma.$transaction(async (tx) => {
      let batchExpense = 0;

      for (const recv of (receivedItems as any[])) {
        const poItem = po.items.find(i => i.id === recv.itemId);
        if (!poItem) continue;

        const qty = Number(recv.qtyReceived);
        if (qty <= 0) continue;

        // Update qtyReceived di PO item
        await tx.purchaseOrderItem.update({
          where: { id: recv.itemId },
          data: { qtyReceived: { increment: qty } }
        });

        // 1. Jika PO Item memiliki ingredientId (Bahan Baku):
        // Naikkan stok Ingredient & update buyPrice secara dinamis menggunakan Weighted Moving Average
        if (poItem.ingredientId) {
          const currentIng = await tx.ingredient.findUnique({ where: { id: poItem.ingredientId } });
          const oldStock = Math.max(0, currentIng?.stock || 0);
          const oldPrice = currentIng?.buyPrice || 0;
          const newQty = qty;
          const newPrice = poItem.unitPrice;
          const weightedPrice = (oldStock + newQty > 0)
            ? Math.round(((oldStock * oldPrice) + (newQty * newPrice)) / (oldStock + newQty))
            : newPrice;

          await tx.ingredient.update({
            where: { id: poItem.ingredientId },
            data: { 
              stock: { increment: qty },
              buyPrice: weightedPrice
            }
          });

          await tx.ingredientLog.create({
            data: {
              tenantId: po.tenantId || tenantId,
              outletId: po.outletId || outletId,
              ingredientId: poItem.ingredientId,
              change: qty,
              cost: Math.round(qty * poItem.unitPrice),
              type: 'PO',
              description: `Penerimaan PO #${po.poNumber} (${poItem.itemName}) [HPP: Rp ${oldPrice.toLocaleString('id-ID')} -> Rp ${weightedPrice.toLocaleString('id-ID')}]`,
              referenceId: po.poNumber,
              userId
            }
          });
        }

        // 2. Jika PO Item memiliki productId (Barang Retail Jadi):
        // Naikkan stok Product & update buyPrice secara dinamis menggunakan Weighted Moving Average
        if (poItem.productId) {
          const currentProd = await tx.product.findUnique({ where: { id: poItem.productId } });
          const oldStock = Math.max(0, currentProd?.stock || 0);
          const oldPrice = currentProd?.buyPrice || 0;
          const newQty = qty;
          const newPrice = poItem.unitPrice;
          const weightedPrice = (oldStock + newQty > 0)
            ? Math.round(((oldStock * oldPrice) + (newQty * newPrice)) / (oldStock + newQty))
            : newPrice;

          await tx.product.update({
            where: { id: poItem.productId },
            data: { 
              stock: { increment: qty },
              buyPrice: weightedPrice
            }
          });
        }

        batchExpense += (qty * poItem.unitPrice);
      }

      // Cek status penerimaan keseluruhan PO
      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { poId: Number(id) } });
      const allFullyReceived = updatedItems.every(i => i.qtyReceived >= i.qtyOrdered);
      const anyReceived = updatedItems.some(i => i.qtyReceived > 0);

      const newStatus = allFullyReceived ? 'Diterima' : (anyReceived ? 'Diterima Sebagian' : po.status);

      // Catat pengeluaran kas proporsional sesuai nominal barang yang nyata-nyata diterima pada batch ini
      if (batchExpense > 0) {
        const supplierName = po.supplier?.name || 'Supplier';
        let categoryExpense = 'Pembelian Stok - Bank';
        let sourceLabel = 'Transfer Bank Kantor';

        if (paymentSource === 'CASH_DRAWER') {
          categoryExpense = 'Pembelian Stok - Kasir';
          sourceLabel = 'Kas Laci Kasir (Petty Cash)';
        } else if (paymentSource === 'SUPPLIER_CREDIT') {
          categoryExpense = 'Pembelian Stok - Tempo';
          sourceLabel = 'Hutang Tempo Supplier';
        }

        await tx.cashFlow.create({
          data: {
            tenantId: po.tenantId || tenantId,
            outletId: po.outletId || outletId,
            type: 'Pengeluaran',
            category: categoryExpense,
            amount: batchExpense,
            description: `Belanja PO #${po.poNumber} (${supplierName}) - [${sourceLabel}] ${allFullyReceived ? 'Penuh' : 'Bertahap'}`,
            userId
          }
        });
      }

      return tx.purchaseOrder.update({
        where: { id: Number(id) },
        data: {
          status: newStatus,
          receivedAt: allFullyReceived ? new Date() : undefined
        },
        include: { supplier: true, items: true }
      });
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memproses penerimaan barang' });
  }
});

// PATCH cancel PO - Terisolasi per Tenant
router.patch('/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: Number(id),
        tenantId
      }
    });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    if (!['Draft', 'Dikirim'].includes(po.status)) {
      return res.status(400).json({ error: 'Hanya PO Draft atau Dikirim yang dapat dibatalkan' });
    }
    const updated = await prisma.purchaseOrder.update({
      where: { id: Number(id) },
      data: { status: 'Dibatalkan' }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Gagal membatalkan PO' });
  }
});

export default router;
