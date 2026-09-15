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
  Store,
  Info,
  CheckCircle2
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

    // Validasi stok gudang
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
      {/* Top Sticky Header */}
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
              <span>Form Penjualan Grosir B2B &bull; Pihak Luar &amp; Mitra</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              Keluarkan stok Gudang Pusat &bull; Pembayaran masuk Rekening Pemilik (Kasir Kafe Rp 0)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
          
          {/* Card 1: Informasi Pembeli & Mitra */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Building2 size={18} />
                </span>
                <div>
                  <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
                    Informasi Pembeli / Mitra &amp; Pembayaran
                  </h2>
                  <p className="text-xs text-slate-400">
                    Data toko, kontak penerima barang, dan rekening tujuan pembayaran grosir
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Faktur Penjualan Luar B2B
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Nama Pembeli */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Pembeli / Kafe Mitra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kafe Kopi Jaya / Bpk. Rudi"
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all"
                  required
                />
              </div>

              {/* No WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp / HP
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={form.customerPhone}
                    onChange={e => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full py-2.5 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Metode Bayar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full py-2.5 pl-9 pr-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all"
                  >
                    <option value="TRANSFER">Transfer Bank Pusat (BCA/Mandiri)</option>
                    <option value="CASH_OWNER">Tunai di Kantor Gudang Pusat</option>
                    <option value="TEMPO">Tempo / Piutang Mitra</option>
                  </select>
                </div>
              </div>

              {/* Alamat & Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alamat / Catatan Pengiriman
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Alamat penyerahan / no PO..."
                    value={form.customerAddress}
                    onChange={e => setForm({ ...form, customerAddress: e.target.value })}
                    className="w-full py-2.5 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Info Box Pemisahan Kas */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
              <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Pemisahan Finansial Terjamin:</strong> Transaksi penjualan ini memotong stok fisik di <strong>Gudang Pusat</strong> dan uang pembayaran dicatat ke pos <strong>Rekening Modal Pusat/Owner</strong>. Arus kas harian laci kasir kafe <u>tetap steril (Rp 0)</u> dan tidak terganggu.
              </div>
            </div>
          </div>

          {/* Card 2: Rincian Bahan Baku Yang Dikeluarkan (Smart Card Layout) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Package size={18} />
                </span>
                <div>
                  <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
                    Daftar Bahan Baku Yang Dikeluarkan ({form.items.length} Item)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tentukan kemasan satuan grosir, kuantitas jual, dan harga jual grosir dengan margin keuntungan langsung
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={15} /> + Tambah Bahan Baku
              </button>
            </div>

            {/* List of Item Cards */}
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
                    className={`rounded-2xl border transition-all p-4 sm:p-5 relative ${
                      it.ingredientId
                        ? 'bg-slate-50/50 border-slate-200/90 shadow-xs hover:border-emerald-300'
                        : 'bg-amber-50/20 border-amber-200'
                    }`}
                  >
                    {/* Header Item Card */}
                    <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200/60 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Baris Item #{idx + 1}
                        </span>
                        {selected && (
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700 border-rose-200 font-black'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            Stok Gudang: {selected.warehouseStock} {selected.unit}
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                            <AlertCircle size={12} /> Stok kurang!
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Live Subtotal & Margin */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                            Subtotal Jual / Laba
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {formatCurrency(subTotal)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 ml-1.5">
                            (+{formatCurrency(profit)})
                          </span>
                        </div>

                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 transition-colors ml-1 cursor-pointer"
                            title="Hapus Baris Ini"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Form Fields: Grid 12 Kolom Responsive */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-start">
                      {/* Sisi 1: Pilih Bahan Baku (4 Kolom) */}
                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Pilih Bahan Baku di Gudang <span className="text-rose-500">*</span>
                        </label>
                        <select
                          className="w-full py-2.5 px-3 bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none shadow-2xs"
                          value={it.ingredientId}
                          onChange={e => handleItemChange(idx, 'ingredientId', e.target.value)}
                          required
                        >
                          <option value="">-- Pilih Bahan Baku Gudang --</option>
                          {stockList.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (Stok: {s.warehouseStock} {s.unit})
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Satuan dasar dapur: <strong>{selected?.unit || '-'}</strong>
                        </span>
                      </div>

                      {/* Sisi 2: Satuan Grosir & Quick Presets (3 Kolom) */}
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Satuan Jual Grosir
                        </label>
                        <input
                          type="text"
                          className="w-full py-2.5 px-3 bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none shadow-2xs"
                          placeholder="Karton / Dus / Pak"
                          value={it.saleUnit}
                          onChange={e => handleItemChange(idx, 'saleUnit', e.target.value)}
                        />
                        {/* Quick Chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {COMMON_WHOLESALE_UNITS.slice(0, 6).map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => handleItemChange(idx, 'saleUnit', u)}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                it.saleUnit === u
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sisi 3: Konversi Isi per Satuan (2 Kolom) */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Isi per 1 {it.saleUnit || 'Satuan'}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            className="w-full py-2.5 px-2 bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-black text-slate-800 text-center outline-none shadow-2xs"
                            value={it.conversionRatio}
                            onChange={e => handleItemChange(idx, 'conversionRatio', Number(e.target.value))}
                          />
                          <span className="text-xs text-slate-500 font-bold whitespace-nowrap">
                            {selected?.unit || 'dasar'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Total potong: <strong>{requiredBase} {selected?.unit || ''}</strong>
                        </span>
                      </div>

                      {/* Sisi 4: Qty, HPP & Harga Jual Grosir (3 Kolom) */}
                      <div className="md:col-span-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">
                              Qty Jual ({it.saleUnit})
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              className="w-full py-1.5 px-2 bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-black text-slate-900 outline-none text-center"
                              value={it.saleQty}
                              onChange={e => handleItemChange(idx, 'saleQty', Number(e.target.value))}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">
                              HPP Beli (Pusat)
                            </label>
                            <input
                              type="number"
                              className="w-full py-1.5 px-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none text-right"
                              value={it.unitCostPrice}
                              onChange={e => handleItemChange(idx, 'unitCostPrice', Number(e.target.value))}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-emerald-800 uppercase">
                            Harga Jual Grosir (per {it.saleUnit}) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            className="w-full py-2 px-3 bg-white border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-black text-emerald-800 outline-none text-right shadow-2xs"
                            value={it.unitSalePrice}
                            onChange={e => handleItemChange(idx, 'unitSalePrice', Number(e.target.value))}
                            required
                          />
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

      {/* Sticky Bottom Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Nilai Penjualan B2B</span>
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
