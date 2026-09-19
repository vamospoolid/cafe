import React, { useState, useEffect, useContext } from 'react';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
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
  Store, 
  Layers,
  MessageSquare,
  Phone,
  Mail,
  Edit,
  Send,
  HelpCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import SaaSPlanManager from './SaaSPlanManager';

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  ownerName: string;
  phone: string;
  waNumber: string | null;
  email: string;
  notes?: string;
  createdAt: string;
  trialEndsAt?: string;
  owner: {
    id?: number;
    name: string;
    username?: string;
  };
  subscription?: {
    id: string | null;
    status: string;
    planName: string;
    planCode: string;
    maxOutlets?: number;
    maxUsers?: number;
    maxProducts?: number;
    billingCycle?: string;
    currentPeriodEnd?: string;
  } | null;
  outletsCount: number;
  usersCount: number;
  ordersCount: number;
}

export const SaaSPlatformAdminView: React.FC = () => {
  const posContext = useContext(POSContext);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'invoices' | 'plans'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals state
  const [selectedTenantForWA, setSelectedTenantForWA] = useState<TenantItem | null>(null);
  const [waTemplateType, setWaTemplateType] = useState<'welcome' | 'renewal' | 'support' | 'custom'>('welcome');
  const [waCustomMessage, setWaCustomMessage] = useState<string>('');

  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<TenantItem | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [planBillingCycle, setPlanBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const [selectedTenantForEdit, setSelectedTenantForEdit] = useState<TenantItem | null>(null);
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const formatCurrency = (amount: number) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;

  const fetchPlatformData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      
      const [ovRes, tenRes, invRes, plansRes] = await Promise.all([
        fetch('/api/platform-admin/overview', { headers }),
        fetch('/api/platform-admin/tenants', { headers }),
        fetch('/api/platform-admin/invoices', { headers }),
        fetch('/api/features/plans', { headers })
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
      if (plansRes.ok) {
        const pData = await plansRes.json();
        setPlansList(pData.plans || []);
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

  // 1-Click Tenant Impersonation
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

  // Extend Trial
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

  // Toggle Suspend / Activate
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
        method: 'PATCH',
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

  // Open Edit Contact Modal
  const openEditContact = (tenant: TenantItem) => {
    setSelectedTenantForEdit(tenant);
    setEditOwnerName(tenant.ownerName || tenant.owner?.name || '');
    setEditPhone(tenant.phone || '');
    setEditEmail(tenant.email || '');
    setEditNotes(tenant.notes || '');
  };

  // Save Contact Details
  const handleSaveContact = async () => {
    if (!selectedTenantForEdit) return;
    setActionLoading('save_contact');
    try {
      const res = await fetch(`/api/platform-admin/tenants/${selectedTenantForEdit.id}/contact`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          ownerName: editOwnerName,
          phone: editPhone,
          email: editEmail,
          notes: editNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Data kontak berhasil disimpan', 'success');
        setSelectedTenantForEdit(null);
        fetchPlatformData();
      } else {
        toast(data.error || 'Gagal menyimpan kontak', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Open Change Plan Modal
  const openChangePlan = (tenant: TenantItem) => {
    setSelectedTenantForPlan(tenant);
    const defaultPlan = plansList.find(p => p.code === tenant.subscription?.planCode) || plansList[0];
    setSelectedPlanId(defaultPlan?.id || '');
    setPlanBillingCycle((tenant.subscription?.billingCycle as any) || 'MONTHLY');
  };

  // Save Plan Change
  const handleSavePlanChange = async () => {
    if (!selectedTenantForPlan || !selectedPlanId) return;
    setActionLoading('save_plan');
    try {
      const res = await fetch(`/api/platform-admin/tenants/${selectedTenantForPlan.id}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle: planBillingCycle
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Paket langganan berhasil diperbarui', 'success');
        setSelectedTenantForPlan(null);
        fetchPlatformData();
      } else {
        toast(data.error || 'Gagal mengubah paket', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Open WhatsApp Modal
  const openWhatsAppModal = (tenant: TenantItem) => {
    setSelectedTenantForWA(tenant);
    setWaTemplateType('welcome');
    updateWhatsAppMessage(tenant, 'welcome');
  };

  const updateWhatsAppMessage = (tenant: TenantItem, type: 'welcome' | 'renewal' | 'support' | 'custom') => {
    const owner = tenant.ownerName || tenant.owner?.name || 'Kak';
    const biz = tenant.name;
    const plan = tenant.subscription?.planName || 'Paket CodePOS';
    const subdomain = `${tenant.slug}.codenusa.id`;

    let msg = '';
    if (type === 'welcome') {
      msg = `Halo Kak ${owner}, terima kasih telah mendaftar di CodePOS untuk *${biz}* (${subdomain})! 🚀\n\nAkun Anda telah aktif di *${plan}*. Apakah ada bantuan yang dibutuhkan untuk setup menu, meja, atau printer kasir hari ini?`;
    } else if (type === 'renewal') {
      msg = `Halo Kak ${owner} dari *${biz}*,\n\nKami menginfokan bahwa masa aktif paket *${plan}* Anda akan segera berakhir. Silakan lakukan perpanjangan agar operasional kasir dan laporan omzet tetap berjalan lancar tanpa kendala. 🙏`;
    } else if (type === 'support') {
      msg = `Halo Kak ${owner} dari *${biz}*,\n\nKami dari tim Support Platform CodePOS ingin menanyakan bagaimana operasional kasir Anda hari ini? Jika ada kendala teknis atau saran fitur baru, kami siap membantu.`;
    }
    setWaCustomMessage(msg);
  };

  const handleSendWhatsApp = () => {
    if (!selectedTenantForWA || !selectedTenantForWA.waNumber) {
      toast('Nomor WhatsApp belum terdaftar untuk tenant ini', 'warning');
      return;
    }
    const url = `https://wa.me/${selectedTenantForWA.waNumber}?text=${encodeURIComponent(waCustomMessage)}`;
    window.open(url, '_blank');
    setSelectedTenantForWA(null);
  };

  // Verify Invoice
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
                          t.ownerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.phone?.includes(searchQuery) ||
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
              <Sparkles size={16} /> SaaS Platform Executive &amp; Financial Center
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Platform Master Command
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Kontrol keuangan platform SaaS, CRM kontak WhatsApp pemilik kafe, manajemen paket, dan telemetri multi-tenant.
            </p>
          </div>

          <button
            onClick={fetchPlatformData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>

        {/* ─── Master Revenue & Tenant Metrics ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 relative z-10">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-400" /> MRR (Monthly Recurring)
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{formatCurrency(m.mrr || 0)}</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">ARR: {formatCurrency(m.arr || 0)}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Store size={12} className="text-indigo-400" /> Total Kafe / Tenant
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{m.totalTenants || 0} Bisnis</div>
            <div className="text-[10px] font-semibold text-indigo-300 mt-0.5">{m.activeTenants || 0} Aktif • {m.trialTenants || 0} Trial</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Layers size={12} className="text-cyan-400" /> Total Transaksi POS
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">{m.totalOrdersAllTime || 0} Pesanan</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">GMV: {formatCurrency(m.totalGMVAllTime || 0)}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <CreditCard size={12} className="text-amber-400" /> Tagihan Pending
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{m.pendingInvoicesCount || 0} Tagihan</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Total Paid: {formatCurrency(m.totalCollectedRevenue || 0)}</div>
          </div>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Ringkasan & Finansial', icon: Building2 },
          { id: 'tenants', label: `Direktori Tenant CRM (${tenants.length})`, icon: Store },
          { id: 'invoices', label: `Verifikasi Pembayaran (${invoices.filter(i => i.status === 'UNPAID').length})`, icon: CreditCard },
          { id: 'plans', label: 'Master Paket & Harga', icon: Sliders }
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
                { code: 'STARTER', label: 'Starter Plan (1 Cabang)', color: 'bg-slate-500' },
                { code: 'GROWTH', label: 'Growth Plan (3 Cabang)', color: 'bg-indigo-600' },
                { code: 'BUSINESS', label: 'Business Plan (10 Cabang)', color: 'bg-purple-600' },
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
              <button onClick={() => setActiveTab('tenants')} className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">
                Buka Direktori Lengkap &rarr;
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

      {/* ─── TAB 2: TENANT MANAGEMENT & CRM DIRECTORY ─────────────────────── */}
      {activeTab === 'tenants' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama resto, no HP/WA, nama owner, subdomain..."
                className="form-control pl-10 text-xs text-slate-900 bg-slate-50 font-semibold"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                  <th className="py-3 px-3">Kontak Owner (WhatsApp)</th>
                  <th className="py-3 px-3">Paket &amp; Kuota</th>
                  <th className="py-3 px-3">Status Akun</th>
                  <th className="py-3 px-3 text-right">Aksi Manajemen &amp; Chat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                      Tidak ada tenant yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      
                      {/* Business & Domain */}
                      <td className="py-3.5 px-3">
                        <div className="font-black text-sm text-slate-900">{t.name}</div>
                        <a 
                          href={`https://${t.slug}.codenusa.id`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[11px] font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-0.5"
                        >
                          <span>{t.slug}.codenusa.id</span>
                          <ExternalLink size={10} />
                        </a>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Daftar: {new Date(t.createdAt).toLocaleDateString('id-ID')}
                        </div>
                      </td>

                      {/* Owner & WhatsApp Contact */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{t.ownerName || t.owner?.name || 'Owner'}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {t.phone ? (
                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Phone size={10} className="text-emerald-600" /> {t.phone}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-semibold italic">Belum ada No. HP</span>
                          )}
                        </div>
                        {t.email && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail size={10} /> {t.email}
                          </div>
                        )}
                      </td>

                      {/* Plan & Quotas */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                            {t.subscription?.planName || 'Starter Plan'}
                          </span>
                          <button
                            onClick={() => openChangePlan(t)}
                            title="Ubah Paket Langganan"
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600 font-semibold mt-1">
                          {t.outletsCount} / {t.subscription?.maxOutlets ?? 1} Cabang • {t.usersCount} Staff
                        </div>
                      </td>

                      {/* Status */}
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
                        {t.trialEndsAt && t.status === 'TRIAL' && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Trial s/d {new Date(t.trialEndsAt).toLocaleDateString('id-ID')}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* 1-Click WhatsApp Chat */}
                          <button
                            onClick={() => openWhatsAppModal(t)}
                            title="Chat WhatsApp dengan Owner"
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                          >
                            <MessageSquare size={13} /> Chat WA
                          </button>

                          {/* Edit Contact CRM */}
                          <button
                            onClick={() => openEditContact(t)}
                            title="Edit Data Kontak CRM"
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                          >
                            <Edit size={14} />
                          </button>

                          {/* 1-Click Impersonate */}
                          <button
                            onClick={() => handleImpersonateTenant(t.id, t.name)}
                            disabled={actionLoading === t.id}
                            title="Masuk ke dashboard tenant ini"
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                          >
                            <LogIn size={13} /> Masuk
                          </button>

                          {/* Extend Trial */}
                          <button
                            onClick={() => handleExtendTrial(t.id, 14)}
                            disabled={actionLoading === t.id}
                            title="Perpanjang masa aktif +14 hari"
                            className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Calendar size={13} /> +14H
                          </button>

                          {/* Suspend / Activate Toggle */}
                          <button
                            onClick={() => handleToggleStatus(t.id, t.status)}
                            disabled={actionLoading === t.id}
                            title={t.status === 'ACTIVE' ? 'Tangguhkan (Suspend)' : 'Aktifkan Tenant'}
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
                  ))
                )}
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

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: 1-CLICK WHATSAPP CHAT ASSISTANT                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {selectedTenantForWA && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 relative border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Direct WhatsApp Assistant</h3>
                  <p className="text-xs text-slate-500">Kirim pesan cepat ke pemilik {selectedTenantForWA.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTenantForWA(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Owner Info */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-700">Penerima Pesan</div>
                <div className="font-bold text-sm text-slate-900">{selectedTenantForWA.ownerName || selectedTenantForWA.owner?.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-emerald-700">Nomor WhatsApp</div>
                <div className="font-mono font-bold text-xs text-slate-800">{selectedTenantForWA.phone || 'Tidak tersedia'}</div>
              </div>
            </div>

            {/* Template Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Pilih Template Pesan:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'welcome', label: '🚀 Selamat Datang' },
                  { type: 'renewal', label: '💳 Perpanjangan' },
                  { type: 'support', label: '🛠️ Support Teknis' }
                ].map(t => (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => {
                      setWaTemplateType(t.type as any);
                      updateWhatsAppMessage(selectedTenantForWA, t.type as any);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      waTemplateType === t.type 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Isi Pesan:</label>
              <textarea
                rows={5}
                className="form-control text-xs leading-relaxed"
                value={waCustomMessage}
                onChange={e => {
                  setWaCustomMessage(e.target.value);
                  setWaTemplateType('custom');
                }}
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTenantForWA(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Send size={14} /> Buka WhatsApp Web / App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: UBAH PAKET & KUOTA TENANT                                       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {selectedTenantForPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 relative border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Ubah Paket Langganan</h3>
                  <p className="text-xs text-slate-500">{selectedTenantForPlan.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTenantForPlan(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Paket SaaS:</label>
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="form-control text-xs font-bold"
                >
                  {plansList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) — {p.maxOutlets} Cabang, {p.maxUsers} Staf
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Siklus Penagihan:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanBillingCycle('MONTHLY')}
                    className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      planBillingCycle === 'MONTHLY' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Bulanan (Monthly)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanBillingCycle('YEARLY')}
                    className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      planBillingCycle === 'YEARLY' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Tahunan (Yearly)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTenantForPlan(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePlanChange}
                disabled={actionLoading === 'save_plan'}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-md shadow-indigo-600/20"
              >
                {actionLoading === 'save_plan' ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT KONTAK & CATATAN CRM TENANT                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {selectedTenantForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 relative border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Edit size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Edit Profil &amp; Kontak CRM</h3>
                  <p className="text-xs text-slate-500">{selectedTenantForEdit.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTenantForEdit(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Pemilik (Owner):</label>
                <input
                  type="text"
                  className="form-control text-xs font-bold"
                  value={editOwnerName}
                  onChange={e => setEditOwnerName(e.target.value)}
                  placeholder="Contoh: Bpk. Rudi Santoso"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">No. WhatsApp / HP:</label>
                <input
                  type="text"
                  className="form-control text-xs font-mono font-bold"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Pemilik:</label>
                <input
                  type="email"
                  className="form-control text-xs"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="owner@mukiramen.com"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Internal CRM:</label>
                <textarea
                  rows={3}
                  className="form-control text-xs"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Catatan khusus tentang tenant ini..."
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTenantForEdit(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={actionLoading === 'save_contact'}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              >
                {actionLoading === 'save_contact' ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SaaSPlatformAdminView;
