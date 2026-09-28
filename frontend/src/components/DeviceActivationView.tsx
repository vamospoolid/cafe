import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tablet,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Store,
  RefreshCw,
  LogIn,
  AlertCircle
} from 'lucide-react';
import { toast } from '../utils/alert';

interface DeviceActivationViewProps {
  onSuccess?: (data: any) => void;
  onSwitchToManualLogin?: () => void;
}

export const DeviceActivationView: React.FC<DeviceActivationViewProps> = ({
  onSuccess,
  onSwitchToManualLogin
}) => {
  const navigate = useNavigate();
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Auto insert hyphen if user types without hyphen
    if (val.length === 3 && !val.includes('-')) {
      val = val + '-';
    }
    setPairingCode(val);
    setErrorMsg('');
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = pairingCode.trim();
    if (!cleanCode || cleanCode.length < 5) {
      setErrorMsg('Masukkan kode aktivasi lengkap (contoh: TAB-8921)');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode: cleanCode,
          deviceName: navigator.userAgent.includes('Android') ? 'Tablet Android' : 'Terminal Kasir Tablet',
          appVersion: '1.0.0'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengaktivasi tablet kasir.');
      }

      toast(`✅ Tablet berhasil terhubung ke ${data.settings?.storeName || data.tenant?.name}!`, 'success');
      if (onSuccess) {
        onSuccess(data);
      } else {
        window.location.href = '/pos';
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat aktivasi.');
      toast(err.message || 'Aktivasi gagal', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 font-sans">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 relative overflow-hidden animate-fade-in">
        
        {/* Glow ambient background effect */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* HEADER */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Tablet size={32} />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
              <Sparkles size={12} /> Setup Terminal Kasir Tablet
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Aktivasi Tablet Kasir
            </h1>
            <p className="text-xs text-slate-300/80 mt-1 max-w-xs mx-auto leading-relaxed">
              Hubungkan tablet ini ke cabang toko Anda menggunakan kode pairing dari Dashboard Owner
            </p>
          </div>
        </div>

        {/* ACTIVATION FORM */}
        <form onSubmit={handlePairSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <KeyRound size={14} className="text-indigo-400" />
              Kode Pairing Perangkat (6 Karakter)
            </label>
            <div className="relative">
              <input
                type="text"
                value={pairingCode}
                onChange={handleCodeChange}
                placeholder="TAB-8921"
                maxLength={8}
                disabled={loading}
                className="w-full text-center tracking-[0.3em] font-mono text-xl sm:text-2xl font-black py-3.5 px-4 rounded-2xl bg-black/40 border border-white/20 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 uppercase transition-all shadow-inner disabled:opacity-50"
              />
            </div>
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mt-1">
                <AlertCircle size={14} />
                {errorMsg}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || pairingCode.length < 5}
            className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Menghubungkan Perangkat...
              </>
            ) : (
              <>
                Aktivasi Sekarang <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* OWNER GUIDE BOX */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
          <Store size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white">Cara Mendapatkan Kode:</span> Buka dashboard SaaS di laptop/HP Owner &rarr; Masuk menu <strong>Pengaturan Outlet</strong> &rarr; Klik <strong>"Aktivasi Tablet Baru"</strong>.
          </div>
        </div>

        {/* SWITCH TO TRADITIONAL LOGIN */}
        <div className="border-t border-white/10 pt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (onSwitchToManualLogin) {
                onSwitchToManualLogin();
              } else {
                navigate('/login');
              }
            }}
            className="text-xs font-semibold text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogIn size={14} />
            Masuk dengan Akun Kasir (Username & Password)
          </button>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <ShieldCheck size={12} className="text-emerald-400" />
            <span>Enkripsi SSL & Isolasi Multi-Tenant Aktif</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DeviceActivationView;
