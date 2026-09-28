const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const bcrypt = require(path.resolve(__dirname, '../backend/node_modules/bcryptjs'));

const prisma = new PrismaClient();

async function createDjoinCafeTenant() {
  console.log('🚀 Membuat Tenant / Customer Baru: Djoin Cafe (djoincafe)...');

  // 1. Dapatkan atau buat Plan Growth
  let growthPlan = await prisma.plan.findUnique({ where: { code: 'GROWTH' } });
  if (!growthPlan) {
    growthPlan = await prisma.plan.create({
      data: {
        code: 'GROWTH',
        name: 'Growth Plan',
        description: 'Paket Profesional Kafe & Resto Modern',
        priceMonthly: 249000,
        priceYearly: 2490000,
        maxOutlets: 3,
        maxUsers: 10,
        maxProducts: 500,
        isActive: true
      }
    });
  }

  // 2. Buat atau perbarui Tenant 'djoincafe'
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'djoincafe' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Djoin Cafe & Roastery',
        slug: 'djoincafe',
        status: 'ACTIVE',
        planId: growthPlan.id,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    console.log(`✅ Tenant dibuat: ${tenant.name} (ID: ${tenant.id}, Slug: ${tenant.slug})`);
  } else {
    console.log(`ℹ️ Tenant sudah ada: ${tenant.name} (ID: ${tenant.id})`);
  }

  // 3. Buat Outlet Utama Djoin Cafe
  let outlet = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, code: 'DJN-01' }
  });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Djoin Cafe - Outlet Utama',
        code: 'DJN-01',
        address: 'Jl. Merdeka No. 88, Pusat Kota',
        phone: '081234567890',
        latitude: -6.200000,
        longitude: 106.816666,
        gpsRadiusMeters: 150,
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Outlet dibuat: ${outlet.name}`);
  }

  // 4. Buat Role OWNER
  let ownerRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, name: 'OWNER' }
  });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'OWNER',
        description: 'Pemilik Usaha Djoin Cafe',
        isSystem: true
      }
    });
  }

  // 5. Buat User Owner: 'djoincafe'
  const hashedPassword = await bcrypt.hash('djoin123', 10);
  let user = await prisma.user.findUnique({ where: { username: 'djoincafe' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Owner Djoin Cafe',
        username: 'djoincafe',
        passwordHash: hashedPassword,
        pin: '123456',
        role: 'Admin',
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
    console.log(`✅ User Owner dibuat: username 'djoincafe' / password 'djoin123' / PIN '123456'`);
  }

  // 6. Buat Tenant Membership
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: tenant.id, userId: user.id }
  });
  if (!membership) {
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRole.id,
        status: 'ACTIVE'
      }
    });
    console.log(`✅ TenantMembership dikaitkan: User @djoincafe -> Djoin Cafe`);
  }

  // 7. Buat Settings Toko
  const existingSettings = await prisma.settings.findFirst({
    where: { tenantId: tenant.id }
  });
  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        storeName: 'DJOIN CAFE & ROASTERY',
        phone: '081234567890',
        address: 'Jl. Merdeka No. 88, Pusat Kota',
        logoUrl: '/logo-djoin-cafe.png',
        taxRate: 10,
        serviceCharge: 5,
        includeTax: false,
        receiptHeader: 'DJOIN CAFE & ROASTERY\nSpecialty Coffee & Artisan Pastry',
        receiptFooter: 'Terima kasih telah menikmati sajian kami!\nFollow IG: @djoincafe',
        bankName: 'BCA',
        accountNumber: '8910-2938-44',
        accountName: 'DJOIN CAFE INDONESIA'
      }
    });
    console.log(`✅ Pengaturan Toko Djoin Cafe disimpan`);
  }

  // 8. Buat Kategori & Menu Produk
  const categoriesData = [
    { name: 'Specialty Coffee', printerTarget: 'BAR' },
    { name: 'Artisan Mocktails', printerTarget: 'BAR' },
    { name: 'Main Course & Pasta', printerTarget: 'KITCHEN' },
    { name: 'Pastries & Desserts', printerTarget: 'KITCHEN' }
  ];

  for (const cat of categoriesData) {
    let category = await prisma.category.findFirst({
      where: { tenantId: tenant.id, name: cat.name }
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: cat.name,
          printerTarget: cat.printerTarget
        }
      });
    }

    // Sample Products
    if (cat.name === 'Specialty Coffee') {
      const existingProduct = await prisma.product.findFirst({
        where: { tenantId: tenant.id, name: 'Djoin Signature Aren Latte' }
      });
      if (!existingProduct) {
        await prisma.product.createMany({
          data: [
            {
              tenantId: tenant.id,
              categoryId: category.id,
              name: 'Djoin Signature Aren Latte',
              sellPrice: 28000,
              buyPrice: 12000,
              stock: 99,
              status: 'Aktif'
            },
            {
              tenantId: tenant.id,
              categoryId: category.id,
              name: 'V60 Pour Over - Single Origin',
              sellPrice: 32000,
              buyPrice: 15000,
              stock: 50,
              status: 'Aktif'
            },
            {
              tenantId: tenant.id,
              categoryId: category.id,
              name: 'Spanish Latte with Sweet Foam',
              sellPrice: 30000,
              buyPrice: 13000,
              stock: 80,
              status: 'Aktif'
            }
          ]
        });
      }
    } else if (cat.name === 'Main Course & Pasta') {
      const existingProduct = await prisma.product.findFirst({
        where: { tenantId: tenant.id, name: 'Creamy Truffle Carbonara' }
      });
      if (!existingProduct) {
        await prisma.product.createMany({
          data: [
            {
              tenantId: tenant.id,
              categoryId: category.id,
              name: 'Creamy Truffle Carbonara',
              sellPrice: 48000,
              buyPrice: 22000,
              stock: 40,
              status: 'Aktif'
            },
            {
              tenantId: tenant.id,
              categoryId: category.id,
              name: 'Djoin Crispy Chicken Rice Bowl',
              sellPrice: 38000,
              buyPrice: 16000,
              stock: 60,
              status: 'Aktif'
            }
          ]
        });
      }
    }
  }
  console.log(`✅ Kategori & Produk Menu Djoin Cafe dibuat`);

  // 9. Buat Meja Pelanggan
  const tablesData = ['Meja 01', 'Meja 02', 'Meja 03', 'Meja VIP 01', 'Outdoor 01', 'Outdoor 02'];
  for (const tableNo of tablesData) {
    const existingTable = await prisma.table.findFirst({
      where: { outletId: outlet.id, tableNo }
    });
    if (!existingTable) {
      await prisma.table.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          tableNo,
          capacity: tableNo.includes('VIP') ? 8 : 4,
          status: 'Available'
        }
      });
    }
  }
  console.log(`✅ Meja Djoin Cafe dibuat: ${tablesData.join(', ')}`);

  // 10. Buat Pelanggan CRM Pertama
  const existingCustomer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, phone: '081299887766' }
  });
  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Budi Santoso',
        phone: '081299887766',
        email: 'budi@djoincafe.com',
        tier: 'Silver',
        points: 250,
        totalSpent: 450000
      }
    });
    console.log(`✅ Pelanggan CRM Djoin Cafe dibuat: Budi Santoso`);
  }

  console.log('\n================================================================');
  console.log('🎉 TENANT / KAFE BARU "djoincafe" BERHASIL DIBUAT LENGKAP!');
  console.log('================================================================');
  console.log('Nama Usaha     : Djoin Cafe & Roastery');
  console.log('Slug Subdomain : djoincafe (djoincafe.codenusa.id)');
  console.log('Akun Login     : Username: djoincafe | Password: djoin123 | PIN: 123456');
  console.log('Paket SaaS     : Growth Plan (Aktif 30 Hari)');
  console.log('================================================================\n');
}

createDjoinCafeTenant()
  .catch(e => {
    console.error('❌ Error saat membuat tenant:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
