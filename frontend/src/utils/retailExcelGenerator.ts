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
 * Generator Laporan Spreadsheet Resmi Retail / Grosir (.xlsx)
 * Menghasilkan workbook multi-sheet profesional berstandar retail grosir & distribusi
 */
export function exportRetailReportExcel(
  reportData: any,
  settings: any,
  startDate: string,
  endDate: string,
  printedBy?: string
) {
  const wb = XLSX.utils.book_new();
  const storeName = settings?.storeName || 'TOKO GROSIR & SEMBAKO';
  const address = settings?.address || 'Jl. Perdagangan Niaga';
  const phone = settings?.phone || '-';
  const periodText = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;
  const printedAt = new Date().toLocaleString('id-ID');

  const summary = reportData?.summary || {};
  const tierSales = reportData?.tierSales || [];
  const velocity = reportData?.stockVelocity || { fastMoving: [], slowMoving: [] };
  const arAgeing = reportData?.arAgeing || { totalAR: 0, currentAR: 0, ageing30to60: 0, ageingOver60: 0, debts: [] };
  const deliverySummary = reportData?.deliverySummary || { total: 0, pending: 0, inTransit: 0, delivered: 0 };
  const shiftSummary = reportData?.shiftSummary || { totalShifts: 0, totalCashIn: 0, totalCashOut: 0, netCash: 0, shifts: [] };

  const grossProfit = summary.grossProfit || 0;
  const totalOpex = shiftSummary.totalCashOut || 0;
  const netProfit = grossProfit - totalOpex;

  // ── SHEET 1: RINGKASAN & LABA RUGI (P&L) ──
  const pnlRows: any[][] = [
    [storeName.toUpperCase()],
    [`Alamat: ${address} | Telp: ${phone}`],
    [`LAPORAN LABA RUGI & FINANSIAL TOKO RETAIL / GROSIR`],
    [`Periode: ${periodText}`],
    [`Dicetak oleh: ${printedBy || 'Admin Toko'} pada ${printedAt}`],
    [],
    ['KOMPONEN KEUANGAN TOKO', 'NOMINAL (IDR)', 'KETERANGAN'],
    ['I. PENDAPATAN PENJUALAN', '', ''],
    ['   Total Penjualan Kotor (Gross Sales)', formatNumber(summary.totalSales), 'Total transaksi kasir & grosir'],
    ['   Total Transaksi Kasir', summary.totalOrders || 0, 'Struk / Invoice'],
    ['   Rata-rata Nilai per Transaksi (Basket Size)', summary.totalOrders > 0 ? Math.round(summary.totalSales / summary.totalOrders) : 0, 'IDR / Transaksi'],
    [],
    ['II. HARGA POKOK PENJUALAN (HPP / COGS)', '', ''],
    ['   Total Modal Beli Barang Terjual (HPP)', formatNumber(summary.totalHpp), 'Modal pembelian barang dari suplier'],
    ['LABA KOTOR TOKO (GROSS PROFIT)', formatNumber(grossProfit), `Gross Margin: ${summary.marginPercentage || 0}%`],
    [],
    ['III. BEBAN OPERASIONAL KASIR & LACI (OPEX)', '', ''],
    ['   Total Kas Keluar Shift Operasional', -formatNumber(totalOpex), 'Belanja operasional toko, listrik, plastik, dll'],
    ['ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT)', formatNumber(netProfit), `Net Margin: ${summary.totalSales > 0 ? Math.round((netProfit / summary.totalSales) * 100) : 0}%`],
    [],
    ['IV. STATUS PIUTANG BON TEMPO (AR)', '', ''],
    ['   Total Saldo Piutang Berjalan', formatNumber(summary.totalAR), 'Faktur bon tempo pelanggan / warung belum lunas'],
    ['   Jumlah Faktur Belum Lunas', arAgeing.debts?.length || 0, 'Faktur Bon Tempo']
  ];

  const wsPnl = XLSX.utils.aoa_to_sheet(pnlRows);
  autoFitColumns(wsPnl, pnlRows);
  XLSX.utils.book_append_sheet(wb, wsPnl, 'Laba Rugi (P&L)');

  // ── SHEET 2: ANALISIS PENJUALAN 3-TIER PRICE ──
  const tierRows: any[][] = [
    [storeName.toUpperCase()],
    [`ANALISIS KINERJA PENJUALAN 3-TIER PRICE - Periode: ${periodText}`],
    [],
    ['LEVEL HARGA (PRICE TIER)', 'JUMLAH TRANSAKSI', 'TOTAL OMZET (IDR)', 'ESTIMASI HPP (IDR)', 'LABA KOTOR (IDR)', 'MARGIN (%)'],
    ...tierSales.map((t: any) => [
      t.tier || 'UMUM',
      t.count || 0,
      formatNumber(t.revenue),
      formatNumber(t.cost),
      formatNumber(t.profit),
      `${t.margin || 0}%`
    ])
  ];

  const wsTier = XLSX.utils.aoa_to_sheet(tierRows);
  autoFitColumns(wsTier, tierRows);
  XLSX.utils.book_append_sheet(wb, wsTier, 'Penjualan 3-Tier');

  // ── SHEET 3: FAST & SLOW MOVING STOCK ──
  const velocityRows: any[][] = [
    [storeName.toUpperCase()],
    [`ANALISIS KECEPATAN PERPUTARAN STOK (VELOCITY) - Periode: ${periodText}`],
    [],
    ['KATEGORI', 'NAMA BARANG', 'SATUAN', 'JUMLAH KELUAR', 'TOTAL PENJUALAN (IDR)', 'SISA STOK RAK', 'STATUS'],
    ...((velocity.fastMoving || []).map((p: any) => [
      'FAST MOVING',
      p.name,
      p.baseUom || 'PCS',
      p.qtySold || p.qty || 0,
      formatNumber(p.revenue),
      p.stock || 0,
      p.stock <= (p.minStock || 5) ? 'STOK KRITIS' : 'AMAN'
    ])),
    ...((velocity.slowMoving || []).map((p: any) => [
      'SLOW MOVING',
      p.name,
      p.baseUom || 'PCS',
      p.qtySold || p.qty || 0,
      formatNumber(p.revenue),
      p.stock || 0,
      'PERPUTARAN LAMBAT'
    ]))
  ];

  const wsVelocity = XLSX.utils.aoa_to_sheet(velocityRows);
  autoFitColumns(wsVelocity, velocityRows);
  XLSX.utils.book_append_sheet(wb, wsVelocity, 'Stok Fast & Slow');

  // ── SHEET 4: BUKU PIUTANG BON TEMPO (AR AGEING) ──
  const arRows: any[][] = [
    [storeName.toUpperCase()],
    [`BUKU PIUTANG BON TEMPO & AR AGEING - Periode: ${periodText}`],
    [],
    ['NO. TRANSAKSI', 'NAMA PELANGGAN / MITRA', 'TANGGAL FAKTUR', 'JATUH TEMPO', 'TOTAL TAGIHAN (IDR)', 'SISA PIUTANG (IDR)', 'STATUS USIA'],
    ...((arAgeing.debts || []).map((d: any) => [
      d.orderNumber || d.invoiceNumber || '-',
      d.customerName || 'Pelanggan Umum',
      formatDateIndo(d.createdAt),
      d.dueDate ? formatDateIndo(d.dueDate) : '—',
      formatNumber(d.totalAmount),
      formatNumber(d.remainingAmount),
      d.ageingStatus || 'Lancar'
    ]))
  ];

  const wsAr = XLSX.utils.aoa_to_sheet(arRows);
  autoFitColumns(wsAr, arRows);
  XLSX.utils.book_append_sheet(wb, wsAr, 'Piutang Bon Tempo');

  // ── SHEET 5: SURAT JALAN & PENGIRIMAN ──
  const deliveryRows: any[][] = [
    [storeName.toUpperCase()],
    [`REKAPITULASI SURAT JALAN & ARMADA - Periode: ${periodText}`],
    [],
    ['RINGKASAN PENGIRIMAN ARMADA', 'JUMLAH DOKUMEN', 'KETERANGAN'],
    ['Total Surat Jalan Diterbitkan', deliverySummary.total || 0, 'Dokumen DO'],
    ['Menunggu Muat / Antrean', deliverySummary.pending || 0, 'Belum Berangkat'],
    ['Dalam Pengiriman Kurir / Armada', deliverySummary.inTransit || 0, 'On The Road'],
    ['Terkirim & Diterima Pelanggan', deliverySummary.delivered || 0, 'Selesai']
  ];

  const wsDelivery = XLSX.utils.aoa_to_sheet(deliveryRows);
  autoFitColumns(wsDelivery, deliveryRows);
  XLSX.utils.book_append_sheet(wb, wsDelivery, 'Surat Jalan DO');

  // Generate & Download File
  const filePeriod = `${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}`;
  const fileName = `Laporan_Retail_${filePeriod}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
