import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { cacheService } from '../services/CacheService';
import { featureService } from '../services/FeatureService';
import { emitToTenant } from '../index';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

// In-memory brute force tracker (fallback if redis not present)
const failedAttemptsMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);
  if (!record) return true;

  if (now > record.resetAt) {
    failedAttemptsMap.delete(ip);
    return true;
  }

  return record.count < 5;
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);
  if (!record || now > record.resetAt) {
    failedAttemptsMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 mins
  } else {
    record.count += 1;
  }
}

function resetFailedAttempts(ip: string) {
  failedAttemptsMap.delete(ip);
}

// Development & Test fixture to reset rate-limit between test runs
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  router.post('/reset-rate-limit', (_req: Request, res: Response) => {
    failedAttemptsMap.clear();
    res.json({ success: true, message: 'Rate limits cleared' });
  });
}

/**
 * Generate 6-digit alphanumeric pairing code (e.g. "TAB-8921")
 */
function generatePairingCode(): string {
  const randomChars = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  return `TAB-${randomChars}`;
}

// ─── POST /api/devices/generate-code: Owner/Admin generates pairing code for tablet ───
router.post('/generate-code', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    const { outletId } = req.body;
    const targetOutletId = outletId || user?.outletId;

    const code = generatePairingCode();
    const cacheKey = `device:pairing_code:${code}`;
    const ttlSeconds = 600; // 10 minutes

    const payload = {
      tenantId,
      outletId: targetOutletId,
      createdByUserId: user.id,
      createdAt: Date.now()
    };

    await cacheService.set(cacheKey, payload, ttlSeconds);

    res.json({
      success: true,
      code,
      expiresInSeconds: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    });
  } catch (error: any) {
    console.error('[DevicePairing] Error generating code:', error);
    res.status(500).json({ error: error.message || 'Gagal menghasilkan kode pairing perangkat' });
  }
});

// ─── POST /api/devices/pair: Tablet activates itself using 6-char pairing code ───
router.post('/pair', async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Terlalu banyak percobaan aktivasi yang gagal. Silakan coba kembali dalam 15 menit.',
      code: 'TOO_MANY_ATTEMPTS'
    });
  }

  try {
    const { pairingCode, deviceName, appVersion } = req.body;

    if (!pairingCode || typeof pairingCode !== 'string') {
      return res.status(400).json({ error: 'Kode aktivasi wajib diisi.', code: 'INVALID_PAIRING_CODE' });
    }

    const cleanCode = pairingCode.trim().toUpperCase();
    const cacheKey = `device:pairing_code:${cleanCode}`;

    const pairingData: any = await cacheService.get(cacheKey);

    if (!pairingData || !pairingData.tenantId) {
      recordFailedAttempt(clientIp);
      return res.status(400).json({
        error: 'Kode aktivasi tidak valid atau telah kedaluwarsa (Maksimal 10 menit).',
        code: 'INVALID_OR_EXPIRED_CODE'
      });
    }

    // Atomic One-Time Burn: delete code immediately to prevent replay
    await cacheService.del(cacheKey);
    resetFailedAttempts(clientIp);

    const { tenantId, outletId, createdByUserId } = pairingData;

    // Verify Tenant Status
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan.', code: 'TENANT_NOT_FOUND' });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(403).json({
        error: `Akses ditolak: Status toko saat ini adalah ${tenant.status}. Silakan hubungi admin.`,
        code: 'TENANT_INACTIVE'
      });
    }

    // Resolve Outlet
    let outlet: any = null;
    if (outletId) {
      outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    }
    if (!outlet) {
      outlet = await prisma.outlet.findFirst({ where: { tenantId } });
    }

    // Resolve Cashier User
    let targetUser = createdByUserId ? await prisma.user.findUnique({ where: { id: createdByUserId } }) : null;
    if (!targetUser || targetUser.status !== 'Aktif') {
      targetUser = await prisma.user.findFirst({
        where: {
          status: 'Aktif',
          memberships: { some: { tenantId } }
        }
      });
    }

    if (!targetUser) {
      return res.status(400).json({
        error: 'Tidak ditemukan akun aktif untuk mengoperasikan kasir tablet.',
        code: 'NO_ACTIVE_USER'
      });
    }

    // Fetch Tenant Settings & Features
    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const features = await featureService.getTenantFeatures(tenantId);

    // Issue Long-Lived Tablet Token (30 Days)
    const token = jwt.sign(
      {
        id: targetUser.id,
        username: targetUser.username,
        tenantId,
        outletId: outlet?.id || outletId,
        role: targetUser.role || 'Kasir',
        isDevice: true,
        deviceName: deviceName || 'Tablet Kasir',
        appVersion: appVersion || '1.0.0',
        pairedAt: new Date().toISOString()
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      },
      outlet: outlet ? { id: outlet.id, name: outlet.name, code: outlet.code } : null,
      settings: {
        storeName: settings?.storeName || tenant.name,
        logoUrl: settings?.logoUrl || null,
        address: settings?.address || null,
        phone: settings?.phone || null,
        receiptFooter: settings?.receiptFooter || null,
        taxPercentage: Number(settings?.taxRate) || 0,
        servicePercentage: Number(settings?.serviceCharge) || 0,
        primaryColor: settings?.primaryColor || '#4f46e5',
        accentColor: settings?.accentColor || '#f59e0b',
        paperWidth: settings?.receiptPaperSize || '58mm'
      },
      features,
      device: {
        id: targetUser.id,
        name: deviceName || 'Tablet Kasir',
        role: targetUser.role || 'Kasir',
        tenantId,
        outletId: outlet?.id || outletId
      },
      user: {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        role: targetUser.role
      }
    });
  } catch (error: any) {
    console.error('[DevicePairing] Error pairing tablet:', error);
    res.status(500).json({ error: error.message || 'Gagal mengaktivasi tablet kasir' });
  }
});

// ─── POST /api/devices/unpair: Deactivate tablet and wipe its local storage ───
router.post('/unpair', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const tenantId = user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    const { deviceId } = req.body;

    // Broadcast device deactivation event to wipe tablet storage locally
    emitToTenant(tenantId, 'device:deactivated', {
      deviceId,
      unpairedByUserId: user.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Perangkat berhasil dinonaktifkan.'
    });
  } catch (error: any) {
    console.error('[DevicePairing] Error unpairing tablet:', error);
    res.status(500).json({ error: error.message || 'Gagal menonaktifkan perangkat' });
  }
});

export default router;
