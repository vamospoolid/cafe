import React, { useState, useEffect, useCallback } from 'react';
import { 
  UserCheck, DollarSign, Wallet, Award, Clock, CheckCircle2, History,
  Plus, Settings, Wrench, Percent, Sliders, ShieldCheck, X, Sparkles
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

export const MechanicList: React.FC = () => {
  const { token } = usePOS();
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [selectedMechanic, setSelectedMechanic] = useState<any | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutNotes, setPayoutNotes] = useState<string>('');

  // Rate Setup Modal
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [rateMechanic, setRateMechanic] = useState<any | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(20);

  // Quick Register Mechanic Modal
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    password: '',
    pin: '',
    commissionRate: 20
  });

  // Bengkel Commission & Assignment Settings Modal
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configLoading, setConfigLoading] = useState<boolean>(false);
  const [bengkelConfig, setBengkelConfig] = useState<{
    enableCommission: boolean;
    defaultCommissionRate: number;
    requireMechanicOnService: boolean;
    commissionBase: 'SERVICE_ONLY' | 'SERVICE_AND_PARTS';
  }>({
    enableCommission: true,
    defaultCommissionRate: 20,
    requireMechanicOnService: false,
    commissionBase: 'SERVICE_ONLY'
  });

  const fetchMechanics = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/bengkel/mechanics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMechanics(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat data staf mekanik', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchBengkelConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/bengkel/mechanics/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBengkelConfig({
          enableCommission: data.enableCommission ?? true,
          defaultCommissionRate: Math.round((data.defaultCommissionRate ?? 0.20) * 100),
          requireMechanicOnService: data.requireMechanicOnService ?? false,
          commissionBase: data.commissionBase || 'SERVICE_ONLY'
        });
      }
    } catch (e) {
      console.error('Failed to fetch bengkel config:', e);
    }
  }, [token]);

  useEffect(() => {
    fetchMechanics();
    fetchBengkelConfig();
  }, [fetchMechanics, fetchBengkelConfig]);

  const handleOpenPayout = (m: any) => {
    setSelectedMechanic(m);
    setPayoutAmount(m.pendingCommission || 0);
    setPayoutNotes(`Pencairan komisi periode ${new Date().toISOString().slice(0, 7)}`);
    setShowPayoutModal(true);
  };

  const handleConfirmPayout = async () => {
    if (!selectedMechanic || payoutAmount <= 0) {
      toast('Nominal pencairan tidak valid', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/bengkel/mechanics/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mechanicProfileId: selectedMechanic.profileId,
          amount: payoutAmount,
          notes: payoutNotes
        })
      });

      if (res.ok) {
        toast(`Pembayaran komisi untuk ${selectedMechanic.name} berhasil dicatat!`, 'success');
        setShowPayoutModal(false);
        fetchMechanics();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal memproses payout', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleOpenRate = (m: any) => {
    setRateMechanic(m);
    setCommissionRate(Math.round((m.commissionRate || 0.20) * 100));
    setShowRateModal(true);
  };

  const handleSaveRate = async () => {
    if (!rateMechanic) return;
    try {
      const res = await fetch('/api/bengkel/mechanics/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: rateMechanic.id,
          commissionType: 'PERCENT',
          commissionRate: commissionRate / 100
        })
      });

      if (res.ok) {
        toast(`Rate komisi untuk ${rateMechanic.name} diperbarui menjadi ${commissionRate}%!`, 'success');
        setShowRateModal(false);
        fetchMechanics();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengubah rate komisi', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleRegisterMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name.trim() || !registerForm.username.trim()) {
      toast('Nama dan username mekanik wajib diisi', 'warning');
      return;
    }

    try {
      setRegisterLoading(true);
      const res = await fetch('/api/bengkel/mechanics/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          username: registerForm.username.trim(),
          password: registerForm.password || '123456',
          pin: registerForm.pin || '123456',
          commissionRate: registerForm.commissionRate / 100,
          commissionType: 'PERCENT'
        })
      });

      if (res.ok) {
        toast(`Mekanik ${registerForm.name} berhasil ditambahkan!`, 'success');
        setShowRegisterModal(false);
        setRegisterForm({ name: '', username: '', password: '', pin: '', commissionRate: 20 });
        fetchMechanics();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menambahkan mekanik', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setConfigLoading(true);
      const res = await fetch('/api/bengkel/mechanics/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enableCommission: bengkelConfig.enableCommission,
          defaultCommissionRate: bengkelConfig.defaultCommissionRate / 100,
          requireMechanicOnService: bengkelConfig.requireMechanicOnService,
          commissionBase: bengkelConfig.commissionBase
        })
      });

      if (res.ok) {
        toast('Pengaturan komisi & penugasan mekanik berhasil disimpan!', 'success');
        setShowConfigModal(false);
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan pengaturan', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen pb-32 sm:pb-12">
      {/* HEADER SECTION */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
              Vertikal Bengkel Motor &amp; Mobil
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {mechanics.length} Mekanik Terdaftar
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Manajemen Mekanik &amp; Komisi Servis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Perhitungan bagi hasil otomatis saat SPK LUNAS. Kelola rate komisi jasa, penugasan teknisi, dan pencairan payout.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100/80 active:scale-95 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
          >
            <Settings size={15} className="text-slate-500" />
            <span>Pengaturan Komisi</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-bold text-xs shadow-md hover:shadow-purple-700/25 transition cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Tambah Mekanik Baru</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="text-xs font-medium">Memuat data mekanik &amp; profil komisi...</span>
          </div>
        ) : mechanics.length === 0 ? (
          <div className="col-span-full py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3 border border-purple-100">
              <Wrench size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800">Belum Ada Mekanik Terdaftar</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
              Daftarkan teknisi / mekanik bengkel Anda untuk mulai mencatat penugasan SPK perbaikan, tracking hasil servis, dan perhitungan komisi otomatis.
            </p>
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Daftarkan Mekanik Pertama</span>
            </button>
          </div>
        ) : (
          mechanics.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{m.name}</h3>
                    <span className="text-xs text-slate-400 font-medium">{m.role}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenRate(m)}
                  className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition"
                >
                  {Math.round((m.commissionRate || 0.20) * 100)}% Jasa
                </button>
              </div>

              {/* Commission Stats Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-500" />
                    Komisi Belum Dicairkan
                  </span>
                  <span className="text-sm font-extrabold text-amber-600">
                    Rp {(m.pendingCommission || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Total Sudah Dibayar
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Rp {(m.paidCommission || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                disabled={!m.pendingCommission || m.pendingCommission <= 0}
                onClick={() => handleOpenPayout(m)}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-40 disabled:hover:bg-emerald-600 cursor-pointer disabled:cursor-not-allowed"
              >
                <Wallet size={16} />
                Cairkan Komisi (Payout)
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal Payout */}
      {showPayoutModal && selectedMechanic && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Cairkan Komisi Mekanik</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedMechanic.name}</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal Pembayaran</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Pencairan</label>
                <textarea
                  rows={2}
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmPayout}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm"
              >
                Konfirmasi Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Commission Rate */}
      {showRateModal && rateMechanic && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Atur Rate Komisi Jasa</h3>
            <p className="text-xs text-slate-500 mb-4">{rateMechanic.name}</p>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 mb-2">Persentase Bagi Hasil Jasa (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-xl font-black text-purple-700 text-center"
                />
                <span className="text-base font-bold text-slate-600">% dari subtotal jasa</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Contoh: Servis Tune Up Rp 100.000 dengan rate 20% menghasilkan komisi Rp 20.000 untuk mekanik saat SPK LUNAS.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRateModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveRate}
                className="flex-1 py-2.5 rounded-lg bg-purple-700 text-white font-bold text-xs hover:bg-purple-800 shadow-sm transition active:scale-95 cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH MEKANIK BARU (QUICK REGISTER) */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Wrench size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Tambah Mekanik Baru</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Buat akun staf &amp; profil komisi bagi hasil bengkel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 flex items-center justify-center transition shadow-2xs cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRegisterMechanic} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Nama Lengkap Mekanik *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="budi_mekanik"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    PIN Absensi / Kasir
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="123456"
                    value={registerForm.pin}
                    onChange={(e) => setRegisterForm({ ...registerForm, pin: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-widest text-center focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Password Login (Opsional)
                </label>
                <input
                  type="password"
                  placeholder="Default: 123456"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 outline-none transition"
                />
              </div>

              <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200/80">
                <label className="block text-xs font-bold text-purple-900 mb-1 flex items-center justify-between">
                  <span>Persentase Bagi Hasil Jasa Servis</span>
                  <span className="text-sm font-black text-purple-700">{registerForm.commissionRate}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={registerForm.commissionRate}
                  onChange={(e) => setRegisterForm({ ...registerForm, commissionRate: parseInt(e.target.value, 10) || 0 })}
                  className="w-full accent-purple-700 cursor-pointer my-1.5"
                />
                <p className="text-[11px] text-purple-700/80 mt-1">
                  Mekanik akan menerima {registerForm.commissionRate}% dari total nilai subtotal jasa yang dikerjakan saat SPK lunas.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {registerLoading ? 'Menyimpan...' : 'Simpan Data Mekanik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PENGATURAN KOMISI & SISTEM MEKANIK (FLEKSIBEL) */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Pengaturan Komisi &amp; SPK Mekanik</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Atur fleksibilitas pembagian komisi &amp; aturan kerja bengkel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 flex items-center justify-center transition shadow-2xs cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveConfig} className="p-4 sm:p-6 space-y-4">
              {/* Option 1: Enable Commission Engine */}
              <div className="flex items-start justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800">Aktifkan Sistem Komisi Mekanik</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Jika diaktifkan, komisi bagi hasil jasa otomatis dihitung saat SPK berstatus LUNAS. Matikan jika bengkel menggaji flat bulanan.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={bengkelConfig.enableCommission}
                  onChange={(e) => setBengkelConfig({ ...bengkelConfig, enableCommission: e.target.checked })}
                  className="w-5 h-5 accent-purple-700 rounded cursor-pointer mt-0.5 shrink-0"
                />
              </div>

              {/* Option 2: Default Commission Rate */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Default Persentase Komisi Staf Baru (%)
                </label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={bengkelConfig.defaultCommissionRate}
                    onChange={(e) => setBengkelConfig({ ...bengkelConfig, defaultCommissionRate: parseInt(e.target.value, 10) || 0 })}
                    className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-base font-black text-purple-700 text-center outline-none focus:border-purple-600"
                  />
                  <span className="text-xs text-slate-500 font-medium">% dari nilai subtotal jasa per SPK</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Nilai ini akan otomatis diterapkan saat menambahkan mekanik baru. Rate per orang tetap bisa diatur berbeda.
                </p>
              </div>

              {/* Option 3: Mandatory Mechanic on Service */}
              <div className="flex items-start justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800">Wajibkan Penugasan Mekanik di SPK / Kasir</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Cegah transaksi servis disimpan jika belum ada mekanik yang ditugaskan pada jasa perbaikan.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={bengkelConfig.requireMechanicOnService}
                  onChange={(e) => setBengkelConfig({ ...bengkelConfig, requireMechanicOnService: e.target.checked })}
                  className="w-5 h-5 accent-purple-700 rounded cursor-pointer mt-0.5 shrink-0"
                />
              </div>

              {/* Option 4: Commission Base */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Basis Perhitungan Bagi Hasil Komisi
                </label>
                <select
                  value={bengkelConfig.commissionBase}
                  onChange={(e) => setBengkelConfig({ ...bengkelConfig, commissionBase: e.target.value as any })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                >
                  <option value="SERVICE_ONLY">Hanya Jasa Servis (Standar Bengkel Otomotif)</option>
                  <option value="SERVICE_AND_PARTS">Jasa Servis + Penjualan Sparepart</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Rekomendasi: Pilih "Hanya Jasa Servis" agar komisi mekanik tidak memotong modal inventaris suku cadang bengkel.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={configLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {configLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MechanicList;
