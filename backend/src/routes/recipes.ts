import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Helper to get tenant ID (fail-closed: returns undefined if unavailable)
function getTenantId(req: Request): string | undefined {
  const user = (req as any).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
}

// Router-level fail-closed guard: semua endpoint recipes membutuhkan tenant context
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

// GET resep untuk satu produk (beserta kalkulasi HPP)
// SECURITY: Validasi kepemilikan product ke tenantId — mencegah pencurian resep lintas tenant
router.get('/product/:productId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { productId } = req.params;

    // Validasi kepemilikan product sebelum membaca resep
    const product = await prisma.product.findFirst({
      where: { id: Number(productId), tenantId }
    });
    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan atau bukan milik tenant ini' });
    }

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
// SECURITY: Validasi kepemilikan product DAN setiap ingredient ke tenantId
// Mencegah: (1) overwrite resep tenant lain, (2) injeksi ingredient lintas tenant ke dalam resep
router.put('/product/:productId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { productId } = req.params;
    const { items } = req.body;
    // items: Array<{ ingredientId: number, qtyPerServing: number }>

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Format items tidak valid' });
    }

    // Validasi kepemilikan product sebelum modifikasi resep
    const product = await prisma.product.findFirst({
      where: { id: Number(productId), tenantId }
    });
    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan atau bukan milik tenant ini' });
    }

    // Validasi setiap ingredientId milik tenantId yang sama — mencegah nested FK injection
    if (items.length > 0) {
      const ingredientIds = items.map((i: any) => Number(i.ingredientId));
      const ownedIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId, deletedAt: null },
        select: { id: true }
      });
      const ownedIds = new Set(ownedIngredients.map(i => i.id));
      const foreignIds = ingredientIds.filter(id => !ownedIds.has(id));
      if (foreignIds.length > 0) {
        return res.status(403).json({
          error: 'Beberapa bahan baku bukan milik tenant ini',
          code: 'INGREDIENT_TENANT_MISMATCH',
          foreignIds
        });
      }
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
// SECURITY: Validasi bahwa recipeItem milik tenant yang meminta — mencegah IDOR delete
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { id } = req.params;

    // Verifikasi kepemilikan melalui relasi product -> tenantId
    const recipeItem = await prisma.recipeItem.findFirst({
      where: {
        id: Number(id),
        product: { tenantId }
      },
      include: { product: { select: { tenantId: true } } }
    });
    if (!recipeItem) {
      return res.status(404).json({ error: 'Item resep tidak ditemukan atau bukan milik tenant ini' });
    }

    await prisma.recipeItem.delete({ where: { id: Number(id) } });
    res.json({ message: 'Bahan resep berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus bahan resep' });
  }
});

export default router;
