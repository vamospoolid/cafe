import React, { useState, useEffect, useContext } from 'react';
import { X, Image as ImageIcon, RefreshCw, ScanBarcode, Package, Tag, Layers, Beaker, Plus, Trash2, Info } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (product: any) => void;
  initialData?: any;
  categories: any[];
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, initialData, categories }) => {
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
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

  // Load initial recipe if editing
  useEffect(() => {
    if (isOpen && initialData && initialData.id && isAdvancedMode && posContext?.token) {
      fetch(`/api/recipes/product/${initialData.id}`, {
        headers: { Authorization: `Bearer ${posContext.token}` }
      })
      .then(r => r.json())
      .then(data => {
        // Format for state
        const mapped = (data.recipes || []).map((d: any) => ({
          ingredientId: d.ingredientId,
          qtyPerServing: d.qtyPerServing,
          ingredientName: d.ingredient?.name,
          unit: d.ingredient?.unit,
          buyPrice: d.ingredient?.buyPrice
        }));
        setRecipeItems(mapped);
      })
      .catch(e => console.error(e));
    } else {
      setRecipeItems([]);
    }
  }, [isOpen, initialData, isAdvancedMode, posContext?.token]);


  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        categoryId: initialData.categoryId || '',
        barcode: initialData.barcode || '',
        buyPrice: initialData.buyPrice || '',
        sellPrice: initialData.sellPrice || '',
        stock: initialData.stock || '',
        minStock: initialData.minStock || '1',
        status: initialData.status || 'Aktif',
        imageUrl: initialData.imageUrl || ''
      });
    } else {
      setFormData({
        name: '',
        categoryId: '',
        barcode: '',
        buyPrice: '',
        sellPrice: '',
        stock: '',
        minStock: '1',
        status: 'Aktif',
        imageUrl: ''
      });
    }
    setActiveTab('info');
    setNewRecipe({ ingredientId: '', qty: '' });
  }, [initialData, isOpen]);

  // Auto-calculate HPP based on recipe items if advanced mode
  useEffect(() => {
    if (isAdvancedMode && recipeItems.length > 0) {
      const totalHPP = recipeItems.reduce((sum, item) => sum + (item.qtyPerServing * item.buyPrice), 0);
      setFormData(prev => ({ ...prev, buyPrice: String(totalHPP) }));
    }
  }, [recipeItems, isAdvancedMode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateBarcode = () => {
    const randomBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: randomBarcode }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      // Return form data and recipe items if advanced mode
      onSave({ 
        ...formData, 
        recipeItems: isAdvancedMode ? recipeItems : [] 
      });
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

    // Check duplicate
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px' }}>
        <div className="modal-header bg-gray-50 border-b border-gray-200">
          <h2 className="modal-title flex items-center gap-2">
            <Package className="text-primary" /> 
            {initialData ? 'Edit Data Produk' : 'Tambah Produk Baru'}
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tabs for Advanced Mode */}
        {isAdvancedMode && (
          <div className="flex px-6 pt-4 border-b border-gray-200 bg-white gap-4">
            <button 
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Informasi Umum
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('recipe')}
              className={`pb-3 px-2 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'recipe' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Beaker size={16} /> Resep & Komposisi
            </button>
          </div>
        )}
        
        <form onSubmit={handleSave} className="flex flex-col h-full">
          <div className="modal-body" style={{ display: activeTab === 'info' ? 'block' : 'none' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              <div className="md:col-span-1 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Foto Produk</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 h-48 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-secondary transition-colors relative overflow-hidden group">
                    {formData.imageUrl ? (
                      <>
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white text-sm font-semibold">Ubah Foto</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={32} className="text-gray-400 mb-2" />
                        <span className="text-sm font-semibold text-gray-600">Pilih Foto</span>
                        <span className="text-xs text-muted mt-1">JPG, PNG (Max 2MB)</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="url" 
                    name="imageUrl"
                    className="form-control text-xs mt-2" 
                    placeholder="Atau tempel URL gambar disini..."
                    value={formData.imageUrl}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Barcode Produk</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanBarcode size={18} className="absolute left-3.5 top-3.5 text-muted" />
                      <input 
                        type="text" 
                        name="barcode"
                        className="form-control !pl-10" 
                        placeholder="Scan atau ketik..."
                        value={formData.barcode}
                        onChange={handleChange}
                      />
                    </div>
                    <button 
                      type="button" 
                      className="btn bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 p-2 px-3"
                      onClick={generateBarcode}
                      title="Generate Barcode Otomatis"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori Utama <span className="text-danger">*</span></label>
                  <div className="relative">
                    <Tag size={18} className="absolute left-3.5 top-3.5 text-muted" />
                    <select 
                      name="categoryId"
                      className="form-control !pl-10 appearance-none" 
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
              </div>

              <div className="md:col-span-2 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nama Produk <span className="text-danger">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name"
                    className="form-control text-lg font-semibold" 
                    placeholder="Contoh: Paket Ayam Geprek Spesial"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Harga Modal (HPP) {isAdvancedMode && recipeItems.length > 0 && <span className="text-primary text-xs">(Auto-Kalkulasi)</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3.5 text-muted font-bold text-sm">Rp</span>
                      <input 
                        type="number" 
                        name="buyPrice"
                        className="form-control !pl-10" 
                        placeholder="0"
                        value={formData.buyPrice}
                        onChange={handleChange}
                        readOnly={isAdvancedMode && recipeItems.length > 0}
                        style={{ backgroundColor: (isAdvancedMode && recipeItems.length > 0) ? '#f8fafc' : 'white', cursor: (isAdvancedMode && recipeItems.length > 0) ? 'not-allowed' : 'text' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Harga Jual <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3.5 text-primary font-bold text-sm">Rp</span>
                      <input 
                        type="number" 
                        name="sellPrice"
                        className="form-control !pl-10 border-primary shadow-sm" 
                        placeholder="0"
                        value={formData.sellPrice}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Stok Awal</label>
                    <div className="relative">
                      <Layers size={18} className="absolute left-3.5 top-3.5 text-muted" />
                      <input 
                        type="number" 
                        name="stock"
                        className="form-control !pl-10" 
                        placeholder="0"
                        value={formData.stock}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Peringatan Stok Minimum</label>
                    <div className="relative">
                      <AlertTriangleIcon size={18} className="absolute left-3.5 top-3.5 text-amber-500" />
                      <input 
                        type="number" 
                        name="minStock"
                        className="form-control !pl-10" 
                        placeholder="1"
                        value={formData.minStock}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status Produk</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="status" 
                        value="Aktif" 
                        checked={formData.status === 'Aktif'}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm font-medium">Aktif (Ditampilkan)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="status" 
                        value="Tidak Aktif" 
                        checked={formData.status === 'Tidak Aktif'}
                        onChange={handleChange}
                        className="w-4 h-4 text-gray-400"
                      />
                      <span className="text-sm font-medium text-muted">Tidak Aktif (Disembunyikan)</span>
                    </label>
                  </div>
                </div>
                
              </div>
            </div>
          </div>

          {/* RECIPE TAB CONTENT */}
          <div className="modal-body" style={{ display: activeTab === 'recipe' ? 'block' : 'none' }}>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start mb-6">
              <Info size={18} className="text-amber-700 mt-0.5" />
              <div className="text-amber-800 text-sm leading-relaxed">
                <p className="font-bold mb-1">Fitur Advanced Mode Aktif</p>
                <p>Harga Pokok Penjualan (HPP) produk ini akan dikalkulasi otomatis berdasarkan harga beli bahan baku yang Anda susun di resep ini. Saat produk ini terjual, stok bahan baku akan berkurang secara proporsional sesuai kuantitas resep.</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4">
                <div className="flex-1">
                  <select 
                    className="form-control" 
                    value={newRecipe.ingredientId} 
                    onChange={e => setNewRecipe(p => ({ ...p, ingredientId: e.target.value }))}
                  >
                    <option value="">-- Pilih Bahan Baku --</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name} (Stok: {ing.stock} {ing.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <input 
                    type="number" 
                    placeholder="Qty per porsi" 
                    className="form-control"
                    value={newRecipe.qty}
                    onChange={e => setNewRecipe(p => ({ ...p, qty: e.target.value }))}
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleAddRecipeItem}
                  disabled={!newRecipe.ingredientId || !newRecipe.qty}
                  className="btn btn-primary disabled:opacity-50"
                >
                  <Plus size={18} /> Tambah
                </button>
              </div>
              
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="p-4">Nama Bahan</th>
                    <th className="p-4">Kuantitas per Porsi</th>
                    <th className="p-4">Harga Beli Satuan</th>
                    <th className="p-4">Subtotal HPP</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {recipeItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 font-medium">Belum ada bahan baku ditambahkan.</td>
                    </tr>
                  ) : (
                    recipeItems.map(item => (
                      <tr key={item.ingredientId} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="p-4 font-semibold text-gray-800">{item.ingredientName}</td>
                        <td className="p-4 text-primary font-bold">{item.qtyPerServing} <span className="text-gray-500 font-medium text-xs">{item.unit}</span></td>
                        <td className="p-4 text-gray-600">Rp {item.buyPrice.toLocaleString('id-ID')}</td>
                        <td className="p-4 font-bold text-gray-800">Rp {(item.qtyPerServing * item.buyPrice).toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveRecipeItem(item.ingredientId)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {recipeItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                      <td colSpan={3} className="p-4 text-right text-gray-600">TOTAL HPP PRODUK:</td>
                      <td colSpan={2} className="p-4 text-primary text-lg">
                        Rp {recipeItems.reduce((s, i) => s + (i.qtyPerServing * i.buyPrice), 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="modal-footer flex justify-between bg-gray-50 border-t border-gray-200">
            <button type="button" className="btn bg-white border border-gray-300 text-gray-700" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary min-w-[150px] justify-center">
              {initialData ? 'Simpan Perubahan' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AlertTriangleIcon = ({size, className}: {size: number, className?: string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
);

export default ProductModal;
