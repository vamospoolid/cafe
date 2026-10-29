import { generateTrackingCode } from '../utils/tracking';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db';
import { AuthRequest, authenticateToken } from '../middlewares/authMiddleware';
import { WANotifService } from '../services/WANotifService';
import {
  convertStaticToDynamicQris,
  buildFallbackStaticQris,
  isValidStaticQris,
  extractNominalFromNotification
} from '../utils/qrisDynamicGenerator';

const router = Router();

// ─── HELPER: GENERATE ORDER NUMBER (LD-YYYYMM-0001) ──────────────────────────
async function generateLaundryOrderNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `LD-${ym}-`;

  const lastOrder = await prisma.laundryOrder.findFirst({
    where: {
      tenantId,
      orderNumber: { startsWith: prefix }
    },
    orderBy: { orderNumber: 'desc' }
  });

  let seq = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const parts = lastOrder.orderNumber.split('-');
    if (parts.length >= 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ─── HELPER: SELF-HEALING ZERO TOTAL LAUNDRY ORDERS ──────────────────────────
async function healLaundryOrder(order: any, tenantId: string) {
  if (!order) return order;
  const currentTotal = Number(order.totalAmount) || 0;
  if (currentTotal === 0 && Array.isArray(order.items) && order.items.length > 0) {
    const computedSub = order.items.reduce((sum: number, it: any) => {
      const lineSub = parseFloat(it.subtotal);
      if (!isNaN(lineSub) && lineSub > 0) return sum + lineSub;
      const q = parseFloat(it.qty) || 0;
      const p = parseFloat(it.pricePerUnit) || 0;
      return sum + (q * p);
    }, 0);
    const surcharge = Number(order.speedSurcharge) || 0;
    const disc = Number(order.discount) || 0;
    const computedTot = Math.max(0, computedSub + surcharge - disc);

    if (computedTot > 0) {
      const pAmount = Number(order.paidAmount) || 0;
      const isPaid = pAmount >= computedTot && computedTot > 0;
      const isPartial = pAmount > 0 && pAmount < computedTot;
      const newStatus = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID';

      order.subtotal = computedSub;
      order.totalAmount = computedTot;
      order.paymentStatus = newStatus;

      // Update asinkron di database agar tersimpan permanen
      prisma.laundryOrder.update({
        where: { id: order.id },
        data: {
          subtotal: computedSub,
          totalAmount: computedTot,
          paymentStatus: newStatus
        }
      }).catch(err => console.warn('[Laundry Self-Healing DB Update Error]:', err));
    }
  }
  return order;
}

// ─── 1. GET /api/laundry/orders (List / Filter / Kanban) ─────────────────────
router.get('/orders', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const statusParam = req.query.status as string | undefined;
    const paymentStatusParam = req.query.paymentStatus as string | undefined;
    const searchParam = req.query.search as string | undefined;
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    const offsetParam = req.query.offset as string | undefined;

    const where: any = { tenantId };

    if (statusParam && statusParam !== 'ALL') {
      if (statusParam.includes(',')) {
        where.status = { in: statusParam.split(',') };
      } else {
        where.status = statusParam;
      }
    }

    if (paymentStatusParam && paymentStatusParam !== 'ALL') {
      where.paymentStatus = paymentStatusParam;
    }

    if (searchParam && searchParam.trim() !== '') {
      const q = searchParam.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { rackLocation: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (startDateParam || endDateParam) {
      where.createdAt = {};
      if (startDateParam) where.createdAt.gte = new Date(startDateParam);
      if (endDateParam) {
        const eDate = new Date(endDateParam);
        eDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = eDate;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.laundryOrder.findMany({
        where,
        include: {
          items: true,
          customer: {
            select: { id: true, name: true, phone: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(200, parseInt(limitParam || '50', 10) || 50),
        skip: parseInt(offsetParam || '0', 10) || 0
      }),
      prisma.laundryOrder.count({ where })
    ]);

    // Jalankan Self-Healing untuk data yang berpotensi totalAmount 0
    await Promise.all(orders.map(ord => healLaundryOrder(ord, tenantId)));

    return res.json({ orders, total });
  } catch (error: any) {
    console.error('[Laundry API] Error listing orders:', error);
    return res.status(500).json({ error: 'Gagal memuat daftar nota cucian.' });
  }
});

// ─── 2. GET /api/laundry/orders/:id (Detail Nota) ───────────────────────────
router.get('/orders/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }
    const id = String(req.params.id);

    const order = await prisma.laundryOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        customer: true,
        outlet: { select: { id: true, name: true, code: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    await healLaundryOrder(order, tenantId);

    return res.json(order);
  } catch (error: any) {
    console.error('[Laundry API] Error getting order detail:', error);
    return res.status(500).json({ error: 'Gagal memuat detail nota cucian.' });
  }
});

// ─── 3. POST /api/laundry/orders (Drop-off Kasir Baru) ───────────────────────
router.post('/orders', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const {
      customerId,
      customerName,
      customerPhone,
      serviceCategory = 'KILOAN',
      serviceSpeed = 'REGULAR',
      perfumeVariant = 'Standar',
      hangerCount = 0,
      itemCountNotes,
      specialNotes,
      items = [],
      subtotal = 0,
      speedSurcharge = 0,
      discount = 0,
      totalAmount = 0,
      paidAmount = 0,
      paymentMethod = 'CASH',
      estimatedDoneAt,
      deliveryType = 'WALK_IN',
      pickupAddress,
      pickupTimeSlot,
      deliveryAddress,
      deliveryNotes,
      courierName,
      courierPhone,
      pickupFee = 0,
      deliveryFee = 0,
      intakePhotos,
      quotaKgUsed = 0,
      depositUsed = 0
    } = req.body;

    if (!customerName || String(customerName).trim() === '') {
      return res.status(400).json({ error: 'Nama pelanggan wajib diisi.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar item cucian tidak boleh kosong.' });
    }

    // Kalkulasi subtotal dari items secara defensif
    const computedItemsSubtotal = items.reduce((sum: number, it: any) => {
      const lineSub = parseFloat(it.subtotal);
      if (!isNaN(lineSub) && lineSub > 0) return sum + lineSub;
      const q = parseFloat(it.qty) || 0;
      const p = parseFloat(it.pricePerUnit) || 0;
      return sum + (q * p);
    }, 0);

    const finalSubtotal = (parseFloat(subtotal) > 0) ? parseFloat(subtotal) : computedItemsSubtotal;
    const finalSurcharge = parseFloat(speedSurcharge) || 0;
    const finalDiscount = parseFloat(discount) || 0;
    const finalPickupFee = parseFloat(pickupFee) || 0;
    const finalDeliveryFee = parseFloat(deliveryFee) || 0;
    const computedTotal = Math.max(0, finalSubtotal + finalSurcharge + finalPickupFee + finalDeliveryFee - finalDiscount);
    const finalTotalAmount = (parseFloat(totalAmount) >= 0 && subtotal > 0) ? parseFloat(totalAmount) : computedTotal;
    const finalQuotaKgUsed = Math.max(0, parseFloat(quotaKgUsed) || 0);
    const finalDepositUsed = Math.max(0, parseFloat(depositUsed) || 0);
    const finalPaidAmount = Math.max(0, parseFloat(paidAmount) || 0);

    // Determine payment status
    const isPaid = (finalPaidAmount >= finalTotalAmount && finalTotalAmount > 0) || (finalTotalAmount === 0 && finalQuotaKgUsed > 0);
    const isPartial = finalPaidAmount > 0 && finalPaidAmount < finalTotalAmount;
    const paymentStatus = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID';

    // Nominal uang kas baru yang benar-benar masuk ke laci kasir saat ini (di luar potong deposit/kuota yang sudah dibayar saat topup)
    const cashInflowNow = Math.max(0, finalPaidAmount - finalDepositUsed);

    // Proteksi Shift Kasir Wajib Aktif jika ada penerimaan pembayaran tunai/non-tunai baru di muka
    if (cashInflowNow > 0 && paymentMethod !== 'QUOTA_KG' && paymentMethod !== 'DEPOSIT') {
      const activeShift = await prisma.shift.findFirst({
        where: {
          status: { in: ['Open', 'OPEN'] },
          ...(tenantId ? { tenantId } : {})
        }
      });
      if (!activeShift) {
        return res.status(400).json({
          error: 'Shift kasir belum dibuka. Harap buka shift kasir dan masukkan modal awal laci terlebih dahulu sebelum melayani pembayaran.',
          shiftRequired: true
        });
      }
    }

    // Auto-generate order number
    const orderNumber = await generateLaundryOrderNumber(tenantId);
    const trackingCode = generateTrackingCode('LND');

    // Get active outlet
    const outlet = await prisma.outlet.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true }
    });

    const sanitizedPhotos = Array.isArray(intakePhotos)
      ? intakePhotos.filter((p: any) => typeof p === 'string' && p.length > 0).slice(0, 5)
      : undefined;

    const result = await prisma.$transaction(async (tx) => {
      let resolvedCustomerId = customerId ? Number(customerId) : null;

      // Jika memakai Kuota Kg atau Deposit, validasi & potong saldo milik pelanggan
      if (finalQuotaKgUsed > 0 || finalDepositUsed > 0) {
        if (!resolvedCustomerId && customerPhone) {
          const foundCust = await tx.customer.findFirst({
            where: { tenantId, phone: String(customerPhone).trim(), deletedAt: null }
          });
          if (foundCust) resolvedCustomerId = foundCust.id;
        }
        if (!resolvedCustomerId) {
          throw new Error('Pelanggan member harus dipilih untuk menggunakan Kuota Kg atau Saldo Deposit.');
        }
        const cust = await tx.customer.findFirst({
          where: { id: resolvedCustomerId, tenantId, deletedAt: null }
        });
        if (!cust) {
          throw new Error('Data pelanggan member tidak ditemukan.');
        }
        if (finalQuotaKgUsed > 0 && (cust.laundryQuotaKg || 0) < finalQuotaKgUsed) {
          throw new Error(`Sisa Kuota Kg pelanggan (${cust.laundryQuotaKg || 0} Kg) tidak mencukupi untuk potong ${finalQuotaKgUsed} Kg.`);
        }
        if (finalDepositUsed > 0 && (cust.laundryDeposit || 0) < finalDepositUsed) {
          throw new Error(`Saldo Deposit pelanggan (Rp ${(cust.laundryDeposit || 0).toLocaleString('id-ID')}) tidak mencukupi.`);
        }

        await tx.customer.update({
          where: { id: cust.id },
          data: {
            ...(finalQuotaKgUsed > 0 ? { laundryQuotaKg: { decrement: finalQuotaKgUsed } } : {}),
            ...(finalDepositUsed > 0 ? { laundryDeposit: { decrement: finalDepositUsed } } : {})
          }
        });
      }

      // 1. Create order
      const newOrder = await tx.laundryOrder.create({
        data: {
          tenantId,
          outletId: outlet?.id || null,
          orderNumber,
          customerId: resolvedCustomerId,
          customerName: String(customerName).trim(),
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          serviceCategory,
          serviceSpeed,
          perfumeVariant,
          hangerCount: Number(hangerCount) || 0,
          itemCountNotes: itemCountNotes ? String(itemCountNotes).trim() : null,
          specialNotes: specialNotes ? String(specialNotes).trim() : null,
          status: 'RECEIVED',
          subtotal: finalSubtotal,
          speedSurcharge: finalSurcharge,
          discount: finalDiscount,
          trackingCode,
          deliveryType,
          pickupStatus: (deliveryType === 'PICKUP_ONLY' || deliveryType === 'FULL_SERVICE') ? 'PENDING' : null,
          deliveryStatus: (deliveryType === 'DELIVERY_ONLY' || deliveryType === 'FULL_SERVICE') ? 'PENDING' : null,
          pickupAddress: pickupAddress ? String(pickupAddress).trim() : null,
          pickupTimeSlot: pickupTimeSlot ? String(pickupTimeSlot).trim() : null,
          deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : null,
          deliveryNotes: deliveryNotes ? String(deliveryNotes).trim() : null,
          courierName: courierName ? String(courierName).trim() : null,
          courierPhone: courierPhone ? String(courierPhone).trim() : null,
          pickupFee: finalPickupFee,
          deliveryFee: finalDeliveryFee,
          totalAmount: finalTotalAmount,
          paidAmount: finalPaidAmount,
          paymentStatus,
          paymentMethod: (finalPaidAmount > 0 || finalQuotaKgUsed > 0) ? paymentMethod : null,
          quotaKgUsed: finalQuotaKgUsed,
          depositUsed: finalDepositUsed,
          ...(sanitizedPhotos && sanitizedPhotos.length > 0 ? { intakePhotos: sanitizedPhotos } : {}),
          estimatedDoneAt: estimatedDoneAt ? new Date(estimatedDoneAt) : null,
          items: {
            create: items.map((it: any) => ({
              serviceName: String(it.serviceName || 'Layanan Cuci').trim(),
              unitType: String(it.unitType || 'KG').toUpperCase(),
              qty: parseFloat(it.qty) || 1,
              pricePerUnit: parseFloat(it.pricePerUnit) || 0,
              subtotal: parseFloat(it.subtotal) || 0,
              notes: it.notes ? String(it.notes).trim() : null
            }))
          }
        },
        include: { items: true }
      });

      // 2. If new cash/QRIS/transfer received at intake, record to CashFlow (Laci Kasir)
      if (cashInflowNow > 0 && userId && paymentMethod !== 'QUOTA_KG' && paymentMethod !== 'DEPOSIT') {
        const payLabel = paymentStatus === 'PARTIAL' ? 'Pembayaran DP Nota Cuci' : 'Pembayaran Drop-off Nota Cuci';
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet?.id || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Laundry',
            amount: cashInflowNow,
            description: `${payLabel} #${orderNumber} (${customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return newOrder;
    });

    // 3. Send WhatsApp Notification asynchronously
    if (result.customerPhone) {
      const summaryItems = items.map((it: any) => `${it.qty} ${it.unitType} ${it.serviceName}`).join(', ');
      const estimatedStr = result.estimatedDoneAt
        ? new Date(result.estimatedDoneAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
        : undefined;

      WANotifService.sendLaundryReceived({
        tenantId,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        orderNumber: result.orderNumber,
        serviceSummary: summaryItems,
        perfumeVariant: result.perfumeVariant || undefined,
        totalAmount: result.totalAmount,
        paidAmount: result.paidAmount,
        paymentStatus: result.paymentStatus,
        estimatedDone: estimatedStr
      }).catch((err) => console.warn('[Laundry WA Error]', err));
    }

    return res.status(201).json({
      message: 'Nota cucian berhasil dibuat.',
      order: result
    });
  } catch (error: any) {
    console.error('[Laundry API] Error creating order:', error);
    return res.status(500).json({ error: error.message || 'Gagal membuat nota cucian baru.' });
  }
});

// ─── HELPER: CHEMICAL DUAL-CORE INVENTORY DEDUCTION ─────────────────────────
async function deductLaundryChemicals(
  orderId: string,
  tenantId: string,
  stage: 'WASHING' | 'IRONING_OR_READY',
  userId?: number
) {
  try {
    const order = await prisma.laundryOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true }
    });

    if (!order) return;

    // Hitung total kilogram ekuivalen
    let kiloanKg = 0;
    let pcsCount = 0;

    for (const item of order.items) {
      if (item.unitType === 'KG') {
        kiloanKg += item.qty;
      } else {
        pcsCount += item.qty;
      }
    }

    // Jika ada kiloan, gunakan kiloan + estimasi satuan (0.4 kg/pcs). Jika hanya satuan, 0.4 kg/pcs (min 1 kg).
    let effectiveKg = kiloanKg;
    if (pcsCount > 0) {
      effectiveKg += pcsCount * 0.4;
    }
    if (effectiveKg <= 0) {
      effectiveKg = 1.0;
    }
    effectiveKg = Math.round(effectiveKg * 100) / 100;

    if (stage === 'WASHING') {
      // Cek idempotensi: jangan potong jika sudah ada log [WASHING] untuk order ini
      const alreadyLogged = await prisma.ingredientLog.findFirst({
        where: {
          tenantId,
          referenceId: order.orderNumber,
          description: { contains: '[WASHING]' }
        }
      });
      if (alreadyLogged) return;

      // 1. Pemakaian Deterjen (standar: 20 ml / kg)
      const detergent = await prisma.ingredient.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { name: { contains: 'Deterjen', mode: 'insensitive' } },
            { name: { contains: 'Detergent', mode: 'insensitive' } }
          ]
        }
      });

      if (detergent) {
        const isLiter = detergent.unit.toLowerCase().includes('liter') || detergent.unit.toLowerCase() === 'l';
        const mlNeeded = effectiveKg * 20; // 20 ml per kg
        const qtyToDeduct = isLiter ? Number((mlNeeded / 1000).toFixed(3)) : Math.round(mlNeeded);

        await prisma.ingredient.update({
          where: { id: detergent.id },
          data: { stock: { decrement: qtyToDeduct } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId: order.outletId,
            ingredientId: detergent.id,
            change: -qtyToDeduct,
            cost: (detergent.buyPrice || 0) * qtyToDeduct,
            type: 'Produksi',
            reason: 'Konsumsi Mesin Cuci (Deterjen)',
            description: `[WASHING] Cucian #${order.orderNumber} (${effectiveKg} kg)`,
            referenceId: order.orderNumber,
            userId: userId ? Number(userId) : undefined
          }
        });
      }

      // 2. Pemakaian Softener (standar: 15 ml / kg)
      const softener = await prisma.ingredient.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { name: { contains: 'Softener', mode: 'insensitive' } },
            { name: { contains: 'Pelembut', mode: 'insensitive' } }
          ]
        }
      });

      if (softener) {
        const isLiter = softener.unit.toLowerCase().includes('liter') || softener.unit.toLowerCase() === 'l';
        const mlNeeded = effectiveKg * 15; // 15 ml per kg
        const qtyToDeduct = isLiter ? Number((mlNeeded / 1000).toFixed(3)) : Math.round(mlNeeded);

        await prisma.ingredient.update({
          where: { id: softener.id },
          data: { stock: { decrement: qtyToDeduct } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId: order.outletId,
            ingredientId: softener.id,
            change: -qtyToDeduct,
            cost: (softener.buyPrice || 0) * qtyToDeduct,
            type: 'Produksi',
            reason: 'Konsumsi Pelembut Mesin (Softener)',
            description: `[WASHING] Cucian #${order.orderNumber} (${effectiveKg} kg)`,
            referenceId: order.orderNumber,
            userId: userId ? Number(userId) : undefined
          }
        });
      }
    } else if (stage === 'IRONING_OR_READY') {
      // Cek idempotensi: jangan potong jika sudah ada log [FINISHING] untuk order ini
      const alreadyLogged = await prisma.ingredientLog.findFirst({
        where: {
          tenantId,
          referenceId: order.orderNumber,
          description: { contains: '[FINISHING]' }
        }
      });
      if (alreadyLogged) return;

      // 1. Pemakaian Parfum Semprot (standar: 10 ml / kg)
      const perfumeVariantName = order.perfumeVariant ? order.perfumeVariant.trim() : '';
      let perfume = null;

      if (perfumeVariantName && perfumeVariantName !== 'Standar') {
        perfume = await prisma.ingredient.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            name: { contains: perfumeVariantName, mode: 'insensitive' }
          }
        });
      }

      if (!perfume) {
        perfume = await prisma.ingredient.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            OR: [
              { name: { contains: 'Parfum', mode: 'insensitive' } },
              { name: { contains: 'Pewangi', mode: 'insensitive' } }
            ]
          }
        });
      }

      if (perfume) {
        const isLiter = perfume.unit.toLowerCase().includes('liter') || perfume.unit.toLowerCase() === 'l';
        const mlNeeded = effectiveKg * 10; // 10 ml per kg semprot setrika
        const qtyToDeduct = isLiter ? Number((mlNeeded / 1000).toFixed(3)) : Math.round(mlNeeded);

        await prisma.ingredient.update({
          where: { id: perfume.id },
          data: { stock: { decrement: qtyToDeduct } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId: order.outletId,
            ingredientId: perfume.id,
            change: -qtyToDeduct,
            cost: (perfume.buyPrice || 0) * qtyToDeduct,
            type: 'Produksi',
            reason: `Finishing Semprot Pewangi (${order.perfumeVariant || 'Standar'})`,
            description: `[FINISHING] Parfum #${order.orderNumber} (${effectiveKg} kg)`,
            referenceId: order.orderNumber,
            userId: userId ? Number(userId) : undefined
          }
        });
      }

      // 2. Pemakaian Plastik Kemasan (1 pack/lembar per order)
      const plastic = await prisma.ingredient.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { name: { contains: 'Plastik', mode: 'insensitive' } },
            { name: { contains: 'Packaging', mode: 'insensitive' } }
          ]
        }
      });

      if (plastic) {
        const plasticPcs = Math.max(1, Math.ceil(effectiveKg / 5)); // 1 plastik per 5 kg
        await prisma.ingredient.update({
          where: { id: plastic.id },
          data: { stock: { decrement: plasticPcs } }
        });

        await prisma.ingredientLog.create({
          data: {
            tenantId,
            outletId: order.outletId,
            ingredientId: plastic.id,
            change: -plasticPcs,
            cost: (plastic.buyPrice || 0) * plasticPcs,
            type: 'Produksi',
            reason: 'Kemasan Plastik Laundry',
            description: `[FINISHING] Packing Plastik #${order.orderNumber}`,
            referenceId: order.orderNumber,
            userId: userId ? Number(userId) : undefined
          }
        });
      }
    }
  } catch (deductErr) {
    console.error('[Laundry Chemical Deduction Error]:', deductErr);
  }
}

// ─── 4. PATCH /api/laundry/orders/:id/status (Update Workflow Status) ────────
router.patch('/orders/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }
    const id = String(req.params.id);
    const { status } = req.body;

    const validStatuses = ['RECEIVED', 'WASHING', 'DRYING', 'IRONING', 'READY', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status ${status} tidak valid.` });
    }

    const order = await prisma.laundryOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    const updateData: any = { status };

    if (status === 'WASHING' && userId) {
      updateData.washerUserId = Number(userId);
    }
    if (status === 'IRONING' && userId) {
      updateData.ironerUserId = Number(userId);
    }
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      if (userId) updateData.pickupByUserId = Number(userId);
    }

    const updated = await prisma.laundryOrder.update({
      where: { id },
      data: updateData,
      include: { items: true }
    });

    // Otomatisasi Pemotongan Bahan Kimia Laundry (Deterjen, Softener, Parfum, Plastik)
    if (status === 'WASHING') {
      deductLaundryChemicals(id, tenantId, 'WASHING', userId ? Number(userId) : undefined).catch(err => {
        console.warn('[Laundry Chemical Deduction Error WASHING]', err);
      });
    } else if (status === 'IRONING' || status === 'READY') {
      deductLaundryChemicals(id, tenantId, 'IRONING_OR_READY', userId ? Number(userId) : undefined).catch(err => {
        console.warn('[Laundry Chemical Deduction Error IRONING_OR_READY]', err);
      });
    }

    return res.json({
      message: `Status cucian berhasil diubah menjadi ${status}.`,
      order: updated
    });
  } catch (error: any) {
    console.error('[Laundry API] Error updating status:', error);
    return res.status(500).json({ error: 'Gagal memperbarui status cucian.' });
  }
});

// ─── 5. PATCH /api/laundry/orders/:id/ready (Packing Selesai & Masuk Rak) ─────
router.patch('/orders/:id/ready', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }
    const id = String(req.params.id);
    const { rackLocation, sendWhatsApp = true } = req.body;

    const order = await prisma.laundryOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    const updated = await prisma.laundryOrder.update({
      where: { id },
      data: {
        status: 'READY',
        rackLocation: rackLocation ? String(rackLocation).trim() : order.rackLocation || 'Rak Penyimpanan',
        readyAt: new Date()
      },
      include: { items: true }
    });

    // Otomatisasi Pemotongan Parfum & Plastik Packing jika belum dipotong di IRONING
    deductLaundryChemicals(id, tenantId, 'IRONING_OR_READY', req.user?.id ? Number(req.user.id) : undefined).catch(err => {
      console.warn('[Laundry Chemical Deduction Error READY]', err);
    });

    // Kirim notifikasi WhatsApp bahwa pakaian telah siap diambil di rak
    if (sendWhatsApp && updated.customerPhone && !updated.notifReadySent) {
      WANotifService.sendLaundryReady({
        tenantId,
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        orderNumber: updated.orderNumber,
        rackLocation: updated.rackLocation || undefined,
        totalAmount: updated.totalAmount,
        paidAmount: updated.paidAmount,
        paymentStatus: updated.paymentStatus
      }).then(() => {
        prisma.laundryOrder.update({
          where: { id },
          data: { notifReadySent: true }
        }).catch(() => {});
      }).catch((err) => console.warn('[Laundry WA Ready Error]', err));
    }

    return res.json({
      message: 'Cucian siap diambil dan telah dialokasikan ke rak simpan.',
      order: updated
    });
  } catch (error: any) {
    console.error('[Laundry API] Error setting ready status:', error);
    return res.status(500).json({ error: 'Gagal menetapkan status siap diambil.' });
  }
});

// ─── 6. POST /api/laundry/orders/:id/pickup (Serah Terima & Pelunasan) ───────
router.post('/orders/:id/pickup', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }
    const id = String(req.params.id);
    const { paidAmountNow, payAmount, paymentMethod = 'CASH' } = req.body;

    const order = await prisma.laundryOrder.findFirst({
      where: { id, tenantId },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    // Pastikan totalAmount valid (self-healing jika sebelumnya bernilai 0)
    let realTotalAmount = Number(order.totalAmount) || 0;
    let realSubtotal = Number(order.subtotal) || 0;
    if (realTotalAmount === 0 && Array.isArray(order.items) && order.items.length > 0) {
      realSubtotal = order.items.reduce((s: number, it: any) => {
        const lineSub = parseFloat(it.subtotal);
        if (!isNaN(lineSub) && lineSub > 0) return s + lineSub;
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.pricePerUnit) || 0;
        return s + (q * p);
      }, 0);
      realTotalAmount = Math.max(0, realSubtotal + (Number(order.speedSurcharge) || 0) - (Number(order.discount) || 0));
    }

    const currentPaid = Number(order.paidAmount) || 0;
    // Mendukung baik paidAmountNow maupun payAmount dari payload frontend
    const additionalPaid = Number(paidAmountNow ?? payAmount ?? 0);
    const newTotalPaid = currentPaid + additionalPaid;
    const isNowLunas = newTotalPaid >= realTotalAmount && realTotalAmount > 0;

    // Proteksi Shift Kasir Wajib Aktif jika ada pembayaran saat serah terima pakaian
    if (additionalPaid > 0) {
      const activeShift = await prisma.shift.findFirst({
        where: {
          status: { in: ['Open', 'OPEN'] },
          ...(tenantId ? { tenantId } : {})
        }
      });
      if (!activeShift) {
        return res.status(400).json({
          error: 'Shift kasir belum dibuka. Harap buka shift kasir dan masukkan modal awal laci terlebih dahulu sebelum memproses pelunasan cucian.',
          shiftRequired: true
        });
      }
    }

    const outlet = await prisma.outlet.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true }
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.laundryOrder.update({
        where: { id },
        data: {
          subtotal: realSubtotal > 0 ? realSubtotal : order.subtotal,
          totalAmount: realTotalAmount > 0 ? realTotalAmount : order.totalAmount,
          status: 'COMPLETED',
          completedAt: new Date(),
          pickupByUserId: userId ? Number(userId) : null,
          paidAmount: newTotalPaid,
          paymentStatus: isNowLunas ? 'PAID' : (newTotalPaid > 0 ? 'PARTIAL' : order.paymentStatus),
          paymentMethod: additionalPaid > 0 ? paymentMethod : (order.paymentMethod || paymentMethod)
        },
        include: { items: true }
      });

      // 2. If additional payment received at pickup, record to CashFlow
      if (additionalPaid > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet?.id || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Laundry',
            amount: additionalPaid,
            description: `Pelunasan Pengambilan Nota Cuci #${order.orderNumber} (${order.customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return updated;
    });

    return res.json({
      message: 'Cucian berhasil diserahkan kepada pelanggan.',
      order: result
    });
  } catch (error: any) {
    console.error('[Laundry API] Error processing pickup:', error);
    return res.status(500).json({ error: 'Gagal memproses pengambilan cucian.' });
  }
});

// ─── 7. GET /api/laundry/reports/stats (Dashboard & Tonase Harian) ───────────
router.get('/reports/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Orders today
    const ordersToday = await prisma.laundryOrder.findMany({
      where: {
        tenantId,
        createdAt: { gte: todayStart }
      },
      include: { items: true }
    });

    let totalKgToday = 0;
    let totalPcsToday = 0;
    let revenueToday = 0;

    for (const ord of ordersToday) {
      revenueToday += ord.paidAmount || 0;
      for (const it of ord.items) {
        if (it.unitType === 'KG') {
          totalKgToday += it.qty;
        } else {
          totalPcsToday += it.qty;
        }
      }
    }

    // 2. WIP Counts
    const [wipCount, readyCount, unpaidOrders] = await Promise.all([
      prisma.laundryOrder.count({
        where: {
          tenantId,
          status: { in: ['RECEIVED', 'WASHING', 'DRYING', 'IRONING'] }
        }
      }),
      prisma.laundryOrder.count({
        where: {
          tenantId,
          status: 'READY'
        }
      }),
      prisma.laundryOrder.findMany({
        where: {
          tenantId,
          status: { notIn: ['CANCELLED'] },
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] }
        },
        select: { totalAmount: true, paidAmount: true }
      })
    ]);

    const totalUnpaidPending = unpaidOrders.reduce((sum, o) => sum + (o.totalAmount - o.paidAmount), 0);

    return res.json({
      today: {
        ordersCount: ordersToday.length,
        totalKg: parseFloat(totalKgToday.toFixed(2)),
        totalPcs: totalPcsToday,
        revenue: revenueToday
      },
      wipCount,
      readyCount,
      unpaidPending: {
        count: unpaidOrders.length,
        amount: totalUnpaidPending
      }
    });
  } catch (error: any) {
    console.error('[Laundry API] Error getting stats:', error);
    return res.status(500).json({ error: 'Gagal memuat statistik laundry.' });
  }
});

// ─── 8. GET /api/laundry/reports/analytics (Executive Intelligence Dashboard) ──
router.get('/reports/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const { period = 'month', startDate, endDate } = req.query as Record<string, string>;

    const now = new Date();
    let periodStart = new Date();
    let periodEnd = new Date();

    if (period === 'today') {
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      periodStart.setDate(now.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === 'last_month') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (period === 'custom' && startDate) {
      periodStart = new Date(startDate);
      periodStart.setHours(0, 0, 0, 0);
      if (endDate) {
        periodEnd = new Date(endDate);
        periodEnd.setHours(23, 59, 59, 999);
      }
    } else {
      periodStart.setDate(now.getDate() - 30);
      periodStart.setHours(0, 0, 0, 0);
    }

    // 1. Ambil order dalam periode
    const periodOrders = await prisma.laundryOrder.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        },
        status: { notIn: ['CANCELLED'] }
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Kalkulasi Ringkasan Finansial & Tonase
    let totalKg = 0;
    let totalPcs = 0;
    let totalRevenue = 0;
    let totalSubtotal = 0;
    let totalSurcharge = 0;
    let totalDiscount = 0;
    let kiloanRevenue = 0;
    let satuanRevenue = 0;

    const servicePopularity: Record<string, { count: number; totalQty: number; revenue: number; unitType: string }> = {};
    const perfumeCount: Record<string, number> = {};

    const speedBreakdown: Record<string, { count: number; revenue: number; surcharge: number }> = {
      REGULAR: { count: 0, revenue: 0, surcharge: 0 },
      KILAT_24H: { count: 0, revenue: 0, surcharge: 0 },
      EXPRESS_6H: { count: 0, revenue: 0, surcharge: 0 }
    };
    const paymentMethods: Record<string, { count: number; total: number }> = {};
    const pipelineStatus: Record<string, number> = {
      RECEIVED: 0,
      WASHING: 0,
      DRYING: 0,
      IRONING: 0,
      READY: 0,
      COMPLETED: 0
    };

    let onTimeCount = 0;
    let lateCount = 0;

    for (const ord of periodOrders) {
      totalRevenue += ord.paidAmount || 0;
      totalSubtotal += ord.subtotal || 0;
      totalSurcharge += ord.speedSurcharge || 0;
      totalDiscount += ord.discount || 0;

      if (ord.perfumeVariant) {
        perfumeCount[ord.perfumeVariant] = (perfumeCount[ord.perfumeVariant] || 0) + 1;
      }

      const sp = (ord.serviceSpeed || 'REGULAR') as string;
      if (speedBreakdown[sp]) {
        speedBreakdown[sp].count++;
        speedBreakdown[sp].revenue += ord.totalAmount || 0;
        speedBreakdown[sp].surcharge += ord.speedSurcharge || 0;
      }

      const pm = ord.paymentMethod || 'CASH';
      if (!paymentMethods[pm]) paymentMethods[pm] = { count: 0, total: 0 };
      paymentMethods[pm].count++;
      paymentMethods[pm].total += ord.paidAmount || 0;

      const st = ord.status || 'RECEIVED';
      if (pipelineStatus[st] !== undefined) {
        pipelineStatus[st]++;
      }

      // Hitung On-Time SLA
      if (ord.estimatedDoneAt) {
        const finishTime = ord.completedAt || ord.readyAt;
        if (finishTime) {
          if (new Date(finishTime) <= new Date(ord.estimatedDoneAt)) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        }
      }

      for (const it of ord.items) {
        const sName = it.serviceName;
        if (!servicePopularity[sName]) {
          servicePopularity[sName] = { count: 0, totalQty: 0, revenue: 0, unitType: it.unitType };
        }
        servicePopularity[sName].count += 1;
        servicePopularity[sName].totalQty += it.qty;
        servicePopularity[sName].revenue += it.subtotal;

        if (it.unitType === 'KG') {
          totalKg += it.qty;
          kiloanRevenue += it.subtotal;
        } else {
          totalPcs += it.qty;
          satuanRevenue += it.subtotal;
        }
      }
    }

    // 3. ANALITIK AGING RACK (Cucian mengendap di rak simpan saat ini)
    const rackOrders = await prisma.laundryOrder.findMany({
      where: {
        tenantId,
        status: 'READY'
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true, phone: true } }
      },
      orderBy: { readyAt: 'asc' }
    });

    let totalValueInRack = 0;
    let totalUnpaidInRack = 0;

    const agingBuckets = {
      days0_3: { count: 0, amount: 0, unpaidAmount: 0 },
      days4_7: { count: 0, amount: 0, unpaidAmount: 0 },
      days8_14: { count: 0, amount: 0, unpaidAmount: 0 },
      days15_30: { count: 0, amount: 0, unpaidAmount: 0 },
      daysOver30: { count: 0, amount: 0, unpaidAmount: 0 }
    };

    const overdueRackOrders: any[] = [];

    for (const rOrd of rackOrders) {
      const orderTotal = rOrd.totalAmount || 0;
      const orderPaid = rOrd.paidAmount || 0;
      const unpaid = Math.max(0, orderTotal - orderPaid);

      totalValueInRack += orderTotal;
      totalUnpaidInRack += unpaid;

      const readyDate = rOrd.readyAt || rOrd.updatedAt || rOrd.createdAt;
      const daysInRack = Math.max(0, Math.floor((now.getTime() - new Date(readyDate).getTime()) / (1000 * 60 * 60 * 24)));

      if (daysInRack <= 3) {
        agingBuckets.days0_3.count++;
        agingBuckets.days0_3.amount += orderTotal;
        agingBuckets.days0_3.unpaidAmount += unpaid;
      } else if (daysInRack <= 7) {
        agingBuckets.days4_7.count++;
        agingBuckets.days4_7.amount += orderTotal;
        agingBuckets.days4_7.unpaidAmount += unpaid;
      } else if (daysInRack <= 14) {
        agingBuckets.days8_14.count++;
        agingBuckets.days8_14.amount += orderTotal;
        agingBuckets.days8_14.unpaidAmount += unpaid;
      } else if (daysInRack <= 30) {
        agingBuckets.days15_30.count++;
        agingBuckets.days15_30.amount += orderTotal;
        agingBuckets.days15_30.unpaidAmount += unpaid;
      } else {
        agingBuckets.daysOver30.count++;
        agingBuckets.daysOver30.amount += orderTotal;
        agingBuckets.daysOver30.unpaidAmount += unpaid;
      }

      // Order yang mengendap > 3 hari dikelompokkan untuk aksi kirim WA
      if (daysInRack >= 4) {
        overdueRackOrders.push({
          id: rOrd.id,
          orderNumber: rOrd.orderNumber,
          customerName: rOrd.customerName,
          customerPhone: rOrd.customerPhone,
          rackLocation: rOrd.rackLocation || 'Rak Simpan',
          daysInRack,
          readyAt: rOrd.readyAt,
          totalAmount: orderTotal,
          paidAmount: orderPaid,
          unpaidAmount: unpaid,
          paymentStatus: rOrd.paymentStatus
        });
      }
    }

    // 4. AT-RISK CHURN CUSTOMER DETECTOR (Pelanggan langganan yang > 14 hari tidak datang)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentOrders = await prisma.laundryOrder.findMany({
      where: {
        tenantId,
        createdAt: { gte: fourteenDaysAgo }
      },
      select: { customerPhone: true, customerName: true }
    });
    const recentCustomerKeys = new Set(
      recentOrders.map(o => o.customerPhone || o.customerName.toLowerCase())
    );

    const pastOrders = await prisma.laundryOrder.findMany({
      where: {
        tenantId,
        createdAt: { lt: fourteenDaysAgo },
        status: { notIn: ['CANCELLED'] }
      },
      select: {
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    const atRiskMap = new Map<string, { customerName: string; customerPhone?: string; lastOrderDate: string; totalSpend: number; orderCount: number }>();
    for (const p of pastOrders) {
      const key = p.customerPhone || p.customerName.toLowerCase();
      if (!recentCustomerKeys.has(key)) {
        if (!atRiskMap.has(key)) {
          atRiskMap.set(key, {
            customerName: p.customerName,
            customerPhone: p.customerPhone || undefined,
            lastOrderDate: p.createdAt.toISOString(),
            totalSpend: p.totalAmount,
            orderCount: 1
          });
        } else {
          const entry = atRiskMap.get(key)!;
          entry.totalSpend += p.totalAmount;
          entry.orderCount += 1;
        }
      }
    }

    const atRiskCustomers = Array.from(atRiskMap.values())
      .filter(c => c.orderCount >= 1)
      .slice(0, 15);

    // 5. CHEMICAL USAGE VS TONNAGE
    const chemicalIngredients = await prisma.ingredient.findMany({
      where: { tenantId },
      select: { id: true, name: true, stock: true, unit: true, buyPrice: true }
    });

    // Estimasi pemakaian teoritis deterjen (25 ml / kg) & parfum (15 ml / kg)
    const estimatedDetergentNeededLiters = parseFloat(((totalKg * 25) / 1000).toFixed(1));
    const estimatedPerfumeNeededLiters = parseFloat(((totalKg * 15) / 1000).toFixed(1));

    // 6. CASHFLOW & PETTY CASH OPERASIONAL LAUNDRY
    const cashFlows = await prisma.cashFlow.findMany({
      where: {
        tenantId,
        date: { gte: periodStart, lte: periodEnd },
        status: { not: 'REJECTED' }
      }
    });

    let totalExpense = 0;
    const expenseCategories: Record<string, number> = {};
    for (const cf of cashFlows) {
      if (cf.type === 'Pengeluaran') {
        totalExpense += cf.amount;
        const cat = cf.category || 'Operasional Laundry';
        expenseCategories[cat] = (expenseCategories[cat] || 0) + cf.amount;
      }
    }

    const netOperatingProfit = totalRevenue - totalExpense;
    const netProfitMargin = totalRevenue > 0 ? Math.round((netOperatingProfit / totalRevenue) * 100) : 0;

    // Urutkan layanan terpopuler
    const topServices = Object.entries(servicePopularity)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const onTimeRate = (onTimeCount + lateCount) > 0
      ? Math.round((onTimeCount / (onTimeCount + lateCount)) * 100)
      : 100;

    // 7. OPERATOR PERFORMANCE & PIECE-RATE COMMISSION (Cuci, Setrika, Serah Terima)
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, username: true, role: true }
    });
    const userMap = new Map<number, { id: number; name: string; role: string }>();
    for (const u of tenantUsers) {
      userMap.set(u.id, { id: u.id, name: u.name || u.username, role: u.role });
    }

    const opStatsMap = new Map<number, {
      userId: number;
      name: string;
      role: string;
      washedOrdersCount: number;
      washedKg: number;
      washedPcs: number;
      ironedOrdersCount: number;
      ironedKg: number;
      ironedPcs: number;
      handedOverCount: number;
    }>();

    const ensureOp = (uid: number) => {
      if (!opStatsMap.has(uid)) {
        const info = userMap.get(uid) || { id: uid, name: `Staf #${uid}`, role: 'STAFF' };
        opStatsMap.set(uid, {
          userId: uid,
          name: info.name,
          role: info.role,
          washedOrdersCount: 0,
          washedKg: 0,
          washedPcs: 0,
          ironedOrdersCount: 0,
          ironedKg: 0,
          ironedPcs: 0,
          handedOverCount: 0
        });
      }
      return opStatsMap.get(uid)!;
    };

    for (const ord of periodOrders) {
      let ordKg = 0;
      let ordPcs = 0;
      for (const it of ord.items) {
        if (it.unitType === 'KG') ordKg += it.qty;
        else ordPcs += it.qty;
      }

      if (ord.washerUserId) {
        const op = ensureOp(ord.washerUserId);
        op.washedOrdersCount += 1;
        op.washedKg = parseFloat((op.washedKg + ordKg).toFixed(2));
        op.washedPcs += ordPcs;
      }
      if (ord.ironerUserId) {
        const op = ensureOp(ord.ironerUserId);
        op.ironedOrdersCount += 1;
        op.ironedKg = parseFloat((op.ironedKg + ordKg).toFixed(2));
        op.ironedPcs += ordPcs;
      }
      if (ord.pickupByUserId) {
        const op = ensureOp(ord.pickupByUserId);
        op.handedOverCount += 1;
      }
    }

    // Jika belum ada order yang tercatat operatornya namun ada staf di tenant, sertakan daftar staf agar tetap terlihat di tabel
    for (const u of tenantUsers) {
      ensureOp(u.id);
    }

    const operatorPerformance = Array.from(opStatsMap.values()).sort(
      (a, b) => (b.washedKg + b.ironedKg) - (a.washedKg + a.ironedKg)
    );

    return res.json({
      period: {
        type: period,
        startDate: periodStart.toISOString(),
        endDate: periodEnd.toISOString()
      },
      summary: {
        totalOrders: periodOrders.length,
        totalKg: parseFloat(totalKg.toFixed(2)),
        totalPcs,
        totalRevenue,
        totalSubtotal,
        totalSurcharge,
        totalDiscount,
        avgTicket: periodOrders.length > 0 ? Math.round(totalRevenue / periodOrders.length) : 0,
        kiloanRevenue,
        satuanRevenue,
        kiloanPercentage: totalSubtotal > 0 ? Math.round((kiloanRevenue / totalSubtotal) * 100) : 0,
        satuanPercentage: totalSubtotal > 0 ? Math.round((satuanRevenue / totalSubtotal) * 100) : 0,
        onTimeRate,
        totalExpense,
        netOperatingProfit,
        netProfitMargin
      },
      expenses: {
        totalExpense,
        categories: Object.entries(expenseCategories).map(([category, amount]) => ({ category, amount }))
      },
      speedBreakdown,
      paymentMethods: Object.entries(paymentMethods).map(([method, data]) => ({ method, ...data })),
      pipelineStatus,
      agingRack: {
        totalValueInRack,
        totalUnpaidInRack,
        rackOrdersCount: rackOrders.length,
        buckets: agingBuckets,
        overdueOrders: overdueRackOrders
      },
      topServices,
      perfumePopularity: Object.entries(perfumeCount).map(([name, count]) => ({ name, count })),
      chemicalEfficiency: {
        totalKgDicuci: parseFloat(totalKg.toFixed(2)),
        estimatedDetergentNeededLiters,
        estimatedPerfumeNeededLiters,
        currentStock: chemicalIngredients
      },
      atRiskCustomers,
      operatorPerformance
    });
  } catch (error: any) {
    console.error('[Laundry Analytics Error]', error);
    return res.status(500).json({ error: 'Gagal memuat analitik laundry.' });
  }
});


// PATCH /api/laundry/orders/:id/delivery-status
router.patch('/orders/:id/delivery-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const orderId = String(req.params.id);
    const { pickupStatus, deliveryStatus, courierName, courierPhone } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }

    const existing = await prisma.laundryOrder.findFirst({
      where: { id: orderId, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan' });
    }

    const updateData: any = {
      ...(pickupStatus ? { pickupStatus } : {}),
      ...(deliveryStatus ? { deliveryStatus } : {}),
      ...(courierName !== undefined ? { courierName } : {}),
      ...(courierPhone !== undefined ? { courierPhone } : {})
    };

    const updated = await prisma.laundryOrder.update({
      where: { id: orderId },
      data: updateData
    });

    const { emitToTenant, emitToTracking } = require('../index');
    emitToTenant(tenantId, 'laundry:delivery_updated', updated);

    if (updated.trackingCode) {
      emitToTracking(updated.trackingCode, 'tracking:updated', {
        pickupStatus: updated.pickupStatus,
        deliveryStatus: updated.deliveryStatus,
        courierName: updated.courierName,
        courierPhone: updated.courierPhone
      });
    }

    return res.json({ success: true, order: updated });
  } catch (err: any) {
    console.error('[Patch Laundry Delivery Status Error]:', err);
    return res.status(500).json({ error: 'Gagal memperbarui status pengantaran laundry' });
  }
});

// ─── 9. GET /api/laundry/customers (Cari Member Laundry, Deposit & Kuota Kg) ──
router.get('/customers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }
    const q = String(req.query.q || '').trim();
    const where: any = { tenantId, deletedAt: null };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } }
      ];
    }
    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        points: true,
        tier: true,
        laundryDeposit: true,
        laundryQuotaKg: true
      },
      orderBy: [{ laundryQuotaKg: 'desc' }, { laundryDeposit: 'desc' }, { updatedAt: 'desc' }],
      take: 30
    });
    return res.json({ customers });
  } catch (err: any) {
    console.error('[Laundry Customers Search Error]:', err);
    return res.status(500).json({ error: 'Gagal mencari pelanggan laundry.' });
  }
});

// ─── 10. POST /api/laundry/customers/topup (Top-up Deposit / Paket Kuota Kg) ──
router.post('/customers/topup', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const {
      customerId,
      customerName,
      customerPhone,
      topupType = 'QUOTA_KG', // 'QUOTA_KG' | 'DEPOSIT'
      addedQuotaKg = 0,
      addedDeposit = 0,
      pricePaid = 0,
      paymentMethod = 'CASH',
      packageName = 'Paket Member Laundry'
    } = req.body;

    const finalPaid = Math.max(0, parseFloat(pricePaid) || 0);
    const finalAddedKg = Math.max(0, parseFloat(addedQuotaKg) || 0);
    const finalAddedDeposit = Math.max(0, parseFloat(addedDeposit) || 0);

    if (topupType === 'QUOTA_KG' && finalAddedKg <= 0) {
      return res.status(400).json({ error: 'Jumlah kuota Kg yang ditambahkan harus lebih dari 0.' });
    }
    if (topupType === 'DEPOSIT' && finalAddedDeposit <= 0) {
      return res.status(400).json({ error: 'Nominal saldo deposit yang ditambahkan harus lebih dari 0.' });
    }

    // Pastikan shift kasir aktif jika menerima pembayaran
    if (finalPaid > 0) {
      const activeShift = await prisma.shift.findFirst({
        where: {
          status: { in: ['Open', 'OPEN'] },
          tenantId
        }
      });
      if (!activeShift) {
        return res.status(400).json({
          error: 'Shift kasir belum dibuka. Harap buka shift kasir terlebih dahulu sebelum menerima pembayaran paket member/deposit.',
          shiftRequired: true
        });
      }
    }

    const outlet = await prisma.outlet.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true }
    });

    const updatedCustomer = await prisma.$transaction(async (tx) => {
      let targetCustomer = null;
      if (customerId) {
        targetCustomer = await tx.customer.findFirst({
          where: { id: Number(customerId), tenantId, deletedAt: null }
        });
      }
      if (!targetCustomer && customerPhone) {
        targetCustomer = await tx.customer.findFirst({
          where: { tenantId, phone: String(customerPhone).trim(), deletedAt: null }
        });
      }

      if (!targetCustomer) {
        if (!customerName || !customerPhone) {
          throw new Error('Nama dan nomor WhatsApp pelanggan wajib diisi untuk mendaftarkan member baru.');
        }
        targetCustomer = await tx.customer.create({
          data: {
            tenantId,
            name: String(customerName).trim(),
            phone: String(customerPhone).trim(),
            laundryQuotaKg: topupType === 'QUOTA_KG' ? finalAddedKg : 0,
            laundryDeposit: topupType === 'DEPOSIT' ? finalAddedDeposit : 0,
            totalSpent: finalPaid
          }
        });
      } else {
        targetCustomer = await tx.customer.update({
          where: { id: targetCustomer.id },
          data: {
            ...(topupType === 'QUOTA_KG' ? { laundryQuotaKg: { increment: finalAddedKg } } : {}),
            ...(topupType === 'DEPOSIT' ? { laundryDeposit: { increment: finalAddedDeposit } } : {}),
            totalSpent: { increment: finalPaid }
          }
        });
      }

      if (finalPaid > 0 && userId) {
        const desc = topupType === 'QUOTA_KG'
          ? `Pembelian ${packageName} (+${finalAddedKg} Kg) - ${targetCustomer.name} [${paymentMethod}]`
          : `Top-up Deposit Laundry (+Rp ${finalAddedDeposit.toLocaleString('id-ID')}) - ${targetCustomer.name} [${paymentMethod}]`;

        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet?.id || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Laundry',
            amount: finalPaid,
            description: desc,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return targetCustomer;
    });

    return res.status(201).json({
      message: topupType === 'QUOTA_KG'
        ? `Paket Kuota +${finalAddedKg} Kg berhasil ditambahkan ke ${updatedCustomer.name}.`
        : `Saldo Deposit +Rp ${finalAddedDeposit.toLocaleString('id-ID')} berhasil ditambahkan ke ${updatedCustomer.name}.`,
      customer: updatedCustomer
    });
  } catch (err: any) {
    console.error('[Laundry Topup Error]:', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses top-up member laundry.' });
  }
});

// ─── DEFAULT DELIVERY ZONES (JEMPUT & ANTAR TERPISAH) ─────────────────────────
const DEFAULT_LAUNDRY_DELIVERY_ZONES = [
  {
    id: 'zone-1',
    name: 'Zona 1 — Radius < 2 Km (Area Dekat)',
    pickupFee: 0,
    deliveryFee: 0,
    description: 'Gratis biaya jemput & antar untuk jarak di bawah 2 Km'
  },
  {
    id: 'zone-2',
    name: 'Zona 2 — Radius 2 s/d 5 Km (Area Sedang)',
    pickupFee: 5000,
    deliveryFee: 5000,
    description: 'Ongkir jemput Rp 5.000 & ongkir antar Rp 5.000'
  },
  {
    id: 'zone-3',
    name: 'Zona 3 — Radius > 5 Km (Area Jauh)',
    pickupFee: 10000,
    deliveryFee: 10000,
    description: 'Ongkir jemput Rp 10.000 & ongkir antar Rp 10.000'
  }
];

// ─── 11. GET & PUT /api/laundry/portal-settings (QRIS Statis, Webhook & Zona) ─
router.get('/portal-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const [tenant, existingConfig] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, phone: true, logoUrl: true }
      }),
      prisma.tenantPaymentConfig.findUnique({
        where: { tenantId }
      })
    ]);

    let webhookSecret = existingConfig?.qrisWebhookSecret || '';
    if (!webhookSecret) {
      webhookSecret = `lnd_wh_${crypto.randomBytes(12).toString('hex')}`;
      await prisma.tenantPaymentConfig.upsert({
        where: { tenantId },
        create: {
          tenantId,
          qrisWebhookSecret: webhookSecret,
          laundryDeliveryZones: DEFAULT_LAUNDRY_DELIVERY_ZONES
        },
        update: {
          qrisWebhookSecret: webhookSecret
        }
      });
    }

    const deliveryZones = Array.isArray(existingConfig?.laundryDeliveryZones) && (existingConfig?.laundryDeliveryZones as any[]).length > 0
      ? existingConfig?.laundryDeliveryZones
      : DEFAULT_LAUNDRY_DELIVERY_ZONES;

    const rawStatic = existingConfig?.qrisStaticPayload || '';
    const effectiveStatic = rawStatic && isValidStaticQris(rawStatic)
      ? rawStatic
      : buildFallbackStaticQris(tenant?.name || 'LAUNDRY OUTLET');

    return res.json({
      tenantSlug: tenant?.slug || tenantId,
      tenantName: tenant?.name || 'Laundry Outlet',
      qrisStaticPayload: rawStatic,
      effectiveStaticPayload: effectiveStatic,
      hasCustomQris: Boolean(rawStatic && isValidStaticQris(rawStatic)),
      qrisWebhookSecret: webhookSecret,
      deliveryZones
    });
  } catch (err: any) {
    console.error('[GET Laundry Portal Settings Error]:', err);
    return res.status(500).json({ error: 'Gagal memuat pengaturan Portal Pelanggan & QRIS.' });
  }
});

router.put('/portal-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const { qrisStaticPayload, deliveryZones, regenerateSecret } = req.body;

    if (qrisStaticPayload && String(qrisStaticPayload).trim() !== '') {
      const cleanQris = String(qrisStaticPayload).trim();
      if (!isValidStaticQris(cleanQris)) {
        return res.status(400).json({
          error: 'String QRIS Statis tidak valid. Pastikan diawali "000201" sesuai standar EMVCo QRIS Indonesia.'
        });
      }
    }

    const existing = await prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });
    const nextSecret = regenerateSecret || !existing?.qrisWebhookSecret
      ? `lnd_wh_${crypto.randomBytes(12).toString('hex')}`
      : existing.qrisWebhookSecret;

    const sanitizedZones = Array.isArray(deliveryZones) && deliveryZones.length > 0
      ? deliveryZones.map((z: any, i: number) => ({
          id: String(z.id || `zone-${i + 1}`),
          name: String(z.name || `Zona ${i + 1}`).trim(),
          pickupFee: Math.max(0, Number(z.pickupFee) || 0),
          deliveryFee: Math.max(0, Number(z.deliveryFee) || 0),
          description: String(z.description || '').trim()
        }))
      : DEFAULT_LAUNDRY_DELIVERY_ZONES;

    const updated = await prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        qrisStaticPayload: qrisStaticPayload !== undefined ? String(qrisStaticPayload).trim() || null : null,
        qrisWebhookSecret: nextSecret,
        laundryDeliveryZones: sanitizedZones
      },
      update: {
        ...(qrisStaticPayload !== undefined ? { qrisStaticPayload: String(qrisStaticPayload).trim() || null } : {}),
        qrisWebhookSecret: nextSecret,
        laundryDeliveryZones: sanitizedZones
      }
    });

    return res.json({
      message: 'Pengaturan QRIS Dinamis & Zona Antar-Jemput berhasil disimpan.',
      qrisStaticPayload: updated.qrisStaticPayload || '',
      hasCustomQris: Boolean(updated.qrisStaticPayload && isValidStaticQris(updated.qrisStaticPayload)),
      qrisWebhookSecret: updated.qrisWebhookSecret,
      deliveryZones: updated.laundryDeliveryZones
    });
  } catch (err: any) {
    console.error('[PUT Laundry Portal Settings Error]:', err);
    return res.status(500).json({ error: 'Gagal menyimpan pengaturan Portal Pelanggan & QRIS.' });
  }
});

// ─── 12. PATCH /api/laundry/orders/:id/weigh-update (Update Timbangan Aktual) ─
router.patch('/orders/:id/weigh-update', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const orderId = String(req.params.id);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const existing = await prisma.laundryOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    const {
      items = [],
      speedSurcharge,
      discount,
      pickupFee,
      deliveryFee,
      intakePhotos,
      itemCountNotes,
      specialNotes
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar hasil timbangan tidak boleh kosong.' });
    }

    const computedSub = items.reduce((sum: number, it: any) => {
      const q = parseFloat(it.qty) || 0;
      const p = parseFloat(it.pricePerUnit) || 0;
      return sum + Math.round(q * p);
    }, 0);

    const nextSurcharge = speedSurcharge !== undefined ? parseFloat(speedSurcharge) || 0 : existing.speedSurcharge;
    const nextDiscount = discount !== undefined ? parseFloat(discount) || 0 : existing.discount;
    const nextPickupFee = pickupFee !== undefined ? parseFloat(pickupFee) || 0 : existing.pickupFee;
    const nextDeliveryFee = deliveryFee !== undefined ? parseFloat(deliveryFee) || 0 : existing.deliveryFee;
    const nextTotal = Math.max(0, computedSub + nextSurcharge + nextPickupFee + nextDeliveryFee - nextDiscount);

    const paid = existing.paidAmount || 0;
    const nextPaymentStatus = paid >= nextTotal && nextTotal > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';

    const sanitizedPhotos = Array.isArray(intakePhotos)
      ? intakePhotos.filter((p: any) => typeof p === 'string' && p.length > 0).slice(0, 5)
      : undefined;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.laundryOrderItem.deleteMany({ where: { orderId } });
      return tx.laundryOrder.update({
        where: { id: orderId },
        data: {
          subtotal: computedSub,
          speedSurcharge: nextSurcharge,
          discount: nextDiscount,
          pickupFee: nextPickupFee,
          deliveryFee: nextDeliveryFee,
          totalAmount: nextTotal,
          paymentStatus: nextPaymentStatus,
          pickupStatus: existing.pickupStatus === 'PENDING' || existing.pickupStatus === 'PICKING_UP'
            ? 'ARRIVED_AT_OUTLET'
            : existing.pickupStatus,
          // Reset kode unik QRIS agar di-generate ulang sesuai nominal timbangan aktual
          qrisUniqueCode: 0,
          qrisUniqueAmount: 0,
          ...(itemCountNotes !== undefined ? { itemCountNotes: String(itemCountNotes) } : {}),
          ...(specialNotes !== undefined ? { specialNotes: String(specialNotes) } : {}),
          ...(sanitizedPhotos ? { intakePhotos: sanitizedPhotos } : {}),
          items: {
            create: items.map((it: any) => ({
              serviceName: String(it.serviceName || 'Layanan Cuci').trim(),
              unitType: String(it.unitType || 'KG').toUpperCase(),
              qty: parseFloat(it.qty) || 1,
              pricePerUnit: parseFloat(it.pricePerUnit) || 0,
              subtotal: Math.round((parseFloat(it.qty) || 1) * (parseFloat(it.pricePerUnit) || 0)),
              notes: it.notes ? String(it.notes).trim() : null
            }))
          }
        },
        include: { items: true }
      });
    });

    const { emitToTenant, emitToTracking } = require('../index');
    emitToTenant(tenantId, 'laundry:order_updated', updatedOrder);
    if (updatedOrder.trackingCode) {
      emitToTracking(updatedOrder.trackingCode, 'tracking:updated', {
        subtotal: updatedOrder.subtotal,
        pickupFee: updatedOrder.pickupFee,
        deliveryFee: updatedOrder.deliveryFee,
        totalAmount: updatedOrder.totalAmount,
        paymentStatus: updatedOrder.paymentStatus,
        pickupStatus: updatedOrder.pickupStatus,
        intakePhotos: updatedOrder.intakePhotos,
        items: updatedOrder.items
      });
    }

    return res.json({
      message: 'Hasil timbangan aktual dan rincian biaya berhasil diperbarui.',
      order: updatedOrder
    });
  } catch (err: any) {
    console.error('[Weigh Update Error]:', err);
    return res.status(500).json({ error: 'Gagal memperbarui hasil timbangan cucian.' });
  }
});

// ─── HELPER: RESOLVE TENANT BY SLUG OR ID FOR PUBLIC PORTAL ───────────────────
async function resolveLaundryTenantBySlug(slugOrId: string) {
  const clean = String(slugOrId || '').trim();
  if (!clean) return null;

  let tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: { equals: clean, mode: 'insensitive' } },
        { id: clean }
      ],
      status: { in: ['ACTIVE', 'TRIAL'] }
    }
  });

  if (!tenant && (clean === 'demo' || clean === 'default')) {
    tenant = await prisma.tenant.findFirst({
      where: {
        businessType: 'LAUNDRY',
        status: { in: ['ACTIVE', 'TRIAL'] }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  return tenant;
}

// ─── 13. GET /api/laundry/public/store/:tenantSlug (Info Katalog & Zona) ──────
router.get('/public/store/:tenantSlug', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveLaundryTenantBySlug(String(req.params.tenantSlug || ''));
    if (!tenant) {
      return res.status(404).json({ error: 'Outlet Laundry tidak ditemukan atau sedang tidak aktif.' });
    }

    const [settings, paymentConfig, products] = await Promise.all([
      prisma.settings.findFirst({ where: { tenantId: tenant.id } }),
      prisma.tenantPaymentConfig.findUnique({ where: { tenantId: tenant.id } }),
      prisma.product.findMany({
        where: { tenantId: tenant.id, isActive: true, deletedAt: null },
        orderBy: { name: 'asc' },
        take: 50
      })
    ]);

    const deliveryZones = Array.isArray(paymentConfig?.laundryDeliveryZones) && (paymentConfig?.laundryDeliveryZones as any[]).length > 0
      ? paymentConfig?.laundryDeliveryZones
      : DEFAULT_LAUNDRY_DELIVERY_ZONES;

    const defaultServices = [
      { id: 'srv-kilo-1', name: 'Cuci Komplit (Cuci + Kering + Setrika)', unitType: 'KG', price: 8000, category: 'KILOAN' },
      { id: 'srv-kilo-2', name: 'Cuci Lipat Rapi (Tanpa Setrika)', unitType: 'KG', price: 6000, category: 'KILOAN' },
      { id: 'srv-kilo-3', name: 'Jasa Setrika Uap Saja', unitType: 'KG', price: 5500, category: 'KILOAN' },
      { id: 'srv-sat-1', name: 'Cuci Bedcover Besar / King', unitType: 'PCS', price: 35000, category: 'SATUAN' },
      { id: 'srv-sat-2', name: 'Cuci Sepatu Sneakers Deep Clean', unitType: 'PSG', price: 30000, category: 'SATUAN' },
      { id: 'srv-sat-3', name: 'Dry Clean Jas / Kebaya / Gaun', unitType: 'PCS', price: 45000, category: 'SATUAN' },
      { id: 'srv-mtr-1', name: 'Cuci Karpet Bulu / Masjid (P x L)', unitType: 'METER', price: 20000, category: 'METER' },
      { id: 'srv-mtr-2', name: 'Cuci Gorden / Vitrase (P x L)', unitType: 'METER', price: 15000, category: 'METER' }
    ];

    const catalogServices = products.length > 0
      ? products.map((p: any) => {
          const nameUpper = String(p.name || '').toUpperCase();
          const unitType = nameUpper.includes('METER') || nameUpper.includes('M2') || nameUpper.includes('KARPET') || nameUpper.includes('GORDEN')
            ? 'METER'
            : nameUpper.includes('KG') || nameUpper.includes('KILO')
              ? 'KG'
              : 'PCS';
          return {
            id: String(p.id),
            name: p.name,
            unitType,
            price: p.price,
            category: unitType === 'KG' ? 'KILOAN' : unitType === 'METER' ? 'METER' : 'SATUAN'
          };
        })
      : defaultServices;

    return res.json({
      tenant: {
        id: tenant.id,
        name: settings?.storeName && settings.storeName !== 'DEMO CAFE' ? settings.storeName : tenant.name,
        slug: tenant.slug,
        phone: settings?.phone || tenant.phone || '',
        address: settings?.address || '',
        logoUrl: settings?.logoUrl || tenant.logoUrl || ''
      },
      deliveryZones,
      services: catalogServices,
      perfumeVariants: ['Sakura', 'Akasia', 'Ocean Fresh', 'Downy Mystique', 'Snappy', 'Lavender', 'Tanpa Parfum'],
      speedOptions: [
        { code: 'REGULAR', label: 'Reguler (2 - 3 Hari)', multiplier: 1 },
        { code: 'KILAT_24H', label: 'Kilat 24 Jam (+50%)', multiplier: 1.5 },
        { code: 'EXPRESS_6H', label: 'Express 6 Jam (+100%)', multiplier: 2 }
      ]
    });
  } catch (err: any) {
    console.error('[GET Public Store Laundry Error]:', err);
    return res.status(500).json({ error: 'Gagal memuat informasi outlet laundry.' });
  }
});

// ─── 14. GET /api/laundry/public/customer-lookup (Cek Status & Saldo via WA) ─
router.get('/public/customer-lookup', async (req: Request, res: Response) => {
  try {
    const tenantSlug = String(req.query.tenantSlug || '');
    const rawPhone = String(req.query.phone || '').trim();
    if (!rawPhone || rawPhone.length < 6) {
      return res.status(400).json({ error: 'Masukkan nomor WhatsApp yang valid (minimal 6 digit).' });
    }

    const tenant = await resolveLaundryTenantBySlug(tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: 'Outlet Laundry tidak ditemukan.' });
    }

    // Normalisasi beberapa variasi nomor WA (08xx vs 628xx)
    const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
    const tailDigits = digitsOnly.length > 8 ? digitsOnly.slice(-8) : digitsOnly;

    const [customer, orders] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          phone: { contains: tailDigits }
        },
        select: {
          id: true,
          name: true,
          phone: true,
          tier: true,
          points: true,
          laundryQuotaKg: true,
          laundryDeposit: true
        }
      }),
      prisma.laundryOrder.findMany({
        where: {
          tenantId: tenant.id,
          customerPhone: { contains: tailDigits }
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 15
      })
    ]);

    return res.json({
      customer: customer || null,
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        trackingCode: o.trackingCode,
        customerName: o.customerName,
        serviceCategory: o.serviceCategory,
        serviceSpeed: o.serviceSpeed,
        perfumeVariant: o.perfumeVariant,
        status: o.status,
        deliveryType: o.deliveryType,
        pickupStatus: o.pickupStatus,
        deliveryStatus: o.deliveryStatus,
        pickupFee: o.pickupFee,
        deliveryFee: o.deliveryFee,
        subtotal: o.subtotal,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        items: o.items
      }))
    });
  } catch (err: any) {
    console.error('[Customer Lookup Laundry Error]:', err);
    return res.status(500).json({ error: 'Gagal mencari data pelanggan.' });
  }
});

// ─── 15. POST /api/laundry/public/book-pickup (Order Jemput & Antar Mandiri) ──
router.post('/public/book-pickup', async (req: Request, res: Response) => {
  try {
    const {
      tenantSlug,
      customerName,
      customerPhone,
      deliveryType = 'FULL_SERVICE', // 'FULL_SERVICE' | 'PICKUP_ONLY' | 'DELIVERY_ONLY'
      pickupFee = 0,
      deliveryFee = 0,
      pickupAddress = '',
      pickupTimeSlot = 'Segera (Hari Ini)',
      deliveryAddress = '',
      deliveryNotes = '',
      serviceCategory = 'KILOAN',
      serviceSpeed = 'REGULAR',
      perfumeVariant = 'Sakura',
      specialNotes = '',
      items = []
    } = req.body;

    if (!customerName || String(customerName).trim().length < 2) {
      return res.status(400).json({ error: 'Nama pelanggan wajib diisi.' });
    }
    if (!customerPhone || String(customerPhone).trim().length < 8) {
      return res.status(400).json({ error: 'Nomor WhatsApp aktif wajib diisi.' });
    }
    if ((deliveryType === 'FULL_SERVICE' || deliveryType === 'PICKUP_ONLY') && !String(pickupAddress).trim()) {
      return res.status(400).json({ error: 'Alamat penjemputan cucian wajib diisi.' });
    }

    const tenant = await resolveLaundryTenantBySlug(String(tenantSlug || ''));
    if (!tenant) {
      return res.status(404).json({ error: 'Outlet Laundry tidak ditemukan.' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      select: { id: true }
    });

    const orderNumber = await generateLaundryOrderNumber(tenant.id);
    const trackingCode = generateTrackingCode('LND');

    const normalizedItems = Array.isArray(items) && items.length > 0
      ? items.map((it: any) => {
          const qty = Math.max(0.5, parseFloat(it.qty) || 1);
          const pricePerUnit = Math.max(0, parseFloat(it.pricePerUnit) || 8000);
          return {
            serviceName: String(it.serviceName || 'Cuci Komplit (Estimasi Awal)').trim(),
            unitType: String(it.unitType || 'KG').toUpperCase(),
            qty,
            pricePerUnit,
            subtotal: Math.round(qty * pricePerUnit),
            notes: it.notes ? String(it.notes).trim() : 'Estimasi awal pelanggan (Menunggu timbangan aktual di outlet)'
          };
        })
      : [
          {
            serviceName: 'Cuci Komplit Reguler (Estimasi Awal)',
            unitType: 'KG',
            qty: 3,
            pricePerUnit: 8000,
            subtotal: 24000,
            notes: 'Estimasi awal pelanggan (Menunggu timbangan aktual di outlet)'
          }
        ];

    const computedSubtotal = normalizedItems.reduce((s, it) => s + it.subtotal, 0);
    const speedMultiplier = serviceSpeed === 'EXPRESS_6H' ? 1.0 : serviceSpeed === 'KILAT_24H' ? 0.5 : 0;
    const speedSurcharge = Math.round(computedSubtotal * speedMultiplier);

    const finalPickupFee = (deliveryType === 'FULL_SERVICE' || deliveryType === 'PICKUP_ONLY')
      ? Math.max(0, parseFloat(pickupFee) || 0)
      : 0;
    const finalDeliveryFee = (deliveryType === 'FULL_SERVICE' || deliveryType === 'DELIVERY_ONLY')
      ? Math.max(0, parseFloat(deliveryFee) || 0)
      : 0;

    const totalAmount = Math.max(0, computedSubtotal + speedSurcharge + finalPickupFee + finalDeliveryFee);

    // Cari atau hubungkan customer berdasarkan nomor telepon
    const digitsOnly = String(customerPhone).replace(/[^0-9]/g, '');
    const tailDigits = digitsOnly.length > 8 ? digitsOnly.slice(-8) : digitsOnly;
    let existingCust = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, deletedAt: null, phone: { contains: tailDigits } }
    });

    if (!existingCust) {
      existingCust = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: String(customerName).trim(),
          phone: String(customerPhone).trim()
        }
      });
    }

    const hoursToAdd = serviceSpeed === 'EXPRESS_6H' ? 6 : serviceSpeed === 'KILAT_24H' ? 24 : 48;
    const estimatedDoneAt = new Date(Date.now() + hoursToAdd * 3600 * 1000);

    const createdOrder = await prisma.laundryOrder.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet?.id || null,
        orderNumber,
        trackingCode,
        customerId: existingCust.id,
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        serviceCategory,
        serviceSpeed,
        perfumeVariant,
        specialNotes: specialNotes ? String(specialNotes).trim() : 'Order Online via Customer App',
        status: 'RECEIVED',
        deliveryType,
        pickupStatus: (deliveryType === 'FULL_SERVICE' || deliveryType === 'PICKUP_ONLY') ? 'PENDING' : null,
        deliveryStatus: (deliveryType === 'FULL_SERVICE' || deliveryType === 'DELIVERY_ONLY') ? 'PENDING' : null,
        pickupAddress: String(pickupAddress || '').trim() || null,
        pickupTimeSlot: String(pickupTimeSlot || '').trim() || null,
        deliveryAddress: String(deliveryAddress || pickupAddress || '').trim() || null,
        deliveryNotes: String(deliveryNotes || '').trim() || null,
        pickupFee: finalPickupFee,
        deliveryFee: finalDeliveryFee,
        subtotal: computedSubtotal,
        speedSurcharge,
        discount: 0,
        totalAmount,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        estimatedDoneAt,
        items: {
          create: normalizedItems
        }
      },
      include: { items: true }
    });

    const { emitToTenant } = require('../index');
    emitToTenant(tenant.id, 'laundry:new_pickup_order', {
      id: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      trackingCode: createdOrder.trackingCode,
      customerName: createdOrder.customerName,
      customerPhone: createdOrder.customerPhone,
      deliveryType: createdOrder.deliveryType,
      pickupAddress: createdOrder.pickupAddress,
      pickupTimeSlot: createdOrder.pickupTimeSlot,
      pickupFee: createdOrder.pickupFee,
      deliveryFee: createdOrder.deliveryFee,
      totalAmount: createdOrder.totalAmount
    });

    return res.status(201).json({
      message: 'Permintaan penjemputan cucian berhasil dikirim ke outlet!',
      orderNumber: createdOrder.orderNumber,
      trackingCode: createdOrder.trackingCode,
      order: createdOrder
    });
  } catch (err: any) {
    console.error('[Book Pickup Laundry Error]:', err);
    return res.status(500).json({ error: err.message || 'Gagal membuat pesanan antar-jemput.' });
  }
});

// ─── 16. POST /api/laundry/public/generate-qris/:trackingCode (EMVCo CRC-16) ──
router.post('/public/generate-qris/:trackingCode', async (req: Request, res: Response) => {
  try {
    const rawCode = String(req.params.trackingCode || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Kode pelacakan wajib diisi.' });
    }

    const order = await prisma.laundryOrder.findFirst({
      where: { trackingCode: rawCode },
      include: {
        tenant: { select: { id: true, name: true, slug: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Pesanan laundry tidak ditemukan.' });
    }

    const remainingBalance = Math.max(0, Math.round((order.totalAmount || 0) - (order.paidAmount || 0)));
    if (order.paymentStatus === 'PAID' || remainingBalance <= 0) {
      return res.json({
        alreadyPaid: true,
        orderNumber: order.orderNumber,
        trackingCode: order.trackingCode
      });
    }

    // Alokasikan 2 digit kode unik (1 s/d 99) yang bebas bentrok di tenant tersebut
    let uniqueCode = order.qrisUniqueCode;
    let uniqueAmount = order.qrisUniqueAmount;

    if (!uniqueCode || uniqueCode <= 0 || uniqueAmount !== remainingBalance + uniqueCode) {
      const since24h = new Date(Date.now() - 24 * 3600 * 1000);
      const activePendingOrders = await prisma.laundryOrder.findMany({
        where: {
          tenantId: order.tenantId,
          id: { not: order.id },
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          createdAt: { gte: since24h },
          qrisUniqueAmount: { gt: 0 }
        },
        select: { qrisUniqueCode: true, qrisUniqueAmount: true }
      });

      const usedAmounts = new Set(activePendingOrders.map(o => Math.round(o.qrisUniqueAmount)));
      // Gunakan seed deterministik dari nomor nota lalu geser jika ada yang sama
      const numTail = parseInt(order.orderNumber.replace(/[^0-9]/g, '').slice(-2), 10) || 15;
      let candidateCode = (numTail % 89) + 10; // rentang 10..98 agar mudah terlihat

      for (let step = 0; step < 90; step++) {
        const tryCode = ((candidateCode + step - 1) % 99) + 1;
        const tryAmount = remainingBalance + tryCode;
        if (!usedAmounts.has(tryAmount)) {
          uniqueCode = tryCode;
          uniqueAmount = tryAmount;
          break;
        }
      }

      await prisma.laundryOrder.update({
        where: { id: order.id },
        data: {
          qrisUniqueCode: uniqueCode,
          qrisUniqueAmount: uniqueAmount
        }
      });
    }

    const paymentConfig = await prisma.tenantPaymentConfig.findUnique({
      where: { tenantId: order.tenantId }
    });

    const rawStatic = paymentConfig?.qrisStaticPayload || '';
    const hasCustomQris = Boolean(rawStatic && isValidStaticQris(rawStatic));
    const staticBase = hasCustomQris
      ? rawStatic
      : buildFallbackStaticQris(order.tenant?.name || 'LAUNDRY OUTLET');

    const qrisDynamicString = convertStaticToDynamicQris(staticBase, uniqueAmount);

    return res.json({
      alreadyPaid: false,
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode,
      baseAmount: remainingBalance,
      pickupFee: order.pickupFee || 0,
      deliveryFee: order.deliveryFee || 0,
      uniqueCode,
      qrisUniqueAmount: uniqueAmount,
      qrisDynamicString,
      hasCustomQris,
      merchantName: order.tenant?.name || 'Laundry Outlet'
    });
  } catch (err: any) {
    console.error('[Generate Dynamic QRIS Error]:', err);
    return res.status(500).json({ error: err.message || 'Gagal membuat QRIS Dinamis EMVCo.' });
  }
});

// ─── 17. POST /api/laundry/qris-auto-webhook (Lapisan 3: Auto-Settlement HP) ──
router.post('/qris-auto-webhook', async (req: Request, res: Response) => {
  try {
    const token = String(
      req.query.token ||
      req.headers['x-webhook-secret'] ||
      req.body?.token ||
      req.body?.secret ||
      ''
    ).trim();

    const {
      tenantId: bodyTenantId,
      title = '',
      text = '',
      bigText = '',
      message = '',
      notification = '',
      packageName = 'com.gopay.merchant',
      amount: directAmount
    } = req.body || {};

    let resolvedTenantId = '';

    if (token) {
      const config = await prisma.tenantPaymentConfig.findFirst({
        where: { qrisWebhookSecret: token }
      });
      if (!config) {
        return res.status(401).json({ error: 'Token rahasia webhook QRIS tidak valid.' });
      }
      resolvedTenantId = config.tenantId;
    } else if (bodyTenantId) {
      resolvedTenantId = String(bodyTenantId);
    } else {
      return res.status(401).json({ error: 'Token webhook (?token=...) wajib disertakan pada URL.' });
    }

    const combinedText = [title, text, bigText, message, notification]
      .filter(Boolean)
      .join(' ');

    const extractedNominals = extractNominalFromNotification(combinedText);
    if (directAmount && Number(directAmount) >= 100) {
      extractedNominals.push(Math.round(Number(directAmount)));
    }

    if (extractedNominals.length === 0) {
      return res.status(200).json({
        matched: false,
        reason: 'Tidak ditemukan angka nominal Rupiah pada teks notifikasi.',
        receivedText: combinedText
      });
    }

    // Cari nota laundry yang sedang menunggu pembayaran dengan qrisUniqueAmount (atau sisa tagihan) yang cocok
    const candidateOrders = await prisma.laundryOrder.findMany({
      where: {
        tenantId: resolvedTenantId,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        OR: [
          { qrisUniqueAmount: { in: extractedNominals } },
          { totalAmount: { in: extractedNominals } }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (candidateOrders.length === 0) {
      return res.status(200).json({
        matched: false,
        extractedNominals,
        reason: `Tidak ada nota cucian aktif dengan nominal QRIS Rp ${extractedNominals.map(n => n.toLocaleString('id-ID')).join(' / ')}.`
      });
    }

    // Prioritaskan kecocokan persis pada qrisUniqueAmount
    const matchedOrder =
      candidateOrders.find(o => extractedNominals.includes(Math.round(o.qrisUniqueAmount))) ||
      candidateOrders[0];

    const settledAmount = matchedOrder.qrisUniqueAmount > 0
      ? matchedOrder.qrisUniqueAmount
      : matchedOrder.totalAmount - (matchedOrder.paidAmount || 0);

    const ownerUser = await prisma.user.findFirst({
      where: { tenantId: resolvedTenantId },
      orderBy: { id: 'asc' },
      select: { id: true }
    });

    const settledOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.laundryOrder.update({
        where: { id: matchedOrder.id },
        data: {
          paidAmount: matchedOrder.totalAmount,
          paymentStatus: 'PAID',
          paymentMethod: 'QRIS',
          paymentVerificationStatus: 'AUTO_VERIFIED'
        }
      });

      if (ownerUser) {
        await tx.cashFlow.create({
          data: {
            tenantId: resolvedTenantId,
            outletId: matchedOrder.outletId || null,
            userId: ownerUser.id,
            type: 'Pemasukan',
            category: 'Pendapatan Laundry',
            amount: settledAmount,
            description: `Auto-Settlement QRIS Dinamis #${matchedOrder.orderNumber} (${matchedOrder.customerName}) via Notifikasi [${packageName}]`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return updated;
    });

    const { emitToTenant, emitToTracking } = require('../index');
    emitToTenant(resolvedTenantId, 'laundry:payment_verified', {
      orderId: settledOrder.id,
      orderNumber: settledOrder.orderNumber,
      customerName: settledOrder.customerName,
      amount: settledAmount,
      mode: 'AUTO_ANDROID_NOTIFICATION'
    });

    if (settledOrder.trackingCode) {
      emitToTracking(settledOrder.trackingCode, 'payment:success', {
        status: settledOrder.status,
        paymentStatus: 'PAID',
        paymentVerificationStatus: 'AUTO_VERIFIED',
        paidAt: new Date().toISOString(),
        paymentMethod: 'QRIS_DINAMIS_AUTO',
        amountPaid: settledAmount
      });
    }

    return res.json({
      matched: true,
      message: `Nota #${settledOrder.orderNumber} otomatis LUNAS (Rp ${settledAmount.toLocaleString('id-ID')})!`,
      orderNumber: settledOrder.orderNumber,
      trackingCode: settledOrder.trackingCode,
      settledAmount,
      extractedNominals
    });
  } catch (err: any) {
    console.error('[QRIS Auto Webhook Error]:', err);
    return res.status(500).json({ error: 'Gagal memproses webhook mutasi QRIS.' });
  }
});

// ─── 18. POST /api/laundry/public/confirm-payment/:trackingCode (Fallback) ────
router.post('/public/confirm-payment/:trackingCode', async (req: Request, res: Response) => {
  try {
    const rawCode = String(req.params.trackingCode || '').trim().toUpperCase();
    const { paymentProofImage } = req.body || {};

    const order = await prisma.laundryOrder.findFirst({
      where: { trackingCode: rawCode }
    });
    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    const updated = await prisma.laundryOrder.update({
      where: { id: order.id },
      data: {
        paymentVerificationStatus: 'WAITING_VERIFICATION',
        ...(paymentProofImage ? { paymentProofImage: String(paymentProofImage) } : {})
      }
    });

    const { emitToTenant, emitToTracking } = require('../index');
    emitToTenant(order.tenantId, 'laundry:payment_confirmation_requested', {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      customerName: updated.customerName,
      amount: updated.qrisUniqueAmount || (updated.totalAmount - (updated.paidAmount || 0)),
      hasProofImage: Boolean(updated.paymentProofImage)
    });

    if (updated.trackingCode) {
      emitToTracking(updated.trackingCode, 'tracking:updated', {
        paymentVerificationStatus: 'WAITING_VERIFICATION',
        paymentProofImage: updated.paymentProofImage
      });
    }

    return res.json({
      success: true,
      message: 'Konfirmasi pembayaran telah dikirim ke kasir outlet.',
      paymentVerificationStatus: updated.paymentVerificationStatus
    });
  } catch (err: any) {
    console.error('[Confirm Payment Public Error]:', err);
    return res.status(500).json({ error: 'Gagal mengirim konfirmasi pembayaran.' });
  }
});

// ─── 19. POST /api/laundry/orders/:id/verify-payment (1-Klik Approve Kasir) ───
router.post('/orders/:id/verify-payment', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const orderId = String(req.params.id);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const order = await prisma.laundryOrder.findFirst({
      where: { id: orderId, tenantId }
    });
    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }
    if (order.paymentStatus === 'PAID') {
      return res.json({ message: 'Nota ini sudah berstatus LUNAS.', order });
    }

    const amountSettled = order.qrisUniqueAmount > 0
      ? order.qrisUniqueAmount
      : Math.max(0, order.totalAmount - (order.paidAmount || 0));

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.laundryOrder.update({
        where: { id: order.id },
        data: {
          paidAmount: order.totalAmount,
          paymentStatus: 'PAID',
          paymentMethod: 'QRIS',
          paymentVerificationStatus: 'MANUAL_VERIFIED'
        }
      });

      if (userId && amountSettled > 0) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: order.outletId || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Laundry',
            amount: amountSettled,
            description: `Verifikasi Pembayaran QRIS Dinamis #${order.orderNumber} (${order.customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }
      return ord;
    });

    const { emitToTenant, emitToTracking } = require('../index');
    emitToTenant(tenantId, 'laundry:payment_verified', {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      customerName: updated.customerName,
      amount: amountSettled,
      mode: 'MANUAL_1CLICK'
    });

    if (updated.trackingCode) {
      emitToTracking(updated.trackingCode, 'payment:success', {
        status: updated.status,
        paymentStatus: 'PAID',
        paymentVerificationStatus: 'MANUAL_VERIFIED',
        paidAt: new Date().toISOString(),
        paymentMethod: 'QRIS_DINAMIS',
        amountPaid: amountSettled
      });
    }

    return res.json({
      message: `Pembayaran QRIS Nota #${updated.orderNumber} berhasil diverifikasi LUNAS!`,
      order: updated
    });
  } catch (err: any) {
    console.error('[Verify Payment Laundry Error]:', err);
    return res.status(500).json({ error: 'Gagal memverifikasi pembayaran QRIS.' });
  }
});

export default router;

