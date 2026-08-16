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
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
    pdfDoc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139); // slate-500
    pdfDoc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
      `Sistem Laporan POS ${settings?.storeName || 'SOL CAFE'} — Dokumen ini sah dan dicatat secara terkomputerisasi.`,
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
    const pl = data.profitLoss || {};
    const tableColumn = ['KETERANGAN AKUN / OPERASIONAL', 'NOMINAL'];
    const tableRows: any[] = [
      ['1. PENDAPATAN OPERASIONAL', ''],
      ['   Penjualan Bersih Kasir (POS)', formatCurrency(pl.salesRevenue)]
    ];

    // Detail Pemasukan Kas Operasional dari Cashflow
    if (pl.otherRevenueBreakdown && Object.keys(pl.otherRevenueBreakdown).length > 0) {
      Object.entries(pl.otherRevenueBreakdown).forEach(([cat, val]) => {
        tableRows.push([`   Pendapatan Lain-lain (${cat})`, formatCurrency(Number(val))]);
      });
    } else if (pl.otherRevenue > 0) {
      tableRows.push(['   Pendapatan Lain-lain (Petty Cash Masuk)', formatCurrency(pl.otherRevenue)]);
    }

    if (pl.shiftOverage > 0) {
      tableRows.push(['   Kelebihan Uang Kasir (Overage)', formatCurrency(pl.shiftOverage)]);
    }

    tableRows.push(['TOTAL PENDAPATAN OPERASIONAL', formatCurrency(pl.operatingRevenue)]);
    tableRows.push(['', '']);
    tableRows.push(['2. HARGA POKOK PENJUALAN (HPP)', '']);
    tableRows.push(['   Beban Pokok Persediaan Bahan Baku (HPP)', `-${formatCurrency(pl.cogs)}`]);
    tableRows.push(['TOTAL BEBAN HPP', `-${formatCurrency(pl.cogs)}`]);
    tableRows.push(['', '']);
    tableRows.push(['LABA KOTOR (GROSS PROFIT)', formatCurrency(pl.grossProfit)]);
    tableRows.push(['', '']);
    tableRows.push(['3. BEBAN OPERASIONAL (OPEX)', '']);

    // Detail Beban Kas Operasional dari Cashflow
    if (pl.opexBreakdown && Object.keys(pl.opexBreakdown).length > 0) {
      Object.entries(pl.opexBreakdown).forEach(([cat, val]) => {
        tableRows.push([`   Beban ${cat}`, `-${formatCurrency(Number(val))}`]);
      });
    } else if (pl.opexAmount > 0) {
      tableRows.push(['   Beban Kas Operasional (Petty Cash Keluar)', `-${formatCurrency(pl.opexAmount)}`]);
    }

    if (pl.shiftShortage > 0) {
      tableRows.push(['   Kekurangan Uang Kasir (Shortage)', `-${formatCurrency(pl.shiftShortage)}`]);
    }

    tableRows.push(['TOTAL BEBAN OPERASIONAL', `-${formatCurrency(pl.operatingExpenses)}`]);
    tableRows.push(['', '']);
    tableRows.push(['LABA BERSIH OPERASIONAL (NET INCOME)', formatCurrency(pl.netIncome)]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } },
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
        if (text.startsWith('LABA BERSIH OPERASIONAL')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fontSize = 9.5;
          cellData.cell.styles.fillColor = [209, 250, 229];
          cellData.cell.styles.textColor = [16, 122, 68];
          cellData.cell.styles.lineColor = [16, 122, 68];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1.5 };
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 2. LAPORAN ARUS KAS (cashflow) ───
  else if (type === 'cashflow') {
    const cf = data.cashFlow || {};
    const tableColumn = ['AKTIVITAS ARUS KAS / KETERANGAN', 'NOMINAL'];
    const tableRows = [
      ['ARUS KAS MASUK (INFLOW)', ''],
      ['   Penerimaan Uang dari Pelanggan (Omzet POS)', formatCurrency(cf.inflow?.salesReceipts)],
      ['   Penerimaan Petty Cash', formatCurrency(cf.inflow?.otherReceipts)],
      ['   Akumulasi Kelebihan Uang Laci Shift (Overage)', formatCurrency(cf.inflow?.overages)],
      ['TOTAL KAS MASUK', formatCurrency(cf.inflow?.total)],
      ['', ''],
      ['ARUS KAS KELUAR (OUTFLOW)', ''],
      ['   Pembayaran Biaya Petty Cash (Bahan & Operasional)', `-${formatCurrency(cf.outflow?.opexPayments)}`],
      ['   Akumulasi Kekurangan Uang Laci Shift (Shortage)', `-${formatCurrency(cf.outflow?.shortages)}`],
      ['TOTAL KAS KELUAR', `-${formatCurrency(cf.outflow?.total)}`],
      ['', ''],
      ['KENAIKAN / (PENURUNAN) KAS BERSIH', formatCurrency(cf.netCashFlow)]
    ];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } },
      didParseCell: (cellData: any) => {
        const text = cellData.cell.text[0] || '';
        if (text === 'ARUS KAS MASUK (INFLOW)' || text === 'ARUS KAS KELUAR (OUTFLOW)') {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = text.includes('INFLOW') ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.fontSize = 9;
        }
        if (text === 'TOTAL KAS MASUK' || text === 'TOTAL KAS KELUAR') {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [30, 41, 59];
          cellData.cell.styles.fillColor = [248, 250, 252];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 0.5 };
          cellData.cell.styles.lineColor = [203, 213, 225];
        }
        if (text.startsWith('KENAIKAN / (PENURUNAN)')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fontSize = 9.5;
          cellData.cell.styles.fillColor = [209, 250, 229];
          cellData.cell.styles.textColor = [16, 122, 68];
          cellData.cell.styles.lineColor = [16, 122, 68];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1.5 };
        }
      }
    });

    addSignatureBlock(doc, (doc as any).lastAutoTable?.finalY || 100);
  }

  // ─── 3. JURNAL LEDGER UMUM (ledger) ───
  else if (type === 'ledger') {
    const tableColumn = ['TANGGAL / REF', 'KETERANGAN AKUN', 'DEBIT', 'KREDIT'];
    const tableRows: any[] = [];
    const journals = data.journals || [];

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
        tableRows.push([
          '',
          isCredit ? `      ${l.account}` : l.account,
          l.debit > 0 ? formatCurrency(l.debit) : '',
          l.credit > 0 ? formatCurrency(l.credit) : ''
        ]);
      });
    });

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
    const tableColumn = ['NAMA MENU', 'KATEGORI', 'TERJUAL', 'OMZET KOTOR', 'TOTAL HPP', 'KEUNTUNGAN', 'MARGIN'];
    const products = data || [];
    
    // Aggregation values
    let totalQty = 0;
    let totalRev = 0;
    let totalCogs = 0;
    let totalProfit = 0;

    const tableRows = products.map((p: any) => {
      totalQty += p.qty || 0;
      totalRev += p.revenue || 0;
      totalCogs += p.cost || 0;
      totalProfit += p.profit || 0;

      return [
        p.name,
        p.category,
        `${p.qty} porsi`,
        formatCurrency(p.revenue),
        formatCurrency(p.cost),
        formatCurrency(p.profit),
        `${p.margin}%`
      ];
    });

    // Append total row
    const avgMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;
    tableRows.push([
      'TOTAL PENJUALAN',
      '',
      `${totalQty} porsi`,
      formatCurrency(totalRev),
      formatCurrency(totalCogs),
      formatCurrency(totalProfit),
      `${avgMargin}%`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = [209, 250, 229]; // light green background
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
    const tableColumn = ['WAKTU TUTUP', 'STAF KASIR', 'SALDO AWAL', 'KAS SISTEM', 'FISIK LACI', 'SELISIH KAS', 'STATUS'];
    const shifts = data || [];
    
    let totalSelisih = 0;

    const tableRows = shifts.map((s: any) => {
      totalSelisih += s.selisih || 0;
      const dateStr = s.waktuTutup ? new Date(s.waktuTutup).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-';

      const selisihText = s.selisih === 0 ? 'Rp 0' : `${s.selisih > 0 ? '+' : ''}${formatCurrency(s.selisih)}`;
      const statusText = s.selisih === 0 ? 'Cocok (OK)' : s.selisih < 0 ? 'Shortage (-)' : 'Overage (+)';

      return [
        dateStr,
        s.user?.name || 'Kasir',
        formatCurrency(s.saldoAwal),
        formatCurrency(s.saldoSistem || 0),
        formatCurrency(s.saldoFisikLaci || 0),
        selisihText,
        statusText
      ];
    });

    tableRows.push([
      'TOTAL SELISIH KAS',
      '',
      '',
      '',
      '',
      formatCurrency(totalSelisih),
      totalSelisih === 0 ? 'OK' : totalSelisih < 0 ? 'Shortage (-)' : 'Overage (+)'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' }
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
    const tableColumn = ['NAMA BAHAN', 'SATUAN', 'STOK AWAL', 'MASUK', 'KELUAR', 'STOK AKHIR', 'MIN STOK', 'STATUS', 'NILAI ASET'];
    const items = data.inventory || [];
    const summary = data.summary || {};

    const tableRows = items.map((item: any) => {
      const totalKeluar = item.keluarProduksi + item.keluarRusak;
      const isCritical = item.stockAkhir <= item.minStock;
      const statusText = isCritical ? 'Kritis' : 'Aman';

      return [
        item.name,
        item.unit,
        item.stockAwal.toLocaleString('id-ID'),
        item.masuk.toLocaleString('id-ID'),
        totalKeluar.toLocaleString('id-ID'),
        item.stockAkhir.toLocaleString('id-ID'),
        item.minStock.toLocaleString('id-ID'),
        statusText,
        formatCurrency(item.totalValuation)
      ];
    });

    tableRows.push([
      'TOTAL VALUASI ASET BAHAN BAKU',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      formatCurrency(summary.totalAssetValuation || 0)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      margin: { top: 38, bottom: 20 },
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica', textColor: [51, 65, 85] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right' },
        7: { halign: 'center', fontStyle: 'bold' },
        8: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const isTotalRow = cellData.row.index === tableRows.length - 1;
        if (isTotalRow) {
          cellData.cell.styles.fillColor = [241, 245, 249];
          cellData.cell.styles.textColor = [15, 118, 110];
          cellData.cell.styles.fontStyle = 'bold';
        } else {
          // Highlight critical stock rows in soft warning color
          const rowStatus = cellData.row.cells[7]?.text[0];
          if (rowStatus === 'Kritis') {
            cellData.cell.styles.fillColor = [254, 242, 242]; // soft red
            if (cellData.column.index === 7) {
              cellData.cell.styles.textColor = [220, 38, 38]; // bold red status text
            }
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Ringkasan Mutasi: Total Aset Bernilai ${formatCurrency(summary.totalAssetValuation || 0)} dengan ${summary.criticalItemsCount || 0} bahan kritis (stok menipis) dan ${summary.totalMutationsCount || 0} mutasi terdaftar.`, margin, finalY + 8);

    addSignatureBlock(doc, finalY + 10);
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
    
    // Summary Tables
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('RINGKASAN KEUANGAN TRANSAKSI (SAH)', margin, finalY + 8);
    
    const summaryRows = [
      ['Total Penjualan Kotor (POS)', formatCurrency(totalSales + totalDiscount)],
      ['Total Diskon Penjualan', `-${formatCurrency(totalDiscount)}`],
      ['Total Pajak Restoran (PB1)', formatCurrency(totalTax)],
      ['Total Pendapatan Service Charge', formatCurrency(totalService)],
      ['TOTAL PENJUALAN BERSIH (NET SALES)', formatCurrency(totalNet)]
    ];

    autoTable(doc, {
      body: summaryRows,
      startY: finalY + 12,
      margin: { left: margin, right: margin + 95 },
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

    const leftTableY = (doc as any).lastAutoTable?.finalY || finalY + 40;

    doc.text('BREAKDOWN METODE PEMBAYARAN', margin + 95, finalY + 8);
    const paymentRows = Object.entries(paymentSummary).map(([method, amount]) => [method, formatCurrency(amount)]);
    paymentRows.push(['TOTAL PENERIMAAN KAS', formatCurrency(totalNet)]);

    autoTable(doc, {
      body: paymentRows,
      startY: finalY + 12,
      margin: { left: margin + 95, right: margin },
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

    const rightTableY = (doc as any).lastAutoTable?.finalY || finalY + 40;
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
