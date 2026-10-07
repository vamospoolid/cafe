import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LaundryReportSettings {
  storeName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

export interface LaundryReportData {
  period: {
    type: string;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalOrders: number;
    totalKg: number;
    totalPcs: number;
    totalRevenue: number;
    totalSubtotal: number;
    totalSurcharge: number;
    totalDiscount: number;
    avgTicket: number;
    kiloanRevenue: number;
    satuanRevenue: number;
    kiloanPercentage: number;
    satuanPercentage: number;
    onTimeRate: number;
    totalExpense?: number;
    netOperatingProfit?: number;
    netProfitMargin?: number;
  };
  agingRack: {
    totalValueInRack: number;
    totalUnpaidInRack: number;
    rackOrdersCount: number;
    buckets: {
      days0_3: { count: number; amount: number; unpaidAmount: number };
      days4_7: { count: number; amount: number; unpaidAmount: number };
      days8_14: { count: number; amount: number; unpaidAmount: number };
      days15_30: { count: number; amount: number; unpaidAmount: number };
      daysOver30: { count: number; amount: number; unpaidAmount: number };
    };
    overdueOrders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      customerPhone?: string;
      rackLocation: string;
      daysInRack: number;
      readyAt?: string;
      totalAmount: number;
      paidAmount: number;
      unpaidAmount: number;
      paymentStatus: string;
    }>;
  };
  topServices: Array<{
    name: string;
    count: number;
    totalQty: number;
    revenue: number;
    unitType: string;
  }>;
  perfumePopularity: Array<{
    name: string;
    count: number;
  }>;
  chemicalEfficiency: {
    totalKgDicuci: number;
    estimatedDetergentNeededLiters: number;
    estimatedPerfumeNeededLiters: number;
    currentStock: Array<{
      id: string | number;
      name: string;
      stock: number;
      unit: string;
      costPerUnit?: number;
      buyPrice?: number;
    }>;
  };
  atRiskCustomers?: Array<{
    customerName: string;
    customerPhone?: string;
    lastOrderDate: string;
    totalSpend: number;
    orderCount: number;
  }>;
  expenses?: {
    totalExpense: number;
    categories: Array<{ category: string; amount: number }>;
  };
  speedBreakdown?: {
    REGULAR: { count: number; revenue: number; surcharge: number };
    KILAT_24H: { count: number; revenue: number; surcharge: number };
    EXPRESS_6H: { count: number; revenue: number; surcharge: number };
  };
  paymentMethods?: Array<{
    method: string;
    count: number;
    total: number;
  }>;
  pipelineStatus?: Record<string, number>;
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

const formatCurrency = (val: number | undefined | null): string => {
  return `Rp ${(val || 0).toLocaleString('id-ID')}`;
};

const formatDateID = (dateStr: string): string => {
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
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve('');
        }
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
};

// ─── Main PDF Generator ───────────────────────────────────────────────────────

/**
 * Ekspor Dokumen Resmi Laporan Operasional, Finansial & Tonase Laundry (A4 Portrait)
 */
export const exportLaundryReportPDF = async (
  settings: LaundryReportSettings,
  reportData: LaundryReportData,
  startDate: string,
  endDate: string,
  userName?: string
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  let logoBase64 = '';
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
    } catch (_) {}
  }

  const storeName = settings?.storeName || 'FRESHCLEAN LAUNDRY & CARE';
  const address = settings?.address || 'Jl. Raya Bersih Wangi No. 12';
  const phone = settings?.phone ? `WhatsApp Hotline: ${settings.phone}` : 'WhatsApp Hotline: 0812-3456-7890';
  const docNumber = `DOC/LND/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(1000 + Math.random() * 9000)}`;

  // Header Builder
  const addHeader = (pageNumber: number) => {
    let textXOffset = margin;

    // Logo / Brand Icon
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, 10, 16, 16);
        textXOffset = margin + 20;
      } catch (_) {
        doc.setFillColor(8, 145, 178); // cyan-600
        doc.roundedRect(margin, 11, 6, 16, 1, 1, 'F');
        textXOffset = margin + 10;
      }
    } else {
      doc.setFillColor(8, 145, 178); // cyan-600
      doc.roundedRect(margin, 11, 6, 16, 1, 1, 'F');
      textXOffset = margin + 10;
    }

    // Left info (Store Brand)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(storeName.toUpperCase(), textXOffset, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(address, textXOffset, 21);
    doc.text(phone, textXOffset, 25);

    // Right info (Document Meta)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(8, 145, 178); // cyan-600
    doc.text('LAPORAN OPERASIONAL & KEUANGAN LAUNDRY', pageWidth - margin, 15.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`No. Registrasi: ${docNumber}`, pageWidth - margin, 20, { align: 'right' });
    doc.text(
      `Periode: ${startDate ? formatDateID(startDate) : 'Awal'} s/d ${endDate ? formatDateID(endDate) : 'Sekarang'}`,
      pageWidth - margin,
      24,
      { align: 'right' }
    );
    doc.text(
      `Dicetak Oleh: ${userName || 'Administrator'} • ${new Date().toLocaleString('id-ID')}`,
      pageWidth - margin,
      28,
      { align: 'right' }
    );

    // Top Header Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, 31, pageWidth - margin, 31);
  };

  // Section Header Helper
  const renderSectionHeader = (title: string, yPos: number): number => {
    doc.setFillColor(236, 254, 255); // cyan-50
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 8, 1.5, 1.5, 'F');

    doc.setFillColor(8, 145, 178); // cyan-600 indicator bar
    doc.rect(margin, yPos, 2.5, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(14, 116, 144); // cyan-700
    doc.text(title, margin + 5, yPos + 5.5);

    return yPos + 12;
  };

  // Page Break Guard
  const ensureSpace = (requiredMm: number, curY: number): number => {
    if (curY + requiredMm > pageHeight - 20) {
      doc.addPage();
      addHeader(doc.getNumberOfPages());
      return 36;
    }
    return curY;
  };

  // Initialize Page 1
  addHeader(1);
  let currentY = 36;

  const summary = reportData?.summary || {
    totalOrders: 0,
    totalKg: 0,
    totalPcs: 0,
    totalRevenue: 0,
    totalSubtotal: 0,
    totalSurcharge: 0,
    totalDiscount: 0,
    avgTicket: 0,
    kiloanRevenue: 0,
    satuanRevenue: 0,
    kiloanPercentage: 0,
    satuanPercentage: 0,
    onTimeRate: 100,
    totalExpense: 0,
    netOperatingProfit: 0,
    netProfitMargin: 0
  };

  const agingRack = reportData?.agingRack || {
    totalValueInRack: 0,
    totalUnpaidInRack: 0,
    rackOrdersCount: 0,
    buckets: {
      days0_3: { count: 0, amount: 0, unpaidAmount: 0 },
      days4_7: { count: 0, amount: 0, unpaidAmount: 0 },
      days8_14: { count: 0, amount: 0, unpaidAmount: 0 },
      days15_30: { count: 0, amount: 0, unpaidAmount: 0 },
      daysOver30: { count: 0, amount: 0, unpaidAmount: 0 }
    },
    overdueOrders: []
  };

  const topServices = reportData?.topServices || [];
  const perfumePopularity = reportData?.perfumePopularity || [];
  const chemicalEfficiency = reportData?.chemicalEfficiency || {
    totalKgDicuci: summary.totalKg || 0,
    estimatedDetergentNeededLiters: 0,
    estimatedPerfumeNeededLiters: 0,
    currentStock: []
  };

  // ─── EXECUTIVE KPI BENTO CARDS (5 METRICS ROW) ──────────────────────────────
  const cardW = (pageWidth - margin * 2 - 12) / 4; // 4 cards layout or 5
  const cardH = 18;

  // Row 1: 4 Main Cards
  const kpiCards = [
    {
      title: 'TOTAL OMZET BERSIH',
      val: formatCurrency(summary.totalRevenue),
      sub: `${summary.totalOrders} Nota Cucian Terbit`,
      bg: [240, 253, 250] as [number, number, number], // teal-50
      border: [204, 251, 241] as [number, number, number],
      text: [13, 148, 136] as [number, number, number] // teal-600
    },
    {
      title: 'TONASE KILOAN (KG)',
      val: `${summary.totalKg.toLocaleString('id-ID')} Kg`,
      sub: `${summary.kiloanPercentage}% dari Omzet Total`,
      bg: [236, 254, 255] as [number, number, number], // cyan-50
      border: [207, 250, 254] as [number, number, number],
      text: [8, 145, 178] as [number, number, number] // cyan-600
    },
    {
      title: 'CUCI SATUAN SPESIAL',
      val: `${summary.totalPcs.toLocaleString('id-ID')} Pcs`,
      sub: `${summary.satuanPercentage}% Kontribusi Satuan`,
      bg: [238, 242, 255] as [number, number, number], // indigo-50
      border: [224, 231, 255] as [number, number, number],
      text: [79, 70, 229] as [number, number, number] // indigo-600
    },
    {
      title: 'DISIPLIN SLA ON-TIME',
      val: `${summary.onTimeRate}%`,
      sub: summary.onTimeRate >= 90 ? 'Memenuhi Standar Mutu' : 'Perlu Evaluasi Antrian',
      bg: summary.onTimeRate >= 90 ? ([240, 253, 244] as [number, number, number]) : ([254, 242, 242] as [number, number, number]),
      border: summary.onTimeRate >= 90 ? ([220, 252, 231] as [number, number, number]) : ([254, 226, 226] as [number, number, number]),
      text: summary.onTimeRate >= 90 ? ([22, 163, 74] as [number, number, number]) : ([220, 38, 38] as [number, number, number])
    }
  ];

  kpiCards.forEach((c, idx) => {
    const x = margin + idx * (cardW + 4);
    doc.setFillColor(...c.bg);
    doc.setDrawColor(...c.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.title, x + 3.5, currentY + 4.5);

    doc.setFontSize(10.5);
    doc.setTextColor(...c.text);
    doc.text(c.val, x + 3.5, currentY + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(c.sub, x + 3.5, currentY + 15);
  });

  currentY += cardH + 4;

  // Piutang Rak Warning Strip (Lebar penuh)
  const rackStripH = 10;
  const isHighRisk = agingRack.totalUnpaidInRack > 0;
  doc.setFillColor(isHighRisk ? 255 : 248, isHighRisk ? 241 : 250, isHighRisk ? 242 : 252);
  doc.setDrawColor(isHighRisk ? 254 : 226, isHighRisk ? 205 : 232, isHighRisk ? 211 : 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, rackStripH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isHighRisk ? 190 : 71, isHighRisk ? 18 : 85, isHighRisk ? 60 : 105);
  doc.text(
    `AUDIT RAK SIMPAN: ${agingRack.rackOrdersCount} Nota Selesai di Rak • Total Nilai Cucian: ${formatCurrency(agingRack.totalValueInRack)} • PIUTANG BELUM LUNAS TERTINGGAL: ${formatCurrency(agingRack.totalUnpaidInRack)}`,
    margin + 4,
    currentY + 6.2
  );

  currentY += rackStripH + 6;

  // ─── 1. LAPORAN LABA RUGI OPERASIONAL LAUNDRY (P&L) ────────────────────────
  currentY = renderSectionHeader('1. LAPORAN LABA RUGI & ARUS KAS OPERASIONAL (P&L LAUNDRY)', currentY);

  const totalExpense = reportData.expenses?.totalExpense || summary.totalExpense || 0;
  const netProfit = (summary.totalRevenue || 0) - totalExpense;
  const netMarginPct = summary.totalRevenue > 0 ? Math.round((netProfit / summary.totalRevenue) * 100) : 0;

  const plTableData = [
    ['I. PENDAPATAN USAHA CUCIAN (REVENUE)', '', ''],
    ['   • Pendapatan Cuci Kiloan (Timbangan Kg)', formatCurrency(summary.kiloanRevenue), `${summary.totalKg.toLocaleString('id-ID')} Kg dicuci`],
    ['   • Pendapatan Cuci Satuan Khusus (Pcs/Meter)', formatCurrency(summary.satuanRevenue), `${summary.totalPcs.toLocaleString('id-ID')} Pcs treatment`],
    ['   • Surcharge Layanan Cepat (Kilat & Express 6H)', formatCurrency(summary.totalSurcharge), 'Premi kecepatan SLA'],
    ['   • Potongan Diskon Promosi / Kupon Pelanggan', `-${formatCurrency(summary.totalDiscount)}`, 'Diskon & voucher loyalty'],
    ['   TOTAL PENDAPATAN BERSIH CUCIAN (NET REVENUE)', formatCurrency(summary.totalRevenue), `${summary.totalOrders} Nota Transaksi Selesai`],
    ['II. BEBAN OPERASIONAL KAS KECIL (PETTY CASH OPEX)', '', '']
  ];

  if (reportData.expenses?.categories && reportData.expenses.categories.length > 0) {
    reportData.expenses.categories.forEach((cat) => {
      plTableData.push([`   • ${cat.category}`, formatCurrency(cat.amount), 'Kas operasional']);
    });
  } else {
    plTableData.push(['   • Pembelian Deterjen, Softener & Parfum Laundry', formatCurrency(totalExpense > 0 ? totalExpense * 0.45 : 0), 'Bahan kimia operasional']);
    plTableData.push(['   • Gas LPG Mesin Pengering & Listrik PLN', formatCurrency(totalExpense > 0 ? totalExpense * 0.35 : 0), 'Energi & utilitas']);
    plTableData.push(['   • Kemasan Plastik, Hanger & Lakban', formatCurrency(totalExpense > 0 ? totalExpense * 0.20 : 0), 'Bahan packing']);
  }

  plTableData.push(['   TOTAL BEBAN OPERASIONAL LAUNDRY', formatCurrency(totalExpense), 'Pengeluaran kas tercatat']);
  plTableData.push(['III. ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT)', formatCurrency(netProfit), `${netMarginPct}% Net Operating Margin`]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: plTableData,
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 116, 139] }
    },
    didParseCell: (cellData) => {
      const rowIndex = cellData.row.index;
      // Section header rows
      if (rowIndex === 0 || rowIndex === 6) {
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.fillColor = [241, 245, 249];
        cellData.cell.styles.textColor = [30, 41, 59];
      }
      // Grand totals
      if (rowIndex === 5) {
        cellData.cell.styles.fillColor = [240, 253, 250];
        cellData.cell.styles.textColor = [15, 118, 110];
        cellData.cell.styles.fontStyle = 'bold';
      }
      const rawRow = cellData.row.raw as any;
      const firstCol = rawRow && rawRow[0] ? String(rawRow[0]) : '';
      if (firstCol.includes('TOTAL BEBAN OPERASIONAL')) {
        cellData.cell.styles.fillColor = [254, 242, 242];
        cellData.cell.styles.textColor = [185, 28, 28];
        cellData.cell.styles.fontStyle = 'bold';
      }
      if (firstCol.includes('ESTIMASI LABA BERSIH')) {
        cellData.cell.styles.fillColor = [236, 254, 255];
        cellData.cell.styles.textColor = [14, 116, 144];
        cellData.cell.styles.fontStyle = 'bold';
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ─── 2. MONITORING KECEPATAN (SLA) & KANAL PEMBAYARAN ───────────────────────
  currentY = ensureSpace(45, currentY);
  currentY = renderSectionHeader('2. DISTRIBUSI KECEPATAN LAYANAN & METODE PEMBAYARAN', currentY);

  const speedData = reportData.speedBreakdown || {
    REGULAR: { count: summary.totalOrders, revenue: summary.totalRevenue, surcharge: 0 },
    KILAT_24H: { count: 0, revenue: 0, surcharge: 0 },
    EXPRESS_6H: { count: 0, revenue: 0, surcharge: 0 }
  };

  const speedRows = [
    ['Reguler (Standar 2 Hari)', `${speedData.REGULAR.count} Nota`, formatCurrency(speedData.REGULAR.revenue), formatCurrency(speedData.REGULAR.surcharge), 'SLA Standar'],
    ['Kilat (Selesai 24 Jam)', `${speedData.KILAT_24H.count} Nota`, formatCurrency(speedData.KILAT_24H.revenue), formatCurrency(speedData.KILAT_24H.surcharge), '+Surcharge 24H'],
    ['Express (Selesai 6 Jam)', `${speedData.EXPRESS_6H.count} Nota`, formatCurrency(speedData.EXPRESS_6H.revenue), formatCurrency(speedData.EXPRESS_6H.surcharge), '+Surcharge VIP']
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Tier Kecepatan SLA', 'Volume Nota', 'Nilai Transaksi', 'Surcharge Kilat', 'Keterangan']],
    body: speedRows,
    headStyles: {
      fillColor: [8, 145, 178], // cyan-600
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 30, halign: 'right', textColor: [180, 83, 9] },
      4: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 116, 139] }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ─── 3. AUDIT AGING RAK SIMPAN & RISIKO PIUTANG TERTINGGAL ──────────────────
  currentY = ensureSpace(60, currentY);
  currentY = renderSectionHeader('3. MONITORING AGING RAK SIMPAN & RISIKO PIUTANG TERTAHAN (DEAD STORAGE)', currentY);

  const b = agingRack.buckets;
  const agingBucketRows = [
    ['0 - 3 Hari (Fresh)', `${b.days0_3.count} Nota`, formatCurrency(b.days0_3.amount), formatCurrency(b.days0_3.unpaidAmount), 'Normal - Masa toleransi ambil'],
    ['4 - 7 Hari (Perhatian)', `${b.days4_7.count} Nota`, formatCurrency(b.days4_7.amount), formatCurrency(b.days4_7.unpaidAmount), 'Kirim Pengingat WhatsApp #1'],
    ['8 - 14 Hari (Menumpuk)', `${b.days8_14.count} Nota`, formatCurrency(b.days8_14.amount), formatCurrency(b.days8_14.unpaidAmount), 'Kirim Notifikasi Teguran #2'],
    ['15 - 30 Hari (Kritis)', `${b.days15_30.count} Nota`, formatCurrency(b.days15_30.amount), formatCurrency(b.days15_30.unpaidAmount), 'Risiko bau apek & penuhi rak'],
    ['> 30 Hari (Macet/Terlantar)', `${b.daysOver30.count} Nota`, formatCurrency(b.daysOver30.amount), formatCurrency(b.daysOver30.unpaidAmount), 'Terapkan klausul pemutihan']
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Kelompok Umur Rak', 'Jumlah Nota', 'Total Nilai Cucian', 'Sisa Tagihan Belum Bayar', 'Status Tindakan Kasir']],
    body: agingBucketRows,
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 42, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      4: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 116, 139] }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Daftar Nota Cucian Terlantar di Rak (> 3 Hari)
  if (agingRack.overdueOrders && agingRack.overdueOrders.length > 0) {
    currentY = ensureSpace(45, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text('DAFTAR NOTA CUCIAN TERLANTAR DI RAK (> 3 HARI) — WAJIB DITAGIH:', margin, currentY);
    currentY += 3;

    const overdueTableRows = agingRack.overdueOrders.slice(0, 12).map((o, idx) => [
      idx + 1,
      o.orderNumber,
      o.customerName,
      o.rackLocation || 'Rak',
      `${o.daysInRack} Hari`,
      formatCurrency(o.totalAmount),
      formatCurrency(o.unpaidAmount),
      o.paymentStatus === 'PAID' ? 'LUNAS' : 'BELUM BAYAR'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['No', 'No. Nota', 'Nama Pelanggan', 'Lokasi Rak', 'Umur Rak', 'Total Nota', 'Tagihan Unpaid', 'Status']],
      body: overdueTableRows,
      headStyles: {
        fillColor: [225, 29, 72], // rose-600
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { fontSize: 7, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 40 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 20, halign: 'center', textColor: [180, 83, 9], fontStyle: 'bold' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
        7: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── 4. EVALUASI LAYANAN TERLARIS & PILIHAN AROMA PARFUM ────────────────────
  currentY = ensureSpace(55, currentY);
  currentY = renderSectionHeader('4. EVALUASI LAYANAN TERLARIS & PREFERENSI AROMA PARFUM', currentY);

  const topServiceRows = topServices.slice(0, 7).map((s, idx) => [
    idx + 1,
    s.name,
    s.unitType === 'KG' ? 'Kiloan (Kg)' : 'Satuan (Pcs)',
    `${s.totalQty.toLocaleString('id-ID')} ${s.unitType}`,
    formatCurrency(s.revenue),
    summary.totalRevenue > 0 ? `${Math.round((s.revenue / summary.totalRevenue) * 100)}%` : '0%'
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['No', 'Nama Layanan Laundry', 'Kategori', 'Volume Terjual', 'Total Omzet', 'Kontribusi']],
    body: topServiceRows.length > 0 ? topServiceRows : [['-', 'Belum ada data layanan pada periode ini', '-', '-', '-', '-']],
    headStyles: {
      fillColor: [14, 116, 144], // cyan-700
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 65, fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 'auto', halign: 'center', textColor: [8, 145, 178], fontStyle: 'bold' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Preferensi Aroma Parfum
  if (perfumePopularity.length > 0) {
    currentY = ensureSpace(25, currentY);
    const perfumeText = perfumePopularity
      .slice(0, 5)
      .map((p, idx) => `#${idx + 1} ${p.name} (${p.count} nota)`)
      .join('   •   ');

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('Varian Parfum Terfavorit Pelanggan:', margin + 3, currentY + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(8, 145, 178);
    doc.text(perfumeText, margin + 48, currentY + 4.8);

    currentY += 12;
  }

  // ─── 5. EFISIENSI BAHAN KIMIA & MONITORING STOK OPERASIONAL ─────────────────
  currentY = ensureSpace(50, currentY);
  currentY = renderSectionHeader('5. EFISIENSI CHEMICAL & MONITORING STOK BAHAN BAKU OPERASIONAL', currentY);

  const chemRows = [
    [
      'Deterjen Cair Utama',
      `${summary.totalKg} Kg Dicuci`,
      '25 ml / Kg',
      `${chemicalEfficiency.estimatedDetergentNeededLiters} Liter`,
      'Dosis standar mesin front load'
    ],
    [
      'Pewangi & Pelicin Setrika',
      `${summary.totalKg} Kg Dicuci`,
      '15 ml / Kg',
      `${chemicalEfficiency.estimatedPerfumeNeededLiters} Liter`,
      'Aroma disemprot saat finishing'
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Bahan Baku Kritis', 'Basis Cucian', 'Standar Dosis (SOP)', 'Estimasi Kebutuhan', 'Keterangan SOP']],
    body: chemRows,
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 34, halign: 'center', fontStyle: 'bold', textColor: [8, 145, 178] },
      4: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 116, 139] }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ─── 6. KEBIJAKAN OPERASIONAL & LEMBAR PENGESAHAN RESMI ─────────────────────
  currentY = ensureSpace(50, currentY);

  // Box S&K Standar Mutu Laundry
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 17, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text('KETENTUAN OPERASIONAL & STANDAR PENJAMINAN MUTU LAUNDRY:', margin + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    '1. Komplain cucian diterima maksimal 1x24 jam sejak pengambilan dengan menyertakan nota resmi dan pita tag utuh.',
    margin + 3,
    currentY + 8.2
  );
  doc.text(
    '2. Penggantian atas kehilangan/kerusakan maksimal 5x biaya cuci layanan bersangkutan sesuai regulasi perundangan konsumen.',
    margin + 3,
    currentY + 11.7
  );
  doc.text(
    '3. Cucian yang tidak diambil dalam waktu lebih dari 30 hari di rak penyimpanan di luar tanggung jawab outlet.',
    margin + 3,
    currentY + 15.2
  );

  currentY += 23;

  // Signature Block
  const sigY = currentY;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text('Dibuat & Diverifikasi Oleh,', margin + 8, sigY);
  doc.text('Operator Kasir / Kepala Cuci', margin + 8, sigY + 4);

  doc.text('Disetujui & Diketahui Oleh,', pageWidth - margin - 58, sigY);
  doc.text('Manajer Operasional / Owner', pageWidth - margin - 58, sigY + 4);

  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 8, sigY + 22, margin + 58, sigY + 22);
  doc.line(pageWidth - margin - 58, sigY + 22, pageWidth - margin - 8, sigY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`( ${userName || 'Kasir Operasional'} )`, margin + 8, sigY + 26);
  doc.text(`( ${storeName} )`, pageWidth - margin - 58, sigY + 26);

  // ─── FOOTER DI SELURUH HALAMAN ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      `Sistem Laporan Laundry POS ${storeName} — Dokumen Rahasia & Sah • Dicetak Otomatis oleh CodePOS SaaS`,
      margin,
      pageHeight - 6
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Trigger Download
  const filenameDate = new Date().toISOString().slice(0, 10);
  const safeName = storeName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Laporan_Laundry_${safeName}_${filenameDate}.pdf`);
};
