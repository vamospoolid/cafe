const { PrismaClient } = require('@prisma/client');
const { TenantContext } = require('./dist/src/utils/tenantContext');
const { tenantPrisma } = require('./dist/src/utils/prismaTenant');

const basePrisma = new PrismaClient();

async function testPhase4() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 4: TENANT-AWARE CONTEXT & PRISMA EXTENSION === 🧪\n');

  // 1. Setup Test Tenants
  console.log('--- [1/4] Preparing Multi-Tenant Test Data ---');
  const tenantA = await basePrisma.tenant.upsert({
    where: { slug: 'mukiramen' },
    update: {},
    create: { id: 'tenant-default-muki', name: 'MUKI RAMEN', slug: 'mukiramen' }
  });

  const tenantB = await basePrisma.tenant.upsert({
    where: { slug: 'cafedemo' },
    update: {},
    create: { id: 'tenant-demo-cafeb', name: 'CAFE DEMO B2B', slug: 'cafedemo' }
  });

  // Create unique test products
  const barcodeA = `PROD-TEST-A-${Date.now()}`;
  const barcodeB = `PROD-TEST-B-${Date.now()}`;

  const catA = await basePrisma.category.findFirst({ where: { tenantId: tenantA.id } }) || await basePrisma.category.create({ data: { name: 'Food A', tenantId: tenantA.id } });
  const catB = await basePrisma.category.findFirst({ where: { tenantId: tenantB.id } }) || await basePrisma.category.create({ data: { name: 'Food B', tenantId: tenantB.id } });

  await basePrisma.product.create({
    data: { name: 'Exclusive Item Tenant A', barcode: barcodeA, categoryId: catA.id, sellPrice: 50000, tenantId: tenantA.id }
  });

  await basePrisma.product.create({
    data: { name: 'Exclusive Item Tenant B', barcode: barcodeB, categoryId: catB.id, sellPrice: 75000, tenantId: tenantB.id }
  });

  console.log(`Created test items: "${barcodeA}" (Tenant A) and "${barcodeB}" (Tenant B).`);
  console.log('✅ TEST 1 (Test Data Ready): PASSED!\n');

  // 2. Test AsyncLocalStorage TenantContext Scoping
  console.log('--- [2/4] Testing AsyncLocalStorage TenantContext Isolation ---');
  await TenantContext.run({ tenantId: tenantA.id, role: 'OWNER' }, async () => {
    const currentId = TenantContext.getTenantId();
    if (currentId !== tenantA.id) throw new Error('TenantContext failed in Tenant A scope');

    // Sub-async call to verify context inheritance
    await new Promise(resolve => setTimeout(resolve, 50));
    if (TenantContext.getTenantId() !== tenantA.id) throw new Error('TenantContext lost in async sub-call');
  });

  await TenantContext.run({ tenantId: tenantB.id, role: 'OWNER' }, async () => {
    const currentId = TenantContext.getTenantId();
    if (currentId !== tenantB.id) throw new Error('TenantContext failed in Tenant B scope');
  });

  console.log('✅ TEST 2 (AsyncLocalStorage Isolation & Inheritance): PASSED!\n');

  // 3. Test Prisma Multi-Tenant Query Scoping Extension
  console.log('--- [3/4] Testing Prisma Multi-Tenant Extension Automated Filter ---');
  
  // Query executed in Tenant A Context
  let tenantAProducts = [];
  await TenantContext.run({ tenantId: tenantA.id }, async () => {
    tenantAProducts = await tenantPrisma.product.findMany();
  });

  // Query executed in Tenant B Context
  let tenantBProducts = [];
  await TenantContext.run({ tenantId: tenantB.id }, async () => {
    tenantBProducts = await tenantPrisma.product.findMany();
  });

  const hasItemBInA = tenantAProducts.some(p => p.barcode === barcodeB);
  const hasItemAInB = tenantBProducts.some(p => p.barcode === barcodeA);

  console.log(`Tenant A result count: ${tenantAProducts.length} items (Contains Item B: ${hasItemBInA})`);
  console.log(`Tenant B result count: ${tenantBProducts.length} items (Contains Item A: ${hasItemAInB})`);

  if (!hasItemBInA && !hasItemAInB) {
    console.log('✅ TEST 3 (Automated Multi-Tenant Query Scoping): PASSED (Zero Cross-Tenant Leakage)!\n');
  } else {
    throw new Error('❌ TEST 3: Cross-tenant data leakage detected in Prisma extension!');
  }

  // 4. Test Automated tenantId Injection on Create
  console.log('--- [4/4] Testing Automated tenantId Injection on Model Creation ---');
  const autoBarcode = `AUTO-INJECT-${Date.now()}`;
  let autoCreatedProduct = null;

  await TenantContext.run({ tenantId: tenantB.id }, async () => {
    autoCreatedProduct = await tenantPrisma.product.create({
      data: {
        name: 'Auto Injected Product',
        barcode: autoBarcode,
        categoryId: catB.id,
        sellPrice: 30000
      }
    });
  });

  console.log(`Auto Created Product ID: ${autoCreatedProduct.id}, Tenant ID: "${autoCreatedProduct.tenantId}" (Expected: "${tenantB.id}")`);
  if (autoCreatedProduct.tenantId === tenantB.id) {
    console.log('✅ TEST 4 (Automated tenantId Injection): PASSED!\n');
  } else {
    throw new Error('❌ TEST 4: Automated tenantId injection failed.');
  }

  // Cleanup
  await basePrisma.product.deleteMany({ where: { barcode: { in: [barcodeA, barcodeB, autoBarcode] } } });

  console.log('🎉 SEMUA PENGUJIAN FASE 4 SELESAI DENGAN SUKSES! API & SERVICE LAYER SUDAH FULLY TENANT-AWARE! 🎉');
}

testPhase4()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
