import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shirt, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Tag, 
  Sparkles, 
  Printer, 
  Check, 
  Clock, 
  Calendar, 
  CreditCard, 
  Wallet, 
  QrCode, 
  ArrowRight, 
  Layers, 
  FileText, 
  Wind, 
  Scale, 
  AlertCircle,
  Phone,
  User,
  RefreshCw,
  X,
  ShoppingBag,
  Receipt,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Flame,
  Zap,
  Droplets,
  Package,
  Scissors,
  CheckCircle,
  Usb,
  Settings2,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { LaundryReceiptPrinter } from './LaundryReceiptPrinter';
import { scaleDriver, type ScaleConnectionStatus } from '../../utils/digitalScaleDriver';
import { DigitalScaleModal } from './DigitalScaleModal';

interface LaundryItem {
  id: string;
  serviceName: string;
  unitType: 'KG' | 'PCS' | 'METER';
  qty: number;
  pricePerUnit: number;
  subtotal: number;
  notes?: string;
}

interface ServiceCatalogItem {
  id: number;
  name: string;
  category: string;
  unitType: 'KG' | 'PCS' | 'METER';
  price: number;
  description?: string;
  iconType?: string;
  imageUrl?: string;
}

const SCENT_OPTIONS = [
  { name: 'Sakura Fresh', badge: '🌸 Sakura', desc: 'Bunga lembut segar', activeClass: 'bg-pink-600 text-white border-pink-600 shadow-md shadow-pink-200' },
  { name: 'Akasia Manis', badge: '🌿 Akasia', desc: 'Aroma alam khas laundry', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200' },
  { name: 'Ocean Blue', badge: '🌊 Ocean', desc: 'Segar dingin maskulin', activeClass: 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-200' },
  { name: 'Lavender Calm', badge: '💜 Lavender', desc: 'Rileks & anti-bakteri', activeClass: 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200' },
  { name: 'Downy Mystique', badge: '✨ Mystique', desc: 'Mewah tahan lama', activeClass: 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-200' },
  { name: 'Snappy Clean', badge: '🧼 Snappy', desc: 'Bersih higienis', activeClass: 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-200' },
  { name: 'Non-Parfum', badge: '⚪ Netral', desc: 'Hipoalergenik bayi', activeClass: 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-200' }
];

const TREATMENT_TAGS = [
  { id: 'NODA', label: '⚠️ Noda Membandel', activeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-black' },
  { id: 'LUNTUR', label: '🔴 Pisahkan Luntur', activeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black' },
  { id: 'HANGER', label: '👔 Pakai Hanger', activeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-black' },
  { id: 'NO_PANAS', label: '🚫 Tanpa Setrika Panas', activeClass: 'bg-blue-100 text-blue-800 border-blue-300 font-black' },
  { id: 'LIPAT', label: '📦 Lipat Rapi Saja', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black' }
];

export const POSLaundry: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, triggerHaptic } = usePOS();

  // State Pelanggan
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);

  // State Preferensi Laundry
  const [serviceSpeed, setServiceSpeed] = useState<'REGULAR' | 'KILAT_24H' | 'EXPRESS_6H'>('REGULAR');
  const [perfumeVariant, setPerfumeVariant] = useState('Sakura Fresh');
  const [itemPieces, setItemPieces] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  // Keranjang
  const [cart, setCart] = useState<LaundryItem[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'ALL' | 'KILOAN' | 'SATUAN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Digital Scale State
  const [scaleService, setScaleService] = useState<ServiceCatalogItem | null>(null);
  const [scaleWeight, setScaleWeight] = useState<string>('3.50');
  const [scaleStatus, setScaleStatus] = useState<ScaleConnectionStatus>(scaleDriver.getStatus());
  const [isScaleStable, setIsScaleStable] = useState<boolean>(true);
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false);

  // Auto-reconnect & Stream event listener untuk timbangan hardware
  useEffect(() => {
    scaleDriver.autoReconnect();

    const unsubStatus = scaleDriver.onStatusChange(st => setScaleStatus(st));
    const unsubReading = scaleDriver.onReading(r => {
      setScaleWeight(r.weight.toFixed(2));
      setIsScaleStable(r.isStable);
    });
    const unsubLock = scaleDriver.onStableLock(() => {
      triggerHaptic?.();
    });

    return () => {
      unsubStatus();
      unsubReading();
      unsubLock();
    };
  }, [triggerHaptic]);

  const handleToggleScaleConnection = async () => {
    if (scaleStatus === 'CONNECTED') {
      await scaleDriver.disconnect();
      toast('Timbangan serial USB diputuskan.', 'info');
    } else if (scaleStatus === 'SIMULATING') {
      scaleDriver.stopSimulation();
      toast('Mode simulasi timbangan dihentikan.', 'info');
    } else {
      try {
        const ok = await scaleDriver.connect();
        if (ok) {
          toast('Timbangan serial USB berhasil terhubung!', 'success');
        }
      } catch (err: any) {
        toast(err.message || 'Gagal menyambungkan timbangan', 'error');
      }
    }
  };

  // Dual-Payment & Pembayaran
  const [paymentOption, setPaymentOption] = useState<'PAY_NOW' | 'PAY_LATER'>('PAY_NOW');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Modal Cetak Struk
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pure Database Catalog
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Fetch Services on Mount (100% Real Database from /api/products)
  useEffect(() => {
    const fetchServices = async () => {
      setIsLoadingCatalog(true);
      try {
        const headers: Record<string, string> = { 
          Authorization: `Bearer ${token}`,
          ...(user?.tenantId ? { 'x-tenant-id': user.tenantId } : {})
        };
        const res = await fetch('/api/products?limit=100', { headers });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.products || [];
          const mapped: ServiceCatalogItem[] = items.map((p: any) => {
            const uom = (p.baseUom || p.unit || '').toUpperCase();
            const catName = (p.category?.name || '').toUpperCase();
            const isPcs = uom === 'PCS' || catName.includes('SATUAN') || catName.includes('SEPATU') || catName.includes('BEDCOVER');
            return {
              id: p.id,
              name: p.name,
              category: isPcs ? 'SATUAN' : 'KILOAN',
              unitType: isPcs ? 'PCS' : 'KG',
              price: p.sellPrice || 0,
              description: p.description || '',
              imageUrl: p.imageUrl || ''
            };
          });
          setCatalog(mapped);
          const firstKilo = mapped.find(m => m.unitType === 'KG') || mapped[0] || null;
          if (firstKilo) setScaleService(firstKilo);
        }
      } catch (err) {
        console.warn('[POSLaundry] Gagal memuat produk dari database:', err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchServices();
  }, [token, user?.tenantId]);

  // Kalkulasi Speed Surcharge & Estimasi Selesai
  const speedDetails = useMemo(() => {
    const now = new Date();
    if (serviceSpeed === 'EXPRESS_6H') {
      const estimated = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      return {
        label: 'Super Express (6 Jam)',
        surchargeMultiplier: 1.5,
        estimatedTime: estimated,
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    if (serviceSpeed === 'KILAT_24H') {
      const estimated = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      return {
        label: 'Kilat (24 Jam)',
        surchargeMultiplier: 1.25,
        estimatedTime: estimated,
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    const estimated = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return {
      label: 'Reguler (2-3 Hari)',
      surchargeMultiplier: 1.0,
      estimatedTime: estimated,
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }, [serviceSpeed]);

  const estimatedDateString = useMemo(() => {
    return speedDetails.estimatedTime.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [speedDetails]);

  // Filter Catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const matchCategory = activeCategoryTab === 'ALL' || item.category === activeCategoryTab;
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [catalog, activeCategoryTab, searchQuery]);

  // Perhitungan Subtotal, Surcharge, Total
  const subtotalCart = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const speedSurcharge = useMemo(() => {
    if (serviceSpeed === 'REGULAR') return 0;
    return Math.round(subtotalCart * (speedDetails.surchargeMultiplier - 1));
  }, [subtotalCart, serviceSpeed, speedDetails]);

  const totalPayable = useMemo(() => {
    const raw = subtotalCart + speedSurcharge - discountAmount;
    return Math.max(0, raw);
  }, [subtotalCart, speedSurcharge, discountAmount]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - totalPayable);
  }, [cashTendered, totalPayable]);

  // Action: Timbang & Masukkan ke Keranjang dari Digital Scale Widget
  const handleAddFromScale = () => {
    triggerHaptic?.(15);
    if (!scaleService) {
      toast('Pilih layanan timbangan terlebih dahulu', 'error');
      return;
    }
    const weight = parseFloat(scaleWeight);
    if (isNaN(weight) || weight <= 0) {
      toast('Masukkan bobot timbangan yang valid (Kg)', 'error');
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.serviceName === scaleService.name);
      if (existing) {
        const newQty = parseFloat((existing.qty + weight).toFixed(2));
        return prev.map(i => i.serviceName === scaleService.name
          ? { ...i, qty: newQty, subtotal: Math.round(newQty * i.pricePerUnit) }
          : i
        );
      }
      return [...prev, {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        serviceName: scaleService.name,
        unitType: 'KG',
        qty: weight,
        pricePerUnit: scaleService.price,
        subtotal: Math.round(weight * scaleService.price)
      }];
    });

    toast(`+${weight} Kg ${scaleService.name} masuk nota!`, 'success');
  };

  // Action: Add / Select Service dari Grid Kartu
  const handleSelectServiceCard = (item: ServiceCatalogItem) => {
    triggerHaptic?.(10);
    if (item.unitType === 'KG') {
      setScaleService(item);
      toast(`Layanan ${item.name} siap ditimbang di panel LED`, 'info');
    } else {
      // Satuan: Langsung tambahkan 1 pcs
      setCart(prev => {
        const existing = prev.find(i => i.serviceName === item.name);
        if (existing) {
          return prev.map(i => i.serviceName === item.name 
            ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.pricePerUnit }
            : i
          );
        }
        return [...prev, {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          serviceName: item.name,
          unitType: 'PCS',
          qty: 1,
          pricePerUnit: item.price,
          subtotal: item.price
        }];
      });
      toast(`+1 ${item.name}`, 'info');
    }
  };

  // Action: Quick Presets Bobot Timbangan
  const handleQuickPreset = (w: number) => {
    triggerHaptic?.(10);
    setScaleWeight(w.toFixed(2));
  };

  const handleAdjustWeight = (delta: number) => {
    triggerHaptic?.(10);
    const curr = parseFloat(scaleWeight) || 0;
    const next = Math.max(0.1, curr + delta);
    setScaleWeight(next.toFixed(2));
  };

  // Toggle Treatment Tags
  const handleToggleTag = (tagLabel: string) => {
    triggerHaptic?.(10);
    setSelectedTags(prev => 
      prev.includes(tagLabel) ? prev.filter(t => t !== tagLabel) : [...prev, tagLabel]
    );
  };

  // Action: Ubah Jumlah di Keranjang
  const handleUpdateCartQty = (id: string, newQty: number) => {
    triggerHaptic?.(10);
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.id !== id));
      return;
    }
    setCart(prev => prev.map(it => {
      if (it.id === id) {
        const qtyFixed = it.unitType === 'KG' ? parseFloat(newQty.toFixed(2)) : Math.round(newQty);
        return {
          ...it,
          qty: qtyFixed,
          subtotal: Math.round(qtyFixed * it.pricePerUnit)
        };
      }
      return it;
    }));
  };

  const handleRemoveCartItem = (id: string) => {
    triggerHaptic?.(10);
    setCart(prev => prev.filter(i => i.id !== id));
  };

  // Submit Transaksi Laundry
  const handleSubmitLaundryOrder = async () => {
    triggerHaptic?.(20);
    if (cart.length === 0) {
      toast('Keranjang nota cuci masih kosong', 'error');
      return;
    }
    if (!customerName.trim()) {
      toast('Mohon masukkan nama pelanggan', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const isPaidNow = paymentOption === 'PAY_NOW';
      const paidAmount = isPaidNow ? totalPayable : 0;
      const paymentStatus = isPaidNow ? 'PAID' : 'UNPAID';

      const combinedSpecialNotes = [
        ...selectedTags,
        customNotes.trim()
      ].filter(Boolean).join(', ');

      const payload = {
        outletId: user?.outletId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerId: customerId || undefined,
        serviceSpeed,
        perfumeVariant,
        itemCountNotes: itemPieces > 0 ? `${itemPieces} potong / helai` : undefined,
        specialNotes: combinedSpecialNotes || undefined,
        items: cart.map(it => ({
          serviceName: it.serviceName,
          unitType: it.unitType,
          qty: it.qty,
          pricePerUnit: it.pricePerUnit,
          subtotal: it.subtotal,
          notes: it.notes
        })),
        speedSurcharge,
        discount: discountAmount,
        paidAmount,
        paymentStatus,
        paymentMethod: isPaidNow ? paymentMethod : undefined,
        estimatedDoneAt: speedDetails.estimatedTime.toISOString()
      };

      const res = await fetch('/api/laundry/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan transaksi laundry');
      }

      toast('🎉 Nota cucian berhasil dicatat!', 'success');
      setCreatedOrder(data.order);
      setShowReceiptModal(true);

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerId(null);
      setItemPieces(0);
      setSelectedTags([]);
      setCustomNotes('');
      setCashTendered('');
      setDiscountAmount(0);
      setServiceSpeed('REGULAR');
    } catch (err: any) {
      console.error('[POSLaundry] Error submitting:', err);
      toast(err.message || 'Gagal membuat nota cucian', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pos-layout h-full w-full overflow-hidden flex flex-row bg-slate-100 text-slate-800 font-sans" style={{ height: '100%' }}>
      
      {/* ─── KIRI (60%): DECK OPERASIONAL TIMBANGAN DIGITAL & KATALOG (LIGHT THEME) ─── */}
      <div className="pos-main flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-4 gap-3.5 bg-slate-50 border-r border-slate-200">
        
        {/* Top Header Banner & SLA Speed Quick Selector */}
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-xs">
              <Shirt size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-slate-900 m-0">
                  Kasir Drop-off Laundry
                </h1>
                <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Tactile POS
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0">Timbangan digital, varian aroma parfum, & tiket nota kasir</p>
            </div>
          </div>

          {/* Quick Speed SLA Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setServiceSpeed('REGULAR'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                serviceSpeed === 'REGULAR'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span>🌿 Reguler (2-3 Hari)</span>
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setServiceSpeed('KILAT_24H'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                serviceSpeed === 'KILAT_24H'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm scale-105'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Zap size={13} className="text-amber-800 fill-amber-800" />
              <span>Kilat (24 Jam) +25%</span>
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setServiceSpeed('EXPRESS_6H'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                serviceSpeed === 'EXPRESS_6H'
                  ? 'bg-rose-600 text-white font-black shadow-sm scale-105 animate-pulse'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Flame size={13} className="text-rose-200 fill-rose-200" />
              <span>Express (6 Jam) +50%</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/laundry-kanban')}
              className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-all flex items-center gap-1"
              title="Buka Papan Kanban Rak"
            >
              <Layers size={13} />
              <span>Papan Rak</span>
            </button>
          </div>
        </div>

        {/* ─── TACTILE DIGITAL SCALE WIDGET (SLEEK LIGHT HOUSING + LCD LED SCREEN) ─── */}
        <div className="bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 rounded-2xl border-2 border-cyan-300 p-4 shadow-sm shrink-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* High-Tech Digital Scale LED Display Box */}
            <div className="flex-1 bg-slate-950 rounded-2xl p-3.5 border-2 border-cyan-500/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Scale size={20} className={scaleStatus === 'CONNECTED' || scaleStatus === 'SIMULATING' ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleToggleScaleConnection}
                      className={`text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                        scaleStatus === 'CONNECTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                          : scaleStatus === 'SIMULATING'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 hover:bg-purple-500/30'
                          : scaleStatus === 'CONNECTING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          : 'bg-slate-850 text-slate-400 border border-slate-700 hover:text-cyan-400 hover:border-cyan-500/50'
                      }`}
                      title={scaleStatus === 'CONNECTED' ? 'Klik untuk memutus port' : 'Klik untuk menyambungkan USB timbangan'}
                    >
                      <span
                        className={`w-2 h-2 rounded-full inline-block ${
                          scaleStatus === 'CONNECTED'
                            ? 'bg-emerald-400 animate-ping'
                            : scaleStatus === 'SIMULATING'
                            ? 'bg-purple-400 animate-ping'
                            : 'bg-slate-500'
                        }`}
                      />
                      {scaleStatus === 'CONNECTED'
                        ? 'USB COM TERHUBUNG'
                        : scaleStatus === 'SIMULATING'
                        ? 'SIMULATOR AKTIF'
                        : 'SAMBUNGKAN USB TIMBANGAN'}
                    </button>

                    {/* Stable / Unstable Badge */}
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                        isScaleStable
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-950 text-amber-400 border border-amber-500/40 animate-pulse'
                      }`}
                    >
                      <Lock size={10} />
                      {isScaleStable ? 'STABLE' : 'UNSTABLE'}
                    </span>

                    {/* Hardware Modal Config Button */}
                    <button
                      type="button"
                      onClick={() => setShowScaleModal(true)}
                      className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-all cursor-pointer"
                      title="Konfigurasi Port Serial & Terminal Monitor"
                    >
                      <Settings2 size={13} />
                    </button>
                  </div>

                  <div className="text-xs text-white font-bold truncate max-w-[220px] mt-1">
                    {scaleService?.name || 'Pilih Layanan Kiloan'}
                  </div>
                </div>
              </div>

              {/* Digit Readout */}
              <div className="flex items-baseline justify-end gap-2 shrink-0">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={scaleWeight}
                  onChange={e => setScaleWeight(e.target.value)}
                  className="w-32 bg-transparent text-right text-4xl sm:text-5xl font-black font-mono text-cyan-400 outline-none drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] border-b-2 border-dashed border-cyan-500/40 focus:border-cyan-400 cursor-text"
                />
                <span className="text-xl font-black text-cyan-300 font-mono">KG</span>
              </div>
            </div>

            {/* Quick Adjust Buttons & Action */}
            <div className="flex flex-col gap-2 shrink-0">
              {/* Presets Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: '+0.5', val: 0.5 },
                  { label: '+1.0', val: 1.0 },
                  { label: '3 Kg (Kecil)', set: 3.0 },
                  { label: '5 Kg (Sedang)', set: 5.0 },
                  { label: '7 Kg (Besar)', set: 7.0 },
                  { label: '10 Kg', set: 10.0 }
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => btn.set ? handleQuickPreset(btn.set) : handleAdjustWeight(btn.val!)}
                    className="px-2.5 py-1.5 bg-white hover:bg-cyan-600 hover:text-white text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  >
                    {btn.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setScaleWeight('0.00')}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Nolkan / Tare"
                >
                  Tare
                </button>
              </div>

              {/* Add Button */}
              <div className="flex items-center gap-2">
                <select
                  value={scaleService?.id || ''}
                  onChange={e => {
                    const found = catalog.find(c => c.id === Number(e.target.value));
                    if (found) setScaleService(found);
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 shadow-2xs"
                >
                  {catalog.filter(c => c.unitType === 'KG').length === 0 ? (
                    <option value="">(Tidak ada layanan Kg)</option>
                  ) : (
                    catalog.filter(c => c.unitType === 'KG').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — Rp {c.price.toLocaleString('id-ID')}/Kg
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={handleAddFromScale}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>+ Masuk Nota</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ─── FILTER KATEGORI & PENCARIAN ─────────────────────────────────── */}
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {[
              { id: 'ALL', label: 'Semua Layanan' },
              { id: 'KILOAN', label: '🧺 Cuci Kiloan' },
              { id: 'SATUAN', label: '👔 Bedcover & Satuan' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic?.(10);
                  setActiveCategoryTab(tab.id as any);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeCategoryTab === tab.id
                    ? 'bg-white text-cyan-700 shadow-xs border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari layanan, bedcover, jas, sprei..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* ─── GRID KARTU LAYANAN (CLEAN LIGHT CARDS) ───────────────────────── */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-max">
          {isLoadingCatalog ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-slate-400">
              <RefreshCw size={32} className="animate-spin text-cyan-600 mb-2" />
              <p className="text-xs font-bold text-slate-600">Memuat katalog layanan laundry...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center text-slate-400">
              <Shirt size={48} className="text-slate-300 stroke-1 mb-3" />
              <p className="text-sm font-bold text-slate-700">Belum ada layanan cuci</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Layanan laundry dapat dikelola melalui menu Produk.
              </p>
            </div>
          ) : (
            filteredCatalog.map(item => {
            const isKilo = item.unitType === 'KG';
            return (
              <div
                key={item.id}
                onClick={() => handleSelectServiceCard(item)}
                className="group relative p-4 rounded-2xl bg-white hover:border-cyan-500 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {item.imageUrl && (
                    <div className="w-full h-28 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl relative bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      isKilo
                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {isKilo ? 'Per Kilo (Kg)' : 'Satuan (Pcs)'}
                    </span>
                    <div className="w-7 h-7 rounded-xl bg-slate-50 group-hover:bg-cyan-600 flex items-center justify-center text-slate-500 group-hover:text-white transition-colors border border-slate-200 group-hover:border-cyan-600">
                      <Plus size={14} />
                    </div>
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-2.5 group-hover:text-cyan-700 transition-colors line-clamp-1">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Tarif</span>
                  <span className="text-xs sm:text-sm font-black text-cyan-700 font-mono">
                    Rp {item.price.toLocaleString('id-ID')}
                    <span className="text-[10px] text-slate-400 font-normal"> / {item.unitType.toLowerCase()}</span>
                  </span>
                </div>
              </div>
            );
          }))}
        </div>

      </div>

      {/* ─── KANAN (40%): LIVE NOTA TICKET, SCENT BAR & CHECKOUT DOCK (LIGHT THEME) ─── */}
      <div className="pos-sidebar w-[420px] xl:w-[480px] flex-shrink-0 flex flex-col h-full bg-white border-l border-slate-200 overflow-hidden shadow-lg">
        
        {/* Header Nota: Data Pelanggan & ETA */}
        <div className="p-3.5 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <User size={14} className="text-cyan-600" />
              Data Pelanggan & Waktu
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${speedDetails.badgeBg}`}>
              <Clock size={11} /> {estimatedDateString}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nama Pelanggan *"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition font-medium"
            />
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
              <input
                type="tel"
                placeholder="WhatsApp (Notif)"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition font-medium"
              />
            </div>
          </div>
        </div>

        {/* ─── SCENT & PARFUM BAR (AROMA SELECTION) ─────────────────────────── */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/60 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Droplets size={12} className="text-cyan-600" />
              Aroma Parfum Laundry:
            </span>
            <span className="text-[11px] font-bold text-cyan-700">
              {perfumeVariant}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {SCENT_OPTIONS.map(opt => {
              const isSelected = perfumeVariant === opt.name;
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => { triggerHaptic?.(10); setPerfumeVariant(opt.name); }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? opt.activeClass
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={opt.desc}
                >
                  {opt.badge}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── TREATMENT TAGS & JUMLAH HELAI ─────────────────────────────────── */}
        <div className="p-3 border-b border-slate-200 bg-white shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Kondisi / Treatment:
            </span>
            {/* Quick Pieces Counter */}
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold">Helai:</span>
              <button 
                type="button" 
                onClick={() => setItemPieces(Math.max(0, itemPieces - 1))}
                className="w-4 h-4 rounded text-xs font-black text-slate-600 hover:text-slate-900"
              >
                -
              </button>
              <span className="text-xs font-mono font-bold text-cyan-700 px-1">{itemPieces}</span>
              <button 
                type="button" 
                onClick={() => setItemPieces(itemPieces + 1)}
                className="w-4 h-4 rounded text-xs font-black text-slate-600 hover:text-slate-900"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {TREATMENT_TAGS.map(tag => {
              const isSelected = selectedTags.includes(tag.label);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.label)}
                  className={`text-[10px] px-2 py-0.8 rounded-lg font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? tag.activeClass
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── DAFTAR ITEM KERANJANG (LIVE TICKET LIST) ──────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                <Receipt size={26} />
              </div>
              <h4 className="text-xs font-bold text-slate-700 mb-1">Keranjang Nota Masih Kosong</h4>
              <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                Timbang berat kiloan di panel LED sebelah kiri atau klik kartu pakaian satuan untuk memasukkan cucian.
              </p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.id}
                className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                      item.unitType === 'KG'
                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {item.unitType}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 truncate">{item.serviceName}</h5>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    @ Rp {item.pricePerUnit.toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Qty Counter & Subtotal */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateCartQty(item.id, item.qty - (item.unitType === 'KG' ? 0.5 : 1))}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-12 text-center text-xs font-mono font-black text-cyan-800">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateCartQty(item.id, item.qty + (item.unitType === 'KG' ? 0.5 : 1))}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <div className="text-xs font-black text-slate-900 font-mono">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCartItem(item.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── DUAL-PAYMENT DOCK & CHECKOUT PANEL ───────────────────────────── */}
        <div className="p-3.5 bg-white border-t border-slate-200 space-y-3 shrink-0 shadow-lg">
          
          {/* Subtotal, Surcharge, & Total */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal Layanan</span>
              <span className="font-mono text-slate-900 font-bold">Rp {subtotalCart.toLocaleString('id-ID')}</span>
            </div>

            {speedSurcharge > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Biaya Prioritas ({speedDetails.label})</span>
                <span className="font-mono">+Rp {speedSurcharge.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Total Tagihan</span>
              <span className="text-xl sm:text-2xl font-black text-cyan-700 font-mono">
                Rp {totalPayable.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Dual-Payment Switcher */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPaymentOption('PAY_NOW')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                paymentOption === 'PAY_NOW'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Check size={14} className={paymentOption === 'PAY_NOW' ? 'inline' : 'hidden'} />
              <span>Bayar di Awal (Lunas)</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentOption('PAY_LATER')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                paymentOption === 'PAY_LATER'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Clock size={14} className={paymentOption === 'PAY_LATER' ? 'inline' : 'hidden'} />
              <span>Bayar Saat Ambil</span>
            </button>
          </div>

          {/* Metode Pembayaran Jika Bayar Sekarang */}
          {paymentOption === 'PAY_NOW' && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {[
                { id: 'CASH', label: 'Tunai', icon: Wallet },
                { id: 'QRIS', label: 'QRIS', icon: QrCode },
                { id: 'TRANSFER', label: 'Transfer', icon: CreditCard }
              ].map(m => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Primary Action Submit Button */}
          <button
            onClick={handleSubmitLaundryOrder}
            disabled={isSubmitting || cart.length === 0}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              cart.length === 0 || isSubmitting
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-cyan-600/20 active:scale-[0.99]'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw size={18} className="animate-spin text-white" />
            ) : (
              <Printer size={18} />
            )}
            <span>
              {paymentOption === 'PAY_NOW' ? 'Simpan & Bayar Lunas (F9)' : 'Simpan Nota Cuci (Bayar Nanti)'}
            </span>
          </button>
        </div>

      </div>

      {/* ─── MODAL CETAK STRUK THERMAL ───────────────────────────────────────── */}
      {showReceiptModal && createdOrder && (
        <LaundryReceiptPrinter 
          order={createdOrder}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* ─── MODAL KONFIGURASI TIMBANGAN DIGITAL ─────────────────────────────── */}
      <DigitalScaleModal
        isOpen={showScaleModal}
        onClose={() => setShowScaleModal(false)}
        onApplyWeight={w => setScaleWeight(w.toFixed(2))}
      />

    </div>
  );
};

export default POSLaundry;
