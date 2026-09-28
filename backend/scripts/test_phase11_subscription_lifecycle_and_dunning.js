/**
 * TEST SUITE: Phase 11 — SaaS Subscription Lifecycle Automation, Grace Period & Dunning Engine
 *
 * Verifies:
 * 1. Auto-Invoice Generation (H-7): Generates UNPAID invoice when subscription approaches expiration
 * 2. Expired Trial Transition: Automatically moves expired TRIAL to GRACE_PERIOD and creates invoice
 * 3. Grace Period Tolerance: POS operations remain fully accessible during 3-day grace period
 * 4. Auto-Suspension Cutoff (H+3): Suspends tenant after grace period expires and blocks POS with HTTP 403
 * 5. Instant Midtrans Reactivation: Webhook settlement restores ACTIVE status, extends currentPeriodEnd, and unlocks POS
 * 6. Cron Idempotency: Running audit cycles repeatedly never duplicates invoices or corrupts state
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`✅ ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`❌ ${msg}`);
  if (err) console.error(`   → ${err.message || err}`);
  failed++;
}

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'object' ? JSON.stringify(postData) : postData);
    }
    req.end();
  });
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 11 SAAS SUBSCRIPTION LIFECYCLE & DUNNING TESTS');
  console.log('================================================================\n');

  // Load compiled service modules
  const { SubscriptionCronService } = require('../dist/src/services/SubscriptionCronService');
  const { PaymentService } = require('../dist/src/services/PaymentService');
  const cronService = SubscriptionCronService.getInstance();
  const paymentService = PaymentService.getInstance();

  // Ambil Plan untuk pengujian
  let plan = await prisma.plan.findFirst({ where: { isActive: true } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        code: 'TEST-BIZ',
        name: 'Paket Bisnis Pengujian',
        priceMonthly: 150000,
        priceYearly: 1500000,
        maxOutlets: 2,
        maxUsers: 5,
        maxProducts: 500,
        isActive: true
      }
    });
  }

  // Siapkan 3 Test Tenants
  const tenantAId = 'tenant-sub-test-a';
  const tenantBId = 'tenant-sub-test-b';
  const tenantCId = 'tenant-sub-test-c';

  // Bersihkan data lama jika ada
  await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId, tenantCId] } } });
  await prisma.invoice.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId, tenantCId] } } });
  await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId, tenantCId] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId, tenantCId] } } });

  const now = new Date();

  // Tenant A: ACTIVE, langganan habis 4 hari lagi (H-4)
  const tenantA = await prisma.tenant.create({
    data: {
      id: tenantAId,
      name: 'Kafe Tenant A (Expiring H-4)',
      slug: 'kafe-sub-a',
      status: 'ACTIVE',
      planId: plan.id
    }
  });

  const subAEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 hari lagi
  const subA = await prisma.subscription.create({
    data: {
      tenantId: tenantAId,
      planId: plan.id,
      status: 'ACTIVE',
      amount: plan.priceMonthly,
      startDate: new Date(now.getTime() - 26 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(now.getTime() - 26 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: subAEnd
    }
  });

  // Tenant B: TRIAL, trial habis 2 jam lalu
  const tenantB = await prisma.tenant.create({
    data: {
      id: tenantBId,
      name: 'Kafe Tenant B (Trial Expired)',
      slug: 'kafe-sub-b',
      status: 'TRIAL',
      planId: plan.id,
      trialEndsAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 jam lalu
    }
  });

  // Tenant C: GRACE_PERIOD, masa aktif habis 4 hari lalu (> 3 hari grace period)
  const tenantC = await prisma.tenant.create({
    data: {
      id: tenantCId,
      name: 'Kafe Tenant C (Grace Expired)',
      slug: 'kafe-sub-c',
      status: 'GRACE_PERIOD',
      planId: plan.id
    }
  });

  const subCEnd = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 hari lalu
  const subC = await prisma.subscription.create({
    data: {
      tenantId: tenantCId,
      planId: plan.id,
      status: 'PAST_DUE',
      amount: plan.priceMonthly,
      startDate: new Date(now.getTime() - 34 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(now.getTime() - 34 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: subCEnd
    }
  });

  // Buat dummy invoice UNPAID untuk Tenant C agar siap dibayar
  const invoiceC = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-TEST-C-0001',
      tenantId: tenantCId,
      subscriptionId: subC.id,
      planId: plan.id,
      amount: plan.priceMonthly,
      totalAmount: plan.priceMonthly,
      status: 'UNPAID',
      dueDate: subCEnd,
      paymentMethod: 'MIDTRANS_SNAP'
    }
  });

  const txnC = await prisma.paymentTransaction.create({
    data: {
      tenantId: tenantCId,
      invoiceId: invoiceC.id,
      gateway: 'MIDTRANS',
      gatewayOrderId: 'SAAS-INV-TEST-C-0001',
      amount: plan.priceMonthly,
      status: 'PENDING'
    }
  });

  // Buat real user untuk Tenant B dan Tenant C
  const userB = await prisma.user.create({
    data: {
      name: 'Kasir B',
      username: `kasir_b_${Date.now()}`,
      passwordHash: 'hash',
      role: 'Kasir',
      status: 'Aktif',
      permissions: '["*"]',
      memberships: { create: { tenantId: tenantBId } }
    }
  });

  const userC = await prisma.user.create({
    data: {
      name: 'Kasir C',
      username: `kasir_c_${Date.now()}`,
      passwordHash: 'hash',
      role: 'Kasir',
      status: 'Aktif',
      permissions: '["*"]',
      memberships: { create: { tenantId: tenantCId } }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Auto-Invoice Generation (H-7 s/d H-1)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Auto-Invoice Generation untuk Subscription H-4 ---');
  try {
    const invoicesGenerated = await cronService.processExpiringSubscriptions(now);
    assert(invoicesGenerated >= 1, 'Harus menghasilkan minimal 1 invoice baru');

    const generatedInvoice = await prisma.invoice.findFirst({
      where: { tenantId: tenantAId, status: 'UNPAID' }
    });
    assert(generatedInvoice, 'Invoice UNPAID harus ditemukan di database untuk Tenant A');
    assert.strictEqual(generatedInvoice.amount, plan.priceMonthly, 'Jumlah tagihan harus sesuai plan');
    assert.strictEqual(generatedInvoice.subscriptionId, subA.id, 'Invoice harus terhubung ke subscription');

    const generatedTxn = await prisma.paymentTransaction.findFirst({
      where: { invoiceId: generatedInvoice.id }
    });
    assert(generatedTxn, 'PaymentTransaction PENDING harus otomatis terbuat untuk Midtrans');

    pass(`TEST 1 PASSED: Invoice ${generatedInvoice.invoiceNumber} (Rp ${generatedInvoice.amount}) berhasil diterbitkan otomatis untuk Tenant A.`);
  } catch (err) {
    fail('TEST 1 FAILED: Gagal menerbitkan invoice otomatis pada masa H-7', err);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Expired Trial Transition (TRIAL -> GRACE_PERIOD)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Expired Trial Transition & Activation Invoice ---');
  try {
    const trialsProcessed = await cronService.processExpiredTrials(now);
    assert(trialsProcessed >= 1, 'Harus memproses minimal 1 trial yang kedaluwarsa');

    const updatedTenantB = await prisma.tenant.findUnique({ where: { id: tenantBId } });
    assert.strictEqual(updatedTenantB.status, 'GRACE_PERIOD', 'Tenant B status harus berubah ke GRACE_PERIOD');

    const invoiceB = await prisma.invoice.findFirst({
      where: { tenantId: tenantBId, status: 'UNPAID' }
    });
    assert(invoiceB, 'Invoice aktivasi UNPAID harus otomatis dibuat untuk Tenant B');

    pass(`TEST 2 PASSED: Tenant B (${tenantB.name}) trial habis -> otomatis GRACE_PERIOD & invoice terbuat.`);
  } catch (err) {
    fail('TEST 2 FAILED: Gagal memproses peralihan trial kedaluwarsa', err);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Grace Period Tolerance (Kasir Tetap Bisa Bertransaksi)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Toleransi Masa Tenggang (Kasir GRACE_PERIOD Tetap Aktif) ---');
  try {
    const tokenB = createToken({ id: userB.id, username: userB.username, role: 'Kasir', tenantId: tenantBId });
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenB}`,
        'Content-Type': 'application/json'
      }
    });

    // 200 OK karena status GRACE_PERIOD tidak diblokir oleh requireActiveTenant
    assert.strictEqual(res.statusCode, 200, `Kasir dalam status GRACE_PERIOD harus tetap bisa akses (Dapat: ${res.statusCode})`);
    pass('TEST 3 PASSED: Kasir tenant berstatus GRACE_PERIOD tetap diizinkan bertransaksi tanpa gangguan.');
  } catch (err) {
    fail('TEST 3 FAILED: Kasir terblokir saat masa tenggang (seharusnya diizinkan)', err);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Auto-Suspension Enforcement (GRACE_PERIOD -> SUSPENDED)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Penegakan Suspensi Otomatis (Masa Tenggang Habis) ---');
  try {
    // Tenant C masa aktif habis 4 hari lalu (melebihi toleransi 3 hari)
    const suspendedCount = await cronService.processGracePeriodCutoff(now, 3);
    assert(suspendedCount >= 1, 'Harus mensuspend minimal 1 tenant yang melewati grace period');

    const updatedTenantC = await prisma.tenant.findUnique({ where: { id: tenantCId } });
    assert.strictEqual(updatedTenantC.status, 'SUSPENDED', 'Tenant C status harus SUSPENDED');

    // Uji akses POS Tenant C melalui HTTP request
    const tokenC = createToken({ id: userC.id, username: userC.username, role: 'Kasir', tenantId: tenantCId });
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenC}`,
        'Content-Type': 'application/json'
      }
    });

    assert.strictEqual(res.statusCode, 403, `Tenant SUSPENDED harus ditolak dengan HTTP 403 (Dapat: ${res.statusCode})`);
    assert.strictEqual(res.data.code, 'TENANT_SUSPENDED', 'Error code harus TENANT_SUSPENDED');

    pass('TEST 4 PASSED: Tenant C otomatis di-SUSPENDED setelah 3 hari grace period, dan request kasir ditolak HTTP 403.');
  } catch (err) {
    fail('TEST 4 FAILED: Penegakan suspensi otomatis gagal', err);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Instant Midtrans Reactivation (Pembayaran Berhasil -> ACTIVE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Reaktivasi Instan via Webhook Midtrans Settlement ---');
  try {
    // Simulasi Webhook Midtrans settlement untuk invoice Tenant C
    const webhookPayload = {
      order_id: txnC.gatewayOrderId,
      status_code: '200',
      gross_amount: `${plan.priceMonthly}.00`,
      transaction_status: 'settlement',
      fraud_status: 'accept',
      payment_type: 'qris',
      transaction_id: `midtrans-txn-${Date.now()}`
    };

    const webhookResult = await paymentService.handleWebhook(webhookPayload);
    assert.strictEqual(webhookResult.success, true, 'Webhook harus sukses diproses');

    // Cek status Tenant C di DB
    const reactivatedTenantC = await prisma.tenant.findUnique({ where: { id: tenantCId } });
    assert.strictEqual(reactivatedTenantC.status, 'ACTIVE', 'Status Tenant C harus kembali ACTIVE seketika');

    // Cek invoice C
    const paidInvoiceC = await prisma.invoice.findUnique({ where: { id: invoiceC.id } });
    assert.strictEqual(paidInvoiceC.status, 'PAID', 'Invoice C status harus PAID');

    // Cek subscription baru / perpanjangan
    const latestSubC = await prisma.subscription.findFirst({
      where: { tenantId: tenantCId },
      orderBy: { currentPeriodEnd: 'desc' }
    });
    assert(latestSubC, 'Subscription baru harus ditemukan');
    assert.strictEqual(latestSubC.status, 'ACTIVE', 'Subscription harus ACTIVE');
    assert(latestSubC.currentPeriodEnd > now, 'currentPeriodEnd harus diperpanjang ke masa depan');

    // Verifikasi akses POS terbuka kembali
    const tokenC = createToken({ id: userC.id, username: userC.username, role: 'Kasir', tenantId: tenantCId });
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenC}`,
        'Content-Type': 'application/json'
      }
    });

    assert.strictEqual(res.statusCode, 200, `Akses kasir harus terbuka kembali dengan HTTP 200 (Dapat: ${res.statusCode})`);

    pass('TEST 5 PASSED: Webhook Midtrans berhasil mengaktifkan kembali Tenant C (ACTIVE), memperpanjang masa aktif, dan membuka kembali akses kasir secara instan.');
  } catch (err) {
    fail('TEST 5 FAILED: Reaktivasi instan via webhook gagal', err);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Cron Idempotency & Full Audit Cycle
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Idempotensi Cron Audit Langganan (No Duplikasi) ---');
  try {
    const cycle1 = await cronService.runSubscriptionAuditCycle(now);
    const cycle2 = await cronService.runSubscriptionAuditCycle(now);

    // Pada siklus kedua di waktu yang sama, tidak boleh ada invoice baru yang dibuat lagi
    assert.strictEqual(cycle2.invoicesGenerated, 0, 'Siklus kedua tidak boleh menduplikasi penerbitan invoice');

    const countInvoicesTenantA = await prisma.invoice.count({
      where: { tenantId: tenantAId, status: 'UNPAID' }
    });
    assert.strictEqual(countInvoicesTenantA, 1, 'Tenant A hanya boleh memiliki tepat 1 invoice UNPAID aktif');

    pass('TEST 6 PASSED: Eksekusi berulang runSubscriptionAuditCycle aman dan idempotent tanpa duplikasi invoice.');
  } catch (err) {
    fail('TEST 6 FAILED: Cron tidak idempotent', err);
  }

  // Cleanup test data
  await prisma.user.deleteMany({ where: { id: { in: [userB.id, userC.id] } } });
  await prisma.paymentTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId, tenantCId] } } });
  await prisma.invoice.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId, tenantCId] } } });
  await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId, tenantCId] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId, tenantCId] } } });

  console.log('\n================================================================');
  console.log(`📊 PHASE 11 TEST SUMMARY: ${passed} / ${passed + failed} PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
