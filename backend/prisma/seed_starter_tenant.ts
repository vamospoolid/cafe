import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 [Seed Starter] Menyiapkan Akun Tenant Paket STARTER...');

  // 1. Ambil Plan STARTER
  const starterPlan = await prisma.plan.findUnique({
    where: { code: 'STARTER' }
  });

  if (!starterPlan) {
    throw new Error('Plan STARTER tidak ditemukan! Jalankan seed_features.ts terlebih dahulu.');
  }

  // 2. Buat atau update Tenant Starter
  const tenantId = 'tenant-starter-demo';
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kopi-starter' },
    update: {
      name: 'Kedai Kopi Starter Demo',
      planId: starterPlan.id,
      status: 'ACTIVE'
    },
    create: {
      id: tenantId,
      name: 'Kedai Kopi Starter Demo',
      slug: 'kopi-starter',
      planId: starterPlan.id,
      status: 'ACTIVE'
    }
  });

  console.log(`✅ Tenant Starter berhasil dibuat: [${tenant.id}] ${tenant.name}`);

  // 3. Buat Outlet Utama
  const outlet = await prisma.outlet.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'STR-01'
      }
    },
    update: {
      name: 'Kedai Starter - Cabang Utama',
      status: 'ACTIVE'
    },
    create: {
      id: 'outlet-starter-01',
      tenantId: tenant.id,
      name: 'Kedai Starter - Cabang Utama',
      code: 'STR-01',
      status: 'ACTIVE',
      latitude: -6.200000,
      longitude: 106.816666,
      gpsRadiusMeters: 100
    }
  });

  console.log(`✅ Outlet Starter berhasil dibuat: [${outlet.id}] ${outlet.name}`);

  // 4. Buat Pengaturan Toko (Settings)
  const existingSettings = await prisma.settings.findFirst({
    where: { tenantId: tenant.id }
  });

  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        storeName: 'Kedai Kopi Starter Demo',
        phone: '081234567890',
        address: 'Jl. Pemuda No. 10, Jakarta Pusat',
        logoUrl: '/logo-muki-ramen.png',
        taxRate: 0,
        serviceCharge: 0,
        includeTax: false,
        receiptHeader: 'KEDAI KOPI STARTER DEMO\nJl. Pemuda No. 10, Jakarta',
        receiptFooter: 'Terima Kasih Atas Kunjungan Anda!\nPOS Powered by Codenusa',
        tenantId: tenant.id
      }
    });
  }

  // 5. Cari atau Buat Role OWNER
  let ownerRole = await prisma.role.findFirst({
    where: { name: 'OWNER', isSystem: true }
  });

  // 6. Buat User Owner Starter
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { username: 'owner_starter' },
    update: {
      name: 'Budi (Owner Starter)',
      passwordHash: hashedPassword,
      role: 'OWNER',
      status: 'Aktif'
    },
    create: {
      name: 'Budi (Owner Starter)',
      username: 'owner_starter',
      passwordHash: hashedPassword,
      pin: '123456',
      role: 'OWNER',
      status: 'Aktif',
      permissions: JSON.stringify({
        canVoid: true,
        canDiscount: true,
        canEditMenu: true,
        canViewReports: true,
        canManageStaff: true
      })
    }
  });

  // 7. Hubungkan Membership Tenant
  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id
      }
    },
    update: {
      status: 'ACTIVE',
      roleId: ownerRole?.id || null
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      status: 'ACTIVE',
      roleId: ownerRole?.id || null
    }
  });

  console.log(`✅ User Owner Starter berhasil dibuat & dikaitkan:`);
  console.log(`   - Username: owner_starter`);
  console.log(`   - Password: password123`);
  console.log(`   - Plan    : STARTER (Rp 79.000/bln)`);

  // 8. Buat Kategori & Produk Sederhana
  let catKopi = await prisma.category.findFirst({
    where: { tenantId: tenant.id, name: 'Kopi Nusantara' }
  });
  if (!catKopi) {
    catKopi = await prisma.category.create({
      data: {
        name: 'Kopi Nusantara',
        tenantId: tenant.id,
        printerTarget: 'BAR'
      }
    });
  }

  let catSnack = await prisma.category.findFirst({
    where: { tenantId: tenant.id, name: 'Camilan & Roti' }
  });
  if (!catSnack) {
    catSnack = await prisma.category.create({
      data: {
        name: 'Camilan & Roti',
        tenantId: tenant.id,
        printerTarget: 'KITCHEN'
      }
    });
  }

  const existingProducts = await prisma.product.findMany({
    where: { tenantId: tenant.id }
  });

  if (existingProducts.length === 0) {
    await prisma.product.create({
      data: {
        name: 'Kopi Tubruk Hitam',
        buyPrice: 3000,
        sellPrice: 10000,
        stock: 50,
        categoryId: catKopi.id,
        tenantId: tenant.id
      }
    });

    await prisma.product.create({
      data: {
        name: 'Es Kopi Susu Gula Aren',
        buyPrice: 6000,
        sellPrice: 18000,
        stock: 40,
        categoryId: catKopi.id,
        tenantId: tenant.id
      }
    });

    await prisma.product.create({
      data: {
        name: 'Roti Bakar Coklat Keju',
        buyPrice: 5000,
        sellPrice: 15000,
        stock: 30,
        categoryId: catSnack.id,
        tenantId: tenant.id
      }
    });
  }

  console.log(`✅ Sample katalog produk starter berhasil dibuat.`);
  console.log(`🎉 Akun Starter Siap Digunakan!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding starter tenant:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
