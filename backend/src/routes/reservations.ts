import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date, status } = req.query;
    
    const whereClause: any = {};
    if (date) whereClause.date = date; // date is stored as string YYYY-MM-DD
    if (status) whereClause.status = status;

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: { table: true },
      orderBy: [ { date: 'asc' }, { time: 'asc' } ]
    });

    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data reservasi' });
  }
});

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { customerName, phone, date, time, tableId, guests, dpAmount, notes } = req.body;
    const userId = (req as any).user.id;

    // Fix #5a: Validasi anti-double booking – cek konflik meja pada tanggal & jam yang sama
    if (tableId && date && time) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          tableId: Number(tableId),
          date: date,
          time: time,
          status: { not: 'Lunas' } // Reservasi yang sudah selesai tidak dihitung konflik
        }
      });
      if (conflict) {
        return res.status(409).json({
          error: `Meja sudah dipesan oleh ${conflict.customerName} pada tanggal dan jam yang sama. Silakan pilih meja atau waktu yang berbeda.`
        });
      }
    }

    const dp = Number(dpAmount) || 0;

    const reservation = await prisma.$transaction(async (tx) => {
      // Buat reservasi
      const newReservation = await tx.reservation.create({
        data: {
          customerName,
          phone,
          date,
          time,
          tableId: Number(tableId),
          guests: Number(guests),
          dpAmount: dp,
          status: dp > 0 ? 'DP Dibayar' : 'Booking',
          notes
        },
        include: { table: true }
      });

      // Fix #5b: Catat DP ke CashFlow agar kas terlacak di laporan keuangan
      if (dp > 0) {
        await tx.cashFlow.create({
          data: {
            type: 'Pemasukan',
            category: 'Uang Muka Reservasi',
            amount: dp,
            description: `DP Reservasi: ${customerName} – Meja ${newReservation.table?.tableNo || tableId} (${date} ${time})`,
            userId
          }
        });
      }

      return newReservation;
    });

    res.status(201).json(reservation);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Gagal membuat reservasi' });
  }
});

router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerName, phone, date, time, tableId, guests, dpAmount, status, notes } = req.body;

    const reservation = await prisma.reservation.update({
      where: { id: Number(id) },
      data: {
        customerName,
        phone,
        date,
        time,
        tableId: tableId ? Number(tableId) : undefined,
        guests: guests ? Number(guests) : undefined,
        dpAmount: dpAmount !== undefined ? Number(dpAmount) : undefined,
        status,
        notes
      }
    });

    res.json(reservation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal update reservasi' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.reservation.delete({ where: { id: Number(id) } });
    res.json({ message: 'Reservasi dibatalkan' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membatalkan reservasi' });
  }
});

export default router;
