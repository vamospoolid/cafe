import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { getLocalDateRange, getCustomDateRange, getTodayDateStr } from '../utils/dateHelper';

const router = Router();
const prisma = new PrismaClient();

// Helper to group by date in local timezone (default WIB UTC+7)
function getPastDays(days: number, tzOffsetMinutes: number | string = -420) {
  let offset = -420;
  if (tzOffsetMinutes !== undefined && tzOffsetMinutes !== null && tzOffsetMinutes !== '') {
    const parsed = parseInt(String(tzOffsetMinutes), 10);
    if (!isNaN(parsed)) offset = parsed;
  }
  const result = [];
  const now = new Date();
  const localNow = new Date(now.getTime() - (offset * 60 * 1000));
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(localNow.getTime() - (i * 24 * 60 * 60 * 1000));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const { startUtc, endUtc } = getLocalDateRange(dateStr, offset);

    const tempDate = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    const name = tempDate.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' });

    result.push({
      dateStr,
      startUtc,
      endUtc,
      name
    });
  }
  return result;
}

// Helper to classify food vs drink vs lainnya
export function getCategoryGroup(prod: any): 'makanan' | 'minuman' | 'lainnya' {
  const target = (prod?.category?.printerTarget || '').toUpperCase();
  const cat = (prod?.category?.name || '').toLowerCase();
  const name = (prod?.name || '').toLowerCase();
  if (target === 'BAR') return 'minuman';
  if (target === 'KITCHEN') return 'makanan';
  if (
    cat.includes('minum') || cat.includes('drink') || cat.includes('beverage') ||
    cat.includes('bevvies') || cat.includes('kopi') || cat.includes('coffee') ||
    cat.includes('tea') || cat.includes('teh') || cat.includes('jus') ||
    cat.includes('juice') || cat.includes('boba') || cat.includes('latte') ||
    cat.includes('mocktail') || cat.includes('float') || cat.includes('es ')
  ) return 'minuman';
  if (
    cat.includes('makan') || cat.includes('food') || cat.includes('ramen') ||
    cat.includes('mie') || cat.includes('nasi') || cat.includes('salties') ||
    cat.includes('rice') || cat.includes('soup') || cat.includes('snack') ||
    cat.includes('dimsum') || cat.includes('bento') || cat.includes('dessert') ||
    cat.includes('pastry') || cat.includes('sweeties') || cat.includes('roti')
  ) return 'makanan';
  if (
    name.includes('kopi') || name.includes('coffee') || name.includes('tea') ||
    name.includes('teh') || name.includes('jus') || name.includes('juice') ||
    name.includes('latte') || name.includes('espresso') || name.includes('susu') ||
    name.includes('ice') || name.includes('es ') || name.includes('drink')
  ) return 'minuman';
  return 'makanan';
}

// Helper to classify petty cash / expenses for profit sharing division
export function getExpenseDivision(cf: { category?: string; description?: string }): 'food' | 'drink' | 'shared_opex' {
  const text = `${cf.category || ''} ${cf.description || ''}`.toLowerCase();
  if (
    text.includes('ramen') || text.includes('mie') || text.includes('dapur') ||
    text.includes('food') || text.includes('chashu') || text.includes('kuah') ||
    text.includes('nori') || text.includes('bumbu') || text.includes('ayam') ||
    text.includes('daging') || text.includes('bawang') || text.includes('shoyu') ||
    text.includes('naruto') || text.includes('makanan')
  ) {
    return 'food';
  }
  if (
    text.includes('minum') || text.includes('drink') || text.includes('bar') ||
    text.includes('kopi') || text.includes('coffee') || text.includes('susu') ||
    text.includes('syrup') || text.includes('sirup') || text.includes('teh') ||
    text.includes('tea') || text.includes('es batu') || text.includes('boba') ||
    text.includes('yakult') || text.includes('matcha')
  ) {
    return 'drink';
  }
  return 'shared_opex';
}

router.get('/sales-chart', authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 7;
    const tzOffset = (req.query.tzOffset as string) || -420;
    const pastDays = getPastDays(days, tzOffset);
    const startDate = pastDays[0]?.startUtc || new Date();

    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: startDate }
      },
      select: { total: true, createdAt: true }
    });

    const chartData = pastDays.map(item => {
      const dailyOrders = orders.filter(o => 
        o.createdAt >= item.startUtc && o.createdAt <= item.endUtc
      );
      
      const totalSales = dailyOrders.reduce((sum, o) => sum + o.total, 0);
      
      return {
        name: item.name,
        date: item.dateStr,
        sales: totalSales
      };
    });

    res.json(chartData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat grafik penjualan' });
  }
});

router.get('/best-sellers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const orderItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        qty: true
      },
      orderBy: {
        _sum: {
          qty: 'desc'
        }
      },
      take: 5
    });

    const productIds = orderItems.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    const bestSellers = orderItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        id: item.productId,
        name: product?.name || 'Produk Dihapus',
        qty: item._sum.qty
      };
    });

    res.json(bestSellers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat best sellers' });
  }
});

router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tzOffset = (req.query.tzOffset as string) || -420;
    const todayStr = getTodayDateStr(tzOffset);
    const { startUtc: todayStart, endUtc: todayEnd } = getLocalDateRange(todayStr, tzOffset);

    // 1. Fetch Today's Orders
    const todayOrders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: todayStart, lte: todayEnd }
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    let totalRevenue = 0;
    let totalHpp = 0;
    let totalServiceTime = 0;
    let servedCount = 0;

    // Payment methods map
    const paymentMethods: Record<string, number> = {
      'Tunai': 0,
      'QRIS': 0,
      'Kartu': 0,
      'Split': 0
    };

    // Hourly sales map (Initialize hours 00:00 to 23:00)
    const hourlySalesMap: Record<string, number> = {};
    for (let h = 0; h < 24; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      hourlySalesMap[label] = 0;
    }

    let parsedOffset = -420;
    if (tzOffset !== undefined && tzOffset !== null && tzOffset !== '') {
      const parsed = parseInt(String(tzOffset), 10);
      if (!isNaN(parsed)) parsedOffset = parsed;
    }

    todayOrders.forEach(order => {
      totalRevenue += order.total;
      
      // Calculate HPP
      order.items.forEach(item => {
        totalHpp += (item.buyPrice || 0) * item.qty;
      });

      // Calculate Service Time for Served orders (in minutes)
      if (order.kdsStatus === 'Served') {
        const diffMs = order.updatedAt.getTime() - order.createdAt.getTime();
        const diffMins = Math.max(1, Math.floor(diffMs / 60000));
        totalServiceTime += diffMins;
        servedCount++;
      }

      // Payment method breakdown
      if (order.paymentMethod) {
        let pm = order.paymentMethod.trim();
        if (pm.toLowerCase() === 'cash' || pm === 'Tunai') {
          pm = 'Tunai';
        } else if (pm.toLowerCase() === 'card' || pm === 'Kartu') {
          pm = 'Kartu';
        } else if (pm.startsWith('Split')) {
          pm = 'Split';
        }
        paymentMethods[pm] = (paymentMethods[pm] || 0) + order.total;
      }

      // Hourly sales breakdown in local timezone
      const orderLocalTime = new Date(order.createdAt.getTime() - (parsedOffset * 60 * 1000));
      const hour = orderLocalTime.getUTCHours();
      const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
      hourlySalesMap[hourLabel] += order.total;
    });

    const totalProfit = totalRevenue - totalHpp;
    const totalTransactions = todayOrders.length;
    const avgServiceTime = servedCount > 0 ? Math.round(totalServiceTime / servedCount) : 0;

    // Format hourly sales for recharts
    const hourlySales = Object.entries(hourlySalesMap).map(([hour, sales]) => ({
      hour,
      sales
    })).sort((a, b) => a.hour.localeCompare(b.hour));

    // 2. Fetch Table Occupancy
    const totalTables = await prisma.table.count();
    const activeUnpaidOrders = await prisma.order.findMany({
      where: {
        status: 'Pending',
        tableId: { not: null }
      },
      select: {
        tableId: true
      }
    });
    
    // Get unique table IDs that have pending orders
    const occupiedTableIds = new Set(activeUnpaidOrders.map(o => o.tableId));
    const occupiedTablesCount = occupiedTableIds.size;

    // 3. Fetch Low Stock Products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: { lte: 10 },
        status: 'Aktif'
      },
      select: {
        id: true,
        name: true,
        stock: true,
        imageUrl: true
      },
      take: 5,
      orderBy: {
        stock: 'asc'
      }
    });

    // 4. Fetch 5 Recent Transactions
    const recentTransactions = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        paymentMethod: true,
        status: true,
        createdAt: true
      }
    });

    // 5. Fetch 5 Recent Stock Mutations
    const recentStockLogs = await prisma.ingredientLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        ingredient: {
          select: {
            name: true,
            unit: true
          }
        }
      }
    });

    // 6. Fetch Active Cashier Shift
    const activeShift = await prisma.shift.findFirst({
      where: { status: { in: ['Open', 'OPEN'] } },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    // 7. Fetch Today's Crew on Duty (Live Attendances)
    const todayAttendances = await prisma.attendance.findMany({
      where: { date: todayStr },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      },
      orderBy: { clockIn: 'asc' }
    });

    // 8. Active Kitchen Orders in KDS
    const activeKitchenOrdersCount = await prisma.order.count({
      where: {
        status: { not: 'Void' },
        kdsStatus: { in: ['Pending', 'Cooking'] },
        createdAt: { gte: todayStart, lte: todayEnd }
      }
    });

    // 9. Daily Omzet Bonus Tier Calculation
    const defaultTiers = [
      { min: 0, max: 2499999, bonus: 0, label: '< Rp 2.5 Juta' },
      { min: 2500000, max: 2999999, bonus: 5000, label: 'Rp 2.5 - 3 Juta' },
      { min: 3000000, max: 3999999, bonus: 10000, label: 'Rp 3 - 4 Juta' },
      { min: 4000000, max: 4999999, bonus: 15000, label: 'Rp 4 - 5 Juta' },
      { min: 5000000, max: 5999999, bonus: 20000, label: 'Rp 5 - 6 Juta' },
      { min: 6000000, max: 999999999, bonus: 25000, label: '≥ Rp 6 Juta' }
    ];

    let activeTiers: any[] = defaultTiers;
    const settings = await prisma.settings.findFirst();
    if (settings?.dailyOmzetTiers) {
      try {
        const parsed = JSON.parse(settings.dailyOmzetTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize tiers list to ensure min, max, bonus, label
          const sorted = [...parsed].sort((a: any, b: any) => {
            const aMin = Number(a.min ?? a.minOmzet ?? 0);
            const bMin = Number(b.min ?? b.minOmzet ?? 0);
            return aMin - bMin;
          });
          activeTiers = sorted;
        }
      } catch (e) {}
    }

    let currentTier: any = activeTiers[0];
    let nextTier: any = null;

    for (let i = 0; i < activeTiers.length; i++) {
      const t = activeTiers[i];
      const tMin = Number(t.min ?? t.minOmzet ?? 0);
      if (totalRevenue >= tMin) {
        currentTier = t;
        nextTier = activeTiers[i + 1] || null;
      }
    }

    const nextGoalAmount = nextTier ? Number(nextTier.min ?? nextTier.minOmzet ?? 0) : null;
    const currentTierMin = Number(currentTier?.min ?? currentTier?.minOmzet ?? 0);
    const remainingToNext = nextGoalAmount ? Math.max(0, nextGoalAmount - totalRevenue) : 0;
    
    let progressPercent = 100;
    if (nextGoalAmount && nextGoalAmount > currentTierMin) {
      const range = nextGoalAmount - currentTierMin;
      const progress = totalRevenue - currentTierMin;
      progressPercent = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
    }

    const omzetBonusTier = {
      enabled: settings?.enableDailyOmzetBonus ?? true,
      currentBonus: Number(currentTier?.bonus || 0),
      currentTierLabel: currentTier?.label || `Tier >= Rp ${(currentTierMin / 1000000).toFixed(1)} Juta`,
      nextGoalAmount,
      remainingToNext,
      nextTierBonus: nextTier ? Number(nextTier.bonus || 0) : 0,
      progressPercent
    };

    // 10. Cash vs Digital breakdown
    const totalCashRevenue = paymentMethods['Tunai'] || 0;
    const totalDigitalRevenue = (paymentMethods['QRIS'] || 0) + (paymentMethods['Kartu'] || 0) + (paymentMethods['Split'] || 0);

    res.json({
      revenue: totalRevenue,
      profit: totalProfit,
      transactions: totalTransactions,
      averageServiceTime: avgServiceTime,
      paymentMethods,
      cashBreakdown: {
        cash: totalCashRevenue,
        digital: totalDigitalRevenue
      },
      hourlySales,
      tableOccupancy: {
        occupied: occupiedTablesCount,
        total: totalTables,
        percentage: totalTables > 0 ? Math.round((occupiedTablesCount / totalTables) * 100) : 0
      },
      lowStockProducts,
      recentTransactions,
      recentStockLogs,
      activeShift,
      crewOnDuty: todayAttendances,
      kitchenQueue: activeKitchenOrdersCount,
      omzetBonusTier
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat summary dashboard' });
  }
});

// GET Laporan Lengkap (Custom Date Range)
router.get('/reports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;
    
    const todayStr = getTodayDateStr(tzOffset as string || -420);
    const sStr = (startDate as string) || todayStr;
    const eStr = (endDate as string) || sStr;
    const { startUtc: start, endUtc: end } = getCustomDateRange(sStr, eStr, tzOffset as string || -420);

    // 1. Fetch Orders in range
    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    // 2. Fetch CashFlows in range
    const cashFlows = await prisma.cashFlow.findMany({
      where: {
        date: { gte: start, lte: end }
      }
    });

    let totalRevenue = 0;
    let totalHpp = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let totalServiceCharge = 0;
    const transactionsCount = orders.length;

    const paymentMethods: Record<string, { count: number, amount: number }> = {
      'Tunai': { count: 0, amount: 0 },
      'QRIS': { count: 0, amount: 0 },
      'Kartu': { count: 0, amount: 0 },
      'Split': { count: 0, amount: 0 }
    };

    const categoryMap: Record<string, { qty: number, revenue: number }> = {};
    const productMap: Record<number, { name: string, category: string, qty: number, revenue: number, cost: number }> = {};

    let periodDineIn = 0;
    let periodTakeaway = 0;
    let periodQrisTotal = 0;
    let periodQrisCount = 0;

    // Food vs Drink tracking objects
    const foodStats = { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 };
    const drinkStats = { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 };
    const otherStats = { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 };

    orders.forEach(order => {
      totalRevenue += order.total;
      totalDiscounts += order.discount;
      totalTax += order.tax;
      totalServiceCharge += order.serviceCharge;

      // Dine-in vs Takeaway
      if (order.tableId !== null) {
        periodDineIn += order.total;
      } else {
        periodTakeaway += order.total;
      }

      // Payments breakdown
      let pm = order.paymentMethod || 'Tunai';
      pm = pm.trim();
      if (pm.toLowerCase() === 'cash' || pm === 'Tunai') {
        pm = 'Tunai';
      } else if (pm.toLowerCase() === 'card' || pm === 'Kartu') {
        pm = 'Kartu';
      } else if (pm.startsWith('Split')) {
        pm = 'Split';
      }

      if (!paymentMethods[pm]) {
        paymentMethods[pm] = { count: 0, amount: 0 };
      }
      paymentMethods[pm].count++;
      paymentMethods[pm].amount += order.total;

      if (pm === 'QRIS') {
        periodQrisTotal += order.total;
        periodQrisCount++;
      }

      // Items breakdown
      order.items.forEach(item => {
        const buyPrice = item.buyPrice || item.product?.buyPrice || 0;
        const itemCost = buyPrice * item.qty;
        totalHpp += itemCost;

        const group = getCategoryGroup(item.product);
        if (group === 'makanan') {
          foodStats.revenue += item.subtotal;
          foodStats.qty += item.qty;
          foodStats.cost += itemCost;
        } else if (group === 'minuman') {
          drinkStats.revenue += item.subtotal;
          drinkStats.qty += item.qty;
          drinkStats.cost += itemCost;
        } else {
          otherStats.revenue += item.subtotal;
          otherStats.qty += item.qty;
          otherStats.cost += itemCost;
        }

        // Category breakdown
        const catName = item.product?.category?.name || 'Lain-lain';
        if (!categoryMap[catName]) {
          categoryMap[catName] = { qty: 0, revenue: 0 };
        }
        categoryMap[catName].qty += item.qty;
        categoryMap[catName].revenue += item.subtotal;

        // Product breakdown
        const pId = item.productId;
        if (!productMap[pId]) {
          productMap[pId] = {
            name: item.product?.name || 'Produk Dihapus',
            category: catName,
            qty: 0,
            revenue: 0,
            cost: 0
          };
        }
        productMap[pId].qty += item.qty;
        productMap[pId].revenue += item.subtotal;
        productMap[pId].cost += itemCost;
      });
    });

    const totalProfit = totalRevenue - totalHpp;

    // Calculate margins and percentages for Food vs Drink
    foodStats.profit = foodStats.revenue - foodStats.cost;
    foodStats.margin = foodStats.revenue > 0 ? Math.round((foodStats.profit / foodStats.revenue) * 100) : 0;
    foodStats.percentage = totalRevenue > 0 ? Math.round((foodStats.revenue / totalRevenue) * 100) : 0;

    drinkStats.profit = drinkStats.revenue - drinkStats.cost;
    drinkStats.margin = drinkStats.revenue > 0 ? Math.round((drinkStats.profit / drinkStats.revenue) * 100) : 0;
    drinkStats.percentage = totalRevenue > 0 ? Math.round((drinkStats.revenue / totalRevenue) * 100) : 0;

    otherStats.profit = otherStats.revenue - otherStats.cost;
    otherStats.margin = otherStats.revenue > 0 ? Math.round((otherStats.profit / otherStats.revenue) * 100) : 0;
    otherStats.percentage = totalRevenue > 0 ? Math.round((otherStats.revenue / totalRevenue) * 100) : 0;

    const categoryBreakdown = {
      food: foodStats,
      drink: drinkStats,
      other: otherStats
    };

    // Format category & product lists
    const categoriesReport = Object.entries(categoryMap).map(([name, data]) => ({
      name,
      qty: data.qty,
      revenue: data.revenue
    }));

    const productsReport = Object.entries(productMap).map(([id, data]) => {
      const profit = data.revenue - data.cost;
      const margin = data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0;
      return {
        id: Number(id),
        name: data.name,
        category: data.category,
        qty: data.qty,
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin
      };
    }).sort((a, b) => b.qty - a.qty);

    // 2. Fetch Closed Shifts in range
    const rawShifts = await prisma.shift.findMany({
      where: {
        status: 'Closed',
        waktuTutup: {
          gte: start,
          lte: end
        }
      },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { waktuTutup: 'desc' }
    });

    // Enrich shifts dengan perhitungan omzet kas dan non-tunai akurat dari transaksi
    const shifts = rawShifts.map(s => {
      const sStart = s.waktuBuka;
      const sEnd = s.waktuTutup || new Date();
      const inShift = (d: Date | null) => d != null && d >= sStart && d <= sEnd;
      const sOrders = orders.filter(o => inShift(o.paidAt ?? o.createdAt));
      
      let cash = 0;
      let nonCash = 0;
      sOrders.forEach(o => {
        const pm = (o.paymentMethod || '').trim().toLowerCase();
        if (pm === 'cash' || pm === 'tunai') {
          cash += o.total;
        } else if (pm.startsWith('split')) {
          const match = pm.match(/tunai\s+(?:rp)+\s*([\d\.]+)/i);
          const cAmt = match && match[1] ? Number(match[1].replace(/\./g, '')) || 0 : 0;
          cash += cAmt;
          nonCash += Math.max(0, o.total - cAmt);
        } else {
          nonCash += o.total;
        }
      });

      // Fallback rekonsiliasi jika tidak ada order tertaut tapi terdapat saldo sistem
      if (cash === 0 && (s.saldoSistem || 0) > (s.saldoAwal || 0)) {
        cash = Math.max(0, (s.saldoSistem || 0) - (s.saldoAwal || 0));
      }

      return {
        ...s,
        cashSales: cash,
        nonCashSales: nonCash
      };
    });

    // 3. TODAY'S RECAP (Independent of filters)
    const { startUtc: todayStart, endUtc: todayEnd } = getLocalDateRange(todayStr, tzOffset as string || -420);

    const todayOrders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: todayStart, lte: todayEnd }
      },
      include: {
        items: { include: { product: true } }
      }
    });

    let todayRevenue = 0;
    let todayQris = 0;
    let todayCashSales = 0;
    let todayQtySold = 0;

    todayOrders.forEach(o => {
      todayRevenue += o.total;
      if (o.paymentMethod === 'QRIS') todayQris += o.total;
      if (o.paymentMethod === 'Tunai' || o.paymentMethod === 'Cash') todayCashSales += o.total;
      o.items.forEach(item => {
        todayQtySold += item.qty;
      });
    });

    // Pending unpaid orders
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'Pending' }
    });
    const pendingBillsAmount = pendingOrders.reduce((sum, o) => sum + o.total, 0);
    const pendingBillsCount = pendingOrders.length;

    // Today's Petty cash
    const todayCashflows = await prisma.cashFlow.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } }
    });
    const todayExpenses = todayCashflows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);
    const todayOtherIncomes = todayCashflows.filter(cf => cf.type === 'Pemasukan').reduce((sum, cf) => sum + cf.amount, 0);

    // Opening Cash of active shift
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' }
    });
    const openingCash = activeShift?.saldoAwal || 0;
    const cashInDrawerEst = todayCashSales + openingCash - todayExpenses;

    const todayRecap = {
      revenue: todayRevenue,
      pendingAmount: pendingBillsAmount,
      pendingCount: pendingBillsCount,
      expenses: todayExpenses,
      cashInDrawer: cashInDrawerEst,
      qtySold: todayQtySold,
      otherIncomes: todayOtherIncomes,
      qris: todayQris
    };

    // 4. PERIOD RECAP (Calculated over selected range)
    const periodExpenses = cashFlows.filter(cf => cf.type === 'Pengeluaran').reduce((sum, cf) => sum + cf.amount, 0);
    const periodNetIncome = totalRevenue - totalHpp - periodExpenses;

    // Calculate revenue breakdown by category name
    const revenueBreakdown = {
      makanan: foodStats.revenue,
      minuman: drinkStats.revenue,
      dessert: (categoryMap['Dessert']?.revenue || 0) + (categoryMap['Pastry']?.revenue || 0) + (categoryMap['Sweeties']?.revenue || 0),
      other: otherStats.revenue
    };

    // Calculate Growth vs previous period
    const periodLength = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodLength);
    const prevEnd = new Date(start.getTime() - 1);

    const prevOrders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: prevStart, lte: prevEnd }
      },
      select: { total: true }
    });
    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);
    let growthPercent = 0;
    if (prevRevenue > 0) {
      growthPercent = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    } else if (totalRevenue > 0) {
      growthPercent = 100;
    }

    const periodRecap = {
      netIncome: periodNetIncome,
      revenue: totalRevenue,
      expenses: periodExpenses,
      revenueBreakdown,
      growth: growthPercent,
      dineIn: periodDineIn,
      takeaway: periodTakeaway,
      qrisTotal: periodQrisTotal,
      qrisCount: periodQrisCount
    };

    // 5. DAILY TIMELINE BREAKDOWN (For line charting and detailed table logs)
    const dailyTimeline: any[] = [];
    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);
    const iterDate = new Date(Date.UTC(sy, sm - 1, sd));
    const endDateObj = new Date(Date.UTC(ey, em - 1, ed));

    while (iterDate <= endDateObj) {
      const iy = iterDate.getUTCFullYear();
      const im = String(iterDate.getUTCMonth() + 1).padStart(2, '0');
      const id = String(iterDate.getUTCDate()).padStart(2, '0');
      const dayDateStr = `${iy}-${im}-${id}`;
      const { startUtc: dayStart, endUtc: dayEnd } = getLocalDateRange(dayDateStr, tzOffset as string || -420);

      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);
      const dayExpenses = cashFlows.filter(cf => cf.type === 'Pengeluaran' && cf.date >= dayStart && cf.date <= dayEnd).reduce((sum, cf) => sum + cf.amount, 0);

      let dayMakanan = 0;
      let dayMakananHpp = 0;
      let dayMinuman = 0;
      let dayMinumanHpp = 0;
      let dayTotal = 0;
      let dayHpp = 0;

      dayOrders.forEach(o => {
        dayTotal += o.total;
        o.items.forEach(item => {
          const buyPrice = item.buyPrice || item.product?.buyPrice || 0;
          const cost = buyPrice * item.qty;
          dayHpp += cost;

          const grp = getCategoryGroup(item.product);
          if (grp === 'makanan') {
            dayMakanan += item.subtotal;
            dayMakananHpp += cost;
          } else if (grp === 'minuman') {
            dayMinuman += item.subtotal;
            dayMinumanHpp += cost;
          }
        });
      });

      const dayGrossProfit = dayTotal - dayHpp;
      const dayNetProfit = dayTotal - dayHpp - dayExpenses;
      const dayGrossMargin = dayTotal > 0 ? Math.round((dayGrossProfit / dayTotal) * 100) : 0;
      const dayNetMargin = dayTotal > 0 ? Math.round((dayNetProfit / dayTotal) * 100) : 0;

      dailyTimeline.push({
        dateLabel: iterDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        dateRaw: dayDateStr,
        makanan: dayMakanan,
        makananHpp: dayMakananHpp,
        minuman: dayMinuman,
        minumanHpp: dayMinumanHpp,
        total: dayTotal,
        hpp: dayHpp,
        expenses: dayExpenses,
        grossProfit: dayGrossProfit,
        profit: dayNetProfit,
        margin: dayGrossMargin,
        netMargin: dayNetMargin,
        count: dayOrders.length
      });

      iterDate.setUTCDate(iterDate.getUTCDate() + 1);
    }

    const grossMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const netMargin = totalRevenue > 0 ? Math.round((periodNetIncome / totalRevenue) * 100) : 0;
    const hppPercentage = totalRevenue > 0 ? Math.round((totalHpp / totalRevenue) * 100) : 0;

    res.json({
      summary: {
        revenue: totalRevenue,
        profit: totalProfit,
        netIncome: periodNetIncome,
        hpp: totalHpp,
        grossMargin,
        netMargin,
        hppPercentage,
        transactionsCount,
        discounts: totalDiscounts,
        tax: totalTax,
        serviceCharge: totalServiceCharge
      },
      categoryBreakdown,
      paymentMethods,
      categories: categoriesReport,
      products: productsReport,
      shifts,
      todayRecap,
      periodRecap,
      dailyTimeline
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat laporan lengkap' });
  }
});

const getPettyCashAccount = (category: string, type: 'Pemasukan' | 'Pengeluaran'): string => {
  const cat = category.toLowerCase().trim();
  if (type === 'Pemasukan') {
    if (cat.includes('ampas') || cat.includes('kopi')) {
      return '4-3100 - Pendapatan Penjualan Ampas Kopi';
    }
    if (cat.includes('merchandise') || cat.includes('kaos') || cat.includes('barang')) {
      return '4-3200 - Pendapatan Penjualan Merchandise';
    }
    return `4-3000 - Pendapatan Lain-lain (${category})`;
  } else {
    if (cat.includes('bahan') || cat.includes('baku') || cat.includes('kopi') || cat.includes('susu') || cat.includes('sirup')) {
      return '6-1100 - Beban Bahan Baku & Pendukung';
    }
    if (cat.includes('listrik') || cat.includes('token') || cat.includes('air') || cat.includes('internet') || cat.includes('wifi')) {
      return '6-1200 - Beban Utilitas (Listrik/Air/Internet)';
    }
    if (cat.includes('gas') || cat.includes('es') || cat.includes('tisu') || cat.includes('sedotan') || cat.includes('habis pakai')) {
      return '6-1300 - Beban Perlengkapan & Bahan Habis Pakai';
    }
    if (cat.includes('sewa')) {
      return '6-1400 - Beban Sewa Tempat';
    }
    if (cat.includes('perawatan') || cat.includes('servis') || cat.includes('alat') || cat.includes('mesin')) {
      return '6-1500 - Beban Pemeliharaan & Perawatan Alat';
    }
    return `6-1000 - Beban Operasional Lainnya (${category})`;
  }
};

// GET Laporan Akuntansi General (Laba Rugi, Arus Kas, Jurnal Ledger)
router.get('/accounting', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;

    const todayStr = getTodayDateStr(tzOffset as string || -420);
    const sStr = (startDate as string) || todayStr;
    const eStr = (endDate as string) || sStr;
    const { startUtc: start, endUtc: end } = getCustomDateRange(sStr, eStr, tzOffset as string || -420);

    // 1. Fetch Orders in range
    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: start, lte: end }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch CashFlows in range
    const cashFlows = await prisma.cashFlow.findMany({
      where: {
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'desc' }
    });

    // 3. Fetch Closed Shifts in range
    const shifts = await prisma.shift.findMany({
      where: {
        status: 'Closed',
        waktuTutup: { gte: start, lte: end }
      },
      include: {
        user: { select: { name: true } }
      }
    });

    // --- Kalkulasi Laba Rugi (Profit & Loss) ---
    let salesRevenue = 0;
    let salesDiscount = 0;
    let salesTax = 0;
    let salesService = 0;
    let totalHpp = 0;

    orders.forEach(o => {
      salesRevenue += o.total;
      salesDiscount += o.discount;
      salesTax += o.tax;
      salesService += o.serviceCharge;

      o.items.forEach(item => {
        totalHpp += (item.buyPrice || 0) * item.qty;
      });
    });

    let otherRevenue = 0;
    let opexAmount = 0;
    const opexBreakdown: Record<string, number> = {};
    const otherRevenueBreakdown: Record<string, number> = {};

    cashFlows.forEach(cf => {
      if (cf.type === 'Pemasukan') {
        otherRevenue += cf.amount;
        const cat = cf.category || 'Lain-lain';
        otherRevenueBreakdown[cat] = (otherRevenueBreakdown[cat] || 0) + cf.amount;
      } else {
        opexAmount += cf.amount;
        const cat = cf.category || 'Lain-lain';
        opexBreakdown[cat] = (opexBreakdown[cat] || 0) + cf.amount;
      }
    });

    let shiftShortage = 0;
    let shiftOverage = 0;

    shifts.forEach(s => {
      if (s.selisih && s.selisih !== 0) {
        if (s.selisih < 0) {
          shiftShortage += Math.abs(s.selisih);
        } else {
          shiftOverage += s.selisih;
        }
      }
    });

    const operatingRevenue = salesRevenue + otherRevenue + shiftOverage;
    const grossProfit = operatingRevenue - totalHpp;
    const operatingExpenses = opexAmount + shiftShortage;
    const netIncome = grossProfit - operatingExpenses;

    const profitLoss = {
      operatingRevenue,
      salesRevenue,
      otherRevenue,
      otherRevenueBreakdown,
      shiftOverage,
      cogs: totalHpp,
      grossProfit,
      operatingExpenses,
      opexAmount,
      opexBreakdown,
      shiftShortage,
      netIncome
    };


    // --- Kalkulasi Arus Kas (Cash Flow - Direct Method) ---
    const cashFlow = {
      inflow: {
        salesReceipts: salesRevenue,
        otherReceipts: otherRevenue,
        overages: shiftOverage,
        total: salesRevenue + otherRevenue + shiftOverage
      },
      outflow: {
        opexPayments: opexAmount,
        shortages: shiftShortage,
        total: opexAmount + shiftShortage
      },
      netCashFlow: (salesRevenue + otherRevenue + shiftOverage) - (opexAmount + shiftShortage)
    };

    // --- Generator Jurnal Akuntansi (General Ledger Journals) ---
    const journals: any[] = [];

    // Jurnal untuk Penjualan Kasir & HPP
    orders.forEach(o => {
      // 1. Jurnal Pembayaran Penjualan
      journals.push({
        date: o.createdAt,
        reference: `ORD-${o.orderNumber}`,
        description: `Penjualan Kasir - Order #${o.orderNumber}`,
        lines: [
          { account: '1-1000 - Kas & Setara Kas', debit: o.total, credit: 0 },
          ...(o.discount > 0 ? [{ account: '6-2000 - Beban Diskon Penjualan', debit: o.discount, credit: 0 }] : []),
          { account: '4-1000 - Pendapatan Penjualan', debit: 0, credit: o.subtotal },
          ...(o.tax > 0 ? [{ account: '2-1000 - Utang Pajak Restoran (PB1)', debit: 0, credit: o.tax }] : []),
          ...(o.serviceCharge > 0 ? [{ account: '4-2000 - Pendapatan Service Charge', debit: 0, credit: o.serviceCharge }] : [])
        ]
      });

      // 2. Jurnal HPP Penjualan (jika produk memiliki harga beli)
      let orderHpp = 0;
      o.items.forEach(item => {
        orderHpp += (item.buyPrice || 0) * item.qty;
      });

      if (orderHpp > 0) {
        journals.push({
          date: o.createdAt,
          reference: `COGS-${o.orderNumber}`,
          description: `Pencatatan HPP Penjualan - Order #${o.orderNumber}`,
          lines: [
            { account: '5-1000 - Harga Pokok Penjualan (HPP)', debit: orderHpp, credit: 0 },
            { account: '1-2000 - Persediaan Bahan Baku', debit: 0, credit: orderHpp }
          ]
        });
      }
    });

    // Jurnal untuk Petty Cash (CashFlow)
    cashFlows.forEach(cf => {
      if (cf.type === 'Pemasukan') {
        journals.push({
          date: cf.date,
          reference: `CF-IN-${cf.id}`,
          description: `Petty Cash Masuk - ${cf.description} (${cf.category})`,
          lines: [
            { account: '1-1000 - Kas & Setara Kas', debit: cf.amount, credit: 0 },
            { account: getPettyCashAccount(cf.category, 'Pemasukan'), debit: 0, credit: cf.amount }
          ]
        });
      } else {
        journals.push({
          date: cf.date,
          reference: `CF-OUT-${cf.id}`,
          description: `Petty Cash Keluar - ${cf.description} (${cf.category})`,
          lines: [
            { account: getPettyCashAccount(cf.category, 'Pengeluaran'), debit: cf.amount, credit: 0 },
            { account: '1-1000 - Kas & Setara Kas', debit: 0, credit: cf.amount }
          ]
        });
      }
    });

    // Jurnal untuk Audit Selisih Kasir
    shifts.forEach(s => {
      if (s.selisih && s.selisih !== 0) {
        const isNegative = s.selisih < 0;
        const absSelisih = Math.abs(s.selisih);
        journals.push({
          date: s.waktuTutup || new Date(),
          reference: `SHIFT-AUD-${s.id}`,
          description: `Audit Selisih Kasir Shift #${s.id} - ${s.user?.name}`,
          lines: isNegative ? [
            { account: '6-3000 - Beban Selisih Kasir (Shortage)', debit: absSelisih, credit: 0 },
            { account: '1-1000 - Kas & Setara Kas', debit: 0, credit: absSelisih }
          ] : [
            { account: '1-1000 - Kas & Setara Kas', debit: absSelisih, credit: 0 },
            { account: '4-4000 - Pendapatan Selisih Kasir (Overage)', debit: 0, credit: absSelisih }
          ]
        });
      }
    });

    // Urutkan jurnal dari tanggal terbaru
    journals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      profitLoss,
      cashFlow,
      journals
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat data akuntansi' });
  }
});

// GET Laporan Mutasi & Valuasi Stok Bahan Baku
router.get('/inventory', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;

    const todayStr = getTodayDateStr(tzOffset as string || -420);
    const sStr = (startDate as string) || todayStr;
    const eStr = (endDate as string) || sStr;
    const { startUtc: start, endUtc: end } = getCustomDateRange(sStr, eStr, tzOffset as string || -420);

    // 1. Fetch all ingredients
    const ingredients = await prisma.ingredient.findMany({
      include: {
        supplier: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });

    // 2. Fetch all logs in the period
    const logs = await prisma.ingredientLog.findMany({
      where: {
        createdAt: { gte: start, lte: end }
      }
    });

    // 3. Fetch all logs after end date to calculate starting/ending stocks relative to current stock
    const postPeriodLogs = await prisma.ingredientLog.findMany({
      where: {
        createdAt: { gt: end }
      }
    });

    const report = ingredients.map(ing => {
      // Sum of changes after the end of our period
      const changesAfterPeriod = postPeriodLogs
        .filter(l => l.ingredientId === ing.id)
        .reduce((sum, l) => sum + l.change, 0);

      // Ending stock of the period
      const stockAkhir = ing.stock - changesAfterPeriod;

      // Filter logs during the period
      const periodLogs = logs.filter(l => l.ingredientId === ing.id);

      // Calculate categories of changes in period
      let masuk = 0;
      let keluarProduksi = 0;
      let keluarRusak = 0;
      let penyesuaian = 0;

      periodLogs.forEach(l => {
        if (l.type === 'Restock' || l.type === 'PO') {
          masuk += l.change;
        } else if (l.type === 'Produksi') {
          keluarProduksi += Math.abs(l.change);
        } else if (l.type === 'Rusak') {
          keluarRusak += Math.abs(l.change);
        } else if (l.type === 'Penyesuaian') {
          penyesuaian += l.change;
        } else {
          if (l.change > 0) {
            masuk += l.change;
          } else {
            keluarRusak += Math.abs(l.change);
          }
        }
      });

      // Starting stock of the period
      const sumPeriodChanges = periodLogs.reduce((sum, l) => sum + l.change, 0);
      const stockAwal = stockAkhir - sumPeriodChanges;
      const totalValuation = stockAkhir * (ing.buyPrice || 0);

      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        minStock: ing.minStock,
        buyPrice: ing.buyPrice,
        supplierName: ing.supplier?.name || '—',
        stockAwal,
        masuk,
        keluarProduksi,
        keluarRusak,
        penyesuaian,
        stockAkhir,
        totalValuation
      };
    });

    // Summary calculations
    const totalAssetValuation = report.reduce((sum, item) => sum + item.totalValuation, 0);
    const criticalItemsCount = report.filter(item => item.stockAkhir <= item.minStock).length;
    const totalMutationsCount = logs.length;

    res.json({
      summary: {
        totalAssetValuation,
        criticalItemsCount,
        totalMutationsCount
      },
      inventory: report
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat laporan stok' });
  }
});

// GET Laporan Detail Menu & Valuasi Persediaan Barang Jadi
router.get('/product-details', authenticateToken, async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });

    const report = products.map(p => {
      const buyPrice = p.buyPrice || 0;
      const sellPrice = p.sellPrice || 0;
      const stock = p.stock || 0;
      const marginNominal = sellPrice - buyPrice;
      const marginPercent = sellPrice > 0 ? Math.round((marginNominal / sellPrice) * 100) : 0;
      const totalAssetValuation = stock * buyPrice;
      const totalPotentialSales = stock * sellPrice;

      return {
        id: p.id,
        barcode: p.barcode || '—',
        name: p.name,
        categoryName: p.category?.name || '—',
        buyPrice,
        sellPrice,
        stock,
        minStock: p.minStock,
        status: p.status,
        marginNominal,
        marginPercent,
        totalAssetValuation,
        totalPotentialSales
      };
    });

    const totalAssetValuation = report.reduce((sum, item) => sum + item.totalAssetValuation, 0);
    const totalPotentialSales = report.reduce((sum, item) => sum + item.totalPotentialSales, 0);
    const criticalProductsCount = report.filter(item => item.stock <= item.minStock).length;

    res.json({
      summary: {
        totalAssetValuation,
        totalPotentialSales,
        criticalProductsCount
      },
      products: report
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat laporan detail barang jadi' });
  }
});

// GET Laporan Bagi Hasil (Profit Sharing 80:20 / Custom)
router.get('/profit-sharing', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;

    const todayStr = getTodayDateStr(tzOffset as string || -420);
    const sStr = (startDate as string) || todayStr;
    const eStr = (endDate as string) || sStr;
    const { startUtc: start, endUtc: end } = getCustomDateRange(sStr, eStr, tzOffset as string || -420);

    // 1. Fetch settings
    const settings = await prisma.settings.findFirst();
    const ownerPct = settings?.profitSharingOwnerPercent ?? 80;
    const ramenPct = settings?.profitSharingRamenPercent ?? 20;
    const drinkPct = settings?.profitSharingDrinkPercent ?? 20;
    const opexMode = settings?.profitSharingOpexMode ?? 'BEFORE_SPLIT'; // 'BEFORE_SPLIT', 'OWNER_COVERED', 'SPLIT_50_50'

    // 2. Fetch Orders in range
    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: start, lte: end }
      },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    // 3. Fetch CashFlows (Expenses) in range
    const cashFlows = await prisma.cashFlow.findMany({
      where: {
        date: { gte: start, lte: end }
      }
    });

    // Division sales aggregation
    let foodRevenue = 0;
    let foodHpp = 0;
    let foodQty = 0;

    let drinkRevenue = 0;
    let drinkHpp = 0;
    let drinkQty = 0;

    let otherRevenue = 0;
    let otherHpp = 0;
    let otherQty = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        const buyPrice = item.buyPrice || item.product?.buyPrice || 0;
        const itemCost = buyPrice * item.qty;
        const grp = getCategoryGroup(item.product);

        if (grp === 'makanan') {
          foodRevenue += item.subtotal;
          foodHpp += itemCost;
          foodQty += item.qty;
        } else if (grp === 'minuman') {
          drinkRevenue += item.subtotal;
          drinkHpp += itemCost;
          drinkQty += item.qty;
        } else {
          otherRevenue += item.subtotal;
          otherHpp += itemCost;
          otherQty += item.qty;
        }
      });
    });

    const totalGrossRevenue = foodRevenue + drinkRevenue + otherRevenue;

    // Categorize Expenses from CashFlow
    let foodDirectExpense = 0;
    let drinkDirectExpense = 0;
    let sharedOpex = 0;
    const expenseList: any[] = [];

    cashFlows.forEach(cf => {
      if (cf.type === 'Pengeluaran') {
        const division = getExpenseDivision(cf);
        if (division === 'food') {
          foodDirectExpense += cf.amount;
        } else if (division === 'drink') {
          drinkDirectExpense += cf.amount;
        } else {
          sharedOpex += cf.amount;
        }
        expenseList.push({
          id: cf.id,
          date: cf.date,
          category: cf.category,
          description: cf.description,
          amount: cf.amount,
          division
        });
      }
    });

    // Calculate Division Net Profits based on opexMode
    const foodTotalExpense = foodDirectExpense > 0 ? foodDirectExpense : foodHpp;
    const drinkTotalExpense = drinkDirectExpense > 0 ? drinkDirectExpense : drinkHpp;

    const foodGrossProfit = foodRevenue - foodTotalExpense;
    const drinkGrossProfit = drinkRevenue - drinkTotalExpense;

    let foodSharedOpexPortion = 0;
    let drinkSharedOpexPortion = 0;
    let ownerSharedOpexPortion = 0;

    let foodNetProfit = foodGrossProfit;
    let drinkNetProfit = drinkGrossProfit;

    let ownerFoodShare = 0;
    let pjFoodShare = 0;
    let ownerDrinkShare = 0;
    let pjDrinkShare = 0;

    if (opexMode === 'BEFORE_SPLIT') {
      const totalDivRevenue = (foodRevenue + drinkRevenue) || 1;
      foodSharedOpexPortion = sharedOpex * (foodRevenue / totalDivRevenue);
      drinkSharedOpexPortion = sharedOpex * (drinkRevenue / totalDivRevenue);

      const foodNetAfterOpex = foodGrossProfit - foodSharedOpexPortion;
      const drinkNetAfterOpex = drinkGrossProfit - drinkSharedOpexPortion;

      foodNetProfit = foodNetAfterOpex;
      drinkNetProfit = drinkNetAfterOpex;

      ownerFoodShare = foodNetAfterOpex * (ownerPct / 100);
      pjFoodShare = foodNetAfterOpex * (ramenPct / 100);

      ownerDrinkShare = drinkNetAfterOpex * (ownerPct / 100);
      pjDrinkShare = drinkNetAfterOpex * (drinkPct / 100);
    } else if (opexMode === 'OWNER_COVERED') {
      ownerSharedOpexPortion = sharedOpex;

      pjFoodShare = foodGrossProfit * (ramenPct / 100);
      const rawOwnerFood = foodGrossProfit * (ownerPct / 100);

      pjDrinkShare = drinkGrossProfit * (drinkPct / 100);
      const rawOwnerDrink = drinkGrossProfit * (ownerPct / 100);

      ownerFoodShare = rawOwnerFood - (sharedOpex * (foodRevenue / ((foodRevenue + drinkRevenue) || 1)));
      ownerDrinkShare = rawOwnerDrink - (sharedOpex * (drinkRevenue / ((foodRevenue + drinkRevenue) || 1)));
    } else {
      // SPLIT_50_50
      ownerSharedOpexPortion = sharedOpex * 0.5;
      foodSharedOpexPortion = sharedOpex * 0.25;
      drinkSharedOpexPortion = sharedOpex * 0.25;

      pjFoodShare = (foodGrossProfit * (ramenPct / 100)) - foodSharedOpexPortion;
      pjDrinkShare = (drinkGrossProfit * (drinkPct / 100)) - drinkSharedOpexPortion;

      ownerFoodShare = (foodGrossProfit * (ownerPct / 100)) - (sharedOpex * 0.25);
      ownerDrinkShare = (drinkGrossProfit * (ownerPct / 100)) - (sharedOpex * 0.25);
    }

    const totalOwnerProfit = ownerFoodShare + ownerDrinkShare;
    const totalPjRamenProfit = pjFoodShare;
    const totalPjDrinkProfit = pjDrinkShare;
    const totalNetProfit = totalOwnerProfit + totalPjRamenProfit + totalPjDrinkProfit;

    // Daily breakdown for profit sharing table/chart
    const dailyBreakdown: any[] = [];
    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);
    const iterDate = new Date(Date.UTC(sy, sm - 1, sd));
    const endDateObj = new Date(Date.UTC(ey, em - 1, ed));

    while (iterDate <= endDateObj) {
      const iy = iterDate.getUTCFullYear();
      const im = String(iterDate.getUTCMonth() + 1).padStart(2, '0');
      const id = String(iterDate.getUTCDate()).padStart(2, '0');
      const dayDateStr = `${iy}-${im}-${id}`;
      const { startUtc: dayStart, endUtc: dayEnd } = getLocalDateRange(dayDateStr, tzOffset as string || -420);

      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);
      const dayCashFlows = cashFlows.filter(cf => cf.date >= dayStart && cf.date <= dayEnd && cf.type === 'Pengeluaran');

      let dFoodRev = 0;
      let dFoodHpp = 0;
      let dDrinkRev = 0;
      let dDrinkHpp = 0;

      dayOrders.forEach(o => {
        o.items.forEach(item => {
          const buyPrice = item.buyPrice || item.product?.buyPrice || 0;
          const cost = buyPrice * item.qty;
          const grp = getCategoryGroup(item.product);
          if (grp === 'makanan') {
            dFoodRev += item.subtotal;
            dFoodHpp += cost;
          } else if (grp === 'minuman') {
            dDrinkRev += item.subtotal;
            dDrinkHpp += cost;
          }
        });
      });

      let dFoodExp = 0;
      let dDrinkExp = 0;
      let dSharedOpex = 0;

      dayCashFlows.forEach(cf => {
        const div = getExpenseDivision(cf);
        if (div === 'food') dFoodExp += cf.amount;
        else if (div === 'drink') dDrinkExp += cf.amount;
        else dSharedOpex += cf.amount;
      });

      const dFoodCost = dFoodExp > 0 ? dFoodExp : dFoodHpp;
      const dDrinkCost = dDrinkExp > 0 ? dDrinkExp : dDrinkHpp;
      const dFoodNet = dFoodRev - dFoodCost;
      const dDrinkNet = dDrinkRev - dDrinkCost;

      dailyBreakdown.push({
        date: dayDateStr,
        dateLabel: iterDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        dayName: iterDate.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'UTC' }),
        foodRevenue: dFoodRev,
        foodExpense: dFoodCost,
        foodNet: dFoodNet,
        foodPjShare: dFoodNet * (ramenPct / 100),
        drinkRevenue: dDrinkRev,
        drinkExpense: dDrinkCost,
        drinkNet: dDrinkNet,
        drinkPjShare: dDrinkNet * (drinkPct / 100),
        sharedOpex: dSharedOpex,
        totalOmzet: dFoodRev + dDrinkRev,
        ownerShareTotal: (dFoodNet * (ownerPct / 100)) + (dDrinkNet * (ownerPct / 100)) - (opexMode === 'OWNER_COVERED' ? dSharedOpex : 0)
      });

      iterDate.setUTCDate(iterDate.getUTCDate() + 1);
    }

    res.json({
      period: { startDate: sStr, endDate: eStr },
      config: {
        ownerPct,
        ramenPct,
        drinkPct,
        opexMode
      },
      foodDivision: {
        name: 'MUKI RAMEN (Food & Kitchen)',
        revenue: foodRevenue,
        hpp: foodHpp,
        directExpense: foodDirectExpense,
        totalExpense: foodTotalExpense,
        grossProfit: foodGrossProfit,
        sharedOpexPortion: foodSharedOpexPortion,
        netProfit: foodNetProfit,
        ownerShare: ownerFoodShare,
        pjShare: pjFoodShare,
        qtySold: foodQty,
        percentage: totalGrossRevenue > 0 ? Math.round((foodRevenue / totalGrossRevenue) * 100) : 0
      },
      drinkDivision: {
        name: 'MUKI DRINK (Beverage & Bar)',
        revenue: drinkRevenue,
        hpp: drinkHpp,
        directExpense: drinkDirectExpense,
        totalExpense: drinkTotalExpense,
        grossProfit: drinkGrossProfit,
        sharedOpexPortion: drinkSharedOpexPortion,
        netProfit: drinkNetProfit,
        ownerShare: ownerDrinkShare,
        pjShare: pjDrinkShare,
        qtySold: drinkQty,
        percentage: totalGrossRevenue > 0 ? Math.round((drinkRevenue / totalGrossRevenue) * 100) : 0
      },
      sharedOpex: {
        total: sharedOpex,
        ownerPortion: ownerSharedOpexPortion,
        foodPortion: foodSharedOpexPortion,
        drinkPortion: drinkSharedOpexPortion,
        items: expenseList
      },
      summary: {
        totalRevenue: totalGrossRevenue,
        grandTotalRevenue: totalGrossRevenue,
        totalDirectExpense: foodTotalExpense + drinkTotalExpense,
        totalSharedOpex: sharedOpex,
        sharedOpexTotal: sharedOpex,
        totalExpense: foodTotalExpense + drinkTotalExpense + sharedOpex,
        grandTotalExpense: foodTotalExpense + drinkTotalExpense + sharedOpex,
        totalNetProfit,
        grandTotalNetProfit: totalNetProfit,
        ownerShare: totalOwnerProfit,
        totalOwnerShare: totalOwnerProfit,
        pjRamenShare: totalPjRamenProfit,
        pjDrinkShare: totalPjDrinkProfit,
        totalPjShare: totalPjRamenProfit + totalPjDrinkProfit,
        opexMode,
        food: {
          revenue: foodRevenue,
          expense: foodTotalExpense,
          grossNet: foodGrossProfit,
          sharedOpexDeduction: foodSharedOpexPortion,
          finalNet: foodNetProfit,
          ownerShare: ownerFoodShare,
          pjShare: pjFoodShare,
          profitSharingPct: ramenPct,
          ownerPct
        },
        drink: {
          revenue: drinkRevenue,
          expense: drinkTotalExpense,
          grossNet: drinkGrossProfit,
          sharedOpexDeduction: drinkSharedOpexPortion,
          finalNet: drinkNetProfit,
          ownerShare: ownerDrinkShare,
          pjShare: pjDrinkShare,
          profitSharingPct: drinkPct,
          ownerPct
        }
      },
      dailyBreakdown
    });

  } catch (error) {
    console.error('Profit sharing report error:', error);
    res.status(500).json({ error: 'Gagal memuat laporan bagi hasil' });
  }
});

// GET Matrix Bonus Harian Omzet Karyawan & Rekap Absensi
router.get('/daily-omzet-bonus', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, tzOffset } = req.query;

    const todayStr = getTodayDateStr(tzOffset as string || -420);
    const sStr = (startDate as string) || todayStr;
    const eStr = (endDate as string) || sStr;
    const { startUtc: start, endUtc: end } = getCustomDateRange(sStr, eStr, tzOffset as string || -420);

    // 1. Fetch settings & bonus tiers
    const settings = await prisma.settings.findFirst();
    const enableDailyOmzetBonus = settings?.enableDailyOmzetBonus ?? true;
    
    let tiers: Array<{ minOmzet: number; bonus: number; label?: string }> = [
      { minOmzet: 6000000, bonus: 25000, label: 'Tier >= 6.0 Juta' },
      { minOmzet: 5000000, bonus: 20000, label: 'Tier >= 5.0 Juta' },
      { minOmzet: 4000000, bonus: 15000, label: 'Tier >= 4.0 Juta' },
      { minOmzet: 3000000, bonus: 10000, label: 'Tier >= 3.0 Juta' },
      { minOmzet: 2500000, bonus: 5000,  label: 'Tier >= 2.5 Juta' }
    ];

    if (settings?.dailyOmzetTiers) {
      try {
        const parsed = JSON.parse(settings.dailyOmzetTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          tiers = parsed;
        }
      } catch (e) {
        console.error('Error parsing dailyOmzetTiers:', e);
      }
    }

    // Sort tiers descending by minOmzet
    tiers.sort((a, b) => Number(b.minOmzet) - Number(a.minOmzet));

    // 2. Fetch all active employees (excluding Admin, Super Admin, and Owner for staff rewards document)
    const users = await prisma.user.findMany({
      where: {
        status: { not: 'Nonaktif' },
        NOT: [
          { role: { in: ['Admin', 'admin', 'Super Admin', 'superadmin', 'Owner', 'owner'] } },
          { username: { in: ['admin', 'superadmin', 'owner'] } }
        ]
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        employmentType: true,
        status: true
      },
      orderBy: [
        { employmentType: 'asc' },
        { role: 'asc' },
        { name: 'asc' }
      ]
    });

    // 3. Fetch orders and attendances in date range
    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: start, lte: end }
      },
      select: {
        id: true,
        total: true,
        createdAt: true
      }
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: sStr, lte: eStr }
      }
    });

    // 4. Generate Daily Matrix
    const days: any[] = [];
    const employeeSummaryMap: Record<number, {
      user: any;
      totalBonus: number;
      presentCount: number;
      lateCount: number;
      offCount: number;
      leaveCount: number;
      alphaCount: number;
      dwCount: number;
    }> = {};

    users.forEach(u => {
      employeeSummaryMap[u.id] = {
        user: u,
        totalBonus: 0,
        presentCount: 0,
        lateCount: 0,
        offCount: 0,
        leaveCount: 0,
        alphaCount: 0,
        dwCount: 0
      };
    });

    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);
    const iterDate = new Date(Date.UTC(sy, sm - 1, sd));
    const endDateObj = new Date(Date.UTC(ey, em - 1, ed));

    let totalBonusAllEmployees = 0;

    while (iterDate <= endDateObj) {
      const iy = iterDate.getUTCFullYear();
      const im = String(iterDate.getUTCMonth() + 1).padStart(2, '0');
      const id = String(iterDate.getUTCDate()).padStart(2, '0');
      const dayDateStr = `${iy}-${im}-${id}`;
      const { startUtc: dayStart, endUtc: dayEnd } = getLocalDateRange(dayDateStr, tzOffset as string || -420);

      // Orders for this day
      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);
      const grossOmzet = dayOrders.reduce((sum, o) => sum + o.total, 0);

      // Match tier
      let matchedTier = null;
      let tierBonus = 0;
      if (enableDailyOmzetBonus) {
        for (const t of tiers) {
          if (grossOmzet >= Number(t.minOmzet)) {
            matchedTier = t;
            tierBonus = Number(t.bonus);
            break;
          }
        }
      }

      // Attendances for this day
      const dayAttendances = attendances.filter(a => a.date === dayDateStr);
      const employeeAttendanceRecord: Record<number, {
        status: string;
        bonus: number;
        clockIn?: string;
        clockOut?: string;
        lateMinutes?: number;
        displayBadge: string;
      }> = {};

      users.forEach(u => {
        const att = dayAttendances.find(a => a.userId === u.id);
        const empType = u.employmentType || 'FULL_TIME';
        const summary = employeeSummaryMap[u.id];

        let status = 'LIBUR';
        let bonus = 0;
        let displayBadge = 'LIBUR';

        if (att) {
          const rawStatus = (att.status || '').toUpperCase();
          if (rawStatus === 'HADIR' || rawStatus === 'PRESENT') {
            if (empType === 'FULL_TIME') {
              status = 'HADIR';
              bonus = tierBonus;
              displayBadge = bonus > 0 ? `+${bonus.toLocaleString('id-ID')}` : 'HADIR';
              summary.presentCount++;
              summary.totalBonus += bonus;
              totalBonusAllEmployees += bonus;
            } else if (empType === 'DAILY_WORKER') {
              status = 'DW';
              bonus = 0;
              displayBadge = 'DW';
              summary.dwCount++;
            } else {
              status = 'HADIR';
              bonus = 0;
              displayBadge = 'HADIR';
              summary.presentCount++;
            }
          } else if (rawStatus === 'TERLAMBAT' || rawStatus === 'LATE') {
            if (empType === 'FULL_TIME') {
              status = 'TERLAMBAT';
              bonus = tierBonus;
              displayBadge = bonus > 0 ? `+${bonus.toLocaleString('id-ID')}` : 'TELAT';
              summary.lateCount++;
              summary.presentCount++;
              summary.totalBonus += bonus;
              totalBonusAllEmployees += bonus;
            } else if (empType === 'DAILY_WORKER') {
              status = 'DW';
              bonus = 0;
              displayBadge = 'DW';
              summary.dwCount++;
            } else {
              status = 'TERLAMBAT';
              bonus = 0;
              displayBadge = 'TELAT';
              summary.lateCount++;
              summary.presentCount++;
            }
          } else if (rawStatus === 'IZIN' || rawStatus === 'LEAVE') {
            status = 'IZIN';
            displayBadge = 'IZIN';
            summary.leaveCount++;
          } else if (rawStatus === 'SAKIT' || rawStatus === 'SICK') {
            status = 'SAKIT';
            displayBadge = 'SAKIT';
            summary.leaveCount++;
          } else if (rawStatus === 'CUTI') {
            status = 'CUTI';
            displayBadge = 'CUTI';
            summary.leaveCount++;
          } else {
            status = 'LIBUR';
            displayBadge = 'LIBUR';
            summary.offCount++;
          }
        } else {
          status = 'LIBUR';
          displayBadge = 'LIBUR';
          summary.offCount++;
        }

        employeeAttendanceRecord[u.id] = {
          status,
          bonus,
          clockIn: att?.clockIn ? att.clockIn.toISOString() : undefined,
          clockOut: att?.clockOut ? att.clockOut.toISOString() : undefined,
          lateMinutes: att?.lateMinutes || 0,
          displayBadge
        };
      });

      days.push({
        date: dayDateStr,
        dayName: iterDate.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'UTC' }),
        dateLabel: iterDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        grossOmzet,
        matchedTier,
        tierBonus,
        employeeAttendance: employeeAttendanceRecord
      });

      iterDate.setUTCDate(iterDate.getUTCDate() + 1);
    }

    const employeeSummaries = Object.values(employeeSummaryMap).map(s => ({
      userId: s.user.id,
      name: s.user.name,
      username: s.user.username,
      role: s.user.role,
      employmentType: s.user.employmentType,
      totalBonus: s.totalBonus,
      presentCount: s.presentCount,
      lateCount: s.lateCount,
      offCount: s.offCount,
      leaveCount: s.leaveCount,
      alphaCount: s.alphaCount,
      dwCount: s.dwCount
    }));

    res.json({
      period: { startDate: sStr, endDate: eStr, totalDays: days.length },
      enableDailyOmzetBonus,
      tiers,
      employees: users,
      days,
      employeeSummaries,
      totalBonusAll: totalBonusAllEmployees
    });

  } catch (error) {
    console.error('Daily omzet bonus report error:', error);
    res.status(500).json({ error: 'Gagal memuat laporan bonus harian omzet' });
  }
});

export default router;

