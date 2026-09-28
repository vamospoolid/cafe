import { Router, Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import prisma from '../../db';

const router = Router();

// GET /api/bengkel/reports/summary
// Parameter: startDate, endDate (YYYY-MM-DD)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }

    const { startDate, endDate } = req.query;

    let dateFilter: any = {};
    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);
      dateFilter = {
        createdAt: {
          gte: start,
          lte: end
        }
      };
    } else {
      // Default: 30 hari terakhir
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        createdAt: {
          gte: thirtyDaysAgo
        }
      };
    }

    // 1. Fetch Work Orders (PAID or DELIVERED)
    const paidWorkOrders = await prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PAID', 'DELIVERED'] },
        ...dateFilter
      },
      include: {
        services: true,
        parts: {
          include: {
            product: {
              select: { id: true, buyPrice: true, stock: true, minStock: true }
            }
          }
        },
        customer: { select: { id: true, name: true, phone: true } }
      }
    });

    // 2. Calculate Financial Breakdown
    let omzetJasa = 0;
    let omzetParts = 0;
    let totalDiscount = 0;
    let hppParts = 0;

    // Track parts sold for Fast Moving analysis
    const partsMap = new Map<string, {
      name: string;
      qty: number;
      revenue: number;
      stock: number;
      minStock: number;
    }>();

    paidWorkOrders.forEach(wo => {
      omzetJasa += wo.totalServices || 0;
      omzetParts += wo.totalParts || 0;
      totalDiscount += wo.discount || 0;

      wo.parts.forEach(p => {
        const itemHPP = p.product?.buyPrice ? Number(p.product.buyPrice) * p.qty : 0;
        hppParts += itemHPP;

        const key = p.partName.toLowerCase().trim();
        const existing = partsMap.get(key);
        if (existing) {
          existing.qty += p.qty;
          existing.revenue += p.subtotal;
        } else {
          partsMap.set(key, {
            name: p.partName,
            qty: p.qty,
            revenue: p.subtotal,
            stock: p.product?.stock ?? 0,
            minStock: p.product?.minStock ?? 0
          });
        }
      });
    });

    const totalOmzetKotor = omzetJasa + omzetParts;
    const totalOmzetBersih = Math.max(0, totalOmzetKotor - totalDiscount);
    const labaKotorParts = Math.max(0, omzetParts - hppParts);

    // 3. Mechanic Performance & Commissions
    const mechanics = await prisma.mechanicProfile.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, username: true } }
      }
    });

    const mechanicStats = mechanics.map(m => {
      let spkCount = 0;
      let totalJasaGenerated = 0;
      const seenSpk = new Set<string>();

      paidWorkOrders.forEach(wo => {
        const mechanicServices = wo.services.filter(s => s.mechanicId === m.userId);
        if (mechanicServices.length > 0) {
          if (!seenSpk.has(wo.id)) {
            seenSpk.add(wo.id);
            spkCount++;
          }
          mechanicServices.forEach(s => {
            totalJasaGenerated += s.subtotal;
          });
        }
      });

      const estCommission = m.commissionType !== 'NONE' && m.commissionRate > 0
        ? totalJasaGenerated * m.commissionRate
        : 0;

      // Kumpulkan 10 pekerjaan SPK terakhir yang ditangani mekanik ini untuk modal drill-down
      const recentJobs: any[] = [];
      paidWorkOrders.forEach(wo => {
        const mechanicServices = wo.services.filter(s => s.mechanicId === m.userId);
        if (mechanicServices.length > 0) {
          const jasaSubtotal = mechanicServices.reduce((acc, s) => acc + s.subtotal, 0);
          recentJobs.push({
            spkNumber: wo.spkNumber,
            date: wo.createdAt,
            vehicle: `${wo.vehiclePlate || ''} ${wo.vehicleModel || ''}`.trim() || 'Kendaraan Umum',
            servicesCount: mechanicServices.length,
            servicesSummary: mechanicServices.map(s => s.serviceName).join(', '),
            jasaAmount: jasaSubtotal,
            commissionEarned: m.commissionRate > 0 ? jasaSubtotal * m.commissionRate : 0
          });
        }
      });

      return {
        id: m.id,
        userId: m.userId,
        name: m.user?.name || 'Mekanik',
        username: m.user?.username || '-',
        commissionRate: m.commissionRate,
        pendingCommission: m.pendingCommission,
        paidCommission: m.paidCommission,
        spkCompleted: spkCount,
        totalJasaGenerated,
        estimatedPeriodCommission: estCommission,
        recentJobs: recentJobs.slice(0, 10)
      };
    });

    // 3b. Daily Trend Analytics (Sales & SPK Volume per Day)
    const dailyMap = new Map<string, {
      date: string;
      dateFormatted: string;
      omzetJasa: number;
      omzetParts: number;
      totalOmzet: number;
      spkCount: number;
    }>();

    paidWorkOrders.forEach(wo => {
      const dateStr = wo.createdAt.toISOString().split('T')[0];
      const d = new Date(wo.createdAt);
      const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      const jasa = wo.totalServices || 0;
      const parts = wo.totalParts || 0;
      const total = Math.max(0, (jasa + parts) - (wo.discount || 0));

      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.omzetJasa += jasa;
        existing.omzetParts += parts;
        existing.totalOmzet += total;
        existing.spkCount += 1;
      } else {
        dailyMap.set(dateStr, {
          date: dateStr,
          dateFormatted,
          omzetJasa: jasa,
          omzetParts: parts,
          totalOmzet: total,
          spkCount: 1
        });
      }
    });

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 3c. Cash Flow (Arus Kas Masuk & Beban Kas Keluar / OPEX)
    let cashflowDateFilter: any = {};
    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);
      cashflowDateFilter = { date: { gte: start, lte: end } };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      cashflowDateFilter = { date: { gte: thirtyDaysAgo } };
    }

    const cashFlowEntries = await prisma.cashFlow.findMany({
      where: {
        tenantId,
        ...cashflowDateFilter
      }
    });

    let totalInflow = 0;
    let totalOutflow = 0;
    const opexMap = new Map<string, number>();

    cashFlowEntries.forEach(cf => {
      const isExpense = cf.type === 'Pengeluaran' || cf.type === 'EXPENSE' || cf.type.toLowerCase().includes('keluar');
      if (isExpense) {
        totalOutflow += cf.amount;
        const cat = cf.category || 'Operasional Lainnya';
        opexMap.set(cat, (opexMap.get(cat) || 0) + cf.amount);
      } else {
        totalInflow += cf.amount;
      }
    });

    const opexBreakdown = Array.from(opexMap.entries()).map(([category, amount]) => ({
      category,
      amount
    })).sort((a, b) => b.amount - a.amount);

    const cashflowSummary = {
      totalInflow,
      totalOutflow,
      netCashflow: totalInflow - totalOutflow,
      opexBreakdown
    };

    const totalBebanKomisi = mechanicStats.reduce((sum, m) => sum + m.estimatedPeriodCommission, 0);
    const totalBebanOpex = totalOutflow;
    const totalLabaKotor = omzetJasa + labaKotorParts - totalDiscount;
    const labaSetelahKomisi = Math.max(0, totalLabaKotor - totalBebanKomisi);
    const estimasiLabaBersih = Math.max(0, labaSetelahKomisi - totalBebanOpex);

    // 4. Fast Moving Parts (Top 10)
    const fastMovingParts = Array.from(partsMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(p => ({
        ...p,
        isCritical: p.stock <= p.minStock
      }));

    // 5. Invoices & B2B Status
    const invoices = await prisma.workOrderInvoice.findMany({
      where: { tenantId, ...dateFilter }
    });

    const invoiceStats = {
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paidAmount: invoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.totalAmount, 0),
      unpaidAmount: invoices.filter(inv => inv.status !== 'PAID').reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
      paidCount: invoices.filter(inv => inv.status === 'PAID').length,
      unpaidCount: invoices.filter(inv => inv.status !== 'PAID').length
    };

    // ─── 6. Perhitungan MoM / Perbandingan Periode Sebelumnya ───
    let prevStart: Date;
    let prevEnd: Date;
    if (startDate && endDate) {
      const curStart = new Date(`${startDate}T00:00:00.000Z`);
      const curEnd = new Date(`${endDate}T23:59:59.999Z`);
      const diffMs = curEnd.getTime() - curStart.getTime();
      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diffMs);
    } else {
      const now = new Date();
      prevEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    const prevWorkOrders = await prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PAID', 'DELIVERED'] },
        createdAt: { gte: prevStart, lte: prevEnd }
      },
      select: { totalServices: true, totalParts: true, discount: true }
    });

    let prevOmzetBersih = 0;
    prevWorkOrders.forEach(wo => {
      prevOmzetBersih += Math.max(0, (wo.totalServices + wo.totalParts) - (wo.discount || 0));
    });
    const prevSpkCount = prevWorkOrders.length;

    const growthOmzetPct = prevOmzetBersih > 0
      ? Math.round(((totalOmzetBersih - prevOmzetBersih) / prevOmzetBersih) * 100)
      : null;
    const growthSpkPct = prevSpkCount > 0
      ? Math.round(((paidWorkOrders.length - prevSpkCount) / prevSpkCount) * 100)
      : null;

    // ─── 7. Intelijen Kategori Jasa Servis & Tipe Kendaraan ───
    const serviceCategoryMap = new Map<string, { name: string; count: number; revenue: number }>();
    const vehicleMap = new Map<string, { model: string; count: number; revenue: number }>();

    paidWorkOrders.forEach(wo => {
      const model = (wo.vehicleModel || wo.vehicleBrand || 'Umum').trim();
      const woTotal = Math.max(0, (wo.totalServices + wo.totalParts) - (wo.discount || 0));
      const curVeh = vehicleMap.get(model) || { model, count: 0, revenue: 0 };
      curVeh.count += 1;
      curVeh.revenue += woTotal;
      vehicleMap.set(model, curVeh);

      wo.services.forEach(s => {
        const lower = (s.serviceName || '').toLowerCase();
        let cat = 'Jasa Servis Umum';
        if (/oli|oil|pelumas/i.test(lower)) cat = 'Ganti Oli & Pelumas';
        else if (/tune|karbu|injeksi|cvt|ringan|filter/i.test(lower)) cat = 'Tune Up & Servis Ringan';
        else if (/rem|brake|kampas|piringan|tromol|shock|bearing|ban|laher/i.test(lower)) cat = 'Pengereman & Roda';
        else if (/aki|accu|lampu|kabel|kelistrikan|spul|starter|busi/i.test(lower)) cat = 'Kelistrikan & Pengapian';
        else if (/turun|overhaul|korter|piston|klep|noken/i.test(lower)) cat = 'Turun Mesin (Overhaul)';

        const existing = serviceCategoryMap.get(cat) || { name: cat, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += s.subtotal;
        serviceCategoryMap.set(cat, existing);
      });
    });

    const totalServiceRevenue = Array.from(serviceCategoryMap.values()).reduce((sum, c) => sum + c.revenue, 0);
    const serviceCategories = Array.from(serviceCategoryMap.values())
      .map(c => ({
        ...c,
        sharePct: totalServiceRevenue > 0 ? Math.round((c.revenue / totalServiceRevenue) * 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const vehicleBreakdown = Array.from(vehicleMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ─── 8. Dead-Stock / Slow-Moving Sparepart (Stok Mengendap) ───
    const soldProductIds = new Set<number>();
    paidWorkOrders.forEach(wo => {
      wo.parts.forEach(p => {
        if (p.product?.id) soldProductIds.add(p.product.id);
      });
    });

    const allStockedProducts = await prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        stock: true,
        buyPrice: true,
        sellPrice: true,
        storageLocation: true,
        updatedAt: true
      }
    });

    const deadStockParts = allStockedProducts
      .filter(p => !soldProductIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        buyPrice: Number(p.buyPrice || 0),
        sellPrice: Number(p.sellPrice || 0),
        storageLocation: p.storageLocation || 'Rak Gudang',
        tiedUpCapital: p.stock * Number(p.buyPrice || 0)
      }))
      .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital)
      .slice(0, 15);

    const totalTiedUpCapital = deadStockParts.reduce((sum, p) => sum + p.tiedUpCapital, 0);

    // ─── 9. CRM Reminder Servis Berkala & Unit Jatuh Tempo ───
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const pastWorkOrders = await prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PAID', 'DELIVERED'] },
        createdAt: { gte: oneEightyDaysAgo, lte: fortyFiveDaysAgo }
      },
      include: {
        customer: { select: { name: true, phone: true } },
        services: { select: { serviceName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const recentReturnedPlates = new Set(
      (await prisma.workOrder.findMany({
        where: {
          tenantId,
          createdAt: { gt: fortyFiveDaysAgo },
          vehiclePlate: { not: null }
        },
        select: { vehiclePlate: true }
      })).map(w => w.vehiclePlate?.toUpperCase().replace(/\s+/g, ''))
    );

    const tenantStoreSettings = await prisma.settings.findFirst({ where: { tenantId } });
    const storeName = tenantStoreSettings?.storeName || 'Bengkel Kami';

    const reminderMap = new Map<string, any>();
    for (const wo of pastWorkOrders) {
      if (!wo.vehiclePlate) continue;
      const cleanPlate = wo.vehiclePlate.toUpperCase().replace(/\s+/g, '');
      if (recentReturnedPlates.has(cleanPlate)) continue;
      if (reminderMap.has(cleanPlate)) continue;

      const daysSince = Math.floor((Date.now() - new Date(wo.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const custName = wo.customer?.name || 'Pelanggan';
      const custPhone = wo.customer?.phone || '';
      const vehicle = `${wo.vehiclePlate} (${wo.vehicleModel || 'Kendaraan'})`;
      const serviceList = wo.services.map(s => s.serviceName).slice(0, 2).join(', ');

      const waText = encodeURIComponent(
        `Halo Kak ${custName}, kami dari ${storeName} menginfokan kendaraan ${vehicle} tercatat terakhir servis pada ${new Date(wo.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} (${daysSince} hari lalu). Saatnya servis berkala & ganti oli kembali agar performa mesin tetap prima. Hubungi kami untuk booking antrean. Terima kasih!`
      );

      reminderMap.set(cleanPlate, {
        plate: wo.vehiclePlate,
        model: wo.vehicleModel || 'Motor/Mobil',
        customerName: custName,
        customerPhone: custPhone,
        lastServiceDate: wo.createdAt,
        daysSince,
        odometer: wo.odometer,
        lastServices: serviceList || 'Servis Berkala',
        waLink: custPhone ? `https://wa.me/${custPhone.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${waText}` : null
      });

      if (reminderMap.size >= 25) break;
    }

    const serviceDueReminders = Array.from(reminderMap.values());

    res.json({
      period: {
        startDate: startDate || '30 hari terakhir',
        endDate: endDate || 'Hari ini'
      },
      summary: {
        totalSPK: paidWorkOrders.length,
        totalOmzetKotor,
        totalDiscount,
        totalOmzetBersih,
        omzetJasa,
        omzetParts,
        hppParts,
        labaKotorParts,
        totalLabaKotor,
        totalBebanKomisi,
        labaSetelahKomisi,
        totalBebanOpex,
        estimasiLabaBersih,
        // MoM comparisons
        prevOmzetBersih,
        prevSpkCount,
        growthOmzetPct,
        growthSpkPct,
        tiedUpCapitalInDeadStock: totalTiedUpCapital
      },
      dailyTrend,
      cashflowSummary,
      mechanicPerformance: mechanicStats,
      fastMovingParts,
      invoiceStats,
      serviceCategories,
      vehicleBreakdown,
      deadStockParts,
      totalTiedUpCapital,
      serviceDueReminders
    });
  } catch (error: any) {
    console.error('Error fetching bengkel reports:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat laporan bengkel' });
  }
});

// GET /api/bengkel/reports/dashboard-stats
// Dashboard eksekutif bengkel — sumber: WorkOrder + CashFlow (BUKAN Order kafe)
// CashFlow category 'PENJUALAN_SPK - Tunai/Non-Tunai' dicatat otomatis saat SPK PAID
router.get('/dashboard-stats', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const [
      activeSpk,
      doneToday,
      pendingSpk,
      spkWaitingParts,
      spkDoneUnpaid,
      spkTertundaLama,
      paidWorkOrdersToday,
      cashflowToday,
      products,
      productsHPP,
      mechanicAgg,
      piutangAktif,
      piutangOverdue,
    ] = await Promise.all([
      // 1. SPK aktif dikerjakan
      prisma.workOrder.count({
        where: { tenantId, status: { in: ['IN_PROGRESS', 'WAITING_PARTS', 'ASSIGNED'] } }
      }),
      // 2. SPK selesai/dibayar hari ini
      prisma.workOrder.count({
        where: { tenantId, status: { in: ['DONE', 'PAID', 'DELIVERED'] }, updatedAt: { gte: startOfToday } }
      }),
      // 3. SPK pending/antrian
      prisma.workOrder.count({
        where: { tenantId, status: 'PENDING' }
      }),
      // 4. SPK menunggu sparepart
      prisma.workOrder.count({
        where: { tenantId, status: 'WAITING_PARTS' }
      }),
      // 5. SPK selesai tapi belum dibayar
      prisma.workOrder.count({
        where: { tenantId, status: 'DONE' }
      }),
      // 6. SPK sudah > 3 hari belum selesai
      prisma.workOrder.count({
        where: {
          tenantId,
          status: { in: ['IN_PROGRESS', 'WAITING_PARTS'] },
          createdAt: { lte: threeDaysAgo }
        }
      }),
      // 7. WorkOrder PAID/DELIVERED hari ini — sumber omzet jasa & parts
      prisma.workOrder.findMany({
        where: {
          tenantId,
          status: { in: ['PAID', 'DELIVERED'] },
          updatedAt: { gte: startOfToday }
        },
        select: {
          totalServices: true,
          totalParts: true,
          totalAmount: true,
          paidAmount: true,
          discount: true,
          services: {
            select: {
              serviceName: true,
              price: true,
              subtotal: true
            }
          },
          parts: {
            select: {
              qty: true,
              product: { select: { buyPrice: true } }
            }
          }
        }
      }),
      // 8. CashFlow hari ini — kas tunai & digital bengkel
      // HANYA baca category PENJUALAN_SPK — tidak menyentuh data Order kafe
      prisma.cashFlow.findMany({
        where: {
          tenantId,
          type: 'Pemasukan',
          category: { startsWith: 'PENJUALAN_SPK' },
          date: { gte: startOfToday }
        },
        select: { category: true, amount: true }
      }),
      // 9. Produk untuk nilai aset (harga jual)
      prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        select: { stock: true, minStock: true, sellPrice: true }
      }),
      // 10. Produk untuk HPP stok (harga beli)
      prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        select: { stock: true, buyPrice: true }
      }),
      // 11. Komisi mekanik pending
      prisma.mechanicProfile.aggregate({
        where: { tenantId },
        _sum: { pendingCommission: true }
      }),
      // 12. Piutang aktif dari WorkOrderInvoice
      prisma.workOrderInvoice.aggregate({
        where: { tenantId, status: { not: 'PAID' } },
        _sum: { totalAmount: true }
      }),
      // 13. Invoice overdue
      prisma.workOrderInvoice.count({
        where: { tenantId, status: { not: 'PAID' }, dueDate: { lt: now } }
      }),
    ]);

    // --- Kalkulasi Omzet dari WorkOrder (bukan dari Order kafe) ---
    let omzetJasa = 0;
    let omzetParts = 0;
    let hppParts = 0;

    for (const wo of paidWorkOrdersToday) {
      omzetJasa += Number(wo.totalServices || 0);
      omzetParts += Number(wo.totalParts || 0);
      for (const part of wo.parts) {
        if (part.product?.buyPrice) {
          hppParts += Number(part.product.buyPrice) * part.qty;
        }
      }
    }

    const omzetKotor = omzetJasa + omzetParts;
    const totalDiscount = paidWorkOrdersToday.reduce((s, w) => s + Number(w.discount || 0), 0);
    const omzetBersih = Math.max(0, omzetKotor - totalDiscount);
    const estimasiLabaKotor = omzetJasa + Math.max(0, omzetParts - hppParts);
    const marginPersen = omzetKotor > 0 ? Math.round((estimasiLabaKotor / omzetKotor) * 100) : 0;
    const avgSpkValue = paidWorkOrdersToday.length > 0
      ? Math.round(omzetBersih / paidWorkOrdersToday.length) : 0;

    // --- Kas dari CashFlow (PENJUALAN_SPK) ---
    let kasTunai = 0;
    let kasDigital = 0;
    for (const cf of cashflowToday) {
      if (cf.category.includes('Tunai')) kasTunai += Number(cf.amount);
      else kasDigital += Number(cf.amount);
    }

    // --- Inventaris ---
    const lowStockCount = products.filter(
      p => p.minStock !== null && p.minStock > 0 && p.stock <= p.minStock
    ).length;
    const stockAssetValue = products.reduce((sum, p) => sum + p.stock * Number(p.sellPrice || 0), 0);
    const stockAssetHPP = productsHPP.reduce((sum, p) => sum + p.stock * Number(p.buyPrice || 0), 0);
    const stockMarginPersen = stockAssetValue > 0
      ? Math.round(((stockAssetValue - stockAssetHPP) / stockAssetValue) * 100) : 0;

    const pendingCommission = Number(mechanicAgg._sum.pendingCommission ?? 0);
    const bebanKomisiRasio = omzetJasa > 0
      ? Math.round((pendingCommission / omzetJasa) * 100) : 0;

    const totalPiutangAktif = Number(piutangAktif._sum.totalAmount ?? 0);

    // --- Top Services Hari Ini ---
    const servicesMap = new Map<string, { name: string; count: number; omzet: number }>();
    for (const wo of paidWorkOrdersToday) {
      for (const s of (wo as any).services || []) {
        const name = s.serviceName || 'Servis';
        const existing = servicesMap.get(name);
        const subtotal = Number(s.subtotal || s.price || 0);
        if (existing) {
          existing.count += 1;
          existing.omzet += subtotal;
        } else {
          servicesMap.set(name, { name, count: 1, omzet: subtotal });
        }
      }
    }
    const topServices = Array.from(servicesMap.values())
      .sort((a, b) => b.omzet - a.omzet)
      .slice(0, 5)
      .map(s => ({
        ...s,
        omzet: Math.round(s.omzet)
      }));

    res.json({
      activeSpk, doneToday, pendingSpk, spkWaitingParts, spkDoneUnpaid, spkTertundaLama,
      omzetJasa: Math.round(omzetJasa),
      omzetParts: Math.round(omzetParts),
      omzetKotor: Math.round(omzetKotor),
      omzetBersih: Math.round(omzetBersih),
      hppParts: Math.round(hppParts),
      estimasiLabaKotor: Math.round(estimasiLabaKotor),
      marginPersen,
      avgSpkValue,
      totalDiscount: Math.round(totalDiscount),
      spkPaidCount: paidWorkOrdersToday.length,
      kasTunai: Math.round(kasTunai),
      kasDigital: Math.round(kasDigital),
      lowStockCount,
      stockAssetValue: Math.round(stockAssetValue),
      stockAssetHPP: Math.round(stockAssetHPP),
      stockMarginPersen,
      pendingCommission: Math.round(pendingCommission),
      bebanKomisiRasio,
      totalPiutangAktif: Math.round(totalPiutangAktif),
      piutangOverdueCount: piutangOverdue,
      topServices,
    });
  } catch (error: any) {
    console.error('Error fetching bengkel dashboard stats:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat statistik dashboard bengkel' });
  }
});

// GET /api/bengkel/reports/revenue-chart
// Tren omzet harian split Jasa vs Parts — sumber: WorkOrder (BUKAN analytics.ts/Order kafe)
router.get('/revenue-chart', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia' });

    const days = Math.min(parseInt(String(req.query.days || '7')), 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PAID', 'DELIVERED'] },
        updatedAt: { gte: startDate }
      },
      select: { totalServices: true, totalParts: true, updatedAt: true }
    });

    const map = new Map<string, { omzetJasa: number; omzetParts: number; totalSpk: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      map.set(d.toISOString().split('T')[0], { omzetJasa: 0, omzetParts: 0, totalSpk: 0 });
    }

    for (const wo of workOrders) {
      const key = wo.updatedAt.toISOString().split('T')[0];
      const entry = map.get(key);
      if (entry) {
        entry.omzetJasa += Number(wo.totalServices || 0);
        entry.omzetParts += Number(wo.totalParts || 0);
        entry.totalSpk += 1;
      }
    }

    const result = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }),
        omzetJasa: Math.round(v.omzetJasa),
        omzetParts: Math.round(v.omzetParts),
        omzetTotal: Math.round(v.omzetJasa + v.omzetParts),
        totalSpk: v.totalSpk
      }));

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching bengkel revenue chart:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat grafik omzet bengkel' });
  }
});

// GET /api/bengkel/reports/spk-status-summary
// Distribusi status SPK untuk donut chart
router.get('/spk-status-summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia' });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const [pending, assigned, inProgress, waitingParts, done, paidToday] = await Promise.all([
      prisma.workOrder.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.workOrder.count({ where: { tenantId, status: 'ASSIGNED' } }),
      prisma.workOrder.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      prisma.workOrder.count({ where: { tenantId, status: 'WAITING_PARTS' } }),
      prisma.workOrder.count({ where: { tenantId, status: 'DONE' } }),
      prisma.workOrder.count({
        where: { tenantId, status: { in: ['PAID', 'DELIVERED'] }, updatedAt: { gte: startOfToday } }
      }),
    ]);

    const total = pending + assigned + inProgress + waitingParts + done + paidToday;
    res.json({ pending, assigned, inProgress, waitingParts, done, paidToday, total });
  } catch (error: any) {
    console.error('Error fetching SPK status summary:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat status SPK' });
  }
});

// GET /api/bengkel/reports/mechanic-today
// Leaderboard mekanik hari ini — top 5 by omzet jasa
router.get('/mechanic-today', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia' });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const [mechanics, paidWorkOrders] = await Promise.all([
      prisma.mechanicProfile.findMany({
        where: { tenantId },
        include: { user: { select: { id: true, name: true, username: true } } }
      }),
      prisma.workOrder.findMany({
        where: { tenantId, status: { in: ['PAID', 'DELIVERED'] }, updatedAt: { gte: startOfToday } },
        include: {
          services: { select: { mechanicId: true, subtotal: true } }
        }
      })
    ]);

    const leaderboard = mechanics.map(m => {
      const seenSpk = new Set<string>();
      let spkCount = 0;
      let omzetJasa = 0;

      for (const wo of paidWorkOrders) {
        const myServices = wo.services.filter(s => s.mechanicId === m.userId);
        if (myServices.length > 0 && !seenSpk.has(wo.id)) {
          seenSpk.add(wo.id);
          spkCount++;
        }
        for (const s of myServices) omzetJasa += Number(s.subtotal);
      }

      const estimasiKomisi = m.commissionType !== 'NONE' && m.commissionRate > 0
        ? Math.round(omzetJasa * m.commissionRate) : 0;

      return {
        userId: m.userId,
        name: m.user?.name || m.user?.username || 'Mekanik',
        spkCount,
        omzetJasa: Math.round(omzetJasa),
        estimasiKomisi,
        pendingCommission: Math.round(Number(m.pendingCommission || 0)),
      };
    })
    .filter(m => m.spkCount > 0 || m.omzetJasa > 0)
    .sort((a, b) => b.omzetJasa - a.omzetJasa)
    .slice(0, 5);

    const totalKomisiPending = mechanics.reduce(
      (sum, m) => sum + Number(m.pendingCommission || 0), 0
    );

    res.json({ leaderboard, totalKomisiPending: Math.round(totalKomisiPending) });
  } catch (error: any) {
    console.error('Error fetching mechanic today stats:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat data mekanik' });
  }
});

export default router;

