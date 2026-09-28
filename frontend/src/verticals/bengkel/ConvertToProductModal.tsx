import React, { useState, useEffect } from 'react';
import { X, Sparkles, PackagePlus } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

interface ConvertToProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  partRequest: {
    id: string;
    partName: string;
    brand?: string | null;
    vehicleType?: string | null;
    requestedQty: number;
  } | null;
}

export const ConvertToProductModal: React.FC<ConvertToProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  partRequest
}) => {
  const { token } = usePOS();
  const [categories, setCategories] = useState<any[]>([]);

  const [categoryId, setCategoryId] = useState<string>('');
  const [buyPrice, setBuyPrice] = useState<string>('');
  const [sellPriceRetail, setSellPriceRetail] = useState<string>('');
  const [sellPriceMitra, setSellPriceMitra] = useState<string>('');
  const [sellPriceGrosir, setSellPriceGrosir] = useState<string>('');
  const [stock, setStock] = useState<number>(partRequest?.requestedQty || 1);
  const [minStock, setMinStock] = useState<number>(2);
  const [barcode, setBarcode] = useState<string>('');
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (token) {
      fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const cats = Array.isArray(data) ? data : data.categories || [];
          setCategories(cats);
          if (cats.length > 0 && !categoryId) {
            setCategoryId(String(cats[0].id));
          }
        })
        .catch(() => {});
    }
  }, [token]);

  React.useEffect(() => {
    if (isOpen && partRequest) {
      setStock(partRequest.requestedQty || 1);
      setBuyPrice('');
      setSellPriceRetail('');
      setSellPriceMitra('');
      setSellPriceGrosir('');
      setBarcode('');
      setStorageLocation('');
      if (categories && categories.length > 0) {
        setCategoryId(String(categories[0].id));
      }
    }
  }, [isOpen, partRequest, categories]);

  if (!isOpen || !partRequest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      toast('Silakan pilih kategori barang', 'error');
      return;
    }
    if (!sellPriceRetail || Number(sellPriceRetail) <= 0) {
      toast('Harga jual retail wajib diisi', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/bengkel/part-requests/${partRequest.id}/convert-to-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          categoryId: Number(categoryId),
          buyPrice: Number(buyPrice) || 0,
          sellPriceRetail: Number(sellPriceRetail),
          sellPriceMitra: sellPriceMitra ? Number(sellPriceMitra) : null,
          sellPriceGrosir: sellPriceGrosir ? Number(sellPriceGrosir) : null,
          stock: Number(stock) || 0,
          minStock: Number(minStock) || 1,
          barcode: barcode.trim() || null,
          storageLocation: storageLocation.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mendaftarkan produk baru');
      }

      toast(`Suku cadang "${partRequest.partName}" berhasil masuk ke katalog master produk!`, 'success');
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
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-emerald-300">
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Konversi Jadi Produk Baru</h3>
              <p className="text-xs text-emerald-200">
                1-Klik daftarkan barang belanjaan ke master stok katalog
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Item Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Nama Suku Cadang
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{partRequest.partName}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Merk: <span className="font-bold text-slate-700">{partRequest.brand || 'Umum'}</span> | Tipe: <span className="font-bold text-slate-700">{partRequest.vehicleType || 'MOTOR'}</span>
              </div>
            </div>
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-1">
              <Sparkles size={14} /> Baru
            </span>
          </div>

          {/* Kategori & Lokasi Rak */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Kategori Produk <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
              >
                <option value="">Pilih Kategori</option>
                {(categories || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Lokasi Rak / Bin Gudang
              </label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="Contoh: RAK-A1, BIN-03"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Harga Modal & Jual Retail */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Harga Modal Beli (HPP)
              </label>
              <input
                type="number"
                min="0"
                value={buyPrice}
                onChange={(e) => {
                  setBuyPrice(e.target.value);
                  if (!sellPriceRetail && e.target.value) {
                    setSellPriceRetail(String(Math.round(Number(e.target.value) * 1.25)));
                  }
                }}
                placeholder="Rp 0"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Harga Jual UMUM (Retail) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={sellPriceRetail}
                onChange={(e) => setSellPriceRetail(e.target.value)}
                placeholder="Rp 0"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Harga 3-Tier Tambahan */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <span className="font-bold text-slate-700 block text-[11px]">
              Harga Khusus Bertingkat (Opsional)
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Harga Rekanan / MITRA</label>
                <input
                  type="number"
                  min="0"
                  value={sellPriceMitra}
                  onChange={(e) => setSellPriceMitra(e.target.value)}
                  placeholder="Rp Mitra"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Harga GROSIR / Toko</label>
                <input
                  type="number"
                  min="0"
                  value={sellPriceGrosir}
                  onChange={(e) => setSellPriceGrosir(e.target.value)}
                  placeholder="Rp Grosir"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Stok Masuk & Min Stok */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Stok Awal Masuk</label>
              <input
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-center font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Batas Min Stok</label>
              <input
                type="number"
                min="1"
                required
                value={minStock}
                onChange={(e) => setMinStock(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-center font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Barcode / Kode Part</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan / ketik..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-center"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Memproses...' : 'Simpan & Daftarkan ke Katalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConvertToProductModal;
