import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  X, RefreshCw, ScanBarcode, Package, Tag, Layers,
  Beaker, Plus, Trash2, Info, AlertTriangle, Check, UploadCloud,
  Camera, Image as ImageIcon, QrCode, TrendingUp, ShoppingCart,
  Users, Hash, Barcode, Sparkles, ChevronDown, Store
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import { toast } from '../utils/alert';
import { compressImageFile } from '../utils/imageCompressor';
import BarcodeScannerModal from './BarcodeScannerModal';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (product: any) => void;
  initialData?: any;
  categories: any[];
  onManageCategories?: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
  onManageCategories
}) => {
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    subCategoryId: '',
    barcode: '',
    buyPrice: '',
    sellPrice: '',
    sellPriceRetail: '',
    sellPriceMitra: '',
    sellPriceGrosir: '',
    minQtyGrosir: '5',
    stock: '',
    minStock: '1',
    status: 'Aktif',
    imageUrl: '',
    brand: '',
    vehicleType: 'MOTOR',
    storageLocation: ''
  });

  const [activeTab, setActiveTab] = useState<'info' | 'pricing' | 'recipe'>('info');
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [newRecipe, setNewRecipe] = useState({ ingredientId: '', qty: '' });
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const posContext = useContext(POSContext);
  const { isBengkel, isRetail, isCafe, profile } = useVertical();
  const hasPriceTiers = isRetail || isBengkel || profile?.enablePriceTiers;
  const isAdvancedMode = posContext?.settings?.ingredientTrackingEnabled;

  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ─── Upload Handler (file picker / kamera) ─────────────────────────────────
  const processAndUploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('File harus berupa gambar', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Ukuran file maksimal adalah 10MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const optimizedFile = await compressImageFile(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.82,
        format: 'image/webp'
      });
      const data = new FormData();
      data.append('image', optimizedFile, optimizedFile.name || 'product.webp');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${posContext?.token}`,
          ...(posContext?.user?.tenantId ? { 'x-tenant-id': String(posContext.user.tenantId) } : {})
        },
        body: data
      });
      const resData = await res.json();
      if (res.ok) {
        setFormData(prev => ({ ...prev, imageUrl: resData.imageUrl || resData.url }));
        toast('✅ Foto produk berhasil diunggah!', 'success');
      } else {
        toast(resData.error || 'Gagal mengunggah foto', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi saat mengunggah foto', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processAndUploadFile(file);
  };

  // ─── Fetch ingredients ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && isAdvancedMode && posContext?.token) {
      const h: Record<string, string> = { Authorization: `Bearer ${posContext.token}` };
      if (posContext?.user?.tenantId) h['x-tenant-id'] = String(posContext.user.tenantId);
      fetch('/api/ingredients', { headers: h })
        .then(r => r.json())
        .then(data => setIngredients(Array.isArray(data) ? data : []))
        .catch(e => console.error(e));
    }
  }, [isOpen, isAdvancedMode, posContext?.token, posContext?.user?.tenantId]);

  // ─── Reset / populate form ────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          categoryId: initialData.categoryId ? String(initialData.categoryId) : '',
          subCategoryId: initialData.subCategoryId ? String(initialData.subCategoryId) : '',
          barcode: initialData.barcode || '',
          buyPrice: initialData.buyPrice ? String(initialData.buyPrice) : '',
          sellPrice: initialData.sellPrice ? String(initialData.sellPrice) : '',
          sellPriceRetail: initialData.sellPriceRetail ? String(initialData.sellPriceRetail) : (initialData.sellPrice ? String(initialData.sellPrice) : ''),
          sellPriceMitra: initialData.sellPriceMitra ? String(initialData.sellPriceMitra) : '',
          sellPriceGrosir: initialData.sellPriceGrosir ? String(initialData.sellPriceGrosir) : '',
          minQtyGrosir: initialData.minQtyGrosir ? String(initialData.minQtyGrosir) : '5',
          stock: initialData.stock !== undefined ? String(initialData.stock) : '',
          minStock: initialData.minStock !== undefined ? String(initialData.minStock) : '1',
          status: initialData.status || 'Aktif',
          imageUrl: initialData.imageUrl || '',
          brand: initialData.brand || '',
          vehicleType: initialData.vehicleType || 'MOTOR',
          storageLocation: initialData.storageLocation || ''
        });
        if (initialData.recipes?.length > 0) {
          setRecipeItems(initialData.recipes.map((r: any) => ({
            ingredientId: r.ingredientId,
            qtyPerServing: r.qtyPerServing,
            ingredientName: r.ingredient?.name || `Bahan #${r.ingredientId}`,
            unit: r.ingredient?.unit || '',
            buyPrice: r.ingredient?.buyPrice || 0
          })));
        } else {
          setRecipeItems([]);
        }
      } else {
        setFormData({
          name: '', categoryId: categories.length > 0 ? String(categories[0].id) : '',
          subCategoryId: '', barcode: '', buyPrice: '', sellPrice: '',
          sellPriceRetail: '', sellPriceMitra: '', sellPriceGrosir: '', minQtyGrosir: '5',
          stock: '', minStock: '1', status: 'Aktif', imageUrl: '',
          brand: '', vehicleType: 'MOTOR', storageLocation: ''
        });
        setRecipeItems([]);
      }
      setActiveTab('info');
    }
  }, [isOpen, initialData, categories]);

  // ─── Auto-HPP dari resep ──────────────────────────────────────────────────
  useEffect(() => {
    if (isAdvancedMode && recipeItems.length > 0) {
      const calculatedHPP = recipeItems.reduce((sum, item) =>
        sum + (Number(item.qtyPerServing) * Number(item.buyPrice || 0)), 0);
      setFormData(prev => ({ ...prev, buyPrice: String(calculatedHPP) }));
    }
  }, [recipeItems, isAdvancedMode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'categoryId') {
      setFormData(prev => ({ ...prev, categoryId: value, subCategoryId: '' }));
    } else if (name === 'sellPrice') {
      setFormData(prev => ({
        ...prev,
        sellPrice: value,
        sellPriceRetail: (!prev.sellPriceRetail || prev.sellPriceRetail === prev.sellPrice) ? value : prev.sellPriceRetail
      }));
    } else if (name === 'sellPriceRetail') {
      setFormData(prev => ({
        ...prev,
        sellPriceRetail: value,
        sellPrice: value
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const generateBarcode = () => {
    const randomCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: randomCode }));
    toast('Barcode otomatis dihasilkan', 'info');
  };

  const handleBarcodeDetected = (code: string) => {
    setFormData(prev => ({ ...prev, barcode: code }));
    setShowBarcodeScanner(false);
    toast(`✅ Barcode terdeteksi: ${code}`, 'success');
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast('Nama produk/sparepart harus diisi', 'error');
    if (!formData.categoryId) return toast('Kategori harus dipilih', 'error');
    
    const effSellPrice = Number(formData.sellPrice) || Number(formData.sellPriceRetail) || 0;
    if (effSellPrice <= 0) return toast('Harga jual tidak valid (harus lebih dari 0)', 'error');
    const effRetail = formData.sellPriceRetail ? Number(formData.sellPriceRetail) : effSellPrice;

    const payload: any = {
      ...formData,
      categoryId: Number(formData.categoryId),
      subCategoryId: formData.subCategoryId ? Number(formData.subCategoryId) : null,
      buyPrice: Number(formData.buyPrice) || 0,
      sellPrice: effSellPrice,
      sellPriceRetail: effRetail,
      sellPriceMitra: formData.sellPriceMitra !== '' && formData.sellPriceMitra !== null ? Number(formData.sellPriceMitra) : null,
      sellPriceGrosir: formData.sellPriceGrosir !== '' && formData.sellPriceGrosir !== null ? Number(formData.sellPriceGrosir) : null,
      minQtyGrosir: formData.minQtyGrosir !== '' && formData.minQtyGrosir !== null ? Number(formData.minQtyGrosir) : null,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      brand: formData.brand?.trim() || undefined,
      vehicleType: formData.vehicleType || undefined,
      storageLocation: formData.storageLocation?.trim() || undefined
    };

    if (isAdvancedMode) {
      payload.recipes = recipeItems.map(r => ({ ingredientId: r.ingredientId, qtyPerServing: r.qtyPerServing }));
    }

    if (onSave) onSave(payload);
  };

  const handleAddRecipeItem = () => {
    if (!newRecipe.ingredientId) { toast('Pilih bahan baku terlebih dahulu', 'error'); return; }
    if (!newRecipe.qty || Number(newRecipe.qty) <= 0) { toast('Kuantitas per porsi harus lebih dari 0', 'error'); return; }
    const ing = ingredients.find(i => i.id === Number(newRecipe.ingredientId));
    if (!ing) return;
    if (recipeItems.find(r => r.ingredientId === ing.id)) { toast('Bahan baku ini sudah ada di resep', 'error'); return; }
    setRecipeItems(prev => [...prev, { ingredientId: ing.id, qtyPerServing: Number(newRecipe.qty), ingredientName: ing.name, unit: ing.unit, buyPrice: ing.buyPrice }]);
    setNewRecipe({ ingredientId: '', qty: '' });
  };

  const handleRemoveRecipeItem = (id: number) => setRecipeItems(prev => prev.filter(r => r.ingredientId !== id));

  const handleAiRecipeSuggest = async () => {
    if (!formData.name.trim()) {
      toast('Ketik nama produk terlebih dahulu di tab Info Produk', 'warning');
      return;
    }
    setAiLoading(true);
    try {
      const h: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${posContext?.token}`
      };
      if (posContext?.user?.tenantId) h['x-tenant-id'] = String(posContext.user.tenantId);
      const res = await fetch('/api/recipes/ai-suggest', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          productName: formData.name,
          category: selectedCat?.name || 'DRINK'
        })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.suggestedItems)) {
        if (data.suggestedItems.length === 0) {
          toast('Belum ada rekomendasi otomatis untuk menu ini. Silakan pilih bahan manual.', 'info');
          return;
        }

        const newItems: typeof recipeItems = [];
        let missingIngredients: string[] = [];

        for (const item of data.suggestedItems) {
          if (item.ingredientId) {
            const ing = ingredients.find(i => i.id === item.ingredientId);
            if (ing) {
              newItems.push({
                ingredientId: ing.id,
                qtyPerServing: Number(item.qtyPerServing),
                ingredientName: ing.name,
                unit: ing.unit,
                buyPrice: ing.buyPrice
              });
            }
          } else {
            missingIngredients.push(item.ingredientName);
          }
        }

        if (newItems.length > 0) {
          setRecipeItems(newItems);
          const sourceText = data.source === 'GEMINI_AI' ? 'Gemini AI' : 'Standar Industri';
          toast(`✨ Resep ${sourceText} berhasil diterapkan (${newItems.length} bahan terhubung)!`, 'success');
        } else if (missingIngredients.length > 0) {
          toast(`Bahan rekomendasi (${missingIngredients.slice(0, 2).join(', ')}) belum ada di inventori Anda. Silakan muat Starter Pack terlebih dahulu.`, 'warning');
        }
      } else {
        toast(data.error || 'Gagal menghasilkan rekomendasi resep', 'error');
      }
    } catch (e: any) {
      toast('Terjadi kesalahan memanggil AI Resep', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Margin calculator realtime ───────────────────────────────────────────
  const marginInfo = (() => {
    const hpp = Number(formData.buyPrice) || 0;
    const jual = Number(formData.sellPrice) || 0;
    if (!jual || !hpp) return null;
    const profit = jual - hpp;
    const margin = ((profit / jual) * 100).toFixed(1);
    return { profit, margin, isGood: profit >= 0 };
  })();

  const selectedCat = categories.find(c => String(c.id) === String(formData.categoryId));
  const subCats = selectedCat?.subCategories || [];

  // Tab definitions
  const tabs = [
    { id: 'info', label: isBengkel ? 'Info Sparepart' : 'Info Produk', icon: Package },
    ...(hasPriceTiers ? [{ id: 'pricing', label: isBengkel ? 'Tier Harga Bengkel' : 'Harga Jual (3-Tier)', icon: TrendingUp }] : []),
    ...(isAdvancedMode && isCafe ? [{ id: 'recipe', label: 'Resep & HPP', icon: Beaker }] : [])
  ] as { id: string; label: string; icon: any }[];

  return (
    <>
      {/* Barcode Scanner Overlay */}
      {showBarcodeScanner && (
        <BarcodeScannerModal
          onDetected={handleBarcodeDetected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* Kamera HP: capture="environment" = kamera belakang */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Modal Backdrop */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto">
        <div className="bg-white w-full h-full md:h-auto md:max-w-4xl md:rounded-3xl shadow-2xl flex flex-col md:overflow-hidden max-h-screen md:max-h-[92vh] animate-in fade-in duration-150">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                <Package size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {initialData 
                    ? (isBengkel ? 'Edit Sparepart & Jasa' : 'Edit Data Produk') 
                    : (isBengkel ? 'Tambah Sparepart / Jasa Baru' : 'Tambah Produk Baru')}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {initialData 
                    ? `Perbarui info ${initialData.name}` 
                    : (isBengkel ? 'Input suku cadang, oli, atau jasa ke katalog POS Bengkel' : 'Input produk ke katalog POS & inventaris')}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Tabs ── */}
          {tabs.length > 1 && (
            <div className="flex px-4 sm:px-6 pt-3 border-b border-slate-200 bg-white gap-1 shrink-0 overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-2.5 px-3 font-bold text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                      isActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                    {tab.id === 'recipe' && recipeItems.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                        {recipeItems.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Form Body ── */}
          <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[72vh] pb-32 md:pb-6">

              {/* ══ TAB: INFO PRODUK ══ */}
              {activeTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                  {/* ── Kolom Kiri: Foto & Barcode & Kategori ── */}
                  <div className="md:col-span-1 space-y-4">

                    {/* ── FOTO PRODUK ── */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Foto Produk
                      </label>

                      {/* Preview Area */}
                      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 aspect-square flex items-center justify-center">
                        {uploading ? (
                          <div className="flex flex-col items-center justify-center gap-2 p-4">
                            <div className="w-10 h-10 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold text-slate-600">Mengunggah...</span>
                          </div>
                        ) : formData.imageUrl ? (
                          <>
                            <img
                              src={formData.imageUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                              }}
                            />
                            {/* Overlay hapus */}
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:bg-rose-700 transition-colors"
                              title="Hapus foto"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-slate-400 p-4">
                            <ImageIcon size={36} strokeWidth={1.5} />
                            <span className="text-xs font-semibold text-slate-500">Belum ada foto</span>
                            <span className="text-[10px] text-slate-400">JPG, PNG, WEBP (Max 10MB)</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons FOTO */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {/* Ambil Foto via Kamera HP */}
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-60"
                        >
                          <Camera size={15} />
                          Ambil Foto
                        </button>
                        {/* Pilih dari Galeri */}
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold transition-all border border-slate-200 disabled:opacity-60"
                        >
                          <UploadCloud size={15} />
                          Galeri
                        </button>
                      </div>
                    </div>

                    {/* ── BARCODE / SKU ── */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Barcode / SKU
                      </label>
                      <div className="flex gap-2">
                        {/* Input barcode */}
                        <div className="relative flex-1">
                          <ScanBarcode size={15} className="absolute left-3 top-[11px] text-slate-400" />
                          <input
                            type="text"
                            name="barcode"
                            className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                            placeholder="Scan / ketik barcode..."
                            value={formData.barcode}
                            onChange={handleChange}
                          />
                        </div>
                        {/* Scan via kamera */}
                        <button
                          type="button"
                          onClick={() => setShowBarcodeScanner(true)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-md shadow-emerald-500/20"
                          title="Scan Barcode via Kamera"
                        >
                          <QrCode size={16} />
                        </button>
                        {/* Generate otomatis */}
                        <button
                          type="button"
                          onClick={generateBarcode}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 transition-all"
                          title="Generate Barcode Otomatis"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Sparkles size={10} className="text-emerald-500" />
                        Tap ikon hijau untuk scan barcode lewat kamera HP
                      </p>
                    </div>

                    {/* ── KATEGORI ── */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Kategori <span className="text-rose-500">*</span>
                        </label>
                        {onManageCategories && (
                          <button type="button" onClick={onManageCategories} className="text-[11px] font-bold text-indigo-600 hover:underline">
                            + Kelola
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Tag size={15} className="absolute left-3 top-[11px] text-slate-400" />
                        <select
                          name="categoryId"
                          className="w-full pl-8 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white appearance-none"
                          value={formData.categoryId}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Pilih Kategori...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-[11px] text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* ── SUB-KATEGORI ── */}
                    {subCats.length > 0 && (
                      <div className="animate-in fade-in duration-200">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Sub-Kategori <span className="text-[10px] font-normal text-slate-400">(Opsional)</span>
                        </label>
                        <div className="relative">
                          <Layers size={15} className="absolute left-3 top-[11px] text-slate-400" />
                          <select
                            name="subCategoryId"
                            className="w-full pl-8 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white appearance-none"
                            value={formData.subCategoryId}
                            onChange={handleChange}
                          >
                            <option value="">-- Tanpa Sub-Kategori --</option>
                            {subCats.map((sc: any) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-[11px] text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Kolom Kanan: Nama, Harga, Stok, Status ── */}
                  <div className="md:col-span-2 space-y-4">

                    {/* Nama Produk / Sparepart */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          {isBengkel ? 'Nama Sparepart / Jasa' : 'Nama Produk'} <span className="text-rose-500">*</span>
                        </label>
                        {isBengkel && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            Katalog Bengkel
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        name="name"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        placeholder={
                          isBengkel
                            ? 'Contoh: Kampas Rem Depan Vario 150 / Oli MPX2 0.8L / Busi Denso'
                            : isRetail
                            ? 'Contoh: Beras Premium 5 Kg'
                            : 'Contoh: Ramen Kuah Paitan Spesial'
                        }
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {/* Atribut Khusus Bengkel: Merk, Jenis Kendaraan, Lokasi Rak */}
                    {isBengkel && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Merk / Brand Part
                          </label>
                          <input
                            type="text"
                            name="brand"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                            placeholder="AHM, Yamaha, Aspira..."
                            value={formData.brand}
                            onChange={handleChange}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Jenis Kendaraan
                          </label>
                          <div className="relative">
                            <select
                              name="vehicleType"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all appearance-none"
                              value={formData.vehicleType}
                              onChange={handleChange}
                            >
                              <option value="MOTOR">Sepeda Motor</option>
                              <option value="MOBIL">Mobil / Roda 4</option>
                              <option value="UMUM">Universal / Semua</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-[10px] text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Lokasi Rak / Bin Gudang
                          </label>
                          <input
                            type="text"
                            name="storageLocation"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                            placeholder="Contoh: RAK-A1, Box 03"
                            value={formData.storageLocation}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    )}

                    {/* Harga Dasar & Tier Harga */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                            {hasPriceTiers ? (isBengkel ? 'Struktur Harga Bengkel (3-Tier)' : 'Struktur Harga Retail (3-Tier)') : 'Harga Dasar'}
                          </p>
                          {hasPriceTiers && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 uppercase">
                              3-Tier POS
                            </span>
                          )}
                        </div>
                        {hasPriceTiers && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('pricing')}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                          >
                            <TrendingUp size={12} /> Rincian &amp; Simulator
                          </button>
                        )}
                      </div>

                      {hasPriceTiers ? (
                        /* TIER PRICING INPUTS: HPP, Harga Umum, Harga Mitra, Harga Grosir */
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Modal HPP */}
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">
                                Harga Modal (HPP / Beli)
                                {isAdvancedMode && recipeItems.length > 0 && (
                                  <span className="ml-1 text-indigo-600 text-[10px]">(Auto)</span>
                                )}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-[9px] text-slate-400 font-bold text-xs">Rp</span>
                                <input
                                  type="number"
                                  name="buyPrice"
                                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                  placeholder="0"
                                  value={formData.buyPrice}
                                  onChange={handleChange}
                                  readOnly={isAdvancedMode && recipeItems.length > 0}
                                />
                              </div>
                            </div>

                            {/* 1. Harga UMUM */}
                            <div>
                              <label className="block text-xs font-bold text-blue-700 mb-1 flex items-center justify-between">
                                <span>1. {isBengkel ? 'Harga Umum (Walk-in / Konsumen)' : 'Harga Eceran (Umum)'} <span className="text-rose-500">*</span></span>
                                <span className="text-[10px] font-normal text-blue-600">Tier Utama</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-[9px] text-blue-600 font-bold text-xs">Rp</span>
                                <input
                                  type="number"
                                  name="sellPrice"
                                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-blue-300 rounded-xl text-xs font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                                  placeholder="0"
                                  value={formData.sellPrice}
                                  onChange={handleChange}
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          {/* Baris 2: Harga Rekan Bengkel (Mitra) + Harga Grosir */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                            {/* 2. Harga MITRA */}
                            <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                              <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center justify-between">
                                <span>2. {isBengkel ? 'Harga Rekan Bengkel (Mitra)' : 'Harga Mitra (Langganan)'}</span>
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Opsional</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-[9px] text-emerald-600 font-bold text-xs">Rp</span>
                                <input
                                  type="number"
                                  name="sellPriceMitra"
                                  className="w-full pl-9 pr-3 py-2 bg-emerald-50/40 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                  placeholder={isBengkel ? 'Khusus sesama bengkel/ojol' : 'Khusus warung rekanan'}
                                  value={formData.sellPriceMitra}
                                  onChange={handleChange}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {isBengkel ? 'Digunakan saat memilih tier MITRA di POS / SPK' : 'Otomatis untuk member tier Mitra'}
                              </p>
                            </div>

                            {/* 3. Harga GROSIR */}
                            <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                              <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center justify-between">
                                <span>3. {isBengkel ? 'Harga Grosir (Toko Part)' : 'Harga Grosir (Partai)'}</span>
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Opsional</span>
                              </label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-[9px] text-amber-600 font-bold text-xs">Rp</span>
                                  <input
                                    type="number"
                                    name="sellPriceGrosir"
                                    className="w-full pl-9 pr-2 py-2 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 outline-none focus:border-amber-500 focus:bg-white transition-all"
                                    placeholder="Rp Grosir"
                                    value={formData.sellPriceGrosir}
                                    onChange={handleChange}
                                  />
                                </div>
                                <div className="w-24 shrink-0">
                                  <input
                                    type="number"
                                    name="minQtyGrosir"
                                    min="1"
                                    className="w-full px-2 py-2 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 text-center outline-none focus:border-amber-500 focus:bg-white transition-all"
                                    placeholder="Min Qty"
                                    title="Minimal kuantitas pembelian grosir"
                                    value={formData.minQtyGrosir}
                                    onChange={handleChange}
                                  />
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                Min. <span className="font-bold text-amber-800">{formData.minQtyGrosir || 5}</span> pcs untuk dapat harga grosir
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard Single Price for Cafe */
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">
                              Harga Modal (HPP)
                              {isAdvancedMode && recipeItems.length > 0 && (
                                <span className="ml-1 text-indigo-600 text-[10px]">(Auto)</span>
                              )}
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-[9px] text-slate-400 font-bold text-xs">Rp</span>
                              <input
                                type="number"
                                name="buyPrice"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                placeholder="0"
                                value={formData.buyPrice}
                                onChange={handleChange}
                                readOnly={isAdvancedMode && recipeItems.length > 0}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-indigo-700 mb-1">
                              Harga Jual Kasir <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-[9px] text-indigo-600 font-bold text-xs">Rp</span>
                              <input
                                type="number"
                                name="sellPrice"
                                className="w-full pl-9 pr-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                                placeholder="0"
                                value={formData.sellPrice}
                                onChange={handleChange}
                                required
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Margin realtime */}
                      {marginInfo && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                          marginInfo.isGood
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <TrendingUp size={13} />
                          <span>
                            Margin: {marginInfo.margin}% &nbsp;·&nbsp;
                            {marginInfo.isGood ? '✅ Untung' : '❌ Rugi'} Rp {Math.abs(marginInfo.profit).toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Shortcut ke tab pricing */}
                    {hasPriceTiers && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('pricing')}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 transition-all text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                            <Store size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-indigo-950">
                              {isBengkel ? 'Kelola Tier Harga Bengkel (Umum, Rekan Bengkel, Grosir)' : 'Atur Harga Grosir & Eceran'}
                            </p>
                            <p className="text-[10px] text-indigo-700">
                              {formData.sellPriceMitra || formData.sellPriceGrosir
                                ? `Mitra: ${formData.sellPriceMitra ? `Rp ${Number(formData.sellPriceMitra).toLocaleString('id-ID')}` : 'Tidak diatur'} · Grosir: ${formData.sellPriceGrosir ? `Rp ${Number(formData.sellPriceGrosir).toLocaleString('id-ID')} (min ${formData.minQtyGrosir || 1} pcs)` : 'Tidak diatur'}`
                                : 'Tap untuk buka simulator & rincian tier harga di POS'}
                            </p>
                          </div>
                        </div>
                        <ChevronDown size={16} className="text-indigo-700 -rotate-90" />
                      </button>
                    )}

                    {/* Stok */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Stok Awal</label>
                        <div className="relative">
                          <Layers size={15} className="absolute left-3 top-[11px] text-slate-400" />
                          <input
                            type="number"
                            name="stock"
                            className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                            placeholder="0"
                            value={formData.stock}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Min. Stok (Alert)</label>
                        <div className="relative">
                          <AlertTriangle size={15} className="absolute left-3 top-[11px] text-amber-500" />
                          <input
                            type="number"
                            name="minStock"
                            className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                            placeholder="1"
                            value={formData.minStock}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status Produk</label>
                      <div className="flex gap-3">
                        {[
                          { val: 'Aktif', label: '✓ Aktif (Tampil di POS)', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                          { val: 'Tidak Aktif', label: '✕ Tidak Aktif', cls: 'text-slate-500 bg-slate-100 border-slate-200' }
                        ].map(opt => (
                          <label key={opt.val} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="status"
                              value={opt.val}
                              checked={formData.status === opt.val}
                              onChange={handleChange}
                              className="w-4 h-4 text-indigo-600"
                            />
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${opt.cls}`}>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ TAB: HARGA JUAL & 3-TIER (RETAIL / BENGKEL) ══ */}
              {activeTab === 'pricing' && hasPriceTiers && (
                <div className="space-y-5">
                  {/* Banner info */}
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-amber-50 border border-indigo-200/80 rounded-2xl p-4 flex gap-3 items-start shadow-xs">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Info size={16} />
                    </div>
                    <div>
                      <p className="font-black text-indigo-950 text-xs sm:text-sm mb-0.5">
                        {isBengkel ? 'Sistem Harga 3-Tier Bengkel Motor & Mobil' : 'Sistem Harga 3-Tier Retail'}
                      </p>
                      <p className="text-[11px] text-indigo-900 leading-relaxed">
                        {isBengkel
                          ? 'Kasir POS Bengkel dan modul Work Order / SPK otomatis mengalihkan harga berdasarkan tier pelanggan: Umum (Walk-in), Rekan Bengkel (Mitra), atau Grosir jika kuantitas part mencapai batas minimum.'
                          : 'Kasir akan otomatis menerapkan harga grosir jika qty produk ≥ minimum grosir. Harga Eceran = fallback ke Harga Jual Kasir jika kosong.'}
                      </p>
                    </div>
                  </div>

                  {/* Harga Jual Kasir (read-only ringkasan) */}
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={16} className="text-indigo-600" />
                        <span className="text-sm font-black text-indigo-900">
                          {isBengkel ? 'Harga Umum / Kasir Utama' : 'Harga Kasir Utama'}
                        </span>
                      </div>
                      <span className="text-base font-black text-indigo-700">
                        Rp {Number(formData.sellPrice || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-600 mt-1 ml-6">
                      {isBengkel ? 'Tarif dasar untuk pelanggan servis umum & walk-in' : 'Diatur di tab Info Produk'}
                    </p>
                  </div>

                  {/* Grid harga tier (3-Tier: Umum, Mitra, Grosir) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {/* 1. Harga Eceran (Umum) */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-blue-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Users size={15} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-blue-900">
                              {isBengkel ? '1. Harga Umum' : '1. Harga Eceran'}
                            </p>
                            <p className="text-[10px] text-blue-600">
                              {isBengkel ? 'Servis umum & walk-in customer' : 'Pelanggan umum / satuan'}
                            </p>
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-[9px] text-blue-600 font-bold text-xs">Rp</span>
                          <input
                            type="number"
                            name="sellPriceRetail"
                            className="w-full pl-9 pr-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder={formData.sellPrice || '0'}
                            value={formData.sellPriceRetail}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">Kosong = pakai Harga Kasir Utama</p>
                    </div>

                    {/* 2. Harga Mitra (Rekan Bengkel / Langganan) */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-emerald-300 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <Store size={15} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-emerald-900">
                              {isBengkel ? '2. Harga Rekan Bengkel' : '2. Harga Mitra'}
                            </p>
                            <p className="text-[10px] text-emerald-600">
                              {isBengkel ? 'Sesama bengkel, ojol, & komunitas' : 'Warung langganan & toko cabang'}
                            </p>
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-[9px] text-emerald-600 font-bold text-xs">Rp</span>
                          <input
                            type="number"
                            name="sellPriceMitra"
                            className="w-full pl-9 pr-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="0"
                            value={formData.sellPriceMitra}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {isBengkel ? 'Otomatis aktif saat pilih tier MITRA di POS Bengkel' : 'Otomatis saat pilih member tier MITRA'}
                      </p>
                    </div>

                    {/* 3. Harga Grosir (Volume / Partai / Toko Part) */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-amber-300 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Sparkles size={15} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-amber-900">
                              {isBengkel ? '3. Harga Grosir Part' : '3. Harga Grosir'}
                            </p>
                            <p className="text-[10px] text-amber-600">
                              {isBengkel ? 'Reseller / pembelian suku cadang partai' : 'Diskon otomatis saat qty ≥ min'}
                            </p>
                          </div>
                        </div>
                        <div className="relative mb-2.5">
                          <span className="absolute left-3 top-[9px] text-amber-600 font-bold text-xs">Rp</span>
                          <input
                            type="number"
                            name="sellPriceGrosir"
                            className="w-full pl-9 pr-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-black text-amber-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                            placeholder="0"
                            value={formData.sellPriceGrosir}
                            onChange={handleChange}
                          />
                        </div>
                        {/* Min Qty Grosir */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Min. Qty Grosir
                          </label>
                          <div className="relative">
                            <Hash size={13} className="absolute left-3 top-[11px] text-slate-400" />
                            <input
                              type="number"
                              name="minQtyGrosir"
                              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                              placeholder="5"
                              min="1"
                              value={formData.minQtyGrosir}
                              onChange={handleChange}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">Otomatis saat kasir input qty &ge; target</p>
                    </div>
                  </div>

                  {/* Preview perbandingan harga */}
                  {(formData.sellPrice || formData.sellPriceMitra || formData.sellPriceGrosir) && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">
                        {isBengkel ? 'Preview Simulasi Tier Harga di Kasir POS Bengkel' : 'Preview Tier Harga di Kasir'}
                      </p>
                      <div className="space-y-2">
                        {[
                          { 
                            label: isBengkel ? 'Umum / Servis Walk-in' : 'Kasir / Eceran (Umum)', 
                            price: Number(formData.sellPriceRetail || formData.sellPrice || 0), 
                            badge: 'UMUM', 
                            color: 'blue' 
                          },
                          { 
                            label: isBengkel ? 'Rekan Bengkel / Mitra Fleet' : 'Mitra / Warung Langganan', 
                            price: Number(formData.sellPriceMitra || 0), 
                            badge: 'MITRA', 
                            color: 'emerald' 
                          },
                          { 
                            label: isBengkel ? `Grosir Toko Part (min ${formData.minQtyGrosir || 1} pcs)` : `Grosir Partai (min ${formData.minQtyGrosir || 1} pcs)`, 
                            price: Number(formData.sellPriceGrosir || 0), 
                            badge: 'GROSIR', 
                            color: 'amber' 
                          }
                        ].map(item => item.price > 0 && (
                          <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                item.color === 'blue' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : item.color === 'emerald'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {item.badge}
                              </span>
                              <span className="text-xs text-slate-700 font-semibold">{item.label}</span>
                            </div>
                            <span className="text-sm font-black text-slate-900">
                              Rp {item.price.toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB: RESEP & HPP ══ */}
              {activeTab === 'recipe' && isAdvancedMode && (
                <div className="space-y-5">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Info size={16} />
                    </div>
                    <div>
                      <p className="font-black text-amber-900 mb-0.5 text-xs sm:text-sm">Kalkulasi Otomatis HPP Berdasarkan Resep</p>
                      <p className="font-medium text-amber-800/90 text-[11px] sm:text-xs">
                        Harga modal dihitung otomatis dari total bahan baku. Setiap kali terjual, stok bahan baku terpotong otomatis.
                      </p>
                    </div>
                  </div>

                  {/* Form tambah bahan */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={14} className="text-indigo-600" /> Tambah Bahan ke Resep
                      </span>

                      {!isBengkel && !isRetail && (
                        <button
                          type="button"
                          onClick={handleAiRecipeSuggest}
                          disabled={aiLoading || !formData.name}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                          title="Generate komposisi bahan baku otomatis dari nama produk menggunakan AI"
                        >
                          <Sparkles size={13} className={aiLoading ? 'animate-spin' : 'text-amber-300'} />
                          <span>{aiLoading ? 'Menganalisis...' : '✨ Rekomendasi Resep AI'}</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                          Pilih Bahan Baku <span className="text-rose-500">*</span>
                        </label>
                        <select
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                          value={newRecipe.ingredientId}
                          onChange={e => setNewRecipe(p => ({ ...p, ingredientId: e.target.value }))}
                        >
                          <option value="">-- Pilih Bahan Baku --</option>
                          {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} (Stok: {ing.stock} {ing.unit} | Rp {Number(ing.buyPrice || 0).toLocaleString('id-ID')}/{ing.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      {(() => {
                        const selectedIng = ingredients.find(i => String(i.id) === String(newRecipe.ingredientId));
                        return (
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                              Takaran {selectedIng?.unit ? `(${selectedIng.unit})` : '/ Porsi'} <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number" step="any" placeholder="0.00"
                                className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-indigo-500"
                                value={newRecipe.qty}
                                onChange={e => setNewRecipe(p => ({ ...p, qty: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRecipeItem(); } }}
                              />
                              {selectedIng?.unit && (
                                <span className="absolute right-2 top-2 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                  {selectedIng.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="sm:col-span-3">
                        <button
                          type="button"
                          onClick={handleAddRecipeItem}
                          disabled={!newRecipe.ingredientId || !newRecipe.qty}
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Plus size={16} /> Tambah
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabel resep */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                            <th className="p-3.5 pl-4">Bahan Baku</th>
                            <th className="p-3.5 text-center">Takaran</th>
                            <th className="p-3.5 text-right">Harga/Satuan</th>
                            <th className="p-3.5 text-right">Subtotal HPP</th>
                            <th className="p-3.5 text-center pr-4 w-16">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recipeItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-10 text-center text-slate-400">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
                                  <Beaker size={24} />
                                </div>
                                <p className="font-bold text-slate-600 text-xs">Belum ada bahan baku di resep</p>
                              </td>
                            </tr>
                          ) : (
                            recipeItems.map((item, idx) => (
                              <tr key={item.ingredientId} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="p-3.5 pl-4">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                    <span className="font-bold text-slate-800">{item.ingredientName}</span>
                                  </div>
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-100">
                                    {item.qtyPerServing} <span className="text-[10px] font-semibold text-indigo-400">{item.unit}</span>
                                  </span>
                                </td>
                                <td className="p-3.5 text-right font-medium text-slate-600">
                                  Rp {Number(item.buyPrice || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="p-3.5 text-right font-black text-slate-900">
                                  Rp {(item.qtyPerServing * item.buyPrice).toLocaleString('id-ID')}
                                </td>
                                <td className="p-3.5 text-center pr-4">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRecipeItem(item.ingredientId)}
                                    className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/80 flex items-center justify-center transition-all mx-auto active:scale-95"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Kalkulasi HPP summary */}
                  {recipeItems.length > 0 && (() => {
                    const totalHpp = recipeItems.reduce((s, i) => s + (i.qtyPerServing * i.buyPrice), 0);
                    const sellPrice = Number(formData.sellPrice) || 0;
                    const profit = sellPrice - totalHpp;
                    const marginPercent = sellPrice > 0 ? ((profit / sellPrice) * 100).toFixed(1) : '0';
                    return (
                      <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-slate-200">
                        {[
                          { label: 'Total HPP / Porsi', value: `Rp ${totalHpp.toLocaleString('id-ID')}`, color: 'text-indigo-700' },
                          { label: 'Harga Jual Kasir', value: sellPrice > 0 ? `Rp ${sellPrice.toLocaleString('id-ID')}` : 'Belum diset', color: 'text-slate-900' },
                          { label: 'Estimasi Profit', value: `Rp ${profit.toLocaleString('id-ID')} (${marginPercent}%)`, color: profit >= 0 ? 'text-emerald-600' : 'text-rose-600' }
                        ].map(card => (
                          <div key={card.label} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">{card.label}</span>
                            <span className={`text-sm font-black ${card.color}`}>{card.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Sticky Footer Actions ── */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                className="py-2.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                onClick={onClose}
              >
                Batal
              </button>
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Check size={16} />
                {initialData ? 'Simpan Perubahan' : 'Simpan Produk'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ProductModal;
