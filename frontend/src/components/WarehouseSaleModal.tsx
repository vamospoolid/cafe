import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  TrendingUp, 
  Package, 
  Building2, 
  Phone, 
  MapPin, 
  CreditCard, 
  AlertCircle 
} from 'lucide-react';
import { toast } from '../utils/alert';

interface WarehouseSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stockList: any[];
  token?: string | null;
}

const COMMON_WHOLESALE_UNITS = ['Karton', 'Dus', 'Pak', 'Karung', 'Jerigen', 'Bal', 'Kaleng', 'Kg', 'Liter'];

export default function WarehouseSaleModal({
  isOpen,
  onClose,
  onSuccess,
  stockList,
  token
}: WarehouseSaleModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    paymentMethod: 'TRANSFER',
    paymentStatus: 'PAID',
    notes: '',
    items: [
      {
        ingredientId: '',
        itemName: '',
        saleUnit: 'Karton',
        saleQty: 1,
        conversionRatio: 1,
        unitCostPrice: 0,
        unitSalePrice: 0
      }
    ]
  });

  if (!isOpen) return null;

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ingredientId: '',
          itemName: '',
          saleUnit: 'Karton',
          saleQty: 1,
          conversionRatio: 1,
          unitCostPrice: 0,
          unitSalePrice: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (form.items.length <= 1) {
      toast('Minimal harus ada satu item penjualan', 'warning');
      return;
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setForm(prev => {
      const nextItems = [...prev.items];
      const current = { ...nextItems[index], [field]: value };

      if (field === 'ingredientId') {
        const selected = stockList.find(s => s.id === Number(value));
        if (selected) {
          current.itemName = selected.name;
          current.saleUnit = selected.purchaseUnit || 'Karton';
          current.conversionRatio = selected.conversionRatio || 1;
          const hpp = (selected.buyPrice || 0) * (selected.conversionRatio || 1);
          current.unitCostPrice = hpp;
          // Default harga jual grosir: markup 25%
          current.unitSalePrice = Math.round(hpp * 1.25);
        }
      }

      if (field === 'conversionRatio') {
        const selected = stockList.find(s => s.id === Number(current.ingredientId));
        if (selected) {
          const ratio = Number(value) || 1;
          const hpp = (selected.buyPrice || 0) * ratio;
          current.unitCostPrice = hpp;
        }
      }

      nextItems[index] = current;
      return { ...prev, items: nextItems };
    });
  };

  // Grand totals
  const totalAmount = form.items.reduce((sum, it) => sum + (Number(it.saleQty) || 0) * (Number(it.unitSalePrice) || 0), 0);
  const totalHpp = form.items.reduce((sum, it) => sum + (Number(it.saleQty) || 0) * (Number(it.unitCostPrice) || 0), 0);
  const grossProfit = totalAmount - totalHpp;
  const profitMarginPercent = totalAmount > 0 ? ((grossProfit / totalAmount) * 100).toFixed(1) : '0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerName.trim()) {
      toast('Nama pembeli / mitra wajib diisi', 'warning');
      return;
    }

    if (form.items.some(it => !it.ingredientId)) {
      toast('Pilih bahan baku untuk semua baris item', 'warning');
      return;
    }

    // Validasi stok
    for (const it of form.items) {
      const ing = stockList.find(s => s.id === Number(it.ingredientId));
      if (ing) {
        const requiredBase = (Number(it.saleQty) || 0) * (Number(it.conversionRatio) || 1);
        if (ing.warehouseStock < requiredBase) {
          toast(`Stok gudang untuk ${ing.name} tidak cukup (tersedia ${ing.warehouseStock} ${ing.unit}, butuh ${requiredBase} ${ing.unit})`, 'error');
          return;
        }
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (res.ok) {
        toast(`✅ Penjualan B2B (${data.sale?.invoiceNumber || ''}) berhasil disimpan!`, 'success');
        onSuccess();
        onClose();
      } else {
        toast(data.error || 'Gagal menyimpan transaksi penjualan B2B', 'error');
      }
    } catch (err: any) {
      console.error(err);
      toast('Terjadi gangguan jaringan saat menyimpan penjualan', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* Top Sticky Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
                <TrendingUp size={18} />
              </span>
              <span>Form Penjualan Grosir B2B (Pihak Luar / Mitra)</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              Keluarkan stok Gudang Pusat ke pihak luar &bull; Hasil pembayaran masuk Rekening Pusat / Owner (Kasir Rp 0)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer hidden sm:block"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save size={16} />
            <span>{loading ? 'Menyimpan...' : 'Simpan & Terbitkan Faktur'}</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Body */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto w-full space-y-6 pb-28">
          {/* Card 1: Data Pelanggan / Mitra Luar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <Building2 size={18} className="text-emerald-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Informasi Pembeli / Mitra Luar
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pembeli / Kafe Mitra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kafe Kopi Jaya / Bpk. Hendra"
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={form.customerPhone}
                    onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Metode Pembayaran
                </label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-3 top-3 text-slate-400" />
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-semibold"
                  >
                    <option value="TRANSFER">Transfer Bank Pusat (BCA/Mandiri)</option>
                    <option value="CASH_OWNER">Tunai di Kantor Pusat</option>
                    <option value="TEMPO">Tempo / Piutang Mitra</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Pengiriman / Serah Terima
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Alamat outlet penerima barang..."
                    value={form.customerAddress}
                    onChange={e => setForm({ ...form, customerAddress: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Keterangan Order
                </label>
                <input
                  type="text"
                  placeholder="No PO mitra / keterangan kurir..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Daftar Item Barang Yang Dijual */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-emerald-600" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Item Bahan Baku Yang Dikeluarkan &bull; {form.items.length} Item
                </h2>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
              >
                <Plus size={14} /> Tambah Item Lain
              </button>
            </div>

            <div className="space-y-4">
              {form.items.map((it, idx) => {
                const selected = stockList.find(s => s.id === Number(it.ingredientId));
                const requiredBase = (Number(it.saleQty) || 0) * (Number(it.conversionRatio) || 1);
                const isOutOfStock = selected && selected.warehouseStock < requiredBase;
                const subCost = (Number(it.saleQty) || 0) * (Number(it.unitCostPrice) || 0);
                const subTotal = (Number(it.saleQty) || 0) * (Number(it.unitSalePrice) || 0);
                const profit = subTotal - subCost;

                return (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-slate-50/50 transition-all space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-emerald-800 bg-emerald-100/60 px-2.5 py-0.5 rounded-md">
                        Item #{idx + 1}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {/* Pilihan Bahan Baku */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Pilih Bahan Baku di Gudang <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={it.ingredientId}
                          onChange={e => handleItemChange(idx, 'ingredientId', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                          required
                        >
                          <option value="">-- Pilih Bahan Baku Gudang --</option>
                          {stockList.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (Tersedia: {s.warehouseStock} {s.unit})
                            </option>
                          ))}
                        </select>
                        {selected && (
                          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span>Sisa di Gudang: <strong>{selected.warehouseStock} {selected.unit}</strong></span>
                            {isOutOfStock && (
                              <span className="text-rose-600 font-black flex items-center gap-0.5">
                                <AlertCircle size={12} /> Stok tidak mencukupi!
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Satuan Grosir & Quick Chips */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Satuan Jual Grosir
                        </label>
                        <input
                          type="text"
                          value={it.saleUnit}
                          onChange={e => handleItemChange(idx, 'saleUnit', e.target.value)}
                          placeholder="Karton / Dus / Pak"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {COMMON_WHOLESALE_UNITS.slice(0, 5).map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => handleItemChange(idx, 'saleUnit', u)}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                                it.saleUnit === u
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Konversi ke Unit Dasar */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Isi per 1 {it.saleUnit || 'Satuan'}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={it.conversionRatio}
                            onChange={e => handleItemChange(idx, 'conversionRatio', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                          />
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {selected?.unit || 'dasar'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Total keluar: <strong>{requiredBase} {selected?.unit || 'dasar'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Baris Harga & Margin */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60 items-center">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Qty Jual ({it.saleUnit})
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={it.saleQty}
                          onChange={e => handleItemChange(idx, 'saleQty', Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          HPP Modal Beli (per {it.saleUnit})
                        </label>
                        <input
                          type="number"
                          value={it.unitCostPrice}
                          onChange={e => handleItemChange(idx, 'unitCostPrice', Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase">
                          Harga Jual Grosir (per {it.saleUnit}) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={it.unitSalePrice}
                          onChange={e => handleItemChange(idx, 'unitSalePrice', Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-emerald-300 focus:ring-2 focus:ring-emerald-200 bg-white text-xs font-black text-emerald-800"
                          required
                        />
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Subtotal:</span>
                          <span className="font-black text-slate-900">{formatCurrency(subTotal)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] mt-0.5">
                          <span className="text-emerald-600 font-bold">Laba:</span>
                          <span className="font-black text-emerald-600">+{formatCurrency(profit)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </main>

      {/* Sticky Bottom Bar Summary */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Nilai Penjualan B2B</span>
            <span className="text-lg sm:text-xl font-black text-slate-900">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Estimasi Laba Kotor Grosir</span>
            <span className="text-lg sm:text-xl font-black text-emerald-600 flex items-center gap-1">
              +{formatCurrency(grossProfit)}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 ml-1">
                {profitMarginPercent}%
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="w-1/2 sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save size={16} />
            <span>{loading ? 'Menyimpan...' : 'Simpan & Terbitkan Faktur'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
