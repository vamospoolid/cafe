import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, requirePermission } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { CATEGORY_PRESETS, applyPresetToTenant } from '../utils/categoryPresets';
import { emitToTenant } from '../index';
import { cacheService } from '../services/CacheService';

const router = Router();

// Get available industry presets (Kafe, Resto, Bakery)
router.get('/presets', authenticateToken, (req: Request, res: Response) => {
  res.json(Object.values(CATEGORY_PRESETS));
});

// Apply industry category preset to tenant
router.post('/apply-preset', authenticateToken, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    const { presetId, replaceExisting = false } = req.body;
    const cleanPresetId = String(presetId || '').toUpperCase();
    const preset = CATEGORY_PRESETS[cleanPresetId];
    if (!preset) {
      return res.status(400).json({ 
        error: `Preset '${presetId}' tidak valid. Pilihan yang tersedia: ${Object.keys(CATEGORY_PRESETS).join(', ')}` 
      });
    }

    // Jika replaceExisting dipilih, periksa apakah ada produk aktif
    if (replaceExisting) {
      const activeProductsCount = await prisma.product.count({
        where: { tenantId, deletedAt: null }
      });
      if (activeProductsCount > 0) {
        return res.status(400).json({
          error: `Tidak dapat menghapus kategori lama karena masih ada ${activeProductsCount} produk aktif. Non-aktifkan opsi 'Ganti Semua Kategori' untuk menambahkan kategori baru tanpa menghapus yang lama.`
        });
      }
    }

    const result = await applyPresetToTenant(prisma, tenantId, cleanPresetId, Boolean(replaceExisting));

    await AuditLogger.log({
      action: 'CATEGORY_PRESET_APPLIED',
      resource: 'SETTINGS',
      description: `Tenant menerapkan preset kategori industri: "${preset.name}". Total ${result.createdCategories} kategori utama ditambahkan.`,
      newValue: { presetId: preset.id, totalCategories: result.createdCategories, totalSubCategories: result.createdSubCategories },
      severity: 'INFO'
    }, req);

    emitToTenant(tenantId, 'categories:updated', { action: 'APPLY_PRESET', presetId: cleanPresetId });
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.status(201).json({
      success: true,
      message: `Berhasil menerapkan template kategori "${preset.name}"!`,
      preset: preset.name,
      totalAdded: result.createdCategories,
      totalSubCategoriesAdded: result.createdSubCategories
    });
  } catch (err: any) {
    console.error('Error applying category preset:', err);
    res.status(500).json({ error: 'Gagal menerapkan preset kategori', details: err.message });
  }
});

// Reorder categories sortOrder (Batch reorder for tenant)
router.post('/reorder', authenticateToken, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Data items urutan tidak valid' });
    }

    // Validasi semua ID kategori milik tenant aktif
    const categoryIds = items.map((i: any) => Number(i.id)).filter(Boolean);
    const existing = await prisma.category.findMany({
      where: { id: { in: categoryIds }, tenantId, deletedAt: null },
      select: { id: true }
    });

    const existingSet = new Set(existing.map(e => e.id));
    const updates = items.filter((i: any) => existingSet.has(Number(i.id)));

    await prisma.$transaction(
      updates.map((item: any) =>
        prisma.category.updateMany({
          where: { id: Number(item.id), tenantId },
          data: { sortOrder: Number(item.sortOrder) || 0 }
        })
      )
    );

    emitToTenant(tenantId, 'categories:updated', { action: 'REORDER' });

    res.json({ success: true, message: 'Urutan kategori berhasil diperbarui' });
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ error: 'Gagal memperbarui urutan kategori' });
  }
});

// Get all categories (Public - for Dine-In customers)
router.get('/public', async (req: Request, res: Response) => {
  try {
    let tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);
    const tenantSlug = req.query.tenant as string;
    const tableId = req.query.tableId as string;

    if (!tenantId && tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    if (!tenantId && tableId) {
      const numTableId = Number(tableId);
      if (!isNaN(numTableId)) {
        const table = await prisma.table.findUnique({ where: { id: numTableId } });
        if (table?.tenantId) tenantId = table.tenantId;
      }
    }

    if (!tenantId) {
      const { resolveTenantFromRequest } = require('../middlewares/tenantResolver');
      const resolved = await resolveTenantFromRequest(req);
      if (resolved) tenantId = resolved.id;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required', code: 'MISSING_TENANT_CONTEXT' });
    }

    const whereCondition: any = {
      parentId: null,
      deletedAt: null,
      tenantId,
      isActive: true
    };

    const categories = await prisma.category.findMany({
      where: whereCondition,
      include: {
        subCategories: {
          where: { deletedAt: null, tenantId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get all categories (Admin / POS - Scoped to active tenant)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const isFlat = req.query.flat === 'true';
    const includeInactive = req.query.includeInactive === 'true';
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const activeCondition = includeInactive ? {} : { isActive: true };
    
    if (isFlat) {
      const allCategories = await prisma.category.findMany({
        where: {
          deletedAt: null,
          ...activeCondition
        },
        include: {
          parent: true,
          _count: {
            select: { 
              products: { where: { deletedAt: null } }, 
              subProducts: { where: { deletedAt: null } } 
            }
          }
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      });
      return res.json(allCategories);
    }

    const categories = await prisma.category.findMany({
      where: { 
        parentId: null,
        deletedAt: null,
        ...activeCondition
      },
      include: {
        subCategories: {
          where: { deletedAt: null, ...activeCondition },
          include: {
            _count: {
              select: { 
                subProducts: { where: { deletedAt: null } }, 
                products: { where: { deletedAt: null } } 
              }
            }
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
        },
        _count: {
          select: { products: { where: { deletedAt: null } } }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new category or sub-category (Scoped to active tenant)
router.post('/', authenticateToken, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { name, icon, color, sortOrder, printerTarget, stationTarget, isActive, parentId } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }
    
    let validParentId: number | null = null;
    if (parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: Number(parentId), deletedAt: null }
      });
      if (!parent) {
        return res.status(400).json({ error: 'Kategori induk tidak valid atau tidak ditemukan' });
      }
      validParentId = parent.id;
    }
    
    const category = await prisma.category.create({
      data: { 
        tenantId,
        name: name.trim(),
        icon: icon || '🍽️',
        color: color || '#4f46e5',
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        printerTarget: printerTarget || (stationTarget === 'BAR' ? 'BAR' : stationTarget === 'NONE' ? 'NONE' : 'KITCHEN'),
        stationTarget: stationTarget || (printerTarget === 'BAR' ? 'BAR' : printerTarget === 'NONE' ? 'NONE' : 'KITCHEN'),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        parentId: validParentId
      },
      include: {
        parent: true,
        subCategories: true
      }
    });

    emitToTenant(tenantId, 'categories:updated', { action: 'CREATE', categoryId: category.id });
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Gagal menambahkan kategori' });
  }
});

// Update category (Scoped to active tenant)
router.put('/:id', authenticateToken, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const categoryId = Number(id);
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { name, icon, color, sortOrder, printerTarget, stationTarget, isActive, parentId } = req.body;
    const existing = await prisma.category.findFirst({
      where: {
        id: categoryId,
        deletedAt: null
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    }

    let validParentId: number | null | undefined = undefined;
    if (parentId !== undefined) {
      if (parentId) {
        const parent = await prisma.category.findFirst({
          where: { id: Number(parentId), deletedAt: null }
        });
        if (!parent || parent.id === categoryId) {
          return res.status(400).json({ error: 'Kategori induk tidak valid atau tidak ditemukan' });
        }
        validParentId = parent.id;
      } else {
        validParentId = null;
      }
    }
    
    const category = await prisma.category.update({
      where: { id: categoryId },
      data: { 
        name: name !== undefined ? name.trim() : undefined,
        icon: icon !== undefined ? icon : undefined,
        color: color !== undefined ? color : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        printerTarget: printerTarget !== undefined ? printerTarget : (stationTarget === 'BAR' ? 'BAR' : stationTarget === 'NONE' ? 'NONE' : stationTarget ? 'KITCHEN' : undefined),
        stationTarget: stationTarget !== undefined ? stationTarget : (printerTarget === 'BAR' ? 'BAR' : printerTarget === 'NONE' ? 'NONE' : printerTarget ? 'KITCHEN' : undefined),
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        parentId: validParentId
      },
      include: {
        parent: true,
        subCategories: true
      }
    });

    emitToTenant(tenantId, 'categories:updated', { action: 'UPDATE', categoryId: category.id });
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Gagal mengupdate kategori' });
  }
});

// Soft Delete category (Move to Recycle Bin for 30 days)
router.delete('/:id', authenticateToken, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id);
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    const existing = await prisma.category.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan atau Anda tidak memiliki akses.' });
    }
    
    // 1. Ambil seluruh ID sub-kategori turunan milik tenant ini
    const childCategories = await prisma.category.findMany({
      where: { parentId: categoryId, tenantId, deletedAt: null },
      select: { id: true, name: true }
    });
    const allTargetIds = [categoryId, ...childCategories.map(c => c.id)];

    // 2. Periksa apakah ada produk aktif yang mengaitkan kategori induk maupun sub-kategori turunan
    const activeProductsCount = await prisma.product.count({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { categoryId: { in: allTargetIds } },
          { subCategoryId: { in: allTargetIds } }
        ]
      }
    });
    
    if (activeProductsCount > 0) {
      return res.status(400).json({ 
        error: `Tidak dapat menghapus kategori karena masih digunakan oleh ${activeProductsCount} produk aktif (termasuk pada sub-kategori). Harap pindahkan produk terlebih dahulu.`,
        code: 'CATEGORY_HAS_ACTIVE_PRODUCTS'
      });
    }

    // 3. Soft delete kategori induk dan seluruh anak secara atomik & terisolasi per tenant
    await prisma.$transaction([
      prisma.category.updateMany({
        where: { id: categoryId, tenantId, deletedAt: null },
        data: { deletedAt: new Date() }
      }),
      prisma.category.updateMany({
        where: { parentId: categoryId, tenantId, deletedAt: null },
        data: { deletedAt: new Date() }
      })
    ]);

    await AuditLogger.log({
      action: 'CATEGORY_SOFT_DELETE',
      resource: 'SETTINGS',
      resourceId: String(categoryId),
      description: `Kategori "${existing.name}" dipindahkan ke Keranjang Sampah (Recycle Bin 30 hari).`,
      oldValue: { name: existing.name },
      severity: 'WARNING'
    }, req);

    emitToTenant(tenantId, 'categories:updated', { action: 'DELETE', categoryId });
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.json({ 
      success: true,
      message: `Kategori "${existing.name}" dipindahkan ke Keranjang Sampah. Anda dapat memulihkannya dalam 30 hari.` 
    });
  } catch (error) {
    console.error('Error soft deleting category:', error);
    res.status(500).json({ error: 'Gagal menghapus kategori' });
  }
});

export default router;
