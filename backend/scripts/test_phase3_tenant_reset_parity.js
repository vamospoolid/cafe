/**
 * Test Script: Phase 3 Tenant Reset Parity & Starter Templates Validation
 */

const { STARTER_TEMPLATES } = require('../dist/src/routes/tenantReset');

async function runTests() {
  console.log('--- TEST FASE 3: TENANT RESET & TEMPLATES PARITY ---');

  // 1. Periksa ketersediaan starter template otomotif
  const templates = Object.keys(STARTER_TEMPLATES);
  console.log(`Daftar Template Tersedia (${templates.length}):`, templates.join(', '));

  const motorTemplate = STARTER_TEMPLATES['BENGKEL_MOTOR_UMUM'];
  const mobilTemplate = STARTER_TEMPLATES['BENGKEL_MOBIL_DAN_AC'];

  if (!motorTemplate || !mobilTemplate) {
    console.error('❌ Template otomotif (BENGKEL_MOTOR_UMUM / BENGKEL_MOBIL_DAN_AC) tidak ditemukan!');
    process.exit(1);
  }

  console.log('✅ Template BENGKEL_MOTOR_UMUM ditemukan:');
  console.log(`   - Kategori: ${motorTemplate.categories.length}`);
  console.log(`   - Produk/Part: ${motorTemplate.products.length}`);
  console.log(`   - Jasa Servis: ${motorTemplate.serviceTypes.length}`);
  console.log(`   - BusinessType: ${motorTemplate.businessType}`);

  console.log('✅ Template BENGKEL_MOBIL_DAN_AC ditemukan:');
  console.log(`   - Kategori: ${mobilTemplate.categories.length}`);
  console.log(`   - Produk/Part: ${mobilTemplate.products.length}`);
  console.log(`   - Jasa Servis: ${mobilTemplate.serviceTypes.length}`);
  console.log(`   - BusinessType: ${mobilTemplate.businessType}`);

  // 2. Verifikasi printerTarget kategori bengkel tidak ada yang KITCHEN
  const hasKitchenPrinter = [...motorTemplate.categories, ...mobilTemplate.categories]
    .some(c => c.printerTarget === 'KITCHEN' || c.printerTarget === 'BAR');
  if (hasKitchenPrinter) {
    console.error('❌ Ditemukan printerTarget KITCHEN/BAR pada kategori bengkel!');
    process.exit(1);
  }
  console.log('✅ Seluruh kategori bengkel bebas dari printerTarget KITCHEN / BAR!');

  console.log('--- TEST FASE 3 SELESAI DENGAN SUKSES ---\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
