import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── 1. Tracking Progres Belajar Siswa ──────────────────────────────────

// GET /api/progress/course/:courseId/student/:studentId - Ambil status progres lengkap kursus
router.get('/course/:courseId/student/:studentId', async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(String(req.params.courseId));
    const studentId = parseInt(String(req.params.studentId));

    // Ambil struktur seluruh sesi materi pada kursus ini
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        subjects: {
          orderBy: { orderIndex: 'asc' },
          include: {
            sessions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Kursus tidak ditemukan' });
    }

    // Ambil rekam progres siswa
    const sessionIds = course.subjects.flatMap((s) => s.sessions.map((sess) => sess.id));
    const progresses = await prisma.studentSessionProgress.findMany({
      where: {
        studentId,
        sessionId: { in: sessionIds },
      },
    });

    const progressMap = new Map(progresses.map((p) => [p.sessionId, p]));
    const totalSessions = sessionIds.length;
    let completedCount = 0;

    const structuredSubjects = course.subjects.map((subject) => {
      const mappedSessions = subject.sessions.map((session) => {
        const prog = progressMap.get(session.id);
        const isDone = prog ? prog.isCompleted : false;
        if (isDone) completedCount++;

        return {
          ...session,
          progress: prog || {
            isPdfRead: false,
            isVideoDone: false,
            quizScore: null,
            isCompleted: false,
          },
        };
      });

      return {
        ...subject,
        sessions: mappedSessions,
      };
    });

    const percentage = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

    res.json({
      courseId,
      studentId,
      totalSessions,
      completedCount,
      percentage,
      subjects: structuredSubjects,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat progres belajar siswa', message: error?.message });
  }
});

// POST /api/progress/mark - Update / Toggle status penyelesaian materi
router.post('/mark', async (req: Request, res: Response) => {
  try {
    const { studentId, sessionId, isPdfRead, isVideoDone, quizScore, isCompleted } = req.body;
    if (!studentId || !sessionId) {
      return res.status(400).json({ error: 'ID Siswa dan ID Sesi materi wajib diisi' });
    }

    const sId = parseInt(String(studentId));
    const sessId = parseInt(String(sessionId));

    // Cek apakah data progres sudah ada
    const existing = await prisma.studentSessionProgress.findUnique({
      where: {
        studentId_sessionId: {
          studentId: sId,
          sessionId: sessId,
        },
      },
    });

    const newIsPdfRead = isPdfRead !== undefined ? Boolean(isPdfRead) : existing?.isPdfRead ?? false;
    const newIsVideoDone = isVideoDone !== undefined ? Boolean(isVideoDone) : existing?.isVideoDone ?? false;
    const newQuizScore = quizScore !== undefined ? (quizScore !== null ? parseFloat(String(quizScore)) : null) : existing?.quizScore ?? null;

    // Otomatis tandai isCompleted jika isCompleted dikirim atau semua komponen sudah selesai
    const determinedCompleted = isCompleted !== undefined
      ? Boolean(isCompleted)
      : (newIsPdfRead && newIsVideoDone);

    const progress = await prisma.studentSessionProgress.upsert({
      where: {
        studentId_sessionId: {
          studentId: sId,
          sessionId: sessId,
        },
      },
      update: {
        isPdfRead: newIsPdfRead,
        isVideoDone: newIsVideoDone,
        quizScore: newQuizScore,
        isCompleted: determinedCompleted,
        completedAt: determinedCompleted ? (existing?.completedAt || new Date()) : null,
      },
      create: {
        studentId: sId,
        sessionId: sessId,
        isPdfRead: newIsPdfRead,
        isVideoDone: newIsVideoDone,
        quizScore: newQuizScore,
        isCompleted: determinedCompleted,
        completedAt: determinedCompleted ? new Date() : null,
      },
    });

    res.json({
      success: true,
      message: 'Progres belajar berhasil diperbarui',
      progress,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memperbarui progres belajar', message: error?.message });
  }
});

export default router;
