import React, { useState, useEffect, useContext } from 'react';
import { 
  X, Lock, Unlock, Printer, FileText, CheckCircle2, 
  AlertTriangle, AlertCircle, Coins, Calculator, 
  ArrowRight, RefreshCw, ChevronDown, ChevronUp, ShieldCheck 
} from 'lucide-react';
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

interface Denominations {
  c100k: number;
  c50k: number;
  c20k: number;
  c10k: number;
  c5k: number;
  c2k: number;
  c1k: number;
  coins: number;
}

const DEFAULT_DENOMINATIONS: Denominations = {
  c100k: 0,
  c50k: 0,
  c20k: 0,
  c10k: 0,
  c5k: 0,
  c2k: 0,
  c1k: 0,
  coins: 0
};

const OpenShiftModal: React.FC<OpenShiftModalProps> = ({ isOpen, onClose, onSuccess, mode, isForceClose }) => {
  const posContext = useContext(POSContext);

  // General Form States
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [inputTab, setInputTab] = useState<'denominations' | 'manual'>('denominations');
  const [denominations, setDenominations] = useState<Denominations>(DEFAULT_DENOMINATIONS);
  const [varianceReason, setVarianceReason] = useState('');
  
  // Operating Hours & Supervisor Override
  const [requiresSupervisorPin, setRequiresSupervisorPin] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [outsideHoursWarning, setOutsideHoursWarning] = useState('');

  // Closing Flow State: 'form' | 'result'
  const [closeStep, setCloseStep] = useState<'form' | 'result'>('form');
  const [resultData, setResultData] = useState<any>(null);
  const [showDenomDetail, setShowDenomDetail] = useState(false);

  // Active shift basic info (in blind mode)
  const [activeShiftInfo, setActiveShiftInfo] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDisplayAmount('');
      setDenominations(DEFAULT_DENOMINATIONS);
      setVarianceReason('');
      setCloseStep('form');
      setResultData(null);
      setShowDenomDetail(false);
      setInputTab('denominations');
      setRequiresSupervisorPin(false);
      setSupervisorPin('');
      setOutsideHoursWarning('');

      if (mode === 'close') {
        fetchActiveShiftBlind();
      }
    }
  }, [isOpen, mode]);

  const fetchActiveShiftBlind = async () => {
    if (!navigator.onLine) {
      if (posContext?.activeShift) {
        setActiveShiftInfo(posContext.activeShift);
      }
      return;
    }
    try {
      const res = await fetch('/api/shifts/current-summary?blind=true', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShiftInfo(data.activeShift?.id ? data.activeShift : null);
      } else if (res.status === 404) {
        setActiveShiftInfo(null);
        if (posContext?.activeShift) {
          posContext.fetchActiveShift();
        }
      } else if (posContext?.activeShift?.id) {
        setActiveShiftInfo(posContext.activeShift);
      } else {
        setActiveShiftInfo(null);
      }
    } catch (err) {
      console.error('Gagal mengambil info shift:', err);
      if (posContext?.activeShift?.id) {
        setActiveShiftInfo(posContext.activeShift);
      } else {
        setActiveShiftInfo(null);
      }
    }
  };

  // Calculate total from denominations
  const totalFromDenominations = (
    (denominations.c100k * 100000) +
    (denominations.c50k * 50000) +
    (denominations.c20k * 20000) +
    (denominations.c10k * 10000) +
    (denominations.c5k * 5000) +
    (denominations.c2k * 2000) +
    (denominations.c1k * 1000) +
    (Number(denominations.coins) || 0)
  );

  // Sync total when denominations change
  useEffect(() => {
    if (mode === 'close' && inputTab === 'denominations') {
      setAmount(String(totalFromDenominations));
      setDisplayAmount(totalFromDenominations.toLocaleString('id-ID'));
    }
  }, [denominations, inputTab, mode, totalFromDenominations]);

  if (!isOpen) return null;

  const handleDenomChange = (key: keyof Denominations, val: string) => {
    const num = Math.max(0, parseInt(val.replace(/\D/g, '') || '0', 10));
    setDenominations(prev => ({
      ...prev,
      [key]: num
    }));
  };

  const handleDenomIncrement = (key: keyof Denominations, step: number) => {
    setDenominations(prev => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + step)
    }));
  };

  const formatInputNumber = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('id-ID');
  };

  const handleManualAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    setDisplayAmount(formatInputNumber(rawVal));
    setAmount(rawVal);
  };

  const handleQuickModalAwal = (val: number) => {
    setAmount(String(val));
    setDisplayAmount(val.toLocaleString('id-ID'));
  };

  const handlePrintThermalSlip = (dataToPrint?: any) => {
    const data = dataToPrint || resultData;
    if (!data) return;

    const storeName = posContext?.settings?.storeName || 'DEMO CAFE POS';
    const cashier = posContext?.user?.username || data.user?.name || data.user?.username || 'Kasir';
    const waktuBuka = data.waktuBuka ? new Date(data.waktuBuka).toLocaleString('id-ID') : '-';
    const waktuTutup = data.waktuTutup ? new Date(data.waktuTutup).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    const saldoAwal = Number(data.saldoAwal) || 0;
    const cashSales = Number(data.cashSales) || 0;
    const nonCashSales = Number(data.nonCashSales) || 0;
    const voidCash = Number(data.voidCashTotal) || 0;
    const manualNet = (Number(data.manualCashIn) || 0) - (Number(data.manualCashOut) || 0);
    const debtCash = Number(data.cashDebtIncome) || 0;
    const saldoSistem = Number(data.expectedCash ?? data.saldoSistem) || 0;
    const fisikLaci = Number(data.saldoFisikLaci) || 0;
    const selisih = Number(data.variance ?? data.selisih) || 0;
    const varianceStatus = data.varianceStatus || (selisih === 0 ? 'MATCHED' : selisih < 0 ? 'SHORT' : 'OVER');

    let parsedDenom: any = null;
    if (data.denominations) {
      try {
        parsedDenom = typeof data.denominations === 'string' ? JSON.parse(data.denominations) : data.denominations;
      } catch (e) {
        parsedDenom = null;
      }
    }

    const receiptContent = `
================================
     REKAP Z-REPORT TUTUP SHIFT
        ${storeName}
================================
ID Shift    : #${data.id || '-'}
Kasir       : ${cashier}
Buka Shift  : ${waktuBuka}
Tutup Shift : ${waktuTutup}
--------------------------------
RINGKASAN OMSET:
Modal Awal Kasir   : Rp ${saldoAwal.toLocaleString('id-ID')}
Penjualan Tunai    : Rp ${cashSales.toLocaleString('id-ID')}
Penjualan Non-Tunai: Rp ${nonCashSales.toLocaleString('id-ID')}
${voidCash > 0 ? `Void Tunai (${data.voidCount || 0}x)   : -Rp ${voidCash.toLocaleString('id-ID')}\n` : ''}${debtCash > 0 ? `Pelunasan Piutang  : +Rp ${debtCash.toLocaleString('id-ID')}\n` : ''}Kas Masuk/Keluar   : ${manualNet >= 0 ? '+' : ''}Rp ${manualNet.toLocaleString('id-ID')}
--------------------------------
REKONSILIASI KAS LACI:
Saldo Sistem Kas   : Rp ${saldoSistem.toLocaleString('id-ID')}
Fisik Laci Dihitung: Rp ${fisikLaci.toLocaleString('id-ID')}
STATUS SELISIH     : ${varianceStatus === 'MATCHED' ? 'Rp 0 (PAS / SEIMBANG)' : varianceStatus === 'SHORT' ? `-Rp ${Math.abs(selisih).toLocaleString('id-ID')} (KURANG/TEKOR)` : `+Rp ${selisih.toLocaleString('id-ID')} (LEBIH)`}
${data.varianceReason ? `Keterangan         : ${data.varianceReason}\n` : ''}--------------------------------
${parsedDenom ? `RINCIAN PECAHAN:
100.000 x ${parsedDenom.c100k || 0} = Rp ${((parsedDenom.c100k || 0) * 100000).toLocaleString('id-ID')}
 50.000 x ${parsedDenom.c50k || 0} = Rp ${((parsedDenom.c50k || 0) * 50000).toLocaleString('id-ID')}
 20.000 x ${parsedDenom.c20k || 0} = Rp ${((parsedDenom.c20k || 0) * 20000).toLocaleString('id-ID')}
 10.000 x ${parsedDenom.c10k || 0} = Rp ${((parsedDenom.c10k || 0) * 10000).toLocaleString('id-ID')}
  5.000 x ${parsedDenom.c5k || 0} = Rp ${((parsedDenom.c5k || 0) * 5000).toLocaleString('id-ID')}
  2.000 x ${parsedDenom.c2k || 0} = Rp ${((parsedDenom.c2k || 0) * 2000).toLocaleString('id-ID')}
  1.000 x ${parsedDenom.c1k || 0} = Rp ${((parsedDenom.c1k || 0) * 1000).toLocaleString('id-ID')}
  Koin/Lainnya   = Rp ${(parsedDenom.coins || 0).toLocaleString('id-ID')}
--------------------------------
` : ''}TTD Kasir:         TTD Supervisor:


(............)     (............)
================================
  Dicetak pada: ${new Date().toLocaleString('id-ID')}
`;

    const win = window.open('', '', 'width=360,height=600');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Struk Z-Report Tutup Shift - #${data.id}</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 10px; line-height: 1.35; }
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
    if (!resultData) return;
    try {
      setGeneratingPdf(true);
      const shiftPayload = {
        id: resultData.id,
        waktuBuka: resultData.waktuBuka,
        waktuTutup: resultData.waktuTutup || new Date().toISOString(),
        saldoAwal: resultData.saldoAwal,
        cashSales: resultData.cashSales,
        nonCashSales: resultData.nonCashSales,
        voidCount: resultData.voidCount,
        voidCashTotal: resultData.voidCashTotal,
        voidNonCashTotal: resultData.voidNonCashTotal,
        manualCashIn: resultData.manualCashIn,
        manualCashOut: resultData.manualCashOut,
        cashDebtIncome: resultData.cashDebtIncome,
        saldoSistem: resultData.expectedCash ?? resultData.saldoSistem,
        saldoFisikLaci: resultData.saldoFisikLaci,
        selisih: resultData.variance ?? resultData.selisih,
        user: resultData.user || { name: posContext?.user?.username || 'Kasir' }
      };
      await exportShiftSettlementPDF(
        posContext?.settings || {},
        shiftPayload,
        posContext?.user?.username || resultData.user?.name || 'Kasir'
      );
      toast('Berita Acara Z-Report Shift (PDF) berhasil diunduh!', 'success');
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
      if (!posContext?.activeShift?.id && !activeShiftInfo?.id) {
        toast('Tidak ada shift kasir yang aktif untuk ditutup. Silakan buka shift terlebih dahulu.', 'warning');
        setLoading(false);
        onClose();
        return;
      }

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

    // Jika perangkat sedang offline
    if (!navigator.onLine) {
      if (mode === 'open') {
        const offlineShift = {
          id: `OFF-SHIFT-${Date.now()}`,
          isOffline: true,
          saldoAwal: Number(amount) || 0,
          waktuBuka: new Date().toISOString(),
          status: 'Open',
          userId: posContext?.user?.id || 1,
          user: { name: posContext?.user?.name || posContext?.user?.username || 'Kasir Offline' }
        };
        posContext?.openOfflineShift(offlineShift);
        toast('✅ Shift kasir lokal (Mode Offline) berhasil dibuka! Selamat bertugas.', 'success');
        setLoading(false);
        onSuccess();
        onClose();
        return;
      } else {
        posContext?.closeOfflineShift();
        toast('✅ Shift kasir lokal (Mode Offline) berhasil ditutup.', 'success');
        setLoading(false);
        onSuccess();
        onClose();
        return;
      }
    }

    try {
      const url = mode === 'open' ? '/api/shifts/open' : '/api/shifts/close';
      let body: any = mode === 'open' 
        ? { saldoAwal: amount, supervisorPin: supervisorPin.trim() || undefined } 
        : { 
            saldoFisikLaci: amount,
            denominations: inputTab === 'denominations' ? denominations : null,
            varianceReason: varianceReason.trim()
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

      // Cek apakah memerlukan PIN Supervisor untuk override jam operasional
      if (!res.ok && data?.requiresSupervisorPin) {
        setRequiresSupervisorPin(true);
        setOutsideHoursWarning(data.error || 'Buka shift di luar jam operasional memerlukan PIN Supervisor.');
        toast(data.error || 'Memerlukan PIN Supervisor.', 'warning');
        setLoading(false);
        return;
      }

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
        if (mode === 'open') {
          toast('Shift berhasil dibuka! Selamat bertugas.', 'success');
          onSuccess();
          onClose();
        } else {
          // Tutup Shift Berhasil -> Beralih ke layar Hasil Z-Report
          setResultData(data);
          setCloseStep('result');
          toast('Shift berhasil ditutup. Rekonsiliasi Z-Report siap diperiksa.', 'success');
        }
      } else {
        toast(data.error || 'Gagal memproses shift', 'error');
      }
    } catch (err) {
      console.error(err);
      // Fallback jika fetch gagal karena koneksi terputus tiba-tiba
      if (mode === 'open') {
        const offlineShift = {
          id: `OFF-SHIFT-${Date.now()}`,
          isOffline: true,
          saldoAwal: Number(amount) || 0,
          waktuBuka: new Date().toISOString(),
          status: 'Open',
          userId: posContext?.user?.id || 1,
          user: { name: posContext?.user?.name || posContext?.user?.username || 'Kasir Offline' }
        };
        posContext?.openOfflineShift(offlineShift);
        toast('⚠️ Jaringan offline. Shift kasir berhasil dibuka secara lokal.', 'warning');
        onSuccess();
        onClose();
        return;
      } else {
        posContext?.closeOfflineShift();
        toast('⚠️ Jaringan offline. Shift ditutup secara lokal.', 'warning');
        onSuccess();
        onClose();
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinishClose = () => {
    onSuccess();
    onClose();
  };

  const isOpenMode = mode === 'open';

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 sm:max-h-[92vh] flex flex-col justify-between">
        
        {/* Header Modal */}
        <div className={`p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 ${
          isOpenMode 
            ? 'bg-gradient-to-r from-indigo-50 to-blue-50/50' 
            : closeStep === 'result' 
              ? resultData?.varianceStatus === 'MATCHED'
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50'
                : resultData?.varianceStatus === 'SHORT'
                  ? 'bg-gradient-to-r from-rose-50 to-pink-50/50'
                  : 'bg-gradient-to-r from-amber-50 to-orange-50/50'
              : 'bg-gradient-to-r from-rose-50 to-red-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${
              isOpenMode 
                ? 'bg-indigo-600 text-white' 
                : closeStep === 'result'
                  ? resultData?.varianceStatus === 'MATCHED'
                    ? 'bg-emerald-600 text-white'
                    : resultData?.varianceStatus === 'SHORT'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-600 text-white'
                  : 'bg-rose-600 text-white'
            }`}>
              {isOpenMode ? <Unlock size={22} /> : closeStep === 'result' ? <ShieldCheck size={22} /> : <Lock size={22} />}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                {isOpenMode 
                  ? 'Buka Shift Kasir (Mulai Harian)' 
                  : closeStep === 'result' 
                    ? 'Hasil Rekonsiliasi Z-Report' 
                    : 'Tutup Shift (Blind Cash Counter)'}
              </h2>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                {isOpenMode 
                  ? 'Input Saldo Kas Awal' 
                  : closeStep === 'result'
                    ? `Shift #${resultData?.id || ''} • Selesai`
                    : activeShiftInfo ? `Shift #${activeShiftInfo.id} • ${activeShiftInfo.user?.name || 'Kasir'}` : 'Rekonsiliasi Kas Laci'}
              </span>
            </div>
          </div>

          <button 
            type="button" 
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border shadow-sm ${
              isForceClose && closeStep !== 'result'
                ? 'bg-rose-50 border-rose-200 text-rose-400 hover:text-rose-600'
                : 'bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-slate-200/70'
            }`}
            onClick={() => {
              if (closeStep === 'result') {
                handleFinishClose();
              } else if (isForceClose) {
                toast('⚠️ Wajib menyelesaikan Tutup Shift kasir karena jam operasional toko telah berakhir.', 'warning');
              } else {
                onClose();
              }
            }} 
            disabled={loading}
            title={isForceClose && closeStep !== 'result' ? 'Wajib Tutup Shift' : 'Tutup'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: STEP RESULT (Post-Closing Z-Report View) */}
        {mode === 'close' && closeStep === 'result' && resultData && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm ${
              resultData.varianceStatus === 'MATCHED'
                ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                : resultData.varianceStatus === 'SHORT'
                  ? 'bg-rose-50 border-rose-200/80 text-rose-800'
                  : 'bg-amber-50 border-amber-200/80 text-amber-800'
            }`}>
              <div className={`p-2.5 rounded-xl ${
                resultData.varianceStatus === 'MATCHED' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : resultData.varianceStatus === 'SHORT'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
              }`}>
                {resultData.varianceStatus === 'MATCHED' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-wider">
                    {resultData.varianceStatus === 'MATCHED'
                      ? 'Kas Laci Seimbang (PAS)'
                      : resultData.varianceStatus === 'SHORT'
                        ? 'Kas Laci Kurang (SHORT)'
                        : 'Kas Laci Lebih (OVER)'}
                  </h4>
                  <span className="text-sm font-black">
                    {resultData.varianceStatus === 'MATCHED'
                      ? 'Rp 0'
                      : (resultData.variance > 0 ? '+' : '') + `Rp ${Number(resultData.variance).toLocaleString('id-ID')}`}
                  </span>
                </div>
                <p className="text-xs opacity-80 mt-0.5">
                  {resultData.varianceStatus === 'MATCHED'
                    ? 'Uang fisik di laci sesuai 100% dengan transaksi sistem kasir.'
                    : resultData.varianceStatus === 'SHORT'
                      ? 'Terdapat selisih minus kas laci. Log audit telah dicatat untuk supervisor.'
                      : 'Uang fisik di laci melebihi ekspektasi transaksi sistem.'}
                </p>
              </div>
            </div>

            {/* Reconciliation Breakdown Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rekonsiliasi Finansial</h5>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Modal Awal Kasir:</span>
                  <span className="font-bold text-slate-800">Rp {Number(resultData.saldoAwal || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Penjualan Tunai POS:</span>
                  <span className="font-bold text-emerald-600">+Rp {Number(resultData.cashSales || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Penjualan Non-Tunai (QRIS/EDC):</span>
                  <span className="font-semibold text-slate-700">Rp {Number(resultData.nonCashSales || 0).toLocaleString('id-ID')}</span>
                </div>
                {resultData.cashDebtIncome > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Pelunasan Piutang Tunai:</span>
                    <span className="font-bold text-emerald-600">+Rp {Number(resultData.cashDebtIncome).toLocaleString('id-ID')}</span>
                  </div>
                )}
                {(resultData.manualCashIn > 0 || resultData.manualCashOut > 0) && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Kas Masuk/Keluar Bersih:</span>
                    <span className={`font-bold ${(resultData.manualCashIn - resultData.manualCashOut) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(resultData.manualCashIn - resultData.manualCashOut) >= 0 ? '+' : ''}
                      Rp {((resultData.manualCashIn || 0) - (resultData.manualCashOut || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 bg-indigo-50/70 px-2.5 rounded-xl text-indigo-900 font-black">
                  <span>Ekspektasi Kas Sistem:</span>
                  <span>Rp {Number(resultData.expectedCash ?? resultData.saldoSistem).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-slate-200/60 px-2.5 rounded-xl text-slate-900 font-black">
                  <span>Total Fisik Laci (Kasir):</span>
                  <span>Rp {Number(resultData.saldoFisikLaci).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {resultData.varianceReason && (
                <div className="mt-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Alasan / Catatan Selisih:</span>
                  <p className="text-slate-700 font-medium italic mt-0.5">"{resultData.varianceReason}"</p>
                </div>
              )}

              {/* Denominations Details Toggle */}
              {resultData.denominations && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDenomDetail(!showDenomDetail)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                  >
                    {showDenomDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showDenomDetail ? 'Sembunyikan Rincian Lembar Kas' : 'Lihat Rincian Lembar Kas'}
                  </button>

                  {showDenomDetail && (
                    <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-1.5 animate-in fade-in">
                      {(() => {
                        const d = typeof resultData.denominations === 'string' ? JSON.parse(resultData.denominations) : resultData.denominations;
                        return (
                          <>
                            <div className="flex justify-between text-slate-600"><span>100rb:</span> <span className="font-bold">{d.c100k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>50rb:</span> <span className="font-bold">{d.c50k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>20rb:</span> <span className="font-bold">{d.c20k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>10rb:</span> <span className="font-bold">{d.c10k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>5rb:</span> <span className="font-bold">{d.c5k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>2rb:</span> <span className="font-bold">{d.c2k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>1rb:</span> <span className="font-bold">{d.c1k || 0} lbr</span></div>
                            <div className="flex justify-between text-slate-600"><span>Koin:</span> <span className="font-bold">Rp {(d.coins || 0).toLocaleString('id-ID')}</span></div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions Thermal Slip & PDF */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handlePrintThermalSlip()}
                className="py-3 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Printer size={16} className="text-indigo-600" />
                Cetak Struk Z-Report
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                className="py-3 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <FileText size={16} className="text-rose-600" />
                {generatingPdf ? 'Membuat PDF...' : 'Unduh Berita Acara PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: STEP FORM (Open Shift or Close Counting) */}
        {(mode === 'open' || closeStep === 'form') && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between min-h-0">
            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto pb-6">
              
              {/* Notice Banner */}
              <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                isOpenMode 
                  ? 'bg-indigo-50/70 border-indigo-100 text-indigo-900' 
                  : 'bg-amber-50/70 border-amber-200/70 text-amber-900'
              }`}>
                <div className="mt-0.5 shrink-0">
                  {isOpenMode ? <Calculator size={16} className="text-indigo-600" /> : <AlertCircle size={16} className="text-amber-600" />}
                </div>
                <p>
                  {isOpenMode 
                    ? 'Masukkan modal awal uang kembalian kasir sebelum memulai transaksi hari ini.'
                    : '🔒 Blind Closing Aktif: Hitung uang fisik laci tanpa melihat saldo sistem. Saldo sistem akan dicocokkan otomatis setelah submit.'}
                </p>
              </div>

              {/* Mode BUKA SHIFT */}
              {isOpenMode && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Modal Awal Kasir
                  </label>
                  
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-slate-400 font-black text-xl select-none">Rp</span>
                    <input 
                      type="text" 
                      className="w-full pl-14 pr-4 py-3.5 border border-slate-200 rounded-2xl text-2xl font-black text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm" 
                      placeholder="0"
                      value={displayAmount}
                      onChange={handleManualAmountChange}
                      required
                      autoFocus
                    />
                  </div>

                  {/* Quick Chips Modal Awal */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[50000, 100000, 200000, 300000, 500000].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleQuickModalAwal(chip)}
                        className="py-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-xs font-bold transition-all shadow-2xs"
                      >
                        Rp {chip.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>

                  {/* Form Input PIN Supervisor jika Di luar Jam Operasional */}
                  {requiresSupervisorPin && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5 animate-fade-in mt-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                        <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                        <span>Otorisasi Buka Shift di Luar Jam</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        {outsideHoursWarning || 'Waktu saat ini berada di luar jam operasional. Masukkan PIN Supervisor untuk mengizinkan kasir membuka modal laci.'}
                      </p>
                      <input 
                        type="password" 
                        maxLength={8}
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        placeholder="Masukkan PIN Supervisor (4-8 digit)"
                        className="w-full text-center py-2.5 px-4 border border-amber-300 rounded-xl font-mono text-sm tracking-widest bg-white font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                        autoFocus
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Mode TUTUP SHIFT: Denomination Counter vs Direct Input */}
              {!isOpenMode && (
                <div className="space-y-4">
                  {/* Tab Selector */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setInputTab('denominations')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        inputTab === 'denominations' 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Coins size={14} className={inputTab === 'denominations' ? 'text-indigo-600' : ''} />
                      Hitung Pecahan Lembar
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputTab('manual')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        inputTab === 'manual' 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Calculator size={14} className={inputTab === 'manual' ? 'text-indigo-600' : ''} />
                      Input Total Langsung
                    </button>
                  </div>

                  {/* TAB 1: DENOMINATION COUNTER */}
                  {inputTab === 'denominations' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                        {[
                          { key: 'c100k' as const, label: 'Rp 100.000', multiplier: 100000, color: 'text-red-700' },
                          { key: 'c50k' as const, label: 'Rp 50.000', multiplier: 50000, color: 'text-blue-700' },
                          { key: 'c20k' as const, label: 'Rp 20.000', multiplier: 20000, color: 'text-emerald-700' },
                          { key: 'c10k' as const, label: 'Rp 10.000', multiplier: 10000, color: 'text-purple-700' },
                          { key: 'c5k' as const, label: 'Rp 5.000', multiplier: 5000, color: 'text-amber-700' },
                          { key: 'c2k' as const, label: 'Rp 2.000', multiplier: 2000, color: 'text-slate-700' },
                          { key: 'c1k' as const, label: 'Rp 1.000', multiplier: 1000, color: 'text-cyan-700' }
                        ].map(item => {
                          const count = denominations[item.key] || 0;
                          const subtotal = count * item.multiplier;
                          return (
                            <div key={item.key} className="p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl flex flex-col justify-between transition-colors">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className={`text-xs font-black ${item.color}`}>{item.label}</span>
                                <span className="text-[11px] font-bold text-slate-500">
                                  = Rp {subtotal.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  className="w-full py-1.5 px-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-indigo-500 text-center bg-white"
                                  placeholder="0"
                                  value={count === 0 ? '' : count}
                                  onChange={(e) => handleDenomChange(item.key, e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleDenomIncrement(item.key, 1)}
                                  className="py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded-xl text-[10px] font-black shrink-0 transition-colors"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDenomIncrement(item.key, 5)}
                                  className="py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded-xl text-[10px] font-black shrink-0 transition-colors"
                                >
                                  +5
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Pecahan Koin & Lainnya */}
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-black text-slate-700">Koin & Logam</span>
                            <span className="text-[11px] font-bold text-slate-500">Total Nominal</span>
                          </div>
                          <div className="relative flex items-center">
                            <span className="absolute left-2.5 text-slate-400 font-bold text-xs select-none">Rp</span>
                            <input
                              type="text"
                              className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-indigo-500 bg-white"
                              placeholder="0"
                              value={denominations.coins === 0 ? '' : Number(denominations.coins).toLocaleString('id-ID')}
                              onChange={(e) => handleDenomChange('coins', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Total Bar */}
                      <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl flex justify-between items-center shadow-md">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">Total Hitungan Fisik Kasir</span>
                          <span className="text-xs text-indigo-200 font-medium">Auto-sum lembar & koin</span>
                        </div>
                        <span className="text-xl font-black text-emerald-400 tracking-tight">
                          Rp {totalFromDenominations.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MANUAL DIRECT INPUT */}
                  {inputTab === 'manual' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Total Uang Fisik di Laci Kasir
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-slate-400 font-black text-xl select-none">Rp</span>
                        <input 
                          type="text" 
                          className="w-full pl-14 pr-4 py-3.5 border border-slate-200 rounded-2xl text-2xl font-black text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm" 
                          placeholder="0"
                          value={displayAmount}
                          onChange={handleManualAmountChange}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Variance Reason Input */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Catatan / Keterangan Kasir <span className="text-slate-400 font-normal lowercase">(opsional jika pas)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all bg-white"
                      placeholder="Contoh: Selisih 2rb karena uang kembalian pecahan kecil habis..."
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Form Submit */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                type="button" 
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs sm:text-sm font-bold transition-all flex justify-center items-center" 
                onClick={onClose} 
                disabled={loading}
              >
                Batal
              </button>
              <button 
                type="submit" 
                className={`flex-1 py-3 px-4 rounded-2xl text-white text-xs sm:text-sm font-black transition-all flex justify-center items-center gap-2 shadow-md ${
                  isOpenMode 
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' 
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                }`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    {isOpenMode ? 'Buka Shift Kasir' : 'Tutup & Rekonsiliasi'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer for Result Step */}
        {mode === 'close' && closeStep === 'result' && (
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
            <button 
              type="button" 
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black transition-all flex justify-center items-center gap-2 shadow-md" 
              onClick={handleFinishClose}
            >
              <CheckCircle2 size={18} className="text-emerald-400" />
              Selesai & Tutup
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default OpenShiftModal;
