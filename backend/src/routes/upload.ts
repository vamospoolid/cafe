import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();

// Base upload directory
const baseUploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

// MIME Type to Safe Extension Mapping
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

/**
 * Sanitizes tenant ID string to prevent Directory / Path Traversal attacks.
 */
export function sanitizeTenantPath(rawTenantId?: string | null): string {
  if (!rawTenantId || typeof rawTenantId !== 'string') {
    return 'default';
  }
  // Hanya izinkan karakter alphanumeric, dash, dan underscore
  const sanitized = rawTenantId.replace(/[^a-zA-Z0-9-_]/g, '').trim();
  return sanitized.length > 0 ? sanitized : 'default';
}

// Multer Storage with Tenant Isolation
const storage = multer.diskStorage({
  destination: (req: any, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    try {
      const tenantId = sanitizeTenantPath(req.tenantId || req.user?.tenantId);
      const tenantDir = path.join(baseUploadDir, 'tenants', tenantId);

      // Pastikan folder tenant dibuat jika belum ada
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }

      cb(null, tenantDir);
    } catch (err: any) {
      cb(err, baseUploadDir);
    }
  },
  filename: (_req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Generate randomized UUID filename untuk mencegah tebakan file dan file-clobbering
    const safeExt = MIME_EXTENSION_MAP[file.mimetype.toLowerCase()] || path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueName);
  }
});

// Strict MIME Type & Extension Filter
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isMimeAllowed = Object.keys(MIME_EXTENSION_MAP).includes(file.mimetype.toLowerCase());
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtAllowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Hanya file gambar (JPG, PNG, WEBP, GIF) yang diizinkan.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maksimal 5MB
    files: 1 // Maksimal 1 file per request
  }
});

// POST /api/upload - Tenant-Isolated Secure File Upload
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  upload.single('image')(req as any, res as any, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran file terlalu besar. Maksimal 5MB.' });
      }
      return res.status(400).json({ error: `Upload Error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah gambar' });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diunggah.' });
    }

    const rawTenantId = (req as any).tenantId || req.user?.tenantId;
    const tenantId = sanitizeTenantPath(rawTenantId);
    // Relative URL path yang aman untuk akses publik/statis
    const imageUrl = `/uploads/tenants/${tenantId}/${file.filename}`;

    // Audit Log: File Upload
    await AuditLogger.log({
      tenantId: rawTenantId,
      action: 'FILE_UPLOAD',
      resource: 'INVENTORY',
      resourceId: file.filename,
      description: `Mengunggah berkas gambar "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB).`,
      newValue: { originalName: file.originalname, size: file.size, mimeType: file.mimetype, path: imageUrl },
      severity: 'INFO'
    }, req);

    res.status(200).json({
      message: 'Gambar berhasil diunggah dengan aman ke penyimpanan terisolasi.',
      imageUrl,
      filename: file.filename,
      sizeBytes: file.size
    });
  });
});

export default router;
