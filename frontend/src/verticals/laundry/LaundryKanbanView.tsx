import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Shirt, 
  Search, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Plus, 
  Printer, 
  RefreshCw, 
  Grid, 
  Sparkles, 
  Wind, 
  ArrowRight, 
  DollarSign, 
  Check, 
  X,
  CreditCard,
  Wallet,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { LaundryReceiptPrinter } from './LaundryReceiptPrinter';

interface OrderItem {
  id: number;
  serviceName: string;
  unitType: string;
  qty: number;
  pricePerUnit: number;
  subtotal: number;
  notes?: string;
}

interface LaundryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  serviceCategory: string;
  serviceSpeed: string;
  perfumeVariant?: string;
  rackLocation?: string;
  itemCountNotes?: string;
  specialNotes?: string;
  status: 'RECEIVED' | 'WASHING' | 'DRYING' | 'IRONING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  subtotal: number;
  speedSurcharge: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentMethod?: string;
  estimatedDoneAt?: string;
  readyAt?: string;
  completedAt?: string;
  items: OrderItem[];
  createdAt: string;
}

const STATUS_COLUMNS = [
  { id: 'RECEIVED', label: '1. Diterima', icon: Shirt, color: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50/70', badge: 'bg-amber-100 text-amber-800' },
  { id: 'WASHING', label: '2. Mesin Cuci', icon: RefreshCw, color: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50/70', badge: 'bg-blue-100 text-blue-800' },
  { id: 'DRYING', label: '3. Pengeringan', icon: Wind, color: 'text-sky-600', border: 'border-sky-200', bg: 'bg-sky-50/70', badge: 'bg-sky-100 text-sky-800' },
  { id: 'IRONING', label: '4. Setrika & Uap', icon: Sparkles, color: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50/70', badge: 'bg-purple-100 text-purple-800' },
  { id: 'READY', label: '5. Siap di Rak', icon: Grid, color: 'text-cyan-700', border: 'border-cyan-200', bg: 'bg-cyan-50/70', badge: 'bg-cyan-100 text-cyan-800' },
  { id: 'COMPLETED', label: '6. Selesai Diambil', icon: CheckCircle2, color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/70', badge: 'bg-emerald-100 text-emerald-800' }
] as const;

export const LaundryKanbanView: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, settings, triggerHaptic } = usePOS();

  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Modal Alokasi Rak saat order READY
  const [readyModalOrder, setReadyModalOrder] = useState<LaundryOrder | null>(null);
  const [selectedRack, setSelectedRack] = useState('RAK-A1');
  const [sendWhatsAppOnReady, setSendWhatsAppOnReady] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Modal Serah Terima & Pelunasan Kasir
  const [pickupModalOrder, setPickupModalOrder] = useState<LaundryOrder | null>(null);
  const [pickupPayAmount, setPickupPayAmount] = useState<string>('');
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [printingOrder, setPrintingOrder] = useState<LaundryOrder | null>(null);

  // Load orders dari API
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/laundry/orders?limit=150', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('[LaundryKanban] Error fetching:', err);
      toast('Gagal memuat daftar status cucian', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Polling update status
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Transisi Alur Kanban
  const handleTransitionStatus = async (order: LaundryOrder, nextStatus: LaundryOrder['status']) => {
    triggerHaptic?.(10);

    // Jika menuju tahap 'READY', buka modal pilih nomor rak terlebih dahulu
    if (nextStatus === 'READY') {
      setReadyModalOrder(order);
      setSelectedRack(order.rackLocation || 'RAK-A1');
      return;
    }

    // Jika menuju tahap 'COMPLETED', buka modal serah terima & kasir pelunasan
    if (nextStatus === 'COMPLETED') {
      setPickupModalOrder(order);
      const unpaid = Math.max(0, order.totalAmount - order.paidAmount);
      setPickupPayAmount(unpaid.toString());
      return;
    }

    // Transisi langsung (RECEIVED -> WASHING -> DRYING -> IRONING)
    try {
      const res = await fetch(`/api/laundry/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        toast(`Status ${order.orderNumber} diubah ke ${nextStatus}`, 'success');
        fetchOrders();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengubah status', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  // Submit Alokasi Rak & Kirim WA Otomatis
  const handleConfirmReadyWithRack = async () => {
    if (!readyModalOrder) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/laundry/orders/${readyModalOrder.id}/ready`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rackLocation: selectedRack,
          sendWhatsApp: sendWhatsAppOnReady
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(`✅ Pakaian siap di ${selectedRack}!`, 'success');
        
        // Buka link WhatsApp jika ada nomor HP dan opsi aktif
        if (sendWhatsAppOnReady && readyModalOrder.customerPhone) {
          const storeName = settings?.storeName || 'Laundry Kami';
          const unpaid = Math.max(0, readyModalOrder.totalAmount - readyModalOrder.paidAmount);
          const cleanPhone = readyModalOrder.customerPhone.replace(/[^0-9]/g, '');
          const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

          const msg = `Halo Kak *${readyModalOrder.customerName}*,\n` +
            `Pakaian cucian Anda dengan No. Nota *${readyModalOrder.orderNumber}* sudah selesai dan tersimpan rapi di *${selectedRack}* di ${storeName}.\n\n` +
            (unpaid > 0
              ? `Sisa tagihan yang perlu diselesaikan: *Rp ${unpaid.toLocaleString('id-ID')}*.\n\n`
              : `Status pembayaran: *LUNAS*.\n\n`) +
            `Silakan diambil pada jam operasional kami ya. Terima kasih! 🙏✨`;

          const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, '_blank');
        }

        setReadyModalOrder(null);
        fetchOrders();
      } else {
        toast(data.error || 'Gagal memperbarui rak', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan server', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Submit Serah Terima & Kasir Pelunasan
  const handleConfirmPickup = async () => {
    if (!pickupModalOrder) return;
    setIsUpdatingStatus(true);
    try {
      const payAmount = parseFloat(pickupPayAmount) || 0;
      const res = await fetch(`/api/laundry/orders/${pickupModalOrder.id}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          payAmount,
          paymentMethod: payAmount > 0 ? pickupPaymentMethod : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(`🎉 Pakaian berhasil diserahkan ke pelanggan!`, 'success');
        const completedOrder = data.order || pickupModalOrder;
        setPickupModalOrder(null);
        setPrintingOrder(completedOrder);
        fetchOrders();
      } else {
        toast(data.error || 'Gagal menyelesaikan serah terima', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan server', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filter Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = 
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
        (o.rackLocation && o.rackLocation.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchPayment = 
        paymentFilter === 'ALL' ? true :
        paymentFilter === 'UNPAID' ? o.paymentStatus !== 'PAID' :
        o.paymentStatus === 'PAID';

      return matchSearch && matchPayment;
    });
  }, [orders, searchQuery, paymentFilter]);

  // Kelompokkan per Status
  const columnsData = useMemo(() => {
    const map: Record<string, LaundryOrder[]> = {
      RECEIVED: [],
      WASHING: [],
      DRYING: [],
      IRONING: [],
      READY: [],
      COMPLETED: []
    };
    for (const o of filteredOrders) {
      if (map[o.status]) {
        map[o.status].push(o);
      }
    }
    return map;
  }, [filteredOrders]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-800 overflow-hidden font-sans">
      
      {/* ─── HEADER BAR ─────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-2xs">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Papan Status Cucian & Rak
              <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-full font-bold">
                Live Kanban
              </span>
            </h1>
            <p className="text-xs text-slate-500">Pantau proses cuci, pengeringan, setrika, nomor rak, & serah terima</p>
          </div>
        </div>

        {/* Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nota, pelanggan, rak..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500 w-44 sm:w-56 transition-all"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {(['ALL', 'UNPAID', 'PAID'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPaymentFilter(p)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  paymentFilter === p
                    ? 'bg-white text-cyan-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'ALL' ? 'Semua' : p === 'UNPAID' ? 'Belum Lunas' : 'Lunas'}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>Drop-off Baru</span>
          </button>

          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs transition-all"
            title="Muat Ulang"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-cyan-600' : ''} />
          </button>
        </div>
      </div>

      {/* ─── KANBAN BOARD COLUMNS ────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 bg-slate-100/70">
        {STATUS_COLUMNS.map(col => {
          const Icon = col.icon;
          const colOrders = columnsData[col.id] || [];

          return (
            <div
              key={col.id}
              className="flex-1 min-w-[280px] max-w-[340px] flex flex-col bg-slate-200/50 rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs"
            >
              {/* Column Header */}
              <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${col.bg} ${col.color}`}>
                    <Icon size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">{col.label}</h3>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.badge}`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colOrders.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200/80 rounded-xl m-1">
                    Tidak ada cucian di tahap ini
                  </div>
                ) : (
                  colOrders.map(order => {
                    const unpaid = Math.max(0, order.totalAmount - order.paidAmount);

                    return (
                      <div
                        key={order.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 text-xs"
                      >
                        {/* Header Nota & Tag Kecepatan */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 tracking-tight">
                                {order.orderNumber}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrintingOrder(order);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                                title="Cetak Ulang Struk Thermal"
                              >
                                <Printer size={12} />
                              </button>
                            </div>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                order.serviceSpeed === 'EXPRESS_6H'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : order.serviceSpeed === 'KILAT_24H'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {order.serviceSpeed === 'EXPRESS_6H' ? 'Super 6 Jam' : order.serviceSpeed === 'KILAT_24H' ? 'Kilat 24 Jam' : 'Reguler'}
                            </span>
                          </div>

                          <div className="mt-1 font-bold text-slate-900 text-sm">
                            {order.customerName}
                          </div>
                          {order.customerPhone && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                              <Phone size={10} /> {order.customerPhone}
                            </div>
                          )}

                          {/* Detail Rincian Items */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                                <span className="truncate pr-2">{it.qty} {it.unitType.toLowerCase()} {it.serviceName}</span>
                                <span className="font-semibold text-slate-800">Rp {it.subtotal.toLocaleString('id-ID')}</span>
                              </div>
                            ))}
                          </div>

                          {/* Pewangi & Lokasi Rak */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {order.perfumeVariant && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold flex items-center gap-1">
                                <Sparkles size={10} /> {order.perfumeVariant}
                              </span>
                            )}
                            {order.rackLocation && (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 font-black">
                                📍 {order.rackLocation}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Footer Status Pembayaran & Tombol Pindah Tahap */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] text-slate-400">Total Biaya:</div>
                            <div className="font-black text-slate-900 text-xs">
                              Rp {order.totalAmount.toLocaleString('id-ID')}
                            </div>
                            <div className={`text-[10px] font-bold ${order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {order.paymentStatus === 'PAID' ? 'LUNAS' : `Sisa Rp ${unpaid.toLocaleString('id-ID')}`}
                            </div>
                          </div>

                          {/* Tombol Lanjut ke Tahap Berikutnya */}
                          {col.id === 'RECEIVED' && (
                            <button
                              onClick={() => handleTransitionStatus(order, 'WASHING')}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-[11px] transition-all border border-blue-200 flex items-center gap-1"
                            >
                              <span>Cuci</span>
                              <ArrowRight size={12} />
                            </button>
                          )}

                          {col.id === 'WASHING' && (
                            <button
                              onClick={() => handleTransitionStatus(order, 'DRYING')}
                              className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white font-bold text-[11px] transition-all border border-sky-200 flex items-center gap-1"
                            >
                              <span>Keringkan</span>
                              <ArrowRight size={12} />
                            </button>
                          )}

                          {col.id === 'DRYING' && (
                            <button
                              onClick={() => handleTransitionStatus(order, 'IRONING')}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white font-bold text-[11px] transition-all border border-purple-200 flex items-center gap-1"
                            >
                              <span>Setrika</span>
                              <ArrowRight size={12} />
                            </button>
                          )}

                          {col.id === 'IRONING' && (
                            <button
                              onClick={() => handleTransitionStatus(order, 'READY')}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] transition-all shadow-xs flex items-center gap-1"
                            >
                              <span>Masuk Rak</span>
                              <ArrowRight size={12} />
                            </button>
                          )}

                          {col.id === 'READY' && (
                            <button
                              onClick={() => handleTransitionStatus(order, 'COMPLETED')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all shadow-xs flex items-center gap-1"
                            >
                              <span>Serah Terima</span>
                              <Check size={12} />
                            </button>
                          )}

                          {col.id === 'COMPLETED' && (
                            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 size={13} /> Selesai
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL ALOKASI RAK SIMPAN (READY MODAL) ────────────────────────── */}
      {readyModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">Pengepakan Selesai</span>
                <h3 className="text-base font-bold text-slate-900">Simpan ke Rak Laundry</h3>
              </div>
              <button
                onClick={() => setReadyModalOrder(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                  Pilih Nomor Rak / Hanger Simpan
                </label>
                <select
                  value={selectedRack}
                  onChange={e => setSelectedRack(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="RAK-A1">RAK-A1 (Pakaian Lipat)</option>
                  <option value="RAK-A2">RAK-A2 (Pakaian Lipat)</option>
                  <option value="RAK-B1">RAK-B1 (Kiloan Standar)</option>
                  <option value="RAK-B2">RAK-B2 (Kiloan Standar)</option>
                  <option value="HANGER-01">HANGER-01 (Jas & Gaun)</option>
                  <option value="HANGER-02">HANGER-02 (Bedcover & Selimut)</option>
                </select>
              </div>

              {/* Kirim WhatsApp Otomatis Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendWhatsAppOnReady}
                  onChange={e => setSendWhatsAppOnReady(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-1">
                    <MessageSquare size={13} /> Kirim Notifikasi WhatsApp Otomatis
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Kirim pesan ke {readyModalOrder.customerPhone || 'pelanggan'} bahwa cucian sudah wangi & siap diambil.
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleConfirmReadyWithRack}
                disabled={isUpdatingStatus}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                <span>Simpan di Rak</span>
              </button>
              <button
                onClick={() => setReadyModalOrder(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SERAH TERIMA & KASIR PELUNASAN (PICKUP MODAL) ───────────── */}
      {pickupModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Pengambilan Cucian</span>
                <h3 className="text-base font-bold text-slate-900">Serah Terima & Pelunasan</h3>
              </div>
              <button
                onClick={() => setPickupModalOrder(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Order:</span>
                  <span className="font-mono font-bold text-slate-800">{pickupModalOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelanggan:</span>
                  <span className="font-bold text-slate-800">{pickupModalOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lokasi Rak:</span>
                  <span className="font-black text-cyan-700">{pickupModalOrder.rackLocation || 'Rak Simpan'}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Total Biaya:</span>
                  <span className="font-bold text-slate-800">Rp {pickupModalOrder.totalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Sudah Dibayar (Di Awal):</span>
                  <span className="font-bold">Rp {pickupModalOrder.paidAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Sisa Tagihan */}
              {pickupModalOrder.totalAmount > pickupModalOrder.paidAmount ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-amber-900">Sisa yang Wajib Dibayar:</span>
                    <span className="text-base font-black text-rose-600">
                      Rp {(pickupModalOrder.totalAmount - pickupModalOrder.paidAmount).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                      Metode Pelunasan
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'CASH', label: 'Tunai' },
                        { id: 'QRIS', label: 'QRIS' },
                        { id: 'TRANSFER', label: 'Transfer' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPickupPaymentMethod(m.id as any)}
                          className={`py-1 rounded-lg text-xs font-bold transition-all border ${
                            pickupPaymentMethod === m.id
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={16} /> Nota ini sudah LUNAS!
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleConfirmPickup}
                disabled={isUpdatingStatus}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Selesaikan & Serahkan Pakaian</span>
              </button>
              <button
                onClick={() => setPickupModalOrder(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CETAK STRUK THERMAL NOTA CUCI ───────────────────────────── */}
      {printingOrder && (
        <LaundryReceiptPrinter 
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

    </div>
  );
};

export default LaundryKanbanView;
