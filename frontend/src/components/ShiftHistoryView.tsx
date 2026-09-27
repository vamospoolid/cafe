import React, { useState, useEffect, useContext } from 'react';
import { 
  History, Clock, FileText, CheckCircle, Play, Square, 
  Download, RefreshCw, AlertCircle, Timer, AlertTriangle, 
  X, ShieldAlert, Save, Printer, Eye, Filter, Coins, CheckCircle2 
} from 'lucide-react';
import OpenShiftModal from './OpenShiftModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportShiftSettlementPDF, exportFinancialPDF } from '../utils/pdfGenerator';
import { toast } from '../utils/alert';

const ShiftHistoryView = () => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'open' | 'close'>('open');

  // Filter Tab: 'all' | 'variance' | 'matched'
  const [filterTab, setFilterTab] = useState<'all' | 'variance' | 'matched'>('all');

  // Shift Detail & Z-Report Inspector Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedZReport, setSelectedZReport] = useState<any | null>(null);
  const [loadingZReport, setLoadingZReport] = useState(false);

  // Force Close State (Admin only)
  const [isForceCloseModalOpen, setIsForceCloseModalOpen] = useState(false);
  const [selectedShiftToForceClose, setSelectedShiftToForceClose] = useState<any | null>(null);
  const [forceCloseSummary, setForceCloseSummary] = useState<any | null>(null);
  const [forceCloseForm, setForceCloseForm] = useState({
    saldoFisikLaci: '',
    catatan: ''
  });
  const [savingForceClose, setSavingForceClose] = useState(false);
  const [runningShiftAutoCutoff, setRunningShiftAutoCutoff] = useState(false);

  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  const formatTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID');
  };

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shifts', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShifts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveShift = async () => {
    try {
      const res = await fetch('/api/shifts/current', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShift((data && data.id) ? data : null);
      } else {
        setActiveShift(null);
      }
    } catch (e) {
      console.error(e);
      setActiveShift(null);
    }
  };

  const fetchData = () => {
    fetchShifts();
    fetchActiveShift();
  };

  useEffect(() => {
    fetchShifts();
    fetchActiveShift();
  }, [posContext?.token]);

  const handleOpenShift = () => {
    setModalMode('open');
    setIsModalOpen(true);
  };

  const handleCloseShift = () => {
    setModalMode('close');
    setIsModalOpen(true);
  };

  const handleOpenDetailModal = async (shift: any) => {
    setIsDetailModalOpen(true);
    setLoadingZReport(true);
    try {
      const res = await fetch(`/api/shifts/${shift.id}/z-report`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedZReport(data);
      } else {
        setSelectedZReport({ shift });
      }
    } catch (e) {
      console.error(e);
      setSelectedZReport({ shift });
    } finally {
      setLoadingZReport(false);
    }
  };

  const handleOpenForceCloseModal = async (shift: any) => {
    setSelectedShiftToForceClose(shift);
    setSavingForceClose(false);
    try {
      const res = await fetch('/api/shifts/current-summary', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setForceCloseSummary(data);
        setForceCloseForm({
          saldoFisikLaci: String(data.expectedCash || shift.saldoAwal || 0),
          catatan: 'Tutup Shift Paksa oleh Admin / Supervisor (Kasir Berhalangan)'
        });
      } else {
        setForceCloseSummary({ expectedCash: shift.saldoAwal });
        setForceCloseForm({
          saldoFisikLaci: String(shift.saldoAwal || 0),
          catatan: 'Tutup Shift Paksa oleh Admin / Supervisor (Kasir Berhalangan)'
        });
      }
    } catch (e) {
      setForceCloseSummary({ expectedCash: shift.saldoAwal });
      setForceCloseForm({
        saldoFisikLaci: String(shift.saldoAwal || 0),
        catatan: 'Tutup Shift Paksa oleh Admin / Supervisor (Kasir Berhalangan)'
      });
    }
    setIsForceCloseModalOpen(true);
  };

  const handleSaveForceClose = async () => {
    if (!selectedShiftToForceClose) return;
    setSavingForceClose(true);
    try {
      const res = await fetch(`/api/shifts/${selectedShiftToForceClose.id}/force-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          saldoFisikLaci: Number(forceCloseForm.saldoFisikLaci) || 0,
          catatan: forceCloseForm.catatan
        })
      });

      if (res.ok) {
        toast(`Shift #${selectedShiftToForceClose.id} berhasil ditutup paksa!`, 'success');
        setIsForceCloseModalOpen(false);
        setSelectedShiftToForceClose(null);
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menutup shift paksa', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setSavingForceClose(false);
    }
  };

  const handleRunShiftAutoCutoff = async () => {
    setRunningShiftAutoCutoff(true);
    try {
      const res = await fetch('/api/shifts/auto-cutoff', {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Auto Cut-off Shift selesai', 'success');
        fetchData();
      } else {
        toast(data.error || 'Gagal menjalankan auto cutoff', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setRunningShiftAutoCutoff(false);
    }
  };

  const handlePrintThermalSlip = (shiftData: any, reportData?: any) => {
    const shift = shiftData || reportData?.shift;
    if (!shift) return;

    const storeName = posContext?.settings?.storeName || 'DEMO CAFE POS';
    const cashier = shift.user?.name || shift.user?.username || 'Kasir';
    const waktuBuka = shift.waktuBuka ? new Date(shift.waktuBuka).toLocaleString('id-ID') : '-';
    const waktuTutup = shift.waktuTutup ? new Date(shift.waktuTutup).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    const saldoAwal = Number(shift.saldoAwal) || 0;
    const cashSales = Number(shift.cashSales ?? reportData?.summary?.cashSales) || 0;
    const nonCashSales = Number(shift.nonCashSales ?? reportData?.summary?.nonCashSales) || 0;
    const voidCash = Number(shift.voidCashTotal ?? reportData?.summary?.voidCashTotal) || 0;
    const manualNet = (Number(shift.manualCashIn ?? reportData?.summary?.manualCashIn) || 0) - (Number(shift.manualCashOut ?? reportData?.summary?.manualCashOut) || 0);
    const debtCash = Number(shift.cashDebtIncome ?? reportData?.summary?.cashDebtIncome) || 0;
    const saldoSistem = Number(shift.saldoSistem ?? reportData?.summary?.expectedCash) || 0;
    const fisikLaci = Number(shift.saldoFisikLaci) || 0;
    const selisih = Number(shift.selisih ?? (fisikLaci - saldoSistem)) || 0;
    const varianceStatus = selisih === 0 ? 'PAS / SEIMBANG' : selisih < 0 ? 'KURANG / TEKOR' : 'LEBIH';

    let parsedDenom: any = null;
    if (shift.denominations) {
      try {
        parsedDenom = typeof shift.denominations === 'string' ? JSON.parse(shift.denominations) : shift.denominations;
      } catch (e) {
        parsedDenom = null;
      }
    }

    const receiptContent = `
================================
     REKAP Z-REPORT TUTUP SHIFT
        ${storeName}
================================
ID Shift    : #${shift.id || '-'}
Kasir       : ${cashier}
Buka Shift  : ${waktuBuka}
Tutup Shift : ${waktuTutup}
--------------------------------
RINGKASAN OMSET:
Modal Awal Kasir   : Rp ${saldoAwal.toLocaleString('id-ID')}
Penjualan Tunai    : Rp ${cashSales.toLocaleString('id-ID')}
Penjualan Non-Tunai: Rp ${nonCashSales.toLocaleString('id-ID')}
${voidCash > 0 ? `Void Tunai         : -Rp ${voidCash.toLocaleString('id-ID')}\n` : ''}${debtCash > 0 ? `Pelunasan Piutang  : +Rp ${debtCash.toLocaleString('id-ID')}\n` : ''}Kas Masuk/Keluar   : ${manualNet >= 0 ? '+' : ''}Rp ${manualNet.toLocaleString('id-ID')}
--------------------------------
REKONSILIASI KAS LACI:
Saldo Sistem Kas   : Rp ${saldoSistem.toLocaleString('id-ID')}
Fisik Laci Dihitung: Rp ${fisikLaci.toLocaleString('id-ID')}
STATUS SELISIH     : ${selisih === 0 ? 'Rp 0 (PAS / SEIMBANG)' : selisih < 0 ? `-Rp ${Math.abs(selisih).toLocaleString('id-ID')} (KURANG/TEKOR)` : `+Rp ${selisih.toLocaleString('id-ID')} (LEBIH)`}
${shift.varianceReason ? `Keterangan         : ${shift.varianceReason}\n` : ''}--------------------------------
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
            <title>Struk Z-Report Tutup Shift - #${shift.id}</title>
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

  const handleDownloadShiftSlip = async (shift: any) => {
    try {
      await exportShiftSettlementPDF(
        posContext?.settings || { storeName: 'DEMO CAFE' },
        shift,
        posContext?.user?.username || 'Supervisor'
      );
      toast('Slip Berita Acara Shift berhasil diunduh!', 'success');
    } catch (e) {
      console.error(e);
      toast('Gagal mencetak slip shift', 'error');
    }
  };

  const exportPDF = async () => {
    if (shifts.length === 0) return toast('Tidak ada data shift untuk diekspor', 'error');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const firstShiftDate = shifts[shifts.length - 1]?.waktuBuka ? shifts[shifts.length - 1].waktuBuka.split('T')[0] : todayStr;
      await exportFinancialPDF(
        'shifts',
        posContext?.settings || { storeName: 'DEMO CAFE' },
        shifts,
        firstShiftDate,
        todayStr,
        posContext?.user?.username || 'Supervisor'
      );
      toast('Laporan Rekapitulasi Shift berhasil diunduh!', 'success');
    } catch (e) {
      console.error(e);
      toast('Gagal mencetak laporan shift', 'error');
    }
  };

  // Filtered shifts
  const filteredShifts = shifts.filter(s => {
    if (filterTab === 'variance') return s.selisih !== null && s.selisih !== 0;
    if (filterTab === 'matched') return s.selisih === 0;
    return true;
  });

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      {/* HEADER / ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <History className="text-indigo-600" size={24} /> Riwayat &amp; Rekap Shift Kasir (Z-Report)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Audit rekonsiliasi kas laci, deteksi selisih uang, dan inspeksi lembar kasir</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={handleRunShiftAutoCutoff}
            disabled={runningShiftAutoCutoff}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all"
            title="Tutup otomatis shift kasir kemarin yang masih menggantung"
          >
            <Timer size={14} className="text-amber-600" />
            {runningShiftAutoCutoff ? 'Memproses...' : 'Auto Cut-off EOD'}
          </button>
          <button
            className="flex-1 sm:flex-initial btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all"
            onClick={fetchData}
            title="Refresh data shift"
          >
            <RefreshCw size={14} className="text-slate-400" /> Refresh
          </button>
          <button
            className="flex-1 sm:flex-initial btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all"
            onClick={exportPDF}
          >
            <FileText size={15} className="text-rose-500" /> Export PDF
          </button>
        </div>
      </div>

      {/* ── STATUS SHIFT BANNER ─────────────────────────────────────────────── */}
      {activeShift ? (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 border border-indigo-500/50 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Timer size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm">Shift Aktif Sedang Berjalan</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-indigo-200 text-xs mt-0.5">
                Dibuka sejak <strong className="text-white">{new Date(activeShift.waktuBuka).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</strong>
                {' '}• Kasir: <strong className="text-white">{activeShift.user?.name || 'Admin'}</strong>
                {' '}• Modal Awal: <strong className="text-white">{formatCurrency(activeShift.saldoAwal)}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleOpenForceCloseModal(activeShift)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow active:scale-95 transition-all flex items-center gap-1.5"
              title="Tutup paksa oleh Admin/Supervisor"
            >
              <ShieldAlert size={14} /> Force Close (Admin)
            </button>
            <button
              onClick={handleCloseShift}
              className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-black text-xs shadow hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-2"
            >
              <Square size={14} /> Tutup Shift (Blind Close)
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle size={18} className="text-amber-600" />
            </div>
            <div>
              <div className="font-extrabold text-amber-900 text-sm">Tidak Ada Shift Aktif</div>
              <p className="text-amber-700 text-xs mt-0.5">Buka shift terlebih dahulu sebelum kasir mulai menerima transaksi.</p>
            </div>
          </div>
          <button
            onClick={handleOpenShift}
            className="self-start sm:self-center shrink-0 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <Play size={14} /> Buka Shift Sekarang
          </button>
        </div>
      )}

      {/* ── FILTER TABS ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter size={13} /> Semua Shift ({shifts.length})
        </button>
        <button
          onClick={() => setFilterTab('variance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            filterTab === 'variance'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <AlertTriangle size={13} className={filterTab === 'variance' ? 'text-white' : 'text-rose-600'} />
          Ada Selisih Kas ({shifts.filter(s => s.selisih !== null && s.selisih !== 0).length})
        </button>
        <button
          onClick={() => setFilterTab('matched')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            filterTab === 'matched'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle2 size={13} className={filterTab === 'matched' ? 'text-white' : 'text-emerald-600'} />
          Kas Pas / Seimbang ({shifts.filter(s => s.selisih === 0).length})
        </button>
      </div>

      {/* ── LIST TABEL RIWAYAT SHIFT ────────────────────────────────────────── */}
      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm bg-white rounded-2xl border border-slate-200/80 shrink-0">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium text-xs">Memuat riwayat shift...</div>
        ) : filteredShifts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium text-xs">Tidak ada riwayat shift yang sesuai dengan filter.</div>
        ) : (
          <>
            {/* Mobile Cards View (< 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredShifts.map((shift) => (
                <div key={shift.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{shift.user?.name || 'Kasir'}</div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <Clock size={12} className="text-slate-400" /> {formatDate(shift.waktuBuka)} ({formatTime(shift.waktuBuka)} - {shift.waktuTutup ? formatTime(shift.waktuTutup) : 'Aktif'})
                      </div>
                      {shift.openingPunctuality && (
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          {shift.openingPunctuality === 'ON_TIME' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              Tepat Waktu
                            </span>
                          ) : shift.openingPunctuality === 'LATE' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-800 border border-amber-300 font-bold">
                              Telat {shift.lateOpenMinutes || 0} mnt
                            </span>
                          ) : shift.openingPunctuality === 'EARLY' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                              Buka Lebih Awal
                            </span>
                          ) : shift.openingPunctuality === 'OVERRIDE_OUTSIDE_HOURS' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              Di Luar Jam Toko
                            </span>
                          ) : null}
                          {shift.supervisorOverride && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              Izin Supervisor
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {shift.status === 'Closed' ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                        <CheckCircle size={11} /> Selesai
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1">
                        <Play size={11} /> Aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Saldo Awal:</span>
                      <span className="font-medium text-slate-700">{formatCurrency(shift.saldoAwal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Sistem (Ekspektasi):</span>
                      <span className="font-bold text-slate-900">{shift.saldoSistem !== null ? formatCurrency(shift.saldoSistem) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Fisik Laci:</span>
                      <span className="font-bold text-indigo-600">{shift.saldoFisikLaci !== null ? formatCurrency(shift.saldoFisikLaci) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Selisih Kas:</span>
                      {shift.selisih !== null ? (
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] inline-block ${
                          shift.selisih === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          shift.selisih > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {shift.selisih > 0 ? '+' : ''}{formatCurrency(shift.selisih)}
                          {shift.selisih === 0 ? ' (Pas)' : shift.selisih < 0 ? ' (Tekor)' : ' (Lebih)'}
                        </span>
                      ) : '-'}
                    </div>
                  </div>

                  {shift.varianceReason && (
                    <p className="text-[11px] text-slate-600 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                      <strong>Catatan:</strong> "{shift.varianceReason}"
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                    <button
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1.5"
                      onClick={() => handleOpenDetailModal(shift)}
                    >
                      <Eye size={13} /> Z-Report
                    </button>
                    <button
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
                      onClick={() => handlePrintThermalSlip(shift)}
                    >
                      <Printer size={13} /> Struk
                    </button>
                    <button
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
                      onClick={() => handleDownloadShiftSlip(shift)}
                    >
                      <Download size={13} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block table-responsive p-0 overflow-x-auto">
              <table className="data-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-bold">
                    <th className="py-3.5 px-4">TANGGAL &amp; WAKTU</th>
                    <th className="py-3.5 px-4">KASIR</th>
                    <th className="py-3.5 px-4">MODAL AWAL</th>
                    <th className="py-3.5 px-4">SALDO SISTEM</th>
                    <th className="py-3.5 px-4">FISIK LACI</th>
                    <th className="py-3.5 px-4">STATUS REKONSILIASI</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-right">AKSI AUDIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredShifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{formatDate(shift.waktuBuka)}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {formatTime(shift.waktuBuka)} - {shift.waktuTutup ? formatTime(shift.waktuTutup) : 'Aktif'}
                        </div>
                        {shift.openingPunctuality && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            {shift.openingPunctuality === 'ON_TIME' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                Tepat Waktu
                              </span>
                            ) : shift.openingPunctuality === 'LATE' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-800 border border-amber-300 font-bold">
                                Telat {shift.lateOpenMinutes || 0} mnt
                              </span>
                            ) : shift.openingPunctuality === 'EARLY' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                                Buka Lebih Awal
                              </span>
                            ) : shift.openingPunctuality === 'OVERRIDE_OUTSIDE_HOURS' ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                                Di Luar Jam Toko
                              </span>
                            ) : null}
                            {shift.supervisorOverride && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-bold" title="Shift dibuka dengan otorisasi PIN Supervisor">
                                Izin Supervisor
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {shift.user?.name || 'Kasir'}
                        {shift.denominations && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500 font-bold" title="Rincian lembar pecahan kasir tersedia">
                            +Pecahan
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{formatCurrency(shift.saldoAwal)}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {shift.saldoSistem !== null ? formatCurrency(shift.saldoSistem) : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-indigo-700">
                        {shift.saldoFisikLaci !== null ? formatCurrency(shift.saldoFisikLaci) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {shift.selisih !== null ? (
                          <div className="space-y-0.5">
                            <span className={`font-black px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 ${
                              shift.selisih === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              shift.selisih > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {shift.selisih === 0 ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                              {shift.selisih > 0 ? '+' : ''}{formatCurrency(shift.selisih)}
                              {shift.selisih === 0 ? ' (Pas)' : shift.selisih < 0 ? ' (Tekor)' : ' (Lebih)'}
                            </span>
                            {shift.varianceReason && (
                              <p className="text-[10px] text-slate-500 italic truncate max-w-[160px]" title={shift.varianceReason}>
                                "{shift.varianceReason}"
                              </p>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {shift.status === 'Closed' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle size={10} /> Selesai
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold inline-flex items-center gap-1">
                            <Play size={10} /> Aktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all border border-indigo-200 inline-flex items-center gap-1"
                            onClick={() => handleOpenDetailModal(shift)}
                            title="Inspeksi Detail Rekonsiliasi & Rincian Z-Report"
                          >
                            <Eye size={12} /> Z-Report
                          </button>
                          <button
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 inline-flex items-center gap-1"
                            onClick={() => handlePrintThermalSlip(shift)}
                            title="Cetak Ulang Struk Z-Report Thermal"
                          >
                            <Printer size={12} />
                          </button>
                          <button
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 inline-flex items-center gap-1"
                            onClick={() => handleDownloadShiftSlip(shift)}
                            title="Unduh Dokumen Berita Acara Shift PDF"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── MODAL DETAIL Z-REPORT & AUDIT INSPECTOR ─────────────────────────── */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">
                    Z-Report Shift #{selectedZReport?.shift?.id || ''}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Kasir: <strong>{selectedZReport?.shift?.user?.name || 'Kasir'}</strong> • {formatDate(selectedZReport?.shift?.waktuBuka)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {loadingZReport ? (
                <div className="p-8 text-center text-slate-400 animate-pulse font-medium">Memuat data Z-Report lengkap...</div>
              ) : selectedZReport?.shift ? (
                <>
                  {/* Status Banner */}
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    selectedZReport.summary?.varianceStatus === 'MATCHED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : selectedZReport.summary?.varianceStatus === 'SHORT'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {selectedZReport.summary?.varianceStatus === 'MATCHED' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      <span>
                        {selectedZReport.summary?.varianceStatus === 'MATCHED'
                          ? 'Kas Seimbang / Pas'
                          : selectedZReport.summary?.varianceStatus === 'SHORT'
                            ? 'Kas Minus / Tekor'
                            : 'Kas Lebih'}
                      </span>
                    </div>
                    <span className="font-black text-sm">
                      {selectedZReport.summary?.variance > 0 ? '+' : ''}
                      {formatCurrency(selectedZReport.summary?.variance ?? selectedZReport.shift?.selisih)}
                    </span>
                  </div>

                  {/* Financial Reconciliation Table */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Rekonsiliasi Kas Laci</h5>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Modal Awal Kas:</span>
                        <span className="font-bold text-slate-800">{formatCurrency(selectedZReport.shift.saldoAwal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Penjualan Tunai:</span>
                        <span className="font-bold text-emerald-600">+{formatCurrency(selectedZReport.summary?.cashSales || selectedZReport.shift.cashSales)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Penjualan Non-Tunai (QRIS/EDC):</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(selectedZReport.summary?.nonCashSales || selectedZReport.shift.nonCashSales)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-900 font-bold bg-indigo-50/70 p-2 rounded-xl">
                        <span>Saldo Kas Sistem:</span>
                        <span>{formatCurrency(selectedZReport.shift.saldoSistem)}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-black bg-slate-200/60 p-2 rounded-xl">
                        <span>Fisik Laci (Kasir):</span>
                        <span>{formatCurrency(selectedZReport.shift.saldoFisikLaci)}</span>
                      </div>
                    </div>

                    {selectedZReport.shift.varianceReason && (
                      <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 text-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Keterangan Kasir:</span>
                        <p className="italic mt-0.5">"{selectedZReport.shift.varianceReason}"</p>
                      </div>
                    )}
                  </div>

                  {/* Denominations Breakdown */}
                  {selectedZReport.shift.denominations && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                      <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Coins size={12} /> Rincian Lembar Kasir
                      </h5>
                      <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                        {(() => {
                          const d = typeof selectedZReport.shift.denominations === 'string' ? JSON.parse(selectedZReport.shift.denominations) : selectedZReport.shift.denominations;
                          return (
                            <>
                              <div className="flex justify-between"><span>100.000:</span> <span className="font-bold">{d.c100k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>50.000:</span> <span className="font-bold">{d.c50k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>20.000:</span> <span className="font-bold">{d.c20k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>10.000:</span> <span className="font-bold">{d.c10k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>5.000:</span> <span className="font-bold">{d.c5k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>2.000:</span> <span className="font-bold">{d.c2k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>1.000:</span> <span className="font-bold">{d.c1k || 0} lbr</span></div>
                              <div className="flex justify-between"><span>Koin/Lain:</span> <span className="font-bold">{formatCurrency(d.coins || 0)}</span></div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Category Breakdown */}
                  {selectedZReport.categoryBreakdown && Object.keys(selectedZReport.categoryBreakdown).length > 0 && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                      <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Omset per Kategori Produk</h5>
                      <div className="space-y-1">
                        {Object.entries(selectedZReport.categoryBreakdown).map(([cat, val]: [string, any]) => (
                          <div key={cat} className="flex justify-between py-1 border-b border-slate-200/50">
                            <span className="text-slate-600 font-medium">{cat} ({val.qty} item):</span>
                            <span className="font-bold text-slate-800">{formatCurrency(val.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-rose-500 font-medium text-center">Gagal memuat detail shift.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintThermalSlip(selectedZReport?.shift, selectedZReport)}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={14} /> Cetak Struk Z-Report
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadShiftSlip(selectedZReport?.shift)}
                  className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={14} /> Unduh PDF
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FORCE CLOSE SHIFT (ADMIN / OWNER) ────────────────────────── */}
      {isForceCloseModalOpen && selectedShiftToForceClose && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Tutup Shift Paksa (Force Close)</h4>
                  <p className="text-[11px] text-slate-500">
                    Kasir: <strong>{selectedShiftToForceClose.user?.name}</strong> • Shift #{selectedShiftToForceClose.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsForceCloseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle size={14} className="text-amber-600" /> Perhatian Supervisor / Admin:
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Fitur ini digunakan saat kasir lupa menutup shift atau berhalangan hadir. Masukkan uang fisik yang telah dihitung dari laci kasir untuk rekonsiliasi.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Modal Awal Kas:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(selectedShiftToForceClose.saldoAwal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Kas Sistem (Ekspektasi):</span>
                  <span className="font-black text-indigo-600 text-sm">{formatCurrency(forceCloseSummary?.expectedCash || selectedShiftToForceClose.saldoAwal)}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Saldo Uang Fisik Aktual di Laci (Rp)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-black text-slate-900 text-sm outline-none focus:border-indigo-500"
                  value={forceCloseForm.saldoFisikLaci}
                  onChange={e => setForceCloseForm({ ...forceCloseForm, saldoFisikLaci: e.target.value })}
                  placeholder="0"
                />
                <div className="mt-1 flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Selisih Uang Kas:</span>
                  {(() => {
                    const expected = Number(forceCloseSummary?.expectedCash || selectedShiftToForceClose.saldoAwal || 0);
                    const actual = Number(forceCloseForm.saldoFisikLaci || 0);
                    const diff = actual - expected;
                    return (
                      <span className={`font-black ${diff === 0 ? 'text-slate-600' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {diff === 0 ? '0 (Klop / Seimbang)' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)} (${diff > 0 ? 'Lebih' : 'Kurang'})`}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Catatan Berita Acara Supervisor</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-900 outline-none focus:border-indigo-500 resize-none text-xs"
                  value={forceCloseForm.catatan}
                  onChange={e => setForceCloseForm({ ...forceCloseForm, catatan: e.target.value })}
                  placeholder="Contoh: Ditutup oleh Supervisor karena kasir pulang darurat."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsForceCloseModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingForceClose}
                onClick={handleSaveForceClose}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Save size={14} />
                {savingForceClose ? 'Memproses...' : 'Konfirmasi Tutup Shift Paksa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <OpenShiftModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        mode={modalMode}
      />
    </div>
  );
};

export default ShiftHistoryView;
