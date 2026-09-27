import React, { useState } from 'react';
import { X, DollarSign, CreditCard, Building2, CheckCircle2, Clock } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any | null;
  onSuccess?: () => void;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSuccess
}) => {
  const { token } = usePOS();
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState<number>(invoice?.remainingAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'DANA_PRIBADI_OWNER'>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Sync initial amount when invoice changes
  React.useEffect(() => {
    if (invoice) {
      setAmount(invoice.remainingAmount || 0);
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payVal = Number(amount);
    if (isNaN(payVal) || payVal <= 0) {
      toast('Nominal pembayaran harus lebih besar dari 0', 'error');
      return;
    }

    if (payVal > invoice.remainingAmount) {
      toast(`Nominal melebihi sisa hutang (${formatCurrency(invoice.remainingAmount)})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bengkel/supplier-invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: payVal,
          paymentMethod,
          paymentDate,
          referenceNo: referenceNo.trim() || null,
          notes: notes.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran');
      }

      toast(data.message || 'Pembayaran berhasil dicatat!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Gagal memproses pembayaran', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base leading-tight">
                Bayar / Cicil Hutang Nota Supplier
              </h3>
              <p className="text-slate-500 text-xs">
                Catat pelunasan faktur. Kas pengeluaran toko akan tercatat otomatis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* INFO NOTA CARD */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">No. Faktur Supplier:</span>
              <span className="font-black text-slate-800 text-sm">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Supplier:</span>
              <span className="font-bold text-slate-700">{invoice.supplier?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-slate-500">Total Tagihan Nota:</span>
              <span className="font-bold text-slate-800">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Sudah Dibayar:</span>
              <span className="font-bold text-emerald-600">{formatCurrency(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200 text-sm">
              <span className="font-bold text-rose-600">Sisa Hutang:</span>
              <span className="font-black text-rose-600">{formatCurrency(invoice.remainingAmount)}</span>
            </div>
          </div>

          {/* INPUT NOMINAL BAYAR */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Jumlah Bayar (Rp) *
              </label>
              <button
                type="button"
                onClick={() => setAmount(invoice.remainingAmount)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Bayar Lunas ({formatCurrency(invoice.remainingAmount)})
              </button>
            </div>
            <input
              type="number"
              min="1"
              max={invoice.remainingAmount}
              value={amount || ''}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              required
              className="w-full h-11 px-3 text-base font-black text-slate-900 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* METODE PEMBAYARAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Metode Pembayaran *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 ${
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 size={16} />
                <span>Transfer Bank</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <DollarSign size={16} />
                <span>Kas Laci Toko</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('DANA_PRIBADI_OWNER')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 ${
                  paymentMethod === 'DANA_PRIBADI_OWNER'
                    ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard size={16} />
                <span>Dana Owner</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 italic">
              {paymentMethod === 'DANA_PRIBADI_OWNER'
                ? 'Dana pribadi tidak akan memotong saldo pembukuan kas laci harian toko.'
                : 'Otomatis dicatat sebagai Pengeluaran di Buku Arus Kas.'}
            </p>
          </div>

          {/* TANGGAL & REFERENSI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tanggal Pembayaran *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                No. Ref / Bukti Transfer
              </label>
              <input
                type="text"
                placeholder="Contoh: TRF-88123"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* CATATAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Catatan Tambahan
            </label>
            <input
              type="text"
              placeholder="Contoh: Pembayaran cicilan termin ke-1"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none"
            />
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi Pembayaran Hutang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default SupplierPaymentModal;
