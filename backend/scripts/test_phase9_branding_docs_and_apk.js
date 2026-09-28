/**
 * TEST SUITE: Phase 9 — End-to-End Multi-Tenant Branding, Reports & APK Synthesis
 *
 * Verifies:
 * 1. Static Code Audit: Zero 'logo-muki-ramen.png' and 'Jl. Kesadaran' in PDF & Excel generators
 * 2. Backend Settings Auto-Create: Uses tenant profile data, not dummy Muki Ramen Polman data
 * 3. Public Branding Neutrality: /api/settings/public returns tenant branding or neutral platform
 * 4. Excel & PDF Generator Neutrality: File naming and department labels are neutral and dynamic
 * 5. APK Resolver: resolveTenantInfo scopes settings strictly to the target tenant
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
  console.log('🧪 RUNNING PHASE 9 MULTI-TENANT BRANDING, REPORTS & APK TESTS');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '..', '..');

  // ─── TEST 1: Static Code Audit in PDF & Excel Generators ────────────────────
  console.log('--- TEST 1: Static Code Audit in PDF & Excel Generators ---');
  try {
    const pdfPath = path.join(rootDir, 'frontend', 'src', 'utils', 'pdfGenerator.ts');
    const excelPath = path.join(rootDir, 'frontend', 'src', 'utils', 'excelGenerator.ts');
    const receiptPath = path.join(rootDir, 'frontend', 'src', 'components', 'ReceiptPrinter.tsx');

    const pdfContent = fs.readFileSync(pdfPath, 'utf8');
    const excelContent = fs.readFileSync(excelPath, 'utf8');
    const receiptContent = fs.readFileSync(receiptPath, 'utf8');

    // Check logo-muki-ramen.png
    assert.ok(!pdfContent.includes('/logo-muki-ramen.png'), 'pdfGenerator.ts must NOT contain /logo-muki-ramen.png');
    assert.ok(!excelContent.includes('logo-muki-ramen'), 'excelGenerator.ts must NOT contain logo-muki-ramen');
    assert.ok(!receiptContent.includes('/logo-muki-ramen.png'), 'ReceiptPrinter.tsx must NOT contain /logo-muki-ramen.png');

    // Check Kesadaran address
    assert.ok(!pdfContent.includes('Jl. Kesadaran'), 'pdfGenerator.ts must NOT contain Jl. Kesadaran');
    assert.ok(!excelContent.includes('Jl. Kesadaran'), 'excelGenerator.ts must NOT contain Jl. Kesadaran');

    // Check hardcoded Excel filenames
    assert.ok(!excelContent.includes('_Muki_Ramen_'), 'excelGenerator.ts must NOT contain hardcoded _Muki_Ramen_ in filenames');

    pass('TEST 1 PASSED: 100% Zero hardcoded logo-muki-ramen, Jl. Kesadaran, or Muki_Ramen filenames in reports!');
  } catch (e) {
    fail('TEST 1 FAILED', e);
  }

  // ─── TEST 2: Dynamic Public Settings API ─────────────────────────────────────
  console.log('\n--- TEST 2: Dynamic Public Settings API ---');
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/settings/public',
      method: 'GET'
    });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(!res.data?.storeName?.includes('MUKI RAMEN'), `Public storeName should be generic or tenant-scoped, got: ${res.data?.storeName}`);
    assert.ok(!res.data?.logoUrl?.includes('logo-muki-ramen.png'), `Public logoUrl should not default to muki ramen, got: ${res.data?.logoUrl}`);

    pass('TEST 2 PASSED: GET /api/settings/public returns neutral or tenant-specific branding without hardcoded Muki fallback!');
  } catch (e) {
    fail('TEST 2 FAILED', e);
  }

  // ─── TEST 3: Backend Settings Auto-Seed Uses Tenant Profile ──────────────────
  console.log('\n--- TEST 3: Backend Settings Auto-Seed Uses Real Tenant Profile ---');
  try {
    const { PrismaClient } = require(path.join(rootDir, 'backend', 'node_modules', '@prisma/client'));
    const prisma = new PrismaClient();

    // Create a temporary test tenant
    const testTenantSlug = `test_branding_${Date.now()}`;
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Kopi Kenangan Senja',
        slug: testTenantSlug,
        status: 'ACTIVE',
        logoUrl: '/logos/senja.png'
      }
    });

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

    // Create owner user with membership to testTenant
    const testUser = await prisma.user.create({
      data: {
        name: 'Senja Owner',
        username: `senja_owner_${Date.now()}`,
        passwordHash: 'dummyhash',
        role: 'OWNER',
        permissions: JSON.stringify(['*'])
      }
    });

    await prisma.tenantMembership.create({
      data: {
        userId: testUser.id,
        tenantId: testTenant.id,
        status: 'ACTIVE'
      }
    });

    const token = jwt.sign(
      { id: testUser.id, username: testUser.username, role: testUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Call GET /api/settings to trigger auto-creation
    const settingsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/settings',
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': testTenant.id
      }
    });

    assert.strictEqual(settingsRes.statusCode, 200);
    assert.strictEqual(settingsRes.data?.storeName, 'Kopi Kenangan Senja', 'Settings storeName must match tenant.name');
    assert.strictEqual(settingsRes.data?.logoUrl, '/logos/senja.png', 'Settings logoUrl must match tenant.logoUrl');
    assert.ok(!settingsRes.data?.address?.includes('Kesadaran'), 'Address must NOT default to Sulbar Kesadaran');
    assert.ok(!settingsRes.data?.receiptFooter?.includes('Arigatou'), 'Receipt footer must NOT contain Arigatou Gozaimasu');

    // Clean up
    await prisma.settings.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.tenant.delete({ where: { id: testTenant.id } });
    await prisma.$disconnect();

    pass('TEST 3 PASSED: Dynamic Settings auto-create correctly inherits tenant.name and tenant.logoUrl without Muki defaults!');
  } catch (e) {
    fail('TEST 3 FAILED', e);
  }

  // ─── TEST 4: Excel Generator Department Labels & Neutralization ─────────────
  console.log('\n--- TEST 4: Excel Generator Department Labels & Neutralization ---');
  try {
    const excelPath = path.join(rootDir, 'frontend', 'src', 'utils', 'excelGenerator.ts');
    const content = fs.readFileSync(excelPath, 'utf8');

    assert.ok(!content.includes('Hak PJ Muki Ramen'), 'Excel profit share must not mention Hak PJ Muki Ramen');
    assert.ok(!content.includes('Muki Drink (Bar)'), 'Excel profit share must not mention Muki Drink');
    assert.ok(content.includes('Divisi Makanan (Food)'), 'Excel profit share should use generic Divisi Makanan');
    assert.ok(content.includes('Divisi Minuman (Drink)'), 'Excel profit share should use generic Divisi Minuman');

    pass('TEST 4 PASSED: Excel generator department labels are completely neutralized and SaaS-ready!');
  } catch (e) {
    fail('TEST 4 FAILED', e);
  }

  // ─── TEST 5: Branded APK Generator Query Scoping ────────────────────────────
  console.log('\n--- TEST 5: Branded APK Generator Query Scoping ---');
  try {
    const apkScriptPath = path.join(rootDir, 'scripts', 'generate_branded_apk.js');
    const apkScriptContent = fs.readFileSync(apkScriptPath, 'utf8');

    assert.ok(
      apkScriptContent.includes('where: { tenantId: tenant.id }'),
      'generate_branded_apk.js must scope settings query with where: { tenantId: tenant.id }'
    );
    assert.ok(
      !apkScriptContent.includes("let logoFile = path.join(rootDir, 'frontend', 'public', 'logo-muki-ramen.png');"),
      'generate_branded_apk.js must not default logoFile to logo-muki-ramen.png'
    );

    pass('TEST 5 PASSED: Branded APK generator strictly scopes settings query to target tenant and uses neutral logo fallback!');
  } catch (e) {
    fail('TEST 5 FAILED', e);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 PHASE 9 TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`❌ ${failed} TEST(S) FAILED!`);
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 9 MULTI-TENANT BRANDING, REPORTS & APK TESTS PASSED!');
    process.exit(0);
  }
}

runTests();
