import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Car, Wrench, Package, Search, ShoppingCart, User, Plus, Minus, Trash2, 
  CreditCard, Check, AlertCircle, Printer, ArrowRight, Camera, X, RefreshCw,
  Phone, Tag, Sparkles, ShieldCheck
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { WorkOrderReceiptPrinter } from './WorkOrderReceiptPrinter';
import { BengkelCheckoutModal } from './BengkelCheckoutModal';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import { initHardwareBarcodeListener, playScannerBeep } from '../../utils/hardwareBarcodeListener';
import { PartRequestModal } from './PartRequestModal';
import { ClipboardList } from 'lucide-react';

interface CartItem {
  type: 'SERVICE' | 'PART';
  id: string | number;
  productId?: number;
  serviceTypeId?: string;
  name: string;
  barcode?: string;
  qty: number;
  price: number;
  sellPriceRetail: number;
  sellPriceMitra: number;
  sellPriceGrosir: number;
  minQtyGrosir?: number;
  mechanicId?: number | null;
  mechanicName?: string;
}

export const POSBengkel: React.FC = () => {
  const { token, user } = usePOS();
  const navigate = useNavigate();

  // Active Transaction Details
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [priceTier, setPriceTier] = useState<'UMUM' | 'MITRA' | 'GROSIR'>('UMUM');
  const [vehicleType, setVehicleType] = useState<string>('MOTOR');

  // Catalogs
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | null>(null);

  // Active Catalog Tab & Filters (Data Barang as DEFAULT)
  const [activeCatalogTab, setActiveCatalogTab] = useState<'PARTS' | 'SERVICES'>('PARTS');
  const [selectedPartCategory, setSelectedPartCategory] = useState<string>('ALL');
  const [selectedVehicleTypeFilter, setSelectedVehicleTypeFilter] = useState<'ALL' | 'MOTOR' | 'MOBIL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Checkout & Payment Modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);

  // Part Request / Defecta Modal
  const [showPartRequestModal, setShowPartRequestModal] = useState<boolean>(false);
  const [partRequestInitialName, setPartRequestInitialName] = useState<string>('');
  const [partRequestInitialProductId, setPartRequestInitialProductId] = useState<number | null>(null);

  // Load Catalogs on Mount
  const loadCatalogs = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [srvRes, prdRes, mechRes] = await Promise.all([
        fetch('/api/bengkel/service-types', { headers }),
        fetch('/api/products', { headers }),
        fetch('/api/bengkel/mechanics', { headers })
      ]);

      if (srvRes.ok) {
        const sData = await srvRes.json();
        if (Array.isArray(sData)) setServices(sData);
      }

      if (prdRes.ok) {
        const pData = await prdRes.json();
        const prods = Array.isArray(pData) ? pData : pData.products || [];
        setProducts(prods);

        // Extract unique categories
        const catMap = new Map<string, any>();
        prods.forEach((p: any) => {
          if (p.category && p.category.name) {
            catMap.set(p.category.name, p.category);
          }
        });
        setCategories(Array.from(catMap.values()));
      }

      if (mechRes.ok) {
        const mData = await mechRes.json();
        if (Array.isArray(mData)) {
          setMechanics(mData);
          if (mData.length > 0) setSelectedMechanicId(mData[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load catalogs:', err);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, [token]);

  // Auto-focus barcode/search input by default on mount and when PARTS tab is active or products updated
  useEffect(() => {
    if (activeCatalogTab === 'PARTS') {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [activeCatalogTab, products.length]);

  // Global F2 keyboard shortcut to quickly jump focus to Barcode Scanner input anytime
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveCatalogTab('PARTS');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // Global Hardware Barcode Scanner Listener (Instant Auto-Add to Cart from any physical scanner)
  useEffect(() => {
    const unbind = initHardwareBarcodeListener({
      onScan: (scannedCode) => {
        const clean = scannedCode.trim().toLowerCase();
        const matched = products.find(
          p => (p.barcode && p.barcode.toLowerCase() === clean) ||
               (p.sku && p.sku.toLowerCase() === clean) ||
               String(p.id) === clean
        );

        if (matched) {
          setActiveCatalogTab('PARTS');
          handleAddProduct(matched);
          setSearchQuery('');
          playScannerBeep(true);
          toast(`⚡ [Barcode Scan] ${matched.name} langsung masuk keranjang!`, 'success');
          // Keep input focused for consecutive scans
          setTimeout(() => scannerInputRef.current?.focus(), 50);
        } else {
          playScannerBeep(false);
          toast(`❌ Barcode '${scannedCode}' tidak terdaftar pada katalog`, 'warning');
        }
      }
    });

    return () => unbind();
  }, [products, priceTier]);

  // Lookup Vehicle by Plate
  const handlePlateBlur = async () => {
    if (!vehiclePlate.trim() || !token) return;
    const clean = vehiclePlate.trim().toUpperCase();
    try {
      const res = await fetch(`/api/bengkel/vehicles/history/${encodeURIComponent(clean)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.vehicle && (data.vehicle.id || data.vehicle.brand || data.vehicle.customer || data.vehicle.plateNumber)) {
          if (data.vehicle.vehicleType) {
            setVehicleType(data.vehicle.vehicleType);
          }
          if (data.vehicle.customer) {
            if (data.vehicle.customer.name) {
              setCustomerName(prev => prev || data.vehicle.customer.name);
            }
            const rawPhone = data.vehicle.customer.phone || '';
            const cleanPhone = rawPhone.startsWith('WALKIN-') ? '' : rawPhone;
            if (cleanPhone) {
              setCustomerPhone(prev => prev || cleanPhone);
            }
            if (data.vehicle.customer.priceTier) {
              setPriceTier(prev => prev === 'UMUM' ? data.vehicle.customer.priceTier : prev);
            }
          }
          const infoText = data.vehicle.brand ? `${data.vehicle.brand} ${data.vehicle.model || ''}` : clean;
          toast(`Data ${clean} ditemukan: ${infoText}`, 'info');
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Helper: Resolve Price based on Tier & Qty
  const resolveItemPrice = (
    tier: 'UMUM' | 'MITRA' | 'GROSIR',
    retail: number,
    mitra: number | null | undefined,
    grosir: number | null | undefined,
    qty: number = 1,
    minGrosir: number = 1
  ): number => {
    if (tier === 'MITRA') return mitra ?? retail;
    if (tier === 'GROSIR') {
      if (!minGrosir || qty >= minGrosir) {
        return grosir ?? retail;
      }
      return retail;
    }
    return retail;
  };

  // Switch Tier & Recalculate Cart Real-Time
  const handleSwitchTier = (newTier: 'UMUM' | 'MITRA' | 'GROSIR') => {
    setPriceTier(newTier);
    setCartItems(prev => prev.map(item => {
      const newPrice = resolveItemPrice(
        newTier,
        item.sellPriceRetail,
        item.sellPriceMitra,
        item.sellPriceGrosir,
        item.qty,
        item.minQtyGrosir || 1
      );
      return { ...item, price: newPrice };
    }));
  };

  // Add Product (Sparepart) to Cart
  const handleAddProduct = (p: any) => {
    const retail = Number(p.sellPriceRetail ?? p.sellPrice ?? p.price ?? 0);
    const mitra = p.sellPriceMitra != null ? Number(p.sellPriceMitra) : retail;
    const grosir = p.sellPriceGrosir != null ? Number(p.sellPriceGrosir) : retail;

    setCartItems(prev => {
      const idx = prev.findIndex(item => item.type === 'PART' && item.productId === p.id);
      if (idx >= 0) {
        const updated = [...prev];
        const newQty = updated[idx].qty + 1;
        const newPrice = resolveItemPrice(priceTier, retail, mitra, grosir, newQty, p.minQtyGrosir || 1);
        updated[idx] = { ...updated[idx], qty: newQty, price: newPrice };
        return updated;
      }
      const initialPrice = resolveItemPrice(priceTier, retail, mitra, grosir, 1, p.minQtyGrosir || 1);
      return [...prev, {
        type: 'PART',
        id: `PART-${p.id}`,
        productId: p.id,
        name: p.name,
        barcode: p.barcode,
        qty: 1,
        price: initialPrice,
        sellPriceRetail: retail,
        sellPriceMitra: mitra,
        sellPriceGrosir: grosir,
        minQtyGrosir: p.minQtyGrosir || 1
      }];
    });

    // Re-focus scanner input for rapid continuous scanning
    if (activeCatalogTab === 'PARTS') {
      setTimeout(() => scannerInputRef.current?.focus(), 50);
    }
  };

  // Add Service to Cart
  const handleAddService = (s: any) => {
    const retail = Number(s.priceRetail || 0);
    const mitra = s.priceMitra != null ? Number(s.priceMitra) : retail;
    const grosir = s.priceGrosir != null ? Number(s.priceGrosir) : retail;
    const mech = mechanics.find(m => m.id === selectedMechanicId);

    setCartItems(prev => {
      const idx = prev.findIndex(item => item.type === 'SERVICE' && item.serviceTypeId === s.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      const initialPrice = resolveItemPrice(priceTier, retail, mitra, grosir, 1, 1);
      return [...prev, {
        type: 'SERVICE',
        id: `SRV-${s.id}`,
        serviceTypeId: s.id,
        name: s.name,
        qty: 1,
        price: initialPrice,
        sellPriceRetail: retail,
        sellPriceMitra: mitra,
        sellPriceGrosir: grosir,
        mechanicId: selectedMechanicId,
        mechanicName: mech ? mech.name : undefined
      }];
    });
  };

  // Barcode / Scanner Modal Match
  const handleBarcodeDetected = (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const matched = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
           (p.sku && p.sku.toLowerCase() === cleanCode) ||
           String(p.id).toLowerCase() === cleanCode
    );
    if (matched) {
      setActiveCatalogTab('PARTS');
      handleAddProduct(matched);
      setSearchQuery('');
      playScannerBeep(true);
      toast(`⚡ [Kamera Scan] ${matched.name} langsung masuk keranjang!`, 'success');
      setTimeout(() => scannerInputRef.current?.focus(), 50);
    } else {
      playScannerBeep(false);
      toast(`Produk dengan barcode '${code}' tidak ditemukan`, 'warning');
    }
    setIsScannerOpen(false);
  };

  // Instant Check on Input Change (Auto-Add as soon as exact barcode/SKU/code is matched)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    const clean = val.trim().toLowerCase();
    if (!clean || activeCatalogTab !== 'PARTS') return;

    // 1. Instant match by exact Barcode, SKU, or numeric Product ID
    const exactCodeMatch = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === clean) ||
           (p.sku && p.sku.toLowerCase() === clean) ||
           String(p.id).toLowerCase() === clean
    );

    if (exactCodeMatch) {
      handleAddProduct(exactCodeMatch);
      setSearchQuery('');
      playScannerBeep(true);
      toast(`⚡ [Scan Cepat] ${exactCodeMatch.name} langsung masuk keranjang!`, 'success');
      setTimeout(() => scannerInputRef.current?.focus(), 50);
      return;
    }

    // 2. If user typed or pasted exact product name (case-insensitive)
    const exactNameMatch = products.find(
      p => p.name.trim().toLowerCase() === clean
    );
    if (exactNameMatch) {
      handleAddProduct(exactNameMatch);
      setSearchQuery('');
      playScannerBeep(true);
      toast(`⚡ ${exactNameMatch.name} langsung masuk keranjang!`, 'success');
      setTimeout(() => scannerInputRef.current?.focus(), 50);
      return;
    }
  };

  // Handle Search Input KeyDown (Enter to Fast-Add)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      // 1. Exact Barcode, SKU, or ID Match
      const matched = products.find(
        p => (p.barcode && p.barcode.toLowerCase() === q) ||
             (p.sku && p.sku.toLowerCase() === q) ||
             String(p.id).toLowerCase() === q
      );
      if (matched) {
        handleAddProduct(matched);
        setSearchQuery('');
        playScannerBeep(true);
        toast(`⚡ [Barcode Scan] ${matched.name} langsung masuk keranjang!`, 'success');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
        return;
      }

      // 2. Exact Name Match
      const nameMatch = products.find(p => p.name.trim().toLowerCase() === q);
      if (nameMatch) {
        handleAddProduct(nameMatch);
        setSearchQuery('');
        playScannerBeep(true);
        toast(`⚡ ${nameMatch.name} langsung masuk keranjang!`, 'success');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
        return;
      }

      // 3. Match in filtered products (topmost item on Enter)
      if (filteredProducts.length > 0) {
        const topProduct = filteredProducts[0];
        handleAddProduct(topProduct);
        setSearchQuery('');
        playScannerBeep(true);
        toast(`⚡ ${topProduct.name} langsung masuk keranjang!`, 'success');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
        return;
      }

      // 4. Not found
      playScannerBeep(false);
      toast(`❌ Produk '${searchQuery}' tidak ditemukan`, 'warning');
    }
  };

  // Update Qty in Cart
  const updateCartQty = (idx: number, delta: number) => {
    setCartItems(prev => {
      const item = prev[idx];
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      const updated = [...prev];
      const newPrice = resolveItemPrice(
        priceTier,
        item.sellPriceRetail,
        item.sellPriceMitra,
        item.sellPriceGrosir,
        newQty,
        item.minQtyGrosir || 1
      );
      updated[idx] = { ...item, qty: newQty, price: newPrice };
      return updated;
    });
  };

  // Financial Calculations
  const servicesSubtotal = cartItems.filter(i => i.type === 'SERVICE').reduce((sum, i) => sum + (i.price * i.qty), 0);
  const partsSubtotal = cartItems.filter(i => i.type === 'PART').reduce((sum, i) => sum + (i.price * i.qty), 0);
  const grossTotal = servicesSubtotal + partsSubtotal;

  // Submit WorkOrder to Antrean (PENDING)
  const handleQueueSPK = async () => {
    if (cartItems.length === 0) {
      toast('Keranjang masih kosong!', 'warning');
      return;
    }
    const cleanPlate = vehiclePlate.trim().toUpperCase() || 'UMUM';
    const cleanName = customerName.trim() || 'Konsumen Walk-In';
    const cleanPhone = customerPhone.trim() || undefined;

    setLoading(true);
    try {
      const payload = {
        vehiclePlate: cleanPlate,
        customerName: cleanName,
        customerPhone: cleanPhone,
        priceTier,
        vehicleType,
        services: cartItems.filter(i => i.type === 'SERVICE').map(s => ({
          serviceTypeId: s.serviceTypeId,
          serviceName: s.name,
          vehicleType,
          price: s.price,
          qty: s.qty,
          mechanicId: s.mechanicId
        })),
        parts: cartItems.filter(i => i.type === 'PART').map(p => ({
          productId: p.productId,
          partName: p.name,
          price: p.price,
          qty: p.qty
        }))
      };

      const res = await fetch('/api/bengkel/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        toast(`✅ SPK ${created.spkNumber} (${cleanPlate} - ${cleanName}) berhasil masuk ke Papan Status Antrean!`, 'success');
        setCartItems([]);
        setVehiclePlate('');
        setCustomerName('');
        setCustomerPhone('');
        navigate('/bengkel/board');
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal membuat SPK', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open current cart & customer data directly in full WorkOrderForm
  const handleOpenInSPKForm = () => {
    navigate('/bengkel/spk/new', {
      state: {
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        priceTier,
        vehicleType,
        cartItems
      }
    });
  };

  // Filter Catalog Items (Strictly Separated between Sparepart & Jasa)
  const filteredProducts = activeCatalogTab === 'PARTS'
    ? products.filter(p => {
        if (selectedPartCategory !== 'ALL' && p.category?.name !== selectedPartCategory) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
      })
    : [];

  const filteredServices = activeCatalogTab === 'SERVICES'
    ? services.filter(s => {
        if (selectedVehicleTypeFilter !== 'ALL' && s.vehicleType !== 'ALL' && s.vehicleType !== selectedVehicleTypeFilter) return false;
        if (!searchQuery) return true;
        return s.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : [];

  return (
    <div className="pos-layout h-full w-full overflow-hidden" style={{ height: '100%' }}>
      {/* ─── KIRI: KATALOG SPAREPART & JASA SERVIS (FLEX-1) ─────────────────── */}
      <div className="pos-main flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-4 gap-3 bg-slate-100">
        
        {/* Top Quick Bar: Plat Nomor, Konsumen, & 3-Tier Price Selector */}
        <div className="bg-purple-950 text-white p-2.5 sm:p-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-1">
            {/* Plat Nomor */}
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20">
              <Car size={15} className="text-amber-300 shrink-0" />
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                onBlur={handlePlateBlur}
                placeholder="NOPOL (B 1234 ABC)"
                className="bg-transparent border-none text-white font-black text-xs uppercase tracking-wider placeholder:text-purple-300/70 focus:outline-none w-28 sm:w-36"
              />
            </div>

            {/* Nama Pelanggan */}
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20">
              <User size={15} className="text-purple-200 shrink-0" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Konsumen..."
                className="bg-transparent border-none text-white text-xs placeholder:text-purple-300/70 focus:outline-none w-24 sm:w-32"
              />
            </div>

            {/* No HP */}
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20">
              <Phone size={14} className="text-purple-200 shrink-0" />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="WhatsApp (08...)"
                className="bg-transparent border-none text-white text-xs placeholder:text-purple-300/70 focus:outline-none w-24 sm:w-28"
              />
            </div>
          </div>

          {/* 3-Tier Pricing Selector Buttons */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl gap-0.5 sm:gap-1 shrink-0">
            <span className="hidden sm:flex text-[10px] uppercase font-bold text-purple-200 px-1.5 items-center gap-1">
              <Tag size={11} /> Tier:
            </span>
            {(['UMUM', 'MITRA', 'GROSIR'] as const).map(tier => {
              const isActive = priceTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => handleSwitchTier(tier)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-purple-950 shadow-md scale-105'
                      : 'text-purple-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tier === 'UMUM' && <Sparkles size={11} className="hidden sm:inline" />}
                  {tier}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── TAB UTAMA: DATA BARANG (DEFAULT) VS JASA SERVIS ─────────────── */}
        <div className="flex bg-slate-200/90 p-1.5 rounded-2xl gap-1.5 shrink-0 border border-slate-300/80 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setActiveCatalogTab('PARTS');
              setSearchQuery('');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeCatalogTab === 'PARTS'
                ? 'bg-purple-900 text-white shadow-md scale-[1.01]'
                : 'text-slate-600 hover:text-purple-950 hover:bg-white/60'
            }`}
          >
            <Package size={17} className={activeCatalogTab === 'PARTS' ? 'text-amber-400' : 'text-slate-500'} />
            <span>Data Barang & Sparepart</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeCatalogTab === 'PARTS' ? 'bg-amber-400 text-purple-950' : 'bg-slate-300 text-slate-700'
            }`}>
              {products.length} Item
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCatalogTab('SERVICES');
              setSearchQuery('');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeCatalogTab === 'SERVICES'
                ? 'bg-purple-900 text-white shadow-md scale-[1.01]'
                : 'text-slate-600 hover:text-purple-950 hover:bg-white/60'
            }`}
          >
            <Wrench size={17} className={activeCatalogTab === 'SERVICES' ? 'text-amber-400' : 'text-slate-500'} />
            <span>Jasa Servis Mekanik</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeCatalogTab === 'SERVICES' ? 'bg-amber-400 text-purple-950' : 'bg-slate-300 text-slate-700'
            }`}>
              {services.length} Jasa
            </span>
          </button>
        </div>

        {/* ─── KONTROL TAB DATA BARANG (SPAREPART) ─────────────────────────────── */}
        {activeCatalogTab === 'PARTS' && (
          <div className="space-y-2">
            {/* Toolbar: Scanner & Search Input + Camera Button */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
              <div 
                onClick={() => scannerInputRef.current?.focus()}
                className="flex-1 flex items-center gap-2 bg-purple-50/40 border-2 border-purple-300 rounded-xl px-3 py-2 focus-within:border-purple-600 focus-within:ring-4 focus-within:ring-purple-100 focus-within:bg-white transition shadow-inner cursor-text"
              >
                <Search size={18} className="text-purple-600 animate-pulse shrink-0" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="⚡ Scan barcode suku cadang (auto-add) atau ketik nama barang..."
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
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setSearchQuery(''); 
                      scannerInputRef.current?.focus(); 
                    }} 
                    className="text-slate-400 hover:text-slate-600 shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
                title="Scan Barcode via Kamera Ponsel / Webcam"
              >
                <Camera size={16} />
                <span className="hidden sm:inline">Kamera Scan</span>
              </button>
            </div>

            {/* Category Chips Filter (Khusus Sparepart) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedPartCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  selectedPartCategory === 'ALL'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Semua Sparepart</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                  {products.length}
                </span>
              </button>

              {categories.map(cat => {
                const countInCat = products.filter(p => p.category?.name === cat.name).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedPartCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                      selectedPartCategory === cat.name
                        ? 'bg-purple-700 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Package size={14} className="text-purple-600" />
                    <span>{cat.name}</span>
                    <span className="text-[10px] opacity-75">({countInCat})</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setPartRequestInitialName(searchQuery);
                  setPartRequestInitialProductId(null);
                  setShowPartRequestModal(true);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 cursor-pointer ml-auto"
                title="Catat barang yang dicari konsumen tapi tidak ada di toko"
              >
                <ClipboardList size={13} className="text-amber-700" />
                <span>+ Catat Barang Kosong</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── KONTROL TAB JASA SERVIS (MEKANIK) ───────────────────────────────── */}
        {activeCatalogTab === 'SERVICES' && (
          <div className="space-y-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Jasa */}
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200 transition">
                <Search size={18} className="text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama layanan servis / perbaikan bengkel..."
                  className="bg-transparent border-none outline-none text-xs font-medium text-slate-800 w-full placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Selector Mekanik Penanggung Jawab */}
              {mechanics.length > 0 && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl shrink-0">
                  <Wrench size={14} className="text-purple-700" />
                  <span className="text-xs font-bold text-purple-950">Mekanik:</span>
                  <select
                    value={selectedMechanicId || ''}
                    onChange={(e) => setSelectedMechanicId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs font-black text-purple-900 focus:outline-none cursor-pointer"
                  >
                    {mechanics.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({Math.round(m.commissionRate <= 1 ? m.commissionRate * 100 : m.commissionRate)}% komisi)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Filter Jenis Kendaraan untuk Jasa */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(['ALL', 'MOTOR', 'MOBIL'] as const).map(vt => {
                const isActive = selectedVehicleTypeFilter === vt;
                const label = vt === 'ALL' ? 'Semua Jasa Servis' : vt === 'MOTOR' ? '🛵 Khusus Motor' : '🚗 Khusus Mobil';
                const count = vt === 'ALL' 
                  ? services.length 
                  : services.filter(s => s.vehicleType === vt || s.vehicleType === 'ALL').length;

                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => setSelectedVehicleTypeFilter(vt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-purple-700 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── CATALOG GRID CONTAINER (SCROLLABLE) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 ${cartItems.length > 0 ? 'pb-24' : 'pb-3'}`}>
            
            {/* Services Cards */}
            {filteredServices.map(s => {
              const currentPrice = resolveItemPrice(
                priceTier,
                Number(s.priceRetail || 0),
                s.priceMitra,
                s.priceGrosir
              );

              return (
                <div
                  key={`srv-${s.id}`}
                  onClick={() => handleAddService(s)}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-purple-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                        {s.vehicleType === 'MOBIL' ? '🚗 MOBIL' : '🛵 MOTOR'}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        JASA
                      </span>
                    </div>
                    <div className="font-extrabold text-slate-800 text-xs sm:text-sm group-hover:text-purple-700 transition line-clamp-2">
                      {s.name}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="text-[10px] text-slate-400">
                      Tarif ({priceTier}):
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm font-black text-purple-900">
                        Rp {currentPrice.toLocaleString('id-ID')}
                      </span>
                      <span className="p-1 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition">
                        <Plus size={14} />
                      </span>
                    </div>
                    {/* Price Breakdown Details */}
                    <div className="text-[9px] text-slate-400 mt-1 flex gap-1.5 truncate">
                      <span>Rtl: {(s.priceRetail || 0) / 1000}k</span>
                      <span>• Mtr: {(s.priceMitra || s.priceRetail || 0) / 1000}k</span>
                      <span>• Gsr: {(s.priceGrosir || s.priceRetail || 0) / 1000}k</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Products (Spareparts & Oli) Cards */}
            {filteredProducts.map(p => {
              const retail = Number(p.sellPriceRetail ?? p.sellPrice ?? p.price ?? 0);
              const mitra = p.sellPriceMitra != null ? Number(p.sellPriceMitra) : retail;
              const grosir = p.sellPriceGrosir != null ? Number(p.sellPriceGrosir) : retail;
              const currentPrice = resolveItemPrice(priceTier, retail, mitra, grosir, 1, p.minQtyGrosir || 1);
              const isLowStock = p.stock <= (p.minStock ?? 5);

              return (
                <div
                  key={`part-${p.id}`}
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
                        Stok: {p.stock}
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
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {p.category?.name || 'Sparepart'}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="text-[10px] text-slate-400">
                      Harga ({priceTier}):
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm font-black text-purple-900">
                        Rp {currentPrice.toLocaleString('id-ID')}
                      </span>
                      <span className="p-1 rounded-lg bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-white transition">
                        <Plus size={14} />
                      </span>
                    </div>
                    {/* 3-Tier Price Comparison Breakdown */}
                    <div className="text-[9px] text-slate-400 mt-1 flex gap-1.5 truncate">
                      <span>Rtl: {retail / 1000}k</span>
                      <span>• Mtr: {mitra / 1000}k</span>
                      <span>• Gsr: {grosir / 1000}k (min {p.minQtyGrosir || 1})</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredServices.length === 0 && filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
                <Package size={40} className="text-slate-300 mb-2" />
                <span className="font-bold text-slate-700 text-sm">
                  {searchQuery ? `Barang "${searchQuery}" tidak ditemukan` : 'Tidak ada data barang yang cocok'}
                </span>
                <p className="text-slate-400 mt-1 max-w-sm">
                  Apakah konsumen mencari suku cadang yang saat ini belum ada atau kosong?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPartRequestInitialName(searchQuery);
                    setPartRequestInitialProductId(null);
                    setShowPartRequestModal(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <ClipboardList size={16} />
                  <span>Catat Permintaan Suku Cadang</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── KANAN: SIDEBAR KERANJANG KASIR BENGKEL (DESKTOP ONLY: 380PX) ───── */}
      <div className="pos-sidebar hidden lg:flex w-80 xl:w-96 flex-shrink-0 flex-col h-full bg-white border-l border-slate-200 shadow-sm">
        
        {/* Header Keranjang */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-purple-700" />
            <span className="font-extrabold text-slate-800 text-sm">Keranjang Kasir Bengkel</span>
          </div>
          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
            {cartItems.reduce((sum, i) => sum + i.qty, 0)} Item
          </span>
        </div>

        {/* Customer & Plate Snapshot Banner */}
        {(vehiclePlate || customerName) && (
          <div className="px-3.5 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-purple-900 font-bold truncate">
              <Car size={14} className="text-purple-700 shrink-0" />
              <span>{vehiclePlate || 'Walk-In'}</span>
              {customerName && <span className="text-slate-500 font-medium">({customerName})</span>}
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-300 text-purple-950 uppercase">
              {priceTier}
            </span>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-20">
              <ShoppingCart size={40} className="text-slate-200 mb-2" />
              <span className="font-bold text-slate-500">Keranjang masih kosong</span>
              <span className="text-[11px] text-slate-400 mt-1">Pilih jasa atau scan sparepart di sebelah kiri</span>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div key={item.id} className="pt-2 flex flex-col gap-1 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded font-black ${
                        item.type === 'SERVICE' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.type === 'SERVICE' ? 'Jasa' : 'Part'}
                      </span>
                      <span>@ Rp {item.price.toLocaleString('id-ID')}</span>
                      {item.mechanicName && (
                        <span className="text-purple-600 font-semibold">• {item.mechanicName}</span>
                      )}
                    </div>
                  </div>

                  <div className="font-black text-slate-900 text-right">
                    Rp {(item.qty * item.price).toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => updateCartQty(idx, -1)}
                      className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 transition"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="font-black text-xs px-2 text-slate-800">{item.qty}</span>
                    <button
                      onClick={() => updateCartQty(idx, 1)}
                      className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 transition"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <button
                    onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                    className="text-rose-400 hover:text-rose-600 p-1 transition"
                    title="Hapus dari keranjang"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Cart Summary & Action Buttons */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal Jasa:</span>
              <span className="font-semibold text-slate-700">Rp {servicesSubtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Subtotal Sparepart:</span>
              <span className="font-semibold text-slate-700">Rp {partsSubtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Tagihan ({priceTier})</div>
                <div className="text-xl font-black text-purple-950">
                  Rp {grossTotal.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleQueueSPK}
              disabled={loading || cartItems.length === 0}
              className="py-2.5 px-3 rounded-xl border border-purple-300 bg-white hover:bg-purple-50 text-purple-900 font-bold text-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Masuk Antrean SPK
            </button>
            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              disabled={loading || cartItems.length === 0}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black text-xs shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard size={14} />
              Bayar Kasir
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenInSPKForm}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:border-purple-300 bg-white hover:bg-purple-50/50 text-slate-700 hover:text-purple-900 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ClipboardList size={14} className="text-purple-600" />
            <span>Buka / Edit di Form SPK Lengkap</span>
          </button>
        </div>
      </div>

      {/* ─── FLOATING BOTTOM SPK BAR (MOBILE ONLY) ───────────────────────────── */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 z-30 pointer-events-none animate-in fade-in slide-in-from-bottom duration-200">
          <button 
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between pointer-events-auto active:scale-[0.98] transition-all cursor-pointer border border-purple-500/30"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/40 border border-purple-400/40 flex items-center justify-center font-black text-xs text-white">
                {cartItems.reduce((sum, i) => sum + i.qty, 0)}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>{vehiclePlate || 'SPK BENGKEL'}</span>
                </div>
                <div className="text-sm font-black font-mono">Rp {grossTotal.toLocaleString('id-ID')}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs shadow-sm">
              <span>Lihat SPK &amp; Bayar</span>
              <ArrowRight size={14} />
            </div>
          </button>
        </div>
      )}

      {/* ─── MOBILE SPK DRAWER (BOTTOM SHEET) ───────────────────────────────── */}
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
                <Car size={18} className="text-purple-700" />
                <span className="font-extrabold text-slate-900 text-sm">
                  SPK: {vehiclePlate || 'Walk-In'} ({cartItems.reduce((sum, i) => sum + i.qty, 0)} Item)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCartItems([]);
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

            {/* Mobile Customer & Vehicle Inputs Bar */}
            <div className="p-3 bg-purple-950 text-white flex flex-col gap-2 border-b border-purple-900">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20">
                  <Car size={14} className="text-amber-300 shrink-0" />
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    onBlur={handlePlateBlur}
                    placeholder="NOPOL (B 1234 ABC)"
                    className="bg-transparent border-none text-white font-black text-xs uppercase tracking-wider placeholder:text-purple-300/70 focus:outline-none w-full"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20">
                  <User size={14} className="text-purple-200 shrink-0" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama Konsumen..."
                    className="bg-transparent border-none text-white text-xs placeholder:text-purple-300/70 focus:outline-none w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20">
                <Phone size={14} className="text-purple-200 shrink-0" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="WhatsApp Konsumen (08...)"
                  className="bg-transparent border-none text-white text-xs placeholder:text-purple-300/70 focus:outline-none w-full"
                />
              </div>
            </div>

            {/* List Item SPK */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-2">
              {cartItems.map((item, idx) => (
                <div key={item.id} className="pt-2 flex flex-col gap-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded font-black ${
                          item.type === 'SERVICE' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.type === 'SERVICE' ? 'Jasa' : 'Part'}
                        </span>
                        <span>@ Rp {item.price.toLocaleString('id-ID')}</span>
                        {item.mechanicName && (
                          <span className="text-purple-600 font-semibold">• {item.mechanicName}</span>
                        )}
                      </div>
                    </div>
                    <div className="font-extrabold text-slate-900 font-mono text-sm">
                      Rp {(item.qty * item.price).toLocaleString('id-ID')}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        onClick={() => updateCartQty(idx, -1)}
                        className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="font-black text-xs px-2 text-slate-800">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(idx, 1)}
                        className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                      className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold ml-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Drawer SPK */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between text-base">
                <span className="font-extrabold text-slate-900">TOTAL ESTIMASI:</span>
                <span className="font-mono font-black text-purple-950 text-xl">
                  Rp {grossTotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    handleQueueSPK();
                  }}
                  className="py-3 px-3 rounded-xl border border-purple-300 bg-white text-purple-900 font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  Masuk Antrean
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setIsCheckoutModalOpen(true);
                  }}
                  className="py-3 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <CreditCard size={15} />
                  <span>Bayar Kasir</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleOpenInSPKForm();
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ClipboardList size={14} className="text-purple-600" />
                <span>Buka / Edit di Form SPK Lengkap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CAMERA BARCODE SCANNER ───────────────────────────────────── */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onDetected={handleBarcodeDetected}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* ─── MODAL: CHECKOUT & PEMBAYARAN KASIR MULTI-METODE (PERSIS GAMBAR 2) ─── */}
      <BengkelCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setTimeout(() => scannerInputRef.current?.focus(), 50);
        }}
        onSuccess={(completed) => {
          setIsCheckoutModalOpen(false);
          setCompletedOrder(completed);
          setShowReceipt(true);
          setCartItems([]);
          setVehiclePlate('');
          setCustomerName('');
          setCustomerPhone('');
        }}
        subtotal={grossTotal}
        cartItems={cartItems}
        vehiclePlate={vehiclePlate}
        customerName={customerName}
        customerPhone={customerPhone}
        priceTier={priceTier}
        vehicleType={vehicleType as any}
        token={token}
      />

      {/* ─── MODAL: CETAK STRUK THERMAL 58MM/80MM SETELAH LUNAS ─────────────── */}
      {showReceipt && completedOrder && (
        <WorkOrderReceiptPrinter
          workOrder={completedOrder}
          autoPrint={true}
          onClose={() => {
            setShowReceipt(false);
            setCompletedOrder(null);
            setTimeout(() => scannerInputRef.current?.focus(), 50);
          }}
        />
      )}
      {/* Modal Catat Permintaan Barang Kosong */}
      <PartRequestModal
        isOpen={showPartRequestModal}
        onClose={() => setShowPartRequestModal(false)}
        initialPartName={partRequestInitialName}
        initialProductId={partRequestInitialProductId}
      />
    </div>
  );
};

export default POSBengkel;
