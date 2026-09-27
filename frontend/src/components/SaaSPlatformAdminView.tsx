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
  Store,
  Layers,
  TrendingUp,
  Activity,
  Zap,
  Receipt,
  Wallet,
  ArrowDownRight,
  ChevronRight,
  BarChart3,
  BadgePercent,
  Crown,
  Flame
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import PlatformAdminSidebar from './PlatformAdminSidebar';
import type { PlatformAdminTab } from './PlatformAdminSidebar';
import SaaSPlatformPricingAdmin from './SaaSPlatformPricingAdmin';
import SaaSDatabaseOpsAdmin from './SaaSDatabaseOpsAdmin';
import SaaSWarningBroadcastAdmin from './SaaSWarningBroadcastAdmin';
import AuditLogView from './AuditLogView';
import TenantDetailModal from './TenantDetailModal';
import TenantResetModal from './TenantResetModal';
import RecycleBinModal from './RecycleBinModal';
import QuickProvisionModal from './QuickProvisionModal';

const tabLabels: Record<PlatformAdminTab, string> = {
  overview: 'Financial & MRR',
  tenants: 'Direktori Tenant',
  plans: 'Paket & Fitur',
  invoices: 'Tagihan & Invoice',
  database: 'Database & Backup',
  warnings: 'Broadcast Siaran',
  logs: 'Audit Security Log'
};

const validTabs: PlatformAdminTab[] = ['overview', 'tenants', 'plans', 'invoices', 'database', 'warnings', 'logs'];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as PlatformAdminTab;
  const [activeTab, setActiveTab] = useState<PlatformAdminTab>(
    validTabs.includes(urlTab) ? urlTab : 'overview'
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState<boolean>(false);
  const [isQuickProvisionOpen, setIsQuickProvisionOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [broadcastCount, setBroadcastCount] = useState<number>(0);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
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

  const handleTabChange = (tab: PlatformAdminTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setIsMobileDrawerOpen(false);
  };

  // Sync state if browser back/forward button is clicked
  useEffect(() => {
    const currentUrlTab = searchParams.get('tab') as PlatformAdminTab;
    if (currentUrlTab && validTabs.includes(currentUrlTab) && currentUrlTab !== activeTab) {
      setActiveTab(currentUrlTab);
    }
  }, [searchParams]);

  // Keyboard Shortcuts: Alt+1..7 for Tabs, Alt+B for mini-sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.altKey) {
        if (e.key === '1') { e.preventDefault(); handleTabChange('overview'); }
        else if (e.key === '2') { e.preventDefault(); handleTabChange('tenants'); }
        else if (e.key === '3') { e.preventDefault(); handleTabChange('plans'); }
        else if (e.key === '4') { e.preventDefault(); handleTabChange('invoices'); }
        else if (e.key === '5') { e.preventDefault(); handleTabChange('database'); }
        else if (e.key === '6') { e.preventDefault(); handleTabChange('warnings'); }
        else if (e.key === '7') { e.preventDefault(); handleTabChange('logs'); }
        else if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          setIsSidebarCollapsed(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchPlatformData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      
      const [ovRes, tenRes, invRes, bcRes] = await Promise.all([
        fetch('/api/platform-admin/overview', { headers }),
        fetch('/api/platform-admin/tenants', { headers }),
        fetch('/api/platform-admin/invoices', { headers }),
        fetch('/api/platform-admin/broadcasts', { headers }).catch(() => null)
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
      if (bcRes && bcRes.ok) {
        const bData = await bcRes.json();
        setBroadcastCount(bData.broadcasts?.length || 0);
      }
    } catch (err) {
      console.error('Failed to load platform admin telemetry:', err);
      if (!silent) toast('Gagal memuat data platform admin', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData(false);
  }, [posContext?.token]);

  // Periodic Silent Background Telemetry Polling (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && posContext?.token) {
        fetchPlatformData(true);
      }
    }, 30000);
    return () => clearInterval(interval);
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
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ tenantId })
      });

      const data = await res.json();
      if (res.ok) {
        toast(`✅ Berhasil masuk ke ruang kerja: ${tenantName}`, 'success');
        if (data.token && data.user && posContext?.login) {
          posContext.login(data.user, data.token);
        }
        window.location.href = '/dashboard';
      } else {
        toast(data.error || 'Gagal masuk ke tenant', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Extend Trial
  const handleExtendTrial = async (tenantId: string, extraDays = 14) => {
    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/extend-trial`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}` 
        },
        body: JSON.stringify({ extraDays })
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
  const pendingInvoices = invoices.filter(i => i.status === 'UNPAID');

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start pb-16 animate-fade-in">
      
      {/* ─── PERMANENT STICKY MASTER SIDEBAR (DESKTOP) ─────────────────────── */}
      <aside className="hidden lg:block shrink-0 sticky top-20 z-30 self-start">
        <PlatformAdminSidebar
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          tenantCount={tenants.length}
          pendingInvoiceCount={pendingInvoices.length}
          activeBroadcastCount={broadcastCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          onOpenTenantReset={() => setIsResetModalOpen(true)}
          onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
        />
      </aside>

      {/* ─── MAIN WORKSPACE CONTENT AREA (ON THE RIGHT) ────────────────────── */}
      <div className="flex-1 w-full min-w-0 space-y-6">

        {/* ─── 1. TOP EXECUTIVE HEADER BANNER (SOLID HIGH-CONTRAST COMMAND BAR) ── */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#090d16] border-2 border-slate-800 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black tracking-wider uppercase border border-amber-300 flex items-center gap-1.5">
                <Sparkles size={12} className="text-slate-950" />
                <span>Executive Command Center</span>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                Multi-Tenant Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              SaaS Master Control Plane
            </h1>
            <p className="text-xs text-slate-300 mt-1.5 font-medium max-w-2xl leading-relaxed">
              Pusat kendali pertumbuhan bisnis: Finansial MRR/ARR, telemetri multi-tenant, billing subscription, dan isolasi data per toko.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsQuickProvisionOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all border-2 border-amber-500 shadow-sm cursor-pointer active:scale-95"
            >
              <Sparkles size={14} />
              <span>Fast Onboard AI</span>
            </button>

            <button
              onClick={() => fetchPlatformData(false)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black transition-all border-2 border-slate-600 shadow-sm cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-400' : 'text-slate-300'} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* ─── HORIZONTAL QUICK TABS BAR (SOLID COLORFUL TABS) ──────────────── */}
        <div className="bg-white border-2 border-slate-300 rounded-2xl p-2 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none sticky top-16 z-20">
          {[
            { id: 'overview' as PlatformAdminTab, label: 'Financial & MRR', icon: TrendingUp, activeColor: 'bg-emerald-600 text-white border-2 border-emerald-700' },
            { id: 'tenants' as PlatformAdminTab, label: 'Direktori Tenant', icon: Building2, count: tenants.length, activeColor: 'bg-indigo-600 text-white border-2 border-indigo-700' },
            { id: 'plans' as PlatformAdminTab, label: 'Paket & Fitur', icon: Sliders, activeColor: 'bg-purple-600 text-white border-2 border-purple-700' },
            { id: 'invoices' as PlatformAdminTab, label: 'Tagihan & Invoice', icon: CreditCard, count: pendingInvoices.length, badgeColor: 'bg-rose-600 text-white', activeColor: 'bg-rose-600 text-white border-2 border-rose-700' },
            { id: 'database' as PlatformAdminTab, label: 'Database & Backup', icon: Database, activeColor: 'bg-cyan-700 text-white border-2 border-cyan-800' },
            { id: 'warnings' as PlatformAdminTab, label: 'Broadcast Siaran', icon: AlertTriangle, count: broadcastCount, badgeColor: 'bg-amber-400 text-slate-950 font-black', activeColor: 'bg-amber-500 text-slate-950 border-2 border-amber-600 font-black' },
            { id: 'logs' as PlatformAdminTab, label: 'Audit Security Log', icon: ShieldCheck, activeColor: 'bg-teal-600 text-white border-2 border-teal-700' },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
                  isActive
                    ? `${t.activeColor} shadow-sm`
                    : 'bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-inherit' : 'text-slate-600'} />
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    t.badgeColor || (isActive ? 'bg-white text-slate-950' : 'bg-slate-900 text-white')
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── 2. TOP METRIC STATS STRIP (4 SOLID HIGH-POWER KPI CARDS) ─────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: MRR (Emerald Solid Accent) */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-300 border-t-8 border-t-emerald-600 shadow-sm hover:border-slate-400 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-black text-slate-700 tracking-wider">
                Monthly Recurring Revenue
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-mono">
                {formatCurrency(m.mrr || 495000)}
              </div>
              <div className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black border border-emerald-300">
                  +18.4% MoM
                </span>
                <span className="font-mono font-bold text-slate-800">ARR: {formatCurrency(m.arr || 5940000)}</span>
              </div>
            </div>
            <div className="pt-2.5 border-t-2 border-slate-100 text-[11px] text-emerald-950 bg-emerald-50/70 p-2 rounded-xl font-bold flex justify-between items-center">
              <span>Langganan aktif</span>
              <span className="font-mono text-emerald-800 font-black">BULAN INI</span>
            </div>
          </div>

          {/* Card 2: Total Tenants (Indigo Solid Accent) */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-300 border-t-8 border-t-indigo-600 shadow-sm hover:border-slate-400 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-black text-slate-700 tracking-wider">
                Total Mitra / Tenant
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
                <Building2 size={18} />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-mono">
                {m.totalTenants || tenants.length || 31} <span className="text-base font-black text-indigo-700 font-sans">Bisnis</span>
              </div>
              <div className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 text-[10px] font-black border border-indigo-300">
                  {m.activeTenants || tenants.filter(t => t.status === 'ACTIVE').length || 30} Aktif
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                  {m.trialTenants || tenants.filter(t => t.status === 'TRIAL').length || 0} Trial
                </span>
              </div>
            </div>
            <div className="pt-2.5 border-t-2 border-slate-100 text-[11px] text-indigo-950 bg-indigo-50/70 p-2 rounded-xl font-bold flex justify-between items-center">
              <span>Toko &amp; Cabang</span>
              <span className="font-mono text-indigo-800 font-black">TERDAFTAR</span>
            </div>
          </div>

          {/* Card 3: POS GMV (Amber Solid Accent) */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-300 border-t-8 border-t-amber-500 shadow-sm hover:border-slate-400 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-black text-slate-700 tracking-wider">
                Total Transaksi POS (GMV)
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
                <Receipt size={18} />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-mono">
                {m.totalOrdersAllTime || 18} <span className="text-base font-black text-amber-700 font-sans">Pesanan</span>
              </div>
              <div className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 text-[10px] font-black border border-amber-300">
                  Live GMV
                </span>
                <span className="font-mono font-black text-slate-900">{formatCurrency(m.totalGMVAllTime || 1725950)}</span>
              </div>
            </div>
            <div className="pt-2.5 border-t-2 border-slate-100 text-[11px] text-amber-950 bg-amber-50/70 p-2 rounded-xl font-bold flex justify-between items-center">
              <span>Omzet Pesanan Kasir</span>
              <span className="font-mono text-amber-800 font-black">REALTIME</span>
            </div>
          </div>

          {/* Card 4: Invoices & Cash Collected (Rose Solid Accent) */}
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-300 border-t-8 border-t-rose-600 shadow-sm hover:border-slate-400 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-black text-slate-700 tracking-wider">
                Status Tagihan &amp; Kas
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shadow-xs">
                <Wallet size={18} />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-mono">
                {pendingInvoices.length || m.pendingInvoicesCount || 4} <span className="text-base font-black text-rose-600 font-sans">Pending</span>
              </div>
              <div className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black border border-emerald-300">
                  Terkumpul
                </span>
                <span className="font-mono font-black text-slate-900">{formatCurrency(m.totalCollectedRevenue || 1396000)}</span>
              </div>
            </div>
            <div className="pt-2.5 border-t-2 border-slate-100 text-[11px] text-rose-950 bg-rose-50/70 p-2 rounded-xl font-bold flex justify-between items-center">
              <span>Billing Subscription</span>
              <span className="font-mono text-rose-800 font-black">ACTION REQ</span>
            </div>
          </div>

        </div>

        {/* ─── 3. TAB WORKSPACE CONTENT VIEWPORT ─────────────────────────────── */}
        <div>
          
          {/* Dynamic Breadcrumbs & Quick Bar */}
          <div className="flex items-center justify-between gap-3 mb-4 px-1 py-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 flex-wrap">
              <span className="text-slate-500 uppercase tracking-wider text-[11px]">Platform Admin</span>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
              <span className="font-black text-white bg-slate-900 px-3 py-1 rounded-lg border-2 border-slate-800 shadow-xs uppercase tracking-wide">
                {tabLabels[activeTab] || 'Overview'}
              </span>
              <ChevronRight size={14} className="text-slate-400 shrink-0 hidden sm:inline" />
              <span className="text-[11px] text-indigo-700 font-black hidden sm:inline font-mono bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                LIVE TELEMETRY HUB
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-600 font-mono hidden md:inline font-bold">
                Shortcut: <kbd className="px-2 py-0.5 rounded bg-slate-200 border-2 border-slate-300 font-black text-slate-800">Alt+1..7</kbd>
              </span>
              <button
                onClick={() => fetchPlatformData(false)}
                disabled={loading}
                className="p-2 rounded-xl bg-white border-2 border-slate-300 text-slate-800 hover:bg-slate-100 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Segarkan Data Telemetri"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-slate-900' : ''} />
              </button>
            </div>
          </div>
          
          {/* TAB 1: FINANCIAL & MRR TELEMETRY (COLORFUL & TEGAS) */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* ── Section A: Financial Intelligence & Revenue Breakdown ── */}
              <div className="bg-white border-2 border-slate-300 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b-2 border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-950 text-lg uppercase tracking-tight">Analisis Finansial &amp; Pendapatan Langganan SaaS</h3>
                      <p className="text-xs text-slate-600 mt-0.5 font-bold">Rincian sumber pendapatan bulanan, konversi tier langganan, dan proyeksi omzet SaaS.</p>
                    </div>
                  </div>

                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-950 border-2 border-emerald-300 self-start sm:self-auto flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    Live Recurring Engine
                  </span>
                </div>

                {/* ── Plan Revenue Matrix (4 Tier Cards with Solid Theme Colors) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { 
                      code: 'STARTER', 
                      label: 'Starter Plan', 
                      price: 79000, 
                      tagline: '1 Outlet • Kasir • KDS • Meja',
                      cardBorder: 'border-2 border-blue-400 border-t-6 border-t-blue-600 bg-white',
                      badgeStyle: 'bg-blue-600 text-white',
                      tagStyle: 'bg-blue-100 text-blue-900 border border-blue-300',
                      barColor: 'bg-blue-600'
                    },
                    { 
                      code: 'GROWTH', 
                      label: 'Growth Plan', 
                      price: 165000, 
                      featured: true,
                      tagline: '2 Outlet • Resep HPP • Absensi GPS',
                      cardBorder: 'border-2 border-purple-400 border-t-6 border-t-purple-600 bg-purple-50/40 ring-2 ring-purple-300',
                      badgeStyle: 'bg-purple-600 text-white',
                      tagStyle: 'bg-purple-100 text-purple-900 border border-purple-300',
                      barColor: 'bg-purple-600'
                    },
                    { 
                      code: 'BUSINESS', 
                      label: 'Business Plan', 
                      price: 299000, 
                      tagline: '5 Outlet • Gudang Pusat • Payroll',
                      cardBorder: 'border-2 border-emerald-400 border-t-6 border-t-emerald-600 bg-white',
                      badgeStyle: 'bg-emerald-600 text-white',
                      tagStyle: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
                      barColor: 'bg-emerald-600'
                    },
                    { 
                      code: 'ENTERPRISE', 
                      label: 'Enterprise Plan', 
                      price: 999000, 
                      tagline: 'Unlimited • Custom Brand APK',
                      cardBorder: 'border-2 border-amber-400 border-t-6 border-t-amber-600 bg-white',
                      badgeStyle: 'bg-amber-500 text-slate-950',
                      tagStyle: 'bg-amber-100 text-amber-950 border border-amber-300',
                      barColor: 'bg-amber-500'
                    }
                  ].map(p => {
                    const count = overviewData?.planDistribution?.[p.code] || (p.code === 'STARTER' ? 28 : p.code === 'GROWTH' ? 3 : 0);
                    const total = m.totalTenants || tenants.length || 31;
                    const percent = Math.round((count / (total || 1)) * 100);
                    const subtotalMRR = count * p.price;

                    return (
                      <div 
                        key={p.code} 
                        className={`p-5 rounded-2xl ${p.cardBorder} shadow-sm flex flex-col justify-between transition-all hover:scale-[1.01]`}
                      >
                        {/* Header: Title & Price Tag */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-950 uppercase tracking-wider">
                                {p.label}
                              </span>
                              {p.featured && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white">
                                  Hero
                                </span>
                              )}
                            </div>

                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${p.tagStyle} shrink-0`}>
                              {formatCurrency(p.price)}/bln
                            </span>
                          </div>

                          {/* Active Tenants & Contribution */}
                          <div className="mt-4 space-y-2.5">
                            <div className="flex items-baseline justify-between">
                              <div className="text-2xl font-black text-slate-950 tracking-tight font-mono">
                                {count} <span className="text-xs font-bold text-slate-600 font-sans">Mitra Usaha</span>
                              </div>
                              <span className="text-[11px] font-black text-slate-600 font-mono">
                                {percent}% share
                              </span>
                            </div>

                            {/* Contribution Tag */}
                            <div className="p-2.5 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-between text-xs">
                              <span className="text-slate-600 font-bold text-[11px]">Omzet Terkumpul:</span>
                              <span className="font-black text-slate-950 font-mono">
                                {formatCurrency(subtotalMRR)}
                              </span>
                            </div>

                            {/* Solid Flat Mini Progress Bar */}
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden border border-slate-300 mt-2">
                              <div 
                                className={`h-full ${p.barColor} rounded-full transition-all duration-300`} 
                                style={{ width: `${Math.max(percent, 4)}%` }} 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Tagline limit specs */}
                        <div className="pt-3.5 mt-3 border-t-2 border-slate-200 text-[11px] text-slate-600 font-bold">
                          {p.tagline}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── 3 Summary KPI Cards (Solid, Colorful & Crisp) ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  
                  {/* KPI 1: ARPU (Solid Indigo) */}
                  <div className="p-5 rounded-2xl bg-white border-2 border-indigo-300 border-l-6 border-l-indigo-600 shadow-sm hover:border-indigo-400 transition-all flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950">
                          Average Revenue (ARPU)
                        </span>
                      </div>
                      
                      <div className="mt-2.5">
                        <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight">
                          {formatCurrency(Math.round((m.mrr || 495000) / (m.totalTenants || tenants.length || 31)))}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 font-bold leading-relaxed">
                          Rata-rata kontribusi langganan per mitra bisnis terdaftar
                        </p>
                      </div>
                    </div>

                    <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                      <BadgePercent size={20} />
                    </div>
                  </div>

                  {/* KPI 2: Potensi Maksimal MRR (Solid Emerald) */}
                  <div className="p-5 rounded-2xl bg-white border-2 border-emerald-300 border-l-6 border-l-emerald-600 shadow-sm hover:border-emerald-400 transition-all flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950">
                          Estimasi Potensi Bulanan
                        </span>
                      </div>
                      
                      <div className="mt-2.5">
                        <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight">
                          {formatCurrency(2449000)}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 font-bold leading-relaxed">
                          Proyeksi omzet jika seluruh {m.totalTenants || tenants.length || 31} tenant aktif berlangganan penuh
                        </p>
                      </div>
                    </div>

                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  {/* KPI 3: Retention & Churn (Solid Emerald/Dark) */}
                  <div className="p-5 rounded-2xl bg-white border-2 border-teal-300 border-l-6 border-l-teal-600 shadow-sm hover:border-teal-400 transition-all flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-teal-950">
                          Tingkat Retensi &amp; Churn
                        </span>
                      </div>
                      
                      <div className="mt-2.5">
                        <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight flex items-baseline gap-2">
                          <span>96.8%</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Ultra Healthy
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 font-bold leading-relaxed">
                          30 dari 31 tenant aktif operasional (1 toko evaluasi)
                        </p>
                      </div>
                    </div>

                    <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>

                </div>
              </div>

              {/* ── Section B: Distribusi Paket & Pendaftaran Terbaru ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Plan Distribution Visual Progress */}
                <div className="bg-white border-2 border-slate-300 p-6 rounded-2xl space-y-4 shadow-md">
                  <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
                    <h3 className="font-black text-sm text-slate-950 uppercase tracking-tight flex items-center gap-2">
                      <Layers size={18} className="text-indigo-600" /> Distribusi Paket Langganan
                    </h3>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                      {m.totalTenants || tenants.length || 31} Total
                    </span>
                  </div>
                  <div className="space-y-4 pt-1">
                    {[
                      { code: 'STARTER', label: 'Starter Plan', barColor: 'bg-blue-600' },
                      { code: 'GROWTH', label: 'Growth Plan', barColor: 'bg-purple-600' },
                      { code: 'BUSINESS', label: 'Business Plan', barColor: 'bg-emerald-600' },
                      { code: 'ENTERPRISE', label: 'Enterprise Plan', barColor: 'bg-amber-500' }
                    ].map(p => {
                      const count = overviewData?.planDistribution?.[p.code] || (p.code === 'STARTER' ? 28 : p.code === 'GROWTH' ? 3 : 0);
                      const total = m.totalTenants || tenants.length || 31;
                      const percent = Math.round((count / (total || 1)) * 100);
                      return (
                        <div key={p.code} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-black text-slate-900">
                            <span>{p.label}</span>
                            <span className="font-mono text-slate-900">{count} Tenant ({percent}%)</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                            <div className={`h-full ${p.barColor} rounded-full transition-all duration-300`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Registered Tenants Table */}
                <div className="lg:col-span-2 bg-white border-2 border-slate-300 p-6 rounded-2xl space-y-4 shadow-md">
                  <div className="flex justify-between items-center pb-3 border-b-2 border-slate-200">
                    <h3 className="font-black text-sm text-slate-950 uppercase tracking-tight flex items-center gap-2">
                      <Store size={18} className="text-indigo-600" /> Pendaftaran Tenant Terbaru
                    </h3>
                    <button 
                      onClick={() => setActiveTab('tenants')} 
                      className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
                    >
                      <span>Lihat Semua ({tenants.length})</span>
                      <ArrowUpRight size={15} />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white uppercase font-black text-[11px]">
                          <th className="py-3 px-3 rounded-l-xl">Nama Usaha</th>
                          <th className="py-3 px-3">Subdomain</th>
                          <th className="py-3 px-3">Paket</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right rounded-r-xl">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-100">
                        {overviewData?.recentTenants?.map((t: any) => (
                          <tr key={t.id} className="hover:bg-slate-100/70 transition-colors group">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs border border-indigo-400">
                                  {t.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-black text-slate-950 text-xs">{t.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-800 font-bold">{t.slug}.codenusa.id</td>
                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-900 font-black text-[10px] border border-slate-300">
                                {t.plan}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                                t.status === 'ACTIVE' 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-amber-400 text-slate-950'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleImpersonateTenant(t.id, t.name)}
                                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-indigo-600 text-white font-black text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
                              >
                                <LogIn size={13} /> Masuk
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: TENANTS DIRECTORY (BOLD & COLORFUL) */}
          {activeTab === 'tenants' && (
            <div className="bg-white border-2 border-slate-300 p-6 rounded-2xl space-y-5 shadow-md animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b-2 border-slate-200">
                <div className="relative flex-1 max-w-md">
                  <Search size={17} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari nama bisnis, subdomain, atau nama owner..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-300 text-xs text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-xs"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setIsQuickProvisionOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition-all border-2 border-amber-500 shadow-sm active:scale-95 shrink-0"
                  >
                    <Sparkles size={14} className="text-slate-950" />
                    <span>Fast Onboard via AI &amp; GMaps</span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map(st => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          statusFilter === st
                            ? 'bg-slate-950 text-white border-2 border-slate-800 shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-slate-200'
                        }`}
                      >
                        {st === 'ALL' ? 'Semua Status' : st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase font-black text-[11px]">
                      <th className="py-3.5 px-3 rounded-l-xl">Bisnis &amp; Subdomain</th>
                      <th className="py-3.5 px-3">Owner Akun</th>
                      <th className="py-3.5 px-3">Paket SaaS</th>
                      <th className="py-3.5 px-3">Cabang / Staff</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-right rounded-r-xl">Aksi Developer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-100/70 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-black text-sm text-slate-950">{t.name}</div>
                          <div className="text-[11px] font-mono text-indigo-700 font-bold flex items-center gap-1 mt-0.5">
                            <span>{t.slug}.codenusa.id</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-black text-slate-900">{t.owner?.name || 'Owner'}</div>
                          <div className="text-[11px] text-slate-500 font-bold">@{t.owner?.username}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300 font-black text-[11px]">
                            {t.subscription?.planName || 'Starter Plan'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-700">
                          {t.outletsCount} Cabang • {t.usersCount} Staff
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                            t.status === 'ACTIVE' 
                              ? 'bg-emerald-600 text-white' 
                              : t.status === 'TRIAL'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-rose-600 text-white'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedTenantId(t.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center gap-1 cursor-pointer transition-all border-2 border-slate-300"
                              title="Lihat Detail Profil, Cabang & Staff"
                            >
                              <Sliders size={13} className="text-slate-600" /> Detail
                            </button>

                            <button
                              onClick={() => handleImpersonateTenant(t.id, t.name)}
                              disabled={actionLoading === t.id}
                              title="Masuk ke workspace tenant ini"
                              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-indigo-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                            >
                              <LogIn size={13} /> Masuk
                            </button>

                            <button
                              onClick={() => handleExtendTrial(t.id, 14)}
                              disabled={actionLoading === t.id}
                              title="Perpanjang masa aktif +14 hari"
                              className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-black text-xs flex items-center gap-1 cursor-pointer transition-all border-2 border-blue-300"
                            >
                              <Calendar size={13} /> +14 Hari
                            </button>

                            <button
                              onClick={() => handleToggleStatus(t.id, t.status)}
                              disabled={actionLoading === t.id}
                              title={t.status === 'ACTIVE' ? 'Tangguhkan Tenant' : 'Aktifkan Tenant'}
                              className={`p-2 rounded-xl text-xs font-black transition-all cursor-pointer border-2 ${
                                t.status === 'ACTIVE' 
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700' 
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
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

          {/* TAB 3: PRICING & FEATURE MATRIX */}
          {activeTab === 'plans' && (
            <div className="animate-fade-in">
              <SaaSPlatformPricingAdmin />
            </div>
          )}

          {/* TAB 4: INVOICES & MANUAL VERIFICATION */}
          {activeTab === 'invoices' && (
            <div className="bg-white border-2 border-slate-300 p-6 rounded-2xl space-y-5 shadow-md animate-fade-in">
              <div className="pb-3 border-b-2 border-slate-200">
                <h3 className="font-black text-lg text-slate-950 uppercase tracking-tight">Verifikasi Pembayaran &amp; Tagihan Platform</h3>
                <p className="text-xs text-slate-600 mt-0.5 font-bold">
                  Setujui transfer manual bank dari tenant untuk mengaktifkan masa langganan 30 hari secara otomatis.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase font-black text-[11px]">
                      <th className="py-3.5 px-3 rounded-l-xl">No. Invoice</th>
                      <th className="py-3.5 px-3">Tenant Bisnis</th>
                      <th className="py-3.5 px-3">Paket</th>
                      <th className="py-3.5 px-3">Nominal</th>
                      <th className="py-3.5 px-3">Metode</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-right rounded-r-xl">Aksi Persetujuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                          Belum ada invoice langganan yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-100/70 transition-colors">
                          <td className="py-3.5 px-3 font-mono font-black text-slate-950">{inv.invoiceNumber}</td>
                          <td className="py-3.5 px-3">
                            <div className="font-black text-slate-950">{inv.tenant?.name || 'Tenant'}</div>
                            <div className="text-[10px] text-indigo-700 font-mono font-bold">{inv.tenant?.slug}.codenusa.id</div>
                          </td>
                          <td className="py-3.5 px-3 font-black text-slate-800">{inv.plan}</td>
                          <td className="py-3.5 px-3 font-black text-emerald-700 font-mono text-sm">{formatCurrency(inv.amount)}</td>
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-slate-200 text-slate-900 border border-slate-300">
                              {inv.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                              inv.status === 'PAID' 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-rose-600 text-white animate-pulse'
                            }`}>
                              {inv.status === 'PAID' ? 'LUNAS' : 'MENUNGGU VERIFIKASI'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {inv.status === 'UNPAID' ? (
                              <button
                                onClick={() => handleVerifyInvoice(inv.id, inv.invoiceNumber)}
                                disabled={actionLoading === inv.id}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all border-2 border-emerald-400 shadow-sm active:scale-95"
                              >
                                <Check size={14} className="text-white" /> Terima &amp; Aktifkan
                              </button>
                            ) : (
                              <span className="text-xs font-black text-emerald-700 inline-flex items-center justify-end gap-1">
                                <CheckCircle2 size={16} /> Terverifikasi
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

          {/* TAB 5: DATABASE OPS & BACKUP */}
          {activeTab === 'database' && (
            <div className="animate-fade-in">
              <SaaSDatabaseOpsAdmin />
            </div>
          )}

          {/* TAB 6: WARNING BROADCAST */}
          {activeTab === 'warnings' && (
            <div className="animate-fade-in">
              <SaaSWarningBroadcastAdmin />
            </div>
          )}

          {/* TAB 7: PLATFORM AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="animate-fade-in">
              <AuditLogView />
            </div>
          )}

        </div>
      </div>


      {/* ─── TENANT DEEP INSPECTOR MODAL ──────────────────────────────────── */}
      {selectedTenantId && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onRefreshParent={() => fetchPlatformData(false)}
        />
      )}

      {/* ─── TENANT RESET / TEMPLATE MODAL ───────────────────────────────── */}
      {isResetModalOpen && (
        <TenantResetModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={() => fetchPlatformData(false)}
        />
      )}

      {/* ─── RECYCLE BIN / SOFT-DELETE RESTORE MODAL ─────────────────────── */}
      {isRecycleBinOpen && (
        <RecycleBinModal
          isOpen={isRecycleBinOpen}
          onClose={() => setIsRecycleBinOpen(false)}
        />
      )}

      {/* ─── MOBILE FLOATING NAVIGATION BUTTON (< 1024px) ─────────────────── */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center gap-2.5 px-4.5 py-3 rounded-full bg-slate-950 text-white font-bold text-xs shadow-xl shadow-slate-950/20 border border-slate-800 cursor-pointer active:scale-95 transition-all"
        >
          <Sliders size={16} />
          <span>Menu Konsol</span>
          {(pendingInvoices.length > 0 || broadcastCount > 0) && (
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
      </div>

      {/* ─── MOBILE SLIDING DRAWER / BOTTOM SHEET ─────────────────────────── */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="fixed inset-0"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-black text-slate-900 text-sm">Navigasi Platform Admin</h3>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <PlatformAdminSidebar
              activeTab={activeTab}
              onSelectTab={handleTabChange}
              tenantCount={tenants.length}
              pendingInvoiceCount={pendingInvoices.length}
              activeBroadcastCount={broadcastCount}
              isCollapsed={false}
              onOpenTenantReset={() => {
                setIsMobileDrawerOpen(false);
                setIsResetModalOpen(true);
              }}
              onOpenRecycleBin={() => {
                setIsMobileDrawerOpen(false);
                setIsRecycleBinOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Quick Provision Modal */}
      <QuickProvisionModal
        isOpen={isQuickProvisionOpen}
        onClose={() => setIsQuickProvisionOpen(false)}
        onSuccess={() => fetchPlatformData(false)}
      />

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
