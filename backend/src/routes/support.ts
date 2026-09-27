import { Router, Request, Response } from 'express';
import { supportService } from '../services/SupportService';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/support/faq - Public & Authenticated Knowledge Base
router.get('/faq', (_req: Request, res: Response) => {
  try {
    const faqs = supportService.getFAQList();
    return res.json({ success: true, faqs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat daftar FAQ' });
  }
});

// POST /api/support/tickets - Submit a support ticket (open to public visitor & authenticated user)
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      tenantName,
      outletName,
      contactName,
      contactPhone,
      contactEmail,
      category,
      priority,
      subject,
      message,
      deviceInfo
    } = req.body;

    if (!contactName || !contactPhone || !subject || !message) {
      return res.status(400).json({ error: 'Nama kontak, nomor WhatsApp/telepon, judul kendala, dan pesan wajib diisi.' });
    }

    const ticket = await supportService.createTicket({
      tenantId,
      tenantName,
      outletName,
      contactName,
      contactPhone,
      contactEmail,
      category,
      priority,
      subject,
      message,
      deviceInfo
    }, req);

    return res.status(201).json({
      success: true,
      message: 'Tiket bantuan Anda berhasil dibuat. Tim Engineer Codenusa Support akan segera merespons.',
      ticket
    });
  } catch (error: any) {
    console.error('[Support Route /tickets POST Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal mengirimkan tiket bantuan' });
  }
});

// GET /api/support/tickets - List tickets for tenant or platform admin
router.get('/tickets', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const isPlatformAdmin = req.user?.isPlatformAdmin === true || req.user?.role === 'SUPERADMIN';
    const tenantId = req.user?.tenantId || null;

    const tickets = supportService.getAllTickets(tenantId, isPlatformAdmin);
    return res.json({
      success: true,
      tickets
    });
  } catch (error: any) {
    console.error('[Support Route /tickets GET Error]', error);
    return res.status(500).json({ error: 'Gagal memuat tiket bantuan' });
  }
});

// PATCH /api/support/tickets/:id/status - Update ticket status (Platform Admin / Tech Support)
router.patch('/tickets/:id/status', authenticateToken, requirePlatformAdmin, (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;

    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'Status tiket tidak valid' });
    }

    const updated = supportService.updateTicketStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Tiket bantuan tidak ditemukan' });
    }

    return res.json({
      success: true,
      message: `Status tiket diperbarui menjadi '${status}'`,
      ticket: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memperbarui status tiket' });
  }
});

export default router;
