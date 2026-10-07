/**
 * seed_bengkel_demo.ts
 * ==========================================
 * Script untuk mengisi data demo realistis ke tenant BENGKEL (Jakarta Motor - jakartamotor)
 * berisi:
 * 1. Profil bengkel & outlet
 * 2. Tim mekanik (MechanicProfile) dengan skema komisi persen
 * 3. Kategori sparepart & oli
 * 4. Katalog jasa servis (ServiceType) dengan 3-tier pricing (UMUM, MITRA, GROSIR)
 * 5. Katalog sparepart & oli (Product) dengan 3-tier pricing & foto HD bengkel
 * 6. Supplier resmi sparepart & pelumas
 * 7. Pelanggan & registrasi data kendaraan (plat nomor, brand, model)
 * 8. Sample WorkOrder / SPK dalam berbagai status (IN_PROGRESS, DONE, PENDING, PAID)
 *
 * Jalankan: npx tsx prisma/seed_bengkel_demo.ts
 * ==========================================
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BENGKEL_TENANT_SLUG = 'jakartamotor';

async function main() {
  console.log('\n🔧 ================================================');
  console.log('   SEED DEMO DATA - JAKARTA MOTOR (BENGKEL)');
  console.log('================================================\n');

  // --- 1. Ambil Tenant ---
  const tenant = await prisma.tenant.findUnique({ where: { slug: BENGKEL_TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`❌ Tenant dengan slug "${BENGKEL_TENANT_SLUG}" tidak ditemukan. Pastikan tenant sudah ada di database.`);
  }
  console.log(`✅ Tenant ditemukan: [${tenant.id}] ${tenant.name}`);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: 'Jakarta Motor',
      businessType: 'BENGKEL',
      logoUrl: '/logo-jakartamotor.png'
    }
  });

  const existingSettings = await prisma.settings.findFirst({ where: { tenantId: tenant.id } });
  if (existingSettings) {
    await prisma.settings.update({
      where: { id: existingSettings.id },
      data: {
        storeName: 'Jakarta Motor Workshop',
        address: 'Jl. Otista Raya No. 45, Cawang, Jakarta Timur',
        phone: '0812-9876-5432',
        logoUrl: '/logo-jakartamotor.png',
        receiptHeader: 'JAKARTA MOTOR WORKSHOP\nSpesialis Servis Motor Matic, Bebek & Sport',
        receiptFooter: 'Garansi Servis 7 Hari / 500 KM\nTerima kasih atas kepercayaan Anda!'
      }
    });
  } else {
    await prisma.settings.create({
      data: {
        tenantId: tenant.id,
        storeName: 'Jakarta Motor Workshop',
        address: 'Jl. Otista Raya No. 45, Cawang, Jakarta Timur',
        phone: '0812-9876-5432',
        logoUrl: '/logo-jakartamotor.png',
        receiptHeader: 'JAKARTA MOTOR WORKSHOP\nSpesialis Servis Motor Matic, Bebek & Sport',
        receiptFooter: 'Garansi Servis 7 Hari / 500 KM\nTerima kasih atas kepercayaan Anda!'
      }
    });
  }

  // --- 2. Ambil / Buat Outlet ---
  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Jakarta Motor - Workshop Pusat',
        code: 'JKT-01',
        address: 'Jl. Otista Raya No. 45, Cawang, Jakarta Timur',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Outlet dibuat: ${outlet.name}`);
  } else {
    outlet = await prisma.outlet.update({
      where: { id: outlet.id },
      data: {
        name: 'Jakarta Motor - Workshop Pusat',
        address: 'Jl. Otista Raya No. 45, Cawang, Jakarta Timur'
      }
    });
    console.log(`✅ Outlet diperbarui: ${outlet.name}`);
  }

  // =============================================
  // 3. BERSIHKAN DATA BENGKEL LAMA (tenant-scoped)
  // =============================================
  console.log('\n🧹 [1/7] Membersihkan data bengkel lama...');
  await prisma.workOrderInvoiceItem.deleteMany({ where: { workOrder: { tenantId: tenant.id } } });
  await prisma.workOrderInvoice.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workOrderReturnItem.deleteMany({ where: { return: { tenantId: tenant.id } } });
  await prisma.workOrderReturn.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workOrderPart.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workOrderService.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workOrder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.vehicle.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.serviceType.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.commissionPayout.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.mechanicProfile.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.supplier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  console.log('✅ Data lama bengkel berhasil dibersihkan');

  // =============================================
  // 4. BUAT / UPDATE MEKANIK & PROFIL KOMISI
  // =============================================
  console.log('\n👨‍🔧 [2/7] Menyiapkan Tim Mekanik & Komisi...');
  const passwordHash = await bcrypt.hash('123456', 10);

  // Buat User Mekanik
  const mechanicsData = [
    {
      username: 'joko_mekanik',
      name: 'Pak Joko (Kepala Mekanik)',
      pin: '112233',
      rate: 0.20, // 20%
      pending: 125000,
      paid: 1450000
    },
    {
      username: 'agus_mekanik',
      name: 'Agus Prasetyo (Mekanik Mesin & CVT)',
      pin: '223344',
      rate: 0.15, // 15%
      pending: 85000,
      paid: 920000
    },
    {
      username: 'budi_mekanik',
      name: 'Budi Santoso (Mekanik Kelistrikan & Ban)',
      pin: '334455',
      rate: 0.15, // 15%
      pending: 45000,
      paid: 680000
    }
  ];

  const createdMechanics: Record<string, { user: any; profile: any }> = {};

  for (const m of mechanicsData) {
    let user = await prisma.user.findFirst({
      where: { username: m.username, tenantId: tenant.id }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          username: m.username,
          name: m.name,
          passwordHash,
          pin: m.pin,
          role: 'Staff',
          status: 'Aktif',
          permissions: JSON.stringify(['pos.view', 'pos.create'])
        }
      });
    }

    // Ensure TenantMembership
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: { status: 'ACTIVE' },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        status: 'ACTIVE'
      }
    });

    // Create MechanicProfile
    const profile = await prisma.mechanicProfile.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        commissionType: 'PERCENT',
        commissionRate: m.rate,
        pendingCommission: m.pending,
        paidCommission: m.paid
      }
    });

    createdMechanics[m.username] = { user, profile };
  }
  console.log(`✅ 3 Mekanik dibuat lengkap dengan profil komisi`);

  // =============================================
  // 5. SUPPLIERS SPAREPART & PELUMAS
  // =============================================
  console.log('\n🏭 [3/7] Membuat Supplier Sparepart & Oli...');
  const supAstra = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'PT Astra Otoparts Tbk - Regional Jakarta',
      contact: 'Bapak Hendra (Sales Executive)',
      phone: '0811-2233-4455',
      email: 'sales.jkt@astra-otoparts.co.id',
      address: 'Kawasan Industri Pulogadung, Jakarta Timur',
      notes: 'Supplier resmi suku cadang AHM, Federal Parts, dan Aki GS Astra'
    }
  });

  const supShell = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'PT Shell Lubricants Indonesia (Distributor)',
      contact: 'Ibu Ratna',
      phone: '0812-8899-0011',
      email: 'order@lubricants-dist.com',
      address: 'Jl. Rawa Gelam IV No. 8, Cakung, Jakarta Timur',
      notes: 'Distributor resmi pelumas oli Shell Advance dan Motul Scooter'
    }
  });

  const supBan = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'CV Sentosa Ban Motor (Distributor Maxxis & IRC)',
      contact: 'Ko Kevin',
      phone: '0813-7766-5544',
      email: 'sentosaban@gmail.com',
      address: 'Jl. Kebon Jeruk III No. 20, Sawah Besar, Jakarta Barat',
      notes: 'Distributor utama ban motor tubeless Maxxis Victra, IRC Fasti, FDR'
    }
  });
  console.log('✅ 3 Supplier resmi dibuat');

  // =============================================
  // 6. KATEGORI SPAREPART
  // =============================================
  console.log('\n📦 [4/7] Membuat Kategori Sparepart...');
  const catOli = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Oli & Pelumas',
      icon: '🛢️',
      color: '#0284c7',
      sortOrder: 1,
      isActive: true
    }
  });

  const catMesin = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Sparepart Mesin & CVT',
      icon: '⚙️',
      color: '#ea580c',
      sortOrder: 2,
      isActive: true
    }
  });

  const catRem = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Sistem Pengereman',
      icon: '🛑',
      color: '#dc2626',
      sortOrder: 3,
      isActive: true
    }
  });

  const catBan = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Ban & Kaki-kaki',
      icon: '🛞',
      color: '#475569',
      sortOrder: 4,
      isActive: true
    }
  });

  const catKelistrikan = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Kelistrikan & Aki',
      icon: '⚡',
      color: '#ca8a04',
      sortOrder: 5,
      isActive: true
    }
  });
  console.log('✅ 5 Kategori sparepart dibuat');

  // =============================================
  // 7. KATALOG PRODUK SPAREPART (3-Tier Pricing)
  // =============================================
  console.log('\n🔩 [5/7] Menambahkan Katalog Sparepart & Foto HD...');

  const productsData = [
    {
      categoryId: catOli.id,
      name: 'Oli Shell Advance AX7 10W-40 (0.8L)',
      barcode: 'SHELL-AX7-08',
      brand: 'Shell',
      vehicleType: 'MOTOR',
      buyPrice: 42000,
      sellPrice: 55000,
      sellPriceRetail: 55000,
      sellPriceMitra: 49000,
      sellPriceGrosir: 45000,
      minQtyGrosir: 6,
      stock: 48,
      minStock: 6,
      storageLocation: 'Rak A-01 (Pelumas)',
      imageUrl: '/images/bengkel/oli_motor.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catOli.id,
      name: 'Oli Motul Scooter Expert LE 10W-40 (1L)',
      barcode: 'MOTUL-LE-1L',
      brand: 'Motul',
      vehicleType: 'MOTOR',
      buyPrice: 65000,
      sellPrice: 85000,
      sellPriceRetail: 85000,
      sellPriceMitra: 77000,
      sellPriceGrosir: 72000,
      minQtyGrosir: 6,
      stock: 24,
      minStock: 4,
      storageLocation: 'Rak A-02 (Pelumas)',
      imageUrl: '/images/bengkel/oli_motor.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catOli.id,
      name: 'Oli Yamalube Silver 20W-40 (0.8L)',
      barcode: 'YAMA-SIL-08',
      brand: 'Yamalube',
      vehicleType: 'MOTOR',
      buyPrice: 38000,
      sellPrice: 48000,
      sellPriceRetail: 48000,
      sellPriceMitra: 43000,
      sellPriceGrosir: 39000,
      minQtyGrosir: 10,
      stock: 36,
      minStock: 6,
      storageLocation: 'Rak A-03 (Pelumas)',
      imageUrl: '/images/bengkel/oli_motor.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catOli.id,
      name: 'Oli Gardan Scooter Matic 120ml (Yamalube/AHM)',
      barcode: 'GRDN-MAT-120',
      brand: 'AHM / Yamaha',
      vehicleType: 'MOTOR',
      buyPrice: 12000,
      sellPrice: 18000,
      sellPriceRetail: 18000,
      sellPriceMitra: 15000,
      sellPriceGrosir: 13000,
      minQtyGrosir: 12,
      stock: 60,
      minStock: 12,
      storageLocation: 'Rak A-04 (Pelumas)',
      imageUrl: '/images/bengkel/oli_motor.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catRem.id,
      name: 'Kampas Rem Depan Honda Beat / Vario FI',
      barcode: 'PAD-HON-VAR',
      brand: 'Federal / AHM',
      vehicleType: 'MOTOR',
      buyPrice: 28000,
      sellPrice: 45000,
      sellPriceRetail: 45000,
      sellPriceMitra: 38000,
      sellPriceGrosir: 32000,
      minQtyGrosir: 10,
      stock: 32,
      minStock: 5,
      storageLocation: 'Rak B-01 (Pengereman)',
      imageUrl: '/images/bengkel/kampas_rem.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catRem.id,
      name: 'Kampas Rem Belakang Tromol Honda',
      barcode: 'SHOE-HON-TRM',
      brand: 'Federal / AHM',
      vehicleType: 'MOTOR',
      buyPrice: 30000,
      sellPrice: 48000,
      sellPriceRetail: 48000,
      sellPriceMitra: 40000,
      sellPriceGrosir: 35000,
      minQtyGrosir: 10,
      stock: 25,
      minStock: 5,
      storageLocation: 'Rak B-02 (Pengereman)',
      imageUrl: '/images/bengkel/kampas_rem.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catRem.id,
      name: 'Kampas Rem Cakram Yamaha NMAX / Aerox Depan',
      barcode: 'PAD-YAM-NMAX',
      brand: 'Yamaha Genuine Parts',
      vehicleType: 'MOTOR',
      buyPrice: 38000,
      sellPrice: 55000,
      sellPriceRetail: 55000,
      sellPriceMitra: 48000,
      sellPriceGrosir: 42000,
      minQtyGrosir: 8,
      stock: 20,
      minStock: 4,
      storageLocation: 'Rak B-03 (Pengereman)',
      imageUrl: '/images/bengkel/kampas_rem.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMesin.id,
      name: 'Busi Denso U24EPR9 (Standard)',
      barcode: 'BUSI-DENSO-U24',
      brand: 'Denso',
      vehicleType: 'MOTOR',
      buyPrice: 13000,
      sellPrice: 22000,
      sellPriceRetail: 22000,
      sellPriceMitra: 18000,
      sellPriceGrosir: 15000,
      minQtyGrosir: 10,
      stock: 50,
      minStock: 10,
      storageLocation: 'Rak C-01 (Busi & Pengapian)',
      imageUrl: '/images/bengkel/busi.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMesin.id,
      name: 'Busi NGK Iridium CPR8EA-9 (Racing/Upgrade)',
      barcode: 'BUSI-NGK-IRID',
      brand: 'NGK Iridium',
      vehicleType: 'MOTOR',
      buyPrice: 45000,
      sellPrice: 65000,
      sellPriceRetail: 65000,
      sellPriceMitra: 55000,
      sellPriceGrosir: 50000,
      minQtyGrosir: 5,
      stock: 18,
      minStock: 4,
      storageLocation: 'Rak C-02 (Busi & Pengapian)',
      imageUrl: '/images/bengkel/busi.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMesin.id,
      name: 'V-Belt + Roller Set Honda Beat ESP K44',
      barcode: 'VBELT-BEAT-K44',
      brand: 'AHM',
      vehicleType: 'MOTOR',
      buyPrice: 98000,
      sellPrice: 145000,
      sellPriceRetail: 145000,
      sellPriceMitra: 125000,
      sellPriceGrosir: 115000,
      minQtyGrosir: 5,
      stock: 15,
      minStock: 3,
      storageLocation: 'Rak C-03 (CVT Part)',
      imageUrl: '/images/bengkel/kampas_rem.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBan.id,
      name: 'Ban Tubeless Maxxis Victra 90/90-14 (Belakang)',
      barcode: 'BAN-MAX-9014',
      brand: 'Maxxis',
      vehicleType: 'MOTOR',
      buyPrice: 185000,
      sellPrice: 245000,
      sellPriceRetail: 245000,
      sellPriceMitra: 220000,
      sellPriceGrosir: 205000,
      minQtyGrosir: 4,
      stock: 14,
      minStock: 3,
      storageLocation: 'Gudang Ban Belakang',
      imageUrl: '/images/bengkel/ban_tubeless.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBan.id,
      name: 'Ban Tubeless IRC Fasti Pro 90/80-14 (Depan)',
      barcode: 'BAN-IRC-9080',
      brand: 'IRC',
      vehicleType: 'MOTOR',
      buyPrice: 200000,
      sellPrice: 265000,
      sellPriceRetail: 265000,
      sellPriceMitra: 240000,
      sellPriceGrosir: 225000,
      minQtyGrosir: 4,
      stock: 12,
      minStock: 3,
      storageLocation: 'Gudang Ban Belakang',
      imageUrl: '/images/bengkel/ban_tubeless.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catKelistrikan.id,
      name: 'Aki Kering GS Astra GTZ5S 12V 3.5Ah MF',
      barcode: 'AKI-GS-GTZ5S',
      brand: 'GS Astra',
      vehicleType: 'MOTOR',
      buyPrice: 175000,
      sellPrice: 235000,
      sellPriceRetail: 235000,
      sellPriceMitra: 210000,
      sellPriceGrosir: 195000,
      minQtyGrosir: 3,
      stock: 16,
      minStock: 4,
      storageLocation: 'Rak D-01 (Aki & Listrik)',
      imageUrl: '/images/bengkel/aki_motor.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMesin.id,
      name: 'Filter Udara Honda Vario 125/150 Original',
      barcode: 'FLT-VAR-125',
      brand: 'AHM',
      vehicleType: 'MOTOR',
      buyPrice: 38000,
      sellPrice: 55000,
      sellPriceRetail: 55000,
      sellPriceMitra: 48000,
      sellPriceGrosir: 42000,
      minQtyGrosir: 6,
      stock: 22,
      minStock: 5,
      storageLocation: 'Rak C-04 (Filter)',
      imageUrl: '/images/bengkel/kampas_rem.jpg',
      status: 'Aktif'
    }
  ];

  const createdProducts: Record<string, any> = {};
  for (const prod of productsData) {
    const created = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        ...prod
      }
    });
    createdProducts[prod.barcode] = created;
  }
  console.log(`✅ ${productsData.length} Produk sparepart & pelumas dibuat`);

  // =============================================
  // 8. KATALOG JASA SERVIS (ServiceType)
  // =============================================
  console.log('\n🛠️ [6/7] Menambahkan Katalog Jasa Servis (ServiceType)...');
  const serviceTypesData = [
    {
      name: 'Servis Ringan + Ganti Oli',
      description: 'Pengecekan oli, busi, rem, tekanan ban, stasioner mesin & semprot karbu/injeksi',
      vehicleType: 'MOTOR',
      priceRetail: 35000,
      priceMitra: 30000,
      priceGrosir: 25000
    },
    {
      name: 'Servis CVT Matic Lengkap + Grease',
      description: 'Bongkar bak CVT, bersihkan pully, roller, v-belt, amplas mangkok kopling & lumasi grease khusus',
      vehicleType: 'MOTOR',
      priceRetail: 65000,
      priceMitra: 55000,
      priceGrosir: 50000
    },
    {
      name: 'Tune Up Injeksi & Reset ECU Scanner',
      description: 'Cleaning throttle body, infus injector cairan khusus & scan diagnostic sistem sensor',
      vehicleType: 'MOTOR',
      priceRetail: 75000,
      priceMitra: 65000,
      priceGrosir: 60000
    },
    {
      name: 'Ganti Kampas Rem Depan / Belakang',
      description: 'Bongkar kaliper / tromol, bersihkan piringan, pasang kampas rem baru & setel jarak main',
      vehicleType: 'MOTOR',
      priceRetail: 25000,
      priceMitra: 20000,
      priceGrosir: 18000
    },
    {
      name: 'Ganti Ban Luar / Pasang Tubeless + Cairan',
      description: 'Bongkar pasang ban dengan alat tyre changer tanpa merusak velg & pasang pentil tubeless',
      vehicleType: 'MOTOR',
      priceRetail: 25000,
      priceMitra: 20000,
      priceGrosir: 18000
    },
    {
      name: 'Kuras Minyak Rem Depan / Belakang',
      description: 'Kuras tuntas minyak rem lama menggunakan DOT 4 & buang angin palsu (bleeding)',
      vehicleType: 'MOTOR',
      priceRetail: 40000,
      priceMitra: 35000,
      priceGrosir: 30000
    },
    {
      name: 'Overhaul Mesin (Turun Mesin Total)',
      description: 'Bongkar total crankcase, ganti seher/ring, skir klep, ganti packing set & rakit presisi',
      vehicleType: 'MOTOR',
      priceRetail: 350000,
      priceMitra: 300000,
      priceGrosir: 280000
    }
  ];

  const createdServices: Record<string, any> = {};
  for (const st of serviceTypesData) {
    const s = await prisma.serviceType.create({
      data: {
        tenantId: tenant.id,
        ...st,
        isActive: true
      }
    });
    createdServices[st.name] = s;
  }
  console.log(`✅ ${serviceTypesData.length} Jasa servis resmi dibuat`);

  // =============================================
  // 9. PELANGGAN, KENDARAAN & SAMPLE SPK (WorkOrder)
  // =============================================
  console.log('\n🚗 [7/7] Menyiapkan Data Pelanggan, Kendaraan & Realistis SPK...');

  // Pelanggan 1
  const custBudi = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Budi Santoso',
      phone: '081234567890',
      priceTier: 'UMUM',
      tier: 'Gold',
      totalSpent: 420000
    }
  });

  const vehBudi = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      customerId: custBudi.id,
      plateNumber: 'B 4567 KZZ',
      brand: 'Honda',
      model: 'Vario 160 CBS',
      vehicleType: 'MOTOR',
      year: 2023,
      color: 'Hitam Doff',
      notes: 'Rutin servis tiap 2000km'
    }
  });

  // Pelanggan 2
  const custRian = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Rian Hidayat',
      phone: '081398765432',
      priceTier: 'UMUM',
      tier: 'Silver',
      totalSpent: 280000
    }
  });

  const vehRian = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      customerId: custRian.id,
      plateNumber: 'B 3829 TGH',
      brand: 'Yamaha',
      model: 'NMAX 155 Connected',
      vehicleType: 'MOTOR',
      year: 2022,
      color: 'Biru Metallic'
    }
  });

  // Pelanggan 3
  const custSiti = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Siti Nurhaliza',
      phone: '081511223344',
      priceTier: 'UMUM',
      tier: 'Bronze',
      totalSpent: 95000
    }
  });

  const vehSiti = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      customerId: custSiti.id,
      plateNumber: 'B 6789 PQR',
      brand: 'Honda',
      model: 'Beat Street FI',
      vehicleType: 'MOTOR',
      year: 2021,
      color: 'Silver Grey'
    }
  });

  // Pelanggan 4 (Mitra B2B Fleet / Ekspedisi)
  const custFleet = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'PT Ekspedisi Kilat Nusantara',
      phone: '082155667788',
      priceTier: 'MITRA',
      creditLimit: 5000000,
      creditTermDays: 30,
      tier: 'Gold',
      totalSpent: 3500000
    }
  });

  const vehFleet = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      customerId: custFleet.id,
      plateNumber: 'B 1122 CD',
      brand: 'Honda',
      model: 'Supra X 125 Helm-In',
      vehicleType: 'MOTOR',
      year: 2020,
      color: 'Hitam Merah',
      notes: 'Armada kurir express area Cawang'
    }
  });

  // --- SAMPLE SPK 1: IN_PROGRESS (Sedang Dikerjakan Mekanik Agus) ---
  const spk1 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      spkNumber: 'SPK-202610-0001',
      customerId: custBudi.id,
      vehicleId: vehBudi.id,
      vehiclePlate: vehBudi.plateNumber,
      vehicleBrand: vehBudi.brand,
      vehicleModel: vehBudi.model,
      vehicleType: 'MOTOR',
      odometer: 14250,
      fuelLevel: '1/2',
      complaint: 'Tarikan awal bergetar (gredek parah saat macet), ganti oli mesin & oli gardan',
      diagnosis: 'Mangkok kopling CVT berdebu & kotor, v-belt masih oke, oli mesin sudah hitam pekat',
      status: 'IN_PROGRESS',
      priceTier: 'UMUM',
      mechanicId: createdMechanics['agus_mekanik'].user.id,
      mechanicName: createdMechanics['agus_mekanik'].user.name,
      totalServices: 65000,
      totalParts: 73000, // 55000 + 18000
      totalAmount: 138000,
      paidAmount: 0,
      startedAt: new Date(Date.now() - 45 * 60 * 1000)
    }
  });

  await prisma.workOrderService.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk1.id,
      serviceTypeId: createdServices['Servis CVT Matic Lengkap + Grease'].id,
      serviceName: 'Servis CVT Matic Lengkap + Grease',
      vehicleType: 'MOTOR',
      price: 65000,
      qty: 1,
      subtotal: 65000,
      mechanicId: createdMechanics['agus_mekanik'].user.id,
      mechanicName: createdMechanics['agus_mekanik'].user.name
    }
  });

  await prisma.workOrderPart.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk1.id,
      productId: createdProducts['SHELL-AX7-08'].id,
      partName: 'Oli Shell Advance AX7 10W-40 (0.8L)',
      partCode: 'SHELL-AX7-08',
      price: 55000,
      qty: 1,
      subtotal: 55000,
      stockDeducted: true
    }
  });

  await prisma.workOrderPart.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk1.id,
      productId: createdProducts['GRDN-MAT-120'].id,
      partName: 'Oli Gardan Scooter Matic 120ml',
      partCode: 'GRDN-MAT-120',
      price: 18000,
      qty: 1,
      subtotal: 18000,
      stockDeducted: true
    }
  });

  // --- SAMPLE SPK 2: DONE (Selesai, Menunggu Pembayaran / Diambil) ---
  const spk2 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      spkNumber: 'SPK-202610-0002',
      customerId: custRian.id,
      vehicleId: vehRian.id,
      vehiclePlate: vehRian.plateNumber,
      vehicleBrand: vehRian.brand,
      vehicleModel: vehRian.model,
      vehicleType: 'MOTOR',
      odometer: 21800,
      fuelLevel: '3/4',
      complaint: 'Rem depan bunyi decit tajam dan handle rem dalam',
      diagnosis: 'Kampas rem depan habis sisa 10%, minyak rem keruh perlu dikuras',
      status: 'DONE',
      priceTier: 'UMUM',
      mechanicId: createdMechanics['joko_mekanik'].user.id,
      mechanicName: createdMechanics['joko_mekanik'].user.name,
      totalServices: 65000, // 25000 + 40000
      totalParts: 55000,
      totalAmount: 120000,
      paidAmount: 0,
      startedAt: new Date(Date.now() - 120 * 60 * 1000),
      completedAt: new Date(Date.now() - 15 * 60 * 1000)
    }
  });

  await prisma.workOrderService.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk2.id,
      serviceTypeId: createdServices['Ganti Kampas Rem Depan / Belakang'].id,
      serviceName: 'Ganti Kampas Rem Depan / Belakang',
      vehicleType: 'MOTOR',
      price: 25000,
      qty: 1,
      subtotal: 25000,
      mechanicId: createdMechanics['joko_mekanik'].user.id,
      mechanicName: createdMechanics['joko_mekanik'].user.name
    }
  });

  await prisma.workOrderService.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk2.id,
      serviceTypeId: createdServices['Kuras Minyak Rem Depan / Belakang'].id,
      serviceName: 'Kuras Minyak Rem Depan / Belakang',
      vehicleType: 'MOTOR',
      price: 40000,
      qty: 1,
      subtotal: 40000,
      mechanicId: createdMechanics['joko_mekanik'].user.id,
      mechanicName: createdMechanics['joko_mekanik'].user.name
    }
  });

  await prisma.workOrderPart.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk2.id,
      productId: createdProducts['PAD-YAM-NMAX'].id,
      partName: 'Kampas Rem Cakram Yamaha NMAX / Aerox Depan',
      partCode: 'PAD-YAM-NMAX',
      price: 55000,
      qty: 1,
      subtotal: 55000,
      stockDeducted: true
    }
  });

  // --- SAMPLE SPK 3: PENDING (Antrean Baru Masuk) ---
  await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      spkNumber: 'SPK-202610-0003',
      customerId: custSiti.id,
      vehicleId: vehSiti.id,
      vehiclePlate: vehSiti.plateNumber,
      vehicleBrand: vehSiti.brand,
      vehicleModel: vehSiti.model,
      vehicleType: 'MOTOR',
      odometer: 8900,
      fuelLevel: '1/4',
      complaint: 'Starter elektrik kadang tidak nyangkut (cetek-cetek), ganti oli rutin & cek aki',
      diagnosis: 'Aki tegangannya drop di bawah 11.8V, perlu ganti aki atau cas ulang',
      status: 'PENDING',
      priceTier: 'UMUM',
      totalServices: 35000,
      totalParts: 235000,
      totalAmount: 270000,
      paidAmount: 0
    }
  });

  // --- SAMPLE SPK 4: PAID (Selesai & Lunas - Tier MITRA) ---
  const spk4 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      spkNumber: 'SPK-202610-0004',
      customerId: custFleet.id,
      vehicleId: vehFleet.id,
      vehiclePlate: vehFleet.plateNumber,
      vehicleBrand: vehFleet.brand,
      vehicleModel: vehFleet.model,
      vehicleType: 'MOTOR',
      odometer: 48500,
      fuelLevel: 'F',
      complaint: 'Servis berkala bulanan armada kurir: ganti oli, cek busi, setel rantai roda',
      diagnosis: 'Kondisi mesin normal, busi sudah aus diganti baru',
      status: 'PAID',
      priceTier: 'MITRA',
      mechanicId: createdMechanics['budi_mekanik'].user.id,
      mechanicName: createdMechanics['budi_mekanik'].user.name,
      totalServices: 30000, // Harga Mitra
      totalParts: 61000,    // 43000 (oli mitra) + 18000 (busi mitra)
      totalAmount: 91000,
      paidAmount: 91000,
      startedAt: new Date(Date.now() - 180 * 60 * 1000),
      completedAt: new Date(Date.now() - 60 * 60 * 1000)
    }
  });

  await prisma.workOrderService.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk4.id,
      serviceTypeId: createdServices['Servis Ringan + Ganti Oli'].id,
      serviceName: 'Servis Ringan + Ganti Oli',
      vehicleType: 'MOTOR',
      price: 30000,
      qty: 1,
      subtotal: 30000,
      mechanicId: createdMechanics['budi_mekanik'].user.id,
      mechanicName: createdMechanics['budi_mekanik'].user.name
    }
  });

  await prisma.workOrderPart.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk4.id,
      productId: createdProducts['YAMA-SIL-08'].id,
      partName: 'Oli Yamalube Silver 20W-40 (0.8L)',
      partCode: 'YAMA-SIL-08',
      price: 43000,
      qty: 1,
      subtotal: 43000,
      stockDeducted: true
    }
  });

  await prisma.workOrderPart.create({
    data: {
      tenantId: tenant.id,
      workOrderId: spk4.id,
      productId: createdProducts['BUSI-DENSO-U24'].id,
      partName: 'Busi Denso U24EPR9 (Standard)',
      partCode: 'BUSI-DENSO-U24',
      price: 18000,
      qty: 1,
      subtotal: 18000,
      stockDeducted: true
    }
  });

  console.log('✅ 4 Pelanggan, 4 Kendaraan & 4 Sample SPK (IN_PROGRESS, DONE, PENDING, PAID) berhasil dibuat!');

  console.log('\n🎉 ================================================');
  console.log('   SEED DEMO BENGKEL (JAKARTA MOTOR) SELESAI!');
  console.log('   Data siap untuk demo & testing live oleh client.');
  console.log('================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Bengkel demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
