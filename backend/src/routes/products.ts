import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, requirePermission } from '../middlewares/authMiddleware';
import { requireQuota } from '../middlewares/quotaMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { ImageCacheService } from '../services/ImageCacheService';
import { cacheService } from '../services/CacheService';

const router = Router();

// POST /api/products/cache-images - Trigger background caching of AI images to local server disk
router.post('/cache-images', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    // Trigger in background
    ImageCacheService.cacheProductImages(tenantId);
    return res.json({ message: 'Proses penyimpanan gambar AI ke server lokal sedang berjalan di background.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Gagal menjalankan pemprosesan gambar' });
  }
});

// POST /api/products/generate-missing-barcodes - Auto-generate barcodes for products without barcode
router.post('/generate-missing-barcodes', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const { productIds, forceRegenerate } = req.body || {};

    const whereCondition: any = {
      tenantId,
      deletedAt: null
    };

    if (!forceRegenerate) {
      whereCondition.OR = [
        { barcode: null },
        { barcode: '' }
      ];
    }

    if (Array.isArray(productIds) && productIds.length > 0) {
      whereCondition.id = { in: productIds.map(Number) };
    }

    const missingProducts = await prisma.product.findMany({
      where: whereCondition,
      select: { id: true, name: true }
    });

    if (missingProducts.length === 0) {
      return res.json({ message: 'Semua produk sudah memiliki barcode.', updatedCount: 0, products: [] });
    }

    // Generate unique 12-digit barcode for each product: "200" + 9 random digits
    const updatedProducts: any[] = [];
    for (const prod of missingProducts) {
      let uniqueBarcode = '';
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 10) {
        attempts++;
        const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
        uniqueBarcode = `200${randomDigits}`;
        const duplicate = await prisma.product.findFirst({
          where: { tenantId, barcode: uniqueBarcode }
        });
        if (!duplicate) exists = false;
      }

      const updated = await prisma.product.update({
        where: { id: prod.id },
        data: { barcode: uniqueBarcode },
        include: { category: true, subCategory: true }
      });
      updatedProducts.push(updated);
    }

    // Invalidate tenant cache
    await cacheService.bumpTenantCatalogVersion(tenantId);

    return res.json({
      message: `Berhasil membuat barcode otomatis untuk ${updatedProducts.length} produk.`,
      updatedCount: updatedProducts.length,
      products: updatedProducts
    });
  } catch (error: any) {
    console.error('Error generating barcodes:', error);
    return res.status(500).json({ error: error.message || 'Gagal generate barcode' });
  }
});

// Get all products (Public - for Dine-In customers)
router.get('/public', async (req: Request, res: Response) => {
  try {
    let tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);
    const tenantSlug = req.query.tenant as string;

    if (!tenantId && tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context wajib disertakan.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const whereCondition: any = {
      status: 'Aktif',
      deletedAt: null,
      tenantId
    };

    // Fast Cache Check via Tenant Catalog Versioning
    const catalogVer = await cacheService.getTenantCatalogVersion(tenantId);
    const cacheKey = `cache:catalog:${tenantId}:v${catalogVer}:public`;
    const cachedProducts = await cacheService.get<any[]>(cacheKey);
    if (cachedProducts) {
      return res.json(cachedProducts);
    }

    const products = await prisma.product.findMany({
      where: whereCondition,
      include: { 
        category: true, 
        subCategory: true,
        productUoms: { orderBy: { conversionRatio: 'asc' } },
        priceTiers: { orderBy: { minQty: 'asc' } }
      },
      orderBy: { id: 'desc' }
    });

    // Cache result with 30-minute TTL
    await cacheService.set(cacheKey, products, 1800);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get all products (Scoped to active tenant)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
    const isAll = req.query.all === 'true' && isPlatformAdmin;
    if (!tenantId && !isAll) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const tenantCondition = isAll ? {} : { tenantId };

    const products = await prisma.product.findMany({
      where: { 
        deletedAt: null,
        ...tenantCondition
      },
      include: { 
        category: true, 
        subCategory: true,
        productUoms: { orderBy: { conversionRatio: 'asc' } },
        priceTiers: { orderBy: { minQty: 'asc' } },
        recipes: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, buyPrice: true, stock: true }
            }
          }
        }
      },
      orderBy: { id: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create new product
router.post('/', authenticateToken, requirePermission('products.manage'), requireQuota('product'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const { 
      barcode, name, categoryId, subCategoryId, buyPrice, sellPrice, 
      sellPriceRetail, sellPriceMitra, sellPriceGrosir, minQtyGrosir,
      stock, minStock, imageUrl, status,
      // Bengkel spare part fields
      brand, vehicleType, storageLocation
    } = req.body;

    // Harmonize recipe payload (accept both recipeItems and recipes from client)
    const rawRecipeItems = req.body.recipeItems !== undefined ? req.body.recipeItems : req.body.recipes;

    // Normalize empty barcode to null (prevent unique constraint violation when multiple products have no barcode)
    const normalizedBarcode = barcode && String(barcode).trim() !== '' ? String(barcode).trim() : null;

    // Validasi kepemilikan kategori oleh tenant aktif (Zero IDOR / Nested Injection Prevention)
    const validCategory = await prisma.category.findFirst({
      where: { id: Number(categoryId), tenantId, deletedAt: null }
    });
    if (!validCategory) {
      return res.status(400).json({ error: 'Kategori tidak valid atau bukan milik outlet Anda' });
    }

    let validSubCategoryId: number | null = null;
    if (subCategoryId) {
      const validSubCategory = await prisma.category.findFirst({
        where: { id: Number(subCategoryId), tenantId, deletedAt: null }
      });
      if (!validSubCategory) {
        return res.status(400).json({ error: 'Sub-kategori tidak valid atau bukan milik outlet Anda' });
      }
      validSubCategoryId = validSubCategory.id;
    }
    
    // Zero IDOR: Validasi kepemilikan setiap ingredientId oleh tenant aktif sebelum create
    if (rawRecipeItems && Array.isArray(rawRecipeItems) && rawRecipeItems.length > 0) {
      const ingredientIds = rawRecipeItems.map((r: any) => Number(r.ingredientId));
      const validIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId },
        select: { id: true }
      });
      const validIngredientIds = new Set(validIngredients.map(i => i.id));
      const invalidIngredient = ingredientIds.find(id => !validIngredientIds.has(id));
      if (invalidIngredient) {
        return res.status(400).json({ error: `Bahan baku ID ${invalidIngredient} tidak valid atau bukan milik outlet Anda.`, code: 'INVALID_INGREDIENT_OWNERSHIP' });
      }
    }

    const effectiveSellPrice = Number(sellPrice ?? sellPriceRetail ?? 0);
    const effectiveRetail = sellPriceRetail !== undefined && sellPriceRetail !== null && sellPriceRetail !== ''
      ? Number(sellPriceRetail)
      : effectiveSellPrice;

    const product = await prisma.product.create({
      data: {
        tenantId,
        barcode: normalizedBarcode,
        name,
        categoryId: validCategory.id,
        subCategoryId: validSubCategoryId,
        buyPrice: Number(buyPrice) || 0,
        sellPrice: effectiveSellPrice,
        sellPriceRetail: effectiveRetail,
        sellPriceMitra: sellPriceMitra !== undefined && sellPriceMitra !== null && sellPriceMitra !== '' ? Number(sellPriceMitra) : null,
        sellPriceGrosir: sellPriceGrosir !== undefined && sellPriceGrosir !== null && sellPriceGrosir !== '' ? Number(sellPriceGrosir) : null,
        minQtyGrosir: minQtyGrosir !== undefined && minQtyGrosir !== null && minQtyGrosir !== '' ? Number(minQtyGrosir) : null,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 1,
        imageUrl,
        status: status || 'Aktif',
        // Bengkel spare part fields
        brand: brand || null,
        vehicleType: vehicleType || null,
        storageLocation: storageLocation || null,
        recipes: rawRecipeItems && Array.isArray(rawRecipeItems) && rawRecipeItems.length > 0 ? {
          create: rawRecipeItems.map((r: any) => ({
            ingredientId: Number(r.ingredientId),
            qtyPerServing: Number(r.qtyPerServing)
          }))
        } : undefined
      },
      include: { 
        category: true, 
        subCategory: true,
        productUoms: { orderBy: { conversionRatio: 'asc' } },
        priceTiers: { orderBy: { minQty: 'asc' } },
        recipes: {
          include: {
            ingredient: {
              select: { id: true, name: true, unit: true, buyPrice: true, stock: true }
            }
          }
        }
      }
    });


    await AuditLogger.log({
      action: 'PRODUCT_CREATE',
      resource: 'PRODUCT',
      resourceId: String(product.id),
      description: `Menambahkan produk baru "${product.name}" (Rp ${product.sellPrice.toLocaleString('id-ID')}).`,
      newValue: { name: product.name, barcode: product.barcode, sellPrice: product.sellPrice, stock: product.stock },
      severity: 'INFO'
    }, req);

    // Invalidate tenant catalog cache
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (Scoped to active tenant)
router.put('/:id', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
    if (!tenantId && !isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { 
      barcode, name, categoryId, subCategoryId, buyPrice, sellPrice, 
      sellPriceRetail, sellPriceMitra, sellPriceGrosir, minQtyGrosir,
      stock, minStock, imageUrl, status,
      // Bengkel spare part fields
      brand, vehicleType, storageLocation
    } = req.body;

    // Harmonize recipe payload (accept both recipeItems and recipes from client)
    const rawRecipeItems = req.body.recipeItems !== undefined ? req.body.recipeItems : req.body.recipes;

    // Normalize empty barcode to null (prevent unique constraint violation when multiple products have no barcode)
    const normalizedBarcode = barcode && String(barcode).trim() !== '' ? String(barcode).trim() : null;

    const oldProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        ...(!isPlatformAdmin ? { tenantId } : {})
      }
    });

    if (!oldProduct) {
      return res.status(404).json({ error: 'Produk tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    if (categoryId !== undefined && !isPlatformAdmin) {
      // Zero IDOR: Wajib verifikasi kepemilikan kategori oleh tenant aktif sebelum update
      const validCategory = await prisma.category.findFirst({
        where: { id: Number(categoryId), tenantId, deletedAt: null }
      });
      if (!validCategory) {
        return res.status(400).json({ error: 'Kategori tidak valid atau bukan milik outlet Anda' });
      }
    }

    if (subCategoryId !== undefined && subCategoryId !== null && !isPlatformAdmin) {
      // Zero IDOR: Wajib verifikasi kepemilikan sub-kategori oleh tenant aktif sebelum update
      const validSubCategory = await prisma.category.findFirst({
        where: { id: Number(subCategoryId), tenantId, deletedAt: null }
      });
      if (!validSubCategory) {
        return res.status(400).json({ error: 'Sub-kategori tidak valid atau bukan milik outlet Anda' });
      }
    }

    // Zero IDOR: Validasi kepemilikan setiap ingredientId oleh tenant aktif sebelum update resep
    if (rawRecipeItems !== undefined && Array.isArray(rawRecipeItems) && rawRecipeItems.length > 0 && !isPlatformAdmin) {
      const ingredientIds = rawRecipeItems.map((r: any) => Number(r.ingredientId));
      const validIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId },
        select: { id: true }
      });
      const validIngredientIds = new Set(validIngredients.map(i => i.id));
      const invalidIngredient = ingredientIds.find(id => !validIngredientIds.has(id));
      if (invalidIngredient) {
        return res.status(400).json({ error: `Bahan baku ID ${invalidIngredient} tidak valid atau bukan milik outlet Anda.`, code: 'INVALID_INGREDIENT_OWNERSHIP' });
      }
    }

    const effectiveSellPrice = sellPrice !== undefined ? Number(sellPrice) : (sellPriceRetail !== undefined ? Number(sellPriceRetail) : undefined);
    const effectiveRetail = sellPriceRetail !== undefined ? (sellPriceRetail ? Number(sellPriceRetail) : null) : (sellPrice !== undefined ? Number(sellPrice) : undefined);

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: productId },
        data: {
          barcode: normalizedBarcode,
          name,
          categoryId: categoryId ? Number(categoryId) : undefined,
          subCategoryId: subCategoryId !== undefined ? (subCategoryId ? Number(subCategoryId) : null) : undefined,
          buyPrice: buyPrice !== undefined ? Number(buyPrice) : undefined,
          sellPrice: effectiveSellPrice,
          sellPriceRetail: effectiveRetail,
          sellPriceMitra: sellPriceMitra !== undefined ? (sellPriceMitra ? Number(sellPriceMitra) : null) : undefined,
          sellPriceGrosir: sellPriceGrosir !== undefined ? (sellPriceGrosir ? Number(sellPriceGrosir) : null) : undefined,
          minQtyGrosir: minQtyGrosir !== undefined ? (minQtyGrosir ? Number(minQtyGrosir) : null) : undefined,
          stock: stock !== undefined ? Number(stock) : undefined,
          minStock: minStock !== undefined ? Number(minStock) : undefined,
          imageUrl,
          status,
          // Bengkel spare part fields
          brand: brand !== undefined ? (brand || null) : undefined,
          vehicleType: vehicleType !== undefined ? (vehicleType || null) : undefined,
          storageLocation: storageLocation !== undefined ? (storageLocation || null) : undefined,
        }
      });

      // Update recipe items if provided
      if (rawRecipeItems !== undefined && Array.isArray(rawRecipeItems)) {
        await tx.recipeItem.deleteMany({ where: { productId } });
        if (rawRecipeItems.length > 0) {
          await tx.recipeItem.createMany({
            data: rawRecipeItems.map((r: any) => ({
              productId,
              ingredientId: Number(r.ingredientId),
              qtyPerServing: Number(r.qtyPerServing)
            }))
          });
        }
      }

      return await tx.product.findUnique({
        where: { id: productId },
        include: { 
          category: true, 
          subCategory: true,
          productUoms: { orderBy: { conversionRatio: 'asc' } },
          priceTiers: { orderBy: { minQty: 'asc' } },
          recipes: {
            include: {
              ingredient: {
                select: { id: true, name: true, unit: true, buyPrice: true, stock: true }
              }
            }
          }
        }
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

    // Invalidate tenant catalog cache
    const targetTenantId = product?.tenantId || tenantId;
    if (targetTenantId) {
      await cacheService.bumpTenantCatalogVersion(targetTenantId);
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Soft delete product (Move to Recycle Bin for 30 days)
router.delete('/:id', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
    if (!tenantId && !isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const oldProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        ...(!isPlatformAdmin ? { tenantId } : {})
      }
    });
    
    if (!oldProduct) {
      return res.status(404).json({ error: 'Produk tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    // Soft delete: set deletedAt timestamp so it can be restored within 30 days
    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() }
    });

    await AuditLogger.log({
      action: 'PRODUCT_SOFT_DELETE',
      resource: 'PRODUCT',
      resourceId: String(id),
      description: `Produk "${oldProduct.name}" dipindahkan ke Keranjang Sampah (Recycle Bin 30 hari).`,
      oldValue: { name: oldProduct.name, sellPrice: oldProduct.sellPrice, stock: oldProduct.stock },
      severity: 'WARNING'
    }, req);

    // Invalidate tenant catalog cache
    const targetTenantId = oldProduct.tenantId || tenantId;
    if (targetTenantId) {
      await cacheService.bumpTenantCatalogVersion(targetTenantId);
    }

    res.json({ 
      success: true,
      message: `Produk "${oldProduct.name}" dipindahkan ke Keranjang Sampah. Anda dapat memulihkannya dalam 30 hari.` 
    });
  } catch (error: any) {
    console.error('Failed to soft delete product:', error);
    res.status(500).json({ error: error?.message || 'Gagal menghapus produk' });
  }
});

// ─── Retail / Toko Grosir: Multi-Satuan (ProductUOM) ─────────────────────────

// GET /api/products/:id/uoms - List all UOMs for a product
router.get('/:id/uoms', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const productId = Number(req.params.id);
    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null }
    });
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    const uoms = await prisma.productUOM.findMany({
      where: { productId, tenantId },
      orderBy: { conversionRatio: 'asc' }
    });
    res.json(uoms);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data satuan.' });
  }
});

// POST /api/products/:id/uoms - Create or update UOM
router.post('/:id/uoms', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const productId = Number(req.params.id);
    const { unitName, conversionRatio, barcode, priceSell, isDefaultSale } = req.body;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });
    if (!unitName || !conversionRatio || priceSell === undefined) {
      return res.status(400).json({ error: 'Nama satuan, rasio konversi, dan harga jual wajib diisi.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null }
    });
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    const cleanUnitName = String(unitName).trim().toUpperCase();
    const cleanRatio = Math.max(1, Number(conversionRatio));
    const cleanPrice = Math.max(0, Number(priceSell));
    const cleanBarcode = barcode && String(barcode).trim() !== '' ? String(barcode).trim() : null;

    const uom = await prisma.productUOM.upsert({
      where: {
        tenantId_productId_unitName: {
          tenantId,
          productId,
          unitName: cleanUnitName
        }
      },
      update: {
        conversionRatio: cleanRatio,
        barcode: cleanBarcode,
        priceSell: cleanPrice,
        isDefaultSale: Boolean(isDefaultSale)
      },
      create: {
        tenantId,
        productId,
        unitName: cleanUnitName,
        conversionRatio: cleanRatio,
        barcode: cleanBarcode,
        priceSell: cleanPrice,
        isDefaultSale: Boolean(isDefaultSale)
      }
    });

    await cacheService.bumpTenantCatalogVersion(tenantId);
    res.json(uom);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan satuan multi-UOM.' });
  }
});

// DELETE /api/products/:id/uoms/:uomId - Delete UOM
router.delete('/:id/uoms/:uomId', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const productId = Number(req.params.id);
    const uomId = String(req.params.uomId);

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const existing = await prisma.productUOM.findFirst({
      where: { id: uomId, productId, tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Satuan tidak ditemukan.' });

    await prisma.productUOM.delete({ where: { id: uomId } });
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.json({ success: true, message: `Satuan ${existing.unitName} berhasil dihapus.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menghapus satuan.' });
  }
});

// ─── Retail / Toko Grosir: Harga Bertingkat (ProductPriceTier) ────────────────

// GET /api/products/:id/price-tiers - List tiers
router.get('/:id/price-tiers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const productId = Number(req.params.id);
    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null }
    });
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    const tiers = await prisma.productPriceTier.findMany({
      where: { productId, tenantId },
      orderBy: { minQty: 'asc' }
    });
    res.json(tiers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data tier harga.' });
  }
});

// POST /api/products/:id/price-tiers - Create or update price tier
router.post('/:id/price-tiers', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const productId = Number(req.params.id);
    const { minQty, tierName, unitPrice, customerCategory } = req.body;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });
    if (!minQty || !tierName || unitPrice === undefined) {
      return res.status(400).json({ error: 'Min Qty, nama tier, dan harga satuan wajib diisi.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null }
    });
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    const tier = await prisma.productPriceTier.create({
      data: {
        tenantId,
        productId,
        minQty: Math.max(1, Number(minQty)),
        tierName: String(tierName).trim(),
        unitPrice: Math.max(0, Number(unitPrice)),
        customerCategory: customerCategory ? String(customerCategory).trim().toUpperCase() : null
      }
    });

    await cacheService.bumpTenantCatalogVersion(tenantId);
    res.json(tier);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan tier harga.' });
  }
});

// DELETE /api/products/:id/price-tiers/:tierId - Delete tier
router.delete('/:id/price-tiers/:tierId', authenticateToken, requirePermission('products.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const productId = Number(req.params.id);
    const tierId = String(req.params.tierId);

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const existing = await prisma.productPriceTier.findFirst({
      where: { id: tierId, productId, tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Tier harga tidak ditemukan.' });

    await prisma.productPriceTier.delete({ where: { id: tierId } });
    await cacheService.bumpTenantCatalogVersion(tenantId);

    res.json({ success: true, message: `Tier harga "${existing.tierName}" berhasil dihapus.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menghapus tier harga.' });
  }
});

export default router;
