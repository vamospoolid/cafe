import React, { useState, useEffect, useContext } from 'react';
import { 
  Building2, 
  Store, 
  Users, 
  CreditCard, 
  Sparkles, 
  Layers, 
  Calendar, 
  ShieldCheck, 
  Clock, 
  Lock, 
  Unlock, 
  LogIn, 
  RefreshCw, 
  X, 
  Check, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink,
  MapPin,
  FileText,
  Smartphone,
  Download,
  Hammer,
  Play
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface TenantDetailModalProps {
  tenantId: string | null;
  onClose: () => void;
  onRefreshParent: () => void;
}

export const TenantDetailModal: React.FC<TenantDetailModalProps> = ({
  tenantId,
  onClose,
  onRefreshParent
}) => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [allFeatures, setAllFeatures] = useState<any[]>([]);
  const [modalTab, setModalTab] = useState<'overview' | 'outlets' | 'staff' | 'plan' | 'invoices' | 'apk'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [apkStatus, setApkStatus] = useState<any>(null);
  const [apkBuilding, setApkBuilding] = useState(false);

  const fetchTenantDetails = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/details`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
        setAllPlans(data.allPlans || []);
        setAllFeatures(data.allFeatures || []);
      } else {
        toast('Gagal memuat detail tenant', 'error');
        onClose();
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const fetchApkStatus = async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenantId}/apk-status`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApkStatus(data);
      }
    } catch {
      // ignore
    }
  };

  const handleBuildApk = async (target: string = 'all') => {
    if (!tenant) return;
    const confirmed = await confirmAlert(
      `Build APK ${target === 'cashier' ? 'Kasir Tablet' : target === 'staff' ? 'Portal Staf' : 'Kasir & Staf'}?`,
      `Sistem akan mengompilasi APK Android dengan logo toko dan nama brand ${tenant.name}.`
    );
    if (!confirmed) return;

    setApkBuilding(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenant.id}/build-apk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Build APK dimulai!', 'success');
        setTimeout(fetchApkStatus, 3000);
      } else {
        toast(data.error || 'Gagal memulai build APK', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setTimeout(() => setApkBuilding(false), 5000);
    }
  };

  useEffect(() => {
    fetchTenantDetails();
    fetchApkStatus();
  }, [tenantId]);

  if (!tenantId) return null;

  // 1-Click Impersonation
  const handleImpersonate = async () => {
    if (!tenant) return;
    const confirmed = await confirmAlert(
      `Masuk ke Ruang Kerja ${tenant.name}?`,
      `Anda akan masuk sebagai Developer ke workspace ${tenant.name}. Anda dapat kembali kapan saja.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenant.id}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok && data.token && data.user) {
        toast(`Berhasil masuk ke workspace ${tenant.name}`, 'success');
        if (posContext?.login) {
          posContext.login(data.user, data.token);
        }
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 600);
      } else {
        toast(data.error || 'Gagal impersonasi tenant', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Change Plan
  const handleChangePlan = async (planCode: string) => {
    if (!tenant || tenant.plan?.code === planCode) return;
    const confirmed = await confirmAlert(
      `Ubah Paket ke ${planCode}?`,
      `Paket langganan ${tenant.name} akan langsung diubah ke ${planCode}.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenant.id}/change-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ planCode })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchTenantDetails();
        onRefreshParent();
      } else {
        toast(data.error || 'Gagal mengubah paket', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Extend Trial / Subscription
  const handleExtend = async (days: number) => {
    if (!tenant) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenant.id}/extend-trial`, {
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
        fetchTenantDetails();
        onRefreshParent();
      } else {
        toast(data.error || 'Gagal memperpanjang masa aktif', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Feature Override
  const handleToggleOverride = async (featureKey: string, currentlyActive: boolean) => {
    if (!tenant) return;
    const nextState = !currentlyActive;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenant.id}/override-feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          featureKey,
          isEnabled: nextState
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, 'success');
        fetchTenantDetails();
      } else {
        toast(data.error || 'Gagal override fitur', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Status (Suspend / Active)
  const handleToggleStatus = async () => {
    if (!tenant) return;
    const nextStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmed = await confirmAlert(
      `${nextStatus === 'SUSPENDED' ? 'Tangguhkan (Kill-switch)' : 'Aktifkan'} Tenant?`,
      `Apakah Anda yakin ingin mengubah status tenant ${tenant.name} menjadi ${nextStatus}?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/tenants/${tenant.id}/status`, {
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
        fetchTenantDetails();
        onRefreshParent();
      } else {
        toast(data.error || 'Gagal mengubah status', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const currentPlan = tenant?.plan || tenant?.subscriptions?.[0]?.plan;
  const overrides = tenant?.featureOverrides || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        
        {/* ─── Modal Header ──────────────────────────────────────────────── */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-lg">
              {tenant?.name?.substring(0, 2).toUpperCase() || 'TN'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">{tenant?.name || 'Loading...'}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  tenant?.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : tenant?.status === 'TRIAL'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {tenant?.status || 'TRIAL'}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                <span className="text-indigo-600 font-semibold">{tenant?.slug}.codenusa.id</span>
                <span>•</span>
                <span>ID: {tenant?.id?.substring(0, 8)}...</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Modal Sub-Tabs ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50/80 border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'Ringkasan & Kuota', icon: Building2 },
            { id: 'outlets', label: `Cabang (${tenant?.outlets?.length || 0})`, icon: Store },
            { id: 'staff', label: `Staff (${tenant?.memberships?.length || 0})`, icon: Users },
            { id: 'plan', label: 'Paket & Add-on', icon: Layers },
            { id: 'invoices', label: `Invoices (${tenant?.invoices?.length || 0})`, icon: CreditCard },
            { id: 'apk', label: 'Mobile APK & White-Label', icon: Smartphone }
          ].map(t => {
            const Icon = t.icon;
            const isActive = modalTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setModalTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Modal Body Content ────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-6">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
              <span>Memuat data tenant...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {modalTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quota Progress Meters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-slate-600 font-bold flex items-center gap-1.5">
                          <Store size={14} className="text-indigo-600" /> Cabang Outlets
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {tenant?.outlets?.length || 0} / {currentPlan?.maxOutlets || 1}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, ((tenant?.outlets?.length || 0) / (currentPlan?.maxOutlets || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-slate-600 font-bold flex items-center gap-1.5">
                          <Users size={14} className="text-emerald-600" /> Akun Staff
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {tenant?.memberships?.length || 0} / {currentPlan?.maxUsers || 3}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, ((tenant?.memberships?.length || 0) / (currentPlan?.maxUsers || 3)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-slate-600 font-bold flex items-center gap-1.5">
                          <CreditCard size={14} className="text-amber-600" /> Menu Produk
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {tenant?._count?.products || 0} / {currentPlan?.maxProducts || 100}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, ((tenant?._count?.products || 0) / (currentPlan?.maxProducts || 100)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* General Details */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
                      Informasi Detail Tenant
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="text-slate-500 text-[10px] font-medium">Paket Aktif</div>
                        <div className="font-extrabold text-indigo-700 mt-0.5">{currentPlan?.name || 'Starter'}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px] font-medium">Total Order POS</div>
                        <div className="font-extrabold text-slate-900 mt-0.5 font-mono">{tenant?._count?.orders || 0} Trx</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px] font-medium">Trial Ends / Expired</div>
                        <div className="font-bold text-slate-800 mt-0.5">
                          {tenant?.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString('id-ID') : 'Aktif Permanen'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px] font-medium">Tanggal Registrasi</div>
                        <div className="font-bold text-slate-800 mt-0.5">
                          {new Date(tenant?.createdAt).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: OUTLETS */}
              {modalTab === 'outlets' && (
                <div className="space-y-3">
                  {tenant?.outlets?.map((o: any) => (
                    <div key={o.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                          <Store size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span>{o.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700">
                              {o.code}
                            </span>
                          </div>
                          <div className="text-slate-600 text-xs mt-1 flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{o.address || 'Alamat belum diatur'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">
                            GPS Radius: {o.gpsRadiusMeters || 100}m • Status: {o.status}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: STAFF MEMBERS */}
              {modalTab === 'staff' && (
                <div className="space-y-3">
                  {tenant?.memberships?.map((m: any) => (
                    <div key={m.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                          {m.user?.name?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{m.user?.name || m.user?.username}</div>
                          <div className="text-[10px] text-slate-500 font-mono">@{m.user?.username}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                          {m.role?.name || 'Staff'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 uppercase border border-emerald-200">
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: PLAN & ADD-ONS */}
              {modalTab === 'plan' && (
                <div className="space-y-6">
                  {/* Plan Switcher */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
                      Ubah Paket Langganan Tenant
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {allPlans.map(p => {
                        const isSelected = currentPlan?.code === p.code;
                        return (
                          <button
                            key={p.id}
                            disabled={actionLoading}
                            onClick={() => handleChangePlan(p.code)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="font-bold text-xs">{p.name}</div>
                            <div className="text-[10px] opacity-80 mt-0.5">
                              {p.priceMonthly > 0 ? `Rp ${p.priceMonthly.toLocaleString('id-ID')}/bln` : 'Gratis'}
                            </div>
                            {isSelected && (
                              <div className="mt-2 text-[10px] font-black flex items-center gap-1">
                                <Check size={12} /> Paket Aktif
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add-on Feature Overrides Matrix */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
                      Custom Add-on Overrides (Per-Tenant)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {allFeatures.map(f => {
                        const isIncludedInPlan = currentPlan?.features?.some((pf: any) => pf.feature?.key === f.key);
                        const override = overrides.find((o: any) => o.feature?.key === f.key);
                        const isOverriddenActive = override ? override.isEnabled : false;
                        const isGranted = isIncludedInPlan || isOverriddenActive;

                        return (
                          <div
                            key={f.id}
                            className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{f.name}</span>
                                {f.isCore && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
                                    Core
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{f.key} • {f.module}</div>
                            </div>

                            {!f.isCore && (
                              <button
                                disabled={actionLoading}
                                onClick={() => handleToggleOverride(f.key, isGranted)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                  isGranted
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {isGranted ? 'Aktif' : 'Nonaktif'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: INVOICES */}
              {modalTab === 'invoices' && (
                <div className="space-y-3">
                  {tenant?.invoices?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                      Belum ada invoice tagihan untuk tenant ini.
                    </div>
                  ) : (
                    tenant?.invoices?.map((inv: any) => (
                      <div key={inv.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono font-bold text-slate-900 text-xs">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(inv.createdAt).toLocaleDateString('id-ID')} • Metode: {inv.paymentMethod || 'SNAP'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-700">
                            Rp {(inv.totalAmount || inv.amount).toLocaleString('id-ID')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ─── TAB 6: MOBILE APK & WHITE-LABEL ───────────────────────── */}
              {modalTab === 'apk' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-white rounded-2xl border border-indigo-100 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">Generator APK Android Branded (White-Label)</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        Kompilasikan aplikasi Android native (.apk) berlogo kustom toko <strong>{tenant?.name}</strong>. File APK siap dibagikan ke WhatsApp owner kafe untuk diinstal di tablet kasir &amp; HP staf.
                      </p>
                    </div>
                  </div>

                  {/* 3 Target APK Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Card 1: APK Kasir & Tablet */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Tablet &amp; Kasir (Landscape)
                          </span>
                          <h5 className="font-black text-slate-900 text-base mt-1.5">{tenant?.name} POS</h5>
                          <p className="text-xs text-slate-400 font-mono">id.codenusa.{tenant?.slug?.replace(/[^a-z0-9]/g, '')}.pos</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                          POS
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1 font-mono">
                        <div className="flex justify-between text-slate-500">
                          <span>Status:</span>
                          <span className={apkStatus?.cashier?.exists ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            {apkStatus?.cashier?.exists ? `✓ Siap Unduh (${apkStatus.cashier.sizeMb} MB)` : 'Belum Dibuat'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Target:</span>
                          <span className="text-slate-700 font-semibold">{tenant?.customDomain ? `https://${tenant.customDomain}/pos` : `https://${tenant?.slug}.codenusa.id/pos`}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={apkBuilding}
                          onClick={() => handleBuildApk('cashier')}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <Hammer size={14} />
                          <span>{apkBuilding ? 'Memproses...' : 'Build Kasir'}</span>
                        </button>

                        {apkStatus?.cashier?.exists && (
                          <a
                            href={`/api/platform-admin/tenants/${tenant?.id}/download-apk/cashier`}
                            download
                            className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                          >
                            <Download size={14} />
                            <span>Unduh</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Card 2: APK Portal Staf & Absensi */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                            HP Staf &amp; Absensi (Portrait)
                          </span>
                          <h5 className="font-black text-slate-900 text-base mt-1.5">{tenant?.name} Staf</h5>
                          <p className="text-xs text-slate-400 font-mono">id.codenusa.{tenant?.slug?.replace(/[^a-z0-9]/g, '')}.staff</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                          STAF
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1 font-mono">
                        <div className="flex justify-between text-slate-500">
                          <span>Status:</span>
                          <span className={apkStatus?.staff?.exists ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            {apkStatus?.staff?.exists ? `✓ Siap Unduh (${apkStatus.staff.sizeMb} MB)` : 'Belum Dibuat'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Target:</span>
                          <span className="text-slate-700 font-semibold">{tenant?.customDomain ? `https://${tenant.customDomain}/staff` : `https://${tenant?.slug}.codenusa.id/staff`}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={apkBuilding}
                          onClick={() => handleBuildApk('staff')}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <Hammer size={14} />
                          <span>{apkBuilding ? 'Memproses...' : 'Build Staf'}</span>
                        </button>

                        {apkStatus?.staff?.exists && (
                          <a
                            href={`/api/platform-admin/tenants/${tenant?.id}/download-apk/staff`}
                            download
                            className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                          >
                            <Download size={14} />
                            <span>Unduh</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Card 3: APK Mobile Admin & Owner */}
                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            HP Admin &amp; Owner (Portrait)
                          </span>
                          <h5 className="font-black text-slate-900 text-base mt-1.5">{tenant?.name} Admin</h5>
                          <p className="text-xs text-slate-400 font-mono">id.codenusa.{tenant?.slug?.replace(/[^a-z0-9]/g, '')}.admin</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                          ADMIN
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1 font-mono">
                        <div className="flex justify-between text-slate-500">
                          <span>Status:</span>
                          <span className={apkStatus?.admin?.exists ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            {apkStatus?.admin?.exists ? `✓ Siap Unduh (${apkStatus.admin.sizeMb} MB)` : 'Belum Dibuat'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Target:</span>
                          <span className="text-slate-700 font-semibold">{tenant?.customDomain ? `https://${tenant.customDomain}/dashboard` : `https://${tenant?.slug}.codenusa.id/dashboard`}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={apkBuilding}
                          onClick={() => handleBuildApk('admin')}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <Hammer size={14} />
                          <span>{apkBuilding ? 'Memproses...' : 'Build Admin'}</span>
                        </button>

                        {apkStatus?.admin?.exists && (
                          <a
                            href={`/api/platform-admin/tenants/${tenant?.id}/download-apk/admin`}
                            download
                            className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                          >
                            <Download size={14} />
                            <span>Unduh</span>
                          </a>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Action Bar */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Icon APK otomatis diekstrak dari logo yang diunggah di menu Pengaturan toko.
                    </div>
                    <button
                      type="button"
                      disabled={apkBuilding}
                      onClick={() => handleBuildApk('all')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      <Play size={14} />
                      <span>Build Kedua APK Sekaligus</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Modal Footer Actions Bar ──────────────────────────────────── */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExtend(14)}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 flex items-center gap-1.5 shadow-xs"
            >
              <Calendar size={14} /> +14 Hari
            </button>

            <button
              onClick={() => handleExtend(30)}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 flex items-center gap-1.5 shadow-xs"
            >
              <Calendar size={14} /> +30 Hari
            </button>

            <button
              onClick={handleToggleStatus}
              disabled={actionLoading}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 shadow-xs ${
                tenant?.status === 'ACTIVE'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
            >
              {tenant?.status === 'ACTIVE' ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{tenant?.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}</span>
            </button>
          </div>

          <button
            onClick={handleImpersonate}
            disabled={actionLoading}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <LogIn size={15} />
            <span>Masuk ke Workspace Tenant (Impersonate)</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default TenantDetailModal;
