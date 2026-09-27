import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { io, emitToTenant, emitToOutlet } from '../index';
import { TenantContext } from '../utils/tenantContext';
import { PrinterService } from '../services/PrinterService';
import { AuditLogger } from '../services/AuditLogger';
import { EXCLUDED_SHIFT_CASH_CATEGORIES, NON_CASH_EXPENSE_CATEGORIES, getCashPortion } from './shifts';

const router = Router();

import { getLocalDateRange, getCustomDateRange, getLocalOrderDatePrefix } from '../utils/dateHelper';
import { evaluateOperatingStatus } from '../utils/operatingHoursHelper';
import { enqueueOfflineOrdersBatch } from '../queues/syncQueue';

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

// Helper: Auto-release meja utama dan seluruh meja gabungan (joinedTableIds) jika tidak ada pesanan pending lain
export const releaseTablesIfClear = async (
  tx: any,
  tenantId: string | null | undefined,
  primaryTableId: number | null | undefined,
  joinedTableIdsStr: string | null | undefined,
  excludeOrderIds: number[]
): Promise<number[]> => {
  const allTableIdsToRelease = new Set<number>();
  if (primaryTableId) allTableIdsToRelease.add(primaryTableId);

  if (joinedTableIdsStr) {
    try {
      const parsed = typeof joinedTableIdsStr === 'string' ? JSON.parse(joinedTableIdsStr) : joinedTableIdsStr;
      if (Array.isArray(parsed)) {
        parsed.forEach((tid: any) => {
          const num = Number(tid);
          if (!isNaN(num)) allTableIdsToRelease.add(num);
        });
      }
    } catch (e) {}
  }

  if (!tenantId) {
    return [];
  }

  const releasedTableIds: number[] = [];
  for (const tid of allTableIdsToRelease) {
    const pendingCount = await tx.order.count({
      where: {
        tenantId,
        tableId: tid,
        status: 'Pending',
        id: { notIn: excludeOrderIds }
      }
    });
    if (pendingCount === 0) {
      await tx.table.update({
        where: { id: tid },
        data: { status: 'Kosong' }
      });
      releasedTableIds.push(tid);
    }
  }
  return releasedTableIds;
};

// Helper: Process loyalty points earning
const processLoyaltyEarnings = async (tx: any, customerId: number, orderTotal: number, orderNumber: string, tenantId?: string) => {
  // CRM-003: Fail-closed — jika tenantId tidak ada, loyalitas tidak diproses
  // Mencegah pengambilan settings tenant lain via fail-open `tenantId || undefined`
  if (!tenantId) return;

  const settings = await tx.settings.findFirst({ where: { tenantId } });
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  if (!loyaltyEnabled) return;

  const earnPerAmount = settings ? settings.loyaltyEarnPerAmount : 10000;
  const silverThreshold = settings ? settings.loyaltySilverThreshold : 1000000;
  const goldThreshold = settings ? settings.loyaltyGoldThreshold : 3000000;
  const silverMultiplier = settings ? settings.loyaltySilverMultiplier : 1.2;
  const goldMultiplier = settings ? settings.loyaltyGoldMultiplier : 1.5;

  // CRM-001: Validasi kepemilikan customer ke tenantId order sebelum akumulasi poin
  // findUnique tanpa tenantId = IDOR: poin bisa masuk ke customer tenant lain
  const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) return; // customer tidak ditemukan atau beda tenant → skip loyalitas

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
        tenantId,
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
  // CRM-003: Fail-closed — jika tenantId tidak ada, loyalitas tidak diproses
  if (!tenantId) return;

  const settings = await tx.settings.findFirst({ where: { tenantId } });
  const loyaltyEnabled = settings ? settings.loyaltyEnabled : true;
  if (!loyaltyEnabled) return;

  // CRM-002: Validasi kepemilikan customer ke tenantId order sebelum redeem poin
  // Mencegah kasir meredeem poin milik customer tenant lain
  const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) return; // customer tidak ditemukan atau beda tenant → skip redeem

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
        tenantId,
        customerId,
        points: -pointsUsed,
        type: 'Redeem',
        description: `Penukaran poin untuk diskon Order #${orderNumber}`
      }
    });
  }
};

// Fungsi untuk generate nomor order (Contoh: ORD-20231025-001) aman multi-tenant & thread-safe
export const generateOrderNumber = async (tenantId?: string, tzOffset?: number | string) => {
  if (!tenantId) {
    throw new Error('MISSING_TENANT_ID: generateOrderNumber requires valid tenantId');
  }
  const dateString = getLocalOrderDatePrefix(typeof tzOffset === 'number' ? tzOffset : -420);
  
  // Collision verification loop (up to 5 attempts) to guarantee uniqueness even under high concurrency
  for (let attempt = 0; attempt < 5; attempt++) {
    // Cari order terakhir di hari yang sama terisolasi per tenant
    const lastOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: {
          startsWith: `ORD-${dateString}`
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    let candidate = `ORD-${dateString}-001`;
    if (lastOrder) {
      const parts = lastOrder.orderNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        const newSequence = (lastSeq + 1 + attempt).toString().padStart(3, '0');
        candidate = `ORD-${dateString}-${newSequence}`;
      }
    }

    // Verify candidate does not already exist
    const exists = await prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: candidate
      }
    });

    if (!exists) {
      return candidate;
    }
  }

  // Fallback with randomized entropy to guarantee zero collision in high concurrency race conditions
  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateString}-${randSuffix}`;
};

// GET all orders (Riwayat Transaksi) - Terisolasi per Tenant
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, date, startDate, endDate, active, tzOffset } = req.query;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    // Filter conditions
    const whereCondition: any = { tenantId };
    
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

// GET single order by ID - Terisolasi per Tenant
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const order = await prisma.order.findFirst({
      where: { 
        id: Number(id),
        tenantId
      },
      include: {
        table: true,
        user: { select: { name: true, username: true } },
        customer: true,
        items: {
          include: {
            product: true
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

// POST Create Order (Dine-In Customer Self-Ordering) - Terisolasi per Tenant
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

    const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak valid untuk pesanan Dine-In', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = (req.headers['x-outlet-id'] as string) || (req.query.outletId as string) || TenantContext.getOutletId();

    // Ambil default user id milik tenant untuk memenuhi relasi userId yang wajib
    const defaultUser = await prisma.user.findFirst({
      where: {
        memberships: { some: { tenantId } }
      }
    }) || await prisma.user.findFirst({ where: { role: 'Admin' } }) || await prisma.user.findFirst();
    
    if (!defaultUser) {
      return res.status(500).json({ error: 'Sistem belum memiliki pengguna untuk memproses pesanan' });
    }
    const userId = defaultUser.id;

    let resolvedTableId: number | null = null;
    if (tableId) {
      const numId = Number(tableId);
      let tableExists = null;
      if (!isNaN(numId)) {
        tableExists = await prisma.table.findFirst({
          where: { id: numId, tenantId }
        });
      }
      if (!tableExists) {
        const tableStr = String(tableId);
        tableExists = await prisma.table.findFirst({
          where: { tableNo: tableStr, tenantId }
        });
        if (!tableExists) {
          const allTables = await prisma.table.findMany({ where: { tenantId } });
          tableExists = allTables.find(t => t.tableNo.toLowerCase() === tableStr.toLowerCase()) || null;
        }
      }
      if (tableExists) {
        resolvedTableId = tableExists.id;
      }
    }

    const baseOrderNumber = await generateOrderNumber(tenantId);

    const result = await prisma.$transaction(async (tx) => {
      // Ambil buyPrice untuk produk agar HPP tercatat (hitung HPP resep jika ada bahan baku)
      const productIds = items.map((item: any) => Number(item.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId },
        include: {
          recipes: {
            include: {
              ingredient: {
                select: { buyPrice: true }
              }
            }
          }
        }
      });
      if (products.length !== new Set(productIds).size) {
        throw new Error('Satu atau lebih produk tidak valid atau bukan milik tenant ini.');
      }
      const buyPriceMap = new Map(products.map(p => {
        let hpp = 0;
        if (p.recipes && p.recipes.length > 0) {
          hpp = p.recipes.reduce((sum: number, r: any) => sum + (r.qtyPerServing * (r.ingredient?.buyPrice || 0)), 0);
        }
        return [p.id, Math.round(hpp || p.buyPrice || 0)];
      }));

      // Pengaturan toko
      const settings = await tx.settings.findFirst({ where: { tenantId } });
      const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;
      const hasTable = Boolean(resolvedTableId);
      const shouldAutoServe = !hasTable && (!settings || (settings as any).autoCompleteKDSOnPay || (settings as any).enableKDS === false);

      // Buat Order Induk Terisolasi per Tenant dengan Auto-Retry Collision Guard
      let order = null;
      let currentOrderNumber = baseOrderNumber;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          order = await tx.order.create({
            data: {
              tenantId,
              outletId,
              orderNumber: currentOrderNumber,
              customerName: customerName || `Pelanggan`,
              customerPhone,
              customerId: customerId ? Number(customerId) : null,
              tableId: resolvedTableId,
              userId,
              subtotal: !isNaN(Number(subtotal)) ? Number(subtotal) : items.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.qty || 1)), 0),
              discount: 0,
              tax: !isNaN(Number(tax)) ? Number(tax) : 0,
              serviceCharge: !isNaN(Number(serviceCharge)) ? Number(serviceCharge) : 0,
              total: !isNaN(Number(total)) ? Number(total) : items.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.qty || 1)), 0),
              paymentMethod: null,
              status: 'Pending',
              kdsStatus: shouldAutoServe ? 'Served' : 'Pending',
              servedAt: shouldAutoServe ? new Date() : null,
              
              items: {
                create: items.map((item: any) => ({
                  tenantId,
                  outletId,
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

      if (!order) {
        throw new Error('Gagal membuat pesanan setelah beberapa percobaan.');
      }

      // Atomic Stock Guard: Kurangi stok bahan baku untuk menu resep, atau stok produk untuk barang retail
      for (const item of items) {
        const itemQty = Number(item.qty);
        const productId = Number(item.productId);

        let hasRecipe = false;
        if (isAdvancedMode) {
          const recipes = await tx.recipeItem.findMany({
            where: { productId },
            include: { ingredient: { select: { name: true } } }
          });
          if (recipes.length > 0) {
            hasRecipe = true;
            for (const recipe of recipes) {
              const used = recipe.qtyPerServing * itemQty;
              const affectedIng = await tx.$executeRaw`
                UPDATE "Ingredient"
                SET "stock" = "stock" - ${used}
                WHERE "id" = ${recipe.ingredientId} AND "stock" >= ${used}
              `;
              if (affectedIng === 0) {
                const ing = await tx.ingredient.findUnique({ where: { id: recipe.ingredientId }, select: { name: true, stock: true, unit: true } });
                throw new Error(`Stok bahan baku "${ing?.name || 'Bahan'}" tidak mencukupi untuk memproses pesanan (Sisa: ${ing?.stock ?? 0} ${ing?.unit || ''}).`);
              }
              await tx.ingredientLog.create({
                data: {
                  tenantId,
                  ingredientId: recipe.ingredientId,
                  change: -used,
                  type: 'Produksi',
                  description: `Order ${order.orderNumber} (Dine-in Self-Order)`,
                  referenceId: order.orderNumber
                }
              });
            }
          }
        }

        // Jika bukan menu resep (barang retail jadi seperti minuman kemasan), kurangi Product.stock
        if (!hasRecipe) {
          const affected = await tx.$executeRaw`
            UPDATE "Product"
            SET "stock" = "stock" - ${itemQty}
            WHERE "id" = ${productId} AND "stock" >= ${itemQty}
          `;
          if (affected === 0) {
            const prod = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stock: true } });
            throw new Error(`Stok menu "${prod?.name || 'Item'}" tidak mencukupi (Tersisa: ${prod?.stock ?? 0} porsi, diminta: ${itemQty}).`);
          }
        }
      }

      return order;
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    // Emit real-time event ke room tenant terkait saja
    emitToTenant(tenantId, 'order:new', {
      orderId: result.id,
      orderNumber: result.orderNumber,
      tableId: result.tableId,
      tableNo: (result as any).table?.tableNo || null
    });

    res.status(201).json({ message: 'Pesanan Dine-In berhasil dibuat', order: result });
  } catch (error) {
    console.error('Dine-In Order Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses pesanan mandiri' });
  }
});

// POST Sync Offline Orders - Terisolasi per Tenant
router.post('/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Data orders tidak valid' });
    }

    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;
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

      // 1. Cek apakah sudah disinkronisasikan sebelumnya (scoped per tenant)
      const existing = await prisma.order.findFirst({
        where: { tenantId, offlineId },
        include: { items: true }
      });

      if (existing) {
        syncedOrders.push(existing);
        continue;
      }

      if (!items || items.length === 0) continue;

      const baseOrderNumber = await generateOrderNumber(tenantId);

      const result = await prisma.$transaction(async (tx) => {
        // Ambil buyPrice untuk semua produk (hitung HPP resep jika ada bahan baku)
        const allProductIds = Array.from(new Set(orders.flatMap((o: any) => (o.items || []).map((i: any) => Number(i.productId)))));
        const products = await tx.product.findMany({
          where: { id: { in: allProductIds }, tenantId },
          include: {
            recipes: {
              include: {
                ingredient: {
                  select: { buyPrice: true }
                }
              }
            }
          }
        });
        const buyPriceMap = new Map(products.map(p => {
          let hpp = 0;
          if (p.recipes && p.recipes.length > 0) {
            hpp = p.recipes.reduce((sum: number, r: any) => sum + (r.qtyPerServing * (r.ingredient?.buyPrice || 0)), 0);
          }
          return [p.id, Math.round(hpp || p.buyPrice || 0)];
        }));

        let finalCustomerId = customerId ? Number(customerId) : null;
        if (!finalCustomerId && customerPhone) {
          let cust = await tx.customer.findFirst({ where: { phone: customerPhone, tenantId } });
          if (!cust && customerName) {
            cust = await tx.customer.create({
              data: {
                tenantId,
                outletId,
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

        const dateCreated = createdAt ? new Date(createdAt) : new Date();
        const datePaid = paidAt ? new Date(paidAt) : (isPaid ? new Date() : null);

        // Kurangi Stok Produk & Bahan Baku (Advanced Mode)
        const settings = await tx.settings.findFirst({ where: { tenantId } });
        const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;
        const hasTable = Boolean(tableId);
        const shouldAutoServe = !hasTable && (!settings || (settings as any).autoCompleteKDSOnPay || (settings as any).enableKDS === false);

        // Buat Order Induk Terisolasi per Tenant dengan Auto-Retry Collision Guard
        let createdOrder = null;
        let currentOrderNumber = baseOrderNumber;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            createdOrder = await tx.order.create({
              data: {
                tenantId,
                outletId,
                orderNumber: currentOrderNumber,
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
                    tenantId,
                    outletId,
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

        if (!createdOrder) {
          throw new Error('Gagal menyinkronisasikan pesanan setelah beberapa percobaan (benturan nomor struk).');
        }

        // Atomic Soft Stock Guard: Kurangi stok bahan baku untuk menu resep, atau stok produk untuk barang retail (dengan toleransi stok negatif untuk offline sync)
        for (const item of items) {
          const itemQty = Number(item.qty);
          const productId = Number(item.productId);

          let hasRecipe = false;
          if (isAdvancedMode) {
            const recipes = await tx.recipeItem.findMany({
              where: { productId },
              include: { ingredient: { select: { id: true, name: true, stock: true, unit: true } } }
            });
            if (recipes.length > 0) {
              hasRecipe = true;
              for (const recipe of recipes) {
                const used = recipe.qtyPerServing * itemQty;
                const ing = recipe.ingredient;
                const currentIngStock = ing?.stock ?? 0;
                const newIngStock = currentIngStock - used;

                await tx.ingredient.update({
                  where: { id: recipe.ingredientId },
                  data: { stock: newIngStock }
                });

                await tx.ingredientLog.create({
                  data: {
                    tenantId,
                    ingredientId: recipe.ingredientId,
                    change: -used,
                    type: 'Produksi',
                    description: `Order ${createdOrder.orderNumber} (Sync Offline)`,
                    referenceId: createdOrder.orderNumber
                  }
                });

                if (newIngStock < 0) {
                  await AuditLogger.log({
                    tenantId,
                    outletId,
                    userId,
                    action: 'NEGATIVE_STOCK_WARNING',
                    resource: 'INGREDIENT',
                    resourceId: String(recipe.ingredientId),
                    severity: 'WARNING',
                    description: `Stok bahan baku "${ing?.name || 'Bahan'}" menjadi minus (${newIngStock} ${ing?.unit || ''}) akibat sinkronisasi offline order ${createdOrder.orderNumber}. Diperlukan stok opname fisik.`,
                    oldValue: JSON.stringify({ stock: currentIngStock }),
                    newValue: JSON.stringify({ stock: newIngStock })
                  });
                }
              }
            }
          }

          // Jika bukan menu resep, kurangi Product.stock dengan soft deduction
          if (!hasRecipe) {
            const prod = await tx.product.findFirst({ where: { id: productId, tenantId } });
            if (prod) {
              const currentProdStock = prod.stock ?? 0;
              const uomRatio = Number(item.uomRatio) || 1;
              const totalBaseUnitQty = itemQty * uomRatio;
              const newProdStock = currentProdStock - totalBaseUnitQty;

              await tx.product.update({
                where: { id: productId },
                data: { stock: newProdStock }
              });

              if (newProdStock < 0) {
                await AuditLogger.log({
                  tenantId,
                  outletId,
                  userId,
                  action: 'NEGATIVE_STOCK_WARNING',
                  resource: 'INVENTORY',
                  resourceId: String(productId),
                  severity: 'WARNING',
                  description: `Stok produk "${prod.name}" menjadi minus (${newProdStock}) akibat sinkronisasi offline order ${createdOrder.orderNumber}. Diperlukan stok opname fisik.`,
                  oldValue: JSON.stringify({ stock: currentProdStock }),
                  newValue: JSON.stringify({ stock: newProdStock })
                });
              }
            }
          }
        }

        // Poin Loyalitas
        if (finalCustomerId && isPaid) {
          if (pointsUsed && pointsUsed > 0) {
            await processLoyaltyRedemption(tx, finalCustomerId, Number(pointsUsed), createdOrder.orderNumber, tenantId);
          }
          await processLoyaltyEarnings(tx, finalCustomerId, Number(total), createdOrder.orderNumber, tenantId);
        }

        // Piutang
        if (isPaid && paymentMethod === 'Piutang') {
          if (!finalCustomerId) {
            throw new Error('Pelanggan (Member) wajib dipilih untuk transaksi Piutang');
          }
          await tx.debt.create({
            data: {
              tenantId,
              outletId,
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
          const closedShift = await tx.shift.findFirst({
            where: {
              tenantId,
              userId: userId,
              status: 'Closed',
              waktuBuka: { lte: datePaid },
              waktuTutup: { gte: datePaid }
            }
          });

          if (closedShift) {
            // Ambil semua order paid yang masuk ke rentang shift tertutup tersebut milik tenant
            const shiftOrders = await tx.order.findMany({
              where: {
                tenantId,
                status: 'Paid',
                OR: [
                  { paidAt: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! } },
                  { paidAt: null, createdAt: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! } }
                ]
              }
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
                tenantId,
                date: { gte: closedShift.waktuBuka, lte: closedShift.waktuTutup! }
              }
            });

            const debtPayments = await tx.debtPayment.findMany({
              where: {
                tenantId,
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
              .filter((cf: any) => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category))
              .reduce((sum: number, cf: any) => sum + cf.amount, 0);
            const manualCashOut = cashFlows
              .filter((cf: any) => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category))
              .reduce((sum: number, cf: any) => sum + cf.amount, 0);

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
      }, {
        maxWait: 10000,
        timeout: 20000
      });

      // Emit event socket untuk KDS/real-time updates milik tenant terkait saja
      emitToTenant(tenantId, 'order:new', result);
      
      // Auto-Print KDS & Receipt
      try {
        const settings = await prisma.settings.findFirst({ where: { tenantId } });
        if (settings) {
          const fullOrder = await prisma.order.findUnique({
            where: { id: result.id },
            include: { items: { include: { product: true } } }
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

// POST Create Order (POS Checkout) - Terisolasi per Tenant
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
      pointsUsed,
      voucherId,
      paymentMethod,
      isPaid
    } = req.body;
    
    // Ambil user dan tenantId dari token middleware
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja kosong' });
    }

    // Proteksi Shift Kasir Wajib Aktif untuk transaksi langsung POS yang berstatus Lunas (Terisolasi per Tenant)
    if (isPaid) {
      const activeShift = await prisma.shift.findFirst({
        where: { tenantId, status: 'Open' }
      });
      if (!activeShift) {
        return res.status(400).json({ 
          error: 'Shift kasir belum dibuka. Harap buka shift baru dan masukkan modal awal kasir sebelum melayani transaksi.',
          shiftRequired: true 
        });
      }

      // Proteksi Opsi A: Kunci transaksi jika jam operasional toko & batas closing telah berakhir
      const settings = await prisma.settings.findFirst({ where: { tenantId } });
      const opStatus = evaluateOperatingStatus(settings, new Date());
      if (opStatus.isOverdueShift && settings?.enforceOperatingHours !== false) {
        return res.status(403).json({
          error: 'Batas jam operasional toko telah berakhir. Transaksi kasir dikunci secara otomatis (Force Close). Mohon lakukan Tutup Shift terlebih dahulu.',
          code: 'OPERATING_HOURS_OVERDUE',
          isOverdueShift: true
        });
      }
    }

    const baseOrderNumber = await generateOrderNumber(tenantId);

    let formattedJoinedTableIds: string | null = null;
    if (joinedTableIds) {
      if (Array.isArray(joinedTableIds) && joinedTableIds.length > 0) {
        formattedJoinedTableIds = JSON.stringify(joinedTableIds.map(Number));
      } else if (typeof joinedTableIds === 'string' && joinedTableIds.trim().length > 0) {
        formattedJoinedTableIds = joinedTableIds;
      }
    }

    // Jalankan Transaction agar konsisten (Atomic) dengan timeout diperpanjang untuk 10+ Kafe
    const result = await prisma.$transaction(async (tx) => {
      // 0. Ambil buyPrice untuk semua product (hitung HPP resep jika ada bahan baku)
      const productIds = items.map((item: any) => Number(item.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId },
        include: {
          recipes: {
            include: {
              ingredient: {
                select: { buyPrice: true }
              }
            }
          }
        }
      });
      const uniqueProductIds = new Set(productIds);
      if (products.length !== uniqueProductIds.size) {
        throw new Error('Satu atau lebih produk tidak ditemukan atau bukan milik tenant ini.');
      }
      const buyPriceMap = new Map(products.map(p => {
        let hpp = 0;
        if (p.recipes && p.recipes.length > 0) {
          hpp = p.recipes.reduce((sum: number, r: any) => sum + (r.qtyPerServing * (r.ingredient?.buyPrice || 0)), 0);
        }
        return [p.id, Math.round(hpp || p.buyPrice || 0)];
      }));

      // Validasi kepemilikan meja
      let resolvedTableId = tableId ? Number(tableId) : null;
      if (resolvedTableId) {
        const tableCheck = await tx.table.findFirst({
          where: { id: resolvedTableId, tenantId }
        });
        if (!tableCheck) {
          throw new Error('Meja tidak ditemukan atau bukan milik tenant ini.');
        }
      }

      // Validasi kepemilikan meja gabungan
      if (formattedJoinedTableIds) {
        try {
          const parsed = JSON.parse(formattedJoinedTableIds);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validJoined = await tx.table.findMany({
              where: { id: { in: parsed.map(Number) }, tenantId }
            });
            if (validJoined.length !== parsed.length) {
              throw new Error('Satu atau lebih meja gabungan bukan milik tenant ini.');
            }
          }
        } catch (e: any) {
          if (e.message.includes('bukan milik tenant')) throw e;
        }
      }

      // Validasi kepemilikan voucher
      let resolvedVoucherId = voucherId ? Number(voucherId) : null;
      if (resolvedVoucherId) {
        const voucherCheck = await tx.voucher.findFirst({
          where: { id: resolvedVoucherId, tenantId }
        });
        if (!voucherCheck) {
          throw new Error('Voucher tidak ditemukan atau bukan milik tenant ini.');
        }
      }

      // 0.5. Cari/Registrasi Customer jika ada phone (scoped to tenant)
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
        if (!cust && customerName) {
          cust = await tx.customer.create({
            data: {
              tenantId,
              outletId,
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

      // Cek settings toko milik tenant
      const settings = await tx.settings.findFirst({ where: { tenantId } });
      const hasTable = Boolean(tableId);
      const shouldAutoServe = !hasTable && (!settings || (settings as any).autoCompleteKDSOnPay || (settings as any).enableKDS === false);
      const isActuallyPaid = Boolean(isPaid);
      const nowPaid = isActuallyPaid ? new Date() : null;

      // 1. Buat Order Induk Terisolasi per Tenant dengan Auto-Retry Collision Guard
      const numSubtotal = Math.max(0, Number(subtotal) || 0);
      const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, numSubtotal));
      const numTax = Math.max(0, Number(tax) || 0);
      const numService = Math.max(0, Number(serviceCharge) || 0);
      const safeTotal = Math.max(0, Number(total) || (numSubtotal - safeDiscount + numTax + numService));

      let order = null;
      let currentOrderNumber = baseOrderNumber;
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
            include: { items: true, table: true }
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

      if (!order) {
        throw new Error('Gagal memproses pesanan setelah beberapa percobaan (benturan nomor struk).');
      }

      // 1.5. Voucher Usage Tracking
      if (voucherId) {
        await tx.voucher.update({
          where: { id: Number(voucherId) },
          data: { usedCount: { increment: 1 } }
        });
      }

      // 2. Atomic Stock Guard: Kurangi Stok Bahan Baku (Menu Resep) atau Stok Produk (Barang Retail)
      const isAdvancedMode = settings?.ingredientTrackingEnabled ?? false;

      for (const item of items) {
        const itemQty = Number(item.qty);
        const productId = Number(item.productId);

        let hasRecipe = false;
        const recipes = await tx.recipeItem.findMany({
          where: { productId },
          include: { ingredient: { select: { name: true } } }
        });
        if (recipes.length > 0) {
          hasRecipe = true;
          for (const recipe of recipes) {
              const used = recipe.qtyPerServing * itemQty;
              const affectedIng = await tx.$executeRaw`
                UPDATE "Ingredient"
                SET "stock" = "stock" - ${used}
                WHERE "id" = ${recipe.ingredientId} AND "stock" >= ${used}
              `;
              if (affectedIng === 0) {
                const ing = await tx.ingredient.findUnique({ where: { id: recipe.ingredientId }, select: { name: true, stock: true, unit: true } });
                throw new Error(`Stok bahan baku "${ing?.name || 'Bahan'}" tidak mencukupi untuk memproses pesanan (Sisa: ${ing?.stock ?? 0} ${ing?.unit || ''}).`);
              }
              await tx.ingredientLog.create({
                data: {
                  tenantId,
                  ingredientId: recipe.ingredientId,
                  change: -used,
                  type: 'Produksi',
                  description: `Order ${order.orderNumber}`,
                  referenceId: order.orderNumber
                }
              });
            }
          }

        // Jika bukan menu resep (barang retail jadi), potong Product.stock
        if (!hasRecipe) {
          const uomRatio = Number(item.uomRatio) || 1;
          const totalBaseUnitQty = itemQty * uomRatio;
          const affected = await tx.$executeRaw`
            UPDATE "Product"
            SET "stock" = "stock" - ${totalBaseUnitQty}
            WHERE "id" = ${productId} AND "stock" >= ${totalBaseUnitQty}
          `;
          if (affected === 0) {
            const prod = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stock: true } });
            throw new Error(`Stok produk "${prod?.name || 'Item'}" tidak mencukupi (Tersisa: ${prod?.stock ?? 0} pcs/unit, diminta: ${totalBaseUnitQty}).`);
          }
        }
      }

      // 3. Loyalty Points
      if (finalCustomerId) {
        const ptsUsed = Number(pointsUsed) || 0;
        if (ptsUsed > 0) {
          await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, order.orderNumber, tenantId);
        }

        if (isPaid) {
          await processLoyaltyEarnings(tx, finalCustomerId, Number(total), order.orderNumber, tenantId);
        }
      }

      // Piutang & Credit Limit Enforcement
      if (isPaid && (paymentMethod === 'Piutang' || paymentMethod === 'BON' || paymentMethod === 'TEMPO')) {
        if (!finalCustomerId) {
          throw new Error('Pelanggan (Member/Kontraktor) wajib dipilih untuk transaksi Piutang/Bon');
        }

        const cust = await tx.customer.findFirst({
          where: { id: finalCustomerId, tenantId, deletedAt: null }
        });

        if (cust) {
          if (cust.isCreditBlocked) {
            throw new Error(`Fasilitas bon untuk "${cust.name}" sedang DIBLOKIR oleh sistem. Harap lunasi tunggakan sebelumnya.`);
          }

          const activeDebts = await tx.debt.findMany({
            where: { customerId: cust.id, tenantId, status: { not: 'Lunas' } }
          });
          const currentActiveDebt = activeDebts.reduce((sum, d) => sum + (d.remaining ?? d.amount), 0);
          const newTotalDebt = currentActiveDebt + Number(total);

          if (cust.creditLimit > 0 && newTotalDebt > cust.creditLimit) {
            const reqPin = req.headers['x-owner-pin'] || req.body.overridePin || req.body.ownerPin;
            let isPinOk = false;
            if (reqPin) {
              const pUser = await tx.user.findFirst({
                where: {
                  pin: String(reqPin).trim(),
                  OR: [
                    { role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'Owner', 'Admin', 'Manager'] } },
                    { tenantMemberships: { some: { tenantId, role: { name: { in: ['OWNER', 'ADMIN', 'MANAGER'] } } } } }
                  ]
                }
              });
              if (pUser) isPinOk = true;
            }

            if (!isPinOk) {
              const excess = newTotalDebt - cust.creditLimit;
              throw new Error(`Plafon Kredit Terlampaui! Limit: Rp ${cust.creditLimit.toLocaleString('id-ID')}, Bon Berjalan: Rp ${newTotalDebt.toLocaleString('id-ID')} (Lebih Rp ${excess.toLocaleString('id-ID')}). Masukkan PIN Owner untuk menyetujui.`);
            }
          }
        }

        const termDays = cust?.creditTermDays || 14;
        await tx.debt.create({
          data: {
            tenantId,
            outletId,
            customerId: finalCustomerId,
            orderId: order.id,
            amount: Number(total),
            remaining: Number(total),
            status: 'Belum Lunas',
            dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + termDays * 24 * 60 * 60 * 1000),
            notes: req.body.debtNotes || `Bon Tempo (${termDays} hari)`
          }
        });
      }

      return order;
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    // Emit real-time event ke room tenant terkait saja
    emitToTenant(tenantId, 'order:new', {
      orderId: result.id,
      orderNumber: result.orderNumber,
      tableId: result.tableId,
      joinedTableIds: result.joinedTableIds,
      tableNo: (result as any).table?.tableNo || null
    });

    // Auto-print tiket dapur & bar (fire-and-forget)
    const settingsPrint = await prisma.settings.findFirst({ where: { tenantId } });
    if (settingsPrint && (settingsPrint.autoPrintKitchen || settingsPrint.autoPrintKDS || settingsPrint.autoPrintBar)) {
      const fullOrder = await prisma.order.findUnique({
        where: { id: result.id },
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

    res.status(201).json({ message: 'Order berhasil dibuat', order: result });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses pesanan' });
  }
});

// PATCH Payment (Membayar order yang pending, mendukung satu atau beberapa ID dipisah koma) - Terisolasi per Tenant
router.patch('/:id/payment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentMethod, discount, total, voucherId } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = user?.outletId || TenantContext.getOutletId();

    const idStr = typeof id === 'string' ? id : '';
    const ids = idStr.split(',').map((item: string) => Number(item.trim())).filter((num: number) => !isNaN(num));

    if (ids.length === 0) {
      return res.status(400).json({ error: 'ID order tidak valid' });
    }

    // Proteksi Shift Kasir Wajib Aktif untuk pelunasan pembayaran tagihan (Terisolasi per Tenant)
    const activeShift = await prisma.shift.findFirst({
      where: { tenantId, status: 'Open' }
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
      // Ambil data semua order untuk kalkulasi total awal (hanya milik tenant ini)
      const orders = await tx.order.findMany({
        where: { 
          id: { in: ids },
          tenantId
        }
      });

      if (orders.length === 0) {
        throw new Error('Order tidak ditemukan');
      }
      if (orders.length !== ids.length) {
        throw new Error('Beberapa order tidak ditemukan atau bukan milik tenant ini');
      }

      const updatedOrders = [];
      const paidNow = new Date(); // Fix #1: timestamp tunggal untuk semua order yang dibayar bersamaan
      const settings = await tx.settings.findFirst({ where: { tenantId } });
      const hasAnyTable = orders.some(o => Boolean(o.tableId));
      const shouldAutoServe = !hasAnyTable && (!settings || (settings as any).autoCompleteKDSOnPay || (settings as any).enableKDS === false);

      // Validasi dan siapkan pemakaian voucher jika dikirimkan oleh kasir
      let resolvedVoucherId: number | null = null;
      if (voucherId) {
        const vId = Number(voucherId);
        if (!isNaN(vId)) {
          const v = await tx.voucher.findFirst({
            where: {
              id: vId,
              tenantId
            }
          });
          if (v && v.status === 'Aktif') {
            if (!v.maxUsage || v.usedCount < v.maxUsage) {
              resolvedVoucherId = v.id;
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
        const finalCustomerId = req.body.customerId ? Number(req.body.customerId) : order.customerId;
        const ptsUsed = Number(req.body.pointsUsed) || Number(req.body.pointsRedeemed) || 0;

        // Jika hanya 1 order, update langsung total & discount
        const updateData: any = {
          status: 'Paid',
          paymentMethod,
          paidAt: paidNow // Fix #1: rekam waktu bayar
        };
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
        if (resolvedVoucherId) updateData.voucherId = resolvedVoucherId;

        const updated = await tx.order.update({
          where: { id: ids[0] },
          data: updateData
        });

        // Proses poin loyalitas (cegah double-deduction jika poin sudah dipotong saat order pending)
        if (finalCustomerId) {
          if (ptsUsed > 0 && (!order.pointsUsed || order.pointsUsed === 0)) {
            await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, updated.orderNumber, tenantId);
          }
          await processLoyaltyEarnings(tx, finalCustomerId, updated.total, updated.orderNumber, tenantId);
        }

        // Piutang
        if (paymentMethod === 'Piutang') {
          if (!finalCustomerId) {
            throw new Error('Pelanggan (Member) wajib dipilih untuk transaksi Piutang');
          }
          await tx.debt.create({
            data: {
              tenantId,
              outletId,
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

        const finalCustomerId = req.body.customerId ? Number(req.body.customerId) : orders[0].customerId;
        const ptsUsed = Number(req.body.pointsUsed) || Number(req.body.pointsRedeemed) || 0;
        const alreadyRedeemed = orders.some((o: any) => o.pointsUsed && o.pointsUsed > 0);
        if (finalCustomerId && ptsUsed > 0 && !alreadyRedeemed) {
          await processLoyaltyRedemption(tx, finalCustomerId, ptsUsed, orders[0].orderNumber, tenantId);
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
          if (shouldAutoServe) {
            updateData.kdsStatus = 'Served';
            updateData.servedAt = paidNow;
          }
          if (finalCustomerId) updateData.customerId = finalCustomerId;
          if (i === 0 && resolvedVoucherId) updateData.voucherId = resolvedVoucherId;

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
                tenantId,
                outletId,
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
            await processLoyaltyEarnings(tx, finalCustomerId, updated.total, updated.orderNumber, tenantId);
          }
        }
      }

      // Auto-release meja utama dan seluruh meja gabungan jika tidak ada pesanan aktif lain
      const allReleasedTableIds = new Set<number>();
      for (const ord of updatedOrders) {
        const released = await releaseTablesIfClear(
          tx,
          ord.tenantId,
          ord.tableId,
          ord.joinedTableIds,
          updatedOrders.map((u: any) => u.id)
        );
        released.forEach(tid => allReleasedTableIds.add(tid));

        // Jika meja terkait memiliki reservasi aktif, selesaikan status reservasi menjadi 'Lunas'
        if (ord.tableId) {
          const activeRes = await tx.reservation.findFirst({
            where: {
              tableId: ord.tableId,
              status: { in: ['Booking', 'DP Dibayar'] },
              tenantId: ord.tenantId || tenantId
            }
          });
          if (activeRes) {
            await tx.reservation.update({
              where: { id: activeRes.id },
              data: { status: 'Lunas' }
            });
          }
        }
      }

      return { updatedOrders, releasedTableIds: Array.from(allReleasedTableIds) };
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    const finalOrders = result.updatedOrders;

    // Emit real-time event pembayaran & update meja ke room tenant terkait
    emitToTenant(tenantId, 'order:paid', { orderIds: finalOrders.map((o: any) => o.id) });
    for (const tid of result.releasedTableIds) {
      emitToTenant(tenantId, 'table:update', { tableId: tid });
    }

    // Auto-print struk (fire-and-forget)
    const paySettings = await prisma.settings.findFirst({ where: { tenantId } });
    if (paySettings?.autoPrintReceipt && finalOrders.length > 0) {
      const fullOrder = await prisma.order.findUnique({
        where: { id: finalOrders[0].id },
        include: { items: { include: { product: true } }, table: true, user: { select: { name: true } }, customer: true }
      });
      if (fullOrder) {
        await enrichOrderWithJoinedTables(fullOrder, prisma);
        PrinterService.printReceipt(fullOrder, paySettings).catch(e => console.error('[Printer Receipt]', e.message));
      }
    }

    res.json({ message: 'Pembayaran berhasil dikonfirmasi', orders: finalOrders });
  } catch (error: any) {
    console.error('Payment Error:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses pembayaran' });
  }
});

// PATCH Void Order (Membatalkan pesanan dan mengembalikan stok) - Terisolasi per Tenant
router.patch('/:id/void', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, wasteCookedItems } = req.body || {};
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    const orderData = await prisma.order.findFirst({
      where: { 
        id: Number(id),
        tenantId
      },
      include: { 
        items: {
          include: { product: true }
        }
      }
    });

    if (!orderData) return res.status(404).json({ error: 'Order tidak ditemukan' });
    if (orderData.status === 'Void') return res.status(400).json({ error: 'Order ini sudah dibatalkan sebelumnya' });

    // Cek apakah pesanan sudah diproses dapur (Cooking, Ready, Served) atau diminta waste eksplisit
    const isAlreadyCooked = ['Cooking', 'Ready', 'Served'].includes(orderData.kdsStatus || '') || Boolean(wasteCookedItems);

    // Gunakan transaksi untuk update status dan rekonsiliasi stok / waste
    const result = await prisma.$transaction(async (tx) => {
      // 1. Void Order
      await tx.order.update({
        where: { id: Number(id) },
        data: { status: 'Void', kdsStatus: 'Cancelled' }
      });

      const voidSettings = await tx.settings.findFirst({ where: { tenantId } });
      const isAdvancedModeVoid = voidSettings?.ingredientTrackingEnabled ?? false;

      // 2. Rekonsiliasi Stok vs WasteLog
      if (isAlreadyCooked) {
        // MAKANAN SUDAH DIMASAK: Jangan kembalikan stok layak pakai (mencegah phantom inventory).
        // Catat sebagai Food Waste dan kerugian HPP di WasteLog
        for (const item of orderData.items) {
          let itemHppCost = 0;

          if (isAdvancedModeVoid) {
            const recipes = await tx.recipeItem.findMany({
              where: { productId: item.productId },
              include: { ingredient: true }
            });

            for (const recipe of recipes) {
              const usedQty = recipe.qtyPerServing * item.qty;
              const unitCost = recipe.ingredient?.buyPrice || 0;
              const ingLossCost = Math.round(usedQty * unitCost);
              itemHppCost += ingLossCost;

              await tx.ingredientLog.create({
                data: {
                  tenantId,
                  outletId: orderData.outletId,
                  ingredientId: recipe.ingredientId,
                  change: 0, // Sudah terpotong saat pesanan dibuat, tidak dikembalikan ke stok aktif
                  cost: ingLossCost,
                  type: 'Rusak',
                  reason: reason ? String(reason).trim() : `Void pesanan setelah diproses dapur (${orderData.kdsStatus})`,
                  description: `[Food Waste Void] Pesanan #${orderData.orderNumber} dibatalkan setelah dimasak (Bahan: ${recipe.ingredient?.name})`,
                  referenceId: orderData.orderNumber,
                  userId: user?.id
                }
              });
            }
          }

          if (itemHppCost === 0) {
            itemHppCost = Math.round((item.buyPrice || item.product?.buyPrice || 0) * item.qty);
          }

          await tx.wasteLog.create({
            data: {
              tenantId,
              outletId: orderData.outletId,
              type: 'PRODUCT',
              productId: item.productId,
              itemName: item.product?.name || `Menu #${item.productId}`,
              category: 'DISH',
              unit: 'porsi',
              qty: item.qty,
              costPerUnit: item.qty > 0 ? Math.round(itemHppCost / item.qty) : (item.buyPrice || 0),
              totalCost: itemHppCost,
              reason: reason ? String(reason).trim() : `Void pesanan setelah diproses dapur (${orderData.kdsStatus})`,
              notes: `Order #${orderData.orderNumber} dibatalkan pada status ${orderData.kdsStatus}. Makanan dibuang/rusak.`,
              userId: user?.id,
              userName: user?.name || user?.username || 'Kasir/Supervisor'
            }
          });
        }
      } else {
        // MAKANAN BELUM DIMASAK (Pending): Kembalikan stok produk & bahan baku seperti biasa
        for (const item of orderData.items) {
          const uomRatio = Number((item as any).uomRatio) || 1;
          const restoredQty = (item.qty || 1) * uomRatio;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: restoredQty } }
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
                  tenantId,
                  outletId: orderData.outletId,
                  ingredientId: recipe.ingredientId,
                  change: restored,
                  type: 'Void',
                  description: `Void Order #${orderData.orderNumber}`,
                  referenceId: orderData.orderNumber,
                  userId: user?.id
                }
              });
            }
          }
        }
      }

      // 3. Batalkan Poin Loyalitas
      if (orderData.customerId) {
        const settings = await tx.settings.findFirst({ where: { tenantId } });
        const silverThreshold = settings ? settings.loyaltySilverThreshold : 1000000;
        const goldThreshold = settings ? settings.loyaltyGoldThreshold : 3000000;

        // Cari log penambahan poin (Earn) untuk order ini
        const earnLog = await tx.pointLog.findFirst({
          where: {
            tenantId,
            customerId: orderData.customerId,
            type: 'Earn',
            description: { contains: `Order #${orderData.orderNumber}` }
          }
        });

        if (earnLog) {
          const cust = await tx.customer.findUnique({ where: { id: orderData.customerId } });
          if (cust) {
            // Fix #4: Hapus Math.max(0,...) agar poin bisa negatif – mencegah points-farming fraud
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
                tenantId,
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
            tenantId,
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
                tenantId,
                customerId: orderData.customerId,
                points: refundPoints,
                type: 'Refund',
                description: `Void Order #${orderData.orderNumber}: Pengembalian poin diskon`
              }
            });
          }
        }
      }

      // 4. Auto-release status Meja utama dan meja gabungan jika tidak ada order aktif lain
      const releasedTableIds = await releaseTablesIfClear(
        tx,
        tenantId,
        orderData.tableId,
        orderData.joinedTableIds,
        [Number(id)]
      );

      // 5. Catat Pengeluaran Kas Refund jika pesanan sebelumnya sudah lunas (Paid) dengan Tunai atau Split Cash
      if (orderData.status === 'Paid') {
        const refundCash = getCashPortion(orderData.paymentMethod, orderData.total);
        if (refundCash > 0) {
          await tx.cashFlow.create({
            data: {
              tenantId,
              outletId: orderData.outletId,
              userId: user?.id || orderData.userId || 1,
              type: 'Pengeluaran',
              category: 'Refund Penjualan Tunai',
              amount: refundCash,
              description: `Pengembalian uang tunai (Refund) untuk Void Order #${orderData.orderNumber}`,
              date: new Date()
            }
          });
        }
      }

      // 6. Batalkan Piutang (Debt) yang terhubung jika order menggunakan metode Piutang
      const linkedDebt = await tx.debt.findFirst({
        where: {
          orderId: Number(id),
          tenantId
        },
        include: { payments: true }
      });

      if (linkedDebt) {
        await tx.debt.update({
          where: { id: linkedDebt.id },
          data: {
            status: 'Dibatalkan',
            remaining: 0,
            notes: (linkedDebt.notes ? linkedDebt.notes + ' | ' : '') + `Dibatalkan otomatis karena Void Order #${orderData.orderNumber}`
          }
        });
      }

      // 7. Pulihkan Kuota Voucher Promo jika order ini menggunakan voucher
      if (orderData.voucherId) {
        await tx.voucher.update({
          where: { id: orderData.voucherId },
          data: {
            usedCount: { decrement: 1 }
          }
        });
      }

      return { releasedTableIds };
    });

    // Emit real-time event ke room tenant terkait saja
    emitToTenant(tenantId, 'order:void', { orderId: Number(id), orderNumber: orderData.orderNumber });
    if (result?.releasedTableIds) {
      for (const tid of result.releasedTableIds) {
        emitToTenant(tenantId, 'table:update', { tableId: tid });
      }
    }

    // Audit Log: Order Void
    await AuditLogger.log({
      tenantId,
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

// POST Return / Retur Barang (Pengembalian Parsial atau Penuh + Pemulihan Stok & Refund) - Terisolasi per Tenant
router.post('/:id/return', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { items, reason, refundMethod } = req.body || {}; // items: Array<{ orderItemId: number, qty: number, condition: 'GOOD' | 'DAMAGED' }>
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu barang yang ingin diretur.' });
    }

    const orderData = await prisma.order.findFirst({
      where: { id: Number(id), tenantId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!orderData) return res.status(404).json({ error: 'Order tidak ditemukan' });
    if (orderData.status === 'Void') return res.status(400).json({ error: 'Order ini berstatus VOID dan tidak dapat diretur lagi' });

    let totalRefundAmount = 0;
    const returnSummary: Array<{ name: string; qty: number; uomName?: string; condition: string; amount: number }> = [];

    await prisma.$transaction(async (tx) => {
      for (const retItem of items) {
        const orderItem = orderData.items.find(i => i.id === Number(retItem.orderItemId));
        if (!orderItem) {
          throw new Error(`Item pesanan dengan ID ${retItem.orderItemId} tidak ditemukan pada faktur ini.`);
        }

        const returnQty = Math.max(1, Number(retItem.qty) || 1);
        if (returnQty > orderItem.qty) {
          throw new Error(`Kuantitas retur (${returnQty}) melebihi kuantitas pembelian (${orderItem.qty}) untuk produk ${orderItem.product?.name || ''}.`);
        }

        const unitPrice = orderItem.price || 0;
        const itemRefund = Math.round(unitPrice * returnQty);
        totalRefundAmount += itemRefund;

        const condition = retItem.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
        const uomRatio = Number(orderItem.uomRatio) || 1;
        const restoredBaseUnits = returnQty * uomRatio;

        // Periksa apakah produk merupakan Menu Olahan Dapur ber-resep (Kafe/Resto)
        const recipes = await tx.recipeItem.findMany({
          where: { productId: orderItem.productId },
          include: { ingredient: true }
        });

        const isRecipeItem = recipes.length > 0;

        if (isRecipeItem) {
          // KAFE: Makanan/minuman olahan yang sudah dibuat dilarang dipulihkan stok bahan bakunya (mencegah phantom inventory).
          // Sebaliknya, catat pemborosan / food waste di IngredientLog
          for (const recipe of recipes) {
            const usedQty = recipe.qtyPerServing * returnQty;
            const unitCost = recipe.ingredient?.buyPrice || 0;
            const ingLossCost = Math.round(usedQty * unitCost);

            await tx.ingredientLog.create({
              data: {
                tenantId,
                outletId: orderData.outletId,
                ingredientId: recipe.ingredientId,
                change: 0, // Bahan sudah terpakai saat masak, tidak dikembalikan ke stok aktif
                cost: ingLossCost,
                type: 'Rusak',
                reason: reason ? String(reason).trim() : 'Retur Menu Olahan Dapur (Food Waste)',
                description: `[Food Waste Retur] Faktur #${orderData.orderNumber} - Menu: ${orderItem.product?.name || ''} diretur (Bahan: ${recipe.ingredient?.name}, HPP: Rp ${ingLossCost.toLocaleString('id-ID')})`,
                referenceId: orderData.orderNumber,
                userId: user?.id
              }
            });
          }
        } else if (condition === 'GOOD') {
          // RETAIL / PRODUK KEMASAN: Kembalikan stok produk jika kondisi LAYAK JUAL
          await tx.product.update({
            where: { id: orderItem.productId },
            data: { stock: { increment: restoredBaseUnits } }
          });
        }

        // 2. Catat audit note pada OrderItem
        const existingNotes = orderItem.notes ? `${orderItem.notes} | ` : '';
        const cleanReason = reason ? String(reason).trim() : 'Retur Pelanggan';
        const noteTag = isRecipeItem 
          ? `[RETUR OLAHAN ${returnQty} ${orderItem.uomName || 'pcs'} - Food Waste Dapur - Alasan: ${cleanReason} - Rp ${itemRefund.toLocaleString('id-ID')}]`
          : `[RETUR ${returnQty} ${orderItem.uomName || 'pcs'} - Kondisi: ${condition === 'GOOD' ? 'Layak Jual' : 'Rusak'} - Alasan: ${cleanReason} - Rp ${itemRefund.toLocaleString('id-ID')}]`;
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            notes: `${existingNotes}${noteTag}`
          }
        });

        returnSummary.push({
          name: orderItem.product?.name || `Produk #${orderItem.productId}`,
          qty: returnQty,
          uomName: orderItem.uomName || 'pcs',
          condition,
          amount: itemRefund
        });
      }

      // 3. Rekonsiliasi Pengembalian Uang / Kas Laci Kasir (jika refundMethod === 'CASH' dan ada pengembalian)
      const selectedRefundMethod = refundMethod || (orderData.paymentMethod?.toLowerCase().includes('cash') || orderData.paymentMethod?.toLowerCase().includes('tunai') ? 'CASH' : 'OTHER');
      if (selectedRefundMethod === 'CASH' && totalRefundAmount > 0) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: orderData.outletId,
            userId: user?.id || orderData.userId || 1,
            type: 'Pengeluaran',
            category: 'Refund Retur Penjualan',
            amount: totalRefundAmount,
            description: `Refund tunai retur ${returnSummary.length} item untuk Faktur #${orderData.orderNumber} (Alasan: ${reason || 'Retur Pelanggan'})`,
            date: new Date()
          }
        });
      }

      // 4. Potong saldo Piutang / Bon Warung jika ada
      const linkedDebt = await tx.debt.findFirst({
        where: { orderId: Number(id), tenantId }
      });
      if (linkedDebt && linkedDebt.remaining > 0) {
        const debtDeduction = Math.min(linkedDebt.remaining, totalRefundAmount);
        const newRemaining = Math.max(0, linkedDebt.remaining - debtDeduction);
        await tx.debt.update({
          where: { id: linkedDebt.id },
          data: {
            remaining: newRemaining,
            status: newRemaining === 0 ? 'Lunas' : 'Belum Lunas',
            notes: (linkedDebt.notes ? linkedDebt.notes + ' | ' : '') + `Dipotong retur barang Rp ${debtDeduction.toLocaleString('id-ID')}`
          }
        });
      }

      // 5. Cek apakah seluruh item pesanan telah diretur 100%
      const totalOriginalItems = orderData.items.reduce((sum, i) => sum + i.qty, 0);
      const totalReturnedItems = returnSummary.reduce((sum, i) => sum + i.qty, 0);
      if (totalReturnedItems >= totalOriginalItems) {
        await tx.order.update({
          where: { id: Number(id) },
          data: { status: 'Void' }
        });
      }
    });

    // Realtime notification & audit
    emitToTenant(tenantId, 'order:return', {
      orderId: Number(id),
      orderNumber: orderData.orderNumber,
      totalRefund: totalRefundAmount,
      items: returnSummary
    });

    await AuditLogger.log({
      tenantId,
      action: 'ORDER_RETURN',
      resource: 'ORDER',
      resourceId: String(orderData.id),
      description: `Retur ${returnSummary.length} produk pada faktur #${orderData.orderNumber} senilai Rp ${totalRefundAmount.toLocaleString('id-ID')}. Alasan: ${reason || 'Retur Pelanggan'}.`,
      severity: 'WARNING'
    }, req);

    res.json({
      success: true,
      message: 'Retur barang berhasil diproses dan data stok telah diperbarui',
      orderNumber: orderData.orderNumber,
      returnNumber: `RET-${orderData.orderNumber}`,
      totalRefund: totalRefundAmount,
      items: returnSummary
    });
  } catch (error: any) {
    console.error('Return Order Error:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses retur barang' });
  }
});

// POST Split Order (Pecah bill meja) - Terisolasi per Tenant
router.post('/split', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tableId, splitItems } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const outletId = user?.outletId || TenantContext.getOutletId();
    const userId = user?.id || 1;

    if (!tableId || !splitItems || !Array.isArray(splitItems) || splitItems.length === 0) {
      return res.status(400).json({ error: 'Parameter tableId dan splitItems tidak valid' });
    }

    // Ambil setting pajak dan service charge milik tenant
    const settings = await prisma.settings.findFirst({ where: { tenantId } });
    const taxRate = settings?.taxRate || 0;
    const serviceChargeRate = settings?.serviceCharge || 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat order baru untuk split bill
      const orderNumber = await generateOrderNumber(tenantId);
      
      // Ambil detail customer dari order pertama di meja ini
      const firstActiveOrder = await tx.order.findFirst({
        where: { 
          tableId: Number(tableId), 
          status: 'Pending',
          tenantId
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
          tenantId,
          outletId,
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

        if (!item || (item.tenantId && item.tenantId !== tenantId) || (item.order && item.order.tenantId !== tenantId)) {
          throw new Error(`Item dengan ID ${orderItemId} tidak ditemukan atau bukan milik tenant ini`);
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
              tenantId,
              outletId,
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
        where: { 
          tableId: Number(tableId), 
          status: 'Pending', 
          id: { not: newOrder.id },
          tenantId
        },
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

    emitToTenant(tenantId, 'order:new', { message: 'Split order created', orderId: result.id });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Split Order Error:', error);
    res.status(500).json({ error: error.message || 'Gagal membagi pesanan' });
  }
});

// POST Move Table (Pindah Meja) - Terisolasi per Tenant
router.post('/move-table', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceTableId, targetTableId } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!sourceTableId || !targetTableId) {
      return res.status(400).json({ error: 'Parameter sourceTableId dan targetTableId wajib diisi' });
    }

    const sId = Number(sourceTableId);
    const tId = Number(targetTableId);

    if (sId === tId) {
      return res.status(400).json({ error: 'Meja asal dan meja tujuan tidak boleh sama' });
    }

    // Validasi kepemilikan meja asal dan meja tujuan
    const [sTable, tTable] = await Promise.all([
      prisma.table.findFirst({ where: { id: sId, tenantId } }),
      prisma.table.findFirst({ where: { id: tId, tenantId } })
    ]);
    if (!sTable || !tTable) {
      return res.status(404).json({ error: 'Meja asal atau meja tujuan tidak ditemukan atau bukan milik tenant ini' });
    }

    // 1. Pastikan meja tujuan aktif & kosong (tidak ada order dengan status Pending atau Paid aktif di tenant ini)
    const allActiveOrders = await prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          { status: 'Pending' },
          {
            status: 'Paid',
            kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }
          }
        ]
      },
      select: { id: true, tableId: true, joinedTableIds: true }
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

    // 4. Emit socket event ke room tenant terkait saja
    emitToTenant(tenantId, 'order:new', { message: 'Table moved', sourceTableId: sId, targetTableId: tId });
    emitToTenant(tenantId, 'order:paid', { sourceTableId: sId, targetTableId: tId });
    emitToTenant(tenantId, 'kds:statusChanged', { message: 'Table moved KDS' });

    res.json({ message: 'Meja berhasil dipindahkan', movedCount: sourceActiveOrders.length });
  } catch (error: any) {
    console.error('Move Table Error:', error);
    res.status(500).json({ error: error.message || 'Gagal memindahkan meja' });
  }
});

// POST Merge Table (Gabung Meja) - Terisolasi per Tenant
router.post('/merge-table', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourceTableId, targetTableId } = req.body;
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!sourceTableId || !targetTableId) {
      return res.status(400).json({ error: 'Parameter sourceTableId dan targetTableId wajib diisi' });
    }

    const sId = Number(sourceTableId);
    const tId = Number(targetTableId);

    if (sId === tId) {
      return res.status(400).json({ error: 'Meja asal dan meja tujuan tidak boleh sama' });
    }

    // Validasi kepemilikan meja asal dan meja tujuan
    const [sourceTableCheck, targetTableCheck] = await Promise.all([
      prisma.table.findFirst({ where: { id: sId, tenantId } }),
      prisma.table.findFirst({ where: { id: tId, tenantId } })
    ]);
    if (!sourceTableCheck || !targetTableCheck) {
      return res.status(404).json({ error: 'Meja asal atau meja tujuan tidak ditemukan atau bukan milik tenant ini' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cari semua order aktif milik tenant
      const allActiveOrders = await tx.order.findMany({
        where: {
          tenantId,
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

      // Jika meja tujuan juga ada pesanan, gabungkan: update tableId source order ke targetTableId
      await tx.order.updateMany({
        where: { id: { in: sourceActiveOrders.map(o => o.id) } },
        data: { tableId: tId }
      });

      return { type: 'merge', count: sourceActiveOrders.length };
    });

    // 5. Emit socket events ke room tenant terkait saja
    emitToTenant(tenantId, 'order:new', { message: 'Table merged', sourceTableId: sId, targetTableId: tId });
    emitToTenant(tenantId, 'order:paid', { sourceTableId: sId, targetTableId: tId });
    emitToTenant(tenantId, 'kds:statusChanged', { message: 'Table merged KDS' });

    res.json({ 
      message: result.type === 'move' ? 'Meja berhasil dipindahkan' : 'Meja berhasil digabungkan', 
      type: result.type 
    });
  } catch (error: any) {
    console.error('Merge Table Error:', error);
    res.status(500).json({ error: error.message || 'Gagal menggabungkan meja' });
  }
});

// ─── POST /api/orders/sync-queue: High-Concurrency Background Sync via BullMQ ───
router.post('/sync-queue', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const userId = user?.id || 1;
    const outletId = user?.outletId || TenantContext.getOutletId();
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Payload orders harus berupa array dan tidak boleh kosong' });
    }

    const result = await enqueueOfflineOrdersBatch(tenantId, outletId, userId, orders);

    return res.status(202).json({
      success: true,
      status: 'QUEUED',
      batchId: result.batchId,
      totalQueued: result.totalEnqueued,
      message: `Sebanyak ${result.totalEnqueued} transaksi offline sedang diproses di antrean latar belakang.`
    });
  } catch (error: any) {
    console.error('[SyncQueue Error]:', error);
    return res.status(500).json({ error: error.message || 'Gagal mendaftarkan antrean sinkronisasi' });
  }
});

// ─── POST /api/orders/sync-offline: Idempotent Batch Sync from Offline POS ───
router.post('/sync-offline', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const userId = user?.id || 1;
    const outletId = user?.outletId || TenantContext.getOutletId();
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Payload orders harus berupa array dan tidak boleh kosong' });
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const ord of orders) {
      try {
        if (!ord.offlineId) {
          errors.push(`Order tanpa offlineId dilewati`);
          continue;
        }

        // Check if this offlineId was already synced (Idempotency)
        const existingOrder = await prisma.order.findFirst({
          where: {
            tenantId,
            offlineId: ord.offlineId,
          },
        });

        if (existingOrder) {
          skippedCount++;
          continue;
        }

        // Generate unique orderNumber if offline orderNumber collides
        let finalOrderNumber = ord.orderNumber || `ORD-${Date.now()}`;
        const existingNumber = await prisma.order.findFirst({
          where: { tenantId, orderNumber: finalOrderNumber }
        });
        if (existingNumber) {
          finalOrderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        }

        const clientDate = ord.clientTimestamp ? new Date(ord.clientTimestamp) : new Date();

        await prisma.$transaction(async (tx) => {
          // 1. Walk-in Customer Auto-Link & Upsert
          let finalCustomerId: number | null = null;
          const custPhone = ord.customerPhone ? String(ord.customerPhone).trim() : null;
          const custName = ord.customerName ? String(ord.customerName).trim() : 'Pelanggan Walk-In';
          const orderTotal = Number(ord.total || 0);

          if (custPhone) {
            let existingCust = await tx.customer.findFirst({
              where: { tenantId, phone: custPhone }
            });

            if (!existingCust && custName) {
              existingCust = await tx.customer.create({
                data: {
                  tenantId,
                  outletId: ord.outletId || outletId,
                  name: custName,
                  phone: custPhone,
                  points: Math.floor(orderTotal / 1000), // 1 poin per Rp 1.000 belanja
                  tier: 'Bronze',
                  totalSpent: orderTotal
                }
              });
            } else if (existingCust) {
              await tx.customer.update({
                where: { id: existingCust.id },
                data: {
                  totalSpent: existingCust.totalSpent + orderTotal,
                  points: existingCust.points + Math.floor(orderTotal / 1000)
                }
              });
            }

            if (existingCust) {
              finalCustomerId = existingCust.id;
            }
          }

          // 2. Create Order
          const createdOrder = await tx.order.create({
            data: {
              tenantId,
              outletId: ord.outletId || outletId,
              orderNumber: finalOrderNumber,
              offlineId: ord.offlineId,
              customerName: custName,
              customerPhone: custPhone,
              customerId: finalCustomerId,
              tableId: ord.tableId ? Number(ord.tableId) : null,
              userId: Number(userId),
              subtotal: Number(ord.subtotal || 0),
              discount: Number(ord.discount || 0),
              tax: Number(ord.tax || 0),
              serviceCharge: Number(ord.service || ord.serviceCharge || 0),
              total: orderTotal,
              paymentMethod: ord.paymentMethod || 'Cash',
              status: ord.status || 'Paid',
              kdsStatus: (ord.status === 'Pending') ? 'Pending' : 'Served',
              paidAt: (ord.status === 'Pending') ? null : clientDate,
              createdAt: clientDate,
            } as any,
          });

          // 3. Create OrderItems & Soft Stock Deduction (Allow Negative Stock + Audit Warning)
          if (Array.isArray(ord.items) && ord.items.length > 0) {
            for (const itm of ord.items) {
              const pId = Number(itm.productId);
              const qty = Number(itm.quantity || itm.qty || 1);
              const price = Number(itm.price || 0);

              await tx.orderItem.create({
                data: {
                  tenantId,
                  outletId: ord.outletId || outletId,
                  orderId: createdOrder.id,
                  productId: pId,
                  qty,
                  price,
                  subtotal: price * qty,
                  notes: itm.notes || '',
                  uomName: itm.uomName || null,
                  uomRatio: itm.uomRatio ? Number(itm.uomRatio) : null,
                  priceTierName: itm.priceTierName || null,
                },
              });

              // Soft stock deduction with negative stock tolerance
              try {
                const prod = await tx.product.findFirst({ where: { id: pId, tenantId } });
                if (prod) {
                  const currentProdStock = prod.stock ?? 0;
                  const uomRatio = Number(itm.uomRatio) || 1;
                  const totalBaseUnitQty = qty * uomRatio;
                  const newProdStock = currentProdStock - totalBaseUnitQty;

                  await tx.product.update({
                    where: { id: pId },
                    data: { stock: newProdStock },
                  });

                  if (newProdStock < 0) {
                    await AuditLogger.log({
                      tenantId,
                      outletId: ord.outletId || outletId,
                      userId: Number(userId),
                      action: 'NEGATIVE_STOCK_WARNING',
                      resource: 'INVENTORY',
                      resourceId: String(pId),
                      severity: 'WARNING',
                      description: `Stok produk "${prod.name}" menjadi minus (${newProdStock}) akibat sinkronisasi offline order ${finalOrderNumber}. Diperlukan stok opname fisik.`,
                      oldValue: JSON.stringify({ stock: currentProdStock }),
                      newValue: JSON.stringify({ stock: newProdStock })
                    });
                  }

                  // Recipe ingredients deduction
                  const recipeItems = await tx.recipeItem.findMany({
                    where: { productId: pId },
                    include: { ingredient: { select: { id: true, name: true, stock: true, unit: true } } }
                  });

                  for (const r of recipeItems) {
                    const ing = r.ingredient;
                    if (ing) {
                      const usedIng = r.qtyPerServing * qty;
                      const currentIngStock = ing.stock ?? 0;
                      const newIngStock = currentIngStock - usedIng;

                      await tx.ingredient.update({
                        where: { id: r.ingredientId },
                        data: { stock: newIngStock },
                      });

                      await tx.ingredientLog.create({
                        data: {
                          tenantId,
                          ingredientId: r.ingredientId,
                          change: -usedIng,
                          type: 'Produksi',
                          description: `Order ${finalOrderNumber} (Sync Offline)`,
                          referenceId: finalOrderNumber
                        }
                      });

                      if (newIngStock < 0) {
                        await AuditLogger.log({
                          tenantId,
                          outletId: ord.outletId || outletId,
                          userId: Number(userId),
                          action: 'NEGATIVE_STOCK_WARNING',
                          resource: 'INGREDIENT',
                          resourceId: String(r.ingredientId),
                          severity: 'WARNING',
                          description: `Stok bahan baku "${ing.name}" menjadi minus (${newIngStock} ${ing.unit || ''}) akibat sinkronisasi offline order ${finalOrderNumber}. Diperlukan stok opname fisik.`,
                          oldValue: JSON.stringify({ stock: currentIngStock }),
                          newValue: JSON.stringify({ stock: newIngStock })
                        });
                      }
                    }
                  }
                }
              } catch (stockErr) {
                console.warn('[Offline Sync] Soft stock deduction error:', stockErr);
              }
            }
          }

          // 4. Table Conflict Resolution & Status Management
          const targetTableId = ord.tableId ? Number(ord.tableId) : null;
          if (targetTableId) {
            try {
              const table = await tx.table.findFirst({
                where: { id: targetTableId, tenantId }
              });

              if (table) {
                const isOrderPaid = (ord.status === 'Paid' || !ord.status);
                if (isOrderPaid) {
                  // Cek apakah ada order lain yang masih pending/unpaid di meja ini
                  const remainingPendingOrder = await tx.order.findFirst({
                    where: {
                      tenantId,
                      tableId: targetTableId,
                      status: 'Pending',
                      id: { not: createdOrder.id }
                    }
                  });

                  if (!remainingPendingOrder && table.status === 'Terisi') {
                    await tx.table.update({
                      where: { id: targetTableId },
                      data: { status: 'Kosong' }
                    });
                  }
                } else if (ord.status === 'Pending') {
                  // Jika order offline berstatus Pending, tandai meja sebagai Terisi
                  if (table.status !== 'Terisi') {
                    await tx.table.update({
                      where: { id: targetTableId },
                      data: { status: 'Terisi' }
                    });
                  }
                }
              }
            } catch (tableErr) {
              console.warn('[Offline Sync] Table status sync error:', tableErr);
            }
          }

          // 5. Record Cashflow
          try {
            await tx.cashFlow.create({
              data: {
                tenantId,
                outletId: ord.outletId || outletId,
                userId: Number(userId),
                type: 'Pemasukan',
                category: 'Penjualan POS (Offline Sync)',
                amount: orderTotal,
                description: `Transaksi ${finalOrderNumber} (Sync dari Offline ID: ${ord.offlineId})`,
                date: clientDate,
              },
            });
          } catch (cfErr) {
            console.warn('[Offline Sync] Cashflow log error:', cfErr);
          }

          // 6. Audit Log
          try {
            await AuditLogger.log({
              tenantId,
              outletId: ord.outletId || outletId,
              userId: Number(userId),
              userName: user?.username || 'Kasir',
              userRole: user?.role || 'CASHIER',
              action: 'OFFLINE_ORDER_SYNC',
              resource: 'ORDER',
              resourceId: String(createdOrder.id),
              description: `Sinkronisasi transaksi offline ${finalOrderNumber} senilai Rp ${orderTotal.toLocaleString('id-ID')}`,
            });
          } catch (_) {}
        });

        syncedCount++;
      } catch (orderErr: any) {
        console.error(`[Offline Sync] Error syncing order ${ord.offlineId}:`, orderErr);
        errors.push(`${ord.offlineId}: ${orderErr.message}`);
      }
    }

    // Broadcast socket updates to tenant room only
    if (syncedCount > 0) {
      emitToTenant(tenantId, 'order:new', { message: `${syncedCount} transaksi offline disinkronkan` });
      emitToTenant(tenantId, 'order:paid', { message: 'Offline sync completed' });
    }

    res.json({
      success: true,
      syncedCount,
      skippedCount,
      errors,
      message: `Berhasil menyinkronkan ${syncedCount} transaksi (${skippedCount} sudah ada sebelumnya).`,
    });
  } catch (err: any) {
    console.error('Batch Offline Order Sync Error:', err);
    res.status(500).json({ error: err.message || 'Gagal memproses sinkronisasi transaksi offline' });
  }
});

export default router;
