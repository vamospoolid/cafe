import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET all suppliers
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { purchaseOrders: true, ingredients: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data supplier' });
  }
});

// GET single supplier + PO history
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id: Number(id) },
      include: {
        ingredients: { select: { id: true, name: true, unit: true } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, poNumber: true, status: true, totalAmount: true, orderedAt: true }
        }
      }
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil detail supplier' });
  }
});

// POST create supplier
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, contact, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama supplier wajib diisi' });

    const supplier = await prisma.supplier.create({
      data: { name, contact, phone, email, address, notes }
    });
    res.status(201).json(supplier);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat supplier' });
  }
});

// PUT update supplier
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contact, phone, email, address, notes } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: { name, contact, phone, email, address, notes }
    });
    res.json(supplier);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui supplier' });
  }
});

// DELETE supplier
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: Number(id) } });
    if (poCount > 0) {
      return res.status(400).json({ error: 'Supplier masih memiliki riwayat Purchase Order dan tidak dapat dihapus.' });
    }
    await prisma.supplier.delete({ where: { id: Number(id) } });
    res.json({ message: 'Supplier berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus supplier' });
  }
});

export default router;
