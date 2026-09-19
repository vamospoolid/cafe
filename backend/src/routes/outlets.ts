import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { quotaService } from '../services/QuotaService';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/outlets
 * Mengambil daftar cabang / outlet milik tenant aktif beserta statistik ringkas
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';

    const outlets = await prisma.outlet.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            tables: true,
            orders: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Ambil omzet dan pesanan hari ini per outlet
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const outletsWithStats = await Promise.all(
      outlets.map(async (outlet) => {
        const todayOrders = await prisma.order.aggregate({
          where: {
            tenantId,
            outletId: outlet.id,
            status: { notIn: ['CANCELLED', 'VOID'] },
            createdAt: { gte: today }
          },
          _sum: { total: true },
          _count: { id: true }
        }).catch(() => ({ _sum: { total: 0 }, _count: { id: 0 } }));

        return {
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
          address: outlet.address || '',
          phone: outlet.phone || '',
          status: outlet.status,
          gpsRadiusMeters: outlet.gpsRadiusMeters,
          latitude: outlet.latitude,
          longitude: outlet.longitude,
          tablesCount: outlet._count.tables,
          totalOrdersAllTime: outlet._count.orders,
          todayOrdersCount: todayOrders._count?.id || 0,
          todayRevenue: todayOrders._sum?.total || 0,
          createdAt: outlet.createdAt
        };
      })
    );

    return res.json({
      success: true,
      total: outletsWithStats.length,
      outlets: outletsWithStats
    });
  } catch (error: any) {
    console.error('[Outlets API GET Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat daftar cabang' });
  }
});

/**
 * POST /api/outlets
 * Membuat cabang baru dengan proteksi kuota paket langganan
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const { name, code, address, phone, latitude, longitude, gpsRadiusMeters } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Nama cabang dan kode cabang wajib diisi' });
    }

    // 1. Validasi Kuota Cabang Paket SaaS
    const quotaCheck = await quotaService.canCreateOutlet(tenantId);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: 'QUOTA_EXCEEDED',
        message: quotaCheck.message || 'Batas maksimal cabang pada paket langganan Anda telah tercapai.',
        current: quotaCheck.current,
        max: quotaCheck.max,
        suggestedUpgrade: 'GROWTH'
      });
    }

    // 2. Cek keunikan kode outlet dalam tenant
    const existingCode = await prisma.outlet.findFirst({
      where: {
        tenantId,
        code: code.trim().toUpperCase()
      }
    });

    if (existingCode) {
      return res.status(400).json({ error: `Kode cabang '${code}' sudah digunakan oleh cabang lain.` });
    }

    // 3. Simpan Outlet Baru
    const newOutlet = await prisma.outlet.create({
      data: {
        tenantId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        gpsRadiusMeters: gpsRadiusMeters ? parseFloat(gpsRadiusMeters) : 100,
        status: 'ACTIVE'
      }
    });

    // 4. Catat Usage Record
    await quotaService.trackUsage(tenantId, 'outlets', quotaCheck.current + 1, quotaCheck.max);

    await AuditLogger.log({
      tenantId,
      outletId: newOutlet.id,
      action: 'OUTLET_CREATE',
      resource: 'OUTLETS',
      description: `Membuat cabang baru: ${newOutlet.name} (${newOutlet.code})`,
      severity: 'INFO'
    }, req);

    return res.status(201).json({
      success: true,
      message: `Cabang ${newOutlet.name} berhasil ditambahkan!`,
      outlet: newOutlet
    });
  } catch (error: any) {
    console.error('[Outlets API POST Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal menambahkan cabang' });
  }
});

/**
 * PUT /api/outlets/:id
 * Memperbarui data cabang
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const id = String(req.params.id);
    const { name, code, address, phone, latitude, longitude, gpsRadiusMeters, status } = req.body;

    const existing = await prisma.outlet.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cabang tidak ditemukan' });
    }

    const updated = await prisma.outlet.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(latitude !== undefined ? { latitude: latitude ? parseFloat(latitude) : null } : {}),
        ...(longitude !== undefined ? { longitude: longitude ? parseFloat(longitude) : null } : {}),
        ...(gpsRadiusMeters !== undefined ? { gpsRadiusMeters: parseFloat(gpsRadiusMeters) } : {}),
        ...(status ? { status } : {})
      }
    });

    await AuditLogger.log({
      tenantId,
      outletId: id,
      action: 'OUTLET_UPDATE',
      resource: 'OUTLETS',
      description: `Memperbarui data cabang: ${updated.name}`,
      severity: 'INFO'
    }, req);

    return res.json({
      success: true,
      message: `Data cabang ${updated.name} berhasil diperbarui`,
      outlet: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal memperbarui cabang' });
  }
});

/**
 * DELETE /api/outlets/:id
 * Menghapus atau menonaktifkan cabang
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-default-muki';
    const id = String(req.params.id);

    const outlet = await prisma.outlet.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!outlet) {
      return res.status(404).json({ error: 'Cabang tidak ditemukan' });
    }

    // Jika sudah ada transaksi pesanan, jangan hard delete, ubah status ke CLOSED
    if (outlet._count.orders > 0) {
      const closed = await prisma.outlet.update({
        where: { id },
        data: { status: 'CLOSED' }
      });

      return res.json({
        success: true,
        message: `Cabang ${closed.name} dinonaktifkan (karena memiliki riwayat transaksi).`,
        outlet: closed
      });
    }

    await prisma.outlet.delete({ where: { id } });

    return res.json({
      success: true,
      message: `Cabang ${outlet.name} berhasil dihapus.`
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal menghapus cabang' });
  }
});

export default router;
