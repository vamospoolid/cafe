import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Get all categories (Public - for Dine-In customers)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        subCategories: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get all categories (Admin / POS)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const isFlat = req.query.flat === 'true';
    
    if (isFlat) {
      const allCategories = await prisma.category.findMany({
        include: {
          parent: true,
          _count: {
            select: { products: true, subProducts: true }
          }
        },
        orderBy: { name: 'asc' }
      });
      return res.json(allCategories);
    }

    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        subCategories: {
          include: {
            _count: {
              select: { subProducts: true, products: true }
            }
          },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new category or sub-category
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, printerTarget, parentId } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }
    
    const category = await prisma.category.create({
      data: { 
        name: name.trim(),
        printerTarget: printerTarget || 'KITCHEN',
        parentId: parentId ? Number(parentId) : null
      },
      include: {
        parent: true,
        subCategories: true
      }
    });
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Gagal menambahkan kategori' });
  }
});

// Update category
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, printerTarget, parentId } = req.body;
    
    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: { 
        name: name !== undefined ? name.trim() : undefined,
        printerTarget: printerTarget !== undefined ? printerTarget : undefined,
        parentId: parentId !== undefined ? (parentId ? Number(parentId) : null) : undefined
      },
      include: {
        parent: true,
        subCategories: true
      }
    });
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Gagal mengupdate kategori' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id);
    
    // Check if category has direct products or sub-products
    const directProductsCount = await prisma.product.count({
      where: {
        OR: [
          { categoryId: categoryId },
          { subCategoryId: categoryId }
        ]
      }
    });
    
    if (directProductsCount > 0) {
      return res.status(400).json({ 
        error: `Tidak dapat menghapus kategori karena masih digunakan oleh ${directProductsCount} produk.` 
      });
    }

    // Check if category has subcategories that have products
    const subCategories = await prisma.category.findMany({
      where: { parentId: categoryId },
      include: {
        _count: {
          select: { subProducts: true, products: true }
        }
      }
    });

    const subCategoryProductCount = subCategories.reduce(
      (sum, sub) => sum + sub._count.products + sub._count.subProducts, 
      0
    );

    if (subCategoryProductCount > 0) {
      return res.status(400).json({ 
        error: `Tidak dapat menghapus kategori karena sub-kategorinya masih digunakan oleh ${subCategoryProductCount} produk.` 
      });
    }
    
    // If it has subcategories with 0 products, delete them or let cascade delete handle it
    await prisma.category.delete({
      where: { id: categoryId }
    });
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Gagal menghapus kategori' });
  }
});

export default router;

