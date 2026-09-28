import React, { useState, useEffect } from 'react';
import { X, ClipboardList, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

interface PartRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPartName?: string;
  initialBrand?: string;
  initialProductId?: number | null;
}

export const PartRequestModal: React.FC<PartRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPartName = '',
  initialBrand = '',
  initialProductId = null
}) => {
  const { token } = usePOS();
  const [products, setProducts] = useState<any[]>([]);

  const [partName, setPartName] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('MOTOR');
  const [requestedQty, setRequestedQty] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const [productSearch, setProductSearch] = useState<string>('');
  const [showProductSuggestions, setShowProductSuggestions] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && token) {
      fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const prods = Array.isArray(data) ? data : data.products || [];
          setProducts(prods);
        })
        .catch(() => {});
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (isOpen) {
      setPartName(initialPartName);
      setBrand(initialBrand);
      setSelectedProductId(initialProductId);
      setVehicleType('MOTOR');
      setRequestedQty(1);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setProductSearch(initialPartName);
    }
  }, [isOpen, initialPartName, initialBrand, initialProductId]);

  if (!isOpen) return null;

  // Filter products for linking
  const matchedProducts = productSearch.trim()
    ? (products || []).filter((p: any) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
      ).slice(0, 5)
    : [];

  const handleSelectExistingProduct = (p: any) => {
    setSelectedProductId(p.id);
    setPartName(p.name);
    if (p.brand) setBrand(p.brand);
    if (p.vehicleType) setVehicleType(p.vehicleType);
    setShowProductSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) {
      toast('Nama suku cadang wajib diisi', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/bengkel/part-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          partName: partName.trim(),
          brand: brand.trim() || null,
          vehicleType,
          requestedQty: Number(requestedQty) || 1,
          notes: notes.trim() || null,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          productId: selectedProductId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan catatan permintaan');
      }

      toast('Catatan permintaan berhasil disimpan ke buku belanja!', 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Catat Permintaan Suku Cadang</h3>
              <p className="text-xs text-slate-400">Buku defecta / barang kosong dicari konsumen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Quick link to existing product */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Suku Cadang <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={partName}
                onChange={(e) => {
                  setPartName(e.target.value);
                  setProductSearch(e.target.value);
                  setShowProductSuggestions(true);
                  if (selectedProductId) setSelectedProductId(null);
                }}
                onFocus={() => setShowProductSuggestions(true)}
                placeholder="Contoh: Kampas Rem Depan Vario 125, Busi Iridium..."
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-medium"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search size={16} />
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showProductSuggestions && matchedProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden divide-y divide-slate-100">
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                  <span>Pilih dari Master Katalog (Stok 0)</span>
                  <span className="text-[10px] text-slate-400">Hubungkan otomatis</span>
                </div>
                {matchedProducts.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectExistingProduct(p)}
                    className="w-full px-3 py-2 text-left hover:bg-amber-50/70 transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="text-slate-500 ml-2">({p.brand || 'No Brand'})</span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                      Sisa: {p.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedProductId && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Terhubung ke katalog produk ID #{selectedProductId}</span>
              </div>
            )}
          </div>

          {/* Merk & Jenis Kendaraan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Merk / Brand Yang Dicari
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="AHM, Aspira, Motul, Daytona..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Kendaraan
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
              >
                <option value="MOTOR">Sepeda Motor</option>
                <option value="MOBIL">Mobil</option>
                <option value="UMUM">Umum / Semua</option>
              </select>
            </div>
          </div>

          {/* Qty & Catatan */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Dicari
              </label>
              <input
                type="number"
                min="1"
                required
                value={requestedQty}
                onChange={(e) => setRequestedQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Spesifikasi Tambahan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Ukuran 100/80-14, Part racing..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Kontak Pelanggan (Opsional) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <AlertCircle size={14} className="text-amber-500" />
              <span>Info Kontak Konsumen (Opsional)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Isi jika pelanggan meminta dihubungi via WhatsApp saat barang sudah dibelanjakan dari Makassar.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Pelanggan"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="No WhatsApp / HP"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Catatan Permintaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartRequestModal;
