import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate } = req.query;
    
    const whereClause: any = {};
    if (type) whereClause.type = type;
    
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    }

    const cashflows = await prisma.cashFlow.findMany({
      where: whereClause,
      include: { user: { select: { name: true } } },
      orderBy: { date: 'desc' }
    });

    res.json(cashflows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil arus kas' });
  }
});

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, category, amount, description } = req.body;
    const userId = (req as any).user.id;

    if (!type || !category || !amount || !description) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const cashflow = await prisma.cashFlow.create({
      data: {
        type,
        category,
        amount: Number(amount),
        description,
        userId
      }
    });

    res.status(201).json(cashflow);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menyimpan arus kas' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.cashFlow.delete({ where: { id: Number(id) } });
    res.json({ message: 'Arus kas berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menghapus arus kas' });
  }
});

export default router;
