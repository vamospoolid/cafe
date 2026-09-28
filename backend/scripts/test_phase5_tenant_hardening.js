/**
 * Test Suite: Phase 5 SaaS Tenant Hardening & Financial Audit
 * File: backend/scripts/test_phase5_tenant_hardening.js
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 5 SAAS TENANT HARDENING & FINANCIAL AUDIT TESTS');
  console.log('================================================================\n');

  const tenantAId = `tenant_p5_a_${Date.now()}`;
  const tenantBId = `tenant_p5_b_${Date.now()}`;
  const outletAId = `outlet_p5_a_${Date.now()}`;
  const outletBId = `outlet_p5_b_${Date.now()}`;
  let passed = 0;
  const total = 5;

  try {
    // 0. Setup Tenants, Outlets, Users
    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Resto Tenant A', slug: `resto-a-${Date.now()}`, status: 'ACTIVE' },
        { id: tenantBId, name: 'Resto Tenant B', slug: `resto-b-${Date.now()}`, status: 'ACTIVE' }
      ]
    });

    await prisma.outlet.createMany({
      data: [
        { id: outletAId, tenantId: tenantAId, code: `OUT-5A-${Date.now().toString().slice(-4)}`, name: 'Outlet 5A', address: 'Jl. 5A' },
        { id: outletBId, tenantId: tenantBId, code: `OUT-5B-${Date.now().toString().slice(-4)}`, name: 'Outlet 5B', address: 'Jl. 5B' }
      ]
    });

    const userA = await prisma.user.create({
      data: {
        name: 'Manager Phase 5 A',
        username: `mgr_5a_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '["*"]',
        role: 'Super Admin',
        memberships: { create: { tenantId: tenantAId } }
      }
    });

    const userB = await prisma.user.create({
      data: {
        name: 'Manager Phase 5 B',
        username: `mgr_5b_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '["*"]',
        role: 'Super Admin',
        memberships: { create: { tenantId: tenantBId } }
      }
    });

    const tokenA = jwt.sign(
      { id: userA.id, username: userA.username, role: 'Super Admin', isPlatformAdmin: true, tenantId: tenantAId, outletId: outletAId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const tokenB = jwt.sign(
      { id: userB.id, username: userB.username, role: 'Super Admin', isPlatformAdmin: true, tenantId: tenantBId, outletId: outletBId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const headersA = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`,
      'x-tenant-id': tenantAId
    };

    const headersB = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`,
      'x-tenant-id': tenantBId
    };

    await prisma.settings.createMany({
      data: [
        { tenantId: tenantAId, storeName: 'Kafe Bintang A', profitSharingOwnerPercent: 80, profitSharingRamenPercent: 20, profitSharingDrinkPercent: 20, profitSharingOpexMode: 'BEFORE_SPLIT' },
        { tenantId: tenantBId, storeName: 'Kafe Bintang B', profitSharingOwnerPercent: 80, profitSharingRamenPercent: 20, profitSharingDrinkPercent: 20, profitSharingOpexMode: 'BEFORE_SPLIT' }
      ]
    });

    const categoryFoodA = await prisma.category.create({
      data: {
        tenantId: tenantAId,
        name: 'Makanan Berat',
        printerTarget: 'KITCHEN'
      }
    });

    // -------------------------------------------------------------------------
    // TEST 1: Profit Sharing Math: foodTotalExpense = foodHpp + foodDirectExpense
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Integrasi Akuntansi HPP Riil + Petty Cash pada Profit Sharing ---');
    const productFoodA = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryFoodA.id,
        name: 'Steak Ayam Spesial',
        sellPrice: 50000,
        buyPrice: 20000, // HPP per porsi: 20.000
        stock: 100,
        status: 'Aktif'
      }
    });

    // Buat Order Paid dengan 2 porsi Steak Ayam (Revenue: 100.000, HPP: 40.000)
    const today = new Date();
    const orderPaidA = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        orderNumber: `ORD-P5-PS-${Date.now()}`,
        status: 'Paid',
        paymentMethod: 'Cash',
        userId: userA.id,
        subtotal: 100000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 100000,
        customerName: 'Tamu PS',
        paidAt: today,
        createdAt: today,
        items: {
          create: [
            {
              tenantId: tenantAId,
              outletId: outletAId,
              productId: productFoodA.id,
              qty: 2,
              price: 50000,
              buyPrice: 20000,
              subtotal: 100000
            }
          ]
        }
      }
    });

    // Catat pengeluaran kas langsung dapur (Bumbu Garam Dapur Rp 10.000)
    const directCashFlow = await prisma.cashFlow.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        type: 'Pengeluaran',
        category: 'Belanja Bumbu Dapur',
        description: 'Beli garam dan minyak goreng dapur',
        amount: 10000,
        date: today,
        userId: userA.id
      }
    });

    // Query Profit Sharing API
    const todayStr = today.toISOString().split('T')[0];
    const resPS = await fetch(`http://localhost:5000/api/analytics/profit-sharing?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: headersA
    });
    const dataPS = await resPS.json();

    // Verifikasi: foodHpp (40.000) + foodDirectExpense (10.000) = foodTotalExpense (50.000)
    // Gross Profit = 100.000 - 50.000 = 50.000
    const foodDiv = dataPS.foodDivision;
    if (
      foodDiv &&
      foodDiv.hpp === 40000 &&
      foodDiv.directExpense === 10000 &&
      foodDiv.totalExpense === 50000 &&
      foodDiv.grossProfit === 50000
    ) {
      console.log('✅ TEST 1 PASSED: Total expense = foodHpp (40k) + directExpense (10k) = 50k. HPP tidak hilang saat ada direct expense!');
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED: Perhitungan beban bagi hasil salah!', {
        hpp: foodDiv?.hpp,
        directExpense: foodDiv?.directExpense,
        totalExpense: foodDiv?.totalExpense,
        grossProfit: foodDiv?.grossProfit
      });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Multi-Tenant Scoping Modul Kerugian Limbah (Waste & Spoilage)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Isolasi Multi-Tenant Analitik & Log Kerugian Limbah (Waste) ---');
    const ingA = await prisma.ingredient.create({
      data: {
        tenantId: tenantAId,
        name: 'Daging Sapi Slice Tenant A',
        unit: 'kg',
        buyPrice: 120000,
        stock: 10
      }
    });

    // Tenant A mencatat waste 0.5 kg (Rp 60.000)
    const resWasteA = await fetch('http://localhost:5000/api/waste', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        type: 'INGREDIENT',
        ingredientId: ingA.id,
        qty: 0.5,
        reason: 'Kadaluarsa / Basi',
        notes: 'Daging basi di kulkas bawah'
      })
    });
    const wasteAData = await resWasteA.json();

    // Tenant B mencoba membaca analitik waste
    const resWasteAnalyticsB = await fetch('http://localhost:5000/api/waste/analytics', {
      headers: headersB
    });
    const analyticsB = await resWasteAnalyticsB.json();

    // Tenant B mencoba membaca logs waste
    const resWasteLogsB = await fetch('http://localhost:5000/api/waste/logs', {
      headers: headersB
    });
    const logsB = await resWasteLogsB.json();

    // Verifikasi: Tenant B tidak boleh melihat Rp 60.000 milik Tenant A
    if (
      resWasteA.ok &&
      analyticsB.summary.totalWasteCost === 0 &&
      Array.isArray(logsB) &&
      logsB.length === 0
    ) {
      console.log('✅ TEST 2 PASSED: Analitik dan Log Waste Tenant A 100% terisolasi dari Tenant B (totalWasteCost B = 0).');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Bocor data analitik/log waste ke Tenant B!', {
        resWasteOk: resWasteA.ok,
        totalWasteCostB: analyticsB.summary?.totalWasteCost,
        logsCountB: logsB?.length
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Stock Opname Selisih Minus Otomatis Tercatat ke WasteLog
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Pencatatan Otomatis Susut Opname Minus ke WasteLog Kerugian HPP ---');
    const ingOpname = await prisma.ingredient.create({
      data: {
        tenantId: tenantAId,
        name: 'Keju Mozzarella Blok',
        unit: 'kg',
        buyPrice: 80000,
        stock: 10 // Sistem: 10 kg
      }
    });

    // Lakukan stock opname fisik: ternyata fisik hanya 8 kg (selisih -2 kg = Rp 160.000)
    const resOpname = await fetch('http://localhost:5000/api/ingredients/stock-opname', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        auditorName: 'Kepala Gudang A',
        items: [
          {
            ingredientId: ingOpname.id,
            physicalStock: 8,
            reason: 'Susut / Rusak Kulkas',
            notes: '2 kg berjamur terbuang'
          }
        ]
      })
    });
    const opnameData = await resOpname.json();

    // Cek apakah tercatat otomatis ke tabel WasteLog
    const createdWasteLog = await prisma.wasteLog.findFirst({
      where: {
        tenantId: tenantAId,
        ingredientId: ingOpname.id,
        reason: 'Selisih Stock Opname (Susut/Hilang)'
      }
    });

    if (
      resOpname.ok &&
      createdWasteLog &&
      Number(createdWasteLog.qty) === 2 &&
      Number(createdWasteLog.totalCost) === 160000
    ) {
      console.log('✅ TEST 3 PASSED: Selisih opname minus otomatis tercatat ke WasteLog (qty=2 kg, kerugian Rp 160.000).');
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED: Selisih opname minus tidak masuk ke WasteLog!', {
        opnameOk: resOpname.ok,
        createdWasteLog
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Uang Muka Reservasi Segregasi Cashflow & Shift Cash Protection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Segregasi DP Reservasi Tunai vs Non-Tunai & Sinkronisasi Kas Shift ---');
    const tableA = await prisma.table.create({
      data: { tenantId: tenantAId, outletId: outletAId, tableNo: `T5-${Date.now().toString().slice(-4)}`, status: 'Aktif' }
    });

    // Buka shift kasir A
    const shiftA = await prisma.shift.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        userId: userA.id,
        saldoAwal: 100000,
        waktuBuka: new Date(Date.now() - 60000),
        status: 'Open'
      }
    });

    // 4a. Buat Reservasi dengan DP Non-Tunai (Transfer Bank Rp 200.000)
    const resDpTransfer = await fetch('http://localhost:5000/api/reservations', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerName: 'Bpk. Hendra Transfer',
        phone: '081211112222',
        date: todayStr,
        time: '19:00',
        tableId: tableA.id,
        guests: 4,
        dpAmount: 200000,
        paymentMethod: 'Transfer'
      })
    });
    const dpTransferData = await resDpTransfer.json();

    // Cek Shift summary: manualCashIn harus TETAP 0 (karena transfer tidak boleh menggelembungkan laci kas fisik)
    const resShiftAfterTransfer = await fetch('http://localhost:5000/api/shifts/current-summary', {
      headers: headersA
    });
    const shiftSummary1 = await resShiftAfterTransfer.json();

    // 4b. Buat Reservasi kedua dengan DP Tunai (Cash Rp 50.000)
    const tableA2 = await prisma.table.create({
      data: { tenantId: tenantAId, outletId: outletAId, tableNo: `T5-2-${Date.now().toString().slice(-4)}`, status: 'Aktif' }
    });
    const resDpCash = await fetch('http://localhost:5000/api/reservations', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerName: 'Ibu Rina Tunai',
        phone: '081233334444',
        date: todayStr,
        time: '20:00',
        tableId: tableA2.id,
        guests: 2,
        dpAmount: 50000,
        paymentMethod: 'Tunai'
      })
    });
    const dpCashData = await resDpCash.json();

    // Cek Shift summary: manualCashIn sekarang harus TEPAT 50.000
    const resShiftAfterCash = await fetch('http://localhost:5000/api/shifts/current-summary', {
      headers: headersA
    });
    const shiftSummary2 = await resShiftAfterCash.json();

    const transferExcluded = Number(shiftSummary1.manualCashIn || 0) === 0;
    const cashIncluded = Number(shiftSummary2.manualCashIn || 0) === 50000;

    if (resDpTransfer.ok && resDpCash.ok && transferExcluded && cashIncluded) {
      console.log('✅ TEST 4 PASSED: DP Transfer (200k) tidak mencemari laci kas (manualCashIn=0), DP Tunai (50k) otomatis masuk laci kas (manualCashIn=50k).');
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: Segregasi DP dan shift kas fisik tidak sinkron!', {
        transferExcluded,
        cashIncluded,
        manualCashIn1: shiftSummary1.manualCashIn,
        manualCashIn2: shiftSummary2.manualCashIn
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Active Table Reservation Auto-Resolved to 'Lunas' upon Payment
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Auto-Resolve Status Reservasi Meja ke "Lunas" saat Tagihan Dibayar ---');
    // Buat order dine-in di tableA2 (yang memiliki reservasi aktif berstatus 'DP Dibayar')
    const orderDineIn = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        orderNumber: `ORD-P5-RES-${Date.now()}`,
        status: 'Pending',
        tableId: tableA2.id,
        userId: userA.id,
        subtotal: 150000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 150000,
        customerName: 'Ibu Rina Tunai'
      }
    });

    // Lakukan pelunasan pembayaran tagihan meja di POS
    const resPayOrder = await fetch(`http://localhost:5000/api/orders/${orderDineIn.id}/payment`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({
        paymentMethod: 'Cash',
        amountPaid: 150000,
        total: 150000
      })
    });
    const payOrderData = await resPayOrder.json();

    // Periksa status reservasi di database
    const updatedRes = await prisma.reservation.findUnique({
      where: { id: dpCashData.id }
    });

    if (resPayOrder.ok && updatedRes && updatedRes.status === 'Lunas') {
      console.log('✅ TEST 5 PASSED: Status reservasi meja otomatis ter-update menjadi "Lunas" saat tagihan pesanan dibayar.');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED: Reservasi meja tidak ter-update ke Lunas!', {
        payOk: resPayOrder.ok,
        resStatus: updatedRes?.status
      });
    }

    // -------------------------------------------------------------------------
    // CLEANUP & SUMMARY
    // -------------------------------------------------------------------------
    await prisma.shift.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId: { in: [tenantAId, tenantBId] } } } });
    await prisma.debt.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.order.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.cashFlow.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.wasteLog.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.reservation.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.table.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.ingredientLog.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.ingredient.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.category.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.settings.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.outlet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    console.log('\n================================================================');
    console.log(`📊 PHASE 5 TEST SUMMARY: ${passed}/${total} PASSED`);
    console.log('================================================================');

    if (passed === total) {
      console.log('🎉 ALL PHASE 5 SAAS HARDENING & FINANCIAL AUDIT TESTS PASSED!');
      process.exit(0);
    } else {
      console.error(`💥 ${total - passed} TESTS FAILED!`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal error in Phase 5 tests:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5Tests();
