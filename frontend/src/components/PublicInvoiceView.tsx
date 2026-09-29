import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Receipt,
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Store,
  Calendar,
  User,
  Coffee,
  Wrench,
  Shirt,
  ShoppingBag,
  ExternalLink,
  Copy,
  AlertCircle
} from 'lucide-react';

interface InvoiceData {
  orderNumber?: string;
  spkNumber?: string;
  createdAt: string;
  paidAt?: string;
  status: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  tableName?: string;
  paymentMethod?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceCharge?: number;
  total: number;
  paidAmount?: number;
  items?: Array<{
    id: any;
    name: string;
    qty: number;
    price: number;
    subtotal: number;
    notes?: string;
    imageUrl?: string;
    unit?: string;
  }>;
  // Bengkel specific
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleType?: string;
  odometer?: number;
  complaint?: string;
  diagnosis?: string;
  mechanicName?: string;
  services?: Array<{
    id: any;
    name: string;
    price: number;
    qty: number;
    subtotal: number;
    mechanicName?: string;
  }>;
  parts?: Array<{
    id: any;
    name: string;
    partNumber?: string;
    price: number;
    qty: number;
    subtotal: number;
  }>;
  // Laundry specific
  rackNumber?: string;
  perfume?: string;
  totalWeightKg?: number;
  speedTier?: string;
  // Store details
  store: {
    name: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    receiptFooter?: string;
    businessType?: string;
  };
}

export default function PublicInvoiceView() {
  const { orderNumber, spkNumber, type, id } = useParams<{
    orderNumber?: string;
    spkNumber?: string;
    type?: string;
    id?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [copied, setCopied] = useState(false);

  // Tentukan identifier target
  const targetId = orderNumber || spkNumber || id;
  const isSpkRoute = Boolean(spkNumber) || type === 'spk' || (targetId && targetId.startsWith('SPK-'));

  useEffect(() => {
    const fetchInvoice = async () => {
      setLoading(true);
      setError(null);
      try {
        let endpoint = `/api/public/invoice/order/${encodeURIComponent(targetId || '')}`;
        if (isSpkRoute) {
          endpoint = `/api/public/invoice/spk/${encodeURIComponent(targetId || '')}`;
        }

        const res = await fetch(endpoint);
        const json = await res.json();

        if (res.ok && json.success && json.data) {
          setInvoice(json.data);
        } else {
          // Coba fallback jika rute salah tebak
          if (!isSpkRoute) {
            const fallbackRes = await fetch(`/api/public/invoice/spk/${encodeURIComponent(targetId || '')}`);
            const fallbackJson = await fallbackRes.json();
            if (fallbackRes.ok && fallbackJson.success && fallbackJson.data) {
              setInvoice(fallbackJson.data);
              return;
            }
          }
          setError(json.error || 'Struk atau nomor transaksi tidak ditemukan.');
        }
      } catch (err: any) {
        console.error('Fetch invoice error:', err);
        setError('Gagal memuat struk digital. Periksa koneksi internet Anda.');
      } finally {
        setLoading(false);
      }
    };

    if (targetId) {
      fetchInvoice();
    } else {
      setError('Nomor nota tidak disertakan dalam URL.');
      setLoading(false);
    }
  }, [targetId, isSpkRoute]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const currentUrl = window.location.href;
    const storeName = invoice?.store?.name || 'Toko Kami';
    const num = invoice?.orderNumber || invoice?.spkNumber || '';
    const text = encodeURIComponent(`Halo! Ini adalah rincian struk digital saya dari *${storeName}* (No: ${num}):\n${currentUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-black text-slate-800">Memuat Struk Digital...</h3>
          <p className="text-xs text-slate-500">Menghubungkan ke database resmi CodePOS...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-base font-black text-slate-800">Struk Tidak Ditemukan</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'Nomor transaksi ini mungkin telah kedaluwarsa atau salah diketik.'}
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status?.toUpperCase() === 'PAID' || invoice.paymentStatus?.toUpperCase() === 'PAID';
  const displayNo = invoice.orderNumber || invoice.spkNumber || targetId;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 flex flex-col items-center justify-start print:bg-white print:p-0">
      {/* Action Bar (Sembunyi saat di-print) */}
      <div className="max-w-md w-full mb-4 flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Printer size={15} /> Cetak / PDF
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
          >
            <Share2 size={15} /> Kirim WA
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <Copy size={14} /> {copied ? 'Tersalin!' : 'Salin Link'}
        </button>
      </div>

      {/* Main Invoice Ticket (Paper Design) */}
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden print:shadow-none print:border-none print:max-w-full">
        {/* Receipt Header Accent */}
        <div className="h-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 print:hidden" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Store Logo & Info */}
          <div className="text-center space-y-2 pb-5 border-b border-dashed border-slate-200">
            {invoice.store.logoUrl ? (
              <img
                src={invoice.store.logoUrl}
                alt={invoice.store.name}
                className="w-16 h-16 object-contain mx-auto rounded-2xl mb-2"
              />
            ) : (
              <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md mb-2">
                {invoice.store.businessType === 'BENGKEL' ? (
                  <Wrench size={26} />
                ) : invoice.store.businessType === 'LAUNDRY' ? (
                  <Shirt size={26} />
                ) : (
                  <Coffee size={26} />
                )}
              </div>
            )}
            <h1 className="text-lg font-black text-slate-900 tracking-tight">{invoice.store.name}</h1>
            {invoice.store.address && (
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1 max-w-xs mx-auto">
                <MapPin size={13} className="shrink-0 text-slate-400" />
                <span>{invoice.store.address}</span>
              </p>
            )}
            {invoice.store.phone && (
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                <Phone size={13} className="shrink-0 text-slate-400" />
                <span>{invoice.store.phone}</span>
              </p>
            )}

            {/* Official Badge */}
            <div className="pt-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                <Receipt size={12} /> Struk Digital Resmi
              </span>
              {isPaid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={12} /> LUNAS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  <Clock size={12} /> {invoice.status}
                </span>
              )}
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[11px] font-semibold text-slate-400">NO. TRANSAKSI</div>
              <div className="font-mono font-black text-slate-800 break-all">{displayNo}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400">WAKTU PEMBAYARAN</div>
              <div className="font-medium text-slate-700">{formatDate(invoice.paidAt || invoice.createdAt)}</div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400">PELANGGAN</div>
              <div className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <User size={12} className="text-slate-400" />
                <span>{invoice.customerName || 'Umum'}</span>
              </div>
            </div>

            <div className="text-right">
              {invoice.tableName ? (
                <>
                  <div className="text-[11px] font-semibold text-slate-400">MEJA / AREA</div>
                  <div className="font-bold text-slate-800">{invoice.tableName}</div>
                </>
              ) : invoice.paymentMethod ? (
                <>
                  <div className="text-[11px] font-semibold text-slate-400">METODE PEMBAYARAN</div>
                  <div className="font-bold text-slate-800">{invoice.paymentMethod}</div>
                </>
              ) : null}
            </div>
          </div>

          {/* Bengkel Vehicle Snapshot Card (Jika SPK Bengkel) */}
          {invoice.vehiclePlate && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Plat Nomor:</span>
                <span className="font-mono font-black px-2 py-0.5 bg-slate-900 text-white rounded-md tracking-wider">
                  {invoice.vehiclePlate}
                </span>
              </div>
              {invoice.vehicleModel && (
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Unit / Model:</span>
                  <span className="font-bold">{invoice.vehicleBrand ? `${invoice.vehicleBrand} ` : ''}{invoice.vehicleModel}</span>
                </div>
              )}
              {invoice.mechanicName && (
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Mekanik Penanggung Jawab:</span>
                  <span className="font-bold text-indigo-700">{invoice.mechanicName}</span>
                </div>
              )}
              {invoice.odometer && (
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Kilometer (Odo):</span>
                  <span>{invoice.odometer.toLocaleString('id-ID')} KM</span>
                </div>
              )}
            </div>
          )}

          {/* Laundry Details (Jika Laundry) */}
          {(invoice.rackNumber || invoice.perfume) && (
            <div className="bg-cyan-50/60 border border-cyan-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-cyan-900">
              {invoice.rackNumber && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-700">Nomor Rak Simpan:</span>
                  <span className="font-black font-mono bg-cyan-600 text-white px-2 py-0.5 rounded-md">
                    {invoice.rackNumber}
                  </span>
                </div>
              )}
              {invoice.perfume && (
                <div className="flex items-center justify-between">
                  <span className="text-cyan-700">Varian Parfum:</span>
                  <span className="font-bold">{invoice.perfume}</span>
                </div>
              )}
              {invoice.totalWeightKg && (
                <div className="flex items-center justify-between">
                  <span className="text-cyan-700">Total Timbangan:</span>
                  <span className="font-bold">{invoice.totalWeightKg} Kg</span>
                </div>
              )}
            </div>
          )}

          {/* Itemized Table */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
              Rincian Item Pesanan
            </div>

            {/* POS Standard / Laundry Items */}
            {invoice.items && invoice.items.length > 0 && (
              <div className="space-y-2.5">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 leading-snug">{item.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        {item.qty} {item.unit || 'x'} @ {formatRupiah(item.price)}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                          Catatan: {item.notes}
                        </div>
                      )}
                    </div>
                    <div className="font-black text-slate-800 text-right whitespace-nowrap">
                      {formatRupiah(item.subtotal)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bengkel Services & Parts */}
            {invoice.services && invoice.services.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                  Jasa & Servis
                </div>
                {invoice.services.map((s, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 text-xs pl-1">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{s.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        {s.qty}x @ {formatRupiah(s.price)} {s.mechanicName ? `(${s.mechanicName})` : ''}
                      </div>
                    </div>
                    <div className="font-black text-slate-800">{formatRupiah(s.subtotal)}</div>
                  </div>
                ))}
              </div>
            )}

            {invoice.parts && invoice.parts.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                  Sparepart & Oli
                </div>
                {invoice.parts.map((p, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 text-xs pl-1">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{p.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        {p.qty}x @ {formatRupiah(p.price)} {p.partNumber ? `[${p.partNumber}]` : ''}
                      </div>
                    </div>
                    <div className="font-black text-slate-800">{formatRupiah(p.subtotal)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="pt-4 border-t border-dashed border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-700">{formatRupiah(invoice.subtotal)}</span>
            </div>

            {Boolean(invoice.discount && invoice.discount > 0) && (
              <div className="flex items-center justify-between text-rose-600">
                <span>Diskon / Potongan</span>
                <span className="font-semibold">- {formatRupiah(invoice.discount!)}</span>
              </div>
            )}

            {Boolean(invoice.tax && invoice.tax > 0) && (
              <div className="flex items-center justify-between text-slate-500">
                <span>Pajak (PB1 / PPN)</span>
                <span className="font-semibold text-slate-700">{formatRupiah(invoice.tax!)}</span>
              </div>
            )}

            {Boolean(invoice.serviceCharge && invoice.serviceCharge > 0) && (
              <div className="flex items-center justify-between text-slate-500">
                <span>Biaya Layanan</span>
                <span className="font-semibold text-slate-700">{formatRupiah(invoice.serviceCharge!)}</span>
              </div>
            )}

            {/* Total Grand Amount */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-900/10 text-sm">
              <span className="font-black text-slate-900 uppercase">Total Tagihan</span>
              <span className="text-base font-black text-slate-950 font-mono">
                {formatRupiah(invoice.total)}
              </span>
            </div>

            {Boolean(invoice.paidAmount && invoice.paidAmount > 0) && (
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Jumlah Dibayar</span>
                <span className="font-bold text-slate-800">{formatRupiah(invoice.paidAmount!)}</span>
              </div>
            )}
          </div>

          {/* Receipt Footer Message */}
          <div className="pt-6 pb-2 text-center border-t border-dashed border-slate-200 space-y-1.5">
            <p className="text-xs font-semibold text-slate-700 italic">
              "{invoice.store.receiptFooter || 'Terima kasih atas kunjungan Anda!'}"
            </p>
            <p className="text-[10px] text-slate-400">
              Struk ini dihasilkan secara otomatis oleh sistem CodePOS Digital E-Receipt.
            </p>
          </div>
        </div>

        {/* Footer Brand Ribbon */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 print:hidden">
          <span>Powered by <b>CodePOS</b></span>
          <span className="text-[10px] font-mono">{new Date().getFullYear()} © Cloud POS</span>
        </div>
      </div>
    </div>
  );
}
