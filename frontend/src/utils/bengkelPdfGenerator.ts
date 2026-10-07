import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BengkelSettings {
  storeName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

const formatCurrency = (val: number | undefined | null) => {
  return `Rp ${(val || 0).toLocaleString('id-ID')}`;
};

const formatDateID = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const getImageDataUrl = (url: string): Promise<string> => {
  if (!url) return Promise.resolve('');
  if (url.startsWith('data:image')) {
    return Promise.resolve(url);
  }

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

/**
 * Ekspor Dokumen Resmi Laporan Performa & Finansial Bengkel (A4 Portrait)
 */
export const exportBengkelReportPDF = async (
  settings: BengkelSettings,
  reportData: any,
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

  const storeName = settings?.storeName || 'BENGKEL MOTOR & MOBIL';
  const address = settings?.address || 'Jl. Raya Otomotif No. 88';
  const phone = settings?.phone ? `WhatsApp: ${settings.phone}` : 'Hotline: -';
  const docNumber = `DOC/BKL/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(1000 + Math.random() * 9000)}`;

  const addHeader = () => {
    let textXOffset = margin;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
        textXOffset = margin + 18;
      } catch (_) {
        doc.setFillColor(99, 102, 241);
        doc.rect(margin, 12, 4, 16, 'F');
        textXOffset = margin + 8;
      }
    } else {
      doc.setFillColor(99, 102, 241);
      doc.rect(margin, 12, 4, 16, 'F');
      textXOffset = margin + 8;
    }

    // Left info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(storeName.toUpperCase(), textXOffset, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(address, textXOffset, 21);
    doc.text(phone, textXOffset, 25);

    // Right info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(79, 70, 229);
    doc.text('LAPORAN PERFORMA & KEUANGAN BENGKEL', pageWidth - margin, 16, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`No: ${docNumber}`, pageWidth - margin, 20.5, { align: 'right' });
    doc.text(`Periode: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`, pageWidth - margin, 24.5, { align: 'right' });
    doc.text(`Dicetak Oleh: ${userName || 'Administrator'} • ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 28.5, { align: 'right' });

    // Header divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, 32, pageWidth - margin, 32);
  };

  addHeader();

  const summary = reportData?.summary || {};
  const mechanics = reportData?.mechanicPerformance || [];
  const parts = reportData?.fastMovingParts || [];
  const cashflow = reportData?.cashflowSummary || {};

  let currentY = 38;

  // ─── 1. RINGKASAN EKSEKUTIF FINANSIAL (P&L STATEMENT) ───
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('1. LAPORAN LABA RUGI OPERASIONAL BENGKEL (P&L)', margin, currentY);
  currentY += 4;

  const grossMarginPct = summary.totalOmzetBersih > 0
    ? Math.round((summary.totalLabaKotor / summary.totalOmzetBersih) * 100)
    : 0;

  const netMarginPct = summary.totalOmzetBersih > 0
    ? Math.round((summary.estimasiLabaBersih / summary.totalOmzetBersih) * 100)
    : 0;

  const plTableData = [
    ['I. PENDAPATAN USAHA (REVENUE)', '', ''],
    ['   • Omzet Jasa Servis Kendaraan', formatCurrency(summary.omzetJasa), 'Margin Jasa 100%'],
    ['   • Omzet Penjualan Suku Cadang & Pelumas', formatCurrency(summary.omzetParts), 'Volume barang terpasang di SPK'],
    ['   • Diskon Transaksi & Potongan SPK', `-${formatCurrency(summary.totalDiscount)}`, 'Potongan promo/member'],
    ['   TOTAL PENDAPATAN BERSIH (NET REVENUE)', formatCurrency(summary.totalOmzetBersih), `${summary.totalSPK || 0} Unit SPK Selesai`],
    ['II. HARGA POKOK PENJUALAN (HPP / COGS)', '', ''],
    ['   • Modal Beli Suku Cadang Terpasang (HPP Parts)', formatCurrency(summary.hppParts), 'Modal pembelian dari distributor'],
    ['   LABA KOTOR USAHA (GROSS PROFIT)', formatCurrency(summary.totalLabaKotor), `${grossMarginPct}% Margin Kotor`],
    ['III. BEBAN LANGSUNG OPERASIONAL', '', ''],
    ['   • Beban Komisi Mekanik (Pengerjaan Jasa)', formatCurrency(summary.totalBebanKomisi), 'Hak pembagian komisi servis'],
    ['   LABA SETELAH KOMISI MEKANIK', formatCurrency(summary.labaSetelahKomisi || (summary.totalLabaKotor - summary.totalBebanKomisi)), 'Kontribusi laba internal'],
    ['IV. BEBAN KAS OPERASIONAL (OPEX PETTY CASH)', '', ''],
    ['   • Beban Kas Operasional Bengkel (Listrik, Alat, Konsumsi)', formatCurrency(summary.totalBebanOpex || cashflow.totalOutflow || 0), 'Pengeluaran kas tercatat'],
    ['V. ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT)', formatCurrency(summary.estimasiLabaBersih), `${netMarginPct}% Net Operating Margin`]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: plTableData,
    styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 116, 139] }
    },
    didParseCell: (data) => {
      const rowIndex = data.row.index;
      // Header rows
      if (rowIndex === 0 || rowIndex === 5 || rowIndex === 8 || rowIndex === 11) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [30, 41, 59];
      }
      // Subtotal / Grand total highlights
      if (rowIndex === 4 || rowIndex === 7 || rowIndex === 10) {
        data.cell.styles.fillColor = [248, 250, 252];
        data.cell.styles.fontStyle = 'bold';
      }
      if (rowIndex === 13) {
        data.cell.styles.fillColor = [238, 242, 255];
        data.cell.styles.textColor = [67, 56, 202];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ─── 2. EVALUASI PRODUKTIVITAS & KOMISI MEKANIK ───
  if (currentY > pageHeight - 65) {
    doc.addPage();
    addHeader();
    currentY = 38;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('2. EVALUASI PRODUKTIVITAS & HAK KOMISI MEKANIK', margin, currentY);
  currentY += 4;

  const mechanicRows = mechanics.map((m: any, idx: number) => [
    idx + 1,
    m.name,
    m.phone || '-',
    `${m.spkCompleted} Unit`,
    formatCurrency(m.totalJasaGenerated),
    `${Math.round(m.commissionRate * 100)}%`,
    formatCurrency(m.estimatedPeriodCommission),
    formatCurrency(m.pendingCommission)
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['No', 'Nama Mekanik', 'Kontak', 'SPK Selesai', 'Omzet Jasa', 'Skema', 'Hak Komisi', 'Pending']],
    body: mechanicRows.length > 0 ? mechanicRows : [['-', 'Belum ada data pengerjaan mekanik', '-', '-', '-', '-', '-', '-']],
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 26 },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
      7: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ─── 3. TOP 10 SUKU CADANG FAST-MOVING & STOK KRITIS ───
  if (currentY > pageHeight - 65) {
    doc.addPage();
    addHeader();
    currentY = 38;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('3. MONITORING 10 SUKU CADANG TERLARIS (FAST-MOVING)', margin, currentY);
  currentY += 4;

  const partRows = parts.map((p: any, idx: number) => [
    idx + 1,
    p.name,
    `${p.qty} Pcs`,
    formatCurrency(p.revenue),
    `${p.stock} Pcs`,
    `${p.minStock || 0} Pcs`,
    p.stock <= p.minStock ? 'STOK KRITIS' : 'AMAN'
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['No', 'Nama Suku Cadang', 'Terjual', 'Total Omzet', 'Sisa Stok', 'Batas Min', 'Status Stok']],
    body: partRows.length > 0 ? partRows : [['-', 'Belum ada suku cadang terjual pada periode ini', '-', '-', '-', '-', '-']],
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 60 },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.column.index === 6 && data.cell.text[0] === 'STOK KRITIS') {
        data.cell.styles.textColor = [225, 29, 72];
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ─── 4. PERINGATAN BARANG KOSONG (OUT-OF-STOCK = 0) ───
  const outOfStockParts = reportData?.outOfStockParts || [];
  if (outOfStockParts.length > 0) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      addHeader();
      currentY = 38;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('4. PERINGATAN SUKU CADANG KOSONG (OUT-OF-STOCK = 0)', margin, currentY);
    currentY += 4;

    const outRows = outOfStockParts.slice(0, 10).map((p: any, idx: number) => [
      idx + 1,
      p.name,
      p.brand || '-',
      p.vehicleType || 'Umum',
      '0 Pcs (HABIS)',
      `${p.minStock || 0} Pcs`,
      p.storageLocation || 'Rak Gudang',
      'SEGERA KULAKAN'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['No', 'Nama Suku Cadang', 'Merk', 'Tipe', 'Sisa Stok', 'Batas Min', 'Lokasi Rak', 'Status']],
      body: outRows,
      headStyles: {
        fillColor: [225, 29, 72],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        4: { fontStyle: 'bold', textColor: [225, 29, 72], halign: 'center' },
        5: { halign: 'center' },
        7: { fontStyle: 'bold', halign: 'center', textColor: [225, 29, 72] }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── 5. CATATAN PERMINTAAN SUKU CADANG / DEFECTA (LOST SALES ALERT) ───
  const partReqSummary = reportData?.partRequestsSummary;
  const recentRequests = partReqSummary?.recentRequests || [];
  if (recentRequests.length > 0) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      addHeader();
      currentY = 38;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('5. CATATAN PERMINTAAN SUKU CADANG / DEFECTA (LOST SALES ALERT)', margin, currentY);
    currentY += 4;

    const reqRows = recentRequests.slice(0, 10).map((r: any, idx: number) => [
      idx + 1,
      r.partName,
      r.brand || '-',
      `${r.requestedQty || 1} Pcs`,
      r.customerName || 'Pelanggan Walk-in',
      r.status === 'PENDING' ? 'Menunggu Pengadaan' : r.status === 'IN_PURCHASE_LIST' ? 'Masuk PO Supplier' : r.status === 'PURCHASED' ? 'Sudah Terbeli' : r.status,
      r.notes || '-'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['No', 'Part Diminta', 'Merk/Tipe', 'Qty', 'Pelanggan / Pemohon', 'Status Pengadaan', 'Catatan']],
      body: reqRows,
      headStyles: {
        fillColor: [217, 119, 6],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        3: { halign: 'center', fontStyle: 'bold' },
        5: { fontStyle: 'bold', halign: 'center' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // ─── 6. SIGNATURE BLOCK ───
  if (currentY > pageHeight - 35) {
    doc.addPage();
    addHeader();
    currentY = 45;
  }

  const signatureY = currentY;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  doc.text('Dibuat Oleh (Admin/Kasir),', margin + 8, signatureY);
  doc.text('Disetujui Oleh (Kepala Bengkel/Owner),', pageWidth - margin - 58, signatureY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`( ${userName || 'Administrator'} )`, margin + 8, signatureY + 20);
  doc.text(`( ${storeName} )`, pageWidth - margin - 58, signatureY + 20);

  // ─── FOOTER ON ALL PAGES ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      `Sistem Laporan Bengkel POS ${storeName} — Dokumen Sah & Rahasia.`,
      margin,
      pageHeight - 6
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Finansial_${storeName.replace(/\s+/g, '_')}_${timestamp}.pdf`);
};

/**
 * Cetak Slip Komisi Mekanik Perorangan (A5/Receipt Formal)
 */
export const exportMechanicSlipPDF = async (
  settings: BengkelSettings,
  mechanic: any,
  periodText: string,
  userName?: string
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const pageWidth = doc.internal.pageSize.width || 148;
  const margin = 10;

  const storeName = settings?.storeName || 'BENGKEL MOTOR & MOBIL';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(storeName.toUpperCase(), margin, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(79, 70, 229);
  doc.text('SLIP HAK KOMISI & INSENTIF MEKANIK', pageWidth - margin, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${periodText}`, margin, 19);
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 19, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 22, pageWidth - margin, 22);

  // Mechanic Info
  autoTable(doc, {
    startY: 25,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: [
      ['Nama Mekanik', `: ${mechanic.name}`, 'Unit SPK Selesai', `: ${mechanic.spkCompleted} Kendaraan`],
      ['Nomor HP/WA', `: ${mechanic.phone || '-'}`, 'Skema Komisi', `: ${Math.round((mechanic.commissionRate || 0) * 100)}% dari Jasa Servis`],
      ['Omzet Jasa Servis', `: ${formatCurrency(mechanic.totalJasaGenerated)}`, 'Sisa Pending Komisi', `: ${formatCurrency(mechanic.pendingCommission)}`]
    ],
    styles: { fontSize: 8, cellPadding: 1.5, textColor: [30, 41, 59] }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Rincian Hak Komisi', 'Jumlah']],
    body: [
      ['Total Hak Komisi Periode Ini (Tercatat)', formatCurrency(mechanic.estimatedPeriodCommission)],
      ['Total Komisi Belum Dicairkan (Akumulasi)', formatCurrency(mechanic.pendingCommission)]
    ],
    headStyles: { fillColor: [79, 70, 229], fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }
    }
  });

  const signY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  doc.text('Diterima Oleh (Mekanik),', margin + 6, signY);
  doc.text('Diserahkan Oleh (Finance/Owner),', pageWidth - margin - 46, signY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`( ${mechanic.name} )`, margin + 6, signY + 16);
  doc.text(`( ${userName || 'Kasir/Owner'} )`, pageWidth - margin - 46, signY + 16);

  doc.save(`Slip_Komisi_${mechanic.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
