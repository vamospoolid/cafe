/**
 * StandaloneActivationModal.tsx
 * Dialog Aktivasi Lisensi Perangkat Standalone Offline (Beli-Putus 1x Bayar)
 * Menampilkan Hardware ID unik perangkat dan memvalidasi Serial Key secara offline
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Copy, 
  Check, 
  Smartphone, 
  Store, 
  HelpCircle, 
  ExternalLink, 
  MessageSquare,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { LicenseService } from '../services/LicenseService';
import { toast, errorAlert } from '../utils/alert';

interface StandaloneActivationModalProps {
  isOpen: boolean;
  onActivated: (licenseData: any) => void;
  onSwitchToOnline?: () => void;
}

export const StandaloneActivationModal: React.FC<StandaloneActivationModalProps> = ({
  isOpen,
  onActivated,
  onSwitchToOnline
}) => {
  const [hwid, setHwid] = useState<string>('Memuat...');
  const [storeName, setStoreName] = useState<string>('');
  const [vertical, setVertical] = useState<string>('RETAIL');
  const [serialKey, setSerialKey] = useState<string>('');
  const [activating, setActivating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      LicenseService.getHardwareId().then((id) => setHwid(id));
      const savedStore = localStorage.getItem('cpos_license_store');
      if (savedStore) setStoreName(savedStore);
      const savedVertical = localStorage.getItem('pos_business_type');
      if (savedVertical) setVertical(savedVertical);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyHwid = () => {
    navigator.clipboard.writeText(hwid);
    setCopied(true);
    toast('✅ Hardware ID disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToWhatsApp = () => {
    const message = encodeURIComponent(
      `Halo Admin CodePOS, saya ingin mengaktifkan lisensi Standalone Beli-Putus untuk perangkat saya:\n\n• Hardware ID: *${hwid}*\n• Nama Toko: *${storeName || '[Nama Toko]'}*\n• Jenis Usaha: *${vertical}*\n\nMohon bantuannya untuk penerbitan Serial Key. Terima kasih!`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeName.trim()) {
      errorAlert('Nama Toko Wajib Diisi', 'Silakan masukkan nama toko atau unit usaha Anda.');
      return;
    }

    if (!serialKey.trim()) {
      errorAlert('Serial Key Wajib Diisi', 'Silakan tempelkan Serial Key yang Anda dapatkan dari Admin/Developer.');
      return;
    }

    setActivating(true);
    try {
      const res = await LicenseService.activateLicense(storeName, vertical, serialKey);
      if (res.success) {
        toast(res.message, 'success');
        onActivated({
          hardwareId: hwid,
          storeName: storeName.trim(),
          vertical,
          serialKey: serialKey.trim().toUpperCase()
        });
      } else {
        errorAlert('Aktivasi Gagal', res.message);
      }
    } catch (err: any) {
      errorAlert('Terjadi Kesalahan', err.message || 'Gagal memproses validasi lisensi.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden text-slate-800">
        {/* Header Header Gradient */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/80 border border-indigo-400/30 flex items-center justify-center text-white shadow-lg">
                <ShieldCheck size={26} />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  Beli-Putus • One-Time License
                </span>
                <h3 className="text-lg font-black tracking-tight mt-0.5">Aktivasi Perangkat Standalone</h3>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-3 relative z-10 leading-relaxed">
            Aplikasi ini berjalan 100% secara offline tanpa server cloud. Masukkan Serial Key resmi untuk membuka akses permanen.
          </p>

          <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl" />
        </div>

        {/* Form Body */}
        <form onSubmit={handleActivate} className="p-6 space-y-5">
          {/* Hardware ID Display Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Smartphone size={13} className="text-indigo-600" />
                <span>Hardware ID Tablet Ini</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                Terkunci Unik
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-base font-black tracking-wider text-slate-800 bg-white py-2 px-3 rounded-xl border border-slate-200 select-all">
                {hwid}
              </div>
              <button
                type="button"
                onClick={handleCopyHwid}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs border border-indigo-200 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Salin Hardware ID"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-400">
                Kirim kode di atas ke Admin untuk menerbitkan Serial Key.
              </p>
              <button
                type="button"
                onClick={handleSendToWhatsApp}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare size={12} />
                <span>Kirim via WA</span>
              </button>
            </div>
          </div>

          {/* Input: Nama Toko */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Nama Toko / Unit Usaha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Store size={15} />
              </div>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Contoh: Bengkel Maju Motor / Toko Barokah"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Input: Jenis Vertikal */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Jenis Usaha (Vertikal MVP) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Layers size={15} />
              </div>
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white cursor-pointer"
              >
                <option value="RETAIL">🏪 Retail, Sembako & Toko Bangunan (Material)</option>
                <option value="BENGKEL">🚗 Bengkel Motor & Mobil (SPK & Pit Servis)</option>
                <option value="CAFE">☕ Kafe, Resto & F&B (Denah Meja & Dapur KDS)</option>
                <option value="LAUNDRY">🧺 Laundry Kiloan & Satuan (Timbangan & Rak)</option>
                <option value="RENTAL">🔑 Rental & Persewaan (Booking & Jaminan)</option>
              </select>
            </div>
          </div>

          {/* Input: Serial Key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Serial Activation Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound size={15} />
              </div>
              <input
                type="text"
                value={serialKey}
                onChange={(e) => setSerialKey(e.target.value.toUpperCase())}
                placeholder="KEY-RET-XXXX-XXXX-XXXX-XXXX"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold tracking-wider text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Tempelkan 24 karakter kunci yang Anda terima dari Admin.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={activating}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={15} />
            <span>{activating ? 'Memvalidasi Kunci...' : 'Aktifkan Lisensi Permanen'}</span>
          </button>

          {/* Switch to SaaS Cloud Login option */}
          {onSwitchToOnline && (
            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={onSwitchToOnline}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
              >
                <span>Gunakan Mode SaaS Online (Login Akun Cloud)</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
