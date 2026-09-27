import prisma from '../db';
import { emitToTenant } from '../index';
import { AuditLogger } from '../services/AuditLogger';
import { cacheService } from '../services/CacheService';
import { queueManager } from '../queues/queueManager';
import { SYNC_QUEUE_NAME, OfflineOrderJobData } from '../queues/syncQueue';

/**
 * Worker processor for individual offline orders.
 * Handles customer auto-linking, atomic inventory reduction, cash flow recording,
 * and Socket.IO real-time progress emissions.
 */
export async function processOfflineOrderJob(job: { id?: string; name: string; data: OfflineOrderJobData }) {
  const { tenantId, outletId, userId, order: ord, batchId, orderIndex, totalInBatch } = job.data;

  if (!ord || !tenantId) {
    throw new Error('Invalid offline order data or missing tenant context');
  }

  // Idempotency check: Skip if already synced
  if (ord.offlineId) {
    const existing = await prisma.order.findFirst({
      where: { tenantId, offlineId: ord.offlineId }
    });
    if (existing) {
      console.log(`[SyncWorker] Order ${ord.offlineId} sudah pernah disinkronkan, lewati.`);
      emitProgress(tenantId, batchId, orderIndex + 1, totalInBatch, ord.offlineId, 'SKIPPED');
      return { status: 'SKIPPED', orderId: existing.id };
    }
  }

  // Determine unique order number
  let finalOrderNumber = ord.orderNumber || `ORD-${Date.now()}`;
  const existingNumber = await prisma.order.findFirst({
    where: { tenantId, orderNumber: finalOrderNumber }
  });
  if (existingNumber) {
    finalOrderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  }

  const clientDate = ord.clientTimestamp ? new Date(ord.clientTimestamp) : new Date();
  const orderTotal = Number(ord.total || 0);

  // Execute database transaction
  const syncedOrder = await prisma.$transaction(async (tx) => {
    // 1. Customer Upsert & Points
    let finalCustomerId: number | null = null;
    const custPhone = ord.customerPhone ? String(ord.customerPhone).trim() : null;
    const custName = ord.customerName ? String(ord.customerName).trim() : 'Pelanggan Walk-In';

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
            points: Math.floor(orderTotal / 1000),
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
        offlineId: ord.offlineId || null,
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
        kdsStatus: ord.status === 'Pending' ? 'Pending' : 'Served',
        paidAt: ord.status === 'Pending' ? null : clientDate,
        createdAt: clientDate
      } as any
    });

    // 3. Create OrderItems & Inventory Reductions
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
            notes: itm.notes || ''
          }
        });

        // Soft stock deduction
        try {
          const prod = await tx.product.findFirst({ where: { id: pId, tenantId } });
          if (prod) {
            const currentStock = prod.stock ?? 0;
            const newStock = currentStock - qty;

            await tx.product.update({
              where: { id: pId },
              data: { stock: newStock }
            });

            // Recipe deduction
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
                  data: { stock: newIngStock }
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
              }
            }
          }
        } catch (stockErr) {
          console.warn('[SyncWorker] Soft stock deduction error:', stockErr);
        }
      }
    }

    // 4. Record CashFlow if Paid
    if (createdOrder.status === 'Paid') {
      await tx.cashFlow.create({
        data: {
          tenantId,
          outletId: ord.outletId || outletId,
          userId: Number(userId),
          type: 'Pemasukan',
          category: 'Penjualan',
          amount: orderTotal,
          paymentMethod: createdOrder.paymentMethod || 'Cash',
          referenceId: String(createdOrder.id),
          description: `Transaksi ${finalOrderNumber} (Sync dari Offline ID: ${ord.offlineId || '-'})`,
          createdAt: clientDate
        }
      });
    }

    return createdOrder;
  }, {
    maxWait: 10000,
    timeout: 20000
  });

  // Invalidate cached catalog stock
  cacheService.bumpTenantCatalogVersion(tenantId).catch(() => {});

  // Emit progress to tenant room
  emitProgress(tenantId, batchId, orderIndex + 1, totalInBatch, ord.offlineId, 'COMPLETED');

  // If this was the last order in batch, emit batch completion
  if (orderIndex + 1 === totalInBatch) {
    emitToTenant(tenantId, 'sync:completed', {
      batchId,
      totalSynced: totalInBatch,
      message: `Semua ${totalInBatch} transaksi offline berhasil disinkronkan ke server cloud.`
    });
  }

  return { status: 'COMPLETED', orderId: syncedOrder.id, orderNumber: finalOrderNumber };
}

function emitProgress(tenantId: string, batchId: string, completedIndex: number, totalInBatch: number, offlineId?: string, status = 'COMPLETED') {
  const percent = Math.round((completedIndex / totalInBatch) * 100);
  emitToTenant(tenantId, 'sync:progress', {
    batchId,
    completed: completedIndex,
    total: totalInBatch,
    percent,
    lastOfflineId: offlineId,
    lastStatus: status
  });
}

/**
 * Register SyncWorker with QueueManager
 */
export function registerSyncWorker(): void {
  queueManager.registerWorker(SYNC_QUEUE_NAME, processOfflineOrderJob, {
    concurrency: 5
  });
}
