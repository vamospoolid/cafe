import React, { useState, useEffect, useContext } from 'react';
import { 
  Truck, 
  Search, 
  RefreshCw, 
  Printer, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Calendar, 
  User, 
  MapPin, 
  Phone,
  ChevronRight,
  Package,
  AlertCircle,
  Download
} from 'lucide-react';
import { POSContext } from '../../context/POSContext';
import { DeliveryOrderPrintModal } from './DeliveryOrderPrintModal';
import { exportDeliveryOrderPDF } from '../../utils/deliveryOrderPdfGenerator';

interface DeliveryOrderItem {
  id: string;
  productId?: number;
  quantity?: number;
  qtyShipped?: number;
  uomName?: string;
  unitName?: string;
  productName?: string;
  notes?: string;
  product?: {
    name: string;
    barcode?: string;
  };
}

interface DeliveryOrder {
  id: string;
  orderId: number;
  customerId: string;
  doNumber: string;
  driverName?: string;
  vehiclePlate?: string;
  deliveryStatus?: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  status?: string;
  notes?: string;
  createdAt: string;
  customer?: {
    name: string;
    phone?: string;
    address?: string;
  };
  items: DeliveryOrderItem[];
}

export const DeliveryOrdersView: React.FC = () => {
  const posContext = useContext(POSContext);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<DeliveryOrder | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const fetchDeliveryOrders = async () => {
    if (!posContext?.token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/retail/delivery-orders', {
        headers: { Authorization: `Bearer ${posContext.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : (data.deliveryOrders || []));
      }
    } catch (err) {
      console.error('Failed to fetch delivery orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryOrders();
  }, [posContext?.token]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!posContext?.token) return;
    setIsUpdatingStatus(id);
    try {
      const res = await fetch(`/api/retail/delivery-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, deliveryStatus: newStatus as any, status: newStatus as any } : o));
      } else {
        alert('Gagal memperbarui status pengiriman.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    const activeSt = (o.deliveryStatus || o.status || 'PENDING').toUpperCase();
    const matchesSearch = 
      o.doNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.driverName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.vehiclePlate || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || activeSt === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (rawStatus?: string) => {
    const st = (rawStatus || 'PENDING').toUpperCase();
    switch (st) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={12} /> Menunggu Sopir
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Truck size={12} /> Dalam Pengiriman
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle size={12} /> Terkirim & Diterima
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle size={12} /> Dibatalkan
          </span>
        );
      default:
        return <span>{st}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 font-bold border border-amber-500/20">
            <Truck size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Surat Jalan & Pengiriman Armada
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Pelacakan distribusi pengiriman barang toko grosir ke warung dan agen langganan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDeliveryOrders}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No. DO, nama toko/warung, sopir, atau nopol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'ALL' ? 'Semua Status' : st === 'PENDING' ? 'Menunggu' : st === 'IN_TRANSIT' ? 'Jalan' : st === 'DELIVERED' ? 'Terkirim' : 'Batal'}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Orders List */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
          <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-semibold">Memuat riwayat surat jalan...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
          <Truck size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-base font-bold text-slate-700">Belum ada Surat Jalan Pengiriman</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Surat jalan dibuat otomatis saat kasir memproses pesanan di POS dengan opsi pengiriman armada aktif.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">NOMOR SURAT JALAN</span>
                    <span className="font-extrabold text-sm text-slate-900 tracking-tight font-mono">{order.doNumber}</span>
                  </div>
                  <div>
                    {getStatusBadge(order.deliveryStatus || order.status)}
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{order.customer?.name || 'Pelanggan Langganan'}</span>
                  </div>
                  {order.customer?.address && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-500 line-clamp-2">
                      <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>{order.customer.address}</span>
                    </div>
                  )}
                  {order.customer?.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      <span>{order.customer.phone}</span>
                    </div>
                  )}
                </div>

                {/* Armada & Driver info */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Sopir / Kurir</span>
                    <span className="font-bold text-slate-700">{order.driverName || 'Armada Toko'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Plat Nopol</span>
                    <span className="font-mono font-bold text-slate-700">{order.vehiclePlate || '-'}</span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase mb-1.5">
                    <span>Muatan Barang</span>
                    <span>{order.items?.length || 0} Jenis</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-0.5 border-b border-slate-50">
                        <span className="truncate text-slate-700 font-medium">
                          {it.productName || it.product?.name || `Barang #${it.productId}`}
                        </span>
                        <span className="font-bold text-slate-900 font-mono ml-2 shrink-0">
                          {it.qtyShipped ?? it.quantity} {it.unitName || it.uomName || 'PCS'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions & Status Changer */}
              {(() => {
                const activeSt = (order.deliveryStatus || order.status || 'PENDING').toUpperCase();
                return (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedOrderForPrint(order)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                        title="Cetak / Pratinjau Surat Jalan A4"
                      >
                        <Printer size={13} />
                        <span>Cetak</span>
                      </button>
                      <button
                        onClick={() => exportDeliveryOrderPDF(order, posContext?.settings)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-200/60"
                        title="Download File PDF (Nama Pemesan)"
                      >
                        <Download size={13} />
                        <span>PDF</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {activeSt === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'IN_TRANSIT')}
                          disabled={isUpdatingStatus === order.id}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1"
                        >
                          <Truck size={13} />
                          <span>Mulai Kirim</span>
                        </button>
                      )}
                      {activeSt === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                          disabled={isUpdatingStatus === order.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1"
                        >
                          <CheckCircle size={13} />
                          <span>Konfirmasi Tiba</span>
                        </button>
                      )}
                      {activeSt === 'DELIVERED' && (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
                          <CheckCircle size={12} /> Terkirim
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Modal Cetak Surat Jalan */}
      {selectedOrderForPrint && (
        <DeliveryOrderPrintModal
          order={selectedOrderForPrint}
          onClose={() => setSelectedOrderForPrint(null)}
          storeSettings={posContext?.settings}
        />
      )}
    </div>
  );
};
export default DeliveryOrdersView;
