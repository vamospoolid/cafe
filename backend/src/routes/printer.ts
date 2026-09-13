import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { PrinterService } from '../services/PrinterService';

const router = Router();
const prisma = new PrismaClient();

// Helper to load complete order with product categories
const getFullOrder = async (orderId: number) => {
  return await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: {
      items: {
        include: {
          product: {
            include: { category: true }
          }
        }
      },
      table: true,
      user: { select: { name: true, username: true } },
      customer: true
    }
  });
};

// GET /api/printer/status — cek koneksi printer kasir
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    const ip   = settings?.printerIp || '';
    const port = settings?.printerPort || 9100;

    if (!ip) return res.json({ status: 'unconfigured', message: 'IP printer belum dikonfigurasi' });

    await PrinterService.testPrint(ip, port, settings?.storeName || 'SOL CAFE', 'KASIR');
    res.json({ status: 'online', ip, port });
  } catch (error: any) {
    res.json({ status: 'offline', message: error.message });
  }
});

// POST /api/printer/test — cetak halaman uji (bisa untuk Kasir, Dapur, atau Bar)
router.post('/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findFirst();
    const roleName = req.body.roleName || 'PRINTER';
    let ip   = req.body.ip;
    let port = req.body.port;

    if (!ip) {
      if (roleName === 'DAPUR') {
        ip = settings?.kitchenPrinterIp || settings?.printerIp;
        port = settings?.kitchenPrinterPort || settings?.printerPort || 9100;
      } else if (roleName === 'BAR') {
        ip = settings?.barPrinterIp || settings?.printerIp;
        port = settings?.barPrinterPort || settings?.printerPort || 9100;
      } else {
        ip = settings?.printerIp || '';
        port = settings?.printerPort || 9100;
      }
    }

    if (!ip) return res.status(400).json({ error: `IP printer ${roleName} wajib diisi` });

    await PrinterService.testPrint(ip, Number(port || 9100), settings?.storeName || 'SOL CAFE', roleName);
    res.json({ message: `Halaman uji printer ${roleName} berhasil dicetak!` });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak: ${error.message}` });
  }
});

// POST /api/printer/receipt — cetak struk kasir
router.post('/receipt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const settings = await prisma.settings.findFirst();
    const order = await getFullOrder(Number(orderId));

    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

    await PrinterService.printReceipt(order, settings);
    res.json({ message: 'Struk kasir berhasil dicetak' });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak: ${error.message}` });
  }
});

// POST /api/printer/kitchen — cetak tiket pesanan dapur (makanan)
router.post('/kitchen', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const settings = await prisma.settings.findFirst();
    const order = await getFullOrder(Number(orderId));

    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

    await PrinterService.printKitchenTicket(order, settings);
    res.json({ message: 'Tiket pesanan dapur berhasil dicetak' });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak ke dapur: ${error.message}` });
  }
});

// POST /api/printer/bar — cetak tiket pesanan bar (minuman)
router.post('/bar', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const settings = await prisma.settings.findFirst();
    const order = await getFullOrder(Number(orderId));

    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

    await PrinterService.printBarTicket(order, settings);
    res.json({ message: 'Tiket pesanan bar berhasil dicetak' });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak ke bar: ${error.message}` });
  }
});

// POST /api/printer/all — cetak struk kasir, tiket dapur, & tiket bar sekaligus
router.post('/all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const settings = await prisma.settings.findFirst();
    const order = await getFullOrder(Number(orderId));

    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

    const result = await PrinterService.printAllSplitTickets(order, settings);
    res.json({ message: 'Permintaan cetak multi-printer diproses', result });
  } catch (error: any) {
    res.status(500).json({ error: `Gagal mencetak: ${error.message}` });
  }
});

export default router;
