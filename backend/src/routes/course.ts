import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── 1. CRUD Course (Paket Program / Kursus) ───────────────────────────

// GET /api/courses - List seluruh kursus
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, status } = req.query;
    const where: any = {};
    if (category) where.category = String(category);
    if (status) where.status = String(status);

    const courses = await prisma.course.findMany({
      where,
      include: {
        _count: {
          select: {
            subjects: true,
            batches: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { sessions: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(courses);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat daftar kursus', message: error?.message });
  }
});

// GET /api/courses/:id - Detail kursus beserta seluruh silabus (Mapel & Sesi)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        subjects: {
          orderBy: { orderIndex: 'asc' },
          include: {
            sessions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        batches: {
          orderBy: { startDate: 'desc' },
          include: {
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
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Kursus tidak ditemukan' });
    }
    res.json(course);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat detail kursus', message: error?.message });
  }
});

// POST /api/courses - Buat kursus baru
router.post('/', async (req: Request, res: Response) => {
  try {
    const { code, title, category, description, thumbnailUrl, price, status } = req.body;
    if (!code || !title) {
      return res.status(400).json({ error: 'Kode kursus dan judul wajib diisi' });
    }

    const newCourse = await prisma.course.create({
      data: {
        code,
        title,
        category: category || 'BIMBEL',
        description,
        thumbnailUrl,
        price: parseFloat(price) || 0,
        status: status || 'ACTIVE',
      },
    });
    res.status(201).json(newCourse);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal membuat kursus baru', message: error?.message });
  }
});

// PUT /api/courses/:id - Update kursus
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { code, title, category, description, thumbnailUrl, price, status } = req.body;

    const updated = await prisma.course.update({
      where: { id },
      data: {
        code,
        title,
        category,
        description,
        thumbnailUrl,
        price: price !== undefined ? parseFloat(price) : undefined,
        status,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memperbarui kursus', message: error?.message });
  }
});

// DELETE /api/courses/:id - Hapus kursus
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    await prisma.course.delete({ where: { id } });
    res.json({ success: true, message: 'Kursus berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menghapus kursus', message: error?.message });
  }
});

// ─── 2. Mata Pelajaran (CourseSubject) ─────────────────────────────────

// POST /api/courses/:id/subjects - Tambah Mapel ke Kursus
router.post('/:id/subjects', async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(String(req.params.id));
    const { name, description, orderIndex } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nama mata pelajaran wajib diisi' });
    }

    const subject = await prisma.courseSubject.create({
      data: {
        courseId,
        name,
        description,
        orderIndex: orderIndex ? parseInt(orderIndex) : 1,
      },
    });
    res.status(201).json(subject);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menambahkan mata pelajaran', message: error?.message });
  }
});

// PUT /api/courses/subjects/:subjectId - Edit Mapel
router.put('/subjects/:subjectId', async (req: Request, res: Response) => {
  try {
    const subjectId = parseInt(String(req.params.subjectId));
    const { name, description, orderIndex } = req.body;

    const updated = await prisma.courseSubject.update({
      where: { id: subjectId },
      data: {
        name,
        description,
        orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : undefined,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memperbarui mata pelajaran', message: error?.message });
  }
});

// DELETE /api/courses/subjects/:subjectId - Hapus Mapel
router.delete('/subjects/:subjectId', async (req: Request, res: Response) => {
  try {
    const subjectId = parseInt(String(req.params.subjectId));
    await prisma.courseSubject.delete({ where: { id: subjectId } });
    res.json({ success: true, message: 'Mata pelajaran berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menghapus mata pelajaran', message: error?.message });
  }
});

// ─── 3. Sesi Pembelajaran & Materi Ajar (CourseSession) ────────────────

// POST /api/courses/subjects/:subjectId/sessions - Tambah Sesi / Modul Ajar
router.post('/subjects/:subjectId/sessions', async (req: Request, res: Response) => {
  try {
    const subjectId = parseInt(String(req.params.subjectId));
    const { title, description, orderIndex, handoutPdfUrl, vodVideoUrl, vodDurationSec, quizUrl, minPassingScore } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Judul sesi materi wajib diisi' });
    }

    const session = await prisma.courseSession.create({
      data: {
        subjectId,
        title,
        description,
        orderIndex: orderIndex ? parseInt(orderIndex) : 1,
        handoutPdfUrl,
        vodVideoUrl,
        vodDurationSec: vodDurationSec ? parseInt(vodDurationSec) : null,
        quizUrl,
        minPassingScore: minPassingScore !== undefined ? parseFloat(minPassingScore) : null,
      },
    });
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal membuat sesi materi baru', message: error?.message });
  }
});

// PUT /api/courses/sessions/:sessionId - Edit Sesi / Modul Ajar
router.put('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId));
    const { title, description, orderIndex, handoutPdfUrl, vodVideoUrl, vodDurationSec, quizUrl, minPassingScore } = req.body;

    const updated = await prisma.courseSession.update({
      where: { id: sessionId },
      data: {
        title,
        description,
        orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : undefined,
        handoutPdfUrl,
        vodVideoUrl,
        vodDurationSec: vodDurationSec !== undefined ? (vodDurationSec ? parseInt(vodDurationSec) : null) : undefined,
        quizUrl,
        minPassingScore: minPassingScore !== undefined ? (minPassingScore ? parseFloat(minPassingScore) : null) : undefined,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memperbarui sesi materi', message: error?.message });
  }
});

// DELETE /api/courses/sessions/:sessionId - Hapus Sesi
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId));
    await prisma.courseSession.delete({ where: { id: sessionId } });
    res.json({ success: true, message: 'Sesi materi berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menghapus sesi materi', message: error?.message });
  }
});

export default router;
