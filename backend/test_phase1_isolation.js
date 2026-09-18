const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function testPhase1Isolation() {
  console.log('===========================================================');
  console.log('🧪 TEST FASE 1: ISOLASI PORTAL DEVELOPER & SECURITY GUARDS');
  console.log('===========================================================\n');

  // 1. Buat Token Palsu Kasir Biasa (Non-Platform Admin)
  const cashierToken = jwt.sign({
    id: 99991,
    username: 'kasir_test_fase1',
    role: 'Kasir',
    isPlatformAdmin: false,
    permissions: ['pos.view', 'pos.create']
  }, JWT_SECRET, { expiresIn: '1h' });

  // 2. Buat Token SuperAdmin Developer
  const adminToken = jwt.sign({
    id: 99992,
    username: 'developer_platform_master',
    role: 'OWNER',
    isPlatformAdmin: true,
    permissions: ['*']
  }, JWT_SECRET, { expiresIn: '1h' });

  console.log('1. Menguji Akses Kasir Biasa ke Endpoint Developer (/api/platform-admin/overview)...');
  const resCashier = await fetch('http://localhost:5000/api/platform-admin/overview', {
    headers: { Authorization: `Bearer ${cashierToken}` }
  });

  console.log(`   Status Response Kasir: ${resCashier.status} (${resCashier.statusText})`);
  if (resCashier.status === 403 || resCashier.status === 401) {
    console.log('   ✅ BLOKIR BERHASIL: Kasir biasa ditolak mengakses API platform developer.');
  } else {
    throw new Error(`Security breach! Kasir tidak boleh mengakses endpoint admin. Status: ${resCashier.status}`);
  }

  console.log('\n2. Menguji Akses Platform Developer ke Endpoint Developer...');
  const resAdmin = await fetch('http://localhost:5000/api/platform-admin/overview', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  console.log(`   Status Response Developer: ${resAdmin.status} (${resAdmin.statusText})`);
  if (resAdmin.ok) {
    const data = await resAdmin.json();
    console.log('   ✅ AKSES DIIZINKAN: Developer berhasil memuat metrik MRR & Telemetri.');
    console.log(`   - Total MRR: Rp ${data.metrics?.mrr.toLocaleString('id-ID')}`);
    console.log(`   - Total Bisnis Aktif: ${data.metrics?.activeTenants}`);
  } else {
    throw new Error(`Developer gagal mengakses endpoint platform. Status: ${resAdmin.status}`);
  }

  console.log('\n🏆 SEMUA PENGUJIAN FASE 1 (ISOLASI & SECURITY GUARD) 100% SUKSES!');
}

testPhase1Isolation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
