import * as XLSX from 'xlsx';

// Helper formatting currency as number for clean spreadsheet calculations
const formatNumber = (val: number | null | undefined): number => Number(val || 0);

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
function autoFitColumns(ws: XLSX.WorkSheet, data: any[][], minWidth = 14) {
  const colWidths: number[] = [];
  data.forEach(row => {
    row.forEach((val, colIdx) => {
      const len = val !== null && val !== undefined ? String(val).length : 0;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || minWidth, len + 3);
    });
  });
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 55) }));
}

/**
 * Generator Laporan Spreadsheet Resmi Bengkel (.xlsx)
 * Menghasilkan workbook multi-sheet profesional berstandar akuntansi otomotif
 */
export function exportBengkelReportExcel(
  settings: any,
  reportData: any,
  startDate: string,
  endDate: string,
  printedBy?: string
) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'BENGKEL MOTOR & MOBIL';
  const address = settings?.address || 'Jl. Otomotif Servis Center';
  const phone = settings?.phone || '-';
  const periodText = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;
  const printedAt = new Date().toLocaleString('id-ID');

  const summary = reportData?.summary || {};
  const mechanicPerformance = reportData?.mechanicPerformance || [];
  const fastMovingParts = reportData?.fastMovingParts || [];
  const deadStockParts = reportData?.deadStockParts || [];
  const cashflow = reportData?.cashflowSummary || {};
  const opexBreakdown = cashflow?.opexBreakdown || [];

  // ── SHEET 1: RINGKASAN & LABA RUGI (P&L) ──
  const pnlRows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address} | Telp: ${phone}`],
    [`LAPORAN LABA RUGI OPERASIONAL BENGKEL (P&L)`],
    [`Periode: ${periodText}`],
    [`Dicetak oleh: ${printedBy || 'Admin Bengkel'} pada ${printedAt}`],
    [],
    ['KOMPONEN KEUANGAN BENGKEL', 'NOMINAL (IDR)', 'KETERANGAN'],
    ['I. PENDAPATAN USAHA (REVENUE)', '', ''],
    ['   Omzet Jasa Servis Kendaraan', formatNumber(summary.omzetJasa), 'Margin Jasa 100%'],
    ['   Omzet Penjualan Suku Cadang & Oli', formatNumber(summary.omzetParts), 'Volume suku cadang terpasang di SPK'],
    ['   Potongan Diskon & Promo SPK', -formatNumber(summary.totalDiscount), 'Diskon pengerjaan & promo'],
    ['TOTAL PENDAPATAN BERSIH (NET REVENUE)', formatNumber(summary.totalOmzetBersih), 'Total omzet setelah diskon'],
    [],
    ['II. HARGA POKOK PENJUALAN (HPP / COGS)', '', ''],
    ['   Modal Beli Sparepart Terpasang (HPP)', formatNumber(summary.hppParts), 'Modal pembelian part dari supplier'],
    ['LABA KOTOR USAHA (GROSS PROFIT)', formatNumber(summary.totalLabaKotor), `Margin Kotor: ${summary.totalOmzetBersih > 0 ? Math.round((summary.totalLabaKotor / summary.totalOmzetBersih) * 100) : 0}%`],
    [],
    ['III. BEBAN LANGSUNG OPERASIONAL', '', ''],
    ['   Beban Hak Komisi Mekanik', -formatNumber(summary.totalBebanKomisi), 'Alokasi jasa untuk mekanik'],
    ['LABA SETELAH KOMISI MEKANIK', formatNumber(summary.labaSetelahKomisi), 'Laba sebelum beban operasional'],
    [],
    ['IV. BEBAN KAS OPERASIONAL (OPEX PETTY CASH)', '', ''],
    ['   Beban Kas Keluar Operasional Bengkel', -formatNumber(summary.totalBebanOpex), 'Listrik, air, alat pit, konsumsi laci kas'],
    ['ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT)', formatNumber(summary.estimasiLabaBersih), `Net Margin: ${summary.totalOmzetBersih > 0 ? Math.round((summary.estimasiLabaBersih / summary.totalOmzetBersih) * 100) : 0}%`],
    [],
    ['RINGKASAN OPERASIONAL SPK', '', ''],
    ['   Total SPK Diselesaikan', summary.totalSPK || 0, 'Unit Kendaraan'],
    ['   Rata-rata Nilai per SPK', summary.totalSPK > 0 ? Math.round(summary.totalOmzetBersih / summary.totalSPK) : 0, 'IDR / Kendaraan'],
    ['   Rasio Komisi Mekanik terhadap Jasa', summary.omzetJasa > 0 ? `${Math.round((summary.totalBebanKomisi / summary.omzetJasa) * 100)}%` : '0%', 'Toleransi wajar 30% - 50%']
  ];

  const wsPnl = XLSX.utils.aoa_to_sheet(pnlRows);
  autoFitColumns(wsPnl, pnlRows);
  XLSX.utils.book_append_sheet(wb, wsPnl, 'Laba Rugi (P&L)');

  // ── SHEET 2: EVALUASI MEKANIK & KOMISI ──
  const mechanicRows: any[][] = [
    [storeName.toUpperCase()],
    [`EVALUASI PRODUKTIVITAS & HAK KOMISI MEKANIK - Periode: ${periodText}`],
    [],
    ['No', 'Nama Mekanik', 'No. WhatsApp', 'SPK Ditangani', 'Omzet Jasa Dihasilkan (IDR)', 'Skema Komisi', 'Hak Komisi Periode Ini (IDR)', 'Pending Komisi (IDR)']
  ];

  mechanicPerformance.forEach((m: any, idx: number) => {
    mechanicRows.push([
      idx + 1,
      m.name,
      m.phone || '-',
      m.spkCompleted,
      formatNumber(m.totalJasaGenerated),
      `${Math.round(m.commissionRate * 100)}%`,
      formatNumber(m.estimatedPeriodCommission),
      formatNumber(m.pendingCommission)
    ]);
  });

  const wsMechanic = XLSX.utils.aoa_to_sheet(mechanicRows);
  autoFitColumns(wsMechanic, mechanicRows);
  XLSX.utils.book_append_sheet(wb, wsMechanic, 'Kinerja Mekanik');

  // ── SHEET 3: FAST-MOVING SPAREPART ──
  const partsRows: any[][] = [
    [storeName.toUpperCase()],
    [`10 SUKU CADANG TERLARIS (FAST-MOVING) - Periode: ${periodText}`],
    [],
    ['No', 'Nama Suku Cadang', 'Qty Terjual', 'Total Omzet Penjualan (IDR)', 'Sisa Stok Rak', 'Batas Minimum', 'Status Stok']
  ];

  fastMovingParts.forEach((p: any, idx: number) => {
    partsRows.push([
      idx + 1,
      p.name,
      p.qty,
      formatNumber(p.revenue),
      p.stock,
      p.minStock || 0,
      p.stock <= (p.minStock || 0) ? 'STOK KRITIS' : 'AMAN'
    ]);
  });

  const wsParts = XLSX.utils.aoa_to_sheet(partsRows);
  autoFitColumns(wsParts, partsRows);
  XLSX.utils.book_append_sheet(wb, wsParts, 'Fast-Moving Parts');

  // ── SHEET 4: DEAD-STOCK (STOK MENGENDAP) ──
  if (deadStockParts.length > 0) {
    const deadStockRows: any[][] = [
      [storeName.toUpperCase()],
      [`MONITORING SUKU CADANG MENGENDAP (DEAD-STOCK / ZERO SALES) - Periode: ${periodText}`],
      [],
      ['No', 'Nama Suku Cadang', 'Sisa Stok Rak', 'Harga Beli Satuan (HPP)', 'Modal Tertahan (IDR)', 'Lokasi Rak']
    ];

    deadStockParts.forEach((p: any, idx: number) => {
      deadStockRows.push([
        idx + 1,
        p.name,
        p.stock,
        formatNumber(p.buyPrice),
        formatNumber(p.tiedUpCapital),
        p.storageLocation || 'Rak Gudang'
      ]);
    });

    const wsDead = XLSX.utils.aoa_to_sheet(deadStockRows);
    autoFitColumns(wsDead, deadStockRows);
    XLSX.utils.book_append_sheet(wb, wsDead, 'Dead-Stock Parts');
  }

  // ── SHEET 5: ARUS KAS & OPEX ──
  const cashflowRows: any[][] = [
    [storeName.toUpperCase()],
    [`REKONSILIASI ARUS KAS & PENGELUARAN OPERASIONAL - Periode: ${periodText}`],
    [],
    ['METRIK KAS OPERASIONAL', 'NOMINAL (IDR)'],
    ['Total Kas Masuk (Cash In / SPK Lunas)', formatNumber(cashflow.totalInflow)],
    ['Total Kas Keluar (Cash Out / OPEX)', formatNumber(cashflow.totalOutflow)],
    ['Net Cash Flow (Surplus / Defisit Kas)', formatNumber(cashflow.netCashflow)],
    [],
    ['RINCIAN KATEGORI PENGELUARAN (PETTY CASH)', 'JUMLAH (IDR)']
  ];

  opexBreakdown.forEach((op: any) => {
    cashflowRows.push([op.category, formatNumber(op.amount)]);
  });

  const wsCashflow = XLSX.utils.aoa_to_sheet(cashflowRows);
  autoFitColumns(wsCashflow, cashflowRows);
  XLSX.utils.book_append_sheet(wb, wsCashflow, 'Arus Kas OPEX');

  // Trigger browser download
  const cleanFileName = `Laporan_Bengkel_${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, cleanFileName);
}
