import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shirt,
  Bike,
  MapPin,
  Phone,
  Sparkles,
  Clock,
  CheckCircle2,
  Search,
  CreditCard,
  Scale,
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Package,
  AlertCircle,
  User,
  Calendar,
  FileText
} from 'lucide-react';

interface DeliveryZone {
  id: string;
  name: string;
  pickupFee: number;
  deliveryFee: number;
  description?: string;
}

interface CatalogService {
  id: string;
  name: string;
  unitType: 'KG' | 'PCS' | 'PSG' | 'METER';
  price: number;
  category: string;
}

interface StoreData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string;
    address: string;
    logoUrl: string;
  };
  deliveryZones: DeliveryZone[];
  services: CatalogService[];
  perfumeVariants: string[];
  speedOptions: Array<{ code: string; label: string; multiplier: number }>;
}

export default function LaundryCustomerPortal() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'BOOK' | 'TRACK' | 'MEMBER'>('BOOK');

  // Booking State
  const [deliveryType, setDeliveryType] = useState<'FULL_SERVICE' | 'PICKUP_ONLY' | 'DELIVERY_ONLY'>('FULL_SERVICE');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [estimatedQty, setEstimatedQty] = useState<number>(3);
  const [serviceSpeed, setServiceSpeed] = useState<string>('REGULAR');
  const [perfumeVariant, setPerfumeVariant] = useState<string>('Sakura');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [pickupTimeSlot, setPickupTimeSlot] = useState<string>('Segera (Hari Ini)');
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Lookup State (Track & Member)
  const [lookupInput, setLookupInput] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupResult, setLookupResult] = useState<{ customer: any; orders: any[] } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStore = async () => {
      setLoading(true);
      try {
        const slug = tenantSlug || 'demo';
        const res = await fetch(`/api/laundry/public/store/${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Outlet Laundry tidak ditemukan');
        }
        setStore(json);
        if (json.deliveryZones?.length > 0) {
          setSelectedZoneId(json.deliveryZones[0].id);
        }
        if (json.services?.length > 0) {
          setSelectedServiceId(json.services[0].id);
        }
        if (json.perfumeVariants?.length > 0) {
          setPerfumeVariant(json.perfumeVariants[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memuat halaman toko laundry');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [tenantSlug]);

  const activeZone = store?.deliveryZones.find(z => z.id === selectedZoneId) || store?.deliveryZones[0];
  const activeService = store?.services.find(s => s.id === selectedServiceId) || store?.services[0];

  const currentPickupFee =
    deliveryType === 'FULL_SERVICE' || deliveryType === 'PICKUP_ONLY'
      ? activeZone?.pickupFee || 0
      : 0;

  const currentDeliveryFee =
    deliveryType === 'FULL_SERVICE' || deliveryType === 'DELIVERY_ONLY'
      ? activeZone?.deliveryFee || 0
      : 0;

  const estimatedLaundrySubtotal = Math.round((estimatedQty || 1) * (activeService?.price || 8000));
  const speedMultiplier = serviceSpeed === 'EXPRESS_6H' ? 1 : serviceSpeed === 'KILAT_24H' ? 0.5 : 0;
  const speedSurcharge = Math.round(estimatedLaundrySubtotal * speedMultiplier);
  const estimatedGrandTotal = estimatedLaundrySubtotal + speedSurcharge + currentPickupFee + currentDeliveryFee;

  const handleBookPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || submitting) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Mohon lengkapi Nama dan Nomor WhatsApp Anda.');
      return;
    }
    if (!pickupAddress.trim()) {
      alert('Mohon isi alamat lengkap penjemputan/pengantaran.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/laundry/public/book-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: store.tenant.slug || tenantSlug || 'demo',
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryType,
          pickupFee: currentPickupFee,
          deliveryFee: currentDeliveryFee,
          pickupAddress: pickupAddress.trim(),
          deliveryAddress: pickupAddress.trim(),
          deliveryNotes: deliveryNotes.trim(),
          pickupTimeSlot,
          serviceCategory: activeService?.category || 'KILOAN',
          serviceSpeed,
          perfumeVariant,
          specialNotes: specialNotes.trim(),
          items: [
            {
              serviceName: activeService?.name || 'Cuci Komplit',
              unitType: activeService?.unitType || 'KG',
              qty: estimatedQty || 1,
              pricePerUnit: activeService?.price || 8000
            }
          ]
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal mengirim pesanan penjemputan');
      }

      if (json.trackingCode) {
        navigate(`/track/${json.trackingCode}`);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses permintaan penjemputan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = lookupInput.trim();
    if (!q) return;

    // Jika yang diketik adalah kode tracking (misal LND-XXXX), langsung buka halaman tracking
    if (q.toUpperCase().startsWith('LND-') || (q.length >= 6 && /^[A-Z0-9-]+$/i.test(q) && !/^[0-9+]+$/.test(q))) {
      navigate(`/track/${q.toUpperCase()}`);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    try {
      const slug = store?.tenant.slug || tenantSlug || 'demo';
      const res = await fetch(
        `/api/laundry/public/customer-lookup?tenantSlug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(q)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal mencari data pelanggan');
      }
      setLookupResult(json);
    } catch (err: any) {
      setLookupError(err.message || 'Terjadi kesalahan saat mencari data');
    } finally {
      setLookupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold">Memuat Aplikasi Pelanggan Laundry...</h2>
        <p className="text-xs text-slate-400 mt-1">Menyiapkan layanan antar-jemput & pelacakan cucian</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold">Outlet Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center selection:bg-cyan-500 selection:text-slate-950">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-900 border-x border-slate-800 shadow-2xl pb-16">
        {/* Header Outlet */}
        <header className="p-5 bg-gradient-to-br from-cyan-950/90 via-slate-900 to-slate-900 border-b border-slate-800 sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {store.tenant.logoUrl ? (
                <img
                  src={store.tenant.logoUrl}
                  alt={store.tenant.name}
                  className="w-11 h-11 rounded-2xl object-cover border border-cyan-500/30 shadow-md"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-600/20">
                  {store.tenant.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-base font-black text-white leading-tight">{store.tenant.name}</h1>
                <p className="text-[11px] font-bold text-cyan-400 flex items-center gap-1 mt-0.5">
                  <Bike size={12} /> Portal Antar-Jemput & Live Tracking
                </p>
              </div>
            </div>

            {store.tenant.phone && (
              <a
                href={`https://wa.me/${store.tenant.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-emerald-500/25 transition"
              >
                <MessageCircle size={14} /> WA Toko
              </a>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1.5 mt-4 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('BOOK')}
              className={`py-2 px-2 rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'BOOK'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bike size={13} /> Antar-Jemput
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRACK')}
              className={`py-2 px-2 rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'TRACK'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search size={13} /> Status Cuci
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('MEMBER')}
              className={`py-2 px-2 rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'MEMBER'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard size={13} /> Kuota Member
            </button>
          </div>
        </header>

        {/* ─── TAB 1: ORDER PENJEMPUTAN & PENGANTARAN ──────────────────────── */}
        {activeTab === 'BOOK' && (
          <form onSubmit={handleBookPickup} className="p-5 space-y-5">
            {/* Step 1: Pilih Mode Jemput / Antar */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Bike size={15} /> 1. Pilih Layanan Kurir & Ongkir
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    code: 'FULL_SERVICE',
                    title: 'Jemput & Antar',
                    sub: 'Pulang - Pergi'
                  },
                  {
                    code: 'PICKUP_ONLY',
                    title: 'Jemput Saja',
                    sub: 'Ambil di Toko'
                  },
                  {
                    code: 'DELIVERY_ONLY',
                    title: 'Antar Saja',
                    sub: 'Drop ke Toko'
                  }
                ].map(opt => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setDeliveryType(opt.code as any)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      deliveryType === opt.code
                        ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-inner'
                        : 'bg-slate-900/60 border-slate-700/70 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="text-xs font-black">{opt.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>

              {/* Pilih Zona Jarak */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-300 mb-2">
                  Pilih Jarak / Zona Lokasi Anda:
                </label>
                <div className="space-y-2">
                  {store.deliveryZones.map(zone => {
                    const isSelected = zone.id === selectedZoneId;
                    return (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(zone.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500/80 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-extrabold">{zone.name}</p>
                          {zone.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{zone.description}</p>
                          )}
                        </div>
                        <div className="text-right text-[10px] font-bold space-y-0.5">
                          <div className="text-cyan-300">
                            Jemput: {zone.pickupFee === 0 ? 'GRATIS' : `Rp ${zone.pickupFee.toLocaleString('id-ID')}`}
                          </div>
                          <div className="text-indigo-300">
                            Antar: {zone.deliveryFee === 0 ? 'GRATIS' : `Rp ${zone.deliveryFee.toLocaleString('id-ID')}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ringkasan Biaya Jemput & Antar */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between pr-2 border-r border-slate-800">
                  <span className="text-slate-400">Biaya Jemput:</span>
                  <span className="font-extrabold text-cyan-400">
                    {currentPickupFee === 0 ? 'Rp 0' : `Rp ${currentPickupFee.toLocaleString('id-ID')}`}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-2">
                  <span className="text-slate-400">Biaya Antar:</span>
                  <span className="font-extrabold text-indigo-400">
                    {currentDeliveryFee === 0 ? 'Rp 0' : `Rp ${currentDeliveryFee.toLocaleString('id-ID')}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Pilih Layanan Cuci, Kecepatan & Parfum */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 space-y-3.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Shirt size={15} /> 2. Pilih Layanan & Aroma Parfum
              </h2>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Jenis Layanan Cucian</label>
                <select
                  value={selectedServiceId}
                  onChange={e => setSelectedServiceId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:border-cyan-500 outline-none"
                >
                  {store.services.map(srv => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} — Rp {srv.price.toLocaleString('id-ID')} / {srv.unitType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                    Estimasi ({activeService?.unitType || 'KG'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={estimatedQty}
                    onChange={e => setEstimatedQty(Math.max(0.5, parseFloat(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-extrabold text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Aroma Parfum</label>
                  <select
                    value={perfumeVariant}
                    onChange={e => setPerfumeVariant(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-cyan-500 outline-none"
                  >
                    {store.perfumeVariants.map(pf => (
                      <option key={pf} value={pf}>
                        🌸 {pf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Kecepatan Selesai</label>
                <div className="grid grid-cols-3 gap-2">
                  {store.speedOptions.map(sp => (
                    <button
                      key={sp.code}
                      type="button"
                      onClick={() => setServiceSpeed(sp.code)}
                      className={`p-2 rounded-xl border text-[11px] font-extrabold transition ${
                        serviceSpeed === sp.code
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Alamat & Waktu Penjemputan */}
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <MapPin size={15} /> 3. Data Pemesan & Alamat Jemput/Antar
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Nama Anda *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">No. WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0812xxxxxxx"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Alamat Lengkap Penjemputan / Pengantaran *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Nama Jalan, No. Rumah, RT/RW, Komplek/Perumahan..."
                  value={pickupAddress}
                  onChange={e => setPickupAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Waktu Penjemputan</label>
                  <select
                    value={pickupTimeSlot}
                    onChange={e => setPickupTimeSlot(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-cyan-500 outline-none"
                  >
                    <option value="Segera (Hari Ini)">⚡ Segera (Hari Ini)</option>
                    <option value="Pagi (08:00 - 11:00)">🌅 Pagi (08:00 - 11:00)</option>
                    <option value="Siang (12:00 - 15:00)">☀️ Siang (12:00 - 15:00)</option>
                    <option value="Sore (16:00 - 19:00)">🌇 Sore (16:00 - 19:00)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Patokan Rumah</label>
                  <input
                    type="text"
                    placeholder="Pagar hitam / dekat masjid"
                    value={deliveryNotes}
                    onChange={e => setDeliveryNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Catatan Khusus Pakaian (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Pisahkan baju putih, ada noda kopi di kemeja..."
                  value={specialNotes}
                  onChange={e => setSpecialNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Estimasi Biaya & Submit */}
            <div className="bg-gradient-to-br from-cyan-950/80 to-indigo-950/80 border border-cyan-500/40 rounded-2xl p-4 space-y-2.5 shadow-xl">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Estimasi Cucian ({estimatedQty} {activeService?.unitType})</span>
                  <span>Rp {estimatedLaundrySubtotal.toLocaleString('id-ID')}</span>
                </div>
                {speedSurcharge > 0 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Biaya Kilat/Express</span>
                    <span>+ Rp {speedSurcharge.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-cyan-300">
                  <span>Biaya Penjemputan Kurir</span>
                  <span>+ Rp {currentPickupFee.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-indigo-300">
                  <span>Biaya Pengantaran Kurir</span>
                  <span>+ Rp {currentDeliveryFee.toLocaleString('id-ID')}</span>
                </div>
                <div className="pt-2 border-t border-slate-700/80 flex justify-between text-sm font-black text-white">
                  <span>Total Estimasi</span>
                  <span className="text-cyan-400">Rp {estimatedGrandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                💡 <strong>Transparan & Akurat:</strong> Tagihan final & <strong>QRIS Dinamis Otomatis</strong> akan muncul di layar pelacakan Anda setelah pakaian ditimbang secara aktual oleh petugas outlet.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {submitting ? 'Memproses Pesanan...' : '🛵 Panggil Kurir & Lacak Status Sekarang'}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}

        {/* ─── TAB 2 & 3: CEK STATUS CUCIAN & SALDO KUOTA MEMBER ──────────── */}
        {(activeTab === 'TRACK' || activeTab === 'MEMBER') && (
          <div className="p-5 space-y-4">
            <form onSubmit={handleLookup} className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                {activeTab === 'TRACK' ? (
                  <>
                    <Search size={15} /> Lacak Status Cucian & Pengantaran
                  </>
                ) : (
                  <>
                    <CreditCard size={15} /> Cek Sisa Kuota Kg & Saldo Deposit
                  </>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeTab === 'TRACK'
                  ? 'Masukkan Nomor WhatsApp Anda atau Kode Resi (LND-xxxx) untuk memantau progres cucian dan membayar via QRIS Dinamis.'
                  : 'Masukkan Nomor WhatsApp yang terdaftar di outlet untuk melihat sisa Paket Kuota Kg dan Saldo Deposit Anda.'}
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={activeTab === 'TRACK' ? 'No. WhatsApp (0812...) atau Kode LND-...' : 'Masukkan No. WhatsApp (0812...)'}
                  value={lookupInput}
                  onChange={e => setLookupInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:border-cyan-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-extrabold transition"
                >
                  {lookupLoading ? '...' : 'Cek'}
                </button>
              </div>
            </form>

            {lookupError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="space-y-4">
                {/* Kartu Saldo Member */}
                {lookupResult.customer ? (
                  <div className="bg-gradient-to-br from-indigo-950/90 via-slate-900 to-cyan-950/80 border border-cyan-500/40 rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Member {lookupResult.customer.tier || 'REGULAR'}
                        </span>
                        <h3 className="text-sm font-black text-white mt-1">{lookupResult.customer.name}</h3>
                        <p className="text-[11px] text-slate-400">{lookupResult.customer.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Poin Loyalitas</p>
                        <p className="text-sm font-black text-amber-400">{lookupResult.customer.points || 0} Pts</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800">
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Sisa Paket Kuota</p>
                        <p className="text-lg font-black text-cyan-400 mt-0.5">
                          {(lookupResult.customer.laundryQuotaKg || 0).toFixed(1)} Kg
                        </p>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Saldo Deposit</p>
                        <p className="text-lg font-black text-emerald-400 mt-0.5">
                          Rp {(lookupResult.customer.laundryDeposit || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400 text-center">
                    Nomor WhatsApp belum terdaftar sebagai Member Paket Kuota/Deposit.
                  </div>
                )}

                {/* Daftar Pesanan Aktif & Riwayat */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Daftar Nota Cucian ({lookupResult.orders.length})
                  </h3>

                  {lookupResult.orders.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-800 text-center text-xs text-slate-400">
                      Belum ada riwayat cucian untuk nomor WhatsApp ini.
                    </div>
                  ) : (
                    lookupResult.orders.map((ord: any) => (
                      <div
                        key={ord.id}
                        onClick={() => ord.trackingCode && navigate(`/track/${ord.trackingCode}`)}
                        className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/70 rounded-2xl p-4 cursor-pointer transition space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-white font-mono">{ord.orderNumber}</p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(ord.createdAt).toLocaleString('id-ID', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              ord.paymentStatus === 'PAID'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {ord.paymentStatus === 'PAID' ? 'LUNAS' : 'BELUM LUNAS'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                          <div>
                            <span className="text-slate-400">Status Cuci: </span>
                            <span className="font-extrabold text-cyan-400">{ord.status}</span>
                          </div>
                          <div className="font-black text-white">
                            Rp {(ord.totalAmount || 0).toLocaleString('id-ID')}
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[11px] font-bold text-indigo-400">
                          <span>Buka Live Tracking & QRIS Dinamis</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

