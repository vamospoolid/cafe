import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, RefreshCw, Car, Wrench, Clock, CheckCircle2, AlertCircle, 
  ArrowRight, Trash2, Sparkles, Eye, EyeOff, PackageCheck 
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import useSocket from '../../hooks/useSocket';

interface WorkOrderSummary {
  id: string;
  spkNumber: string;
  vehiclePlate: string;
  customerName: string;
  customerPhone?: string;
  complaint?: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'DONE' | 'PAID' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  services: Array<{
    id: string;
    serviceName: string;
    mechanic?: { id: number; name: string };
  }>;
  parts: Array<{
    id: string;
    partName: string;
    qty: number;
  }>;
}

const ALL_COLUMNS = [
  { key: 'PENDING', title: 'Antrean (Pending)', color: 'bg-amber-50 border-amber-200 text-amber-800', badge: 'bg-amber-500' },
  { key: 'IN_PROGRESS', title: 'Sedang Dikerjakan', color: 'bg-blue-50 border-blue-200 text-blue-800', badge: 'bg-blue-600' },
  { key: 'DONE', title: 'Selesai Servis', color: 'bg-emerald-50 border-emerald-200 text-emerald-800', badge: 'bg-emerald-600' },
  { key: 'PAID', title: 'Lunas / Selesai', color: 'bg-gray-100 border-gray-200 text-gray-700', badge: 'bg-gray-500' },
];

export const StatusBoard: React.FC = () => {
  const { token } = usePOS();
  const navigate = useNavigate();
  const socket = useSocket();

  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [clearing, setClearing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [showPaidColumn, setShowPaidColumn] = useState<boolean>(true);

  const fetchWorkOrders = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/bengkel/work-orders?boardOnly=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data);
      } else {
        toast('Gagal memuat data SPK', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Koneksi terputus saat mengambil data SPK', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Real-time listener via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchWorkOrders();
    };

    socket.on('spk:created', handleUpdate);
    socket.on('spk:status_updated', handleUpdate);

    return () => {
      socket.off('spk:created', handleUpdate);
      socket.off('spk:status_updated', handleUpdate);
    };
  }, [socket, fetchWorkOrders]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/bengkel/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast(`Status SPK berhasil diubah ke ${newStatus}`, 'success');
        fetchWorkOrders();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengubah status SPK', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan saat memperbarui status', 'error');
    }
  };

  // Bersihkan semua transaksi berstatus LUNAS (PAID -> DELIVERED)
  const handleClearPaid = async () => {
    if (!token || clearing) return;
    setClearing(true);
    try {
      const res = await fetch('/api/bengkel/work-orders/clear-paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        toast(`🧹 ${data.message || 'Kolom lunas berhasil dibersihkan!'}`, 'success');
        fetchWorkOrders();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal membersihkan SPK lunas', 'error');
      }
    } catch {
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setClearing(false);
    }
  };

  const filteredOrders = workOrders.filter(wo => {
    if (!search) return true;
    const q = search.toLowerCase();
    const custName = (wo.customerName || (wo as any).customer?.name || '').toLowerCase();
    const plate = (wo.vehiclePlate || (wo as any).vehicle?.plateNumber || '').toLowerCase();
    return (
      wo.spkNumber.toLowerCase().includes(q) ||
      plate.includes(q) ||
      custName.includes(q)
    );
  });

  const paidOrders = filteredOrders.filter(wo => wo.status === 'PAID');
  const activeColumns = showPaidColumn ? ALL_COLUMNS : ALL_COLUMNS.filter(c => c.key !== 'PAID');

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Status Board SPK Bengkel</h1>
            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-purple-100 text-purple-700">
              Live Real-Time
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pantau alur pengerjaan servis kendaraan pit bengkel, mekanik yang bertugas, dan status antrean.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Tombol Bersihkan yang Lunas */}
          {paidOrders.length > 0 && (
            <button
              onClick={handleClearPaid}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black rounded-xl shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Bersihkan semua transaksi yang sudah lunas dari papan kerja"
            >
              <Trash2 size={15} className="text-rose-600" />
              <span>{clearing ? 'Membersihkan...' : `Bersihkan yang Lunas (${paidOrders.length})`}</span>
            </button>
          )}

          {/* Toggle Sembunyikan/Tampilkan Kolom Lunas */}
          <button
            onClick={() => setShowPaidColumn(!showPaidColumn)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition shadow-2xs cursor-pointer ${
              showPaidColumn 
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' 
                : 'bg-purple-50 border-purple-300 text-purple-800'
            }`}
            title="Sembunyikan atau tampilkan kolom transaksi lunas"
          >
            {showPaidColumn ? <EyeOff size={15} /> : <Eye size={15} />}
            <span className="hidden sm:inline">
              {showPaidColumn ? 'Fokus 4 Kolom Antrean' : 'Tampilkan Kolom Lunas'}
            </span>
          </button>

          <button
            onClick={() => fetchWorkOrders()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="Segarkan data"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => navigate('/bengkel/spk/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Buat SPK Baru</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-5 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Plat Nomor, Nomor SPK, atau Nama Pelanggan..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${showPaidColumn ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {activeColumns.map(col => {
          const items = filteredOrders.filter(wo => {
            if (col.key === 'IN_PROGRESS') {
              return wo.status === 'IN_PROGRESS' || wo.status === 'ASSIGNED' || wo.status === 'WAITING_PARTS';
            }
            return wo.status === col.key;
          });

          return (
            <div key={col.key} className="flex flex-col bg-slate-100/70 rounded-2xl p-3 border border-slate-200 min-h-[500px]">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <span className="font-extrabold text-xs sm:text-sm text-slate-800">{col.title}</span>
                <div className="flex items-center gap-1.5">
                  {col.key === 'PAID' && items.length > 0 && (
                    <button
                      onClick={handleClearPaid}
                      disabled={clearing}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer"
                      title="Bersihkan semua transaksi lunas"
                    >
                      Bersihkan
                    </button>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full text-white font-black ${col.badge}`}>
                    {items.length}
                  </span>
                </div>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-270px)] pr-1 scrollbar-thin">
                {items.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-xl">
                    <span>Tidak ada SPK</span>
                  </div>
                ) : (
                  items.map(wo => (
                    <div
                      key={wo.id}
                      onClick={() => navigate(`/bengkel/spk/${wo.id}`)}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer hover:border-purple-300 group"
                    >
                      {/* SPK Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                          {wo.spkNumber}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Plat Nomor & Customer */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Car size={16} className="text-purple-600 shrink-0" />
                        <span className="font-black text-slate-900 text-sm tracking-wide">
                          {wo.vehiclePlate || (wo as any).vehicle?.plateNumber || 'UMUM'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mb-2 truncate">
                        Pelanggan: <span className="font-semibold text-slate-800">{wo.customerName || (wo as any).customer?.name || 'Walk-In'}</span>
                      </div>

                      {/* Complaint Preview */}
                      {wo.complaint && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mb-2 line-clamp-2 italic border border-slate-100">
                          "{wo.complaint}"
                        </div>
                      )}

                      {/* Services & Mechanic Summary */}
                      {wo.services.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
                          <Wrench size={13} className="text-purple-600 shrink-0" />
                          <span className="truncate font-medium">
                            {wo.services.map(s => s.serviceName).join(', ')}
                          </span>
                        </div>
                      )}

                      {/* Bottom Footer & Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="font-black text-purple-950">
                          Rp {wo.totalAmount.toLocaleString('id-ID')}
                        </span>

                        {wo.status === 'PENDING' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(wo.id, 'IN_PROGRESS');
                            }}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition"
                          >
                            <span>Kerjakan</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {(wo.status === 'ASSIGNED' || wo.status === 'IN_PROGRESS' || wo.status === 'WAITING_PARTS') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(wo.id, 'DONE');
                            }}
                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition"
                          >
                            <span>Selesai</span>
                            <CheckCircle2 size={13} />
                          </button>
                        )}

                        {wo.status === 'DONE' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/bengkel/spk/${wo.id}`);
                            }}
                            className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-black bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition shadow-2xs"
                          >
                            <span>Bayar Kasir</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {wo.status === 'PAID' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(wo.id, 'DELIVERED');
                            }}
                            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition"
                            title="Tandai kendaraan sudah diambil oleh konsumen"
                          >
                            <PackageCheck size={13} className="text-emerald-600" />
                            <span>Ambil Unit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusBoard;
