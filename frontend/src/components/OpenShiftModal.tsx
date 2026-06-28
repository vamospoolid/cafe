import React, { useState, useEffect, useContext } from 'react';
import { X, Lock, Unlock } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${isOpenMode ? 'bg-indigo-50/50' : 'bg-rose-50/50'}`}>
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
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <p className="text-xs text-slate-400 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {isOpenMode 
                ? 'Masukkan jumlah uang tunai fisik yang ada di laci kasir saat ini sebagai saldo modal awal. Ini digunakan untuk melacak total selisih kas harian.'
                : 'Hitung total uang fisik di laci kasir saat ini secara teliti. Sistem akan otomatis mencocokkannya dengan pencatatan penjualan tunai hari ini.'}
            </p>

            {mode === 'close' && (
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ringkasan Penjualan Shift</h4>
                {summaryLoading ? (
                  <p className="text-xs text-slate-400 animate-pulse">Memuat ringkasan sistem...</p>
                ) : summary ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Modal Awal (Tunai):</span>
                      <span className="font-bold text-slate-700">Rp {summary.activeShift.saldoAwal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Penjualan Tunai:</span>
                      <span className="font-bold text-slate-700">Rp {summary.cashSales.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kas Masuk/Keluar:</span>
                      <span className={`font-bold ${summary.manualCashIn - summary.manualCashOut >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                        {summary.manualCashIn - summary.manualCashOut >= 0 ? '+' : ''}Rp {(summary.manualCashIn - summary.manualCashOut).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 my-1 pt-1.5 flex justify-between font-bold text-indigo-600">
                      <span>Ekspektasi Uang Tunai:</span>
                      <span>Rp {summary.expectedCash.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 my-1 pt-1.5 flex justify-between font-bold text-emerald-600">
                      <span>Ekspektasi Uang Non-Tunai:</span>
                      <span>Rp {summary.expectedNonCash.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-500 font-medium">Gagal memuat ringkasan sistem.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                {isOpenMode ? 'Modal Awal Kasir' : 'Total Uang Fisik di Laci'}
              </label>
              
              <div className="relative flex items-center">
                <span className="absolute left-4 text-slate-400 font-bold text-lg select-none">Rp</span>
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl text-xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm" 
                  placeholder="0"
                  value={displayAmount}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            {mode === 'close' && summary && amount && (
              <div className={`p-4 rounded-2xl border text-xs font-bold flex justify-between items-center ${
                Number(amount) - summary.expectedCash === 0 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : Number(amount) - summary.expectedCash > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                <span>Selisih Kas Tunai:</span>
                <span>
                  {Number(amount) - summary.expectedCash > 0 ? '+' : ''}
                  Rp {(Number(amount) - summary.expectedCash).toLocaleString('id-ID')}
                  {Number(amount) - summary.expectedCash === 0 ? ' (Pas)' : Number(amount) - summary.expectedCash > 0 ? ' (Kelebihan)' : ' (Kekurangan)'}
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
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
