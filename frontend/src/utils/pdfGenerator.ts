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

// ─────────────────────────────────────────────────────────────────────────────
// 1. LAPORAN VALUASI & POSISI ASET PERSEDIAAN (INVENTORY VALUATION REPORT)
// ─────────────────────────────────────────────────────────────────────────────
export const exportIngredientValuationPDF = async (
  settings: VenueSettings,
  ingredients: any[],
  userName?: string
) => {
  let logoBase64 = '';
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
    pdfDoc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
      `Sistem Akuntansi Persediaan ${settings?.storeName || 'SOL CAFE'} — Dokumen Aset Lancar Resmi.`,
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
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
    pdfDoc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
      `Sistem Audit HPP & Kerusakan Bahan ${settings?.storeName || 'SOL CAFE'} — Dokumen Pengawasan Biaya.`,
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

  const totalLossRp = lossData?.totalLossRupiah || 0;
  const totalIncidents = lossData?.totalLossIncidents || 0;
  const lossRate = lossData?.lossRatePercentage || 0;
  const efficiencyRate = lossData?.efficiencyRate || 100;
  const productionValue = lossData?.totalProductionValue || 0;

  // Key KPI Cards
  autoTable(doc, {
    head: [['KEY PERFORMANCE INDICATOR (KPI) LOSS & EFISIENSI', 'HASIL EVALUASI']],
    body: [
      ['TOTAL VALUASI KERUGIAN BAHAN BAKU (STOCK LOSS)', `Rp ${totalLossRp.toLocaleString('id-ID')}`],
      ['Total Insiden Kerusakan Dicatat', `${totalIncidents} Kejadian Insiden`],
      ['Tingkat Kerugian Bahan (% Loss Rate)', `${lossRate}% dari total pengeluaran`],
      ['Tingkat Efisiensi Bahan (% Yield Rate)', `${efficiencyRate}% sukses diproduksi/terjual`],
      ['Total Nilai Produksi Sukses Terjual (POS)', `Rp ${productionValue.toLocaleString('id-ID')}`]
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
  if (lossData?.topLossItems && lossData.topLossItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('TOP 5 BAHAN PENYUMBANG KERUGIAN TERBESAR (PARETO 80/20)', margin, nextY + 8);

    const topColumns = ['PERINGKAT', 'NAMA BAHAN BAKU', 'TOTAL QTY RUSAK', 'TOTAL VALUASI RUGI (RP)'];
    const topRows = lossData.topLossItems.map((t: any, idx: number) => [
      `Peringkat #${idx + 1}`,
      t.name,
      `${t.totalQty} ${t.unit}`,
      formatCurrency(t.totalRupiah)
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

  const logColumns = ['TANGGAL/WAKTU', 'BAHAN BAKU', 'QTY RUSAK', 'VALUASI (RP)', 'ALASAN', 'DICATAT OLEH'];
  const logRows = (lossData?.lossLogs || []).map((l: any) => [
    new Date(l.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    l.ingredient?.name || '-',
    `${l.qtyLoss} ${l.ingredient?.unit || ''}`,
    formatCurrency(l.costLoss),
    l.reason || 'Lainnya',
    l.recordedBy || 'Staf Dapur'
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
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
    pdfDoc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
      `Sistem Perencanaan Pengadaan ${settings?.storeName || 'SOL CAFE'} — Dokumen Proyeksi Arus Kas Keluar.`,
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

  const totalEstimatedCost = shoppingData?.totalEstimatedCost || 0;
  const criticalCount = shoppingData?.criticalItems?.length || 0;

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
  const planRows = (shoppingData?.criticalItems || []).map((item: any, idx: number) => [
    idx + 1,
    item.name,
    `${item.currentStock} ${item.unit}`,
    `${item.minStock} ${item.unit}`,
    `${item.recommendedBuyQty} ${item.unit}`,
    formatCurrency(item.buyPrice),
    formatCurrency(item.estimatedCost),
    item.supplierName || 'Umum / Pasar'
  ]);

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
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
    pdfDoc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
      `Sistem Audit Persediaan Fisik ${settings?.storeName || 'SOL CAFE'} — Berita Acara Rekonsiliasi Resmi.`,
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
  let totalDiscrepancyPlus = 0;
  let totalDiscrepancyMinus = 0;
  let matchedItems = 0;

  const tableRows = opnameItems.map((item, idx) => {
    const sys = Number(item.systemStock) || 0;
    const phys = item.physicalStock === '' ? sys : (Number(item.physicalStock) || 0);
    const diff = phys - sys;
    const diffRp = diff * (item.buyPrice || 0);

    if (diff > 0) totalDiscrepancyPlus += diffRp;
    else if (diff < 0) totalDiscrepancyMinus += Math.abs(diffRp);
    else matchedItems++;

    return [
      idx + 1,
      item.name,
      item.unit,
      sys,
      phys,
      diff > 0 ? `+${diff}` : diff,
      formatCurrency(item.buyPrice),
      diff > 0 ? `+${formatCurrency(diffRp)}` : formatCurrency(diffRp),
      item.reason || item.notes || '-'
    ];
  });

  const accuracyRate = opnameItems.length > 0 ? Math.round((matchedItems / opnameItems.length) * 100) : 100;
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
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
    pdfDoc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
      `Laporan Analisis Konsumsi Bahan Baku ${settings?.storeName || 'SOL CAFE'} — Dokumen Pengawasan HPP & Bahan Baku.`,
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
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
  doc.text(settings?.storeName || 'SOL CAFE', textXOffset, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(settings?.address || 'Alamat Kafe Belum Ditentukan', textXOffset, 21);
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
        `Toko: ${settings?.storeName || 'SOL CAFE'}\nAlamat: ${settings?.address || 'Alamat Toko'}\nPIC Pemesan: ${userName || 'Bagian Purchasing'}`
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
  doc.text(`Dokumen resmi pesanan pembelian ${settings?.storeName || 'SOL CAFE'}. Dicetak otomatis oleh sistem.`, margin, pageHeight - 8);

  doc.save(`Purchase_Order_${poNumber}_${poData.supplierName.replace(/\s+/g, '_')}.pdf`);
};

export const exportShiftSettlementPDF = async (
  settings: VenueSettings,
  shiftData: any,
  cashierName?: string
) => {
  let logoBase64 = '';
  if (settings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(settings.logoUrl);
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
      doc.text((settings?.storeName || 'SOL CAFE & EATERY').toUpperCase(), margin + 22, nextY + 6);
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
      doc.text((settings?.storeName || 'SOL CAFE & EATERY').toUpperCase(), margin, nextY + 4);
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
    doc.text((settings?.storeName || 'SOL CAFE & EATERY').toUpperCase(), margin, nextY + 4);
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
  const cashSales = shiftData.cashSales || 0;
  const nonCashSales = shiftData.nonCashSales || 0;
  const voidCount = shiftData.voidCount || 0;
  const voidCashTotal = shiftData.voidCashTotal || 0;
  const manualCashIn = shiftData.manualCashIn || 0;
  const manualCashOut = shiftData.manualCashOut || 0;
  const cashDebtIncome = shiftData.cashDebtIncome || 0;
  const saldoSistem = shiftData.saldoSistem || (saldoAwal + cashSales - voidCashTotal + cashDebtIncome + manualCashIn - manualCashOut);
  const saldoFisikLaci = shiftData.saldoFisikLaci || 0;
  const selisih = shiftData.selisih !== undefined ? shiftData.selisih : (saldoFisikLaci - saldoSistem);

  const tableRows = [
    ['1', 'Modal Awal Kasir (Starting Float Laci)', 'Kas Awal', formatCurrency(saldoAwal)],
    ['2', 'Total Penjualan Tunai (Cash)', 'Omset Tunai (+)', formatCurrency(cashSales)],
    ['3', 'Total Penjualan Non-Tunai (QRIS / EDC / Transfer)', 'Elektronik (Bank)', formatCurrency(nonCashSales)],
    ['4', `Transaksi Batal / Void (${voidCount} Order)`, 'Koreksi Kas (-)', voidCashTotal > 0 ? `-${formatCurrency(voidCashTotal)}` : 'Rp 0'],
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


