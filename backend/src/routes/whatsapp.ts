import { Router, Request, Response } from 'express';
import prisma from '../db';
import { authenticateToken } from '../middlewares/authMiddleware';
import { requireFeature } from '../middlewares/featureMiddleware';
import { TenantContext } from '../utils/tenantContext';
import { whatsAppManager } from '../services/WhatsAppManager';
import { whatsAppTemplateService } from '../services/WhatsAppTemplateService';

const router = Router();

// Middleware autentikasi token, tenant context, dan feature gating
router.use(authenticateToken);
router.use(requireFeature('crm.whatsapp'));

/**
 * GET /api/whatsapp/status
 * Ambil status koneksi, kuota, dan preferensi switch
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const status = await whatsAppManager.getTenantStatus(tenantId);
    return res.json({ success: true, data: status });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error getting status:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/whatsapp/connect
 * Mulai proses koneksi dan hasilkan QR Code
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const qrDataUrl = await whatsAppManager.initSession(tenantId, true);

    return res.json({
      success: true,
      message: 'Proses koneksi dimulai. Silakan scan QR code.',
      qrCode: qrDataUrl
    });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error initiating connection:', error);
    return res.status(500).json({ error: error.message || 'Gagal memulai koneksi WhatsApp' });
  }
});

/**
 * POST /api/whatsapp/disconnect
 * Logout dan putus sesi WhatsApp tenant
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    await whatsAppManager.disconnectSession(tenantId);
    return res.json({ success: true, message: 'WhatsApp berhasil diputus' });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error disconnecting session:', error);
    return res.status(500).json({ error: error.message || 'Gagal memutus WhatsApp' });
  }
});

/**
 * PUT /api/whatsapp/settings
 * Update trigger switches (autoSendReceipt, autoSendReminder)
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const { autoSendReceipt, autoSendReminder } = req.body;

    const updated = await prisma.tenantWhatsAppConfig.upsert({
      where: { tenantId },
      update: {
        ...(autoSendReceipt !== undefined ? { autoSendReceipt: Boolean(autoSendReceipt) } : {}),
        ...(autoSendReminder !== undefined ? { autoSendReminder: Boolean(autoSendReminder) } : {})
      },
      create: {
        tenantId,
        autoSendReceipt: autoSendReceipt !== undefined ? Boolean(autoSendReceipt) : true,
        autoSendReminder: autoSendReminder !== undefined ? Boolean(autoSendReminder) : true,
        isAddonActive: true
      }
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error updating settings:', error);
    return res.status(500).json({ error: error.message || 'Gagal memperbarui pengaturan WhatsApp' });
  }
});

/**
 * GET /api/whatsapp/templates
 * Ambil semua template pesan tenant
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });

    const vertical = tenant?.businessType || 'CAFE';
    const templates = await whatsAppTemplateService.getTemplatesForTenant(tenantId, vertical);

    return res.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error getting templates:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengambil template pesan' });
  }
});

/**
 * PUT /api/whatsapp/templates/:triggerKey
 * Simpan perubahan redaksi template pesan
 */
router.put('/templates/:triggerKey', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const triggerKey = String(req.params.triggerKey);
    const { templateBody, isActive, title } = req.body;

    const existing = await prisma.whatsAppTemplate.findUnique({
      where: {
        tenantId_triggerKey: {
          tenantId,
          triggerKey
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Template tidak ditemukan' });
    }

    const updated = await prisma.whatsAppTemplate.update({
      where: {
        tenantId_triggerKey: {
          tenantId,
          triggerKey
        }
      },
      data: {
        ...(templateBody !== undefined ? { templateBody } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(title !== undefined ? { title } : {})
      }
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error updating template:', error);
    return res.status(500).json({ error: error.message || 'Gagal menyimpan template' });
  }
});

/**
 * POST /api/whatsapp/templates/reset
 * Reset semua template kembali ke standar bawaan vertikal
 */
router.post('/templates/reset', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });

    const vertical = tenant?.businessType || 'CAFE';
    await whatsAppTemplateService.resetTemplatesToDefault(tenantId, vertical);

    const templates = await whatsAppTemplateService.getTemplatesForTenant(tenantId, vertical);
    return res.json({
      success: true,
      message: 'Template berhasil dikembalikan ke standar vertikal',
      data: templates
    });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error resetting templates:', error);
    return res.status(500).json({ error: error.message || 'Gagal mereset template' });
  }
});

/**
 * POST /api/whatsapp/test-send
 * Uji kirim pesan ke nomor tertentu
 */
router.post('/test-send', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const { recipientPhone, message } = req.body;
    if (!recipientPhone || !message) {
      return res.status(400).json({ error: 'Nomor penerima dan pesan wajib diisi' });
    }

    const result = await whatsAppManager.sendMessage(tenantId, recipientPhone, message, {
      triggerKey: 'TEST_MESSAGE'
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Gagal mengirim pesan uji coba' });
    }

    return res.json({
      success: true,
      message: 'Pesan uji coba berhasil dimasukkan ke antrean pengiriman',
      logId: result.logId
    });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error sending test message:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengirim pesan uji coba' });
  }
});

/**
 * GET /api/whatsapp/logs
 * Ambil log riwayat pengiriman pesan tenant
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context is missing' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.whatsAppLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      prisma.whatsAppLog.count({
        where: { tenantId }
      })
    ]);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[WhatsApp Route] Error getting logs:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengambil riwayat pesan' });
  }
});

export default router;
