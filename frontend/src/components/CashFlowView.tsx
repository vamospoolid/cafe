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
  Zap, 
  DollarSign,
  TrendingDown,
  TrendingUp,
  Layers,
  Trash2,
  Calendar,
  Filter,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Download
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
  const [refreshing, setRefreshing] = useState(false);

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
  const storeName = posContext?.settings?.storeName || 'VAMOS POOL & CAFE';
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

  const fetchCashflow = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const url = new URL(`${window.location.origin}/api/cashflow`);
      if (pocketFilter !== 'ALL') url.searchParams.set('pocket', pocketFilter);
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);
      if (debouncedSearch.trim()) url.searchParams.set('search', debouncedSearch.trim());

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
      if (showSpinner) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSummary();
    fetchCashflow(false);
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
      fetchCashflow(true);
    }
  }, [posContext?.token, pocketFilter, statusFilter, datePreset, debouncedSearch]);

  // Real-time socket listeners
  useEffect(() => {
    const handleUpdate = () => {
      fetchSummary();
      fetchCashflow(false);
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
        fetchCashflow(false);
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
        fetchCashflow(false);
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
        fetchCashflow(false);
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
    const confirmed = await confirmAlert(`Hapus catatan transaksi "${item.description}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/cashflow/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Transaksi berhasil dihapus', 'success');
        fetchSummary();
        fetchCashflow(false);
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
    <div className="p-3 sm:p-6 w-full flex-1 flex flex-col bg-slate-50/60 text-slate-800 min-h-0 pb-28 sm:pb-6">
      
      {/* 1. Header Banner: Compact on Mobile, Expansive on Desktop */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs mb-3 sm:mb-4 flex-shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                Arus Kas & Petty Cash
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80 tracking-wide uppercase">
                Dual-Pocket Segregated
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-500 mt-0.5 leading-snug">
              Pemisahan ketat <strong>Kas Operasional Toko</strong> (galon, gas, listrik, bahan) vs <strong>Kas Laci Penjualan Kasir POS</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons: Optimized for Touch & Mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => {
              setModalType('Pengeluaran');
              setModalPocket('OPERATIONAL');
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-black shadow-md shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-1.5 order-1 sm:order-last"
          >
            <Plus size={15} />
            <span>Catat Pengeluaran</span>
          </button>

          <div className="grid grid-cols-6 sm:flex gap-1.5 sm:gap-2 order-2 sm:order-first">
            <button
              onClick={() => {
                setModalType('Pemasukan');
                setModalPocket('OPERATIONAL');
                setIsModalOpen(true);
              }}
              className="col-span-3 sm:col-span-1 py-2 sm:py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50/90 hover:bg-amber-100 text-amber-900 text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1 shadow-xs"
            >
              <ArrowDownRight size={14} className="text-amber-700" />
              <span>+ Isi Kas</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="col-span-2 sm:col-span-1 py-2 sm:py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-2xs"
            >
              <FileText size={14} className="text-rose-500" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleRefresh}
              title="Muat ulang data"
              className="col-span-1 py-2 sm:py-2.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all active:scale-95 shadow-2xs flex items-center justify-center"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Responsive 4-Column KPI Cards Grid (2x2 on Mobile, 4x1 on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mb-3 sm:mb-4 flex-shrink-0">
        
        {/* Card 1: Kas Operasional (Petty Cash) */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-900 flex items-center gap-1 tracking-wider truncate">
              <Wallet size={13} className="text-amber-600 shrink-0" />
              Kas Toko
            </span>
            <span className="hidden sm:inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
              Di Luar Laci
            </span>
          </div>

          <div className="text-lg sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1 tracking-tight truncate">
            {formatCurrency(summary.operationalBalance)}
          </div>

          <div className="text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 mt-1 sm:mt-2 border-t border-amber-200/60 font-semibold text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
            <span className="flex items-center gap-0.5 text-emerald-700 truncate">
              <TrendingUp size={11} className="shrink-0" /> In: <strong className="font-bold">{formatCurrency(summary.operationalIn)}</strong>
            </span>
            <span className="flex items-center gap-0.5 text-rose-700 truncate">
              <TrendingDown size={11} className="shrink-0" /> Out: <strong className="font-bold">{formatCurrency(summary.operationalOut)}</strong>
            </span>
          </div>
        </div>

        {/* Card 2: Laci Kasir (Sales Drawer) */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border border-emerald-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-900 flex items-center gap-1 tracking-wider truncate">
              <DollarSign size={13} className="text-emerald-600 shrink-0" />
              Laci Kasir
            </span>
            <span className="hidden sm:inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
              Shift Aktif
            </span>
          </div>

          <div className="text-lg sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1 tracking-tight truncate">
            {formatCurrency(summary.drawerBalance)}
          </div>

          <div className="text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 mt-1 sm:mt-2 border-t border-emerald-200/60 font-medium text-slate-500 flex items-center justify-between">
            <span className="truncate">Omset POS Shift</span>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded shrink-0">Zero Var</span>
          </div>
        </div>

        {/* Card 3: Antrean Approval Owner */}
        <div 
          onClick={() => setStatusFilter(summary.pendingCount > 0 ? 'PENDING' : 'ALL')}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-xs transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
            summary.pendingCount > 0
              ? 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-white border-rose-300 ring-2 ring-rose-300/40 hover:scale-[1.01]'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase text-rose-900 flex items-center gap-1 tracking-wider truncate">
              <Clock size={13} className="text-rose-600 shrink-0" />
              Approval
            </span>
            {summary.pendingCount > 0 ? (
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-rose-600 text-white shadow-xs animate-pulse shrink-0">
                {summary.pendingCount} Butuh
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 shrink-0">
                Beres
              </span>
            )}
          </div>

          <div className="text-lg sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1 tracking-tight truncate">
            {formatCurrency(summary.pendingAmount)}
          </div>

          <div className="text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 mt-1 sm:mt-2 border-t border-slate-100 font-medium text-slate-500 flex items-center justify-between">
            <span className="truncate">
              {summary.pendingCount === 0 ? 'Semua disetujui' : `${summary.pendingCount} pengajuan`}
            </span>
            {summary.pendingCount > 0 && (
              <span className="text-[10px] text-rose-600 font-bold flex items-center shrink-0">
                Tinjau <ArrowRight size={10} />
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Daily Burn Rate */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white border border-indigo-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1 tracking-wider truncate">
              <Zap size={13} className="text-indigo-600 shrink-0" />
              Burn Rate
            </span>
            <span className="hidden sm:inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
              30 Hari
            </span>
          </div>

          <div className="text-lg sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1 tracking-tight truncate">
            {formatCurrency(summary.dailyBurnRate)} <span className="text-[11px] font-normal text-slate-400">/hari</span>
          </div>

          <div className="text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 mt-1 sm:mt-2 border-t border-indigo-200/60 font-medium text-slate-500 truncate">
            Biaya harian (Gas, Es, Galon)
          </div>
        </div>

      </div>

      {/* 3. Unified Control & Filter Bar (Compact & Clean) */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-xs mb-3 sm:mb-3.5 flex-shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
        
        {/* Left: Kantong & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Kantong Tabs */}
          <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center bg-slate-100 p-1 rounded-xl gap-0.5">
            <button
              onClick={() => setPocketFilter('ALL')}
              className={`py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-black transition-all text-center ${
                pocketFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setPocketFilter('OPERATIONAL')}
              className={`py-1.5 px-2 sm:px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 ${
                pocketFilter === 'OPERATIONAL'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet size={12} />
              <span>Kas Toko</span>
            </button>
            <button
              onClick={() => setPocketFilter('DRAWER')}
              className={`py-1.5 px-2 sm:px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 ${
                pocketFilter === 'DRAWER'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign size={12} />
              <span>Laci Kasir</span>
            </button>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 text-xs w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                statusFilter === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Disetujui
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                statusFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Pending</span>
              {summary.pendingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                  {summary.pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('REJECTED')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                statusFilter === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ditolak
            </button>
          </div>
        </div>

        {/* Right: Date Presets & Search */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* Date Presets */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto scrollbar-none w-full sm:w-auto">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'this_week', label: '7 Hari' },
              { id: 'this_month', label: 'Bulan Ini' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap text-center ${
                  datePreset === p.id 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari transaksi..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-600 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 4. Transactions List: Dual-View (Desktop Table + Mobile Cards) */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 flex-1">
            <RefreshCw size={28} className="animate-spin text-indigo-600 mb-3" />
            <p className="text-xs font-bold text-slate-600">Memuat catatan arus kas...</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Sinkronisasi mutasi kas toko dan laci kasir</p>
          </div>
        ) : cashflows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center text-slate-400 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <Wallet size={28} />
            </div>
            <h3 className="text-sm font-black text-slate-700">Belum Ada Transaksi Kas</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Tidak ada catatan mutasi kas yang cocok dengan filter yang dipilih. Mulai catat pengeluaran atau isi kas operasional toko.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setModalType('Pengeluaran');
                  setModalPocket('OPERATIONAL');
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
              >
                + Catat Pengeluaran
              </button>
              <button
                onClick={() => {
                  setModalType('Pemasukan');
                  setModalPocket('OPERATIONAL');
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all"
              >
                + Isi Kas Toko
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 sticky top-0 z-10">
                    <th className="py-3 px-4 font-black text-slate-500 uppercase text-[10px] tracking-wider">Tanggal & Waktu</th>
                    <th className="py-3 px-3 font-black text-slate-500 uppercase text-[10px] tracking-wider">Kantong</th>
                    <th className="py-3 px-3 font-black text-slate-500 uppercase text-[10px] tracking-wider">Tipe & Kategori</th>
                    <th className="py-3 px-4 font-black text-slate-500 uppercase text-[10px] tracking-wider">Keterangan & Bukti</th>
                    <th className="py-3 px-4 font-black text-slate-500 uppercase text-[10px] tracking-wider text-right">Nominal</th>
                    <th className="py-3 px-3 font-black text-slate-500 uppercase text-[10px] tracking-wider">Kasir / User</th>
                    <th className="py-3 px-3 font-black text-slate-500 uppercase text-[10px] tracking-wider">Status</th>
                    <th className="py-3 px-4 font-black text-slate-500 uppercase text-[10px] tracking-wider text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashflows.map(item => {
                    const isPending = item.status === 'PENDING';
                    const isRejected = item.status === 'REJECTED';
                    const isApproved = item.status === 'APPROVED';
                    const isExpense = item.type === 'Pengeluaran';
                    const isDrawer = (item.cashPocket === 'LACI_KASIR' || item.pocket === 'DRAWER');
                    const receiptSrc = item.receiptImage || item.receiptUrl;

                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isPending ? 'bg-amber-50/20' : isRejected ? 'bg-rose-50/15' : ''
                        }`}
                      >
                        {/* Tanggal & Waktu */}
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{formatDate(item.date)}</span>
                          </div>
                        </td>

                        {/* Kantong */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                            isDrawer
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            {isDrawer ? <DollarSign size={11} /> : <Wallet size={11} />}
                            {isDrawer ? 'Laci Kasir' : 'Kas Toko'}
                          </span>
                        </td>

                        {/* Tipe & Kategori */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                              isExpense ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isExpense ? '↓' : '↑'}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">{item.category}</span>
                              {item.subCategory && (
                                <span className="text-[10px] text-slate-400 block">{item.subCategory}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Keterangan & Bukti */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 leading-snug">
                            {item.description}
                          </div>
                          {receiptSrc && (
                            <button
                              onClick={() => setPreviewImage(receiptSrc)}
                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition-all border border-indigo-200"
                            >
                              <Eye size={10} />
                              <span>Lihat Struk / Nota</span>
                            </button>
                          )}
                          {isRejected && item.rejectionReason && (
                            <div className="mt-1 text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <strong>Alasan:</strong> {item.rejectionReason}
                            </div>
                          )}
                        </td>

                        {/* Nominal */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`text-sm font-black ${
                            isExpense ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {isExpense ? '- ' : '+ '}
                            {formatCurrency(item.amount)}
                          </span>
                        </td>

                        {/* Petugas */}
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-700">
                          <span className="font-bold text-slate-800">{item.user?.name || item.user?.username || 'Kasir'}</span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-2xs animate-pulse">
                              <Clock size={10} /> Menunggu Approval
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} className="text-emerald-600" /> Disetujui
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                              <AlertCircle size={11} className="text-rose-600" /> Ditolak
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPending && isOwnerOrAdmin && (
                              <>
                                <button
                                  onClick={() => handleApprove(item)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                                  title="Setujui pengeluaran ini"
                                >
                                  <Check size={12} /> Setujui
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingItem(item);
                                    setRejectReason('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all"
                                  title="Tolak pengeluaran ini"
                                >
                                  <X size={12} /> Tolak
                                </button>
                              </>
                            )}

                            {(isOwnerOrAdmin || (item.userId === user?.id && isPending)) && (
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus transaksi"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 p-2">
              {cashflows.map(item => {
                const isPending = item.status === 'PENDING';
                const isRejected = item.status === 'REJECTED';
                const isApproved = item.status === 'APPROVED';
                const isExpense = item.type === 'Pengeluaran';
                const isDrawer = (item.cashPocket === 'LACI_KASIR' || item.pocket === 'DRAWER');
                const receiptSrc = item.receiptImage || item.receiptUrl;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl mb-2.5 border transition-all bg-white shadow-2xs ${
                      isPending 
                        ? 'border-amber-300 bg-amber-50/20' 
                        : isRejected 
                          ? 'border-rose-200 bg-rose-50/15'
                          : 'border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                          isDrawer
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          {isDrawer ? 'Laci Kasir' : 'Kas Toko'}
                        </span>

                        {isPending && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-white animate-pulse flex items-center gap-1">
                            <Clock size={10} /> Approval
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Disetujui
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <AlertCircle size={10} /> Ditolak
                          </span>
                        )}
                      </div>

                      <div className={`text-sm font-black text-right ${
                        isExpense ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {isExpense ? '- ' : '+ '}
                        {formatCurrency(item.amount)}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="text-xs font-bold text-slate-800 leading-snug">
                        {item.description}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-600">{item.category}</span>
                        {item.subCategory && <span> • {item.subCategory}</span>}
                      </div>
                    </div>

                    {receiptSrc && (
                      <div className="mb-2 flex items-center gap-2">
                        <div 
                          onClick={() => setPreviewImage(receiptSrc)}
                          className="cursor-pointer group relative rounded-xl overflow-hidden border border-slate-200 w-12 h-12 bg-slate-100 flex-shrink-0"
                        >
                          <img src={receiptSrc} alt="Struk" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white">
                            <Eye size={12} />
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-700 cursor-pointer" onClick={() => setPreviewImage(receiptSrc)}>
                          Lihat Foto Struk Fisik
                        </span>
                      </div>
                    )}

                    {isRejected && item.rejectionReason && (
                      <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                        <strong>Alasan Ditolak:</strong> {item.rejectionReason}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex-wrap gap-2">
                      <span>{item.user?.name || 'Kasir'} • {formatDate(item.date)}</span>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {isPending && isOwnerOrAdmin && (
                          <>
                            <button
                              onClick={() => handleApprove(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-xs"
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
              })}
            </div>
          </>
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
              <span className="text-xs font-bold text-slate-800">Lampiran Foto Struk / Nota Fisik</span>
              <button 
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
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
