import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Monitor, 
  QrCode, 
  Copy, 
  ExternalLink, 
  Download, 
  Check, 
  Share2, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Info, 
  ArrowUpRight 
} from 'lucide-react';
import { 
  canInstallPwa, 
  isPwaStandalone, 
  promptInstallPwa, 
  onInstallPromptChange, 
  getTenantPwaUrls 
} from '../utils/pwaManager';
import { toast } from '../utils/alert';

interface TenantPWASectionProps {
  tenantSlug?: string;
  storeName?: string;
  customDomain?: string;
  businessType?: string;
}

export const TenantPWASection: React.FC<TenantPWASectionProps> = ({
  tenantSlug,
  storeName = 'Toko Anda',
  customDomain,
  businessType = 'CAFE',
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [installAvailable, setInstallAvailable] = useState<boolean>(canInstallPwa());
  const [isStandalone, setIsStandalone] = useState<boolean>(isPwaStandalone());
  const [activeQrModal, setActiveQrModal] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    setIsStandalone(isPwaStandalone());
    const unsubscribe = onInstallPromptChange((canInstall) => {
      setInstallAvailable(canInstall);
    });
    return unsubscribe;
  }, []);

  const urls = getTenantPwaUrls(tenantSlug, customDomain);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast('Tautan berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      toast('Gagal menyalin link.', 'error');
    }
  };

  const handleInstallClick = async () => {
    const outcome = await promptInstallPwa();
    if (outcome === 'accepted') {
      toast('Aplikasi PWA berhasil diinstal ke perangkat!', 'success');
    } else if (outcome === 'dismissed') {
      toast('Instalasi dibatalkan.', 'info');
    } else {
      toast('Gunakan menu titik tiga browser lalu pilih "Tambahkan ke Layar Utama".', 'info');
    }
  };

  const getQrImageUrl = (url: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(url)}`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-linear-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Auto-Created Per Tenant
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Zero Spaghetti Code
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Smartphone className="text-indigo-400" size={26} />
              Ekosistem PWA Mandiri &amp; Link Otomatis
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              Setiap tenant memiliki tautan web app mandiri dan Progressive Web App (PWA) berorientasi dinamis. Kasir di tablet landscape, staf di smartphone portrait, dan menu pelanggan langsung aktif seketika.
            </p>
          </div>

          {/* Quick Install Action / Standalone Status */}
          <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
            {isStandalone ? (
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-inner">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>Mode PWA Terpasang (Standalone)</span>
              </div>
            ) : installAvailable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/30 cursor-pointer active:scale-95 transition-all"
              >
                <Download size={16} />
                <span>Pasang PWA ke Perangkat Ini</span>
              </button>
            ) : (
              <div className="px-3.5 py-2 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-2">
                <Info size={14} className="text-slate-400" />
                <span>Buka via Chrome/Safari untuk 1-Klik Install</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 Auto-Created Independent Links & APKs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: Mobile Admin & Owner Back-Office */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-300 transition-colors">
          <div>
            <div className="flex items-start justify-between">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                HP Admin &amp; Owner
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <ShieldCheck size={18} />
              </div>
            </div>
            <h3 className="font-black text-slate-900 text-base mt-3">Mobile Admin &amp; Owner</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Monitoring omzet real-time, grafik laba, approval tugas, dan manajemen toko langsung dari HP Android.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-600 truncate">{urls.dashboardUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(urls.dashboardUrl, 'admin')}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0 transition-colors"
                title="Salin Link"
              >
                {copiedKey === 'admin' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={urls.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all text-center"
              >
                <ArrowUpRight size={14} />
                <span>Buka Admin</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveQrModal({ title: `${storeName} — Admin Back-Office`, url: urls.dashboardUrl })}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Tampilkan QR Code"
              >
                <QrCode size={14} />
                <span>QR</span>
              </button>
            </div>

            <div className="pt-1">
              <a
                href="/downloads/admin.apk"
                download={`${tenantSlug || 'mukiramen'}-admin.apk`}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-amber-700 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download size={13} />
                <span>Unduh APK Admin (.apk)</span>
              </a>
            </div>
          </div>
        </div>

        {/* CARD 2: Kasir & Tablet POS */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-colors">
          <div>
            <div className="flex items-start justify-between">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Kasir &amp; Tablet POS
              </span>
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Monitor size={18} />
              </div>
            </div>
            <h3 className="font-black text-slate-900 text-base mt-3">Aplikasi Kasir Tablet</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Dioptimalkan untuk tablet &amp; desktop landscape. Dukung printer Bluetooth/USB thermal, KDS, &amp; offline sync.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-600 truncate">{urls.cashierUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(urls.cashierUrl, 'cashier')}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0 transition-colors"
                title="Salin Link"
              >
                {copiedKey === 'cashier' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={urls.cashierUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all text-center"
              >
                <ArrowUpRight size={14} />
                <span>Buka Kasir</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveQrModal({ title: `${storeName} — Kasir POS`, url: urls.cashierUrl })}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Tampilkan QR Code"
              >
                <QrCode size={14} />
                <span>QR</span>
              </button>
            </div>

            <div className="pt-1">
              <a
                href="/downloads/pos.apk"
                download={`${tenantSlug || 'mukiramen'}-pos-tablet.apk`}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download size={13} />
                <span>Unduh APK Tablet Kasir (.apk)</span>
              </a>
            </div>
          </div>
        </div>

        {/* CARD 2: Apps Staf & Absensi */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-colors">
          <div>
            <div className="flex items-start justify-between">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                HP Staf &amp; Absensi
              </span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Smartphone size={18} />
              </div>
            </div>
            <h3 className="font-black text-slate-900 text-base mt-3">Portal Staf Mobile</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Dioptimalkan untuk HP portrait. Presensi selfie GPS geofencing, checklist shift kerja, izin/cuti &amp; slip gaji.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-600 truncate">{urls.staffUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(urls.staffUrl, 'staff')}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0 transition-colors"
                title="Salin Link"
              >
                {copiedKey === 'staff' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={urls.staffUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all text-center"
              >
                <ArrowUpRight size={14} />
                <span>Buka Staf</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveQrModal({ title: `${storeName} — Portal Staf & Absensi`, url: urls.staffUrl })}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Tampilkan QR Code"
              >
                <QrCode size={14} />
                <span>QR</span>
              </button>
            </div>

            <div className="pt-1">
              <a
                href="/downloads/staff.apk"
                download={`${tenantSlug || 'mukiramen'}-staff.apk`}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-emerald-700 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download size={13} />
                <span>Unduh APK Portal Staf (.apk)</span>
              </a>
            </div>
          </div>
        </div>

        {/* CARD 3: E-Menu Digital Pelanggan */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-300 transition-colors">
          <div>
            <div className="flex items-start justify-between">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                Pelanggan &amp; Meja
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <QrCode size={18} />
              </div>
            </div>
            <h3 className="font-black text-slate-900 text-base mt-3">E-Menu &amp; Self-Order</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Menu digital interaktif untuk discan dari meja kafe / ruang tunggu. Pelanggan bisa order &amp; bayar QRIS langsung.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-600 truncate">{urls.menuUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(urls.menuUrl, 'menu')}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0 transition-colors"
                title="Salin Link"
              >
                {copiedKey === 'menu' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={urls.menuUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all text-center"
              >
                <ArrowUpRight size={14} />
                <span>Buka Menu</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveQrModal({ title: `${storeName} — E-Menu Meja`, url: urls.menuUrl })}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Tampilkan QR Code"
              >
                <QrCode size={14} />
                <span>QR</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive QR Code Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4">
            <h4 className="font-black text-slate-900 text-base">{activeQrModal.title}</h4>
            <p className="text-xs text-slate-500">Scan QR Code ini menggunakan kamera tablet atau smartphone:</p>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <img
                src={getQrImageUrl(activeQrModal.url)}
                alt="QR Code"
                className="w-48 h-48 mx-auto rounded-xl object-contain bg-white p-2"
              />
            </div>

            <p className="text-[11px] font-mono text-slate-600 break-all px-2">{activeQrModal.url}</p>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={getQrImageUrl(activeQrModal.url)}
                download={`QR-${activeQrModal.title.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <Download size={14} />
                <span>Download QR</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveQrModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer active:scale-95 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Best Practices & Guide */}
      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200/80 space-y-3">
        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
          <Sparkles size={15} className="text-indigo-600" />
          Keunggulan Arsitektur PWA Multi-Tenant CodePOS
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/60 space-y-1">
            <span className="font-bold text-slate-900 block">1. Sandbox Origin Terisolasi</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Setiap tenant beroperasi pada origin terpisah sehingga IndexedDB cache offline dan token kasir tidak saling bocor.
            </p>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-slate-200/60 space-y-1">
            <span className="font-bold text-slate-900 block">2. Dual Dynamic Manifest</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Manifest otomatis beralih portrait untuk HP staf dan landscape untuk tablet kasir dengan logo &amp; nama toko dinamis.
            </p>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-slate-200/60 space-y-1">
            <span className="font-bold text-slate-900 block">3. Tanpa Perlu Re-compile</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Link aktif seketika saat tenant didaftarkan. Tidak membutuhkan pipeline build APK terpisah untuk pemakaian instan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantPWASection;
