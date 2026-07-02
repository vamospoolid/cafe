import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: any;
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // Token usually comes as: Bearer [token]
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Akses Ditolak: Token tidak ditemukan.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as any;
    
    // Cek apakah user masih ada di database (mencegah error Foreign Key jika DB reset)
    const userExists = await prisma.user.findUnique({ where: { id: verified.id } });
    if (!userExists) {
      return res.status(401).json({ error: 'Sesi tidak valid: Pengguna tidak ditemukan (mungkin DB telah direset).' });
    }

    req.user = verified;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

// Middleware untuk membatasi akses khusus Admin
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Akses Ditolak: Fitur ini hanya untuk Admin.' });
  }
  next();
};
