import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';

const router = Router();

export interface BengkelConfig {
  enableCommission: boolean;
  defaultCommissionRate: number; // e.g. 0.20 (20%)
  requireMechanicOnService: boolean;
  commissionBase: 'SERVICE_ONLY' | 'SERVICE_AND_PARTS';
}

export async function getBengkelConfig(tenantId: string): Promise<BengkelConfig> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { notes: true }
  });

  const defaults: BengkelConfig = {
    enableCommission: true,
    defaultCommissionRate: 0.20,
    requireMechanicOnService: false,
    commissionBase: 'SERVICE_ONLY'
  };

  if (!tenant?.notes) return defaults;

  try {
    const parsed = JSON.parse(tenant.notes);
    if (parsed && typeof parsed.bengkel === 'object') {
      return { ...defaults, ...parsed.bengkel };
    }
  } catch {
    // If notes is plain text, keep defaults
  }
  return defaults;
}

export async function saveBengkelConfig(tenantId: string, config: Partial<BengkelConfig>): Promise<BengkelConfig> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { notes: true }
  });

  let existingJson: any = {};
  if (tenant?.notes) {
    try {
      existingJson = JSON.parse(tenant.notes);
    } catch {
      existingJson = { rawNotes: tenant.notes };
    }
  }

  const currentConfig = await getBengkelConfig(tenantId);
  const updatedConfig: BengkelConfig = {
    ...currentConfig,
    ...config
  };

  existingJson.bengkel = updatedConfig;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { notes: JSON.stringify(existingJson) }
  });

  return updatedConfig;
}

// GET /api/bengkel/mechanics (List semua mekanik di tenant + status kehadiran hari ini)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    // 1. Ambil log absensi aktif hari ini (Clock In tanpa Clock Out)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeAttendances = await prisma.attendance.findMany({
      where: {
        tenantId,
        clockIn: { gte: todayStart },
        clockOut: null
      },
      select: { userId: true, clockIn: true }
    });
    const presentUserMap = new Map<number, Date>();
    for (const a of activeAttendances) {
      presentUserMap.set(a.userId, a.clockIn);
    }

    // 2. Ambil user via memberships
    const memberships = await prisma.tenantMembership.findMany({
      where: {
        tenantId,
        status: 'ACTIVE'
      },
      include: {
        user: {
          include: {
            mechanicProfile: true
          }
        },
        role: true
      }
    });

    // 3. Ambil direct users (khususnya untuk mode standalone / direct tenant)
    const directUsers = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'Aktif'
      },
      include: {
        mechanicProfile: true
      }
    });

    const mechanicMap = new Map<number, any>();

    // Masukkan dari memberships
    for (const m of memberships) {
      const u = m.user;
      const profile = u.mechanicProfile && u.mechanicProfile.tenantId === tenantId ? u.mechanicProfile : null;
      const roleName = m.role?.name || u.role;
      const isMechanic = profile !== null || roleName?.toLowerCase().includes('mekanik') || roleName?.toLowerCase().includes('mechanic');

      if (isMechanic) {
        mechanicMap.set(u.id, {
          id: u.id,
          name: u.name,
          username: u.username,
          role: roleName,
          commissionType: profile?.commissionType || 'PERCENT',
          commissionRate: profile?.commissionRate ?? 0.20,
          pendingCommission: profile?.pendingCommission || 0,
          paidCommission: profile?.paidCommission || 0,
          profileId: profile?.id || null,
          isPresentToday: presentUserMap.has(u.id),
          clockInAt: presentUserMap.get(u.id) || null
        });
      }
    }

    // Masukkan dari direct users jika belum ada
    for (const u of directUsers) {
      if (!mechanicMap.has(u.id)) {
        const profile = u.mechanicProfile && u.mechanicProfile.tenantId === tenantId ? u.mechanicProfile : null;
        const roleName = u.role;
        const isMechanic = profile !== null || roleName?.toLowerCase().includes('mekanik') || roleName?.toLowerCase().includes('mechanic');

        if (isMechanic) {
          mechanicMap.set(u.id, {
            id: u.id,
            name: u.name,
            username: u.username,
            role: roleName,
            commissionType: profile?.commissionType || 'PERCENT',
            commissionRate: profile?.commissionRate ?? 0.20,
            pendingCommission: profile?.pendingCommission || 0,
            paidCommission: profile?.paidCommission || 0,
            profileId: profile?.id || null,
            isPresentToday: presentUserMap.has(u.id),
            clockInAt: presentUserMap.get(u.id) || null
          });
        }
      }
    }

    let mechanics = Array.from(mechanicMap.values());

    // Filter opsional jika klien hanya meminta mekanik yang hadir hari ini
    if (req.query.presentOnly === 'true') {
      const presentOnly = mechanics.filter(m => m.isPresentToday);
      if (presentOnly.length > 0) {
        mechanics = presentOnly;
      }
    }

    res.json(mechanics);
  } catch (error) {
    console.error('Error fetching mechanics:', error);
    res.status(500).json({ error: 'Gagal memuat data mekanik' });
  }
});

// POST /api/bengkel/mechanics/profile (Setup atau perbarui rate komisi mekanik)
router.post('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { userId, commissionType, commissionRate } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID wajib diisi' });
    }

    const userIdNum = parseInt(String(userId), 10);

    // Verify user belongs to tenant
    const membership = await prisma.tenantMembership.findFirst({
      where: { tenantId, userId: userIdNum }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Pengguna tidak terdaftar di tenant ini' });
    }

    const profile = await prisma.mechanicProfile.upsert({
      where: { userId: userIdNum },
      update: {
        commissionType: commissionType || 'PERCENT',
        commissionRate: commissionRate != null ? parseFloat(commissionRate) : 0.20
      },
      create: {
        tenantId,
        userId: userIdNum,
        commissionType: commissionType || 'PERCENT',
        commissionRate: commissionRate != null ? parseFloat(commissionRate) : 0.20,
        pendingCommission: 0,
        paidCommission: 0
      },
      include: {
        user: { select: { id: true, name: true, username: true } }
      }
    });

    res.json(profile);
  } catch (error) {
    console.error('Error updating mechanic profile:', error);
    res.status(500).json({ error: 'Gagal memperbarui profil mekanik' });
  }
});

// GET /api/bengkel/mechanics/payouts (Riwayat pembayaran komisi)
router.get('/payouts', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { mechanicId, period } = req.query;

    const where: any = { tenantId };
    if (mechanicId) where.mechanicId = String(mechanicId);
    if (period) where.period = String(period);

    const payouts = await prisma.commissionPayout.findMany({
      where,
      include: {
        mechanic: {
          include: {
            user: { select: { id: true, name: true, username: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(payouts);
  } catch (error) {
    console.error('Error fetching commission payouts:', error);
    res.status(500).json({ error: 'Gagal memuat riwayat payout komisi' });
  }
});

// POST /api/bengkel/mechanics/payout (Bayar komisi mekanik)
router.post('/payout', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const currentUserId = req.user?.id || 1;
    const { mechanicProfileId, amount, period, notes } = req.body;

    if (!mechanicProfileId || amount == null) {
      return res.status(400).json({ error: 'Mechanic Profile ID dan jumlah bayar wajib diisi' });
    }

    const payAmount = parseFloat(amount);
    if (payAmount <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran komisi harus lebih besar dari 0' });
    }

    // Double validate mechanic profile ownership
    const profile = await prisma.mechanicProfile.findFirst({
      where: { id: String(mechanicProfileId), tenantId },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profil mekanik tidak ditemukan' });
    }

    const currentPeriod = period ? String(period) : new Date().toISOString().slice(0, 7);

    // Transaction: Record payout, update profile pending/paid, and record cash expense
    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.commissionPayout.create({
        data: {
          tenantId,
          mechanicId: profile.id,
          period: currentPeriod,
          amount: payAmount,
          paidById: currentUserId,
          notes: notes ? String(notes).trim() : null
        }
      });

      const updatedProfile = await tx.mechanicProfile.update({
        where: { id: profile.id },
        data: {
          pendingCommission: { decrement: payAmount },
          paidCommission: { increment: payAmount }
        }
      });

      // Catat mutasi kas keluar operasional komisi mekanik
      await tx.cashFlow.create({
        data: {
          tenantId,
          type: 'Pengeluaran',
          category: 'KOMISI_MEKANIK',
          cashPocket: 'LACI_KASIR',
          amount: payAmount,
          description: `Pembayaran komisi mekanik (${profile.user?.name || 'Mekanik'}) - Periode ${currentPeriod}${notes ? ` (${notes})` : ''}`,
          userId: currentUserId,
          date: new Date()
        }
      });

      return { payout, updatedProfile };
    });

    res.json({
      success: true,
      message: 'Pembayaran komisi berhasil dicatat',
      payout: result.payout,
      remainingPendingCommission: result.updatedProfile.pendingCommission
    });
  } catch (error) {
    console.error('Error processing commission payout:', error);
    res.status(500).json({ error: 'Gagal memproses pembayaran komisi' });
  }
});

// GET /api/bengkel/mechanics/settings (Ambil opsi konfigurasi bengkel)
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    const config = await getBengkelConfig(tenantId);
    res.json(config);
  } catch (error) {
    console.error('Error fetching bengkel settings:', error);
    res.status(500).json({ error: 'Gagal memuat pengaturan bengkel' });
  }
});

// POST /api/bengkel/mechanics/settings (Simpan opsi konfigurasi bengkel)
router.post('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    const updated = await saveBengkelConfig(tenantId, req.body);
    res.json({ success: true, message: 'Pengaturan bengkel berhasil disimpan', config: updated });
  } catch (error) {
    console.error('Error updating bengkel settings:', error);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan bengkel' });
  }
});

// POST /api/bengkel/mechanics/register (Tambah staf mekanik baru langsung secara atomik)
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia' });

    const { name, username, password, pin, commissionRate, commissionType } = req.body;

    if (!name || !username) {
      return res.status(400).json({ error: 'Nama dan username mekanik wajib diisi' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Cek username sudah ada di tenant
    const existing = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
        OR: [
          { tenantId },
          { memberships: { some: { tenantId } } }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: `Username "${cleanUsername}" sudah digunakan oleh staf lain.` });
    }

    // Pastikan role MEKANIK ada di database
    let mekanikRole = await prisma.role.findFirst({
      where: {
        OR: [
          { name: 'MEKANIK' },
          { id: 'role-system-mekanik' }
        ],
        AND: [
          { OR: [{ isSystem: true }, { tenantId }] }
        ]
      }
    });

    if (!mekanikRole) {
      mekanikRole = await prisma.role.upsert({
        where: { id: 'role-system-mekanik' },
        update: { name: 'MEKANIK', description: 'Mekanik / Teknisi Servis', isSystem: true },
        create: {
          id: 'role-system-mekanik',
          name: 'MEKANIK',
          description: 'Mekanik / Teknisi Servis',
          isSystem: true
        }
      });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password || '123456', 10);
    const staffPin = pin || '123456';

    const bConfig = await getBengkelConfig(tenantId);
    const resolvedRate = commissionRate != null ? parseFloat(commissionRate) / (parseFloat(commissionRate) > 1 ? 100 : 1) : bConfig.defaultCommissionRate;
    const resolvedType = commissionType || (bConfig.enableCommission ? 'PERCENT' : 'NONE');

    // Buat User, Membership, dan MechanicProfile dalam 1 transaksi
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: String(name).trim(),
          username: cleanUsername,
          passwordHash,
          pin: staffPin,
          role: 'MEKANIK',
          tenantId,
          employmentType: 'FULL_TIME',
          permissions: JSON.stringify({}),
          status: 'Aktif'
        }
      });

      await tx.tenantMembership.create({
        data: {
          userId: newUser.id,
          tenantId,
          roleId: mekanikRole.id,
          pin: staffPin,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE'
        }
      });

      const profile = await tx.mechanicProfile.create({
        data: {
          tenantId,
          userId: newUser.id,
          commissionType: resolvedType,
          commissionRate: resolvedRate,
          pendingCommission: 0,
          paidCommission: 0
        }
      });

      return { user: newUser, profile };
    });

    res.status(201).json({
      success: true,
      message: `Mekanik ${result.user.name} berhasil didaftarkan`,
      mechanic: {
        id: result.user.id,
        name: result.user.name,
        username: result.user.username,
        role: 'MEKANIK',
        commissionType: result.profile.commissionType,
        commissionRate: result.profile.commissionRate,
        pendingCommission: 0,
        paidCommission: 0,
        profileId: result.profile.id
      }
    });
  } catch (error) {
    console.error('Error registering mechanic:', error);
    res.status(500).json({ error: 'Gagal mendaftarkan mekanik baru' });
  }
});

export default router;
