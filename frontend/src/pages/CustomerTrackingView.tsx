import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Utensils,
  Shirt,
  Bike,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  ChefHat,
  Package,
  Layers,
  ChevronRight,
  RefreshCw,
  QrCode,
  Download,
  Camera,
  Upload,
  Zap
} from 'lucide-react';

interface TrackingData {
  vertical: 'CAFE' | 'LAUNDRY';
  trackingCode: string;
  orderNumber: string;
  customerName: string;
  orderType?: string;
  deliveryType?: string;
  deliveryStatus?: string;
  pickupStatus?: string;
  kdsStatus?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentVerificationStatus?: string;
  paymentProofImage?: string | null;
  qrisUniqueCode?: number;
  qrisUniqueAmount?: number;
  quotaKgUsed?: number;
  depositUsed?: number;
  intakePhotos?: string[] | null;
  paidAt?: string;
  pickupAddress?: string;
  pickupTimeSlot?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  pickupFee?: number;
  deliveryFee: number;
  courierType?: string;
  courierName?: string;
  courierPhone?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceCharge?: number;
  total?: number;
  totalAmount?: number;
  paidAmount?: number;
  speedSurcharge?: number;
  perfumeVariant?: string;
  serviceSpeed?: string;
  serviceCategory?: string;
  rackLocation?: string;
  createdAt: string;
  tenant?: {
    name: string;
    logoUrl?: string;
    phone?: string;
    slug?: string;
  };
  items: Array<{
    name?: string;
    serviceName?: string;
    imageUrl?: string;
    qty: number;
    price?: number;
    pricePerUnit?: number;
    subtotal: number;
    notes?: string;
    unitType?: string;
  }>;
}

interface DynamicQrisPayload {
  orderNumber: string;
  trackingCode: string;
  baseAmount: number;
  pickupFee: number;
  deliveryFee: number;
  uniqueCode: number;
  qrisUniqueAmount: number;
  qrisDynamicString: string;
  hasCustomQris: boolean;
  merchantName: string;
}

export default function CustomerTrackingView() {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [snapReady, setSnapReady] = useState(false);

  // Laundry Dynamic QRIS (EMVCo CRC-16) State
  const [qrisData, setQrisData] = useState<DynamicQrisPayload | null>(null);
  const [qrisLoading, setQrisLoading] = useState(false);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // 1. Fetch initial tracking details
  const fetchTracking = async () => {
    if (!trackingCode) return;
    try {
      const res = await fetch(`/api/tracking/public/${trackingCode}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Pesanan tidak ditemukan');
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat status pelacakan');
    } finally {
      setLoading(false);
    }
  };

  // Fetch / Generate EMVCo Dynamic QRIS for Laundry
  const generateLaundryDynamicQris = async () => {
    if (!trackingCode || qrisLoading) return;
    setQrisLoading(true);
    try {
      const res = await fetch(`/api/laundry/public/generate-qris/${encodeURIComponent(trackingCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (res.ok && !json.alreadyPaid && json.qrisDynamicString) {
        setQrisData(json);
      }
    } catch (err) {
      console.warn('[Dynamic QRIS Fetch Warning]:', err);
    } finally {
      setQrisLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [trackingCode]);

  // Auto-generate Dynamic QRIS when Laundry order is unpaid
  useEffect(() => {
    if (data && data.vertical === 'LAUNDRY' && data.paymentStatus !== 'PAID') {
      generateLaundryDynamicQris();
    }
  }, [data?.vertical, data?.paymentStatus, data?.totalAmount, data?.paidAmount]);

  // 2. Load Midtrans Snap SDK Dynamically
  useEffect(() => {
    const scriptId = 'midtrans-snap-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', 'SB-Mid-client-codenusa');
      script.onload = () => setSnapReady(true);
      document.body.appendChild(script);
    } else {
      setSnapReady(true);
    }
  }, []);

  // 3. Setup WebSocket connection for isolated real-time updates
  useEffect(() => {
    if (!trackingCode) return;
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('join:tracking', trackingCode);
    });

    socket.on('tracking:updated', (payload: any) => {
      setData(prev => (prev ? { ...prev, ...payload } : null));
    });

    socket.on('payment:success', (payload: any) => {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: payload.status || prev.status,
          paymentStatus: 'PAID',
          paymentVerificationStatus: payload.paymentVerificationStatus || 'AUTO_VERIFIED',
          paidAt: payload.paidAt || new Date().toISOString(),
          paymentMethod: payload.paymentMethod || prev.paymentMethod || 'QRIS_DINAMIS_AUTO'
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [trackingCode]);

  // Handle Pay via Midtrans Snap
  const handlePayNow = async () => {
    if (!trackingCode || isPaying) return;
    setIsPaying(true);
    try {
      const res = await fetch('/api/payments/public/charge-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingCode })
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Gagal menyiapkan pembayaran online');
      }

      if (resJson.snapToken && (window as any).snap) {
        (window as any).snap.pay(resJson.snapToken, {
          onSuccess: () => fetchTracking(),
          onPending: () => fetchTracking(),
          onError: (result: any) => console.error('Payment Error:', result),
          onClose: () => fetchTracking()
        });
      } else if (resJson.snapRedirectUrl) {
        window.location.href = resJson.snapRedirectUrl;
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setIsPaying(false);
    }
  };

  // Download QRIS Image for M-Banking Gallery Scan
  const handleDownloadQrisImage = async () => {
    if (!qrisData) return;
    try {
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=16&data=${encodeURIComponent(
        qrisData.qrisDynamicString
      )}`;
      const response = await fetch(qrImgUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QRIS-${qrisData.orderNumber}-Rp${qrisData.qrisUniqueAmount}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Gagal mengunduh gambar QRIS:', err);
    }
  };

  // Fallback Manual Confirmation / Upload Proof
  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !trackingCode) return;
    setUploadingProof(true);
    try {
      const compressedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 900;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };
          img.onerror = reject;
          img.src = String(ev.target?.result || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/laundry/public/confirm-payment/${encodeURIComponent(trackingCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentProofImage: compressedBase64 })
      });
      if (res.ok) {
        fetchTracking();
        setShowProofUpload(false);
      }
    } catch (err) {
      alert('Gagal mengunggah bukti pembayaran.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmWithoutPhoto = async () => {
    if (!trackingCode) return;
    setUploadingProof(true);
    try {
      const res = await fetch(`/api/laundry/public/confirm-payment/${encodeURIComponent(trackingCode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        fetchTracking();
      }
    } finally {
      setUploadingProof(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold">Memuat Status Pesanan...</h2>
        <p className="text-xs text-slate-400 mt-1">Menghubungkan ke sistem pelacakan langsung</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Pesanan Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          {error || 'Kode pelacakan tidak valid atau pesanan telah diarsipkan oleh merchant.'}
        </p>
        <button
          onClick={fetchTracking}
          className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
        >
          <RefreshCw size={14} /> Coba Muat Ulang
        </button>
      </div>
    );
  }

  const isCafe = data.vertical === 'CAFE';
  const finalTotal = isCafe ? data.total || 0 : data.totalAmount || 0;
  const paidSoFar = data.paidAmount || 0;
  const remainingBalance = isCafe ? finalTotal : Math.max(0, finalTotal - paidSoFar);
  const isPaid =
    (isCafe && (data.status === 'Paid' || data.paymentStatus === 'PAID')) ||
    (!isCafe && (data.paymentStatus === 'PAID' || remainingBalance <= 0));

  // Step Calculation for Cafe
  const getCafeStep = () => {
    if (data.deliveryStatus === 'DELIVERED' || (data.status === 'Paid' && data.kdsStatus === 'Served')) return 4;
    if (data.deliveryStatus === 'ON_DELIVERY') return 3;
    if (data.kdsStatus === 'Ready' || data.deliveryStatus === 'READY') return 2;
    if (data.kdsStatus === 'Cooking' || data.deliveryStatus === 'COOKING') return 1;
    return 0;
  };

  // Step Calculation for Laundry (Including Pickup & Delivery)
  const getLaundryStep = () => {
    if (data.status === 'COMPLETED' || data.deliveryStatus === 'DELIVERED') return 6;
    if (data.deliveryStatus === 'ON_DELIVERY') return 5;
    if (data.status === 'READY') return 4;
    if (data.status === 'IRONING') return 3;
    if (data.status === 'WASHING' || data.status === 'DRYING') return 2;
    if (data.pickupStatus === 'PENDING' || data.pickupStatus === 'PICKING_UP') return 0;
    return 1; // RECEIVED / ARRIVED_AT_OUTLET
  };

  const currentStep = isCafe ? getCafeStep() : getLaundryStep();

  const cafeSteps = [
    { label: 'Diterima', desc: 'Pesanan masuk sistem', icon: Clock },
    { label: 'Dimasak', desc: 'Dapur sedang mengolah', icon: ChefHat },
    { label: 'Dikemas', desc: 'Siap diantar', icon: Package },
    { label: 'Diantar', desc: 'Kurir menuju lokasi Anda', icon: Bike },
    { label: 'Terkirim', desc: 'Selamat menikmati', icon: CheckCircle2 }
  ];

  const laundrySteps = [
    {
      label: 'Penjemputan / Drop-off',
      desc:
        data.pickupStatus === 'PICKING_UP'
          ? 'Kurir sedang menuju lokasi Anda untuk menjemput cucian'
          : data.pickupStatus === 'PENDING'
          ? 'Menunggu penjemputan kurir ke alamat Anda'
          : 'Cucian telah diserahkan ke outlet',
      icon: Bike
    },
    { label: 'Ditimbang & Dicek', desc: 'Pakaian ditimbang & didokumentasikan di outlet', icon: Clock },
    { label: 'Cuci & Pengeringan', desc: 'Proses pencucian higienis sesuai standar', icon: Shirt },
    { label: 'Setrika Uap & Parfum', desc: 'Disetrika rapi & diberi parfum pilihan', icon: Sparkles },
    { label: 'Siap di Rak Simpan', desc: 'Packing rapi berlabel & siap diantar/diambil', icon: Layers },
    { label: 'Pengantaran Kurir', desc: 'Kurir sedang mengantar cucian bersih ke alamat Anda', icon: Bike },
    { label: 'Selesai Diterima', desc: 'Serah terima cucian tuntas', icon: CheckCircle2 }
  ];

  const activeSteps = isCafe ? cafeSteps : laundrySteps;
  const intakePhotos = Array.isArray(data.intakePhotos) ? data.intakePhotos : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-900 border-x border-slate-800 shadow-2xl relative pb-16">
        {/* Top Header / Store Brand */}
        <header className="p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.tenant?.logoUrl ? (
              <img
                src={data.tenant.logoUrl}
                alt={data.tenant.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-extrabold text-base shadow-md">
                {data.tenant?.name?.charAt(0) || (isCafe ? 'C' : 'L')}
              </div>
            )}
            <div>
              <h1 className="text-sm font-extrabold text-white leading-tight">
                {data.tenant?.name || 'CodePOS Merchant'}
              </h1>
              <span className="text-[10px] font-semibold tracking-wider text-indigo-400 uppercase">
                {isCafe ? '🍔 Cafe & Resto Delivery' : '🧺 Laundry Antar - Jemput'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCafe && (
              <button
                type="button"
                onClick={() => navigate(`/laundry-portal/${data.tenant?.slug || 'demo'}`)}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold hover:bg-cyan-500/20 transition"
              >
                + Order Jemput
              </button>
            )}
            {data.tenant?.phone && (
              <a
                href={`https://wa.me/${data.tenant.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Halo ${data.tenant.name}, saya ingin menanyakan pesanan #${data.orderNumber} (${data.trackingCode})`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition"
                title="Hubungi Toko via WhatsApp"
              >
                <MessageCircle size={15} />
              </a>
            )}
          </div>
        </header>

        {/* Tracking Header Pill */}
        <div className="p-5 pb-3">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between shadow-inner">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. Pesanan / Resi</p>
              <p className="text-sm font-black text-white font-mono mt-0.5">{data.orderNumber}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Kode: {data.trackingCode}</p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                  isPaid
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : data.paymentStatus === 'PARTIAL'
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse'
                }`}
              >
                {isPaid ? <ShieldCheck size={12} /> : <Clock size={12} />}
                {isPaid ? 'Lunas' : data.paymentStatus === 'PARTIAL' ? 'Bayar DP' : 'Belum Lunas'}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                Pemesan: <span className="font-bold text-slate-200">{data.customerName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Courier Alert Card (When Picking Up or On Delivery) */}
        {(data.deliveryStatus === 'ON_DELIVERY' || data.pickupStatus === 'PICKING_UP') && (
          <div className="px-5 mb-3">
            <div className="bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Bike size={20} className="animate-bounce" />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold text-cyan-300">
                    {data.pickupStatus === 'PICKING_UP'
                      ? 'Kurir Sedang Menjemput Cucian Anda!'
                      : 'Kurir Sedang Mengantar Cucian Bersih!'}
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">{data.courierName || 'Kurir Outlet'}</p>
                  {data.courierPhone && <p className="text-[10px] text-slate-400">{data.courierPhone}</p>}
                </div>
              </div>
              {data.courierPhone && (
                <a
                  href={`https://wa.me/${data.courierPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Halo Mas Kurir, saya pemesan pesanan #${data.orderNumber}. Lokasi patokan rumah saya: ${
                      data.deliveryAddress || data.pickupAddress || ''
                    }`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-md transition"
                >
                  <MessageCircle size={13} /> Chat Kurir
                </a>
              )}
            </div>
          </div>
        )}

        {/* Animated Stepper Section */}
        <div className="px-5 py-3">
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-5 flex items-center justify-between">
              <span>{isCafe ? 'Progres Pengantaran' : 'Status Cucian & Kurir'}</span>
              <span className="text-[10px] font-semibold text-indigo-400">
                Tahap {currentStep + 1} dari {activeSteps.length}
              </span>
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {activeSteps.map((step, idx) => {
                const isPassed = idx < currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={idx} className="relative flex items-start gap-3.5 group">
                    <div
                      className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isPassed
                          ? 'bg-emerald-500 text-slate-950 font-bold ring-4 ring-emerald-500/20'
                          : isCurrent
                          ? 'bg-indigo-600 text-white font-bold ring-4 ring-indigo-500/30 animate-pulse'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 size={12} strokeWidth={3} />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-xs font-extrabold ${
                            isCurrent ? 'text-indigo-400' : isPassed ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {step.label}
                        </p>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase">
                            Sedang Proses
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Laundry Special Details (Parfum, Kilat, Rak) */}
        {!isCafe && (
          <div className="px-5 py-2">
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Aroma Parfum</p>
                <p className="font-extrabold text-cyan-400 mt-0.5 flex items-center gap-1">
                  <Sparkles size={12} /> {data.perfumeVariant || 'Standar Fresh'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Kecepatan Cuci</p>
                <p className="font-extrabold text-amber-400 mt-0.5">{data.serviceSpeed || 'REGULAR'}</p>
              </div>
              {data.rackLocation && (
                <div className="col-span-2 pt-2 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Posisi Rak Simpan di Outlet</p>
                  <p className="font-extrabold text-white mt-0.5">{data.rackLocation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Laundry Intake Condition Photos (Bukti Timbangan & Pakaian Masuk) */}
        {!isCafe && intakePhotos.length > 0 && (
          <div className="px-5 py-2">
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
                  <Camera size={14} className="text-cyan-400" /> Bukti Foto Pakaian & Timbangan Masuk
                </p>
                <span className="text-[10px] text-slate-400">{intakePhotos.length} Foto</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {intakePhotos.map((photoUrl, i) => (
                  <img
                    key={i}
                    src={photoUrl}
                    alt={`Foto Cucian ${i + 1}`}
                    onClick={() => setPreviewPhoto(photoUrl)}
                    className="w-full h-20 object-cover rounded-xl border border-slate-700 cursor-pointer hover:opacity-90 transition"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pickup / Destination Address */}
        {(data.pickupAddress || data.deliveryAddress) && (
          <div className="px-5 py-2">
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
              <MapPin size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-200">Alamat Jemput / Pengantaran</p>
                <p className="text-slate-400 leading-relaxed">{data.deliveryAddress || data.pickupAddress}</p>
                {data.pickupTimeSlot && (
                  <p className="text-[11px] text-cyan-400 font-semibold">Jadwal Jemput: {data.pickupTimeSlot}</p>
                )}
                {data.deliveryNotes && (
                  <p className="text-[11px] text-amber-400/90 italic">Patokan: "{data.deliveryNotes}"</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Order Items & Cost Breakdown */}
        <div className="px-5 py-3">
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              {isCafe ? <Utensils size={14} className="text-amber-400" /> : <Shirt size={14} className="text-cyan-400" />}
              <span>Rincian {isCafe ? 'Menu Makanan' : 'Timbangan & Biaya Cucian'}</span>
            </h3>

            <div className="divide-y divide-slate-800/60">
              {data.items.map((item, idx) => {
                const itemName = item.name || item.serviceName || 'Item';
                const qtyStr = item.unitType ? `${item.qty} ${item.unitType}` : `${item.qty}x`;
                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-200">{itemName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {qtyStr} @ Rp {(item.price || item.pricePerUnit || 0).toLocaleString('id-ID')}
                      </p>
                      {item.notes && <p className="text-[10px] text-indigo-400 italic mt-0.5">{item.notes}</p>}
                    </div>
                    <span className="font-extrabold text-white">Rp {item.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                );
              })}
            </div>

            {/* Financial Totals with Separate Pickup & Delivery Fees */}
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal {isCafe ? 'Pesanan' : 'Cucian'}</span>
                <span>Rp {data.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {!isCafe && (data.pickupFee || 0) > 0 && (
                <div className="flex justify-between text-cyan-400">
                  <span>Biaya Penjemputan Kurir</span>
                  <span>+ Rp {(data.pickupFee || 0).toLocaleString('id-ID')}</span>
                </div>
              )}
              {data.deliveryFee > 0 && (
                <div className="flex justify-between text-indigo-400">
                  <span>{isCafe ? 'Ongkos Kirim' : 'Biaya Pengantaran Kurir'}</span>
                  <span>+ Rp {data.deliveryFee.toLocaleString('id-ID')}</span>
                </div>
              )}
              {data.speedSurcharge ? (
                <div className="flex justify-between text-amber-400">
                  <span>Biaya Layanan Kilat / Express</span>
                  <span>+ Rp {data.speedSurcharge.toLocaleString('id-ID')}</span>
                </div>
              ) : null}
              {data.discount ? (
                <div className="flex justify-between text-emerald-400">
                  <span>Diskon / Potongan Member</span>
                  <span>- Rp {data.discount.toLocaleString('id-ID')}</span>
                </div>
              ) : null}
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black text-white">
                <span>Total Tagihan</span>
                <span className="text-indigo-400">Rp {finalTotal.toLocaleString('id-ID')}</span>
              </div>
              {!isCafe && paidSoFar > 0 && (
                <>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Sudah Dibayar (DP / Deposit)</span>
                    <span>- Rp {paidSoFar.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-amber-300 pt-1">
                    <span>Sisa Tagihan</span>
                    <span>Rp {remainingBalance.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── PAYMENT SECTION: LAUNDRY DYNAMIC QRIS (EMVCo CRC-16 + AUTO-SETTLEMENT) ─── */}
        {!isPaid ? (
          <div className="px-5 pt-2 pb-6 space-y-3">
            {!isCafe ? (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950/70 to-cyan-950/60 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      <Zap size={11} /> QRIS Dinamis EMVCo CRC-16
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">Pembayaran Otomatis Tanpa Ketik Nominal</h4>
                  </div>
                  <button
                    type="button"
                    onClick={generateLaundryDynamicQris}
                    disabled={qrisLoading}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Segarkan QRIS Dinamis"
                  >
                    <RefreshCw size={14} className={qrisLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {qrisData ? (
                  <div className="bg-white text-slate-900 rounded-2xl p-4 flex flex-col items-center shadow-lg">
                    <div className="w-full flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-rose-600">QRIS</p>
                        <p className="text-xs font-extrabold text-slate-800">{qrisData.merchantName}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {qrisData.orderNumber}
                      </span>
                    </div>

                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(
                        qrisData.qrisDynamicString
                      )}`}
                      alt="QRIS Dinamis Laundry"
                      className="w-56 h-56 rounded-xl border border-slate-200 p-1"
                    />

                    <div className="w-full mt-3 pt-3 border-t border-dashed border-slate-300 text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        Nominal Otomatis Terkunci di QRIS:
                      </p>
                      <p className="text-xl font-black text-indigo-700 mt-0.5">
                        Rp {qrisData.qrisUniqueAmount.toLocaleString('id-ID')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        (Tagihan Rp {qrisData.baseAmount.toLocaleString('id-ID')} + Kode Verifikasi Otomatis Rp{' '}
                        {qrisData.uniqueCode})
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadQrisImage}
                      className="mt-3 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                    >
                      <Download size={14} /> Simpan Gambar QRIS ke Galeri HP
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    {qrisLoading ? 'Menyiapkan kode QRIS Dinamis...' : 'Klik tombol segarkan untuk memuat QRIS.'}
                  </div>
                )}

                {/* Indikator Auto-Settlement */}
                <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping mt-1 shrink-0" />
                  <p className="text-[11px] text-emerald-200 leading-relaxed">
                    <strong>Deteksi Pembayaran Otomatis Aktif:</strong> Begitu Anda membayar{' '}
                    <strong>Rp {(qrisData?.qrisUniqueAmount || remainingBalance).toLocaleString('id-ID')}</strong> lewat
                    BCA / BRI / Livin / GoPay / Dana / OVO, halaman ini akan{' '}
                    <strong>otomatis berubah menjadi LUNAS dalam 1 detik!</strong>
                  </p>
                </div>

                {/* Status Menunggu Verifikasi Manual (Jika Pelanggan Klik Konfirmasi Cadangan) */}
                {data.paymentVerificationStatus === 'WAITING_VERIFICATION' ? (
                  <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 text-center text-xs text-amber-300 font-bold">
                    ⏳ Konfirmasi pembayaran Anda sudah diterima dan sedang diverifikasi oleh kasir outlet.
                  </div>
                ) : (
                  <div className="pt-1">
                    {!showProofUpload ? (
                      <button
                        type="button"
                        onClick={() => setShowProofUpload(true)}
                        className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-white underline transition"
                      >
                        Sudah bayar tapi status belum berubah? Klik untuk Konfirmasi / Upload Bukti
                      </button>
                    ) : (
                      <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 space-y-2.5">
                        <p className="text-[11px] text-slate-300 font-bold">
                          Konfirmasi Cadangan (Jika HP Notifikasi Toko Sedang Offline):
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition">
                            <Upload size={13} />
                            {uploadingProof ? 'Mengirim...' : 'Upload Bukti'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleUploadProof}
                              className="hidden"
                              disabled={uploadingProof}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleConfirmWithoutPhoto}
                            disabled={uploadingProof}
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold transition"
                          >
                            Kabari Kasir Saja
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* CAFE MIDTRANS SNAP FLOW (UNCHANGED) */
              <div className="bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Belum Dibayar</p>
                    <p className="text-base font-black text-white">Rp {finalTotal.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      Auto-Payment Midtrans
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePayNow}
                  disabled={isPaying}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {isPaying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyiapkan Gerbang Pembayaran...
                    </>
                  ) : (
                    <>
                      <CreditCard size={15} /> Bayar Sekarang (QRIS / GoPay / VA)
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-400" /> Pembayaran aman terverifikasi otomatis via
                  Midtrans
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 pt-2 pb-6">
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div className="text-xs">
                <p className="font-extrabold text-emerald-300">Pembayaran Terverifikasi Lunas</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Metode: <span className="font-bold text-slate-200">{data.paymentMethod || 'QRIS Dinamis'}</span>
                </p>
                {data.paidAt && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Waktu:{' '}
                    {new Date(data.paidAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    WIB
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Photo Lightbox Modal */}
        {previewPhoto && (
          <div
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          >
            <img
              src={previewPhoto}
              alt="Preview Bukti Cucian"
              className="max-w-full max-h-[85vh] rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}
