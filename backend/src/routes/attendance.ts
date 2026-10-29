import prisma from '../db';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

// Helper untuk multi-tenant scoping
function getTenantId(req: Request): string | undefined {
  const user = (req as AuthRequest).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || (req.body?.tenantId as string);
}

function tenantWhere(tenantId: string | undefined): { tenantId: string } {
  if (!tenantId) throw new Error('MISSING_TENANT_ID: Attendance query requires tenant context');
  return { tenantId };
}

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

export const DEFAULT_GPS_RADIUS_METERS = 200;

const DEFAULT_SHIFTS = [
  { id: 'pagi', name: 'Shift Pagi (08:00 - 16:00)', start: '08:00', end: '16:00', lateTolerance: 15 },
  { id: 'siang', name: 'Shift Siang / Sore (14:00 - 22:00)', start: '14:00', end: '22:00', lateTolerance: 15 },
  { id: 'full', name: 'Shift Full / Normal (09:00 - 18:00)', start: '09:00', end: '18:00', lateTolerance: 15 }
];

// GET Active Shifts (Scoped to tenant settings)
router.get('/shifts', async (req: Request, res: Response) => {
  try {
    let tenantId = getTenantId(req);
    if (!tenantId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        let decoded: any;
        try {
          decoded = jwt.verify(token, JWT_SECRET);
        } catch {
          decoded = jwt.decode(token);
        }
        if (decoded?.tenantId) {
          tenantId = decoded.tenantId;
        }
      } catch (e) {}
    }
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required', code: 'MISSING_TENANT_CONTEXT' });
    const settings = await prisma.settings.findFirst({
      where: tenantWhere(tenantId)
    });
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
  let user: any = null;
  try {
    const { 
      pin, 
      type, 
      shiftId, 
      shiftName, 
      latitude, 
      longitude, 
      photo, 
      notes,
      tenantId: bodyTenantId,
      outletId: bodyOutletId,
      userId: bodyUserId,
      channel
    } = req.body;
    
    if (!['IN', 'OUT'].includes(type)) return res.status(400).json({ error: 'Tipe absensi tidak valid' });

    let requestedTenantId = bodyTenantId || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);

    // 1. Ekstraksi kredensial dari JWT Authorization header jika ada (Staff PWA Personal)
    let authUser: any = null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        try {
          authUser = jwt.verify(token, JWT_SECRET);
        } catch {
          authUser = null; // Tolak token jika verify gagal - jangan bypass via decode
        }
        if (authUser?.tenantId && !requestedTenantId) {
          requestedTenantId = authUser.tenantId;
        }
      } catch (e) {}
    }

    // 2. Fallback tenant jika belum ditentukan (misal Terminal PIN tanpa login)
    if (!requestedTenantId && pin) {
      const candidates = await prisma.user.findMany({
        where: {
          status: 'Aktif',
          OR: [
            { pin, memberships: { some: { status: 'ACTIVE' } } },
            { memberships: { some: { pin, status: 'ACTIVE' } } }
          ]
        },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            take: 2
          }
        }
      });
      if (candidates.length === 1 && candidates[0].memberships.length === 1) {
        requestedTenantId = candidates[0].memberships[0].tenantId;
      }
    }

    // Fallback standalone jika tenant context belum ada di header / token
    if (!requestedTenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      if (defaultTenant) {
        requestedTenantId = defaultTenant.id;
      }
    }

    // 3. Resolusi identitas staf secara independen:
    // Prioritas 1: Sesi Terautentikasi (Personal Staff PWA di smartphone)
    // Menggunakan userId dari token JWT staf yang login. Nol keterikatan dengan Owner Muki / PIN tabrakan.
    const targetUserId = bodyUserId ? Number(bodyUserId) : (authUser?.id ? Number(authUser.id) : null);

    if (targetUserId) {
      user = await prisma.user.findFirst({
        where: {
          id: targetUserId,
          status: 'Aktif',
          OR: [
            { tenantId: requestedTenantId },
            { memberships: { some: { tenantId: requestedTenantId, status: 'ACTIVE' } } }
          ]
        },
        include: {
          memberships: {
            where: { tenantId: requestedTenantId, status: 'ACTIVE' },
            take: 1
          }
        }
      });
    }

    // Prioritas 2: Terminal Kasir Bersama (Numpad PIN)
    // Jika tidak ada sesi JWT staf (misal di tablet kasir POS), gunakan pencarian PIN unik
    if (!user) {
      if (!pin) {
        return res.status(400).json({ error: 'PIN absensi dibutuhkan' });
      }

      const matchingUsers = await prisma.user.findMany({
        where: {
          status: 'Aktif',
          OR: [
            {
              pin,
              OR: [
                { tenantId: requestedTenantId },
                { memberships: { some: { tenantId: requestedTenantId, status: 'ACTIVE' } } }
              ]
            },
            {
              memberships: {
                some: { tenantId: requestedTenantId, pin, status: 'ACTIVE' }
              }
            }
          ]
        },
        include: {
          memberships: {
            where: { tenantId: requestedTenantId, status: 'ACTIVE' },
            take: 2
          }
        }
      });

      if (matchingUsers.length === 0) {
        return res.status(401).json({ error: 'PIN salah atau akun tidak terdaftar di outlet ini' });
      }

      if (matchingUsers.length > 1) {
        return res.status(409).json({
          error: `PIN ${pin} digunakan oleh lebih dari 1 karyawan (${matchingUsers.map(u => u.name).join(', ')}). Harap login via Portal Staf di HP atau atur PIN unik di menu Kelola Karyawan.`,
          code: 'AMBIGUOUS_PIN'
        });
      }

      user = matchingUsers[0];
    }

    if (!user) {
      return res.status(401).json({ error: 'Identitas staf tidak ditemukan atau akun tidak terdaftar di outlet ini' });
    }

    // resolvedTenantId = requestedTenantId (sudah divalidasi via membership di atas)
    const resolvedTenantId = requestedTenantId;

    // Ambil konfigurasi toko milik tenant karyawan
    const settings = await prisma.settings.findFirst({
      where: tenantWhere(resolvedTenantId)
    });
    const hasStoreCoords = (settings?.storeLatitude !== null && settings?.storeLatitude !== undefined) &&
                           (settings?.storeLongitude !== null && settings?.storeLongitude !== undefined);
    let storeLat: number | null = hasStoreCoords ? Number(settings.storeLatitude) : null;
    let storeLon: number | null = hasStoreCoords ? Number(settings.storeLongitude) : null;
    let maxRadius = settings?.gpsRadiusMeters ?? DEFAULT_GPS_RADIUS_METERS;
    let enableGps = hasStoreCoords ? (settings?.enableGpsValidation ?? true) : false;
    const enableCamera = settings?.enableCameraPhoto ?? true;

    // Jika ada spesifikasi outlet spesifik, prioritaskan koordinat GPS & radius geofencing outlet tersebut
    const targetOutletId = bodyOutletId;
    if (targetOutletId) {
      const outlet = await prisma.outlet.findFirst({
        where: { id: targetOutletId, tenantId: resolvedTenantId }
      });
      if (outlet && outlet.latitude !== null && outlet.longitude !== null && !isNaN(outlet.latitude) && !isNaN(outlet.longitude)) {
        storeLat = outlet.latitude;
        storeLon = outlet.longitude;
        enableGps = settings?.enableGpsValidation ?? true;
        if (outlet.gpsRadiusMeters && outlet.gpsRadiusMeters > 0) {
          maxRadius = outlet.gpsRadiusMeters;
        }
      }
    }

    // Validasi Kamera: Bypass untuk Terminal Kasir fisik (channel POS_TERMINAL atau input PIN di mesin kasir terdaftar)
    const isPosTerminal = channel === 'POS_TERMINAL' || (!photo && pin && !bodyUserId);
    if (enableCamera && !photo && type === 'IN' && !isPosTerminal) {
      return res.status(400).json({ error: 'Wajib menyertakan foto selfie bukti kehadiran' });
    }

    // Validasi GPS (hanya jika koordinat toko telah dikonfigurasi & bukan dari terminal kasir fisik)
    let distanceIn: number | null = null;
    let isWithinRadius = true;
    if (storeLat !== null && storeLon !== null && latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      distanceIn = calculateDistanceMeters(Number(latitude), Number(longitude), storeLat, storeLon);
      isWithinRadius = distanceIn <= maxRadius;

      if (enableGps && !isWithinRadius && !isPosTerminal) {
        return res.status(400).json({ 
          error: `Anda berada di luar radius toko (${distanceIn} meter dari lokasi toko, batas toleransi: ${maxRadius} meter).`,
          distance: distanceIn,
          maxRadius
        });
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // Rentang 24 jam ke belakang untuk mendukung shift malam yang melewati jam 00:00 (cross-midnight)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // BUG-003 FIX: Atomic Clock-In / Clock-Out dengan $transaction untuk mencegah race condition double-insert
    const clockResult = await prisma.$transaction(async (tx) => {
      // Cari sesi aktif yang belum clockOut dalam 24 jam terakhir (mendukung shift malam / cross-midnight)
      const openLog = await tx.attendance.findFirst({
        where: {
          userId: user.id,
          clockOut: null,
          clockIn: { gte: twentyFourHoursAgo },
          ...tenantWhere(resolvedTenantId)
        },
        orderBy: { clockIn: 'desc' }
      });

      // Log hari ini (untuk pengecekan duplikasi pada hari kalender yang sama)
      const todayLog = await tx.attendance.findFirst({
        where: {
          userId: user.id,
          clockIn: { gte: todayStart },
          ...tenantWhere(resolvedTenantId)
        },
        orderBy: { clockIn: 'desc' }
      });

      if (type === 'IN') {
        // Jika masih ada sesi kerja yang belum Clock Out (baik hari ini atau shift malam kemarin)
        if (openLog) {
          throw new Error(`ALREADY_CLOCKED_IN:${openLog.clockIn.toISOString()}`);
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
          const toleranceBoundary = shiftStartTotalMinutes + tolerance;

          if (nowMinutes > toleranceBoundary) {
            // B-05 FIX: lateMinutes dihitung dari BATAS TOLERANSI, bukan dari jam mulai shift
            lateMinutes = nowMinutes - toleranceBoundary;
            status = 'Terlambat';
          }
        }

        if (distanceIn !== null && !isWithinRadius && !isPosTerminal) {
          status = 'Di Luar Radius';
        }

        const attendance = await tx.attendance.create({
          data: {
            tenantId: resolvedTenantId,
            outletId: bodyOutletId || null,
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
            notes: notes || (isPosTerminal ? '[Terminal POS]' : null)
          }
        });

        return { type: 'IN', attendance, status };
      } else {
        // Clock OUT
        // Utamakan sesi terbuka openLog (bahkan jika Clock In dilakukan kemarin sebelum tengah malam)
        const targetLog = openLog || todayLog;
        if (!targetLog) {
          throw new Error('NOT_CLOCKED_IN');
        }
        if (targetLog.clockOut) {
          throw new Error(`ALREADY_CLOCKED_OUT:${targetLog.clockOut.toISOString()}`);
        }

        const attendance = await tx.attendance.update({
          where: { id: targetLog.id },
          data: { 
            clockOut: new Date(),
            photoOut: photo || null,
            latitudeOut: latitude ? Number(latitude) : null,
            longitudeOut: longitude ? Number(longitude) : null
          }
        });

        return { type: 'OUT', attendance, status: attendance.status };
      }
    });

    if (clockResult.type === 'IN') {
      return res.json({ 
        message: `Clock In Berhasil: ${user.name} (${clockResult.status})`, 
        attendance: clockResult.attendance,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role
        }
      });
    } else {
      return res.json({ 
        message: `Clock Out Berhasil: ${user.name}`, 
        attendance: clockResult.attendance,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role
        }
      });
    }
  } catch (error: any) {
    if (error?.message?.startsWith('ALREADY_CLOCKED_IN:')) {
      const timeIso = error.message.split('ALREADY_CLOCKED_IN:')[1];
      const timeStr = timeIso ? new Date(timeIso).toLocaleTimeString('id-ID') : '';
      return res.status(400).json({ error: `Anda sudah Clock In hari ini (${user?.name})${timeStr ? ` pada ${timeStr}` : ''}` });
    }
    if (error?.message === 'NOT_CLOCKED_IN') {
      return res.status(400).json({ error: 'Anda belum melakukan Clock In hari ini' });
    }
    if (error?.message?.startsWith('ALREADY_CLOCKED_OUT:')) {
      const timeIso = error.message.split('ALREADY_CLOCKED_OUT:')[1];
      const timeStr = timeIso ? new Date(timeIso).toLocaleTimeString('id-ID') : '';
      return res.status(400).json({ error: `Anda sudah Clock Out hari ini (${user?.name})${timeStr ? ` pada ${timeStr}` : ''}` });
    }
    console.error('Attendance Process Error:', error);
    res.status(500).json({ error: 'Gagal memproses absensi' });
  }
});

// GET Attendances (List View with filter)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { date, userId, status } = req.query;
    
    const whereClause: any = {
      ...tenantWhere(tenantId)
    };
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
    const tenantId = getTenantId(req);
    const { month } = req.query; // YYYY-MM (e.g. 2026-09) or empty for all

    const settings = await prisma.settings.findFirst({
      where: tenantWhere(tenantId)
    });
    const enableZeroLateBonus = settings?.enableZeroLateBonus ?? true;
    const zeroLateBonusAmount = settings?.zeroLateBonusAmount ?? 200000;
    const zeroLateMinAttendance = settings?.zeroLateMinAttendance ?? 20;
    const zeroLateMaxLateAllowed = settings?.zeroLateMaxLateAllowed ?? 0;
    const enableLatePenalty = settings?.enableLatePenalty ?? false;
    const latePenaltyType = settings?.latePenaltyType ?? 'FLAT';
    const latePenaltyAmount = settings?.latePenaltyAmount ?? 10000;
    const enableAlphaPenalty = settings?.enableAlphaPenalty ?? false;
    const alphaPenaltyAmount = settings?.alphaPenaltyAmount ?? 50000;

    // ATT-002: Fail-closed + strict membership filter
    // Hapus pola fail-open OR [memberships.some, memberships.none]
    // User tanpa membership bukan staf tenant ini — tidak boleh muncul di rekap manapun
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const userFilter: any = {
      status: 'Aktif',
      memberships: { some: { tenantId, status: 'ACTIVE' } }
    };

    const users = await prisma.user.findMany({
      where: userFilter,
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
        const whereClause: any = { userId: u.id, ...tenantWhere(tenantId) };
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
        const shiftWhere: any = { userId: u.id, ...tenantWhere(tenantId) };
        if (dateFilter.gte) {
          shiftWhere.waktuBuka = dateFilter;
        }

        const orderWhere: any = { userId: u.id, ...tenantWhere(tenantId) };
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
              ...(dateFilter.gte ? { createdAt: dateFilter } : {}),
              ...tenantWhere(tenantId)
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
        // BUG-002 FIX: Status order di schema Prisma adalah 'Paid' dan 'Void', bukan 'COMPLETED'/'CANCELLED'/'VOID'
        const completedOrders = userOrders.filter((o: any) => o.status === 'Paid');
        const voidOrders = userOrders.filter((o: any) => o.status === 'Void');
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
    const user = (req as any).user;
    const userId = user?.id;
    let tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id;
    }

    const userDb = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, role: true }
    });

    if (!userDb) return res.status(404).json({ error: 'User tidak ditemukan' });

    const settings = await prisma.settings.findFirst({
      where: tenantWhere(tenantId)
    });
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
        userId: userDb.id,
        clockIn: { gte: startOfMonth },
        ...tenantWhere(tenantId)
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
        userId: userDb.id,
        clockIn: { gte: todayStart },
        ...(tenantId ? { tenantId } : {})
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
      user: userDb,
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
// ATT-003: userId WAJIB dari JWT (bukan body) — mencegah IDOR / injeksi izin atas nama staf lain
router.post('/leaves', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // B-09 FIX: Ambil userId dari JWT yang sudah terautentikasi, ABAIKAN userId dari body
    // Staff hanya bisa mengajukan izin untuk dirinya sendiri
    const requestingUser = (req as AuthRequest).user;
    const userId = requestingUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang.' });
    }

    const { type, startDate, endDate, reason, photoUrl } = req.body;
    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Lengkapi seluruh data pengajuan izin/sakit' });
    }

    // Validasi kepemilikan: user pemohon harus anggota aktif tenant ini
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { tenantId, status: 'ACTIVE' } }
      }
    });
    if (!targetUser) {
      return res.status(404).json({
        error: 'Karyawan tidak ditemukan atau bukan anggota outlet ini.',
        code: 'INVALID_USER_FOR_TENANT'
      });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        tenantId,
        userId, // Selalu dari JWT
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
router.get('/leaves', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { userId, status } = req.query;
    const whereClause: any = {
      ...tenantWhere(tenantId)
    };
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

// PATCH Approve or Reject Leave Request (Admin/Owner/Manager only)
// B-02 FIX: Tambah role guard ketat — staff biasa tidak boleh approve izin siapapun (termasuk dirinya sendiri)
router.patch('/leaves/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { status, approvedBy, adminNotes } = req.body;

    // B-02: Validasi role — hanya admin/owner/manager/supervisor yang boleh approve/reject
    const requestingUser = (req as AuthRequest).user;
    const approverRole = (requestingUser?.role || '').toLowerCase();
    const ALLOWED_APPROVER_ROLES = ['owner', 'admin', 'manager', 'supervisor', 'superadmin'];
    if (!ALLOWED_APPROVER_ROLES.includes(approverRole)) {
      return res.status(403).json({
        error: 'Akses ditolak. Hanya Owner/Admin/Manager yang dapat menyetujui atau menolak pengajuan izin.',
        code: 'INSUFFICIENT_ROLE'
      });
    }

    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const existing = await prisma.leaveRequest.findFirst({
      where: { id: Number(id), ...tenantWhere(tenantId) }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Pengajuan izin tidak ditemukan' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: Number(id) },
      data: {
        status,
        approvedBy: approvedBy || requestingUser?.name || 'Admin',
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
router.post('/handover', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
    const outletId = user?.outletId;
    const { userId, shiftName, cashBalance, equipmentStatus, notes } = req.body;
    if (!userId || !shiftName || !notes) {
      return res.status(400).json({ error: 'Data serah terima shift tidak lengkap' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const handover = await prisma.shiftHandover.create({
      data: {
        tenantId,
        outletId,
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
router.get('/handover', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { limit = 20 } = req.query;
    const handovers = await prisma.shiftHandover.findMany({
      where: tenantWhere(tenantId),
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
// B-07 FIX: Cek duplikasi — staff tidak bisa submit SOP yang sama (Opening/Closing) lebih dari sekali per hari
// Jika sudah ada, update (upsert) daripada create baru untuk menjaga data clean
router.post('/checklist', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthRequest).user;
    const tenantId = authUser?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
    const outletId = authUser?.outletId;
    const { userId, type, shiftName, items, notes } = req.body;
    if (!userId || !type || !items) {
      return res.status(400).json({ error: 'Lengkapi data checklist SOP' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const itemsJsonStr = typeof items === 'string' ? items : JSON.stringify(items);

    // B-07: Cek apakah sudah ada checklist tipe ini hari ini untuk user ini
    const existingChecklist = await prisma.kitchenChecklist.findFirst({
      where: {
        userId: Number(userId),
        type,
        date: todayStr,
        tenantId
      }
    });

    let checklist;
    if (existingChecklist) {
      // Update checklist yang sudah ada (termasuk progress terbaru)
      checklist = await prisma.kitchenChecklist.update({
        where: { id: existingChecklist.id },
        data: {
          shiftName: shiftName || existingChecklist.shiftName,
          itemsJson: itemsJsonStr,
          notes: notes || existingChecklist.notes,
        },
        include: {
          user: { select: { id: true, name: true, username: true, role: true } }
        }
      });
      return res.json({ ...checklist, _updated: true });
    }

    // Buat checklist baru jika belum ada hari ini
    checklist = await prisma.kitchenChecklist.create({
      data: {
        tenantId,
        outletId,
        userId: Number(userId),
        type, // OPENING or CLOSING
        date: todayStr,
        shiftName: shiftName || null,
        itemsJson: itemsJsonStr,
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
router.get('/checklist/today', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const todayStr = new Date().toISOString().split('T')[0];
    const checklists = await prisma.kitchenChecklist.findMany({
      where: { date: todayStr, ...tenantWhere(tenantId) },
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

// ATT-004: Tambahkan parameter tenantId opsional
// - Dipanggil tanpa arg dari cron platform = global (semua tenant, tugas sistem)
// - Dipanggil dengan tenantId dari endpoint manual = scoped ke tenant yang meminta saja
export async function runAttendanceAutoCutoff(tenantId?: string): Promise<{ count: number }> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const unclosed = await prisma.attendance.findMany({
      where: {
        clockOut: null,
        date: { lt: todayStr },
        // ATT-HARDENED: Jika dipanggil dari cron sistem tanpa tenantId → query global (semua tenant)
        // Ini DISENGAJA untuk cron platform. Jika dipanggil dari endpoint manual,
        // tenantId wajib ada dan digunakan sebagai scope. Fail-closed jika endpoint manual,
        // fail-open hanya diizinkan dari cron (tenantId === undefined, bukan null string).
        ...(tenantId !== undefined ? { tenantId: tenantId || 'BLOCKED_NULL_TENANT' } : {})
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

    const scope = tenantId ? `tenant ${tenantId}` : 'semua tenant (platform cron)';
    console.log(`[Auto-EOD Cutoff] Berhasil menutup ${unclosed.length} presensi staf (${scope}).`);
    return { count: unclosed.length };
  } catch (error) {
    console.error('Error running attendance auto cutoff:', error);
    return { count: 0 };
  }
}

// PUT Adjust / Koreksi Presensi Staf (Admin / Owner only)
router.put('/:id/adjust', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = Number(req.params.id);
    const { clockIn, clockOut, status, notes, lateMinutes } = req.body;
    const userRole = ((req as any).user?.role || '').toLowerCase();

    if (!['admin', 'owner', 'superadmin', 'manager', 'supervisor'].includes(userRole)) {
      return res.status(403).json({ error: 'Hanya Admin/Owner yang berwenang melakukan koreksi presensi.' });
    }

    const existing = await prisma.attendance.findFirst({
      where: { id, ...tenantWhere(tenantId) }
    });
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
// ATT-004: Scoped ke tenant yang meminta — tidak menyentuh absensi tenant lain
router.post('/auto-cutoff', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const result = await runAttendanceAutoCutoff(tenantId);
    res.json({ message: `Auto Cut-off selesai. ${result.count} presensi tertutup otomatis.`, result });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menjalankan auto-cutoff presensi' });
  }
});

// ─── POST /api/attendance/sync-offline: Batch Sync Offline Attendances ───
router.post('/sync-offline', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const { attendances } = req.body;

    if (!Array.isArray(attendances) || attendances.length === 0) {
      return res.status(400).json({ error: 'Payload attendances harus berupa array' });
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (const att of attendances) {
      try {
        const uId = Number(att.userId);
        const clientDate = att.clientTimestamp ? new Date(att.clientTimestamp) : new Date();
        const dateStr = clientDate.toISOString().slice(0, 10);

        // Find existing attendance for user on that date
        const existing = await prisma.attendance.findFirst({
          where: {
            tenantId,
            userId: uId,
            date: dateStr,
          },
        });

        // Check idempotency via offlineId first (fastest path)
        if (att.offlineId) {
          const byOfflineId = await prisma.attendance.findFirst({
            where: { tenantId, offlineId: att.offlineId },
          });
          if (byOfflineId) {
            syncedCount++;
            continue; // Already synced, skip
          }
        }

        if (att.type === 'IN') {
          if (!existing) {
            await prisma.attendance.create({
              data: {
                tenantId,
                userId: uId,
                date: dateStr,
                clockIn: clientDate,
                photoIn: att.photoBase64 || null,
                latitudeIn: att.latitude ? Number(att.latitude) : null,
                longitudeIn: att.longitude ? Number(att.longitude) : null,
                status: 'Hadir',
                notes: att.notes || 'Sync Offline',
                offlineId: att.offlineId || null,
              },
            });
          } else {
            // Already exists, just ensure clockIn is set
            if (!existing.clockIn) {
              await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                  clockIn: clientDate,
                  photoIn: att.photoBase64 || existing.photoIn,
                  offlineId: att.offlineId || existing.offlineId,
                },
              });
            }
          }
        } else if (att.type === 'OUT') {
          if (existing) {
            await prisma.attendance.update({
              where: { id: existing.id },
              data: {
                clockOut: clientDate,
                photoOut: att.photoBase64 || existing.photoOut,
                latitudeOut: att.latitude ? Number(att.latitude) : null,
                longitudeOut: att.longitude ? Number(att.longitude) : null,
              },
            });
          } else {
            // Out without existing IN record
            await prisma.attendance.create({
              data: {
                tenantId,
                userId: uId,
                date: dateStr,
                clockIn: clientDate,
                clockOut: clientDate,
                photoOut: att.photoBase64 || null,
                latitudeOut: att.latitude ? Number(att.latitude) : null,
                longitudeOut: att.longitude ? Number(att.longitude) : null,
                status: 'Hadir',
                notes: 'Clock Out (Sync Offline)',
                offlineId: att.offlineId || null,
              },
            });
          }
        }

        syncedCount++;

      } catch (attErr: any) {
        console.error('[Offline Attendance Sync Error]:', attErr);
        errors.push(`${att.offlineId || att.userId}: ${attErr.message}`);
      }
    }

    res.json({
      success: true,
      syncedCount,
      errors,
      message: `Berhasil menyinkronkan ${syncedCount} catatan presensi staf.`,
    });
  } catch (err: any) {
    console.error('Batch Offline Attendance Sync Error:', err);
    res.status(500).json({ error: err.message || 'Gagal memproses sinkronisasi absensi offline' });
  }
});

export default router;

