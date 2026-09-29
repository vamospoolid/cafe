import prisma from '../src/db';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log('=== TEST CREATING 2 DISTINCT USERS WITH SAME USERNAME "kasir" ===');

  // 1. Ambil atau Buat Tenant Bengkel "Jakarta Motor"
  let tenantBengkel = await prisma.tenant.findUnique({ where: { slug: 'jakartamotor' } });
  if (!tenantBengkel) {
    tenantBengkel = await prisma.tenant.create({
      data: {
        name: 'Jakarta Motor',
        slug: 'jakartamotor',
        businessType: 'BENGKEL',
        status: 'ACTIVE'
      }
    });
  }
  console.log('• Tenant Bengkel:', tenantBengkel.name, `(ID: ${tenantBengkel.id})`);

  // 2. Ambil atau Buat Tenant Grosir "Sabar Jaya"
  let tenantGrosir = await prisma.tenant.findUnique({ where: { slug: 'sabarjaya' } });
  if (!tenantGrosir) {
    tenantGrosir = await prisma.tenant.create({
      data: {
        name: 'Sabar Jaya',
        slug: 'sabarjaya',
        businessType: 'RETAIL',
        status: 'ACTIVE'
      }
    });
  }
  console.log('• Tenant Grosir:', tenantGrosir.name, `(ID: ${tenantGrosir.id})`);

  const passwordHash = await bcrypt.hash('123456', 10);

  // 3. Buat Kasir untuk Jakarta Motor (Ahmad, username: "kasir")
  console.log('\n--- 1. Buat Kasir Jakarta Motor (Ahmad - kasir) ---');
  let kasirBengkel = await prisma.user.findFirst({
    where: {
      username: 'kasir',
      tenantId: tenantBengkel.id
    }
  });

  if (!kasirBengkel) {
    kasirBengkel = await prisma.user.create({
      data: {
        name: 'Ahmad (Kasir Bengkel)',
        username: 'kasir',
        tenantId: tenantBengkel.id,
        passwordHash,
        pin: '1111',
        role: 'Kasir',
        status: 'Aktif',
        permissions: JSON.stringify({ canVoid: false, canDiscount: true })
      }
    });
    console.log('✓ BERHASIL buat User Kasir Jakarta Motor:', kasirBengkel.name, `(User ID: ${kasirBengkel.id})`);
  } else {
    console.log('• Kasir Jakarta Motor sudah ada (User ID:', kasirBengkel.id, ')');
  }

  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: kasirBengkel.id,
        tenantId: tenantBengkel.id
      }
    },
    update: {},
    create: {
      userId: kasirBengkel.id,
      tenantId: tenantBengkel.id,
      roleId: 'role-system-cashier',
      pin: '1111',
      status: 'ACTIVE'
    }
  });

  // 4. Buat Kasir untuk Sabar Jaya (Doni, username: "kasir" YANG SAMA PERSIS!)
  console.log('\n--- 2. Buat Kasir Sabar Jaya (Doni - kasir) dengan username yang SAMA PERSIS ---');
  let kasirGrosir = await prisma.user.findFirst({
    where: {
      username: 'kasir',
      tenantId: tenantGrosir.id
    }
  });

  if (!kasirGrosir) {
    kasirGrosir = await prisma.user.create({
      data: {
        name: 'Doni (Kasir Grosir)',
        username: 'kasir', // <-- USERNAME SAMA PERSIS!
        tenantId: tenantGrosir.id, // <-- Tenant berbeda
        passwordHash,
        pin: '2222',
        role: 'Kasir',
        status: 'Aktif',
        permissions: JSON.stringify({ canVoid: false, canDiscount: true })
      }
    });
    console.log('✓ BERHASIL buat User Kasir Sabar Jaya:', kasirGrosir.name, `(User ID: ${kasirGrosir.id})`);
  } else {
    console.log('• Kasir Sabar Jaya sudah ada (User ID:', kasirGrosir.id, ')');
  }

  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: kasirGrosir.id,
        tenantId: tenantGrosir.id
      }
    },
    update: {},
    create: {
      userId: kasirGrosir.id,
      tenantId: tenantGrosir.id,
      roleId: 'role-system-cashier',
      pin: '2222',
      status: 'ACTIVE'
    }
  });

  // 5. Verifikasi: Apakah kedua kasir ini adalah 2 entitas User yang berbeda di database?
  console.log('\n--- 3. Verifikasi Independensi Database ---');
  console.log('Kasir Jakarta Motor -> ID:', kasirBengkel.id, '| Nama:', kasirBengkel.name, '| Username:', kasirBengkel.username, '| Tenant:', kasirBengkel.tenantId);
  console.log('Kasir Sabar Jaya    -> ID:', kasirGrosir.id, '| Nama:', kasirGrosir.name, '| Username:', kasirGrosir.username, '| Tenant:', kasirGrosir.tenantId);

  if (kasirBengkel.id !== kasirGrosir.id && kasirBengkel.username === kasirGrosir.username) {
    console.log('\n🎉 SUKSES 100%! Dua akun kasir orang berbeda berhasil hidup berdampingan dengan USERNAME SAMA ("kasir")!');
  } else {
    console.log('\n⚠️ Kasir masih berbagi entitas ID yang sama.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
