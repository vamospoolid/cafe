import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  RefreshCw,
  Eye, 
  Flame, 
  Droplet, 
  Zap, 
  DollarSign,
  TrendingDown,
  Layers,
  ChevronRight,
  ShieldCheck,
  Building2,
  Trash2
} from 'lucide-react';
import CashFlowModal from './CashFlowModal';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import { exportPettyCashPDF } from '../utils/pdfGenerator';
import useSocket from '../hooks/useSocket';

const CashFlowView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'Pengeluaran' | 'Pemasukan'>('Pengeluaran');
  const [modalPocket, setModalPocket] = useState<'OPERATIONAL' | 'DRAWER'>('OPERATIONAL');

  const [cashflows, setCashflows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    operationalBalance: 0,
    operationalIn: 0,
    operationalOut: 0,
    drawerBalance: 0,
    pendingCount: 0,
    pendingAmount: 0,
    dailyBurnRate: 0
  });

  const [loading, setLoading] = useState(true);

  // Filters
  const [pocketFilter, setPocketFilter] = useState<'ALL' | 'OPERATIONAL' | 'DRAWER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reject reason modal
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const posContext = useContext(POSContext);
  const user = posContext?.user;
  const isOwnerOrAdmin = user?.role === 'Admin' || user?.role === 'Owner' || (user as any)?.isPlatformAdmin;
  const socket = useSocket();

  const formatCurrency = (val: any) => {
    const num = Number(val) || 0;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return String(isoString);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/cashflow/summary', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch (err) {
      console.error('Failed to load cashflow summary', err);
    }
  };

  const fetchCashflow = async () => {
    setLoading(true);
    try {
      const url = new URL(`${window.location.origin}/api/cashflow`);
      if (pocketFilter !== 'ALL') url.searchParams.set('pocket', pocketFilter);
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);
      if (debouncedSearch.trim()) url.searchParams.set('search', debouncedSearch.trim());

      // Date preset calculation
      const now = new Date();
      let s: Date | null = null;
      let e: Date | null = null;

      if (datePreset === 'today') {
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (datePreset === 'yesterday') {
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        e = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      } else if (datePreset === 'this_week') {
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (datePreset === 'this_month') {
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      }

      if (s && e) {
        url.searchParams.set('startDate', s.toISOString().split('T')[0]);
        url.searchParams.set('endDate', e.toISOString().split('T')[0]);
        url.searchParams.set('tzOffset', (new Date().getTimezoneOffset()).toString());
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCashflows(data);
      } else {
        setCashflows([]);
      }
    } catch (err) {
      console.error('Failed to load cashflow data', err);
      setCashflows([]);
    } finally {
      setLoading(false);
    }
  };

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (posContext?.token) {
      fetchSummary();
      fetchCashflow();
    }
  }, [posContext?.token, pocketFilter, statusFilter, datePreset, debouncedSearch]);

  // Real-time socket listeners
  useEffect(() => {
    const handleUpdate = () => {
      fetchSummary();
      fetchCashflow();
    };

    socket.on('cashflow:pending', handleUpdate);
    socket.on('cashflow:approved', handleUpdate);
    socket.on('cashflow:rejected', handleUpdate);
    socket.on('cashflow:updated', handleUpdate);
    socket.on('cashflow:deleted', handleUpdate);

    return () => {
      socket.off('cashflow:pending', handleUpdate);
      socket.off('cashflow:approved', handleUpdate);
      socket.off('cashflow:rejected', handleUpdate);
      socket.off('cashflow:updated', handleUpdate);
      socket.off('cashflow:deleted', handleUpdate);
    };
  }, [socket]);

  const handleSaveModal = async (formData: any) => {
    try {
      const res = await fetch('/api/cashflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast(
          formData.status === 'PENDING'
            ? 'Pengajuan pengeluaran terkirim ke antrean Approval Owner!'
            : 'Transaksi kas berhasil dicatat!',
          'success'
        );
        setIsModalOpen(false);
        fetchSummary();
        fetchCashflow();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan transaksi', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const handleApprove = async (item: any) => {
    const confirmed = await confirmAlert(
      `Setujui pengeluaran ${item.category} sebesar ${formatCurrency(item.amount)}?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/cashflow/${item.id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Pengeluaran berhasil disetujui!', 'success');
        fetchSummary();
        fetchCashflow();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyetujui transaksi', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan sistem', 'error');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    try {
      const res = await fetch(`/api/cashflow/${rejectingItem.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ reason: rejectReason.trim() || 'Ditolak oleh Owner' })
      });
      if (res.ok) {
        toast('Pengeluaran telah ditolak.', 'info');
        setRejectingItem(null);
        setRejectReason('');
        fetchSummary();
        fetchCashflow();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menolak transaksi', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan sistem', 'error');
    }
  };

  const handleDelete = async (item: any) => {
    const confirmed = await confirmAlert(`Hapus catatan transaksi ${item.description}?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/cashflow/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Transaksi berhasil dihapus', 'success');
        fetchSummary();
        fetchCashflow();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menghapus transaksi', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan sistem', 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      const settings = posContext?.settings || {};
      await exportPettyCashPDF(
        cashflows,
        settings,
        {
          category: pocketFilter,
          type: statusFilter,
          searchQuery
        },
        user?.name || 'Kasir'
      );
      toast('Laporan Petty Cash PDF berhasil diekspor!', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengekspor laporan PDF', 'error');
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 w-full flex-1 flex flex-col bg-slate-100/70 text-slate-800 min-h-0">
      
      {/* 1. Header Banner: Kas Operasional & Petty Cash */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs mb-3 flex-shrink-0">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 font-black text-lg border border-indigo-150">
            $
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Kas Operasional & Petty Cash
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                DUAL-POCKET SEGREGATED
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Pemisahan ketat Kas Operasional Toko (galon, gas, listrik, bahan) vs Kas Penjualan Laci Kasir
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <FileText size={14} className="text-rose-600" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => {
              setModalType('Pemasukan');
              setModalPocket('OPERATIONAL');
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none py-2 px-3 rounded-xl border border-amber-250 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Wallet size={14} className="text-amber-700" />
            <span>+ Isi Kas Operasional</span>
          </button>

          <button
            onClick={() => {
              setModalType('Pengeluaran');
              setModalPocket('OPERATIONAL');
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Plus size={15} />
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Stacked KPI Cards */}
      <div className="space-y-2.5 mb-3 flex-shrink-0">
        
        {/* Card 1: Kas Operasional (Petty Cash) - Amber */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Wallet size={14} className="text-amber-700" />
              KAS OPERASIONAL (PETTY CASH)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-amber-100 text-amber-800">
              Di Luar Laci
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
            {formatCurrency(summary.operationalBalance)}
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 border-t border-amber-200/50 pt-1.5 mt-1">
            <span>Masuk: <strong className="text-emerald-700 font-bold">{formatCurrency(summary.operationalIn)}</strong></span>
            <span>Keluar: <strong className="text-rose-700 font-bold">{formatCurrency(summary.operationalOut)}</strong></span>
          </div>
        </div>

        {/* Card 2: Laci Kasir (Sales Drawer) - Emerald */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-700" />
              LACI KASIR (SALES DRAWER)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
              Omset & Modal
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
            {formatCurrency(summary.drawerBalance)}
          </div>

          <div className="text-[11px] text-slate-500 font-medium border-t border-emerald-200/50 pt-1.5 mt-1">
            Khusus omset POS & modal awal shift (Zero Variance)
          </div>
        </div>

        {/* Card 3: Antrean Approval Owner - Red/Rose */}
        <div 
          onClick={() => setStatusFilter(summary.pendingCount > 0 ? 'PENDING' : 'ALL')}
          className={`p-3.5 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            summary.pendingCount > 0
              ? 'bg-rose-50 border-rose-300 animate-pulse'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
              <Clock size={14} className="text-rose-600" />
              ANTREAN APPROVAL OWNER
            </span>
            {summary.pendingCount > 0 && (
              <span className="text-[10px] font-black px-2 py-0.2 rounded-md bg-rose-600 text-white animate-bounce">
                {summary.pendingCount} Pending
              </span>
            )}
          </div>

          <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
            {formatCurrency(summary.pendingAmount)}
          </div>

          <div className="text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-1.5 mt-1">
            {summary.pendingCount === 0
              ? 'Tidak ada pengajuan pending'
              : `${summary.pendingCount} pengeluaran kasir menunggu persetujuan Anda`}
          </div>
        </div>

        {/* Card 4: Daily Burn Rate - Indigo/Blue */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-150 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
              <Zap size={14} className="text-indigo-600" />
              DAILY BURN RATE
            </span>
            <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-indigo-100 text-indigo-800">
              Rata-Rata
            </span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
            {formatCurrency(summary.dailyBurnRate)} <span className="text-xs font-normal text-slate-400">/hari</span>
          </div>

          <div className="text-[11px] text-slate-500 font-medium border-t border-indigo-150/60 pt-1.5 mt-1">
            Belanja darurat (Galon, Gas, Es)
          </div>
        </div>

      </div>

      {/* 3. Filter Section */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs mb-3 space-y-2.5 flex-shrink-0">
        
        {/* Row 1: Kantong Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setPocketFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
              pocketFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}
          >
            Semua Kantong
          </button>

          <button
            onClick={() => setPocketFilter('OPERATIONAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
              pocketFilter === 'OPERATIONAL'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            <Wallet size={12} /> Kas Operasional
          </button>

          <button
            onClick={() => setPocketFilter('DRAWER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
              pocketFilter === 'DRAWER'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
            }`}
          >
            <DollarSign size={12} /> Laci Kasir
          </button>
        </div>

        {/* Row 2: Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Status:</span>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Semua
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
              statusFilter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Disetujui
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Pending ({summary.pendingCount})
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
              statusFilter === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Ditolak
          </button>
        </div>

        {/* Row 3: Periode Waktu Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'Semua Waktu' },
            { id: 'today', label: 'Hari Ini' },
            { id: 'yesterday', label: 'Kemarin' },
            { id: 'this_week', label: 'Minggu Ini' },
            { id: 'this_month', label: 'Bulan Ini' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id as any)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                datePreset === p.id 
                  ? 'bg-indigo-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Row 4: Search Input */}
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari galon, gas, kasir..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Transactions List (Mobile Card Items) */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw size={24} className="animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-semibold">Memuat riwayat transaksi...</p>
          </div>
        ) : cashflows.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 flex flex-col items-center justify-center text-center text-slate-400 min-h-[220px]">
            <Wallet size={36} className="text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">Belum ada transaksi</h3>
            <p className="text-xs text-slate-400 mt-1">
              Catatan kas akan muncul di sini sesuai filter yang dipilih.
            </p>
          </div>
        ) : (
          cashflows.map(item => {
            const isPending = item.status === 'PENDING';
            const isRejected = item.status === 'REJECTED';
            const isApproved = item.status === 'APPROVED';
            const isExpense = item.type === 'Pengeluaran';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all bg-white shadow-2xs ${
                  isPending 
                    ? 'border-amber-300 bg-amber-50/20' 
                    : isRejected 
                      ? 'border-rose-200 bg-rose-50/15'
                      : 'border-slate-200/80'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Pocket Badge */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      item.pocket === 'DRAWER'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border border-amber-200'
                    }`}>
                      {item.pocket === 'DRAWER' ? 'Laci Kasir' : 'Kas Operasional'}
                    </span>

                    {/* Status Badge */}
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-white animate-pulse flex items-center gap-1">
                        <Clock size={10} /> Menunggu Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Disetujui
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <AlertCircle size={10} /> Ditolak
                      </span>
                    )}
                  </div>

                  {/* Nominal */}
                  <div className={`text-base font-black text-right ${
                    isExpense ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(item.amount)}
                  </div>
                </div>

                {/* Description & Category */}
                <div className="mb-2">
                  <div className="text-xs font-bold text-slate-800 leading-snug">
                    {item.description}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-600">{item.category}</span>
                    {item.subCategory && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500">{item.subCategory}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Photo receipt thumbnail if available */}
                {item.receiptUrl && (
                  <div className="mb-2 flex items-center gap-2">
                    <div 
                      onClick={() => setPreviewImage(item.receiptUrl)}
                      className="cursor-pointer group relative rounded-xl overflow-hidden border border-slate-200 w-14 h-14 bg-slate-100 flex-shrink-0"
                    >
                      <img src={item.receiptUrl} alt="Struk" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center text-white">
                        <Eye size={14} />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span className="font-bold text-indigo-700 cursor-pointer" onClick={() => setPreviewImage(item.receiptUrl)}>
                        Lihat Foto Struk / Nota Fisik
                      </span>
                      <p className="text-[10px] text-slate-400">Ketuk untuk memperbesar foto</p>
                    </div>
                  </div>
                )}

                {/* Rejection reason if rejected */}
                {isRejected && item.rejectionReason && (
                  <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                    <strong>Alasan Ditolak:</strong> {item.rejectionReason}
                  </div>
                )}

                {/* Footer Submitter & Actions */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span>Oleh: <strong className="text-slate-700">{item.user?.name || 'Kasir'}</strong></span>
                    <span>•</span>
                    <span>{formatDate(item.date)}</span>
                  </div>

                  {/* Actions for Owner / Admin */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {isPending && isOwnerOrAdmin && (
                      <>
                        <button
                          onClick={() => handleApprove(item)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                        >
                          <Check size={12} /> Setujui
                        </button>
                        <button
                          onClick={() => {
                            setRejectingItem(item);
                            setRejectReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <X size={12} /> Tolak
                        </button>
                      </>
                    )}

                    {(isOwnerOrAdmin || (item.userId === user?.id && isPending)) && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* CashFlow Create / Submit Modal */}
      <CashFlowModal
        isOpen={isModalOpen}
        initialType={modalType}
        initialPocket={modalPocket}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="bg-white rounded-3xl overflow-hidden max-w-sm sm:max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-800">Lampiran Foto Struk</span>
              <button 
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2 max-h-[75vh] overflow-auto flex items-center justify-center bg-black/5">
              <img src={previewImage} alt="Lampiran Foto" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setRejectingItem(null)}
        >
          <div 
            className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-rose-600 font-bold text-sm">
              <AlertCircle size={18} />
              <span>Tolak Pengajuan Pengeluaran</span>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Pengeluaran <strong>{rejectingItem.description}</strong> ({formatCurrency(rejectingItem.amount)}) akan ditolak. Berikan alasan penolakan untuk kasir:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Nota fisik tidak jelas / Beli tanpa persetujuan sebelumnya"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-500 mb-4"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CashFlowView;
