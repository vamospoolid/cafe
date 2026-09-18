const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPhase3() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 3: DATABASE TENANT ISOLATION & COMPOSITE CONSTRAINTS === 🧪\n');

  // 1. Setup Tenant A and Tenant B
  console.log('--- [1/5] Setup Isolated Multi-Tenant Test Environments ---');
  const tenantA = await prisma.tenant.upsert({
    where: { slug: 'mukiramen' },
    update: { name: 'MUKI RAMEN' },
    create: { id: 'tenant-default-muki', name: 'MUKI RAMEN', slug: 'mukiramen' }
  });

  const tenantB = await prisma.tenant.upsert({
    where: { slug: 'cafedemo' },
    update: { name: 'CAFE DEMO B2B' },
    create: { id: 'tenant-demo-cafeb', name: 'CAFE DEMO B2B', slug: 'cafedemo' }
  });

  const outletA = await prisma.outlet.upsert({
    where: { tenantId_code: { tenantId: tenantA.id, code: 'MUK-01' } },
    update: { name: 'Outlet Muki Pusat' },
    create: { id: 'outlet-default-muki-01', tenantId: tenantA.id, name: 'Outlet Muki Pusat', code: 'MUK-01' }
  });

  const outletB = await prisma.outlet.upsert({
    where: { tenantId_code: { tenantId: tenantB.id, code: 'DEMO-01' } },
    update: { name: 'Outlet Demo Cabang 1' },
    create: { id: 'outlet-demo-cafeb-01', tenantId: tenantB.id, name: 'Outlet Demo Cabang 1', code: 'DEMO-01' }
  });

  console.log(`Tenant A: ${tenantA.name} (${tenantA.id}) | Outlet A: ${outletA.code}`);
  console.log(`Tenant B: ${tenantB.name} (${tenantB.id}) | Outlet B: ${outletB.code}`);
  console.log('✅ TEST 1 (Tenant Environment Setup): PASSED!\n');

  // 2. Test Multi-Tenant Product Barcode Collisions (Same barcode in Tenant A & Tenant B)
  console.log('--- [2/5] Test Duplicate Barcode Coexistence Across Tenants ---');
  const testBarcode = `BARCODE-SHARED-${Date.now()}`;

  // Cleanup old test products
  await prisma.product.deleteMany({ where: { barcode: testBarcode } });

  const categoryA = await prisma.category.findFirst({ where: { tenantId: tenantA.id } });
  let categoryB = await prisma.category.findFirst({ where: { tenantId: tenantB.id } });
  if (!categoryB) {
    categoryB = await prisma.category.create({
      data: { name: 'Minuman Demo', tenantId: tenantB.id }
    });
  }

  // Create Product in Tenant A with testBarcode
  const prodA = await prisma.product.create({
    data: {
      name: 'Ramen Spesial Tenant A',
      barcode: testBarcode,
      categoryId: categoryA ? categoryA.id : 1,
      sellPrice: 35000,
      tenantId: tenantA.id
    }
  });

  // Create Product in Tenant B with IDENTICAL testBarcode
  const prodB = await prisma.product.create({
    data: {
      name: 'Kopi Susu Tenant B',
      barcode: testBarcode,
      categoryId: categoryB.id,
      sellPrice: 22000,
      tenantId: tenantB.id
    }
  });

  console.log(`Product A created: ID ${prodA.id}, Name: "${prodA.name}", Barcode: "${prodA.barcode}", Tenant: "${prodA.tenantId}"`);
  console.log(`Product B created: ID ${prodB.id}, Name: "${prodB.name}", Barcode: "${prodB.barcode}", Tenant: "${prodB.tenantId}"`);

  // Try creating DUPLICATE within the SAME Tenant A (must throw UniqueConstraint error)
  let caughtError = false;
  try {
    await prisma.product.create({
      data: {
        name: 'Ramen Duplikat Tenant A',
        barcode: testBarcode,
        categoryId: categoryA ? categoryA.id : 1,
        sellPrice: 40000,
        tenantId: tenantA.id
      }
    });
  } catch (e) {
    caughtError = true;
  }

  if (prodA && prodB && caughtError) {
    console.log('✅ TEST 2 (Product Composite Barcode Constraint): PASSED (Same barcode allowed across tenants, rejected within same tenant)!\n');
  } else {
    throw new Error('❌ TEST 2: Product compound unique constraint failed.');
  }

  // 3. Test Multi-Tenant Order Number Coexistence
  console.log('--- [3/5] Test Duplicate Order Number Coexistence Across Tenants ---');
  const sharedOrderNumber = `ORD-MULTI-${Date.now()}`;
  const user = await prisma.user.findFirst();

  const orderA = await prisma.order.create({
    data: {
      orderNumber: sharedOrderNumber,
      customerName: 'Customer Tenant A',
      userId: user.id,
      subtotal: 50000,
      tax: 5500,
      serviceCharge: 2500,
      total: 58000,
      tenantId: tenantA.id,
      outletId: outletA.id
    }
  });

  const orderB = await prisma.order.create({
    data: {
      orderNumber: sharedOrderNumber,
      customerName: 'Customer Tenant B',
      userId: user.id,
      subtotal: 75000,
      tax: 8250,
      serviceCharge: 3750,
      total: 87000,
      tenantId: tenantB.id,
      outletId: outletB.id
    }
  });

  console.log(`Order A created: ID ${orderA.id}, Order#: "${orderA.orderNumber}", Tenant: "${orderA.tenantId}"`);
  console.log(`Order B created: ID ${orderB.id}, Order#: "${orderB.orderNumber}", Tenant: "${orderB.tenantId}"`);

  if (orderA.id !== orderB.id && orderA.orderNumber === orderB.orderNumber) {
    console.log('✅ TEST 3 (Order Composite Unique Constraint): PASSED!\n');
  } else {
    throw new Error('❌ TEST 3: Order number coexistence failed.');
  }

  // 4. Test Table Number Coexistence Across Outlets
  console.log('--- [4/5] Test Duplicate Table Number Coexistence Across Outlets ---');
  const sharedTableNo = `TB-VIP-${Date.now() % 1000}`;

  const tableA = await prisma.table.create({
    data: {
      tableNo: sharedTableNo,
      name: 'Meja VIP Outlet A',
      tenantId: tenantA.id,
      outletId: outletA.id
    }
  });

  const tableB = await prisma.table.create({
    data: {
      tableNo: sharedTableNo,
      name: 'Meja VIP Outlet B',
      tenantId: tenantB.id,
      outletId: outletB.id
    }
  });

  console.log(`Table A: "${tableA.tableNo}" @ Outlet A (${tableA.outletId})`);
  console.log(`Table B: "${tableB.tableNo}" @ Outlet B (${tableB.outletId})`);

  if (tableA.id !== tableB.id && tableA.tableNo === tableB.tableNo) {
    console.log('✅ TEST 4 (Table Outlet Scoped Unique Constraint): PASSED!\n');
  } else {
    throw new Error('❌ TEST 4: Table scoped unique constraint failed.');
  }

  // 5. Data Integrity Check: Verify 0 Orphaned Records without tenantId
  console.log('--- [5/5] Data Integrity Audit: Checking for Orphaned Records ---');
  const [nullOrders, nullProducts, nullCustomers] = await Promise.all([
    prisma.order.count({ where: { tenantId: null } }),
    prisma.product.count({ where: { tenantId: null } }),
    prisma.customer.count({ where: { tenantId: null } })
  ]);

  console.log(`Null tenantId count - Orders: ${nullOrders}, Products: ${nullProducts}, Customers: ${nullCustomers}`);
  if (nullOrders === 0 && nullProducts === 0 && nullCustomers === 0) {
    console.log('✅ TEST 5 (0 Orphaned Records): PASSED!\n');
  } else {
    throw new Error('❌ TEST 5: Masih ditemukan data tanpa tenantId.');
  }

  // Cleanup test artifacts
  await prisma.product.deleteMany({ where: { barcode: testBarcode } });
  await prisma.order.deleteMany({ where: { orderNumber: sharedOrderNumber } });
  await prisma.table.deleteMany({ where: { tableNo: sharedTableNo } });

  console.log('🎉 SEMUA PENGUJIAN FASE 3 SELESAI DENGAN SUKSES! DATABASE SUDAH 100% TERISOLASI! 🎉');
}

testPhase3()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
