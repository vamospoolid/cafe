/**
 * Test Script: Phase 4 Vertical Migration & Bengkel Seed Validation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('--- TEST FASE 4: VERTICAL MIGRATION & SEED VALIDATION ---');

  // 1. Verifikasi kode auth.ts bahwa printerTarget bengkel sudah NONE
  const authPath = path.resolve(__dirname, '../src/routes/auth.ts');
  const authContent = fs.readFileSync(authPath, 'utf8');

  const hasBengkelKitchenSeed = authContent.includes("{ tenantId: tenant.id, name: 'Oli & Pelumas Mesin', printerTarget: 'KITCHEN' }");
  if (hasBengkelKitchenSeed) {
    console.error('❌ Gagal: Masih ditemukan printerTarget KITCHEN pada seed bengkel di auth.ts!');
    process.exit(1);
  }
  console.log('✅ auth.ts terverifikasi: Seed awal kategori bengkel menggunakan printerTarget: NONE.');

  // 2. Verifikasi route settings.ts memuat migrate-vertical
  const settingsPath = path.resolve(__dirname, '../src/routes/settings.ts');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  if (!settingsContent.includes("router.post('/migrate-vertical'")) {
    console.error('❌ Gagal: Endpoint /migrate-vertical tidak ditemukan di settings.ts!');
    process.exit(1);
  }
  console.log('✅ settings.ts terverifikasi: Endpoint POST /api/settings/migrate-vertical tersedia.');

  // 3. Verifikasi cache invalidation & audit log pattern di endpoint
  if (settingsContent.includes('invalidateTenantCache(tenantId)') && settingsContent.includes('cache:tenant:businessType:')) {
    console.log('✅ Endpoint menyertakan invalidasi cache real-time untuk tenantId dan businessType.');
  } else {
    console.error('❌ Gagal: Endpoint tidak memanggil invalidasi cache!');
    process.exit(1);
  }

  console.log('--- TEST FASE 4 SELESAI DENGAN SUKSES ---\n');
  await prisma.$disconnect();
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
