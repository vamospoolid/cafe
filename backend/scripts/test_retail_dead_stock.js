const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRetailDeadStock() {
  console.log('🔬 Menguji Fitur Dead Stock (Barang Tidak Bergerak) & Modal Tertahan...');
  const tenantId = `test-deadstock-${Date.now()}`;
  let user;

  try {
    // 1. Buat Tenant
    await prisma.tenant.create({
      data: {
        id: tenantId,
        slug: tenantId,
        name: 'Toko Material Dead Stock Test',
        businessType: 'RETAIL'
      }
    });

    // 1b. Buat User
    user = await prisma.user.create({
      data: {
        username: `kasir_${Date.now()}`,
        passwordHash: 'dummy_hash',
        name: 'Kasir Dead Stock',
        role: 'OWNER',
        permissions: '[]',
        memberships: { create: { tenantId } }
      }
    });

    // 2. Buat Kategori
    const cat = await prisma.category.create({
      data: {
        name: 'Material & Bangunan',
        tenantId
      }
    });

    // 3. Buat 3 Produk:
    // P1: Semen (Stok: 50, Modal: 50.000) -> Ada Penjualan (Bukan Dead Stock)
    // P2: Cat Tembok (Stok: 20, Modal: 100.000) -> 0 Penjualan (Dead Stock, Modal: 2.000.000)
    // P3: Paku Beton (Stok: 10, Modal: 15.000) -> 0 Penjualan (Dead Stock, Modal: 150.000)
    const p1 = await prisma.product.create({
      data: {
        name: 'Semen Gresik 40kg',
        stock: 50,
        buyPrice: 50000,
        sellPrice: 65000,
        categoryId: cat.id,
        tenantId
      }
    });

    const p2 = await prisma.product.create({
      data: {
        name: 'Cat Tembok Putih 5kg',
        stock: 20,
        buyPrice: 100000,
        sellPrice: 130000,
        categoryId: cat.id,
        tenantId
      }
    });

    const p3 = await prisma.product.create({
      data: {
        name: 'Paku Beton 5cm',
        stock: 10,
        buyPrice: 15000,
        sellPrice: 20000,
        categoryId: cat.id,
        tenantId
      }
    });

    // 4. Buat 1 Order untuk P1 (Semen)
    await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        customerName: 'Pelanggan Umum',
        userId: user.id,
        subtotal: 650000,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 650000,
        status: 'Completed',
        paidAt: new Date(),
        paymentMethod: 'CASH',
        tenantId,
        items: {
          create: [
            {
              productId: p1.id,
              qty: 10,
              price: 65000,
              buyPrice: 50000,
              subtotal: 650000
            }
          ]
        }
      }
    });

    // 5. Simulasikan logic GET /api/retail/reports
    const orders = await prisma.order.findMany({
      where: { tenantId },
      include: { items: true }
    });

    const productMap = {};
    for (const ord of orders) {
      for (const item of ord.items) {
        if (item.productId) {
          productMap[item.productId] = true;
        }
      }
    }

    const allStockedProducts = await prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        stock: true,
        buyPrice: true,
        sellPrice: true,
        storageLocation: true,
        baseUom: true,
        category: { select: { id: true, name: true } }
      }
    });

    const soldProductIds = new Set(Object.keys(productMap).map(Number));

    const deadStockProducts = allStockedProducts
      .filter(p => !soldProductIds.has(p.id))
      .map(p => {
        const buyP = Number(p.buyPrice || 0);
        return {
          id: p.id,
          name: p.name,
          category: p.category?.name || 'Retail',
          stock: p.stock,
          baseUom: p.baseUom || 'PCS',
          buyPrice: buyP,
          sellPrice: Number(p.sellPrice || 0),
          storageLocation: p.storageLocation || 'Rak Etalase',
          tiedUpCapital: p.stock * buyP
        };
      })
      .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

    const totalTiedUpCapital = deadStockProducts.reduce((sum, p) => sum + p.tiedUpCapital, 0);

    console.log(`\n📊 Hasil Analisis Dead Stock:`);
    console.log(`   - Jumlah Dead Stock terdeteksi: ${deadStockProducts.length} produk`);
    console.log(`   - Total Modal Tertahan: Rp ${totalTiedUpCapital.toLocaleString('id-ID')}`);

    deadStockProducts.forEach((p, idx) => {
      console.log(`     ${idx + 1}. ${p.name} | Stok: ${p.stock} | HPP: Rp ${p.buyPrice.toLocaleString('id-ID')} | Modal Mengendap: Rp ${p.tiedUpCapital.toLocaleString('id-ID')}`);
    });

    // Validasi
    if (deadStockProducts.length !== 2) {
      throw new Error(`Ekspektasi 2 dead stock (Cat & Paku), tetapi terdeteksi ${deadStockProducts.length}`);
    }

    if (totalTiedUpCapital !== 2150000) {
      throw new Error(`Ekspektasi modal tertahan Rp 2.150.000, tetapi terhitung Rp ${totalTiedUpCapital}`);
    }

    if (deadStockProducts[0].id !== p2.id) {
      throw new Error(`Ekspektasi produk tertinggi adalah Cat Tembok, tetapi terdeteksi ID ${deadStockProducts[0].id}`);
    }

    console.log('\n✅ VALIDASI DEAD STOCK & MODAL TERTAHAN: 100% SUKSES!');
  } finally {
    // Cleanup
    await prisma.orderItem.deleteMany({ where: { order: { tenantId } } }).catch(() => {});
    await prisma.order.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.product.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.category.deleteMany({ where: { tenantId } }).catch(() => {});
    if (user?.id) await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    console.log('🧹 Tenant uji dibersihkan.');
    await prisma.$disconnect();
  }
}

testRetailDeadStock().catch(err => {
  console.error('❌ Gagal uji:', err);
  process.exit(1);
});
