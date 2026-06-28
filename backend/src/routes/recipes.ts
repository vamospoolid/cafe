import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET resep untuk satu produk (beserta kalkulasi HPP)
router.get('/product/:productId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const recipes = await prisma.recipeItem.findMany({
      where: { productId: Number(productId) },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, buyPrice: true, stock: true }
        }
      }
    });

    // Kalkulasi HPP otomatis dari resep
    const hppOtomatis = recipes.reduce((sum, r) => {
      return sum + (r.ingredient.buyPrice * r.qtyPerServing);
    }, 0);

    res.json({ recipes, hppOtomatis });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil resep produk' });
  }
});

// PUT simpan/update semua resep untuk satu produk (replace all)
router.put('/product/:productId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { items } = req.body;
    // items: Array<{ ingredientId: number, qtyPerServing: number }>

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Format items tidak valid' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Hapus semua resep lama
      await tx.recipeItem.deleteMany({ where: { productId: Number(productId) } });

      // Buat resep baru
      if (items.length > 0) {
        await tx.recipeItem.createMany({
          data: items.map((item: any) => ({
            productId: Number(productId),
            ingredientId: Number(item.ingredientId),
            qtyPerServing: Number(item.qtyPerServing)
          }))
        });
      }

      // Hitung dan update buyPrice produk berdasarkan HPP resep
      const newRecipes = await tx.recipeItem.findMany({
        where: { productId: Number(productId) },
        include: { ingredient: { select: { buyPrice: true } } }
      });

      const hppOtomatis = newRecipes.reduce((sum, r) => {
        return sum + (r.ingredient.buyPrice * r.qtyPerServing);
      }, 0);

      // Update buyPrice produk jika ada resep (HPP otomatis)
      if (newRecipes.length > 0) {
        await tx.product.update({
          where: { id: Number(productId) },
          data: { buyPrice: hppOtomatis }
        });
      }

      return newRecipes;
    });

    res.json({ message: 'Resep berhasil disimpan', recipes: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menyimpan resep' });
  }
});

// DELETE satu baris resep
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.recipeItem.delete({ where: { id: Number(id) } });
    res.json({ message: 'Bahan resep berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus bahan resep' });
  }
});

export default router;
