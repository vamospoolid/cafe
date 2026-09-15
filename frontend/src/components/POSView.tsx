import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Camera, Plus, Trash2, Minus, Search, CreditCard, User, Edit2, 
  ShoppingCart, Package, ArrowRight, X, Save, Lock, Play,
  Maximize2, Minimize2, Download, RefreshCw, Wifi, WifiOff, Smartphone
} from 'lucide-react';
import CheckoutModal from './CheckoutModal';
import CustomerModal from './CustomerModal';
import DrinkCustomizationModal from './DrinkCustomizationModal';
import type { DrinkCustomization } from './DrinkCustomizationModal';
import OpenShiftModal from './OpenShiftModal';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { offlineDB } from '../utils/offlineDb';
import { isNativePlatform, startNativeBarcodeScan } from '../utils/barcodeScannerNative';
import useSocket from '../hooks/useSocket';

export interface CartItem {
  product: any;
  qty: number;
  notes?: string;
}

export const getCategoryIcon = (name: string) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('drink') || lower.includes('beverage') || lower.includes('kopi') || lower.includes('minum') || lower.includes('tea') || lower.includes('coffee') || lower.includes('latte') || lower.includes('matcha')) return '🍵';
  if (lower.includes('food') || lower.includes('savory') || lower.includes('makan') || lower.includes('ramen') || lower.includes('nasi') || lower.includes('mie') || lower.includes('sando') || lower.includes('pasta') || lower.includes('quiche')) return '🍜';
  if (lower.includes('sweet') || lower.includes('dessert') || lower.includes('tart') || lower.includes('cake') || lower.includes('croissant') || lower.includes('snack') || lower.includes('pastry') || lower.includes('bread')) return '🍰';
  if (lower.includes('topping') || lower.includes('extra') || lower.includes('tambahan')) return '🧂';
  if (lower.includes('combo') || lower.includes('paket') || lower.includes('set')) return '🍱';
  return '🍽️';
};

export const POSView = () => {
  const socket = useSocket();
  const [activeCategory, setActiveCategory] = useState<number | 'Semua'>('Semua');
  const [activeSubCategory, setActiveSubCategory] = useState<number | 'Semua'>('Semua');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  
  const [orderType, setOrderType] = useState<'Dine In' | 'Take Away'>('Take Away');
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const selectedTableId = selectedTableIds.length > 0 ? selectedTableIds[0] : null;

  const toggleTableSelection = (tId: number) => {
    posContext?.triggerHaptic(10);
    setSelectedTableIds(prev => {
      if (prev.includes(tId)) {
        return prev.filter(id => id !== tId);
      } else {
        return [...prev, tId];
      }
    });
  };

  const clearSelectedTables = () => {
    setSelectedTableIds([]);
  };

  const [drinkModalOpen, setDrinkModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any>(null);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const paramTableId = searchParams.get('tableId');
    if (paramTableId) {
      const tId = Number(paramTableId);
      if (!isNaN(tId)) {
        setSelectedTableIds([tId]);
        setOrderType('Dine In');
      }
    }
  }, [searchParams]);

  // PWA & Tablet Kiosk States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);

    // Fullscreen state listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // PWA beforeinstallprompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('[PWA] beforeinstallprompt event captured');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  const posContext = useContext(POSContext);
  const drinkCustomizationEnabled = posContext?.settings?.enableDrinkCustomization ?? false;

  useEffect(() => {
    if (posContext?.token) {
      fetchCategories();
      fetchProducts();
      fetchTables();
    }
  }, [posContext?.token]);

  // Real-time Live Kitchen Stock Sync & Auto Sold-Out Lock
  useEffect(() => {
    if (!socket) return;

    const handleStockSync = (data: any) => {
      console.log('[POS Socket] menu:stock_sync received:', data);
      if (data?.soldOutProductIds) {
        setProducts(prev => prev.map(p => {
          if (data.soldOutProductIds.includes(p.id)) {
            return { ...p, isSoldOut: true, stock: 0 };
          }
          if (data.availableProductIds && data.availableProductIds.includes(p.id)) {
            return { ...p, isSoldOut: false };
          }
          return p;
        }));
      } else {
        // Full refresh if needed
        fetchProducts();
      }
    };

    const handleProductSoldOut = (data: any) => {
      console.log('[POS Socket] product:sold_out received:', data);
      if (data?.productId) {
        setProducts(prev => prev.map(p => p.id === data.productId ? { ...p, isSoldOut: true, stock: 0 } : p));
        toast(`⚠️ Dapur: Menu "${data.productName}" telah habis & dikunci otomatis!`, 'warning');
      }
    };

    socket.on('menu:stock_sync', handleStockSync);
    socket.on('product:sold_out', handleProductSoldOut);

    return () => {
      socket.off('menu:stock_sync', handleStockSync);
      socket.off('product:sold_out', handleProductSoldOut);
    };
  }, [socket]);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setTables(await res.json());
      }
    } catch (err) {}
  };

  const fetchCategories = async () => {
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/categories', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
          await offlineDB.saveCategories(data);
        }
      } catch (err) {
        console.error('Fetch categories failed, loading from cache:', err);
        const cached = await offlineDB.getCategories();
        setCategories(cached);
      }
    } else {
      const cached = await offlineDB.getCategories();
      setCategories(cached);
    }
  };

  const fetchProducts = async () => {
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/products', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const activeProducts = data.filter((p: any) => p.status === 'Aktif');
          setProducts(activeProducts);
          await offlineDB.saveProducts(activeProducts);
        }
      } catch (err) {
        console.error('Fetch products failed, loading from cache:', err);
        const cached = await offlineDB.getProducts();
        setProducts(cached);
      }
    } else {
      const cached = await offlineDB.getProducts();
      setProducts(cached);
    }
  };

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const toggleFullscreen = () => {
    posContext?.triggerHaptic(20);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error('Error attempting to exit fullscreen:', err);
        });
      }
    }
  };

  const handleInstallPWA = async () => {
    if (!installPrompt) {
      toast('Aplikasi sudah terpasang atau gunakan menu browser "Tambahkan ke Layar Utama"', 'info');
      return;
    }
    posContext?.triggerHaptic(30);
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      toast('Aplikasi SOL POS berhasil dipasang!', 'success');
      setInstallPrompt(null);
    }
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast('Koneksi masih offline. Sambungkan Wi-Fi/Internet terlebih dahulu.', 'warning');
      return;
    }
    setIsSyncing(true);
    posContext?.triggerHaptic(25);
    try {
      await posContext?.syncOfflineOrders();
    } finally {
      setIsSyncing(false);
    }
  };

  const addToCart = (product: any, customization?: DrinkCustomization) => {
    posContext?.triggerHaptic(25);
    const notesStr = customization
      ? [customization.temperature, customization.sugar, customization.ice, customization.notes].filter(Boolean).join(' • ')
      : '';
    setCart(prev => {
      // If same product and same notes -> stack qty
      const existing = prev.find(item => item.product.id === product.id && item.notes === notesStr);
      if (existing) {
        return prev.map(item => item.product.id === product.id && item.notes === notesStr ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1, notes: notesStr }];
    });
  };

  const handleProductClick = (product: any) => {
    if (product.isSoldOut || (product.stock !== undefined && product.stock <= 0 && !product.hasRecipe)) {
      toast(`Menu "${product.name}" sudah habis di dapur!`, 'warning');
      return;
    }

    // Determine if product is a drink (category name contains minuman or bevvies)
    const categoryName = categories.find((c: any) => c.id === product.categoryId)?.name?.toLowerCase() || '';
    const isDrink = categoryName.includes('minum') || categoryName.includes('bev');
    if (drinkCustomizationEnabled && isDrink) {
      setPendingProduct(product);
      setDrinkModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  const decreaseQty = (productId: number) => {
    posContext?.triggerHaptic(20);
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.qty > 1) {
        return prev.map(item => item.product.id === productId ? { ...item, qty: item.qty - 1 } : item);
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const removeFromCart = (productId: number) => {
    posContext?.triggerHaptic(30);
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const taxRate = posContext?.settings?.taxRate || 0;
  const serviceChargeRate = posContext?.settings?.serviceCharge || 0;

  const subtotal = cart.reduce((sum, item) => sum + (item.product.sellPrice * item.qty), 0);
  const discount = customer?.discountAmount || 0;
  const tax = (subtotal - discount) * (taxRate / 100);
  const serviceCharge = (subtotal - discount) * (serviceChargeRate / 100);
  const total = subtotal - discount + tax + serviceCharge;

  const handleSaveBill = async () => {
    if (cart.length === 0 || selectedTableIds.length === 0) return;

    try {
      const payload = {
        customerName: customer ? customer.name : 'Pelanggan Dine-In',
        customerPhone: customer?.phone || '',
        tableId: selectedTableIds[0],
        joinedTableIds: selectedTableIds.length > 1 ? selectedTableIds.slice(1) : undefined,
        items: cart.map(item => ({
          productId: item.product.id,
          qty: item.qty,
          price: item.product.sellPrice,
          notes: item.notes || ''
        })),
        subtotal,
        tax,
        serviceCharge,
        total,
        discount,
        customerId: customer?.id,
        pointsUsed: customer?.pointsUsed || 0,
        paymentMethod: 'Pending',
        isPaid: false
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast('Bill berhasil disimpan! Pesanan dikirim ke Dapur.', 'success');
        setCart([]);
        setCustomer(null);
        setSelectedTableIds([]);
        fetchProducts(); // Refresh stock
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal menyimpan bill', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan server', 'error');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'Semua' || p.categoryId === activeCategory;
    const matchesSubCategory = activeSubCategory === 'Semua' || p.subCategoryId === activeSubCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSubCategory && matchesSearch;
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    // Auto-add if it matches a barcode exactly (useful for hardware scanner emulation)
    const match = products.find(p => p.barcode === val);
    if (match) {
      handleProductClick(match);
      setSearchTerm('');
      toast(`Menambahkan ${match.name} ke keranjang`, 'success');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const match = products.find(p => 
        p.barcode === searchTerm || 
        p.name.toLowerCase() === searchTerm.toLowerCase()
      );
      if (match) {
        handleProductClick(match);
        setSearchTerm('');
        toast(`Menambahkan ${match.name} ke keranjang`, 'success');
      }
    }
  };

  const handleCameraScan = async () => {
    if (!isNativePlatform()) {
      toast('Kamera native scanner hanya tersedia di aplikasi tablet/HP mobile.', 'info');
      return;
    }
    try {
      const barcodeValue = await startNativeBarcodeScan();
      if (barcodeValue) {
        const product = products.find(p => p.barcode === barcodeValue);
        if (product) {
          handleProductClick(product);
          toast(`Menambahkan ${product.name} ke keranjang`, 'success');
        } else {
          toast(`Produk dengan barcode "${barcodeValue}" tidak ditemukan`, 'warning');
        }
      }
    } catch (err: any) {
      toast(err.message || 'Gagal memindai barcode', 'error');
    }
  };

  const isShiftRequired = posContext?.user?.role === 'Kasir' || posContext?.user?.role === 'Admin';
  const hasActiveShift = posContext?.activeShift !== null;

  if (isShiftRequired && !hasActiveShift) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 p-6 text-center min-h-[500px]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200/80 shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100">
            <Lock size={28} className="animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Shift Belum Dibuka</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Untuk mulai melayani transaksi penjualan di kasir, Anda harus membuka shift baru dan memasukkan saldo modal laci awal terlebih dahulu.
          </p>
          <button 
            className="w-full btn btn-primary mt-6 py-3 rounded-xl font-bold text-sm shadow-md hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            onClick={() => setIsOpenShiftOpen(true)}
          >
            <Play size={16} /> Buka Shift Kasir Sekarang
          </button>
        </div>

        <OpenShiftModal 
          isOpen={isOpenShiftOpen} 
          onClose={() => setIsOpenShiftOpen(false)} 
          onSuccess={() => posContext?.fetchActiveShift()} 
          mode="open" 
        />
      </div>
    );
  }

  return (
    <div className="pos-layout" style={{ flexDirection: isMobile ? 'column' : 'row', height: '100%', overflow: 'hidden' }}>
      {/* Kiri: Daftar Produk */}
      <div className="pos-main flex-1 flex flex-col overflow-y-auto">
        {/* PWA & Tablet Kiosk Actions Bar - Sembunyikan di HP karena sudah ada Topbar */}
        <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
          <div className="flex items-center gap-2">
            {/* Status Online/Offline */}
            {posContext?.isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg shadow-sm">
                <WifiOff size={13} className="text-amber-600" />
                <span>Mode Offline (Tersimpan Lokal)</span>
              </span>
            )}

            {/* Offline Queue Sync Indicator */}
            {(posContext?.offlineQueueCount ?? 0) > 0 && (
              <button 
                onClick={handleManualSync} 
                disabled={isSyncing}
                title="Klik untuk menyinkronkan transaksi offline ke server"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-md transition-all active:scale-95"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>Sinkron ({posContext?.offlineQueueCount} Tertunda)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Install PWA Button */}
            {installPrompt && (
              <button
                onClick={handleInstallPWA}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg shadow-md hover:opacity-90 active:scale-95 transition-all"
                title="Pasang aplikasi POS di Tablet Android"
              >
                <Download size={13} />
                <span>Pasang Aplikasi POS</span>
              </button>
            )}

            {/* Kiosk Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
              title={isFullscreen ? 'Keluar dari Layar Penuh' : 'Mode Layar Penuh Kiosk Tablet'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 size={13} className="text-violet-600" />
                  <span className="hidden sm:inline">Keluar Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} className="text-violet-600" />
                  <span className="hidden sm:inline">Layar Penuh (Kiosk)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Offline Queue Bar di HP jika ada antrean */}
        {isMobile && (posContext?.offlineQueueCount ?? 0) > 0 && (
          <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <span className="font-semibold flex items-center gap-1.5">
              <WifiOff size={13} className="text-amber-600" /> {posContext?.offlineQueueCount} Transaksi Offline
            </span>
            <button 
              onClick={handleManualSync} 
              disabled={isSyncing}
              className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg active:scale-95 transition-all text-[11px]"
            >
              Sinkron Sekarang
            </button>
          </div>
        )}

        {/* Scanner & Filter */}
        <div className="pos-toolbar flex flex-col gap-2.5">
          <div className="scanner-box flex items-center gap-2 bg-gradient-to-r from-sky-50/90 via-blue-50/60 to-indigo-50/40 border border-sky-200/80 rounded-xl px-3 py-2 text-sky-900 shadow-sm transition-all focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
            <Search size={18} className="text-sky-500 shrink-0" />
            <input 
              type="text" 
              className="scanner-input flex-1 bg-transparent border-none outline-none font-medium text-xs sm:text-sm text-slate-800 placeholder-sky-600/50" 
              placeholder="Cari nama menu / scan barcode..." 
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            )}
            <button 
              className="scanner-btn bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 active:scale-95 text-white border-none px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0" 
              onClick={handleCameraScan}
            >
              <Camera size={14} /> <span>Kamera</span>
            </button>
          </div>
          
          {/* Category Filter Chips */}
          <div className="category-filter flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            <button 
              className={`category-chip shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                activeCategory === 'Semua' 
                  ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-sky-400 shadow-md shadow-sky-100 ring-2 ring-sky-300/40' 
                  : 'bg-white text-slate-700 border-slate-200/90 hover:bg-sky-50/50 hover:border-sky-200 shadow-sm'
              }`}
              onClick={() => {
                setActiveCategory('Semua');
                setActiveSubCategory('Semua');
                posContext?.triggerHaptic(10);
              }}
            >
              <span className="text-sm">✨</span>
              <span>Semua</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${activeCategory === 'Semua' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {products.length}
              </span>
            </button>
            {categories.map(cat => {
              const catProductCount = products.filter(p => p.categoryId === cat.id).length;
              const isSelected = activeCategory === cat.id;
              return (
                <button 
                  key={cat.id}
                  className={`category-chip shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-sky-400 shadow-md shadow-sky-100 ring-2 ring-sky-300/40' 
                      : 'bg-white text-slate-700 border-slate-200/90 hover:bg-sky-50/50 hover:border-sky-200 shadow-sm'
                  }`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setActiveSubCategory('Semua');
                    posContext?.triggerHaptic(10);
                  }}
                >
                  <span className="text-sm">{getCategoryIcon(cat.name)}</span>
                  <span>{cat.name}</span>
                  {catProductCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {catProductCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-Category Filter Chips */}
          {(() => {
            if (activeCategory === 'Semua') return null;
            const currentCat = categories.find(c => c.id === activeCategory);
            const subCats = currentCat?.subCategories || [];
            if (subCats.length === 0) return null;
            return (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 animate-fade-in scrollbar-none">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-0.5">Sub:</span>
                <button
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all shrink-0 ${
                    activeSubCategory === 'Semua'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setActiveSubCategory('Semua');
                    posContext?.triggerHaptic(10);
                  }}
                >
                  Semua {currentCat.name}
                </button>
                {subCats.map((sub: any) => (
                  <button
                    key={sub.id}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all shrink-0 ${
                      activeSubCategory === sub.id
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setActiveSubCategory(sub.id);
                      posContext?.triggerHaptic(10);
                    }}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Grid Produk Responsive 2-Kolom di HP / Multi-Kolom di Layar Lebar */}
        <div className="product-grid flex-1">
          {filteredProducts.map(product => {
            const isSoldOut = Boolean(product.isSoldOut || (product.stock !== undefined && product.stock <= 0 && !product.hasRecipe));
            const cartQty = cart.find(item => item.product.id === product.id)?.qty || 0;
            return (
              <div 
                key={product.id} 
                className={`product-card group relative transition-all rounded-2xl overflow-hidden border bg-white shadow-sm hover:shadow-md active:scale-95 flex flex-col justify-between ${
                  isSoldOut 
                    ? 'opacity-60 grayscale cursor-not-allowed border-rose-200/50 bg-slate-50' 
                    : cartQty > 0
                      ? 'border-emerald-500 ring-2 ring-emerald-400/30 bg-emerald-50/15 shadow-emerald-100/50 cursor-pointer'
                      : 'border-slate-200/80 cursor-pointer hover:border-indigo-500'
                }`} 
                onClick={() => {
                  if (!isSoldOut) {
                    posContext?.triggerHaptic(15);
                    handleProductClick(product);
                  }
                }}
              >
                <div className="product-img-wrapper bg-slate-50 flex items-center justify-center relative overflow-hidden h-28 sm:h-36 w-full">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className={`product-img w-full h-full object-cover ${!isSoldOut ? 'group-hover:scale-105' : ''} transition-transform duration-300`} />
                  ) : (
                    <Package size={36} className="text-slate-300" />
                  )}

                  {/* Quantity In-Cart Badge */}
                  {cartQty > 0 && !isSoldOut && (
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-lg border border-white/90 animate-in zoom-in-75 duration-200 flex items-center gap-1">
                      <span>✓</span> {cartQty}x
                    </div>
                  )}
                  
                  {/* Sold Out Badge Overlay */}
                  {isSoldOut ? (
                    <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center z-10">
                      <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider rounded-md shadow-md border border-white/20">
                        HABIS
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  )}
                </div>

                <div className="product-info p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-1">
                  <div>
                    <div className="product-name font-bold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-tight" title={product.name}>
                      {product.name}
                    </div>
                  </div>
                  
                  <div className="pt-1 mt-auto">
                    <div className="product-price font-black text-xs sm:text-sm text-indigo-600">
                      {formatCurrency(product.sellPrice)}
                    </div>
                    <div className="product-stock flex justify-between items-center text-[10px] sm:text-xs text-slate-400 mt-0.5">
                      {isSoldOut ? (
                        <span className="font-extrabold text-rose-500 uppercase text-[9px]">Stok Habis</span>
                      ) : (
                        <span className={`font-semibold ${product.stock <= product.minStock ? 'text-red-500' : 'text-slate-400'}`}>
                          Stok: {product.stock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 px-4 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 my-4">
              <Package size={42} className="mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">Belum ada produk untuk kategori ini</p>
              <p className="text-[11px] text-slate-400 mt-1">Coba pilih kategori lain atau kata kunci pencarian yang berbeda.</p>
            </div>
          )}
        </div>
      </div>

      {/* Kanan: Keranjang - Hanya dirender pada layar Desktop */}
      {!isMobile && (
        <div className="pos-sidebar">
          <div className="cart-header">
            <div className="cart-title">
              <ShoppingCart size={20} /> Keranjang
            </div>
            <button className="icon-btn text-danger" onClick={() => setCart([])} disabled={cart.length === 0}>
              <Trash2 size={18} />
            </button>
          </div>

          <div className="cart-body flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingCart size={48} className="mb-4 opacity-30" />
                <p>Keranjang masih kosong</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name truncate max-w-[150px]">{item.product.name}</div>
                    {item.notes && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.15rem', lineHeight: 1.3 }}>{item.notes}</div>
                    )}
                    <div className="cart-item-price">{formatCurrency(item.product.sellPrice)} <span className="text-muted" style={{fontSize: '12px', fontWeight: 'normal'}}>x {item.qty}</span></div>
                    
                    <div className="cart-item-controls mt-2">
                      <button className="qty-btn" onClick={() => decreaseQty(item.product.id)}><Minus size={14} /></button>
                      <span className="qty-val">{item.qty}</span>
                      <button className="qty-btn" onClick={() => addToCart(item.product)}><Plus size={14} /></button>
                    </div>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between'}}>
                    <button className="cart-item-remove text-gray-400 hover:text-red-500" onClick={() => removeFromCart(item.product.id)}><X size={16}/></button>
                    <div style={{fontWeight: 700, fontSize: '0.875rem'}}>{formatCurrency(item.product.sellPrice * item.qty)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="cart-footer">
            <div className="summary-row">
              <span>Subtotal</span>
              <span style={{fontWeight: 600, color: 'var(--text-main)'}}>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Diskon <span className="text-muted" style={{fontSize: '10px'}}>{customer?.pointsUsed ? `(Poin: ${customer.pointsUsed})` : ''}</span></span>
              <span className="text-red-500">-{formatCurrency(discount)}</span>
            </div>
            <div className="summary-row">
              <span>PPN <span className="text-muted" style={{fontSize: '10px'}}>({taxRate}%)</span></span>
              <span>{formatCurrency(tax)}</span>
            </div>
            {serviceChargeRate > 0 && (
              <div className="summary-row">
                <span>Layanan <span className="text-muted" style={{fontSize: '10px'}}>({serviceChargeRate}%)</span></span>
                <span>{formatCurrency(serviceCharge)}</span>
              </div>
            )}
            <div className="summary-total border-t pt-3 mt-2">
              <span>Total</span>
              <span className="text-xl">{formatCurrency(total)}</span>
            </div>
            
            {/* Customer Selection */}
            <div 
              className="mb-3 p-3 border border-gray-200 rounded-lg flex items-center justify-between bg-white cursor-pointer hover:border-primary transition-colors group shadow-sm"
              onClick={() => setIsCustomerModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">
                    {customer ? customer.name : 'Pelanggan Umum'}
                  </div>
                  <div className="text-xs text-muted">
                    {customer?.points ? `Member (${customer.points} pts)` : 'Klik untuk data Pemesan'}
                  </div>
                </div>
              </div>
              <Edit2 size={16} className="text-gray-400 group-hover:text-primary" />
            </div>

            {/* Table / Order Type Selection */}
            <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm flex flex-col gap-3">
              <div className="flex gap-2">
                <button 
                  className={`flex-1 py-2 text-sm font-bold rounded-md border transition-all ${orderType === 'Take Away' ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                  onClick={() => { setOrderType('Take Away'); clearSelectedTables(); }}
                >
                  Take Away
                </button>
                <button 
                  className={`flex-1 py-2 text-sm font-bold rounded-md border transition-all ${orderType === 'Dine In' ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                  onClick={() => setOrderType('Dine In')}
                >
                  Dine In
                </button>
              </div>
              
              {orderType === 'Dine In' && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Pilih Meja ({tables.length})</span>
                    {selectedTableIds.length > 0 && (
                      <button 
                        type="button" 
                        onClick={clearSelectedTables}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold lowercase underline"
                      >
                        batal ({selectedTableIds.length})
                      </button>
                    )}
                  </div>

                  {selectedTableIds.length > 1 && (
                    <div className="p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-900 truncate">
                        <span className="text-sm">🔗</span>
                        <span className="truncate">
                          Gabung: {tables.filter(t => selectedTableIds.includes(t.id)).map(t => `#${t.tableNo}`).join(' + ')}
                        </span>
                      </div>
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                        {tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + (t.capacity || 0), 0)} Pax
                      </span>
                    </div>
                  )}

                  {tables.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50/80 rounded-xl border border-slate-200 scrollbar-none">
                      {tables.map(t => {
                        const isSelected = selectedTableIds.includes(t.id);
                        const isOccupied = t.status === 'Terisi';
                        const selectIndex = selectedTableIds.indexOf(t.id) + 1;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTableSelection(t.id)}
                            className={`py-1.5 px-1 rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center relative ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-400 scale-[1.03]'
                                : isOccupied
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 shadow-sm'
                            }`}
                          >
                            {isSelected && selectedTableIds.length > 1 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                                {selectIndex}
                              </span>
                            )}
                            <span>#{t.tableNo}</span>
                            <span className={`text-[9px] font-medium ${isSelected ? 'text-indigo-100' : isOccupied ? 'text-amber-700' : 'text-slate-400'}`}>
                              {isOccupied ? 'Terisi' : `${t.capacity}p`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-lg">
                      Belum ada data meja
                    </div>
                  )}
                </div>
              )}
            </div>

            {orderType === 'Dine In' && (
              <button 
                className={`w-full font-bold rounded-lg py-3 mb-2 flex items-center justify-center gap-2 border-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-all shadow-sm ${cart.length === 0 || selectedTableIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={cart.length === 0 || selectedTableIds.length === 0}
                onClick={handleSaveBill}
              >
                <Save size={20} /> Simpan Bill {selectedTableIds.length > 1 ? `(${selectedTableIds.length} Meja)` : ''} (Kirim ke Dapur)
              </button>
            )}

            <button 
              className="btn-checkout py-3 flex items-center justify-center gap-2"
              disabled={cart.length === 0 || (orderType === 'Dine In' && selectedTableIds.length === 0)}
              onClick={() => setIsCheckoutOpen(true)}
            >
              <CreditCard size={20} /> Proses Pembayaran {selectedTableIds.length > 1 ? `(${selectedTableIds.length} Meja)` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Cart Floating bar (collapsed state) */}
      {isMobile && cart.length > 0 && !isMobileCartOpen && (
        <div 
          onClick={() => {
            posContext?.triggerHaptic(20);
            setIsMobileCartOpen(true);
          }}
          className="fixed bottom-20 left-3.5 right-3.5 sm:bottom-24 sm:left-4 sm:right-4 h-14 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 backdrop-blur-md rounded-2xl border border-emerald-400/40 shadow-xl flex items-center justify-between px-4 z-30 cursor-pointer text-white active:scale-[0.98] transition-all"
          style={{ boxShadow: '0 8px 25px rgba(5, 150, 105, 0.35)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingCart size={16} />
            </div>
            <div>
              <div className="font-black text-xs leading-none">{cart.reduce((sum, item) => sum + item.qty, 0)} Menu Dipilih</div>
              <div className="font-extrabold text-[13px] text-emerald-100 mt-0.5">{formatCurrency(total)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-black text-xs bg-white text-emerald-800 px-3.5 py-2 rounded-xl shadow-sm">
            <span>Lihat Pesanan</span>
            <ArrowRight size={13} />
          </div>
        </div>
      )}

      {/* Mobile Full Cart Drawer (expanded state bottom sheet) */}
      {isMobile && isMobileCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsMobileCartOpen(false)}>
          <div 
            className="bg-white w-full rounded-t-3xl shadow-2xl max-w-md border-t border-slate-100 flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ height: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-indigo-650" size={18} />
                <span className="font-extrabold text-sm text-slate-800">Keranjang Belanja ({cart.reduce((sum, item) => sum + item.qty, 0)})</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-red-500 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors" onClick={() => { setCart([]); setIsMobileCartOpen(false); }} disabled={cart.length === 0}>
                  Kosongkan
                </button>
                <button 
                  type="button"
                  className="text-slate-400 hover:text-slate-600 font-bold p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                  onClick={() => setIsMobileCartOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <ShoppingCart size={48} className="mb-4 opacity-30" />
                  <p>Keranjang masih kosong</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="font-bold text-xs text-slate-800 truncate">{item.product.name}</div>
                      {item.notes && (
                        <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">{item.notes}</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1 font-semibold">{formatCurrency(item.product.sellPrice)} x {item.qty}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black transition-all active:scale-95 shadow-sm" onClick={() => decreaseQty(item.product.id)}><Minus size={12} /></button>
                        <span className="text-xs font-bold text-slate-800 min-w-[20px] text-center">{item.qty}</span>
                        <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black transition-all active:scale-95 shadow-sm" onClick={() => addToCart(item.product)}><Plus size={12} /></button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between min-h-[70px]">
                      <button className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100/50" onClick={() => removeFromCart(item.product.id)}><X size={14}/></button>
                      <div className="font-extrabold text-xs text-slate-800">{formatCurrency(item.product.sellPrice * item.qty)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                <div className="flex justify-between border-r border-slate-200 pr-2">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>Diskon:</span>
                  <span className="font-bold text-red-500">-{formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between border-r border-slate-200 pr-2 pt-1 border-t border-slate-100">
                  <span>PPN ({taxRate}%):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between pl-2 pt-1 border-t border-slate-100">
                  <span>Layanan ({serviceChargeRate}%):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(serviceCharge)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200/80 pt-3">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Pembayaran</span>
                <span className="text-base font-black text-indigo-650">{formatCurrency(total)}</span>
              </div>

              {/* Customer Selector */}
              <div 
                className="p-2.5 border border-slate-200 rounded-xl flex items-center justify-between bg-white cursor-pointer hover:border-indigo-600 transition-colors shadow-sm"
                onClick={() => setIsCustomerModalOpen(true)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">
                      {customer ? customer.name : 'Pelanggan Umum'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {customer?.points ? `Member (${customer.points} pts)` : 'Ketuk untuk data Pemesan'}
                    </div>
                  </div>
                </div>
                <Edit2 size={12} className="text-slate-400" />
              </div>

              {/* Order Type & Table */}
              <div className="flex gap-2">
                <button 
                  className={`flex-1 py-2 text-xs font-extrabold rounded-xl border transition-all ${orderType === 'Take Away' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/10' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => { setOrderType('Take Away'); clearSelectedTables(); }}
                >
                  Take Away
                </button>
                <button 
                  className={`flex-1 py-2 text-xs font-extrabold rounded-xl border transition-all ${orderType === 'Dine In' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/10' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setOrderType('Dine In')}
                >
                  Dine In
                </button>
              </div>

              {orderType === 'Dine In' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Pilih Meja ({tables.length})</span>
                    {selectedTableIds.length > 0 && (
                      <button 
                        type="button" 
                        onClick={clearSelectedTables}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold lowercase underline"
                      >
                        batal ({selectedTableIds.length})
                      </button>
                    )}
                  </div>

                  {selectedTableIds.length > 1 && (
                    <div className="p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-900 truncate">
                        <span className="text-sm">🔗</span>
                        <span className="truncate">
                          Gabung: {tables.filter(t => selectedTableIds.includes(t.id)).map(t => `#${t.tableNo}`).join(' + ')}
                        </span>
                      </div>
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                        {tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + (t.capacity || 0), 0)} Pax
                      </span>
                    </div>
                  )}

                  {tables.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1 max-h-28 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200 scrollbar-none">
                      {tables.map(t => {
                        const isSelected = selectedTableIds.includes(t.id);
                        const isOccupied = t.status === 'Terisi';
                        const selectIndex = selectedTableIds.indexOf(t.id) + 1;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTableSelection(t.id)}
                            className={`py-1 px-1 rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center relative ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                                : isOccupied
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                  : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isSelected && selectedTableIds.length > 1 && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-black flex items-center justify-center shadow">
                                {selectIndex}
                              </span>
                            )}
                            <span>#{t.tableNo}</span>
                            <span className={`text-[8px] font-medium ${isSelected ? 'text-indigo-100' : isOccupied ? 'text-amber-700' : 'text-slate-400'}`}>
                              {isOccupied ? 'Terisi' : `${t.capacity}p`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-lg">
                      Belum ada data meja
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {orderType === 'Dine In' && (
                  <button 
                    className={`flex-1 font-bold rounded-xl py-3 text-xs flex items-center justify-center gap-1.5 border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-all ${cart.length === 0 || selectedTableIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={cart.length === 0 || selectedTableIds.length === 0}
                    onClick={() => { handleSaveBill(); setIsMobileCartOpen(false); }}
                  >
                    <Save size={16} /> Simpan Bill {selectedTableIds.length > 1 ? `(${selectedTableIds.length})` : ''}
                  </button>
                )}
                <button 
                  className="flex-1 py-3 text-xs bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                  disabled={cart.length === 0 || (orderType === 'Dine In' && selectedTableIds.length === 0)}
                  onClick={() => { setIsCheckoutOpen(true); setIsMobileCartOpen(false); }}
                >
                  <CreditCard size={16} /> Pembayaran {selectedTableIds.length > 1 ? `(${selectedTableIds.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        onSuccess={() => {
          setCart([]);
          setCustomer(null);
          clearSelectedTables();
          fetchProducts(); // Refresh stock
        }}
        total={total} 
        subtotal={subtotal}
        tax={tax}
        serviceCharge={serviceCharge}
        cart={cart}
        customer={{ 
          ...customer, 
          tableId: selectedTableIds[0] || null,
          joinedTableIds: selectedTableIds.length > 1 ? selectedTableIds.slice(1) : undefined
        }}
      />

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={(data) => setCustomer(data)}
      />

      <DrinkCustomizationModal
        isOpen={drinkModalOpen}
        productName={pendingProduct?.name || ''}
        onClose={() => { setDrinkModalOpen(false); setPendingProduct(null); }}
        onConfirm={(customization) => {
          if (pendingProduct) addToCart(pendingProduct, customization);
          setDrinkModalOpen(false);
          setPendingProduct(null);
        }}
      />
    </div>
  );
};

export default POSView;
