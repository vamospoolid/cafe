import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/database/backup - Unduh backup file dev.db secara langsung
router.get('/backup', authenticateToken, (req: Request, res: Response) => {
  try {
    const dbPath = path.join(__dirname, '../../prisma/dev.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'File database dev.db tidak ditemukan' });
    }
    
    // Set headers untuk download file
    res.download(dbPath, `backup-poscafe-${Date.now()}.db`, (err) => {
      if (err) {
        console.error('Gagal mengirim file database:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Gagal mengunduh backup database' });
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan sistem saat backup' });
  }
});

// POST /api/database/restart - Restart server backend (di bawah PM2)
router.post('/restart', authenticateToken, (req: Request, res: Response) => {
  try {
    res.status(200).json({ message: 'Server backend sedang merestart. Halaman akan dimuat ulang beberapa detik lagi...' });
    
    // Delay 1 detik agar respon HTTP sempat dikirim ke klien
    setTimeout(() => {
      console.log('[System] Restart dipicu oleh pengguna. Mematikan proses Node.js...');
      process.exit(0); // PM2 otomatis menghidupkan kembali proses jika exit code 0/1
    }, 1000);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memicu restart server' });
  }
});

export default router;
