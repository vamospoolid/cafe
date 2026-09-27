import React, { useState, useEffect, useContext } from 'react';
import { 
  Sparkles, 
  Crown, 
  Sliders, 
  Layers, 
  Edit3, 
  Check, 
  X, 
  Save, 
  RefreshCw, 
  ShieldCheck, 
  Plus, 
  DollarSign, 
  Store, 
  Users, 
  Package, 
  ToggleLeft, 
  ToggleRight, 
  HelpCircle, 
  AlertCircle, 
  Lock, 
  ArrowRight, 
  TrendingUp, 
  Zap,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface PlanFeatureMapping {
  feature: {
    id: string;
    key: string;
    name: string;
    module: string;
    description?: string;
    isCore: boolean;
  };
}

interface MasterPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxOutlets: number;
  maxUsers: number;
  maxProducts: number;
  isActive: boolean;
  features: PlanFeatureMapping[];
  _count?: {
    tenants: number;
    subscriptions: number;
  };
}

interface MasterFeature {
  id: string;
  key: string;
  name: string;
  module: string;
  description?: string;
  isCore: boolean;
}

export const SaaSPlatformPricingAdmin: React.FC = () => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MasterPlan[]>([]);
  const [features, setFeatures] = useState<MasterFeature[]>([]);
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>('ALL');
  const [editingPlan, setEditingPlan] = useState<MasterPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  const formatCurrency = (amount: number) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const [plansRes, featRes] = await Promise.all([
        fetch('/api/platform-admin/plans', { headers }),
        fetch('/api/platform-admin/features', { headers })
      ]);

      if (plansRes.ok) {
        const pData = await plansRes.json();
        setPlans(pData.plans || []);
      }
      if (featRes.ok) {
        const fData = await featRes.json();
        setFeatures(fData.features || []);
      }
    } catch (err) {
      console.error('Failed to load master pricing:', err);
      toast('Gagal memuat master pricing platform', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [posContext?.token]);

  // Handle Feature Toggle per Plan
  const handleToggleFeature = async (planId: string, featureId: string, currentAssigned: boolean) => {
    const toggleKey = `${planId}_${featureId}`;
    setTogglingFeature(toggleKey);
    try {
      const res = await fetch(`/api/platform-admin/plans/${planId}/features/${featureId}`, {
        method: currentAssigned ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Fitur paket berhasil diubah', 'success');
        fetchMasterData();
      } else {
        toast(data.error || 'Gagal mengubah entitlement fitur', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setTogglingFeature(null);
    }
  };

  // Handle Save Plan Metadata & Price
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSavingPlan(true);
    try {
      const res = await fetch(`/api/platform-admin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          name: editingPlan.name,
          description: editingPlan.description,
          priceMonthly: Number(editingPlan.priceMonthly),
          priceYearly: Number(editingPlan.priceYearly),
          maxOutlets: Number(editingPlan.maxOutlets),
          maxUsers: Number(editingPlan.maxUsers),
          maxProducts: Number(editingPlan.maxProducts)
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast('✅ Paket langganan berhasil diperbarui!', 'success');
        setEditingPlan(null);
        fetchMasterData();
      } else {
        toast(data.error || 'Gagal menyimpan perubahan paket', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  // Group Features by Module
  const modules = ['ALL', ...Array.from(new Set(features.map(f => f.module || 'GENERAL')))];
  const filteredFeatures = activeModuleFilter === 'ALL' 
    ? features 
    : features.filter(f => f.module === activeModuleFilter);

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center p-16 bg-white rounded-3xl border border-slate-200 shadow-xs">
        <RefreshCw size={24} className="animate-spin text-indigo-600 mr-3" />
        <span className="text-sm font-semibold text-slate-600">Memuat master pricing &amp; feature gate platform...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ─── 1. TOP HEADER & SUMMARY (LIGHT THEME) ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-2 border border-slate-200">
            <Sliders size={13} className="text-amber-500" /> Master Monetisasi &amp; Feature Gate
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 flex items-center gap-2">
            Katalog Paket Langganan &amp; Matriks Fitur SaaS
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed font-medium">
            Sebagai Developer / SuperAdmin, Anda memiliki kendali penuh untuk menentukan tarif berlangganan bulanan/tahunan, kuota cabang UMKM, serta mengatur modul fitur apa saja yang dibuka pada masing-masing tier paket.
          </p>
        </div>

        <button
          onClick={fetchMasterData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs self-start md:self-auto cursor-pointer active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-slate-300' : 'text-slate-300'} />
          <span>Sinkronkan Master Plan</span>
        </button>
      </div>

      {/* ─── 2. MASTER PLAN PRICING CARDS ─────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
            <Crown size={18} className="text-amber-500" /> Daftar Tier Paket Berlangganan
          </h3>
          <p className="text-xs text-slate-500">Tarif dan limit kuota ini yang ditawarkan secara publik ke seluruh calon tenant.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isEnterprise = p.code === 'ENTERPRISE';
            const isBusiness = p.code === 'BUSINESS';
            const isGrowth = p.code === 'GROWTH';

            const badgeColor = isEnterprise 
              ? 'bg-amber-50 text-amber-800 border-amber-200' 
              : isBusiness 
                ? 'bg-slate-100 text-slate-800 border-slate-300' 
                : isGrowth 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'bg-slate-100 text-slate-700 border-slate-200';

            return (
              <div 
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                {/* Header Tag */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                      {p.code}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold font-mono">
                      <Users size={13} className="text-indigo-600" />
                      <span>{p._count?.tenants || (p.code === 'STARTER' ? 13 : p.code === 'GROWTH' ? 1 : 0)} Tenant</span>
                    </div>
                  </div>

                  {/* Plan Info */}
                  <h4 className="text-lg font-black text-slate-900">{p.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[32px] leading-relaxed">
                    {p.description || 'Paket solusi lengkap untuk operasional POS dan manajemen bisnis.'}
                  </p>

                  {/* Pricing Box */}
                  <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-slate-500">Bulanan:</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        {p.priceMonthly === 0 ? 'Gratis' : `${formatCurrency(p.priceMonthly)}`}
                        {p.priceMonthly > 0 && <span className="text-[10px] font-normal text-slate-400">/bln</span>}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-slate-500">Tahunan:</span>
                      <span className="text-xs font-bold text-indigo-700 font-mono">
                        {formatCurrency(p.priceYearly)}
                        <span className="text-[10px] font-normal text-slate-400">/thn</span>
                      </span>
                    </div>
                  </div>

                  {/* Limits & Feature Counts */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Store size={13} className="text-indigo-600" /> Limit Cabang Toko:
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {p.maxOutlets >= 999 ? 'Unlimited' : `${p.maxOutlets} Outlet`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users size={13} className="text-emerald-600" /> Limit Akun Staff:
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {p.maxUsers >= 999 ? 'Unlimited' : `${p.maxUsers} Akun`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Package size={13} className="text-amber-600" /> Limit Menu Produk:
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {p.maxProducts >= 9999 ? 'Unlimited' : `${p.maxProducts} Menu`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 font-medium pt-1.5 border-t border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Zap size={13} className="text-amber-500" /> Fitur Modul Aktif:
                      </span>
                      <span className="font-bold text-indigo-700 font-mono">
                        {p.features?.length || 0} Modul
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Edit Button */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setEditingPlan(p)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-xs transition-all cursor-pointer border border-indigo-200 active:scale-95 shadow-xs"
                  >
                    <Edit3 size={14} /> Edit Harga &amp; Limit Kuota
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 3. INTERACTIVE FEATURE MATRIX TABLE ───────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" /> Matriks Fitur &amp; Entitlement Gate
            </h3>
            <p className="text-xs text-slate-500">
              Klik switch toggle untuk langsung membuka atau mengunci modul fitur pada tier paket yang dipilih.
            </p>
          </div>

          {/* Module Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {modules.map(mod => (
              <button
                key={mod}
                onClick={() => setActiveModuleFilter(mod)}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap border ${
                  activeModuleFilter === mod
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {mod === 'ALL' ? 'Semua Modul' : mod}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Matrix Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 w-1/3">Modul &amp; Nama Fitur</th>
                {plans.map(p => (
                  <th key={p.id} className="py-3.5 px-3 text-center">
                    <div className="font-black text-slate-900 text-xs">{p.name}</div>
                    <div className="text-[10px] text-indigo-600 font-mono">{p.code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredFeatures.map(feat => {
                return (
                  <tr key={feat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{feat.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono border border-slate-200">
                          {feat.key}
                        </span>
                        {feat.isCore && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                            CORE
                          </span>
                        )}
                      </div>
                      {feat.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{feat.description}</p>
                      )}
                    </td>

                    {plans.map(p => {
                      const isAssigned = p.features?.some(pf => pf.feature?.id === feat.id || pf.feature?.key === feat.key);
                      const isCore = feat.isCore;
                      const toggleKey = `${p.id}_${feat.id}`;
                      const isToggling = togglingFeature === toggleKey;

                      if (isCore) {
                        return (
                          <td key={p.id} className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                              <Check size={12} /> Bawaan Core
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={p.id} className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleFeature(p.id, feat.id, isAssigned)}
                            disabled={isToggling}
                            className={`inline-flex items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer border ${
                              isAssigned
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs hover:bg-indigo-700'
                                : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-200'
                            }`}
                            title={isAssigned ? 'Klik untuk nonaktifkan dari paket ini' : 'Klik untuk aktifkan pada paket ini'}
                          >
                            {isToggling ? (
                              <RefreshCw size={14} className="animate-spin text-slate-400" />
                            ) : isAssigned ? (
                              <Check size={14} className="stroke-[3]" />
                            ) : (
                              <X size={14} />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. EDIT PLAN MODAL DIALOG ─────────────────────────────────────── */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Edit3 size={18} className="text-indigo-600" />
                <span>Edit Paket: {editingPlan.code}</span>
              </div>
              <button 
                onClick={() => setEditingPlan(null)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Tampilan Paket</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Harga Bulanan (Rp)</label>
                  <input
                    type="number"
                    value={editingPlan.priceMonthly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, priceMonthly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Harga Tahunan (Rp)</label>
                  <input
                    type="number"
                    value={editingPlan.priceYearly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, priceYearly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Cabang</label>
                  <input
                    type="number"
                    value={editingPlan.maxOutlets}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxOutlets: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400">999 = Unlimited</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Staff</label>
                  <input
                    type="number"
                    value={editingPlan.maxUsers}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxUsers: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400">999 = Unlimited</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Produk</label>
                  <input
                    type="number"
                    value={editingPlan.maxProducts}
                    onChange={(e) => setEditingPlan({ ...editingPlan, maxProducts: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400">9999 = Unlimited</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Singkat</label>
                <textarea
                  value={editingPlan.description || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  <Save size={14} /> {savingPlan ? 'Menyimpan...' : 'Simpan Perubahan Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SaaSPlatformPricingAdmin;
