import { Router, Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import prisma from '../../db';

const router = Router();

/**
 * GET /api/bengkel/part-requests
 * Mengambil daftar catatan permintaan sparepart / lost sales defecta
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }

    const { status, search, brand, vehicleType } = req.query;

    const whereClause: any = {
      tenantId
    };

    if (status && status !== 'ALL') {
      whereClause.status = String(status).toUpperCase();
    }

    if (brand && brand !== 'ALL') {
      whereClause.brand = { equals: String(brand), mode: 'insensitive' };
    }

    if (vehicleType && vehicleType !== 'ALL') {
      whereClause.vehicleType = String(vehicleType).toUpperCase();
    }

    if (search) {
      const q = String(search).trim();
      whereClause.OR = [
        { partName: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [items, total, pendingCount, inPurchaseListCount, purchasedCount] = await Promise.all([
      prisma.partRequest.findMany({
        where: whereClause,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              barcode: true,
              buyPrice: true,
              sellPrice: true,
              sellPriceRetail: true,
              stock: true,
              minStock: true,
              storageLocation: true,
              brand: true
            }
          }
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
      }),
      prisma.partRequest.count({ where: { tenantId } }),
      prisma.partRequest.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.partRequest.count({ where: { tenantId, status: 'IN_PURCHASE_LIST' } }),
      prisma.partRequest.count({ where: { tenantId, status: 'PURCHASED' } })
    ]);

    return res.json({
      items,
      stats: {
        total,
        pendingCount,
        inPurchaseListCount,
        purchasedCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching part requests:', error);
    return res.status(500).json({ error: 'Gagal memuat catatan permintaan barang' });
  }
});

/**
 * GET /api/bengkel/part-requests/shopping-sheet
 * Lembar Rekomendasi Belanja Pengadaan (Kombinasi Stok Minimum + Permintaan Aktif)
 */
router.get('/shopping-sheet', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }

    // 1. Ambil produk yang stoknya sudah mencapai batas minimum atau habis (stok <= minStock)
    const allProducts = await prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'Aktif'
      },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    const lowStockProducts = allProducts.filter(p => p.stock <= p.minStock);

    // 2. Ambil catatan permintaan konsumen yang belum dibelanjakan (PENDING atau IN_PURCHASE_LIST)
    const activeRequests = await prisma.partRequest.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PURCHASE_LIST'] }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            buyPrice: true,
            stock: true,
            minStock: true,
            storageLocation: true,
            brand: true,
            category: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Normalisasi item belanja
    type ShoppingItem = {
      type: 'RESTOCK_MINIMUM' | 'CUSTOMER_REQUEST';
      id: string;
      productId?: number | null;
      partName: string;
      brand: string;
      categoryName: string;
      vehicleType?: string | null;
      currentStock: number;
      minStock: number;
      targetBuyQty: number;
      estimatedUnitPrice: number;
      estimatedSubtotal: number;
      storageLocation?: string | null;
      customerName?: string | null;
      notes?: string | null;
      requestId?: string;
    };

    const shoppingList: ShoppingItem[] = [];

    // A. Masukkan barang stok minimum
    for (const p of lowStockProducts) {
      const neededQty = Math.max(1, (p.minStock * 2) - p.stock);
      const estPrice = p.buyPrice || 0;
      shoppingList.push({
        type: 'RESTOCK_MINIMUM',
        id: `prod-${p.id}`,
        productId: p.id,
        partName: p.name,
        brand: p.brand || 'Umum',
        categoryName: p.category?.name || 'Suku Cadang',
        vehicleType: p.vehicleType || 'UMUM',
        currentStock: p.stock,
        minStock: p.minStock,
        targetBuyQty: neededQty,
        estimatedUnitPrice: estPrice,
        estimatedSubtotal: estPrice * neededQty,
        storageLocation: p.storageLocation || '-'
      });
    }

    // B. Masukkan barang permintaan konsumen (jika belum ada di shoppingList sebagai restock)
    for (const reqItem of activeRequests) {
      const estPrice = reqItem.product?.buyPrice || 0;
      const targetQty = reqItem.requestedQty || 1;
      shoppingList.push({
        type: 'CUSTOMER_REQUEST',
        id: `req-${reqItem.id}`,
        requestId: reqItem.id,
        productId: reqItem.productId,
        partName: reqItem.partName,
        brand: reqItem.brand || reqItem.product?.brand || 'Umum',
        categoryName: reqItem.product?.category?.name || 'Permintaan Part',
        vehicleType: reqItem.vehicleType || 'UMUM',
        currentStock: reqItem.product ? reqItem.product.stock : 0,
        minStock: reqItem.product ? reqItem.product.minStock : 0,
        targetBuyQty: targetQty,
        estimatedUnitPrice: estPrice,
        estimatedSubtotal: estPrice * targetQty,
        storageLocation: reqItem.product?.storageLocation || '-',
        customerName: reqItem.customerName,
        notes: reqItem.notes
      });
    }

    // 4. Hitung total estimasi modal
    const totalEstimatedModal = shoppingList.reduce((acc, item) => acc + item.estimatedSubtotal, 0);

    // 5. Kelompokkan per Brand (untuk efisiensi belanja supplier di Makassar)
    const groupedByBrand: Record<string, ShoppingItem[]> = {};
    for (const item of shoppingList) {
      const b = (item.brand || 'Lainnya').toUpperCase();
      if (!groupedByBrand[b]) groupedByBrand[b] = [];
      groupedByBrand[b].push(item);
    }

    // 6. Kelompokkan per Kategori
    const groupedByCategory: Record<string, ShoppingItem[]> = {};
    for (const item of shoppingList) {
      const c = item.categoryName || 'Suku Cadang';
      if (!groupedByCategory[c]) groupedByCategory[c] = [];
      groupedByCategory[c].push(item);
    }

    return res.json({
      summary: {
        totalItems: shoppingList.length,
        lowStockItemsCount: lowStockProducts.length,
        activeRequestsCount: activeRequests.length,
        totalEstimatedModal
      },
      items: shoppingList,
      groupedByBrand,
      groupedByCategory
    });
  } catch (error: any) {
    console.error('Error generating shopping sheet:', error);
    return res.status(500).json({ error: 'Gagal menghasilkan lembar rekomendasi belanja' });
  }
});

/**
 * POST /api/bengkel/part-requests
 * Menambahkan catatan permintaan barang / lost sales baru
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }

    const {
      partName,
      brand,
      vehicleType,
      requestedQty,
      notes,
      customerName,
      customerPhone,
      productId,
      targetPurchaseDate
    } = req.body;

    if (!partName || !String(partName).trim()) {
      return res.status(400).json({ error: 'Nama sparepart wajib diisi' });
    }

    // Double validate productId ownership if provided to prevent cross-tenant IDOR
    let validProductId: number | null = null;
    if (productId) {
      const existingProduct = await prisma.product.findFirst({
        where: { id: Number(productId), tenantId }
      });
      if (existingProduct) {
        validProductId = existingProduct.id;
      }
    }

    const newRequest = await prisma.partRequest.create({
      data: {
        tenantId,
        productId: validProductId,
        partName: String(partName).trim(),
        brand: brand ? String(brand).trim() : null,
        vehicleType: vehicleType ? String(vehicleType).toUpperCase() : 'MOTOR',
        requestedQty: Math.max(1, Number(requestedQty) || 1),
        notes: notes ? String(notes).trim() : null,
        customerName: customerName ? String(customerName).trim() : null,
        customerPhone: customerPhone ? String(customerPhone).trim() : null,
        targetPurchaseDate: targetPurchaseDate ? new Date(targetPurchaseDate) : null,
        status: 'PENDING'
      },
      include: {
        product: {
          select: { id: true, name: true, buyPrice: true, stock: true, brand: true }
        }
      }
    });

    // Real-time notification strictly inside tenant room
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('bengkel:part_request_created', newRequest);

    return res.status(201).json(newRequest);
  } catch (error: any) {
    console.error('Error creating part request:', error);
    return res.status(500).json({ error: 'Gagal menyimpan catatan permintaan sparepart' });
  }
});

/**
 * PATCH /api/bengkel/part-requests/:id/status
 * Memperbarui status catatan permintaan barang
 */
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    const id = String(req.params.id);
    const { status } = req.body;

    const validStatuses = ['PENDING', 'IN_PURCHASE_LIST', 'PURCHASED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    // Double validate ownership
    const existing = await prisma.partRequest.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Catatan permintaan tidak ditemukan' });
    }

    const updated = await prisma.partRequest.update({
      where: { id },
      data: { status }
    });

    req.app.get('io')?.to(`tenant:${tenantId}`).emit('bengkel:part_request_updated', updated);

    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating part request status:', error);
    return res.status(500).json({ error: 'Gagal memperbarui status permintaan' });
  }
});

/**
 * PUT /api/bengkel/part-requests/:id
 * Mengubah detail catatan permintaan
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    const id = String(req.params.id);
    const {
      partName,
      brand,
      vehicleType,
      requestedQty,
      notes,
      customerName,
      customerPhone,
      status,
      targetPurchaseDate
    } = req.body;

    const existing = await prisma.partRequest.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Catatan permintaan tidak ditemukan' });
    }

    const updated = await prisma.partRequest.update({
      where: { id },
      data: {
        ...(partName && { partName: String(partName).trim() }),
        ...(brand !== undefined && { brand: brand ? String(brand).trim() : null }),
        ...(vehicleType && { vehicleType: String(vehicleType).toUpperCase() }),
        ...(requestedQty !== undefined && { requestedQty: Math.max(1, Number(requestedQty) || 1) }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...(customerName !== undefined && { customerName: customerName ? String(customerName).trim() : null }),
        ...(customerPhone !== undefined && { customerPhone: customerPhone ? String(customerPhone).trim() : null }),
        ...(status && { status: String(status).toUpperCase() }),
        ...(targetPurchaseDate !== undefined && {
          targetPurchaseDate: targetPurchaseDate ? new Date(targetPurchaseDate) : null
        })
      }
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating part request:', error);
    return res.status(500).json({ error: 'Gagal memperbarui catatan permintaan' });
  }
});

/**
 * DELETE /api/bengkel/part-requests/:id
 * Menghapus catatan permintaan
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    const id = String(req.params.id);

    const existing = await prisma.partRequest.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Catatan permintaan tidak ditemukan' });
    }

    await prisma.partRequest.delete({
      where: { id }
    });

    return res.json({ message: 'Catatan permintaan berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting part request:', error);
    return res.status(500).json({ error: 'Gagal menghapus catatan permintaan' });
  }
});

/**
 * POST /api/bengkel/part-requests/:id/convert-to-product
 * 1-Klik Konversi Catatan Permintaan Menjadi Master Produk Baru di Katalog
 */
router.post('/:id/convert-to-product', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    const id = String(req.params.id);
    const {
      categoryId,
      buyPrice = 0,
      sellPriceRetail,
      sellPriceMitra,
      sellPriceGrosir,
      stock = 0,
      minStock = 1,
      barcode,
      storageLocation
    } = req.body;

    const existingRequest = await prisma.partRequest.findFirst({
      where: { id, tenantId }
    });

    if (!existingRequest) {
      return res.status(404).json({ error: 'Catatan permintaan tidak ditemukan' });
    }

    if (!categoryId) {
      return res.status(400).json({ error: 'Kategori produk wajib dipilih' });
    }

    // Verify category belongs to tenant
    const category = await prisma.category.findFirst({
      where: { id: Number(categoryId), tenantId }
    });
    if (!category) {
      return res.status(400).json({ error: 'Kategori tidak valid' });
    }

    const retailPrice = Number(sellPriceRetail) || Number(buyPrice) * 1.25;

    // Transaction: Create Product & Update PartRequest
    const result = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          tenantId,
          name: existingRequest.partName,
          brand: existingRequest.brand,
          vehicleType: existingRequest.vehicleType || 'MOTOR',
          categoryId: Number(categoryId),
          buyPrice: Number(buyPrice),
          sellPrice: retailPrice,
          sellPriceRetail: retailPrice,
          sellPriceMitra: sellPriceMitra ? Number(sellPriceMitra) : null,
          sellPriceGrosir: sellPriceGrosir ? Number(sellPriceGrosir) : null,
          stock: Number(stock),
          minStock: Number(minStock) || 1,
          barcode: barcode ? String(barcode).trim() : null,
          storageLocation: storageLocation ? String(storageLocation).trim() : null,
          status: 'Aktif'
        }
      });

      const updatedRequest = await tx.partRequest.update({
        where: { id },
        data: {
          productId: newProduct.id,
          status: 'PURCHASED'
        }
      });

      return { product: newProduct, partRequest: updatedRequest };
    });

    req.app.get('io')?.to(`tenant:${tenantId}`).emit('bengkel:part_request_converted', result);

    return res.status(201).json({
      message: 'Berhasil mendaftarkan produk baru dari catatan permintaan',
      data: result
    });
  } catch (error: any) {
    console.error('Error converting part request to product:', error);
    return res.status(500).json({ error: 'Gagal mengonversi catatan ke produk baru' });
  }
});

export default router;
