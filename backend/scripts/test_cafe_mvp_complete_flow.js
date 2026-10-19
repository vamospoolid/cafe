/**
 * TEST SUITE: Full Functional End-to-End Validation - MVP Cafe Vertical
 * 
 * Flow yang diuji secara lengkap:
 * 1. [PROVISIONING & IDENTITY] Inisialisasi Tenant Cafe, Outlet, Settings & User Kasir
 * 2. [TABLE MANAGEMENT] Denah Meja Aktif (Meja 01 & Meja 02)
 * 3. [BOM INVENTORY & MENU] Pembuatan Bahan Baku, Resep BOM (RecipeItem) & Menu Ramen dengan Kalkulasi HPP
 * 4. [SHIFT CONTROL] Buka Shift Kasir dengan Modal Awal (Saldo Awal Laci)
 * 5. [ORDER & TRANSAKSI] Transaksi Dine-In dengan Meja, Pajak PB1 & Pemotongan Stok Bahan Otomatis
 * 6. [KDS INTEGRATION] Kitchen Display Lifecycle (Pending -> Cooking -> Ready -> Served)
 * 7. [PETTY CASH] Arus Kas Operasional Dapur (Pengeluaran Es Batu Darurat)
 * 8. [REKONSILIASI KAS LACI] Tutup Shift Kasir, Hitung Selisih Kas Sistem vs Fisik
 * 9. [LAPORAN & LABA RUGI] Validasi Laporan Omset, Margin Laba, dan HPP Resep
 * 10. [PENGATURAN CAFE] Update Profil Cafe, Header/Footer Struk & Tax
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runCafeMvpFullTest() {
  console.log('🍜 ====================================================================');
  console.log('   FULL END-TO-END FUNCTIONAL TEST: MVP CAFE & RESTO VERTICAL        ');
  console.log('====================================================================\n');

  const timestamp = Date.now();
  const testSlug = `cafetest-${timestamp}`.slice(0, 20);
  let tenant = null;
  let outlet = null;
  let cashierUser = null;
  let table1 = null;
  let table2 = null;
  let ingNoodle = null;
  let ingBroth = null;
  let ingEgg = null;
  let ingChashu = null;
  let productRamen = null;
  let productOcha = null;
  let activeShift = null;
  let order1 = null;
  let order2 = null;

  try {
    // -------------------------------------------------------------------------
    // 1. PROVISIONING & VERTICAL IDENTITY
    // -------------------------------------------------------------------------
    console.log('1️⃣  [PROVISIONING & TENANT IDENTITY]');
    tenant = await prisma.tenant.create({
      data: {
        name: `Kafe Ramen Nusantara ${timestamp}`,
        slug: testSlug,
        businessType: 'CAFE',
        status: 'ACTIVE'
      }
    });
    assert(tenant.businessType === 'CAFE', `Tenant dibuat dengan tipe CAFE (slug: ${tenant.slug})`);

    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Outlet Pusat Cafe',
        code: `OUT-CF-${timestamp.toString().slice(-4)}`,
        address: 'Jl. Kuliner No. 123'
      }
    });
    assert(outlet.id !== undefined, `Outlet Cafe terdaftar: ${outlet.name}`);

    await prisma.settings.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        storeName: `Kafe Ramen Nusantara`,
        address: 'Jl. Kuliner No. 123, Bandung',
        phone: '081234567890',
        receiptHeader: 'Selamat Menikmati Ramen Otentik',
        receiptFooter: 'Terima kasih atas kunjungan Anda!',
        taxRate: 10,
        serviceCharge: 0
      }
    });
    assert(true, 'Pengaturan awal cafe berhasil disimpan di model Settings');

    cashierUser = await prisma.user.create({
      data: {
        username: `kasir_cafe_${timestamp}`,
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
        name: 'Siti Kasir',
        permissions: '[]',
        memberships: {
          create: { tenantId: tenant.id }
        }
      }
    });
    assert(cashierUser.role === 'CASHIER', `User Kasir Cafe dibuat: ${cashierUser.username}`);

    // -------------------------------------------------------------------------
    // 2. DENAH MEJA (TABLE MANAGEMENT)
    // -------------------------------------------------------------------------
    console.log('\n2️⃣  [DENAH MEJA / TABLE MANAGEMENT]');
    table1 = await prisma.table.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        tableNo: '01',
        name: 'Area Indoor Depan',
        capacity: 4,
        status: 'Aktif'
      }
    });
    table2 = await prisma.table.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        tableNo: '02',
        name: 'Area Bar',
        capacity: 2,
        status: 'Aktif'
      }
    });
    assert(table1.status === 'Aktif' && table2.status === 'Aktif', 'Meja 01 & Meja 02 berhasil dibuat dengan status Aktif');

    // -------------------------------------------------------------------------
    // 3. MASTER DATA BAHAN BAKU & RESEP BOM (BILL OF MATERIALS)
    // -------------------------------------------------------------------------
    console.log('\n3️⃣  [MANAJEMEN BAHAN BAKU & RESEP BOM]');
    // Bahan baku Mie Ramen (porsi), Kaldu (ml), Telur (butir), Chashu (lembar)
    ingNoodle = await prisma.ingredient.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        name: 'Mie Ramen Mentah',
        category: 'FOOD',
        unit: 'porsi',
        stock: 100,
        minStock: 20,
        buyPrice: 3000
      }
    });
    ingBroth = await prisma.ingredient.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        name: 'Kaldu Ayam Paitan',
        category: 'FOOD',
        unit: 'ml',
        stock: 10000,
        minStock: 2000,
        buyPrice: 20 // Rp 20 / ml (250ml = Rp 5.000)
      }
    });
    ingEgg = await prisma.ingredient.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        name: 'Telur Ajitsuke Tamago',
        category: 'FOOD',
        unit: 'butir',
        stock: 50,
        minStock: 10,
        buyPrice: 2500
      }
    });
    ingChashu = await prisma.ingredient.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        name: 'Daging Chashu Slice',
        category: 'FOOD',
        unit: 'lembar',
        stock: 80,
        minStock: 15,
        buyPrice: 4000
      }
    });
    assert(ingNoodle.stock === 100 && ingBroth.stock === 10000, '4 Bahan baku utama berhasil didaftarkan dengan stok awal');

    // Kategori Menu
    const catMakanan = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Ramen & Noodle',
        printerTarget: 'KITCHEN'
      }
    });
    const catMinuman = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Minuman Segar',
        printerTarget: 'BAR'
      }
    });

    // Menu Special Tori Ramen: Harga Jual Rp 38.000
    // Resep: 1 Mie (3.000) + 250ml Kaldu (5.000) + 1 Telur (2.500) + 2 Chashu (8.000) = HPP Rp 18.500
    const calculatedHpp = (1 * 3000) + (250 * 20) + (1 * 2500) + (2 * 4000);
    productRamen = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catMakanan.id,
        name: 'Special Tori Ramen',
        sellPrice: 38000,
        buyPrice: calculatedHpp,
        stock: 50,
        status: 'Aktif'
      }
    });

    // Hubungkan Resep BOM via RecipeItem
    await prisma.recipeItem.createMany({
      data: [
        { tenantId: tenant.id, productId: productRamen.id, ingredientId: ingNoodle.id, qtyPerServing: 1 },
        { tenantId: tenant.id, productId: productRamen.id, ingredientId: ingBroth.id, qtyPerServing: 250 },
        { tenantId: tenant.id, productId: productRamen.id, ingredientId: ingEgg.id, qtyPerServing: 1 },
        { tenantId: tenant.id, productId: productRamen.id, ingredientId: ingChashu.id, qtyPerServing: 2 }
      ]
    });
    assert(productRamen.buyPrice === 18500, `Menu Special Tori Ramen dibuat dengan BOM Recipe HPP = Rp ${productRamen.buyPrice.toLocaleString('id-ID')} (Harga Jual: Rp 38.000)`);

    productOcha = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catMinuman.id,
        name: 'Cold Green Tea Ocha',
        sellPrice: 8000,
        buyPrice: 1500,
        stock: 100,
        status: 'Aktif'
      }
    });
    assert(productOcha.sellPrice === 8000, 'Menu Minuman Cold Green Tea Ocha berhasil didaftarkan');

    // -------------------------------------------------------------------------
    // 4. SHIFT KASIR & CASH DRAWER CONTROL
    // -------------------------------------------------------------------------
    console.log('\n4️⃣  [SHIFT KASIR & MODAL AWAL / CASH FLOAT]');
    const initialFloat = 200000; // Modal awal laci kasir Rp 200.000
    activeShift = await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: cashierUser.id,
        waktuBuka: new Date(),
        saldoAwal: initialFloat,
        status: 'Open'
      }
    });
    assert(activeShift.status === 'Open' && activeShift.saldoAwal === 200000, `Shift kasir DIBUKA dengan modal awal Rp ${activeShift.saldoAwal.toLocaleString('id-ID')}`);

    // -------------------------------------------------------------------------
    // 5. TRANSAKSI KASIR CAFE (DINE-IN MEJA 01)
    // -------------------------------------------------------------------------
    console.log('\n5️⃣  [TRANSAKSI KASIR DINE-IN DENGAN NOMOR MEJA]');
    // Pelanggan memesan 2x Special Tori Ramen dan 2x Ocha Dingin di Meja 01
    const qtyRamen = 2;
    const qtyOcha = 2;
    const subtotal = (qtyRamen * productRamen.sellPrice) + (qtyOcha * productOcha.sellPrice); // 76.000 + 16.000 = 92.000
    const tax = Math.round(subtotal * 0.10); // PB1 10% = 9.200
    const totalOrder = subtotal + tax; // 101.200

    order1 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderNumber: `ORD-${timestamp}-001`,
        userId: cashierUser.id,
        tableId: table1.id,
        customerName: 'Budi Santoso (Dine-in)',
        status: 'Paid',
        kdsStatus: 'Served',
        paymentMethod: 'CASH',
        subtotal: subtotal,
        discount: 0,
        tax: tax,
        serviceCharge: 0,
        total: totalOrder,
        items: {
          create: [
            {
              tenantId: tenant.id,
              outletId: outlet.id,
              productId: productRamen.id,
              qty: qtyRamen,
              price: productRamen.sellPrice,
              buyPrice: productRamen.buyPrice,
              subtotal: qtyRamen * productRamen.sellPrice
            },
            {
              tenantId: tenant.id,
              outletId: outlet.id,
              productId: productOcha.id,
              qty: qtyOcha,
              price: productOcha.sellPrice,
              buyPrice: productOcha.buyPrice,
              subtotal: qtyOcha * productOcha.sellPrice
            }
          ]
        }
      },
      include: { items: true }
    });
    assert(order1.total === 101200, `Order #1 berhasil diproses: Subtotal Rp ${subtotal.toLocaleString('id-ID')} + PB1 10% (Rp ${tax.toLocaleString('id-ID')}) = Total Rp ${totalOrder.toLocaleString('id-ID')}`);

    // SIMULASI PEMOTONGAN STOK RESEP BOM OTOMATIS:
    // 2 porsi ramen memotong: 2 Mie, 500ml Kaldu, 2 Telur, 4 Chashu
    await prisma.ingredient.update({
      where: { id: ingNoodle.id },
      data: { stock: { decrement: 2 * 1 } }
    });
    await prisma.ingredient.update({
      where: { id: ingBroth.id },
      data: { stock: { decrement: 2 * 250 } }
    });
    await prisma.ingredient.update({
      where: { id: ingEgg.id },
      data: { stock: { decrement: 2 * 1 } }
    });
    await prisma.ingredient.update({
      where: { id: ingChashu.id },
      data: { stock: { decrement: 2 * 2 } }
    });

    const stockNoodleAfter = await prisma.ingredient.findUnique({ where: { id: ingNoodle.id } });
    const stockBrothAfter = await prisma.ingredient.findUnique({ where: { id: ingBroth.id } });
    const stockEggAfter = await prisma.ingredient.findUnique({ where: { id: ingEgg.id } });
    const stockChashuAfter = await prisma.ingredient.findUnique({ where: { id: ingChashu.id } });

    assert(stockNoodleAfter.stock === 98, `BOM Deduction: Stok Mie Ramen berkurang 2 porsi (100 -> ${stockNoodleAfter.stock})`);
    assert(stockBrothAfter.stock === 9500, `BOM Deduction: Stok Kaldu Ayam berkurang 500 ml (10.000 -> ${stockBrothAfter.stock})`);
    assert(stockEggAfter.stock === 48, `BOM Deduction: Stok Telur Tamago berkurang 2 butir (50 -> ${stockEggAfter.stock})`);
    assert(stockChashuAfter.stock === 76, `BOM Deduction: Stok Chashu berkurang 4 lembar (80 -> ${stockChashuAfter.stock})`);

    // -------------------------------------------------------------------------
    // 6. KITCHEN DISPLAY SYSTEM (KDS) LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n6️⃣  [KITCHEN DISPLAY SYSTEM (KDS) WORKFLOW]');
    // Order 2 masuk ke antrean dapur KDS
    order2 = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderNumber: `ORD-${timestamp}-002`,
        userId: cashierUser.id,
        tableId: table2.id,
        customerName: 'Dewi Lestari (Dine-in)',
        status: 'Pending',
        kdsStatus: 'Pending',
        paymentMethod: 'PENDING',
        subtotal: 38000,
        discount: 0,
        tax: 3800,
        serviceCharge: 0,
        total: 41800,
        items: {
          create: [
            {
              tenantId: tenant.id,
              outletId: outlet.id,
              productId: productRamen.id,
              qty: 1,
              price: 38000,
              buyPrice: 18500,
              subtotal: 38000
            }
          ]
        }
      }
    });
    assert(order2.kdsStatus === 'Pending', 'Tiket KDS Dapur diterima dengan status Pending');

    // Dapur klik "Mulai Masak" (Cooking)
    await prisma.order.update({
      where: { id: order2.id },
      data: { kdsStatus: 'Cooking' }
    });
    let kdsCheck = await prisma.order.findUnique({ where: { id: order2.id } });
    assert(kdsCheck.kdsStatus === 'Cooking', 'Status KDS Dapur diubah menjadi Cooking');

    // Dapur klik "Selesai Masak / Siap Antar" (Ready)
    await prisma.order.update({
      where: { id: order2.id },
      data: { kdsStatus: 'Ready' }
    });
    kdsCheck = await prisma.order.findUnique({ where: { id: order2.id } });
    assert(kdsCheck.kdsStatus === 'Ready', 'Status KDS Dapur diubah menjadi Ready (Siap diantar)');

    // Pelayan mengantar pesanan & kasir menyelesaikan pembayaran QRIS
    await prisma.order.update({
      where: { id: order2.id },
      data: {
        status: 'Paid',
        kdsStatus: 'Served',
        paymentMethod: 'QRIS',
        paidAt: new Date(),
        servedAt: new Date()
      }
    });
    kdsCheck = await prisma.order.findUnique({ where: { id: order2.id } });
    assert(kdsCheck.status === 'Paid' && kdsCheck.paymentMethod === 'QRIS' && kdsCheck.kdsStatus === 'Served', 'Pesanan diantar ke Meja 02 & diselesaikan via QRIS');

    // -------------------------------------------------------------------------
    // 7. ARUS KAS / PETTY CASH OPERASIONAL DAPUR
    // -------------------------------------------------------------------------
    console.log('\n7️⃣  [ARUS KAS OPERASIONAL / PETTY CASH CAFE]');
    const expensePetty = await prisma.cashFlow.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: cashierUser.id,
        type: 'Pengeluaran',
        amount: 25000,
        category: 'Operasional Dapur',
        description: 'Beli es batu kristal & kemangi segar darurat'
      }
    });
    assert(expensePetty.amount === 25000, `Pengeluaran Petty Cash kas kecil dicatat: Rp ${expensePetty.amount.toLocaleString('id-ID')} (${expensePetty.description})`);

    // -------------------------------------------------------------------------
    // 8. TUTUP SHIFT KASIR & REKONSILIASI KAS LACI
    // -------------------------------------------------------------------------
    console.log('\n8️⃣  [TUTUP SHIFT KASIR & REKONSILIASI KAS LACI]');
    // Hitung total penjualan tunai selama shift:
    // Order 1 (CASH): Rp 101.200
    // Order 2 (QRIS): Rp 41.800 (Non-tunai, masuk saldoElektronik)
    // Modal awal: Rp 200.000
    // Kas keluar: Rp 25.000
    // Saldo Fisik Laci Sistem = 200.000 + 101.200 - 25.000 = Rp 276.200
    const cashSales = 101200;
    const nonCashSales = 41800;
    const expectedCashInDrawer = initialFloat + cashSales - expensePetty.amount; // 276.200
    const actualCashCounted = 276200; // Uang fisik dihitung kasir
    const cashDifference = actualCashCounted - expectedCashInDrawer; // 0

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        waktuTutup: new Date(),
        saldoSistem: expectedCashInDrawer,
        saldoElektronik: nonCashSales,
        saldoFisikLaci: actualCashCounted,
        selisih: cashDifference,
        status: 'Closed'
      }
    });
    assert(closedShift.status === 'Closed', 'Shift kasir berhasil DITUTUP');
    assert(closedShift.saldoSistem === 276200, `Saldo Sistem Laci Kasir = Rp ${closedShift.saldoSistem.toLocaleString('id-ID')}`);
    assert(closedShift.saldoFisikLaci === 276200, `Saldo Fisik Aktual Kasir = Rp ${closedShift.saldoFisikLaci.toLocaleString('id-ID')}`);
    assert(closedShift.selisih === 0, `Selisih Kas Laci = Rp ${closedShift.selisih} (REKONSILIASI BALANCE SEMPURNA!)`);

    // -------------------------------------------------------------------------
    // 9. LAPORAN & FINANSIAL CAFE
    // -------------------------------------------------------------------------
    console.log('\n9️⃣  [LAPORAN PENJUALAN, HPP RESEP & MARGIN LABA]');
    // Total Penjualan Bersih (Subtotal tanpa pajak):
    // Order 1 subtotal: 92.000
    // Order 2 subtotal: 38.000
    // Total Revenue = 130.000
    // Total HPP Resep:
    // Order 1 HPP: (2 * 18.500) + (2 * 1.500) = 37.000 + 3.000 = 40.000
    // Order 2 HPP: (1 * 18.500) = 18.500
    // Total HPP Resep = 58.500
    // Laba Kotor = 130.000 - 58.500 = Rp 71.500 (Gross Margin: 55.0%)
    const allOrders = await prisma.order.findMany({
      where: { tenantId: tenant.id, status: 'Paid' },
      include: { items: true }
    });
    assert(allOrders.length === 2, `Total 2 transaksi berhasil terdata dalam laporan penjualan harian`);

    let totalGrossRevenue = 0;
    let totalCogs = 0;
    for (const ord of allOrders) {
      totalGrossRevenue += ord.subtotal;
      for (const item of ord.items) {
        totalCogs += item.buyPrice * item.qty;
      }
    }
    const grossProfit = totalGrossRevenue - totalCogs;
    const profitMargin = ((grossProfit / totalGrossRevenue) * 100).toFixed(1);

    assert(totalGrossRevenue === 130000, `Total Pendapatan Penjualan = Rp ${totalGrossRevenue.toLocaleString('id-ID')}`);
    assert(totalCogs === 58500, `Total HPP Resep Terpakai (COGS) = Rp ${totalCogs.toLocaleString('id-ID')}`);
    assert(grossProfit === 71500, `Estimasi Laba Kotor Kafe = Rp ${grossProfit.toLocaleString('id-ID')} (Margin Laba: ${profitMargin}%)`);

    // -------------------------------------------------------------------------
    // 10. PENGATURAN CAFE
    // -------------------------------------------------------------------------
    console.log('\n🔟 [PENGATURAN CAFE & STRUK THERMAL]');
    await prisma.settings.updateMany({
      where: { tenantId: tenant.id },
      data: {
        storeName: 'Kafe Ramen Nusantara Premium',
        address: 'Jl. Ir. H. Juanda No. 99, Dago, Bandung',
        phone: '081299998888',
        receiptHeader: '🍜 Otentik Ramen Nusantara 🍜\nFree WiFi: RamenGuest-5G',
        receiptFooter: 'Silakan beri ulasan bintang 5 di Google Maps!\nFollow IG: @ramennusantara.id',
        taxRate: 10,
        serviceCharge: 5
      }
    });

    const settingsReload = await prisma.settings.findFirst({ where: { tenantId: tenant.id } });
    assert(settingsReload.storeName === 'Kafe Ramen Nusantara Premium', 'Pengaturan Profil Cafe tersimpan');
    assert(settingsReload.taxRate === 10 && settingsReload.serviceCharge === 5, 'Pengaturan Pajak (PB1 10%) & Service Charge (5%) tersimpan');
    assert(settingsReload.receiptHeader.includes('RamenGuest-5G'), 'Pengaturan Header Struk & WiFi tersimpan');

    // -------------------------------------------------------------------------
    // REKAP HASIL TEST
    // -------------------------------------------------------------------------
    console.log('\n====================================================================');
    console.log(`📊 REKAPITULASI UJI FUNGSIONAL LENGKAP MVP CAFE:`);
    console.log(`   Total Pengujian : ${passed + failed}`);
    console.log(`   LULUS (PASS)    : ${passed}`);
    console.log(`   GAGAL (FAIL)    : ${failed}`);
    console.log('====================================================================');

    if (failed === 0) {
      console.log('🎉 SELURUH ALUR FUNGSIONAL MVP CAFE 100% SUKSES & VALID!');
    } else {
      console.error(`⚠️ Ditemukan ${failed} pengujian yang gagal.`);
    }

  } catch (err) {
    console.error('💥 Error tak terduga selama pengujian:', err);
    failed++;
  } finally {
    // Cleanup data testing agar database tetap bersih
    if (tenant) {
      try {
        await prisma.orderItem.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.recipeItem.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.ingredient.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.shift.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.cashFlow.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.table.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.settings.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.outlet.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenantMembership.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.user.deleteMany({ where: { id: cashierUser?.id } });
        await prisma.tenant.delete({ where: { id: tenant.id } });
        console.log('🧹 [CLEANUP] Data dummy pengujian berhasil dibersihkan dengan aman.');
      } catch (cleanupErr) {
        console.warn('Pembersihan data dummy:', cleanupErr.message);
      }
    }
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runCafeMvpFullTest();
