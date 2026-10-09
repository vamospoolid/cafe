/**
 * Seed Script: Comprehensive Spareparts, Services, and Mechanics
 * Target Tenant: usahabersama (tenantId: e71b00bd-bcd1-4565-ad89-ec5fd9a98977 or slug: usahabersama)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Memulai Seed Data Bengkel untuk Tenant: USAHABERSAMA...');

  // 1. Cari Tenant usahabersama
  let tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: 'usahabersama' },
        { name: 'usahabersama' },
        { id: 'e71b00bd-bcd1-4565-ad89-ec5fd9a98977' }
      ]
    }
  });

  if (!tenant) {
    console.log('Tenant usahabersama belum ditemukan, membuat tenant baru...');
    tenant = await prisma.tenant.create({
      data: {
        id: 'e71b00bd-bcd1-4565-ad89-ec5fd9a98977',
        name: 'usahabersama',
        slug: 'usahabersama',
        businessType: 'BENGKEL',
        status: 'ACTIVE'
      }
    });
  }

  const tenantId = tenant.id;
  console.log(`✅ Tenant ID: ${tenantId} (${tenant.name}) [Vertical: ${tenant.businessType}]`);

  // Pastikan Outlet tersedia
  let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId,
        code: 'OUT-01',
        name: 'Bengkel Usaha Bersama (Pusat)',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Outlet dibuat: ${outlet.name}`);
  }

  // 2. Setup Kategori Suku Cadang & Pelumas
  console.log('\n📦 [1/4] Menyiapkan Kategori Suku Cadang...');
  const categoryDefs = [
    { name: 'Oli & Pelumas', icon: '🛢️', sortOrder: 1 },
    { name: 'Sparepart & Suku Cadang', icon: '⚙️', sortOrder: 2 },
    { name: 'Ban & Roda', icon: '🛞', sortOrder: 3 },
    { name: 'Kelistrikan & Aki', icon: '🔋', sortOrder: 4 },
    { name: 'Cairan & Kimia Perawatan', icon: '🧪', sortOrder: 5 }
  ];

  const catMap = {};
  for (const c of categoryDefs) {
    let cat = await prisma.category.findFirst({
      where: { tenantId, name: c.name, deletedAt: null }
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          tenantId,
          name: c.name,
          icon: c.icon,
          sortOrder: c.sortOrder,
          printerTarget: 'NONE',
          stationTarget: 'NONE',
          isActive: true
        }
      });
      console.log(`   + Kategori baru: ${cat.name}`);
    } else {
      cat = await prisma.category.update({
        where: { id: cat.id },
        data: { icon: c.icon, sortOrder: c.sortOrder }
      });
    }
    catMap[c.name] = cat.id;
  }

  // 3. Setup Sparepart (Products) dengan 3-Tier Pricing Realistis
  console.log('\n🔩 [2/4] Menyiapkan Katalog Sparepart (Produk)...');
  const spareparts = [
    // Oli & Pelumas
    {
      name: 'Oli Honda MPX2 Matic 0.8L',
      category: 'Oli & Pelumas',
      barcode: '899200100010',
      brand: 'AHM Honda',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-OLI-01',
      buyPrice: 42000,
      sellPriceRetail: 55000,
      sellPriceMitra: 50000,
      sellPriceGrosir: 46000,
      minQtyGrosir: 6,
      stock: 35,
      minStock: 6
    },
    {
      name: 'Oli Honda SPX2 Full Synthetic 0.8L',
      category: 'Oli & Pelumas',
      barcode: '899200100011',
      brand: 'AHM Honda',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-OLI-01',
      buyPrice: 54000,
      sellPriceRetail: 68000,
      sellPriceMitra: 62000,
      sellPriceGrosir: 58000,
      minQtyGrosir: 6,
      stock: 20,
      minStock: 4
    },
    {
      name: 'Oli Yamalube Silver 0.8L Bebek',
      category: 'Oli & Pelumas',
      barcode: '899200100012',
      brand: 'Yamalube',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-OLI-02',
      buyPrice: 38000,
      sellPriceRetail: 50000,
      sellPriceMitra: 45000,
      sellPriceGrosir: 42000,
      minQtyGrosir: 6,
      stock: 18,
      minStock: 4
    },
    {
      name: 'Oli Yamalube Matic 0.8L',
      category: 'Oli & Pelumas',
      barcode: '899200100013',
      brand: 'Yamalube',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-OLI-02',
      buyPrice: 41000,
      sellPriceRetail: 54000,
      sellPriceMitra: 48000,
      sellPriceGrosir: 45000,
      minQtyGrosir: 6,
      stock: 24,
      minStock: 5
    },
    {
      name: 'Oli Transmisi Gardan Matic 120ml',
      category: 'Oli & Pelumas',
      barcode: '899200100014',
      brand: 'Federal / AHM',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-OLI-03',
      buyPrice: 12000,
      sellPriceRetail: 18000,
      sellPriceMitra: 15000,
      sellPriceGrosir: 14000,
      minQtyGrosir: 10,
      stock: 50,
      minStock: 10
    },
    {
      name: 'Oli Shell Helix HX6 10W-40 4L (Mobil)',
      category: 'Oli & Pelumas',
      barcode: '899200100015',
      brand: 'Shell',
      vehicleType: 'MOBIL',
      storageLocation: 'GUDANG-MOBIL',
      buyPrice: 285000,
      sellPriceRetail: 360000,
      sellPriceMitra: 330000,
      sellPriceGrosir: 310000,
      minQtyGrosir: 2,
      stock: 6,
      minStock: 2
    },

    // Sparepart & Suku Cadang
    {
      name: 'Kampas Rem Belakang Tromol Beat/Vario',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100016',
      brand: 'Federal',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-REM-01',
      buyPrice: 22000,
      sellPriceRetail: 38000,
      sellPriceMitra: 32000,
      sellPriceGrosir: 28000,
      minQtyGrosir: 5,
      stock: 25,
      minStock: 5
    },
    {
      name: 'Dispad Rem Depan NMAX / Aerox 155',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100017',
      brand: 'Yamaha Genuine',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-REM-02',
      buyPrice: 35000,
      sellPriceRetail: 55000,
      sellPriceMitra: 48000,
      sellPriceGrosir: 42000,
      minQtyGrosir: 5,
      stock: 16,
      minStock: 3
    },
    {
      name: 'Busi Denso U20EPR9 (Supra/Revo/Karisma)',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100018',
      brand: 'Denso',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-BUSI-01',
      buyPrice: 15000,
      sellPriceRetail: 22000,
      sellPriceMitra: 19000,
      sellPriceGrosir: 17000,
      minQtyGrosir: 10,
      stock: 30,
      minStock: 5
    },
    {
      name: 'V-Belt Kit + Roller Beat FI ESP K44',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100019',
      brand: 'AHM Honda',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-CVT-01',
      buyPrice: 105000,
      sellPriceRetail: 155000,
      sellPriceMitra: 140000,
      sellPriceGrosir: 130000,
      minQtyGrosir: 3,
      stock: 10,
      minStock: 2
    },
    {
      name: 'V-Belt Kit + Roller Vario 125/150 K36',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100020',
      brand: 'AHM Honda',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-CVT-01',
      buyPrice: 115000,
      sellPriceRetail: 170000,
      sellPriceMitra: 155000,
      sellPriceGrosir: 142000,
      minQtyGrosir: 3,
      stock: 8,
      minStock: 2
    },
    {
      name: 'Filter Udara Beat / Scoopy FI K16',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100021',
      brand: 'AHM Honda',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-FILTER-01',
      buyPrice: 32000,
      sellPriceRetail: 48000,
      sellPriceMitra: 42000,
      sellPriceGrosir: 38000,
      minQtyGrosir: 5,
      stock: 15,
      minStock: 3
    },
    {
      name: 'Paket Rantai & Gir Supra X 125 Heavy Duty',
      category: 'Sparepart & Suku Cadang',
      barcode: '899200100022',
      brand: 'Federal',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-GIR-01',
      buyPrice: 125000,
      sellPriceRetail: 185000,
      sellPriceMitra: 165000,
      sellPriceGrosir: 150000,
      minQtyGrosir: 2,
      stock: 7,
      minStock: 2
    },

    // Ban & Roda
    {
      name: 'Ban Luar FDR Flemino Tubeless 80/90-14 Depan',
      category: 'Ban & Roda',
      barcode: '899200100023',
      brand: 'FDR',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-BAN-01',
      buyPrice: 155000,
      sellPriceRetail: 215000,
      sellPriceMitra: 195000,
      sellPriceGrosir: 180000,
      minQtyGrosir: 2,
      stock: 8,
      minStock: 2
    },
    {
      name: 'Ban Luar FDR Flemino Tubeless 90/90-14 Belakang',
      category: 'Ban & Roda',
      barcode: '899200100024',
      brand: 'FDR',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-BAN-01',
      buyPrice: 180000,
      sellPriceRetail: 245000,
      sellPriceMitra: 220000,
      sellPriceGrosir: 205000,
      minQtyGrosir: 2,
      stock: 8,
      minStock: 2
    },
    {
      name: 'Ban Dalam IRC 2.50/2.75-17 (Bebek)',
      category: 'Ban & Roda',
      barcode: '899200100025',
      brand: 'IRC',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-BAN-02',
      buyPrice: 28000,
      sellPriceRetail: 42000,
      sellPriceMitra: 36000,
      sellPriceGrosir: 32000,
      minQtyGrosir: 5,
      stock: 22,
      minStock: 5
    },
    {
      name: 'Pentil Tubeless Besi Chrome (Set 2 pcs)',
      category: 'Ban & Roda',
      barcode: '899200100026',
      brand: 'OEM',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-BAN-02',
      buyPrice: 10000,
      sellPriceRetail: 20000,
      sellPriceMitra: 16000,
      sellPriceGrosir: 13000,
      minQtyGrosir: 10,
      stock: 30,
      minStock: 5
    },

    // Kelistrikan & Aki
    {
      name: 'Aki Kering GS Astra GTZ5S (Beat/Vario/Mio)',
      category: 'Kelistrikan & Aki',
      barcode: '899200100027',
      brand: 'GS Astra',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-AKI-01',
      buyPrice: 185000,
      sellPriceRetail: 260000,
      sellPriceMitra: 235000,
      sellPriceGrosir: 220000,
      minQtyGrosir: 2,
      stock: 8,
      minStock: 2
    },
    {
      name: 'Aki Kering Yuasa YTZ6V (Vario 150/NMAX/PCX)',
      category: 'Kelistrikan & Aki',
      barcode: '899200100028',
      brand: 'Yuasa',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-AKI-01',
      buyPrice: 245000,
      sellPriceRetail: 335000,
      sellPriceMitra: 305000,
      sellPriceGrosir: 285000,
      minQtyGrosir: 2,
      stock: 6,
      minStock: 2
    },
    {
      name: 'Bohlam Lampu Depan Halogen Osram 12V 35/35W',
      category: 'Kelistrikan & Aki',
      barcode: '899200100029',
      brand: 'Osram',
      vehicleType: 'MOTOR',
      storageLocation: 'RAK-LISTRIK-01',
      buyPrice: 18000,
      sellPriceRetail: 30000,
      sellPriceMitra: 25000,
      sellPriceGrosir: 22000,
      minQtyGrosir: 10,
      stock: 25,
      minStock: 5
    },

    // Cairan & Kimia Perawatan
    {
      name: 'Cairan Radiator Coolant Prestone 1 Liter',
      category: 'Cairan & Kimia Perawatan',
      barcode: '899200100031',
      brand: 'Prestone',
      vehicleType: 'UMUM',
      storageLocation: 'RAK-CHEM-01',
      buyPrice: 28000,
      sellPriceRetail: 45000,
      sellPriceMitra: 38000,
      sellPriceGrosir: 34000,
      minQtyGrosir: 6,
      stock: 20,
      minStock: 4
    },
    {
      name: 'Carb & Choke Cleaner Megacools 500ml',
      category: 'Cairan & Kimia Perawatan',
      barcode: '899200100032',
      brand: 'Megacools',
      vehicleType: 'UMUM',
      storageLocation: 'RAK-CHEM-01',
      buyPrice: 26000,
      sellPriceRetail: 40000,
      sellPriceMitra: 34000,
      sellPriceGrosir: 30000,
      minQtyGrosir: 6,
      stock: 18,
      minStock: 4
    },
    {
      name: 'Minyak Rem Jumbo DOT 3 300ml Merah',
      category: 'Cairan & Kimia Perawatan',
      barcode: '899200100033',
      brand: 'Jumbo',
      vehicleType: 'UMUM',
      storageLocation: 'RAK-CHEM-01',
      buyPrice: 16000,
      sellPriceRetail: 25000,
      sellPriceMitra: 21000,
      sellPriceGrosir: 19000,
      minQtyGrosir: 6,
      stock: 20,
      minStock: 5
    }
  ];

  let partCreated = 0;
  let partUpdated = 0;

  for (const p of spareparts) {
    const catId = catMap[p.category];
    const existing = await prisma.product.findFirst({
      where: {
        tenantId,
        OR: [
          { barcode: p.barcode },
          { name: p.name }
        ]
      }
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          barcode: p.barcode,
          categoryId: catId,
          brand: p.brand,
          vehicleType: p.vehicleType,
          storageLocation: p.storageLocation,
          buyPrice: p.buyPrice,
          sellPrice: p.sellPriceRetail,
          sellPriceRetail: p.sellPriceRetail,
          sellPriceMitra: p.sellPriceMitra,
          sellPriceGrosir: p.sellPriceGrosir,
          minQtyGrosir: p.minQtyGrosir,
          stock: p.stock,
          minStock: p.minStock,
          status: 'Aktif'
        }
      });
      partUpdated++;
    } else {
      await prisma.product.create({
        data: {
          tenantId,
          name: p.name,
          barcode: p.barcode,
          categoryId: catId,
          brand: p.brand,
          vehicleType: p.vehicleType,
          storageLocation: p.storageLocation,
          buyPrice: p.buyPrice,
          sellPrice: p.sellPriceRetail,
          sellPriceRetail: p.sellPriceRetail,
          sellPriceMitra: p.sellPriceMitra,
          sellPriceGrosir: p.sellPriceGrosir,
          minQtyGrosir: p.minQtyGrosir,
          stock: p.stock,
          minStock: p.minStock,
          status: 'Aktif'
        }
      });
      partCreated++;
    }
  }
  console.log(`   + Selesai: ${partCreated} sparepart dibuat, ${partUpdated} diupdate.`);

  // 4. Setup Master Jasa Servis Mekanik (ServiceType)
  console.log('\n🔧 [3/4] Menyiapkan Master Jasa Servis Mekanik (ServiceType)...');
  const serviceDefs = [
    {
      name: 'Jasa Ganti Oli Mesin & Gardan',
      vehicleType: 'MOTOR',
      priceRetail: 15000,
      priceMitra: 10000,
      priceGrosir: 10000,
      description: 'Kuras dan isi oli mesin serta oli gardan transmisi matic/bebek'
    },
    {
      name: 'Servis Ringan / Tune Up Standar Injeksi',
      vehicleType: 'MOTOR',
      priceRetail: 45000,
      priceMitra: 40000,
      priceGrosir: 35000,
      description: 'Pembersihan busi, filter udara, setel rem, cek tekanan ban & pelumasan kabel'
    },
    {
      name: 'Servis CVT Lengkap + Pembersihan Pulley',
      vehicleType: 'MOTOR',
      priceRetail: 65000,
      priceMitra: 55000,
      priceGrosir: 50000,
      description: 'Bongkar blok CVT, cuci mangkok kopling, amplas kampas ganda, beri gemuk CVT hi-temp'
    },
    {
      name: 'Tune Up Injeksi Lengkap + Reset Scanner ECU',
      vehicleType: 'MOTOR',
      priceRetail: 75000,
      priceMitra: 65000,
      priceGrosir: 60000,
      description: 'Infus injector cleaner throttle body, scanner diagnosa error sensor & reset ECU'
    },
    {
      name: 'Jasa Pasang Ban Luar / Tubeless Motor',
      vehicleType: 'MOTOR',
      priceRetail: 20000,
      priceMitra: 15000,
      priceGrosir: 15000,
      description: 'Bongkar pasang ban menggunakan tire changer + pasang pentil baru'
    },
    {
      name: 'Kuras Radiator & Ganti Coolant',
      vehicleType: 'MOTOR',
      priceRetail: 25000,
      priceMitra: 20000,
      priceGrosir: 18000,
      description: 'Kuras total sistem pendingin radiator, bleeding gelembung udara, isi coolant'
    },
    {
      name: 'Jasa Ganti Kampas Rem Depan / Belakang',
      vehicleType: 'MOTOR',
      priceRetail: 20000,
      priceMitra: 15000,
      priceGrosir: 15000,
      description: 'Bongkar kaliper rem, bersihkan pin & piston rem, pasang discpad/kampas tromol'
    },
    {
      name: 'Overhaul / Turun Mesin Sebagian (Skir Klep & Seher)',
      vehicleType: 'MOTOR',
      priceRetail: 250000,
      priceMitra: 220000,
      priceGrosir: 200000,
      description: 'Bongkar cylinder head, skir klep, ganti seal klep, ring piston & paking blok'
    },
    {
      name: 'Jasa Tune Up Mobil Bensin 4 Silinder',
      vehicleType: 'MOBIL',
      priceRetail: 200000,
      priceMitra: 175000,
      priceGrosir: 150000,
      description: 'Pembersihan busi mobil, filter udara, throttle body spray, cek pengisian aki'
    },
    {
      name: 'Jasa Ganti Oli Mesin + Filter Oli Mobil',
      vehicleType: 'MOBIL',
      priceRetail: 50000,
      priceMitra: 40000,
      priceGrosir: 35000,
      description: 'Kuras oli mesin via car lift, penggantian filter oli cartridge & cek pelumasan'
    },
    {
      name: 'Bleeding & Kuras Minyak Rem 4 Roda Mobil',
      vehicleType: 'MOBIL',
      priceRetail: 120000,
      priceMitra: 100000,
      priceGrosir: 90000,
      description: 'Kuras minyak rem sirkuit 4 roda, pembuangan angin sistem ABS, setel rem tangan'
    }
  ];

  let srvCreated = 0;
  let srvUpdated = 0;

  for (const s of serviceDefs) {
    const existing = await prisma.serviceType.findFirst({
      where: { tenantId, name: s.name, deletedAt: null }
    });

    if (existing) {
      await prisma.serviceType.update({
        where: { id: existing.id },
        data: {
          vehicleType: s.vehicleType,
          priceRetail: s.priceRetail,
          priceMitra: s.priceMitra,
          priceGrosir: s.priceGrosir,
          description: s.description,
          isActive: true
        }
      });
      srvUpdated++;
    } else {
      await prisma.serviceType.create({
        data: {
          tenantId,
          name: s.name,
          vehicleType: s.vehicleType,
          priceRetail: s.priceRetail,
          priceMitra: s.priceMitra,
          priceGrosir: s.priceGrosir,
          description: s.description,
          isActive: true
        }
      });
      srvCreated++;
    }
  }
  console.log(`   + Selesai: ${srvCreated} jasa servis dibuat, ${srvUpdated} diupdate.`);

  // 5. Setup Mekanik Tambahan
  console.log('\n👨‍🔧 [4/4] Menyiapkan Staf Mekanik untuk Tenant...');
  const passwordHash = await bcrypt.hash('123456', 10);
  const mechanicDefs = [
    { username: 'budi_mekanik', name: 'Budi Teknisi', pin: '223311', commissionRate: 0.25 },
    { username: 'dani_mekanik', name: 'Dani Montir', pin: '334422', commissionRate: 0.15 }
  ];

  for (const m of mechanicDefs) {
    let u = await prisma.user.findFirst({ where: { username: m.username } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          name: m.name,
          username: m.username,
          role: 'Staff',
          pin: m.pin,
          passwordHash,
          permissions: '{"bengkel":true}',
          status: 'Aktif'
        }
      });
      console.log(`   + User mekanik baru: ${u.name} (${u.username})`);
    } else {
      await prisma.user.update({
        where: { id: u.id },
        data: { name: m.name, pin: m.pin, status: 'Aktif' }
      });
    }

    // Link Membership
    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: u.id,
          tenantId
        }
      },
      update: { status: 'ACTIVE' },
      create: {
        userId: u.id,
        tenantId,
        status: 'ACTIVE'
      }
    });

    // Profile Mekanik
    await prisma.mechanicProfile.upsert({
      where: { userId: u.id },
      update: {
        tenantId,
        commissionType: 'PERCENT',
        commissionRate: m.commissionRate
      },
      create: {
        userId: u.id,
        tenantId,
        commissionType: 'PERCENT',
        commissionRate: m.commissionRate,
        pendingCommission: 0,
        paidCommission: 0
      }
    });
    console.log(`   + MechanicProfile terhubung: ${m.name} (Komisi: ${m.commissionRate * 100}%)`);
  }

  console.log('\n🎉 SEED DATA BENGKEL USAHABERSAMA SELESAI DENGAN SUKSES!');
}

main()
  .catch(e => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
