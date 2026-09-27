import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Scale,
  Package,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Printer,
  Sparkles,
  Shirt,
  MessageSquare,
  Droplets,
  DollarSign,
  Layers,
  ChevronRight,
  ExternalLink,
  Flame,
  Archive,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  Percent,
  Search,
  ArrowUpRight
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

type QuickFilterType = 'today' | 'week' | 'month' | 'last_month' | 'custom';
type ActiveTabType = 'overview' | 'aging_rack' | 'margin_matrix' | 'chemical' | 'churn_guard';

interface AnalyticsData {
  period: {
    type: string;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalOrders: number;
    totalKg: number;
    totalPcs: number;
    totalRevenue: number;
    totalSubtotal: number;
    totalSurcharge: number;
    totalDiscount: number;
    avgTicket: number;
    kiloanRevenue: number;
    satuanRevenue: number;
    kiloanPercentage: number;
    satuanPercentage: number;
    onTimeRate: number;
  };
  agingRack: {
    totalValueInRack: number;
    totalUnpaidInRack: number;
    rackOrdersCount: number;
    buckets: {
      days0_3: { count: number; amount: number; unpaidAmount: number };
      days4_7: { count: number; amount: number; unpaidAmount: number };
      days8_14: { count: number; amount: number; unpaidAmount: number };
      days15_30: { count: number; amount: number; unpaidAmount: number };
      daysOver30: { count: number; amount: number; unpaidAmount: number };
    };
    overdueOrders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      customerPhone?: string;
      rackLocation: string;
      daysInRack: number;
      readyAt?: string;
      totalAmount: number;
      paidAmount: number;
      unpaidAmount: number;
      paymentStatus: string;
    }>;
  };
  topServices: Array<{
    name: string;
    count: number;
    totalQty: number;
    revenue: number;
    unitType: string;
  }>;
  perfumePopularity: Array<{
    name: string;
    count: number;
  }>;
  chemicalEfficiency: {
    totalKgDicuci: number;
    estimatedDetergentNeededLiters: number;
    estimatedPerfumeNeededLiters: number;
    currentStock: Array<{
      id: string;
      name: string;
      stock: number;
      unit: string;
      costPerUnit?: number;
      buyPrice?: number;
    }>;
  };
  atRiskCustomers: Array<{
    customerName: string;
    customerPhone?: string;
    lastOrderDate: string;
    totalSpend: number;
    orderCount: number;
  }>;
}

export const LaundryReports: React.FC = () => {
  const { token, settings } = usePOS();
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  // Filters
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTabType>('overview');

  // Search filter for lists
  const [searchOverdue, setSearchOverdue] = useState<string>('');

  const formatCurrency = (val: number | undefined | null) =>
    `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/laundry/reports/analytics?period=${quickFilter}`;
      if (quickFilter === 'custom' && startDate) {
        url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil data analitik');
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('[LaundryReports Error]', err);
      toast('Gagal memuat analitik laundry', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, quickFilter, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // WhatsApp Reminder handler for overdue rack orders
  const sendWhatsAppReminder = (order: AnalyticsData['agingRack']['overdueOrders'][0]) => {
    if (!order.customerPhone) {
      toast('Nomor WhatsApp pelanggan belum tercatat', 'error');
      return;
    }

    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const storeName = settings?.storeName || 'Laundry Kami';

    const msg =
      `Halo Kak *${order.customerName}*,\n` +
      `Pakaian cucian Anda dengan No. Nota *${order.orderNumber}* sudah selesai dan tersimpan rapi di *${order.rackLocation}* selama ${order.daysInRack} hari di ${storeName}.\n\n` +
      (order.unpaidAmount > 0
        ? `Sisa tagihan yang perlu diselesaikan: *${formatCurrency(order.unpaidAmount)}*.\n\n`
        : `Status pembayaran: *LUNAS*.\n\n`) +
      `Mohon dapat diambil pada jam operasional agar pakaian tetap harum, rapi, dan rak simpan kami tetap lega. Terima kasih! 🙏✨`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // WhatsApp Re-engagement handler for churn risk customers
  const sendWhatsAppChurnOffer = (cust: AnalyticsData['atRiskCustomers'][0]) => {
    if (!cust.customerPhone) {
      toast('Nomor WhatsApp pelanggan belum tercatat', 'error');
      return;
    }

    const cleanPhone = cust.customerPhone.replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const storeName = settings?.storeName || 'Laundry Kami';

    const msg =
      `Halo Kak *${cust.customerName}*! 👋\n` +
      `Baju menumpuk di rumah? Kami rindu melayani cucian Kakak di *${storeName}*.\n\n` +
      `Dapatkan diskon kilat *Rp 10.000* atau *Free Pewangi Premium* untuk drop cucian minggu ini! Cukup tunjukkan pesan WhatsApp ini ke kasir kami ya. Ditunggu kedatangannya Kak! 😊🧺`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Print Summary Thermal
  const handlePrintSummary = () => {
    if (!data) return;
    window.print();
  };

  const filteredOverdue = (data?.agingRack.overdueOrders || []).filter(o => {
    if (!searchOverdue) return true;
    const q = searchOverdue.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.rackLocation.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen pb-16">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                  <BarChart3 size={22} />
                </span>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Laporan & Analitik Laundry
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800">
                      Smart POS
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500">
                    Tonase cucian, perputaran rak simpan, retensi pelanggan & efisiensi chemical
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Filters & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
                {(
                  [
                    { key: 'today', label: 'Hari Ini' },
                    { key: 'week', label: '7 Hari' },
                    { key: 'month', label: 'Bulan Ini' },
                    { key: 'last_month', label: 'Bulan Lalu' },
                    { key: 'custom', label: 'Kustom' }
                  ] as { key: QuickFilterType; label: string }[]
                ).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setQuickFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      quickFilter === f.key
                        ? 'bg-white text-cyan-700 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {quickFilter === 'custom' && (
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-slate-400">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              )}

              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-cyan-600 hover:border-cyan-200 transition-all shadow-sm"
                title="Segarkan Data"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-cyan-600' : ''} />
              </button>

              <button
                onClick={handlePrintSummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all shadow-sm"
              >
                <Printer size={15} />
                <span>Cetak Ringkasan</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto no-scrollbar border-t border-slate-100 pt-3">
            {[
              { id: 'overview', label: 'Ringkasan & Penjualan', icon: TrendingUp },
              {
                id: 'aging_rack',
                label: 'Aging Rak & Piutang',
                icon: AlertCircle,
                badge: data?.agingRack.overdueOrders.length || 0
              },
              { id: 'margin_matrix', label: 'Margin Kiloan vs Satuan', icon: Scale },
              { id: 'chemical', label: 'Efisiensi Chemical', icon: Droplets },
              {
                id: 'churn_guard',
                label: 'Pelanggan Churn Risk',
                icon: Users,
                badge: data?.atRiskCustomers.length || 0
              }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTabType)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700 font-bold border border-cyan-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-cyan-600' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                  {Boolean(tab.badge && tab.badge > 0) && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        tab.id === 'aging_rack'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Tonase & Unit */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-cyan-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Volume Cucian</span>
              <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                <Scale size={18} />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {data?.summary.totalKg || 0}
              </span>
              <span className="text-sm font-bold text-cyan-600">Kg</span>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{data?.summary.totalPcs || 0} pcs</span>
              <span>satuan diproses ({data?.summary.totalOrders || 0} nota)</span>
            </div>
          </div>

          {/* KPI 2: Total Pendapatan / Omzet */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-emerald-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Omzet Terbayar</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign size={18} />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {formatCurrency(data?.summary.totalRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500">Rata-rata Nota:</span>
              <span className="font-bold text-slate-800">{formatCurrency(data?.summary.avgTicket)}</span>
            </div>
          </div>

          {/* KPI 3: Uang Mengendap di Rak */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-amber-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Piutang Mengendap di Rak</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Archive size={18} />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">
                {formatCurrency(data?.agingRack.totalUnpaidInRack)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500">Dari {data?.agingRack.rackOrdersCount || 0} nota siap ambil:</span>
              <span className="font-bold text-slate-700">{formatCurrency(data?.agingRack.totalValueInRack)}</span>
            </div>
          </div>

          {/* KPI 4: On-Time SLA Rate */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Ketepatan Waktu (SLA)</span>
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Clock size={18} />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {data?.summary.onTimeRate || 100}%
              </span>
              <span className="text-xs font-semibold text-emerald-600">Tepat Waktu</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Sesuai estimasi waktu ambil kasir</span>
            </div>
          </div>
        </div>

        {/* ================= TAB 1: OVERVIEW & PENJUALAN ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Komposisi Kiloan vs Satuan */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Percent size={16} className="text-cyan-600" />
                  Komposisi Omzet (Kiloan vs Satuan)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Perbandingan porsi kontribusi kiloan terhadap satuan
                </p>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-cyan-700 flex items-center gap-1">
                        <Scale size={13} /> Kiloan ({data?.summary.kiloanPercentage || 0}%)
                      </span>
                      <span className="text-slate-800">{formatCurrency(data?.summary.kiloanRevenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${data?.summary.kiloanPercentage || 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-indigo-700 flex items-center gap-1">
                        <Shirt size={13} /> Satuan ({data?.summary.satuanPercentage || 0}%)
                      </span>
                      <span className="text-slate-800">{formatCurrency(data?.summary.satuanRevenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${data?.summary.satuanPercentage || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Surcharge Kilat / Express:</span>
                      <span className="font-semibold text-emerald-600">
                        +{formatCurrency(data?.summary.totalSurcharge)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Diskon Promosi Kasir:</span>
                      <span className="font-semibold text-rose-500">
                        -{formatCurrency(data?.summary.totalDiscount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Varian Parfum Favorit */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Droplets size={16} className="text-purple-600" />
                  Varian Parfum Paling Diminati
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Preferensi aroma pelanggan saat drop cucian
                </p>

                {(!data?.perfumePopularity || data.perfumePopularity.length === 0) ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Belum ada data varian parfum tercatat.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.perfumePopularity.map((p, idx) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-purple-50/50 border border-slate-100 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                          {p.count} nota
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tips Cepat Efisiensi */}
              <div className="bg-linear-to-br from-cyan-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 mb-3">
                    <Sparkles size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Tips Pertumbuhan Laundry</span>
                  </div>
                  <h4 className="text-base font-bold text-white mb-2">
                    Tingkatkan Margin dengan Layanan Satuan
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Kiloan memberikan cashflow harian stabil, namun cuci satuan (Bedcover, Jas, Sepatu, Gorden) menyumbang margin kotor hingga 80%. Tawarkan paket cuci satuan saat pelanggan menimbang baju kiloan.
                  </p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-xs flex items-center justify-between">
                  <span>Target Margin Usaha Ideal:</span>
                  <span className="font-bold text-cyan-300">55% - 65%</span>
                </div>
              </div>
            </div>

            {/* Tabel Top Layanan Laundry */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Layanan Terlaris Periode Ini</h3>
                  <p className="text-xs text-slate-500">Peringkat berdasarkan perolehan total pendapatan</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Nama Layanan</th>
                      <th className="py-3 px-4">Tipe Satuan</th>
                      <th className="py-3 px-4 text-center">Jumlah Nota</th>
                      <th className="py-3 px-4 text-center">Total Volume</th>
                      <th className="py-3 px-4 text-right">Total Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!data?.topServices || data.topServices.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada transaksi layanan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      data.topServices.map(s => (
                        <tr key={s.name} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">{s.name}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                s.unitType === 'KG'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {s.unitType === 'KG' ? 'Kiloan (Kg)' : 'Satuan (Pcs)'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700">{s.count}x</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            {s.totalQty} {s.unitType === 'KG' ? 'Kg' : 'pcs'}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {formatCurrency(s.revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: AGING RACK & PIUTANG HEATMAP ================= */}
        {activeTab === 'aging_rack' && (
          <div className="space-y-6">
            {/* Heatmap Buckets Header */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                {
                  key: 'days0_3',
                  label: '0 - 3 Hari',
                  desc: 'Aman / Siap Ambil',
                  color: 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
                  badge: 'bg-emerald-100 text-emerald-800',
                  data: data?.agingRack.buckets.days0_3
                },
                {
                  key: 'days4_7',
                  label: '4 - 7 Hari',
                  desc: 'Perhatian (Perlu Reminder)',
                  color: 'border-amber-200 bg-amber-50/50 text-amber-800',
                  badge: 'bg-amber-100 text-amber-800',
                  data: data?.agingRack.buckets.days4_7
                },
                {
                  key: 'days8_14',
                  label: '8 - 14 Hari',
                  desc: 'Peringatan 1',
                  color: 'border-orange-200 bg-orange-50/50 text-orange-800',
                  badge: 'bg-orange-100 text-orange-800',
                  data: data?.agingRack.buckets.days8_14
                },
                {
                  key: 'days15_30',
                  label: '15 - 30 Hari',
                  desc: 'Risiko Ditinggal (Peringatan 2)',
                  color: 'border-rose-200 bg-rose-50/50 text-rose-800',
                  badge: 'bg-rose-100 text-rose-800',
                  data: data?.agingRack.buckets.days15_30
                },
                {
                  key: 'daysOver30',
                  label: '> 30 Hari',
                  desc: 'Terlantar / Bad Debt Risk',
                  color: 'border-slate-800 bg-slate-900 text-white',
                  badge: 'bg-rose-500 text-white',
                  data: data?.agingRack.buckets.daysOver30
                }
              ].map(b => (
                <div key={b.key} className={`rounded-2xl p-4 border shadow-2xs ${b.color}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{b.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${b.badge}`}>
                      {b.data?.count || 0} nota
                    </span>
                  </div>
                  <div className="text-[11px] opacity-80 mb-2">{b.desc}</div>
                  <div className="pt-2 border-t border-current/10">
                    <div className="text-[10px] opacity-75">Sisa Belum Bayar:</div>
                    <div className="text-xs font-black">{formatCurrency(b.data?.unpaidAmount)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overdue Orders Table with 1-Click WhatsApp Trigger */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Archive size={16} className="text-amber-500" />
                    Daftar Cucian Mengendap di Rak &gt; 3 Hari
                  </h3>
                  <p className="text-xs text-slate-500">
                    Segera hubungi pelanggan via WhatsApp agar cucian tidak menumpuk dan piutang segera cair
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nota / nama / rak..."
                    value={searchOverdue}
                    onChange={e => setSearchOverdue(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">No. Order</th>
                      <th className="py-3 px-4">Pelanggan</th>
                      <th className="py-3 px-4">Lokasi Rak</th>
                      <th className="py-3 px-4 text-center">Lama di Rak</th>
                      <th className="py-3 px-4 text-right">Total Nota</th>
                      <th className="py-3 px-4 text-right">Sisa Tagihan</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Aksi Reminder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOverdue.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          {data?.agingRack.overdueOrders.length === 0
                            ? 'Luar biasa! Tidak ada cucian yang mengendap lebih dari 3 hari di rak.'
                            : 'Tidak ada data nota yang cocok dengan pencarian.'}
                        </td>
                      </tr>
                    ) : (
                      filteredOverdue.map(ord => (
                        <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{ord.customerName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {ord.customerPhone || 'Tanpa No. HP'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700 border border-slate-200">
                              {ord.rackLocation}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                ord.daysInRack > 30
                                  ? 'bg-slate-900 text-white'
                                  : ord.daysInRack > 14
                                  ? 'bg-rose-100 text-rose-800'
                                  : ord.daysInRack > 7
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.daysInRack} hari
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-700">
                            {formatCurrency(ord.totalAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-rose-600">
                            {ord.unpaidAmount > 0 ? formatCurrency(ord.unpaidAmount) : 'Rp 0'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.paymentStatus === 'PARTIAL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {ord.paymentStatus === 'PAID'
                                ? 'LUNAS'
                                : ord.paymentStatus === 'PARTIAL'
                                ? 'SEBAGIAN'
                                : 'BELUM BAYAR'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => sendWhatsAppReminder(ord)}
                              disabled={!ord.customerPhone}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                                ord.customerPhone
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <MessageSquare size={13} />
                              <span>Kirim WA</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: MARGIN MATRIX (KILOAN VS SATUAN) ================= */}
        {activeTab === 'margin_matrix' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Analisis Kiloan */}
              <div className="bg-white rounded-2xl p-6 border border-cyan-200/80 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-bl-full -z-0" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="p-2.5 rounded-xl bg-cyan-100 text-cyan-800 font-bold text-xs flex items-center gap-1.5">
                      <Scale size={16} /> Layanan Kiloan (Reguler/Kilat)
                    </span>
                    <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                      Volume Oriented
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Total Berat Diproses:</span>
                      <span className="text-xl font-black text-slate-900">{data?.summary.totalKg || 0} Kg</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Omzet Kotor Kiloan:</span>
                      <span className="text-lg font-bold text-cyan-700">
                        {formatCurrency(data?.summary.kiloanRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Estimasi Margin Kotor:</span>
                      <span className="text-sm font-black text-slate-800">~35% - 40%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-cyan-50/70 border border-cyan-100 text-xs text-cyan-900 leading-relaxed">
                    💡 <strong>Karakteristik:</strong> Menyerap biaya operasional tetap (sewa tempat, listrik mesin cuci, gaji kasir). Menjaga perputaran mesin harian tetap penuh.
                  </div>
                </div>
              </div>

              {/* Card Analisis Satuan */}
              <div className="bg-white rounded-2xl p-6 border border-indigo-200/80 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-0" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="p-2.5 rounded-xl bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center gap-1.5">
                      <Shirt size={16} /> Layanan Satuan (Dry Clean / Pcs)
                    </span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                      High Profit Margin
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Total Potong Diproses:</span>
                      <span className="text-xl font-black text-slate-900">{data?.summary.totalPcs || 0} pcs</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Omzet Kotor Satuan:</span>
                      <span className="text-lg font-bold text-indigo-700">
                        {formatCurrency(data?.summary.satuanRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Estimasi Margin Kotor:</span>
                      <span className="text-sm font-black text-emerald-600">~75% - 85%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                    🚀 <strong>Kunci Profitabilitas:</strong> Bedcover, Jas, Gaun, Sepatu, dan Helm memiliki biaya variabel bahan kimia rendah namun nilai jual tinggi. Jadikan target upsell kasir!
                  </div>
                </div>
              </div>
            </div>

            {/* Rekomendasi Kasir Matrix */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                Formula Optimasi Laba Cabang Laundry
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-bold text-slate-900 mb-1">1. Terapkan Minimum Kiloan</div>
                  <p className="text-slate-500 leading-relaxed">
                    Terapkan batas minimal 3 Kg per order kiloan agar biaya air dan putaran mesin tetap efisien.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-bold text-slate-900 mb-1">2. Promosikan Speed Express</div>
                  <p className="text-slate-500 leading-relaxed">
                    Surcharge kilat (3-6 jam) dan express 1 hari adalah 100% margin tambahan murni tanpa menambah biaya chemical.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-bold text-slate-900 mb-1">3. Cross-Selling Bedcover</div>
                  <p className="text-slate-500 leading-relaxed">
                    Beri voucher potongan Rp 5.000 untuk cuci bedcover jika pelanggan drop pakaian kiloan di atas 7 Kg.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: EFISIENSI CHEMICAL ================= */}
        {activeTab === 'chemical' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Total Beban Cuci</span>
                  <Scale size={18} className="text-cyan-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data?.chemicalEfficiency.totalKgDicuci || 0} Kg
                </div>
                <div className="text-xs text-slate-500 mt-2">Dasar perhitungan kebutuhan chemical</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Kebutuhan Deterjen Cair</span>
                  <Droplets size={18} className="text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-600">
                  ~{data?.chemicalEfficiency.estimatedDetergentNeededLiters || 0} Liter
                </div>
                <div className="text-xs text-slate-500 mt-2">Standar takaran: 25 ml / Kg cucian</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Kebutuhan Parfum Laundry</span>
                  <Sparkles size={18} className="text-purple-600" />
                </div>
                <div className="text-2xl font-black text-purple-600">
                  ~{data?.chemicalEfficiency.estimatedPerfumeNeededLiters || 0} Liter
                </div>
                <div className="text-xs text-slate-500 mt-2">Standar takaran: 15 ml / Kg cucian</div>
              </div>
            </div>

            {/* Inventory Real Stock */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Stok Bahan Baku & Chemical Saat Ini</h3>
                  <p className="text-xs text-slate-500">Dipantau dari modul Gudang Bahan Baku CodePOS</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Nama Chemical / Bahan Baku</th>
                      <th className="py-3 px-4 text-center">Sisa Stok Fisik</th>
                      <th className="py-3 px-4 text-center">Satuan</th>
                      <th className="py-3 px-4 text-right">Biaya Satuan (HPP)</th>
                      <th className="py-3 px-4 text-center">Status Keamanan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!data?.chemicalEfficiency.currentStock || data.chemicalEfficiency.currentStock.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada data stok chemical yang terdaftar di modul Bahan Baku.
                        </td>
                      </tr>
                    ) : (
                      data.chemicalEfficiency.currentStock.map(c => {
                        const isLow = c.stock <= 5;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                            <td className="py-3 px-4 text-center font-bold text-slate-800">
                              {c.stock.toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-600">{c.unit}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700">
                              {formatCurrency(c.buyPrice ?? c.costPerUnit)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isLow ? 'Menipis - Segera Kulakan' : 'Aman'}
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

        {/* ================= TAB 5: CHURN GUARD (RETENSI PELANGGAN) ================= */}
        {activeTab === 'churn_guard' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users size={16} className="text-rose-500" />
                    Detektor Pelanggan Berisiko Churn (&gt; 14 Hari Tidak Laundry)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pelanggan setia yang belum drop cucian lagi dalam 2 minggu terakhir. Sapa mereka dengan voucher agar tidak pindah ke kompetitor.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Nama Pelanggan</th>
                      <th className="py-3 px-4">Kontak WhatsApp</th>
                      <th className="py-3 px-4 text-center">Terakhir Drop Cucian</th>
                      <th className="py-3 px-4 text-center">Total Order Lalu</th>
                      <th className="py-3 px-4 text-right">Total Transaksi Historis</th>
                      <th className="py-3 px-4 text-center">Aksi Re-engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!data?.atRiskCustomers || data.atRiskCustomers.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Hebat! Semua pelanggan aktif melakukan repeat order cucian dalam 14 hari terakhir.
                        </td>
                      </tr>
                    ) : (
                      data.atRiskCustomers.map(cust => (
                        <tr key={cust.customerName + cust.lastOrderDate} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{cust.customerName}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {cust.customerPhone || 'Tidak ada no. HP'}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600">
                            {formatDateID(cust.lastOrderDate)}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            {cust.orderCount}x
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {formatCurrency(cust.totalSpend)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => sendWhatsAppChurnOffer(cust)}
                              disabled={!cust.customerPhone}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                                cust.customerPhone
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <MessageSquare size={13} />
                              <span>Kirim Voucher Sapaan</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaundryReports;
