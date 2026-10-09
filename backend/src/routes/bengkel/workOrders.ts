import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { WANotifService } from '../../services/WANotifService';

const router = Router();

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'DONE', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: ['PAID', 'IN_PROGRESS'],
  PAID: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

// Helper SPK Number: SPK-YYYYMM-0001
async function generateSpkNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `SPK-${ym}-`;
  
  const last = await prisma.workOrder.findFirst({
    where: {
      tenantId,
      spkNumber: { startsWith: prefix }
    },
    orderBy: { spkNumber: 'desc' }
  });

  let seq = 1;
  if (last && last.spkNumber) {
    const parts = last.spkNumber.split('-');
    if (parts.length >= 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Helper Recalculate Totals
async function recalculateWorkOrderTotals(workOrderId: string, tx: any = prisma) {
  const services = await tx.workOrderService.findMany({ where: { workOrderId } });
  const parts = await tx.workOrderPart.findMany({ where: { workOrderId } });

  const totalServices = services.reduce((sum: number, s: any) => sum + s.subtotal, 0);
  const totalParts = parts.reduce((sum: number, p: any) => sum + p.subtotal, 0);

  const wo = await tx.workOrder.findUnique({ where: { id: workOrderId } });
  const discount = wo?.discount || 0;
  const taxAmount = wo?.taxAmount || 0;
  const totalAmount = Math.max(0, totalServices + totalParts - discount + taxAmount);

  return tx.workOrder.update({
    where: { id: workOrderId },
    data: {
      totalServices,
      totalParts,
      totalAmount
    }
  });
}

import { getLocalDateRange, getCustomDateRange } from '../../utils/dateHelper';

// Helper Serializer for WorkOrder response to ensure flattened customer & vehicle fields
export function formatWorkOrderResponse(wo: any) {
  if (!wo) return wo;
  const isWalkInPhone = typeof wo.customer?.phone === 'string' && wo.customer.phone.startsWith('WALKIN-');
  return {
    ...wo,
    customerName: wo.customer?.name || null,
    customerPhone: isWalkInPhone ? null : (wo.customer?.phone || null),
    vehiclePlate: wo.vehiclePlate || wo.vehicle?.plateNumber || null,
    vehicleBrand: wo.vehicleBrand || wo.vehicle?.brand || null,
    vehicleModel: wo.vehicleModel || wo.vehicle?.model || null,
    vehicleType: wo.vehicleType || wo.vehicle?.vehicleType || 'MOTOR',
    currentKm: wo.odometer ?? null
  };
}

// GET /api/bengkel/work-orders
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status, vehiclePlate, search, startDate, endDate, date, boardOnly, tzOffset } = req.query;

    const where: any = { tenantId };

    if (boardOnly === 'true') {
      where.status = { notIn: ['DELIVERED', 'CANCELLED'] };
    } else if (status && typeof status === 'string' && status !== 'ALL' && status !== '') {
      if (status.toUpperCase() === 'PAID') {
        where.status = { in: ['PAID', 'DELIVERED'] };
      } else if (status.toUpperCase() === 'PENDING') {
        where.status = { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'DONE'] };
      } else if (status.toUpperCase() === 'VOID' || status.toUpperCase() === 'CANCELLED') {
        where.status = 'CANCELLED';
      } else {
        where.status = status;
      }
    }

    if (vehiclePlate && typeof vehiclePlate === 'string') {
      where.vehiclePlate = { contains: vehiclePlate.trim().toUpperCase() };
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      where.OR = [
        { spkNumber: { contains: q, mode: 'insensitive' } },
        { vehiclePlate: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
        { mechanicName: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (startDate && endDate) {
      const { startUtc, endUtc } = getCustomDateRange(String(startDate), String(endDate), tzOffset as string);
      where.createdAt = { gte: startUtc, lte: endUtc };
    } else if (startDate || date) {
      const targetDate = String(startDate || date);
      const { startUtc, endUtc } = getLocalDateRange(targetDate, tzOffset as string);
      where.createdAt = { gte: startUtc, lte: endUtc };
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, priceTier: true } },
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
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(workOrders.map(formatWorkOrderResponse));
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ error: 'Gagal memuat daftar SPK' });
  }
});

// GET /api/bengkel/work-orders/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId },
      include: {
        customer: true,
        vehicle: true,
        services: {
          include: {
            serviceType: true
          }
        },
        parts: {
          include: {
            product: true
          }
        },
        returns: {
          include: {
            items: true
          }
        }
      }
    });

    if (!workOrder) {
      return res.status(404).json({ error: 'SPK tidak ditemukan' });
    }

    res.json(formatWorkOrderResponse(workOrder));
  } catch (error) {
    console.error('Error fetching work order detail:', error);
    res.status(500).json({ error: 'Gagal memuat rincian SPK' });
  }
});

// POST /api/bengkel/work-orders
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const outletId = (req as any).outletId;
    const {
      customerId,
      customerName,
      customerPhone,
      vehicleId,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleType,
      currentKm,
      complaint,
      notes,
      priceTier,
      services,
      parts
    } = req.body;

    if (!vehiclePlate) {
      return res.status(400).json({ error: 'Nomor plat kendaraan wajib diisi' });
    }

    const cleanPlate = String(vehiclePlate).trim().toUpperCase();
    const effectivePriceTier = priceTier || 'UMUM';

    // Start Transaction
    const createdWorkOrder = await prisma.$transaction(async (tx) => {
      // 1. Resolve or create customer if provided
      let finalCustomerId: number | null = null;
      let finalCustomerName = customerName ? String(customerName).trim() : 'Pelanggan Umum';
      let finalCustomerPhone = customerPhone ? String(customerPhone).trim() : null;

      if (customerId) {
        const cust = await tx.customer.findFirst({
          where: { id: parseInt(String(customerId), 10), tenantId }
        });
        if (cust) {
          finalCustomerId = cust.id;
          if (finalCustomerName && finalCustomerName !== 'Pelanggan Umum' && finalCustomerName !== 'Konsumen Walk-In') {
            await tx.customer.update({
              where: { id: cust.id },
              data: { name: finalCustomerName }
            });
          } else {
            finalCustomerName = cust.name;
          }
          finalCustomerPhone = cust.phone;
        }
      } else if (finalCustomerPhone) {
        const cleanDigits = finalCustomerPhone.replace(/\D/g, '');
        const phoneVariants = [finalCustomerPhone];
        if (cleanDigits.startsWith('62')) {
          phoneVariants.push('0' + cleanDigits.slice(2));
          phoneVariants.push('+' + cleanDigits);
        } else if (cleanDigits.startsWith('0')) {
          phoneVariants.push('+62' + cleanDigits.slice(1));
          phoneVariants.push('62' + cleanDigits.slice(1));
        }

        const existingCust = await tx.customer.findFirst({
          where: {
            tenantId,
            phone: { in: phoneVariants }
          }
        });
        if (existingCust) {
          finalCustomerId = existingCust.id;
          if (finalCustomerName && finalCustomerName !== 'Pelanggan Umum' && finalCustomerName !== 'Konsumen Walk-In') {
            await tx.customer.update({
              where: { id: existingCust.id },
              data: { name: finalCustomerName }
            });
          } else {
            finalCustomerName = existingCust.name;
          }
        } else {
          const newCust = await tx.customer.create({
            data: {
              tenantId,
              name: finalCustomerName,
              phone: finalCustomerPhone,
              priceTier: effectivePriceTier
            }
          });
          finalCustomerId = newCust.id;
        }
      }

      // If still no customer resolved, resolve or create default walk-in customer for this plate
      if (!finalCustomerId) {
        const walkInPhone = `WALKIN-${cleanPlate}`;
        let walkInCust = await tx.customer.findFirst({
          where: { tenantId, phone: walkInPhone }
        });
        if (!walkInCust) {
          walkInCust = await tx.customer.create({
            data: {
              tenantId,
              name: finalCustomerName || `Konsumen ${cleanPlate}`,
              phone: walkInPhone,
              priceTier: effectivePriceTier
            }
          });
        } else if (finalCustomerName && finalCustomerName !== 'Pelanggan Umum' && finalCustomerName !== 'Konsumen Walk-In') {
          await tx.customer.update({
            where: { id: walkInCust.id },
            data: { name: finalCustomerName }
          });
        }
        finalCustomerId = walkInCust.id;
      }

      // 2. Resolve or upsert vehicle
      let finalVehicleId = vehicleId;
      const vehicleRecord = await tx.vehicle.upsert({
        where: {
          tenantId_plateNumber: {
            tenantId,
            plateNumber: cleanPlate
          }
        },
        update: {
          ...(finalCustomerId && { customerId: finalCustomerId }),
          ...(vehicleBrand && { brand: String(vehicleBrand).trim() }),
          ...(vehicleModel && { model: String(vehicleModel).trim() }),
          ...(vehicleType && { vehicleType })
        },
        create: {
          tenantId,
          customerId: finalCustomerId,
          plateNumber: cleanPlate,
          brand: vehicleBrand ? String(vehicleBrand).trim() : '',
          model: vehicleModel ? String(vehicleModel).trim() : '',
          vehicleType: vehicleType || 'MOTOR'
        }
      });
      finalVehicleId = vehicleRecord.id;

      // 3. Generate SPK Number
      const spkNumber = await generateSpkNumber(tenantId);

      // 4. Create WorkOrder Header
      const wo = await tx.workOrder.create({
        data: {
          tenantId,
          outletId: outletId || null,
          spkNumber,
          vehiclePlate: cleanPlate,
          vehicleBrand: vehicleBrand ? String(vehicleBrand).trim() : null,
          vehicleModel: vehicleModel ? String(vehicleModel).trim() : null,
          vehicleType: vehicleType || 'MOTOR',
          vehicleId: finalVehicleId,
          customerId: finalCustomerId,
          odometer: currentKm ? parseInt(String(currentKm), 10) : null,
          complaint: complaint ? String(complaint).trim() : null,
          notes: notes ? String(notes).trim() : null,
          priceTier: effectivePriceTier,
          status: 'PENDING',
          totalServices: 0,
          totalParts: 0,
          totalAmount: 0
        }
      });

      // 5. Add Services if any
      let totalServices = 0;
      if (Array.isArray(services) && services.length > 0) {
        for (const s of services) {
          const qty = parseInt(String(s.qty || 1), 10);
          const price = parseFloat(s.price || 0);
          const subtotal = qty * price;
          totalServices += subtotal;

          let mechanicName = s.mechanicName || null;
          if (s.mechanicId && !mechanicName) {
            const m = await tx.user.findFirst({
              where: {
                id: parseInt(String(s.mechanicId), 10),
                memberships: { some: { tenantId } }
              },
              select: { name: true }
            });
            if (m) mechanicName = m.name;
          }

          await tx.workOrderService.create({
            data: {
              tenantId,
              workOrderId: wo.id,
              serviceTypeId: s.serviceTypeId || null,
              serviceName: String(s.serviceName || s.name).trim(),
              vehicleType: s.vehicleType || wo.vehicleType || 'MOTOR',
              price,
              qty,
              subtotal,
              mechanicId: s.mechanicId ? parseInt(String(s.mechanicId), 10) : null,
              mechanicName
            }
          });
        }
      }

      // 6. Add Parts & Deduct Stock if any
      let totalParts = 0;
      if (Array.isArray(parts) && parts.length > 0) {
        for (const p of parts) {
          const qty = parseInt(String(p.qty || 1), 10);
          const price = parseFloat(p.price || 0);
          const subtotal = qty * price;
          totalParts += subtotal;

          if (p.productId) {
            const prod = await tx.product.findFirst({
              where: { id: parseInt(String(p.productId), 10), tenantId }
            });
            if (prod && prod.stock < qty) {
              throw new Error(`Stok sparepart "${prod.name}" tidak mencukupi (sisa ${prod.stock}, diminta ${qty})`);
            }
            if (prod) {
              await tx.product.update({
                where: { id: prod.id },
                data: { stock: { decrement: qty } }
              });
            }
          }

          await tx.workOrderPart.create({
            data: {
              tenantId,
              workOrderId: wo.id,
              productId: p.productId ? parseInt(String(p.productId), 10) : null,
              partName: String(p.partName || p.name).trim(),
              qty,
              price,
              subtotal,
              stockDeducted: Boolean(p.productId)
            }
          });
        }
      }

      const totalAmount = totalServices + totalParts;
      const updatedWo = await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          totalServices,
          totalParts,
          totalAmount
        },
        include: {
          services: true,
          parts: true,
          customer: true,
          vehicle: true
        }
      });

      return updatedWo;
    });

    // Broadcast Real-Time via Socket.IO
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('spk:created', {
      workOrderId: createdWorkOrder.id,
      spkNumber: createdWorkOrder.spkNumber,
      status: createdWorkOrder.status
    });

    // Send WhatsApp Notif (Fire and forget)
    const custPhone = createdWorkOrder.customer?.phone;
    const custName = createdWorkOrder.customer?.name || 'Pelanggan';
    if (custPhone) {
      WANotifService.sendSPKReceived({
        tenantId,
        customerName: custName,
        customerPhone: custPhone,
        spkNumber: createdWorkOrder.spkNumber,
        vehiclePlate: createdWorkOrder.vehiclePlate || '',
        vehicleBrand: createdWorkOrder.vehicleBrand || undefined,
        vehicleModel: createdWorkOrder.vehicleModel || undefined,
        complaint: createdWorkOrder.complaint || undefined
      }).then((sent) => {
        if (sent) {
          prisma.workOrder.update({
            where: { id: createdWorkOrder.id },
            data: { notifReceivedSent: true }
          }).catch(console.error);
        }
      }).catch(console.error);
    }

    res.status(201).json(formatWorkOrderResponse(createdWorkOrder));
  } catch (error: any) {
    console.error('Error creating work order:', error);
    res.status(400).json({ error: error.message || 'Gagal membuat SPK' });
  }
});

// PATCH /api/bengkel/work-orders/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { status, mechanicNotes } = req.body;

    const existing = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId },
      include: {
        services: true,
        parts: true,
        customer: true
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'SPK tidak ditemukan' });
    }

    const currentStatus = existing.status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Transisi status tidak valid: dari ${currentStatus} ke ${status}. Status yang diizinkan: [${allowed.join(', ')}]`
      });
    }

    // Status PAID hanya boleh diproses melalui pembayaran kasir /pay atau pelunasan Invoice B2B
    if (status === 'PAID') {
      return res.status(400).json({
        error: 'Status Lunas (PAID) tidak dapat diubah secara manual. Silakan proses melalui pembayaran POS Kasir atau pelunasan Invoice B2B.'
      });
    }

    // Integritas Data & Finansial: Tolak pembatalan jika SPK sudah masuk invoice B2B aktif
    if (status === 'CANCELLED') {
      const activeInvoiceItem = await prisma.workOrderInvoiceItem.findFirst({
        where: {
          workOrderId: existing.id,
          invoice: {
            tenantId,
            status: { notIn: ['VOID'] }
          }
        },
        include: {
          invoice: {
            select: { invoiceNumber: true, status: true }
          }
        }
      });

      if (activeInvoiceItem) {
        return res.status(400).json({
          error: `SPK ${existing.spkNumber} tidak dapat dibatalkan karena sudah terdaftar pada Invoice B2B ${activeInvoiceItem.invoice.invoiceNumber} (Status: ${activeInvoiceItem.invoice.status}). Silakan batalkan (VOID) invoice tersebut terlebih dahulu.`
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. If CANCELLED: Restore deducted stock & rollback commissions if was PAID
      if (status === 'CANCELLED') {
        const parts = await tx.workOrderPart.findMany({
          where: { workOrderId: existing.id, stockDeducted: true }
        });

        for (const p of parts) {
          if (p.productId) {
            await tx.product.update({
              where: { id: p.productId },
              data: { stock: { increment: p.qty } }
            });
            await tx.workOrderPart.update({
              where: { id: p.id },
              data: { stockDeducted: false }
            });
          }
        }

        // Rollback commission if SPK was already PAID before being cancelled
        if (existing.status === 'PAID') {
          const services = await tx.workOrderService.findMany({
            where: { workOrderId: existing.id }
          });
          for (const s of services) {
            if (!s.mechanicId) continue;
            const profile = await tx.mechanicProfile.findFirst({
              where: { userId: s.mechanicId, tenantId }
            });
            if (profile && profile.commissionType !== 'NONE' && profile.commissionRate > 0) {
              const commission = s.subtotal * profile.commissionRate;
              await tx.mechanicProfile.update({
                where: { id: profile.id },
                data: {
                  pendingCommission: { decrement: commission },
                  paidCommission: { decrement: 0 }
                }
              });
            }
          }
        }
      }

      return tx.workOrder.update({
        where: { id: existing.id },
        data: {
          status,
          ...(status === 'IN_PROGRESS' && !existing.startedAt ? { startedAt: new Date() } : {}),
          ...(status === 'DONE' && !existing.completedAt ? { completedAt: new Date() } : {}),
          ...(status === 'DELIVERED' && !existing.deliveredAt ? { deliveredAt: new Date() } : {}),
          ...(mechanicNotes !== undefined && { diagnosis: String(mechanicNotes) })
        },
        include: {
          services: true,
          parts: true,
          customer: true
        }
      });
    });

    // Broadcast Real-time
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('spk:status_updated', {
      workOrderId: updated.id,
      spkNumber: updated.spkNumber,
      status: updated.status
    });

    // Send WhatsApp Notif on DONE status (Fire and forget)
    const existingCustPhone = existing.customer?.phone;
    const existingCustName = existing.customer?.name || 'Pelanggan';
    if (status === 'DONE' && existingCustPhone && !existing.notifDoneSent) {
      WANotifService.sendSPKDone({
        tenantId,
        customerName: existingCustName,
        customerPhone: existingCustPhone,
        spkNumber: existing.spkNumber,
        vehiclePlate: existing.vehiclePlate || '',
        totalAmount: updated.totalAmount
      }).then((sent) => {
        if (sent) {
          prisma.workOrder.update({
            where: { id: updated.id },
            data: { notifDoneSent: true }
          }).catch(console.error);
        }
      }).catch(console.error);
    }

    res.json(formatWorkOrderResponse(updated));
  } catch (error: any) {
    console.error('Error updating SPK status:', error);
    res.status(500).json({ error: error.message || 'Gagal mengubah status SPK' });
  }
});

// POST /api/bengkel/work-orders/:id/parts (Add part to existing SPK)
router.post('/:id/parts', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { productId, partName, qty, unitPrice } = req.body;

    const existing = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'SPK tidak ditemukan' });
    }

    if (existing.status === 'PAID' || existing.status === 'DELIVERED' || existing.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Tidak dapat menambah sparepart pada SPK yang sudah selesai atau dibatalkan' });
    }

    const parsedQty = parseInt(String(qty || 1), 10);
    const parsedPrice = parseFloat(unitPrice || 0);
    const subtotal = parsedQty * parsedPrice;

    const result = await prisma.$transaction(async (tx) => {
      if (productId) {
        const prod = await tx.product.findFirst({
          where: { id: parseInt(String(productId), 10), tenantId }
        });
        if (!prod || prod.stock < parsedQty) {
          throw new Error(`Stok sparepart tidak mencukupi (sisa ${prod?.stock ?? 0})`);
        }
        await tx.product.update({
          where: { id: prod.id },
          data: { stock: { decrement: parsedQty } }
        });
      }

      const part = await tx.workOrderPart.create({
        data: {
          tenantId,
          workOrderId: existing.id,
          productId: productId ? parseInt(String(productId), 10) : null,
          partName: String(partName).trim(),
          qty: parsedQty,
          price: parsedPrice,
          subtotal,
          stockDeducted: Boolean(productId)
        }
      });

      await recalculateWorkOrderTotals(existing.id, tx);
      return part;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error adding part to SPK:', error);
    res.status(400).json({ error: error.message || 'Gagal menambahkan sparepart' });
  }
});

// DELETE /api/bengkel/work-orders/:id/parts/:partId (Remove part from SPK & restore stock)
router.delete('/:id/parts/:partId', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id, partId } = req.params;

    const wo = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId }
    });
    if (!wo) return res.status(404).json({ error: 'SPK tidak ditemukan' });

    const part = await prisma.workOrderPart.findFirst({
      where: { id: String(partId), workOrderId: wo.id }
    });
    if (!part) return res.status(404).json({ error: 'Sparepart tidak ditemukan pada SPK ini' });

    await prisma.$transaction(async (tx) => {
      if (part.stockDeducted && part.productId) {
        await tx.product.update({
          where: { id: part.productId },
          data: { stock: { increment: part.qty } }
        });
      }
      await tx.workOrderPart.delete({ where: { id: part.id } });
      await recalculateWorkOrderTotals(wo.id, tx);
    });

    res.json({ success: true, message: 'Sparepart berhasil dihapus dan stok dikembalikan' });
  } catch (error: any) {
    console.error('Error removing part:', error);
    res.status(500).json({ error: error.message || 'Gagal menghapus sparepart' });
  }
});

// POST /api/bengkel/work-orders/:id/services (Add service to existing SPK)
router.post('/:id/services', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { serviceTypeId, serviceName, price, mechanicId, notes } = req.body;

    const wo = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId }
    });
    if (!wo) return res.status(404).json({ error: 'SPK tidak ditemukan' });

    // IDOR Protection: Validasi kepemilikan katalog jasa dan mekanik
    let verifiedServiceTypeId: string | null = null;
    if (serviceTypeId) {
      const st = await prisma.serviceType.findFirst({
        where: { id: String(serviceTypeId), tenantId }
      });
      if (!st) {
        return res.status(400).json({ error: 'Katalog jasa tidak ditemukan atau tidak memiliki akses' });
      }
      verifiedServiceTypeId = st.id;
    }

    let verifiedMechanicId: number | null = null;
    if (mechanicId) {
      const mIdNum = parseInt(String(mechanicId), 10);
      const membership = await prisma.tenantMembership.findFirst({
        where: { userId: mIdNum, tenantId, status: 'ACTIVE' }
      });
      if (!membership) {
        return res.status(400).json({ error: 'Mekanik tidak terdaftar aktif di bengkel ini' });
      }
      verifiedMechanicId = mIdNum;
    }

    const parsedPrice = parseFloat(price || 0);

    const srv = await prisma.$transaction(async (tx) => {
      const created = await tx.workOrderService.create({
        data: {
          tenantId,
          workOrderId: wo.id,
          serviceTypeId: verifiedServiceTypeId,
          serviceName: String(serviceName).trim(),
          vehicleType: wo.vehicleType || 'MOTOR',
          price: parsedPrice,
          qty: 1,
          subtotal: parsedPrice,
          mechanicId: verifiedMechanicId
        }
      });
      await recalculateWorkOrderTotals(wo.id, tx);
      return created;
    });

    res.status(201).json(srv);
  } catch (error: any) {
    console.error('Error adding service:', error);
    res.status(500).json({ error: error.message || 'Gagal menambahkan jasa' });
  }
});

// DELETE /api/bengkel/work-orders/:id/services/:serviceId
router.delete('/:id/services/:serviceId', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id, serviceId } = req.params;

    const wo = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId }
    });
    if (!wo) return res.status(404).json({ error: 'SPK tidak ditemukan' });

    await prisma.$transaction(async (tx) => {
      await tx.workOrderService.deleteMany({
        where: { id: String(serviceId), workOrderId: wo.id }
      });
      await recalculateWorkOrderTotals(wo.id, tx);
    });

    res.json({ success: true, message: 'Jasa berhasil dihapus dari SPK' });
  } catch (error: any) {
    console.error('Error removing service:', error);
    res.status(500).json({ error: error.message || 'Gagal menghapus jasa' });
  }
});

// POST /api/bengkel/work-orders/:id/pay (Payment processing)
router.post('/:id/pay', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const {
      paymentMethod = 'TUNAI',
      paidAmount,
      discountAmount,
      discount,
      isDirectSale,
      splitCash,
      splitNonCash,
      splitNonCashMethod,
      vehicleBrand,
      vehicleModel,
      currentKm,
      vehicleType
    } = req.body;

    const wo = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId },
      include: {
        services: true,
        parts: true,
        customer: true
      }
    });

    if (!wo) return res.status(404).json({ error: 'SPK tidak ditemukan' });
    if (wo.status === 'PAID' || wo.status === 'DELIVERED') {
      return res.status(400).json({ error: 'SPK ini sudah dibayar sebelumnya' });
    }

    const rawDiscount = discountAmount != null ? discountAmount : discount;
    const parsedDiscount = rawDiscount != null ? parseFloat(rawDiscount) : wo.discount;
    const effectiveTotal = Math.max(0, wo.totalServices + wo.totalParts - parsedDiscount);

    const pmUpper = (paymentMethod || 'TUNAI').toUpperCase();
    const isSplit = pmUpper === 'SPLIT';
    const isCash = pmUpper === 'TUNAI' || pmUpper === 'CASH';

    let actualCashPortion = 0;
    let actualNonCashPortion = 0;
    let actualTotalPaid = 0;

    if (isSplit) {
      actualCashPortion = Math.max(0, parseFloat(splitCash) || 0);
      actualNonCashPortion = Math.max(0, parseFloat(splitNonCash) || 0);
      actualTotalPaid = actualCashPortion + actualNonCashPortion;
    } else if (isCash) {
      const rawPaid = parseFloat(paidAmount || effectiveTotal);
      actualCashPortion = Math.min(rawPaid, effectiveTotal);
      actualTotalPaid = actualCashPortion;
    } else {
      const rawPaid = parseFloat(paidAmount || effectiveTotal);
      actualNonCashPortion = Math.min(rawPaid, effectiveTotal);
      actualTotalPaid = actualNonCashPortion;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. If partial payment and customer exists, record debt (piutang)
      if (actualTotalPaid < effectiveTotal && wo.customerId) {
        const remainingDebt = effectiveTotal - actualTotalPaid;
        await tx.debt.create({
          data: {
            tenantId,
            customerId: wo.customerId,
            amount: remainingDebt,
            remaining: remainingDebt,
            status: 'Belum Lunas',
            notes: `Sisa pembayaran SPK ${wo.spkNumber} (${wo.vehiclePlate})`,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 hari
          }
        });
      }

      // 2. Credit commissions to mechanics
      for (const s of wo.services) {
        if (!s.mechanicId) continue;
        const profile = await tx.mechanicProfile.findFirst({
          where: { userId: s.mechanicId, tenantId }
        });
        if (profile && profile.commissionType !== 'NONE' && profile.commissionRate > 0) {
          const commission = s.subtotal * profile.commissionRate;
          await tx.mechanicProfile.update({
            where: { id: profile.id },
            data: { pendingCommission: { increment: commission } }
          });
        }
      }

      // 3. Record Cash Inflow (Sinkronisasi ke Laporan Kasir & Arus Kas)
      const currentUserId = Number((req as any).user?.id || 1);

      if (isSplit) {
        if (actualCashPortion > 0) {
          await tx.cashFlow.create({
            data: {
              tenantId,
              outletId: wo.outletId || undefined,
              type: 'Pemasukan',
              category: 'PENJUALAN_SPK - Tunai',
              cashPocket: 'LACI_KASIR',
              amount: actualCashPortion,
              description: `Pembayaran Split (Tunai) SPK ${wo.spkNumber} (${wo.vehiclePlate || 'Umum'})`,
              userId: currentUserId,
              date: new Date()
            }
          });
        }
        if (actualNonCashPortion > 0) {
          const nonCashLabel = splitNonCashMethod || 'Non-Tunai';
          await tx.cashFlow.create({
            data: {
              tenantId,
              outletId: wo.outletId || undefined,
              type: 'Pemasukan',
              category: `PENJUALAN_SPK - Non-Tunai (${nonCashLabel})`,
              cashPocket: 'BANK_ACCOUNT',
              amount: actualNonCashPortion,
              description: `Pembayaran Split (${nonCashLabel}) SPK ${wo.spkNumber} (${wo.vehiclePlate || 'Umum'})`,
              userId: currentUserId,
              date: new Date()
            }
          });
        }
      } else {
        if (actualTotalPaid > 0) {
          await tx.cashFlow.create({
            data: {
              tenantId,
              outletId: wo.outletId || undefined,
              type: 'Pemasukan',
              category: isCash ? 'PENJUALAN_SPK - Tunai' : `PENJUALAN_SPK - Non-Tunai (${pmUpper})`,
              cashPocket: isCash ? 'LACI_KASIR' : 'BANK_ACCOUNT',
              amount: actualTotalPaid,
              description: `Pembayaran SPK ${wo.spkNumber} (${wo.vehiclePlate || 'Umum'}) - ${pmUpper}`,
              userId: currentUserId,
              date: new Date()
            }
          });
        }
      }

      // 4. Update WorkOrder (Direct POS sale goes straight to DELIVERED so it doesn't pollute workshop board)
      const targetStatus = isDirectSale ? 'DELIVERED' : 'PAID';
      const updated = await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          discount: parsedDiscount,
          totalAmount: effectiveTotal,
          paidAmount: Math.min(actualTotalPaid, effectiveTotal),
          status: targetStatus,
          ...(vehicleBrand ? { vehicleBrand: String(vehicleBrand).trim() } : {}),
          ...(vehicleModel ? { vehicleModel: String(vehicleModel).trim() } : {}),
          ...(vehicleType ? { vehicleType } : {}),
          ...(currentKm != null && currentKm !== '' ? { odometer: parseInt(String(currentKm), 10) || null } : {}),
          ...(isDirectSale ? { deliveredAt: new Date() } : {})
        }
      });

      // Update Vehicle Master Record if exists
      const effectivePlate = wo.vehiclePlate?.trim().toUpperCase();
      if (effectivePlate && (vehicleBrand || vehicleModel || vehicleType)) {
        await tx.vehicle.updateMany({
          where: { plateNumber: effectivePlate, tenantId },
          data: {
            ...(vehicleBrand ? { brand: String(vehicleBrand).trim() } : {}),
            ...(vehicleModel ? { model: String(vehicleModel).trim() } : {}),
            ...(vehicleType ? { vehicleType } : {})
          }
        });
      }

      return updated;
    });

    // Socket.IO Real-time broadcast
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('spk:status_updated', {
      workOrderId: result.id,
      spkNumber: result.spkNumber,
      status: result.status
    });

    res.json({
      success: true,
      message: 'Pembayaran SPK berhasil diproses',
      workOrder: formatWorkOrderResponse(result)
    });
  } catch (error: any) {
    console.error('Error processing SPK payment:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses pembayaran SPK' });
  }
});

// POST /api/bengkel/work-orders/clear-paid (Membersihkan kolom Lunas di papan antrean menjadi DELIVERED)
router.post('/clear-paid', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const result = await prisma.workOrder.updateMany({
      where: {
        tenantId,
        status: 'PAID'
      },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date()
      }
    });

    req.app.get('io')?.to(`tenant:${tenantId}`).emit('spk:status_updated', { clearedPaid: true });

    res.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error('Error clearing paid SPK:', error);
    res.status(500).json({ error: error.message || 'Gagal membersihkan SPK' });
  }
});

// POST /api/bengkel/work-orders/:id/return-parts (Retur Parsial Suku Cadang dari SPK Lunas/Proses)
router.post('/:id/return-parts', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { parts, reason, refundMethod } = req.body || {};
    const user = (req as any).user;

    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu suku cadang yang ingin diretur' });
    }

    const wo = await prisma.workOrder.findFirst({
      where: { id: String(id), tenantId },
      include: {
        parts: true
      }
    });

    if (!wo) return res.status(404).json({ error: 'SPK tidak ditemukan' });
    if (wo.status === 'CANCELLED') {
      return res.status(400).json({ error: 'SPK ini sudah dibatalkan sebelumnya' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalRefund = 0;
      const returnItemsData: any[] = [];

      for (const item of parts) {
        const existingPart = wo.parts.find(p => p.id === String(item.partId));
        if (!existingPart) {
          throw new Error(`Suku cadang dengan ID ${item.partId} tidak ditemukan pada SPK ini`);
        }

        const returnQty = Math.max(1, parseInt(String(item.qty || 1), 10));
        if (returnQty > existingPart.qty) {
          throw new Error(`Kuantitas retur (${returnQty}) melebihi kuantitas pada SPK (${existingPart.qty}) untuk ${existingPart.partName}`);
        }

        const partSubtotal = Math.round(existingPart.price * returnQty);
        totalRefund += partSubtotal;
        const condition = item.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
        const isRestored = condition === 'GOOD' && Boolean(existingPart.productId);

        // 1. Pulihkan stok suku cadang ke katalog toko jika segel baik
        if (isRestored && existingPart.productId) {
          await tx.product.update({
            where: { id: existingPart.productId },
            data: { stock: { increment: returnQty } }
          });
        }

        // 2. Siapkan data return item
        returnItemsData.push({
          partName: existingPart.partName,
          productId: existingPart.productId,
          qty: returnQty,
          unitPrice: existingPart.price,
          subtotal: partSubtotal,
          stockRestored: isRestored
        });

        // 3. Update atau hapus part dari SPK
        if (returnQty >= existingPart.qty) {
          await tx.workOrderPart.delete({
            where: { id: existingPart.id }
          });
        } else {
          const newQty = existingPart.qty - returnQty;
          await tx.workOrderPart.update({
            where: { id: existingPart.id },
            data: {
              qty: newQty,
              subtotal: newQty * existingPart.price
            }
          });
        }
      }

      // 4. Catat ke tabel WorkOrderReturn
      const woReturn = await tx.workOrderReturn.create({
        data: {
          tenantId,
          workOrderId: wo.id,
          type: 'PART_RETURN_STOCK',
          reason: reason ? String(reason).trim() : 'Retur Suku Cadang Konsumen',
          handledBy: user?.id || 1,
          refundAmount: totalRefund,
          items: {
            create: returnItemsData
          }
        },
        include: { items: true }
      });

      // 5. Hitung ulang total biaya SPK
      const updatedWo = await recalculateWorkOrderTotals(wo.id, tx);

      // Jika SPK sudah dibayar dan ada pengembalian uang tunai
      if (wo.paidAmount > 0 && refundMethod === 'CASH' && totalRefund > 0) {
        // Kurangi paidAmount pada SPK jika lunas/over
        await tx.workOrder.update({
          where: { id: wo.id },
          data: {
            paidAmount: Math.max(0, wo.paidAmount - totalRefund)
          }
        });

        // Catat pengeluaran kas di CashFlow
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: wo.outletId || null,
            userId: user?.id || 1,
            type: 'Pengeluaran',
            category: 'Refund Retur Penjualan',
            amount: totalRefund,
            description: `Refund tunai retur sparepart SPK #${wo.spkNumber} (${woReturn.items.map(i => i.partName).join(', ')})`,
            date: new Date()
          }
        });
      }

      return { updatedWo, woReturn };
    });

    res.json({
      success: true,
      message: 'Retur suku cadang berhasil diproses. Stok telah dikembalikan ke inventori bengkel.',
      data: result
    });
  } catch (error: any) {
    console.error('Error returning work order parts:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses retur suku cadang' });
  }
});

export default router;

