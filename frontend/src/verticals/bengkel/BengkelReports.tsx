import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Wrench, 
  Package, 
  Users, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Layers,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Clock,
  Download,
  Wallet,
  ArrowDownRight,
  ShieldCheck,
  Printer,
  FileSpreadsheet,
  ExternalLink,
  MessageSquare,
  CalendarClock,
  AlertCircle,
  Eye,
  X,
  ChevronRight,
  Car,
  History,
  Percent,
  Sparkles,
  ShoppingBag,
  Boxes,
  Receipt
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
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { exportBengkelReportPDF, exportMechanicSlipPDF } from '../../utils/bengkelPdfGenerator';
import { exportBengkelReportExcel } from '../../utils/bengkelExcelGenerator';
import { printBengkelThermalSummary } from '../../utils/bengkelThermalReport';

type QuickFilterType = 'today' | 'yesterday' | 'week' | 'this_month' | 'last_month' | 'month_30' | 'custom';
type ActiveTabType = 'dashboard' | 'mechanics' | 'services' | 'parts' | 'reminders' | 'accounting' | 'invoices';

export const BengkelReports: React.FC = () => {
  const pos = usePOS();
  const token = pos.token;
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [excelLoading, setExcelLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);

  // Filter state
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('this_month');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTabType>('dashboard');
  const [chartViewMode, setChartViewMode] = useState<'all' | 'total' | 'jasa' | 'parts' | 'spk'>('all');

  // Modal drill-down state
  const [selectedMechanicModal, setSelectedMechanicModal] = useState<any | null>(null);

  const formatCurrency = (val: number | undefined | null) => 
    `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const formatDateID = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Helper compute dates for presets
  const handleQuickFilter = useCallback((type: QuickFilterType) => {
    setQuickFilter(type);
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];

    if (type === 'today') {
      setStartDate(endStr);
      setEndDate(endStr);
    } else if (type === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(endStr);
    } else if (type === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(endStr);
      setSelectedMonth(start.slice(0, 7));
    } else if (type === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
      setSelectedMonth(start.slice(0, 7));
    } else if (type === 'month_30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(endStr);
    }
  }, []);

  const handleMonthPickerChange = (yearMonthStr: string) => {
    setSelectedMonth(yearMonthStr);
    setQuickFilter('custom');
    if (!yearMonthStr) return;
    const [year, month] = yearMonthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    handleQuickFilter('this_month');
  }, [handleQuickFilter]);

  const fetchReports = useCallback(async () => {
    if (!token || !startDate || !endDate) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/bengkel/reports/summary?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        toast('Gagal memuat data laporan bengkel', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReports();
    }
  }, [fetchReports, startDate, endDate]);

  const handleExportPDF = async () => {
    if (!reportData) return;
    try {
      setPdfLoading(true);
      await exportBengkelReportPDF(
        pos?.settings || {},
        reportData,
        startDate,
        endDate,
        pos?.user?.name || pos?.user?.username
      );
      toast('Laporan PDF resmi bengkel berhasil diunduh!', 'success');
    } catch (e: any) {
      toast(e.message || 'Gagal membuat dokumen PDF', 'error');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    try {
      setExcelLoading(true);
      exportBengkelReportExcel(
        reportData,
        pos?.settings || {},
        startDate,
        endDate,
        pos?.user?.name || pos?.user?.username
      );
      toast('Workbook Excel (.xlsx) 5-Sheet berhasil diunduh!', 'success');
    } catch (e: any) {
      toast(e.message || 'Gagal mengekspor file Excel', 'error');
    } finally {
      setExcelLoading(false);
    }
  };

  const handlePrintThermal = () => {
    if (!reportData) return;
    try {
      printBengkelThermalSummary(
        reportData,
        pos?.settings || {},
        startDate,
        endDate,
        pos?.user?.name || pos?.user?.username
      );
      toast('Membuka dialog cetak struk thermal...', 'info');
    } catch (e: any) {
      toast(e.message || 'Gagal mencetak struk thermal', 'error');
    }
  };

  const handleExportSlip = async (m: any) => {
    try {
      await exportMechanicSlipPDF(
        pos?.settings || {},
        m,
        `${formatDateID(startDate)} s/d ${formatDateID(endDate)}`,
        pos?.user?.name || pos?.user?.username
      );
      toast(`Slip komisi ${m.name} berhasil diunduh!`, 'success');
    } catch (e: any) {
      toast(e.message || 'Gagal mengunduh slip komisi', 'error');
    }
  };

  // Safe data extractions
  const summary = reportData?.summary || {};
  const dailyTrend = reportData?.dailyTrend || [];
  const cashflow = reportData?.cashflowSummary || {};
  const mechanicPerformance = reportData?.mechanicPerformance || [];
  const fastMovingParts = reportData?.fastMovingParts || [];
  const deadStockParts = reportData?.deadStockParts || [];
  const serviceCategories = reportData?.serviceCategories || [];
  const vehicleBreakdown = reportData?.vehicleBreakdown || [];
  const serviceDueReminders = reportData?.serviceDueReminders || [];
  const invoiceStats = reportData?.invoiceStats || {};

  const totalRev = summary.totalOmzetBersih || 0;
  const totalHpp = summary.hppParts || 0;
  const grossProf = summary.totalLabaKotor || 0;
  const netProf = summary.estimasiLabaBersih || 0;

  const grossMarginPct = totalRev > 0 ? Math.round((grossProf / totalRev) * 100) : 0;
  const netMarginPct = totalRev > 0 ? Math.round((netProf / totalRev) * 100) : 0;
  const hppRatioPct = totalRev > 0 ? Math.round((totalHpp / totalRev) * 100) : 0;

  const omzetJasa = summary.omzetJasa || 0;
  const omzetParts = summary.omzetParts || 0;
  const totalKategoriOmzet = omzetJasa + omzetParts;
  const jasaPct = totalKategoriOmzet > 0 ? Math.round((omzetJasa / totalKategoriOmzet) * 100) : 0;
  const partsPct = totalKategoriOmzet > 0 ? (100 - jasaPct) : 0;

  const growthOmzet = summary.growthOmzetPct;
  const growthSpk = summary.growthSpkPct;

  return (
    <div className="p-3 sm:p-6 pb-20 w-full flex flex-col gap-3.5 sm:gap-5 bg-slate-50 min-h-screen">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP BAR: BRANDING, QUICK PRESET, & ACTION BUTTONS
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3.5 sm:p-5 flex flex-col gap-3.5 shadow-xs shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-black uppercase tracking-wider">
                {pos?.settings?.storeName || 'BENGKEL KAMI'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                Laporan &amp; Analisis Bengkel
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pantau omzet jasa vs sparepart, evaluasi komisi mekanik, dead-stock, dan laporan keuangan formal
            </p>
          </div>

          {/* Action Buttons Header */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleExportPDF}
              disabled={pdfLoading || loading || !reportData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-purple-200 active:scale-95 transition-all disabled:opacity-50 shrink-0"
              title="Unduh Berkas PDF Resmi Berkepala Surat & Tanda Tangan"
            >
              {pdfLoading ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={15} />}
              <span>Unduh PDF Resmi</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={excelLoading || loading || !reportData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 shrink-0"
              title="Download Workbook Excel (.xlsx) 5 Lembar Kerja Lengkap"
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
                    ? 'bg-white text-purple-700 shadow-xs'
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
            <div className="flex items-center gap-1.5 bg-purple-50/70 border border-purple-200/80 px-2.5 py-1.5 rounded-xl shrink-0" title="Pilih Bulan Spesifik">
              <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthPickerChange(e.target.value)}
                className="bg-transparent text-xs font-black text-purple-950 outline-none cursor-pointer"
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
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-1.5 shrink-0">
        {[
          { 
            id: 'dashboard', 
            title: 'Ringkasan Eksekutif', 
            subtitle: 'Grafik & KPI Utama', 
            icon: BarChart3,
            badge: null
          },
          { 
            id: 'mechanics', 
            title: 'Mekanik & Komisi', 
            subtitle: 'Evaluasi & Slip Gaji', 
            icon: Users,
            badge: mechanicPerformance.length > 0 ? `${mechanicPerformance.length} Staf` : null
          },
          { 
            id: 'parts', 
            title: 'Sparepart & Stok', 
            subtitle: 'Fast-Moving & Dead-Stock', 
            icon: Package,
            badge: deadStockParts.length > 0 ? `${deadStockParts.length} Kritis` : null
          },
          { 
            id: 'services', 
            title: 'Kategori & Unit', 
            subtitle: 'Breakdown Jasa & Motor', 
            icon: Wrench,
            badge: serviceCategories.length > 0 ? `${serviceCategories.length} Jenis` : null
          },
          { 
            id: 'reminders', 
            title: 'Reminder Servis', 
            subtitle: 'CRM Follow-up Pelanggan', 
            icon: CalendarClock,
            badge: serviceDueReminders.length > 0 ? `${serviceDueReminders.length} Unit` : null
          },
          { 
            id: 'accounting', 
            title: 'Keuangan (P&L)', 
            subtitle: 'Laba Rugi & Kas OPEX', 
            icon: Receipt,
            badge: null
          },
          { 
            id: 'invoices', 
            title: 'Faktur B2B', 
            subtitle: 'Piutang Armada Tempo', 
            icon: FileText,
            badge: invoiceStats.totalInvoices > 0 ? `${invoiceStats.totalInvoices} Faktur` : null
          }
        ].map((tab) => {
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
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)' 
                  : '#f8fafc',
                color: isSelected ? '#ffffff' : '#334155',
                border: isSelected ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                borderRadius: '.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                boxShadow: isSelected ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none',
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
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#ede9fe',
                  color: isSelected ? '#ffffff' : '#7c3aed',
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
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#ede9fe', 
                        color: isSelected ? '#ffffff' : '#7c3aed', 
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
          TAB 1: RINGKASAN EKSEKUTIF (DASHBOARD)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          
          {/* Top 4 KPI Metrics with Margins & HPP Ratio (Symmetric Grid) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            
            {/* Card 1: Total Omzet Gross */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Total Omzet (Gross)</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <DollarSign size={16} />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                  {formatCurrency(totalRev)}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center justify-between">
                  <span>{summary.totalSPK || 0} SPK Selesai</span>
                  <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[9.5px]">
                    {growthOmzet !== undefined && growthOmzet !== null 
                      ? `${growthOmzet >= 0 ? `+${growthOmzet}%` : `${growthOmzet}%`} MoM`
                      : '100% Basis'}
                  </span>
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
                  {formatCurrency(netProf)}
                </div>
                <div className="text-[10px] sm:text-xs text-emerald-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">Setelah Komisi &amp; OPEX</span>
                  <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[9.5px]">Margin Bersih {netMarginPct}%</span>
                </div>
              </div>
            </div>

            {/* Card 3: Total HPP Suku Cadang */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-200/80 shadow-xs flex flex-col justify-between min-h-[96px] sm:min-h-[110px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider truncate">Total HPP Sparepart</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <ShoppingBag size={16} />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-xl lg:text-2xl font-black text-rose-600 tracking-tight leading-tight truncate">
                  {formatCurrency(totalHpp)}
                </div>
                <div className="text-[10px] sm:text-xs text-rose-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">Modal Beli Terpasang</span>
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
                  {formatCurrency(grossProf)}
                </div>
                <div className="text-[10px] sm:text-xs text-sky-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                  <span className="truncate">Omzet - HPP Parts</span>
                  <span className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 text-[9.5px]">Gross Margin {grossMarginPct}%</span>
                </div>
              </div>
            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION RATIO: ANALISIS OMZET & MARGIN: JASA SERVIS VS SUKU CADANG
          ────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-600" />
                  <h3 className="m-0 font-black text-base sm:text-lg text-slate-900">
                    Laporan Omzet &amp; Margin: Jasa Servis vs Suku Cadang
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Perbandingan kontribusi omzet pendapatan, porsi jasa pengerjaan, modal HPP sparepart, dan efisiensi laba kotor bengkel
                </p>
              </div>
            </div>

            {/* Visual Contribution Ratio Bar */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/60">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-indigo-700 flex items-center gap-1.5">
                  <Wrench size={14} /> Jasa Servis: {jasaPct}% ({formatCurrency(omzetJasa)})
                </span>
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <Package size={14} /> Suku Cadang &amp; Oli: {partsPct}% ({formatCurrency(omzetParts)})
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${Math.max(0, jasaPct)}%` }} 
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500" 
                  title={`Jasa Servis: ${jasaPct}%`} 
                />
                <div 
                  style={{ width: `${Math.max(0, partsPct)}%` }} 
                  className="bg-gradient-to-r from-emerald-400 to-teal-600 transition-all duration-500" 
                  title={`Suku Cadang & Oli: ${partsPct}%`} 
                />
              </div>
            </div>

            {/* Side-by-Side Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Card 1: Jasa Servis */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/50 rounded-2xl border border-indigo-200/80 p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Wrench size={18} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-indigo-950">Pendapatan Jasa Servis &amp; Pasang</div>
                      <div className="text-[11px] text-indigo-600">Tune up, servis berkala, kelistrikan, &amp; turun mesin</div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-lg border border-indigo-200">
                    Margin Jasa 100%
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <div>
                    <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Total Omzet Jasa</div>
                    <div className="text-xl font-black text-indigo-950">{formatCurrency(omzetJasa)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Beban Komisi Mekanik</div>
                    <div className="text-base font-black text-amber-700">-{formatCurrency(summary.totalBebanKomisi)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-white/90 p-2.5 rounded-xl border border-indigo-100 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Laba Jasa Bersih</span>
                    <strong className="text-emerald-700">{formatCurrency(omzetJasa - (summary.totalBebanKomisi || 0))}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Rasio Komisi Jasa</span>
                    <strong className="text-slate-800">{omzetJasa > 0 ? `${Math.round(((summary.totalBebanKomisi || 0) / omzetJasa) * 100)}%` : '0%'}</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Suku Cadang & Oli */}
              <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80 p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Package size={18} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-emerald-950">Penjualan Suku Cadang &amp; Oli</div>
                      <div className="text-[11px] text-emerald-700">Oli mesin, kampas rem, ban, aki, filter &amp; part</div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-200">
                    Laba: {formatCurrency(summary.labaKotorParts)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <div>
                    <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Total Penjualan Part</div>
                    <div className="text-xl font-black text-emerald-950">{formatCurrency(omzetParts)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">HPP Modal Beli</div>
                    <div className="text-base font-black text-rose-700">-{formatCurrency(totalHpp)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-white/90 p-2.5 rounded-xl border border-emerald-100 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Margin Kotor Part</span>
                    <strong className="text-emerald-700">{omzetParts > 0 ? `${Math.round(((summary.labaKotorParts || 0) / omzetParts) * 100)}%` : '0%'}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Modal Mengendap</span>
                    <strong className="text-amber-700">{formatCurrency(summary.tiedUpCapitalInDeadStock || 0)}</strong>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Visual Recharts Area & Composed Chart (Grafik Tren Harian Bergradien Seperti Kafe) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 size={17} className="text-purple-700" />
                  <span>Grafik Tren Penjualan Harian (Jasa Servis vs Suku Cadang)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisasi kurva finansial omzet servis, perputaran sparepart, dan volume SPK harian.
                </p>
              </div>

              {/* Chart View Selector Pills Seperti Kafe */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-start sm:self-auto overflow-x-auto max-w-full">
                {[
                  { id: 'all', label: '📊 Semua' },
                  { id: 'total', label: '📈 Total Omzet' },
                  { id: 'jasa', label: '🔧 Jasa Servis' },
                  { id: 'parts', label: '⚙️ Sparepart' },
                  { id: 'spk', label: '🛵 Volume SPK' },
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => setChartViewMode(btn.id as any)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      chartViewMode === btn.id
                        ? 'bg-white text-purple-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 h-72">
              {dailyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                  Belum ada transaksi SPK lunas pada rentang periode ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBengkelReportTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorBengkelReportJasa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorBengkelReportParts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="dateFormatted" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${Math.round(v/1000)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: '#f59e0b' }}
                      axisLine={false}
                      tickLine={false}
                      unit=" SPK"
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === 'Volume SPK') return [`${val} Kendaraan`, name];
                        return [formatCurrency(Number(val)), name];
                      }}
                      contentStyle={{
                        background: 'white',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                    {(chartViewMode === 'all' || chartViewMode === 'total') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="totalOmzet"
                        name="Total Omzet"
                        stroke="#7c3aed"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorBengkelReportTotal)"
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {(chartViewMode === 'all' || chartViewMode === 'jasa') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="omzetJasa"
                        name="Jasa Servis"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorBengkelReportJasa)"
                        activeDot={{ r: 5 }}
                      />
                    )}
                    {(chartViewMode === 'all' || chartViewMode === 'parts') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="omzetParts"
                        name="Suku Cadang & Oli"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorBengkelReportParts)"
                        activeDot={{ r: 5 }}
                      />
                    )}
                    {(chartViewMode === 'all' || chartViewMode === 'spk') && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="spkCount"
                        name="Volume SPK"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#f59e0b' }}
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
          TAB 2: MEKANIK & KOMISI
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'mechanics' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-purple-700" />
                <span>Evaluasi Kinerja &amp; Hak Komisi Mekanik</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Perhitungan omzet jasa yang dihasilkan dan hak komisi per mekanik untuk penggajian periode berjalan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Mekanik</th>
                  <th className="py-3 px-4 text-center">SPK Ditangani</th>
                  <th className="py-3 px-4 text-right">Omzet Jasa Servis</th>
                  <th className="py-3 px-4 text-center">Skema Komisi</th>
                  <th className="py-3 px-4 text-right">Hak Komisi Periode Ini</th>
                  <th className="py-3 px-4 text-right">Pending Komisi</th>
                  <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mechanicPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada data pengerjaan mekanik pada periode ini.
                    </td>
                  </tr>
                ) : (
                  mechanicPerformance.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{m.phone || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full text-xs">
                          {m.spkCompleted} Kendaraan
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(m.totalJasaGenerated)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {Math.round(m.commissionRate * 100)}% dari Jasa
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-700">
                        {formatCurrency(m.estimatedPeriodCommission)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-purple-900">
                        {formatCurrency(m.pendingCommission)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedMechanicModal(m)}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] border border-purple-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Audit Rincian SPK & Pengerjaan"
                          >
                            <Eye size={12} />
                            <span>Rincian SPK</span>
                          </button>
                          <button
                            onClick={() => handleExportSlip(m)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Download Slip Komisi Formal"
                          >
                            <Download size={12} />
                            <span>Slip Gaji</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SPAREPART & STOK (FAST-MOVING & DEAD-STOCK)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'parts' && (
        <div className="space-y-5 animate-fade-in">
          {/* Banner Dead-Stock Warning */}
          {deadStockParts.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-amber-950">Peringatan Dead-Stock (Suku Cadang Mengendap)</h4>
                  <p className="text-xs text-amber-800">
                    Terdapat {deadStockParts.length} suku cadang dengan stok aktif namun tidak ada riwayat terjual/terpasang &gt;60 hari.
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right bg-white/90 px-4 py-2 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-700">Total Modal Tertahan</span>
                <div className="text-base sm:text-lg font-black text-amber-950">
                  {formatCurrency(summary.tiedUpCapitalInDeadStock)}
                </div>
              </div>
            </div>
          )}

          {/* Tabel 1: Fast-Moving Parts */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Package size={18} className="text-purple-700" />
                <span>10 Suku Cadang Terlaris (Fast-Moving Parts)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring suku cadang paling cepat keluar, kontribusi omzet penjualan, dan sisa stok fisik di rak pit.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Suku Cadang</th>
                    <th className="py-3 px-4 text-center">Jumlah Keluar</th>
                    <th className="py-3 px-4 text-right">Total Penjualan</th>
                    <th className="py-3 px-4 text-center">Sisa Stok Rak</th>
                    <th className="py-3 px-4 text-center">Batas Minimum</th>
                    <th className="py-3 px-4 text-center">Status Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fastMovingParts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Belum ada data suku cadang terjual pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    fastMovingParts.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-700 bg-indigo-50/30">
                          {p.qty} Pcs
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {p.stock} Pcs
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">
                          {p.minStock || 0} Pcs
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.stock <= (p.minStock || 0) ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              ⚠️ STOK KRITIS
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ AMAN
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel 2: Dead-Stock Parts */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <span>Daftar Suku Cadang Mengendap (Dead-Stock &gt;60 Hari)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekomendasi promo cuci gudang atau bundling servis untuk mencairkan modal usaha yang tertahan.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Suku Cadang</th>
                    <th className="py-3 px-4 text-center">Stok Mengendap</th>
                    <th className="py-3 px-4 text-right">Harga Modal (HPP)</th>
                    <th className="py-3 px-4 text-right">Modal Tertahan</th>
                    <th className="py-3 px-4 text-center">Lokasi Rak</th>
                    <th className="py-3 px-4">Rekomendasi Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deadStockParts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-emerald-600 font-medium">
                        ✓ Luar biasa! Tidak terdeteksi adanya suku cadang dead-stock yang mengendap di gudang.
                      </td>
                    </tr>
                  ) : (
                    deadStockParts.map((p: any) => {
                      const cost = p.costPrice ?? p.buyPrice ?? 0;
                      const location = p.storageLocation || p.rackLocation || 'Gudang Utama';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400">SKU: {p.barcode || String(p.id).slice(0, 8)}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-rose-700 bg-rose-50/20">
                            {p.stock} Pcs
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(cost)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-rose-700">
                            {formatCurrency(p.tiedUpCapital)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700">
                              {location}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px]">
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                              Diskon Cuci Gudang / Paket Servis
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: KATEGORI SERVIS & MODEL KENDARAAN
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-6 shadow-xs animate-fade-in">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Wrench size={18} className="text-purple-700" />
              <span>Intelijen Kategori Servis &amp; Model Kendaraan</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemetaan jenis perbaikan paling dominan di pit bengkel serta model motor/mobil pelanggan terbanyak.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kiri: Breakdown Kategori Servis */}
            <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Wrench size={14} className="text-purple-600" />
                <span>Breakdown Kategori Pekerjaan Servis</span>
              </h4>

              {serviceCategories.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada data pengerjaan jasa servis pada periode ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {serviceCategories.map((sc: any, idx: number) => {
                    const catName = sc.name || sc.category || 'Servis Umum';
                    const pct = sc.sharePct ?? sc.pct ?? 0;
                    return (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{catName}</span>
                            <span className="text-[10px] text-slate-400">({sc.count} SPK)</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900">{formatCurrency(sc.revenue)}</span>
                            <span className="text-[10px] text-purple-700 font-bold ml-1.5">({pct}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full" 
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Kanan: Model Kendaraan Pelanggan Terbanyak */}
            <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Car size={14} className="text-indigo-600" />
                <span>Top Model Kendaraan Pengunjung</span>
              </h4>

              {vehicleBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada data kendaraan tercatat pada periode ini.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {vehicleBreakdown.map((vb: any, idx: number) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{vb.model}</div>
                          <div className="text-[10px] text-slate-400">{vb.count} Kunjungan Unit</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xs text-indigo-900">{formatCurrency(vb.revenue)}</div>
                        <div className="text-[10px] text-slate-400">Total Omzet SPK</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: REMINDER SERVIS CRM
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'reminders' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <CalendarClock size={18} className="text-indigo-600" />
                <span>CRM Reminder Servis Berkala &amp; Ganti Oli</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar kendaraan pelanggan yang sudah melewati masa rekomendasi servis (&gt;45 hari sejak SPK terakhir).
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Terdeteksi: <strong className="text-indigo-700">{serviceDueReminders.length} Unit</strong> Perlu Dihubungi
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Kendaraan &amp; Pelanggan</th>
                  <th className="py-3 px-4">Kontak Telepon</th>
                  <th className="py-3 px-4">Servis Terakhir</th>
                  <th className="py-3 px-4 text-center">Tgl Servis Terakhir</th>
                  <th className="py-3 px-4 text-center">Hari Berlalu</th>
                  <th className="py-3 px-4 text-center">Aksi Cepat WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceDueReminders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada unit pelanggan yang jatuh tempo servis berkala saat ini.
                    </td>
                  </tr>
                ) : (
                  serviceDueReminders.map((r: any, idx: number) => {
                    const plate = r.plate || r.vehiclePlate || '-';
                    const model = r.model || r.vehicleModel || 'Motor/Mobil';
                    const phone = r.customerPhone || r.phone || '-';
                    const services = r.lastServices || r.lastServiceNames || 'Servis Berkala';
                    const waLink = r.waLink || r.whatsappUrl;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">{plate}</span>
                            <span>{model}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Pemilik: <strong>{r.customerName}</strong></div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {phone}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <span className="line-clamp-1">{services}</span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {formatDateID(r.lastServiceDate)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {r.daysSince} hari lalu
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition"
                            >
                              <MessageSquare size={12} />
                              <span>Kirim WA</span>
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No Phone</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: KEUANGAN (P&L FORMAL) & ARUS KAS OPEX
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'accounting' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* P&L Statement Formal Table */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Receipt size={18} className="text-purple-700" />
              <span>Laporan Laba Rugi Operasional Bengkel (P&amp;L Statement Formal)</span>
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>I. PENDAPATAN OPERASIONAL BENGKEL</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-6 text-slate-600">Pendapatan Jasa Servis &amp; Pasang</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">{formatCurrency(summary.omzetJasa)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-6 text-slate-600">Penjualan Suku Cadang &amp; Oli Mesin</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">{formatCurrency(summary.omzetParts)}</td>
                  </tr>
                  {summary.totalDiskon > 0 && (
                    <tr>
                      <td className="py-2 px-6 text-rose-600">Potongan Diskon Promo SPK</td>
                      <td className="py-2 px-4 text-right font-semibold text-rose-600">-{formatCurrency(summary.totalDiskon)}</td>
                    </tr>
                  )}
                  <tr className="bg-purple-50/40 font-bold text-purple-950">
                    <td className="py-2 px-6">Total Pendapatan Bersih (Net Revenue)</td>
                    <td className="py-2 px-4 text-right text-purple-900">{formatCurrency(summary.totalOmzetBersih)}</td>
                  </tr>

                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>II. HARGA POKOK PENJUALAN (HPP / COGS)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-6 text-slate-600">Modal Beli Sparepart Terpasang (HPP Parts)</td>
                    <td className="py-2 px-4 text-right font-bold text-slate-800">{formatCurrency(summary.hppParts)}</td>
                  </tr>
                  <tr className="bg-emerald-50/40 font-bold text-emerald-950">
                    <td className="py-2 px-6">Laba Kotor Usaha (Gross Profit - {grossMarginPct}%)</td>
                    <td className="py-2 px-4 text-right text-emerald-800">{formatCurrency(summary.totalLabaKotor)}</td>
                  </tr>

                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>III. BEBAN LANGSUNG OPERASIONAL</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-6 text-slate-600">Beban Hak Komisi Mekanik (Pengerjaan Jasa)</td>
                    <td className="py-2 px-4 text-right font-bold text-amber-700">-{formatCurrency(summary.totalBebanKomisi)}</td>
                  </tr>
                  <tr className="font-semibold text-slate-700 bg-slate-50/30">
                    <td className="py-2 px-6">Laba Usaha Setelah Komisi Mekanik</td>
                    <td className="py-2 px-4 text-right">{formatCurrency(summary.labaSetelahKomisi || (summary.totalLabaKotor - summary.totalBebanKomisi))}</td>
                  </tr>

                  <tr className="bg-slate-50/80 font-bold text-slate-800">
                    <td className="py-2.5 px-4" colSpan={2}>IV. BEBAN KAS OPERASIONAL (OPEX PETTY CASH)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-6 text-slate-600">Beban Kas Keluar Operasional (Listrik, Alat Pit, Konsumsi)</td>
                    <td className="py-2 px-4 text-right font-bold text-rose-600">-{formatCurrency(summary.totalBebanOpex || cashflow.totalOutflow || 0)}</td>
                  </tr>

                  <tr className="bg-indigo-600 text-white font-black text-sm">
                    <td className="py-3 px-6">ESTIMASI LABA BERSIH OPERASIONAL (NET PROFIT)</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(summary.estimasiLabaBersih)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Arus Kas Masuk & Keluar */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-5 shadow-xs">
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Wallet size={18} className="text-purple-700" />
              <span>Rekonsiliasi Arus Kas &amp; Beban Operasional (Petty Cash)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Kas Masuk (Cash In)</div>
                <div className="text-lg font-black text-emerald-950 mt-1">{formatCurrency(cashflow.totalInflow)}</div>
                <div className="text-[10px] text-emerald-600 mt-1">Pembayaran SPK tunai &amp; transfer lunas</div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200">
                <div className="text-[10px] font-bold text-rose-700 uppercase">Total Kas Keluar (Cash Out / OPEX)</div>
                <div className="text-lg font-black text-rose-950 mt-1">{formatCurrency(cashflow.totalOutflow)}</div>
                <div className="text-[10px] text-rose-600 mt-1">Belanja operasional, alat pit, &amp; biaya laci</div>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200">
                <div className="text-[10px] font-bold text-purple-700 uppercase">Net Cash Flow (Kas Bersih)</div>
                <div className="text-lg font-black text-purple-950 mt-1">{formatCurrency(cashflow.netCashflow)}</div>
                <div className="text-[10px] text-purple-600 mt-1">Saldo surplus kas operasional periode ini</div>
              </div>
            </div>

            {/* OPEX Category Breakdown */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                Rincian Kategori Pengeluaran Kas (Petty Cash Breakdown)
              </h4>

              {(!cashflow.opexBreakdown || cashflow.opexBreakdown.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada transaksi pengeluaran kas operasional yang dicatat pada periode ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {cashflow.opexBreakdown.map((item: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-slate-800">{item.category}</div>
                        <div className="text-[10px] text-slate-400">Pengeluaran Operasional</div>
                      </div>
                      <div className="font-black text-xs text-rose-700">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 7: FAKTUR & PIUTANG B2B ARMADA
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs animate-fade-in">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-purple-700" />
              <span>Rekapitulasi Faktur &amp; Piutang B2B Armada</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring tagihan invoice termin (tempo) perusahaan rekanan, instansi, atau rental armada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Total Nilai Faktur</div>
              <div className="text-lg font-black text-slate-900 mt-1">{formatCurrency(invoiceStats.totalAmount)}</div>
              <div className="text-[10px] text-slate-400 mt-1">{invoiceStats.totalInvoices || 0} Faktur Terbit</div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Piutang Tertagih (Lunas)</div>
              <div className="text-lg font-black text-emerald-950 mt-1">{formatCurrency(invoiceStats.paidAmount)}</div>
              <div className="text-[10px] text-emerald-600 mt-1">{invoiceStats.paidCount || 0} Faktur Lunas</div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-[10px] font-bold text-amber-700 uppercase">Sisa Piutang Berjalan</div>
              <div className="text-lg font-black text-amber-950 mt-1">{formatCurrency(invoiceStats.unpaidAmount)}</div>
              <div className="text-[10px] text-amber-600 mt-1">{invoiceStats.unpaidCount || 0} Menunggu Pembayaran</div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-indigo-700 uppercase">Manajemen Faktur A4</div>
                <div className="text-xs text-indigo-900 mt-1">Kelola &amp; terbitkan faktur baru</div>
              </div>
              <a
                href="/bengkel/invoices"
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Buka Invoice B2B <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL DRILL-DOWN RINCIAN SPK MEKANIK
      ────────────────────────────────────────────────────────────── */}
      {selectedMechanicModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Users size={18} className="text-purple-700" />
                  <span>Rincian Pengerjaan SPK: {selectedMechanicModal.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit detail pengerjaan jasa servis &amp; perhitungan komisi pengerjaan SPK.
                </p>
              </div>
              <button
                onClick={() => setSelectedMechanicModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ringkasan Mekanik Modal */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-center">
                <span className="text-[10px] font-bold text-purple-700 uppercase">Total SPK</span>
                <div className="text-base font-black text-purple-950 mt-0.5">{selectedMechanicModal.spkCompleted} Unit</div>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">Omzet Jasa</span>
                <div className="text-base font-black text-indigo-950 mt-0.5">{formatCurrency(selectedMechanicModal.totalJasaGenerated)}</div>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Hak Komisi</span>
                <div className="text-base font-black text-amber-950 mt-0.5">{formatCurrency(selectedMechanicModal.estimatedPeriodCommission)}</div>
              </div>
            </div>

            {/* List Pengerjaan */}
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">No. SPK &amp; Kendaraan</th>
                    <th className="py-2.5 px-3">Layanan Jasa</th>
                    <th className="py-2.5 px-3 text-right">Tarif Jasa</th>
                    <th className="py-2.5 px-3 text-right">Komisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!selectedMechanicModal.recentJobs || selectedMechanicModal.recentJobs.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Tidak ada riwayat detail pengerjaan untuk mekanik ini.
                      </td>
                    </tr>
                  ) : (
                    selectedMechanicModal.recentJobs.map((j: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{j.spkNumber}</div>
                          <div className="text-[10px] text-slate-500">{j.vehiclePlate} ({j.vehicleModel})</div>
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">{j.serviceName}</td>
                        <td className="py-2 px-3 text-right text-slate-800">{formatCurrency(j.price)}</td>
                        <td className="py-2 px-3 text-right font-black text-amber-700">+{formatCurrency(j.commissionEarned)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleExportSlip(selectedMechanicModal)}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                <span>Unduh Slip Komisi PDF</span>
              </button>
              <button
                onClick={() => setSelectedMechanicModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BengkelReports;
