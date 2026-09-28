import React, { useContext, useRef } from 'react';
import { X, Printer, Download, Sparkles } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface PrintQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableData: any;
}

const PrintQRModal: React.FC<PrintQRModalProps> = ({ isOpen, onClose, tableData }) => {
  const posContext = useContext(POSContext);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !tableData) return null;

  const storeName = posContext?.settings?.storeName || 'MUKI RAMEN';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableData.url)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      toast(`Mengunduh Stand QR ${tableData.no}...`, 'info');
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Stand-QR-${tableData.no.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast('Stand QR berhasil diunduh!', 'success');
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh gambar', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in print:p-0 print:bg-transparent">
      {/* Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up print:shadow-none print:border-none print:w-auto">
        {/* Header (Hidden in print) */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Printer size={16} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">Cetak QR Stand Meja</h3>
              <p className="text-[10px] text-slate-400">Siap diletakkan di atas meja akrilik / tent card</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Stand Card Preview */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-50/30 print:p-0 print:bg-white">
          <div 
            ref={printAreaRef}
            className="w-64 bg-white border border-slate-200 shadow-lg rounded-2xl p-6 text-center flex flex-col items-center justify-center print:border-none print:shadow-none"
          >
            {/* Store Name Badge */}
            <div className="text-xs font-black uppercase tracking-wider text-indigo-700">
              {storeName}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Scan Meja untuk Pesan
            </div>

            {/* QR Code */}
            <div className="my-4 p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <img 
                src={qrUrl}
                alt={`QR Code ${tableData.no}`} 
                className="w-44 h-44 object-contain"
              />
            </div>

            {/* Table Number Footer */}
            <div className="border-t border-slate-100 pt-3 w-full">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">
                NOMOR MEJA
              </span>
              <span className="text-xl font-black text-slate-900 block mt-0.5">
                {tableData.no}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden in print) */}
        <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 gap-2 print:hidden">
          <button
            type="button"
            onClick={handleDownload}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Download size={14} />
            <span>Unduh PNG</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <Printer size={14} />
            <span>Cetak Stand</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintQRModal;
