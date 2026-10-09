import 'dotenv/config';
import prisma from '../src/db';
import { DemoSeederService } from '../src/services/DemoSeederService';

/**
 * seed_all_demo.ts
 * ============================================================================
 * CLI Runner untuk menyuntikkan data demo lengkap ke seluruh tenant yang ada di DB
 * sesuai profil vertikal masing-masing (CAFE, RETAIL, RENTAL, LAUNDRY, BENGKEL).
 *
 * Jalankan:
 * npx tsx prisma/seed_all_demo.ts
 * ============================================================================
 */

async function main() {
  console.log('\n🚀 =========================================================');
  console.log('   MENYUNTIKKAN DATA DEMO MULTI-VERTIKAL KE SEMUA TENANT');
  console.log('=========================================================\n');

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Ditemukan ${tenants.length} tenant di database.`);

  for (const t of tenants) {
    const v = (t.businessType || 'CAFE').toUpperCase();
    console.log(`\n📦 [${v}] Memproses tenant: ${t.name} (slug: ${t.slug}, id: ${t.id})...`);
    try {
      const res = await DemoSeederService.seedVerticalDemo(t.id);
      console.log(`   ✅ Berhasil! Total produk: ${res.productsCount}`);
    } catch (err: any) {
      console.error(`   ❌ Gagal pada tenant ${t.slug}:`, err?.message || err);
    }
  }

  console.log('\n✨ =========================================================');
  console.log('   SEMUA TENANT BERHASIL DI-SEED DENGAN DATA DEMO LENGKAP!');
  console.log('=========================================================\n');
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
