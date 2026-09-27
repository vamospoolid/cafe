import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';

const router = Router();

// GET /api/bengkel/service-types
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { vehicleType, search, includeInactive } = req.query;

    const where: any = {
      tenantId,
      deletedAt: null
    };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (vehicleType && typeof vehicleType === 'string' && vehicleType !== 'ALL') {
      where.vehicleType = { in: [vehicleType, 'ALL'] };
    }

    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const serviceTypes = await prisma.serviceType.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json(serviceTypes);
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({ error: 'Gagal memuat katalog jasa' });
  }
});

// POST /api/bengkel/service-types
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { name, description, vehicleType, priceRetail, priceMitra, priceGrosir } = req.body;

    if (!name || priceRetail == null) {
      return res.status(400).json({ error: 'Nama jasa dan harga retail wajib diisi' });
    }

    const newService = await prisma.serviceType.create({
      data: {
        tenantId,
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        vehicleType: vehicleType || 'ALL',
        priceRetail: parseFloat(priceRetail),
        priceMitra: priceMitra != null ? parseFloat(priceMitra) : null,
        priceGrosir: priceGrosir != null ? parseFloat(priceGrosir) : null,
        isActive: true
      }
    });

    res.status(201).json(newService);
  } catch (error) {
    console.error('Error creating service type:', error);
    res.status(500).json({ error: 'Gagal menambahkan jenis jasa' });
  }
});

// PATCH /api/bengkel/service-types/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { name, description, vehicleType, priceRetail, priceMitra, priceGrosir, isActive } = req.body;

    // Double validate ownership
    const existing = await prisma.serviceType.findFirst({
      where: { id: String(id), tenantId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Data jasa tidak ditemukan' });
    }

    const updated = await prisma.serviceType.update({
      where: { id: existing.id },
      data: {
        ...(name != null && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(vehicleType != null && { vehicleType }),
        ...(priceRetail != null && { priceRetail: parseFloat(priceRetail) }),
        ...(priceMitra !== undefined && { priceMitra: priceMitra != null ? parseFloat(priceMitra) : null }),
        ...(priceGrosir !== undefined && { priceGrosir: priceGrosir != null ? parseFloat(priceGrosir) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating service type:', error);
    res.status(500).json({ error: 'Gagal memperbarui data jasa' });
  }
});

// DELETE /api/bengkel/service-types/:id (Soft delete)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    // Double validate ownership
    const existing = await prisma.serviceType.findFirst({
      where: { id: String(id), tenantId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Data jasa tidak ditemukan' });
    }

    await prisma.serviceType.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        deletedAt: new Date()
      }
    });

    res.json({ success: true, message: 'Jasa berhasil dinonaktifkan' });
  } catch (error) {
    console.error('Error deleting service type:', error);
    res.status(500).json({ error: 'Gagal menghapus data jasa' });
  }
});

export default router;
