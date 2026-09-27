import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

interface VersionInfo {
  appName: string;
  appVersion: string;
  serverTimestamp: string;
  liveUpdateEnabled: boolean;
  latestBundleHash?: string;
  changelog?: string[];
}

export const InAppUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Check local stored version hash vs server version hash
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/app/version');
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        
        const localHash = localStorage.getItem('pos_installed_bundle_hash');
        if (!localHash) {
          // First run: save current hash
          if (data.latestBundleHash) {
            localStorage.setItem('pos_installed_bundle_hash', data.latestBundleHash);
          }
        } else if (data.latestBundleHash && data.latestBundleHash !== localHash) {
          // Hash differs: Web update was deployed to the server!
          setVersionInfo(data);
          setUpdateAvailable(true);
        }
      } catch (err) {
        // Silently skip if offline
      }
    };

    checkVersion();
    // Re-check periodically every 15 minutes
    const interval = setInterval(checkVersion, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = () => {
    setRefreshing(true);
    if (versionInfo?.latestBundleHash) {
      localStorage.setItem('pos_installed_bundle_hash', versionInfo.latestBundleHash);
    }
    // Hard reload cache
    window.location.reload();
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-[92%] sm:w-auto animate-bounce-in">
      <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-4 shadow-2xl shadow-indigo-950/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
            <Sparkles size={20} className="text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide text-white uppercase">
                Fitur Baru Siap Dipakai
              </span>
              <span className="text-[10px] font-bold bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30">
                v{versionInfo?.appVersion || 'Terbaru'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Pembaruan sistem otomatis dari web cloud. APK tidak perlu di-download ulang.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleApplyUpdate}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Memuat...' : 'Terapkan'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Tutup pemberitahuan"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InAppUpdateBanner;
