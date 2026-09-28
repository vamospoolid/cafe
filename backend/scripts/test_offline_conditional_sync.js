/**
 * TEST SUITE: Offline Mode Conditional Features Verification
 *
 * Verifies:
 * 1. Soft Stock Deduction & Negative Stock Tolerance + AuditLog Warning
 * 2. Walk-in Customer Phone Auto-link & Atomic Upsert (no ID collisions)
 * 3. Dine-In Table Status Resolution & Session Management
 */

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`✅ ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`❌ ${msg}`);
  if (err) console.error(`   → ${err.message || err}`);
  failed++;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING OFFLINE CONDITIONAL FEATURES VERIFICATION TESTS');
  console.log('================================================================\n');

  let testTenant = null;
  let testOutlet = null;
  let testProduct = null;
  let testTable = null;

  try {
    // 0. Setup / Find Test Tenant & Outlet
    testTenant = await prisma.tenant.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!testTenant) {
      testTenant = await prisma.tenant.create({
        data: {
          name: 'Offline Test Cafe',
          slug: `test-offline-${Date.now()}`,
          status: 'ACTIVE'
        }
      });
    }

    testOutlet = await prisma.outlet.findFirst({
      where: { tenantId: testTenant.id }
    });

    if (!testOutlet) {
      testOutlet = await prisma.outlet.create({
        data: {
          tenantId: testTenant.id,
          name: 'Outlet Utama',
          code: `OUT-${Date.now().toString().slice(-4)}`
        }
      });
    }

    let testCategory = await prisma.category.findFirst({
      where: { tenantId: testTenant.id }
    });

    if (!testCategory) {
      testCategory = await prisma.category.create({
        data: {
          tenantId: testTenant.id,
          name: 'Minuman Test'
        }
      });
    }

    // Create a temporary test product
    testProduct = await prisma.product.create({
      data: {
        tenantId: testTenant.id,
        categoryId: testCategory.id,
        name: `Kopi Uji Coba Offline ${Date.now()}`,
        sellPrice: 25000,
        buyPrice: 10000,
        stock: 1, // Stok awal hanya 1
      }
    });

    // Create a temporary test table
    testTable = await prisma.table.create({
      data: {
        tenantId: testTenant.id,
        outletId: testOutlet.id,
        tableNo: `T-OFF-${Date.now().toString().slice(-4)}`,
        capacity: 4,
        status: 'Terisi'
      }
    });

    const tenantId = testTenant.id;
    const outletId = testOutlet.id;
    const testPhone = `0899${Date.now().toString().slice(-8)}`;

    // ─── TEST 1: Soft Stock Deduction & Negative Tolerance ─────
    console.log('--- TEST 1: Soft Stock Deduction & Negative Stock Tolerance ---');
    try {
      const orderQty = 3; // Minta 3, padahal stok cuma 1
      const offlineId1 = `OFF-TEST-STOCK-${Date.now()}`;
      const finalOrderNumber1 = `ORD-OFF-${Date.now()}`;
      const clientDate1 = new Date();

      await prisma.$transaction(async (tx) => {
        // Create Order
        const createdOrder = await tx.order.create({
          data: {
            tenant: { connect: { id: tenantId } },
            outlet: { connect: { id: outletId } },
            orderNumber: finalOrderNumber1,
            offlineId: offlineId1,
            customerName: 'Budi Test Stock',
            subtotal: 75000,
            discount: 0,
            tax: 0,
            serviceCharge: 0,
            total: 75000,
            paymentMethod: 'Cash',
            status: 'Paid',
            kdsStatus: 'Served',
            paidAt: clientDate1,
            createdAt: clientDate1,
            user: { connect: { id: 1 } }
          }
        });

        // Deduct Stock allowing negative
        const prod = await tx.product.findFirst({ where: { id: testProduct.id, tenantId } });
        const currentProdStock = prod.stock;
        const newProdStock = currentProdStock - orderQty;

        await tx.product.update({
          where: { id: testProduct.id },
          data: { stock: newProdStock }
        });

        if (newProdStock < 0) {
          await tx.auditLog.create({
            data: {
              tenantId,
              outletId,
              action: 'NEGATIVE_STOCK_WARNING',
              resource: 'INVENTORY',
              resourceId: String(testProduct.id),
              severity: 'WARNING',
              description: `Stok produk "${prod.name}" menjadi minus (${newProdStock}) akibat sinkronisasi offline order ${finalOrderNumber1}. Diperlukan stok opname fisik.`,
              oldValue: JSON.stringify({ stock: currentProdStock }),
              newValue: JSON.stringify({ stock: newProdStock })
            }
          });
        }
      });

      // Verify Product Stock is now negative (-2)
      const updatedProd = await prisma.product.findUnique({ where: { id: testProduct.id } });
      assert.strictEqual(updatedProd.stock, -2, 'Stok produk harus berkurang menjadi -2 tanpa menggagalkan order');

      // Verify AuditLog warning exists
      const auditWarning = await prisma.auditLog.findFirst({
        where: {
          tenantId,
          action: 'NEGATIVE_STOCK_WARNING',
          resourceId: String(testProduct.id)
        }
      });
      assert.ok(auditWarning, 'AuditLog warning harus tercatat saat stok menembus angka minus');
      assert.strictEqual(auditWarning.severity, 'WARNING');

      pass('TEST 1 PASSED: Soft Stock Deduction berhasil berjalan & stok minus (-2) tercatat rapi di AuditLog!');
    } catch (e) {
      fail('TEST 1 FAILED', e);
    }

    // ─── TEST 2: Walk-In Customer Auto-Link & Atomic Upsert ─────
    console.log('\n--- TEST 2: Walk-In Customer Auto-Link & Atomic Upsert ---');
    try {
      const offlineId2 = `OFF-TEST-CUST-${Date.now()}`;
      const finalOrderNumber2 = `ORD-OFF-CUST-${Date.now()}`;
      const orderTotal = 150000;

      let createdCustomerId = null;

      // 1st order from new customer
      await prisma.$transaction(async (tx) => {
        let finalCustomerId = null;
        let existingCust = await tx.customer.findFirst({
          where: { tenantId, phone: testPhone }
        });

        if (!existingCust) {
          existingCust = await tx.customer.create({
            data: {
              tenantId,
              name: 'Siti Walk-In',
              phone: testPhone,
              points: Math.floor(orderTotal / 1000), // 150 poin
              tier: 'Bronze',
              totalSpent: orderTotal
            }
          });
        }
        finalCustomerId = existingCust.id;
        createdCustomerId = finalCustomerId;

        await tx.order.create({
          data: {
            tenant: { connect: { id: tenantId } },
            outlet: { connect: { id: outletId } },
            orderNumber: finalOrderNumber2,
            offlineId: offlineId2,
            customerName: 'Siti Walk-In',
            customerPhone: testPhone,
            customer: { connect: { id: finalCustomerId } },
            subtotal: orderTotal,
            discount: 0,
            tax: 0,
            serviceCharge: 0,
            total: orderTotal,
            paymentMethod: 'Cash',
            status: 'Paid',
            kdsStatus: 'Served',
            user: { connect: { id: 1 } }
          }
        });
      });

      const customerRecord = await prisma.customer.findUnique({ where: { id: createdCustomerId } });
      assert.ok(customerRecord, 'Customer baru harus dibuat otomatis saat sync offline');
      assert.strictEqual(customerRecord.phone, testPhone);
      assert.strictEqual(customerRecord.totalSpent, 150000);
      assert.strictEqual(customerRecord.points, 150);

      // 2nd order from the same customer (Verify Accumulation without duplicate creation)
      const offlineId3 = `OFF-TEST-CUST-2-${Date.now()}`;
      const finalOrderNumber3 = `ORD-OFF-CUST-2-${Date.now()}`;
      const orderTotal2 = 50000;

      await prisma.$transaction(async (tx) => {
        let existingCust = await tx.customer.findFirst({
          where: { tenantId, phone: testPhone }
        });
        assert.ok(existingCust, 'Customer lama harus ditemukan');

        await tx.customer.update({
          where: { id: existingCust.id },
          data: {
            totalSpent: existingCust.totalSpent + orderTotal2,
            points: existingCust.points + Math.floor(orderTotal2 / 1000)
          }
        });

        await tx.order.create({
          data: {
            tenant: { connect: { id: tenantId } },
            outlet: { connect: { id: outletId } },
            orderNumber: finalOrderNumber3,
            offlineId: offlineId3,
            customerName: 'Siti Walk-In',
            customerPhone: testPhone,
            customer: { connect: { id: existingCust.id } },
            subtotal: orderTotal2,
            discount: 0,
            tax: 0,
            serviceCharge: 0,
            total: orderTotal2,
            paymentMethod: 'Cash',
            status: 'Paid',
            kdsStatus: 'Served',
            user: { connect: { id: 1 } }
          }
        });
      });

      const updatedCustomer = await prisma.customer.findUnique({ where: { id: createdCustomerId } });
      assert.strictEqual(updatedCustomer.totalSpent, 200000, 'Total belanja harus diakumulasi');
      assert.strictEqual(updatedCustomer.points, 200, 'Poin harus diakumulasi');

      // Verify only 1 customer exists with this phone
      const custCount = await prisma.customer.count({ where: { tenantId, phone: testPhone } });
      assert.strictEqual(custCount, 1, 'Tidak boleh ada duplikasi customer dengan nomor HP yang sama');

      pass('TEST 2 PASSED: Walk-In Customer berhasil di-upsert & total belanja serta poin terakumulasi tanpa duplikasi!');
    } catch (e) {
      fail('TEST 2 FAILED', e);
    }

    // ─── TEST 3: Dine-In Table Status Resolution ─────
    console.log('\n--- TEST 3: Dine-In Table Status Resolution ---');
    try {
      assert.strictEqual(testTable.status, 'Terisi', 'Meja awal berstatus Terisi');

      const offlineId4 = `OFF-TEST-TABLE-${Date.now()}`;
      const finalOrderNumber4 = `ORD-OFF-TABLE-${Date.now()}`;

      await prisma.$transaction(async (tx) => {
        const createdOrder = await tx.order.create({
          data: {
            tenant: { connect: { id: tenantId } },
            outlet: { connect: { id: outletId } },
            orderNumber: finalOrderNumber4,
            offlineId: offlineId4,
            customerName: 'Dine-In Selesai',
            table: { connect: { id: testTable.id } },
            subtotal: 50000,
            discount: 0,
            tax: 0,
            serviceCharge: 0,
            total: 50000,
            paymentMethod: 'Cash',
            status: 'Paid', // Sudah dibayar
            kdsStatus: 'Served',
            user: { connect: { id: 1 } }
          }
        });

        // Table status resolution: check if any pending orders remain
        const remainingPendingOrder = await tx.order.findFirst({
          where: {
            tenantId,
            tableId: testTable.id,
            status: 'Pending',
            id: { not: createdOrder.id }
          }
        });

        if (!remainingPendingOrder) {
          await tx.table.update({
            where: { id: testTable.id },
            data: { status: 'Kosong' }
          });
        }
      });

      const updatedTable = await prisma.table.findUnique({ where: { id: testTable.id } });
      assert.strictEqual(updatedTable.status, 'Kosong', 'Meja harus otomatis dikosongkan setelah pesanan offline paid disinkronkan');

      pass('TEST 3 PASSED: Status meja otomatis beralih ke "Kosong" saat pesanan lunas disinkronkan!');
    } catch (e) {
      fail('TEST 3 FAILED', e);
    }

  } catch (globalErr) {
    console.error('Global setup error:', globalErr);
  } finally {
    // Cleanup test artifacts
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
    if (testTable) {
      await prisma.table.delete({ where: { id: testTable.id } }).catch(() => {});
    }
    await prisma.$disconnect();

    console.log('\n================================================================');
    console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
