import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Package, 
  Search, 
  ShoppingCart, 
  User, 
  Plus, 
  Minus, 
  Trash2, 
  Tag, 
  Sparkles, 
  Camera, 
  X, 
  RefreshCw,
  Phone, 
  Boxes, 
  Truck, 
  CreditCard, 
  Barcode, 
  Check, 
  AlertCircle,
  HelpCircle,
  ClipboardList,
  ArrowRight
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { RetailCustomerPicker, type CustomerData } from './RetailCustomerPicker';
import { RetailCheckoutModal } from './RetailCheckoutModal';
import { RetailReceiptPrinter } from './RetailReceiptPrinter';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import { initHardwareBarcodeListener, playScannerBeep } from '../../utils/hardwareBarcodeListener';

interface ProductUOM {
  id: string;
  unitName: string;
  conversionRatio: number;
  barcode?: string | null;
  priceSell: number;
  isDefaultSale?: boolean;
}

interface ProductPriceTier {
  id: string;
  minQty: number;
  tierName: string;
  unitPrice: number;
  customerCategory?: string | null;
}

interface Product {
  id: number;
  name: string;
  barcode?: string | null;
  categoryId: number;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  baseUom: string;
  storageLocation?: string | null;
  sellPriceRetail?: number | null;
  sellPriceMitra?: number | null;
  sellPriceGrosir?: number | null;
  minQtyGrosir?: number | null;
  productUoms?: ProductUOM[];
  priceTiers?: ProductPriceTier[];
  category?: { id: number; name: string };
}

interface CartItem {
  id: string;
  productId: number;
  productName: string;
  barcode?: string;
  qty: number;
  price: number;
  buyPrice: number;
  subtotal: number;
  uomName: string;
  uomRatio: number;
  priceTierName?: string;
  baseUom: string;
  stock: number;
  storageLocation?: string;
  availableUoms: ProductUOM[];
  availableTiers: ProductPriceTier[];
}

export const POSRetail: React.FC = () => {
  const { token, settings, user } = usePOS();

  // Active Transaction Details
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [priceTier, setPriceTier] = useState<'UMUM' | 'MITRA' | 'GROSIR'>('UMUM');

  // Catalogs
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modals
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState<boolean>(false);
  const [lastOrderResult, setLastOrderResult] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);

  const scannerInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Catalog
  const loadCatalogs = async () => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/products', { headers }),
        fetch('/api/categories', { headers })
      ]);

      if (prodRes.ok) {
        const pData = await prodRes.json();
        const prods = Array.isArray(pData) ? pData : (pData.products || []);
        setProducts(prods);
      }

      if (catRes.ok) {
        const cData = await catRes.json();
        const cats = Array.isArray(cData) ? cData : (cData.categories || []);
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to load retail catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, [token]);

  // Autofocus scanner input
  useEffect(() => {
    const timer = setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [products.length]);

  // Global Hardware Barcode Scanner Listener
  useEffect(() => {
    const unbind = initHardwareBarcodeListener({
      onScan: (scannedCode) => {
        const clean = scannedCode.trim().toLowerCase();
        
        // Cek barcode produk utama atau barcode UOM
        let matchedProduct: Product | undefined;
        let matchedUom: ProductUOM | undefined;

        for (const p of products) {
          if (
            (p.barcode && p.barcode.toLowerCase() === clean) ||
            String(p.id) === clean
          ) {
            matchedProduct = p;
            break;
          }
          if (p.productUoms) {
            const u = p.productUoms.find(uom => uom.barcode && uom.barcode.toLowerCase() === clean);
            if (u) {
              matchedProduct = p;
              matchedUom = u;
              break;
            }
          }
        }

        if (matchedProduct) {
          handleAddProduct(matchedProduct, matchedUom);
          setSearchQuery('');
          playScannerBeep(true);
        } else {
          playScannerBeep(false);
          toast(`Barang barcode "${scannedCode}" tidak ditemukan.`, 'error');
        }
      }
    });

    return () => unbind();
  }, [products, priceTier]);

  // Keyboard Shortcuts (F1, F2, F3, F4, F9, F10 / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts if customer picker or checkout modals are active
      if (isCustomerPickerOpen || isCheckoutOpen || isScannerOpen) return;

      if (e.key === 'F1') {
        e.preventDefault();
        scannerInputRef.current?.focus();
        scannerInputRef.current?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setIsCustomerPickerOpen(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowShortcutHelp(prev => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          if (window.confirm('Apakah Anda yakin ingin mengosongkan keranjang belanja?')) {
            setCart([]);
            toast('Keranjang belanja berhasil dikosongkan.', 'info');
          }
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) handleQuickCash();
      } else if (e.key === 'F10' || (e.code === 'Space' && e.target === document.body)) {
        e.preventDefault();
        if (cart.length > 0) setIsCheckoutOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCustomerPickerOpen, isCheckoutOpen, isScannerOpen]);

  // Resolve item price based on active tier and UOM
  const resolvePrice = (
    product: Product,
    selectedUom?: ProductUOM,
    tier: 'UMUM' | 'MITRA' | 'GROSIR' = priceTier
  ): number => {
    if (selectedUom) {
      if (selectedUom.priceSell > 0) {
        if (tier === 'MITRA') return Math.round(selectedUom.priceSell * 0.96);
        if (tier === 'GROSIR') return Math.round(selectedUom.priceSell * 0.93);
        return selectedUom.priceSell;
      }
      return (product.sellPrice || 0) * (selectedUom.conversionRatio || 1);
    }

    const retail = Number(product.sellPriceRetail ?? product.sellPrice ?? 0);
    const mitra = product.sellPriceMitra != null ? Number(product.sellPriceMitra) : retail;
    const grosir = product.sellPriceGrosir != null ? Number(product.sellPriceGrosir) : retail;

    if (tier === 'GROSIR') return grosir;
    if (tier === 'MITRA') return mitra;
    return retail;
  };

  // Add product to cart
  const handleAddProduct = (product: Product, uom?: ProductUOM) => {
    const activeUomName = uom ? uom.unitName : (product.baseUom || 'PCS');
    const activeUomRatio = uom ? uom.conversionRatio : 1;
    const cartItemId = `${product.id}_${activeUomName}`;
    const unitPrice = resolvePrice(product, uom, priceTier);

    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (existing) {
        const newQty = existing.qty + 1;
        return prev.map(item => 
          item.id === cartItemId 
            ? { ...item, qty: newQty, subtotal: newQty * item.price }
            : item
        );
      } else {
        const newItem: CartItem = {
          id: cartItemId,
          productId: product.id,
          productName: product.name,
          barcode: uom?.barcode || product.barcode || '',
          qty: 1,
          price: unitPrice,
          buyPrice: product.buyPrice * activeUomRatio,
          subtotal: unitPrice,
          uomName: activeUomName,
          uomRatio: activeUomRatio,
          baseUom: product.baseUom || 'PCS',
          stock: product.stock,
          storageLocation: product.storageLocation || 'Rak Depan',
          availableUoms: product.productUoms || [],
          availableTiers: product.priceTiers || []
        };
        return [...prev, newItem];
      }
    });

    playScannerBeep(true);
  };

  // Switch UOM in Cart Item
  const handleSwitchCartUom = (cartItemId: string, targetUomName: string) => {
    setCart(prev => prev.map(item => {
      if (item.id !== cartItemId) return item;

      const product = products.find(p => p.id === item.productId);
      if (!product) return item;

      let newPrice = product.sellPrice;
      let newRatio = 1;

      if (targetUomName !== product.baseUom && product.productUoms) {
        const foundUom = product.productUoms.find(u => u.unitName === targetUomName);
        if (foundUom) {
          newRatio = foundUom.conversionRatio;
          newPrice = resolvePrice(product, foundUom, priceTier);
        }
      } else {
        newPrice = resolvePrice(product, undefined, priceTier);
      }

      return {
        ...item,
        id: `${item.productId}_${targetUomName}`,
        uomName: targetUomName,
        uomRatio: newRatio,
        price: newPrice,
        subtotal: item.qty * newPrice
      };
    }));
  };

  // Update Qty
  const updateQty = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== cartItemId) return item;
      const nextQty = Math.max(1, item.qty + delta);
      return {
        ...item,
        qty: nextQty,
        subtotal: nextQty * item.price
      };
    }));
  };

  const setManualQty = (cartItemId: string, val: number) => {
    const nextQty = Math.max(1, val || 1);
    setCart(prev => prev.map(item => 
      item.id === cartItemId ? { ...item, qty: nextQty, subtotal: nextQty * item.price } : item
    ));
  };

  const removeCartItem = (cartItemId: string) => {
    setCart(prev => prev.filter(i => i.id !== cartItemId));
  };

  // Switch Tier for all items
  const handleSwitchTier = (tier: 'UMUM' | 'MITRA' | 'GROSIR') => {
    setPriceTier(tier);
    setCart(prev => prev.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;

      let currentUom: ProductUOM | undefined;
      if (product.productUoms && item.uomName !== product.baseUom) {
        currentUom = product.productUoms.find(u => u.unitName === item.uomName);
      }

      const newPrice = resolvePrice(product, currentUom, tier);
      return {
        ...item,
        price: newPrice,
        subtotal: item.qty * newPrice
      };
    }));
  };

  // Handle Barcode Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const clean = searchQuery.trim().toLowerCase();
    const matched = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === clean) ||
           p.name.toLowerCase() === clean ||
           String(p.id) === clean
    );

    if (matched) {
      handleAddProduct(matched);
      setSearchQuery('');
    }
  };

  // Quick Cash (F9)
  const handleQuickCash = async () => {
    if (cart.length === 0) return;
    const totalAmount = cart.reduce((sum, i) => sum + i.subtotal, 0);

    try {
      const payload = {
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || 'Pelanggan Umum',
        customerPhone: customerPhone || selectedCustomer?.phone || '',
        items: cart.map(i => ({
          productId: i.productId,
          productName: i.productName,
          qty: i.qty,
          price: i.price,
          buyPrice: i.buyPrice,
          uomName: i.uomName,
          uomRatio: i.uomRatio,
          priceTierName: priceTier
        })),
        subtotal: totalAmount,
        discount: 0,
        tax: 0,
        total: totalAmount,
        paymentMethod: 'CASH',
        isDelivery: false
      };

      const res = await fetch('/api/retail/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal checkout tunai.');

      toast('⚡ Transaksi Tunai Pas Berhasil!', 'success');
      setLastOrderResult(json.data);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerPhone('');
      setPriceTier('UMUM');
      loadCatalogs();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  // Totals
  const totalQty = useMemo(() => cart.reduce((sum, i) => sum + i.qty, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.subtotal, 0), [cart]);
  const total = subtotal;

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.storageLocation && p.storageLocation.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  return (
    <div className="pos-layout h-full w-full overflow-hidden" style={{ height: '100%' }}>
      
      {/* ─── KIRI: KATALOG BARANG GROSIR & FILTER (FLEX-1) ─────────────────────── */}
      <div className="pos-main flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-4 gap-3 bg-slate-100">
        
        {/* Top Quick Bar: Pelanggan / Warung & 3-Tier Price Selector */}
        <div className="bg-purple-950 text-white p-2.5 sm:p-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            {/* Pilih Pelanggan / Mitra Warung Button */}
            <button
              type="button"
              onClick={() => setIsCustomerPickerOpen(true)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-between sm:justify-start gap-2 transition-all cursor-pointer ${
                selectedCustomer
                  ? 'bg-amber-400 text-purple-950 border-amber-300 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-purple-200'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <User size={14} className="shrink-0" />
                <span className="font-extrabold max-w-[120px] sm:max-w-[150px] truncate">
                  {selectedCustomer ? selectedCustomer.name : 'Pilih Warung (F1)'}
                </span>
              </div>
              {selectedCustomer?.creditLimit ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 text-white font-mono shrink-0">
                  {Math.round(selectedCustomer.creditLimit / 1000)}k
                </span>
              ) : null}
            </button>

            {/* No WhatsApp / HP (Hidden on extra small mobile to save space) */}
            <div className="hidden md:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
              <Phone size={14} className="text-purple-200" />
              <input
                type="text"
                value={customerPhone || selectedCustomer?.phone || ''}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="No. Telp / WhatsApp..."
                className="bg-transparent border-none text-white text-xs placeholder:text-purple-300/70 focus:outline-none w-32"
              />
            </div>
          </div>

          {/* 3-Tier Pricing Selector Buttons */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl gap-0.5 sm:gap-1 shrink-0">
            <span className="hidden sm:flex text-[10px] uppercase font-bold text-purple-200 px-1.5 items-center gap-1">
              <Tag size={11} /> Harga:
            </span>
            {(['UMUM', 'MITRA', 'GROSIR'] as const).map(tier => {
              const isActive = priceTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => handleSwitchTier(tier)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-purple-950 shadow-md scale-105'
                      : 'text-purple-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tier === 'UMUM' && <Sparkles size={11} className="hidden sm:inline" />}
                  {tier === 'UMUM' ? 'Eceran' : tier === 'MITRA' ? 'Warung' : 'Partai'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar: Scanner & Search Input + Camera Button */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
          <form 
            onSubmit={handleSearchSubmit}
            className="flex-1 flex items-center gap-2 bg-purple-50/40 border-2 border-purple-300 rounded-xl px-3 py-2 focus-within:border-purple-600 focus-within:ring-4 focus-within:ring-purple-100 focus-within:bg-white transition shadow-inner cursor-text"
          >
            <Search size={18} className="text-purple-600 animate-pulse shrink-0" />
            <input
              ref={scannerInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="⚡ Scan barcode barang (auto-add) atau ketik nama sembako/rak..."
              className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-900 w-full placeholder:text-slate-400"
            />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-white shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              SCANNER SIAP
            </span>
            <span className="hidden md:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0" title="Tekan F2 untuk fokus scanner">
              F2
            </span>
            {searchQuery && (
              <button 
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  scannerInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
            title="Scan Barcode via Kamera Ponsel / Webcam"
          >
            <Camera size={16} />
            <span className="hidden sm:inline">Kamera Scan</span>
          </button>
        </div>

        {/* Quick Keyboard Shortcuts Bar */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[11px] overflow-x-auto shadow-xs border border-slate-800">
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1 shrink-0">
            <ClipboardList size={12} /> Shortcut Kasir:
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shrink-0">
            <b className="text-amber-300">F1</b> Cari/Scan Barcode
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shrink-0">
            <b className="text-amber-300">F2</b> Pilih Warung/Pelanggan
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shrink-0">
            <b className="text-amber-300">F4</b> Reset Keranjang
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shrink-0">
            <b className="text-amber-300">F9</b> Bayar Pas
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] bg-indigo-900 text-indigo-100 px-2 py-0.5 rounded border border-indigo-700 font-bold shrink-0">
            <b className="text-amber-300">F10 / Space</b> Bayar Lengkap
          </span>
        </div>

        {/* Category Chips Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              selectedCategoryId === 'ALL'
                ? 'bg-purple-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Semua Komoditas</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-black">
              {products.length}
            </span>
          </button>

          {categories.map(cat => {
            const countInCat = products.filter(p => p.categoryId === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Package size={14} className={isSelected ? 'text-white' : 'text-purple-600'} />
                <span>{cat.name}</span>
                <span className="text-[10px] opacity-75">({countInCat})</span>
              </button>
            );
          })}
        </div>

        {/* ─── CATALOG GRID CONTAINER (SCROLLABLE) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 ${cart.length > 0 ? 'pb-24' : 'pb-3'}`}>
            {filteredProducts.map(p => {
              const currentPrice = resolvePrice(p, undefined, priceTier);
              const isLowStock = p.stock <= (p.minStock ?? 5);
              const retail = Number(p.sellPriceRetail ?? p.sellPrice ?? 0);
              const mitra = p.sellPriceMitra != null ? Number(p.sellPriceMitra) : Math.round(retail * 0.96);
              const grosir = p.sellPriceGrosir != null ? Number(p.sellPriceGrosir) : Math.round(retail * 0.93);

              return (
                <div
                  key={`prod-${p.id}`}
                  onClick={() => handleAddProduct(p)}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-purple-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        p.stock === 0
                          ? 'bg-rose-100 text-rose-800'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Stok: {p.stock} {p.baseUom}
                      </span>
                      {p.barcode && (
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[80px]">
                          {p.barcode}
                        </span>
                      )}
                    </div>
                    
                    <div className="font-extrabold text-slate-800 text-xs sm:text-sm group-hover:text-purple-700 transition line-clamp-2">
                      {p.name}
                    </div>

                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                      <span className="truncate">{p.category?.name || 'Sembako & Ritel'}</span>
                      <span className="text-purple-700 font-mono text-[9px] bg-purple-50 px-1 py-0.2 rounded">
                        📍 {p.storageLocation || 'RAK-01'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="text-[10px] text-slate-400">
                      Harga ({priceTier === 'UMUM' ? 'Eceran' : priceTier === 'MITRA' ? 'Warung' : 'Partai'}):
                    </div>
                    
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm font-black text-purple-900">
                        Rp {currentPrice.toLocaleString('id-ID')}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">/{p.baseUom}</span>
                      </span>
                      <span className="p-1 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition">
                        <Plus size={14} />
                      </span>
                    </div>

                    {/* Quick UOM Conversion Badges */}
                    {p.productUoms && p.productUoms.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-dashed border-slate-100 flex-wrap">
                        {p.productUoms.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddProduct(p, u);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 hover:bg-purple-600 text-purple-900 hover:text-white border border-purple-200 transition-all cursor-pointer"
                            title={`1 ${u.unitName} = ${u.conversionRatio} ${p.baseUom} (Rp ${resolvePrice(p, u, priceTier).toLocaleString('id-ID')})`}
                          >
                            +{u.unitName} (Rp {(resolvePrice(p, u, priceTier) / 1000).toLocaleString('id-ID')}k)
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 3-Tier Price Comparison Breakdown */}
                    <div className="text-[9px] text-slate-400 mt-1 flex gap-1.5 truncate">
                      <span>Ecr: {Math.round(retail / 1000)}k</span>
                      <span>• Wrn: {Math.round(mitra / 1000)}k</span>
                      <span>• Gsr: {Math.round(grosir / 1000)}k</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
                <Package size={40} className="text-slate-300 mb-2" />
                <span className="font-bold text-slate-700 text-sm">
                  {searchQuery ? `Barang "${searchQuery}" tidak ditemukan` : 'Belum ada produk di kategori ini'}
                </span>
                <p className="text-slate-400 mt-1 max-w-sm">
                  Scan barcode lain atau periksa kembali filter kategori di atas.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── KANAN: SIDEBAR KERANJANG KASIR GROSIR (DESKTOP ONLY: W-80 / W-96) ─ */}
      <div className="pos-sidebar hidden lg:flex w-80 xl:w-96 flex-shrink-0 flex-col h-full bg-white border-l border-slate-200 shadow-sm">
        
        {/* Header Keranjang */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-purple-700" />
            <span className="font-extrabold text-slate-800 text-sm">Faktur Keranjang Grosir</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
              {totalQty} Item
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-[11px] text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Hapus
              </button>
            )}
          </div>
        </div>

        {/* Customer / Warung Mitra Snapshot Banner */}
        {selectedCustomer && (
          <div className="px-3.5 py-2 bg-purple-50 border-b border-purple-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-purple-950 font-bold truncate">
              <User size={14} className="text-purple-700 shrink-0" />
              <span>{selectedCustomer.name}</span>
              {selectedCustomer.phone && <span className="text-slate-500 font-medium">({selectedCustomer.phone})</span>}
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-purple-950 uppercase">
              {priceTier}
            </span>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-20">
              <ShoppingCart size={40} className="text-slate-200 mb-2" />
              <span className="font-bold text-slate-500">Keranjang kasir kosong</span>
              <span className="text-[11px] text-slate-400 mt-1">Scan barcode atau klik barang di sebelah kiri</span>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="pt-2 flex flex-col gap-1 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 line-clamp-1">{item.productName}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded font-black bg-purple-100 text-purple-900">
                        {item.uomName}
                      </span>
                      <span>@ Rp {item.price.toLocaleString('id-ID')}</span>
                      {item.uomRatio > 1 && (
                        <span className="text-[9px] text-slate-500 font-mono">({item.uomRatio} {item.baseUom})</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Subtotal Item */}
                  <div className="text-right">
                    <div className="font-extrabold text-amber-950 font-mono text-sm">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Qty Controls & UOM Dropdown */}
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                  {/* UOM Selector jika tersedia */}
                  {item.availableUoms && item.availableUoms.length > 0 ? (
                    <select
                      value={item.uomName}
                      onChange={(e) => handleSwitchCartUom(item.id, e.target.value)}
                      className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 cursor-pointer focus:outline-none"
                    >
                      <option value={item.baseUom}>{item.baseUom} (Base)</option>
                      {item.availableUoms.map(u => (
                        <option key={u.id} value={u.unitName}>{u.unitName} (isi {u.conversionRatio})</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.uomName}</span>
                  )}

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => setManualQty(item.id, parseInt(e.target.value, 10))}
                      className="w-12 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-0.5 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => updateQty(item.id, 1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center font-bold cursor-pointer ml-1"
                      title="Hapus item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ringkasan Pembayaran & Tombol Bayar */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Total Nilai Faktur:</span>
            <span className="font-mono font-bold text-slate-800">
              Rp {subtotal.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2">
            <span className="font-extrabold text-slate-900">TOTAL BAYAR:</span>
            <span className="font-mono font-black text-purple-950 text-xl">
              Rp {total.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleQuickCash}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                cart.length > 0
                  ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>⚡ Tunai Pas (F9)</span>
            </button>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                cart.length > 0
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white shadow-indigo-600/25 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <CreditCard size={15} />
              <span>Bayar / Bon (F10)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── FLOATING BOTTOM CART BAR (MOBILE ONLY) ─────────────────────────── */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom duration-200">
          <button 
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between pointer-events-auto active:scale-[0.98] transition-all cursor-pointer border border-purple-500/30"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/40 border border-purple-400/40 flex items-center justify-center font-black text-xs text-white">
                {totalQty}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">Faktur Keranjang</div>
                <div className="text-sm font-black font-mono">Rp {total.toLocaleString('id-ID')}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs shadow-sm">
              <span>Lihat &amp; Bayar</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </div>
      )}

      {/* ─── MOBILE CART DRAWER (BOTTOM SHEET) ─────────────────────────────── */}
      {isMobileCartOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in"
          onClick={() => setIsMobileCartOpen(false)}
        >
          <div 
            className="bg-white w-full rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Drawer */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-purple-50">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-purple-700" />
                <span className="font-extrabold text-slate-900 text-sm">Faktur Keranjang ({totalQty} Item)</span>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setIsMobileCartOpen(false);
                    }}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1 cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Customer Snapshot */}
            {selectedCustomer && (
              <div className="px-4 py-2 bg-purple-100/70 border-b border-purple-200 flex items-center justify-between text-xs">
                <span className="font-bold text-purple-950 truncate max-w-[200px]">
                  👤 {selectedCustomer.name}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-purple-950 uppercase">
                  {priceTier}
                </span>
              </div>
            )}

            {/* List Item Cart */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-2">
              {cart.map(item => (
                <div key={item.id} className="pt-2 flex flex-col gap-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 line-clamp-1">{item.productName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded font-black bg-purple-100 text-purple-900">
                          {item.uomName}
                        </span>
                        <span>@ Rp {item.price.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="font-extrabold text-purple-950 font-mono text-sm">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                    {item.availableUoms && item.availableUoms.length > 0 ? (
                      <select
                        value={item.uomName}
                        onChange={(e) => handleSwitchCartUom(item.id, e.target.value)}
                        className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700"
                      >
                        <option value={item.baseUom}>{item.baseUom}</option>
                        {item.availableUoms.map(u => (
                          <option key={u.id} value={u.unitName}>{u.unitName} (x{u.conversionRatio})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">{item.uomName}</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => setManualQty(item.id, parseInt(e.target.value, 10))}
                        className="w-12 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold ml-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Drawer with Payment Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between text-base">
                <span className="font-extrabold text-slate-900">TOTAL BAYAR:</span>
                <span className="font-mono font-black text-purple-950 text-xl">
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    handleQuickCash();
                  }}
                  className="py-3 px-3 rounded-xl text-xs font-bold bg-slate-800 text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>⚡ Tunai Pas</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="py-3 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  <CreditCard size={15} />
                  <span>Bayar / Bon</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALS ──────────────────────────────────────────────────────────── */}
      {/* 1. Modal Pemilih Pelanggan / Warung Langganan */}
      <RetailCustomerPicker
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(cust: CustomerData | null) => {
          setSelectedCustomer(cust);
          if (cust) {
            if (cust.phone) setCustomerPhone(cust.phone);
            if (cust.priceTier === 'GROSIR' || cust.priceTier === 'MITRA') {
              handleSwitchTier(cust.priceTier);
            }
          }
        }}
      />

      {/* 2. Modal Checkout & Bon Tempo / Delivery Order */}
      <RetailCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart.map((c, idx) => ({
          id: idx + 1,
          productId: c.productId,
          productName: c.productName,
          qty: c.qty,
          price: c.price,
          buyPrice: c.buyPrice,
          subtotal: c.subtotal,
          uomName: c.uomName,
          uomRatio: c.uomRatio,
          priceTierName: priceTier
        }))}
        subtotal={subtotal}
        discount={0}
        tax={0}
        total={total}
        customer={selectedCustomer}
        onSuccessCheckout={(result: any) => {
          setLastOrderResult(result);
          setShowReceipt(true);
          setCart([]);
          // ── Reset pelanggan & tier setelah transaksi selesai ──
          setSelectedCustomer(null);
          setCustomerPhone('');
          setPriceTier('UMUM');
          loadCatalogs();
        }}
      />

      {/* 3. Modal Struk Thermal Retail / Grosir 58/80mm */}
      {showReceipt && lastOrderResult && (
        <RetailReceiptPrinter
          order={lastOrderResult}
          autoPrint={true}
          onClose={() => {
            setShowReceipt(false);
            setLastOrderResult(null);
          }}
        />
      )}

      {/* 4. Barcode Scanner Camera Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onClose={() => setIsScannerOpen(false)}
          onDetected={(code: string) => {
            const clean = code.trim().toLowerCase();
            const matched = products.find(p => (p.barcode && p.barcode.toLowerCase() === clean) || String(p.id) === clean);
            if (matched) {
              handleAddProduct(matched);
              toast(`Berhasil scan: ${matched.name}`, 'success');
            } else {
              toast(`Barang tidak ditemukan untuk kode: ${code}`, 'error');
            }
            setIsScannerOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default POSRetail;
