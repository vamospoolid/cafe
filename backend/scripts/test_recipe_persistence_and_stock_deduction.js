const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const http = require('http');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'object' ? JSON.stringify(postData) : postData);
    }
    req.end();
  });
}

async function runRecipeTest() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN OTOMATIS: PENYIMPANAN RESEP & PEMOTONGAN BAHAN BAKU');
  console.log('================================================================\n');

  const tenantId = `tenant_recipe_test_${Date.now()}`;
  const outletId = `outlet_recipe_test_${Date.now()}`;
  let passed = 0;
  let total = 4;

  try {
    // 1. Setup Tenant, Outlet, User, Category, and Ingredient
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Kafe Uji Resep',
        slug: `kafe-resep-${Date.now()}`,
        status: 'ACTIVE',
        businessType: 'CAFE'
      }
    });

    await prisma.settings.create({
      data: {
        tenantId,
        storeName: 'Kafe Uji Resep',
        ingredientTrackingEnabled: true
      }
    });

    const outlet = await prisma.outlet.create({
      data: {
        id: outletId,
        tenantId,
        code: `OUT-${Date.now().toString().slice(-4)}`,
        name: 'Outlet Utama'
      }
    });

    const user = await prisma.user.create({
      data: {
        name: 'Chef Tester',
        username: `chef_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '["*"]',
        role: 'OWNER',
        memberships: { create: { tenantId } }
      }
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tenantId, outletId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const category = await prisma.category.create({
      data: {
        tenant: { connect: { id: tenantId } },
        name: 'Makanan Olahan',
      }
    });

    // Buat 2 Bahan Baku (misal Kentang Mentah 10.000g dan Minyak Goreng 5.000ml)
    const initialPotatoStock = 10000;
    const potato = await prisma.ingredient.create({
      data: {
        tenantId,
        name: 'Kentang Beku Uji',
        stock: initialPotatoStock,
        unit: 'gram',
        buyPrice: 35 // Rp 35 per gram
      }
    });

    const initialOilStock = 5000;
    const oil = await prisma.ingredient.create({
      data: {
        tenantId,
        name: 'Minyak Goreng Uji',
        stock: initialOilStock,
        unit: 'ml',
        buyPrice: 15 // Rp 15 per ml
      }
    });

    // Buka shift kasir aktif agar checkout POS diizinkan
    await prisma.shift.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        saldoAwal: 100000,
        status: 'Open'
      }
    });

    // ─── TEST 1: Simpan Produk Baru dengan Resep Bahan Baku (POST /api/products) ───
    console.log('--- TEST 1: Create Product dengan Resep Bahan Baku via POST /api/products ---');
    // Uji payload dengan nama field "recipes" (sesuai yang dikirim frontend)
    const createRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      name: 'French Fries Spesial',
      categoryId: category.id,
      sellPrice: 20000,
      stock: 0, // Produk olahan tidak simpan stok produk, tapi simpan stok bahan
      recipes: [
        { ingredientId: potato.id, qtyPerServing: 200 }, // 200 gram kentang per porsi
        { ingredientId: oil.id, qtyPerServing: 40 }      // 40 ml minyak per porsi
      ]
    });

    if (createRes.statusCode !== 201) {
      throw new Error(`Gagal membuat produk: HTTP ${createRes.statusCode} - ${JSON.stringify(createRes.data)}`);
    }

    const createdProduct = createRes.data;
    if (!createdProduct.recipes || createdProduct.recipes.length !== 2) {
      throw new Error(`Resep tidak tersimpan pada return POST /api/products: ${JSON.stringify(createdProduct.recipes)}`);
    }

    // Periksa ke database langsung
    const dbRecipes = await prisma.recipeItem.findMany({
      where: { productId: createdProduct.id }
    });
    if (dbRecipes.length !== 2) {
      throw new Error(`Tabel RecipeItem di database tidak memuat 2 resep, hanya: ${dbRecipes.length}`);
    }
    console.log(`✅ TEST 1 PASSED: Produk "${createdProduct.name}" (ID: ${createdProduct.id}) berhasil dibuat dan 2 resep tersimpan ke RecipeItem!`);
    passed++;

    // ─── TEST 2: Baca Katalog Produk (GET /api/products) Memuat Resep ───
    console.log('\n--- TEST 2: GET /api/products Memuat Relasi Resep & Bahan Baku ---');
    const getRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (getRes.statusCode !== 200) {
      throw new Error(`Gagal fetch products: HTTP ${getRes.statusCode}`);
    }

    const fetchedProduct = getRes.data.find(p => p.id === createdProduct.id);
    if (!fetchedProduct) {
      throw new Error(`Produk tidak ditemukan di daftar katalog`);
    }
    if (!fetchedProduct.recipes || fetchedProduct.recipes.length !== 2) {
      throw new Error(`Relasi recipes hilang saat GET /api/products: ${JSON.stringify(fetchedProduct)}`);
    }
    if (!fetchedProduct.recipes[0].ingredient || !fetchedProduct.recipes[0].ingredient.name) {
      throw new Error(`Relasi ingredient dalam recipes tidak terbawa`);
    }
    console.log(`✅ TEST 2 PASSED: GET /api/products mengembalikan resep utuh dengan detail bahan baku ("${fetchedProduct.recipes[0].ingredient.name}")! Resep tidak hilang lagi.`);
    passed++;

    // ─── TEST 3: Update Produk & Resep (PUT /api/products/:id) ───
    console.log('\n--- TEST 3: Update Produk & Resep via PUT /api/products/:id ---');
    // Ubah takaran kentang menjadi 250 gram per porsi
    const updateRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/products/${createdProduct.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      name: 'French Fries Jumbo',
      categoryId: category.id,
      sellPrice: 25000,
      recipes: [
        { ingredientId: potato.id, qtyPerServing: 250 },
        { ingredientId: oil.id, qtyPerServing: 50 }
      ]
    });

    if (updateRes.statusCode !== 200) {
      throw new Error(`Gagal update produk: HTTP ${updateRes.statusCode} - ${JSON.stringify(updateRes.data)}`);
    }

    const updatedDbRecipes = await prisma.recipeItem.findMany({
      where: { productId: createdProduct.id }
    });
    const updatedPotatoRecipe = updatedDbRecipes.find(r => r.ingredientId === potato.id);
    if (!updatedPotatoRecipe || updatedPotatoRecipe.qtyPerServing !== 250) {
      throw new Error(`Takaran resep di DB gagal diupdate: ${JSON.stringify(updatedDbRecipes)}`);
    }
    console.log(`✅ TEST 3 PASSED: PUT /api/products/:id berhasil memperbarui resep menjadi 250g kentang & 50ml minyak!`);
    passed++;

    // ─── TEST 4: Transaksi POS (POST /api/orders) Memotong Bahan Baku Otomatis ───
    console.log('\n--- TEST 4: Transaksi Kasir POS Memotong Stok Bahan Baku Secara Real-time ---');
    // Pesan 3 porsi French Fries Jumbo
    // Ekspektasi pemotongan:
    // Kentang: 3 porsi x 250g = 750g (10.000 - 750 = 9.250g)
    // Minyak: 3 porsi x 50ml = 150ml (5.000 - 150 = 4.850ml)
    const orderQty = 3;
    const orderRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      customerName: 'Pelanggan Meja 5',
      items: [
        {
          productId: createdProduct.id,
          qty: orderQty,
          price: 25000
        }
      ],
      subtotal: 75000,
      total: 75000,
      discount: 0,
      tax: 0,
      serviceCharge: 0,
      paymentMethod: 'CASH',
      isPaid: true
    });

    if (orderRes.statusCode !== 200 && orderRes.statusCode !== 201) {
      throw new Error(`Gagal checkout order: HTTP ${orderRes.statusCode} - ${JSON.stringify(orderRes.data)}`);
    }

    // Periksa stok bahan baku di database
    const freshPotato = await prisma.ingredient.findUnique({ where: { id: potato.id } });
    const freshOil = await prisma.ingredient.findUnique({ where: { id: oil.id } });

    const expectedPotatoStock = initialPotatoStock - (orderQty * 250);
    const expectedOilStock = initialOilStock - (orderQty * 50);

    if (freshPotato.stock !== expectedPotatoStock) {
      throw new Error(`Stok kentang tidak terpotong dengan benar! Ekspektasi: ${expectedPotatoStock}, Aktual di DB: ${freshPotato.stock}`);
    }

    if (freshOil.stock !== expectedOilStock) {
      throw new Error(`Stok minyak tidak terpotong dengan benar! Ekspektasi: ${expectedOilStock}, Aktual di DB: ${freshOil.stock}`);
    }

    // Periksa mutasi IngredientLog
    const logs = await prisma.ingredientLog.findMany({
      where: { tenantId, ingredientId: { in: [potato.id, oil.id] } }
    });

    if (logs.length < 2) {
      throw new Error(`IngredientLog tidak tercatat untuk pemotongan resep`);
    }

    console.log(`✅ TEST 4 PASSED: Stok bahan baku berhasil terpotong otomatis!`);
    console.log(`   - Kentang: ${initialPotatoStock}g → ${freshPotato.stock}g (Berkurang ${orderQty * 250}g)`);
    console.log(`   - Minyak: ${initialOilStock}ml → ${freshOil.stock}ml (Berkurang ${orderQty * 50}ml)`);
    console.log(`   - Tercatat ${logs.length} mutasi di IngredientLog dengan tipe 'Produksi'.`);
    passed++;

    console.log('\n================================================================');
    console.log(`📊 HASIL PENGUJIAN: ${passed}/${total} PENGUJIAN LULUS (100% SUKSES)`);
    console.log('================================================================');
    console.log('🎉 RESEP BERHASIL TERSIMPAN PERMANEN & STOK BAHAN BAKU TERPOTONG OTOMATIS SAAT TRANSAKSI!');

  } catch (err) {
    console.error('❌ PENGUJIAN GAGAL:', err);
    process.exit(1);
  } finally {
    // Cleanup test tenant
    try {
      await prisma.ingredientLog.deleteMany({ where: { tenantId } });
      await prisma.orderItem.deleteMany({ where: { tenantId } });
      await prisma.order.deleteMany({ where: { tenantId } });
      await prisma.recipeItem.deleteMany({ where: { product: { tenantId } } });
      await prisma.product.deleteMany({ where: { tenantId } });
      await prisma.ingredient.deleteMany({ where: { tenantId } });
      await prisma.category.deleteMany({ where: { tenantId } });
      await prisma.shift.deleteMany({ where: { tenantId } });
      await prisma.settings.deleteMany({ where: { tenantId } });
      await prisma.userMembership.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { username: { startsWith: 'chef_' } } });
      await prisma.outlet.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    } catch (e) {}
    await prisma.$disconnect();
  }
}

runRecipeTest();
