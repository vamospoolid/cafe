import React, { useState, useEffect, useContext } from 'react';
import { 
  Calendar, DollarSign, TrendingUp, ShoppingBag, Layers, PieChart as PieChartIcon, 
  Printer, User, Award, ListFilter, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  BookOpen, CreditCard, ChevronRight, RefreshCw, Download, Check, Search, 
  FileText, Utensils, Coffee, CheckCircle2, X, Sparkles, SlidersHorizontal, BarChart3, Clock,
  Boxes, Users, Receipt, Package, Flame, Percent
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { exportFinancialPDF } from '../utils/pdfGenerator';
import { getTodayStr, getYesterdayStr, getLast7DaysRange, getLast30DaysRange, formatLocalDate } from '../utils/dateUtils';

type QuickFilterType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type MainTabType = 'dashboard' | 'products' | 'shifts_transactions' | 'inventory' | 'accounting';

export const ReportView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;

  // Date Filters: Default to today
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

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

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const fetchAllReportData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const tzOffset = new Date().getTimezoneOffset();
      const [resReports, resAccounting, resInventory, resTransactions] = await Promise.all([
        fetch(`/api/analytics/reports?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/analytics/accounting?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/analytics/inventory?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers }),
        fetch(`/api/orders?startDate=${startDate}&endDate=${endDate}&tzOffset=${tzOffset}`, { headers })
      ]);

      if (resReports.ok) setReportData(await resReports.json());
      if (resAccounting.ok) setAccountingData(await resAccounting.json());
      if (resInventory.ok) setInventoryData(await resInventory.json());
      if (resTransactions.ok) setTransactionsData(await resTransactions.json());
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
    } else if (type === 'month') {
      const r = getLast30DaysRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    }
  };

  // PDF Export Handler
  const handleGeneratePdf = async (type: string) => {
    setExportingPdf(true);
    try {
      let dataToPass: any = null;

      // Validasi data sebelum generate PDF agar tidak menghasilkan dokumen kosong
      if (type === 'products') {
        const products = reportData.products || [];
        if (products.length === 0) {
          toast('Tidak ada data penjualan menu untuk periode ini. Ubah filter tanggal dan coba lagi.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = products;
      } else if (type === 'pl') {
        const pl = accountingData.profitLoss;
        if (!pl || (pl.salesRevenue === 0 && pl.operatingRevenue === 0)) {
          toast('Tidak ada data transaksi untuk periode ini. Ubah filter tanggal dan coba lagi.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = pl;
      } else if (type === 'cashflow') {
        const cf = accountingData.cashFlow;
        if (!cf || cf.inflow?.total === 0) {
          toast('Tidak ada data arus kas untuk periode ini. Ubah filter tanggal dan coba lagi.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = cf;
      } else if (type === 'ledger') {
        const journals = accountingData.journals || [];
        if (journals.length === 0) {
          toast('Tidak ada entri jurnal untuk periode ini. Ubah filter tanggal dan coba lagi.', 'error');
          setExportingPdf(false);
          return;
        }
        dataToPass = accountingData;
      } else if (type === 'shifts') {
        const s = reportData.shifts || [];
        if (s.length === 0) {
          toast('Tidak ada riwayat shift untuk periode ini. Ubah filter tanggal dan coba lagi.', 'error');
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
        posContext?.settings || { storeName: 'MUKI RAMEN' },
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

  // Top 3 Best Sellers
  const topSellers = [...rawProducts].sort((a: any, b: any) => (b.qty || 0) - (a.qty || 0)).slice(0, 3);
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
                {posContext?.settings?.storeName || 'MUKI RAMEN'}
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Quick Filter Pills (Horizontally scrollable on mobile) */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'week', label: '7 Hari Terakhir' },
              { id: 'month', label: '30 Hari Terakhir' },
              { id: 'custom', label: 'Kustom Tanggal' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handleQuickFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                  quickFilter === f.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex-1 lg:flex-initial flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
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
            <div className="flex-1 lg:flex-initial flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
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
          2. NAVIGASI 5 TAB UTAMA LAPORAN
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 shrink-0">
        {[
          { 
            id: 'dashboard', 
            title: 'Ringkasan Eksekutif', 
            subtitle: 'Grafik & KPI Utama', 
            icon: BarChart3,
            badge: null
          },
          { 
            id: 'products', 
            title: 'Penjualan Menu', 
            subtitle: 'Best Seller & Laba', 
            icon: Utensils, 
            badge: totalQtySold > 0 ? `${totalQtySold} Porsi` : null
          },
          { 
            id: 'shifts_transactions', 
            title: 'Shift & Kasir', 
            subtitle: 'Audit Kas & Invoice', 
            icon: Users,
            badge: (reportData.shifts?.length || 0) > 0 ? `${reportData.shifts?.length} Shift` : null
          },
          { 
            id: 'inventory', 
            title: 'Mutasi & Stok', 
            subtitle: 'Valuasi HPP & Kritis', 
            icon: Boxes,
            badge: (inventoryData.inventory?.length || 0) > 0 ? `${inventoryData.inventory?.length} Bahan` : null
          },
          { 
            id: 'accounting', 
            title: 'Keuangan (P&L)', 
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.75rem',
                padding: '.75rem 1rem',
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
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '.65rem',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#ede9fe',
                  color: isSelected ? '#ffffff' : '#7c3aed',
                  flexShrink: 0
                }}
              >
                <Icon size={18} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.25rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '.85rem', color: isSelected ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.title}
                  </span>
                  {tab.badge && (
                    <span 
                      style={{ 
                        fontSize: '.62rem', 
                        padding: '.12rem .4rem', 
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
                <span style={{ fontSize: '.7rem', fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.85)' : '#64748b', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

        // Fallback or loaded category breakdown
        const catBreakdown = reportData.categoryBreakdown || (() => {
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
          return {
            food: {
              revenue: fRev,
              qty: fQty,
              cost: fCost,
              profit: fRev - fCost,
              margin: fRev > 0 ? Math.round(((fRev - fCost) / fRev) * 100) : 0,
              percentage: combined > 0 ? Math.round((fRev / combined) * 100) : 0
            },
            drink: {
              revenue: dRev,
              qty: dQty,
              cost: dCost,
              profit: dRev - dCost,
              margin: dRev > 0 ? Math.round(((dRev - dCost) / dRev) * 100) : 0,
              percentage: combined > 0 ? Math.round((dRev / combined) * 100) : 0
            },
            other: { revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0, percentage: 0 }
          };
        })();

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top 4 KPI Metrics with Margins & HPP Ratio */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
              
              {/* Card 1: Total Omzet Gross */}
              <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.03em' }}>Total Omzet (Gross)</span>
                  <div style={{ width: 34, height: 34, borderRadius: '.6rem', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                    <DollarSign size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '.35rem' }}>
                  {formatCurrency(totalRev)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.72rem', color: '#64748b', marginTop: '.35rem', paddingTop: '.35rem', borderTop: '1px dashed #f1f5f9' }}>
                  <span>{reportData.summary?.transactionsCount || 0} Total Transaksi</span>
                  <span style={{ fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '.1rem .4rem', borderRadius: '.35rem' }}>100% Basis</span>
                </div>
              </div>

              {/* Card 2: Laba Bersih Operasional + Net Margin % */}
              <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid #bbf7d0', boxShadow: '0 2px 4px rgba(16,185,129,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '.03em' }}>Laba Bersih Operasional</span>
                  <div style={{ width: 34, height: 34, borderRadius: '.6rem', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#16a34a', marginTop: '.35rem' }}>
                  {formatCurrency(netProf)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.72rem', color: '#166534', marginTop: '.35rem', paddingTop: '.35rem', borderTop: '1px dashed #dcfce7' }}>
                  <span>Setelah HPP & Biaya Kas</span>
                  <span style={{ fontWeight: 900, color: '#15803d', background: '#dcfce7', padding: '.12rem .5rem', borderRadius: '.35rem', border: '1px solid #86efac' }}>
                    Margin Bersih {netMarginPct}%
                  </span>
                </div>
              </div>

              {/* Card 3: Total HPP Bahan Baku + HPP Ratio % */}
              <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid #fecdd3', boxShadow: '0 2px 4px rgba(239,68,68,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '.03em' }}>Total HPP Bahan Baku</span>
                  <div style={{ width: 34, height: 34, borderRadius: '.6rem', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                    <ShoppingBag size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#dc2626', marginTop: '.35rem' }}>
                  {formatCurrency(totalHpp)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.72rem', color: '#991b1b', marginTop: '.35rem', paddingTop: '.35rem', borderTop: '1px dashed #fee2e2' }}>
                  <span>Biaya Bahan Terpakai</span>
                  <span style={{ fontWeight: 800, color: '#b91c1c', background: '#fee2e2', padding: '.12rem .5rem', borderRadius: '.35rem' }}>
                    Rasio HPP {hppRatioPct}%
                  </span>
                </div>
              </div>

              {/* Card 4: Laba Kotor & Gross Margin % */}
              <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.03em' }}>Laba Kotor (Gross Profit)</span>
                  <div style={{ width: 34, height: 34, borderRadius: '.6rem', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                    <Percent size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0284c7', marginTop: '.35rem' }}>
                  {formatCurrency(grossProf)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.72rem', color: '#0369a1', marginTop: '.35rem', paddingTop: '.35rem', borderTop: '1px dashed #f1f5f9' }}>
                  <span>Omzet - HPP Bahan</span>
                  <span style={{ fontWeight: 900, color: '#0284c7', background: '#e0f2fe', padding: '.12rem .5rem', borderRadius: '.35rem' }}>
                    Gross Margin {grossMarginPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION BARU: ANALISIS OMZET & MARGIN MAKANAN VS MINUMAN
            ────────────────────────────────────────────────────────────── */}
            <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <Sparkles size={17} color="#7c3aed" />
                    <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>
                      Laporan Omzet & Margin: Makanan vs Minuman
                    </h3>
                  </div>
                  <span style={{ fontSize: '.75rem', color: '#64748b' }}>
                    Perbandingan kontribusi omzet penjualan, porsi terjual, HPP bahan, dan persentase margin laba bersih per kategori
                  </span>
                </div>
              </div>

              {/* Visual Contribution Ratio Bar */}
              <div style={{ background: '#f8fafc', padding: '.85rem 1rem', borderRadius: '.85rem', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', fontWeight: 800, marginBottom: '.45rem' }}>
                  <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <Utensils size={13} /> Makanan: {catBreakdown.food.percentage}% ({formatCurrency(catBreakdown.food.revenue)})
                  </span>
                  <span style={{ color: '#0891b2', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <Coffee size={13} /> Minuman: {catBreakdown.drink.percentage}% ({formatCurrency(catBreakdown.drink.revenue)})
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${Math.max(0, catBreakdown.food.percentage)}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', transition: 'width 0.4s ease' }} title={`Makanan: ${catBreakdown.food.percentage}%`} />
                  <div style={{ width: `${Math.max(0, catBreakdown.drink.percentage)}%`, background: 'linear-gradient(90deg, #06b6d4, #0891b2)', transition: 'width 0.4s ease' }} title={`Minuman: ${catBreakdown.drink.percentage}%`} />
                </div>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                
                {/* 1. Makanan Card */}
                <div style={{ background: '#fffbeb', borderRadius: '1rem', border: '1px solid #fde68a', padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '.5rem', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Utensils size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: '.95rem', color: '#92400e' }}>Kategori Makanan (Food)</div>
                        <div style={{ fontSize: '.7rem', color: '#b45309' }}>Ramen, Nasi, Bento & Snack</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '.75rem', fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '.2rem .5rem', borderRadius: '.4rem', border: '1px solid #fde68a' }}>
                      Porsi: {catBreakdown.food.qty}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '.25rem' }}>
                    <div>
                      <div style={{ fontSize: '.7rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Total Omzet Makanan</div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#78350f' }}>{formatCurrency(catBreakdown.food.revenue)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Laba Kotor</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16a34a' }}>{formatCurrency(catBreakdown.food.profit)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', background: 'white', padding: '.65rem .85rem', borderRadius: '.65rem', border: '1px solid #fde68a' }}>
                    <div>
                      <span style={{ fontSize: '.68rem', color: '#64748b', display: 'block' }}>HPP Bahan Makanan:</span>
                      <strong style={{ fontSize: '.82rem', color: '#dc2626' }}>{formatCurrency(catBreakdown.food.cost)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '.68rem', color: '#64748b', display: 'block' }}>Margin Laba Makanan:</span>
                      <strong style={{ fontSize: '.85rem', color: '#d97706', fontWeight: 900 }}>{catBreakdown.food.margin}%</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Minuman Card */}
                <div style={{ background: '#ecfeff', borderRadius: '1rem', border: '1px solid #a5f3fc', padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '.5rem', background: '#cffafe', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Coffee size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: '.95rem', color: '#155e75' }}>Kategori Minuman (Beverages)</div>
                        <div style={{ fontSize: '.7rem', color: '#0e7490' }}>Kopi, Teh, Jus & Mocktail</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '.75rem', fontWeight: 900, color: '#0e7490', background: '#cffafe', padding: '.2rem .5rem', borderRadius: '.4rem', border: '1px solid #a5f3fc' }}>
                      Cup: {catBreakdown.drink.qty}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '.25rem' }}>
                    <div>
                      <div style={{ fontSize: '.7rem', color: '#155e75', fontWeight: 700, textTransform: 'uppercase' }}>Total Omzet Minuman</div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#164e63' }}>{formatCurrency(catBreakdown.drink.revenue)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: '#155e75', fontWeight: 700, textTransform: 'uppercase' }}>Laba Kotor</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16a34a' }}>{formatCurrency(catBreakdown.drink.profit)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', background: 'white', padding: '.65rem .85rem', borderRadius: '.65rem', border: '1px solid #a5f3fc' }}>
                    <div>
                      <span style={{ fontSize: '.68rem', color: '#64748b', display: 'block' }}>HPP Bahan Minuman:</span>
                      <strong style={{ fontSize: '.82rem', color: '#dc2626' }}>{formatCurrency(catBreakdown.drink.cost)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '.68rem', color: '#64748b', display: 'block' }}>Margin Laba Minuman:</span>
                      <strong style={{ fontSize: '.85rem', color: '#0891b2', fontWeight: 900 }}>{catBreakdown.drink.margin}%</strong>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Top 3 Best Sellers Podium Cards */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.75rem' }}>
              <Sparkles size={18} color="#f59e0b" />
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>Top 3 Menu Terlaris (Best Seller)</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {topSellers.map((seller: any, idx: number) => {
                const badgeColor = idx === 0 ? '#fbbf24' : (idx === 1 ? '#94a3b8' : '#cd7f32');
                const badgeText = idx === 0 ? '🥇 #1 Terlaris' : (idx === 1 ? '🥈 #2 Terlaris' : '🥉 #3 Terlaris');

                return (
                  <div
                    key={seller.name}
                    style={{
                      background: 'white', borderRadius: '1.25rem', border: `2px solid ${idx === 0 ? '#fbbf24' : '#e2e8f0'}`,
                      padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem',
                      boxShadow: idx === 0 ? '0 8px 20px -4px rgba(251,191,36,0.25)' : '0 2px 4px rgba(0,0,0,0.02)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ padding: '.25rem .6rem', background: idx === 0 ? '#fffbeb' : '#f8fafc', color: idx === 0 ? '#b45309' : '#475569', borderRadius: '.5rem', fontSize: '.75rem', fontWeight: 900, border: `1px solid ${badgeColor}` }}>
                        {badgeText}
                      </span>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '.15rem .45rem', borderRadius: '.35rem' }}>
                        {seller.category}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{seller.name}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '.35rem' }}>
                        <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#7c3aed' }}>
                          {seller.qty} <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#64748b' }}>porsi</span>
                        </span>
                        <span style={{ fontSize: '.85rem', fontWeight: 800, color: '#10b981' }}>
                          {formatCurrency(seller.revenue)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', background: '#f8fafc', padding: '.5rem .75rem', borderRadius: '.5rem', border: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Laba Kotor: <strong>{formatCurrency(seller.profit)}</strong></span>
                      <span style={{ color: '#7c3aed', fontWeight: 800 }}>Margin: {seller.margin}%</span>
                    </div>
                  </div>
                );
              })}
              {topSellers.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '1rem', gridColumn: 'span 3' }}>
                  Belum ada transaksi penjualan menu.
                </div>
              )}
            </div>
          </div>

          {/* Summary & Category Sub-Recap Cards */}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '.875rem' }}>
                <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b' }}>Total Porsi Terjual</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: '.2rem' }}>{totalQtySold} Porsi</div>
                  <div style={{ fontSize: '.7rem', color: '#64748b', marginTop: '.2rem' }}>Rata-rata Margin: <strong style={{ color: '#7c3aed' }}>{avgMargin}%</strong></div>
                </div>

                {/* Sub-Card Makanan */}
                <div style={{ background: '#fffbeb', borderRadius: '1rem', padding: '1rem', border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                      <Utensils size={13} /> Omzet Makanan
                    </span>
                    <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#d97706', background: '#fef3c7', padding: '.1rem .35rem', borderRadius: '.3rem' }}>
                      Margin {fMargin}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#78350f', marginTop: '.2rem' }}>{formatCurrency(fRev)}</div>
                  <div style={{ fontSize: '.7rem', color: '#b45309', marginTop: '.2rem' }}>{fQty} porsi • Laba {formatCurrency(fProfit)}</div>
                </div>

                {/* Sub-Card Minuman */}
                <div style={{ background: '#ecfeff', borderRadius: '1rem', padding: '1rem', border: '1px solid #a5f3fc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#155e75', display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                      <Coffee size={13} /> Omzet Minuman
                    </span>
                    <span style={{ fontSize: '.68rem', fontWeight: 800, color: '#0891b2', background: '#cffafe', padding: '.1rem .35rem', borderRadius: '.3rem' }}>
                      Margin {dMargin}%
                    </span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#164e63', marginTop: '.2rem' }}>{formatCurrency(dRev)}</div>
                  <div style={{ fontSize: '.7rem', color: '#0e7490', marginTop: '.2rem' }}>{dQty} cup • Laba {formatCurrency(dProfit)}</div>
                </div>

                <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b' }}>Total Laba Kotor Menu</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', marginTop: '.2rem' }}>{formatCurrency(totalMenuProfit)}</div>
                  <div style={{ fontSize: '.7rem', color: '#64748b', marginTop: '.2rem' }}>Total Omzet: {formatCurrency(totalMenuRevenue)}</div>
                </div>
              </div>
            );
          })()}

          {/* Search, Filter & Sort Bar */}
          <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '220px', background: '#f8fafc', borderRadius: '.75rem', padding: '.55rem .85rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <Search size={15} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '.85rem', color: '#0f172a', width: '100%' }}
                />
              </div>

              {/* Sort Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', color: '#64748b' }}>
                <SlidersHorizontal size={15} />
                <span>Urutkan:</span>
                <select
                  value={productSortKey}
                  onChange={(e) => setProductSortKey(e.target.value as any)}
                  style={{ padding: '.45rem .75rem', borderRadius: '.5rem', border: '1px solid #cbd5e1', fontSize: '.78rem', fontWeight: 700, background: 'white', outline: 'none' }}
                >
                  <option value="qty">Porsi Terjual</option>
                  <option value="revenue">Omzet Kotor</option>
                  <option value="profit">Keuntungan</option>
                  <option value="margin">Margin %</option>
                </select>
                <select
                  value={productSortOrder}
                  onChange={(e) => setProductSortOrder(e.target.value as any)}
                  style={{ padding: '.45rem .75rem', borderRadius: '.5rem', border: '1px solid #cbd5e1', fontSize: '.78rem', fontWeight: 700, background: 'white', outline: 'none' }}
                >
                  <option value="desc">Tertinggi</option>
                  <option value="asc">Terendah</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '.35rem', overflowX: 'auto', paddingBottom: '.25rem' }}>
              {productCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setProductCategoryFilter(cat)}
                  style={{
                    padding: '.4rem .85rem', borderRadius: '.5rem', border: '1px solid',
                    borderColor: productCategoryFilter === cat ? '#7c3aed' : '#e2e8f0',
                    background: productCategoryFilter === cat ? '#f5f3ff' : 'white',
                    color: productCategoryFilter === cat ? '#7c3aed' : '#64748b',
                    fontWeight: 700, fontSize: '.75rem', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Sales Table */}
          <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SHIFT & TRANSAKSI KASIR
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'shifts_transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub-toggle: Shifts vs Transactions */}
          <div style={{ display: 'flex', gap: '.4rem', background: 'white', padding: '.4rem', borderRadius: '1rem', border: '1px solid #e2e8f0', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <button
              onClick={() => setShiftTxSubTab('shifts')}
              style={{
                display: 'flex', alignItems: 'center', gap: '.45rem',
                padding: '.55rem 1.15rem', borderRadius: '.65rem', border: 'none',
                background: shiftTxSubTab === 'shifts' ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : '#f8fafc',
                color: shiftTxSubTab === 'shifts' ? 'white' : '#475569',
                fontWeight: 800, fontSize: '.82rem', cursor: 'pointer',
                boxShadow: shiftTxSubTab === 'shifts' ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <User size={15} /> Rekapitulasi Shift Kasir ({reportData.shifts?.length || 0})
            </button>
            <button
              onClick={() => setShiftTxSubTab('transactions')}
              style={{
                display: 'flex', alignItems: 'center', gap: '.45rem',
                padding: '.55rem 1.15rem', borderRadius: '.65rem', border: 'none',
                background: shiftTxSubTab === 'transactions' ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : '#f8fafc',
                color: shiftTxSubTab === 'transactions' ? 'white' : '#475569',
                fontWeight: 800, fontSize: '.82rem', cursor: 'pointer',
                boxShadow: shiftTxSubTab === 'transactions' ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <FileText size={15} /> Riwayat Invoice Transaksi ({transactionsData.length})
            </button>
          </div>

          {shiftTxSubTab === 'shifts' ? (
            <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
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
                          {formatCurrency(s.saldoFisikLaci || 0)}
                        </td>
                        <td style={{ padding: '.85rem 1rem', fontWeight: 900, fontSize: '.85rem', color: isBalanced ? '#10b981' : (isShort ? '#ef4444' : '#f59e0b') }}>
                          {isBalanced ? 'Rp 0 (Pas)' : (s.selisih > 0 ? `+${formatCurrency(s.selisih)}` : formatCurrency(s.selisih))}
                        </td>
                        <td style={{ padding: '.85rem 1rem' }}>
                          <span style={{
                            padding: '.2rem .5rem', borderRadius: '.35rem', fontSize: '.7rem', fontWeight: 800,
                            background: isBalanced ? '#f0fdf4' : (isShort ? '#fee2e2' : '#fffbeb'),
                            color: isBalanced ? '#166534' : (isShort ? '#991b1b' : '#b45309')
                          }}>
                            {isBalanced ? '✅ Seimbang' : (isShort ? '❌ Minus (Shortage)' : '⚠️ Lebih (Overage)')}
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
          ) : (
            <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
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
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: LAPORAN MUTASI & VALUASI STOK
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI Summary Header Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Valuasi Aset Stok</span>
                <div style={{ width: 32, height: 32, borderRadius: '.5rem', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <Boxes size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '.35rem' }}>
                {formatCurrency(inventoryData.summary?.totalAssetValuation)}
              </div>
              <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: '.2rem' }}>
                Total nilai rupiah seluruh persediaan bahan baku
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid #fee2e2', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Bahan Mendekati Kritis</span>
                <div style={{ width: 32, height: 32, borderRadius: '.5rem', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#dc2626', marginTop: '.35rem' }}>
                {inventoryData.summary?.criticalItemsCount || 0} Bahan
              </div>
              <div style={{ fontSize: '.72rem', color: '#b91c1c', marginTop: '.2rem' }}>
                Segera restock sebelum operasional dapur terganggu
              </div>
            </div>
          </div>

          {/* Search Box Bar */}
          <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: '.65rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Cari nama bahan baku (misal: Ayam, Kaldu, Shoyu, Nori)..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                width: '100%', fontSize: '.85rem', fontWeight: 600, color: '#0f172a'
              }}
            />
            {inventorySearch && (
              <button
                onClick={() => setInventorySearch('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Inventory Table */}
          <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: KEUANGAN & LABA RUGI (P&L)
      ────────────────────────────────────────────────────────────── */}
      {activeTab === 'accounting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
          {/* Sub-tabs: P&L, Cashflow, Ledger */}
          <div style={{ display: 'flex', gap: '.4rem', background: 'white', padding: '.4rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            {[
              { id: 'pl', label: '📊 Laporan Laba Rugi (P&L)' },
              { id: 'cashflow', label: '💵 Laporan Arus Kas' },
              { id: 'ledger', label: '📖 Buku Jurnal Umum' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setAccountingSubTab(st.id as any)}
                style={{
                  padding: '.55rem 1.25rem', borderRadius: '.65rem', border: 'none',
                  background: accountingSubTab === st.id ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : '#f8fafc',
                  color: accountingSubTab === st.id ? 'white' : '#475569',
                  fontWeight: 800, fontSize: '.82rem', cursor: 'pointer',
                  boxShadow: accountingSubTab === st.id ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Paper Style Financial Report Container */}
          <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '2rem', width: '100%', maxWidth: '780px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            {accountingSubTab === 'pl' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.3rem', color: '#0f172a' }}>{posContext?.settings?.storeName || 'MUKI RAMEN'}</h3>
                  <h4 style={{ margin: '.2rem 0', fontWeight: 800, fontSize: '1rem', color: '#7c3aed' }}>LAPORAN LABA RUGI OPERASIONAL</h4>
                  <span style={{ fontSize: '.8rem', color: '#64748b' }}>Periode: {startDate} s/d {endDate}</span>
                </div>

                {/* 1. Pendapatan */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '.35rem', marginBottom: '.5rem' }}>
                    1. PENDAPATAN OPERASIONAL
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', padding: '.25rem 0' }}>
                    <span>Penjualan Bersih Kasir</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(accountingData.profitLoss?.salesRevenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', padding: '.25rem 0' }}>
                    <span>Pendapatan Lain-lain (Petty Cash Masuk)</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(accountingData.profitLoss?.otherRevenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 800, color: '#7c3aed', borderTop: '1px dashed #e2e8f0', paddingTop: '.35rem', marginTop: '.25rem' }}>
                    <span>Total Pendapatan Operasional</span>
                    <span>{formatCurrency(accountingData.profitLoss?.operatingRevenue)}</span>
                  </div>
                </div>

                {/* 2. HPP */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '.35rem', marginBottom: '.5rem' }}>
                    2. HARGA POKOK PENJUALAN (HPP)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', padding: '.25rem 0', color: '#dc2626' }}>
                    <span>Beban Pokok Persediaan Bahan Baku (HPP)</span>
                    <span style={{ fontWeight: 700 }}>-{formatCurrency(accountingData.profitLoss?.cogs)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 800, color: '#dc2626', borderTop: '1px dashed #e2e8f0', paddingTop: '.35rem', marginTop: '.25rem' }}>
                    <span>Total Beban HPP</span>
                    <span>-{formatCurrency(accountingData.profitLoss?.cogs)}</span>
                  </div>
                </div>

                {/* Laba Kotor */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.95rem', fontWeight: 900, background: '#f8fafc', padding: '.75rem 1rem', borderRadius: '.5rem', border: '1px solid #e2e8f0' }}>
                  <span>LABA KOTOR (GROSS PROFIT)</span>
                  <span style={{ color: '#10b981' }}>{formatCurrency(accountingData.profitLoss?.grossProfit)}</span>
                </div>

                {/* 3. Beban OPEX */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '.35rem', marginBottom: '.5rem' }}>
                    3. BEBAN OPERASIONAL (OPEX)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', padding: '.25rem 0', color: '#dc2626' }}>
                    <span>Beban Kas Operasional & Petty Cash Keluar</span>
                    <span style={{ fontWeight: 700 }}>-{formatCurrency(accountingData.profitLoss?.opexAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 800, color: '#dc2626', borderTop: '1px dashed #e2e8f0', paddingTop: '.35rem', marginTop: '.25rem' }}>
                    <span>Total Beban Operasional</span>
                    <span>-{formatCurrency(accountingData.profitLoss?.operatingExpenses)}</span>
                  </div>
                </div>

                {/* Laba Bersih */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, background: '#f0fdf4', padding: '1rem', borderRadius: '.75rem', border: '2px solid #bbf7d0', color: '#166534' }}>
                  <span>LABA BERSIH OPERASIONAL (NET INCOME)</span>
                  <span>{formatCurrency(accountingData.profitLoss?.netIncome)}</span>
                </div>
              </div>
            )}

            {accountingSubTab === 'cashflow' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.3rem', color: '#0f172a' }}>{posContext?.settings?.storeName || 'MUKI RAMEN'}</h3>
                  <h4 style={{ margin: '.2rem 0', fontWeight: 800, fontSize: '1rem', color: '#10b981' }}>LAPORAN ARUS KAS (CASH FLOW)</h4>
                  <span style={{ fontSize: '.8rem', color: '#64748b' }}>Periode: {startDate} s/d {endDate}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#166534', borderBottom: '1px solid #bbf7d0', paddingBottom: '.35rem', marginBottom: '.5rem' }}>
                    ARUS KAS MASUK (INFLOW)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', padding: '.25rem 0' }}>
                    <span>Penerimaan Kas Penjualan Kasir</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(accountingData.cashFlow?.inflow?.salesReceipts)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 800, color: '#166534', borderTop: '1px dashed #bbf7d0', paddingTop: '.35rem', marginTop: '.25rem' }}>
                    <span>Total Kas Masuk</span>
                    <span>{formatCurrency(accountingData.cashFlow?.inflow?.total)}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '.85rem', color: '#b91c1c', borderBottom: '1px solid #fecdd3', paddingBottom: '.35rem', marginBottom: '.5rem' }}>
                    ARUS KAS KELUAR (OUTFLOW)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', padding: '.25rem 0', color: '#dc2626' }}>
                    <span>Pengeluaran Petty Cash & Operasional</span>
                    <span style={{ fontWeight: 700 }}>-{formatCurrency(accountingData.cashFlow?.outflow?.opexPayments)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', fontWeight: 800, color: '#dc2626', borderTop: '1px dashed #fecdd3', paddingTop: '.35rem', marginTop: '.25rem' }}>
                    <span>Total Kas Keluar</span>
                    <span>-{formatCurrency(accountingData.cashFlow?.outflow?.total)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, background: '#f0fdf4', padding: '1rem', borderRadius: '.75rem', border: '2px solid #bbf7d0', color: '#166534' }}>
                  <span>KENAIKAN / (PENURUNAN) KAS BERSIH</span>
                  <span>{formatCurrency(accountingData.cashFlow?.netCashFlow)}</span>
                </div>
              </div>
            )}

            {accountingSubTab === 'ledger' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.3rem', color: '#0f172a' }}>{posContext?.settings?.storeName || 'MUKI RAMEN'}</h3>
                  <h4 style={{ margin: '.2rem 0', fontWeight: 800, fontSize: '1rem', color: '#0284c7' }}>BUKU JURNAL UMUM (DOUBLE ENTRY)</h4>
                  <span style={{ fontSize: '.8rem', color: '#64748b' }}>Periode: {startDate} s/d {endDate}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', maxHeight: 450, overflowY: 'auto' }}>
                  {(accountingData.journals || []).slice(0, 30).map((j: any, idx: number) => (
                    <div key={idx} style={{ background: '#f8fafc', borderRadius: '.75rem', border: '1px solid #e2e8f0', padding: '.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '.35rem', marginBottom: '.5rem' }}>
                        <span>{new Date(j.date).toLocaleString('id-ID')} • Ref: {j.reference}</span>
                        <span style={{ color: '#0f172a' }}>{j.description}</span>
                      </div>
                      {j.lines?.map((line: any, lidx: number) => (
                        <div key={lidx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', padding: '.15rem 0' }}>
                          <span style={{ paddingLeft: line.credit > 0 ? '1.5rem' : '0', color: line.credit > 0 ? '#64748b' : '#0f172a', fontWeight: line.credit > 0 ? 500 : 700 }}>
                            {line.account}
                          </span>
                          <span style={{ fontWeight: 800 }}>
                            {line.debit > 0 ? formatCurrency(line.debit) : formatCurrency(line.credit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {(accountingData.journals || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Belum ada catatan jurnal pada periode ini.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                { type: 'products', title: '🍜 Laporan Penjualan Menu & Margin (Best Seller)', desc: 'Ranking menu terlaris, kuantitas terjual, total omzet, HPP, laba dan margin' },
                { type: 'pl', title: '📊 Laporan Laba Rugi (Profit & Loss)', desc: 'Format standar akuntansi: Pendapatan, HPP, OPEX, dan Laba Bersih' },
                { type: 'cashflow', title: '💵 Laporan Arus Kas (Cash Flow)', desc: 'Rincian kas masuk penjualan dan kas keluar operasional' },
                { type: 'shifts', title: '👥 Laporan Rekapitulasi Audit Shift Kasir', desc: 'Detail saldo awal, kas sistem, fisik laci, dan selisih kas per shift' },
                { type: 'inventory', title: '📦 Laporan Mutasi & Valuasi Stok Bahan Baku', desc: 'Pergerakan stok awal, masuk restock, keluar masak, dan nilai aset' },
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
    </div>
  );
};
export default ReportView;
