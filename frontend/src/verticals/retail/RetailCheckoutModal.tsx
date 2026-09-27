import React, { useState, useEffect } from 'react';
import { 
  X, 
  Banknote, 
  CreditCard, 
  Truck, 
  FileText, 
  AlertTriangle, 
  Check, 
  Lock, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  QrCode,
  Tag,
  User,
  Package,
  Calendar,
  Phone,
  Ticket
} from 'lucide-react';
import type { CustomerData } from './RetailCustomerPicker';
import { toast } from '../../utils/alert';

interface CartItem {
  id: number;
  productId: number;
  productName: string;
  price: number;
  qty: number;
  buyPrice?: number;
  subtotal: number;
  uomName?: string;
  uomRatio?: number;
  priceTierName?: string;
}

interface RetailCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  customer: CustomerData | null;
  onSuccessCheckout: (orderResult: any) => void;
}

export const RetailCheckoutModal: React.FC<RetailCheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  subtotal,
  discount: initialDiscount,
  tax,
  total: initialTotal,
  customer,
  onSuccessCheckout
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BON' | 'TRANSFER' | 'QRIS'>('CASH');
  const [manualDiscount, setManualDiscount] = useState<number>(initialDiscount || 0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [overridePin, setOverridePin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delivery Order Option
  const [isDelivery, setIsDelivery] = useState<boolean>(false);
  const [driverName, setDriverName] = useState<string>('Pak Joko (Armada Toko)');
  const [vehiclePlate, setVehiclePlate] = useState<string>('B 9876 XYZ');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  const fmt = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;

  const finalTotal = Math.max(0, subtotal - manualDiscount + tax);
  const changeAmount = Math.max(0, cashReceived - finalTotal);

  // Smart quick preset amounts calculation (CodePOS standard)
  const getSmartPresets = (target: number) => {
    if (target <= 0) return [0];
    const list: number[] = [target];
    if (target % 10000 !== 0) list.push(Math.ceil(target / 10000) * 10000);
    if (target % 50000 !== 0) list.push(Math.ceil(target / 50000) * 50000);
    if (target % 100000 !== 0) list.push(Math.ceil(target / 100000) * 100000);
    [50000, 100000, 200000, 500000, 1000000].forEach(v => {
      if (v > target) list.push(v);
    });
    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 5);
  };

  const quickAmounts = getSmartPresets(finalTotal);

  useEffect(() => {
    if (isOpen) {
      setCashReceived(finalTotal);
      if (customer) {
        setDeliveryAddress(customer.name + (customer.phone ? ` (${customer.phone})` : ''));
      }
    }
  }, [isOpen, finalTotal, customer]);

  // Keyboard shortcut: Esc to close, Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Kalkulasi Overlimit Bon
  const isBon = paymentMethod === 'BON';
  const currentDebt = customer?.activeDebtTotal || 0;
  const creditLimit = customer?.creditLimit || 0;
  const newDebtTotal = currentDebt + finalTotal;
  const isOverLimit = isBon && creditLimit > 0 && newDebtTotal > creditLimit;
  const excessAmount = Math.max(0, newDebtTotal - creditLimit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'CASH' && cashReceived < finalTotal) {
      toast('Uang tunai yang diterima kurang dari total faktur.', 'warning');
      return;
    }

    if (isBon && !customer) {
      toast('Pembayaran Bon / Tempo mewajibkan memilih data pelanggan terlebih dahulu.', 'warning');
      return;
    }

    if (isOverLimit && !overridePin.trim()) {
      toast('Plafon Bon Terlampaui! Masukkan PIN Otorisasi Owner untuk melanjutkan.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const payload = {
        customerId: customer?.id || null,
        customerName: customer?.name || 'Pelanggan Umum',
        customerPhone: customer?.phone || null,
        items: items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          qty: i.qty,
          price: i.price,
          buyPrice: i.buyPrice,
          subtotal: i.subtotal,
          uomName: i.uomName || 'PCS',
          uomRatio: i.uomRatio || 1,
          priceTierName: i.priceTierName || null
        })),
        subtotal,
        discount: manualDiscount,
        tax,
        total: finalTotal,
        paymentMethod,
        overridePin: isOverLimit ? overridePin.trim() : undefined,
        isDelivery,
        driverName: isDelivery ? driverName : undefined,
        vehiclePlate: isDelivery ? vehiclePlate : undefined,
        deliveryAddress: isDelivery ? deliveryAddress : undefined,
        deliveryNotes: isDelivery ? deliveryNotes : undefined
      };

      const res = await fetch('/api/retail/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memproses checkout.');
      }

      toast('🎉 Transaksi Grosir & Retail Berhasil Dibukukan!', 'success');
      onSuccessCheckout(json.data);
      onClose();
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentTabs = [
    { id: 'CASH', label: 'Tunai', icon: Banknote },
    { id: 'BON', label: 'Bon Tempo', icon: FileText },
    { id: 'TRANSFER', label: 'Transfer Bank', icon: Building },
    { id: 'QRIS', label: 'QRIS', icon: QrCode }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="bg-white rounded-3xl md:rounded-[28px] shadow-2xl border border-slate-100 w-full max-w-4xl flex flex-col md:flex-row overflow-hidden my-auto max-h-[94vh] md:max-h-[90vh]"
        style={{ animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* ─── KOLOM KIRI: TOTAL TAGIHAN & RINCIAN FAKTUR RETAIL/GROSIR (42%) ─── */}
        <div className="w-full md:w-[42%] bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 p-4 sm:p-5 md:p-6 flex flex-col justify-between overflow-y-auto max-h-[32vh] md:max-h-none shrink-0 md:shrink">
          <div className="flex flex-col gap-3 sm:gap-4">
            
            {/* Header Badge Pelanggan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-200">
                  <User size={13} className="text-purple-700" />
                  <span className="truncate max-w-[130px]">{customer?.name || 'Pelanggan Umum'}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {items.length} Item
                </span>
              </div>
              {customer?.creditLimit ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
                  Plafon: {fmt(customer.creditLimit)}
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  Retail POS
                </span>
              )}
            </div>

            {/* HERO TOTAL TAGIHAN (GRADIENT CARD) */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-900 text-white p-3.5 sm:p-5 rounded-2xl shadow-lg relative overflow-hidden border border-purple-500/20">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />
              <div className="text-purple-200/80 text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-300" />
                <span>Total Tagihan Faktur</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                {fmt(finalTotal)}
              </div>
            </div>

            {/* Rincian Item Faktur Belanja */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Daftar Barang & Satuan
              </span>
              <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs py-1 border-b border-slate-200/60 last:border-none">
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-slate-800 line-clamp-1 flex items-center gap-1.5">
                        <Package size={12} className="text-purple-600 shrink-0" />
                        <span>{item.productName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="font-bold text-purple-700">{item.uomName || 'PCS'}</span>
                        {item.priceTierName && (
                          <span className="bg-amber-100 text-amber-800 px-1 rounded text-[9px] font-semibold">
                            {item.priceTierName}
                          </span>
                        )}
                        <span>@ {fmt(item.price)}</span>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-slate-400 mr-1.5">{item.qty}x</span>
                      <span className="font-bold text-slate-700 font-mono">{fmt(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal, Diskon, dsb */}
              <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Nilai Subtotal</span>
                  <span className="font-semibold text-slate-700 font-mono">{fmt(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>PPN / Pajak</span>
                    <span className="font-semibold text-slate-700 font-mono">+{fmt(tax)}</span>
                  </div>
                )}
                {manualDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Potongan / Diskon</span>
                    <span className="font-mono">-{fmt(manualDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Quick Manual Discount Input */}
              <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2">
                <Tag size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-500 shrink-0">Diskon Faktur:</span>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  max={subtotal}
                  value={manualDiscount || ''}
                  onChange={e => setManualDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full text-right text-xs font-bold text-rose-600 outline-none bg-transparent"
                />
                <span className="text-xs font-bold text-slate-400">Rp</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-purple-600" />
            <span>Sistem Kasir Aman Terenkripsi CodePOS</span>
          </div>
        </div>

        {/* ─── KOLOM KANAN: METODE BAYAR, PRESETS, & SUBMIT (58%) ─────────────── */}
        <div className="w-full md:w-[58%] p-5 md:p-6 flex flex-col justify-between overflow-y-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
            
            {/* Header Kanan dengan Close Button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Metode & Opsi Pembayaran</h3>
                <p className="text-xs text-slate-400">Pilih skema transaksi dan armada pengiriman toko</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* TAB METODE PEMBAYARAN */}
            <div className="grid grid-cols-4 gap-2">
              {paymentTabs.map(tab => {
                const Icon = tab.icon;
                const isSelected = paymentMethod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaymentMethod(tab.id as any)}
                    className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-black shadow-sm ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[11px] font-bold leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TUNAI (CASH): INPUT UANG DITERIMA + SMART PRESETS + KEMBALIAN */}
            {paymentMethod === 'CASH' && (
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Uang Diterima Dari Pembeli
                  </label>
                  <span className="text-[11px] text-indigo-700 font-bold">
                    Tagihan: {fmt(finalTotal)}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-indigo-600 font-black text-sm">Rp</span>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={e => setCashReceived(Number(e.target.value) || 0)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 text-xl font-mono font-black bg-white border border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                    placeholder="0"
                  />
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {quickAmounts.map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashReceived(amt)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${
                        cashReceived === amt
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40'
                      }`}
                    >
                      {amt === finalTotal ? 'Uang Pas' : fmt(amt)}
                    </button>
                  ))}
                </div>

                {/* Kembalian Box */}
                <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Uang Kembalian:</span>
                  <span className={`text-base font-black font-mono ${changeAmount >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                    {fmt(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* BON TEMPO (PIUTANG KREDIT) */}
            {paymentMethod === 'BON' && (
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                  <FileText size={15} className="text-amber-700" />
                  <span>Pencatatan Buku Bon Warung / Pelanggan</span>
                </div>

                {customer ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>Total Hutang Berjalan:</span>
                      <strong className="font-mono text-slate-900">{fmt(currentDebt)}</strong>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Batas Plafon Kredit:</span>
                      <strong className="font-mono text-slate-900">
                        {creditLimit > 0 ? fmt(creditLimit) : 'Tanpa Batas'}
                      </strong>
                    </div>
                    <div className="flex justify-between border-t border-amber-200/60 pt-1 text-slate-800">
                      <span>Total Hutang Setelah Transaksi:</span>
                      <strong className="font-mono text-amber-900 font-black">{fmt(newDebtTotal)}</strong>
                    </div>

                    {isOverLimit && (
                      <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2 mt-2">
                        <div className="flex items-start gap-2 text-rose-800">
                          <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                          <div className="text-[11px] leading-tight">
                            <strong className="block font-black">Plafon Kredit Terlampaui!</strong>
                            Kelebihan limit sebesar <strong>{fmt(excessAmount)}</strong>. Diperlukan otorisasi PIN Owner.
                          </div>
                        </div>
                        <div className="relative">
                          <Lock size={14} className="absolute left-3 top-2.5 text-rose-500" />
                          <input
                            type="password"
                            placeholder="Ketik PIN Otorisasi Toko (Default: 1234)"
                            value={overridePin}
                            onChange={e => setOverridePin(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-rose-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
                    <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                    <span>Silakan pilih Warung / Pelanggan terlebih dahulu di kasir sebelum memilih opsi Bon Tempo!</span>
                  </div>
                )}
              </div>
            )}

            {/* TRANSFER & QRIS INFO */}
            {(paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-slate-600 animate-fade-in">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  <span>Verifikasi Pembayaran Non-Tunai</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pastikan bukti transfer atau notifikasi QRIS telah diverifikasi kasir senilai{' '}
                  <strong className="text-slate-800 font-mono">{fmt(finalTotal)}</strong>.
                </p>
              </div>
            )}

            {/* OPSI PENGIRIMAN ARMADA TOKO (SURAT JALAN / DO) */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDelivery}
                  onChange={e => setIsDelivery(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck size={15} className="text-emerald-600" />
                  Kirim via Armada Toko (Terbitkan Surat Jalan / DO Otomatis)
                </span>
              </label>

              {isDelivery && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs animate-fade-in">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sopir / Kurir</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                      placeholder="Nama sopir toko..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">No. Polisi Armada</label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={e => setVehiclePlate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500 uppercase"
                      placeholder="B 1234 XYZ..."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Alamat / Lokasi Antar</label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                      placeholder="Alamat toko langganan / gudang..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS (SUBMIT & CANCEL) */}
            <div className="pt-2 flex items-center gap-2 sm:gap-3 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2 -mx-1 px-1 border-t border-slate-100 mt-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors shrink-0"
              >
                Batal (Esc)
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting || (paymentMethod === 'BON' && isOverLimit && !overridePin.trim())}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 disabled:bg-slate-300 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="truncate">Selesaikan Transaksi (Enter)</span>
                    <ArrowRight size={16} className="shrink-0" />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};
export default RetailCheckoutModal;
