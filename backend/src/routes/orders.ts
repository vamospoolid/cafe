import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';
import { io } from '../index';
import { PrinterService } from '../services/PrinterService';

const router = Router();
const prisma = new PrismaClient();

// Helper: Process loyalty points earning
const processLoyaltyEarnings = async (tx: any, customerId: number, orderTotal: number, orderNumber: string) => {
  const settings = await tx.settings.findFirst();
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  if (!loyaltyEnabled) return;

  const earnPerAmount = settings ? settings.loyaltyEarnPerAmount : 10000;
  const silverThreshold = settings ? settings.loyaltySilverThreshold : 1000000;
  const goldThreshold = settings ? settings.loyaltyGoldThreshold : 3000000;
  const silverMultiplier = settings ? settings.loyaltySilverMultiplier : 1.2;
  const goldMultiplier = settings ? settings.loyaltyGoldMultiplier : 1.5;

  const customer = await tx.customer.findUnique({ where: { id: customerId } });
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
const processLoyaltyRedemption = async (tx: any, customerId: number, pointsToRedeem: number, orderNumber: string) => {
  const settings = await tx.settings.findFirst();
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  if (!loyaltyEnabled) return;

  const customer = await tx.customer.findUnique({ where: { id: customerId } });
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

// Fungsi untuk generate nomor order (Contoh: ORD-20231025-001)
const generateOrderNumber = async () => {
  const date = new Date();
  const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Cari order terakhir di hari yang sama
  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: `ORD-${dateString}`
      }
    },
    orderBy: {
      id: 'desc'
    }
  });

  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
    const newSequence = (lastSequence + 1).toString().padStart(3, '0');
    return `ORD-${dateString}-${newSequence}`;
  }
  
  return `ORD-${dateString}-001`;
};

// GET all orders (Riwayat Transaksi)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, date, active } = req.query;
    
    // Filter conditions
    const whereCondition: any = {};
    
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
      // Filter by specific date (YYYY-MM-DD)
      const startDate = new Date(date as string);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date as string);
      endDate.setHours(23, 59, 59, 999);
      
      whereCondition.createdAt = {
        gte: startDate,
        lte: endDate
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

    if (tableId) {
      const tableExists = await prisma.table.findUnique({
        where: { id: Number(tableId) }
      });
      if (!tableExists) {
        return res.status(400).json({ error: 'Meja tidak ditemukan atau nomor meja tidak valid' });
      }
    }

    const orderNumber = await generateOrderNumber();

    const result = await prisma.$transaction(async (tx) => {
      // Ambil buyPrice untuk produk agar HPP tercatat
      const productIds = items.map((item: any) => Number(item.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const buyPriceMap = new Map(products.map(p => [p.id, p.buyPrice || 0]));

      // Buat Order Induk
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: customerName || `Pelanggan`,
          customerPhone,
          customerId: customerId ? Number(customerId) : null,
          tableId: tableId ? Number(tableId) : null,
          userId,
          subtotal: Number(subtotal),
          discount: 0,
          tax: Number(tax),
          serviceCharge: Number(serviceCharge),
          total: Number(total),
          paymentMethod: null,
          status: 'Pending',
          kdsStatus: 'Pending',
          
          items: {
            create: items.map((item: any) => ({
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

      // Kurangi Stok Produk
      for (const item of items) {
        await tx.product.update({
          where: { id: Number(item.productId) },
          data: {
            stock: { decrement: Number(item.qty) }
          }
        });
      }

      return order;
    });

    res.status(201).json({ message: 'Pesanan Dine-In berhasil dibuat', order: result });
  } catch (error) {
    console.error('Dine-In Order Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses pesanan mandiri' });
  }
});

// POST Create Order (POS Checkout)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
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
      discount,
      customerId,
      pointsUsed,
      paymentMethod,
      isPaid
    } = req.body;
    
    // Ambil userId dari token middleware
    const userId = (req as any).user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja kosong' });
    }

    const orderNumber = await generateOrderNumber();

    // Jalankan Transaction agar konsisten (Atomic)
    const result = await prisma.$transaction(async (tx) => {
      // 0. Ambil buyPrice untuk semua product
      const productIds = items.map((item: any) => Number(item.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const buyPriceMap = new Map(products.map(p => [p.id, p.buyPrice || 0]));

      // 0.5. Cari/Registrasi Customer jika ada phone
      let finalCustomerId = customerId ? Number(customerId) : null;
      if (!finalCustomerId && customerPhone) {
        let cust = await tx.customer.findUnique({ where: { phone: customerPhone } });
        if (!cust && customerName) {
          cust = await tx.customer.create({
            data: {
              name: customerName,
              phone: customerPhone,
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

      // 1. Buat Order Induk
      const order = await tx.order.create({
        data: {
          orderNumber,
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
          kdsStatus: 'Pending', // Selalu dikirim ke dapur sebagai pending
          paidAt: isPaid ? new Date() : null, // Fix #1: Catat waktu pembayaran untuk rekonsiliasi shift akurat
          
          items: {
            create: items.map((item: any) => ({
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

      // 2. Kurangi Stok Produk (Fix #6: validasi stok sebelum decrement)
      // Cek mode inventaris untuk menentukan apakah perlu decrement bahan baku juga
      const settings = await tx.settings.findFirst();
      const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: Number(item.productId) } });
        if (product && product.stock < Number(item.qty)) {
          throw new Error(`Stok produk "${product.name}" tidak mencukupi (tersisa: ${product.stock}, dibutuhkan: ${item.qty})`);
        }
        await tx.product.update({
          where: { id: Number(item.productId) },
          data: { stock: { decrement: Number(item.qty) } }
        });

        // Advanced Mode: kurangi stok bahan baku berdasarkan resep
        if (isAdvancedMode) {
          const recipes = await tx.recipeItem.findMany({
            where: { productId: Number(item.productId) }
          });
          for (const recipe of recipes) {
            const used = recipe.qtyPerServing * Number(item.qty);
            await tx.ingredient.update({
              where: { id: recipe.ingredientId },
              data: { stock: { decrement: used } }
            });
            await tx.ingredientLog.create({
              data: {
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
          await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, orderNumber);
        }

        if (isPaid) {
          await processLoyaltyEarnings(tx, finalCustomerId, Number(total), orderNumber);
        }
      }

      return order;
    });

    // Emit real-time event ke semua klien
    io.emit('order:new', {
      orderId: result.id,
      orderNumber: result.orderNumber,
      tableId: result.tableId,
      tableNo: (result as any).table?.tableNo || null
    });

    // Auto-print tiket dapur (fire-and-forget)
    const settingsPrint = await prisma.settings.findFirst();
    if (settingsPrint?.autoPrintKDS) {
      const fullOrder = await prisma.order.findUnique({
        where: { id: result.id },
        include: { items: { include: { product: true } }, table: true }
      });
      if (fullOrder) PrinterService.printKitchenTicket(fullOrder, settingsPrint).catch(e => console.error('[Printer KDS]', e.message));
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

    const passedTotal = total !== undefined ? Number(total) : undefined;
    const passedDiscount = discount !== undefined ? Number(discount) : 0;

    // Jalankan dalam $transaction agar konsisten (atomic)
    const result = await prisma.$transaction(async (tx) => {
      // Ambil data semua order untuk kalkulasi total awal
      const orders = await tx.order.findMany({
        where: { id: { in: ids } }
      });

      if (orders.length === 0) {
        throw new Error('Order tidak ditemukan');
      }

      const updatedOrders = [];
      const paidNow = new Date(); // Fix #1: timestamp tunggal untuk semua order yang dibayar bersamaan
      
      if (ids.length === 1) {
        const order = orders[0];
        const finalCustomerId = req.body.customerId ? Number(req.body.customerId) : order.customerId;
        const ptsUsed = Number(req.body.pointsUsed) || Number(req.body.pointsRedeemed) || 0;

        // Jika hanya 1 order, update langsung total & discount
        const updateData: any = {
          status: 'Paid',
          paymentMethod,
          paidAt: paidNow // Fix #1: rekam waktu bayar
        };
        if (passedDiscount !== undefined) updateData.discount = passedDiscount;
        if (passedTotal !== undefined) updateData.total = passedTotal;
        if (finalCustomerId) updateData.customerId = finalCustomerId;

        const updated = await tx.order.update({
          where: { id: ids[0] },
          data: updateData
        });

        // Proses poin loyalitas
        if (finalCustomerId) {
          if (ptsUsed > 0) {
            await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, updated.orderNumber);
          }
          await processLoyaltyEarnings(tx, finalCustomerId, updated.total, updated.orderNumber);
        }
        updatedOrders.push(updated);
      } else {
        // Fix #2: Distribusi diskon PROPORSIONAL ke setiap order berdasarkan ratio subtotal
        const originalTotalSum = orders.reduce((sum, o) => sum + o.total, 0);
        const totalDiscountApplied = passedDiscount > 0 ? passedDiscount
          : (passedTotal !== undefined ? Math.max(0, originalTotalSum - passedTotal) : 0);

        const finalCustomerId = req.body.customerId ? Number(req.body.customerId) : orders[0].customerId;
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
          updatedOrders.push(updated);
        }

        if (finalCustomerId) {
          await processLoyaltyEarnings(tx, finalCustomerId, totalCombinedPaid, orders[0].orderNumber);
        }
      }

      return updatedOrders;
    });

    // Emit real-time event pembayaran
    io.emit('order:paid', { orderIds: result.map((o: any) => o.id) });

    // Auto-print struk (fire-and-forget)
    const paySettings = await prisma.settings.findFirst();
    if (paySettings?.autoPrintReceipt && result.length > 0) {
      const fullOrder = await prisma.order.findUnique({
        where: { id: result[0].id },
        include: { items: { include: { product: true } }, table: true, user: { select: { name: true } }, customer: true }
      });
      if (fullOrder) PrinterService.printReceipt(fullOrder, paySettings).catch(e => console.error('[Printer Receipt]', e.message));
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
    
    const orderData = await prisma.order.findUnique({
      where: { id: Number(id) },
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

      // 2. Kembalikan stok produk
      const voidSettings = await tx.settings.findFirst();
      const isAdvancedModeVoid = voidSettings?.ingredientTrackingEnabled ?? false;

      for (const item of orderData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } }
        });

        // Advanced Mode: kembalikan stok bahan baku
        if (isAdvancedModeVoid) {
          const recipes = await tx.recipeItem.findMany({ where: { productId: item.productId } });
          for (const recipe of recipes) {
            const restored = recipe.qtyPerServing * item.qty;
            await tx.ingredient.update({
              where: { id: recipe.ingredientId },
              data: { stock: { increment: restored } }
            });
            await tx.ingredientLog.create({
              data: {
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
        const settings = await tx.settings.findFirst();
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
    });

    // Emit real-time event
    io.emit('order:void', { orderId: Number(id), orderNumber: orderData.orderNumber });

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
    const settings = await prisma.settings.findFirst();
    const taxRate = settings?.taxRate || 0;
    const serviceChargeRate = settings?.serviceCharge || 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat order baru untuk split bill
      const orderNumber = await generateOrderNumber();
      
      // Ambil detail customer dari order pertama di meja ini
      const firstActiveOrder = await tx.order.findFirst({
        where: { tableId: Number(tableId), status: 'Pending' },
        orderBy: { id: 'asc' }
      });

      if (!firstActiveOrder) {
        throw new Error('Tidak ada pesanan aktif di meja ini');
      }

      // Buat newOrder penampung split
      // Fix #3: Warisi kdsStatus dari order asal agar KDS dapur tidak kehilangan pesanan yang masih dimasak
      const newOrder = await tx.order.create({
        data: {
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

      // 3. Hitung ulang total untuk newOrder
      const newTax = newSubtotal * (taxRate / 100);
      const newService = newSubtotal * (serviceChargeRate / 100);
      const newTotal = newSubtotal + newTax + newService;

      const finalNewOrder = await tx.order.update({
        where: { id: newOrder.id },
        data: {
          subtotal: newSubtotal,
          tax: newTax,
          serviceCharge: newService,
          total: newTotal
        },
        include: { items: true }
      });

      // 4. Hitung ulang total untuk order-order asal
      const allParentOrders = await tx.order.findMany({
        where: { tableId: Number(tableId), status: 'Pending', id: { not: finalNewOrder.id } },
        include: { items: true }
      });

      for (const parent of allParentOrders) {
        if (parent.items.length === 0) {
          // Hapus order jika kosong
          await tx.order.delete({
            where: { id: parent.id }
          });
        } else {
          // Fix #3: Hitung ulang subtotal dan distribusikan diskon asal secara proporsional
          // berdasarkan rasio subtotal sisa item terhadap subtotal asal
          const sub = parent.items.reduce((sum, i) => sum + i.subtotal, 0);
          const t = sub * (taxRate / 100);
          const s = sub * (serviceChargeRate / 100);
          // Hitung proporsional diskon berdasarkan porsi nilai yang tersisa
          const originalSub = parent.subtotal > 0 ? parent.subtotal : sub;
          const proportionalDiscount = originalSub > 0
            ? Math.floor((parent.discount || 0) * (sub / originalSub))
            : (parent.discount || 0);
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
        }
      }

      return finalNewOrder;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Split Order Error:', error);
    res.status(500).json({ error: error.message || 'Gagal membagi pesanan' });
  }
});

export default router;
