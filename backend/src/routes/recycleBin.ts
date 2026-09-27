import prisma from '../db';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { syncMenuSoldOutStatus } from './ingredients';

const router = Router();

const RETENTION_DAYS = 30;

// Helper: Calculate remaining days
function calculateDaysRemaining(deletedAt: Date | null): number {
  if (!deletedAt) return RETENTION_DAYS;
  const now = new Date().getTime();
  const deletedTime = new Date(deletedAt).getTime();
  const elapsedDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, RETENTION_DAYS - elapsedDays);
}

/**
 * GET /api/recycle-bin
 * Mengambil seluruh item yang berada di Keranjang Sampah untuk tenant aktif
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const tenantCondition = { tenantId };

    const [products, ingredients, categories, tables, customers, suppliers] = await Promise.all([
      prisma.product.findMany({
        where: {
          deletedAt: { not: null },
          ...tenantCondition
        },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.ingredient.findMany({
        where: {
          deletedAt: { not: null },
          ...tenantCondition
        },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.category.findMany({
        where: {
          deletedAt: { not: null },
          ...tenantCondition
        },
        include: { parent: { select: { id: true, name: true } } },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.table.findMany({
        where: {
          deletedAt: { not: null },
          ...tenantCondition
        },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.customer.findMany({
        where: {
          deletedAt: { not: null },
          ...tenantCondition
        },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.supplier.findMany({
        where: {
          deletedAt: { not: null },
          ...tenantCondition
        },
        orderBy: { deletedAt: 'desc' }
      })
    ]);

    const formattedProducts = products.map(p => ({
      id: p.id,
      type: 'PRODUCT',
      typeName: 'Produk Menu',
      name: p.name,
      detail: `Kategori: ${p.category?.name || '-'} | Harga: Rp ${p.sellPrice.toLocaleString('id-ID')} | Stok: ${p.stock}`,
      deletedAt: p.deletedAt,
      daysRemaining: calculateDaysRemaining(p.deletedAt)
    }));

    const formattedIngredients = ingredients.map(i => ({
      id: i.id,
      type: 'INGREDIENT',
      typeName: 'Bahan Baku',
      name: i.name,
      detail: `Kategori: ${i.category} | Satuan: ${i.unit} | Stok Sisa: ${i.stock} ${i.unit} | Supplier: ${i.supplier?.name || '-'}`,
      deletedAt: i.deletedAt,
      daysRemaining: calculateDaysRemaining(i.deletedAt)
    }));

    const formattedCategories = categories.map(c => ({
      id: c.id,
      type: 'CATEGORY',
      typeName: 'Kategori Menu',
      name: c.name,
      detail: `Printer: ${c.printerTarget} ${c.parent ? `(Sub dari ${c.parent.name})` : ''}`,
      deletedAt: c.deletedAt,
      daysRemaining: calculateDaysRemaining(c.deletedAt)
    }));

    const formattedTables = tables.map(t => ({
      id: t.id,
      type: 'TABLE',
      typeName: 'Meja & Denah',
      name: `Meja ${t.tableNo} - ${t.name || 'Area Tamu'}`,
      detail: `Kapasitas: ${t.capacity} Kursi | Status: ${t.status}`,
      deletedAt: t.deletedAt,
      daysRemaining: calculateDaysRemaining(t.deletedAt)
    }));

    const formattedCustomers = customers.map(c => ({
      id: c.id,
      type: 'CUSTOMER',
      typeName: 'Pelanggan & Member',
      name: c.name,
      detail: `No. HP: ${c.phone} | Tier: ${c.tier} | Poin: ${c.points}`,
      deletedAt: c.deletedAt,
      daysRemaining: calculateDaysRemaining(c.deletedAt)
    }));

    const formattedSuppliers = suppliers.map(s => ({
      id: s.id,
      type: 'SUPPLIER',
      typeName: 'Supplier / Pemasok',
      name: s.name,
      detail: `Kontak: ${s.contact || '-'} | No. HP: ${s.phone || '-'} | Alamat: ${s.address || '-'}`,
      deletedAt: s.deletedAt,
      daysRemaining: calculateDaysRemaining(s.deletedAt)
    }));

    const allItems = [
      ...formattedProducts,
      ...formattedIngredients,
      ...formattedCategories,
      ...formattedTables,
      ...formattedCustomers,
      ...formattedSuppliers
    ].sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

    res.json({
      success: true,
      totalCount: allItems.length,
      counts: {
        products: formattedProducts.length,
        ingredients: formattedIngredients.length,
        categories: formattedCategories.length,
        tables: formattedTables.length,
        customers: formattedCustomers.length,
        suppliers: formattedSuppliers.length
      },
      items: allItems
    });
  } catch (error: any) {
    console.error('[Recycle Bin GET Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal memuat isi keranjang sampah' });
  }
});

/**
 * POST /api/recycle-bin/restore
 * Memulihkan item dari keranjang sampah kembali ke status aktif (deletedAt = null)
 */
router.post('/restore', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { type, id } = req.body;

    if (!type || !id) {
      return res.status(400).json({ error: 'Tipe item dan ID wajib disertakan untuk pemulihan.' });
    }

    const numericId = Number(id);
    let restoredName = '';

    switch (type.toUpperCase()) {
      case 'PRODUCT': {
        const prod = await prisma.product.findFirst({
          where: { id: numericId, tenantId, deletedAt: { not: null } }
        });
        if (!prod) return res.status(404).json({ error: 'Produk tidak ditemukan di keranjang sampah outlet Anda.' });
        
        // Ensure category is not soft-deleted
        if (prod.categoryId) {
          const cat = await prisma.category.findFirst({
            where: { id: prod.categoryId, tenantId }
          });
          if (cat && cat.deletedAt) {
            await prisma.category.updateMany({
              where: { id: cat.id, tenantId },
              data: { deletedAt: null }
            });
          }
        }

        await prisma.product.updateMany({
          where: { id: numericId, tenantId },
          data: { deletedAt: null }
        });
        restoredName = prod.name;
        break;
      }

      case 'INGREDIENT': {
        const ing = await prisma.ingredient.findFirst({
          where: { id: numericId, tenantId, deletedAt: { not: null } }
        });
        if (!ing) return res.status(404).json({ error: 'Bahan baku tidak ditemukan di keranjang sampah outlet Anda.' });
        await prisma.ingredient.updateMany({
          where: { id: numericId, tenantId },
          data: { deletedAt: null }
        });
        await syncMenuSoldOutStatus(prisma);
        restoredName = ing.name;
        break;
      }

      case 'CATEGORY': {
        const cat = await prisma.category.findFirst({
          where: { id: numericId, tenantId, deletedAt: { not: null } }
        });
        if (!cat) return res.status(404).json({ error: 'Kategori tidak ditemukan di keranjang sampah outlet Anda.' });
        
        // Restore category and child sub-categories belonging to this tenant
        await prisma.$transaction([
          prisma.category.updateMany({
            where: { id: numericId, tenantId },
            data: { deletedAt: null }
          }),
          prisma.category.updateMany({
            where: { parentId: numericId, tenantId },
            data: { deletedAt: null }
          })
        ]);
        restoredName = cat.name;
        break;
      }

      case 'TABLE': {
        const tbl = await prisma.table.findFirst({
          where: { id: numericId, tenantId, deletedAt: { not: null } }
        });
        if (!tbl) return res.status(404).json({ error: 'Meja tidak ditemukan di keranjang sampah outlet Anda.' });
        await prisma.table.updateMany({
          where: { id: numericId, tenantId },
          data: { deletedAt: null }
        });
        restoredName = `Meja ${tbl.tableNo}`;
        break;
      }

      case 'CUSTOMER': {
        const cust = await prisma.customer.findFirst({
          where: { id: numericId, tenantId, deletedAt: { not: null } }
        });
        if (!cust) return res.status(404).json({ error: 'Pelanggan tidak ditemukan di keranjang sampah outlet Anda.' });
        await prisma.customer.updateMany({
          where: { id: numericId, tenantId },
          data: { deletedAt: null }
        });
        restoredName = cust.name;
        break;
      }

      case 'SUPPLIER': {
        const sup = await prisma.supplier.findFirst({
          where: { id: numericId, tenantId, deletedAt: { not: null } }
        });
        if (!sup) return res.status(404).json({ error: 'Supplier tidak ditemukan di keranjang sampah outlet Anda.' });
        await prisma.supplier.updateMany({
          where: { id: numericId, tenantId },
          data: { deletedAt: null }
        });
        restoredName = sup.name;
        break;
      }

      default:
        return res.status(400).json({ error: `Tipe item "${type}" tidak dikenali.` });
    }

    await AuditLogger.log({
      tenantId,
      action: 'RECYCLE_BIN_RESTORE',
      resource: type,
      resourceId: String(numericId),
      description: `Item ${type} "${restoredName}" berhasil dipulihkan dari Keranjang Sampah ke sistem aktif.`,
      severity: 'INFO'
    }, req);

    res.json({
      success: true,
      message: `"${restoredName}" berhasil dipulihkan dan kini aktif kembali di toko Anda!`
    });
  } catch (error: any) {
    console.error('[Recycle Bin Restore Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal memulihkan item' });
  }
});

/**
 * DELETE /api/recycle-bin/purge/:type/:id
 * Menghapus permanen (Hard Delete) 1 item dari database
 */
router.delete('/purge/:type/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const type = String(req.params.type);
    const numericId = Number(req.params.id);

    const userRole = (req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER'].includes(userRole) && !req.user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Akun Owner / Admin yang berhak menghapus permanen.' });
    }

    let purgedName = '';

    await prisma.$transaction(async (tx) => {
      switch (type.toUpperCase()) {
        case 'PRODUCT': {
          const prod = await tx.product.findFirst({ where: { id: numericId, tenantId } });
          if (!prod) throw new Error('Produk tidak ditemukan atau bukan milik outlet Anda');
          purgedName = prod.name;

          await tx.recipeItem.deleteMany({ where: { productId: numericId } });
          await tx.wasteLog.deleteMany({ where: { productId: numericId } });
          await tx.purchaseOrderItem.updateMany({ where: { productId: numericId }, data: { productId: null } });
          await tx.orderItem.deleteMany({ where: { productId: numericId } });
          await tx.product.deleteMany({ where: { id: numericId, tenantId } });
          break;
        }

        case 'INGREDIENT': {
          const ing = await tx.ingredient.findFirst({ where: { id: numericId, tenantId } });
          if (!ing) throw new Error('Bahan baku tidak ditemukan atau bukan milik outlet Anda');
          purgedName = ing.name;

          await tx.recipeItem.deleteMany({ where: { ingredientId: numericId } });
          await tx.ingredientLog.deleteMany({ where: { ingredientId: numericId } });
          await tx.wasteLog.deleteMany({ where: { ingredientId: numericId } });
          await tx.warehouseInboundItem.deleteMany({ where: { ingredientId: numericId } });
          await tx.warehouseRequisitionItem.deleteMany({ where: { ingredientId: numericId } });
          await tx.warehouseSaleItem.deleteMany({ where: { ingredientId: numericId } });
          await tx.ingredient.deleteMany({ where: { id: numericId, tenantId } });
          break;
        }

        case 'CATEGORY': {
          const cat = await tx.category.findFirst({ where: { id: numericId, tenantId } });
          if (!cat) throw new Error('Kategori tidak ditemukan atau bukan milik outlet Anda');
          purgedName = cat.name;

          const childCats = await tx.category.findMany({
            where: { parentId: numericId, tenantId },
            select: { id: true }
          });
          const allCatIds = [numericId, ...childCats.map(c => c.id)];

          // 1. Periksa apakah masih ada produk aktif yang mereferensikan kategori ini
          const activeProductsCount = await tx.product.count({
            where: {
              tenantId,
              deletedAt: null,
              OR: [{ categoryId: { in: allCatIds } }, { subCategoryId: { in: allCatIds } }]
            }
          });
          if (activeProductsCount > 0) {
            throw new Error(`Kategori tidak dapat dimusnahkan permanen karena masih digunakan oleh ${activeProductsCount} produk aktif.`);
          }

          // 2. Periksa apakah masih ada produk di keranjang sampah yang mereferensikan categoryId utama (wajib foreign key)
          const binnedProductsCount = await tx.product.count({
            where: {
              tenantId,
              categoryId: { in: allCatIds }
            }
          });
          if (binnedProductsCount > 0) {
            throw new Error(`Kategori tidak dapat dimusnahkan permanen karena masih ada ${binnedProductsCount} produk terkait di keranjang sampah. Harap musnahkan produk tersebut terlebih dahulu.`);
          }

          // 3. Lepaskan tautan subCategoryId pada produk di keranjang sampah (opsional nullable)
          await tx.product.updateMany({
            where: { tenantId, subCategoryId: { in: allCatIds } },
            data: { subCategoryId: null }
          });

          // 4. Hapus permanen sub-kategori lalu kategori induk milik tenant
          await tx.category.deleteMany({ where: { parentId: numericId, tenantId } });
          await tx.category.deleteMany({ where: { id: numericId, tenantId } });
          break;
        }

        case 'TABLE': {
          const tbl = await tx.table.findFirst({ where: { id: numericId, tenantId } });
          if (!tbl) throw new Error('Meja tidak ditemukan atau bukan milik outlet Anda');
          purgedName = `Meja ${tbl.tableNo}`;

          await tx.reservation.deleteMany({ where: { tableId: numericId } });
          await tx.table.deleteMany({ where: { id: numericId, tenantId } });
          break;
        }

        case 'CUSTOMER': {
          const cust = await tx.customer.findFirst({ where: { id: numericId, tenantId } });
          if (!cust) throw new Error('Pelanggan tidak ditemukan atau bukan milik outlet Anda');
          purgedName = cust.name;

          await tx.pointLog.deleteMany({ where: { customerId: numericId } });
          await tx.debtPayment.deleteMany({ where: { debt: { customerId: numericId } } });
          await tx.debt.deleteMany({ where: { customerId: numericId } });
          await tx.customer.deleteMany({ where: { id: numericId, tenantId } });
          break;
        }

        case 'SUPPLIER': {
          const sup = await tx.supplier.findFirst({ where: { id: numericId, tenantId } });
          if (!sup) throw new Error('Supplier tidak ditemukan atau bukan milik outlet Anda');
          purgedName = sup.name;

          await tx.ingredient.updateMany({ where: { supplierId: numericId }, data: { supplierId: null } });
          await tx.supplier.deleteMany({ where: { id: numericId, tenantId } });
          break;
        }

        default:
          throw new Error(`Tipe "${type}" tidak valid`);
      }
    });

    await AuditLogger.log({
      tenantId,
      action: 'RECYCLE_BIN_PURGE',
      resource: type,
      resourceId: String(numericId),
      description: `Item ${type} "${purgedName}" telah dihapus permanen (Hard Deleted).`,
      severity: 'CRITICAL'
    }, req);

    res.json({
      success: true,
      message: `Item "${purgedName}" telah dihapus secara permanen dari sistem.`
    });
  } catch (error: any) {
    console.error('[Recycle Bin Purge Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal menghapus item secara permanen' });
  }
});

/**
 * DELETE /api/recycle-bin/empty
 * Mengosongkan seluruh Keranjang Sampah untuk tenant aktif (Memerlukan kata sandi Owner)
 */
router.delete('/empty', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { password } = req.body;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Sesi login tidak valid.' });
    }

    const userRole = (req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER'].includes(userRole) && !req.user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Akun Owner yang berhak mengosongkan keranjang sampah.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Kata sandi Owner wajib diisi untuk mengosongkan seluruh sampah.' });
    }

    // Anti-IDOR: verifikasi user adalah anggota tenant aktif, bukan hanya berdasarkan userId JWT
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { tenantId } }
      }
    });
    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan atau bukan anggota tenant ini.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Kata sandi Owner salah. Pengosongan sampah dibatalkan demi keamanan.' });
    }

    const tenantCondition = { tenantId, deletedAt: { not: null } };

    const deletedStats = await prisma.$transaction(async (tx) => {
      // Find IDs to purge
      const prods = await tx.product.findMany({ where: tenantCondition, select: { id: true } });
      const prodIds = prods.map(p => p.id);
      if (prodIds.length > 0) {
        await tx.recipeItem.deleteMany({ where: { productId: { in: prodIds } } });
        await tx.wasteLog.deleteMany({ where: { productId: { in: prodIds } } });
        await tx.orderItem.deleteMany({ where: { productId: { in: prodIds } } });
        await tx.purchaseOrderItem.updateMany({ where: { productId: { in: prodIds } }, data: { productId: null } });
      }

      const ings = await tx.ingredient.findMany({ where: tenantCondition, select: { id: true } });
      const ingIds = ings.map(i => i.id);
      if (ingIds.length > 0) {
        await tx.recipeItem.deleteMany({ where: { ingredientId: { in: ingIds } } });
        await tx.ingredientLog.deleteMany({ where: { ingredientId: { in: ingIds } } });
        await tx.wasteLog.deleteMany({ where: { ingredientId: { in: ingIds } } });
      }

      const purgedProducts = await tx.product.deleteMany({ where: tenantCondition });
      const purgedIngredients = await tx.ingredient.deleteMany({ where: tenantCondition });
      const purgedCategories = await tx.category.deleteMany({ where: tenantCondition });
      const purgedTables = await tx.table.deleteMany({ where: tenantCondition });
      const purgedCustomers = await tx.customer.deleteMany({ where: tenantCondition });
      const purgedSuppliers = await tx.supplier.deleteMany({ where: tenantCondition });

      return {
        products: purgedProducts.count,
        ingredients: purgedIngredients.count,
        categories: purgedCategories.count,
        tables: purgedTables.count,
        customers: purgedCustomers.count,
        suppliers: purgedSuppliers.count
      };
    });

    await AuditLogger.log({
      tenantId,
      action: 'RECYCLE_BIN_EMPTY',
      resource: 'SETTINGS',
      description: `Keranjang sampah toko dikosongkan total (${Object.values(deletedStats).reduce((a, b) => a + b, 0)} item dihapus permanen).`,
      severity: 'CRITICAL'
    }, req);

    res.json({
      success: true,
      message: 'Keranjang sampah berhasil dikosongkan sepenuhnya.',
      stats: deletedStats
    });
  } catch (error: any) {
    console.error('[Recycle Bin Empty Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal mengosongkan keranjang sampah' });
  }
});

/**
 * POST /api/recycle-bin/auto-purge
 * Rutinitas pembersihan background untuk item yang telah berada di tong sampah > 30 hari
 */
router.post('/auto-purge', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const purgeCondition = {
      tenantId,
      deletedAt: { lte: cutoffDate }
    };

    const purgedCounts = await prisma.$transaction(async (tx) => {
      const p = await tx.product.deleteMany({ where: purgeCondition });
      const i = await tx.ingredient.deleteMany({ where: purgeCondition });
      const c = await tx.category.deleteMany({ where: purgeCondition });
      const t = await tx.table.deleteMany({ where: purgeCondition });
      const cu = await tx.customer.deleteMany({ where: purgeCondition });
      const s = await tx.supplier.deleteMany({ where: purgeCondition });

      return p.count + i.count + c.count + t.count + cu.count + s.count;
    });

    res.json({
      success: true,
      message: `Pembersihan otomatis selesai. ${purgedCounts} item kadaluarsa (> 30 hari) telah dihapus permanen.`,
      purgedCount: purgedCounts
    });
  } catch (error: any) {
    console.error('[Recycle Bin Auto-Purge Error]', error);
    res.status(500).json({ error: error?.message || 'Gagal menjalankan pembersihan otomatis' });
  }
});

export default router;
