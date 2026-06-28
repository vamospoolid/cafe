import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// POST Clock In / Out
router.post('/clock', async (req: Request, res: Response) => {
  try {
    const { pin, type } = req.body;
    
    if (!pin) return res.status(400).json({ error: 'PIN dibutuhkan' });
    if (!['IN', 'OUT'].includes(type)) return res.status(400).json({ error: 'Tipe absensi tidak valid' });

    const user = await prisma.user.findFirst({
      where: { pin, status: 'Aktif' }
    });

    if (!user) return res.status(401).json({ error: 'PIN salah atau pengguna tidak aktif' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingLog = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        clockIn: { gte: todayStart }
      }
    });

    if (type === 'IN') {
      if (existingLog && existingLog.clockIn) {
        return res.status(400).json({ error: `Anda sudah Clock In hari ini (${user.name})` });
      }
      const attendance = await prisma.attendance.create({
        data: {
          userId: user.id,
          date: new Date().toISOString().slice(0, 10),
          clockIn: new Date()
        }
      });
      return res.json({ message: `Clock In Berhasil: ${user.name}`, attendance });
    } else {
      if (!existingLog) {
        return res.status(400).json({ error: 'Anda belum Clock In hari ini' });
      }
      if (existingLog.clockOut) {
        return res.status(400).json({ error: `Anda sudah Clock Out hari ini (${user.name})` });
      }
      const attendance = await prisma.attendance.update({
        where: { id: existingLog.id },
        data: { clockOut: new Date() }
      });
      return res.json({ message: `Clock Out Berhasil: ${user.name}`, attendance });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memproses absensi' });
  }
});

// GET Attendances
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    
    const whereClause: any = {};
    if (date) {
      const dStart = new Date(date as string);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(date as string);
      dEnd.setHours(23, 59, 59, 999);
      whereClause.clockIn = { gte: dStart, lte: dEnd };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { clockIn: 'desc' }
    });

    res.json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data absensi' });
  }
});

export default router;
