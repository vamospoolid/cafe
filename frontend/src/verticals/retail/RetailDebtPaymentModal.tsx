import React, { useState } from 'react';
import {
  X,
  Wallet,
  User,
  DollarSign,
  Printer,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Building2,
  Phone
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { printDebtPaymentThermalSlip, type DebtPaymentReceiptData } from '../../utils/retailDebtReceipt';

interface CustomerCreditData {
  id: number;
  name: string;
  phone?: string;
  totalDebt: number;
  creditLimit?: number;
  isCreditBlocked?: boolean;
}

interface RetailDebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerCreditData | null;
  onPaymentSuccess?: () => void;
}

export const RetailDebtPaymentModal: React.FC<RetailDebtPaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  onPaymentSuccess
}) => {
  const { token, settings, user } = usePOS();

  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'TRANSFER' | 'QRIS'>('TUNAI');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successReceipt, setSuccessReceipt] = useState<DebtPaymentReceiptData | null>(null);

  if (!isOpen || !customer) return null;

  const totalDebt = customer.totalDebt || 0;
  const formatRupiah = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const quickAmounts = [
    { label: '50 Ribu', value: 50000 },
    { label: '100 Ribu', value: 100000 },
    { label: '250 Ribu', value: 250000 },
    { label: '500 Ribu', value: 500000 },
    { label: '1 Juta', value: 1000000 },
    { label: 'Lunasi Semua', value: totalDebt },
  ];

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const payNum = Number(amountPaid);
    if (!payNum || payNum <= 0) {
      toast('Masukkan nominal pembayaran yang valid.', 'error');
      return;
    }

    if (payNum > totalDebt) {
      toast(`Nominal bayar tidak boleh melebihi sisa piutang (${formatRupiah(totalDebt)}).`, 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/retail/customers/${customer.id}/pay-debt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amountPaid: payNum,
          paymentMethod,
          notes
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal memproses pembayaran piutang');
      }

      const data: DebtPaymentReceiptData = await res.json();
      setSuccessReceipt(data);
      toast(`Pembayaran piutang ${formatRupiah(payNum)} berhasil dicatat!`, 'success');
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSlip = () => {
    if (!successReceipt) return;
    printDebtPaymentThermalSlip(
      settings,
      successReceipt,
      (user as any)?.name || user?.username || 'Kasir Retail'
    );
  };

  const handleResetAndClose = () => {
    setAmountPaid('');
    setNotes('');
    setSuccessReceipt(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col transition-all">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/20">
                  KASIR PIUTANG BON
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {customer.name}
                </span>
              </div>
              <h3 className="font-black text-base sm:text-lg text-white mt-0.5">
                Penerimaan Pembayaran Bon
              </h3>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Jika Pembayaran Sukses Diterima */}
        {successReceipt ? (
          <div className="p-6 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900">
                Pembayaran Piutang Berhasil!
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                No. Bukti: <b className="font-mono">{successReceipt.receiptNumber}</b>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pelanggan:</span>
                <span className="font-bold text-slate-800">{successReceipt.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Dibayar:</span>
                <span className="font-black text-emerald-600">{formatRupiah(successReceipt.paymentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Metode Bayar:</span>
                <span className="font-bold text-slate-800">{successReceipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-rose-600">Sisa Total Piutang:</span>
                <span className="font-black text-rose-700">{formatRupiah(successReceipt.remainingTotalDebt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrintSlip}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>Cetak Struk Thermal</span>
              </button>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        ) : (
          /* Form Input Pembayaran */
          <form onSubmit={handleSubmitPayment} className="p-4 sm:p-6 space-y-4">
            
            {/* Box Ringkasan Piutang Pelanggan */}
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider block">
                  Total Sisa Piutang Aktif
                </span>
                <span className="text-xl font-black text-rose-600 block mt-0.5">
                  {formatRupiah(totalDebt)}
                </span>
                {customer.phone && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                    <Phone size={11} /> {customer.phone}
                  </span>
                )}
              </div>
              {customer.creditLimit ? (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Plafon Limit</span>
                  <span className="text-xs font-bold text-slate-700">{formatRupiah(customer.creditLimit)}</span>
                </div>
              ) : null}
            </div>

            {/* Input Nominal Pembayaran */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                Nominal yang Disetorkan (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  Rp
                </span>
                <input
                  type="number"
                  min="1"
                  max={totalDebt}
                  placeholder="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 border-slate-200 focus:border-rose-500 text-lg font-black text-slate-900 focus:outline-none"
                  required
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setAmountPaid(Math.min(q.value, totalDebt))}
                    className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-[11px] font-bold text-slate-600 transition-all text-center cursor-pointer"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pilihan Metode Pembayaran */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1.5">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'TUNAI', label: '💵 Tunai' },
                  { id: 'TRANSFER', label: '🏦 Transfer' },
                  { id: 'QRIS', label: '📱 QRIS' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      paymentMethod === m.id
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Titipan via sopir atau transfer bukti mandiri..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            {/* Footer Form Action */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={loading || !amountPaid || Number(amountPaid) <= 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-rose-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Terima Setoran {amountPaid ? formatRupiah(Number(amountPaid)) : ''}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
