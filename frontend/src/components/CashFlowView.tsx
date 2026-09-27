import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, 
  FileText, Tag, Layers, Search, Utensils, Coffee, Box, Zap, Users, Wrench, User, Calendar, Trash2,
  Filter, RefreshCw, Package, Droplets, ShoppingCart, ShoppingBag, Truck, Check, X, AlertTriangle,
  Camera, Eye, ArrowRight, ShieldCheck, Clock, CheckCircle2, XCircle, RotateCcw
} from 'lucide-react';
import CashFlowModal from './CashFlowModal';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import useSocket from '../hooks/useSocket';
import { toast, confirmAlert } from '../utils/alert';
import { exportPettyCashPDF } from '../utils/pdfGenerator';

interface CashSummary {
  kasOperasional: {
    balance: number;
    totalIn: number;
    totalOut: number;
    pendingApprovalsCount: number;
    pendingApprovalsAmount: number;
    rejectedCount: number;
    rejectedAmount: number;
  };
  laciKasir: {
    balance: number;
    totalIn: number;
    totalOut: number;
  };
}

interface OperationalAnalytics {
  periodDays: number;
  totalExpenseAmount: number;
  dailyBurnRate: number;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  emergencyProcurementsCount: number;
  emergencyProcurements: any[];
}

const CashFlowView = () => {
  const { isBengkel, isRetail } = useVertical();
  const socket = useSocket();
  const posContext = useContext(POSContext);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultPocket, setModalDefaultPocket] = useState<'KAS_OPERASIONAL' | 'LACI_KASIR'>('KAS_OPERASIONAL');
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [selectedPocket, setSelectedPocket] = useState<'ALL' | 'KAS_OPERASIONAL' | 'LACI_KASIR'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED'>('ALL');
  const [selectedMainCat, setSelectedMainCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Date Filter State
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dual-Pocket Summary & Analytics State
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [analytics, setAnalytics] = useState<OperationalAnalytics | null>(null);

  // Modals state for Approval, Rejection & Image Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal state for Revising Rejected Item
  const [revisingItem, setRevisingItem] = useState<any | null>(null);
  const [reviseAmount, setReviseAmount] = useState<number>(0);
  const [reviseDescription, setReviseDescription] = useState('');
  const [reviseReceipt, setReviseReceipt] = useState<string | null>(null);
  const [uploadingRevise, setUploadingRevise] = useState(false);

  const isOwnerOrAdmin = useMemo(() => {
    const role = (posContext?.user?.role || '').toUpperCase();
    return ['OWNER', 'ADMIN', 'SUPERADMIN', 'MANAGER'].includes(role) || Boolean(posContext?.user?.isPlatformAdmin);
  }, [posContext?.user]);

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

  // 1. Fetch List of Cashflows
  const fetchCashflow = async (s?: string, e?: string, type?: string, pocket?: string, status?: string) => {
    setLoading(true);
    try {
      const url = new URL(`${window.location.origin}/api/cashflow`);
      const t = type !== undefined ? type : filterType;
      const start = s !== undefined ? s : startDate;
      const end = e !== undefined ? e : endDate;
      const p = pocket !== undefined ? pocket : selectedPocket;
      const st = status !== undefined ? status : selectedStatus;

      if (t) url.searchParams.set('type', t);
      if (p && p !== 'ALL') url.searchParams.set('cashPocket', p);
      if (st && st !== 'ALL') url.searchParams.set('status', st);

      if (start && end) {
        url.searchParams.set('startDate', start);
        url.searchParams.set('endDate', end);
        url.searchParams.set('tzOffset', (new Date().getTimezoneOffset()).toString());
      }

      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCashflows(data);
      } else {
        setCashflows([]);
      }
    } catch (err) {
      console.error('[CASHFLOW] Error fetching list:', err);
      setCashflows([]);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Summary (Dual-Pocket Balances)
  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/cashflow/summary', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('[CASHFLOW] Error fetching summary:', err);
    }
  };

  // 3. Fetch Operational Analytics
  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/cashflow/operational-analytics', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('[CASHFLOW] Error fetching analytics:', err);
    }
  };

  const refreshAll = () => {
    fetchCashflow();
    fetchSummary();
    fetchAnalytics();
  };

  useEffect(() => {
    if (posContext?.token) {
      refreshAll();
    }
  }, [posContext?.token, filterType, selectedPocket, selectedStatus]);

  // Real-time Socket.IO Sync
  useEffect(() => {
    if (!socket) return;

    const handleCashFlowEvent = (data: any) => {
      refreshAll();
    };

    const handleExpenseRequested = (data: any) => {
      toast(`Pengajuan Kas Baru: ${data.description} (${formatCurrency(data.amount)})`, 'info');
      refreshAll();
    };

    socket.on('cashflow:created', handleCashFlowEvent);
    socket.on('cashflow:updated', handleCashFlowEvent);
    socket.on('cashflow:requested', handleExpenseRequested);
    socket.on('cashflow:approved', handleCashFlowEvent);
    socket.on('cashflow:rejected', handleCashFlowEvent);
    socket.on('cashflow:deleted', handleCashFlowEvent);

    return () => {
      socket.off('cashflow:created', handleCashFlowEvent);
      socket.off('cashflow:updated', handleCashFlowEvent);
      socket.off('cashflow:requested', handleExpenseRequested);
      socket.off('cashflow:approved', handleCashFlowEvent);
      socket.off('cashflow:rejected', handleCashFlowEvent);
      socket.off('cashflow:deleted', handleCashFlowEvent);
    };
  }, [socket]);

  const setPresetDate = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'this_month') => {
    setDatePreset(preset);
    const now = new Date();
    let s: Date | null = null;
    let e: Date | null = null;

    if (preset === 'today') {
      s = new Date();
      e = new Date();
    } else if (preset === 'yesterday') {
      s = new Date();
      s.setDate(now.getDate() - 1);
      e = new Date();
      e.setDate(now.getDate() - 1);
    } else if (preset === 'last7') {
      s = new Date();
      s.setDate(now.getDate() - 6);
      e = new Date();
    } else if (preset === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date();
    }

    const startStr = s ? s.toISOString().split('T')[0] : '';
    const endStr = e ? e.toISOString().split('T')[0] : '';
    setStartDate(startStr);
    setEndDate(endStr);
    fetchCashflow(startStr, endStr, filterType, selectedPocket, selectedStatus);
  };

  const handleSave = async (data: any) => {
    try {
      const res = await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast('Transaksi kas berhasil dicatat!', 'success');
        setIsModalOpen(false);
        refreshAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan transaksi kas', 'error');
      }
    } catch (err) { 
      console.error(err); 
      toast('Terjadi kesalahan saat menyimpan transaksi', 'error');
    }
  };

  // Owner Approve Action
  const handleApprove = async (id: number) => {
    const c = await confirmAlert('Setujui Pengeluaran', 'Apakah Anda yakin ingin menyetujui pengeluaran operasional ini?');
    if (!c.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/cashflow/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Pengeluaran berhasil disetujui!', 'success');
        refreshAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyetujui pengeluaran', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal memproses persetujuan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Owner Reject Action
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) {
      toast('Alasan penolakan wajib diisi', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/cashflow/${rejectingItem.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify({ rejectionReason })
      });
      if (res.ok) {
        toast('Pengeluaran berhasil ditolak', 'success');
        setRejectingItem(null);
        setRejectionReason('');
        refreshAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menolak pengeluaran', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal memproses penolakan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Owner Convert Rejected Expense to Employee Loan
  const handleConvertToLoan = async (id: number) => {
    const c = await confirmAlert(
      'Alihkan ke Kasbon Karyawan',
      'Pengeluaran yang ditolak akan dialihkan menjadi hutang/kasbon staf terkait dan dipotong dari gaji.'
    );
    if (!c.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/cashflow/${id}/convert-to-loan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast(data.message || 'Berhasil dialihkan ke Kasbon Staf', 'success');
        refreshAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengalihkan ke kasbon', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal memproses kasbon', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cashier Revise Rejected Expense Submit
  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisingItem) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/cashflow/${revisingItem.id}/revise`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify({
          amount: reviseAmount,
          description: reviseDescription,
          receiptImage: reviseReceipt
        })
      });
      if (res.ok) {
        toast('Pengeluaran berhasil direvisi dan diajukan ulang ke Owner', 'success');
        setRevisingItem(null);
        refreshAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal merevisi pengeluaran', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gagal merevisi pengeluaran', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const c = await confirmAlert('Hapus Catatan Kas', 'Apakah Anda yakin ingin menghapus catatan transaksi kas ini?');
    if (!c.isConfirmed) return;

    try {
      const res = await fetch(`/api/cashflow/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Catatan kas berhasil dihapus', 'success');
        refreshAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menghapus catatan kas', 'error');
      }
    } catch (err) { 
      console.error(err); 
      toast('Gagal menghapus transaksi', 'error');
    }
  };

  const parseCategory = (catStr: any) => {
    if (!catStr || typeof catStr !== 'string') return { main: 'Umum', sub: '' };
    const parts = catStr.split(' - ');
    if (parts.length > 1) {
      return { main: parts[0].trim(), sub: parts.slice(1).join(' - ').trim() };
    }
    return { main: catStr.trim(), sub: '' };
  };

  const isIncomeRecord = (type: string) => type === 'Pemasukan' || type === 'IN';
  const isExpenseRecord = (type: string) => type === 'Pengeluaran' || type === 'OUT';

  // Filtered Cashflows
  const filteredCashflows = useMemo(() => {
    return cashflows.filter(cf => {
      const { main } = parseCategory(cf.category);
      if (selectedMainCat !== 'ALL') {
        const mainLower = (main || '').toLowerCase();
        const selLower = selectedMainCat.toLowerCase();
        if (!mainLower.includes(selLower) && !selLower.includes(mainLower)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (cf.description || '').toLowerCase().includes(q);
        const matchCat = (cf.category || '').toLowerCase().includes(q);
        const matchUser = (cf.user?.name || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchUser) return false;
      }
      return true;
    });
  }, [cashflows, selectedMainCat, searchQuery]);

  // Antrean khusus pengajuan pending approval untuk Owner
  const pendingApprovals = useMemo(() => {
    return cashflows.filter(cf => cf.status === 'PENDING_APPROVAL');
  }, [cashflows]);

  const exportPDF = async () => {
    if (filteredCashflows.length === 0) {
      toast('Tidak ada data transaksi kas untuk diekspor.', 'error');
      return;
    }
    try {
      await exportPettyCashPDF(
        filteredCashflows,
        posContext?.settings || { storeName: isBengkel ? 'BENGKEL MOTOR & MOBIL' : 'KAFE & RESTORAN' },
        {
          category: selectedMainCat === 'ALL' ? 'Semua Kategori' : selectedMainCat,
          type: filterType || 'Semua',
          searchQuery: searchQuery
        },
        posContext?.user?.username || 'Administrator'
      );
      toast('Laporan Buku Kas & Arus Kas berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Gagal export PDF kas:', err);
      toast('Terjadi kesalahan saat membuat dokumen PDF.', 'error');
    }
  };

  const categoryIcons: Record<string, any> = {
    'Bahan Makanan': <Utensils size={14} className="text-amber-500" />,
    'Bahan Minuman': <Coffee size={14} className="text-orange-500" />,
    'Kemasan & Packaging': <Box size={14} className="text-blue-500" />,
    'Operasional Cafe': <Zap size={14} className="text-purple-500" />,
    'SDM & Karyawan': <Users size={14} className="text-emerald-500" />,
    'Perawatan & Aset': <Wrench size={14} className="text-slate-500" />,
    'Suku Cadang & Sparepart': <Package size={14} className="text-blue-500" />,
    'Oli & Cairan Kimia': <Droplets size={14} className="text-orange-500" />,
    'Perawatan Toolkit & Kompresor': <Wrench size={14} className="text-amber-500" />,
    'Operasional Bengkel': <Zap size={14} className="text-purple-500" />,
    'SDM & Mekanik': <Users size={14} className="text-emerald-500" />
  };

  return (
    <div className="p-3 sm:p-5 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      {/* 1. Header Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-primary shadow-inner">
            <DollarSign size={22} className="text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-black text-gray-900 tracking-tight">Kas Operasional & Petty Cash</h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                Dual-Pocket Segregated
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              Pemisahan ketat Kas Operasional Toko (galon, gas, listrik, bahan) vs Kas Penjualan Laci Kasir
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            className="flex-1 sm:flex-none py-2 px-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer" 
            onClick={exportPDF}
          >
            <FileText size={15} className="text-rose-500" /> 
            <span>Export PDF</span>
          </button>

          {isOwnerOrAdmin && (
            <button 
              className="flex-1 sm:flex-none py-2 px-3 bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer" 
              onClick={() => {
                setModalDefaultPocket('KAS_OPERASIONAL');
                setIsModalOpen(true);
              }}
            >
              <Wallet size={15} className="text-amber-600" /> 
              <span>+ Isi Kas Operasional</span>
            </button>
          )}

          <button 
            className="flex-1 sm:flex-none py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 transition-all active:scale-95 cursor-pointer" 
            onClick={() => {
              setModalDefaultPocket('KAS_OPERASIONAL');
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> 
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </div>

      {/* 2. DUAL-POCKET 4-KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        
        {/* Card 1: Kas Operasional Toko */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/70 border border-amber-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={15} className="text-amber-600" />
              Kas Operasional (Petty Cash)
            </span>
            <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.5 rounded-full">
              Di Luar Laci
            </span>
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black tracking-tight ${
              (summary?.kasOperasional.balance || 0) >= 0 ? 'text-amber-950' : 'text-rose-600'
            }`}>
              {formatCurrency(summary?.kasOperasional.balance || 0)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-900/80 font-bold mt-1 pt-1 border-t border-amber-200/60">
              <span>Masuk: {formatCurrency(summary?.kasOperasional.totalIn || 0)}</span>
              <span>Keluar: {formatCurrency(summary?.kasOperasional.totalOut || 0)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Laci Kasir (Sales Cash Drawer) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border border-emerald-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={15} className="text-emerald-600" />
              Laci Kasir (Sales Drawer)
            </span>
            <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-1.5 py-0.5 rounded-full">
              Omset & Modal
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
              {formatCurrency(summary?.laciKasir.balance || 0)}
            </div>
            <p className="text-[10px] text-emerald-800/80 font-semibold mt-1">
              Khusus omset POS & modal awal shift (Zero Variance)
            </p>
          </div>
        </div>

        {/* Card 3: Antrean Approval Owner */}
        <div 
          onClick={() => {
            setSelectedStatus('PENDING_APPROVAL');
            setSelectedPocket('ALL');
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
            (summary?.kasOperasional.pendingApprovalsCount || 0) > 0
              ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-200/80 hover:bg-rose-100/80'
              : 'bg-white border-gray-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={15} className="text-rose-600" />
              {isOwnerOrAdmin ? 'Antrean Approval Owner' : 'Menunggu Persetujuan'}
            </span>
            {(summary?.kasOperasional.pendingApprovalsCount || 0) > 0 && (
              <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                {summary?.kasOperasional.pendingApprovalsCount} Pengajuan
              </span>
            )}
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-950 tracking-tight">
              {formatCurrency(summary?.kasOperasional.pendingApprovalsAmount || 0)}
            </div>
            <p className="text-[10px] text-rose-800 font-bold mt-1">
              {(summary?.kasOperasional.pendingApprovalsCount || 0) > 0 
                ? (isOwnerOrAdmin ? 'Klik untuk review nota & setujui' : 'Menunggu verifikasi Owner')
                : 'Tidak ada pengajuan pending'}
            </p>
          </div>
        </div>

        {/* Card 4: Daily Burn Rate & Biaya Darurat */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-blue-50/70 border border-indigo-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={15} className="text-indigo-600" />
              Daily Burn Rate
            </span>
            <span className="text-[10px] bg-indigo-200 text-indigo-900 font-extrabold px-1.5 py-0.5 rounded-full">
              Rata-Rata
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
              {formatCurrency(analytics?.dailyBurnRate || 0)}
              <span className="text-xs font-bold text-indigo-600"> /hari</span>
            </div>
            <p className="text-[10px] text-indigo-800/80 font-bold mt-1">
              {analytics?.emergencyProcurementsCount || 0} Belanja darurat (Galon, Gas, Es)
            </p>
          </div>
        </div>

      </div>

      {/* 3. Filter Bar (Pocket Tabs, Date Range, Status & Search) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col gap-3 shrink-0">
        
        {/* Row 1: Pocket Segmented Tabs & Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSelectedPocket('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedPocket === 'ALL'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Kantong
            </button>
            <button
              onClick={() => setSelectedPocket('KAS_OPERASIONAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedPocket === 'KAS_OPERASIONAL'
                  ? 'bg-white text-amber-800 shadow-xs border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet size={13} className="text-amber-600" />
              Kas Operasional
            </button>
            <button
              onClick={() => setSelectedPocket('LACI_KASIR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedPocket === 'LACI_KASIR'
                  ? 'bg-white text-emerald-800 shadow-xs border border-emerald-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign size={13} className="text-emerald-600" />
              Laci Kasir
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400">Status:</span>
            {[
              { val: 'ALL', label: 'Semua' },
              { val: 'APPROVED', label: 'Disetujui' },
              { 
                val: 'PENDING_APPROVAL', 
                label: `Pending (${summary?.kasOperasional.pendingApprovalsCount || 0})` 
              },
              { val: 'REJECTED', label: 'Ditolak' }
            ].map(st => (
              <button
                key={st.val}
                onClick={() => setSelectedStatus(st.val as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === st.val
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Date Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: 'Semua Waktu', val: 'all' },
              { label: 'Hari Ini', val: 'today' },
              { label: 'Kemarin', val: 'yesterday' },
              { label: 'Minggu Ini', val: 'last7' },
              { label: 'Bulan Ini', val: 'this_month' }
            ].map(p => (
              <button
                key={p.val}
                onClick={() => setPresetDate(p.val as any)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p.val
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-gray-300 rounded-xl shadow-xs outline-none focus:bg-white focus:border-indigo-500"
                placeholder="Cari galon, gas, kasir..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              onClick={refreshAll}
              title="Muat Ulang Data Kas"
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

      </div>

      {/* 4. Dedicated Approval Queue Banner for Owner (Muncul menonjol saat ada pengajuan pending) */}
      {isOwnerOrAdmin && pendingApprovals.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm space-y-3 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-rose-200/70 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-sm animate-pulse">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-950 flex items-center gap-2">
                  <span>Antrean Persetujuan Pengeluaran Kasir</span>
                  <span className="text-xs bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                    {pendingApprovals.length} Pengajuan Menunggu
                  </span>
                </h3>
                <p className="text-[11px] text-rose-800 font-medium">
                  Kasir telah mencatat pengeluaran harian dari Kas Operasional. Silakan periksa foto nota struk dan klik [Setujui] atau [Tolak].
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingApprovals.map(item => (
              <div key={item.id} className="bg-white rounded-xl p-3 border border-rose-200 shadow-xs flex flex-col justify-between space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {item.receiptImage ? (
                      <img
                        src={item.receiptImage}
                        alt="Nota"
                        onClick={() => setPreviewImage(item.receiptImage)}
                        className="w-12 h-12 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 shrink-0"
                        title="Klik untuk zoom nota"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <FileText size={18} />
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-black text-gray-900 line-clamp-1">{item.description}</span>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Oleh: <span className="font-bold text-gray-700">{item.user?.name || 'Kasir'}</span> • {formatDate(item.date)}
                      </span>
                      {item.linkedIngredient && item.restockQty > 0 && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5 border border-emerald-200">
                          + {item.restockQty} {item.linkedIngredient.unit} (Auto-Restock Dapur)
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-black text-rose-600 text-sm whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={actionLoading}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <Check size={14} /> Setujui (Approve)
                  </button>
                  <button
                    onClick={() => {
                      setRejectingItem(item);
                      setRejectionReason('');
                    }}
                    disabled={actionLoading}
                    className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <X size={14} /> Tolak (Reject)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Main Transaction Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col shrink-0">
        
        {/* Table Header */}
        <div className="p-3.5 sm:p-4 border-b border-gray-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
              <span>📋 Riwayat Catatan Kas & Pengeluaran</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {filteredCashflows.length} Catatan
              </span>
            </h3>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-10 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Memuat data kas...
          </div>
        ) : filteredCashflows.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <FileText size={36} className="mx-auto text-gray-300 mb-2" />
            <div className="font-bold text-gray-600 text-sm">Belum Ada Catatan Kas Yang Sesuai Filter</div>
            <p className="text-xs text-gray-400 mt-1">Klik tombol "+ Catat Pengeluaran" di atas untuk menambah pengeluaran baru.</p>
          </div>
        ) : (
          <div className="p-0">
            {/* Desktop View Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-gray-200 text-xs font-black text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">TANGGAL & STATUS</th>
                    <th className="py-3 px-4">KANTONG KAS</th>
                    <th className="py-3 px-4">KATEGORI & NOTA</th>
                    <th className="py-3 px-4">RINCIAN KETERANGAN</th>
                    <th className="py-3 px-4 text-right">NOMINAL</th>
                    <th className="py-3 px-4 text-center">PENCATAT</th>
                    <th className="py-3 px-4 text-center">AKSI / APPROVAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredCashflows.map((cf, idx) => {
                    const { main, sub } = parseCategory(cf.category);
                    const isIncome = isIncomeRecord(cf.type);
                    const amt = Number(cf.amount) || 0;
                    const isPending = cf.status === 'PENDING_APPROVAL';
                    const isRejected = cf.status === 'REJECTED';
                    const isApproved = cf.status === 'APPROVED';

                    return (
                      <tr 
                        key={cf.id || idx} 
                        className={`hover:bg-indigo-50/40 transition-colors ${
                          isPending 
                            ? 'bg-rose-50/40 border-l-4 border-l-rose-500' 
                            : isRejected 
                              ? 'bg-red-50/30 border-l-4 border-l-red-400' 
                              : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        {/* Tanggal & Status Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-xs font-bold text-gray-900">{formatDate(cf.date)}</div>
                          <div className="mt-1">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                <Clock size={10} /> Menunggu Approval
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 size={10} /> Disetujui
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                                <XCircle size={10} /> Ditolak
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Kantong Kas */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border ${
                            cf.cashPocket === 'LACI_KASIR'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {cf.cashPocket === 'LACI_KASIR' ? (
                              <>
                                <DollarSign size={12} className="text-emerald-600" />
                                Laci Kasir
                              </>
                            ) : (
                              <>
                                <Wallet size={12} className="text-amber-600" />
                                Kas Operasional
                              </>
                            )}
                          </span>
                        </td>

                        {/* Kategori & Thumbnail Nota */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {cf.receiptImage ? (
                              <img 
                                src={cf.receiptImage} 
                                alt="Nota" 
                                onClick={() => setPreviewImage(cf.receiptImage)}
                                className="w-10 h-10 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
                                title="Klik untuk lihat foto nota penuh"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <FileText size={18} />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs">
                                {categoryIcons[main] || <Tag size={13} className="text-gray-400" />}
                                <span>{main}</span>
                              </div>
                              {sub && (
                                <span className="inline-block mt-0.5 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium border border-indigo-100">
                                  {sub}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Rincian Keterangan */}
                        <td className="py-3 px-4 text-xs text-gray-800 max-w-[280px]">
                          <p className="font-semibold line-clamp-2" title={cf.description}>
                            {cf.description || '-'}
                          </p>

                          {/* Info Linked Ingredient Restock */}
                          {cf.linkedIngredient && cf.restockQty > 0 && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Package size={11} className="text-emerald-600" />
                              Auto Restock: +{cf.restockQty} {cf.linkedIngredient.unit}
                            </div>
                          )}

                          {/* Alasan Penolakan */}
                          {isRejected && cf.rejectionReason && (
                            <div className="mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                              Alasan Tolak: "{cf.rejectionReason}"
                            </div>
                          )}

                          {/* Info Resolusi Kasbon */}
                          {cf.resolutionAction === 'CONVERT_LOAN' && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              <Check size={11} className="text-indigo-600" /> Dialihkan ke Kasbon Karyawan
                            </div>
                          )}
                        </td>

                        {/* Nominal */}
                        <td className={`py-3 px-4 text-right font-black text-sm whitespace-nowrap ${
                          isIncome ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(amt)}
                        </td>

                        {/* Pencatat / Approver */}
                        <td className="py-3 px-4 text-center whitespace-nowrap text-xs">
                          <span className="font-bold text-gray-800 block">
                            {cf.user?.name || 'Staff'}
                          </span>
                          {cf.approver && (
                            <span className="text-[10px] text-gray-400 block">
                              Acc: {cf.approver.name}
                            </span>
                          )}
                        </td>

                        {/* Aksi & Workflow Approval */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isPending ? (
                            <span 
                              className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1"
                              title={isOwnerOrAdmin ? 'Silakan setujui atau tolak pada kotak antrean di bagian atas' : 'Menunggu persetujuan Owner'}
                            >
                              <Clock size={12} className="text-amber-500" />
                              {isOwnerOrAdmin ? 'Cek Antrean di Atas ☝️' : 'Menunggu Owner'}
                            </span>
                          ) : isRejected ? (
                            <div className="flex items-center justify-center gap-1">
                              {cf.resolutionAction === 'NONE' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setRevisingItem(cf);
                                      setReviseAmount(cf.amount);
                                      setReviseDescription(cf.description);
                                      setReviseReceipt(cf.receiptImage);
                                    }}
                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    title="Revisi & Ajukan Ulang"
                                  >
                                    <RotateCcw size={12} /> Revisi
                                  </button>

                                  {isOwnerOrAdmin && (
                                    <button
                                      onClick={() => handleConvertToLoan(cf.id)}
                                      disabled={actionLoading}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                      title="Alihkan ke Kasbon Karyawan"
                                    >
                                      <Users size={12} /> Kasbon
                                    </button>
                                  )}
                                </>
                              )}
                              {isOwnerOrAdmin && (
                                <button 
                                  onClick={() => handleDelete(cf.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                  title="Hapus Catatan"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ) : isOwnerOrAdmin ? (
                            <button 
                              onClick={() => handleDelete(cf.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hapus Transaksi"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs font-medium">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card List */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredCashflows.map((cf, idx) => {
                const { main, sub } = parseCategory(cf.category);
                const isIncome = isIncomeRecord(cf.type);
                const amt = Number(cf.amount) || 0;
                const isPending = cf.status === 'PENDING_APPROVAL';
                const isRejected = cf.status === 'REJECTED';

                return (
                  <div key={cf.id || idx} className="p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {categoryIcons[main] || <Tag size={13} className="text-gray-400" />}
                          <span className="font-bold text-sm text-gray-900">{main}</span>
                        </div>
                        {sub && (
                          <span className="inline-block mt-0.5 text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-semibold">
                            {sub}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-black text-sm ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(amt)}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPending 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                            : isRejected 
                              ? 'bg-rose-100 text-rose-900 border border-rose-300' 
                              : isIncome 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isPending ? 'Pending' : isRejected ? 'Ditolak' : cf.type}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-700 font-medium bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                      {cf.description || '-'}
                    </div>

                    {cf.receiptImage && (
                      <div className="flex items-center gap-2 pt-1">
                        <img 
                          src={cf.receiptImage} 
                          alt="Nota" 
                          onClick={() => setPreviewImage(cf.receiptImage)}
                          className="w-12 h-12 object-cover rounded-lg border border-gray-300 cursor-pointer" 
                        />
                        <span className="text-[11px] text-indigo-600 font-bold cursor-pointer" onClick={() => setPreviewImage(cf.receiptImage)}>
                          Lihat Bukti Foto Nota
                        </span>
                      </div>
                    )}

                    {isPending && (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1.5 w-full justify-center">
                          <Clock size={12} className="text-amber-500" />
                          <span>{isOwnerOrAdmin ? 'Menunggu Persetujuan (Cek Antrean di Atas ☝️)' : 'Menunggu Persetujuan Owner'}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Full Preview Foto Nota */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Camera size={14} className="text-indigo-600" /> Foto Nota Bukti Belanja
              </span>
              <button 
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto flex items-center justify-center bg-slate-900/5 rounded-xl p-2">
              <img src={previewImage} alt="Nota Penuh" className="max-h-[75vh] w-auto object-contain rounded-lg shadow-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alasan Penolakan Owner */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm">
                <AlertTriangle size={18} />
                <span>Tolak Pengeluaran Operasional</span>
              </div>
              <button 
                onClick={() => setRejectingItem(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-gray-700 space-y-1">
              <p><span className="font-bold">Deskripsi:</span> {rejectingItem.description}</p>
              <p><span className="font-bold">Nominal:</span> {formatCurrency(rejectingItem.amount)}</p>
              <p><span className="font-bold">Kasir:</span> {rejectingItem.user?.name || 'Staf'}</p>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Alasan Penolakan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Nota tidak jelas / bukan kebutuhan operasional resmi"
                  className="w-full bg-white border border-gray-300 text-xs rounded-xl p-2.5 outline-none focus:border-rose-500 resize-none font-medium"
                  required
                />
              </div>

              {/* Quick Presets for Rejection */}
              <div className="flex flex-wrap gap-1">
                {[
                  'Foto nota tidak jelas / buram',
                  'Bukan pengeluaran operasional resmi',
                  'Nominal struk tidak sesuai',
                  'Sudah dibelanjakan sebelumnya'
                ].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectionReason(r)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? 'Memproses...' : 'Tolak Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Kasir Revisi Nota & Pengeluaran Ditolak */}
      {revisingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-sm">
                <RotateCcw size={18} />
                <span>Revisi & Ajukan Ulang Pengeluaran</span>
              </div>
              <button 
                onClick={() => setRevisingItem(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {revisingItem.rejectionReason && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <span className="font-bold">Alasan Penolakan:</span> "{revisingItem.rejectionReason}"
              </div>
            )}

            <form onSubmit={handleReviseSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  value={reviseAmount}
                  onChange={(e) => setReviseAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-gray-300 text-xs font-bold rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Keterangan / Rincian</label>
                <textarea
                  rows={2}
                  value={reviseDescription}
                  onChange={(e) => setReviseDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-300 text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              {/* Upload Foto Nota Baru */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Foto Nota / Struk Baru</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingRevise(true);
                    try {
                      const fd = new FormData();
                      fd.append('image', file);
                      const res = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${posContext?.token}` },
                        body: fd
                      });
                      const d = await res.json();
                      if (res.ok && d.imageUrl) setReviseReceipt(d.imageUrl);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setUploadingRevise(false);
                    }
                  }}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {reviseReceipt && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={reviseReceipt} alt="Nota Revisi" className="w-12 h-12 object-cover rounded-lg border border-gray-300" />
                    <span className="text-xs text-emerald-600 font-bold">Foto baru terlampir!</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevisingItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || uploadingRevise}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? 'Menyimpan...' : 'Ajukan Ulang ke Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Cash Flow Modal */}
      <CashFlowModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave}
        defaultPocket={modalDefaultPocket}
      />
    </div>
  );
};

export default CashFlowView;
