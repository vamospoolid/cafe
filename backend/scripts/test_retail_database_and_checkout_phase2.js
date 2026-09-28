const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTestPhase2() {
  console.log('🚀 [TEST PHASE 2] Memvalidasi Skema Multi-Satuan (UOM), Tiered Pricing, Kasir Bon & Surat Jalan...');

  const timestamp = Date.now();
  const testSlug = `grosirtest2_${timestamp}`.slice(0, 20);

  let tenant = null;
  let outlet = null;
  let category = null;
  let product = null;
  let customer = null;
  let order = null;

  try {
    // 1. Setup Tenant & Outlet
    tenant = await prisma.tenant.create({
      data: {
        name: `Toko Grosir Mandiri ${timestamp}`,
        slug: testSlug,
        businessType: 'RETAIL',
        status: 'ACTIVE'
      }
    });

    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Toko Utama',
        code: 'OUT-01'
      }
    });

    category = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Mie & Makanan Instan',
        printerTarget: 'NONE'
      }
    });

    // 2. Setup Produk dengan Base Unit = PCS & Stok = 120 PCS
    product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: 'Indomie Goreng Spesial',
        categoryId: category.id,
        buyPrice: 2500,
        sellPrice: 3000,
        stock: 120, // 120 PCS = 3 DUS
        baseUom: 'PCS'
      }
    });
    console.log(`✅ Produk Dibuat: "${product.name}", Stok Awal = ${product.stock} ${product.baseUom}`);

    // 3. Setup Multi-Satuan (UOM): 1 DUS = 40 PCS, Harga = Rp 112.000
    const uomDus = await prisma.productUOM.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        unitName: 'DUS',
        conversionRatio: 40,
        priceSell: 112000,
        isDefaultSale: false
      }
    });
    console.log(`✅ Multi-Satuan UOM Dibuat: 1 ${uomDus.unitName} = ${uomDus.conversionRatio} ${product.baseUom}, Harga Rp ${uomDus.priceSell}`);

    // 4. Setup Price Tier: Beli >= 5 DUS dapat Rp 108.000 / Dus
    const priceTier = await prisma.productPriceTier.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        minQty: 5,
        tierName: 'Grosir Partai 5 Dus',
        unitPrice: 108000,
        customerCategory: 'WARUNG'
      }
    });
    console.log(`✅ Price Tier Dibuat: Beli >= ${priceTier.minQty} Unit dapat Rp ${priceTier.unitPrice} (${priceTier.tierName})`);

    // 5. Setup Customer Warung dengan Plafon Kredit Rp 500.000
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Warung Bu Siti',
        phone: `0812${timestamp}`.slice(0, 13),
        priceTier: 'WARUNG',
        creditLimit: 500000,
        creditTermDays: 14
      }
    });
    console.log(`✅ Customer Warung Dibuat: "${customer.name}", Plafon Bon = Rp ${customer.creditLimit}, Jatuh Tempo = ${customer.creditTermDays} hari`);

    // 6. Simulasi Transaksi Kasir Grosir:
    // Warung Bu Siti beli 2 DUS Indomie Goreng (Harga 2 x 112.000 = Rp 224.000)
    // Pembayaran: BON TEMPO (Hutang)
    // Pengiriman: Surat Jalan (DO) via Truk Toko
    const qtyOrdered = 2; // 2 DUS
    const deductionInBaseUnit = qtyOrdered * uomDus.conversionRatio; // 2 * 40 = 80 PCS
    const totalOrder = qtyOrdered * uomDus.priceSell; // 224.000

    order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderNumber: `FK-TEST-${timestamp}`,
        customerName: customer.name,
        customerId: customer.id,
        userId: 1,
        subtotal: totalOrder,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: totalOrder,
        paymentMethod: 'BON',
        status: 'Pending',
        items: {
          create: [
            {
              tenantId: tenant.id,
              outletId: outlet.id,
              productId: product.id,
              qty: qtyOrdered,
              price: uomDus.priceSell,
              buyPrice: product.buyPrice * uomDus.conversionRatio,
              subtotal: totalOrder,
              uomName: uomDus.unitName,
              uomRatio: uomDus.conversionRatio
            }
          ]
        }
      }
    });

    // Potong Stok Base Unit
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: { decrement: deductionInBaseUnit } }
    });

    // Catat Piutang Bon (Debt)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + customer.creditTermDays);
    const debt = await prisma.debt.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        customerId: customer.id,
        amount: totalOrder,
        remaining: totalOrder,
        dueDate,
        status: 'Belum Lunas',
        notes: 'Bon Tempo 2 Dus Indomie'
      }
    });

    // Terbitkan Surat Jalan (Delivery Order)
    const deliveryOrder = await prisma.deliveryOrder.create({
      data: {
        tenantId: tenant.id,
        doNumber: `DO-TEST-${timestamp}`,
        orderId: order.id,
        customerId: customer.id,
        driverName: 'Pak Joko',
        vehiclePlate: 'B 9876 XYZ',
        shippingAddress: 'Jl. Melati No. 5 (Warung Bu Siti)',
        status: 'PENDING',
        items: {
          create: [
            {
              productName: product.name,
              qtyShipped: qtyOrdered,
              unitName: uomDus.unitName
            }
          ]
        }
      },
      include: { items: true }
    });

    console.log(`✅ Checkout Selesai! Faktur #${order.orderNumber} senilai Rp ${order.total} (Metode: ${order.paymentMethod})`);
    console.log(`✅ Surat Jalan Diterbitkan: #${deliveryOrder.doNumber} (Sopir: ${deliveryOrder.driverName}, Plat: ${deliveryOrder.vehiclePlate})`);

    // 7. Verifikasi Pengurangan Stok Fisik
    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`✅ Verifikasi Stok: Stok Awal 120 PCS - 2 DUS (80 PCS) = ${updatedProduct.stock} PCS tersisa`);
    if (updatedProduct.stock !== 40) {
      throw new Error(`Kalkulasi stok salah! Seharusnya 40 PCS, tapi tercatat ${updatedProduct.stock}`);
    }

    // 8. Verifikasi Sisa Limit Kredit Pelanggan
    const activeDebts = await prisma.debt.findMany({
      where: { customerId: customer.id, status: { not: 'Lunas' } }
    });
    const totalActiveDebt = activeDebts.reduce((sum, d) => sum + d.remaining, 0);
    const remainingLimit = customer.creditLimit - totalActiveDebt;
    console.log(`✅ Verifikasi Bon Warung: Total Hutang Aktif = Rp ${totalActiveDebt}, Sisa Limit Kredit = Rp ${remainingLimit}`);
    if (totalActiveDebt !== 224000 || remainingLimit !== 276000) {
      throw new Error('Kalkulasi limit piutang tidak sesuai!');
    }

    // 9. Verifikasi Transisi Status Surat Jalan (DO Status Lifecycle)
    const transitDO = await prisma.deliveryOrder.update({
      where: { id: deliveryOrder.id },
      data: { status: 'IN_TRANSIT' }
    });
    console.log(`✅ Status DO Berubah: ${transitDO.status} (Sedang dalam perjalanan pengantaran armada)`);

    const deliveredDO = await prisma.deliveryOrder.update({
      where: { id: deliveryOrder.id },
      data: {
        status: 'DELIVERED',
        recipientName: 'Bu Siti (Pemilik Warung)',
        deliveredAt: new Date()
      }
    });
    console.log(`✅ Status DO Selesai: ${deliveredDO.status} (Diterima oleh "${deliveredDO.recipientName}" pada ${deliveredDO.deliveredAt?.toLocaleTimeString()})`);

    // 10. Cleanup
    await prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrderId: deliveryOrder.id } });
    await prisma.deliveryOrder.delete({ where: { id: deliveryOrder.id } });
    await prisma.debt.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.productUOM.deleteMany({ where: { productId: product.id } });
    await prisma.productPriceTier.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.outlet.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });

    console.log('🧹 Cleanup data test berhasil.');
    console.log('🎉 SEMUA TES FASE 2 (DATABASE, MULTI-SATUAN, TIERED PRICING, SURAT JALAN) SUKSES 100%!');
  } catch (err) {
    console.error('❌ Gagal menjalankan test Phase 2:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTestPhase2();
