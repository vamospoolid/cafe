import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Trash2, Calendar, Clock, DollarSign, Search, CheckCircle2, AlertCircle, Building2, Package } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

interface SupplierInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplierId?: number;
}

interface InvoiceItemDraft {
  productId: number | '';
  partName: string;
  qty: number;
  buyPrice: number;
  currentStock?: number;
  currentHpp?: number;
}

export const SupplierInvoiceModal: React.FC<SupplierInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSupplierId
}) => {
  const { token } = usePOS();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [supplierId, setSupplierId] = useState<number | ''>(initialSupplierId || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentTerm, setPaymentTerm] = useState('NET_30');
  const [customDueDate, setCustomDueDate] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Item rows
  const [items, setItems] = useState<InvoiceItemDraft[]>([
    { productId: '', partName: '', qty: 1, buyPrice: 0 }
  ]);

  // Search product per row
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Load suppliers and products
  useEffect(() => {
    if (isOpen && token) {
      fetch('/api/suppliers', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSuppliers(data);
        })
        .catch(console.error);

      fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const prods = Array.isArray(data) ? data : data.products || [];
          setProducts(prods);
        })
        .catch(console.error);

      if (initialSupplierId) setSupplierId(initialSupplierId);
    }
  }, [isOpen, token, initialSupplierId]);

  if (!isOpen) return null;

  // Due date estimation
  const getEstimatedDueDate = () => {
    const base = new Date(invoiceDate || new Date());
    if (paymentTerm === 'CASH') return 'Bayar Tunai / COD (Langsung Lunas)';
    if (paymentTerm === 'NET_7') {
      base.setDate(base.getDate() + 7);
      return `7 Hari (${base.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    if (paymentTerm === 'NET_14') {
      base.setDate(base.getDate() + 14);
      return `14 Hari (${base.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    if (paymentTerm === 'NET_30') {
      base.setDate(base.getDate() + 30);
      return `30 Hari (${base.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    if (paymentTerm === 'NET_60') {
      base.setDate(base.getDate() + 60);
      return `60 Hari (${base.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    if (paymentTerm === 'CUSTOM' && customDueDate) {
      return new Date(customDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return '-';
  };

  // Item row operations
  const handleAddItem = () => {
    setItems(prev => [...prev, { productId: '', partName: '', qty: 1, buyPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast('Minimal harus ada 1 suku cadang', 'error');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectProduct = (index: number, product: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = {
        productId: product.id,
        partName: product.name,
        qty: copy[index].qty || 1,
        buyPrice: product.buyPrice || 0,
        currentStock: product.stock || 0,
        currentHpp: product.buyPrice || 0
      };
      return copy;
    });
    setActiveSearchIndex(null);
    setItemSearchQuery('');
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceItemDraft, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + ((item.qty || 0) * (item.buyPrice || 0)), 0);
  const totalAmount = subtotal + (Number(taxAmount) || 0);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast('Silakan pilih supplier', 'error');
      return;
    }
    if (!invoiceNumber.trim()) {
      toast('Nomor nota fisik supplier wajib diisi', 'error');
      return;
    }

    const validItems = items.filter(i => i.productId && i.qty > 0);
    if (validItems.length === 0) {
      toast('Pilih minimal 1 suku cadang yang valid dengan qty > 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId: Number(supplierId),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        paymentTerm,
        customDueDate: paymentTerm === 'CUSTOM' ? customDueDate : null,
        taxAmount: Number(taxAmount) || 0,
        receivedBy: receivedBy.trim() || null,
        notes: notes.trim() || null,
        items: validItems.map(i => ({
          productId: Number(i.productId),
          partName: i.partName,
          qty: Number(i.qty),
          buyPrice: Number(i.buyPrice)
        }))
      };

      const res = await fetch('/api/bengkel/supplier-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan faktur');
      }

      toast(data.message || 'Faktur pembelian berhasil dicatat!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base sm:text-lg leading-tight">
                Input Faktur Pembelian / Nota Masuk
              </h3>
              <p className="text-slate-500 text-xs">
                Catat surat jalan & nota tempo distributor. Stok bertambah dan HPP dihitung ulang otomatis.
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

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* INFORMASI FAKTUR & SUPPLIER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/70">
            {/* Supplier */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Supplier / Toko Grosir *
              </label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(Number(e.target.value) || '')}
                required
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">-- Pilih Distributor / Toko Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.contact ? `(PIC: ${s.contact})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Nomor Faktur Fisik */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                No. Faktur / Surat Jalan *
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="Contoh: INV-MKS-8821"
                required
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Tanggal Nota */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Tanggal Nota Fisik *
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Termin Pembayaran (TOP) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Termin Pembayaran (TOP)
              </label>
              <select
                value={paymentTerm}
                onChange={e => setPaymentTerm(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="CASH">Tunai / COD (Langsung Lunas)</option>
                <option value="NET_7">Net 7 Hari</option>
                <option value="NET_14">Net 14 Hari (2 Minggu)</option>
                <option value="NET_30">Net 30 Hari (1 Bulan - Standar)</option>
                <option value="NET_60">Net 60 Hari (2 Bulan)</option>
                <option value="CUSTOM">Tanggal Kustom...</option>
              </select>
            </div>

            {/* Tanggal Jatuh Tempo Preview */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Perkiraan Jatuh Tempo
              </label>
              {paymentTerm === 'CUSTOM' ? (
                <input
                  type="date"
                  value={customDueDate}
                  onChange={e => setCustomDueDate(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-amber-300 bg-amber-50/50 text-xs font-bold text-amber-800 focus:outline-none"
                />
              ) : (
                <div className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 flex items-center text-xs font-bold text-slate-700">
                  <Clock size={14} className="mr-1.5 text-amber-600 shrink-0" />
                  <span className="truncate">{getEstimatedDueDate()}</span>
                </div>
              )}
            </div>

            {/* Penerima Barang */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Diterima Oleh (Staf)
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                placeholder="Nama mekanik / admin"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none"
              />
            </div>

            {/* PPN / Pajak */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                PPN / Biaya Tambahan (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={taxAmount || ''}
                onChange={e => setTaxAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* TABEL SUKU CADANG YANG MASUK */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package size={15} className="text-amber-600" />
                Rincian Suku Cadang Masuk ({items.length} Macam)
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1 transition-all"
              >
                <Plus size={14} /> + Tambah Baris Part
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Suku Cadang (Katalog)</th>
                    <th className="py-2.5 px-3 w-28 text-center">Qty Masuk</th>
                    <th className="py-2.5 px-3 w-36 text-right">Harga Modal/Beli (Rp)</th>
                    <th className="py-2.5 px-3 w-36 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item, idx) => {
                    const itemSubtotal = (item.qty || 0) * (item.buyPrice || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 font-bold">{idx + 1}</td>

                        {/* Product Picker */}
                        <td className="py-2.5 px-3 relative">
                          {item.productId ? (
                            <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                              <div>
                                <span className="font-bold text-slate-800 block text-xs">{item.partName}</span>
                                <span className="text-[10px] text-slate-500">
                                  Stok Saat Ini: {item.currentStock ?? '-'} pcs • HPP Lama: {formatCurrency(item.currentHpp || 0)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(idx, 'productId', '')}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2 py-0.5 rounded hover:bg-white"
                              >
                                Ganti
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Ketik nama part atau scan barcode..."
                                  value={activeSearchIndex === idx ? itemSearchQuery : ''}
                                  onFocus={() => {
                                    setActiveSearchIndex(idx);
                                    setItemSearchQuery('');
                                  }}
                                  onChange={e => setItemSearchQuery(e.target.value)}
                                  className="w-full h-9 px-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                                <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
                              </div>

                              {/* Autocomplete Dropdown */}
                              {activeSearchIndex === idx && (
                                <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-30">
                                  {products
                                    .filter(p => 
                                      !itemSearchQuery ||
                                      p.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
                                      (p.barcode && p.barcode.toLowerCase().includes(itemSearchQuery.toLowerCase()))
                                    )
                                    .slice(0, 10)
                                    .map(p => (
                                      <div
                                        key={p.id}
                                        onClick={() => handleSelectProduct(idx, p)}
                                        className="p-2.5 hover:bg-indigo-50/70 border-b border-slate-100 last:border-0 cursor-pointer flex items-center justify-between"
                                      >
                                        <div>
                                          <div className="font-bold text-slate-800 text-xs">{p.name}</div>
                                          <div className="text-[10px] text-slate-500">
                                            {p.brand ? `[${p.brand}] ` : ''}Stok: {p.stock} pcs • HPP: {formatCurrency(p.buyPrice)}
                                          </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                          Pilih
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Qty */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => handleUpdateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full h-9 px-2 text-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                          />
                        </td>

                        {/* Buy Price */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            value={item.buyPrice || ''}
                            onChange={e => handleUpdateItem(idx, 'buyPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0"
                            className="w-full h-9 px-2 text-right rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="py-2.5 px-3 text-right font-black text-slate-800 text-xs">
                          {formatCurrency(itemSubtotal)}
                        </td>

                        {/* Delete Action */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors mx-auto"
                            title="Hapus baris"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* NOTES & SUMMARY FOOTER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Catatan / Keterangan Nota
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Misal: Kiriman ekspedisi Makassar, nomor resi cargo..."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/70 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Barang:</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>PPN / Biaya Tambahan:</span>
                <span className="font-bold">{formatCurrency(taxAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-amber-200">
                <span>Total Tagihan Nota:</span>
                <span className="text-amber-700">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                Status saat simpan:{' '}
                <span className={`font-bold ${paymentTerm === 'CASH' ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {paymentTerm === 'CASH' ? 'LUNAS (Tunai/COD)' : `HUTANG TEMPO (${paymentTerm.replace('_', ' ')})`}
                </span>
              </div>
            </div>
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
              className="btn px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Faktur & Naikkan Stok'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default SupplierInvoiceModal;
