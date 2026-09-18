/**
 * Test Suite: PHASE 14 - Backup, Monitoring & Observability
 * Run with: node test_phase14.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fork } = require('child_process');

const TEST_PORT = 5000;

function makeRequest(urlPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: urlPath,
      method: method,
      headers: defaultHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(retries = 15, delayMs = 600) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await makeRequest('/api/health/ping');
      if (res.status === 200) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: PHASE 14 - Backup, Monitoring & Observability');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  let serverProcess = null;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 0. Check if server is already running, if not start it
    const isRunning = await waitForServer(2, 300);
    if (!isRunning) {
      console.log('Starting backend server for test execution...');
      serverProcess = fork(path.join(__dirname, 'dist', 'src', 'index.js'), [], {
        env: { ...process.env, PORT: `${TEST_PORT}` },
        silent: true
      });
      const ready = await waitForServer(20, 500);
      if (!ready) {
        throw new Error('Backend server failed to start within timeout');
      }
      console.log('Backend server online on port ' + TEST_PORT);
    }

    // ─── TEST 1: Fast Liveness Probe (/api/health/ping) ──────────────────────
    console.log('\n--- TEST 1: Fast Liveness Probe (/api/health/ping) ---');
    const pingRes = await makeRequest('/api/health/ping');
    assert(pingRes.status === 200, `Liveness ping returned HTTP 200 (got ${pingRes.status})`);
    assert(pingRes.data?.status === 'ok', `Ping status is 'ok'`);
    assert(typeof pingRes.data?.uptimeSeconds === 'number', `Uptime reported in seconds: ${pingRes.data?.uptimeSeconds}s`);

    // ─── TEST 2: Deep Observability Telemetry (/api/health/deep) ─────────────
    console.log('\n--- TEST 2: Deep Observability Telemetry (/api/health/deep) ---');
    const deepRes = await makeRequest('/api/health/deep');
    assert(deepRes.status === 200, `Deep health returned HTTP 200 (got ${deepRes.status})`);
    assert(deepRes.data?.status === 'healthy' || deepRes.data?.status === 'degraded', `System status is ${deepRes.data?.status}`);
    assert(deepRes.data?.database?.status === 'connected', `Database connected successfully`);
    assert(typeof deepRes.data?.database?.latencyMs === 'number', `Database query latency measured: ${deepRes.data?.database?.latencyMs} ms`);
    assert(typeof deepRes.data?.database?.rlsEnforced === 'boolean', `PostgreSQL RLS enforcement state detected: ${deepRes.data?.database?.rlsEnforced}`);
    assert(deepRes.data?.memory?.heapUsedMb > 0, `Node.js RAM heap usage telemetry: ${deepRes.data?.memory?.heapUsedMb} MB`);
    assert(deepRes.data?.database?.telemetry?.tenants >= 1, `Multi-tenant telemetry count: ${deepRes.data?.database?.telemetry?.tenants} tenants active`);

    // ─── TEST 3: Automated AES-256 Encrypted Backup Generation ───────────────
    console.log('\n--- TEST 3: Backup Engine & AES-256 Encryption ---');
    const { BackupService } = require('./dist/src/services/BackupService');
    
    const backupResult = await BackupService.createBackup({
      isEncrypted: true,
      compress: true,
      type: 'json'
    });

    assert(backupResult && backupResult.fileName, `Backup created with file name: ${backupResult.fileName}`);
    assert(fs.existsSync(backupResult.filePath), `Backup archive file exists on disk: ${backupResult.filePath}`);
    assert(fs.existsSync(`${backupResult.filePath}.meta.json`), `Backup metadata file exists: ${backupResult.fileName}.meta.json`);
    assert(backupResult.isEncrypted === true, `Backup marked as encrypted: true`);

    // Verify SHA-256 Checksum integrity
    const fileBytes = fs.readFileSync(backupResult.filePath);
    const calculatedSha = crypto.createHash('sha256').update(fileBytes).digest('hex');
    assert(calculatedSha === backupResult.checksumSha256, `SHA-256 checksum matched (${calculatedSha.slice(0, 16)}...)`);

    // Verify data is ciphertext (cannot be JSON parsed directly)
    let isPlainJson = false;
    try {
      JSON.parse(fileBytes.toString('utf-8'));
      isPlainJson = true;
    } catch {
      isPlainJson = false;
    }
    assert(!isPlainJson, `Backup file is properly encrypted binary/ciphertext (not plain JSON)`);

    // ─── TEST 4: Backup Cataloging & Listing ────────────────────────────────
    console.log('\n--- TEST 4: Backup Cataloging & Listing ---');
    const backupList = await BackupService.listBackups();
    assert(Array.isArray(backupList) && backupList.length > 0, `Backup catalog retrieved: ${backupList.length} snapshots listed`);
    const found = backupList.find(b => b.fileName === backupResult.fileName);
    assert(!!found, `Newly created encrypted backup listed in catalog`);

    // ─── TEST 5: Disaster Recovery Decryption & Restore Engine ────────────────
    console.log('\n--- TEST 5: Disaster Recovery Restore Engine ---');
    const restoreResult = await BackupService.restoreBackup(backupResult.fileName);
    assert(restoreResult.success === true, `Backup decrypted, decompressed, and restored successfully!`);
    console.log(`   Message: ${restoreResult.message}`);

    // ─── TEST 6: Tamper & Checksum Mismatch Defense ──────────────────────────
    console.log('\n--- TEST 6: Tampered Backup Integrity Defense ---');
    const tamperedFileName = `tampered-backup-${Date.now()}.json.gz.enc`;
    const tamperedPath = path.join(process.cwd(), 'backups', tamperedFileName);
    fs.writeFileSync(tamperedPath, Buffer.from('TAMPERED_MALICIOUS_DATA_CONTENT'));
    fs.writeFileSync(`${tamperedPath}.meta.json`, JSON.stringify({
      fileName: tamperedFileName,
      filePath: tamperedPath,
      sizeBytes: 32,
      checksumSha256: 'deadbeef00000000000000000000000000000000000000000000000000000000',
      isEncrypted: true,
      scope: 'PLATFORM_ALL',
      type: 'json',
      createdAt: new Date().toISOString(),
      schemaVersion: '2026.2'
    }));

    let tamperRejected = false;
    try {
      await BackupService.restoreBackup(tamperedFileName);
    } catch (tamperErr) {
      tamperRejected = true;
      console.log(`   Expected Rejection: ${tamperErr.message}`);
    }
    assert(tamperRejected, `Tampered backup rejected automatically due to checksum mismatch`);

    // Cleanup tampered test file
    try {
      fs.unlinkSync(tamperedPath);
      fs.unlinkSync(`${tamperedPath}.meta.json`);
    } catch {}

    // ─── TEST 7: Retention Policy Pruning Engine ─────────────────────────────
    console.log('\n--- TEST 7: Retention Policy Pruning Engine ---');
    const purgeResult = await BackupService.purgeOldBackups(30);
    assert(typeof purgeResult.deletedCount === 'number', `Purge execution completed without error (Retained: ${purgeResult.retainedCount} files)`);

  } catch (err) {
    console.error('Unhandled test execution error:', err);
    failed++;
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  console.log('\n===============================================================');
  console.log(`🏁 PHASE 14 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
