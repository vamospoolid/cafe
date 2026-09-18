import * as XLSX from 'xlsx';

// Helper formatting currency
const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val || 0);
};

// Helper format date string to ID
const formatDateIndo = (dateStr: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

// Helper auto-calculate column widths
function autoFitColumns(ws: XLSX.WorkSheet, data: any[][], minWidth = 12) {
  const colWidths: number[] = [];
  data.forEach(row => {
    row.forEach((val, colIdx) => {
      const len = val !== null && val !== undefined ? String(val).length : 0;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || minWidth, len + 3);
    });
  });
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 50) }));
}

// ─── 1. EXPORT PROFIT SHARING EXCEL ───────────────────────────────────────────

export function exportProfitSharingExcel(data: any, settings: any, period: { startDate: string; endDate: string }) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'MUKI RAMEN';
  const address = settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo';
  const phone = settings?.phone || '081298765432';
  const periodText = `${formatDateIndo(period.startDate)} s/d ${formatDateIndo(period.endDate)}`;
  const printedAt = new Date().toLocaleString('id-ID');

  const food = data?.foodDivision || {};
  const drink = data?.drinkDivision || {};
  const shared = data?.sharedOpex || {};
  const summary = data?.summary || {};
  const config = data?.config || {};
  const daily = data?.dailyBreakdown || [];

  // ── SHEET 1: RINGKASAN BAGI HASIL ──
  const summaryRows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address} | Telp: ${phone}`],
    ['LAPORAN BAGI HASIL USAHA (PROFIT SHARING)'],
    [`Periode: ${periodText}`],
    [`Dicetak: ${printedAt}`],
    [],
    ['=== PARAMETER KONFIGURASI BAGI HASIL ==='],
    ['Rasio Divisi Ramen (Makanan):', `${food.ownerPct || (100 - (config.ramenPct || 20))}% Owner : ${config.ramenPct || 20}% PJ Ramen`],
    ['Rasio Divisi Drink (Minuman):', `${drink.ownerPct || (100 - (config.drinkPct || 20))}% Owner : ${config.drinkPct || 20}% PJ Drink`],
    ['Mode Beban Bersama (OPEX):', config.opexMode === 'BEFORE_SPLIT' ? 'Dipotong Proporsional Sebelum Bagi Hasil' : (config.opexMode === 'OWNER_COVERED' ? 'Ditanggung Penuh Oleh Owner' : 'Split Beban 50% Owner : 25% Ramen : 25% Drink')],
    [],
    ['=== REKAP EKSEKUTIF PEMBAGIAN LABA BERSIH ==='],
    ['Entitas Penerima', 'Divisi', 'Porsi (%)', 'Nominal Pembagian (Rp)', 'Keterangan'],
    ['Owner (Divisi Ramen)', 'Muki Ramen (Food)', `${food.ownerPct || (100 - (config.ramenPct || 20))}%`, food.ownerShare || 0, 'Hak Owner dari laba bersih makanan'],
    ['Penanggung Jawab Muki Ramen', 'Muki Ramen (Food)', `${config.ramenPct || 20}%`, summary.pjRamenShare || 0, 'Bagi hasil bersih divisi makanan'],
    ['Owner (Divisi Drink)', 'Muki Drink (Bar)', `${drink.ownerPct || (100 - (config.drinkPct || 20))}%`, drink.ownerShare || 0, 'Hak Owner dari laba bersih minuman'],
    ['Penanggung Jawab Muki Drink', 'Muki Drink (Bar)', `${config.drinkPct || 20}%`, summary.pjDrinkShare || 0, 'Bagi hasil bersih divisi minuman'],
    ['Owner (Produk Netral / Retail)', 'Air Mineral & Toko', '100%', summary.other?.ownerShare || summary.other?.finalNet || 0, 'Hak 100% Owner dari laba bersih produk netral'],
    ['TOTAL LABA BERSIH DIBAGIKAN', 'Semua Divisi', '100%', summary.totalNetProfit || 0, 'Total laba bersih usaha periode ini'],
    [],
    ['=== KINERJA DIVISI 1: MUKI RAMEN (FOOD & KITCHEN) ==='],
    ['Metrik Finansial', 'Nilai (Rp / Qty)', 'Catatan'],
    ['Total Omzet Makanan', food.revenue || 0, `Porsi ${food.percentage || 0}% dari total penjualan`],
    ['Jumlah Porsi Terjual', food.qtySold || 0, 'Porsi/item makanan'],
    ['Total Beban Belanja Dapur / HPP', food.totalExpense || 0, 'Belanja bahan baku makanan'],
    ['Laba Kotor Divisi Ramen', food.grossProfit || 0, 'Omzet - Beban Belanja'],
    ['Alokasi Beban Bersama (Shared OPEX)', food.sharedOpexPortion || 0, 'Listrik, gas, kemasan, dll'],
    ['Laba Bersih Divisi Ramen', food.netProfit || 0, 'Laba setelah beban bersama'],
    [`Bagian Owner Ramen (${food.ownerPct || (100 - (config.ramenPct || 20))}%)`, food.ownerShare || 0, 'Setoran ke Owner dari Ramen'],
    [`Bagian PJ Ramen (${config.ramenPct || 20}%)`, food.pjShare || 0, 'Hak PJ Muki Ramen'],
    [],
    ['=== KINERJA DIVISI 2: MUKI DRINK (BEVERAGE & BAR) ==='],
    ['Metrik Finansial', 'Nilai (Rp / Qty)', 'Catatan'],
    ['Total Omzet Minuman', drink.revenue || 0, `Porsi ${drink.percentage || 0}% dari total penjualan`],
    ['Jumlah Cup Terjual', drink.qtySold || 0, 'Cup/porsi minuman'],
    ['Total Beban Belanja Bar / HPP', drink.totalExpense || 0, 'Belanja bahan baku minuman'],
    ['Laba Kotor Divisi Drink', drink.grossProfit || 0, 'Omzet - Beban Belanja'],
    ['Alokasi Beban Bersama (Shared OPEX)', drink.sharedOpexPortion || 0, 'Listrik, es, kemasan, dll'],
    ['Laba Bersih Divisi Drink', drink.netProfit || 0, 'Laba setelah beban bersama'],
    [`Bagian Owner Drink (${drink.ownerPct || (100 - (config.drinkPct || 20))}%)`, drink.ownerShare || 0, 'Setoran ke Owner dari Minuman'],
    [`Bagian PJ Drink (${config.drinkPct || 20}%)`, drink.pjShare || 0, 'Hak PJ Muki Drink'],
    [],
    ['=== KINERJA DIVISI 3: PRODUK NETRAL / RETAIL (AIR MINERAL & TOKO) ==='],
    ['Metrik Finansial', 'Nilai (Rp / Qty)', 'Catatan'],
    ['Total Omzet Air Mineral / Retail', summary.other?.revenue || 0, 'Penjualan produk netral'],
    ['Total Modal Belanja / HPP', summary.other?.expense || 0, 'Belanja dus air mineral / retail'],
    ['Laba Bersih Masuk ke Owner (100%)', summary.other?.finalNet || 0, '100% Hak Owner / Kas Toko'],
    [],
    ['=== BEBAN OPERASIONAL BERSAMA (SHARED OPEX) ==='],
    ['Metrik', 'Nilai (Rp)', 'Keterangan'],
    ['Total Beban Operasional Bersama', shared.total || 0, 'Listrik, air, gas, sewa, wifi, kemasan umum'],
    ['Alokasi Beban ke Divisi Ramen', shared.foodPortion || 0, 'Proporsional terhadap omzet'],
    ['Alokasi Beban ke Divisi Drink', shared.drinkPortion || 0, 'Proporsional terhadap omzet'],
    ['Alokasi Beban ke Owner Langsung', shared.ownerPortion || 0, 'Jika mode OWNER_COVERED / SPLIT_50_50']
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  autoFitColumns(wsSummary, summaryRows, 15);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Bagi Hasil');

  // ── SHEET 2: RINCIAN HARIAN (DAILY BREAKDOWN) ──
  const dailyHeaders = [
    'No',
    'Tanggal',
    'Hari',
    'Omzet Ramen (Rp)',
    'Belanja Ramen (Rp)',
    'Laba Ramen (Rp)',
    `Hak PJ Ramen (${config.ramenPct || 20}%)`,
    'Omzet Drink (Rp)',
    'Belanja Drink (Rp)',
    'Laba Drink (Rp)',
    `Hak PJ Drink (${config.drinkPct || 20}%)`,
    'Beban Bersama (Rp)',
    'Total Omzet (Rp)',
    'Hak Bersih Owner (Rp)'
  ];

  const dailyRows: any[][] = [
    [storeName.toUpperCase()],
    ['RINCIAN HARIAN BAGI HASIL & ARUS KAS DIVISI'],
    [`Periode: ${periodText}`],
    [],
    dailyHeaders
  ];

  daily.forEach((d: any, idx: number) => {
    dailyRows.push([
      idx + 1,
      d.date,
      d.dayName,
      d.foodRevenue,
      d.foodExpense,
      d.foodNet,
      d.foodPjShare,
      d.drinkRevenue,
      d.drinkExpense,
      d.drinkNet,
      d.drinkPjShare,
      d.sharedOpex,
      d.totalOmzet,
      d.ownerShareTotal
    ]);
  });

  // Total row
  dailyRows.push([
    'TOTAL',
    '—',
    '—',
    food.revenue || 0,
    food.totalExpense || 0,
    food.grossProfit || 0,
    summary.pjRamenShare || 0,
    drink.revenue || 0,
    drink.totalExpense || 0,
    drink.grossProfit || 0,
    summary.pjDrinkShare || 0,
    shared.total || 0,
    summary.totalRevenue || 0,
    summary.ownerShare || 0
  ]);

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  autoFitColumns(wsDaily, dailyRows, 12);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Rincian Harian');

  // ── SHEET 3: DAFTAR PENGELUARAN DIVISI ──
  if (shared.items && shared.items.length > 0) {
    const expenseHeaders = ['No', 'Tanggal', 'Kategori', 'Deskripsi / Keperluan', 'Alokasi Divisi', 'Nominal (Rp)'];
    const expenseRows: any[][] = [
      [storeName.toUpperCase()],
      ['LOG PENGELUARAN KAS KECIL BERDASARKAN DIVISI'],
      [`Periode: ${periodText}`],
      [],
      expenseHeaders
    ];

    shared.items.forEach((it: any, idx: number) => {
      let divLabel = 'Operasional Bersama (Shared)';
      if (it.division === 'food') divLabel = 'Muki Ramen (Food)';
      else if (it.division === 'drink') divLabel = 'Muki Drink (Bar)';

      expenseRows.push([
        idx + 1,
        formatDateIndo(it.date),
        it.category || 'Operasional',
        it.description || '—',
        divLabel,
        it.amount || 0
      ]);
    });

    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
    autoFitColumns(wsExpenses, expenseRows, 14);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Daftar Pengeluaran');
  }

  // Save workbook
  const sDate = period.startDate ? period.startDate.split('-').join('') : 'ALL';
  const eDate = period.endDate ? period.endDate.split('-').join('') : 'ALL';
  XLSX.writeFile(wb, `Laporan_Bagi_Hasil_Muki_Ramen_${sDate}_${eDate}.xlsx`);
}

// ─── 2. EXPORT DAILY OMZET BONUS MATRIX EXCEL ─────────────────────────────────

export function exportDailyBonusExcel(data: any, settings: any, period: { startDate: string; endDate: string }) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'MUKI RAMEN';
  const address = settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo';
  const periodText = `${formatDateIndo(period.startDate)} s/d ${formatDateIndo(period.endDate)}`;
  const printedAt = new Date().toLocaleString('id-ID');

  const isStaff = (u: any) => {
    const role = (u?.role || '').toLowerCase();
    const uname = (u?.username || '').toLowerCase();
    const name = (u?.name || '').toLowerCase();
    return !['admin', 'super admin', 'superadmin', 'owner'].includes(role) &&
           !['admin', 'superadmin', 'owner'].includes(uname) &&
           name !== 'super admin';
  };

  const rawEmployees = data?.employees || [];
  const employees = rawEmployees.filter(isStaff);
  const days = data?.days || [];
  const rawSummaries = data?.employeeSummaries || [];
  const employeeSummaries = rawSummaries.filter((s: any) => isStaff(s));
  const tiers = data?.tiers || [];
  const totalBonusAll = data?.totalBonusAll || 0;

  // ── SHEET 1: MATRIKS BONUS & ABSENSI (Persis Spreadsheet Format Owner) ──
  const matrixHeaderRow1 = ['No', 'Tanggal', 'Hari', 'Omzet (Rp)', 'Tier Target', 'Bonus Tier (Rp)'];
  employees.forEach((emp: any) => {
    const typeLabel = emp.employmentType === 'DAILY_WORKER' ? ' (DW)' : '';
    matrixHeaderRow1.push(`${emp.name.toUpperCase()}${typeLabel}`);
  });

  const matrixRows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address}`],
    ['MATRIKS REWARD ABSENSI & BONUS OMZET HARIAN KARYAWAN'],
    [`Periode: ${periodText}`],
    [`Dicetak: ${printedAt}`],
    [],
    ['=== ATURAN TIER BONUS OMZET HARIAN (FULL TIME CREW) ==='],
    ['Tier Min Omzet', 'Reward Bonus / Orang (Rp)', 'Keterangan'],
    ...tiers.map((t: any) => [formatRupiah(t.minOmzet), formatRupiah(t.bonus), t.label || `Omzet >= ${formatRupiah(t.minOmzet)}`]),
    [],
    matrixHeaderRow1
  ];

  let totalOmzetAllDays = 0;

  days.forEach((day: any, idx: number) => {
    totalOmzetAllDays += day.grossOmzet || 0;
    const row = [
      idx + 1,
      day.date,
      day.dayName,
      day.grossOmzet || 0,
      day.matchedTier ? (day.matchedTier.label || `Tier ${formatRupiah(day.matchedTier.minOmzet)}`) : 'Dibawah Target',
      day.tierBonus || 0
    ];

    employees.forEach((emp: any) => {
      const att = day.employeeAttendance ? day.employeeAttendance[emp.id] : null;
      if (att) {
        if (att.bonus > 0) {
          row.push(att.bonus); // Numeric bonus in Excel
        } else {
          row.push(att.displayBadge || att.status || 'LIBUR');
        }
      } else {
        row.push('LIBUR');
      }
    });

    matrixRows.push(row);
  });

  // Total Row at bottom
  const totalRow = [
    'TOTAL',
    '—',
    '—',
    totalOmzetAllDays,
    '—',
    '—'
  ];

  employees.forEach((emp: any) => {
    const summary = employeeSummaries.find((s: any) => s.userId === emp.id);
    totalRow.push(summary?.totalBonus || 0);
  });

  matrixRows.push(totalRow);
  matrixRows.push([]);
  matrixRows.push(['TOTAL KESELURUHAN REWARD BONUS OMZET:', totalBonusAll]);

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  autoFitColumns(wsMatrix, matrixRows, 14);
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Matriks Bonus & Absensi');

  // ── SHEET 2: REKAPITULASI KARYAWAN ──
  const summaryHeaders = [
    'No',
    'Nama Karyawan',
    'Jabatan / Role',
    'Tipe Kepegawaian',
    'Hari Hadir',
    'Terlambat',
    'Libur / Off',
    'Izin / Sakit / Cuti',
    'Total Bonus Diterima (Rp)'
  ];

  const summaryRows: any[][] = [
    [storeName.toUpperCase()],
    ['REKAPITULASI ABSENSI & AKUMULASI BONUS KARYAWAN'],
    [`Periode: ${periodText}`],
    [],
    summaryHeaders
  ];

  employeeSummaries.forEach((s: any, idx: number) => {
    let empTypeStr = 'Full Time';
    if (s.employmentType === 'DAILY_WORKER') empTypeStr = 'Daily Worker (DW)';
    else if (s.employmentType === 'PART_TIME') empTypeStr = 'Part Time';

    summaryRows.push([
      idx + 1,
      s.name,
      s.role,
      empTypeStr,
      s.presentCount || 0,
      s.lateCount || 0,
      s.offCount || 0,
      s.leaveCount || 0,
      s.totalBonus || 0
    ]);
  });

  summaryRows.push([
    'TOTAL',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    totalBonusAll
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  autoFitColumns(wsSummary, summaryRows, 15);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekap Karyawan');

  const sDate = period.startDate ? period.startDate.split('-').join('') : 'ALL';
  const eDate = period.endDate ? period.endDate.split('-').join('') : 'ALL';
  XLSX.writeFile(wb, `Matriks_Bonus_Omzet_Muki_Ramen_${sDate}_${eDate}.xlsx`);
}

// ─── 3. EXPORT PETTY CASH EXCEL ───────────────────────────────────────────────

export function exportPettyCashExcel(cashFlows: any[], summary: any, settings: any, period: { startDate: string; endDate: string }) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'MUKI RAMEN';
  const address = settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo';
  const periodText = `${formatDateIndo(period.startDate)} s/d ${formatDateIndo(period.endDate)}`;
  const printedAt = new Date().toLocaleString('id-ID');

  const rows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address}`],
    ['BUKU KAS KECIL & ARUS KAS OPERASIONAL (PETTY CASH JOURNAL)'],
    [`Periode: ${periodText}`],
    [`Dicetak: ${printedAt}`],
    [],
    ['=== REKAPITULASI ARUS KAS KECIL ==='],
    ['Metrik', 'Nilai (Rp)'],
    ['Saldo Awal Periode', summary?.initialBalance || 0],
    ['Total Penerimaan / Kas Masuk', summary?.totalIn || 0],
    ['Total Pengeluaran / Kas Keluar', summary?.totalOut || 0],
    ['Arus Kas Bersih (Net Cash Flow)', summary?.netCashFlow || 0],
    ['Saldo Akhir Kas Kecil', summary?.finalBalance || 0],
    [],
    ['No', 'Tanggal & Waktu', 'Jenis Mutasi', 'Kategori', 'Keterangan Transaksi', 'Kasir / Staf', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Saldo Berjalan (Rp)']
  ];

  let currentBalance = summary?.initialBalance || 0;

  cashFlows.forEach((cf, idx) => {
    const isPemasukan = cf.type === 'Pemasukan';
    const masuk = isPemasukan ? cf.amount : 0;
    const keluar = !isPemasukan ? cf.amount : 0;
    currentBalance += masuk - keluar;

    rows.push([
      idx + 1,
      new Date(cf.date).toLocaleString('id-ID'),
      cf.type,
      cf.category || 'Umum',
      cf.description || '—',
      cf.user?.name || 'Kasir',
      masuk,
      keluar,
      currentBalance
    ]);
  });

  rows.push([
    'TOTAL',
    '—',
    '—',
    '—',
    '—',
    '—',
    summary?.totalIn || 0,
    summary?.totalOut || 0,
    summary?.finalBalance || 0
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoFitColumns(ws, rows, 14);
  XLSX.utils.book_append_sheet(wb, ws, 'Buku Kas Kecil');

  const sDate = period.startDate ? period.startDate.split('-').join('') : 'ALL';
  const eDate = period.endDate ? period.endDate.split('-').join('') : 'ALL';
  XLSX.writeFile(wb, `Laporan_Kas_Kecil_Muki_Ramen_${sDate}_${eDate}.xlsx`);
}

// ─── 4. EXPORT SALES REPORT EXCEL ─────────────────────────────────────────────

export function exportSalesReportExcel(reportData: any, settings: any, period: { startDate: string; endDate: string }) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'MUKI RAMEN';
  const address = settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo';
  const periodText = `${formatDateIndo(period.startDate)} s/d ${formatDateIndo(period.endDate)}`;
  const printedAt = new Date().toLocaleString('id-ID');

  const summary = reportData?.summary || {};
  const catBreakdown = reportData?.categoryBreakdown || {};
  const products = reportData?.products || [];
  const dailyTimeline = reportData?.dailyTimeline || [];
  const paymentMethods = reportData?.paymentMethods || {};
  const shifts = reportData?.shifts || [];

  // ── SHEET 1: RINGKASAN PENJUALAN ──
  const summaryRows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address}`],
    ['LAPORAN KINERJA PENJUALAN & LABA KOTOR'],
    [`Periode: ${periodText}`],
    [`Dicetak: ${printedAt}`],
    [],
    ['=== RINGKASAN FINANSIAL PENJUALAN ==='],
    ['Metrik', 'Nilai (Rp / Qty / %)'],
    ['Total Pendapatan Kotor (Omzet)', summary.revenue || 0],
    ['Total Modal Pokok Penjualan (HPP)', summary.hpp || 0],
    ['Total Laba Kotor Usaha', summary.profit || 0],
    ['Gross Margin (%)', `${summary.grossMargin || 0}%`],
    ['Total Transaksi Pesanan', summary.transactionsCount || 0],
    ['Total Diskon Diberikan', summary.discounts || 0],
    ['Total Pajak Resto (PB1)', summary.tax || 0],
    ['Total Biaya Layanan (Service Charge)', summary.serviceCharge || 0],
    [],
    ['=== KINERJA DIVISI MAKANAN VS MINUMAN ==='],
    ['Divisi', 'Omzet (Rp)', 'Qty Terjual', 'HPP Modal (Rp)', 'Laba Kotor (Rp)', 'Margin (%)', 'Porsi Omzet (%)'],
    ['Muki Ramen (Food)', catBreakdown.food?.revenue || 0, catBreakdown.food?.qty || 0, catBreakdown.food?.cost || 0, catBreakdown.food?.profit || 0, `${catBreakdown.food?.margin || 0}%`, `${catBreakdown.food?.percentage || 0}%`],
    ['Muki Drink (Bar)', catBreakdown.drink?.revenue || 0, catBreakdown.drink?.qty || 0, catBreakdown.drink?.cost || 0, catBreakdown.drink?.profit || 0, `${catBreakdown.drink?.margin || 0}%`, `${catBreakdown.drink?.percentage || 0}%`],
    ['Lainnya / Merchandise', catBreakdown.other?.revenue || 0, catBreakdown.other?.qty || 0, catBreakdown.other?.cost || 0, catBreakdown.other?.profit || 0, `${catBreakdown.other?.margin || 0}%`, `${catBreakdown.other?.percentage || 0}%`],
    [],
    ['=== BREAKDOWN METODE PEMBAYARAN ==='],
    ['Metode Pembayaran', 'Jumlah Transaksi', 'Total Nominal (Rp)']
  ];

  Object.entries(paymentMethods).forEach(([pm, data]: [string, any]) => {
    summaryRows.push([pm, data.count || 0, data.amount || 0]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  autoFitColumns(wsSummary, summaryRows, 15);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Penjualan');

  // ── SHEET 2: MENU TERLARIS & PRODUK ──
  const productHeaders = ['No', 'Nama Menu', 'Kategori', 'Qty Terjual', 'Harga Jual Satuan (Rp)', 'Total Omzet (Rp)', 'Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'];
  const productRows: any[][] = [
    [storeName.toUpperCase()],
    ['RINCIAN PENJUALAN PRODUK & MENU'],
    [`Periode: ${periodText}`],
    [],
    productHeaders
  ];

  products.forEach((p: any, idx: number) => {
    const unitPrice = p.qty > 0 ? Math.round(p.revenue / p.qty) : 0;
    productRows.push([
      idx + 1,
      p.name,
      p.category,
      p.qty,
      unitPrice,
      p.revenue,
      p.cost,
      p.profit,
      `${p.margin}%`
    ]);
  });

  const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
  autoFitColumns(wsProducts, productRows, 14);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Rincian Menu');

  // ── SHEET 3: TIMELINE HARIAN ──
  if (dailyTimeline.length > 0) {
    const timelineHeaders = ['No', 'Tanggal', 'Omzet Makanan (Rp)', 'HPP Makanan (Rp)', 'Omzet Minuman (Rp)', 'HPP Minuman (Rp)', 'Total Omzet (Rp)', 'Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)', 'Jumlah Struk'];
    const timelineRows: any[][] = [
      [storeName.toUpperCase()],
      ['TIMELINE PENJUALAN & LABA HARIAN'],
      [`Periode: ${periodText}`],
      [],
      timelineHeaders
    ];

    dailyTimeline.forEach((d: any, idx: number) => {
      timelineRows.push([
        idx + 1,
        d.dateRaw,
        d.makanan,
        d.makananHpp,
        d.minuman,
        d.minumanHpp,
        d.total,
        d.hpp,
        d.grossProfit,
        `${d.margin}%`,
        d.count
      ]);
    });

    const wsTimeline = XLSX.utils.aoa_to_sheet(timelineRows);
    autoFitColumns(wsTimeline, timelineRows, 14);
    XLSX.utils.book_append_sheet(wb, wsTimeline, 'Timeline Harian');
  }

  // ── SHEET 4: REKAP SHIFT KASIR ──
  if (shifts.length > 0) {
    const shiftHeaders = ['No', 'Kasir', 'Waktu Buka', 'Waktu Tutup', 'Saldo Awal (Rp)', 'Omzet Tunai (Rp)', 'Omzet Non-Tunai (Rp)', 'Total Sistem (Rp)', 'Fisik Laci (Rp)', 'Selisih (Rp)', 'Status'];
    const shiftRows: any[][] = [
      [storeName.toUpperCase()],
      ['LOG REKONSILIASI SHIFT KASIR'],
      [`Periode: ${periodText}`],
      [],
      shiftHeaders
    ];

    shifts.forEach((s: any, idx: number) => {
      shiftRows.push([
        idx + 1,
        s.user?.name || 'Kasir',
        new Date(s.waktuBuka).toLocaleString('id-ID'),
        s.waktuTutup ? new Date(s.waktuTutup).toLocaleString('id-ID') : 'Masih Terbuka',
        s.saldoAwal || 0,
        s.cashSales || 0,
        s.nonCashSales || 0,
        s.saldoSistem || 0,
        s.saldoFisikLaci || 0,
        s.selisih || 0,
        s.status
      ]);
    });

    const wsShifts = XLSX.utils.aoa_to_sheet(shiftRows);
    autoFitColumns(wsShifts, shiftRows, 14);
    XLSX.utils.book_append_sheet(wb, wsShifts, 'Rekap Shift Kasir');
  }

  const sDate = period.startDate ? period.startDate.split('-').join('') : 'ALL';
  const eDate = period.endDate ? period.endDate.split('-').join('') : 'ALL';
  XLSX.writeFile(wb, `Laporan_Penjualan_Muki_Ramen_${sDate}_${eDate}.xlsx`);
}

// ─── 5. EXPORT INVENTORY VALUATION EXCEL ──────────────────────────────────────

export function exportInventoryValuationExcel(inventoryData: any, settings: any) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'MUKI RAMEN';
  const address = settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo';
  const printedAt = new Date().toLocaleString('id-ID');

  const summary = inventoryData?.summary || {};
  const items = inventoryData?.inventory || [];

  const headers = [
    'No',
    'Nama Bahan Baku',
    'Satuan',
    'Supplier',
    'Stok Awal',
    'Masuk (PO/Restock)',
    'Keluar Produksi',
    'Rusak / Waste',
    'Penyesuaian',
    'Stok Akhir',
    'Batas Minimum',
    'Harga Beli Satuan (Rp)',
    'Total Valuasi Aset (Rp)',
    'Status Stok'
  ];

  const rows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address}`],
    ['LAPORAN MUTASI & VALUASI PERSEDIAAN BAHAN BAKU'],
    [`Dicetak: ${printedAt}`],
    [],
    ['=== RINGKASAN VALUASI INVENTARIS BAHAN BAKU ==='],
    ['Total Valuasi Aset Stok:', summary.totalAssetValuation || 0],
    ['Jumlah Item Di Bawah Batas Minimum:', summary.criticalItemsCount || 0],
    ['Total Mutasi Stok Terjadi:', summary.totalMutationsCount || 0],
    [],
    headers
  ];

  items.forEach((item: any, idx: number) => {
    const isCritical = (item.stockAkhir || 0) <= (item.minStock || 0);
    rows.push([
      idx + 1,
      item.name,
      item.unit,
      item.supplierName || '—',
      item.stockAwal || 0,
      item.masuk || 0,
      item.keluarProduksi || 0,
      item.keluarRusak || 0,
      item.penyesuaian || 0,
      item.stockAkhir || 0,
      item.minStock || 0,
      item.buyPrice || 0,
      item.totalValuation || 0,
      isCritical ? 'MENIPIS / ORDER' : 'AMAN'
    ]);
  });

  rows.push([
    'TOTAL VALUASI ASET',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    summary.totalAssetValuation || 0,
    '—'
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoFitColumns(ws, rows, 14);
  XLSX.utils.book_append_sheet(wb, ws, 'Valuasi Bahan Baku');

  const todayStr = new Date().toISOString().split('T')[0].split('-').join('');
  XLSX.writeFile(wb, `Laporan_Valuasi_Bahan_Baku_Muki_Ramen_${todayStr}.xlsx`);
}

// ─── 6. EXPORT PRODUCT FINISHED GOODS VALUATION EXCEL ─────────────────────────

export function exportProductValuationExcel(productData: any, settings: any) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'MUKI RAMEN';
  const address = settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo';
  const printedAt = new Date().toLocaleString('id-ID');

  const summary = productData?.summary || {};
  const products = productData?.products || [];

  const headers = [
    'No',
    'Barcode',
    'Nama Produk / Menu',
    'Kategori',
    'Harga Beli / HPP (Rp)',
    'Harga Jual (Rp)',
    'Margin Satuan (Rp)',
    'Margin (%)',
    'Stok Fisik',
    'Batas Minimum',
    'Total Valuasi HPP (Rp)',
    'Potensi Omzet Penjualan (Rp)',
    'Status'
  ];

  const rows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address}`],
    ['LAPORAN VALUASI PERSEDIAAN BARANG JADI (FINISHED GOODS)'],
    [`Dicetak: ${printedAt}`],
    [],
    ['=== RINGKASAN VALUASI BARANG JADI ==='],
    ['Total Valuasi Aset (HPP):', summary.totalAssetValuation || 0],
    ['Potensi Total Penjualan:', summary.totalPotentialSales || 0],
    ['Jumlah Produk Stok Menipis:', summary.criticalProductsCount || 0],
    [],
    headers
  ];

  products.forEach((p: any, idx: number) => {
    rows.push([
      idx + 1,
      p.barcode || '—',
      p.name,
      p.categoryName || '—',
      p.buyPrice || 0,
      p.sellPrice || 0,
      p.marginNominal || 0,
      `${p.marginPercent || 0}%`,
      p.stock || 0,
      p.minStock || 0,
      p.totalAssetValuation || 0,
      p.totalPotentialSales || 0,
      p.status || 'Aktif'
    ]);
  });

  rows.push([
    'TOTAL VALUASI',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    '—',
    summary.totalAssetValuation || 0,
    summary.totalPotentialSales || 0,
    '—'
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoFitColumns(ws, rows, 14);
  XLSX.utils.book_append_sheet(wb, ws, 'Valuasi Barang Jadi');

  const todayStr = new Date().toISOString().split('T')[0].split('-').join('');
  XLSX.writeFile(wb, `Laporan_Valuasi_Barang_Jadi_Muki_Ramen_${todayStr}.xlsx`);
}
