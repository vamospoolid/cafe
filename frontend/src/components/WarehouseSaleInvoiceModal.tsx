import React, { useRef } from 'react';
import { X, Printer, CheckCircle2, AlertCircle, Building2, Phone, MapPin, Calendar, Clock, User } from 'lucide-react';

interface WarehouseSaleInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
}

export default function WarehouseSaleInvoiceModal({
  isOpen,
  onClose,
  sale
}: WarehouseSaleInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=850,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Faktur Penjualan B2B - ${sale.invoiceNumber}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 20px;
              font-size: 12px;
            }
            .header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .title {
              font-size: 18px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 16px;
              font-size: 11px;
            }
            .box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              padding: 8px;
              font-size: 11px;
              text-transform: uppercase;
            }
            td {
              padding: 8px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 11px;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-box {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 24px;
            }
            .total-table {
              width: 320px;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
              margin-top: 36px;
            }
            .sig-line {
              margin-top: 55px;
              border-top: 1px solid #94a3b8;
              font-weight: bold;
              padding-top: 4px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-emerald-400" />
            <h3 className="text-sm font-black tracking-wide">
              Faktur Penjualan Grosir &amp; Surat Jalan (B2B)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer size={14} /> Cetak Dokumen
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50">
          <div
            ref={printRef}
            className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto"
          >
            {/* Header / Kop */}
            <div className="header border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Central Warehouse Supply
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Faktur Penjualan Bahan Baku Grosir &bull; Surat Jalan Pengeluaran Barang
                </p>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Dicetak oleh: {sale.soldBy?.name || 'Admin Pusat'}
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-black text-base text-indigo-700">
                  {sale.invoiceNumber}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(sale.saleDate || sale.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
                <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                  sale.isVoided
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : sale.paymentStatus === 'PAID'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {sale.isVoided ? 'BATAL (VOID)' : sale.paymentStatus === 'PAID' ? 'LUNAS (PAID)' : 'MENUNGGU PEMBAYARAN'}
                </span>
              </div>
            </div>

            {/* Customer & Order Metadata */}
            <div className="meta-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-xs">
              <div className="box bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Kepada / Penerima:
                </div>
                <div className="font-black text-slate-900 text-sm">{sale.customerName}</div>
                {sale.customerPhone && (
                  <div className="text-slate-600 mt-0.5 flex items-center gap-1">
                    <Phone size={11} className="text-slate-400" /> {sale.customerPhone}
                  </div>
                )}
                {sale.customerAddress && (
                  <div className="text-slate-600 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} className="text-slate-400" /> {sale.customerAddress}
                  </div>
                )}
              </div>

              <div className="box bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Metode &amp; Keterangan:
                </div>
                <div className="text-slate-800">
                  Pembayaran: <strong>{sale.paymentMethod === 'TRANSFER' ? 'Transfer Bank Pusat' : sale.paymentMethod === 'CASH_OWNER' ? 'Tunai di Pusat' : 'Tempo / Piutang'}</strong>
                </div>
                {sale.notes && (
                  <div className="text-slate-600 mt-1 italic">
                    Catatan: &ldquo;{sale.notes}&rdquo;
                  </div>
                )}
              </div>
            </div>

            {/* Item Table */}
            <table className="w-full text-left border-collapse mb-5 text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                  <th className="p-2.5 rounded-l-lg">No</th>
                  <th className="p-2.5">Bahan Baku</th>
                  <th className="p-2.5 text-center">Qty Grosir</th>
                  <th className="p-2.5 text-right">Harga Jual</th>
                  <th className="p-2.5 text-right rounded-r-lg">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(sale.items || []).map((it: any, idx: number) => (
                  <tr key={it.id || idx}>
                    <td className="p-2.5 text-slate-400">{idx + 1}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-800">{it.itemName}</div>
                      <div className="text-[10px] text-slate-400">
                        Total keluar gudang: {it.baseQty} {it.ingredient?.unit || 'satuan'}
                      </div>
                    </td>
                    <td className="p-2.5 text-center font-black text-slate-800">
                      {it.saleQty} {it.saleUnit}
                    </td>
                    <td className="p-2.5 text-right text-slate-700">
                      {formatCurrency(it.unitSalePrice)}
                    </td>
                    <td className="p-2.5 text-right font-black text-slate-900">
                      {formatCurrency(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Summary */}
            <div className="total-box flex justify-end mb-6">
              <div className="total-table w-72 bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Tagihan:</span>
                  <span className="font-black text-slate-900 text-base">{formatCurrency(sale.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                  <span>HPP Modal Gudang:</span>
                  <span>{formatCurrency(sale.totalHppCost)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                  <span>Laba Bersih Grosir:</span>
                  <span>+{formatCurrency(sale.grossProfit)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="signatures grid grid-cols-3 gap-4 text-center text-xs mt-8 pt-4 border-t border-slate-200">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Diserahkan Oleh</div>
                <div className="sig-line mt-12 border-t border-slate-400 pt-1 font-bold text-slate-800">
                  ( Kepala Gudang Pusat )
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Kurir / Driver</div>
                <div className="sig-line mt-12 border-t border-slate-400 pt-1 font-bold text-slate-800">
                  ( .............................. )
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Diterima Pembeli</div>
                <div className="sig-line mt-12 border-t border-slate-400 pt-1 font-bold text-slate-800">
                  ( {sale.customerName} )
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
