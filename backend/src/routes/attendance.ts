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

        const totalTerlambat = logs.filter(l => l.status === 'Terlambat' || (l.lateMinutes || 0) > 0).length;
        const totalHadir = logs.filter(l => (l.status === 'Hadir' || l.status === 'Tepat Waktu') && (l.lateMinutes || 0) === 0).length;
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

        // ─────────────────────────────────────────────────────────────
        // 2. KINERJA FINANSIAL KASIR (SHIFTS & ORDERS)
        // ─────────────────────────────────────────────────────────────
        const shiftWhere: any = { userId: u.id };
        if (dateFilter.gte) {
          shiftWhere.waktuBuka = dateFilter;
        }

        const orderWhere: any = { userId: u.id };
        if (dateFilter.gte) {
          orderWhere.createdAt = dateFilter;
        }

        const [userShifts, userOrders, userLossLogs] = await Promise.all([
          prisma.shift.findMany({
            where: shiftWhere,
            orderBy: { waktuBuka: 'desc' }
          }),
          prisma.order.findMany({
            where: orderWhere,
            select: { id: true, total: true, status: true, discount: true, createdAt: true }
          }),
          prisma.ingredientLog.findMany({
            where: {
              userId: u.id,
              type: 'Rusak',
              ...(dateFilter.gte ? { createdAt: dateFilter } : {})
            },
            include: { ingredient: true }
          })
        ]);

        // Rekap Shift Kasir
        const totalShifts = userShifts.length;
        const closedShifts = userShifts.filter((s: any) => s.status === 'Closed');
        const balancedShifts = closedShifts.filter((s: any) => (s.selisih === 0 || s.selisih === null)).length;
        const cashAccuracyRate = closedShifts.length > 0 ? Math.round((balancedShifts / closedShifts.length) * 100) : 100;
        
        let totalShortage = 0; // Uang minus (kasir tekor)
        let totalOverage = 0;  // Uang lebih
        userShifts.forEach((s: any) => {
          if (s.selisih !== null && s.selisih !== undefined) {
            if (s.selisih < 0) totalShortage += Math.abs(s.selisih);
            else if (s.selisih > 0) totalOverage += s.selisih;
          }
        });

        // Rekap Order & Omzet Kasir
        const completedOrders = userOrders.filter((o: any) => o.status === 'COMPLETED');
        const voidOrders = userOrders.filter((o: any) => o.status === 'CANCELLED' || o.status === 'VOID');
        const totalSalesHandled = completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
        const totalOrdersHandled = completedOrders.length;
        const voidCount = voidOrders.length;
        const voidAmount = voidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

        // ─────────────────────────────────────────────────────────────
        // 3. KINERJA STOCK LOSS & WASTE DAPUR
        // ─────────────────────────────────────────────────────────────
        const totalLossIncidents = userLossLogs.length;
        let totalLossCost = 0;
        let humanErrorLossCost = 0;
        let spoilageLossCost = 0;

        userLossLogs.forEach((m: any) => {
          const itemCost = m.cost || (Math.abs(m.change) * (m.ingredient?.buyPrice || 0));
          totalLossCost += itemCost;
          const r = (m.reason || '').toLowerCase();
          if (r.includes('gosong') || r.includes('salah') || r.includes('tumpah') || r.includes('rusak fisik') || r.includes('kelalaian')) {
            humanErrorLossCost += itemCost;
          } else {
            spoilageLossCost += itemCost;
          }
        });

        // ─────────────────────────────────────────────────────────────
        // 4. OVERALL SCORECARD & KPI GRADE (0 - 100)
        // ─────────────────────────────────────────────────────────────
        // Skor Disiplin Waktu (Bobot 40%)
        const attendanceBase = totalEntries > 0 ? (totalHadir / totalEntries) * 100 : 100;
        const lateDeduction = (totalTerlambat * 4) + Math.min(20, Math.floor(totalLateMinutes / 15));
        const attendanceScore = Math.max(0, Math.min(100, Math.round(attendanceBase - lateDeduction)));

        // Skor Akurasi Kasir (Bobot 30%)
        let cashierScore = 100;
        if (totalShifts > 0) {
          const shortageDeduction = Math.min(40, Math.floor(totalShortage / 20000) * 5);
          const voidDeduction = Math.min(20, voidCount * 5);
          cashierScore = Math.max(0, Math.min(100, Math.round(cashAccuracyRate - shortageDeduction - voidDeduction)));
        }

        // Skor Pengendalian Dapur (Bobot 30%)
        let kitchenScore = 100;
        if (totalLossIncidents > 0) {
          const incidentDeduction = totalLossIncidents * 5;
          const humanErrorDeduction = Math.min(40, Math.floor(humanErrorLossCost / 25000) * 5);
          kitchenScore = Math.max(0, Math.min(100, Math.round(100 - incidentDeduction - humanErrorDeduction)));
        }

        const kpiScore = Math.round((attendanceScore * 0.4) + (cashierScore * 0.3) + (kitchenScore * 0.3));
        let kpiGrade: 'A' | 'B' | 'C' | 'D' = 'B';
        let kpiLabel = 'Baik & Produktif';

        if (kpiScore >= 90) {
          kpiGrade = 'A';
          kpiLabel = 'Sangat Baik / Teladan';
        } else if (kpiScore >= 75) {
          kpiGrade = 'B';
          kpiLabel = 'Baik & Disiplin';
        } else if (kpiScore >= 60) {
          kpiGrade = 'C';
          kpiLabel = 'Cukup / Perlu Evaluasi';
        } else {
          kpiGrade = 'D';
          kpiLabel = 'Kurang / Butuh Pembinaan';
        }

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
          cashierStats: {
            totalShifts,
            closedShiftsCount: closedShifts.length,
            balancedShifts,
            cashAccuracyRate,
            totalShortage,
            totalOverage,
            totalSalesHandled,
            totalOrdersHandled,
            voidCount,
            voidAmount
          },
          kitchenStats: {
            totalLossIncidents,
            totalLossCost,
            humanErrorLossCost,
            spoilageLossCost
          },
          kpi: {
            score: kpiScore,
            grade: kpiGrade,
            label: kpiLabel,
            attendanceScore,
            cashierScore,
            kitchenScore
          },
          recentLogs: logs.slice(0, 10),
          recentShifts: userShifts.slice(0, 5),
          recentLossLogs: userLossLogs.slice(0, 5)
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

// ─── Leave & Permission Requests (Izin / Sakit / Cuti) ──────────────────

// POST Submit Leave Request
router.post('/leaves', async (req: Request, res: Response) => {
  try {
    const { userId, type, startDate, endDate, reason, photoUrl } = req.body;
    if (!userId || !type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Lengkapi seluruh data pengajuan izin/sakit' });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: Number(userId),
        type,
        startDate,
        endDate,
        reason,
        photoUrl: photoUrl || null,
        status: 'Pending',
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    res.status(201).json(leave);
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Gagal membuat pengajuan izin/sakit' });
  }
});

// GET Leave Requests (Filtered by user or all for admin)
router.get('/leaves', async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query;
    const whereClause: any = {};
    if (userId) whereClause.userId = Number(userId);
    if (status) whereClause.status = String(status);

    const leaves = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar pengajuan izin' });
  }
});

// PATCH Approve or Reject Leave Request (Admin only)
router.patch('/leaves/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, adminNotes } = req.body;

    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: Number(id) },
      data: {
        status,
        approvedBy: approvedBy || 'Admin',
        adminNotes: adminNotes || null,
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ error: 'Gagal memperbarui status pengajuan izin' });
  }
});

// ─── Shift Handover Logbook (Serah Terima Shift) ─────────────────────────

// POST Shift Handover
router.post('/handover', async (req: Request, res: Response) => {
  try {
    const { userId, shiftName, cashBalance, equipmentStatus, notes } = req.body;
    if (!userId || !shiftName || !notes) {
      return res.status(400).json({ error: 'Data serah terima shift tidak lengkap' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const handover = await prisma.shiftHandover.create({
      data: {
        userId: Number(userId),
        shiftName,
        date: todayStr,
        cashBalance: Number(cashBalance) || 0,
        equipmentStatus: equipmentStatus || 'Normal',
        notes,
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    res.status(201).json(handover);
  } catch (error) {
    console.error('Error creating shift handover:', error);
    res.status(500).json({ error: 'Gagal menyimpan catatan handover shift' });
  }
});

// GET Shift Handover Logs
router.get('/handover', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const handovers = await prisma.shiftHandover.findMany({
      take: Number(limit),
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(handovers);
  } catch (error) {
    console.error('Error fetching handover logs:', error);
    res.status(500).json({ error: 'Gagal mengambil catatan handover' });
  }
});

// ─── Kitchen SOP Checklist (Opening & Closing) ──────────────────────────

// POST Kitchen Checklist
router.post('/checklist', async (req: Request, res: Response) => {
  try {
    const { userId, type, shiftName, items, notes } = req.body;
    if (!userId || !type || !items) {
      return res.status(400).json({ error: 'Lengkapi data checklist SOP' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const checklist = await prisma.kitchenChecklist.create({
      data: {
        userId: Number(userId),
        type, // OPENING or CLOSING
        date: todayStr,
        shiftName: shiftName || null,
        itemsJson: typeof items === 'string' ? items : JSON.stringify(items),
        notes: notes || null,
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    res.status(201).json(checklist);
  } catch (error) {
    console.error('Error saving kitchen checklist:', error);
    res.status(500).json({ error: 'Gagal menyimpan checklist SOP' });
  }
});

// GET Today's Kitchen Checklists
router.get('/checklist/today', async (req: Request, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const checklists = await prisma.kitchenChecklist.findMany({
      where: { date: todayStr },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(checklists);
  } catch (error) {
    console.error('Error fetching checklists:', error);
    res.status(500).json({ error: 'Gagal mengambil data checklist' });
  }
});

// ─── Koreksi Presensi Staf & Auto-Cutoff EOD ──────────────────────────

export async function runAttendanceAutoCutoff(): Promise<{ count: number }> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const unclosed = await prisma.attendance.findMany({
      where: {
        clockOut: null,
        date: { lt: todayStr }
      }
    });

    if (unclosed.length === 0) return { count: 0 };

    for (const att of unclosed) {
      const clockInDate = new Date(att.clockIn);
      const autoClockOut = new Date(clockInDate);
      autoClockOut.setHours(22, 0, 0, 0);

      if (autoClockOut <= clockInDate) {
        autoClockOut.setTime(clockInDate.getTime() + (8 * 60 * 60 * 1000));
      }

      const autoNote = att.notes 
        ? `${att.notes} [Auto Clock-Out: Lupa Absen Pulang]`
        : '[Auto Clock-Out: Lupa Absen Pulang]';

      await prisma.attendance.update({
        where: { id: att.id },
        data: {
          clockOut: autoClockOut,
          notes: autoNote
        }
      });
    }

    console.log(`[Auto-EOD Cutoff] Berhasil menutup ${unclosed.length} presensi staf yang lupa Clock Out.`);
    return { count: unclosed.length };
  } catch (error) {
    console.error('Error running attendance auto cutoff:', error);
    return { count: 0 };
  }
}

// PUT Adjust / Koreksi Presensi Staf (Admin / Owner only)
router.put('/:id/adjust', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { clockIn, clockOut, status, notes, lateMinutes } = req.body;
    const userRole = ((req as any).user?.role || '').toLowerCase();

    if (!['admin', 'owner', 'superadmin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ error: 'Hanya Admin/Owner yang berwenang melakukan koreksi presensi.' });
    }

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Data absensi tidak ditemukan' });
    }

    const updateData: any = {};
    if (clockIn) updateData.clockIn = new Date(clockIn);
    if (clockOut !== undefined) {
      updateData.clockOut = clockOut ? new Date(clockOut) : null;
    }
    if (status) updateData.status = status;
    if (lateMinutes !== undefined) updateData.lateMinutes = Number(lateMinutes);
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, username: true, role: true } }
      }
    });

    res.json({ message: 'Presensi staf berhasil dikoreksi', attendance: updated });
  } catch (error) {
    console.error('Error adjusting attendance:', error);
    res.status(500).json({ error: 'Gagal mengoreksi presensi staf' });
  }
});

// POST Manual Trigger Auto Cutoff Presensi
router.post('/auto-cutoff', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await runAttendanceAutoCutoff();
    res.json({ message: `Auto Cut-off selesai. ${result.count} presensi tertutup otomatis.`, result });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menjalankan auto-cutoff presensi' });
  }
});

export default router;

