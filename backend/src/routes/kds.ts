import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io } from '../index';

const router = Router();
const prisma = new PrismaClient();

// GET Active KDS Orders (Dapur)
// Hanya mengambil order yang belum selesai dimasak (Pending, Cooking, Ready) atau dibatalkan (Cancelled)
router.get('/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' }
    });

    const whereCondition: any = {
      OR: [
        {
          status: { not: 'Void' },
          kdsStatus: { in: ['Pending', 'Cooking', 'Ready'] }
        },
        {
          kdsStatus: 'Cancelled'
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
            product: { select: { name: true, imageUrl: true } }
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

// PATCH Update Status Masakan
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { kdsStatus } = req.body;

    const validStatuses = ['Pending', 'Cooking', 'Ready', 'Served', 'Cancelled'];
    if (!validStatuses.includes(kdsStatus)) {
      return res.status(400).json({ error: 'Status KDS tidak valid' });
    }

    const updateData: any = { kdsStatus };
    if (kdsStatus === 'Served') {
      updateData.servedAt = new Date();
    } else {
      updateData.servedAt = null;
    }

    const order = await prisma.order.update({
      where: { id: Number(id) },
      data: updateData,
      include: { table: true }
    });

    // Emit real-time event ke semua klien
    io.emit('kds:statusChanged', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      kdsStatus,
      tableNo: (order as any).table?.tableNo || null
    });

    // Event khusus saat makanan Ready → notifikasi kasir & waiter
    if (kdsStatus === 'Ready') {
      io.emit('kds:ready', {
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

// GET last served order for global recall
router.get('/last-served', authenticateToken, async (req: Request, res: Response) => {
  try {
    const lastServed = await prisma.order.findFirst({
      where: { kdsStatus: 'Served' },
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

// POST undo status for KDS order
router.post('/:id/undo', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: Number(id) }
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
      where: { id: Number(id) },
      data: { 
        kdsStatus: previousStatus,
        servedAt: null
      }
    });

    res.json({ message: 'Undo berhasil', order: updated });
  } catch (error) {
    console.error('KDS Undo Error:', error);
    res.status(500).json({ error: 'Gagal melakukan undo status KDS' });
  }
});

// GET served history for today
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' }
    });

    const whereCondition: any = {
      kdsStatus: 'Served'
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
            product: { select: { name: true } }
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
