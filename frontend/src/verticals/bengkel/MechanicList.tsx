import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, DollarSign, Wallet, Award, Clock, CheckCircle2, History } from 'lucide-react';
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

  useEffect(() => {
    fetchMechanics();
  }, [fetchMechanics]);

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

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Manajemen Mekanik & Komisi Servis</h1>
        <p className="text-sm text-slate-500">
          Perhitungan komisi otomatis saat SPK dinyatakan LUNAS. Kelola rate bagi hasil jasa dan pencairan payout mekanik.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Memuat data mekanik...</div>
        ) : mechanics.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            Belum ada user dengan role Mekanik terdaftar. Tambahkan staf di menu Kelola Pengguna.
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
                className="flex-1 py-2.5 rounded-lg bg-purple-700 text-white font-bold text-xs hover:bg-purple-800 shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MechanicList;
