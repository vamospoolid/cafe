import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Buat PO number otomatis: PO-YYYYMMDD-XXX
const generatePoNumber = async (): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.purchaseOrder.count({
    where: { poNumber: { startsWith: `PO-${dateStr}` } }
  });
  return `PO-${dateStr}-${String(count + 1).padStart(3, '0')}`;
};

// GET all POs
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, supplierId } = req.query;
    const where: any = {};
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

// GET single PO detail
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: Number(id) },
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

// POST create PO baru
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { supplierId, notes, items } = req.body;
    // items: Array<{ productId?, ingredientId?, itemName, unit, qtyOrdered, unitPrice }>

    if (!supplierId) return res.status(400).json({ error: 'Supplier wajib dipilih' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'PO harus memiliki minimal 1 item' });

    const poNumber = await generatePoNumber();
    const totalAmount = items.reduce((sum: number, i: any) => sum + (Number(i.qtyOrdered) * Number(i.unitPrice)), 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: Number(supplierId),
        userId,
        notes,
        totalAmount,
        status: 'Draft',
        items: {
          create: items.map((item: any) => ({
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

// PUT update PO (hanya jika Draft)
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { supplierId, notes, items } = req.body;

    const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(id) } });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    if (po.status !== 'Draft') return res.status(400).json({ error: 'Hanya PO berstatus Draft yang dapat diubah' });

    const totalAmount = items
      ? items.reduce((sum: number, i: any) => sum + (Number(i.qtyOrdered) * Number(i.unitPrice)), 0)
      : po.totalAmount;

    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: Number(id) } });
        await tx.purchaseOrderItem.createMany({
          data: items.map((item: any) => ({
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

// PATCH send PO → status: Dikirim
router.patch('/:id/send', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(id) } });
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

// PATCH receive PO → proses penerimaan barang + update stok
router.patch('/:id/receive', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { receivedItems } = req.body;
    // receivedItems: Array<{ itemId: number, qtyReceived: number }>
    const userId = (req as any).user.id;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: Number(id) },
      include: { items: true }
    });
    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });
    if (po.status === 'Diterima' || po.status === 'Dibatalkan') {
      return res.status(400).json({ error: `PO berstatus ${po.status} tidak dapat diproses` });
    }

    // Cek mode inventaris
    const settings = await prisma.settings.findFirst();
    const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;

    const result = await prisma.$transaction(async (tx) => {
      let totalReceived = 0;
      let totalItems = po.items.length;

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

        // Update stok sesuai mode
        if (isAdvancedMode && poItem.ingredientId) {
          // Advanced Mode: naikkan stok bahan baku
          await tx.ingredient.update({
            where: { id: poItem.ingredientId },
            data: { stock: { increment: qty } }
          });
          await tx.ingredientLog.create({
            data: {
              ingredientId: poItem.ingredientId,
              change: qty,
              type: 'PO',
              description: `Penerimaan PO #${po.poNumber}`,
              referenceId: po.poNumber
            }
          });
        } else if (!isAdvancedMode && poItem.productId) {
          // Simple Mode: naikkan stok produk
          await tx.product.update({
            where: { id: poItem.productId },
            data: { stock: { increment: qty } }
          });
        }
        totalReceived++;
      }

      // Cek apakah semua item sudah diterima penuh
      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { poId: Number(id) } });
      const allFullyReceived = updatedItems.every(i => i.qtyReceived >= i.qtyOrdered);
      const anyReceived = updatedItems.some(i => i.qtyReceived > 0);

      const newStatus = allFullyReceived ? 'Diterima' : (anyReceived ? 'Diterima Sebagian' : po.status);

      // Catat pengeluaran kas jika sudah fully received
      if (allFullyReceived) {
        await tx.cashFlow.create({
          data: {
            type: 'Pengeluaran',
            category: 'Pembelian Stok',
            amount: po.totalAmount,
            description: `PO ${po.poNumber} dari ${(await tx.supplier.findUnique({ where: { id: po.supplierId } }))?.name}`,
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

// PATCH cancel PO
router.patch('/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(id) } });
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
