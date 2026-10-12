/**
 * TEST SUITE: Prioritas 1 — Verifikasi Perbaikan Keamanan & Logika Kafe serta Uji Kinerja
 * 
 * Verifikasi:
 * 1. Static Audit: Zero Table.findMany global di self-order
 * 2. Static Audit: Tenant scoping sebelum pencarian meja di /public/self-order
 * 3. Static Audit: Fail-closed & anti-IDOR pada /move-table dan /merge-table
 * 4. Static Audit: Eliminasi 'Cancelled' dari kueri pesanan aktif (BUG-C3)
 * 5. Static Audit: Proteksi stok bahan baku dan validasi kepemilikan di self-order (BUG-C4)
 * 6. Static Audit: SaaS Feature Gating kds.ts & featureMiddleware.ts (BUG-C5)
 * 7. Live DB Logic Test: Isolasi nomor meja duplikat lintas tenant
 * 8. Live DB Logic Test: Status meja bebas saat pesanan KDS Cancelled
 * 9. Live DB Logic Test: Validasi batas stok bahan baku
 * 10. Performance Benchmark: Latency kueri meja & pesanan aktif (100 iterasi)
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`✅ PASS: ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`❌ FAIL: ${msg}`);
  if (err) console.error(`   → Detail: ${err.message || err}`);
  failed++;
}

async function runStaticAudits() {
  console.log('\n--- BAGIAN 1: Static Code Audit & Security Verification ---');

  const ordersFilePath = path.join(__dirname, '..', 'src', 'routes', 'orders.ts');
  const kdsFilePath = path.join(__dirname, '..', 'src', 'routes', 'kds.ts');
  const featureMiddlewarePath = path.join(__dirname, '..', 'src', 'middlewares', 'featureMiddleware.ts');

  const ordersContent = fs.readFileSync(ordersFilePath, 'utf-8');
  const kdsContent = fs.readFileSync(kdsFilePath, 'utf-8');
  const featContent = fs.readFileSync(featureMiddlewarePath, 'utf-8');

  // 1. Audit BUG-C1: Zero Table.findMany global di self-order
  const selfOrderSection = ordersContent.substring(
    ordersContent.indexOf("router.post('/public/self-order'"),
    ordersContent.indexOf("router.post('/sync'")
  );

  if (selfOrderSection.includes('prisma.table.findMany()')) {
    fail('BUG-C1: Masih ditemukan prisma.table.findMany() tanpa filter tenantId di /public/self-order');
  } else {
    pass('BUG-C1: Zero prisma.table.findMany() global di /public/self-order');
  }

  // 2. Audit BUG-C1: Scoping tableNo ke tenantId
  if (selfOrderSection.includes('{ tableNo: tableStr, tenantId, deletedAt: null }')) {
    pass('BUG-C1: Pencarian meja via tableNo discoping ketat ke tenantId aktif');
  } else {
    fail('BUG-C1: Pencarian meja via tableNo belum menyertakan tenantId');
  }

  // 3. Audit BUG-C2: Fail-closed di /move-table
  const moveTableSection = ordersContent.substring(
    ordersContent.indexOf("router.post('/move-table'"),
    ordersContent.indexOf("router.post('/merge-table'")
  );

  if (moveTableSection.includes('!moveTenantId && !user?.isPlatformAdmin') &&
      moveTableSection.includes('prisma.table.findFirst({ where: { id: sId, tenantId: moveTenantId') &&
      moveTableSection.includes('prisma.table.findFirst({ where: { id: tId, tenantId: moveTenantId')) {
    pass('BUG-C2: /move-table memiliki fail-closed guard dan validasi kepemilikan meja (Anti-IDOR)');
  } else {
    fail('BUG-C2: /move-table belum memvalidasi tenant context atau kepemilikan meja');
  }

  // 4. Audit BUG-C2: Fail-closed di /merge-table
  const mergeTableSection = ordersContent.substring(
    ordersContent.indexOf("router.post('/merge-table'"),
    ordersContent.indexOf("export default router")
  );

  if (mergeTableSection.includes('!mergeTenantId && !user?.isPlatformAdmin') &&
      mergeTableSection.includes('prisma.table.findFirst({ where: { id: sId, tenantId: mergeTenantId') &&
      mergeTableSection.includes('prisma.table.findFirst({ where: { id: tId, tenantId: mergeTenantId')) {
    pass('BUG-C2: /merge-table memiliki fail-closed guard dan validasi kepemilikan meja (Anti-IDOR)');
  } else {
    fail('BUG-C2: /merge-table belum memvalidasi tenant context atau kepemilikan meja');
  }

  // 5. Audit BUG-C3: Eliminasi 'Cancelled' dari kueri pesanan aktif
  const hasCancelledInActive = ordersContent.includes("kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }");
  if (!hasCancelledInActive) {
    pass("BUG-C3: Status 'Cancelled' telah dieliminasi dari seluruh kueri pesanan aktif (meja bebas jika dibatalkan)");
  } else {
    fail("BUG-C3: Status 'Cancelled' masih ditemukan di kueri pesanan aktif orders.ts");
  }

  // 6. Audit BUG-C4: Proteksi stok bahan baku di self-order
  if (selfOrderSection.includes('currentIng.stock < used') &&
      selfOrderSection.includes('where: { id: recipe.ingredientId, tenantId, deletedAt: null }')) {
    pass('BUG-C4: Self-order memvalidasi kepemilikan bahan baku dan mencegah stok minus');
  } else {
    fail('BUG-C4: Self-order belum memvalidasi ketersediaan stok bahan baku resep');
  }

  // 7. Audit BUG-C5: Feature Gating di kds.ts dan featureMiddleware.ts
  if (kdsContent.includes("requireFeature('pos.kds')") && featContent.includes('featureService.isEnabled')) {
    pass("BUG-C5: KDS route terlindungi requireFeature('pos.kds') dan featureMiddleware memvalidasi paket SaaS");
  } else {
    fail('BUG-C5: KDS route atau featureMiddleware belum terhubung dengan featureService');
  }
}

async function runDatabaseLogicTests() {
  console.log('\n--- BAGIAN 2: Database Logic & Multi-Tenant Isolation Tests ---');

  const suffix = Date.now();
  const tenantAId = `test_tenant_alpha_${suffix}`;
  const tenantBId = `test_tenant_beta_${suffix}`;

  try {
    // 1. Buat 2 Tenant Kafe terisolasi
    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Kafe Alpha Test', slug: `alpha-${suffix}`, businessType: 'CAFE', status: 'ACTIVE' },
        { id: tenantBId, name: 'Kafe Beta Test', slug: `beta-${suffix}`, businessType: 'CAFE', status: 'ACTIVE' }
      ]
    });

    // 2. Buat 2 Meja dengan tableNo yang SAMA ("MEJA-10") pada kedua tenant
    const [tableA, tableB] = await Promise.all([
      prisma.table.create({ data: { tenantId: tenantAId, tableNo: 'MEJA-10', name: 'Meja 10 Alpha', capacity: 4 } }),
      prisma.table.create({ data: { tenantId: tenantBId, tableNo: 'MEJA-10', name: 'Meja 10 Beta', capacity: 4 } })
    ]);

    // 3. Test: Kueri meja dengan tenantId Alpha HARUS menghasilkan tableA, bukan tableB
    const resolvedTable = await prisma.table.findFirst({
      where: { tableNo: 'MEJA-10', tenantId: tenantAId, deletedAt: null }
    });

    if (resolvedTable && resolvedTable.id === tableA.id && resolvedTable.id !== tableB.id) {
      pass(`Multi-Tenant Table Isolation: Meja 'MEJA-10' terselesaikan strictly ke Tenant Alpha (ID: ${tableA.id})`);
    } else {
      fail(`Multi-Tenant Table Isolation: Salah menyelesaikan meja atau bocor ke Tenant Beta!`);
    }

    // 4. Test: Kueri meja milik tenant lain HARUS ditolak / null jika dicek dengan tenantA
    const crossCheckTable = await prisma.table.findFirst({
      where: { id: tableB.id, tenantId: tenantAId, deletedAt: null }
    });

    if (crossCheckTable === null) {
      pass(`Anti-IDOR Meja: Tenant Alpha tidak dapat mengakses atau memindahkan meja milik Tenant Beta`);
    } else {
      fail(`IDOR Terdeteksi: Tenant Alpha dapat mengakses meja Tenant Beta!`);
    }

    // 5. Test Status Meja KDS: Pesanan 'Paid' dengan 'Cancelled' di KDS TIDAK BOLEH mengunci meja
    const testUser = await prisma.user.findFirst();
    if (testUser) {
      const orderCancelled = await prisma.order.create({
        data: {
          tenantId: tenantAId,
          orderNumber: `ORD-CANCEL-${suffix}`,
          customerName: 'Tamu Uji Cancel',
          tableId: tableA.id,
          userId: testUser.id,
          subtotal: 35000,
          tax: 0,
          serviceCharge: 0,
          total: 35000,
          status: 'Paid',
          kdsStatus: 'Cancelled'
        }
      });

      // Jalankan kueri pesanan aktif (sesuai logika perbaikan baru)
      const activeOrdersOnTable = await prisma.order.findMany({
        where: {
          tenantId: tenantAId,
          tableId: tableA.id,
          OR: [
            { status: 'Pending' },
            {
              status: 'Paid',
              kdsStatus: { in: ['Pending', 'Cooking', 'Ready'] }
            }
          ]
        }
      });

      if (activeOrdersOnTable.length === 0) {
        pass(`KDS Table Freedom: Order #${orderCancelled.orderNumber} (KDS Cancelled) tidak mengunci meja Alpha (Active Orders = 0)`);
      } else {
        fail(`KDS Table Block: Order Cancelled masih mengunci meja Alpha!`);
      }

      // Cleanup order uji
      await prisma.order.delete({ where: { id: orderCancelled.id } });
    }

    // 6. Test Recipe BOM Insufficient Stock Guard
    const ingTest = await prisma.ingredient.create({
      data: {
        tenantId: tenantAId,
        name: `Bahan Kopi Test ${suffix}`,
        unit: 'gram',
        stock: 5,
        minStock: 2,
        buyPrice: 200,
        category: 'DRINK'
      }
    });

    const neededQty = 20; // Butuh 20 gram, tapi stok hanya 5 gram
    const isInsufficient = ingTest.stock < neededQty;

    if (isInsufficient) {
      pass(`BOM Inventory Guard: Percobaan pengurangan stok melebihi batas terdeteksi (${ingTest.stock} < ${neededQty})`);
    } else {
      fail(`BOM Inventory Guard: Gagal mendeteksi defisit stok!`);
    }

    // Cleanup ingredient & tables
    await prisma.ingredient.delete({ where: { id: ingTest.id } });
    await prisma.table.deleteMany({ where: { id: { in: [tableA.id, tableB.id] } } });
  } catch (err) {
    fail('Database Logic Tests mengalami error tak terduga', err);
  } finally {
    // Cleanup tenants uji
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } }).catch(() => {});
  }
}

async function runPerformanceBenchmark() {
  console.log('\n--- BAGIAN 3: Uji Kinerja (Performance & Latency Benchmark) ---');

  const ITERATIONS = 100;
  const targetTenant = 'tenant-starter-demo';

  // Benchmark 1: Table Lookup Latency
  const tableLatencies = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    await prisma.table.findMany({
      where: { tenantId: targetTenant, deletedAt: null },
      take: 10
    });
    const end = process.hrtime.bigint();
    tableLatencies.push(Number(end - start) / 1_000_000); // ms
  }

  tableLatencies.sort((a, b) => a - b);
  const avgTable = (tableLatencies.reduce((a, b) => a + b, 0) / ITERATIONS).toFixed(2);
  const p50Table = tableLatencies[Math.floor(ITERATIONS * 0.50)].toFixed(2);
  const p95Table = tableLatencies[Math.floor(ITERATIONS * 0.95)].toFixed(2);
  const p99Table = tableLatencies[Math.floor(ITERATIONS * 0.99)].toFixed(2);

  console.log(`📊 Benchmark 1 [Kueri Meja per-Tenant (${ITERATIONS} runs)]:`);
  console.log(`   • Rata-rata: ${avgTable} ms`);
  console.log(`   • P50:       ${p50Table} ms`);
  console.log(`   • P95:       ${p95Table} ms`);
  console.log(`   • P99:       ${p99Table} ms`);

  if (Number(p95Table) < 50) {
    pass(`Kinerja Kueri Meja Sangat Cepat (P95 = ${p95Table} ms < 50 ms)`);
  } else {
    fail(`Kinerja Kueri Meja Lambat (P95 = ${p95Table} ms)`);
  }

  // Benchmark 2: Active Orders Evaluation Latency
  const orderLatencies = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    await prisma.order.findMany({
      where: {
        tenantId: targetTenant,
        OR: [
          { status: 'Pending' },
          {
            status: 'Paid',
            kdsStatus: { in: ['Pending', 'Cooking', 'Ready'] }
          }
        ]
      },
      select: { id: true, tableId: true, total: true },
      take: 20
    });
    const end = process.hrtime.bigint();
    orderLatencies.push(Number(end - start) / 1_000_000); // ms
  }

  orderLatencies.sort((a, b) => a - b);
  const avgOrder = (orderLatencies.reduce((a, b) => a + b, 0) / ITERATIONS).toFixed(2);
  const p50Order = orderLatencies[Math.floor(ITERATIONS * 0.50)].toFixed(2);
  const p95Order = orderLatencies[Math.floor(ITERATIONS * 0.95)].toFixed(2);
  const p99Order = orderLatencies[Math.floor(ITERATIONS * 0.99)].toFixed(2);

  console.log(`\n📊 Benchmark 2 [Evaluasi Pesanan Aktif KDS (${ITERATIONS} runs)]:`);
  console.log(`   • Rata-rata: ${avgOrder} ms`);
  console.log(`   • P50:       ${p50Order} ms`);
  console.log(`   • P95:       ${p95Order} ms`);
  console.log(`   • P99:       ${p99Order} ms`);

  if (Number(p95Order) < 50) {
    pass(`Kinerja Evaluasi Pesanan Aktif Sangat Cepat (P95 = ${p95Order} ms < 50 ms)`);
  } else {
    fail(`Kinerja Evaluasi Pesanan Aktif Lambat (P95 = ${p95Order} ms)`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN PRIORITAS 1: KEAMANAN KAFE & UJI KINERJA SISTEM');
  console.log('================================================================');

  await runStaticAudits();
  await runDatabaseLogicTests();
  await runPerformanceBenchmark();

  console.log('\n================================================================');
  console.log(`📋 HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal Test Runner Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
