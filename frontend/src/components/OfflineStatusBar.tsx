import { useState, useContext } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, CloudUpload, ChevronRight } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { POSContext } from '../context/POSContext';
import OfflineSyncPanel from './OfflineSyncPanel';

export default function OfflineStatusBar() {
  const { isOnline, isSyncing, isChecking, totalPendingCount, pendingOrdersCount, triggerSync } = useNetworkStatus();
  const posContext = useContext(POSContext);
  const [showPanel, setShowPanel] = useState(false);

  // When fully online and nothing pending, hide entirely
  if (isOnline && !isSyncing && totalPendingCount === 0 && !isChecking) {
    return null;
  }

  const handleSyncClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await triggerSync();
    if (posContext?.syncOfflineOrders) {
      await posContext.syncOfflineOrders();
    }
  };

  if (!isOnline) {
    return (
      <>
        <div
          className="w-full bg-rose-600 text-white px-3 sm:px-4 py-2 flex items-center justify-between shadow-sm cursor-pointer select-none transition-all hover:bg-rose-700 shrink-0"
          onClick={() => setShowPanel(true)}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
            <WifiOff size={16} className="shrink-0" />
            <span className="truncate">
              <strong>Mode Offline Aktif</strong>
              {pendingOrdersCount > 0 ? ` — ${pendingOrdersCount} transaksi tersimpan di memori perangkat` : ' — Transaksi tetap dapat diproses'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg shrink-0">
            <span>Lihat Antrean</span>
            <ChevronRight size={13} />
          </div>
        </div>
        {showPanel && <OfflineSyncPanel onClose={() => setShowPanel(false)} />}
      </>
    );
  }

  if (isSyncing) {
    return (
      <div 
        className="w-full bg-blue-600 text-white px-3 sm:px-4 py-2 flex items-center justify-between shadow-sm select-none shrink-0" 
        role="status" 
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
          <RefreshCw size={15} className="animate-spin shrink-0" />
          <span>
            <strong>Menyinkronkan ke Cloud...</strong>
            {pendingOrdersCount > 0 && ` Mengunggah ${pendingOrdersCount} transaksi`}
          </span>
        </div>
        <span className="text-[10.5px] font-bold bg-white/20 px-2 py-0.5 rounded-lg">Harap Tunggu</span>
      </div>
    );
  }

  if (isOnline && totalPendingCount > 0) {
    return (
      <>
        <div
          className="w-full bg-amber-500 text-slate-950 px-3 sm:px-4 py-2 flex items-center justify-between shadow-sm cursor-pointer select-none hover:bg-amber-400 transition-all shrink-0"
          onClick={() => setShowPanel(true)}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold truncate">
            <AlertTriangle size={16} className="shrink-0 text-slate-900" />
            <span className="truncate">
              <strong>{totalPendingCount} transaksi belum tersinkron</strong> ke cloud SaaS
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="flex items-center gap-1 bg-slate-900 text-white hover:bg-black px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
              onClick={handleSyncClick}
              aria-label="Sinkronkan sekarang"
            >
              <CloudUpload size={13} />
              <span>Sync Sekarang</span>
            </button>
          </div>
        </div>
        {showPanel && <OfflineSyncPanel onClose={() => setShowPanel(false)} />}
      </>
    );
  }

  return null;
}
