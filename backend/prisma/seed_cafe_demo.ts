/**
 * seed_cafe_demo.ts
 * ==========================================
 * Script untuk mengisi data demo realistis ke tenant CAFE (kopinusa)
 * berisi: menu lengkap + gambar, bahan baku, resep HPP, meja, pelanggan member
 *
 * Jalankan: npx tsx prisma/seed_cafe_demo.ts
 * ==========================================
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CAFE_TENANT_SLUG = 'kopinusa';

async function main() {
  console.log('\n☕ ================================================');
  console.log('   SEED DEMO DATA - KOPINUSA CAFE');
  console.log('================================================\n');

  // --- Ambil Tenant ---
  const tenant = await prisma.tenant.findUnique({ where: { slug: CAFE_TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`❌ Tenant dengan slug "${CAFE_TENANT_SLUG}" tidak ditemukan. Jalankan seed_foundation.ts terlebih dahulu.`);
  }
  console.log(`✅ Tenant ditemukan: [${tenant.id}] ${tenant.name}`);

  // --- Ambil / Buat Outlet ---
  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Kopinusa Cafe - Pusat',
        code: 'KPN-01',
        address: 'Jl. Kopi Nusantara No. 17, Makassar, Sulawesi Selatan',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Outlet dibuat: ${outlet.name}`);
  } else {
    console.log(`✅ Outlet ada: ${outlet.name}`);
  }

  // =============================================
  // 1. BERSIHKAN DATA LAMA (tenant-scoped only)
  // =============================================
  console.log('\n🧹 [1/7] Membersihkan data lama...');
  await prisma.wasteLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: tenant.id } } });
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.cashFlow.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.shift.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.recipeItem.deleteMany({ 
    where: { 
      OR: [
        { tenantId: tenant.id },
        { ingredient: { tenantId: tenant.id } },
        { product: { tenantId: tenant.id } }
      ] 
    } 
  });
  await prisma.ingredientLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.purchaseOrderItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.ingredient.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.supplier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.table.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  console.log('✅ Data lama sudah dibersihkan');

  // =============================================
  // 2. PENGATURAN TOKO (upsert)
  // =============================================
  console.log('\n⚙️  [2/7] Mengatur profil toko...');
  const defaultShifts = JSON.stringify([
    { id: '1', name: 'Shift Pagi', start: '07:00', end: '15:00', lateTolerance: 15 },
    { id: '2', name: 'Shift Sore', start: '14:00', end: '22:00', lateTolerance: 15 },
    { id: '3', name: 'Shift Malam', start: '21:00', end: '05:00', lateTolerance: 15 }
  ]);

  const existingSettings = await prisma.settings.findFirst({ where: { tenantId: tenant.id } });
  if (existingSettings) {
    await prisma.settings.update({
      where: { id: existingSettings.id },
      data: {
        storeName: 'KOPINUSA CAFE',
        phone: '0812-3456-7890',
        address: 'Jl. Kopi Nusantara No. 17, Makassar, Sulawesi Selatan 90115',
        logoUrl: '/logo-kopinusa.png',
        taxRate: 10,
        serviceCharge: 5,
        includeTax: false,
        receiptHeader: 'KOPINUSA CAFE\nEspresso & Nusantara Cuisine\nJl. Kopi Nusantara No. 17, Makassar',
        receiptFooter: 'Terima Kasih Sudah Berkunjung!\nFollow IG: @kopinusa.id\nWifi: kopinusa2024',
        bankName: 'BNI',
        accountNumber: '0123-4567-89',
        accountName: 'KOPINUSA CAFE',
        workShifts: defaultShifts,
        loyaltyEnabled: true,
        loyaltyEarnPerAmount: 10000,
        loyaltyPointValue: 100,
        loyaltySilverThreshold: 500000,
        loyaltyGoldThreshold: 2000000,
        loyaltySilverMultiplier: 1.2,
        loyaltyGoldMultiplier: 1.5,
        ingredientTrackingEnabled: true,
        enableKDS: true,
        enableDrinkCustomization: true,
        autoCompleteKDSOnPay: false,
      }
    });
    console.log('✅ Settings diperbarui: KOPINUSA CAFE');
  } else {
    await prisma.settings.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        storeName: 'KOPINUSA CAFE',
        phone: '0812-3456-7890',
        address: 'Jl. Kopi Nusantara No. 17, Makassar, Sulawesi Selatan 90115',
        logoUrl: '/logo-kopinusa.png',
        taxRate: 10,
        serviceCharge: 5,
        includeTax: false,
        receiptHeader: 'KOPINUSA CAFE\nEspresso & Nusantara Cuisine\nJl. Kopi Nusantara No. 17, Makassar',
        receiptFooter: 'Terima Kasih Sudah Berkunjung!\nFollow IG: @kopinusa.id\nWifi: kopinusa2024',
        bankName: 'BNI',
        accountNumber: '0123-4567-89',
        accountName: 'KOPINUSA CAFE',
        workShifts: defaultShifts,
        loyaltyEnabled: true,
        loyaltyEarnPerAmount: 10000,
        loyaltyPointValue: 100,
        loyaltySilverThreshold: 500000,
        loyaltyGoldThreshold: 2000000,
        loyaltySilverMultiplier: 1.2,
        loyaltyGoldMultiplier: 1.5,
        ingredientTrackingEnabled: true,
        enableKDS: true,
        enableDrinkCustomization: true,
        autoCompleteKDSOnPay: false,
      }
    });
    console.log('✅ Settings dibuat: KOPINUSA CAFE');
  }

  // =============================================
  // 3. SUPPLIER
  // =============================================
  console.log('\n🚚 [3/7] Membuat Supplier...');
  const supKopi = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Arabika Nusantara Roastery',
      contact: 'Pak Fajar',
      phone: '0813-9988-7766',
      address: 'Toraja, Sulawesi Selatan',
      notes: 'Supplier biji kopi Arabika Toraja & Flores single origin, roasted weekly'
    }
  });

  const supDairy = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Fresh Milk & Dairy Sulsel',
      contact: 'Bu Aminah',
      phone: '0812-5544-3322',
      address: 'Gowa, Sulawesi Selatan',
      notes: 'Supplier fresh milk pasteurisasi, UHT, dan produk dairy segar'
    }
  });

  const supBahan = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Toko Bahan & Rempah Makassar',
      contact: 'Pak Ridwan',
      phone: '0812-1122-3344',
      address: 'Pasar Sentral, Makassar',
      notes: 'Supplier beras, gula, telur, bumbu masak, tepung, dan minyak goreng'
    }
  });

  const supPack = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'EcoPack Makassar',
      contact: 'Sales Team',
      phone: '0811-7788-9900',
      address: 'Kawasan Industri Makassar (KIMA)',
      notes: 'Supplier cup, tutup, straw biodegradable, dan takeaway packaging'
    }
  });

  console.log('✅ 4 Supplier dibuat');

  // =============================================
  // 4. BAHAN BAKU (INGREDIENTS)
  // =============================================
  console.log('\n🧂 [4/7] Membuat Bahan Baku...');

  // --- MINUMAN ---
  const ingBijiKopi = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Biji Kopi Arabika Toraja (House Blend)',
      category: 'DRINK',
      subCategory: 'Biji Kopi',
      unit: 'gram',
      stock: 8000,
      minStock: 1500,
      buyPrice: 220,   // Rp 220/gram = Rp 220.000/kg
      supplierId: supKopi.id
    }
  });

  const ingFreshMilk = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Fresh Milk Pasteurisasi',
      category: 'DRINK',
      subCategory: 'Susu & Dairy',
      unit: 'ml',
      stock: 15000,
      minStock: 3000,
      buyPrice: 22,    // Rp 22/ml = Rp 22.000/Liter
      supplierId: supDairy.id
    }
  });

  const ingMatchaPowder = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Matcha Powder Ceremonial Grade (Jepang)',
      category: 'DRINK',
      subCategory: 'Teh & Powder',
      unit: 'gram',
      stock: 800,
      minStock: 150,
      buyPrice: 700,   // Rp 700/gram
      supplierId: supKopi.id
    }
  });

  const ingChocolatePowder = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Dark Chocolate Powder Premium',
      category: 'DRINK',
      subCategory: 'Cokelat & Powder',
      unit: 'gram',
      stock: 2000,
      minStock: 400,
      buyPrice: 120,   // Rp 120/gram
      supplierId: supBahan.id
    }
  });

  const ingSugarSyrup = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Simple Syrup (Gula Cair)',
      category: 'DRINK',
      subCategory: 'Sirup & Pemanis',
      unit: 'ml',
      stock: 5000,
      minStock: 1000,
      buyPrice: 12,    // Rp 12/ml
      supplierId: supBahan.id
    }
  });

  const ingArenSyrup = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Sirup Gula Aren Organik',
      category: 'DRINK',
      subCategory: 'Sirup & Pemanis',
      unit: 'ml',
      stock: 4000,
      minStock: 800,
      buyPrice: 25,    // Rp 25/ml = Rp 25.000/Liter
      supplierId: supBahan.id
    }
  });

  const ingVanillaSyrup = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Vanilla Syrup Monin',
      category: 'DRINK',
      subCategory: 'Sirup & Pemanis',
      unit: 'ml',
      stock: 2000,
      minStock: 400,
      buyPrice: 35,    // Rp 35/ml
      supplierId: supBahan.id
    }
  });

  const ingCreamer = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Heavy Whipping Cream',
      category: 'DRINK',
      subCategory: 'Susu & Dairy',
      unit: 'ml',
      stock: 3000,
      minStock: 500,
      buyPrice: 45,    // Rp 45/ml
      supplierId: supDairy.id
    }
  });

  // --- MAKANAN ---
  const ingBeras = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Beras Pandan Wangi Premium',
      category: 'FOOD',
      subCategory: 'Beras & Karbohidrat',
      unit: 'gram',
      stock: 20000,
      minStock: 5000,
      buyPrice: 18,    // Rp 18/gram = Rp 18.000/kg
      supplierId: supBahan.id
    }
  });

  const ingTelurAyam = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Telur Ayam Kampung',
      category: 'FOOD',
      subCategory: 'Telur & Dairy',
      unit: 'butir',
      stock: 150,
      minStock: 30,
      buyPrice: 3000,  // Rp 3.000/butir
      supplierId: supBahan.id
    }
  });

  const ingAyamFillet = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Dada Ayam Fillet (Tanpa Tulang)',
      category: 'FOOD',
      subCategory: 'Daging & Protein',
      unit: 'gram',
      stock: 5000,
      minStock: 1000,
      buyPrice: 55,    // Rp 55/gram = Rp 55.000/kg
      supplierId: supBahan.id
    }
  });

  const ingPisangKepok = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Pisang Kepok Matang',
      category: 'FOOD',
      subCategory: 'Buah & Sayuran',
      unit: 'buah',
      stock: 60,
      minStock: 15,
      buyPrice: 2000,  // Rp 2.000/buah
      supplierId: supBahan.id
    }
  });

  const ingTepungTerigu = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Tepung Terigu Protein Tinggi (Cakra)',
      category: 'FOOD',
      subCategory: 'Tepung & Karbohidrat',
      unit: 'gram',
      stock: 10000,
      minStock: 2000,
      buyPrice: 14,    // Rp 14/gram = Rp 14.000/kg
      supplierId: supBahan.id
    }
  });

  const ingMinyakGoreng = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Minyak Goreng Bimoli',
      category: 'FOOD',
      subCategory: 'Minyak & Lemak',
      unit: 'ml',
      stock: 10000,
      minStock: 2000,
      buyPrice: 20,    // Rp 20/ml = Rp 20.000/Liter
      supplierId: supBahan.id
    }
  });

  // --- PACKAGING ---
  const ingCupHot = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Paper Cup 8oz (Hot Drink) + Sleeve',
      category: 'PACKAGING',
      subCategory: 'Cup & Tutup',
      unit: 'pcs',
      stock: 500,
      minStock: 100,
      buyPrice: 1500,
      supplierId: supPack.id
    }
  });

  const ingCupIced = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Plastic Cup 16oz (Ice Drink) + Dome Lid',
      category: 'PACKAGING',
      subCategory: 'Cup & Tutup',
      unit: 'pcs',
      stock: 800,
      minStock: 200,
      buyPrice: 1200,
      supplierId: supPack.id
    }
  });

  const ingBiodegradableBox = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Kraft Paper Food Box (Makanan)',
      category: 'PACKAGING',
      subCategory: 'Paper Box',
      unit: 'pcs',
      stock: 300,
      minStock: 60,
      buyPrice: 2500,
      supplierId: supPack.id
    }
  });

  const ingSnackTray = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Paper Snack Tray / Box Mini (Cemilan)',
      category: 'PACKAGING',
      subCategory: 'Paper Box',
      unit: 'pcs',
      stock: 400,
      minStock: 80,
      buyPrice: 1000,
      supplierId: supPack.id
    }
  });

  const ingAquaBotol = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Air Mineral Aqua 600ml (Ready Stock)',
      category: 'DRINK',
      subCategory: 'Air Mineral',
      unit: 'botol',
      stock: 120,
      minStock: 24,
      buyPrice: 3200,
      supplierId: supBahan.id
    }
  });

  const ingCroissantDough = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Dough Croissant Ready-to-Bake Pure Butter',
      category: 'FOOD',
      subCategory: 'Pastry & Bakery',
      unit: 'pcs',
      stock: 60,
      minStock: 15,
      buyPrice: 12000,
      supplierId: supDairy.id
    }
  });

  const ingPaperBag = await prisma.ingredient.create({
    data: {
      tenantId: tenant.id,
      name: 'Glassine Paper Bag Bakery (Pastry)',
      category: 'PACKAGING',
      subCategory: 'Kantong Kertas',
      unit: 'pcs',
      stock: 500,
      minStock: 100,
      buyPrice: 700,
      supplierId: supPack.id
    }
  });

  console.log(`✅ 21 Bahan Baku dibuat lengkap`);

  // =============================================
  // 5. KATEGORI & PRODUK (MENU)
  // =============================================
  console.log('\n📦 [5/7] Membuat Kategori & Menu Produk...');

  // === KATEGORI: MINUMAN KOPI ===
  const catKopi = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Kopi ☕',
      printerTarget: 'BAR',
      sortOrder: 1,
      icon: '☕',
      color: '#795548',
      isActive: true
    }
  });

  const subEspresso = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Espresso Based',
      parentId: catKopi.id,
      printerTarget: 'BAR',
      stationTarget: 'BAR',
      sortOrder: 1,
      isActive: true
    }
  });

  const subManualBrew = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Manual Brew',
      parentId: catKopi.id,
      printerTarget: 'BAR',
      stationTarget: 'BAR',
      sortOrder: 2,
      isActive: true
    }
  });

  // === KATEGORI: MINUMAN NON-KOPI ===
  const catNonKopi = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Non-Kopi 🍵',
      printerTarget: 'BAR',
      sortOrder: 2,
      icon: '🍵',
      color: '#4CAF50',
      isActive: true
    }
  });

  const subMatcha = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Matcha & Teh',
      parentId: catNonKopi.id,
      printerTarget: 'BAR',
      stationTarget: 'BAR',
      sortOrder: 1,
      isActive: true
    }
  });

  const subCokelat = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Cokelat & Signature',
      parentId: catNonKopi.id,
      printerTarget: 'BAR',
      stationTarget: 'BAR',
      sortOrder: 2,
      isActive: true
    }
  });

  // === KATEGORI: MAKANAN BERAT ===
  const catMakananBerat = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Makanan Berat 🍚',
      printerTarget: 'KITCHEN',
      sortOrder: 3,
      icon: '🍚',
      color: '#FF9800',
      isActive: true
    }
  });

  // === KATEGORI: SNACK & CEMILAN ===
  const catSnack = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Snack & Cemilan 🍌',
      printerTarget: 'KITCHEN',
      sortOrder: 4,
      icon: '🍌',
      color: '#FFC107',
      isActive: true
    }
  });

  // =============================================
  // PRODUK KOPI - ESPRESSO BASED
  // =============================================

  const prodEsKopiSusu = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catKopi.id,
      subCategoryId: subEspresso.id,
      name: 'Es Kopi Susu Kopinusa',
      barcode: 'KPN-KOP-001',
      buyPrice: 8500,
      sellPrice: 28000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/es_kopi_susu.png',
      status: 'Aktif'
    }
  });

  const prodCafeLatte = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catKopi.id,
      subCategoryId: subEspresso.id,
      name: 'Caffe Latte',
      barcode: 'KPN-KOP-002',
      buyPrice: 9000,
      sellPrice: 32000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/cappuccino.jpg',
      status: 'Aktif'
    }
  });

  const prodCappuccino = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catKopi.id,
      subCategoryId: subEspresso.id,
      name: 'Cappuccino',
      barcode: 'KPN-KOP-003',
      buyPrice: 9000,
      sellPrice: 32000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/cappuccino.jpg',
      status: 'Aktif'
    }
  });

  const prodAmericano = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catKopi.id,
      subCategoryId: subEspresso.id,
      name: 'Americano (Hot/Iced)',
      barcode: 'KPN-KOP-004',
      buyPrice: 5000,
      sellPrice: 22000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/es_kopi_susu.png',
      status: 'Aktif'
    }
  });

  const prodVanillaLatte = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catKopi.id,
      subCategoryId: subEspresso.id,
      name: 'Vanilla Latte (Signature)',
      barcode: 'KPN-KOP-005',
      buyPrice: 12000,
      sellPrice: 38000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/es_kopi_susu.png',
      status: 'Aktif'
    }
  });

  // PRODUK KOPI - MANUAL BREW
  const prodV60 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catKopi.id,
      subCategoryId: subManualBrew.id,
      name: 'V60 Pour Over (Single Origin Toraja)',
      barcode: 'KPN-KOP-006',
      buyPrice: 13000,
      sellPrice: 45000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/es_kopi_susu.png',
      status: 'Aktif'
    }
  });

  // =============================================
  // PRODUK NON-KOPI - MATCHA
  // =============================================
  const prodMatchaLatte = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catNonKopi.id,
      subCategoryId: subMatcha.id,
      name: 'Matcha Latte (Hot/Iced)',
      barcode: 'KPN-NCF-001',
      buyPrice: 14000,
      sellPrice: 42000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/matcha_latte.png',
      status: 'Aktif'
    }
  });

  const prodMatchaCloud = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catNonKopi.id,
      subCategoryId: subMatcha.id,
      name: 'Matcha Cloud Cream (Signature)',
      barcode: 'KPN-NCF-002',
      buyPrice: 17000,
      sellPrice: 52000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/matcha_cloud.png',
      status: 'Aktif'
    }
  });

  const prodChocoLatte = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catNonKopi.id,
      subCategoryId: subCokelat.id,
      name: 'Dark Choco Latte (Hot/Iced)',
      barcode: 'KPN-NCF-003',
      buyPrice: 10000,
      sellPrice: 32000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/cappuccino.jpg',
      status: 'Aktif'
    }
  });

  const prodAirMineral = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catNonKopi.id,
      subCategoryId: subCokelat.id,
      name: 'Air Mineral Aqua 600ml',
      barcode: 'KPN-NCF-004',
      buyPrice: 4000,
      sellPrice: 8000,
      stock: 100,
      minStock: 20,
      imageUrl: '/images/air_mineral.png',
      status: 'Aktif'
    }
  });

  // =============================================
  // PRODUK MAKANAN BERAT
  // =============================================
  const prodNasiGorengSpesial = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catMakananBerat.id,
      name: 'Nasi Goreng Spesial',
      barcode: 'KPN-MKN-001',
      buyPrice: 18000,
      sellPrice: 45000,
      stock: 999,
      minStock: 5,
      imageUrl: '/images/nasi_goreng_spesial.jpg',
      status: 'Aktif'
    }
  });

  const prodNasiGorengAyam = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catMakananBerat.id,
      name: 'Nasi Goreng Ayam Pedas',
      barcode: 'KPN-MKN-002',
      buyPrice: 16000,
      sellPrice: 38000,
      stock: 999,
      minStock: 5,
      imageUrl: '/images/nasi_goreng.png',
      status: 'Aktif'
    }
  });

  const prodNasiGorengKampung = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catMakananBerat.id,
      name: 'Nasi Goreng Kampung',
      barcode: 'KPN-MKN-003',
      buyPrice: 12000,
      sellPrice: 30000,
      stock: 999,
      minStock: 5,
      imageUrl: '/images/nasi_goreng.png',
      status: 'Aktif'
    }
  });

  // =============================================
  // PRODUK SNACK & CEMILAN
  // =============================================
  const prodPisangGoreng = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catSnack.id,
      name: 'Pisang Goreng Crispy (4 pcs)',
      barcode: 'KPN-SNK-001',
      buyPrice: 7000,
      sellPrice: 18000,
      stock: 999,
      minStock: 5,
      imageUrl: '/images/pisang_goreng.jpg',
      status: 'Aktif'
    }
  });

  const prodCroissant = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catSnack.id,
      name: 'Butter Croissant (French Style)',
      barcode: 'KPN-SNK-002',
      buyPrice: 10000,
      sellPrice: 28000,
      stock: 25,
      minStock: 5,
      imageUrl: '/images/croissant.png',
      status: 'Aktif'
    }
  });

  console.log(`✅ 15 Menu Produk dibuat`);

  // =============================================
  // 6. RESEP / HPP (RECIPE ITEMS)
  // =============================================
  console.log('\n📋 [6/7] Membuat Resep HPP (Bill of Materials)...');

  // === RESEP: ES KOPI SUSU KOPINUSA ===
  // HPP: 18g kopi (Rp3.960) + 150ml fresh milk (Rp3.300) + 25ml gula aren (Rp625) + 1 cup iced (Rp1.200) = Total Rp9.085
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodEsKopiSusu.id, ingredientId: ingBijiKopi.id, qtyPerServing: 18 },
      { tenantId: tenant.id, productId: prodEsKopiSusu.id, ingredientId: ingFreshMilk.id, qtyPerServing: 150 },
      { tenantId: tenant.id, productId: prodEsKopiSusu.id, ingredientId: ingArenSyrup.id, qtyPerServing: 25 },
      { tenantId: tenant.id, productId: prodEsKopiSusu.id, ingredientId: ingCupIced.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: CAFFE LATTE ===
  // HPP: 18g kopi (Rp3.960) + 200ml fresh milk (Rp4.400) + 1 cup hot (Rp1.500) = Total Rp9.860
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodCafeLatte.id, ingredientId: ingBijiKopi.id, qtyPerServing: 18 },
      { tenantId: tenant.id, productId: prodCafeLatte.id, ingredientId: ingFreshMilk.id, qtyPerServing: 200 },
      { tenantId: tenant.id, productId: prodCafeLatte.id, ingredientId: ingCupHot.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: CAPPUCCINO ===
  // HPP: 18g kopi (Rp3.960) + 120ml fresh milk (Rp2.640) + 30ml cream (Rp1.350) + 1 cup hot (Rp1.500) = Total Rp9.450
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodCappuccino.id, ingredientId: ingBijiKopi.id, qtyPerServing: 18 },
      { tenantId: tenant.id, productId: prodCappuccino.id, ingredientId: ingFreshMilk.id, qtyPerServing: 120 },
      { tenantId: tenant.id, productId: prodCappuccino.id, ingredientId: ingCreamer.id, qtyPerServing: 30 },
      { tenantId: tenant.id, productId: prodCappuccino.id, ingredientId: ingCupHot.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: AMERICANO ===
  // HPP: 18g kopi (Rp3.960) + 1 cup hot (Rp1.500) = Total Rp5.460
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodAmericano.id, ingredientId: ingBijiKopi.id, qtyPerServing: 18 },
      { tenantId: tenant.id, productId: prodAmericano.id, ingredientId: ingCupHot.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: VANILLA LATTE ===
  // HPP: 18g kopi (Rp3.960) + 180ml fresh milk (Rp3.960) + 30ml vanilla syrup (Rp1.050) + 1 cup iced (Rp1.200) = Total Rp10.170
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodVanillaLatte.id, ingredientId: ingBijiKopi.id, qtyPerServing: 18 },
      { tenantId: tenant.id, productId: prodVanillaLatte.id, ingredientId: ingFreshMilk.id, qtyPerServing: 180 },
      { tenantId: tenant.id, productId: prodVanillaLatte.id, ingredientId: ingVanillaSyrup.id, qtyPerServing: 30 },
      { tenantId: tenant.id, productId: prodVanillaLatte.id, ingredientId: ingCupIced.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: V60 POUR OVER ===
  // HPP: 20g kopi (Rp4.400) + 1 cup hot (Rp1.500) = Total Rp5.900
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodV60.id, ingredientId: ingBijiKopi.id, qtyPerServing: 20 },
      { tenantId: tenant.id, productId: prodV60.id, ingredientId: ingCupHot.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: MATCHA LATTE ===
  // HPP: 15g matcha (Rp10.500) + 180ml fresh milk (Rp3.960) + 20ml syrup (Rp240) + 1 cup iced (Rp1.200) = Total Rp15.900
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodMatchaLatte.id, ingredientId: ingMatchaPowder.id, qtyPerServing: 15 },
      { tenantId: tenant.id, productId: prodMatchaLatte.id, ingredientId: ingFreshMilk.id, qtyPerServing: 180 },
      { tenantId: tenant.id, productId: prodMatchaLatte.id, ingredientId: ingSugarSyrup.id, qtyPerServing: 20 },
      { tenantId: tenant.id, productId: prodMatchaLatte.id, ingredientId: ingCupIced.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: MATCHA CLOUD CREAM ===
  // HPP: 18g matcha (Rp12.600) + 150ml fresh milk (Rp3.300) + 50ml creamer (Rp2.250) + 20ml syrup (Rp240) + 1 cup iced (Rp1.200) = Total Rp19.590
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodMatchaCloud.id, ingredientId: ingMatchaPowder.id, qtyPerServing: 18 },
      { tenantId: tenant.id, productId: prodMatchaCloud.id, ingredientId: ingFreshMilk.id, qtyPerServing: 150 },
      { tenantId: tenant.id, productId: prodMatchaCloud.id, ingredientId: ingCreamer.id, qtyPerServing: 50 },
      { tenantId: tenant.id, productId: prodMatchaCloud.id, ingredientId: ingSugarSyrup.id, qtyPerServing: 20 },
      { tenantId: tenant.id, productId: prodMatchaCloud.id, ingredientId: ingCupIced.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: DARK CHOCO LATTE ===
  // HPP: 25g choco powder (Rp3.000) + 180ml fresh milk (Rp3.960) + 20ml syrup (Rp240) + 1 cup hot (Rp1.500) = Total Rp8.700
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodChocoLatte.id, ingredientId: ingChocolatePowder.id, qtyPerServing: 25 },
      { tenantId: tenant.id, productId: prodChocoLatte.id, ingredientId: ingFreshMilk.id, qtyPerServing: 180 },
      { tenantId: tenant.id, productId: prodChocoLatte.id, ingredientId: ingSugarSyrup.id, qtyPerServing: 20 },
      { tenantId: tenant.id, productId: prodChocoLatte.id, ingredientId: ingCupHot.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: AIR MINERAL 600ML ===
  // HPP: 1 botol Aqua 600ml (Rp3.200) = Total Rp3.200
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodAirMineral.id, ingredientId: ingAquaBotol.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: NASI GORENG SPESIAL ===
  // HPP: 200g beras (Rp3.600) + 2 butir telur (Rp6.000) + 100g ayam (Rp5.500) + 25ml minyak (Rp500) + 1 paper box (Rp2.500) = Total Rp18.100
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodNasiGorengSpesial.id, ingredientId: ingBeras.id, qtyPerServing: 200 },
      { tenantId: tenant.id, productId: prodNasiGorengSpesial.id, ingredientId: ingTelurAyam.id, qtyPerServing: 2 },
      { tenantId: tenant.id, productId: prodNasiGorengSpesial.id, ingredientId: ingAyamFillet.id, qtyPerServing: 100 },
      { tenantId: tenant.id, productId: prodNasiGorengSpesial.id, ingredientId: ingMinyakGoreng.id, qtyPerServing: 25 },
      { tenantId: tenant.id, productId: prodNasiGorengSpesial.id, ingredientId: ingBiodegradableBox.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: NASI GORENG AYAM PEDAS ===
  // HPP: 200g beras (Rp3.600) + 1 butir telur (Rp3.000) + 80g ayam (Rp4.400) + 20ml minyak (Rp400) + 1 paper box (Rp2.500) = Total Rp13.900
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodNasiGorengAyam.id, ingredientId: ingBeras.id, qtyPerServing: 200 },
      { tenantId: tenant.id, productId: prodNasiGorengAyam.id, ingredientId: ingTelurAyam.id, qtyPerServing: 1 },
      { tenantId: tenant.id, productId: prodNasiGorengAyam.id, ingredientId: ingAyamFillet.id, qtyPerServing: 80 },
      { tenantId: tenant.id, productId: prodNasiGorengAyam.id, ingredientId: ingMinyakGoreng.id, qtyPerServing: 20 },
      { tenantId: tenant.id, productId: prodNasiGorengAyam.id, ingredientId: ingBiodegradableBox.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: NASI GORENG KAMPUNG ===
  // HPP: 200g beras (Rp3.600) + 1 butir telur (Rp3.000) + 20ml minyak (Rp400) + 1 paper box (Rp2.500) = Total Rp9.500
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodNasiGorengKampung.id, ingredientId: ingBeras.id, qtyPerServing: 200 },
      { tenantId: tenant.id, productId: prodNasiGorengKampung.id, ingredientId: ingTelurAyam.id, qtyPerServing: 1 },
      { tenantId: tenant.id, productId: prodNasiGorengKampung.id, ingredientId: ingMinyakGoreng.id, qtyPerServing: 20 },
      { tenantId: tenant.id, productId: prodNasiGorengKampung.id, ingredientId: ingBiodegradableBox.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: PISANG GORENG CRISPY ===
  // HPP: 4 buah pisang (Rp8.000) + 60g tepung (Rp840) + 30ml minyak (Rp600) + 1 snack tray (Rp1.000) = Total Rp10.440
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodPisangGoreng.id, ingredientId: ingPisangKepok.id, qtyPerServing: 4 },
      { tenantId: tenant.id, productId: prodPisangGoreng.id, ingredientId: ingTepungTerigu.id, qtyPerServing: 60 },
      { tenantId: tenant.id, productId: prodPisangGoreng.id, ingredientId: ingMinyakGoreng.id, qtyPerServing: 30 },
      { tenantId: tenant.id, productId: prodPisangGoreng.id, ingredientId: ingSnackTray.id, qtyPerServing: 1 },
    ]
  });

  // === RESEP: BUTTER CROISSANT ===
  // HPP: 1 pcs croissant dough pure butter (Rp12.000) + 1 glassine paper bag (Rp700) = Total Rp12.700
  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, productId: prodCroissant.id, ingredientId: ingCroissantDough.id, qtyPerServing: 1 },
      { tenantId: tenant.id, productId: prodCroissant.id, ingredientId: ingPaperBag.id, qtyPerServing: 1 },
    ]
  });

  // Sinkronisasi otomatis HPP BOM ke buyPrice seluruh produk cafe
  const allCafeProducts = [
    prodEsKopiSusu, prodCafeLatte, prodCappuccino, prodAmericano, prodVanillaLatte,
    prodV60, prodMatchaLatte, prodMatchaCloud, prodChocoLatte, prodAirMineral,
    prodNasiGorengSpesial, prodNasiGorengAyam, prodNasiGorengKampung, prodPisangGoreng, prodCroissant
  ];
  for (const p of allCafeProducts) {
    const items = await prisma.recipeItem.findMany({
      where: { productId: p.id, tenantId: tenant.id },
      include: { ingredient: true }
    });
    if (items.length > 0) {
      const computedHpp = items.reduce((sum, item) => sum + (item.qtyPerServing * item.ingredient.buyPrice), 0);
      await prisma.product.update({
        where: { id: p.id },
        data: { buyPrice: computedHpp }
      });
    }
  }

  console.log('✅ 15 Resep HPP (Bill of Materials) lengkap & buyPrice produk disinkronkan presisi');

  // =============================================
  // 7. MEJA (TABLES)
  // =============================================
  console.log('\n🪑 Membuat Denah Meja...');
  const tables = [
    { tableNo: 'A1', name: 'Indoor - Dekat Jendela', capacity: 2, posX: 15, posY: 20, shape: 'square' },
    { tableNo: 'A2', name: 'Indoor - Dekat Jendela', capacity: 2, posX: 35, posY: 20, shape: 'square' },
    { tableNo: 'B1', name: 'Indoor - Tengah', capacity: 4, posX: 20, posY: 45, shape: 'circle' },
    { tableNo: 'B2', name: 'Indoor - Tengah', capacity: 4, posX: 45, posY: 45, shape: 'circle' },
    { tableNo: 'B3', name: 'Indoor - Tengah', capacity: 4, posX: 70, posY: 45, shape: 'circle' },
    { tableNo: 'C1', name: 'Outdoor - Garden Area', capacity: 6, posX: 20, posY: 72, shape: 'square' },
    { tableNo: 'C2', name: 'Outdoor - Garden Area', capacity: 6, posX: 55, posY: 72, shape: 'square' },
    { tableNo: 'VIP-1', name: 'VIP Room (Private)', capacity: 8, posX: 80, posY: 25, shape: 'square' },
  ];

  for (const t of tables) {
    await prisma.table.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        tableNo: t.tableNo,
        name: t.name,
        capacity: t.capacity,
        posX: t.posX,
        posY: t.posY,
        shape: t.shape,
        status: 'Tersedia'
      }
    });
  }
  console.log(`✅ ${tables.length} Meja dibuat`);

  // =============================================
  // 8. PELANGGAN MEMBER (LOYALTY)
  // =============================================
  console.log('\n👤 Membuat Pelanggan Member Demo...');
  await prisma.customer.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Ahmad Zulfikar',
        phone: '081299112233',
        email: 'ahmad@example.com',
        points: 2400,
        tier: 'Gold',
        totalSpent: 3800000
      },
      {
        tenantId: tenant.id,
        name: 'Siti Rahmawati',
        phone: '082188334455',
        email: 'siti@example.com',
        points: 750,
        tier: 'Silver',
        totalSpent: 1200000
      },
      {
        tenantId: tenant.id,
        name: 'Doni Prasetyo',
        phone: '085677889900',
        email: 'doni@example.com',
        points: 120,
        tier: 'Bronze',
        totalSpent: 320000
      },
      {
        tenantId: tenant.id,
        name: 'Nurul Aisyah',
        phone: '087811223344',
        email: 'nurul@example.com',
        points: 1580,
        tier: 'Silver',
        totalSpent: 1750000
      },
      {
        tenantId: tenant.id,
        name: 'Budi Santoso',
        phone: '081355667788',
        email: 'budi@example.com',
        points: 50,
        tier: 'Bronze',
        totalSpent: 180000
      }
    ]
  });
  console.log('✅ 5 Pelanggan Member dibuat');

  // =============================================
  // 9. TRANSAKSI ORDER HISTORIS (14 Hari Analitik)
  // =============================================
  console.log('\n📈 [9/12] Membuat Order Penjualan Historis (14 Hari)...');
  const allProducts = await prisma.product.findMany({ where: { tenantId: tenant.id } });
  const allTables = await prisma.table.findMany({ where: { tenantId: tenant.id } });
  const allCustomers = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
  const kasirUser = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: 'KASIR' } }) 
    || await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  const userId = kasirUser?.id;

  const pKopiSusu = allProducts.find(p => p.name.includes('Susu Gula Aren')) || allProducts[0];
  const pMatcha = allProducts.find(p => p.name.includes('Matcha Cloud')) || allProducts[1];
  const pAmericano = allProducts.find(p => p.name.includes('Americano')) || allProducts[2];
  const pCroissant = allProducts.find(p => p.name.includes('Croissant')) || allProducts[3];
  const pNasgor = allProducts.find(p => p.name.includes('Nasi Goreng Spesial')) || allProducts[4];
  const pPisgor = allProducts.find(p => p.name.includes('Pisang Goreng')) || allProducts[5];
  const pLatte = allProducts.find(p => p.name.includes('Cafe Latte')) || allProducts[6];
  const pAqua = allProducts.find(p => p.name.includes('Aqua')) || allProducts[7];

  const tA1 = allTables.find(t => t.tableNo === 'A1') || allTables[0];
  const tA2 = allTables.find(t => t.tableNo === 'A2') || allTables[1];
  const tB1 = allTables.find(t => t.tableNo === 'B1') || allTables[2];
  const tB2 = allTables.find(t => t.tableNo === 'B2') || allTables[3];
  const tC1 = allTables.find(t => t.tableNo === 'C1') || allTables[4];
  const tVip = allTables.find(t => t.tableNo === 'VIP-1') || allTables[5];

  const cAhmad = allCustomers.find(c => c.name.includes('Ahmad')) || allCustomers[0];
  const cSiti = allCustomers.find(c => c.name.includes('Siti')) || allCustomers[1];
  const cDoni = allCustomers.find(c => c.name.includes('Doni')) || allCustomers[2];
  const cNurul = allCustomers.find(c => c.name.includes('Nurul')) || allCustomers[3];

  const now = new Date();
  const getDate = (daysAgo: number, hour: number, min: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, min, 0, 0);
    return d;
  };

  const orderScenarios = [
    { daysAgo: 0, hour: 11, min: 45, table: tA1, cust: cAhmad, pay: 'QRIS', items: [{ p: pKopiSusu, qty: 2 }, { p: pCroissant, qty: 2 }] },
    { daysAgo: 0, hour: 12, min: 20, table: tB1, cust: cSiti, pay: 'Cash', items: [{ p: pNasgor, qty: 2 }, { p: pKopiSusu, qty: 2 }, { p: pAqua, qty: 2 }] },
    { daysAgo: 0, hour: 13, min: 10, table: null, cust: null, pay: 'QRIS', items: [{ p: pMatcha, qty: 1 }, { p: pPisgor, qty: 1 }] },
    { daysAgo: 0, hour: 14, min: 30, table: tA2, cust: cDoni, pay: 'Cash', items: [{ p: pAmericano, qty: 1 }, { p: pCroissant, qty: 1 }] },
    { daysAgo: 0, hour: 16, min: 15, table: tC1, cust: cNurul, pay: 'QRIS', items: [{ p: pMatcha, qty: 2 }, { p: pPisgor, qty: 2 }] },

    { daysAgo: 1, hour: 12, min: 10, table: tB2, cust: null, pay: 'Cash', items: [{ p: pNasgor, qty: 3 }, { p: pKopiSusu, qty: 3 }] },
    { daysAgo: 1, hour: 14, min: 0, table: tA1, cust: cAhmad, pay: 'QRIS', items: [{ p: pLatte, qty: 1 }, { p: pCroissant, qty: 1 }] },
    { daysAgo: 1, hour: 19, min: 25, table: tVip, cust: cNurul, pay: 'Transfer', items: [{ p: pNasgor, qty: 4 }, { p: pKopiSusu, qty: 4 }, { p: pPisgor, qty: 2 }] },
    { daysAgo: 1, hour: 20, min: 40, table: tC1, cust: null, pay: 'QRIS', items: [{ p: pAmericano, qty: 2 }, { p: pMatcha, qty: 2 }] },

    { daysAgo: 2, hour: 10, min: 30, table: tA2, cust: cDoni, pay: 'Cash', items: [{ p: pKopiSusu, qty: 1 }, { p: pCroissant, qty: 1 }] },
    { daysAgo: 2, hour: 12, min: 45, table: tB1, cust: cSiti, pay: 'QRIS', items: [{ p: pNasgor, qty: 2 }, { p: pLatte, qty: 2 }] },
    { daysAgo: 2, hour: 19, min: 15, table: tC1, cust: null, pay: 'Cash', items: [{ p: pPisgor, qty: 2 }, { p: pKopiSusu, qty: 3 }] },

    { daysAgo: 3, hour: 11, min: 50, table: tA1, cust: null, pay: 'Cash', items: [{ p: pAmericano, qty: 2 }, { p: pCroissant, qty: 2 }] },
    { daysAgo: 3, hour: 13, min: 20, table: null, cust: null, pay: 'QRIS', items: [{ p: pKopiSusu, qty: 4 }] },
    { daysAgo: 3, hour: 18, min: 50, table: tB2, cust: cAhmad, pay: 'QRIS', items: [{ p: pNasgor, qty: 2 }, { p: pMatcha, qty: 2 }] },

    { daysAgo: 4, hour: 12, min: 15, table: tB1, cust: cSiti, pay: 'Cash', items: [{ p: pNasgor, qty: 2 }, { p: pKopiSusu, qty: 2 }] },
    { daysAgo: 4, hour: 16, min: 30, table: tA1, cust: null, pay: 'QRIS', items: [{ p: pLatte, qty: 2 }, { p: pPisgor, qty: 1 }] },
    { daysAgo: 4, hour: 20, min: 10, table: tC1, cust: cNurul, pay: 'QRIS', items: [{ p: pMatcha, qty: 2 }, { p: pKopiSusu, qty: 2 }] },

    { daysAgo: 5, hour: 12, min: 30, table: tA2, cust: null, pay: 'Cash', items: [{ p: pNasgor, qty: 1 }, { p: pAqua, qty: 1 }] },
    { daysAgo: 5, hour: 15, min: 40, table: tC1, cust: cDoni, pay: 'QRIS', items: [{ p: pKopiSusu, qty: 2 }, { p: pPisgor, qty: 1 }] },
    { daysAgo: 5, hour: 19, min: 30, table: tVip, cust: cAhmad, pay: 'Transfer', items: [{ p: pNasgor, qty: 5 }, { p: pLatte, qty: 5 }, { p: pCroissant, qty: 5 }] },

    { daysAgo: 7, hour: 11, min: 30, table: tA1, cust: null, pay: 'Cash', items: [{ p: pKopiSusu, qty: 2 }, { p: pCroissant, qty: 2 }] },
    { daysAgo: 7, hour: 13, min: 0, table: tB1, cust: cSiti, pay: 'QRIS', items: [{ p: pNasgor, qty: 2 }, { p: pMatcha, qty: 2 }] },
    { daysAgo: 7, hour: 19, min: 45, table: tC1, cust: null, pay: 'Cash', items: [{ p: pKopiSusu, qty: 3 }, { p: pPisgor, qty: 2 }] },

    { daysAgo: 9, hour: 12, min: 20, table: tB2, cust: cNurul, pay: 'QRIS', items: [{ p: pNasgor, qty: 2 }, { p: pLatte, qty: 2 }] },
    { daysAgo: 9, hour: 17, min: 10, table: tA2, cust: null, pay: 'Cash', items: [{ p: pAmericano, qty: 1 }, { p: pCroissant, qty: 1 }] },

    { daysAgo: 11, hour: 13, min: 15, table: tA1, cust: cDoni, pay: 'QRIS', items: [{ p: pMatcha, qty: 1 }, { p: pPisgor, qty: 1 }] },
    { daysAgo: 11, hour: 19, min: 30, table: tC1, cust: cAhmad, pay: 'Cash', items: [{ p: pKopiSusu, qty: 4 }, { p: pNasgor, qty: 2 }] },

    { daysAgo: 13, hour: 12, min: 45, table: tB1, cust: null, pay: 'Cash', items: [{ p: pNasgor, qty: 3 }, { p: pAqua, qty: 3 }] },
    { daysAgo: 13, hour: 20, min: 10, table: tVip, cust: cNurul, pay: 'Transfer', items: [{ p: pNasgor, qty: 4 }, { p: pKopiSusu, qty: 4 }, { p: pCroissant, qty: 4 }] }
  ];

  let orderCount = 0;
  let totalSales = 0;

  for (const s of orderScenarios) {
    const orderDate = getDate(s.daysAgo, s.hour, s.min);
    const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `ORD-KPN-${dateStr}-${String(orderCount + 1).padStart(4, '0')}`;

    let subtotal = 0;
    const itemsData = s.items.map(it => {
      const itemSub = it.p.sellPrice * it.qty;
      subtotal += itemSub;
      return {
        tenantId: tenant.id,
        outletId: outlet.id,
        productId: it.p.id,
        qty: it.qty,
        price: it.p.sellPrice,
        buyPrice: it.p.buyPrice || 0,
        subtotal: itemSub
      };
    });

    const tax = Math.round(subtotal * 0.10);
    const service = Math.round(subtotal * 0.05);
    const total = subtotal + tax + service;
    totalSales += total;

    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId,
        tableId: s.table?.id || null,
        customerId: s.cust?.id || null,
        customerName: s.cust?.name || (s.table ? `Tamu Meja ${s.table.tableNo}` : 'Pelanggan Takeaway'),
        orderNumber,
        subtotal,
        tax,
        serviceCharge: service,
        total,
        status: 'Paid',
        kdsStatus: 'Served',
        paymentMethod: s.pay,
        createdAt: orderDate,
        updatedAt: orderDate,
        paidAt: orderDate,
        items: { create: itemsData }
      }
    });
    orderCount++;
  }
  console.log(`✅ ${orderCount} Order Historis dibuat (Total: Rp${totalSales.toLocaleString('id-ID')})`);

  // =============================================
  // 10. PESANAN LIVE AKTIF (Meja B1 & VIP-1)
  // =============================================
  console.log('\n🔥 [10/12] Membuat Pesanan Live Meja & Antrean KDS...');
  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      userId,
      tableId: tB1.id,
      customerName: 'Bpk. Hendra (Meja B1)',
      orderNumber: `ORD-KPN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-LIVE1`,
      subtotal: 104000,
      tax: 10400,
      serviceCharge: 5200,
      total: 119600,
      status: 'Paid',
      kdsStatus: 'Cooking',
      paymentMethod: 'QRIS',
      createdAt: new Date(now.getTime() - 15 * 60 * 1000),
      paidAt: new Date(now.getTime() - 15 * 60 * 1000),
      items: {
        create: [
          { tenantId: tenant.id, outletId: outlet.id, productId: pNasgor.id, qty: 2, price: pNasgor.sellPrice, buyPrice: pNasgor.buyPrice || 0, subtotal: pNasgor.sellPrice * 2 },
          { tenantId: tenant.id, outletId: outlet.id, productId: pKopiSusu.id, qty: 2, price: pKopiSusu.sellPrice, buyPrice: pKopiSusu.buyPrice || 0, subtotal: pKopiSusu.sellPrice * 2 }
        ]
      }
    }
  });

  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      userId,
      tableId: tVip.id,
      customerName: 'Rapat Tim Marketing (VIP-1)',
      orderNumber: `ORD-KPN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-LIVE2`,
      subtotal: 160000,
      tax: 16000,
      serviceCharge: 8000,
      total: 184000,
      status: 'Pending',
      kdsStatus: 'Pending',
      paymentMethod: null,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
      items: {
        create: [
          { tenantId: tenant.id, outletId: outlet.id, productId: pMatcha.id, qty: 2, price: pMatcha.sellPrice, buyPrice: pMatcha.buyPrice || 0, subtotal: pMatcha.sellPrice * 2 },
          { tenantId: tenant.id, outletId: outlet.id, productId: pCroissant.id, qty: 2, price: pCroissant.sellPrice, buyPrice: pCroissant.buyPrice || 0, subtotal: pCroissant.sellPrice * 2 }
        ]
      }
    }
  });

  await prisma.table.update({ where: { id: tB1.id }, data: { status: 'Terisi' } });
  await prisma.table.update({ where: { id: tVip.id }, data: { status: 'Terisi' } });
  console.log('✅ 2 Pesanan Aktif KDS Live & Status Meja Terisi');

  // =============================================
  // 11. ARUS KAS OPERASIONAL (PETTY CASH)
  // =============================================
  console.log('\n💵 [11/12] Menambahkan Arus Kas Operasional Kasir (Petty Cash)...');
  const cashFlowsData = [
    { type: 'Pengeluaran', category: 'Bahan Baku Darurat', amount: 90000, desc: 'Beli Es Batu Kristal 6 sak @ 15.000', daysAgo: 0 },
    { type: 'Pengeluaran', category: 'Operasional', amount: 44000, desc: 'Isi Ulang Gas LPG 3kg 2 tabung dapur', daysAgo: 1 },
    { type: 'Pengeluaran', category: 'Operasional', amount: 95000, desc: 'Beli Galon Aqua 5 galon', daysAgo: 2 },
    { type: 'Pengeluaran', category: 'Perlengkapan', amount: 65000, desc: 'Beli Tisu Makan & Sedotan Kertas', daysAgo: 4 },
    { type: 'Pengeluaran', category: 'Kebersihan', amount: 45000, desc: 'Beli Sabun Cuci Piring & Karbol Lantai', daysAgo: 6 },
    { type: 'Pengeluaran', category: 'Bahan Baku Darurat', amount: 90000, desc: 'Beli Es Batu Kristal 6 sak', daysAgo: 7 },
    { type: 'Pemasukan', category: 'Modal Kasir', amount: 500000, desc: 'Penambahan Kas Float Laci Toko', daysAgo: 10 }
  ];

  for (const cf of cashFlowsData) {
    await prisma.cashFlow.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId,
        type: cf.type,
        category: cf.category,
        amount: cf.amount,
        description: cf.desc,
        date: getDate(cf.daysAgo, 9, 30),
        status: 'APPROVED',
        cashPocket: 'LACI_KASIR'
      }
    });
  }
  console.log(`✅ ${cashFlowsData.length} Entri Kas Kecil Operasional tercatat`);

  // =============================================
  // 12. FOOD WASTE & SHIFT KASIR AKTIF
  // =============================================
  console.log('\n🗑️  [12/12] Menambahkan Food Waste Log & Shift Kasir...');
  const allIngredients = await prisma.ingredient.findMany({ where: { tenantId: tenant.id } });
  const freshMilk = allIngredients.find(i => i.name.includes('Fresh Milk'));
  const pisang = allIngredients.find(i => i.name.includes('Pisang'));

  if (freshMilk) {
    await prisma.wasteLog.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        outlet: { connect: { id: outlet.id } },
        user: userId ? { connect: { id: userId } } : undefined,
        type: 'INGREDIENT',
        ingredient: { connect: { id: freshMilk.id } },
        itemName: freshMilk.name,
        category: 'DRINK',
        qty: 1000,
        unit: freshMilk.unit,
        costPerUnit: freshMilk.buyPrice,
        totalCost: 1000 * freshMilk.buyPrice,
        reason: 'Expired / Basi',
        notes: 'Kemasan kembung tersisa dari shift lalu',
        userName: 'Barista Staff',
        createdAt: getDate(2, 8, 30)
      }
    });
  }

  if (pisang) {
    await prisma.wasteLog.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        outlet: { connect: { id: outlet.id } },
        user: userId ? { connect: { id: userId } } : undefined,
        type: 'INGREDIENT',
        ingredient: { connect: { id: pisang.id } },
        itemName: pisang.name,
        category: 'FOOD',
        qty: 4,
        unit: pisang.unit,
        costPerUnit: pisang.buyPrice,
        totalCost: 4 * pisang.buyPrice,
        reason: 'Rusak / Busuk',
        notes: 'Pisang kepok terlalu lunak/hitam',
        userName: 'Kitchen Staff',
        createdAt: getDate(5, 9, 0)
      }
    });
  }

  // Shift Kasir Aktif
  await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      userId,
      waktuBuka: getDate(0, 8, 0),
      saldoAwal: 150000,
      status: 'Open'
    }
  });
  console.log('✅ Waste Logs & Sesi Shift Kasir Aktif (Open) siap');

  // =============================================
  // SUMMARY
  // =============================================
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  🎉 SEED DEMO CAFE & RESTO BERHASIL DISELESAIKAN SECARA LENGKAP!  ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Tenant         : ${tenant.name} (${tenant.slug})`);
  console.log('║  Outlet         : Kopinusa Cafe - Pusat');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log('║  ☕ Kategori     : 4 Utama, 4 Subkategori (Total 8)');
  console.log('║  🍽️  Menu         : 15 produk + foto real');
  console.log('║  🧂 Bahan Baku   : 21 items (minuman, makanan, packaging)');
  console.log('║  📋 Resep HPP    : 15 resep 100% lengkap BOM + Packaging');
  console.log('║  🪑 Meja         : 8 meja (denah layout visual, 2 live terisi)');
  console.log('║  👤 Member CRM   : 5 pelanggan member (Gold/Silver/Bronze)');
  console.log('║  📈 Transaksi POS: 32 orders historis 14 hari + 2 active orders');
  console.log('║  💵 Petty Cash   : 7 entri kas operasional laci');
  console.log('║  🗑️  Food Waste   : 2 log kerugian bahan baku');
  console.log('║  🕒 Shift Kasir  : 1 Sesi Shift Open (Modal Rp150.000)');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log('║  HPP HIGHLIGHTS:');
  console.log('║  - Es Kopi Susu  : HPP Rp9.085  → Jual Rp28.000 (Margin 67,6%)');
  console.log('║  - Matcha Latte  : HPP Rp15.900 → Jual Rp42.000 (Margin 62,1%)');
  console.log('║  - Nasi Goreng Sp: HPP Rp18.100 → Jual Rp45.000 (Margin 59,8%)');
  console.log('║  - Pisang Goreng : HPP Rp10.440 → Jual Rp20.000 (Margin 47,8%)');
  console.log('║  - Butter Croiss : HPP Rp12.700 → Jual Rp28.000 (Margin 54,6%)');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding cafe demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
