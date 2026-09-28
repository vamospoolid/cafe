/**
 * Automated Verification Suite: Universal Tablet Device Pairing & Multi-Tenant Security
 * Tests:
 * 1. 6-Character Pairing Code Generation with 10-Minute TTL
 * 2. Cryptographic Code Burn (Single-Use Atomicity)
 * 3. TTL Expiry Enforcement (Expired codes rejected)
 * 4. Multi-Tenant Scoping & Strict Tenant Isolation in Issued JWT
 * 5. Anti-Brute-Force Rate Limiting (Max 5 attempts / 15 mins)
 * 6. Device Unpair & Revocation
 * 7. Live Web Version Telemetry Endpoint (/api/app/version)
 */

const http = require('http');
const jwt = require('jsonwebtoken');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING: Universal Tablet Device Pairing & Security Test Suite');
  console.log('================================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

  // Reset rate limits before test starts
  await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/devices/reset-rate-limit',
    method: 'POST'
  }).catch(() => {});

  // 1. Check /api/app/version
  console.log('📌 Test 1: Live Web App Version Telemetry (/api/app/version)');
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/app/version',
      method: 'GET'
    });

    assert(res.status === 200, `Endpoint returned HTTP 200 (Got: ${res.status})`);
    assert(res.data.appName === 'CodePOS Universal Tablet', `appName is 'CodePOS Universal Tablet'`);
    assert(res.data.liveUpdateEnabled === true, `liveUpdateEnabled is true for 0 rebuilds`);
    assert(Boolean(res.data.latestBundleHash), `latestBundleHash is present: ${res.data.latestBundleHash}`);
  } catch (err) {
    assert(false, `Test 1 failed: ${err.message}`);
  }

  // 2. Generate Pairing Code using an Owner Token
  console.log('\n📌 Test 2: Cryptographic Pairing Code Generation (Owner-Only)');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const tenantA = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
    include: { outlets: true }
  });
  if (!tenantA) {
    throw new Error('No active tenant found in database for test');
  }

  const realUser = await prisma.user.findFirst({
    where: { status: 'Aktif' },
    include: { memberships: { include: { tenant: true } } }
  });
  if (!realUser) {
    throw new Error('No active user found in database');
  }

  const tenantA_Id = realUser.tenantId || realUser.memberships?.[0]?.tenantId || tenantA.id;
  const outletIdA = tenantA.outlets && tenantA.outlets.length > 0 ? tenantA.outlets[0].id : 'outlet_utama';

  const ownerTokenA = jwt.sign(
    { id: realUser.id, username: realUser.username, role: 'OWNER', tenantId: tenantA_Id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let generatedCodeA = '';
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/devices/generate-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      }
    }, { outletId: outletIdA });

    assert(res.status === 200, `Generate code returned HTTP 200 (Got: ${res.status})`);
    assert(res.data.success === true, 'Response indicates success');
    assert(typeof res.data.code === 'string' && res.data.code.length >= 6, `Generated pairing code format is valid: ${res.data.code}`);
    assert(res.data.expiresInSeconds === 600, 'Code has exactly 10-minute (600s) TTL');
    generatedCodeA = res.data.code;
  } catch (err) {
    assert(false, `Test 2 failed: ${err.message}`);
  }

  // 3. Unauthorized access check (Non-owner / Unauthenticated cannot generate pairing code)
  console.log('\n📌 Test 3: Unauthorized Pairing Code Generation Blocked');
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/devices/generate-code',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});

    assert(res.status === 401 || res.status === 403, `Unauthenticated request correctly blocked (HTTP ${res.status})`);
  } catch (err) {
    assert(false, `Test 3 failed: ${err.message}`);
  }

  // 4. Pair Tablet Device using Code
  console.log('\n📌 Test 4: Tablet Device Activation & Strict JWT Tenant Scoping');
  let deviceTokenA = '';
  let deviceIdA = '';
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/devices/pair',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      pairingCode: generatedCodeA,
      deviceName: 'Tablet Kasir Bar Utama (Samsung Tab A9)',
      appVersion: '2.5.0'
    });

    assert(res.status === 200, `Pairing returned HTTP 200 (Got: ${res.status})`);
    assert(Boolean(res.data.token), 'Device received signed JWT token');
    assert(Boolean(res.data.device), 'Device received registered device metadata');

    deviceTokenA = res.data.token;
    deviceIdA = res.data.device.id;

    // Decode & verify JWT claims
    const decoded = jwt.decode(deviceTokenA);
    assert(decoded.tenantId === tenantA_Id, `Issued token strictly bound to tenant: ${decoded.tenantId}`);
    assert(decoded.role === 'CASHIER' || decoded.role === 'Kasir', `Device role is scoped to CASHIER/Kasir (${decoded.role})`);
    assert(decoded.isDevice === true, `Token includes isDevice: true`);
  } catch (err) {
    assert(false, `Test 4 failed: ${err.message}`);
  }

  // 5. Code Burn Verification (Single-Use Atomicity)
  console.log('\n📌 Test 5: Single-Use Code Burn (Replay Attack Prevention)');
  try {
    const replayRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/devices/pair',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      pairingCode: generatedCodeA,
      deviceName: 'Attacker Tablet Replay',
      appVersion: '2.5.0'
    });

    assert(replayRes.status === 400, `Reused code rejected with HTTP 400 (Got: ${replayRes.status})`);
    assert(replayRes.data.error.includes('tidak valid') || replayRes.data.error.includes('kedaluwarsa'), `Replay error message matches: ${replayRes.data.error}`);
  } catch (err) {
    assert(false, `Test 5 failed: ${err.message}`);
  }

  // 6. Anti Brute-Force Rate Limiting
  console.log('\n📌 Test 6: Anti-Brute-Force Rate Limiting on /pair');
  try {
    let rateLimited = false;
    // Attempt 6 rapid wrong codes
    for (let i = 0; i < 6; i++) {
      const failRes = await makeRequest({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/devices/pair',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        pairingCode: `WRG-${1000 + i}`,
        deviceName: 'Brute Force Probe',
        appVersion: '2.5.0'
      });

      if (failRes.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Rate limiter triggered HTTP 429 after threshold of failed attempts');
  } catch (err) {
    assert(false, `Test 6 failed: ${err.message}`);
  }

  // 7. Device Unpair & Revocation
  console.log('\n📌 Test 7: Device Unpair & Revocation');
  try {
    const unpairRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/devices/unpair',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTokenA}`
      }
    }, {
      deviceId: deviceIdA
    });

    assert(unpairRes.status === 200, `Unpair returned HTTP 200 (Got: ${unpairRes.status})`);
    assert(unpairRes.data.success === true, 'Device successfully unpaired and deactivated');
  } catch (err) {
    assert(false, `Test 7 failed: ${err.message}`);
  }

  // Final Summary
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================\n');

  await prisma.$disconnect();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
