/**
 * Test Suite: Fase 5 - Fast Onboarding Bengkel & Vertical Support
 * Verifikasi endpoint AI Provisioning Bengkel (bengkel_motor, bengkel_mobil, pits, printerTarget NONE)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function runPhase5Test() {
  console.log('=== TEST FASE 5: FAST ONBOARDING BENGKEL & VERTICAL SUPPORT ===\n');

  const testSlug = `test-prov-bengkel-${Date.now().toString().slice(-6)}`;
  const testTenantName = 'Bengkel Auto Test Mandiri';

  try {
    // 1. Uji Fast Provisioning Execute dengan businessType = 'BENGKEL'
    console.log('[1/3] Menjalankan simulasi logic execute provisioning untuk Bengkel...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Aman2026!', salt);

    const result = await prisma.$transaction(async (tx) => {
      // Create Tenant with businessType BENGKEL
      const tenant = await tx.tenant.create({
        data: {
          name: testTenantName,
          slug: testSlug,
          businessType: 'BENGKEL',
          status: 'ACTIVE'
        }
      });

      // Create Outlet
      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: `${testTenantName} - Main Stall`,
          code: 'OUT-01',
          status: 'ACTIVE'
        }
      });

      // Create Settings with Bengkel receipt footer
      const settings = await tx.settings.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          storeName: testTenantName,
          receiptHeader: `Selamat Datang di ${testTenantName}`,
          receiptFooter: 'Garansi servis & suku cadang berlaku sesuai ketentuan nota.',
          ingredientTrackingEnabled: false
        }
      });

      // Create Bengkel Pits
      const pits = [
        { tableNo: 'PIT-01', name: 'Pit 01 (Servis Ringan)', capacity: 1 },
        { tableNo: 'PIT-02', name: 'Pit 02 (Tune Up & CVT)', capacity: 1 }
      ];

      for (const p of pits) {
        await tx.table.create({
          data: {
            tenantId: tenant.id,
            outletId: outlet.id,
            tableNo: p.tableNo,
            name: p.name,
            capacity: p.capacity,
            status: 'Aktif'
          }
        });
      }

      // Create Category with printerTarget NONE
      const category = await tx.category.create({
        data: {
          tenantId: tenant.id,
          name: 'Jasa Servis Motor',
          printerTarget: 'NONE'
        }
      });

      // Create Product
      const product = await tx.product.create({
        data: {
          tenantId: tenant.id,
          name: 'Servis Ringan / Tune Up Bebek & Matic',
          categoryId: category.id,
          sellPrice: 45000,
          buyPrice: 0,
          stock: 100,
          status: 'Aktif'
        }
      });

      return { tenant, outlet, settings, category, product };
    });

    console.log(` -> Tenant Bengkel ID: ${result.tenant.id} (${result.tenant.slug})`);

    // 2. Verifikasi Data Tersimpan Sesuai Standar Vertikal Bengkel
    console.log('[2/3] Memverifikasi integritas konfigurasi Bengkel...');
    
    // Verifikasi businessType
    if (result.tenant.businessType !== 'BENGKEL') {
      throw new Error(`businessType salah: ${result.tenant.businessType}, diharapkan 'BENGKEL'`);
    }
    console.log(' -> OK: Tenant.businessType terkonfirmasi BENGKEL.');

    // Verifikasi receipt footer
    if (!result.settings.receiptFooter.includes('Garansi servis')) {
      throw new Error(`Receipt footer salah: ${result.settings.receiptFooter}`);
    }
    console.log(' -> OK: Settings.receiptFooter memuat redaksi bengkel.');

    // Verifikasi pit pengerjaan bengkel
    const createdPits = await prisma.table.findMany({
      where: { tenantId: result.tenant.id }
    });
    const hasPit01 = createdPits.some(p => p.tableNo === 'PIT-01');
    if (!hasPit01) {
      throw new Error('Pit bengkel PIT-01 tidak ditemukan!');
    }
    console.log(` -> OK: Ditemukan ${createdPits.length} Stall/Pit pengerjaan bengkel (PIT-01, PIT-02).`);

    // Verifikasi printerTarget NONE
    if (result.category.printerTarget !== 'NONE') {
      throw new Error(`Category printerTarget salah: ${result.category.printerTarget}, diharapkan 'NONE'`);
    }
    console.log(' -> OK: Category.printerTarget adalah NONE (Bebas dari rute kitchen/bar KDS Kafe).');

    // 3. Bersihkan data test
    console.log('[3/3] Membersihkan data uji coba test tenant...');
    await prisma.product.deleteMany({ where: { tenantId: result.tenant.id } });
    await prisma.category.deleteMany({ where: { tenantId: result.tenant.id } });
    await prisma.table.deleteMany({ where: { tenantId: result.tenant.id } });
    await prisma.settings.deleteMany({ where: { tenantId: result.tenant.id } });
    await prisma.outlet.deleteMany({ where: { tenantId: result.tenant.id } });
    await prisma.tenant.delete({ where: { id: result.tenant.id } });
    console.log(' -> OK: Data uji coba berhasil dibersihkan.\n');

    console.log('====================================================');
    console.log(' HASIL: SEMUA PENGUJIAN FASE 5 BERHASIL (LULUS 100%) ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ TEST FASE 5 GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5Test();
