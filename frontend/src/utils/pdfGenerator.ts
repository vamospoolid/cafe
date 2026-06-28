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
  type: 'pl' | 'cashflow' | 'ledger',
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

  // ─── Header & Footer Callback ───
  const addHeaderAndFooter = (pdfDoc: jsPDF, currentTitle: string) => {
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
    pdfDoc.text(currentTitle, pageWidth - margin, 17, { align: 'right' });

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
      `Sistem Laporan Keuangan ${settings?.storeName || 'SOL CAFE'} — Dokumen ini sah dan dicatat secara terkomputerisasi.`,
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

  // ─── 1. LAPORAN LABA RUGI (P&L) ───
  if (type === 'pl') {
    addHeaderAndFooter(doc, 'LAPORAN LABA RUGI (PROFIT & LOSS)');

    const pl = data.profitLoss || {};

    const tableColumn = ['KETERANGAN AKUN / OPERASIONAL', 'NOMINAL'];
    const tableRows = [
      ['1. PENDAPATAN OPERASIONAL', ''],
      ['   Penjualan Bersih Kasir (POS)', formatCurrency(pl.salesRevenue)],
      ['   Pendapatan Lain-lain (Petty Cash Masuk)', formatCurrency(pl.otherRevenue)],
      ['   Kelebihan Uang Kasir (Overage)', formatCurrency(pl.shiftOverage)],
      ['TOTAL PENDAPATAN OPERASIONAL', formatCurrency(pl.operatingRevenue)],
      ['', ''],
      ['2. HARGA POKOK PENJUALAN (HPP)', ''],
      ['   Beban Pokok Persediaan Bahan Baku (HPP)', `-${formatCurrency(pl.cogs)}`],
      ['TOTAL BEBAN HPP', `-${formatCurrency(pl.cogs)}`],
      ['', ''],
      ['LABA KOTOR (GROSS PROFIT)', formatCurrency(pl.grossProfit)],
      ['', ''],
      ['3. BEBAN OPERASIONAL (OPEX)', ''],
      ['   Beban Kas Operasional (Petty Cash Keluar)', `-${formatCurrency(pl.opexAmount)}`],
      ['   Kekurangan Uang Kasir (Shortage)', `-${formatCurrency(pl.shiftShortage)}`],
      ['TOTAL BEBAN OPERASIONAL', `-${formatCurrency(pl.operatingExpenses)}`],
      ['', ''],
      ['LABA BERSIH OPERASIONAL (NET INCOME)', formatCurrency(pl.netIncome)]
    ];

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        font: 'helvetica',
        textColor: [51, 65, 85]
      },
      headStyles: {
        fillColor: [15, 118, 110], // Teal color header
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const text = cellData.cell.text[0] || '';
        
        // Style Section Header
        if (
          text.startsWith('1. ') ||
          text.startsWith('2. ') ||
          text.startsWith('3. ')
        ) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [15, 118, 110];
          cellData.cell.styles.fontSize = 9;
        }

        // Style Summary totals
        if (text.startsWith('TOTAL ') || text.startsWith('LABA KOTOR')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [30, 41, 59];
          cellData.cell.styles.fillColor = [248, 250, 252];
          // Bottom border for totals
          cellData.cell.styles.lineColor = [203, 213, 225];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 0.5 };
        }

        // Highlight Net Income Row
        if (text.startsWith('LABA BERSIH OPERASIONAL')) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fontSize = 9.5;
          cellData.cell.styles.fillColor = [209, 250, 229]; // light green background
          cellData.cell.styles.textColor = [16, 122, 68]; // green text
          cellData.cell.styles.lineColor = [16, 122, 68];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 1.5 }; // double underline style representation
        }
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, i, pageCount);
    }

    doc.save(`Laba_Rugi_${startDate}_to_${endDate}.pdf`);
  }

  // ─── 2. LAPORAN ARUS KAS (CASH FLOW) ───
  else if (type === 'cashflow') {
    addHeaderAndFooter(doc, 'LAPORAN ARUS KAS (METODE LANGSUNG)');

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
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        font: 'helvetica',
        textColor: [51, 65, 85]
      },
      headStyles: {
        fillColor: [15, 118, 110], // Teal header
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        const text = cellData.cell.text[0] || '';
        
        // Section Headers
        if (text === 'ARUS KAS MASUK (INFLOW)' || text === 'ARUS KAS KELUAR (OUTFLOW)') {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = text.includes('INFLOW') ? [16, 122, 68] : [220, 38, 38];
          cellData.cell.styles.fontSize = 9;
        }

        // Totals
        if (text === 'TOTAL KAS MASUK' || text === 'TOTAL KAS KELUAR') {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = [30, 41, 59];
          cellData.cell.styles.fillColor = [248, 250, 252];
          cellData.cell.styles.lineWidth = { top: 0.5, bottom: 0.5 };
          cellData.cell.styles.lineColor = [203, 213, 225];
        }

        // Net Cash Flow Row
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

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, i, pageCount);
    }

    doc.save(`Arus_Kas_${startDate}_to_${endDate}.pdf`);
  }

  // ─── 3. JURNAL LEDGER UMUM ───
  else if (type === 'ledger') {
    addHeaderAndFooter(doc, 'BUKU JURNAL LEDGER UMUM (DOUBLE ENTRY)');

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
      
      // Push the transaction meta header row
      tableRows.push([
        `${dateStr}\n${j.reference}`,
        `Deskripsi Transaksi: ${j.description}`,
        '',
        ''
      ]);

      // Push journal lines
      j.lines?.forEach((l: any) => {
        const isCredit = l.credit > 0;
        tableRows.push([
          '',
          isCredit ? `      ${l.account}` : l.account, // credit indent
          l.debit > 0 ? formatCurrency(l.debit) : '',
          l.credit > 0 ? formatCurrency(l.credit) : ''
        ]);
      });
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.5,
        font: 'helvetica',
        textColor: [51, 65, 85]
      },
      headStyles: {
        fillColor: [15, 118, 110], // Teal header
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (cellData: any) => {
        // Find if this is a transaction description meta row
        // It spans the details, has 'Deskripsi Transaksi:' in column 1 (index 1)
        const cellVal = cellData.row.cells[1]?.text[0] || '';
        const isMetaRow = cellVal.startsWith('Deskripsi Transaksi:');

        if (isMetaRow) {
          cellData.cell.styles.fillColor = [241, 245, 249]; // light gray background slate-100
          cellData.cell.styles.textColor = [71, 85, 105];  // slate-600
          cellData.cell.styles.fontStyle = 'italic';
          cellData.cell.styles.fontSize = 8;
        }

        // Add special colors for debit & credit entries
        if (!isMetaRow && cellData.column.index === 1) {
          const isCredit = cellData.cell.text[0].startsWith('      ');
          if (isCredit) {
            cellData.cell.styles.textColor = [100, 116, 139]; // lighter text for credit
          } else {
            cellData.cell.styles.textColor = [15, 23, 42]; // darker bold text for debit
            cellData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, i, pageCount);
    }

    doc.save(`Buku_Besar_${startDate}_to_${endDate}.pdf`);
  }
};
