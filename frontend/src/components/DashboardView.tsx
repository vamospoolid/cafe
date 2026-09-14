import { useState, useEffect, useContext } from 'react';
import { TrendingUp, DollarSign, Activity, ShoppingBag, PieChart as PieChartIcon, Clock, AlertTriangle, ChevronRight, Layers, Users, RefreshCw, Lightbulb } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { POSContext } from '../context/POSContext';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

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
    hourlySales: [],
    tableOccupancy: { occupied: 0, total: 0, percentage: 0 },
    lowStockProducts: [],
    recentTransactions: [],
    recentStockLogs: []
  });
  const [salesChart, setSalesChart] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'hourly' | 'weekly' | 'monthly'>('hourly');

  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const fetchSalesChart = async (days: number) => {
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const res = await fetch(`/api/analytics/sales-chart?days=${days}`, { headers });
      if (res.ok) setSalesChart(await res.json());
    } catch (e) {
      console.error('Failed to load sales chart', e);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      
      const [summaryRes, bestSellersRes] = await Promise.all([
        fetch('/api/analytics/summary', { headers }),
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

  // Fetch chart data dynamically when mode changes
  useEffect(() => {
    if (posContext?.token && !loading) {
      if (chartMode === 'weekly') fetchSalesChart(7);
      if (chartMode === 'monthly') fetchSalesChart(30);
    }
  }, [chartMode]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', height: '100%', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>Memuat wawasan analitik...</p>
      </div>
    );
  }

  // Calculate Average Ticket Size
  const avgTicket = summary.transactions > 0 ? Math.round(summary.revenue / summary.transactions) : 0;

  // Prepare payment method data for pie chart
  const paymentChartData = Object.entries(summary.paymentMethods || {})
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter(item => item.value > 0);

  // Get service speed classification
  const getServiceStatus = (mins: number) => {
    if (mins === 0) return { label: 'Belum ada', color: '#64748b', bg: '#f1f5f9' };
    if (mins <= 10) return { label: 'Sangat Cepat', color: '#166534', bg: '#dcfce7' };
    if (mins <= 18) return { label: 'Normal', color: '#854d0e', bg: '#fef9c3' };
    return { label: 'Lambat', color: '#991b1b', bg: '#fee2e2' };
  };
  const serviceSpeed = getServiceStatus(summary.averageServiceTime);

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-6">
      
      {/* ─── Header Action Toolbar ─── */}
      <div className="flex justify-between items-center gap-3 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Activity className="text-primary" size={24} /> Dashboard Executive
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Ringkasan performa operasional, finansial, dan kitchen hari ini</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white text-slate-700 hover:text-primary border border-slate-200 hover:border-primary/40 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
        >
          <RefreshCw size={14} /> Refresh Data Realtime
        </button>
      </div>

      {/* ─── Stats KPI Row (5 Cards) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 shrink-0">
        
        {/* Revenue */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 shadow-inner">
              <DollarSign size={18} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              <TrendingUp size={11} /> +12%
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendapatan Kotor</div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight truncate">{formatCurrency(summary.revenue)}</div>
          </div>
        </div>

        {/* Profit */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-100 flex items-center justify-center text-primary shadow-inner">
              <Activity size={18} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              <TrendingUp size={11} /> +8%
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Keuntungan Bersih</div>
            <div className="text-lg sm:text-2xl font-black text-primary tracking-tight truncate">{formatCurrency(summary.profit)}</div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Transaksi (Struk)</div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">
              {summary.transactions} <span className="text-xs font-semibold text-slate-500">nota</span>
            </div>
          </div>
        </div>

        {/* Avg Ticket Size */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <Layers size={18} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Rerata Struk</div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight truncate">{formatCurrency(avgTicket)}</div>
          </div>
        </div>

        {/* Table Occupancy */}
        <div className="col-span-2 sm:col-span-2 md:col-span-3 lg:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-inner">
              <Users size={18} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
              {summary.tableOccupancy?.occupied}/{summary.tableOccupancy?.total} Aktif
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Keterisian Meja</div>
            <div className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">{summary.tableOccupancy?.percentage}%</div>
          </div>
        </div>

      </div>

      {/* ─── Baris 2: Grafik Utama & Pembayaran ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Sales Chart Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" /> Tren Penjualan Real-time
            </h3>
            {/* Toggle Modes */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 self-start sm:self-auto">
              <button
                onClick={() => setChartMode('hourly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartMode === 'hourly' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setChartMode('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartMode === 'weekly' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setChartMode('monthly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartMode === 'monthly' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                30 Hari
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMode === 'hourly' ? (summary.hourlySales?.filter((d: any) => d.sales > 0) || []) : salesChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey={chartMode === 'hourly' ? "hour" : "name"} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} tickFormatter={val => `Rp ${val / 1000}k`} dx={0} />
                <Tooltip 
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} 
                  formatter={(val: any) => [formatCurrency(Number(val)), 'Omzet']} 
                  labelStyle={{ fontWeight: 800, color: '#1e293b', paddingBottom: '0.25rem' }} 
                  contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', padding: '0.75rem 1rem' }} 
                />
                <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'white', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <PieChartIcon size={18} className="text-primary" /> Metode Pembayaran
          </h3>
          
          <div className="h-44 relative flex items-center justify-center">
            {paymentChartData.length === 0 ? (
              <div className="text-[11px] uppercase font-bold text-slate-400">Belum ada pembayaran</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {paymentChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Total']} contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total</div>
                  <div className="text-base font-black text-slate-800">
                    {summary.transactions}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Payment Legends */}
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {paymentChartData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-bold text-slate-700">{item.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── Baris 3: Low Stock & Best Sellers & Dapur ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Dapur Speed Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Clock size={18} className="text-primary" /> Kecepatan Dapur
          </h3>

          <div className="flex-1 flex flex-col justify-center items-center gap-3 py-4">
            <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200" style={{ background: serviceSpeed.bg }}>
              <div className="text-2xl font-black" style={{ color: serviceSpeed.color }}>{summary.averageServiceTime}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase -mt-1">Menit</div>
            </div>
            <div className="text-center">
              <div className="font-extrabold text-sm text-slate-800">Rerata Sajian Masakan</div>
              <div className="text-xs font-bold px-2 py-0.5 rounded-md inline-block mt-1" style={{ color: serviceSpeed.color, background: serviceSpeed.bg }}>{serviceSpeed.label}</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 leading-snug border-t border-slate-100 pt-3 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-amber-500 shrink-0" />
            <span>Dihitung otomatis dari waktu order dibuat hingga barista/koki menandai "Served" di KDS.</span>
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" /> Peringatan Stok Menipis
          </h3>

          <div className="flex-1 flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
            {summary.lowStockProducts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 bg-slate-50 rounded-2xl p-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div className="text-center">
                  <div className="text-sm font-black text-slate-800">Semua Stok Aman</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">Tidak ada bahan yang perlu direstock</div>
                </div>
              </div>
            ) : summary.lowStockProducts?.map((p: LowStockProduct) => (
              <div key={p.id} className="group relative overflow-hidden flex items-center gap-3 p-2.5 bg-rose-50/60 hover:bg-rose-100/60 rounded-xl border border-rose-100 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 rounded-l-xl" />
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-rose-500 font-extrabold text-sm shadow-sm">
                    <AlertTriangle size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{p.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-[11px] text-rose-700 font-bold">Sisa {p.stock} item</div>
                    <div className="flex-1 bg-rose-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, p.stock * 10)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 flex items-center justify-between">
            <span>Ambang batas minimal: 10 item</span>
            <span className="font-bold text-rose-600">{summary.lowStockProducts?.length} produk menipis</span>
          </div>
        </div>

        {/* Top 5 Best Sellers Card */}
        <div className="md:col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <PieChartIcon size={18} className="text-amber-500" /> Menu Paling Laris
          </h3>

          <div className="flex-1 flex flex-col gap-2.5 sm:max-h-60 max-h-none sm:overflow-y-auto">
            {bestSellers.map((item, index) => {
              const maxQty = bestSellers[0]?.qty || 1;
              const percent = (item.qty / maxQty) * 100;
              
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center justify-between group hover:border-slate-200 transition-colors">
                  <div className="absolute top-0 left-0 h-full bg-slate-100/70" style={{ width: `${percent}%`, zIndex: 0, transition: 'width 1s ease-out' }} />
                  
                  <div className="flex items-center gap-2.5 relative z-10">
                    <div className="w-6 h-6 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[10px] font-black" style={{ color: COLORS[index % COLORS.length] }}>
                      #{index + 1}
                    </div>
                    <span className="text-xs font-bold text-slate-800">{item.name}</span>
                  </div>
                  <div className="relative z-10 text-xs font-black text-slate-700 bg-white shadow-sm border border-slate-100 px-2 py-0.5 rounded-md">
                    {item.qty} <span className="text-[9px] text-slate-400 font-bold uppercase">terjual</span>
                  </div>
                </div>
              );
            })}
            {bestSellers.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-6">
                <PieChartIcon size={28} className="opacity-30" />
                <span className="text-xs font-bold">Belum ada penjualan</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 flex justify-end">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
              Semua Kategori <ChevronRight size={12} />
            </span>
          </div>
        </div>

      </div>

      {/* ─── Baris 4: Recent Transactions & Recent Stock Mutations ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Recent Transactions Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Activity size={18} className="text-primary" /> Transaksi Terbaru (POS)
          </h3>
          
          <div className="flex-1 flex flex-col gap-2.5 sm:max-h-72 max-h-none sm:overflow-y-auto">
            {(summary.recentTransactions || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                <span className="text-xs font-semibold">Belum ada transaksi</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(summary.recentTransactions || []).map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-800">{t.orderNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${t.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Pelanggan: <span className="font-semibold text-slate-700">{t.customerName}</span> • {t.paymentMethod || 'Belum Bayar'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xs text-primary">{formatCurrency(t.total)}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Stock Mutations Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Layers size={18} className="text-primary" /> Aktivitas Mutasi Stok
          </h3>
          
          <div className="flex-1 flex flex-col gap-2.5 sm:max-h-72 max-h-none sm:overflow-y-auto">
            {(summary.recentStockLogs || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                <span className="text-xs font-semibold">Belum ada aktivitas stok</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(summary.recentStockLogs || []).map((l: any) => (
                  <div key={l.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-800">{l.ingredient?.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${['Restock', 'PO'].includes(l.type) ? 'bg-emerald-100 text-emerald-700' : l.type === 'Rusak' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                          {l.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Ket: {l.description || '—'} {l.referenceId ? `(${l.referenceId})` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-black text-xs ${l.change > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {l.change > 0 ? `+${l.change}` : l.change} {l.ingredient?.unit}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(l.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardView;
