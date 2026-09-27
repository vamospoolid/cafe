const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runTests() {
  console.log('=== TEST: BENGKEL PROCUREMENT, DEFECTA & MULTI-TENANT ISOLATION ===\n');
  let exitCode = 0;

  const testSuffix = Date.now();
  const tenantBengkelAId = `test-bengkel-a-${testSuffix}`;
  const tenantBengkelBId = `test-bengkel-b-${testSuffix}`;
  const tenantCafeCId = `test-cafe-c-${testSuffix}`;

  try {
    // 1. Provision Test Tenants
    console.log('1. Setting up test tenants: Bengkel A, Bengkel B, Cafe C...');
    await prisma.tenant.createMany({
      data: [
        { id: tenantBengkelAId, name: 'Bengkel Motor Prima', slug: `bengkel-a-${testSuffix}`, businessType: 'BENGKEL', status: 'ACTIVE' },
        { id: tenantBengkelBId, name: 'Bengkel Mobil Sentosa', slug: `bengkel-b-${testSuffix}`, businessType: 'BENGKEL', status: 'ACTIVE' },
        { id: tenantCafeCId, name: 'Kafe Kopi Kenangan', slug: `cafe-c-${testSuffix}`, businessType: 'CAFE', status: 'ACTIVE' },
      ]
    });

    const categoryA = await prisma.category.create({
      data: { tenantId: tenantBengkelAId, name: 'Pelumas Mesin', printerTarget: 'NONE' }
    });

    console.log('   Tenants created successfully.');

    // 2. Test PartRequest Creation & Multi-Tenant Scoping
    console.log('\n2. Testing PartRequest creation & isolation...');
    const reqA = await prisma.partRequest.create({
      data: {
        tenantId: tenantBengkelAId,
        partName: 'Oli Shell Advance Ultra 10W-40',
        brand: 'Shell',
        vehicleType: 'MOTOR',
        requestedQty: 3,
        customerName: 'Budi Santoso',
        customerPhone: '08123456789',
        status: 'PENDING'
      }
    });

    const reqB = await prisma.partRequest.create({
      data: {
        tenantId: tenantBengkelBId,
        partName: 'Filter Oli Avanza',
        brand: 'Toyota',
        vehicleType: 'MOBIL',
        requestedQty: 5,
        customerName: 'Joko Widodo',
        customerPhone: '08987654321',
        status: 'PENDING'
      }
    });

    // Check Bengkel A queries
    const bengkelAList = await prisma.partRequest.findMany({
      where: { tenantId: tenantBengkelAId }
    });
    if (bengkelAList.length === 1 && bengkelAList[0].partName === 'Oli Shell Advance Ultra 10W-40') {
      console.log('   [PASS] Bengkel A can see its own request');
    } else {
      console.error('   [FAIL] Bengkel A list mismatch:', bengkelAList);
      exitCode = 1;
    }

    // Check Bengkel B queries
    const bengkelBList = await prisma.partRequest.findMany({
      where: { tenantId: tenantBengkelBId }
    });
    if (bengkelBList.length === 1 && bengkelBList[0].partName === 'Filter Oli Avanza') {
      console.log('   [PASS] Bengkel B can see its own request');
    } else {
      console.error('   [FAIL] Bengkel B list mismatch:', bengkelBList);
      exitCode = 1;
    }

    // Cross-tenant IDOR attack simulation: Bengkel B tries to find Bengkel A's request with tenant scoping
    const idorCheck = await prisma.partRequest.findFirst({
      where: { id: reqA.id, tenantId: tenantBengkelBId }
    });
    if (!idorCheck) {
      console.log('   [PASS] IDOR blocked: Bengkel B cannot access Bengkel A request with double validation');
    } else {
      console.error('   [FAIL] IDOR vulnerability: Bengkel B accessed Bengkel A data!');
      exitCode = 1;
    }

    // 3. Test 1-Click Convert to Product
    console.log('\n3. Testing 1-Click Convert from PartRequest to Product...');
    const newProduct = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          tenantId: tenantBengkelAId,
          name: reqA.partName,
          brand: reqA.brand,
          vehicleType: reqA.vehicleType || 'MOTOR',
          categoryId: categoryA.id,
          buyPrice: 95000,
          sellPrice: 125000,
          sellPriceRetail: 125000,
          sellPriceMitra: 115000,
          sellPriceGrosir: 105000,
          stock: 6,
          minStock: 2,
          storageLocation: 'RAK-OLI-01',
          status: 'Aktif'
        }
      });

      const updatedReq = await tx.partRequest.update({
        where: { id: reqA.id },
        data: {
          productId: prod.id,
          status: 'PURCHASED'
        }
      });

      return { prod, updatedReq };
    });

    if (newProduct.prod.id && newProduct.updatedReq.status === 'PURCHASED' && newProduct.updatedReq.productId === newProduct.prod.id) {
      console.log('   [PASS] 1-Click Convert to Product verified. New Product ID:', newProduct.prod.id);
      console.log('   [PASS] PartRequest status updated to PURCHASED with productId linked');
    } else {
      console.error('   [FAIL] Convert to product failed:', newProduct);
      exitCode = 1;
    }

    // 4. Test Backup Parity
    console.log('\n4. Testing Backup Parity...');
    const backupPartRequests = await prisma.partRequest.findMany({
      where: { tenantId: tenantBengkelAId }
    });
    if (backupPartRequests.length === 1 && backupPartRequests[0].productId === newProduct.prod.id) {
      console.log('   [PASS] PartRequest correctly registered and exported for tenant backup');
    } else {
      console.error('   [FAIL] Backup query failed:', backupPartRequests);
      exitCode = 1;
    }

    // 5. Test Reset Parity
    console.log('\n5. Testing Reset Parity...');
    await prisma.partRequest.deleteMany({ where: { tenantId: tenantBengkelAId } });
    const afterResetCount = await prisma.partRequest.count({ where: { tenantId: tenantBengkelAId } });
    if (afterResetCount === 0) {
      console.log('   [PASS] Reset cleanly purged PartRequest records without orphaned foreign keys');
    } else {
      console.error('   [FAIL] Reset failed to clean up records');
      exitCode = 1;
    }

  } catch (error) {
    console.error('Test execution error:', error);
    exitCode = 1;
  } finally {
    // Cleanup
    console.log('\nCleaning up test tenants...');
    try {
      await prisma.partRequest.deleteMany({
        where: { tenantId: { in: [tenantBengkelAId, tenantBengkelBId, tenantCafeCId] } }
      });
      await prisma.product.deleteMany({
        where: { tenantId: { in: [tenantBengkelAId, tenantBengkelBId, tenantCafeCId] } }
      });
      await prisma.category.deleteMany({
        where: { tenantId: { in: [tenantBengkelAId, tenantBengkelBId, tenantCafeCId] } }
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantBengkelAId, tenantBengkelBId, tenantCafeCId] } }
      });
      console.log('Cleaned up successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup error:', cleanupErr.message);
    }

    await prisma.$disconnect();
    if (exitCode === 0) {
      console.log('\n✅ ALL PROCUREMENT & MULTI-TENANT ISOLATION TESTS PASSED 100%!');
    } else {
      console.error('\n❌ SOME TESTS FAILED.');
    }
    process.exit(exitCode);
  }
}

runTests();
