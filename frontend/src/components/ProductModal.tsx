import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  X, Image as ImageIcon, RefreshCw, ScanBarcode, Package, Tag, Layers, 
  Beaker, Plus, Trash2, Info, AlertTriangle, Check, UploadCloud 
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

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
    stock: '',
    minStock: '1',
    status: 'Aktif',
    imageUrl: ''
  });

  const [activeTab, setActiveTab] = useState<'info' | 'recipe'>('info');
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [newRecipe, setNewRecipe] = useState({ ingredientId: '', qty: '' });

  const posContext = useContext(POSContext);
  const isAdvancedMode = posContext?.settings?.ingredientTrackingEnabled;

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('File harus berupa gambar', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Ukuran file maksimal adalah 10MB', 'error');
      return;
    }

    const data = new FormData();
    data.append('image', file);

    setUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${posContext?.token}`
        },
        body: data
      });

      const resData = await res.json();
      if (res.ok) {
        setFormData(prev => ({ ...prev, imageUrl: resData.imageUrl }));
        toast('Foto berhasil diunggah!', 'success');
      } else {
        toast(resData.error || 'Gagal mengunggah foto', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi saat mengunggah foto', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch ingredients if advanced mode is on
  useEffect(() => {
    if (isOpen && isAdvancedMode && posContext?.token) {
      fetch('/api/ingredients', {
        headers: { Authorization: `Bearer ${posContext.token}` }
      })
      .then(r => r.json())
      .then(data => setIngredients(data))
      .catch(e => console.error(e));
    }
  }, [isOpen, isAdvancedMode, posContext?.token]);

  // Set initial data for editing or reset for new product
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
          stock: initialData.stock !== undefined ? String(initialData.stock) : '',
          minStock: initialData.minStock !== undefined ? String(initialData.minStock) : '1',
          status: initialData.status || 'Aktif',
          imageUrl: initialData.imageUrl || ''
        });

        // Set recipes if present
        if (initialData.recipes && initialData.recipes.length > 0) {
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
        // Reset form
        setFormData({
          name: '',
          categoryId: categories.length > 0 ? String(categories[0].id) : '',
          subCategoryId: '',
          barcode: '',
          buyPrice: '',
          sellPrice: '',
          stock: '',
          minStock: '1',
          status: 'Aktif',
          imageUrl: ''
        });
        setRecipeItems([]);
      }
      setActiveTab('info');
    }
  }, [isOpen, initialData, categories]);

  // Calculate HPP automatically if in recipe mode and has items
  useEffect(() => {
    if (isAdvancedMode && recipeItems.length > 0) {
      const calculatedHPP = recipeItems.reduce((sum, item) => {
        return sum + (Number(item.qtyPerServing) * Number(item.buyPrice || 0));
      }, 0);
      setFormData(prev => ({ ...prev, buyPrice: String(calculatedHPP) }));
    }
  }, [recipeItems, isAdvancedMode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'categoryId') {
      setFormData(prev => ({
        ...prev,
        categoryId: value,
        subCategoryId: '' // Reset sub-category when main category changes
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const generateBarcode = () => {
    const randomCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: randomCode }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast('Nama produk harus diisi', 'error');
    if (!formData.categoryId) return toast('Kategori produk harus dipilih', 'error');
    if (!formData.sellPrice || Number(formData.sellPrice) < 0) return toast('Harga jual tidak valid', 'error');

    const payload: any = {
      ...formData,
      categoryId: Number(formData.categoryId),
      subCategoryId: formData.subCategoryId ? Number(formData.subCategoryId) : null,
      buyPrice: Number(formData.buyPrice) || 0,
      sellPrice: Number(formData.sellPrice),
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
    };

    if (isAdvancedMode) {
      payload.recipes = recipeItems.map(r => ({
        ingredientId: r.ingredientId,
        qtyPerServing: r.qtyPerServing
      }));
    }

    if (onSave) {
      onSave(payload);
    }
  };

  const handleAddRecipeItem = () => {
    if (!newRecipe.ingredientId) {
      toast('Silakan pilih bahan baku terlebih dahulu', 'error');
      return;
    }
    if (!newRecipe.qty || Number(newRecipe.qty) <= 0) {
      toast('Kuantitas per porsi harus lebih dari 0', 'error');
      return;
    }

    const ing = ingredients.find(i => i.id === Number(newRecipe.ingredientId));
    if (!ing) return;

    if (recipeItems.find(r => r.ingredientId === ing.id)) {
      toast('Bahan baku ini sudah ada di dalam resep', 'error');
      return;
    }

    setRecipeItems(prev => [...prev, {
      ingredientId: ing.id,
      qtyPerServing: Number(newRecipe.qty),
      ingredientName: ing.name,
      unit: ing.unit,
      buyPrice: ing.buyPrice
    }]);
    setNewRecipe({ ingredientId: '', qty: '' });
  };

  const handleRemoveRecipeItem = (id: number) => {
    setRecipeItems(prev => prev.filter(r => r.ingredientId !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto">
      {/* Container: Full Screen on Mobile (< md), Rounded Card Modal on Desktop (>= md) */}
      <div className="bg-white w-full h-full md:h-auto md:max-w-4xl md:rounded-3xl shadow-2xl flex flex-col md:overflow-hidden max-h-screen md:max-h-[92vh] animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {initialData ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {initialData ? `Perbarui info dan resep ${initialData.name}` : 'Input produk baru ke katalog POS & inventaris'}
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

        {/* Tabs for Advanced Mode */}
        {isAdvancedMode && (
          <div className="flex px-4 sm:px-6 pt-3 border-b border-slate-200 bg-white gap-3 shrink-0">
            <button 
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-2.5 px-3 font-bold text-xs sm:text-sm transition-all border-b-2 ${
                activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Informasi Umum
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('recipe')}
              className={`pb-2.5 px-3 font-bold text-xs sm:text-sm transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'recipe' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Beaker size={15} /> Resep & Komposisi HPP
              {recipeItems.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                  {recipeItems.length}
                </span>
              )}
            </button>
          </div>
        )}
        
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          {/* Form Scrollable Body */}
          <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[72vh] pb-32 md:pb-6">
            {activeTab === 'info' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Kolom Kiri: Foto & Barcode */}
                <div className="md:col-span-1 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Foto Produk</label>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <div 
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl bg-slate-50 h-44 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative overflow-hidden group"
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center justify-center p-4">
                          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-xs font-bold text-slate-600">Mengunggah foto...</span>
                        </div>
                      ) : formData.imageUrl ? (
                        <>
                          <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-xl backdrop-blur-sm">Ganti Foto</span>
                          </div>
                        </>
                      ) : (
                        <div className="p-4">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-indigo-600 mx-auto mb-2">
                            <UploadCloud size={20} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 block">Pilih Foto Produk</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">JPG, PNG, WEBP (Max 10MB)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Barcode / SKU</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <ScanBarcode size={16} className="absolute left-3.5 top-3 text-slate-400" />
                        <input 
                          type="text" 
                          name="barcode"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white" 
                          placeholder="Scan / ketik barcode..."
                          value={formData.barcode}
                          onChange={handleChange}
                        />
                      </div>
                      <button 
                        type="button" 
                        className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                        onClick={generateBarcode}
                        title="Generate Barcode Otomatis"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Kategori Utama <span className="text-rose-500">*</span>
                      </label>
                      {onManageCategories && (
                        <button
                          type="button"
                          onClick={onManageCategories}
                          className="text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                          + Kelola Kategori
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Tag size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <select 
                        name="categoryId"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white" 
                        value={formData.categoryId}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Pilih Kategori...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sub-Kategori Dropdown */}
                  {(() => {
                    const selectedCat = categories.find(c => String(c.id) === String(formData.categoryId));
                    const subCats = selectedCat?.subCategories || [];
                    if (subCats.length === 0) return null;
                    return (
                      <div className="animate-fade-in">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Sub-Kategori <span className="text-[10px] font-normal text-slate-400">(Opsional)</span>
                        </label>
                        <div className="relative">
                          <Layers size={16} className="absolute left-3.5 top-3 text-slate-400" />
                          <select 
                            name="subCategoryId"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white" 
                            value={formData.subCategoryId}
                            onChange={handleChange}
                          >
                            <option value="">-- Tanpa Sub-Kategori --</option>
                            {subCats.map((sc: any) => (
                              <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Kolom Kanan: Nama, Harga & Stok */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Produk / Menu <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      name="name"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white" 
                      placeholder="Contoh: Ramen Kuah Paitan Spesial"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Harga Modal (HPP) {isAdvancedMode && recipeItems.length > 0 && <span className="text-indigo-600 text-[10px]">(Auto-Resep)</span>}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                        <input 
                          type="number" 
                          name="buyPrice"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                          placeholder="0"
                          value={formData.buyPrice}
                          onChange={handleChange}
                          readOnly={isAdvancedMode && recipeItems.length > 0}
                          style={{ backgroundColor: (isAdvancedMode && recipeItems.length > 0) ? '#f1f5f9' : 'white' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
                        Harga Jual Kasir <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-indigo-600 font-bold text-xs">Rp</span>
                        <input 
                          type="number" 
                          name="sellPrice"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" 
                          placeholder="0"
                          value={formData.sellPrice}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Stok Awal di Toko</label>
                      <div className="relative">
                        <Layers size={16} className="absolute left-3.5 top-3 text-slate-400" />
                        <input 
                          type="number" 
                          name="stock"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white" 
                          placeholder="0"
                          value={formData.stock}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Batas Minimum Stok (Alert)</label>
                      <div className="relative">
                        <AlertTriangle size={16} className="absolute left-3.5 top-3 text-amber-500" />
                        <input 
                          type="number" 
                          name="minStock"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white" 
                          placeholder="1"
                          value={formData.minStock}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status Produk</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="radio" 
                          name="status" 
                          value="Aktif" 
                          checked={formData.status === 'Aktif'}
                          onChange={handleChange}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          ✓ Aktif (Tampil di POS)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="radio" 
                          name="status" 
                          value="Tidak Aktif" 
                          checked={formData.status === 'Tidak Aktif'}
                          onChange={handleChange}
                          className="w-4 h-4 text-slate-400 focus:ring-slate-400"
                        />
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          ✕ Tidak Aktif (Disembunyikan)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* RECIPE TAB CONTENT */
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
                  <Info size={18} className="text-amber-700 mt-0.5 shrink-0" />
                  <div className="text-amber-900 text-xs leading-relaxed">
                    <p className="font-black mb-0.5">Kalkulasi Otomatis HPP Berdasarkan Resep Bahan Baku</p>
                    <p className="font-medium text-amber-800">
                      Harga modal (HPP) menu ini akan dihitung otomatis dari total bahan baku di bawah. Setiap kali menu ini terjual di kasir, stok bahan baku akan langsung terpotong secara otomatis.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div className="font-bold text-xs text-slate-700 uppercase tracking-wider">Tambah Bahan ke Resep</div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="flex-1">
                      <select 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500" 
                        value={newRecipe.ingredientId} 
                        onChange={e => setNewRecipe(p => ({ ...p, ingredientId: e.target.value }))}
                      >
                        <option value="">-- Pilih Bahan Baku --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stok: {ing.stock} {ing.unit} | Rp {ing.buyPrice.toLocaleString('id-ID')}/{ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-36">
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Qty / porsi" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        value={newRecipe.qty}
                        onChange={e => setNewRecipe(p => ({ ...p, qty: e.target.value }))}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleAddRecipeItem}
                      disabled={!newRecipe.ingredientId || !newRecipe.qty}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus size={15} /> Tambah
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="p-3">Nama Bahan</th>
                          <th className="p-3">Takaran / Porsi</th>
                          <th className="p-3">Harga Beli</th>
                          <th className="p-3">Subtotal HPP</th>
                          <th className="p-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recipeItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                              Belum ada bahan baku ditambahkan pada resep ini.
                            </td>
                          </tr>
                        ) : (
                          recipeItems.map(item => (
                            <tr key={item.ingredientId} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{item.ingredientName}</td>
                              <td className="p-3 font-bold text-indigo-600">
                                {item.qtyPerServing} <span className="text-slate-400 font-medium text-[11px]">{item.unit}</span>
                              </td>
                              <td className="p-3 text-slate-600">Rp {item.buyPrice.toLocaleString('id-ID')}</td>
                              <td className="p-3 font-black text-slate-900">
                                Rp {(item.qtyPerServing * item.buyPrice).toLocaleString('id-ID')}
                              </td>
                              <td className="p-3 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveRecipeItem(item.ingredientId)}
                                  className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center hover:bg-rose-100 transition-colors mx-auto"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {recipeItems.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-50 font-black border-t border-slate-200">
                            <td colSpan={3} className="p-3 text-right text-slate-600 uppercase text-[11px]">Total HPP Menu:</td>
                            <td colSpan={2} className="p-3 text-indigo-700 text-sm">
                              Rp {recipeItems.reduce((s, i) => s + (i.qtyPerServing * i.buyPrice), 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions */}
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
              className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              {initialData ? 'Simpan Perubahan' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
