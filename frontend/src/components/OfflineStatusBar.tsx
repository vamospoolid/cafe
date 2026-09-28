import { useState, useContext } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, CloudUpload, ChevronDown, ChevronUp } from 'lucide-react';
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
          className="offline-status-bar offline-bar-red"
          onClick={() => setShowPanel(true)}
          role="alert"
          aria-live="assertive"
        >
          <div className="offline-bar-inner">
            <div className="offline-bar-left">
              <span className="offline-pulse-dot pulse-red" />
              <WifiOff size={15} className="offline-bar-icon" />
              <span className="offline-bar-text">
                <strong>Mode Offline</strong>
                {pendingOrdersCount > 0 && (
                  <span className="offline-bar-count">
                    &nbsp;— {pendingOrdersCount} transaksi mengantre
                  </span>
                )}
                <span className="offline-bar-hint">&nbsp;· Klik untuk detail</span>
              </span>
            </div>
            <div className="offline-bar-right">
              {showPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>
        {showPanel && <OfflineSyncPanel onClose={() => setShowPanel(false)} />}
      </>
    );
  }

  if (isSyncing) {
    return (
      <div className="offline-status-bar offline-bar-yellow" role="status" aria-live="polite">
        <div className="offline-bar-inner">
          <div className="offline-bar-left">
            <RefreshCw size={14} className="offline-bar-icon spin-anim" />
            <span className="offline-bar-text">
              <strong>Menyinkronkan</strong>
              {pendingOrdersCount > 0 && (
                <span className="offline-bar-count">&nbsp;{pendingOrdersCount} transaksi ke server...</span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isOnline && totalPendingCount > 0) {
    return (
      <>
        <div
          className="offline-status-bar offline-bar-orange"
          onClick={() => setShowPanel(true)}
          role="alert"
          aria-live="polite"
        >
          <div className="offline-bar-inner">
            <div className="offline-bar-left">
              <AlertTriangle size={14} className="offline-bar-icon" />
              <span className="offline-bar-text">
                <strong>{totalPendingCount} transaksi belum tersinkron</strong>
                <span className="offline-bar-hint">&nbsp;· Klik untuk sinkron manual</span>
              </span>
            </div>
            <div className="offline-bar-right">
              <button
                className="offline-sync-btn"
                onClick={handleSyncClick}
                aria-label="Sinkronkan sekarang"
              >
                <CloudUpload size={13} />
                &nbsp;Sync
              </button>
            </div>
          </div>
        </div>
        {showPanel && <OfflineSyncPanel onClose={() => setShowPanel(false)} />}
      </>
    );
  }

  return null;
}
