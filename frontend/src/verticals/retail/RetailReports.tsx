import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  TrendingUp,
  DollarSign,
  Truck,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  Layers,
  Coins,
  FileText,
  ShoppingBag,
  Wallet,
  ShieldCheck,
  BarChart3,
  Printer,
  Sparkles,
  Percent,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  User,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { POSContext } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { exportRetailReportPDF } from '../../utils/retailPdfGenerator';
import { exportRetailReportExcel } from '../../utils/retailExcelGenerator';
import { printRetailThermalSummary } from '../../utils/retailThermalReport';

type QuickFilterType = 'today' | 'yesterday' | 'week' | 'this_month' | 'last_month' | 'month_30' | 'custom';
type ActiveTabType = 'SUMMARY' | 'VELOCITY' | 'AR' | 'DELIVERIES' | 'PL' | 'SHIFT';

export const RetailReports: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;

  // ── Date Filter State ────────────────────────────────────────────────────────
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [activeTab, setActiveTab] = useState<ActiveTabType>('SUMMARY');
  const [chartViewMode, setChartViewMode] = useState<'all' | 'total' | 'umum' | 'mitra' | 'grosir'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [excelLoading, setExcelLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);

  // ── Date Preset Handler ──────────────────────────────────────────────────────
  const handleQuickFilter = useCallback((type: QuickFilterType) => {
    setQuickFilter(type);
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (type === 'today') {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      setStartDate(formatDate(w));
      setEndDate(formatDate(now));
    } else if (type === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    } else if (type === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
      setSelectedMonth(`${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}`);
    } else if (type === 'month_30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setStartDate(formatDate(d));
      setEndDate(formatDate(now));
    }
  }, []);

  const handleMonthPickerChange = (monthStr: string) => {
    if (!monthStr) return;
    setSelectedMonth(monthStr);
    setQuickFilter('custom');
    const [year, month] = monthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));
  };

  useEffect(() => {
    handleQuickFilter('this_month');
  }, [handleQuickFilter]);

  // ── Fetch Reports ────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    if (!token || !startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/retail/reports?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setReportData(await res.json());
      } else {
        toast('Gagal memuat data laporan retail.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi jaringan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    if (startDate && endDate) fetchReports();
  }, [fetchReports, startDate, endDate]);

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExportingPdf(true);
    try {
      await exportRetailReportPDF(
        posContext?.settings || { storeName: 'TOKO GROSIR & RETAIL' },
        reportData,
        startDate,
        endDate,
        (posContext?.user as any)?.name || posContext?.user?.username || 'Admin Toko'
      );
      toast('Dokumen PDF Laporan Retail berhasil diunduh!', 'success');
    } catch (e) {
      console.error(e);
      toast('Gagal mengekspor PDF laporan', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ── Excel Export ─────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!reportData) return;
    try {
      setExcelLoading(true);
      exportRetailReportExcel(
        reportData,
        posContext?.settings || { storeName: 'TOKO GROSIR & RETAIL' },
        startDate,
        endDate,
        (posContext?.user as any)?.name || posContext?.user?.username || 'Admin Toko'
      );
      toast('Workbook Excel (.xlsx) 5-Sheet berhasil diunduh!', 'success');
    } catch (e: any) {
      toast(e.message || 'Gagal mengekspor file Excel', 'error');
    } finally {
      setExcelLoading(false);
    }
  };

  // ── Thermal Slip ─────────────────────────────────────────────────────────────
  const handlePrintThermal = () => {
    if (!reportData) return;
    try {
      printRetailThermalSummary(
        reportData,
        posContext?.settings || { storeName: 'TOKO GROSIR & RETAIL' },
        startDate,
        endDate,
        (posContext?.user as any)?.name || posContext?.user?.username || 'Kasir Retail'
      );
      toast('Membuka dialog cetak struk thermal...', 'info');
    } catch (e: any) {
      toast(e.message || 'Gagal mencetak struk thermal', 'error');
    }
  };

  const formatCurrency = (val: number | undefined | null) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  // ── Data Extraction ──────────────────────────────────────────────────────────
  const summary = reportData?.summary || {};
  const tierSales = reportData?.tierSales || [];
  const velocity = reportData?.stockVelocity || { fastMoving: [], slowMoving: [] };
  const arAgeing = reportData?.arAgeing || { totalAR: 0, currentAR: 0, ageing30to60: 0, ageingOver60: 0, debts: [] };
  const deliverySummary = reportData?.deliverySummary || { total: 0, pending: 0, inTransit: 0, delivered: 0 };
  const dailyTrend = reportData?.dailyTrend || [];
  const shiftSummary = reportData?.shiftSummary || { totalShifts: 0, totalCashIn: 0, totalCashOut: 0, netCash: 0, shifts: [] };

  const totalSales = summary.totalSales || 0;
  const totalCost = summary.totalCost || 0;
  const grossProfit = summary.grossProfit || 0;
  const totalOpex = shiftSummary.totalCashOut || 0;
  const netProfit = grossProfit - totalOpex;
  const grossMarginPct = summary.marginPercentage || (totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0);
  const netMarginPct = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;
  const hppRatioPct = totalSales > 0 ? Math.round((totalCost / totalSales) * 100) : 0;

  // ── Tier Sales Breakdown Ratios ──────────────────────────────────────────────
  const umumTier = tierSales.find((t: any) => t.tier === 'UMUM') || { sales: 0, count: 0, cost: 0, profit: 0, margin: 0 };
  const mitraTier = tierSales.find((t: any) => t.tier === 'MITRA') || { sales: 0, count: 0, cost: 0, profit: 0, margin: 0 };
  const grosirTier = tierSales.find((t: any) => t.tier === 'GROSIR') || { sales: 0, count: 0, cost: 0, profit: 0, margin: 0 };

  const totalTierRevenue = (umumTier.sales || 0) + (mitraTier.sales || 0) + (grosirTier.sales || 0);
  const umumPct = totalTierRevenue > 0 ? Math.round(((umumTier.sales || 0) / totalTierRevenue) * 100) : 0;
  const mitraPct = totalTierRevenue > 0 ? Math.round(((mitraTier.sales || 0) / totalTierRevenue) * 100) : 0;
  const grosirPct = totalTierRevenue > 0 ? Math.max(0, 100 - umumPct - mitraPct) : 0;

  // ── Bento Tabs Config ────────────────────────────────────────────────────────
  const tabs = [
    { 
      id: 'SUMMARY', 
      title: 'Ringkasan & 3-Tier', 
      subtitle: 'Grafik & Level Harga', 
      icon: TrendingUp,
      badge: null
    },
    { 
      id: 'VELOCITY', 
      title: 'Fast & Slow Moving', 
      subtitle: 'Perputaran Stok Barang', 
      icon: Layers,
      badge: velocity.fastMoving?.length > 0 ? `${velocity.fastMoving.length} Produk` : null
    },
    { 
      id: 'AR', 
      title: 'Buku Piutang Bon', 
      subtitle: 'Penagihan Tempo AR', 
      icon: FileText,
      badge: arAgeing.debts?.length > 0 ? `${arAgeing.debts.length} Faktur` : null
    },
    { 
      id: 'DELIVERIES', 
      title: 'Armada & Surat Jalan', 
      subtitle: 'Pengiriman Logistik DO', 
      icon: Truck,
      badge: deliverySummary.total > 0 ? `${deliverySummary.total} DO` : null
    },
    { 
      id: 'PL', 
      title: 'Laba Rugi (P&L)', 
      subtitle: 'Finansial & OPEX Kas', 
      icon: Coins,
      badge: null
    },
    { 
      id: 'SHIFT', 
      title: 'Rekap Shift Kasir', 
      subtitle: 'Audit Kas Laci Kasir', 
      icon: Wallet,
      badge: shiftSummary.shifts?.length > 0 ? `${shiftSummary.shifts.length} Shift` : null
    },
  ];

  return (
    <div className="p-3 sm:p-6 pb-20 w-full flex flex-col gap-3.5 sm:gap-5 bg-slate-50 min-h-screen">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP BAR: STORE BRANDING, PRESET FILTER, & ACTION BUTTONS
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3.5 sm:p-5 flex flex-col gap-3.5 shadow-xs shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-wider">
                {posContext?.settings?.storeName || 'TOKO GROSIR & RETAIL'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                Laporan &amp; Evaluasi Toko Retail
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Omzet 3-tier (Ecer/Mitra/Grosir), piutang bon tempo AR, perputaran stok, armada DO, &amp; performa kasir.
            </p>
          </div>

          {/* Action Buttons Header */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf || loading || !reportData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-800 hover:to-purple-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50 shrink-0"
              title="Unduh Berkas PDF Resmi Berkepala Surat & Tanda Tangan"
            >
              {isExportingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={15} />}
              <span>Unduh PDF Resmi</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={excelLoading || loading || !reportData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 shrink-0"
              title="Download Workbook Excel (.xlsx) Multi-Sheet Lengkap"
            >
              {excelLoading ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrintThermal}
              disabled={loading || !reportData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs sm:text-sm shadow-xs active:scale-95 transition-all disabled:opacity-50 shrink-0"
              title="Cetak Ringkasan Shift Harian ke Printer Thermal 58/80mm"
            >
              <Printer size={14} className="text-slate-600" />
              <span>Struk Thermal</span>
            </button>

            <button
              onClick={fetchReports}
              title="Perbarui Data"
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'week', label: '7 Hari' },
              { id: 'this_month', label: 'Bulan Ini' },
              { id: 'last_month', label: 'Bulan Lalu' },
              { id: 'month_30', label: '30 Hari' },
              { id: 'custom', label: 'Kustom' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handleQuickFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  quickFilter === f.id
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date Picker Range & Month Selector */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto">
            {/* Quick Month Picker */}
            <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200/80 px-2.5 py-1.5 rounded-xl shrink-0" title="Pilih Bulan Spesifik">
              <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthPickerChange(e.target.value)}
                className="bg-transparent text-xs font-black text-indigo-950 outline-none cursor-pointer"
              />
            </div>

            {/* Custom Date Range */}
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickFilter('custom');
                }}
                className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <span className="text-xs text-slate-400 font-bold shrink-0">s/d</span>
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickFilter('custom');
                }}
                className="w-full border-none bg-transparent text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. BENTO GRID CARD NAVIGATION SELECTOR (SESUAI GAMBAR 2)
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTabType)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.65rem',
                padding: '.65rem .85rem',
                background: isSelected 
                  ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' 
                  : '#f8fafc',
                color: isSelected ? '#ffffff' : '#334155',
                border: isSelected ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                borderRadius: '.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
              }}
              className="active:scale-95 transition-all"
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '.65rem',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#e0e7ff',
                  color: isSelected ? '#ffffff' : '#4f46e5',
                  flexShrink: 0
                }}
              >
                <Icon size={17} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.25rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '.8rem', color: isSelected ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.title}
                  </span>
                  {tab.badge && (
                    <span 
                      style={{ 
                        fontSize: '.6rem', 
                        padding: '.1rem .35rem', 
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#e0e7ff', 
                        color: isSelected ? '#ffffff' : '#4f46e5', 
                        borderRadius: '9999px', 
                        fontWeight: 800,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '.68rem', fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.85)' : '#64748b', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tab.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: RINGKASAN & 3-TIERED PRICE
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'SUMMARY' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          
          {/* Top 4 KPI Metrics with Margins & HPP Ratio (Symmetric Grid) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            
            {/* Card 1: Total Omzet Penjualan */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Total Omzet</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <DollarSign size={16} />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                  {formatCurrency(totalSales)}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center justify-between">
                  <span>{summary.totalOrders || 0} Transaksi Kasir</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[9.5px]">100% Basis</span>
                </div>
              </div>
            </div>

            {/* Card 2: Laba Bersih Operasional */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider truncate">Laba Bersih Operasional</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-xl lg:text-2xl font-black text-emerald-600 tracking-tight leading-tight truncate">
                  {formatCurrency(netProfit)}
                </div>
                <div className="text-[10px] sm:text-xs text-emerald-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">Setelah OPEX Kas</span>
                  <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[9.5px]">Net Margin {netMarginPct}%</span>
                </div>
              </div>
            </div>

            {/* Card 3: Total HPP Modal Barang Terjual */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider truncate">Total Modal Beli (HPP)</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <ShoppingBag size={16} />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-xl lg:text-2xl font-black text-rose-600 tracking-tight leading-tight truncate">
                  {formatCurrency(totalCost)}
                </div>
                <div className="text-[10px] sm:text-xs text-rose-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">Modal Barang Terjual</span>
                  <span className="bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[9.5px]">Rasio HPP {hppRatioPct}%</span>
                </div>
              </div>
            </div>

            {/* Card 4: Laba Kotor (Gross Profit) */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Laba Kotor (Gross Profit)</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <Percent size={16} />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-xl lg:text-2xl font-black text-sky-600 tracking-tight leading-tight truncate">
                  {formatCurrency(grossProfit)}
                </div>
                <div className="text-[10px] sm:text-xs text-sky-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">Omzet - HPP Barang</span>
                  <span className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[9.5px]">Gross Margin {grossMarginPct}%</span>
                </div>
              </div>
            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION RATIO: ANALISIS OMZET & MARGIN 3-TIER PRICE
          ────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600" />
                  <h3 className="m-0 font-black text-base sm:text-lg text-slate-900">
                    Laporan Omzet &amp; Margin 3-Tier Price (Ecer vs Mitra vs Grosir)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Analisis perbandingan kontribusi omzet &amp; profitabilitas level harga pelanggan toko retail
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-extrabold">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  Eceran: {umumPct}%
                </span>
                <span className="flex items-center gap-1.5 text-purple-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  Mitra: {mitraPct}%
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Grosir: {grosirPct}%
                </span>
              </div>
            </div>

            {/* Visual Contribution Ratio Bar (3-Tier) */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div 
                style={{ width: `${umumPct}%` }} 
                className="bg-indigo-600 transition-all duration-500" 
                title={`Eceran: ${umumPct}%`}
              />
              <div 
                style={{ width: `${mitraPct}%` }} 
                className="bg-purple-600 transition-all duration-500" 
                title={`Mitra: ${mitraPct}%`}
              />
              <div 
                style={{ width: `${grosirPct}%` }} 
                className="bg-emerald-500 transition-all duration-500" 
                title={`Grosir: ${grosirPct}%`}
              />
            </div>

            {/* 3 Side-by-Side Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              
              {/* Eceran (Umum) Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      Eceran (Umum)
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{umumTier.count || 0} Transaksi</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                    {formatCurrency(umumTier.sales)}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-indigo-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimasi HPP</span>
                    <span className="font-extrabold text-slate-700">{formatCurrency(umumTier.cost)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-indigo-600 font-bold uppercase block">Laba ({umumTier.margin || 0}%)</span>
                    <span className="font-extrabold text-indigo-700">{formatCurrency(umumTier.profit)}</span>
                  </div>
                </div>
              </div>

              {/* Mitra (Warung) Card */}
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      Mitra / Warung Langganan
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{mitraTier.count || 0} Transaksi</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                    {formatCurrency(mitraTier.sales)}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-purple-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimasi HPP</span>
                    <span className="font-extrabold text-slate-700">{formatCurrency(mitraTier.cost)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-purple-600 font-bold uppercase block">Laba ({mitraTier.margin || 0}%)</span>
                    <span className="font-extrabold text-purple-700">{formatCurrency(mitraTier.profit)}</span>
                  </div>
                </div>
              </div>

              {/* Grosir (Partai) Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Grosir / Partai Besar
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{grosirTier.count || 0} Transaksi</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                    {formatCurrency(grosirTier.sales)}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimasi HPP</span>
                    <span className="font-extrabold text-slate-700">{formatCurrency(grosirTier.cost)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Laba ({grosirTier.margin || 0}%)</span>
                    <span className="font-extrabold text-emerald-800">{formatCurrency(grosirTier.profit)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Daily Trend Chart (AreaChart Bergradien Seperti Kafe) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 size={17} className="text-indigo-600" />
                  <span>Grafik Tren Penjualan Harian (Ecer vs Mitra vs Grosir)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisasi kurva omzet harian berdasarkan level harga pelanggan tokomu.
                </p>
              </div>

              {/* Chart View Selector Pills Seperti Kafe */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-start sm:self-auto overflow-x-auto max-w-full">
                {[
                  { id: 'all', label: '📊 Semua' },
                  { id: 'total', label: '📈 Total Omzet' },
                  { id: 'umum', label: '🛒 Eceran' },
                  { id: 'mitra', label: '🏪 Mitra Warung' },
                  { id: 'grosir', label: '📦 Grosir Partai' },
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => setChartViewMode(btn.id as any)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      chartViewMode === btn.id
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 h-64 sm:h-72">
              {dailyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                  Belum ada data transaksi kasir pada rentang periode ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRetailReportTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRetailReportUmum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRetailReportMitra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRetailReportGrosir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="dateFormatted" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : `${Math.round(v / 1000)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatCurrency(Number(val)), name]}
                      contentStyle={{
                        background: 'white',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                    {(chartViewMode === 'all' || chartViewMode === 'total') && (
                      <Area
                        type="monotone"
                        dataKey="totalSales"
                        name="Total Omzet"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRetailReportTotal)"
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {(chartViewMode === 'all' || chartViewMode === 'umum') && (
                      <Area
                        type="monotone"
                        dataKey="salesUmum"
                        name="Penjualan Eceran"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRetailReportUmum)"
                        activeDot={{ r: 5 }}
                      />
                    )}
                    {(chartViewMode === 'all' || chartViewMode === 'mitra') && (
                      <Area
                        type="monotone"
                        dataKey="salesMitra"
                        name="Penjualan Mitra"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRetailReportMitra)"
                        activeDot={{ r: 5 }}
                      />
                    )}
                    {(chartViewMode === 'all' || chartViewMode === 'grosir') && (
                      <Area
                        type="monotone"
                        dataKey="salesGrosir"
                        name="Penjualan Grosir"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRetailReportGrosir)"
                        activeDot={{ r: 5 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: FAST & SLOW MOVING STOCK
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'VELOCITY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
          {/* Fast Moving */}
          <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">Produk Terlaris (Fast Moving Stock)</h3>
                <p className="text-[11px] text-slate-500">10 Barang dengan perputaran penjualan tertinggi</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {(velocity.fastMoving || []).map((p: any, idx: number) => (
                <div key={p.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px] flex items-center justify-center">{idx + 1}</span>
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-[10px] text-slate-400">Terjual: {p.qtySold} unit</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">{formatCurrency(p.totalSales)}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">+{formatCurrency(p.totalSales - p.totalCost)} profit</span>
                  </div>
                </div>
              ))}
              {velocity.fastMoving?.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Belum ada data penjualan stok pada periode ini.</div>
              )}
            </div>
          </div>

          {/* Slow Moving */}
          <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertCircle size={18} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">Stok Lambat (Slow Moving / Dead Stock)</h3>
                <p className="text-[11px] text-slate-500">Produk dengan perputaran lambat di etalase/rak</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {(velocity.slowMoving || []).map((p: any, idx: number) => (
                <div key={p.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 font-bold text-[11px] flex items-center justify-center">{idx + 1}</span>
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-[10px] text-slate-400">Penjualan: {p.qtySold} unit</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-700 block">{formatCurrency(p.totalSales)}</span>
                    <span className="text-[10px] text-amber-600 font-bold">Perlu clearance promo</span>
                  </div>
                </div>
              ))}
              {velocity.slowMoving?.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Belum ada data slow moving pada periode ini.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: BUKU PIUTANG & BON TEMPO (AR AGEING)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'AR' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Lancar (≤ 30 Hari)</span>
              <span className="text-xl font-black text-emerald-600 block mt-1">{formatCurrency(arAgeing.currentAR)}</span>
              <div className="mt-2 h-1.5 rounded-full bg-emerald-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: arAgeing.totalAR > 0 ? `${Math.round((arAgeing.currentAR / arAgeing.totalAR) * 100)}%` : '0%' }} /></div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Perhatian (31–60 Hari)</span>
              <span className="text-xl font-black text-amber-600 block mt-1">{formatCurrency(arAgeing.ageing30to60)}</span>
              <div className="mt-2 h-1.5 rounded-full bg-amber-100 overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: arAgeing.totalAR > 0 ? `${Math.round((arAgeing.ageing30to60 / arAgeing.totalAR) * 100)}%` : '0%' }} /></div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Macet / Jatuh Tempo (&gt; 60 Hari)</span>
              <span className="text-xl font-black text-rose-600 block mt-1">{formatCurrency(arAgeing.ageingOver60)}</span>
              <div className="mt-2 h-1.5 rounded-full bg-rose-100 overflow-hidden"><div className="h-full bg-rose-500 rounded-full" style={{ width: arAgeing.totalAR > 0 ? `${Math.round((arAgeing.ageingOver60 / arAgeing.totalAR) * 100)}%` : '0%' }} /></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <h3 className="font-black text-sm text-slate-900">Rincian Buku Piutang Pelanggan &amp; Warung Langganan</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Total Piutang:</span>
                <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/60">
                  {formatCurrency(arAgeing.totalAR)}
                </span>
              </div>
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3.5">Nama Toko / Pelanggan</th>
                    <th className="p-3.5">No. HP</th>
                    <th className="p-3.5 text-right">Nilai Bon Awal</th>
                    <th className="p-3.5 text-right">Sisa Piutang</th>
                    <th className="p-3.5 text-center">Umur Bon</th>
                    <th className="p-3.5 text-center">Status Ageing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(arAgeing.debts || []).map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-slate-900">{d.customerName}</td>
                      <td className="p-3.5 text-slate-600">{d.customerPhone || '-'}</td>
                      <td className="p-3.5 text-right font-medium text-slate-600">{formatCurrency(d.amount)}</td>
                      <td className="p-3.5 text-right font-black text-slate-900">{formatCurrency(d.remaining)}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-700">{d.ageDays} Hari</td>
                      <td className="p-3.5 text-center">
                        {d.ageDays <= 30 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">Lancar</span>
                        ) : d.ageDays <= 60 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">Waspada</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">MACET</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {arAgeing.debts?.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">Tidak ada piutang bon tempo aktif pada periode ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {(arAgeing.debts || []).length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-100">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800">Semua Piutang Bersih (Nihil)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada piutang bon tempo aktif pada periode ini.</p>
                </div>
              ) : (
                (arAgeing.debts || []).map((d: any) => {
                  const isLancar = d.ageDays <= 30;
                  const isWaspada = d.ageDays > 30 && d.ageDays <= 60;
                  const isMacet = d.ageDays > 60;
                  
                  return (
                    <div key={d.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/80 transition-all">
                      {/* Top Header: Customer Name & Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 leading-tight truncate">
                            {d.customerName}
                          </h4>
                          {d.customerPhone ? (
                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone size={11} className="text-slate-400" />
                              {d.customerPhone}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Tanpa nomor kontak</span>
                          )}
                        </div>

                        {/* Ageing Badge */}
                        <div className="shrink-0">
                          {isLancar && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Lancar
                            </span>
                          )}
                          {isWaspada && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center gap-1">
                              <AlertCircle size={11} /> Waspada
                            </span>
                          )}
                          {isMacet && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1 animate-pulse">
                              <AlertCircle size={11} /> MACET
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial Detail Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Bon Awal</span>
                          <span className="text-xs font-bold text-slate-700 block mt-0.5">{formatCurrency(d.amount)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Sisa Tagihan</span>
                          <span className="text-xs font-black text-rose-600 block mt-0.5">{formatCurrency(d.remaining)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Umur Bon</span>
                          <span className="text-xs font-mono font-bold text-slate-800 flex items-center justify-center gap-0.5 mt-0.5">
                            <Clock size={11} className="text-slate-400" />
                            {d.ageDays} Hari
                          </span>
                        </div>
                      </div>

                      {/* Action Bar (WhatsApp Tagih) */}
                      {d.customerPhone && (
                        <div className="pt-0.5 flex justify-end">
                          <a
                            href={`https://wa.me/${d.customerPhone.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${d.customerName}, kami menginformasikan catatan sisa piutang bon belanja Anda sebesar ${formatCurrency(d.remaining)} (umur bon: ${d.ageDays} hari). Mohon konfirmasi jadwal pembayarannya. Terima kasih.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all"
                          >
                            <MessageSquare size={12} />
                            <span>Tagih via WhatsApp</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: ARMADA & SURAT JALAN (LOGISTICS)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'DELIVERIES' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {[
              { label: 'Total Surat Jalan (DO)', val: deliverySummary.total, cls: 'bg-white border-slate-200/80', vcls: 'text-slate-900' },
              { label: 'Menunggu Sopir', val: deliverySummary.pending, cls: 'bg-amber-50/60 border-amber-200', vcls: 'text-amber-800' },
              { label: 'Dalam Pengiriman', val: deliverySummary.inTransit, cls: 'bg-blue-50/60 border-blue-200', vcls: 'text-blue-800' },
              { label: 'Terkirim Selesai', val: deliverySummary.delivered, cls: 'bg-emerald-50/60 border-emerald-200', vcls: 'text-emerald-800' },
            ].map(b => (
              <div key={b.label} className={`p-4 rounded-2xl border ${b.cls} shadow-xs`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">{b.label}</span>
                <span className={`text-2xl font-black block mt-1 ${b.vcls}`}>{b.val} Surat</span>
              </div>
            ))}
          </div>

          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl sm:rounded-3xl flex items-start gap-3 text-xs text-indigo-900">
            <Truck size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Gunakan menu <strong>Surat Jalan (DO)</strong> di panel navigasi kasir untuk mencetak surat jalan berkop resmi, menugaskan sopir/armada pickup, serta memperbarui status pengiriman pelanggan grosir.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: LABA RUGI OPERASIONAL (P&L FORMAL)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'PL' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
          {/* P&L Table */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <FileText size={17} className="text-indigo-600" />
              <span>Laporan Laba Rugi Operasional Toko Retail (P&amp;L Formal)</span>
            </h3>
            <div className="overflow-hidden border border-slate-200/80 rounded-2xl sm:rounded-3xl bg-white shadow-xs">
              <table className="w-full text-xs text-left">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>I. PENDAPATAN USAHA (REVENUE)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-6 text-slate-600">Total Penjualan Kotor Toko (Omzet)</td>
                    <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatCurrency(totalSales)}</td>
                  </tr>

                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>II. HARGA POKOK PENJUALAN (HPP / COGS)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-6 text-slate-600">Modal Pembelian Barang Terjual (HPP)</td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600">- {formatCurrency(totalCost)}</td>
                  </tr>
                  <tr className="bg-emerald-50/40 font-bold text-emerald-950">
                    <td className="py-2.5 px-6">Laba Kotor Usaha (Gross Profit — {grossMarginPct}%)</td>
                    <td className="py-2.5 px-4 text-right text-emerald-700 font-black">{formatCurrency(grossProfit)}</td>
                  </tr>

                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>III. BEBAN KAS OPERASIONAL (OPEX)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-6 text-slate-600">Pengeluaran Kas Operasional Toko (Petty Cash Shift)</td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600">- {formatCurrency(totalOpex)}</td>
                  </tr>

                  <tr className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white font-black text-sm">
                    <td className="py-3.5 px-6">ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT — {netMarginPct}%)</td>
                    <td className="py-3.5 px-4 text-right">{formatCurrency(netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Margin Ratios Card */}
          <div className="space-y-4">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck size={17} className="text-indigo-600" />
              <span>Kesehatan Finansial &amp; Rasio</span>
            </h3>
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold">Gross Margin (Margin Kotor)</span>
                  <span className="font-black text-slate-900">{grossMarginPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, grossMarginPct))}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Efisiensi markup harga beli modal ke harga jual retail.</p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold">Net Margin (Margin Bersih)</span>
                  <span className="font-black text-indigo-700">{netMarginPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(100, Math.max(0, netMarginPct))}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Sisa keuntungan bersih setelah dikurangi pengeluaran operasional.</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold">Rata-rata Penjualan per Struk</span>
                <span className="font-black text-slate-900">
                  {summary.totalOrders > 0 ? formatCurrency(Math.round(totalSales / summary.totalOrders)) : 'Rp 0'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-900">
              <Printer size={18} className="text-indigo-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="block font-black text-slate-900 mb-0.5">Arsip Dokumen Resmi</strong>
                Gunakan tombol <strong>Unduh PDF Resmi</strong> di atas untuk menyimpan berkas laporan berkop surat resmi bertanda tangan.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: REKAP KAS SHIFT KASIR
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'SHIFT' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div>
            <h3 className="font-black text-sm text-slate-900">Rekonsiliasi Kas Laci &amp; Audit Shift Kasir Retail</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencatatan kas masuk dari penjualan kasir vs kas keluar operasional toko per sesi kerja kasir.
            </p>
          </div>

          {/* Shift Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs">
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Kas Masuk (Cash In)</div>
              <div className="text-xl font-black text-emerald-950 mt-1">{formatCurrency(shiftSummary.totalCashIn)}</div>
              <div className="text-[10px] text-emerald-600 mt-1 font-medium">Total penjualan tunai &amp; transfer kasir</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-rose-200/80 shadow-xs">
              <div className="text-[10px] font-bold text-rose-700 uppercase">Total Kas Keluar (OPEX)</div>
              <div className="text-xl font-black text-rose-950 mt-1">{formatCurrency(shiftSummary.totalCashOut)}</div>
              <div className="text-[10px] text-rose-600 mt-1 font-medium">Pengeluaran operasional kas laci toko</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-indigo-200/80 shadow-xs">
              <div className="text-[10px] font-bold text-indigo-700 uppercase">Net Cash Flow (Kas Bersih)</div>
              <div className="text-xl font-black text-indigo-950 mt-1">{formatCurrency(shiftSummary.netCash)}</div>
              <div className="text-[10px] text-indigo-600 mt-1 font-medium">Saldo kas surplus periode ini</div>
            </div>
          </div>

          {/* Shift Detail Container */}
          <div className="border border-slate-200/80 rounded-2xl sm:rounded-3xl bg-white shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <h4 className="font-black text-xs sm:text-sm text-slate-900">Rincian Riwayat Sesi Shift Kasir</h4>
              <span className="text-[11px] font-bold text-slate-500">
                {(shiftSummary.shifts || []).length} Sesi Tercatat
              </span>
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Kasir / Sesi</th>
                    <th className="py-3.5 px-4 text-center">Tanggal Shift</th>
                    <th className="py-3.5 px-4 text-right">Kas Awal</th>
                    <th className="py-3.5 px-4 text-right">Total Penjualan</th>
                    <th className="py-3.5 px-4 text-right">Kas Keluar</th>
                    <th className="py-3.5 px-4 text-right">Saldo Akhir</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(shiftSummary.shifts || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        Belum ada data shift kasir pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    (shiftSummary.shifts || []).map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.staffName || s.cashierName || 'Kasir'}</div>
                          <div className="text-[10px] text-slate-400">{s.shiftLabel || `Shift #${idx + 1}`}</div>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {s.date ? new Date(s.date).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(s.openingCash)}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(s.totalSales)}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">{formatCurrency(s.totalExpenses)}</td>
                        <td className="py-3 px-4 text-right font-black text-indigo-700">{formatCurrency(s.closingCash)}</td>
                        <td className="py-3 px-4 text-center">
                          {s.status === 'CLOSED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Ditutup</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Shift Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {(shiftSummary.shifts || []).length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 border border-indigo-100">
                    <Calendar size={24} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800">Belum Ada Riwayat Shift</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada rekonsiliasi kas laci kasir pada periode yang dipilih.</p>
                </div>
              ) : (
                (shiftSummary.shifts || []).map((s: any, idx: number) => {
                  const isClosed = s.status === 'CLOSED';
                  return (
                    <div key={idx} className="p-4 space-y-3 bg-white hover:bg-slate-50/70 transition-all">
                      {/* Header: Kasir name, Shift label, Date & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-black text-xs">
                            <User size={16} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-900 truncate leading-tight">
                              {s.staffName || s.cashierName || 'Kasir'}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                              <span className="font-semibold">{s.shiftLabel || `Shift #${idx + 1}`}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 font-mono">
                                <Clock size={10} className="text-slate-400" />
                                {s.date ? new Date(s.date).toLocaleDateString('id-ID') : '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isClosed ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Ditutup
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Aktif
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cash Breakdown Grid */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Kas Awal Laci</span>
                          <span className="font-bold text-slate-700">{formatCurrency(s.openingCash)}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block flex items-center gap-0.5 text-emerald-600">
                            <ArrowDownRight size={11} /> Total Penjualan
                          </span>
                          <span className="font-black text-emerald-700">{formatCurrency(s.totalSales)}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block flex items-center gap-0.5 text-rose-600">
                            <ArrowUpRight size={11} /> Kas Keluar (OPEX)
                          </span>
                          <span className="font-bold text-rose-600">{formatCurrency(s.totalExpenses)}</span>
                        </div>
                        <div className="space-y-0.5 bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100/60">
                          <span className="text-[9px] font-black uppercase text-indigo-700 block">Saldo Akhir Laci</span>
                          <span className="font-black text-indigo-900">{formatCurrency(s.closingCash)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetailReports;
