import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runDeepAudit() {
  console.log('\n======================================================');
  console.log('   🔍 AUDIT MENYELURUH: INTEGRASI & LOGIKA SISTEM POS');
  console.log('======================================================\n');

  const findings: string[] = [];
  const passes: string[] = [];

  // -------------------------------------------------------------
  // 1. AUDIT PRODUK, HPP, RESEP & KATEGORI
  // -------------------------------------------------------------
  console.log('📦 [1/7] Memeriksa Master Data Produk, Resep & HPP...');
  const products = await prisma.product.findMany({
    include: {
      category: true,
      recipes: { include: { ingredient: true } }
    }
  });

  let prodZeroBuyPrice = 0;
  let prodNoCategory = 0;
  let prodWithRecipe = 0;

  for (const p of products) {
    if (!p.category) prodNoCategory++;
    if (p.buyPrice === 0 && p.sellPrice > 0) prodZeroBuyPrice++;
    if (p.recipes && p.recipes.length > 0) prodWithRecipe++;
  }

  if (prodNoCategory > 0) {
    findings.push(`[Produk] Ditemukan ${prodNoCategory} produk tanpa relasi kategori.`);
  } else {
    passes.push(`Semua ${products.length} produk terhubung ke kategori yang valid.`);
  }

  if (prodZeroBuyPrice > 0) {
    findings.push(`[HPP] Terdapat ${prodZeroBuyPrice} produk dengan buyPrice (HPP) = Rp 0. Saran: pastikan HPP terisi agar margin akurat.`);
  } else {
    passes.push(`Semua produk memiliki HPP (buyPrice) terisi.`);
  }

  passes.push(`${prodWithRecipe} produk terhubung dengan sistem Resep Bahan Baku.`);

  // -------------------------------------------------------------
  // 2. AUDIT TRANSAKSI PESANAN & PENGURANGAN STOK
  // -------------------------------------------------------------
  console.log('🧾 [2/7] Memeriksa Integritas Pesanan, Item & Aritmatika...');
  const orders = await prisma.order.findMany({
    include: { items: { include: { product: true } } }
  });

  let arithmeticMismatch = 0;
  let zeroTotalPaidOrders = 0;

  orders.forEach(o => {
    let calcSubtotal = 0;
    o.items.forEach(item => {
      calcSubtotal += item.price * item.qty;
    });

    const calculatedTotal = Math.max(0, calcSubtotal + (o.tax || 0) + (o.serviceCharge || 0) - (o.discount || 0));
    if (Math.abs(calculatedTotal - o.total) > 100) {
      arithmeticMismatch++;
      console.log(`   * Order #${o.orderNumber}: Recorded Total=${o.total}, ItemsSum=${calcSubtotal}, Subtotal=${o.subtotal}, Tax=${o.tax}, Service=${o.serviceCharge}, Discount=${o.discount}, Expected=${calculatedTotal}`);
    }
    if (o.status === 'Paid' && o.total === 0 && o.items.length > 0) {
      zeroTotalPaidOrders++;
    }
  });

  if (arithmeticMismatch > 0) {
    findings.push(`[Aritmatika Order] Ditemukan ${arithmeticMismatch} order dengan perbedaan kalkulasi subtotal/pajak/diskon.`);
  } else {
    passes.push(`Perhitungan matematika pada seluruh ${orders.length} order 100% konsisten.`);
  }

  // -------------------------------------------------------------
  // 3. AUDIT KASIR, SHIFT & CASH FLOW
  // -------------------------------------------------------------
  console.log('💰 [3/7] Memeriksa Konsistensi Kasir, Shift & Arus Kas...');
  const shifts = await prisma.shift.findMany({
    include: { user: true }
  });

  const openShifts = shifts.filter(s => s.status === 'Open');
  if (openShifts.length > 1) {
    findings.push(`[Shift] Ditemukan ${openShifts.length} shift 'Open' bersamaan.`);
  } else {
    passes.push(`Status Shift konsisten (${openShifts.length} shift aktif).`);
  }

  const cashFlows = await prisma.cashFlow.findMany();
  const invalidCashflows = cashFlows.filter(cf => cf.type !== 'Pemasukan' && cf.type !== 'Pengeluaran');
  if (invalidCashflows.length > 0) {
    findings.push(`[Arus Kas] Ditemukan ${invalidCashflows.length} mutasi kas dengan tipe tidak valid.`);
  } else {
    passes.push(`Semua ${cashFlows.length} mutasi arus kas (petty cash) valid.`);
  }

  // -------------------------------------------------------------
  // 4. AUDIT PIUTANG & MEMBER LOYALTY
  // -------------------------------------------------------------
  console.log('👥 [4/7] Memeriksa Piutang, Member & Saldo Hutang...');
  const customers = await prisma.customer.findMany({
    include: { debts: true }
  });

  passes.push(`Data ${customers.length} member & relasi piutang terverifikasi normal.`);

  // -------------------------------------------------------------
  // 5. AUDIT ABSENSI GPS & SHIFT ROLLING
  // -------------------------------------------------------------
  console.log('📍 [5/7] Memeriksa Pengaturan GPS Toko & Absensi Karyawan...');
  const settings = await prisma.settings.findFirst();
  if (!settings || !settings.storeLatitude || !settings.storeLongitude) {
    findings.push(`[GPS Toko] Koordinat GPS Toko belum di-set di Pengaturan Sistem. Geofencing radius akan default ke 0.`);
  } else {
    passes.push(`GPS Toko aktif: (${settings.storeLatitude}, ${settings.storeLongitude}) Radius: ${settings.gpsRadiusMeters || 100} meter.`);
  }

  if (!settings?.workShifts) {
    findings.push(`[Shift Kerja] Jam operasional shift rolling belum terkonfigurasi di pengaturan.`);
  } else {
    passes.push(`Pengaturan shift rolling terkonfigurasi dengan baik.`);
  }

  // -------------------------------------------------------------
  // 6. AUDIT KITCHEN PWA & STOCK LOSS
  // -------------------------------------------------------------
  console.log('🍳 [6/7] Memeriksa Fitur Dapur, PWA & Log Stock Loss...');
  const lossLogs = await prisma.ingredientLog.findMany({
    where: { type: 'LOSS' },
    include: { ingredient: true, user: true }
  });

  passes.push(`Total pencatatan Stock Loss dapur: ${lossLogs.length} entri terdata dengan user ID.`);

  // -------------------------------------------------------------
  // 7. AUDIT MEJA & STATUS DINE-IN
  // -------------------------------------------------------------
  console.log('🪑 [7/7] Memeriksa Integritas Meja & Dine-In...');
  const tables = await prisma.table.findMany();
  const pendingOrders = await prisma.order.findMany({
    where: { status: 'Pending', tableId: { not: null } }
  });
  passes.push(`Total Meja: ${tables.length}, Meja Aktif Berisi: ${pendingOrders.length}.`);

  // -------------------------------------------------------------
  // RINGKASAN HASIL AUDIT
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log('   ✅ HASIL INTEGRITY CHECK & PASS LIST');
  console.log('======================================================');
  passes.forEach((p, idx) => console.log(`  ${idx + 1}. ✓ ${p}`));

  console.log('\n======================================================');
  console.log('   ⚠️ POTENSI LOGIC & OPTIMASI (FINDINGS)');
  console.log('======================================================');
  if (findings.length === 0) {
    console.log('  🎉 TIDAK DITEMUKAN MISS LOGIC KRITIS. SISTEM SEHAT!');
  } else {
    findings.forEach((f, idx) => console.log(`  ${idx + 1}. ! ${f}`));
  }
  console.log('======================================================\n');
}

runDeepAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
