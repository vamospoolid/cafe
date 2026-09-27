import React, { useState, useEffect, useContext } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, RefreshCw, Coffee, UtensilsCrossed, 
  Cake, CheckCircle2, Lock, KeyRound, Download, Trash2, Layers, Sparkles, 
  ArrowRight, ShieldCheck, HelpCircle, Check, UploadCloud, FileText, Undo2
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface TenantResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TemplateOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: string;
  categoriesCount: number;
  ingredientsCount: number;
  productsCount: number;
  tablesCount: number;
}

interface RestoreSummary {
  isValid: boolean;
  storeName: string;
  sourceTenantId?: string | null;
  isCrossTenant?: boolean;
  isTargetPaid?: boolean;
  crossTenantWarning?: string | null;
  exportedAt: string | null;
  schemaVersion: string;
  platform: string;
  counts: {
    categories: number;
    products: number;
    ingredients: number;
    recipeItems: number;
    tables: number;
    suppliers: number;
    orders: number;
    customers: number;
  };
}

export const TenantResetModal: React.FC<TenantResetModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const posContext = useContext(POSContext);
  const [activeTab, setActiveTab] = useState<'template' | 'transactions' | 'factory' | 'restore'>('template');
  
  // Templates state
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('COFFEE_SHOP');
  const [wipeExistingBeforeTemplate, setWipeExistingBeforeTemplate] = useState(false);
  const [templatePassword, setTemplatePassword] = useState('');
  
  // Transactions Reset State
  const [txConfirmation, setTxConfirmation] = useState('');
  const [txPassword, setTxPassword] = useState('');
  const [txCountdown, setTxCountdown] = useState<number | null>(null);
  
  // Factory Reset State
  const [factoryConfirmation, setFactoryConfirmation] = useState('');
  const [factoryPassword, setFactoryPassword] = useState('');
  const [factoryCountdown, setFactoryCountdown] = useState<number | null>(null);

  // Restore State
  const [restorePayload, setRestorePayload] = useState<any>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);
  const [restoreMode, setRestoreMode] = useState<'FULL_OVERWRITE' | 'CATALOG_ONLY'>('FULL_OVERWRITE');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreCountdown, setRestoreCountdown] = useState<number | null>(null);
  const [inspectingFile, setInspectingFile] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  // Fetch available templates on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/tenant-reset/templates', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTemplates(data);
        })
        .catch(err => console.error('Failed to load templates:', err));
    } else {
      // Reset form states
      setTxConfirmation('');
      setTxPassword('');
      setTxCountdown(null);
      setFactoryConfirmation('');
      setFactoryPassword('');
      setFactoryCountdown(null);
      setTemplatePassword('');
      setWipeExistingBeforeTemplate(false);
      setRestorePayload(null);
      setRestoreFileName('');
      setRestoreSummary(null);
      setRestorePassword('');
      setRestoreCountdown(null);
    }
  }, [isOpen, posContext?.token]);

  // Handle Backup Download
  const handleDownloadBackup = async () => {
    try {
      setDownloadingBackup(true);
      const res = await fetch('/api/database/backup', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (!res.ok) throw new Error('Gagal mengunduh backup');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${posContext?.settings?.storeName || 'tenant'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('Berkas snapshot backup berhasil diunduh ke perangkat Anda!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal membuat backup', 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  // Handle File Selection for Restore
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    setInspectingFile(true);
    setRestoreSummary(null);
    setRestorePayload(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setRestorePayload(json);

      // Call inspect API
      const res = await fetch('/api/tenant-reset/restore/inspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ backupPayload: json })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Berkas cadangan tidak valid');

      setRestoreSummary(resData.summary);
      toast(`Berkas "${file.name}" berhasil divalidasi!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Format berkas JSON tidak valid', 'error');
      setRestoreFileName('');
      setRestorePayload(null);
      setRestoreSummary(null);
    } finally {
      setInspectingFile(false);
    }
  };

  // 1. Submit Apply Template
  const handleApplyTemplate = async () => {
    if (wipeExistingBeforeTemplate && !templatePassword) {
      toast('Kata sandi wajib diisi jika mengosongkan katalog lama', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/tenant-reset/apply-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
          wipeExistingFirst: wipeExistingBeforeTemplate,
          password: templatePassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menerapkan template');

      toast(data.message || 'Template berhasil diterapkan!', 'success');
      onSuccess?.();
      onClose();
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Transaction Reset with 3s countdown safety
  const startTransactionReset = () => {
    if (txConfirmation.trim() !== 'RESET-TRANSAKSI') {
      toast('Ketik "RESET-TRANSAKSI" dengan huruf kapital untuk konfirmasi', 'error');
      return;
    }
    if (!txPassword) {
      toast('Kata sandi / PIN otorisasi wajib diisi', 'error');
      return;
    }

    setTxCountdown(3);
  };

  useEffect(() => {
    if (txCountdown === null) return;
    if (txCountdown > 0) {
      const timer = setTimeout(() => setTxCountdown(txCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (txCountdown === 0) {
      executeTransactionReset();
    }
  }, [txCountdown]);

  const executeTransactionReset = async () => {
    setTxCountdown(null);
    try {
      setLoading(true);
      const res = await fetch('/api/tenant-reset/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          confirmation: txConfirmation.trim(),
          password: txPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mereset transaksi');

      toast(data.message || 'Transaksi simulasi berhasil dibersihkan!', 'success');
      onSuccess?.();
      onClose();
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Factory Reset with 3s countdown safety
  const startFactoryReset = () => {
    if (factoryConfirmation.trim() !== 'RESET-TOTAL') {
      toast('Ketik "RESET-TOTAL" dengan huruf kapital untuk konfirmasi', 'error');
      return;
    }
    if (!factoryPassword) {
      toast('Kata sandi akun Owner wajib diisi untuk Factory Reset', 'error');
      return;
    }

    setFactoryCountdown(3);
  };

  useEffect(() => {
    if (factoryCountdown === null) return;
    if (factoryCountdown > 0) {
      const timer = setTimeout(() => setFactoryCountdown(factoryCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (factoryCountdown === 0) {
      executeFactoryReset();
    }
  }, [factoryCountdown]);

  const executeFactoryReset = async () => {
    setFactoryCountdown(null);
    try {
      setLoading(true);
      const res = await fetch('/api/tenant-reset/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          confirmation: factoryConfirmation.trim(),
          password: factoryPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal melakukan Factory Reset');

      toast(data.message || 'Factory Reset berhasil! Ruang kerja bersih 100%.', 'success');
      onSuccess?.();
      onClose();
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 4. Submit Restore with 3s countdown safety
  const startRestore = () => {
    if (!restorePayload) {
      toast('Pilih berkas cadangan .json terlebih dahulu', 'error');
      return;
    }
    if (!restorePassword) {
      toast('Kata sandi akun Owner wajib diisi untuk memulihkan data', 'error');
      return;
    }

    setRestoreCountdown(3);
  };

  useEffect(() => {
    if (restoreCountdown === null) return;
    if (restoreCountdown > 0) {
      const timer = setTimeout(() => setRestoreCountdown(restoreCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (restoreCountdown === 0) {
      executeRestore();
    }
  }, [restoreCountdown]);

  const executeRestore = async () => {
    setRestoreCountdown(null);
    try {
      setLoading(true);
      const res = await fetch('/api/tenant-reset/restore/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          backupPayload: restorePayload,
          mode: restoreMode,
          password: restorePassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulihkan data');

      toast(data.message || 'Pemulihan data cadangan berhasil!', 'success');
      onSuccess?.();
      onClose();
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white tracking-tight">Pusat Reset, Template &amp; Pemulihan</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {posContext?.settings?.storeName || 'Tenant Aktif'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kelola template bisnis, pemulihan cadangan data, atau reset dengan proteksi sandi ganda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'template'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Preset Template Awal
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'restore'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-500" />
            Pulihkan dari Backup
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Reset Transaksi
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('factory')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'factory'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            Factory Reset
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* TAB 1: PRESET TEMPLATES */}
          {activeTab === 'template' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Mulai Cepat dengan Standar Industri:</span>
                  Pilih salah satu template di bawah untuk otomatis membuat kategori, stok bahan baku, komposisi resep HPP, dan contoh menu sesuai jenis bisnis Anda.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {templates.map(tmpl => {
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/50 shadow-md shadow-indigo-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`p-2.5 rounded-xl ${
                            tmpl.id === 'COFFEE_SHOP' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                            tmpl.id === 'RESTAURANT_FNB' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                            'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300'
                          }`}>
                            {tmpl.id === 'COFFEE_SHOP' ? <Coffee className="w-5 h-5" /> :
                             tmpl.id === 'RESTAURANT_FNB' ? <UtensilsCrossed className="w-5 h-5" /> :
                             <Cake className="w-5 h-5" />}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {tmpl.badge}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{tmpl.name}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed mb-3">
                          {tmpl.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        <span>{tmpl.productsCount} Menu</span>
                        <span>•</span>
                        <span>{tmpl.ingredientsCount} Bahan</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Options */}
              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wipeExistingBeforeTemplate}
                    onChange={(e) => setWipeExistingBeforeTemplate(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      Kosongkan menu & bahan baku lama sebelum menerapkan template baru
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Jika tidak dicentang, produk dan bahan baku dari template akan ditambahkan ke daftar katalog yang sudah ada.
                    </span>
                  </div>
                </label>

                {wipeExistingBeforeTemplate && (
                  <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-200 block">
                      Kata Sandi Akun Owner (Diperlukan untuk konfirmasi penghapusan):
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan kata sandi akun Anda"
                      value={templatePassword}
                      onChange={(e) => setTemplatePassword(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyTemplate}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Terapkan Template Ini ke Toko Saya
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE FROM BACKUP */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 flex items-start gap-3">
                <UploadCloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Pemulihan Data Cadangan (Restore Disaster Recovery):</span>
                  Unggah berkas snapshot <code>.json</code> yang telah diunduh sebelumnya untuk mengembalikan menu, bahan baku, resep, dan transaksi secara utuh dengan sinkronisasi relasi ID otomatis.
                </div>
              </div>

              {/* File Upload Dropzone */}
              <div>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-5 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-emerald-50/20 transition-all cursor-pointer text-center group">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    {inspectingFile ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <span className="font-bold text-xs text-slate-800 dark:text-white">
                    {restoreFileName ? `Terpilih: ${restoreFileName}` : 'Klik untuk Pilih atau Tarik Berkas Cadangan (.json)'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Mendukung berkas JSON snapshot resmi Codenusa POS
                  </span>
                </label>
              </div>

              {/* Snapshot Inspector Card */}
              {restoreSummary && (
                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/60 pb-2">
                    <div>
                      <h5 className="font-bold text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Pratinjau Berkas Cadangan ({restoreSummary.storeName})
                      </h5>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Waktu Backup: {restoreSummary.exportedAt ? new Date(restoreSummary.exportedAt).toLocaleString('id-ID') : 'Tidak diketahui'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                      v{restoreSummary.schemaVersion}
                    </span>
                  </div>

                  {restoreSummary.crossTenantWarning && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-0.5">Pemulihan Lintas-Tenant Terdeteksi:</span>
                        {restoreSummary.crossTenantWarning}
                      </div>
                    </div>
                  )}

                  {/* Badges Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">Produk</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-white">{restoreSummary.counts.products}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">Bahan Baku</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-white">{restoreSummary.counts.ingredients}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">Kategori</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-white">{restoreSummary.counts.categories}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block font-semibold">Pesanan</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-white">{restoreSummary.counts.orders}</strong>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="pt-2 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Pilih Strategi Pemulihan:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                        restoreMode === 'FULL_OVERWRITE' 
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'FULL_OVERWRITE'}
                          onChange={() => setRestoreMode('FULL_OVERWRITE')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold block">Ganti Total (Full Overwrite)</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Kembalikan 100% kondisi katalog & riwayat pesanan seperti saat backup dibuat.
                          </span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                        restoreMode === 'CATALOG_ONLY' 
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'CATALOG_ONLY'}
                          onChange={() => setRestoreMode('CATALOG_ONLY')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="font-bold block">Katalog & Bahan Saja</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Hanya pulihkan menu & bahan tanpa menghapus transaksi baru yang sedang berjalan.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Password Authorization */}
                  <div className="pt-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Kata Sandi Akun Owner (Konfirmasi Keamanan):
                    </label>
                    <input
                      type="password"
                      placeholder="Masukkan kata sandi akun Owner"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Restore Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={loading || !restorePayload || !restorePassword || restoreCountdown !== null || Boolean(restoreSummary?.isCrossTenant && !restoreSummary?.isTargetPaid && !posContext?.user?.isPlatformAdmin)}
                      onClick={startRestore}
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-40"
                    >
                      {restoreCountdown !== null ? (
                        <span className="animate-pulse font-bold text-sm">
                          Mengeksekusi Pemulihan dalam {restoreCountdown} detik... (Klik Batal)
                        </span>
                      ) : loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          Pulihkan Data Sekarang (Auto-Protected)
                        </>
                      )}
                    </button>

                    {restoreCountdown !== null && (
                      <button
                        type="button"
                        onClick={() => setRestoreCountdown(null)}
                        className="w-full mt-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      >
                        Batalkan Pemulihan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESET TRANSACTIONS ONLY */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Pembersihan Riwayat Transaksi Uji Coba (Pre-Launch):</span>
                  Fitur ini digunakan setelah kasir/staf selesai melakukan simulasi penjualan sebelum toko resmi buka (Grand Opening).
                </div>
              </div>

              {/* What is deleted vs kept */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 space-y-1.5">
                  <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Akan Dihapus Bersih:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    <li>Semua Riwayat Pesanan (Orders)</li>
                    <li>Arus Kas Kasir (Cashflow)</li>
                    <li>Sesi Buka/Tutup Kasir (Shifts)</li>
                    <li>Log Absensi Simulasi (Attendance)</li>
                    <li>Riwayat Reservasi Uji Coba</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-1.5">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dijamin Tetap AMAN:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    <li>Daftar Menu Produk & Harga</li>
                    <li>Resep & Komposisi HPP</li>
                    <li>Daftar Stok Bahan Baku</li>
                    <li>Kategori & Nomor Meja</li>
                    <li>Akun Kasir & Hak Akses</li>
                  </ul>
                </div>
              </div>

              {/* Security Confirmation */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    1. Ketik kata konfirmasi <span className="font-mono text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded font-bold">RESET-TRANSAKSI</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="RESET-TRANSAKSI"
                    value={txConfirmation}
                    onChange={(e) => setTxConfirmation(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    2. Kata Sandi Akun / PIN Master:
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan kata sandi akun Owner/Admin"
                    value={txPassword}
                    onChange={(e) => setTxPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={downloadingBackup}
                  className="py-3 px-4 rounded-xl font-medium text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {downloadingBackup ? 'Mengunduh...' : 'Unduh Backup Dahulu'}
                </button>

                <button
                  type="button"
                  disabled={loading || txConfirmation.trim() !== 'RESET-TRANSAKSI' || !txPassword || txCountdown !== null}
                  onClick={startTransactionReset}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 disabled:opacity-40"
                >
                  {txCountdown !== null ? (
                    <span className="animate-pulse font-bold text-sm">
                      Mengeksekusi dalam {txCountdown} detik... (Klik Batal)
                    </span>
                  ) : loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Bersihkan Riwayat Transaksi
                    </>
                  )}
                </button>
              </div>

              {txCountdown !== null && (
                <button
                  type="button"
                  onClick={() => setTxCountdown(null)}
                  className="w-full py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors"
                >
                  Batalkan Eksekusi
                </button>
              )}
            </div>
          )}

          {/* TAB 4: FULL FACTORY RESET */}
          {activeTab === 'factory' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-950 dark:text-rose-100 leading-relaxed">
                  <span className="font-bold text-sm block mb-1 text-rose-700 dark:text-rose-300">
                    PERINGATAN TINGGI: FACTORY RESET TOTAL
                  </span>
                  Tindakan ini akan <strong>MENGHAPUS PERMANEN SEMUA PRODUK, BAHAN BAKU, RESEP, KATEGORI, MEJA, DAN TRANSAKSI</strong> khusus untuk toko <strong>{posContext?.settings?.storeName || 'ini'}</strong>. Toko Anda akan kembali ke kondisi 0 (kosong 100%).
                </div>
              </div>

              {/* Security Parachute Banner */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Sangat disarankan mengunduh berkas cadangan data sebelum reset:</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={downloadingBackup}
                  className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingBackup ? 'Mengunduh...' : 'Unduh Backup JSON'}
                </button>
              </div>

              {/* Confirmation Inputs */}
              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    1. Ketik kata konfirmasi <span className="font-mono text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded font-bold">RESET-TOTAL</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="RESET-TOTAL"
                    value={factoryConfirmation}
                    onChange={(e) => setFactoryConfirmation(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    2. Kata Sandi Akun Owner:
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan kata sandi akun Owner untuk konfirmasi"
                    value={factoryPassword}
                    onChange={(e) => setFactoryPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Execute Factory Reset Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={loading || factoryConfirmation.trim() !== 'RESET-TOTAL' || !factoryPassword || factoryCountdown !== null}
                  onClick={startFactoryReset}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-40"
                >
                  {factoryCountdown !== null ? (
                    <span className="animate-pulse font-bold text-sm">
                      Mengeksekusi Factory Reset dalam {factoryCountdown} detik... (Klik Batal)
                    </span>
                  ) : loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Kosongkan Seluruh Data Toko (Factory Reset)
                    </>
                  )}
                </button>

                {factoryCountdown !== null && (
                  <button
                    type="button"
                    onClick={() => setFactoryCountdown(null)}
                    className="w-full mt-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Batalkan Factory Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Semua aksi dienkripsi & dicatat ke sistem Immutable Audit Trail.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-slate-700 dark:text-slate-300 hover:underline"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

export default TenantResetModal;
