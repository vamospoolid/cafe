import React, { useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Camera,
  Sparkles,
  Plus,
  Trash2,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Percent,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Utensils,
  ChefHat,
  Coffee,
  Layers,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Wand2,
  Palette,
  Check,
  Eye,
  Info
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface DraftItem {
  id: string;
  name: string;
  price: number;
  buyPrice: number;
  imageUrl: string;
  stock: number;
  minStock: number;
  status: string;
}

interface DraftCategory {
  id: string;
  category: string;
  printerTarget: string;
  items: DraftItem[];
}

interface ImageVariation {
  seed: number;
  style: string;
  label: string;
  url: string;
}

export const DraftMenuView: React.FC = () => {
  const navigate = useNavigate();
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const user = posContext?.user;

  // Step state: 'UPLOAD' | 'EXTRACTING' | 'REVIEW' | 'SUCCESS'
  const [step, setStep] = useState<'UPLOAD' | 'EXTRACTING' | 'REVIEW' | 'SUCCESS'>('UPLOAD');

  // Uploaded images state
  const [uploadedImages, setUploadedImages] = useState<Array<{ base64: string; mimeType: string; name: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Business vertical
  const [businessType, setBusinessType] = useState<string>(
    user?.businessType || (posContext?.settings as any)?.businessType || 'CAFE'
  );

  // Selected default photo style for AI generation
  const [photoStyle, setPhotoStyle] = useState<'CAFE_WARM' | 'GOURMET_STUDIO' | 'COMMERCIAL_VIBRANT' | 'TRADITIONAL_RUSTIC'>('CAFE_WARM');

  // Extraction result (Draft data)
  const [draftCategories, setDraftCategories] = useState<DraftCategory[]>([]);
  const [commitMode, setCommitMode] = useState<'APPEND' | 'REPLACE'>('APPEND');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ createdCategoriesCount: number; createdProductsCount: number } | null>(null);

  // Bulk HPP inputs per category: { [catId]: { amount: string; percent: string } }
  const [bulkHppState, setBulkHppState] = useState<Record<string, { amount: string; percent: string }>>({});

  // ─── Studio Foto AI Modal State ───
  const [studioItem, setStudioItem] = useState<{ catId: string; itemId: string; currentUrl: string; name: string; category: string } | null>(null);
  const [activeStudioTab, setActiveStudioTab] = useState<'AI_STUDIO' | 'UPLOAD_CUSTOM'>('AI_STUDIO');
  const [variationsList, setVariationsList] = useState<ImageVariation[]>([]);
  const [selectedVariationUrl, setSelectedVariationUrl] = useState<string>('');
  const [customPromptInstruction, setCustomPromptInstruction] = useState<string>('');
  const [isGeneratingVariations, setIsGeneratingVariations] = useState<boolean>(false);
  const [customUploadUrl, setCustomUploadUrl] = useState<string>('');
  const singleItemUploadRef = useRef<HTMLInputElement>(null);

  // File input refs
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle files conversion to base64
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast(`File "${file.name}" bukan format gambar yang didukung.`, 'error');
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        toast(`Ukuran gambar "${file.name}" terlalu besar (maksimal 15MB).`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          setUploadedImages((prev) => [
            ...prev,
            {
              base64,
              mimeType: file.type || 'image/jpeg',
              name: file.name
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Trigger Gemini Vision AI extraction
  const handleExtractMenu = async () => {
    if (uploadedImages.length === 0) {
      toast('Silakan upload atau ambil foto lembar menu terlebih dahulu.', 'warning');
      return;
    }

    setStep('EXTRACTING');

    try {
      const res = await fetch('/api/draft-menu/extract-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          images: uploadedImages,
          businessType,
          photoStyle
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengekstrak menu dari foto.');
      }

      if (!data.categories || data.categories.length === 0) {
        throw new Error('AI tidak menemukan item menu dalam gambar.');
      }

      setDraftCategories(data.categories);
      setStep('REVIEW');
      toast(`✅ Berhasil mendeteksi ${data.categories.length} kategori menu dari foto!`, 'success');
    } catch (err: any) {
      console.error('Extraction error:', err);
      toast(err.message || 'Terjadi kesalahan saat memproses gambar.', 'error');
      setStep('UPLOAD');
    }
  };

  // ─── Open Studio Foto AI Modal ───
  const openStudioFoto = async (catId: string, item: DraftItem, catName: string) => {
    setStudioItem({
      catId,
      itemId: item.id,
      currentUrl: item.imageUrl,
      name: item.name,
      category: catName
    });
    setSelectedVariationUrl(item.imageUrl);
    setCustomUploadUrl(item.imageUrl);
    setCustomPromptInstruction('');
    setActiveStudioTab('AI_STUDIO');

    // Auto fetch initial 4 studio variations
    fetchPhotoVariations(item.name, catName);
  };

  const fetchPhotoVariations = async (name: string, category: string, customText?: string) => {
    setIsGeneratingVariations(true);
    try {
      const res = await fetch('/api/draft-menu/generate-image-variations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          category,
          businessType,
          customInstruction: customText
        })
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.variations)) {
        setVariationsList(data.variations);
      } else {
        toast('Gagal memuat variasi foto AI.', 'error');
      }
    } catch (err) {
      console.error('Studio variation error:', err);
      toast('Terjadi kesalahan jaringan saat generate foto.', 'error');
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  // Apply selected studio photo to the draft item
  const applyStudioPhoto = () => {
    if (!studioItem) return;
    const finalUrl = activeStudioTab === 'AI_STUDIO' ? selectedVariationUrl : customUploadUrl;
    if (!finalUrl) {
      toast('Pilih salah satu variasi foto atau masukkan URL foto.', 'warning');
      return;
    }

    updateItemField(studioItem.catId, studioItem.itemId, 'imageUrl', finalUrl);
    setStudioItem(null);
    toast('Foto produk berhasil diperbarui!', 'success');
  };

  // Single Item Direct File Upload
  const handleSingleItemFileUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        setCustomUploadUrl(base64);
        toast('Foto berhasil dimuat dari file.', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  // Bulk Apply HPP by Nominal to Category
  const applyBulkHppNominal = (catId: string) => {
    const val = Number(bulkHppState[catId]?.amount);
    if (isNaN(val) || val < 0) {
      toast('Masukkan nominal HPP yang valid (angka positif).', 'warning');
      return;
    }

    setDraftCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          items: cat.items.map((item) => ({
            ...item,
            buyPrice: Math.min(val, item.price)
          }))
        };
      })
    );

    toast(`HPP Rp ${val.toLocaleString('id-ID')} diterapkan ke semua menu kategori ini.`, 'success');
  };

  // Bulk Apply HPP by Percentage to Category
  const applyBulkHppPercent = (catId: string) => {
    const pct = Number(bulkHppState[catId]?.percent);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast('Masukkan persentase HPP antara 1% sampai 100%.', 'warning');
      return;
    }

    setDraftCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          items: cat.items.map((item) => ({
            ...item,
            buyPrice: Math.round((item.price * pct) / 100)
          }))
        };
      })
    );

    toast(`HPP ${pct}% dari harga jual diterapkan ke semua menu kategori ini.`, 'success');
  };

  // Update item field
  const updateItemField = (catId: string, itemId: string, field: keyof DraftItem, value: any) => {
    setDraftCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          items: cat.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, [field]: value };
          })
        };
      })
    );
  };

  // Delete item
  const deleteItem = (catId: string, itemId: string) => {
    setDraftCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          items: cat.items.filter((item) => item.id !== itemId)
        };
      }).filter((cat) => cat.items.length > 0)
    );
  };

  // Add new item manual to category
  const addNewItemToCategory = (catId: string) => {
    const defaultName = 'Menu Baru';
    const defaultPrice = 15000;
    const defaultBuyPrice = 6000;

    setDraftCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        return {
          ...cat,
          items: [
            ...cat.items,
            {
              id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              name: defaultName,
              price: defaultPrice,
              buyPrice: defaultBuyPrice,
              imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(defaultName)}?width=512&height=512&nologo=true&enhance=true&model=flux`,
              stock: 100,
              minStock: 5,
              status: 'Aktif'
            }
          ]
        };
      })
    );
  };

  // Add new custom category
  const addNewCategory = () => {
    const newCatName = `Kategori Baru ${draftCategories.length + 1}`;
    setDraftCategories((prev) => [
      ...prev,
      {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        category: newCatName,
        printerTarget: 'KITCHEN',
        items: []
      }
    ]);
  };

  // Commit draft to catalog
  const handleCommitCatalog = async () => {
    const totalItems = draftCategories.reduce((acc, c) => acc + c.items.length, 0);
    if (totalItems === 0) {
      toast('Tidak ada item menu yang bisa disimpan.', 'warning');
      return;
    }

    const confirm = await confirmAlert(
      'Simpan ke Menu Kasir',
      `Apakah Anda yakin ingin memasukkan ${totalItems} menu ini ke katalog toko Anda? Gambar akan otomatis dioptimasi dan disimpan ke storage server.`
    );

    if (!confirm.isConfirmed) return;

    setIsCommitting(true);
    try {
      const res = await fetch('/api/draft-menu/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          categories: draftCategories,
          mode: commitMode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan menu ke katalog.');
      }

      setCommitResult(data.data);
      setStep('SUCCESS');
      toast(data.message || 'Menu berhasil disimpan ke sistem!', 'success');
    } catch (err: any) {
      console.error('Commit error:', err);
      toast(err.message || 'Gagal menyimpan menu.', 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const totalDetectedItems = draftCategories.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-28 text-slate-800">
      {/* ─── Top Header Banner ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-indigo-700 to-indigo-900 text-white p-6 md:p-8 shadow-xl shadow-indigo-500/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-indigo-100 uppercase tracking-wider">
              <Sparkles size={14} className="text-amber-300 animate-pulse" />
              AI Studio Food Photography Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Upload Draft Menu &amp; AI Studio</h1>
            <p className="text-sm text-indigo-200 max-w-2xl leading-relaxed">
              Jepret atau upload foto buku menu Anda. Gemini Vision membaca kategori &amp; harga secara akurat, lalu sistem
              AI Studio membuatkan foto kuliner kelas profesional siap saji untuk kasir Anda.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/produk')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all flex items-center gap-2 border border-white/10"
            >
              <ShoppingBag size={16} /> Ke Daftar Produk
            </button>
          </div>
        </div>
      </div>

      {/* ─── Step 1: Upload / Kamera Screen ─── */}
      {step === 'UPLOAD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dropzone & Action Buttons */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <UploadCloud className="text-indigo-600" size={20} />
                    Upload Foto / Scan Menu
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mendukung foto lembaran menu fisik, foto papan harga, flyer Canva, atau file JPG/PNG/WebP.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {uploadedImages.length} Foto Terpilih
                  </span>
                </div>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  processFiles(e.dataTransfer.files);
                }}
                onClick={() => galleryInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  <UploadCloud size={32} />
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Tarik &amp; lepas foto menu Anda di sini, atau{' '}
                  <span className="text-indigo-600 underline">pilih dari folder</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Bisa upload beberapa lembar foto sekaligus (misal: Halaman Minuman &amp; Halaman Makanan).
                </p>

                {/* Hidden native inputs */}
                <input
                  type="file"
                  ref={galleryInputRef}
                  onChange={(e) => processFiles(e.target.files)}
                  multiple
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={(e) => processFiles(e.target.files)}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </div>

              {/* Direct Camera Button */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/15 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Camera size={18} /> Ambil Foto Langsung dari Kamera HP / Tablet
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-3.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <ImageIcon size={18} /> Buka Galeri File
                </button>
              </div>

              {/* Image Previews Grid */}
              {uploadedImages.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Pratinjau Foto yang Akan Dianalisis ({uploadedImages.length}):</span>
                    <button
                      type="button"
                      onClick={() => setUploadedImages([])}
                      className="text-rose-600 hover:underline text-[11px]"
                    >
                      Hapus Semua
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {uploadedImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 shadow-sm"
                      >
                        <img src={img.base64} alt={img.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUploadedImage(idx);
                            }}
                            className="p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-md"
                            title="Hapus foto ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded-md font-medium">
                          Hal {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Guide & Photo Aesthetic Style Selection */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                <div className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <Palette size={18} className="text-indigo-600" />
                  Gaya Foto Standard AI
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih gaya estetika kuliner yang akan dipasangkan secara otomatis ke setiap menu Anda:
                </p>

                {/* Photo Style Selector Cards */}
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    {
                      id: 'CAFE_WARM',
                      title: '☕ Kafe & Kayu Alami (Warm Aesthetic)',
                      desc: 'Meja kayu oak, pencahayaan alami jendela pagi, gelas berembun segar.'
                    },
                    {
                      id: 'GOURMET_STUDIO',
                      title: '🍽️ Fine Dining Gourmet (Michelin Plating)',
                      desc: 'Piring keramik matte, garnish microgreens elegan, softbox studio 50mm.'
                    },
                    {
                      id: 'COMMERCIAL_VIBRANT',
                      title: '📸 Katalog Modern (Grab / GoFood Style)',
                      desc: 'Warna cerah, latar belakang studio bersih, kontras tajam menggugah selera.'
                    },
                    {
                      id: 'TRADITIONAL_RUSTIC',
                      title: '🌶️ Tradisional & Daun Pisang (Authentic Warung)',
                      desc: 'Piring tanah liat / anyaman bambu, alas daun pisang, uap hangat mengepul.'
                    }
                  ].map((style) => (
                    <div
                      key={style.id}
                      onClick={() => setPhotoStyle(style.id as any)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        photoStyle === style.id
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800">{style.title}</span>
                        {photoStyle === style.id && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{style.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Usaha / Vertikal:</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CAFE">Kafe / Restoran / F&amp;B</option>
                    <option value="RETAIL">Toko Retail / Sembako</option>
                    <option value="BENGKEL">Bengkel Motor &amp; Mobil</option>
                    <option value="LAUNDRY">Jasa Laundry Kiloan / Satuan</option>
                  </select>
                </div>
              </div>

              {/* Start Extraction Button */}
              <button
                type="button"
                disabled={uploadedImages.length === 0}
                onClick={handleExtractMenu}
                className={`w-full py-4 rounded-3xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all ${
                  uploadedImages.length > 0
                    ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white shadow-indigo-500/25 active:scale-98 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Sparkles size={18} className="text-amber-300" />
                Mulai Ekstrak Menu Otomatis ({uploadedImages.length} Foto)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step: Extracting Loading State ─── */}
      {step === 'EXTRACTING' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-lg space-y-6 animate-pulse">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <RefreshCw size={36} className="animate-spin text-indigo-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-800">Sedang Memproses Foto Menu dengan AI...</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Google Gemini Vision sedang membaca teks, mendeteksi harga &amp; stasiun dapur, serta merender foto kuliner
              beresolusi tinggi dengan simulasi pencahayaan studio.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            <Sparkles size={14} className="text-amber-500" /> Memproses {uploadedImages.length} lembar foto menu
          </div>
        </div>
      )}

      {/* ─── Step 2: Review & Setup HPP Screen ─── */}
      {step === 'REVIEW' && (
        <div className="space-y-6">
          {/* Top Actions & Summary Banner */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('UPLOAD')}
                className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                title="Foto Ulang / Ganti Foto"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  Draft Katalog Menu ({totalDetectedItems} Item dalam {draftCategories.length} Kategori)
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    AI Studio Active
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Periksa harga, atur HPP cepat per kategori, atau klik thumbnail foto untuk membuka <strong>Studio Foto AI</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={addNewCategory}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={15} /> Tambah Kategori
              </button>

              <button
                type="button"
                onClick={handleCommitCatalog}
                disabled={isCommitting || totalDetectedItems === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                {isCommitting ? 'Menyimpan...' : `Simpan ke Menu Kasir (${totalDetectedItems})`}
              </button>
            </div>
          </div>

          {/* Categories Accordions / Cards */}
          <div className="space-y-6">
            {draftCategories.map((cat, catIdx) => (
              <div
                key={cat.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all"
              >
                {/* Category Header */}
                <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {catIdx + 1}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={cat.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftCategories((prev) =>
                            prev.map((c) => (c.id === cat.id ? { ...c, category: val } : c))
                          );
                        }}
                        className="font-extrabold text-base text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1"
                        placeholder="Nama Kategori"
                      />
                      <div className="text-[11px] text-slate-500 font-medium px-1 mt-0.5">
                        {cat.items.length} menu terdeteksi • Target Stasiun: {cat.printerTarget}
                      </div>
                    </div>
                  </div>

                  {/* ⚡ Fitur HPP Cepat per Kategori ⚡ */}
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0 px-1">
                      <Tag size={13} className="text-indigo-600" /> Set HPP Kategori Ini:
                    </span>

                    {/* Input Nominal Rp */}
                    <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-2 py-1 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        placeholder="6000"
                        value={bulkHppState[cat.id]?.amount || ''}
                        onChange={(e) =>
                          setBulkHppState((prev) => ({
                            ...prev,
                            [cat.id]: { ...prev[cat.id], amount: e.target.value }
                          }))
                        }
                        className="w-20 bg-transparent text-xs font-bold text-slate-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => applyBulkHppNominal(cat.id)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs cursor-pointer"
                      >
                        Terapkan
                      </button>
                    </div>

                    <span className="text-slate-300 text-xs font-bold">atau</span>

                    {/* Input Persentase % */}
                    <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-2 py-1 border border-slate-200">
                      <input
                        type="number"
                        placeholder="35"
                        value={bulkHppState[cat.id]?.percent || ''}
                        onChange={(e) =>
                          setBulkHppState((prev) => ({
                            ...prev,
                            [cat.id]: { ...prev[cat.id], percent: e.target.value }
                          }))
                        }
                        className="w-12 bg-transparent text-xs font-bold text-slate-800 outline-none text-right"
                      />
                      <span className="text-[11px] font-bold text-slate-400">%</span>
                      <button
                        type="button"
                        onClick={() => applyBulkHppPercent(cat.id)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-xs cursor-pointer"
                      >
                        Set %
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3 px-4 w-20">Foto Studio</th>
                        <th className="py-3 px-4 min-w-[200px]">Nama Menu</th>
                        <th className="py-3 px-4 w-36">Harga Jual (Rp)</th>
                        <th className="py-3 px-4 w-36">HPP / Modal (Rp)</th>
                        <th className="py-3 px-4 w-28">Margin Laba</th>
                        <th className="py-3 px-4 w-24 text-center">Studio Foto</th>
                        <th className="py-3 px-4 w-12 text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {cat.items.map((item) => {
                        const marginNominal = item.price - item.buyPrice;
                        const marginPercent = item.price > 0 ? Math.round((marginNominal / item.price) * 100) : 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* Gambar Standard Thumbnail */}
                            <td className="py-2.5 px-4">
                              <div
                                onClick={() => openStudioFoto(cat.id, item, cat.category)}
                                className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 relative group cursor-pointer bg-slate-100 shadow-2xs"
                                title="Klik untuk membuka Studio Foto AI"
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  onError={(e: any) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Wand2 size={14} />
                                </div>
                              </div>
                            </td>

                            {/* Nama Menu */}
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItemField(cat.id, item.id, 'name', e.target.value)}
                                className="w-full font-bold text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none py-1"
                              />
                            </td>

                            {/* Harga Jual */}
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                                <span className="text-[11px] text-slate-400 font-bold">Rp</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) =>
                                    updateItemField(cat.id, item.id, 'price', Number(e.target.value) || 0)
                                  }
                                  className="w-full text-right font-extrabold text-xs text-slate-800 bg-transparent outline-none"
                                />
                              </div>
                            </td>

                            {/* HPP / Modal */}
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                                <span className="text-[11px] text-slate-400 font-bold">Rp</span>
                                <input
                                  type="number"
                                  value={item.buyPrice}
                                  onChange={(e) =>
                                    updateItemField(cat.id, item.id, 'buyPrice', Number(e.target.value) || 0)
                                  }
                                  className="w-full text-right font-extrabold text-xs text-amber-700 bg-transparent outline-none"
                                />
                              </div>
                            </td>

                            {/* Margin Laba */}
                            <td className="py-2.5 px-4">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md inline-block ${
                                  marginPercent >= 40
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : marginPercent >= 20
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {marginPercent}% (+{(marginNominal / 1000).toFixed(0)}k)
                              </span>
                            </td>

                            {/* Studio Foto Trigger Button */}
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => openStudioFoto(cat.id, item, cat.category)}
                                className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center gap-1 mx-auto transition-all cursor-pointer"
                              >
                                <Wand2 size={12} /> Studio AI
                              </button>
                            </td>

                            {/* Action Delete */}
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => deleteItem(cat.id, item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                title="Hapus menu ini"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add item footer */}
                <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => addNewItemToCategory(cat.id)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Tambah Menu Manual di Kategori Ini
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDraftCategories((prev) => prev.filter((c) => c.id !== cat.id));
                    }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 cursor-pointer"
                  >
                    Hapus Kategori Ini
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Bottom Bar for Commit */}
          <div className="sticky bottom-6 z-20 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 md:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="commitMode"
                  value="APPEND"
                  checked={commitMode === 'APPEND'}
                  onChange={() => setCommitMode('APPEND')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Tambahkan ke Menu yang Sudah Ada</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-600">
                <input
                  type="radio"
                  name="commitMode"
                  value="REPLACE"
                  checked={commitMode === 'REPLACE'}
                  onChange={() => setCommitMode('REPLACE')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Gantikan Seluruh Menu Lama</span>
              </label>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStep('UPLOAD')}
                className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                ← Foto Ulang
              </button>

              <button
                type="button"
                disabled={isCommitting || totalDetectedItems === 0}
                onClick={handleCommitCatalog}
                className="flex-1 sm:flex-none py-3.5 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {isCommitting ? 'Sedang Menyimpan...' : `🚀 Simpan & Masukkan ke Menu Kasir (${totalDetectedItems})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 3: Success Screen ─── */}
      {step === 'SUCCESS' && commitResult && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 text-center max-w-xl mx-auto shadow-xl space-y-6 animate-scale-up">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={44} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-800">Menu Berhasil Diterapkan!</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Sebanyak <strong>{commitResult.createdProductsCount} produk</strong> baru dalam{' '}
              <strong>{commitResult.createdCategoriesCount} kategori</strong> telah tersimpan ke database dan otomatis
              dioptimasi ke disk server untuk kasir Anda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/pos')}
              className="flex-1 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ShoppingBag size={16} /> Buka POS Kasir Sekarang
            </button>

            <button
              type="button"
              onClick={() => navigate('/produk')}
              className="py-3.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              Kelola di Daftar Produk
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setUploadedImages([]);
              setDraftCategories([]);
              setStep('UPLOAD');
            }}
            className="text-xs font-bold text-indigo-600 hover:underline pt-2 block mx-auto cursor-pointer"
          >
            + Upload Foto Menu Lainnya
          </button>
        </div>
      )}

      {/* ─── 🎨 STUDIO FOTO MENU AI MODAL 🎨 ─── */}
      {studioItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase">
                  <Sparkles size={12} className="text-amber-500" /> AI Studio Food Photography
                </div>
                <h3 className="font-extrabold text-lg text-slate-800 mt-1">
                  Studio Foto: {studioItem.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih variasi foto kuliner profesional yang di-generate AI atau upload foto asli Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStudioItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Studio Mode Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveStudioTab('AI_STUDIO')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeStudioTab === 'AI_STUDIO'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Wand2 size={14} /> Pilihan Variasi Foto AI Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('UPLOAD_CUSTOM')}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeStudioTab === 'UPLOAD_CUSTOM'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <UploadCloud size={14} /> Upload Foto Asli Sendiri
              </button>
            </div>

            {/* TAB 1: AI STUDIO VARIATIONS */}
            {activeStudioTab === 'AI_STUDIO' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700">
                    Pilih Salah Satu Hasil Foto di Bawah:
                  </span>
                  <button
                    type="button"
                    disabled={isGeneratingVariations}
                    onClick={() => fetchPhotoVariations(studioItem.name, studioItem.category, customPromptInstruction)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isGeneratingVariations ? 'animate-spin' : ''} />
                    Generate Variasi Baru
                  </button>
                </div>

                {/* 4 AI Variations Grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  {variationsList.map((variation, vIdx) => {
                    const isSelected = selectedVariationUrl === variation.url;
                    return (
                      <div
                        key={vIdx}
                        onClick={() => setSelectedVariationUrl(variation.url)}
                        className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all aspect-square bg-slate-100 group shadow-sm ${
                          isSelected
                            ? 'border-indigo-600 ring-4 ring-indigo-500/20 shadow-md'
                            : 'border-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        <img
                          src={variation.url}
                          alt={variation.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>

                        {isSelected && (
                          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg font-bold">
                            <Check size={16} />
                          </div>
                        )}

                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-md block">
                            {variation.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Instruction Prompt Input */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Kustomisasi Detail Tambahan AI (Opsional):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Contoh: tambahkan es batu banyak, mangkok keramik hitam, atau taburan wijen"
                      value={customPromptInstruction}
                      onChange={(e) => setCustomPromptInstruction(e.target.value)}
                      className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={isGeneratingVariations}
                      onClick={() => fetchPhotoVariations(studioItem.name, studioItem.category, customPromptInstruction)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: UPLOAD CUSTOM PHOTO */}
            {activeStudioTab === 'UPLOAD_CUSTOM' && (
              <div className="space-y-4">
                <div
                  onClick={() => singleItemUploadRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-3xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <UploadCloud size={28} />
                  </div>
                  <div className="text-xs font-extrabold text-slate-700">
                    Klik untuk memilih file foto produk asli dari galeri
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Format JPG, PNG, atau WebP.</p>
                  <input
                    type="file"
                    ref={singleItemUploadRef}
                    onChange={(e) => handleSingleItemFileUpload(e.target.files?.[0] || null)}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Atau Masukkan URL Gambar Web:</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={customUploadUrl}
                    onChange={(e) => setCustomUploadUrl(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {customUploadUrl && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                    <img src={customUploadUrl} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                    <span className="text-xs font-bold text-emerald-700">Foto siap digunakan untuk produk ini.</span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStudioItem(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyStudioPhoto}
                className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              >
                Gunakan Foto Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftMenuView;
