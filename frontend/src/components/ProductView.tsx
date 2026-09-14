import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  Package, Plus, Search, RotateCcw, Edit, Copy, Trash2, 
  AlertTriangle, CheckCircle, XCircle, Wallet, Grid, List, Layers, Tag 
} from 'lucide-react';
import ProductModal from './ProductModal';
import { CategoryModal } from './CategoryModal';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

const ProductView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterStock, setFilterStock] = useState('Semua');

  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchProducts();
      fetchCategories();
      setLoading(false);
    }
  }, [posContext?.token]);

  const openAddModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const result = await confirmAlert('Hapus Produk?', 'Apakah Anda yakin ingin menghapus produk ini?');
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        fetchProducts();
        toast('Produk berhasil dihapus', 'success');
      } else {
        toast('Gagal menghapus produk', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan server', 'error');
    }
  };

  const handleSave = async (data: any) => {
    const isEdit = !!selectedProduct;
    const url = isEdit 
      ? `/api/products/${selectedProduct.id}`
      : '/api/products';
    
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchProducts();
        toast('Produk berhasil disimpan!', 'success');
      } else {
        const err = await res.json();
        toast(`Error: ${err.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan saat menyimpan produk', 'error');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterSubCategory('');
    setFilterStock('Semua');
  };

  // Get active subcategories based on selected category filter
  const activeSubCategories = useMemo(() => {
    if (!filterCategory) return [];
    const cat = categories.find(c => String(c.id) === String(filterCategory));
    return cat?.subCategories || [];
  }, [filterCategory, categories]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchBarcode = p.barcode?.toLowerCase().includes(q);
        if (!matchName && !matchBarcode) return false;
      }

      // Category filter
      if (filterCategory && String(p.categoryId) !== String(filterCategory)) {
        return false;
      }

      // Sub-category filter
      if (filterSubCategory && String(p.subCategoryId) !== String(filterSubCategory)) {
        return false;
      }

      // Stock filter
      if (filterStock === 'Stok Aman' && p.stock <= p.minStock) return false;
      if (filterStock === 'Stok Menipis' && (p.stock <= 0 || p.stock > p.minStock)) return false;
      if (filterStock === 'Habis' && p.stock > 0) return false;

      return true;
    });
  }, [products, searchQuery, filterCategory, filterSubCategory, filterStock]);

  const totalValue = products.reduce((sum, p) => sum + (p.buyPrice * p.stock), 0);
  const outOfStockCount = products.filter(p => p.stock <= 0 || p.isSoldOut).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.minStock && !p.isSoldOut).length;
  const activeCount = products.filter(p => p.status === 'Aktif').length;

  return (
    <div 
      className="p-3 sm:p-6 pb-52 sm:pb-20 flex-1 min-h-0 h-full w-full flex flex-col bg-slate-50 overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      
      {/* HEADER SECTION */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <Package className="text-primary" /> Manajemen Produk
          </h2>
          <p className="text-muted text-xs mt-1">Kelola katalog produk, harga jual, stok, dan klasifikasi kategori</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="btn bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-sm flex items-center gap-2 font-semibold text-xs py-2 px-3.5 rounded-xl transition-all"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <Layers size={16} className="text-indigo-600" /> Kelola Kategori
          </button>
          <button 
            className="btn btn-primary shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-xs py-2 px-4 rounded-xl transition-all" 
            onClick={openAddModal}
          >
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6 shrink-0">
        <div className="card flex items-center justify-between p-4 border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl">
          <div>
            <div className="text-2xl font-bold text-slate-800">{products.length}</div>
            <div className="text-xs font-semibold text-slate-500">Total Produk</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
            <Package size={20} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-rose-500 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl">
          <div>
            <div className="text-2xl font-bold text-rose-600">{outOfStockCount}</div>
            <div className="text-xs font-semibold text-slate-500">Stok Habis (0)</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
            <XCircle size={20} />
          </div>
        </div>
        
        <div className="card flex items-center justify-between p-4 border-l-4 border-amber-500 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl">
          <div>
            <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>
            <div className="text-xs font-semibold text-slate-500">Stok Menipis</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-emerald-500 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl">
          <div>
            <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
            <div className="text-xs font-semibold text-slate-500">Produk Aktif</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl">
          <div>
            <div className="text-xl font-bold text-indigo-700">{formatCurrency(totalValue)}</div>
            <div className="text-xs font-semibold text-slate-500">Nilai Stok (HPP)</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* FILTER & DATA SECTION */}
      <div className="card flex-1 flex flex-col p-0 overflow-hidden border border-gray-200 shadow-sm bg-white rounded-2xl shrink-0">
        
        {/* FILTER BAR */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-muted" />
              <input 
                type="text" 
                className="form-control !pl-9.5 text-xs py-2 rounded-xl" 
                placeholder="Cari nama produk / barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className="min-w-[160px]">
              <select 
                className="form-control text-xs py-2 rounded-xl"
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setFilterSubCategory('');
                }}
              >
                <option value="">Semua Kategori</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Sub-Category Filter (Shows when category has subcategories) */}
            {activeSubCategories.length > 0 && (
              <div className="min-w-[160px] animate-fade-in">
                <select 
                  className="form-control text-xs py-2 rounded-xl border-indigo-200 bg-indigo-50/40 text-indigo-900"
                  value={filterSubCategory}
                  onChange={(e) => setFilterSubCategory(e.target.value)}
                >
                  <option value="">Semua Sub-Kategori</option>
                  {activeSubCategories.map((sc: any) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Stock Filter */}
            <div className="min-w-[130px]">
              <select 
                className="form-control text-xs py-2 rounded-xl"
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
              >
                <option value="Semua">Semua Stok</option>
                <option value="Stok Aman">Stok Aman</option>
                <option value="Stok Menipis">Stok Menipis</option>
                <option value="Habis">Habis</option>
              </select>
            </div>

            {/* Reset Button */}
            {(searchQuery || filterCategory || filterSubCategory || filterStock !== 'Semua') && (
              <button 
                className="btn bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
                onClick={resetFilters}
                title="Reset Semua Filter"
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              className={`flex items-center justify-center p-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setViewMode('grid')}
              title="Tampilan Grid (Kartu)"
            >
              <Grid size={15} className="mr-1" /> Grid
            </button>
            <button 
              className={`flex items-center justify-center p-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setViewMode('list')}
              title="Tampilan List (Tabel)"
            >
              <List size={15} className="mr-1" /> Tabel
            </button>
          </div>
        </div>

        {/* CONTENT SECTION */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="font-semibold text-xs">Memuat produk...</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-16 text-slate-400 font-medium text-xs">
                  Tidak ada produk yang cocok dengan filter pencarian.
                </div>
              ) : filteredProducts.map((prod) => (
                <div key={prod.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-slate-100 flex flex-col group">
                  <div className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <Package size={36} className="text-slate-300" />
                    )}
                    {prod.stock <= prod.minStock && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        STOK {prod.stock}
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col flex-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 mb-1 truncate">
                      <Tag size={11} className="shrink-0" />
                      <span className="truncate">{prod.category?.name || 'Tanpa Kategori'}</span>
                      {prod.subCategory && (
                        <span className="text-slate-400 font-normal truncate">
                          &gt; {prod.subCategory.name}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-xs leading-tight mb-2 line-clamp-2 flex-1">{prod.name}</h3>
                    <div className="text-sm font-black text-primary mb-2.5">{formatCurrency(prod.sellPrice)}</div>
                    <div className="flex gap-1 mt-auto border-t border-slate-100 pt-2.5">
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors" title="Edit" onClick={() => openEditModal(prod)}><Edit size={13}/></button>
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors" title="Hapus" onClick={() => handleDelete(prod.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-responsive p-0 bg-white">
              <table className="data-table w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">GAMBAR</th>
                    <th className="px-5 py-3.5">BARCODE</th>
                    <th className="px-5 py-3.5">NAMA PRODUK</th>
                    <th className="px-5 py-3.5">KATEGORI & SUB-KATEGORI</th>
                    <th className="px-5 py-3.5">HARGA</th>
                    <th className="px-5 py-3.5">STOK</th>
                    <th className="px-5 py-3.5">STATUS</th>
                    <th className="px-5 py-3.5 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-slate-400 font-medium">
                        Tidak ada produk yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : filteredProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} className="text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{prod.barcode || '-'}</td>
                      <td className="px-5 py-2.5">
                        <div className="font-bold text-slate-800 text-sm">{prod.name}</div>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                            {prod.category?.name || '-'}
                          </span>
                          {prod.subCategory && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                              &gt; {prod.subCategory.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="text-[11px] text-muted font-medium">Beli: {formatCurrency(prod.buyPrice)}</div>
                        <div className="text-xs font-black text-primary mt-0.5">Jual: {formatCurrency(prod.sellPrice)}</div>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className={`font-black text-sm ${prod.stock <= prod.minStock ? 'text-red-500' : 'text-emerald-600'}`}>
                          {prod.stock} <span className="text-[10px] font-semibold">pcs</span>
                        </div>
                        <div className="text-[10px] text-muted font-medium mt-0.5">Min: {prod.minStock}</div>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prod.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {prod.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors" title="Edit" onClick={() => openEditModal(prod)}><Edit size={14}/></button>
                          <button className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors" title="Hapus" onClick={() => handleDelete(prod.id)}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* FOOTER BAR */}
        <div className="p-3.5 border-t border-gray-200 bg-white text-xs font-semibold text-slate-500 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <Package size={14} className="text-slate-400" />
            <span>Menampilkan {filteredProducts.length} dari {products.length} produk</span>
          </span>
          <span>{posContext?.settings?.storeName || 'SOL Cafe'} Inventory</span>
        </div>
      </div>

      {/* PRODUCT MODAL */}
      <ProductModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedProduct}
        categories={categories}
        onSave={handleSave}
        onManageCategories={() => setIsCategoryModalOpen(true)}
      />

      {/* CATEGORY MANAGEMENT MODAL */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesUpdated={() => {
          fetchCategories();
          fetchProducts();
        }}
      />
    </div>
  );
};

export default ProductView;

