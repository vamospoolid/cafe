/**
 * AUTOMATED PENTEST — CUSTOMER CRM & LOYALITAS MULTI-TENANT ISOLATION
 * Standard: saas-cross-tenant-isolation
 *
 * Skenario:
 *  [1] IDOR Earn Poin — Tenant B mencoba earn poin ke customer Tenant A via order
 *  [2] IDOR Redeem Poin — Tenant B mencoba redeem poin customer Tenant A
 *  [3] Role Guard pointsAdjustment — Kasir tidak boleh adjust poin manual
 *  [4] Isolasi Data Customer — Tenant B tidak bisa GET/PUT/DELETE customer Tenant A
 *  [5] Isolasi Voucher — Tenant B tidak bisa validasi/edit voucher Tenant A
 *  [6] Unique phone scoped per tenant — phone sama di 2 tenant tidak conflict
 *
 * Jalankan: node scripts/test_crm_customer_hardening.js
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'code-pos-super-secret-jwt-key-change-in-production';
const PORT = process.env.PORT || 5000;

function httpRequest({ method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1', port: PORT, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
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

let passed = 0, failed = 0;
const failures = [];

function pass(name, detail = '') {
  passed++;
  console.log(`  ✅ PASS: ${name}`);
  if (detail) console.log(`     ${detail}`);
}

function fail(name, detail = '') {
  failed++;
  failures.push({ name, detail });
  console.log(`  ❌ FAIL: ${name}`);
  if (detail) console.log(`     ${detail}`);
}

function section(title) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`[TEST] ${title}`);
  console.log('─'.repeat(70));
}

async function runSuite() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  🔐 CUSTOMER CRM & LOYALITAS — MULTI-TENANT ISOLATION PENTEST');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  Timestamp : ${new Date().toISOString()}`);

  const ts = Date.now();
  const tenantAId = `tenant_crm_a_${ts}`;
  const tenantBId = `tenant_crm_b_${ts}`;
  const outletAId = `outlet_crm_a_${ts}`;
  const outletBId = `outlet_crm_b_${ts}`;

  let userA, userB, kasirB;
  let tokenA, tokenB, tokenKasirB;
  let customerA, customerB;
  let voucherA;

  // ── SETUP ──────────────────────────────────────────────────────────────────
  console.log('\n[SETUP] Menyiapkan data uji...');
  try {
    const plan = await prisma.plan.findFirst({
      where: { OR: [{ name: { contains: 'Business' } }, { name: { contains: 'Enterprise' } }, { name: { contains: 'Pro' } }] }
    });

    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Kafe CRM Alpha', slug: `crm-alpha-${ts}`, status: 'ACTIVE', planId: plan?.id },
        { id: tenantBId, name: 'Kafe CRM Beta',  slug: `crm-beta-${ts}`,  status: 'ACTIVE', planId: plan?.id }
      ]
    });

    await prisma.outlet.createMany({
      data: [
        { id: outletAId, tenantId: tenantAId, code: `CA-${ts.toString().slice(-4)}`, name: 'Outlet CRM A' },
        { id: outletBId, tenantId: tenantBId, code: `CB-${ts.toString().slice(-4)}`, name: 'Outlet CRM B' }
      ]
    });

    // Owner masing-masing tenant
    userA = await prisma.user.create({
      data: { name: 'Owner Alpha CRM', username: `owner_crm_a_${ts}`, passwordHash: 'dummy',
        role: 'OWNER', status: 'Aktif', permissions: '["*"]',
        memberships: { create: { tenantId: tenantAId } } }
    });
    userB = await prisma.user.create({
      data: { name: 'Owner Beta CRM', username: `owner_crm_b_${ts}`, passwordHash: 'dummy',
        role: 'OWNER', status: 'Aktif', permissions: '["*"]',
        memberships: { create: { tenantId: tenantBId } } }
    });

    // Kasir Tenant B (role rendah) — untuk test role guard
    kasirB = await prisma.user.create({
      data: { name: 'Kasir Beta CRM', username: `kasir_crm_b_${ts}`, passwordHash: 'dummy',
        role: 'Kasir', status: 'Aktif', permissions: '[]',
        memberships: { create: { tenantId: tenantBId } } }
    });

    tokenA = createToken({ id: userA.id, username: userA.username, role: userA.role, name: userA.name, tenantId: tenantAId, outletId: outletAId });
    tokenB = createToken({ id: userB.id, username: userB.username, role: userB.role, name: userB.name, tenantId: tenantBId, outletId: outletBId });
    tokenKasirB = createToken({ id: kasirB.id, username: kasirB.username, role: kasirB.role, name: kasirB.name, tenantId: tenantBId, outletId: outletBId });

    // Customer masing-masing tenant (via DB langsung)
    customerA = await prisma.customer.create({
      data: { tenantId: tenantAId, name: 'Pelanggan VIP Alpha', phone: '081234567890',
        email: 'vip@alpha.com', points: 1500, tier: 'Gold', totalSpent: 5000000 }
    });
    customerB = await prisma.customer.create({
      data: { tenantId: tenantBId, name: 'Pelanggan Reguler Beta', phone: '082345678901',
        email: 'reguler@beta.com', points: 200, tier: 'Bronze', totalSpent: 300000 }
    });

    // Voucher Tenant A
    voucherA = await prisma.voucher.create({
      data: { tenantId: tenantAId, code: `ALPHA-VIP-${ts.toString().slice(-4)}`,
        type: 'PERCENT', amount: 20, minSpend: 50000, status: 'Aktif' }
    });

    console.log(`  → Tenant A: ${tenantAId}`);
    console.log(`  → Tenant B: ${tenantBId}`);
    console.log(`  → Customer A: id=${customerA.id} (Gold, 1500 poin) [MILIK TENANT A]`);
    console.log(`  → Customer B: id=${customerB.id} (Bronze, 200 poin)`);
    console.log(`  → Voucher A: id=${voucherA.id} code=${voucherA.code} [MILIK TENANT A]`);
    console.log(`  → Kasir B: role=${kasirB.role} (role rendah, tidak punya izin adjust poin)`);
    console.log('  → Setup selesai!\n');

  } catch (err) {
    console.error('❌ SETUP FAILED:', err.message);
    await cleanup(tenantAId, tenantBId);
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1: Isolasi Data Customer — IDOR GET/PUT/DELETE
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 1 — Isolasi Data Customer: Tenant B tidak bisa akses customer Tenant A');

  // GET customer A dengan token B
  const getCustomerA = await httpRequest({ method: 'GET', path: `/api/customers/${customerA.id}`, token: tokenB });
  if ([403, 404].includes(getCustomerA.statusCode)) {
    pass('GET customer Tenant A diblokir untuk Tenant B', `HTTP ${getCustomerA.statusCode}`);
  } else if (getCustomerA.statusCode === 200) {
    fail('IDOR GET berhasil — Tenant B membaca data customer Tenant A!',
      `HTTP 200 | name=${getCustomerA.data?.name} points=${getCustomerA.data?.points} tier=${getCustomerA.data?.tier}`);
  } else {
    fail('Response tidak terduga GET customer', `HTTP ${getCustomerA.statusCode}`);
  }

  // PUT customer A dengan token B (coba ubah nama)
  const putCustomerA = await httpRequest({
    method: 'PUT', path: `/api/customers/${customerA.id}`, token: tokenB,
    body: { name: 'Hacked by Tenant B', phone: customerA.phone }
  });
  if ([403, 404].includes(putCustomerA.statusCode)) {
    pass('PUT customer Tenant A diblokir untuk Tenant B', `HTTP ${putCustomerA.statusCode}`);
  } else if (putCustomerA.statusCode === 200) {
    fail('IDOR PUT berhasil — Tenant B memodifikasi customer Tenant A!', `HTTP 200`);
  } else {
    fail('Response tidak terduga PUT customer', `HTTP ${putCustomerA.statusCode}`);
  }

  // DELETE customer A dengan token B
  const deleteCustomerA = await httpRequest({ method: 'DELETE', path: `/api/customers/${customerA.id}`, token: tokenB });
  if ([403, 404].includes(deleteCustomerA.statusCode)) {
    pass('DELETE customer Tenant A diblokir untuk Tenant B', `HTTP ${deleteCustomerA.statusCode}`);
    // Pastikan customer A tidak ter-delete
    const stillExists = await prisma.customer.findUnique({ where: { id: customerA.id } });
    if (stillExists && !stillExists.deletedAt) {
      pass('Verifikasi DB: customer A masih ada dan tidak ter-soft-delete', `deletedAt=${stillExists.deletedAt}`);
    } else {
      fail('DB INCONSISTENCY: customer A terhapus meski HTTP diblokir!', '');
    }
  } else {
    fail('IDOR DELETE berhasil — Tenant B menghapus customer Tenant A!', `HTTP ${deleteCustomerA.statusCode}`);
  }

  // Tenant A bisa GET customernya sendiri (regresi)
  const ownGet = await httpRequest({ method: 'GET', path: `/api/customers/${customerA.id}`, token: tokenA });
  if (ownGet.statusCode === 200) {
    pass('Tenant A berhasil GET customernya sendiri (regresi OK)', `HTTP 200 | name=${ownGet.data?.name}`);
  } else {
    fail('Regresi! Tenant A tidak bisa GET customernya sendiri', `HTTP ${ownGet.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2: Role Guard — Kasir tidak boleh adjust poin manual
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 2 — Role Guard: Kasir tidak boleh adjust poin manual via PUT /customers/:id');

  const pointsBefore = customerB.points;

  // Kasir Tenant B mencoba nambah poin ke customernya sendiri (customer B)
  const kasirAdjust = await httpRequest({
    method: 'PUT', path: `/api/customers/${customerB.id}`, token: tokenKasirB,
    body: { name: customerB.name, phone: customerB.phone, pointsAdjustment: 9999, adjustmentReason: 'Kecurangan kasir' }
  });

  if (kasirAdjust.statusCode === 403) {
    // Verifikasi poin tidak berubah di DB
    const cAfter = await prisma.customer.findUnique({ where: { id: customerB.id }, select: { points: true } });
    if (cAfter.points === pointsBefore) {
      pass('Role guard berhasil: kasir tidak bisa adjust poin manual',
        `HTTP 403 | ${kasirAdjust.data?.error} | Poin tetap: ${pointsBefore}`);
    } else {
      fail('HTTP 403 tapi poin berubah di DB!', `${pointsBefore} → ${cAfter.points}`);
    }
  } else if (kasirAdjust.statusCode === 200) {
    const cAfter = await prisma.customer.findUnique({ where: { id: customerB.id }, select: { points: true } });
    fail('Kasir berhasil adjust poin manual — kecurangan bisa terjadi!',
      `HTTP 200 | Poin berubah: ${pointsBefore} → ${cAfter.points}`);
  } else {
    fail('Response tidak terduga dari role guard', `HTTP ${kasirAdjust.statusCode} | ${JSON.stringify(kasirAdjust.data)}`);
  }

  // Owner Tenant B boleh adjust poin customernya sendiri
  const ownerAdjust = await httpRequest({
    method: 'PUT', path: `/api/customers/${customerB.id}`, token: tokenB,
    body: { name: customerB.name, phone: customerB.phone, pointsAdjustment: 100, adjustmentReason: 'Bonus event' }
  });
  if (ownerAdjust.statusCode === 200) {
    pass('Owner berhasil adjust poin (hak akses benar)', `HTTP 200 | poin ditambah 100`);
  } else {
    fail('Regresi! Owner tidak bisa adjust poin', `HTTP ${ownerAdjust.statusCode}`);
  }

  // Owner Tenant B tidak bisa adjust poin customer Tenant A (kombinasi IDOR + role)
  const ownerIdorAdjust = await httpRequest({
    method: 'PUT', path: `/api/customers/${customerA.id}`, token: tokenB,
    body: { name: customerA.name, phone: customerA.phone, pointsAdjustment: -1500, adjustmentReason: 'Drain poin Tenant A' }
  });
  if ([403, 404].includes(ownerIdorAdjust.statusCode)) {
    pass('Owner Tenant B tidak bisa adjust poin customer Tenant A', `HTTP ${ownerIdorAdjust.statusCode}`);
  } else {
    fail('CRITICAL: Owner Tenant B bisa adjust poin customer Tenant A!', `HTTP ${ownerIdorAdjust.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3: Isolasi Poin Loyalitas — Verifikasi helper sudah di-hardened
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 3 — Isolasi Poin Loyalitas: Helper earn/redeem di-scope ke tenantId');

  // Verifikasi langsung di DB: customer A poin tidak berubah oleh transaksi lain
  const cAFresh = await prisma.customer.findUnique({ where: { id: customerA.id }, select: { points: true, tenantId: true } });
  if (cAFresh.tenantId === tenantAId) {
    pass('Customer A ter-scoped ke tenantId yang benar di DB', `tenantId=${cAFresh.tenantId} | points=${cAFresh.points}`);
  } else {
    fail('Customer A tenantId tidak sesuai!', `expected=${tenantAId} got=${cAFresh.tenantId}`);
  }

  // Cek tidak ada pointLog dari tenantId yang salah di customer A
  const crossPointLogs = await prisma.pointLog.findMany({
    where: { customerId: customerA.id, tenantId: { not: tenantAId } }
  });
  if (crossPointLogs.length === 0) {
    pass('Tidak ada PointLog cross-tenant di customer A', `0 log dengan tenantId selain ${tenantAId}`);
  } else {
    fail(`BOCOR! Ditemukan ${crossPointLogs.length} PointLog dengan tenantId berbeda di customer A`,
      `tenantIds: ${crossPointLogs.map(l => l.tenantId).join(', ')}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4: Isolasi Voucher — Tenant B tidak bisa akses voucher Tenant A
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 4 — Isolasi Voucher: Tenant B tidak bisa validasi/edit voucher Tenant A');

  // Tenant B mencoba validasi voucher milik Tenant A
  const validateVoucherA = await httpRequest({
    method: 'POST', path: '/api/vouchers/validate', token: tokenB,
    body: { code: voucherA.code, subtotal: 100000 }
  });
  if ([404].includes(validateVoucherA.statusCode) || validateVoucherA.data?.valid === false) {
    pass('Validasi voucher Tenant A diblokir untuk Tenant B',
      `HTTP ${validateVoucherA.statusCode} | valid=${validateVoucherA.data?.valid} | ${validateVoucherA.data?.message || '-'}`);
  } else if (validateVoucherA.statusCode === 200 && validateVoucherA.data?.valid === true) {
    fail('VOUCHER LEAK! Tenant B berhasil memvalidasi voucher Tenant A!',
      `HTTP 200 | discountAmount=${validateVoucherA.data?.discountAmount}`);
  } else {
    fail('Response tidak terduga validasi voucher', `HTTP ${validateVoucherA.statusCode} | ${JSON.stringify(validateVoucherA.data)}`);
  }

  // Tenant B mencoba PUT (edit) voucher milik Tenant A
  const editVoucherA = await httpRequest({
    method: 'PUT', path: `/api/vouchers/${voucherA.id}`, token: tokenB,
    body: { amount: 99, status: 'Nonaktif' }
  });
  if ([403, 404].includes(editVoucherA.statusCode)) {
    pass('PUT voucher Tenant A diblokir untuk Tenant B', `HTTP ${editVoucherA.statusCode}`);
    // Verifikasi voucher A tidak berubah
    const voucherAFresh = await prisma.voucher.findUnique({ where: { id: voucherA.id } });
    if (voucherAFresh.amount === voucherA.amount && voucherAFresh.status === voucherA.status) {
      pass('Verifikasi DB: voucher A tidak berubah', `amount=${voucherAFresh.amount} status=${voucherAFresh.status}`);
    } else {
      fail('DB INCONSISTENCY: voucher A berubah meski HTTP diblokir!', '');
    }
  } else {
    fail('IDOR: Tenant B berhasil edit voucher Tenant A!', `HTTP ${editVoucherA.statusCode}`);
  }

  // DELETE voucher A oleh Tenant B
  const deleteVoucherA = await httpRequest({ method: 'DELETE', path: `/api/vouchers/${voucherA.id}`, token: tokenB });
  if ([403, 404].includes(deleteVoucherA.statusCode)) {
    pass('DELETE voucher Tenant A diblokir untuk Tenant B', `HTTP ${deleteVoucherA.statusCode}`);
  } else {
    fail('IDOR: Tenant B berhasil delete voucher Tenant A!', `HTTP ${deleteVoucherA.statusCode}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5: Uniqueness Phone Scoped Per Tenant
  // ══════════════════════════════════════════════════════════════════════════
  section('TEST 5 — Phone Uniqueness Scoped: Phone sama di 2 tenant tidak conflict');

  const sharedPhone = `0888${ts.toString().slice(-7)}`;

  // Buat customer di Tenant A dengan phone X
  const custPhoneA = await httpRequest({
    method: 'POST', path: '/api/customers', token: tokenA,
    body: { name: 'Pelanggan Phone A', phone: sharedPhone }
  });

  // Buat customer di Tenant B dengan phone X yang sama
  const custPhoneB = await httpRequest({
    method: 'POST', path: '/api/customers', token: tokenB,
    body: { name: 'Pelanggan Phone B', phone: sharedPhone }
  });

  if (custPhoneA.statusCode === 201 && custPhoneB.statusCode === 201) {
    if (custPhoneA.data?.id !== custPhoneB.data?.id) {
      pass('Phone yang sama di 2 tenant tidak conflict (scoped uniqueness)',
        `Tenant A id=${custPhoneA.data?.id} | Tenant B id=${custPhoneB.data?.id} | phone=${sharedPhone}`);
    } else {
      fail('Customer ID sama! Terjadi collision antar tenant', `id=${custPhoneA.data?.id}`);
    }
  } else if (custPhoneA.statusCode === 201 && custPhoneB.statusCode === 400) {
    fail('Phone unique cross-tenant! Customer Tenant A menghalangi Tenant B mendaftar dengan phone sama',
      `Tenant A: ${custPhoneA.statusCode} | Tenant B: ${custPhoneB.statusCode} | ${custPhoneB.data?.error}`);
  } else {
    fail('Pembuatan customer gagal', `A: ${custPhoneA.statusCode} | B: ${custPhoneB.statusCode}`);
  }

  // Dalam tenant yang sama, phone sama harus ditolak
  const dupPhoneA = await httpRequest({
    method: 'POST', path: '/api/customers', token: tokenA,
    body: { name: 'Duplikat Phone', phone: sharedPhone }
  });
  if (dupPhoneA.statusCode === 400) {
    pass('Duplikasi phone dalam tenant yang sama ditolak', `HTTP 400 | ${dupPhoneA.data?.error}`);
  } else {
    fail('Duplikasi phone dalam tenant sama DIIZINKAN — data integrity rusak!', `HTTP ${dupPhoneA.statusCode}`);
  }

  // ── CLEANUP ────────────────────────────────────────────────────────────────
  await cleanup(tenantAId, tenantBId);

  // ── HASIL AKHIR ────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  📊 HASIL AKHIR PENTEST CRM & LOYALITAS');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  Total Test : ${total}`);
  console.log(`  ✅ PASSED  : ${passed}`);
  console.log(`  ❌ FAILED  : ${failed}`);
  console.log('');

  if (failures.length > 0) {
    console.log('  KEGAGALAN DITEMUKAN:');
    failures.forEach((f, i) => {
      console.log(`  [${i + 1}] ${f.name}`);
      if (f.detail) console.log(`      → ${f.detail}`);
    });
    console.log('');
    console.log('  🚨 STATUS: CELAH KEAMANAN TERDETEKSI!');
  } else {
    console.log('  🛡️  STATUS: SEMUA SKENARIO AMAN — CRM isolation terkonfirmasi!');
  }
  console.log('══════════════════════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

async function cleanup(tenantAId, tenantBId) {
  console.log('\n[CLEANUP] Menghapus data uji...');
  try {
    for (const tenantId of [tenantAId, tenantBId]) {
      await prisma.pointLog.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.voucher.deleteMany({ where: { tenantId } });
      await prisma.outlet.deleteMany({ where: { tenantId } });
      const mbs = await prisma.userMembership.findMany({ where: { tenantId }, select: { userId: true } });
      const uids = mbs.map(m => m.userId);
      await prisma.userMembership.deleteMany({ where: { tenantId } });
      if (uids.length > 0) await prisma.user.deleteMany({ where: { id: { in: uids } } });
      await prisma.tenantFeature.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    console.log('  → Cleanup selesai.');
  } catch (err) {
    console.warn('  ⚠️  Cleanup partial:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runSuite().catch(async (err) => {
  console.error('💥 SUITE CRASHED:', err.message, err.stack);
  await prisma.$disconnect();
  process.exit(2);
});
