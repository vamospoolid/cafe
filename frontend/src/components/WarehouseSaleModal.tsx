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
  AlertCircle,
  Coins,
  Receipt,
  CheckCircle2,
  FileText
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
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-fade-in text-slate-900">
      {/* Top Header Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Kembali ke Gudang</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
                <TrendingUp size={18} />
              </span>
              <span>Penjualan Grosir B2B &bull; Pihak Luar</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              Stok Gudang Pusat berkurang &bull; Uang masuk Rekening Pemilik (Kasir Kafe Rp 0)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save size={16} />
            <span>{loading ? 'Menyimpan...' : 'Simpan & Terbitkan Faktur'}</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Body */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto w-full pb-32">
          {/* Responsive 2-Column Grid on Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ─── KOLOM KIRI: Data Pembeli & Info Transaksi (4 Kolom pada LG) ─── */}
            <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-0">
              {/* Card Informasi Pembeli */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Building2 size={18} className="text-emerald-600" />
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Informasi Pembeli / Mitra
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Pembeli / Kafe Mitra <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kafe Kopi Jaya / Bpk. Rudi"
                    value={form.customerName}
                    onChange={e => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm font-semibold text-slate-900 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="0812xxxxxxxx"
                      value={form.customerPhone}
                      onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm font-semibold text-slate-900 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <div className="relative">
                    <CreditCard size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <select
                      value={form.paymentMethod}
                      onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm font-bold text-slate-800 bg-white"
                    >
                      <option value="TRANSFER">Transfer Bank Pusat (BCA/Mandiri)</option>
                      <option value="CASH_OWNER">Tunai di Kantor Gudang Pusat</option>
                      <option value="TEMPO">Tempo / Piutang Mitra</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Pengiriman / Serah Terima
                  </label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <textarea
                      rows={2}
                      placeholder="Alamat toko atau lokasi penyerahan barang..."
                      value={form.customerAddress}
                      onChange={e => setForm({ ...form, customerAddress: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-medium text-slate-800 bg-white resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Faktur
                  </label>
                  <input
                    type="text"
                    placeholder="No PO / Keterangan kurir..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs font-medium text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Card Ringkasan Finansial Samping */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Coins size={14} className="text-amber-400" /> Ringkasan Nilai
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {form.items.length} Barang
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Total Tagihan Jual:</span>
                    <span className="font-black text-white text-base">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>HPP Modal Beli:</span>
                    <span>{formatCurrency(totalHpp)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="font-bold text-emerald-400 text-xs">Laba Bersih Grosir:</span>
                    <div className="text-right">
                      <span className="font-black text-emerald-400 text-sm sm:text-base">+{formatCurrency(grossProfit)}</span>
                      <span className="block text-[10px] text-emerald-300/80 font-bold">Margin: {profitMarginPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── KOLOM KANAN: Daftar Item Bahan Yang Dikeluarkan (8 Kolom pada LG) ─── */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-emerald-600" />
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    Daftar Barang Keluar Gudang ({form.items.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200/60 shadow-2xs"
                >
                  <Plus size={14} /> Tambah Item Lain
                </button>
              </div>

              {/* Items Container */}
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
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all p-4 sm:p-5 space-y-4"
                    >
                      {/* Item Card Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-black text-[11px]">
                            #{idx + 1}
                          </span>
                          <span className="font-extrabold text-sm text-slate-800">
                            {it.itemName || 'Pilih Bahan Baku'}
                          </span>
                          {selected && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isOutOfStock 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              Stok Gudang: {selected.warehouseStock} {selected.unit}
                            </span>
                          )}
                        </div>

                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Bahan & Satuan Grosir */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Pilih Bahan (7 Kolom) */}
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Pilih Bahan Baku di Gudang <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={it.ingredientId}
                            onChange={e => handleItemChange(idx, 'ingredientId', e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm font-bold text-slate-800 bg-white"
                            required
                          >
                            <option value="">-- Pilih Bahan Baku Gudang --</option>
                            {stockList.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} &bull; Sisa: {s.warehouseStock} {s.unit} (HPP: Rp {Math.round(s.buyPrice).toLocaleString('id-ID')})
                              </option>
                            ))}
                          </select>
                          {isOutOfStock && (
                            <div className="mt-1 text-[11px] text-rose-600 font-bold flex items-center gap-1">
                              <AlertCircle size={12} />
                              <span>Stok gudang tidak cukup! Dibutuhkan: {requiredBase} {selected?.unit}</span>
                            </div>
                          )}
                        </div>

                        {/* Satuan Jual Grosir (5 Kolom) */}
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Satuan Jual Grosir
                          </label>
                          <input
                            type="text"
                            value={it.saleUnit}
                            onChange={e => handleItemChange(idx, 'saleUnit', e.target.value)}
                            placeholder="Karton / Dus / Pak"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                          />
                          {/* Quick Chips */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {COMMON_WHOLESALE_UNITS.map(u => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => handleItemChange(idx, 'saleUnit', u)}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                  it.saleUnit === u
                                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Baris Konversi & Pemotongan */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">1 {it.saleUnit || 'Satuan'} berisi:</span>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={it.conversionRatio}
                            onChange={e => handleItemChange(idx, 'conversionRatio', Number(e.target.value))}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-800 text-center"
                          />
                          <span className="font-bold text-slate-700">{selected?.unit || 'satuan dasar'}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          Total dipotong dari gudang: <strong className="text-indigo-700">{requiredBase} {selected?.unit || ''}</strong>
                        </div>
                      </div>

                      {/* Baris Finansial (Qty, HPP, Harga Jual, Laba) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                        {/* Qty Jual */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                            Qty Jual ({it.saleUnit})
                          </label>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={it.saleQty}
                            onChange={e => handleItemChange(idx, 'saleQty', Number(e.target.value))}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-900"
                            required
                          />
                        </div>

                        {/* HPP Modal Beli */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                            HPP Modal (per {it.saleUnit})
                          </label>
                          <input
                            type="number"
                            value={it.unitCostPrice}
                            onChange={e => handleItemChange(idx, 'unitCostPrice', Number(e.target.value))}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600"
                          />
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Total HPP: {formatCurrency(subCost)}
                          </span>
                        </div>

                        {/* Harga Jual Grosir */}
                        <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200/80">
                          <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-0.5">
                            Harga Jual Grosir <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={it.unitSalePrice}
                            onChange={e => handleItemChange(idx, 'unitSalePrice', Number(e.target.value))}
                            className="w-full px-2 py-1 rounded-lg border border-emerald-300 focus:ring-2 focus:ring-emerald-200 bg-white text-sm font-black text-emerald-800"
                            required
                          />
                          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                            Subtotal: {formatCurrency(subTotal)}
                          </span>
                        </div>

                        {/* Laba Bersih Item */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Laba Kotor Item
                          </span>
                          <span className="text-sm font-black text-emerald-600">
                            +{formatCurrency(profit)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Margin: {subTotal > 0 ? ((profit / subTotal) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tombol Tambah Item Besar */}
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 text-slate-600 hover:text-emerald-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} /> Tambah Baris Bahan Baku Lain
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Sticky Bottom Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Tagihan Penjualan B2B</span>
            <span className="text-lg sm:text-xl font-black text-slate-900">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Estimasi Laba Kotor Grosir</span>
            <span className="text-lg sm:text-xl font-black text-emerald-600 flex items-center gap-1.5">
              +{formatCurrency(grossProfit)}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {profitMarginPercent}% Margin
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="w-2/3 sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save size={16} />
            <span>{loading ? 'Menyimpan...' : 'Simpan & Terbitkan Faktur'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
