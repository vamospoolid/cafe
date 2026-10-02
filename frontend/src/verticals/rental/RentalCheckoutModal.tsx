import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  Shirt, 
  Layers, 
  DollarSign, 
  ArrowRight,
  CreditCard,
  Wallet,
  Receipt,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { toast } from '../../utils/alert';

export interface RentalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  pickupDate: string;
  returnDeadline: string;
  rentalDurationDays: number;
  subtotal: number;
  token: string | null;
  onSuccess: (order: any) => void;
}

export const RentalCheckoutModal: React.FC<RentalCheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  pickupDate,
  returnDeadline,
  rentalDurationDays,
  subtotal,
  token,
  onSuccess
}) => {
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState(pickupDate);

  // Collateral (Jaminan Fisik)
  const [collateralType, setCollateralType] = useState<'KTP' | 'SIM' | 'PASPOR' | 'LAINNYA'>('KTP');
  const [collateralNote, setCollateralNote] = useState('');

  // Financials
  const [discount, setDiscount] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [fittingNotes, setFittingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recalculate Totals
  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  const grandTotalDueToday = useMemo(() => {
    return totalAmount + depositAmount;
  }, [totalAmount, depositAmount]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, totalAmount - paidAmount);
  }, [totalAmount, paidAmount]);

  // Set default paidAmount to DP 30% or full when opened
  useEffect(() => {
    if (isOpen) {
      setPaidAmount(Math.round(totalAmount * 0.3));
      setEventDate(pickupDate);
    }
  }, [isOpen, totalAmount, pickupDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast('Nama penyewa / pengantin wajib diisi.', 'error');
      return;
    }

    if (cartItems.length === 0) {
      toast('Pilih minimal 1 set busana untuk disewa.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Consolidate accessories from all dresses with extra price
      const consolidatedAccessories: Array<{ name: string; checked: boolean; attireCode: string; extraPrice?: number }> = [];
      cartItems.forEach(item => {
        (item.defaultAccessories || []).forEach((acc: string) => {
          const isChecked = (item.selectedAccessories || []).includes(acc);
          const extraPrice = item.accessoryPrices?.[acc] || 0;
          consolidatedAccessories.push({
            name: `${acc} [${item.rackHangerCode}]`,
            checked: isChecked,
            attireCode: item.code,
            extraPrice: isChecked ? extraPrice : 0
          });
        });
      });

      // Item permak notes
      const itemPermakNotes = cartItems
        .filter(it => it.permakNote?.trim())
        .map(it => `[${it.rackHangerCode} - ${it.name}]: ${it.permakNote?.trim()}`)
        .join('\n');

      const fullFittingNotes = [
        collateralNote ? `[Jaminan Fisik: ${collateralType} - ${collateralNote}]` : `[Jaminan Fisik: ${collateralType}]`,
        fittingNotes.trim(),
        itemPermakNotes
      ].filter(Boolean).join('\n');

      // Expand items by quantity and include extra accessory pricing per set
      const expandedItems: any[] = [];
      cartItems.forEach(it => {
        const qty = it.qty || 1;
        const accExtra = (it.selectedAccessories || []).reduce((s: number, acc: string) => 
          s + (it.accessoryPrices?.[acc] || 0), 0);
        const itemPricePerSet = it.price + accExtra;

        for (let q = 1; q <= qty; q++) {
          expandedItems.push({
            productId: it.id?.startsWith('prod-') ? Number(it.id.replace('prod-', '')) : null,
            attireName: qty > 1 ? `${it.name} (Set #${q})` : it.name,
            attireCode: it.code,
            rackHangerCode: it.rackHangerCode,
            color: it.color,
            size: it.size,
            price: itemPricePerSet
          });
        }
      });

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        eventLocation: eventLocation.trim() || null,
        eventDate: eventDate || pickupDate,
        pickupDate,
        returnDeadline,
        rentalSubtotal: subtotal,
        discount,
        paidAmount,
        paymentMethod,
        depositAmount,
        fittingNotes: fullFittingNotes || null,
        accessoryChecklist: consolidatedAccessories,
        items: expandedItems
      };

      const res = await fetch('/api/rental/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan kontrak sewa.');
      }

      toast(`Kontrak Sewa #${data.order.orderNumber} berhasil diterbitkan!`, 'success');
      onSuccess(data.order);
      onClose();
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan saat memproses kontrak.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 bg-white sm:bg-slate-900/60 sm:backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl sm:border sm:border-slate-300 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header (Pinned Top, Solid & Tegas) */}
        <div className="p-3.5 sm:p-5 bg-indigo-700 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black tracking-tight text-white leading-tight">
                Penerbitan Kontrak Sewa Busana
              </h2>
              <p className="text-[11px] sm:text-xs text-indigo-100 font-medium line-clamp-1">
                Lengkapi identitas klien, jaminan identitas fisik, dan rincian uang muka (DP).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="Tutup Form"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Form with Scrollable Content + Pinned Footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* ─── KOLOM KIRI: RINGKASAN ORDER & JADWAL (5/12) ────────────────── */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Kartu Jadwal Sewa */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" />
                Jadwal &amp; Durasi Sewa
              </h3>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Tgl Pengambilan:</span>
                  <strong className="text-slate-900">{pickupDate}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Batas Pengembalian:</span>
                  <strong className="text-slate-900">{returnDeadline}</strong>
                </div>
                <div className="pt-1 border-t border-indigo-200 flex items-center justify-between text-xs">
                  <span className="text-indigo-900 font-bold">Durasi Sewa:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-700 text-white font-black text-[11px]">
                    {rentalDurationDays} Hari
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Hari-H Acara / Resepsi</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                />
              </div>
            </div>

            {/* Kartu Daftar Busana Terpilih */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt size={13} className="text-indigo-600" />
                  Busana Disewa ({cartItems.length})
                </h3>
                <span className="text-xs font-black text-indigo-900">
                  Rp {subtotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-2">
                {cartItems.map((item, idx) => (
                  <div key={item.id} className="pt-2.5 first:pt-0 space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-600 bg-indigo-50">
                            <Shirt size={14} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.rackHangerCode} • Size {item.size} • {item.color}
                        </div>
                      </div>
                      <div className="font-black text-slate-800 shrink-0 text-right">
                        {item.qty && item.qty > 1 ? (
                          <div>
                            <div>Rp {((item.price + ((item.selectedAccessories || []).reduce((s: number, acc: string) => s + (item.accessoryPrices?.[acc] || 0), 0))) * item.qty).toLocaleString('id-ID')}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {item.qty} Set
                            </div>
                          </div>
                        ) : (
                          <span>Rp {(item.price + ((item.selectedAccessories || []).reduce((s: number, acc: string) => s + (item.accessoryPrices?.[acc] || 0), 0))).toLocaleString('id-ID')}</span>
                        )}
                      </div>
                    </div>

                    {/* Accessories count & extra breakdown */}
                    {(() => {
                      const paidAccs = (item.selectedAccessories || []).filter((acc: string) => (item.accessoryPrices?.[acc] || 0) > 0);
                      const accExtra = paidAccs.reduce((s: number, acc: string) => s + (item.accessoryPrices?.[acc] || 0), 0) * (item.qty || 1);
                      return (
                        <div className="text-[10px] text-slate-600 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Layers size={10} className="text-indigo-600 shrink-0" />
                            <span>{item.selectedAccessories?.length || 0} Aksesoris Terpasang</span>
                          </span>
                          {accExtra > 0 && (
                            <span className="text-violet-700 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                              Extra: +Rp {accExtra.toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Permak note preview if any */}
                    {item.permakNote?.trim() && (
                      <div className="text-[10px] text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded">
                        Note: {item.permakNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ─── KOLOM KANAN: DATA KLIEN, JAMINAN & PEMBAYARAN (7/12) ────────── */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* 1. Identitas Klien */}
            <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-indigo-600" />
                Identitas Penyewa
              </h3>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Klien / Pengantin *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Nurul Hidayah & Muh. Ridwan"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 bg-white text-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">No. WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0812xxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Lokasi Gedung / Acara</label>
                  <input
                    type="text"
                    placeholder="Contoh: Gedung IMMIM Makassar"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* 2. Jaminan Fisik Dokumen */}
            <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-indigo-600" />
                  Jaminan Dokumen Fisik
                </h3>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold border border-indigo-200">
                  Wajib dititipkan saat ambil
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['KTP', 'SIM', 'PASPOR', 'LAINNYA'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCollateralType(type)}
                    className={`py-1.5 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      collateralType === type
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder={`Nomor / Keterangan jaminan ${collateralType} asli dititipkan...`}
                value={collateralNote}
                onChange={(e) => setCollateralNote(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-600 bg-white text-slate-800"
              />
            </div>

            {/* 3. Finansial & Pembayaran DP */}
            <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-indigo-600" />
                Rincian Biaya &amp; Uang Muka (DP)
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal Sewa ({cartItems.length} Busana)</span>
                  <span className="font-bold text-slate-900">Rp {subtotal.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex items-center justify-between text-slate-700 pt-1.5 border-t border-slate-200 flex-wrap gap-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-indigo-600" />
                    Deposit Jaminan (Refundable)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDepositAmount(0)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        depositAmount === 0
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Tanpa deposit uang tunai, jaminan fisik KTP saja"
                    >
                      KTP Saja (Rp 0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositAmount(100000)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        depositAmount === 100000
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      100rb
                    </button>
                    <span className="text-[11px] text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={e => setDepositAmount(Number(e.target.value) || 0)}
                      className="w-20 px-2 py-0.5 text-xs font-bold text-right rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                  <span className="text-xs font-black text-slate-900">Total Nilai Kontrak</span>
                  <span className="text-base font-black text-slate-900">
                    Rp {grandTotalDueToday.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Bayar Sekarang (Opsi Bayar Full Saat Kembali / DP / Lunas) */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700">Skema Pembayaran Klien:</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setPaidAmount(0)}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                        paidAmount === 0
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Bayar Full Saat Kembali (Rp 0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(Math.round(totalAmount * 0.3))}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        paidAmount === Math.round(totalAmount * 0.3)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      DP 30%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(Math.round(totalAmount * 0.5))}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        paidAmount === Math.round(totalAmount * 0.5)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(totalAmount)}
                      className={`px-2 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                        paidAmount === totalAmount
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Lunas Sekarang
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp Dibayar Hari Ini:</span>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(Number(e.target.value) || 0)}
                    className="w-full pl-36 pr-3 py-2 text-sm font-black rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-slate-900"
                  />
                </div>

                {/* Sisa Pelunasan & Status Reassurance */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 flex items-center justify-between text-xs shadow-2xs">
                  <div>
                    <span className="text-slate-500 font-medium block text-[11px]">
                      {paidAmount === 0 
                        ? 'Status Pembayaran Sewa:' 
                        : 'Sisa Pelunasan saat Pengambilan / Kembali:'}
                    </span>
                    <div className="text-sm font-black text-rose-600">
                      Rp {remainingBalance.toLocaleString('id-ID')}
                    </div>
                  </div>
                  {paidAmount === 0 ? (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-300 text-[10px] font-black text-right">
                      BAYAR FULL SAAT KEMBALI
                    </span>
                  ) : remainingBalance === 0 ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      ✓ LUNAS SEPENUHNYA
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 text-[10px] font-black">
                      DP DITERIMA
                    </span>
                  )}
                </div>

                {/* Metode Pembayaran (Hanya relevan jika ada uang dibayar sekarang) */}
                {paidAmount > 0 && (
                  <div className="space-y-1 pt-1 animate-in fade-in">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Metode Pembayaran DP / Pelunasan:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['CASH', 'QRIS', 'TRANSFER'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                            paymentMethod === m
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {m === 'CASH' ? 'Tunai' : m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          </div>

          {/* Modal Actions Footer (Pinned Bottom di Mobile & Desktop) */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-300 shrink-0 flex items-center justify-between gap-3 shadow-lg z-10">
            <div className="hidden sm:block">
              <span className="text-[11px] text-slate-500 font-medium block">Total Nilai Kontrak:</span>
              <span className="text-base font-black text-slate-900">
                Rp {grandTotalDueToday.toLocaleString('id-ID')}
              </span>
              {paidAmount === 0 && (
                <span className="text-[10px] text-indigo-700 font-bold block">Bayar Full Nanti Saat Kembali</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-3 px-4 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer shrink-0"
              >
                Batal / Kembali
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !customerName.trim()}
                className={`flex-1 sm:flex-initial py-3 px-6 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                  isSubmitting || !customerName.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-95'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menerbitkan Kontrak...
                  </span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Terbitkan Kontrak &amp; Cetak Nota</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default RentalCheckoutModal;
