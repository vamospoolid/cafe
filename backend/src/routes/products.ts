import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Get all products (Public - for Dine-In customers)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'Aktif' },
      include: { category: true },
      orderBy: { id: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get all products
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { id: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create new product
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { barcode, name, categoryId, buyPrice, sellPrice, stock, minStock, imageUrl, status, recipeItems } = req.body;
    
    const product = await prisma.product.create({
      data: {
        barcode,
        name,
        categoryId: Number(categoryId),
        buyPrice: Number(buyPrice) || 0,
        sellPrice: Number(sellPrice),
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 1,
        imageUrl,
        status: status || 'Aktif',
        recipes: recipeItems && Array.isArray(recipeItems) && recipeItems.length > 0 ? {
          create: recipeItems.map((r: any) => ({
            ingredientId: Number(r.ingredientId),
            qtyPerServing: Number(r.qtyPerServing)
          }))
        } : undefined
      },
      include: { category: true }
    });
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { barcode, name, categoryId, buyPrice, sellPrice, stock, minStock, imageUrl, status, recipeItems } = req.body;
    
    // We use a transaction because we need to clear old recipes and insert new ones
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: Number(id) },
        data: {
          barcode,
          name,
          categoryId: categoryId ? Number(categoryId) : undefined,
          buyPrice: buyPrice !== undefined ? Number(buyPrice) : undefined,
          sellPrice: sellPrice !== undefined ? Number(sellPrice) : undefined,
          stock: stock !== undefined ? Number(stock) : undefined,
          minStock: minStock !== undefined ? Number(minStock) : undefined,
          imageUrl,
          status
        }
      });

      // Update recipe items if provided
      if (recipeItems !== undefined && Array.isArray(recipeItems)) {
        await tx.recipeItem.deleteMany({ where: { productId: Number(id) } });
        if (recipeItems.length > 0) {
          await tx.recipeItem.createMany({
            data: recipeItems.map((r: any) => ({
              productId: Number(id),
              ingredientId: Number(r.ingredientId),
              qtyPerServing: Number(r.qtyPerServing)
            }))
          });
        }
      }

      return await tx.product.findUnique({
        where: { id: Number(id) },
        include: { category: true }
      });
    });

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if product is in any order
    const orderCount = await prisma.orderItem.count({
      where: { productId: Number(id) }
    });
    
    if (orderCount > 0) {
      // Soft delete instead
      await prisma.product.update({
        where: { id: Number(id) },
        data: { status: 'Tidak Aktif' }
      });
      return res.json({ message: 'Product has order history, marked as Tidak Aktif.' });
    }
    
    await prisma.product.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
