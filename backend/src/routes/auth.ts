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
    const { pin, userId, username } = req.body;
    
    if (!pin) {
      return res.status(400).json({ error: 'PIN wajib diisi.' });
    }

    let user;
    if (userId) {
      user = await prisma.user.findFirst({
        where: { id: Number(userId), pin, status: 'Aktif' }
      });
    } else if (username) {
      user = await prisma.user.findFirst({
        where: { username, pin, status: 'Aktif' }
      });
    } else {
      user = await prisma.user.findFirst({
        where: { pin, status: 'Aktif' }
      });
    }

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

// GET Public Active Staff List for Kiosk 1-Tap Avatar Switcher
router.get('/staff-list', async (req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { status: 'Aktif' },
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(staff);
  } catch (error) {
    console.error('Staff list error:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar staf' });
  }
});

// POST QR / Barcode Badge Login for Zero-Touch Kitchen/Kiosk
router.post('/qr-login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Kode QR / Barcode ID diperlukan.' });
    }

    const cleanCode = String(code).trim();
    
    // Match by ID format (e.g. STAFF-1, ID:1), PIN format, or username
    let user = null;
    if (cleanCode.startsWith('STAFF-') || cleanCode.startsWith('ID-') || cleanCode.startsWith('ID:')) {
      const parsedId = Number(cleanCode.replace(/^(STAFF-|ID-|ID:)/i, ''));
      if (!isNaN(parsedId)) {
        user = await prisma.user.findFirst({
          where: { id: parsedId, status: 'Aktif' }
        });
      }
    } else if (cleanCode.startsWith('PIN-') || cleanCode.startsWith('PIN:')) {
      const parsedPin = cleanCode.replace(/^(PIN-|PIN:)/i, '');
      user = await prisma.user.findFirst({
        where: { pin: parsedPin, status: 'Aktif' }
      });
    } else {
      // Direct PIN or username match
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { pin: cleanCode },
            { username: cleanCode },
            { name: cleanCode }
          ],
          status: 'Aktif'
        }
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Kartu QR ID / Barcode tidak dikenali.' });
    }

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
      message: `Login berhasil via QR Badge (${user.name})`,
      token,
      user: {
        ...safeUser,
        permissions: JSON.parse(user.permissions)
      }
    });

  } catch (error) {
    console.error('QR Login Error:', error);
    res.status(500).json({ error: 'Gagal memproses login QR ID' });
  }
});

export default router;
