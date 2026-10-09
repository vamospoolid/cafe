import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io, emitToTenant } from '../index';
import { PrinterService } from '../services/PrinterService';
import { AuditLogger } from '../services/AuditLogger';
import { whatsAppTriggerService } from '../services/WhatsAppTriggerService';
import prisma from '../db';

const router = Router();

import { getLocalDateRange, getCustomDateRange, getLocalOrderDatePrefix } from '../utils/dateHelper';

// Helper: Enrich order with joined tables details for printing and display
export const enrichOrderWithJoinedTables = async (order: any, txPrisma: any = prisma) => {
  if (!order || !order.joinedTableIds) return order;
  try {
    const ids = typeof order.joinedTableIds === 'string' ? JSON.parse(order.joinedTableIds) : order.joinedTableIds;
    if (Array.isArray(ids) && ids.length > 0) {
      const joined = await txPrisma.table.findMany({
        where: { id: { in: ids.map(Number) } },
        select: { id: true, tableNo: true, name: true, capacity: true }
      });
      order.joinedTables = joined;
      order.joinedTableNumbers = joined.map((t: any) => t.tableNo);
    }
  } catch (e) {}
  return order;
};

// Helper: Process loyalty points earning
const processLoyaltyEarnings = async (tx: any, customerId: number, orderTotal: number, orderNumber: string, tenantId?: string) => {
  // Fail-Closed: tanpa tenantId, tolak query agar tidak ada cross-tenant loyalty manipulation
  if (!tenantId) {
    console.warn('[Loyalty] processLoyaltyEarnings dipanggil tanpa tenantId — dilewati untuk keamanan isolasi.');
    return;
  }

  const settings = await tx.settings.findFirst({ where: { tenantId } });
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  if (!loyaltyEnabled) return;

  const earnPerAmount = settings ? settings.loyaltyEarnPerAmount : 10000;
  const silverThreshold = settings ? settings.loyaltySilverThreshold : 1000000;
  const goldThreshold = settings ? settings.loyaltyGoldThreshold : 3000000;
  const silverMultiplier = settings ? settings.loyaltySilverMultiplier : 1.2;
  const goldMultiplier = settings ? settings.loyaltyGoldMultiplier : 1.5;

  // Fail-Closed: customer dicari dengan tenantId — tidak ada fallback global
  const customer = await tx.customer.findFirst({
    where: { id: customerId, tenantId }
  });
  if (!customer) return;

  let multiplier = 1.0;
  if (customer.tier === 'Silver') multiplier = silverMultiplier;
  else if (customer.tier === 'Gold') multiplier = goldMultiplier;

  const pointsEarned = Math.floor((orderTotal / earnPerAmount) * multiplier);

  if (pointsEarned > 0) {
    const newPoints = customer.points + pointsEarned;
    const newTotalSpent = customer.totalSpent + orderTotal;

    // Recalculate tier
    let newTier = 'Bronze';
    if (newTotalSpent >= goldThreshold) {
      newTier = 'Gold';
    } else if (newTotalSpent >= silverThreshold) {
      newTier = 'Silver';
    }

    await tx.customer.update({
      where: { id: customerId },
      data: {
        points: newPoints,
        totalSpent: newTotalSpent,
        tier: newTier
      }
    });

    await tx.pointLog.create({
      data: {
        customerId,
        points: pointsEarned,
        type: 'Earn',
        description: `Belanja Order #${orderNumber} (Tier: ${customer.tier}, Multiplier: ${multiplier}x)`
      }
    });
  }
};

// Helper: Process loyalty points redemption
const processLoyaltyRedemption = async (tx: any, customerId: number, pointsToRedeem: number, orderNumber: string, tenantId?: string) => {
  // Fail-Closed: tanpa tenantId, tolak agar tidak ada cross-tenant redemption
  if (!tenantId) {
    console.warn('[Loyalty] processLoyaltyRedemption dipanggil tanpa tenantId — dilewati untuk keamanan isolasi.');
    return;
  }

  const settings = await tx.settings.findFirst({ where: { tenantId } });
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  if (!loyaltyEnabled) return;

  // Fail-Closed: customer dicari dengan tenantId — tidak ada fallback global
  const customer = await tx.customer.findFirst({
    where: { id: customerId, tenantId }
  });
  if (!customer) return;

  const pointsUsed = Math.min(customer.points, pointsToRedeem);
  if (pointsUsed > 0) {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        points: { decrement: pointsUsed }
      }
    });

    await tx.pointLog.create({
      data: {
        customerId,
        points: -pointsUsed,
        type: 'Redeem',
        description: `Penukaran poin untuk diskon Order #${orderNumber}`
      }
    });
  }
};

// Fungsi untuk generate nomor order (Contoh: ORD-VAM-20231025-001)
// WAJIB mengandung kode tenant agar tidak collision antar kafe (race condition)
export const generateOrderNumber = async (tenantId?: string | null, tzOffset?: number | string) => {
  const dateString = getLocalOrderDatePrefix(typeof tzOffset === 'number' ? tzOffset : -420);

  // Ambil kode tenant 3 huruf sebagai prefix unik per kafe
  let tenantCode = 'ORD';
  if (tenantId) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } });
      const rawCode = tenant?.slug || tenant?.name || tenantId;
      tenantCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ORD';
    } catch (_) {}
  }
  const prefix = `ORD-${tenantCode}-${dateString}`;

  // Query hanya order milik tenant ini hari ini untuk sequence yang benar
  const lastOrder = await prisma.order.findFirst({
    where: tenantId
      ? { orderNumber: { startsWith: prefix }, tenantId }
      : { orderNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' }
  });

  if (lastOrder) {
    const parts = lastOrder.orderNumber.split('-');
    const lastSequence = parseInt(parts[parts.length - 1]) || 0;
    const newSequence = (lastSequence + 1).toString().padStart(3, '0');
    return `${prefix}-${newSequence}`;
  }

  return `${prefix}-001`;
};

// GET all orders (Riwayat Transaksi)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, date, startDate, endDate, active, tzOffset } = req.query;
    const tenantId = (req as any).user?.tenantId || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || null;

    // Fail-closed: platform admin saja yang boleh tanpa tenantId
    if (!tenantId && !(req as any).user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Filter conditions — hanya data milik tenant ini (tidak bocor ke tenantId: null)
    const whereCondition: any = {};
    if (tenantId) {
      whereCondition.tenantId = tenantId;

      // ─── RENTAL VERTICAL HARMONIZATION ──────────────────────────────────────────
      // Jika tenant adalah RENTAL (Penyewaan Baju Bodo & Busana Adat), otomatis
      // sinkronisasikan dan ambil dari RentalOrder agar riwayat transaksi tidak kosong.
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessType: true }
      });

      if (tenant?.businessType === 'RENTAL') {
        const rentalWhere: any = { tenantId };
        if (date) {
          const { startUtc, endUtc } = getLocalDateRange(date as string, tzOffset as string);
          rentalWhere.createdAt = { gte: startUtc, lte: endUtc };
        } else if (startDate && endDate) {
          const { startUtc, endUtc } = getCustomDateRange(startDate as string, endDate as string, tzOffset as string);
          rentalWhere.createdAt = { gte: startUtc, lte: endUtc };
        }
        if (status) {
          if (status === 'Void') rentalWhere.status = 'CANCELLED';
          else if (status === 'Paid') rentalWhere.paymentStatus = 'FULL_PAID';
          else if (status === 'Pending') rentalWhere.paymentStatus = { in: ['UNPAID', 'DP_PAID'] };
          else rentalWhere.status = status;
        }

        const rentalOrders = await prisma.rentalOrder.findMany({
          where: rentalWhere,
          include: {
            items: true,
            customer: true
          },
          orderBy: { createdAt: 'desc' }
        });

        const normalizedOrders = rentalOrders.map(ro => ({
          id: ro.id,
          orderNumber: ro.orderNumber,
          customerName: ro.customerName,
          customerPhone: ro.customerPhone,
          total: ro.totalAmount,
          subtotal: ro.rentalSubtotal,
          discount: ro.discount,
          paidAmount: ro.paidAmount,
          depositAmount: ro.depositAmount,
          status: ro.status === 'CANCELLED' ? 'Void' : (ro.paymentStatus === 'FULL_PAID' ? 'Paid' : 'Pending'),
          rentalStatus: ro.status,
          paymentStatus: ro.paymentStatus,
          paymentMethod: ro.paymentMethod || 'CASH',
          createdAt: ro.createdAt,
          eventDate: ro.eventDate,
          pickupDate: ro.pickupDate,
          returnDeadline: ro.returnDeadline,
          user: { name: 'Kasir Rental', username: 'rental' },
          items: ro.items.map(it => ({
            id: it.id,
            productId: it.attireCode,
            quantity: 1,
            price: it.price || 0,
            subtotal: it.price || 0,
            product: {
              name: `${it.attireName}${it.size ? ` (${it.size})` : ''}${it.rackHangerCode ? ` [${it.rackHangerCode}]` : ''}`,
              imageUrl: null
            }
          }))
        }));

        return res.json(normalizedOrders);
      }
    }
    
    if (active === 'true') {
      whereCondition.OR = [
        { status: 'Pending' },
        {
          status: 'Paid',
          kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }
        }
      ];
    } else if (status) {
      whereCondition.status = status;
    }
    
    if (date) {
      // Filter by specific local date (YYYY-MM-DD)
      const { startUtc, endUtc } = getLocalDateRange(date as string, tzOffset as string);
      whereCondition.createdAt = {
        gte: startUtc,
        lte: endUtc
      };
    } else if (startDate && endDate) {
      // Filter by custom local date range
      const { startUtc, endUtc } = getCustomDateRange(startDate as string, endDate as string, tzOffset as string);
      whereCondition.createdAt = {
        gte: startUtc,
        lte: endUtc
      };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        table: true,
        user: { select: { name: true, username: true } },
        items: {
          include: {
            product: { select: { name: true, imageUrl: true } }
          }
        }
      },
      orderBy: { id: 'desc' }
    });
    
    res.json(orders);
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat transaksi' });
  }
});

// GET single order by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId || (req.headers['x-tenant-id'] as string) || null;

    // IDOR Guard: selalu sertakan tenantId agar tidak bisa intip order kafe lain
    if (!tenantId && !(req as any).user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Jika id bukan angka murni (misal UUID RentalOrder)
    if (isNaN(Number(id))) {
      const rentalWhere: any = { id: String(id) };
      if (tenantId) rentalWhere.tenantId = tenantId;
      const rentalOrder = await prisma.rentalOrder.findFirst({
        where: rentalWhere,
        include: { items: true, customer: true, outlet: true }
      });
      if (rentalOrder) {
        return res.json({
          id: rentalOrder.id,
          orderNumber: rentalOrder.orderNumber,
          customerName: rentalOrder.customerName,
          customerPhone: rentalOrder.customerPhone,
          total: rentalOrder.totalAmount,
          subtotal: rentalOrder.rentalSubtotal,
          discount: rentalOrder.discount,
          paidAmount: rentalOrder.paidAmount,
          depositAmount: rentalOrder.depositAmount,
          status: rentalOrder.status === 'CANCELLED' ? 'Void' : (rentalOrder.paymentStatus === 'FULL_PAID' ? 'Paid' : 'Pending'),
          rentalStatus: rentalOrder.status,
          paymentStatus: rentalOrder.paymentStatus,
          paymentMethod: rentalOrder.paymentMethod || 'CASH',
          createdAt: rentalOrder.createdAt,
          eventDate: rentalOrder.eventDate,
          pickupDate: rentalOrder.pickupDate,
          returnDeadline: rentalOrder.returnDeadline,
          customer: rentalOrder.customer,
          user: { name: 'Kasir Rental', username: 'rental' },
          items: rentalOrder.items.map(it => ({
            id: it.id,
            productId: it.attireCode,
            quantity: 1,
            price: it.price || 0,
            subtotal: it.price || 0,
            product: {
              name: `${it.attireName}${it.size ? ` (${it.size})` : ''}${it.rackHangerCode ? ` [${it.rackHangerCode}]` : ''}`,
              imageUrl: null
            }
          }))
        });
      }
      return res.status(404).json({ error: 'Kontrak sewa busana tidak ditemukan' });
    }

    const orderWhere: any = { id: Number(id) };
    if (tenantId) orderWhere.tenantId = tenantId;

    const order = await prisma.order.findFirst({
      where: orderWhere,
      include: {
        table: true,
        user: { select: { name: true, username: true } },
        customer: true,
        voucher: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    res.json(order);
  } catch (error) {
    console.error('Fetch Single Order Error:', error);
    res.status(500).json({ error: 'Gagal mengambil detail order' });
  }
});

// POST Create Order (Dine-In Customer Self-Ordering)
router.post('/dinein', async (req: Request, res: Response) => {
  try {
    const { 
      customerName, 
      customerPhone, 
      tableId, 
      items, 
      subtotal, 
      tax, 
      serviceCharge, 
      total,
      customerId
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja kosong' });
    }

    // Ambil default admin user id untuk memenuhi relasi userId yang wajib
    const defaultUser = await prisma.user.findFirst({ where: { role: 'Admin' } }) || await prisma.user.findFirst();
    if (!defaultUser) {
      return res.status(500).json({ error: 'Sistem belum memiliki pengguna untuk memproses pesanan' });
    }
    const userId = defaultUser.id;

    let resolvedTableId: number | null = null;
    if (tableId) {
      const numId = Number(tableId);
      let tableExists = null;
      if (!isNaN(numId)) {
        tableExists = await prisma.table.findUnique({
          where: { id: numId }
        });
      }
      if (!tableExists) {
        const tableStr = String(tableId);
        tableExists = await prisma.table.findFirst({
          where: { tableNo: tableStr }
        });
        if (!tableExists) {
          const allTables = await prisma.table.findMany();
          tableExists = allTables.find(t => t.tableNo.toLowerCase() === tableStr.toLowerCase()) || null;
        }
      }
      if (tableExists) {
        resolvedTableId = tableExists.id;
      }
    }

    let tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || null;
    let outletId: string | null = null;
    if (resolvedTableId) {
      const tableInfo = await prisma.table.findUnique({
        where: { id: resolvedTableId },
        select: { tenantId: true, outletId: true }
      });
      if (tableInfo) {
        tenantId = tenantId || tableInfo.tenantId;
        outletId = tableInfo.outletId;
      }
    }
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak valid untuk Self-Order. Silakan scan ulang QR meja.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const orderNumber = await generateOrderNumber(tenantId);

    const result = await prisma.$transaction(async (tx) => {
      // Ambil buyPrice untuk produk agar HPP tercatat & validasi kepemilikan tenant
      const productIds = items.map((item: any) => Number(item.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId }
      });
      if (products.length !== new Set(productIds).size) {
        throw new Error('Satu atau lebih menu yang dipilih tidak ditemukan pada tenant ini.');
      }
      const buyPriceMap = new Map(products.map(p => [p.id, p.buyPrice || 0]));

      // Kurangi Stok Produk & Bahan Baku (Advanced Mode)
      const settings = await tx.settings.findFirst({ where: { tenantId } });
      const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;
      const hasTable = Boolean(resolvedTableId);
      const isKDSEnabled = settings?.enableKDS !== false;
      const shouldAutoServe = !isKDSEnabled || (!hasTable && (settings as any)?.autoCompleteKDSOnPay === true);

      // Buat Order Induk
      const order = await tx.order.create({
        data: {
          tenantId: tenantId || null,
          outletId: outletId || null,
          orderNumber,
          customerName: customerName || `Pelanggan`,
          customerPhone,
          customerId: customerId ? Number(customerId) : null,
          tableId: resolvedTableId,
          userId,
          subtotal: Number(subtotal),
          discount: 0,
          tax: Number(tax),
          serviceCharge: Number(serviceCharge),
          total: Number(total),
          paymentMethod: null,
          status: 'Pending',
          kdsStatus: shouldAutoServe ? 'Served' : 'Pending',
          servedAt: shouldAutoServe ? new Date() : null,
          
          items: {
            create: items.map((item: any) => ({
              tenantId: tenantId || null,
              outletId: outletId || null,
              productId: Number(item.productId),
              qty: Number(item.qty),
              price: Number(item.price),
              buyPrice: buyPriceMap.get(Number(item.productId)) || 0,
              subtotal: Number(item.price * item.qty),
              notes: item.notes
            }))
          }
        },
        include: { items: true, table: true }
      });

      for (const item of items) {
        // Kurangi stok bahan baku berdasarkan resep produk jika tersedia
        const recipes = await tx.recipeItem.findMany({
          where: { productId: Number(item.productId) }
        });
        const hasRecipe = recipes.length > 0;

        // Hanya kurangi product.stock jika TIDAK ada resep bahan baku
        // Jika ada resep, stok dikendalikan melalui ingredient stock (Advanced Mode)
        if (!hasRecipe) {
          await tx.product.update({
            where: { id: Number(item.productId) },
            data: { stock: { decrement: Number(item.qty) } }
          });
        }

        for (const recipe of recipes) {
          const used = recipe.qtyPerServing * Number(item.qty);
          await tx.ingredient.update({
            where: { id: recipe.ingredientId },
            data: { stock: { decrement: used } }
          });
          await tx.ingredientLog.create({
            data: {
              tenantId,
              outletId: outletId || null,
              ingredientId: recipe.ingredientId,
              change: -used,
              type: 'Produksi',
              description: `Order ${orderNumber} (Dine-in Self-Order)`,
              referenceId: orderNumber
            }
          });
        }
      }

      return order;
    });

    // Emit real-time event — HANYA ke tenant terkait (tidak global)
    if (result.tenantId) {
      let resolvedTableNo = (result as any).table?.tableNo || null;
      if (!resolvedTableNo && resolvedTableId) {
        try {
          const tb = await prisma.table.findUnique({ where: { id: resolvedTableId }, select: { tableNo: true } });
          if (tb) resolvedTableNo = tb.tableNo;
        } catch (_) {}
      }

      emitToTenant(result.tenantId, 'order:new', {
        orderId: result.id,
        orderNumber: result.orderNumber,
        tableId: result.tableId || resolvedTableId,
        tableNo: resolvedTableNo,
        customerName: result.customerName,
        total: result.total,
        subtotal: result.subtotal,
        itemsCount: (result as any).items?.length || items?.length || 0,
        items: (result as any).items || items,
        type: 'DINE_IN',
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({ message: 'Pesanan Dine-In berhasil dibuat', order: result });
  } catch (error) {
    console.error('Dine-In Order Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses pesanan mandiri' });
  }
});

// POST Sync Offline Orders
router.post('/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Data orders tidak valid' });
    }

    const user = (req as any).user;
    const userId = user.id;
    const tenantId = user.tenantId || (req.headers['x-tenant-id'] as string) || null;
    let outletId = user.outletId || null;
    if (!outletId && tenantId) {
      const firstOutlet = await prisma.outlet.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true }
      });
      outletId = firstOutlet?.id || null;
    }
    const syncedOrders = [];

    for (const orderData of orders) {
      const { 
        offlineId,
        customerName, 
        customerPhone, 
        tableId, 
        items, 
        subtotal, 
        tax, 
        serviceCharge, 
        total,
        discount,
        customerId,
        pointsUsed,
        paymentMethod,
        isPaid,
        createdAt,
        paidAt
      } = orderData;

      if (!offlineId) continue;

      // 1. Cek apakah sudah disinkronisasikan sebelumnya
      const existing = await prisma.order.findFirst({
        where: tenantId
          ? { offlineId, tenantId }
          : { offlineId },
        include: { items: true }
      });

      if (existing) {
        syncedOrders.push(existing);
        continue;
      }

      if (!items || items.length === 0) continue;

      const orderNumber = await generateOrderNumber(tenantId);

      const result = await prisma.$transaction(async (tx) => {
        // Ambil buyPrice untuk semua produk
        const productIds = items.map((item: any) => Number(item.productId));
        const products = await tx.product.findMany({
          where: { id: { in: productIds } }
        });
        const buyPriceMap = new Map(products.map(p => [p.id, p.buyPrice || 0]));

        let finalCustomerId = customerId ? Number(customerId) : null;
        if (!finalCustomerId && customerPhone) {
          let cust = await tx.customer.findFirst({ where: { phone: customerPhone, tenantId } });
          // Auto-save sebagai member HANYA jika ada nama + phone yang valid
          // (bukan nama generik walk-in)
          const genericNames = ['pelanggan umum', 'pelanggan walk-in', 'pelanggan', 'tamu', 'guest'];
          const isRealName = customerName && !genericNames.includes(customerName.trim().toLowerCase());
          if (!cust && isRealName) {
            try {
              cust = await tx.customer.create({
                data: {
                  tenantId,
                  name: customerName.trim(),
                  phone: customerPhone.trim(),
                  points: 0,
                  tier: 'Bronze',
                  totalSpent: 0
                }
              });
            } catch (createErr: any) {
              // P2002: unique constraint — customer sudah ada (race condition), coba fetch ulang
              if (createErr.code === 'P2002') {
                cust = await tx.customer.findFirst({ where: { phone: customerPhone, tenantId } });
              } else {
                console.error('[Orders] Customer auto-create error (non-fatal):', createErr.message);
              }
            }
          }
          if (cust) {
            finalCustomerId = cust.id;
          }
        }

        const dateCreated = createdAt ? new Date(createdAt) : new Date();
        const datePaid = paidAt ? new Date(paidAt) : (isPaid ? new Date() : null);

        // Kurangi Stok Produk & Bahan Baku (Advanced Mode)
        const settings = tenantId ? await tx.settings.findFirst({ where: { tenantId } }) : null;
        const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;
        const hasTable = Boolean(tableId);
        const shouldAutoServe = !hasTable && (!settings || (settings as any).autoCompleteKDSOnPay || (settings as any).enableKDS === false);

        // Buat Order Induk
        const createdOrder = await tx.order.create({
          data: {
            tenantId: tenantId || null,
            outletId: outletId || null,
            orderNumber,
            offlineId,
            customerName: customerName || 'Pelanggan',
            customerPhone,
            customerId: finalCustomerId,
            tableId: tableId ? Number(tableId) : null,
            userId,
            subtotal: Number(subtotal),
            discount: Number(discount) || 0,
            tax: Number(tax),
            serviceCharge: Number(serviceCharge),
            total: Number(total),
            paymentMethod: isPaid ? paymentMethod : null,
            status: isPaid ? 'Paid' : 'Pending',
            kdsStatus: (isPaid && shouldAutoServe) ? 'Served' : 'Pending',
            servedAt: (isPaid && shouldAutoServe) ? datePaid : null,
            createdAt: dateCreated,
            paidAt: datePaid,
            
            items: {
              create: items.map((item: any) => ({
                tenantId: tenantId || null,
                outletId: outletId || null,
                productId: Number(item.productId),
                qty: Number(item.qty),
                price: Number(item.price),
                buyPrice: buyPriceMap.get(Number(item.productId)) || 0,
                subtotal: Number(item.price * item.qty),
                notes: item.notes
              }))
            }
          },
          include: { items: true, table: true }
        });

        for (const item of items) {
          // Kurangi stok bahan baku berdasarkan resep produk jika tersedia
          const recipes = await tx.recipeItem.findMany({
            where: { productId: Number(item.productId) }
          });
          const hasRecipe = recipes.length > 0;

          // Hanya kurangi product.stock jika TIDAK ada resep bahan baku (Advanced Mode)
          if (!hasRecipe) {
            await tx.product.update({
              where: { id: Number(item.productId) },
              data: { stock: { decrement: Number(item.qty) } }
            });
          }

          for (const recipe of recipes) {
            const used = recipe.qtyPerServing * Number(item.qty);
            await tx.ingredient.update({
              where: { id: recipe.ingredientId },
              data: { stock: { decrement: used } }
            });
            await tx.ingredientLog.create({
              data: {
                tenantId: tenantId || null,
                outletId: outletId || null,
                ingredientId: recipe.ingredientId,
                change: -used,
                type: 'Produksi',
                description: `Order ${orderNumber} (Sync Offline)`,
                referenceId: orderNumber
              }
            });
          }
        }

        // Poin Loyalitas
        if (finalCustomerId && isPaid) {
          if (pointsUsed && pointsUsed > 0) {
            await processLoyaltyRedemption(tx, finalCustomerId, Number(pointsUsed), orderNumber, tenantId);
          }
          await processLoyaltyEarnings(tx, finalCustomerId, Number(total), orderNumber, tenantId);
        }

        // Piutang
        if (isPaid && paymentMethod === 'Piutang') {
          if (!finalCustomerId) {
            throw new Error('Pelanggan (Member) wajib dipilih untuk transaksi Piutang');
          }
          await tx.debt.create({
            data: {
              tenantId: tenantId || null,
              customerId: finalCustomerId,
              orderId: createdOrder.id,
              amount: Number(total),
              remaining: Number(total),
              status: 'Belum Lunas',
              dueDate: orderData.dueDate ? new Date(orderData.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              notes: orderData.debtNotes || null
            }
          });
        }

        // Rekalkulasi data shift jika order ini disinkronkan ke dalam shift yang sudah berstatus Closed
        if (isPaid && datePaid) {
          const closedShiftWhere: any = {
            userId: userId,
            status: 'Closed',
            waktuBuka: { lte: datePaid },
            waktuTutup: { gte: datePaid }
          };
          if (tenantId) closedShiftWhere.tenantId = tenantId;
          const closedShift = await tx.shift.findFirst({
            where: closedShiftWhere
          });

          if (closedShift) {
            // Ambil semua order paid yang masuk ke rentang shift tertutup tersebut
            const shiftOrderWhere: any = {
              status: 'Paid',
              OR: [
                { paidAt: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! } },
                { paidAt: null, createdAt: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! } }
              ]
            };
            if (closedShift.tenantId || tenantId) shiftOrderWhere.tenantId = closedShift.tenantId || tenantId;
            const shiftOrders = await tx.order.findMany({
              where: shiftOrderWhere
            });

            const getCashPortion = (pm: string | null, tot: number) => {
              if (!pm) return 0;
              const trimmed = pm.trim();
              if (trimmed.toLowerCase() === 'cash' || trimmed.toLowerCase() === 'tunai') return tot;
              if (trimmed.startsWith('Split')) {
                const match = trimmed.match(/Tunai\s+(?:Rp)+\s*([\d\.]+)/i);
                if (match && match[1]) {
                  return Number(match[1].replace(/\./g, '')) || 0;
                }
              }
              return 0;
            };

            const getNonCashPortion = (pm: string | null, tot: number) => {
              if (!pm) return 0;
              const trimmed = pm.trim();
              const lower = trimmed.toLowerCase();
              if (lower === 'cash' || lower === 'tunai') return 0;
              if (lower === 'piutang') return 0;
              if (lower === 'qris' || lower === 'debit' || lower === 'transfer' || lower === 'credit' || lower === 'non-tunai') return tot;
              if (trimmed.startsWith('Split')) {
                const match = trimmed.match(/Tunai\s+(?:Rp)+\s*([\d\.]+)/i);
                const cashAmt = match ? Number(match[1].replace(/\./g, '')) || 0 : 0;
                return Math.max(0, tot - cashAmt);
              }
              return tot;
            };

            const cashSalesIncome = shiftOrders.reduce((sum: number, o: any) => sum + getCashPortion(o.paymentMethod, o.total), 0);
            const nonCashSalesIncome = shiftOrders.reduce((sum: number, o: any) => sum + getNonCashPortion(o.paymentMethod, o.total), 0);

            const cashFlows = await tx.cashFlow.findMany({
              where: {
                date: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! }
              }
            });

            const debtPayments = await tx.debtPayment.findMany({
              where: {
                createdAt: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! }
              }
            });

            const cashDebtIncome = debtPayments
              .filter((dp: any) => dp.paymentMethod.toLowerCase() === 'tunai' || dp.paymentMethod.toLowerCase() === 'cash')
              .reduce((sum: number, dp: any) => sum + dp.amountPaid, 0);

            const nonCashDebtIncome = debtPayments
              .filter((dp: any) => dp.paymentMethod.toLowerCase() !== 'tunai' && dp.paymentMethod.toLowerCase() !== 'cash')
              .reduce((sum: number, dp: any) => sum + dp.amountPaid, 0);

            const manualCashIn = cashFlows
              .filter((cf: any) => cf.type === 'Pemasukan' && cf.category !== 'Pembayaran Piutang')
              .reduce((sum: number, cf: any) => sum + cf.amount, 0);
            const manualCashOut = cashFlows.filter((cf: any) => cf.type === 'Pengeluaran').reduce((sum: number, cf: any) => sum + cf.amount, 0);

            const newSaldoSistem = closedShift.saldoAwal + cashSalesIncome + cashDebtIncome + manualCashIn - manualCashOut;
            const newSaldoElektronik = nonCashSalesIncome + nonCashDebtIncome;
            const newSelisih = (closedShift.saldoFisikLaci || 0) - newSaldoSistem;

            await tx.shift.update({
              where: { id: closedShift.id },
              data: {
                saldoSistem: newSaldoSistem,
                saldoElektronik: newSaldoElektronik,
                selisih: newSelisih
              }
            });
          }
        }

        return createdOrder;
      });

      // Emit event socket untuk KDS/real-time updates — hanya ke tenant terkait
      if (result.tenantId) {
        emitToTenant(result.tenantId, 'order:new', { 
          orderId: result.id,
          orderNumber: result.orderNumber,
          tableId: result.tableId,
          tableNo: (result as any).table?.tableNo || null,
          customerName: result.customerName,
          total: result.total,
          type: 'POS',
          timestamp: new Date().toISOString()
        });
      }
      
      // Auto-Print KDS & Receipt
      try {
        const settings = result.tenantId ? await prisma.settings.findFirst({ where: { tenantId: result.tenantId } }) : null;
        if (settings) {
          const fullOrder = await prisma.order.findFirst({
            where: result.tenantId ? { id: result.id, tenantId: result.tenantId } : { id: result.id },
            include: { items: { include: { product: { include: { category: true } } } } }
          });
          if (fullOrder) {
            if (settings.autoPrintKDS && settings.printerIp) {
              PrinterService.printKitchenTicket(fullOrder, settings).catch(console.error);
            }
            if (isPaid && settings.autoPrintReceipt && settings.printerIp) {
              PrinterService.printReceipt(fullOrder, settings).catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error('Auto-print error during sync:', err);
      }

      syncedOrders.push(result);
    }

    res.json({ message: 'Sinkronisasi berhasil', orders: syncedOrders });
  } catch (error) {
    console.error('Sync Orders Error:', error);
    res.status(500).json({ error: 'Gagal menyinkronisasikan transaksi offline' });
  }
});

// POST Create Order (POS Checkout)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { 
      customerName, 
      customerPhone, 
      tableId, 
      joinedTableIds,
      items, 
      subtotal, 
      tax, 
      serviceCharge, 
      total,
      discount,
      customerId,
      voucherId,
      pointsUsed,
      paymentMethod,
      isPaid
    } = req.body;
    
    // Ambil userId & tenantId dari token middleware
    const user = (req as any).user;
    const userId = user.id;
    const tenantId = (req as any).tenantId || user?.tenantId || (req.headers['x-tenant-id'] as string) || null;
    if (!tenantId && !user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    let outletId = user?.outletId || null;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja kosong' });
    }

    // Proteksi Shift Kasir Wajib Aktif untuk transaksi langsung POS yang berstatus Lunas
    if (isPaid) {
      const activeShift = await prisma.shift.findFirst({
        where: tenantId
          ? { status: { in: ['Open', 'OPEN'] }, tenantId }
          : { status: { in: ['Open', 'OPEN'] } }
      });
      if (!activeShift) {
        return res.status(400).json({ 
          error: 'Shift kasir belum dibuka. Harap buka shift baru dan masukkan modal awal kasir sebelum melayani transaksi.',
          shiftRequired: true 
        });
      }
    }

    const orderNumber = await generateOrderNumber(tenantId);

    let formattedJoinedTableIds: string | null = null;
    if (joinedTableIds) {
      if (Array.isArray(joinedTableIds) && joinedTableIds.length > 0) {
        formattedJoinedTableIds = JSON.stringify(joinedTableIds.map(Number));
      } else if (typeof joinedTableIds === 'string' && joinedTableIds.trim().length > 0) {
        formattedJoinedTableIds = joinedTableIds;
      }
    }

    // Jalankan Transaction agar konsisten (Atomic)
    const result = await prisma.$transaction(async (tx) => {
      // Resolve default outlet jika belum ada
      if (!outletId && tenantId) {
        const firstOutlet = await tx.outlet.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          select: { id: true }
        });
        outletId = firstOutlet?.id || null;
      }

      // 0. Ambil buyPrice untuk semua product & validasi kepemilikan tenant
      const productIds = items.map((item: any) => Number(item.productId));
      const products = await tx.product.findMany({
        where: tenantId
          ? { id: { in: productIds }, tenantId }
          : { id: { in: productIds } }
      });
      if (tenantId && products.length !== new Set(productIds).size) {
        throw new Error('Satu atau lebih produk tidak ditemukan atau bukan milik tenant ini.');
      }
      const buyPriceMap = new Map(products.map(p => [p.id, p.buyPrice || 0]));

      // 0.5. Cari/Registrasi Customer jika ada phone
      let finalCustomerId = customerId ? Number(customerId) : null;
      if (finalCustomerId) {
        const custCheck = await tx.customer.findFirst({
          where: { id: finalCustomerId, tenantId }
        });
        if (!custCheck) {
          throw new Error('Pelanggan tidak ditemukan atau bukan milik tenant ini.');
        }
      } else if (customerPhone) {
        let cust = await tx.customer.findFirst({ where: { phone: customerPhone, tenantId } });
        // Auto-save sebagai member HANYA jika nama + phone valid (bukan label generik)
        const genericNames = ['pelanggan umum', 'pelanggan walk-in', 'pelanggan', 'tamu', 'guest'];
        const isRealName = customerName && !genericNames.includes(customerName.trim().toLowerCase());
        if (!cust && isRealName) {
          try {
            cust = await tx.customer.create({
              data: {
                tenantId,
                name: customerName.trim(),
                phone: customerPhone.trim(),
                points: 0,
                tier: 'Bronze',
                totalSpent: 0
              }
            });
          } catch (createErr: any) {
            // P2002: race condition — customer sudah ada, fetch ulang
            if (createErr.code === 'P2002') {
              cust = await tx.customer.findFirst({ where: { phone: customerPhone, tenantId } });
            } else {
              console.error('[Orders] Customer auto-create error (non-fatal):', createErr.message);
            }
          }
        }
        if (cust) {
          finalCustomerId = cust.id;
        }
      }

      // Cek settings toko
      const settings = tenantId ? await tx.settings.findFirst({ where: { tenantId } }) : null;
      const hasTable = Boolean(tableId);
      const isKDSEnabled = settings?.enableKDS !== false;
      const shouldAutoServe = !isKDSEnabled || (!hasTable && (settings as any)?.autoCompleteKDSOnPay === true);
      const isActuallyPaid = Boolean(isPaid);
      const nowPaid = isActuallyPaid ? new Date() : null;

      // 1. Buat Order Induk
      const numSubtotal = Math.max(0, Number(subtotal) || 0);
      const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, numSubtotal));
      const numTax = Math.max(0, Number(tax) || 0);
      const numService = Math.max(0, Number(serviceCharge) || 0);
      const safeTotal = Math.max(0, Number(total) || (numSubtotal - safeDiscount + numTax + numService));

      let order: any = null;
      let currentOrderNumber = orderNumber;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          order = await tx.order.create({
            data: {
              tenantId,
              outletId,
              orderNumber: currentOrderNumber,
              customerName: customerName || 'Pelanggan',
              customerPhone,
              customerId: finalCustomerId,
              tableId: tableId ? Number(tableId) : null,
              joinedTableIds: formattedJoinedTableIds,
              voucherId: voucherId ? Number(voucherId) : null,
              pointsUsed: Number(pointsUsed) || 0,
              userId,
              subtotal: numSubtotal,
              discount: safeDiscount,
              tax: numTax,
              serviceCharge: numService,
              total: safeTotal,
              paymentMethod: isActuallyPaid ? paymentMethod : null,
              status: isActuallyPaid ? 'Paid' : 'Pending',
              kdsStatus: (isActuallyPaid && shouldAutoServe) ? 'Served' : 'Pending',
              servedAt: (isActuallyPaid && shouldAutoServe) ? nowPaid : null,
              paidAt: nowPaid,
              
              items: {
                create: items.map((item: any) => ({
                  tenantId,
                  outletId,
                  productId: Number(item.productId),
                  qty: Number(item.qty),
                  price: Number(item.price),
                  buyPrice: buyPriceMap.get(Number(item.productId)) || 0,
                  subtotal: Number(item.price * item.qty),
                  notes: item.notes,
                  uomName: item.uomName || null,
                  uomRatio: item.uomRatio ? Number(item.uomRatio) : null,
                  priceTierName: item.priceTierName || null
                }))
              }
            },
            include: { items: true, table: true, voucher: true }
          });
          break;
        } catch (err: any) {
          if (err.code === 'P2002' && attempt < 2) {
            const randSuffix = Math.floor(1000 + Math.random() * 9000);
            currentOrderNumber = `ORD-${Date.now().toString().slice(-6)}-${randSuffix}`;
            continue;
          }
          throw err;
        }
      }

      // 2. Kurangi Stok — Advanced Mode: jika produk punya resep, gunakan ingredient stock
      // Simple Mode: jika tidak ada resep, kurangi product.stock langsung
      const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;

      for (const item of items) {
        // Ambil resep terlebih dahulu untuk menentukan mode
        const recipes = await tx.recipeItem.findMany({
          where: { productId: Number(item.productId) }
        });
        const hasRecipe = recipes.length > 0;

        if (!hasRecipe) {
          // Simple Mode: tidak ada resep → kurangi product.stock langsung
          const product = await tx.product.findFirst({
            where: tenantId
              ? { id: Number(item.productId), tenantId }
              : { id: Number(item.productId) }
          });
          if (product && product.stock < Number(item.qty)) {
            throw new Error(`Stok produk "${product.name}" tidak mencukupi (tersisa: ${product.stock}, dibutuhkan: ${item.qty})`);
          }
          await tx.product.update({
            where: { id: Number(item.productId) },
            data: { stock: { decrement: Number(item.qty) } }
          });
        } else {
          // Advanced Mode: ada resep → kurangi bahan baku, JANGAN kurangi product.stock
          for (const recipe of recipes) {
            const used = recipe.qtyPerServing * Number(item.qty);
            // Atomic check: pastikan stok bahan baku mencukupi (cegah stok negatif)
            const currentIng = await tx.ingredient.findFirst({
              where: tenantId
                ? { id: recipe.ingredientId, tenantId }
                : { id: recipe.ingredientId },
              select: { stock: true, name: true }
            });
            if (currentIng && currentIng.stock < used) {
              throw new Error(`Stok bahan baku "${currentIng.name}" tidak mencukupi (sisa: ${currentIng.stock}, dibutuhkan: ${used})`);
            }
            await tx.ingredient.update({
              where: { id: recipe.ingredientId },
              data: { stock: { decrement: used } }
            });
            await tx.ingredientLog.create({
              data: {
                tenantId: tenantId || null,
                outletId: outletId || null,
                ingredientId: recipe.ingredientId,
                change: -used,
                type: 'Produksi',
                description: `Order ${orderNumber}`,
                referenceId: orderNumber
              }
            });
          }
        }
      }

      // 3. Loyalty Points
      if (finalCustomerId) {
        const ptsUsed = Number(pointsUsed) || 0;
        if (ptsUsed > 0) {
          await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, orderNumber, tenantId);
        }

        if (isPaid) {
          await processLoyaltyEarnings(tx, finalCustomerId, Number(total), orderNumber, tenantId);
        }
      }

      // 4. Voucher Usage Tracking (Catat penggunaan voucher promo jika ada)
      if (voucherId) {
        const v = await tx.voucher.findFirst({
          where: tenantId
            ? { id: Number(voucherId), tenantId }
            : { id: Number(voucherId) }
        });
        if (v && v.status === 'Aktif') {
          await tx.voucher.update({
            where: { id: v.id },
            data: { usedCount: { increment: 1 } }
          });
        }
      }

      // Piutang
      if (isPaid && paymentMethod === 'Piutang') {
        if (!finalCustomerId) {
          throw new Error('Pelanggan (Member) wajib dipilih untuk transaksi Piutang');
        }
        await tx.debt.create({
          data: {
            tenantId: tenantId || null,
            outletId: outletId || null,
            customerId: finalCustomerId,
            orderId: order.id,
            amount: Number(total),
            remaining: Number(total),
            status: 'Belum Lunas',
            dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            notes: req.body.debtNotes || null
          }
        });
      }

      return order;
    });

    // Emit real-time event — HANYA ke tenant terkait (tidak global)
    if (result.tenantId) {
      emitToTenant(result.tenantId, 'order:new', {
        orderId: result.id,
        orderNumber: result.orderNumber,
        tableId: result.tableId,
        joinedTableIds: result.joinedTableIds,
        tableNo: (result as any).table?.tableNo || null,
        type: 'POS'
      });
    }

    // Auto-print tiket dapur & bar (fire-and-forget)
    const settingsPrint = result.tenantId ? await prisma.settings.findFirst({ where: { tenantId: result.tenantId } }) : null;
    if (settingsPrint && (settingsPrint.autoPrintKitchen || settingsPrint.autoPrintKDS || settingsPrint.autoPrintBar)) {
      const fullOrder = await prisma.order.findFirst({
        where: result.tenantId ? { id: result.id, tenantId: result.tenantId } : { id: result.id },
        include: { items: { include: { product: { include: { category: true } } } }, table: true, user: { select: { name: true, username: true } } }
      });
      if (fullOrder) {
        await enrichOrderWithJoinedTables(fullOrder, prisma);
        if (settingsPrint.autoPrintKitchen || settingsPrint.autoPrintKDS) {
          PrinterService.printKitchenTicket(fullOrder, settingsPrint).catch(e => console.error('[Printer KDS Kitchen]', e.message));
        }
        if (settingsPrint.autoPrintBar) {
          PrinterService.printBarTicket(fullOrder, settingsPrint).catch(e => console.error('[Printer Bar]', e.message));
        }
      }
    }

    // Trigger kirim WhatsApp e-Receipt otomatis jika pesanan berstatus lunas
    if (isPaid && result.tenantId) {
      whatsAppTriggerService.triggerOrderReceipt(result.id, result.tenantId).catch(err => {
        console.warn('[WhatsApp Trigger] Gagal trigger e-Receipt:', err.message);
      });
    }

    res.status(201).json({ message: 'Order berhasil dibuat', order: result });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses pesanan' });
  }
});

// PATCH Payment (Membayar order yang pending, mendukung satu atau beberapa ID dipisah koma)
router.patch('/:id/payment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentMethod, discount, total } = req.body;

    const idStr = typeof id === 'string' ? id : '';
    const ids = idStr.split(',').map((item: string) => Number(item.trim())).filter((num: number) => !isNaN(num));

    if (ids.length === 0) {
      return res.status(400).json({ error: 'ID order tidak valid' });
    }

    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenantId || (req.headers['x-tenant-id'] as string) || null;
    let outletId = user?.outletId || null;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Proteksi Shift Kasir Wajib Aktif untuk pelunasan pembayaran tagihan
    const activeShift = await prisma.shift.findFirst({
      where: {
        status: { in: ['Open', 'OPEN'] },
        tenantId
      }
    });
    if (!activeShift) {
      return res.status(400).json({ 
        error: 'Shift kasir belum dibuka. Harap buka shift kasir terlebih dahulu sebelum memproses pelunasan pembayaran.',
        shiftRequired: true 
      });
    }

    const passedTotal = total !== undefined ? Number(total) : undefined;
    const passedDiscount = discount !== undefined ? Number(discount) : 0;

    // Jalankan dalam $transaction agar konsisten (atomic)
    const result = await prisma.$transaction(async (tx) => {
      // Resolve default outlet jika belum ada
      if (!outletId && tenantId) {
        const firstOutlet = await tx.outlet.findFirst({
          where: { tenantId, status: 'ACTIVE' },
          select: { id: true }
        });
        outletId = firstOutlet?.id || null;
      }

      // Ambil data semua order untuk kalkulasi total awal
      const orders = await tx.order.findMany({
        where: {
          id: { in: ids },
          tenantId
        }
      });

      if (orders.length === 0) {
        throw new Error('Order tidak ditemukan');
      }

      const updatedOrders = [];
      const paidNow = new Date(); // Fix #1: timestamp tunggal untuk semua order yang dibayar bersamaan
      const effectiveTenantId = orders[0]?.tenantId || tenantId;
      const settings = effectiveTenantId ? await tx.settings.findFirst({ where: { tenantId: effectiveTenantId } }) : null;
      const hasAnyTable = orders.some(o => Boolean(o.tableId));
      const shouldAutoServe = !hasAnyTable && (!settings || (settings as any).autoCompleteKDSOnPay || (settings as any).enableKDS === false);
      
      // Resolusikan Customer jika customerPhone disediakan
      let finalCustomerId = req.body.customerId ? Number(req.body.customerId) : (orders[0]?.customerId || null);

      if (!finalCustomerId && req.body.customerPhone) {
        const cleanPhone = String(req.body.customerPhone).trim();
        let cust = await tx.customer.findFirst({
          where: tenantId ? { phone: cleanPhone, tenantId } : { phone: cleanPhone }
        });
        if (!cust && req.body.customerName) {
          cust = await tx.customer.create({
            data: {
              tenantId,
              name: String(req.body.customerName).trim(),
              phone: cleanPhone,
              points: 0,
              tier: 'Bronze',
              totalSpent: 0
            }
          });
        }
        if (cust) {
          finalCustomerId = cust.id;
        }
      }

      let resolvedVoucherId: number | null = null;
      const vId = req.body.voucherId ? Number(req.body.voucherId) : null;
      if (vId) {
        const v = await tx.voucher.findFirst({
          where: tenantId ? { id: vId, tenantId } : { id: vId }
        });
        const alreadyUsedInThisOrder = orders.some((o: any) => o.voucherId === vId);
        if (v && (v.status === 'Aktif' || alreadyUsedInThisOrder)) {
          if (!v.maxUsage || v.usedCount < v.maxUsage || alreadyUsedInThisOrder) {
            resolvedVoucherId = v.id;
            if (!alreadyUsedInThisOrder) {
              await tx.voucher.update({
                where: { id: v.id },
                data: { usedCount: { increment: 1 } }
              });
            }
          }
        }
      }

      if (ids.length === 1) {
        const order = orders[0];
        const ptsUsed = Number(req.body.pointsUsed) || Number(req.body.pointsRedeemed) || 0;

        // Jika hanya 1 order, update langsung total & discount
        const updateData: any = {
          status: 'Paid',
          paymentMethod,
          paidAt: paidNow // Fix #1: rekam waktu bayar
        };
        if (resolvedVoucherId) {
          updateData.voucherId = resolvedVoucherId;
        }
        if (ptsUsed > 0) {
          updateData.pointsUsed = ptsUsed;
        }
        if (shouldAutoServe) {
          updateData.kdsStatus = 'Served';
          updateData.servedAt = paidNow;
        }
        if (passedDiscount !== undefined) {
          const safePassedDiscount = Math.max(0, Math.min(passedDiscount, order.subtotal || order.total));
          updateData.discount = safePassedDiscount;
        }
        if (passedTotal !== undefined) {
          updateData.total = Math.max(0, passedTotal);
        }
        if (finalCustomerId) updateData.customerId = finalCustomerId;

        const updated = await tx.order.update({
          where: { id: ids[0] },
          data: updateData
        });

        // Proses poin loyalitas
        if (finalCustomerId) {
          if (ptsUsed > 0) {
            await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, updated.orderNumber, effectiveTenantId);
          }
          await processLoyaltyEarnings(tx, finalCustomerId, updated.total, updated.orderNumber, effectiveTenantId);
        }

        // Piutang
        if (paymentMethod === 'Piutang') {
          if (!finalCustomerId) {
            throw new Error('Pelanggan (Member) wajib dipilih untuk transaksi Piutang');
          }
          await tx.debt.create({
            data: {
              customerId: finalCustomerId,
              orderId: updated.id,
              amount: Number(updated.total),
              remaining: Number(updated.total),
              status: 'Belum Lunas',
              dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              notes: req.body.debtNotes || null
            }
          });
        }

        updatedOrders.push(updated);
      } else {
        // Fix #2: Distribusi diskon PROPORSIONAL ke setiap order berdasarkan ratio subtotal
        const originalTotalSum = orders.reduce((sum, o) => sum + o.total, 0);
        const totalDiscountApplied = passedDiscount > 0 ? passedDiscount
          : (passedTotal !== undefined ? Math.max(0, originalTotalSum - passedTotal) : 0);

        const ptsUsed = Number(req.body.pointsUsed) || Number(req.body.pointsRedeemed) || 0;

        if (finalCustomerId && ptsUsed > 0) {
          await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, orders[0].orderNumber);
        }

        let totalCombinedPaid = 0;
        let remainingDiscount = totalDiscountApplied; // sisa diskon agar total tetap presisi

        for (let i = 0; i < orders.length; i++) {
          const o = orders[i];
          const updateData: any = {
            status: 'Paid',
            paymentMethod,
            paidAt: paidNow // Fix #1: rekam waktu bayar
          };
          if (resolvedVoucherId && i === 0) {
            updateData.voucherId = resolvedVoucherId;
          }
          if (ptsUsed > 0 && i === 0) {
            updateData.pointsUsed = ptsUsed;
          }
          if (shouldAutoServe) {
            updateData.kdsStatus = 'Served';
            updateData.servedAt = paidNow;
          }
          if (finalCustomerId) updateData.customerId = finalCustomerId;

          // Fix #2: Hitung porsi diskon proporsional per order
          let proportionalDiscount = 0;
          if (originalTotalSum > 0 && totalDiscountApplied > 0) {
            if (i < orders.length - 1) {
              // Pembulatan ke bawah untuk semua kecuali order terakhir
              proportionalDiscount = Math.floor(totalDiscountApplied * (o.total / originalTotalSum));
            } else {
              // Order terakhir menanggung sisa pembulatan agar total diskon tepat
              proportionalDiscount = remainingDiscount;
            }
          }
          remainingDiscount -= proportionalDiscount;
          updateData.discount = (o.discount || 0) + proportionalDiscount;
          updateData.total = Math.max(0, o.total - proportionalDiscount);

          const updated = await tx.order.update({
            where: { id: o.id },
            data: updateData
          });
          totalCombinedPaid += updated.total;

          // Piutang
          if (paymentMethod === 'Piutang') {
            if (!finalCustomerId) {
              throw new Error('Pelanggan (Member) wajib dipilih untuk transaksi Piutang');
            }
            await tx.debt.create({
              data: {
                customerId: finalCustomerId,
                orderId: updated.id,
                amount: Number(updated.total),
                remaining: Number(updated.total),
                status: 'Belum Lunas',
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                notes: req.body.debtNotes || null
              }
            });
          }

          updatedOrders.push(updated);

          // Poin loyalitas dicatat per masing-masing order agar sinkron saat void sebagian
          if (finalCustomerId) {
            await processLoyaltyEarnings(tx, finalCustomerId, updated.total, updated.orderNumber, effectiveTenantId);
          }
        }
      }

      // Auto-release table status if no other active pending orders exist
      for (const ord of updatedOrders) {
        if (ord.tableId) {
          const remainingActive = await tx.order.count({
            where: {
              tableId: ord.tableId,
              status: 'Pending',
              id: { notIn: updatedOrders.map((u: any) => u.id) }
            }
          });
          if (remainingActive === 0) {
            await tx.table.update({
              where: { id: ord.tableId },
              data: { status: 'Kosong' }
            });
          }
        }
      }

      return updatedOrders;
    });

    // Emit hanya ke tenant terkait — tidak global
    const targetTenantId = result[0]?.tenantId || tenantId;
    if (targetTenantId) {
      emitToTenant(targetTenantId, 'order:paid', { orderIds: result.map((o: any) => o.id) });
    }
    for (const ord of result) {
      if (ord.tableId && targetTenantId) {
        emitToTenant(targetTenantId, 'table:update', { tableId: ord.tableId });
      }
    }

    // Auto-print struk (fire-and-forget) — pakai settings tenant yang benar
    const paySettings = targetTenantId ? await prisma.settings.findFirst({ where: { tenantId: targetTenantId } }) : null;
    if (paySettings?.autoPrintReceipt && result.length > 0) {
      const fullOrder = await prisma.order.findFirst({
        where: targetTenantId ? { id: result[0].id, tenantId: targetTenantId } : { id: result[0].id },
        include: { items: { include: { product: { include: { category: true } } } }, table: true, user: { select: { name: true } }, customer: true }
      });
      if (fullOrder) {
        await enrichOrderWithJoinedTables(fullOrder, prisma);
        PrinterService.printReceipt(fullOrder, paySettings).catch(e => console.error('[Printer Receipt]', e.message));
      }
    }

    // Trigger kirim WhatsApp e-Receipt otomatis untuk pesanan yang lunas
    if (targetTenantId) {
      for (const ord of result) {
        whatsAppTriggerService.triggerOrderReceipt(ord.id, targetTenantId).catch(err => {
          console.warn('[WhatsApp Trigger] Gagal trigger e-Receipt on pay:', err.message);
        });
      }
    }

    res.json({ message: 'Pembayaran berhasil dikonfirmasi', orders: result });
  } catch (error: any) {
    console.error('Payment Error:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses pembayaran' });
  }
});

// PATCH Void Order (Membatalkan pesanan dan mengembalikan stok)
router.patch('/:id/void', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenantId || (req.headers['x-tenant-id'] as string) || null;
    if (!tenantId && !user?.isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    const orderData = await prisma.order.findFirst({
      where: tenantId ? { id: Number(id), tenantId } : { id: Number(id) },
      include: { items: true }
    });

    if (!orderData) return res.status(404).json({ error: 'Order tidak ditemukan' });
    if (orderData.status === 'Void') return res.status(400).json({ error: 'Order ini sudah dibatalkan sebelumnya' });

    // Gunakan transaksi untuk update status dan kembalikan stok
    await prisma.$transaction(async (tx) => {
      // 1. Void Order
      await tx.order.update({
        where: { id: Number(id) },
        data: { status: 'Void', kdsStatus: 'Cancelled' }
      });

      // 2. Kembalikan stok: Jika produk memiliki resep BOM (Advanced Mode), kembalikan bahan baku.
      // Jika TIDAK memiliki resep (Simple Mode), kembalikan stok produk langsung.
      // Hal ini mencegah penggandaan stok siluman (phantom stock) pada produk berbahan baku.
      for (const item of orderData.items) {
        const recipes = await tx.recipeItem.findMany({ where: { productId: item.productId } });
        const hasRecipe = recipes.length > 0;

        if (!hasRecipe) {
          // Simple Mode: kembalikan stok produk jadi
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } }
          });
        } else {
          // Advanced Mode: kembalikan stok bahan baku pembentuk resep
          for (const recipe of recipes) {
            const restored = recipe.qtyPerServing * item.qty;
            await tx.ingredient.update({
              where: { id: recipe.ingredientId },
              data: { stock: { increment: restored } }
            });
            await tx.ingredientLog.create({
              data: {
                tenantId: orderData.tenantId || null,
                outletId: orderData.outletId || null,
                ingredientId: recipe.ingredientId,
                change: restored,
                type: 'Void',
                description: `Void Order #${orderData.orderNumber}`,
                referenceId: orderData.orderNumber
              }
            });
          }
        }
      }

      // 3. Batalkan Poin Loyalitas
      if (orderData.customerId) {
        const settings = await tx.settings.findFirst({ where: orderData.tenantId ? { tenantId: orderData.tenantId } : undefined });
        const silverThreshold = settings ? settings.loyaltySilverThreshold : 1000000;
        const goldThreshold = settings ? settings.loyaltyGoldThreshold : 3000000;

        // Cari log penambahan poin (Earn) untuk order ini
        const earnLog = await tx.pointLog.findFirst({
          where: {
            customerId: orderData.customerId,
            type: 'Earn',
            description: { contains: `Order #${orderData.orderNumber}` }
          }
        });

        if (earnLog) {
          const cust = await tx.customer.findUnique({ where: { id: orderData.customerId } });
          if (cust) {
            // Fix #4: Hapus Math.max(0,...) agar poin bisa negatif – mencegah points-farming fraud
          // Jika pelanggan menebus poin SEBELUM void, saldo poin akan negatif dan harus "dilunasi" di belanja berikutnya
          const newPoints = cust.points - earnLog.points;
            const newTotalSpent = Math.max(0, cust.totalSpent - orderData.total);

            // Hitung ulang tier jika turun
            let newTier = 'Bronze';
            if (newTotalSpent >= goldThreshold) {
              newTier = 'Gold';
            } else if (newTotalSpent >= silverThreshold) {
              newTier = 'Silver';
            }

            await tx.customer.update({
              where: { id: orderData.customerId },
              data: {
                points: newPoints,
                totalSpent: newTotalSpent,
                tier: newTier
              }
            });

            await tx.pointLog.create({
              data: {
                customerId: orderData.customerId,
                points: -earnLog.points,
                type: 'Refund',
                description: `Void Order #${orderData.orderNumber}: Penarikan poin belanja`
              }
            });
          }
        }

        // Cari log penukaran poin (Redeem) untuk order ini
        const redeemLog = await tx.pointLog.findFirst({
          where: {
            customerId: orderData.customerId,
            type: 'Redeem',
            description: { contains: `Order #${orderData.orderNumber}` }
          }
        });

        if (redeemLog) {
          const cust = await tx.customer.findUnique({ where: { id: orderData.customerId } });
          if (cust) {
            const refundPoints = Math.abs(redeemLog.points);
            await tx.customer.update({
              where: { id: orderData.customerId },
              data: {
                points: cust.points + refundPoints
              }
            });

            await tx.pointLog.create({
              data: {
                customerId: orderData.customerId,
                points: refundPoints,
                type: 'Refund',
                description: `Void Order #${orderData.orderNumber}: Pengembalian poin diskon`
              }
            });
          }
        }
      }

      // 4. Auto-release status Meja jika tidak ada order aktif lain
      if (orderData.tableId) {
        const otherActiveOrders = await tx.order.count({
          where: {
            tableId: orderData.tableId,
            status: 'Pending',
            id: { not: Number(id) }
          }
        });
        if (otherActiveOrders === 0) {
          await tx.table.update({
            where: { id: orderData.tableId },
            data: { status: 'Kosong' }
          });
        }
      }
    });

    // Emit hanya ke tenant terkait — tidak global
    if (orderData.tenantId) {
      emitToTenant(orderData.tenantId, 'order:void', { orderId: Number(id), orderNumber: orderData.orderNumber });
    }
    if (orderData.tableId && orderData.tenantId) {
      emitToTenant(orderData.tenantId, 'table:update', { tableId: orderData.tableId });
    }

    // Audit Log: Order Void
    await AuditLogger.log({
      action: 'ORDER_VOID',
      resource: 'ORDER',
      resourceId: String(orderData.id),
      description: `Void pesanan #${orderData.orderNumber} senilai Rp ${orderData.total?.toLocaleString('id-ID') || 0}.`,
      oldValue: { status: orderData.status, total: orderData.total, orderNumber: orderData.orderNumber },
      newValue: { status: 'Void' },
      severity: 'CRITICAL'
    }, req);

    res.json({ message: 'Order berhasil dibatalkan dan stok telah dikembalikan' });
  } catch (error) {
    console.error('Void Error:', error);
    res.status(500).json({ error: 'Gagal membatalkan pesanan' });
  }
});

// POST Split Order (Pecah bill meja)
router.post('/split', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tableId, splitItems } = req.body;
    const userId = (req as any).user.id;

    if (!tableId || !splitItems || !Array.isArray(splitItems) || splitItems.length === 0) {
      return res.status(400).json({ error: 'Parameter tableId dan splitItems tidak valid' });
    }

    // Ambil setting pajak dan service charge
    const tenantIdForSplit = (req as any).user?.tenantId || null;
    const settings = await prisma.settings.findFirst({ where: tenantIdForSplit ? { tenantId: tenantIdForSplit } : undefined });
    const taxRate = settings?.taxRate || 0;
    const serviceChargeRate = settings?.serviceCharge || 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat order baru untuk split bill
      const tenantIdForSplit = (req as any).user?.tenantId || null;
      const orderNumber = await generateOrderNumber(tenantIdForSplit);
      
      // Ambil detail customer dari order pertama di meja ini (terisolasi per tenant)
      const firstActiveOrder = await tx.order.findFirst({
        where: { 
          tableId: Number(tableId), 
          status: 'Pending',
          ...(tenantIdForSplit ? { tenantId: tenantIdForSplit } : {})
        },
        orderBy: { id: 'asc' }
      });

      if (!firstActiveOrder) {
        throw new Error('Tidak ada pesanan aktif di meja ini');
      }

      // Buat newOrder penampung split
      // Fix #3: Warisi kdsStatus dari order asal agar KDS dapur tidak kehilangan pesanan yang masih dimasak
      const newOrder = await tx.order.create({
        data: {
          tenantId: firstActiveOrder.tenantId || null,
          outletId: firstActiveOrder.outletId || null,
          orderNumber,
          customerName: firstActiveOrder.customerName || 'Pelanggan Split',
          customerPhone: firstActiveOrder.customerPhone,
          customerId: firstActiveOrder.customerId,
          tableId: Number(tableId),
          userId,
          subtotal: 0,
          discount: 0,
          tax: 0,
          serviceCharge: 0,
          total: 0,
          status: 'Pending',
          kdsStatus: firstActiveOrder.kdsStatus // Fix #3: Warisi status masak dari order asal
        }
      });

      let newSubtotal = 0;

      const originalParentDiscounts = new Map<number, number>();

      // 2. Proses memindahkan item
      for (const splitItem of splitItems) {
        const { orderItemId, qtyToMove } = splitItem;
        const item = await tx.orderItem.findUnique({
          where: { id: Number(orderItemId) },
          include: { order: true }
        });

        if (!item) {
          throw new Error(`Item dengan ID ${orderItemId} tidak ditemukan`);
        }

        if (item.order.status !== 'Pending') {
          throw new Error(`Order ${item.order.orderNumber} tidak aktif (Pending)`);
        }

        if (qtyToMove > item.qty) {
          throw new Error(`Kuantitas split (${qtyToMove}) melebihi kuantitas item (${item.qty})`);
        }

        if (!originalParentDiscounts.has(item.orderId)) {
          originalParentDiscounts.set(item.orderId, item.order.discount || 0);
        }

        newSubtotal += item.price * qtyToMove;

        if (qtyToMove === item.qty) {
          // Pindahkan langsung
          await tx.orderItem.update({
            where: { id: item.id },
            data: { 
              orderId: newOrder.id 
            }
          });
        } else {
          // Kurangi kuantitas item lama
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              qty: item.qty - qtyToMove,
              subtotal: item.price * (item.qty - qtyToMove)
            }
          });

          // Buat item baru di order baru
          await tx.orderItem.create({
            data: {
              tenantId: firstActiveOrder.tenantId || null,
              outletId: firstActiveOrder.outletId || null,
              orderId: newOrder.id,
              productId: item.productId,
              qty: qtyToMove,
              price: item.price,
              buyPrice: item.buyPrice,
              subtotal: item.price * qtyToMove,
              notes: item.notes
            }
          });
        }
      }

      // 3. Hitung porsi pajak dan service untuk newOrder
      const newTax = newSubtotal * (taxRate / 100);
      const newService = newSubtotal * (serviceChargeRate / 100);

      // 4. Hitung ulang total untuk order-order asal
      const allParentOrders = await tx.order.findMany({
        where: { tableId: Number(tableId), status: 'Pending', id: { not: newOrder.id } },
        include: { items: true }
      });

      let totalDiscountTransferred = 0;

      for (const parent of allParentOrders) {
        const originalDiscount = originalParentDiscounts.get(parent.id) || 0;

        if (parent.items.length === 0) {
          // Seluruh item dipindahkan, transfer semua diskon asal
          totalDiscountTransferred += originalDiscount;
          
          await tx.order.delete({
            where: { id: parent.id }
          });
        } else {
          // Hitung ulang subtotal dan diskon proporsional
          const sub = parent.items.reduce((sum, i) => sum + i.subtotal, 0);
          const t = sub * (taxRate / 100);
          const s = sub * (serviceChargeRate / 100);
          
          // Hitung proporsional diskon berdasarkan porsi nilai yang tersisa
          const originalSub = parent.subtotal > 0 ? parent.subtotal : sub;
          const proportionalDiscount = originalSub > 0
            ? Math.floor(originalDiscount * (sub / originalSub))
            : originalDiscount;
          
          const tot = Math.max(0, sub - proportionalDiscount + t + s);

          await tx.order.update({
            where: { id: parent.id },
            data: {
              subtotal: sub,
              discount: proportionalDiscount,
              tax: t,
              serviceCharge: s,
              total: tot
            }
          });

          // Porsi diskon yang berkurang ditransfer ke order baru
          totalDiscountTransferred += Math.max(0, originalDiscount - proportionalDiscount);
        }
      }

      // 5. Update total dan diskon akhir untuk newOrder
      const finalDiscount = totalDiscountTransferred;
      const finalTotalForNewOrder = Math.max(0, newSubtotal - finalDiscount + newTax + newService);

      const finalNewOrder = await tx.order.update({
        where: { id: newOrder.id },
        data: {
          subtotal: newSubtotal,
          discount: finalDiscount,
          tax: newTax,
          serviceCharge: newService,
          total: finalTotalForNewOrder
        },
        include: { items: true }
      });

      return finalNewOrder;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Split Order Error:', error);
    res.status(500).json({ error: error.message || 'Gagal membagi pesanan' });
  }
});

// POST Move Table (Pindah Meja)
router.post('/move-table', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceTableId, targetTableId } = req.body;
    if (!sourceTableId || !targetTableId) {
      return res.status(400).json({ error: 'Parameter sourceTableId dan targetTableId wajib diisi' });
    }

    const sId = Number(sourceTableId);
    const tId = Number(targetTableId);

    if (sId === tId) {
      return res.status(400).json({ error: 'Meja asal dan meja tujuan tidak boleh sama' });
    }

    const user = (req as any).user;
    const moveTenantId = user?.tenantId || (req.headers['x-tenant-id'] as string) || null;

    // 1. Pastikan meja tujuan aktif & kosong (terisolasi ke tenant aktif ini)
    const allActiveOrders = await prisma.order.findMany({
      where: {
        ...(moveTenantId ? { tenantId: moveTenantId } : {}),
        OR: [
          { status: 'Pending' },
          {
            status: 'Paid',
            kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }
          }
        ]
      },
      select: { id: true, tableId: true, joinedTableIds: true, tenantId: true }
    });

    const isTargetOccupied = allActiveOrders.some(o => {
      if (o.tableId === tId) return true;
      if (o.joinedTableIds) {
        try {
          const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids) && ids.map(Number).includes(tId)) return true;
        } catch (e) {}
      }
      return false;
    });

    if (isTargetOccupied) {
      return res.status(400).json({ error: 'Meja tujuan sudah terisi pesanan aktif. Silakan gunakan fitur Gabung Meja.' });
    }

    // 2. Cari semua order aktif di meja asal (baik sebagai tableId utama ataupun joinedTableIds)
    const sourceActiveOrders = allActiveOrders.filter(o => {
      if (o.tableId === sId) return true;
      if (o.joinedTableIds) {
        try {
          const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids) && ids.map(Number).includes(sId)) return true;
        } catch (e) {}
      }
      return false;
    });

    if (sourceActiveOrders.length === 0) {
      return res.status(400).json({ error: 'Tidak ada pesanan aktif di meja asal' });
    }

    // 3. Pindahkan order ke meja tujuan
    for (const o of sourceActiveOrders) {
      if (o.tableId === sId) {
        await prisma.order.update({
          where: { id: o.id },
          data: { tableId: tId }
        });
      } else if (o.joinedTableIds) {
        try {
          let ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids)) {
            ids = ids.map((id: any) => Number(id) === sId ? tId : Number(id));
            await prisma.order.update({
              where: { id: o.id },
              data: { joinedTableIds: JSON.stringify(ids) }
            });
          }
        } catch (e) {}
      }
    }

    // Emit hanya ke tenant terkait
    if (moveTenantId) {
      emitToTenant(moveTenantId, 'order:new', { message: 'Table moved', sourceTableId: sId, targetTableId: tId });
      emitToTenant(moveTenantId, 'order:paid', { sourceTableId: sId, targetTableId: tId });
      emitToTenant(moveTenantId, 'kds:statusChanged', { message: 'Table moved KDS' });
    }

    res.json({ message: 'Meja berhasil dipindahkan', movedCount: sourceActiveOrders.length });
  } catch (error: any) {
    console.error('Move Table Error:', error);
    res.status(500).json({ error: error.message || 'Gagal memindahkan meja' });
  }
});

// POST Merge Table (Gabung Meja)
router.post('/merge-table', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceTableId, targetTableId } = req.body;
    if (!sourceTableId || !targetTableId) {
      return res.status(400).json({ error: 'Parameter sourceTableId dan targetTableId wajib diisi' });
    }

    const sId = Number(sourceTableId);
    const tId = Number(targetTableId);

    if (sId === tId) {
      return res.status(400).json({ error: 'Meja asal dan meja tujuan tidak boleh sama' });
    }

    const user = (req as any).user;
    const mergeTenantId = user?.tenantId || (req.headers['x-tenant-id'] as string) || null;

    const result = await prisma.$transaction(async (tx) => {
      // Cari semua order aktif milik tenant ini
      const allActiveOrders = await tx.order.findMany({
        where: {
          ...(mergeTenantId ? { tenantId: mergeTenantId } : {}),
          OR: [
            { status: 'Pending' },
            {
              status: 'Paid',
              kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }
            }
          ]
        },
        include: { items: true }
      });

      // Cari order aktif di meja asal
      const sourceActiveOrders = allActiveOrders.filter(o => {
        if (o.tableId === sId) return true;
        if (o.joinedTableIds) {
          try {
            const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
            if (Array.isArray(ids) && ids.map(Number).includes(sId)) return true;
          } catch (e) {}
        }
        return false;
      });

      if (sourceActiveOrders.length === 0) {
        throw new Error('Tidak ada pesanan aktif di meja asal');
      }

      // Cari order aktif di meja tujuan
      const targetActiveOrders = allActiveOrders.filter(o => {
        if (o.tableId === tId) return true;
        if (o.joinedTableIds) {
          try {
            const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
            if (Array.isArray(ids) && ids.map(Number).includes(tId)) return true;
          } catch (e) {}
        }
        return false;
      });

      // Jika meja tujuan kosong, lakukan pindah meja
      if (targetActiveOrders.length === 0) {
        for (const o of sourceActiveOrders) {
          if (o.tableId === sId) {
            await tx.order.update({
              where: { id: o.id },
              data: { tableId: tId }
            });
          }
        }
        return { type: 'move', count: sourceActiveOrders.length };
      }

      // Jika meja tujuan juga ada pesanan, gabungkan: tambahkan sourceTableId ke target order's joinedTableIds dan pindahkan items/orders
      // Update tableId source order ke targetTableId
      await tx.order.updateMany({
        where: { id: { in: sourceActiveOrders.map(o => o.id) } },
        data: { tableId: tId }
      });

      return { type: 'merge', count: sourceActiveOrders.length };
    });

    // Emit hanya ke tenant terkait
    if (mergeTenantId) {
      emitToTenant(mergeTenantId, 'order:new', { message: 'Table merged', sourceTableId: sId, targetTableId: tId });
      emitToTenant(mergeTenantId, 'order:paid', { sourceTableId: sId, targetTableId: tId });
      emitToTenant(mergeTenantId, 'kds:statusChanged', { message: 'Table merged KDS' });
    }

    res.json({ 
      message: result.type === 'move' ? 'Meja berhasil dipindahkan' : 'Meja berhasil digabungkan', 
      type: result.type 
    });
  } catch (error: any) {
    console.error('Merge Table Error:', error);
    res.status(500).json({ error: error.message || 'Gagal menggabungkan meja' });
  }
});

export default router;
