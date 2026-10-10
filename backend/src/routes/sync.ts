import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import prisma from '../db';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Master secret key yang simetris dengan LicenseManager di Electron
export const MASTER_LICENSE_SALT = 'CODEPOS_STANDALONE_MASTER_SALT_2026_KEY_PRO_SECURE';

interface LicensePayload {
  hardwareId: string;
  vertical: 'BENGKEL' | 'KAFE' | 'RETAIL' | 'LAUNDRY' | 'RENTAL';
  tier: 'PRO' | 'ENTERPRISE';
  storeName?: string;
  ownerName?: string;
  issuedAt: string;
  expiresAt: string | null;
}

/**
 * Helper untuk verifikasi serial key kriptografis
 */
function verifyLicenseKey(licenseKey: string, expectedVertical?: string): { valid: boolean; payload?: LicensePayload; error?: string } {
  try {
    if (!licenseKey || !licenseKey.startsWith('LIC-')) {
      return { valid: false, error: 'Format serial key tidak valid.' };
    }

    const parts = licenseKey.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Struktur serial key tidak valid.' };
    }

    const [headerAndPayload, providedSignature] = parts;
    const payloadBase64 = headerAndPayload.replace(/^LIC-[A-Z]+-/, '');

    const expectedSignature = crypto.createHmac('sha256', MASTER_LICENSE_SALT)
      .update(payloadBase64)
      .digest('hex')
      .substring(0, 32)
      .toUpperCase();

    if (providedSignature.toUpperCase() !== expectedSignature) {
      return { valid: false, error: 'Tanda tangan lisensi tidak cocok (Serial Key palsu atau rusak).' };
    }

    const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload: LicensePayload = JSON.parse(jsonStr);

    if (expectedVertical && payload.vertical.toUpperCase() !== expectedVertical.toUpperCase()) {
      return { valid: false, error: `Lisensi khusus untuk vertikal ${payload.vertical}.` };
    }

    if (payload.expiresAt) {
      if (new Date() > new Date(payload.expiresAt)) {
        return { valid: false, error: 'Masa aktif lisensi telah berakhir.' };
      }
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: `Gagal memverifikasi: ${err.message}` };
  }
}

/**
 * 💓 POST /api/sync/heartbeat
 * Menerima telemetri periodic heartbeat dari aplikasi desktop offline klien saat ada tethering internet
 */
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const { hardwareId, licenseKey, vertical, tenantSlug, version, metrics, dbSnapshot } = req.body;

    if (!hardwareId || !licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'Parameter hardwareId dan licenseKey wajib disertakan.'
      });
    }

    // 1. Verifikasi lisensi klien
    const vertStr = (vertical || 'BENGKEL').toUpperCase();
    const verif = verifyLicenseKey(licenseKey, vertStr);

    if (!verif.valid || !verif.payload) {
      return res.status(403).json({
        success: false,
        error: verif.error || 'Lisensi tidak valid.',
        code: 'INVALID_LICENSE'
      });
    }

    // Pastikan Hardware ID di lisensi cocok dengan payload perangkat
    if (verif.payload.hardwareId !== hardwareId) {
      return res.status(403).json({
        success: false,
        error: 'Hardware ID lisensi tidak cocok dengan perangkat ini.',
        code: 'HARDWARE_MISMATCH'
      });
    }

    // 2. Cari tenant terkait jika ada (opsional)
    const targetSlug = tenantSlug || verif.payload.storeName?.toLowerCase().replace(/\s+/g, '') || 'standalone';
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: targetSlug },
          { id: targetSlug }
        ]
      }
    });

    const tenantId = tenant ? tenant.id : null;
    const totalOrders = Number(metrics?.totalOrders || 0);
    const totalRevenue = Number(metrics?.totalRevenue || 0);
    const lastTx = metrics?.lastTransactionAt || new Date().toISOString();

    // 3. Catat ke Audit Trail Log platform
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'STANDALONE_HEARTBEAT',
          resource: 'OFFLINE_TELEMETRY',
          resourceId: hardwareId,
          description: `Heartbeat dari ${vertStr} (${verif.payload.storeName || 'Toko Beli-Putus'}) - HWID: ${hardwareId}, App: v${version || '1.0'}, Omzet: Rp ${totalRevenue.toLocaleString('id-ID')}, Transaksi: ${totalOrders}`,
          newValue: JSON.stringify({
            hardwareId,
            vertical: vertStr,
            version: version || '1.0',
            metrics: {
              totalOrders,
              totalRevenue,
              lastTransactionAt: lastTx
            },
            hasSnapshot: Boolean(dbSnapshot),
            receivedAt: new Date().toISOString()
          }),
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'CodePOS-Electron-Standalone'
        }
      });
    } catch (auditErr) {
      console.warn('[Heartbeat] Gagal mencatat audit log:', auditErr);
    }

    // 4. Return ACK sukses
    return res.json({
      success: true,
      message: 'Heartbeat telemetri berhasil diterima dan dicatat di cloud.',
      serverTime: new Date().toISOString(),
      gracePeriodDays: 30,
      clientStatus: {
        tier: verif.payload.tier,
        storeName: verif.payload.storeName,
        isLifetime: !verif.payload.expiresAt
      },
      ack: true
    });
  } catch (error: any) {
    console.error('[Heartbeat Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan server saat memproses heartbeat.',
      details: error.message
    });
  }
});

/**
 * 🔑 POST /api/sync/generate-license
 * Endpoint admin SaaS untuk menerbitkan Serial Activation Key berlisensi kriptografis
 */
router.post('/generate-license', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAllowed = user?.role === 'SUPERADMIN' || user?.role === 'OWNER' || user?.isPlatformAdmin;

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Hanya Platform Admin / Owner yang dapat menerbitkan serial lisensi.'
      });
    }

    const { hardwareId, vertical, tier, storeName, ownerName, expiresAt } = req.body;

    if (!hardwareId || !vertical) {
      return res.status(400).json({
        success: false,
        error: 'Parameter hardwareId dan vertical wajib diisi.'
      });
    }

    const payload: LicensePayload = {
      hardwareId: hardwareId.trim().toUpperCase(),
      vertical: vertical.trim().toUpperCase() as any,
      tier: tier === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO',
      storeName: storeName ? String(storeName).trim() : 'Toko Mandiri',
      ownerName: ownerName ? String(ownerName).trim() : 'Pemilik Lisensi',
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    };

    const jsonStr = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', MASTER_LICENSE_SALT)
      .update(payloadBase64)
      .digest('hex')
      .substring(0, 32)
      .toUpperCase();

    const licenseKey = `LIC-${payload.vertical.toUpperCase()}-${payloadBase64}.${signature}`;

    // Catat log penerbitan lisensi
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId || null,
          userId: user.id,
          userName: user.name || user.username,
          userRole: user.role,
          action: 'LICENSE_GENERATED',
          resource: 'LICENSE_KEY',
          resourceId: payload.hardwareId,
          description: `Lisensi diterbitkan untuk HWID ${payload.hardwareId} (${payload.storeName}) Vertikal: ${payload.vertical}`,
          newValue: JSON.stringify({ licenseKey, payload })
        }
      });
    } catch { /* ignore */ }

    return res.json({
      success: true,
      message: 'Serial Activation Key berhasil diterbitkan.',
      licenseKey,
      payload
    });
  } catch (error: any) {
    console.error('[Generate License Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal menerbitkan lisensi.',
      details: error.message
    });
  }
});

/**
 * 🔍 POST /api/sync/verify-license
 * Verifikasi cepat serial key oleh admin / UI
 */
router.post('/verify-license', async (req: Request, res: Response) => {
  const { licenseKey, vertical } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ success: false, error: 'licenseKey wajib diisi.' });
  }

  const result = verifyLicenseKey(licenseKey, vertical);
  if (!result.valid) {
    return res.status(400).json({ success: false, error: result.error });
  }

  return res.json({
    success: true,
    valid: true,
    payload: result.payload
  });
});

export default router;
