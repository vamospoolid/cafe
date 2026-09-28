import prisma from '../db';
import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// Router-level fail-closed guard: all voucher operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: AuthRequest, res: Response, next) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context tidak tersedia. Silakan login ulang.', 
      code: 'MISSING_TENANT_CONTEXT' 
    });
  }
  next();
});

// ─── GET /api/vouchers : Ambil semua voucher promo tenant ───────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { status } = req.query;

    const where: any = { tenantId };
    if (status) {
      where.status = String(status);
    }

    const vouchers = await prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(vouchers);
  } catch (error: any) {
    console.error('Fetch Vouchers Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data voucher promo' });
  }
});

// ─── POST /api/vouchers/validate : Validasi kode voucher untuk kasir ─────────
router.post('/validate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { code, subtotal } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, message: 'Kode voucher harus diisi' });
    }

    const cleanCode = code.trim().toUpperCase();
    const currentSubtotal = Number(subtotal) || 0;

    const voucher = await prisma.voucher.findFirst({
      where: {
        tenantId,
        code: cleanCode
      }
    });

    if (!voucher) {
      return res.status(404).json({ valid: false, message: `Voucher "${cleanCode}" tidak ditemukan` });
    }

    if (voucher.status !== 'Aktif') {
      return res.status(400).json({ valid: false, message: `Voucher "${cleanCode}" sudah tidak aktif` });
    }

    const now = new Date();
    if (voucher.validFrom && new Date(voucher.validFrom) > now) {
      return res.status(400).json({ valid: false, message: `Voucher "${cleanCode}" belum berlaku` });
    }

    if (voucher.validUntil && new Date(voucher.validUntil) < now) {
      return res.status(400).json({ valid: false, message: `Voucher "${cleanCode}" telah kadaluarsa` });
    }

    if (voucher.maxUsage && voucher.usedCount >= voucher.maxUsage) {
      return res.status(400).json({ valid: false, message: `Kuota penggunaan voucher "${cleanCode}" telah habis` });
    }

    if (currentSubtotal < voucher.minSpend) {
      return res.status(400).json({
        valid: false,
        message: `Minimal belanja untuk voucher ini adalah Rp ${voucher.minSpend.toLocaleString('id-ID')}`
      });
    }

    // Hitung potongan diskon
    let discountAmount = 0;
    if (voucher.type === 'PERCENT') {
      discountAmount = (currentSubtotal * voucher.amount) / 100;
      if (voucher.maxDiscount && voucher.maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, voucher.maxDiscount);
      }
    } else {
      // FIXED nominal
      discountAmount = Math.min(voucher.amount, currentSubtotal);
    }

    // Pastikan tidak negatif dan tidak melebihi subtotal
    discountAmount = Math.max(0, Math.min(discountAmount, currentSubtotal));

    res.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        description: voucher.description,
        type: voucher.type,
        amount: voucher.amount,
        minSpend: voucher.minSpend,
        maxDiscount: voucher.maxDiscount
      },
      discountAmount
    });
  } catch (error: any) {
    console.error('Validate Voucher Error:', error);
    res.status(500).json({ valid: false, message: 'Gagal memvalidasi kode voucher' });
  }
});

// ─── POST /api/vouchers : Buat voucher baru ─────────────────────────────────
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const {
      code,
      description,
      type = 'PERCENT',
      amount,
      minSpend = 0,
      maxDiscount,
      validFrom,
      validUntil,
      maxUsage,
      status = 'Aktif'
    } = req.body;

    if (!code || !amount) {
      return res.status(400).json({ error: 'Kode voucher dan nominal diskon wajib diisi' });
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Cek duplikasi
    const existing = await prisma.voucher.findFirst({
      where: { tenantId, code: cleanCode }
    });

    if (existing) {
      return res.status(400).json({ error: `Kode voucher "${cleanCode}" sudah digunakan` });
    }

    const voucher = await prisma.voucher.create({
      data: {
        tenantId,
        code: cleanCode,
        description: description ? String(description).trim() : null,
        type: type === 'FIXED' ? 'FIXED' : 'PERCENT',
        amount: Number(amount),
        minSpend: Number(minSpend) || 0,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        maxUsage: maxUsage ? Number(maxUsage) : null,
        status: status === 'Nonaktif' ? 'Nonaktif' : 'Aktif'
      }
    });

    res.status(201).json(voucher);
  } catch (error: any) {
    console.error('Create Voucher Error:', error);
    res.status(500).json({ error: 'Gagal membuat voucher baru' });
  }
});

// ─── PUT /api/vouchers/:id : Update voucher ─────────────────────────────────
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const {
      description,
      type,
      amount,
      minSpend,
      maxDiscount,
      validFrom,
      validUntil,
      maxUsage,
      status
    } = req.body;

    const voucher = await prisma.voucher.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher tidak ditemukan' });
    }

    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type === 'FIXED' ? 'FIXED' : 'PERCENT';
    if (amount !== undefined) updateData.amount = Number(amount);
    if (minSpend !== undefined) updateData.minSpend = Number(minSpend);
    if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount ? Number(maxDiscount) : null;
    if (validFrom !== undefined) updateData.validFrom = validFrom ? new Date(validFrom) : new Date();
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (maxUsage !== undefined) updateData.maxUsage = maxUsage ? Number(maxUsage) : null;
    if (status !== undefined) updateData.status = status;

    // Anti-IDOR: gunakan updateMany dengan { id, tenantId } bukan update dengan { id } saja
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const updateResult = await prisma.voucher.updateMany({
      where: { id: Number(id), tenantId },
      data: updateData
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Voucher tidak ditemukan atau akses ditolak.' });
    }

    const updated = await prisma.voucher.findFirst({ where: { id: Number(id), tenantId } });
    res.json(updated);
  } catch (error: any) {
    console.error('Update Voucher Error:', error);
    res.status(500).json({ error: 'Gagal memperbarui voucher' });
  }
});

// ─── DELETE /api/vouchers/:id : Hapus voucher ───────────────────────────────
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    const voucher = await prisma.voucher.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Voucher tidak ditemukan' });
    }

    // Anti-IDOR: gunakan deleteMany dengan { id, tenantId } bukan delete dengan { id } saja
    const deleteResult = await prisma.voucher.deleteMany({
      where: { id: Number(id), tenantId }
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Voucher tidak ditemukan atau akses ditolak.' });
    }

    res.json({ message: 'Voucher berhasil dihapus' });
  } catch (error: any) {
    console.error('Delete Voucher Error:', error);
    res.status(500).json({ error: 'Gagal menghapus voucher' });
  }
});

export default router;
