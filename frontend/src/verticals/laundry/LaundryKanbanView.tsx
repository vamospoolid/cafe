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

function getEffectiveOrderAmounts(order: LaundryOrder | null) {
  if (!order) return { totalAmount: 0, subtotal: 0, paidAmount: 0, unpaid: 0, isLunas: false };
  const itemsSum = Array.isArray(order.items)
    ? order.items.reduce((s, it) => s + (Number(it.subtotal) || (Number(it.qty) * Number(it.pricePerUnit)) || 0), 0)
    : 0;
  const surcharge = Number(order.speedSurcharge) || 0;
  const disc = Number(order.discount) || 0;
  const computedTotal = Math.max(0, itemsSum + surcharge - disc);

  const effectiveTotal = Number(order.totalAmount) > 0 ? Number(order.totalAmount) : computedTotal;
  const effectiveSubtotal = Number(order.subtotal) > 0 ? Number(order.subtotal) : itemsSum;
  const paidAmount = Number(order.paidAmount) || 0;
  const unpaid = Math.max(0, effectiveTotal - paidAmount);
  const isLunas = unpaid === 0 && effectiveTotal > 0 && order.paymentStatus === 'PAID';

  return {
    totalAmount: effectiveTotal,
    subtotal: effectiveSubtotal,
    paidAmount,
    unpaid,
    isLunas
  };
}

export const LaundryKanbanView: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, settings, triggerHaptic } = usePOS();

  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [mobileStatusTab, setMobileStatusTab] = useState<'ALL' | LaundryOrder['status']>('ALL');

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

  // Quick WhatsApp Status Notification
  const handleSendStatusWhatsApp = (order: LaundryOrder) => {
    if (!order.customerPhone) {
      toast('Nomor WhatsApp pelanggan belum tercatat', 'info');
      return;
    }
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const storeName = settings?.storeName || 'Laundry Kami';
    const unpaid = Math.max(0, order.totalAmount - order.paidAmount);

    let statusDesc = '';
    switch (order.status) {
      case 'RECEIVED':
        statusDesc = 'telah kami *terima* dan sedang dalam antrean proses pencucian.';
        break;
      case 'WASHING':
        statusDesc = 'saat ini sedang *dicuci bersih* di mesin cuci higienis kami.';
        break;
      case 'DRYING':
        statusDesc = 'saat ini sedang dalam proses *pengeringan* optimal.';
        break;
      case 'IRONING':
        statusDesc = 'saat ini sedang dalam proses *setrika & uap rapi*.';
        break;
      case 'READY':
        statusDesc = `sudah *SELESAI & WANGI* (${order.perfumeVariant || 'Aroma Segar'}), kini tersimpan rapi di *${order.rackLocation || 'Rak Simpan'}*. Silakan diambil ya!`;
        break;
      case 'COMPLETED':
        statusDesc = 'telah berhasil diserahterimakan / diambil. Terima kasih atas kepercayaan Anda!';
        break;
      default:
        statusDesc = 'sedang dalam proses penanganan tim kami.';
    }

    const msg =
      `Halo Kak *${order.customerName}*,\n` +
      `Update status cucian Anda di *${storeName}*:\n\n` +
      `No. Nota: *${order.orderNumber}*\n` +
      `Status Terkini: ${statusDesc}\n\n` +
      (unpaid > 0 ? `Sisa Pembayaran: *Rp ${unpaid.toLocaleString('id-ID')}*.\n\n` : `Status Pembayaran: *LUNAS*.\n\n`) +
      `Jika ada pertanyaan, silakan balas pesan WhatsApp ini. Terima kasih! 🙏✨`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

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
      const { unpaid } = getEffectiveOrderAmounts(order);
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
          paidAmountNow: payAmount,
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

  // Render individual Order Card
  const renderOrderCard = (order: LaundryOrder, colId: string) => {
    const { totalAmount, unpaid, isLunas } = getEffectiveOrderAmounts(order);

    return (
      <div
        key={order.id}
        className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 text-xs"
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
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Cetak Ulang Struk Thermal"
              >
                <Printer size={13} />
              </button>
              {order.customerPhone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendStatusWhatsApp(order);
                  }}
                  className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                  title="Kirim Update Status WhatsApp"
                >
                  <MessageSquare size={13} />
                </button>
              )}
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

          <div className="mt-1.5 font-bold text-slate-900 text-sm">
            {order.customerName}
          </div>
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="text-[11px] text-slate-500 hover:text-cyan-700 font-mono mt-0.5 inline-flex items-center gap-1"
            >
              <Phone size={10} /> {order.customerPhone}
            </a>
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
              <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 border border-cyan-300 font-black shadow-2xs">
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
              Rp {totalAmount.toLocaleString('id-ID')}
            </div>
            <div className={`text-[10px] font-bold ${isLunas ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isLunas ? 'LUNAS' : `Sisa Rp ${unpaid.toLocaleString('id-ID')}`}
            </div>
          </div>

          {/* Tombol Lanjut ke Tahap Berikutnya (Touch Target Nyaman) */}
          {colId === 'RECEIVED' && (
            <button
              onClick={() => handleTransitionStatus(order, 'WASHING')}
              className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-xs transition-all border border-blue-200 flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <span>Cuci</span>
              <ArrowRight size={13} />
            </button>
          )}

          {colId === 'WASHING' && (
            <button
              onClick={() => handleTransitionStatus(order, 'DRYING')}
              className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white font-bold text-xs transition-all border border-sky-200 flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <span>Keringkan</span>
              <ArrowRight size={13} />
            </button>
          )}

          {colId === 'DRYING' && (
            <button
              onClick={() => handleTransitionStatus(order, 'IRONING')}
              className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white font-bold text-xs transition-all border border-purple-200 flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <span>Setrika</span>
              <ArrowRight size={13} />
            </button>
          )}

          {colId === 'IRONING' && (
            <button
              onClick={() => handleTransitionStatus(order, 'READY')}
              className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1 active:scale-95"
            >
              <span>Masuk Rak</span>
              <ArrowRight size={13} />
            </button>
          )}

          {colId === 'READY' && (
            <button
              onClick={() => handleTransitionStatus(order, 'COMPLETED')}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1 active:scale-95"
            >
              <span>Serah Terima</span>
              <Check size={13} />
            </button>
          )}

          {colId === 'COMPLETED' && (
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 size={13} /> Selesai
            </span>
          )}
        </div>
      </div>
    );
  };

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
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

      {/* ─── MOBILE STATUS CHIPS TABS (UNTUK APK / SMARTPHONE) ─────────────── */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 shadow-2xs">
        <button
          onClick={() => setMobileStatusTab('ALL')}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            mobileStatusTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span>Semua</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${mobileStatusTab === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {filteredOrders.length}
          </span>
        </button>

        {STATUS_COLUMNS.map(col => {
          const count = columnsData[col.id]?.length || 0;
          const isActive = mobileStatusTab === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setMobileStatusTab(col.id)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isActive
                  ? `${col.badge} shadow-xs ring-1 ring-inset ${col.border}`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{col.label.split('. ')[1] || col.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/80' : 'bg-slate-200 text-slate-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── KANBAN BOARD CONTAINER ────────────────────────────────────────── */}
      {/* 1. Mobile Focused View: Ketika kolom tertentu dipilih di HP */}
      <div className="lg:hidden flex-1 overflow-y-auto p-3 pb-28 bg-slate-100/70">
        {mobileStatusTab === 'ALL' ? (
          <div className="space-y-4">
            {STATUS_COLUMNS.map(col => {
              const colOrders = columnsData[col.id] || [];
              if (colOrders.length === 0) return null;
              const Icon = col.icon;

              return (
                <div key={col.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-lg ${col.bg} ${col.color}`}>
                        <Icon size={14} />
                      </div>
                      <span className="text-xs font-black text-slate-800">{col.label}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.badge}`}>
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {colOrders.map(order => renderOrderCard(order, col.id))}
                  </div>
                </div>
              );
            })}
            {filteredOrders.length === 0 && (
              <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200/80 rounded-2xl bg-white p-4">
                <Shirt size={28} className="text-slate-300 mb-2" />
                Tidak ada pesanan cucian yang sesuai filter
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {STATUS_COLUMNS.filter(c => c.id === mobileStatusTab).map(col => {
              const colOrders = columnsData[col.id] || [];
              const Icon = col.icon;
              return (
                <div key={col.id} className="space-y-2.5">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-xl ${col.bg} ${col.color}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-900">{col.label}</h3>
                        <p className="text-[10px] text-slate-400">Total {colOrders.length} pesanan di tahap ini</p>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${col.badge}`}>
                      {colOrders.length}
                    </span>
                  </div>

                  {colOrders.length === 0 ? (
                    <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200/80 rounded-2xl bg-white p-4">
                      <Shirt size={28} className="text-slate-300 mb-2" />
                      Tidak ada pakaian di tahap {col.label.split('. ')[1] || col.label}
                    </div>
                  ) : (
                    colOrders.map(order => renderOrderCard(order, col.id))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Desktop Kanban Board Columns (Tampil di Laptop / Tablet Landscape) ── */}
      <div className="hidden lg:flex flex-1 overflow-x-auto p-4 gap-4 bg-slate-100/70">
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
                  colOrders.map(order => renderOrderCard(order, col.id))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL ALOKASI RAK SIMPAN (READY MODAL) ────────────────────────── */}
      {readyModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
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

            <div className="py-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                  Pilih Preset Rak Simpan (1-Tap):
                </label>
                {/* Quick Rack Preset Chips */}
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  {['RAK-A1', 'RAK-A2', 'RAK-B1', 'RAK-B2', 'HANGER-01', 'HANGER-02'].map(rk => (
                    <button
                      key={rk}
                      type="button"
                      onClick={() => setSelectedRack(rk)}
                      className={`py-2 px-1 rounded-xl text-xs font-black transition-all border text-center ${
                        selectedRack === rk
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rk}
                    </button>
                  ))}
                </div>

                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                  Atau ketik kustom nomor rak/laci:
                </label>
                <input
                  type="text"
                  value={selectedRack}
                  onChange={e => setSelectedRack(e.target.value.toUpperCase())}
                  placeholder="Contoh: RAK-C3"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Kirim WhatsApp Otomatis Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendWhatsAppOnReady}
                  onChange={e => setSendWhatsAppOnReady(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-1">
                    <MessageSquare size={13} /> Kirim WhatsApp Otomatis Siap Ambil
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Notifikasi ke {readyModalOrder.customerPhone || 'pelanggan'} bahwa cucian sudah wangi & siap diambil di {selectedRack}.
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleConfirmReadyWithRack}
                disabled={isUpdatingStatus}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
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

            {(() => {
              const { totalAmount, paidAmount, unpaid, isLunas } = getEffectiveOrderAmounts(pickupModalOrder);
              return (
                <div className="py-4 space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">No. Order:</span>
                      <span className="font-mono font-bold text-slate-800">{pickupModalOrder.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pelanggan:</span>
                      <span className="font-bold text-slate-800">{pickupModalOrder.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lokasi Rak Simpan:</span>
                      <span className="font-black text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-md">
                        📍 {pickupModalOrder.rackLocation || 'Rak Simpan'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Total Biaya:</span>
                      <span className="font-bold text-slate-800">Rp {totalAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Sudah Dibayar (Di Awal):</span>
                      <span className="font-bold">Rp {paidAmount.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Sisa Tagihan & Kasir Bayar */}
                  {!isLunas ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-amber-900">Sisa yang Wajib Dibayar:</span>
                        <span className="text-base font-black text-rose-600">
                          Rp {unpaid.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                          Metode Pelunasan
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                          {[
                            { id: 'CASH', label: 'Tunai' },
                            { id: 'QRIS', label: 'QRIS' },
                            { id: 'TRANSFER', label: 'Transfer' }
                          ].map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPickupPaymentMethod(m.id as any)}
                              className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                pickupPaymentMethod === m.id
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>

                        <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                          Uang Diterima Kasir (Rp)
                        </label>
                        <input
                          type="number"
                          value={pickupPayAmount}
                          onChange={e => setPickupPayAmount(e.target.value)}
                          placeholder="0"
                          className="w-full text-base font-black px-3 py-2 rounded-xl border border-amber-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 mb-1.5"
                        />

                        {/* Quick Tender Pills */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {[
                            { label: 'Uang Pas', val: unpaid.toString() },
                            { label: '20k', val: '20000' },
                            { label: '50k', val: '50000' },
                            { label: '100k', val: '100000' }
                          ].map((t, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPickupPayAmount(t.val)}
                              className="px-2.5 py-1 rounded-lg bg-amber-200/60 hover:bg-amber-200 text-amber-900 text-xs font-bold border border-amber-300 transition active:scale-95"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {/* Kembalian Tunai */}
                        {pickupPaymentMethod === 'CASH' && parseFloat(pickupPayAmount) > unpaid && (
                          <div className="flex justify-between items-center text-xs font-bold text-emerald-800 bg-emerald-100/80 p-2.5 rounded-xl border border-emerald-300">
                            <span>Kembalian Tunai:</span>
                            <span className="text-sm font-black">
                              Rp {(parseFloat(pickupPayAmount) - unpaid).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={16} /> Nota cucian ini sudah LUNAS!
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleConfirmPickup}
                disabled={isUpdatingStatus}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
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
