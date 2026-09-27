/**
 * Test Suite: Phase 4 Tenant Operational & Financial Hardening
 * File: backend/scripts/test_phase4_tenant_hardening.js
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 4 TENANT OPERATIONAL & FINANCIAL HARDENING TESTS');
  console.log('================================================================\n');

  const tenantAId = `tenant_p4_a_${Date.now()}`;
  const tenantBId = `tenant_p4_b_${Date.now()}`;
  const outletAId = `outlet_p4_a_${Date.now()}`;
  const outletBId = `outlet_p4_b_${Date.now()}`;
  let passed = 0;
  const total = 4;

  try {
    // 0. Setup Tenants, Outlets, Users
    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Kafe Tenant A', slug: `kafe-a-${Date.now()}`, status: 'ACTIVE' },
        { id: tenantBId, name: 'Kafe Tenant B', slug: `kafe-b-${Date.now()}`, status: 'ACTIVE' }
      ]
    });

    await prisma.outlet.createMany({
      data: [
        { id: outletAId, tenantId: tenantAId, code: `OUT-A-${Date.now().toString().slice(-4)}`, name: 'Outlet A', address: 'Jl. A' },
        { id: outletBId, tenantId: tenantBId, code: `OUT-B-${Date.now().toString().slice(-4)}`, name: 'Outlet B', address: 'Jl. B' }
      ]
    });

    const userA = await prisma.user.create({
      data: {
        name: 'Manager A',
        username: `mgr_a_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '["*"]',
        role: 'Super Admin',
        memberships: { create: { tenantId: tenantAId } }
      }
    });

    const userB = await prisma.user.create({
      data: {
        name: 'Manager B',
        username: `mgr_b_${Date.now()}`,
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
        { tenantId: tenantAId, storeName: 'Kafe Tenant A', ingredientTrackingEnabled: true },
        { tenantId: tenantBId, storeName: 'Kafe Tenant B', ingredientTrackingEnabled: true }
      ]
    });

    // -------------------------------------------------------------------------
    // TEST 1: Warehouse Multi-Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Isolasi Multi-Tenant Warehouse (Gudang Bahan Baku) ---');
    // Create stock item for Tenant A
    const ingA = await prisma.ingredient.create({
      data: {
        tenantId: tenantAId,
        name: 'Biji Kopi Arabika Tenant A',
        unit: 'kg',
        buyPrice: 150000,
        warehouseStock: 50,
        warehouseMinStock: 5
      }
    });

    // Tenant A creates a Warehouse Requisition
    const reqA = await prisma.warehouseRequisition.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        reqNumber: `REQ-A-${Date.now()}`,
        requestedById: userA.id,
        status: 'PENDING',
        notes: 'Permintaan stock outlet A',
        items: {
          create: [
            {
              tenantId: tenantAId,
              ingredientId: ingA.id,
              itemName: ingA.name,
              requestedUnit: 'kg',
              requestedQty: 10,
              baseQty: 10,
              transferPrice: 150000,
              subtotal: 1500000
            }
          ]
        }
      }
    });

    // Query warehouse stock as Tenant B
    const resStockB = await fetch('http://localhost:5000/api/warehouse/stock', {
      headers: headersB
    });
    const stockBData = await resStockB.json();
    const foundIngAInB = Array.isArray(stockBData) && stockBData.some(i => i.id === ingA.id);

    // Query warehouse transfers as Tenant B
    const resTransfersB = await fetch('http://localhost:5000/api/warehouse/transfers', {
      headers: headersB
    });
    const transfersBData = await resTransfersB.json();
    const foundReqAInB = Array.isArray(transfersBData) && transfersBData.some(t => t.id === reqA.id);

    // Query warehouse stock as Tenant A
    const resStockA = await fetch('http://localhost:5000/api/warehouse/stock', {
      headers: headersA
    });
    const stockAData = await resStockA.json();
    const foundIngAInA = Array.isArray(stockAData) && stockAData.some(i => i.id === ingA.id);

    if (!foundIngAInB && !foundReqAInB && foundIngAInA) {
      console.log('✅ TEST 1 PASSED: Data Gudang Tenant A (Stock & Requisition) terisolasi sempurna dari Tenant B.');
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED: Bocor data gudang antara Tenant A dan Tenant B!', {
        foundIngAInB,
        foundReqAInB,
        foundIngAInA
      });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Debt Auto-Cancellation on Order Void
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Pembatalan Otomatis Piutang (Debt) saat Order Di-Void ---');
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenantAId,
        name: 'Pelanggan Bon Phase 4',
        phone: '081299998888'
      }
    });

    // Create an order with Piutang
    const orderPiutang = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        orderNumber: `ORD-PIUTANG-${Date.now()}`,
        status: 'Completed',
        paymentMethod: 'Piutang',
        userId: userA.id,
        total: 75000,
        subtotal: 75000,
        tax: 0,
        serviceCharge: 0,
        customerId: customer.id,
        customerName: customer.name
      }
    });

    // Create linked Debt
    const linkedDebt = await prisma.debt.create({
      data: {
        tenantId: tenantAId,
        customerId: customer.id,
        orderId: orderPiutang.id,
        amount: 75000,
        remaining: 75000,
        status: 'Belum Lunas'
      }
    });

    // Void the order via API
    const resVoidOrder = await fetch(`http://localhost:5000/api/orders/${orderPiutang.id}/void`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({ reason: 'Pelanggan salah pesan / batal bayar bon' })
    });
    const voidResult = await resVoidOrder.json();

    // Check debt status in DB
    const updatedDebt = await prisma.debt.findUnique({
      where: { id: linkedDebt.id }
    });

    if (
      resVoidOrder.ok &&
      updatedDebt &&
      updatedDebt.status === 'Dibatalkan' &&
      Number(updatedDebt.remaining) === 0
    ) {
      console.log('✅ TEST 2 PASSED: Piutang (Debt) otomatis berstatus "Dibatalkan" dan sisa = 0 saat Order di-Void.');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Debt tidak dibatalkan saat Order di-void!', {
        status: resVoidOrder.status,
        voidResult,
        updatedDebt
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Employee Loan Repayment CashFlow & Shift Physical Balance
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Pencatatan CashFlow Pengembalian Kasbon & Sinkronisasi Kas Fisik Shift ---');
    // Open a shift for User A
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

    const loan = await prisma.employeeLoan.create({
      data: {
        tenantId: tenantAId,
        userId: userA.id,
        amount: 200000,
        remaining: 200000,
        reason: 'Kasbon darurat',
        status: 'Belum Lunas'
      }
    });

    // 3a. Pay 50.000 via Tunai (Cash)
    const resPayCash = await fetch(`http://localhost:5000/api/employee-loans/${loan.id}/payments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        amountPaid: 50000,
        paymentMethod: 'Tunai',
        notes: 'Cicilan 1 Tunai'
      })
    });
    const payCashData = await resPayCash.json();

    // Check CashFlow record
    const cashFlowCash = await prisma.cashFlow.findFirst({
      where: {
        tenantId: tenantAId,
        category: 'Pengembalian Kasbon - Tunai'
      }
    });

    // Check Shift summary to ensure cash was counted in expected cash
    const resShiftAfterCash = await fetch('http://localhost:5000/api/shifts/current-summary', {
      headers: headersA
    });
    const shiftDataAfterCash = await resShiftAfterCash.json();

    // 3b. Pay 50.000 via Transfer (Non-Tunai)
    const resPayTransfer = await fetch(`http://localhost:5000/api/employee-loans/${loan.id}/payments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        amountPaid: 50000,
        paymentMethod: 'Transfer',
        notes: 'Cicilan 2 Transfer Bank'
      })
    });
    const payTransferData = await resPayTransfer.json();

    const cashFlowTransfer = await prisma.cashFlow.findFirst({
      where: {
        tenantId: tenantAId,
        category: 'Pengembalian Kasbon - Non-Tunai'
      }
    });

    // Check Shift summary again to ensure Transfer was NOT counted in expected cash drawer
    const resShiftAfterTransfer = await fetch('http://localhost:5000/api/shifts/current-summary', {
      headers: headersA
    });
    const shiftDataAfterTransfer = await resShiftAfterTransfer.json();

    // Verification:
    // manualCashIn should include 50000 from cash repayment, but NOT the transfer repayment!
    const manualCashIn = Number(shiftDataAfterTransfer.manualCashIn || 0);
    const hasCashFlowCash = !!cashFlowCash && Number(cashFlowCash.amount) === 50000;
    const hasCashFlowTransfer = !!cashFlowTransfer && Number(cashFlowTransfer.amount) === 50000;

    if (hasCashFlowCash && hasCashFlowTransfer && manualCashIn === 50000) {
      console.log('✅ TEST 3 PASSED: Pengembalian kasbon tunai masuk ke laci kas shift (manualCashIn=50000), transfer bank tidak menggelembungkan laci fisik.');
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED: Perhitungan kasbon dan shift kas fisik tidak sinkron!', {
        hasCashFlowCash,
        hasCashFlowTransfer,
        manualCashIn,
        expectedManualCashIn: 50000
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Voucher Quota Tracking & Auto-Restore on Void
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Kuota Voucher & Pemulihan Otomatis Saat Order Di-Void ---');
    const voucher = await prisma.voucher.create({
      data: {
        tenantId: tenantAId,
        code: `DISKON50-${Date.now().toString().slice(-4)}`,
        description: 'Voucher Diskon 50k',
        type: 'FIXED',
        amount: 50000,
        minSpend: 100000,
        maxUsage: 5,
        usedCount: 0,
        status: 'Aktif'
      }
    });

    // Create dine-in order
    const dineInOrder = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        orderNumber: `ORD-VOUCH-${Date.now()}`,
        status: 'Pending',
        userId: userA.id,
        total: 100000,
        subtotal: 100000,
        tax: 0,
        serviceCharge: 0,
        customerName: 'Tamu Phase 4'
      }
    });

    // Pay dine-in order with voucher attached
    const resPayVoucher = await fetch(`http://localhost:5000/api/orders/${dineInOrder.id}/payment`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({
        paymentMethod: 'Cash',
        amountPaid: 50000,
        discount: 50000,
        voucherId: voucher.id,
        total: 50000
      })
    });
    const payVoucherData = await resPayVoucher.json();

    const voucherAfterPay = await prisma.voucher.findUnique({
      where: { id: voucher.id }
    });

    // Now Void the order
    const resVoidVoucherOrder = await fetch(`http://localhost:5000/api/orders/${dineInOrder.id}/void`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({ reason: 'Salah input voucher / transaksi dibatalkan' })
    });
    const voidVoucherData = await resVoidVoucherOrder.json();

    const voucherAfterVoid = await prisma.voucher.findUnique({
      where: { id: voucher.id }
    });

    if (
      resPayVoucher.ok &&
      voucherAfterPay.usedCount === 1 &&
      resVoidVoucherOrder.ok &&
      voucherAfterVoid.usedCount === 0
    ) {
      console.log('✅ TEST 4 PASSED: usedCount voucher naik jadi 1 saat bayar, dan kembali ke 0 saat order di-void.');
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: Kuota voucher tidak bertambah atau tidak pulih saat void!', {
        payOk: resPayVoucher.ok,
        usedCountAfterPay: voucherAfterPay?.usedCount,
        voidOk: resVoidVoucherOrder.ok,
        usedCountAfterVoid: voucherAfterVoid?.usedCount
      });
    }

    // -------------------------------------------------------------------------
    // CLEANUP & SUMMARY
    // -------------------------------------------------------------------------
    // Clean up created entities
    await prisma.shift.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.orderItem.deleteMany({ where: { order: { tenantId: { in: [tenantAId, tenantBId] } } } });
    await prisma.debt.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.order.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.cashFlow.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.employeeLoanPayment.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.employeeLoan.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.voucher.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.warehouseRequisitionItem.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.warehouseRequisition.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.ingredient.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.settings.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.outlet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    console.log('\n================================================================');
    console.log(`📊 PHASE 4 TEST SUMMARY: ${passed}/${total} PASSED`);
    console.log('================================================================');

    if (passed === total) {
      console.log('🎉 ALL PHASE 4 LOGIC FLAW TESTS PASSED WITH ZERO ERRORS!');
      process.exit(0);
    } else {
      console.error(`💥 ${total - passed} TESTS FAILED!`);
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal error in Phase 4 tests:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase4Tests();
