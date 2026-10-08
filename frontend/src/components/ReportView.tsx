import React, { useState, useEffect, useContext } from 'react';
import { 
  Calendar, DollarSign, TrendingUp, ShoppingBag, Layers, PieChart as PieChartIcon, 
  Printer, User, Award, ListFilter, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  BookOpen, CreditCard, ChevronRight, RefreshCw, Download, Check, Search, 
  FileText, Utensils, Coffee, CheckCircle2, X, Sparkles, SlidersHorizontal, BarChart3, Clock,
  Boxes, Users, Receipt, Package, Flame, Percent, FileSpreadsheet, ChefHat, Sliders
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import { toast, confirmAlert } from '../utils/alert';
import { exportFinancialPDF, exportProfitSharingPDF, exportDailyBonusPDF } from '../utils/pdfGenerator';
import { exportProfitSharingExcel, exportDailyBonusExcel, exportPettyCashExcel, exportSalesReportExcel, exportInventoryValuationExcel } from '../utils/excelGenerator';
import { getTodayStr, getYesterdayStr, getLast7DaysRange, getLast30DaysRange, getThisMonthRange, getLastMonthRange, getMonthRange, formatLocalDate } from '../utils/dateUtils';
import { AiMenuOptimizerModal } from './AiMenuOptimizerModal';

type QuickFilterType = 'today' | 'yesterday' | 'week' | 'this_month' | 'last_month' | 'month_30' | 'custom';
type MainTabType = 'dashboard' | 'products' | 'shifts_transactions' | 'inventory' | 'accounting' | 'profit_sharing' | 'daily_bonus';

export const ReportView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const { isBengkel, isRental, isRetail, isLaundry, isCafe } = useVertical();

  // AI Menu Advisor Modal State
  const [showAiMenuModal, setShowAiMenuModal] = useState(false);

  // Date Filters: Default to today
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(getTodayStr().slice(0, 7)); // YYYY-MM

  // Main Tabs Navigation
  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  
  // Sub-tabs
  const [shiftTxSubTab, setShiftTxSubTab] = useState<'shifts' | 'transactions'>('shifts');
  const [accountingSubTab, setAccountingSubTab] = useState<'pl' | 'cashflow' | 'ledger'>('pl');
  const [chartViewMode, setChartViewMode] = useState<'all' | 'revenue' | 'profit' | 'hpp' | 'category'>('all');

  // Loading state
  const [loading, setLoading] = useState(true);

  // PDF Export Modal State
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const enableProfitSharing = posContext?.settings?.enableProfitSharing ?? true;

  useEffect(() => {
    if (posContext?.settings?.enableProfitSharing === false && activeTab === 'profit_sharing') {
      setActiveTab('dashboard');
    }
  }, [posContext?.settings?.enableProfitSharing, activeTab]);

  // Product Report Search & Sorting
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('Semua');
  const [productSortKey, setProductSortKey] = useState<'qty' | 'revenue' | 'profit' | 'margin'>('qty');
  const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('desc');

  // Transaction & Inventory Search
  const [txSearch, setTxSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');

  // Data States
  const [reportData, setReportData] = useState<any>({
    summary: { revenue: 0, profit: 0, hpp: 0, transactionsCount: 0, discounts: 0, tax: 0, serviceCharge: 0 },
    paymentMethods: { Tunai: { count: 0, amount: 0 }, QRIS: { count: 0, amount: 0 }, Kartu: { count: 0, amount: 0 }, Split: { count: 0, amount: 0 } },
    categories: [],
    products: [],
    shifts: [],
    todayRecap: { revenue: 0, pendingAmount: 0, pendingCount: 0, expenses: 0, cashInDrawer: 0, qtySold: 0, otherIncomes: 0, qris: 0 },
    periodRecap: { netIncome: 0, revenue: 0, expenses: 0, revenueBreakdown: { makanan: 0, minuman: 0, dessert: 0, other: 0 }, growth: 0, dineIn: 0, takeaway: 0, qrisTotal: 0, qrisCount: 0 },
    dailyTimeline: []
  });

  const [accountingData, setAccountingData] = useState<any>({
    profitLoss: { operatingRevenue: 0, salesRevenue: 0, otherRevenue: 0, shiftOverage: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, opexAmount: 0, shiftShortage: 0, netIncome: 0 },
    cashFlow: { inflow: { salesReceipts: 0, otherReceipts: 0, overages: 0, total: 0 }, outflow: { opexPayments: 0, shortages: 0, total: 0 }, netCashFlow: 0 },
    journals: []
  });

  const [inventoryData, setInventoryData] = useState<any>({
    summary: { totalAssetValuation: 0, criticalItemsCount: 0, totalMutationsCount: 0 },
    inventory: []
  });

  const [transactionsData, setTransactionsData] = useState<any[]>([]);
  const [profitSharingData, setProfitSharingData] = useState<any>(null);
  const [dailyBonusData, setDailyBonusData] = useState<any>(null);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const fetchAllReportData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const tzOffset = new Date().getTimezoneOffset();
      const [resReports, resAccounting, resInventory, resTransactions, resProfitSharing, resDailyBonus] = await Promise.all([
        fetch(`/api/analytics/reports?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/analytics/accounting?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/analytics/inventory?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/orders?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/analytics/profit-sharing?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/analytics/daily-omzet-bonus?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers })
      ]);

      if (resReports.ok) setReportData(await resReports.json());
      if (resAccounting.ok) setAccountingData(await resAccounting.json());
      if (resInventory.ok) setInventoryData(await resInventory.json());
      if (resTransactions.ok) setTransactionsData(await resTransactions.json());
      if (resProfitSharing.ok) setProfitSharingData(await resProfitSharing.json());
      if (resDailyBonus.ok) setDailyBonusData(await resDailyBonus.json());
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan saat memuat data laporan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAllReportData();
  }, [token, startDate, endDate]);

  // Quick Filter preset handler
  const handleQuickFilter = (type: QuickFilterType) => {
    setQuickFilter(type);
    if (type === 'today') {
      const t = getTodayStr();
      setStartDate(t);
      setEndDate(t);
    } else if (type === 'yesterday') {
      const y = getYesterdayStr();
      setStartDate(y);
      setEndDate(y);
    } else if (type === 'week') {
      const r = getLast7DaysRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (type === 'this_month') {
      const r = getThisMonthRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
      setSelectedMonth(r.startDate.slice(0, 7));
    } else if (type === 'last_month') {
      const r = getLastMonthRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
      setSelectedMonth(r.startDate.slice(0, 7));
    } else if (type === 'month_30') {
      const r = getLast30DaysRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    }
  };

  const handleMonthPickerChange = (yearMonthStr: string) => {
    setSelectedMonth(yearMonthStr);
    setQuickFilter('custom');
    const r = getMonthRange(yearMonthStr);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
  };

  const handleSettleKasbon = async (userId: number, userName: string, amount: number) => {
    const resConfirm = await confirmAlert(
      'Lunasi Kasbon via Gaji?',
      `Yakin ingin memproses pelunasan kasbon ${userName} senilai ${formatCurrency(amount)} untuk periode ${startDate} s/d ${endDate}? Status kasbon staf akan otomatis berubah menjadi LUNAS.`
    );

    if (!resConfirm.isConfirmed) return;

    try {
      const res = await fetch('/api/employee-loans/bulk-settle-payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          period: `${startDate} s/d ${endDate}`,
          notes: `Dipotong Otomatis via Slip Gaji Periode ${startDate} s/d ${endDate}`
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Kasbon staf berhasil dilunasi!', 'success');
        fetchAllReportData();
      } else {
        toast(data.error || 'Gagal melunasi kasbon', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  // PDF Export Handler
  const handleGeneratePdf = async (type: string) => {
    setExportingPdf(true);
    try {
      let dataToPass: any = null;

      if (type === 'profit_sharing') {
        if (!profitSharingData || !profitSharingData.summary) {
          toast('Data bagi hasil tidak tersedia untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        await exportProfitSharingPDF(
          profitSharingData,
          posContext?.settings || { storeName: 'KAFE & RESTORAN' },
          { startDate, endDate },
          posContext?.user?.username || 'Admin'
        );
        toast('✅ Dokumen PDF Bagi Hasil berhasil diunduh!', 'success');
        setShowPdfModal(false);
        return;
      } else if (type === 'daily_bonus') {
        if (!dailyBonusData || !dailyBonusData.days || dailyBonusData.days.length === 0) {
          toast('Data bonus harian tidak tersedia untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        await exportDailyBonusPDF(
          dailyBonusData,
          posContext?.settings || { storeName: 'KAFE & RESTORAN' },
          { startDate, endDate },
          posContext?.user?.username || 'Admin'
        );
        toast('✅ Dokumen PDF Matriks Bonus berhasil diunduh!', 'success');
        setShowPdfModal(false);
        return;
      } else if (type === 'products') {
        const products = reportData.products || [];
        if (products.length === 0) {
          toast('Tidak ada data penjualan menu untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = products;
      } else if (type === 'pl') {
        const pl = accountingData.profitLoss;
        if (!pl || (pl.salesRevenue === 0 && pl.operatingRevenue === 0)) {
          toast('Tidak ada data transaksi untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = pl;
      } else if (type === 'cashflow') {
        const cf = accountingData.cashFlow;
        if (!cf || cf.inflow?.total === 0) {
          toast('Tidak ada data arus kas untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = cf;
      } else if (type === 'ledger') {
        const journals = accountingData.journals || [];
        if (journals.length === 0) {
          toast('Tidak ada entri jurnal untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = accountingData;
      } else if (type === 'shifts') {
        const s = reportData.shifts || [];
        if (s.length === 0) {
          toast('Tidak ada riwayat shift untuk periode ini.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = s;
      } else if (type === 'inventory') {
        const inv = inventoryData?.inventory || [];
        if (inv.length === 0) {
          toast('Tidak ada data persediaan bahan baku untuk diekspor.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = inventoryData;
      } else if (type === 'dashboard') {
        dataToPass = reportData;
      }

      await exportFinancialPDF(
        type,
        posContext?.settings || { storeName: 'KAFE & RESTORAN' },
        dataToPass,
        startDate,
        endDate,
        posContext?.user?.username || 'Admin'
      );
      toast('✅ Dokumen PDF berhasil diunduh!', 'success');
      setShowPdfModal(false);
    } catch (e: any) {
      console.error(e);
      toast('Gagal mencetak PDF laporan', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  // Excel Export Handler (.xlsx)
  const handleExportExcel = () => {
    try {
      if (activeTab === 'profit_sharing') {
        if (!profitSharingData || !profitSharingData.summary) return toast('Tidak ada data bagi hasil untuk diekspor', 'warning');
        exportProfitSharingExcel(profitSharingData, posContext?.settings || { storeName: 'KAFE & RESTORAN' }, { startDate, endDate });
        toast('✓ Spreadsheet Excel Bagi Hasil berhasil diunduh!', 'success');
      } else if (activeTab === 'daily_bonus') {
        if (!dailyBonusData || !dailyBonusData.days || dailyBonusData.days.length === 0) return toast('Tidak ada data bonus untuk diekspor', 'warning');
        exportDailyBonusExcel(dailyBonusData, posContext?.settings || { storeName: 'KAFE & RESTORAN' }, { startDate, endDate });
        toast('✓ Spreadsheet Excel Matriks Bonus berhasil diunduh!', 'success');
      } else if (activeTab === 'inventory') {
        if (!inventoryData || !inventoryData.inventory) return toast('Tidak ada data inventaris untuk diekspor', 'warning');
        exportInventoryValuationExcel(inventoryData, posContext?.settings || { storeName: 'KAFE & RESTORAN' });
        toast('✓ Spreadsheet Excel Valuasi Stok berhasil diunduh!', 'success');
      } else {
        if (!reportData || !reportData.summary) return toast('Tidak ada data penjualan untuk diekspor', 'warning');
        exportSalesReportExcel(reportData, posContext?.settings || { storeName: 'KAFE & RESTORAN' }, { startDate, endDate });
        toast('✓ Spreadsheet Excel Laporan Penjualan berhasil diunduh!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      toast('Gagal mengunduh spreadsheet Excel: ' + err.message, 'error');
    }
  };

  // CSV Export Helper
  const downloadCSVFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (activeTab === 'products') {
      const headers = ['Nama Menu', 'Kategori', 'Terjual (Qty)', 'Omzet Kotor', 'Total HPP', 'Keuntungan', 'Margin (%)'];
      const rows = (reportData.products || []).map((p: any) => [
        `"${p.name}"`, `"${p.category}"`, p.qty, p.revenue, p.cost, p.profit, `${p.margin}%`
      ]);
      downloadCSVFile(`Laporan_Penjualan_Menu_${startDate}_sd_${endDate}.csv`, [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n'));
      toast('File CSV Penjualan Menu berhasil diunduh', 'success');
    } else if (activeTab === 'inventory') {
      const headers = ['Nama Bahan', 'Satuan', 'Stok Awal', 'Masuk', 'Keluar', 'Stok Akhir', 'Nilai Aset'];
      const rows = (inventoryData.inventory || []).map((i: any) => [
        `"${i.name}"`, `"${i.unit}"`, i.stockAwal, i.masuk, i.keluarProduksi, i.stockAkhir, i.totalValuation
      ]);
      downloadCSVFile(`Laporan_Stok_Bahan_${startDate}_sd_${endDate}.csv`, [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n'));
      toast('File CSV Stok Bahan berhasil diunduh', 'success');
    } else {
      toast('Pilih tab Penjualan Menu atau Stok untuk export CSV', 'info');
    }
  };

  // Products Data Processing
  const rawProducts = reportData.products || [];
  const productCategories: string[] = ['Semua', ...(Array.from(new Set(rawProducts.map((p: any) => String(p.category || 'Lainnya')))) as string[])];
  
  const filteredProducts = rawProducts
    .filter((p: any) => {
      const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat = productCategoryFilter === 'Semua' || p.category === productCategoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a: any, b: any) => {
      let valA = a[productSortKey] || 0;
      let valB = b[productSortKey] || 0;
      return productSortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

  // Top 3 Best Sellers (Exclude neutral items like air mineral/retail)
  const topSellers = [...rawProducts]
    .filter((p: any) => !p.isNeutral && p.group !== 'lainnya' && !p.name?.toLowerCase().includes('air mineral') && !p.name?.toLowerCase().includes('aqua') && !p.name?.toLowerCase().includes('cleo'))
    .sort((a: any, b: any) => (b.qty || 0) - (a.qty || 0))
    .slice(0, 3);
  const totalQtySold = rawProducts.reduce((sum: number, p: any) => sum + (p.qty || 0), 0);
  const totalMenuRevenue = rawProducts.reduce((sum: number, p: any) => sum + (p.revenue || 0), 0);
  const totalMenuProfit = rawProducts.reduce((sum: number, p: any) => sum + (p.profit || 0), 0);
  const avgMargin = totalMenuRevenue > 0 ? Math.round((totalMenuProfit / totalMenuRevenue) * 100) : 0;

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-5">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP BAR: QUICK FILTER TANGGAL & ACTION BUTTONS
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3.5 sm:p-5 flex flex-col gap-3.5 shadow-sm shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="hidden sm:block">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-purple-50 text-indigo-700 rounded-lg text-xs font-extrabold">
                {posContext?.settings?.storeName || 'KAFE & RESTORAN'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                Laporan & Analisis Bisnis
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pantau omzet, laba kotor per menu, rekap shift kasir, dan laporan keuangan formal
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowPdfModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-200 active:scale-95 transition-all"
            >
              <Printer size={15} /> <span>Unduh PDF Resmi</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 active:scale-95 transition-all"
              title="Download Excel (.xlsx) dengan tata letak profesional"
            >
              <FileSpreadsheet size={15} /> <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all"
            >
              <Download size={15} /> <span>Export CSV</span>
            </button>

            <button
              onClick={fetchAllReportData}
              title="Perbarui Data"
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-sm active:scale-95 transition-all shrink-0"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Quick Filter Pills (Horizontally scrollable on mobile) */}
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
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  quickFilter === f.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date Picker Range & Month Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 w-full xl:w-auto">
            {/* Quick Month Picker */}
            <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-indigo-50/70 border border-indigo-200/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl shrink-0" title="Pilih Bulan Spesifik">
              <span className="text-[9.5px] sm:text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider shrink-0">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthPickerChange(e.target.value)}
                className="bg-transparent text-[11px] sm:text-xs font-black text-indigo-950 outline-none cursor-pointer w-full sm:w-auto"
              />
            </div>

            {/* Custom Date Range (50/50 on mobile, inline on desktop) */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
              <div className="flex-1 flex items-center gap-1 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200 min-w-0">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setQuickFilter('custom');
                  }}
                  className="w-full border-none bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 outline-none min-w-0"
                />
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400 font-bold shrink-0">s/d</span>
              <div className="flex-1 flex items-center gap-1 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200 min-w-0">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setQuickFilter('custom');
                  }}
                  className="w-full border-none bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 outline-none min-w-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGASI TAB UTAMA LAPORAN
      ────────────────────────────────────────────────────────────── */}
      <div className={`bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-sm grid grid-cols-2 sm:grid-cols-3 ${enableProfitSharing ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-1.5 shrink-0`}>
        {[
          { 
            id: 'dashboard', 
            title: 'Ringkasan Eksekutif', 
            mobileTitle: 'Ringkasan',
            subtitle: 'Grafik & KPI Utama', 
            icon: BarChart3,
            badge: null
          },
          ...(enableProfitSharing ? [{ 
            id: 'profit_sharing', 
            title: 'Bagi Hasil (80:20)', 
            mobileTitle: 'Bagi Hasil',
            subtitle: isBengkel ? 'Servis vs Sparepart & Owner' :
                      isRetail ? 'Retail vs Grosir & Owner' :
                      isLaundry ? 'Kiloan vs Satuan & Owner' :
                      isRental ? 'Busana vs Rias & Owner' :
                      'Divisi 1 vs Divisi 2 & Owner', 
            icon: Percent,
            badge: profitSharingData?.summary ? `Rp ${Math.round((profitSharingData.summary.grandTotalNetProfit || 0) / 1000)}k` : null
          }] : []),
          { 
            id: 'daily_bonus', 
            title: 'Bonus & Absensi', 
            mobileTitle: 'Bonus & Absensi',
            subtitle: 'Reward Omzet Full Time', 
            icon: Award,
            badge: dailyBonusData?.days ? `${dailyBonusData.days.length} Hari` : null
          },
          { 
            id: 'products', 
            title: isBengkel ? 'Penjualan Part & Jasa' : isRetail ? 'Penjualan Barang' : isLaundry ? 'Layanan Cuci' : isRental ? 'Sewa Busana' : 'Penjualan Menu', 
            mobileTitle: isBengkel ? 'Part & Jasa' : isRetail ? 'Produk' : isLaundry ? 'Layanan' : isRental ? 'Busana' : 'Menu',
            subtitle: 'Best Seller & Laba', 
            icon: isBengkel ? Package : isRetail ? ShoppingBag : Utensils, 
            badge: totalQtySold > 0 ? `${totalQtySold} ${isCafe ? 'Porsi' : isLaundry ? 'Trx' : 'Item'}` : null
          },
          { 
            id: 'shifts_transactions', 
            title: 'Shift & Kasir', 
            mobileTitle: 'Shift & Kasir',
            subtitle: 'Audit Kas & Invoice', 
            icon: Users,
            badge: (reportData.shifts?.length || 0) > 0 ? `${reportData.shifts?.length} Shift` : null
          },
          { 
            id: 'inventory', 
            title: isBengkel ? 'Stok Sparepart' : isRetail ? 'Gudang & Stok' : isLaundry ? 'Bahan & Konsumabel' : 'Mutasi & Stok', 
            mobileTitle: 'Mutasi Stok',
            subtitle: 'Valuasi HPP & Kritis', 
            icon: Boxes,
            badge: (inventoryData.inventory?.length || 0) > 0 ? `${inventoryData.inventory?.length} ${isCafe ? 'Bahan' : 'Item'}` : null
          },
          { 
            id: 'accounting', 
            title: 'Keuangan (P&L)', 
            mobileTitle: 'Keuangan (P&L)',
            subtitle: 'Laba Rugi & Arus Kas', 
            icon: Receipt,
            badge: null
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 lg:p-3 rounded-xl sm:rounded-2xl transition-all cursor-pointer text-left border ${
                isSelected 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-600 shadow-md shadow-indigo-500/20' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
              }`}
            >
              <div 
                className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-purple-100/70 text-indigo-700'
                }`}
              >
                <Icon size={15} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" />
              </div>

              <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-[11px] sm:text-xs lg:text-[13px] leading-tight truncate">
                    <span className="sm:hidden">{tab.mobileTitle || tab.title}</span>
                    <span className="hidden sm:inline">{tab.title}</span>
                  </span>
                  {tab.badge && (
                    <span 
                      className={`text-[8.5px] sm:text-[9.5px] px-1.5 py-0.2 sm:py-0.5 rounded-full font-black shrink-0 whitespace-nowrap ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-purple-100 text-indigo-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`hidden sm:block text-[10px] lg:text-[11px] font-medium leading-tight truncate mt-0.5 ${
                  isSelected ? 'text-white/80' : 'text-slate-400'
                }`}>
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
      {/* ─────────────────────────────────────────────────────────────
          TAB 1: RINGKASAN EKSEKUTIF (DASHBOARD)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (() => {
        const totalRev = reportData.summary?.revenue || 0;
        const totalHpp = reportData.summary?.hpp || accountingData.profitLoss?.cogs || 0;
        const grossProf = totalRev - totalHpp;
        const netProf = accountingData.profitLoss?.netIncome ?? reportData.summary?.netIncome ?? grossProf;
        const grossMarginPct = totalRev > 0 ? Math.round((grossProf / totalRev) * 100) : 0;
        const netMarginPct = totalRev > 0 ? Math.round((netProf / totalRev) * 100) : 0;
        const hppRatioPct = totalRev > 0 ? Math.round((totalHpp / totalRev) * 100) : 0;

        // Safe category breakdown calculation
        const cb = reportData.categoryBreakdown;
        let foodStats = cb?.food;
        let drinkStats = cb?.drink;

        if (!foodStats || !drinkStats || typeof foodStats.revenue === 'undefined') {
          let fRev = 0, fQty = 0, fCost = 0;
          let dRev = 0, dQty = 0, dCost = 0;
          rawProducts.forEach((p: any) => {
            const cat = (p.category || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            const isDrink = cat.includes('minum') || cat.includes('drink') || cat.includes('beverage') || cat.includes('bevvies') || cat.includes('kopi') || cat.includes('coffee') || cat.includes('tea') || cat.includes('teh') || cat.includes('jus') || cat.includes('juice') || cat.includes('latte') || cat.includes('ice') || cat.includes('es ') || name.includes('kopi') || name.includes('tea') || name.includes('jus') || name.includes('drink');
            if (isDrink) {
              dRev += p.revenue || 0;
              dQty += p.qty || 0;
              dCost += p.cost || 0;
            } else {
              fRev += p.revenue || 0;
              fQty += p.qty || 0;
              fCost += p.cost || 0;
            }
          });
          const combined = fRev + dRev;
          foodStats = {
            revenue: fRev,
            qty: fQty,
            cost: fCost,
            profit: fRev - fCost,
            margin: fRev > 0 ? Math.round(((fRev - fCost) / fRev) * 100) : 0,
            percentage: combined > 0 ? Math.round((fRev / combined) * 100) : 0
          };
          drinkStats = {
            revenue: dRev,
            qty: dQty,
            cost: dCost,
            profit: dRev - dCost,
            margin: dRev > 0 ? Math.round(((dRev - dCost) / dRev) * 100) : 0,
            percentage: combined > 0 ? Math.round((dRev / combined) * 100) : 0
          };
        }

        const catBreakdown = {
          food: foodStats || { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 },
          drink: drinkStats || { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 },
          other: cb?.other || { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 }
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top 4 KPI Metrics with Margins & HPP Ratio (Symmetric 2-col Mobile Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              
              {/* Card 1: Total Omzet Gross */}
              <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[85px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Total Omzet</span>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <DollarSign size={14} className="sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                    {formatCurrency(totalRev)}
                  </div>
                  <div className="text-[9.5px] sm:text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center justify-between">
                    <span>{reportData.summary?.transactionsCount || 0} Transaksi</span>
                    <span className="font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded text-[8.5px] sm:text-[9.5px]">Basis 100%</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Laba Bersih Operasional */}
              <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between min-h-[85px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider truncate">Laba Bersih</span>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={14} className="sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-sm sm:text-xl lg:text-2xl font-black text-emerald-600 tracking-tight leading-tight truncate">
                    {formatCurrency(netProf)}
                  </div>
                  <div className="text-[9.5px] sm:text-xs text-emerald-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                    <span className="truncate">Setelah HPP & Kas</span>
                    <span className="bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 text-[8.5px] sm:text-[9.5px]">Margin {netMarginPct}%</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Total HPP Bahan Baku */}
              <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-200/80 shadow-xs flex flex-col justify-between min-h-[85px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider truncate">HPP Bahan</span>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <ShoppingBag size={14} className="sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-sm sm:text-xl lg:text-2xl font-black text-rose-600 tracking-tight leading-tight truncate">
                    {formatCurrency(totalHpp)}
                  </div>
                  <div className="text-[9.5px] sm:text-xs text-rose-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                    <span className="truncate">Biaya Bahan</span>
                    <span className="bg-rose-50 px-1 py-0.2 rounded border border-rose-200 text-[8.5px] sm:text-[9.5px]">Rasio {hppRatioPct}%</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Laba Kotor Menu */}
              <div className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[85px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Laba Kotor</span>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <Percent size={14} className="sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-sm sm:text-xl lg:text-2xl font-black text-sky-600 tracking-tight leading-tight truncate">
                    {formatCurrency(grossProf)}
                  </div>
                  <div className="text-[9.5px] sm:text-xs text-sky-700 font-semibold truncate mt-0.5 flex items-center justify-between">
                    <span className="truncate">Omzet - HPP</span>
                    <span className="bg-sky-50 px-1 py-0.2 rounded border border-sky-200 text-[8.5px] sm:text-[9.5px]">Margin {grossMarginPct}%</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION: ANALISIS OMZET & MARGIN MAKANAN VS MINUMAN
            ────────────────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3 sm:p-5 flex flex-col gap-2.5 sm:gap-4 shadow-xs">
              <div className="flex justify-between items-center flex-wrap gap-1 sm:gap-2">
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Sparkles size={16} className="text-purple-600 shrink-0" />
                    <h3 className="text-xs sm:text-base font-black text-slate-900 leading-tight">
                      Laporan Omzet & Margin: Makanan vs Minuman
                    </h3>
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-500 leading-relaxed block mt-0.5">
                    Perbandingan kontribusi omzet penjualan, porsi terjual, HPP bahan, dan persentase margin laba bersih per kategori
                  </span>
                </div>
              </div>

              {/* Visual Contribution Ratio Bar */}
              <div className="bg-slate-50 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-100">
                <div className="flex justify-between text-[10px] sm:text-xs font-bold mb-1.5">
                  <span className="text-amber-700 flex items-center gap-1">
                    <Utensils size={12} /> Makanan: {catBreakdown.food.percentage}% ({formatCurrency(catBreakdown.food.revenue)})
                  </span>
                  <span className="text-cyan-700 flex items-center gap-1">
                    <Coffee size={12} /> Minuman: {catBreakdown.drink.percentage}% ({formatCurrency(catBreakdown.drink.revenue)})
                  </span>
                </div>
                <div className="w-full h-2 sm:h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div style={{ width: `${Math.max(0, catBreakdown.food.percentage)}%` }} className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300" title={`Makanan: ${catBreakdown.food.percentage}%`} />
                  <div style={{ width: `${Math.max(0, catBreakdown.drink.percentage)}%` }} className="bg-gradient-to-r from-cyan-400 to-cyan-500 transition-all duration-300" title={`Minuman: ${catBreakdown.drink.percentage}%`} />
                </div>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                
                {/* 1. Makanan Card */}
                <div className="bg-amber-50/70 rounded-xl sm:rounded-2xl border border-amber-200/80 p-3 sm:p-4 flex flex-col gap-2 sm:gap-2.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Utensils size={15} />
                      </div>
                      <div>
                        <div className="font-black text-xs sm:text-sm text-amber-950 leading-tight">Kategori Makanan (Food)</div>
                        <div className="text-[10px] sm:text-xs text-amber-700/80">Ramen, Nasi, Bento & Snack</div>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-black text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                      Porsi: {catBreakdown.food.qty}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-1">
                    <div>
                      <div className="text-[9.5px] sm:text-[11px] text-amber-800 font-bold uppercase">Total Omzet Makanan</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-black text-amber-950 leading-tight">{formatCurrency(catBreakdown.food.revenue)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9.5px] sm:text-[11px] text-amber-800 font-bold uppercase">Laba Kotor</div>
                      <div className="text-sm sm:text-lg lg:text-xl font-black text-emerald-600 leading-tight">{formatCurrency(catBreakdown.food.profit)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-amber-200/70 text-[10px] sm:text-xs">
                    <div>
                      <span className="text-[9.5px] sm:text-[10.5px] text-slate-400 block">HPP Bahan Makanan:</span>
                      <strong className="text-xs sm:text-sm text-rose-600 font-black">{formatCurrency(catBreakdown.food.cost)}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] sm:text-[10.5px] text-slate-400 block">Margin Laba Makanan:</span>
                      <strong className="text-xs sm:text-sm text-amber-600 font-black">{catBreakdown.food.margin}%</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Minuman Card */}
                <div className="bg-cyan-50/70 rounded-xl sm:rounded-2xl border border-cyan-200/80 p-3 sm:p-4 flex flex-col gap-2 sm:gap-2.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                        <Coffee size={15} />
                      </div>
                      <div>
                        <div className="font-black text-xs sm:text-sm text-cyan-950 leading-tight">Kategori Minuman (Beverages)</div>
                        <div className="text-[10px] sm:text-xs text-cyan-700/80">Kopi, Teh, Jus & Mocktail</div>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-black text-cyan-800 bg-cyan-100/90 px-2 py-0.5 rounded-md border border-cyan-200">
                      Cup: {catBreakdown.drink.qty}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-1">
                    <div>
                      <div className="text-[9.5px] sm:text-[11px] text-cyan-800 font-bold uppercase">Total Omzet Minuman</div>
                      <div className="text-base sm:text-xl lg:text-2xl font-black text-cyan-950 leading-tight">{formatCurrency(catBreakdown.drink.revenue)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9.5px] sm:text-[11px] text-cyan-800 font-bold uppercase">Laba Kotor</div>
                      <div className="text-sm sm:text-lg lg:text-xl font-black text-emerald-600 leading-tight">{formatCurrency(catBreakdown.drink.profit)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-cyan-200/70 text-[10px] sm:text-xs">
                    <div>
                      <span className="text-[9.5px] sm:text-[10.5px] text-slate-400 block">HPP Bahan Minuman:</span>
                      <strong className="text-xs sm:text-sm text-rose-600 font-black">{formatCurrency(catBreakdown.drink.cost)}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[9.5px] sm:text-[10.5px] text-slate-400 block">Margin Laba Minuman:</span>
                      <strong className="text-xs sm:text-sm text-cyan-700 font-black">{catBreakdown.drink.margin}%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart & Payment Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              
              {/* Daily Multi-Series Chart with Mode Selector */}
              <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>
                      Tren Omzet, HPP & Laba Bersih Harian
                    </h3>
                    <span style={{ fontSize: '.75rem', color: '#64748b' }}>
                      Visualisasi perkembangan finansial dan perbandingan kategori per hari
                    </span>
                  </div>

                  {/* Chart View Selector Pills */}
                  <div style={{ display: 'flex', gap: '.3rem', background: '#f1f5f9', padding: '.25rem', borderRadius: '.6rem' }}>
                    {[
                      { id: 'all', label: '📊 Semua' },
                      { id: 'revenue', label: '📈 Omzet' },
                      { id: 'profit', label: '💰 Laba Bersih' },
                      { id: 'hpp', label: '📦 HPP' },
                      { id: 'category', label: '🍜 Makanan vs 🥤 Minuman' },
                    ].map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => setChartViewMode(btn.id as any)}
                        style={{
                          padding: '.35rem .65rem', borderRadius: '.45rem', border: 'none',
                          background: chartViewMode === btn.id ? 'white' : 'transparent',
                          color: chartViewMode === btn.id ? '#7c3aed' : '#64748b',
                          fontWeight: chartViewMode === btn.id ? 800 : 600, fontSize: '.72rem',
                          cursor: 'pointer', boxShadow: chartViewMode === btn.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.1s'
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: 280 }}>
                  {reportData.dailyTimeline?.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
                      Belum ada data transaksi pada rentang tanggal ini
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reportData.dailyTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorHpp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorMakanan" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorMinuman" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                        <Tooltip
                          contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '.75rem', color: '#0f172a', fontSize: '.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          formatter={(val: any, name: any) => {
                            const labelMap: Record<string, string> = {
                              total: '📈 Omzet Kotor',
                              profit: '💰 Laba Bersih',
                              hpp: '📦 HPP Bahan',
                              makanan: '🍜 Omzet Makanan',
                              minuman: '🥤 Omzet Minuman'
                            };
                            return [formatCurrency(Number(val)), labelMap[name] || name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '.75rem', paddingTop: '8px' }} />

                        {/* Conditional Series rendering according to chartViewMode */}
                        {(chartViewMode === 'all' || chartViewMode === 'revenue') && (
                          <Area type="monotone" name="total" dataKey="total" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                        )}
                        {(chartViewMode === 'all' || chartViewMode === 'profit') && (
                          <Area type="monotone" name="profit" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                        )}
                        {(chartViewMode === 'all' || chartViewMode === 'hpp') && (
                          <Area type="monotone" name="hpp" dataKey="hpp" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorHpp)" />
                        )}
                        {chartViewMode === 'category' && (
                          <>
                            <Area type="monotone" name="makanan" dataKey="makanan" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorMakanan)" />
                            <Area type="monotone" name="minuman" dataKey="minuman" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorMinuman)" />
                          </>
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Payment Method Distribution */}
              <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>Metode Pembayaran</h3>
                  <span style={{ fontSize: '.75rem', color: '#64748b' }}>Distribusi penerimaan kasir</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                  {[
                    { name: 'QRIS', icon: '📱', color: '#7c3aed', bg: '#f5f3ff', count: reportData.paymentMethods?.QRIS?.count || 0, amount: reportData.paymentMethods?.QRIS?.amount || 0 },
                    { name: 'Tunai (Cash)', icon: '💵', color: '#10b981', bg: '#f0fdf4', count: reportData.paymentMethods?.Tunai?.count || 0, amount: reportData.paymentMethods?.Tunai?.amount || 0 },
                    { name: 'Kartu Debit/Kredit', icon: '💳', color: '#0284c7', bg: '#f0f9ff', count: reportData.paymentMethods?.Kartu?.count || 0, amount: reportData.paymentMethods?.Kartu?.amount || 0 },
                    { name: 'Split Payment', icon: '✂️', color: '#f59e0b', bg: '#fffbeb', count: reportData.paymentMethods?.Split?.count || 0, amount: reportData.paymentMethods?.Split?.amount || 0 },
                  ].map((pm) => (
                    <div key={pm.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.75rem 1rem', borderRadius: '.75rem', background: pm.bg, border: `1px solid ${pm.color}22` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>{pm.icon}</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#0f172a' }}>{pm.name}</div>
                          <div style={{ fontSize: '.72rem', color: '#64748b' }}>{pm.count} Transaksi</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '.95rem', color: pm.color }}>
                        {formatCurrency(pm.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: LAPORAN PENJUALAN MENU & BEST SELLER
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="flex flex-col gap-3.5 sm:gap-5">
          
          {/* Top 3 Best Sellers Podium Cards */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Sparkles size={16} className="text-amber-500 shrink-0" />
                <h3 className="font-black text-sm sm:text-base text-slate-900">Top 3 Menu Terlaris (Best Seller)</h3>
              </div>
              <button
                onClick={() => setShowAiMenuModal(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-[11px] sm:text-xs shadow-md shadow-purple-900/20 hover:opacity-95 transition-all flex items-center justify-center gap-1.5 w-fit"
              >
                <Sparkles size={13} className="text-yellow-300" /> AI Menu & Profit Advisor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
              {topSellers.map((seller: any, idx: number) => {
                const badgeBorder = idx === 0 ? 'border-amber-400' : (idx === 1 ? 'border-slate-300' : 'border-amber-700/40');
                const badgeBg = idx === 0 ? 'bg-amber-50 text-amber-800' : (idx === 1 ? 'bg-slate-50 text-slate-700' : 'bg-orange-50 text-orange-800');
                const badgeText = idx === 0 ? '🥇 #1 Terlaris' : (idx === 1 ? '🥈 #2 Terlaris' : '🥉 #3 Terlaris');

                return (
                  <div
                    key={seller.name}
                    className={`bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col justify-between gap-2 sm:gap-3 border ${
                      idx === 0 ? 'border-amber-400 shadow-sm shadow-amber-200/50' : 'border-slate-200/80 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black border ${badgeBg} ${badgeBorder}`}>
                          {badgeText}
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {seller.category}
                        </span>
                      </div>

                      <div className="mt-1.5 sm:mt-2">
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">{seller.name}</h4>
                        <div className="flex justify-between items-baseline mt-1">
                          <span className="text-sm sm:text-lg font-black text-indigo-600">
                            {seller.qty} <span className="text-[10px] sm:text-xs font-normal text-slate-500">porsi</span>
                          </span>
                          <span className="text-xs sm:text-sm font-black text-emerald-600">
                            {formatCurrency(seller.revenue)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] sm:text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-500">Laba Kotor: <strong className="text-slate-700">{formatCurrency(seller.profit)}</strong></span>
                      <span className="text-indigo-700 font-black">Margin: {seller.margin}%</span>
                    </div>
                  </div>
                );
              })}
              {topSellers.length === 0 && (
                <div className="p-6 text-center text-slate-400 bg-white rounded-xl col-span-3 text-xs">
                  Belum ada transaksi penjualan menu.
                </div>
              )}
            </div>
          </div>

          {/* Summary & Category Sub-Recap Cards - 2 cols on mobile (2x2), 4 cols on desktop */}
          {(() => {
            let fRev = 0, fCost = 0, fQty = 0;
            let dRev = 0, dCost = 0, dQty = 0;
            rawProducts.forEach((p: any) => {
              const cat = (p.category || '').toLowerCase();
              const name = (p.name || '').toLowerCase();
              const isDrink = cat.includes('minum') || cat.includes('drink') || cat.includes('beverage') || cat.includes('bevvies') || cat.includes('kopi') || cat.includes('coffee') || cat.includes('tea') || cat.includes('teh') || cat.includes('jus') || cat.includes('juice') || cat.includes('latte') || cat.includes('ice') || cat.includes('es ') || name.includes('kopi') || name.includes('tea') || name.includes('jus') || name.includes('drink');
              if (isDrink) {
                dRev += p.revenue || 0;
                dCost += p.cost || 0;
                dQty += p.qty || 0;
              } else {
                fRev += p.revenue || 0;
                fCost += p.cost || 0;
                fQty += p.qty || 0;
              }
            });
            const fProfit = fRev - fCost;
            const dProfit = dRev - dCost;
            const fMargin = fRev > 0 ? Math.round((fProfit / fRev) * 100) : 0;
            const dMargin = dRev > 0 ? Math.round((dProfit / dRev) * 100) : 0;

            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
                {/* Total Porsi */}
                <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Total Porsi Terjual</span>
                  <div className="text-sm sm:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1 tracking-tight truncate">{totalQtySold} Porsi</div>
                  <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">
                    Rata-rata Margin: <strong className="text-indigo-600">{avgMargin}%</strong>
                  </div>
                </div>

                {/* Sub-Card Makanan */}
                <div className="bg-amber-50/70 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-amber-800 tracking-wider flex items-center gap-1 truncate">
                      <Utensils size={11} className="shrink-0" /> Makanan
                    </span>
                    <span className="text-[8.5px] sm:text-[10px] font-black text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded shrink-0">
                      Margin {fMargin}%
                    </span>
                  </div>
                  <div className="text-sm sm:text-2xl font-black text-amber-950 mt-0.5 sm:mt-1 tracking-tight truncate">{formatCurrency(fRev)}</div>
                  <div className="text-[9px] sm:text-xs text-amber-800 mt-0.5 truncate">{fQty} porsi • Laba {formatCurrency(fProfit)}</div>
                </div>

                {/* Sub-Card Minuman */}
                <div className="bg-cyan-50/70 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-cyan-200/80 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-cyan-800 tracking-wider flex items-center gap-1 truncate">
                      <Coffee size={11} className="shrink-0" /> Minuman
                    </span>
                    <span className="text-[8.5px] sm:text-[10px] font-black text-cyan-700 bg-cyan-200/60 px-1.5 py-0.5 rounded shrink-0">
                      Margin {dMargin}%
                    </span>
                  </div>
                  <div className="text-sm sm:text-2xl font-black text-cyan-950 mt-0.5 sm:mt-1 tracking-tight truncate">{formatCurrency(dRev)}</div>
                  <div className="text-[9px] sm:text-xs text-cyan-800 mt-0.5 truncate">{dQty} cup • Laba {formatCurrency(dProfit)}</div>
                </div>

                {/* Total Laba Menu */}
                <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Laba Kotor Menu</span>
                  <div className="text-sm sm:text-2xl font-black text-emerald-600 mt-0.5 sm:mt-1 tracking-tight truncate">{formatCurrency(totalMenuProfit)}</div>
                  <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">Total Omzet: {formatCurrency(totalMenuRevenue)}</div>
                </div>
              </div>
            );
          })()}

          {/* Search, Filter & Sort Bar */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-3.5 flex flex-col gap-2 sm:gap-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1 bg-slate-50 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-200/80 flex items-center gap-2">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="border-none bg-transparent outline-none text-xs text-slate-900 w-full placeholder:text-slate-400"
                />
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 justify-between sm:justify-start">
                <div className="flex items-center gap-1 text-[11px] sm:text-xs shrink-0">
                  <SlidersHorizontal size={13} />
                  <span>Urut:</span>
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <select
                    value={productSortKey}
                    onChange={(e) => setProductSortKey(e.target.value as any)}
                    className="flex-1 sm:flex-none px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-bold bg-white text-slate-700 outline-none"
                  >
                    <option value="qty">Porsi</option>
                    <option value="revenue">Omzet</option>
                    <option value="profit">Keuntungan</option>
                    <option value="margin">Margin %</option>
                  </select>
                  <select
                    value={productSortOrder}
                    onChange={(e) => setProductSortOrder(e.target.value as any)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-bold bg-white text-slate-700 outline-none"
                  >
                    <option value="desc">Tertinggi</option>
                    <option value="asc">Terendah</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {productCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setProductCategoryFilter(cat)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                    productCategoryFilter === cat
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Sales Table & Mobile Cards */}
          <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['RANK', 'NAMA MENU', 'KATEGORI', 'TERJUAL (QTY)', 'KONTRIBUSI OMZET', 'TOTAL HPP', 'KEUNTUNGAN', 'MARGIN (%)'].map((h) => (
                      <th key={h} style={{ padding: '.85rem 1rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 800, color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod: any, idx: number) => {
                    const percentOfTotal = totalMenuRevenue > 0 ? ((prod.revenue || 0) / totalMenuRevenue) * 100 : 0;
                    return (
                      <tr key={prod.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#94a3b8', fontSize: '.8rem' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#0f172a', fontSize: '.875rem' }}>
                          {prod.name}
                        </td>
                        <td style={{ padding: '.85rem 1rem' }}>
                          <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '.15rem .45rem', borderRadius: '.35rem' }}>
                            {prod.category}
                          </span>
                        </td>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 900, color: '#0f172a', fontSize: '.9rem' }}>
                          {prod.qty} <span style={{ fontSize: '.75rem', fontWeight: 500, color: '#64748b' }}>porsi</span>
                        </td>
                        <td style={{ padding: '.85rem 1rem' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '.85rem' }}>{formatCurrency(prod.revenue)}</div>
                          <div style={{ width: 100, height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(percentOfTotal, 100)}%`, height: '100%', background: '#7c3aed' }} />
                          </div>
                        </td>
                        <td style={{ padding: '.85rem 1rem', color: '#dc2626', fontWeight: 700, fontSize: '.85rem' }}>
                          {formatCurrency(prod.cost)}
                        </td>
                        <td style={{ padding: '.85rem 1rem', color: '#10b981', fontWeight: 800, fontSize: '.85rem' }}>
                          {formatCurrency(prod.profit)}
                        </td>
                        <td style={{ padding: '.85rem 1rem' }}>
                          <span style={{
                            padding: '.2rem .5rem', borderRadius: '.35rem', fontWeight: 800, fontSize: '.75rem',
                            background: prod.margin >= 60 ? '#f0fdf4' : (prod.margin >= 40 ? '#f5f3ff' : '#fffbeb'),
                            color: prod.margin >= 60 ? '#166534' : (prod.margin >= 40 ? '#7c3aed' : '#b45309')
                          }}>
                            {prod.margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        Tidak ada data penjualan menu untuk filter yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
                    <Utensils size={22} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800">Belum Ada Data Penjualan Menu</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada penjualan menu untuk filter atau tanggal yang dipilih.</p>
                </div>
              ) : (
                filteredProducts.map((prod: any, idx: number) => {
                  const percentOfTotal = totalMenuRevenue > 0 ? ((prod.revenue || 0) / totalMenuRevenue) * 100 : 0;
                  const rankClass = idx === 0 
                    ? 'bg-amber-500 text-white shadow-xs' 
                    : (idx === 1 
                      ? 'bg-slate-500 text-white' 
                      : (idx === 2 
                        ? 'bg-amber-700 text-white' 
                        : 'bg-slate-100 text-slate-600'));

                  return (
                    <div key={prod.name} className="p-4 space-y-3 bg-white hover:bg-slate-50/70 transition-all">
                      {/* Top Row: Rank, Menu Name, Category, Margin */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${rankClass}`}>
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-900 leading-tight">
                              {prod.name}
                            </h4>
                            <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/80 px-2 py-0.2 rounded-md mt-1">
                              {prod.category}
                            </span>
                          </div>
                        </div>

                        {/* Margin Badge */}
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          prod.margin >= 60 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : (prod.margin >= 40 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200')
                        }`}>
                          Margin {prod.margin}%
                        </span>
                      </div>

                      {/* 3-Col Metric Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Terjual</span>
                          <span className="font-black text-slate-900 block mt-0.5">{prod.qty} <span className="text-[10px] font-normal text-slate-500">porsi</span></span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Omzet</span>
                          <span className="font-bold text-slate-900 block mt-0.5 truncate">{formatCurrency(prod.revenue)}</span>
                          <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(percentOfTotal, 100)}%` }} />
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Keuntungan</span>
                          <span className="font-black text-emerald-600 block mt-0.5 truncate">{formatCurrency(prod.profit)}</span>
                          <span className="text-[9px] text-slate-400 block truncate">HPP: {formatCurrency(prod.cost)}</span>
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

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SHIFT & TRANSAKSI KASIR
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'shifts_transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub-toggle: Shifts vs Transactions */}
          <div className="flex flex-col sm:flex-row w-full sm:w-fit gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setShiftTxSubTab('shifts')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
                shiftTxSubTab === 'shifts'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User size={15} /> Rekapitulasi Shift Kasir ({reportData.shifts?.length || 0})
            </button>
            <button
              onClick={() => setShiftTxSubTab('transactions')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${
                shiftTxSubTab === 'transactions'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText size={15} /> Riwayat Invoice Transaksi ({transactionsData.length})
            </button>
          </div>

          {shiftTxSubTab === 'shifts' ? (
            <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['WAKTU TUTUP SHIFT', 'NAMA KASIR', 'SALDO AWAL LACI', 'TOTAL OMZET KAS', 'SALDO FISIK LACI', 'SELISIH KAS (AUDIT)', 'STATUS'].map((h) => (
                        <th key={h} style={{ padding: '.85rem 1rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 800, color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.shifts || []).map((s: any) => {
                      const isOpen = s.status === 'Open' || !s.waktuTutup;
                      const isBalanced = (s.selisih || 0) === 0;
                      const isShort = (s.selisih || 0) < 0;
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 700, color: '#0f172a', fontSize: '.82rem' }}>
                            {s.waktuTutup ? new Date(s.waktuTutup).toLocaleString('id-ID') : 'Masih Berjalan'}
                          </td>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#7c3aed', fontSize: '.85rem' }}>
                            {s.user?.name || s.user?.username || 'Kasir'}
                          </td>
                          <td style={{ padding: '.85rem 1rem', color: '#64748b', fontSize: '.82rem' }}>
                            {formatCurrency(s.saldoAwal)}
                          </td>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 700, color: '#0f172a', fontSize: '.82rem' }}>
                            {formatCurrency(s.saldoSistem || 0)}
                          </td>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#0f172a', fontSize: '.85rem' }}>
                            {isOpen ? <span className="text-slate-400 font-normal italic">-</span> : formatCurrency(s.saldoFisikLaci || 0)}
                          </td>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 900, fontSize: '.85rem', color: isOpen ? '#64748b' : (isBalanced ? '#10b981' : (isShort ? '#ef4444' : '#f59e0b')) }}>
                            {isOpen ? <span className="text-slate-400 font-normal italic">-</span> : (isBalanced ? 'Rp 0 (Pas)' : (s.selisih > 0 ? `+${formatCurrency(s.selisih)}` : formatCurrency(s.selisih)))}
                          </td>
                          <td style={{ padding: '.85rem 1rem' }}>
                            <span style={{
                              padding: '.2rem .5rem', borderRadius: '.35rem', fontSize: '.7rem', fontWeight: 800,
                              background: isOpen ? '#eff6ff' : (isBalanced ? '#f0fdf4' : (isShort ? '#fee2e2' : '#fffbeb')),
                              color: isOpen ? '#1d4ed8' : (isBalanced ? '#166534' : (isShort ? '#991b1b' : '#b45309'))
                            }}>
                              {isOpen ? '🟢 Shift Aktif' : (isBalanced ? '✅ Seimbang' : (isShort ? '❌ Minus (Shortage)' : '⚠️ Lebih (Overage)'))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(reportData.shifts || []).length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                          Belum ada shift kasir yang tercatat pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (< 768px) */}
              <div className="md:hidden divide-y divide-slate-100">
                {(reportData.shifts || []).length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
                      <Users size={22} />
                    </div>
                    <h4 className="text-xs font-black text-slate-800">Belum Ada Shift Kasir</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada shift kasir yang tercatat pada periode ini.</p>
                  </div>
                ) : (
                  (reportData.shifts || []).map((s: any) => {
                    const isOpen = s.status === 'Open' || !s.waktuTutup;
                    const isBalanced = (s.selisih || 0) === 0;
                    const isShort = (s.selisih || 0) < 0;
                    return (
                      <div key={s.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/70 transition-all">
                        {/* Top: Kasir name, time, status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                              <User size={16} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-900 leading-tight">
                                {s.user?.name || s.user?.username || 'Kasir'}
                              </h4>
                              <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                <Clock size={11} />
                                {s.waktuTutup ? new Date(s.waktuTutup).toLocaleString('id-ID') : 'Sedang Berjalan'}
                              </span>
                            </div>
                          </div>

                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isOpen
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : (isBalanced 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : (isShort 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200'))
                          }`}>
                            {isOpen ? '🟢 Shift Aktif' : (isBalanced ? '✅ Pas' : (isShort ? '❌ Minus' : '⚠️ Lebih'))}
                          </span>
                        </div>

                        {/* 4-Grid Financial Audit Box */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Saldo Awal</span>
                            <span className="font-bold text-slate-700 block mt-0.5">{formatCurrency(s.saldoAwal)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Omzet Sistem</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{formatCurrency(s.saldoSistem || 0)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Fisik Laci</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{isOpen ? '-' : formatCurrency(s.saldoFisikLaci || 0)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Selisih Audit</span>
                            <span className={`font-black block mt-0.5 ${isOpen ? 'text-slate-400' : (isBalanced ? 'text-emerald-600' : (isShort ? 'text-rose-600' : 'text-amber-600'))}`}>
                              {isOpen ? '-' : (isBalanced ? 'Rp 0 (Pas)' : (s.selisih > 0 ? `+${formatCurrency(s.selisih)}` : formatCurrency(s.selisih)))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['NO. ORDER', 'WAKTU', 'PELANGGAN', 'TIPE ORDER', 'METODE BAYAR', 'TOTAL BAYAR', 'STATUS'].map((h) => (
                        <th key={h} style={{ padding: '.85rem 1rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 800, color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsData.slice(0, 100).map((tx: any) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#7c3aed', fontSize: '.82rem' }}>
                          {tx.orderNumber || `#${tx.id}`}
                        </td>
                        <td style={{ padding: '.85rem 1rem', color: '#64748b', fontSize: '.78rem' }}>
                          {new Date(tx.createdAt).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 700, color: '#0f172a', fontSize: '.82rem' }}>
                          {tx.customerName || 'Pelanggan Umum'}
                        </td>
                        <td style={{ padding: '.85rem 1rem' }}>
                          <span style={{ fontSize: '.72rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '.15rem .45rem', borderRadius: '.35rem' }}>
                            {tx.orderType || 'Dine In'}
                          </span>
                        </td>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 700, color: '#0284c7', fontSize: '.82rem' }}>
                          {tx.paymentMethod || 'Tunai'}
                        </td>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 900, color: '#0f172a', fontSize: '.85rem' }}>
                          {formatCurrency(tx.total)}
                        </td>
                        <td style={{ padding: '.85rem 1rem' }}>
                          <span style={{ fontSize: '.7rem', fontWeight: 800, background: '#f0fdf4', color: '#166534', padding: '.2rem .5rem', borderRadius: '.35rem' }}>
                            Lunas
                          </span>
                        </td>
                      </tr>
                    ))}
                    {transactionsData.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                          Belum ada riwayat transaksi pada rentang tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (< 768px) */}
              <div className="md:hidden divide-y divide-slate-100">
                {transactionsData.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
                      <Receipt size={22} />
                    </div>
                    <h4 className="text-xs font-black text-slate-800">Belum Ada Transaksi</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada riwayat transaksi pada rentang tanggal ini.</p>
                  </div>
                ) : (
                  transactionsData.slice(0, 100).map((tx: any) => (
                    <div key={tx.id} className="p-4 space-y-2.5 bg-white hover:bg-slate-50/70 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-black text-xs text-indigo-700 block">
                            {tx.orderNumber || `#${tx.id}`}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {new Date(tx.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Lunas
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800">{tx.customerName || 'Pelanggan Umum'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {tx.orderType || 'Dine In'}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-100">
                            {tx.paymentMethod || 'Tunai'}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrency(tx.total)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: LAPORAN MUTASI & VALUASI STOK
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="flex flex-col gap-3.5 sm:gap-5">
          {/* KPI Summary Header Cards - 2 cols on mobile, 2 cols on desktop */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
            <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center gap-1">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Valuasi Aset Stok</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Boxes size={13} className="sm:w-[18px] sm:h-[18px]" />
                </div>
              </div>
              <div className="text-sm sm:text-2xl font-black text-slate-900 mt-1 tracking-tight truncate">
                {formatCurrency(inventoryData.summary?.totalAssetValuation)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">
                Total persediaan bahan baku
              </div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-rose-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center gap-1">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-rose-600 tracking-wider truncate">Bahan Kritis</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={13} className="sm:w-[18px] sm:h-[18px]" />
                </div>
              </div>
              <div className="text-sm sm:text-2xl font-black text-rose-600 mt-1 tracking-tight truncate">
                {inventoryData.summary?.criticalItemsCount || 0} Bahan
              </div>
              <div className="text-[9px] sm:text-xs text-rose-600/80 mt-0.5 truncate">
                Segera restock sebelum habis
              </div>
            </div>
          </div>

          {/* Search Box Bar */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 px-2.5 sm:px-4 py-1.5 sm:py-2.5 flex items-center gap-2 shadow-xs">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Cari nama bahan baku (Ayam, Kaldu, Shoyu, Nori)..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="w-full border-none outline-none bg-transparent text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
            />
            {inventorySearch && (
              <button
                onClick={() => setInventorySearch('')}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Inventory Table & Mobile Cards */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['NAMA BAHAN BAKU', 'SATUAN', 'STOK AWAL', 'MASUK (RESTOCK/PO)', 'KELUAR (PRODUKSI)', 'STOK AKHIR', 'STATUS', 'NILAI ASET'].map((h) => (
                      <th key={h} style={{ padding: '.85rem 1rem', textAlign: 'left', fontSize: '.68rem', fontWeight: 800, color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(inventoryData.inventory || [])
                    .filter((item: any) => !inventorySearch || item.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                    .map((item: any) => {
                      const isCritical = item.stockAkhir <= item.minStock;
                      return (
                        <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#0f172a', fontSize: '.85rem' }}>{item.name}</td>
                          <td style={{ padding: '.85rem 1rem', color: '#64748b', fontSize: '.8rem' }}>{item.unit}</td>
                          <td style={{ padding: '.85rem 1rem', fontSize: '.82rem' }}>{item.stockAwal?.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '.85rem 1rem', fontSize: '.82rem', color: '#10b981', fontWeight: 700 }}>+{item.masuk?.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '.85rem 1rem', fontSize: '.82rem', color: '#ef4444', fontWeight: 700 }}>-{item.keluarProduksi?.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 900, color: isCritical ? '#dc2626' : '#0f172a', fontSize: '.85rem' }}>
                            {item.stockAkhir?.toLocaleString('id-ID')}
                          </td>
                          <td style={{ padding: '.85rem 1rem' }}>
                            <span style={{
                              padding: '.2rem .5rem', borderRadius: '.35rem', fontSize: '.7rem', fontWeight: 800,
                              background: isCritical ? '#fee2e2' : '#f0fdf4',
                              color: isCritical ? '#991b1b' : '#166534'
                            }}>
                              {isCritical ? '⚠️ Kritis' : '🟢 Aman'}
                            </span>
                          </td>
                          <td style={{ padding: '.85rem 1rem', fontWeight: 800, color: '#10b981', fontSize: '.85rem' }}>
                            {formatCurrency(item.totalValuation)}
                          </td>
                        </tr>
                      );
                    })}
                  {(inventoryData.inventory || []).filter((item: any) => !inventorySearch || item.name.toLowerCase().includes(inventorySearch.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        Tidak ada bahan baku yang sesuai pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {(() => {
                const filteredItems = (inventoryData.inventory || []).filter(
                  (item: any) => !inventorySearch || item.name.toLowerCase().includes(inventorySearch.toLowerCase())
                );
                if (filteredItems.length === 0) {
                  return (
                    <div className="p-8 text-center flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
                        <Boxes size={22} />
                      </div>
                      <h4 className="text-xs font-black text-slate-800">Tidak Ada Bahan Baku</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada data stok yang sesuai dengan pencarian.</p>
                    </div>
                  );
                }
                return filteredItems.map((item: any) => {
                  const isCritical = item.stockAkhir <= item.minStock;
                  return (
                    <div key={item.name} className="p-3 space-y-2 bg-white hover:bg-slate-50/70 transition-all">
                      {/* Top: Name, Unit, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 leading-tight truncate">
                            {item.name}
                          </h4>
                          <span className="inline-block text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5">
                            Satuan: {item.unit}
                          </span>
                        </div>

                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border ${
                          isCritical
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isCritical ? '⚠️ Kritis' : '🟢 Aman'}
                        </span>
                      </div>

                      {/* 4-Col Stock Movement Grid */}
                      <div className="grid grid-cols-4 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                        <div className="p-1">
                          <span className="text-[8.5px] font-bold uppercase text-slate-400 block">Awal</span>
                          <span className="font-bold text-slate-700 text-xs block mt-0.5">
                            {item.stockAwal?.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="p-1">
                          <span className="text-[8.5px] font-bold uppercase text-slate-400 block">Masuk</span>
                          <span className="font-bold text-emerald-600 text-xs block mt-0.5">
                            +{item.masuk?.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="p-1">
                          <span className="text-[8.5px] font-bold uppercase text-slate-400 block">Keluar</span>
                          <span className="font-bold text-rose-600 text-xs block mt-0.5">
                            -{item.keluarProduksi?.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="p-1 bg-white rounded border border-slate-200/80 shadow-2xs">
                          <span className="text-[8.5px] font-black uppercase text-indigo-700 block">Sisa Akhir</span>
                          <span className={`font-black text-xs block mt-0.5 ${isCritical ? 'text-rose-600' : 'text-slate-900'}`}>
                            {item.stockAkhir?.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Asset Valuation */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="font-semibold text-slate-500">Nilai Aset Persediaan:</span>
                        <span className="font-black text-emerald-600">
                          {formatCurrency(item.totalValuation)}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: KEUANGAN & LABA RUGI (P&L)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'accounting' && (
        <div className="flex flex-col gap-3.5 sm:gap-5 items-center w-full">
          {/* Sub-tabs: P&L, Cashflow, Ledger */}
          <div className="grid grid-cols-3 gap-1 sm:flex sm:gap-2 bg-white p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs w-full max-w-[780px]">
            {[
              { id: 'pl', label: 'Laba Rugi (P&L)', icon: '📊' },
              { id: 'cashflow', label: 'Arus Kas', icon: '💵' },
              { id: 'ledger', label: 'Jurnal Umum', icon: '📖' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setAccountingSubTab(st.id as any)}
                className={`px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-center text-xs sm:text-sm font-black transition-all truncate ${
                  accountingSubTab === st.id
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className="truncate">{st.icon} {st.label}</span>
              </button>
            ))}
          </div>

          {/* Paper Style Financial Report Container */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3.5 sm:p-8 w-full max-w-[780px] shadow-sm">
            {accountingSubTab === 'pl' && (
              <div className="flex flex-col gap-3.5 sm:gap-5">
                <div className="text-center border-b-2 border-slate-900 pb-3 sm:pb-4">
                  <h3 className="font-black text-sm sm:text-lg text-slate-900">{posContext?.settings?.storeName || 'KAFE & RESTORAN'}</h3>
                  <h4 className="font-black text-xs sm:text-base text-indigo-700 mt-0.5">LAPORAN LABA RUGI OPERASIONAL</h4>
                  <span className="text-[10px] sm:text-xs text-slate-500">Periode: {startDate} s/d {endDate}</span>
                </div>

                {/* 1. Pendapatan */}
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-slate-800 border-b border-slate-200 pb-1.5 mb-2">
                    1. PENDAPATAN OPERASIONAL
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm py-1 text-slate-700">
                    <span>Penjualan Bersih Kasir</span>
                    <span className="font-bold text-slate-900">{formatCurrency(accountingData.profitLoss?.salesRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm py-1 text-slate-700">
                    <span>Pendapatan Lain-lain (Petty Cash Masuk)</span>
                    <span className="font-bold text-slate-900">{formatCurrency(accountingData.profitLoss?.otherRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm font-black text-indigo-700 border-t border-dashed border-slate-200 pt-1.5 mt-1">
                    <span>Total Pendapatan Operasional</span>
                    <span>{formatCurrency(accountingData.profitLoss?.operatingRevenue)}</span>
                  </div>
                </div>

                {/* 2. HPP */}
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-slate-800 border-b border-slate-200 pb-1.5 mb-2">
                    2. HARGA POKOK PENJUALAN (HPP)
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm py-1 text-rose-600">
                    <span>Beban Pokok Persediaan Bahan Baku (HPP)</span>
                    <span className="font-bold">-{formatCurrency(accountingData.profitLoss?.cogs)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm font-black text-rose-600 border-t border-dashed border-slate-200 pt-1.5 mt-1">
                    <span>Total Beban HPP</span>
                    <span>-{formatCurrency(accountingData.profitLoss?.cogs)}</span>
                  </div>
                </div>

                {/* Laba Kotor */}
                <div className="flex justify-between items-center text-xs sm:text-sm font-black bg-slate-50 p-2.5 sm:p-3.5 rounded-xl border border-slate-200">
                  <span className="text-slate-800">LABA KOTOR (GROSS PROFIT)</span>
                  <span className="text-emerald-600">{formatCurrency(accountingData.profitLoss?.grossProfit)}</span>
                </div>

                {/* 3. Beban OPEX */}
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-slate-800 border-b border-slate-200 pb-1.5 mb-2">
                    3. BEBAN OPERASIONAL (OPEX)
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm py-1 text-rose-600">
                    <span>Beban Kas Operasional & Petty Cash Keluar</span>
                    <span className="font-bold">-{formatCurrency(accountingData.profitLoss?.opexAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm font-black text-rose-600 border-t border-dashed border-slate-200 pt-1.5 mt-1">
                    <span>Total Beban Operasional</span>
                    <span>-{formatCurrency(accountingData.profitLoss?.operatingExpenses)}</span>
                  </div>
                </div>

                {/* Laba Bersih */}
                <div className="flex justify-between items-center text-xs sm:text-base font-black bg-emerald-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-emerald-200 text-emerald-800">
                  <span>LABA BERSIH OPERASIONAL (NET INCOME)</span>
                  <span>{formatCurrency(accountingData.profitLoss?.netIncome)}</span>
                </div>
              </div>
            )}

            {accountingSubTab === 'cashflow' && (
              <div className="flex flex-col gap-3.5 sm:gap-5">
                <div className="text-center border-b-2 border-slate-900 pb-3 sm:pb-4">
                  <h3 className="font-black text-sm sm:text-lg text-slate-900">{posContext?.settings?.storeName || 'KAFE & RESTORAN'}</h3>
                  <h4 className="font-black text-xs sm:text-base text-emerald-700 mt-0.5">LAPORAN ARUS KAS (CASH FLOW)</h4>
                  <span className="text-[10px] sm:text-xs text-slate-500">Periode: {startDate} s/d {endDate}</span>
                </div>

                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-emerald-800 border-b border-emerald-200 pb-1.5 mb-2">
                    ARUS KAS MASUK (INFLOW)
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm py-1 text-slate-700">
                    <span>Penerimaan Kas Penjualan Kasir</span>
                    <span className="font-bold text-slate-900">{formatCurrency(accountingData.cashFlow?.inflow?.salesReceipts)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm font-black text-emerald-700 border-t border-dashed border-emerald-200 pt-1.5 mt-1">
                    <span>Total Kas Masuk</span>
                    <span>{formatCurrency(accountingData.cashFlow?.inflow?.total)}</span>
                  </div>
                </div>

                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-rose-800 border-b border-rose-200 pb-1.5 mb-2">
                    ARUS KAS KELUAR (OUTFLOW)
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm py-1 text-rose-600">
                    <span>Pengeluaran Petty Cash & Operasional</span>
                    <span className="font-bold">-{formatCurrency(accountingData.cashFlow?.outflow?.opexPayments)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm font-black text-rose-600 border-t border-dashed border-rose-200 pt-1.5 mt-1">
                    <span>Total Kas Keluar</span>
                    <span>-{formatCurrency(accountingData.cashFlow?.outflow?.total)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs sm:text-base font-black bg-emerald-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-emerald-200 text-emerald-800">
                  <span>KENAIKAN / (PENURUNAN) KAS BERSIH</span>
                  <span>{formatCurrency(accountingData.cashFlow?.netCashFlow)}</span>
                </div>
              </div>
            )}

            {accountingSubTab === 'ledger' && (
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="text-center border-b-2 border-slate-900 pb-3 sm:pb-4">
                  <h3 className="font-black text-sm sm:text-lg text-slate-900">{posContext?.settings?.storeName || 'KAFE & RESTORAN'}</h3>
                  <h4 className="font-black text-xs sm:text-base text-indigo-700 mt-0.5">BUKU JURNAL UMUM (DOUBLE ENTRY)</h4>
                  <span className="text-[10px] sm:text-xs text-slate-500">Periode: {startDate} s/d {endDate}</span>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-0.5">
                  {(accountingData.journals || []).slice(0, 30).map((j: any, idx: number) => (
                    <div key={idx} className="bg-slate-50/80 rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-3.5">
                      {/* Top Row: Date, Ref, Description (Clean Wrapping) */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 mb-2 border-b border-slate-200 text-[11px] sm:text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-500">{new Date(j.date).toLocaleString('id-ID')}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                            Ref: {j.reference}
                          </span>
                        </div>
                        <span className="font-bold text-slate-800 truncate">{j.description}</span>
                      </div>

                      {/* Journal Lines */}
                      {j.lines?.map((line: any, lidx: number) => (
                        <div key={lidx} className="flex items-center justify-between text-xs py-1">
                          <span className={`text-[11px] sm:text-xs truncate ${line.credit > 0 ? 'pl-3 sm:pl-6 text-slate-500 font-medium' : 'text-slate-900 font-bold'}`}>
                            {line.account}
                          </span>
                          <span className={`text-xs font-black shrink-0 ${line.credit > 0 ? 'text-slate-700' : 'text-indigo-900'}`}>
                            {line.debit > 0 ? formatCurrency(line.debit) : formatCurrency(line.credit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {(accountingData.journals || []).length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">Belum ada catatan jurnal pada periode ini.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB: BAGI HASIL (80:20) - RAMEN VS MINUMAN & OWNER
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'profit_sharing' && (() => {
        const ps = profitSharingData;
        if (!ps) {
          return (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400">
              <Percent className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold">Memuat data bagi hasil...</p>
            </div>
          );
        }
        const daily = ps.dailyBreakdown || [];
        const div1Label = ps?.div1Title || (
          isBengkel ? 'Divisi Jasa Servis & Mekanik' :
          isRetail ? 'Divisi Retail & Eceran' :
          isLaundry ? 'Divisi Laundry Kiloan' :
          isRental ? 'Divisi Sewa Busana' :
          'Divisi Makanan (Kitchen)'
        );
        const div1PjLabel = ps?.div1Pj || (
          isBengkel ? 'PJ Servis' :
          isRetail ? 'PJ Retail' :
          isLaundry ? 'PJ Kiloan' :
          isRental ? 'PJ Busana' :
          'PJ Makanan'
        );
        const div1Icon = isBengkel ? '🔧' : isRetail ? '📦' : isLaundry ? '🧺' : isRental ? '👘' : '🍜';

        const div2Label = ps?.div2Title || (
          isBengkel ? 'Divisi Suku Cadang & Pelumas' :
          isRetail ? 'Divisi Grosir & Partai' :
          isLaundry ? 'Divisi Laundry Satuan & Dry Clean' :
          isRental ? 'Divisi Aksesoris & Rias' :
          'Divisi Minuman (Bar)'
        );
        const div2PjLabel = ps?.div2Pj || (
          isBengkel ? 'PJ Sparepart' :
          isRetail ? 'PJ Grosir' :
          isLaundry ? 'PJ Satuan' :
          isRental ? 'PJ Aksesoris' :
          'PJ Minuman'
        );
        const div2Icon = isBengkel ? '⚙️' : isRetail ? '🛒' : isLaundry ? '👔' : isRental ? '✨' : '🍹';
        const div3Label = ps?.div3Title || 'Produk Netral / Retail';

        return (
          <div className="flex flex-col gap-3.5 sm:gap-5">
            {/* Header Strategy Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <Percent className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Bagi Hasil Usaha
                    </span>
                    <span className="text-[10.5px] sm:text-xs text-slate-300">
                      Mode OPEX: <strong className="text-amber-300 uppercase">{ps.opexMode === 'SHARED_BEFORE_SPLIT' ? 'Dipotong Bersama' : ps.opexMode === 'SPLIT_50_50' ? 'Bagi 50:50' : 'Owner'}</strong>
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-lg font-black text-white mt-1 leading-snug truncate">
                    Rekapitulasi Bagi Hasil {posContext?.settings?.storeName || (isBengkel ? 'Bengkel & Servis' : isRetail ? 'Toko Retail & Grosir' : isLaundry ? 'Laundry Express' : isRental ? 'Sanggar Sewa Busana' : 'Restoran & Bar')}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    Periode: <span className="text-white font-bold">{startDate} s/d {endDate}</span> • Formula: Laba Bersih = Omzet - Belanja Modal/Bahan
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto items-center">
                <button
                  onClick={() => handleGeneratePdf('profit_sharing')}
                  disabled={exportingPdf}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] sm:text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} className="shrink-0" /> PDF Bagi Hasil
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[11px] sm:text-xs font-bold text-white shadow-md shadow-emerald-900/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet size={13} className="shrink-0" /> Export Excel
                </button>
              </div>
            </div>

            {/* 5 Top KPI Cards - 2 cols on mobile with centered net profit, 5 cols on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3.5">
              {/* Omzet Gabungan */}
              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Total Omzet</span>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={13} />
                  </div>
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 tracking-tight truncate">{formatCurrency(ps.grandTotalRevenue)}</div>
                  <div className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 flex flex-col sm:flex-row sm:justify-between gap-0.5">
                    <span className="truncate">{div1PjLabel}: {formatCurrency(ps.food.revenue)}</span>
                    <span className="truncate">{div2PjLabel}: {formatCurrency(ps.drink.revenue)}</span>
                  </div>
                </div>
              </div>

              {/* Belanja & OPEX */}
              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Pengeluaran</span>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <ArrowDownRight size={13} />
                  </div>
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-xs sm:text-lg lg:text-xl font-black text-rose-600 tracking-tight truncate">{formatCurrency(ps.grandTotalExpense)}</div>
                  <div className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
                    Belanja: {formatCurrency(ps.food.expense + ps.drink.expense)} | OPEX: {formatCurrency(ps.sharedOpexTotal)}
                  </div>
                </div>
              </div>

              {/* Laba Bersih Total (Span 2 cols on mobile, 1 col on desktop) */}
              <div className="col-span-2 lg:col-span-1 bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Laba Bersih Bersama</span>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <DollarSign size={13} />
                  </div>
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className={`text-sm sm:text-lg lg:text-xl font-black tracking-tight ${ps.grandTotalNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(ps.grandTotalNetProfit)}
                  </div>
                  <div className="text-[9.5px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1">
                    Margin Bersih: {ps.grandTotalRevenue > 0 ? Math.round((ps.grandTotalNetProfit / ps.grandTotalRevenue) * 100) : 0}% dari Total Omzet
                  </div>
                </div>
              </div>

              {/* Hak Bagian Owner */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-700 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-md flex flex-col justify-between">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-black uppercase text-indigo-100 tracking-wider truncate">Hak Owner</span>
                  <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[8.5px] sm:text-[10px] font-black shrink-0">Laba Bersih</span>
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-xs sm:text-lg lg:text-xl font-black text-white tracking-tight truncate">{formatCurrency(ps.totalOwnerShare)}</div>
                  <div className="text-[9px] sm:text-[11px] text-indigo-100/90 mt-0.5 sm:mt-1 truncate">
                    {div1PjLabel}: {formatCurrency(ps.food.ownerShare)} + {div2PjLabel}: {formatCurrency(ps.drink.ownerShare)}
                  </div>
                </div>
              </div>

              {/* Hak Bagian Tim PJ */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-md flex flex-col justify-between">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-black uppercase text-emerald-100 tracking-wider truncate">Hak Tim PJ</span>
                  <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[8.5px] sm:text-[10px] font-black shrink-0">Operasional</span>
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-xs sm:text-lg lg:text-xl font-black text-white tracking-tight truncate">{formatCurrency(ps.totalPjShare)}</div>
                  <div className="text-[9px] sm:text-[11px] text-emerald-100/90 mt-0.5 sm:mt-1 truncate">
                    {div1PjLabel}: {formatCurrency(ps.food.pjShare)} | {div2PjLabel}: {formatCurrency(ps.drink.pjShare)}
                  </div>
                </div>
              </div>
            </div>

            {/* Division Comparison Breakdown Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* Divisi 1 */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm sm:text-base shrink-0">
                        {div1Icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">{div1Label}</h4>
                        <span className="text-[10px] sm:text-xs text-slate-400 block truncate">Penanggung Jawab: Bagi Hasil {ps.food.profitSharingPct}%</span>
                      </div>
                    </div>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-orange-50 text-orange-700 border border-orange-200 shrink-0">
                      {div1PjLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3 my-2.5 sm:my-4">
                    <div className="p-2 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-100">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold block truncate">Omzet {div1PjLabel}</span>
                      <span className="text-xs sm:text-base font-black text-slate-800 tracking-tight block truncate">{formatCurrency(ps.food.revenue)}</span>
                    </div>
                    <div className="p-2 sm:p-3 bg-rose-50/50 rounded-lg sm:rounded-xl border border-rose-100">
                      <span className="text-[10px] sm:text-[11px] text-rose-600 font-bold block truncate">Belanja Modal / Bahan</span>
                      <span className="text-xs sm:text-base font-black text-rose-700 tracking-tight block truncate">-{formatCurrency(ps.food.expense)}</span>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3.5 bg-slate-100/70 rounded-xl sm:rounded-2xl flex justify-between items-center mb-2.5 sm:mb-4">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">Laba Bersih {div1Label}</span>
                    <span className="text-xs sm:text-base font-black text-indigo-900">{formatCurrency(ps.food.finalNet)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-100">
                  <div className="p-2 sm:p-3 bg-indigo-50/70 rounded-lg sm:rounded-xl border border-indigo-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 truncate">Owner ({ps.food.ownerPct}%)</span>
                      <span className="text-[9px] sm:text-[10px] bg-indigo-200/60 text-indigo-800 px-1 sm:px-1.5 py-0.5 rounded font-bold shrink-0">Owner</span>
                    </div>
                    <div className="text-xs sm:text-base font-black text-indigo-900 mt-1 truncate">{formatCurrency(ps.food.ownerShare)}</div>
                  </div>
                  <div className="p-2 sm:p-3 bg-emerald-50/70 rounded-lg sm:rounded-xl border border-emerald-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 truncate">{div1PjLabel} ({ps.food.profitSharingPct}%)</span>
                      <span className="text-[9px] sm:text-[10px] bg-emerald-200/60 text-emerald-800 px-1 sm:px-1.5 py-0.5 rounded font-bold shrink-0">PJ Tim</span>
                    </div>
                    <div className="text-xs sm:text-base font-black text-emerald-900 mt-1 truncate">{formatCurrency(ps.food.pjShare)}</div>
                  </div>
                </div>
              </div>

              {/* Divisi 2 */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center font-black text-sm sm:text-base shrink-0">
                        {div2Icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">{div2Label}</h4>
                        <span className="text-[10px] sm:text-xs text-slate-400 block truncate">Penanggung Jawab: Bagi Hasil {ps.drink.profitSharingPct}%</span>
                      </div>
                    </div>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200 shrink-0">
                      {div2PjLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3 my-2.5 sm:my-4">
                    <div className="p-2 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-100">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold block truncate">Omzet {div2PjLabel}</span>
                      <span className="text-xs sm:text-base font-black text-slate-800 tracking-tight block truncate">{formatCurrency(ps.drink.revenue)}</span>
                    </div>
                    <div className="p-2 sm:p-3 bg-rose-50/50 rounded-lg sm:rounded-xl border border-rose-100">
                      <span className="text-[10px] sm:text-[11px] text-rose-600 font-bold block truncate">Belanja Modal / Bahan</span>
                      <span className="text-xs sm:text-base font-black text-rose-700 tracking-tight block truncate">-{formatCurrency(ps.drink.expense)}</span>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3.5 bg-slate-100/70 rounded-xl sm:rounded-2xl flex justify-between items-center mb-2.5 sm:mb-4">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">Laba Bersih {div2Label}</span>
                    <span className="text-xs sm:text-base font-black text-cyan-900">{formatCurrency(ps.drink.finalNet)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-100">
                  <div className="p-2 sm:p-3 bg-indigo-50/70 rounded-lg sm:rounded-xl border border-indigo-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 truncate">Owner ({ps.drink.ownerPct}%)</span>
                      <span className="text-[9px] sm:text-[10px] bg-indigo-200/60 text-indigo-800 px-1 sm:px-1.5 py-0.5 rounded font-bold shrink-0">Owner</span>
                    </div>
                    <div className="text-xs sm:text-base font-black text-indigo-900 mt-1 truncate">{formatCurrency(ps.drink.ownerShare)}</div>
                  </div>
                  <div className="p-2 sm:p-3 bg-emerald-50/70 rounded-lg sm:rounded-xl border border-emerald-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 truncate">{div2PjLabel} ({ps.drink.profitSharingPct}%)</span>
                      <span className="text-[9px] sm:text-[10px] bg-emerald-200/60 text-emerald-800 px-1 sm:px-1.5 py-0.5 rounded font-bold shrink-0">PJ Tim</span>
                    </div>
                    <div className="text-xs sm:text-base font-black text-emerald-900 mt-1 truncate">{formatCurrency(ps.drink.pjShare)}</div>
                  </div>
                </div>
              </div>

              {/* Divisi 3: Produk Netral / Lainnya */}
              {ps.other && (ps.other.revenue > 0 || ps.other.expense > 0) && (
                <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between lg:col-span-2">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm sm:text-base shrink-0">
                          💧
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">{div3Label}</h4>
                          <span className="text-[10px] sm:text-xs text-slate-400 block truncate">100% Hak Owner / Kas Usaha (Tanpa Bagi Hasil PJ)</span>
                        </div>
                      </div>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                        Owner
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 my-2.5 sm:my-4">
                      <div className="p-2 sm:p-3 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-100">
                        <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold block truncate">Omzet {div3Label}</span>
                        <span className="text-xs sm:text-base font-black text-slate-800 tracking-tight block truncate">{formatCurrency(ps.other.revenue)}</span>
                      </div>
                      <div className="p-2 sm:p-3 bg-rose-50/50 rounded-lg sm:rounded-xl border border-rose-100">
                        <span className="text-[10px] sm:text-[11px] text-rose-600 font-bold block truncate">Belanja Modal / HPP</span>
                        <span className="text-xs sm:text-base font-black text-rose-700 tracking-tight block truncate">-{formatCurrency(ps.other.expense)}</span>
                      </div>
                      <div className="p-2 sm:p-3 bg-indigo-50/70 rounded-lg sm:rounded-xl border border-indigo-100">
                        <span className="text-[10px] sm:text-[11px] text-indigo-700 font-bold block truncate">Laba Bersih Masuk ke Owner (100%)</span>
                        <span className="text-xs sm:text-base font-black text-indigo-900 tracking-tight block truncate">{formatCurrency(ps.other.finalNet)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-slate-900 text-sm sm:text-base">Tabel Rincian Harian Bagi Hasil</h4>
                  <p className="text-[10px] sm:text-xs text-slate-500">Omzet, Belanja Modal & Alokasi Bagi Hasil Per Hari</p>
                </div>
                <span className="text-[10px] sm:text-xs bg-slate-100 text-slate-600 px-2.5 sm:px-3 py-1 rounded-lg font-bold w-fit">
                  {daily.length} Hari Transaksi
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 rounded-l-xl">Tanggal</th>
                      <th className="p-3 text-right">Omzet {div1PjLabel}</th>
                      <th className="p-3 text-right">Belanja {div1PjLabel}</th>
                      <th className="p-3 text-right">Laba {div1PjLabel}</th>
                      <th className="p-3 text-right">Omzet {div2PjLabel}</th>
                      <th className="p-3 text-right">Belanja {div2PjLabel}</th>
                      <th className="p-3 text-right">Laba {div2PjLabel}</th>
                      <th className="p-3 text-right text-rose-600">OPEX Bersama</th>
                      <th className="p-3 text-right text-indigo-700">Laba Bersih</th>
                      <th className="p-3 text-right text-indigo-800">Owner ({ps.food.ownerPct}%)</th>
                      <th className="p-3 text-right text-emerald-700">{div1PjLabel} ({ps.food.profitSharingPct}%)</th>
                      <th className="p-3 text-right text-emerald-700 rounded-r-xl">{div2PjLabel} ({ps.drink.profitSharingPct}%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {daily.map((d: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 font-medium">
                        <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{d.date}</td>
                        <td className="p-3 text-right">{formatCurrency(d.foodRevenue)}</td>
                        <td className="p-3 text-right text-rose-600">-{formatCurrency(d.foodExpense)}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(d.foodNet)}</td>
                        <td className="p-3 text-right">{formatCurrency(d.drinkRevenue)}</td>
                        <td className="p-3 text-right text-rose-600">-{formatCurrency(d.drinkExpense)}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(d.drinkNet)}</td>
                        <td className="p-3 text-right text-rose-600">-{formatCurrency(d.sharedOpex)}</td>
                        <td className="p-3 text-right font-black text-indigo-900 bg-indigo-50/30">{formatCurrency(d.totalNetProfit)}</td>
                        <td className="p-3 text-right font-bold text-indigo-700 bg-indigo-50/50">{formatCurrency(d.ownerShare)}</td>
                        <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/40">{formatCurrency(d.pjFoodShare)}</td>
                        <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/40">{formatCurrency(d.pjDrinkShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-black text-xs">
                    <tr>
                      <td className="p-3 rounded-l-xl">TOTAL</td>
                      <td className="p-3 text-right">{formatCurrency(ps.food.revenue)}</td>
                      <td className="p-3 text-right text-rose-300">-{formatCurrency(ps.food.expense)}</td>
                      <td className="p-3 text-right">{formatCurrency(ps.food.grossNet)}</td>
                      <td className="p-3 text-right">{formatCurrency(ps.drink.revenue)}</td>
                      <td className="p-3 text-right text-rose-300">-{formatCurrency(ps.drink.expense)}</td>
                      <td className="p-3 text-right">{formatCurrency(ps.drink.grossNet)}</td>
                      <td className="p-3 text-right text-rose-300">-{formatCurrency(ps.sharedOpexTotal)}</td>
                      <td className="p-3 text-right text-emerald-400">{formatCurrency(ps.grandTotalNetProfit)}</td>
                      <td className="p-3 text-right text-indigo-300">{formatCurrency(ps.totalOwnerShare)}</td>
                      <td className="p-3 text-right text-emerald-300">{formatCurrency(ps.food.pjShare)}</td>
                      <td className="p-3 text-right text-emerald-300 rounded-r-xl">{formatCurrency(ps.drink.pjShare)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          TAB: BONUS & ABSENSI STAF
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'daily_bonus' && (() => {
        const isStaff = (u: any) => {
          const role = (u?.role || '').toLowerCase();
          const uname = (u?.username || '').toLowerCase();
          const name = (u?.name || '').toLowerCase();
          return !['admin', 'super admin', 'superadmin', 'owner'].includes(role) &&
                 !['admin', 'superadmin', 'owner'].includes(uname) &&
                 name !== 'super admin';
        };

        const days = dailyBonusData?.days || [];
        const rawEmployees = dailyBonusData?.employees || dailyBonusData?.employeeSummaries || [];
        const employees = rawEmployees.filter(isStaff);
        const rawSummaries = dailyBonusData?.employeeSummaries || [];
        const employeeSummaries = rawSummaries.filter(isStaff);
        const tiers = dailyBonusData?.tiers || dailyBonusData?.tiersConfig || [];

        const totalBonusAll = dailyBonusData?.totalBonusAll ?? days.reduce((sum: number, d: any) => sum + (d.tierBonus || 0), 0);
        const daysHitTier = days.filter((d: any) => Boolean(d.matchedTier || d.tierReached)).length;

        return (
          <div className="flex flex-col gap-3.5 sm:gap-5">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
                  <Award className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30">
                      Reward Target Omzet
                    </span>
                    <span className="text-[10.5px] sm:text-xs text-amber-100">
                      Khusus Crew <strong>Full-Time</strong> (Hadir / Terlambat)
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-lg font-black text-white mt-1 leading-snug truncate">
                    Matriks Kehadiran & Bonus Omzet Harian
                  </h3>
                  <p className="text-[10px] sm:text-xs text-amber-100 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    Periode: <span className="text-white font-bold">{startDate} s/d {endDate}</span> • Staf DW: Tag DW (Rp 0 Bonus)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto items-center">
                <button
                  onClick={() => handleGeneratePdf('daily_bonus')}
                  disabled={exportingPdf}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-[11px] sm:text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer size={13} className="shrink-0" /> PDF Matriks
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[11px] sm:text-xs font-bold text-white shadow-md shadow-emerald-950/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet size={13} className="shrink-0" /> Export Excel
                </button>
              </div>
            </div>

            {/* Tier Levels Legend */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col gap-2 sm:gap-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-1">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Flame size={13} className="text-amber-500 shrink-0" /> Skema Range Tier Target Omzet Harian
                </span>
                <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium">Diatur pada Menu Settings &gt; Bagi Hasil & Bonus</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
                {tiers.map((t: any, idx: number) => {
                  const isOddLast = idx === tiers.length - 1 && tiers.length % 2 !== 0;
                  return (
                    <div
                      key={idx}
                      className={`p-2 sm:p-2.5 bg-amber-50/60 rounded-lg sm:rounded-xl border border-amber-200/70 flex flex-col justify-between ${
                        isOddLast ? 'col-span-2 sm:col-span-1' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-amber-800">Tier {t?.tier ?? (idx + 1)}</span>
                        <span className="text-[9.5px] sm:text-[10px] font-extrabold text-amber-600 truncate">≥ {formatCurrency(t?.minOmzet || 0)}</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-amber-900 mt-1 truncate">
                        +{formatCurrency(t?.bonus || t?.bonusPerStaff || 0)} <span className="text-[9px] sm:text-[10px] font-normal text-amber-700">/ crew</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4 Summary Metric Cards - 2 cols on mobile (2x2), 4 cols on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Total Hari Dihitung</span>
                <div className="text-sm sm:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1 tracking-tight truncate">{days.length} Hari</div>
                <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">Rentang {startDate} s/d {endDate}</div>
              </div>

              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Hari Capai Target</span>
                <div className="text-sm sm:text-2xl font-black text-emerald-600 mt-0.5 sm:mt-1 tracking-tight truncate">{daysHitTier} Hari</div>
                <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">
                  {days.length > 0 ? Math.round((daysHitTier / days.length) * 100) : 0}% Target Tercapai
                </div>
              </div>

              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Bonus Terdistribusi</span>
                <div className="text-sm sm:text-2xl font-black text-amber-600 mt-0.5 sm:mt-1 tracking-tight truncate">{formatCurrency(totalBonusAll)}</div>
                <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">Semua staf Full-Time</div>
              </div>

              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <span className="text-[9.5px] sm:text-[11px] font-extrabold uppercase text-slate-400 tracking-wider truncate">Rata-rata Bonus / Hari</span>
                <div className="text-sm sm:text-2xl font-black text-indigo-600 mt-0.5 sm:mt-1 tracking-tight truncate">
                  {formatCurrency(daysHitTier > 0 ? Math.round(totalBonusAll / daysHitTier) : 0)}
                </div>
                <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">Pada hari tembus target</div>
              </div>
            </div>

            {/* Matriks Harian Bonus Staf */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col gap-2.5 sm:gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                <div>
                  <h4 className="font-black text-slate-900 text-sm sm:text-base">Matriks Harian Kehadiran & Bonus Per Karyawan</h4>
                  <p className="text-[10px] sm:text-xs text-slate-500">Persis format lembar matriks owner: Status Hadir/Libur & Nominal Bonus</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 rounded-l-xl">Tanggal</th>
                      <th className="p-3 text-right">Omzet Harian</th>
                      <th className="p-3 text-center">Tier Target</th>
                      {employees.map((emp: any, i: number) => (
                        <th key={i} className="p-3 text-center whitespace-nowrap">
                          {emp?.name || emp?.username}
                          {emp?.employmentType === 'DAILY_WORKER' && <span className="ml-1 text-[9px] text-amber-600 font-bold">(DW)</span>}
                        </th>
                      ))}
                      <th className="p-3 text-right rounded-r-xl">Total Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {days.map((d: any, idx: number) => {
                      const tierObj = d.matchedTier || d.tierReached;
                      const hit = Boolean(tierObj);
                      const dayGross = d.grossOmzet ?? d.totalOmzet ?? 0;
                      let dayTotalBonus = 0;

                      return (
                        <tr key={idx} className={`hover:bg-slate-50/80 font-medium ${hit ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{d.date}</td>
                          <td className="p-3 text-right font-black text-slate-900">{formatCurrency(dayGross)}</td>
                          <td className="p-3 text-center">
                            {hit && tierObj ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                {tierObj.label || `Tier ${tierObj.tier ?? (idx + 1)}`} (+{formatCurrency(tierObj.bonus ?? tierObj.bonusPerStaff ?? d.tierBonus ?? 0)})
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">-</span>
                            )}
                          </td>
                          {employees.map((emp: any, i: number) => {
                            const empId = emp.userId || emp.id;
                            const att = d.employeeAttendance?.[empId];
                            const isDW = emp.employmentType === 'DAILY_WORKER';
                            const status = att?.status || 'LIBUR';
                            const isPresent = status === 'HADIR' || status === 'TERLAMBAT' || status === 'Hadir' || status === 'Terlambat';
                            const bonus = att?.bonus || 0;
                            dayTotalBonus += bonus;

                            return (
                              <td key={i} className="p-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  {isDW ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-700">DW</span>
                                  ) : isPresent ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                                      {status === 'TERLAMBAT' || status === 'Terlambat' ? 'Telat' : 'Hadir'}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                      {status || 'Libur'}
                                    </span>
                                  )}
                                  {bonus > 0 && (
                                    <span className="text-[10px] font-black text-amber-700">
                                      +{formatCurrency(bonus)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-3 text-right font-black text-amber-800 bg-amber-50/40">
                            {formatCurrency(dayTotalBonus)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-black text-xs">
                    <tr>
                      <td className="p-3 rounded-l-xl">TOTAL AKUMULASI</td>
                      <td className="p-3 text-right">{formatCurrency(days.reduce((s: number, d: any) => s + (d.grossOmzet ?? d.totalOmzet ?? 0), 0))}</td>
                      <td className="p-3 text-center">{daysHitTier} Hari</td>
                      {employees.map((emp: any, i: number) => {
                        const empId = emp.userId || emp.id;
                        const sum = employeeSummaries.find((s: any) => (s.userId || s.id) === empId);
                        return (
                          <td key={i} className="p-3 text-center text-amber-300 font-black">
                            {formatCurrency(sum?.totalBonus ?? emp?.totalBonus ?? emp?.totalBonusAmount ?? 0)}
                          </td>
                        );
                      })}
                      <td className="p-3 text-right text-amber-300 rounded-r-xl font-black">
                        {formatCurrency(totalBonusAll)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Employee Ranking & Summary Cards */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col gap-2.5 sm:gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                <div>
                  <h4 className="font-black text-slate-900 text-sm sm:text-base">Rekapitulasi Gaji, Bonus & Potongan Kasbon</h4>
                  <p className="text-[10px] sm:text-xs text-slate-500">Perhitungan take-home bonus setelah otomatisasi potongan kasbon karyawan</p>
                </div>
                {dailyBonusData?.totalKasbonOutstandingAll > 0 && (
                  <span className="text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl w-fit">
                    Total Kasbon Menggantung: {formatCurrency(dailyBonusData.totalKasbonOutstandingAll)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                {employeeSummaries.map((e: any, idx: number) => {
                  const isFT = e.employmentType === 'FULL_TIME';
                  const totalBonus = e.totalBonus ?? e.totalBonusAmount ?? 0;
                  const kasbonAmt = e.kasbonOutstanding || 0;
                  const takeHome = Math.max(0, totalBonus - kasbonAmt);

                  return (
                    <div key={idx} className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between space-y-2.5 sm:space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs border border-indigo-200 shrink-0">
                            {(e.name || e.username || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-xs sm:text-sm truncate">{e.name || e.username}</div>
                            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase block truncate">
                              {isFT ? 'Full Time' : e.employmentType === 'DAILY_WORKER' ? 'Daily Worker' : 'Part Time'}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black shrink-0 ${isFT ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                          {e.presentCount ?? e.totalPresentDays ?? 0} Hadir
                        </span>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="bg-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200/80 text-[11px] sm:text-xs space-y-1 sm:space-y-1.5">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Bonus Omzet:</span>
                          <span className="font-black text-amber-700">{formatCurrency(totalBonus)}</span>
                        </div>

                        {kasbonAmt > 0 && (
                          <div className="flex justify-between items-center text-rose-600 font-bold">
                            <span className="flex items-center gap-1">
                              <span>Potongan Kasbon:</span>
                            </span>
                            <span>-{formatCurrency(kasbonAmt)}</span>
                          </div>
                        )}

                        <div className="pt-1 sm:pt-1.5 border-t border-slate-100 flex justify-between items-center font-black">
                          <span className="text-slate-800">Take Home Bonus:</span>
                          <span className="text-xs sm:text-sm text-indigo-700">{formatCurrency(takeHome)}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {kasbonAmt > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSettleKasbon(e.userId || e.id, e.name || e.username, kasbonAmt)}
                          className="w-full py-1.5 sm:py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                          <CheckCircle2 size={13} /> Potong & Lunasi Kasbon
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          MODAL PILIHAN CETAK PDF RESMI
      ────────────────────────────────────────────────────────────── */}
      {showPdfModal && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <Printer size={20} color="#7c3aed" /> Pilih Dokumen Laporan PDF
                </h3>
                <p style={{ margin: '.2rem 0 0', fontSize: '.8rem', color: '#64748b' }}>
                  Format resmi siap cetak A4 untuk periode {startDate} s/d {endDate}
                </p>
              </div>
              <button onClick={() => setShowPdfModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '.6rem' }}>
              {[
                ...(enableProfitSharing ? [{ 
                  type: 'profit_sharing', 
                  title: '💰 Laporan Rekapitulasi Bagi Hasil (80:20)', 
                  desc: isBengkel 
                    ? 'Pembagian laba bersih Owner vs PJ Jasa Servis & PJ Sparepart' 
                    : isRetail 
                    ? 'Pembagian laba bersih Owner vs PJ Retail & PJ Grosir' 
                    : isLaundry 
                    ? 'Pembagian laba bersih Owner vs PJ Kiloan & PJ Satuan' 
                    : isRental 
                    ? 'Pembagian laba bersih Owner vs PJ Busana & PJ Aksesoris' 
                    : 'Pembagian laba bersih Owner vs PJ Makanan & PJ Minuman setelah beban operasional' 
                }] : []),
                { type: 'daily_bonus', title: '🏆 Matriks Bonus Omzet Harian & Rekap Staf', desc: 'Matriks kehadiran karyawan Full-Time vs Daily Worker & pencapaian bonus tier omzet harian' },
                { 
                  type: 'products', 
                  title: isBengkel 
                    ? '🔧 Laporan Penjualan Sparepart & Jasa Servis' 
                    : isRetail 
                    ? '📦 Laporan Penjualan Barang & Grosir' 
                    : isLaundry 
                    ? '🧺 Laporan Layanan Cuci Kiloan & Satuan' 
                    : isRental 
                    ? '👘 Laporan Sewa Busana & Aksesoris' 
                    : '🍜 Laporan Penjualan Menu & Margin (Best Seller)', 
                  desc: isBengkel 
                    ? 'Ranking sparepart & jasa terlaris, kuantitas, omzet, modal, dan laba kotor' 
                    : isRetail 
                    ? 'Ranking produk terlaris, kuantitas terjual, omzet, harga modal, dan laba' 
                    : isLaundry 
                    ? 'Ranking paket cuci terpopuler, total kg/pcs, omzet, dan margin keuntungan' 
                    : isRental 
                    ? 'Ranking busana & paket rias terlaris, durasi sewa, total omzet, dan laba' 
                    : 'Ranking menu terlaris, kuantitas terjual, total omzet, HPP, laba dan margin' 
                },
                { type: 'pl', title: '📊 Laporan Laba Rugi (Profit & Loss)', desc: 'Format standar akuntansi: Pendapatan, HPP, OPEX, dan Laba Bersih' },
                { type: 'cashflow', title: '💵 Laporan Arus Kas (Cash Flow)', desc: 'Rincian kas masuk penjualan dan kas keluar operasional' },
                { type: 'shifts', title: '👥 Laporan Rekapitulasi Audit Shift Kasir', desc: 'Detail saldo awal, kas sistem, fisik laci, dan selisih kas per shift' },
                { 
                  type: 'inventory', 
                  title: isBengkel 
                    ? '📦 Laporan Mutasi & Valuasi Stok Sparepart' 
                    : isRetail 
                    ? '📦 Laporan Mutasi & Valuasi Stok Barang Dagangan' 
                    : isLaundry 
                    ? '🧴 Laporan Pemakaian Sabun, Deterjen & Parfum' 
                    : isRental 
                    ? '👘 Laporan Kondisi & Ketersediaan Koleksi Busana' 
                    : '📦 Laporan Mutasi & Valuasi Stok Bahan Baku', 
                  desc: isBengkel 
                    ? 'Pergerakan stok awal, masuk pengadaan, keluar servis, dan nilai aset sparepart' 
                    : isRetail 
                    ? 'Pergerakan stok awal, masuk kulakan, keluar kasir, dan valuasi aset toko' 
                    : isLaundry 
                    ? 'Pergerakan stok deterjen, pewangi, plastik, dan biaya operasional bahan' 
                    : isRental 
                    ? 'Kondisi barang sewa (Tersedia, Tersewa, Dicuci, Rusak) dan nilai valuasi aset' 
                    : 'Pergerakan stok awal, masuk restock, keluar masak, dan nilai aset' 
                },
                { type: 'dashboard', title: '📈 Laporan Ringkasan Performa Operasional', desc: 'Executive overview, ringkasan harian, dan breakdown metode pembayaran' },
              ].map((doc) => (
                <button
                  key={doc.type}
                  onClick={() => handleGeneratePdf(doc.type)}
                  disabled={exportingPdf}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '.85rem 1rem', borderRadius: '.75rem', border: '1px solid #e2e8f0',
                    background: '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#7c3aed';
                    e.currentTarget.style.background = '#f5f3ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '.875rem', color: '#0f172a' }}>{doc.title}</div>
                  <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: '.15rem' }}>{doc.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{ padding: '.65rem 1.25rem', borderRadius: '.6rem', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI MENU & PROFIT ADVISOR MODAL */}
      <AiMenuOptimizerModal
        isOpen={showAiMenuModal}
        onClose={() => setShowAiMenuModal(false)}
        token={token}
      />
    </div>
  );
};
export default ReportView;
