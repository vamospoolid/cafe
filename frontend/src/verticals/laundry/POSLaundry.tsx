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
  Lock,
  Camera,
  Ruler,
  Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { offlineDb } from '../../db/offlineDb';
import { LaundryReceiptPrinter } from './LaundryReceiptPrinter';
import { scaleDriver, type ScaleConnectionStatus } from '../../utils/digitalScaleDriver';
import { DigitalScaleModal } from './DigitalScaleModal';
import LaundryPortalQrisModal from './LaundryPortalQrisModal';

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
  const { token, user, triggerHaptic, activeShift } = usePOS();

  // State Pelanggan & Member Kuota/Deposit
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerQuotaKg, setCustomerQuotaKg] = useState<number>(0);
  const [customerDeposit, setCustomerDeposit] = useState<number>(0);
  const [memberList, setMemberList] = useState<any[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  // Modal Top-Up Paket Kuota Kg / Deposit Member
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupType, setTopupType] = useState<'QUOTA_KG' | 'DEPOSIT'>('QUOTA_KG');
  const [topupKg, setTopupKg] = useState<string>('30');
  const [topupDepositAmt, setTopupDepositAmt] = useState<string>('150000');
  const [topupPricePaid, setTopupPricePaid] = useState<string>('180000');
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [topupPackageName, setTopupPackageName] = useState<string>('Paket Langganan 30 Kg');
  const [isSubmittingTopup, setIsSubmittingTopup] = useState(false);

  // State Foto Kondisi Pakaian Masuk (Anti-Komplain)
  const [intakePhotos, setIntakePhotos] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // State Kalkulator Dimensi Karpet & Gorden (P x L = m²)
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [meterServiceName, setMeterServiceName] = useState('Cuci Karpet / Gorden');
  const [meterPricePerM2, setMeterPricePerM2] = useState<string>('15000');
  const [meterLength, setMeterLength] = useState<string>('3.0');
  const [meterWidth, setMeterWidth] = useState<string>('2.0');

  // State Preferensi Laundry
  const [serviceSpeed, setServiceSpeed] = useState<'REGULAR' | 'KILAT_24H' | 'EXPRESS_6H'>('REGULAR');
  const [perfumeVariant, setPerfumeVariant] = useState('Sakura Fresh');
  const [itemPieces, setItemPieces] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');
  const [deliveryType, setDeliveryType] = useState<'WALK_IN' | 'PICKUP_ONLY' | 'DELIVERY_ONLY' | 'FULL_SERVICE'>('WALK_IN');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

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

  // Dual/Triple-Payment & Pembayaran (Lunas | DP Sebagian | Bayar Saat Ambil)
  const [paymentOption, setPaymentOption] = useState<'PAY_NOW' | 'PAY_DP' | 'PAY_LATER'>('PAY_NOW');
  const [showPortalQrisModal, setShowPortalQrisModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER' | 'QUOTA_KG' | 'DEPOSIT'>('CASH');
  const [dpAmountInput, setDpAmountInput] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Mobile Bottom Sheet Drawer & Customer Quick Modal (Opsi A: Moka / GoFood UX)
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isCustomerQuickModalOpen, setIsCustomerQuickModalOpen] = useState(false);

  const totalKiloQty = useMemo(() => {
    return cart.filter(i => i.unitType === 'KG').reduce((acc, i) => acc + i.qty, 0);
  }, [cart]);

  const handleQuickCashTender = (amt: number) => {
    triggerHaptic?.(10);
    setCashTendered(String(amt));
  };

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
            const prodName = (p.name || '').toUpperCase();
            const isMeter = uom === 'METER' || uom === 'M2' || uom === 'M²' || prodName.includes('KARPET') || prodName.includes('GORDEN');
            const isPcs = !isMeter && (uom === 'PCS' || catName.includes('SATUAN') || catName.includes('SEPATU') || catName.includes('BEDCOVER'));
            return {
              id: p.id,
              name: p.name,
              category: (isPcs || isMeter) ? 'SATUAN' : 'KILOAN',
              unitType: isMeter ? 'METER' : isPcs ? 'PCS' : 'KG',
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
        console.warn('[POSLaundry] Gagal memuat produk dari server, beralih ke cache offline:', err);
        try {
          const cached = await offlineDb.getCachedProducts(user?.tenantId);
          if (cached && cached.length > 0) {
            const mapped: ServiceCatalogItem[] = cached.map((p: any) => {
              const uom = (p.baseUom || p.unit || '').toUpperCase();
              const catName = (p.categoryName || p.category?.name || '').toUpperCase();
              const prodName = (p.name || '').toUpperCase();
              const isMeter = uom === 'METER' || uom === 'M2' || uom === 'M²' || prodName.includes('KARPET') || prodName.includes('GORDEN');
              const isPcs = !isMeter && (uom === 'PCS' || catName.includes('SATUAN') || catName.includes('SEPATU') || catName.includes('BEDCOVER'));
              return {
                id: p.id,
                name: p.name,
                category: (isPcs || isMeter) ? 'SATUAN' : 'KILOAN',
                unitType: isMeter ? 'METER' : isPcs ? 'PCS' : 'KG',
                price: Number(p.sellPrice ?? p.price ?? 0),
                description: p.description || '',
                imageUrl: p.imageUrl || ''
              };
            });
            setCatalog(mapped);
            const firstKilo = mapped.find(m => m.unitType === 'KG') || mapped[0] || null;
            if (firstKilo) setScaleService(firstKilo);
          }
        } catch (cacheErr) {
          console.error('[POSLaundry] Gagal membaca cache lokal:', cacheErr);
        }
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchServices();
  }, [token, user?.tenantId]);

  // Fetch Daftar Member Laundry (Deposit & Kuota Kg)
  const fetchLaundryMembers = async (q = '') => {
    if (!token) return;
    try {
      const res = await fetch(`/api/laundry/customers?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMemberList(data.customers || []);
      }
    } catch (err) {
      console.warn('[POSLaundry] Gagal memuat daftar member:', err);
    }
  };

  useEffect(() => {
    fetchLaundryMembers();
  }, [token]);

  const handleSelectMember = (m: any) => {
    triggerHaptic?.(10);
    setCustomerId(m.id);
    setCustomerName(m.name);
    setCustomerPhone(m.phone || '');
    setCustomerQuotaKg(Number(m.laundryQuotaKg) || 0);
    setCustomerDeposit(Number(m.laundryDeposit) || 0);
    setShowMemberDropdown(false);
    toast(`Member ${m.name} dipilih`, 'info');
  };

  // Handler Top-Up Paket Kuota Kg / Deposit Member
  const handleSubmitMemberTopup = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast('Masukkan Nama dan No. WhatsApp pelanggan terlebih dahulu', 'error');
      return;
    }
    if (!activeShift) {
      toast('Harap buka shift kasir terlebih dahulu sebelum menerima pembayaran paket member.', 'warning');
      return;
    }
    setIsSubmittingTopup(true);
    try {
      const res = await fetch('/api/laundry/customers/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          topupType,
          addedQuotaKg: topupType === 'QUOTA_KG' ? parseFloat(topupKg) || 0 : 0,
          addedDeposit: topupType === 'DEPOSIT' ? parseFloat(topupDepositAmt) || 0 : 0,
          pricePaid: parseFloat(topupPricePaid) || 0,
          paymentMethod: topupPaymentMethod,
          packageName: topupPackageName
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan top-up member');
      }
      toast(data.message || 'Top-up member berhasil!', 'success');
      if (data.customer) {
        setCustomerId(data.customer.id);
        setCustomerQuotaKg(Number(data.customer.laundryQuotaKg) || 0);
        setCustomerDeposit(Number(data.customer.laundryDeposit) || 0);
      }
      fetchLaundryMembers();
      setShowTopupModal(false);
    } catch (err: any) {
      toast(err.message || 'Gagal top-up member', 'error');
    } finally {
      setIsSubmittingTopup(false);
    }
  };

  // Handler Foto Kondisi Pakaian Masuk (Kompresi Canvas Ringan)
  const handleCaptureIntakePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (intakePhotos.length >= 3) {
      toast('Maksimal 3 foto bukti kondisi pakaian per nota', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 640;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.68);
          setIntakePhotos(prev => [...prev.slice(0, 2), compressedDataUrl]);
          toast('📷 Foto kondisi pakaian berhasil dilampirkan', 'success');
        }
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handler Kalkulator Dimensi Karpet & Gorden (P x L = m²)
  const handleOpenMeterCalculator = (item?: ServiceCatalogItem) => {
    triggerHaptic?.(10);
    if (item) {
      setMeterServiceName(item.name);
      setMeterPricePerM2(String(item.price || 15000));
    } else {
      const foundMeter = catalog.find(c => c.unitType === 'METER');
      setMeterServiceName(foundMeter?.name || 'Cuci Karpet / Gorden');
      setMeterPricePerM2(String(foundMeter?.price || 15000));
    }
    setMeterLength('3.0');
    setMeterWidth('2.0');
    setShowMeterModal(true);
  };

  const computedMeterArea = useMemo(() => {
    const l = Math.max(0.1, parseFloat(meterLength) || 0);
    const w = Math.max(0.1, parseFloat(meterWidth) || 0);
    return parseFloat((l * w).toFixed(2));
  }, [meterLength, meterWidth]);

  const computedMeterSubtotal = useMemo(() => {
    const p = Math.max(0, parseFloat(meterPricePerM2) || 0);
    return Math.round(computedMeterArea * p);
  }, [computedMeterArea, meterPricePerM2]);

  const handleAddMeterItemToCart = () => {
    triggerHaptic?.(15);
    if (computedMeterArea <= 0) {
      toast('Masukkan Panjang dan Lebar (meter) yang valid', 'error');
      return;
    }
    const price = Math.max(0, parseFloat(meterPricePerM2) || 0);
    const dimNote = `Ukuran: ${parseFloat(meterLength).toFixed(1)}m × ${parseFloat(meterWidth).toFixed(1)}m (${computedMeterArea} m²)`;
    setCart(prev => [
      ...prev,
      {
        id: `meter-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        serviceName: meterServiceName.trim() || 'Cuci Karpet / Gorden',
        unitType: 'METER',
        qty: computedMeterArea,
        pricePerUnit: price,
        subtotal: computedMeterSubtotal,
        notes: dimNote
      }
    ]);
    setShowMeterModal(false);
    toast(`+${computedMeterArea} m² ${meterServiceName} masuk nota!`, 'success');
  };

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
    const raw = subtotalCart + speedSurcharge + (Number(deliveryFee) || 0) - discountAmount;
    return Math.max(0, raw);
  }, [subtotalCart, speedSurcharge, discountAmount, deliveryFee]);

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
    } else if (item.unitType === 'METER') {
      handleOpenMeterCalculator(item);
    } else {
      // Satuan: Langsung tambahkan 1 pcs
      setCart(prev => {
        const existing = prev.find(i => i.serviceName === item.name && i.unitType === 'PCS');
        if (existing) {
          return prev.map(i => (i.serviceName === item.name && i.unitType === 'PCS')
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
        const qtyFixed = (it.unitType === 'KG' || it.unitType === 'METER') ? parseFloat(newQty.toFixed(2)) : Math.round(newQty);
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

    const isPaidNow = paymentOption === 'PAY_NOW';
    const isPayDp = paymentOption === 'PAY_DP';
    const parsedDp = Math.max(0, parseFloat(dpAmountInput) || 0);

    if (isPayDp && (parsedDp <= 0 || parsedDp >= totalPayable)) {
      toast('Masukkan nominal Uang Muka (DP) yang valid (di atas Rp 0 dan di bawah Total Tagihan)', 'error');
      return;
    }

    let quotaKgUsed = 0;
    let depositUsed = 0;
    let finalPaidAmount = isPaidNow ? totalPayable : isPayDp ? parsedDp : 0;

    if ((isPaidNow || isPayDp) && paymentMethod === 'QUOTA_KG') {
      if (totalKiloQty <= 0) {
        toast('Metode Potong Kuota Kg hanya dapat digunakan untuk layanan Kiloan (Kg).', 'error');
        return;
      }
      if (customerQuotaKg < totalKiloQty) {
        toast(`Sisa Kuota Kg member (${customerQuotaKg} Kg) tidak cukup untuk ${totalKiloQty} Kg.`, 'error');
        return;
      }
      quotaKgUsed = parseFloat(totalKiloQty.toFixed(2));
      finalPaidAmount = totalPayable;
    } else if ((isPaidNow || isPayDp) && paymentMethod === 'DEPOSIT') {
      if (customerDeposit < finalPaidAmount) {
        toast(`Saldo Deposit member (Rp ${customerDeposit.toLocaleString('id-ID')}) tidak mencukupi.`, 'error');
        return;
      }
      depositUsed = finalPaidAmount;
    }

    const requiresCashierShift = (isPaidNow || isPayDp) && paymentMethod !== 'QUOTA_KG' && paymentMethod !== 'DEPOSIT';
    if (requiresCashierShift && !activeShift) {
      toast('Silakan buka shift kasir dan masukkan modal awal laci terlebih dahulu sebelum melayani pembayaran tunai/non-tunai.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentStatus = finalPaidAmount >= totalPayable ? 'PAID' : finalPaidAmount > 0 ? 'PARTIAL' : 'UNPAID';

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
        deliveryType,
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryNotes: deliveryNotes.trim() || undefined,
        deliveryFee: Number(deliveryFee) || 0,
        items: cart.map(it => ({
          serviceName: it.serviceName,
          unitType: it.unitType,
          qty: it.qty,
          pricePerUnit: it.pricePerUnit,
          subtotal: it.subtotal,
          notes: it.notes
        })),
        subtotal: subtotalCart,
        speedSurcharge,
        discount: discountAmount,
        totalAmount: totalPayable,
        paidAmount: finalPaidAmount,
        paymentStatus,
        paymentMethod: (isPaidNow || isPayDp) ? paymentMethod : undefined,
        quotaKgUsed,
        depositUsed,
        intakePhotos: intakePhotos.length > 0 ? intakePhotos : undefined,
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
      setCustomerQuotaKg(0);
      setCustomerDeposit(0);
      setItemPieces(0);
      setSelectedTags([]);
      setIntakePhotos([]);
      setCustomNotes('');
      setCashTendered('');
      setDpAmountInput('');
      setDiscountAmount(0);
      setServiceSpeed('REGULAR');
      setPaymentOption('PAY_NOW');
      setPaymentMethod('CASH');
      fetchLaundryMembers();
    } catch (err: any) {
      console.error('[POSLaundry] Error submitting:', err);
      toast(err.message || 'Gagal membuat nota cucian', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper Render: Checkout & Nota Panel (Digunakan oleh Desktop Sidebar dan Mobile Bottom Sheet Drawer)
  const renderCheckoutSidebar = (isDrawerMode: boolean = false) => (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header Nota */}
      {isDrawerMode ? (
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Receipt size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black">Rincian Nota & Kasir</h3>
              <p className="text-[10px] text-slate-400">{cart.length} item cucian terpilih</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCartDrawerOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <User size={14} className="text-cyan-600" />
            Data Pelanggan & Waktu
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${speedDetails.badgeBg}`}>
            <Clock size={11} /> {estimatedDateString}
          </span>
        </div>
      )}

      {/* Konten Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-0">
        {/* Form Pelanggan & Member Kuota / Deposit */}
        <div className="p-3.5 border-b border-slate-200 bg-white space-y-2.5 relative">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowMemberDropdown(prev => !prev)}
              className="text-[10px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition"
            >
              <Award size={11} />
              <span>{customerId ? 'Ganti Member' : 'Pilih Member Langganan'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTopupModal(true)}
              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition"
            >
              <Plus size={11} />
              <span>Beli Paket Kuota / Deposit</span>
            </button>
          </div>

          {showMemberDropdown && (
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto space-y-1 shadow-inner">
              {memberList.length === 0 ? (
                <div className="text-[11px] text-slate-400 text-center py-2">Belum ada member terdaftar</div>
              ) : (
                memberList.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMember(m)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{m.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.phone}</div>
                    </div>
                    <div className="text-right space-y-0.5">
                      {Number(m.laundryQuotaKg) > 0 && (
                        <span className="block text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800">
                          {Number(m.laundryQuotaKg).toFixed(1)} Kg
                        </span>
                      )}
                      {Number(m.laundryDeposit) > 0 && (
                        <span className="block text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Rp {Number(m.laundryDeposit).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Nama Pelanggan *
              </label>
              <input
                type="text"
                placeholder="Nama Pelanggan *"
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);
                  const matched = memberList.find(m => m.name.toLowerCase() === e.target.value.trim().toLowerCase());
                  if (matched) {
                    setCustomerId(matched.id);
                    setCustomerPhone(matched.phone || customerPhone);
                    setCustomerQuotaKg(Number(matched.laundryQuotaKg) || 0);
                    setCustomerDeposit(Number(matched.laundryDeposit) || 0);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition font-medium"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                WhatsApp (Notif)
              </label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                <input
                  type="tel"
                  placeholder="0812xxxx"
                  value={customerPhone}
                  onChange={e => {
                    setCustomerPhone(e.target.value);
                    const matched = memberList.find(m => m.phone === e.target.value.trim());
                    if (matched) {
                      setCustomerId(matched.id);
                      setCustomerName(matched.name);
                      setCustomerQuotaKg(Number(matched.laundryQuotaKg) || 0);
                      setCustomerDeposit(Number(matched.laundryDeposit) || 0);
                    }
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition font-medium"
                />
              </div>
            </div>
          </div>

          {(customerQuotaKg > 0 || customerDeposit > 0) && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-50 to-emerald-50 border border-cyan-200 text-[11px]">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Award size={13} className="text-cyan-600 shrink-0" />
                <span>Saldo Member:</span>
              </div>
              <div className="flex items-center gap-2 font-mono font-black">
                {customerQuotaKg > 0 && (
                  <span className="text-cyan-800 bg-white px-2 py-0.5 rounded-md border border-cyan-200">
                    🧺 {customerQuotaKg.toFixed(2)} Kg
                  </span>
                )}
                {customerDeposit > 0 && (
                  <span className="text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    💳 Rp {customerDeposit.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Aroma Parfum Scroller */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Droplets size={12} className="text-cyan-600" />
              Aroma Parfum:
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
                >
                  {opt.badge}
                </button>
              );
            })}
          </div>
        </div>

        {/* Treatment Tags & Helai */}
        <div className="p-3 border-b border-slate-200 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Kondisi / Treatment:
            </span>
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

            {/* Tombol Ambil Foto Kondisi Pakaian Masuk (Anti-Komplain) */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCaptureIntakePhoto}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="text-[10px] px-2.5 py-0.8 rounded-lg font-bold border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 flex items-center gap-1 cursor-pointer transition"
              title="Ambil foto bukti kondisi pakaian saat diterima"
            >
              <Camera size={11} />
              <span>Foto Bukti ({intakePhotos.length}/3)</span>
            </button>
          </div>

          {intakePhotos.length > 0 && (
            <div className="flex items-center gap-2 pt-1 overflow-x-auto">
              {intakePhotos.map((src, idx) => (
                <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 shrink-0 group">
                  <img src={src} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setIntakePhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-black cursor-pointer"
                    title="Hapus foto"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mode Layanan Antar-Jemput */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Pengantaran / Jemput:
            </span>
            <span className="text-[10px] font-black text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
              {deliveryType === 'WALK_IN' ? 'Di Toko' : deliveryType === 'FULL_SERVICE' ? 'Antar - Jemput' : deliveryType === 'PICKUP_ONLY' ? 'Jemput Saja' : 'Antar Saja'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setDeliveryType('WALK_IN'); }}
              className={`py-1.5 px-2 rounded-xl font-bold border transition text-[11px] ${deliveryType === 'WALK_IN' ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              🏢 Walk-In
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setDeliveryType('FULL_SERVICE'); }}
              className={`py-1.5 px-2 rounded-xl font-bold border transition text-[11px] ${deliveryType === 'FULL_SERVICE' ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              🛵 Antar - Jemput
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setDeliveryType('PICKUP_ONLY'); }}
              className={`py-1.5 px-2 rounded-xl font-bold border transition text-[11px] ${deliveryType === 'PICKUP_ONLY' ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              📥 Jemput Saja
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic?.(10); setDeliveryType('DELIVERY_ONLY'); }}
              className={`py-1.5 px-2 rounded-xl font-bold border transition text-[11px] ${deliveryType === 'DELIVERY_ONLY' ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              📤 Antar Saja
            </button>
          </div>

          {deliveryType !== 'WALK_IN' && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs animate-in fade-in">
              <input
                type="text"
                placeholder="Alamat penjemputan / pengantaran..."
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 focus:border-cyan-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold">Ongkir (Rp):</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={deliveryFee || ''}
                    onChange={e => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-cyan-700 outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold">Patokan Rumah:</span>
                  <input
                    type="text"
                    placeholder="Depan gapura..."
                    value={deliveryNotes}
                    onChange={e => setDeliveryNotes(e.target.value)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Daftar Item Keranjang */}
        <div className="p-3 space-y-2 bg-slate-50/50">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Item Cucian ({cart.length})</span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-rose-500 hover:text-rose-700 text-[10px] font-bold cursor-pointer"
              >
                Kosongkan
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2 shadow-2xs">
                <Receipt size={22} />
              </div>
              <h4 className="text-xs font-bold text-slate-700 mb-0.5">Keranjang Nota Masih Kosong</h4>
              <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                Timbang berat kiloan di panel LED atau pilih pakaian satuan untuk menambahkan layanan.
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
                        : item.unitType === 'METER'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {item.unitType === 'METER' ? 'M²' : item.unitType}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 truncate">{item.serviceName}</h5>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    @ Rp {item.pricePerUnit.toLocaleString('id-ID')}
                  </div>
                  {item.notes && (
                    <div className="text-[10px] text-amber-700 font-medium mt-0.5 truncate">
                      📐 {item.notes}
                    </div>
                  )}
                </div>

                {/* Qty Counter & Subtotal */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateCartQty(item.id, item.qty - (item.unitType === 'KG' || item.unitType === 'METER' ? 0.5 : 1))}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-11 text-center text-xs font-mono font-black text-cyan-800">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateCartQty(item.id, item.qty + (item.unitType === 'KG' || item.unitType === 'METER' ? 0.5 : 1))}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  <div className="text-right min-w-[65px]">
                    <div className="text-xs font-black text-slate-900 font-mono">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCartItem(item.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Finansial & Checkout Dock */}
      <div className={`p-3.5 bg-white border-t border-slate-200 space-y-2.5 shrink-0 shadow-lg ${isDrawerMode ? 'pb-8 sm:pb-5' : ''}`}>
        <div className="space-y-1 text-xs text-slate-600">
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

          <div className="pt-1.5 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Total Tagihan</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-700 font-mono">
              Rp {totalPayable.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Triple-Payment Switcher: Lunas | Bayar DP | Bayar Saat Ambil */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => setPaymentOption('PAY_NOW')}
            className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              paymentOption === 'PAY_NOW'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Check size={12} className={paymentOption === 'PAY_NOW' ? 'inline' : 'hidden'} />
            <span>Bayar Lunas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPaymentOption('PAY_DP');
              if (!dpAmountInput && totalPayable > 0) {
                setDpAmountInput(String(Math.round(totalPayable * 0.5)));
              }
            }}
            className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              paymentOption === 'PAY_DP'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Wallet size={12} className={paymentOption === 'PAY_DP' ? 'inline' : 'hidden'} />
            <span>Bayar DP</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentOption('PAY_LATER')}
            className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              paymentOption === 'PAY_LATER'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Clock size={12} className={paymentOption === 'PAY_LATER' ? 'inline' : 'hidden'} />
            <span>Saat Ambil</span>
          </button>
        </div>

        {/* Input Nominal DP jika memilih Bayar DP */}
        {paymentOption === 'PAY_DP' && (
          <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-blue-900">Nominal Uang Muka (DP):</span>
              <div className="flex items-center gap-1">
                {[0.25, 0.5].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDpAmountInput(String(Math.round(totalPayable * pct)))}
                    className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
                  >
                    {pct * 100}%
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              placeholder="Masukkan nominal DP (Rp)..."
              value={dpAmountInput}
              onChange={e => setDpAmountInput(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-600"
            />
            <div className="flex justify-between text-[11px] font-bold text-rose-700 px-0.5">
              <span>Sisa Tagihan Saat Ambil:</span>
              <span className="font-mono">
                Rp {Math.max(0, totalPayable - (parseFloat(dpAmountInput) || 0)).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        )}

        {/* Metode Pembayaran Jika Bayar Sekarang atau Bayar DP */}
        {(paymentOption === 'PAY_NOW' || paymentOption === 'PAY_DP') && (
          <div className="space-y-1.5 pt-0.5">
            <div className="grid grid-cols-3 gap-1.5">
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
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Opsi Potong Kuota Kg / Saldo Deposit jika pelanggan punya saldo */}
            {paymentOption === 'PAY_NOW' && (customerQuotaKg > 0 || customerDeposit > 0) && (
              <div className="grid grid-cols-2 gap-1.5">
                {customerQuotaKg > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QUOTA_KG')}
                    className={`py-1.5 px-2 rounded-xl text-[10.5px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      paymentMethod === 'QUOTA_KG'
                        ? 'border-cyan-600 bg-cyan-600 text-white shadow-xs'
                        : 'border-cyan-200 bg-cyan-50/70 text-cyan-800 hover:bg-cyan-100'
                    }`}
                  >
                    <Award size={12} />
                    <span>Potong Kuota ({customerQuotaKg.toFixed(1)} Kg)</span>
                  </button>
                )}
                {customerDeposit > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DEPOSIT')}
                    className={`py-1.5 px-2 rounded-xl text-[10.5px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      paymentMethod === 'DEPOSIT'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    <Wallet size={12} />
                    <span>Potong Deposit</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick Cash Amounts for Mobile / APK */}
            {paymentMethod === 'CASH' && paymentOption === 'PAY_NOW' && (
              <div className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleQuickCashTender(totalPayable)}
                    className="px-2 py-0.8 rounded-lg text-[10.5px] font-bold bg-white hover:bg-cyan-50 text-cyan-800 border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    Uang Pas
                  </button>
                  {[20000, 50000, 100000].map(amt => (
                    amt >= totalPayable && (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCashTender(amt)}
                        className="px-2 py-0.8 rounded-lg text-[10.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
                      >
                        Rp {amt.toLocaleString('id-ID')}
                      </button>
                    )
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Uang Tunai Diterima..."
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:border-cyan-500"
                />
                {parseFloat(cashTendered) > totalPayable && (
                  <div className="text-[11px] font-bold text-emerald-700 flex justify-between px-1">
                    <span>Kembalian:</span>
                    <span className="font-mono">Rp {changeDue.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>
            )}
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
            {paymentOption === 'PAY_NOW'
              ? paymentMethod === 'QUOTA_KG'
                ? `Simpan & Potong Kuota (${totalKiloQty.toFixed(2)} Kg)`
                : 'Simpan & Bayar Lunas (F9)'
              : paymentOption === 'PAY_DP'
              ? `Simpan & Bayar DP (Rp ${(parseFloat(dpAmountInput) || 0).toLocaleString('id-ID')})`
              : 'Simpan Nota Cuci (Bayar Nanti)'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="pos-layout h-full w-full overflow-hidden flex flex-col lg:flex-row bg-slate-100 text-slate-800 font-sans relative" style={{ height: '100%' }}>
      
      {/* ─── KIRI (100% LEBAR DI MOBILE / DESKTOP UTAMA): DECK OPERASIONAL TIMBANGAN DIGITAL & KATALOG ─── */}
      <div className="pos-main w-full flex-1 flex flex-col h-full overflow-y-auto p-3 sm:p-4 gap-3 bg-slate-50 border-r border-slate-200 pb-44 lg:pb-4">
        
        {/* Top Header Desktop (Hanya Tampil di Layar Besar) */}
        <div className="hidden lg:flex bg-white p-3.5 rounded-2xl border border-slate-200 items-center justify-between gap-3 shadow-xs shrink-0">
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

          {/* Quick Speed SLA Selector Desktop */}
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
              className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-all flex items-center gap-1 cursor-pointer"
              title="Buka Papan Kanban Rak"
            >
              <Layers size={13} />
              <span>Papan Rak</span>
            </button>
          </div>
        </div>

        {/* ─── TOP QUICK BAR MOBILE (RAMPING 1-BARIS, TOUCH-FRIENDLY, HANYA DI MOBILE) ─── */}
        <div className="lg:hidden bg-white p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-1.5 shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {/* Chip Pelanggan */}
            <button
              type="button"
              onClick={() => setIsCustomerQuickModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 shrink-0 transition cursor-pointer active:scale-95"
            >
              <User size={13} className="text-cyan-600" />
              <span className="truncate max-w-[100px]">{customerName || 'Pelanggan'}</span>
            </button>

            {/* Chip Parfum */}
            <button
              type="button"
              onClick={() => setIsCustomerQuickModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 flex items-center gap-1.5 shrink-0 transition cursor-pointer active:scale-95"
            >
              <Sparkles size={12} />
              <span className="truncate max-w-[90px]">{perfumeVariant}</span>
            </button>

            {/* Chip SLA Speed Toggle */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic?.(10);
                const next = serviceSpeed === 'REGULAR' ? 'KILAT_24H' : serviceSpeed === 'KILAT_24H' ? 'EXPRESS_6H' : 'REGULAR';
                setServiceSpeed(next);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0 transition cursor-pointer active:scale-95 ${speedDetails.badgeBg}`}
            >
              <span>{serviceSpeed === 'EXPRESS_6H' ? '⚡ Express 6H' : serviceSpeed === 'KILAT_24H' ? '⚡ Kilat 24H' : '🌿 Reguler'}</span>
            </button>
          </div>

          {/* Tombol Customer App & QRIS Dinamis + Papan Rak Cucian */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPortalQrisModal(true)}
              className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Pengaturan Customer App Antar-Jemput & QRIS Dinamis Auto-Settlement"
            >
              <QrCode size={15} />
              <span className="hidden sm:inline">App Pelanggan & QRIS Dinamis</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/laundry-kanban')}
              className="p-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 shrink-0 transition cursor-pointer"
              title="Buka Papan Rak Cucian"
            >
              <Layers size={16} />
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
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2 flex-wrap shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
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

            <button
              type="button"
              onClick={() => handleOpenMeterCalculator()}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Hitung luas karpet / gorden (Panjang x Lebar = m²)"
            >
              <Ruler size={13} />
              <span>Karpet / Gorden (m²)</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari layanan, bedcover, karpet, jas..."
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
            const isMeter = item.unitType === 'METER';
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
                        : isMeter
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {isKilo ? 'Per Kilo (Kg)' : isMeter ? 'Dimensi (m²)' : 'Satuan (Pcs)'}
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

      {/* ─── FLOATING BOTTOM CHECKOUT DOCK (MOBILE ONLY / APK - SELALU TERLIHAT DI ATAS BOTTOM NAV) ─── */}
      <div className="lg:hidden fixed bottom-[74px] sm:bottom-[78px] left-3 right-3 z-40">
        {cart.length > 0 ? (
          <div 
            onClick={() => { triggerHaptic?.(20); setIsCartDrawerOpen(true); }}
            className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white p-3 rounded-2xl shadow-[0_10px_25px_rgba(8,145,178,0.4)] border border-cyan-400/60 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-md shrink-0">
                  <Receipt size={19} className="text-white" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-slate-900">
                  {cart.length}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-300 font-medium truncate flex items-center gap-1.5">
                  <span className="font-bold text-white">{customerName || 'Pelanggan Walk-in'}</span>
                  <span>•</span>
                  <span className="text-cyan-300">{speedDetails.label}</span>
                </div>
                <div className="text-sm font-black text-white font-mono flex items-center gap-1.5">
                  <span className="text-cyan-300 font-black">Rp {totalPayable.toLocaleString('id-ID')}</span>
                  {totalKiloQty > 0 && (
                    <span className="text-[10.5px] text-slate-300 font-normal">({totalKiloQty.toFixed(2)} Kg)</span>
                  )}
                </div>
              </div>
            </div>
            
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shrink-0 active:scale-95 transition-transform"
            >
              <span>Bayar & Buka Nota</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div 
            onClick={() => { triggerHaptic?.(10); setIsCartDrawerOpen(true); }}
            className="bg-white/95 backdrop-blur-md text-slate-800 p-2.5 px-3.5 rounded-2xl shadow-lg border border-slate-200/90 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <Receipt size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">Keranjang Nota Kosong (0 Item)</div>
                <div className="text-[10.5px] text-slate-400 truncate">Timbang atau pilih layanan di atas</div>
              </div>
            </div>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold text-xs border border-cyan-200 flex items-center gap-1 shrink-0 active:scale-95"
            >
              <span>Buka Nota (Rp 0)</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ─── MOBILE BOTTOM SHEET DRAWER (OPSI A: POLA MOKA POS / GOFOOD) ─── */}
      {isCartDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsCartDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-h-[90vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border-t border-cyan-500/20">
            {/* Drawer Drag Pill */}
            <div 
              onClick={() => setIsCartDrawerOpen(false)}
              className="w-full flex justify-center py-2 bg-slate-900 cursor-pointer"
            >
              <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* Konten Nota & Kasir via Helper */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {renderCheckoutSidebar(true)}
            </div>
          </div>
        </div>
      )}

      {/* ─── KANAN (DESKTOP ONLY / SIDEBAR STANDAR KASIR): LIVE NOTA TICKET & CHECKOUT DOCK ─── */}
      <div className="hidden lg:flex pos-sidebar w-[420px] xl:w-[480px] flex-shrink-0 flex-col h-full bg-white border-l border-slate-200 overflow-hidden shadow-lg">
        {renderCheckoutSidebar(false)}
      </div>

      {/* ─── MODAL CEPAT DATA PELANGGAN & AROMA PARFUM (MOBILE QUICK MODAL) ─── */}
      {isCustomerQuickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black">Pelanggan & Varian Parfum</h3>
                  <p className="text-[10px] text-slate-400">Atur kontak penerima dan pilihan aroma cuci</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerQuickModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bpk Bambang / Bu Siti"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nomor WhatsApp (Untuk Notifikasi Siap Ambil)
                </label>
                <input
                  type="tel"
                  placeholder="081234567xxx"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Pilihan Aroma Parfum</span>
                  <span className="text-cyan-700 font-bold normal-case text-xs">{perfumeVariant}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SCENT_OPTIONS.map(scent => (
                    <button
                      key={scent.name}
                      type="button"
                      onClick={() => { triggerHaptic?.(10); setPerfumeVariant(scent.name); }}
                      className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 border text-left transition-all cursor-pointer ${
                        perfumeVariant === scent.name
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-900 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-base">{scent.badge.split(' ')[0]}</span>
                      <span className="truncate">{scent.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Kecepatan Layanan (SLA)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'REGULAR', label: 'Reguler', dur: '2-3 Hari' },
                    { id: 'KILAT_24H', label: 'Kilat 24 Jam', dur: '+25%' },
                    { id: 'EXPRESS_6H', label: 'Express 6 Jam', dur: '+50%' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { triggerHaptic?.(10); setServiceSpeed(s.id as any); }}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        serviceSpeed === s.id
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-900 shadow-xs font-black'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs'
                      }`}
                    >
                      <div className="text-xs">{s.label}</div>
                      <div className="text-[10px] text-slate-500">{s.dur}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCustomerQuickModalOpen(false)}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold text-xs shadow-md shadow-cyan-600/20 cursor-pointer active:scale-[0.99]"
              >
                Selesai & Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KALKULATOR DIMENSI KARPET & GORDEN (P x L = m²) ──────────── */}
      {showMeterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Ruler size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-black">Kalkulator Karpet & Gorden (m²)</h3>
                  <p className="text-[10px] text-slate-400">Hitung otomatis luas Panjang × Lebar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMeterModal(false)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                  Nama Layanan Karpet / Gorden
                </label>
                <input
                  type="text"
                  value={meterServiceName}
                  onChange={e => setMeterServiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500">Ukuran Cepat:</span>
                {[
                  { label: '1.6 × 2.3 m', l: '2.3', w: '1.6' },
                  { label: '2.0 × 3.0 m', l: '3.0', w: '2.0' },
                  { label: '3.0 × 4.0 m', l: '4.0', w: '3.0' },
                  { label: 'Masjid 1.2 × 6.0 m', l: '6.0', w: '1.2' }
                ].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setMeterLength(preset.l);
                      setMeterWidth(preset.w);
                    }}
                    className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Panjang (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={meterLength}
                    onChange={e => setMeterLength(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Lebar (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={meterWidth}
                    onChange={e => setMeterWidth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Tarif / m² (Rp)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={meterPricePerM2}
                    onChange={e => setMeterPricePerM2(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-amber-700 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Total Luas (P × L)</div>
                  <div className="text-lg font-black font-mono text-slate-900">
                    {computedMeterArea} m²
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Subtotal Biaya</div>
                  <div className="text-lg font-black font-mono text-amber-700">
                    Rp {computedMeterSubtotal.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMeterModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddMeterItemToCart}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                + Masukkan ke Nota ({computedMeterArea} m²)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL TOP-UP PAKET KUOTA KG & SALDO DEPOSIT MEMBER ─────────────── */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Award size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-black">Paket Kuota Kg & Deposit Member</h3>
                  <p className="text-[10px] text-slate-400">Prabayar langganan laundry kos & keluarga</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTopupModal(false)}
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nama Member *</label>
                  <input
                    type="text"
                    placeholder="Nama Pelanggan"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">No. WhatsApp *</label>
                  <input
                    type="tel"
                    placeholder="0812xxxx"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTopupType('QUOTA_KG')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    topupType === 'QUOTA_KG' ? 'bg-white text-cyan-800 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  🧺 Paket Kuota (Kg)
                </button>
                <button
                  type="button"
                  onClick={() => setTopupType('DEPOSIT')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    topupType === 'DEPOSIT' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  💳 Saldo Deposit (Rp)
                </button>
              </div>

              {topupType === 'QUOTA_KG' ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { name: 'Paket Kos 15 Kg', kg: '15', price: '95000' },
                      { name: 'Paket Hemat 30 Kg', kg: '30', price: '180000' },
                      { name: 'Paket Keluarga 50 Kg', kg: '50', price: '285000' }
                    ].map((pkg, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopupPackageName(pkg.name);
                          setTopupKg(pkg.kg);
                          setTopupPricePaid(pkg.price);
                        }}
                        className="p-2 rounded-xl border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100 text-left transition cursor-pointer"
                      >
                        <div className="text-[11px] font-black text-cyan-900">{pkg.kg} Kg</div>
                        <div className="text-[10px] font-mono text-slate-600">Rp {Number(pkg.price).toLocaleString('id-ID')}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Kuota Ditambahkan (Kg)</label>
                      <input
                        type="number"
                        value={topupKg}
                        onChange={e => setTopupKg(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-cyan-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Harga Paket Dibayar (Rp)</label>
                      <input
                        type="number"
                        value={topupPricePaid}
                        onChange={e => setTopupPricePaid(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { dep: '100000', pay: '100000', label: 'Rp 100rb' },
                      { dep: '220000', pay: '200000', label: 'Rp 220rb (Bayar 200rb)' },
                      { dep: '550000', pay: '500000', label: 'Rp 550rb (Bayar 500rb)' }
                    ].map((d, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopupDepositAmt(d.dep);
                          setTopupPricePaid(d.pay);
                        }}
                        className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-left transition cursor-pointer"
                      >
                        <div className="text-[10px] font-black text-emerald-900">{d.label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Saldo Masuk (Rp)</label>
                      <input
                        type="number"
                        value={topupDepositAmt}
                        onChange={e => setTopupDepositAmt(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-emerald-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Uang Diterima Kasir (Rp)</label>
                      <input
                        type="number"
                        value={topupPricePaid}
                        onChange={e => setTopupPricePaid(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Metode Pembayaran Top-up</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['CASH', 'QRIS', 'TRANSFER'] as const).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setTopupPaymentMethod(pm)}
                      className={`py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        topupPaymentMethod === pm
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {pm === 'CASH' ? 'Tunai' : pm}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTopupModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingTopup}
                onClick={handleSubmitMemberTopup}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                {isSubmittingTopup ? 'Memproses...' : 'Simpan & Terima Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ─── MODAL CUSTOMER APP LAUNDRY & QRIS DINAMIS AUTO-SETTLEMENT ───────── */}
      <LaundryPortalQrisModal
        isOpen={showPortalQrisModal}
        onClose={() => setShowPortalQrisModal(false)}
        token={token || ''}
      />

    </div>
  );
};

export default POSLaundry;
