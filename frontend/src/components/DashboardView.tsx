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
    lowStockProducts: []
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
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', background: '#f4f6f9', overflowY: 'auto', gap: '1.5rem' }}>
      
      {/* â”€â”€â”€ Header â”€â”€â”€ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-main)', margin: 0 }}>
            <Activity color="var(--primary)" size={24} /> Dashboard Executive
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Ringkasan performa operasional, finansial, dan kitchen hari ini</p>
        </div>
        <button
          onClick={fetchAnalytics}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: 'white', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* â”€â”€â”€ Stats KPI Row (5 Cards) â”€â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Revenue */}
        <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 shadow-inner">
              <DollarSign size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
              <TrendingUp size={12} /> +12%
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pendapatan Kotor</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{formatCurrency(summary.revenue)}</div>
          </div>
        </div>

        {/* Profit */}
        <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-primary shadow-inner">
              <Activity size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
              <TrendingUp size={12} /> +8%
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Keuntungan Bersih</div>
            <div className="text-2xl font-black text-primary tracking-tight">{formatCurrency(summary.profit)}</div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Transaksi (Struk)</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">
              {summary.transactions} <span className="text-sm font-semibold text-slate-500">nota</span>
            </div>
          </div>
        </div>

        {/* Avg Ticket Size */}
        <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <Layers size={20} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rerata Struk</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{formatCurrency(avgTicket)}</div>
          </div>
        </div>

        {/* Table Occupancy */}
        <div className="bg-white rounded-[1.25rem] p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full opacity-50 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-inner">
              <Users size={20} />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-full border border-slate-200">
              {summary.tableOccupancy?.occupied}/{summary.tableOccupancy?.total} Aktif
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Keterisian Meja</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{summary.tableOccupancy?.percentage}%</div>
          </div>
        </div>

      </div>

      {/* â”€â”€â”€ Baris 2: Grafik Utama & Pembayaran â”€â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Sales Chart Card */}
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="var(--primary)" /> Tren Penjualan Real-time
            </h3>
            {/* Toggle Modes */}
            <div style={{ background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.625rem', display: 'flex', gap: '0.12rem' }}>
              <button
                onClick={() => setChartMode('hourly')}
                style={{ border: 'none', background: chartMode === 'hourly' ? 'white' : 'transparent', color: chartMode === 'hourly' ? 'var(--primary)' : '#64748b', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: chartMode === 'hourly' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setChartMode('weekly')}
                style={{ border: 'none', background: chartMode === 'weekly' ? 'white' : 'transparent', color: chartMode === 'weekly' ? 'var(--primary)' : '#64748b', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: chartMode === 'weekly' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}
              >
                7 Hari
              </button>
              <button
                onClick={() => setChartMode('monthly')}
                style={{ border: 'none', background: chartMode === 'monthly' ? 'white' : 'transparent', color: chartMode === 'monthly' ? 'var(--primary)' : '#64748b', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: chartMode === 'monthly' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}
              >
                30 Hari
              </button>
            </div>
          </div>

          <div style={{ height: 320, width: '100%' }}>
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
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChartIcon size={18} color="var(--primary)" /> Metode Pembayaran
          </h3>
          
          <div style={{ height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {paymentChartData.length === 0 ? (
              <div style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>Belum ada pembayaran</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Total']} contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Total</div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>
                    {summary.transactions}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Payment Legends */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1 }}>
            {paymentChartData.map((item, index) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* â”€â”€â”€ Baris 3: Low Stock & Best Sellers & Dapur â”€â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
        
        {/* Dapur Speed Card */}
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--primary)" /> Kecepatan Dapur
          </h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: serviceSpeed.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #cbd5e1' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: serviceSpeed.color }}>{summary.averageServiceTime}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginTop: '-0.1rem' }}>Menit</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>Rerata Sajian Masakan</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: serviceSpeed.color, background: serviceSpeed.bg, padding: '0.15rem 0.5rem', borderRadius: '0.375rem', display: 'inline-block', marginTop: '0.25rem' }}>{serviceSpeed.label}</div>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4, borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Lightbulb size={12} className="text-amber-500" style={{ flexShrink: 0 }} />
            <span>Dihitung otomatis dari waktu order dibuat hingga barista/koki menandai "Served" di KDS.</span>
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="#dc2626" /> Peringatan Stok Menipis
          </h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {summary.lowStockProducts?.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', background: '#f8fafc', borderRadius: '1rem', padding: '2rem' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', boxShadow: '0 4px 10px rgba(22,101,52,0.1)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Semua Stok Aman</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginTop: '0.25rem' }}>Tidak ada bahan yang perlu direstock</div>
                </div>
              </div>
            ) : summary.lowStockProducts?.map((p: LowStockProduct) => (
              <div key={p.id} className="group relative overflow-hidden flex items-center gap-3 p-2.5 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-xl" />
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} style={{ width: 40, height: 40, borderRadius: '0.5rem', objectFit: 'cover', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '0.5rem', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <AlertTriangle size={18} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>Sisa {p.stock} item</div>
                    <div style={{ flex: 1, background: '#fca5a5', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, p.stock * 10)}%`, background: '#ef4444', height: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Ambang batas minimal: 10 item</span>
            <span style={{ fontWeight: 700, color: '#dc2626' }}>{summary.lowStockProducts?.length} produk menipis</span>
          </div>
        </div>

        {/* Top 5 Best Sellers Card */}
        <div style={{ background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChartIcon size={18} color="#e59e0b" /> Menu Paling Laris
          </h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {bestSellers.map((item, index) => {
              // Calculate percentage based on the top item
              const maxQty = bestSellers[0]?.qty || 1;
              const percent = (item.qty / maxQty) * 100;
              
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-between group hover:border-slate-200 transition-colors">
                  {/* Background Progress Bar */}
                  <div className="absolute top-0 left-0 h-full bg-slate-100 opacity-50" style={{ width: `${percent}%`, zIndex: 0, transition: 'width 1s ease-out' }} />
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[10px] font-black" style={{ color: COLORS[index % COLORS.length] }}>
                      #{index + 1}
                    </div>
                    <span className="text-sm font-bold text-slate-800">{item.name}</span>
                  </div>
                  <div className="relative z-10 text-xs font-black text-slate-700 bg-white shadow-sm border border-slate-100 px-2 py-1 rounded-md">
                    {item.qty} <span className="text-[9px] text-slate-400 font-bold uppercase">terjual</span>
                  </div>
                </div>
              );
            })}
            {bestSellers.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '0.75rem' }}>
                <PieChartIcon size={32} opacity={0.3} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Belum ada penjualan</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              Semua Kategori <ChevronRight size={12} />
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default DashboardView;
