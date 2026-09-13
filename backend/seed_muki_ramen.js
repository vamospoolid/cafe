const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedMukiRamen() {
  console.log('🚀 Memulai Seeding Data Lengkap MUKI RAMEN...');

  // 1. Update Pengaturan Toko
  const existingSetting = await prisma.settings.findFirst();
  if (existingSetting) {
    await prisma.settings.update({
      where: { id: existingSetting.id },
      data: {
        storeName: 'MUKI RAMEN',
        phone: '081298765432',
        address: 'Jl. Senopati No. 88, Jakarta Selatan',
        taxRate: 10,
        serviceCharge: 5,
        receiptHeader: 'MUKI RAMEN - Authentic Japanese Ramen Bar',
        receiptFooter: 'Arigatou Gozaimasu!\nFollow Instagram kami: @mukiramen.id',
      }
    });
  } else {
    await prisma.settings.create({
      data: {
        storeName: 'MUKI RAMEN',
        phone: '081298765432',
        address: 'Jl. Senopati No. 88, Jakarta Selatan',
        taxRate: 10,
        serviceCharge: 5,
        receiptHeader: 'MUKI RAMEN - Authentic Japanese Ramen Bar',
        receiptFooter: 'Arigatou Gozaimasu!\nFollow Instagram kami: @mukiramen.id',
      }
    });
  }
  console.log('✅ 1. Pengaturan Toko MUKI RAMEN berhasil disimpan.');

  // 2. Suppliers
  await prisma.supplier.deleteMany();
  const supMie = await prisma.supplier.create({
    data: {
      name: 'PT Sumber Mie Sejahtera',
      contact: 'Budi Santoso',
      phone: '081122334455',
      address: 'Kawasan Industri Pulo Gadung, Jakarta',
    }
  });

  const supDaging = await prisma.supplier.create({
    data: {
      name: 'Prima Unggas & Daging Nusantara',
      contact: 'Hendra Wijaya',
      phone: '081299887766',
      address: 'Pasar Santa Blok A, Jakarta Selatan',
    }
  });

  const supJepang = await prisma.supplier.create({
    data: {
      name: 'Tokyo Asian Ingredients Importer',
      contact: 'Kenji Takahashi',
      phone: '081377889900',
      address: 'Ruko Kelapa Gading Square, Jakarta Utara',
    }
  });
  console.log('✅ 2. Data Supplier berhasil dibuat.');

  // 3. Clear Old Ingredients, Recipes, Products, Categories
  await prisma.recipeItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.ingredientLog.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // 4. Create Ingredients (Bahan Baku)
  const ingMie = await prisma.ingredient.create({
    data: { name: 'Mie Ramen Fresh', unit: 'gram', stock: 25000, minStock: 3000, buyPrice: 15, supplierId: supMie.id }
  });
  const ingKaldu = await prisma.ingredient.create({
    data: { name: 'Kaldu Tori Paitan', unit: 'ml', stock: 50000, minStock: 6000, buyPrice: 20, supplierId: supDaging.id }
  });
  const ingShoyuTare = await prisma.ingredient.create({
    data: { name: 'Shoyu Tare (Saus Asin)', unit: 'ml', stock: 10000, minStock: 1000, buyPrice: 50, supplierId: supJepang.id }
  });
  const ingMisoTare = await prisma.ingredient.create({
    data: { name: 'Miso Tare Paste', unit: 'gram', stock: 5000, minStock: 600, buyPrice: 45, supplierId: supJepang.id }
  });
  const ingChiliOil = await prisma.ingredient.create({
    data: { name: 'Spicy Chili Oil (Rayu)', unit: 'ml', stock: 5000, minStock: 500, buyPrice: 60, supplierId: supJepang.id }
  });
  const ingMinyakWijen = await prisma.ingredient.create({
    data: { name: 'Minyak Wijen (Sesame Oil)', unit: 'ml', stock: 5000, minStock: 500, buyPrice: 80, supplierId: supJepang.id }
  });
  const ingChashu = await prisma.ingredient.create({
    data: { name: 'Chicken Chashu Slice', unit: 'gram', stock: 15000, minStock: 2000, buyPrice: 65, supplierId: supDaging.id }
  });
  const ingMincedChicken = await prisma.ingredient.create({
    data: { name: 'Daging Ayam Cincang', unit: 'gram', stock: 10000, minStock: 1500, buyPrice: 50, supplierId: supDaging.id }
  });
  const ingTamago = await prisma.ingredient.create({
    data: { name: 'Telur Ajitsuke Tamago', unit: 'butir', stock: 200, minStock: 30, buyPrice: 3500, supplierId: supDaging.id }
  });
  const ingKikurage = await prisma.ingredient.create({
    data: { name: 'Jamur Kikurage Iris', unit: 'gram', stock: 5000, minStock: 800, buyPrice: 30, supplierId: supJepang.id }
  });
  const ingNegi = await prisma.ingredient.create({
    data: { name: 'Daun Bawang Negi', unit: 'gram', stock: 6000, minStock: 1000, buyPrice: 25, supplierId: supDaging.id }
  });
  const ingNori = await prisma.ingredient.create({
    data: { name: 'Nori Sheet', unit: 'lembar', stock: 500, minStock: 60, buyPrice: 800, supplierId: supJepang.id }
  });
  const ingMenma = await prisma.ingredient.create({
    data: { name: 'Menma Rebung Jepang', unit: 'gram', stock: 4000, minStock: 500, buyPrice: 60, supplierId: supJepang.id }
  });
  const ingWijen = await prisma.ingredient.create({
    data: { name: 'Biji Wijen Sangrai', unit: 'gram', stock: 2000, minStock: 300, buyPrice: 40, supplierId: supJepang.id }
  });
  const ingKulitGyoza = await prisma.ingredient.create({
    data: { name: 'Kulit Gyoza', unit: 'lembar', stock: 350, minStock: 50, buyPrice: 400, supplierId: supMie.id }
  });
  const ingPahaAyam = await prisma.ingredient.create({
    data: { name: 'Paha Ayam Fillet', unit: 'gram', stock: 12000, minStock: 2000, buyPrice: 60, supplierId: supDaging.id }
  });
  const ingTepungKaraage = await prisma.ingredient.create({
    data: { name: 'Tepung Karaage Bumbu', unit: 'gram', stock: 5000, minStock: 800, buyPrice: 35, supplierId: supMie.id }
  });
  const ingOcha = await prisma.ingredient.create({
    data: { name: 'Teh Ocha Jepang', unit: 'gram', stock: 3000, minStock: 400, buyPrice: 100, supplierId: supJepang.id }
  });
  const ingYuzu = await prisma.ingredient.create({
    data: { name: 'Sirup Yuzu Lemon', unit: 'ml', stock: 5000, minStock: 500, buyPrice: 50, supplierId: supJepang.id }
  });
  const ingAirMineral = await prisma.ingredient.create({
    data: { name: 'Air Mineral Botol 600ml', unit: 'botol', stock: 120, minStock: 24, buyPrice: 3000 }
  });

  console.log('✅ 3. Seluruh Bahan Baku (Ingredients) Muki Ramen berhasil dibuat.');

  // 5. Create Categories
  const catSignature = await prisma.category.create({ data: { name: 'Signature Ramen' } });
  const catSpicy = await prisma.category.create({ data: { name: 'Spicy & Miso Ramen' } });
  const catDry = await prisma.category.create({ data: { name: 'Dry Ramen (Abura)' } });
  const catSides = await prisma.category.create({ data: { name: 'Appetizer & Sides' } });
  const catTopping = await prisma.category.create({ data: { name: 'Extra Topping' } });
  const catBev = await prisma.category.create({ data: { name: 'Beverages' } });

  console.log('✅ 4. Kategori Menu berhasil dibuat.');

  // 6. Create Products & Recipes (BOM)
  // --- A. Signature Ramen ---
  const prodToriPaitan = await prisma.product.create({
    data: {
      name: 'Tori Paitan Ramen',
      categoryId: catSignature.id,
      buyPrice: 16500,
      sellPrice: 45000,
      stock: 100,
      barcode: 'MUKI-RAMEN-01',
      imageUrl: '/images/sol_signature.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodToriPaitan.id, ingredientId: ingMie.id, qtyPerServing: 120 },
      { productId: prodToriPaitan.id, ingredientId: ingKaldu.id, qtyPerServing: 300 },
      { productId: prodToriPaitan.id, ingredientId: ingShoyuTare.id, qtyPerServing: 30 },
      { productId: prodToriPaitan.id, ingredientId: ingChashu.id, qtyPerServing: 60 },
      { productId: prodToriPaitan.id, ingredientId: ingTamago.id, qtyPerServing: 0.5 },
      { productId: prodToriPaitan.id, ingredientId: ingKikurage.id, qtyPerServing: 15 },
      { productId: prodToriPaitan.id, ingredientId: ingNegi.id, qtyPerServing: 10 },
      { productId: prodToriPaitan.id, ingredientId: ingNori.id, qtyPerServing: 1 }
    ]
  });

  const prodShoyuRamen = await prisma.product.create({
    data: {
      name: 'Tori Paitan Shoyu Ramen',
      categoryId: catSignature.id,
      buyPrice: 16000,
      sellPrice: 45000,
      stock: 100,
      barcode: 'MUKI-RAMEN-02',
      imageUrl: '/images/sol_signature.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodShoyuRamen.id, ingredientId: ingMie.id, qtyPerServing: 120 },
      { productId: prodShoyuRamen.id, ingredientId: ingKaldu.id, qtyPerServing: 300 },
      { productId: prodShoyuRamen.id, ingredientId: ingShoyuTare.id, qtyPerServing: 35 },
      { productId: prodShoyuRamen.id, ingredientId: ingChashu.id, qtyPerServing: 60 },
      { productId: prodShoyuRamen.id, ingredientId: ingTamago.id, qtyPerServing: 0.5 },
      { productId: prodShoyuRamen.id, ingredientId: ingMenma.id, qtyPerServing: 15 },
      { productId: prodShoyuRamen.id, ingredientId: ingNegi.id, qtyPerServing: 10 },
      { productId: prodShoyuRamen.id, ingredientId: ingNori.id, qtyPerServing: 1 }
    ]
  });

  // --- B. Spicy & Miso Ramen ---
  const prodSpicyPaitan = await prisma.product.create({
    data: {
      name: 'Spicy Tori Paitan Ramen',
      categoryId: catSpicy.id,
      buyPrice: 17500,
      sellPrice: 48000,
      stock: 100,
      barcode: 'MUKI-RAMEN-03',
      imageUrl: '/images/sol_signature.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodSpicyPaitan.id, ingredientId: ingMie.id, qtyPerServing: 120 },
      { productId: prodSpicyPaitan.id, ingredientId: ingKaldu.id, qtyPerServing: 300 },
      { productId: prodSpicyPaitan.id, ingredientId: ingShoyuTare.id, qtyPerServing: 25 },
      { productId: prodSpicyPaitan.id, ingredientId: ingChiliOil.id, qtyPerServing: 15 },
      { productId: prodSpicyPaitan.id, ingredientId: ingChashu.id, qtyPerServing: 60 },
      { productId: prodSpicyPaitan.id, ingredientId: ingTamago.id, qtyPerServing: 0.5 },
      { productId: prodSpicyPaitan.id, ingredientId: ingKikurage.id, qtyPerServing: 15 },
      { productId: prodSpicyPaitan.id, ingredientId: ingNegi.id, qtyPerServing: 10 },
      { productId: prodSpicyPaitan.id, ingredientId: ingNori.id, qtyPerServing: 1 }
    ]
  });

  const prodSpicyMiso = await prisma.product.create({
    data: {
      name: 'Spicy Miso Ramen',
      categoryId: catSpicy.id,
      buyPrice: 18000,
      sellPrice: 48000,
      stock: 100,
      barcode: 'MUKI-RAMEN-04',
      imageUrl: '/images/sol_signature.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodSpicyMiso.id, ingredientId: ingMie.id, qtyPerServing: 120 },
      { productId: prodSpicyMiso.id, ingredientId: ingKaldu.id, qtyPerServing: 280 },
      { productId: prodSpicyMiso.id, ingredientId: ingMisoTare.id, qtyPerServing: 35 },
      { productId: prodSpicyMiso.id, ingredientId: ingChiliOil.id, qtyPerServing: 15 },
      { productId: prodSpicyMiso.id, ingredientId: ingChashu.id, qtyPerServing: 60 },
      { productId: prodSpicyMiso.id, ingredientId: ingTamago.id, qtyPerServing: 0.5 },
      { productId: prodSpicyMiso.id, ingredientId: ingNegi.id, qtyPerServing: 10 },
      { productId: prodSpicyMiso.id, ingredientId: ingNori.id, qtyPerServing: 1 }
    ]
  });

  const prodTantanmen = await prisma.product.create({
    data: {
      name: 'Tantanmen Ramen',
      categoryId: catSpicy.id,
      buyPrice: 19000,
      sellPrice: 50000,
      stock: 100,
      barcode: 'MUKI-RAMEN-05',
      imageUrl: '/images/sol_signature.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodTantanmen.id, ingredientId: ingMie.id, qtyPerServing: 120 },
      { productId: prodTantanmen.id, ingredientId: ingKaldu.id, qtyPerServing: 280 },
      { productId: prodTantanmen.id, ingredientId: ingMincedChicken.id, qtyPerServing: 60 },
      { productId: prodTantanmen.id, ingredientId: ingMinyakWijen.id, qtyPerServing: 15 },
      { productId: prodTantanmen.id, ingredientId: ingChiliOil.id, qtyPerServing: 15 },
      { productId: prodTantanmen.id, ingredientId: ingWijen.id, qtyPerServing: 5 },
      { productId: prodTantanmen.id, ingredientId: ingTamago.id, qtyPerServing: 0.5 },
      { productId: prodTantanmen.id, ingredientId: ingNegi.id, qtyPerServing: 10 }
    ]
  });

  // --- C. Dry Ramen / Abura Soba ---
  const prodAburaSoba = await prisma.product.create({
    data: {
      name: 'Tori Abura Soba',
      categoryId: catDry.id,
      buyPrice: 14000,
      sellPrice: 42000,
      stock: 100,
      barcode: 'MUKI-RAMEN-06',
      imageUrl: '/images/tuna_melt_sando.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodAburaSoba.id, ingredientId: ingMie.id, qtyPerServing: 140 },
      { productId: prodAburaSoba.id, ingredientId: ingShoyuTare.id, qtyPerServing: 25 },
      { productId: prodAburaSoba.id, ingredientId: ingMinyakWijen.id, qtyPerServing: 15 },
      { productId: prodAburaSoba.id, ingredientId: ingChashu.id, qtyPerServing: 50 },
      { productId: prodAburaSoba.id, ingredientId: ingTamago.id, qtyPerServing: 1 },
      { productId: prodAburaSoba.id, ingredientId: ingNegi.id, qtyPerServing: 15 },
      { productId: prodAburaSoba.id, ingredientId: ingWijen.id, qtyPerServing: 3 },
      { productId: prodAburaSoba.id, ingredientId: ingNori.id, qtyPerServing: 1 }
    ]
  });

  // --- D. Appetizers & Sides ---
  const prodGyoza = await prisma.product.create({
    data: {
      name: 'Pan-Fried Chicken Gyoza (5 pcs)',
      categoryId: catSides.id,
      buyPrice: 9000,
      sellPrice: 28000,
      stock: 60,
      barcode: 'MUKI-SIDE-01',
      imageUrl: '/images/mushroom_quiche.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodGyoza.id, ingredientId: ingKulitGyoza.id, qtyPerServing: 5 },
      { productId: prodGyoza.id, ingredientId: ingMincedChicken.id, qtyPerServing: 100 },
      { productId: prodGyoza.id, ingredientId: ingNegi.id, qtyPerServing: 15 },
      { productId: prodGyoza.id, ingredientId: ingMinyakWijen.id, qtyPerServing: 5 }
    ]
  });

  const prodKaraage = await prisma.product.create({
    data: {
      name: 'Crispy Tori Karaage (4 pcs)',
      categoryId: catSides.id,
      buyPrice: 11000,
      sellPrice: 30000,
      stock: 60,
      barcode: 'MUKI-SIDE-02',
      imageUrl: '/images/mushroom_quiche.png'
    }
  });
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodKaraage.id, ingredientId: ingPahaAyam.id, qtyPerServing: 150 },
      { productId: prodKaraage.id, ingredientId: ingTepungKaraage.id, qtyPerServing: 40 }
    ]
  });

  // --- E. Extra Toppings ---
  const prodExtraChashu = await prisma.product.create({
    data: {
      name: 'Extra Chicken Chashu (2 pcs)',
      categoryId: catTopping.id,
      buyPrice: 4000,
      sellPrice: 15000,
      stock: 100,
      barcode: 'MUKI-TOP-01',
      imageUrl: '/images/tamago_sando.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodExtraChashu.id, ingredientId: ingChashu.id, qtyPerServing: 60 }
  });

  const prodExtraTamago = await prisma.product.create({
    data: {
      name: 'Extra Ajitsuke Tamago (1 butir)',
      categoryId: catTopping.id,
      buyPrice: 3500,
      sellPrice: 8000,
      stock: 100,
      barcode: 'MUKI-TOP-02',
      imageUrl: '/images/tamago_sando.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodExtraTamago.id, ingredientId: ingTamago.id, qtyPerServing: 1 }
  });

  const prodKaedama = await prisma.product.create({
    data: {
      name: 'Kaedama (Extra Mie 1 Porsi)',
      categoryId: catTopping.id,
      buyPrice: 1800,
      sellPrice: 10000,
      stock: 100,
      barcode: 'MUKI-TOP-03',
      imageUrl: '/images/tamago_sando.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodKaedama.id, ingredientId: ingMie.id, qtyPerServing: 120 }
  });

  // --- F. Beverages ---
  const prodColdOcha = await prisma.product.create({
    data: {
      name: 'Cold Ocha (Free Refill)',
      categoryId: catBev.id,
      buyPrice: 500,
      sellPrice: 12000,
      stock: 200,
      barcode: 'MUKI-BEV-01',
      imageUrl: '/images/matcha_latte.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodColdOcha.id, ingredientId: ingOcha.id, qtyPerServing: 3 }
  });

  const prodHotOcha = await prisma.product.create({
    data: {
      name: 'Hot Ocha (Free Refill)',
      categoryId: catBev.id,
      buyPrice: 500,
      sellPrice: 12000,
      stock: 200,
      barcode: 'MUKI-BEV-02',
      imageUrl: '/images/matcha_latte.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodHotOcha.id, ingredientId: ingOcha.id, qtyPerServing: 3 }
  });

  const prodYuzuSoda = await prisma.product.create({
    data: {
      name: 'Yuzu Sparkling Soda',
      categoryId: catBev.id,
      buyPrice: 3500,
      sellPrice: 25000,
      stock: 100,
      barcode: 'MUKI-BEV-03',
      imageUrl: '/images/matcha_tonic.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodYuzuSoda.id, ingredientId: ingYuzu.id, qtyPerServing: 40 }
  });

  const prodAirMineral = await prisma.product.create({
    data: {
      name: 'Air Mineral 600ml',
      categoryId: catBev.id,
      buyPrice: 3000,
      sellPrice: 8000,
      stock: 100,
      barcode: 'MUKI-BEV-04',
      imageUrl: '/images/sol_signature.png'
    }
  });
  await prisma.recipeItem.create({
    data: { productId: prodAirMineral.id, ingredientId: ingAirMineral.id, qtyPerServing: 1 }
  });

  console.log('✅ 5. Menu Produk dan Resep (BOM) Muki Ramen berhasil dibuat.');
  console.log('🎉 SEEDING MUKI RAMEN SELESAI DENGAN SUKSES!');
}

seedMukiRamen()
  .catch((e) => {
    console.error('❌ Error saat seeding:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
