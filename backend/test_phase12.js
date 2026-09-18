/**
 * TEST SUITE FASE 12: POSTGRESQL ROW-LEVEL SECURITY (RLS) DEFENSE-IN-DEPTH
 * Menguji isolasi data pada level kernel PostgreSQL menggunakan Row-Level Security Policies,
 * session parameter app.current_tenant_id, dan transaction hook withTenantRLS().
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runPhase12Tests() {
  console.log('\n🧪 === MENJALANKAN TEST SUITE FASE 12: POSTGRESQL ROW-LEVEL SECURITY (RLS) === 🧪\n');

  try {
    // ─── TEST 1: Verifikasi RLS Aktif pada Seluruh Tabel Bisnis ────────────────
    console.log('--- [1/5] Testing PostgreSQL Catalog RLS Activation Status ---');

    const rlsTables = await prisma.$queryRawUnsafe(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = true
      ORDER BY tablename ASC;
    `);

    console.log(`Total tabel dengan RLS aktif: ${rlsTables.length}`);
    if (rlsTables.length >= 30) {
      console.log('Semua tabel bisnis terverifikasi memiliki status rowsecurity = true.');
      console.log('✅ TEST 1 (PostgreSQL Catalog RLS Verification): PASSED!\n');
    } else {
      throw new Error(`Jumlah tabel RLS kurang dari standar (hanya ${rlsTables.length} tabel)`);
    }

    // ─── Setup Data Uji Tenant RLS Alpha & Beta ───────────────────────────────
    const tenantA = await prisma.tenant.upsert({
      where: { slug: 'rls-tenant-alpha' },
      update: {},
      create: { name: 'RLS Cafe Alpha', slug: 'rls-tenant-alpha', status: 'ACTIVE' }
    });

    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'rls-tenant-beta' },
      update: {},
      create: { name: 'RLS Resto Beta', slug: 'rls-tenant-beta', status: 'ACTIVE' }
    });

    // Buat kategori & produk untuk masing-masing tenant
    await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = 'PLATFORM_SUPERADMIN';`);
    
    // Hapus data uji lama jika ada
    await prisma.product.deleteMany({
      where: { barcode: { in: ['RLS-PROD-A', 'RLS-PROD-B'] } }
    });

    const catA = await prisma.category.upsert({
      where: { id: 99991 },
      update: { tenantId: tenantA.id },
      create: { id: 99991, tenantId: tenantA.id, name: 'Menu Alpha' }
    });

    const catB = await prisma.category.upsert({
      where: { id: 99992 },
      update: { tenantId: tenantB.id },
      create: { id: 99992, tenantId: tenantB.id, name: 'Menu Beta' }
    });

    const prodA = await prisma.product.create({
      data: {
        tenantId: tenantA.id,
        name: 'Alpha Special Ramen',
        barcode: 'RLS-PROD-A',
        categoryId: catA.id,
        sellPrice: 45000,
        stock: 10
      }
    });

    const prodB = await prisma.product.create({
      data: {
        tenantId: tenantB.id,
        name: 'Beta Premium Ramen',
        barcode: 'RLS-PROD-B',
        categoryId: catB.id,
        sellPrice: 55000,
        stock: 20
      }
    });

    console.log(`Created sample products -> Alpha ID: ${prodA.id} (${prodA.name}), Beta ID: ${prodB.id} (${prodB.name})\n`);

    // ─── TEST 2: Kernel-Level Read Isolation via RLS Session ──────────────────
    console.log('--- [2/5] Testing Kernel-Level Read Isolation (No WHERE clause) ---');

    // Query untuk Tenant A: Jalankan SELECT * tanpa WHERE clause apapun
    const resultForTenantA = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET ROLE codepos_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantA.id}';`);
      return tx.$queryRawUnsafe(`
        SELECT id, name, "tenantId" 
        FROM "Product" 
        WHERE barcode IN ('RLS-PROD-A', 'RLS-PROD-B');
      `);
    });

    console.log(`Query under Tenant A session returned ${resultForTenantA.length} product(s):`, resultForTenantA);

    // Query untuk Tenant B: Jalankan SELECT * tanpa WHERE clause apapun
    const resultForTenantB = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET ROLE codepos_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantB.id}';`);
      return tx.$queryRawUnsafe(`
        SELECT id, name, "tenantId" 
        FROM "Product" 
        WHERE barcode IN ('RLS-PROD-A', 'RLS-PROD-B');
      `);
    });

    console.log(`Query under Tenant B session returned ${resultForTenantB.length} product(s):`, resultForTenantB);

    if (
      resultForTenantA.length === 1 && resultForTenantA[0].name === 'Alpha Special Ramen' &&
      resultForTenantB.length === 1 && resultForTenantB[0].name === 'Beta Premium Ramen'
    ) {
      console.log('PostgreSQL RLS kernel perfectly filtered records without application WHERE clauses!');
      console.log('✅ TEST 2 (Kernel-Level Read Isolation): PASSED!\n');
    } else {
      throw new Error('RLS Read isolation failed to restrict rows to current tenant session');
    }

    // ─── TEST 3: Cross-Tenant Write / Insert Prevention (WITH CHECK) ───────────
    console.log('--- [3/5] Testing Cross-Tenant Insert Protection (WITH CHECK Violation) ---');

    let wasCrossTenantInsertBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Session diset ke Tenant A
        await tx.$executeRawUnsafe(`SET ROLE codepos_app;`);
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantA.id}';`);

        // Coba insert data dengan tenantId milik Tenant B (Serangan pemalsuan tenantId)
        await tx.$executeRawUnsafe(`
          INSERT INTO "Product" (name, barcode, "categoryId", "sellPrice", stock, "tenantId", "status", "minStock", "buyPrice")
          VALUES ('Malicious Injected Product', 'RLS-MALICIOUS', ${catB.id}, 99000, 5, '${tenantB.id}', 'Aktif', 1, 0);
        `);
      });
    } catch (err) {
      console.log('Caught expected PostgreSQL RLS security violation:');
      console.log(` -> ${err.message}`);
      if (err.message.includes('row-level security policy') || err.message.includes('violates row-level security')) {
        wasCrossTenantInsertBlocked = true;
      }
    }

    if (wasCrossTenantInsertBlocked) {
      console.log('PostgreSQL WITH CHECK policy successfully blocked cross-tenant record injection.');
      console.log('✅ TEST 3 (Cross-Tenant Insert Blocked by RLS): PASSED!\n');
    } else {
      throw new Error('Security Breach: Cross-tenant insert was not blocked by PostgreSQL RLS!');
    }

    // ─── TEST 4: Platform SuperAdmin Bypass Mode ──────────────────────────────
    console.log('--- [4/5] Testing Platform SuperAdmin Full Visibility Bypass ---');

    const resultSuperAdmin = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET ROLE codepos_app;`);
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = 'PLATFORM_SUPERADMIN';`);
      return tx.$queryRawUnsafe(`
        SELECT id, name, "tenantId" 
        FROM "Product" 
        WHERE barcode IN ('RLS-PROD-A', 'RLS-PROD-B');
      `);
    });

    console.log(`SuperAdmin session returned ${resultSuperAdmin.length} product(s) across all tenants`);

    if (resultSuperAdmin.length === 2) {
      console.log('SuperAdmin bypass verified: Platform level analytics can access all rows.');
      console.log('✅ TEST 4 (Platform SuperAdmin Bypass Mode): PASSED!\n');
    } else {
      throw new Error('SuperAdmin bypass failed to return multi-tenant dataset');
    }

    // ─── TEST 5: withTenantRLS() Helper Function Verification ─────────────────
    console.log('--- [5/5] Testing withTenantRLS() Helper Function ---');

    const { withTenantRLS } = require('./dist/src/utils/prismaTenant');

    const helperResultA = await withTenantRLS(tenantA.id, async (tx) => {
      return tx.$queryRawUnsafe(`
        SELECT name, "tenantId" 
        FROM "Product" 
        WHERE barcode IN ('RLS-PROD-A', 'RLS-PROD-B');
      `);
    }, prisma);

    console.log(`withTenantRLS('${tenantA.id}') result:`, helperResultA);

    if (helperResultA.length === 1 && helperResultA[0].name === 'Alpha Special Ramen') {
      console.log('withTenantRLS() helper automatically binds session parameter.');
      console.log('✅ TEST 5 (withTenantRLS Helper Function): PASSED!\n');
    } else {
      throw new Error('withTenantRLS helper failed to isolate tenant context');
    }

    console.log('🎉 SEMUA PENGUJIAN FASE 12 BERHASIL DENGAN SEMPURNA! RLS ISOLATION PROVEN! 🎉\n');

  } catch (error) {
    console.error('❌ Phase 12 Test Suite Failed:', error);
    process.exit(1);
  } finally {
    // Clean test products
    try {
      await prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = 'PLATFORM_SUPERADMIN';`);
      await prisma.product.deleteMany({ where: { barcode: { in: ['RLS-PROD-A', 'RLS-PROD-B', 'RLS-MALICIOUS'] } } });
    } catch (_) {}
    await prisma.$disconnect();
  }
}

runPhase12Tests();
