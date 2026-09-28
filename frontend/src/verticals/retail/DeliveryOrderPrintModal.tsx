import React, { useRef, useState } from 'react';
import { Printer, X, CheckCircle, Clock, Truck, MapPin, Phone, Download, MessageCircle, FileText } from 'lucide-react';
import { exportDeliveryOrderPDF } from '../../utils/deliveryOrderPdfGenerator';

interface DeliveryOrderPrintModalProps {
  order: any;
  onClose: () => void;
  storeSettings?: any;
}

export const DeliveryOrderPrintModal: React.FC<DeliveryOrderPrintModalProps> = ({
  order,
  onClose,
  storeSettings
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      await exportDeliveryOrderPDF(order, storeSettings);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      const fileName = await exportDeliveryOrderPDF(order, storeSettings);
      
      const customerName = order.customer?.name || order.customerName || 'Pelanggan Umum';
      const customerAddress = order.customerAddress || order.customer?.address || 'Alamat pada bon pesanan';
      const driverName = order.driverName || 'Armada Toko';
      const vehiclePlate = order.vehiclePlate || '-';
      const doNumber = order.doNumber || `DO-${order.id?.slice(0, 8)}`;

      const message = `🚚 *SURAT JALAN PENGIRIMAN ARMADA*\n\n` +
        `• *No. DO*: ${doNumber}\n` +
        `• *Penerima/Toko*: ${customerName}\n` +
        `• *Alamat Tujuan*: ${customerAddress}\n` +
        `• *Sopir/Kurir*: ${driverName} (${vehiclePlate})\n\n` +
        `📄 File PDF Surat Jalan (*${fileName}*) telah ter-download di perangkat Anda. Silakan lampirkan dokumen PDF ini. Terima kasih!`;

      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error('Failed to share via WhatsApp:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const storeName = storeSettings?.storeName || 'TOKO GROSIR & SEMBAKO';
  const storeAddress = storeSettings?.address || 'Pusat Distribusi & Grosir Sembako';
  const storePhone = storeSettings?.phone || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:shadow-none print:border-none print:max-w-none print:w-full">
        {/* Header Modal - Hidden on Print */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Truck className="text-amber-400" size={22} />
            <div>
              <h3 className="font-bold text-base sm:text-lg">Surat Jalan Pengiriman (DO)</h3>
              <p className="text-[11px] text-slate-400">Siap cetak A4 atau download PDF ber-nama pelanggan</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
              title="Download File PDF (Nama Pemesan)"
            >
              <Download size={15} />
              <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Download PDF'}</span>
            </button>

            {/* Kirim WA Sopir Button */}
            <button
              onClick={handleShareWhatsApp}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
              title="Download PDF & Kirim ke WhatsApp Sopir"
            >
              <MessageCircle size={15} />
              <span>Kirim WA Sopir</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              <Printer size={15} />
              <span>Cetak A4</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Paper Area (A4 style) */}
        <div ref={printRef} className="p-8 overflow-y-auto print:p-0 text-slate-800 text-sm font-sans bg-white">
          {/* Header Toko & Judul Surat Jalan */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{storeName}</h1>
              <p className="text-xs text-slate-600 font-medium max-w-sm">{storeAddress}</p>
              <p className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                <Phone size={11} /> Telp/WA: {storePhone}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 font-extrabold text-sm rounded border border-amber-300 uppercase tracking-wider mb-1">
                SURAT JALAN / DELIVERY ORDER
              </span>
              <div className="text-xs text-slate-500 font-mono">No. DO: <span className="font-bold text-slate-800">{order.doNumber || `DO-${order.id?.slice(0, 8)}`}</span></div>
              <div className="text-xs text-slate-500">Tanggal: <span className="font-semibold text-slate-700">{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>

          {/* Info Customer & Logistik Armada */}
          <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tujuan Pengiriman / Toko Pelanggan:</div>
              <div className="font-bold text-base text-slate-900">{order.customer?.name || order.customerName || 'Pelanggan Toko'}</div>
              <div className="text-xs text-slate-600 mt-1 flex items-start gap-1">
                <MapPin size={13} className="shrink-0 mt-0.5 text-slate-400" />
                <span>{order.customerAddress || order.customer?.address || 'Alamat dicatat pada bon pesanan'}</span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                <Phone size={13} className="shrink-0 text-slate-400" />
                <span>{order.customerPhone || order.customer?.phone || '-'}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Informasi Armada & Sopir:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Sopir / Kurir:</span>
                  <span className="font-bold text-slate-800">{order.driverName || 'Armada Toko'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Plat Nomor (Nopol):</span>
                  <span className="font-bold text-slate-800">{order.vehiclePlate || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status Pengiriman:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                    <CheckCircle size={11} /> {order.deliveryStatus || 'DELIVERED'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">No. Transaksi Kasir:</span>
                  <span className="font-mono font-semibold text-slate-800">#{order.orderId || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabel Barang & Satuan Bertingkat */}
          <div className="mb-6">
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-300">
                  <th className="py-2.5 px-3 border-r border-slate-300 w-12 text-center">No</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Nama Barang / Komoditas</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-center w-28">Satuan Kirim</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 text-right w-24">Jumlah</th>
                  <th className="py-2.5 px-3 text-left w-36">Keterangan / Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {(order.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 border-r border-slate-300 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">
                      {item.productName || item.product?.name || `Produk #${item.productId}`}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-center font-bold text-slate-700">
                      {item.unitName || item.uomName || 'PCS'}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-black text-slate-900 text-sm">
                      {item.qtyShipped ?? item.quantity ?? 1}
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-[11px]">
                      {item.notes || 'Kemasan utuh & segel baik'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Catatan Khusus */}
          <div className="mb-8 p-3 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 bg-slate-50/50">
            <span className="font-bold text-slate-700">Perhatian:</span> Mohon periksa kembali fisik barang, jumlah colly/dus, dan segel kemasan saat penyerahan. Komplain kekurangan barang tidak dapat dilayani setelah surat jalan ditandatangani.
          </div>

          {/* Tanda Tangan 3 Pihak */}
          <div className="grid grid-cols-3 gap-6 text-center text-xs pt-4 border-t border-slate-200">
            <div>
              <p className="text-slate-500 mb-16">Pengirim (Gudang/Kasir)</p>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                ( .................................... )
              </div>
            </div>
            <div>
              <p className="text-slate-500 mb-16">Sopir / Kurir Pengantar</p>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                {order.driverName ? `( ${order.driverName} )` : '( .................................... )'}
              </div>
            </div>
            <div>
              <p className="text-slate-500 mb-16">Penerima (Toko / Warung)</p>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                ( .................................... )
              </div>
            </div>
          </div>
        </div>

        {/* Footer info modal */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center print:hidden">
          <span>Tekan tombol <strong>Cetak Dokumen</strong> atau Ctrl+P untuk langsung mencetak dokumen A4 ke printer.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
