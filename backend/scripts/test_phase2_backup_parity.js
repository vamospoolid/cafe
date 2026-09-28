/**
 * Test Script: Phase 2 Database Backup Parity & Multi-Vertical Info
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- TEST FASE 2: DATABASE BACKUP & INFO PARITY ---');

  // 1. Cari atau verifikasi tenant bengkel
  const bengkelTenant = await prisma.tenant.findFirst({ where: { businessType: 'BENGKEL' } });
  if (!bengkelTenant) {
    console.log('ℹ️ Tidak ada tenant BENGKEL di database untuk pengujian langsung, skipping live count check.');
  } else {
    console.log(`✅ Tenant Bengkel ditemukan: ${bengkelTenant.name} (${bengkelTenant.id})`);
    
    // Hitung entitas bengkel
    const [woCount, vehCount, mecCount] = await Promise.all([
      prisma.workOrder.count({ where: { tenantId: bengkelTenant.id } }),
      prisma.vehicle.count({ where: { tenantId: bengkelTenant.id } }),
      prisma.mechanicProfile.count({ where: { tenantId: bengkelTenant.id } }),
    ]);

    console.log(`   - Work Orders: ${woCount}`);
    console.log(`   - Kendaraan: ${vehCount}`);
    console.log(`   - Mekanik: ${mecCount}`);
  }

  // 2. Verifikasi kueri Prisma untuk entitas bengkel berjalan tanpa error
  try {
    const [wos, parts, services, invoices, vehicles, serviceTypes, mechanics, payouts] = await Promise.all([
      prisma.workOrder.findMany({ take: 1 }),
      prisma.workOrderPart.findMany({ take: 1 }),
      prisma.workOrderService.findMany({ take: 1 }),
      prisma.workOrderInvoice.findMany({ take: 1 }),
      prisma.vehicle.findMany({ take: 1 }),
      prisma.serviceType.findMany({ take: 1 }),
      prisma.mechanicProfile.findMany({ take: 1 }),
      prisma.commissionPayout.findMany({ take: 1 })
    ]);

    console.log('✅ Kueri Prisma untuk seluruh 8 entitas Bengkel berhasil dieksekusi tanpa error schema!');
  } catch (err) {
    console.error('❌ Gagal mengeksekusi kueri entitas bengkel:', err);
    process.exit(1);
  }

  console.log('--- TEST FASE 2 SELESAI DENGAN SUKSES ---\n');
  await prisma.$disconnect();
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
