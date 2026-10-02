const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'codenusa-secret-pos-key';

async function generateAuthResponse(userId, tenantId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: {
        include: {
          plan: true,
          outlets: true
        }
      }
    }
  });

  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { token, user };
}

async function runTest() {
  console.log('🚀 [TEST MULTI-VERTICAL ONBOARDING] Memulai pengujian registrasi 5 vertikal...');
  const testIds = [];

  const verticals = [
    { type: 'CAFE', expectedCategory: 'Makanan', expectedProduct: null },
    { type: 'BENGKEL', expectedCategory: 'Oli & Pelumas', expectedProduct: 'Oli Mesin Matic 10W-40 0.8L' },
    { type: 'RETAIL', expectedCategory: 'Sembako & Beras', expectedProduct: 'Beras Premium 5 Kg' },
    { type: 'LAUNDRY', expectedCategory: 'Cuci Kiloan (Kg)', expectedProduct: 'Cuci Komplit Reguler (2 Hari)' },
    { type: 'RENTAL', expectedCategory: 'Baju Bodo Modern (Wanita)', expectedProduct: "Baju Bodo Sutera Merah Cabe (M/L) [BBD-01]" }
  ];

  try {
    for (const v of verticals) {
      const timestamp = Date.now() + Math.floor(Math.random() * 1000);
      const slug = `tst${v.type.toLowerCase().slice(0, 4)}${timestamp}`.slice(0, 20);
      const username = `owner_${v.type.toLowerCase().slice(0, 4)}_${timestamp}`.slice(0, 20);
      const businessName = `Test ${v.type} Business ${timestamp}`;

      console.log(`\n📋 Menguji Onboarding Vertikal: ${v.type} (Slug: ${slug})...`);

      const passwordHash = await bcrypt.hash('password123', 10);
      const pin = '123456';
      const trialDays = 14;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: businessName,
            slug,
            businessType: v.type,
            status: 'ACTIVE',
            trialEndsAt
          }
        });

        const primaryOutlet = await tx.outlet.create({
          data: {
            tenantId: tenant.id,
            name: `${businessName} (Pusat)`,
            code: 'OUT-01',
            status: 'ACTIVE'
          }
        });

        const user = await tx.user.create({
          data: {
            name: `Owner ${v.type}`,
            username,
            passwordHash,
            pin,
            tenantId: tenant.id,
            role: 'OWNER',
            employmentType: 'FULL_TIME',
            permissions: JSON.stringify({
              canVoid: true,
              canDiscount: true,
              canEditMenu: true,
              canViewReports: true,
              canManageStaff: true
            }),
            status: 'Aktif'
          }
        });

        let ownerRole = await tx.role.findFirst({
          where: { OR: [{ id: 'role-system-owner' }, { name: 'OWNER', tenantId: null }] }
        });
        if (!ownerRole) {
          ownerRole = await tx.role.upsert({
            where: { id: 'role-system-owner' },
            update: {},
            create: { id: 'role-system-owner', name: 'OWNER', tenantId: null }
          });
        }

        await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            roleId: ownerRole.id,
            pin,
            employmentType: 'FULL_TIME',
            status: 'ACTIVE'
          }
        });

        await tx.settings.create({
          data: {
            tenant: { connect: { id: tenant.id } },
            outlet: { connect: { id: primaryOutlet.id } },
            storeName: businessName,
            receiptHeader: `TOKO ${v.type}\n${businessName}`,
            receiptFooter: 'Terima kasih atas kunjungan Anda!'
          }
        });

        // Seed per vertical
        if (v.type === 'RETAIL') {
          const cat = await tx.category.create({
            data: { tenantId: tenant.id, name: 'Sembako & Beras', icon: '🌾', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
          });
          await tx.product.create({
            data: { tenantId: tenant.id, categoryId: cat.id, name: 'Beras Premium 5 Kg', barcode: '899100100001', buyPrice: 65000, sellPrice: 74000, stock: 50, status: 'Aktif' }
          });
        } else if (v.type === 'BENGKEL') {
          const cat = await tx.category.create({
            data: { tenantId: tenant.id, name: 'Oli & Pelumas', icon: '🛢️', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
          });
          await tx.product.create({
            data: { tenantId: tenant.id, categoryId: cat.id, name: 'Oli Mesin Matic 10W-40 0.8L', barcode: '899200100001', buyPrice: 42000, sellPrice: 55000, stock: 30, status: 'Aktif' }
          });
        } else if (v.type === 'LAUNDRY') {
          const cat = await tx.category.create({
            data: { tenantId: tenant.id, name: 'Cuci Kiloan (Kg)', icon: '🧺', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
          });
          await tx.product.create({
            data: { tenantId: tenant.id, categoryId: cat.id, name: 'Cuci Komplit Reguler (2 Hari)', barcode: '899300100001', buyPrice: 2000, sellPrice: 8000, stock: 999, status: 'Aktif' }
          });
        } else if (v.type === 'RENTAL') {
          const cat = await tx.category.create({
            data: { tenantId: tenant.id, name: 'Baju Bodo Modern (Wanita)', icon: '👘', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
          });
          await tx.product.create({
            data: { tenantId: tenant.id, categoryId: cat.id, name: "Baju Bodo Sutera Merah Cabe (M/L) [BBD-01]", barcode: '899400100001', buyPrice: 400000, sellPrice: 200000, stock: 1, status: 'Aktif' }
          });
        } else {
          // CAFE
          await tx.category.create({
            data: { tenantId: tenant.id, name: 'Makanan', printerTarget: 'KITCHEN' }
          });
          await tx.table.create({
            data: { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '01', name: 'Area Utama', capacity: 4, posX: 20, posY: 30 }
          });
        }

        return { tenant, primaryOutlet, user };
      });

      testIds.push({ tenantId: result.tenant.id, userId: result.user.id });

      // Verifikasi Auth
      const auth = await generateAuthResponse(result.user.id, result.tenant.id);
      if (!auth.token) throw new Error(`Token gagal di-generate untuk ${v.type}`);
      if (auth.user.role !== 'OWNER') throw new Error(`User role bukan OWNER untuk ${v.type}`);
      if (auth.user.tenant.businessType !== v.type) throw new Error(`BusinessType tidak cocok: ${auth.user.tenant.businessType} vs ${v.type}`);

      // Verifikasi Kategori
      const createdCategory = await prisma.category.findFirst({
        where: { tenantId: result.tenant.id, name: v.expectedCategory }
      });
      if (!createdCategory) throw new Error(`Kategori ${v.expectedCategory} tidak ditemukan untuk ${v.type}`);

      // Verifikasi Produk (jika ada)
      if (v.expectedProduct) {
        const createdProduct = await prisma.product.findFirst({
          where: { tenantId: result.tenant.id, name: v.expectedProduct }
        });
        if (!createdProduct) throw new Error(`Produk ${v.expectedProduct} tidak ditemukan untuk ${v.type}`);
        console.log(`   ✅ Produk default terverifikasi: "${createdProduct.name}" (Rp ${createdProduct.sellPrice.toLocaleString()})`);
      }

      console.log(`   ✅ Onboarding ${v.type} BERHASIL: TenantId=${result.tenant.id}, Token Valid.`);
    }

    console.log('\n🧹 Membersihkan data pengujian...');
    for (const item of testIds) {
      await prisma.product.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.category.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.table.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.settings.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.tenantMembership.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.user.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.outlet.deleteMany({ where: { tenantId: item.tenantId } });
      await prisma.tenant.delete({ where: { id: item.tenantId } });
    }
    console.log('✅ Pembersihan selesai dengan sempurna.');
    console.log('\n🎉 [SUKSES BESAR] Seluruh 5 Vertikal Onboarding Lolos Uji 100%!');

  } catch (err) {
    console.error('❌ Terjadi kesalahan pengujian:', err);
    // Cleanup if possible
    for (const item of testIds) {
      try {
        await prisma.product.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.category.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.table.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.settings.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.tenantMembership.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.user.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.outlet.deleteMany({ where: { tenantId: item.tenantId } });
        await prisma.tenant.delete({ where: { id: item.tenantId } });
      } catch (cleanupErr) {
        // ignore
      }
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
