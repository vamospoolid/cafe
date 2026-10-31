import React, { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  MapPin,
  Phone,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  QrCode,
  Scale,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  User,
  Sparkles,
  Plus,
  Trash2,
  Camera
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import LaundryPortalQrisModal from './LaundryPortalQrisModal';

interface OrderItem {
  id?: number;
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
  trackingCode?: string;
  customerName: string;
  customerPhone?: string;
  serviceCategory: string;
  serviceSpeed: string;
  perfumeVariant?: string;
  status: string;
  deliveryType: 'WALK_IN' | 'PICKUP_ONLY' | 'DELIVERY_ONLY' | 'FULL_SERVICE';
  pickupStatus?: 'PENDING' | 'PICKING_UP' | 'ARRIVED_AT_OUTLET' | null;
  deliveryStatus?: 'PENDING' | 'ON_DELIVERY' | 'DELIVERED' | null;
  pickupAddress?: string;
  pickupTimeSlot?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  courierName?: string;
  courierPhone?: string;
  pickupFee: number;
  deliveryFee: number;
  subtotal: number;
  speedSurcharge: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentVerificationStatus?: string;
  qrisUniqueAmount?: number;
  intakePhotos?: string[];
  items: OrderItem[];
  createdAt: string;
}

export default function LaundryCourierView() {
  const { token, settings } = usePOS();
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL_DELIVERY' | 'PICKUP' | 'DELIVERY' | 'VERIFY_QRIS'>('ALL_DELIVERY');
  const [showPortalModal, setShowPortalModal] = useState(false);

  // State Assign Kurir Inline
  const [editingCourierId, setEditingCourierId] = useState<string | null>(null);
  const [courierNameInput, setCourierNameInput] = useState('');
  const [courierPhoneInput, setCourierPhoneInput] = useState('');

  // Modal Update Timbangan Aktual Saat Cucian Jemputan Tiba di Outlet
  const [weighModalOrder, setWeighModalOrder] = useState<LaundryOrder | null>(null);
  const [weighItems, setWeighItems] = useState<OrderItem[]>([]);
  const [weighPickupFee, setWeighPickupFee] = useState<number>(0);
  const [weighDeliveryFee, setWeighDeliveryFee] = useState<number>(0);
  const [weighPhotos, setWeighPhotos] = useState<string[]>([]);
  const [savingWeigh, setSavingWeigh] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/laundry/orders?limit=200', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
      }
    } catch (err) {
      toast('Gagal memuat daftar antrean kurir laundry', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, 20000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  const handleUpdateDelivery = async (
    order: LaundryOrder,
    payload: { pickupStatus?: string; deliveryStatus?: string; courierName?: string; courierPhone?: string }
  ) => {
    try {
      const res = await fetch(`/api/laundry/orders/${order.id}/delivery-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Gagal memperbarui status kurir');
      toast('Status kurir antar-jemput berhasil diperbarui!', 'success');
      setEditingCourierId(null);
      fetchOrders();
    } catch (err: any) {
      toast(err.message || 'Gagal memperbarui status kurir', 'error');
    }
  };

  const handleVerifyQris = async (order: LaundryOrder) => {
    try {
      const res = await fetch(`/api/laundry/orders/${order.id}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal verifikasi pembayaran');
      toast(json.message || 'Pembayaran QRIS diverifikasi LUNAS!', 'success');
      fetchOrders();
    } catch (err: any) {
      toast(err.message || 'Gagal memverifikasi pembayaran', 'error');
    }
  };

  const openWeighModal = (order: LaundryOrder) => {
    setWeighModalOrder(order);
    setWeighItems(
      order.items.length > 0
        ? order.items.map(it => ({ ...it }))
        : [{ serviceName: 'Cuci Komplit', unitType: 'KG', qty: 3, pricePerUnit: 8000, subtotal: 24000 }]
    );
    setWeighPickupFee(order.pickupFee || 0);
    setWeighDeliveryFee(order.deliveryFee || 0);
    setWeighPhotos(Array.isArray(order.intakePhotos) ? order.intakePhotos : []);
  };

  const handleCaptureWeighPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 640;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_DIM) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else if (h > MAX_DIM) {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        setWeighPhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.7)].slice(0, 3));
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveWeighUpdate = async () => {
    if (!weighModalOrder) return;
    setSavingWeigh(true);
    try {
      const res = await fetch(`/api/laundry/orders/${weighModalOrder.id}/weigh-update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: weighItems,
          pickupFee: weighPickupFee,
          deliveryFee: weighDeliveryFee,
          intakePhotos: weighPhotos
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan timbangan aktual');
      toast('Timbangan aktual disimpan! Tagihan & QRIS Dinamis pelanggan otomatis diperbarui.', 'success');
      setWeighModalOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast(err.message || 'Gagal memperbarui timbangan aktual', 'error');
    } finally {
      setSavingWeigh(false);
    }
  };

  const sendWhatsAppTracking = (order: LaundryOrder) => {
    if (!order.customerPhone) {
      toast('Nomor WhatsApp pelanggan tidak tersedia', 'warning');
      return;
    }
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const trackUrl = `${window.location.origin}/track/${order.trackingCode}`;
    const storeName = settings?.storeName || 'Laundry Kami';
    const unpaid = Math.max(0, order.totalAmount - (order.paidAmount || 0));

    const text =
      `Halo Kak *${order.customerName}*,\n` +
      `Berikut informasi pesanan Antar-Jemput Laundry Anda di *${storeName}*:\n\n` +
      `No. Order: *${order.orderNumber}*\n` +
      `Total Tagihan: *Rp ${order.totalAmount.toLocaleString('id-ID')}*\n` +
      `Status Bayar: *${order.paymentStatus === 'PAID' ? 'LUNAS' : `Belum Lunas (Rp ${unpaid.toLocaleString('id-ID')})`}*\n\n` +
      `Pantau posisi kurir, lihat foto timbangan pakaian, & bayar via *QRIS Dinamis Otomatis* di link berikut:\n` +
      `${trackUrl}`;

    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const deliveryOrders = orders.filter(
    o => o.deliveryType !== 'WALK_IN' || o.paymentVerificationStatus === 'WAITING_VERIFICATION'
  );

  const filteredOrders = deliveryOrders.filter(o => {
    if (filterTab === 'PICKUP' && o.pickupStatus !== 'PENDING' && o.pickupStatus !== 'PICKING_UP') return false;
    if (filterTab === 'DELIVERY' && o.deliveryStatus !== 'PENDING' && o.deliveryStatus !== 'ON_DELIVERY') return false;
    if (filterTab === 'VERIFY_QRIS' && o.paymentVerificationStatus !== 'WAITING_VERIFICATION') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.pickupAddress || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countPendingPickup = deliveryOrders.filter(
    o => o.pickupStatus === 'PENDING' || o.pickupStatus === 'PICKING_UP'
  ).length;
  const countReadyDelivery = deliveryOrders.filter(
    o => (o.status === 'READY' || o.deliveryStatus === 'ON_DELIVERY') && o.deliveryStatus !== 'DELIVERED'
  ).length;
  const countWaitingQris = orders.filter(o => o.paymentVerificationStatus === 'WAITING_VERIFICATION' && o.paymentStatus !== 'PAID').length;

  return (
    <div className="flex flex-col h-full w-full bg-[#F4F7FE] text-slate-800 overflow-y-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Bike size={24} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">Manajemen Kurir Antar-Jemput & Customer App</h1>
            <p className="text-xs text-slate-500">
              Kelola penjemputan cucian kotor, update timbangan aktual, pengantaran cucian bersih, & QRIS Dinamis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPortalModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <QrCode size={15} />
            <span>Pengaturan Ongkir, Link App & QRIS Dinamis</span>
          </button>
          <button
            type="button"
            onClick={fetchOrders}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Order Kurir</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{deliveryOrders.length}</div>
          <span className="text-[11px] text-blue-600 font-semibold">Jemput & Antar Aktif</span>
        </div>
        <div className="bg-white rounded-2xl border border-cyan-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-cyan-700 uppercase">Antrean Penjemputan</span>
          <div className="text-2xl font-black text-cyan-600 mt-1">{countPendingPickup}</div>
          <span className="text-[11px] text-slate-500">Menunggu kurir jemput ke rumah</span>
        </div>
        <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-700 uppercase">Siap / Sedang Diantar</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">{countReadyDelivery}</div>
          <span className="text-[11px] text-slate-500">Cucian bersih siap kirim</span>
        </div>
        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase">Konfirmasi QRIS Masuk</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{countWaitingQris}</div>
          <span className="text-[11px] text-slate-500">Menunggu verifikasi 1-klik</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL_DELIVERY', label: 'Semua Antar-Jemput' },
            { id: 'PICKUP', label: `Penjemputan (${countPendingPickup})` },
            { id: 'DELIVERY', label: `Pengantaran (${countReadyDelivery})` },
            { id: 'VERIFY_QRIS', label: `Verifikasi QRIS (${countWaitingQris})` }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTab(t.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                filterTab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama, no HP, alamat, order ID..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Daftar Kartu Order Kurir */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Bike size={36} className="mx-auto mb-2 stroke-[1.5]" />
          <p className="text-sm font-bold text-slate-700">Belum ada antrean kurir pada filter ini</p>
          <p className="text-xs text-slate-400 mt-1">
            Bagikan link Customer App Laundry agar pelanggan dapat memesan penjemputan kurir secara online.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map(ord => {
            const unpaid = Math.max(0, ord.totalAmount - (ord.paidAmount || 0));
            const isPaid = ord.paymentStatus === 'PAID' || unpaid <= 0;

            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 font-mono">{ord.orderNumber}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                          {ord.deliveryType === 'FULL_SERVICE'
                            ? '🛵 Jemput & Antar'
                            : ord.deliveryType === 'PICKUP_ONLY'
                            ? '🛵 Jemput Saja'
                            : '🛵 Antar Saja'}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 mt-1">
                        {ord.customerName} {ord.customerPhone ? `• ${ord.customerPhone}` : ''}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isPaid ? 'LUNAS' : `Belum Lunas Rp ${unpaid.toLocaleString('id-ID')}`}
                    </span>
                  </div>

                  {/* Alamat & Jadwal */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">
                          {ord.pickupAddress || ord.deliveryAddress || 'Alamat belum diisi'}
                        </span>
                        {ord.deliveryNotes && (
                          <p className="text-[11px] text-slate-500 italic">Patokan: "{ord.deliveryNotes}"</p>
                        )}
                      </div>
                    </div>
                    {ord.pickupTimeSlot && (
                      <div className="text-[11px] font-bold text-blue-600 pl-5">
                        ⏰ Jadwal Jemput: {ord.pickupTimeSlot}
                      </div>
                    )}
                  </div>

                  {/* Rincian Biaya Cucian + Ongkir */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50/70 rounded-xl p-2 border border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Biaya Jemput</span>
                      <span className="font-extrabold text-cyan-700">
                        Rp {(ord.pickupFee || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="border-x border-slate-200">
                      <span className="text-slate-400 block">Biaya Antar</span>
                      <span className="font-extrabold text-indigo-700">
                        Rp {(ord.deliveryFee || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Total Tagihan</span>
                      <span className="font-black text-slate-900">
                        Rp {ord.totalAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Info Kurir Penugas */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="text-slate-600">
                      Kurir:{' '}
                      <strong className="text-slate-900">
                        {ord.courierName ? `${ord.courierName} (${ord.courierPhone || '-'})` : 'Belum ditugaskan'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCourierId(editingCourierId === ord.id ? null : ord.id);
                        setCourierNameInput(ord.courierName || '');
                        setCourierPhoneInput(ord.courierPhone || '');
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {ord.courierName ? 'Ubah Kurir' : '+ Tugaskan Kurir'}
                    </button>
                  </div>

                  {editingCourierId === ord.id && (
                    <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-xl border border-blue-200">
                      <input
                        type="text"
                        placeholder="Nama Kurir"
                        value={courierNameInput}
                        onChange={e => setCourierNameInput(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                      />
                      <input
                        type="tel"
                        placeholder="No. WA Kurir"
                        value={courierPhoneInput}
                        onChange={e => setCourierPhoneInput(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDelivery(ord, {
                            courierName: courierNameInput,
                            courierPhone: courierPhoneInput
                          })
                        }
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Simpan
                      </button>
                    </div>
                  )}
                </div>

                {/* Tombol Aksi Kurir & Timbangan */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {ord.pickupStatus === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateDelivery(ord, { pickupStatus: 'PICKING_UP' })}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-extrabold cursor-pointer"
                      >
                        🛵 Berangkat Jemput
                      </button>
                    )}

                    {(ord.pickupStatus === 'PENDING' || ord.pickupStatus === 'PICKING_UP') && (
                      <button
                        type="button"
                        onClick={() => openWeighModal(ord)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Scale size={13} /> Tiba & Input Timbangan Aktual
                      </button>
                    )}

                    {ord.deliveryStatus !== 'ON_DELIVERY' && ord.deliveryStatus !== 'DELIVERED' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateDelivery(ord, { deliveryStatus: 'ON_DELIVERY' })}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
                      >
                        🛵 Kirim Cucian Bersih
                      </button>
                    )}

                    {ord.deliveryStatus === 'ON_DELIVERY' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateDelivery(ord, { deliveryStatus: 'DELIVERED' })}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                      >
                        ✅ Selesai Terkirim
                      </button>
                    )}

                    {!isPaid && ord.paymentVerificationStatus === 'WAITING_VERIFICATION' && (
                      <button
                        type="button"
                        onClick={() => handleVerifyQris(ord)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                      >
                        ✅ Terima Lunas QRIS
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => sendWhatsAppTracking(ord)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Kirim Link Live Tracking & QRIS Dinamis ke WA Pelanggan"
                    >
                      <MessageCircle size={13} /> WA Link QRIS
                    </button>
                    {ord.trackingCode && (
                      <a
                        href={`/track/${ord.trackingCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                        title="Buka Halaman Tracking Pelanggan"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Input Timbangan Aktual Saat Kurir Tiba di Outlet */}
      {weighModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">
                  Update Timbangan Aktual — #{weighModalOrder.orderNumber}
                </h3>
                <p className="text-[11px] text-blue-100">
                  Begitu disimpan, tagihan & QRIS Dinamis di HP {weighModalOrder.customerName} otomatis diperbarui!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeighModalOrder(null)}
                className="px-2 py-1 rounded-lg hover:bg-white/20 text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              {weighItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    value={it.serviceName}
                    onChange={e => {
                      const next = [...weighItems];
                      next[idx].serviceName = e.target.value;
                      setWeighItems(next);
                    }}
                    className="col-span-5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={it.qty}
                    onChange={e => {
                      const next = [...weighItems];
                      next[idx].qty = parseFloat(e.target.value) || 0;
                      next[idx].subtotal = Math.round(next[idx].qty * next[idx].pricePerUnit);
                      setWeighItems(next);
                    }}
                    className="col-span-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-center"
                  />
                  <input
                    type="number"
                    step="500"
                    value={it.pricePerUnit}
                    onChange={e => {
                      const next = [...weighItems];
                      next[idx].pricePerUnit = parseFloat(e.target.value) || 0;
                      next[idx].subtotal = Math.round(next[idx].qty * next[idx].pricePerUnit);
                      setWeighItems(next);
                    }}
                    className="col-span-3 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold"
                  />
                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setWeighItems(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setWeighItems(prev => [
                    ...prev,
                    { serviceName: 'Layanan Tambahan', unitType: 'KG', qty: 1, pricePerUnit: 8000, subtotal: 8000 }
                  ])
                }
                className="text-xs font-bold text-blue-600 flex items-center gap-1"
              >
                <Plus size={13} /> Tambah Baris Item
              </button>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Biaya Jemput (Rp)</label>
                  <input
                    type="number"
                    value={weighPickupFee}
                    onChange={e => setWeighPickupFee(Number(e.target.value) || 0)}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Biaya Antar (Rp)</label>
                  <input
                    type="number"
                    value={weighDeliveryFee}
                    onChange={e => setWeighDeliveryFee(Number(e.target.value) || 0)}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
                  <Camera size={14} /> Upload Foto Bukti Timbangan / Pakaian ({weighPhotos.length}/3)
                  <input type="file" accept="image/*" onChange={handleCaptureWeighPhoto} className="hidden" />
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWeighModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingWeigh}
                onClick={handleSaveWeighUpdate}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
              >
                {savingWeigh ? 'Menyimpan...' : 'Simpan Timbangan & Update QRIS Pelanggan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfigurasi Portal Pelanggan & QRIS Dinamis */}
      <LaundryPortalQrisModal
        isOpen={showPortalModal}
        onClose={() => setShowPortalModal(false)}
        token={token || ''}
      />
    </div>
  );
}

