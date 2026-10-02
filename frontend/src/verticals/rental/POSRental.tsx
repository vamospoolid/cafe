import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  CreditCard, 
  Wallet, 
  ArrowRight, 
  User, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  Tag, 
  Clock, 
  Check, 
  X, 
  Layers, 
  Scissors, 
  Camera, 
  Shirt, 
  AlertTriangle, 
  Info, 
  DollarSign, 
  FileText, 
  BadgeCheck, 
  ChevronDown, 
  ChevronUp,
  RefreshCw, 
  Sparkle,
  SlidersHorizontal,
  RotateCcw,
  CheckSquare,
  Square,
  ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { RentalReceiptPrinter } from './RentalReceiptPrinter';
import { RentalCheckoutModal } from './RentalCheckoutModal';
import { AddAttireModal } from './AddAttireModal';

// ─── MASTER PRESET BUSANA & AKSESORIS ─────────────────────────────────────────
interface AttirePreset {
  id: string;
  name: string;
  code: string;
  category: 'MODERN' | 'LABU' | 'PENGANTIN' | 'KLASIK' | 'PRIA' | 'ANAK';
  color: string;
  size: string;
  price: number;
  rackHangerCode: string;
  imageUrl?: string;
  defaultAccessories: string[];
  accessoryPrices?: Record<string, number>; // nama aksesori → harga extra (0 = gratis/termasuk)
  availableStock?: number;
  totalStock?: number;
}

interface CartItem extends AttirePreset {
  selectedAccessories: string[];
  permakNote?: string;
  qty: number; // jumlah set yang disewa
}

const DEFAULT_ATTIRES: AttirePreset[] = [
  {
    id: 'att-1',
    name: 'Baju Bodo Modern Organza Payet',
    code: 'BBM-ORG-MRH-M-01',
    category: 'MODERN',
    color: 'Merah Marun',
    size: 'M',
    price: 250000,
    rackHangerCode: 'Hanger A-01',
    defaultAccessories: ['Saloko Mahkota', 'Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe'],
    accessoryPrices: { 'Saloko Mahkota': 25000, 'Kalung Beranak': 15000 }
  },
  {
    id: 'att-2',
    name: 'Baju Bodo Modern Organza Payet',
    code: 'BBM-ORG-SGE-L-02',
    category: 'MODERN',
    color: 'Sage Green',
    size: 'L',
    price: 250000,
    rackHangerCode: 'Hanger A-02',
    defaultAccessories: ['Saloko Mahkota', 'Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe']
  },
  {
    id: 'att-3',
    name: 'Baju Bodo Modern Organza Payet',
    code: 'BBM-ORG-LLC-S-03',
    category: 'MODERN',
    color: 'Lilac Pastel',
    size: 'S',
    price: 250000,
    rackHangerCode: 'Hanger A-03',
    defaultAccessories: ['Saloko Mahkota', 'Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe']
  },
  {
    id: 'att-4',
    name: 'Baju La\'bu Sutra Hijab Friendly',
    code: 'BBL-STR-HJU-M-01',
    category: 'LABU',
    color: 'Hijau Botol',
    size: 'M',
    price: 300000,
    rackHangerCode: 'Hanger B-01',
    defaultAccessories: ['Bando Emas Hijab', 'Kalung Beranak', '2x Gelang Ponto', 'Pending Ikat Pinggang', 'Lipa Sabbe Sutra']
  },
  {
    id: 'att-5',
    name: 'Baju La\'bu Sutra Hijab Friendly',
    code: 'BBL-STR-MRH-XL-02',
    category: 'LABU',
    color: 'Merah Darah',
    size: 'XL',
    price: 300000,
    rackHangerCode: 'Hanger B-02',
    defaultAccessories: ['Bando Emas Hijab', 'Kalung Beranak', '2x Gelang Ponto', 'Pending Ikat Pinggang', 'Lipa Sabbe Sutra']
  },
  {
    id: 'att-6',
    name: 'Baju Bodo Pengantin Adat Full Mutiara',
    code: 'BBP-PYT-GLD-L-01',
    category: 'PENGANTIN',
    color: 'Gold Emas',
    size: 'L',
    price: 850000,
    rackHangerCode: 'Hanger VIP-01',
    defaultAccessories: ['Saloko Akbar Emas', 'Bando Pengantin', 'Kalung Beranak 3 Susun', '2x Gelang Ponto Naga', 'Pending Emas', 'Sumpit Hias', 'Lipa Sabbe Antik']
  },
  {
    id: 'att-7',
    name: 'Baju Bodo Pengantin Putih Suci',
    code: 'BBP-PYT-PTH-M-02',
    category: 'PENGANTIN',
    color: 'Putih Silver',
    size: 'M',
    price: 850000,
    rackHangerCode: 'Hanger VIP-02',
    defaultAccessories: ['Saloko Akbar Perak', 'Bando Perak', 'Kalung Beranak Silver', '2x Gelang Ponto Silver', 'Pending Silver', 'Lipa Sabbe']
  },
  {
    id: 'att-8',
    name: 'Baju Bodo Klasik Tradisional Kasa',
    code: 'BBK-KSA-KNG-S-01',
    category: 'KLASIK',
    color: 'Kuning Kunyit',
    size: 'S',
    price: 200000,
    rackHangerCode: 'Hanger C-01',
    defaultAccessories: ['Bando Bunga Tradisional', 'Kalung Manik', 'Gelang Keroncong', 'Sarung Tokko']
  },
  {
    id: 'att-9',
    name: 'Set Jas Tutup Pria Sutra Pabiring',
    code: 'JTP-STR-HTM-L-01',
    category: 'PRIA',
    color: 'Hitam Emas',
    size: 'L',
    price: 200000,
    rackHangerCode: 'Hanger P-01',
    defaultAccessories: ['Songkok Recca Emas', 'Tataroppeng Keris', 'Rantai Sumping Emas', 'Lipa Sabbe Pria']
  },
  {
    id: 'att-10',
    name: 'Set Jas Tutup Pria Sutra Pabiring',
    code: 'JTP-STR-MRH-XL-02',
    category: 'PRIA',
    color: 'Merah Marun',
    size: 'XL',
    price: 200000,
    rackHangerCode: 'Hanger P-02',
    defaultAccessories: ['Songkok Recca Emas', 'Tataroppeng Keris', 'Rantai Sumping Emas', 'Lipa Sabbe Pria']
  },
  {
    id: 'att-11',
    name: 'Set Baju Bodo Cilik (Anak Pawai/Karnaval)',
    code: 'BBA-STN-PNK-JR-01',
    category: 'ANAK',
    color: 'Pink Fanta',
    size: 'Junior',
    price: 100000,
    rackHangerCode: 'Hanger K-01',
    defaultAccessories: ['Bando Anak', 'Kalung Anak', 'Gelang Karet', 'Sarung Anak']
  }
];

const COLOR_SWATCHES: Record<string, string> = {
  'merah marun': '#800000',
  'sage green': '#9CAF88',
  'lilac pastel': '#C8A2C8',
  'hijau botol': '#004225',
  'merah darah': '#D00000',
  'gold emas': '#D4AF37',
  'putih silver': '#E8ECEF',
  'kuning kunyit': '#E4A010',
  'hitam emas': '#1C1917',
  'pink fanta': '#FF1493',
  'biru sapphire': '#0F52BA',
  'emerald green': '#046307'
};

export const POSRental: React.FC = () => {
  const { token, user, settings } = usePOS();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter Catalog State
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [onlyReady, setOnlyReady] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [attires, setAttires] = useState<AttirePreset[]>(DEFAULT_ATTIRES);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Cart / Selected Attires
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [expandedAccItemId, setExpandedAccItemId] = useState<string | null>(null);

  // Helper tanggal lokal (mencegah pergeseran timezone UTC di WITA / Indonesia Tengah)
  const getLocalDateStr = (d: Date = new Date()) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  // Dates (Default Hari Ini & +2 Hari Durasi Standar)
  const todayStr = getLocalDateStr();
  const [pickupDate, setPickupDate] = useState(todayStr);
  
  // Return date defaults to pickupDate + 2 days (3 days total)
  const defaultReturn = new Date();
  defaultReturn.setDate(defaultReturn.getDate() + 2);
  const [returnDeadline, setReturnDeadline] = useState(getLocalDateStr(defaultReturn));

  // Anti-Double Booking Availability State (Mapping jumlah ter-booking per kode busana)
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Checkout Modal & Print Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isAddAttireModalOpen, setIsAddAttireModalOpen] = useState(false);
  const [createdOrderForPrint, setCreatedOrderForPrint] = useState<any | null>(null);

  // Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Responsive: show both panels side-by-side when viewport >= 768px (same as Layout.tsx isMobile)
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut F2 to focus search, F10 to checkout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (cartItems.length > 0) {
          setIsCheckoutModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length]);

  // Fetch live attire catalog & stock from rental inventory API
  const fetchCatalog = useCallback(() => {
    if (!token) return;
    setCatalogLoading(true);
    fetch('/api/rental/inventory', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          const mapped: AttirePreset[] = data.items.map((i: any) => {
            const catUp = (i.category || '').toUpperCase();
            return {
              id: `prod-${i.id}`,
              name: i.name,
              code: i.code,
              category: (catUp.includes('LABU') ? 'LABU' :
                         catUp.includes('PENGANTIN') ? 'PENGANTIN' :
                         catUp.includes('PRIA') ? 'PRIA' :
                         catUp.includes('ANAK') ? 'ANAK' :
                         catUp.includes('KLASIK') ? 'KLASIK' : 'MODERN') as any,
              color: i.color || 'Bebas',
              size: i.size || 'M',
              price: Number(i.sellPrice) || 250000,
              rackHangerCode: i.storageLocation || `Hanger-${i.id}`,
              defaultAccessories: Array.isArray(i.accessories) && i.accessories.length > 0
                ? i.accessories
                : ['Bando Emas', 'Kalung Adat', '2x Gelang Pontoh', 'Lipa Sabbe'],
              accessoryPrices: i.accessoryPrices || undefined,
              imageUrl: i.imageUrl || undefined,
              availableStock: i.availableStock,
              totalStock: i.stock
            };
          });
          setAttires(mapped);
        }
      })
      .catch(console.warn)
      .finally(() => setCatalogLoading(false));
  }, [token]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Live Check Anti-Double Booking Availability
  useEffect(() => {
    if (!token || !pickupDate || !returnDeadline) return;
    setCheckingAvailability(true);
    fetch(`/api/rental/availability?startDate=${pickupDate}&endDate=${returnDeadline}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.bookedCountByCode) {
          setBookedCounts(data.bookedCountByCode);
        } else if (data?.schedule && Array.isArray(data.schedule)) {
          const counts: Record<string, number> = {};
          data.schedule.forEach((s: any) => {
            if (s.items && Array.isArray(s.items)) {
              s.items.forEach((it: any) => {
                const code = (it.attireCode || '').trim().toUpperCase();
                if (code) counts[code] = (counts[code] || 0) + 1;
              });
            }
          });
          setBookedCounts(counts);
        }
      })
      .catch(console.warn)
      .finally(() => setCheckingAvailability(false));
  }, [token, pickupDate, returnDeadline]);

  // Helper kalkulasi ketersediaan multi-stock busana pada rentang tanggal terpilih
  const getAttireAvailability = useCallback((attire: AttirePreset) => {
    const code = (attire.code || '').trim().toUpperCase();
    const totalOwned = attire.totalStock ?? 1;
    const bookedUnits = bookedCounts[code] || 0;
    const isTargetTodayOrPast = pickupDate <= todayStr;

    // Pengecekan stok fisik saat ini HANYA berlaku jika acara/sewa dimulai hari ini atau masa lalu
    // Untuk pre-order masa depan (minggu/bulan depan), ketersediaan murni ditentukan oleh jadwal booking pada tanggal tersebut
    const isPhysicallyUnavailableToday = isTargetTodayOrPast && (attire.availableStock !== undefined && attire.availableStock <= 0);

    // Bentrok jadwal jika jumlah yang sudah dibooking pada tanggal tersebut mencapai atau melebihi total unit fisik yang dimiliki
    const isDateConflict = bookedUnits >= totalOwned;
    const unitsAvailableOnDates = Math.max(0, totalOwned - bookedUnits);

    return {
      totalOwned,
      bookedUnits,
      unitsAvailableOnDates,
      isDateConflict,
      isPhysicallyUnavailableToday,
      isUnavailable: isDateConflict || isPhysicallyUnavailableToday
    };
  }, [bookedCounts, pickupDate, todayStr]);

  // Calculate rental duration in days
  const rentalDurationDays = useMemo(() => {
    if (!pickupDate || !returnDeadline) return 1;
    const start = new Date(pickupDate).getTime();
    const end = new Date(returnDeadline).getTime();
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [pickupDate, returnDeadline]);

  // Shortcut duration presets
  const handleApplyDurationPreset = (days: number) => {
    if (!pickupDate) return;
    const start = new Date(pickupDate);
    start.setDate(start.getDate() + (days - 1));
    setReturnDeadline(getLocalDateStr(start));
  };

  // Subtotal
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const basePrice = item.price * (item.qty || 1);
      const accTotal = item.selectedAccessories.reduce((s, accName) =>
        s + ((item.accessoryPrices?.[accName] || 0) * (item.qty || 1)), 0);
      return acc + basePrice + accTotal;
    }, 0);
  }, [cartItems]);

  // Filtered Attire List
  const filteredAttires = useMemo(() => {
    return attires.filter(it => {
      const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      const matchSize = selectedSize === 'ALL' || (it.size || '').toUpperCase() === selectedSize;
      const info = getAttireAvailability(it);
      const matchReady = !onlyReady || !info.isUnavailable;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        it.color.toLowerCase().includes(q) ||
        it.rackHangerCode.toLowerCase().includes(q);
      return matchCat && matchSize && matchReady && matchSearch;
    });
  }, [attires, selectedCategory, selectedSize, onlyReady, searchQuery, getAttireAvailability]);

  // Check if cart has date conflict
  const conflictingItemsInCart = useMemo(() => {
    return cartItems.filter(it => {
      const info = getAttireAvailability(it);
      return info.isUnavailable;
    });
  }, [cartItems, getAttireAvailability]);

  // Add Item to Order (Hard Guard against Double Booking & Out of Stock)
  const handleAddItem = (attire: AttirePreset) => {
    const isAlreadyAdded = cartItems.some(i => i.id === attire.id);
    if (isAlreadyAdded) {
      toast(`"${attire.name}" sudah ada di keranjang.`, 'info');
      return;
    }
    
    const info = getAttireAvailability(attire);

    if (info.isDateConflict) {
      toast(`Tidak dapat disewa: "${attire.name}" sudah ter-booking penuh (${info.bookedUnits}/${info.totalOwned} set) pada rentang tanggal ini!`, 'error');
      return;
    }
    if (info.isPhysicallyUnavailableToday) {
      toast(`Tidak dapat disewa: "${attire.name}" (${attire.rackHangerCode}) saat ini belum siap di sanggar (stok kosong/laundry).`, 'error');
      return;
    }

    setCartItems(prev => [
      ...prev,
      {
        ...attire,
        selectedAccessories: [...attire.defaultAccessories],
        permakNote: '',
        qty: 1
      }
    ]);
    toast(`${attire.name} (${attire.color}) ditambahkan ke keranjang.`, 'success');
  };

  // Toggle item in cart
  const handleToggleItem = (attire: AttirePreset) => {
    const isAlreadyAdded = cartItems.some(i => i.id === attire.id);
    if (isAlreadyAdded) {
      handleRemoveItem(attire.id);
    } else {
      handleAddItem(attire);
    }
  };

  // Toggle accessory for an item in cart
  const handleToggleAccessory = (itemId: string, accName: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const exists = item.selectedAccessories.includes(accName);
      return {
        ...item,
        selectedAccessories: exists 
          ? item.selectedAccessories.filter(a => a !== accName)
          : [...item.selectedAccessories, accName]
      };
    }));
  };

  // Update Permak note per item
  const handleUpdatePermakNote = (itemId: string, note: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, permakNote: note };
    }));
  };

  // Update qty per item (bounded by availableStock)
  const handleQtyChange = (itemId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const maxQty = item.availableStock ?? 99;
      const newQty = Math.max(1, Math.min(maxQty, (item.qty || 1) + delta));
      return { ...item, qty: newQty };
    }));
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className={`pos-layout h-full w-full flex ${isWide ? 'flex-row' : 'flex-col'} overflow-hidden bg-slate-100`}>
      
      {/* ─── MOBILE / TABLET TAB TOGGLE (Narrow screen only) ─────────────────────── */}
      {!isWide && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-300 shrink-0 shadow-2xs">
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1 border border-slate-300">
            <button
              type="button"
              onClick={() => setActiveMobileTab('catalog')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMobileTab === 'catalog'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 font-bold'
              }`}
            >
              <Shirt size={14} />
              <span>Katalog ({filteredAttires.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('cart')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                activeMobileTab === 'cart'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 font-bold'
              }`}
            >
              <ShoppingCart size={14} />
              <span>Keranjang ({cartItems.length})</span>
              {cartItems.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-2.5 animate-ping" />
              )}
            </button>
          </div>
          {/* ─ Tombol Tambah Busana di mobile ─ */}
          <button
            type="button"
            onClick={() => setIsAddAttireModalOpen(true)}
            className="h-8.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Tambah Busana Baru ke Katalog"
          >
            <Plus size={14} />
            <span className="text-[11px] hidden xs:inline">Busana</span>
          </button>
        </div>
      )}

      {/* ─── KIRI: KATALOG BUSANA VISUAL & FILTER LENGKAP (65% LEBAR LAYAR) ── */}
      <div className={`flex-1 flex-col min-w-0 overflow-hidden bg-white border-r border-slate-300 ${
        isWide || activeMobileTab === 'catalog' ? 'flex' : 'hidden'
      }`}>
        
        {/* Bar 1: Header & Quick Search */}
        <div className="p-2.5 sm:p-3.5 border-b border-slate-300 flex items-center justify-between gap-2 shrink-0 bg-white">
          {/* Desktop Brand Banner */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Shirt size={20} />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Koleksi Busana Adat
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300">
                  {filteredAttires.length} Ready
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">Pilih busana yang tersedia untuk dicatat ke keranjang sewa.</p>
            </div>
          </div>

          {/* Quick Search & Controls */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari warna, model, hanger (F2)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 bg-white transition-all text-slate-900 font-semibold placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={fetchCatalog}
              disabled={catalogLoading}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all cursor-pointer shrink-0 shadow-2xs"
              title="Refresh Katalog"
            >
              <RefreshCw size={15} className={catalogLoading ? 'animate-spin text-indigo-600' : ''} />
            </button>

            <button
              onClick={() => setIsAddAttireModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
              title="Tambah Busana Baru ke Katalog"
            >
              <Plus size={14} />
              <span>Tambah Busana</span>
            </button>
          </div>
        </div>

        {/* Bar 2: Jadwal Acara & Durasi Sewa Cepat (Solid & Tegas) */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-300 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black text-slate-700 flex items-center gap-1 shrink-0 uppercase tracking-wide">
              <Calendar size={13} className="text-indigo-600" />
              <span className="hidden xs:inline">Sewa:</span>
            </span>
            <div className="flex items-center gap-1 text-[11px] bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-slate-500 text-[9px] font-black uppercase">Ambil</span>
              <input
                type="date"
                value={pickupDate}
                onChange={e => {
                  const newPickup = e.target.value;
                  setPickupDate(newPickup);
                  if (newPickup) {
                    const start = new Date(newPickup);
                    start.setDate(start.getDate() + (rentalDurationDays - 1));
                    setReturnDeadline(start.toISOString().split('T')[0]);
                  }
                }}
                className="font-black text-slate-900 focus:outline-none text-[11px] cursor-pointer"
              />
            </div>
            <ArrowRight size={12} className="text-slate-400 shrink-0" />
            <div className="flex items-center gap-1 text-[11px] bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-slate-500 text-[9px] font-black uppercase">Kembali</span>
              <input
                type="date"
                value={returnDeadline}
                min={pickupDate}
                onChange={e => {
                  const newReturn = e.target.value;
                  if (newReturn && pickupDate && newReturn < pickupDate) {
                    toast('Tanggal kembali tidak boleh lebih awal dari tanggal ambil.', 'warning');
                    return;
                  }
                  setReturnDeadline(newReturn);
                }}
                className="font-black text-slate-900 focus:outline-none text-[11px] cursor-pointer"
              />
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-indigo-700 text-white shadow-xs shrink-0">
              {rentalDurationDays} Hari
            </span>
          </div>

          <div className="h-4 w-px bg-slate-300 shrink-0" />

          <div className="flex items-center gap-1 shrink-0">
            {[
              { label: '1 Hari', days: 1 },
              { label: '2 Hari', days: 2 },
              { label: '3 Hari (Standar)', days: 3 },
              { label: '5 Hari (Luar Kota)', days: 5 },
              { label: '7 Hari', days: 7 }
            ].map(p => {
              const isActive = rentalDurationDays === p.days;
              return (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => handleApplyDurationPreset(p.days)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white font-black shadow-xs ring-2 ring-indigo-400/40 border border-indigo-600'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold hover:border-slate-400'
                  }`}
                >
                  {isActive && <Check size={10} className="shrink-0" />}
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule Conflict Alert Banner (if cart has clashed dates) */}
        {conflictingItemsInCart.length > 0 && (
          <div className="mx-4 mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-300 flex items-center gap-2 text-xs text-rose-800 shrink-0 animate-fade-in">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <div className="flex-1">
              <strong>Peringatan Jadwal Bentrok:</strong> Busana <strong>{conflictingItemsInCart.map(c => c.name).join(', ')}</strong> sudah ter-booking pelanggan lain pada rentang tanggal ini!
            </div>
          </div>
        )}

        {/* Bar 3: Category Chips & Size Filter Pills (Solid & Tegas) */}
        <div className="px-3 py-2 border-b border-slate-300 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-white">
          {/* Categories */}
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'ALL', label: 'Semua Koleksi' },
              { id: 'MODERN', label: 'Baju Bodo Modern' },
              { id: 'LABU', label: 'La\'bu Sutra' },
              { id: 'PENGANTIN', label: 'Pengantin Adat' },
              { id: 'KLASIK', label: 'Tokko Klasik' },
              { id: 'PRIA', label: 'Jas Tutup Pria' },
              { id: 'ANAK', label: 'Baju Anak' }
            ].map(cat => {
              const countInCat = cat.id === 'ALL' 
                ? attires.length 
                : attires.filter(a => a.category === cat.id).length;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? 'bg-indigo-900 text-indigo-100' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {countInCat}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-slate-300 shrink-0" />

          {/* Size Pills & Only Ready Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300">
              <span className="text-[9px] font-black text-slate-600 px-1.5">Size:</span>
              {['ALL', 'S', 'M', 'L', 'XL'].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                    selectedSize === sz
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-950 font-bold'
                  }`}
                >
                  {sz === 'ALL' ? 'Semua' : sz}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOnlyReady(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                onlyReady
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlyReady ? 'bg-white' : 'bg-slate-400'}`} />
              <span>Ready Saja</span>
            </button>
          </div>
        </div>

        {/* ─── GRID KATALOG BUSANA (LUAS, NYAMAN, RESPONSIF) ───────────────── */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto bg-slate-50/50">
          {filteredAttires.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <Shirt size={28} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Tidak Ada Busana yang Sesuai</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Coba ubah kata kunci pencarian, pilih kategori lain, atau nonaktifkan filter "Ready Saja".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedSize('ALL');
                  setOnlyReady(false);
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4 pb-24 lg:pb-6">
              {filteredAttires.map(attire => {
                const isAdded = cartItems.some(i => i.id === attire.id);
                const info = getAttireAvailability(attire);
                const isBookedConflict = info.isDateConflict;
                const isUnavailable = info.isUnavailable;
                const swatchColor = COLOR_SWATCHES[attire.color.toLowerCase()] || '#94a3b8';

                return (
                  <div
                    key={attire.id}
                    onClick={() => {
                      if (!isAdded && isUnavailable) {
                        if (isBookedConflict) {
                          toast(`Busana "${attire.name}" sudah ter-booking penuh (${info.bookedUnits}/${info.totalOwned} set) pada rentang tanggal ini!`, 'error');
                        } else {
                          toast(`Busana "${attire.name}" saat ini belum siap di sanggar untuk sewa hari ini.`, 'error');
                        }
                        return;
                      }
                      handleToggleItem(attire);
                    }}
                    className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition-all select-none ${
                      isAdded
                        ? 'border-2 border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-md cursor-pointer'
                        : isBookedConflict
                        ? 'border-2 border-rose-300 bg-rose-50/30 hover:border-rose-400 opacity-80 cursor-not-allowed'
                        : info.isPhysicallyUnavailableToday
                        ? 'border border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed'
                        : 'border border-slate-300 bg-white hover:border-indigo-400 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div>
                      {/* Photo Thumbnail */}
                      <div className="relative h-44 sm:h-48 w-full rounded-2xl overflow-hidden bg-slate-100 mb-3 shadow-2xs group-hover:shadow-md transition-shadow">
                        {attire.imageUrl ? (
                          <img
                            src={attire.imageUrl}
                            alt={attire.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50/50 text-indigo-400">
                            <Shirt size={40} className="opacity-40" />
                          </div>
                        )}

                        {/* Top Badges on Image */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-[#0F172A] text-indigo-200 shadow-md flex items-center gap-1 border border-slate-700">
                            <Tag size={10} className="text-indigo-400" />
                            {attire.rackHangerCode}
                          </span>
                        </div>

                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#0F172A] text-white uppercase shadow-md border border-slate-700">
                            Size {attire.size}
                          </span>
                          {isBookedConflict && (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-600 text-white shadow-md animate-pulse">
                              Penuh
                            </span>
                          )}
                        </div>

                        {/* Overlays */}
                        {isAdded ? (
                          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1.5px] flex items-center justify-center animate-in fade-in duration-200">
                            <span className="px-4 py-2 rounded-2xl bg-indigo-600 text-white font-black text-xs shadow-xl flex items-center gap-1.5 border border-indigo-400">
                              <Check size={14} /> Terpilih di Keranjang
                            </span>
                          </div>
                        ) : isBookedConflict ? (
                          <div className="absolute inset-0 bg-rose-950/75 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center animate-in fade-in duration-200">
                            <span className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-[11px] shadow-lg flex items-center gap-1.5 border border-rose-400">
                              <AlertTriangle size={13} /> Ter-booking Penuh ({info.bookedUnits}/{info.totalOwned})
                            </span>
                            <span className="text-[10px] text-rose-200 font-bold mt-1">Pilih rentang tanggal lain</span>
                          </div>
                        ) : info.isPhysicallyUnavailableToday ? (
                          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center animate-in fade-in duration-200">
                            <span className="px-3 py-1.5 rounded-xl bg-slate-700 text-white font-black text-[11px] shadow-lg flex items-center gap-1.5 border border-slate-500">
                              <X size={13} /> Stok Kosong Hari Ini
                            </span>
                            <span className="text-[10px] text-slate-300 font-bold mt-1">Sedang sewa / laundry</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Status Ready Stock */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isBookedConflict
                            ? 'bg-rose-50 text-rose-700 border border-rose-300'
                            : info.bookedUnits > 0
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : info.isPhysicallyUnavailableToday
                            ? 'bg-slate-100 text-slate-600 border border-slate-300'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        }`}>
                          {isBookedConflict
                            ? `Penuh: ${info.bookedUnits}/${info.totalOwned} Set`
                            : info.bookedUnits > 0
                            ? `Sisa ${info.unitsAvailableOnDates}/${info.totalOwned} Set`
                            : info.isPhysicallyUnavailableToday
                            ? 'Kosong Hari Ini'
                            : `Ready: ${info.unitsAvailableOnDates} Set`}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-300 text-[10px] font-bold text-slate-700">
                          <span 
                            className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" 
                            style={{ backgroundColor: swatchColor }}
                          />
                          {attire.color}
                        </span>
                      </div>

                      {/* Attire Name */}
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-900 transition-colors">
                        {attire.name}
                      </h3>

                      {/* Accessories Included Snippet */}
                      <div className="mt-2 text-[10px] text-slate-500 font-medium flex items-center gap-1">
                        <Layers size={11} className="text-indigo-600 shrink-0" />
                        <span>{attire.defaultAccessories.length} Aksesoris Pelengkap Bawaan</span>
                      </div>
                    </div>

                    {/* Bottom Row: Price & Action Button */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tarif Sewa</div>
                        <div className="text-sm font-black text-slate-900">
                          Rp {attire.price.toLocaleString('id-ID')}
                        </div>
                      </div>

                      {isAdded ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleItem(attire);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                        >
                          <Check size={13} /> Terpilih
                        </button>
                      ) : isBookedConflict ? (
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 cursor-not-allowed opacity-80"
                        >
                          <AlertTriangle size={12} /> Penuh
                        </button>
                      ) : info.isPhysicallyUnavailableToday ? (
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-200 text-slate-500 border border-slate-300 flex items-center gap-1 cursor-not-allowed opacity-80"
                        >
                          <X size={12} /> Kosong
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleItem(attire);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                        >
                          <Plus size={13} /> Pilih Busana
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── KANAN: SIDEBAR KERANJANG KONTRAK SEWA RINGKAS (35% LEBAR LAYAR) ─── */}
      <div className={`flex-col bg-white border-slate-200 shadow-sm overflow-hidden ${
        isWide
          ? 'flex w-[320px] lg:w-[380px] xl:w-[420px] flex-shrink-0 border-l'
          : (activeMobileTab === 'cart' ? 'flex flex-1 border-t' : 'hidden')
      }`}>
        
        {/* Header Keranjang Sewa */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-black text-xs shrink-0">
              {cartItems.length}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900">Keranjang Sewa</h2>
              <p className="text-[11px] text-slate-500 truncate">Daftar busana adat yang akan disewa</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tombol Tambah Busana di header keranjang — visible di desktop (md+) */}
            <button
              type="button"
              onClick={() => setIsAddAttireModalOpen(true)}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-xs shadow-violet-500/20"
              title="Tambah Busana Baru ke Katalog"
            >
              <Plus size={13} />
              <span>Tambah</span>
            </button>
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={() => setCartItems([])}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RotateCcw size={12} /> Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/40">
          {cartItems.length === 0 ? (
            <div 
              onClick={() => {
                setActiveMobileTab('catalog');
                searchInputRef.current?.focus();
              }}
              className="h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white cursor-pointer hover:border-violet-300 transition-colors group"
            >
              <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ShoppingCart size={24} />
              </div>
              <h3 className="text-xs font-black text-slate-800">Keranjang Masih Kosong</h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
                Silakan klik kartu busana pada katalog di sebelah kiri untuk menambahkannya ke kontrak sewa.
              </p>
              <span className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700 transition-all">
                <Plus size={13} /> Pilih Busana Sekarang
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cartItems.map((item) => {
                const itemAvail = getAttireAvailability(item);
                const isConflict = itemAvail.isUnavailable;

                return (
                  <div 
                    key={item.id}
                    className={`rounded-2xl border bg-white shadow-2xs transition-all overflow-hidden ${
                      isConflict ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200/90'
                    }`}
                  >
                    {/* ── Row 1: Thumbnail + Info + Price + Delete ── */}
                    <div className="p-3 flex items-start gap-2.5">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-400 bg-indigo-50">
                            <Shirt size={18} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200">
                            {item.rackHangerCode}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Size {item.size} • {item.color}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 mt-0.5 leading-tight" title={item.name}>
                          {item.name}
                        </h4>
                        {isConflict && (
                          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} /> Bentrok dengan booking lain
                          </span>
                        )}
                        {/* Price: per set × qty */}
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-[11px] font-black text-slate-800">
                            Rp {item.price.toLocaleString('id-ID')}
                          </span>
                          {(item.qty || 1) > 1 && (
                            <span className="text-[10px] text-slate-500">
                              × {item.qty} = <span className="font-black text-indigo-950">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Hapus dari Keranjang"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* ── Row 2: Jumlah Set Control ── */}
                    <div className="px-3 pb-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">Jumlah Set</span>
                        {item.availableStock !== undefined && (
                          <span className="text-[9px] text-slate-400">(max {item.availableStock} tersedia)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, -1)}
                          disabled={(item.qty || 1) <= 1}
                          className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-all"
                        >
                          <span className="text-sm font-black leading-none">−</span>
                        </button>
                        <span className="min-w-[28px] text-center text-sm font-black text-slate-900">{item.qty || 1}</span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, +1)}
                          disabled={(item.qty || 1) >= (item.availableStock ?? 99)}
                          className="w-7 h-7 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-all"
                        >
                          <span className="text-sm font-black leading-none">+</span>
                        </button>
                        <span className="text-[10px] text-slate-500 font-bold ml-0.5">Set</span>
                      </div>
                    </div>

                    {/* ── Row 3: Aksesori (always visible) ── */}
                    <div className="px-3 pb-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide flex items-center gap-1">
                          <Layers size={10} className="text-indigo-600" /> Aksesori Disertakan
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.selectedAccessories.length}/{item.defaultAccessories.length} item
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.defaultAccessories.map(acc => {
                          const isChecked = item.selectedAccessories.includes(acc);
                          const extraPrice = item.accessoryPrices?.[acc] || 0;
                          return (
                            <button
                              key={acc}
                              type="button"
                              onClick={() => handleToggleAccessory(item.id, acc)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                                isChecked 
                                  ? extraPrice > 0
                                    ? 'bg-violet-100 text-violet-900 border-violet-300'
                                    : 'bg-indigo-50 text-indigo-900 border-indigo-200' 
                                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:border-slate-300'
                              }`}
                            >
                              {isChecked ? <Check size={9} className="shrink-0" /> : <X size={9} className="shrink-0" />}
                              {acc}
                              {extraPrice > 0 && (
                                <span className={`ml-0.5 font-black ${
                                  isChecked ? 'text-violet-700' : 'text-slate-300'
                                }`}>
                                  +{(extraPrice).toLocaleString('id-ID')}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {/* Aksesori extra total per item */}
                      {(() => {
                        const accExtra = item.selectedAccessories.reduce((s, acc) =>
                          s + ((item.accessoryPrices?.[acc] || 0) * (item.qty || 1)), 0);
                        return accExtra > 0 ? (
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span className="text-violet-700 font-bold">Biaya aksesori berbayar:</span>
                            <span className="font-black text-violet-800">+Rp {accExtra.toLocaleString('id-ID')}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* ── Row 4: Permak Note ── */}
                    <div className="px-3 pb-3">
                      <input
                        type="text"
                        placeholder="Catatan peniti/permak baju ini (opsional)..."
                        value={item.permakNote || ''}
                        onChange={e => handleUpdatePermakNote(item.id, e.target.value)}
                        className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-slate-50/60 text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pinned Bottom Order Summary & Checkout Button */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 shrink-0 space-y-3 shadow-lg">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Sewa ({cartItems.reduce((s, i) => s + (i.qty || 1), 0)} Set dari {cartItems.length} Model)</span>
              <span className="font-bold text-slate-900">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Durasi Sewa Terpilih</span>
              <span className="font-bold text-slate-700">{rentalDurationDays} Hari</span>
            </div>

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
              <span className="text-xs font-black text-slate-900">Total Tarif Sewa</span>
              <span className="text-base font-black text-slate-900">
                Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Schedule Conflict in Cart Banner */}
          {conflictingItemsInCart.length > 0 && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 animate-pulse">
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
              <span>Hapus busana yang bentrok jadwal dari keranjang untuk melanjutkan transaksi.</span>
            </div>
          )}

          {/* Action Button: Open Checkout Modal */}
          <button
            type="button"
            disabled={cartItems.length === 0 || conflictingItemsInCart.length > 0}
            onClick={() => setIsCheckoutModalOpen(true)}
            className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
              cartItems.length === 0 || conflictingItemsInCart.length > 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-600/25 hover:shadow-lg'
            }`}
          >
            <CheckCircle2 size={18} />
            <span>Lanjut Pembayaran &amp; Kontrak (F10)</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ─── MODAL ELEGAN: FORM DATA PENYEWA, JAMINAN KTP & PEMBAYARAN ────── */}
      <RentalCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        cartItems={cartItems}
        pickupDate={pickupDate}
        returnDeadline={returnDeadline}
        rentalDurationDays={rentalDurationDays}
        subtotal={subtotal}
        token={token}
        onSuccess={(order) => {
          setCartItems([]);
          setCreatedOrderForPrint(order);
        }}
      />

      {/* ─── MODAL TAMBAH BUSANA BARU KE KATALOG (DENGAN OPSI GAMBAR) ───────── */}
      <AddAttireModal
        isOpen={isAddAttireModalOpen}
        onClose={() => setIsAddAttireModalOpen(false)}
        onSuccess={() => fetchCatalog()}
      />

      {/* Popup Cetak Resi Thermal & Kontrak Sewa A4 */}
      {createdOrderForPrint && (
        <RentalReceiptPrinter
          order={createdOrderForPrint}
          onClose={() => {
            setCreatedOrderForPrint(null);
            navigate('/rental-kanban');
          }}
        />
      )}

      {/* ─── FLOATING BOTTOM QUICK CART PILL ON MOBILE (Solid & Tegas) ─── */}
      {!isWide && activeMobileTab === 'catalog' && cartItems.length > 0 && (
        <div className="fixed bottom-20 left-3 right-3 z-40 sm:hidden animate-in slide-in-from-bottom-4 duration-300">
          <button
            type="button"
            onClick={() => setActiveMobileTab('cart')}
            className="w-full py-3 px-4 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all border border-indigo-500"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-950 text-white flex items-center justify-center font-black text-xs border border-indigo-500/50">
                <ShoppingCart size={16} />
              </div>
              <div className="text-left">
                <div className="text-xs font-black tracking-wide">
                  {cartItems.reduce((s, i) => s + (i.qty || 1), 0)} Set Busana Terpilih
                </div>
                <div className="text-[11px] text-indigo-200 font-bold">
                  Rp {subtotal.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black bg-white/20 px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors">
              <span>Lihat Keranjang</span>
              <ArrowRight size={13} />
            </div>
          </button>
        </div>
      )}

    </div>
  );
};

export default POSRental;
