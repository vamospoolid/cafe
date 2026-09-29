import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  X, 
  Droplet, 
  Snowflake, 
  Flame, 
  Zap, 
  Coffee, 
  ShoppingBag, 
  ShoppingCart, 
  Truck, 
  Camera, 
  Upload, 
  Check, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Box,
  Utensils,
  Users,
  Wallet,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { compressImageFile } from '../utils/imageCompressor';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialType?: 'Pengeluaran' | 'Pemasukan';
  initialPocket?: 'OPERATIONAL' | 'DRAWER';
}

export const EXPENSE_CATEGORIES = [
  {
    id: 'Operasional Cafe',
    name: 'Operasional Cafe (OPEX)',
    subcategories: [
      'Gas LPG & Es Batu Rutin',
      'Listrik, Air & Internet / WiFi',
      'Sabun Cuci, Plastik Sampah & Kebersihan',
      'Bensin & Transport Operasional',
      'Sewa Tempat & Izin Usaha',
      'Operasional Lainnya'
    ]
  },
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
      'Tambahan Modal Kas Kecil / Petty Cash Top-up',
      'Setoran Modal Awal',
      'Injeksi Dana Operasional Owner'
    ]
  },
  {
    id: 'Pendapatan Non-POS',
    name: 'Pendapatan Non-POS',
    subcategories: [
      'Pendapatan Sewa Tempat / Space Event',
      'Bagi Hasil / Konsinyasi Produk Luar',
      'Penjualan Aset Bekas / Kardus',
      'Sisa Pengembalian Belanja Operasional',
      'Pendapatan Lain-lain'
    ]
  }
];

const PRESET_EXPENSES = [
  {
    label: 'Air Galon',
    icon: Droplet,
    category: 'Operasional Cafe',
    subCategory: 'Listrik, Air & Internet / WiFi',
    desc: 'Beli Air Galon Dapur / Bar',
    suggestedAmount: 20000
  },
  {
    label: 'Es Batu Kristal',
    icon: Snowflake,
    category: 'Operasional Cafe',
    subCategory: 'Gas LPG & Es Batu Rutin',
    desc: 'Beli Es Batu Kristal Konsumsi',
    suggestedAmount: 15000
  },
  {
    label: 'Gas LPG Dapur',
    icon: Flame,
    category: 'Operasional Cafe',
    subCategory: 'Gas LPG & Es Batu Rutin',
    desc: 'Beli Gas LPG 3kg / 12kg Dapur',
    suggestedAmount: 24000
  },
  {
    label: 'Token Listrik',
    icon: Zap,
    category: 'Operasional Cafe',
    subCategory: 'Listrik, Air & Internet / WiFi',
    desc: 'Isi Ulang Token Listrik Darurat Toko',
    suggestedAmount: 100000
  },
  {
    label: 'Susu UHT / Fresh',
    icon: Coffee,
    category: 'Bahan Minuman',
    subCategory: 'Susu & Dairy (Fresh Milk, UHT, Keju)',
    desc: 'Beli Darurat Susu UHT / Fresh Milk',
    suggestedAmount: 22000
  },
  {
    label: 'Plastik Kresek / Cup',
    icon: ShoppingBag,
    category: 'Kemasan & Packaging',
    subCategory: 'Kotak Makanan & Paper Bag / Kantong Plastik',
    desc: 'Beli Kantong Kresek / Cup Takeaway',
    suggestedAmount: 35000
  },
  {
    label: 'Sabun & Spons',
    icon: ShoppingCart,
    category: 'Operasional Cafe',
    subCategory: 'Sabun Cuci, Plastik Sampah & Kebersihan',
    desc: 'Beli Sabun Cuci Piring & Spons Dapur',
    suggestedAmount: 25000
  },
  {
    label: 'Bensin Operasional',
    icon: Truck,
    category: 'Operasional Cafe',
    subCategory: 'Bensin & Transport Operasional',
    desc: 'Uang Bensin Belanja Pasar / Operasional',
    suggestedAmount: 20000
  }
];

const PRESET_INFLOWS = [
  {
    label: 'Top-up Petty Cash Rp 500Rb',
    amount: 500000,
    category: 'Modal & Injeksi',
    subCategory: 'Tambahan Modal Kas Kecil / Petty Cash Top-up',
    desc: 'Top-up Kas Operasional Toko dari Owner'
  },
  {
    label: 'Top-up Petty Cash Rp 1 Jt',
    amount: 1000000,
    category: 'Modal & Injeksi',
    subCategory: 'Tambahan Modal Kas Kecil / Petty Cash Top-up',
    desc: 'Top-up Kas Operasional Toko dari Owner'
  },
  {
    label: 'Top-up Mingguan Rp 2 Jt',
    amount: 2000000,
    category: 'Modal & Injeksi',
    subCategory: 'Tambahan Modal Kas Kecil / Petty Cash Top-up',
    desc: 'Injeksi Dana Operasional Mingguan Kafe'
  },
  {
    label: 'Sisa Kembalian Belanja',
    amount: 0,
    category: 'Pendapatan Non-POS',
    subCategory: 'Sisa Pengembalian Belanja Operasional',
    desc: 'Pengembalian sisa uang belanja operasional toko'
  }
];

const CashFlowModal: React.FC<CashFlowModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialType = 'Pengeluaran',
  initialPocket = 'OPERATIONAL'
}) => {
  const posContext = useContext(POSContext);
  const user = posContext?.user;
  const isOwnerOrAdmin = user?.role === 'Admin' || user?.role === 'Owner' || (user as any)?.isPlatformAdmin;

  const [type, setType] = useState<'Pengeluaran' | 'Pemasukan'>(initialType);
  const [pocket, setPocket] = useState<'OPERATIONAL' | 'DRAWER'>(initialPocket);
  const [mainCategory, setMainCategory] = useState<string>('Operasional Cafe');
  const [subCategory, setSubCategory] = useState<string>('Listrik, Air & Internet / WiFi');
  const [amount, setAmount] = useState<number>(0);
  const [displayAmount, setDisplayAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [autoStock, setAutoStock] = useState<boolean>(false);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [status, setStatus] = useState<'PENDING' | 'APPROVED'>('APPROVED');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setPocket(initialPocket);
      setAmount(0);
      setDisplayAmount('');
      setDescription('');
      setAutoStock(false);
      setReceiptUrl('');

      if (initialType === 'Pemasukan') {
        setStatus('APPROVED'); // Pemasukan langsung approved menambah saldo
        setMainCategory('Modal & Injeksi');
        setSubCategory('Tambahan Modal Kas Kecil / Petty Cash Top-up');
      } else {
        setStatus(isOwnerOrAdmin ? 'APPROVED' : 'PENDING');
        setMainCategory('Operasional Cafe');
        setSubCategory('Listrik, Air & Internet / WiFi');
      }
    }
  }, [isOpen, initialType, initialPocket, isOwnerOrAdmin]);

  // Handle type change dynamically
  const handleTypeSwitch = (newType: 'Pengeluaran' | 'Pemasukan') => {
    setType(newType);
    if (newType === 'Pemasukan') {
      setStatus('APPROVED'); // Pemasukan langsung approved
      setMainCategory('Modal & Injeksi');
      setSubCategory('Tambahan Modal Kas Kecil / Petty Cash Top-up');
      setDescription('');
    } else {
      setStatus(isOwnerOrAdmin ? 'APPROVED' : 'PENDING');
      setMainCategory('Operasional Cafe');
      setSubCategory('Listrik, Air & Internet / WiFi');
      setDescription('');
    }
  };

  // Update subcategories when main category changes
  useEffect(() => {
    const list = type === 'Pengeluaran' ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;
    const found = list.find(c => c.id === mainCategory);
    if (found && found.subcategories.length > 0) {
      if (!found.subcategories.includes(subCategory)) {
        setSubCategory(found.subcategories[0]);
      }
    }
  }, [mainCategory, type]);

  if (!isOpen) return null;

  const handleApplyExpensePreset = (preset: typeof PRESET_EXPENSES[0]) => {
    setType('Pengeluaran');
    setMainCategory(preset.category);
    setSubCategory(preset.subCategory);
    setDescription(preset.desc);
    if (preset.suggestedAmount && amount === 0) {
      setAmount(preset.suggestedAmount);
      setDisplayAmount(preset.suggestedAmount.toLocaleString('id-ID'));
    }
  };

  const handleApplyInflowPreset = (preset: typeof PRESET_INFLOWS[0]) => {
    setType('Pemasukan');
    setMainCategory(preset.category);
    setSubCategory(preset.subCategory);
    setDescription(preset.desc);
    if (preset.amount > 0) {
      setAmount(preset.amount);
      setDisplayAmount(preset.amount.toLocaleString('id-ID'));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = Number(raw) || 0;
    setAmount(num);
    setDisplayAmount(num > 0 ? num.toLocaleString('id-ID') : '');
  };

  const addAmount = (addVal: number) => {
    const newTotal = amount + addVal;
    setAmount(newTotal);
    setDisplayAmount(newTotal.toLocaleString('id-ID'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      // Otomatis kompresi gambar struk nota ke format WebP (max 1200px, 80% quality)
      // Foto HP 3-5MB seketika menjadi ~150KB tanpa kehilangan kejelasan teks nota
      const optimizedFile = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        format: 'image/webp'
      });

      const formData = new FormData();
      formData.append('image', optimizedFile, optimizedFile.name || 'receipt.webp');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` },
        body: formData
      });
      const data = await res.json();
      const uploadedUrl = data.imageUrl || data.url;
      if (res.ok && uploadedUrl) {
        setReceiptUrl(uploadedUrl);
        toast('Foto nota berhasil diunggah (teroptimasi WebP)', 'success');
      } else {
        toast(data.error || 'Gagal mengunggah foto', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan saat mengunggah foto', 'error');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast('Nominal transaksi harus lebih dari 0', 'warning');
      return;
    }
    if (!description.trim()) {
      toast('Rincian & keterangan wajib diisi', 'warning');
      return;
    }

    onSave({
      type,
      pocket,
      category: mainCategory,
      subCategory,
      amount,
      description: description.trim(),
      receiptUrl,
      autoStock: type === 'Pengeluaran' ? autoStock : false,
      status: type === 'Pemasukan' ? 'APPROVED' : (isOwnerOrAdmin ? status : 'PENDING')
    });
  };

  const isExpense = type === 'Pengeluaran';
  const categoriesList = isExpense ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;
  const currentCatObj = categoriesList.find(c => c.id === mainCategory);

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-3xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs text-white ${
              isExpense ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              {isExpense ? <Wallet size={20} /> : <DollarSign size={20} />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-800 leading-tight">
                {isExpense ? 'Catat Pengeluaran Kas Operasional' : 'Isi Kas Operasional (Petty Cash)'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {isExpense 
                  ? 'Pencatatan pembelanjaan toko (galon, gas, listrik, bahan)' 
                  : 'Penambahan saldo kas kecil toko untuk kebutuhan harian'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* 1. Kantong Dana Selector (Pemisahan Tegas Kas Operasional vs Laci Kasir) */}
          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
              Pilihan Kantong Dana:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPocket('OPERATIONAL')}
                className={`py-2 px-2.5 rounded-xl text-left border transition-all ${
                  pocket === 'OPERATIONAL'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <Wallet size={13} />
                  <span>Kas Operasional</span>
                </div>
                <div className={`text-[10px] mt-0.5 leading-tight ${
                  pocket === 'OPERATIONAL' ? 'text-amber-100' : 'text-slate-400'
                }`}>
                  Di luar laci (Galon, Gas, dll)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPocket('DRAWER')}
                className={`py-2 px-2.5 rounded-xl text-left border transition-all ${
                  pocket === 'DRAWER'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <DollarSign size={13} />
                  <span>Laci Kasir (Sales)</span>
                </div>
                <div className={`text-[10px] mt-0.5 leading-tight ${
                  pocket === 'DRAWER' ? 'text-emerald-100' : 'text-slate-400'
                }`}>
                  Omset POS & Modal Shift
                </div>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600 flex-shrink-0" />
              <span>
                {pocket === 'OPERATIONAL'
                  ? 'Kas Operasional tidak tercampur dengan omset transaksi kasir POS.'
                  : 'Laci Kasir khusus menghitung omset transaksi penjualan kasir.'}
              </span>
            </p>
          </div>

          {/* 2. Type Toggle: Pengeluaran (Out) vs Pemasukan (In) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeSwitch('Pengeluaran')}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                isExpense
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowUpRight size={15} />
              <span>Pengeluaran (Out)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeSwitch('Pemasukan')}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                !isExpense
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowDownLeft size={15} />
              <span>Isi Kas / Setor (In)</span>
            </button>
          </div>

          {/* 3. Preset 1-Klik Sesuai Tipe */}
          {isExpense ? (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-amber-900 flex items-center gap-1.5">
                  ✨ Kebutuhan Rutin Kafe (Preset 1-Klik):
                </span>
                <span className="text-[9px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  Auto-Kategori & Keterangan
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_EXPENSES.map((item, idx) => {
                  const IconComponent = item.icon;
                  const isSelected = description === item.desc;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyExpensePreset(item)}
                      className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 border active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs font-bold'
                          : 'bg-white hover:bg-amber-50 text-slate-700 border-amber-150 shadow-2xs'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <IconComponent size={13} />
                      </div>
                      <span className="text-xs font-semibold leading-tight truncate">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1.5">
                  💼 Preset Isi Kas Operasional:
                </span>
                <span className="text-[9px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                  Top-Up Cepat
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_INFLOWS.map((item, idx) => {
                  const isSelected = description === item.desc;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyInflowPreset(item)}
                      className={`p-2.5 rounded-xl text-left transition-all border active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs font-bold'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 border-emerald-200 shadow-2xs'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight truncate">
                        {item.label}
                      </div>
                      <div className={`text-[10px] mt-0.5 truncate ${
                        isSelected ? 'text-emerald-100' : 'text-slate-400'
                      }`}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Checkbox: Tambah otomatis ke stok bahan baku (Hanya Pengeluaran) */}
          {isExpense && (
            <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={autoStock} 
                onChange={(e) => setAutoStock(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                <Box size={14} className="text-indigo-600" />
                <span>Tambah otomatis ke stok bahan baku dapur?</span>
              </div>
            </label>
          )}

          {/* 5. Kategori Utama & Sub-Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                KATEGORI UTAMA *
              </label>
              <select
                value={mainCategory}
                onChange={(e) => setMainCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {categoriesList.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                SUB-KATEGORI SPESIFIK *
              </label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {currentCatObj?.subcategories.map((sub, i) => (
                  <option key={i} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Nominal Transaksi (Rp) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              NOMINAL {isExpense ? 'PENGELUARAN' : 'DANA MASUK'} (RP) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-black text-slate-400 text-sm">
                Rp
              </span>
              <input 
                type="text"
                value={displayAmount}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full pl-11 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-base font-black text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            
            {/* Quick Increment Pills */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
              {(isExpense 
                ? [10000, 20000, 50000, 100000, 500000] 
                : [50000, 100000, 200000, 500000, 1000000]
              ).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => addAmount(val)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border active:scale-95 transition-all whitespace-nowrap ${
                    isExpense
                      ? 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-150'
                      : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  +{val >= 1000000 ? `${val / 1000000} Jt` : `${val / 1000} Rb`}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Rincian & Keterangan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isExpense ? 'RINCIAN & KETERANGAN BELANJA *' : 'RINCIAN & KETERANGAN DANA MASUK *'}
            </label>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isExpense 
                ? "Contoh: Beli 2 Galon Aqua Dapur / Token Listrik Darurat" 
                : "Contoh: Top-up saldo kas operasional harian toko dari Owner"}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
            />
          </div>

          {/* 8. Lampiran Foto */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Camera size={13} className={isExpense ? 'text-indigo-600' : 'text-emerald-600'} /> 
                <span>{isExpense ? 'Lampiran Foto Struk / Nota Fisik' : 'Foto Bukti Transfer / Setoran Kas'}</span>
              </label>
              <span className="text-[10px] text-slate-400">Opsional</span>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              capture="environment"
              onChange={handleFileUpload} 
              className="hidden" 
            />

            {receiptUrl ? (
              <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-3">
                <img src={receiptUrl} alt="Bukti" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={13} /> Foto Bukti Terlampir
                  </span>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{receiptUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl('')}
                  className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-xs font-bold"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingReceipt}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-3 px-4 border-2 border-dashed rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.99] ${
                  isExpense
                    ? 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 text-indigo-700'
                    : 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 text-emerald-800'
                }`}
              >
                <Camera size={16} />
                <span>{uploadingReceipt ? 'Mengunggah foto...' : isExpense ? 'Foto Struk Belanja / Kamera HP' : 'Foto Bukti Setor / Transfer'}</span>
              </button>
            )}
          </div>

          {/* 9. Status Pengajuan / Penyetujuan */}
          {isExpense ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Status Pengajuan Pengeluaran:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('PENDING')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    status === 'PENDING'
                      ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>⌛ Masuk Antrean Approval</span>
                </button>

                <button
                  type="button"
                  disabled={!isOwnerOrAdmin}
                  onClick={() => {
                    if (isOwnerOrAdmin) setStatus('APPROVED');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    !isOwnerOrAdmin 
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                      : status === 'APPROVED'
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={!isOwnerOrAdmin ? 'Hanya Owner / Admin yang dapat langsung menyetujui' : ''}
                >
                  <Check size={14} /> Langsung Disetujui
                </button>
              </div>
              {!isOwnerOrAdmin && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  * Pengeluaran kas oleh kasir memerlukan persetujuan Owner.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span className="text-xs font-black text-emerald-900 block leading-tight">
                  Langsung Menambah Saldo Kas
                </span>
                <span className="text-[10px] text-emerald-700 leading-tight">
                  Dana masuk langsung menambah saldo {pocket === 'OPERATIONAL' ? 'Kas Operasional Toko' : 'Laci Kasir'} tanpa perlu antrean approval.
                </span>
              </div>
            </div>
          )}

          {/* 10. Footer Action Buttons */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all active:scale-95"
            >
              Batal
            </button>
            <button
              type="submit"
              className={`flex-1 py-3 px-4 rounded-xl text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                !isExpense
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : status === 'PENDING'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              <Check size={16} />
              <span>
                {!isExpense 
                  ? 'Simpan & Tambah Kas' 
                  : status === 'PENDING' 
                    ? 'Ajukan Pengeluaran ke Owner' 
                    : 'Simpan Pengeluaran'}
              </span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CashFlowModal;
