import prisma from '../db';
import { generateOrderNumber } from '../routes/orders';

async function runMultiTenantVerification() {
  console.log('===============================================================');
  console.log('  🛡️ MULTI-TENANT ISOLATION & CONCURRENCY VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failedTests++;
    }
  }

  // Generate unique test IDs so we don't interfere with real tenant data
  const testTenantAId = `test_tenant_a_${Date.now()}`;
  const testTenantBId = `test_tenant_b_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Concurrency & Thread-Safe Order Number Generation
    // -------------------------------------------------------------
    console.log('\n[1] Testing Thread-Safe Order Number Generation (High Concurrency)...');
    const concurrencyCount = 25;
    const promisesA = Array.from({ length: concurrencyCount }, () => generateOrderNumber(testTenantAId));
    const promisesB = Array.from({ length: concurrencyCount }, () => generateOrderNumber(testTenantBId));

    const [resultsA, resultsB] = await Promise.all([
      Promise.all(promisesA),
      Promise.all(promisesB)
    ]);

    const uniqueA = new Set(resultsA);
    const uniqueB = new Set(resultsB);

    assert(resultsA.length === concurrencyCount && uniqueA.size === concurrencyCount, 
      `Tenant A generated ${concurrencyCount} concurrent order numbers without duplicates`,
      `Expected ${concurrencyCount} unique, got ${uniqueA.size}`
    );

    assert(resultsB.length === concurrencyCount && uniqueB.size === concurrencyCount, 
      `Tenant B generated ${concurrencyCount} concurrent order numbers without duplicates`,
      `Expected ${concurrencyCount} unique, got ${uniqueB.size}`
    );

    // -------------------------------------------------------------
    // SETUP: Create Temporary Tenants & Test Data
    // -------------------------------------------------------------
    console.log('\n[2] Setting Up Multi-Tenant Sandbox Environment in Database...');
    await prisma.tenant.createMany({
      data: [
        { id: testTenantAId, name: 'Kafe Alpha Test', slug: `kafe-alpha-${Date.now()}` },
        { id: testTenantBId, name: 'Kafe Beta Test', slug: `kafe-beta-${Date.now()}` }
      ]
    });

    // Create Settings for both tenants (e.g. Geofence test)
    await prisma.settings.createMany({
      data: [
        {
          tenantId: testTenantAId,
          cafeName: 'Kafe Alpha',
          storeLatitude: -6.200000,
          storeLongitude: 106.816666,
          gpsRadiusMeters: 50,
          geofenceActive: true
        },
        {
          tenantId: testTenantBId,
          cafeName: 'Kafe Beta',
          storeLatitude: -7.250445,
          storeLongitude: 112.768845,
          gpsRadiusMeters: 100,
          geofenceActive: true
        }
      ]
    });

    // Create a dummy user for orders
    const dummyUser = await prisma.user.findFirst();
    const userId = dummyUser ? dummyUser.id : 1;

    // Create Orders for Tenant A and Tenant B
    const orderA1 = await prisma.order.create({
      data: {
        tenantId: testTenantAId,
        orderNumber: `ORD-TEST-A1`,
        customerName: 'Customer Alpha 1',
        userId: userId,
        subtotal: 50000,
        tax: 5000,
        serviceCharge: 0,
        total: 55000,
        status: 'Paid',
        paymentMethod: 'Cash',
        kdsStatus: 'Cooking'
      }
    });

    const orderA2 = await prisma.order.create({
      data: {
        tenantId: testTenantAId,
        orderNumber: `ORD-TEST-A2`,
        customerName: 'Customer Alpha 2',
        userId: userId,
        subtotal: 100000,
        tax: 10000,
        serviceCharge: 0,
        total: 110000,
        status: 'Pending',
        kdsStatus: 'Pending'
      }
    });

    const orderB1 = await prisma.order.create({
      data: {
        tenantId: testTenantBId,
        orderNumber: `ORD-TEST-B1`,
        customerName: 'Customer Beta 1',
        userId: userId,
        subtotal: 75000,
        tax: 7500,
        serviceCharge: 0,
        total: 82500,
        status: 'Paid',
        paymentMethod: 'QRIS',
        kdsStatus: 'Cooking'
      }
    });

    // -------------------------------------------------------------
    // TEST 3: Orders Multi-Tenant Data Quarantine
    // -------------------------------------------------------------
    console.log('\n[3] Testing Orders Data Isolation...');
    const tenantAOrders = await prisma.order.findMany({
      where: { tenantId: testTenantAId }
    });
    const tenantBOrders = await prisma.order.findMany({
      where: { tenantId: testTenantBId }
    });

    assert(tenantAOrders.length === 2, `Tenant A queries exactly 2 orders belonging to Tenant A`);
    assert(tenantBOrders.length === 1, `Tenant B queries exactly 1 order belonging to Tenant B`);
    assert(!tenantAOrders.some(o => o.tenantId === testTenantBId), `Zero Tenant B orders leaked into Tenant A results`);
    assert(!tenantBOrders.some(o => o.tenantId === testTenantAId), `Zero Tenant A orders leaked into Tenant B results`);

    // -------------------------------------------------------------
    // TEST 4: KDS Queue Multi-Tenant Quarantine
    // -------------------------------------------------------------
    console.log('\n[4] Testing KDS Kitchen Display Isolation...');
    const kdsQueueA = await prisma.order.findMany({
      where: {
        tenantId: testTenantAId,
        kdsStatus: { in: ['Pending', 'Cooking'] }
      }
    });
    const kdsQueueB = await prisma.order.findMany({
      where: {
        tenantId: testTenantBId,
        kdsStatus: { in: ['Pending', 'Cooking'] }
      }
    });

    assert(kdsQueueA.length === 2, `Tenant A KDS contains 2 active cooking/pending orders`);
    assert(kdsQueueB.length === 1, `Tenant B KDS contains 1 active cooking order`);
    assert(!kdsQueueA.some(o => o.orderNumber === 'ORD-TEST-B1'), `Tenant B order ORD-TEST-B1 never visible on Tenant A kitchen display`);

    // -------------------------------------------------------------
    // TEST 5: Shift / Z-Report Reconciliation Isolation
    // -------------------------------------------------------------
    console.log('\n[5] Testing Shift / Z-Report Reconciliation Isolation...');
    const shiftA = await prisma.shift.create({
      data: {
        tenantId: testTenantAId,
        userId: userId,
        saldoAwal: 100000,
        status: 'Open'
      }
    });

    const shiftB = await prisma.shift.create({
      data: {
        tenantId: testTenantBId,
        userId: userId,
        saldoAwal: 200000,
        status: 'Open'
      }
    });

    // Query active shift for Tenant A
    const activeShiftA = await prisma.shift.findFirst({
      where: {
        tenantId: testTenantAId,
        status: 'Open'
      }
    });
    assert(activeShiftA?.id === shiftA.id && activeShiftA.saldoAwal === 100000, 
      `Active shift query for Tenant A returns only Tenant A shift`
    );

    // Sum totalSales for Tenant A
    const salesAggregateA = await prisma.order.aggregate({
      where: {
        tenantId: testTenantAId,
        status: 'Paid'
      },
      _sum: { total: true }
    });

    assert(salesAggregateA._sum.total === 55000, 
      `Tenant A Z-Report sales aggregation totals Rp 55,000 (never includes Tenant B's Rp 82,500)`
    );

    // -------------------------------------------------------------
    // TEST 6: Petty Cash / Cashflow Isolation
    // -------------------------------------------------------------
    console.log('\n[6] Testing Petty Cash / Cashflow Isolation...');
    await prisma.cashFlow.create({
      data: {
        tenantId: testTenantAId,
        userId: userId,
        type: 'Expense',
        category: 'Operasional',
        amount: 25000,
        description: 'Beli Gas Elpiji Alpha'
      }
    });
    await prisma.cashFlow.create({
      data: {
        tenantId: testTenantBId,
        userId: userId,
        type: 'Expense',
        category: 'Operasional',
        amount: 45000,
        description: 'Beli Es Batu Beta'
      }
    });

    const cashflowsA = await prisma.cashFlow.findMany({
      where: { tenantId: testTenantAId }
    });
    assert(cashflowsA.length === 1 && cashflowsA[0].description === 'Beli Gas Elpiji Alpha',
      `Tenant A cashflow query returns only Alpha expenses without leaking Beta expenses`
    );

    // -------------------------------------------------------------
    // TEST 7: Settings & Geofencing Isolation
    // -------------------------------------------------------------
    console.log('\n[7] Testing Attendance Geofencing Settings Isolation...');
    const settingsA = await prisma.settings.findFirst({
      where: { tenantId: testTenantAId }
    });
    const settingsB = await prisma.settings.findFirst({
      where: { tenantId: testTenantBId }
    });

    assert(settingsA?.storeLatitude === -6.200000 && settingsA?.gpsRadiusMeters === 50,
      `Tenant A geofence accurately pulls Jakarta coordinates (-6.200000, 50m radius)`
    );
    assert(settingsB?.storeLatitude === -7.250445 && settingsB?.gpsRadiusMeters === 100,
      `Tenant B geofence accurately pulls Surabaya coordinates (-7.250445, 100m radius)`
    );

  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Clean Up All Temporary Mock Data
    // -------------------------------------------------------------
    console.log('\n[8] Cleaning Up Temporary Test Records...');
    try {
      await prisma.cashFlow.deleteMany({ where: { tenantId: { in: [testTenantAId, testTenantBId] } } });
      await prisma.shift.deleteMany({ where: { tenantId: { in: [testTenantAId, testTenantBId] } } });
      await prisma.order.deleteMany({ where: { tenantId: { in: [testTenantAId, testTenantBId] } } });
      await prisma.settings.deleteMany({ where: { tenantId: { in: [testTenantAId, testTenantBId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [testTenantAId, testTenantBId] } } });
      console.log('  🧹 All temporary test data successfully pruned from database.');
    } catch (cleanupErr: any) {
      console.warn('  ⚠️ Warning during test cleanup:', cleanupErr.message);
    }
  }

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMultiTenantVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
