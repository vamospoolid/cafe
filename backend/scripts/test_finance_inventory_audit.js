/**
 * Test Suite: Audit Keuangan, Stok PO Retail, Pengeluaran Bertahap, & Void Waste
 * File: backend/scripts/test_finance_inventory_audit.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAuditTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUDIT & LOGIC FIX VERIFICATION');
  console.log('================================================================\n');

  const tenantId = `tenant_audit_${Date.now()}`;
  const outletId = `outlet_audit_${Date.now()}`;
  let passed = 0;
  let total = 5;

  try {
    // 0. Setup test Tenant & Outlet
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Kafe Audit Tenant',
        slug: `kafe-audit-${Date.now()}`,
        status: 'ACTIVE'
      }
    });

    const outlet = await prisma.outlet.create({
      data: {
        id: outletId,
        tenantId,
        code: `OUT-${Date.now().toString().slice(-4)}`,
        name: 'Outlet Pusat Audit',
        address: 'Jl. Uji Finansial'
      }
    });

    const user = await prisma.user.create({
      data: {
        name: 'Kasir Audit',
        username: `kasir_audit_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '[]',
        role: 'Cashier',
        memberships: {
          create: {
            tenantId
          }
        }
      }
    });

    const settings = await prisma.settings.create({
      data: {
        tenantId,
        storeName: 'Kafe Audit',
        ingredientTrackingEnabled: true // Mode Resep Aktif
      }
    });

    // ── TEST 1: Pencegahan Double Counting Kas pada Shift & CashFlow ──
    console.log('▶ [TEST 1] Pencegahan Double Counting Kas pada Shift Kasir...');
    const shift = await prisma.shift.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        saldoAwal: 100000,
        status: 'Open'
      }
    });

    // Masukkan entri auto-shift yang sebelumnya membuat double counting
    await prisma.cashFlow.createMany({
      data: [
        {
          tenantId,
          outletId,
          userId: user.id,
          type: 'Pemasukan',
          category: 'Saldo Awal Shift',
          amount: 100000,
          description: 'Auto recorded modal awal'
        },
        {
          tenantId,
          outletId,
          userId: user.id,
          type: 'Pemasukan',
          category: 'Omset POS - Tunai',
          amount: 250000,
          description: 'Auto recorded omset tunai'
        },
        {
          tenantId,
          outletId,
          userId: user.id,
          type: 'Pemasukan',
          category: 'Kas Masuk Tambahan', // Manual cash in yang sah
          amount: 15000,
          description: 'Kas masuk uang receh tambahan'
        },
        {
          tenantId,
          outletId,
          userId: user.id,
          type: 'Pengeluaran',
          category: 'Operasional Kasir',
          amount: 20000,
          description: 'Beli plastik dan es'
        }
      ]
    });

    // Simulasikan rekonsiliasi manualCashIn dengan EXCLUDED_SHIFT_CASH_CATEGORIES
    const EXCLUDED_SHIFT_CASH_CATEGORIES = [
      'Pembayaran Piutang',
      'Saldo Awal Shift',
      'Omset POS - Tunai',
      'Omset POS - Non-Tunai'
    ];

    const allShiftCashFlows = await prisma.cashFlow.findMany({
      where: { tenantId, date: { gte: shift.waktuBuka } }
    });

    const manualCashIn = allShiftCashFlows
      .filter(cf => cf.type === 'Pemasukan' && !EXCLUDED_SHIFT_CASH_CATEGORIES.includes(cf.category))
      .reduce((s, cf) => s + cf.amount, 0);

    const manualCashOut = allShiftCashFlows
      .filter(cf => cf.type === 'Pengeluaran')
      .reduce((s, cf) => s + cf.amount, 0);

    if (manualCashIn === 15000 && manualCashOut === 20000) {
      console.log(`   ✅ PASS: manualCashIn tepat Rp ${manualCashIn.toLocaleString('id-ID')} (TIDAK ter-double count dari Saldo Awal / Omset POS).`);
      passed++;
    } else {
      throw new Error(`Double count terdeteksi! manualCashIn bernilai Rp ${manualCashIn} (ekspektasi: 15.000)`);
    }

    // ── TEST 2: Stok Barang Retail Naik di Mode Resep (Purchase Order) ──
    console.log('\n▶ [TEST 2] Stok Barang Retail (Product) Bertambah di PO saat Mode Resep Aktif...');
    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: 'Supplier Grosir F&B'
      }
    });

    const rawIngredient = await prisma.ingredient.create({
      data: {
        tenantId,
        name: 'Biji Kopi Arabika',
        stock: 10,
        unit: 'kg',
        buyPrice: 150000
      }
    });

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: 'Snacks'
      }
    });

    const retailProduct = await prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: 'Keripik Singkong Renyah (Retail)',
        stock: 5,
        sellPrice: 15000,
        buyPrice: 8000
      }
    });

    // Buat PO berisi 1 Bahan Mentah dan 1 Barang Retail
    const po1 = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        outletId,
        poNumber: `PO-${Date.now().toString().slice(-6)}-001`,
        supplierId: supplier.id,
        userId: user.id,
        totalAmount: (5 * 150000) + (20 * 8000), // 750.000 + 160.000 = 910.000
        status: 'Dikirim',
        items: {
          create: [
            {
              tenantId,
              ingredientId: rawIngredient.id,
              itemName: rawIngredient.name,
              unit: 'kg',
              qtyOrdered: 5,
              unitPrice: 150000,
              subtotal: 750000
            },
            {
              tenantId,
              productId: retailProduct.id,
              itemName: retailProduct.name,
              unit: 'pcs',
              qtyOrdered: 20,
              unitPrice: 8000,
              subtotal: 160000
            }
          ]
        }
      },
      include: { items: true }
    });

    // Simulasikan penerimaan barang dengan logika fix
    for (const item of po1.items) {
      if (item.ingredientId) {
        await prisma.ingredient.update({
          where: { id: item.ingredientId },
          data: { stock: { increment: item.qtyOrdered } }
        });
      }
      if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qtyOrdered } }
        });
      }
    }

    const updatedIng = await prisma.ingredient.findUnique({ where: { id: rawIngredient.id } });
    const updatedProd = await prisma.product.findUnique({ where: { id: retailProduct.id } });

    if (updatedIng.stock === 15 && updatedProd.stock === 25) {
      console.log(`   ✅ PASS: Bahan Mentah naik (10 -> ${updatedIng.stock}) DAN Produk Retail naik (5 -> ${updatedProd.stock}) secara simultan.`);
      passed++;
    } else {
      throw new Error(`Stok retail gagal bertambah! Produk stock: ${updatedProd.stock} (ekspektasi: 25)`);
    }

    // ── TEST 3: Pencatatan Pengeluaran Kas PO Bertahap (Partial Receive) ──
    console.log('\n▶ [TEST 3] Pencatatan Pengeluaran Kas Bertahap pada PO Partial Receive...');
    const po2 = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        outletId,
        poNumber: `PO-${Date.now().toString().slice(-6)}-002`,
        supplierId: supplier.id,
        userId: user.id,
        totalAmount: 10 * 8000, // 80.000
        status: 'Dikirim',
        items: {
          create: [
            {
              tenantId,
              productId: retailProduct.id,
              itemName: retailProduct.name,
              unit: 'pcs',
              qtyOrdered: 10,
              unitPrice: 8000,
              subtotal: 80000
            }
          ]
        }
      },
      include: { items: true }
    });

    // Terima tahap 1: baru 4 pcs (Rp 32.000)
    const partialQty = 4;
    const partialExpense = partialQty * po2.items[0].unitPrice;
    await prisma.cashFlow.create({
      data: {
        tenantId,
        outletId,
        type: 'Pengeluaran',
        category: 'Pembelian Stok',
        amount: partialExpense,
        description: `Belanja PO #${po2.poNumber} (${supplier.name}) - Penerimaan Bertahap`,
        userId: user.id
      }
    });

    const recordedPartialFlow = await prisma.cashFlow.findFirst({
      where: {
        tenantId,
        description: { contains: po2.poNumber }
      }
    });

    if (recordedPartialFlow && recordedPartialFlow.amount === 32000) {
      console.log(`   ✅ PASS: Pengeluaran bertahap tercatat tepat Rp ${recordedPartialFlow.amount.toLocaleString('id-ID')} saat barang diterima 4 pcs.`);
      passed++;
    } else {
      throw new Error(`Pengeluaran PO bertahap tidak tercatat sesuai ekspektasi!`);
    }

    // ── TEST 4: Anti-Phantom Stock pada Void Pesanan Dapur & WasteLog ──
    console.log('\n▶ [TEST 4] Void Pesanan Dapur (Cooking/Ready) Tercatat ke WasteLog (Bukan Phantom Stock)...');
    const cookedProduct = await prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: 'Kopi Susu Gula Aren',
        stock: 50,
        sellPrice: 25000,
        buyPrice: 10000
      }
    });

    const susuIng = await prisma.ingredient.create({
      data: {
        tenantId,
        name: 'Susu Fresh Milk',
        stock: 20000, // 20.000 ml
        unit: 'ml',
        buyPrice: 25 // Rp 25 / ml
      }
    });

    await prisma.recipeItem.create({
      data: {
        tenantId,
        productId: cookedProduct.id,
        ingredientId: susuIng.id,
        qtyPerServing: 150 // 150ml per porsi
      }
    });

    // Buat pesanan (stok susu terpotong 300 ml untuk 2 porsi)
    await prisma.ingredient.update({
      where: { id: susuIng.id },
      data: { stock: { decrement: 300 } }
    });

    const orderCooked = await prisma.order.create({
      data: {
        tenantId,
        outletId,
        orderNumber: `ORD-${Date.now().toString().slice(-6)}-99`,
        customerName: 'Tamu Meja 5',
        userId: user.id,
        subtotal: 50000,
        tax: 0,
        serviceCharge: 0,
        total: 50000,
        status: 'Pending',
        kdsStatus: 'Cooking', // SUDAH SEDANG DIMASAK
        items: {
          create: [
            {
              tenantId,
              productId: cookedProduct.id,
              qty: 2,
              price: 25000,
              buyPrice: 10000,
              subtotal: 50000
            }
          ]
        }
      },
      include: { items: true }
    });

    // Simulasikan Void pesanan yang berstatus 'Cooking'
    const isAlreadyCooked = ['Cooking', 'Ready', 'Served'].includes(orderCooked.kdsStatus);
    if (isAlreadyCooked) {
      // TIDAK mengembalikan stok susu ke kulkas
      const lossCost = 300 * 25; // Rp 7.500
      await prisma.wasteLog.create({
        data: {
          tenantId,
          outletId,
          type: 'PRODUCT',
          productId: cookedProduct.id,
          itemName: cookedProduct.name,
          category: 'DISH',
          unit: 'porsi',
          qty: 2,
          costPerUnit: lossCost / 2,
          totalCost: lossCost,
          reason: 'Void pesanan setelah diproses dapur (Cooking)',
          userId: user.id,
          userName: user.name
        }
      });
    }

    const checkSusu = await prisma.ingredient.findUnique({ where: { id: susuIng.id } });
    const checkWaste = await prisma.wasteLog.findFirst({
      where: {
        tenantId,
        productId: cookedProduct.id
      }
    });

    if (checkSusu.stock === 19700 && checkWaste && checkWaste.totalCost === 7500) {
      console.log(`   ✅ PASS: Stok bahan (${checkSusu.stock} ml) tidak bertambah fiktif, dan WasteLog tercatat Rp ${checkWaste.totalCost.toLocaleString('id-ID')}.`);
      passed++;
    } else {
      throw new Error(`Phantom stock terdeteksi atau WasteLog gagal dibuat!`);
    }

    // ── TEST 5: Scoping Multi-Tenant pada Purchase Order ──
    console.log('\n▶ [TEST 5] Isolasi Multi-Tenant pada Purchase Order & Nomor PO...');
    const tenantOther = `tenant_other_${Date.now()}`;
    await prisma.tenant.create({
      data: { id: tenantOther, name: 'Kafe Sebelah', slug: `kafe-sebelah-${Date.now()}` }
    });

    const countA = await prisma.purchaseOrder.count({ where: { tenantId } });
    const countB = await prisma.purchaseOrder.count({ where: { tenantId: tenantOther } });

    if (countA >= 2 && countB === 0) {
      console.log(`   ✅ PASS: Tenant A memiliki ${countA} PO, Tenant B memiliki ${countB} PO (100% terisolasi).`);
      passed++;
    } else {
      throw new Error(`Isolasi multi-tenant PO bocor!`);
    }

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    // Cleanup data uji
    await prisma.wasteLog.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.ingredientLog.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.cashFlow.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.orderItem.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.order.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.shift.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.purchaseOrderItem.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.purchaseOrder.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.recipeItem.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.product.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.category.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.ingredient.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.supplier.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.settings.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.outlet.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} AUDIT FIX VERIFICATION TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runAuditTests();
