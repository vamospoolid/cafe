import React, { useState, useEffect, useContext } from 'react';
import { 
  X, DollarSign, Tag, FileText, Sparkles, Layers, Package, 
  ArrowDownRight, ArrowUpRight, RotateCcw, Building2, Check 
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const EXPENSE_CATEGORIES = [
  {
    id: 'Bahan Makanan',
    name: 'Bahan Makanan (Food Ingredients)',
    subcategories: [
      'Daging & Protein (Ayam, Sapi, Ikan, Telur)',
      'Sayuran & Buah Segar',
      'Bumbu Dapur & Minyak Goreng',
      'Sembako & Beras / Tepung',
      'Bahan Makanan Lainnya'
    ]
  },
  {
    id: 'Bahan Minuman',
    name: 'Bahan Minuman (Beverage Ingredients)',
    subcategories: [
      'Biji Kopi & Bubuk Kopi',
      'Susu & Dairy (Fresh Milk, UHT, Keju)',
      'Sirup, Perisa & Simple Syrup',
      'Bubuk Minuman (Matcha, Cokelat, Red Velvet)',
      'Teh & Minuman Seduh',
      'Bahan Minuman Lainnya'
    ]
  },
  {
    id: 'Kemasan & Packaging',
    name: 'Kemasan & Packaging',
    subcategories: [
      'Cup Minuman (Plastic/Paper Cup)',
      'Sedotan & Tutup Cup',
      'Kotak Makanan & Paper Bag / Kantong Plastik',
      'Sendok, Garpu & Tissue',
      'Kemasan Lainnya'
    ]
  },
  {
    id: 'Operasional Cafe',
    name: 'Operasional Cafe (OPEX)',
    subcategories: [
      'Gas LPG & Es Batu Rutin',
      'Listrik, Air & Internet / WiFi',
      'Sabun Cuci, Plastik Sampah & Kebersihan',
      'Sewa Tempat & Izin Usaha',
      'Operasional Lainnya'
    ]
  },
  {
    id: 'SDM & Karyawan',
    name: 'SDM & Tenaga Kerja',
    subcategories: [
      'Gaji Karyawan & Staff',
      'Uang Makan & Lembur Staff',
      'Bonus & Insentif Kasir/Barista',
      'SDM Lainnya'
    ]
  },
  {
    id: 'Perawatan & Aset',
    name: 'Perawatan & Aset (Maintenance)',
    subcategories: [
      'Servis Mesin Kopi / Grinder',
      'Perbaikan Alat Dapur & Kulkas',
      'Pembelian Alat / Perkakas Baru',
      'Lain-lain / Biaya Tak Terduga'
    ]
  }
];

export const INFLOW_CATEGORIES = [
  {
    id: 'Modal & Injeksi',
    name: 'Modal & Injeksi Dana',
    subcategories: [
      'Setoran Modal Awal',
      'Tambahan Modal Kas Kecil'
    ]
  },
  {
    id: 'Pendapatan Non-POS',
    name: 'Pendapatan Non-POS',
    subcategories: [
      'Pendapatan Sewa Tempat / Space Event',
      'Bagi Hasil / Konsinyasi Produk Luar',
      'Penjualan Aset Bekas / Kardus',
      'Pendapatan Lain-lain'
    ]
  }
];

// Helper to convert number to Indonesian words (Terbilang)
const angkaTerbilang = (angka: number): string => {
  if (isNaN(angka) || angka === 0) return '';
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  if (angka < 12) return bilangan[angka];
  if (angka < 20) return `${angkaTerbilang(angka - 10)} Belas`;
  if (angka < 100) return `${angkaTerbilang(Math.floor(angka / 10))} Puluh ${angkaTerbilang(angka % 10)}`.trim();
  if (angka < 200) return `Seratus ${angkaTerbilang(angka - 100)}`.trim();
  if (angka < 1000) return `${angkaTerbilang(Math.floor(angka / 100))} Ratus ${angkaTerbilang(angka % 100)}`.trim();
  if (angka < 2000) return `Seribu ${angkaTerbilang(angka - 1000)}`.trim();
  if (angka < 1000000) return `${angkaTerbilang(Math.floor(angka / 1000))} Ribu ${angkaTerbilang(angka % 1000)}`.trim();
  if (angka < 1000000000) return `${angkaTerbilang(Math.floor(angka / 1000000))} Juta ${angkaTerbilang(angka % 1000000)}`.trim();
  if (angka < 1000000000000) return `${angkaTerbilang(Math.floor(angka / 1000000000))} Miliar ${angkaTerbilang(angka % 1000000000)}`.trim();
  return '';
};

const CashFlowModal: React.FC<CashFlowModalProps> = ({ isOpen, onClose, onSave }) => {
  const posContext = useContext(POSContext);
  const [formData, setFormData] = useState({
    type: 'Pengeluaran',
    amount: 0,
    description: ''
  });
  const [displayAmount, setDisplayAmount] = useState('');
  const [mainCategory, setMainCategory] = useState('Bahan Makanan');
  const [subCategory, setSubCategory] = useState('');
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<any | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && posContext?.token) {
      // Fetch Ingredients
      fetch('/api/ingredients', {
        headers: { Authorization: `Bearer ${posContext.token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setIngredients(data);
        })
        .catch(err => console.error('Failed to load ingredients in CashFlowModal', err));

      // Fetch Suppliers
      fetch('/api/suppliers', {
        headers: { Authorization: `Bearer ${posContext.token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSuppliers(data);
        })
        .catch(err => console.error('Failed to load suppliers in CashFlowModal', err));
    }
  }, [isOpen, posContext?.token]);

  // Reset subcategory when main category or type changes
  useEffect(() => {
    const currentList = formData.type === 'Pengeluaran' ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;
    const currentCatObj = currentList.find(c => c.id === mainCategory);
    if (currentCatObj && currentCatObj.subcategories.length > 0) {
      setSubCategory(currentCatObj.subcategories[0]);
    } else {
      setSubCategory('');
    }
  }, [mainCategory, formData.type]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: string) => {
    setFormData(prev => ({ ...prev, type: newType }));
    if (newType === 'Pengeluaran') {
      setMainCategory(EXPENSE_CATEGORIES[0].id);
    } else {
      setMainCategory(INFLOW_CATEGORIES[0].id);
    }
    setSelectedIngredient(null);
    setSelectedSupplierId('');
  };

  const updateDescription = (ingName: string, stockInfo: string, supplierId: string) => {
    let supPrefix = '';
    if (supplierId) {
      const sup = suppliers.find(s => s.id === Number(supplierId));
      if (sup) supPrefix = `[Supplier: ${sup.name}] `;
    } else if (ingName) {
      supPrefix = `[Belanja Langsung / Retail] `;
    }

    if (ingName) {
      setFormData(prev => ({
        ...prev,
        description: `${supPrefix}Beli Bahan Baku: ${ingName} (${stockInfo})`
      }));
    } else if (supplierId) {
      const sup = suppliers.find(s => s.id === Number(supplierId));
      setFormData(prev => ({
        ...prev,
        description: `[Supplier: ${sup?.name}] Pembelanjaan kebutuhan cafe`
      }));
    }
  };

  const handleIngredientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ingId = e.target.value;
    if (!ingId) {
      setSelectedIngredient(null);
      return;
    }

    const ing = ingredients.find(i => i.id === Number(ingId));
    if (ing) {
      setSelectedIngredient(ing);
      // Auto suggest main category
      if (ing.category === 'DRINK') {
        setMainCategory('Bahan Minuman');
      } else if (ing.category === 'PACKAGING') {
        setMainCategory('Kemasan & Packaging');
      } else {
        setMainCategory('Bahan Makanan');
      }

      // Auto-select linked supplier if available
      const linkedSupId = ing.supplierId ? String(ing.supplierId) : '';
      setSelectedSupplierId(linkedSupId);

      // Pre-fill description
      updateDescription(ing.name, `Stok saat ini: ${ing.stock} ${ing.unit}`, linkedSupId);
    }
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supId = e.target.value;
    setSelectedSupplierId(supId);
    if (selectedIngredient) {
      updateDescription(selectedIngredient.name, `Stok saat ini: ${selectedIngredient.stock} ${selectedIngredient.unit}`, supId);
    } else if (supId) {
      updateDescription('', '', supId);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const num = Number(rawVal) || 0;
    setFormData(prev => ({ ...prev, amount: num }));
    setDisplayAmount(num > 0 ? num.toLocaleString('id-ID') : '');
  };

  const addAmount = (increment: number) => {
    const newAmount = (formData.amount || 0) + increment;
    setFormData(prev => ({ ...prev, amount: newAmount }));
    setDisplayAmount(newAmount.toLocaleString('id-ID'));
  };

  const setExactAmount = (amount: number) => {
    setFormData(prev => ({ ...prev, amount }));
    setDisplayAmount(amount > 0 ? amount.toLocaleString('id-ID') : '');
  };

  const resetAmount = () => {
    setFormData(prev => ({ ...prev, amount: 0 }));
    setDisplayAmount('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      alert('Nominal harus lebih dari 0');
      return;
    }

    setLoading(true);
    const categoryString = subCategory ? `${mainCategory} - ${subCategory}` : mainCategory;

    await onSave({
      type: formData.type,
      category: categoryString,
      amount: formData.amount,
      description: formData.description
    });

    setLoading(false);
    setFormData({
      type: 'Pengeluaran',
      amount: 0,
      description: ''
    });
    setDisplayAmount('');
    setMainCategory('Bahan Makanan');
    setSelectedIngredient(null);
    setSelectedSupplierId('');
  };

  const activeCategories = formData.type === 'Pengeluaran' ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;
  const currentCategoryObj = activeCategories.find(c => c.id === mainCategory);
  const terbilangText = formData.amount > 0 ? `${angkaTerbilang(formData.amount)} Rupiah` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto">
      {/* Container: Full Screen Seamless Page View on Mobile (< md), Centered Modal Box on Desktop (>= md) */}
      <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl flex flex-col md:overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <DollarSign size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Catat Transaksi Arus Kas</h2>
              <p className="text-xs text-gray-500">Pencatatan pembelanjaan bahan baku, operasional, & kas</p>
            </div>
          </div>
          <button 
            type="button"
            className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors" 
            onClick={onClose} 
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Form Body - Full Screen scrollable on mobile */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[72vh] pb-32 md:pb-6">
            {/* Jenis Transaksi Toggle */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Jenis Transaksi <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('Pengeluaran')}
                  className={`py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
                    formData.type === 'Pengeluaran'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm ring-2 ring-rose-200 font-extrabold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ArrowUpRight size={18} className={formData.type === 'Pengeluaran' ? 'text-rose-600' : 'text-gray-400'} />
                  <span>Pengeluaran (Out)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('Pemasukan')}
                  className={`py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all ${
                    formData.type === 'Pemasukan'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ring-2 ring-emerald-200 font-extrabold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ArrowDownRight size={18} className={formData.type === 'Pemasukan' ? 'text-emerald-600' : 'text-gray-400'} />
                  <span>Pemasukan (In)</span>
                </button>
              </div>
            </div>

            {/* Smart Procurement Box (Auto-fill Master Bahan Baku + Integrasi Supplier) */}
            {formData.type === 'Pengeluaran' && (
              <div className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-50/90 to-purple-50/90 border border-indigo-100 rounded-2xl space-y-3 shadow-inner">
                {/* Auto-fill Bahan Baku */}
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 mb-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    Pilih Dari Master Bahan Baku (Opsional)
                  </label>
                  <select
                    className="w-full bg-white border border-indigo-200 text-gray-800 text-xs font-medium rounded-xl px-3.5 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                    value={selectedIngredient?.id || ''}
                    onChange={handleIngredientSelect}
                  >
                    <option value="">-- Pilih bahan baku untuk auto-fill deskripsi & supplier --</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (Stok: {ing.stock} {ing.unit} | Rp {ing.buyPrice?.toLocaleString('id-ID')}) {ing.supplier?.name ? `• [${ing.supplier.name}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier / Vendor Selector */}
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 mb-1.5">
                    <Building2 size={14} className="text-indigo-600" />
                    Supplier / Vendor Pembelian (Opsional)
                  </label>
                  <select
                    className="w-full bg-white border border-indigo-200 text-gray-800 text-xs font-semibold rounded-xl px-3.5 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                    value={selectedSupplierId}
                    onChange={handleSupplierChange}
                  >
                    <option value="">-- Tanpa Supplier / Belanja Langsung (Pasar / Retail) --</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        🏢 {sup.name} {sup.phone ? `(${sup.phone})` : ''} {sup.contact ? `• PIC: ${sup.contact}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 2-Tier Hierarchical Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Kategori Utama */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  <Layers size={14} className="text-indigo-600" />
                  Kategori Utama <span className="text-rose-500">*</span>
                </label>
                <select 
                  className="w-full bg-slate-50 border border-gray-300 text-gray-800 text-sm font-semibold rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm cursor-pointer" 
                  value={mainCategory}
                  onChange={(e) => setMainCategory(e.target.value)}
                  required
                >
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Kategori Spesifik */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  <Tag size={14} className="text-indigo-600" />
                  Sub-Kategori Spesifik <span className="text-rose-500">*</span>
                </label>
                <select 
                  className="w-full bg-slate-50 border border-gray-300 text-gray-800 text-sm font-semibold rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm cursor-pointer" 
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  required
                >
                  {currentCategoryObj?.subcategories.map(sub => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nominal Transaksi - Currency Input */}
            <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 uppercase tracking-wider">
                  <DollarSign size={14} className="text-indigo-600" />
                  Nominal Transaksi (Rp) <span className="text-rose-500">*</span>
                </label>
                {formData.amount > 0 && (
                  <button
                    type="button"
                    onClick={resetAmount}
                    className="text-xs text-gray-500 hover:text-rose-600 flex items-center gap-1 font-semibold transition-colors"
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>

              {/* Input Group */}
              <div className="flex rounded-2xl shadow-sm border-2 border-indigo-200/80 focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10 overflow-hidden bg-white transition-all">
                <div className="bg-indigo-600 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center font-black text-base sm:text-lg select-none">
                  Rp
                </div>
                <input 
                  type="text" 
                  inputMode="numeric"
                  name="amount"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 outline-none font-black text-xl sm:text-2xl text-gray-900 tracking-wide placeholder-gray-300" 
                  placeholder="0"
                  value={displayAmount}
                  onChange={handleAmountChange}
                  required
                />
              </div>

              {/* Live Terbilang Preview */}
              {formData.amount > 0 ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 animate-in fade-in">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <div className="text-sm font-bold text-emerald-800">
                      Rp {formData.amount.toLocaleString('id-ID')}
                    </div>
                    <div className="text-xs font-semibold text-emerald-600 italic">
                      {terbilangText}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-gray-400 italic">
                  Ketik nominal pengeluaran / pemasukan
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-gray-500 mr-1">Cepat:</span>
                {[
                  { label: '+10 Rb', val: 10000 },
                  { label: '+50 Rb', val: 50000 },
                  { label: '+100 Rb', val: 100000 },
                  { label: '+500 Rb', val: 500000 },
                  { label: '+1 Jt', val: 1000000 },
                  { label: '+5 Jt', val: 5000000 },
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => addAmount(p.val)}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-400 rounded-lg shadow-sm transition-all active:scale-95"
                  >
                    {p.label}
                  </button>
                ))}

                {/* Auto fill master price button */}
                {selectedIngredient?.buyPrice > 0 && (
                  <button
                    type="button"
                    onClick={() => setExactAmount(selectedIngredient.buyPrice)}
                    className="px-2.5 py-1 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg shadow-sm transition-all flex items-center gap-1"
                  >
                    <Sparkles size={12} className="text-amber-600" />
                    Rp {selectedIngredient.buyPrice.toLocaleString('id-ID')}
                  </button>
                )}
              </div>
            </div>

            {/* Catatan / Keterangan Rinci */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                <FileText size={14} className="text-indigo-600" />
                Rincian & Keterangan <span className="text-rose-500">*</span>
              </label>
              <textarea 
                name="description"
                className="w-full bg-slate-50 border border-gray-300 text-gray-800 text-sm rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all" 
                rows={2}
                placeholder="Contoh: Beli Ayam Fillet 5kg di Pasar, Nota terlampir"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              ></textarea>
            </div>
          </div>

          {/* Footer - Fixed at bottom on Mobile, Modal footer on Desktop */}
          <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-3.5 sm:py-4 bg-gray-50 border-t border-gray-200 shrink-0">
            <button 
              type="button" 
              className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors" 
              onClick={onClose} 
              disabled={loading}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Simpan Transaksi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashFlowModal;
