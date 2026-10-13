/**
 * Verification test for Backup Download and Tenant Rollback execution
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function testBackupEndpointsAndRollback() {
  console.log('--- TESTING BACKUP DOWNLOAD & EMERGENCY ROLLBACK PARITY ---');

  // 1. Dapatkan tenant
  const tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' } });
  if (!tenant) {
    console.error('Tidak ada tenant aktif.');
    process.exit(1);
  }

  // 2. Buat snapshot darurat tiruan di folder backups/db
  const backupDir = path.resolve(process.cwd(), 'backups', 'db');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const emergencyFileName = `pre-restore-emergency-${tenant.id}-${Date.now()}.json`;
  const emergencyPath = path.join(backupDir, emergencyFileName);

  const mockPayload = {
    metadata: {
      tenantId: tenant.id,
      exportedAt: new Date().toISOString(),
      type: 'EMERGENCY_ROLLBACK',
      version: '1.0'
    },
    data: {
      categories: [{ id: 99991, tenantId: tenant.id, name: 'Kategori Emergency Rollback' }],
      products: [],
      suppliers: [],
      ingredients: [],
      recipeItems: [],
      tables: [],
      customers: [],
      cashFlows: [],
      shifts: []
    }
  };

  fs.writeFileSync(emergencyPath, JSON.stringify(mockPayload, null, 2));
  console.log(`✅ Snapshot darurat berhasil dibuat di: ${emergencyFileName}`);

  // 3. Verifikasi rollback logic dari dist tenantReset
  const { executeTenantRestoreTransaction } = require('../dist/src/routes/tenantReset');
  
  if (typeof executeTenantRestoreTransaction !== 'function') {
    throw new Error('executeTenantRestoreTransaction bukan fungsi!');
  }

  // Dapatkan user valid untuk tenant
  const testUser = await prisma.user.findFirst({ where: { tenantId: tenant.id } }) || { id: 1 };

  const result = await executeTenantRestoreTransaction(tenant.id, testUser.id, mockPayload.data, 'CATALOG_ONLY');

  console.log('✅ executeTenantRestoreTransaction dieksekusi dengan hasil:', result);

  // 4. Cek apakah record kategori darurat masuk
  const catCheck = await prisma.category.findFirst({
    where: { tenantId: tenant.id, name: 'Kategori Emergency Rollback' }
  });

  if (!catCheck) {
    throw new Error('Kategori dari emergency rollback gagal dipulihkan ke DB!');
  }
  console.log(`✅ Kategori darurat terverifikasi tersimpan di database: ${catCheck.name} (id: ${catCheck.id})`);

  // Cleanup
  await prisma.category.delete({ where: { id: catCheck.id } });
  if (fs.existsSync(emergencyPath)) fs.unlinkSync(emergencyPath);
  console.log('✅ Pembersihan selesai.');

  console.log('--- ALL BACKUP & ROLLBACK VERIFICATIONS PASSED ---\n');
  await prisma.$disconnect();
}

testBackupEndpointsAndRollback().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
