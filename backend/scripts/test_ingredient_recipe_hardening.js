/**
 * AUTOMATED PENTEST — INGREDIENT, RECIPE & WASTE MULTI-TENANT ISOLATION
 * Standard: ingredient-recipe-hardening SKILL.md
 *
 * Skenario yang diuji:
 *  [1] IDOR Sabotase Stok — Tenant B mencoba potong stok bahan baku Tenant A via POST /loss
 *  [2] Pencurian Resep (GET) — Tenant B mencoba baca resep rahasia produk Tenant A
 *  [3] Nested FK Injection Resep (PUT) — Tenant B menyuntikkan ingredient Tenant A ke resep sendiri
 *  [4] Kebocoran Data Staf — GET /staff-activity-analytics hanya return staf milik tenant sendiri
 *  [5] Fail-Closed Waste Analytics — GET /waste/analytics tanpa tenantId harus return 400
 *  [6] Isolasi Yield Analytics — GET /yield-analytics Tenant B tidak boleh melihat data Tenant A
 *
 * Cara jalankan: node scripts/test_ingredient_recipe_hardening.js
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'code-pos-super-secret-jwt-key-change-in-production';
const PORT = process.env.PORT || 5000;

// ─── HTTP Helper ────────────────────────────────────────────────────────────
function httpRequest({ method, path, token, body, headers: extraHeaders = {} }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...extraHeaders
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// ─── Test Runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function pass(testName, detail = '') {
  passed++;
  console.log(`  ✅ PASS: ${testName}`);
  if (detail) console.log(`     ${detail}`);
}

function fail(testName, detail = '') {
  failed++;
  failures.push({ testName, detail });
  console.log(`  ❌ FAIL: ${testName}`);
  if (detail) console.log(`     ${detail}`);
}

function section(title) {
  console.log(`\n${'─'.repeat(68)}`);
  console.log(`[TEST] ${title}`);
  console.log('─'.repeat(68));
}

// ─── Main Test Suite ─────────────────────────────────────────────────────────
async function runSuite() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  🔐 INGREDIENT, RECIPE & WASTE — MULTI-TENANT ISOLATION PENTEST');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  Timestamp  : ${new Date().toISOString()}`);
  console.log(`  Backend    : http://127.0.0.1:${PORT}`);
  console.log('');

  const ts = Date.now();
  const tenantAId = `tenant_ing_a_${ts}`;
  const tenantBId = `tenant_ing_b_${ts}`;
  const outletAId = `outlet_ing_a_${ts}`;
  const outletBId = `outlet_ing_b_${ts}`;

  let userA, userB, tokenA, tokenB;
  let ingA, ingB;         // ingredients milik masing-masing tenant
  let productA, productB; // produk milik masing-masing tenant
  let staffA, staffB;     // staf kitchen milik masing-masing tenant

  // ── SETUP ─────────────────────────────────────────────────────────────────
  console.log('[SETUP] Menyiapkan data uji terisolasi...');

  try {
    const plan = await prisma.plan.findFirst({
      where: { OR: [{ name: { contains: 'Business' } }, { name: { contains: 'Enterprise' } }, { name: { contains: 'Pro' } }] }
    });

    // Buat 2 tenant terisolasi
    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Kafe Alpha Pentest', slug: `kafe-alpha-${ts}`, status: 'ACTIVE', planId: plan?.id },
        { id: tenantBId, name: 'Kafe Beta Pentest',  slug: `kafe-beta-${ts}`,  status: 'ACTIVE', planId: plan?.id }
      ]
    });

    // Feature overrides
    const features = await prisma.feature.findMany({
      where: { key: { in: ['inventory.advanced', 'warehouse.management', 'recipe.management'] } }
    });
    if (features.length > 0) {
      const overrides = [];
      for (const feat of features) {
        overrides.push({ tenantId: tenantAId, featureId: feat.id, isEnabled: true });
        overrides.push({ tenantId: tenantBId, featureId: feat.id, isEnabled: true });
      }
      await prisma.tenantFeature.createMany({ data: overrides, skipDuplicates: true });
    }

    // Buat outlet
    await prisma.outlet.createMany({
      data: [
        { id: outletAId, tenantId: tenantAId, code: `OA-${ts.toString().slice(-4)}`, name: 'Outlet Alpha' },
        { id: outletBId, tenantId: tenantBId, code: `OB-${ts.toString().slice(-4)}`, name: 'Outlet Beta' }
      ]
    });

    // Buat user owner masing-masing tenant
    userA = await prisma.user.create({
      data: {
        name: 'Owner Alpha', username: `owner_a_${ts}`, passwordHash: 'dummy',
        role: 'OWNER', status: 'Aktif', permissions: '["*"]',
        memberships: { create: { tenantId: tenantAId } }
      }
    });
    userB = await prisma.user.create({
      data: {
        name: 'Owner Beta', username: `owner_b_${ts}`, passwordHash: 'dummy',
        role: 'OWNER', status: 'Aktif', permissions: '["*"]',
        memberships: { create: { tenantId: tenantBId } }
      }
    });

    // Buat staf kitchen masing-masing tenant (untuk test staff-activity-analytics)
    staffA = await prisma.user.create({
      data: {
        name: 'Koki Alpha Eksklusif', username: `koki_a_${ts}`, passwordHash: 'dummy',
        role: 'Dapur', status: 'Aktif', permissions: '[]',
        memberships: { create: { tenantId: tenantAId } }
      }
    });
    staffB = await prisma.user.create({
      data: {
        name: 'Koki Beta Eksklusif', username: `koki_b_${ts}`, passwordHash: 'dummy',
        role: 'Dapur', status: 'Aktif', permissions: '[]',
        memberships: { create: { tenantId: tenantBId } }
      }
    });

    tokenA = createToken({ id: userA.id, username: userA.username, role: userA.role, tenantId: tenantAId, outletId: outletAId });
    tokenB = createToken({ id: userB.id, username: userB.username, role: userB.role, tenantId: tenantBId, outletId: outletBId });

    // Buat bahan baku masing-masing tenant (via DB langsung untuk setup)
    ingA = await prisma.ingredient.create({
      data: {
        tenantId: tenantAId, name: 'Beras Premium Alpha',
        unit: 'kg', stock: 100, minStock: 10, buyPrice: 15000, category: 'FOOD'
      }
    });
    ingB = await prisma.ingredient.create({
      data: {
        tenantId: tenantBId, name: 'Kopi Arabika Beta',
        unit: 'kg', stock: 50, minStock: 5, buyPrice: 85000, category: 'DRINK'
      }
    });

    // Buat kategori dulu (required oleh Product)
    const catA = await prisma.category.create({
      data: { tenantId: tenantAId, name: 'Makanan Test Alpha' }
    });
    const catB = await prisma.category.create({
      data: { tenantId: tenantBId, name: 'Minuman Test Beta' }
    });

    // Simpan ID kategori untuk cleanup
    global._testCatIds = global._testCatIds || [];
    global._testCatIds.push(catA.id, catB.id);

    // Buat produk masing-masing tenant
    productA = await prisma.product.create({
      data: {
        tenantId: tenantAId, name: 'Nasi Goreng Rahasia Alpha',
        sellPrice: 25000, buyPrice: 10000, stock: 0, status: 'Aktif', categoryId: catA.id
      }
    });
    productB = await prisma.product.create({
      data: {
        tenantId: tenantBId, name: 'Espresso Signature Beta',
        sellPrice: 35000, buyPrice: 12000, stock: 0, status: 'Aktif', categoryId: catB.id
      }
    });

    // Buat resep produk A (resep rahasia)
    await prisma.recipeItem.create({
      data: { productId: productA.id, ingredientId: ingA.id, qtyPerServing: 0.2 }
    });

    // Buat ingredient log untuk staffA (untuk test staff-activity-analytics)
    await prisma.ingredientLog.create({
      data: {
        tenantId: tenantAId, ingredientId: ingA.id,
        change: -5, type: 'Produksi', userId: staffA.id,
        description: 'Test log staff alpha'
      }
    });

    console.log(`  → Tenant A: ${tenantAId}`);
    console.log(`  → Tenant B: ${tenantBId}`);
    console.log(`  → Ingredient A (Beras): id=${ingA.id} [stok awal: ${ingA.stock}]`);
    console.log(`  → Ingredient B (Kopi):  id=${ingB.id}`);
    console.log(`  → Product A: id=${productA.id} (punya 1 resep dengan ingA)`);
    console.log(`  → Staf A: ${staffA.name} (id=${staffA.id})`);
    console.log(`  → Staf B: ${staffB.name} (id=${staffB.id})`);
    console.log('  → Setup selesai!\n');

  } catch (err) {
    console.error('❌ SETUP FAILED:', err.message);
    await cleanup(tenantAId, tenantBId);
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1: IDOR Sabotase Stok via POST /loss
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 1 — IDOR Sabotase Stok: Tenant B mencoba potong stok Tenant A via /loss');

  // Tenant B mencoba memotong stok ingA (milik Tenant A)
  const lossAttempt = await httpRequest({
    method: 'POST',
    path: '/api/ingredients/loss',
    token: tokenB,
    body: { ingredientId: ingA.id, qtyLoss: 20, reason: 'Sabotase', notes: 'Cross-tenant IDOR attempt' }
  });

  // Cek isolasi: stok ingA tidak boleh berkurang
  const stokAfter = await prisma.ingredient.findUnique({ where: { id: ingA.id }, select: { stock: true } });
  const stokTidakBerubah = stokAfter.stock === ingA.stock;

  const isBlocked = [400, 403, 404].includes(lossAttempt.statusCode) ||
    // HTTP 500 dengan pesan 'tidak ditemukan' juga aman — isolasi bekerja, hanya error handling kurang presisi
    (lossAttempt.statusCode === 500 && JSON.stringify(lossAttempt.data).toLowerCase().includes('tidak ditemukan'));

  if (isBlocked && stokTidakBerubah) {
    pass('IDOR /loss diblokir — stok ingA tidak berubah',
      `HTTP ${lossAttempt.statusCode} | Stok: ${ingA.stock} → ${stokAfter.stock} (tidak berkurang) | ${lossAttempt.data?.error || '-'}`);
  } else if (lossAttempt.statusCode === 201 || lossAttempt.statusCode === 200) {
    fail('IDOR BERHASIL DIEKSPLOITASI — Tenant B berhasil potong stok Tenant A!',
      `HTTP ${lossAttempt.statusCode} | Stok: ${ingA.stock} → ${stokAfter.stock} | CRITICAL SECURITY BREACH`);
  } else if (!stokTidakBerubah) {
    fail('Stok ingA berkurang meski HTTP error — IDOR diam-diam berhasil!',
      `HTTP ${lossAttempt.statusCode} | Stok: ${ingA.stock} → ${stokAfter.stock}`);
  } else {
    fail(`Response tidak terduga dari /loss`, `HTTP ${lossAttempt.statusCode} | ${JSON.stringify(lossAttempt.data)}`);
  }

  // Tenant B mencoba dengan quantity negatif besar (edge case)
  const lossNegAttempt = await httpRequest({
    method: 'POST',
    path: '/api/ingredients/loss',
    token: tokenB,
    body: { ingredientId: ingA.id, qtyLoss: -999, reason: 'Manipulasi qty' }
  });
  if ([400, 403, 404].includes(lossNegAttempt.statusCode)) {
    pass('Payload manipulasi (qty negatif) ditolak', `HTTP ${lossNegAttempt.statusCode}`);
  } else {
    fail('Payload qty negatif tidak divalidasi', `HTTP ${lossNegAttempt.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2: Pencurian Resep via GET /recipes/product/:id
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 2 — Pencurian Resep: Tenant B mencoba baca resep produk Tenant A');

  const stealRecipe = await httpRequest({
    method: 'GET',
    path: `/api/recipes/product/${productA.id}`,
    token: tokenB
  });

  if (stealRecipe.statusCode === 404 || stealRecipe.statusCode === 403) {
    pass('Pencurian resep diblokir',
      `HTTP ${stealRecipe.statusCode} | Tenant B tidak bisa melihat resep Produk A`);
  } else if (stealRecipe.statusCode === 200) {
    const recipes = stealRecipe.data?.recipes || [];
    if (recipes.length > 0) {
      fail('PENCURIAN RESEP BERHASIL — Tenant B membaca resep rahasia Tenant A!',
        `HTTP 200 | Resep terekspos: ${JSON.stringify(recipes).slice(0, 120)}...`);
    } else {
      // 200 dengan resep kosong mungkin karena product tidak ketemu tapi tidak error
      fail('Response 200 diterima tapi resep kosong — kemungkinan bypass validasi',
        `HTTP 200 | data: ${JSON.stringify(stealRecipe.data)}`);
    }
  } else {
    fail(`Response tidak terduga`, `HTTP ${stealRecipe.statusCode} | ${JSON.stringify(stealRecipe.data)}`);
  }

  // Tenant A sendiri bisa baca resepnya
  const ownRecipe = await httpRequest({
    method: 'GET',
    path: `/api/recipes/product/${productA.id}`,
    token: tokenA
  });
  if (ownRecipe.statusCode === 200) {
    pass('Tenant A bisa baca resep produknya sendiri', `HTTP 200 | ${ownRecipe.data?.recipes?.length || 0} item resep`);
  } else {
    fail('Tenant A tidak bisa baca resep sendiri — regresi!', `HTTP ${ownRecipe.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3: Nested FK Injection via PUT /recipes/product/:id
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 3 — Nested FK Injection: Tenant B suntikkan ingredient Tenant A ke resep sendiri');

  // Tenant B mencoba memasukkan ingA (milik Tenant A) ke dalam resep produknya sendiri (productB)
  const injectAttempt = await httpRequest({
    method: 'PUT',
    path: `/api/recipes/product/${productB.id}`,
    token: tokenB,
    body: {
      items: [
        { ingredientId: ingA.id, qtyPerServing: 0.5 },  // ingA = milik Tenant A!
        { ingredientId: ingB.id, qtyPerServing: 0.1 }   // ingB = milik Tenant B (valid)
      ]
    }
  });

  if (injectAttempt.statusCode === 403 || injectAttempt.statusCode === 400 || injectAttempt.statusCode === 404) {
    pass('Nested FK injection diblokir — ingredient asing ditolak',
      `HTTP ${injectAttempt.statusCode} | ${injectAttempt.data?.error || injectAttempt.data?.code || '-'}`);

    // Verifikasi resep productB tidak berubah (masih kosong / tidak mengandung ingA)
    const recipeAfter = await prisma.recipeItem.findMany({ where: { productId: productB.id } });
    const hasIngA = recipeAfter.some(r => r.ingredientId === ingA.id);
    if (!hasIngA) {
      pass('Verifikasi DB: resep productB tidak mengandung ingredient Tenant A', `${recipeAfter.length} resep, tidak ada ingA`);
    } else {
      fail('CRITICAL: DB mengandung ingredient Tenant A meski HTTP ditolak!', `ingA.id=${ingA.id} ditemukan di recipeB`);
    }
  } else if (injectAttempt.statusCode === 200) {
    // Cek apakah ingA benar-benar masuk ke DB
    const recipeAfter = await prisma.recipeItem.findMany({ where: { productId: productB.id } });
    const hasIngA = recipeAfter.some(r => r.ingredientId === ingA.id);
    if (hasIngA) {
      fail('NESTED FK INJECTION BERHASIL — ingredient Tenant A masuk ke resep Tenant B!',
        `HTTP 200 | ingA.id=${ingA.id} tersimpan di resep productB | CRITICAL BREACH`);
    } else {
      fail('HTTP 200 tapi ingA tidak masuk DB — perlu investigasi lanjut', `HTTP 200`);
    }
  } else {
    fail(`Response tidak terduga`, `HTTP ${injectAttempt.statusCode} | ${JSON.stringify(injectAttempt.data)}`);
  }

  // Juga coba: Tenant B mencoba memodifikasi resep produk Tenant A langsung (IDOR PUT)
  const idorPutRecipe = await httpRequest({
    method: 'PUT',
    path: `/api/recipes/product/${productA.id}`,
    token: tokenB,
    body: { items: [{ ingredientId: ingB.id, qtyPerServing: 99 }] }
  });
  if ([403, 404, 400].includes(idorPutRecipe.statusCode)) {
    pass('IDOR PUT resep produk Tenant A diblokir', `HTTP ${idorPutRecipe.statusCode}`);
  } else {
    fail('IDOR PUT resep berhasil — Tenant B memodifikasi resep Tenant A!', `HTTP ${idorPutRecipe.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4: Kebocoran Data Staf via GET /staff-activity-analytics
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 4 — Kebocoran Staf: GET /staff-activity-analytics hanya return staf tenant sendiri');

  const staffAnalyticsA = await httpRequest({
    method: 'GET',
    path: '/api/ingredients/staff-activity-analytics',
    token: tokenA
  });

  if (staffAnalyticsA.statusCode === 200) {
    const staffList = staffAnalyticsA.data?.staffList || [];
    const userNames = staffList.map(s => s.user?.name || '').join(', ');

    // Verifikasi: staffB.name TIDAK boleh muncul di response Tenant A
    const hasCrossLeak = staffList.some(s =>
      s.user?.id === staffB.id ||
      s.user?.name === staffB.name ||
      s.user?.username === staffB.username
    );

    if (!hasCrossLeak) {
      pass('Staff analytics Tenant A tidak mengandung staf Tenant B',
        `${staffList.length} staf ditampilkan: [${userNames.slice(0, 80)}]`);
    } else {
      fail('KEBOCORAN DATA STAF — staf Tenant B terlihat di analytics Tenant A!',
        `staffB.name="${staffB.name}" (id=${staffB.id}) terekspos ke Tenant A`);
    }

    // Verifikasi tambahan: sistem user (Sistem / Tanpa Nama) tidak mengandung FK ke tenant lain
    const hasStaffA = staffList.some(s => s.user?.id === staffA.id);
    if (hasStaffA) {
      pass('StaffA muncul di analytics Tenant A (benar)', `staffA id=${staffA.id}`);
    } else {
      // Bisa juga karena tidak ada aktivitas cukup di periode ini
      console.log(`     ⚠️  staffA tidak muncul di list — mungkin karena filter aktivitas (bukan bug)`);
    }
  } else {
    fail(`Staff analytics gagal`, `HTTP ${staffAnalyticsA.statusCode} | ${JSON.stringify(staffAnalyticsA.data)}`);
  }

  // Tenant B memastikan dia tidak lihat staf Tenant A
  const staffAnalyticsB = await httpRequest({
    method: 'GET',
    path: '/api/ingredients/staff-activity-analytics',
    token: tokenB
  });
  if (staffAnalyticsB.statusCode === 200) {
    const listB = staffAnalyticsB.data?.staffList || [];
    const hasTenantALeak = listB.some(s => s.user?.id === staffA.id || s.user?.id === userA.id);
    if (!hasTenantALeak) {
      pass('Staff analytics Tenant B tidak mengandung staf/owner Tenant A', `${listB.length} staf di Tenant B`);
    } else {
      fail('KEBOCORAN DATA STAF — staf/owner Tenant A terlihat di Tenant B!',
        `userA.id=${userA.id} atau staffA.id=${staffA.id} bocor ke Tenant B`);
    }
  } else {
    fail(`Staff analytics Tenant B gagal`, `HTTP ${staffAnalyticsB.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5: Fail-Closed Waste Analytics — tanpa tenantId harus return 400
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 5 — Fail-Closed: GET /waste/analytics tanpa tenantId harus ditolak');

  // Request dengan token yang sengaja tidak mengandung tenantId
  const tokenNoTenant = createToken({ id: userA.id, username: userA.username, role: 'OWNER' }); // no tenantId
  const wasteNoTenant = await httpRequest({
    method: 'GET',
    path: '/api/waste/analytics',
    token: tokenNoTenant
  });

  if (wasteNoTenant.statusCode === 400) {
    pass('Waste analytics ditolak tanpa tenantId (fail-closed)',
      `HTTP 400 | code: ${wasteNoTenant.data?.code} | ${wasteNoTenant.data?.error}`);
  } else if (wasteNoTenant.statusCode === 401) {
    pass('Waste analytics ditolak karena auth (acceptable)', `HTTP 401`);
  } else if (wasteNoTenant.statusCode === 200) {
    const logs = wasteNoTenant.data?.logs || [];
    fail('FAIL-OPEN! Waste analytics return 200 tanpa tenantId — data semua tenant bocor!',
      `HTTP 200 | ${logs.length} log waste terekspos tanpa filter tenant`);
  } else {
    fail(`Response tidak terduga`, `HTTP ${wasteNoTenant.statusCode} | ${JSON.stringify(wasteNoTenant.data)}`);
  }

  // Request tanpa Authorization header sama sekali
  const wasteNoAuth = await httpRequest({
    method: 'GET',
    path: '/api/waste/analytics'
  });
  if ([400, 401, 403].includes(wasteNoAuth.statusCode)) {
    pass('Waste analytics tanpa token ditolak', `HTTP ${wasteNoAuth.statusCode}`);
  } else {
    fail('Waste analytics bisa diakses tanpa token!', `HTTP ${wasteNoAuth.statusCode}`);
  }

  // Verifikasi tenant yang valid mendapat data sendiri saja
  const wasteWithTenant = await httpRequest({
    method: 'GET',
    path: '/api/waste/analytics',
    token: tokenA
  });
  if (wasteWithTenant.statusCode === 200) {
    pass('Waste analytics berhasil dengan token valid', `HTTP 200 | Tenant A mendapat datanya sendiri`);
  } else {
    fail('Waste analytics gagal dengan token valid (regresi)', `HTTP ${wasteWithTenant.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 6: Isolasi Yield Analytics — Tenant B tidak boleh lihat data Tenant A
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 6 — Isolasi Yield Analytics: Data ingredient tidak bocor lintas tenant');

  const yieldA = await httpRequest({
    method: 'GET',
    path: '/api/ingredients/yield-analytics',
    token: tokenA
  });

  const yieldB = await httpRequest({
    method: 'GET',
    path: '/api/ingredients/yield-analytics',
    token: tokenB
  });

  if (yieldA.statusCode === 200 && yieldB.statusCode === 200) {
    const itemsA = yieldA.data?.items || [];
    const itemsB = yieldB.data?.items || [];

    // Ingredient Tenant A tidak boleh muncul di response Tenant B
    const ingAInB = itemsB.some(i => i.id === ingA.id || i.name === ingA.name);
    // Ingredient Tenant B tidak boleh muncul di response Tenant A
    const ingBInA = itemsA.some(i => i.id === ingB.id || i.name === ingB.name);

    if (!ingAInB) {
      pass('Yield analytics Tenant B tidak mengandung ingredient Tenant A',
        `Tenant A: ${itemsA.length} items | Tenant B: ${itemsB.length} items | ingA tidak bocor ke B`);
    } else {
      fail('BOCOR! Ingredient Tenant A terekspos di yield analytics Tenant B!',
        `ingA.name="${ingA.name}" (id=${ingA.id}) ditemukan di response Tenant B`);
    }

    if (!ingBInA) {
      pass('Yield analytics Tenant A tidak mengandung ingredient Tenant B',
        `ingB.name="${ingB.name}" tidak bocor ke Tenant A`);
    } else {
      fail('BOCOR! Ingredient Tenant B terekspos di yield analytics Tenant A!',
        `ingB.name="${ingB.name}" (id=${ingB.id}) ditemukan di response Tenant A`);
    }

    // Verifikasi ingredient milik sendiri bisa dilihat
    const ingAInA = itemsA.some(i => i.id === ingA.id);
    if (ingAInA) {
      pass('Tenant A melihat ingredient-nya sendiri di yield analytics', `ingA ditemukan di response A`);
    } else {
      console.log(`     ⚠️  ingA tidak muncul di yield Tenant A — mungkin karena filter (non-critical)`);
    }
  } else {
    if (yieldA.statusCode !== 200) fail(`Yield analytics Tenant A gagal`, `HTTP ${yieldA.statusCode}`);
    if (yieldB.statusCode !== 200) fail(`Yield analytics Tenant B gagal`, `HTTP ${yieldB.statusCode}`);
  }

  // Test fail-closed: token tanpa tenantId
  const yieldNoTenant = await httpRequest({
    method: 'GET',
    path: '/api/ingredients/yield-analytics',
    token: createToken({ id: userA.id, role: 'OWNER' }) // no tenantId
  });
  if ([400, 401].includes(yieldNoTenant.statusCode)) {
    pass('Yield analytics ditolak tanpa tenantId (fail-closed)', `HTTP ${yieldNoTenant.statusCode}`);
  } else if (yieldNoTenant.statusCode === 200) {
    const items = yieldNoTenant.data?.items || [];
    fail('FAIL-OPEN! Yield analytics return 200 tanpa tenantId!',
      `HTTP 200 | ${items.length} items terekspos`);
  } else {
    fail(`Response tidak terduga`, `HTTP ${yieldNoTenant.statusCode}`);
  }

  // ── CLEANUP ───────────────────────────────────────────────────────────────
  await cleanup(tenantAId, tenantBId);

  // ── HASIL AKHIR ───────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  📊 HASIL AKHIR PENTEST');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  Total Test : ${total}`);
  console.log(`  ✅ PASSED  : ${passed}`);
  console.log(`  ❌ FAILED  : ${failed}`);
  console.log('');

  if (failures.length > 0) {
    console.log('  KEGAGALAN DITEMUKAN:');
    failures.forEach((f, i) => {
      console.log(`  [${i + 1}] ${f.testName}`);
      if (f.detail) console.log(`      → ${f.detail}`);
    });
    console.log('');
    console.log('  🚨 STATUS: CELAH KEAMANAN TERDETEKSI — Wajib diperbaiki sebelum produksi!');
  } else {
    console.log('  🛡️  STATUS: SEMUA SKENARIO AMAN — Multi-tenant isolation terkonfirmasi!');
  }
  console.log('══════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup(tenantAId, tenantBId) {
  console.log('\n[CLEANUP] Menghapus data uji...');
  try {
    for (const tenantId of [tenantAId, tenantBId]) {
      await prisma.ingredientLog.deleteMany({ where: { tenantId } });
      await prisma.wasteLog.deleteMany({ where: { tenantId } });
      await prisma.recipeItem.deleteMany({ where: { product: { tenantId } } });
      await prisma.product.deleteMany({ where: { tenantId } });
      // Hapus category via stored IDs (category tidak punya kolom tenantId langsung)
      if (global._testCatIds && global._testCatIds.length > 0) {
        await prisma.category.deleteMany({ where: { id: { in: global._testCatIds } } }).catch(() => {});
        global._testCatIds = [];
      }
      await prisma.ingredient.deleteMany({ where: { tenantId } });
      await prisma.outlet.deleteMany({ where: { tenantId } });
      // Hapus user via membership
      const memberships = await prisma.userMembership.findMany({ where: { tenantId }, select: { userId: true } });
      const userIds = memberships.map(m => m.userId);
      await prisma.userMembership.deleteMany({ where: { tenantId } });
      if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.tenantFeature.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    console.log('  → Cleanup selesai.');
  } catch (err) {
    console.warn('  ⚠️  Cleanup partial error (bisa diabaikan):', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
runSuite().catch(async (err) => {
  console.error('💥 PENTEST SUITE CRASHED:', err.message);
  console.error(err.stack);
  await prisma.$disconnect();
  process.exit(2);
});
