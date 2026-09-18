import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io } from '../index';

const router = Router();
const prisma = new PrismaClient();

// Helper to check and emit sold out status in real-time
export async function syncMenuSoldOutStatus(txOrPrisma: any = prisma) {
  try {
    const products = await txOrPrisma.product.findMany({
      where: { status: 'Aktif' },
      include: {
        recipes: { include: { ingredient: true } }
      }
    });

    const soldOutProducts: any[] = [];
    const availableProducts: any[] = [];

    products.forEach((prod: any) => {
      let isSoldOut = false;
      let bottleneck = null;

      if (!prod.recipes || prod.recipes.length === 0) {
        if (prod.stock <= 0) {
          isSoldOut = true;
          bottleneck = 'Stok Produk Habis (0)';
        }
      } else {
        for (const r of prod.recipes) {
          const currentIngStock = r.ingredient?.stock || 0;
          if (currentIngStock < (r.qtyPerServing || 1)) {
            isSoldOut = true;
            bottleneck = `${r.ingredient?.name || 'Bahan'} Habis (Sisa ${currentIngStock} ${r.ingredient?.unit || ''})`;
            break;
          }
        }
      }

      if (isSoldOut) {
        soldOutProducts.push({
          id: prod.id,
          name: prod.name,
          sellPrice: prod.sellPrice,
          bottleneck
        });
      } else {
        availableProducts.push({
          id: prod.id,
          name: prod.name,
          sellPrice: prod.sellPrice
        });
      }
    });

    if (io) {
      io.emit('menu:stock_sync', {
        soldOutProducts,
        availableProducts,
        timestamp: new Date().toISOString()
      });
      if (soldOutProducts.length > 0) {
        io.emit('product:sold_out', {
          soldOutProducts,
          message: `Stok bahan baku diperbarui: ${soldOutProducts.length} menu sold out!`
        });
      }
    }

    return { soldOutProducts, availableProducts };
  } catch (err) {
    console.error('Error syncing menu sold out status:', err);
  }
}

// GET all ingredients
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data bahan baku' });
  }
});

// GET production forecast & menu capacity (Analisis Menu Hampir Habis & Sold Out)
router.get('/production-forecast', authenticateToken, async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'Aktif' },
      include: {
        category: { select: { id: true, name: true } },
        recipes: {
          include: {
            ingredient: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const forecast = products.map((prod) => {
      if (!prod.recipes || prod.recipes.length === 0) {
        return {
          productId: prod.id,
          productName: prod.name,
          categoryName: prod.category?.name || 'Tanpa Kategori',
          sellPrice: prod.sellPrice,
          buyPrice: prod.buyPrice,
          imageUrl: prod.imageUrl,
          hasRecipe: false,
          maxPortions: prod.stock,
          status: prod.stock === 0 ? 'Habis (Sold Out)' : (prod.stock <= prod.minStock ? 'Kritis' : 'Aman'),
          bottleneck: null,
          recipeDetails: []
        };
      }

      let maxPortions = Infinity;
      let bottleneck: any = null;
      let calculatedHPP = 0;

      const recipeDetails = prod.recipes.map((r) => {
        const cost = (r.qtyPerServing || 0) * (r.ingredient?.buyPrice || 0);
        calculatedHPP += cost;
        const possible = r.qtyPerServing > 0 
          ? Math.floor((r.ingredient?.stock || 0) / r.qtyPerServing) 
          : 0;

        if (possible < maxPortions) {
          maxPortions = possible;
          bottleneck = {
            ingredientId: r.ingredient.id,
            ingredientName: r.ingredient.name,
            currentStock: r.ingredient.stock,
            qtyPerServing: r.qtyPerServing,
            unit: r.ingredient.unit,
            maxPortions: possible
          };
        }

        return {
          ingredientId: r.ingredient.id,
          ingredientName: r.ingredient.name,
          unit: r.ingredient.unit,
          qtyPerServing: r.qtyPerServing,
          currentStock: r.ingredient.stock,
          costPerServing: cost,
          maxPortions: possible
        };
      });

      if (maxPortions === Infinity) maxPortions = 0;

      let status = 'Aman';
      if (maxPortions === 0) {
        status = 'Habis (Sold Out)';
      } else if (maxPortions <= 5) {
        status = 'Kritis (Hampir Habis)';
      } else if (maxPortions <= 15) {
        status = 'Menipis';
      }

      return {
        productId: prod.id,
        productName: prod.name,
        categoryName: prod.category?.name || 'Tanpa Kategori',
        sellPrice: prod.sellPrice,
        buyPrice: calculatedHPP > 0 ? calculatedHPP : prod.buyPrice,
        imageUrl: prod.imageUrl,
        hasRecipe: true,
        maxPortions,
        status,
        bottleneck,
        recipeDetails
      };
    });

    res.json(forecast);
  } catch (error) {
    console.error('Error production forecast:', error);
    res.status(500).json({ error: 'Gagal menganalisis kapasitas produksi menu' });
  }
});

// POST stock opname audit (Analisis Selisih Stok Sistem vs Fisik & Auto-Adjust)
router.post('/stock-opname', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { items, auditorName, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Data item stock opname tidak boleh kosong' });
    }

    const opnameRef = `OPNAME-${Date.now().toString().slice(-6)}`;
    let totalItemsChecked = 0;
    let totalMissCount = 0;
    let totalLossValue = 0; // dalam Rp
    const processedItems: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const ing = await tx.ingredient.findUnique({
          where: { id: Number(item.ingredientId) }
        });
        if (!ing) continue;

        totalItemsChecked++;
        const systemStock = ing.stock;
        const physicalStock = Number(item.physicalStock);
        const variance = physicalStock - systemStock; // (-) jika hilang/susut, (+) jika lebih
        const varianceValue = variance * ing.buyPrice;

        if (Math.abs(variance) > 0.001) {
          totalMissCount++;
          if (variance < 0) {
            totalLossValue += Math.abs(varianceValue);
          }

          // Update stok bahan baku ke jumlah fisik riil
          await tx.ingredient.update({
            where: { id: ing.id },
            data: { stock: physicalStock }
          });

          // Catat ke log
          const reasonLabel = item.reason || 'Penyesuaian Fisik';
          const noteText = item.notes ? ` - ${item.notes}` : '';
          const lossText = variance < 0 ? ` (Nominal Miss: Rp ${Math.abs(varianceValue).toLocaleString('id-ID')})` : ' (Stok Fisik Lebih)';
          
          await tx.ingredientLog.create({
            data: {
              ingredientId: ing.id,
              change: variance,
              type: 'Stock Opname',
              description: `[${opnameRef}] ${reasonLabel}${noteText}${lossText} | Auditor: ${auditorName || 'Admin'} | Sistem: ${systemStock} ${ing.unit} ➔ Fisik: ${physicalStock} ${ing.unit}`,
              referenceId: opnameRef,
              userId: (req as any).user?.id || null
            }
          });
        }

        processedItems.push({
          ingredientId: ing.id,
          name: ing.name,
          unit: ing.unit,
          buyPrice: ing.buyPrice,
          systemStock,
          physicalStock,
          variance,
          varianceValue,
          reason: item.reason || 'Normal',
          notes: item.notes || ''
        });
      }
    });

    res.json({
      message: 'Stock opname berhasil disimpan dan stok telah diperbarui',
      opnameRef,
      summary: {
        totalItemsChecked,
        totalMissCount,
        totalLossValue,
        auditorName: auditorName || 'Admin',
        date: new Date().toISOString()
      },
      items: processedItems
    });
  } catch (error) {
    console.error('Error stock opname:', error);
    res.status(500).json({ error: 'Gagal memproses stock opname' });
  }
});

// GET stock opname audit history
router.get('/stock-opname/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.ingredientLog.findMany({
      where: { type: 'Stock Opname' },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, buyPrice: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error) {
    console.error('Error opname history:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat stock opname' });
  }
});

// GET low-stock ingredients (stok <= minStock)
router.get('/low-stock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const all = await prisma.ingredient.findMany({ 
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { stock: 'asc' } 
    });
    const lowStock = all.filter(i => i.stock <= i.minStock);
    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data stok menipis' });
  }
});

// POST create ingredient
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, category, subCategory, unit, stock, minStock, buyPrice, supplierId, purchaseUnit, conversionRatio, warehouseMinStock } = req.body;
    const ingredient = await prisma.ingredient.create({
      data: {
        name: name ? name.trim() : '',
        category: category || 'FOOD',
        subCategory: subCategory ? subCategory.trim() : null,
        unit,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        buyPrice: Number(buyPrice) || 0,
        supplierId: supplierId ? Number(supplierId) : null,
        purchaseUnit: purchaseUnit ? purchaseUnit.trim() : null,
        conversionRatio: Number(conversionRatio) > 0 ? Number(conversionRatio) : 1,
        warehouseMinStock: Number(warehouseMinStock) || 0
      },
      include: { supplier: { select: { id: true, name: true } } }
    });
    res.status(201).json(ingredient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat bahan baku' });
  }
});

// PUT update ingredient
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, subCategory, unit, stock, minStock, buyPrice, supplierId, purchaseUnit, conversionRatio, warehouseMinStock } = req.body;
    const ingredient = await prisma.ingredient.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        category: category !== undefined ? category : undefined,
        subCategory: subCategory !== undefined ? (subCategory ? subCategory.trim() : null) : undefined,
        unit,
        stock: stock !== undefined ? Number(stock) : undefined,
        minStock: minStock !== undefined ? Number(minStock) : undefined,
        buyPrice: buyPrice !== undefined ? Number(buyPrice) : undefined,
        supplierId: supplierId !== undefined ? (supplierId ? Number(supplierId) : null) : undefined,
        purchaseUnit: purchaseUnit !== undefined ? (purchaseUnit ? purchaseUnit.trim() : null) : undefined,
        conversionRatio: conversionRatio !== undefined ? (Number(conversionRatio) > 0 ? Number(conversionRatio) : 1) : undefined,
        warehouseMinStock: warehouseMinStock !== undefined ? Number(warehouseMinStock) : undefined
      },
      include: { supplier: { select: { id: true, name: true } } }
    });
    res.json(ingredient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui bahan baku' });
  }
});

// POST Catat Stock Loss / Waste (Busuk, Rusak, Kadaluarsa, Trimming)
router.post('/loss', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ingredientId, qtyLoss, reason, notes } = req.body;
    const qty = Number(qtyLoss);
    if (!ingredientId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Data pencatatan stock loss tidak valid' });
    }
    const userId = (req as any).user?.id || null;
    const userName = (req as any).user?.name || 'Staff Dapur';

    const result = await prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUnique({ where: { id: Number(ingredientId) } });
      if (!ing) throw new Error('Bahan baku tidak ditemukan');

      const cost = qty * ing.buyPrice;
      const updated = await tx.ingredient.update({
        where: { id: ing.id },
        data: { stock: { decrement: qty } }
      });

      const lossRef = `LOSS-${Date.now().toString().slice(-6)}`;
      const reasonLabel = reason || 'Busuk / Kadaluarsa';
      const noteText = notes ? ` (${notes})` : '';

      const log = await tx.ingredientLog.create({
        data: {
          ingredientId: ing.id,
          change: -qty,
          cost,
          type: 'Rusak',
          reason: reasonLabel,
          description: `[Stock Loss] ${reasonLabel}${noteText} | Dicatat oleh: ${userName} | Kerugian: Rp ${cost.toLocaleString('id-ID')}`,
          referenceId: lossRef,
          userId
        }
      });

      return { ingredient: updated, log, cost };
    });

    // Auto-sync real-time sold out menu status across Kasir & QR Dine-In
    await syncMenuSoldOutStatus(prisma);

    res.status(201).json({ message: 'Stock loss berhasil dicatat', ...result });
  } catch (error: any) {
    console.error('Error logging stock loss:', error);
    res.status(500).json({ error: error.message || 'Gagal mencatat stock loss' });
  }
});

// GET Analisis Stock Loss & Efisiensi Yield
router.get('/loss-analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const whereCondition: any = {
      type: { in: ['Rusak', 'Loss'] }
    };

    let sDate: Date | null = null;
    let eDate: Date | null = null;

    if (startDate && endDate) {
      sDate = new Date(startDate as string);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(endDate as string);
      eDate.setHours(23, 59, 59, 999);
      whereCondition.createdAt = { gte: sDate, lte: eDate };
    }

    const lossLogs = await prisma.ingredientLog.findMany({
      where: whereCondition,
      include: {
        ingredient: { select: { id: true, name: true, unit: true, buyPrice: true, category: true } },
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Hitung total kerugian
    const totalLossCost = lossLogs.reduce((sum, log) => sum + (log.cost || (Math.abs(log.change) * (log.ingredient?.buyPrice || 0))), 0);
    const totalLossCount = lossLogs.length;

    // Hitung total pemakaian produksi
    const productionLogs = await prisma.ingredientLog.findMany({
      where: {
        type: 'Produksi',
        ...(sDate && eDate ? { createdAt: { gte: sDate, lte: eDate } } : {})
      },
      include: { ingredient: { select: { buyPrice: true } } }
    });
    const totalProductionCost = productionLogs.reduce((sum, log) => sum + (Math.abs(log.change) * (log.ingredient?.buyPrice || 0)), 0);

    const totalDispatchedCost = totalProductionCost + totalLossCost;
    const lossPercentage = totalDispatchedCost > 0 ? ((totalLossCost / totalDispatchedCost) * 100) : 0;
    const efficiencyPercentage = totalDispatchedCost > 0 ? ((totalProductionCost / totalDispatchedCost) * 100) : 100;

    // Breakdown per alasan
    const reasonMap: Record<string, { count: number; cost: number }> = {};
    lossLogs.forEach(log => {
      const r = log.reason || 'Lainnya';
      const c = log.cost || (Math.abs(log.change) * (log.ingredient?.buyPrice || 0));
      if (!reasonMap[r]) reasonMap[r] = { count: 0, cost: 0 };
      reasonMap[r].count += 1;
      reasonMap[r].cost += c;
    });

    // Top 5 loss items
    const itemMap: Record<number, { id: number; name: string; unit: string; totalQty: number; totalCost: number }> = {};
    lossLogs.forEach(log => {
      const id = log.ingredientId;
      const qty = Math.abs(log.change);
      const c = log.cost || (qty * (log.ingredient?.buyPrice || 0));
      if (!itemMap[id]) {
        itemMap[id] = {
          id,
          name: log.ingredient?.name || 'Unknown',
          unit: log.ingredient?.unit || '',
          totalQty: 0,
          totalCost: 0
        };
      }
      itemMap[id].totalQty += qty;
      itemMap[id].totalCost += c;
    });

    const topLossItems = Object.values(itemMap).sort((a, b) => b.totalCost - a.totalCost).slice(0, 5);

    res.json({
      summary: {
        totalLossCost,
        totalLossCount,
        totalProductionCost,
        lossPercentage: Math.round(lossPercentage * 10) / 10,
        efficiencyPercentage: Math.round(efficiencyPercentage * 10) / 10,
        startDate: startDate || null,
        endDate: endDate || null
      },
      reasons: reasonMap,
      topLossItems,
      logs: lossLogs
    });
  } catch (error) {
    console.error('Error loss analytics:', error);
    res.status(500).json({ error: 'Gagal mengambil analisis kerugian stok' });
  }
});

// GET Analisis Aktivitas & Akuntabilitas Staf Dapur (Per-User Audit & Loss Analytics)
router.get('/staff-activity-analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, userId } = req.query;
    let sDate: Date | undefined;
    let eDate: Date | undefined;
    const dateFilter: any = {};

    if (startDate && endDate) {
      sDate = new Date(startDate as string);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(endDate as string);
      eDate.setHours(23, 59, 59, 999);
      dateFilter.gte = sDate;
      dateFilter.lte = eDate;
    }

    const whereCondition: any = {
      ...(sDate && eDate ? { createdAt: dateFilter } : {})
    };

    if (userId && userId !== 'ALL') {
      whereCondition.userId = Number(userId);
    }

    // Ambil semua log bahan baku dalam rentang tanggal
    const allLogs = await prisma.ingredientLog.findMany({
      where: whereCondition,
      include: {
        ingredient: { select: { id: true, name: true, unit: true, buyPrice: true, category: true } },
        user: { select: { id: true, name: true, role: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Ambil daftar semua user untuk pemetaan
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, role: true, username: true, status: true }
    });
    const userMap: Record<number, any> = {};
    allUsers.forEach(u => {
      userMap[u.id] = {
        user: u,
        totalActions: 0,
        restockCount: 0,
        lossCount: 0,
        adjustmentCount: 0,
        productionCount: 0,
        staffMealCount: 0,
        otherCount: 0,
        totalLossCost: 0,
        humanErrorCost: 0,
        spoilageCost: 0,
        staffMealCost: 0,
        recentLogs: []
      };
    });

    // User anonim/sistem untuk log tanpa userId
    userMap[0] = {
      user: { id: 0, name: 'Sistem / Tanpa Nama', role: 'Sistem', username: 'system' },
      totalActions: 0,
      restockCount: 0,
      lossCount: 0,
      adjustmentCount: 0,
      productionCount: 0,
      staffMealCount: 0,
      otherCount: 0,
      totalLossCost: 0,
      humanErrorCost: 0,
      spoilageCost: 0,
      staffMealCost: 0,
      recentLogs: []
    };

    let teamTotalActions = 0;
    let teamTotalLossCost = 0;
    let teamHumanErrorCost = 0;
    let teamSpoilageCost = 0;
    let teamStaffMealCost = 0;
    let teamRestockCount = 0;
    let teamAdjustmentCount = 0;
    let teamLossCount = 0;
    let teamProductionCount = 0;

    allLogs.forEach(log => {
      const uId = log.userId || 0;
      if (!userMap[uId]) {
        userMap[uId] = {
          user: log.user || { id: uId, name: `User #${uId}`, role: 'Staf', username: `user_${uId}` },
          totalActions: 0,
          restockCount: 0,
          lossCount: 0,
          adjustmentCount: 0,
          productionCount: 0,
          staffMealCount: 0,
          otherCount: 0,
          totalLossCost: 0,
          humanErrorCost: 0,
          spoilageCost: 0,
          staffMealCost: 0,
          recentLogs: []
        };
      }

      const target = userMap[uId];
      target.totalActions += 1;
      teamTotalActions += 1;

      if (target.recentLogs.length < 10) {
        target.recentLogs.push(log);
      }

      const logType = (log.type || '').toLowerCase();
      const reasonStr = (log.reason || log.description || '').toLowerCase();
      const itemCost = log.cost || (Math.abs(log.change) * (log.ingredient?.buyPrice || 0));

      const isStaffMeal = reasonStr.includes('makan') || reasonStr.includes('konsumsi') || reasonStr.includes('staff meal');
      const isHumanError = reasonStr.includes('gosong') || reasonStr.includes('salah') || reasonStr.includes('tumpah') || 
                           reasonStr.includes('kelalaian') || reasonStr.includes('rusak fisik') || reasonStr.includes('over');

      if (logType === 'restock' || logType === 'po') {
        target.restockCount += 1;
        teamRestockCount += 1;
      } else if (logType === 'rusak' || logType === 'loss') {
        target.lossCount += 1;
        teamLossCount += 1;
        target.totalLossCost += itemCost;
        teamTotalLossCost += itemCost;

        if (isStaffMeal) {
          target.staffMealCount += 1;
          target.staffMealCost += itemCost;
          teamStaffMealCost += itemCost;
        } else if (isHumanError) {
          target.humanErrorCost += itemCost;
          teamHumanErrorCost += itemCost;
        } else {
          target.spoilageCost += itemCost;
          teamSpoilageCost += itemCost;
        }
      } else if (logType === 'penyesuaian') {
        target.adjustmentCount += 1;
        teamAdjustmentCount += 1;
        if (log.change < 0) {
          target.totalLossCost += itemCost;
          teamTotalLossCost += itemCost;
          if (isStaffMeal) {
            target.staffMealCost += itemCost;
            teamStaffMealCost += itemCost;
          } else {
            target.humanErrorCost += itemCost;
            teamHumanErrorCost += itemCost;
          }
        }
      } else if (logType === 'produksi') {
        target.productionCount += 1;
        teamProductionCount += 1;
      } else {
        target.otherCount += 1;
      }
    });

    // Hitung persentase untuk masing-masing staf
    const staffList = Object.values(userMap)
      .filter((s: any) => s.totalActions > 0 || (s.user.id !== 0 && (s.user.role === 'Dapur' || s.user.role === 'Admin' || s.user.role === 'Kasir')))
      .map((s: any) => {
        const total = s.totalActions || 1;
        const totalLoss = s.totalLossCost || 1;
        return {
          ...s,
          activityPercentages: {
            restock: Math.round(((s.restockCount / total) * 100) * 10) / 10,
            loss: Math.round(((s.lossCount / total) * 100) * 10) / 10,
            adjustment: Math.round(((s.adjustmentCount / total) * 100) * 10) / 10,
            production: Math.round(((s.productionCount / total) * 100) * 10) / 10,
            staffMeal: Math.round(((s.staffMealCount / total) * 100) * 10) / 10
          },
          lossCompositionPercentages: {
            humanError: s.totalLossCost > 0 ? Math.round(((s.humanErrorCost / s.totalLossCost) * 100) * 10) / 10 : 0,
            spoilage: s.totalLossCost > 0 ? Math.round(((s.spoilageCost / s.totalLossCost) * 100) * 10) / 10 : 0,
            staffMeal: s.totalLossCost > 0 ? Math.round(((s.staffMealCost / s.totalLossCost) * 100) * 10) / 10 : 0
          },
          teamLossSharePercentage: teamTotalLossCost > 0 ? Math.round(((s.totalLossCost / teamTotalLossCost) * 100) * 10) / 10 : 0
        };
      })
      .sort((a, b) => b.totalActions - a.totalActions);

    res.json({
      summary: {
        teamTotalActions,
        teamTotalLossCost,
        teamHumanErrorCost,
        teamSpoilageCost,
        teamStaffMealCost,
        teamRestockCount,
        teamAdjustmentCount,
        teamLossCount,
        teamProductionCount,
        teamActivityPercentages: {
          restock: teamTotalActions > 0 ? Math.round(((teamRestockCount / teamTotalActions) * 100) * 10) / 10 : 0,
          loss: teamTotalActions > 0 ? Math.round(((teamLossCount / teamTotalActions) * 100) * 10) / 10 : 0,
          adjustment: teamTotalActions > 0 ? Math.round(((teamAdjustmentCount / teamTotalActions) * 100) * 10) / 10 : 0,
          production: teamTotalActions > 0 ? Math.round(((teamProductionCount / teamTotalActions) * 100) * 10) / 10 : 0
        },
        teamLossCompositionPercentages: {
          humanError: teamTotalLossCost > 0 ? Math.round(((teamHumanErrorCost / teamTotalLossCost) * 100) * 10) / 10 : 0,
          spoilage: teamTotalLossCost > 0 ? Math.round(((teamSpoilageCost / teamTotalLossCost) * 100) * 10) / 10 : 0,
          staffMeal: teamTotalLossCost > 0 ? Math.round(((teamStaffMealCost / teamTotalLossCost) * 100) * 10) / 10 : 0
        },
        startDate: startDate || null,
        endDate: endDate || null
      },
      staffList
    });
  } catch (error) {
    console.error('Error staff activity analytics:', error);
    res.status(500).json({ error: 'Gagal mengambil analisis aktivitas staf' });
  }
});

// GET Analisis Belanja Cerdas & Restock
router.get('/shopping-analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const horizonDays = Math.max(1, Number(req.query.days) || 14);

    const ingredients = await prisma.ingredient.findMany({
      include: { supplier: true },
      orderBy: { name: 'asc' }
    });

    // Ambil pemakaian sesuai horizon hari yang dipilih (default: 14 hari)
    const horizonAgo = new Date();
    horizonAgo.setDate(horizonAgo.getDate() - horizonDays);
    horizonAgo.setHours(0, 0, 0, 0);

    const recentLogs = await prisma.ingredientLog.findMany({
      where: {
        type: 'Produksi',
        createdAt: { gte: horizonAgo }
      }
    });

    const usageMap: Record<number, number> = {};
    recentLogs.forEach(log => {
      usageMap[log.ingredientId] = (usageMap[log.ingredientId] || 0) + Math.abs(log.change);
    });

    let totalRestockCost = 0;
    const recommendations = ingredients.map(ing => {
      const totalHorizonUsage = usageMap[ing.id] || 0;
      const dailyBurnRate = Math.round((totalHorizonUsage / horizonDays) * 10) / 10;
      
      let status = 'Aman';
      if (ing.stock === 0) status = 'Kritis (Habis)';
      else if (ing.stock <= ing.minStock) status = 'Menipis';

      const targetStock = Math.max(ing.minStock * 2, dailyBurnRate * 7, 1);
      const suggestedQty = Math.max(0, Math.ceil(targetStock - ing.stock));
      const estimatedCost = suggestedQty * ing.buyPrice;

      if (ing.stock <= ing.minStock && suggestedQty > 0) {
        totalRestockCost += estimatedCost;
      }

      return {
        id: ing.id,
        name: ing.name,
        category: (ing as any).category || 'FOOD',
        unit: ing.unit,
        stock: ing.stock,
        minStock: ing.minStock,
        buyPrice: ing.buyPrice,
        supplier: ing.supplier ? { id: ing.supplier.id, name: ing.supplier.name, phone: ing.supplier.phone } : null,
        dailyBurnRate,
        status,
        suggestedQty,
        estimatedCost
      };
    });

    const lowStockItems = recommendations.filter(r => r.stock <= r.minStock);

    // Group by supplier
    const supplierGrouping: Record<string, { supplierId: number | null; supplierName: string; phone?: string | null; items: any[]; totalCost: number }> = {};
    lowStockItems.forEach(item => {
      const sName = item.supplier?.name || 'Tanpa Supplier';
      const sId = item.supplier?.id || null;
      if (!supplierGrouping[sName]) {
        supplierGrouping[sName] = {
          supplierId: sId,
          supplierName: sName,
          phone: item.supplier?.phone,
          items: [],
          totalCost: 0
        };
      }
      supplierGrouping[sName].items.push(item);
      supplierGrouping[sName].totalCost += item.estimatedCost;
    });

    res.json({
      summary: {
        totalLowStockCount: lowStockItems.length,
        totalCriticalCount: lowStockItems.filter(i => i.stock === 0).length,
        totalRestockCost,
        horizonDays
      },
      lowStockItems,
      allRecommendations: recommendations,
      supplierGrouping: Object.values(supplierGrouping)
    });
  } catch (error) {
    console.error('Error shopping analytics:', error);
    res.status(500).json({ error: 'Gagal menganalisis kebutuhan belanja' });
  }
});

// GET Analisis Tingkat Keberhasilan Porsi & Audit Efisiensi (Yield & Variance Analysis)
router.get('/yield-analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { days, startDate, endDate, category, scope } = req.query;

    let dStart: Date;
    let dEnd: Date = new Date();
    dEnd.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      dStart = new Date(startDate as string);
      dStart.setHours(0, 0, 0, 0);
      dEnd = new Date(endDate as string);
      dEnd.setHours(23, 59, 59, 999);
    } else {
      const horizonDays = Math.max(1, Number(days) || 14);
      dStart = new Date();
      dStart.setDate(dStart.getDate() - (horizonDays - 1));
      dStart.setHours(0, 0, 0, 0);
    }

    // 1. Ambil seluruh transaksi penjualan yang valid dalam periode
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: dStart, lte: dEnd },
        status: { notIn: ['Dibatalkan', 'Void', 'Cancelled'] }
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                recipes: {
                  include: {
                    ingredient: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // 2. Hitung Kebutuhan Teori Resep (Theoretical Usage) & Rekam Produk Terkait
    const theoreticalMap: Record<number, {
      totalQty: number;
      portionCount: number;
      products: Record<string, { name: string; portionsSold: number; qtyPerServing: number; unit: string }>;
    }> = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product?.recipes) return;
        item.product.recipes.forEach(rec => {
          if (!theoreticalMap[rec.ingredientId]) {
            theoreticalMap[rec.ingredientId] = {
              totalQty: 0,
              portionCount: 0,
              products: {}
            };
          }
          const usageForThisItem = item.qty * rec.qtyPerServing;
          theoreticalMap[rec.ingredientId].totalQty += usageForThisItem;
          theoreticalMap[rec.ingredientId].portionCount += item.qty;

          const pKey = `prod-${item.productId}`;
          if (!theoreticalMap[rec.ingredientId].products[pKey]) {
            theoreticalMap[rec.ingredientId].products[pKey] = {
              name: item.product.name,
              portionsSold: 0,
              qtyPerServing: rec.qtyPerServing,
              unit: rec.ingredient?.unit || ''
            };
          }
          theoreticalMap[rec.ingredientId].products[pKey].portionsSold += item.qty;
        });
      });
    });

    // 3. Ambil Mutasi Riil Pengurangan Stok Bahan (Produksi, Rusak, Penyesuaian)
    const ingredientLogs = await prisma.ingredientLog.findMany({
      where: {
        createdAt: { gte: dStart, lte: dEnd },
        change: { lt: 0 }
      }
    });

    const actualMap: Record<number, {
      totalActualQty: number;
      productionQty: number;
      lossQty: number;
      adjustmentQty: number;
    }> = {};

    ingredientLogs.forEach(log => {
      if (!actualMap[log.ingredientId]) {
        actualMap[log.ingredientId] = {
          totalActualQty: 0,
          productionQty: 0,
          lossQty: 0,
          adjustmentQty: 0
        };
      }
      const qty = Math.abs(log.change);
      actualMap[log.ingredientId].totalActualQty += qty;
      if (log.type === 'Produksi') actualMap[log.ingredientId].productionQty += qty;
      else if (log.type === 'Rusak') actualMap[log.ingredientId].lossQty += qty;
      else if (log.type === 'Penyesuaian') actualMap[log.ingredientId].adjustmentQty += qty;
    });

    // 4. Ambil Data Master Bahan Baku
    const whereIng: any = {};
    if (category && category !== 'ALL') {
      whereIng.category = category;
    }

    const ingredients = await prisma.ingredient.findMany({
      where: whereIng,
      include: {
        supplier: true,
        recipes: {
          include: {
            product: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // 5. Analisis Performa Hasil (Yield & Variance) per Bahan
    let totalTheoreticalCost = 0;
    let totalActualCost = 0;
    let totalVarianceCost = 0;
    let totalMissPortions = 0;
    let perfectCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    const items = ingredients.map(ing => {
      const theo = theoreticalMap[ing.id];
      const act = actualMap[ing.id];

      const theoreticalQty = theo ? Math.round(theo.totalQty * 100) / 100 : 0;
      const actualQty = act ? Math.round(act.totalActualQty * 100) / 100 : 0;
      const productionQty = act ? Math.round(act.productionQty * 100) / 100 : 0;
      const lossQty = act ? Math.round(act.lossQty * 100) / 100 : 0;
      const adjustmentQty = act ? Math.round(act.adjustmentQty * 100) / 100 : 0;

      // Hitung takaran rata-rata per porsi
      let avgQtyPerServing = 0;
      if (ing.recipes && ing.recipes.length > 0) {
        const sumQty = ing.recipes.reduce((sum, r) => sum + r.qtyPerServing, 0);
        avgQtyPerServing = sumQty / ing.recipes.length;
      }
      if (theo && theo.portionCount > 0 && theo.totalQty > 0) {
        avgQtyPerServing = theo.totalQty / theo.portionCount;
      }

      // Hitung Selisih (Variance)
      const varianceQty = Math.round((actualQty - theoreticalQty) * 100) / 100;
      const varianceCost = Math.round(varianceQty * ing.buyPrice);
      const theoreticalCost = Math.round(theoreticalQty * ing.buyPrice);
      const actualCost = Math.round(actualQty * ing.buyPrice);

      // Hitung Efisiensi / Akurasi Yield
      let efficiencyRate = 100;
      let status = 'Sempurna';
      let statusType: 'PERFECT' | 'WARNING' | 'OVER_PORTION' | 'UNDER_PORTION' | 'INACTIVE' = 'PERFECT';
      let recommendation = 'Takaran dapur sangat presisi & disiplin sesuai standar SOP.';

      if (actualQty === 0 && theoreticalQty === 0) {
        status = 'Tidak Ada Aktivitas';
        statusType = 'INACTIVE';
        efficiencyRate = 100;
        recommendation = 'Belum ada konsumsi atau penjualan menu terkait pada periode ini.';
      } else if (actualQty > 0 && theoreticalQty === 0) {
        efficiencyRate = 0;
        status = 'Loss / Tanpa Penjualan';
        statusType = 'OVER_PORTION';
        recommendation = 'Bahan terpotong/rusak namun tidak ada pesanan menu kasir yang tercatat.';
      } else if (actualQty > 0) {
        efficiencyRate = Math.round((theoreticalQty / actualQty) * 1000) / 10;
        
        if (efficiencyRate >= 98 && efficiencyRate <= 102) {
          status = 'Presisi (Sesuai Standar)';
          statusType = 'PERFECT';
          recommendation = 'Porsi saji sangat akurat dan konsisten dengan target resep.';
          perfectCount++;
        } else if (efficiencyRate >= 90 && efficiencyRate < 98) {
          status = 'Toleransi Wajar';
          statusType = 'WARNING';
          recommendation = 'Selisih kecil (<10%), wajar karena sisa wadah, busa, atau susut pemotongan (trimming).';
          warningCount++;
        } else if (efficiencyRate < 90) {
          status = 'Pemborosan / Over-Portion';
          statusType = 'OVER_PORTION';
          recommendation = 'Takaran porsi terindikasi berlebih atau terdapat bahan tumpah/bocor yang belum dicatat.';
          criticalCount++;
        } else if (efficiencyRate > 102) {
          status = 'Takaran Terlalu Sedikit';
          statusType = 'UNDER_PORTION';
          recommendation = 'Takaran bahan lebih hemat dari resep standar. Waspada keluhan rasa terlalu encer/kurang.';
          warningCount++;
        }
      } else {
        efficiencyRate = 100;
        status = 'Presisi (Sesuai Standar)';
        statusType = 'PERFECT';
        perfectCount++;
      }

      // Hitung Porsi Miss
      const missPortions = avgQtyPerServing > 0 ? Math.round((varianceQty / avgQtyPerServing) * 10) / 10 : 0;

      // Akumulasi Finansial
      totalTheoreticalCost += theoreticalCost;
      totalActualCost += actualCost;
      if (varianceCost > 0) {
        totalVarianceCost += varianceCost;
      }
      if (missPortions > 0) {
        totalMissPortions += missPortions;
      }

      // Klasifikasi Bahan Utama (Key Ingredient / High Impact)
      const isKeyIngredient = ing.buyPrice >= 50 || ing.category === 'FOOD' || ing.category === 'DRINK';

      return {
        id: ing.id,
        name: ing.name,
        category: ing.category,
        subCategory: ing.subCategory,
        unit: ing.unit,
        buyPrice: ing.buyPrice,
        isKeyIngredient,
        theoreticalQty,
        actualQty,
        productionQty,
        lossQty,
        adjustmentQty,
        varianceQty,
        varianceCost,
        theoreticalCost,
        actualCost,
        efficiencyRate,
        status,
        statusType,
        recommendation,
        avgQtyPerServing: Math.round(avgQtyPerServing * 100) / 100,
        missPortions,
        relatedProducts: theo ? Object.values(theo.products) : (ing.recipes ? ing.recipes.map(r => ({
          name: r.product.name,
          portionsSold: 0,
          qtyPerServing: r.qtyPerServing,
          unit: ing.unit
        })) : [])
      };
    });

    // Filter scope jika diminta KEY_ONLY
    const filteredItems = scope === 'KEY_ONLY' ? items.filter(i => i.isKeyIngredient) : items;

    // Hitung Skor Akumulasi Toko (Cost-Weighted Store Efficiency)
    const storeEfficiencyRate = totalActualCost > 0 
      ? Math.min(100, Math.round((totalTheoreticalCost / totalActualCost) * 1000) / 10)
      : 100;

    res.json({
      summary: {
        startDate: dStart.toISOString(),
        endDate: dEnd.toISOString(),
        storeEfficiencyRate,
        totalTheoreticalCost,
        totalActualCost,
        totalVarianceCost,
        totalMissPortions: Math.round(totalMissPortions * 10) / 10,
        totalActiveIngredients: items.filter(i => i.statusType !== 'INACTIVE').length,
        perfectCount,
        warningCount,
        criticalCount
      },
      items: filteredItems
    });
  } catch (error) {
    console.error('Error yield analytics:', error);
    res.status(500).json({ error: 'Gagal menganalisis efisiensi & yield bahan' });
  }
});

// GET Riwayat Mutasi & Distribusi Stok
router.get('/stock-movements', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ingredientId, type, date, startDate, endDate, limit = 200 } = req.query;
    const where: any = {};
    if (ingredientId && ingredientId !== 'ALL') where.ingredientId = Number(ingredientId);
    if (type && type !== 'ALL') where.type = type as string;

    if (startDate && endDate) {
      const dStart = new Date(startDate as string);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(endDate as string);
      dEnd.setHours(23, 59, 59, 999);
      where.createdAt = { gte: dStart, lte: dEnd };
    } else if (date) {
      const dStart = new Date(date as string);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(date as string);
      dEnd.setHours(23, 59, 59, 999);
      where.createdAt = { gte: dStart, lte: dEnd };
    }

    const movements = await prisma.ingredientLog.findMany({
      where,
      include: {
        ingredient: { select: { id: true, name: true, unit: true, buyPrice: true, category: true } },
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit)
    });

    res.json(movements);
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat mutasi stok' });
  }
});

// GET /api/ingredients/analytics/daily-usage
router.get('/analytics/daily-usage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category, type } = req.query;

    let dateFilter: any = {};
    if (startDate && endDate) {
      const s = new Date(startDate as string);
      const e = new Date(endDate as string);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        dateFilter = {
          gte: s,
          lte: e
        };
      }
    } else {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      dateFilter = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    let typeWhere: any = { in: ['Produksi', 'Rusak', 'Penyesuaian'] };
    if (type && type !== 'ALL') {
      typeWhere = type as string;
    }

    const logs = await prisma.ingredientLog.findMany({
      where: {
        createdAt: dateFilter,
        type: typeWhere,
        change: { lt: 0 }
      },
      include: {
        ingredient: {
          include: { supplier: true }
        },
        user: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const orders = await prisma.order.findMany({
      where: {
        createdAt: dateFilter,
        status: 'Paid'
      },
      select: { total: true }
    });
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    const usageMap: Record<number, {
      ingredientId: number;
      name: string;
      category: string;
      subCategory: string | null;
      unit: string;
      buyPrice: number;
      currentStock: number;
      minStock: number;
      supplierName: string;
      totalQtyUsed: number;
      productionQty: number;
      lossQty: number;
      adjustmentQty: number;
      totalCost: number;
      lossCost: number;
      eventCount: number;
    }> = {};

    logs.forEach(log => {
      const ing = log.ingredient;
      if (!ing) return;

      const ingCategory = (ing as any).category || 'FOOD';
      if (category && category !== 'ALL' && ingCategory !== category) {
        return;
      }

      const qty = Math.abs(log.change);
      const cost = qty * (ing.buyPrice || 0);

      if (!usageMap[ing.id]) {
        usageMap[ing.id] = {
          ingredientId: ing.id,
          name: ing.name,
          category: ingCategory,
          subCategory: (ing as any).subCategory || null,
          unit: ing.unit,
          buyPrice: ing.buyPrice,
          currentStock: ing.stock,
          minStock: ing.minStock,
          supplierName: ing.supplier?.name || 'Tanpa Supplier',
          totalQtyUsed: 0,
          productionQty: 0,
          lossQty: 0,
          adjustmentQty: 0,
          totalCost: 0,
          lossCost: 0,
          eventCount: 0
        };
      }

      usageMap[ing.id].totalQtyUsed += qty;
      usageMap[ing.id].totalCost += cost;
      usageMap[ing.id].eventCount += 1;

      if (log.type === 'Produksi') {
        usageMap[ing.id].productionQty += qty;
      } else if (log.type === 'Rusak') {
        usageMap[ing.id].lossQty += qty;
        usageMap[ing.id].lossCost += cost;
      } else {
        usageMap[ing.id].adjustmentQty += qty;
      }
    });

    const items = Object.values(usageMap).sort((a, b) => b.totalCost - a.totalCost);

    const totalCostUsage = items.reduce((sum, item) => sum + item.totalCost, 0);
    const totalLossCost = items.reduce((sum, item) => sum + item.lossCost, 0);
    const totalProductionCost = totalCostUsage - totalLossCost;
    const foodCostRatio = totalRevenue > 0 ? Math.round((totalCostUsage / totalRevenue) * 1000) / 10 : 0;

    const foodCost = items.filter(i => i.category === 'FOOD').reduce((sum, i) => sum + i.totalCost, 0);
    const drinkCost = items.filter(i => i.category === 'DRINK').reduce((sum, i) => sum + i.totalCost, 0);
    const packagingCost = items.filter(i => i.category === 'PACKAGING').reduce((sum, i) => sum + i.totalCost, 0);

    const summary = {
      totalCostUsage,
      totalProductionCost,
      totalLossCost,
      totalRevenue,
      foodCostRatio,
      totalActiveIngredientsUsed: items.length,
      foodCost,
      drinkCost,
      packagingCost,
      topIngredients: items.slice(0, 5)
    };

    res.json({
      summary,
      items,
      logs: logs.slice(0, 100)
    });
  } catch (error) {
    console.error('Error fetching daily usage analytics:', error);
    res.status(500).json({ error: 'Gagal mengambil analisis penggunaan bahan baku harian' });
  }
});

// DELETE ingredient (hanya jika tidak ada resep aktif)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipeCount = await prisma.recipeItem.count({ where: { ingredientId: Number(id) } });
    if (recipeCount > 0) {
      return res.status(400).json({ error: 'Bahan baku ini masih digunakan dalam resep menu. Hapus resep terkait terlebih dahulu.' });
    }
    await prisma.ingredient.delete({ where: { id: Number(id) } });
    res.json({ message: 'Bahan baku berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus bahan baku' });
  }
});

// POST restock / adjust stok bahan baku
router.post('/:id/adjust', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { change, type, description, newBuyPrice } = req.body;
    // type: 'Restock' | 'Penyesuaian' | 'Rusak'
    const amount = Number(change);
    if (isNaN(amount) || amount === 0) {
      return res.status(400).json({ error: 'Jumlah perubahan stok tidak valid' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.ingredient.findUnique({ where: { id: Number(id) } });
      if (!current) throw new Error('Bahan baku tidak ditemukan');

      let nextBuyPrice = current.buyPrice;
      if (type === 'Restock' && newBuyPrice !== undefined && newBuyPrice !== null) {
        const incomingPrice = Number(newBuyPrice);
        if (!isNaN(incomingPrice) && incomingPrice > 0) {
          const currentStock = Math.max(0, current.stock);
          const totalStock = currentStock + amount;
          if (totalStock > 0) {
            nextBuyPrice = Math.round(((currentStock * current.buyPrice) + (amount * incomingPrice)) / totalStock);
          } else {
            nextBuyPrice = incomingPrice;
          }
        }
      }

      const ingredient = await tx.ingredient.update({
        where: { id: Number(id) },
        data: { 
          stock: { increment: amount },
          buyPrice: nextBuyPrice
        }
      });

      const wacNote = (nextBuyPrice !== current.buyPrice) ? ` [WAC Baru: Rp ${nextBuyPrice.toLocaleString('id-ID')}/${current.unit}]` : '';

      await tx.ingredientLog.create({
        data: {
          ingredientId: Number(id),
          change: amount,
          type: type || 'Penyesuaian',
          description: (description || 'Penyesuaian stok') + wacNote,
          userId: (req as any).user?.id || null
        }
      });
      return ingredient;
    });

    // Auto-sync real-time sold out menu status across Kasir & QR Dine-In
    await syncMenuSoldOutStatus(prisma);

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menyesuaikan stok bahan baku' });
  }
});

// GET ingredient stock logs
router.get('/:id/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const logs = await prisma.ingredientLog.findMany({
      where: { ingredientId: Number(id) },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil riwayat stok' });
  }
});

export default router;
