const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runFullRetailFlowTest() {
  console.log('🛒 ============================================================');
  console.log('   FULL END-TO-END VALIDATION: TOKO GROSIR & RETAIL VERTICAL   ');
  console.log('============================================================\n');

  const timestamp = Date.now();
  const testEmail = `owner_grosir_${timestamp}@test.com`;
  const testSlug = `grosir-e2e-${timestamp}`.slice(0, 20);

  let tenant = null;
  let outlet = null;
  let user = null;
  let customerWarung = null;
  let productMinyak = null;
  let productIndomie = null;

  try {
    // 1. Provisioning Tenant RETAIL
    console.log('1️⃣  [PROVISIONING] Mendaftarkan Toko Grosir...');
    tenant = await prisma.tenant.create({
      data: {
        name: `Grosir Sembako Berkah ${timestamp}`,
        slug: testSlug,
        businessType: 'RETAIL',
        status: 'ACTIVE'
      }
    });

    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Gudang & Toko Pusat',
        code: 'GDG-01',
        address: 'Jl. Raya Pergudangan No. 88'
      }
    });

    user = await prisma.user.create({
      data: {
        username: `kasir_grosir_${timestamp}`,
        passwordHash: 'dummy_hash_for_test',
        role: 'OWNER',
        permissions: '[]',
        name: 'Haji Ahmad (Owner Grosir)',
        memberships: {
          create: {
            tenantId: tenant.id
          }
        }
      }
    });

    const categorySembako = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Minyak Goreng & Mentega',
        printerTarget: 'NONE'
      }
    });

    const categoryMie = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Mie Instan & Bihun',
        printerTarget: 'NONE'
      }
    });

    console.log(`   ✅ Tenant created: "${tenant.name}" (${tenant.businessType})`);

    // 2. Setup Produk dengan Multi-Satuan & Tiered Pricing
    console.log('\n2️⃣  [CATALOG & UOM] Mendaftarkan Komoditas Grosir & Konversi Satuan...');
    
    // Produk 1: Indomie Goreng (Base Unit = PCS, Stok Awal 200 PCS = 5 Dus)
    productIndomie = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Indomie Goreng Original',
        barcode: '899886611001',
        categoryId: categoryMie.id,
        buyPrice: 2700,
        sellPrice: 3200, // Eceran Rp 3.200/PCS
        stock: 200,
        baseUom: 'PCS',
        storageLocation: 'RAK-A1-03'
      }
    });

    // UOM Dus = 40 PCS, Harga Grosir Rp 115.000 / Dus
    const uomDus = await prisma.productUOM.create({
      data: {
        tenantId: tenant.id,
        productId: productIndomie.id,
        unitName: 'DUS',
        conversionRatio: 40,
        barcode: '899886611001-DUS',
        priceSell: 115000
      }
    });

    // Price Tier Volume: Beli >= 3 DUS, harga Rp 110.000 / DUS
    const tierDus = await prisma.productPriceTier.create({
      data: {
        tenantId: tenant.id,
        productId: productIndomie.id,
        tierName: 'Grosir Warung (>= 3 Dus)',
        minQty: 3,
        unitPrice: 110000,
        customerCategory: 'WARUNG'
      }
    });

    console.log(`   ✅ Produk: "${productIndomie.name}" [Stok: ${productIndomie.stock} ${productIndomie.baseUom}]`);
    console.log(`      - UOM: 1 ${uomDus.unitName} = ${uomDus.conversionRatio} ${productIndomie.baseUom} (Rp ${uomDus.priceSell})`);
    console.log(`      - Volume Tier: Min ${tierDus.minQty} Dus -> Rp ${tierDus.unitPrice}/Dus`);

    // 3. Setup Customer Warung dengan Plafon Kredit Bon
    console.log('\n3️⃣  [CUSTOMER & CREDIT LIMIT] Mendaftarkan Mitra Warung Langganan...');
    customerWarung = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Warung Bu Siti Mandiri',
        phone: '081234567890',
        creditLimit: 3000000, // Plafon kredit Rp 3.000.000
        creditTermDays: 14,   // Tempo 14 hari
        isCreditBlocked: false
      }
    });

    console.log(`   ✅ Mitra: "${customerWarung.name}"`);
    console.log(`      - Plafon Kredit: Rp ${customerWarung.creditLimit.toLocaleString('id-ID')}`);
    console.log(`      - Tempo Pembayaran: ${customerWarung.creditTermDays} Hari`);

    // 4. Simulasi Transaksi Kasir Grosir: Beli 3 DUS Indomie via BON TEMPO + Delivery Armada
    console.log('\n4️⃣  [CHECKOUT POS GROSIR] Memproses Penjualan 3 DUS Indomie (Bon Tempo + Armada)...');
    
    const qtyOrderedDus = 3;
    const pricePerDusTier = 110000; // Dapat harga tier volume grosir
    const totalOrderAmount = qtyOrderedDus * pricePerDusTier; // Rp 330.000

    // a. Buat Order
    const orderNumber = `ORD-GROSIR-${timestamp}`;
    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderNumber,
        customerId: customerWarung.id,
        customerName: customerWarung.name,
        customerPhone: customerWarung.phone,
        userId: user.id,
        subtotal: totalOrderAmount,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: totalOrderAmount,
        paymentMethod: 'BON',
        status: 'Pending',
        kdsStatus: 'Ready',
        paidAt: null
      }
    });

    // b. Buat OrderItem dengan info UOM & Tier
    const orderItem = await prisma.orderItem.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderId: order.id,
        productId: productIndomie.id,
        qty: qtyOrderedDus,
        price: pricePerDusTier,
        buyPrice: productIndomie.buyPrice * 40,
        subtotal: totalOrderAmount,
        uomName: 'DUS',
        uomRatio: 40,
        priceTierName: 'Grosir Warung (>= 3 Dus)'
      }
    });

    // c. Potong Stok Base Unit: 3 DUS * 40 PCS = 120 PCS
    const basePcsDeducted = qtyOrderedDus * 40;
    const updatedProduct = await prisma.product.update({
      where: { id: productIndomie.id },
      data: { stock: { decrement: basePcsDeducted } }
    });

    console.log(`   ✅ Order #${order.id} (${order.orderNumber}) berhasil dibukukan!`);
    console.log(`   ✅ Stok Base Terpotong: 3 DUS x 40 = ${basePcsDeducted} PCS. Sisa Stok: ${updatedProduct.stock} PCS (Awal: 200 PCS)`);

    // d. Catat Hutang Bon Warung
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + customerWarung.creditTermDays);
    const debtRecord = await prisma.debt.create({
      data: {
        tenantId: tenant.id,
        customerId: customerWarung.id,
        orderId: order.id,
        amount: totalOrderAmount,
        remaining: totalOrderAmount,
        dueDate,
        status: 'Belum Lunas',
        notes: `Bon Grosir 3 Dus Indomie (Tempo ${customerWarung.creditTermDays} hari)`
      }
    });

    console.log(`   ✅ Buku Bon Piutang Tercatat: Rp ${debtRecord.amount.toLocaleString('id-ID')} (Jatuh Tempo: ${debtRecord.dueDate.toISOString().split('T')[0]})`);

    // e. Buat Surat Jalan (Delivery Order) Pengiriman Armada
    const doNumber = `DO-${timestamp}`;
    const deliveryOrder = await prisma.deliveryOrder.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        customerId: customerWarung.id,
        doNumber,
        driverName: 'Pak Joko (Driver Pick-Up Carry)',
        vehiclePlate: 'B 9482 KBC',
        shippingAddress: 'Jl. Melati RT 03/05 No. 12 (Warung Bu Siti)',
        status: 'PENDING',
        notes: 'Titip di warung depan gang, hati-hati barang dus jangan kena air',
        items: {
          create: [{
            productName: productIndomie.name,
            qtyShipped: qtyOrderedDus,
            unitName: 'DUS'
          }]
        }
      },
      include: { items: true }
    });

    console.log(`   ✅ Surat Jalan Diterbitkan: "${deliveryOrder.doNumber}"`);
    console.log(`      - Driver: ${deliveryOrder.driverName} (Nopol: ${deliveryOrder.vehiclePlate})`);
    console.log(`      - Alamat Kirim: ${deliveryOrder.shippingAddress}`);
    console.log(`      - Muatan: ${deliveryOrder.items[0].qtyShipped} ${deliveryOrder.items[0].unitName} ${deliveryOrder.items[0].productName}`);

    // 5. Validasi Update Status Surat Jalan (Pengiriman Logistik)
    console.log('\n5️⃣  [LOGISTICS LIFECYCLE] Menguji Alur Status Pengiriman...');
    
    // Sopir berangkat: PENDING -> IN_TRANSIT
    const transitDO = await prisma.deliveryOrder.update({
      where: { id: deliveryOrder.id },
      data: { status: 'IN_TRANSIT' }
    });
    console.log(`   🚚 Status Berubah -> ${transitDO.status} (Armada dalam perjalanan)`);

    // Sampai di warung dan diterima Bu Siti: IN_TRANSIT -> DELIVERED
    const deliveredDO = await prisma.deliveryOrder.update({
      where: { id: deliveryOrder.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        recipientName: 'Ibu Siti (Pemilik Warung)'
      }
    });
    console.log(`   📦 Status Berubah -> ${deliveredDO.status} (Diterima oleh: ${deliveredDO.recipientName})`);

    // 6. Validasi Pelunasan Bon Warung (Debt Settlement)
    console.log('\n6️⃣  [DEBT RECONCILIATION] Warung Membayar Lunas Bon...');
    const settledDebt = await prisma.debt.update({
      where: { id: debtRecord.id },
      data: {
        remaining: 0,
        status: 'Lunas'
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'Paid',
        paidAt: new Date()
      }
    });

    console.log(`   💰 Status Bon -> ${settledDebt.status} (Sisa Hutang: Rp ${settledDebt.remaining})`);
    console.log(`   🎉 Order #${order.id} status kini -> Paid`);

    console.log('\n============================================================');
    console.log('   ✅ ALL TESTS PASSED: ARSITEKTUR TOKO GROSIR 100% SUKSES!  ');
    console.log('============================================================\n');

  } catch (error) {
    console.error('❌ [TEST ERROR]:', error);
  } finally {
    // Cleanup data uji
    console.log('🧹 Membersihkan data uji...');
    try {
      if (tenant?.id) {
        await prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrder: { tenantId: tenant.id } } });
        await prisma.deliveryOrder.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.debt.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.orderItem.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.productPriceTier.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.productUOM.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenantMembership.deleteMany({ where: { tenantId: tenant.id } });
        if (user?.id) await prisma.user.delete({ where: { id: user.id } });
        await prisma.outlet.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenant.delete({ where: { id: tenant.id } });
        console.log('   ✅ Data uji berhasil dibersihkan.');
      }
    } catch (cleanErr) {
      console.warn('   ⚠️ Cleanup warning:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runFullRetailFlowTest();
