import { useState, useEffect, useContext } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Activity, 
  ShoppingBag, 
  PieChart as PieChartIcon, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Layers, 
  Users, 
  RefreshCw, 
  Lightbulb,
  Wallet,
  QrCode,
  Award,
  Utensils,
  CheckCircle2,
  UserCheck,
  Timer
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { POSContext } from '../context/POSContext';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6'];

interface LowStockProduct {
  id: number;
  name: string;
  stock: number;
  imageUrl?: string;
}

const DashboardView = () => {
  const [summary, setSummary] = useState<any>({
    revenue: 0,
    profit: 0,
    transactions: 0,
    averageServiceTime: 0,
    paymentMethods: { Tunai: 0, QRIS: 0, Kartu: 0, Split: 0 },
    cashBreakdown: { cash: 0, digital: 0 },
    hourlySales: [],
    tableOccupancy: { occupied: 0, total: 0, percentage: 0 },
    lowStockProducts: [],
    recentTransactions: [],
    recentStockLogs: [],
    activeShift: null,
    crewOnDuty: [],
    kitchenQueue: 0,
    omzetBonusTier: {
      enabled: true,
      currentBonus: 0,
      currentTierLabel: '< Rp 2.5 Juta',
      nextGoalAmount: 2500000,
      remainingToNext: 2500000,
      nextTierBonus: 5000,
      progressPercent: 0
    }
  });

  const [salesChart, setSalesChart] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'hourly' | 'weekly' | 'monthly'>('hourly');

  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const fetchSalesChart = async (days: number) => {
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const tzOffset = new Date().getTimezoneOffset();
      const res = await fetch(`/api/analytics/sales-chart?days=${days}&tzOffset=${tzOffset}`, { headers });
      if (res.ok) setSalesChart(await res.json());
    } catch (e) {
      console.error('Failed to load sales chart', e);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const tzOffset = new Date().getTimezoneOffset();
      
      const [summaryRes, bestSellersRes] = await Promise.all([
        fetch(`/api/analytics/summary?tzOffset=${tzOffset}`, { headers }),
        fetch('/api/analytics/best-sellers', { headers })
      ]);

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
      if (bestSellersRes.ok) setBestSellers(await bestSellersRes.json());
      
      // Also fetch chart based on current mode
      if (chartMode === 'weekly') fetchSalesChart(7);
      if (chartMode === 'monthly') fetchSalesChart(30);

    } catch (error) {
      console.error('Failed to load analytics', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchAnalytics();
    }
  }, [posContext?.token]);

  useEffect(() => {
    if (posContext?.token && !loading) {
      if (chartMode === 'weekly') fetchSalesChart(7);
      if (chartMode === 'monthly') fetchSalesChart(30);
    }
  }, [chartMode]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold text-xs">Memuat wawasan analitik eksekutif...</p>
      </div>
    );
  }

  // Calculate Average Ticket Size
  const avgTicket = summary.transactions > 0 ? Math.round(summary.revenue / summary.transactions) : 0;

  // Prepare payment method data for list
  const paymentChartData = Object.entries(summary.paymentMethods || {})
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter(item => item.value > 0);

  // Get service speed classification
  const getServiceStatus = (mins: number) => {
    if (mins === 0) return { label: 'Belum ada data', color: '#64748b', bg: '#f1f5f9' };
    if (mins <= 10) return { label: 'Sangat Cepat', color: '#166534', bg: '#dcfce7' };
    if (mins <= 18) return { label: 'Normal Standar', color: '#854d0e', bg: '#fef9c3' };
    return { label: 'Perlu Perhatian', color: '#991b1b', bg: '#fee2e2' };
  };
  const serviceSpeed = getServiceStatus(summary.averageServiceTime);

  const activeShift = summary.activeShift;
  const bonusTier = summary.omzetBonusTier;
  const cashAmount = summary.cashBreakdown?.cash ?? (summary.paymentMethods?.Tunai || 0);
  const digitalAmount = summary.cashBreakdown?.digital ?? ((summary.revenue || 0) - cashAmount);

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-4 sm:gap-6">
      
      {/* ─── 1. TOP HEADER & SHIFT LIVE STATUS ────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Activity className="text-indigo-600" size={24} /> Dashboard Executive
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat kendali performa operasional, finansial, dapur &amp; kru MUKI RAMEN
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active Shift Indicator Pill */}
          {activeShift ? (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Shift Aktif: <strong>{activeShift.user?.name || 'Kasir'}</strong></span>
              <span className="hidden sm:inline text-emerald-100">&bull; Modal: {formatCurrency(activeShift.saldoAwal)}</span>
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
              <Timer size={14} className="text-amber-600" />
              <span>Shift Kasir Belum Dibuka</span>
            </div>
          )}

          <button
            onClick={fetchAnalytics}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ─── 2. FIVE EXECUTIVE KPI CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 shrink-0">
        
        {/* 1. Revenue */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full opacity-60 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <DollarSign size={18} />
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              Hari Ini
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendapatan Kotor</div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(summary.revenue)}
            </div>
          </div>
        </div>

        {/* 2. Profit */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full opacity-60 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
              <TrendingUp size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Est. Laba
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Keuntungan Bersih (HPP)</div>
            <div className="text-lg sm:text-2xl font-black text-emerald-600 tracking-tight truncate">
              {formatCurrency(summary.profit)}
            </div>
          </div>
        </div>

        {/* 3. Kas Fisik di Laci (Cash) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full opacity-60 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-inner">
              <Wallet size={18} />
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Laci Tunai
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Uang Kas Fisik POS</div>
            <div className="text-lg sm:text-2xl font-black text-amber-700 tracking-tight truncate">
              {formatCurrency(cashAmount)}
            </div>
          </div>
        </div>

        {/* 4. Digital / QRIS */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-60 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
              <QrCode size={18} />
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Bank / QRIS
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Non-Tunai / Digital</div>
            <div className="text-lg sm:text-2xl font-black text-blue-700 tracking-tight truncate">
              {formatCurrency(digitalAmount)}
            </div>
          </div>
        </div>

        {/* 5. Transaksi & Avg Ticket */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full opacity-60 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-inner">
              <ShoppingBag size={18} />
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              {summary.transactions} Struk
            </span>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rerata Struk / Meja</div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(avgTicket)}
            </div>
          </div>
        </div>

      </div>

      {/* ─── 3. ROW 2: REALTIME SALES CHART & BONUS TIER WIDGET ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Sales Chart Card (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-600" /> Tren Penjualan Real-time
              </h3>
              <p className="text-[11px] text-slate-400">Fluktuasi omzet penjualan berdasarkan jam dan periode waktu</p>
            </div>
            {/* Toggle Modes */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 self-start sm:self-auto">
              <button
                onClick={() => setChartMode('hourly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartMode === 'hourly' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setChartMode('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartMode === 'weekly' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setChartMode('monthly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartMode === 'monthly' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                30 Hari
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMode === 'hourly' ? (summary.hourlySales?.filter((d: any) => d.sales > 0) || []) : salesChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey={chartMode === 'hourly' ? "hour" : "name"} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} tickFormatter={val => `Rp ${val / 1000}k`} dx={0} />
                <Tooltip 
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} 
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Omzet']} 
                  labelStyle={{ fontWeight: 800, color: '#1e293b', paddingBottom: '0.25rem' }} 
                  contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', padding: '0.75rem 1rem' }} 
                />
                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Progress Tier Bonus Omzet & Payment Card (1 Column) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          
          {/* Target Tier Bonus Omzet Harian */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-indigo-900/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
                    <Award size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">Tier Bonus Omzet Harian</h4>
                    <div className="text-[10px] text-indigo-300">Target bonus per orang kru full-time</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                  {formatCurrency(bonusTier?.currentBonus || 0)}
                </span>
              </div>

              <div className="mt-4 bg-white/10 p-3 rounded-xl border border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-200">Status Pencapaian:</span>
                  <span className="font-black text-white">{bonusTier?.currentTierLabel || '< Rp 2.5 Juta'}</span>
                </div>
                {bonusTier?.nextGoalAmount && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[11px] text-indigo-200 mb-1">
                      <span>Menuju Bonus {formatCurrency(bonusTier.nextTierBonus || 0)}</span>
                      <span className="font-bold text-amber-300">Sisa {formatCurrency(bonusTier.remainingToNext)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500" 
                        style={{ width: `${bonusTier.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[10px] text-indigo-300/80 mt-3 flex items-center gap-1">
              <Lightbulb size={12} className="text-amber-400 shrink-0" />
              <span>Dihitung otomatis dari akumulasi omzet kotor hari ini.</span>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 shadow-xs">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
              <PieChartIcon size={14} className="text-indigo-600" /> Komposisi Metode Pembayaran
            </h4>
            <div className="flex flex-col gap-1.5">
              {paymentChartData.length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">Belum ada transaksi hari ini</div>
              ) : (
                paymentChartData.map((item, index) => {
                  const pct = summary.revenue > 0 ? Math.round((item.value / summary.revenue) * 100) : 0;
                  return (
                    <div key={item.name} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">({pct}%)</span>
                      </div>
                      <span className="font-black text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ─── 4. ROW 3: DAPUR KDS, MEJA & MENU TERLARIS ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Kecepatan Dapur & Antrean KDS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock size={17} className="text-indigo-600" /> Kecepatan Saji Dapur (KDS)
            </h3>
            {summary.kitchenQueue > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] animate-pulse">
                {summary.kitchenQueue} Antre
              </span>
            )}
          </div>

          <div className="flex-1 flex items-center justify-around py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200" style={{ background: serviceSpeed.bg }}>
                <div className="text-xl font-black" style={{ color: serviceSpeed.color }}>{summary.averageServiceTime}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase -mt-0.5">Menit</div>
              </div>
              <div className="text-[11px] font-bold mt-1.5" style={{ color: serviceSpeed.color }}>{serviceSpeed.label}</div>
            </div>

            <div className="h-12 w-px bg-slate-200" />

            <div className="flex flex-col items-center justify-center text-center">
              <div className="text-2xl font-black text-slate-800">{summary.kitchenQueue || 0}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Pesanan Sedang Dimasak</div>
              <div className="text-[10px] text-emerald-600 font-bold mt-1">Live Queue KDS</div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-snug flex items-center gap-1.5">
            <Utensils size={12} className="text-indigo-500 shrink-0" />
            <span>Rerata waktu dari order dicatat kasir hingga disajikan koki dapur.</span>
          </div>
        </div>

        {/* Live Keterisian Meja */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Users size={17} className="text-indigo-600" /> Keterisian Meja (Dine-In)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
              {summary.tableOccupancy?.occupied}/{summary.tableOccupancy?.total} Meja
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {summary.tableOccupancy?.percentage || 0}%
            </div>
            <div className="text-xs font-bold text-slate-500 mt-1">Tingkat Okupansi Meja Saat Ini</div>

            <div className="w-48 h-2.5 rounded-full bg-slate-200 mt-3 overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${summary.tableOccupancy?.percentage || 0}%` }}
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-400 flex justify-between items-center">
            <span>Terisi: <strong className="text-slate-700">{summary.tableOccupancy?.occupied || 0} Meja</strong></span>
            <span>Kosong: <strong className="text-emerald-600">{(summary.tableOccupancy?.total || 0) - (summary.tableOccupancy?.occupied || 0)} Meja</strong></span>
          </div>
        </div>

        {/* Top 5 Menu Paling Laris */}
        <div className="md:col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Award size={17} className="text-amber-500" /> Menu Paling Laris Hari Ini
          </h3>

          <div className="flex-1 flex flex-col gap-2 max-h-48 overflow-y-auto">
            {bestSellers.map((item, index) => {
              const maxQty = bestSellers[0]?.qty || 1;
              const percent = (item.qty / maxQty) * 100;
              
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-between group">
                  <div className="absolute top-0 left-0 h-full bg-slate-100/80" style={{ width: `${percent}%`, zIndex: 0 }} />
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="w-5 h-5 rounded-md bg-white shadow-xs border border-slate-100 flex items-center justify-center text-[10px] font-black" style={{ color: COLORS[index % COLORS.length] }}>
                      #{index + 1}
                    </div>
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{item.name}</span>
                  </div>
                  <div className="relative z-10 text-[11px] font-black text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                    {item.qty} <span className="text-[9px] text-slate-400 font-bold">porsi</span>
                  </div>
                </div>
              );
            })}
            {bestSellers.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-4 text-xs">
                Belum ada penjualan menu hari ini
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── 5. ROW 4: KRU BERTUGAS & STOK MENIPIS ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Crew on Duty (Live Attendance) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <UserCheck size={17} className="text-emerald-600" /> Staf Sedang Bertugas ({summary.crewOnDuty?.length || 0} Kru)
            </h3>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Presensi
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-2 max-h-56 overflow-y-auto">
            {(!summary.crewOnDuty || summary.crewOnDuty.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6 text-xs">
                Belum ada staf yang absen masuk hari ini.
              </div>
            ) : (
              summary.crewOnDuty.map((att: any) => {
                const clockInTime = att.clockIn ? new Date(att.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                const isLate = att.status === 'TERLAMBAT' || (att.lateMinutes || 0) > 0;

                return (
                  <div key={att.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                        {(att.user?.name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{att.user?.name || att.user?.username}</div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {att.shiftName || att.user?.role || 'Kru Resto'} &bull; Masuk: {clockInTime}
                        </div>
                      </div>
                    </div>
                    <div>
                      {isLate ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          Telat {att.lateMinutes}m
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Tepat Waktu ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Peringatan Stok Menipis */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle size={17} className="text-rose-600" /> Peringatan Stok Menipis
            </h3>
            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              {summary.lowStockProducts?.length || 0} Produk Kritis
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-2 max-h-56 overflow-y-auto">
            {(!summary.lowStockProducts || summary.lowStockProducts.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 bg-slate-50 rounded-2xl p-4 text-center">
                <CheckCircle2 size={24} className="text-emerald-600" />
                <div className="text-xs font-bold text-slate-700">Semua Stok Aman</div>
                <div className="text-[10px] text-slate-400">Tidak ada produk atau bahan yang perlu direstock darurat.</div>
              </div>
            ) : (
              summary.lowStockProducts.map((p: LowStockProduct) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-rose-50/50 rounded-xl border border-rose-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-rose-500 font-bold border border-rose-100">
                      <AlertTriangle size={15} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-rose-600 font-semibold">Sisa stok: {p.stock} item</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700">
                    Kritis
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardView;
