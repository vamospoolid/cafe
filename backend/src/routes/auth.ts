import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password wajib diisi.' });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: 'Username tidak ditemukan.' });
    }

    if (user.status !== 'Aktif') {
      return res.status(403).json({ error: 'Akun ini dinonaktifkan.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Password salah.' });
    }

    // Buat JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        permissions: JSON.parse(user.permissions)
      }, 
      JWT_SECRET, 
      { expiresIn: '1d' }
    );

    // Jangan kirim password hash ke frontend
    const { passwordHash, ...safeUser } = user;

    res.status(200).json({
      message: 'Login Berhasil',
      token,
      user: {
        ...safeUser,
        permissions: JSON.parse(user.permissions) // Parse back to object for frontend
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

router.post('/switch-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    
    if (!pin) {
      return res.status(400).json({ error: 'PIN wajib diisi.' });
    }

    const user = await prisma.user.findFirst({
      where: { pin, status: 'Aktif' }
    });

    if (!user) {
      return res.status(401).json({ error: 'PIN salah atau pengguna tidak aktif.' });
    }

    // Buat JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        permissions: JSON.parse(user.permissions)
      }, 
      JWT_SECRET, 
      { expiresIn: '1d' }
    );

    const { passwordHash, ...safeUser } = user;

    res.status(200).json({
      message: 'Berhasil beralih kasir',
      token,
      user: {
        ...safeUser,
        permissions: JSON.parse(user.permissions)
      }
    });

  } catch (error) {
    console.error('Switch PIN Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

export default router;
