import React, { useState, useEffect, useContext } from 'react';
import {
  Cpu,
  Database,
  Store,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Coffee,
  Wrench,
  Shirt,
  ShoppingBag,
  Sparkles,
  Trash2,
  ExternalLink,
  Search,
  Activity,
  Layers,
  Clock,
  HardDrive
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface LocalTenantItem {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: string;
  plan?: { code: string; name: string };
  _count: {
    products: number;
    orders: number;
    tables: number;
    ingredients: number;
  };
}

interface SystemTelemetry {
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  dbStatus: string;
  dbLatencyMs: number;
}

export const LocalSaaSControlDashboard: React.FC = () => {
  const posContext = useContext(POSContext);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [counts, setCounts] = useState<any>(null);
  const [tenants, setTenants] = useState<LocalTenantItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedVertical, setSelectedVertical] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const fetchLocalStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platform-admin/local-dev/status');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data.system);
        setCounts(data.counts);
        setTenants(data.tenants || []);
      } else {
        toast('Gagal memuat telemetri lokal platform admin', 'error');
      }
    } catch (err: any) {
      console.error(err);
      toast('Koneksi ke backend lokal terputus', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocalStatus();
  }, []);

  // 1-Click Impersonate Tenant
  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok && data.token && data.user) {
        toast(`🚀 Masuk ke workspace ${tenantName}`, 'success');
        if (posContext?.login) {
          posContext.login(data.user, data.token);
        }
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 600);
      } else {
        toast(data.error || 'Gagal impersonasi tenant', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 1-Click Seed Resto Demo
  const handleSeedResto = async (tenantId?: string) => {
    const confirm = await confirmAlert(
      '🍜 Setup Lengkap Demo Resto (MUKI Ramen & Cafe)?',
      'Sistem akan menyuntikkan menu Signature Ramen, Minuman Artisan, Meja interaktif, Bahan Baku, dan Resep BOM otomatis ke tenant ini.'
    );
    if (!confirm.isConfirmed) return;

    setActionLoading('seed_resto');
    try {
      const res = await fetch('/api/platform-admin/local-dev/seed-resto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`✅ ${data.message}`, 'success');
        fetchLocalStatus();
      } else {
        toast(data.error || 'Gagal seeding resto', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 1-Click Switch Vertical
  const handleSwitchVertical = async (tenantId: string, businessType: string) => {
    setActionLoading(`vertical_${tenantId}`);
    try {
      const res = await fetch('/api/platform-admin/local-dev/switch-vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, businessType })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchLocalStatus();
      } else {
        toast(data.error || 'Gagal ganti vertikal', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 1-Click Purge Test Data
  const handlePurgeTestData = async (tenantId: string, tenantName: string) => {
    const confirm = await confirmAlert(
      `🧹 Bersihkan Data Transaksi ${tenantName}?`,
      'Seluruh pesanan, arus kas, dan log uji coba akan dihapus bersih. Data menu, produk, meja, dan resep tetap aman.'
    );
    if (!confirm.isConfirmed) return;

    setActionLoading(`purge_${tenantId}`);
    try {
      const res = await fetch('/api/platform-admin/local-dev/purge-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchLocalStatus();
      } else {
        toast(data.error || 'Gagal reset data transaksi', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getVerticalBadge = (type: string) => {
    const t = (type || 'CAFE').toUpperCase();
    switch (t) {
      case 'CAFE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
            <Coffee size={13} /> RESTO / KAFE
          </span>
        );
      case 'BENGKEL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
            <Wrench size={13} /> BENGKEL
          </span>
        );
      case 'RENTAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Shirt size={13} /> SEWA BUSANA
          </span>
        );
      case 'RETAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShoppingBag size={13} /> RETAIL / GROSIR
          </span>
        );
      case 'LAUNDRY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Sparkles size={13} /> LAUNDRY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
            {t}
          </span>
        );
    }
  };

  const filteredTenants = tenants.filter(t => {
    const matchV = selectedVertical === 'ALL' || (t.businessType || 'CAFE').toUpperCase() === selectedVertical;
    const matchQ = !searchFilter || 
      t.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
      t.slug.toLowerCase().includes(searchFilter.toLowerCase());
    return matchV && matchQ;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── BANNER TELEMETRI DEV LOKAL ────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border-2 border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black mb-3 tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Local Development Environment Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Pusat Kontrol SaaS & Simulator Vertikal Lokal
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed font-medium">
              Kelola seluruh tenant multi-bisnis UMKM secara instan: beralih workspace tanpa password, 
              suntik data demo Resto/BOM, dan ubah profil vertikal secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSeedResto()}
              disabled={actionLoading === 'seed_resto'}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs flex items-center gap-2 shadow-lg hover:shadow-rose-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Coffee size={16} />
              <span>{actionLoading === 'seed_resto' ? 'Menyiapkan...' : 'Setup Demo Resto (MUKI)'}</span>
            </button>

            <button
              onClick={fetchLocalStatus}
              disabled={loading}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Telemetry Chips */}
        {telemetry && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800 text-xs">
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5">
                <Database size={13} className="text-indigo-400" /> PostgreSQL
              </div>
              <div className="text-white font-mono font-bold mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Online ({telemetry.dbLatencyMs}ms)</span>
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5">
                <Cpu size={13} className="text-cyan-400" /> Runtime
              </div>
              <div className="text-white font-mono font-bold mt-1">
                Node {telemetry.nodeVersion}
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5">
                <HardDrive size={13} className="text-amber-400" /> RAM Heap
              </div>
              <div className="text-white font-mono font-bold mt-1">
                {telemetry.memoryUsageMb} MB Used
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5">
                <Clock size={13} className="text-emerald-400" /> Uptime
              </div>
              <div className="text-white font-mono font-bold mt-1">
                {Math.round(telemetry.uptimeSeconds / 60)} Menit
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 col-span-2 sm:col-span-1">
              <div className="text-slate-400 text-[11px] font-semibold flex items-center gap-1.5">
                <Store size={13} className="text-rose-400" /> Total Tenant
              </div>
              <div className="text-white font-mono font-bold mt-1">
                {counts?.totalTenants || 0} Bisnis Terdaftar
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MATRIX 5 VERTIKAL UMKM ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          { key: 'CAFE', label: 'Resto & Kafe', icon: Coffee, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
          { key: 'BENGKEL', label: 'Bengkel Servis', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
          { key: 'RENTAL', label: 'Sewa Busana', icon: Shirt, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { key: 'RETAIL', label: 'Toko Grosir', icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { key: 'LAUNDRY', label: 'Jasa Laundry', icon: Sparkles, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' }
        ].map(v => {
          const IconComponent = v.icon;
          const count = counts?.verticalCounts?.[v.key] || 0;
          const isSelected = selectedVertical === v.key;

          return (
            <button
              key={v.key}
              onClick={() => setSelectedVertical(isSelected ? 'ALL' : v.key)}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl ${v.bg} ${v.color} flex items-center justify-center font-bold`}>
                  <IconComponent size={18} />
                </div>
                <span className="text-xl font-black font-mono text-slate-800">{count}</span>
              </div>
              <div className="mt-3">
                <div className="text-xs font-black text-slate-800 leading-tight">{v.label}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">Filter vertikal</div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── KONTROL CEPAT UJI COBA RESTO (SANDBOX PANEL) ───────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-black">
              <Coffee size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Sandbox Pengujian Vertikal Resto & F&B</h2>
              <p className="text-xs text-slate-500 font-medium">
                Pintasan instan untuk memvalidasi alur pesanan meja, sinkronisasi KDS, dan resep bahan baku
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/pos"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5 transition-colors"
            >
              <Store size={14} /> Buka POS Kasir <ExternalLink size={12} />
            </a>
            <a
              href="/kds"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5 transition-colors"
            >
              <Layers size={14} /> Buka KDS Dapur <ExternalLink size={12} />
            </a>
            <a
              href="/meja"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5 transition-colors"
            >
              <Activity size={14} /> Layout Meja <ExternalLink size={12} />
            </a>
            <a
              href="/bahan-baku"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5 transition-colors"
            >
              <Database size={14} /> Resep & Bahan <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-black uppercase text-indigo-600 tracking-wider">Langkah 1</span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Suntik Data Demo MUKI Ramen</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Membuat kategori station target (Kitchen/Bar), 8 meja, 13 bahan baku, dan 7 menu ber-resep BOM.
            </p>
            <button
              onClick={() => handleSeedResto()}
              disabled={actionLoading === 'seed_resto'}
              className="mt-3 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Zap size={14} /> Jalankan Seeder Resto
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-black uppercase text-rose-600 tracking-wider">Langkah 2</span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Validasi Logika Stok & Resep</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Saat transaksi dibuat, bahan baku berkurang. Saat order di-Void, bahan baku dikembalikan tanpa duplikasi stok produk.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Anti-Phantom Stock Aktif
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-black uppercase text-emerald-600 tracking-wider">Langkah 3</span>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Uji Coba Pindah & Gabung Meja</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Pecah tagihan (/split) dan pindah meja (/move-table) kini telah diisolasi ketat per tenant tanpa celah kebocoran lintas kafe.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Zero Cross-Tenant Leak
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DAFTAR TENANT & KONTROL VERTICAL LOKAL ───────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">Daftar Tenant & Workspace Lokal</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700">
                {filteredTenants.length} dari {tenants.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih bisnis untuk login instan atau alihkan vertikal bisnisnya secara langsung
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari tenant / slug..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-indigo-500 transition-all w-52 sm:w-64"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Nama Bisnis & Slug</th>
                <th className="py-3 px-4">Vertikal</th>
                <th className="py-3 px-4">Katalog & Meja</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi Developer Lokal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Tidak ada tenant yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredTenants.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                        slug: <span className="text-indigo-600 font-semibold">{t.slug}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getVerticalBadge(t.businessType)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      <div className="flex items-center gap-2">
                        <span title="Total Produk">{t._count.products} Produk</span>
                        <span className="text-slate-300">•</span>
                        <span title="Total Meja">{t._count.tables} Meja</span>
                        <span className="text-slate-300">•</span>
                        <span title="Total Bahan Baku">{t._count.ingredients} Bahan</span>
                        <span className="text-slate-300">•</span>
                        <span title="Total Transaksi" className="font-bold text-slate-800">{t._count.orders} Order</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {t.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* 1-Click Workspace Login */}
                        <button
                          onClick={() => handleImpersonate(t.id, t.name)}
                          disabled={actionLoading === t.id}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50"
                          title="Masuk ke workspace tenant ini sebagai Owner"
                        >
                          <Play size={12} fill="currentColor" />
                          <span>Masuk POS</span>
                        </button>

                        {/* Switch Vertical Dropdown */}
                        <select
                          value={(t.businessType || 'CAFE').toUpperCase()}
                          onChange={e => handleSwitchVertical(t.id, e.target.value)}
                          disabled={actionLoading === `vertical_${t.id}`}
                          className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-300 cursor-pointer focus:outline-indigo-500"
                          title="Ganti vertikal bisnis tenant ini"
                        >
                          <option value="CAFE">Resto/Kafe</option>
                          <option value="BENGKEL">Bengkel</option>
                          <option value="RENTAL">Sewa Busana</option>
                          <option value="RETAIL">Retail Grosir</option>
                          <option value="LAUNDRY">Laundry</option>
                        </select>

                        {/* Seed Resto Data button */}
                        <button
                          onClick={() => handleSeedResto(t.id)}
                          disabled={actionLoading === 'seed_resto'}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                          title="Suntikkan katalog menu Resto & resep ke tenant ini"
                        >
                          <Coffee size={14} />
                        </button>

                        {/* Purge Test Data */}
                        <button
                          onClick={() => handlePurgeTestData(t.id, t.name)}
                          disabled={actionLoading === `purge_${t.id}`}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
                          title="Bersihkan transaksi uji coba"
                        >
                          <Trash2 size={14} />
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
    </div>
  );
};

export default LocalSaaSControlDashboard;
