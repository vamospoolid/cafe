import { useState, useEffect, useContext } from 'react';
import { X, RefreshCw, Download, CloudUpload, CheckCircle, XCircle, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { offlineDb, type PendingOrder, type SyncLog } from '../db/offlineDb';
import { syncEngine } from '../services/syncEngine';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface Props {
  onClose: () => void;
}

export default function OfflineSyncPanel({ onClose }: Props) {
  const { isOnline, isSyncing, pendingOrdersCount, triggerSync } = useNetworkStatus();
  const posContext = useContext(POSContext);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [orders, logs] = await Promise.all([
        offlineDb.pendingOrders.orderBy('id').reverse().limit(50).toArray(),
        offlineDb.getRecentSyncLogs(10),
      ]);
      setPendingOrders(orders);
      setSyncLogs(logs);
    } catch (err) {
      console.error('[OfflineSyncPanel] Failed to load data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      toast('Tidak ada koneksi internet untuk sinkronisasi', 'error');
      return;
    }
    setLoading(true);
    try {
      await triggerSync();
      if (posContext?.syncOfflineOrders) await posContext.syncOfflineOrders();
      await loadData();
      toast('Sinkronisasi selesai', 'success');
    } catch (err: any) {
      toast(err.message || 'Sinkronisasi gagal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const allPending = await offlineDb.pendingOrders.toArray();
      const blob = new Blob([JSON.stringify(allPending, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offline-queue-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup antrian offline berhasil diunduh', 'success');
    } catch (err: any) {
      toast('Gagal mengunduh backup: ' + err.message, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="offline-badge badge-pending"><Clock size={11} /> Menunggu</span>;
      case 'SYNCING':
        return <span className="offline-badge badge-syncing"><RefreshCw size={11} className="spin-anim" /> Sync...</span>;
      case 'SYNCED':
        return <span className="offline-badge badge-synced"><CheckCircle size={11} /> Tersinkron</span>;
      case 'FAILED':
        return <span className="offline-badge badge-failed"><XCircle size={11} /> Gagal</span>;
      default:
        return <span className="offline-badge">{status}</span>;
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const fmtDate = (s: string) => new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });

  const pendingUnsyncedCount = pendingOrders.filter(o => ['PENDING', 'FAILED', 'SYNCING'].includes(o.syncStatus)).length;
  const syncedTodayCount = pendingOrders.filter(o => o.syncStatus === 'SYNCED').length;

  return (
    <div className="offline-panel-overlay" onClick={onClose}>
      <div className="offline-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="offline-panel-header">
          <div className="offline-panel-title">
            {isOnline
              ? <><Wifi size={17} className="text-green-400" />&nbsp;Monitor Sinkronisasi Offline</>
              : <><WifiOff size={17} className="text-red-400" />&nbsp;Mode Offline Aktif</>}
          </div>
          <button className="offline-panel-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        {/* Stats */}
        <div className="offline-stat-grid">
          <div className="offline-stat-card stat-pending">
            <div className="stat-value">{pendingUnsyncedCount}</div>
            <div className="stat-label">Mengantre</div>
          </div>
          <div className="offline-stat-card stat-synced">
            <div className="stat-value">{syncedTodayCount}</div>
            <div className="stat-label">Tersinkron</div>
          </div>
          <div className="offline-stat-card stat-total">
            <div className="stat-value">{pendingOrders.length}</div>
            <div className="stat-label">Total Lokal</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="offline-panel-actions">
          <button
            className="offline-action-btn btn-sync"
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing || loading}
          >
            {(isSyncing || loading)
              ? <><RefreshCw size={14} className="spin-anim" /> Menyinkronkan...</>
              : <><CloudUpload size={14} /> Sync Sekarang</>}
          </button>
          <button
            className="offline-action-btn btn-export"
            onClick={handleExportBackup}
          >
            <Download size={14} /> Unduh Backup (.json)
          </button>
        </div>

        {/* Pending Orders List */}
        <div className="offline-section">
          <div className="offline-section-title">
            <AlertTriangle size={13} /> Antrian Transaksi Lokal
          </div>
          {pendingOrders.length === 0 ? (
            <div className="offline-empty-state">
              <CheckCircle size={32} className="text-green-400" />
              <p>Semua transaksi sudah tersinkron ✅</p>
            </div>
          ) : (
            <div className="offline-orders-list">
              {pendingOrders.map((order) => (
                <div key={order.id} className={`offline-order-item status-${order.syncStatus.toLowerCase()}`}>
                  <div className="order-item-top">
                    <span className="order-number">{order.orderNumber}</span>
                    {getStatusBadge(order.syncStatus)}
                  </div>
                  <div className="order-item-mid">
                    <span className="order-customer">{order.customerName}</span>
                    <span className="order-total">{fmt(order.total)}</span>
                  </div>
                  <div className="order-item-bottom">
                    <span className="order-time">{fmtDate(order.clientTimestamp)}</span>
                    <span className="order-items-count">{order.items.length} item</span>
                    {order.syncError && (
                      <span className="order-error" title={order.syncError}>⚠ {order.syncError.slice(0, 40)}...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync Log */}
        {syncLogs.length > 0 && (
          <div className="offline-section">
            <div className="offline-section-title">
              <RefreshCw size={13} /> Riwayat Sinkronisasi
            </div>
            <div className="sync-logs-list">
              {syncLogs.map((log, i) => (
                <div key={i} className={`sync-log-item log-${log.status.toLowerCase()}`}>
                  <span className="log-icon">{log.status === 'SUCCESS' ? '✅' : '❌'}</span>
                  <span className="log-detail">{log.details || `${log.type} — ${log.count} item`}</span>
                  <span className="log-time">{fmtDate(log.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
