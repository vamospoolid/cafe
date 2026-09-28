import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StoreSettings {
  storeName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

const formatDateID = (dateStr: string) => {
  if (!dateStr) return '-';
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
 * Generates and downloads a professional A4 Surat Jalan PDF
 * with filename customized according to Customer Name & DO Number:
 * e.g., `SuratJalan_Warung_Bu_Siti_DO-202609-001.pdf`
 */
export const exportDeliveryOrderPDF = async (order: any, storeSettings?: StoreSettings) => {
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

  const storeName = storeSettings?.storeName || 'TOKO GROSIR & SEMBAKO';
  const address = storeSettings?.address || 'Pusat Distribusi & Grosir Sembako';
  const phone = storeSettings?.phone || '-';

  const customerName = order.customer?.name || order.customerName || 'Pelanggan Umum';
  const customerAddress = order.customerAddress || order.customer?.address || 'Alamat dicatat pada bon pesanan';
  const customerPhone = order.customerPhone || order.customer?.phone || '-';
  const driverName = order.driverName || 'Armada Toko';
  const vehiclePlate = order.vehiclePlate || '-';
  const doNumber = order.doNumber || `DO-${order.id?.slice(0, 8)}`;

  // ── HEADER TOKO & KOP ──
  let textXOffset = margin;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
      textXOffset = margin + 18;
    } catch (_) {
      doc.setFillColor(245, 158, 11); // Amber
      doc.rect(margin, 11, 4, 15, 'F');
      textXOffset = margin + 8;
    }
  } else {
    doc.setFillColor(245, 158, 11);
    doc.rect(margin, 11, 4, 15, 'F');
    textXOffset = margin + 8;
  }

  // Store Header Left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(storeName.toUpperCase(), textXOffset, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(address, textXOffset, 20.5);
  doc.text(`Telp/WA: ${phone}`, textXOffset, 24.5);

  // Document Title Right
  doc.setFillColor(254, 243, 199); // amber-100
  doc.rect(pageWidth - margin - 65, 10, 65, 7, 'F');
  doc.setDrawColor(252, 211, 77); // amber-300
  doc.rect(pageWidth - margin - 65, 10, 65, 7, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 53, 15); // amber-900
  doc.text('SURAT JALAN / DELIVERY ORDER', pageWidth - margin - 32.5, 14.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`No. DO: ${doNumber}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(`Tanggal: ${formatDateID(order.createdAt)}`, pageWidth - margin, 25, { align: 'right' });

  // Divider Line
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(margin, 29, pageWidth - margin, 29);

  // ── INFORMASI TUJUAN & ARMADA ──
  const startY = 34;

  // Box Tujuan Pengiriman (Kiri)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, startY, 88, 30, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, startY, 88, 30, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('TUJUAN PENGIRIMAN / TOKO PELANGGAN:', margin + 3, startY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(customerName.slice(0, 38), margin + 3, startY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const splitAddress = doc.splitTextToSize(`Alamat: ${customerAddress}`, 82);
  doc.text(splitAddress.slice(0, 2), margin + 3, startY + 17);
  doc.text(`Telp/WA: ${customerPhone}`, margin + 3, startY + 26);

  // Box Informasi Armada & Sopir (Kanan)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + 94, startY, 88, 30, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin + 94, startY, 88, 30, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('LOGISTIK & INFORMASI ARMADA:', margin + 97, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Sopir / Kurir:`, margin + 97, startY + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(driverName, margin + 120, startY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Plat Nomor (Nopol):`, margin + 97, startY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(vehiclePlate, margin + 128, startY + 17);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`No. Transaksi Kasir:`, margin + 97, startY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`#${order.orderId || '-'}`, margin + 128, startY + 23);

  // ── TABEL MUATAN BARANG ──
  const tableData = (order.items || []).map((it: any, idx: number) => [
    idx + 1,
    it.productName || it.product?.name || `Produk #${it.productId}`,
    it.unitName || it.uomName || 'PCS',
    it.qtyShipped ?? it.quantity ?? 1,
    it.notes || 'Kemasan utuh & segel baik'
  ]);

  autoTable(doc, {
    startY: startY + 34,
    head: [['No', 'Nama Barang / Komoditas', 'Satuan Kirim', 'Jumlah Qty', 'Keterangan / Kondisi']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
      4: { cellWidth: 50 }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || startY + 60;

  // ── CATATAN PERHATIAN ──
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, finalY + 4, pageWidth - (margin * 2), 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  doc.text('PERHATIAN:', margin + 3, finalY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 83, 9);
  doc.text('Mohon periksa fisik barang, colly/dus, dan segel kemasan saat penyerahan. Komplain tidak dapat dilayani setelah surat jalan ditandatangani.', margin + 22, finalY + 9.5);

  // ── TANDA TANGAN 3 PIHAK ──
  const sigY = Math.min(finalY + 22, pageHeight - 35);
  const colWidth = (pageWidth - margin * 2) / 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  // Pengirim
  doc.text('Pengirim (Gudang/Kasir)', margin + colWidth / 2, sigY, { align: 'center' });
  doc.line(margin + 5, sigY + 16, margin + colWidth - 5, sigY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('( .................................... )', margin + colWidth / 2, sigY + 20, { align: 'center' });

  // Sopir
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Sopir / Kurir Pengantar', margin + colWidth + colWidth / 2, sigY, { align: 'center' });
  doc.line(margin + colWidth + 5, sigY + 16, margin + colWidth * 2 - 5, sigY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(driverName ? `( ${driverName} )` : '( .................................... )', margin + colWidth + colWidth / 2, sigY + 20, { align: 'center' });

  // Penerima
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Penerima (Toko / Warung)', margin + colWidth * 2 + colWidth / 2, sigY, { align: 'center' });
  doc.line(margin + colWidth * 2 + 5, sigY + 16, margin + colWidth * 3 - 5, sigY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('( .................................... )', margin + colWidth * 2 + colWidth / 2, sigY + 20, { align: 'center' });

  // ── GENERATE & DOWNLOAD WITH EXPLICIT FILENAME ──
  const sanitizedCust = customerName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').trim() || 'Pelanggan';
  const sanitizedDo = doNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `SuratJalan_${sanitizedCust}_${sanitizedDo}.pdf`;

  // Explicit File & Blob URL Download to guarantee Chrome & Edge keep .pdf extension & custom filename
  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(pdfFile);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

  return filename;
};
