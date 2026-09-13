import { Router, Request, Response } from 'express';
const multer = require('multer');
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Pastikan direktori uploads ada
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi penyimpanan Multer
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    // Generate nama file unik: timestamp + ekstensi asli
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Filter jenis file (hanya gambar)
const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (jpg, jpeg, png, gif, webp) yang diperbolehkan!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // Batas 10MB
});

// POST /api/upload - Menerima satu file gambar dengan key 'image'
router.post('/', authenticateToken, (req: Request, res: Response) => {
  upload.single('image')(req as any, res as any, (err: any) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer Error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diunggah' });
    }

    // Mengembalikan URL statis gambar
    const imageUrl = `/uploads/${file.filename}`;
    res.status(200).json({ 
      message: 'Gambar berhasil diunggah',
      imageUrl 
    });
  });
});

export default router;
