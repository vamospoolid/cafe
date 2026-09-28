import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Unlock, Printer, FileText, EyeOff, Calculator, Banknote, ShieldAlert, CheckCircle2, RotateCcw, AlertTriangle, ArrowRight } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import { offlineDB } from '../utils/offlineDb';
import { exportShiftSettlementPDF } from '../utils/pdfGenerator';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'open' | 'close';
  isForceClose?: boolean;
}

const DENOMINATIONS = [
  { key: '100000', label: '100.000', value: 100000, badge: 'Merah', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: '50000',  label: '50.000',  value: 50000,  badge: 'Biru',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: '20000',  label: '20.000',  value: 20000,  badge: 'Hijau', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: '10000',  label: '10.000',  value: 10000,  badge: 'Ungu',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: '5000',   label: '5.000',   value: 5000,   badge: 'Kuning',color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: '2000',   label: '2.000',   value: 2000,   badge: 'Abu',   color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { key: '1000',   label: '1.000',   value: 1000,   badge: 'Krem',  color: 'bg-stone-50 text-stone-700 border-stone-200' },
];

const OpenShiftModal: React.FC<OpenShiftModalProps> = ({ isOpen, onClose, onSuccess, mode }) => {
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState<'open' | 'close'>(mode);
  const [existingShift, setExistingShift] = useState<any>(null);
  const [checkingShift, setCheckingShift] = useState(false);

  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const posContext = useContext(POSContext);

  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Blind Count & Denomination State
  const [countMethod, setCountMethod] = useState<'calculator' | 'direct'>('calculator');
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    '100000': 0,
    '50000': 0,
    '20000': 0,
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    'coins': 0
  });
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
      setAmount('');
      setDisplayAmount('');
      setCatatan('');
      setCountMethod('calculator');
      setDenominations({
        '100000': 0,
        '50000': 0,
        '20000': 0,
        '10000': 0,
        '5000': 0,
        '2000': 0,
        '1000': 0,
        'coins': 0
      });
      setSummary(null);
      setExistingShift(null);

      // Cek shift aktif dari server untuk mencegah deadlock
      checkActiveShift(mode);
    }
  }, [isOpen, mode]);

  const checkActiveShift = async (targetMode: 'open' | 'close') => {
    setCheckingShift(true);
    try {
      const res = await fetch('/api/shifts/current', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setExistingShift(data);
          if (targetMode === 'close') {
            fetchSummary();
          }
        } else {
          setExistingShift(null);
          if (targetMode === 'close') {
            fetchSummary();
          }
        }
      }
    } catch (err) {
      console.error('Error checking active shift:', err);
    } finally {
      setCheckingShift(false);
    }
  };

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

  const isBlindMode = currentMode === 'close' && summary?.isBlindMode;

  const calculateTotalFromDenoms = (denoms: { [key: string]: number }) => {
    return Object.entries(denoms).reduce((sum, [k, count]) => {
      if (k === 'coins') return sum + (Number(count) || 0);
      return sum + (Number(k) * (Number(count) || 0));
    }, 0);
  };

  const updateDenom = (key: string, val: number) => {
    const next = { ...denominations, [key]: Math.max(0, val) };
    setDenominations(next);
    const total = calculateTotalFromDenoms(next);
    setAmount(String(total));
    setDisplayAmount(total.toLocaleString('id-ID'));
  };

  const handleResetDenom = () => {
    const reset = {
      '100000': 0, '50000': 0, '20000': 0, '10000': 0,
      '5000': 0, '2000': 0, '1000': 0, 'coins': 0
    };
    setDenominations(reset);
    setAmount('');
    setDisplayAmount('');
  };

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
    const fisikLaci = Number(amount) || 0;

    let receiptContent = '';

    if (isBlindMode) {
      // Blind Mode Receipt: Cetak bukti fisik murni tanpa membocorkan saldo sistem
      const denomRows = DENOMINATIONS
        .filter(d => (denominations[d.key] || 0) > 0)
        .map(d => `Rp ${d.label.padEnd(8)} x ${(denominations[d.key] || 0).toString().padStart(3)} = Rp ${(d.value * (denominations[d.key] || 0)).toLocaleString('id-ID')}`)
        .join('\n');

      receiptContent = `
================================
     BUKTI FISIK TUTUP SHIFT
        (BLIND COUNT)
       ${storeName}
================================
ID Shift    : #${summary.activeShift.id}
Kasir       : ${cashier}
Waktu Buka  : ${waktuBuka}
Waktu Tutup : ${waktuTutup}
--------------------------------
RINCIAN FISIK UANG DI LACI:
${denomRows || '- Total dimasukkan manual -'}
${denominations.coins > 0 ? `Total Uang Koin    : Rp ${denominations.coins.toLocaleString('id-ID')}\n` : ''}--------------------------------
TOTAL FISIK LACI : Rp ${fisikLaci.toLocaleString('id-ID')}
${catatan ? `Catatan: ${catatan}\n` : ''}--------------------------------
Status: Rekonsiliasi Otomatis Pusat.
Angka fisik di atas telah tersimpan
secara aman untuk audit Owner.

TTD Kasir:        TTD Supervisor:


(............)    (............)
================================
`;
    } else {
      // Privileged / Non-Blind Receipt
      const saldoAwal = summary.activeShift.saldoAwal;
      const cashSales = summary.cashSales || 0;
      const nonCashSales = summary.nonCashSales || 0;
      const voidCash = summary.voidCashTotal || 0;
      const manualNet = (summary.manualCashIn || 0) - (summary.manualCashOut || 0);
      const debtCash = summary.cashDebtIncome || 0;
      const saldoSistem = summary.expectedCash || 0;
      const selisih = fisikLaci - saldoSistem;

      receiptContent = `
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
    }

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
        saldoAwal: summary.activeShift.saldoAwal || 0,
        cashSales: summary.cashSales || 0,
        nonCashSales: summary.nonCashSales || 0,
        voidCount: summary.voidCount || 0,
        voidCashTotal: summary.voidCashTotal || 0,
        voidNonCashTotal: summary.voidNonCashTotal || 0,
        manualCashIn: summary.manualCashIn || 0,
        manualCashOut: summary.manualCashOut || 0,
        cashDebtIncome: summary.cashDebtIncome || 0,
        saldoSistem: summary.expectedCash || 0,
        saldoFisikLaci: Number(amount) || 0,
        selisih: isBlindMode ? null : ((Number(amount) || 0) - (summary.expectedCash || 0)),
        user: summary.activeShift.user,
        isBlindCount: isBlindMode,
        cashDenominations: denominations,
        catatan: catatan
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
      const url = currentMode === 'open' ? '/api/shifts/open' : '/api/shifts/close';
      let body: any = currentMode === 'open' 
        ? { saldoAwal: amount } 
        : { 
            saldoFisikLaci: amount,
            cashDenominations: denominations,
            catatan: catatan.trim() || undefined
          };

      let res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(body)
      });
      
      let data = await res.json();

      // Jika ada pesanan belum lunas saat tutup shift
      if (!res.ok && data?.hasPendingOrders) {
        const confirm = await confirmAlert(
          'Pesanan Belum Lunas Terdeteksi',
          `${data.error}\n\nApakah Anda yakin ingin TETAP MEMAKSA menutup shift? (Pesanan yang belum lunas akan tetap berstatus Pending untuk shift berikutnya).`
        );

        if (confirm.isConfirmed) {
          body.forceClose = true;
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${posContext?.token}`
            },
            body: JSON.stringify(body)
          });
          data = await res.json();
        } else {
          setLoading(false);
          return;
        }
      }

      if (res.ok) {
        if (currentMode === 'open') {
          toast('✅ Shift kasir berhasil dibuka! Selamat bertugas.', 'success');
        } else {
          toast(data.message || '✅ Shift berhasil ditutup dan data kas fisik telah diverifikasi.', 'success');
        }
        await posContext?.fetchActiveShift();
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
      setCatatan('');
    }
  };

  const isOpenMode = currentMode === 'open';

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
      <div className={`bg-white w-full h-full sm:h-auto ${currentMode === 'close' ? 'sm:max-w-lg' : 'sm:max-w-md'} sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 sm:max-h-[92vh] flex flex-col justify-between`}>
        
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 ${isOpenMode ? 'bg-indigo-50/50' : 'bg-rose-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${isOpenMode ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'}`}>
              {isOpenMode ? <Unlock size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  {isOpenMode ? 'Buka Shift (Mulai Harian)' : 'Tutup Shift (Akhiri Harian)'}
                </h2>
                {isBlindMode && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 flex items-center gap-1 shadow-sm">
                    <EyeOff size={11} /> BLIND COUNT
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mt-0.5">
                {isOpenMode ? 'Mulai Shift Kasir' : (isBlindMode ? 'Penghitungan Kas Objektif Kasir' : 'Rekonsiliasi Kas & Laci')}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between min-h-0">
          <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto pb-16 sm:pb-4">
            
            {/* ─── KASUS 1: MODE BUKA SHIFT TAPI ADA SHIFT YANG MASIH AKTIF (SMART RESOLUTION BANNER) ─── */}
            {isOpenMode && existingShift && (
              <div className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-5 flex flex-col gap-4 shadow-sm animate-in fade-in zoom-in-95">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">Shift Kasir Sedang Aktif</h4>
                    <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                      Sistem mendeteksi ada sesi kasir yang sedang berjalan. Anda tidak perlu membuka shift baru, atau silakan tutup shift ini terlebih dahulu untuk rekonsiliasi kas.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-2xl border border-amber-200/60 text-xs space-y-2.5 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Kasir Bertugas:</span>
                    <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {existingShift.user?.name || existingShift.user?.username || 'Kasir'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Waktu Dibuka:</span>
                    <span className="font-bold text-slate-800">
                      {new Date(existingShift.waktuBuka).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Modal Awal Kas:</span>
                    <span className="font-black text-emerald-600 text-sm">
                      Rp {Number(existingShift.saldoAwal || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentMode('close');
                      fetchSummary();
                    }}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-rose-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock size={15} /> Tutup Shift Kasir Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/pos');
                    }}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Unlock size={15} /> Lanjut ke Kasir (POS)
                  </button>
                </div>
              </div>
            )}

            {/* Notice / Guidance */}
            {isOpenMode && !existingShift ? (
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                Masukkan jumlah uang tunai fisik yang ada di laci kasir saat ini sebagai saldo modal awal untuk kembalian.
              </p>
            ) : !isOpenMode && isBlindMode ? (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 p-3.5 rounded-2xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <EyeOff size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-[12px] text-amber-950 flex items-center gap-1.5">
                    Mode Blind Cash Drawer Count Aktif
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                    Saldo ekspektasi sistem disembunyikan. Harap hitung uang fisik riil di laci kasir secara objektif. Sistem pusat akan mencocokkan rekonsiliasi otomatis untuk laporan Owner.
                  </p>
                </div>
              </div>
            ) : !isOpenMode ? (
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                Hitung total uang fisik di laci kasir saat ini secara teliti. Sistem akan mencocokkannya dengan omset tunai.
              </p>
            ) : null}

            {/* Non-Blind Financial Summary (Only for Admin/Owner or if blind disabled) */}
            {currentMode === 'close' && !isBlindMode && (
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
                      <span className="font-bold text-slate-700">Rp {(summary.activeShift?.saldoAwal || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penjualan Tunai:</span>
                      <span className="font-bold text-slate-700">Rp {(summary.cashSales || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penjualan Non-Tunai:</span>
                      <span className="font-semibold text-slate-600">Rp {(summary.nonCashSales || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {summary.voidCashTotal > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Void Tunai ({summary.voidCount}x):</span>
                        <span className="font-bold">-Rp {summary.voidCashTotal.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kas Masuk/Keluar:</span>
                      <span className={`font-bold ${(summary.manualCashIn || 0) - (summary.manualCashOut || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(summary.manualCashIn || 0) - (summary.manualCashOut || 0) >= 0 ? '+' : ''}Rp {((summary.manualCashIn || 0) - (summary.manualCashOut || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 my-1 pt-1.5 flex justify-between font-black text-indigo-700 text-sm">
                      <span>Ekspektasi Uang Tunai:</span>
                      <span>Rp {(summary.expectedCash || 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-500 font-medium">Gagal memuat ringkasan sistem.</p>
                )}
              </div>
            )}

            {/* Close Shift: Method Selector (Kalkulator Lembar vs Input Cepat) */}
            {mode === 'close' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote size={15} className="text-emerald-600" />
                    <span>Metode Hitung Kas Fisik</span>
                  </label>
                  
                  <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setCountMethod('calculator')}
                      className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${countMethod === 'calculator' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Calculator size={12} /> Pecahan Lembar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountMethod('direct')}
                      className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${countMethod === 'direct' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Total Cepat
                    </button>
                  </div>
                </div>

                {/* Tab 1: Kalkulator Pecahan Uang Lembar */}
                {countMethod === 'calculator' ? (
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 border-b border-slate-200/60 pb-2">
                      <span>Pecahan Uang Tunai</span>
                      <button
                        type="button"
                        onClick={handleResetDenom}
                        className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-bold text-[10px]"
                      >
                        <RotateCcw size={10} /> Reset Hitungan
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {DENOMINATIONS.map(denom => {
                        const qty = denominations[denom.key] || 0;
                        const subtotal = qty * denom.value;
                        return (
                          <div key={denom.key} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-xl border border-slate-100 shadow-xs hover:border-slate-200 transition-all">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${denom.color} shrink-0 w-24 text-center`}>
                              Rp {denom.label}
                            </span>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateDenom(denom.key, qty - 1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-colors active:scale-95"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={qty === 0 ? '' : qty}
                                placeholder="0"
                                onChange={(e) => updateDenom(denom.key, parseInt(e.target.value) || 0)}
                                className="w-12 h-7 text-center font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => updateDenom(denom.key, qty + 1)}
                                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center transition-colors active:scale-95"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-right text-xs font-bold text-slate-700 min-w-[70px]">
                              {subtotal > 0 ? `Rp ${subtotal.toLocaleString('id-ID')}` : '-'}
                            </span>
                          </div>
                        );
                      })}

                      {/* Baris Total Koin Logam */}
                      <div className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-xl border border-slate-100 shadow-xs">
                        <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200 shrink-0 w-24 text-center">
                          Total Koin
                        </span>
                        
                        <div className="flex-1 px-2">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            placeholder="Nominal koin (Rp)"
                            value={denominations.coins === 0 ? '' : denominations.coins}
                            onChange={(e) => updateDenom('coins', parseInt(e.target.value) || 0)}
                            className="w-full h-7 px-2 font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <span className="text-right text-xs font-bold text-slate-700 min-w-[70px]">
                          {denominations.coins > 0 ? `Rp ${denominations.coins.toLocaleString('id-ID')}` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Input Nominal Total (Hanya tampil jika tutup shift atau buka shift saat TIDAK ada shift aktif) */}
            {(!isOpenMode || !existingShift) && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {isOpenMode ? 'Modal Awal Kasir' : 'Total Fisik Kas Terhitung'}
                  </label>
                  {currentMode === 'close' && (
                    <span className="text-[11px] text-emerald-600 font-extrabold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Terkalkulasi Otomatis
                    </span>
                  )}
                </div>
                
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-slate-400 font-bold text-lg select-none">Rp</span>
                  <input 
                    type="text" 
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl text-xl font-black text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm" 
                    placeholder="0"
                    value={displayAmount}
                    onChange={handleInputChange}
                    required={!isOpenMode || !existingShift}
                  />
                </div>
              </div>
            )}

            {/* Non-blind Selisih Display (Only shown if NOT blind mode) */}
            {currentMode === 'close' && !isBlindMode && summary && amount && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex justify-between items-center ${
                Number(amount) - (summary.expectedCash || 0) === 0 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : Number(amount) - (summary.expectedCash || 0) > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                <span>Selisih Kas Laci:</span>
                <span className="text-sm font-black">
                  {Number(amount) - (summary.expectedCash || 0) > 0 ? '+' : ''}
                  Rp {(Number(amount) - (summary.expectedCash || 0)).toLocaleString('id-ID')}
                  {Number(amount) - (summary.expectedCash || 0) === 0 ? ' (Pas)' : Number(amount) - (summary.expectedCash || 0) > 0 ? ' (Lebih)' : ' (Kurang)'}
                </span>
              </div>
            )}

            {/* Optional Cashier Notes during close shift */}
            {currentMode === 'close' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Catatan Kasir / Kondisi Laci (Opsional)
                </label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  placeholder="Contoh: Ada 1 lembar uang robek Rp 2.000, atau laci macet..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>
            )}

            {/* Thermal Print & PDF Buttons in Close Mode */}
            {currentMode === 'close' && summary && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrintThermalSlip}
                  className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <Printer size={14} className="text-indigo-600" />
                  <span>Cetak Slip Fisik</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={generatingPdf}
                  className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <FileText size={14} className="text-rose-600" />
                  <span>{generatingPdf ? 'Membuat...' : 'Download PDF'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
            <button 
              type="button" 
              className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center cursor-pointer" 
              onClick={onClose} 
              disabled={loading}
            >
              {isOpenMode && existingShift ? 'Tutup Jendela' : 'Batal'}
            </button>
            {(!isOpenMode || !existingShift) && (
              <button 
                type="submit" 
                className={`flex-1 py-3 px-4 rounded-2xl text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center shadow-md cursor-pointer ${
                  isOpenMode 
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' 
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                }`}
                disabled={loading || !amount || Number(amount) < 0}
              >
                {loading ? 'Memproses...' : (isOpenMode ? 'Mulai Shift' : 'Tutup & Simpan Kas')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default OpenShiftModal;
