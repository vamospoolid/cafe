import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VenueSettings {
  storeName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

const formatCurrency = (val: number) => {
  return `Rp ${(val || 0).toLocaleString('id-ID')}`;
};

const formatDateID = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getImageDataUrl = (url: string): Promise<string> => {
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
        } catch (e) {
          resolve('');
        }
      } else {
        resolve('');
      }
    };
    img.onerror = () => {
      resolve('');
    };
    img.src = url;
  });
};

export const exportFinancialPDF = async (
  type: string,
  settings: VenueSettings,
  data: any,
  startDate: string,
  endDate: string,
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {
      console.warn('Failed to load logo, using fallback', e);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  let currentTitle = 'LAPORAN KAFI';
  if (type === 'pl') currentTitle = 'LAPORAN LABA RUGI (PROFIT & LOSS)';
  else if (type === 'cashflow') currentTitle = 'LAPORAN ARUS KAS (METODE LANGSUNG)';
  else if (type === 'ledger') currentTitle = 'BUKU JURNAL LEDGER UMUM (DOUBLE ENTRY)';
  else if (type === 'products') currentTitle = 'LAPORAN PENJUALAN PER-MENU & MARGIN';
  else if (type === 'shifts') currentTitle = 'LAPORAN REKAPITULASI AUDIT SHIFT';
  else if (type === 'inventory') currentTitle = 'LAPORAN MUTASI & VALUASI STOK';
  else if (type === 'dashboard') currentTitle = 'LAPORAN RINGKASAN PERFORMA OPERASIONAL';

  // ─── Header & Footer Callback ───
  const addHeader = (pdfDoc: jsPDF, titleText: string) => {
    let textXOffset = margin;

    // Draw logo if exists
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      // Fallback elegant left green accent bar
      pdfDoc.setFillColor(16, 185, 129); // #10b981
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    // Venue Details (Left side)
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59); // slate-800
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139); // slate-500
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    // Document Title & Metadata (Right side)
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(11);
    pdfDoc.setTextColor(16, 185, 129);
    pdfDoc.text(titleText, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Administrator'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    // Dividers
    pdfDoc.setDrawColor(226, 232, 240); // slate-200
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184); // slate-400
    
    // Bottom border
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    pdfDoc.text(
      `Sistem Laporan POS ${settings?.storeName || 'MUKI RAMEN'} — Dokumen ini sah dan dicatat secara terkomputerisasi.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(
      `Halaman ${pageNum} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  };

  const addSignatureBlock = (pdfDoc: jsPDF, startY: number) => {
    let signatureY = startY + 15;
    
    if (signatureY + 30 > pageHeight - 15) {
      pdfDoc.addPage();
      signatureY = 40; // start fresh on new page
    }
    
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(71, 85, 105);
    
    // Left Signature
    pdfDoc.text('Dibuat Oleh,', margin + 10, signatureY);
    pdfDoc.text('Staf / Pembuat Laporan', margin + 10, signatureY + 4);
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 10, signatureY + 22, margin + 60, signatureY + 22);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(userName || 'Administrator', margin + 10, signatureY + 26);
    
    // Right Signature
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Disetujui Oleh,', pageWidth - margin - 60, signatureY);
    pdfDoc.text('Owner / General Manager', pageWidth - margin - 60, signatureY + 4);
    pdfDoc.line(pageWidth - margin - 60, signatureY + 22, pageWidth - margin - 10, signatureY + 22);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Owner / Manajer', pageWidth - margin - 60, signatureY + 26);
  };

  // ─── 1. LAPORAN LABA RUGI (pl) ───
  if (type === 'pl') {
    const pl = data?.profitLoss || data || {};
    const salesRevenue = pl.salesRevenue || 0;
    const otherRevenue = pl.otherRevenue || 0;
    const otherRevenueBreakdown = pl.otherRevenueBreakdown || {};
    const shiftOverage = pl.shiftOverage || 0;
    const operatingRevenue = pl.operatingRevenue !== undefined ? pl.operatingRevenue : (salesRevenue + otherRevenue + shiftOverage);
    const cogs = pl.cogs || 0;
    const grossProfit = pl.grossProfit !== undefined ? pl.grossProfit : (operatingRevenue - cogs);
    const opexAmount = pl.opexAmount || 0;
    const opexBreakdown = pl.opexBreakdown || {};
    const shiftShortage = pl.shiftShortage || 0;
    const operatingExpenses = pl.operatingExpenses !== undefined ? pl.operatingExpenses : (opexAmount + shiftShortage);
    const netIncome = pl.netIncome !== undefined ? pl.netIncome : (grossProfit - operatingExpenses);

    const grossMarginPercent = operatingRevenue > 0 ? Math.round((grossProfit / operatingRevenue) * 100) : 0;
    const netMarginPercent = operatingRevenue > 0 ? Math.round((netIncome / operatingRevenue) * 100) : 0;

    // Executive Summary Card
    autoTable(doc, {
      head: [['RINGKASAN EKSEKUTIF KEUANGAN (KEY FINANCIAL METRICS)', 'NILAI']],
      body: [
        ['TOTAL PENDAPATAN OPERASIONAL (OPERATING REVENUE)', formatCurrency(operatingRevenue)],
        ['TOTAL BEBAN POKOK PENJUALAN (HPP / COGS)', `-${formatCurrency(cogs)}`],
        ['LABA KOTOR KAFE (GROSS PROFIT)', `${formatCurrency(grossProfit)} (${grossMarginPercent}% Margin)`],
        ['TOTAL BEBAN OPERASIONAL (OPEX & SHORTAGE)', `-${formatCurrency(operatingExpenses)}`],
        ['LABA BERSIH OPERASIONAL (NET OPERATING INCOME)', `${formatCurrency(netIncome)} (${netMarginPercent}% Net Margin)`]
      ],
      startY: 38,
      margin: { top: 38, bottom: 20, left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (cellData: any) => {
        if (cellData.row.index === 4) {
          cellData.cell.styles.fillColor = netIncome >= 0 ? [209, 250, 229] : [254, 226, 226];
          cellData.cell.styles.textColor = netIncome >= 0 ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    const nextY = (doc as any).lastAutoTable?.finalY || 80;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('RINCIAN STRUKTUR AKUN LABA RUGI OPERASIONAL (DETAIL)', margin, nextY + 7);

    const tableColumn = ['URAIAN KEUANGAN OPERASIONAL (ACCOUNT CLASSIFICATION)', 'NOMINAL (IDR)'];
    const tableRows: any[] = [
      ['1. PENDAPATAN OPERASIONAL (REVENUE)', ''],
      ['     Penjualan Kasir POS Bersih', formatCurrency(salesRevenue)]
    ];

    if (otherRevenueBreakdown && Object.keys(otherRevenueBreakdown).length > 0) {
      Object.entries(otherRevenueBreakdown).forEach(([cat, val]) => {
        tableRows.push([`     Pendapatan Lain-lain: ${cat}`, formatCurrency(Number(val))]);
      });
    } else if (otherRevenue > 0) {
      tableRows.push(['     Pendapatan Lain-lain (Petty Cash Masuk)', formatCurrency(otherRevenue)]);
    }

    if (shiftOverage > 0) {
      tableRows.push(['     Kelebihan Uang Kasir (Cash Overage)', formatCurrency(shiftOverage)]);
    }

    tableRows.push(['TOTAL PENDAPATAN OPERASIONAL', formatCurrency(operatingRevenue)]);
    tableRows.push(['', '']);
    tableRows.push(['2. HARGA POKOK PENJUALAN (HPP / COGS)', '']);
    tableRows.push(['     Beban Pemakaian Bahan Baku Resep POS', `-${formatCurrency(cogs)}`]);
    tableRows.push(['TOTAL BEBAN POKOK PENJUALAN', `-${formatCurrency(cogs)}`]);
    tableRows.push(['', '']);
    tableRows.push(['LABA KOTOR OPERASIONAL (GROSS PROFIT)', formatCurrency(grossProfit)]);
    tableRows.push(['', '']);
    tableRows.push(['3. BEBAN OPERASIONAL (OPERATING EXPENSES - OPEX)', '']);

    if (opexBreakdown && Object.keys(opexBreakdown).length > 0) {
      Object.entries(opexBreakdown).forEach(([cat, val]) => {
        tableRows.push([`     Beban Operasional: ${cat}`, `-${formatCurrency(Number(val))}`]);
      });
    } else if (opexAmount > 0) {
      tableRows.push(['     Beban Kas Operasional (Petty Cash Keluar)', `-${formatCurrency(opexAmount)}`]);
    }

    if (shiftShortage > 0) {
      tableRows.push(['     Kekurangan Uang Kasir (Cash Shortage)', `-${formatCurrency(shiftShortage)}`]);
    }

    tableRows.push(['TOTAL BEBAN OPERASIONAL', `-${formatCurrency(operatingExpenses)}`]);
    tableRows.push(['', '']);
    tableRows.push(['LABA / (RUGI) BERSIH OPERASIONAL (NET PROFIT)', formatCurrency(netIncome)]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: nextY + 10,
      margin: { top: 38, bottom: 20 },
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (cellData: any) => {
        const text = cellData.cell.text[0] || '';
        if (text.startsWith('1. ') || text.startsWith('2. ') || text.startsWith('3. ')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [15, 118, 110];
          cellData.cell.styles.fontSize = 9;
        }
        if (text.startsWith('TOTAL ') || text.startsWith('LABA KOTOR')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [30, 41, 59];
          cellData.cell.styles.fillColor = [248, 250, 252];
          cellData.cell.styles.lineColor = [203, 213, 225];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 0.5 };
        }
        if (text.startsWith('LABA / (RUGI) BERSIH')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fontSize = 9.5;
          cellData.cell.styles.fillColor = netIncome >= 0 ? [209, 250, 229] : [254, 226, 226];
          cellData.cell.styles.textColor = netIncome >= 0 ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.lineColor = netIncome >= 0 ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1.5 };
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 2. LAPORAN ARUS KAS (cashflow) ───
  else if (type === 'cashflow') {
    const cf = data?.cashFlow || data || {};
    const salesReceipts = cf.inflow?.salesReceipts || 0;
    const otherReceipts = cf.inflow?.otherReceipts || 0;
    const overages = cf.inflow?.overages || 0;
    const totalInflow = cf.inflow?.total !== undefined ? cf.inflow.total : (salesReceipts + otherReceipts + overages);

    const opexPayments = cf.outflow?.opexPayments || 0;
    const shortages = cf.outflow?.shortages || 0;
    const totalOutflow = cf.outflow?.total !== undefined ? cf.outflow.total : (opexPayments + shortages);

    const netCashFlow = cf.netCashFlow !== undefined ? cf.netCashFlow : (totalInflow - totalOutflow);

    // Summary Card
    autoTable(doc, {
      head: [['RINGKASAN EKSEKUTIF ARUS KAS OPERASIONAL', 'NILAI KAS']],
      body: [
        ['TOTAL PENERIMAAN KAS MASUK (CASH INFLOW)', formatCurrency(totalInflow)],
        ['TOTAL PENGELUARAN KAS KELUAR (CASH OUTFLOW)', `-${formatCurrency(totalOutflow)}`],
        ['KENAIKAN / (PENURUNAN) KAS BERSIH', `${formatCurrency(netCashFlow)} (${netCashFlow >= 0 ? 'Surplus Kas' : 'Defisit Kas'})`]
      ],
      startY: 38,
      margin: { top: 38, bottom: 20, left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (cellData: any) => {
        if (cellData.row.index === 2) {
          cellData.cell.styles.fillColor = netCashFlow >= 0 ? [209, 250, 229] : [254, 226, 226];
          cellData.cell.styles.textColor = netCashFlow >= 0 ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    const nextY = (doc as any).lastAutoTable?.finalY || 70;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('RINCIAN AKTIVITAS ARUS KAS METODE LANGSUNG (DIRECT METHOD)', margin, nextY + 7);

    const tableColumn = ['AKTIVITAS ARUS KAS / URAIAN TRANSAKSI', 'NOMINAL (IDR)'];
    const tableRows = [
      ['1. ARUS KAS MASUK OPERASIONAL (INFLOW)', ''],
      ['     Penerimaan Penjualan Kasir POS (Omzet Kasir)', formatCurrency(salesReceipts)],
      ['     Penerimaan Kas Lain-lain (Petty Cash In)', formatCurrency(otherReceipts)],
      ['     Akumulasi Kelebihan Uang Laci Kasir (Cash Overage)', formatCurrency(overages)],
      ['TOTAL ARUS KAS MASUK', formatCurrency(totalInflow)],
      ['', ''],
      ['2. ARUS KAS KELUAR OPERASIONAL (OUTFLOW)', ''],
      ['     Pembayaran Beban Operasional Kas (Petty Cash Out)', `-${formatCurrency(opexPayments)}`],
      ['     Akumulasi Kekurangan Uang Laci Kasir (Cash Shortage)', `-${formatCurrency(shortages)}`],
      ['TOTAL ARUS KAS KELUAR', `-${formatCurrency(totalOutflow)}`],
      ['', ''],
      ['KENAIKAN / (PENURUNAN) KAS BERSIH PERIODE BERJALAN', formatCurrency(netCashFlow)]
    ];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: nextY + 10,
      margin: { top: 38, bottom: 20 },
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (cellData: any) => {
        const text = cellData.cell.text[0] || '';
        if (text.startsWith('1. ') || text.startsWith('2. ')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = text.includes('INFLOW') ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.fontSize = 9;
        }
        if (text === 'TOTAL ARUS KAS MASUK' || text === 'TOTAL ARUS KAS KELUAR') {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [30, 41, 59];
          cellData.cell.styles.fillColor = [248, 250, 252];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 0.5 };
          cellData.cell.styles.lineColor = [203, 213, 225];
        }
        if (text.startsWith('KENAIKAN / (PENURUNAN)')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fontSize = 9.5;
          cellData.cell.styles.fillColor = netCashFlow >= 0 ? [209, 250, 229] : [254, 226, 226];
          cellData.cell.styles.textColor = netCashFlow >= 0 ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.lineColor = netCashFlow >= 0 ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1.5 };
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 3. JURNAL LEDGER UMUM (ledger) ───
  else if (type === 'ledger') {
    const tableColumn = ['TANGGAL / REF', 'KETERANGAN AKUN / DESKRIPSI', 'DEBIT (RP)', 'KREDIT (RP)'];
    const tableRows: any[] = [];
    const journals = Array.isArray(data) ? data : (data?.journals || []);

    let totalDebit = 0;
    let totalCredit = 0;

    journals.forEach((j: any) => {
      const dateStr = new Date(j.date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      tableRows.push([
        `${dateStr}\n${j.reference}`,
        `Deskripsi Transaksi: ${j.description}`,
        '',
        ''
      ]);
      j.lines?.forEach((l: any) => {
        const isCredit = l.credit > 0;
        const dVal = Number(l.debit) || 0;
        const cVal = Number(l.credit) || 0;
        totalDebit += dVal;
        totalCredit += cVal;

        tableRows.push([
          '',
          isCredit ? `      ${l.account}` : l.account,
          dVal > 0 ? formatCurrency(dVal) : '',
          cVal > 0 ? formatCurrency(cVal) : ''
        ]);
      });
    });

    // Baris Keseimbangan Jurnal (Balance Check)
    const isBalanced = totalDebit === totalCredit;
    tableRows.push([
      'TOTAL AGREGAT',
      isBalanced ? 'STATUS KESEIMBANGAN: SEIMBANG (BALANCE)' : 'STATUS KESEIMBANGAN: TERDAPAT SELISIH (UNBALANCED)',
      formatCurrency(totalDebit),
      formatCurrency(totalCredit)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = isBalanced ? [209, 250, 229] : [254, 226, 226];
          cellData.cell.styles.textColor = isBalanced ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1.5 };
          return;
        }

        const cellVal = cellData.row.cells[1]?.text[0] || '';
        const isMetaRow = cellVal.startsWith('Deskripsi Transaksi:');
        if (isMetaRow) {
          cellData.cell.styles.fillColor = [241, 245, 249];
          cellData.cell.styles.textColor = [71, 85, 105];
          cellData.cell.styles.fontStyle = 'italic';
          cellData.cell.styles.fontSize = 8;
        }
        if (!isMetaRow && cellData.column.index === 1) {
          const isCredit = cellData.cell.text[0].startsWith('      ');
          if (isCredit) {
            cellData.cell.styles.textColor = [100, 116, 139];
          } else {
            cellData.cell.styles.textColor = [15, 23, 42];
            cellData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 4. LAPORAN PENJUALAN PER-MENU (products) ───
  else if (type === 'products') {
    const products = Array.isArray(data) ? data : (data?.products || []);
    
    // Aggregation values
    let totalQty = 0;
    let totalRev = 0;
    let totalCogs = 0;
    let totalProfit = 0;

    products.forEach((p: any) => {
      totalQty += p.qty || 0;
      totalRev += p.revenue || 0;
      totalCogs += p.cost || 0;
      totalProfit += p.profit || 0;
    });

    const avgMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;

    // Executive Summary Card
    autoTable(doc, {
      head: [['RINGKASAN EKSEKUTIF PENJUALAN MENU (F&B)', 'TOTAL']],
      body: [
        ['Total Menu Aktif Terjual', `${products.length} Varian Menu`],
        ['Total Porsi / Item Terjual', `${totalQty.toLocaleString('id-ID')} Porsi`],
        ['Total Omzet Kotor Penjualan', formatCurrency(totalRev)],
        ['Total Beban HPP Bahan Baku', formatCurrency(totalCogs)],
        ['Total Laba Kotor Penjualan (Gross Margin)', `${formatCurrency(totalProfit)} (${avgMargin}% Margin)`]
      ],
      startY: 38,
      margin: { top: 38, bottom: 20, left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
    });

    const nextY = (doc as any).lastAutoTable?.finalY || 75;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('RINCIAN PENJUALAN & MARGIN PER-MENU', margin, nextY + 7);

    const tableColumn = ['NO', 'NAMA MENU', 'KATEGORI', 'TERJUAL', 'HARGA JUAL', 'OMZET KOTOR', 'TOTAL HPP', 'KEUNTUNGAN', 'MARGIN'];

    const tableRows = products.map((p: any, idx: number) => {
      return [
        idx + 1,
        p.name,
        p.category || 'Food & Drink',
        `${p.qty} porsi`,
        formatCurrency(p.price || (p.qty > 0 ? Math.round(p.revenue / p.qty) : 0)),
        formatCurrency(p.revenue),
        formatCurrency(p.cost),
        formatCurrency(p.profit),
        `${p.margin}%`
      ];
    });

    // Append total row
    tableRows.push([
      '',
      'TOTAL AGREGAT PENJUALAN',
      '',
      `${totalQty} porsi`,
      '',
      formatCurrency(totalRev),
      formatCurrency(totalCogs),
      formatCurrency(totalProfit),
      `${avgMargin}%`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: nextY + 10,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 7.5, cellPadding: 1.8, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { fontStyle: 'bold', cellWidth: 42 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 14, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = [209, 250, 229];
          cellData.cell.styles.textColor = [16, 122, 68];
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.lineColor = [16, 122, 68];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1 };
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 5. LAPORAN AUDIT SHIFT (shifts) ───
  else if (type === 'shifts') {
    const shifts = Array.isArray(data) ? data : (data?.shifts || []);
    
    let totalAwal = 0;
    let totalCashSales = 0;
    let totalNonCashSales = 0;
    let totalSistem = 0;
    let totalFisik = 0;
    let totalSelisih = 0;

    shifts.forEach((s: any) => {
      totalAwal += s.saldoAwal || 0;
      const cash = s.cashSales !== undefined ? s.cashSales : Math.max(0, (s.saldoSistem || 0) - (s.saldoAwal || 0));
      totalCashSales += cash;
      totalNonCashSales += s.nonCashSales || 0;
      totalSistem += s.saldoSistem || 0;
      totalFisik += s.saldoFisikLaci || 0;
      totalSelisih += s.selisih || 0;
    });

    // Summary Card
    autoTable(doc, {
      head: [['RINGKASAN REKAPITULASI AUDIT SHIFT KASIR', 'NILAI KEUANGAN']],
      body: [
        ['Total Sesi Shift Terekam', `${shifts.length} Shift`],
        ['Total Modal Awal Laci (Starting Float)', formatCurrency(totalAwal)],
        ['Total Penjualan Kas Tunai (Cash Omzet)', formatCurrency(totalCashSales)],
        ['Total Penjualan Non-Tunai (QRIS/EDC/Bank)', formatCurrency(totalNonCashSales)],
        ['TOTAL SELISIH KASIR (DISCREPANCY)', `${formatCurrency(totalSelisih)} (${totalSelisih === 0 ? 'SEIMBANG / MATCH' : totalSelisih < 0 ? 'KAS KURANG (SHORT)' : 'KAS LEBIH (OVER)'})`]
      ],
      startY: 38,
      margin: { top: 38, bottom: 20, left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (cellData: any) => {
        if (cellData.row.index === 4) {
          cellData.cell.styles.fillColor = totalSelisih === 0 ? [209, 250, 229] : totalSelisih < 0 ? [254, 226, 226] : [254, 243, 199];
          cellData.cell.styles.textColor = totalSelisih === 0 ? [16, 122, 68] : totalSelisih < 0 ? [220, 38, 38] : [217, 119, 6];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    const nextY = (doc as any).lastAutoTable?.finalY || 75;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('DAFTAR DETAIL SESI SHIFT & REKONSILIASI KAS LACI', margin, nextY + 7);

    const tableColumn = ['NO', 'WAKTU TUTUP', 'STAF KASIR', 'SALDO AWAL', 'OMZET KAS', 'NON-TUNAI', 'KAS SISTEM', 'FISIK LACI', 'SELISIH', 'STATUS'];

    const tableRows = shifts.map((s: any, idx: number) => {
      const dateStr = s.waktuTutup ? new Date(s.waktuTutup).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Aktif';

      const selisihVal = s.selisih || 0;
      const selisihText = selisihVal === 0 ? 'Rp 0' : `${selisihVal > 0 ? '+' : ''}${formatCurrency(selisihVal)}`;
      const statusText = selisihVal === 0 ? 'Cocok' : selisihVal < 0 ? 'Kurang' : 'Lebih';

      return [
        idx + 1,
        dateStr,
        s.user?.name || 'Kasir',
        formatCurrency(s.saldoAwal),
        formatCurrency(s.cashSales !== undefined ? s.cashSales : Math.max(0, (s.saldoSistem || 0) - (s.saldoAwal || 0))),
        formatCurrency(s.nonCashSales || 0),
        formatCurrency(s.saldoSistem || 0),
        formatCurrency(s.saldoFisikLaci || 0),
        selisihText,
        statusText
      ];
    });

    tableRows.push([
      '',
      'TOTAL AUDIT',
      '',
      formatCurrency(totalAwal),
      formatCurrency(totalCashSales),
      formatCurrency(totalNonCashSales),
      formatCurrency(totalSistem),
      formatCurrency(totalFisik),
      formatCurrency(totalSelisih),
      totalSelisih === 0 ? 'PAS' : totalSelisih < 0 ? 'KURANG' : 'LEBIH'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: nextY + 10,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1.6, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 25 },
        2: { cellWidth: 20, fontStyle: 'bold' },
        3: { cellWidth: 17, halign: 'right' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 19, halign: 'right' },
        7: { cellWidth: 19, halign: 'right' },
        8: { cellWidth: 19, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = totalSelisih === 0 ? [209, 250, 229] : totalSelisih < 0 ? [254, 226, 226] : [254, 243, 199];
          cellData.cell.styles.textColor = totalSelisih === 0 ? [16, 122, 68] : totalSelisih < 0 ? [220, 38, 38] : [217, 119, 6];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 6. LAPORAN MUTASI & VALUASI STOK (inventory) ───
  else if (type === 'inventory') {
    const items = Array.isArray(data) ? data : (data?.inventory || []);
    const summary = data?.summary || {};

    let calcValuation = 0;
    let criticalCount = 0;
    items.forEach((item: any) => {
      calcValuation += item.totalValuation || ((item.stockAkhir || 0) * (item.buyPrice || 0));
      if ((item.stockAkhir || 0) <= (item.minStock || 0)) criticalCount++;
    });

    const totalAssetVal = summary.totalAssetValuation || calcValuation;
    const totalCritical = summary.criticalItemsCount !== undefined ? summary.criticalItemsCount : criticalCount;

    // Summary Card
    autoTable(doc, {
      head: [['RINGKASAN VALUASI ASET & MUTASI PERSEDIAAN', 'NILAI']],
      body: [
        ['TOTAL VALUASI ASET BAHAN BAKU AKHIR', formatCurrency(totalAssetVal)],
        ['Total Item Bahan Baku Terdaftar', `${items.length} Bahan Baku`],
        ['Status Item Kritis (Mendekati / Di Bawah Buffer Min)', `${totalCritical} Bahan Perlu Restock`]
      ],
      startY: 38,
      margin: { top: 38, bottom: 20, left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
    });

    const nextY = (doc as any).lastAutoTable?.finalY || 65;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('RINCIAN MUTASI FISIK & VALUASI PERSEDIAAN BAHAN BAKU', margin, nextY + 7);

    const tableColumn = ['NO', 'NAMA BAHAN BAKU', 'SAT', 'STOK AWAL', 'MASUK', 'KELUAR', 'STOK AKHIR', 'HARGA', 'VALUASI ASET', 'STATUS'];

    const tableRows = items.map((item: any, idx: number) => {
      const totalKeluar = (item.keluarProduksi || 0) + (item.keluarRusak || 0);
      const isCritical = (item.stockAkhir || 0) <= (item.minStock || 0);
      const statusText = isCritical ? 'Kritis' : 'Aman';
      const itemVal = item.totalValuation || ((item.stockAkhir || 0) * (item.buyPrice || 0));

      return [
        idx + 1,
        item.name,
        item.unit || '',
        (item.stockAwal || 0).toLocaleString('id-ID'),
        (item.masuk || 0).toLocaleString('id-ID'),
        totalKeluar.toLocaleString('id-ID'),
        (item.stockAkhir || 0).toLocaleString('id-ID'),
        formatCurrency(item.buyPrice || 0),
        formatCurrency(itemVal),
        statusText
      ];
    });

    tableRows.push([
      '',
      'TOTAL VALUASI ASET PERSEDIAAN',
      '',
      '',
      '',
      '',
      '',
      '',
      formatCurrency(totalAssetVal),
      ''
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: nextY + 10,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { fontStyle: 'bold', cellWidth: 38 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 15, halign: 'right' },
        6: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 20, halign: 'right' },
        8: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = [241, 245, 249];
          cellData.cell.styles.textColor = [15, 118, 110];
          cellData.cell.styles.fontStyle = 'bold';
        } else {
          const rowStatus = cellData.row.cells[9]?.text[0];
          if (rowStatus === 'Kritis') {
            cellData.cell.styles.fillColor = [254, 242, 242];
            if (cellData.column.index === 9) {
              cellData.cell.styles.textColor = [220, 38, 38];
            }
          }
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 8. LAPORAN DETAIL MENU & VALUASI BARANG JADI (product_details) ───
  else if (type === 'product_details') {
    const tableColumn = ['BARCODE', 'NAMA PRODUK', 'KATEGORI', 'STOK', 'HPP SATUAN', 'HARGA JUAL', 'MARGIN (%)', 'NILAI ASET', 'POTENSI OMZET'];
    const products = data.products || [];
    const summary = data.summary || {};

    const tableRows = products.map((p: any) => {
      const isCritical = p.stock <= p.minStock;
      const statusText = isCritical ? ' (KRITIS)' : '';
      return [
        p.barcode || '—',
        p.name + statusText,
        p.categoryName,
        `${p.stock} unit`,
        formatCurrency(p.buyPrice),
        formatCurrency(p.sellPrice),
        `${p.marginPercent}%`,
        formatCurrency(p.totalAssetValuation),
        formatCurrency(p.totalPotentialSales)
      ];
    });

    tableRows.push([
      'TOTAL VALUASI ASET BARANG JADI',
      '',
      '',
      '',
      '',
      '',
      '',
      formatCurrency(summary.totalAssetValuation || 0),
      formatCurrency(summary.totalPotentialSales || 0)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 22 },
        1: { fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'right', fontStyle: 'bold' },
        8: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = [209, 250, 229];
          cellData.cell.styles.textColor = [16, 122, 68];
          cellData.cell.styles.fontStyle = 'bold';
        } else {
          const nameText = cellData.row.cells[1]?.text[0] || '';
          if (nameText.endsWith('(KRITIS)')) {
            cellData.cell.styles.fillColor = [254, 242, 242]; // soft red
            if (cellData.column.index === 1) {
              cellData.cell.styles.textColor = [220, 38, 38];
            }
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Ringkasan: Total Nilai Aset Barang Jadi bernilai ${formatCurrency(summary.totalAssetValuation || 0)} dengan potensi nilai penjualan sebesar ${formatCurrency(summary.totalPotentialSales || 0)}. Terdeteksi ${summary.criticalProductsCount || 0} produk dengan stok kritis.`, margin, finalY + 8);

    addSignatureBlock(doc, finalY + 10);
  }

  // ─── 9. LAPORAN RIWAYAT TRANSAKSI DETAIL (transactions) ───
  else if (type === 'transactions') {
    const tableColumn = ['TANGGAL', 'NO. ORDER', 'PELANGGAN', 'KASIR', 'METODE', 'STATUS', 'TOTAL'];
    const orders = data || [];
    
    let totalSales = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalService = 0;
    let totalNet = 0;
    let voidCount = 0;

    const paymentSummary: Record<string, number> = {
      'Tunai': 0,
      'QRIS': 0,
      'Kartu': 0,
      'Split': 0,
      'Lainnya': 0
    };

    const tableRows = orders.map((o: any) => {
      const isVoid = o.status === 'Void';
      if (!isVoid) {
        totalNet += o.total || 0;
        totalDiscount += o.discount || 0;
        totalTax += o.tax || 0;
        totalService += o.serviceCharge || 0;
        totalSales += o.subtotal || 0;

        let pm = o.paymentMethod || 'Tunai';
        pm = pm.trim();
        if (pm.toLowerCase() === 'cash' || pm === 'Tunai') {
          pm = 'Tunai';
        } else if (pm.toLowerCase() === 'card' || pm === 'Kartu') {
          pm = 'Kartu';
        } else if (pm === 'QRIS') {
          pm = 'QRIS';
        } else if (pm.startsWith('Split')) {
          pm = 'Split';
        } else {
          pm = 'Lainnya';
        }
        
        paymentSummary[pm] = (paymentSummary[pm] || 0) + o.total;
      } else {
        voidCount++;
      }

      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) : '—';

      return [
        dateStr,
        o.orderNumber,
        o.customerName || 'Walk-in',
        o.user?.name || 'Kasir',
        o.paymentMethod || '—',
        o.status,
        formatCurrency(o.total)
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { fontStyle: 'bold', cellWidth: 32 },
        5: { fontStyle: 'bold' },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 28 }
      },
      didParseCell: (cellData: any) => {
        if (cellData.column.index === 5) {
          const statusText = cellData.cell.text[0];
          if (statusText === 'Void') {
            cellData.cell.styles.textColor = [220, 38, 38]; // Red
          } else if (statusText === 'Paid') {
            cellData.cell.styles.textColor = [16, 122, 68]; // Green
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    
    // Page break safety check: if summary block + signatures won't fit on current page, start clean on next page
    let summaryStartY = finalY;
    const requiredSummaryHeight = 65;
    if (summaryStartY + requiredSummaryHeight > pageHeight - 25) {
      doc.addPage();
      summaryStartY = 40; // Safely below header on new page
    } else {
      summaryStartY = summaryStartY + 8;
    }

    // Summary Section Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('RINGKASAN KEUANGAN TRANSAKSI (SAH)', margin, summaryStartY + 4);
    
    const summaryRows = [
      ['Total Penjualan Kotor (POS)', formatCurrency(totalSales + totalDiscount)],
      ['Total Diskon Penjualan', `-${formatCurrency(totalDiscount)}`],
      ['Total Pajak Restoran (PB1)', formatCurrency(totalTax)],
      ['Total Pendapatan Service Charge', formatCurrency(totalService)],
      ['TOTAL PENJUALAN BERSIH (NET SALES)', formatCurrency(totalNet)]
    ];

    autoTable(doc, {
      body: summaryRows,
      startY: summaryStartY + 7,
      margin: { top: 38, bottom: 20, left: margin, right: margin + 95 },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
      },
      didParseCell: (cellData: any) => {
        if (cellData.row.index === summaryRows.length - 1) {
          cellData.cell.styles.fillColor = [209, 250, 229];
          cellData.cell.styles.textColor = [16, 122, 68];
        }
      }
    });

    const leftTableY = (doc as any).lastAutoTable?.finalY || summaryStartY + 35;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('BREAKDOWN METODE PEMBAYARAN', margin + 95, summaryStartY + 4);
    const paymentRows = Object.entries(paymentSummary).map(([method, amount]) => [method, formatCurrency(amount)]);
    paymentRows.push(['TOTAL PENERIMAAN KAS', formatCurrency(totalNet)]);

    autoTable(doc, {
      body: paymentRows,
      startY: summaryStartY + 7,
      margin: { top: 38, bottom: 20, left: margin + 95, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
      },
      didParseCell: (cellData: any) => {
        if (cellData.row.index === paymentRows.length - 1) {
          cellData.cell.styles.fillColor = [241, 245, 249];
          cellData.cell.styles.textColor = [15, 118, 110];
        }
      }
    });

    const rightTableY = (doc as any).lastAutoTable?.finalY || summaryStartY + 35;
    const finalSummaryY = Math.max(leftTableY, rightTableY);

    if (voidCount > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(220, 38, 38);
      doc.text(`* Perhatian: Terdapat ${voidCount} transaksi dibatalkan (Void) yang dikeluarkan dari kalkulasi keuangan di atas.`, margin, finalSummaryY + 6);
      addSignatureBlock(doc, finalSummaryY + 10);
    } else {
      addSignatureBlock(doc, finalSummaryY + 6);
    }
  }

  // ─── 7. LAPORAN RINGKASAN DASHBOARD (dashboard) ───
  else if (type === 'dashboard') {
    const recap = data.periodRecap || {};
    
    // First, draw a summary card table
    const tableColumn1 = ['RINGKASAN METRIK OPERASIONAL', 'NOMINAL'];
    const tableRows1 = [
      ['Total Pendapatan (Omzet)', formatCurrency(recap.revenue)],
      ['Total Pengeluaran Petty Cash', `-${formatCurrency(recap.expenses)}`],
      ['Laba Bersih Operasional (Net)', formatCurrency(recap.netIncome)],
      ['Penjualan Dine-In (Makan di Tempat)', formatCurrency(recap.dineIn)],
      ['Penjualan Takeaway / Delivery', formatCurrency(recap.takeaway)],
      ['Total Pembayaran QRIS', `${formatCurrency(recap.qrisTotal)} (${recap.qrisCount} transaksi)`]
    ];

    autoTable(doc, {
      head: [tableColumn1],
      body: tableRows1,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
    });

    const nextY = (doc as any).lastAutoTable?.finalY || 100;
    
    // Write title for daily breakdown
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('BREAKDOWN OMZET & LABA HARIAN', margin, nextY + 8);

    const tableColumn2 = ['TANGGAL', 'OMZET HARIAN', 'PENGELUARAN', 'ESTIMASI LABA', 'TRX'];
    const dailyLogs = data.dailyTimeline || [];
    const tableRows2 = dailyLogs.map((log: any) => [
      log.dateLabel,
      formatCurrency(log.total),
      formatCurrency(log.expenses),
      formatCurrency(log.profit),
      `${log.count} transaksi`
    ]);

    autoTable(doc, {
      head: [tableColumn2],
      body: tableRows2,
      startY: nextY + 12,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 180);
  }

  // ─── Post-Process Page Loop (Add Header & Footer) ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addHeader(doc, currentTitle);
    addFooter(doc, i, pageCount);
  }

  // Save the generated document
  const fileNameTitle = currentTitle.replace(/\s+/g, '_');
  doc.save(`${fileNameTitle}_${startDate}_to_${endDate}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. LAPORAN VALUASI & POSISI ASET PERSEDIAAN (INVENTORY VALUATION REPORT)
// ─────────────────────────────────────────────────────────────────────────────
export const exportIngredientValuationPDF = async (
  settings: VenueSettings,
  ingredients: any[],
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;
  const currentTitle = 'LAPORAN VALUASI POSISI ASET PERSEDIAAN';

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(245, 158, 11); // amber-500
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(217, 119, 6); // amber-600
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Status Posisi: Realtime Closing`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Cost Controller / Finance'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text(
      `Sistem Akuntansi Persediaan ${settings?.storeName || 'MUKI RAMEN'} — Dokumen Aset Lancar Resmi.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const addThreeSignatureBlock = (pdfDoc: jsPDF, startY: number) => {
    let signatureY = startY + 14;
    if (signatureY + 32 > pageHeight - 15) {
      pdfDoc.addPage();
      signatureY = 40;
    }
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(71, 85, 105);

    // Left
    pdfDoc.text('Dibuat Oleh (PIC Dapur/Gudang),', margin + 6, signatureY);
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 6, signatureY + 18, margin + 50, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(userName || 'Head Chef / Barista', margin + 6, signatureY + 22);

    // Middle
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Diperiksa Oleh (Cost Control),', (pageWidth / 2) - 22, signatureY);
    pdfDoc.line((pageWidth / 2) - 22, signatureY + 18, (pageWidth / 2) + 22, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Finance / Accounting', (pageWidth / 2) - 22, signatureY + 22);

    // Right
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Disetujui Oleh (Owner/GM),', pageWidth - margin - 50, signatureY);
    pdfDoc.line(pageWidth - margin - 50, signatureY + 18, pageWidth - margin - 6, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Owner / General Manager', pageWidth - margin - 50, signatureY + 22);
  };

  // Calculations
  const totalValuation = ingredients.reduce((acc, i) => acc + ((i.stock || 0) * (i.buyPrice || 0)), 0);
  const totalItems = ingredients.length;
  const lowStockCount = ingredients.filter(i => i.stock <= i.minStock && i.stock > 0).length;
  const outOfStockCount = ingredients.filter(i => i.stock <= 0).length;

  const foodVal = ingredients.filter(i => (i.category || 'FOOD') === 'FOOD').reduce((acc, i) => acc + (i.stock * i.buyPrice), 0);
  const drinkVal = ingredients.filter(i => i.category === 'DRINK').reduce((acc, i) => acc + (i.stock * i.buyPrice), 0);
  const packVal = ingredients.filter(i => i.category === 'PACKAGING').reduce((acc, i) => acc + (i.stock * i.buyPrice), 0);

  // Summary Metrics Table
  autoTable(doc, {
    head: [['RINGKASAN VALUASI ASET PERSEDIAAN', 'NILAI']],
    body: [
      ['TOTAL VALUASI NILAI ASET GUDANG & DAPUR', formatCurrency(totalValuation)],
      ['Total Variasi Bahan Baku', `${totalItems} Macam`],
      ['Valuasi Kategori Bahan Makanan (Food)', formatCurrency(foodVal)],
      ['Valuasi Kategori Bahan Minuman (Drink)', formatCurrency(drinkVal)],
      ['Valuasi Kategori Kemasan (Packaging)', formatCurrency(packVal)],
      ['Status Stok Kritis / Di Bawah Buffer Stock', `${lowStockCount} Item Menipis, ${outOfStockCount} Item Habis`]
    ],
    startY: 38,
    margin: { top: 38, bottom: 20 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  const nextY = (doc as any).lastAutoTable?.finalY || 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('RINCIAN VALUASI DETAIL PER-ITEM BAHAN BAKU', margin, nextY + 8);

  // Detail Table
  const tableColumns = ['NO', 'NAMA BAHAN', 'KAT', 'STOK', 'SATUAN', 'HARGA BELI', 'NILAI ASET (RP)', 'MIN', 'STATUS'];
  const tableRows = ingredients.map((item, idx) => {
    const itemValuation = (item.stock || 0) * (item.buyPrice || 0);
    let statusText = 'Aman';
    if (item.stock <= 0) statusText = 'HABIS';
    else if (item.stock <= item.minStock) statusText = 'MENIPIS';

    return [
      idx + 1,
      item.name,
      item.category || 'FOOD',
      item.stock,
      item.unit,
      formatCurrency(item.buyPrice),
      formatCurrency(itemValuation),
      item.minStock,
      statusText
    ];
  });

  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: nextY + 12,
    margin: { top: 38, bottom: 20 },
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right' },
      8: { halign: 'center', fontStyle: 'bold' }
    }
  });

  addThreeSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 180);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Valuasi_Aset_Persediaan_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. LAPORAN AUDIT STOCK LOSS & KERUSAKAN BAHAN (WASTE AUDIT REPORT)
// ─────────────────────────────────────────────────────────────────────────────
export const exportStockLossAuditPDF = async (
  settings: VenueSettings,
  lossData: any,
  userName?: string,
  startDate?: string,
  endDate?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;
  const currentTitle = 'LAPORAN AUDIT KERUSAKAN & STOCK LOSS (FOOD WASTE)';

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(225, 29, 72); // rose-600
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(9.5);
    pdfDoc.setTextColor(225, 29, 72);
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${startDate ? formatDateID(startDate) : 'Bulan Berjalan'} s/d ${endDate ? formatDateID(endDate) : 'Hari Ini'}`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Auditor Dapur / Finance'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text(
      `Sistem Audit HPP & Kerusakan Bahan ${settings?.storeName || 'MUKI RAMEN'} — Dokumen Pengawasan Biaya.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const addThreeSignatureBlock = (pdfDoc: jsPDF, startY: number) => {
    let signatureY = startY + 14;
    if (signatureY + 32 > pageHeight - 15) {
      pdfDoc.addPage();
      signatureY = 40;
    }
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(71, 85, 105);

    pdfDoc.text('Dilaporkan Oleh (Head Chef/Barista),', margin + 6, signatureY);
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 6, signatureY + 18, margin + 50, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(userName || 'Kepala Dapur', margin + 6, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Diaudit Oleh (Cost Controller),', (pageWidth / 2) - 22, signatureY);
    pdfDoc.line((pageWidth / 2) - 22, signatureY + 18, (pageWidth / 2) + 22, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Finance & Accounting', (pageWidth / 2) - 22, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Mengetahui (Owner/GM),', pageWidth - margin - 50, signatureY);
    pdfDoc.line(pageWidth - margin - 50, signatureY + 18, pageWidth - margin - 6, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Owner / Manajer', pageWidth - margin - 50, signatureY + 22);
  };

  const totalLossRp = lossData?.totalLossRupiah ?? lossData?.summary?.totalLossCost ?? 0;
  const totalIncidents = lossData?.totalLossIncidents ?? lossData?.summary?.totalLossCount ?? 0;
  const lossRate = lossData?.lossRatePercentage ?? lossData?.summary?.lossPercentage ?? 0;
  const efficiencyRate = lossData?.efficiencyRate ?? lossData?.summary?.efficiencyPercentage ?? 100;
  const productionValue = lossData?.totalProductionValue ?? lossData?.summary?.totalProductionCost ?? 0;

  // Key KPI Cards
  autoTable(doc, {
    head: [['KEY PERFORMANCE INDICATOR (KPI) LOSS & EFISIENSI', 'HASIL EVALUASI']],
    body: [
      ['TOTAL VALUASI KERUGIAN BAHAN BAKU (STOCK LOSS)', formatCurrency(totalLossRp)],
      ['Total Insiden Kerusakan Dicatat', `${totalIncidents} Kejadian Insiden`],
      ['Tingkat Kerugian Bahan (% Loss Rate)', `${lossRate}% dari total pengeluaran`],
      ['Tingkat Efisiensi Bahan (% Yield Rate)', `${efficiencyRate}% sukses diproduksi/terjual`],
      ['Total Nilai Produksi Sukses Terjual (POS)', formatCurrency(productionValue)]
    ],
    startY: 38,
    margin: { top: 38, bottom: 20 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [190, 18, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  let nextY = (doc as any).lastAutoTable?.finalY || 85;

  // Top 5 Loss Items
  const rawTopItems = lossData?.topLossItems || [];
  if (rawTopItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('TOP 5 BAHAN PENYUMBANG KERUGIAN TERBESAR (PARETO 80/20)', margin, nextY + 8);

    const topColumns = ['PERINGKAT', 'NAMA BAHAN BAKU', 'TOTAL QTY RUSAK', 'TOTAL VALUASI RUGI (RP)'];
    const topRows = rawTopItems.map((t: any, idx: number) => [
      `Peringkat #${idx + 1}`,
      t.name,
      `${t.totalQty} ${t.unit}`,
      formatCurrency(t.totalRupiah !== undefined ? t.totalRupiah : (t.totalCost || 0))
    ]);

    autoTable(doc, {
      head: [topColumns],
      body: topRows,
      startY: nextY + 11,
      margin: { top: 38, bottom: 20 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] }
      }
    });

    nextY = (doc as any).lastAutoTable?.finalY || nextY + 30;
  }

  // Full Log Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('RIWAYAT LENGKAP PENCATATAN INSIDEN STOCK LOSS & WASTE', margin, nextY + 8);

  const rawLogs = lossData?.lossLogs || lossData?.logs || [];
  const logColumns = ['TANGGAL/WAKTU', 'BAHAN BAKU', 'QTY RUSAK', 'VALUASI (RP)', 'ALASAN', 'DICATAT OLEH'];
  const logRows = rawLogs.map((l: any) => [
    new Date(l.date || l.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    l.ingredient?.name || '-',
    `${l.qtyLoss !== undefined ? l.qtyLoss : Math.abs(l.change || 0)} ${l.ingredient?.unit || ''}`,
    formatCurrency(l.costLoss !== undefined ? l.costLoss : (l.cost || (Math.abs(l.change || 0) * (l.ingredient?.buyPrice || 0)))),
    l.reason || 'Lainnya',
    l.recordedBy || l.user?.name || 'Staf Dapur'
  ]);

  autoTable(doc, {
    head: [logColumns],
    body: logRows.length > 0 ? logRows : [['-', 'Belum ada data insiden kerusakan tercatat', '-', '-', '-', '-']],
    startY: nextY + 11,
    margin: { top: 38, bottom: 20 },
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'left' }
    }
  });

  addThreeSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 180);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Audit_Stock_Loss_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. LAPORAN RENCANA ANGGARAN & PROYEKSI BELANJA BAHAN (PROCUREMENT FORECAST)
// ─────────────────────────────────────────────────────────────────────────────
export const exportProcurementForecastPDF = async (
  settings: VenueSettings,
  shoppingData: any,
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;
  const currentTitle = 'LAPORAN RENCANA ANGGARAN & PROYEKSI BELANJA BAHAN';

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(79, 70, 229); // indigo-600
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(9.5);
    pdfDoc.setTextColor(79, 70, 229);
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Status: Kebutuhan Belanja / Restock`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Dibuat Oleh: ${userName || 'Purchasing / Dapur'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text(
      `Sistem Perencanaan Pengadaan ${settings?.storeName || 'MUKI RAMEN'} — Dokumen Proyeksi Arus Kas Keluar.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const addThreeSignatureBlock = (pdfDoc: jsPDF, startY: number) => {
    let signatureY = startY + 14;
    if (signatureY + 32 > pageHeight - 15) {
      pdfDoc.addPage();
      signatureY = 40;
    }
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(71, 85, 105);

    pdfDoc.text('Diajukan Oleh (Purchasing/Dapur),', margin + 6, signatureY);
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 6, signatureY + 18, margin + 50, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(userName || 'Petugas Pembelian', margin + 6, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Disiapkan Kas (Finance),', (pageWidth / 2) - 22, signatureY);
    pdfDoc.line((pageWidth / 2) - 22, signatureY + 18, (pageWidth / 2) + 22, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Finance / Kasir Kas', (pageWidth / 2) - 22, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Disetujui Oleh (Owner/GM),', pageWidth - margin - 50, signatureY);
    pdfDoc.line(pageWidth - margin - 50, signatureY + 18, pageWidth - margin - 6, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Owner / General Manager', pageWidth - margin - 50, signatureY + 22);
  };

  const rawItems = shoppingData?.criticalItems || shoppingData?.lowStockItems || [];
  const totalEstimatedCost = shoppingData?.totalEstimatedCost ?? shoppingData?.summary?.totalRestockCost ?? rawItems.reduce((acc: number, i: any) => acc + (i.estimatedCost || 0), 0);
  const criticalCount = rawItems.length;

  // Summary Metrics
  autoTable(doc, {
    head: [['RINGKASAN ESTIMASI ANGGARAN BELANJA RESTOCK', 'NOMINAL']],
    body: [
      ['TOTAL ESTIMASI DANA KAS YANG DIBUTUHKAN', formatCurrency(totalEstimatedCost)],
      ['Total Item Bahan Perlu Segera Dibeli', `${criticalCount} Bahan Kritis/Habis`],
      ['Status Kesiapan Arus Kas', 'Siap Dicairkan Via Petty Cash / Transfer Supplier']
    ],
    startY: 38,
    margin: { top: 38, bottom: 20 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  const nextY = (doc as any).lastAutoTable?.finalY || 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('DAFTAR BAHAN BAKU YANG PERLU DIBELI / DIREORDER', margin, nextY + 8);

  const planColumns = ['NO', 'BAHAN BAKU', 'SISA STOK', 'BUFFER MIN', 'SARAN ORDER', 'EST. HARGA', 'EST. ANGGARAN (RP)', 'SUPPLIER'];
  const planRows = rawItems.map((item: any, idx: number) => {
    const curStock = item.currentStock !== undefined ? item.currentStock : (item.stock || 0);
    const minStk = item.minStock || 0;
    const reqQty = item.recommendedBuyQty !== undefined ? item.recommendedBuyQty : (item.suggestedQty || 0);
    const price = item.buyPrice || 0;
    const cost = item.estimatedCost !== undefined ? item.estimatedCost : (reqQty * price);
    const sName = item.supplierName || item.supplier?.name || 'Umum / Pasar';

    return [
      idx + 1,
      item.name,
      `${curStock} ${item.unit || ''}`,
      `${minStk} ${item.unit || ''}`,
      `${reqQty} ${item.unit || ''}`,
      formatCurrency(price),
      formatCurrency(cost),
      sName
    ];
  });

  autoTable(doc, {
    head: [planColumns],
    body: planRows.length > 0 ? planRows : [['-', 'Semua bahan baku dalam kondisi aman (Stok Cukup)', '-', '-', '-', '-', '-', '-']],
    startY: nextY + 11,
    margin: { top: 38, bottom: 20 },
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'left' }
    }
  });

  addThreeSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 180);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Rencana_Belanja_Bahan_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. LAPORAN REKONSILIASI STOCK OPNAME FISIK (VARIANCE / DISCREPANCY REPORT)
// ─────────────────────────────────────────────────────────────────────────────
export const exportStockOpnameVariancePDF = async (
  settings: VenueSettings,
  opnameItems: any[],
  userName?: string,
  generalNotes?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;
  const currentTitle = 'BERITA ACARA & HASIL AUDIT STOCK OPNAME FISIK';

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(14, 165, 233); // sky-500
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(9.5);
    pdfDoc.setTextColor(2, 132, 199);
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Status: Rekonsiliasi Fisik vs Sistem Buku`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Auditor / Petugas: ${userName || 'Auditor Tim Dapur'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Audit: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text(
      `Sistem Audit Persediaan Fisik ${settings?.storeName || 'MUKI RAMEN'} — Berita Acara Rekonsiliasi Resmi.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const addThreeSignatureBlock = (pdfDoc: jsPDF, startY: number) => {
    let signatureY = startY + 14;
    if (signatureY + 32 > pageHeight - 15) {
      pdfDoc.addPage();
      signatureY = 40;
    }
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(71, 85, 105);

    pdfDoc.text('Petugas Penghitung Fisik,', margin + 6, signatureY);
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 6, signatureY + 18, margin + 50, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(userName || 'Tim Opname', margin + 6, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Diverifikasi (Cost Controller),', (pageWidth / 2) - 22, signatureY);
    pdfDoc.line((pageWidth / 2) - 22, signatureY + 18, (pageWidth / 2) + 22, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Finance / Accounting', (pageWidth / 2) - 22, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Disetujui (Owner / Manager),', pageWidth - margin - 50, signatureY);
    pdfDoc.line(pageWidth - margin - 50, signatureY + 18, pageWidth - margin - 6, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Owner / General Manager', pageWidth - margin - 50, signatureY + 22);
  };

  // Calculations
  const rawOpnameItems = Array.isArray(opnameItems) ? opnameItems : [];
  let totalDiscrepancyPlus = 0;
  let totalDiscrepancyMinus = 0;
  let matchedItems = 0;

  const tableRows = rawOpnameItems.map((item, idx) => {
    const sys = Number(item.systemStock !== undefined ? item.systemStock : item.stock) || 0;
    const phys = item.physicalStock === '' || item.physicalStock === undefined ? sys : (Number(item.physicalStock) || 0);
    const diff = phys - sys;
    const diffRp = diff * (item.buyPrice || 0);

    if (diff > 0) totalDiscrepancyPlus += diffRp;
    else if (diff < 0) totalDiscrepancyMinus += Math.abs(diffRp);
    else matchedItems++;

    return [
      idx + 1,
      item.name,
      item.unit || '',
      sys,
      phys,
      diff > 0 ? `+${diff}` : diff,
      formatCurrency(item.buyPrice || 0),
      diff > 0 ? `+${formatCurrency(diffRp)}` : formatCurrency(diffRp),
      item.reason || item.notes || '-'
    ];
  });

  const accuracyRate = rawOpnameItems.length > 0 ? Math.round((matchedItems / rawOpnameItems.length) * 100) : 100;
  const netVarianceRp = totalDiscrepancyPlus - totalDiscrepancyMinus;

  // Summary Metrics Table
  autoTable(doc, {
    head: [['HASIL REKONSILIASI OPNAME FISIK', 'NILAI AUDIT']],
    body: [
      ['Total Item Bahan Baku Diaudit', `${opnameItems.length} Item`],
      ['Tingkat Akurasi Stok Fisik vs Sistem', `${accuracyRate}% Cocok`],
      ['Total Selisih Lebih Fisik (+)', `+${formatCurrency(totalDiscrepancyPlus)}`],
      ['Total Selisih Kurang Fisik (-)', `-${formatCurrency(totalDiscrepancyMinus)}`],
      ['NET SELISIH PERSIMPANGAN (NET VARIANCE)', `${netVarianceRp >= 0 ? '+' : ''}${formatCurrency(netVarianceRp)}`]
    ],
    startY: 38,
    margin: { top: 38, bottom: 20 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  const nextY = (doc as any).lastAutoTable?.finalY || 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('LEMBAR KERJA DETAIL REKONSILIASI STOK OPNAME', margin, nextY + 8);

  const opnameColumns = ['NO', 'BAHAN BAKU', 'SATUAN', 'SISTEM', 'FISIK', 'SELISIH', 'HARGA', 'VARIANCE (RP)', 'CATATAN'];

  autoTable(doc, {
    head: [opnameColumns],
    body: tableRows,
    startY: nextY + 11,
    margin: { top: 38, bottom: 20 },
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'left' }
    }
  });

  addThreeSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 180);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Berita_Acara_Stock_Opname_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. LAPORAN KONSUMSI & PEMAKAIAN BAHAN BAKU HARIAN (DAILY COGS REPORT)
// ─────────────────────────────────────────────────────────────────────────────
export const exportDailyMaterialConsumptionPDF = async (
  settings: VenueSettings,
  usageData: any,
  userName?: string,
  startDate?: string,
  endDate?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;
  const currentTitle = 'LAPORAN KONSUMSI & PEMAKAIAN BAHAN BAKU (DAILY COGS)';

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(79, 70, 229); // indigo-600
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(79, 70, 229);
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${startDate ? formatDateID(startDate) : 'Hari Ini'} s/d ${endDate ? formatDateID(endDate) : 'Hari Ini'}`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Head Chef / Finance'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text(
      `Laporan Analisis Konsumsi Bahan Baku ${settings?.storeName || 'MUKI RAMEN'} — Dokumen Pengawasan HPP & Bahan Baku.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const addThreeSignatureBlock = (pdfDoc: jsPDF, startY: number) => {
    let signatureY = startY + 14;
    if (signatureY + 32 > pageHeight - 15) {
      pdfDoc.addPage();
      signatureY = 40;
    }
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(71, 85, 105);

    pdfDoc.text('Dibuat Oleh (PIC Dapur/Bar),', margin + 6, signatureY);
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 6, signatureY + 18, margin + 50, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(userName || 'Head Chef / Barista', margin + 6, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Diperiksa Oleh (Cost Control),', (pageWidth / 2) - 22, signatureY);
    pdfDoc.line((pageWidth / 2) - 22, signatureY + 18, (pageWidth / 2) + 22, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Finance / Accounting', (pageWidth / 2) - 22, signatureY + 22);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Disetujui Oleh (Owner/GM),', pageWidth - margin - 50, signatureY);
    pdfDoc.line(pageWidth - margin - 50, signatureY + 18, pageWidth - margin - 6, signatureY + 18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Owner / General Manager', pageWidth - margin - 50, signatureY + 22);
  };

  const summary = usageData?.summary || {};
  const items = usageData?.items || [];

  // Summary Metrics Table
  autoTable(doc, {
    head: [['RINGKASAN KONSUMSI & BIAYA POKOK PENJUALAN (HPP/COGS)', 'NILAI']],
    body: [
      ['TOTAL ESTIMASI HPP BAHAN TERPAKAI (COGS)', formatCurrency(summary.totalCostUsage)],
      ['Omzet Penjualan POS Pada Periode Ini', formatCurrency(summary.totalRevenue)],
      ['Food & Beverage Cost Ratio (%)', `${summary.foodCostRatio || 0}% ${summary.foodCostRatio > 35 ? '(Tinggi / Waspada)' : '(Sehat)'}`],
      ['Total Biaya Pemakaian Dapur (Food)', formatCurrency(summary.foodCost)],
      ['Total Biaya Pemakaian Bar (Drink)', formatCurrency(summary.drinkCost)],
      ['Total Biaya Kemasan (Packaging)', formatCurrency(summary.packagingCost)],
      ['Total Kerugian Bahan Basi/Rusak (Loss)', formatCurrency(summary.totalLossCost)]
    ],
    startY: 38,
    margin: { top: 38, bottom: 20 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  const nextY = (doc as any).lastAutoTable?.finalY || 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('RINCIAN PEMAKAIAN PER-ITEM BAHAN BAKU', margin, nextY + 8);

  const tableColumns = ['NO', 'NAMA BAHAN BAKU', 'KAT', 'TOTAL PAKAI', 'PRODUKSI POS', 'WASTE', 'HARGA SATUAN', 'TOTAL HPP (RP)', 'SISA STOK'];
  const tableRows = items.map((item: any, idx: number) => {
    return [
      idx + 1,
      item.name,
      item.category || 'FOOD',
      `${(item.totalQtyUsed || 0).toLocaleString('id-ID')} ${item.unit}`,
      `${(item.productionQty || 0).toLocaleString('id-ID')} ${item.unit}`,
      item.lossQty > 0 ? `${item.lossQty.toLocaleString('id-ID')} ${item.unit}` : '-',
      formatCurrency(item.buyPrice),
      formatCurrency(item.totalCost),
      `${(item.currentStock || 0).toLocaleString('id-ID')} ${item.unit}`
    ];
  });

  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: nextY + 11,
    margin: { top: 38, bottom: 20 },
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right', textColor: [225, 29, 72] },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right' }
    }
  });

  addThreeSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 180);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Konsumsi_Bahan_Baku_${startDate || new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. SURAT PESANAN PEMBELIAN RESMI RINGKAS (SIMPLE PURCHASE ORDER PDF)
// ─────────────────────────────────────────────────────────────────────────────
export const exportSimplePurchaseOrderPDF = async (
  settings: VenueSettings,
  poData: {
    poNumber?: string;
    supplierName: string;
    supplierPhone?: string;
    deliveryDate?: string;
    items: Array<{ name: string; qty: number; unit: string; estimatedPrice?: number; notes?: string }>;
    notes?: string;
  },
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  const poNumber = poData.poNumber || `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  // Header
  let textXOffset = margin;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
    textXOffset = margin + 18;
  } else {
    doc.setFillColor(16, 185, 129); // emerald-600
    doc.rect(margin, 12, 4, 18, 'F');
    textXOffset = margin + 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
  doc.text(`Kontak Toko: ${settings?.phone || '-'}`, textXOffset, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text('SURAT PESANAN PEMBELIAN (PURCHASE ORDER)', pageWidth - margin, 17, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`NO: ${poNumber}`, pageWidth - margin, 22, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tanggal Order: ${formatDateID(new Date().toISOString())}`, pageWidth - margin, 26, { align: 'right' });
  if (poData.deliveryDate) {
    doc.text(`Target Kirim: ${formatDateID(poData.deliveryDate)}`, pageWidth - margin, 30, { align: 'right' });
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 34, pageWidth - margin, 34);

  // Vendor & Delivery Box
  autoTable(doc, {
    head: [['KEPADA SUPPLIER / VENDOR', 'ALAMAT PENGIRIMAN & PENERIMA']],
    body: [
      [
        `Nama Vendor: ${poData.supplierName}\nKontak / WA: ${poData.supplierPhone || '-'}\nStatus: Vendor Resmi Terdaftar`,
        `Toko: ${settings?.storeName || 'MUKI RAMEN'}\nAlamat: ${settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352'}\nPIC Pemesan: ${userName || 'Bagian Purchasing'}`
      ]
    ],
    startY: 38,
    margin: { top: 38, bottom: 20 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 }
  });

  const nextY = (doc as any).lastAutoTable?.finalY || 65;

  // Items Table
  let totalEstimatedCost = 0;
  const tableColumns = ['NO', 'NAMA BAHAN BAKU', 'JUMLAH (QTY)', 'SATUAN', 'EST. HARGA SATUAN', 'SUBTOTAL (RP)'];
  const tableRows = poData.items.map((item, idx) => {
    const subtotal = (item.qty || 0) * (item.estimatedPrice || 0);
    totalEstimatedCost += subtotal;
    return [
      idx + 1,
      item.name,
      item.qty.toLocaleString('id-ID'),
      item.unit,
      item.estimatedPrice ? formatCurrency(item.estimatedPrice) : '-',
      subtotal > 0 ? formatCurrency(subtotal) : '-'
    ];
  });

  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    foot: [
      ['', 'TOTAL ESTIMASI ANGGARAN PO', '', '', '', formatCurrency(totalEstimatedCost)]
    ],
    startY: nextY + 6,
    margin: { top: 38, bottom: 20 },
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  // Notes & Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('CATATAN & KETENTUAN PENGIRIMAN:', margin, finalY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(poData.notes || 'Mohon sertakan nota / surat jalan resmi saat pengiriman barang. Pastikan tanggal kadaluarsa bahan masih panjang.', margin, finalY + 12);

  const sigY = finalY + 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  // Left - Purchasing
  doc.text('Dipesan Oleh (Purchasing/Outlet),', margin + 10, sigY);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 10, sigY + 18, margin + 65, sigY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(userName || 'Petugas Purchasing', margin + 10, sigY + 22);

  // Right - Vendor Confirmed
  doc.setFont('helvetica', 'normal');
  doc.text('Diterima & Dikonfirmasi (Supplier),', pageWidth - margin - 65, sigY);
  doc.line(pageWidth - margin - 65, sigY + 18, pageWidth - margin - 10, sigY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(poData.supplierName, pageWidth - margin - 65, sigY + 22);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.text(`Dokumen resmi pesanan pembelian ${settings?.storeName || 'MUKI RAMEN'}. Dicetak otomatis oleh sistem.`, margin, pageHeight - 8);

  doc.save(`Purchase_Order_${poNumber}_${poData.supplierName.replace(/\s+/g, '_')}.pdf`);
};

export const exportShiftSettlementPDF = async (
  settings: VenueSettings,
  shiftData: any,
  cashierName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;

  const formatDateTime = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // 1. Header & Logo
  let nextY = 16;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, nextY, 18, 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text((settings?.storeName || 'MUKI RAMEN').toUpperCase(), margin + 22, nextY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(settings?.address || 'Jl. Lokasi Toko Resmi, Indonesia', margin + 22, nextY + 11);
      doc.text(`Telp/WA: ${settings?.phone || '-'} | Sistem Kasir POS`, margin + 22, nextY + 15);
      nextY += 24;
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text((settings?.storeName || 'MUKI RAMEN').toUpperCase(), margin, nextY + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${settings?.address || 'Lokasi Toko'} | Telp: ${settings?.phone || '-'}`, margin, nextY + 9);
      nextY += 15;
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text((settings?.storeName || 'MUKI RAMEN').toUpperCase(), margin, nextY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${settings?.address || 'Lokasi Toko'} | Telp: ${settings?.phone || '-'}`, margin, nextY + 9);
    nextY += 15;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, nextY, pageWidth - margin, nextY);
  nextY += 6;

  // Title Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, nextY, pageWidth - (margin * 2), 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('BERITA ACARA SERAH TERIMA & PENUTUPAN SHIFT KASIR', margin + 4, nextY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`ID Shift: #${shiftData.id || '-'} | Kasir: ${cashierName || shiftData.user?.name || 'Kasir'} | Dicetak: ${new Date().toLocaleString('id-ID')}`, margin + 4, nextY + 12);
  nextY += 21;

  // Shift Meta Info Box
  const colW = (pageWidth - (margin * 2)) / 2;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, nextY, pageWidth - (margin * 2), 16, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, nextY, pageWidth - (margin * 2), 16, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('WAKTU BUKA SHIFT:', margin + 4, nextY + 5.5);
  doc.text('WAKTU TUTUP SHIFT:', margin + colW + 4, nextY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateTime(shiftData.waktuBuka), margin + 4, nextY + 11.5);
  doc.text(formatDateTime(shiftData.waktuTutup || new Date().toISOString()), margin + colW + 4, nextY + 11.5);
  nextY += 21;

  // Financial Summary Table
  const saldoAwal = shiftData.saldoAwal || 0;
  const voidCount = shiftData.voidCount || 0;
  const voidCashTotal = shiftData.voidCashTotal || 0;
  const manualCashIn = shiftData.manualCashIn || 0;
  const manualCashOut = shiftData.manualCashOut || 0;
  const cashDebtIncome = shiftData.cashDebtIncome || 0;
  const nonCashSales = shiftData.nonCashSales || 0;

  // Resilient fallback jika shiftData belum di-enrich oleh backend API
  const cashSales = shiftData.cashSales !== undefined 
    ? shiftData.cashSales 
    : (shiftData.saldoSistem !== undefined ? Math.max(0, shiftData.saldoSistem - saldoAwal - manualCashIn - cashDebtIncome + manualCashOut) : 0);

  const saldoSistem = shiftData.saldoSistem !== undefined ? shiftData.saldoSistem : (saldoAwal + cashSales + cashDebtIncome + manualCashIn - manualCashOut);
  const saldoFisikLaci = shiftData.saldoFisikLaci !== undefined ? shiftData.saldoFisikLaci : 0;
  const selisih = shiftData.selisih !== undefined ? shiftData.selisih : (saldoFisikLaci - saldoSistem);

  const tableRows = [
    ['1', 'Modal Awal Kasir (Starting Float Laci)', 'Kas Awal', formatCurrency(saldoAwal)],
    ['2', 'Total Penjualan Tunai (Cash)', 'Omset Tunai (+)', formatCurrency(cashSales)],
    ['3', 'Total Penjualan Non-Tunai (QRIS / EDC / Transfer)', 'Elektronik (Bank)', formatCurrency(nonCashSales)],
    ['4', `Transaksi Batal / Void (${voidCount} Order)`, 'Info Pengawasan', voidCashTotal > 0 ? formatCurrency(voidCashTotal) : 'Rp 0'],
    ['5', 'Pemasukan Kas Manual (Petty Cash In)', 'Kas Masuk (+)', formatCurrency(manualCashIn)],
    ['6', 'Pengeluaran Kas Manual (Petty Cash Out)', 'Kas Keluar (-)', manualCashOut > 0 ? `-${formatCurrency(manualCashOut)}` : 'Rp 0'],
    ['7', 'Pelunasan Piutang Kas (Debt Collection)', 'Kas Masuk (+)', formatCurrency(cashDebtIncome)],
    ['8', 'TOTAL SALDO KAS SISTEM (Ekspektasi Uang Laci)', 'Saldo Sistem', formatCurrency(saldoSistem)],
    ['9', 'UANG KAS FISIK DIHITUNG DI LACI (Actual Cash)', 'Fisik Laci', formatCurrency(saldoFisikLaci)],
    ['10', 'SELISIH KAS (VARIANCE / DISCREPANCY)', selisih === 0 ? 'STATUS: PAS (BALANCE)' : selisih < 0 ? 'STATUS: KURANG (SHORT)' : 'STATUS: LEBIH (OVER)', formatCurrency(selisih)]
  ];

  autoTable(doc, {
    head: [['No', 'Komponen Finansial Shift', 'Kategori', 'Nominal']],
    body: tableRows,
    startY: nextY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold' },
      2: { halign: 'center', fontStyle: 'normal' },
      3: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const rowIdx = hookData.row.index;
        if (rowIdx === 7) {
          hookData.cell.styles.fillColor = [238, 242, 255]; // Indigo light
          hookData.cell.styles.textColor = [67, 56, 202];
          hookData.cell.styles.fontStyle = 'bold';
        }
        if (rowIdx === 8) {
          hookData.cell.styles.fillColor = [240, 253, 244]; // Green light
          hookData.cell.styles.textColor = [22, 101, 52];
          hookData.cell.styles.fontStyle = 'bold';
        }
        if (rowIdx === 9) {
          if (selisih === 0) {
            hookData.cell.styles.fillColor = [240, 253, 244];
            hookData.cell.styles.textColor = [22, 101, 52];
          } else if (selisih < 0) {
            hookData.cell.styles.fillColor = [254, 242, 242];
            hookData.cell.styles.textColor = [153, 27, 27];
          } else {
            hookData.cell.styles.fillColor = [254, 252, 232];
            hookData.cell.styles.textColor = [133, 77, 14];
          }
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 180;

  // Catatan Rekonsiliasi & Tanda Tangan
  const sigY = finalY + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  // Left - Kasir Bertugas
  doc.text('Diserahkan Oleh (Kasir Bertugas),', margin + 12, sigY);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 12, sigY + 18, margin + 65, sigY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(cashierName || shiftData.user?.name || 'Kasir', margin + 12, sigY + 22);

  // Right - Supervisor / Manager
  doc.setFont('helvetica', 'normal');
  doc.text('Diterima & Diverifikasi (Supervisor/Manager),', pageWidth - margin - 75, sigY);
  doc.line(pageWidth - margin - 75, sigY + 18, pageWidth - margin - 12, sigY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text('Supervisor / Store Lead', pageWidth - margin - 75, sigY + 22);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.text(`Dokumen resmi serah terima kasir ${settings?.storeName || 'MUKI RAMEN'}. Diotorisasi dan diarsip untuk rekonsiliasi audit keuangan.`, margin, pageHeight - 8);

  doc.save(`Shift_Settlement_Shift${shiftData.id || Date.now()}_${(cashierName || 'Kasir').replace(/\s+/g, '_')}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. RAPOR EVALUASI KINERJA KARYAWAN (INDIVIDUAL EMPLOYEE APPRAISAL)
// ─────────────────────────────────────────────────────────────────────────────
export const exportIndividualAppraisalPDF = async (
  settings: VenueSettings,
  summary: any,
  monthStr?: string,
  reviewerName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;
  const currentTitle = 'RAPOR EVALUASI KINERJA KARYAWAN (KPI APPRAISAL)';

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(79, 70, 229); // Indigo 600
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '-'}`, textXOffset, 25);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(9.5);
    pdfDoc.setTextColor(79, 70, 229);
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode Evaluasi: ${monthStr || 'Bulan Berjalan'}`, pageWidth - margin, 21, { align: 'right' });
    pdfDoc.text(`Penilai: ${reviewerName || 'Owner / Management'}`, pageWidth - margin, 25, { align: 'right' });
    pdfDoc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 29, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 33, pageWidth - margin, 33);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text(
      `Dokumen Resmi Evaluasi Kinerja Karyawan ${settings?.storeName || 'MUKI RAMEN'} — Rahasia & Terarsip HRD.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  addHeader(doc);

  let nextY = 38;

  // 1. Profil Karyawan & Scorecard KPI Box
  const u = summary?.user || {};
  const kpi = summary?.kpi || { score: 85, grade: 'B', label: 'Baik & Disiplin' };
  const stats = summary?.stats || {};
  const discipline = summary?.discipline || {};
  const cashier = summary?.cashierStats || {};
  const kitchen = summary?.kitchenStats || {};

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, nextY, pageWidth - (margin * 2), 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, nextY, pageWidth - (margin * 2), 22, 2, 2, 'S');

  // Left side - User Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(u.name || 'Nama Karyawan', margin + 5, nextY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Posisi / Jabatan: ${u.role || 'Staf'}  |  Username: @${u.username || '-'}  |  Status: ${u.status || 'Aktif'}`, margin + 5, nextY + 12);
  doc.text(`Total Kehadiran Kerja: ${stats.totalHadir || 0} Hari (${stats.totalWorkHours || 0} Total Jam Kerja)`, margin + 5, nextY + 17);

  // Right side - KPI Badge Card
  const badgeW = 48;
  const badgeX = pageWidth - margin - badgeW - 4;
  const gradeColor = kpi.grade === 'A' ? [16, 185, 129] : kpi.grade === 'B' ? [79, 70, 229] : kpi.grade === 'C' ? [217, 119, 6] : [225, 29, 72];
  
  doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
  doc.roundedRect(badgeX, nextY + 3, badgeW, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SKOR KPI KESELURUHAN', badgeX + (badgeW / 2), nextY + 7.5, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`${kpi.score}/100 (GRADE ${kpi.grade})`, badgeX + (badgeW / 2), nextY + 14, { align: 'center' });

  nextY += 27;

  // 2. Tiga Tabel Evaluasi Pilar Kinerja
  // PILAR 1: Presensi & Kedisiplinan Waktu
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('1. PILAR KEDISIPLINAN & PRESENSI KERJA (HR ATTENDANCE)', margin, nextY + 4);

  const attendanceRows = [
    ['Total Kehadiran (Hari Masuk)', `${stats.totalHadir || 0} Hari`, 'Status Reward Zero Late', discipline.zeroLateStatus === 'ELIGIBLE' ? 'TERCAPAI (BONUS)' : discipline.zeroLateStatus === 'ON_TRACK' ? 'ON TRACK' : 'TIDAK ELIGIBLE'],
    ['Keterlambatan (Frekuensi & Durasi)', `${stats.totalTerlambat || 0} Kali (${stats.totalLateMinutes || 0} Menit)`, 'Nominal Bonus Zero Late', formatCurrency(discipline.zeroLateBonusEarned || 0)],
    ['Presensi di Luar Radius GPS', `${stats.totalLuarRadius || 0} Kali`, 'Potongan Denda Terlambat', `-${formatCurrency(discipline.totalLatePenalty || 0)}`],
    ['Total Jam Kerja Riil', `${stats.totalWorkHours || 0} Jam`, 'ESTIMASI BERSIH DISIPLIN', formatCurrency(discipline.netDisciplineAmount || 0)]
  ];

  autoTable(doc, {
    head: [['Indikator Kehadiran', 'Capaian Riil', 'Evaluasi Finansial Kedisiplinan', 'Nominal']],
    body: attendanceRows,
    startY: nextY + 7,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { fontStyle: 'bold', cellWidth: 55 },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });

  nextY = (doc as any).lastAutoTable?.finalY + 6;

  // PILAR 2: Integritas & Kinerja Kasir
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('2. PILAR INTEGRITAS & AKURASI FINANSIAL KASIR (CASHIER PERFORMANCE)', margin, nextY + 4);

  const cashierRows = [
    ['Total Shift Kasir Dijalankan', `${cashier.totalShifts || 0} Shift (${cashier.closedShiftsCount || 0} Shift Ditutup)`, 'Akurasi Kas Laci (% Shift Pas)', `${cashier.cashAccuracyRate || 100}% Akurat`],
    ['Total Transaksi Selesai Dilayani', `${cashier.totalOrdersHandled || 0} Transaksi Penjualan`, 'Akumulasi Uang Minus (Shortage)', cashier.totalShortage > 0 ? `-${formatCurrency(cashier.totalShortage)} (TEKOR)` : 'Rp 0 (AMAN)'],
    ['Total Omzet Penjualan Ditangani', formatCurrency(cashier.totalSalesHandled || 0), 'Akumulasi Uang Lebih (Overage)', formatCurrency(cashier.totalOverage || 0)],
    ['Transaksi Batal / Void oleh Kasir', `${cashier.voidCount || 0} Order`, 'Nilai Transaksi Void', formatCurrency(cashier.voidAmount || 0)]
  ];

  autoTable(doc, {
    head: [['Indikator Operasional Kasir', 'Capaian Riil', 'Indikator Audit Keamanan Kas', 'Hasil Audit']],
    body: cashierRows,
    startY: nextY + 7,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { fontStyle: 'bold', cellWidth: 55 },
      3: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        if (hookData.row.index === 1 && cashier.totalShortage > 0 && hookData.column.index === 3) {
          hookData.cell.styles.textColor = [225, 29, 72]; // red
          hookData.cell.styles.fillColor = [254, 242, 242];
        }
      }
    }
  });

  nextY = (doc as any).lastAutoTable?.finalY + 6;

  // PILAR 3: Efisiensi Bahan & Dapur
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. PILAR EFISIENSI & PENGENDALIAN LOSS BAHAN BAKU (KITCHEN & BAR CONTROL)', margin, nextY + 4);

  const kitchenRows = [
    ['Total Insiden Kerusakan Tercatat', `${kitchen.totalLossIncidents || 0} Insiden Rusak/Basi`, 'Loss Akibat Human Error (Masak)', formatCurrency(kitchen.humanErrorLossCost || 0)],
    ['Total Valuasi Kerugian Bahan (Rp)', formatCurrency(kitchen.totalLossCost || 0), 'Loss Akibat Kadaluarsa/Expired', formatCurrency(kitchen.spoilageLossCost || 0)]
  ];

  autoTable(doc, {
    head: [['Indikator Pengendalian Bahan', 'Capaian Riil', 'Klasifikasi Kerugian Dapur', 'Valuasi']],
    body: kitchenRows,
    startY: nextY + 7,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, font: 'helvetica', textColor: [51, 65, 85] },
    headStyles: { fillColor: [190, 18, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { fontStyle: 'bold', cellWidth: 55 },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });

  nextY = (doc as any).lastAutoTable?.finalY + 6;

  // 3. Catatan Evaluasi & Rekomendasi
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, nextY, pageWidth - (margin * 2), 20, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('CATATAN EVALUASI & REKOMENDASI MANAJEMEN / OWNER:', margin + 4, nextY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const evaluationNotes = kpi.score >= 90
    ? `Karyawan menunjukkan performa istimewa (Grade A) dengan tingkat kehadiran disiplin tinggi dan integritas operasional yang sangat baik. Sangat direkomendasikan untuk apresiasi bonus bulanan.`
    : kpi.score >= 75
    ? `Performa kerja baik dan stabil (Grade B). Menjaga kepatuhan SOP dengan baik. Pertahankan ketelitian dan konsistensi jam kerja di bulan mendatang.`
    : kpi.score >= 60
    ? `Performa kerja cukup (Grade C). Perlu evaluasi terkait ${stats.totalTerlambat > 0 ? 'keterlambatan jam kerja' : ''} ${cashier.totalShortage > 0 ? 'dan selisih kas kasir' : ''}. Diperlukan pembinaan SOP.`
    : `Performa kerja di bawah standar (Grade D). Terdapat catatan penting pada ${cashier.totalShortage > 0 ? 'selisih minus kas kasir' : 'kedisiplinan kerja'}. Surat Peringatan (SP) atau sesi konseling 1-on-1 disarankan.`;

  doc.text(doc.splitTextToSize(evaluationNotes, pageWidth - (margin * 2) - 8), margin + 4, nextY + 10);

  nextY += 26;

  // 4. Kolom Tanda Tangan 3 Pihak
  const sigW = (pageWidth - (margin * 2)) / 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);

  // Karyawan
  doc.text('Karyawan Yang Dinilai,', margin + 6, nextY);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 6, nextY + 16, margin + sigW - 6, nextY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(u.name || 'Karyawan', margin + 6, nextY + 20);

  // Supervisor / HR
  doc.setFont('helvetica', 'normal');
  doc.text('Supervisor / HRD,', margin + sigW + 6, nextY);
  doc.line(margin + sigW + 6, nextY + 16, margin + (sigW * 2) - 6, nextY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text('Supervisor Toko / HR', margin + sigW + 6, nextY + 20);

  // Owner / GM
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui (Owner / GM),', margin + (sigW * 2) + 6, nextY);
  doc.line(margin + (sigW * 2) + 6, nextY + 16, pageWidth - margin - 6, nextY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(reviewerName || 'Owner / General Manager', margin + (sigW * 2) + 6, nextY + 20);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Rapor_Kinerja_${(u.name || 'Karyawan').replace(/\s+/g, '_')}_${(monthStr || 'Periode').replace(/\s+/g, '_')}.pdf`);
};

export const exportPettyCashPDF = async (
  cashflows: any[],
  settings: VenueSettings,
  filterInfo: { category?: string; type?: string; searchQuery?: string },
  userName?: string
) => {
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  let logoBase64 = '';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {
      console.warn('Failed to load logo, using fallback', e);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  // Compute metrics
  const totalIn = cashflows.filter(c => c.type === 'Pemasukan').reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const totalOut = cashflows.filter(c => c.type === 'Pengeluaran').reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const netBalance = totalIn - totalOut;
  const inCount = cashflows.filter(c => c.type === 'Pemasukan').length;
  const outCount = cashflows.filter(c => c.type === 'Pengeluaran').length;

  // Determine earliest and latest dates
  let minDate = '';
  let maxDate = '';
  if (cashflows.length > 0) {
    const dates = cashflows.map(c => new Date(c.date).getTime()).filter(t => !isNaN(t));
    if (dates.length > 0) {
      minDate = new Date(Math.min(...dates)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      maxDate = new Date(Math.max(...dates)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  const dateRangeStr = minDate && maxDate ? (minDate === maxDate ? minDate : `${minDate} s/d ${maxDate}`) : 'Semua Periode';

  // 1. Header Callback
  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 15, 15);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(30, 58, 138); // navy
      pdfDoc.rect(margin, 11, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    // Store Details
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Polman, Sulbar 91352', textXOffset, 21);
    pdfDoc.text(`WhatsApp / Telp: ${settings?.phone || '081298765432'}`, textXOffset, 25);

    // Title & Doc Info
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(11);
    pdfDoc.setTextColor(30, 58, 138);
    pdfDoc.text('LAPORAN BUKU KAS & ARUS KAS (PETTY CASH)', pageWidth - margin, 16, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${dateRangeStr}`, pageWidth - margin, 20.5, { align: 'right' });
    pdfDoc.text(`Filter Kategori: ${filterInfo.category || 'Semua'} | Jenis: ${filterInfo.type || 'Semua'}`, pageWidth - margin, 24.5, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Administrator'} | ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 28.5, { align: 'right' });

    // Divider Line
    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 32, pageWidth - margin, 32);
  };

  // 2. Footer Callback
  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    pdfDoc.text(
      `Sistem Akuntansi Kas & Laporan POS ${settings?.storeName || 'MUKI RAMEN'} — Dokumen Keuangan Resmi.`,
      margin,
      pageHeight - 8
    );
    pdfDoc.text(
      `Halaman ${pageNum} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  };

  // 3. Render Executive KPI Summary Cards on First Page
  addHeader(doc);

  let curY = 36;
  const cardGap = 3.5;
  const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4;
  const cardHeight = 18;

  // Card 1: Total Pemasukan (Inflow)
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(margin, curY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('TOTAL KAS MASUK', margin + 3, curY + 5);
  doc.setFontSize(9.5);
  doc.text(`+${formatCurrency(totalIn)}`, margin + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(21, 128, 61);
  doc.text(`${inCount} Transaksi Masuk`, margin + 3, curY + 15.5);

  // Card 2: Total Pengeluaran (Outflow)
  const c2X = margin + cardWidth + cardGap;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(c2X, curY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text('TOTAL KAS KELUAR', c2X + 3, curY + 5);
  doc.setFontSize(9.5);
  doc.text(`-${formatCurrency(totalOut)}`, c2X + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(190, 18, 60);
  doc.text(`${outCount} Transaksi Keluar`, c2X + 3, curY + 15.5);

  // Card 3: Saldo Kas Bersih (Net)
  const c3X = margin + (cardWidth + cardGap) * 2;
  const isSurplus = netBalance >= 0;
  doc.setFillColor(isSurplus ? 239 : 255, isSurplus ? 246 : 241, isSurplus ? 255 : 242);
  doc.setDrawColor(isSurplus ? 191 : 254, isSurplus ? 219 : 205, isSurplus ? 254 : 211);
  doc.roundedRect(c3X, curY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(isSurplus ? 30 : 159, isSurplus ? 58 : 18, isSurplus ? 138 : 57);
  doc.text('SALDO KAS BERSIH', c3X + 3, curY + 5);
  doc.setFontSize(9.5);
  doc.text(formatCurrency(netBalance), c3X + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(isSurplus ? 'Surplus Kas Positif' : 'Defisit Kas Berjalan', c3X + 3, curY + 15.5);

  // Card 4: Total Mutasi / Transaksi
  const c4X = margin + (cardWidth + cardGap) * 3;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(c4X, curY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('TOTAL PERPUTARAN KAS', c4X + 3, curY + 5);
  doc.setFontSize(9.5);
  doc.text(formatCurrency(totalIn + totalOut), c4X + 3, curY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`${cashflows.length} Total Mutasi`, c4X + 3, curY + 15.5);

  curY += cardHeight + 6;

  // 4. Data Table
  const tableColumn = ['NO', 'TANGGAL & WAKTU', 'JENIS', 'KATEGORI UTAMA', 'SUB-KATEGORI', 'KETERANGAN / DESKRIPSI', 'NOMINAL (RP)', 'PIC / KASIR'];
  const tableRows: any[] = [];

  cashflows.forEach((cf, idx) => {
    let main = 'Umum';
    let sub = '-';
    if (cf.category && typeof cf.category === 'string') {
      const parts = cf.category.split(' - ');
      main = parts[0]?.trim() || 'Umum';
      sub = parts.slice(1).join(' - ').trim() || '-';
    }

    const amt = Number(cf.amount) || 0;
    const isIncome = cf.type === 'Pemasukan';
    let dateFmt = '-';
    if (cf.date) {
      try {
        const d = new Date(cf.date);
        dateFmt = `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}\n${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      } catch {
        dateFmt = String(cf.date);
      }
    }

    tableRows.push([
      String(idx + 1),
      dateFmt,
      cf.type || 'Pengeluaran',
      main,
      sub,
      cf.description || '-',
      isIncome ? `+${formatCurrency(amt)}` : `-${formatCurrency(amt)}`,
      cf.user?.name || cf.user?.username || '-'
    ]);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: curY,
    margin: { top: 35, bottom: 20, left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85], overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 24, fontSize: 7 },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 20 }
    },
    didParseCell: (cellData: any) => {
      if (cellData.section === 'body') {
        if (cellData.column.index === 2) {
          const val = cellData.cell.raw;
          if (val === 'Pemasukan') {
            cellData.cell.styles.textColor = [22, 101, 52];
            cellData.cell.styles.fillColor = [240, 253, 244];
          } else {
            cellData.cell.styles.textColor = [159, 18, 57];
            cellData.cell.styles.fillColor = [254, 242, 242];
          }
        }
        if (cellData.column.index === 6) {
          const val = String(cellData.cell.raw || '');
          if (val.startsWith('+')) {
            cellData.cell.styles.textColor = [22, 101, 52];
          } else {
            cellData.cell.styles.textColor = [220, 38, 38];
          }
        }
      }
    }
  });

  let nextY = (doc as any).lastAutoTable?.finalY || 100;

  // 5. Rekonsiliasi & Ringkasan Keuangan Box
  if (nextY + 30 > pageHeight - 35) {
    doc.addPage();
    nextY = 35;
  } else {
    nextY += 6;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, nextY, pageWidth - margin * 2, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('REKONSILIASI AKHIR ARUS KAS (PETTY CASH SUMMARY)', margin + 4, nextY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Penerimaan Kas Operasional & Penjualan (Inflow):', margin + 4, nextY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(`+${formatCurrency(totalIn)}`, margin + 110, nextY + 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Pembelanjaan Kas & Beban Operasional (Outflow):', margin + 4, nextY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text(`-${formatCurrency(totalOut)}`, margin + 110, nextY + 17, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('SALDO AKHIR KAS BERSIH (NET CASH BALANCE):', margin + 4, nextY + 22);
  doc.setTextColor(netBalance >= 0 ? 22 : 220, netBalance >= 0 ? 101 : 38, netBalance >= 0 ? 52 : 38);
  doc.setFontSize(9);
  doc.text(formatCurrency(netBalance), margin + 110, nextY + 22, { align: 'right' });

  // Additional note on right side of summary box
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const infoX = margin + 120;
  doc.text('Status Audit:', infoX, nextY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('TERVERIFIKASI SISTEM POS', infoX + 22, nextY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Metode Pencatatan:', infoX, nextY + 15);
  doc.text('Imprest / Fluktuasi Kas Kecil', infoX + 28, nextY + 15);

  doc.text('Keterangan Dokumen:', infoX, nextY + 20);
  doc.text('Sah sebagai bukti pertanggungjawaban kas.', infoX + 30, nextY + 20);

  // 6. Signature Block
  let sigY = nextY + 34;
  if (sigY + 32 > pageHeight - 15) {
    doc.addPage();
    sigY = 35;
  }

  const sigColWidth = (pageWidth - margin * 2) / 3;
  const roles = [
    { title: 'Dibuat Oleh (Kasir / PIC Kas)', name: userName || 'Petugas Kasir' },
    { title: 'Diperiksa Oleh (Supervisor)', name: 'Supervisor Operasional' },
    { title: 'Disetujui Oleh (Owner / Finance)', name: 'Manajemen / Direksi' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, sigY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, sigY + 5, { align: 'center' });

    // Signature dotted line
    doc.setDrawColor(203, 213, 225);
    doc.line(x + 10, sigY + 22, x + sigColWidth - 10, sigY + 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, sigY + 26, { align: 'center' });
  });

  // 7. Apply Header & Footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      addHeader(doc);
    }
    addFooter(doc, i, totalPages);
  }

  const timestamp = Date.now();
  doc.save(`Laporan_Buku_Kas_${settings?.storeName ? settings.storeName.replace(/\s+/g, '_') : 'MUKI_RAMEN'}_${timestamp}.pdf`);
};

// ─── 8. EXPORT PROFIT SHARING PDF (LAPORAN BAGI HASIL 80:20) ───────────────────

export const exportProfitSharingPDF = async (
  data: any,
  settings: VenueSettings,
  period: { startDate: string; endDate: string },
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {
      console.warn('Failed to load logo', e);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  const food = data?.foodDivision || {};
  const drink = data?.drinkDivision || {};
  const shared = data?.sharedOpex || {};
  const summary = data?.summary || {};
  const config = data?.config || {};
  const daily = data?.dailyBreakdown || [];

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 10, 15, 15);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(234, 88, 12); // Ramen Orange
      pdfDoc.rect(margin, 10, 4, 16, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(13);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 15);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo, Polman, Sulbar', textXOffset, 19.5);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '081298765432'} | Sistem Pembagian Hasil Usaha`, textXOffset, 23.5);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10.5);
    pdfDoc.setTextColor(234, 88, 12);
    pdfDoc.text('LAPORAN BAGI HASIL (PROFIT SHARING)', pageWidth - margin, 15, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${formatDateID(period.startDate)} s/d ${formatDateID(period.endDate)}`, pageWidth - margin, 19.5, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Administrator'} | ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 23.5, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 28, pageWidth - margin, 28);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdfDoc.text(`MUKI RAMEN & MUKI DRINK — Dokumen Perhitungan Resmi Bagi Hasil Usaha`, margin, pageHeight - 6);
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  addHeader(doc);

  let currentY = 32;

  // 1. Executive KPI Summary Cards
  const cardW = (pageWidth - margin * 2 - 8) / 3;
  const cardH = 18;

  // Card 1: Total Omzet
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL OMZET GABUNGAN', margin + 4, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(summary.totalRevenue || 0), margin + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Ramen: ${formatCurrency(food.revenue || 0)} | Drink: ${formatCurrency(drink.revenue || 0)}`, margin + 4, currentY + 16);

  // Card 2: Total Laba Bersih
  const c2X = margin + cardW + 4;
  doc.setFillColor(240, 253, 244); // light emerald
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(c2X, currentY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(22, 101, 52);
  doc.text('TOTAL LABA BERSIH DIBAGIKAN', c2X + 4, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(21, 128, 61);
  doc.text(formatCurrency(summary.totalNetProfit || 0), c2X + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(22, 101, 52);
  doc.text(`Total Beban: ${formatCurrency(summary.totalExpense || 0)}`, c2X + 4, currentY + 16);

  // Card 3: Bagian Owner
  const c3X = c2X + cardW + 4;
  doc.setFillColor(238, 242, 255); // light indigo
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(c3X, currentY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(55, 48, 163);
  doc.text('TOTAL BAGIAN OWNER', c3X + 4, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(67, 56, 202);
  doc.text(formatCurrency(summary.ownerShare || 0), c3X + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(79, 70, 229);
  doc.text(`Ramen: ${food.ownerPct || (100 - (config.ramenPct || 20))}% | Drink: ${drink.ownerPct || (100 - (config.drinkPct || 20))}%`, c3X + 4, currentY + 16);

  currentY += cardH + 5;

  // 2. Executive Split Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('I. REKAPITULASI PEMBAGIAN HASIL (PROFIT SPLIT)', margin, currentY);
  currentY += 2;

  const ramenOwnerPct = food.ownerPct || (100 - (config.ramenPct || 20));
  const drinkOwnerPct = drink.ownerPct || (100 - (config.drinkPct || 20));

  const splitRows = [
    ['Owner (Divisi Ramen)', 'Muki Ramen (Kitchen)', `${ramenOwnerPct}%`, formatCurrency(food.ownerShare || 0), `Hak ${ramenOwnerPct}% dari laba bersih Ramen (${formatCurrency(food.netProfit || 0)})`],
    ['Penanggung Jawab Muki Ramen', 'Muki Ramen (Kitchen)', `${config.ramenPct || 20}%`, formatCurrency(summary.pjRamenShare || 0), `Hak ${config.ramenPct || 20}% dari laba bersih Ramen (${formatCurrency(food.netProfit || 0)})`],
    ['Owner (Divisi Drink)', 'Muki Drink (Bar)', `${drinkOwnerPct}%`, formatCurrency(drink.ownerShare || 0), `Hak ${drinkOwnerPct}% dari laba bersih Drink (${formatCurrency(drink.netProfit || 0)})`],
    ['Penanggung Jawab Muki Drink', 'Muki Drink (Bar)', `${config.drinkPct || 20}%`, formatCurrency(summary.pjDrinkShare || 0), `Hak ${config.drinkPct || 20}% dari laba bersih Drink (${formatCurrency(drink.netProfit || 0)})`]
  ];

  if (summary.other && (summary.other.revenue > 0 || summary.other.finalNet > 0)) {
    splitRows.push([
      'Owner (Produk Netral / Retail)',
      'Air Mineral & Toko',
      '100%',
      formatCurrency(summary.other.ownerShare || summary.other.finalNet || 0),
      `Hak 100% Owner dari laba bersih produk netral (${formatCurrency(summary.other.finalNet || 0)})`
    ]);
  }

  autoTable(doc, {
    startY: currentY + 1,
    margin: { left: margin, right: margin },
    head: [['Entitas Penerima', 'Divisi Usaha', 'Porsi', 'Nominal Diterima (Rp)', 'Dasar Perhitungan']],
    body: splitRows,
    foot: [['TOTAL HASIL DIBAGIKAN', 'Seluruh Divisi', '100%', formatCurrency(summary.totalNetProfit || 0), 'Total laba bersih periode terpilih']],
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 38 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
      4: { fontStyle: 'normal', cellWidth: 'auto' }
    },
    styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 3. Division Comparison Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('II. RINCIAN KINERJA KEUANGAN PER DIVISI', margin, currentY);
  currentY += 2;

  const divRows = [
    ['Total Omzet Penjualan', formatCurrency(food.revenue || 0), formatCurrency(drink.revenue || 0), formatCurrency(summary.totalRevenue || 0)],
    ['Beban Belanja Langsung / HPP', `(${formatCurrency(food.totalExpense || 0)})`, `(${formatCurrency(drink.totalExpense || 0)})`, `(${formatCurrency(summary.totalDirectExpense || 0)})`],
    ['Laba Kotor Divisi', formatCurrency(food.grossProfit || 0), formatCurrency(drink.grossProfit || 0), formatCurrency((food.grossProfit || 0) + (drink.grossProfit || 0))],
    ['Alokasi Beban Bersama (Shared OPEX)', `(${formatCurrency(food.sharedOpexPortion || 0)})`, `(${formatCurrency(drink.sharedOpexPortion || 0)})`, `(${formatCurrency(shared.total || 0)})`],
    ['Laba Bersih Divisi', formatCurrency(food.netProfit || 0), formatCurrency(drink.netProfit || 0), formatCurrency(summary.totalNetProfit || 0)],
    ['Bagian Owner', `${formatCurrency(food.ownerShare || 0)} (${ramenOwnerPct}%)`, `${formatCurrency(drink.ownerShare || 0)} (${drinkOwnerPct}%)`, formatCurrency(summary.ownerShare || 0)],
    ['Bagian Penanggung Jawab (PJ)', `${formatCurrency(food.pjShare || 0)} (${config.ramenPct || 20}%)`, `${formatCurrency(drink.pjShare || 0)} (${config.drinkPct || 20}%)`, formatCurrency((summary.pjRamenShare || 0) + (summary.pjDrinkShare || 0))]
  ];

  autoTable(doc, {
    startY: currentY + 1,
    margin: { left: margin, right: margin },
    head: [['Pos Laporan Keuangan', 'Muki Ramen (Food)', 'Muki Drink (Bar)', 'Total Resto']],
    body: divRows,
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65 },
      1: { halign: 'right', cellWidth: 38 },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
    },
    styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 4. Daily Breakdown Table (if exists)
  if (daily.length > 0) {
    if (currentY + 50 > pageHeight - 35) {
      doc.addPage();
      currentY = 32;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('III. LOG RINCIAN HARIAN BAGI HASIL', margin, currentY);
    currentY += 2;

    const dailyTableRows = daily.map((d: any, idx: number) => [
      idx + 1,
      d.dateLabel || d.date,
      d.dayName || '',
      formatCurrency(d.foodRevenue || 0),
      formatCurrency(d.foodPjShare || 0),
      formatCurrency(d.drinkRevenue || 0),
      formatCurrency(d.drinkPjShare || 0),
      formatCurrency(d.sharedOpex || 0),
      formatCurrency(d.totalOmzet || 0),
      formatCurrency(d.ownerShareTotal || 0)
    ]);

    autoTable(doc, {
      startY: currentY + 1,
      margin: { left: margin, right: margin },
      head: [['No', 'Tgl', 'Hari', 'Omzet Ramen', 'PJ Ramen (20%)', 'Omzet Drink', 'PJ Drink (20%)', 'Shared OPEX', 'Total Omzet', 'Hak Owner']],
      body: dailyTableRows,
      foot: [[
        'TOT',
        '—',
        '—',
        formatCurrency(food.revenue || 0),
        formatCurrency(summary.pjRamenShare || 0),
        formatCurrency(drink.revenue || 0),
        formatCurrency(summary.pjDrinkShare || 0),
        formatCurrency(shared.total || 0),
        formatCurrency(summary.totalRevenue || 0),
        formatCurrency(summary.ownerShare || 0)
      ]],
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 7 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
        9: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
      },
      styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [226, 232, 240], lineWidth: 0.2 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // 5. Signatures Block
  let sigY = currentY + 4;
  if (sigY + 30 > pageHeight - 15) {
    doc.addPage();
    sigY = 35;
  }

  const sigColWidth = (pageWidth - margin * 2) / 3;
  const roles = [
    { title: 'Penanggung Jawab Muki Ramen', name: 'PIC Muki Ramen' },
    { title: 'Penanggung Jawab Muki Drink', name: 'PIC Muki Drink' },
    { title: 'Owner / Pemilik Usaha', name: 'Owner Muki Group' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, sigY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, sigY + 5, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(x + 10, sigY + 20, x + sigColWidth - 10, sigY + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, sigY + 24, { align: 'center' });
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  const timestamp = Date.now();
  doc.save(`Laporan_Bagi_Hasil_Muki_Ramen_${timestamp}.pdf`);
};

// ─── 9. EXPORT DAILY OMZET BONUS MATRIX PDF ───────────────────────────────────

export const exportDailyBonusPDF = async (
  data: any,
  settings: VenueSettings,
  period: { startDate: string; endDate: string },
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {
      console.warn('Failed to load logo', e);
    }
  }

  // Landscape A4 for wide employee matrix table
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width || 297;
  const pageHeight = doc.internal.pageSize.height || 210;
  const margin = 12;

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

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 8, 14, 14);
      textXOffset = margin + 17;
    } else {
      pdfDoc.setFillColor(234, 88, 12);
      pdfDoc.rect(margin, 8, 4, 14, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(12);
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 12);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo, Polman, Sulbar', textXOffset, 16);
    pdfDoc.text(`WhatsApp: ${settings?.phone || '081298765432'} | Sistem Reward Absensi & Bonus Omzet`, textXOffset, 19.5);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10.5);
    pdfDoc.setTextColor(234, 88, 12);
    pdfDoc.text('MATRIKS REWARD ABSENSI & BONUS OMZET HARIAN KARYAWAN', pageWidth - margin, 12, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${formatDateID(period.startDate)} s/d ${formatDateID(period.endDate)}`, pageWidth - margin, 16, { align: 'right' });
    pdfDoc.text(`Dicetak Oleh: ${userName || 'Administrator'} | ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 19.5, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 23, pageWidth - margin, 23);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPages: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(6.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(241, 245, 249);
    pdfDoc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
    pdfDoc.text(`MUKI RAMEN — Dokumen Sah Rekapitulasi Kehadiran & Bonus Omzet Harian Full-Time Crew`, margin, pageHeight - 4.5);
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
  };

  addHeader(doc);

  let currentY = 26;

  // 1. Tier Rules Box (Horizontal concise bar)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text('SKEMA TIER BONUS OMZET:', margin + 3, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  let tierX = margin + 40;
  tiers.forEach((t: any) => {
    const tierText = `>= ${formatCurrency(t.minOmzet)} (+${formatCurrency(t.bonus)}/org)`;
    doc.text(tierText, tierX, currentY + 5);
    tierX += 45;
  });

  currentY += 10;

  // 2. Build Matrix Table Headers
  const tableHeaders = ['No', 'Tanggal', 'Hari', 'Omzet (Rp)', 'Tier Target', 'Bonus Tier'];
  employees.forEach((emp: any) => {
    const tag = emp.employmentType === 'DAILY_WORKER' ? '\n(DW)' : '';
    tableHeaders.push(`${emp.name.toUpperCase()}${tag}`);
  });

  let totalOmzetAllDays = 0;

  const tableBody = days.map((day: any, idx: number) => {
    totalOmzetAllDays += day.grossOmzet || 0;
    const row = [
      idx + 1,
      day.dateLabel || day.date,
      day.dayName || '',
      formatCurrency(day.grossOmzet || 0),
      day.matchedTier ? (day.matchedTier.label || `Tier ${formatCurrency(day.matchedTier.minOmzet)}`) : '—',
      day.tierBonus > 0 ? formatCurrency(day.tierBonus) : 'Rp 0'
    ];

    employees.forEach((emp: any) => {
      const att = day.employeeAttendance ? day.employeeAttendance[emp.id] : null;
      if (att) {
        if (att.bonus > 0) {
          row.push(`+${(att.bonus / 1000)}k`);
        } else {
          row.push(att.displayBadge || att.status || 'LIBUR');
        }
      } else {
        row.push('LIBUR');
      }
    });

    return row;
  });

  // Footer row
  const tableFoot = [
    'TOT',
    '—',
    '—',
    formatCurrency(totalOmzetAllDays),
    '—',
    '—'
  ];

  employees.forEach((emp: any) => {
    const summary = employeeSummaries.find((s: any) => s.userId === emp.id);
    tableFoot.push(formatCurrency(summary?.totalBonus || 0));
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [tableHeaders],
    body: tableBody,
    foot: [tableFoot],
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 18 }
    },
    styles: { fontSize: 5.5, cellPadding: 1.2, lineColor: [226, 232, 240], lineWidth: 0.2, halign: 'center' }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 3. Employee Summary Table
  if (currentY + 30 > pageHeight - 30) {
    doc.addPage();
    currentY = 26;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('REKAPITULASI TOTAL BONUS OMZET PER KARYAWAN', margin, currentY);
  currentY += 2;

  const empSummaryRows = employeeSummaries.map((s: any, idx: number) => [
    idx + 1,
    s.name,
    s.role,
    s.employmentType === 'DAILY_WORKER' ? 'Daily Worker (DW)' : 'Full Time',
    s.presentCount || 0,
    s.lateCount || 0,
    s.offCount || 0,
    s.leaveCount || 0,
    formatCurrency(s.totalBonus || 0)
  ]);

  autoTable(doc, {
    startY: currentY + 1,
    margin: { left: margin, right: margin },
    head: [['No', 'Nama Karyawan', 'Jabatan', 'Status', 'Hadir', 'Telat', 'Libur', 'Izin/Sakit', 'Total Bonus Diterima']],
    body: empSummaryRows,
    foot: [['TOTAL', '—', '—', '—', '—', '—', '—', '—', formatCurrency(totalBonusAll)]],
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 45 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 15 },
      6: { halign: 'center', cellWidth: 15 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
    },
    styles: { fontSize: 6, cellPadding: 1.5, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 4. Signatures Block
  let sigY = currentY + 4;
  if (sigY + 25 > pageHeight - 10) {
    doc.addPage();
    sigY = 28;
  }

  const sigColWidth = (pageWidth - margin * 2) / 3;
  const roles = [
    { title: 'Dibuat Oleh (Admin / Kasir)', name: userName || 'Petugas Kasir' },
    { title: 'Diterima Perwakilan Karyawan', name: 'Perwakilan Tim Staff' },
    { title: 'Disetujui Oleh (Owner)', name: 'Owner Muki Ramen' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, sigY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, sigY + 4, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(x + 15, sigY + 16, x + sigColWidth - 15, sigY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, sigY + 19.5, { align: 'center' });
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  const timestamp = Date.now();
  doc.save(`Matriks_Bonus_Omzet_Muki_Ramen_${timestamp}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 19. LAPORAN REKAPITULASI STOK & VALUASI ASET GUDANG (WAREHOUSE STOCK PDF)
// ─────────────────────────────────────────────────────────────────────────────
export const exportWarehouseStockPDF = async (
  stockList: any[],
  settings: VenueSettings,
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 12;

  const totalItems = stockList.length;
  const totalAssetValue = stockList.reduce((acc, item) => {
    return acc + (Number(item.warehouseStock || 0) * Number(item.buyPrice || 0));
  }, 0);

  const addHeader = (pdfDoc: jsPDF) => {
    if (logoBase64) {
      try {
        pdfDoc.addImage(logoBase64, 'PNG', margin, 10, 18, 18);
      } catch (e) {}
    }
    const textStartX = logoBase64 ? margin + 22 : margin;
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textStartX, 15);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo, Polman', textStartX, 19.5);
    pdfDoc.text(`Telepon / WA: ${settings?.phone || '0812-9876-5432'} • Central Warehouse Unit`, textStartX, 23.5);

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 30, pageWidth - margin, 30);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPg: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(6.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdfDoc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} • Operator: ${userName || 'Admin Gudang'}`, margin, pageHeight - 6.5);
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPg}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  };

  addHeader(doc);

  // Title Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 33, pageWidth - margin * 2, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('LAPORAN REKAPITULASI STOK & VALUASI ASET GUDANG PUSAT', margin + 4, 39);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Bahan Baku: ${totalItems} Item  •  Total Valuasi Aset Gudang: ${formatCurrency(totalAssetValue)}`, margin + 4, 46);

  // KPI Summary Cards
  const cardY = 54;
  const cardW = (pageWidth - margin * 2 - 6) / 2;

  // Card 1
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, cardY, cardW, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 64, 175);
  doc.text('TOTAL ITEM BAHAN BAKU AKTIF', margin + 4, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${totalItems} Macam Bahan`, margin + 4, cardY + 10.5);

  // Card 2
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin + cardW + 6, cardY, cardW, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(6, 95, 70);
  doc.text('TOTAL NILAI MODAL / ASET FISIK GUDANG', margin + cardW + 10, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(formatCurrency(totalAssetValue), margin + cardW + 10, cardY + 10.5);

  // Table Data
  const tableData = stockList.map((item, idx) => {
    const ratio = item.conversionRatio || 1;
    const pUnit = item.purchaseUnit || 'Grosir';
    const conversionStr = ratio > 1 ? `1 ${pUnit} = ${ratio} ${item.unit}` : `1:1 (${item.unit})`;
    const subtotalAsset = Number(item.warehouseStock || 0) * Number(item.buyPrice || 0);

    return [
      (idx + 1).toString(),
      item.name + (item.supplier?.name ? `\n(Supplier: ${item.supplier.name})` : ''),
      item.category || 'FOOD',
      conversionStr,
      `${Number(item.warehouseStock || 0).toLocaleString('id-ID')} ${item.unit}`,
      `${Number(item.stock || 0).toLocaleString('id-ID')} ${item.unit}`,
      formatCurrency(item.buyPrice || 0),
      formatCurrency(subtotalAsset)
    ];
  });

  autoTable(doc, {
    startY: 72,
    margin: { left: margin, right: margin, bottom: 35 },
    head: [['NO', 'NAMA BAHAN BAKU', 'KATEGORI', 'KONVERSI', 'STOK GUDANG', 'STOK DAPUR', 'HPP/UNIT', 'VALUASI ASET']],
    body: tableData,
    foot: [['TOTAL', '', '', '', '', '', '', formatCurrency(totalAssetValue)]],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 46 },
      2: { halign: 'center', cellWidth: 18 },
      3: { cellWidth: 26 },
      4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
    },
    styles: { fontSize: 6, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;
  if (currentY + 30 > pageHeight - 12) {
    doc.addPage();
    currentY = 32;
  }

  // Signatures
  const sigColWidth = (pageWidth - margin * 2) / 3;
  const roles = [
    { title: 'Kepala Bagian Gudang', name: userName || 'Petugas Gudang' },
    { title: 'Supervisor Operasional', name: 'Supervisor Toko' },
    { title: 'Disetujui Oleh (Owner)', name: 'Owner Muki Ramen' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, currentY, { align: 'center' });
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, currentY + 4, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(x + 12, currentY + 16, x + sigColWidth - 12, currentY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, currentY + 19.5, { align: 'center' });
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Stok_Gudang_Muki_Ramen_${Date.now()}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 20. LAPORAN REKAP PENERIMAAN PASOKAN / INBOUND (INBOUND GOODS PDF)
// ─────────────────────────────────────────────────────────────────────────────
export const exportWarehouseInboundPDF = async (
  inbounds: any[],
  settings: VenueSettings,
  userName?: string,
  periodText?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 12;

  const totalAmount = inbounds.reduce((acc, inb) => acc + (inb.totalAmount || 0), 0);
  const totalOwnerFund = inbounds.filter(inb => inb.paymentSource === 'DANA_PRIBADI_OWNER').reduce((acc, inb) => acc + (inb.totalAmount || 0), 0);
  const totalBranchFund = inbounds.filter(inb => inb.paymentSource !== 'DANA_PRIBADI_OWNER').reduce((acc, inb) => acc + (inb.totalAmount || 0), 0);

  const addHeader = (pdfDoc: jsPDF) => {
    if (logoBase64) {
      try {
        pdfDoc.addImage(logoBase64, 'PNG', margin, 10, 18, 18);
      } catch (e) {}
    }
    const textStartX = logoBase64 ? margin + 22 : margin;
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textStartX, 15);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo, Polman', textStartX, 19.5);
    pdfDoc.text(`Telepon / WA: ${settings?.phone || '0812-9876-5432'} • Inbound Logistics Report`, textStartX, 23.5);

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 30, pageWidth - margin, 30);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPg: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(6.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdfDoc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} • Operator: ${userName || 'Admin'}`, margin, pageHeight - 6.5);
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPg}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  };

  addHeader(doc);

  // Title Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 33, pageWidth - margin * 2, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('LAPORAN REKAPITULASI PENERIMAAN PASOKAN GUDANG', margin + 4, 39);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${periodText || 'Semua Waktu'}  •  Total Pengadaan: ${inbounds.length} Faktur`, margin + 4, 46);

  // KPI Summary
  const cardY = 54;
  const cardW = (pageWidth - margin * 2 - 6) / 2;

  // Card 1
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, cardY, cardW, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 64, 175);
  doc.text('TOTAL TALANGAN OWNER / MODAL PUSAT', margin + 4, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(formatCurrency(totalOwnerFund), margin + 4, cardY + 10.5);

  // Card 2
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin + cardW + 6, cardY, cardW, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(6, 95, 70);
  doc.text('TOTAL PENGADAAN KAS RESTORAN / LAINNYA', margin + cardW + 10, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(formatCurrency(totalBranchFund), margin + cardW + 10, cardY + 10.5);

  const tableData = inbounds.map((inb, idx) => {
    const dStr = inb.date ? new Date(inb.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    const sourceStr = inb.paymentSource === 'DANA_PRIBADI_OWNER' ? 'Talangan Owner' : 'Kas Resto';
    const itemsSummary = inb.items?.map((it: any) => `${it.ingredient?.name || it.itemName} (${it.purchaseQty} ${it.purchaseUnit})`).join(', ') || '-';

    return [
      (idx + 1).toString(),
      inb.invoiceNumber || '-',
      dStr,
      inb.supplier?.name || inb.supplierName || 'Supplier Umum',
      sourceStr,
      itemsSummary,
      formatCurrency(inb.totalAmount || 0)
    ];
  });

  autoTable(doc, {
    startY: 72,
    margin: { left: margin, right: margin, bottom: 35 },
    head: [['NO', 'NO. INVOICE', 'TANGGAL', 'SUPPLIER', 'SUMBER DANA', 'RINCIAN ITEM PASOKAN', 'TOTAL BELANJA']],
    body: tableData,
    foot: [['TOTAL', '', '', '', '', '', formatCurrency(totalAmount)]],
    headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 6.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 20 },
      3: { cellWidth: 26 },
      4: { halign: 'center', cellWidth: 22 },
      5: { cellWidth: 56 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
    },
    styles: { fontSize: 6, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;
  if (currentY + 30 > pageHeight - 12) {
    doc.addPage();
    currentY = 32;
  }

  const sigColWidth = (pageWidth - margin * 2) / 2;
  const roles = [
    { title: 'Petugas Penerima Pasokan', name: userName || 'Petugas Gudang' },
    { title: 'Owner / Verifikator Keuangan', name: 'Owner Muki Ramen' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, currentY, { align: 'center' });
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, currentY + 4, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(x + 20, currentY + 16, x + sigColWidth - 20, currentY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, currentY + 19.5, { align: 'center' });
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Rekap_Penerimaan_Pasokan_${Date.now()}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 21. LAPORAN REKONSILIASI MODAL TALANGAN OWNER & SETTLEMENT CABANG
// ─────────────────────────────────────────────────────────────────────────────
export const exportWarehouseSettlementPDF = async (
  financeData: any,
  settings: VenueSettings,
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {}
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 12;

  const totalCapitalIn = financeData?.summary?.totalCapitalIn || 0;
  const totalTransferredToResto = financeData?.summary?.totalTransferredToResto || 0;
  const totalReimbursedToOwner = financeData?.summary?.totalReimbursedToOwner || 0;
  const currentOwnerPayable = Math.max(0, totalTransferredToResto - totalReimbursedToOwner);
  const transactions = financeData?.transactions || [];

  const addHeader = (pdfDoc: jsPDF) => {
    if (logoBase64) {
      try {
        pdfDoc.addImage(logoBase64, 'PNG', margin, 10, 18, 18);
      } catch (e) {}
    }
    const textStartX = logoBase64 ? margin + 22 : margin;
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(14);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textStartX, 15);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Kesadaran No. 3, Sidorejo, Wonomulyo, Polman', textStartX, 19.5);
    pdfDoc.text(`Telepon / WA: ${settings?.phone || '0812-9876-5432'} • Owner Financial Settlement Report`, textStartX, 23.5);

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 30, pageWidth - margin, 30);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalPg: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(6.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdfDoc.text(`Dokumen Resmi Rekonsiliasi Modal • Dicetak: ${new Date().toLocaleString('id-ID')} • Operator: ${userName || 'Admin'}`, margin, pageHeight - 6.5);
    pdfDoc.text(`Halaman ${pageNum} dari ${totalPg}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  };

  addHeader(doc);

  // Title Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 33, pageWidth - margin * 2, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('LAPORAN REKONSILIASI MODAL TALANGAN OWNER & SETTLEMENT', margin + 4, 39);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Rekapitulasi Pengadaan Bahan Baku & Pemisahan Arus Kas Outlet MUKI RAMEN', margin + 4, 46);

  // 4 Financial Metric Cards
  const cardY = 54;
  const cardW = (pageWidth - margin * 2 - 9) / 4;

  // Card 1: Total Talangan Masuk
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, cardY, cardW, 17, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(30, 64, 175);
  doc.text('TOTAL TALANGAN OWNER', margin + 2.5, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(formatCurrency(totalCapitalIn), margin + 2.5, cardY + 12);

  // Card 2: Didistribusikan ke Dapur
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(221, 214, 254);
  doc.roundedRect(margin + cardW + 3, cardY, cardW, 17, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(109, 40, 217);
  doc.text('DIPAKAI DAPUR CABANG', margin + cardW + 5.5, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(formatCurrency(totalTransferredToResto), margin + cardW + 5.5, cardY + 12);

  // Card 3: Telah Di-Reimburse
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin + (cardW + 3) * 2, cardY, cardW, 17, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(6, 95, 70);
  doc.text('TELAH DI-REIMBURSE', margin + (cardW + 3) * 2 + 2.5, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(formatCurrency(totalReimbursedToOwner), margin + (cardW + 3) * 2 + 2.5, cardY + 12);

  // Card 4: Sisa Kewajiban Settlement
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(margin + (cardW + 3) * 3, cardY, cardW, 17, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(146, 64, 14);
  doc.text('SISA KEWAJIBAN CABANG', margin + (cardW + 3) * 3 + 2.5, cardY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text(formatCurrency(currentOwnerPayable), margin + (cardW + 3) * 3 + 2.5, cardY + 12);

  // Ledger Table
  const tableData = transactions.map((t: any, idx: number) => {
    const dStr = t.date ? new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    let typeBadge = 'Mutasi';
    if (t.type === 'CAPITAL_IN') typeBadge = 'Talangan Owner (+)';
    else if (t.type === 'TRANSFER_TO_RESTO') typeBadge = 'Distribusi Dapur';
    else if (t.type === 'REIMBURSEMENT_PAID') typeBadge = 'Settlement Lunas (-)';

    return [
      (idx + 1).toString(),
      dStr,
      typeBadge,
      t.referenceId || '-',
      t.description || '-',
      t.user?.name || 'Admin',
      formatCurrency(t.amount || 0)
    ];
  });

  autoTable(doc, {
    startY: 76,
    margin: { left: margin, right: margin, bottom: 35 },
    head: [['NO', 'TANGGAL & WAKTU', 'TIPE MUTASI', 'NO. REFERENSI', 'KETERANGAN TRANSAKSI', 'PETUGAS', 'NOMINAL (RP)']],
    body: tableData,
    headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 22 },
      4: { cellWidth: 54 },
      5: { cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
    },
    styles: { fontSize: 6, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;
  if (currentY + 30 > pageHeight - 12) {
    doc.addPage();
    currentY = 32;
  }

  const sigColWidth = (pageWidth - margin * 2) / 3;
  const roles = [
    { title: 'Penanggung Jawab Outlet', name: userName || 'Store Lead Muki' },
    { title: 'Bagian Keuangan / Kasir', name: 'Finance / Kasir' },
    { title: 'Penerima Settlement (Owner)', name: 'Owner Muki Ramen' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, currentY, { align: 'center' });
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, currentY + 4, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(x + 12, currentY + 16, x + sigColWidth - 12, currentY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, currentY + 19.5, { align: 'center' });
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Settlement_Modal_Owner_${Date.now()}.pdf`);
};

export const exportYieldVarianceAuditPDF = async (
  settings: VenueSettings,
  yieldData: any,
  startDate: string,
  endDate: string,
  userName?: string
) => {
  let logoBase64 = '';
  const logoSrc = settings?.logoUrl || '/logo-muki-ramen.png';
  if (logoSrc) {
    try {
      logoBase64 = await getImageDataUrl(logoSrc);
    } catch (e) {
      console.warn('Failed to load logo, using fallback', e);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  const addHeader = (pdfDoc: jsPDF) => {
    let textXOffset = margin;
    if (logoBase64) {
      pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } else {
      pdfDoc.setFillColor(79, 70, 229); // #4f46e5 Indigo
      pdfDoc.rect(margin, 12, 4, 18, 'F');
      textXOffset = margin + 7;
    }

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(13);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(settings?.storeName || 'MUKI RAMEN', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Jl. Barito II No. 18, Kebayoran Baru, Jakarta Selatan', textXOffset, 20.5);
    pdfDoc.text(`Telp: ${settings?.phone || '0812-9988-7766'} | Sistem POS Muki Japanese Ramen`, textXOffset, 24.5);

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(79, 70, 229);
    pdfDoc.text('AUDIT TINGKAT KEBERHASILAN & YIELD PORSI', pageWidth - margin, 16, { align: 'right' });

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(`Periode: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`, pageWidth - margin, 20.5, { align: 'right' });
    pdfDoc.text(`Dicetak: ${new Date().toLocaleString('id-ID')} | Oleh: ${userName || 'Auditor'}`, pageWidth - margin, 24.5, { align: 'right' });

    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin, 30, pageWidth - margin, 30);
  };

  const addFooter = (pdfDoc: jsPDF, pageNum: number, totalP: number) => {
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.setDrawColor(226, 232, 240);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdfDoc.text('Dokumen Rahasia - Laporan Evaluasi Takaran SOP Dapur & Barista Restoran Muki Ramen', margin, pageHeight - 7);
    pdfDoc.text(`Halaman ${pageNum} dari ${totalP}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  };

  addHeader(doc);

  const summary = yieldData?.summary || {};
  const items = yieldData?.items || [];

  // Summary KPI Cards Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 34, pageWidth - margin * 2, 24, 2.5, 2.5, 'FD');

  const colW = (pageWidth - margin * 2) / 4;

  // KPI 1: Rata-Rata Efisiensi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SKOR EFISIENSI TOKO', margin + colW * 0 + 4, 39);
  doc.setFontSize(13);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`${summary.storeEfficiencyRate || 100}%`, margin + colW * 0 + 4, 46);
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Akurasi Pembobotan Nilai', margin + colW * 0 + 4, 52);

  // KPI 2: Total Miss Porsi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PORSI MISS / LOSS', margin + colW * 1 + 4, 39);
  doc.setFontSize(13);
  doc.setTextColor(225, 29, 72); // Rose
  doc.text(`${summary.totalMissPortions || 0} Porsi`, margin + colW * 1 + 4, 46);
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Setara porsi yang terbuang', margin + colW * 1 + 4, 52);

  // KPI 3: Estimasi Kerugian Rupiah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NILAI SELISIH BAHAN (RP)', margin + colW * 2 + 4, 39);
  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6); // Amber
  doc.text(formatCurrency(summary.totalVarianceCost || 0), margin + colW * 2 + 4, 46);
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Total nilai modal variance', margin + colW * 2 + 4, 52);

  // KPI 4: Status Bahan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('KONDISI ITEM BAHAN', margin + colW * 3 + 4, 39);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.perfectCount || 0} Presisi | ${summary.criticalCount || 0} Boros`, margin + colW * 3 + 4, 46);
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dari ${summary.totalActiveIngredients || items.length} Bahan Aktif`, margin + colW * 3 + 4, 52);

  // Table Data
  const tableData = items.map((it: any, idx: number) => {
    const theoStr = `${(it.theoreticalQty || 0).toLocaleString('id-ID')} ${it.unit}`;
    const actStr = `${(it.actualQty || 0).toLocaleString('id-ID')} ${it.unit}`;
    const varStr = it.varianceQty > 0 
      ? `+${it.varianceQty.toLocaleString('id-ID')} ${it.unit} (${it.missPortions > 0 ? `+${it.missPortions} porsi` : ''})`
      : it.varianceQty < 0
      ? `${it.varianceQty.toLocaleString('id-ID')} ${it.unit}`
      : '0 (Pas)';

    return [
      (idx + 1).toString(),
      it.name,
      it.category === 'DRINK' ? 'Bar (Drink)' : it.category === 'FOOD' ? 'Dapur (Food)' : 'Kemasan',
      theoStr,
      actStr,
      varStr,
      formatCurrency(it.varianceCost > 0 ? it.varianceCost : 0),
      `${it.efficiencyRate}%`,
      it.status
    ];
  });

  autoTable(doc, {
    startY: 62,
    margin: { left: margin, right: margin, bottom: 35 },
    head: [['NO', 'NAMA BAHAN BAKU', 'AREA', 'TARGET TEORI', 'REALITA FISIK', 'SELISIH (MISS)', 'KERUGIAN (RP)', 'EFISIENSI', 'DIAGNOSIS STATUS']],
    body: tableData,
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { cellWidth: 34, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      8: { cellWidth: 'auto', fontSize: 5.5 }
    },
    styles: { fontSize: 6, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.2 }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;
  if (currentY + 30 > pageHeight - 12) {
    doc.addPage();
    currentY = 32;
  }

  const sigColWidth = (pageWidth - margin * 2) / 3;
  const roles = [
    { title: 'PJ Dapur / Barista Lead', name: 'Kitchen / Bar Lead' },
    { title: 'Supervisor / Auditor', name: userName || 'Store Supervisor' },
    { title: 'Store Manager / Owner', name: 'Management Muki Ramen' }
  ];

  roles.forEach((r, i) => {
    const x = margin + i * sigColWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.title, x + sigColWidth / 2, currentY, { align: 'center' });
    doc.text('Tanggal: ...................................', x + sigColWidth / 2, currentY + 4, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(x + 12, currentY + 16, x + sigColWidth - 12, currentY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${r.name} )`, x + sigColWidth / 2, currentY + 19.5, { align: 'center' });
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addHeader(doc);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Laporan_Audit_Yield_Efisiensi_${Date.now()}.pdf`);
};
