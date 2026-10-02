import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Star,
  Shirt,
  Users,
  Calendar,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Layers,
  CreditCard,
  Package,
  Search,
  BellRing,
  Printer,
  FileText,
  Coins,
  Phone,
  CheckSquare
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { RentalCronModal } from './RentalCronModal';
import { RentalSendReminderModal, type RentalOrderReminderTarget } from './RentalSendReminderModal';
import {
  generateRentalFinancialPDF,
  generateRentalCustodyWorksheetPDF
} from '../../utils/pdfGenerator';

type QuickFilter = 'today' | 'week' | 'month' | 'last_month' | 'custom';
type ActiveTab   = 'overview' | 'custody' | 'unpaid' | 'overdue' | 'busana' | 'customers';

interface AnalyticsData {
  period: { type: string; startDate: string; endDate: string };
  summary: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    activeOrders: number;
    totalRevenue: number;
    totalPaid: number;
    unpaidBalance: number;
    totalDiscount: number;
    netIncome: number;
    avgTicket: number;
    totalDeposit: number;
    totalDepositRefunded: number;
    depositHeld: number;
    totalLateFee: number;
    totalDamageFee: number;
    totalPenalty: number;
    totalGrossRevenue?: number;
    activeCollateralCount?: number;
    unpaidOrdersCount?: number;
  };
  pipeline: Record<string, { count: number; revenue: number }>;
  topBusana: Array<{ name: string; code: string; count: number; revenue: number; color: string }>;
  dailyTrend: Array<{ date: string; revenue: number; orders: number }>;
  overdueReturns: Array<{
    id: string; orderNumber: string; customerName: string; customerPhone?: string;
    returnDeadline: string; totalAmount: number; paidAmount: number;
    depositAmount: number; eventDate: string; daysOverdue: number;
  }>;
  topCustomers: Array<{ name: string; phone: string; count: number; revenue: number; paid: number }>;
  paymentMethods: Array<{ method: string; count: number; amount: number }>;
  depositBreakdown: Array<{ status: string; count: number; amount: number; refunded: number }>;
  activeCustodyOrders?: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string;
    eventDate: string;
    pickupDate: string;
    returnDeadline: string;
    status: string;
    depositAmount: number;
    depositStatus: string;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    collateralText: string;
    hasPhysicalCollateral: boolean;
    daysOverdue: number;
    items: Array<{
      id: string;
      attireName: string;
      attireCode: string;
      rackHangerCode?: string;
      color?: string;
      size?: string;
      price: number;
    }>;
  }>;
  unpaidOrders?: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    depositAmount: number;
    eventDate: string;
    returnDeadline: string;
    status: string;
    paymentStatus: string;
  }>;
  periodOrders?: any[];
}

const STATUS_LABEL: Record<string, string> = {
  BOOKED   : 'Terjadwal',
  FITTING  : 'Fitting & Permak',
  PICKED_UP: 'Dibawa Klien',
  RETURNED : 'Menunggu QC',
  QC_CHECK : 'QC Check',
  LAUNDRY  : 'Cuci & Uap',
  COMPLETED: 'Selesai',
  CANCELLED: 'Batal',
};

const STATUS_COLOR: Record<string, string> = {
  BOOKED   : 'bg-blue-100 text-blue-800',
  FITTING  : 'bg-purple-100 text-purple-800',
  PICKED_UP: 'bg-indigo-100 text-indigo-800',
  RETURNED : 'bg-violet-100 text-violet-800',
  QC_CHECK : 'bg-yellow-100 text-yellow-700',
  LAUNDRY  : 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
};

const STATUS_BAR: Record<string, string> = {
  BOOKED   : 'bg-blue-500',
  FITTING  : 'bg-purple-500',
  PICKED_UP: 'bg-indigo-500',
  RETURNED : 'bg-violet-500',
  QC_CHECK : 'bg-yellow-400',
  LAUNDRY  : 'bg-cyan-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-rose-400',
};

const PIPELINE_ORDER = ['BOOKED','FITTING','PICKED_UP','RETURNED','QC_CHECK','LAUNDRY','COMPLETED','CANCELLED'];

export const RentalReports: React.FC = () => {
  const { token, settings, user } = usePOS();

  const [loading, setLoading]         = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData]               = useState<AnalyticsData | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('month');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [activeTab, setActiveTab]     = useState<ActiveTab>('overview');
  const [searchOverdue, setSearchOverdue] = useState('');
  const [searchCustody, setSearchCustody] = useState('');
  const [searchUnpaid, setSearchUnpaid]   = useState('');
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [selectedReminderOrder, setSelectedReminderOrder] = useState<RentalOrderReminderTarget | null>(null);

  const fmt = (v: number | null | undefined) =>
    `Rp ${(v || 0).toLocaleString('id-ID')}`;

  const fmtDate = (s: string) => {
    if (!s) return '-';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleOpenReminder = (o: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string;
    returnDeadline: string;
    totalAmount: number;
    depositAmount: number;
    pickupDate?: string;
    status?: string;
  }) => {
    setSelectedReminderOrder({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      returnDeadline: o.returnDeadline,
      pickupDate: o.pickupDate || new Date().toISOString(),
      status: (o.status as any) || 'PICKED_UP',
      totalAmount: o.totalAmount,
      depositAmount: o.depositAmount
    });
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/rental/reports/analytics?period=${quickFilter}`;
      if (quickFilter === 'custom' && startDate) {
        url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Gagal memuat data laporan');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast(e.message || 'Gagal memuat laporan rental', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, quickFilter, startDate, endDate]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Export Handlers
  const handleExportFinancialPDF = async () => {
    if (!data) return;
    try {
      setIsExporting(true);
      await generateRentalFinancialPDF(data, settings || {}, user?.name || user?.username);
      toast('Laporan Rekapitulasi Keuangan (PDF) berhasil diunduh.', 'success');
    } catch (e: any) {
      toast('Gagal mengunduh Laporan Keuangan PDF: ' + e.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCustodyPDF = async () => {
    if (!data) return;
    try {
      setIsExporting(true);
      await generateRentalCustodyWorksheetPDF(data, settings || {}, user?.name || user?.username);
      toast('Lembar Kerja Audit Busana & Jaminan (PDF) berhasil diunduh.', 'success');
    } catch (e: any) {
      toast('Gagal mengunduh Lembar Kerja Audit PDF: ' + e.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredOverdue = (data?.overdueReturns || []).filter(o => {
    if (!searchOverdue) return true;
    const q = searchOverdue.toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
  });

  const filteredCustody = (data?.activeCustodyOrders || []).filter(o => {
    if (!searchCustody) return true;
    const q = searchCustody.toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      o.items.some(it => it.attireName.toLowerCase().includes(q) || (it.rackHangerCode && it.rackHangerCode.toLowerCase().includes(q)));
  });

  const filteredUnpaid = (data?.unpaidOrders || []).filter(o => {
    if (!searchUnpaid) return true;
    const q = searchUnpaid.toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
  });

  const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
    { key: 'today',      label: 'Hari Ini' },
    { key: 'week',       label: 'Minggu Ini' },
    { key: 'month',      label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'custom',     label: 'Custom' },
  ];

  const TABS: { key: ActiveTab; label: string; mobileLabel: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'overview',  label: 'Ringkasan Keuangan',    mobileLabel: 'Ringkasan',        icon: <BarChart3 size={14} /> },
    { key: 'custody',   label: 'Lembar Audit & Jaminan', mobileLabel: 'Audit & Jaminan',  icon: <ShieldCheck size={14} />, count: data?.activeCustodyOrders?.length },
    { key: 'unpaid',    label: 'Buku Piutang Sewa',     mobileLabel: 'Piutang Sewa',     icon: <CreditCard size={14} />, count: data?.unpaidOrders?.length },
    { key: 'overdue',   label: 'Terlambat Kembali',      mobileLabel: 'Terlambat',        icon: <AlertTriangle size={14} />, count: data?.overdueReturns?.length },
    { key: 'busana',    label: 'Top Busana',            mobileLabel: 'Top Busana',       icon: <Shirt size={14} /> },
    { key: 'customers', label: 'Pelanggan & MUA',        mobileLabel: 'Pelanggan',        icon: <Users size={14} /> },
  ];

  const s = data?.summary;
  const maxPipeline = Math.max(...PIPELINE_ORDER.map(st => data?.pipeline?.[st]?.count || 0), 1);

  return (
    <div className="flex-1 bg-slate-100 min-h-full pb-16">

      {/* ─── STICKY HEADER DENGAN TEMA ROYAL INDIGO ──────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            
            {/* Title & Store Info */}
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                <BarChart3 size={22} />
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Laporan &amp; Analitik Rental
                  <span className="px-2.5 py-0.5 text-[11px] font-black rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                    Sewa Busana
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  {data && `${fmtDate(data.period.startDate)} \u2013 ${fmtDate(data.period.endDate)}`} • {settings?.storeName || 'Sanggar Busana'}
                </p>
              </div>
            </div>

            {/* Quick Actions & Date Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
              
              {/* PDF EXPORT BUTTONS (Cetak Rekap & Lembar Audit) */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExportFinancialPDF}
                  disabled={isExporting || !data}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-gradient-to-r from-indigo-700 to-indigo-800 hover:from-indigo-800 hover:to-indigo-900 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                  title="Cetak Laporan Rekapitulasi Pendapatan & Kasir A4 Berkop Surat"
                >
                  {isExporting ? <RefreshCw size={14} className="animate-spin text-white/80" /> : <Printer size={14} />}
                  <span className="hidden sm:inline">Cetak Rekap (PDF)</span>
                  <span className="sm:hidden">Rekap PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCustodyPDF}
                  disabled={isExporting || !data}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                  title="Cetak Lembar Kerja Audit Busana & Jaminan Kasir A4"
                >
                  {isExporting ? <RefreshCw size={14} className="animate-spin text-white/80" /> : <FileText size={14} />}
                  <span className="hidden sm:inline">Lembar Audit (PDF)</span>
                  <span className="sm:hidden">Audit PDF</span>
                </button>
              </div>

              {/* Controls: Date Presets, Reminder Modal, Refresh */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
                {/* Period Presets */}
                <div 
                  className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar scrollbar-none max-w-full"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {QUICK_FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setQuickFilter(f.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                        quickFilter === f.key
                          ? 'bg-indigo-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* WA Reminder & Refresh */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setCronModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-2xs transition-all cursor-pointer shrink-0"
                    title="Pengaturan Pengingat Otomatis WhatsApp"
                  >
                    <BellRing size={13} />
                    <span className="hidden sm:inline">Pengingat WA</span>
                  </button>

                  <button
                    onClick={fetchAnalytics}
                    disabled={loading}
                    className="p-1.5 sm:p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Perbarui Data"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Date Selector */}
          {quickFilter === 'custom' && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
              <span className="text-xs font-bold text-slate-600">Rentang Tanggal:</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
              />
              <span className="text-xs text-slate-400 font-bold">s/d</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
              />
              <button 
                onClick={fetchAnalytics}
                className="px-3.5 py-1 bg-indigo-700 text-white rounded-xl text-xs font-bold hover:bg-indigo-800 transition-all cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          )}

          {/* ─── TABS NAVIGATION ───────────────────────────────────────────── */}
          <div 
            className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar scrollbar-none pt-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {TABS.map(t => {
              const isSelected = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                    isSelected
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.mobileLabel}</span>
                  {typeof t.count === 'number' && t.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-white/20 text-white font-black' : 'bg-slate-100 text-slate-700 font-bold'
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── LOADING STATE ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-700 rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500">Menghitung analitik sewa sanggar...</span>
        </div>
      )}

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────────── */}
      {!loading && data && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ===== 1. TAB OVERVIEW (RINGKASAN FINANSIAL & OPERASIONAL) ===== */}
          {activeTab === 'overview' && (
            <>
              {/* Row 1: Finansial Utama (SOP Sanggar) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Total Penerimaan / Omzet Kas Masuk */}
                <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/70 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-2xs">
                      <DollarSign size={17} />
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Kas Masuk Bruto</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Penerimaan Kas</p>
                    <p className="text-lg sm:text-xl font-black text-indigo-950 leading-tight">
                      {fmt(s?.totalGrossRevenue || ((s?.totalPaid || 0) + (s?.totalDeposit || 0) + (s?.totalPenalty || 0)))}
                    </p>
                    <p className="text-[10px] text-indigo-700 font-medium mt-0.5">
                      Sewa + Deposit uang masuk ke laci
                    </p>
                  </div>
                </div>

                {/* 2. Deposit Dikembalikan (Refund) */}
                <div className="rounded-2xl border border-cyan-200/90 bg-cyan-50/70 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-cyan-600 text-white shadow-2xs">
                      <CheckCircle2 size={17} />
                    </span>
                    <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Refund Jaminan</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Deposit Dikembalikan</p>
                    <p className="text-lg sm:text-xl font-black text-cyan-950 leading-tight">
                      {fmt(s?.totalDepositRefunded)}
                    </p>
                    <p className="text-[10px] text-cyan-700 font-medium mt-0.5">
                      Uang jaminan dikembalikan ke penyewa
                    </p>
                  </div>
                </div>

                {/* 3. Net Pendapatan Sewa Riil */}
                <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs">
                      <TrendingUp size={17} />
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Nilai Kontrak</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Nilai Kontrak + Denda</p>
                    <p className="text-lg sm:text-xl font-black text-emerald-950 leading-tight">
                      {fmt(s?.netIncome)}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                      Kas nyata masuk: <strong>{fmt(s?.totalPaid)}</strong>
                    </p>
                  </div>
                </div>

                {/* 4. Sisa Piutang Sewa (Klik untuk filter ke Tab Unpaid) */}
                <button
                  type="button"
                  onClick={() => setActiveTab('unpaid')}
                  className="rounded-2xl border border-rose-200/90 bg-rose-50/70 p-4 shadow-2xs flex flex-col justify-between text-left hover:bg-rose-100/70 transition-all cursor-pointer"
                  title="Klik untuk melihat daftar klien yang belum lunas"
                >
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-rose-600 text-white shadow-2xs">
                      <CreditCard size={17} />
                    </span>
                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                      <span>Lihat Rincian</span>
                      <span>➔</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Piutang Belum Lunas</p>
                    <p className="text-lg sm:text-xl font-black text-rose-700 leading-tight">
                      {fmt(s?.unpaidBalance)}
                    </p>
                    <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                      {s?.unpaidOrdersCount || 0} kontrak sewa belum lunas
                    </p>
                  </div>
                </button>
              </div>

              {/* Row 2: Pengawasan Jaminan & Operasional Lapangan */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Jaminan Fisik (KTP/SIM) Kasir */}
                <button
                  type="button"
                  onClick={() => setActiveTab('custody')}
                  className="rounded-2xl border border-blue-200/90 bg-blue-50/70 p-4 shadow-2xs flex flex-col justify-between text-left hover:bg-blue-100/70 transition-all cursor-pointer"
                  title="Klik untuk membuka Lembar Kerja Audit Jaminan Fisik"
                >
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                      <ShieldCheck size={17} />
                    </span>
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1">
                      <span>Cek Lembar Audit</span>
                      <span>➔</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Jaminan Fisik Kasir</p>
                    <p className="text-lg sm:text-xl font-black text-blue-950 leading-tight">
                      {s?.activeCollateralCount || 0} Dokumen Fisik
                    </p>
                    <p className="text-[10px] text-blue-700 font-medium mt-0.5">
                      KTP/SIM asli tersimpan di kasir
                    </p>
                  </div>
                </button>

                {/* 2. Uang Deposit Tertahan */}
                <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-amber-600 text-white shadow-2xs">
                      <Coins size={17} />
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Deposit Aktif</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Deposit Uang Tertahan</p>
                    <p className="text-lg sm:text-xl font-black text-amber-950 leading-tight">
                      {fmt(s?.depositHeld)}
                    </p>
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                      Uang titipan jaminan busana aktif
                    </p>
                  </div>
                </div>

                {/* 3. Denda & Sanksi */}
                <div className="rounded-2xl border border-orange-200/90 bg-orange-50/70 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-orange-600 text-white shadow-2xs">
                      <Clock size={17} />
                    </span>
                    <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Denda &amp; Sanksi</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Denda Telat / Rusak</p>
                    <p className="text-lg sm:text-xl font-black text-orange-950 leading-tight">
                      {fmt(s?.totalPenalty)}
                    </p>
                    <p className="text-[10px] text-orange-700 font-medium mt-0.5">
                      Telat: {fmt(s?.totalLateFee)} • Rusak: {fmt(s?.totalDamageFee)}
                    </p>
                  </div>
                </div>

                {/* 4. Statistik Siklus Sewa */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-slate-800 text-white shadow-2xs">
                      <Layers size={17} />
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Siklus Kontrak</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Statistik Pesanan</p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                      {s?.totalOrders || 0} Booking
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {s?.activeOrders || 0} Aktif • {s?.completedOrders || 0} Selesai • {s?.cancelledOrders || 0} Batal
                    </p>
                  </div>
                </div>
              </div>

              {/* Pipeline Bar Chart */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Layers size={16} className="text-indigo-600" />
                  Alur Siklus Busana Sanggar (All-Time Pipeline)
                </h3>
                <div className="space-y-2.5">
                  {PIPELINE_ORDER.filter(st => (data.pipeline?.[st]?.count || 0) > 0).map(st => {
                    const row = data.pipeline[st] || { count: 0, revenue: 0 };
                    const pct = Math.round((row.count / maxPipeline) * 100);
                    return (
                      <div key={st} className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg w-28 text-center shrink-0 border ${STATUS_COLOR[st] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABEL[st] || st}
                        </span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-2.5 rounded-full transition-all duration-500 ${STATUS_BAR[st] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-700 w-8 text-right">{row.count}</span>
                        <span className="text-xs font-semibold text-slate-500 w-28 text-right hidden sm:block">{fmt(row.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Trend + Payment Methods */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Daily Trend */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-600" />
                    Tren Penerimaan Harian (14 Hari Terakhir)
                  </h3>
                  {data.dailyTrend.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Belum ada data pada periode ini</p>
                  ) : (
                    <div className="space-y-2">
                      {data.dailyTrend.slice(-14).map(d => {
                        const maxRev = Math.max(...data.dailyTrend.map(x => x.revenue), 1);
                        return (
                          <div key={d.date} className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500 font-medium w-24 shrink-0">{fmtDate(d.date)}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${Math.round((d.revenue / maxRev) * 100)}%` }} 
                              />
                            </div>
                            <span className="text-slate-700 font-bold w-24 text-right">{fmt(d.revenue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
                  <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-indigo-600" />
                    Metode Pembayaran (Saluran Kasir)
                  </h3>
                  {data.paymentMethods.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Belum ada transaksi</p>
                  ) : (
                    <div className="space-y-3">
                      {data.paymentMethods.map((pm, i) => {
                        const totalPm = data.paymentMethods.reduce((acc, x) => acc + x.amount, 0);
                        const pct = totalPm > 0 ? Math.round((pm.amount / totalPm) * 100) : 0;
                        const colors = ['bg-indigo-600','bg-amber-500','bg-emerald-500','bg-cyan-500','bg-rose-500'];
                        return (
                          <div key={pm.method}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-slate-800">{pm.method === 'CASH' ? 'Tunai (Cash Laci)' : pm.method === 'TRANSFER' ? 'Transfer Bank' : pm.method === 'QRIS' ? 'QRIS Online' : pm.method}</span>
                              <span className="text-slate-500 font-medium">{pm.count}x &middot; {fmt(pm.amount)} ({pct}%)</span>
                            </div>
                            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className={`h-2 rounded-full ${colors[i % colors.length]} transition-all duration-300`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-indigo-600" />
                      Status Jaminan Uang Deposit (All-Time)
                    </h4>
                    <div className="space-y-1.5">
                      {data.depositBreakdown.map(d => (
                        <div key={d.status} className="flex justify-between items-center text-xs">
                          <span className="text-slate-600 font-medium">Status: {d.status}</span>
                          <div className="text-right">
                            <span className="text-slate-800 font-bold">{d.count}x</span>
                            <span className="text-slate-500 ml-2 font-mono">{fmt(d.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== 2. TAB LEMBAR AUDIT OPERASIONAL & JAMINAN FISIK ===== */}
          {activeTab === 'custody' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-amber-600" />
                    Lembar Kerja Audit Busana &amp; Pengawasan Jaminan Fisik
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Daftar seluruh pakaian adat yang sedang berada di luar sanggar, kode gantungan hanger, dan dokumen identitas fisik (KTP/SIM) di laci kasir.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCustodyPDF}
                    disabled={isExporting || !data}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Cetak Lembar Kerja Audit Busana & Jaminan Kasir A4"
                  >
                    {isExporting ? <RefreshCw size={13} className="animate-spin text-white/80" /> : <FileText size={13} />}
                    <span className="hidden sm:inline">Cetak Lembar Kerja (PDF)</span>
                    <span className="sm:hidden">Cetak Audit (PDF)</span>
                  </button>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari nota, klien, baju, hanger..." 
                      value={searchCustody}
                      onChange={e => setSearchCustody(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium" 
                    />
                  </div>
                </div>
              </div>

              {filteredCustody.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800">Semua Busana Berada di Sanggar!</p>
                  <p className="text-xs text-slate-400">Tidak ada pesanan aktif atau dokumen jaminan yang tertahan saat ini.</p>
                </div>
              ) : (
                <>
                  {/* ── DESKTOP TABLE VIEW (hidden md:block) ── */}
                  <div className="hidden md:block overflow-x-auto no-scrollbar scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-3.5 whitespace-nowrap">Nota &amp; Status</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Klien &amp; No. WhatsApp</th>
                          <th className="py-3 px-3.5 min-w-[220px]">Busana &amp; Kode Hanger</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Batas Waktu Kembali</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Titipan Jaminan</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-center">Status Audit Fisik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCustody.map(o => {
                          const returnDateStr = o.returnDeadline 
                            ? new Date(o.returnDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + new Date(o.returnDeadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                            : '-';

                          const isOverdue = o.daysOverdue > 0;

                          return (
                            <tr key={o.id} className={`hover:bg-slate-50/80 transition-colors ${isOverdue ? 'bg-rose-50/30' : ''}`}>
                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                  #{o.orderNumber}
                                </span>
                                <div className="mt-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${STATUS_COLOR[o.status] || 'bg-slate-100 text-slate-600'}`}>
                                    {STATUS_LABEL[o.status] || o.status}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3.5 align-top">
                                <div className="font-bold text-slate-900 text-xs">{o.customerName}</div>
                                {o.customerPhone ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReminder(o)}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 mt-1 transition-colors cursor-pointer"
                                  >
                                    <MessageSquare size={10} />
                                    <span>{o.customerPhone}</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">-</span>
                                )}
                              </td>

                              <td className="py-3 px-3.5 align-top">
                                <div className="space-y-1">
                                  {o.items.map((it, idx) => (
                                    <div key={it.id || idx} className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-slate-800 text-[11px]">• {it.attireName}</span>
                                      <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70 shrink-0">
                                        🏷️ {it.rackHangerCode || it.attireCode}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <div className="text-xs font-bold text-slate-800">{returnDateStr}</div>
                                {isOverdue ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.2 rounded border border-rose-200 mt-1">
                                    <AlertTriangle size={10} /> Telat {o.daysOverdue} Hari
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded mt-1">
                                    <Clock size={10} /> Dalam Batas Sewa
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 inline-flex items-center gap-1">
                                    <ShieldCheck size={12} className="text-blue-600" />
                                    <span>{o.collateralText || (o.depositAmount > 0 ? '🔒 Ada Jaminan' : '⚠️ Tanpa Jaminan')}</span>
                                  </div>
                                  {o.depositAmount > 0 && (
                                    <div className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                      <Coins size={10} className="text-amber-600" />
                                      <span>Dep: {fmt(o.depositAmount)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 align-top whitespace-nowrap text-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                  <CheckSquare size={11} className="text-slate-400" />
                                  <span>Checklist Lapangan</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── MOBILE VIEW: ANDROID NATIVE CARD LIST (md:hidden) ── */}
                  <div className="md:hidden p-3 space-y-3">
                    {filteredCustody.map(o => {
                      const returnDateStr = o.returnDeadline 
                        ? new Date(o.returnDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + new Date(o.returnDeadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : '-';
                      const isOverdue = o.daysOverdue > 0;

                      return (
                        <div 
                          key={o.id} 
                          className={`bg-white rounded-2xl border p-3.5 shadow-2xs space-y-2.5 transition-all ${
                            isOverdue ? 'border-rose-200/90 bg-rose-50/20' : 'border-slate-200/90'
                          }`}
                        >
                          {/* Header: Nota & Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                #{o.orderNumber}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${STATUS_COLOR[o.status] || 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_LABEL[o.status] || o.status}
                              </span>
                            </div>
                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shrink-0">
                                <AlertTriangle size={10} /> Telat {o.daysOverdue} H
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                <Clock size={10} /> {returnDateStr}
                              </span>
                            )}
                          </div>

                          {/* Customer & Phone */}
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-black text-slate-900">{o.customerName}</div>
                              {o.customerPhone ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReminder(o)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 mt-1 transition-colors cursor-pointer"
                                >
                                  <MessageSquare size={11} />
                                  <span>{o.customerPhone}</span>
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">Tanpa nomor WhatsApp</span>
                              )}
                            </div>
                          </div>

                          {/* Attires & Hanger Rack List */}
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Busana &amp; Posisi Hanger</div>
                            <div className="space-y-1.5">
                              {o.items.map((it, idx) => (
                                <div key={it.id || idx} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-slate-800 truncate">• {it.attireName}</span>
                                  <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                                    🏷️ {it.rackHangerCode || it.attireCode}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Jaminan & Deposit Footer */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 inline-flex items-center gap-1">
                                <ShieldCheck size={12} className="text-blue-600" />
                                <span>{o.collateralText || 'KTP'}</span>
                              </div>
                              {o.depositAmount > 0 && (
                                <div className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 inline-flex items-center gap-1">
                                  <Coins size={11} className="text-amber-600" />
                                  <span>Dep: {fmt(o.depositAmount)}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              Laci Kasir ✓
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== 3. TAB BUKU PIUTANG SEWA (UNPAID ORDERS) ===== */}
          {activeTab === 'unpaid' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-rose-50/50">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <CreditCard size={18} className="text-rose-600" />
                    Buku Piutang Sewa (Kontrak Belum Lunas)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Daftar klien yang masih memiliki sisa tagihan pembayaran sewa. Tagihkan pelunasan saat busana dikembalikan ke sanggar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari nota, klien..." 
                      value={searchUnpaid}
                      onChange={e => setSearchUnpaid(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-medium" 
                    />
                  </div>
                </div>
              </div>

              {filteredUnpaid.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800">Semua Tagihan Sewa Lunas!</p>
                  <p className="text-xs text-slate-400">Tidak ada sisa piutang sewa yang tertahan pada periode ini.</p>
                </div>
              ) : (
                <>
                  {/* ── DESKTOP TABLE VIEW (hidden md:block) ── */}
                  <div className="hidden md:block overflow-x-auto no-scrollbar scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-3.5 whitespace-nowrap">No. Nota</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Klien &amp; No. WhatsApp</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Jadwal Acara &amp; Kembali</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Total Biaya</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Sudah Terbayar</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Sisa Piutang</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right">Aksi Tagih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUnpaid.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 align-top whitespace-nowrap">
                              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                #{o.orderNumber}
                              </span>
                              <div className="mt-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${STATUS_COLOR[o.status] || 'bg-slate-100 text-slate-600'}`}>
                                  {STATUS_LABEL[o.status] || o.status}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3.5 align-top">
                              <div className="font-bold text-slate-900 text-xs">{o.customerName}</div>
                              {o.customerPhone ? (
                                <div className="text-[10px] text-slate-500 mt-0.5">{o.customerPhone}</div>
                              ) : (
                                <span className="text-[10px] text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3.5 align-top whitespace-nowrap">
                              <div className="text-[11px] text-slate-600 font-medium">Acara: {fmtDate(o.eventDate)}</div>
                              <div className="text-[11px] text-slate-600 font-medium mt-0.5">Kembali: {fmtDate(o.returnDeadline)}</div>
                            </td>

                            <td className="py-3 px-3.5 align-top whitespace-nowrap font-bold text-slate-800">
                              {fmt(o.totalAmount)}
                            </td>

                            <td className="py-3 px-3.5 align-top whitespace-nowrap font-bold text-emerald-700">
                              {fmt(o.paidAmount)}
                            </td>

                            <td className="py-3 px-3.5 align-top whitespace-nowrap font-black text-rose-700">
                              {fmt(o.unpaidAmount)}
                            </td>

                            <td className="py-3 px-3.5 align-top whitespace-nowrap text-right">
                              {o.customerPhone && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReminder(o)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                >
                                  <MessageSquare size={12} />
                                  <span>Tagih WA</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ── MOBILE VIEW: ANDROID NATIVE CARD LIST (md:hidden) ── */}
                  <div className="md:hidden p-3 space-y-3">
                    {filteredUnpaid.map(o => (
                      <div key={o.id} className="bg-white rounded-2xl border border-rose-200/90 p-3.5 shadow-2xs space-y-2.5">
                        {/* Header: Nota, Status, & Tanggal Kembali */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              #{o.orderNumber}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${STATUS_COLOR[o.status] || 'bg-slate-100 text-slate-600'}`}>
                              {STATUS_LABEL[o.status] || o.status}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">
                            Kembali: {fmtDate(o.returnDeadline)}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-black text-slate-900">{o.customerName}</div>
                            <div className="text-xs text-slate-500 font-medium">{o.customerPhone || 'Tanpa no HP'}</div>
                          </div>
                          <div className="text-[11px] text-slate-500 text-right">
                            <span>Acara: </span>
                            <span className="font-bold text-slate-700">{fmtDate(o.eventDate)}</span>
                          </div>
                        </div>

                        {/* Financial Matrix (Android style tile) */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Total Biaya</div>
                            <div className="text-xs font-bold text-slate-800">{fmt(o.totalAmount)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Terbayar</div>
                            <div className="text-xs font-bold text-emerald-700">{fmt(o.paidAmount)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black text-rose-600 uppercase">Sisa Piutang</div>
                            <div className="text-xs font-black text-rose-700">{fmt(o.unpaidAmount)}</div>
                          </div>
                        </div>

                        {/* Action Button: Android style wide button */}
                        {o.customerPhone ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReminder(o)}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <MessageSquare size={14} />
                            <span>Tagih Sisa Piutang via WhatsApp</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                          >
                            <span>Tidak ada No. WhatsApp</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== 4. TAB OVERDUE (BUSANA TERLAMBAT) ===== */}
          {activeTab === 'overdue' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-rose-50/50">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-600" />
                    Busana Terlambat Dikembalikan
                    {data.overdueReturns.length > 0 && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full border border-rose-200">
                        {data.overdueReturns.length} Klien
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Status Dibawa Klien melewati batas waktu pengembalian yang disepakati</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCronModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    <BellRing size={13} />
                    <span>Auto-Reminder Semua</span>
                  </button>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari no. booking / nama..." 
                      value={searchOverdue}
                      onChange={e => setSearchOverdue(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-medium" 
                    />
                  </div>
                </div>
              </div>

              {filteredOverdue.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800">Tidak Ada Busana Terlambat!</p>
                  <p className="text-xs text-slate-400">Semua busana berada dalam rentang waktu sewa atau telah dikembalikan tepat waktu.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredOverdue.map(o => (
                    <div key={o.id} className="p-4 sm:p-5 hover:bg-rose-50/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              #{o.orderNumber}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${o.daysOverdue > 7 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                              🔴 Telat {o.daysOverdue} Hari
                            </span>
                          </div>
                          <p className="text-sm font-black text-slate-900">{o.customerName}</p>
                          {o.customerPhone && <p className="text-xs text-slate-500 mt-0.5">{o.customerPhone}</p>}
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 font-medium">
                            <Clock size={12} className="text-slate-400" />
                            Batas Kembali: <strong className="text-slate-800">{fmtDate(o.returnDeadline)}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">{fmt(o.totalAmount)}</p>
                            <p className="text-[10px] text-amber-800 font-bold">Deposit: {fmt(o.depositAmount)}</p>
                          </div>
                          {o.customerPhone && (
                            <button 
                              onClick={() => handleOpenReminder(o)} 
                              title="Kirim pengingat WhatsApp"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <MessageSquare size={13} />
                              <span>Chat WA</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== 5. TAB TOP BUSANA ===== */}
          {activeTab === 'busana' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200">
                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                  <Shirt size={18} className="text-indigo-600" />
                  Top 10 Busana Terlaris (Berdasarkan Kontribusi Omzet)
                </h3>
              </div>
              {data.topBusana.length === 0 ? (
                <div className="py-16 text-center">
                  <Package size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-500">Belum ada data persewaan busana</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.topBusana.map((b, i) => {
                    const maxRev = data.topBusana[0]?.revenue || 1;
                    return (
                      <div key={b.code} className="p-4 sm:px-5 hover:bg-indigo-50/40 transition-colors">
                        <div className="flex items-center gap-3.5">
                          <span className={`text-base font-black w-6 text-center ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                            #{i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <p className="text-sm font-bold text-slate-900 truncate">{b.name}</p>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Kode: <span className="font-mono font-bold text-slate-700">{b.code}</span>
                                  {b.color && <span className="ml-2 font-bold text-indigo-700">&middot; {b.color}</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <p className="text-sm font-black text-emerald-700">{fmt(b.revenue)}</p>
                                <p className="text-[10px] text-slate-500 font-semibold">{b.count}x Disewa</p>
                              </div>
                            </div>
                            <div className="bg-slate-100 rounded-full h-2 overflow-hidden mt-1">
                              <div 
                                className="h-2 rounded-full bg-indigo-600 transition-all duration-500" 
                                style={{ width: `${Math.round((b.revenue / maxRev) * 100)}%` }} 
                              />
                            </div>
                          </div>
                          {i < 3 && <Star size={16} className="text-amber-400 shrink-0" fill="currentColor" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== 6. TAB CUSTOMERS & MITRA MUA ===== */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200">
                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                  <Users size={18} className="text-indigo-600" />
                  Top Pelanggan &amp; Mitra MUA / Wedding Organizer
                </h3>
              </div>
              {data.topCustomers.length === 0 ? (
                <div className="py-16 text-center">
                  <Users size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-500">Belum ada data pelanggan</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.topCustomers.map((c, i) => {
                    const unpaid = c.revenue - c.paid;
                    return (
                      <div key={c.phone || c.name} className="p-4 sm:px-5 hover:bg-indigo-50/30 transition-colors">
                        <div className="flex items-center gap-3.5">
                          <span className={`text-base font-black w-6 text-center ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                            #{i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-slate-900">{c.name}</p>
                                {c.phone && <p className="text-xs text-slate-500 font-medium">{c.phone}</p>}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-emerald-700">{fmt(c.revenue)}</p>
                                <p className="text-[10px] text-slate-500 font-semibold">{c.count}x Transaksi</p>
                              </div>
                            </div>
                            {unpaid > 0 && (
                              <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} />
                                Piutang belum lunas: {fmt(unpaid)}
                              </p>
                            )}
                          </div>
                          {c.phone && (
                            <button
                              onClick={() => {
                                const clean = c.phone.replace(/[^0-9]/g, '');
                                const ph = clean.startsWith('0') ? '62' + clean.slice(1) : clean;
                                const store = settings?.storeName || 'Sanggar Kami';
                                const msg = `Halo Kak *${c.name}*! 👘\nTerima kasih sudah menjadi pelanggan setia *${store}*.\nAda acara adat/spesial berikutnya? Kami siap melayani koleksi terbaik Anda! 🌸`;
                                window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
                              }}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer border border-emerald-200 shrink-0"
                              title="Kirim WA ke pelanggan"
                            >
                              <MessageSquare size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ─── MODALS ───────────────────────────────────────────────────────── */}
      <RentalCronModal
        isOpen={cronModalOpen}
        onClose={() => setCronModalOpen(false)}
        onFinished={fetchAnalytics}
      />

      <RentalSendReminderModal
        isOpen={!!selectedReminderOrder}
        onClose={() => setSelectedReminderOrder(null)}
        order={selectedReminderOrder}
        onSuccess={fetchAnalytics}
      />

    </div>
  );
};

export default RentalReports;
