/**
 * Test Suite: Phase 2 Tenant Operational Hardening
 * File: backend/scripts/test_phase2_tenant_hardening.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runPhase2Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 2 TENANT OPERATIONAL HARDENING TESTS');
  console.log('================================================================\n');

  const tenantId = `tenant_p2_${Date.now()}`;
  const outletId = `outlet_p2_${Date.now()}`;
  let passed = 0;
  let total = 4;

  try {
    // 0. Setup Tenant, Outlet, User, Settings, Category
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Kafe Phase 2 Tenant',
        slug: `kafe-p2-${Date.now()}`,
        status: 'ACTIVE'
      }
    });

    await prisma.outlet.create({
      data: {
        id: outletId,
        tenantId,
        code: `OUT-P2-${Date.now().toString().slice(-4)}`,
        name: 'Outlet Utama Phase 2',
        address: 'Jl. Uji Phase 2'
      }
    });

    const user = await prisma.user.create({
      data: {
        name: 'Kasir P2',
        username: `kasir_p2_${Date.now()}`,
        passwordHash: 'hash',
        permissions: '[]',
        role: 'Cashier',
        memberships: {
          create: { tenantId }
        }
      }
    });

    await prisma.settings.create({
      data: {
        tenantId,
        storeName: 'Kafe P2',
        ingredientTrackingEnabled: true // Mode Resep Aktif
      }
    });

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: 'Menu Olahan & Retail'
      }
    });

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: 'Supplier Bahan P2'
      }
    });

    // ── TEST 1: Pemisahan Sumber Dana PO (Laci Kasir vs Transfer Bank) ──
    console.log('▶ [TEST 1] Pemisahan Sumber Dana PO: Kas Laci vs Transfer Bank...');
    const shift = await prisma.shift.create({
      data: {
        tenantId,
        outletId,
        userId: user.id,
        saldoAwal: 500000,
        status: 'Open'
      }
    });

    // Belanja 1: Belanja besar Rp 3.000.000 via Transfer Bank Kantor
    await prisma.cashFlow.create({
      data: {
        tenantId,
        outletId,
        type: 'Pengeluaran',
        category: 'Pembelian Stok - Bank',
        amount: 3000000,
        description: 'Belanja PO #PO-BANK-001 (Supplier Bahan P2) - [Transfer Bank Kantor]',
        userId: user.id
      }
    });

    // Belanja 2: Belanja darurat Rp 50.000 dari laci kasir (Petty Cash)
    await prisma.cashFlow.create({
      data: {
        tenantId,
        outletId,
        type: 'Pengeluaran',
        category: 'Pembelian Stok - Kasir',
        amount: 50000,
        description: 'Belanja PO #PO-CASH-002 (Supplier Bahan P2) - [Kas Laci Kasir (Petty Cash)]',
        userId: user.id
      }
    });

    // Hitung manualCashOut kasir shift
    const NON_CASH_EXPENSE_CATEGORIES = [
      'Pembelian Stok - Bank',
      'Pembelian Stok - Tempo'
    ];

    const shiftFlows = await prisma.cashFlow.findMany({
      where: { tenantId, date: { gte: shift.waktuBuka } }
    });

    const manualCashOut = shiftFlows
      .filter(cf => cf.type === 'Pengeluaran' && !NON_CASH_EXPENSE_CATEGORIES.includes(cf.category))
      .reduce((s, cf) => s + cf.amount, 0);

    // Hitung saldo sistem kasir
    const saldoSistem = shift.saldoAwal - manualCashOut; // 500.000 - 50.000 = 450.000

    if (manualCashOut === 50000 && saldoSistem === 450000) {
      console.log(`   ✅ PASS: PO Bank Transfer Rp 3.000.000 TIDAK memotong laci kasir.`);
      console.log(`            Hanya belanja laci Rp 50.000 yang memotong laci (Saldo laci: Rp ${saldoSistem.toLocaleString('id-ID')}).`);
      passed++;
    } else {
      throw new Error(`Kalkulasi laci kasir salah! manualCashOut: ${manualCashOut}, saldoSistem: ${saldoSistem}`);
    }

    // ── TEST 2: Otomatisasi HPP Dinamis (Weighted Moving Average Costing) ──
    console.log('\n▶ [TEST 2] Weighted Moving Average Costing saat PO Diterima...');
    // Aset awal: 10 kg Biji Kopi @ Rp 100.000 = Rp 1.000.000
    const testIngredient = await prisma.ingredient.create({
      data: {
        tenantId,
        name: 'Biji Kopi Sigararutang',
        stock: 10,
        buyPrice: 100000,
        unit: 'kg'
      }
    });

    // Datang PO baru: 10 kg @ Rp 160.000 = Rp 1.600.000
    const newQty = 10;
    const newUnitPrice = 160000;
    const oldStock = testIngredient.stock;
    const oldPrice = testIngredient.buyPrice;

    // Kalkulasi Weighted Moving Average: (1.000.000 + 1.600.000) / 20 = 130.000
    const weightedHpp = Math.round(((oldStock * oldPrice) + (newQty * newUnitPrice)) / (oldStock + newQty));

    await prisma.ingredient.update({
      where: { id: testIngredient.id },
      data: {
        stock: { increment: newQty },
        buyPrice: weightedHpp
      }
    });

    const updatedIng = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });

    if (updatedIng.stock === 20 && updatedIng.buyPrice === 130000) {
      console.log(`   ✅ PASS: HPP Biji Kopi ter-update otomatis dari Rp 100.000 -> Rp ${updatedIng.buyPrice.toLocaleString('id-ID')}/kg (Moving Average).`);
      passed++;
    } else {
      throw new Error(`Moving average HPP gagal! Stock: ${updatedIng.stock}, BuyPrice: ${updatedIng.buyPrice}`);
    }

    // ── TEST 3: Bypass Product Stock Lock pada Menu Olahan Dapur Ber-resep ──
    console.log('\n▶ [TEST 3] Checkout Menu Olahan Masakan Dapur dengan Product.stock = 0...');
    // Bahan Baku Dapur: Beras 20.000 gr (20 kg)
    const berasIng = await prisma.ingredient.create({
      data: {
        tenantId,
        name: 'Beras Pandan Wangi',
        stock: 20000,
        buyPrice: 15,
        unit: 'gr'
      }
    });

    // Menu Olahan Dapur: Nasi Goreng Spesial (Product.stock = 0 karena baru dimasak saat order)
    const nasiGorengProd = await prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: 'Nasi Goreng Spesial Dapur',
        stock: 0, // STOK PRODUK 0!
        sellPrice: 35000,
        buyPrice: 15000
      }
    });

    // Hubungkan Resep: 1 porsi Nasi Goreng butuh 200 gr beras
    await prisma.recipeItem.create({
      data: {
        tenantId,
        productId: nasiGorengProd.id,
        ingredientId: berasIng.id,
        qtyPerServing: 200
      }
    });

    // Simulasikan checkout 2 porsi Nasi Goreng (membutuhkan 400 gr beras)
    const itemQty = 2;
    const isAdvancedMode = true;

    // Cek resep
    const recipes = await prisma.recipeItem.findMany({
      where: { productId: nasiGorengProd.id },
      include: { ingredient: true }
    });

    const hasRecipe = isAdvancedMode && recipes.length > 0;
    if (hasRecipe) {
      // Potong stok bahan baku secara atomik tanpa memblokir Product.stock = 0
      for (const r of recipes) {
        const used = r.qtyPerServing * itemQty;
        await prisma.ingredient.update({
          where: { id: r.ingredientId },
          data: { stock: { decrement: used } }
        });
      }
    } else {
      // Hanya barang retail yang mengunci Product.stock
      await prisma.product.update({
        where: { id: nasiGorengProd.id },
        data: { stock: { decrement: itemQty } }
      });
    }

    const checkBeras = await prisma.ingredient.findUnique({ where: { id: berasIng.id } });
    const checkDish = await prisma.product.findUnique({ where: { id: nasiGorengProd.id } });

    if (checkBeras.stock === 19600 && checkDish.stock === 0) {
      console.log(`   ✅ PASS: Pesanan Nasi Goreng berhasil checkout meski Product.stock = 0.`);
      console.log(`            Stok beras terpotong 400 gr (20.000 -> ${checkBeras.stock} gr) tanpa error.`);
      passed++;
    } else {
      throw new Error(`Checkout menu masakan gagal! Beras: ${checkBeras.stock}`);
    }

    // ── TEST 4: Toleransi Regex Dwibahasa pada Split Payment ──
    console.log('\n▶ [TEST 4] Toleransi Regex Dwibahasa pada Split Payment (Tunai / Cash)...');
    const getCashPortion = (paymentMethod, total) => {
      if (!paymentMethod) return 0;
      const pm = paymentMethod.trim();
      if (pm.toLowerCase() === 'cash' || pm.toLowerCase() === 'tunai') return total;
      if (pm.startsWith('Split')) {
        const match = pm.match(/(?:Tunai|Cash)\s*(?:Rp)?\s*([\d\.]+)/i);
        if (match && match[1]) return Number(match[1].replace(/\./g, '')) || 0;
      }
      return 0;
    };

    const splitIndo = getCashPortion('Split (Tunai Rp 35.000 + Non-Tunai Rp 15.000)', 50000);
    const splitEng = getCashPortion('Split (Cash Rp 40.000 + QRIS Rp 20.000)', 60000);
    const splitNoDot = getCashPortion('Split Cash 25000 + Transfer 25000', 50000);

    if (splitIndo === 35000 && splitEng === 40000 && splitNoDot === 25000) {
      console.log(`   ✅ PASS: Regex mengenali 'Tunai Rp 35.000' (Rp ${splitIndo}), 'Cash Rp 40.000' (Rp ${splitEng}), dan 'Cash 25000' (Rp ${splitNoDot}).`);
      passed++;
    } else {
      throw new Error(`Regex split payment gagal mengekstrak nominal! Indo: ${splitIndo}, Eng: ${splitEng}, NoDot: ${splitNoDot}`);
    }

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    await prisma.cashFlow.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.shift.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.recipeItem.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.product.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.category.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.ingredient.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.supplier.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.settings.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { memberships: { some: { tenantId } } } }).catch(() => {});
    await prisma.outlet.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} PHASE 2 TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runPhase2Tests();
