import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io } from '../index';

const router = Router();
const prisma = new PrismaClient();

// Get table detail (Public - for Dine-In customers to verify table number)
router.get('/public/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    let table = null;

    if (!isNaN(numId)) {
      table = await prisma.table.findUnique({
        where: { id: numId }
      });
    }

    const paramId = String(id);
    if (!table) {
      table = await prisma.table.findFirst({
        where: { tableNo: paramId }
      });
    }

    if (!table) {
      const allTables = await prisma.table.findMany();
      table = allTables.find(t => t.tableNo.toLowerCase() === paramId.toLowerCase()) || null;
    }

    // Fallback: If still not found, check if there's any table at all
    if (!table) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }
    res.json(table);
  } catch (error) {
    console.error('Error fetching public table:', error);
    res.status(500).json({ error: 'Failed to fetch table details' });
  }
});

// Get all tables
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tables = await prisma.table.findMany({
      orderBy: { tableNo: 'asc' }
    });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Create new table
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tableNo, name, capacity, status, qrUrl } = req.body;
    
    if (!tableNo) return res.status(400).json({ error: 'Table Number is required' });
    
    const table = await prisma.table.create({
      data: {
        tableNo,
        name,
        capacity: Number(capacity) || 2,
        status: status || 'Aktif',
        qrUrl,
        posX: req.body.posX !== undefined ? Number(req.body.posX) : 10,
        posY: req.body.posY !== undefined ? Number(req.body.posY) : 10,
        shape: req.body.shape || 'square'
      }
    });
    res.status(201).json(table);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// Batch update table layouts (positions)
router.put('/layout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { layouts } = req.body;
    if (!Array.isArray(layouts)) {
      return res.status(400).json({ error: 'Format layouts tidak valid' });
    }

    const updates = await prisma.$transaction(
      layouts.map((lay: any) => 
        prisma.table.update({
          where: { id: Number(lay.id) },
          data: {
            posX: lay.posX !== undefined ? Number(lay.posX) : undefined,
            posY: lay.posY !== undefined ? Number(lay.posY) : undefined
          }
        })
      )
    );

    res.json({ message: 'Tata letak meja berhasil diperbarui', count: updates.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui tata letak meja' });
  }
});

// Update table
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tableNo, name, capacity, status, qrUrl } = req.body;
    
    const table = await prisma.table.update({
      where: { id: Number(id) },
      data: {
        tableNo,
        name,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        status,
        qrUrl,
        posX: req.body.posX !== undefined ? Number(req.body.posX) : undefined,
        posY: req.body.posY !== undefined ? Number(req.body.posY) : undefined,
        shape: req.body.shape
      }
    });
    res.json(table);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// Delete table
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tableId = Number(id);
    
    // Optional check if table has active orders
    const allPendingOrders = await prisma.order.findMany({
      where: { status: 'Pending' },
      select: { id: true, tableId: true, joinedTableIds: true }
    });
    
    const hasActiveOrders = allPendingOrders.some(o => {
      if (o.tableId === tableId) return true;
      if (o.joinedTableIds) {
        try {
          const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids) && ids.includes(tableId)) return true;
        } catch (e) {}
      }
      return false;
    });
    
    if (hasActiveOrders) {
      return res.status(400).json({ error: 'Tidak dapat menghapus meja yang sedang memiliki pesanan aktif.' });
    }
    
    await prisma.table.delete({
      where: { id: tableId }
    });
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// Clear / Release Table (Kosongkan Meja Langsung)
router.post('/:id/clear', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tableId = Number(id);

    const candidateOrders = await prisma.order.findMany({
      where: {
        OR: [
          { status: 'Pending' },
          {
            status: 'Paid',
            kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }
          }
        ]
      }
    });

    const activeOrders = candidateOrders.filter(o => {
      if (o.tableId === tableId) return true;
      if (o.joinedTableIds) {
        try {
          const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids) && ids.includes(tableId)) return true;
        } catch (e) {}
      }
      return false;
    });

    if (activeOrders.length === 0) {
      return res.json({ message: 'Meja sudah dalam keadaan kosong' });
    }

    const now = new Date();
    await prisma.order.updateMany({
      where: {
        id: { in: activeOrders.map(o => o.id) }
      },
      data: {
        kdsStatus: 'Served',
        servedAt: now
      }
    });

    io.emit('order:paid', { tableId });
    io.emit('order:new', { tableId });
    io.emit('kds:statusChanged', { tableId, kdsStatus: 'Served' });

    res.json({ message: 'Meja berhasil dibersihkan & dikosongkan', clearedCount: activeOrders.length });
  } catch (error: any) {
    console.error('Clear table error:', error);
    res.status(500).json({ error: error.message || 'Gagal mengosongkan meja' });
  }
});

export default router;
