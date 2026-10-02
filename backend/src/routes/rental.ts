import { Router, Response } from 'express';
import prisma from '../db';
import { AuthRequest, authenticateToken } from '../middlewares/authMiddleware';
import { WANotifService } from '../services/WANotifService';
import { rentalReminderCronService } from '../services/RentalReminderCronService';

const router = Router();

// ─── HELPER: GENERATE RENTAL ORDER NUMBER (RNT-CODE-YYYYMM-0001) ─────────────
async function generateRentalOrderNumber(tenantId: string, tx?: any): Promise<string> {
  const db = tx || prisma;
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Ambil kode tenant 3-4 huruf sebagai prefix unik per butik untuk mencegah IDOR / collision
  let tenantCode = 'RNT';
  try {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } });
    const rawCode = tenant?.slug || tenant?.name || tenantId;
    tenantCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'RNT';
  } catch (_) {}

  const prefix = `RNT-${tenantCode}-${ym}-`;

  const lastOrder = await db.rentalOrder.findFirst({
    where: {
      tenantId,
      orderNumber: { startsWith: prefix }
    },
    orderBy: { orderNumber: 'desc' }
  });

  let seq = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const parts = lastOrder.orderNumber.split('-');
    if (parts.length >= 4) {
      const lastSeq = parseInt(parts[3], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    } else if (parts.length === 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ─── 1. GET /api/rental/orders (List / Filter / Kanban) ──────────────────────
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

    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { eventLocation: { contains: q, mode: 'insensitive' } },
        {
          items: {
            some: {
              OR: [
                { attireName: { contains: q, mode: 'insensitive' } },
                { attireCode: { contains: q, mode: 'insensitive' } },
                { rackHangerCode: { contains: q, mode: 'insensitive' } }
              ]
            }
          }
        }
      ];
    }

    const dateType = (req.query.dateType as string) || (req.query.dateBy as string) || (req.query.filterDateBy as string) || 'createdAt';
    if (startDateParam || endDateParam) {
      if (dateType === 'calendar') {
        const start = startDateParam ? new Date(startDateParam.includes('T') ? startDateParam : `${startDateParam}T00:00:00.000Z`) : undefined;
        const end = endDateParam ? new Date(endDateParam.includes('T') ? endDateParam : `${endDateParam}T23:59:59.999Z`) : undefined;
        const calendarConditions = [
          { eventDate: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
          { pickupDate: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } },
          { returnDeadline: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
        ];
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            { OR: calendarConditions }
          ];
          delete where.OR;
        } else {
          where.OR = calendarConditions;
        }
      } else {
        const field = dateType === 'eventDate' ? 'eventDate' : 'createdAt';
        where[field] = {};
        if (startDateParam) {
          where[field].gte = new Date(startDateParam.includes('T') ? startDateParam : `${startDateParam}T00:00:00.000Z`);
        }
        if (endDateParam) {
          const endStr = endDateParam.includes('T') ? endDateParam : `${endDateParam}T23:59:59.999Z`;
          where[field].lte = new Date(endStr);
        }
      }
    }

    const limit = Math.min(parseInt(limitParam || '100', 10), 500);
    const offset = parseInt(offsetParam || '0', 10);
    const orderByField = (req.query.orderBy as string) || (dateType === 'eventDate' ? 'eventDate' : 'createdAt');
    const orderDirection = ((req.query.orderDirection as string) || (orderByField === 'createdAt' ? 'desc' : 'asc')) as 'asc' | 'desc';

    const [orders, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        include: {
          items: true,
          customer: {
            select: { id: true, name: true, phone: true }
          }
        },
        orderBy: { [orderByField]: orderDirection },
        take: limit,
        skip: offset
      }),
      prisma.rentalOrder.count({ where })
    ]);

    // Hitung ringkasan status untuk tab counter di UI
    const statusCounts = await prisma.rentalOrder.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true }
    });

    const summaryMap: Record<string, number> = {
      TOTAL: total,
      BOOKED: 0,
      FITTING: 0,
      PICKED_UP: 0,
      RETURNED: 0,
      QC_CHECK: 0,
      LAUNDRY: 0,
      COMPLETED: 0,
      CANCELLED: 0
    };

    statusCounts.forEach((sc) => {
      summaryMap[sc.status] = sc._count.id;
    });

    return res.json({
      orders,
      total,
      summary: summaryMap
    });
  } catch (error: any) {
    console.error('[Rental API] Error fetching orders:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengambil data pesanan rental.' });
  }
});

// ─── 2. GET /api/rental/orders/:id (Detail Kontrak Sewa) ────────────────────
router.get('/orders/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const id = String(req.params.id);

    const order = await prisma.rentalOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        customer: true,
        outlet: { select: { id: true, name: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Kontrak sewa busana tidak ditemukan.' });
    }

    return res.json(order);
  } catch (error: any) {
    console.error('[Rental API] Error fetching order detail:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengambil rincian sewa busana.' });
  }
});

// ─── 3. GET /api/rental/availability (Kalender Anti-Double Booking) ───────────
router.get('/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;

    const start = startDateParam ? new Date(startDateParam) : new Date();
    const end = endDateParam ? new Date(endDateParam) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Ambil semua order aktif dalam rentang tanggal tersebut
    const activeOrders = await prisma.rentalOrder.findMany({
      where: {
        tenantId,
        status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'QC_CHECK', 'LAUNDRY'] },
        OR: [
          {
            pickupDate: { lte: end },
            returnDeadline: { gte: start }
          }
        ]
      },
      include: {
        items: true
      }
    });

    // Petakan kode busana yang terpakai per tanggal
    const busySchedule: Array<{
      orderId: string;
      orderNumber: string;
      customerName: string;
      pickupDate: Date;
      returnDeadline: Date;
      eventDate: Date;
      status: string;
      items: Array<{
        attireCode: string;
        attireName: string;
        rackHangerCode: string | null;
        color: string | null;
        size: string | null;
      }>;
    }> = activeOrders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      pickupDate: o.pickupDate,
      returnDeadline: o.returnDeadline,
      eventDate: o.eventDate,
      status: o.status,
      items: o.items.map((i) => ({
        attireCode: i.attireCode,
        attireName: i.attireName,
        rackHangerCode: i.rackHangerCode,
        color: i.color,
        size: i.size
      }))
    }));

    // Hitung jumlah unit terpakai per kode busana dalam rentang tanggal ini
    const bookedCountByCode: Record<string, number> = {};
    activeOrders.forEach(o => {
      o.items.forEach(i => {
        const code = (i.attireCode || '').trim().toUpperCase();
        if (code) {
          bookedCountByCode[code] = (bookedCountByCode[code] || 0) + 1;
        }
      });
    });

    return res.json({
      startDate: start,
      endDate: end,
      busyCount: busySchedule.length,
      bookedCountByCode,
      schedule: busySchedule
    });
  } catch (error: any) {
    console.error('[Rental API] Error checking availability:', error);
    return res.status(500).json({ error: error.message || 'Gagal memeriksa ketersediaan busana.' });
  }
});

// ─── 4. POST /api/rental/orders (Booking / Sewa Baru) ────────────────────────
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
      idCardPhotoUrl,
      eventLocation,
      eventDate,
      pickupDate,
      returnDeadline,
      items,
      rentalSubtotal,
      discount = 0,
      paidAmount = 0,
      paymentMethod = 'CASH',
      depositAmount = 0,
      fittingNotes,
      accessoryChecklist
    } = req.body;

    if (!customerName || !String(customerName).trim()) {
      return res.status(400).json({ error: 'Nama pelanggan / calon pengantin wajib diisi.' });
    }

    if (!eventDate || !pickupDate || !returnDeadline) {
      return res.status(400).json({ error: 'Tanggal acara, tanggal ambil, dan batas pengembalian wajib ditentukan.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Minimal harus ada 1 busana / set yang disewa.' });
    }

    const pDate = new Date(pickupDate);
    const rDate = new Date(returnDeadline);
    const eDate = new Date(eventDate);

    // 1. Validasi Anti-Double Booking & Ketersediaan Stok Fisik untuk setiap attireCode
    const requestedCountMap: Record<string, number> = {};
    for (const it of items) {
      const code = String(it.attireCode || '').trim().toUpperCase();
      if (code) {
        requestedCountMap[code] = (requestedCountMap[code] || 0) + 1;
      }
    }

    const uniqueCodes = Object.keys(requestedCountMap);
    if (uniqueCodes.length > 0) {
      const now = new Date();
      const isStartingTodayOrPast = pDate <= now;

      const [products, conflictingOrders] = await Promise.all([
        prisma.product.findMany({
          where: { tenantId, barcode: { in: uniqueCodes, mode: 'insensitive' }, deletedAt: null },
          select: { barcode: true, name: true, stock: true }
        }),
        prisma.rentalOrder.findMany({
          where: {
            tenantId,
            OR: [
              {
                status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'QC_CHECK', 'LAUNDRY'] },
                pickupDate: { lte: rDate },
                returnDeadline: { gte: pDate }
              },
              ...(isStartingTodayOrPast ? [{
                status: { in: ['PICKED_UP', 'RETURNED', 'QC_CHECK', 'LAUNDRY'] },
                returnDeadline: { lt: pDate },
                items: { some: { isReturned: false } }
              }] : [])
            ],
            items: {
              some: {
                attireCode: { in: uniqueCodes, mode: 'insensitive' }
              }
            }
          },
          include: { items: true }
        })
      ]);

      const stockMap: Record<string, { name: string; stock: number }> = {};
      products.forEach(p => {
        if (p.barcode) {
          stockMap[p.barcode.trim().toUpperCase()] = { name: p.name, stock: p.stock || 1 };
        }
      });

      const bookedCountMap: Record<string, number> = {};
      conflictingOrders.forEach(o => {
        o.items.forEach(i => {
          const itemCode = (i.attireCode || '').trim().toUpperCase();
          if (uniqueCodes.includes(itemCode)) {
            bookedCountMap[itemCode] = (bookedCountMap[itemCode] || 0) + 1;
          }
        });
      });

      for (const code of uniqueCodes) {
        const prodInfo = stockMap[code] || { name: code, stock: 1 };
        const totalStock = prodInfo.stock;
        const alreadyBooked = bookedCountMap[code] || 0;
        const requested = requestedCountMap[code] || 1;

        if (alreadyBooked + requested > totalStock) {
          const availableLeft = Math.max(0, totalStock - alreadyBooked);
          const conflict = conflictingOrders.find(o => o.items.some(i => (i.attireCode || '').trim().toUpperCase() === code));
          return res.status(409).json({
            error: `Stok busana "${prodInfo.name}" (${code}) tidak mencukupi untuk rentang tanggal ini. Total fisik: ${totalStock} set, ter-booking: ${alreadyBooked} set, tersisa: ${availableLeft} set (diminta: ${requested} set)${conflict ? ` oleh ${conflict.customerName} (Nota: ${conflict.orderNumber})` : ''}.`
          });
        }
      }
    }

    const outlet = await prisma.outlet.findFirst({
      where: { tenantId, status: 'ACTIVE' }
    });

    const parsedSubtotal = Number(rentalSubtotal) || items.reduce((acc: number, it: any) => acc + (Number(it.price) || 0), 0);
    const parsedDiscount = Number(discount) || 0;
    const parsedTotal = Math.max(0, parsedSubtotal - parsedDiscount);
    const parsedPaid = Number(paidAmount) || 0;
    const parsedDeposit = Number(depositAmount) || 0;

    let paymentStatus = 'UNPAID';
    if (parsedPaid >= parsedTotal && parsedTotal > 0) {
      paymentStatus = 'FULL_PAID';
    } else if (parsedPaid > 0) {
      paymentStatus = 'DP_PAID';
    }

    const determinedPocket = (paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR';

    // 2. Transaksi Database Atomik dengan Retry Loop Anti-Collision P2002
    let result: any = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        result = await prisma.$transaction(async (tx) => {
          const orderNumber = await generateRentalOrderNumber(tenantId, tx);

          // 2a. Auto-Upsert Pelanggan ke CRM (prisma.customer)
          let finalCustomerId = customerId ? Number(customerId) : null;
          if (!finalCustomerId && customerPhone && String(customerPhone).trim()) {
            const cleanPhone = String(customerPhone).trim();
            let existingCustomer = await tx.customer.findFirst({
              where: { tenantId, phone: cleanPhone }
            });
            if (!existingCustomer && customerName) {
              existingCustomer = await tx.customer.create({
                data: {
                  tenant: { connect: { id: tenantId } },
                  name: String(customerName).trim(),
                  phone: cleanPhone
                }
              });
            }
            if (existingCustomer) finalCustomerId = existingCustomer.id;
          }

          const newOrder = await tx.rentalOrder.create({
            data: {
              tenantId,
              outletId: outlet?.id || null,
              orderNumber,
              customerId: finalCustomerId,
              customerName: String(customerName).trim(),
              customerPhone: customerPhone ? String(customerPhone).trim() : null,
              idCardPhotoUrl: idCardPhotoUrl ? String(idCardPhotoUrl).trim() : null,
              eventLocation: eventLocation ? String(eventLocation).trim() : null,
              eventDate: eDate,
              pickupDate: pDate,
              returnDeadline: rDate,
              status: 'BOOKED',
              rentalSubtotal: parsedSubtotal,
              discount: parsedDiscount,
              totalAmount: parsedTotal,
              paidAmount: parsedPaid,
              paymentStatus,
              paymentMethod: parsedPaid > 0 ? paymentMethod : null,
              depositAmount: parsedDeposit,
              depositStatus: parsedDeposit > 0 ? 'HELD' : 'NONE',
              fittingNotes: fittingNotes ? String(fittingNotes).trim() : null,
              accessoryChecklist: accessoryChecklist || null,
              items: {
                create: items.map((it: any) => ({
                  productId: it.productId ? Number(it.productId) : null,
                  attireName: String(it.attireName || 'Baju Bodo').trim(),
                  attireCode: String(it.attireCode || '').trim().toUpperCase(),
                  rackHangerCode: it.rackHangerCode ? String(it.rackHangerCode).trim() : null,
                  color: it.color ? String(it.color).trim() : null,
                  size: it.size ? String(it.size).trim() : null,
                  price: parseFloat(it.price) || 0,
                  returnCondition: 'GOOD'
                }))
              }
            },
            include: { items: true }
          });

          // Catat uang sewa masuk (DP / Lunas) ke Laci Kasir / Bank
          if (parsedPaid > 0 && userId) {
            await tx.cashFlow.create({
              data: {
                tenantId,
                outletId: outlet?.id || null,
                userId: Number(userId),
                type: 'Pemasukan',
                category: 'Pendapatan Sewa Busana',
                amount: parsedPaid,
                description: `Pembayaran ${paymentStatus === 'FULL_PAID' ? 'Lunas' : 'DP'} Sewa Busana #${orderNumber} (${customerName}) via ${paymentMethod || 'TUNAI'}`,
                cashPocket: determinedPocket,
                status: 'APPROVED'
              }
            });
          }

          // Catat uang jaminan deposit sebagai titipan kasir / Bank jika disetorkan sekarang
          if (parsedDeposit > 0 && userId) {
            await tx.cashFlow.create({
              data: {
                tenantId,
                outletId: outlet?.id || null,
                userId: Number(userId),
                type: 'Pemasukan',
                category: 'Titipan Uang Jaminan (Deposit)',
                amount: parsedDeposit,
                description: `Titipan Uang Jaminan Sewa #${orderNumber} (${customerName}) via ${paymentMethod || 'TUNAI'}`,
                cashPocket: determinedPocket,
                status: 'APPROVED'
              }
            });
          }

          return newOrder;
        });
        break; // Berhasil! Keluar dari retry loop
      } catch (txErr: any) {
        if (txErr.code === 'P2002' && attempts < maxAttempts) {
          continue;
        }
        throw txErr;
      }
    }

    // Socket.IO: Beritahu seluruh tablet kasir & staff butik secara real-time
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('rental:order_created', result);

    // 3. Notifikasi WhatsApp Otomatis
    if (result.customerPhone) {
      const attireNames = items.map((it: any) => it.attireName).join(', ');
      const eventDateStr = eDate.toLocaleDateString('id-ID', { dateStyle: 'long' });
      const pickupDateStr = pDate.toLocaleDateString('id-ID', { dateStyle: 'medium' });

      WANotifService.sendCustomNotification({
        tenantId: tenantId || result.tenantId,
        phone: result.customerPhone,
        message:
          `✨ *KONFIRMASI BOOKING SEWA BUSANA*\n` +
          `Nomor Kontrak: *#${result.orderNumber}*\n` +
          `Penyewa: *${result.customerName}*\n` +
          `Busana: *${attireNames}*\n` +
          `Tgl Acara: *${eventDateStr}*\n` +
          `Jadwal Ambil: *${pickupDateStr}*\n` +
          `Total Sewa: *Rp ${result.totalAmount.toLocaleString('id-ID')}*\n` +
          `Terbayar: *Rp ${result.paidAmount.toLocaleString('id-ID')} (${paymentStatus === 'FULL_PAID' ? 'Lunas' : 'DP Terbayar'})*\n` +
          (result.depositAmount > 0 ? `Deposit Jaminan: *Rp ${result.depositAmount.toLocaleString('id-ID')}*\n` : '') +
          `\nTerima kasih atas kepercayaannya menyewa di butik kami.`
      }).catch((e: any) => console.error('[Rental API] WA dispatch error:', e.message));
    }

    return res.status(201).json({
      message: 'Booking sewa busana berhasil dibuat.',
      order: result
    });
  } catch (error: any) {
    console.error('[Rental API] Error creating rental order:', error);
    return res.status(500).json({ error: error.message || 'Gagal membuat booking sewa busana.' });
  }
});

// ─── 5. PATCH /api/rental/orders/:id/status (Transisi Siklus Baju) ────────────
router.patch('/orders/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const id = String(req.params.id);
    const {
      status,
      fittingNotes,
      fittingDone,
      pickupProofPhotoUrl,
      returnProofPhotoUrl,
      additionalPayment = 0,
      paymentMethod = 'CASH'
    } = req.body;

    const existing = await prisma.rentalOrder.findFirst({
      where: { id, tenantId },
      include: { items: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Kontrak sewa tidak ditemukan.' });
    }

    // ── State Machine Validation ──────────────────────────────────────────
    const VALID_TRANSITIONS: Record<string, string[]> = {
      BOOKED      : ['FITTING', 'PICKED_UP', 'CANCELLED'],
      FITTING     : ['PICKED_UP', 'BOOKED', 'CANCELLED'],
      PICKED_UP   : ['RETURNED'],
      RETURNED    : ['QC_CHECK', 'COMPLETED'],
      QC_CHECK    : ['LAUNDRY', 'COMPLETED'],
      LAUNDRY     : ['COMPLETED'],
      COMPLETED   : [],
      CANCELLED   : []
    };
    if (status && status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Transisi status tidak valid: ${existing.status} → ${status}. Status yang diizinkan: [${allowed.join(', ') || 'tidak ada'}]`,
          code: 'INVALID_STATE_TRANSITION'
        });
      }
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (fittingNotes !== undefined) updateData.fittingNotes = fittingNotes;
    if (fittingDone !== undefined) updateData.fittingDone = Boolean(fittingDone);
    if (pickupProofPhotoUrl !== undefined) updateData.pickupProofPhotoUrl = pickupProofPhotoUrl;
    if (returnProofPhotoUrl !== undefined) updateData.returnProofPhotoUrl = returnProofPhotoUrl;

    if (status === 'RETURNED' && !existing.actualReturnDate) {
      updateData.actualReturnDate = new Date();
    }

    const addPay = Number(additionalPayment) || 0;
    if (addPay > 0) {
      const newPaid = existing.paidAmount + addPay;
      updateData.paidAmount = newPaid;
      if (newPaid >= existing.totalAmount) {
        updateData.paymentStatus = 'FULL_PAID';
      }
    }

    const determinedPocket = (paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.rentalOrder.update({
        where: { id },
        data: updateData,
        include: { items: true }
      });

      // Jika ada pembayaran sisa/pelunasan saat ambil barang
      if (addPay > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pelunasan Sewa Busana',
            amount: addPay,
            description: `Pelunasan Sewa Busana #${existing.orderNumber} (${existing.customerName}) via ${paymentMethod || 'TUNAI'}`,
            cashPocket: determinedPocket,
            status: 'APPROVED'
          }
        });
      }

      return updated;
    });

    // Socket.IO: Beritahu seluruh tablet kasir & staff butik secara real-time
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('rental:order_updated', result);

    return res.json({
      message: `Status sewa #${existing.orderNumber} berhasil diperbarui ke ${status || existing.status}.`,
      order: result
    });
  } catch (error: any) {
    console.error('[Rental API] Error updating status:', error);
    return res.status(500).json({ error: error.message || 'Gagal memperbarui status sewa.' });
  }
});

// ─── 6. POST /api/rental/orders/:id/return-inspection (QC & Refund Jaminan) ──
router.post('/orders/:id/return-inspection', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const id = String(req.params.id);

    const {
      accessoryChecklist,
      itemConditions, // array { itemId, returnCondition, damageNotes }
      lateFee = 0,
      damageFee = 0,
      settleBalance = false,
      settleAmount = 0,
      paymentMethod = 'CASH',
      returnProofPhotoUrl,
      nextStage = 'LAUNDRY' // LAUNDRY atau COMPLETED
    } = req.body;

    const existing = await prisma.rentalOrder.findFirst({
      where: { id, tenantId },
      include: { items: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Kontrak sewa tidak ditemukan.' });
    }

    // Idempotency Guard: Mencegah eksekusi ganda dan duplikasi kas keluar deposit
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return res.status(400).json({
        error: `Kontrak sewa #${existing.orderNumber} sudah berstatus ${existing.status} dan tidak dapat diproses inspeksi ulang.`,
        code: 'INVALID_ORDER_STATE'
      });
    }

    if (existing.depositAmount > 0 && existing.depositStatus !== 'HELD') {
      return res.status(400).json({
        error: `Uang jaminan kontrak #${existing.orderNumber} sudah berstatus ${existing.depositStatus}. Rekonsiliasi kas tidak dapat diproses ulang untuk mencegah duplikasi kas keluar.`,
        code: 'DEPOSIT_ALREADY_PROCESSED'
      });
    }

    const parsedLateFee = Math.max(0, Number(lateFee) || 0);
    const parsedDamageFee = Math.max(0, Number(damageFee) || 0);
    const totalDeductions = parsedLateFee + parsedDamageFee;

    // Hitung sisa biaya sewa yang belum lunas (misal jika Bayar Full Saat Kembali / DP)
    const remainingRental = Math.max(0, existing.totalAmount - existing.paidAmount);
    const parsedSettleAmount = settleBalance ? Math.min(remainingRental, Math.max(0, Number(settleAmount) || remainingRental)) : 0;
    const newPaidAmount = existing.paidAmount + parsedSettleAmount;
    let newPaymentStatus = existing.paymentStatus;
    if (newPaidAmount >= existing.totalAmount && existing.totalAmount > 0) {
      newPaymentStatus = 'FULL_PAID';
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'DP_PAID';
    }

    // Hitung sisa deposit yang dikembalikan ke penyewa
    const refundAmount = Math.max(0, existing.depositAmount - totalDeductions);

    let depositStatus = 'FULL_REFUND';
    if (existing.depositAmount === 0) {
      depositStatus = 'NONE';
    } else if (refundAmount === 0) {
      depositStatus = 'FORFEITED'; // Hangus seluruhnya
    } else if (refundAmount < existing.depositAmount) {
      depositStatus = 'PARTIAL_REFUND';
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Perbarui kondisi tiap item busana jika ada rincian
      if (Array.isArray(itemConditions)) {
        for (const ic of itemConditions) {
          if (ic.itemId) {
            await tx.rentalOrderItem.update({
              where: { id: ic.itemId },
              data: {
                isReturned: true,
                returnCondition: ic.returnCondition || 'GOOD',
                damageNotes: ic.damageNotes ? String(ic.damageNotes).trim() : null
              }
            });
          }
        }
      }

      // 2. Perbarui order rental
      const updatedOrder = await tx.rentalOrder.update({
        where: { id },
        data: {
          status: nextStage === 'LAUNDRY' ? 'LAUNDRY' : 'COMPLETED',
          actualReturnDate: existing.actualReturnDate || new Date(),
          lateFee: parsedLateFee,
          damageFee: parsedDamageFee,
          depositRefunded: refundAmount,
          depositStatus,
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus,
          paymentMethod: parsedSettleAmount > 0 ? (paymentMethod || existing.paymentMethod || 'CASH') : existing.paymentMethod,
          accessoryChecklist: accessoryChecklist || existing.accessoryChecklist,
          returnProofPhotoUrl: returnProofPhotoUrl || existing.returnProofPhotoUrl
        },
        include: { items: true }
      });

      // 3. Catat Kas Masuk jika ada pelunasan sewa busana saat kembali (Bayar Full Saat Kembali / Sisa DP)
      if (parsedSettleAmount > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pelunasan Sewa Busana',
            amount: parsedSettleAmount,
            description: `Pelunasan Sewa Busana Saat Pengembalian #${existing.orderNumber} (${existing.customerName}) via ${paymentMethod || 'TUNAI'}`,
            cashPocket: (paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      // 4. Catat Kas Keluar untuk sisa deposit yang dikembalikan tunai ke pelanggan
      if (refundAmount > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pengeluaran',
            category: 'Pengembalian Uang Jaminan (Deposit Refund)',
            amount: refundAmount,
            description: `Pengembalian Sisa Deposit Sewa #${existing.orderNumber} (${existing.customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      // 5. Jika denda MELEBIHI deposit yang dipegang, pelanggan membayar kekurangannya secara tunai/transfer
      // Uang denda yang sudah tercover oleh deposit TIDAK dicatat sebagai pemasukan laci kasir baru untuk mencegah double-counting!
      const excessDeductionToPay = Math.max(0, totalDeductions - existing.depositAmount);
      if (excessDeductionToPay > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Denda Sewa & Ganti Rugi',
            amount: excessDeductionToPay,
            description: `Kekurangan Denda Sewa #${existing.orderNumber} (${existing.customerName}) via ${paymentMethod || 'TUNAI'}`,
            cashPocket: (paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return updatedOrder;
    });

    // Socket.IO: Beritahu seluruh tablet kasir & staff butik secara real-time
    req.app.get('io')?.to(`tenant:${tenantId}`).emit('rental:order_updated', result);

    // 6. Notifikasi WhatsApp Pengembalian, Pelunasan, & Refund Deposit
    if (result.customerPhone) {
      WANotifService.sendCustomNotification({
        tenantId: tenantId || result.tenantId,
        phone: result.customerPhone,
        message:
          `👗 *TANDA TERIMA PENGEMBALIAN & PELUNASAN BUSANA*\n` +
          `Nomor Kontrak: *#${result.orderNumber}*\n` +
          `Penyewa: *${result.customerName}*\n` +
          `Status Inspeksi: *Selesai & Diterima*\n` +
          (parsedSettleAmount > 0 ? `Pelunasan Sewa Diterima: *Rp ${parsedSettleAmount.toLocaleString('id-ID')}* (${newPaymentStatus === 'FULL_PAID' ? 'LUNAS' : 'SEBAGIAN'})\n` : '') +
          (parsedLateFee > 0 ? `Denda Keterlambatan: *Rp ${parsedLateFee.toLocaleString('id-ID')}*\n` : '') +
          (parsedDamageFee > 0 ? `Denda Kerusakan/Hilang: *Rp ${parsedDamageFee.toLocaleString('id-ID')}*\n` : '') +
          (existing.depositAmount > 0 ? `Sisa Uang Jaminan Dikembalikan: *Rp ${refundAmount.toLocaleString('id-ID')}*\n` : '') +
          `Dokumen Jaminan Fisik (KTP/SIM): *Telah Diserahkan Kembali*\n\n` +
          `Terima kasih telah merawat busana kami dengan baik. Sampai jumpa di acara bahagia berikutnya!`
      }).catch((e: any) => console.error('[Rental API] WA dispatch error:', e.message));
    }

    return res.json({
      message: 'Inspeksi pengembalian selesai dan status jaminan deposit & pelunasan sewa berhasil direkonsiliasi.',
      order: result,
      refundAmount,
      totalDeductions,
      settledAmount: parsedSettleAmount
    });
  } catch (error: any) {
    console.error('[Rental API] Error during return inspection:', error);
    return res.status(500).json({ error: error.message || 'Gagal memproses inspeksi pengembalian.' });
  }
});

// ─── 6b. POST /api/rental/orders/:id/cancel (Pembatalan Kontrak Sewa) ─────────
router.post('/orders/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const id = String(req.params.id);
    const {
      reason = 'Dibatalkan oleh pelanggan / permintaan pengantin',
      refundPaidAmount = 0,
      refundDepositAmount = 0,
      paymentMethod = 'CASH'
    } = req.body;

    const existing = await prisma.rentalOrder.findFirst({
      where: { id, tenantId },
      include: { items: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Kontrak sewa tidak ditemukan.' });
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return res.status(400).json({ error: `Kontrak sudah berstatus ${existing.status} dan tidak dapat dibatalkan.` });
    }

    if (existing.status === 'PICKED_UP') {
      return res.status(400).json({ error: 'Busana sudah dibawa klien. Harap lakukan proses penerimaan & inspeksi pengembalian.' });
    }

    const parsedRefundPaid = Math.min(existing.paidAmount, Math.max(0, Number(refundPaidAmount) || 0));
    const parsedRefundDeposit = Math.min(existing.depositAmount, Math.max(0, Number(refundDepositAmount) || 0));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Kas keluar jika ada pengembalian DP sewa
      if (parsedRefundPaid > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pengeluaran',
            category: 'Refund Pembatalan Sewa',
            amount: parsedRefundPaid,
            description: `Refund DP Pembatalan Sewa #${existing.orderNumber} (${existing.customerName}): ${reason}`,
            cashPocket: (paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      // 2. Kas keluar jika ada pengembalian uang jaminan deposit
      if (parsedRefundDeposit > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pengeluaran',
            category: 'Pengembalian Uang Jaminan (Deposit Refund)',
            amount: parsedRefundDeposit,
            description: `Pengembalian Deposit Pembatalan Sewa #${existing.orderNumber} (${existing.customerName})`,
            cashPocket: (paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      const cancelNote = `[BATAL: ${reason} | Refund DP: Rp ${parsedRefundPaid.toLocaleString('id-ID')} | Refund Deposit: Rp ${parsedRefundDeposit.toLocaleString('id-ID')}]`;
      const newDepositStatus = parsedRefundDeposit >= existing.depositAmount && existing.depositAmount > 0 ? 'FULL_REFUND'
        : parsedRefundDeposit > 0 ? 'PARTIAL_REFUND'
        : 'FORFEITED';

      const updated = await tx.rentalOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          depositStatus: newDepositStatus,
          depositRefunded: parsedRefundDeposit,
          fittingNotes: existing.fittingNotes ? `${existing.fittingNotes}\n${cancelNote}` : cancelNote
        },
        include: { items: true }
      });

      return updated;
    });

    // Real-time synchronization ke seluruh kasir & kalender rental
    req.app.get('io')?.to('tenant:' + tenantId).emit('rental:order_updated', result);

    // Notifikasi WhatsApp Pembatalan
    if (result.customerPhone) {
      WANotifService.sendCustomNotification({
        tenantId: tenantId || result.tenantId,
        phone: result.customerPhone,
        message:
          `❌ *INFORMASI PEMBATALAN SEWA BUSANA*\n` +
          `Nomor Kontrak: *#${result.orderNumber}*\n` +
          `Penyewa: *${result.customerName}*\n` +
          `Status: *Dibatalkan*\n` +
          `Alasan: ${reason}\n` +
          (parsedRefundPaid > 0 ? `Pengembalian DP: *Rp ${parsedRefundPaid.toLocaleString('id-ID')}*\n` : '') +
          (parsedRefundDeposit > 0 ? `Pengembalian Deposit: *Rp ${parsedRefundDeposit.toLocaleString('id-ID')}*\n` : '') +
          `\nJadwal dan slot busana telah dibebaskan. Terima kasih.`
      }).catch((e: any) => console.error('[Rental API] WA cancel dispatch error:', e.message));
    }

    return res.json({
      message: `Kontrak sewa #${existing.orderNumber} berhasil dibatalkan.`,
      order: result,
      refundedPaid: parsedRefundPaid,
      refundedDeposit: parsedRefundDeposit
    });
  } catch (error: any) {
    console.error('[Rental API] Error cancelling order:', error);
    return res.status(500).json({ error: error.message || 'Gagal membatalkan kontrak sewa.' });
  }
});

// ─── 7. GET /api/rental/dashboard-stats (Statistik Bisnis Rental) ─────────────
router.get('/dashboard-stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      activeBookings,
      pickedUpToday,
      dueReturnsToday,
      heldDeposits,
      totalMonthRevenue
    ] = await Promise.all([
      // 1. Total order aktif belum selesai
      prisma.rentalOrder.count({
        where: {
          tenantId,
          status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'LAUNDRY'] }
        }
      }),
      // 2. Baju yang jadwal diambil hari ini (exclude yang sudah selesai/batal)
      prisma.rentalOrder.count({
        where: {
          tenantId,
          pickupDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        }
      }),
      // 3. Baju yang jadwal kembali hari ini
      prisma.rentalOrder.count({
        where: {
          tenantId,
          returnDeadline: { gte: todayStart, lte: todayEnd },
          status: { in: ['PICKED_UP'] }
        }
      }),
      // 4. Total uang jaminan (deposit) yang saat ini tertahan di butik
      prisma.rentalOrder.aggregate({
        where: {
          tenantId,
          depositStatus: 'HELD'
        },
        _sum: { depositAmount: true }
      }),
      // 5. Total pendapatan sewa bulan berjalan
      prisma.rentalOrder.aggregate({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { totalAmount: true }
      })
    ]);

    return res.json({
      activeBookings,
      pickedUpToday,
      dueReturnsToday,
      heldDepositTotal: heldDeposits._sum.depositAmount || 0,
      monthRevenueTotal: totalMonthRevenue._sum.totalAmount || 0
    });
  } catch (error: any) {
    console.error('[Rental API] Error getting dashboard stats:', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat statistik rental.' });
  }
});

// ─── 8. GET /api/rental/reports/analytics ─────────────────────────────────────
router.get('/reports/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const periodParam = (req.query.period as string) || 'month';
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam   = req.query.endDate   as string | undefined;

    // ── Resolve date range ────────────────────────────────────────────────────
    const now   = new Date();
    let startDt = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDt   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (periodParam === 'today') {
      startDt = new Date(now); startDt.setHours(0, 0, 0, 0);
      endDt   = new Date(now); endDt.setHours(23, 59, 59, 999);
    } else if (periodParam === 'week') {
      const day = now.getDay();
      startDt = new Date(now); startDt.setDate(now.getDate() - day); startDt.setHours(0, 0, 0, 0);
      endDt   = new Date(now); endDt.setHours(23, 59, 59, 999);
    } else if (periodParam === 'last_month') {
      startDt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDt   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (periodParam === 'custom' && startDateParam) {
      startDt = new Date(startDateParam);
      startDt.setHours(0, 0, 0, 0);
      endDt = endDateParam ? new Date(endDateParam) : new Date();
      endDt.setHours(23, 59, 59, 999);
    }

    const dateFilter = { gte: startDt, lte: endDt };
    const baseWhere  = { tenantId, createdAt: dateFilter };

    // ── 1. Summary Finansial ──────────────────────────────────────────────────
    const [
      financialAgg,
      depositAgg,
      penaltyAgg,
      totalOrders,
      completedOrders,
      cancelledOrders
    ] = await Promise.all([
      prisma.rentalOrder.aggregate({
        where: { ...baseWhere, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true, paidAmount: true, discount: true }
      }),
      prisma.rentalOrder.aggregate({
        where: { ...baseWhere, status: { not: 'CANCELLED' } },
        _sum: { depositAmount: true, depositRefunded: true }
      }),
      prisma.rentalOrder.aggregate({
        where: { ...baseWhere, status: { not: 'CANCELLED' } },
        _sum: { lateFee: true, damageFee: true }
      }),
      prisma.rentalOrder.count({ where: baseWhere }),
      prisma.rentalOrder.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
      prisma.rentalOrder.count({ where: { ...baseWhere, status: 'CANCELLED' } })
    ]);

    const totalRevenue        = financialAgg._sum.totalAmount     || 0;
    const totalPaid           = financialAgg._sum.paidAmount      || 0;
    const totalDiscount       = financialAgg._sum.discount        || 0;
    const totalDeposit        = depositAgg._sum.depositAmount     || 0;
    const totalDepositRefunded= depositAgg._sum.depositRefunded   || 0;
    const totalLateFee        = penaltyAgg._sum.lateFee           || 0;
    const totalDamageFee      = penaltyAgg._sum.damageFee         || 0;
    const depositHeld         = totalDeposit - totalDepositRefunded;
    // netIncome = nilai kontrak (untuk tampilan) — bisa belum tentu lunas
    const netIncome           = totalRevenue + totalLateFee + totalDamageFee;
    // netIncomeCash = kas yang benar-benar masuk (paid + denda) — angka akuntansi
    const netIncomeCash       = totalPaid + totalLateFee + totalDamageFee;
    const unpaidBalance       = totalRevenue - totalPaid;
    const avgTicket           = totalOrders > 0 ? totalRevenue / Math.max(totalOrders - cancelledOrders, 1) : 0;

    // ── 2. Status Pipeline ────────────────────────────────────────────────────
    const pipelineRaw = await prisma.rentalOrder.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
      _sum: { totalAmount: true }
    });

    const pipeline: Record<string, { count: number; revenue: number }> = {};
    for (const row of pipelineRaw) {
      pipeline[row.status] = {
        count  : row._count.id,
        revenue: row._sum.totalAmount || 0
      };
    }

    // ── 3. Top Busana (item terlaris by revenue) ──────────────────────────────
    const allItems = await prisma.rentalOrderItem.findMany({
      where: {
        order: { tenantId, createdAt: dateFilter, status: { not: 'CANCELLED' } }
      },
      select: { attireName: true, attireCode: true, price: true, color: true }
    });

    const busanaMap: Record<string, { name: string; code: string; count: number; revenue: number; color: string }> = {};
    for (const item of allItems) {
      // FIX: fallback key jika attireCode kosong — hindari key undefined/null yang merge semua
      const key = item.attireCode?.trim() || `__nocode__${item.attireName?.trim() || 'UNKNOWN'}`;
      if (!busanaMap[key]) {
        busanaMap[key] = { name: item.attireName || 'Tanpa Nama', code: item.attireCode || '-', count: 0, revenue: 0, color: item.color || '' };
      }
      busanaMap[key].count++;
      busanaMap[key].revenue += item.price;
    }
    const topBusana = Object.values(busanaMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── 4. Tren Pendapatan Harian (max 90 hari) ───────────────────────────────
    const dailyOrders = await prisma.rentalOrder.findMany({
      where: { ...baseWhere, status: { not: 'CANCELLED' } },
      select: { createdAt: true, totalAmount: true, paidAmount: true }
    });

    const dailyMap: Record<string, { revenue: number; orders: number }> = {};
    for (const o of dailyOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[key]) dailyMap[key] = { revenue: 0, orders: 0 };
      dailyMap[key].revenue += o.totalAmount;
      dailyMap[key].orders++;
    }
    const dailyTrend = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── 5. Overdue Returns (PICKED_UP melewati returnDeadline) ───────────────
    const overdueOrders = await prisma.rentalOrder.findMany({
      where: {
        tenantId,
        status: 'PICKED_UP',
        returnDeadline: { lt: now }
      },
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        returnDeadline: true, totalAmount: true, paidAmount: true,
        depositAmount: true, eventDate: true
      },
      orderBy: { returnDeadline: 'asc' },
      take: 50
    });

    const overdueList = overdueOrders.map(o => ({
      ...o,
      daysOverdue: Math.floor((now.getTime() - o.returnDeadline.getTime()) / 86400000)
    }));

    // ── 6. Top Customers ──────────────────────────────────────────────────────
    const allBookings = await prisma.rentalOrder.findMany({
      where: { ...baseWhere, status: { not: 'CANCELLED' } },
      select: { customerName: true, customerPhone: true, totalAmount: true, paidAmount: true }
    });

    const custMap: Record<string, { name: string; phone: string; count: number; revenue: number; paid: number }> = {};
    for (const o of allBookings) {
      const key = o.customerPhone || o.customerName;
      if (!custMap[key]) {
        custMap[key] = { name: o.customerName, phone: o.customerPhone || '', count: 0, revenue: 0, paid: 0 };
      }
      custMap[key].count++;
      custMap[key].revenue += o.totalAmount;
      custMap[key].paid    += o.paidAmount;
    }
    const topCustomers = Object.values(custMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── 7. Payment Method Breakdown ───────────────────────────────────────────
    const paymentMethodRaw = await prisma.rentalOrder.groupBy({
      by: ['paymentMethod'],
      where: { ...baseWhere, status: { not: 'CANCELLED' } },
      _count: { id: true },
      _sum: { paidAmount: true }
    });

    const paymentMethods = paymentMethodRaw.map(r => ({
      method : r.paymentMethod || 'BELUM BAYAR',
      count  : r._count.id,
      amount : r._sum.paidAmount || 0
    }));

    // ── 8. Deposit Status Breakdown ───────────────────────────────────────────
    const depositStatusRaw = await prisma.rentalOrder.groupBy({
      by: ['depositStatus'],
      where: { tenantId },
      _count: { id: true },
      _sum: { depositAmount: true, depositRefunded: true }
    });

    const depositBreakdown = depositStatusRaw.map(r => ({
      status  : r.depositStatus,
      count   : r._count.id,
      amount  : r._sum.depositAmount   || 0,
      refunded: r._sum.depositRefunded || 0
    }));

    // ── 9. Active Custody Orders & Physical Collateral Audit (Lembar Kerja Audit) ───
    const activeCustodyRaw = await prisma.rentalOrder.findMany({
      where: {
        tenantId,
        status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'LAUNDRY'] }
      },
      include: {
        items: {
          select: {
            id: true,
            attireName: true,
            attireCode: true,
            rackHangerCode: true,
            color: true,
            size: true,
            price: true,
            isReturned: true,
            returnCondition: true
          }
        }
      },
      orderBy: { returnDeadline: 'asc' }
    });

    let activePhysicalCollateralCount = 0;
    const activeCustodyOrders = activeCustodyRaw.map(o => {
      let collateralText = '';
      if (o.fittingNotes && o.fittingNotes.includes('[Jaminan Fisik:')) {
        const match = o.fittingNotes.match(/\[Jaminan Fisik:\s*([^\]]+)\]/);
        if (match) collateralText = match[1];
      }
      if (!collateralText && o.idCardPhotoUrl) {
        collateralText = 'Foto KTP/SIM';
      }
      if (collateralText) {
        activePhysicalCollateralCount++;
      }

      const daysOverdue = o.returnDeadline < now 
        ? Math.ceil((now.getTime() - o.returnDeadline.getTime()) / 86400000) 
        : 0;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        eventDate: o.eventDate,
        pickupDate: o.pickupDate,
        returnDeadline: o.returnDeadline,
        status: o.status,
        depositAmount: o.depositAmount,
        depositStatus: o.depositStatus,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        unpaidAmount: Math.max(0, o.totalAmount - o.paidAmount),
        collateralText: collateralText || 'Tidak Ada',
        hasPhysicalCollateral: !!collateralText,
        daysOverdue,
        items: o.items
      };
    });

    // ── 10. Unpaid Orders in Period (Buku Piutang Sewa) ────────────────────────
    const unpaidOrdersRaw = await prisma.rentalOrder.findMany({
      where: {
        ...baseWhere,
        status: { not: 'CANCELLED' }
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        paidAmount: true,
        depositAmount: true,
        eventDate: true,
        returnDeadline: true,
        status: true,
        paymentStatus: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const unpaidOrders = unpaidOrdersRaw
      .filter(o => o.totalAmount > o.paidAmount)
      .map(o => ({
        ...o,
        unpaidAmount: o.totalAmount - o.paidAmount
      }));

    // ── 11. Full Orders for Period (Laporan Transaksi Finansial PDF) ───────────
    const periodOrders = await prisma.rentalOrder.findMany({
      where: {
        ...baseWhere,
        status: { not: 'CANCELLED' }
      },
      include: {
        items: {
          select: {
            attireName: true,
            attireCode: true,
            rackHangerCode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    return res.json({
      period: {
        type     : periodParam,
        startDate: startDt.toISOString(),
        endDate  : endDt.toISOString()
      },
      summary: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        activeOrders    : totalOrders - completedOrders - cancelledOrders,
        totalRevenue,
        totalPaid,
        unpaidBalance,
        totalDiscount,
        netIncome,
        avgTicket,
        totalDeposit,
        totalDepositRefunded,
        depositHeld,
        totalLateFee,
        totalDamageFee,
        totalPenalty    : totalLateFee + totalDamageFee,
        totalGrossRevenue: totalPaid + totalDeposit + totalLateFee + totalDamageFee,
        activeCollateralCount: activePhysicalCollateralCount,
        unpaidOrdersCount: unpaidOrders.length
      },
      pipeline,
      topBusana,
      dailyTrend,
      overdueReturns: overdueList,
      topCustomers,
      paymentMethods,
      depositBreakdown,
      activeCustodyOrders,
      unpaidOrders,
      periodOrders
    });
  } catch (error: any) {
    console.error('[Rental Analytics] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat analitik rental.' });
  }
});

// ─── 8. GET /api/rental/inventory (Manajemen Inventaris Busana Real-Time) ──────
router.get('/inventory', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    // 1. Ambil atau auto-seed kategori & produk rental jika kosong
    let products = await prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      include: { category: true, priceTiers: true },
      orderBy: { name: 'asc' }
    });

    const totalEverProducts = await prisma.product.count({
      where: { tenantId }
    });

    if (products.length === 0 && totalEverProducts === 0) {
      // Auto-seed default traditional attires for rental tenant only if tenant has never created/deleted any products
      const defaultCategories = [
        { name: 'Baju Bodo Modern', items: [
          { name: 'Baju Bodo Modern Organza Payet Marun', code: 'BBM-ORG-MRH-M-01', color: 'Merah Marun', size: 'M', sellPrice: 250000, buyPrice: 650000, rack: 'Hanger A-01', stock: 2 },
          { name: 'Baju Bodo Modern Organza Sage Green', code: 'BBM-ORG-SGE-L-02', color: 'Sage Green', size: 'L', sellPrice: 250000, buyPrice: 650000, rack: 'Hanger A-02', stock: 2 },
          { name: 'Baju Bodo Modern Organza Lilac Pastel', code: 'BBM-ORG-LLC-S-03', color: 'Lilac Pastel', size: 'S', sellPrice: 250000, buyPrice: 650000, rack: 'Hanger A-03', stock: 2 }
        ]},
        { name: 'Baju La\'bu (Hijab)', items: [
          { name: 'Baju La\'bu Sutra Hijab Friendly Botol', code: 'BBL-STR-HJU-M-01', color: 'Hijau Botol', size: 'M', sellPrice: 300000, buyPrice: 800000, rack: 'Hanger B-01', stock: 2 },
          { name: 'Baju La\'bu Sutra Hijab Friendly Maroon', code: 'BBL-STR-MRH-XL-02', color: 'Merah Darah', size: 'XL', sellPrice: 300000, buyPrice: 800000, rack: 'Hanger B-02', stock: 2 }
        ]},
        { name: 'Pengantin Glamour', items: [
          { name: 'Baju Bodo Pengantin Adat Full Mutiara Gold', code: 'BBP-PYT-GLD-L-01', color: 'Gold Emas', size: 'L', sellPrice: 850000, buyPrice: 2200000, rack: 'Hanger VIP-01', stock: 1 },
          { name: 'Baju Bodo Pengantin Putih Suci Silver', code: 'BBP-PYT-PTH-M-02', color: 'Putih Silver', size: 'M', sellPrice: 850000, buyPrice: 2200000, rack: 'Hanger VIP-02', stock: 1 }
        ]},
        { name: 'Jas Tutup & Pria', items: [
          { name: 'Jas Tutup Adat Bugis Hitam Payet Emas', code: 'JST-BGS-HTM-L-01', color: 'Hitam Emas', size: 'L', sellPrice: 200000, buyPrice: 500000, rack: 'Hanger P-01', stock: 3 },
          { name: 'Jas Tutup Adat Bugis Marun Bordir', code: 'JST-BGS-MRN-XL-02', color: 'Merah Marun', size: 'XL', sellPrice: 200000, buyPrice: 500000, rack: 'Hanger P-02', stock: 2 }
        ]},
        { name: 'Baju Adat Anak', items: [
          { name: 'Set Baju Bodo Cilik Pawai Pink', code: 'BBA-STN-PNK-JR-01', color: 'Pink Fanta', size: 'Junior', sellPrice: 100000, buyPrice: 250000, rack: 'Hanger K-01', stock: 3 }
        ]},
        { name: 'Aksesoris & Perhiasan', items: [
          { name: 'Set Perhiasan Saloko Mahkota Bugis Komplit', code: 'AKS-SLK-GLD-01', color: 'Emas Murni', size: 'All Size', sellPrice: 75000, buyPrice: 350000, rack: 'Etalase E-01', stock: 5 },
          { name: 'Keris Tataroppeng Adat Pria Lapis Kuningan', code: 'AKS-KRS-KNG-01', color: 'Kuningan', size: 'Standar', sellPrice: 50000, buyPrice: 200000, rack: 'Etalase E-02', stock: 4 }
        ]}
      ];

      for (const cat of defaultCategories) {
        let dbCat = await prisma.category.findFirst({
          where: { tenantId, name: cat.name }
        });
        if (!dbCat) {
          dbCat = await prisma.category.create({
            data: { tenantId, name: cat.name, printerTarget: 'NONE' }
          });
        }
        for (const it of cat.items) {
          await prisma.product.create({
            data: {
              tenantId,
              categoryId: dbCat.id,
              name: it.name,
              barcode: it.code,
              brand: it.color,
              vehicleType: it.size,
              storageLocation: it.rack,
              sellPrice: it.sellPrice,
              buyPrice: it.buyPrice,
              stock: it.stock,
              minStock: 1,
              status: 'Aktif'
            }
          });
        }
      }

      products = await prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        include: { category: true, priceTiers: true },
        orderBy: { name: 'asc' }
      });
    }

    // 2. Ambil semua order rental aktif untuk tenant ini
    const activeOrders = await prisma.rentalOrder.findMany({
      where: {
        tenantId,
        status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'QC_CHECK', 'LAUNDRY'] }
      },
      include: {
        items: true
      }
    });

    // Ambil juga riwayat semua item rental untuk kalkulasi utilisasi & lifetime revenue
    const allHistoricalItems = await prisma.rentalOrderItem.findMany({
      where: {
        order: { tenantId, status: { not: 'CANCELLED' } }
      },
      select: {
        attireCode: true,
        attireName: true,
        price: true,
        returnCondition: true,
        order: {
          select: {
            status: true,
            totalAmount: true
          }
        }
      }
    });

    const now = new Date();

    // Map agregasi per attireCode / barcode
    const statusMap: Record<string, {
      rentedUnits: number;
      activeRentals: Array<{
        orderId: string;
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        pickupDate: Date;
        returnDeadline: Date;
        isOverdue: boolean;
      }>;
      laundryUnits: number;
      laundryDetails: Array<{
        orderId: string;
        orderNumber: string;
        customerName: string;
        damageNotes: string | null;
      }>;
      bookedUnits: number;
      upcomingBookings: Array<{
        orderId: string;
        orderNumber: string;
        customerName: string;
        eventDate: Date;
        pickupDate: Date;
        returnDeadline: Date;
      }>;
    }> = {};

    for (const ord of activeOrders) {
      const isOverdue = ord.status === 'PICKED_UP' && ord.returnDeadline < now;
      for (const it of ord.items) {
        const code = it.attireCode.trim().toUpperCase();
        if (!statusMap[code]) {
          statusMap[code] = {
            rentedUnits: 0,
            activeRentals: [],
            laundryUnits: 0,
            laundryDetails: [],
            bookedUnits: 0,
            upcomingBookings: []
          };
        }

        if (ord.status === 'PICKED_UP') {
          statusMap[code].rentedUnits += 1;
          statusMap[code].activeRentals.push({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            customerName: ord.customerName,
            customerPhone: ord.customerPhone || '',
            pickupDate: ord.pickupDate,
            returnDeadline: ord.returnDeadline,
            isOverdue
          });
        } else if ((ord.status === 'LAUNDRY' || ord.status === 'RETURNED' || ord.status === 'QC_CHECK') && !it.isReturned) {
          statusMap[code].laundryUnits += 1;
          statusMap[code].laundryDetails.push({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            customerName: ord.customerName,
            damageNotes: it.damageNotes || (ord.status === 'QC_CHECK' ? 'Pengecekan Noda / QC' : 'Baru Kembali')
          });
        } else if (ord.status === 'BOOKED' || ord.status === 'FITTING') {
          statusMap[code].bookedUnits += 1;
          statusMap[code].upcomingBookings.push({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            customerName: ord.customerName,
            eventDate: ord.eventDate,
            pickupDate: ord.pickupDate,
            returnDeadline: ord.returnDeadline
          });
        }
      }
    }

    // Historical stats per code
    const historyMap: Record<string, { count: number; revenue: number; damagedCount: number }> = {};
    for (const it of allHistoricalItems) {
      const code = it.attireCode.trim().toUpperCase();
      if (!historyMap[code]) {
        historyMap[code] = { count: 0, revenue: 0, damagedCount: 0 };
      }
      historyMap[code].count += 1;
      historyMap[code].revenue += (it.price || 0);
      if (it.returnCondition === 'DAMAGED') {
        historyMap[code].damagedCount += 1;
      }
    }

    // Gabungkan dengan catalog produk
    let totalStockUnits = 0;
    let totalAvailableUnits = 0;
    let totalRentedUnits = 0;
    let totalLaundryUnits = 0;
    let totalBookedUnits = 0;
    let totalAssetValue = 0;

    const inventoryList = products.map(prod => {
      const code = (prod.barcode || `SKU-${prod.id}`).trim().toUpperCase();
      const dyn = statusMap[code] || {
        rentedUnits: 0,
        activeRentals: [],
        laundryUnits: 0,
        laundryDetails: [],
        bookedUnits: 0,
        upcomingBookings: []
      };

      const hist = historyMap[code] || { count: 0, revenue: 0, damagedCount: 0 };

      const totalOwned = prod.stock || 1;
      const rented = dyn.rentedUnits;
      const laundry = dyn.laundryUnits;
      const booked = dyn.bookedUnits;
      const available = Math.max(0, totalOwned - (rented + laundry));

      totalStockUnits += totalOwned;
      totalAvailableUnits += available;
      totalRentedUnits += rented;
      totalLaundryUnits += laundry;
      totalBookedUnits += booked;
      totalAssetValue += ((prod.buyPrice || 0) * totalOwned);

      let statusBadge = 'READY'; // READY | RENTED | LAUNDRY | BOOKED | OUT_OF_STOCK | PARTIAL
      if (rented >= totalOwned && totalOwned > 0) {
        statusBadge = 'RENTED';
      } else if (laundry >= totalOwned && totalOwned > 0) {
        statusBadge = 'LAUNDRY';
      } else if (available === 0 && booked > 0) {
        statusBadge = 'BOOKED';
      } else if (available === 0) {
        statusBadge = 'OUT_OF_STOCK';
      } else if (rented > 0 || laundry > 0) {
        statusBadge = 'PARTIAL';
      }

      const roiPercent = prod.buyPrice && prod.buyPrice > 0 
        ? Math.round((hist.revenue / prod.buyPrice) * 100) 
        : 100;

      const rentalAccTiers = (prod.priceTiers || []).filter((t: any) => t.customerCategory === 'RENTAL_ACCESSORY');
      const accessories = rentalAccTiers.length > 0 
        ? rentalAccTiers.map((t: any) => t.tierName)
        : null;
      const accessoryPrices: Record<string, number> = {};
      rentalAccTiers.forEach((t: any) => {
        if (t.unitPrice > 0) {
          accessoryPrices[t.tierName] = t.unitPrice;
        }
      });

      return {
        id: prod.id,
        name: prod.name,
        code: prod.barcode || `SKU-${prod.id}`,
        category: prod.category?.name || 'Umum',
        categoryId: prod.categoryId,
        color: prod.brand || 'Bebas',
        size: prod.vehicleType || 'All Size',
        storageLocation: prod.storageLocation || 'Rak Utama',
        sellPrice: prod.sellPrice,
        buyPrice: prod.buyPrice,
        stock: totalOwned,
        availableStock: available,
        rentedStock: rented,
        laundryStock: laundry,
        bookedStock: booked,
        statusBadge,
        imageUrl: prod.imageUrl,
        accessories,
        accessoryPrices,
        activeRentals: dyn.activeRentals,
        laundryDetails: dyn.laundryDetails,
        upcomingBookings: dyn.upcomingBookings,
        lifetimeRentals: hist.count,
        lifetimeRevenue: hist.revenue,
        lifetimeDamagedCount: hist.damagedCount,
        roiPercent
      };
    });

    const utilizationRate = totalStockUnits > 0 
      ? Math.round((totalRentedUnits / totalStockUnits) * 100) 
      : 0;

    return res.json({
      summary: {
        totalAttires: inventoryList.length,
        totalStockUnits,
        totalAvailableUnits,
        totalRentedUnits,
        totalLaundryUnits,
        totalBookedUnits,
        totalAssetValue,
        utilizationRate
      },
      items: inventoryList
    });
  } catch (error: any) {
    console.error('[Rental Inventory API] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat inventaris busana rental.' });
  }
});

// ─── 9. POST /api/rental/inventory (Tambah Busana Baru) ──────────────────────
router.post('/inventory', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const {
      name,
      code,
      categoryId,
      categoryName,
      color,
      size = 'All Size',
      sellPrice = 0,
      buyPrice = 0,
      stock = 1,
      storageLocation = 'Hanger A-01',
      imageUrl,
      accessories,
      accessoryPrices
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Nama busana wajib diisi.' });
    }

    let finalCatId = Number(categoryId);
    if (!finalCatId && categoryName) {
      let cat = await prisma.category.findFirst({
        where: { tenantId, name: String(categoryName).trim() }
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: { tenantId, name: String(categoryName).trim(), printerTarget: 'NONE' }
        });
      }
      finalCatId = cat.id;
    }

    if (!finalCatId) {
      let defaultCat = await prisma.category.findFirst({ where: { tenantId } });
      if (!defaultCat) {
        defaultCat = await prisma.category.create({
          data: { tenantId, name: 'Baju Bodo Modern', printerTarget: 'NONE' }
        });
      }
      finalCatId = defaultCat.id;
    }

    // Auto-generate code jika kosong
    let finalCode = code ? String(code).trim().toUpperCase() : '';
    if (!finalCode) {
      const count = await prisma.product.count({ where: { tenantId } });
      finalCode = `ATTIRE-${String(count + 1).padStart(3, '0')}`;
    }

    const created = await prisma.product.create({
      data: {
        tenantId,
        categoryId: finalCatId,
        name: String(name).trim(),
        barcode: finalCode,
        brand: color || '',
        vehicleType: size || 'All Size',
        storageLocation: storageLocation || 'Rak Utama',
        sellPrice: Number(sellPrice) || 0,
        buyPrice: Number(buyPrice) || 0,
        stock: Number(stock) || 1,
        minStock: 1,
        imageUrl: imageUrl || null,
        status: 'Aktif'
      },
      include: { category: true }
    });

    // Simpan aksesori bawaan & harga extra ke ProductPriceTier
    if (Array.isArray(accessories) && accessories.length > 0) {
      await prisma.productPriceTier.createMany({
        data: accessories.map((accName: string) => ({
          tenantId,
          productId: created.id,
          tierName: String(accName).trim(),
          unitPrice: Number(accessoryPrices?.[accName]) || 0,
          minQty: 1,
          customerCategory: 'RENTAL_ACCESSORY'
        }))
      });
    }

    return res.status(201).json({
      message: 'Busana baru berhasil ditambahkan ke inventaris.',
      item: created
    });
  } catch (error: any) {
    console.error('[Rental Inventory Create] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal menambahkan busana.' });
  }
});

// ─── 10. PUT /api/rental/inventory/:id (Update Busana) ──────────────────────
router.put('/inventory/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const prodId = Number(req.params.id);
    if (isNaN(prodId)) return res.status(400).json({ error: 'ID busana tidak valid.' });

    const existing = await prisma.product.findFirst({
      where: { id: prodId, tenantId, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Busana tidak ditemukan.' });

    const {
      name,
      code,
      categoryId,
      color,
      size,
      sellPrice,
      buyPrice,
      stock,
      storageLocation,
      imageUrl,
      accessories,
      accessoryPrices
    } = req.body;

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = String(name).trim();
    if (code !== undefined) updatePayload.barcode = String(code).trim().toUpperCase();
    if (categoryId !== undefined) updatePayload.categoryId = Number(categoryId);
    if (color !== undefined) updatePayload.brand = String(color).trim();
    if (size !== undefined) updatePayload.vehicleType = String(size).trim();
    if (sellPrice !== undefined) updatePayload.sellPrice = Number(sellPrice);
    if (buyPrice !== undefined) updatePayload.buyPrice = Number(buyPrice);
    if (stock !== undefined) updatePayload.stock = Number(stock);
    if (storageLocation !== undefined) updatePayload.storageLocation = String(storageLocation).trim();
    if (imageUrl !== undefined) updatePayload.imageUrl = imageUrl;

    const updated = await prisma.product.update({
      where: { id: prodId },
      data: updatePayload,
      include: { category: true }
    });

    if (accessories !== undefined && Array.isArray(accessories)) {
      await prisma.productPriceTier.deleteMany({
        where: { tenantId, productId: prodId, customerCategory: 'RENTAL_ACCESSORY' }
      });
      if (accessories.length > 0) {
        await prisma.productPriceTier.createMany({
          data: accessories.map((accName: string) => ({
            tenantId,
            productId: prodId,
            tierName: String(accName).trim(),
            unitPrice: Number(accessoryPrices?.[accName]) || 0,
            minQty: 1,
            customerCategory: 'RENTAL_ACCESSORY'
          }))
        });
      }
    }

    return res.json({
      message: 'Data busana berhasil diperbarui.',
      item: updated
    });
  } catch (error: any) {
    console.error('[Rental Inventory Update] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal memperbarui data busana.' });
  }
});

// ─── 11. DELETE /api/rental/inventory/:id (Hapus Busana dengan Safety Check) ─
router.delete('/inventory/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const prodId = Number(req.params.id);
    if (isNaN(prodId)) return res.status(400).json({ error: 'ID busana tidak valid.' });

    const prod = await prisma.product.findFirst({
      where: { id: prodId, tenantId }
    });
    if (!prod) return res.status(404).json({ error: 'Busana tidak ditemukan.' });

    // Safety check: Pastikan tidak sedang aktif disewa (status PICKED_UP)
    const code = prod.barcode;
    if (code) {
      const activeOrder = await prisma.rentalOrder.findFirst({
        where: {
          tenantId,
          status: 'PICKED_UP',
          items: { some: { attireCode: code } }
        }
      });
      if (activeOrder) {
        return res.status(400).json({
          error: `Busana "${prod.name}" tidak dapat dihapus karena saat ini sedang aktif disewa oleh ${activeOrder.customerName} (Nota: ${activeOrder.orderNumber}).`
        });
      }
    }

    // Soft delete
    await prisma.product.update({
      where: { id: prodId },
      data: { deletedAt: new Date() }
    });

    return res.json({ message: 'Busana berhasil dihapus dari inventaris.' });
  } catch (error: any) {
    console.error('[Rental Inventory Delete] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal menghapus busana.' });
  }
});

// ─── 12. POST /api/rental/inventory/complete-laundry (Kembalikan Busana ke Rak) 
router.post('/inventory/complete-laundry', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const { orderId, attireCode } = req.body;
    if (!orderId && !attireCode) {
      return res.status(400).json({ error: 'Parameter orderId atau attireCode wajib diberikan.' });
    }

    let updatedOrdersCount = 0;

    if (orderId) {
      const order = await prisma.rentalOrder.findFirst({
        where: { id: orderId, tenantId, status: 'LAUNDRY' }
      });
      if (!order) return res.status(404).json({ error: 'Order laundry tidak ditemukan atau sudah selesai.' });

      await prisma.$transaction([
        prisma.rentalOrderItem.updateMany({
          where: { orderId },
          data: { isReturned: true }
        }),
        prisma.rentalOrder.update({
          where: { id: orderId },
          data: {
            status: 'COMPLETED'
          }
        })
      ]);
      updatedOrdersCount = 1;

      // Real-time notification
      req.app.get('io')?.to('tenant:' + tenantId).emit('rental:order_updated', { id: orderId, status: 'COMPLETED' });
      req.app.get('io')?.to('tenant:' + tenantId).emit('rental:inventory_updated', { orderId });
    } else if (attireCode) {
      const targetCode = String(attireCode).trim().toUpperCase();
      // FIFO: Cari kontrak terlama yang masih menampung busana ini dalam status laundry dan belum dikembalikan
      const oldestOrderWithItem = await prisma.rentalOrder.findFirst({
        where: {
          tenantId,
          status: 'LAUNDRY',
          items: { some: { attireCode: targetCode, isReturned: false } }
        },
        include: { items: true },
        orderBy: { createdAt: 'asc' }
      });

      if (!oldestOrderWithItem) {
        return res.status(404).json({ error: 'Tidak ada busana dengan kode tersebut yang sedang dalam status laundry.' });
      }

      // Cari 1 item yang belum dikembalikan dalam kontrak tersebut
      const itemToReturn = oldestOrderWithItem.items.find(
        it => it.attireCode.trim().toUpperCase() === targetCode && !it.isReturned
      );

      if (itemToReturn) {
        await prisma.rentalOrderItem.update({
          where: { id: itemToReturn.id },
          data: { isReturned: true }
        });
      }

      // Periksa apakah seluruh item pada kontrak ini sudah selesai dicuci
      const remainingUnreturned = await prisma.rentalOrderItem.count({
        where: { orderId: oldestOrderWithItem.id, isReturned: false }
      });

      if (remainingUnreturned === 0) {
        await prisma.rentalOrder.update({
          where: { id: oldestOrderWithItem.id },
          data: { status: 'COMPLETED' }
        });
        updatedOrdersCount = 1;
        req.app.get('io')?.to('tenant:' + tenantId).emit('rental:order_updated', { id: oldestOrderWithItem.id, status: 'COMPLETED' });
      }

      req.app.get('io')?.to('tenant:' + tenantId).emit('rental:inventory_updated', { attireCode: targetCode, orderId: oldestOrderWithItem.id });
    }

    return res.json({
      message: 'Proses cuci/laundry selesai. Busana telah bersih dan status ketersediaan kembali READY di rak/hanger.',
      completedOrders: updatedOrdersCount
    });
  } catch (error: any) {
    console.error('[Rental Complete Laundry] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal menyelesaikan status laundry.' });
  }
});

// ─── 13. GET /api/rental/inventory/:id/history (Riwayat Sewa & ROI Busana) ────
router.get('/inventory/:id/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const prodId = Number(req.params.id);
    if (isNaN(prodId)) return res.status(400).json({ error: 'ID busana tidak valid.' });

    const prod = await prisma.product.findFirst({
      where: { id: prodId, tenantId },
      include: { category: true }
    });
    if (!prod) return res.status(404).json({ error: 'Busana tidak ditemukan.' });

    const code = prod.barcode || `SKU-${prod.id}`;

    // Cari semua rental order items yang menyewa busana ini
    const rentItems = await prisma.rentalOrderItem.findMany({
      where: {
        attireCode: code,
        order: { tenantId, status: { not: 'CANCELLED' } }
      },
      include: {
        order: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalRentalRevenue = rentItems.reduce((acc, it) => acc + (it.price || 0), 0);
    const timesRented = rentItems.length;
    const roiPercent = prod.buyPrice && prod.buyPrice > 0 
      ? Math.round((totalRentalRevenue / prod.buyPrice) * 100) 
      : 100;

    const history = rentItems.map(it => ({
      orderId: it.orderId,
      orderNumber: it.order.orderNumber,
      customerName: it.order.customerName,
      customerPhone: it.order.customerPhone || '',
      pickupDate: it.order.pickupDate,
      returnDeadline: it.order.returnDeadline,
      returnDate: it.order.actualReturnDate,
      rentalPrice: it.price,
      status: it.order.status,
      returnCondition: it.returnCondition,
      damageNotes: it.damageNotes || null,
      lateFee: it.order.lateFee,
      damageFee: it.order.damageFee
    }));

    return res.json({
      product: {
        id: prod.id,
        name: prod.name,
        code,
        category: prod.category?.name || 'Umum',
        color: prod.brand || 'Bebas',
        size: prod.vehicleType || 'All Size',
        storageLocation: prod.storageLocation,
        sellPrice: prod.sellPrice,
        buyPrice: prod.buyPrice,
        stock: prod.stock,
        timesRented,
        totalRentalRevenue,
        roiPercent,
        isBreakEven: totalRentalRevenue >= (prod.buyPrice || 0)
      },
      history
    });
  } catch (error: any) {
    console.error('[Rental Inventory History] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat riwayat sewa busana.' });
  }
});

// ─── 14. POST /api/rental/notifications/run-cron (Trigger On-Demand) ─────────
router.post('/notifications/run-cron', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const audit = await rentalReminderCronService.runRentalReminderCycle();

    return res.json({
      message: 'Siklus pengingat WhatsApp rental berhasil dijalankan.',
      audit
    });
  } catch (error: any) {
    console.error('[Rental Cron Trigger] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal menjalankan cron pengingat sewa.' });
  }
});

// ─── 15. POST /api/rental/orders/:id/send-reminder (Kirim Manual via Button) ─
router.post('/orders/:id/send-reminder', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia.' });

    const orderId = String(req.params.id);
    const { reminderType = 'AUTO' } = req.body; // 'AUTO' | 'DUE_H1' | 'DUE_TODAY' | 'OVERDUE' | 'PICKUP'

    const order: any = await prisma.rentalOrder.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: true,
        tenant: {
          include: {
            settings: true
          }
        }
      }
    });

    if (!order) return res.status(404).json({ error: 'Order rental tidak ditemukan.' });
    if (!order.customerPhone) {
      return res.status(400).json({ error: 'Nomor WhatsApp pelanggan tidak terdaftar pada pesanan ini.' });
    }

    const storeName = order.tenant?.settings?.[0]?.storeName || order.tenant?.name || 'Butik Sewa Busana';
    const storeAddress = order.tenant?.settings?.[0]?.address || undefined;
    const attireSummary = Array.isArray(order.items) ? order.items.map((i: any) => i.attireName).join(', ') : 'Set Busana Adat';
    const now = new Date();
    const deadline = new Date(order.returnDeadline);

    let typeToSend = reminderType;
    if (typeToSend === 'AUTO') {
      if (deadline < now) {
        typeToSend = 'OVERDUE';
      } else {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (deadline >= startOfToday && deadline <= endOfToday) {
          typeToSend = 'DUE_TODAY';
        } else {
          typeToSend = 'DUE_H1';
        }
      }
    }

    let sent = false;

    if (typeToSend === 'OVERDUE') {
      const diffMs = now.getTime() - deadline.getTime();
      const daysLate = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      const estimatedLateFee = daysLate * 50000;

      sent = await WANotifService.sendRentalOverdueAlert({
        tenantId: order.tenantId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderNumber: order.orderNumber,
        attireSummary,
        returnDeadline: deadline,
        daysLate,
        estimatedLateFee,
        storeName
      });
    } else if (typeToSend === 'DUE_TODAY' || typeToSend === 'DUE_H1') {
      const isToday = typeToSend === 'DUE_TODAY';
      sent = await WANotifService.sendRentalDueReminder({
        tenantId: order.tenantId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderNumber: order.orderNumber,
        attireSummary,
        returnDeadline: deadline,
        storeName,
        storeAddress,
        isToday
      });

      if (sent) {
        await prisma.rentalOrder.update({
          where: { id: order.id },
          data: { notifReturnDueSent: true }
        });
      }
    } else if (typeToSend === 'PICKUP') {
      const pickupDateStr = new Date(order.pickupDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

      const msg = `Halo Kak *${order.customerName}*,\n` +
        `Pengingat ramah dari *${storeName}*:\n` +
        `Busana sewa pesanan Anda (*#${order.orderNumber}* - ${attireSummary}) dijadwalkan dapat *DIAMBIL* (${pickupDateStr}). ✨\n\n` +
        `Silakan bawa identitas jaminan (KTP/SIM asli) dan sisa pelunasan saat pengambilan.\n\n` +
        (storeAddress ? `📍 Alamat Butik: ${storeAddress}\n\n` : '') +
        `Terima kasih! Kami tunggu kedatangannya. 🙏`;

      sent = await WANotifService.sendCustomNotification({
        tenantId: order.tenantId,
        customerPhone: order.customerPhone,
        message: msg,
        triggerKey: 'RENTAL_PICKUP_REMINDER',
        referenceId: order.orderNumber
      });

      if (sent) {
        await prisma.rentalOrder.update({
          where: { id: order.id },
          data: { notifPickupSent: true }
        });
      }
    }

    return res.json({
      message: sent 
        ? `Pengingat WhatsApp berhasil dikirim ke ${order.customerName} (${order.customerPhone}).`
        : `Pesan telah disimulasikan / dikirim ke gateway.`,
      sent,
      type: typeToSend,
      customerName: order.customerName,
      customerPhone: order.customerPhone
    });
  } catch (error: any) {
    console.error('[Rental Send Reminder] Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengirim pengingat WhatsApp.' });
  }
});

export default router;


