import prisma from '../db';

// Helper emit aman tanpa crash jika dijalankan di context CLI/script
function safeEmit(tenantId: string, event: string, payload: any) {
  try {
    const serverMod = require('../index');
    if (serverMod && typeof serverMod.emitToTenant === 'function') {
      serverMod.emitToTenant(tenantId, event, payload);
    }
  } catch (_) {}
}

/**
 * DemoSeederService.ts
 * ============================================================================
 * Universal Multi-Vertical Data Seeder for CodePOS SaaS
 * Mendukung injeksi data demo komprehensif, realistis, dan ber-HPP akurat untuk:
 * 1. CAFE / RESTO (Menu Lengkap, HPP, Bahan Baku, Resep BOM, Meja, Supplier)
 * 2. RETAIL / GROSIR (Sembako, Multi-Satuan UOM, 3-Tier Price, Rak Gudang, Bon Tempo)
 * 3. RENTAL / SEWA BUSANA (Attire Lengkap + Gambar Estetik HD, Ukuran, Tarif & Deposit)
 * 4. LAUNDRY (Paket Kiloan, Satuan, Kimia Operasional, Varian Parfum, Rak Simpan)
 * 5. BENGKEL (Jasa Servis, Oli, Sparepart Fast Moving, Pit Stall, Mekanik Komisi)
 * ============================================================================
 */

export class DemoSeederService {
  /**
   * ──────────────────────────────────────────────────────────────────────────
   * 1. SEEDER: RESTO & CAFE
   * ──────────────────────────────────────────────────────────────────────────
   */
  static async seedCafeDemo(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant dengan ID ${tenantId} tidak ditemukan`);

    // 1. Pastikan Profil Tenant & Settings
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType: 'CAFE' }
    });

    const settingsData = {
      storeName: tenant.name || 'MUKI Ramen & Artisanal Cafe',
      phone: tenant.phone || '0812-9876-5432',
      address: 'Jl. Kesadaran No. 3, Sidorejo',
      taxRate: 10,
      serviceCharge: 5,
      receiptHeader: `${tenant.name.toUpperCase()}\nJapanese Ramen Bar & Specialty Coffee\nJl. Kesadaran No. 3, Sidorejo`,
      receiptFooter: 'Arigatou Gozaimasu!\nTerima Kasih Atas Kunjungan Anda\nFollow IG: @mukiramen.id',
      enableKDS: true,
      autoCompleteKDSOnPay: false,
      ingredientTrackingEnabled: true,
      enableDrinkCustomization: true,
      enableKitchenAuditMode: true
    };

    const existSettings = await prisma.settings.findFirst({ where: { tenantId } });
    if (existSettings) {
      await prisma.settings.update({ where: { id: existSettings.id }, data: settingsData });
    } else {
      await prisma.settings.create({ data: { tenantId, ...settingsData } });
    }

    // 2. Setup Outlet
    let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant.name} - Outlet Utama`,
          code: 'OUT-01',
          address: 'Jl. Kesadaran No. 3, Sidorejo',
          status: 'ACTIVE'
        }
      });
    }

    // 3. Setup Layout Meja Resto
    const tablesData = [
      { tableNo: '01', name: 'Meja Depan Kaca 1', capacity: 2, posX: 15, posY: 20, shape: 'square' },
      { tableNo: '02', name: 'Meja Depan Kaca 2', capacity: 2, posX: 35, posY: 20, shape: 'square' },
      { tableNo: '03', name: 'Meja Tengah Family 3', capacity: 4, posX: 60, posY: 20, shape: 'square' },
      { tableNo: '04', name: 'Meja Tengah Family 4', capacity: 4, posX: 80, posY: 20, shape: 'square' },
      { tableNo: '05', name: 'Booth VIP Ramen 5', capacity: 6, posX: 15, posY: 65, shape: 'square' },
      { tableNo: '06', name: 'Booth VIP Ramen 6', capacity: 6, posX: 40, posY: 65, shape: 'square' },
      { tableNo: 'BAR-1', name: 'Bar Counter Seat 1', capacity: 1, posX: 68, posY: 70, shape: 'circle' },
      { tableNo: 'BAR-2', name: 'Bar Counter Seat 2', capacity: 1, posX: 82, posY: 70, shape: 'circle' }
    ];

    for (const tb of tablesData) {
      const exist = await prisma.table.findFirst({ where: { tenantId, tableNo: tb.tableNo } });
      if (!exist) {
        await prisma.table.create({
          data: {
            tenantId,
            outletId: outlet.id,
            tableNo: tb.tableNo,
            name: tb.name,
            capacity: tb.capacity,
            status: 'Aktif',
            posX: tb.posX,
            posY: tb.posY,
            shape: tb.shape
          }
        });
      }
    }

    // 4. Setup Supplier Cafe
    const suppliers = [
      { name: 'PT Sumber Kopi Nusantara', phone: '0811-2233-4455', address: 'Kawasan Pergudangan Pluit Blok C-12' },
      { name: 'Distributor Daging & Unggas Segar', phone: '0812-3344-5566', address: 'Pasar Senen Blok III Lt. 2' },
      { name: 'Toko Bahan Kue & Dairy Sejahtera', phone: '0813-4455-6677', address: 'Jl. Hayam Wuruk No. 88' }
    ];

    const supMap = new Map<string, number>();
    for (const sup of suppliers) {
      let s = await prisma.supplier.findFirst({ where: { tenantId, name: sup.name } });
      if (!s) {
        s = await prisma.supplier.create({
          data: { tenantId, name: sup.name, phone: sup.phone, address: sup.address }
        });
      }
      supMap.set(sup.name, s.id);
    }

    // 5. Setup Bahan Baku (Ingredients) Lengkap
    const ingredients = [
      { name: 'Biji Kopi Arabica Gayo', category: 'DRINK', unit: 'gram', stock: 10000, minStock: 1500, buyPrice: 240, sup: 'PT Sumber Kopi Nusantara' },
      { name: 'Fresh Milk Diamond', category: 'DRINK', unit: 'ml', stock: 30000, minStock: 5000, buyPrice: 18, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Sirup Gula Aren Organik', category: 'DRINK', unit: 'ml', stock: 12000, minStock: 2000, buyPrice: 25, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Matcha Uji Premium', category: 'DRINK', unit: 'gram', stock: 3000, minStock: 400, buyPrice: 160, sup: 'PT Sumber Kopi Nusantara' },
      { name: 'Cokelat Powder Belgia', category: 'DRINK', unit: 'gram', stock: 4000, minStock: 500, buyPrice: 120, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Sirup Lychee Artisan', category: 'DRINK', unit: 'ml', stock: 5000, minStock: 500, buyPrice: 45, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Es Batu Kristal Higienis', category: 'DRINK', unit: 'gram', stock: 75000, minStock: 10000, buyPrice: 3, sup: 'PT Sumber Kopi Nusantara' },
      { name: 'Mie Ramen Fresh Hakata', category: 'FOOD', unit: 'gram', stock: 20000, minStock: 3000, buyPrice: 15, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Kaldu Tori Paitan Kental', category: 'FOOD', unit: 'ml', stock: 45000, minStock: 8000, buyPrice: 20, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Shoyu Tare Saus Jepang', category: 'FOOD', unit: 'ml', stock: 10000, minStock: 1500, buyPrice: 40, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Miso Paste Spesial', category: 'FOOD', unit: 'gram', stock: 6000, minStock: 800, buyPrice: 35, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Chashu Ayam Slice', category: 'FOOD', unit: 'pcs', stock: 500, minStock: 60, buyPrice: 3500, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Ajitsuke Tamago (Telur Ramen)', category: 'FOOD', unit: 'pcs', stock: 350, minStock: 40, buyPrice: 2500, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Nori Seaweed Crispy', category: 'FOOD', unit: 'pcs', stock: 800, minStock: 100, buyPrice: 800, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Kulit & Isian Gyoza Ayam', category: 'FOOD', unit: 'pcs', stock: 400, minStock: 50, buyPrice: 1500, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Beras Japonica Premium', category: 'FOOD', unit: 'gram', stock: 30000, minStock: 4000, buyPrice: 16, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Daging Ayam Fillet Katsu', category: 'FOOD', unit: 'gram', stock: 15000, minStock: 2000, buyPrice: 65, sup: 'Distributor Daging & Unggas Segar' },
      { name: 'Kentang Shoestring Truffle', category: 'FOOD', unit: 'gram', stock: 12000, minStock: 1500, buyPrice: 35, sup: 'Toko Bahan Kue & Dairy Sejahtera' },
      { name: 'Croissant French Dough', category: 'FOOD', unit: 'pcs', stock: 100, minStock: 20, buyPrice: 8500, sup: 'Toko Bahan Kue & Dairy Sejahtera' }
    ];

    const ingMap = new Map<string, number>();
    for (const ing of ingredients) {
      let item = await prisma.ingredient.findFirst({ where: { tenantId, name: ing.name } });
      const supId = supMap.get(ing.sup);
      if (!item) {
        item = await prisma.ingredient.create({
          data: {
            tenantId,
            name: ing.name,
            category: ing.category,
            unit: ing.unit,
            stock: ing.stock,
            minStock: ing.minStock,
            buyPrice: ing.buyPrice,
            supplierId: supId
          }
        });
      } else {
        await prisma.ingredient.update({
          where: { id: item.id },
          data: { stock: ing.stock, buyPrice: ing.buyPrice, unit: ing.unit, minStock: ing.minStock }
        });
      }
      ingMap.set(ing.name, item.id);
    }

    // 6. Setup Kategori Menu dengan Target Station KDS
    const categories = [
      { name: 'Signature Ramen', icon: '🍜', color: '#ef4444', stationTarget: 'KITCHEN', printerTarget: 'KITCHEN', sortOrder: 1 },
      { name: 'Japanese Rice Bowl', icon: '🍛', color: '#f97316', stationTarget: 'KITCHEN', printerTarget: 'KITCHEN', sortOrder: 2 },
      { name: 'Side Dishes & Gyoza', icon: '🥟', color: '#f59e0b', stationTarget: 'KITCHEN', printerTarget: 'KITCHEN', sortOrder: 3 },
      { name: 'Specialty Coffee Bar', icon: '☕', color: '#6366f1', stationTarget: 'BAR', printerTarget: 'BAR', sortOrder: 4 },
      { name: 'Artisan Mocktails & Tea', icon: '🍵', color: '#10b981', stationTarget: 'BAR', printerTarget: 'BAR', sortOrder: 5 },
      { name: 'Pastry & Sweet Dessert', icon: '🍮', color: '#ec4899', stationTarget: 'DESSERT', printerTarget: 'PASTRY', sortOrder: 6 }
    ];

    const catMap = new Map<string, number>();
    for (const cat of categories) {
      let c = await prisma.category.findFirst({ where: { tenantId, name: cat.name } });
      if (!c) {
        c = await prisma.category.create({
          data: {
            tenantId,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            stationTarget: cat.stationTarget,
            printerTarget: cat.printerTarget,
            sortOrder: cat.sortOrder
          }
        });
      }
      catMap.set(cat.name, c.id);
    }

    // 7. Setup Produk Menu Lengkap + Resep BOM HPP
    const products = [
      {
        name: 'Tori Paitan Ramen Signature',
        category: 'Signature Ramen',
        sellPrice: 38000,
        imageUrl: '/images/ramen_signature.png',
        recipes: [
          { ing: 'Mie Ramen Fresh Hakata', qty: 150 },
          { ing: 'Kaldu Tori Paitan Kental', qty: 300 },
          { ing: 'Shoyu Tare Saus Jepang', qty: 30 },
          { ing: 'Chashu Ayam Slice', qty: 2 },
          { ing: 'Ajitsuke Tamago (Telur Ramen)', qty: 1 },
          { ing: 'Nori Seaweed Crispy', qty: 2 }
        ]
      },
      {
        name: 'Spicy Miso Ramen Spesial',
        category: 'Signature Ramen',
        sellPrice: 42000,
        imageUrl: '/images/ramen_signature.png',
        recipes: [
          { ing: 'Mie Ramen Fresh Hakata', qty: 150 },
          { ing: 'Kaldu Tori Paitan Kental', qty: 300 },
          { ing: 'Miso Paste Spesial', qty: 40 },
          { ing: 'Chashu Ayam Slice', qty: 2 },
          { ing: 'Ajitsuke Tamago (Telur Ramen)', qty: 1 }
        ]
      },
      {
        name: 'Shoyu Chashu Ramen',
        category: 'Signature Ramen',
        sellPrice: 36000,
        imageUrl: '/images/ramen_signature.png',
        recipes: [
          { ing: 'Mie Ramen Fresh Hakata', qty: 150 },
          { ing: 'Kaldu Tori Paitan Kental', qty: 280 },
          { ing: 'Shoyu Tare Saus Jepang', qty: 35 },
          { ing: 'Chashu Ayam Slice', qty: 3 }
        ]
      },
      {
        name: 'Chicken Katsu Curry Don',
        category: 'Japanese Rice Bowl',
        sellPrice: 35000,
        imageUrl: '/images/nasi_goreng.png',
        recipes: [
          { ing: 'Beras Japonica Premium', qty: 180 },
          { ing: 'Daging Ayam Fillet Katsu', qty: 130 },
          { ing: 'Shoyu Tare Saus Jepang', qty: 20 }
        ]
      },
      {
        name: 'Gyoza Panggang Gurih (5 Pcs)',
        category: 'Side Dishes & Gyoza',
        sellPrice: 22000,
        imageUrl: '/images/gyoza_karaage.png',
        recipes: [
          { ing: 'Kulit & Isian Gyoza Ayam', qty: 5 },
          { ing: 'Shoyu Tare Saus Jepang', qty: 15 }
        ]
      },
      {
        name: 'French Fries Truffle Mayo',
        category: 'Side Dishes & Gyoza',
        sellPrice: 20000,
        imageUrl: '/images/mushroom_quiche.png',
        recipes: [
          { ing: 'Kentang Shoestring Truffle', qty: 150 }
        ]
      },
      {
        name: 'Es Kopi Susu Aren Special',
        category: 'Specialty Coffee Bar',
        sellPrice: 18000,
        imageUrl: '/images/es_kopi_susu.png',
        recipes: [
          { ing: 'Biji Kopi Arabica Gayo', qty: 18 },
          { ing: 'Fresh Milk Diamond', qty: 130 },
          { ing: 'Sirup Gula Aren Organik', qty: 25 },
          { ing: 'Es Batu Kristal Higienis', qty: 120 }
        ]
      },
      {
        name: 'Caramel Macchiato Ice',
        category: 'Specialty Coffee Bar',
        sellPrice: 24000,
        imageUrl: '/images/cappuccino.jpg',
        recipes: [
          { ing: 'Biji Kopi Arabica Gayo', qty: 18 },
          { ing: 'Fresh Milk Diamond', qty: 150 },
          { ing: 'Sirup Gula Aren Organik', qty: 15 },
          { ing: 'Es Batu Kristal Higienis', qty: 120 }
        ]
      },
      {
        name: 'Americano Double Shot',
        category: 'Specialty Coffee Bar',
        sellPrice: 16000,
        imageUrl: '/images/cappuccino.jpg',
        recipes: [
          { ing: 'Biji Kopi Arabica Gayo', qty: 20 },
          { ing: 'Es Batu Kristal Higienis', qty: 120 }
        ]
      },
      {
        name: 'Matcha Latte Uji Ice',
        category: 'Artisan Mocktails & Tea',
        sellPrice: 22000,
        imageUrl: '/images/matcha_latte.png',
        recipes: [
          { ing: 'Matcha Uji Premium', qty: 15 },
          { ing: 'Fresh Milk Diamond', qty: 160 },
          { ing: 'Sirup Gula Aren Organik', qty: 20 },
          { ing: 'Es Batu Kristal Higienis', qty: 120 }
        ]
      },
      {
        name: 'Dark Choco Hazelnut Supreme',
        category: 'Artisan Mocktails & Tea',
        sellPrice: 22000,
        imageUrl: '/images/sol_signature.png',
        recipes: [
          { ing: 'Cokelat Powder Belgia', qty: 25 },
          { ing: 'Fresh Milk Diamond', qty: 150 },
          { ing: 'Sirup Gula Aren Organik', qty: 15 },
          { ing: 'Es Batu Kristal Higienis', qty: 120 }
        ]
      },
      {
        name: 'Lychee Tea with Jelly',
        category: 'Artisan Mocktails & Tea',
        sellPrice: 18000,
        imageUrl: '/images/yuzu_soda.png',
        recipes: [
          { ing: 'Sirup Lychee Artisan', qty: 30 },
          { ing: 'Es Batu Kristal Higienis', qty: 140 }
        ]
      },
      {
        name: 'French Butter Croissant',
        category: 'Pastry & Sweet Dessert',
        sellPrice: 20000,
        imageUrl: '/images/croissant.png',
        recipes: [
          { ing: 'Croissant French Dough', qty: 1 }
        ]
      },
      {
        name: 'Japanese Caramel Purin',
        category: 'Pastry & Sweet Dessert',
        sellPrice: 18000,
        imageUrl: '/images/apple_crumble_tart.png',
        recipes: [
          { ing: 'Ajitsuke Tamago (Telur Ramen)', qty: 1 },
          { ing: 'Fresh Milk Diamond', qty: 100 },
          { ing: 'Sirup Gula Aren Organik', qty: 20 }
        ]
      }
    ];

    const defaultCatId = Array.from(catMap.values())[0];
    let createdCount = 0;
    for (const prod of products) {
      const catId = catMap.get(prod.category) || defaultCatId;
      let p = await prisma.product.findFirst({ where: { tenantId, name: prod.name } });

      // Hitung HPP akurat dari total resep
      let calculatedBuyPrice = 0;
      for (const r of prod.recipes) {
        const itemIng = ingredients.find(i => i.name === r.ing);
        if (itemIng) {
          calculatedBuyPrice += Math.round(itemIng.buyPrice * r.qty);
        }
      }
      if (calculatedBuyPrice === 0) calculatedBuyPrice = Math.round(prod.sellPrice * 0.35);

      if (!p) {
        p = await prisma.product.create({
          data: {
            tenantId,
            name: prod.name,
            categoryId: catId,
            sellPrice: prod.sellPrice,
            buyPrice: calculatedBuyPrice,
            stock: 99,
            minStock: 5,
            imageUrl: prod.imageUrl,
            status: 'Aktif'
          }
        });
      } else {
        p = await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: catId,
            sellPrice: prod.sellPrice,
            buyPrice: calculatedBuyPrice,
            imageUrl: prod.imageUrl,
            status: 'Aktif'
          }
        });
      }

      // Link recipes (BOM)
      for (const r of prod.recipes) {
        const ingId = ingMap.get(r.ing);
        if (ingId) {
          const recExist = await prisma.recipeItem.findFirst({
            where: { productId: p.id, ingredientId: ingId }
          });
          if (!recExist) {
            await prisma.recipeItem.create({
              data: {
                tenantId,
                productId: p.id,
                ingredientId: ingId,
                qtyPerServing: r.qty
              }
            });
          } else {
            await prisma.recipeItem.update({
              where: { id: recExist.id },
              data: { qtyPerServing: r.qty }
            });
          }
        }
      }
      createdCount++;
    }

    safeEmit(tenantId, 'menu:updated', { message: 'Menu resto demo seeded' });
    return { success: true, vertical: 'CAFE', tenantName: tenant.name, productsCount: createdCount, ingredientsCount: ingredients.length };
  }

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * 2. SEEDER: RETAIL & GROSIR (SEMBAKO, FMCG, MULTI-UOM, 3-TIER PRICING)
   * ──────────────────────────────────────────────────────────────────────────
   */
  static async seedRetailDemo(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant dengan ID ${tenantId} tidak ditemukan`);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType: 'RETAIL' }
    });

    const settingsData = {
      storeName: tenant.name || 'Sabar Jaya Grosir & Sembako',
      phone: tenant.phone || '0813-2233-4455',
      address: 'Pasar Induk Kramat Jati Blok B No. 12-14',
      taxRate: 0,
      serviceCharge: 0,
      receiptHeader: `${tenant.name.toUpperCase()}\nDistributor Sembako, Beras & Kebutuhan Pokok\nMelayani Eceran, Warung & Partai Besar`,
      receiptFooter: 'Barang yang sudah dibeli dapat ditukar jika kemasan rusak dalam 1x24 jam.\nTerima kasih atas langganan Anda!',
      enableTieredPricing: true,
      ingredientTrackingEnabled: false
    };

    const existSettings = await prisma.settings.findFirst({ where: { tenantId } });
    if (existSettings) {
      await prisma.settings.update({ where: { id: existSettings.id }, data: settingsData });
    } else {
      await prisma.settings.create({ data: { tenantId, ...settingsData } });
    }

    let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant.name} - Toko Pusat`,
          code: 'SBJ-01',
          address: 'Pasar Induk Kramat Jati Blok B No. 12-14',
          status: 'ACTIVE'
        }
      });
    }

    // Setup Lokasi Rak Gudang (sebagai Table representasi kasir / picking)
    const racks = [
      { tableNo: 'RAK-01', name: 'Rak Depan (Sembako & Beras)', capacity: 1 },
      { tableNo: 'RAK-02', name: 'Rak Tengah (Mie Instan & Minuman)', capacity: 1 },
      { tableNo: 'RAK-03', name: 'Rak Samping (Sabun & Pembersih)', capacity: 1 },
      { tableNo: 'GDG-01', name: 'Gudang Belakang (Karton & Bal)', capacity: 1 }
    ];
    for (const r of racks) {
      const exist = await prisma.table.findFirst({ where: { tenantId, tableNo: r.tableNo } });
      if (!exist) {
        await prisma.table.create({
          data: {
            tenantId,
            outletId: outlet.id,
            tableNo: r.tableNo,
            name: r.name,
            capacity: r.capacity,
            status: 'Aktif'
          }
        });
      }
    }

    // Setup Supplier Distributor FMCG
    const suppliers = [
      { name: 'PT Indofood Sukses Makmur Tbk', phone: '0812-1111-2222', address: 'Kawasan Industri Pulogadung Blok F-4' },
      { name: 'PT Wings Surya Distribusi', phone: '0812-3333-4444', address: 'Jl. Daan Mogot KM 18' },
      { name: 'Perum BULOG Divre DKI Jakarta', phone: '0813-5555-6666', address: 'Kawasan Pergudangan Kelapa Gading' }
    ];
    for (const sup of suppliers) {
      const s = await prisma.supplier.findFirst({ where: { tenantId, name: sup.name } });
      if (!s) {
        await prisma.supplier.create({
          data: { tenantId, name: sup.name, phone: sup.phone, address: sup.address }
        });
      }
    }

    // Setup Pelanggan Bon Warung (CRM + Credit Terms)
    const customers = [
      { name: 'Warung Kelontong Bu Siti', phone: '0812-8888-0001', priceTier: 'GROSIR', creditLimit: 3000000, creditTermDays: 14 },
      { name: 'Toko Berkah Mandiri', phone: '0812-8888-0002', priceTier: 'GROSIR', creditLimit: 5000000, creditTermDays: 14 },
      { name: 'Warung Madura Cak Munir', phone: '0812-8888-0003', priceTier: 'GROSIR', creditLimit: 4000000, creditTermDays: 7 },
      { name: 'Pelanggan Umum Tunai', phone: '0800-0000-0001', priceTier: 'UMUM', creditLimit: 0, creditTermDays: 0 }
    ];
    for (const c of customers) {
      const exist = await prisma.customer.findFirst({ where: { tenantId, phone: c.phone } });
      if (!exist) {
        await prisma.customer.create({
          data: {
            tenantId,
            name: c.name,
            phone: c.phone,
            priceTier: c.priceTier,
            creditLimit: c.creditLimit,
            creditTermDays: c.creditTermDays
          }
        });
      }
    }

    // Setup Kategori Barang Dagang
    const categories = [
      { name: 'Sembako, Beras & Minyak', icon: '🌾', sortOrder: 1 },
      { name: 'Mie Instan & Makanan Olahan', icon: '🍜', sortOrder: 2 },
      { name: 'Minuman Kemasan & Kopi Dus', icon: '🧃', sortOrder: 3 },
      { name: 'Sabun & Kebersihan Rumah', icon: '🧼', sortOrder: 4 },
      { name: 'Rokok & Tembakau', icon: '🚬', sortOrder: 5 }
    ];

    const catMap = new Map<string, number>();
    for (const cat of categories) {
      let c = await prisma.category.findFirst({ where: { tenantId, name: cat.name } });
      if (!c) {
        c = await prisma.category.create({
          data: {
            tenantId,
            name: cat.name,
            icon: cat.icon,
            printerTarget: 'NONE',
            stationTarget: 'NONE',
            sortOrder: cat.sortOrder
          }
        });
      }
      catMap.set(cat.name, c.id);
    }

    // Setup Produk Retail Grosir dengan Multi-Satuan UOM & 3-Tier Price
    const retailProducts = [
      {
        name: 'Beras Ramos Super Cap Bunga (Sak 5kg)',
        category: 'Sembako, Beras & Minyak',
        barcode: '8991001000011',
        baseUom: 'SAK',
        buyPrice: 66000,
        sellPrice: 72000,
        sellPriceRetail: 72000,
        sellPriceMitra: 70000,
        sellPriceGrosir: 68000,
        minQtyGrosir: 5,
        storageLocation: 'RAK-01',
        imageUrl: '/images/retail/beras.jpg',
        uoms: [
          { unitName: 'SAK', ratio: 1, price: 72000, isDefault: true },
          { unitName: 'BAL_5SAK', ratio: 5, price: 345000, isDefault: false }
        ]
      },
      {
        name: 'Minyak Goreng Sania Pouch 2L',
        category: 'Sembako, Beras & Minyak',
        barcode: '8991001000028',
        baseUom: 'POUCH',
        buyPrice: 32000,
        sellPrice: 36500,
        sellPriceRetail: 36500,
        sellPriceMitra: 35000,
        sellPriceGrosir: 34000,
        minQtyGrosir: 6,
        storageLocation: 'RAK-01',
        imageUrl: '/images/retail/minyak.jpg',
        uoms: [
          { unitName: 'POUCH', ratio: 1, price: 36500, isDefault: true },
          { unitName: 'DUS_6POUCH', ratio: 6, price: 204000, isDefault: false }
        ]
      },
      {
        name: 'Gula Pasir Gulaku Kuning 1kg',
        category: 'Sembako, Beras & Minyak',
        barcode: '8991001000035',
        baseUom: 'BUNGKUS',
        buyPrice: 15200,
        sellPrice: 17500,
        sellPriceRetail: 17500,
        sellPriceMitra: 16800,
        sellPriceGrosir: 16200,
        minQtyGrosir: 10,
        storageLocation: 'RAK-01',
        imageUrl: '/images/retail/sembako.jpg',
        uoms: [
          { unitName: 'BUNGKUS', ratio: 1, price: 17500, isDefault: true },
          { unitName: 'DUS_24BKS', ratio: 24, price: 388000, isDefault: false }
        ]
      },
      {
        name: 'Indomie Goreng Spesial (Karton / 40 Pcs)',
        category: 'Mie Instan & Makanan Olahan',
        barcode: '8991001000042',
        baseUom: 'PCS',
        buyPrice: 2600,
        sellPrice: 3200,
        sellPriceRetail: 3200,
        sellPriceMitra: 3000,
        sellPriceGrosir: 2800,
        minQtyGrosir: 40,
        storageLocation: 'RAK-02',
        imageUrl: '/images/retail/mie_instan.jpg',
        uoms: [
          { unitName: 'PCS', ratio: 1, price: 3200, isDefault: true },
          { unitName: 'KARTON_40PCS', ratio: 40, price: 112000, isDefault: false }
        ]
      },
      {
        name: 'Indomie Kuah Ayam Bawang (Karton / 40 Pcs)',
        category: 'Mie Instan & Makanan Olahan',
        barcode: '8991001000059',
        baseUom: 'PCS',
        buyPrice: 2500,
        sellPrice: 3100,
        sellPriceRetail: 3100,
        sellPriceMitra: 2900,
        sellPriceGrosir: 2700,
        minQtyGrosir: 40,
        storageLocation: 'RAK-02',
        imageUrl: '/images/retail/mie_instan.jpg',
        uoms: [
          { unitName: 'PCS', ratio: 1, price: 3100, isDefault: true },
          { unitName: 'KARTON_40PCS', ratio: 40, price: 108000, isDefault: false }
        ]
      },
      {
        name: 'Teh Pucuk Harum 350ml (Dus / 24 Btl)',
        category: 'Minuman Kemasan & Kopi Dus',
        barcode: '8991001000066',
        baseUom: 'BOTOL',
        buyPrice: 2300,
        sellPrice: 3500,
        sellPriceRetail: 3500,
        sellPriceMitra: 3000,
        sellPriceGrosir: 2600,
        minQtyGrosir: 24,
        storageLocation: 'RAK-02',
        imageUrl: '/images/retail/kopi_teh.jpg',
        uoms: [
          { unitName: 'BOTOL', ratio: 1, price: 3500, isDefault: true },
          { unitName: 'DUS_24BTL', ratio: 24, price: 62000, isDefault: false }
        ]
      },
      {
        name: 'Kopi Kapal Api Spesial Mix (Renceng / 10 Sachet)',
        category: 'Minuman Kemasan & Kopi Dus',
        barcode: '8991001000073',
        baseUom: 'SACHET',
        buyPrice: 1200,
        sellPrice: 1600,
        sellPriceRetail: 1600,
        sellPriceMitra: 1500,
        sellPriceGrosir: 1450,
        minQtyGrosir: 10,
        storageLocation: 'RAK-02',
        imageUrl: '/images/retail/kopi_teh.jpg',
        uoms: [
          { unitName: 'SACHET', ratio: 1, price: 1600, isDefault: true },
          { unitName: 'RENCENG_10SCH', ratio: 10, price: 14500, isDefault: false },
          { unitName: 'DUS_120SCH', ratio: 120, price: 168000, isDefault: false }
        ]
      },
      {
        name: 'Deterjen Rinso Molto Anti Noda 770g',
        category: 'Sabun & Kebersihan Rumah',
        barcode: '8991001000080',
        baseUom: 'BUNGKUS',
        buyPrice: 17800,
        sellPrice: 21500,
        sellPriceRetail: 21500,
        sellPriceMitra: 20000,
        sellPriceGrosir: 19000,
        minQtyGrosir: 6,
        storageLocation: 'RAK-03',
        imageUrl: '/images/retail/kebersihan.jpg',
        uoms: [
          { unitName: 'BUNGKUS', ratio: 1, price: 21500, isDefault: true },
          { unitName: 'DUS_12BKS', ratio: 12, price: 228000, isDefault: false }
        ]
      },
      {
        name: 'Sabun Cuci Piring Sunlight Jeruk Nipis 650ml',
        category: 'Sabun & Kebersihan Rumah',
        barcode: '8991001000097',
        baseUom: 'POUCH',
        buyPrice: 11500,
        sellPrice: 14000,
        sellPriceRetail: 14000,
        sellPriceMitra: 13200,
        sellPriceGrosir: 12500,
        minQtyGrosir: 12,
        storageLocation: 'RAK-03',
        imageUrl: '/images/retail/kebersihan.jpg',
        uoms: [
          { unitName: 'POUCH', ratio: 1, price: 14000, isDefault: true },
          { unitName: 'DUS_12POUCH', ratio: 12, price: 150000, isDefault: false }
        ]
      },
      {
        name: 'Sampoerna A Mild 16 (Pres / Slop / 10 Bungkus)',
        category: 'Rokok & Tembakau',
        barcode: '8991001000103',
        baseUom: 'BUNGKUS',
        buyPrice: 32500,
        sellPrice: 35000,
        sellPriceRetail: 35000,
        sellPriceMitra: 34500,
        sellPriceGrosir: 34000,
        minQtyGrosir: 10,
        storageLocation: 'RAK-01',
        imageUrl: '/images/retail/sembako.jpg',
        uoms: [
          { unitName: 'BUNGKUS', ratio: 1, price: 35000, isDefault: true },
          { unitName: 'SLOP_10BKS', ratio: 10, price: 340000, isDefault: false }
        ]
      }
    ];

    const defaultCatId = Array.from(catMap.values())[0];
    let count = 0;
    for (const item of retailProducts) {
      const catId = catMap.get(item.category) || defaultCatId;
      let p = await prisma.product.findFirst({
        where: {
          tenantId,
          OR: [
            { name: item.name },
            ...(item.barcode ? [{ barcode: item.barcode }] : [])
          ]
        }
      });

      if (!p) {
        p = await prisma.product.create({
          data: {
            tenantId,
            name: item.name,
            categoryId: catId,
            barcode: item.barcode,
            baseUom: item.baseUom,
            buyPrice: item.buyPrice,
            sellPrice: item.sellPrice,
            sellPriceRetail: item.sellPriceRetail,
            sellPriceMitra: item.sellPriceMitra,
            sellPriceGrosir: item.sellPriceGrosir,
            minQtyGrosir: item.minQtyGrosir,
            storageLocation: item.storageLocation,
            stock: 350,
            minStock: 20,
            imageUrl: item.imageUrl,
            status: 'Aktif'
          }
        });
      } else {
        p = await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: catId,
            barcode: item.barcode,
            baseUom: item.baseUom,
            buyPrice: item.buyPrice,
            sellPrice: item.sellPrice,
            sellPriceRetail: item.sellPriceRetail,
            sellPriceMitra: item.sellPriceMitra,
            sellPriceGrosir: item.sellPriceGrosir,
            minQtyGrosir: item.minQtyGrosir,
            storageLocation: item.storageLocation,
            imageUrl: item.imageUrl
          }
        });
      }

      // Hubungkan ProductUOM
      for (const uom of item.uoms) {
        const uomExist = await prisma.productUOM.findFirst({
          where: { tenantId, productId: p.id, unitName: uom.unitName }
        });
        if (!uomExist) {
          await prisma.productUOM.create({
            data: {
              tenantId,
              productId: p.id,
              unitName: uom.unitName,
              conversionRatio: uom.ratio,
              priceSell: uom.price,
              isDefaultSale: uom.isDefault
            }
          });
        }
      }

      count++;
    }

    safeEmit(tenantId, 'menu:updated', { message: 'Katalog retail seeded' });
    return { success: true, vertical: 'RETAIL', tenantName: tenant.name, productsCount: count };
  }

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * 3. SEEDER: RENTAL & SEWA BUSANA (FASHION, KEBAYA, GAUN, ADAT + GAMBAR HD)
   * ──────────────────────────────────────────────────────────────────────────
   */
  static async seedRentalDemo(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant dengan ID ${tenantId} tidak ditemukan`);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType: 'RENTAL' }
    });

    const settingsData = {
      storeName: tenant.name || 'Ratu Gallery - Butik & Sewa Busana Adat',
      phone: tenant.phone || '0812-9988-1122',
      address: 'Jl. Pengantin Ali No. 28, Jakarta Timur',
      taxRate: 0,
      serviceCharge: 0,
      receiptHeader: `${tenant.name.toUpperCase()}\nButik Sewa Baju Bodo, Kebaya Modern, Gaun Pesta & Jas Pengantin\nJaminan Busana Bersih Wangi & Siap Pakai`,
      receiptFooter: '1. Masa sewa standar adalah 3 hari (Ambil - Acara - Kembali).\n2. Harap kembalikan busana & aksesoris tanpa dicuci sendiri.\n3. Uang deposit akan dikembalikan penuh setelah pemeriksaan QC.\nTerima kasih atas kepercayaan Anda!',
      ingredientTrackingEnabled: false
    };

    const existSettings = await prisma.settings.findFirst({ where: { tenantId } });
    if (existSettings) {
      await prisma.settings.update({ where: { id: existSettings.id }, data: settingsData });
    } else {
      await prisma.settings.create({ data: { tenantId, ...settingsData } });
    }

    let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant.name} - Butik Utama`,
          code: 'RTG-01',
          address: 'Jl. Pengantin Ali No. 28, Jakarta Timur',
          status: 'ACTIVE'
        }
      });
    }

    // Setup Fitting Rooms & Display Display Racks
    const rooms = [
      { tableNo: 'FIT-01', name: 'Kamar Pas / Fitting Room 1', capacity: 2 },
      { tableNo: 'FIT-02', name: 'Kamar Pas / Fitting Room 2', capacity: 2 },
      { tableNo: 'MAN-01', name: 'Display Manekin Utama (Gaun Pengantin)', capacity: 1 },
      { tableNo: 'HNG-01', name: 'Rak Gantung Siap Sewa (Baju Bodo & Kebaya)', capacity: 10 },
      { tableNo: 'AKS-01', name: 'Etalase Aksesoris & Mahkota Adat', capacity: 20 }
    ];
    for (const rm of rooms) {
      const exist = await prisma.table.findFirst({ where: { tenantId, tableNo: rm.tableNo } });
      if (!exist) {
        await prisma.table.create({
          data: {
            tenantId,
            outletId: outlet.id,
            tableNo: rm.tableNo,
            name: rm.name,
            capacity: rm.capacity,
            status: 'Aktif'
          }
        });
      }
    }

    // Setup Kategori Busana
    const categories = [
      { name: 'Baju Bodo Adat Bugis Modern', icon: '👗', sortOrder: 1 },
      { name: 'Kebaya Modern & Wisuda', icon: '👘', sortOrder: 2 },
      { name: 'Gaun Pengantin & Bridal Gown', icon: '👰', sortOrder: 3 },
      { name: 'Jas Pria & Tuxedo Pengantin', icon: '🤵', sortOrder: 4 },
      { name: 'Busana Adat Nusantara & Beskap', icon: '🥻', sortOrder: 5 },
      { name: 'Aksesoris & Mahkota Adat', icon: '👑', sortOrder: 6 }
    ];

    const catMap = new Map<string, number>();
    for (const cat of categories) {
      let c = await prisma.category.findFirst({ where: { tenantId, name: cat.name } });
      if (!c) {
        c = await prisma.category.create({
          data: {
            tenantId,
            name: cat.name,
            icon: cat.icon,
            printerTarget: 'NONE',
            stationTarget: 'NONE',
            sortOrder: cat.sortOrder
          }
        });
      }
      catMap.set(cat.name, c.id);
    }

    // Setup Katalog Busana LENGKAP DENGAN GAMBAR ESTETIK HD & HARGA SEWA
    const attireProducts = [
      {
        name: 'Baju Bodo Modern Organza Maroon Payet',
        category: 'Baju Bodo Adat Bugis Modern',
        barcode: 'BBM-MRN-M-01',
        sellPrice: 250000, // Tarif sewa 3 hari
        buyPrice: 650000,  // HPP Perolehan Baju
        imageUrl: '/images/rental/baju_bodo_maroon.jpg',
        storageLocation: 'HNG-01'
      },
      {
        name: 'Baju Bodo Modern Organza Lilac Pastel Silk',
        category: 'Baju Bodo Adat Bugis Modern',
        barcode: 'BBM-LLC-S-02',
        sellPrice: 250000,
        buyPrice: 650000,
        imageUrl: '/images/rental/baju_bodo_lilac.jpg',
        storageLocation: 'HNG-01'
      },
      {
        name: 'Baju Bodo Pengantin Adat Full Mutiara Gold',
        category: 'Baju Bodo Adat Bugis Modern',
        barcode: 'BBP-GLD-L-01',
        sellPrice: 850000,
        buyPrice: 2200000,
        imageUrl: '/images/rental/baju_pengantin_gold.jpg',
        storageLocation: 'MAN-01'
      },
      {
        name: "Baju La'bu Sutra Tenun Sengkang Emerald",
        category: 'Baju Bodo Adat Bugis Modern',
        barcode: 'BLB-STR-EMR-01',
        sellPrice: 300000,
        buyPrice: 800000,
        imageUrl: '/images/rental/baju_labbu_sutra.jpg',
        storageLocation: 'HNG-01'
      },
      {
        name: 'Kebaya Brokat Chantilly Dusty Rose Modern (Size M)',
        category: 'Kebaya Modern & Wisuda',
        barcode: 'KBY-DST-M-01',
        sellPrice: 350000,
        buyPrice: 950000,
        imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'HNG-02'
      },
      {
        name: 'Kebaya Kutubaru Payet Emerald Green (Size L)',
        category: 'Kebaya Modern & Wisuda',
        barcode: 'KBY-EMR-L-02',
        sellPrice: 350000,
        buyPrice: 950000,
        imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'HNG-02'
      },
      {
        name: 'Gaun Pengantin White Ivory A-Line Pearl Royal',
        category: 'Gaun Pengantin & Bridal Gown',
        barcode: 'BDL-IVR-M-01',
        sellPrice: 950000,
        buyPrice: 3500000,
        imageUrl: 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'MAN-01'
      },
      {
        name: 'Jas Pria Tuxedo Slimfit Charcoal Black (Size L)',
        category: 'Jas Pria & Tuxedo Pengantin',
        barcode: 'JAS-TXD-BLK-01',
        sellPrice: 275000,
        buyPrice: 850000,
        imageUrl: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'HNG-02'
      },
      {
        name: 'Jas Formal Navy Italian Wool Pengantin (Size XL)',
        category: 'Jas Pria & Tuxedo Pengantin',
        barcode: 'JAS-NVY-XL-02',
        sellPrice: 300000,
        buyPrice: 900000,
        imageUrl: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'HNG-02'
      },
      {
        name: 'Beskap Jawa Solo Hitam Beludru Payet Emas (Size L)',
        category: 'Busana Adat Nusantara & Beskap',
        barcode: 'BSK-JWA-BLK-01',
        sellPrice: 225000,
        buyPrice: 650000,
        imageUrl: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'HNG-02'
      },
      {
        name: 'Baju Kurung Melayu Tenun Songket Gold (Size M)',
        category: 'Busana Adat Nusantara & Beskap',
        barcode: 'KRG-MLY-GLD-01',
        sellPrice: 300000,
        buyPrice: 850000,
        imageUrl: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'HNG-02'
      },
      {
        name: 'Set Mahkota Saloko Bugis & Bando Emas Pengantin',
        category: 'Aksesoris & Mahkota Adat',
        barcode: 'AKS-SLK-GLD-01',
        sellPrice: 85000,
        buyPrice: 350000,
        imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'AKS-01'
      },
      {
        name: 'Keris Tataroppeng Adat Pria Lapis Kuningan Ukir',
        category: 'Aksesoris & Mahkota Adat',
        barcode: 'AKS-KRS-KNG-01',
        sellPrice: 50000,
        buyPrice: 200000,
        imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
        storageLocation: 'AKS-01'
      }
    ];

    const defaultCatId = Array.from(catMap.values())[0];
    let count = 0;
    for (const item of attireProducts) {
      const catId = catMap.get(item.category) || defaultCatId;
      let p = await prisma.product.findFirst({
        where: {
          tenantId,
          OR: [
            { name: item.name },
            ...(item.barcode ? [{ barcode: item.barcode }] : [])
          ]
        }
      });
      if (!p) {
        await prisma.product.create({
          data: {
            tenantId,
            name: item.name,
            categoryId: catId,
            barcode: item.barcode,
            sellPrice: item.sellPrice,
            buyPrice: item.buyPrice,
            stock: 1, // Koleksi butik per potong pakaian
            minStock: 1,
            imageUrl: item.imageUrl,
            storageLocation: item.storageLocation,
            status: 'Aktif'
          }
        });
      } else {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: catId,
            barcode: item.barcode,
            sellPrice: item.sellPrice,
            buyPrice: item.buyPrice,
            imageUrl: item.imageUrl,
            storageLocation: item.storageLocation,
            status: 'Aktif'
          }
        });
      }
      count++;
    }

    // Buat sampel customer rental setia & 1 Order Aktif untuk visualisasi Kanban
    let cust = await prisma.customer.findFirst({ where: { tenantId, phone: '0812-3456-7890' } });
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          tenantId,
          name: 'Nurlinda Maharani (Calon Pengantin)',
          phone: '0812-3456-7890',
          tier: 'Gold',
          priceTier: 'UMUM'
        }
      });
    }

    const orderExist = await prisma.rentalOrder.findFirst({ where: { tenantId } });
    if (!orderExist && cust) {
      const ym = new Date().toISOString().slice(2, 7).replace('-', '');
      const prefix = `RNT-${(tenant.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'RTG').toUpperCase()}-${ym}-`;
      await prisma.rentalOrder.create({
        data: {
          tenantId,
          outletId: outlet.id,
          orderNumber: `${prefix}0001`,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          returnDeadline: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          status: 'BOOKED',
          rentalSubtotal: 850000,
          totalAmount: 850000,
          depositAmount: 300000,
          paidAmount: 850000,
          paymentStatus: 'FULL_PAID',
          paymentMethod: 'TRANSFER',
          depositStatus: 'HELD',
          fittingNotes: 'Permak lingkar pinggang pas 68cm, aksesoris bando emas include.',
          items: {
            create: [
              {
                attireName: 'Baju Bodo Pengantin Adat Full Mutiara Gold',
                attireCode: 'BBP-GLD-L-01',
                price: 850000,
                color: 'Emas Mutiara',
                size: 'L',
                isReturned: false,
                returnCondition: 'GOOD'
              }
            ]
          }
        }
      });
    }

    safeEmit(tenantId, 'rental:inventory_updated', { message: 'Katalog rental seeded' });
    return { success: true, vertical: 'RENTAL', tenantName: tenant.name, productsCount: count };
  }

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * 4. SEEDER: LAUNDRY & DRY CLEANING
   * ──────────────────────────────────────────────────────────────────────────
   */
  static async seedLaundryDemo(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant dengan ID ${tenantId} tidak ditemukan`);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType: 'LAUNDRY' }
    });

    const settingsData = {
      storeName: tenant.name || 'FreshClean Laundry & Care',
      phone: tenant.phone || '0812-9988-7766',
      address: 'Jl. Boulevard Raya Blok LA-08, Kelapa Gading',
      taxRate: 0,
      serviceCharge: 0,
      receiptHeader: `${tenant.name.toUpperCase()}\nKiloan Bersih Wangi, Satuan, Gamis, Sepatu & Bedcover\nJaminan Higienis, Rapi & Tepat Waktu`,
      receiptFooter: '1. Komplain maksimal 1x24 jam sejak cucian diambil.\n2. Nota laundry wajib ditunjukkan saat pengambilan barang.\n3. Cucian tidak diambil > 30 hari di luar tanggung jawab kami.\nTerima kasih atas kepercayaan Anda!',
      ingredientTrackingEnabled: true
    };

    const existSettings = await prisma.settings.findFirst({ where: { tenantId } });
    if (existSettings) {
      await prisma.settings.update({ where: { id: existSettings.id }, data: settingsData });
    } else {
      await prisma.settings.create({ data: { tenantId, ...settingsData } });
    }

    let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant.name} - Outlet Utama`,
          code: 'LND-01',
          address: 'Jl. Boulevard Raya Blok LA-08, Kelapa Gading',
          status: 'ACTIVE'
        }
      });
    }

    // Setup Rak Simpan Cucian
    const racks = [
      { tableNo: 'RAK-A1', name: 'Rak A1 (Kiloan Siap Ambil)', capacity: 1 },
      { tableNo: 'RAK-A2', name: 'Rak A2 (Kiloan Siap Ambil)', capacity: 1 },
      { tableNo: 'RAK-B1', name: 'Rak B1 (Bedcover & Selimut)', capacity: 1 },
      { tableNo: 'RAK-B2', name: 'Rak B2 (Sepatu & Tas)', capacity: 1 },
      { tableNo: 'HANGER-01', name: 'Gantungan Jas & Gaun Panjang', capacity: 1 }
    ];
    for (const r of racks) {
      const exist = await prisma.table.findFirst({ where: { tenantId, tableNo: r.tableNo } });
      if (!exist) {
        await prisma.table.create({
          data: {
            tenantId,
            outletId: outlet.id,
            tableNo: r.tableNo,
            name: r.name,
            capacity: r.capacity,
            status: 'Aktif'
          }
        });
      }
    }

    // Setup Chemical Inventory (Bahan Baku Cuci)
    const chemicals = [
      { name: 'Deterjen Cair Konsentrat Super Clean', unit: 'liter', stock: 50, minStock: 10, buyPrice: 12000 },
      { name: 'Softener / Pelembut Blue Fresh Floral', unit: 'liter', stock: 30, minStock: 5, buyPrice: 15000 },
      { name: 'Pewangi Parfum Sakura Blossom', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
      { name: 'Pewangi Parfum Akasia Wangi Elegan', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
      { name: 'Pewangi Parfum Lavender Dream Relax', unit: 'liter', stock: 15, minStock: 5, buyPrice: 28000 },
      { name: 'Plastik Jinjing HD Size L & XL', unit: 'pack', stock: 60, minStock: 10, buyPrice: 18000 },
      { name: 'Plastik Cover Gantungan Jas/Gamis', unit: 'roll', stock: 10, minStock: 2, buyPrice: 45000 }
    ];
    for (const ch of chemicals) {
      let item = await prisma.ingredient.findFirst({ where: { tenantId, name: ch.name } });
      if (!item) {
        await prisma.ingredient.create({
          data: {
            tenantId,
            name: ch.name,
            unit: ch.unit,
            stock: ch.stock,
            minStock: ch.minStock,
            buyPrice: ch.buyPrice,
            category: 'PACKAGING'
          }
        });
      } else {
        await prisma.ingredient.update({
          where: { id: item.id },
          data: { stock: ch.stock, buyPrice: ch.buyPrice, minStock: ch.minStock }
        });
      }
    }

    // Setup Kategori Layanan Laundry
    const categories = [
      { name: 'Cuci Kiloan Reguler', icon: '🧺', sortOrder: 1 },
      { name: 'Cuci Kilat & Express (SLA Cepat)', icon: '⚡', sortOrder: 2 },
      { name: 'Cuci Satuan & Bedcover', icon: '🛏️', sortOrder: 3 },
      { name: 'Dry Clean Jas, Gamis & Sepatu', icon: '👞', sortOrder: 4 }
    ];

    const catMap = new Map<string, number>();
    for (const cat of categories) {
      let c = await prisma.category.findFirst({ where: { tenantId, name: cat.name } });
      if (!c) {
        c = await prisma.category.create({
          data: {
            tenantId,
            name: cat.name,
            icon: cat.icon,
            printerTarget: 'NONE',
            stationTarget: 'NONE',
            sortOrder: cat.sortOrder
          }
        });
      }
      catMap.set(cat.name, c.id);
    }

    // Setup Produk / Layanan Laundry Lengkap
    const laundryServices = [
      {
        name: 'Cuci Kering Setrika (Reguler)',
        category: 'Cuci Kiloan Reguler',
        baseUom: 'Kg',
        sellPrice: 7000,
        buyPrice: 2000,
        imageUrl: '/images/laundry/kiloan.jpg'
      },
      {
        name: 'Cuci Lipat Kering (Non Setrika)',
        category: 'Cuci Kiloan Reguler',
        baseUom: 'Kg',
        sellPrice: 5000,
        buyPrice: 1500,
        imageUrl: '/images/laundry/kiloan.jpg'
      },
      {
        name: 'Setrika Rapi Saja (Per Kg)',
        category: 'Cuci Kiloan Reguler',
        baseUom: 'Kg',
        sellPrice: 4500,
        buyPrice: 1200,
        imageUrl: '/images/laundry/kiloan.jpg'
      },
      {
        name: 'Cuci Kering Setrika (Kilat 24 Jam)',
        category: 'Cuci Kilat & Express (SLA Cepat)',
        baseUom: 'Kg',
        sellPrice: 10000,
        buyPrice: 2500,
        imageUrl: '/images/laundry/kiloan.jpg'
      },
      {
        name: 'Cuci Express Super 6 Jam',
        category: 'Cuci Kilat & Express (SLA Cepat)',
        baseUom: 'Kg',
        sellPrice: 15000,
        buyPrice: 3500,
        imageUrl: '/images/laundry/kiloan.jpg'
      },
      {
        name: 'Bedcover King / Jumbo Size',
        category: 'Cuci Satuan & Bedcover',
        baseUom: 'Pcs',
        sellPrice: 25000,
        buyPrice: 6000,
        imageUrl: '/images/laundry/bedcover.jpg'
      },
      {
        name: 'Bedcover Single / Sedang',
        category: 'Cuci Satuan & Bedcover',
        baseUom: 'Pcs',
        sellPrice: 20000,
        buyPrice: 5000,
        imageUrl: '/images/laundry/bedcover.jpg'
      },
      {
        name: 'Selimut Tebal / Fleece Halus',
        category: 'Cuci Satuan & Bedcover',
        baseUom: 'Pcs',
        sellPrice: 15000,
        buyPrice: 4000,
        imageUrl: '/images/laundry/bedcover.jpg'
      },
      {
        name: 'Jas Pria / Blazer Kerja (Dry Clean)',
        category: 'Dry Clean Jas, Gamis & Sepatu',
        baseUom: 'Pcs',
        sellPrice: 30000,
        buyPrice: 7000,
        imageUrl: '/images/laundry/jas.jpg'
      },
      {
        name: "Gamis Syar'i / Gaun Pesta Payet",
        category: 'Dry Clean Jas, Gamis & Sepatu',
        baseUom: 'Pcs',
        sellPrice: 25000,
        buyPrice: 6000,
        imageUrl: '/images/laundry/gamis.jpg'
      },
      {
        name: 'Deep Clean Sepatu Sneakers & Kanvas',
        category: 'Dry Clean Jas, Gamis & Sepatu',
        baseUom: 'Pcs',
        sellPrice: 35000,
        buyPrice: 8000,
        imageUrl: '/images/laundry/sepatu.jpg'
      },
      {
        name: 'Cuci Tas Ransel / Backpack',
        category: 'Dry Clean Jas, Gamis & Sepatu',
        baseUom: 'Pcs',
        sellPrice: 25000,
        buyPrice: 6000,
        imageUrl: '/images/laundry/tas.jpg'
      }
    ];

    const defaultCatId = Array.from(catMap.values())[0];
    let count = 0;
    for (const item of laundryServices) {
      const catId = catMap.get(item.category) || defaultCatId;
      let p = await prisma.product.findFirst({ where: { tenantId, name: item.name } });
      if (!p) {
        await prisma.product.create({
          data: {
            tenantId,
            name: item.name,
            categoryId: catId,
            baseUom: item.baseUom,
            sellPrice: item.sellPrice,
            buyPrice: item.buyPrice,
            stock: 999,
            minStock: 5,
            imageUrl: item.imageUrl,
            status: 'Aktif'
          }
        });
      } else {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: catId,
            baseUom: item.baseUom,
            sellPrice: item.sellPrice,
            buyPrice: item.buyPrice,
            imageUrl: item.imageUrl,
            status: 'Aktif'
          }
        });
      }
      count++;
    }

    safeEmit(tenantId, 'menu:updated', { message: 'Katalog laundry seeded' });
    return { success: true, vertical: 'LAUNDRY', tenantName: tenant.name, productsCount: count, chemicalsCount: chemicals.length };
  }

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * 5. SEEDER: BENGKEL MOTOR & MOBIL (JASA, OLI, SPAREPART, PIT STALL)
   * ──────────────────────────────────────────────────────────────────────────
   */
  static async seedBengkelDemo(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant dengan ID ${tenantId} tidak ditemukan`);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { businessType: 'BENGKEL' }
    });

    const settingsData = {
      storeName: tenant.name || 'Jaya Motor Workshop',
      phone: tenant.phone || '0812-9876-5432',
      address: 'Jl. Otista Raya No. 45, Cawang',
      taxRate: 0,
      serviceCharge: 0,
      receiptHeader: `${tenant.name.toUpperCase()}\nSpesialis Servis Motor Matic, Bebek & Sport\nSuku Cadang Resmi & Bergaransi`,
      receiptFooter: 'Garansi Servis 7 Hari / 500 KM\nTerima kasih atas kepercayaan Anda!',
      ingredientTrackingEnabled: false
    };

    const existSettings = await prisma.settings.findFirst({ where: { tenantId } });
    if (existSettings) {
      await prisma.settings.update({ where: { id: existSettings.id }, data: settingsData });
    } else {
      await prisma.settings.create({ data: { tenantId, ...settingsData } });
    }

    let outlet = await prisma.outlet.findFirst({ where: { tenantId } });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId,
          name: `${tenant.name} - Workshop Pusat`,
          code: 'JKT-01',
          address: 'Jl. Otista Raya No. 45, Cawang',
          status: 'ACTIVE'
        }
      });
    }

    // Setup Pit / Stall Servis
    const pits = [
      { tableNo: 'PIT-01', name: 'Pit 01 (Servis Ringan / Fast Pit)', capacity: 1 },
      { tableNo: 'PIT-02', name: 'Pit 02 (Tune Up & Servis CVT)', capacity: 1 },
      { tableNo: 'PIT-03', name: 'Pit 03 (Bongkar Mesin / Overhaul)', capacity: 1 },
      { tableNo: 'PIT-04', name: 'Pit 04 (Cuci Motor & Finishing)', capacity: 1 }
    ];
    for (const p of pits) {
      const exist = await prisma.table.findFirst({ where: { tenantId, tableNo: p.tableNo } });
      if (!exist) {
        await prisma.table.create({
          data: {
            tenantId,
            outletId: outlet.id,
            tableNo: p.tableNo,
            name: p.name,
            capacity: p.capacity,
            status: 'Aktif'
          }
        });
      }
    }

    // Setup Kategori Bengkel
    const categories = [
      { name: 'Jasa Servis & Perawatan', icon: '🔧', sortOrder: 1 },
      { name: 'Oli & Pelumas Resmi', icon: '🛢️', sortOrder: 2 },
      { name: 'Sparepart Fast Moving', icon: '⚙️', sortOrder: 3 },
      { name: 'Ban & Roda', icon: '🛞', sortOrder: 4 }
    ];

    const catMap = new Map<string, number>();
    for (const cat of categories) {
      let c = await prisma.category.findFirst({ where: { tenantId, name: cat.name } });
      if (!c) {
        c = await prisma.category.create({
          data: {
            tenantId,
            name: cat.name,
            icon: cat.icon,
            printerTarget: 'NONE',
            stationTarget: 'NONE',
            sortOrder: cat.sortOrder
          }
        });
      }
      catMap.set(cat.name, c.id);
    }

    // Setup Produk Bengkel (Jasa & Sparepart)
    const bengkelItems = [
      {
        name: 'Servis Ringan / Tune Up Bebek & Matic',
        category: 'Jasa Servis & Perawatan',
        sellPrice: 45000,
        buyPrice: 0,
        imageUrl: '/images/bengkel/kampas_rem.jpg'
      },
      {
        name: 'Servis CVT & Pembersihan Belt',
        category: 'Jasa Servis & Perawatan',
        sellPrice: 35000,
        buyPrice: 0,
        imageUrl: '/images/bengkel/kampas_rem.jpg'
      },
      {
        name: 'Servis Injeksi / Throttle Body Cleaner',
        category: 'Jasa Servis & Perawatan',
        sellPrice: 50000,
        buyPrice: 10000,
        imageUrl: '/images/bengkel/kampas_rem.jpg'
      },
      {
        name: 'Oli Mesin MPX2 0.8L Matic',
        category: 'Oli & Pelumas Resmi',
        sellPrice: 55000,
        buyPrice: 42000,
        brand: 'AHM',
        imageUrl: '/images/bengkel/oli_motor.jpg'
      },
      {
        name: 'Oli Mesin Yamalube Silver 0.8L',
        category: 'Oli & Pelumas Resmi',
        sellPrice: 50000,
        buyPrice: 38000,
        brand: 'Yamaha',
        imageUrl: '/images/bengkel/oli_motor.jpg'
      },
      {
        name: 'Oli Gardan / Gear Oil Matic 120ml',
        category: 'Oli & Pelumas Resmi',
        sellPrice: 18000,
        buyPrice: 12000,
        brand: 'AHM',
        imageUrl: '/images/bengkel/oli_motor.jpg'
      },
      {
        name: 'Busi Standar Denso U24EPR9',
        category: 'Sparepart Fast Moving',
        sellPrice: 25000,
        buyPrice: 16000,
        brand: 'Denso',
        imageUrl: '/images/bengkel/busi.jpg'
      },
      {
        name: 'Kampas Rem Depan Honda Beat / Vario',
        category: 'Sparepart Fast Moving',
        sellPrice: 45000,
        buyPrice: 28000,
        brand: 'Federal',
        imageUrl: '/images/bengkel/kampas_rem.jpg'
      },
      {
        name: 'Roller Set Standar Honda Beat FI',
        category: 'Sparepart Fast Moving',
        sellPrice: 65000,
        buyPrice: 45000,
        brand: 'AHM',
        imageUrl: '/images/bengkel/kampas_rem.jpg'
      },
      {
        name: 'V-Belt Kit Honda Scoopy / Beat',
        category: 'Sparepart Fast Moving',
        sellPrice: 145000,
        buyPrice: 110000,
        brand: 'AHM',
        imageUrl: '/images/bengkel/kampas_rem.jpg'
      },
      {
        name: 'Aki Kering GS Astra GTZ5S',
        category: 'Sparepart Fast Moving',
        sellPrice: 235000,
        buyPrice: 185000,
        brand: 'GS Astra',
        imageUrl: '/images/bengkel/aki_motor.jpg'
      },
      {
        name: 'Ban Tubeless FDR Sport XR 90/80-14',
        category: 'Ban & Roda',
        sellPrice: 220000,
        buyPrice: 165000,
        brand: 'FDR',
        imageUrl: '/images/bengkel/ban_tubeless.jpg'
      }
    ];

    const defaultCatId = Array.from(catMap.values())[0];
    let count = 0;
    for (const item of bengkelItems) {
      const catId = catMap.get(item.category) || defaultCatId;
      let p = await prisma.product.findFirst({ where: { tenantId, name: item.name } });
      if (!p) {
        await prisma.product.create({
          data: {
            tenantId,
            name: item.name,
            categoryId: catId,
            brand: (item as any).brand,
            sellPrice: item.sellPrice,
            buyPrice: item.buyPrice,
            stock: 50,
            minStock: 5,
            imageUrl: item.imageUrl,
            status: 'Aktif'
          }
        });
      } else {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            categoryId: catId,
            brand: (item as any).brand,
            sellPrice: item.sellPrice,
            buyPrice: item.buyPrice,
            imageUrl: item.imageUrl,
            status: 'Aktif'
          }
        });
      }
      count++;
    }

    safeEmit(tenantId, 'menu:updated', { message: 'Katalog bengkel seeded' });
    return { success: true, vertical: 'BENGKEL', tenantName: tenant.name, productsCount: count };
  }

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * 6. ROUTER MASTER SEEDER BERDASARKAN VERTIKAL
   * ──────────────────────────────────────────────────────────────────────────
   */
  static async seedVerticalDemo(tenantId: string, forcedVertical?: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant ${tenantId} tidak ditemukan`);

    const vertical = (forcedVertical || tenant.businessType || 'CAFE').toUpperCase();

    switch (vertical) {
      case 'CAFE':
        return await this.seedCafeDemo(tenantId);
      case 'RETAIL':
        return await this.seedRetailDemo(tenantId);
      case 'RENTAL':
        return await this.seedRentalDemo(tenantId);
      case 'LAUNDRY':
        return await this.seedLaundryDemo(tenantId);
      case 'BENGKEL':
        return await this.seedBengkelDemo(tenantId);
      default:
        return await this.seedCafeDemo(tenantId);
    }
  }
}
