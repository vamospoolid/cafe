import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();

// Semua rute outlet wajib terautentikasi dan memiliki context tenant
router.use(authenticateToken);

// ─── 1. GET /api/outlets - Ambil daftar seluruh cabang / outlet milik tenant ──
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    let outlets = await prisma.outlet.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });

    // Auto-provisioning outlet default jika tenant belum memiliki outlet sama sekali
    if (outlets.length === 0) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true }
      });

      const defaultOutlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant?.name || 'Cabang'} Utama`,
          code: `${(tenant?.slug || 'CAB').substring(0, 4).toUpperCase()}-01`,
          status: 'ACTIVE',
          address: 'Pusat'
        }
      });
      outlets = [defaultOutlet];
    }

    return res.json({ outlets });
  } catch (err: any) {
    console.error('[Outlets API] Error fetching outlets:', err);
    return res.status(500).json({ error: 'Gagal mengambil daftar cabang outlet.' });
  }
});

// ─── 2. POST /api/outlets - Tambah cabang / outlet baru (Owner / Admin) ───────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = (req.user?.role || '').toUpperCase();

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    if (userRole !== 'OWNER' && userRole !== 'ADMIN' && !(req.user as any)?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Hanya Owner atau Admin yang berhak mendaftarkan cabang baru.' });
    }

    const { name, code, address, phone, latitude, longitude, gpsRadiusMeters } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: 'Nama cabang/outlet wajib diisi.' });
    }

    // Generate kode jika tidak disediakan
    let finalCode = (code || '').trim().toUpperCase();
    if (!finalCode) {
      const count = await prisma.outlet.count({ where: { tenantId } });
      finalCode = `CAB-${String(count + 1).padStart(2, '0')}`;
    }

    // Cek duplikasi kode dalam tenant yang sama
    const existingCode = await prisma.outlet.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: finalCode
        }
      }
    });

    if (existingCode) {
      return res.status(400).json({ error: `Kode cabang "${finalCode}" sudah digunakan di bisnis Anda.` });
    }

    const newOutlet = await prisma.outlet.create({
      data: {
        tenantId,
        name: String(name).trim(),
        code: finalCode,
        address: address ? String(address).trim() : null,
        phone: phone ? String(phone).trim() : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        gpsRadiusMeters: gpsRadiusMeters ? parseFloat(gpsRadiusMeters) : 100,
        status: 'ACTIVE'
      }
    });

    // Catat ke Audit Log
    await AuditLogger.log({
      tenantId,
      outletId: newOutlet.id,
      userId: req.user?.id,
      userName: req.user?.name,
      userRole: req.user?.role,
      action: 'CREATE_OUTLET',
      resource: 'OUTLET',
      resourceId: newOutlet.id,
      description: `Menambahkan cabang outlet baru: "${newOutlet.name}" (${newOutlet.code})`,
      severity: 'INFO'
    }, req);

    return res.status(201).json({
      message: 'Cabang outlet baru berhasil didaftarkan.',
      outlet: newOutlet
    });
  } catch (err: any) {
    console.error('[Outlets API] Error creating outlet:', err);
    return res.status(500).json({ error: 'Gagal menambahkan cabang outlet.' });
  }
});

// ─── 3. PUT /api/outlets/:id - Perbarui data cabang outlet ────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const id = String(req.params.id);
    const userRole = (req.user?.role || '').toUpperCase();

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    if (userRole !== 'OWNER' && userRole !== 'ADMIN' && !(req.user as any)?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Hanya Owner atau Admin yang berhak mengedit data cabang.' });
    }

    const existing = await prisma.outlet.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cabang outlet tidak ditemukan.' });
    }

    const { name, address, phone, latitude, longitude, gpsRadiusMeters, status } = req.body;

    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(address !== undefined ? { address: address ? String(address).trim() : null } : {}),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(latitude !== undefined ? { latitude: latitude ? parseFloat(latitude) : null } : {}),
        ...(longitude !== undefined ? { longitude: longitude ? parseFloat(longitude) : null } : {}),
        ...(gpsRadiusMeters ? { gpsRadiusMeters: parseFloat(gpsRadiusMeters) } : {}),
        ...(status ? { status: String(status).toUpperCase() } : {})
      }
    });

    return res.json({
      message: 'Data cabang berhasil diperbarui.',
      outlet: updated
    });
  } catch (err: any) {
    console.error('[Outlets API] Error updating outlet:', err);
    return res.status(500).json({ error: 'Gagal memperbarui data cabang outlet.' });
  }
});

// ─── 4. GET /api/outlets/consolidated-summary - Laporan Konsolidasi Seluruh Cabang
router.get('/consolidated-summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const { startDate, endDate, tzOffset } = req.query;

    // Filter tanggal
    const dateFilter: any = {};
    if (startDate && endDate) {
      const sDate = new Date(String(startDate));
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(String(endDate));
      eDate.setHours(23, 59, 59, 999);
      dateFilter.gte = sDate;
      dateFilter.lte = eDate;
    } else if (startDate) {
      const sDate = new Date(String(startDate));
      sDate.setHours(0, 0, 0, 0);
      dateFilter.gte = sDate;
    } else if (endDate) {
      const eDate = new Date(String(endDate));
      eDate.setHours(23, 59, 59, 999);
      dateFilter.lte = eDate;
    }

    // 1. Ambil seluruh outlet milik tenant (auto-provision jika belum ada)
    let outlets = await prisma.outlet.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });

    if (outlets.length === 0) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true }
      });

      const defaultOutlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant?.name || 'Cabang'} Utama`,
          code: `${(tenant?.slug || 'CAB').substring(0, 4).toUpperCase()}-01`,
          status: 'ACTIVE',
          address: 'Pusat'
        }
      });
      outlets = [defaultOutlet];
    }

    const settings = await prisma.settings.findFirst({
      where: { tenantId },
      select: { address: true, phone: true }
    });

    // 2. Ambil data order F&B / Retail yang sudah dibayar (dukung status 'Paid', 'PAID', 'Completed')
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['Paid', 'PAID', 'Completed'] },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
      },
      select: {
        id: true,
        outletId: true,
        total: true,
        createdAt: true
      }
    });

    // 3. Ambil data order Laundry (aman jika model tidak ada)
    let laundryOrders: any[] = [];
    try {
      if ((prisma as any).laundryOrder) {
        laundryOrders = await (prisma as any).laundryOrder.findMany({
          where: {
            tenantId,
            paymentStatus: { in: ['PAID', 'Paid', 'PARTIAL', 'Partial'] },
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
          },
          select: {
            id: true,
            outletId: true,
            paidAmount: true,
            totalAmount: true,
            status: true,
            createdAt: true
          }
        });
      }
    } catch (e) {
      console.warn('[Outlets API] LaundryOrder query omitted:', (e as any)?.message);
    }

    // 4. Ambil data WorkOrder Bengkel (aman jika model tidak ada)
    let workOrders: any[] = [];
    try {
      if ((prisma as any).workOrder) {
        workOrders = await (prisma as any).workOrder.findMany({
          where: {
            tenantId,
            paymentStatus: { in: ['PAID', 'Paid'] },
            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
          },
          select: {
            id: true,
            outletId: true,
            totalAmount: true,
            createdAt: true
          }
        });
      }
    } catch (e) {
      console.warn('[Outlets API] WorkOrder query omitted:', (e as any)?.message);
    }

    // 5. Ambil data CashFlow (Pengeluaran Operasional per outlet)
    let cashFlows: any[] = [];
    try {
      cashFlows = await prisma.cashFlow.findMany({
        where: {
          tenantId,
          type: 'Pengeluaran',
          status: { in: ['APPROVED', 'Approved'] },
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        },
        select: {
          id: true,
          outletId: true,
          amount: true
        }
      });
    } catch (e) {
      console.warn('[Outlets API] CashFlow query omitted:', (e as any)?.message);
    }

    // 6. Hitung statistik agregasi per outlet
    const outletStats = outlets.map((out) => {
      // Order umum (F&B / Retail)
      const matchingOrders = orders.filter(o => o.outletId === out.id || (!o.outletId && (outlets.length === 1 || (out as any).isDefault || out.code.includes('01'))));
      const revenueGeneral = matchingOrders.reduce((sum, o) => sum + ((o as any).total || 0), 0);
      const countGeneral = matchingOrders.length;

      // Laundry
      const matchingLaundry = laundryOrders.filter(l => l.outletId === out.id || (!l.outletId && (outlets.length === 1 || (out as any).isDefault || out.code.includes('01'))));
      const revenueLaundry = matchingLaundry.reduce((sum, l) => sum + (l.paidAmount || 0), 0);
      const countLaundry = matchingLaundry.length;

      // Bengkel
      const matchingBengkel = workOrders.filter(w => w.outletId === out.id || (!w.outletId && (outlets.length === 1 || (out as any).isDefault || out.code.includes('01'))));
      const revenueBengkel = matchingBengkel.reduce((sum, w) => sum + (w.totalAmount || 0), 0);
      const countBengkel = matchingBengkel.length;

      // Total revenue & orders gabungan vertikal
      const totalRevenue = revenueGeneral + revenueLaundry + revenueBengkel;
      const totalOrders = countGeneral + countLaundry + countBengkel;

      // Total pengeluaran
      const matchingExpenses = cashFlows.filter(cf => cf.outletId === out.id || (!cf.outletId && (outlets.length === 1 || (out as any).isDefault || out.code.includes('01'))));
      const totalExpense = matchingExpenses.reduce((sum, cf) => sum + (cf.amount || 0), 0);

      const netProfit = totalRevenue - totalExpense;
      const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      return {
        outletId: out.id,
        name: out.name,
        code: out.code,
        status: out.status,
        address: out.address || (outlets.length === 1 ? settings?.address : null) || out.address,
        totalRevenue,
        totalOrders,
        totalExpense,
        netProfit,
        aov
      };
    });

    // 7. Hitung total konsolidasi seluruh bisnis
    const consolidatedRevenue = outletStats.reduce((sum, s) => sum + s.totalRevenue, 0);
    const consolidatedOrders = outletStats.reduce((sum, s) => sum + s.totalOrders, 0);
    const consolidatedExpense = outletStats.reduce((sum, s) => sum + s.totalExpense, 0);
    const consolidatedProfit = consolidatedRevenue - consolidatedExpense;
    const consolidatedAOV = consolidatedOrders > 0 ? Math.round(consolidatedRevenue / consolidatedOrders) : 0;

    // Urutkan performa cabang dari omset tertinggi ke terendah
    const rankedOutlets = [...outletStats].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const topPerformingOutlet = rankedOutlets[0]?.totalRevenue > 0 ? rankedOutlets[0] : null;

    return res.json({
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      summary: {
        consolidatedRevenue,
        consolidatedOrders,
        consolidatedExpense,
        consolidatedProfit,
        consolidatedAOV,
        outletCount: outlets.length,
        topPerformingOutlet: topPerformingOutlet ? {
          name: topPerformingOutlet.name,
          code: topPerformingOutlet.code,
          revenue: topPerformingOutlet.totalRevenue
        } : null
      },
      outlets: rankedOutlets
    });
  } catch (err: any) {
    console.error('[Outlets API] Error fetching consolidated summary:', err);
    return res.status(500).json({ error: 'Gagal mengambil data laporan konsolidasi multi-outlet.' });
  }
});

export default router;
