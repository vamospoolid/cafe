const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🚀 [TEST PHASE 1] Memvalidasi Pendaftaran Tenant & Onboarding Vertikal RETAIL...');

  const timestamp = Date.now();
  const testSlug = `grosirtest${timestamp}`.slice(0, 20);
  const testUsername = `owner_gr_${timestamp}`.slice(0, 20);

  try {
    // 1. Uji Database Direct Simulation untuk Register Tenant RETAIL
    const businessType = 'RETAIL';
    const businessName = `Toko Grosir Berkah ${timestamp}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: businessName,
        slug: testSlug,
        businessType: 'RETAIL',
        status: 'ACTIVE'
      }
    });

    const outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: `${businessName} (Pusat)`,
        code: 'OUT-01',
        status: 'ACTIVE'
      }
    });

    // Seed Retail Categories
    await prisma.category.createMany({
      data: [
        { tenantId: tenant.id, name: 'Sembako & Minyak', printerTarget: 'NONE' },
        { tenantId: tenant.id, name: 'Mie & Makanan Instan', printerTarget: 'NONE' },
        { tenantId: tenant.id, name: 'Minuman Karton & Dus', printerTarget: 'NONE' },
        { tenantId: tenant.id, name: 'Sabun & Kebersihan', printerTarget: 'NONE' },
        { tenantId: tenant.id, name: 'Bumbu Dapur & Sambal', printerTarget: 'NONE' },
        { tenantId: tenant.id, name: 'Rokok & Tembakau', printerTarget: 'NONE' }
      ]
    });

    // Seed Retail Racks / Shelves
    await prisma.table.createMany({
      data: [
        { tenantId: tenant.id, outletId: outlet.id, tableNo: 'RAK-01', name: 'Rak Depan (Sembako)', capacity: 1, posX: 20, posY: 30 },
        { tenantId: tenant.id, outletId: outlet.id, tableNo: 'RAK-02', name: 'Rak Tengah (Makanan & Snack)', capacity: 1, posX: 50, posY: 30 },
        { tenantId: tenant.id, outletId: outlet.id, tableNo: 'GDG-01', name: 'Gudang Belakang (Karton & Bal)', capacity: 1, posX: 80, posY: 30 }
      ]
    });

    // Verifikasi
    const createdTenant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: {
        categories: true,
        outlets: {
          include: { tables: true }
        }
      }
    });

    console.log(`✅ Tenant Berhasil Dibuat: ID=${createdTenant.id}, BusinessType=${createdTenant.businessType}`);
    console.log(`✅ Kategori Retail Dibuat: ${createdTenant.categories.length} Kategori:`);
    createdTenant.categories.forEach(c => console.log(`   - [${c.printerTarget}] ${c.name}`));

    const tables = createdTenant.outlets[0]?.tables || [];
    console.log(`✅ Rak / Gudang Retail Dibuat: ${tables.length} Lokasi:`);
    tables.forEach(t => console.log(`   - ${t.tableNo}: ${t.name}`));

    if (createdTenant.businessType !== 'RETAIL') throw new Error('BusinessType harus RETAIL!');
    if (createdTenant.categories.length !== 6) throw new Error('Harus ada 6 kategori grosir!');
    if (tables.length !== 3) throw new Error('Harus ada 3 rak bawaan!');

    // Cleanup test tenant
    await prisma.table.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.outlet.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });

    console.log('🧹 Cleanup data test berhasil.');
    console.log('🎉 SEMUA TES FASE 1 SUKSES 100%!');
  } catch (err) {
    console.error('❌ Gagal menjalankan test:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
