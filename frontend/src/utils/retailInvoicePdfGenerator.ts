import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfDocument } from './pdfDownloadHelper';

interface StoreSettings {
  storeName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  receiptFooter?: string;
}

const formatCurrency = (val: number | undefined | null) => {
  return `Rp ${(Math.round(val || 0)).toLocaleString('id-ID')}`;
};

const formatDateID = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatTimeID = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';
};

const terbilang = (n: number): string => {
  n = Math.floor(Math.abs(n || 0));
  if (n === 0) return 'Nol Rupiah';
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function convert(x: number): string {
    if (x < 12) return satuan[x];
    if (x < 20) return convert(x - 10) + ' Belas';
    if (x < 100) return convert(Math.floor(x / 10)) + ' Puluh' + (x % 10 !== 0 ? ' ' + convert(x % 10) : '');
    if (x < 200) return 'Seratus' + (x % 100 !== 0 ? ' ' + convert(x % 100) : '');
    if (x < 1000) return convert(Math.floor(x / 100)) + ' Ratus' + (x % 100 !== 0 ? ' ' + convert(x % 100) : '');
    if (x < 2000) return 'Seribu' + (x % 1000 !== 0 ? ' ' + convert(x % 1000) : '');
    if (x < 1000000) return convert(Math.floor(x / 1000)) + ' Ribu' + (x % 1000 !== 0 ? ' ' + convert(x % 1000) : '');
    if (x < 1000000000) return convert(Math.floor(x / 1000000)) + ' Juta' + (x % 1000000 !== 0 ? ' ' + convert(x % 1000000) : '');
    if (x < 1000000000000) return convert(Math.floor(x / 1000000000)) + ' Miliar' + (x % 1000000000 !== 0 ? ' ' + convert(x % 1000000000) : '');
    return convert(Math.floor(x / 1000000000000)) + ' Triliun' + (x % 1000000000000 !== 0 ? ' ' + convert(x % 1000000000000) : '');
  }

  return (convert(n) + ' Rupiah').replace(/\s+/g, ' ').trim();
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
        } catch {
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

/**
 * Generates and downloads a formal A4 Wholesale/Retail Sales Invoice (Faktur Penjualan B2B)
 */
export const exportRetailInvoicePDF = async (
  order: any,
  storeSettings?: StoreSettings,
  cashierName?: string
): Promise<void> => {
  const actualOrder = order?.order ? { ...order.order, ...order } : (order || {});

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.width || 210;
  const pageHeight = doc.internal.pageSize.height || 297;
  const margin = 14;

  let logoBase64 = '';
  if (storeSettings?.logoUrl) {
    try {
      logoBase64 = await getImageDataUrl(storeSettings.logoUrl);
    } catch (_) {}
  }

  const storeName = storeSettings?.storeName || 'TOKO RETAIL, GROSIR & BAHAN BANGUNAN';
  const address = storeSettings?.address || 'Pusat Distribusi Grosir & Retail Bahan Bangunan';
  const phone = storeSettings?.phone || '-';

  const customerName = actualOrder.customer?.name || actualOrder.customerName || 'Pelanggan Umum';
  const customerAddress = actualOrder.customer?.address || actualOrder.customerAddress || 'Alamat dicatat pada bon pesanan';
  const customerPhone = actualOrder.customer?.phone || actualOrder.customerPhone || '-';
  const priceTier = actualOrder.priceTier || actualOrder.customer?.priceTier || 'UMUM';

  const orderNumber = actualOrder.orderNumber || actualOrder.id || `INV-${Date.now().toString().slice(-8)}`;
  const orderDate = actualOrder.paidAt || actualOrder.createdAt || new Date().toISOString();
  const operatorName = actualOrder.user?.name || cashierName || actualOrder.cashierName || 'Kasir / Petugas Toko';

  const paymentMethod = (actualOrder.paymentMethod || 'TUNAI').toUpperCase();
  const isBon = paymentMethod === 'BON' || paymentMethod === 'TEMPO';
  const dueDate = actualOrder.dueDate || actualOrder.debt?.dueDate;

  const items = actualOrder.items || [];
  const subtotal = actualOrder.subtotal ?? actualOrder.total ?? 0;
  const discount = actualOrder.discount ?? actualOrder.discountAmount ?? 0;
  const tax = actualOrder.tax ?? actualOrder.taxAmount ?? 0;
  const grandTotal = actualOrder.total ?? actualOrder.grandTotal ?? (subtotal - discount + tax);
  const cashReceived = actualOrder.cashReceived ?? actualOrder.paidAmount ?? grandTotal;
  const changeDue = actualOrder.changeDue ?? Math.max(0, cashReceived - grandTotal);

  // ── HEADER KOP SURAT TOKO ──
  let textXOffset = margin;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 11, 15, 15);
      textXOffset = margin + 19;
    } catch (_) {
      doc.setFillColor(79, 70, 229); // Indigo
      doc.rect(margin, 11, 4, 16, 'F');
      textXOffset = margin + 8;
    }
  } else {
    doc.setFillColor(79, 70, 229);
    doc.rect(margin, 11, 4, 16, 'F');
    textXOffset = margin + 8;
  }

  // Nama Toko
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(storeName.toUpperCase(), textXOffset, 16);

  // Alamat & Kontak Toko
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(address, textXOffset, 21);
  doc.text(`WhatsApp / Telp: ${phone}`, textXOffset, 25.5);

  // Judul Dokumen (Kanan Atas)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(isBon ? 180 : 79, isBon ? 83 : 70, isBon ? 9 : 229); // Amber or Indigo
  const docTitle = isBon ? 'FAKTUR & BON TEMPO' : 'FAKTUR PENJUALAN';
  doc.text(docTitle, pageWidth - margin, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`No. Faktur: ${orderNumber}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(`Tanggal: ${formatDateID(orderDate)} ${formatTimeID(orderDate)}`, pageWidth - margin, 25.5, { align: 'right' });

  // Garis Pemisah Kop
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, 30, pageWidth - margin, 30);

  // ── KOTAK METADATA: PELANGGAN (KIRI) VS METADATA FAKTUR (KANAN) ──
  const infoBoxY = 34;
  const colWidth = (pageWidth - margin * 2 - 6) / 2;

  // Box Kiri: Kepada Yth (Pelanggan)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, infoBoxY, colWidth, 27, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, infoBoxY, colWidth, 27, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('KEPADA YTH. (PELANGGAN):', margin + 3.5, infoBoxY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(customerName.toUpperCase(), margin + 3.5, infoBoxY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Telp/WA: ${customerPhone}`, margin + 3.5, infoBoxY + 15);
  const truncatedAddr = customerAddress.length > 48 ? customerAddress.substring(0, 48) + '...' : customerAddress;
  doc.text(`Alamat: ${truncatedAddr}`, margin + 3.5, infoBoxY + 19.5);
  doc.text(`Price Tier: ${priceTier}`, margin + 3.5, infoBoxY + 24);

  // Box Kanan: Informasi Pembayaran & Status
  const rightColX = margin + colWidth + 6;
  doc.setFillColor(isBon ? 254 : 248, isBon ? 243 : 250, isBon ? 199 : 252); // Light amber or slate
  doc.roundedRect(rightColX, infoBoxY, colWidth, 27, 2, 2, 'F');
  doc.setDrawColor(isBon ? 252 : 226, isBon ? 211 : 232, isBon ? 77 : 240);
  doc.roundedRect(rightColX, infoBoxY, colWidth, 27, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isBon ? 180 : 100, isBon ? 83 : 116, isBon ? 9 : 139);
  doc.text('RINCIAN PEMBAYARAN:', rightColX + 3.5, infoBoxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Metode Bayar: ${paymentMethod}`, rightColX + 3.5, infoBoxY + 10.5);
  doc.text(`Kasir / Operator: ${operatorName}`, rightColX + 3.5, infoBoxY + 15);

  if (isBon) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(`STATUS: BELUM LUNAS (BON TEMPO)`, rightColX + 3.5, infoBoxY + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`Jatuh Tempo: ${dueDate ? formatDateID(dueDate) : '14 Hari dari transaksi'}`, rightColX + 3.5, infoBoxY + 24);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`STATUS: LUNAS (${paymentMethod})`, rightColX + 3.5, infoBoxY + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Waktu Bayar: ${formatDateID(orderDate)}`, rightColX + 3.5, infoBoxY + 24);
  }

  // ── TABEL DAFTAR BARANG ──
  const tableData = items.map((item: any, idx: number) => {
    const code = item.product?.barcode || item.product?.sku || item.sku || '-';
    const name = item.productName || item.product?.name || item.name || 'Barang Dagangan';
    const uom = item.uomName || item.product?.uomName || item.uom || 'Pcs';
    const qty = Number(item.qty || item.quantity || 1);
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const itemSubtotal = Number(item.subtotal ?? (qty * unitPrice));

    return [
      String(idx + 1),
      code,
      name,
      uom,
      qty.toLocaleString('id-ID'),
      formatCurrency(unitPrice),
      formatCurrency(itemSubtotal)
    ];
  });

  autoTable(doc, {
    startY: infoBoxY + 31,
    head: [['No', 'Kode', 'Nama Barang / Material', 'Satuan', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 30 },
      6: { halign: 'right', cellWidth: 32 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate-50
    },
    margin: { left: margin, right: margin }
  });

  let finalY = (doc as any).lastAutoTable?.finalY || 130;

  // Cek apakah ada ruang cukup untuk ringkasan & tanda tangan di halaman yang sama
  if (finalY + 65 > pageHeight - 15) {
    doc.addPage();
    finalY = 20;
  }

  // ── BAGIAN SUMMARY: TERBILANG & TOTAL ──
  const summaryBoxY = finalY + 4;
  const leftBoxWidth = 105;
  const rightBoxWidth = pageWidth - margin * 2 - leftBoxWidth - 6;

  // Box Kiri: Terbilang & Ketentuan
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, summaryBoxY, leftBoxWidth, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, summaryBoxY, leftBoxWidth, 32, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TERBILANG:', margin + 3.5, summaryBoxY + 5);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const terbilangStr = `# ${terbilang(grandTotal)} #`;
  const splitTerbilang = doc.splitTextToSize(terbilangStr, leftBoxWidth - 7);
  doc.text(splitTerbilang, margin + 3.5, summaryBoxY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Catatan & Ketentuan Faktur:', margin + 3.5, summaryBoxY + 20);
  doc.text('1. Barang yang sudah dibeli & diterima tidak dapat ditukar/dikembalikan.', margin + 3.5, summaryBoxY + 23.5);
  doc.text('2. Faktur ini merupakan dokumen resmi & bukti sah transaksi jual-beli.', margin + 3.5, summaryBoxY + 27);
  if (isBon) {
    doc.text('3. Harap melunasi tagihan tepat waktu sebelum tanggal jatuh tempo.', margin + 3.5, summaryBoxY + 30.5);
  } else {
    doc.text('3. Terima kasih telah berbelanja dan mempercayai toko kami.', margin + 3.5, summaryBoxY + 30.5);
  }

  // Box Kanan: Rincian Angka Finansial
  const rightSummaryX = margin + leftBoxWidth + 6;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rightSummaryX, summaryBoxY, rightBoxWidth, 32, 2, 2, 'D');

  let curSumY = summaryBoxY + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal:', rightSummaryX + 3.5, curSumY);
  doc.text(formatCurrency(subtotal), pageWidth - margin - 3.5, curSumY, { align: 'right' });

  if (discount > 0) {
    curSumY += 4.5;
    doc.setTextColor(225, 29, 72);
    doc.text('Diskon:', rightSummaryX + 3.5, curSumY);
    doc.text(`- ${formatCurrency(discount)}`, pageWidth - margin - 3.5, curSumY, { align: 'right' });
  }

  if (tax > 0) {
    curSumY += 4.5;
    doc.setTextColor(71, 85, 105);
    doc.text('PPN:', rightSummaryX + 3.5, curSumY);
    doc.text(formatCurrency(tax), pageWidth - margin - 3.5, curSumY, { align: 'right' });
  }

  curSumY += 5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(rightSummaryX + 3.5, curSumY - 1.5, pageWidth - margin - 3.5, curSumY - 1.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('GRAND TOTAL:', rightSummaryX + 3.5, curSumY + 2);
  doc.text(formatCurrency(grandTotal), pageWidth - margin - 3.5, curSumY + 2, { align: 'right' });

  if (isBon) {
    curSumY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text('Sisa Piutang Bon:', rightSummaryX + 3.5, curSumY + 2);
    doc.text(formatCurrency(grandTotal), pageWidth - margin - 3.5, curSumY + 2, { align: 'right' });
  } else {
    curSumY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Bayar (${paymentMethod}):`, rightSummaryX + 3.5, curSumY + 1);
    doc.text(formatCurrency(cashReceived), pageWidth - margin - 3.5, curSumY + 1, { align: 'right' });

    if (changeDue > 0) {
      curSumY += 4;
      doc.text('Kembalian:', rightSummaryX + 3.5, curSumY + 1);
      doc.text(formatCurrency(changeDue), pageWidth - margin - 3.5, curSumY + 1, { align: 'right' });
    }
  }

  // ── KOLOM TANDA TANGAN (DUAL SIGNATURE) ──
  const sigY = summaryBoxY + 38;
  const sigWidth = 55;

  // Tanda Tangan Penerima / Pelanggan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tanda Terima Pelanggan / Rekanan,', margin + 8, sigY);
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 8, sigY + 19, margin + 8 + sigWidth, sigY + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(customerName, margin + 8, sigY + 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('(Tanda tangan & Nama Terang)', margin + 8, sigY + 26.5);

  // Tanda Tangan Kasir / Hormat Kami
  const rightSigX = pageWidth - margin - sigWidth - 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Hormat Kami,', rightSigX, sigY);
  doc.setDrawColor(148, 163, 184);
  doc.line(rightSigX, sigY + 19, rightSigX + sigWidth, sigY + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(operatorName, rightSigX, sigY + 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Kasir / Bagian Administrasi Toko', rightSigX, sigY + 26.5);

  // ── FOOTER RESMI DOKUMEN ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
  doc.text(
    `${storeName} — Dokumen Faktur Penjualan resmi dicetak oleh Sistem CodePOS. Multi-tenant verified.`,
    margin,
    pageHeight - 7.5
  );
  doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });

  // ── SIMPAN & DOWNLOAD PDF ──
  const safeCustomerName = customerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeOrderNumber = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Faktur_${safeCustomerName}_${safeOrderNumber}.pdf`;

  savePdfDocument(doc, fileName);
};
