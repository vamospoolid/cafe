import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { PrinterService } from '../services/PrinterService';

const router = Router();
const prisma = new PrismaClient();

// GET /api/printer/status — cek koneksi printer
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    const ip   = settings?.printerIp || '';
    const port = settings?.printerPort || 9100;

    if (!ip) return res.json({ status: 'unconfigured', message: 'IP printer belum dikonfigurasi' });

    await PrinterService.testPrint(ip, port, settings?.storeName || 'SOL CAFE');
    res.json({ status: 'online', ip, port });
  } catch (error: any) {
    res.json({ status: 'offline', message: error.message });
  }
});

// POST /api/printer/test — cetak halaman uji
router.post('/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    const ip   = req.body.ip   || settings?.printerIp || '';
    const port = req.body.port || settings?.printerPort || 9100;

    if (!ip) return res.status(400).json({ error: 'IP printer wajib diisi' });

    await PrinterService.testPrint(ip, Number(port), settings?.storeName || 'SOL CAFE');
    res.json({ message: 'Halaman uji berhasil dicetak' });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak: ${error.message}` });
  }
});

// POST /api/printer/receipt — cetak struk order by ID
router.post('/receipt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const settings = await prisma.settings.findFirst();

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        items: { include: { product: true } },
        table: true,
        user: { select: { name: true } },
        customer: true
      }
    });

    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

    await PrinterService.printReceipt(order, settings);
    res.json({ message: 'Struk berhasil dicetak' });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak: ${error.message}` });
  }
});

export default router;
