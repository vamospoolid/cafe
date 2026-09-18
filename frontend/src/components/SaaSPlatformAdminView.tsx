import React, { useState, useEffect, useContext } from 'react';
import { 
  Building2, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Search, 
  ExternalLink, 
  LogIn, 
  CreditCard, 
  Calendar, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  Sliders, 
  Database,
  ArrowUpRight,
  Store,
  Layers
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import SaaSPlanManager from './SaaSPlanManager';

export const SaaSPlatformAdminView: React.FC = () => {
  const posContext = useContext(POSContext);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'invoices' | 'plans' | 'health'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const formatCurrency = (amount: number) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;

  const fetchPlatformData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      
      const [ovRes, tenRes, invRes] = await Promise.all([
        fetch('/api/platform-admin/overview', { headers }),
        fetch('/api/platform-admin/tenants', { headers }),
        fetch('/api/platform-admin/invoices', { headers })
      ]);

      if (ovRes.ok) setOverviewData(await ovRes.json());
      if (tenRes.ok) {
        const tData = await tenRes.json();
        setTenants(tData.tenants || []);
      }
      if (invRes.ok) {
        const iData = await invRes.json();
        setInvoices(iData.invoices || []);
      }
    } catch (err) {
      console.error('Failed to load platform admin telemetry:', err);
      toast('Gagal memuat data platform admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, [posContext?.token]);

  // Handle 1-Click Tenant Impersonation
  const handleImpersonateTenant = async (tenantId: string, tenantName: string) => {
    const result = await confirmAlert(
      `Masuk ke Ruang Kerja ${tenantName}?`,
      `Anda akan berpindah sesi sebagai Developer ke akun bisnis ${tenantName}. Anda dapat kembali kapan saja.`
    );
    if (!result.isConfirmed) return;

    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok && data.token && data.user) {
        toast(`Berhasil masuk ke workspace ${tenantName}`, 'success');
        if (posContext?.login) {
          posContext.login(data.user, data.token);
        }
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      } else {
        toast(data.error || 'Gagal melakukan impersonasi tenant', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Extend Trial / Subscription
  const handleExtendTrial = async (tenantId: string, days: number = 14) => {
    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/extend-trial`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}` 
        },
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchPlatformData();
      } else {
        toast(data.error || 'Gagal memperpanjang masa aktif', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Toggle Tenant Status (Suspend / Activate)
  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const result = await confirmAlert(
      `${nextStatus === 'SUSPENDED' ? 'Tangguhkan (Suspend)' : 'Aktifkan'} Tenant?`,
      `Apakah Anda yakin ingin mengubah status tenant ini menjadi ${nextStatus}?`
    );
    if (!result.isConfirmed) return;

    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}` 
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchPlatformData();
      } else {
        toast(data.error || 'Gagal mengubah status tenant', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle 1-Click Approve / Verify Manual Payment
  const handleVerifyInvoice = async (invoiceId: string, invNumber: string) => {
    const result = await confirmAlert(
      `Verifikasi Pembayaran Invoice #${invNumber}?`,
      `Invoice akan ditandai LUNAS dan paket langganan tenant akan diaktifkan secara instan selama 30 hari.`
    );
    if (!result.isConfirmed) return;

    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/platform-admin/invoices/${invoiceId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchPlatformData();
      } else {
        toast(data.error || 'Gagal memverifikasi invoice', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const m = overviewData?.metrics || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32">
      
      {/* ─── 1. TOP HEADER BANNER ─────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black tracking-widest uppercase mb-1.5">
              <Sparkles size={16} /> SaaS Developer &amp; SuperAdmin Command Center
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Platform Executive Control
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Pusat kendali master seluruh tenant, revenue MRR/ARR, verifikasi langganan, dan telemetri multi-tenant.
            </p>
          </div>

          <button
            onClick={fetchPlatformData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Telemetri
          </button>
        </div>

        {/* ─── Master Revenue & Tenant Metrics ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 relative z-10">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Monthly Recurring Revenue (MRR)</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{formatCurrency(m.mrr || 0)}</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">ARR: {formatCurrency(m.arr || 0)}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total UMKM / Tenant</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{m.totalTenants || 0} Bisnis</div>
            <div className="text-[10px] font-semibold text-indigo-300 mt-0.5">{m.activeTenants || 0} Aktif • {m.trialTenants || 0} Trial</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Transaksi POS Global</div>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">{m.totalOrdersAllTime || 0} Pesanan</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">GMV: {formatCurrency(m.totalGMVAllTime || 0)}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Pending Invoices (Perlu Verifikasi)</div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{m.pendingInvoicesCount || 0} Tagihan</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Total Paid: {formatCurrency(m.totalCollectedRevenue || 0)}</div>
          </div>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Ringkasan & Telemetri', icon: Building2 },
          { id: 'tenants', label: `Daftar Tenant (${tenants.length})`, icon: Store },
          { id: 'invoices', label: `Verifikasi Pembayaran (${invoices.filter(i => i.status === 'UNPAID').length})`, icon: CreditCard },
          { id: 'plans', label: 'Paket & Add-on Global', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: OVERVIEW & TELEMETRY ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Plan Distribution */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" /> Distribusi Paket Langganan
            </h3>
            <div className="space-y-3">
              {[
                { code: 'STARTER', label: 'Starter Plan', color: 'bg-slate-500' },
                { code: 'GROWTH', label: 'Growth Plan', color: 'bg-indigo-600' },
                { code: 'BUSINESS', label: 'Business Plan', color: 'bg-purple-600' },
                { code: 'ENTERPRISE', label: 'Enterprise Plan', color: 'bg-amber-500' }
              ].map(p => {
                const count = overviewData?.planDistribution?.[p.code] || 0;
                const total = m.totalTenants || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div key={p.code} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{p.label}</span>
                      <span>{count} Tenant ({percent}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Registered Tenants */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Store size={16} className="text-indigo-600" /> Pendaftaran Tenant Terbaru
              </h3>
              <button onClick={() => setActiveTab('tenants')} className="text-xs font-bold text-indigo-600 hover:underline">
                Lihat Semua
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-2.5 px-3">Nama Usaha</th>
                    <th className="py-2.5 px-3">Subdomain</th>
                    <th className="py-2.5 px-3">Paket</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overviewData?.recentTenants?.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-800">{t.name}</td>
                      <td className="py-3 px-3 font-mono text-indigo-600">{t.slug}.codenusa.id</td>
                      <td className="py-3 px-3 font-semibold text-slate-600">{t.plan}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleImpersonateTenant(t.id, t.name)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <LogIn size={12} /> Masuk
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: TENANT MANAGEMENT TABLE ───────────────────────────────── */}
      {activeTab === 'tenants' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama bisnis, subdomain, atau nama owner..."
                className="form-control pl-10 text-xs text-slate-900 bg-slate-50 font-semibold"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-black text-[10px]">
                  <th className="py-3 px-3">Bisnis &amp; Subdomain</th>
                  <th className="py-3 px-3">Owner Akun</th>
                  <th className="py-3 px-3">Paket SaaS</th>
                  <th className="py-3 px-3">Cabang / Staff</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Aksi Developer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-sm text-slate-900">{t.name}</div>
                      <div className="text-[11px] font-mono text-indigo-600 flex items-center gap-1 mt-0.5">
                        <span>{t.slug}.codenusa.id</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800">{t.owner?.name || 'Owner'}</div>
                      <div className="text-[11px] text-slate-400">@{t.owner?.username}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                        {t.subscription?.planName || 'Growth Plan'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-600">
                      {t.outletsCount} Cabang • {t.usersCount} Staff
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        t.status === 'ACTIVE' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : t.status === 'TRIAL'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1-Click Impersonate */}
                        <button
                          onClick={() => handleImpersonateTenant(t.id, t.name)}
                          disabled={actionLoading === t.id}
                          title="Masuk ke workspace tenant ini"
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        >
                          <LogIn size={13} /> Masuk
                        </button>

                        {/* Extend Trial */}
                        <button
                          onClick={() => handleExtendTrial(t.id, 14)}
                          disabled={actionLoading === t.id}
                          title="Perpanjang masa aktif +14 hari"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Calendar size={13} /> +14 Hari
                        </button>

                        {/* Suspend / Activate Toggle */}
                        <button
                          onClick={() => handleToggleStatus(t.id, t.status)}
                          disabled={actionLoading === t.id}
                          title={t.status === 'ACTIVE' ? 'Tangguhkan Tenant' : 'Aktifkan Tenant'}
                          className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            t.status === 'ACTIVE' 
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' 
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {t.status === 'ACTIVE' ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: INVOICE APPROVAL & VERIFICATION ────────────────────────── */}
      {activeTab === 'invoices' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 animate-fade-in">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Verifikasi Pembayaran Manual &amp; Langganan</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Setujui transfer manual bank dari pelanggan untuk mengaktifkan masa langganan 30 hari secara instan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-black text-[10px]">
                  <th className="py-3 px-3">No. Invoice</th>
                  <th className="py-3 px-3">Tenant Bisnis</th>
                  <th className="py-3 px-3">Paket</th>
                  <th className="py-3 px-3">Nominal</th>
                  <th className="py-3 px-3">Metode</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Aksi Persetujuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada invoice langganan yang tercatat.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{inv.tenant?.name || 'Tenant'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{inv.tenant?.slug}.codenusa.id</div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-600">{inv.plan}</td>
                      <td className="py-3.5 px-3 font-black text-slate-900">{formatCurrency(inv.amount)}</td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          inv.status === 'PAID' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.status === 'PAID' ? 'LUNAS' : 'MENUNGGU VERIFIKASI'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {inv.status === 'UNPAID' ? (
                          <button
                            onClick={() => handleVerifyInvoice(inv.id, inv.invoiceNumber)}
                            disabled={actionLoading === inv.id}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                          >
                            <Check size={13} /> Terima &amp; Aktifkan
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                            <CheckCircle2 size={14} /> Terverifikasi
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
      )}

      {/* ─── TAB 4: GLOBAL PLANS & ADD-ONS ─────────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
          <SaaSPlanManager />
        </div>
      )}

    </div>
  );
};

export default SaaSPlatformAdminView;
