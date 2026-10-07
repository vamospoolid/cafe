const { PrismaClient } = require('@prisma/client');
const { deleteTenantClean } = require('./test_delete_sql');

const prisma = new PrismaClient();

const KEEP_SLUGS = [
  'kopinusa',      // RESTO / KAFE
  'jakartamotor',  // BENGKEL
  'laundry1',      // LAUNDRY
  'sewabajubodo',  // RENTAL SEWA BUSANA
  'sabarjaya'      // RETAIL / GROSIR
];

async function main() {
  console.log('================================================================');
  console.log('🧹 PURGING EXTRA TENANTS (LEAVING 1 PER VERTICAL)');
  console.log('Tenants yang DIPERTAHANKAN:', KEEP_SLUGS.join(', '));
  console.log('================================================================\n');

  const allTenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, businessType: true }
  });

  const tenantsToDelete = allTenants.filter(t => !KEEP_SLUGS.includes(t.slug));
  const tenantsToKeep = allTenants.filter(t => KEEP_SLUGS.includes(t.slug));

  console.log(`Ditemukan ${allTenants.length} total tenant.`);
  console.log(`Tenant yang dipertahankan (${tenantsToKeep.length}):`);
  tenantsToKeep.forEach(t => console.log(`  ✅ [${t.businessType}] ${t.name} (slug: ${t.slug})`));

  console.log(`\nTenant yang akan dihapus: ${tenantsToDelete.length}\n`);

  let deletedCount = 0;
  let failedCount = 0;

  for (const tenant of tenantsToDelete) {
    try {
      await deleteTenantClean(prisma, tenant.id);
      deletedCount++;
      process.stdout.write(`\r[${deletedCount}/${tenantsToDelete.length}] Berhasil hapus: ${tenant.slug}...                     `);
    } catch (err) {
      failedCount++;
      console.error(`\n❌ Gagal hapus tenant ${tenant.slug} (${tenant.id}):`, err.message);
    }
  }

  console.log(`\n\n🎉 SELESAI PEMBERSIHAN!`);
  console.log(`Total dihapus: ${deletedCount}`);
  console.log(`Total gagal: ${failedCount}`);

  // Hitung ulang tenant tersisa
  const remaining = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      businessType: true,
      _count: { select: { products: true, orders: true, tables: true } }
    },
    orderBy: { businessType: 'asc' }
  });

  console.log('\n--- DAFTAR TENANT AKTIF TERSISA (1 PER VERTIKAL) ---');
  remaining.forEach((t, i) => {
    console.log(`${i + 1}. [${t.businessType}] ${t.name} (slug: ${t.slug}) | Produk: ${t._count.products}, Meja: ${t._count.tables}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
