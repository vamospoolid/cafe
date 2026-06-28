import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Middleware to check if user is Admin
const isAdmin = (req: Request, res: Response, next: Function) => {
  if ((req as any).user.role !== 'Admin') {
    return res.status(403).json({ error: 'Akses ditolak. Memerlukan hak akses Admin.' });
  }
  next();
};

// GET all users (only Admin can view full list)
router.get('/', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        permissions: true,
        status: true,
        createdAt: true,
      }
    });
    // Parse permissions back to JSON object for frontend
    const mappedUsers = users.map(u => ({
      ...u,
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions
    }));
    res.json(mappedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil data karyawan' });
  }
});

// POST Create new user
router.post('/', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { name, username, password, pin, role, permissions, status } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return res.status(400).json({ error: 'Username sudah digunakan' });

    const passwordHash = await bcrypt.hash(password || '123456', 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        pin: pin || '123456',
        role,
        permissions: JSON.stringify(permissions),
        status: status || 'Aktif',
      },
      select: { id: true, name: true, username: true, role: true }
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat akun karyawan' });
  }
});

// PUT Update user
router.put('/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, username, password, pin, role, permissions, status } = req.body;

    // Check if trying to edit superadmin
    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (targetUser.role === 'Admin' && role !== 'Admin') {
      return res.status(403).json({ error: 'Tidak bisa menurunkan jabatan akun Admin' });
    }

    const updateData: any = {
      name,
      username,
      role,
      permissions: JSON.stringify(permissions),
      status
    };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    if (pin) {
      updateData.pin = pin;
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: { id: true, name: true, username: true, role: true }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengubah data karyawan' });
  }
});

// DELETE user
router.delete('/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan' });
    
    if (targetUser.role === 'Admin') {
      return res.status(403).json({ error: 'Akun Admin mutlak tidak dapat dihapus' });
    }

    // Since we don't want to break order history, we should only "deactivate" or soft-delete
    // But for this MVP, we will actually delete them or deactivate them.
    // Let's soft-delete them by changing status to Nonaktif.
    await prisma.user.update({
      where: { id: Number(id) },
      data: { status: 'Nonaktif' }
    });

    res.json({ message: 'Akun berhasil dinonaktifkan (Soft Delete).' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menonaktifkan akun karyawan' });
  }
});

export default router;
