import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { io, emitToTenant } from '../index';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Router-level fail-closed guard: all KDS operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const user = (req as AuthRequest).user;
  const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || 'tenant-vamos-pool';
  (req as any).tenantId = tenantId;
  next();
});

// GET Active KDS Orders (Dapur) - Terisolasi per Tenant
// Hanya mengambil order yang belum selesai dimasak (Pending, Cooking, Ready) atau dibatalkan (Cancelled)
router.get('/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId() || 'tenant-vamos-pool';

    const activeShift = await prisma.shift.findFirst({
      where: { 
        status: { in: ['Open', 'OPEN'] },
        OR: [
          { tenantId },
          { tenantId: 'tenant-vamos-pool' },
          { tenantId: null }
        ]
      }
    });

    const whereCondition: any = {
      OR: [
        { tenantId },
        { tenantId: 'tenant-vamos-pool' },
        { tenantId: null }
      ],
      AND: [
        {
          OR: [
            {
              status: { not: 'Void' },
              kdsStatus: { in: ['Pending', 'Cooking', 'Ready'] }
            },
            {
              kdsStatus: 'Cancelled'
            }
          ]
        }
      ]
    };

    if (activeShift) {
      whereCondition.createdAt = { gte: activeShift.waktuBuka };
    }

    const activeOrders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        table: true,
        items: {
          include: {
            product: { select: { name: true, imageUrl: true, categoryId: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' } // First In, First Out
    });
    
    res.json(activeOrders);
  } catch (error) {
    console.error('KDS Fetch Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data KDS' });
  }
});

// PATCH Update Status Masakan - Terisolasi per Tenant
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { kdsStatus } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = (user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string)) as string;

    const validStatuses = ['Pending', 'Cooking', 'Ready', 'Served', 'Cancelled'];
    if (!validStatuses.includes(kdsStatus)) {
      return res.status(400).json({ error: 'Status KDS tidak valid' });
    }

    // Pastikan order milik tenant ini
    const existingOrder = await prisma.order.findFirst({
      where: { 
        id: Number(id),
        tenantId
      }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    const updateData: any = { kdsStatus };
    if (kdsStatus === 'Served') {
      updateData.servedAt = new Date();
    } else {
      updateData.servedAt = null;
    }

    const order = await prisma.order.update({
      where: { id: existingOrder.id },
      data: updateData,
      include: { table: true }
    });

    // Emit real-time event ke room tenant terkait
    emitToTenant(tenantId, 'kds:statusChanged', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      kdsStatus,
      tableNo: (order as any).table?.tableNo || null
    });

    // Event khusus saat makanan Ready → notifikasi kasir & waiter
    if (kdsStatus === 'Ready') {
      emitToTenant(tenantId, 'kds:ready', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableNo: (order as any).table?.tableNo || null
      });
    }

    res.json({ message: 'Status masakan berhasil diperbarui', order });
  } catch (error) {
    console.error('KDS Status Update Error:', error);
    res.status(500).json({ error: 'Gagal memperbarui status KDS' });
  }
});

// GET last served order for global recall - Terisolasi per Tenant
router.get('/last-served', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const lastServed = await prisma.order.findFirst({
      where: { 
        kdsStatus: 'Served',
        tenantId
      },
      orderBy: { servedAt: 'desc' },
      include: {
        table: true,
        items: {
          include: {
            product: { select: { name: true } }
          }
        }
      }
    });
    res.json(lastServed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data pesanan terakhir' });
  }
});

// POST undo status for KDS order - Terisolasi per Tenant
router.post('/:id/undo', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = (user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string)) as string;

    const order = await prisma.order.findFirst({
      where: { 
        id: Number(id),
        tenantId
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    let previousStatus = '';
    if (order.kdsStatus === 'Cooking') previousStatus = 'Pending';
    else if (order.kdsStatus === 'Ready') previousStatus = 'Cooking';
    else if (order.kdsStatus === 'Served') previousStatus = 'Ready';
    else {
      return res.status(400).json({ error: 'Status saat ini tidak dapat di-undo' });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { 
        kdsStatus: previousStatus,
        servedAt: null
      },
      include: { table: true }
    });

    emitToTenant(tenantId, 'kds:statusChanged', {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      kdsStatus: previousStatus,
      tableNo: (updated as any).table?.tableNo || null
    });

    res.json({ message: 'Undo berhasil', order: updated });
  } catch (error) {
    console.error('KDS Undo Error:', error);
    res.status(500).json({ error: 'Gagal melakukan undo status KDS' });
  }
});

// GET served history for today - Terisolasi per Tenant
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();

    const activeShift = await prisma.shift.findFirst({
      where: { 
        status: 'Open',
        tenantId
      }
    });

    const whereCondition: any = {
      kdsStatus: 'Served',
      tenantId
    };

    if (activeShift) {
      whereCondition.servedAt = { gte: activeShift.waktuBuka };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      whereCondition.servedAt = { gte: today };
    }

    const history = await prisma.order.findMany({
      where: whereCondition,
      include: {
        table: true,
        items: {
          include: {
            product: { select: { name: true, categoryId: true } }
          }
        }
      },
      orderBy: { servedAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memuat riwayat saji' });
  }
});

export default router;
