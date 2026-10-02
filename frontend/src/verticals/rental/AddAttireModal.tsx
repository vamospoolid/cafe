import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  RefreshCw,
  Image as ImageIcon,
  Shirt,
  Tag,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Layers,
  Coins
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { compressImageFile } from '../../utils/imageCompressor';

interface AddAttireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem?: any) => void;
}

// Preset foto katalog busana adat untuk 1-klik pilih cepat
const PRESET_SAMPLE_PHOTOS = [
  {
    name: 'Baju Bodo Maroon',
    url: '/images/rental/baju_bodo_maroon.jpg',
    category: 'Baju Bodo Modern',
    color: 'Merah Marun'
  },
  {
    name: 'Baju Bodo Lilac',
    url: '/images/rental/baju_bodo_lilac.jpg',
    category: 'Baju Bodo Modern',
    color: 'Lilac Pastel'
  },
  {
    name: 'Baju La\'bu Hijau Botol',
    url: '/images/rental/baju_labbu_sutra.jpg',
    category: 'Baju La\'bu Sutra',
    color: 'Hijau Botol'
  },
  {
    name: 'Baju Pengantin Gold Royal',
    url: '/images/rental/baju_pengantin_gold.jpg',
    category: 'Baju Bodo Pengantin',
    color: 'Gold Emas'
  }
];

// Rekomendasi aksesori adat Bugis & Makassar yang umum disewakan
const POPULAR_BUGIS_ACCESSORIES = [
  { name: 'Saloko Mahkota', defaultPrice: 25000 },
  { name: 'Bando Emas Adat', defaultPrice: 0 },
  { name: 'Kalung Beranak 3 Susun', defaultPrice: 15000 },
  { name: '2x Gelang Pontoh Naga', defaultPrice: 0 },
  { name: 'Pending Ikat Pinggang Emas', defaultPrice: 20000 },
  { name: 'Keris Tataroppeng Kuningan', defaultPrice: 35000 },
  { name: 'Lipa Sabbe Sutra', defaultPrice: 0 },
  { name: 'Sumpit Rambut Hias', defaultPrice: 10000 },
  { name: 'Sapu Tangan Bugis', defaultPrice: 0 },
  { name: 'Kipas Pengantin Adat', defaultPrice: 15000 }
];

export const AddAttireModal: React.FC<AddAttireModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { token } = usePOS();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryName: 'Baju Bodo Modern',
    color: '',
    size: 'M',
    storageLocation: 'Hanger A-01',
    sellPrice: 250000,
    buyPrice: 650000,
    stock: 1,
    imageUrl: ''
  });

  // State Kelengkapan Aksesori & Harga Tambahan
  const [accessories, setAccessories] = useState<Array<{ name: string; price: number }>>([
    { name: 'Saloko Mahkota', price: 25000 },
    { name: 'Bando Emas Adat', price: 0 },
    { name: 'Kalung Beranak 3 Susun', price: 15000 },
    { name: '2x Gelang Pontoh Naga', price: 0 },
    { name: 'Lipa Sabbe Sutra', price: 0 }
  ]);
  const [newAccName, setNewAccName] = useState('');
  const [newAccPrice, setNewAccPrice] = useState<number>(0);

  const handleAddCustomAccessory = () => {
    const trimmed = newAccName.trim();
    if (!trimmed) return;
    if (accessories.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      toast(`Aksesori "${trimmed}" sudah terdaftar`, 'info');
      return;
    }
    setAccessories(prev => [...prev, { name: trimmed, price: Number(newAccPrice) || 0 }]);
    setNewAccName('');
    setNewAccPrice(0);
    toast(`Aksesori "${trimmed}" berhasil ditambahkan`, 'success');
  };

  const handleQuickAddPresetAcc = (preset: typeof POPULAR_BUGIS_ACCESSORIES[0]) => {
    if (accessories.some(a => a.name.toLowerCase() === preset.name.toLowerCase())) {
      toast(`Aksesori "${preset.name}" sudah ada`, 'info');
      return;
    }
    setAccessories(prev => [...prev, { name: preset.name, price: preset.defaultPrice }]);
    toast(`"${preset.name}" ditambahkan`, 'success');
  };

  const handleRemoveAccessory = (index: number) => {
    setAccessories(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAccPrice = (index: number, price: number) => {
    setAccessories(prev => prev.map((a, i) => i === index ? { ...a, price: Math.max(0, price) } : a));
  };

  if (!isOpen) return null;

  // Handle Upload Image with WebP Compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.type.startsWith('image/')) {
      toast('File harus berupa gambar (JPG, PNG, atau WEBP)', 'error');
      return;
    }

    try {
      setUploadingImage(true);
      const compressed = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85,
        format: 'image/webp'
      });

      const data = new FormData();
      data.append('image', compressed, compressed.name || 'attire.webp');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal mengunggah foto');

      const uploadedUrl = resData.imageUrl || resData.url;
      setFormData(prev => ({ ...prev, imageUrl: uploadedUrl }));
      toast('Foto busana berhasil diunggah!', 'success');
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Gagal mengunggah foto', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_SAMPLE_PHOTOS[0]) => {
    setFormData(prev => ({
      ...prev,
      imageUrl: preset.url,
      categoryName: prev.categoryName || preset.category,
      color: prev.color || preset.color
    }));
    toast(`Foto sampel "${preset.name}" dipilih`, 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!formData.name.trim()) {
      toast('Nama busana wajib diisi', 'warning');
      return;
    }

    try {
      setSubmitting(true);

      const accessoryPrices: Record<string, number> = {};
      const accessoryNames: string[] = [];
      accessories.forEach(a => {
        const trimmed = a.name.trim();
        if (trimmed) {
          accessoryNames.push(trimmed);
          if (a.price > 0) {
            accessoryPrices[trimmed] = a.price;
          }
        }
      });

      const res = await fetch('/api/rental/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          accessories: accessoryNames,
          accessoryPrices
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan busana ke katalog');

      toast('✨ Busana berhasil ditambahkan ke katalog!', 'success');
      onSuccess(data.item);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shadow-xs border border-white/20">
              <Shirt size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                Tambah Busana ke Katalog
              </h2>
              <p className="text-xs text-indigo-100 font-medium">
                Daftarkan koleksi busana baru lengkap dengan foto &amp; nomor gantungan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* ─── FOTO BUSANA SECTION (UPLOAD & PRESET) ──────────────────────── */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-indigo-900">
                <ImageIcon size={15} className="text-indigo-600" />
                Foto Busana Adat
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Pilih file / kamera atau tempel URL
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Preview Box */}
              <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-2xl bg-white border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative group shadow-xs">
                {formData.imageUrl ? (
                  <>
                    <img
                      src={formData.imageUrl}
                      alt="Preview Busana"
                      className="w-full h-full object-cover"
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold"
                    >
                      Hapus Foto
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <ImageIcon size={28} />
                    <span className="text-[9px] font-bold">Belum Ada Foto</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="add-attire-photo-input"
                  />
                  <label
                    htmlFor="add-attire-photo-input"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      uploadingImage
                        ? 'bg-slate-200 text-slate-500 cursor-wait'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95'
                    }`}
                  >
                    {uploadingImage ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Mengunggah Foto...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} />
                        <span>Upload Foto / Kamera</span>
                      </>
                    )}
                  </label>

                  {formData.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Atau tempel tautan URL gambar (https://...)"
                  value={formData.imageUrl}
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />

                {/* 1-Klik Pilih Preset Foto */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <Sparkles size={11} className="text-indigo-500" />
                    Atau gunakan foto katalog sampel:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {PRESET_SAMPLE_PHOTOS.map(p => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className={`group relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                          formData.imageUrl === p.url
                            ? 'border-indigo-600 ring-2 ring-indigo-400/40'
                            : 'border-slate-200 hover:border-indigo-400 opacity-80 hover:opacity-100'
                        }`}
                        title={p.name}
                      >
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        {formData.imageUrl === p.url && (
                          <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── DATA BUSANA ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Nama Model Busana *</label>
              <input
                type="text"
                required
                placeholder="Contoh: Baju Bodo Organza Emas Payet"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Kategori Busana *</label>
              <select
                value={formData.categoryName}
                onChange={e => setFormData({ ...formData, categoryName: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              >
                <option value="Baju Bodo Modern">Baju Bodo Modern</option>
                <option value="Baju La'bu Sutra">Baju La'bu Sutra</option>
                <option value="Baju Bodo Pengantin">Baju Bodo Pengantin Adat</option>
                <option value="Baju Bodo Klasik">Baju Bodo Klasik Tokko</option>
                <option value="Jas Tutup Pria">Set Jas Tutup Pria</option>
                <option value="Baju Anak">Baju Anak Pawai / Karnaval</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Warna</label>
              <input
                type="text"
                placeholder="Merah Marun, Hijau Sage"
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Ukuran (Size)</label>
              <select
                value={formData.size}
                onChange={e => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              >
                <option value="S">S (Small)</option>
                <option value="M">M (Medium)</option>
                <option value="L">L (Large)</option>
                <option value="XL">XL (Extra Large)</option>
                <option value="XXL">XXL</option>
                <option value="All Size">All Size</option>
                <option value="Junior">Junior (Anak)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag size={12} className="text-indigo-600" />
                Lokasi Gantungan / Rak *
              </label>
              <input
                type="text"
                required
                placeholder="Hanger A-04, Lemari 2"
                value={formData.storageLocation}
                onChange={e => setFormData({ ...formData, storageLocation: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-indigo-700">Tarif Sewa (Rp) *</label>
              <input
                type="number"
                min="0"
                step="5000"
                required
                value={formData.sellPrice}
                onChange={e => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Modal Pengadaan (Rp)</label>
              <input
                type="number"
                min="0"
                step="10000"
                value={formData.buyPrice}
                onChange={e => setFormData({ ...formData, buyPrice: Number(e.target.value) })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400">Untuk kalkulasi ROI modal sewa.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Jumlah Unit Fisik *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* ─── KELENGKAPAN AKSESORI & BIAYA TAMBAHAN ──────────────────────── */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-600" />
                  <span>Kelengkapan Aksesori &amp; Biaya Tambahan (Opsional)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Aksesori bawaan set. Isi <b>Rp 0</b> jika sudah termasuk paket sewa, atau tentukan harga extra jika pelanggan menambahkannya.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 font-black text-[10px] w-fit">
                {accessories.length} Aksesori
              </span>
            </div>

            {/* List Aksesori Terdaftar */}
            <div className="space-y-2">
              {accessories.map((acc, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-colors"
                >
                  <div className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={acc.name}
                    onChange={e => {
                      const val = e.target.value;
                      setAccessories(prev => prev.map((a, i) => i === idx ? { ...a, name: val } : a));
                    }}
                    placeholder="Nama Aksesori..."
                    className="flex-1 px-2.5 py-1 text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-semibold">Extra:</span>
                    <div className="relative flex items-center">
                      <span className="absolute left-2 text-[10px] font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={acc.price}
                        onChange={e => handleUpdateAccPrice(idx, Number(e.target.value))}
                        className={`w-24 pl-7 pr-2 py-1 text-xs font-black rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-300 text-right ${
                          acc.price > 0 
                            ? 'bg-violet-50 text-violet-900 border-violet-200' 
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                        title="Biaya extra jika dipilih (0 = gratis/termasuk)"
                      />
                    </div>
                    {acc.price > 0 ? (
                      <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                        Berbayar
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Gratis
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAccessory(idx)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus aksesori ini"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Tambah Aksesori Baru */}
            <div className="pt-2 border-t border-slate-200/70">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Ketik nama aksesori baru (misal: Sumpit Hias Emas)..."
                  value={newAccName}
                  onChange={e => setNewAccName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomAccessory();
                    }
                  }}
                  className="flex-1 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex items-center flex-1 sm:flex-none">
                    <span className="absolute left-2.5 text-[10px] font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      placeholder="0"
                      value={newAccPrice || ''}
                      onChange={e => setNewAccPrice(Number(e.target.value))}
                      className="w-full sm:w-28 pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right"
                      title="Biaya tambahan jika disewa"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomAccessory}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* Rekomendasi 1-Klik Aksesori Adat Bugis */}
              <div className="mt-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Sparkles size={11} className="text-indigo-500" />
                  1-Klik tambah aksesori adat populer:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BUGIS_ACCESSORIES.map(p => {
                    const isAlreadyAdded = accessories.some(a => a.name.toLowerCase() === p.name.toLowerCase());
                    return (
                      <button
                        key={p.name}
                        type="button"
                        disabled={isAlreadyAdded}
                        onClick={() => handleQuickAddPresetAcc(p)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                          isAlreadyAdded
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border-slate-200 hover:border-indigo-300 shadow-2xs'
                        }`}
                      >
                        <Plus size={9} />
                        <span>{p.name}</span>
                        {p.defaultPrice > 0 && (
                          <span className="text-violet-700 font-extrabold ml-0.5">
                            +{(p.defaultPrice).toLocaleString('id-ID')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Menyimpan ke Katalog...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Simpan ke Katalog Busana</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAttireModal;
