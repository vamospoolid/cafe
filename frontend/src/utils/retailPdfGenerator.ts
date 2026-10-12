import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────────────────────────
interface RetailStoreSettings {
  storeName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (val: number | undefined | null): string =>
  `Rp ${(val || 0).toLocaleString('id-ID')}`;

const fmtDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getImageDataUrl = (url: string): Promise<string> => {
  if (!url) return Promise.resolve('');
  if (url.startsWith('data:image')) return Promise.resolve(url);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL('image/png')); } catch { resolve(''); }
      } else { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
};

// ─── Shared Header Builder ────────────────────────────────────────────────────
const buildHeader = (
  doc: jsPDF,
  settings: RetailStoreSettings,
  logoBase64: string,
  title: string,
  startDate: string,
  endDate: string,
  userName: string,
  pageW: number,
  M: number
) => {
  let textX = M;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', M, 11, 14, 14);
    textX = M + 18;
  } else {
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(M, 12, 4, 18, 'F');
    textX = M + 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.storeName || 'TOKO RETAIL & GROSIR', textX, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  if (settings.address) doc.text(settings.address, textX, 22);
  if (settings.phone) doc.text(`WhatsApp / Telp: ${settings.phone}`, textX, 26.5);

  const docRef = `DOC/RTL/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.abs((title + startDate).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString().slice(0, 4)}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`No. Dokumen: ${docRef}`, pageW - M, 13, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(79, 70, 229);
  doc.text(title, pageW - M, 17.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${fmtDate(startDate)} s/d ${fmtDate(endDate)}`, pageW - M, 22, { align: 'right' });
  doc.text(`Dicetak Oleh: ${userName}`, pageW - M, 26, { align: 'right' });
  doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageW - M, 30, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(M, 33, pageW - M, 33);
};

// ─── Shared Footer Builder ────────────────────────────────────────────────────
const buildFooter = (
  doc: jsPDF,
  settings: RetailStoreSettings,
  pageNum: number,
  totalPages: number,
  pageW: number,
  pageH: number,
  M: number
) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setDrawColor(241, 245, 249);
  doc.line(M, pageH - 12, pageW - M, pageH - 12);
  doc.text(
    `${settings.storeName || 'Toko Retail'} — Dokumen resmi dicetak oleh Sistem CodePOS. Zero Cross-Tenant Leakage Guaranteed.`,
    M, pageH - 8
  );
  doc.text(`Halaman ${pageNum} dari ${totalPages}`, pageW - M, pageH - 8, { align: 'right' });
};

// ─── Signature Block Builder ─────────────────────────────────────────────────
const buildSignature = (
  doc: jsPDF,
  startY: number,
  userName: string,
  pageW: number,
  pageH: number,
  M: number
) => {
  let y = startY + 14;
  if (y + 35 > pageH - 15) { doc.addPage(); y = 45; }
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');

  doc.text('Dibuat Oleh,', M + 10, y);
  doc.text('Kasir / Admin Toko', M + 10, y + 4);
  doc.setDrawColor(203, 213, 225);
  doc.line(M + 10, y + 22, M + 65, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.text(userName, M + 10, y + 26);

  doc.setFont('helvetica', 'normal');
  doc.text('Diketahui Oleh,', pageW - M - 65, y);
  doc.text('Owner / Manajer Toko', pageW - M - 65, y + 4);
  doc.line(pageW - M - 65, y + 22, pageW - M - 10, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.text('Owner / Manajer', pageW - M - 65, y + 26);
};

// ─── Section Header Helper ────────────────────────────────────────────────────
const sectionHeader = (doc: jsPDF, text: string, curY: number, pageW: number, M: number): number => {
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(M, curY, pageW - M * 2, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 48, 163);
  doc.text(text, M + 4, curY + 6);
  return curY + 13;
};

// ─── Page Break Guard ─────────────────────────────────────────────────────────
const ensureSpace = (
  doc: jsPDF,
  curY: number,
  needed: number,
  pageH: number,
  settings: RetailStoreSettings,
  logoBase64: string,
  title: string,
  startDate: string,
  endDate: string,
  userName: string,
  pageW: number,
  M: number
): number => {
  if (curY + needed > pageH - 20) {
    doc.addPage();
    buildHeader(doc, settings, logoBase64, title, startDate, endDate, userName, pageW, M);
    return 38;
  }
  return curY;
};

// ─── Main Export Function ──────────────────────────────────────────────────────
export const exportRetailReportPDF = async (
  settings: RetailStoreSettings,
  reportData: any,
  startDate: string,
  endDate: string,
  userName: string = 'Admin Toko'
): Promise<void> => {
  let logoBase64 = '';
  if (settings.logoUrl) {
    try { logoBase64 = await getImageDataUrl(settings.logoUrl); } catch { /* skip */ }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 14;
  const TITLE = 'LAPORAN STRATEGIS TOKO RETAIL & GROSIR';

  // Data extraction
  const summary = reportData?.summary || {};
  const tierSales: any[] = reportData?.tierSales || [];
  const velocity = reportData?.stockVelocity || { fastMoving: [], slowMoving: [] };
  const arAgeing = reportData?.arAgeing || { totalAR: 0, currentAR: 0, ageing30to60: 0, ageingOver60: 0, debts: [] };
  const deliverySummary = reportData?.deliverySummary || { total: 0, pending: 0, inTransit: 0, delivered: 0 };
  const shiftData = reportData?.shiftSummary || { totalShifts: 0, totalCashIn: 0, totalCashOut: 0, netCash: 0, shifts: [] };

  // Page 1 header
  buildHeader(doc, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  let curY = 38;

  // ── I. RINGKASAN EKSEKUTIF ──────────────────────────────────────────────────
  curY = sectionHeader(doc, 'I. RINGKASAN EKSEKUTIF KINERJA FINANSIAL', curY, pageW, M);

  const kpiBoxes = [
    { label: 'Total Omzet Penjualan', value: fmt(summary.totalSales), sub: `${summary.totalOrders || 0} Transaksi`, r: 79, g: 70, b: 229 },
    { label: 'Laba Kotor (Gross Profit)', value: fmt(summary.grossProfit), sub: `Margin: ${summary.marginPercentage || 0}%`, r: 5, g: 150, b: 105 },
    { label: 'Piutang Bon Tempo Aktif', value: fmt(summary.totalAR), sub: `${arAgeing.debts?.length || 0} Faktur belum lunas`, r: 217, g: 119, b: 6 },
    { label: 'Pengiriman Armada', value: `${deliverySummary.total} DO`, sub: `${deliverySummary.delivered} Terkirim`, r: 37, g: 99, b: 235 },
  ];

  const boxW = (pageW - M * 2 - 9) / 4;
  kpiBoxes.forEach((box, i) => {
    const bx = M + i * (boxW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(bx, curY, boxW, 22, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(box.r, box.g, box.b);
    const lines = doc.splitTextToSize(box.label.toUpperCase(), boxW - 4);
    doc.text(lines, bx + 3, curY + 5.5);
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, bx + 3, curY + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.sub, bx + 3, curY + 18.5);
  });
  curY += 28;

  // ── II. TIERED SALES ──────────────────────────────────────────────────────
  curY = ensureSpace(doc, curY, 60, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  curY = sectionHeader(doc, 'II. BREAKDOWN PENJUALAN PER LEVEL HARGA (PRICE TIER)', curY, pageW, M);

  autoTable(doc, {
    startY: curY,
    head: [['Level Harga', 'Jumlah Transaksi', 'Total Penjualan', 'Estimasi HPP', 'Laba Kotor', 'Margin (%)']],
    body: tierSales.length > 0
      ? tierSales.map(t => [
          t.tier === 'UMUM' ? 'Eceran (Umum)' : t.tier === 'MITRA' ? 'Mitra / Warung' : 'Grosir / Partai',
          `${t.count} Transaksi`,
          fmt(t.sales),
          fmt(t.cost),
          fmt(t.profit),
          `${t.margin}%`
        ])
      : [['Belum ada data penjualan pada periode ini.', '', '', '', '', '']],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: M, right: M },
  });
  curY = (doc as any).lastAutoTable.finalY + 6;

  // ── II.B KANAL PEMBAYARAN ─────────────────────────────────────────────────
  const paymentMethods: any[] = reportData?.paymentMethods || [];
  if (paymentMethods.length > 0) {
    curY = ensureSpace(doc, curY, 40, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text('▲ REKAPITULASI KANAL PEMBAYARAN KASIR (TUNAI / QRIS / TRANSFER / BON)', M, curY + 4);
    autoTable(doc, {
      startY: curY + 6,
      head: [['Metode Pembayaran', 'Frekuensi Transaksi', 'Total Nominal', 'Porsi Omzet (%)']],
      body: paymentMethods.map(pm => [
        pm.method === 'BON' ? 'Bon Tempo / Piutang' : pm.method === 'TRANSFER' ? 'Transfer Bank' : pm.method,
        `${pm.count} Transaksi`,
        fmt(pm.total),
        `${pm.percentage}%`
      ]),
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: M, right: M },
    });
    curY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── III. FAST & SLOW MOVING ──────────────────────────────────────────────
  curY = ensureSpace(doc, curY, 80, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  curY = sectionHeader(doc, 'III. ANALISIS PERPUTARAN STOK (FAST & SLOW MOVING)', curY, pageW, M);

  const fastMoving: any[] = velocity.fastMoving || [];
  const slowMoving: any[] = velocity.slowMoving || [];
  const colW = (pageW - M * 2 - 5) / 2;
  const tableStartY = curY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text('▲ PRODUK TERLARIS (FAST MOVING — Top 10)', M, curY + 5);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Nama Produk', 'Terjual', 'Total Penjualan']],
    body: fastMoving.length > 0
      ? fastMoving.slice(0, 10).map((p, i) => [`${i + 1}`, p.name, `${p.qtySold} unit`, fmt(p.totalSales)])
      : [['—', 'Belum ada data', '—', '—']],
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 8 }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: M, right: M + colW + 3 },
  });
  const fastFinalY = (doc as any).lastAutoTable.finalY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(217, 119, 6);
  doc.text('▼ STOK LAMBAT (SLOW MOVING — Perlu Perhatian)', M + colW + 5, curY + 5);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Nama Produk', 'Terjual', 'Total Penjualan']],
    body: slowMoving.length > 0
      ? slowMoving.slice(0, 10).map((p, i) => [`${i + 1}`, p.name, `${p.qtySold} unit`, fmt(p.totalSales)])
      : [['—', 'Belum ada data slow moving', '—', '—']],
    headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 8 }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    margin: { left: M + colW + 5, right: M },
  });
  const slowFinalY = (doc as any).lastAutoTable.finalY;
  curY = Math.max(fastFinalY, slowFinalY) + 10;

  // ── IV. AR AGEING ─────────────────────────────────────────────────────────
  curY = ensureSpace(doc, curY, 70, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  curY = sectionHeader(doc, 'IV. BUKU PIUTANG PELANGGAN & BON TEMPO (AR AGEING)', curY, pageW, M);

  const ageingBoxes = [
    { label: 'Lancar (≤ 30 Hari)', value: fmt(arAgeing.currentAR), r: 5, g: 150, b: 105 },
    { label: 'Waspada (31–60 Hari)', value: fmt(arAgeing.ageing30to60), r: 217, g: 119, b: 6 },
    { label: 'Macet / Jatuh Tempo (> 60 Hari)', value: fmt(arAgeing.ageingOver60), r: 220, g: 38, b: 38 },
    { label: 'Total Piutang Aktif', value: fmt(arAgeing.totalAR), r: 79, g: 70, b: 229 },
  ];
  const abW = (pageW - M * 2 - 9) / 4;
  ageingBoxes.forEach((box, i) => {
    const bx = M + i * (abW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(bx, curY, abW, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(box.r, box.g, box.b);
    const lines = doc.splitTextToSize(box.label.toUpperCase(), abW - 4);
    doc.text(lines, bx + 3, curY + 5);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, bx + 3, curY + 14.5);
  });
  curY += 22;

  const arRows = (arAgeing.debts || []).map((d: any) => [
    d.customerName,
    d.customerPhone || '-',
    fmt(d.amount),
    fmt(d.remaining),
    `${d.ageDays} Hari`,
    d.ageDays <= 30 ? 'Lancar' : d.ageDays <= 60 ? 'Waspada' : 'MACET'
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Nama Toko / Pelanggan', 'No. HP', 'Nilai Bon Awal', 'Sisa Piutang', 'Umur Bon', 'Status Ageing']],
    body: arRows.length > 0 ? arRows : [['Tidak ada piutang bon tempo aktif.', '', '', '', '', '']],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: M, right: M },
  });
  curY = (doc as any).lastAutoTable.finalY + 10;

  // ── V. SURAT JALAN / DELIVERY ──────────────────────────────────────────────
  curY = ensureSpace(doc, curY, 50, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  curY = sectionHeader(doc, 'V. REKAPITULASI PENGIRIMAN ARMADA & SURAT JALAN (DO)', curY, pageW, M);

  const doBoxes = [
    { label: 'Total Surat Jalan (DO)', value: `${deliverySummary.total}`, r: 71, g: 85, b: 105 },
    { label: 'Menunggu Sopir (Pending)', value: `${deliverySummary.pending}`, r: 217, g: 119, b: 6 },
    { label: 'Dalam Perjalanan (In Transit)', value: `${deliverySummary.inTransit}`, r: 37, g: 99, b: 235 },
    { label: 'Terkirim / Selesai (Delivered)', value: `${deliverySummary.delivered}`, r: 5, g: 150, b: 105 },
  ];
  const doW = (pageW - M * 2 - 9) / 4;
  doBoxes.forEach((box, i) => {
    const bx = M + i * (doW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(bx, curY, doW, 22, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(box.r, box.g, box.b);
    const lines = doc.splitTextToSize(box.label.toUpperCase(), doW - 4);
    doc.text(lines, bx + 3, curY + 5);
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, bx + 3, curY + 17);
  });
  curY += 28;

  // ── VI. PROFIT & LOSS ─────────────────────────────────────────────────────
  curY = ensureSpace(doc, curY, 80, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  curY = sectionHeader(doc, 'VI. LAPORAN LABA RUGI BERSIH TOKO RETAIL (PROFIT & LOSS)', curY, pageW, M);

  const grossProfit = summary.grossProfit || 0;
  const totalOpex = shiftData.totalCashOut || 0;
  const netProfit = grossProfit - totalOpex;
  const marginPct = summary.marginPercentage || 0;
  const netMarginPct = summary.totalSales > 0
    ? Number(((netProfit / summary.totalSales) * 100).toFixed(1))
    : 0;

  autoTable(doc, {
    startY: curY,
    head: [['Keterangan (Pos P&L)', 'Nominal']],
    body: [
      ['I. PENDAPATAN USAHA (REVENUE)', ''],
      ['   Total Penjualan Kotor Toko', fmt(summary.totalSales)],
      ['', ''],
      ['II. HARGA POKOK PENJUALAN (HPP / COGS)', ''],
      ['   Modal Pembelian Barang (HPP)', `- ${fmt(summary.totalCost)}`],
      ['', ''],
      [`   LABA KOTOR USAHA (GROSS PROFIT — ${marginPct}%)`, fmt(grossProfit)],
      ['', ''],
      ['III. BEBAN KAS OPERASIONAL (OPEX)', ''],
      ['   Pengeluaran Kas Operasional Toko', `- ${fmt(totalOpex)}`],
      ['', ''],
      [`   ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT — ${netMarginPct}%)`, fmt(netProfit)],
    ],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: M, right: M },
  });
  curY = (doc as any).lastAutoTable.finalY + 10;

  // ── VII. REKAP KAS SHIFT ───────────────────────────────────────────────────
  curY = ensureSpace(doc, curY, 60, pageH, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
  curY = sectionHeader(doc, 'VII. REKAPITULASI KAS LACI & AUDIT SHIFT KASIR RETAIL', curY, pageW, M);

  autoTable(doc, {
    startY: curY,
    head: [['Kasir / Shift', 'Tanggal Shift', 'Kas Awal', 'Total Penjualan', 'Kas Keluar', 'Saldo Akhir', 'Status']],
    body: (shiftData.shifts || []).length > 0
      ? shiftData.shifts.map((s: any) => [
          s.staffName || s.cashierName || 'Kasir',
          s.date ? new Date(s.date).toLocaleDateString('id-ID') : '-',
          fmt(s.openingCash),
          fmt(s.totalSales),
          fmt(s.totalExpenses),
          fmt(s.closingCash),
          s.status === 'CLOSED' ? 'Ditutup' : 'Aktif'
        ])
      : [['Belum ada data shift pada periode ini.', '', '', '', '', '', '']],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: M, right: M },
  });
  curY = (doc as any).lastAutoTable.finalY + 12;

  // ── Signature Block ───────────────────────────────────────────────────────
  buildSignature(doc, curY, userName, pageW, pageH, M);

  // ── Apply headers & footers to ALL pages ─────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) buildHeader(doc, settings, logoBase64, TITLE, startDate, endDate, userName, pageW, M);
    buildFooter(doc, settings, p, totalPages, pageW, pageH, M);
  }

  // ── Save as named file ───────────────────────────────────────────────────
  const storeName = (settings.storeName || 'RETAIL').replace(/\s+/g, '_').toUpperCase();
  const fileName = `LAPORAN_RETAIL_${storeName}_${startDate}_sd_${endDate}.pdf`;
  const pdfBlob = doc.output('blob');
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
};

// ─── LEMBAR REKAPITULASI BON & TAGIHAN PELANGGAN / MANDOR ─────────────────────
export const exportCustomerStatementPDF = async (
  settings: RetailStoreSettings,
  statementData: any,
  userName: string = 'Kasir Toko'
): Promise<void> => {
  let logoBase64 = '';
  if (settings.logoUrl) {
    try { logoBase64 = await getImageDataUrl(settings.logoUrl); } catch { /* skip */ }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 14;
  const TITLE = 'LEMBAR REKAPITULASI BON & TAGIHAN PELANGGAN';

  const customer = statementData?.customer || {};
  const summary = statementData?.summary || {};
  const debts: any[] = statementData?.debts || [];
  const todayStr = new Date().toISOString().split('T')[0];

  buildHeader(doc, settings, logoBase64, TITLE, todayStr, todayStr, userName, pageW, M);
  let curY = 38;

  // Box Informasi Pelanggan / Mitra
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(M, curY, pageW - M * 2, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text('INFORMASI MITRA / PELANGGAN PENERIMA TAGIHAN:', M + 4, curY + 5.5);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(customer.name || 'Pelanggan Langganan', M + 4, curY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`No. Telp / WA : ${customer.phone || '-'}`, M + 4, curY + 16.5);
  doc.text(`Alamat Proyek / Toko : ${customer.address || '-'}`, M + 4, curY + 20);

  // Status Plafon & Kategori (Sisi Kanan Box)
  const rightX = pageW - M - 75;
  doc.text(`Level Harga : ${customer.priceTier || 'UMUM'}`, rightX, curY + 11.5);
  doc.text(`Plafon Kredit : ${customer.creditLimit ? fmt(customer.creditLimit) : 'Tanpa Limit'}`, rightX, curY + 16.5);
  doc.text(`Tempo Bon : ${customer.creditTermDays || 14} Hari`, rightX, curY + 20);

  curY += 26;

  // KPI Boxes: Total Tagihan, Terbayar, Sisa Wajib Bayar
  const kpis = [
    { label: 'Total Bon Akumulatif', value: fmt(summary.totalBilled), sub: `${debts.length} Nota Faktur`, r: 71, g: 85, b: 105 },
    { label: 'Sudah Dibayar (Cicilan)', value: fmt(summary.totalPaid), sub: 'Pelunasan Masuk', r: 5, g: 150, b: 105 },
    { label: 'Sisa Tagihan Wajib Bayar', value: fmt(summary.totalRemaining), sub: 'Saldo Hutang Aktif', r: 220, g: 38, b: 38 },
    { label: 'Nota Lewat Jatuh Tempo', value: `${summary.overdueCount || 0} Faktur`, sub: (summary.overdueCount || 0) > 0 ? 'Perlu Segera Ditagih' : 'Status Lancar', r: 217, g: 119, b: 6 },
  ];

  const boxW = (pageW - M * 2 - 9) / 4;
  kpis.forEach((box, i) => {
    const bx = M + i * (boxW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(bx, curY, boxW, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(box.r, box.g, box.b);
    doc.text(box.label.toUpperCase(), bx + 3, curY + 5);
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, bx + 3, curY + 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.sub, bx + 3, curY + 17);
  });

  curY += 25;

  // Tabel Rincian Bon & Barang
  curY = sectionHeader(doc, 'RINCIAN NOTA BON & BARANG YANG DIAMBIL', curY, pageW, M);

  const tableBody = debts.map((d: any, idx: number) => {
    const itemsSummary = (d.items || []).map((it: any) => `${it.qty} ${it.uomName} ${it.productName}`).join(', ');
    const dateStr = d.date ? new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
    const dueStr = d.dueDate ? new Date(d.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
    return [
      `${idx + 1}`,
      `${d.invoiceNumber}\n(${dateStr})`,
      itemsSummary || d.notes || 'Barang Toko',
      dueStr,
      fmt(d.amount),
      fmt(d.paid),
      fmt(d.remaining),
      d.status === 'Lunas' ? 'Lunas' : d.isOverdue ? 'JATUH TEMPO' : 'Belum Lunas'
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['#', 'No. Faktur / Tgl', 'Rincian Barang Diambil', 'Jatuh Tempo', 'Nilai Bon', 'Dibayar', 'Sisa Tagihan', 'Status']],
    body: tableBody.length > 0 ? tableBody : [['—', 'Tidak ada data tagihan bon.', '', '', '', '', '', '']],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: M, right: M }
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // Box Informasi Pembayaran & No Rekening
  curY = ensureSpace(doc, curY, 45, pageH, settings, logoBase64, TITLE, todayStr, todayStr, userName, pageW, M);
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(M, curY, pageW - M * 2, 12, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  doc.text('CATATAN PEMBAYARAN & REKENING TOKO:', M + 4, curY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Mohon pelunasan dapat ditransfer ke Rekening Resmi Toko atau diserahkan langsung kepada Kasir dengan bukti tanda terima.', M + 4, curY + 8.5);

  curY += 18;

  // Kotak 3 Tanda Tangan: Pelanggan, Kasir, Owner
  if (curY + 35 > pageH - 15) { doc.addPage(); curY = 40; }
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');

  doc.text('Penerima Tagihan (Mandor / Pelanggan),', M + 5, curY);
  doc.setDrawColor(203, 213, 225);
  doc.line(M + 5, curY + 20, M + 55, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.name || 'Penerima', M + 5, curY + 24);

  const midX = pageW / 2 - 25;
  doc.setFont('helvetica', 'normal');
  doc.text('Petugas Kasir / Penagih,', midX, curY);
  doc.line(midX, curY + 20, midX + 50, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(userName, midX, curY + 24);

  const rX = pageW - M - 55;
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui Owner / Pengelola Toko,', rX, curY);
  doc.line(rX, curY + 20, rX + 50, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text('Owner Toko', rX, curY + 24);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) buildHeader(doc, settings, logoBase64, TITLE, todayStr, todayStr, userName, pageW, M);
    buildFooter(doc, settings, p, totalPages, pageW, pageH, M);
  }

  const custClean = (customer.name || 'PELANGGAN').replace(/\s+/g, '_').toUpperCase();
  const fileName = `TAGIHAN_BON_${custClean}_${todayStr}.pdf`;
  const pdfBlob = doc.output('blob');
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
};

// ─── LEMBAR AUDIT FISIK STOCK OPNAME & VALUASI PERSEDIAAN ─────────────────────
export const exportStockOpnamePDF = async (
  settings: RetailStoreSettings,
  opnameData: any,
  userName: string = 'Kepala Gudang'
): Promise<void> => {
  let logoBase64 = '';
  if (settings.logoUrl) {
    try { logoBase64 = await getImageDataUrl(settings.logoUrl); } catch { /* skip */ }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const M = 14;
  const TITLE = 'LEMBAR AUDIT FISIK STOCK OPNAME & VALUASI PERSEDIAAN';

  const summary = opnameData?.summary || {};
  const items: any[] = opnameData?.items || [];
  const todayStr = new Date().toISOString().split('T')[0];

  buildHeader(doc, settings, logoBase64, TITLE, todayStr, todayStr, userName, pageW, M);
  let curY = 38;

  // KPI Boxes
  const kpis = [
    { label: 'Total Item SKU', value: `${summary.totalSKU || items.length} SKU`, sub: 'Komoditas Terdaftar', r: 79, g: 70, b: 229 },
    { label: 'Total Stok Sistem', value: `${(summary.totalPieces || 0).toLocaleString('id-ID')} Pcs`, sub: 'Satuan Terkecil Base Unit', r: 5, g: 150, b: 105 },
    { label: 'Valuasi Modal Persediaan', value: fmt(summary.totalValuation), sub: 'Modal Aset Stok Fisik', r: 37, g: 99, b: 235 },
    { label: 'Peringatan Stok Menipis', value: `${summary.lowStockCount || 0} SKU`, sub: 'Perlu Segera Kulakan', r: 217, g: 119, b: 6 },
  ];

  const boxW = (pageW - M * 2 - 9) / 4;
  kpis.forEach((box, i) => {
    const bx = M + i * (boxW + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(bx, curY, boxW, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(box.r, box.g, box.b);
    doc.text(box.label.toUpperCase(), bx + 3, curY + 5);
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, bx + 3, curY + 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.sub, bx + 3, curY + 17);
  });

  curY += 25;

  curY = sectionHeader(doc, 'TABEL AUDIT FISIK RAK & GUDANG (DIISI OLEH PETUGAS OPNAME)', curY, pageW, M);

  const tableBody = items.map((it: any, idx: number) => {
    const uomStr = (it.uoms && it.uoms.length > 0) ? `\n[${it.uoms.join(', ')}]` : '';
    return [
      `${idx + 1}`,
      it.storageLocation || 'Rak Etalase',
      it.barcode || '-',
      `${it.name}${uomStr}`,
      it.baseUom || 'PCS',
      `${it.systemStock}`,
      '[      ]', // Kolom kosong isi fisik
      '[      ]', // Kolom selisih
      '[      ]'  // Kolom paraf
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['#', 'Lokasi / Rak', 'Barcode', 'Nama Barang & Kemasan UOM', 'Satuan', 'Stok Sistem', 'Fisik Nyata', 'Selisih (+/-)', 'Paraf']],
    body: tableBody.length > 0 ? tableBody : [['—', 'Tidak ada data produk.', '', '', '', '', '', '', '']],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 22, fontStyle: 'bold' },
      3: { cellWidth: 50 },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 17, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: M, right: M }
  });

  curY = (doc as any).lastAutoTable.finalY + 10;

  // Kotak Tanda Tangan
  curY = ensureSpace(doc, curY, 40, pageH, settings, logoBase64, TITLE, todayStr, todayStr, userName, pageW, M);
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');

  doc.text('Petugas Pelaksana Hitung Fisik,', M + 10, curY);
  doc.setDrawColor(203, 213, 225);
  doc.line(M + 10, curY + 20, M + 65, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(userName, M + 10, curY + 24);

  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui Kepala Toko / Owner,', pageW - M - 65, curY);
  doc.line(pageW - M - 65, curY + 20, pageW - M - 10, curY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text('Kepala Toko / Owner', pageW - M - 65, curY + 24);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) buildHeader(doc, settings, logoBase64, TITLE, todayStr, todayStr, userName, pageW, M);
    buildFooter(doc, settings, p, totalPages, pageW, pageH, M);
  }

  const storeClean = (settings.storeName || 'TOKO').replace(/\s+/g, '_').toUpperCase();
  const fileName = `STOCK_OPNAME_${storeClean}_${todayStr}.pdf`;
  const pdfBlob = doc.output('blob');
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
};

