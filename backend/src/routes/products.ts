import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { requireQuota } from '../middlewares/quotaMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();

// Get all products (Public - for Dine-In customers)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'Aktif' },
      include: { category: true, subCategory: true },
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
      include: { category: true, subCategory: true },
      orderBy: { id: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create new product
router.post('/', authenticateToken, requireQuota('product'), async (req: Request, res: Response) => {
  try {
    const { barcode, name, categoryId, subCategoryId, buyPrice, sellPrice, stock, minStock, imageUrl, status, recipeItems } = req.body;
    
    const product = await prisma.product.create({
      data: {
        barcode,
        name,
        categoryId: Number(categoryId),
        subCategoryId: subCategoryId ? Number(subCategoryId) : null,
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
      include: { category: true, subCategory: true }
    });

    await AuditLogger.log({
      action: 'PRODUCT_CREATE',
      resource: 'PRODUCT',
      resourceId: String(product.id),
      description: `Menambahkan produk baru "${product.name}" (Rp ${product.sellPrice.toLocaleString('id-ID')}).`,
      newValue: { name: product.name, barcode: product.barcode, sellPrice: product.sellPrice, stock: product.stock },
      severity: 'INFO'
    }, req);

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
    const { barcode, name, categoryId, subCategoryId, buyPrice, sellPrice, stock, minStock, imageUrl, status, recipeItems } = req.body;
    
    const oldProduct = await prisma.product.findUnique({ where: { id: Number(id) } });

    // We use a transaction because we need to clear old recipes and insert new ones
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: Number(id) },
        data: {
          barcode,
          name,
          categoryId: categoryId ? Number(categoryId) : undefined,
          subCategoryId: subCategoryId !== undefined ? (subCategoryId ? Number(subCategoryId) : null) : undefined,
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
        include: { category: true, subCategory: true }
      });
    });

    const isPriceChanged = oldProduct && sellPrice !== undefined && Number(oldProduct.sellPrice) !== Number(sellPrice);

    await AuditLogger.log({
      action: isPriceChanged ? 'PRICE_CHANGE' : 'PRODUCT_UPDATE',
      resource: 'PRODUCT',
      resourceId: String(id),
      description: isPriceChanged
        ? `Perubahan harga produk "${product?.name}": Rp ${oldProduct?.sellPrice?.toLocaleString('id-ID')} -> Rp ${Number(sellPrice).toLocaleString('id-ID')}`
        : `Update data produk "${product?.name}".`,
      oldValue: oldProduct ? { name: oldProduct.name, sellPrice: oldProduct.sellPrice, stock: oldProduct.stock, status: oldProduct.status } : null,
      newValue: product ? { name: product.name, sellPrice: product.sellPrice, stock: product.stock, status: product.status } : null,
      severity: isPriceChanged ? 'WARNING' : 'INFO'
    }, req);

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
    const oldProduct = await prisma.product.findUnique({ where: { id: Number(id) } });
    
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

      await AuditLogger.log({
        action: 'PRODUCT_DEACTIVATE',
        resource: 'PRODUCT',
        resourceId: String(id),
        description: `Produk "${oldProduct?.name}" dinonaktifkan (memiliki riwayat transaksi).`,
        oldValue: { status: 'Aktif' },
        newValue: { status: 'Tidak Aktif' },
        severity: 'WARNING'
      }, req);

      return res.json({ message: 'Product has order history, marked as Tidak Aktif.' });
    }
    
    await prisma.product.delete({
      where: { id: Number(id) }
    });

    await AuditLogger.log({
      action: 'PRODUCT_DELETE',
      resource: 'PRODUCT',
      resourceId: String(id),
      description: `Produk "${oldProduct?.name}" dihapus permanen.`,
      oldValue: oldProduct ? { name: oldProduct.name, sellPrice: oldProduct.sellPrice } : null,
      severity: 'CRITICAL'
    }, req);

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
