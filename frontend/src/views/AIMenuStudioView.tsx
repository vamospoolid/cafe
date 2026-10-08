import React, { useState, useContext, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  RefreshCw, 
  Check, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  Layers, 
  ChefHat, 
  Coffee, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Sliders,
  DollarSign,
  Palette,
  Key,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import { toast, confirmAlert } from '../utils/alert';

interface ScannedItem {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  description: string;
  stationTarget: 'BAR' | 'KITCHEN' | 'PASTRY';
  imageUrl: string;
  promptSignature?: string;
  selected: boolean;
  isRegenerating?: boolean;
}

const AESTHETIC_STYLES = [
  { id: 'nordic', name: 'Nordic Cafe & Light Oak', desc: 'Meja kayu terang, piring matte off-white, pencahayaan alami pagi.' },
  { id: 'artisan', name: 'Dark Artisan & Rustic Slate', desc: 'Nuansa gelap elegan, batu tulis slate, pencahayaan dramatis warm.' },
  { id: 'japanese', name: 'Japanese Zen & Minimalist', desc: 'Piring tembikar jepang, nuansa clean linen, estetika wabi-sabi.' },
  { id: 'tropical', name: 'Tropical Brunch & Botanical', desc: 'Aksen dedaunan monstera, cahaya tropis cerah, piring pastel.' }
];

export const AIMenuStudioView: React.FC = () => {
  const navigate = useNavigate();
  const posContext = useContext(POSContext);
  const { isCafe } = useVertical();

  // State Step & Upload
  const [images, setImages] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState('nordic');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  
  // Scanned Results
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ createdCount: number; updatedCount: number } | null>(null);

  // Gemini API Key State terisolasi ketat per tenant
  const tenantId = posContext?.user?.tenantId || 'global';
  const storageKey = `gemini_api_key_${tenantId}`;

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem(storageKey) || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(geminiApiKey);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || '';
    setGeminiApiKey(saved);
    setTempApiKey(saved);
  }, [storageKey]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Headers helper
  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${posContext?.token}`,
      ...extra
    };
    if (posContext?.user?.tenantId) {
      headers['x-tenant-id'] = String(posContext.user.tenantId);
    }
    return headers;
  };

  // Handle File Selections
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 6) {
      toast.error('Maksimal 6 foto menu fisik sekaligus.');
      return;
    }

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar (JPG/PNG/WEBP).');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (e.target) e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Jalankan AI Scan & OCR Extraction
  const handleStartScan = async () => {
    if (images.length === 0) {
      toast.error('Unggah minimal 1 foto lembar menu fisik kafe Anda.');
      return;
    }

    setIsScanning(true);
    setScanProgress('Mengirim gambar & membaca lembar menu kafe...');

    try {
      // Step simulator info
      const progressTimer = setTimeout(() => {
        setScanProgress('Mengekstraksi nama menu, kategori & normalisasi harga rupiah...');
      }, 2500);

      const progressTimer2 = setTimeout(() => {
        setScanProgress('Melukis foto kuliner kafe estetika studio HD...');
      }, 6000);

      const res = await fetch('/api/ai-menu/extract', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          images,
          aestheticStyle: selectedStyle,
          apiKey: geminiApiKey || undefined
        })
      });

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengekstraksi menu AI.');
      }

      if (!data.items || data.items.length === 0) {
        toast.error('Tidak ada menu yang terdeteksi dari foto tersebut. Coba gunakan foto dengan pencahayaan lebih jelas.');
        return;
      }

      const scannedItems: ScannedItem[] = data.items.map((it: any, index: number) => ({
        id: `scanned-${Date.now()}-${index}`,
        name: it.name || 'Menu Baru',
        category: it.category || 'Makanan & Minuman',
        price: Number(it.price) || 20000,
        costPrice: Number(it.costPrice) || Math.round((Number(it.price) || 20000) * 0.4),
        description: it.description || '',
        stationTarget: it.stationTarget === 'BAR' ? 'BAR' : (it.stationTarget === 'PASTRY' ? 'PASTRY' : 'KITCHEN'),
        imageUrl: it.imageUrl || '',
        promptSignature: it.promptSignature || '',
        selected: true
      }));

      setItems(scannedItems);
      toast.success(`Berhasil mengekstraksi ${scannedItems.length} menu kafe! Silakan tinjau matriks di bawah.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Terjadi kesalahan saat memproses gambar menu.');
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  // Regenerasi Foto AI per Item
  const handleRegenerateItemImage = async (item: ScannedItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isRegenerating: true } : i));

    try {
      const res = await fetch('/api/ai-menu/regenerate-image', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          itemName: item.name,
          categoryName: item.category,
          aestheticStyle: selectedStyle
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah foto AI.');

      setItems(prev => prev.map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            imageUrl: data.imageUrl,
            isRegenerating: false
          };
        }
        return i;
      }));
      toast.success(`Foto hidangan untuk "${item.name}" berhasil dilukis ulang!`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal regenerasi gambar.');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isRegenerating: false } : i));
    }
  };

  // Update Field Item
  const updateItemField = (id: string, field: keyof ScannedItem, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, [field]: value };
      }
      return i;
    }));
  };

  // Hapus Item dari Matriks
  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Tambah Menu Baru Manual ke Matriks
  const addNewItem = () => {
    const newItem: ScannedItem = {
      id: `manual-${Date.now()}`,
      name: 'Item Menu Baru',
      category: items[0]?.category || 'Minuman',
      price: 25000,
      costPrice: 10000,
      description: 'Deskripsi menu kafe...',
      stationTarget: 'BAR',
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=512&auto=format&fit=crop&q=80',
      selected: true
    };
    setItems(prev => [newItem, ...prev]);
  };

  // Filter Kategori List
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach(i => {
      if (i.category) cats.add(i.category);
    });
    return Array.from(cats);
  }, [items]);

  // Items terfilter
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategoryFilter === 'ALL' || item.category === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, selectedCategoryFilter]);

  const selectedCount = useMemo(() => items.filter(i => i.selected).length, [items]);

  // Simpan/Commit ke Database
  const handleCommitCatalog = async () => {
    const itemsToCommit = items.filter(i => i.selected);
    if (itemsToCommit.length === 0) {
      toast.error('Pilih minimal 1 menu untuk diterapkan ke katalog.');
      return;
    }

    const confirmed = await confirmAlert(
      `Terapkan ${itemsToCommit.length} Menu ke Katalog Kasir?`,
      'Kategori baru dan produk akan otomatis dibuatkan dan langsung siap digunakan untuk transaksi kasir.'
    );

    if (!confirmed) return;

    setIsCommitting(true);

    try {
      const res = await fetch('/api/ai-menu/commit', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          items: itemsToCommit.map(i => ({
            name: i.name,
            category: i.category,
            price: Number(i.price),
            costPrice: Number(i.costPrice) || 0,
            description: i.description,
            stationTarget: i.stationTarget,
            imageUrl: i.imageUrl
          })),
          updateIfExists: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan menu ke katalog.');

      setCommitResult({
        createdCount: data.createdCount || 0,
        updatedCount: data.updatedCount || 0
      });

      toast.success(`Sukses! ${data.createdCount} menu berhasil disimpan ke katalog kasir.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal menyimpan menu.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Header Studio */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-0.5 shadow-xl shadow-amber-500/10 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles size={28} className="text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">AI Culinary Menu Studio</h1>
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white tracking-widest uppercase">
                  Kafe Edition
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Foto lembar menu fisik kafe Anda. AI otomatis membaca teks, menyaring kategori bar &amp; dapur, menormalkan harga rupiah, serta melukis foto hidangan bergaya studio kuliner modern.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setTempApiKey(geminiApiKey); setIsApiKeyModalOpen(true); }}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                geminiApiKey 
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' 
                  : 'border-slate-700 bg-slate-800/80 text-amber-300 hover:bg-slate-800'
              }`}
              title="Atur Kunci API Google Gemini"
            >
              <Key size={15} className={geminiApiKey ? "text-emerald-400" : "text-amber-400"} />
              <span>{geminiApiKey ? "Kunci API: Aktif" : "Kunci API AI"}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/produk')}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight size={15} className="rotate-180" />
              <span>Kembali ke Katalog</span>
            </button>
          </div>
        </div>

        {/* Modal Konfigurasi API Key Gemini */}
        {isApiKeyModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Kunci API Google Gemini</h3>
                    <p className="text-[11px] text-slate-400">Gemini 1.5 Flash Vision OCR</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Masukkan Gemini API Key untuk membaca foto lembar menu kafe secara otomatis. Kunci ini bisa didapatkan <strong>gratis tanpa kartu kredit</strong> dari Google AI Studio.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value.trim())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-600 font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                  <AlertCircle size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span>Belum punya kunci? </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 font-bold underline inline-flex items-center gap-1"
                    >
                      <span>Ambil Gratis di Google AI Studio</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(storageKey);
                    setGeminiApiKey('');
                    setTempApiKey('');
                    setIsApiKeyModalOpen(false);
                    toast.success('Kunci API kustom dihapus (kembali ke default server).');
                  }}
                  className="px-3 py-2 text-xs text-rose-400 hover:underline cursor-pointer"
                >
                  Reset / Hapus
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsApiKeyModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tempApiKey) {
                        localStorage.setItem(storageKey, tempApiKey);
                        setGeminiApiKey(tempApiKey);
                        toast.success('Kunci API Gemini berhasil disimpan untuk tenant ini!');
                      }
                      setIsApiKeyModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black text-white cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    Simpan Kunci
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal / Banner Sukses Commit */}
        {commitResult && (
          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h4 className="text-base font-black text-emerald-200">Menu Telah Berhasil Diterapkan ke Katalog Kasir!</h4>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Ditambahkan {commitResult.createdCount} menu baru &amp; diperbarui {commitResult.updatedCount} menu. Kasir sekarang sudah bisa memilih menu ini.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/pos')}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <span>Buka Kasir POS Sekarang</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCommitResult(null)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Upload Foto Menu Fisik & Preferensi Style */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Box Kiri: Upload Dropzone & Thumbnails */}
          <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ImageIcon size={18} className="text-amber-400" />
                  <span>1. Foto Buku / Lembar Menu Fisik ({images.length}/6)</span>
                </h3>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              {/* Upload Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-700 aspect-3/4 bg-slate-900 shadow-inner">
                    <img src={img} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <span className="text-[11px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded-full">Lembar #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="p-2 rounded-xl bg-rose-600/90 text-white hover:bg-rose-700 transition-all cursor-pointer"
                        title="Hapus foto ini"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Dropzone Add Button */}
                {images.length < 6 && (
                  <div className="flex flex-col gap-2 aspect-3/4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-900/40 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group"
                    >
                      <Upload size={24} className="text-slate-500 group-hover:text-amber-400 group-hover:scale-110 transition-all mb-2" />
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white">Pilih File Foto</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WEBP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Camera size={15} className="text-amber-400" />
                      <span>Kamera HP</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden Inputs */}
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              <input 
                ref={cameraInputRef} 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-2 border-t border-slate-900">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <span>Pastikan teks nama dan harga pada buku menu terlihat jelas dan tidak terlalu buram/silau.</span>
            </div>
          </div>

          {/* Box Kanan: Estetika Visual AI & Action Scan */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
                <Palette size={18} className="text-indigo-400" />
                <span>2. Estetika Visual Foto Kafe</span>
              </h3>

              <div className="space-y-2.5 mb-6">
                {AESTHETIC_STYLES.map(style => (
                  <label
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`block p-3 rounded-2xl border transition-all cursor-pointer ${
                      selectedStyle === style.id
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${selectedStyle === style.id ? 'text-indigo-300' : 'text-slate-200'}`}>
                        {style.name}
                      </span>
                      {selectedStyle === style.id && <Check size={14} className="text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{style.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <button
                type="button"
                disabled={images.length === 0 || isScanning}
                onClick={handleStartScan}
                className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xl ${
                  images.length === 0 || isScanning
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-indigo-500/20 active:scale-98'
                }`}
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={18} className="animate-spin text-white" />
                    <span>Mengekstraksi Menu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-amber-200 animate-pulse" />
                    <span>✨ Ekstraksi &amp; Lukis Menu AI</span>
                  </>
                )}
              </button>

              {isScanning && (
                <p className="text-[11px] text-amber-400 text-center font-bold mt-2 animate-pulse">
                  {scanProgress}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Interactive Review Matrix */}
        {items.length > 0 && (
          <div className="mt-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-white">Tinjau &amp; Sesuaikan Matriks Menu</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-extrabold border border-slate-700">
                    {selectedCount} dari {items.length} Dipilih
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Periksa harga rupiah, stasiun printer dapur/bar, dan ganti foto hidangan bila diperlukan sebelum disimpan ke katalog.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addNewItem}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <Plus size={15} />
                  <span>Tambah Item</span>
                </button>

                <button
                  type="button"
                  disabled={selectedCount === 0 || isCommitting}
                  onClick={handleCommitCatalog}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                    selectedCount === 0 || isCommitting
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black shadow-emerald-500/20 active:scale-95'
                  }`}
                >
                  {isCommitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin text-slate-950" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>✓ Terapkan ({selectedCount}) ke Katalog Kasir</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3 mb-4">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari menu hasil scan..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semua ({items.length})
                </button>
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedCategoryFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat} ({items.filter(i => i.category === cat).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.every(i => i.selected)}
                          onChange={e => {
                            const checked = e.target.checked;
                            setItems(prev => prev.map(i => ({ ...i, selected: checked })));
                          }}
                          className="rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5 w-24">Foto AI</th>
                      <th className="p-3.5">Nama Menu Kafe</th>
                      <th className="p-3.5 w-44">Kategori</th>
                      <th className="p-3.5 w-32">Stasiun Dapur</th>
                      <th className="p-3.5 w-36">Harga Jual (Rp)</th>
                      <th className="p-3.5 w-32">Estimasi HPP (Rp)</th>
                      <th className="p-3.5 w-16 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.map(item => (
                      <tr key={item.id} className={`hover:bg-slate-900/40 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                        {/* Checkbox */}
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={e => updateItemField(item.id, 'selected', e.target.checked)}
                            className="rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Image + Regenerate Overlay */}
                        <td className="p-3.5">
                          <div className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shrink-0">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              disabled={item.isRegenerating}
                              onClick={() => handleRegenerateItemImage(item)}
                              className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                              title="Lukis Ulang Foto AI"
                            >
                              <RefreshCw size={14} className={item.isRegenerating ? 'animate-spin' : ''} />
                              <span className="text-[8px] font-black uppercase mt-0.5">Ganti</span>
                            </button>
                            {item.isRegenerating && (
                              <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                                <RefreshCw size={14} className="animate-spin text-amber-400" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Nama Menu */}
                        <td className="p-3.5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => updateItemField(item.id, 'name', e.target.value)}
                            className="w-full font-bold text-white bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Deskripsi singkat hidangan..."
                            value={item.description}
                            onChange={e => updateItemField(item.id, 'description', e.target.value)}
                            className="w-full text-[11px] text-slate-400 bg-transparent border-0 focus:ring-0 px-2.5 py-0.5 mt-1 placeholder-slate-600"
                          />
                        </td>

                        {/* Kategori */}
                        <td className="p-3.5">
                          <input
                            type="text"
                            value={item.category}
                            onChange={e => updateItemField(item.id, 'category', e.target.value)}
                            className="w-full text-slate-300 bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                          />
                        </td>

                        {/* Station Target */}
                        <td className="p-3.5">
                          <select
                            value={item.stationTarget}
                            onChange={e => updateItemField(item.id, 'stationTarget', e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-800 text-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:border-indigo-500"
                          >
                            <option value="BAR">☕ Bar (Minuman)</option>
                            <option value="KITCHEN">🍳 Kitchen (Dapur)</option>
                            <option value="PASTRY">🍰 Pastry / Bakery</option>
                          </select>
                        </td>

                        {/* Harga Jual */}
                        <td className="p-3.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">Rp</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={e => updateItemField(item.id, 'price', Number(e.target.value))}
                              className="w-full text-right font-black text-amber-300 bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-lg pl-7 pr-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </td>

                        {/* HPP */}
                        <td className="p-3.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">Rp</span>
                            <input
                              type="number"
                              value={item.costPrice}
                              onChange={e => updateItemField(item.id, 'costPrice', Number(e.target.value))}
                              className="w-full text-right text-slate-400 bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-lg pl-7 pr-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </td>

                        {/* Delete */}
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Hapus dari daftar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIMenuStudioView;
