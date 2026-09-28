import React, { useEffect, useRef } from 'react';
import { Printer, X, Shirt, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

interface LaundryReceiptPrinterProps {
  order: any;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const LaundryReceiptPrinter: React.FC<LaundryReceiptPrinterProps> = ({
  order,
  onClose,
  autoPrint = false
}) => {
  const { settings, user } = usePOS();
  const printRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  if (!order) return null;

  const totalAmount = Number(order.totalAmount) || 0;
  const paidAmount = Number(order.paidAmount) || 0;
  const remainingDue = Math.max(0, totalAmount - paidAmount);
  const isPaidLunas = remainingDue === 0 && totalAmount > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto cursor-pointer print:p-0 print:bg-white"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {/* Container Preview Modal */}
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col my-auto border border-slate-200 cursor-default print:shadow-none print:border-none print:max-w-none print:w-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Action Bar (Hidden when printing) */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-cyan-400" />
            <h3 className="font-bold text-xs">Nota Kasir Laundry (58/80mm)</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Printer size={13} />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper */}
        <div className="p-4 sm:p-6 bg-slate-100 flex justify-center overflow-y-auto max-h-[78vh] print:p-0 print:bg-white print:max-h-none">
          <div 
            ref={printRef}
            id="laundry-thermal-receipt"
            className="bg-white p-4 shadow-sm border border-slate-300 w-full max-w-[290px] text-slate-900 font-mono text-[11px] leading-tight select-none print:border-none print:shadow-none print:p-0"
            style={{ width: '280px' }}
          >
            {/* Header Laundry */}
            <div className="text-center space-y-1 mb-2">
              <div className="font-black text-sm uppercase tracking-wide">
                {settings?.storeName || 'LAUNDRY BERSIH WANGI'}
              </div>
              <div className="text-[10px] text-slate-600 leading-tight">
                {settings?.address || 'Jasa Cuci Kiloan & Satuan Premium'}
              </div>
              {settings?.phone && (
                <div className="text-[10px] text-slate-600">WhatsApp: {settings?.phone}</div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 mb-2">
              ================================
            </div>

            {/* Info Nota & Pelanggan */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>No. Nota:</span>
                <span className="font-black text-xs">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu Terima:</span>
                <span>{formatDate(order.createdAt)} {formatTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{user?.name || 'Kasir'}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 mt-1">
                <span className="font-bold">Pelanggan:</span>
                <span className="font-black">{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span>No. HP:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
              {order.rackLocation && (
                <div className="flex justify-between font-bold text-cyan-800 bg-cyan-50 px-1 py-0.5 rounded">
                  <span>Lokasi Rak Simpan:</span>
                  <span>{order.rackLocation}</span>
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              --------------------------------
            </div>

            {/* Layanan & Kecepatan */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>Kecepatan:</span>
                <span className="font-bold">
                  {order.serviceSpeed === 'EXPRESS_6H' 
                    ? '🚀 Super Express (6 Jam)' 
                    : order.serviceSpeed === 'KILAT_24H'
                    ? '⚡ Kilat (24 Jam)'
                    : 'Reguler (2-3 Hari)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Aroma Parfum:</span>
                <span className="font-bold text-slate-700">{order.perfumeVariant || 'Sakura Fresh'}</span>
              </div>
              {order.estimatedDoneAt && (
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Est. Selesai:</span>
                  <span>{formatDate(order.estimatedDoneAt)} {formatTime(order.estimatedDoneAt)}</span>
                </div>
              )}
              {order.itemCountNotes && (
                <div className="flex justify-between text-slate-600">
                  <span>Jumlah Potong:</span>
                  <span className="font-bold">{order.itemCountNotes}</span>
                </div>
              )}
              {order.specialNotes && (
                <div className="text-[9px] text-amber-700 bg-amber-50 p-1 rounded border border-amber-200 mt-1">
                  Catatan: {order.specialNotes}
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              --------------------------------
            </div>

            {/* Daftar Layanan Cucian */}
            <div className="space-y-1.5 text-[10px] mb-2">
              {(order.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <div className="font-bold leading-tight">{it.serviceName}</div>
                    <div className="text-[9px] text-slate-500">
                      {it.qty} {String(it.unitType || 'KG').toLowerCase()} × {formatCurrency(it.pricePerUnit)}
                    </div>
                  </div>
                  <div className="font-bold text-right shrink-0">
                    {formatCurrency(it.subtotal)}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              --------------------------------
            </div>

            {/* Perhitungan Finansial */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal || totalAmount)}</span>
              </div>
              {order.speedSurcharge > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Biaya Express/Kilat:</span>
                  <span>+{formatCurrency(order.speedSurcharge)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Diskon:</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-black border-t border-slate-300 pt-1">
                <span>TOTAL:</span>
                <span className="text-sm">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bayar:</span>
                <span>{formatCurrency(paidAmount)}</span>
              </div>

              {/* Status Sisa Pembayaran */}
              <div className="border-t border-dashed border-slate-300 pt-1 mt-1">
                {isPaidLunas ? (
                  <div className="text-center p-1 bg-emerald-50 text-emerald-800 font-black text-xs rounded border border-emerald-200">
                    *** LUNAS ***
                  </div>
                ) : (
                  <div className="p-1 bg-amber-50 text-amber-900 font-bold text-[11px] rounded border border-amber-200 flex justify-between">
                    <span>SISA TAGIHAN:</span>
                    <span className="font-black text-xs text-rose-700">{formatCurrency(remainingDue)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-2">
              ================================
            </div>

            {/* Klausul Syarat & Ketentuan (Anti Sengketa) */}
            <div className="space-y-1 text-[8.5px] text-slate-500 leading-tight text-justify">
              <div className="font-bold text-center text-slate-700 uppercase mb-0.5">Syarat & Ketentuan:</div>
              <p>1. Pengambilan cucian wajib menunjukkan struk ini / bukti WA resmi.</p>
              <p>2. Komplain kehilangan/cacat maksimal 1x24 jam sejak barang diserahkan.</p>
              <p>3. Pakaian susut/luntur akibat sifat alami kain di luar tanggung jawab kami.</p>
              <p>4. Pakaian yang tidak diambil lebih dari 30 hari di luar tanggung jawab laundry.</p>
            </div>

            <div className="text-center text-[10px] text-slate-600 font-bold mt-3 pt-2 border-t border-slate-200">
              Terima Kasih Atas Kepercayaan Anda!
            </div>
            <div className="text-center text-[8px] text-slate-400 mt-0.5">
              Powered by CodePOS Laundry SaaS
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default LaundryReceiptPrinter;
