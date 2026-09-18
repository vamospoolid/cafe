import React, { useState, useEffect, useContext } from 'react';
import { 
  Sparkles, 
  Check, 
  ShieldCheck, 
  Lock, 
  Zap, 
  Store, 
  Users, 
  Package, 
  ArrowUpRight, 
  RefreshCw, 
  Sliders, 
  Layers,
  Crown,
  HelpCircle,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  Key,
  Eye,
  EyeOff,
  QrCode,
  Download,
  ExternalLink
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface PlanInfo {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxOutlets: number;
  maxUsers: number;
  maxProducts: number;
  features: Array<{
    feature: {
      key: string;
      name: string;
      module: string;
    };
  }>;
}

interface FeatureItem {
  id: string;
  key: string;
  name: string;
  module: string;
  description?: string;
  isCore: boolean;
  status: string;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  totalAmount: number;
  status: string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  plan?: {
    name: string;
    code: string;
  };
  transactions?: Array<{
    snapToken?: string;
    snapRedirectUrl?: string;
  }>;
  createdAt: string;
}

export const SaaSPlanManager: React.FC = () => {
  const posContext = useContext(POSContext);
  const [subTab, setSubTab] = useState<'plans' | 'features' | 'invoices' | 'byok'>('plans');
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>('ALL');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // BYOK Settings State
  const [byokConfig, setByokConfig] = useState({
    isMidtransEnabled: false,
    midtransMode: 'SANDBOX',
    serverKey: '',
    clientKey: '',
    merchantId: '',
    enableQRIS: true,
    enableVA: false,
    enableGoPay: true,
    enableShopeePay: false,
    serverKeyMasked: '',
    hasServerKey: false
  });
  const [showServerKey, setShowServerKey] = useState(false);
  const [savingByok, setSavingByok] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [plansRes, featsRes, invRes, byokRes] = await Promise.all([
        fetch('/api/features/plans'),
        fetch('/api/features/all', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        }),
        fetch('/api/payments/saas/invoices', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        }),
        fetch('/api/payments/tenant-config', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        })
      ]);

      if (plansRes.ok) {
        const pData = await plansRes.json();
        setPlans(pData);
      }
      if (featsRes.ok) {
        const fData = await featsRes.json();
        setAllFeatures(fData);
      }
      if (invRes.ok) {
        const iData = await invRes.json();
        setInvoices(iData);
      }
      if (byokRes.ok) {
        const bData = await byokRes.json();
        setByokConfig(prev => ({
          ...prev,
          ...bData,
          serverKey: bData.serverKeyMasked || ''
        }));
      }

      if (posContext?.fetchTenantFeatures) {
        await posContext.fetchTenantFeatures();
      }
    } catch (e) {
      console.error('Error fetching SaaS plans & data:', e);
      toast('Gagal memuat data paket & billing', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [posContext?.token]);

  const currentPlanCode = posContext?.tenantPlan?.plan?.code || 'STARTER';
  const tenantPlanData = posContext?.tenantPlan;
  const activeFeatures = posContext?.features || [];

  const handleChangePlan = async (targetPlanCode: string) => {
    if (targetPlanCode === currentPlanCode) return;

    const confirmed = await confirmAlert(
      'Ganti Paket Langganan?',
      `Anda akan membuat invoice tagihan untuk paket ${targetPlanCode} (${billingCycle}). Fitur dan kuota akan otomatis diaktifkan setelah pembayaran diselesaikan.`
    );

    if (!confirmed) return;

    setProcessingPlan(targetPlanCode);
    try {
      const res = await fetch('/api/payments/saas/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          planCode: targetPlanCode,
          billingCycle: billingCycle.toUpperCase()
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(`✅ Invoice #${data.invoice.invoiceNumber} berhasil dibuat!`, 'success');
        await fetchAllData();
        setSubTab('invoices');
        if (data.snapRedirectUrl) {
          window.open(data.snapRedirectUrl, '_blank');
        }
      } else {
        toast(data.error || 'Gagal membuat invoice paket', 'error');
      }
    } catch (e: any) {
      toast('Terjadi kesalahan saat request upgrade paket', 'error');
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleToggleAddon = async (featureKey: string, currentlyActive: boolean) => {
    const isCore = allFeatures.find(f => f.key === featureKey)?.isCore;
    if (isCore) {
      return toast('Fitur ini adalah fitur inti sistem dan tidak dapat dinonaktifkan.', 'info');
    }

    const nextState = !currentlyActive;
    const actionText = nextState ? 'mengaktifkan Add-on' : 'mencabut Add-on';

    const confirmed = await confirmAlert(
      `${nextState ? 'Aktifkan' : 'Nonaktifkan'} Add-on Fitur?`,
      `Apakah Anda yakin ingin ${actionText} '${featureKey}' untuk tenant ini?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch('/api/features/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          targetTenantId: posContext?.user?.tenantId,
          featureKey,
          isEnabled: nextState
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Status add-on berhasil diubah', 'success');
        if (posContext?.fetchTenantFeatures) {
          await posContext.fetchTenantFeatures();
        }
      } else {
        toast(data.error || 'Gagal mengubah add-on', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan saat memproses add-on override', 'error');
    }
  };

  const handleSaveByok = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingByok(true);
    try {
      const res = await fetch('/api/payments/tenant-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(byokConfig)
      });

      const data = await res.json();
      if (res.ok) {
        toast('✅ Konfigurasi Midtrans Tenant (BYOK) berhasil disimpan & diamankan dengan enkripsi AES-256!', 'success');
        await fetchAllData();
      } else {
        toast(data.error || 'Gagal menyimpan konfigurasi Midtrans', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSavingByok(false);
    }
  };

  const modules = ['ALL', 'POS', 'OPERATIONS', 'WAREHOUSE', 'HR', 'FINANCE', 'ADVANCED'];

  const filteredFeatures = activeModuleFilter === 'ALL'
    ? allFeatures
    : allFeatures.filter(f => f.module.toUpperCase() === activeModuleFilter);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* ─── Hero Overview Card ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20 border border-indigo-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black tracking-widest uppercase flex items-center gap-1.5">
                <Crown size={14} className="text-amber-400" /> Paket Aktif
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                <Check size={13} /> Berlangganan Aktif
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              {tenantPlanData?.plan?.name || 'Paket Enterprise'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {tenantPlanData?.plan?.description || 'Akses penuh seluruh modul multi-outlet, central warehouse, dan analytics tanpa batas.'}
            </p>
          </div>

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs transition-all backdrop-blur-md active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sinkronkan Status</span>
          </button>
        </div>

        {/* Quota Progress Meters */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
          
          {/* Outlets Quota */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Store size={14} className="text-indigo-400" /> Cabang / Outlets
              </span>
              <span className="font-bold text-white">
                {tenantPlanData?.usage?.outlets ?? 1} / {tenantPlanData?.limits?.maxOutlets ?? 999}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(10, ((tenantPlanData?.usage?.outlets ?? 1) / (tenantPlanData?.limits?.maxOutlets ?? 999)) * 100))}%` 
                }}
              />
            </div>
          </div>

          {/* Users Quota */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Users size={14} className="text-emerald-400" /> Akun Staff
              </span>
              <span className="font-bold text-white">
                {tenantPlanData?.usage?.users ?? 1} / {tenantPlanData?.limits?.maxUsers ?? 999}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(10, ((tenantPlanData?.usage?.users ?? 1) / (tenantPlanData?.limits?.maxUsers ?? 999)) * 100))}%` 
                }}
              />
            </div>
          </div>

          {/* Products Quota */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Package size={14} className="text-amber-400" /> Menu & Produk
              </span>
              <span className="font-bold text-white">
                {tenantPlanData?.usage?.products ?? 0} / {tenantPlanData?.limits?.maxProducts ?? 9999}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(10, ((tenantPlanData?.usage?.products ?? 0) / (tenantPlanData?.limits?.maxProducts ?? 9999)) * 100))}%` 
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ─── Navigation Sub-Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'plans', label: 'Pilihan Paket SaaS', icon: Layers },
          { id: 'features', label: 'Matriks Fitur & Add-on', icon: Sparkles },
          { id: 'invoices', label: 'Riwayat Invoice Tagihan', icon: FileText, count: invoices.length },
          { id: 'byok', label: 'Gateway Midtrans Toko (BYOK)', icon: CreditCard }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: PLANS ─────────────────────────────────────────────────── */}
      {subTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Layers className="text-indigo-600" size={20} /> Upgrade & Perpanjangan Paket
              </h3>
              <p className="text-xs text-slate-500">Pilih paket yang sesuai dengan skala bisnis. Pembayaran via Midtrans Snap instan.</p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === 'yearly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tahunan <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black">Hemat 17%</span>
              </button>
            </div>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(p => {
              const isCurrent = p.code === currentPlanCode;
              const price = billingCycle === 'monthly' ? p.priceMonthly : p.priceYearly;
              const isProcessing = processingPlan === p.code;

              return (
                <div 
                  key={p.id}
                  className={`relative rounded-3xl p-5 border flex flex-col justify-between transition-all ${
                    isCurrent 
                      ? 'bg-indigo-50/50 border-indigo-400 shadow-lg shadow-indigo-600/10 scale-[1.01]'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase shadow-sm">
                      Paket Saat Ini
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black tracking-wider uppercase text-slate-400">{p.code}</span>
                      <span className="text-xs font-bold text-slate-600">{p.maxOutlets} Outlet</span>
                    </div>

                    <h4 className="text-base font-black text-slate-800 tracking-tight">{p.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{p.description}</p>

                    <div className="mt-4 mb-5 pb-4 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-900">{formatRupiah(price)}</span>
                        <span className="text-xs font-medium text-slate-400">/{billingCycle === 'monthly' ? 'bln' : 'thn'}</span>
                      </div>
                    </div>

                    {/* Quota Specs */}
                    <div className="space-y-2 mb-6 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-emerald-500 shrink-0" />
                        <span>Hingga <strong>{p.maxOutlets} Cabang</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-emerald-500 shrink-0" />
                        <span>Maksimal <strong>{p.maxUsers} Akun Staff</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-emerald-500 shrink-0" />
                        <span>Maksimal <strong>{p.maxProducts} Menu</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleChangePlan(p.code)}
                    disabled={isProcessing}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                        : 'bg-slate-900 hover:bg-indigo-600 active:scale-95 text-white shadow-md'
                    }`}
                  >
                    {isProcessing ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : isCurrent ? (
                      <>
                        <RefreshCw size={14} /> Perpanjang Langganan
                      </>
                    ) : (
                      <>
                        <Zap size={14} /> Beli / Upgrade Paket
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: FEATURES & ADD-ONS ────────────────────────────────────── */}
      {subTab === 'features' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Sparkles className="text-indigo-600" size={20} /> Matriks Fitur & Add-on Tenant
              </h3>
              <p className="text-xs text-slate-500">
                Daftar seluruh kapabilitas sistem. Anda dapat mengaktifkan modul tambahan sebagai Add-on khusus.
              </p>
            </div>

            {/* Module Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {modules.map(mod => (
                <button
                  key={mod}
                  onClick={() => setActiveModuleFilter(mod)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeModuleFilter === mod
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredFeatures.map(feat => {
              const isEnabled = activeFeatures.includes(feat.key);
              const isCore = feat.isCore;

              return (
                <div
                  key={feat.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                    isEnabled
                      ? 'bg-white border-slate-200/90 shadow-sm'
                      : 'bg-slate-50/70 border-slate-200/60 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                        {feat.module}
                      </span>
                      
                      {isCore ? (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold flex items-center gap-1">
                          ⭐ Fitur Inti
                        </span>
                      ) : isEnabled ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                          <Check size={11} /> Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                          <Lock size={11} /> Terkunci
                        </span>
                      )}
                    </div>

                    <h5 className="text-sm font-bold text-slate-800 tracking-tight">{feat.name}</h5>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{feat.description || 'Modul standar sistem Codenusa SaaS'}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="font-mono text-[11px] text-slate-400">{feat.key}</span>

                    {!isCore && (
                      <button
                        onClick={() => handleToggleAddon(feat.key, isEnabled)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          isEnabled
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200'
                        }`}
                      >
                        {isEnabled ? 'Cabut Add-on' : 'Aktifkan Add-on'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: INVOICES ──────────────────────────────────────────────── */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              <FileText className="text-indigo-600" size={20} /> Riwayat Invoice & Tagihan Langganan
            </h3>
            <p className="text-xs text-slate-500">Semua tagihan langganan SaaS resmi untuk akun bisnis Anda.</p>
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-3xl">
              <FileText size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">Belum ada riwayat invoice</p>
              <p className="text-xs text-slate-400 mt-0.5">Invoice baru akan otomatis muncul saat Anda memilih atau memperpanjang paket langganan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Nomor Invoice</th>
                    <th className="px-5 py-3.5">Paket</th>
                    <th className="px-5 py-3.5">Total Tagihan</th>
                    <th className="px-5 py-3.5">Jatuh Tempo</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {invoices.map(inv => {
                    const isPaid = inv.status === 'PAID';
                    const snapUrl = inv.transactions?.[0]?.snapRedirectUrl;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {inv.plan?.name || 'Paket SaaS'}
                        </td>
                        <td className="px-5 py-4 font-black text-slate-900">
                          {formatRupiah(inv.totalAmount)}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          {isPaid ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
                              <Check size={12} /> LUNAS
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[11px] inline-flex items-center gap-1">
                              <Clock size={12} /> MENUNGGU PEMBAYARAN
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!isPaid && snapUrl ? (
                            <a
                              href={snapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              <span>Bayar</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">
                              {inv.paymentMethod || 'Midtrans Snap'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: TENANT POS MIDTRANS (BYOK) ────────────────────────────── */}
      {subTab === 'byok' && (
        <form onSubmit={handleSaveByok} className="space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              <CreditCard className="text-indigo-600" size={20} /> Konfigurasi Gateway Pembayaran Toko (BYOK)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungkan akun Midtrans milik toko Anda sendiri (Bring Your Own Keys). Dana pembayaran pelanggan di kasir akan langsung masuk 100% ke rekening Anda.
            </p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Aktifkan Gateway Midtrans di Kasir</h4>
              <p className="text-xs text-slate-500">Saat aktif, kasir dapat memilih pembayaran QRIS Dinamis & Virtual Account otomatis.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={byokConfig.isMidtransEnabled}
                onChange={e => setByokConfig({ ...byokConfig, isMidtransEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {byokConfig.isMidtransEnabled && (
            <div className="space-y-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Mode Lingkungan Midtrans</label>
                  <select
                    className="form-control"
                    value={byokConfig.midtransMode}
                    onChange={e => setByokConfig({ ...byokConfig, midtransMode: e.target.value })}
                  >
                    <option value="SANDBOX">Sandbox (Uji Coba / Testing)</option>
                    <option value="PRODUCTION">Production (Transaksi Asli)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Merchant ID (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: G12345678"
                    value={byokConfig.merchantId || ''}
                    onChange={e => setByokConfig({ ...byokConfig, merchantId: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider flex items-center justify-between">
                  <span>Server Key (Terenkripsi AES-256)</span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <ShieldCheck size={12} /> Terlindungi Aman
                  </span>
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showServerKey ? 'text' : 'password'}
                    className="form-control pl-10 pr-10"
                    placeholder={byokConfig.hasServerKey ? '••••••••••••••••••••' : 'SB-Mid-server-XXXXX'}
                    value={byokConfig.serverKey}
                    onChange={e => setByokConfig({ ...byokConfig, serverKey: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowServerKey(!showServerKey)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showServerKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Client Key</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="SB-Mid-client-XXXXX"
                  value={byokConfig.clientKey || ''}
                  onChange={e => setByokConfig({ ...byokConfig, clientKey: e.target.value })}
                />
              </div>

              {/* Channels Toggles */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">Metode Pembayaran Aktif di Kasir</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'enableQRIS', label: 'QRIS Dinamis' },
                    { key: 'enableGoPay', label: 'GoPay QR' },
                    { key: 'enableShopeePay', label: 'ShopeePay' },
                    { key: 'enableVA', label: 'Virtual Account' }
                  ].map(ch => (
                    <label key={ch.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={(byokConfig as any)[ch.key]}
                        onChange={e => setByokConfig({ ...byokConfig, [ch.key]: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-700">{ch.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingByok}
              className="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20"
            >
              {savingByok ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>Simpan Konfigurasi Midtrans</span>
            </button>
          </div>
        </form>
      )}

    </div>
  );
};

export default SaaSPlanManager;
