import prisma from '../db';
import { Request, Response, NextFunction } from 'express';
import { featureService } from '../services/FeatureService';
import { TenantContext } from '../utils/tenantContext';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

/**
/**
 * Middleware untuk memvalidasi apakah tenant aktif memiliki hak akses ke fitur tertentu.
 * Pada project POS Cafe (single standalone POS), semua fitur diaktifkan penuh (100% unlocked).
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Seluruh fitur aktif penuh tanpa pembatasan paket SaaS
    return next();
  };
}
