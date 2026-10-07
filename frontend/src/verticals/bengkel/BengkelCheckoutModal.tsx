import React, { useState, useEffect } from 'react';
import { 
  X, Banknote, QrCode, CreditCard, Scissors, User, Check, ArrowRight, 
  Sparkles, Ticket, Tag, AlertCircle, Wrench, Package, Car, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from '../../utils/alert';

interface BengkelCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (completedOrder: any) => void;
  subtotal: number;
  cartItems: any[];
  vehiclePlate: string;
  customerName: string;
  customerPhone: string;
  priceTier: 'UMUM' | 'MITRA' | 'GROSIR';
  vehicleType: 'MOTOR' | 'MOBIL';
  token: string | null;
  existingWorkOrderId?: string;
  isDirectSale?: boolean;
}

export const BengkelCheckoutModal: React.FC<BengkelCheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  subtotal,
  cartItems,
  vehiclePlate,
  customerName,
  customerPhone,
  priceTier,
  vehicleType,
  token,
  existingWorkOrderId,
  isDirectSale
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'qris' | 'kartu' | 'split' | 'piutang'>('tunai');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [splitCash, setSplitCash] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [debtNotes, setDebtNotes] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [voucherLoading, setVoucherLoading] = useState<boolean>(false);
  const [appliedVoucherCode, setAppliedVoucherCode] = useState<string | null>(null);
  const [showNumpad, setShowNumpad] = useState<boolean>(false);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const fmt = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;

  const totalDiscount = manualDiscount + voucherDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  // Initialize cashGiven with exact total on open or total change
  useEffect(() => {
    if (isOpen && paymentMethod === 'tunai' && (cashGiven === 0 || cashGiven < finalTotal)) {
      setCashGiven(finalTotal);
    }
  }, [isOpen, finalTotal, paymentMethod]);

  if (!isOpen) return null;

  const change = cashGiven - finalTotal;
  const nonCash = Math.max(0, finalTotal - splitCash);
  const isPayable =
    paymentMethod === 'tunai' ? cashGiven >= finalTotal
    : paymentMethod === 'split' ? splitCash > 0 && splitCash < finalTotal
    : paymentMethod === 'piutang' ? true
    : true;

  // Smart quick preset amounts calculation (Identical to CodePOS standard)
  const getSmartPresets = (target: number) => {
    if (target <= 0) return [0];
    const list: number[] = [target];
    if (target % 10000 !== 0) list.push(Math.ceil(target / 10000) * 10000);
    if (target % 50000 !== 0) list.push(Math.ceil(target / 50000) * 50000);
    if (target % 100000 !== 0) list.push(Math.ceil(target / 100000) * 100000);
    [50000, 100000, 150000, 200000, 500000].forEach(v => {
      if (v > target) list.push(v);
    });
    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 4);
  };

  const quickAmounts = getSmartPresets(finalTotal);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      toast('Masukkan kode voucher terlebih dahulu', 'warning');
      return;
    }
    setVoucherLoading(true);
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: voucherCode.trim(),
          subtotal
        })
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.message || 'Kode voucher tidak valid');
      }
      setVoucherDiscount(data.discountAmount || 0);
      setAppliedVoucherCode(data.voucher.code);
      toast(`✅ Voucher "${data.voucher.code}" berhasil diterapkan! Hemat ${fmt(data.discountAmount)}`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menerapkan voucher', 'error');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucherCode(null);
    setVoucherDiscount(0);
    setVoucherCode('');
    toast('Voucher dibatalkan', 'info');
  };

  // Submit and Pay SPK
  const handleCheckout = async () => {
    if (!token) return;
    setLoading(true);

    try {
      let spkId = existingWorkOrderId;
      let spkNumberGenerated = '';

      if (!spkId) {
        // 1. Prepare Services & Parts payload
        const servicesPayload = cartItems
          .filter(i => i.type === 'SERVICE')
          .map(s => ({
            serviceTypeId: s.serviceTypeId,
            serviceName: s.name,
            vehicleType,
            price: s.price,
            qty: s.qty,
            mechanicId: s.mechanicId
          }));

        const partsPayload = cartItems
          .filter(i => i.type === 'PART')
          .map(p => ({
            productId: p.productId,
            partName: p.name,
            price: p.price,
            qty: p.qty
          }));

        // 2. Create WorkOrder SPK
        const createRes = await fetch('/api/bengkel/work-orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            vehiclePlate: vehiclePlate.trim() || 'UMUM',
            customerName: customerName.trim() || 'Konsumen Walk-In',
            customerPhone: customerPhone.trim() || undefined,
            priceTier,
            vehicleType,
            services: servicesPayload,
            parts: partsPayload
          })
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || 'Gagal membuat SPK Bengkel');
        }

        const spk = await createRes.json();
        spkId = spk.id;
        spkNumberGenerated = spk.spkNumber;
      }

      // 3. Process Payment on SPK
      const paymentMethodBackend = 
        paymentMethod === 'tunai' ? 'TUNAI'
        : paymentMethod === 'qris' ? 'QRIS'
        : paymentMethod === 'kartu' ? 'DEBIT'
        : paymentMethod === 'split' ? 'SPLIT'
        : 'PIUTANG';

      const paidAmount = 
        paymentMethod === 'piutang' ? 0 : finalTotal;

      const directSaleFlag = isDirectSale !== undefined ? isDirectSale : !existingWorkOrderId;

      const payRes = await fetch(`/api/bengkel/work-orders/${spkId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          paidAmount,
          paymentMethod: paymentMethodBackend,
          discount: totalDiscount,
          isDirectSale: directSaleFlag,
          splitCash: paymentMethod === 'split' ? splitCash : undefined,
          splitNonCash: paymentMethod === 'split' ? nonCash : undefined,
          splitNonCashMethod: 'QRIS/Transfer',
          cashGiven: paymentMethod === 'tunai' ? cashGiven : undefined,
          notes: paymentMethod === 'piutang' ? (debtNotes || `Jatuh tempo: ${dueDate}`) : undefined
        })
      });

      if (!payRes.ok) {
        const err = await payRes.json();
        throw new Error(err.error || 'Gagal memproses pembayaran');
      }

      // 4. Fetch Full SPK Details for Receipt Printing
      const fullRes = await fetch(`/api/bengkel/work-orders/${spkId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fullData = fullRes.ok ? await fullRes.json() : { id: spkId, spkNumber: spkNumberGenerated };

      const completedOrder = {
        ...fullData,
        cashGiven: paymentMethod === 'tunai' ? (cashGiven > 0 ? cashGiven : finalTotal) : finalTotal,
        changeAmount: paymentMethod === 'tunai' ? Math.max(0, change) : 0,
        paymentMethod: paymentMethodBackend,
        discount: totalDiscount
      };

      toast(`✅ Pembayaran SPK ${fullData.spkNumber || ''} Berhasil Diproses!`, 'success');
      onSuccess(completedOrder);
    } catch (e: any) {
      toast(e.message || 'Pembayaran gagal diproses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const paymentTabs = [
    { key: 'tunai', label: 'Tunai', icon: Banknote },
    { key: 'qris', label: 'QRIS', icon: QrCode },
    { key: 'kartu', label: 'Kartu', icon: CreditCard },
    { key: 'split', label: 'Split', icon: Scissors },
    { key: 'piutang', label: 'Piutang', icon: User },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="bg-white rounded-3xl md:rounded-[28px] shadow-2xl border border-slate-100 w-full max-w-4xl flex flex-col md:flex-row overflow-hidden my-auto max-h-[94vh] md:max-h-[90vh]"
        style={{ animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* ─── MOBILE ONLY TOP BAR: COMPACT SUMMARY & CLOSE BUTTON (md:hidden) ─── */}
        <div className="md:hidden bg-slate-50 border-b border-slate-200/80 p-3.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-black bg-purple-100 text-purple-900 border border-purple-200">
                <Car size={13} className="text-purple-600" />
                <span>{vehiclePlate || 'SPK Bengkel'}</span>
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                Tier {priceTier}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMobileSummaryOpen(!isMobileSummaryOpen)}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                <span>{isMobileSummaryOpen ? 'Tutup Rincian' : `Rincian (${cartItems.length})`}</span>
                {isMobileSummaryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Tagihan SPK:</span>
            <span className="text-xl font-black font-mono text-indigo-950">{fmt(finalTotal)}</span>
          </div>

          {/* Expandable Order Breakdown on Mobile */}
          {isMobileSummaryOpen && (
            <div className="pt-2 mt-1 border-t border-slate-200/70 space-y-2 animate-fade-in max-h-52 overflow-y-auto pr-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Jasa &amp; Sparepart:</div>
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-none">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    {item.type === 'SERVICE' ? (
                      <Wrench size={11} className="text-purple-600 shrink-0" />
                    ) : (
                      <Package size={11} className="text-amber-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                    <span className="text-slate-400 text-[10px]">({item.qty}x)</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0">{fmt(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="pt-1.5 flex justify-between text-xs text-slate-500">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-700">{fmt(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-rose-600 font-semibold">
                  <span>Total Diskon:</span>
                  <span>-{fmt(totalDiscount)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── KOLOM KIRI: TOTAL TAGIHAN & RINCIAN SPK BENGKEL (DESKTOP md:flex 42%) ──────────── */}
        <div className="hidden md:flex w-[42%] bg-slate-50/90 border-r border-slate-200/80 p-5 md:p-6 flex-col justify-between overflow-y-auto shrink">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Header Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-200">
                  <Car size={13} className="text-purple-600" />
                  <span>{vehiclePlate || 'SPK Bengkel'}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {cartItems.length} Item
                </span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                Tier {priceTier}
              </span>
            </div>

            {/* HERO TOTAL TAGIHAN (GRADIENT CARD) */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-900 text-white p-3.5 sm:p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />
              <div className="text-purple-200/80 text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-300" />
                <span>Total Pembayaran</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                {fmt(finalTotal)}
              </div>
            </div>

            {/* Rincian Item Keranjang (Sparepart & Jasa) */}
            <div className="flex flex-col gap-2">
              <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs py-1 border-b border-slate-200/60 last:border-none">
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-slate-800 line-clamp-1 flex items-center gap-1.5">
                        {item.type === 'SERVICE' ? (
                          <Wrench size={11} className="text-purple-600 shrink-0" />
                        ) : (
                          <Package size={11} className="text-amber-600 shrink-0" />
                        )}
                        <span>{item.name}</span>
                      </div>
                      {item.mechanicName && (
                        <div className="text-[10px] text-purple-600">
                          Mekanik: {item.mechanicName}
                        </div>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-slate-400 mr-1.5">{item.qty}x</span>
                      <span className="font-bold text-slate-700">{fmt(item.price * item.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal, Diskon, dsb */}
              <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-700">{fmt(subtotal)}</span>
                </div>
                {voucherDiscount > 0 && (
                  <div className="flex justify-between text-indigo-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Ticket size={12} /> Voucher ({appliedVoucherCode})
                    </span>
                    <span>-{fmt(voucherDiscount)}</span>
                  </div>
                )}
                {manualDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon Khusus</span>
                    <span>-{fmt(manualDiscount)}</span>
                  </div>
                )}
              </div>

              {/* VOUCHER / KUPON PROMO INPUT */}
              <div className="mt-1">
                {appliedVoucherCode ? (
                  <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                        <Ticket size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-indigo-950 flex items-center gap-1">
                          <span>{appliedVoucherCode}</span>
                          <span className="text-[10px] font-bold text-indigo-600">(-{fmt(voucherDiscount)})</span>
                        </div>
                        <div className="text-[10px] text-indigo-500 font-medium">Kupon promo aktif</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                      title="Hapus voucher"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <Ticket size={14} className="text-slate-400 ml-1 shrink-0" />
                    <input
                      type="text"
                      placeholder="KODE VOUCHER / PROMO"
                      value={voucherCode}
                      onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleApplyVoucher()}
                      className="w-full text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal outline-none bg-transparent uppercase"
                    />
                    <button
                      type="button"
                      disabled={voucherLoading || !voucherCode.trim()}
                      onClick={handleApplyVoucher}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                    >
                      {voucherLoading ? 'Cek...' : 'Pakai'}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Manual Discount Input */}
              <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2">
                <Tag size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-500 shrink-0">Diskon Manual:</span>
                <input
                  type="number"
                  placeholder="0"
                  max={Math.max(0, subtotal - voucherDiscount)}
                  value={manualDiscount || ''}
                  onChange={e => {
                    const maxAllowed = Math.max(0, subtotal - voucherDiscount);
                    const val = Number(e.target.value) || 0;
                    setManualDiscount(Math.max(0, Math.min(val, maxAllowed)));
                  }}
                  className="w-full text-right font-bold text-xs text-rose-600 outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Customer & Vehicle Info Footer Card */}
          <div className="mt-4 pt-3 border-t border-slate-200/80">
            <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center font-black text-xs shadow-sm">
                  {customerName ? customerName.charAt(0).toUpperCase() : 'W'}
                </div>
                <div>
                  <div className="text-xs font-bold text-purple-950 leading-tight flex items-center gap-1">
                    <span>{customerName || 'Konsumen Walk-In'}</span>
                  </div>
                  <div className="text-[10px] text-purple-700">
                    {vehiclePlate ? `${vehiclePlate} • ${vehicleType}` : 'Tanpa Plat Nomor'}
                    {customerPhone ? ` • ${customerPhone}` : ''}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black text-purple-800 bg-white border border-purple-200 px-2 py-1 rounded-lg shadow-2xs">
                {priceTier}
              </span>
            </div>
          </div>
        </div>

        {/* ─── KOLOM KANAN: METODE PEMBAYARAN & NOMINAL (58%) ─────────────────── */}
        <div className="flex-1 p-3.5 sm:p-5 md:p-6 flex flex-col justify-between bg-white overflow-y-auto">
          <div>
            {/* Top Modal Bar: Title & Desktop Close Button */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-bold text-sm sm:text-base text-slate-800 flex items-center gap-2">
                <span>Pilih Metode Pembayaran</span>
              </h3>
              <button 
                onClick={onClose} 
                disabled={loading}
                className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* PAYMENT METHOD SELECTOR TABS */}
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100/90 rounded-2xl mb-5">
              {paymentTabs.map(tab => {
                const IconComponent = tab.icon;
                const isSelected = paymentMethod === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPaymentMethod(tab.key as any)}
                    className={`py-2.5 px-1 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all relative cursor-pointer ${
                      isSelected 
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5 scale-[1.02]' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                    }`}
                  >
                    <IconComponent size={18} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[10px] sm:text-[11px] tracking-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: TUNAI (CASH) */}
            {paymentMethod === 'tunai' && (
              <div className="space-y-4 animate-fade-in">
                {/* 1. FAST TENDER CHIPS (1-TAP SELECTION) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                    <span>Pilihan Cepat Uang Diterima</span>
                    <span className="text-[11px] text-indigo-600 font-medium">1-Tap Langsung Hitung</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {quickAmounts.map(amt => {
                      const isSelected = cashGiven === amt;
                      const returnVal = amt - finalTotal;
                      const isExact = amt === finalTotal;

                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashGiven(amt)}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className={`text-xs font-black ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {isExact ? '⚡ Uang Pas' : fmt(amt)}
                          </div>
                          <div className={`text-[10px] mt-1 font-medium ${isExact ? 'text-slate-500' : (returnVal >= 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400')}`}>
                            {isExact ? 'Pas (Rp 0)' : `Kembali ${fmt(returnVal)}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. CUSTOM AMOUNT INPUT BAR */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-600">Nominal Tunai Manual</label>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => setShowNumpad(!showNumpad)}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline px-1.5 py-0.5 cursor-pointer"
                      >
                        {showNumpad ? 'Sembunyikan Keypad' : 'Tampilkan Keypad'}
                      </button>
                      {cashGiven > 0 && (
                        <button 
                          type="button"
                          onClick={() => setCashGiven(0)}
                          className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 px-1.5 py-0.5 cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-base font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={cashGiven || ''}
                      onChange={e => setCashGiven(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xl font-black text-slate-900 text-right outline-none transition-all"
                    />
                  </div>

                  {/* Quick Add Pills */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                    {[10000, 20000, 50000, 100000].map(addVal => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => setCashGiven((prev: number) => (prev || 0) + addVal)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-[11px] font-bold text-slate-600 hover:text-indigo-600 whitespace-nowrap shadow-2xs transition-all cursor-pointer"
                      >
                        +{addVal / 1000}k
                      </button>
                    ))}
                  </div>

                  {/* Optional Compact Touch Numpad */}
                  {showNumpad && (
                    <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-200/80 animate-fade-in">
                      {['1', '2', '3', '000', '4', '5', '6', '0', '7', '8', '9', '⌫'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            if (k === '⌫') {
                              const s = cashGiven.toString();
                              setCashGiven(s.length > 1 ? Number(s.slice(0, -1)) : 0);
                            } else if (k === '000') {
                              if (cashGiven > 0) setCashGiven(Number(cashGiven.toString() + '000'));
                            } else {
                              const s = cashGiven > 0 ? cashGiven.toString() : '';
                              setCashGiven(Number(s + k));
                            }
                          }}
                          className="py-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-bold text-sm text-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. DYNAMIC CHANGE BADGE */}
                <div className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                  change >= 0 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-900' 
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${change >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      {change >= 0 ? <Check size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold block uppercase tracking-wider opacity-80">
                        {change >= 0 ? 'Kembalian' : 'Kekurangan Bayar'}
                      </span>
                      <span className="text-lg font-black leading-none">
                        {change >= 0 ? fmt(change) : fmt(Math.abs(change))}
                      </span>
                    </div>
                  </div>
                  {change === 0 && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                      Uang Pas ✨
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: QRIS */}
            {paymentMethod === 'qris' && (
              <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 animate-fade-in">
                <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-slate-200">
                  <QrCode size={130} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">QRIS Standar Nasional</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                    Scan menggunakan BCA Mobile, GoPay, OVO, Dana, ShopeePay atau e-wallet lainnya.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Siap Terima Transaksi {fmt(finalTotal)}</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: KARTU (EDC) */}
            {paymentMethod === 'kartu' && (
              <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <CreditCard size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Mesin EDC Debit & Kredit</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                    Gesek atau Tap kartu pelanggan pada mesin EDC kasir untuk tagihan senilai <strong className="text-slate-800">{fmt(finalTotal)}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SPLIT */}
            {paymentMethod === 'split' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                  <Scissors size={16} className="text-amber-600 shrink-0" />
                  <span>Kombinasi Pembayaran Tunai + Non-Tunai</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nominal Tunai (Cash):</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={splitCash || ''}
                      onChange={e => setSplitCash(Math.max(0, Math.min(Number(e.target.value), finalTotal)))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 text-right outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Sisa Non-Tunai (QRIS/EDC):</span>
                    <span className="font-black text-indigo-700">{fmt(nonCash)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PIUTANG */}
            {paymentMethod === 'piutang' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 animate-fade-in">
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-semibold flex items-center gap-2">
                  <User size={15} className="text-purple-600" />
                  <span>Piutang tercatat atas nama: <strong>{customerName || 'Konsumen Walk-In'}</strong></span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Jatuh Tempo Pembayaran</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Piutang</label>
                  <textarea
                    rows={2}
                    value={debtNotes}
                    onChange={e => setDebtNotes(e.target.value)}
                    placeholder="Contoh: Pembayaran tempo 14 hari / armada kantor"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CONFIRMATION CHECKOUT BUTTON */}
          <div className="mt-4 pt-3 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2 -mx-1 px-1 mt-auto">
            <button
              onClick={handleCheckout}
              disabled={!isPayable || loading}
              className={`w-full py-3 sm:py-3.5 px-4 sm:px-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                isPayable && !loading
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white hover:shadow-indigo-500/25 hover:from-indigo-500 hover:to-indigo-700 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Memproses SPK & Pembayaran...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Konfirmasi Pembayaran ({fmt(finalTotal)})</span>
                  <ArrowRight size={16} className="opacity-70" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BengkelCheckoutModal;
