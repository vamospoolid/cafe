/**
 * seed_laundry_demo.ts
 * ==========================================
 * Script untuk mengisi data demo komprehensif ke tenant LAUNDRY (FreshClean Laundry & Care - laundry1)
 * Berisi:
 * 1. Profil bisnis laundry & settings struk resmi
 * 2. Outlet & nomor rak simpan cucian (RAK-A1, HANGER-01, RAK-S1, dll)
 * 3. Supplier distributor deterjen, pelembut & bibit parfum
 * 4. Bahan baku operasional (Ingredient: Deterjen curah, softener, varian parfum, plastik HD, LPG)
 * 5. Kategori layanan cuci (Kiloan, Kilat/Express, Satuan/Gamis/Jas, Sepatu/Tas, Bedcover)
 * 6. Katalog layanan cuci (Product) lengkap dengan foto HD:
 *    - Paket Kiloan (Reguler, Lipat, Setrika)
 *    - Paket Kilat & Express (24 Jam, 6 Jam)
 *    - Paket Satuan Busana Khusus (Gamis Syar'i, Jas Pria, Gaun Pesta, Koko, Mukena)
 *    - Paket Perawatan Sepatu & Tas (Deep Clean Sneakers, Leather Shoes, Backpack)
 *    - Paket Bedcover & Linen (King Size, Single, Selimut Bulu, Gorden)
 * 7. Pelanggan langganan setia dengan kontak WA
 * 8. Sampel order cucian aktif di Kanban Board (RECEIVED, WASHING, IRONING, READY, COMPLETED)
 *
 * Jalankan: npx tsx prisma/seed_laundry_demo.ts
 * ==========================================
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LAUNDRY_TENANT_SLUG = 'laundry1';

async function main() {
  console.log('\n🧺 ================================================');
  console.log('   SEED DEMO DATA - FRESHCLEAN LAUNDRY & CARE');
  console.log('================================================\n');

  // --- 1. Ambil Tenant ---
  const tenant = await prisma.tenant.findUnique({ where: { slug: LAUNDRY_TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`❌ Tenant dengan slug "${LAUNDRY_TENANT_SLUG}" tidak ditemukan.`);
  }
  console.log(`✅ Tenant ditemukan: [${tenant.id}] ${tenant.name}`);

  // Update Profil Tenant & Settings
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: 'FreshClean Laundry & Care',
      businessType: 'LAUNDRY',
      logoUrl: '/logo-laundry.png'
    }
  });

  const existingSettings = await prisma.settings.findFirst({ where: { tenantId: tenant.id } });
  const settingsData = {
    storeName: 'FreshClean Laundry & Care',
    address: 'Jl. Boulevard Raya Blok LA-08, Kelapa Gading, Jakarta Utara',
    phone: '0812-9988-7766',
    logoUrl: '/logo-laundry.png',
    receiptHeader: 'FRESHCLEAN LAUNDRY & DRY CLEANING\nKiloan Bersih Wangi, Satuan, Sepatu, Gamis & Bedcover\nJaminan Higienis, Rapi & Tepat Waktu',
    receiptFooter: '1. Komplain maksimal 1x24 jam sejak barang diambil.\n2. Cucian tidak diambil > 30 hari di luar tanggung jawab kami.\nTerima kasih atas kepercayaan Anda!'
  };

  if (existingSettings) {
    await prisma.settings.update({
      where: { id: existingSettings.id },
      data: settingsData
    });
  } else {
    await prisma.settings.create({
      data: {
        tenantId: tenant.id,
        ...settingsData
      }
    });
  }
  console.log('✅ Settings profil & header nota laundry diperbarui');

  // --- 2. Outlet ---
  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'FreshClean - Outlet Pusat Kelapa Gading',
        code: 'FCL-01',
        address: 'Jl. Boulevard Raya Blok LA-08, Kelapa Gading, Jakarta Utara',
        status: 'ACTIVE'
      }
    });
  }

  // =============================================
  // 3. BERSIHKAN DATA LAMA
  // =============================================
  console.log('\n🧹 [1/7] Membersihkan data laundry lama...');
  await prisma.laundryOrderItem.deleteMany({ where: { order: { tenantId: tenant.id } } });
  await prisma.laundryOrder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.orderItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.productUOM.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.productPriceTier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.recipeItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.wasteLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.ingredientLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.purchaseOrderItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.table.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.ingredient.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.supplier.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  console.log('✅ Data lama laundry berhasil dibersihkan');

  // =============================================
  // 4. RAK SIMPAN & GANTUNGAN (Table Model)
  // =============================================
  console.log('\n🏷️ [2/7] Menyiapkan Nomor Rak Simpan & Gantungan...');
  const tablesData = [
    { tableNo: 'RAK-A1', name: 'Rak A1 (Kiloan Reguler)', capacity: 10 },
    { tableNo: 'RAK-A2', name: 'Rak A2 (Kiloan Reguler)', capacity: 10 },
    { tableNo: 'RAK-B1', name: 'Rak B1 (Kiloan Kilat & Express)', capacity: 8 },
    { tableNo: 'RAK-B2', name: 'Rak B2 (Kiloan Kilat & Express)', capacity: 8 },
    { tableNo: 'HANGER-01', name: 'Gantungan Gamis, Jas & Gaun', capacity: 15 },
    { tableNo: 'HANGER-02', name: 'Gantungan Bedcover & Selimut', capacity: 12 },
    { tableNo: 'RAK-S1', name: 'Rak Sepatu & Tas Bersih', capacity: 10 }
  ];

  for (const t of tablesData) {
    await prisma.table.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        tableNo: t.tableNo,
        name: t.name,
        capacity: t.capacity,
        status: 'KOSONG'
      }
    });
  }
  console.log(`✅ ${tablesData.length} Rak simpan & hanger laundry dibuat`);

  // =============================================
  // 5. SUPPLIER DISTRIBUTOR KIMIA & PACKAGING
  // =============================================
  console.log('\n🏭 [3/7] Menyiapkan Supplier Distributor Laundry...');
  const supKimia = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'PT Sabun Bersih Sejahtera (Distributor Deterjen)',
      contact: 'Bapak Hartono',
      phone: '0812-4455-6677',
      email: 'sales@sabunbersih.co.id',
      address: 'Kawasan Industri Marunda, Jakarta Utara',
      notes: 'Distributor deterjen oxy konsentrat, softener antibakteri, dan anti-noda'
    }
  });

  const supParfum = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'CV Aroma Wangi Parfumerie (Bibit Parfum Laundry)',
      contact: 'Ibu Sarah',
      phone: '0813-8899-0011',
      email: 'order@aromawangi.com',
      address: 'Sentra Grosir Parfumerie Glodok, Jakarta Barat',
      notes: 'Penyuplai parfum grade A: Sakura Blossom, Akasia Wood, Ocean Fresh'
    }
  });

  const supKemasan = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Toko Plastik & Perlengkapan Makmur Abadi',
      contact: 'Koh Hendra',
      phone: '0811-3322-1100',
      address: 'Pasar Pagi Mangga Dua, Jakarta Utara',
      notes: 'Supplier plastik jinjing tebal HD size M/L/Jumbo, hanger, dan lakban laundry'
    }
  });
  console.log('✅ 3 Supplier resmi laundry dibuat');

  // =============================================
  // 6. BAHAN BAKU OPERASIONAL (Ingredients)
  // =============================================
  console.log('\n🧪 [4/7] Menambahkan Bahan Baku Kimia & Kemasan...');
  const ingredientsData = [
    { name: 'Deterjen Cair Konsentrat Super Oxy', category: 'OTHER', unit: 'liter', stock: 65, minStock: 10, buyPrice: 12000, supplierId: supKimia.id },
    { name: 'Softener / Pelembut Blue Fresh Antibakteri', category: 'OTHER', unit: 'liter', stock: 45, minStock: 10, buyPrice: 15000, supplierId: supKimia.id },
    { name: 'Parfum Laundry Aroma Sakura Blossom', category: 'OTHER', unit: 'liter', stock: 25, minStock: 5, buyPrice: 28000, supplierId: supParfum.id },
    { name: 'Parfum Laundry Aroma Akasia Wood', category: 'OTHER', unit: 'liter', stock: 25, minStock: 5, buyPrice: 28000, supplierId: supParfum.id },
    { name: 'Parfum Laundry Aroma Ocean Fresh', category: 'OTHER', unit: 'liter', stock: 25, minStock: 5, buyPrice: 28000, supplierId: supParfum.id },
    { name: 'Cairan Penghilang Noda Kerah & Karat (Spotter)', category: 'OTHER', unit: 'liter', stock: 12, minStock: 2, buyPrice: 35000, supplierId: supKimia.id },
    { name: 'Plastik Jinjing HD Size L (Pack/50lbr)', category: 'PACKAGING', unit: 'pack', stock: 45, minStock: 5, buyPrice: 18000, supplierId: supKemasan.id },
    { name: 'Plastik Jinjing Jumbo Bedcover (Pack/25lbr)', category: 'PACKAGING', unit: 'pack', stock: 30, minStock: 5, buyPrice: 25000, supplierId: supKemasan.id },
    { name: 'Hanger Plastik Hitam Tebal', category: 'PACKAGING', unit: 'buah', stock: 300, minStock: 50, buyPrice: 1200, supplierId: supKemasan.id },
    { name: 'Gas LPG 12 Kg (Pemanas Dryer Pengering)', category: 'OTHER', unit: 'tabung', stock: 4, minStock: 1, buyPrice: 185000, supplierId: supKimia.id }
  ];

  for (const ing of ingredientsData) {
    await prisma.ingredient.create({
      data: {
        tenantId: tenant.id,
        ...ing
      }
    });
  }
  console.log(`✅ ${ingredientsData.length} Bahan baku kimia & kemasan laundry dibuat`);

  // =============================================
  // 7. KATEGORI LAYANAN CUCI
  // =============================================
  console.log('\n📂 [5/7] Menyiapkan Kategori Layanan Laundry...');
  const catKiloan = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Cuci Kiloan Reguler', icon: '🧺', color: '#0284c7', sortOrder: 1, isActive: true }
  });

  const catExpress = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Cuci Kilat & Express', icon: '⚡', color: '#f59e0b', sortOrder: 2, isActive: true }
  });

  const catSatuan = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Cuci Satuan & Busana Khusus', icon: '👗', color: '#ec4899', sortOrder: 3, isActive: true }
  });

  const catSepatu = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Perawatan Sepatu & Tas', icon: '👟', color: '#8b5cf6', sortOrder: 4, isActive: true }
  });

  const catBedcover = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Bedcover, Selimut & Linen', icon: '🛏️', color: '#10b981', sortOrder: 5, isActive: true }
  });
  console.log('✅ 5 Kategori layanan cuci laundry dibuat');

  // =============================================
  // 8. KATALOG PRODUK / LAYANAN DENGAN GAMBAR HD
  // =============================================
  console.log('\n👗 [6/7] Menambahkan Katalog Layanan Cuci Komplit...');
  const productsData = [
    // --- CUCI KILOAN REGULER ---
    {
      categoryId: catKiloan.id,
      name: 'Cuci Kering Setrika (Reguler 2 Hari)',
      barcode: 'LD-001',
      baseUom: 'KG',
      buyPrice: 2200,
      sellPrice: 7000,
      sellPriceRetail: 7000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/kiloan.jpg',
      storageLocation: 'RAK-A1',
      status: 'Aktif'
    },
    {
      categoryId: catKiloan.id,
      name: 'Cuci Kering Lipat (Non Setrika)',
      barcode: 'LD-002',
      baseUom: 'KG',
      buyPrice: 1500,
      sellPrice: 5000,
      sellPriceRetail: 5000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/kiloan.jpg',
      storageLocation: 'RAK-A1',
      status: 'Aktif'
    },
    {
      categoryId: catKiloan.id,
      name: 'Setrika Uap Rapi Saja',
      barcode: 'LD-003',
      baseUom: 'KG',
      buyPrice: 1000,
      sellPrice: 4500,
      sellPriceRetail: 4500,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/kiloan.jpg',
      storageLocation: 'RAK-A2',
      status: 'Aktif'
    },

    // --- CUCI KILAT & EXPRESS ---
    {
      categoryId: catExpress.id,
      name: 'Cuci Kering Setrika Kilat (24 Jam)',
      barcode: 'LD-004',
      baseUom: 'KG',
      buyPrice: 2500,
      sellPrice: 10000,
      sellPriceRetail: 10000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/kiloan.jpg',
      storageLocation: 'RAK-B1',
      status: 'Aktif'
    },
    {
      categoryId: catExpress.id,
      name: 'Cuci Super Express (6 Jam Selesai)',
      barcode: 'LD-005',
      baseUom: 'KG',
      buyPrice: 3500,
      sellPrice: 15000,
      sellPriceRetail: 15000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/kiloan.jpg',
      storageLocation: 'RAK-B2',
      status: 'Aktif'
    },

    // --- CUCI SATUAN & BUSANA KHUSUS (GAMIS, JAS, GAUN) ---
    {
      categoryId: catSatuan.id,
      name: "Gamis Syar'i / Abaya Bordir (Dry Clean & Uap)",
      barcode: 'LD-006',
      baseUom: 'PCS',
      buyPrice: 5000,
      sellPrice: 25000,
      sellPriceRetail: 25000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/gamis.jpg',
      storageLocation: 'HANGER-01',
      status: 'Aktif'
    },
    {
      categoryId: catSatuan.id,
      name: 'Jas Pria Executive / Blazer Kerja',
      barcode: 'LD-007',
      baseUom: 'PCS',
      buyPrice: 7500,
      sellPrice: 35000,
      sellPriceRetail: 35000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/jas.jpg',
      storageLocation: 'HANGER-01',
      status: 'Aktif'
    },
    {
      categoryId: catSatuan.id,
      name: 'Gaun Pesta Mewah / Dress Brokat',
      barcode: 'LD-008',
      baseUom: 'PCS',
      buyPrice: 9000,
      sellPrice: 45000,
      sellPriceRetail: 45000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/gamis.jpg',
      storageLocation: 'HANGER-01',
      status: 'Aktif'
    },
    {
      categoryId: catSatuan.id,
      name: 'Baju Muslim / Koko Sutera Pria',
      barcode: 'LD-009',
      baseUom: 'PCS',
      buyPrice: 3500,
      sellPrice: 18000,
      sellPriceRetail: 18000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/gamis.jpg',
      storageLocation: 'HANGER-01',
      status: 'Aktif'
    },
    {
      categoryId: catSatuan.id,
      name: 'Mukena Sutera / Renda Bordir Premium',
      barcode: 'LD-010',
      baseUom: 'PCS',
      buyPrice: 4500,
      sellPrice: 22000,
      sellPriceRetail: 22000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/gamis.jpg',
      storageLocation: 'HANGER-01',
      status: 'Aktif'
    },

    // --- PERAWATAN SEPATU & TAS ---
    {
      categoryId: catSepatu.id,
      name: 'Deep Clean Sneakers & Canvas Shoes',
      barcode: 'LD-011',
      baseUom: 'PCS',
      buyPrice: 7000,
      sellPrice: 35000,
      sellPriceRetail: 35000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/sepatu.jpg',
      storageLocation: 'RAK-S1',
      status: 'Aktif'
    },
    {
      categoryId: catSepatu.id,
      name: 'Cuci & Semir Sepatu Kulit Formal (Leather Care)',
      barcode: 'LD-012',
      baseUom: 'PCS',
      buyPrice: 10000,
      sellPrice: 50000,
      sellPriceRetail: 50000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/sepatu.jpg',
      storageLocation: 'RAK-S1',
      status: 'Aktif'
    },
    {
      categoryId: catSepatu.id,
      name: 'Cuci Tas Ransel / Backpack Casual',
      barcode: 'LD-013',
      baseUom: 'PCS',
      buyPrice: 5000,
      sellPrice: 25000,
      sellPriceRetail: 25000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/tas.jpg',
      storageLocation: 'RAK-S1',
      status: 'Aktif'
    },

    // --- BEDCOVER, SELIMUT & LINEN ---
    {
      categoryId: catBedcover.id,
      name: 'Bedcover King Size / Jumbo',
      barcode: 'LD-014',
      baseUom: 'PCS',
      buyPrice: 6000,
      sellPrice: 25000,
      sellPriceRetail: 25000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/bedcover.jpg',
      storageLocation: 'HANGER-02',
      status: 'Aktif'
    },
    {
      categoryId: catBedcover.id,
      name: 'Bedcover Single Size',
      barcode: 'LD-015',
      baseUom: 'PCS',
      buyPrice: 5000,
      sellPrice: 20000,
      sellPriceRetail: 20000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/bedcover.jpg',
      storageLocation: 'HANGER-02',
      status: 'Aktif'
    },
    {
      categoryId: catBedcover.id,
      name: 'Selimut Bulu Tebal / Quilt Fleece',
      barcode: 'LD-016',
      baseUom: 'PCS',
      buyPrice: 4500,
      sellPrice: 18000,
      sellPriceRetail: 18000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/bedcover.jpg',
      storageLocation: 'HANGER-02',
      status: 'Aktif'
    },
    {
      categoryId: catBedcover.id,
      name: 'Gorden Vitrase & Hordeng (per Lembar)',
      barcode: 'LD-017',
      baseUom: 'PCS',
      buyPrice: 3500,
      sellPrice: 15000,
      sellPriceRetail: 15000,
      stock: 999,
      minStock: 10,
      imageUrl: '/images/laundry/bedcover.jpg',
      storageLocation: 'HANGER-02',
      status: 'Aktif'
    }
  ];

  for (const p of productsData) {
    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        ...p
      }
    });
  }
  console.log(`✅ ${productsData.length} Layanan cuci laundry berhasil dibuat dengan gambar HD`);

  // =============================================
  // 9. PELANGGAN SETIA & ORDER KANBAN AKTIF
  // =============================================
  console.log('\n👥 [7/7] Menyiapkan Pelanggan Loyal & Sampel Order Kanban...');
  const custRatna = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'dr. Ratna Anindita, Sp.A',
      phone: '081211223344',
      tier: 'Gold',
      totalSpent: 850000
    }
  });

  const custHendra = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Bapak Hendra Wijaya',
      phone: '081344556677',
      tier: 'Gold',
      totalSpent: 1200000
    }
  });

  const custClarissa = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Clarissa Putri',
      phone: '081788990011',
      tier: 'Silver',
      totalSpent: 320000
    }
  });

  const custBambang = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: 'Pak RT Bambang',
      phone: '081855667788',
      tier: 'Silver',
      totalSpent: 450000
    }
  });

  // --- SAMPEL TRANSAKSI LAUNDRY AKTIF ---
  // 1. Order READY (Siap Ambil di RAK-A1)
  await prisma.laundryOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      orderNumber: 'LD-202610-0001',
      customerId: custRatna.id,
      customerName: custRatna.name,
      customerPhone: custRatna.phone,
      serviceCategory: 'KILOAN',
      serviceSpeed: 'REGULAR',
      perfumeVariant: 'Sakura Fresh',
      rackLocation: 'RAK-A1',
      itemCountNotes: '14 potong pakaian harian',
      status: 'READY',
      subtotal: 31500,
      totalAmount: 31500,
      paidAmount: 31500,
      paymentStatus: 'PAID',
      paymentMethod: 'QRIS',
      readyAt: new Date(Date.now() - 3 * 3600 * 1000),
      items: {
        create: [
          {
            serviceName: 'Cuci Kering Setrika (Reguler 2 Hari)',
            unitType: 'KG',
            qty: 4.5,
            pricePerUnit: 7000,
            subtotal: 31500,
            notes: 'Aroma Sakura, baju putih pisahkan'
          }
        ]
      }
    }
  });

  // 2. Order IRONING (Sedang Disetrika di HANGER-01)
  await prisma.laundryOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      orderNumber: 'LD-202610-0002',
      customerId: custHendra.id,
      customerName: custHendra.name,
      customerPhone: custHendra.phone,
      serviceCategory: 'SATUAN',
      serviceSpeed: 'REGULAR',
      perfumeVariant: 'Akasia Manis',
      rackLocation: 'HANGER-01',
      hangerCount: 2,
      itemCountNotes: '1 Jas Pria Navy, 1 Gamis Sutera',
      status: 'IRONING',
      subtotal: 60000,
      totalAmount: 60000,
      paidAmount: 60000,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      estimatedDoneAt: new Date(Date.now() + 8 * 3600 * 1000),
      items: {
        create: [
          {
            serviceName: 'Jas Pria Executive / Blazer Kerja',
            unitType: 'PCS',
            qty: 1,
            pricePerUnit: 35000,
            subtotal: 35000,
            notes: 'Gantungan kayu bawaan customer'
          },
          {
            serviceName: "Gamis Syar'i / Abaya Bordir (Dry Clean & Uap)",
            unitType: 'PCS',
            qty: 1,
            pricePerUnit: 25000,
            subtotal: 25000,
            notes: 'Bahan sutera lembut, setrika uap saja'
          }
        ]
      }
    }
  });

  // 3. Order WASHING (Sedang Dicuci: Sneakers Deep Clean)
  await prisma.laundryOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      orderNumber: 'LD-202610-0003',
      customerId: custClarissa.id,
      customerName: custClarissa.name,
      customerPhone: custClarissa.phone,
      serviceCategory: 'SATUAN',
      serviceSpeed: 'REGULAR',
      perfumeVariant: 'Ocean Fresh',
      rackLocation: 'RAK-S1',
      itemCountNotes: '1 Pasang Nike Air Force 1 Putih',
      status: 'WASHING',
      subtotal: 35000,
      totalAmount: 35000,
      paidAmount: 35000,
      paymentStatus: 'PAID',
      paymentMethod: 'TRANSFER',
      estimatedDoneAt: new Date(Date.now() + 24 * 3600 * 1000),
      items: {
        create: [
          {
            serviceName: 'Deep Clean Sneakers & Canvas Shoes',
            unitType: 'PCS',
            qty: 1,
            pricePerUnit: 35000,
            subtotal: 35000,
            notes: 'Unyellowing sol bawah'
          }
        ]
      }
    }
  });

  // 4. Order RECEIVED (Baru Masuk Kasir - Kiloan Express 6 Jam, Belum Bayar)
  await prisma.laundryOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      orderNumber: 'LD-202610-0004',
      customerId: custBambang.id,
      customerName: custBambang.name,
      customerPhone: custBambang.phone,
      serviceCategory: 'KILOAN',
      serviceSpeed: 'EXPRESS_6H',
      perfumeVariant: 'Sakura Fresh',
      rackLocation: 'RAK-B1',
      itemCountNotes: '10 potong kemeja kantor',
      status: 'RECEIVED',
      subtotal: 48000,
      speedSurcharge: 24000,
      totalAmount: 72000,
      paidAmount: 0,
      paymentStatus: 'UNPAID',
      paymentMethod: 'CASH',
      estimatedDoneAt: new Date(Date.now() + 5 * 3600 * 1000),
      items: {
        create: [
          {
            serviceName: 'Cuci Super Express (6 Jam Selesai)',
            unitType: 'KG',
            qty: 3.2,
            pricePerUnit: 15000,
            subtotal: 48000,
            notes: 'Bayar saat ambil nanti sore'
          }
        ]
      }
    }
  });

  // 5. Order COMPLETED (Sudah Selesai & Diambil Kemarin)
  await prisma.laundryOrder.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      orderNumber: 'LD-202610-0005',
      customerId: custRatna.id,
      customerName: custRatna.name,
      customerPhone: custRatna.phone,
      serviceCategory: 'SATUAN',
      serviceSpeed: 'REGULAR',
      perfumeVariant: 'Akasia Manis',
      rackLocation: 'HANGER-02',
      hangerCount: 1,
      itemCountNotes: '1 Bedcover King Jumbo + 1 Selimut Tebal',
      status: 'COMPLETED',
      subtotal: 43000,
      totalAmount: 43000,
      paidAmount: 43000,
      paymentStatus: 'PAID',
      paymentMethod: 'QRIS',
      readyAt: new Date(Date.now() - 48 * 3600 * 1000),
      completedAt: new Date(Date.now() - 24 * 3600 * 1000),
      items: {
        create: [
          {
            serviceName: 'Bedcover King Size / Jumbo',
            unitType: 'PCS',
            qty: 1,
            pricePerUnit: 25000,
            subtotal: 25000,
            notes: 'Packing plastik jumbo bedcover'
          },
          {
            serviceName: 'Selimut Bulu Tebal / Quilt Fleece',
            unitType: 'PCS',
            qty: 1,
            pricePerUnit: 18000,
            subtotal: 18000,
            notes: 'Wangi Akasia tahan lama'
          }
        ]
      }
    }
  });

  console.log('✅ 5 Sampel transaksi laundry dengan berbagai status alur pipeline berhasil dibuat');

  console.log('\n🎉 ================================================');
  console.log('   SEED DEMO LAUNDRY (FRESHCLEAN) SELESAI!');
  console.log('   17 Layanan (Kiloan, Gamis, Jas, Sepatu, Bedcover) siap!');
  console.log('================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Laundry demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
