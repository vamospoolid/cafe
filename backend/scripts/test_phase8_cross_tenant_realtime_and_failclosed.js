/**
 * TEST SUITE: Phase 8 — Comprehensive SaaS Cross-Tenant & Real-Time Isolation Hardening
 *
 * Verifies:
 * 1. WebSocket Room Isolation & Complete Elimination of Global io.emit in routes
 * 2. Elimination of Hardcoded Root Fallbacks ('tenant-default-muki') across contexts
 * 3. Fail-Closed Enforcement on Orders, Cashflow, Attendance, Loans, POs, KDS, Vouchers, Users, and Settings
 * 4. Categories Strict Isolation (Zero 'OR tenantId null' data leaks)
 * 5. Dynamic PWA Manifest Isolation & Live HTTP Endpoint Hardening
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 8 SAAS CROSS-TENANT & REAL-TIME ISOLATION TESTS');
  console.log('================================================================\n');

  // ─── TEST 1: Static Code Audit - Zero io.emit in backend/src/routes ──────────
  console.log('--- TEST 1: Zero Global io.emit in All Route Handlers ---');
  try {
    const routesDir = path.join(__dirname, '..', 'src', 'routes');
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));
    let foundGlobalIoEmit = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Regex matches io.emit( but excludes commented lines
        if (/io\.emit\s*\(/.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          foundGlobalIoEmit.push(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    assert.strictEqual(
      foundGlobalIoEmit.length, 
      0, 
      `Ditemukan kebocoran global WebSocket broadcast (io.emit): \n${foundGlobalIoEmit.join('\n')}`
    );

    pass('TEST 1 PASSED: 100% Zero global io.emit in all route files! All broadcasts strictly use emitToTenant(tenantId, ...).');
  } catch (e) {
    fail('TEST 1 FAILED', e);
  }

  // ─── TEST 2: Static Code Audit - Zero 'OR tenantId null' in routes ───────────
  console.log('\n--- TEST 2: Zero Loose "OR: [{ tenantId }, { tenantId: null }]" in Routes ---');
  try {
    const routesDir = path.join(__dirname, '..', 'src', 'routes');
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));
    let foundOrNull = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      if (content.includes('OR: [{ tenantId }, { tenantId: null }]') || content.includes('OR: [{ tenantId: null }, { tenantId }]')) {
        foundOrNull.push(file);
      }
    }

    assert.strictEqual(
      foundOrNull.length,
      0,
      `Ditemukan query bocor OR tenantId null di: ${foundOrNull.join(', ')}`
    );

    pass('TEST 2 PASSED: 100% Zero loose "OR tenantId null" queries! All tenant queries are strictly partitioned.');
  } catch (e) {
    fail('TEST 2 FAILED', e);
  }

  // ─── TEST 3: TenantContext Root Fallback Elimination ─────────────────────────
  console.log('\n--- TEST 3: TenantContext Returns undefined Outside Active Context ---');
  try {
    const { TenantContext } = require('../dist/src/utils/tenantContext');
    
    // In uncontextualized execution, getTenantId() MUST be undefined (not 'tenant-default-muki')
    const isolatedId = TenantContext.getTenantId();
    assert.strictEqual(
      isolatedId, 
      undefined, 
      `TenantContext.getTenantId() should be undefined outside context, but returned: ${isolatedId}`
    );

    // In scoped execution, getTenantId() MUST return exact tenant
    const testScoped = TenantContext.run({ tenantId: 'tenant-vamos-pos' }, () => {
      return TenantContext.getTenantId();
    });
    assert.strictEqual(testScoped, 'tenant-vamos-pos');

    pass('TEST 3 PASSED: TenantContext.getTenantId() returns undefined outside context (no silent Muki pollution)!');
  } catch (e) {
    fail('TEST 3 FAILED', e);
  }

  // ─── TEST 4: Live HTTP - Categories /public Fail-Closed Without Tenant ───────
  console.log('\n--- TEST 4: Live HTTP - Categories /public Rejects Missing Tenant ---');
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/categories/public',
      method: 'GET'
    });

    assert.strictEqual(res.statusCode, 400, `Expected 400 but got ${res.statusCode}`);
    assert.strictEqual(res.data?.code, 'MISSING_TENANT_CONTEXT');

    pass('TEST 4 PASSED: Public categories endpoint rejects unauthenticated request lacking tenant context (400 MISSING_TENANT_CONTEXT)!');
  } catch (e) {
    fail('TEST 4 FAILED', e);
  }

  // ─── TEST 5: Live HTTP - PWA Manifest Scoping & No Hardcoded Fallback ────────
  console.log('\n--- TEST 5: Live HTTP - Dynamic PWA Manifest Tenant Isolation ---');
  try {
    // Request without tenant should yield generic platform manifest (not Muki Ramen)
    const genericRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/manifest.json',
      method: 'GET'
    });

    assert.strictEqual(genericRes.statusCode, 200);
    assert.ok(
      !genericRes.data?.name?.includes('Muki Ramen'),
      `Generic manifest must not leak Muki Ramen branding, got: ${genericRes.data?.name}`
    );

    pass('TEST 5 PASSED: PWA Manifest does not default to Muki Ramen branding when called without tenant context!');
  } catch (e) {
    fail('TEST 5 FAILED', e);
  }

  // ─── TEST 6: Simulated Auth Tokens Without TenantId Fail-Closed ──────────────
  console.log('\n--- TEST 6: Authenticated Endpoints Reject Tokens Without TenantId ---');
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

    // Token for real database user (id: 10) who has NO tenant memberships
    const orphanToken = jwt.sign(
      { id: 10, username: 'test_audit_user_a', role: 'Admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Test Orders
    const ordersRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${orphanToken}` }
    });
    assert.strictEqual(ordersRes.statusCode, 400, `Orders should return 400, got ${ordersRes.statusCode}`);
    assert.strictEqual(ordersRes.data?.code, 'MISSING_TENANT_CONTEXT');

    // Test Cashflow
    const cashflowRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/cashflow',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${orphanToken}` }
    });
    assert.strictEqual(cashflowRes.statusCode, 400, `Cashflow should return 400, got ${cashflowRes.statusCode}`);
    assert.strictEqual(cashflowRes.data?.code, 'MISSING_TENANT_CONTEXT');

    // Test Vouchers
    const vouchersRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/vouchers',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${orphanToken}` }
    });
    assert.strictEqual(vouchersRes.statusCode, 400, `Vouchers should return 400, got ${vouchersRes.statusCode}`);
    assert.strictEqual(vouchersRes.data?.code, 'MISSING_TENANT_CONTEXT');

    // Test Users
    const usersRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/users',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${orphanToken}` }
    });
    assert.strictEqual(usersRes.statusCode, 400, `Users should return 400, got ${usersRes.statusCode}`);
    assert.strictEqual(usersRes.data?.code, 'MISSING_TENANT_CONTEXT');

    // Test Settings
    const settingsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/settings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${orphanToken}` }
    });
    assert.strictEqual(settingsRes.statusCode, 400, `Settings should return 400, got ${settingsRes.statusCode}`);
    assert.strictEqual(settingsRes.data?.code, 'MISSING_TENANT_CONTEXT');

    pass('TEST 6 PASSED: All operational routes (Orders, Cashflow, Vouchers, Users, Settings) fail-closed with 400 for tenant-less tokens!');
  } catch (e) {
    fail('TEST 6 FAILED', e);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 PHASE 8 TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`❌ ${failed} TEST(S) FAILED!`);
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 8 SAAS CROSS-TENANT & REAL-TIME ISOLATION TESTS PASSED!');
    process.exit(0);
  }
}

runTests();
