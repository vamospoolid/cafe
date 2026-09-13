import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Haversine Distance Formula (Meter)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

const DEFAULT_SHIFTS = [
  { id: 'pagi', name: 'Shift Pagi (08:00 - 16:00)', start: '08:00', end: '16:00', lateTolerance: 15 },
  { id: 'siang', name: 'Shift Siang / Sore (14:00 - 22:00)', start: '14:00', end: '22:00', lateTolerance: 15 },
  { id: 'full', name: 'Shift Full / Normal (09:00 - 18:00)', start: '09:00', end: '18:00', lateTolerance: 15 }
];

// GET Active Shifts
router.get('/shifts', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    let shifts = DEFAULT_SHIFTS;
    if (settings?.workShifts) {
      try {
        const parsed = JSON.parse(settings.workShifts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          shifts = parsed;
        }
      } catch (e) {
        console.error('Failed to parse workShifts JSON:', e);
      }
    }
    res.json(shifts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil daftar shift kerja' });
  }
});

// POST Clock In / Out
router.post('/clock', async (req: Request, res: Response) => {
  try {
    const { 
      pin, 
      type, 
      shiftId, 
      shiftName, 
      latitude, 
      longitude, 
      photo, 
      notes 
    } = req.body;
    
    if (!pin) return res.status(400).json({ error: 'PIN absensi dibutuhkan' });
    if (!['IN', 'OUT'].includes(type)) return res.status(400).json({ error: 'Tipe absensi tidak valid' });

    const user = await prisma.user.findFirst({
      where: { pin, status: 'Aktif' }
    });

    if (!user) return res.status(401).json({ error: 'PIN salah atau akun karyawan tidak aktif' });

    // Ambil konfigurasi toko
    const settings = await prisma.settings.findFirst();
    const storeLat = settings?.storeLatitude ?? -6.200000;
    const storeLon = settings?.storeLongitude ?? 106.816666;
    const maxRadius = settings?.gpsRadiusMeters ?? 100;
    const enableGps = settings?.enableGpsValidation ?? true;
    const enableCamera = settings?.enableCameraPhoto ?? true;

    // Validasi Kamera
    if (enableCamera && !photo && type === 'IN') {
      return res.status(400).json({ error: 'Wajib menyertakan foto selfie bukti kehadiran' });
    }

    // Validasi GPS
    let distanceIn: number | null = null;
    let isWithinRadius = true;
    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      distanceIn = calculateDistanceMeters(Number(latitude), Number(longitude), storeLat, storeLon);
      isWithinRadius = distanceIn <= maxRadius;

      if (enableGps && !isWithinRadius) {
        return res.status(400).json({ 
          error: `Anda berada di luar radius toko (${distanceIn} meter dari lokasi toko, batas toleransi: ${maxRadius} meter).`,
          distance: distanceIn,
          maxRadius
        });
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingLog = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        clockIn: { gte: todayStart }
      },
      orderBy: { clockIn: 'desc' }
    });

    if (type === 'IN') {
      if (existingLog && !existingLog.clockOut) {
        return res.status(400).json({ error: `Anda sudah Clock In hari ini (${user.name}) pada ${new Date(existingLog.clockIn).toLocaleTimeString('id-ID')}` });
      }

      // Hitung Keterlambatan berdasarkan Shift yang dipilih
      let shifts = DEFAULT_SHIFTS;
      if (settings?.workShifts) {
        try {
          const parsed = JSON.parse(settings.workShifts);
          if (Array.isArray(parsed) && parsed.length > 0) shifts = parsed;
        } catch {}
      }

      let selectedShift = shifts.find(s => s.id === shiftId || s.name === shiftName) || shifts[0];
      const actualShiftName = shiftName || selectedShift?.name || 'Shift Pagi (08:00 - 16:00)';

      let status = 'Hadir';
      let lateMinutes = 0;

      if (selectedShift?.start) {
        const [shiftStartHour, shiftStartMin] = selectedShift.start.split(':').map(Number);
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const shiftStartTotalMinutes = shiftStartHour * 60 + (shiftStartMin || 0);
        const tolerance = selectedShift.lateTolerance || 15;

        if (nowMinutes > (shiftStartTotalMinutes + tolerance)) {
          lateMinutes = nowMinutes - shiftStartTotalMinutes;
          status = 'Terlambat';
        }
      }

      if (distanceIn !== null && !isWithinRadius) {
        status = 'Di Luar Radius';
      }

      const attendance = await prisma.attendance.create({
        data: {
          userId: user.id,
          date: new Date().toISOString().slice(0, 10),
          clockIn: new Date(),
          shiftName: actualShiftName,
          photoIn: photo || null,
          latitudeIn: latitude ? Number(latitude) : null,
          longitudeIn: longitude ? Number(longitude) : null,
          distanceIn: distanceIn,
          isWithinRadius: isWithinRadius,
          status: status,
          lateMinutes: lateMinutes,
          notes: notes || null
        }
      });

      return res.json({ 
        message: `Clock In Berhasil: ${user.name} (${status})`, 
        attendance,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role
        }
      });
    } else {
      // Clock OUT
      if (!existingLog) {
        return res.status(400).json({ error: 'Anda belum melakukan Clock In hari ini' });
      }
      if (existingLog.clockOut) {
        return res.status(400).json({ error: `Anda sudah Clock Out hari ini (${user.name}) pada ${new Date(existingLog.clockOut).toLocaleTimeString('id-ID')}` });
      }

      const attendance = await prisma.attendance.update({
        where: { id: existingLog.id },
        data: { 
          clockOut: new Date(),
          photoOut: photo || null,
          latitudeOut: latitude ? Number(latitude) : null,
          longitudeOut: longitude ? Number(longitude) : null
        }
      });

      return res.json({ 
        message: `Clock Out Berhasil: ${user.name}`, 
        attendance,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role
        }
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memproses absensi' });
  }
});

// GET Attendances (List View with filter)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date, userId, status } = req.query;
    
    const whereClause: any = {};
    if (date) {
      const dStart = new Date(date as string);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(date as string);
      dEnd.setHours(23, 59, 59, 999);
      whereClause.clockIn = { gte: dStart, lte: dEnd };
    }

    if (userId) {
      whereClause.userId = Number(userId);
    }

    if (status) {
      whereClause.status = status as string;
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: { 
        user: { 
          select: { 
            id: true, 
            name: true, 
            username: true, 
            role: true
          } 
        } 
      },
      orderBy: { clockIn: 'desc' }
    });

    res.json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data absensi' });
  }
});

// GET Individual Summary / Rekapitulasi per Karyawan
router.get('/summary-individual', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { month } = req.query; // YYYY-MM (e.g. 2026-09) or empty for all

    const settings = await prisma.settings.findFirst();
    const enableZeroLateBonus = settings?.enableZeroLateBonus ?? true;
    const zeroLateBonusAmount = settings?.zeroLateBonusAmount ?? 200000;
    const zeroLateMinAttendance = settings?.zeroLateMinAttendance ?? 20;
    const zeroLateMaxLateAllowed = settings?.zeroLateMaxLateAllowed ?? 0;
    const enableLatePenalty = settings?.enableLatePenalty ?? false;
    const latePenaltyType = settings?.latePenaltyType ?? 'FLAT';
    const latePenaltyAmount = settings?.latePenaltyAmount ?? 10000;
    const enableAlphaPenalty = settings?.enableAlphaPenalty ?? false;
    const alphaPenaltyAmount = settings?.alphaPenaltyAmount ?? 50000;

    const users = await prisma.user.findMany({
      where: { status: 'Aktif' },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    let dateFilter: any = {};
    if (month && typeof month === 'string' && month.includes('-')) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr);
      const m = parseInt(monthStr) - 1;
      const startOfMonth = new Date(year, m, 1);
      const endOfMonth = new Date(year, m + 1, 0, 23, 59, 59, 999);
      dateFilter = { gte: startOfMonth, lte: endOfMonth };
    }

    const summaries = await Promise.all(
      users.map(async (u) => {
        const whereClause: any = { userId: u.id };
        if (dateFilter.gte) {
          whereClause.clockIn = dateFilter;
        }

        const logs = await prisma.attendance.findMany({
          where: whereClause,
          orderBy: { clockIn: 'desc' }
        });

        const totalHadir = logs.filter(l => l.status === 'Hadir').length;
        const totalTerlambat = logs.filter(l => l.status === 'Terlambat').length;
        const totalLuarRadius = logs.filter(l => l.status === 'Di Luar Radius').length;
        const totalEntries = logs.length;
        const totalLateMinutes = logs.reduce((sum, l) => sum + (l.lateMinutes || 0), 0);

        // Hitung total jam kerja
        let totalWorkHours = 0;
        logs.forEach(l => {
          if (l.clockIn && l.clockOut) {
            const diffMs = new Date(l.clockOut).getTime() - new Date(l.clockIn).getTime();
            if (diffMs > 0) {
              totalWorkHours += diffMs / (1000 * 60 * 60);
            }
          }
        });

        // Hitung Reward Zero Late
        const isEligibleZeroLate = enableZeroLateBonus && totalTerlambat <= zeroLateMaxLateAllowed && totalEntries >= zeroLateMinAttendance;
        const isOnTrackZeroLate = enableZeroLateBonus && totalTerlambat <= zeroLateMaxLateAllowed;
        const zeroLateBonusEarned = isEligibleZeroLate ? zeroLateBonusAmount : 0;

        let zeroLateStatus = 'DISABLED';
        if (enableZeroLateBonus) {
          if (totalTerlambat > zeroLateMaxLateAllowed) {
            zeroLateStatus = 'HANGUS';
          } else if (totalEntries >= zeroLateMinAttendance) {
            zeroLateStatus = 'ELIGIBLE';
          } else {
            zeroLateStatus = 'ON_TRACK';
          }
        }

        // Hitung Denda Keterlambatan
        let totalLatePenalty = 0;
        if (enableLatePenalty) {
          if (latePenaltyType === 'PER_MINUTE') {
            totalLatePenalty = totalLateMinutes * latePenaltyAmount;
          } else {
            totalLatePenalty = totalTerlambat * latePenaltyAmount;
          }
        }

        const netDisciplineAmount = zeroLateBonusEarned - totalLatePenalty;

        return {
          user: u,
          stats: {
            totalEntries,
            totalHadir,
            totalTerlambat,
            totalLuarRadius,
            totalLateMinutes,
            totalWorkHours: parseFloat(totalWorkHours.toFixed(1))
          },
          discipline: {
            enableZeroLateBonus,
            zeroLateStatus, // 'ELIGIBLE' | 'ON_TRACK' | 'HANGUS' | 'DISABLED'
            isEligibleZeroLate,
            isOnTrackZeroLate,
            zeroLateBonusEarned,
            zeroLateBonusAmount,
            zeroLateMinAttendance,
            enableLatePenalty,
            latePenaltyType,
            latePenaltyAmount,
            totalLatePenalty,
            netDisciplineAmount
          },
          recentLogs: logs.slice(0, 10)
        };
      })
    );

    res.json(summaries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menghasilkan rekapitulasi individu karyawan' });
  }
});

// GET My Summary (untuk portal PWA Staf)
router.get('/my-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, role: true }
    });

    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    const settings = await prisma.settings.findFirst();
    const enableZeroLateBonus = settings?.enableZeroLateBonus ?? true;
    const zeroLateBonusAmount = settings?.zeroLateBonusAmount ?? 200000;
    const zeroLateMinAttendance = settings?.zeroLateMinAttendance ?? 20;
    const zeroLateMaxLateAllowed = settings?.zeroLateMaxLateAllowed ?? 0;
    const enableLatePenalty = settings?.enableLatePenalty ?? false;
    const latePenaltyType = settings?.latePenaltyType ?? 'FLAT';
    const latePenaltyAmount = settings?.latePenaltyAmount ?? 10000;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const logs = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        clockIn: { gte: startOfMonth }
      },
      orderBy: { clockIn: 'desc' }
    });

    const totalHadir = logs.filter(l => l.status === 'Hadir').length;
    const totalTerlambat = logs.filter(l => l.status === 'Terlambat').length;
    const totalLateMinutes = logs.reduce((sum, l) => sum + (l.lateMinutes || 0), 0);

    let totalWorkHours = 0;
    logs.forEach(l => {
      if (l.clockIn && l.clockOut) {
        const diffMs = new Date(l.clockOut).getTime() - new Date(l.clockIn).getTime();
        if (diffMs > 0) {
          totalWorkHours += diffMs / (1000 * 60 * 60);
        }
      }
    });

    // Cek status hari ini
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayLog = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        clockIn: { gte: todayStart }
      },
      orderBy: { clockIn: 'desc' }
    });

    // Reward & Punishment calculation for current staff
    const isEligibleZeroLate = enableZeroLateBonus && totalTerlambat <= zeroLateMaxLateAllowed && logs.length >= zeroLateMinAttendance;
    const isOnTrackZeroLate = enableZeroLateBonus && totalTerlambat <= zeroLateMaxLateAllowed;
    const zeroLateBonusEarned = isEligibleZeroLate ? zeroLateBonusAmount : 0;

    let zeroLateStatus = 'DISABLED';
    if (enableZeroLateBonus) {
      if (totalTerlambat > zeroLateMaxLateAllowed) {
        zeroLateStatus = 'HANGUS';
      } else if (logs.length >= zeroLateMinAttendance) {
        zeroLateStatus = 'ELIGIBLE';
      } else {
        zeroLateStatus = 'ON_TRACK';
      }
    }

    let totalLatePenalty = 0;
    if (enableLatePenalty) {
      if (latePenaltyType === 'PER_MINUTE') {
        totalLatePenalty = totalLateMinutes * latePenaltyAmount;
      } else {
        totalLatePenalty = totalTerlambat * latePenaltyAmount;
      }
    }

    const netDisciplineAmount = (isOnTrackZeroLate ? zeroLateBonusAmount : 0) - totalLatePenalty;

    res.json({
      user,
      todayStatus: {
        clockedIn: !!todayLog,
        clockedOut: !!todayLog?.clockOut,
        todayLog
      },
      stats: {
        totalEntries: logs.length,
        totalHadir,
        totalTerlambat,
        totalLateMinutes,
        totalWorkHours: parseFloat(totalWorkHours.toFixed(1))
      },
      discipline: {
        enableZeroLateBonus,
        zeroLateStatus,
        isEligibleZeroLate,
        isOnTrackZeroLate,
        zeroLateBonusEarned,
        zeroLateBonusAmount,
        zeroLateMinAttendance,
        enableLatePenalty,
        latePenaltyType,
        latePenaltyAmount,
        totalLatePenalty,
        netDisciplineAmount
      },
      history: logs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil rekap kehadiran pribadi' });
  }
});

export default router;
