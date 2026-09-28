/**
 * Test Suite: Phase 3 Tenant Operational Hardening
 * File: backend/scripts/test_phase3_tenant_hardening.js
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 3 TENANT OPERATIONAL HARDENING TESTS');
  console.log('================================================================\n');

  const tenantId = `tenant_p3_${Date.now()}`;
  const outletId = `outlet_p3_${Date.now()}`;
  let passed = 0;
  let total = 4;

  try {
    // 0. Setup Tenant, Outlet, User, Settings, Category
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Kafe Phase 3 Hardened',
        slug: `kafe-p3-${Date.now()}`,
        status: 'ACTIVE'
      }
    });

    await prisma.outlet.create({
      data: {
        id: outletId,
        tenantId,
        code: `OUT-P3-${Date.now().toString().slice(-4)}`,
        name: 'Outlet Utama Phase 3',
        address: 'Jl. Pengujian Phase 3'
      }
    });

    const user = await prisma.user.create({
      data: {
        name: 'Kasir Phase 3',
        username: `kasir_p3_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '["*"]',
        role: 'Super Admin',
        memberships: {
          create: { tenantId }
        }
      }
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'Super Admin', isPlatformAdmin: true, tenantId, outletId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId
    };

    await prisma.settings.create({
      data: {
        tenantId,
        storeName: 'Kafe Phase 3 Test',
        ingredientTrackingEnabled: true
      }
    });

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: 'Minuman Spesial P3'
      }
    });

    // Buka shift kasir untuk pengujian operasional
    const openShift = await prisma.shift.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        saldoAwal: 200000,
        waktuBuka: new Date(),
        status: 'Open'
      }
    });

    // -------------------------------------------------------------------------
    // TEST 1: Joined Tables Auto-Release on Payment & Void
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Auto-Release Meja Gabungan (Joined Tables) saat Bayar & Void ---');
    const table1 = await prisma.table.create({
      data: { tenantId, outletId, tableNo: `P3-01-${Date.now().toString().slice(-4)}`, status: 'Terisi' }
    });
    const table2 = await prisma.table.create({
      data: { tenantId, outletId, tableNo: `P3-02-${Date.now().toString().slice(-4)}`, status: 'Terisi' }
    });
    const table3 = await prisma.table.create({
      data: { tenantId, outletId, tableNo: `P3-03-${Date.now().toString().slice(-4)}`, status: 'Terisi' }
    });

    // Sub-test 1a: Payment releases primary + joined tables
    const orderPay = await prisma.order.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        orderNumber: `ORD-P3-JOIN-PAY-${Date.now().toString().slice(-4)}`,
        customerName: 'Tamu Meja Gabungan Bayar',
        tableId: table1.id,
        joinedTableIds: JSON.stringify([table2.id]),
        status: 'Pending',
        subtotal: 50000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 50000
      }
    });

    const responsePay = await fetch(`http://localhost:5000/api/orders/${orderPay.id}/payment`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        paymentMethod: 'Tunai',
        amountPaid: 50000
      })
    });

    if (!responsePay.ok) {
      const errText = await responsePay.text();
      throw new Error(`Payment API failed: ${responsePay.status} ${errText}`);
    }

    const refTable1 = await prisma.table.findUnique({ where: { id: table1.id } });
    const refTable2 = await prisma.table.findUnique({ where: { id: table2.id } });

    // Sub-test 1b: Void releases primary + joined tables
    const orderVoid = await prisma.order.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        orderNumber: `ORD-P3-JOIN-VOID-${Date.now().toString().slice(-4)}`,
        customerName: 'Tamu Meja Gabungan Void',
        tableId: table2.id,
        joinedTableIds: JSON.stringify([table3.id]),
        status: 'Pending',
        subtotal: 75000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 75000
      }
    });

    await prisma.table.update({ where: { id: table2.id }, data: { status: 'Terisi' } });
    await prisma.table.update({ where: { id: table3.id }, data: { status: 'Terisi' } });

    const responseVoid = await fetch(`http://localhost:5000/api/orders/${orderVoid.id}/void`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: 'Tamu membatalkan reservasi meja gabungan' })
    });

    if (!responseVoid.ok) {
      const errText = await responseVoid.text();
      throw new Error(`Void API failed: ${responseVoid.status} ${errText}`);
    }

    const voidTable2 = await prisma.table.findUnique({ where: { id: table2.id } });
    const voidTable3 = await prisma.table.findUnique({ where: { id: table3.id } });

    if (
      refTable1.status === 'Kosong' &&
      refTable2.status === 'Kosong' &&
      voidTable2.status === 'Kosong' &&
      voidTable3.status === 'Kosong'
    ) {
      console.log('✅ TEST 1 PASSED: Seluruh meja gabungan (joinedTableIds) berhasil ter-release otomatis ke status "Kosong" saat Bayar & Void.\n');
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED: Meja gabungan tidak ter-release dengan benar.', {
        payTable1: refTable1.status,
        payTable2: refTable2.status,
        voidTable2: voidTable2.status,
        voidTable3: voidTable3.status
      });
    }

    console.log('--- TEST 2: Pencatatan Pengeluaran Kas Refund saat Void Pesanan Lunas Tunai ---');
    const paidOrder = await prisma.order.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        orderNumber: `ORD-P3-REFUND-${Date.now().toString().slice(-4)}`,
        customerName: 'Tamu Lunas Refund Tunai',
        status: 'Paid',
        paymentMethod: 'Tunai',
        subtotal: 45000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 45000,
        paidAt: new Date()
      }
    });

    // Void pesanan lunas tunai tersebut via API
    const voidRefundRes = await fetch(`http://localhost:5000/api/orders/${paidOrder.id}/void`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: 'Salah input menu oleh kasir' })
    });

    if (!voidRefundRes.ok) {
      const errText = await voidRefundRes.text();
      throw new Error(`Void Refund API failed: ${voidRefundRes.status} ${errText}`);
    }

    // Cek record CashFlow yang tercatat
    const refundCashFlow = await prisma.cashFlow.findFirst({
      where: {
        tenantId,
        type: 'Pengeluaran',
        category: 'Refund Penjualan Tunai',
        amount: 45000
      }
    });

    // Cek laporan shift /api/shifts/current-summary
    const shiftRes = await fetch(`http://localhost:5000/api/shifts/current-summary`, {
      headers
    });
    const shiftData = await shiftRes.json();

    if (
      refundCashFlow &&
      refundCashFlow.amount === 45000 &&
      shiftData.manualCashOut >= 45000
    ) {
      console.log(`✅ TEST 2 PASSED: CashFlow Refund tercatat Rp ${refundCashFlow.amount.toLocaleString('id-ID')} dan masuk ke manualCashOut shift kasir (${shiftData.manualCashOut}). Laci fisik konsisten!\n`);
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Refund tidak tercatat di CashFlow atau shift kasir.', {
        refundCashFlow,
        shiftManualCashOut: shiftData.manualCashOut
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Pencatatan Buku Kas untuk Pelunasan Piutang Non-Tunai
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: Pencatatan Buku Kas untuk Pelunasan Piutang Non-Tunai (QRIS/Bank) ---');
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Pelanggan Piutang P3',
        phone: `08123${Date.now().toString().slice(-6)}`
      }
    });

    const debt = await prisma.debt.create({
      data: {
        tenantId,
        customerId: customer.id,
        amount: 100000,
        remaining: 100000,
        status: 'Belum Lunas',
        dueDate: new Date(Date.now() + 86400000 * 7)
      }
    });

    // Pelunasan piutang via QRIS
    const debtPayRes = await fetch(`http://localhost:5000/api/debts/${debt.id}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amountPaid: 60000,
        paymentMethod: 'QRIS'
      })
    });

    if (!debtPayRes.ok) {
      const errText = await debtPayRes.text();
      throw new Error(`Debt Payment API failed: ${debtPayRes.status} ${errText}`);
    }

    const nonCashCashFlow = await prisma.cashFlow.findFirst({
      where: {
        tenantId,
        category: 'Pembayaran Piutang - Non-Tunai',
        amount: 60000
      }
    });

    // Shift check: verify EXCLUDED_SHIFT_CASH_CATEGORIES ignores this from manual physical cash
    const shiftRes2 = await fetch(`http://localhost:5000/api/shifts/current-summary`, {
      headers
    });
    const shiftData2 = await shiftRes2.json();

    if (
      nonCashCashFlow &&
      nonCashCashFlow.amount === 60000 &&
      shiftData2.manualCashIn === 0 // Non-tunai piutang tidak mencemari kas manual laci
    ) {
      console.log(`✅ TEST 3 PASSED: CashFlow '${nonCashCashFlow.category}' tercatat Rp ${nonCashCashFlow.amount.toLocaleString('id-ID')} dan laci fisik kasir tidak double-counting (manualCashIn = 0).\n`);
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED: Pelunasan piutang non-tunai gagal tercatat atau mencemari laci fisik.', {
        nonCashCashFlow,
        manualCashIn: shiftData2.manualCashIn
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Perekaman HPP Riil Menu Resep pada OrderItem.buyPrice
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: Perekaman HPP Riil Menu Resep pada OrderItem.buyPrice ---');
    // Buat bahan baku dengan harga beli akurat
    const ingredientCoffee = await prisma.ingredient.create({
      data: {
        tenantId,
        name: `Biji Kopi Arabika P3 ${Date.now().toString().slice(-4)}`,
        unit: 'gram',
        stock: 5000,
        buyPrice: 300 // Rp 300 / gram
      }
    });

    const ingredientMilk = await prisma.ingredient.create({
      data: {
        tenantId,
        name: `Fresh Milk P3 ${Date.now().toString().slice(-4)}`,
        unit: 'ml',
        stock: 10000,
        buyPrice: 20 // Rp 20 / ml
      }
    });

    // Buat produk dengan buyPrice = 0 (karena olahan dapur/bar resep), tapi punya RecipeItem
    // Resep: 20 gram kopi (20 * 300 = 6000) + 150 ml susu (150 * 20 = 3000) -> Total HPP = 9000
    const recipeProduct = await prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: `Signature Latte P3 ${Date.now().toString().slice(-4)}`,
        sellPrice: 28000,
        buyPrice: 0, // diisi 0 oleh kasir/owner karena bahan terurai
        stock: 0,
        recipes: {
          create: [
            { ingredientId: ingredientCoffee.id, qtyPerServing: 20 },
            { ingredientId: ingredientMilk.id, qtyPerServing: 150 }
          ]
        }
      }
    });

    // Buat pesanan dine-in via API
    const dineInRes = await fetch(`http://localhost:5000/api/orders/dinein`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tableId: table1.id,
        customerName: 'Tamu Resep HPP',
        subtotal: 56000,
        tax: 0,
        serviceCharge: 0,
        total: 56000,
        items: [
          {
            productId: recipeProduct.id,
            qty: 2,
            price: 28000
          }
        ]
      })
    });

    if (!dineInRes.ok) {
      const errText = await dineInRes.text();
      throw new Error(`DineIn API failed: ${dineInRes.status} ${errText}`);
    }

    const dineInData = await dineInRes.json();
    const createdOrderId = dineInData.order?.id || dineInData.id;

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        orderId: createdOrderId,
        productId: recipeProduct.id
      }
    });

    const expectedHpp = 20 * 300 + 150 * 20; // 9000
    if (orderItem && orderItem.buyPrice === expectedHpp) {
      console.log(`✅ TEST 4 PASSED: OrderItem.buyPrice tercatat Rp ${orderItem.buyPrice.toLocaleString('id-ID')} (sesuai HPP resep: 20g kopi @300 + 150ml susu @20 = Rp ${expectedHpp.toLocaleString('id-ID')}). Laba kotor per item 100% akurat!\n`);
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: OrderItem.buyPrice tidak sesuai HPP resep.', {
        actualBuyPrice: orderItem?.buyPrice,
        expectedHpp
      });
    }

  } catch (err) {
    console.error('💥 UNEXPECTED ERROR IN TEST SUITE:', err);
  } finally {
    console.log('================================================================');
    console.log(`📊 PHASE 3 TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log('================================================================');
    await prisma.$disconnect();
    process.exit(passed === total ? 0 : 1);
  }
}

runPhase3Tests();
