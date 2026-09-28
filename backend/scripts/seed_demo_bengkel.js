/**
 * Seed Script: Create Demo Bengkel Tenant
 * Tenant ID: bengkel-jaya-motor
 * Akun Login:
 *   - Owner: owner_bengkel (PIN: 123456 / Password: admin)
 *   - Kasir: kasir_bengkel (PIN: 112233 / Password: kasir)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedBengkelTenant() {
  console.log('🚀 Menyiapkan Tenant Bengkel Demo: Bengkel Jaya Motor...');

  const tenantId = 'bengkel-jaya-motor';
  const tenantSlug = 'bengkel-jaya';
  const tenantName = 'Bengkel Jaya Motor Service';

  // 1. Create / Upsert Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: tenantName,
      slug: tenantSlug,
      businessType: 'BENGKEL',
      status: 'ACTIVE'
    },
    create: {
      id: tenantId,
      name: tenantName,
      slug: tenantSlug,
      businessType: 'BENGKEL',
      status: 'ACTIVE'
    }
  });

  // 2. Outlet
  let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId,
        code: 'OUT-BENGKEL-01',
        name: 'Bengkel Pusat Jaya Motor',
        address: 'Jl. Otomotif Raya No. 88, Jakarta Selatan',
        phone: '081234567890',
        status: 'ACTIVE'
      }
    });
  }

  // 3. Settings Toko
  await prisma.settings.upsert({
    where: { id: (await prisma.settings.findFirst({ where: { tenantId } }))?.id || 999999 },
    update: {
      storeName: tenantName,
      address: 'Jl. Otomotif Raya No. 88, Jakarta Selatan',
      phone: '081234567890',
      receiptHeader: `${tenantName}\nJl. Otomotif Raya No. 88, Jakarta Selatan`,
      receiptFooter: 'GARANSI SERVIS 7 HARI KERJA\nBawa struk & suku cadang bekas jika klaim.',
      taxRate: 0,
      serviceCharge: 0
    },
    create: {
      tenantId,
      storeName: tenantName,
      address: 'Jl. Otomotif Raya No. 88, Jakarta Selatan',
      phone: '081234567890',
      receiptHeader: `${tenantName}\nJl. Otomotif Raya No. 88, Jakarta Selatan`,
      receiptFooter: 'GARANSI SERVIS 7 HARI KERJA\nBawa struk & suku cadang bekas jika klaim.',
      taxRate: 0,
      serviceCharge: 0
    }
  });

  // 4. Users (Owner, Kasir, Mekanik)
  const passwordHashAdmin = await bcrypt.hash('admin', 10);
  const passwordHashKasir = await bcrypt.hash('kasir', 10);
  const passwordHashMekanik = await bcrypt.hash('mekanik', 10);

  // Owner
  const ownerUser = await prisma.user.upsert({
    where: { username: 'owner_bengkel' },
    update: {
      name: 'Budi Santoso (Owner)',
      role: 'Admin',
      pin: '123456',
      passwordHash: passwordHashAdmin,
      permissions: '{}',
      status: 'Aktif'
    },
    create: {
      name: 'Budi Santoso (Owner)',
      username: 'owner_bengkel',
      role: 'Admin',
      pin: '123456',
      passwordHash: passwordHashAdmin,
      permissions: '{}',
      status: 'Aktif'
    }
  });

  // Kasir
  const kasirUser = await prisma.user.upsert({
    where: { username: 'kasir_bengkel' },
    update: {
      name: 'Siti Rahma (Kasir)',
      role: 'Cashier',
      pin: '112233',
      passwordHash: passwordHashKasir,
      permissions: '{}',
      status: 'Aktif'
    },
    create: {
      name: 'Siti Rahma (Kasir)',
      username: 'kasir_bengkel',
      role: 'Cashier',
      pin: '112233',
      passwordHash: passwordHashKasir,
      permissions: '{}',
      status: 'Aktif'
    }
  });

  // Mekanik 1
  const mekanik1 = await prisma.user.upsert({
    where: { username: 'agus_mekanik' },
    update: {
      name: 'Agus Montir',
      role: 'Staff',
      pin: '223344',
      passwordHash: passwordHashMekanik,
      permissions: '{}',
      status: 'Aktif'
    },
    create: {
      name: 'Agus Montir',
      username: 'agus_mekanik',
      role: 'Staff',
      pin: '223344',
      passwordHash: passwordHashMekanik,
      permissions: '{}',
      status: 'Aktif'
    }
  });

  // Mekanik 2
  const mekanik2 = await prisma.user.upsert({
    where: { username: 'rudi_mekanik' },
    update: {
      name: 'Rudi Teknisi',
      role: 'Staff',
      pin: '334455',
      passwordHash: passwordHashMekanik,
      permissions: '{}',
      status: 'Aktif'
    },
    create: {
      name: 'Rudi Teknisi',
      username: 'rudi_mekanik',
      role: 'Staff',
      pin: '334455',
      passwordHash: passwordHashMekanik,
      permissions: '{}',
      status: 'Aktif'
    }
  });

  // Link Memberships
  for (const u of [
    { user: ownerUser, role: 'OWNER' },
    { user: kasirUser, role: 'CASHIER' },
    { user: mekanik1, role: 'STAFF' },
    { user: mekanik2, role: 'STAFF' }
  ]) {
    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: u.user.id,
          tenantId
        }
      },
      update: { status: 'ACTIVE' },
      create: {
        userId: u.user.id,
        tenantId,
        status: 'ACTIVE'
      }
    });
  }

  // Mechanic Profiles (Komisi)
  await prisma.mechanicProfile.upsert({
    where: { userId: mekanik1.id },
    update: { tenantId, commissionType: 'PERCENT', commissionRate: 20 },
    create: { userId: mekanik1.id, tenantId, commissionType: 'PERCENT', commissionRate: 20, pendingCommission: 45000 }
  });

  await prisma.mechanicProfile.upsert({
    where: { userId: mekanik2.id },
    update: { tenantId, commissionType: 'PERCENT', commissionRate: 25 },
    create: { userId: mekanik2.id, tenantId, commissionType: 'PERCENT', commissionRate: 25, pendingCommission: 62500 }
  });

  // 5. Kategori Suku Cadang & Oli
  const catNames = ['Oli & Pelumas', 'Fast Moving Sparepart', 'Ban & Velg', 'Kelistrikan & Aki'];
  const catMap = {};
  for (const cName of catNames) {
    let cat = await prisma.category.findFirst({ where: { tenantId, name: cName } });
    if (!cat) {
      cat = await prisma.category.create({ data: { tenantId, name: cName } });
    }
    catMap[cName] = cat.id;
  }

  // 6. Produk Sparepart dengan 3-Tier Price
  const sampleParts = [
    {
      name: 'Oli Yamalube Silver 0.8L',
      cat: 'Oli & Pelumas',
      buy: 38000,
      retail: 50000,
      mitra: 45000,
      grosir: 42000,
      minGrosir: 6,
      stock: 25,
      minStock: 5
    },
    {
      name: 'Oli Honda MPX2 Matic 0.8L',
      cat: 'Oli & Pelumas',
      buy: 40000,
      retail: 55000,
      mitra: 48000,
      grosir: 45000,
      minGrosir: 6,
      stock: 30,
      minStock: 6
    },
    {
      name: 'Kampas Rem Depan Beat / Vario',
      cat: 'Fast Moving Sparepart',
      buy: 25000,
      retail: 45000,
      mitra: 38000,
      grosir: 33000,
      minGrosir: 5,
      stock: 18,
      minStock: 4
    },
    {
      name: 'Kampas Rem Belakang Tromol Honda',
      cat: 'Fast Moving Sparepart',
      buy: 28000,
      retail: 48000,
      mitra: 40000,
      grosir: 35000,
      minGrosir: 5,
      stock: 12,
      minStock: 4
    },
    {
      name: 'Busi NGK CPR9EA-9 Standar',
      cat: 'Fast Moving Sparepart',
      buy: 14000,
      retail: 25000,
      mitra: 20000,
      grosir: 17000,
      minGrosir: 10,
      stock: 35,
      minStock: 5
    },
    {
      name: 'Vanbelt Kit Beat FI Original',
      cat: 'Fast Moving Sparepart',
      buy: 95000,
      retail: 145000,
      mitra: 130000,
      grosir: 120000,
      minGrosir: 3,
      stock: 8,
      minStock: 3
    },
    {
      name: 'Ban Luar Tubeless FDR 90/90-14',
      cat: 'Ban & Velg',
      buy: 165000,
      retail: 235000,
      mitra: 210000,
      grosir: 195000,
      minGrosir: 4,
      stock: 6,
      minStock: 2
    },
    {
      name: 'Aki GS Astra GTZ5S Kering',
      cat: 'Kelistrikan & Aki',
      buy: 190000,
      retail: 265000,
      mitra: 240000,
      grosir: 225000,
      minGrosir: 2,
      stock: 5,
      minStock: 2
    }
  ];

  for (const p of sampleParts) {
    let existing = await prisma.product.findFirst({ where: { tenantId, name: p.name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId,
          name: p.name,
          categoryId: catMap[p.cat],
          buyPrice: p.buy,
          sellPrice: p.retail,
          sellPriceRetail: p.retail,
          sellPriceMitra: p.mitra,
          sellPriceGrosir: p.grosir,
          minQtyGrosir: p.minGrosir,
          stock: p.stock,
          minStock: p.minStock
        }
      });
    }
  }

  // 7. Master Jasa Servis (ServiceType)
  const defaultServices = [
    {
      name: 'Servis Ringan / Tune Up Motor',
      vehicleType: 'MOTOR',
      priceRetail: 50000,
      priceMitra: 45000,
      priceGrosir: 40000
    },
    {
      name: 'Jasa Ganti Oli Mesin',
      vehicleType: 'MOTOR',
      priceRetail: 15000,
      priceMitra: 10000,
      priceGrosir: 10000
    },
    {
      name: 'Servis CVT Lengkap & Pembersihan',
      vehicleType: 'MOTOR',
      priceRetail: 65000,
      priceMitra: 55000,
      priceGrosir: 50000
    },
    {
      name: 'Ganti Kampas Rem Depan / Belakang',
      vehicleType: 'MOTOR',
      priceRetail: 20000,
      priceMitra: 15000,
      priceGrosir: 15000
    },
    {
      name: 'Tune Up & Gurah Mesin Mobil',
      vehicleType: 'MOBIL',
      priceRetail: 250000,
      priceMitra: 220000,
      priceGrosir: 200000
    },
    {
      name: 'Ganti Oli & Filter Mesin Mobil',
      vehicleType: 'MOBIL',
      priceRetail: 50000,
      priceMitra: 40000,
      priceGrosir: 40000
    }
  ];

  for (const s of defaultServices) {
    let existing = await prisma.serviceType.findFirst({ where: { tenantId, name: s.name } });
    if (!existing) {
      await prisma.serviceType.create({
        data: {
          tenantId,
          name: s.name,
          vehicleType: s.vehicleType,
          priceRetail: s.priceRetail,
          priceMitra: s.priceMitra,
          priceGrosir: s.priceGrosir
        }
      });
    }
  }

  // 8. Pelanggan & Kendaraan Demo
  let cust1 = await prisma.customer.findFirst({ where: { tenantId, name: 'Pak Hendra (Mitra Grab)' } });
  if (!cust1) {
    cust1 = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Pak Hendra (Mitra Grab)',
        phone: '081298765432',
        priceTier: 'MITRA'
      }
    });
  }

  let cust2 = await prisma.customer.findFirst({ where: { tenantId, name: 'Ibu Susi Susanti' } });
  if (!cust2) {
    cust2 = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Ibu Susi Susanti',
        phone: '085712345678',
        priceTier: 'UMUM'
      }
    });
  }

  // Kendaraan
  let veh1 = await prisma.vehicle.findFirst({ where: { tenantId, plateNumber: 'B 3456 SAA' } });
  if (!veh1) {
    veh1 = await prisma.vehicle.create({
      data: {
        tenantId,
        customerId: cust1.id,
        plateNumber: 'B 3456 SAA',
        brand: 'Honda',
        model: 'Beat FI',
        vehicleType: 'MOTOR',
        color: 'Hitam',
        year: 2021
      }
    });
  }

  let veh2 = await prisma.vehicle.findFirst({ where: { tenantId, plateNumber: 'B 6789 KLS' } });
  if (!veh2) {
    veh2 = await prisma.vehicle.create({
      data: {
        tenantId,
        customerId: cust2.id,
        plateNumber: 'B 6789 KLS',
        brand: 'Yamaha',
        model: 'NMAX 155',
        vehicleType: 'MOTOR',
        color: 'Putih Metalik',
        year: 2022
      }
    });
  }

  // 9. Sample Active SPK
  let spk1 = await prisma.workOrder.findFirst({ where: { tenantId, spkNumber: 'SPK-202609-0001' } });
  if (!spk1) {
    spk1 = await prisma.workOrder.create({
      data: {
        tenantId,
        outletId: outlet.id,
        spkNumber: 'SPK-202609-0001',
        customerId: cust1.id,
        vehicleId: veh1.id,
        vehiclePlate: veh1.plateNumber,
        vehicleBrand: veh1.brand,
        vehicleModel: veh1.model,
        vehicleType: 'MOTOR',
        odometer: 24500,
        fuelLevel: '1/2',
        complaint: 'Tarikan gredek saat akselerasi awal & rem depan kurang pakem',
        diagnosis: 'CVT kotor & roller aus, kampas rem depan tipis',
        status: 'IN_PROGRESS',
        priceTier: 'MITRA',
        mechanicId: mekanik1.id,
        mechanicName: mekanik1.name,
        totalServices: 55000,
        totalParts: 86000,
        discount: 0,
        totalAmount: 141000,
        paidAmount: 0
      }
    });
  }

  let spk2 = await prisma.workOrder.findFirst({ where: { tenantId, spkNumber: 'SPK-202609-0002' } });
  if (!spk2) {
    spk2 = await prisma.workOrder.create({
      data: {
        tenantId,
        outletId: outlet.id,
        spkNumber: 'SPK-202609-0002',
        customerId: cust2.id,
        vehicleId: veh2.id,
        vehiclePlate: veh2.plateNumber,
        vehicleBrand: veh2.brand,
        vehicleModel: veh2.model,
        vehicleType: 'MOTOR',
        odometer: 18200,
        fuelLevel: '3/4',
        complaint: 'Ganti oli rutin & servis ringan berkala',
        diagnosis: 'Kondisi mesin bagus, oli sudah hitam',
        status: 'DONE',
        priceTier: 'UMUM',
        mechanicId: mekanik2.id,
        mechanicName: mekanik2.name,
        totalServices: 65000,
        totalParts: 55000,
        discount: 0,
        totalAmount: 120000,
        paidAmount: 0
      }
    });
  }

  console.log('\n================================================================');
  console.log('✅ SEED TENANT BENGKEL BERHASIL DIBUAT!');
  console.log('================================================================');
  console.log('🏢 Tenant ID   : ' + tenantId);
  console.log('🏷️  Slug        : ' + tenantSlug);
  console.log('⚙️  Vertical    : BENGKEL');
  console.log('----------------------------------------------------------------');
  console.log('👤 Akun OWNER:');
  console.log('   Username    : owner_bengkel');
  console.log('   Password    : admin');
  console.log('   PIN         : 123456');
  console.log('----------------------------------------------------------------');
  console.log('👤 Akun KASIR:');
  console.log('   Username    : kasir_bengkel');
  console.log('   Password    : kasir');
  console.log('   PIN         : 112233');
  console.log('----------------------------------------------------------------');
  console.log('🔧 Mekanik Terdaftar:');
  console.log('   1. Agus Montir  (Komisi: 20%) - user: agus_mekanik / PIN: 223344');
  console.log('   2. Rudi Teknisi (Komisi: 25%) - user: rudi_mekanik / PIN: 334455');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

seedBengkelTenant().catch(err => {
  console.error('Gagal seed tenant bengkel:', err);
  process.exit(1);
});
