import React, { useState, useEffect, useContext } from 'react';
import { 
  Building2, TrendingUp, ShoppingBag, Wallet, Receipt, Trophy, 
  Plus, Calendar, ArrowRight, RefreshCw, MapPin, CheckCircle2,
  AlertCircle, X
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface OutletStat {
  outletId: string;
  name: string;
  code: string;
  status: string;
  address: string | null;
  totalRevenue: number;
  totalOrders: number;
  totalExpense: number;
  netProfit: number;
  aov: number;
}

interface ConsolidatedData {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    consolidatedRevenue: number;
    consolidatedOrders: number;
    consolidatedExpense: number;
    consolidatedProfit: number;
    consolidatedAOV: number;
    outletCount: number;
    topPerformingOutlet: {
      name: string;
      code: string;
      revenue: number;
    } | null;
  };
  outlets: OutletStat[];
}

export const ConsolidatedOutletDashboard: React.FC = () => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'thisMonth'>('thisMonth');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Form tambah cabang
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletCode, setNewOutletCode] = useState('');
  const [newOutletAddress, setNewOutletAddress] = useState('');
  const [newOutletPhone, setNewOutletPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatRupiah = (num: number) => `Rp ${(num || 0).toLocaleString('id-ID')}`;

  const fetchConsolidatedSummary = async () => {
    try {
      setLoading(true);
      const now = new Date();
      let startDateStr = '';
      let endDateStr = now.toISOString().split('T')[0];

      if (period === 'today') {
        startDateStr = endDateStr;
      } else if (period === '7days') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateStr = d.toISOString().split('T')[0];
      } else if (period === '30days') {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDateStr = d.toISOString().split('T')[0];
      } else if (period === 'thisMonth') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = d.toISOString().split('T')[0];
      }

      const queryParams = new URLSearchParams();
      if (startDateStr) queryParams.set('startDate', startDateStr);
      if (endDateStr) queryParams.set('endDate', endDateStr);

      const res = await fetch(`/api/outlets/consolidated-summary?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${posContext?.token}`
        }
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast('Gagal memuat laporan konsolidasi multi-cabang', 'error');
      }
    } catch (err) {
      console.error('Error fetching consolidated report:', err);
      toast('Terjadi kesalahan koneksi saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchConsolidatedSummary();
    }
  }, [posContext?.token, period]);

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName.trim()) {
      toast('Nama cabang wajib diisi.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/outlets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          name: newOutletName.trim(),
          code: newOutletCode.trim() || undefined,
          address: newOutletAddress.trim() || undefined,
          phone: newOutletPhone.trim() || undefined
        })
      });

      const resJson = await res.json();
      if (res.ok) {
        toast(`✅ Cabang "${resJson.outlet.name}" berhasil didaftarkan!`, 'success');
        setIsAddModalOpen(false);
        setNewOutletName('');
        setNewOutletCode('');
        setNewOutletAddress('');
        setNewOutletPhone('');
        fetchConsolidatedSummary();
      } else {
        toast(resJson.error || 'Gagal mendaftarkan cabang baru.', 'error');
      }
    } catch (err) {
      toast('Kesalahan server saat membuat cabang.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchOutlet = async (outletId: string, outletName: string) => {
    try {
      setSwitchingId(outletId);
      const res = await fetch('/api/auth/switch-outlet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ outletId })
      });

      const resJson = await res.json();
      if (res.ok) {
        toast(`✅ Beralih ke cabang: ${outletName}`, 'success');
        if (resJson.token && posContext?.login) {
          posContext.login(resJson.user || posContext.user, resJson.token);
        }
        window.location.reload();
      } else {
        toast(resJson.error || 'Gagal beralih ke cabang ini.', 'error');
      }
    } catch (err) {
      toast('Kesalahan koneksi saat beralih cabang.', 'error');
    } finally {
      setSwitchingId(null);
    }
  };

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(String(posContext?.user?.role).toUpperCase()) || (posContext?.user as any)?.isPlatformAdmin;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-black text-slate-800 tracking-tight">
                Konsolidasi Seluruh Cabang
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                {data?.summary.outletCount || 0} Outlet
              </span>
            </div>
            <p className="text-slate-500 text-xs">
              Pantau total omset, transaksi, dan perbandingan performa antar cabang dalam satu layar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Periode Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold gap-0.5 shrink-0">
            <button 
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${period === 'today' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Hari Ini
            </button>
            <button 
              onClick={() => setPeriod('7days')}
              className={`px-3 py-1.5 rounded-lg transition-all ${period === '7days' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              7 Hari
            </button>
            <button 
              onClick={() => setPeriod('thisMonth')}
              className={`px-3 py-1.5 rounded-lg transition-all ${period === 'thisMonth' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Bulan Ini
            </button>
          </div>

          {/* Tombol Tambah Cabang (Khusus Owner/Admin) */}
          {isOwnerOrAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn bg-slate-900 hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Tambah Cabang</span>
            </button>
          )}

          <button 
            onClick={fetchConsolidatedSummary}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Omset Gabungan */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs border-l-4 border-l-indigo-600 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Omset Gabungan</span>
            <div className="text-base sm:text-2xl font-black text-indigo-700 mt-0.5 truncate">
              {formatRupiah(data?.summary.consolidatedRevenue || 0)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Semua cabang operasional</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Wallet size={18} />
          </div>
        </div>

        {/* Total Transaksi */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Transaksi</span>
            <div className="text-base sm:text-2xl font-black text-emerald-600 mt-0.5">
              {(data?.summary.consolidatedOrders || 0).toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Nota &amp; SPK lunas seluruh cabang</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShoppingBag size={18} />
          </div>
        </div>

        {/* Total Pengeluaran */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs border-l-4 border-l-rose-500 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Beban Operasional</span>
            <div className="text-base sm:text-2xl font-black text-rose-600 mt-0.5 truncate">
              {formatRupiah(data?.summary.consolidatedExpense || 0)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Petty cash &amp; beban operasional</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Receipt size={18} />
          </div>
        </div>

        {/* Laba Bersih Agregat */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs border-l-4 border-l-purple-600 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Laba Bersih Gabungan</span>
            <div className={`text-base sm:text-2xl font-black mt-0.5 truncate ${(data?.summary.consolidatedProfit || 0) >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
              {formatRupiah(data?.summary.consolidatedProfit || 0)}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Omset dikurangi beban kas</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
        </div>
      </div>

      {/* TOP PERFORMING OUTLET HIGHLIGHT (JIKA ADA LEBIH DARI 1 CABANG) */}
      {data?.summary.topPerformingOutlet && (data.outlets.length > 1) && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-amber-100 shrink-0">
              <Trophy size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-100">Cabang Performa Tertinggi</div>
              <div className="text-sm sm:text-base font-black">
                {data.summary.topPerformingOutlet.name} ({data.summary.topPerformingOutlet.code})
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-amber-100 font-medium">Omset Periode Ini</div>
            <div className="text-sm sm:text-lg font-black">{formatRupiah(data.summary.topPerformingOutlet.revenue)}</div>
          </div>
        </div>
      )}

      {/* PERBANDINGAN PERFORMA SETIAP CABANG */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
            Rincian & Peringkat Performa Outlet
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Diurutkan dari omset tertinggi
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw size={24} className="animate-spin text-indigo-600" />
            <span className="text-xs font-bold">Mengagregasi data cabang...</span>
          </div>
        ) : !data?.outlets || data.outlets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Belum ada cabang outlet yang terdaftar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.outlets.map((outlet, index) => {
              const revenueShare = data.summary.consolidatedRevenue > 0
                ? Math.round((outlet.totalRevenue / data.summary.consolidatedRevenue) * 100)
                : 0;

              const isCurrentOutlet = posContext?.user?.outletId === outlet.outletId;

              return (
                <div key={outlet.outletId} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Rank & Outlet Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      index === 0 && outlet.totalRevenue > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      #{index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">{outlet.name}</h4>
                        <span className="px-1.5 py-0.2 rounded-md font-mono text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {outlet.code}
                        </span>
                        {isCurrentOutlet && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Cabang Aktif Anda
                          </span>
                        )}
                      </div>

                      {outlet.address && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate">{outlet.address}</span>
                        </div>
                      )}

                      {/* Revenue Share Bar */}
                      <div className="mt-2.5 max-w-xs">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                          <span>Kontribusi Omset</span>
                          <span className="text-indigo-600">{revenueShare}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                            style={{ width: `${revenueShare}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Metrics Breakdown */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-6 text-center sm:text-right shrink-0 bg-slate-50/80 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Omset</div>
                      <div className="text-xs sm:text-sm font-black text-indigo-700 mt-0.5">
                        {formatRupiah(outlet.totalRevenue)}
                      </div>
                      <div className="text-[10px] text-slate-500">{outlet.totalOrders} nota</div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Beban</div>
                      <div className="text-xs sm:text-sm font-black text-rose-600 mt-0.5">
                        {formatRupiah(outlet.totalExpense)}
                      </div>
                      <div className="text-[10px] text-slate-500">operasional</div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Laba</div>
                      <div className={`text-xs sm:text-sm font-black mt-0.5 ${outlet.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatRupiah(outlet.netProfit)}
                      </div>
                      <div className="text-[10px] text-slate-500">bersih</div>
                    </div>
                  </div>

                  {/* Right: Switch Action */}
                  <div className="shrink-0 flex items-center sm:justify-end">
                    {!isCurrentOutlet ? (
                      <button
                        onClick={() => handleSwitchOutlet(outlet.outletId, outlet.name)}
                        disabled={switchingId === outlet.outletId}
                        className="btn bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer w-full sm:w-auto justify-center"
                      >
                        {switchingId === outlet.outletId ? (
                          <RefreshCw size={13} className="animate-spin text-indigo-600" />
                        ) : (
                          <>
                            <span>Masuk ke Cabang</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Sedang Terbuka
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL PENDAFTARAN CABANG OUTLET BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Daftarkan Cabang Baru</h3>
                  <p className="text-[11px] text-slate-500">Buka cabang, outlet, atau drop-point baru</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Cabang / Outlet <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Contoh: Cabang Sudirman, Drop-Point Senayan"
                  value={newOutletName}
                  onChange={(e) => setNewOutletName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Cabang (Opsional)
                </label>
                <input 
                  type="text"
                  placeholder="Contoh: CAB-02, DP-01 (otomatis jika kosong)"
                  value={newOutletCode}
                  onChange={(e) => setNewOutletCode(e.target.value.toUpperCase())}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea 
                  rows={2}
                  placeholder="Jl. Raya Utama No. 123..."
                  value={newOutletAddress}
                  onChange={(e) => setNewOutletAddress(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. Telepon / WhatsApp Cabang
                </label>
                <input 
                  type="text"
                  placeholder="08123456789"
                  value={newOutletPhone}
                  onChange={(e) => setNewOutletPhone(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Cabang Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsolidatedOutletDashboard;
