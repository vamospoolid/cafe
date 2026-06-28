import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET all ingredients
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data bahan baku' });
  }
});

// GET low-stock ingredients (stok <= minStock)
router.get('/low-stock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      where: { stock: { lte: prisma.ingredient.fields.minStock } },
      orderBy: { stock: 'asc' }
    });
    // Prisma doesn't support column comparison directly, filter in JS
    const all = await prisma.ingredient.findMany({ orderBy: { stock: 'asc' } });
    const lowStock = all.filter(i => i.stock <= i.minStock);
    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data stok menipis' });
  }
});

// POST create ingredient
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, unit, stock, minStock, buyPrice, supplierId } = req.body;
    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        buyPrice: Number(buyPrice) || 0,
        supplierId: supplierId ? Number(supplierId) : null
      },
      include: { supplier: { select: { id: true, name: true } } }
    });
    res.status(201).json(ingredient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat bahan baku' });
  }
});

// PUT update ingredient
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, unit, stock, minStock, buyPrice, supplierId } = req.body;
    const ingredient = await prisma.ingredient.update({
      where: { id: Number(id) },
      data: {
        name,
        unit,
        stock: stock !== undefined ? Number(stock) : undefined,
        minStock: minStock !== undefined ? Number(minStock) : undefined,
        buyPrice: buyPrice !== undefined ? Number(buyPrice) : undefined,
        supplierId: supplierId !== undefined ? (supplierId ? Number(supplierId) : null) : undefined
      },
      include: { supplier: { select: { id: true, name: true } } }
    });
    res.json(ingredient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui bahan baku' });
  }
});

// DELETE ingredient (hanya jika tidak ada resep aktif)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipeCount = await prisma.recipeItem.count({ where: { ingredientId: Number(id) } });
    if (recipeCount > 0) {
      return res.status(400).json({ error: 'Bahan baku ini masih digunakan dalam resep menu. Hapus resep terkait terlebih dahulu.' });
    }
    await prisma.ingredient.delete({ where: { id: Number(id) } });
    res.json({ message: 'Bahan baku berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus bahan baku' });
  }
});

// POST restock / adjust stok bahan baku
router.post('/:id/adjust', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { change, type, description } = req.body;
    // type: 'Restock' | 'Penyesuaian' | 'Rusak'
    const amount = Number(change);
    if (isNaN(amount) || amount === 0) {
      return res.status(400).json({ error: 'Jumlah perubahan stok tidak valid' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.update({
        where: { id: Number(id) },
        data: { stock: { increment: amount } }
      });
      await tx.ingredientLog.create({
        data: {
          ingredientId: Number(id),
          change: amount,
          type: type || 'Penyesuaian',
          description: description || null
        }
      });
      return ingredient;
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menyesuaikan stok bahan baku' });
  }
});

// GET ingredient stock logs
router.get('/:id/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const logs = await prisma.ingredientLog.findMany({
      where: { ingredientId: Number(id) },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil riwayat stok' });
  }
});

export default router;
