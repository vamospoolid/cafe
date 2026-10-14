import { useState, useEffect, useContext } from 'react';
import { 
  X, 
  RefreshCw, 
  Download, 
  CloudUpload, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Wifi, 
  WifiOff,
  Database,
  HardDrive,
  Laptop,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { offlineDb, type PendingOrder, type SyncLog } from '../db/offlineDb';
import { syncEngine } from '../services/syncEngine';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { POSContext } from '../context/POSContext';
import { seedLocalCatalogCache } from '../utils/catalogCacheSeeder';
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
  const [caching, setCaching] = useState(false);

  // Local IndexedDB Stats
  const [cachedProductsCount, setCachedProductsCount] = useState<number>(0);
  const [cachedCategoriesCount, setCachedCategoriesCount] = useState<number>(0);
  const [cachedTablesCount, setCachedTablesCount] = useState<number>(0);

  const loadData = async () => {
    try {
      const activeTenantId = posContext?.user?.tenantId;
      const [orders, logs, prodCount, catCount, tableCount] = await Promise.all([
        offlineDb.pendingOrders.orderBy('id').reverse().limit(50).toArray(),
        offlineDb.getRecentSyncLogs(10),
        offlineDb.cachedProducts.where('tenantId').equals(activeTenantId || '').count().catch(() => offlineDb.cachedProducts.count()),
        offlineDb.cachedCategories.where('tenantId').equals(activeTenantId || '').count().catch(() => offlineDb.cachedCategories.count()),
        offlineDb.cachedTables.where('tenantId').equals(activeTenantId || '').count().catch(() => offlineDb.cachedTables.count()),
      ]);
      setPendingOrders(orders);
      setSyncLogs(logs);
      setCachedProductsCount(prodCount);
      setCachedCategoriesCount(catCount);
      setCachedTablesCount(tableCount);
    } catch (err) {
      console.error('[OfflineSyncPanel] Failed to load data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [posContext?.user?.tenantId]);

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

  const handleRefreshCache = async () => {
    if (!posContext?.token) {
      toast('Token autentikasi tidak tersedia', 'error');
      return;
    }
    if (!isOnline) {
      toast('Perlu koneksi internet untuk memperbarui cache katalog dari server', 'error');
      return;
    }
    setCaching(true);
    try {
      await seedLocalCatalogCache(posContext.token);
      await loadData();
      toast('Katalog & master data offline berhasil diperbarui di memori browser!', 'success');
    } catch (err: any) {
      toast('Gagal mengunduh katalog: ' + (err.message || 'Koneksi error'), 'error');
    } finally {
      setCaching(false);
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
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={10} /> Menunggu
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <RefreshCw size={10} className="animate-spin" /> Sinkron...
          </span>
        );
      case 'SYNCED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle size={10} /> Tersinkron
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle size={10} /> Gagal
          </span>
        );
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const fmtDate = (s: string) => new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });

  const pendingUnsyncedCount = pendingOrders.filter(o => ['PENDING', 'FAILED', 'SYNCING'].includes(o.syncStatus)).length;
  const syncedTodayCount = pendingOrders.filter(o => o.syncStatus === 'SYNCED').length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
              isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                Pusat Mode Offline & Sinkronisasi
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isOnline ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                }`}>
                  {isOnline ? '🌐 Online (Cloud)' : '⚠️ Offline (Lokal)'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Penyimpanan lokal IndexedDB aman &amp; pemulihan transaksi otomatis
              </p>
            </div>
          </div>
          <button 
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer" 
            onClick={onClose} 
            aria-label="Tutup"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider">Antrean Belum Sync</span>
              <span className="text-2xl font-black text-amber-900 leading-tight mt-1">{pendingUnsyncedCount}</span>
              <span className="text-[10px] text-amber-600 font-medium">Transaksi di tablet</span>
            </div>
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider">Tersinkron Sesi Ini</span>
              <span className="text-2xl font-black text-emerald-900 leading-tight mt-1">{syncedTodayCount}</span>
              <span className="text-[10px] text-emerald-600 font-medium">Sukses ke cloud</span>
            </div>
            <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-indigo-700 uppercase tracking-wider">Katalog di Cache</span>
              <span className="text-2xl font-black text-indigo-900 leading-tight mt-1">{cachedProductsCount}</span>
              <span className="text-[10px] text-indigo-600 font-medium">Produk tersimpan</span>
            </div>
          </div>

          {/* Action Hub */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={14} className="text-indigo-600" /> Aksi Cepat Sinkronisasi &amp; Cache
              </span>
              <span className="text-[10.5px] text-slate-400 font-medium">IndexedDB Engine</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                onClick={handleManualSync}
                disabled={!isOnline || isSyncing || loading}
              >
                {(isSyncing || loading) ? (
                  <><RefreshCw size={14} className="animate-spin" /> Menyinkronkan...</>
                ) : (
                  <><CloudUpload size={14} /> Sync Sekarang ({pendingUnsyncedCount})</>
                )}
              </button>

              <button
                type="button"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                onClick={handleRefreshCache}
                disabled={!isOnline || caching}
                title="Unduh katalog produk, kategori, dan pengaturan terbaru agar siap saat offline"
              >
                {caching ? (
                  <><RefreshCw size={14} className="animate-spin" /> Mengunduh Cache...</>
                ) : (
                  <><Download size={14} /> Unduh / Refresh Cache</>
                )}
              </button>

              <button
                type="button"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                onClick={handleExportBackup}
                title="Unduh antrean transaksi lokal sebagai file JSON darurat"
              >
                <Download size={14} /> Cadangkan (.json)
              </button>
            </div>
          </div>

          {/* Pending Orders List */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" /> Antrean Transaksi Offline
              </span>
              <span className="text-[11px] font-bold text-slate-500">{pendingOrders.length} tercatat di memori</span>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400 gap-1.5">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <p className="text-xs font-bold text-slate-600">Semua transaksi aman dan sudah tersinkronkan ke server!</p>
                <p className="text-[11px] text-slate-400">Tidak ada antrean tertunda saat ini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                {pendingOrders.map((order) => (
                  <div key={order.id || order.offlineId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-slate-800">{order.orderNumber || order.offlineId}</span>
                        {getStatusBadge(order.syncStatus)}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {order.customerName || 'Pelanggan Umum'} · {order.items?.length || 0} item · {fmtDate(order.clientTimestamp)}
                      </div>
                      {order.syncError && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5 truncate">
                          ⚠ Error: {order.syncError}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900">{fmt(order.total)}</span>
                      <div className="text-[10px] text-slate-400 font-medium capitalize">{order.paymentMethod || 'CASH'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync History Logs */}
          {syncLogs.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw size={13} className="text-slate-500" /> Riwayat Sinkronisasi Terakhir
              </span>
              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto pr-1">
                {syncLogs.map((log, i) => (
                  <div key={i} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span>{log.status === 'SUCCESS' ? '✅' : '❌'}</span>
                      <span className="text-slate-700 font-medium">{log.details || `${log.type} — ${log.count} item`}</span>
                    </div>
                    <span className="text-[10.5px] text-slate-400">{fmtDate(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standalone Offline Native Banner (.EXE / .APK) */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-amber-400">
                <Laptop size={22} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">Aplikasi Standalone Offline (Beli-Putus)</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                  Butuh kasir 100% tanpa internet dengan database lokal SQLite &amp; lisensi Hardware ID?
                </p>
              </div>
            </div>
            <a
              href="/platform-admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black tracking-tight shrink-0 transition-transform active:scale-95"
            >
              Info Lisensi <ArrowRight size={13} />
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Engine: <strong>Dexie IndexedDB v1</strong></span>
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
