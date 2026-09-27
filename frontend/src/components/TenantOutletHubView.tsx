import React, { useState, useEffect, useContext } from 'react';
import { 
  Store, 
  Plus, 
  MapPin, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ArrowUpRight, 
  Layers, 
  Users, 
  Package, 
  Clock, 
  Edit3, 
  Trash2, 
  DollarSign, 
  Receipt, 
  X, 
  ShieldCheck, 
  Check, 
  Crown,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface OutletItem {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  status: string;
  gpsRadiusMeters: number;
  latitude: number | null;
  longitude: number | null;
  tablesCount: number;
  totalOrdersAllTime: number;
  todayOrdersCount: number;
  todayRevenue: number;
  createdAt: string;
}

interface SubscriptionInfo {
  status: string;
  planName: string;
  planCode: string;
  priceMonthly: number;
  priceYearly: number;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysRemaining: number;
  isTrial: boolean;
  isSuspended: boolean;
  isGracePeriod: boolean;
}

interface QuotaDetails {
  outlets: { used: number; max: number; remaining: number; isExceeded: boolean };
  users: { used: number; max: number; remaining: number; isExceeded: boolean };
  products: { used: number; max: number; remaining: number; isExceeded: boolean };
}

export const TenantOutletHubView: React.FC = () => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState<boolean>(true);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [quotas, setQuotas] = useState<QuotaDetails | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedOutletForEdit, setSelectedOutletForEdit] = useState<OutletItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGpsRadius, setFormGpsRadius] = useState('100');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatCurrency = (amount: number) => `Rp ${(amount || 0).toLocaleString('id-ID')}`;

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      
      const [outRes, subRes] = await Promise.all([
        fetch('/api/outlets', { headers }),
        fetch('/api/tenants/my-subscription', { headers })
      ]);

      if (outRes.ok) {
        const oData = await outRes.json();
        setOutlets(oData.outlets || []);
      }
      if (subRes.ok) {
        const sData = await subRes.json();
        setSubscription(sData.subscription || null);
        setQuotas(sData.quotas || null);
        setTenantInfo(sData.tenant || null);
        setActiveFeatures(sData.features || []);
      }
    } catch (err) {
      console.error('Failed to load Outlet Hub data:', err);
      toast('Gagal memuat data cabang & langganan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, [posContext?.token]);

  // Handle Add Outlet Button Click
  const handleOpenAddOutlet = () => {
    // Check quota
    if (quotas?.outlets.isExceeded) {
      setIsUpgradeModalOpen(true);
      return;
    }

    setFormName('');
    setFormCode(`OUT-${(outlets.length + 1).toString().padStart(2, '0')}`);
    setFormAddress('');
    setFormPhone('');
    setFormGpsRadius('100');
    setFormLat('');
    setFormLng('');
    setIsAddModalOpen(true);
  };

  // Submit New Outlet
  const handleSubmitAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      toast('Nama dan Kode cabang wajib diisi', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/outlets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          phone: formPhone.trim(),
          gpsRadiusMeters: formGpsRadius,
          latitude: formLat || null,
          longitude: formLng || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Cabang berhasil ditambahkan!', 'success');
        setIsAddModalOpen(false);
        fetchHubData();
      } else {
        if (data.error === 'QUOTA_EXCEEDED') {
          setIsAddModalOpen(false);
          setIsUpgradeModalOpen(true);
        } else {
          toast(data.error || 'Gagal menambahkan cabang', 'error');
        }
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Outlet Modal
  const handleOpenEditOutlet = (outlet: OutletItem) => {
    setSelectedOutletForEdit(outlet);
    setFormName(outlet.name);
    setFormCode(outlet.code);
    setFormAddress(outlet.address || '');
    setFormPhone(outlet.phone || '');
    setFormGpsRadius(outlet.gpsRadiusMeters ? String(outlet.gpsRadiusMeters) : '100');
    setFormLat(outlet.latitude ? String(outlet.latitude) : '');
    setFormLng(outlet.longitude ? String(outlet.longitude) : '');
  };

  // Submit Edit Outlet
  const handleSubmitEditOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletForEdit) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/outlets/${selectedOutletForEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          phone: formPhone.trim(),
          gpsRadiusMeters: formGpsRadius,
          latitude: formLat || null,
          longitude: formLng || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast('Data cabang berhasil diperbarui', 'success');
        setSelectedOutletForEdit(null);
        fetchHubData();
      } else {
        toast(data.error || 'Gagal memperbarui cabang', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Switch Active Outlet
  const handleSwitchActiveOutlet = (outlet: OutletItem) => {
    localStorage.setItem('pos_active_outlet_id', outlet.id);
    localStorage.setItem('pos_active_outlet_name', outlet.name);
    toast(`Sesi kasir aktif dialihkan ke: ${outlet.name}`, 'success');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const currentActiveOutletId = localStorage.getItem('pos_active_outlet_id') || outlets[0]?.id;

  const filteredOutlets = outlets.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-32 animate-fade-in">
      
      {/* ─── 1. TOP HERO & SUBSCRIPTION BANNER ────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {tenantInfo?.name || 'Workspace Bisnis'}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                subscription?.status === 'ACTIVE' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}>
                {subscription?.status === 'ACTIVE' ? 'Paket Aktif' : 'Masa Percobaan (Trial)'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Manajemen Multi-Cabang &amp; Kuota Paket
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Pantau seluruh performa cabang, alokasi staf kasir, dan kapasitas kuota paket langganan bisnis Anda secara terpusat.
            </p>
          </div>

          {/* Subscription Action Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-start justify-between gap-3 shrink-0">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paket Saat Ini</div>
              <div className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                <Crown size={16} className="text-amber-400" />
                <span>{subscription?.planName || 'Paket Starter'}</span>
              </div>
              <div className="text-xs font-semibold text-indigo-300 mt-1 flex items-center gap-1">
                <Clock size={12} />
                <span>Sisa {subscription?.daysRemaining ?? 14} Hari Masa Aktif</span>
              </div>
            </div>

            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Sparkles size={14} /> Upgrade Paket Bisnis
            </button>
          </div>
        </div>

        {/* ─── Realtime Quota Utilization Meters ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 relative z-10 pt-6 border-t border-white/10">
          
          {/* Outlets Quota */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Store size={14} className="text-indigo-400" /> Kuota Cabang Aktif
              </span>
              <span className="font-mono text-white">
                {quotas?.outlets.used ?? outlets.length} / {quotas?.outlets.max ?? 1}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full mt-2.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  quotas?.outlets.isExceeded ? 'bg-amber-400' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, (((quotas?.outlets.used ?? outlets.length) / (quotas?.outlets.max ?? 1)) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-1.5 flex justify-between">
              <span>{quotas?.outlets.isExceeded ? '⚠️ Kuota Cabang Penuh' : `${quotas?.outlets.remaining ?? 0} cabang tersisa`}</span>
              <span className="text-indigo-300 font-bold">{Math.round(((quotas?.outlets.used ?? outlets.length) / (quotas?.outlets.max ?? 1)) * 100)}%</span>
            </div>
          </div>

          {/* Users / Staff Quota */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-cyan-400" /> Kuota Akun Staff
              </span>
              <span className="font-mono text-white">
                {quotas?.users.used ?? 0} / {quotas?.users.max ?? 3}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (((quotas?.users.used ?? 0) / (quotas?.users.max ?? 3)) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-1.5 flex justify-between">
              <span>{quotas?.users.remaining ?? 0} akun staf tersisa</span>
              <span className="text-cyan-300 font-bold">{Math.round(((quotas?.users.used ?? 0) / (quotas?.users.max ?? 3)) * 100)}%</span>
            </div>
          </div>

          {/* Products / Menu Quota */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Package size={14} className="text-emerald-400" /> Kuota Menu Produk
              </span>
              <span className="font-mono text-white">
                {quotas?.products.used ?? 0} / {quotas?.products.max ?? 100}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (((quotas?.products.used ?? 0) / (quotas?.products.max ?? 100)) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-1.5 flex justify-between">
              <span>{quotas?.products.remaining ?? 0} slot menu tersisa</span>
              <span className="text-emerald-300 font-bold">{Math.round(((quotas?.products.used ?? 0) / (quotas?.products.max ?? 100)) * 100)}%</span>
            </div>
          </div>

        </div>
      </div>

      {/* ─── 2. BRANCH CONTROLS & SEARCH BAR ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Cari nama cabang, kode outlet, atau alamat..."
            className="form-control pl-10 text-xs text-slate-900 bg-white font-semibold"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <Store size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHubData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            title="Refresh Data Cabang"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenAddOutlet}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus size={16} /> Tambah Cabang Baru
          </button>
        </div>
      </div>

      {/* ─── 3. BRANCH CARDS GRID ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOutlets.map((outlet) => {
          const isActiveSession = outlet.id === currentActiveOutletId;

          return (
            <div 
              key={outlet.id} 
              className={`bg-white rounded-3xl p-6 border transition-all duration-300 shadow-sm relative flex flex-col justify-between ${
                isActiveSession 
                  ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-indigo-600/10' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Active Badge */}
              {isActiveSession && (
                <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase shadow-md flex items-center gap-1">
                  <Check size={12} /> Cabang Sesi Aktif
                </div>
              )}

              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                      {outlet.code}
                    </span>
                    <h3 className="font-black text-base text-slate-900 mt-1">
                      {outlet.name}
                    </h3>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                    outlet.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {outlet.status === 'ACTIVE' ? 'Buka / Operasional' : 'Nonaktif'}
                  </span>
                </div>

                {/* Info List */}
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{outlet.address || 'Alamat cabang belum diisi'}</span>
                  </div>

                  {outlet.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400 shrink-0" />
                      <span className="font-mono">{outlet.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Navigation size={14} className="text-slate-400 shrink-0" />
                    <span>Radius Geofencing: <strong>{outlet.gpsRadiusMeters || 100} Meter</strong></span>
                  </div>
                </div>

                {/* Today's Live Stats */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Omzet Hari Ini</div>
                    <div className="font-black text-xs text-emerald-600 mt-0.5">
                      {formatCurrency(outlet.todayRevenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Pesanan Hari Ini</div>
                    <div className="font-black text-xs text-slate-800 mt-0.5">
                      {outlet.todayOrdersCount} Transaksi
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenEditOutlet(outlet)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                  title="Edit Cabang"
                >
                  <Edit3 size={14} /> Edit
                </button>

                {!isActiveSession ? (
                  <button
                    onClick={() => handleSwitchActiveOutlet(outlet)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                  >
                    Buka Kasir Cabang Ini &rarr;
                  </button>
                ) : (
                  <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    <CheckCircle2 size={16} /> Sedang Terbuka
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: TAMBAH CABANG BARU                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 relative border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Store size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Buka Cabang Baru</h3>
                  <p className="text-xs text-slate-500">Alokasi kuota: {quotas?.outlets.used} dari {quotas?.outlets.max} cabang</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddOutlet} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nama Cabang / Outlet *</label>
                  <input
                    type="text"
                    required
                    className="form-control text-xs font-bold"
                    placeholder="Contoh: Muki Ramen Sudirman"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kode Cabang *</label>
                  <input
                    type="text"
                    required
                    className="form-control text-xs font-mono font-bold uppercase"
                    placeholder="MUK-02"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  className="form-control text-xs"
                  placeholder="Jl. Jenderal Sudirman No. 12, Jakarta..."
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Telepon Cabang</label>
                  <input
                    type="text"
                    className="form-control text-xs font-mono"
                    placeholder="08123456789"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Radius Absensi GPS (Meter)</label>
                  <input
                    type="number"
                    className="form-control text-xs font-mono"
                    placeholder="100"
                    value={formGpsRadius}
                    onChange={e => setFormGpsRadius(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan & Aktifkan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT CABANG                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {selectedOutletForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 relative border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Edit Data Cabang</h3>
                  <p className="text-xs text-slate-500">{selectedOutletForEdit.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOutletForEdit(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitEditOutlet} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nama Cabang</label>
                  <input
                    type="text"
                    required
                    className="form-control text-xs font-bold"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kode Cabang</label>
                  <input
                    type="text"
                    required
                    className="form-control text-xs font-mono font-bold uppercase"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  className="form-control text-xs"
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Telepon Cabang</label>
                  <input
                    type="text"
                    className="form-control text-xs font-mono"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Radius Absensi GPS (Meter)</label>
                  <input
                    type="number"
                    className="form-control text-xs font-mono"
                    value={formGpsRadius}
                    onChange={e => setFormGpsRadius(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOutletForEdit(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-md"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: UPGRADE KE PAKET MULTI-CABANG (GROWTH / ENTERPRISE)             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative border border-slate-200">
            <button 
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-md shadow-amber-500/10">
                <Sparkles size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                Kembangkan Bisnis Anda ke Multi-Cabang!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Batas kuota <strong>{subscription?.planName || 'Paket Starter'}</strong> Anda telah mencapai batas maksimal ({quotas?.outlets.max} Cabang).
              </p>
            </div>

            {/* Feature Comparison */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/60 space-y-3">
              <div className="text-xs font-black text-amber-900 uppercase tracking-wider">
                Keuntungan Upgrade ke Paket Growth (Multi-Outlet):
              </div>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2 font-bold text-slate-900">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Kelola hingga <strong>3 Cabang / Outlet</strong> dalam satu dashboard terintegrasi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Kapasitas hingga <strong>15 Akun Staf &amp; Kasir</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Modul Analisis Resep BOM &amp; Tingkat Keberhasilan Bahan Baku (Yield)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Integrasi Manajemen Multi-Gudang Pusat &amp; Transfer Stok Cabang</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="py-3 px-5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Tutup
              </button>
              <a
                href="https://wa.me/6281234567890?text=Halo%20Tim%20CodePOS,%20saya%20ingin%20upgrade%20ke%20Paket%20Growth%20Multi-Cabang"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-5 rounded-xl font-black text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Hubungi Kami untuk Upgrade Paket Instan <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TenantOutletHubView;
