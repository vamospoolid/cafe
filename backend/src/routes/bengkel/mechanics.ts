import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';

const router = Router();

// GET /api/bengkel/mechanics (List semua mekanik di tenant)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    // Ambil semua user yang terasosiasi dengan tenant ini dan memiliki role/profile mekanik
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

    const mechanics = memberships
      .map(m => {
        const u = m.user;
        const profile = u.mechanicProfile && u.mechanicProfile.tenantId === tenantId ? u.mechanicProfile : null;
        return {
          id: u.id,
          name: u.name,
          username: u.username,
          role: m.role?.name || u.role,
          commissionType: profile?.commissionType || 'PERCENT',
          commissionRate: profile?.commissionRate ?? 0.20,
          pendingCommission: profile?.pendingCommission || 0,
          paidCommission: profile?.paidCommission || 0,
          profileId: profile?.id || null
        };
      })
      .filter(m => m.profileId !== null || m.role?.toLowerCase().includes('mekanik') || m.role?.toLowerCase().includes('mechanic'));

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

export default router;
