import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middlewares/authMiddleware';
import { paymentService } from '../services/PaymentService';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

/**
 * ─── LEVEL 1: SAAS BILLING ENDPOINTS ───────────────────────────────────────
 */

/**
 * POST /api/payments/saas/create-invoice
 * Membuat invoice tagihan paket langganan SaaS & Snap Token
 */
router.get('/saas/invoices', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId ;

    const invoices = await paymentService.getTenantInvoices(tenantId);
    return res.json(invoices);
  } catch (err: any) {
    console.error('[Payment API /saas/invoices Error]', err);
    return res.status(500).json({ error: 'Gagal memuat riwayat invoice' });
  }
});

router.post('/saas/create-invoice', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId ;
    const { planCode, billingCycle } = req.body;

    if (!planCode) {
      return res.status(400).json({ error: 'planCode wajib dipilih' });
    }

    const result = await paymentService.createSaaSInvoice(tenantId, planCode, billingCycle || 'MONTHLY');
    return res.json(result);
  } catch (err: any) {
    console.error('[Payment API /saas/create-invoice Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal membuat invoice langganan' });
  }
});

/**
 * ─── LEVEL 2: TENANT POS BYOK CONFIGURATION & CHARGE ───────────────────────
 */

/**
 * GET /api/payments/tenant-config
 * Mengambil konfigurasi Midtrans tenant
 */
router.get('/tenant-config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId ;

    const config = await paymentService.getTenantPaymentConfig(tenantId);
    return res.json(config);
  } catch (err: any) {
    console.error('[Payment API /tenant-config Error]', err);
    return res.status(500).json({ error: 'Gagal memuat konfigurasi pembayaran' });
  }
});

/**
 * POST /api/payments/tenant-config
 * Menyimpan konfigurasi Midtrans tenant (BYOK Server Key)
 */
router.post('/tenant-config', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId ;

    const updated = await paymentService.updateTenantPaymentConfig(tenantId, req.body);
    return res.json({
      success: true,
      message: 'Konfigurasi Midtrans tenant berhasil disimpan.',
      config: updated
    });
  } catch (err: any) {
    console.error('[Payment API /tenant-config update Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal menyimpan konfigurasi Midtrans' });
  }
});

/**
 * POST /api/payments/pos/charge-order
 * Menghasilkan Snap Token untuk pesanan kasir POS (Level 2)
 */
router.post('/pos/charge-order', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId ;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId wajib diisi' });
    }

    const result = await paymentService.createPOSTransaction(tenantId, Number(orderId));
    return res.json(result);
  } catch (err: any) {
    console.error('[Payment API /pos/charge-order Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses pembayaran Midtrans kasir' });
  }
});

/**
 * POST /api/payments/public/charge-dinein
 * Menghasilkan Snap Token untuk pesanan meja pelanggan QR Dine-In (Tanpa Token Kasir)
 */
router.post('/public/charge-dinein', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId wajib diisi' });
    }

    const reqTenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || null;
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) }
    });

    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    if (reqTenantId && order.tenantId && reqTenantId !== order.tenantId) {
      return res.status(403).json({ error: 'Pesanan ini tidak sesuai dengan tenant yang diminta' });
    }

    const tenantId = order.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak valid untuk pesanan ini', code: 'MISSING_TENANT_CONTEXT' });
    }
    const result = await paymentService.createPOSTransaction(tenantId, Number(orderId));
    return res.json(result);
  } catch (err: any) {
    console.error('[Payment API /public/charge-dinein Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses pembayaran QRIS pesanan meja' });
  }
});

/**
 * ─── UNIVERSAL WEBHOOK RECEIVER (NO AUTH MIDDLEWARE) ───────────────────────
 */
router.post('/midtrans/webhook', async (req: Request, res: Response) => {
  try {
    const result = await paymentService.handleWebhook(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Payment API /midtrans/webhook Error]', err);
    return res.status(400).json({ error: err.message || 'Webhook processing failed' });
  }
});

export default router;
