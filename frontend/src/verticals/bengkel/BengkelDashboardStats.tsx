import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  Wrench,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Package,
  Wallet,
  RefreshCw,
  PlusCircle,
  Car,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  ShoppingCart,
  Sparkles,
  Timer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { POSContext } from '../../context/POSContext';

import { BengkelAlertBanner } from './BengkelAlertBanner';
import { BengkelSpkPipeline } from './BengkelSpkPipeline';
import { BengkelRevenueChart } from './BengkelRevenueChart';
import { BengkelSpkDonut } from './BengkelSpkDonut';
import { BengkelTopServices } from './BengkelTopServices';
import { BengkelMechanicLeaderboard, type MechanicLeaderboardItem } from './BengkelMechanicLeaderboard';
import { BengkelInventoryBlok } from './BengkelInventoryBlok';
import { BengkelPiutangBlok } from './BengkelPiutangBlok';
import { PartRequestModal } from './PartRequestModal';

interface BengkelStats {
  activeSpk: number;
  doneToday: number;
  pendingSpk: number;
  spkWaitingParts: number;
  spkDoneUnpaid: number;
  spkTertundaLama: number;
  omzetJasa: number;
  omzetParts: number;
  omzetKotor: number;
  omzetBersih: number;
  hppParts: number;
  estimasiLabaKotor: number;
  marginPersen: number;
  avgSpkValue: number;
  totalDiscount: number;
  spkPaidCount: number;
  kasTunai: number;
  kasDigital: number;
  lowStockCount: number;
  stockAssetValue: number;
  stockAssetHPP: number;
  stockMarginPersen: number;
  pendingCommission: number;
  bebanKomisiRasio: number;
  totalPiutangAktif: number;
  piutangOverdueCount: number;
  topServices?: Array<{ name: string; count: number; omzet: number }>;
}

interface SpkStatusSummary {
  pending: number;
  assigned: number;
  inProgress: number;
  waitingParts: number;
  done: number;
  paidToday: number;
}

const defaultStats: BengkelStats = {
  activeSpk: 0,
  doneToday: 0,
  pendingSpk: 0,
  spkWaitingParts: 0,
  spkDoneUnpaid: 0,
  spkTertundaLama: 0,
  omzetJasa: 0,
  omzetParts: 0,
  omzetKotor: 0,
  omzetBersih: 0,
  hppParts: 0,
  estimasiLabaKotor: 0,
  marginPersen: 0,
  avgSpkValue: 0,
  totalDiscount: 0,
  spkPaidCount: 0,
  kasTunai: 0,
  kasDigital: 0,
  lowStockCount: 0,
  stockAssetValue: 0,
  stockAssetHPP: 0,
  stockMarginPersen: 0,
  pendingCommission: 0,
  bebanKomisiRasio: 0,
  totalPiutangAktif: 0,
  piutangOverdueCount: 0,
  topServices: [],
};

const defaultSpkSummary: SpkStatusSummary = {
  pending: 0,
  assigned: 0,
  inProgress: 0,
  waitingParts: 0,
  done: 0,
  paidToday: 0,
};

const formatCurrency = (val: number) =>
  `Rp ${(val || 0).toLocaleString('id-ID')}`;

const getCacheKey = (tenantId?: string) =>
  `bengkel_dashboard_cache_${tenantId || 'default'}`;

const loadCachedDashboard = (tenantId?: string) => {
  try {
    const raw = localStorage.getItem(getCacheKey(tenantId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    // ignore parsing failure
  }
  return null;
};

export const BengkelDashboardStats: React.FC = () => {
  const posContext = useContext(POSContext);
  const navigate = useNavigate();
  const tenantId = posContext?.user?.tenantId;

  // Instant prefill dari LocalStorage Cache jika ada (0ms cold start)
  const cached = React.useMemo(() => loadCachedDashboard(tenantId), [tenantId]);

  const [stats, setStats] = useState<BengkelStats>(cached?.stats || defaultStats);
  const [spkSummary, setSpkSummary] = useState<SpkStatusSummary>(cached?.spkSummary || defaultSpkSummary);
  const [revenueChartData, setRevenueChartData] = useState<any[]>(cached?.revenueChartData || []);
  const [chartDays, setChartDays] = useState<number>(7);
  const [mechanicLeaderboard, setMechanicLeaderboard] = useState<MechanicLeaderboardItem[]>(cached?.mechanicLeaderboard || []);
  const [totalKomisiPending, setTotalKomisiPending] = useState<number>(cached?.totalKomisiPending || 0);
  const [pendingPartRequestsCount, setPendingPartRequestsCount] = useState<number>(0);
  const [showPartRequestModal, setShowPartRequestModal] = useState<boolean>(false);

  // Jika sudah ada cache, jangan tampilkan skeleton loading berkedip!
  const [loading, setLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchChartData = useCallback(async (days: number) => {
    if (!posContext?.token) return;
    setChartLoading(true);
    try {
      const res = await fetch(`/api/bengkel/reports/revenue-chart?days=${days}`, {
        headers: { Authorization: `Bearer ${posContext.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRevenueChartData(data);
      }
    } catch (err) {
      console.error('Failed to fetch bengkel revenue chart:', err);
    } finally {
      setChartLoading(false);
    }
  }, [posContext?.token]);

  const fetchAllData = useCallback(async (isSilent = false) => {
    if (!posContext?.token) return;
    if (!isSilent) {
      setIsRefreshing(true);
    }
    try {
      const headers = { Authorization: `Bearer ${posContext.token}` };

      const [resStats, resSummary, resChart, resMechanic, resPartRequests] = await Promise.all([
        fetch('/api/bengkel/reports/dashboard-stats', { headers }),
        fetch('/api/bengkel/reports/spk-status-summary', { headers }),
        fetch(`/api/bengkel/reports/revenue-chart?days=${chartDays}`, { headers }),
        fetch('/api/bengkel/reports/mechanic-today', { headers }),
        fetch('/api/bengkel/part-requests?status=PENDING', { headers }).catch(() => null),
      ]);

      let newStats = stats;
      let newSpkSummary = spkSummary;
      let newChartData = revenueChartData;
      let newLeaderboard = mechanicLeaderboard;
      let newPendingKomisi = totalKomisiPending;

      if (resStats.ok) {
        newStats = await resStats.json();
        setStats(newStats);
      }
      if (resSummary.ok) {
        newSpkSummary = await resSummary.json();
        setSpkSummary(newSpkSummary);
      }
      if (resChart.ok) {
        newChartData = await resChart.json();
        setRevenueChartData(newChartData);
      }
      if (resMechanic.ok) {
        const data = await resMechanic.json();
        newLeaderboard = data.leaderboard || [];
        newPendingKomisi = data.totalKomisiPending || 0;
        setMechanicLeaderboard(newLeaderboard);
        setTotalKomisiPending(newPendingKomisi);
      }
      if (resPartRequests && resPartRequests.ok) {
        const prData = await resPartRequests.json();
        setPendingPartRequestsCount(prData?.stats?.pendingCount ?? 0);
      }

      setLastRefreshed(new Date());

      // Simpan snapshot ke local storage untuk instan load berikutnya
      try {
        localStorage.setItem(
          getCacheKey(tenantId),
          JSON.stringify({
            stats: newStats,
            spkSummary: newSpkSummary,
            revenueChartData: newChartData,
            mechanicLeaderboard: newLeaderboard,
            totalKomisiPending: newPendingKomisi,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (e) {
        // ignore quota error
      }
    } catch (err) {
      console.error('Failed to fetch bengkel dashboard metrics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [posContext?.token, chartDays, tenantId]);

  useEffect(() => {
    // Panggil fetch di background; jika sudah ada cache, jalankan secara silent
    fetchAllData(!!cached);

    // Auto-refresh setiap 60 detik secara silent tanpa kedip
    const timer = setInterval(() => {
      fetchAllData(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchAllData]);

  const handleChartDaysChange = (newDays: number) => {
    setChartDays(newDays);
    fetchChartData(newDays);
  };

  // 6 Executive KPI Cards
  const kpiCards = [
    {
      id: 'omzet-kotor',
      title: 'Omzet Kotor Hari Ini',
      value: formatCurrency(stats.omzetKotor),
      subtext: `${stats.spkPaidCount} SPK Lunas (Avg: ${formatCurrency(stats.avgSpkValue)})`,
      badge: stats.spkPaidCount > 0 ? `${stats.spkPaidCount} SPK` : 'Hari Ini',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: DollarSign,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      tooltip: 'Total penerimaan kotor gabungan Jasa Servis & Sparepart dari SPK berstatus PAID/DELIVERED hari ini.',
    },
    {
      id: 'omzet-jasa',
      title: 'Pendapatan Jasa Servis',
      value: formatCurrency(stats.omzetJasa),
      subtext: `Margin kotor jasa ~80% (Tanpa beban modal part)`,
      badge: 'Margin Tinggi',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Wrench,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      tooltip: 'Penerimaan murni dari ongkos kerja teknisi/mekanik tanpa memperhitungkan biaya suku cadang.',
    },
    {
      id: 'omzet-parts',
      title: 'Penjualan Sparepart',
      value: formatCurrency(stats.omzetParts),
      subtext: `Modal HPP Part: ${formatCurrency(stats.hppParts)}`,
      badge: 'Suku Cadang',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Package,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
      tooltip: 'Nilai penjualan sparepart terpasang pada SPK hari ini beserta total modal pengadaan (HPP).',
    },
    {
      id: 'laba-kotor',
      title: 'Estimasi Laba Kotor',
      value: formatCurrency(stats.estimasiLabaKotor),
      subtext: `Margin Bengkel: ${stats.marginPersen}% dari total omzet`,
      badge: `${stats.marginPersen}% Margin`,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: TrendingUp,
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      tooltip: 'Formula: Pendapatan Jasa + (Penjualan Sparepart - HPP Sparepart) sebelum dikurangi komisi mekanik & operasional.',
    },
    {
      id: 'arus-kas',
      title: 'Kas Diterima Kasir',
      value: formatCurrency(stats.kasTunai + stats.kasDigital),
      subtext: `Tunai: ${formatCurrency(stats.kasTunai)} | Digital: ${formatCurrency(stats.kasDigital)}`,
      badge: 'Realisasi Kas',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      icon: Wallet,
      iconBg: 'bg-teal-50 text-teal-600 border-teal-100',
      tooltip: 'Total arus kas fisik di laci kasir dan pembayaran QRIS/Transfer yang diterima hari ini via SPK.',
    },
    {
      id: 'spk-pipeline',
      title: 'SPK Sedang Berjalan',
      value: `${stats.activeSpk} Unit`,
      subtext: stats.spkWaitingParts > 0
        ? `⚠️ ${stats.spkWaitingParts} unit tertahan tunggu sparepart`
        : `${stats.pendingSpk} unit menunggu penugasan`,
      badge: stats.spkWaitingParts > 0 ? 'Perlu Part' : 'On Schedule',
      badgeColor: stats.spkWaitingParts > 0
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-50 text-slate-700 border-slate-200',
      icon: CheckCircle2,
      iconBg: stats.spkWaitingParts > 0
        ? 'bg-rose-50 text-rose-600 border-rose-100'
        : 'bg-violet-50 text-violet-600 border-violet-100',
      tooltip: 'Jumlah kendaraan pelanggan yang sedang berada di pit pengerjaan atau antrian mekanik saat ini.',
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
            <Wrench size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Dashboard Eksekutif Bengkel
              </h2>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Otomotif POS
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Analitik pendapatan, efisiensi pengerjaan SPK, & ketersediaan inventaris suku cadang
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Update: {lastRefreshed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => fetchAllData(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-white text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className={isRefreshing || loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* ─── QUICK ACTION SHORTCUT HUB (MOBILE ONLY TOOLBAR BENGKEL) ──────── */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-600" /> Menu Pintasan Operasional Bengkel
          </span>
          <span className="text-[10px] font-bold text-slate-400">1-Tap Akses</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-2.5">
          {/* 1. Kasir SPK */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic(20); navigate('/pos'); }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-amber-50/60 hover:bg-amber-100/60 border border-amber-100/80 transition-all active:scale-95 cursor-pointer text-center group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-1">
              <ShoppingCart size={17} />
            </div>
            <span className="text-[10.5px] font-extrabold text-amber-950 tracking-tight leading-tight line-clamp-1">
              Kasir SPK
            </span>
            <span className="text-[8.5px] font-semibold text-amber-700/80 leading-none">Pembayaran</span>
          </button>

          {/* 2. Buat SPK Baru */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic(15); navigate('/bengkel/spk/new'); }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-indigo-50/60 hover:bg-indigo-100/60 border border-indigo-100/80 transition-all active:scale-95 cursor-pointer text-center group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-1">
              <PlusCircle size={17} />
            </div>
            <span className="text-[10.5px] font-extrabold text-indigo-950 tracking-tight leading-tight line-clamp-1">
              + SPK Baru
            </span>
            <span className="text-[8.5px] font-semibold text-indigo-600/80 leading-none">Terima Unit</span>
          </button>

          {/* 3. Board Antrean SPK */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic(15); navigate('/bengkel/board'); }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-blue-50/60 hover:bg-blue-100/60 border border-blue-100/80 transition-all active:scale-95 cursor-pointer text-center group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-1">
              <Wrench size={17} />
            </div>
            <span className="text-[10.5px] font-extrabold text-blue-950 tracking-tight leading-tight line-clamp-1">
              Board SPK
            </span>
            <span className="text-[8.5px] font-semibold text-blue-600/80 leading-none">Status Pit</span>
          </button>

          {/* 4. Riwayat Kendaraan */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic(15); navigate('/bengkel/kendaraan'); }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-violet-50/60 hover:bg-violet-100/60 border border-violet-100/80 transition-all active:scale-95 cursor-pointer text-center group"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-1">
              <Car size={17} />
            </div>
            <span className="text-[10.5px] font-extrabold text-violet-950 tracking-tight leading-tight line-clamp-1">
              Kendaraan
            </span>
            <span className="text-[8.5px] font-semibold text-violet-600/80 leading-none">Cari Nopol</span>
          </button>

          {/* 5. Sparepart & Stok */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic(15); navigate('/produk'); }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-100/80 transition-all active:scale-95 cursor-pointer text-center group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-1">
              <Package size={17} />
            </div>
            <span className="text-[10.5px] font-extrabold text-emerald-950 tracking-tight leading-tight line-clamp-1">
              Sparepart
            </span>
            <span className="text-[8.5px] font-semibold text-emerald-600/80 leading-none">Cek Stok</span>
          </button>

          {/* 6. Laporan Bengkel */}
          <button
            type="button"
            onClick={() => { posContext?.triggerHaptic(15); navigate('/bengkel/laporan'); }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all active:scale-95 cursor-pointer text-center group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform mb-1">
              <FileSpreadsheet size={17} />
            </div>
            <span className="text-[10.5px] font-extrabold text-slate-900 tracking-tight leading-tight line-clamp-1">
              Laporan
            </span>
            <span className="text-[8.5px] font-semibold text-slate-500 leading-none">Analitik</span>
          </button>
        </div>
      </div>

      {/* Alert Proaktif Banner */}
      <BengkelAlertBanner
        lowStockCount={stats.lowStockCount}
        piutangOverdueCount={stats.piutangOverdueCount}
        spkWaitingParts={stats.spkWaitingParts}
        spkTertundaLama={stats.spkTertundaLama}
      />

      {/* 6 Executive KPI Stat Cards (2-COL MOBILE GRID, SYMMETRIC) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative min-h-[110px] sm:min-h-[135px]"
            >
              <div>
                <div className="flex items-start justify-between mb-1.5">
                  <div
                    className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl ${card.iconBg} flex items-center justify-center border shrink-0`}
                  >
                    <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <span
                    className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border truncate max-w-[85px] sm:max-w-none ${card.badgeColor}`}
                  >
                    {card.badge}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">
                    {card.title}
                  </span>
                  <div className="relative group/tip cursor-help hidden sm:block">
                    <HelpCircle size={11} className="text-slate-400 hover:text-slate-600" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/tip:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-20 pointer-events-none leading-relaxed">
                      {card.tooltip}
                    </div>
                  </div>
                </div>

                <div className="text-sm sm:text-base lg:text-lg font-black text-slate-900 mt-0.5 sm:mt-1 tracking-tight truncate">
                  {loading ? (
                    <span className="inline-block w-20 h-4 bg-slate-200 animate-pulse rounded" />
                  ) : (
                    card.value
                  )}
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-100 text-[9.5px] sm:text-[11px] text-slate-500 truncate">
                {card.subtext}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alur Pipeline SPK (Horizontal Live Board) */}
      <BengkelSpkPipeline
        summary={spkSummary}
        spkDoneUnpaid={stats.spkDoneUnpaid}
      />

      {/* Charts Row: Revenue Trend (Bar) & SPK Status (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BengkelRevenueChart
            data={revenueChartData}
            days={chartDays}
            onDaysChange={handleChartDaysChange}
            loading={chartLoading}
          />
        </div>
        <div className="lg:col-span-1">
          <BengkelSpkDonut summary={spkSummary} />
        </div>
      </div>

      {/* Operational Highlights: Top Services, Mechanic Leaderboard, & Inventory Valuasi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BengkelTopServices services={stats.topServices || []} />
        <BengkelMechanicLeaderboard
          data={mechanicLeaderboard}
          totalKomisiPending={totalKomisiPending}
        />
        <BengkelInventoryBlok
          stockAssetValue={stats.stockAssetValue}
          stockAssetHPP={stats.stockAssetHPP}
          stockMarginPersen={stats.stockMarginPersen}
          lowStockCount={stats.lowStockCount}
          pendingPartRequestsCount={pendingPartRequestsCount}
          onOpenPartRequestModal={() => setShowPartRequestModal(true)}
        />
      </div>

      {/* Financial & Shortcuts Row: Piutang B2B & Quick Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BengkelPiutangBlok
            totalPiutangAktif={stats.totalPiutangAktif}
            piutangOverdueCount={stats.piutangOverdueCount}
            kasTunai={stats.kasTunai}
            kasDigital={stats.kasDigital}
          />
        </div>

        {/* Quick Shortcut Navigator */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <PlusCircle size={16} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Aksi Cepat Operasional
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Jalan pintas ke alur kerja bengkel harian
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 my-3">
            <button
              onClick={() => navigate('/bengkel/spk/new')}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200 text-indigo-900 transition-all cursor-pointer text-center group active:scale-95"
            >
              <PlusCircle size={20} className="mb-1 text-indigo-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Buat SPK Baru</span>
              <span className="text-[10px] text-indigo-700/80">Registrasi unit</span>
            </button>

            <button
              onClick={() => navigate('/bengkel/board')}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-violet-50/70 hover:bg-violet-100/70 border border-violet-200 text-violet-900 transition-all cursor-pointer text-center group active:scale-95"
            >
              <Wrench size={20} className="mb-1 text-violet-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Kanban Pit</span>
              <span className="text-[10px] text-violet-700/80">Alur mekanik</span>
            </button>

            <button
              onClick={() => navigate('/bengkel/vehicles')}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-blue-900 transition-all cursor-pointer text-center group active:scale-95"
            >
              <Car size={20} className="mb-1 text-blue-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Cek Kendaraan</span>
              <span className="text-[10px] text-blue-700/80">Riwayat servis</span>
            </button>

            <button
              onClick={() => navigate('/bengkel/laporan')}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-900 transition-all cursor-pointer text-center group active:scale-95"
            >
              <FileSpreadsheet size={20} className="mb-1 text-emerald-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Laporan Finansial</span>
              <span className="text-[10px] text-emerald-700/80">Audit bagi hasil</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Pola Independen • Terisolasi dari Alur Kafe
          </div>
        </div>
      </div>
      {/* Modal Quick Entry Catat Permintaan Sparepart */}
      <PartRequestModal
        isOpen={showPartRequestModal}
        onClose={() => setShowPartRequestModal(false)}
        onSuccess={() => fetchAllData(true)}
      />
    </div>
  );
};

export default BengkelDashboardStats;
