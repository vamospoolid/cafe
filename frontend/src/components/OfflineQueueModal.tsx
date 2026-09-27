import React, { useState, useEffect } from 'react';
import { offlineDb, type PendingOrder, type PendingAttendance } from '../db/offlineDb';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  onTriggerSync,
  isSyncing = false,
}) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'ATTENDANCE'>('ORDERS');
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [attendances, setAttendances] = useState<PendingAttendance[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const pendingOrders = await offlineDb.pendingOrders.toArray();
      const pendingAtts = await offlineDb.pendingAttendances.toArray();
      setOrders(pendingOrders.reverse());
      setAttendances(pendingAtts.reverse());
    } catch (e) {
      console.error('Error loading offline queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalOfflineAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-bold">
              📦
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Antrean Data Offline Lokal
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  {orders.length + attendances.length} item
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Data disimpan di memori internal tablet/browser dan akan dikirim ke server cloud saat online.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector & Summary */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'ORDERS'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <span>🛒 Transaksi Kasir ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ATTENDANCE')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'ATTENDANCE'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <span>📸 Presensi Staf ({attendances.length})</span>
            </button>
          </div>

          {activeTab === 'ORDERS' && (
            <div className="text-xs text-slate-400">
              Total Nilai Tertunda: <span className="font-bold text-emerald-400">Rp {totalOfflineAmount.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
              Memuat data antrean lokal...
            </div>
          ) : activeTab === 'ORDERS' ? (
            orders.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p className="text-4xl mb-2">🎉</p>
                <p className="font-semibold text-slate-300">Tidak ada antrean transaksi kasir.</p>
                <p className="text-xs text-slate-500 mt-1">Semua transaksi kasir telah tersinkronkan ke cloud.</p>
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.offlineId}
                  className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">{ord.orderNumber}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          ord.syncStatus === 'SYNCED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : ord.syncStatus === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {ord.syncStatus}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {ord.paymentMethod}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {ord.items.length} item: {ord.items.map((i) => `${i.productName} (${i.quantity}x)`).join(', ')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      ID: <span className="font-mono">{ord.offlineId}</span> • Dibuat:{' '}
                      {new Date(ord.clientTimestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                    {ord.syncError && (
                      <p className="text-xs text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-900/50">
                        Error: {ord.syncError}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-2 md:pt-0 border-slate-700">
                    <span className="text-sm font-bold text-emerald-400">
                      Rp {ord.total.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Kasir: {ord.cashierName || 'Kasir Offline'}
                    </span>
                  </div>
                </div>
              ))
            )
          ) : (
            attendances.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p className="text-4xl mb-2">✨</p>
                <p className="font-semibold text-slate-300">Tidak ada antrean presensi staf.</p>
                <p className="text-xs text-slate-500 mt-1">Semua clock-in/out telah tersinkronkan ke cloud.</p>
              </div>
            ) : (
              attendances.map((att) => (
                <div
                  key={att.offlineId}
                  className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    {att.photoBase64 ? (
                      <img
                        src={att.photoBase64}
                        alt="Selfie"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-xl">
                        👤
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{att.userName}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-300">
                          {att.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Jam:{' '}
                        {new Date(att.clientTimestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                      att.syncStatus === 'SYNCED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {att.syncStatus}
                  </span>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={loadData}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>🔄</span> Segarkan Daftar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Tutup
            </button>
            {onTriggerSync && (
              <button
                onClick={onTriggerSync}
                disabled={isSyncing || (orders.length === 0 && attendances.length === 0)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {isSyncing ? (
                  <>
                    <span className="animate-spin">🌀</span> Menyinkronkan...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Sync ke Cloud Sekarang
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
