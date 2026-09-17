import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── 1. CRUD Jadwal Sesi Live Class ───────────────────────────────────

// GET /api/live-sessions - Ambil daftar sesi live
router.get('/', async (req: Request, res: Response) => {
  try {
    const { batchId, instructorId, status } = req.query;
    const where: any = {};
    if (batchId) where.batchId = parseInt(String(batchId));
    if (instructorId) where.instructorId = parseInt(String(instructorId));
    if (status) where.status = String(status);

    const sessions = await prisma.batchLiveSession.findMany({
      where,
      include: {
        batch: {
          select: { id: true, name: true, course: { select: { title: true } } },
        },
        session: {
          select: { id: true, title: true, subject: { select: { name: true } } },
        },
        instructor: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat daftar live session', message: error?.message });
  }
});

// POST /api/live-sessions - Jadwalkan Sesi Live Baru
router.post('/', async (req: Request, res: Response) => {
  try {
    const { batchId, sessionId, instructorId, scheduledAt, durationMin, meetingUrl, meetingPass } = req.body;
    if (!batchId || !sessionId || !instructorId || !scheduledAt) {
      return res.status(400).json({ error: 'Batch, sesi materi, instruktur, dan jadwal wajib diisi' });
    }

    const liveSession = await prisma.batchLiveSession.create({
      data: {
        batchId: parseInt(String(batchId)),
        sessionId: parseInt(String(sessionId)),
        instructorId: parseInt(String(instructorId)),
        scheduledAt: new Date(scheduledAt),
        durationMin: durationMin ? parseInt(String(durationMin)) : 90,
        meetingUrl,
        meetingPass,
        status: 'SCHEDULED',
      },
      include: {
        batch: { select: { name: true } },
        session: { select: { title: true } },
        instructor: { select: { name: true } },
      },
    });
    res.status(201).json(liveSession);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menjadwalkan sesi live baru', message: error?.message });
  }
});

// PUT /api/live-sessions/:id/start - Tutor Mulai Sesi Live
router.put('/:id/start', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const updated = await prisma.batchLiveSession.update({
      where: { id },
      data: {
        status: 'LIVE',
        actualStartAt: new Date(),
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memulai sesi live', message: error?.message });
  }
});

// PUT /api/live-sessions/:id/complete - Tutor Selesaikan Sesi Live & Auto Kalkulasi Honor
router.put('/:id/complete', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { recordingUrl, tutorNotes } = req.body;

    // Ambil data sesi live dan assignment tarif honor tutor
    const current = await prisma.batchLiveSession.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            instructors: true,
          },
        },
      },
    });

    if (!current) {
      return res.status(404).json({ error: 'Sesi live tidak ditemukan' });
    }

    const now = new Date();
    const startTime = current.actualStartAt || current.scheduledAt;
    const durationMinutes = Math.max(
      current.durationMin,
      Math.round((now.getTime() - new Date(startTime).getTime()) / 60000)
    );

    // Cari rate pengajar di batch tersebut
    const instructorAssignment = current.batch.instructors.find(
      (ins) => ins.instructorId === current.instructorId
    );
    const hourlyRate = instructorAssignment ? instructorAssignment.hourlyRate : 0;
    const feeCalculated = Math.round((durationMinutes / 60) * hourlyRate);

    const updated = await prisma.batchLiveSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualEndAt: now,
        recordingUrl: recordingUrl || current.recordingUrl,
        tutorNotes: tutorNotes || current.tutorNotes,
        feeCalculated,
      },
    });

    res.json({
      success: true,
      message: 'Sesi live berhasil diselesaikan',
      session: updated,
      durationMinutes,
      feeCalculated,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menyelesaikan sesi live', message: error?.message });
  }
});

// GET /api/live-sessions/tutor/:tutorId/recap - Rekap Kinerja & Honorarium Tutor
router.get('/tutor/:tutorId/recap', async (req: Request, res: Response) => {
  try {
    const tutorId = parseInt(String(req.params.tutorId));

    const completedSessions = await prisma.batchLiveSession.findMany({
      where: {
        instructorId: tutorId,
        status: 'COMPLETED',
      },
      include: {
        batch: { select: { name: true, course: { select: { title: true } } } },
        session: { select: { title: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    const totalSessions = completedSessions.length;
    const totalFees = completedSessions.reduce((acc, curr) => acc + (curr.feeCalculated || 0), 0);
    const totalMinutes = completedSessions.reduce((acc, curr) => acc + (curr.durationMin || 0), 0);

    res.json({
      tutorId,
      totalSessions,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      totalFees,
      sessions: completedSessions,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat rekap honor tutor', message: error?.message });
  }
});

// DELETE /api/live-sessions/:id - Hapus sesi live
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    await prisma.batchLiveSession.delete({ where: { id } });
    res.json({ success: true, message: 'Sesi live berhasil dibatalkan / dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menghapus sesi live', message: error?.message });
  }
});

export default router;
