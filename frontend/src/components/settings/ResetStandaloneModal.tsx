import React, { useState, useContext } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Lock,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Download,
  Trash2,
  Database,
  Eye,
  EyeOff,
  ShoppingBag,
  Boxes,
  Users,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { POSContext } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { offlineDB } from '../../utils/offlineDb';

interface ResetStandaloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetStandaloneModal: React.FC<ResetStandaloneModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const posContext = useContext(POSContext);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [confirmText, setConfirmText] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);

  // Execution states
  const [loading, setLoading] = useState(false);
  const [activeStepText, setActiveStepText] = useState('');
  const [resetStats, setResetStats] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const storeName = posContext?.settings?.storeName || 'Muki Ramen';
  const expectedKeyword = 'RESET MUKI RAMEN';
  const isKeywordValid = confirmText.trim().toUpperCase() === expectedKeyword ||
    confirmText.trim().toUpperCase() === `RESET ${storeName.trim().toUpperCase()}`;

  const handleDownloadBackupFirst = async () => {
    try {
      const response = await fetch('/api/database/backup', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (!response.ok) throw new Error('Gagal mengunduh backup');

      let filename = `backup-pre-reset-${new Date().toISOString().slice(0, 10)}.json`;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.warn('Backup download error before reset:', err);
    }
  };

  const handleExecuteReset = async () => {
    if (!pinOrPassword.trim()) {
      setErrorMessage('PIN atau kata sandi Owner wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setStep(3);

    try {
      // Step 3.1: Download backup if selected
      if (createBackup) {
        setActiveStepText('Menyiapkan & mengunduh snapshot backup darurat...');
        await handleDownloadBackupFirst();
      }

      // Step 3.2: Call backend reset endpoint
      setActiveStepText('Membersihkan transaksi, menu, bahan baku, dan pelanggan...');
      const res = await fetch('/api/settings/reset-standalone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          confirmText: confirmText.trim(),
          pin: pinOrPassword.trim(),
          createBackup
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mereset database.');
      }

      // Step 3.3: Clear offline client cache (IndexedDB)
      setActiveStepText('Membersihkan cache lokal peramban (IndexedDB)...');
      try {
        await offlineDB.clearOperationalCache();
      } catch (cacheErr) {
        console.warn('Gagal membersihkan cache offline:', cacheErr);
      }

      // Step 3.4: Finish
      setResetStats(data.stats);
      setStep(4);
      toast('Reset database berhasil! Sistem telah bersih.', 'success');
      if (onSuccess) onSuccess();

    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat mereset database.');
      setStep(2); // Kembali ke step 2 agar user bisa perbaiki input
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAndFinish = () => {
    onClose();
    // Redirect ke halaman bahan-baku atau refresh window agar seluruh state bersih
    window.location.href = '/bahan-baku';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-red-200/80 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-red-600 via-rose-700 to-red-800 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                <Trash2 size={22} className="text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Reset Database Penuh</h3>
                <p className="text-xs text-red-100 font-medium">Standalone Independent Mode • Muki Ramen</p>
              </div>
            </div>
            {step !== 3 && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Stepper Indicator */}
          {step <= 3 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/15 text-[11px] font-bold">
              <span className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${step === 1 ? 'bg-white text-red-700' : 'bg-white/20 text-white'}`}>
                1. Cakupan Data
              </span>
              <ArrowRight size={12} className="opacity-60" />
              <span className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${step === 2 ? 'bg-white text-red-700' : 'bg-white/20 text-white'}`}>
                2. Verifikasi PIN Owner
              </span>
              <ArrowRight size={12} className="opacity-60" />
              <span className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${step === 3 ? 'bg-white text-red-700' : 'bg-white/20 text-white'}`}>
                3. Eksekusi
              </span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: CAKUPAN DATA & PERINGATAN */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 leading-relaxed">
                  <strong className="font-bold">Peringatan Kritis:</strong> Fitur ini dirancang khusus bagi Owner yang ingin memulai kembali operasional dengan data bersih. Pastikan Anda telah mengonfirmasi bahwa seluruh riwayat transaksi tidak lagi dibutuhkan.
                </div>
              </div>

              {/* Data Breakdown Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Dihapus */}
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                  <div className="font-bold text-rose-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <Trash2 size={13} />
                    <span>Data yang Dihapus (Nol)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Semua Transaksi & Detail Order</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Bahan Baku, Stok & Resep</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Katalog Menu & Kategori</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Pelanggan, Poin & Piutang</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Shift Kasir & Catatan Arus Kas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Catatan Gudang Pusat & PO</span>
                    </li>
                  </ul>
                </div>

                {/* Dipertahankan */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="font-bold text-emerald-700 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <ShieldAlert size={13} />
                    <span>Data yang Aman (Tetap Ada)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Akun Staf, Kasir & Login Owner</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Pengaturan Toko, Pajak, Printer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Denah & Nomor Meja Restoran</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Status Meja Direset ke "Aktif"</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Safety Option: Auto Backup */}
              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={createBackup}
                  onChange={(e) => setCreateBackup(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-slate-300"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Unduh Berkas Backup Otomatis (JSON)</span>
                  <p className="text-slate-400 text-[11px]">Sistem akan mengunduh salinan data ke perangkat ini sebelum penghapusan dilakukan.</p>
                </div>
              </label>

              {/* Keyword Confirmation Input */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Untuk melanjutkan, ketik persis: <span className="font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">RESET MUKI RAMEN</span>
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Ketik RESET MUKI RAMEN di sini..."
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-mono tracking-wide focus:outline-none transition-all ${
                    isKeywordValid
                      ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  }`}
                  autoFocus
                />
                {confirmText && !isKeywordValid && (
                  <p className="text-[11px] text-red-500">Teks belum cocok dengan kata kunci konfirmasi.</p>
                )}
                {isKeywordValid && (
                  <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Kata kunci konfirmasi terverifikasi!</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: VERIFIKASI PIN / PASSWORD OWNER */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <Lock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <strong className="font-bold">Otorisasi Keamanan Owner:</strong> Masukkan PIN kasir atau kata sandi akun Owner untuk memvalidasi identitas dan mengeksekusi reset database.
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  PIN Kasir / Kata Sandi Akun Owner:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={pinOrPassword}
                    onChange={(e) => setPinOrPassword(e.target.value)}
                    placeholder="Masukkan PIN (e.g. 1234) atau kata sandi..."
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-sm font-medium focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pinOrPassword.trim()) {
                        handleExecuteReset();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Anda dapat menggunakan 4-6 digit PIN Kasir Anda atau password login akun Owner.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: LOADING & PROSES PROGRESS */}
          {step === 3 && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <RefreshCw size={32} className="animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-900">Sedang Membersihkan Database...</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  {activeStepText || 'Mohon jangan menutup atau memuat ulang halaman ini...'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SELESAI (SUCCESS) */}
          {step === 4 && (
            <div className="py-6 space-y-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900">Reset Database Berhasil!</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Seluruh data operasional, transaksi, bahan baku, dan menu lama telah dibersihkan. Sistem siap untuk data baru.
                </p>
              </div>

              {/* Stats pill summary */}
              {resetStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Transaksi Dihapus</div>
                    <div className="text-base font-black text-slate-800 mt-0.5">{resetStats.orders ?? 0} Order</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Menu Dihapus</div>
                    <div className="text-base font-black text-slate-800 mt-0.5">{resetStats.products ?? 0} Menu</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Bahan Baku</div>
                    <div className="text-base font-black text-slate-800 mt-0.5">{resetStats.ingredients ?? 0} Item</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Meja Direset</div>
                    <div className="text-base font-black text-emerald-600 mt-0.5">{resetStats.tablesReset ?? 0} Meja</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!isKeywordValid}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all"
              >
                <span>Lanjut ke Verifikasi PIN</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={loading || !pinOrPassword.trim()}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all"
              >
                <Trash2 size={14} />
                <span>Konfirmasi & Eksekusi Reset</span>
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full text-center text-xs text-slate-400 py-1">
              Proses reset sedang berjalan, harap tunggu...
            </div>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={handleCloseAndFinish}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <span>Mulai Input Bahan Baku & Menu Baru</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetStandaloneModal;
