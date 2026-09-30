import { Router, Response } from 'express';
import prisma from '../db';
import { AuthRequest, authenticateToken } from '../middlewares/authMiddleware';
import { WANotifService } from '../services/WANotifService';

const router = Router();

// ─── HELPER: GENERATE RENTAL ORDER NUMBER (RNT-YYYYMM-0001) ─────────────────
async function generateRentalOrderNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `RNT-${ym}-`;

  const lastOrder = await prisma.rentalOrder.findFirst({
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

    if (startDateParam || endDateParam) {
      where.eventDate = {};
      if (startDateParam) where.eventDate.gte = new Date(startDateParam);
      if (endDateParam) where.eventDate.lte = new Date(endDateParam);
    }

    const limit = Math.min(parseInt(limitParam || '100', 10), 200);
    const offset = parseInt(offsetParam || '0', 10);

    const [orders, total] = await Promise.all([
      prisma.rentalOrder.findMany({
        where,
        include: {
          items: true,
          customer: {
            select: { id: true, name: true, phone: true }
          }
        },
        orderBy: { eventDate: 'asc' },
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
        status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'LAUNDRY'] },
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

    return res.json({
      startDate: start,
      endDate: end,
      busyCount: busySchedule.length,
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

    // 1. Validasi Anti-Double Booking untuk setiap attireCode
    const attireCodes = items.map((it: any) => String(it.attireCode || '').trim()).filter(Boolean);
    if (attireCodes.length > 0) {
      const conflictingOrders = await prisma.rentalOrder.findMany({
        where: {
          tenantId,
          status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'LAUNDRY'] },
          pickupDate: { lte: rDate },
          returnDeadline: { gte: pDate },
          items: {
            some: {
              attireCode: { in: attireCodes }
            }
          }
        },
        include: { items: true }
      });

      if (conflictingOrders.length > 0) {
        const conflict = conflictingOrders[0];
        const clashedItem = conflict.items.find(i => attireCodes.includes(i.attireCode));
        return res.status(409).json({
          error: `Busana "${clashedItem?.attireName || clashedItem?.attireCode}" sudah dipesan pada rentang tanggal tersebut oleh ${conflict.customerName} (Nota: ${conflict.orderNumber}). Silakan pilih baju lain atau sesuaikan tanggal.`
        });
      }
    }

    const orderNumber = await generateRentalOrderNumber(tenantId);
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

    // 2. Transaksi Database Atomik
    const result = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.rentalOrder.create({
        data: {
          tenantId,
          outletId: outlet?.id || null,
          orderNumber,
          customerId: customerId ? Number(customerId) : null,
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
              attireCode: String(it.attireCode || '').trim(),
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

      // Catat uang sewa masuk (DP / Lunas) ke Laci Kasir jika ada pembayaran
      if (parsedPaid > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet?.id || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Sewa Busana',
            amount: parsedPaid,
            description: `Pembayaran ${paymentStatus === 'FULL_PAID' ? 'Lunas' : 'DP'} Sewa Busana #${orderNumber} (${customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      // Catat uang jaminan deposit sebagai titipan kasir jika disetorkan sekarang
      if (parsedDeposit > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet?.id || null,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Titipan Uang Jaminan (Deposit)',
            amount: parsedDeposit,
            description: `Titipan Uang Jaminan Sewa #${orderNumber} (${customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return newOrder;
    });

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
            description: `Pelunasan Sewa Busana #${existing.orderNumber} (${existing.customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return updated;
    });

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

    const parsedLateFee = Math.max(0, Number(lateFee) || 0);
    const parsedDamageFee = Math.max(0, Number(damageFee) || 0);
    const totalDeductions = parsedLateFee + parsedDamageFee;

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
          accessoryChecklist: accessoryChecklist || existing.accessoryChecklist,
          returnProofPhotoUrl: returnProofPhotoUrl || existing.returnProofPhotoUrl
        },
        include: { items: true }
      });

      // 3. Catat Kas Keluar untuk pengembalian sisa deposit
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

      // 4. Jika ada denda yang dipotong dari deposit, catat sebagai pendapatan denda operasional
      if (totalDeductions > 0 && userId) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: existing.outletId,
            userId: Number(userId),
            type: 'Pemasukan',
            category: 'Pendapatan Denda Sewa & Ganti Rugi',
            amount: totalDeductions,
            description: `Kompensasi Denda Keterlambatan/Kerusakan Sewa #${existing.orderNumber} (${existing.customerName})`,
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED'
          }
        });
      }

      return updatedOrder;
    });

    // 5. Notifikasi WhatsApp Pengembalian & Refund Deposit
    if (result.customerPhone) {
      WANotifService.sendCustomNotification({
        tenantId: tenantId || result.tenantId,
        phone: result.customerPhone,
        message:
          `👗 *TANDA TERIMA PENGEMBALIAN BUSANA*\n` +
          `Nomor Kontrak: *#${result.orderNumber}*\n` +
          `Penyewa: *${result.customerName}*\n` +
          `Status Inspeksi: *Selesai & Diterima*\n` +
          (parsedLateFee > 0 ? `Denda Keterlambatan: *Rp ${parsedLateFee.toLocaleString('id-ID')}*\n` : '') +
          (parsedDamageFee > 0 ? `Denda Kerusakan/Hilang: *Rp ${parsedDamageFee.toLocaleString('id-ID')}*\n` : '') +
          `Sisa Uang Jaminan Dikembalikan: *Rp ${refundAmount.toLocaleString('id-ID')}*\n\n` +
          `Terima kasih telah merawat busana kami dengan baik. Sampai jumpa di acara bahagia berikutnya!`
      }).catch((e: any) => console.error('[Rental API] WA dispatch error:', e.message));
    }

    return res.json({
      message: 'Inspeksi pengembalian selesai dan status jaminan deposit berhasil direkonsiliasi.',
      order: result,
      refundAmount,
      totalDeductions
    });
  } catch (error: any) {
    console.error('[Rental API] Error during return inspection:', error);
    return res.status(500).json({ error: error.message || 'Gagal memproses inspeksi pengembalian.' });
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
      // 2. Baju yang jadwal diambil hari ini
      prisma.rentalOrder.count({
        where: {
          tenantId,
          pickupDate: { gte: todayStart, lte: todayEnd }
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

export default router;
