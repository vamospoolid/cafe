import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Plus, Search, RotateCcw, Edit, Copy, Trash2, 
  AlertTriangle, CheckCircle, XCircle, Wallet, Grid, List, Layers, Tag, Sparkles, Barcode,
  Camera, X, ShoppingCart, ClipboardList, LayoutList
} from 'lucide-react';
import ProductModal from './ProductModal';
import { CategoryModal } from './CategoryModal';
import RecycleBinModal from './RecycleBinModal';
import { ProductImage } from './ProductImage';
import { AiMenuOptimizerModal } from './AiMenuOptimizerModal';
import { BarcodeLabelPrintModal } from './BarcodeLabelPrintModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import { PartRequestModal } from '../verticals/bengkel/PartRequestModal';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import { toast, confirmAlert } from '../utils/alert';
import { initHardwareBarcodeListener, playScannerBeep } from '../utils/hardwareBarcodeListener';

const ProductView = () => {
  const navigate = useNavigate();
  const { isBengkel, isRetail } = useVertical();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [isBarcodePrintOpen, setIsBarcodePrintOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPartRequestModalOpen, setIsPartRequestModalOpen] = useState(false);
  const [barcodeTargetProducts, setBarcodeTargetProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'compact' | 'list' | 'grid'>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'compact' : 'list';
  });
  
  // Search Bar Ref for Auto-Focus & Shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterStock, setFilterStock] = useState('Semua');

  const posContext = useContext(POSContext);
  const showTieredPricing = isBengkel || isRetail || Boolean(posContext?.settings?.enableTieredPricing);

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
      const res = await fetch('/api/categories?includeInactive=true', {
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

  // Auto-focus barcode/search input by default on mount and after data loads
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [products.length]);

  // Global F2 & '/' keyboard shortcut to quickly jump focus to Barcode Scanner input anytime
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // Global Hardware Barcode Scanner Listener (Instant scan & filter)
  useEffect(() => {
    const unbind = initHardwareBarcodeListener({
      onScan: (scannedCode) => {
        const clean = scannedCode.trim();
        setSearchQuery(clean);
        searchInputRef.current?.focus();

        const match = products.find(p => 
          (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase() === clean.toLowerCase()) ||
          String(p.id) === clean
        );

        if (match) {
          playScannerBeep(true);
          toast(`⚡ [Barcode Scan] Ditemukan: ${match.name}`, 'success');
        } else {
          playScannerBeep(false);
          toast(`🔍 Memfilter kode barcode: ${clean}`, 'info');
        }
      }
    });
    return () => unbind();
  }, [products]);

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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchProducts();
        toast(data.message || 'Produk berhasil dihapus', 'success');
      } else {
        toast(data.error || 'Gagal menghapus produk', 'error');
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
    searchInputRef.current?.focus();
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
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-5">
      
      {/* HEADER ACTION TOOLBAR */}
      <div className="flex flex-col gap-3 shrink-0 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Top Row: Title & Primary CTA */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shadow-sm border border-purple-200 shrink-0">
              <Package size={20} className="text-purple-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black text-slate-800 tracking-tight truncate">
                  {isBengkel ? 'Data Sparepart & Barang' : isRetail ? 'Katalog Produk Retail' : 'Manajemen Produk'}
                </h2>
                {isBengkel && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase shrink-0">
                    Bengkel
                  </span>
                )}
                {isRetail && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase shrink-0">
                    Retail
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[11px] sm:text-xs truncate">
                {isBengkel 
                  ? 'Katalog sparepart, multi-tier & stok gudang' 
                  : 'Kelola harga jual, stok & klasifikasi kategori'}
              </p>
            </div>
          </div>

          {/* Primary CTA Button (Single Plus, Vibrant Gradient) */}
          <button 
            className="btn bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-sm hover:shadow flex items-center justify-center gap-1.5 font-bold text-xs h-9 sm:h-10 px-3 sm:px-4 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0" 
            onClick={openAddModal}
          >
            <Plus size={16} />
            <span className="hidden xs:inline">{isBengkel ? 'Tambah Sparepart' : 'Tambah Produk'}</span>
            <span className="xs:hidden">Tambah</span>
          </button>
        </div>

        {/* Secondary Action Tools: Smooth Horizontal Scroll Pills on Mobile, Flex on Desktop */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 w-full border-t border-slate-100 pt-2.5">
          {isBengkel ? (
            <>
              <button 
                className="shrink-0 btn bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => navigate('/bengkel/pengadaan')}
                title="Buka Lembar Rencana Belanja Grosir / PO Supplier"
              >
                <ShoppingCart size={14} className="text-amber-600" />
                <span className="whitespace-nowrap">Rencana Belanja (PO)</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsPartRequestModalOpen(true)}
                title="Catat suku cadang yang dicari konsumen / belum ada di stok (Defecta)"
              >
                <ClipboardList size={14} className="text-indigo-600" />
                <span className="whitespace-nowrap">Barang Kosong</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => {
                  setBarcodeTargetProducts(filteredProducts.length > 0 ? filteredProducts : products);
                  setIsBarcodePrintOpen(true);
                }}
                title="Cetak stiker label barcode thermal"
              >
                <Barcode size={14} className="text-purple-600" />
                <span className="whitespace-nowrap">Cetak Barcode</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsCategoryModalOpen(true)}
              >
                <Layers size={14} className="text-indigo-600" />
                <span className="whitespace-nowrap">Kategori</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsRecycleBinOpen(true)}
              >
                <Trash2 size={14} className="text-amber-600" />
                <span className="whitespace-nowrap">Sampah</span>
              </button>
            </>
          ) : (
            <>
              <button 
                className="shrink-0 btn bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-indigo-700 border border-indigo-200/80 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsAiAdvisorOpen(true)}
              >
                <Sparkles size={14} className="text-amber-500 animate-pulse" />
                <span className="whitespace-nowrap">AI Profit Advisor</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => {
                  setBarcodeTargetProducts(filteredProducts.length > 0 ? filteredProducts : products);
                  setIsBarcodePrintOpen(true);
                }}
                title="Cetak stiker label barcode thermal (1, 2, atau 3 kolom)"
              >
                <Barcode size={14} className="text-purple-600" />
                <span className="whitespace-nowrap">Cetak Barcode</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsCategoryModalOpen(true)}
              >
                <Layers size={14} className="text-indigo-600" />
                <span className="whitespace-nowrap">Kategori</span>
              </button>
              <button 
                className="shrink-0 btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 font-bold text-xs h-8 px-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                onClick={() => setIsRecycleBinOpen(true)}
              >
                <Trash2 size={14} className="text-amber-600" />
                <span className="whitespace-nowrap">Sampah</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* SUMMARY STAT CARDS (Sempurna & Simetris di Mobile & Desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center justify-between p-2.5 sm:p-3.5 border-l-4 border-purple-600 shadow-xs hover:shadow-md transition-shadow bg-white rounded-xl border border-slate-200/80">
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800">{products.length}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500">
              {isBengkel ? 'Total Sparepart' : 'Total Produk'}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 shrink-0">
            <Package size={17} />
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 sm:p-3.5 border-l-4 border-emerald-500 shadow-xs hover:shadow-md transition-shadow bg-white rounded-xl border border-slate-200/80">
          <div>
            <div className="text-base sm:text-2xl font-black text-emerald-600">{activeCount}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500">
              {isBengkel ? 'Barang Aktif' : 'Produk Aktif'}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle size={17} />
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 sm:p-3.5 border-l-4 border-amber-500 shadow-xs hover:shadow-md transition-shadow bg-white rounded-xl border border-slate-200/80">
          <div>
            <div className="text-base sm:text-2xl font-black text-amber-600">{lowStockCount}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500">Stok Menipis</div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
            <AlertTriangle size={17} />
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 sm:p-3.5 border-l-4 border-rose-500 shadow-xs hover:shadow-md transition-shadow bg-white rounded-xl border border-slate-200/80">
          <div>
            <div className="text-base sm:text-2xl font-black text-rose-600">{outOfStockCount}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500">Stok Habis</div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
            <XCircle size={17} />
          </div>
        </div>

        {/* Total Valuasi Aset: Spans 2 cols on mobile, 1 col on desktop */}
        <div 
          className="col-span-2 sm:col-span-1 lg:col-span-1 flex items-center justify-between p-2.5 sm:p-3.5 border-l-4 border-indigo-500 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-r from-indigo-50/40 via-white to-white sm:bg-white rounded-xl border border-slate-200/80"
          title={isBengkel ? 'Total nilai modal beli dari seluruh sparepart yang tersimpan di bengkel' : 'Total estimasi modal stok berdasarkan harga beli'}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Wallet size={17} />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-semibold text-slate-500">
                {isBengkel ? 'Total Valuasi Aset' : isRetail ? 'Total Valuasi Aset' : 'Nilai Stok (HPP)'}
              </div>
              <div className="text-sm sm:text-lg font-black text-indigo-700 truncate">
                {formatCurrency(totalValue)}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 sm:hidden shrink-0">
            Nilai HPP
          </span>
        </div>
      </div>

      {/* FILTER & DATA SECTION */}
      <div className="card flex-1 flex flex-col p-0 border border-gray-200 shadow-sm bg-white rounded-2xl shrink-0">
        
        {/* FILTER BAR - TEGAS DENGAN AUTO-FOCUS SEPERTI POS */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex flex-col gap-2.5">
          {/* Row 1: Search Bar & Camera Button */}
          <div className="flex items-center gap-2 w-full">
            {/* Search Input Box Tegas (Auto-Focus & Scanner Ready) */}
            <div 
              onClick={() => searchInputRef.current?.focus()}
              className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-2 transition-all shadow-inner cursor-text ${
                isBengkel 
                  ? 'bg-purple-50/50 border-2 border-purple-300 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100 focus-within:bg-white' 
                  : 'bg-indigo-50/40 border-2 border-indigo-200 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:bg-white'
              }`}
            >
              <Search size={16} className={`${isBengkel ? 'text-purple-600' : 'text-indigo-600'} shrink-0`} />
              <input 
                ref={searchInputRef}
                type="text" 
                autoFocus
                className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-900 w-full placeholder:text-slate-400 placeholder:font-normal" 
                placeholder={isBengkel ? "⚡ Scan barcode atau ketik sparepart..." : "⚡ Scan barcode atau ketik nama produk..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500 text-white shadow-xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                SCANNER SIAP
              </span>
              <span className="hidden md:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 shrink-0" title="Tekan F2 atau / untuk fokus ke pencarian">
                F2
              </span>
              {searchQuery && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200/50 transition shrink-0"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Kamera Barcode Scan Button */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="h-10 px-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              title="Scan Barcode via Kamera Ponsel / Webcam"
            >
              <Camera size={16} />
              <span className="hidden sm:inline">Kamera</span>
            </button>
          </div>

          {/* Row 2: Category Filter, Stock Filter, Subcategory & View Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-1 min-w-0">
              {/* Category Filter */}
              <div className="min-w-0">
                <select 
                  className="form-control text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 w-full"
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

              {/* Stock Filter */}
              <div className="min-w-0">
                <select 
                  className="form-control text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 w-full"
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value)}
                >
                  <option value="Semua">Semua Stok</option>
                  <option value="Stok Aman">Stok Aman</option>
                  <option value="Stok Menipis">Stok Menipis</option>
                  <option value="Habis">Habis</option>
                </select>
              </div>

              {/* Sub-Category Filter (Shows when category has subcategories) */}
              {activeSubCategories.length > 0 && (
                <div className="col-span-2 sm:col-span-1 min-w-0 animate-fade-in">
                  <select 
                    className="form-control text-xs py-2 px-2.5 rounded-xl border-indigo-200 bg-indigo-50/40 text-indigo-900 font-semibold w-full"
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

              {/* Reset Button */}
              {(searchQuery || filterCategory || filterSubCategory || filterStock !== 'Semua') && (
                <button 
                  className="col-span-2 sm:col-span-1 btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors font-bold cursor-pointer"
                  onClick={resetFilters}
                  title="Reset Semua Filter"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 gap-0.5 ml-auto sm:ml-0">
              <button 
                type="button"
                className={`flex items-center justify-center py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'compact' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                onClick={() => setViewMode('compact')}
                title="Tampilan Ringkas (Kartu Kompak untuk HP & Layar Sempit)"
              >
                <LayoutList size={13} className="mr-1" /> Ringkas
              </button>
              <button 
                type="button"
                className={`flex items-center justify-center py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                onClick={() => setViewMode('list')}
                title="Tampilan Tabel Lengkap"
              >
                <List size={13} className="mr-1" /> Tabel
              </button>
              <button 
                type="button"
                className={`flex items-center justify-center py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                onClick={() => setViewMode('grid')}
                title="Tampilan Grid Foto Katalog"
              >
                <Grid size={13} className="mr-1" /> Grid
              </button>
            </div>
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
            <div className="p-3 sm:p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-16 text-slate-400 font-medium text-xs">
                  Tidak ada produk yang cocok dengan filter pencarian.
                </div>
              ) : filteredProducts.map((prod) => (
                <div key={prod.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-slate-100 flex flex-col group">
                  <div className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    <ProductImage
                      src={prod.imageUrl}
                      alt={prod.name}
                      categoryName={prod.category?.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {prod.stock <= prod.minStock && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse z-10">
                        STOK {prod.stock}
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 mb-1 truncate">
                      <Tag size={10} className="shrink-0" />
                      <span className="truncate">{prod.category?.name || 'Tanpa Kategori'}</span>
                      {prod.subCategory && (
                        <span className="text-slate-400 font-normal truncate">
                          &gt; {prod.subCategory.name}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-xs leading-snug mb-2 line-clamp-2 flex-1">{prod.name}</h3>
                    {showTieredPricing ? (
                      <div className="space-y-0.5 mb-2">
                        <div className="text-xs font-black text-purple-700">
                          {isBengkel ? 'Retail' : 'Ecer'}: {formatCurrency(prod.sellPriceRetail || prod.sellPrice)}
                        </div>
                        {prod.sellPriceMitra && (
                          <div className="text-[10px] text-slate-500 font-semibold">
                            {isBengkel ? 'Mitra' : 'Warung'}: {formatCurrency(prod.sellPriceMitra)}
                          </div>
                        )}
                        {prod.sellPriceGrosir && (
                          <div className="text-[10px] text-slate-500 font-semibold">
                            {isBengkel ? 'Grosir' : 'Partai'}: {formatCurrency(prod.sellPriceGrosir)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs font-black text-primary mb-2">{formatCurrency(prod.sellPrice)}</div>
                    )}
                    <div className="flex gap-1 mt-auto border-t border-slate-100 pt-2">
                      <button 
                        className="py-1 px-2 flex justify-center items-center rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer" 
                        title="Cetak Label Barcode" 
                        onClick={() => {
                          setBarcodeTargetProducts([prod]);
                          setIsBarcodePrintOpen(true);
                        }}
                      >
                        <Barcode size={13}/>
                      </button>
                      <button className="flex-1 py-1 flex justify-center items-center rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer text-xs" title="Edit" onClick={() => openEditModal(prod)}><Edit size={13}/></button>
                      <button className="flex-1 py-1 flex justify-center items-center rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer text-xs" title="Hapus" onClick={() => handleDelete(prod.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'compact' ? (
            /* TAMPILAN RINGKAS (COMPACT MOBILE & DESK CARD LIST) */
            <div className="divide-y divide-slate-100 bg-white">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-medium text-xs">
                  Tidak ada sparepart / produk yang cocok dengan kriteria filter.
                </div>
              ) : filteredProducts.map((prod) => (
                <div key={prod.id} className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col gap-2">
                  {/* Top Bar: Thumbnail + Title + Barcode + Actions */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-50">
                        <ProductImage
                          src={prod.imageUrl}
                          alt={prod.name}
                          categoryName={prod.category?.name}
                          iconSize={16}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                            {prod.name}
                          </h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${prod.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {prod.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                          {prod.barcode && (
                            <span className="font-mono bg-slate-100 px-1 rounded text-slate-600 text-[10px]">
                              {prod.barcode}
                            </span>
                          )}
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/70">
                            {prod.category?.name || 'Umum'}
                          </span>
                          {prod.subCategory && (
                            <span className="text-slate-400">
                              &gt; {prod.subCategory.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors" 
                        title="Cetak Label Barcode" 
                        onClick={() => {
                          setBarcodeTargetProducts([prod]);
                          setIsBarcodePrintOpen(true);
                        }}
                      >
                        <Barcode size={13}/>
                      </button>
                      <button 
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors" 
                        title="Edit Produk" 
                        onClick={() => openEditModal(prod)}
                      >
                        <Edit size={13}/>
                      </button>
                      <button 
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors" 
                        title="Hapus" 
                        onClick={() => handleDelete(prod.id)}
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>

                  {/* Bottom Bar: Price Tiers + Stock + Storage Location */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100/80 text-xs">
                    {/* Price Tiers */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      {showTieredPricing ? (
                        <>
                          <span className="font-black text-purple-900 bg-purple-50/70 px-2 py-0.5 rounded border border-purple-100 text-[11px]">
                            {isBengkel ? 'Retail' : 'Ecer'}: {formatCurrency(prod.sellPriceRetail || prod.sellPrice)}
                          </span>
                          {prod.sellPriceMitra && (
                            <span className="font-semibold text-indigo-700 bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100 text-[10px]">
                              {isBengkel ? 'Mitra' : 'Warung'}: {formatCurrency(prod.sellPriceMitra)}
                            </span>
                          )}
                          {prod.sellPriceGrosir && (
                            <span className="font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {isBengkel ? 'Grosir' : 'Partai'}: {formatCurrency(prod.sellPriceGrosir)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="font-black text-primary text-xs">
                          {formatCurrency(prod.sellPrice)}
                        </span>
                      )}
                    </div>

                    {/* Stock & Storage Location */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      {prod.storageLocation && (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          📍 Rak: {prod.storageLocation}
                        </span>
                      )}
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${prod.stock <= prod.minStock ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {prod.stock} {prod.unit || 'pcs'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* TAMPILAN TABEL LENGKAP */
            <div className="table-responsive p-0 bg-white overflow-x-auto">
              <table className="data-table w-full text-left border-collapse min-w-[680px]">
                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3.5 py-3">GAMBAR</th>
                    <th className="px-3.5 py-3">BARCODE</th>
                    <th className="px-3.5 py-3">{isBengkel ? 'SPAREPART / BARANG' : 'NAMA PRODUK'}</th>
                    <th className="px-3.5 py-3">KATEGORI &amp; SUB-KATEGORI</th>
                    <th className="px-3.5 py-3">{showTieredPricing ? 'STRUKTUR HARGA' : 'HARGA'}</th>
                    <th className="px-3.5 py-3">STOK</th>
                    <th className="px-3.5 py-3">STATUS</th>
                    <th className="px-3.5 py-3 text-right">AKSI</th>
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
                      <td className="px-3.5 py-2.5">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200">
                          <ProductImage
                            src={prod.imageUrl}
                            alt={prod.name}
                            categoryName={prod.category?.name}
                            iconSize={16}
                          />
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500">{prod.barcode || '-'}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-slate-800 text-xs">{prod.name}</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {prod.category?.name || '-'}
                          </span>
                          {prod.subCategory && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                              &gt; {prod.subCategory.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {showTieredPricing ? (
                          <div className="space-y-0.5">
                            {!isBengkel && prod.buyPrice > 0 && (
                              <div className="text-[10px] text-slate-400 font-medium">Beli: {formatCurrency(prod.buyPrice)}</div>
                            )}
                            <div className="text-[11px] font-black text-purple-900">
                              {isBengkel ? 'Retail' : 'Ecer'}: {formatCurrency(prod.sellPriceRetail || prod.sellPrice)}
                            </div>
                            {prod.sellPriceMitra && (
                              <div className="text-[10px] text-indigo-700 font-medium">
                                {isBengkel ? 'Mitra' : 'Warung'}: {formatCurrency(prod.sellPriceMitra)}
                              </div>
                            )}
                            {prod.sellPriceGrosir && (
                              <div className="text-[10px] text-slate-600 font-medium">
                                {isBengkel ? 'Grosir' : 'Partai'}: {formatCurrency(prod.sellPriceGrosir)} (≥{prod.minQtyGrosir || 1} pcs)
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="text-[10px] text-muted font-medium">Beli: {formatCurrency(prod.buyPrice)}</div>
                            <div className="text-xs font-black text-primary mt-0.5">Jual: {formatCurrency(prod.sellPrice)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className={`font-black text-xs ${prod.stock <= prod.minStock ? 'text-red-500' : 'text-emerald-600'}`}>
                          {prod.stock} <span className="text-[10px] font-semibold">pcs</span>
                        </div>
                        <div className="text-[10px] text-muted font-medium mt-0.5">Min: {prod.minStock}</div>
                        {prod.storageLocation && (
                          <div className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            Rak: {prod.storageLocation}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prod.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {prod.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            className="p-1 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer" 
                            title="Cetak Label Barcode" 
                            onClick={() => {
                              setBarcodeTargetProducts([prod]);
                              setIsBarcodePrintOpen(true);
                            }}
                          >
                            <Barcode size={13}/>
                          </button>
                          <button className="p-1 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer" title="Edit" onClick={() => openEditModal(prod)}><Edit size={13}/></button>
                          <button className="p-1 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer" title="Hapus" onClick={() => handleDelete(prod.id)}><Trash2 size={13}/></button>
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
            <span>Menampilkan {filteredProducts.length} dari {products.length} {isBengkel ? 'sparepart & barang' : 'produk'}</span>
          </span>
          <span>{posContext?.settings?.storeName || (isBengkel ? 'Bengkel & Otomotif' : 'CodePOS')} Inventory</span>
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

      {/* RECYCLE BIN MODAL */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        onItemRestored={() => {
          fetchProducts();
          fetchCategories();
        }}
      />

      {/* AI MENU & PROFIT PROTECTION ADVISOR MODAL */}
      <AiMenuOptimizerModal
        isOpen={isAiAdvisorOpen}
        onClose={() => setIsAiAdvisorOpen(false)}
        token={posContext?.token}
      />

      {/* BARCODE LABEL PRINT MODAL (1, 2, 3 KOLOM & A4) */}
      {isBarcodePrintOpen && (
        <BarcodeLabelPrintModal
          isOpen={isBarcodePrintOpen}
          onClose={() => setIsBarcodePrintOpen(false)}
          allProducts={products}
          initialSelectedProducts={barcodeTargetProducts}
          onProductsUpdated={fetchProducts}
        />
      )}

      {/* BARCODE SCANNER CAMERA MODAL */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onDetected={(code) => {
            setIsScannerOpen(false);
            const clean = code.trim();
            setSearchQuery(clean);
            searchInputRef.current?.focus();
            const match = products.find(p => 
              (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) ||
              (p.sku && p.sku.toLowerCase() === clean.toLowerCase()) ||
              String(p.id) === clean
            );
            if (match) {
              playScannerBeep(true);
              toast(`⚡ [Scan Kamera] Ditemukan: ${match.name}`, 'success');
            } else {
              playScannerBeep(false);
              toast(`🔍 Memfilter kode: ${clean}`, 'info');
            }
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* MODAL CATAT PERMINTAAN SUKU CADANG (DEFECTA / LOST SALES) */}
      {isBengkel && (
        <PartRequestModal
          isOpen={isPartRequestModalOpen}
          onClose={() => setIsPartRequestModalOpen(false)}
          onSuccess={() => {
            fetchProducts();
          }}
        />
      )}
    </div>
  );
};

export default ProductView;

