import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  Laptop, 
  RefreshCw, 
  X,
  Sparkles,
  Lock,
  PhoneCall
} from 'lucide-react';
import { toast } from '../utils/alert';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isForced?: boolean; // Jika belum aktif, tidak boleh ditutup
}

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isForced = false
}) => {
  const [hardwareId, setHardwareId] = useState<string>('MEMUAT...');
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<any | null>(null);

  const vertical = (import.meta.env.VITE_STANDALONE_VERTICAL || 'BENGKEL').toUpperCase();

  // Load Hardware ID dan Status Lisensi
  useEffect(() => {
    if (!isOpen) return;

    const fetchHwId = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.getHardwareId) {
          const hwId = await (window as any).electronAPI.getHardwareId();
          setHardwareId(hwId);
          localStorage.setItem('codepos_hardware_id', hwId);

          if ((window as any).electronAPI.getLicenseStatus) {
            const status = await (window as any).electronAPI.getLicenseStatus();
            setLicenseStatus(status);
          }
        } else {
          // Fallback di browser
          let fallbackHwId = localStorage.getItem('codepos_hardware_id');
          if (!fallbackHwId) {
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
            const rand2 = Math.random().toString(36).substring(2, 6).toUpperCase();
            const prefix = vertical === 'BENGKEL' ? 'BK' : vertical === 'KAFE' ? 'KF' : 'RT';
            fallbackHwId = `${prefix}-8821-${rand}-${rand2}`;
            localStorage.setItem('codepos_hardware_id', fallbackHwId);
          }
          setHardwareId(fallbackHwId);
        }
      } catch (err: any) {
        console.warn('Gagal membaca Hardware ID:', err);
        setHardwareId('BK-8821-F904-77A1');
      }
    };

    fetchHwId();
  }, [isOpen, vertical]);

  if (!isOpen) return null;

  const handleCopyHardwareId = () => {
    if (!hardwareId || hardwareId === 'MEMUAT...') return;
    navigator.clipboard.writeText(hardwareId);
    setIsCopied(true);
    toast('✓ Hardware ID berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenWhatsAppAdmin = () => {
    const text = encodeURIComponent(
      `Halo Admin CodePOS, saya ingin meminta Serial Activation Key Beli-Putus untuk toko saya.\n\n` +
      `Vertikal: ${vertical}\n` +
      `Hardware ID Laptop: ${hardwareId}\n\n` +
      `Mohon dibantu pembuatan serial key aktivasinya. Terima kasih!`
    );
    window.open(`https://wa.me/6281234567890?text=${text}`, '_blank');
  };

  const handleActivate = async () => {
    const key = licenseKeyInput.trim();
    if (!key) {
      setErrorMsg('Masukkan Serial Activation Key terlebih dahulu.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Prioritaskan aktivasi via Electron IPC
      if (typeof window !== 'undefined' && (window as any).electronAPI?.verifyLicense) {
        const res = await (window as any).electronAPI.verifyLicense(key);
        if (res.success) {
          localStorage.setItem('codepos_license_key', key);
          toast('🎉 Aktivasi Berhasil! Aplikasi telah terbuka permanen seumur hidup.', 'success');
          if (onSuccess) onSuccess();
          onClose();
          return;
        } else {
          setErrorMsg(res.error || 'Serial Activation Key tidak valid untuk perangkat ini.');
          return;
        }
      }

      // 2. Fallback aktivasi via API backend
      const res = await fetch('/api/sync/verify-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, vertical })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        localStorage.setItem('codepos_license_key', key);
        toast('🎉 Aktivasi Berhasil! Lisensi Beli-Putus Aktif Selamanya.', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(json.error || 'Serial Activation Key tidak valid.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memvalidasi lisensi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Aktivasi Lisensi Beli-Putus</h3>
              <p className="text-[11px] text-purple-200 font-medium">Kunci Perangkat Offline • {vertical} Pro</p>
            </div>
          </div>

          {!isForced && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Status Badge jika sudah aktif */}
          {licenseStatus?.isActivated ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="font-black text-emerald-950">Status: Lisensi Aktif Selamanya (Lifetime)</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Toko: <strong>{licenseStatus.licenseDetails?.storeName || 'Toko Mandiri'}</strong> • Paket: <strong>{licenseStatus.licenseDetails?.tier || 'PRO'}</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Aplikasi ini terkunci khusus pada komponen fisik (Motherboard & CPU) laptop kasir ini agar aman dari duplikasi tidak sah.
              </p>
            </div>
          )}

          {/* Step 1: Hardware ID */}
          <div className="space-y-1.5">
            <label className="font-black text-slate-800 flex items-center gap-1.5">
              <Laptop size={14} className="text-purple-700" />
              <span>LANGKAH 1: Hardware ID Laptop Anda</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2.5 font-mono font-black text-slate-900 tracking-wider text-sm select-all">
                {hardwareId}
              </div>
              <button
                type="button"
                onClick={handleCopyHardwareId}
                className="py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold border border-purple-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              >
                {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Kirimkan Hardware ID ini ke WhatsApp Developer untuk mendapatkan Serial Key aktivasi.
            </p>
          </div>

          {/* Tombol WhatsApp Cepat */}
          <button
            type="button"
            onClick={handleOpenWhatsAppAdmin}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <PhoneCall size={14} />
            <span>Kirim Hardware ID via WhatsApp Admin</span>
          </button>

          {/* Step 2: Input Serial Key */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="font-black text-slate-800 flex items-center gap-1.5">
              <Key size={14} className="text-indigo-600" />
              <span>LANGKAH 2: Masukkan Serial Activation Key</span>
            </label>
            <textarea
              rows={3}
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              placeholder="Contoh: LIC-BENGKEL-eyJhbGciOiJIUzI1Ni...X8821"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
            />
            {errorMsg && (
              <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
                <AlertCircle size={13} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleActivate}
            disabled={loading || !licenseKeyInput.trim()}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black text-sm shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span>{loading ? 'Memvalidasi Kunci...' : 'Aktivasi Lisensi Sekarang'}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-100 text-center text-[10px] text-slate-500">
          Lisensi Beli-Putus Berlaku Selamanya • 100% Bebas Biaya Bulanan & Bebas Kuota Internet
        </div>
      </div>
    </div>
  );
};

export default ActivationModal;
