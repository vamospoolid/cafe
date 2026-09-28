import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';

const router = Router();

// GET /api/bengkel/vehicles
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { search, customerId, vehicleType } = req.query;

    const where: any = { tenantId };

    if (customerId) {
      where.customerId = parseInt(String(customerId), 10);
    }

    if (vehicleType && typeof vehicleType === 'string') {
      where.vehicleType = vehicleType;
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      where.OR = [
        { plateNumber: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            priceTier: true
          }
        },
        _count: {
          select: { workOrders: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });

    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Gagal memuat data kendaraan' });
  }
});

// POST /api/bengkel/vehicles
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { customerId, plateNumber, brand, model, vehicleType, year, color, vin, notes } = req.body;

    if (!plateNumber) {
      return res.status(400).json({ error: 'Nomor plat kendaraan wajib diisi' });
    }

    const cleanPlate = String(plateNumber).trim().toUpperCase();

    // Check customer ownership if provided
    let verifiedCustomerId: number | null = null;
    if (customerId) {
      const custIdNum = parseInt(String(customerId), 10);
      const cust = await prisma.customer.findFirst({
        where: { id: custIdNum, tenantId }
      });
      if (cust) {
        verifiedCustomerId = cust.id;
      }
    }

    // Upsert or create vehicle per tenant
    const vehicle = await prisma.vehicle.upsert({
      where: {
        tenantId_plateNumber: {
          tenantId,
          plateNumber: cleanPlate
        }
      },
      update: {
        ...(verifiedCustomerId && { customerId: verifiedCustomerId }),
        ...(brand && { brand: String(brand).trim() }),
        ...(model && { model: String(model).trim() }),
        ...(vehicleType && { vehicleType }),
        ...(year && { year: parseInt(String(year), 10) }),
        ...(color && { color: String(color).trim() }),
        ...(vin && { vin: String(vin).trim() }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null })
      },
      create: {
        tenantId,
        customerId: verifiedCustomerId,
        plateNumber: cleanPlate,
        brand: brand ? String(brand).trim() : '',
        model: model ? String(model).trim() : '',
        vehicleType: vehicleType || 'MOTOR',
        year: year ? parseInt(String(year), 10) : null,
        color: color ? String(color).trim() : null,
        vin: vin ? String(vin).trim() : null,
        notes: notes ? String(notes).trim() : null
      },
      include: {
        customer: true
      }
    });

    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error saving vehicle:', error);
    res.status(500).json({ error: 'Gagal menyimpan data kendaraan' });
  }
});

// PATCH /api/bengkel/vehicles/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { customerId, plateNumber, brand, model, vehicleType, year, color, vin, notes } = req.body;

    // Double validate ownership
    const existing = await prisma.vehicle.findFirst({
      where: { id: String(id), tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    let verifiedCustomerId = existing.customerId;
    if (customerId !== undefined) {
      if (customerId === null) {
        verifiedCustomerId = null;
      } else {
        const custIdNum = parseInt(String(customerId), 10);
        const cust = await prisma.customer.findFirst({
          where: { id: custIdNum, tenantId }
        });
        if (cust) verifiedCustomerId = cust.id;
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        customerId: verifiedCustomerId,
        ...(plateNumber && { plateNumber: String(plateNumber).trim().toUpperCase() }),
        ...(brand !== undefined && { brand: String(brand).trim() }),
        ...(model !== undefined && { model: String(model).trim() }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(year !== undefined && { year: year ? parseInt(String(year), 10) : null }),
        ...(color !== undefined && { color: color ? String(color).trim() : null }),
        ...(vin !== undefined && { vin: vin ? String(vin).trim() : null }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null })
      },
      include: {
        customer: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Gagal memperbarui data kendaraan' });
  }
});

// GET /api/bengkel/vehicles/history/:plate (Riwayat servis per plat nomor)
router.get('/history/:plate', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const cleanPlate = decodeURIComponent(String(req.params.plate)).trim().toUpperCase();

    const vehicle = await prisma.vehicle.findFirst({
      where: { tenantId, plateNumber: cleanPlate },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, priceTier: true }
        }
      }
    });

    const workOrders = await prisma.workOrder.findMany({
      where: {
        tenantId,
        vehiclePlate: cleanPlate
      },
      include: {
        services: {
          include: {
            serviceType: true
          }
        },
        parts: {
          include: {
            product: { select: { id: true, name: true, barcode: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      vehicle: vehicle || { plateNumber: cleanPlate },
      totalVisits: workOrders.length,
      history: workOrders
    });
  } catch (error) {
    console.error('Error fetching vehicle history:', error);
    res.status(500).json({ error: 'Gagal memuat riwayat servis kendaraan' });
  }
});

export default router;
