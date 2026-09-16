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

// GET current logged-in user profile
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        employmentType: true,
        pin: true,
        status: true,
        permissions: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    res.json({
      ...user,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Gagal mengambil profil akun' });
  }
});

// PUT update current staff security credentials (PIN / Password)
router.put('/me/security', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { oldPin, newPin, oldPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    const updateData: any = {};

    // Update PIN
    if (newPin) {
      if (newPin.length < 4 || newPin.length > 8) {
        return res.status(400).json({ error: 'PIN harus terdiri dari 4-8 digit angka.' });
      }
      updateData.pin = String(newPin);
    }

    // Update Password
    if (newPassword) {
      if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
      }
      if (oldPassword) {
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch && user.pin !== oldPassword) {
          return res.status(400).json({ error: 'Password lama tidak cocok.' });
        }
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Tidak ada data keamanan yang diubah.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, username: true, role: true, employmentType: true, pin: true }
    });

    res.json({ message: 'Keamanan akun berhasil diperbarui', user: updated });
  } catch (error) {
    console.error('Update security error:', error);
    res.status(500).json({ error: 'Gagal memperbarui keamanan akun' });
  }
});

// PUT update current staff profile details
router.put('/me/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama tidak boleh kosong' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { id: true, name: true, username: true, role: true, employmentType: true, pin: true }
    });

    res.json({ message: 'Profil berhasil diperbarui', user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// GET all users (only Admin can view full list)
router.get('/', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        employmentType: true,
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
    const { name, username, password, pin, role, employmentType, permissions, status } = req.body;

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
        employmentType: employmentType || 'FULL_TIME',
        permissions: JSON.stringify(permissions),
        status: status || 'Aktif',
      },
      select: { id: true, name: true, username: true, role: true, employmentType: true }
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
    const { name, username, password, pin, role, employmentType, permissions, status } = req.body;

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

    if (employmentType !== undefined) {
      updateData.employmentType = employmentType;
    }

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    if (pin) {
      updateData.pin = pin;
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: { id: true, name: true, username: true, role: true, employmentType: true }
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
