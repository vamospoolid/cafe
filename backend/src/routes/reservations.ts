import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

function getTenantId(req: Request): string | undefined {
  const user = (req as AuthRequest).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
}

function tenantWhere(tenantId: string | undefined): { tenantId: string } {
  if (!tenantId) throw new Error('MISSING_TENANT_ID: Reservation query requires tenant context');
  return { tenantId };
}

// Router-level fail-closed guard: all reservation operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context tidak tersedia. Silakan login ulang.', 
      code: 'MISSING_TENANT_CONTEXT' 
    });
  }
  next();
});

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { date, status } = req.query;
    
    const whereClause: any = {
      ...tenantWhere(tenantId)
    };
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
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
    const outletId = user?.outletId;
    const { customerName, phone, date, time, tableId, guests, dpAmount, paymentMethod, notes } = req.body;
    const userId = user?.id || 1;

    // Validasi kepemilikan meja pada tenant
    if (tableId) {
      const tableCheck = await prisma.table.findFirst({
        where: { id: Number(tableId), ...tenantWhere(tenantId) }
      });
      if (!tableCheck) {
        return res.status(400).json({ error: 'Meja tidak ditemukan pada outlet Anda.' });
      }
    }

    // Fix #5a: Validasi anti-double booking – cek konflik meja pada tanggal & jam yang sama dalam tenant yang sama
    if (tableId && date && time) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          tableId: Number(tableId),
          date: date,
          time: time,
          status: { not: 'Lunas' }, // Reservasi yang sudah selesai tidak dihitung konflik
          ...tenantWhere(tenantId)
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
          tenantId,
          outletId,
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

      // Catat DP ke CashFlow agar kas terlacak di laporan keuangan & segregasi Tunai vs Non-Tunai
      if (dp > 0) {
        const pm = (paymentMethod || 'Transfer').toLowerCase();
        const isCash = pm === 'cash' || pm === 'tunai';
        const dpCategory = isCash ? 'Uang Muka Reservasi - Tunai' : 'Uang Muka Reservasi - Non-Tunai';

        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId,
            type: 'Pemasukan',
            category: dpCategory,
            amount: dp,
            description: `DP Reservasi (${isCash ? 'Tunai' : 'Non-Tunai'}): ${customerName} – Meja ${newReservation.table?.tableNo || tableId} (${date} ${time})`,
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
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { customerName, phone, date, time, tableId, guests, dpAmount, status, notes } = req.body;

    const existing = await prisma.reservation.findFirst({
      where: { id: Number(id), ...tenantWhere(tenantId) }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Data reservasi tidak ditemukan' });
    }

    if (tableId) {
      const tableCheck = await prisma.table.findFirst({
        where: { id: Number(tableId), ...tenantWhere(tenantId) }
      });
      if (!tableCheck) {
        return res.status(400).json({ error: 'Meja tidak ditemukan pada outlet Anda.' });
      }
    }

    // Anti-IDOR: gunakan updateMany dengan { id, tenantId } bukan update dengan { id } saja
    const updateResult = await prisma.reservation.updateMany({
      where: { id: Number(id), ...(tenantId ? { tenantId } : { tenantId: 'BLOCKED' }) },
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

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Data reservasi tidak ditemukan atau akses ditolak.' });
    }

    const reservation = await prisma.reservation.findFirst({ where: { id: Number(id) } });

    res.json(reservation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal update reservasi' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const existing = await prisma.reservation.findFirst({
      where: { id: Number(id), ...tenantWhere(tenantId) }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Data reservasi tidak ditemukan' });
    }

    // Anti-IDOR: gunakan deleteMany dengan { id, tenantId } bukan delete dengan { id } saja
    const deleteResult = await prisma.reservation.deleteMany({
      where: { id: Number(id), ...(tenantId ? { tenantId } : { tenantId: 'BLOCKED' }) }
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Data reservasi tidak ditemukan atau akses ditolak.' });
    }
    res.json({ message: 'Reservasi dibatalkan' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membatalkan reservasi' });
  }
});

export default router;
