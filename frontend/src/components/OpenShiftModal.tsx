import React, { useState, useEffect, useContext } from 'react';
import { X, Lock, Unlock, Printer, FileText } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { offlineDB } from '../utils/offlineDb';
import { exportShiftSettlementPDF } from '../utils/pdfGenerator';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'open' | 'close';
}

const OpenShiftModal: React.FC<OpenShiftModalProps> = ({ isOpen, onClose, onSuccess, mode }) => {
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const posContext = useContext(POSContext);

  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDisplayAmount('');
      setSummary(null);
      if (mode === 'close') {
        fetchSummary();
      }
    }
  }, [isOpen, mode]);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/shifts/current-summary', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('id-ID');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    setDisplayAmount(formatInputNumber(rawVal));
    setAmount(rawVal);
  };

  const handlePrintThermalSlip = () => {
    if (!summary) return;
    const storeName = posContext?.settings?.storeName || 'MUKI RAMEN';
    const cashier = posContext?.user?.username || summary.activeShift?.user?.name || 'Kasir';
    const waktuBuka = new Date(summary.activeShift.waktuBuka).toLocaleString('id-ID');
    const waktuTutup = new Date().toLocaleString('id-ID');
    const saldoAwal = summary.activeShift.saldoAwal;
    const cashSales = summary.cashSales;
    const nonCashSales = summary.nonCashSales;
    const voidCash = summary.voidCashTotal || 0;
    const manualNet = summary.manualCashIn - summary.manualCashOut;
    const debtCash = summary.cashDebtIncome || 0;
    const saldoSistem = summary.expectedCash;
    const fisikLaci = Number(amount) || 0;
    const selisih = fisikLaci - saldoSistem;

    const receiptContent = `
================================
     REKAP PENUTUPAN SHIFT
       ${storeName}
================================
ID Shift    : #${summary.activeShift.id}
Kasir       : ${cashier}
Buka Shift  : ${waktuBuka}
Tutup Shift : ${waktuTutup}
--------------------------------
Modal Awal        : Rp ${saldoAwal.toLocaleString('id-ID')}
Penjualan Tunai   : Rp ${cashSales.toLocaleString('id-ID')}
Penjualan Non-Kas : Rp ${nonCashSales.toLocaleString('id-ID')}
${voidCash > 0 ? `Void Tunai (${summary.voidCount || 0}x)  : -Rp ${voidCash.toLocaleString('id-ID')}\n` : ''}${debtCash > 0 ? `Pelunasan Piutang : +Rp ${debtCash.toLocaleString('id-ID')}\n` : ''}Kas Masuk/Keluar  : ${manualNet >= 0 ? '+' : ''}Rp ${manualNet.toLocaleString('id-ID')}
--------------------------------
SALDO SISTEM      : Rp ${saldoSistem.toLocaleString('id-ID')}
FISIK LACI        : Rp ${fisikLaci.toLocaleString('id-ID')}
SELISIH           : ${selisih === 0 ? 'Rp 0 (PAS)' : (selisih > 0 ? `+Rp ${selisih.toLocaleString('id-ID')} (LEBIH)` : `-Rp ${Math.abs(selisih).toLocaleString('id-ID')} (KURANG)`)}
================================
TTD Kasir:        TTD Supervisor:


(............)    (............)
================================
`;

    const win = window.open('', '', 'width=350,height=500');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Struk Tutup Shift - #${summary.activeShift.id}</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; line-height: 1.3; }
              pre { margin: 0; font-family: inherit; font-size: 11px; }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
            <script>
              window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 800); }
            </script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const handleDownloadPDF = async () => {
    if (!summary) return;
    try {
      setGeneratingPdf(true);
      const shiftPayload = {
        id: summary.activeShift.id,
        waktuBuka: summary.activeShift.waktuBuka,
        waktuTutup: new Date().toISOString(),
        saldoAwal: summary.activeShift.saldoAwal,
        cashSales: summary.cashSales,
        nonCashSales: summary.nonCashSales,
        voidCount: summary.voidCount,
        voidCashTotal: summary.voidCashTotal,
        voidNonCashTotal: summary.voidNonCashTotal,
        manualCashIn: summary.manualCashIn,
        manualCashOut: summary.manualCashOut,
        cashDebtIncome: summary.cashDebtIncome,
        saldoSistem: summary.expectedCash,
        saldoFisikLaci: Number(amount) || 0,
        selisih: (Number(amount) || 0) - summary.expectedCash,
        user: summary.activeShift.user
      };
      await exportShiftSettlementPDF(
        posContext?.settings || {},
        shiftPayload,
        posContext?.user?.username || summary.activeShift.user?.name || 'Kasir'
      );
      toast('Berita Acara Shift (PDF) berhasil diunduh!', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal membuat PDF Shift', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'close') {
      try {
        const queue = await offlineDB.getOfflineQueue();
        if (queue.length > 0) {
          toast(`Tidak dapat menutup shift. Masih ada ${queue.length} transaksi offline yang belum disinkronisasikan ke server. Harap hubungkan internet dan tunggu sinkronisasi selesai!`, 'error');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Gagal mengecek antrean offline:', err);
      }
    }

    try {
      const url = mode === 'open' ? '/api/shifts/open' : '/api/shifts/close';
      const body = mode === 'open' ? { saldoAwal: amount } : { saldoFisikLaci: amount };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        toast(data.error || 'Gagal memproses shift', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setLoading(false);
      setAmount('');
      setDisplayAmount('');
    }
  };

  const isOpenMode = mode === 'open';

  return (
    <div className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className={`p-5 border-b border-slate-100 flex items-center justify-between shrink-0 ${isOpenMode ? 'bg-indigo-50/50' : 'bg-rose-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOpenMode ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'}`}>
              {isOpenMode ? <Unlock size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isOpenMode ? 'Buka Shift (Mulai Harian)' : 'Tutup Shift (Akhiri Harian)'}
              </h2>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mt-0.5">
                {isOpenMode ? 'Mulai Shift Kasir' : 'Rekonsiliasi Kas & Laci'}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors border border-slate-100 shadow-sm"
            onClick={onClose} 
            disabled={loading}
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              {isOpenMode 
                ? 'Masukkan jumlah uang tunai fisik yang ada di laci kasir saat ini sebagai saldo modal awal untuk kembalian.'
                : 'Hitung total uang fisik di laci kasir saat ini secara teliti. Sistem akan mencocokkannya dengan omset tunai.'}
            </p>

            {mode === 'close' && (
              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ringkasan Finansial Shift</h4>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrintThermalSlip}
                      disabled={!summary}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                      title="Cetak Struk Thermal 58/80mm"
                    >
                      <Printer size={12} className="text-indigo-600" /> Struk
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      disabled={!summary || generatingPdf}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                      title="Unduh Berita Acara Shift PDF"
                    >
                      <FileText size={12} className="text-rose-600" /> {generatingPdf ? '...' : 'PDF'}
                    </button>
                  </div>
                </div>

                {summaryLoading ? (
                  <p className="text-xs text-slate-400 animate-pulse py-2">Memuat ringkasan sistem...</p>
                ) : summary ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modal Awal Kasir:</span>
                      <span className="font-bold text-slate-700">Rp {summary.activeShift.saldoAwal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penjualan Tunai:</span>
                      <span className="font-bold text-slate-700">Rp {summary.cashSales.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penjualan Non-Tunai:</span>
                      <span className="font-semibold text-slate-600">Rp {summary.nonCashSales.toLocaleString('id-ID')}</span>
                    </div>
                    {summary.voidCashTotal > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Void Tunai ({summary.voidCount}x):</span>
                        <span className="font-bold">-Rp {summary.voidCashTotal.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kas Masuk/Keluar:</span>
                      <span className={`font-bold ${summary.manualCashIn - summary.manualCashOut >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {summary.manualCashIn - summary.manualCashOut >= 0 ? '+' : ''}Rp {(summary.manualCashIn - summary.manualCashOut).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 my-1 pt-1.5 flex justify-between font-black text-indigo-700 text-sm">
                      <span>Ekspektasi Uang Tunai:</span>
                      <span>Rp {summary.expectedCash.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-500 font-medium">Gagal memuat ringkasan sistem.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {isOpenMode ? 'Modal Awal Kasir' : 'Total Uang Fisik di Laci'}
              </label>
              
              <div className="relative flex items-center">
                <span className="absolute left-4 text-slate-400 font-bold text-lg select-none">Rp</span>
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl text-xl font-black text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm" 
                  placeholder="0"
                  value={displayAmount}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            {mode === 'close' && summary && amount && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex justify-between items-center ${
                Number(amount) - summary.expectedCash === 0 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : Number(amount) - summary.expectedCash > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                <span>Selisih Kas Laci:</span>
                <span className="text-sm font-black">
                  {Number(amount) - summary.expectedCash > 0 ? '+' : ''}
                  Rp {(Number(amount) - summary.expectedCash).toLocaleString('id-ID')}
                  {Number(amount) - summary.expectedCash === 0 ? ' (Pas)' : Number(amount) - summary.expectedCash > 0 ? ' (Lebih)' : ' (Kurang)'}
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
            <button 
              type="button" 
              className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center" 
              onClick={onClose} 
              disabled={loading}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className={`flex-1 py-3 px-4 rounded-2xl text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center shadow-md ${
                isOpenMode 
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' 
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
              }`}
              disabled={loading}
            >
              {loading ? 'Memproses...' : (isOpenMode ? 'Mulai Shift' : 'Tutup & Rekap')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OpenShiftModal;
