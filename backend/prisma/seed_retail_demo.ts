/**
 * seed_retail_demo.ts
 * ==========================================
 * Script untuk mengisi data demo realistis ke tenant RETAIL / GROSIR (Sabar Jaya - sabarjaya)
 * berisi:
 * 1. Profil toko grosir sembako & settings
 * 2. Supplier distributor FMCG (Indofood, Wilmar, Bulog)
 * 3. Kategori sembako & kebutuhan pokok
 * 4. Katalog produk grosir & eceran (Product) dengan 3-tier pricing (Eceran, Grosir, Partai)
 * 5. Konversi Multi-Satuan (ProductUOM: Dus vs Pcs, Karung vs Kg, Renceng vs Sachet)
 * 6. Pelanggan langganan B2B warung kelontong dengan plafon kredit bon tempo (Net-14)
 *
 * Jalankan: npx tsx prisma/seed_retail_demo.ts
 * ==========================================
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETAIL_TENANT_SLUG = 'sabarjaya';

async function main() {
  console.log('\n🛒 ================================================');
  console.log('   SEED DEMO DATA - SABAR JAYA (RETAIL / GROSIR)');
  console.log('================================================\n');

  // --- 1. Ambil Tenant ---
  const tenant = await prisma.tenant.findUnique({ where: { slug: RETAIL_TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`❌ Tenant dengan slug "${RETAIL_TENANT_SLUG}" tidak ditemukan.`);
  }
  console.log(`✅ Tenant ditemukan: [${tenant.id}] ${tenant.name}`);

  // Update Profil Tenant & Settings
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: 'Sabar Jaya Grosir & Sembako',
      businessType: 'RETAIL',
      logoUrl: '/logo-sabarjaya.png'
    }
  });

  const existingSettings = await prisma.settings.findFirst({ where: { tenantId: tenant.id } });
  if (existingSettings) {
    await prisma.settings.update({
      where: { id: existingSettings.id },
      data: {
        storeName: 'Sabar Jaya Grosir & Sembako',
        address: 'Pasar Induk Kramat Jati Blok B No. 12-14, Jakarta Timur',
        phone: '0813-2233-4455',
        logoUrl: '/logo-sabarjaya.png',
        receiptHeader: 'TOKO GROSIR SABAR JAYA\nSembako, Beras, Minyak & Bahan Pokok\nMelayani Eceran, Warung & Partai Besar',
        receiptFooter: 'Barang yang sudah dibeli dapat ditukar jika kemasan cacat/rusak dalam 1x24 jam.\nTerima kasih atas kunjungan Anda!'
      }
    });
  } else {
    await prisma.settings.create({
      data: {
        tenantId: tenant.id,
        storeName: 'Sabar Jaya Grosir & Sembako',
        address: 'Pasar Induk Kramat Jati Blok B No. 12-14, Jakarta Timur',
        phone: '0813-2233-4455',
        logoUrl: '/logo-sabarjaya.png',
        receiptHeader: 'TOKO GROSIR SABAR JAYA\nSembako, Beras, Minyak & Bahan Pokok\nMelayani Eceran, Warung & Partai Besar',
        receiptFooter: 'Barang yang sudah dibeli dapat ditukar jika kemasan cacat/rusak dalam 1x24 jam.\nTerima kasih atas kunjungan Anda!'
      }
    });
  }

  // --- 2. Outlet ---
  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Sabar Jaya - Toko Pusat Kramat Jati',
        code: 'SBJ-01',
        address: 'Pasar Induk Kramat Jati Blok B No. 12-14, Jakarta Timur',
        status: 'ACTIVE'
      }
    });
  }

  // =============================================
  // 3. BERSIHKAN DATA LAMA
  // =============================================
  console.log('\n🧹 [1/5] Membersihkan data retail lama...');
  await prisma.productUOM.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.productPriceTier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.orderItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.supplier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  console.log('✅ Data lama retail berhasil dibersihkan');

  // =============================================
  // 4. SUPPLIER RESMI DISTRIBUTOR FMCG
  // =============================================
  console.log('\n🏭 [2/5] Menyiapkan Supplier Distributor FMCG...');
  const supIndofood = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'PT Indofood CBP Sukses Makmur Tbk (Distribusi)',
      contact: 'Bapak Gunawan',
      phone: '0812-3344-5566',
      email: 'sales.fmcg@indofood.co.id',
      address: 'Kawasan Industri Pulo Gadung, Jakarta Timur',
      notes: 'Distributor utama Indomie, Supermi, Pop Mie, dan Bumbu Racik'
    }
  });

  const supWilmar = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'PT Wilmar Nabati Indonesia (Regional Jakarta)',
      contact: 'Ibu Devi',
      phone: '0813-7788-9900',
      email: 'order.oil@wilmar.co.id',
      address: 'Jl. Rawa Terate I No. 3, Cakung, Jakarta Timur',
      notes: 'Supplier minyak goreng Sania, Fortune, dan Sovia'
    }
  });

  const supBulog = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Perum BULOG Divre DKI Jakarta & Banten',
      contact: 'Bapak Triyono',
      phone: '0811-9988-7711',
      address: 'Jl. Gatot Subroto Kav. 49, Jakarta Selatan',
      notes: 'Pemasok beras SPHP, beras premium, gula pasir, dan minyak Minyakita'
    }
  });
  console.log('✅ 3 Supplier resmi FMCG dibuat');

  // =============================================
  // 5. KATEGORI PRODUK
  // =============================================
  console.log('\n📦 [3/5] Membuat Kategori Sembako & Kebutuhan Pokok...');
  const catBeras = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Beras & Karbohidrat',
      icon: '🌾',
      color: '#eab308',
      sortOrder: 1,
      isActive: true
    }
  });

  const catMinyak = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Minyak Goreng & Mentega',
      icon: '🍳',
      color: '#f97316',
      sortOrder: 2,
      isActive: true
    }
  });

  const catBumbu = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Gula, Tepung & Bumbu Dapur',
      icon: '🧂',
      color: '#ef4444',
      sortOrder: 3,
      isActive: true
    }
  });

  const catMie = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Mie Instan & Makanan Kaleng',
      icon: '🍜',
      color: '#84cc16',
      sortOrder: 4,
      isActive: true
    }
  });

  const catMinuman = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Kopi, Teh & Susu Renceng',
      icon: '☕',
      color: '#06b6d4',
      sortOrder: 5,
      isActive: true
    }
  });

  const catKebersihan = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Sabun & Kebutuhan Rumah Tangga',
      icon: '🧼',
      color: '#8b5cf6',
      sortOrder: 6,
      isActive: true
    }
  });
  console.log('✅ 6 Kategori sembako dibuat');

  // =============================================
  // 6. PRODUK GROSIR & ECERAN (15 Items)
  // =============================================
  console.log('\n🛍️ [4/5] Menambahkan 15 Produk Grosir Sembako...');

  const productsData = [
    {
      categoryId: catBeras.id,
      name: 'Beras Pandan Wangi Super 5 Kg',
      barcode: '899100100001',
      brand: 'Pandan Wangi',
      baseUom: 'SAK',
      buyPrice: 68000,
      sellPrice: 78000,
      sellPriceRetail: 78000,
      sellPriceMitra: 74000,
      sellPriceGrosir: 71000,
      minQtyGrosir: 5,
      stock: 80,
      minStock: 10,
      storageLocation: 'Gudang Beras A-01',
      imageUrl: '/images/retail/beras.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBeras.id,
      name: 'Beras Rojolele Super 25 Kg (Karung)',
      barcode: '899100100002',
      brand: 'Rojolele',
      baseUom: 'KARUNG',
      buyPrice: 320000,
      sellPrice: 365000,
      sellPriceRetail: 365000,
      sellPriceMitra: 350000,
      sellPriceGrosir: 340000,
      minQtyGrosir: 3,
      stock: 45,
      minStock: 5,
      storageLocation: 'Gudang Beras A-02',
      imageUrl: '/images/retail/beras.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMinyak.id,
      name: 'Minyak Goreng Bimoli 2 Liter (Pouch)',
      barcode: '899100100003',
      brand: 'Bimoli',
      baseUom: 'POUCH',
      buyPrice: 33500,
      sellPrice: 38000,
      sellPriceRetail: 38000,
      sellPriceMitra: 36000,
      sellPriceGrosir: 35000,
      minQtyGrosir: 6,
      stock: 120,
      minStock: 12,
      storageLocation: 'Lorong Minyak B-01',
      imageUrl: '/images/retail/minyak.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMinyak.id,
      name: 'Minyakita 1 Liter (Bantal Subsidi)',
      barcode: '899100100004',
      brand: 'Minyakita',
      baseUom: 'BANTAL',
      buyPrice: 13800,
      sellPrice: 15500,
      sellPriceRetail: 15500,
      sellPriceMitra: 14500,
      sellPriceGrosir: 14200,
      minQtyGrosir: 12,
      stock: 200,
      minStock: 24,
      storageLocation: 'Lorong Minyak B-02',
      imageUrl: '/images/retail/minyak.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBumbu.id,
      name: 'Gula Pasir Gulaku Tebu Kuning 1 Kg',
      barcode: '899100100005',
      brand: 'Gulaku',
      baseUom: 'KG',
      buyPrice: 15800,
      sellPrice: 18000,
      sellPriceRetail: 18000,
      sellPriceMitra: 17000,
      sellPriceGrosir: 16500,
      minQtyGrosir: 10,
      stock: 150,
      minStock: 20,
      storageLocation: 'Lorong Gula C-01',
      imageUrl: '/images/retail/sembako.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBumbu.id,
      name: 'Tepung Terigu Segitiga Biru 1 Kg',
      barcode: '899100100006',
      brand: 'Bogasari',
      baseUom: 'KG',
      buyPrice: 10800,
      sellPrice: 12500,
      sellPriceRetail: 12500,
      sellPriceMitra: 11500,
      sellPriceGrosir: 11000,
      minQtyGrosir: 12,
      stock: 160,
      minStock: 24,
      storageLocation: 'Lorong Tepung C-02',
      imageUrl: '/images/retail/sembako.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBumbu.id,
      name: 'Telur Ayam Ras Fresh 1 Kg',
      barcode: '899100100007',
      brand: 'Lokal Peternak',
      baseUom: 'KG',
      buyPrice: 25000,
      sellPrice: 28500,
      sellPriceRetail: 28500,
      sellPriceMitra: 27000,
      sellPriceGrosir: 26000,
      minQtyGrosir: 5,
      stock: 85,
      minStock: 15,
      storageLocation: 'Area Depan Telur',
      imageUrl: '/images/retail/sembako.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMie.id,
      name: 'Indomie Goreng Spesial (Dus/40pcs)',
      barcode: '899100100008',
      brand: 'Indomie',
      baseUom: 'DUS',
      buyPrice: 108000,
      sellPrice: 118000,
      sellPriceRetail: 118000,
      sellPriceMitra: 115000,
      sellPriceGrosir: 113000,
      minQtyGrosir: 5,
      stock: 75,
      minStock: 10,
      storageLocation: 'Gudang Mie D-01',
      imageUrl: '/images/retail/mie_instan.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMie.id,
      name: 'Indomie Kuah Ayam Bawang (Dus/40pcs)',
      barcode: '899100100009',
      brand: 'Indomie',
      baseUom: 'DUS',
      buyPrice: 105000,
      sellPrice: 115000,
      sellPriceRetail: 115000,
      sellPriceMitra: 112000,
      sellPriceGrosir: 110000,
      minQtyGrosir: 5,
      stock: 60,
      minStock: 10,
      storageLocation: 'Gudang Mie D-02',
      imageUrl: '/images/retail/mie_instan.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMinuman.id,
      name: 'Kopi Kapal Api Spesial Mix (Renceng/10pcs)',
      barcode: '899100100010',
      brand: 'Kapal Api',
      baseUom: 'RENCENG',
      buyPrice: 12500,
      sellPrice: 15000,
      sellPriceRetail: 15000,
      sellPriceMitra: 14000,
      sellPriceGrosir: 13500,
      minQtyGrosir: 10,
      stock: 140,
      minStock: 20,
      storageLocation: 'Lorong Kopi E-01',
      imageUrl: '/images/retail/kopi_teh.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMinuman.id,
      name: 'Susu Frisian Flag Kental Manis 370g (Kaleng)',
      barcode: '899100100011',
      brand: 'Frisian Flag',
      baseUom: 'KALENG',
      buyPrice: 10800,
      sellPrice: 12500,
      sellPriceRetail: 12500,
      sellPriceMitra: 11800,
      sellPriceGrosir: 11400,
      minQtyGrosir: 12,
      stock: 96,
      minStock: 12,
      storageLocation: 'Lorong Susu E-02',
      imageUrl: '/images/retail/kopi_teh.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catMinuman.id,
      name: 'Teh Celup Sariwangi 30s (Kotak)',
      barcode: '899100100012',
      brand: 'Sariwangi',
      baseUom: 'KOTAK',
      buyPrice: 6200,
      sellPrice: 7500,
      sellPriceRetail: 7500,
      sellPriceMitra: 7000,
      sellPriceGrosir: 6800,
      minQtyGrosir: 12,
      stock: 80,
      minStock: 12,
      storageLocation: 'Lorong Teh E-03',
      imageUrl: '/images/retail/kopi_teh.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBumbu.id,
      name: 'Kecap Manis Bango 550ml (Pouch Refill)',
      barcode: '899100100013',
      brand: 'Bango',
      baseUom: 'POUCH',
      buyPrice: 21500,
      sellPrice: 24500,
      sellPriceRetail: 24500,
      sellPriceMitra: 23200,
      sellPriceGrosir: 22500,
      minQtyGrosir: 6,
      stock: 72,
      minStock: 12,
      storageLocation: 'Lorong Bumbu C-03',
      imageUrl: '/images/retail/sembako.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catBumbu.id,
      name: 'Garam Dapur Beriodium Dolpin 250g',
      barcode: '899100100014',
      brand: 'Dolpin',
      baseUom: 'BUNGKUS',
      buyPrice: 2800,
      sellPrice: 3500,
      sellPriceRetail: 3500,
      sellPriceMitra: 3100,
      sellPriceGrosir: 2900,
      minQtyGrosir: 20,
      stock: 180,
      minStock: 30,
      storageLocation: 'Lorong Garam C-04',
      imageUrl: '/images/retail/sembako.jpg',
      status: 'Aktif'
    },
    {
      categoryId: catKebersihan.id,
      name: 'Sunlight Jeruk Nipis 650ml (Pouch)',
      barcode: '899100100015',
      brand: 'Sunlight',
      baseUom: 'POUCH',
      buyPrice: 12200,
      sellPrice: 14500,
      sellPriceRetail: 14500,
      sellPriceMitra: 13500,
      sellPriceGrosir: 13000,
      minQtyGrosir: 12,
      stock: 90,
      minStock: 12,
      storageLocation: 'Lorong Sabun F-01',
      imageUrl: '/images/retail/kebersihan.jpg',
      status: 'Aktif'
    }
  ];

  const createdProducts: Record<string, any> = {};
  for (const p of productsData) {
    const prod = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        ...p
      }
    });
    createdProducts[p.barcode] = prod;
  }
  console.log(`✅ ${productsData.length} Produk sembako & grosir berhasil dibuat`);

  // Konversi Multi-Satuan UOM untuk Indomie Goreng (Dus vs Pcs)
  const indomieProd = createdProducts['899100100008'];
  if (indomieProd) {
    await prisma.productUOM.create({
      data: {
        tenantId: tenant.id,
        productId: indomieProd.id,
        unitName: 'PCS',
        conversionRatio: 1 / 40, // 1 dus = 40 pcs
        priceSell: 3200,
        isDefaultSale: false
      }
    });

    await prisma.productUOM.create({
      data: {
        tenantId: tenant.id,
        productId: indomieProd.id,
        unitName: 'DUS',
        conversionRatio: 1,
        priceSell: 118000,
        isDefaultSale: true
      }
    });
  }

  // =============================================
  // 7. PELANGGAN B2B WARUNG (Bon Tempo Net-14)
  // =============================================
  console.log('\n👥 [5/5] Menyiapkan Pelanggan B2B & Bon Tempo...');
  await prisma.customer.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Toko Sembako Bu Maryam (Warung RT 04)',
        phone: '081288991122',
        priceTier: 'GROSIR',
        creditLimit: 3000000,
        creditTermDays: 14,
        tier: 'Gold',
        totalSpent: 4800000
      },
      {
        tenantId: tenant.id,
        name: 'Warung Madura Berkah 24 Jam',
        phone: '081377884455',
        priceTier: 'GROSIR',
        creditLimit: 5000000,
        creditTermDays: 14,
        tier: 'Gold',
        totalSpent: 7500000
      },
      {
        tenantId: tenant.id,
        name: 'Ibu Hj. Siti Aminah (Rumah Tangga)',
        phone: '081512345678',
        priceTier: 'UMUM',
        tier: 'Silver',
        totalSpent: 850000
      }
    ]
  });
  console.log('✅ 3 Pelanggan retail & warung langganan dibuat');

  console.log('\n🎉 ================================================');
  console.log('   SEED DEMO RETAIL (SABAR JAYA) SELESAI!');
  console.log('   Data siap untuk demo & testing live oleh client.');
  console.log('================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Retail demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
