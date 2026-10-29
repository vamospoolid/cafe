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

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) }
    });

    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
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
 * POST /api/payments/pos/charge-laundry
 * Menghasilkan Snap Token untuk pesanan Laundry kasir POS (Level 2)
 */
router.post('/pos/charge-laundry', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = TenantContext.getTenantId() || user?.tenantId;
    const { laundryOrderId } = req.body;

    if (!laundryOrderId) {
      return res.status(400).json({ error: 'laundryOrderId wajib diisi' });
    }

    const result = await paymentService.createLaundryTransaction(tenantId, String(laundryOrderId));
    return res.json(result);
  } catch (err: any) {
    console.error('[Payment API /pos/charge-laundry Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses pembayaran Midtrans laundry' });
  }
});

/**
 * POST /api/payments/public/charge-tracking
 * Menghasilkan Snap Token untuk pesanan pelanggan dari halaman Customer Live Tracking (/track/:code)
 */
router.post('/public/charge-tracking', async (req: Request, res: Response) => {
  try {
    const { trackingCode } = req.body;
    if (!trackingCode) {
      return res.status(400).json({ error: 'trackingCode wajib diisi' });
    }

    const cleanCode = String(trackingCode).trim().toUpperCase();

    // 1. Cek di Kafe Order
    const cafeOrder = await prisma.order.findFirst({
      where: { trackingCode: cleanCode }
    });

    if (cafeOrder) {
      const tenantId = cafeOrder.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context tidak valid untuk pesanan ini' });
      }
      const result = await paymentService.createPOSTransaction(tenantId, cafeOrder.id);
      return res.json({
        vertical: 'CAFE',
        ...result
      });
    }

    // 2. Cek di Laundry Order
    const laundryOrder = await prisma.laundryOrder.findFirst({
      where: { trackingCode: cleanCode }
    });

    if (laundryOrder) {
      const tenantId = laundryOrder.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context tidak valid untuk pesanan ini' });
      }
      const result = await paymentService.createLaundryTransaction(tenantId, laundryOrder.id);
      return res.json({
        vertical: 'LAUNDRY',
        ...result
      });
    }

    return res.status(404).json({ error: 'Pesanan tidak ditemukan dengan kode pelacakan tersebut' });
  } catch (err: any) {
    console.error('[Payment API /public/charge-tracking Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses Snap Token pelacakan' });
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
