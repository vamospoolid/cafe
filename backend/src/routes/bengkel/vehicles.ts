import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { WANotifService } from '../../services/WANotifService';

const router = Router();

// GET /api/bengkel/vehicles
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { search, customerId, vehicleType, oilDue } = req.query;

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
        },
        workOrders: {
          where: { status: { notIn: ['CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            spkNumber: true,
            status: true,
            createdAt: true,
            odometer: true,
            totalAmount: true,
            parts: {
              select: { partName: true }
            },
            services: {
              select: { serviceName: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });

    const now = Date.now();
    const processed = vehicles.map(v => {
      const lastWO = v.workOrders?.[0] || null;
      const lastServiceDate = lastWO ? lastWO.createdAt : null;
      let daysSinceLastService: number | null = null;
      if (lastServiceDate) {
        daysSinceLastService = Math.max(0, Math.floor((now - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Default interval 2 bulan (60 hari) & 3 bulan (90 hari)
      const isDue2Months = daysSinceLastService !== null && daysSinceLastService >= 60;
      const isDue3Months = daysSinceLastService !== null && daysSinceLastService >= 90;
      const isDueSoon2Months = daysSinceLastService !== null && daysSinceLastService >= 45 && daysSinceLastService < 60;
      const isDueSoon3Months = daysSinceLastService !== null && daysSinceLastService >= 75 && daysSinceLastService < 90;

      let oilStatus: 'OVERDUE' | 'DUE_SOON' | 'SAFE' | 'NO_SERVICE' = 'NO_SERVICE';
      if (daysSinceLastService !== null) {
        if (daysSinceLastService >= 60) oilStatus = 'OVERDUE';
        else if (daysSinceLastService >= 45) oilStatus = 'DUE_SOON';
        else oilStatus = 'SAFE';
      }

      let custPhone = v.customer?.phone || '';
      if (custPhone.startsWith('WALKIN-')) custPhone = '';

      // Find last oil sparepart if any
      const lastOilPart = lastWO?.parts?.find((p: any) => /oli|oil|mpx|castrol|yamalube|shell|motul|federal/i.test(p.partName))?.partName || null;

      return {
        ...v,
        customer: v.customer ? { ...v.customer, phone: custPhone } : null,
        lastService: lastWO ? {
          spkNumber: lastWO.spkNumber,
          date: lastWO.createdAt,
          km: lastWO.odometer || null,
          totalAmount: lastWO.totalAmount,
          oilPart: lastOilPart
        } : null,
        oilReminder: {
          daysSince: daysSinceLastService,
          status: oilStatus,
          isDue2Months,
          isDue3Months,
          isDueSoon2Months,
          isDueSoon3Months,
          nextDue2Months: lastServiceDate ? new Date(new Date(lastServiceDate).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString() : null,
          nextDue3Months: lastServiceDate ? new Date(new Date(lastServiceDate).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : null,
          lastOilPart
        }
      };
    });

    if (oilDue === 'true' || oilDue === '2MONTHS') {
      return res.json(processed.filter(p => p.oilReminder.isDue2Months || p.oilReminder.isDueSoon2Months));
    }
    if (oilDue === '3MONTHS') {
      return res.json(processed.filter(p => p.oilReminder.isDue3Months || p.oilReminder.isDueSoon3Months));
    }

    res.json(processed);
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
        customer: {
          select: { id: true, name: true, phone: true, priceTier: true }
        },
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

    let resolvedVehicle: any = vehicle ? { ...vehicle } : null;
    const latestWO = workOrders.length > 0 ? workOrders[0] : null;

    if (!resolvedVehicle) {
      resolvedVehicle = {
        id: null,
        plateNumber: cleanPlate,
        brand: latestWO?.vehicleBrand || '',
        model: latestWO?.vehicleModel || '',
        vehicleType: latestWO?.vehicleType || 'MOTOR',
        customer: latestWO?.customer || null
      };
    } else {
      if (!resolvedVehicle.brand && latestWO?.vehicleBrand) {
        resolvedVehicle.brand = latestWO.vehicleBrand;
      }
      if (!resolvedVehicle.model && latestWO?.vehicleModel) {
        resolvedVehicle.model = latestWO.vehicleModel;
      }
      if (!resolvedVehicle.customer && latestWO?.customer) {
        resolvedVehicle.customer = latestWO.customer;
      }
    }

    if (resolvedVehicle?.customer?.phone && resolvedVehicle.customer.phone.startsWith('WALKIN-')) {
      resolvedVehicle.customer.phone = '';
    }

    // Compute oil reminder for selected vehicle history
    const lastServiceDate = latestWO ? latestWO.createdAt : null;
    let daysSinceLastService: number | null = null;
    if (lastServiceDate) {
      daysSinceLastService = Math.max(0, Math.floor((Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)));
    }

    let oilStatus: 'OVERDUE' | 'DUE_SOON' | 'SAFE' | 'NO_SERVICE' = 'NO_SERVICE';
    if (daysSinceLastService !== null) {
      if (daysSinceLastService >= 60) oilStatus = 'OVERDUE';
      else if (daysSinceLastService >= 45) oilStatus = 'DUE_SOON';
      else oilStatus = 'SAFE';
    }

    const lastOilPart = latestWO?.parts?.find((p: any) => /oli|oil|mpx|castrol|yamalube|shell|motul|federal/i.test(p.product?.name || p.partName))?.product?.name || null;

    if (resolvedVehicle) {
      resolvedVehicle.oilReminder = {
        daysSince: daysSinceLastService,
        status: oilStatus,
        isDue2Months: daysSinceLastService !== null && daysSinceLastService >= 60,
        isDue3Months: daysSinceLastService !== null && daysSinceLastService >= 90,
        isDueSoon2Months: daysSinceLastService !== null && daysSinceLastService >= 45 && daysSinceLastService < 60,
        isDueSoon3Months: daysSinceLastService !== null && daysSinceLastService >= 75 && daysSinceLastService < 90,
        nextDue2Months: lastServiceDate ? new Date(new Date(lastServiceDate).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString() : null,
        nextDue3Months: lastServiceDate ? new Date(new Date(lastServiceDate).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : null,
        lastOilPart
      };
    }

    res.json({
      vehicle: resolvedVehicle,
      totalVisits: workOrders.length,
      history: workOrders
    });
  } catch (error) {
    console.error('Error fetching vehicle history:', error);
    res.status(500).json({ error: 'Gagal memuat riwayat servis kendaraan' });
  }
});

// POST /api/bengkel/vehicles/send-oil-reminder (Kirim pengingat ganti oli ke WA)
router.post('/send-oil-reminder', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { vehiclePlate, intervalMonths = 2, customerName, customerPhone, customMessage } = req.body;

    if (!vehiclePlate) {
      return res.status(400).json({ error: 'Plat nomor kendaraan wajib diisi' });
    }

    const cleanPlate = String(vehiclePlate).trim().toUpperCase();

    // Cari kendaraan & servis terakhir
    const vehicle = await prisma.vehicle.findFirst({
      where: { tenantId, plateNumber: cleanPlate },
      include: {
        customer: true,
        workOrders: {
          where: { status: { notIn: ['CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const finalCustName = customerName || vehicle?.customer?.name || 'Pelanggan';
    let finalCustPhone = customerPhone || vehicle?.customer?.phone || '';
    if (finalCustPhone.startsWith('WALKIN-')) finalCustPhone = '';

    const lastWO = vehicle?.workOrders?.[0] || null;
    const lastDate = lastWO ? lastWO.createdAt.toISOString() : new Date().toISOString();

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });
    const bengkelName = tenant?.name || 'Bengkel Kami';
    const vehicleDesc = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ');

    const formattedLastDate = new Date(lastDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const defaultMsg = `Halo Kak *${finalCustName}*, salam dari *${bengkelName}*! 🙏\n\n` +
      `Kami ingin menginfokan bahwa kendaraan Anda dengan Plat Nomor *${cleanPlate}*${vehicleDesc ? ` (${vehicleDesc})` : ''} sudah waktunya untuk *Ganti Oli & Servis Berkala* nih. 🛵💨\n\n` +
      `📋 *Catatan Servis Sebelumnya*:\n` +
      `• Servis Terakhir: *${formattedLastDate}*\n` +
      `• Rekomendasi Siklus: Rutin setiap *${intervalMonths} Bulan*\n\n` +
      `Ganti oli tepat waktu menjaga performa mesin tetap prima, tarikan enteng, dan konsumsi bensin lebih hemat.\n\n` +
      `Yuk mampir ke *${bengkelName}* untuk servis dan ganti oli berkualitas! Kakak bisa balas pesan ini untuk reservasi antrean ya. Terima kasih! 🙏`;

    const finalMsg = customMessage || defaultMsg;

    let cleanDigits = finalCustPhone.replace(/[^0-9]/g, '');
    if (cleanDigits.startsWith('0')) cleanDigits = '62' + cleanDigits.slice(1);

    const waLink = cleanDigits
      ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(finalMsg)}`
      : null;

    let gatewayResult = { success: false, message: finalMsg };
    if (cleanDigits) {
      gatewayResult = await WANotifService.sendOilReminder({
        tenantId,
        customerName: finalCustName,
        customerPhone: finalCustPhone,
        vehiclePlate: cleanPlate,
        vehicleBrand: vehicle?.brand,
        vehicleModel: vehicle?.model,
        lastServiceDate: lastDate,
        intervalMonths: Number(intervalMonths) || 2,
        customMessage: finalMsg
      });
    }

    res.json({
      success: true,
      message: finalMsg,
      phone: finalCustPhone,
      cleanPhone: cleanDigits,
      waLink,
      gatewaySent: gatewayResult.success
    });
  } catch (error: any) {
    console.error('Error sending oil reminder:', error);
    res.status(500).json({ error: error.message || 'Gagal mengirim pengingat ganti oli' });
  }
});

export default router;
