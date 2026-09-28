import { Router, Response } from 'express';
import prisma from '../db';
import { AuthRequest, authenticateToken } from '../middlewares/authMiddleware';
import { WANotifService } from '../services/WANotifService';

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
      estimatedDoneAt
    } = req.body;

    if (!customerName || String(customerName).trim() === '') {
      return res.status(400).json({ error: 'Nama pelanggan wajib diisi.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar item cucian tidak boleh kosong.' });
    }

    // Determine payment status
    const isPaid = Number(paidAmount) >= Number(totalAmount) && Number(totalAmount) > 0;
    const isPartial = Number(paidAmount) > 0 && Number(paidAmount) < Number(totalAmount);
    const paymentStatus = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID';

    // Auto-generate order number
    const orderNumber = await generateLaundryOrderNumber(tenantId);

    // Get active outlet
    const outlet = await prisma.outlet.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true }
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create order
      const newOrder = await tx.laundryOrder.create({
        data: {
          tenantId,
          outletId: outlet?.id || null,
          orderNumber,
          customerId: customerId ? Number(customerId) : null,
          customerName: String(customerName).trim(),
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          serviceCategory,
          serviceSpeed,
          perfumeVariant,
          hangerCount: Number(hangerCount) || 0,
          itemCountNotes: itemCountNotes ? String(itemCountNotes).trim() : null,
          specialNotes: specialNotes ? String(specialNotes).trim() : null,
          status: 'RECEIVED',
          subtotal: Number(subtotal) || 0,
          speedSurcharge: Number(speedSurcharge) || 0,
          discount: Number(discount) || 0,
          totalAmount: Number(totalAmount) || 0,
          paidAmount: Number(paidAmount) || 0,
          paymentStatus,
          paymentMethod: Number(paidAmount) > 0 ? paymentMethod : null,
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

      // 2. If paid at intake, record to CashFlow (Laci Kasir)
      if (Number(paidAmount) > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet?.id || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Laundry',
            amount: Number(paidAmount),
            description: `Pembayaran Drop-off Nota Cuci #${orderNumber} (${customerName})`,
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
    const { paidAmountNow = 0, paymentMethod = 'CASH' } = req.body;

    const order = await prisma.laundryOrder.findFirst({
      where: { id, tenantId }
    });

    if (!order) {
      return res.status(404).json({ error: 'Nota cucian tidak ditemukan.' });
    }

    const currentPaid = Number(order.paidAmount) || 0;
    const additionalPaid = Number(paidAmountNow) || 0;
    const newTotalPaid = currentPaid + additionalPaid;
    const isNowLunas = newTotalPaid >= order.totalAmount;

    const outlet = await prisma.outlet.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true }
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.laundryOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          pickupByUserId: userId ? Number(userId) : null,
          paidAmount: newTotalPaid,
          paymentStatus: isNowLunas ? 'PAID' : (newTotalPaid > 0 ? 'PARTIAL' : order.paymentStatus),
          paymentMethod: additionalPaid > 0 ? paymentMethod : order.paymentMethod
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

    // Urutkan layanan terpopuler
    const topServices = Object.entries(servicePopularity)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const onTimeRate = (onTimeCount + lateCount) > 0
      ? Math.round((onTimeCount / (onTimeCount + lateCount)) * 100)
      : 100;

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
        onTimeRate
      },
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
      atRiskCustomers
    });
  } catch (error: any) {
    console.error('[Laundry Analytics Error]', error);
    return res.status(500).json({ error: 'Gagal memuat analitik laundry.' });
  }
});

export default router;

