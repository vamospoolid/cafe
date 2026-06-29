import React, { useState, useEffect, useContext } from 'react';
import { Package, Plus, Search, RotateCcw, Edit, Copy, Trash2, AlertTriangle, CheckCircle, Wallet, Grid, List } from 'lucide-react';
import ProductModal from './ProductModal';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

const ProductView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

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

  const totalValue = products.reduce((sum, p) => sum + (p.buyPrice * p.stock), 0);
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const activeCount = products.filter(p => p.status === 'Aktif').length;

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="text-primary" /> Manajemen Produk
          </h2>
          <p className="text-muted mt-1">Kelola semua produk yang dijual di toko Anda</p>
        </div>
        <button className="btn btn-primary shadow-md hover:shadow-lg transition-all" onClick={openAddModal}>
          <Plus size={18} /> Tambah Produk
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center justify-between p-4 border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow bg-white">
          <div>
            <div className="text-2xl font-bold">{products.length}</div>
            <div className="text-sm font-semibold text-slate-500">Total Produk</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
            <Package size={24} />
          </div>
        </div>
        
        <div className="card flex items-center justify-between p-4 border-l-4 border-amber-500 shadow-sm hover:shadow-md transition-shadow bg-white">
          <div>
            <div className="text-2xl font-bold">{lowStockCount}</div>
            <div className="text-sm font-semibold text-slate-500">Stok Menipis</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-success shadow-sm hover:shadow-md transition-shadow bg-white">
          <div>
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-sm font-semibold text-slate-500">Produk Aktif</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-success">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow bg-white">
          <div>
            <div className="text-2xl font-bold text-indigo-700">{formatCurrency(totalValue)}</div>
            <div className="text-sm font-semibold text-slate-500">Nilai Stok (HPP)</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden border border-gray-200 shadow-sm">
        {/* Filter Section */}
        <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="relative md:col-span-3">
            <Search size={16} className="absolute left-3 top-3.5 text-muted" />
            <input type="text" className="form-control !pl-9" placeholder="Cari produk..." />
          </div>
          <select className="form-control md:col-span-2">
            <option>Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-control md:col-span-2">
            <option>Semua Stok</option>
            <option>Stok Aman</option>
            <option>Stok Menipis</option>
            <option>Habis</option>
          </select>
          <div className="flex gap-2 md:col-span-5 justify-end">
            <button className="btn bg-gray-50 border border-gray-300 text-gray-700 flex justify-center items-center gap-2 hover:bg-gray-100">
              <RotateCcw size={16} /> Reset
            </button>
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 ml-2">
              <button 
                className={`flex items-center justify-center p-2 px-3 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setViewMode('grid')}
                title="Tampilan Grid (Kartu)"
              >
                <Grid size={18} />
              </button>
              <button 
                className={`flex items-center justify-center p-2 px-3 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setViewMode('list')}
                title="Tampilan List (Tabel)"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="font-semibold">Memuat produk...</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {products.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400 font-medium">Belum ada produk. Tambahkan produk baru.</div>
              ) : products.map((prod) => (
                <div key={prod.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col group">
                  <div className="relative aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <Package size={40} className="text-gray-300" />
                    )}
                    {prod.stock <= prod.minStock && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse">
                        STOK {prod.stock}
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs font-bold text-indigo-500 mb-1">{prod.category?.name || 'Tanpa Kategori'}</div>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight mb-2 flex-1">{prod.name}</h3>
                    <div className="text-lg font-black text-primary mb-3">{formatCurrency(prod.sellPrice)}</div>
                    <div className="flex gap-1 mt-auto border-t border-gray-100 pt-3">
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors" title="Edit" onClick={() => openEditModal(prod)}><Edit size={14}/></button>
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors" title="Duplikasi"><Copy size={14}/></button>
                      <button className="flex-1 py-1.5 flex justify-center items-center rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors" title="Hapus" onClick={() => handleDelete(prod.id)}><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-responsive p-0 bg-white">
              <table className="data-table w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="px-6 py-4">GAMBAR</th>
                    <th className="px-6 py-4">BARCODE</th>
                    <th className="px-6 py-4">NAMA PRODUK</th>
                    <th className="px-6 py-4">KATEGORI</th>
                    <th className="px-6 py-4">HARGA</th>
                    <th className="px-6 py-4">STOK</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 font-medium">Belum ada produk. Tambahkan produk baru.</td>
                    </tr>
                  ) : products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={20} className="text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-500">{prod.barcode || '-'}</td>
                      <td className="px-6 py-3">
                        <div className="font-bold text-gray-800 text-base">{prod.name}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                          {prod.category?.name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-xs text-muted font-medium">Beli: {formatCurrency(prod.buyPrice)}</div>
                        <div className="text-sm font-black text-primary mt-0.5">Jual: {formatCurrency(prod.sellPrice)}</div>
                      </td>
                      <td className="px-6 py-3">
                        <div className={`font-black text-lg ${prod.stock <= prod.minStock ? 'text-red-500' : 'text-emerald-600'}`}>{prod.stock} <span className="text-xs font-bold">pcs</span></div>
                        <div className="text-xs text-muted font-medium mt-0.5">Min: {prod.minStock}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`badge ${prod.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                          {prod.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors" title="Edit" onClick={() => openEditModal(prod)}><Edit size={16}/></button>
                          <button className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors" title="Duplikasi"><Copy size={16}/></button>
                          <button className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors" title="Hapus" onClick={() => handleDelete(prod.id)}><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-white text-xs font-semibold text-gray-400 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <Package size={14} className="text-gray-400" />
            <span>Menampilkan total {products.length} produk di sistem.</span>
          </span>
          <span>{posContext?.settings?.storeName || 'SOL Cafe'} Inventory System</span>
        </div>
      </div>

      <ProductModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedProduct}
        categories={categories}
        onSave={handleSave}
      />
    </div>
  );
};

export default ProductView;
