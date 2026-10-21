import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { cacheService } from '../services/CacheService';

const router = Router();

// â”€â”€â”€ 1. POST /api/retail/checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mesin Kasir Cepat Toko Grosir: Mendukung Multi-Satuan (UOM), Auto Tier Price,
// Bon Tempo (Plafon Kredit), dan Penerbitan Surat Jalan (Delivery Order)
router.post('/checkout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const {
      offlineId,
      customerId,
      customerName = 'Pelanggan Umum',
      customerPhone,
      items = [],
      subtotal,
      discount = 0,
      tax = 0,
      total,
      paymentMethod = 'CASH', // CASH | TRANSFER | QRIS | BON | TEMPO | SPLIT
      notes,
      overridePin, // PIN Owner jika plafon bon terlampaui
      // Delivery Order (Opsional)
      isDelivery = false,
      deliveryAddress,
      driverName,
      vehiclePlate,
      deliveryNotes
    } = req.body;

    // 0. Idempotency Check: Jika transaksi dengan offlineId ini sudah ada di tenant, kembalikan transaksi lama
    if (offlineId && String(offlineId).trim() !== '') {
      const existingOrder = await prisma.order.findFirst({
        where: { tenantId, offlineId: String(offlineId).trim() },
        include: { items: true, debt: true, deliveryOrders: true }
      });
      if (existingOrder) {
        return res.json({
          message: 'Transaksi sudah berhasil diproses sebelumnya (Idempotent).',
          isDuplicate: true,
          order: existingOrder
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja tidak boleh kosong.' });
    }

    if (total === undefined || isNaN(Number(total)) || Number(total) < 0) {
      return res.status(400).json({ error: 'Total transaksi tidak valid atau tidak boleh negatif.' });
    }

    // Proteksi Shift Kasir Wajib Aktif untuk transaksi kasir Retail
    const activeShift = await prisma.shift.findFirst({
      where: {
        status: { in: ['Open', 'OPEN'] },
        tenantId
      }
    });

    if (!activeShift) {
      return res.status(400).json({
        error: 'Shift kasir belum dibuka. Harap buka shift kasir dan masukkan modal awal laci terlebih dahulu sebelum melayani transaksi.',
        shiftRequired: true
      });
    }

    // Ambil Outlet Aktif secara resilient (prioritas user.outletId -> ACTIVE -> outlet pertama)
    let outlet = null;
    if (user?.outletId) {
      outlet = await prisma.outlet.findFirst({
        where: { id: user.outletId, tenantId }
      });
    }
    if (!outlet) {
      outlet = await prisma.outlet.findFirst({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'Active', 'aktif', 'AKTIF'] }
        }
      });
    }
    if (!outlet) {
      outlet = await prisma.outlet.findFirst({
        where: { tenantId }
      });
    }
    if (!outlet) {
      return res.status(400).json({ error: 'Outlet untuk tenant ini tidak ditemukan. Harap pastikan outlet telah dibuat.' });
    }

    // 1. Validasi & Kalkulasi Stok Fisik (Konversi ke Base Unit)
    const productIds = items.map((i: any) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, deletedAt: null }
    });
    const productMap = new Map<number, any>(products.map(p => [p.id, p]));

    for (const item of items) {
      const qtyNum = Number(item.qty);
      const priceNum = Number(item.price);

      if (isNaN(qtyNum) || qtyNum <= 0) {
        return res.status(400).json({ error: `Kuantitas untuk produk ID #${item.productId} harus lebih besar dari 0.` });
      }
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: `Harga untuk produk ID #${item.productId} tidak boleh negatif.` });
      }

      const p = productMap.get(Number(item.productId));
      if (!p) {
        return res.status(400).json({ error: `Produk ID #${item.productId} tidak ditemukan atau bukan milik outlet ini.` });
      }

      // Hitung pengali kuantitas ke base unit
      const ratio = Number(item.uomRatio) > 0 ? Number(item.uomRatio) : 1;
      const baseQtyToDeduct = Math.round(qtyNum * ratio);

      // Warning bila stok minus (toko grosir tetap boleh menjual barang yang baru datang belum sempat diinput)
      // Logika dipertahankan transparan
    }

    // 2. Validasi Pembayaran Bon / Tempo (Credit Limit Check)
    const isBonPayment = ['BON', 'TEMPO', 'HUTANG', 'PIUTANG'].includes(String(paymentMethod).toUpperCase());
    let customerRecord: any = null;

    if (isBonPayment) {
      if (!customerId) {
        return res.status(400).json({ error: 'Transaksi Bon / Tempo wajib memilih data Pelanggan / Warung Langganan.' });
      }

      customerRecord = await prisma.customer.findFirst({
        where: { id: Number(customerId), tenantId, deletedAt: null }
      });

      if (!customerRecord) {
        return res.status(404).json({ error: 'Data pelanggan tidak ditemukan.' });
      }

      if (customerRecord.isCreditBlocked) {
        return res.status(403).json({
          error: `Fasilitas bon untuk "${customerRecord.name}" sedang DIBLOKIR. Harap selesaikan tunggakan sebelumnya.`,
          code: 'CUSTOMER_CREDIT_BLOCKED'
        });
      }

      // Hitung total hutang yang masih aktif
      const activeDebts = await prisma.debt.findMany({
        where: { customerId: customerRecord.id, tenantId, status: { not: 'Lunas' } }
      });
      const currentActiveDebt = activeDebts.reduce((sum, d) => sum + (d.remaining ?? d.amount), 0);
      const newTotalDebt = currentActiveDebt + Number(total);

      // Jika ada limit kredit yang diset (> 0)
      if (customerRecord.creditLimit > 0 && newTotalDebt > customerRecord.creditLimit) {
        // Cek apakah ada PIN Owner override
        if (!overridePin) {
          const excess = newTotalDebt - customerRecord.creditLimit;
          return res.status(400).json({
            error: `Plafon Bon Terlampaui! Limit: Rp ${customerRecord.creditLimit.toLocaleString('id-ID')}, Total Bon Berjalan: Rp ${newTotalDebt.toLocaleString('id-ID')} (Lebih Rp ${excess.toLocaleString('id-ID')}). Masukkan PIN Owner untuk menyetujui.`,
            code: 'OVER_CREDIT_LIMIT',
            creditLimit: customerRecord.creditLimit,
            currentActiveDebt,
            excess
          });
        }

        // Verifikasi PIN Owner / Admin / Manager (Scoped to current tenant: direct user + memberships)
        const cleanPin = String(overridePin).trim();
        const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'Owner', 'Admin', 'Manager', 'Supervisor'];

        const ownerUser = await prisma.user.findFirst({
          where: {
            status: 'Aktif',
            OR: [
              // Kasus 1: Direct user (tenantId di record User)
              {
                tenantId,
                pin: cleanPin,
                role: { in: allowedRoles }
              },
              // Kasus 2: Tenant Membership (multi-tenant mapping)
              {
                memberships: {
                  some: {
                    tenantId,
                    status: 'ACTIVE',
                    AND: [
                      {
                        OR: [
                          { pin: cleanPin },
                          { user: { pin: cleanPin } }
                        ]
                      },
                      {
                        OR: [
                          { role: { name: { in: allowedRoles } } },
                          { user: { role: { in: allowedRoles } } }
                        ]
                      }
                    ]
                  }
                }
              }
            ]
          }
        });

        if (!ownerUser) {
          return res.status(401).json({ error: 'PIN Otorisasi Owner/Supervisor tidak valid.', code: 'INVALID_OWNER_PIN' });
        }
      }
    }

    // 3. Eksekusi Transaksi Database Atomic ($transaction)
    const result = await prisma.$transaction(async (tx) => {
      // a. Nomor Urut Faktur (Collision-Proof Sequence)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const prefix = `FK-${dateStr}-`;

      const lastOrder = await tx.order.findFirst({
        where: {
          tenantId,
          orderNumber: { startsWith: prefix }
        },
        orderBy: { orderNumber: 'desc' }
      });

      let nextSeq = 1;
      if (lastOrder && lastOrder.orderNumber) {
        const parts = lastOrder.orderNumber.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          nextSeq = lastNum + 1;
        }
      }
      let orderNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

      // Double check uniqueness loop to guarantee zero P2002 collision
      let orderCollision = await tx.order.findFirst({
        where: { tenantId, orderNumber }
      });
      let attempts = 0;
      while (orderCollision && attempts < 20) {
        nextSeq++;
        attempts++;
        orderNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
        orderCollision = await tx.order.findFirst({
          where: { tenantId, orderNumber }
        });
      }

      // b. Buat Order
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          outletId: outlet.id,
          orderNumber,
          offlineId: offlineId ? String(offlineId).trim() : null,
          customerName: customerRecord?.name || customerName,
          customerPhone: customerRecord?.phone || customerPhone,
          customerId: customerRecord?.id || (customerId ? Number(customerId) : null),
          userId: user.id,
          subtotal: Number(subtotal),
          discount: Number(discount),
          tax: Number(tax),
          serviceCharge: 0,
          total: Number(total),
          paymentMethod: isBonPayment ? 'BON' : String(paymentMethod).toUpperCase(),
          status: isBonPayment ? 'Pending' : 'Paid',
          kdsStatus: 'Ready',
          paidAt: isBonPayment ? null : new Date()
        }
      });

      // c. Buat OrderItems & Potong Stok Base Unit
      for (const item of items) {
        const ratio = Number(item.uomRatio) > 0 ? Number(item.uomRatio) : 1;
        const baseQtyToDeduct = Math.round(Number(item.qty) * ratio);

        await tx.orderItem.create({
          data: {
            tenantId,
            outletId: outlet.id,
            orderId: newOrder.id,
            productId: Number(item.productId),
            qty: Number(item.qty),
            price: Number(item.price),
            buyPrice: Number(item.buyPrice || 0),
            subtotal: Number(item.subtotal || (Number(item.qty) * Number(item.price))),
            notes: item.notes || null,
            uomName: item.uomName || 'PCS',
            uomRatio: ratio,
            priceTierName: item.priceTierName || null
          }
        });

        // Potong stok fisik produk pada satuan terkecil
        await tx.product.update({
          where: { id: Number(item.productId) },
          data: {
            stock: { decrement: baseQtyToDeduct }
          }
        });
      }

      // d. Catat Hutang / Bon jika metode bayar BON
      let debtRecord = null;
      if (isBonPayment && customerRecord) {
        const termDays = customerRecord.creditTermDays || 14;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + termDays);

        debtRecord = await tx.debt.create({
          data: {
            tenantId,
            orderId: newOrder.id,
            customerId: customerRecord.id,
            amount: Number(total),
            remaining: Number(total),
            dueDate,
            status: 'Belum Lunas',
            notes: notes || `Bon Tempo Grosir (${termDays} hari)`
          }
        });
      }

      // e. Buat Surat Jalan (Delivery Order) jika barang dikirim armada
      let deliveryOrderRecord = null;
      if (isDelivery) {
        const doPrefix = `DO-${dateStr}-`;
        const lastDO = await tx.deliveryOrder.findFirst({
          where: {
            tenantId,
            doNumber: { startsWith: doPrefix }
          },
          orderBy: { doNumber: 'desc' }
        });

        let nextDoSeq = 1;
        if (lastDO && lastDO.doNumber) {
          const doParts = lastDO.doNumber.split('-');
          const lastDoNum = parseInt(doParts[doParts.length - 1], 10);
          if (!isNaN(lastDoNum)) {
            nextDoSeq = lastDoNum + 1;
          }
        }
        let doNumber = `${doPrefix}${String(nextDoSeq).padStart(4, '0')}`;

        let doCollision = await tx.deliveryOrder.findFirst({
          where: { tenantId, doNumber }
        });
        let doAttempts = 0;
        while (doCollision && doAttempts < 20) {
          nextDoSeq++;
          doAttempts++;
          doNumber = `${doPrefix}${String(nextDoSeq).padStart(4, '0')}`;
          doCollision = await tx.deliveryOrder.findFirst({
            where: { tenantId, doNumber }
          });
        }

        deliveryOrderRecord = await tx.deliveryOrder.create({
          data: {
            tenantId,
            doNumber,
            orderId: newOrder.id,
            customerId: customerRecord?.id || null,
            driverName: driverName || null,
            vehiclePlate: vehiclePlate || null,
            shippingAddress: deliveryAddress || customerRecord?.phone || 'Diantar ke lokasi pelanggan',
            status: 'PENDING',
            notes: deliveryNotes || notes || null,
            items: {
              create: items.map((i: any) => ({
                productName: i.productName || `Produk #${i.productId}`,
                qtyShipped: Number(i.qty),
                unitName: i.uomName || 'PCS'
              }))
            }
          },
          include: { items: true }
        });
      }

      // f. Catat Arus Kas Masuk jika transaksi tunai/non-bon
      if (!isBonPayment) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: outlet.id,
            type: 'Pemasukan',
            category: 'Penjualan Kasir',
            amount: Number(total),
            description: `Penjualan Faktur ${orderNumber} (${paymentMethod})`,
            userId: user.id,
            date: new Date()
          }
        });
      }

      const fullOrder = await tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          items: true,
          debt: true,
          deliveryOrders: true
        }
      });

      return {
        order: fullOrder || newOrder,
        debt: debtRecord,
        deliveryOrder: deliveryOrderRecord
      };
    });

    // Invalidate Cache
    await cacheService.bumpTenantCatalogVersion(tenantId);

    // Audit Log
    AuditLogger.log({
      action: 'RETAIL_CHECKOUT',
      resource: 'ORDER',
      resourceId: String(result.order.id),
      description: `Faktur penjualan ${result.order.orderNumber} senilai Rp ${result.order.total.toLocaleString('id-ID')} (${result.order.paymentMethod}) berhasil dibukukan.`,
      severity: 'INFO'
    }, req);

    return res.status(201).json({
      success: true,
      message: 'Transaksi kasir grosir berhasil dibukukan.',
      data: result
    });
  } catch (err: any) {
    console.error('[RetailCheckout Error]:', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses transaksi kasir grosir.' });
  }
});

// â”€â”€â”€ 2. GET /api/retail/delivery-orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Daftar Surat Jalan (DO) Pengiriman Armada
router.get('/delivery-orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const { status } = req.query;
    const whereClause: any = { tenantId };
    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    const deliveryOrders = await prisma.deliveryOrder.findMany({
      where: whereClause,
      include: {
        order: { select: { orderNumber: true, total: true, customerName: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(deliveryOrders);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil data surat jalan.' });
  }
});

// â”€â”€â”€ 3. PATCH /api/retail/delivery-orders/:id/status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update Status Pengiriman (PENDING -> LOADING -> IN_TRANSIT -> DELIVERED)
router.patch('/delivery-orders/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const id = String(req.params.id);
    const { status, recipientName, driverName, vehiclePlate, notes } = req.body;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const existing = await prisma.deliveryOrder.findFirst({
      where: { id, tenantId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Surat jalan tidak ditemukan.' });
    }

    const cleanStatus = String(status || '').toUpperCase();
    const updateData: any = {
      status: cleanStatus
    };

    if (driverName) updateData.driverName = driverName;
    if (vehiclePlate) updateData.vehiclePlate = vehiclePlate;
    if (notes) updateData.notes = notes;

    if (cleanStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (recipientName) updateData.recipientName = recipientName;
    }

    const updateResult = await prisma.deliveryOrder.updateMany({
      where: { id, tenantId },
      data: updateData
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Surat jalan tidak ditemukan atau akses ditolak.' });
    }

    const updated = await prisma.deliveryOrder.findFirst({
      where: { id, tenantId },
      include: { items: true, order: true }
    });

    res.json({
      success: true,
      message: `Status surat jalan ${updated?.doNumber || id} diperbarui menjadi ${cleanStatus}.`,
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui status surat jalan.' });
  }
});

// â”€â”€â”€ 4. GET /api/retail/customers/credit-summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Rekap Plafon & Piutang Bon Pelanggan Warung
router.get('/customers/credit-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const customers = await prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        debts: {
          where: { status: { not: 'Lunas' } },
          select: { id: true, amount: true, remaining: true, dueDate: true, createdAt: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const summary = customers.map(c => {
      const activeDebtTotal = c.debts.reduce((sum, d) => sum + (d.remaining ?? d.amount), 0);
      const remainingLimit = c.creditLimit > 0 ? Math.max(0, c.creditLimit - activeDebtTotal) : 0;
      const isOverLimit = c.creditLimit > 0 && activeDebtTotal > c.creditLimit;

      // Cek apakah ada bon jatuh tempo yang lewat hari ini
      const now = new Date();
      const hasOverdue = c.debts.some(d => d.dueDate && new Date(d.dueDate) < now);

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        priceTier: c.priceTier,
        creditLimit: c.creditLimit,
        creditTermDays: c.creditTermDays,
        isCreditBlocked: c.isCreditBlocked,
        activeDebtTotal,
        remainingLimit,
        isOverLimit,
        hasOverdue,
        activeDebtCount: c.debts.length
      };
    });

    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil rekap piutang pelanggan.' });
  }
});

// â”€â”€â”€ 5. PATCH /api/retail/customers/:id/credit-limit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update Plafon Kredit & Status Blokir Pelanggan
router.patch('/customers/:id/credit-limit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const customerId = Number(req.params.id);
    const { creditLimit, creditTermDays, isCreditBlocked } = req.body;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null }
    });
    if (!customer) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });

    const updateData: any = {};
    if (creditLimit !== undefined) updateData.creditLimit = Math.max(0, Number(creditLimit));
    if (creditTermDays !== undefined) updateData.creditTermDays = Math.max(1, Number(creditTermDays));
    if (isCreditBlocked !== undefined) updateData.isCreditBlocked = Boolean(isCreditBlocked);

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData
    });

    res.json({
      success: true,
      message: `Plafon kredit "${updated.name}" berhasil diperbarui.`,
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengupdate limit kredit pelanggan.' });
  }
});

// â”€â”€â”€ 6. GET /api/retail/reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Analytics & Financial Reports Khusus Retail (Summary, Tiered Sales, AR Ageing, Stock Velocity)
router.get('/reports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(String(startDate)) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(String(endDate) + 'T23:59:59.999Z') : new Date();

    // 1. Fetch Orders within date range
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end }
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, categoryId: true, buyPrice: true } }
          }
        },
        customer: { select: { id: true, name: true, priceTier: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Summary Calculations
    let totalSales = 0;
    let totalCost = 0;
    let totalOrders = orders.length;

    // Price Tier Summaries
    const tierSales: Record<string, { count: number; sales: number; cost: number }> = {
      UMUM: { count: 0, sales: 0, cost: 0 },
      MITRA: { count: 0, sales: 0, cost: 0 },
      GROSIR: { count: 0, sales: 0, cost: 0 }
    };

    // Product Sales Velocity Map
    const productMap: Record<number, { id: number; name: string; category: string; qtySold: number; totalSales: number; totalCost: number }> = {};

    for (const ord of orders) {
      totalSales += ord.total || 0;
      const tier = (ord.customer?.priceTier || 'UMUM').toUpperCase();
      if (!tierSales[tier]) tierSales[tier] = { count: 0, sales: 0, cost: 0 };
      tierSales[tier].count += 1;
      tierSales[tier].sales += ord.total || 0;

      for (const item of ord.items) {
        const buyP = item.buyPrice || item.product?.buyPrice || 0;
        const itemCost = buyP * item.qty;
        totalCost += itemCost;
        tierSales[tier].cost += itemCost;

        const pId = item.productId || item.product?.id || 0;
        if (pId) {
          if (!productMap[pId]) {
            productMap[pId] = {
              id: pId,
              name: item.product?.name || `Produk #${pId}`,
              category: 'Retail',
              qtySold: 0,
              totalSales: 0,
              totalCost: 0
            };
          }
          productMap[pId].qtySold += item.qty;
          productMap[pId].totalSales += item.subtotal || (item.price * item.qty);
          productMap[pId].totalCost += itemCost;
        }
      }
    }

    const grossProfit = totalSales - totalCost;
    const marginPercentage = totalSales > 0 ? Number(((grossProfit / totalSales) * 100).toFixed(1)) : 0;

    // Fast moving (Top 10 by qty) & Slow moving (Bottom 10)
    const productList = Object.values(productMap);
    productList.sort((a, b) => b.qtySold - a.qtySold);
    const fastMoving = productList.slice(0, 10);
    const slowMoving = [...productList].reverse().slice(0, 10);

    // 2b. Dead Stock (Barang Tidak Bergerak / Stok Mati / Mengendap)
    // Ambil produk aktif yang memiliki stok fisik > 0 di tenant ini
    const allStockedProducts = await prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        stock: true,
        buyPrice: true,
        sellPrice: true,
        storageLocation: true,
        baseUom: true,
        barcode: true,
        category: { select: { id: true, name: true } }
      }
    });

    const soldProductIds = new Set(Object.keys(productMap).map(Number));

    const deadStockProducts = allStockedProducts
      .filter(p => !soldProductIds.has(p.id))
      .map(p => {
        const buyP = Number(p.buyPrice || 0);
        return {
          id: p.id,
          name: p.name,
          category: p.category?.name || 'Retail',
          stock: p.stock,
          baseUom: p.baseUom || 'PCS',
          barcode: p.barcode || '-',
          buyPrice: buyP,
          sellPrice: Number(p.sellPrice || 0),
          storageLocation: p.storageLocation || 'Rak Etalase',
          tiedUpCapital: p.stock * buyP
        };
      })
      .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

    const totalTiedUpCapital = deadStockProducts.reduce((sum, p) => sum + p.tiedUpCapital, 0);
    const deadStock = deadStockProducts.slice(0, 20);

    // 3. AR Ageing (Customer Debts)
    const activeDebts = await prisma.debt.findMany({
      where: {
        tenantId,
        status: { not: 'Lunas' }
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } }
      }
    });

    let totalAR = 0;
    let currentAR = 0; // <= 30 days
    let ageing30to60 = 0;
    let ageingOver60 = 0;

    const now = new Date();
    const arList = activeDebts.map(d => {
      const remaining = d.remaining ?? d.amount;
      totalAR += remaining;

      const created = new Date(d.createdAt);
      const ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 3600 * 24));

      if (ageDays <= 30) currentAR += remaining;
      else if (ageDays <= 60) ageing30to60 += remaining;
      else ageingOver60 += remaining;

      return {
        id: d.id,
        customerId: d.customerId,
        customerName: d.customer?.name || 'Pelanggan',
        customerPhone: d.customer?.phone || '-',
        amount: d.amount,
        remaining,
        dueDate: d.dueDate,
        ageDays,
        createdAt: d.createdAt
      };
    });

    // 4. Delivery Orders Summary
    const deliveryOrders = await prisma.deliveryOrder.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end }
      }
    });

    const deliverySummary = {
      total: deliveryOrders.length,
      pending: deliveryOrders.filter(d => (d.status || '').toUpperCase() === 'PENDING').length,
      inTransit: deliveryOrders.filter(d => (d.status || '').toUpperCase() === 'IN_TRANSIT').length,
      delivered: deliveryOrders.filter(d => (d.status || '').toUpperCase() === 'DELIVERED').length
    };

    // 5. Daily Trend â€” Grouped by day, segmented by customer price tier
    const dailyTrendMap: Record<string, { date: string; dateFormatted: string; salesUmum: number; salesMitra: number; salesGrosir: number; totalSales: number }> = {};
    for (const ord of orders) {
      const dayKey = new Date(ord.createdAt).toISOString().split('T')[0];
      if (!dailyTrendMap[dayKey]) {
        dailyTrendMap[dayKey] = {
          date: dayKey,
          dateFormatted: new Date(dayKey).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          salesUmum: 0,
          salesMitra: 0,
          salesGrosir: 0,
          totalSales: 0
        };
      }
      const tier = (ord.customer?.priceTier || 'UMUM').toUpperCase();
      const amount = ord.total || 0;
      if (tier === 'MITRA') dailyTrendMap[dayKey].salesMitra += amount;
      else if (tier === 'GROSIR') dailyTrendMap[dayKey].salesGrosir += amount;
      else dailyTrendMap[dayKey].salesUmum += amount;
      dailyTrendMap[dayKey].totalSales += amount;
    }
    const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

    // 6. Shift Kasir Summary (Rekap Kas Laci)
    const shifts = await prisma.shift.findMany({
      where: {
        tenantId,
        waktuBuka: { gte: start, lte: end }
      },
      include: {
        user: { select: { name: true, username: true } }
      },
      orderBy: { waktuBuka: 'desc' }
    });

    // 7. CashFlow Opex (Pengeluaran Kas Operasional Toko)
    const opexExpenses = await prisma.cashFlow.findMany({
      where: {
        tenantId,
        type: 'Pengeluaran',
        date: { gte: start, lte: end }
      }
    });
    const totalCashOut = opexExpenses.reduce((sum, c) => sum + (c.amount || 0), 0);

    let totalCashIn = 0;
    const shiftRows = shifts.map(s => {
      const opening = s.saldoAwal || 0;
      const closing = s.saldoFisikLaci || s.saldoSistem || 0;
      // Total penjualan kasir dalam shift = selisih saldo akhir - saldo awal
      const shiftSales = Math.max(0, closing - opening);
      totalCashIn += shiftSales;
      return {
        staffName: (s.user as any)?.name || (s.user as any)?.username || 'Kasir',
        date: s.waktuBuka,
        shiftLabel: s.waktuTutup ? `Shift ${new Date(s.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.waktuTutup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Shift Aktif',
        openingCash: opening,
        totalSales: shiftSales,
        totalExpenses: totalCashOut,
        closingCash: closing,
        status: s.status === 'Open' ? 'OPEN' : 'CLOSED'
      };
    });

    const shiftSummary = {
      totalShifts: shifts.length,
      totalCashIn,
      totalCashOut,
      netCash: totalCashIn - totalCashOut,
      shifts: shiftRows
    };

    // 8. Payment Methods Breakdown
    const paymentMethodsMap: Record<string, { count: number; total: number }> = {};
    for (const ord of orders) {
      const pm = (ord.paymentMethod || 'TUNAI').toUpperCase();
      if (!paymentMethodsMap[pm]) paymentMethodsMap[pm] = { count: 0, total: 0 };
      paymentMethodsMap[pm].count += 1;
      paymentMethodsMap[pm].total += ord.total || 0;
    }
    const paymentMethods = Object.entries(paymentMethodsMap).map(([method, val]) => ({
      method,
      count: val.count,
      total: val.total,
      percentage: totalSales > 0 ? Number(((val.total / totalSales) * 100).toFixed(1)) : 0
    }));

    const summary = {
      totalSales,
      totalCost,
      grossProfit,
      marginPercentage,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
      tiedUpCapitalInDeadStock: totalTiedUpCapital,
      deadStockCount: deadStockProducts.length
    };

    const tierBreakdown = Object.entries(tierSales).map(([tier, data]) => {
      const profit = data.sales - data.cost;
      return {
        tier,
        count: data.count,
        sales: data.sales,
        cost: data.cost,
        profit,
        margin: data.sales > 0 ? Number(((profit / data.sales) * 100).toFixed(1)) : 0
      };
    });

    res.json({
      summary,
      tierSales: tierBreakdown,
      stockVelocity: {
        fastMoving,
        slowMoving,
        deadStock,
        totalTiedUpCapital,
        deadStockCount: deadStockProducts.length
      },
      arAgeing: {
        totalAR,
        currentAR,
        ageing30to60,
        ageingOver60,
        debts: arList
      },
      deliverySummary,
      dailyTrend,
      shiftSummary,
      paymentMethods
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat laporan retail.' });
  }
});

// â”€â”€â”€ 7. GET /api/retail/customers/:id/statement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Lembar Tagihan Bon Akumulatif per Pelanggan / Mandor (Customer AR Statement)
router.get('/customers/:id/statement', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const customerId = Number(req.params.id);
    const { status = 'ALL', startDate, endDate } = req.query;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null }
    });
    if (!customer) return res.status(404).json({ error: 'Data pelanggan tidak ditemukan.' });

    const debtWhere: any = {
      tenantId,
      customerId
    };

    if (status === 'UNPAID') {
      debtWhere.status = { not: 'Lunas' };
    } else if (status === 'PAID') {
      debtWhere.status = 'Lunas';
    }

    if (startDate || endDate) {
      debtWhere.createdAt = {};
      if (startDate) debtWhere.createdAt.gte = new Date(String(startDate));
      if (endDate) debtWhere.createdAt.lte = new Date(String(endDate) + 'T23:59:59.999Z');
    }

    const debts = await prisma.debt.findMany({
      where: debtWhere,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            total: true,
            notes: true,
            items: {
              select: {
                id: true,
                qty: true,
                price: true,
                subtotal: true,
                uomName: true,
                product: { select: { id: true, name: true, barcode: true } }
              }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    let totalBilled = 0;
    let totalRemaining = 0;
    let totalPaid = 0;
    let overdueCount = 0;

    const formattedDebts = debts.map(d => {
      const remaining = d.remaining ?? d.amount;
      const isOverdue = d.status !== 'Lunas' && d.dueDate && new Date(d.dueDate) < now;
      if (isOverdue) overdueCount++;

      totalBilled += d.amount;
      totalRemaining += remaining;
      const paid = d.amount - remaining;
      totalPaid += paid;

      const created = new Date(d.createdAt);
      const ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 3600 * 24));

      return {
        id: d.id,
        invoiceNumber: d.order?.orderNumber || `BON-${d.id}`,
        date: d.createdAt,
        dueDate: d.dueDate,
        amount: d.amount,
        remaining,
        paid,
        status: d.status,
        ageDays,
        isOverdue,
        notes: d.notes,
        items: (d.order?.items || []).map((it: any) => ({
          productName: it.product?.name || 'Barang Toko',
          barcode: it.product?.barcode || '',
          qty: it.qty,
          uomName: it.uomName || 'PCS',
          price: it.price,
          subtotal: it.subtotal
        })),
        payments: (d.payments || []).map((p: any) => ({
          id: p.id,
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod,
          date: p.createdAt
        }))
      };
    });

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: (customer as any).address || (customer as any).notes || 'Alamat tidak terdata',
        creditLimit: customer.creditLimit,
        creditTermDays: customer.creditTermDays,
        isCreditBlocked: customer.isCreditBlocked,
        priceTier: customer.priceTier
      },
      summary: {
        totalDebtsCount: debts.length,
        totalBilled,
        totalPaid,
        totalRemaining,
        overdueCount
      },
      debts: formattedDebts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat lembar tagihan pelanggan.' });
  }
});

// â”€â”€â”€ 8. GET /api/retail/inventory/opname-sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Formulir Stock Opname Fisik Rak & Valuasi Persediaan Toko
router.get('/inventory/opname-sheet', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const { categoryId, sortBy = 'location' } = req.query;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });

    const whereClause: any = {
      tenantId,
      deletedAt: null
    };

    if (categoryId && categoryId !== 'ALL') {
      whereClause.categoryId = Number(categoryId);
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: { select: { id: true, name: true } },
        productUoms: { select: { unitName: true, conversionRatio: true, barcode: true, priceSell: true } }
      },
      orderBy: sortBy === 'name' ? { name: 'asc' } : { storageLocation: 'asc' }
    });

    let totalValuation = 0;
    let totalPieces = 0;
    let lowStockCount = 0;
    let negativeStockCount = 0;

    const items = products.map(p => {
      const buyP = p.buyPrice || 0;
      const stock = p.stock || 0;
      const positiveStock = Math.max(0, stock);
      const val = positiveStock * buyP;

      totalValuation += val;
      totalPieces += positiveStock;
      if (stock < 0) negativeStockCount++;
      if (p.minStock > 0 && stock <= p.minStock) lowStockCount++;

      return {
        id: p.id,
        name: p.name,
        barcode: p.barcode || '-',
        categoryName: p.category?.name || 'Umum',
        storageLocation: p.storageLocation || 'Rak Etalase',
        baseUom: p.baseUom || 'PCS',
        systemStock: stock,
        minStock: p.minStock,
        buyPrice: buyP,
        sellPrice: p.sellPrice || 0,
        valuation: val,
        isNegative: stock < 0,
        uoms: (p.productUoms || []).map(u => `${u.unitName} (${u.conversionRatio}x)`)
      };
    });

    res.json({
      summary: {
        totalSKU: products.length,
        totalPieces,
        totalValuation,
        lowStockCount,
        negativeStockCount
      },
      items
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat lembar stock opname.' });
  }
});

// â”€â”€â”€ 9. POST /api/retail/customers/:id/pay-debt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Pelunasan Cicilan Bon Cepat di Meja Kasir (FIFO Debt Allocation)
router.post('/customers/:id/pay-debt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    const customerId = Number(req.params.id);
    const { amountPaid, paymentMethod = 'TUNAI', notes } = req.body;
    const userId = user?.id || 1;
    const outletId = user?.outletId;

    if (!tenantId) return res.status(400).json({ error: 'Tenant context wajib disertakan.' });
    if (!amountPaid || Number(amountPaid) <= 0) {
      return res.status(400).json({ error: 'Jumlah pembayaran harus lebih besar dari 0.' });
    }

    // Proteksi Shift Kasir Wajib Aktif untuk penerimaan pelunasan piutang kasir
    const activeShift = await prisma.shift.findFirst({
      where: {
        status: { in: ['Open', 'OPEN'] },
        tenantId
      }
    });

    if (!activeShift) {
      return res.status(400).json({
        error: 'Shift kasir belum dibuka. Harap buka shift kasir terlebih dahulu sebelum menerima pembayaran piutang kasir.',
        shiftRequired: true
      });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null }
    });
    if (!customer) return res.status(404).json({ error: 'Data pelanggan tidak ditemukan.' });

    const totalPayNum = Number(amountPaid);

    const result = await prisma.$transaction(async (tx) => {
      // Ambil seluruh piutang belum lunas milik pelanggan, urutkan dari yang paling lama (FIFO)
      const unpaidDebts = await tx.debt.findMany({
        where: {
          tenantId,
          customerId,
          status: { not: 'Lunas' }
        },
        include: {
          order: { select: { id: true, orderNumber: true, total: true, createdAt: true } }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (unpaidDebts.length === 0) {
        throw new Error(`Pelanggan "${customer.name}" tidak memiliki piutang bon aktif.`);
      }

      const totalActiveDebt = unpaidDebts.reduce((sum, d) => sum + (d.remaining ?? d.amount), 0);
      if (totalPayNum > totalActiveDebt) {
        throw new Error(`Nominal bayar (Rp ${totalPayNum.toLocaleString('id-ID')}) melebihi total seluruh piutang aktif pelanggan (Rp ${totalActiveDebt.toLocaleString('id-ID')}).`);
      }

      let remainingMoneyToAllocate = totalPayNum;
      const settledInvoices: any[] = [];

      for (const debt of unpaidDebts) {
        if (remainingMoneyToAllocate <= 0) break;

        const currentRemaining = debt.remaining ?? debt.amount;
        const deduction = Math.min(remainingMoneyToAllocate, currentRemaining);
        const newDebtRemaining = Math.max(0, currentRemaining - deduction);
        const newStatus = newDebtRemaining === 0 ? 'Lunas' : 'Belum Lunas';

        // 1. Buat record debtPayment
        await tx.debtPayment.create({
          data: {
            tenantId,
            debtId: debt.id,
            amountPaid: deduction,
            paymentMethod,
            userId
          }
        });

        // 2. Update status debt
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            remaining: newDebtRemaining,
            status: newStatus
          }
        });

        settledInvoices.push({
          debtId: debt.id,
          orderNumber: debt.order?.orderNumber || `BON-#${debt.id}`,
          allocatedAmount: deduction,
          priorRemaining: currentRemaining,
          newRemaining: newDebtRemaining,
          isFullySettled: newDebtRemaining === 0
        });

        remainingMoneyToAllocate -= deduction;
      }

      // 3. Catat pemasukan ke Arus Kas (Cash Flow)
      const isCash = paymentMethod.toUpperCase() === 'TUNAI' || paymentMethod.toUpperCase() === 'CASH';
      const cashFlowEntry = await tx.cashFlow.create({
        data: {
          tenantId,
          outletId,
          type: 'Pemasukan',
          category: isCash ? 'Pembayaran Piutang - Tunai' : 'Pembayaran Piutang - Non-Tunai',
          amount: totalPayNum,
          description: `Pelunasan piutang bon via ${paymentMethod} oleh ${customer.name}${notes ? ` (${notes})` : ''}`,
          userId
        }
      });

      // Hitung sisa piutang akhir
      const finalRemainingDebt = Math.max(0, totalActiveDebt - totalPayNum);

      // Jika sisa utang sudah di bawah limit, buka blokir kredit jika sebelumnya terblokir
      if (customer.isCreditBlocked && finalRemainingDebt < (customer.creditLimit || 0)) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { isCreditBlocked: false }
        });
      }

      return {
        receiptNumber: `PAY-AR-${Date.now().toString().slice(-6)}`,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone
        },
        paymentAmount: totalPayNum,
        paymentMethod,
        paidAt: new Date(),
        previousTotalDebt: totalActiveDebt,
        remainingTotalDebt: finalRemainingDebt,
        settledInvoices,
        cashFlowId: cashFlowEntry.id
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error('Retail Pay Debt Error:', err);
    res.status(400).json({ error: err.message || 'Gagal memproses pembayaran piutang bon.' });
  }
});

export default router;

