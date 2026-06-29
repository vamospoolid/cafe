import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Get table detail (Public - for Dine-In customers to verify table number)
router.get('/public/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const table = await prisma.table.findUnique({
      where: { id: Number(id) }
    });
    if (!table) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }
    res.json(table);
  } catch (error) {
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
    
    // Optional check if table has active orders
    const activeOrders = await prisma.order.count({
      where: { 
        tableId: Number(id),
        status: 'Pending'
      }
    });
    
    if (activeOrders > 0) {
      return res.status(400).json({ error: 'Cannot delete table with active orders.' });
    }
    
    await prisma.table.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

export default router;
