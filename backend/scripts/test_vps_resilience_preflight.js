/**
 * VPS Pre-Flight Resilience & Architecture Test Suite
 * 
 * Memverifikasi seluruh perbaikan kesiapan VPS tanpa perlu menyentuh server produksi.
 * Jalankan dengan: node scripts/test_vps_resilience_preflight.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('==================================================================');
console.log('🛡️  VPS PRE-FLIGHT RESILIENCE & ARCHITECTURE VERIFICATION SUITE');
console.log('==================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`         ${e.message}`);
    failed++;
  }
}

// ─── TEST 1: trust proxy in index.ts ──────────────────────────────────────────
console.log('[TEST 1] Memeriksa konfigurasi Trust Proxy di backend/src/index.ts...');
test('app.set("trust proxy", 1) ditemukan di index.ts', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(
    content.includes("app.set('trust proxy', 1)"),
    'KRITIS: Trust proxy tidak ditemukan! Semua kasir akan diblokir bersama oleh rate limiter Nginx.'
  );
});

// ─── TEST 2: ALLOWED_ORIGINS CORS support ─────────────────────────────────────
console.log('\n[TEST 2] Memeriksa dukungan ALLOWED_ORIGINS di CORS config...');
test('extraAllowedOrigins dari ALLOWED_ORIGINS env var ditemukan', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(
    content.includes('ALLOWED_ORIGINS'),
    'ALLOWED_ORIGINS env var tidak ditemukan di CORS config. Domain VPS tidak bisa dikonfigurasi.'
  );
  assert(
    content.includes('extraAllowedOrigins'),
    'extraAllowedOrigins tidak dipakai untuk evaluasi CORS origin.'
  );
});

// ─── TEST 3: Graceful Shutdown ─────────────────────────────────────────────────
console.log('\n[TEST 3] Memeriksa Graceful Shutdown handlers...');
test('SIGTERM handler ditemukan di index.ts', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(content.includes("process.on('SIGTERM'"), 'SIGTERM handler tidak ditemukan!');
});
test('SIGINT handler ditemukan di index.ts', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(content.includes("process.on('SIGINT'"), 'SIGINT handler tidak ditemukan!');
});
test('prisma.$disconnect() dipanggil saat shutdown', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(content.includes('prisma.$disconnect()'), 'Koneksi database tidak diputus saat graceful shutdown!');
});

// ─── TEST 4: Global Error Trapping ────────────────────────────────────────────
console.log('\n[TEST 4] Memeriksa Global Error Trapping...');
test('unhandledRejection listener ditemukan', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(content.includes("process.on('unhandledRejection'"), 'unhandledRejection listener tidak ditemukan!');
});
test('uncaughtException listener ditemukan', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(content.includes("process.on('uncaughtException'"), 'uncaughtException listener tidak ditemukan!');
});

// ─── TEST 5: PM2 Worker Cron Isolation ────────────────────────────────────────
console.log('\n[TEST 5] Memeriksa Isolasi Cron ke Primary Worker PM2...');
test('isPrimaryWorker guard ditemukan di index.ts', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert(content.includes('isPrimaryWorker'), 'isPrimaryWorker guard tidak ditemukan!');
  assert(content.includes('NODE_APP_INSTANCE'), 'NODE_APP_INSTANCE check tidak ditemukan!');
});
test('Cron setInterval dibungkus dengan isPrimaryWorker', () => {
  const indexPath = path.resolve(__dirname, '..', 'src', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  const cronIdx = content.indexOf('setInterval');
  const workerIdx = content.indexOf('isPrimaryWorker');
  assert(workerIdx < cronIdx, 'isPrimaryWorker harus dideklarasikan sebelum setInterval cron!');
});

// ─── TEST 6: deploy scripts --accept-data-loss removed ────────────────────────
console.log('\n[TEST 6] Memeriksa keamanan skrip deployment (tidak ada --accept-data-loss)...');

const deployScriptsToCheck = [
  path.resolve(__dirname, '..', '..', 'scripts', 'deploy_saas.sh'),
  path.resolve(__dirname, '..', '..', 'scripts', 'step3_and_4_deploy.js'),
];

for (const deployPath of deployScriptsToCheck) {
  const fname = path.basename(deployPath);
  test(`Flag --accept-data-loss TIDAK ada di ${fname}`, () => {
    if (!fs.existsSync(deployPath)) {
      throw new Error(`File tidak ditemukan: ${deployPath}`);
    }
    const content = fs.readFileSync(deployPath, 'utf-8');
    // Cek hanya baris aktif (bukan komentar)
    const activeLines = content.split('\n').filter(l => !l.trim().startsWith('#') && !l.trim().startsWith('//'));
    const dangerous = activeLines.some(l => l.includes('--accept-data-loss'));
    assert(
      !dangerous,
      `BERBAHAYA: --accept-data-loss MASIH ditemukan sebagai perintah aktif di ${fname}!`
    );
  });
}

// ─── TEST 7: Nginx anti-execution guard in /uploads/ ──────────────────────────
console.log('\n[TEST 7] Memeriksa proteksi eksekusi skrip di konfigurasi Nginx...');
test('Blok larangan eksekusi skrip di /uploads/ ditemukan di nginx/codepos.conf', () => {
  const nginxPath = path.resolve(__dirname, '..', '..', 'deployment', 'nginx', 'codepos.conf');
  if (!fs.existsSync(nginxPath)) {
    throw new Error(`codepos.conf tidak ditemukan di path: ${nginxPath}`);
  }
  const content = fs.readFileSync(nginxPath, 'utf-8');
  assert(content.includes('deny all'), 'Blok "deny all" tidak ditemukan di konfigurasi Nginx /uploads/!');
  assert(content.includes('.php'), 'Ekstensi .php tidak diblokir dalam konfigurasi /uploads/!');
  assert(content.includes('.sh'), 'Ekstensi .sh tidak diblokir dalam konfigurasi /uploads/!');
});

// ─── FINAL RESULTS ─────────────────────────────────────────────────────────────
console.log('\n==================================================================');
if (failed === 0) {
  console.log(`🌟 SEMUA ${passed} TES LULUS! Sistem siap dianalisis untuk deployment VPS.`);
} else {
  console.log(`⚠️  HASIL TES: ${passed} lulus, ${failed} GAGAL.`);
  console.log('   Perbaiki kegagalan di atas sebelum deployment ke VPS produksi!');
}
console.log('==================================================================');
process.exit(failed > 0 ? 1 : 0);
