import React, { useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineQueueModal } from './OfflineQueueModal';

interface NetworkStatusBannerProps {
  onManualSync?: () => Promise<void>;
  isSyncing?: boolean;
  compactOnly?: boolean;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  onManualSync,
  isSyncing: propIsSyncing,
  compactOnly = false,
}) => {
  const { isOnline, totalPendingCount, isSyncing: hookIsSyncing, triggerSync, checkConnectivity } = useNetworkStatus();
  const [showQueueModal, setShowQueueModal] = useState(false);
  const isSyncing = propIsSyncing ?? hookIsSyncing;

  const handleSyncClick = async () => {
    if (onManualSync) {
      await onManualSync();
    } else {
      await triggerSync();
    }
  };

  // Compact Pill (Used inside navbar or top header)
  const renderCompactPill = () => {
    if (isOnline) {
      return (
        <button
          onClick={() => totalPendingCount > 0 && setShowQueueModal(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            totalPendingCount > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
          }`}
          title={totalPendingCount > 0 ? `${totalPendingCount} data menunggu sinkronisasi` : 'Cloud terhubung'}
        >
          <span className={`w-2 h-2 rounded-full ${totalPendingCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
          {totalPendingCount > 0 ? (
            <span>Sync ({totalPendingCount})</span>
          ) : (
            <span className="hidden sm:inline">Online</span>
          )}
        </button>
      );
    }

    return (
      <button
        onClick={() => setShowQueueModal(true)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all animate-pulse"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span>Offline ({totalPendingCount})</span>
      </button>
    );
  };

  if (compactOnly) {
    return (
      <>
        {renderCompactPill()}
        <OfflineQueueModal
          isOpen={showQueueModal}
          onClose={() => setShowQueueModal(false)}
          onTriggerSync={handleSyncClick}
          isSyncing={isSyncing}
        />
      </>
    );
  }

  return (
    <>
      {/* Full Alert Banner shown when completely OFFLINE or has pending items */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white px-4 py-2 text-xs font-medium flex items-center justify-between border-b border-amber-500/60 shadow-md z-40">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-900/40 text-base flex-shrink-0">⚡</span>
            <div className="leading-snug">
              <span className="font-bold">Mode Offline Aktif:</span>
              {' '}Perangkat tidak terhubung ke internet. Anda tetap bisa melayani transaksi kasir & presensi.
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={() => setShowQueueModal(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-white border border-white/20 text-[11px] font-bold transition-all"
            >
              📦 Antrean ({totalPendingCount})
            </button>
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-all border border-white/25 disabled:opacity-60"
            >
              {isSyncing ? '🔄 Mencoba...' : '⚡ Cek Koneksi'}
            </button>
          </div>
        </div>
      )}


      <OfflineQueueModal
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        onTriggerSync={handleSyncClick}
        isSyncing={isSyncing}
      />
    </>
  );
};
