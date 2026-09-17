import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── 1. CRUD Course Batch (Angkatan / Cohort) ──────────────────────────

// GET /api/batches - List seluruh batch
router.get('/', async (req: Request, res: Response) => {
  try {
    const { courseId, status } = req.query;
    const where: any = {};
    if (courseId) where.courseId = parseInt(String(courseId));
    if (status) where.status = String(status);

    const batches = await prisma.courseBatch.findMany({
      where,
      include: {
        course: {
          select: { id: true, code: true, title: true, category: true },
        },
        instructors: {
          include: {
            instructor: {
              select: { id: true, name: true, role: true, username: true },
            },
          },
        },
        _count: {
          select: { liveSessions: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat daftar batch', message: error?.message });
  }
});

// GET /api/batches/:id - Detail batch beserta instruktur & live sessions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const batch = await prisma.courseBatch.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            subjects: {
              include: {
                sessions: {
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
        instructors: {
          include: {
            instructor: {
              select: { id: true, name: true, role: true, username: true },
            },
          },
        },
        liveSessions: {
          include: {
            session: {
              select: { id: true, title: true, subjectId: true },
            },
            instructor: {
              select: { id: true, name: true },
            },
          },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch tidak ditemukan' });
    }
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat detail batch', message: error?.message });
  }
});

// POST /api/batches - Buat batch baru
router.post('/', async (req: Request, res: Response) => {
  try {
    const { courseId, name, startDate, endDate, maxStudents, status } = req.body;
    if (!courseId || !name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Course, nama batch, tanggal mulai & selesai wajib diisi' });
    }

    const newBatch = await prisma.courseBatch.create({
      data: {
        courseId: parseInt(String(courseId)),
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxStudents: maxStudents ? parseInt(String(maxStudents)) : 50,
        status: status || 'OPEN',
      },
    });
    res.status(201).json(newBatch);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal membuat batch baru', message: error?.message });
  }
});

// PUT /api/batches/:id - Update batch
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { name, startDate, endDate, maxStudents, status } = req.body;

    const updated = await prisma.courseBatch.update({
      where: { id },
      data: {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        maxStudents: maxStudents !== undefined ? parseInt(String(maxStudents)) : undefined,
        status,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memperbarui batch', message: error?.message });
  }
});

// DELETE /api/batches/:id - Hapus batch
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    await prisma.courseBatch.delete({ where: { id } });
    res.json({ success: true, message: 'Batch berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menghapus batch', message: error?.message });
  }
});

// ─── 2. Penugasan Pengajar (BatchInstructor) ──────────────────────────

// POST /api/batches/:id/instructors - Tugaskan Tutor ke Batch
router.post('/:id/instructors', async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(String(req.params.id));
    const { instructorId, role, hourlyRate } = req.body;
    if (!instructorId) {
      return res.status(400).json({ error: 'ID instruktur / tutor wajib diisi' });
    }

    const assignment = await prisma.batchInstructor.upsert({
      where: {
        batchId_instructorId: {
          batchId,
          instructorId: parseInt(String(instructorId)),
        },
      },
      update: {
        role: role || 'LEAD_INSTRUCTOR',
        hourlyRate: hourlyRate !== undefined ? parseFloat(String(hourlyRate)) : 0,
      },
      create: {
        batchId,
        instructorId: parseInt(String(instructorId)),
        role: role || 'LEAD_INSTRUCTOR',
        hourlyRate: hourlyRate !== undefined ? parseFloat(String(hourlyRate)) : 0,
      },
      include: {
        instructor: {
          select: { id: true, name: true, role: true, username: true },
        },
      },
    });

    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menugaskan instruktur ke batch', message: error?.message });
  }
});

// DELETE /api/batches/:id/instructors/:instructorId - Hapus penugasan tutor
router.delete('/:id/instructors/:instructorId', async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(String(req.params.id));
    const instructorId = parseInt(String(req.params.instructorId));

    await prisma.batchInstructor.delete({
      where: {
        batchId_instructorId: {
          batchId,
          instructorId,
        },
      },
    });

    res.json({ success: true, message: 'Penugasan instruktur berhasil dicabut' });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal mencabut penugasan instruktur', message: error?.message });
  }
});

export default router;
