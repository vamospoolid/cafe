import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io, emitToTenant } from '../index';
import { syncMenuSoldOutStatus } from './ingredients';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Router-level fail-closed guard: all waste operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const user = (req as any).user;
  const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context tidak tersedia. Silakan login ulang.', 
      code: 'MISSING_TENANT_CONTEXT' 
    });
  }
  next();
});

// ─── POST /api/waste : Catat Waste Bahan Baku / Menu Jadi ─────────────────────
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      type = 'INGREDIENT', // 'INGREDIENT' | 'PRODUCT'
      ingredientId,
      productId,
      qty,
      reason,
      notes,
      photoUrl
    } = req.body;

    const wasteQty = Number(qty);
    if (isNaN(wasteQty) || wasteQty <= 0) {
      return res.status(400).json({ error: 'Jumlah kuantitas waste harus lebih dari 0' });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Alasan limbah / waste wajib dipilih' });
    }

    const authUser = (req as any).user || {};
    const userId = authUser.id || null;
    const userName = authUser.name || authUser.username || 'Staff Dapur';
    const tenantId = authUser.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || null;
    const outletId = authUser.outletId || TenantContext.getOutletId() || (req.headers['x-outlet-id'] as string) || null;

    const result = await prisma.$transaction(async (tx) => {
      let costPerUnit = 0;
      let totalCost = 0;
      let itemName = '';
      let category = 'FOOD';
      let unit = 'porsi';

      if (type === 'INGREDIENT') {
        if (!ingredientId) {
          throw new Error('ID Bahan Baku wajib disertakan untuk waste bahan mentah');
        }

        const ing = await tx.ingredient.findFirst({
          where: { id: Number(ingredientId) }
        });

        if (!ing) {
          throw new Error('Bahan baku tidak ditemukan di sistem');
        }

        itemName = ing.name;
        category = ing.category || 'FOOD';
        unit = ing.unit || 'satuan';
        costPerUnit = ing.buyPrice || 0;
        totalCost = Math.round(wasteQty * costPerUnit);

        // Potong stok bahan baku
        await tx.ingredient.update({
          where: { id: ing.id },
          data: { stock: { decrement: wasteQty } }
        });

        // Catat ke IngredientLog (untuk sinkronisasi kartu stok legendaris)
        const lossRef = `WASTE-ING-${Date.now().toString().slice(-6)}`;
        await tx.ingredientLog.create({
          data: {
            tenantId,
            outletId,
            ingredientId: ing.id,
            change: -wasteQty,
            cost: totalCost,
            type: 'Rusak',
            reason: reason.trim(),
            description: `[Food Waste] ${reason.trim()}${notes ? ` (${notes})` : ''} | Dicatat: ${userName} | Kerugian HPP: Rp ${totalCost.toLocaleString('id-ID')}`,
            referenceId: lossRef,
            userId
          }
        });

        // Buat entri WasteLog
        const wasteLog = await tx.wasteLog.create({
          data: {
            tenantId,
            outletId,
            type: 'INGREDIENT',
            ingredientId: ing.id,
            itemName,
            category,
            unit,
            qty: wasteQty,
            costPerUnit,
            totalCost,
            reason: reason.trim(),
            notes: notes ? String(notes).trim() : null,
            photoUrl: photoUrl || null,
            userId,
            userName
          }
        });

        return { wasteLog, totalCost, itemName, type };

      } else if (type === 'PRODUCT') {
        if (!productId) {
          throw new Error('ID Produk / Menu wajib disertakan untuk waste masakan jadi');
        }

        const product = await tx.product.findFirst({
          where: { id: Number(productId) },
          include: {
            recipes: {
              include: { ingredient: true }
            }
          }
        });

        if (!product) {
          throw new Error('Menu / Produk tidak ditemukan di sistem');
        }

        itemName = product.name;
        category = 'DISH';
        unit = 'porsi';

        // Hitung HPP dari resep jika ada, atau gunakan buyPrice bawaan
        if (product.recipes && product.recipes.length > 0) {
          costPerUnit = product.recipes.reduce((sum, r) => sum + (r.qtyPerServing * (r.ingredient?.buyPrice || 0)), 0);
          totalCost = Math.round(costPerUnit * wasteQty);

          // Potong stok bahan baku resep yang terbuang
          for (const r of product.recipes) {
            const ingDeductQty = r.qtyPerServing * wasteQty;
            const ingDeductCost = ingDeductQty * (r.ingredient?.buyPrice || 0);

            await tx.ingredient.update({
              where: { id: r.ingredientId },
              data: { stock: { decrement: ingDeductQty } }
            });

            await tx.ingredientLog.create({
              data: {
                tenantId,
                outletId,
                ingredientId: r.ingredientId,
                change: -ingDeductQty,
                cost: ingDeductCost,
                type: 'Rusak',
                reason: `[Menu Terbuang: ${product.name}] ${reason.trim()}`,
                description: `[Food Waste Menu] ${product.name} x${wasteQty} porsi (${reason.trim()}) | Dicatat: ${userName}`,
                referenceId: `WASTE-PRD-${Date.now().toString().slice(-6)}`,
                userId
              }
            });
          }
        } else {
          // Simple Product (misal: can beverage atau barang jadi)
          costPerUnit = product.buyPrice || 0;
          totalCost = Math.round(costPerUnit * wasteQty);

          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: Math.round(wasteQty) } }
          });
        }

        // Buat entri WasteLog
        const wasteLog = await tx.wasteLog.create({
          data: {
            tenantId,
            outletId,
            type: 'PRODUCT',
            productId: product.id,
            itemName,
            category,
            unit,
            qty: wasteQty,
            costPerUnit,
            totalCost,
            reason: reason.trim(),
            notes: notes ? String(notes).trim() : null,
            photoUrl: photoUrl || null,
            userId,
            userName
          }
        });

        return { wasteLog, totalCost, itemName, type };
      } else {
        throw new Error('Tipe waste tidak dikenali. Gunakan INGREDIENT atau PRODUCT');
      }
    });

    // Catat ke AuditLog sistem
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          outletId,
          userId,
          userName,
          userRole: authUser.role || 'kitchen',
          action: 'STOCK_WASTE',
          resource: 'INVENTORY',
          resourceId: `waste_${result.wasteLog.id}`,
          severity: result.totalCost >= 50000 ? 'WARNING' : 'INFO',
          description: `Pencatatan Waste: ${result.itemName} (${result.wasteLog.qty} ${result.wasteLog.unit}) - Alasan: ${result.wasteLog.reason}. Kerugian HPP: Rp ${result.totalCost.toLocaleString('id-ID')}`,
          newValue: JSON.stringify(result.wasteLog)
        }
      });
    } catch (auditErr) {
      console.error('Gagal mencatat audit log waste:', auditErr);
    }

    // Auto-sync real-time status menu sold out
    await syncMenuSoldOutStatus(prisma, tenantId || undefined);

    // Broadcast ke kru dapur & kasir real-time (terisolasi per tenant)
    if (tenantId) {
      emitToTenant(tenantId, 'inventory:waste_logged', {
        wasteLog: result.wasteLog,
        message: `Waste tercatat: ${result.itemName} (${result.wasteLog.qty} ${result.wasteLog.unit}) - Rp ${result.totalCost.toLocaleString('id-ID')}`
      });
    }

    res.status(201).json({
      message: 'Waste & Kerugian HPP berhasil dicatat ke sistem',
      ...result
    });
  } catch (error: any) {
    console.error('Error logging waste:', error);
    res.status(500).json({ error: error.message || 'Gagal mencatat waste' });
  }
});

// ─── GET /api/waste/analytics : Metrik KPI & Rasio Kerugian HPP ───────────────
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const authUser = (req as any).user || {};
    const tenantId = authUser.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);

    // SECURITY: Fail-closed — tolak request tanpa tenant context
    // Pola `if (tenantId) { whereCondition.tenantId = tenantId }` adalah FAIL-OPEN:
    // jika tenantId null, query berjalan tanpa filter dan mengembalikan data SEMUA tenant
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    let sDate: Date | null = null;
    let eDate: Date | null = null;
    const whereCondition: any = { tenantId };
    const orderWhere: any = { status: 'Paid', tenantId };

    if (startDate && endDate) {
      sDate = new Date(startDate as string);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(endDate as string);
      eDate.setHours(23, 59, 59, 999);
      whereCondition.createdAt = { gte: sDate, lte: eDate };
    }

    // Ambil seluruh log waste dalam periode
    const wasteLogs = await prisma.wasteLog.findMany({
      where: whereCondition,
      include: {
        ingredient: { select: { id: true, name: true, unit: true, category: true } },
        product: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalWasteCost = wasteLogs.reduce((sum, w) => sum + w.totalCost, 0);
    const totalWasteIncidents = wasteLogs.length;

    const totalIngredientLossCost = wasteLogs
      .filter(w => w.type === 'INGREDIENT')
      .reduce((sum, w) => sum + w.totalCost, 0);

    const totalProductLossCost = wasteLogs
      .filter(w => w.type === 'PRODUCT')
      .reduce((sum, w) => sum + w.totalCost, 0);

    // Ambil total omset penjualan dalam periode yang sama untuk kalkulasi Waste-to-Sales Ratio
    if (sDate && eDate) {
      orderWhere.OR = [
        { paidAt: { gte: sDate, lte: eDate } },
        { paidAt: null, createdAt: { gte: sDate, lte: eDate } }
      ];
    }
    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: { total: true }
    });
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const wasteToSalesRatio = totalSales > 0 ? (totalWasteCost / totalSales) * 100 : 0;

    // Breakdown per Alasan (Reason)
    const reasonMap: Record<string, { count: number; totalCost: number }> = {};
    wasteLogs.forEach(w => {
      const r = w.reason || 'Lainnya';
      if (!reasonMap[r]) reasonMap[r] = { count: 0, totalCost: 0 };
      reasonMap[r].count += 1;
      reasonMap[r].totalCost += w.totalCost;
    });

    // Breakdown per Kategori (Category)
    const categoryMap: Record<string, { count: number; totalCost: number }> = {};
    wasteLogs.forEach(w => {
      const cat = w.category || (w.type === 'PRODUCT' ? 'DISH' : 'FOOD');
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalCost: 0 };
      categoryMap[cat].count += 1;
      categoryMap[cat].totalCost += w.totalCost;
    });

    // Top 5 Item Kerugian HPP Tertinggi (Top Waste Culprits)
    const itemMap: Record<string, { itemName: string; unit: string; type: string; totalQty: number; totalCost: number; count: number }> = {};
    wasteLogs.forEach(w => {
      const key = `${w.type}_${w.itemName}`;
      if (!itemMap[key]) {
        itemMap[key] = {
          itemName: w.itemName,
          unit: w.unit,
          type: w.type,
          totalQty: 0,
          totalCost: 0,
          count: 0
        };
      }
      itemMap[key].totalQty += w.qty;
      itemMap[key].totalCost += w.totalCost;
      itemMap[key].count += 1;
    });
    const topWasteItems = Object.values(itemMap)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    // Trend Harian Kerugian HPP (Daily Waste Trend)
    const trendMap: Record<string, number> = {};
    wasteLogs.forEach(w => {
      const d = new Date(w.createdAt);
      const dateKey = d.toISOString().split('T')[0];
      trendMap[dateKey] = (trendMap[dateKey] || 0) + w.totalCost;
    });
    const dailyTrend = Object.keys(trendMap)
      .sort()
      .map(date => ({ date, totalCost: trendMap[date] }));

    // Analisis Petugas Dapur Pencatat Limbah (Staff Accountability)
    const staffMap: Record<string, { userName: string; count: number; totalCost: number }> = {};
    wasteLogs.forEach(w => {
      const uName = w.userName || (w.user ? w.user.name : 'Anonim');
      if (!staffMap[uName]) staffMap[uName] = { userName: uName, count: 0, totalCost: 0 };
      staffMap[uName].count += 1;
      staffMap[uName].totalCost += w.totalCost;
    });
    const staffBreakdown = Object.values(staffMap).sort((a, b) => b.totalCost - a.totalCost);

    res.json({
      summary: {
        totalWasteCost,
        totalWasteIncidents,
        totalIngredientLossCost,
        totalProductLossCost,
        totalSales,
        wasteToSalesRatio: Math.round(wasteToSalesRatio * 100) / 100, // e.g. 1.85%
        startDate: startDate || null,
        endDate: endDate || null
      },
      reasonBreakdown: reasonMap,
      categoryBreakdown: categoryMap,
      topWasteItems,
      dailyTrend,
      staffBreakdown,
      logs: wasteLogs
    });
  } catch (error) {
    console.error('Error waste analytics:', error);
    res.status(500).json({ error: 'Gagal memuat analisis kerugian waste' });
  }
});

// ─── GET /api/waste/logs : Riwayat Log Waste Terperinci ───────────────────────
router.get('/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type, reason, search } = req.query;
    const authUser = (req as any).user || {};
    const tenantId = authUser.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
    const where: any = {
      tenantId
    };

    if (startDate && endDate) {
      const s = new Date(startDate as string);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate as string);
      e.setHours(23, 59, 59, 999);
      where.createdAt = { gte: s, lte: e };
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (reason && reason !== 'ALL') {
      where.reason = reason;
    }

    if (search && String(search).trim()) {
      where.OR = [
        { itemName: { contains: String(search).trim(), mode: 'insensitive' } },
        { notes: { contains: String(search).trim(), mode: 'insensitive' } },
        { userName: { contains: String(search).trim(), mode: 'insensitive' } }
      ];
    }

    const logs = await prisma.wasteLog.findMany({
      where,
      include: {
        ingredient: { select: { id: true, name: true, unit: true, category: true } },
        product: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, username: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching waste logs:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat log waste' });
  }
});

// ─── DELETE /api/waste/:id : Pembatalan / Rollback Log Waste oleh Supervisor ───
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const wasteId = Number(req.params.id);
    const authUser = (req as any).user || {};
    const userRole = (authUser.role || '').toLowerCase();
    const tenantId = authUser.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);

    if (!['admin', 'owner', 'superadmin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ error: 'Hanya Supervisor / Admin yang berwenang membatalkan log waste' });
    }

    const wasteLog = await prisma.wasteLog.findFirst({
      where: { 
        id: wasteId,
        tenantId
      },
      include: {
        product: { include: { recipes: true } },
        ingredient: true
      }
    });

    if (!wasteLog) {
      return res.status(404).json({ error: 'Log waste tidak ditemukan atau bukan milik outlet Anda' });
    }

    // Rollback stok yang sebelumnya dipotong
    await prisma.$transaction(async (tx) => {
      if (wasteLog.type === 'INGREDIENT' && wasteLog.ingredientId) {
        await tx.ingredient.update({
          where: { id: wasteLog.ingredientId },
          data: { stock: { increment: wasteLog.qty } }
        });
      } else if (wasteLog.type === 'PRODUCT' && wasteLog.productId) {
        if (wasteLog.product?.recipes && wasteLog.product.recipes.length > 0) {
          for (const r of wasteLog.product.recipes) {
            await tx.ingredient.update({
              where: { id: r.ingredientId },
              data: { stock: { increment: r.qtyPerServing * wasteLog.qty } }
            });
          }
        } else {
          await tx.product.update({
            where: { id: wasteLog.productId },
            data: { stock: { increment: Math.round(wasteLog.qty) } }
          });
        }
      }

      await tx.wasteLog.delete({
        where: { id: wasteId }
      });
    });

    // Auto-sync real-time status menu
    await syncMenuSoldOutStatus(prisma, tenantId || undefined);

    res.json({
      message: `Log waste #${wasteId} (${wasteLog.itemName}) berhasil dibatalkan dan stok dikembalikan`
    });
  } catch (error: any) {
    console.error('Error deleting waste log:', error);
    res.status(500).json({ error: error.message || 'Gagal membatalkan log waste' });
  }
});

export default router;
