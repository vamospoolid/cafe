import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Helper to group by date
function getPastDays(days: number) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

router.get('/sales-chart', authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 7;
    const pastDates = getPastDays(days);
    const startDate = pastDates[0];

    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: startDate }
      },
      select: { total: true, createdAt: true }
    });

    const chartData = pastDates.map(date => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dailyOrders = orders.filter(o => 
        o.createdAt >= date && o.createdAt < nextDate
      );
      
      const totalSales = dailyOrders.reduce((sum, o) => sum + o.total, 0);
      
      return {
        name: date.toLocaleDateString('id-ID', { weekday: 'short' }),
        date: date.toISOString().split('T')[0],
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Fetch Today's Orders
    const todayOrders = await prisma.order.findMany({
      where: {
        status: { not: 'Void' },
        createdAt: { gte: today }
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

      // Hourly sales breakdown
      const hour = new Date(order.createdAt).getHours();
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

    res.json({
      revenue: totalRevenue,
      profit: totalProfit,
      transactions: totalTransactions,
      averageServiceTime: avgServiceTime,
      paymentMethods,
      hourlySales,
      tableOccupancy: {
        occupied: occupiedTablesCount,
        total: totalTables,
        percentage: totalTables > 0 ? Math.round((occupiedTablesCount / totalTables) * 100) : 0
      },
      lowStockProducts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat summary dashboard' });
  }
});

// GET Laporan Lengkap (Custom Date Range)
router.get('/reports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const start = new Date((startDate as string) || todayStr);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date((endDate as string) || todayStr);
    end.setHours(23, 59, 59, 999);

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
        const buyPrice = item.buyPrice || 0;
        const itemCost = buyPrice * item.qty;
        totalHpp += itemCost;

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
    const shifts = await prisma.shift.findMany({
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

    // 3. TODAY'S RECAP (Independent of filters)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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
      makanan: (categoryMap['Makanan']?.revenue || 0) + (categoryMap['Salties']?.revenue || 0),
      minuman: (categoryMap['Minuman']?.revenue || 0) + (categoryMap['Bevvies']?.revenue || 0),
      dessert: (categoryMap['Dessert']?.revenue || 0) + (categoryMap['Pastry']?.revenue || 0) + (categoryMap['Sweeties']?.revenue || 0),
      other: Object.entries(categoryMap)
        .filter(([name]) => !['Makanan', 'Minuman', 'Dessert', 'Pastry', 'Salties', 'Sweeties', 'Bevvies'].includes(name))
        .reduce((sum, [, d]) => sum + d.revenue, 0)
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
    let curr = new Date(start);
    while (curr <= end) {
      const dayStart = new Date(curr);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(curr);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);
      const dayExpenses = cashFlows.filter(cf => cf.type === 'Pengeluaran' && cf.date >= dayStart && cf.date <= dayEnd).reduce((sum, cf) => sum + cf.amount, 0);

      let dayMakanan = 0;
      let dayMinuman = 0;
      let dayTotal = 0;
      let dayHpp = 0;

      dayOrders.forEach(o => {
        dayTotal += o.total;
        o.items.forEach(item => {
          const buyPrice = item.product?.buyPrice || 0;
          dayHpp += buyPrice * item.qty;
          const cat = item.product?.category?.name || '';
          if (cat === 'Makanan' || cat === 'Salties') {
            dayMakanan += item.subtotal;
          } else if (cat === 'Minuman' || cat === 'Bevvies') {
            dayMinuman += item.subtotal;
          }
        });
      });

      dailyTimeline.push({
        dateLabel: curr.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        dateRaw: curr.toISOString().split('T')[0],
        makanan: dayMakanan,
        minuman: dayMinuman,
        total: dayTotal,
        expenses: dayExpenses,
        profit: dayTotal - dayHpp - dayExpenses,
        count: dayOrders.length
      });

      curr.setDate(curr.getDate() + 1);
    }

    res.json({
      summary: {
        revenue: totalRevenue,
        profit: totalProfit,
        hpp: totalHpp,
        transactionsCount,
        discounts: totalDiscounts,
        tax: totalTax,
        serviceCharge: totalServiceCharge
      },
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
    const { startDate, endDate } = req.query;

    const todayStr = new Date().toISOString().split('T')[0];
    const start = new Date((startDate as string) || todayStr);
    start.setHours(0, 0, 0, 0);

    const end = new Date((endDate as string) || todayStr);
    end.setHours(23, 59, 59, 999);

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

    cashFlows.forEach(cf => {
      if (cf.type === 'Pemasukan') {
        otherRevenue += cf.amount;
      } else {
        opexAmount += cf.amount;
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
      shiftOverage,
      cogs: totalHpp,
      grossProfit,
      operatingExpenses,
      opexAmount,
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

export default router;
