import prisma from '../src/db';
import * as bcrypt from 'bcryptjs';

async function testLogin(username: string, password: string, tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error('Tenant tidak ditemukan');

  const cleanUsername = String(username).trim().toLowerCase();

  // Pencarian user scoped per tenant (utamakan user yang didaftarkan langsung di tenant ini)
  const user = await prisma.user.findFirst({
    where: {
      username: cleanUsername,
      tenantId: tenant.id
    }
  });

  if (!user) {
    console.log(`❌ Login gagal untuk ${tenantSlug}: User tidak ditemukan`);
    return;
  }

  let isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch && user.pin === password) {
    isMatch = true;
  }
  if (!isMatch) {
    console.log(`❌ Login gagal untuk ${tenantSlug}: Password/PIN salah`);
    return;
  }

  console.log(`✅ LOGIN SUKSES di [${tenant.name}] (${tenantSlug})!`);
  console.log(`   -> User ID  : ${user.id}`);
  console.log(`   -> Nama     : ${user.name}`);
  console.log(`   -> Username : ${user.username}`);
  console.log(`   -> PIN Toko : ${user.pin}`);
  console.log(`   -> Vertikal : ${tenant.businessType}`);
}

async function main() {
  console.log('=== TEST LOGIN RESOLUTION PER TENANT DENGAN USERNAME SAMA ("kasir") ===\n');

  // Test 1: Login di Jakarta Motor dengan username "kasir" & PIN 1111
  console.log('1. Kasir login di link Jakarta Motor: https://jakartamotor.codenusa.id');
  await testLogin('kasir', '1111', 'jakartamotor');

  console.log('\n--------------------------------------------------------------\n');

  // Test 2: Login di Sabar Jaya dengan username "kasir" & PIN 2222
  console.log('2. Kasir login di link Sabar Jaya: https://sabarjaya.codenusa.id');
  await testLogin('kasir', '2222', 'sabarjaya');

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
