import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Shirt,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  RefreshCw,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Package,
  XCircle,
  Wallet,
  CreditCard,
  Star,
  ArrowRight,
  Sparkles,
  Timer,
  BellRing,
  Layers,
  Sparkle,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { POSContext } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import useSocket from '../../hooks/useSocket';
import { RentalCronModal } from './RentalCronModal';
import { RentalSendReminderModal, type RentalOrderReminderTarget } from './RentalSendReminderModal';

interface RentalDashboardStatsProps {
  activeShift?: any;
  onOpenShift?: () => void;
  onCloseShift?: () => void;
}

interface RentalDashboardData {
  activeBookings: number;
  pickedUpToday: number;
  dueReturnsToday: number;
  heldDepositTotal: number;
  monthRevenueTotal: number;
  overdueCount: number;
  unpaidBalance: number;
  completedThisMonth: number;
  avgTicket: number;
  netIncome: number;
}

interface OverdueOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  returnDeadline: string;
  totalAmount: number;
  depositAmount: number;
  daysOverdue: number;
}

interface UpcomingReturn {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  returnDeadline: string;
  totalAmount: number;
}

interface TopAttire {
  name: string;
  code: string;
  count: number;
  revenue: number;
  color: string;
}

interface DailyTrendItem {
  date: string;
  revenue: number;
  orders: number;
}

const defaultStats: RentalDashboardData = {
  activeBookings: 0,
  pickedUpToday: 0,
  dueReturnsToday: 0,
  heldDepositTotal: 0,
  monthRevenueTotal: 0,
  overdueCount: 0,
  unpaidBalance: 0,
  completedThisMonth: 0,
  avgTicket: 0,
  netIncome: 0,
};

export const RentalDashboardStats: React.FC<RentalDashboardStatsProps> = ({
  activeShift,
  onOpenShift,
  onCloseShift
}) => {
  const navigate = useNavigate();
  const posContext = useContext(POSContext);
  const socket = useSocket();

  const [stats, setStats] = useState<RentalDashboardData>(defaultStats);
  const [pipeline, setPipeline] = useState<Record<string, { count: number; revenue: number }>>({});
  const [topBusana, setTopBusana] = useState<TopAttire[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ method: string; count: number; amount: number }>>([]);
  const [overdue, setOverdue] = useState<OverdueOrder[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingReturn[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard filter & view modes
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month'>('month');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [selectedReminderOrder, setSelectedReminderOrder] = useState<RentalOrderReminderTarget | null>(null);

  const fmt = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
  const fmtDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const handleOpenReminder = (order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string;
    returnDeadline: string;
    pickupDate?: string;
    status?: string;
    totalAmount?: number;
    depositAmount?: number;
  }) => {
    setSelectedReminderOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      returnDeadline: order.returnDeadline,
      pickupDate: order.pickupDate,
      status: order.status || 'PICKED_UP',
      totalAmount: order.totalAmount,
      depositAmount: order.depositAmount
    });
  };

  const fetchAll = useCallback(async () => {
    if (!posContext?.token) return;
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${posContext.token}` };

      const [statsRes, analyticsRes, overdueRes, upcomingRes] = await Promise.all([
        fetch('/api/rental/dashboard-stats', { headers: h }),
        fetch(`/api/rental/reports/analytics?period=${periodFilter}`, { headers: h }),
        fetch('/api/rental/orders?status=PICKED_UP&limit=100', { headers: h }),
        fetch('/api/rental/orders?status=PICKED_UP&limit=20', { headers: h }),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        const baseStats: RentalDashboardData = {
          activeBookings: d.activeBookings || 0,
          pickedUpToday: d.pickedUpToday || 0,
          dueReturnsToday: d.dueReturnsToday || 0,
          heldDepositTotal: d.heldDepositTotal || 0,
          monthRevenueTotal: d.monthRevenueTotal || 0,
          overdueCount: 0,
          unpaidBalance: 0,
          completedThisMonth: 0,
          avgTicket: 0,
          netIncome: 0,
        };

        if (analyticsRes.ok) {
          const a = await analyticsRes.json();
          baseStats.unpaidBalance = a.summary?.unpaidBalance || 0;
          baseStats.completedThisMonth = a.summary?.completedOrders || 0;
          baseStats.avgTicket = a.summary?.avgTicket || 0;
          baseStats.netIncome = a.summary?.netIncome || a.summary?.totalRevenue || 0;

          setPipeline(a.pipeline || {});
          setTopBusana(a.topBusana || []);
          setDailyTrend(a.dailyTrend || []);
          setPaymentMethods(a.paymentMethods || []);
        }

        setStats(baseStats);
      }

      // Overdue: PICKED_UP orders where returnDeadline < now
      if (overdueRes.ok) {
        const orders: any[] = (await overdueRes.json()).orders || [];
        const now = new Date();
        const overdueList: OverdueOrder[] = orders
          .filter((o: any) => new Date(o.returnDeadline) < now)
          .map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            returnDeadline: o.returnDeadline,
            totalAmount: o.totalAmount,
            depositAmount: o.depositAmount,
            daysOverdue: Math.max(1, Math.floor((now.getTime() - new Date(o.returnDeadline).getTime()) / 86400000)),
          }))
          .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)
          .slice(0, 5);
        setOverdue(overdueList);
        setStats(prev => ({ ...prev, overdueCount: overdueList.length }));
      }

      // Upcoming returns in next 3 days
      if (upcomingRes.ok) {
        const orders: any[] = (await upcomingRes.json()).orders || [];
        const now = new Date();
        const in3d = new Date(now.getTime() + 3 * 86400000);
        const upList: UpcomingReturn[] = orders
          .filter((o: any) => {
            const dl = new Date(o.returnDeadline);
            return dl >= now && dl <= in3d;
          })
          .map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            returnDeadline: o.returnDeadline,
            totalAmount: o.totalAmount,
          }))
          .slice(0, 5);
        setUpcoming(upList);
      }
    } catch (e: any) {
      console.error('[RentalDashboard] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [posContext?.token, periodFilter]);

  useEffect(() => { 
    fetchAll(); 
  }, [fetchAll]);

  // Real-time refresh on rental events
  useEffect(() => {
    const refresh = () => fetchAll();
    socket.on('rental:order:updated', refresh);
    socket.on('rental:order:created', refresh);
    socket.on('shift:status_change', refresh);
    return () => {
      socket.off('rental:order:updated', refresh);
      socket.off('rental:order:created', refresh);
      socket.off('shift:status_change', refresh);
    };
  }, [socket, fetchAll]);

  const storeName = posContext?.settings?.storeName || 'Butik Sewa Busana';

  // Format chart data
  const formattedChartData = useMemo(() => {
    if (!dailyTrend || dailyTrend.length === 0) return [];
    return dailyTrend.map(d => {
      const dt = new Date(d.date);
      const label = isNaN(dt.getTime()) ? d.date : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return {
        ...d,
        displayDate: label
      };
    });
  }, [dailyTrend]);

  // Pipeline order definition
  const pipelineStages = [
    { key: 'BOOKED', label: 'Terjadwal', color: 'bg-amber-500', barBg: 'bg-amber-100', text: 'text-amber-800' },
    { key: 'FITTING', label: 'Fitting / Permak', color: 'bg-purple-500', barBg: 'bg-purple-100', text: 'text-purple-800' },
    { key: 'PICKED_UP', label: 'Dibawa Klien', color: 'bg-blue-500', barBg: 'bg-blue-100', text: 'text-blue-800' },
    { key: 'RETURNED', label: 'Kembali (QC)', color: 'bg-orange-500', barBg: 'bg-orange-100', text: 'text-orange-800' },
    { key: 'LAUNDRY', label: 'Cuci / Laundry', color: 'bg-cyan-500', barBg: 'bg-cyan-100', text: 'text-cyan-800' },
    { key: 'COMPLETED', label: 'Selesai', color: 'bg-emerald-500', barBg: 'bg-emerald-100', text: 'text-emerald-800' },
  ];

  const totalPipelineCount = useMemo(() => {
    return Object.values(pipeline).reduce((acc, curr) => acc + (curr?.count || 0), 0);
  }, [pipeline]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Memuat wawasan analitik dashboard rental...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">

      {/* ─── 1. TOP HEADER & PERIOD FILTER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
            <Shirt size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                Dashboard Rental Busana
              </h2>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkle size={10} className="text-amber-500" />
                Live Control
              </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-1">Operasional sanggar, finansial sewa &amp; jaminan — {storeName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* Period Filter Selector (Android Segmented Control) */}
          <div className="flex items-center bg-slate-100 border border-slate-200/80 p-1 rounded-xl text-xs font-bold shadow-2xs">
            {(['today', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => {
                  posContext?.triggerHaptic?.(10);
                  setPeriodFilter(p);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95 ${
                  periodFilter === p 
                    ? 'bg-white text-slate-950 shadow-xs font-black' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p === 'today' ? 'Hari Ini' : p === 'week' ? '7 Hari' : 'Bulan Ini'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              posContext?.triggerHaptic?.(10);
              fetchAll();
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-200 shadow-2xs active:scale-95 shrink-0"
            title="Muat ulang data terbaru"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ─── 2. ANDROID NATIVE QUICK ACTION LAUNCHPAD (TACTILE APP TILES) ─── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
              Pintasan Kasir &amp; Operasional Android POS
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            1-Tap Akses
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* 1. Kasir Sewa POS */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic?.(20); navigate('/pos'); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/90 transition-all active:scale-95 cursor-pointer text-center group shadow-2xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-105 transition-transform mb-1.5">
              <ShoppingCart size={22} />
            </div>
            <span className="text-xs font-black text-amber-950 tracking-tight leading-tight">
              Sewa Baru (POS)
            </span>
            <span className="text-[9.5px] font-bold text-amber-700/90 mt-0.5">Fitting &amp; Ambil</span>
          </button>

          {/* 2. Papan Jadwal Kanban */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic?.(15); navigate('/rental-kanban'); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/90 transition-all active:scale-95 cursor-pointer text-center group shadow-2xs relative"
          >
            {stats.activeBookings > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full shadow-2xs">
                {stats.activeBookings}
              </span>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 group-hover:scale-105 transition-transform mb-1.5">
              <Layers size={22} />
            </div>
            <span className="text-xs font-black text-blue-950 tracking-tight leading-tight">
              Papan Jadwal
            </span>
            <span className="text-[9.5px] font-bold text-blue-700/90 mt-0.5">Kanban Busana</span>
          </button>

          {/* 3. Katalog & Stok Busana */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic?.(15); navigate('/rental-inventory'); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200/90 transition-all active:scale-95 cursor-pointer text-center group shadow-2xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200 group-hover:scale-105 transition-transform mb-1.5">
              <Shirt size={22} />
            </div>
            <span className="text-xs font-black text-purple-950 tracking-tight leading-tight">
              Katalog Busana
            </span>
            <span className="text-[9.5px] font-bold text-purple-700/90 mt-0.5">Stok &amp; Lokasi Rak</span>
          </button>

          {/* 4. Laporan & Finansial */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic?.(15); navigate('/laporan'); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/90 transition-all active:scale-95 cursor-pointer text-center group shadow-2xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform mb-1.5">
              <BarChart3 size={22} />
            </div>
            <span className="text-xs font-black text-emerald-950 tracking-tight leading-tight">
              Laporan Sanggar
            </span>
            <span className="text-[9.5px] font-bold text-emerald-700/90 mt-0.5">Omzet &amp; Jaminan</span>
          </button>

          {/* 5. Auto-Reminder WhatsApp */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic?.(15); setCronModalOpen(true); }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/90 transition-all active:scale-95 cursor-pointer text-center group shadow-2xs relative"
          >
            {stats.overdueCount > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full animate-bounce">
                {stats.overdueCount} Telat
              </span>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 group-hover:scale-105 transition-transform mb-1.5">
              <BellRing size={22} />
            </div>
            <span className="text-xs font-black text-rose-950 tracking-tight leading-tight">
              Pengingat WA
            </span>
            <span className="text-[9.5px] font-bold text-rose-700/90 mt-0.5">Jadwal Kembali</span>
          </button>

          {/* 6. Shift Kasir */}
          <button
            type="button"
            onClick={() => {
              posContext?.triggerHaptic?.(15);
              if (activeShift) {
                onCloseShift?.();
              } else {
                onOpenShift?.();
              }
            }}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer text-center group shadow-2xs ${
              activeShift 
                ? 'bg-teal-50/70 hover:bg-teal-100/70 border-teal-200/90' 
                : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200/90'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-1.5 ${
              activeShift ? 'bg-gradient-to-tr from-teal-500 to-teal-600 shadow-teal-200' : 'bg-gradient-to-tr from-amber-500 to-amber-600 shadow-amber-200'
            }`}>
              <Timer size={22} />
            </div>
            <span className="text-xs font-black text-slate-900 tracking-tight leading-tight">
              Shift Kasir
            </span>
            <span className={`text-[9.5px] font-bold mt-0.5 ${activeShift ? 'text-teal-700' : 'text-amber-700'}`}>
              {activeShift ? 'Kasir Aktif' : 'Buka Shift'}
            </span>
          </button>
        </div>
      </div>

      {/* ─── OVERDUE ALERT BANNER ─────────────────────────────────────────── */}
      {stats.overdueCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-rose-900">
              Perhatian: {stats.overdueCount} busana melewati batas waktu pengembalian!
            </p>
            <p className="text-xs text-rose-700 mt-0.5">
              Segera hubungi penyewa via WhatsApp atau telepon untuk rekonsiliasi denda harian dan pengembalian unit.
            </p>
          </div>
          <button
            onClick={() => navigate('/rental-kanban')}
            className="px-3.5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all cursor-pointer shrink-0 shadow-xs"
          >
            Lihat di Kanban
          </button>
        </div>
      )}

      {/* ─── ROW 1: 4 KPI CARDS UTAMA ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          {
            icon: <DollarSign size={18} />,
            label: 'Pendapatan Sewa',
            value: fmt(stats.monthRevenueTotal),
            sub: `Avg Tiket: ${fmt(stats.avgTicket)}`,
            color: 'text-emerald-600',
            bg: 'bg-white border-slate-200/80 hover:border-emerald-300',
            iconBg: 'bg-emerald-50 text-emerald-600',
            indicator: stats.monthRevenueTotal > 0 ? '+ Aktif' : 'Normal',
            indColor: 'text-emerald-700 bg-emerald-50'
          },
          {
            icon: <ShieldCheck size={18} />,
            label: 'Deposit Jaminan Tertahan',
            value: fmt(stats.heldDepositTotal),
            sub: 'Uang titipan jaminan (100% Refundable)',
            color: 'text-indigo-600',
            bg: 'bg-white border-slate-200/80 hover:border-indigo-300',
            iconBg: 'bg-indigo-50 text-indigo-600',
            indicator: 'Titipan Aman',
            indColor: 'text-indigo-700 bg-indigo-50'
          },
          {
            icon: <Shirt size={18} />,
            label: 'Order Berjalan',
            value: String(stats.activeBookings),
            sub: `${stats.completedThisMonth} order selesai periode ini`,
            color: 'text-amber-600',
            bg: 'bg-white border-slate-200/80 hover:border-amber-300',
            iconBg: 'bg-amber-50 text-amber-600',
            indicator: 'Sedang Berjalan',
            indColor: 'text-amber-700 bg-amber-50'
          },
          {
            icon: <Clock size={18} />,
            label: 'Ambil & Kembali Hari Ini',
            value: `${stats.pickedUpToday} / ${stats.dueReturnsToday}`,
            sub: `${stats.pickedUpToday} jadwal ambil • ${stats.dueReturnsToday} jadwal kembali`,
            color: 'text-purple-600',
            bg: 'bg-white border-slate-200/80 hover:border-purple-300',
            iconBg: 'bg-purple-50 text-purple-600',
            indicator: stats.overdueCount > 0 ? `${stats.overdueCount} Terlambat` : 'Tepat Waktu',
            indColor: stats.overdueCount > 0 ? 'text-rose-700 bg-rose-50' : 'text-purple-700 bg-purple-50'
          },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-2xl border p-4 ${kpi.bg} shadow-xs flex flex-col justify-between transition-all min-h-[120px]`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${kpi.indColor}`}>
                {kpi.indicator}
              </span>
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{kpi.label}</p>
              <p className={`text-lg sm:text-2xl font-black ${kpi.color} leading-tight my-0.5 truncate`}>{kpi.value}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── ROW 2: GRAFIK TREN OMZET & FUNNEL STATUS SEWA ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: AreaChart Tren Omzet Harian */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-amber-600" />
                Tren Pendapatan &amp; Aktivitas Sewa
              </h3>
              <p className="text-[11px] text-slate-400">Kurva pergerakan omzet sewa busana adat harian</p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMetric('revenue')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'revenue' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Omzet (Rp)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('orders')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  chartMetric === 'orders' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Jml Transaksi
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            {formattedChartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <BarChart3 size={32} className="text-slate-200 mb-2" />
                <p>Belum ada data transaksi pada rentang waktu ini.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rentalRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="rentalOrderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => chartMetric === 'revenue' ? `${Math.round(val / 1000)}k` : val} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderColor: '#e2e8f0', 
                      borderRadius: '12px', 
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                    }}
                    formatter={(value: any) => [
                      chartMetric === 'revenue' ? fmt(Number(value)) : `${value} Kontrak Sewa`, 
                      chartMetric === 'revenue' ? 'Omzet Sewa' : 'Jumlah Booking'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartMetric} 
                    stroke={chartMetric === 'revenue' ? '#d97706' : '#6366f1'} 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill={chartMetric === 'revenue' ? 'url(#rentalRevenueGrad)' : 'url(#rentalOrderGrad)'} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Pipeline Status Funnel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                Pipeline Siklus Busana
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {totalPipelineCount} Total Tiket
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">Distribusi tahapan sewa &amp; perawatan kain</p>

            <div className="space-y-2.5">
              {pipelineStages.map((stage) => {
                const count = pipeline[stage.key]?.count || 0;
                const revenue = pipeline[stage.key]?.revenue || 0;
                const percentage = totalPipelineCount > 0 ? Math.round((count / totalPipelineCount) * 100) : 0;

                return (
                  <div key={stage.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                        {stage.label}
                      </span>
                      <span className="font-bold text-slate-900">
                        {count} <span className="text-[10px] text-slate-400 font-normal">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stage.color} rounded-full transition-all`} 
                        style={{ width: `${percentage}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Buka Papan Alur Kerja:</span>
            <button
              onClick={() => navigate('/rental-kanban')}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              Kanban Board <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>

      {/* ─── ROW 3: TOP BUSANA TERLARIS & FINANCIAL RECONCILIATION ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Top 5 Busana Terfavorit */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Star size={16} className="text-amber-500 fill-amber-500" />
                Koleksi Busana Paling Sering Disewa
              </h3>
              <p className="text-[11px] text-slate-400">Peringkat aset butik dengan produktivitas rental tertinggi</p>
            </div>
            <button
              onClick={() => navigate('/rental-inventory')}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              Inventaris <ArrowRight size={13} />
            </button>
          </div>

          {topBusana.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Shirt size={32} className="mx-auto text-slate-200 mb-2" />
              <p>Belum ada data busana yang disewa pada periode ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topBusana.slice(0, 5).map((attire, idx) => (
                <div key={idx} className="py-2.5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors rounded-xl px-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                    idx === 0 ? 'bg-amber-100 text-amber-900' :
                    idx === 1 ? 'bg-slate-200 text-slate-700' :
                    idx === 2 ? 'bg-orange-100 text-orange-900' : 'bg-slate-100 text-slate-500'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{attire.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {attire.code} {attire.color ? `• ${attire.color}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-emerald-600">{fmt(attire.revenue)}</p>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                      {attire.count}x Disewa
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rekonsiliasi Kas, Jaminan & Piutang */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Wallet size={16} className="text-emerald-600" />
                  Rekonsiliasi Kas, Deposit &amp; Piutang
                </h3>
                <p className="text-[11px] text-slate-400">Pemisahan uang jaminan titipan vs omzet bersih</p>
              </div>
              <button
                onClick={() => navigate('/laporan')}
                className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
              >
                Laporan <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Uang Jaminan Titipan */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-indigo-600" />
                    Uang Jaminan Tertahan (Held Deposit)
                  </div>
                  <p className="text-[10px] text-indigo-700/80 mt-0.5">Wajib dikembalikan 100% jika baju aman saat kembali</p>
                </div>
                <span className="text-sm font-black text-indigo-900">
                  {fmt(stats.heldDepositTotal)}
                </span>
              </div>

              {/* Piutang Sewa (Unpaid Balance) */}
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-rose-600" />
                    Piutang Sewa Belum Lunas
                  </div>
                  <p className="text-[10px] text-rose-700/80 mt-0.5">Sisa tagihan kontrak sewa yang belum dilunasi klien</p>
                </div>
                <span className="text-sm font-black text-rose-900">
                  {fmt(stats.unpaidBalance)}
                </span>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Metode Pembayaran Terpakai:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.length === 0 ? (
                    <div className="col-span-3 text-center text-xs text-slate-400 py-2">
                      Belum ada rincian metode pembayaran
                    </div>
                  ) : (
                    paymentMethods.map((pm, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">{pm.method || 'CASH'}</span>
                        <span className="text-xs font-black text-slate-800 block my-0.5">{fmt(pm.amount)}</span>
                        <span className="text-[9px] text-slate-400">{pm.count}x Bayar</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── ROW 4: TWO COLUMN: OVERDUE + UPCOMING ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Overdue Returns */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <AlertTriangle size={15} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-800">Terlambat Kembali (Overdue)</h3>
                <p className="text-[10px] text-slate-400">Melewati batas waktu jadwal pengembalian</p>
              </div>
            </div>
            {overdue.length > 0 && (
              <button 
                onClick={() => navigate('/laporan')} 
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
              >
                Lihat Semua <ArrowRight size={12} />
              </button>
            )}
          </div>

          {overdue.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Semua busana on-time! 🎉</p>
              <p className="text-xs text-slate-400 mt-0.5">Tidak ada penyewa yang melewati deadline saat ini.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdue.map(o => (
                <div key={o.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-rose-50/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono font-bold text-slate-600">{o.orderNumber}</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-black bg-rose-100 text-rose-700 rounded-full">
                        {o.daysOverdue}h terlambat
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{o.customerName}</p>
                    <p className="text-[10px] text-slate-400">Deadline: {fmtDate(o.returnDeadline)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-700">{fmt(o.totalAmount)}</p>
                    <p className="text-[10px] text-slate-400">Deposit: {fmt(o.depositAmount)}</p>
                  </div>
                  {o.customerPhone && (
                    <button
                      onClick={() => handleOpenReminder(o)}
                      className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer border border-emerald-200 shrink-0"
                      title="Kirim WA Pengingat Pengembalian"
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Returns (3 days) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Calendar size={15} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-800">Pengembalian 3 Hari ke Depan</h3>
                <p className="text-[10px] text-slate-400">Jadwal busana yang wajib kembali dalam 3 hari</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/rental-kanban')} 
              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              Kanban <ArrowRight size={12} />
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className="py-10 text-center">
              <Clock size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-500">Tidak ada jadwal pengembalian</p>
              <p className="text-xs text-slate-400 mt-0.5">dalam kurun waktu 3 hari ke depan.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcoming.map(o => {
                const dl = new Date(o.returnDeadline);
                const today = new Date();
                const daysLeft = Math.ceil((dl.getTime() - today.getTime()) / 86400000);

                return (
                  <div key={o.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-blue-50/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-mono font-bold text-slate-600">{o.orderNumber}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full ${
                          daysLeft <= 1 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {daysLeft === 0 ? 'Hari ini' : daysLeft === 1 ? 'Besok' : `${daysLeft} hari lagi`}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{o.customerName}</p>
                      <p className="text-[10px] text-slate-400">Deadline: {fmtDate(o.returnDeadline)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-700">{fmt(o.totalAmount)}</p>
                      </div>
                      {o.customerPhone && (
                        <button
                          onClick={() => handleOpenReminder({ ...o, status: 'PICKED_UP' })}
                          className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer border border-blue-200 shrink-0"
                          title="Kirim Pengingat Jadwal Kembali WA"
                        >
                          <MessageSquare size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ─── QUICK NAV CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Booking Baru',
            desc: 'Proses reservasi & pembayaran sewa busana',
            icon: <ShoppingCart size={20} />,
            color: 'from-amber-500 to-orange-400',
            ring: 'hover:border-amber-300',
            path: '/pos',
          },
          {
            label: 'Kanban Sewa',
            desc: 'Kelola status busana & cuci laundry visual',
            icon: <BarChart3 size={20} />,
            color: 'from-indigo-600 to-purple-500',
            ring: 'hover:border-indigo-300',
            path: '/rental-kanban',
          },
          {
            label: 'Laporan Finansial',
            desc: 'Omzet, deposit tertahan, denda & analitik busana',
            icon: <TrendingUp size={20} />,
            color: 'from-emerald-500 to-teal-400',
            ring: 'hover:border-emerald-300',
            path: '/laporan',
          },
          {
            label: 'Katalog Busana & Rak',
            desc: 'Kelola nomor hanger, stok adat & ROI modal',
            icon: <Shirt size={20} />,
            color: 'from-rose-500 to-pink-400',
            ring: 'hover:border-rose-300',
            path: '/rental-inventory',
          },
        ].map((card, i) => (
          <button
            key={i}
            onClick={() => navigate(card.path)}
            className={`bg-white rounded-2xl border border-slate-200/80 p-4 text-left hover:shadow-md ${card.ring} transition-all cursor-pointer group`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${card.color} text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform`}>
              {card.icon}
            </div>
            <h4 className="text-xs sm:text-sm font-black text-slate-800 leading-tight">{card.label}</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 leading-snug">{card.desc}</p>
          </button>
        ))}
      </div>

      {/* ─── MODALS ───────────────────────────────────────────────────────── */}
      <RentalCronModal
        isOpen={cronModalOpen}
        onClose={() => setCronModalOpen(false)}
        onFinished={fetchAll}
      />

      <RentalSendReminderModal
        isOpen={!!selectedReminderOrder}
        onClose={() => setSelectedReminderOrder(null)}
        order={selectedReminderOrder}
        onSuccess={fetchAll}
      />

    </div>
  );
};

export default RentalDashboardStats;
