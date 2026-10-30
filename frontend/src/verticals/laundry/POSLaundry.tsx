import React, { useState, useEffect, useMemo } from 'react';
import {
  Shirt,
  Search,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Printer,
  Check,
  Clock,
  CreditCard,
  Wallet,
  QrCode,
  Layers,
  Scale,
  Phone,
  User,
  X,
  Receipt,
  CheckCircle2,
  Zap,
  Package,
  Settings2,
  Camera,
  Ruler,
  Award,
  Bike,
  MapPin,
  Save,
  Star,
  Store,
  Building2,
  Smartphone
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
  iconType?: string;
}

interface ServiceCatalogItem {
  id: number;
  name: string;
  category: 'KILOAN' | 'SATUAN' | 'DRY_CLEAN' | 'SEPATU' | 'KARPET' | 'LAINNYA';
  unitType: 'KG' | 'PCS' | 'METER';
  price: number;
  description?: string;
  iconType: 'FOLDED' | 'IRONING' | 'EXPRESS' | 'HANGER' | 'SHOE' | 'CARPET' | 'BEDCOVER' | 'DOLL' | 'HELMET';
}

interface LaundryMember {
  id: number;
  name: string;
  phone: string;
  points: number;
  tier: string;
  laundryDeposit: number;
  laundryQuotaKg: number;
  lastOrderNumber?: string | null;
  lastOrderDate?: string | null;
  favoriteAddress?: string;
  outstandingPayment?: number;
}

const DEFAULT_LAUNDRY_CATALOG: ServiceCatalogItem[] = [
  {
    id: 9001,
    name: 'Cuci Kering',
    category: 'KILOAN',
    unitType: 'KG',
    price: 8000,
    description: 'Cuci bersih + kering + lipat rapi',
    iconType: 'FOLDED'
  },
  {
    id: 9002,
    name: 'Cuci Setrika',
    category: 'KILOAN',
    unitType: 'KG',
    price: 10000,
    description: 'Cuci + kering + setrika uap + parfum',
    iconType: 'IRONING'
  },
  {
    id: 9003,
    name: 'Express',
    category: 'KILOAN',
    unitType: 'KG',
    price: 18000,
    description: 'Layanan prioritas selesai cepat',
    iconType: 'EXPRESS'
  },
  {
    id: 9004,
    name: 'Dry Cleaning',
    category: 'DRY_CLEAN',
    unitType: 'PCS',
    price: 25000,
    description: 'Jas, gaun pesta, kebaya & bahan sensitif',
    iconType: 'HANGER'
  },
  {
    id: 9005,
    name: 'Sepatu',
    category: 'SEPATU',
    unitType: 'PCS',
    price: 35000,
    description: 'Deep clean sepatu sneakers / kulit',
    iconType: 'SHOE'
  },
  {
    id: 9006,
    name: 'Karpet',
    category: 'KARPET',
    unitType: 'METER',
    price: 15000,
    description: 'Cuci karpet rumah/masjid (P x L = m²)',
    iconType: 'CARPET'
  },
  {
    id: 9007,
    name: 'Bed Cover',
    category: 'SATUAN',
    unitType: 'PCS',
    price: 25000,
    description: 'Bed cover ukuran single / double / king',
    iconType: 'BEDCOVER'
  },
  {
    id: 9008,
    name: 'Boneka',
    category: 'SATUAN',
    unitType: 'PCS',
    price: 20000,
    description: 'Cuci higienis boneka bulu lembut',
    iconType: 'DOLL'
  },
  {
    id: 9009,
    name: 'Helm',
    category: 'LAINNYA',
    unitType: 'PCS',
    price: 15000,
    description: 'Cuci busa helm anti-bakteri & wangi',
    iconType: 'HELMET'
  }
];

const PERFUME_VARIANTS = [
  'Sakura Bloom',
  'Akasia Fresh',
  'Ocean Breeze',
  'Lavender Soft',
  'Snappy Clean',
  'Downy Mystique',
  'Tanpa Pewangi'
];

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Semua' },
  { id: 'KILOAN', label: 'Kiloan' },
  { id: 'SATUAN', label: 'Satuan' },
  { id: 'DRY_CLEAN', label: 'Dry Cleaning' },
  { id: 'SEPATU', label: 'Sepatu' },
  { id: 'KARPET', label: 'Karpet' },
  { id: 'LAINNYA', label: 'Lainnya' }
] as const;

function formatRelativeDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  return `${days} hari yang lalu`;
}

function renderServiceIllustration(iconType?: string, size: 'md' | 'sm' = 'md') {
  const boxClass =
    size === 'md'
      ? 'w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-2xs mx-auto mb-2'
      : 'w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0';

  switch (iconType) {
    case 'FOLDED':
      return <div className={`${boxClass} bg-blue-50 text-blue-600 border border-blue-100`}>🧺</div>;
    case 'IRONING':
      return <div className={`${boxClass} bg-cyan-50 text-cyan-600 border border-cyan-100`}>👕</div>;
    case 'EXPRESS':
      return <div className={`${boxClass} bg-amber-50 text-amber-500 border border-amber-100`}>⚡</div>;
    case 'HANGER':
      return <div className={`${boxClass} bg-indigo-50 text-indigo-600 border border-indigo-100`}>🧥</div>;
    case 'SHOE':
      return <div className={`${boxClass} bg-slate-100 text-slate-700 border border-slate-200`}>👟</div>;
    case 'CARPET':
      return <div className={`${boxClass} bg-rose-50 text-rose-600 border border-rose-100`}>🧶</div>;
    case 'BEDCOVER':
      return <div className={`${boxClass} bg-sky-50 text-sky-600 border border-sky-100`}>🛏️</div>;
    case 'DOLL':
      return <div className={`${boxClass} bg-orange-50 text-orange-600 border border-orange-100`}>🧸</div>;
    case 'HELMET':
      return <div className={`${boxClass} bg-emerald-50 text-emerald-600 border border-emerald-100`}>🪖</div>;
    default:
      return <div className={`${boxClass} bg-blue-50 text-blue-600 border border-blue-100`}>👕</div>;
  }
}

export const POSLaundry: React.FC = () => {
  const navigate = useNavigate();
  const { token, triggerHaptic, activeShift } = usePOS();

  // ─── STATE KATALOG & KATEGORI ────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>(DEFAULT_LAUNDRY_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem>(DEFAULT_LAUNDRY_CATALOG[0]);

  // ─── STATE INPUT BERAT / QTY DOCK & KALKULATOR DIMENSI KARPET ────────────────
  const [dockQty, setDockQty] = useState<string>('3.0');
  const [carpetLength, setCarpetLength] = useState<string>('3.0');
  const [carpetWidth, setCarpetWidth] = useState<string>('2.0');
  const [scaleStatus, setScaleStatus] = useState<ScaleConnectionStatus>(scaleDriver.getStatus());
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false);

  // ─── STATE PELANGGAN & MEMBER (KOLOM KIRI) ───────────────────────────────────
  const [memberList, setMemberList] = useState<LaundryMember[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerQuotaKg, setCustomerQuotaKg] = useState<number>(0);
  const [customerDeposit, setCustomerDeposit] = useState<number>(0);
  const [selectedMemberInfo, setSelectedMemberInfo] = useState<LaundryMember | null>(null);

  // Modal Tambah Pelanggan Baru Cepat
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustTier, setNewCustTier] = useState<string>('Silver');
  const [isSavingCustomer, setIsSavingCustomer] = useState<boolean>(false);

  // Modal Top-Up Kuota / Deposit Member
  const [showTopupModal, setShowTopupModal] = useState<boolean>(false);
  const [topupType, setTopupType] = useState<'QUOTA_KG' | 'DEPOSIT'>('QUOTA_KG');
  const [topupAddedKg, setTopupAddedKg] = useState<string>('20');
  const [topupDepositAmt, setTopupDepositAmt] = useState<string>('150000');
  const [topupPricePaid, setTopupPricePaid] = useState<string>('140000');
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [topupPackageName, setTopupPackageName] = useState<string>('Paket Hemat 20 Kg');
  const [isSubmittingTopup, setIsSubmittingTopup] = useState<boolean>(false);

  // ─── STATE ADD-ONS (PARFUM, KECEPATAN, PENGIRIMAN, FOTO) ─────────────────────
  const [selectedPerfume, setSelectedPerfume] = useState<string>('Sakura Bloom');
  const [serviceSpeed, setServiceSpeed] = useState<'REGULAR' | 'KILAT_24H' | 'EXPRESS_6H'>('REGULAR');
  const [deliveryType, setDeliveryType] = useState<'WALK_IN' | 'PICKUP_ONLY' | 'DELIVERY_ONLY' | 'FULL_SERVICE'>('WALK_IN');
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [pickupFeeAmount, setPickupFeeAmount] = useState<number>(0);
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState<number>(0);
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [intakePhotos, setIntakePhotos] = useState<string[]>([]);
  const [activeAddonPanel, setActiveAddonPanel] = useState<'NONE' | 'DELIVERY' | 'NOTES'>('NONE');

  // ─── STATE LAUNDRY CART & PEMBAYARAN (KOLOM KANAN) ───────────────────────────
  const [cart, setCart] = useState<LaundryItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);

  // Unified Payment Selection:
  // 'CASH' | 'QRIS' | 'TRANSFER' | 'EWALLET' | 'PAY_AT_STORE' | 'COD_DP' | 'MEMBER_BALANCE'
  const [selectedPaymentTile, setSelectedPaymentTile] = useState<
    'CASH' | 'QRIS' | 'TRANSFER' | 'EWALLET' | 'PAY_AT_STORE' | 'COD_DP' | 'MEMBER_BALANCE'
  >('CASH');
  const [dpAmountInput, setDpAmountInput] = useState<string>('');
  const [memberBalanceMode, setMemberBalanceMode] = useState<'QUOTA_KG' | 'DEPOSIT'>('QUOTA_KG');

  // Submission & Modals
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showPortalQrisModal, setShowPortalQrisModal] = useState<boolean>(false);

  // ─── 1. LOAD KATALOG DARI BACKEND / CACHE ────────────────────────────────────
  useEffect(() => {
    const loadCatalog = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/products?limit=200', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const rawProducts = Array.isArray(data) ? data : data.products || [];
          const laundryMapped: ServiceCatalogItem[] = rawProducts
            .filter((p: any) => p.isActive !== false)
            .map((p: any) => {
              const nameLower = (p.name || '').toLowerCase();
              const catNameLower = (p.category?.name || '').toLowerCase();
              const isMeter =
                nameLower.includes('m2') ||
                nameLower.includes('meter') ||
                nameLower.includes('karpet') ||
                nameLower.includes('gorden');
              const isKg =
                !isMeter &&
                (nameLower.includes('kg') ||
                  nameLower.includes('kilo') ||
                  catNameLower.includes('kilo') ||
                  p.uomName?.toUpperCase() === 'KG');

              let category: ServiceCatalogItem['category'] = isKg ? 'KILOAN' : 'SATUAN';
              let iconType: ServiceCatalogItem['iconType'] = isKg ? 'FOLDED' : 'BEDCOVER';

              if (nameLower.includes('setrika')) iconType = 'IRONING';
              if (nameLower.includes('express') || nameLower.includes('kilat')) iconType = 'EXPRESS';
              if (nameLower.includes('dry') || nameLower.includes('jas') || nameLower.includes('kebaya')) {
                category = 'DRY_CLEAN';
                iconType = 'HANGER';
              }
              if (nameLower.includes('sepatu') || nameLower.includes('sneaker')) {
                category = 'SEPATU';
                iconType = 'SHOE';
              }
              if (isMeter || nameLower.includes('karpet')) {
                category = 'KARPET';
                iconType = 'CARPET';
              }
              if (nameLower.includes('boneka')) iconType = 'DOLL';
              if (nameLower.includes('helm')) {
                category = 'LAINNYA';
                iconType = 'HELMET';
              }

              return {
                id: p.id,
                name: p.name,
                category,
                unitType: isMeter ? 'METER' : isKg ? 'KG' : 'PCS',
                price: Number(p.price) || 8000,
                description: p.description || '',
                iconType
              };
            });

          if (laundryMapped.length > 0) {
            setCatalog(laundryMapped);
            setSelectedService(laundryMapped[0]);
          }
        }
      } catch {
        const cached = await (offlineDb as any).catalogProducts?.toArray?.() || [];
        if (cached.length > 0) {
          const mapped: ServiceCatalogItem[] = cached.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: 'KILOAN',
            unitType: 'KG',
            price: Number(p.price) || 8000,
            iconType: 'FOLDED'
          }));
          setCatalog(mapped);
          setSelectedService(mapped[0]);
        }
      }
    };
    loadCatalog();
  }, [token]);

  // ─── 2. LOAD DAFTAR PELANGGAN & QUICK INFO ───────────────────────────────────
  const fetchLaundryMembers = async (search = '') => {
    if (!token) return;
    try {
      const res = await fetch(`/api/laundry/customers?q=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: LaundryMember[] = data.customers || [];
        setMemberList(list);
        if (customerId) {
          const updatedActive = list.find(c => c.id === customerId);
          if (updatedActive) {
            setSelectedMemberInfo(updatedActive);
            setCustomerQuotaKg(Number(updatedActive.laundryQuotaKg) || 0);
            setCustomerDeposit(Number(updatedActive.laundryDeposit) || 0);
          }
        }
      }
    } catch (err) {
      console.warn('[POSLaundry] Gagal memuat daftar pelanggan:', err);
    }
  };

  useEffect(() => {
    fetchLaundryMembers(customerSearch);
  }, [token, customerSearch]);

  // ─── 3. SUBSCRIPTION TIMBANGAN DIGITAL USB ───────────────────────────────────
  useEffect(() => {
    const unsubStatus = scaleDriver.onStatusChange(status => {
      setScaleStatus(status);
    });
    const unsubReading = scaleDriver.onReading(reading => {
      if (reading.weight > 0 && selectedService.unitType === 'KG') {
        setDockQty(reading.weight.toFixed(2));
      }
    });
    return () => {
      unsubStatus();
      unsubReading();
    };
  }, [selectedService.unitType]);

  // ─── 4. PILIH PELANGGAN DARI KOLOM KIRI ──────────────────────────────────────
  const handleSelectMember = (member: LaundryMember) => {
    triggerHaptic?.(10);
    setCustomerId(member.id);
    setCustomerName(member.name);
    setCustomerPhone(member.phone || '');
    setCustomerQuotaKg(Number(member.laundryQuotaKg) || 0);
    setCustomerDeposit(Number(member.laundryDeposit) || 0);
    setSelectedMemberInfo(member);

    if (member.favoriteAddress) {
      setPickupAddress(member.favoriteAddress);
      setDeliveryAddress(member.favoriteAddress);
    }
  };

  // Simpan Pelanggan Baru Cepat
  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast('Nama dan Nomor WhatsApp pelanggan wajib diisi', 'warning');
      return;
    }
    setIsSavingCustomer(true);
    try {
      const res = await fetch('/api/laundry/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
          tier: newCustTier
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan pelanggan');
      toast(json.message || 'Pelanggan berhasil ditambahkan!', 'success');
      if (json.customer) {
        handleSelectMember(json.customer);
      }
      setNewCustName('');
      setNewCustPhone('');
      setShowNewCustomerModal(false);
      fetchLaundryMembers();
    } catch (err: any) {
      toast(err.message || 'Gagal menambahkan pelanggan', 'error');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Top-Up Paket Kuota / Deposit Member
  const handleSubmitMemberTopup = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast('Pilih pelanggan atau isi Nama & No. WhatsApp terlebih dahulu', 'warning');
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
          addedQuotaKg: topupType === 'QUOTA_KG' ? parseFloat(topupAddedKg) || 0 : 0,
          addedDeposit: topupType === 'DEPOSIT' ? parseFloat(topupDepositAmt) || 0 : 0,
          pricePaid: parseFloat(topupPricePaid) || 0,
          paymentMethod: topupPaymentMethod,
          packageName: topupPackageName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal top-up member');
      toast(data.message || 'Top-up member berhasil!', 'success');
      if (data.customer) {
        setCustomerId(data.customer.id);
        setCustomerQuotaKg(Number(data.customer.laundryQuotaKg) || 0);
        setCustomerDeposit(Number(data.customer.laundryDeposit) || 0);
      }
      fetchLaundryMembers();
      setShowTopupModal(false);
    } catch (err: any) {
      toast(err.message || 'Gagal memproses top-up member', 'error');
    } finally {
      setIsSubmittingTopup(false);
    }
  };

  // ─── 5. PILIH LAYANAN & MASUKKAN KE KERANJANG (KOLOM TENGAH) ─────────────────
  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'ALL') return catalog;
    return catalog.filter(item => item.category === selectedCategory);
  }, [catalog, selectedCategory]);

  const effectiveDockQty = useMemo(() => {
    if (selectedService.unitType === 'METER') {
      const l = Math.max(0.1, parseFloat(carpetLength) || 0);
      const w = Math.max(0.1, parseFloat(carpetWidth) || 0);
      return parseFloat((l * w).toFixed(2));
    }
    return Math.max(0.1, parseFloat(dockQty) || 0);
  }, [selectedService.unitType, carpetLength, carpetWidth, dockQty]);

  const dockSubtotal = useMemo(() => {
    return Math.round(effectiveDockQty * selectedService.price);
  }, [effectiveDockQty, selectedService.price]);

  const handleSelectServiceCard = (srv: ServiceCatalogItem) => {
    triggerHaptic?.(10);
    setSelectedService(srv);
    if (srv.unitType === 'PCS') {
      setDockQty('1');
    } else if (srv.unitType === 'KG' && (parseFloat(dockQty) || 0) <= 1) {
      setDockQty('3.0');
    }
  };

  const handleAddDockToCart = () => {
    if (effectiveDockQty <= 0) {
      toast('Masukkan berat atau jumlah yang valid (> 0)', 'warning');
      return;
    }
    triggerHaptic?.(15);

    const isMeter = selectedService.unitType === 'METER';
    const noteStr = isMeter
      ? `Dimensi ${parseFloat(carpetLength) || 0}m x ${parseFloat(carpetWidth) || 0}m = ${effectiveDockQty} m²`
      : undefined;

    setCart(prev => {
      // Jika item satuan/kiloan yang sama sudah ada (dan bukan karpet custom dimensi), tambahkan qty-nya
      const existingIdx = prev.findIndex(
        it => it.serviceName === selectedService.name && it.unitType === selectedService.unitType && !isMeter
      );
      if (existingIdx > -1) {
        const updated = [...prev];
        const nextQty = parseFloat((updated[existingIdx].qty + effectiveDockQty).toFixed(2));
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: nextQty,
          subtotal: Math.round(nextQty * updated[existingIdx].pricePerUnit)
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `${selectedService.unitType}-${selectedService.id}-${Date.now()}`,
          serviceName: selectedService.name,
          unitType: selectedService.unitType,
          qty: effectiveDockQty,
          pricePerUnit: selectedService.price,
          subtotal: dockSubtotal,
          notes: noteStr,
          iconType: selectedService.iconType
        }
      ];
    });

    toast(`+ ${effectiveDockQty} ${selectedService.unitType === 'METER' ? 'm²' : selectedService.unitType.toLowerCase()} ${selectedService.name}`, 'success');
  };

  const handleUpdateCartQty = (id: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCart(prev => prev.filter(it => it.id !== id));
      return;
    }
    const cleanQty = parseFloat(nextQty.toFixed(2));
    setCart(prev =>
      prev.map(it =>
        it.id === id
          ? {
              ...it,
              qty: cleanQty,
              subtotal: Math.round(cleanQty * it.pricePerUnit)
            }
          : it
      )
    );
  };

  // Capture Foto Pakaian Masuk
  const handleCaptureIntakePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (intakePhotos.length >= 3) {
      toast('Maksimal 3 foto per nota cucian', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 640;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_DIM) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else if (h > MAX_DIM) {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.65);
          setIntakePhotos(prev => [...prev, compressed].slice(0, 3));
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── 6. KALKULASI FINANSIAL & GRAND TOTAL (KOLOM KANAN) ──────────────────────
  const itemsSubtotal = useMemo(() => cart.reduce((s, it) => s + it.subtotal, 0), [cart]);

  const totalKiloanInCart = useMemo(
    () => cart.filter(i => i.unitType === 'KG').reduce((s, i) => s + i.qty, 0),
    [cart]
  );

  const speedMultiplier = serviceSpeed === 'EXPRESS_6H' ? 1.8 : serviceSpeed === 'KILAT_24H' ? 1.4 : 1.0;
  const speedSurcharge = useMemo(
    () => (speedMultiplier > 1 ? Math.round(itemsSubtotal * (speedMultiplier - 1)) : 0),
    [itemsSubtotal, speedMultiplier]
  );

  const totalDeliveryFee = useMemo(() => {
    if (deliveryType === 'WALK_IN') return 0;
    const pFee = deliveryType === 'FULL_SERVICE' || deliveryType === 'PICKUP_ONLY' ? pickupFeeAmount : 0;
    const dFee = deliveryType === 'FULL_SERVICE' || deliveryType === 'DELIVERY_ONLY' ? deliveryFeeAmount : 0;
    return pFee + dFee;
  }, [deliveryType, pickupFeeAmount, deliveryFeeAmount]);

  const grandTotal = useMemo(
    () => Math.max(0, itemsSubtotal + speedSurcharge + totalDeliveryFee - discountAmount),
    [itemsSubtotal, speedSurcharge, totalDeliveryFee, discountAmount]
  );

  const estimatedDoneDate = useMemo(() => {
    const d = new Date();
    const hours = serviceSpeed === 'EXPRESS_6H' ? 6 : serviceSpeed === 'KILAT_24H' ? 24 : 48;
    d.setHours(d.getHours() + hours);
    return d;
  }, [serviceSpeed]);

  // ─── 7. SUBMIT ORDER (BAYAR & CETAK STRUK / SIMPAN SAJA) ─────────────────────
  const handleCreateOrder = async (shouldPrintReceipt: boolean) => {
    if (!customerName.trim()) {
      toast('Pilih pelanggan di panel kiri atau ketik nama pelanggan terlebih dahulu', 'warning');
      return;
    }
    if (cart.length === 0) {
      toast('Keranjang Laundry masih kosong. Tambahkan layanan terlebih dahulu.', 'warning');
      return;
    }

    // Petakan selectedPaymentTile ke skema backend
    const isPayLater = selectedPaymentTile === 'PAY_AT_STORE';
    const isPayDp = selectedPaymentTile === 'COD_DP';
    const isMemberBalance = selectedPaymentTile === 'MEMBER_BALANCE';

    if (!isPayLater && !isMemberBalance && !activeShift) {
      toast('Shift kasir belum dibuka! Silakan buka shift kasir untuk menerima pembayaran.', 'warning');
      return;
    }

    let finalPaidAmount = grandTotal;
    let finalQuotaUsed = 0;
    let finalDepositUsed = 0;
    let finalDiscount = discountAmount;
    let finalGrandTotal = grandTotal;
    let backendPaymentMethod = 'CASH';

    if (selectedPaymentTile === 'QRIS') backendPaymentMethod = 'QRIS';
    else if (selectedPaymentTile === 'TRANSFER') backendPaymentMethod = 'TRANSFER';
    else if (selectedPaymentTile === 'EWALLET') backendPaymentMethod = 'QRIS';
    else if (selectedPaymentTile === 'PAY_AT_STORE') {
      finalPaidAmount = 0;
      backendPaymentMethod = 'BON';
    } else if (selectedPaymentTile === 'COD_DP') {
      const parsedDp = Math.max(0, parseFloat(dpAmountInput) || 0);
      finalPaidAmount = Math.min(grandTotal, parsedDp);
      backendPaymentMethod = 'CASH';
    } else if (selectedPaymentTile === 'MEMBER_BALANCE') {
      if (!customerId) {
        toast('Pilih pelanggan Member di panel kiri untuk memotong Kuota Kg / Deposit!', 'warning');
        return;
      }
      if (memberBalanceMode === 'QUOTA_KG') {
        if (totalKiloanInCart <= 0) {
          toast('Potong Kuota Kg hanya berlaku untuk item layanan Kiloan (Kg).', 'warning');
          return;
        }
        if (customerQuotaKg < totalKiloanInCart) {
          toast(`Kuota Kg pelanggan (${customerQuotaKg} Kg) tidak cukup untuk ${totalKiloanInCart} Kg.`, 'warning');
          return;
        }
        const kiloanSubtotal = cart.filter(i => i.unitType === 'KG').reduce((s, i) => s + i.subtotal, 0);
        finalQuotaUsed = totalKiloanInCart;
        finalDiscount = discountAmount + kiloanSubtotal;
        finalGrandTotal = Math.max(0, itemsSubtotal + speedSurcharge + totalDeliveryFee - finalDiscount);
        finalPaidAmount = finalGrandTotal;
        backendPaymentMethod = 'QUOTA_KG';
      } else {
        if (customerDeposit < grandTotal) {
          toast(
            `Saldo Deposit pelanggan (Rp ${customerDeposit.toLocaleString('id-ID')}) kurang dari Rp ${grandTotal.toLocaleString('id-ID')}.`,
            'warning'
          );
          return;
        }
        finalDepositUsed = grandTotal;
        finalPaidAmount = grandTotal;
        backendPaymentMethod = 'DEPOSIT';
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        serviceCategory: cart.every(i => i.unitType === 'KG')
          ? 'KILOAN'
          : cart.every(i => i.unitType !== 'KG')
          ? 'SATUAN'
          : 'CAMPURAN',
        serviceSpeed,
        perfumeVariant: selectedPerfume,
        specialNotes: specialNotes.trim() || null,
        deliveryType,
        pickupAddress: deliveryType !== 'WALK_IN' ? pickupAddress.trim() : null,
        deliveryAddress: deliveryType !== 'WALK_IN' ? (deliveryAddress.trim() || pickupAddress.trim()) : null,
        pickupFee: deliveryType === 'FULL_SERVICE' || deliveryType === 'PICKUP_ONLY' ? pickupFeeAmount : 0,
        deliveryFee: deliveryType === 'FULL_SERVICE' || deliveryType === 'DELIVERY_ONLY' ? deliveryFeeAmount : 0,
        subtotal: itemsSubtotal,
        speedSurcharge,
        discount: finalDiscount,
        totalAmount: finalGrandTotal,
        paidAmount: finalPaidAmount,
        paymentMethod: backendPaymentMethod,
        quotaKgUsed: finalQuotaUsed,
        depositUsed: finalDepositUsed,
        intakePhotos,
        estimatedDoneAt: estimatedDoneDate.toISOString(),
        items: cart.map(it => ({
          serviceName: it.serviceName,
          unitType: it.unitType,
          qty: it.qty,
          pricePerUnit: it.pricePerUnit,
          subtotal: it.subtotal,
          notes: it.notes
        }))
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
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan order laundry');

      toast(`Order #${data.order.orderNumber} berhasil disimpan!`, 'success');
      setCreatedOrder(data.order);
      if (shouldPrintReceipt) {
        setShowReceiptModal(true);
      }

      // Reset transaksi untuk antrean berikutnya
      setCart([]);
      setIntakePhotos([]);
      setDiscountAmount(0);
      setDpAmountInput('');
      setSpecialNotes('');
      setDeliveryType('WALK_IN');
      setPickupFeeAmount(0);
      setDeliveryFeeAmount(0);
      fetchLaundryMembers();
    } catch (err: any) {
      toast(err.message || 'Gagal membuat nota cucian', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stepper Active Status
  const step1Done = customerName.trim().length > 0;
  const step2Done = Boolean(selectedService);
  const step3Done = cart.length > 0;
  const step4Done = Boolean(selectedPerfume) || deliveryType !== 'WALK_IN' || intakePhotos.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#F4F7FE] text-slate-800 overflow-hidden font-sans select-none">
      {/* ─── TOP HEADER BAR & 5-STEP PROGRESS INDICATOR ───────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Tambah Order Baru</span>
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              🌸 {selectedPerfume}
            </span>
          </div>

          {/* Horizontal 5-Step Progress Indicator (FreshClean Style) */}
          <div className="hidden xl:flex items-center gap-4 text-xs font-bold">
            {[
              { num: 1, label: 'Pelanggan', active: true, done: step1Done },
              { num: 2, label: 'Layanan', active: step1Done, done: step2Done && step3Done },
              { num: 3, label: 'Berat / Qty', active: step2Done, done: step3Done },
              { num: 4, label: 'Add-on & Pengiriman', active: step3Done, done: step4Done && step3Done },
              { num: 5, label: 'Pembayaran', active: step3Done, done: false }
            ].map((st, idx) => (
              <div key={st.num} className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-extrabold transition ${
                    st.done
                      ? 'bg-blue-600 text-white'
                      : st.active
                      ? 'bg-blue-100 text-blue-700 border border-blue-400'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {st.done ? <Check size={11} strokeWidth={3} /> : st.num}
                </span>
                <span className={st.done || st.active ? 'text-slate-800' : 'text-slate-400'}>{st.label}</span>
                {idx < 4 && <div className="w-5 h-[1.5px] bg-slate-200" />}
              </div>
            ))}
          </div>

          {/* Right Quick Utilities */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPortalQrisModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Pengaturan Customer App Antar-Jemput & QRIS Dinamis Auto-Settlement"
            >
              <QrCode size={14} />
              <span className="hidden sm:inline">App Pelanggan & QRIS</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/laundry-kanban')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Buka Papan Produksi & Rak Cucian"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Produksi & Rak</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN 3-COLUMN WORKSPACE ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
          {/* ====================================================================
              KOLOM 1 (KIRI - 3 COL): PANEL PELANGGAN & QUICK INFO MEMBER
             ==================================================================== */}
          <div className="lg:col-span-3 flex flex-col gap-3 h-full overflow-hidden">
            {/* Card Atas: Pencarian & Daftar Pelanggan Terakhir */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col flex-1 min-h-[260px] overflow-hidden">
              {/* Search Bar */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Cari pelanggan / no HP..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowTopupModal(true)}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                  title="Top-Up Kuota Kg / Deposit Member"
                >
                  <Award size={15} />
                </button>
              </div>

              {/* Tombol Biru + Pelanggan Baru */}
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer mb-2.5"
              >
                <Plus size={15} />
                <span>Pelanggan Baru</span>
              </button>

              {/* Input Cepat Pelanggan Aktif / Walk-in */}
              <div className="grid grid-cols-2 gap-1.5 mb-2.5 p-2 rounded-xl bg-blue-50/50 border border-blue-100">
                <input
                  type="text"
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value);
                    if (!e.target.value.trim()) {
                      setCustomerId(null);
                      setSelectedMemberInfo(null);
                    }
                  }}
                  placeholder="Nama Pelanggan *"
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="0812xxxx (WA)"
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-700 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                <span>Pelanggan Terakhir</span>
                <span className="text-[10px] text-slate-400">{memberList.length} terdaftar</span>
              </div>

              {/* Scrollable Customer List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {memberList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Belum ada pelanggan. Klik <strong>+ Pelanggan Baru</strong> atau ketik nama di atas.
                  </div>
                ) : (
                  memberList.map(m => {
                    const isSelected = customerId === m.id;
                    const tierUpper = (m.tier || '').toUpperCase();
                    const badgeStyle =
                      tierUpper === 'GOLD'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : tierUpper === 'SILVER'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200';

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectMember(m)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500/30'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{m.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{m.phone}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                            {tierUpper === 'GOLD'
                              ? 'Member Gold'
                              : tierUpper === 'SILVER'
                              ? 'Member Silver'
                              : 'Member'}
                          </span>
                          {Number(m.laundryQuotaKg) > 0 && (
                            <span className="text-[9px] font-extrabold text-emerald-600">
                              {Number(m.laundryQuotaKg).toFixed(1)} kg
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Card Bawah: Quick Info Pelanggan (Persis Referensi FreshClean) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800">Quick Info</h3>
                {customerId && (
                  <button
                    type="button"
                    onClick={() => setShowTopupModal(true)}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    + Isi Kuota/Deposit
                  </button>
                )}
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Star size={12} className="text-amber-500" /> Points & Kuota
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedMemberInfo?.points || 0} pts
                    {customerQuotaKg > 0 ? ` • ${customerQuotaKg.toFixed(1)} kg` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Award size={12} className="text-blue-500" /> Member Tier
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedMemberInfo?.tier || (customerName ? 'Walk-In' : '-')}
                    {customerDeposit > 0 ? ` (Rp ${customerDeposit.toLocaleString('id-ID')})` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 gap-2">
                  <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                    <MapPin size={12} className="text-rose-500" /> Alamat Favorit
                  </span>
                  <span className="font-bold text-slate-800 truncate text-right">
                    {selectedMemberInfo?.favoriteAddress || pickupAddress || '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock size={12} className="text-indigo-500" /> Order Terakhir
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedMemberInfo?.lastOrderNumber
                      ? `${selectedMemberInfo.lastOrderNumber} • ${formatRelativeDate(selectedMemberInfo.lastOrderDate)}`
                      : '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Wallet size={12} className="text-emerald-600" /> Outstanding Payment
                  </span>
                  <span
                    className={`font-extrabold ${
                      (selectedMemberInfo?.outstandingPayment || 0) > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    Rp {(selectedMemberInfo?.outstandingPayment || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================================
              KOLOM 2 (TENGAH - 5 COL): PILIH LAYANAN VISUAL & DOCK BERAT / QTY
             ==================================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-3 h-full overflow-hidden">
            {/* Card Atas: Pilih Layanan Grid 3x3 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col flex-1 min-h-[300px] overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-slate-900">Pilih Layanan</h2>
                <span className="text-[11px] text-slate-400 font-medium">Klik kartu lalu atur berat di bawah</span>
              </div>

              {/* Filter Pill Kategori Horizontal */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar shrink-0">
                {CATEGORY_TABS.map(tab => {
                  const active = selectedCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedCategory(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Grid Kartu Layanan 3x3 */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredCatalog.map(srv => {
                    const isSelected = selectedService.id === srv.id;
                    const unitLabel = srv.unitType === 'METER' ? 'm²' : srv.unitType === 'KG' ? 'kg' : 'pcs';

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleSelectServiceCard(srv)}
                        className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? 'border-2 border-blue-600 bg-blue-50/30 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                        }`}
                      >
                        {renderServiceIllustration(srv.iconType, 'md')}
                        <div className="text-xs font-extrabold text-slate-900 line-clamp-1">{srv.name}</div>
                        <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          Rp {srv.price.toLocaleString('id-ID')} /{unitLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card Bawah: Dock Input Berat / Qty Kontekstual + Add-on Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs shrink-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Kiri: Kontrol Input Angka Berat / Dimensi */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-extrabold text-slate-700">
                      {selectedService.unitType === 'METER' ? 'Input Dimensi Karpet (P x L)' : 'Input Berat / Qty'}
                    </span>

                    {selectedService.unitType === 'KG' && (
                      <button
                        type="button"
                        onClick={() => setShowScaleModal(true)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer ${
                          scaleStatus === 'CONNECTED' || scaleStatus === 'SIMULATING'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Konfigurasi Timbangan Digital USB"
                      >
                        <Scale size={11} />
                        <span>{scaleStatus === 'CONNECTED' ? 'USB Aktif' : 'Timbangan USB'}</span>
                      </button>
                    )}
                  </div>

                  {selectedService.unitType === 'METER' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 flex-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={carpetLength}
                          onChange={e => setCarpetLength(e.target.value)}
                          className="w-full bg-transparent text-sm font-black text-slate-900 outline-none"
                          placeholder="P"
                        />
                        <span className="text-[11px] font-bold text-slate-400">m (P)</span>
                      </div>
                      <span className="text-xs font-black text-slate-400">×</span>
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 flex-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={carpetWidth}
                          onChange={e => setCarpetWidth(e.target.value)}
                          className="w-full bg-transparent text-sm font-black text-slate-900 outline-none"
                          placeholder="L"
                        />
                        <span className="text-[11px] font-bold text-slate-400">m (L)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 focus-within:border-blue-500 focus-within:bg-white">
                        <input
                          type="number"
                          step={selectedService.unitType === 'KG' ? '0.1' : '1'}
                          min="0.1"
                          value={dockQty}
                          onChange={e => setDockQty(e.target.value)}
                          className="w-full bg-transparent text-lg font-black text-slate-900 outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400 lowercase">
                          {selectedService.unitType}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const step = selectedService.unitType === 'KG' ? 0.5 : 1;
                          const next = Math.max(step, (parseFloat(dockQty) || 0) - step);
                          setDockQty(selectedService.unitType === 'KG' ? next.toFixed(1) : String(Math.round(next)));
                        }}
                        className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold cursor-pointer"
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const step = selectedService.unitType === 'KG' ? 0.5 : 1;
                          const next = (parseFloat(dockQty) || 0) + step;
                          setDockQty(selectedService.unitType === 'KG' ? next.toFixed(1) : String(Math.round(next)));
                        }}
                        className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Kanan: Ringkasan Kali & Tombol Masuk Cart */}
                <div className="sm:pl-4 sm:border-l border-slate-100 flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-slate-700">{selectedService.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {effectiveDockQty} {selectedService.unitType === 'METER' ? 'm²' : selectedService.unitType.toLowerCase()} × Rp{' '}
                      {selectedService.price.toLocaleString('id-ID')}
                    </div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      Rp {dockSubtotal.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDockToCart}
                    className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0 active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* Baris Add-on & Pengiriman Ringkas (Step 4) */}
              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Pilihan Parfum */}
                  <select
                    value={selectedPerfume}
                    onChange={e => setSelectedPerfume(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold outline-none cursor-pointer"
                  >
                    {PERFUME_VARIANTS.map(pf => (
                      <option key={pf} value={pf}>
                        🌸 {pf}
                      </option>
                    ))}
                  </select>

                  {/* Pilihan Kecepatan */}
                  <button
                    type="button"
                    onClick={() =>
                      setServiceSpeed(prev =>
                        prev === 'REGULAR' ? 'KILAT_24H' : prev === 'KILAT_24H' ? 'EXPRESS_6H' : 'REGULAR'
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      serviceSpeed === 'REGULAR'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                  >
                    ⚡ {serviceSpeed === 'EXPRESS_6H' ? 'Express 6 Jam (+80%)' : serviceSpeed === 'KILAT_24H' ? 'Kilat 24 Jam (+40%)' : 'Reguler (48 Jam)'}
                  </button>

                  {/* Toggle Pengiriman / Kurir */}
                  <button
                    type="button"
                    onClick={() => setActiveAddonPanel(prev => (prev === 'DELIVERY' ? 'NONE' : 'DELIVERY'))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 transition cursor-pointer ${
                      deliveryType !== 'WALK_IN'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Bike size={12} />
                    <span>{deliveryType === 'WALK_IN' ? 'Antar-Jemput' : `Kurir (+Rp ${totalDeliveryFee.toLocaleString('id-ID')})`}</span>
                  </button>

                  {/* Foto Kondisi Pakaian */}
                  <label className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                    <Camera size={12} />
                    <span>Foto ({intakePhotos.length}/3)</span>
                    <input type="file" accept="image/*" onChange={handleCaptureIntakePhoto} className="hidden" />
                  </label>
                </div>

                {intakePhotos.length > 0 && (
                  <div className="flex items-center gap-1">
                    {intakePhotos.map((ph, i) => (
                      <div key={i} className="relative group">
                        <img src={ph} alt="Foto" className="w-6 h-6 rounded object-cover border border-slate-300" />
                        <button
                          type="button"
                          onClick={() => setIntakePhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white text-[8px] flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer Mini Pengaturan Antar-Jemput (Jika Diklik) */}
              {activeAddonPanel === 'DELIVERY' && (
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-900">Pengaturan Jemput & Antar Kurir</span>
                    <div className="flex gap-1">
                      {[
                        { id: 'WALK_IN', label: 'Walk-In' },
                        { id: 'FULL_SERVICE', label: 'Jemput & Antar' },
                        { id: 'PICKUP_ONLY', label: 'Jemput Saja' },
                        { id: 'DELIVERY_ONLY', label: 'Antar Saja' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDeliveryType(opt.id as any)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            deliveryType === opt.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {deliveryType !== 'WALK_IN' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={pickupAddress}
                        onChange={e => {
                          setPickupAddress(e.target.value);
                          setDeliveryAddress(e.target.value);
                        }}
                        placeholder="Alamat Jemput / Antar..."
                        className="sm:col-span-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400">Jemput Rp</span>
                        <input
                          type="number"
                          step="1000"
                          value={pickupFeeAmount}
                          onChange={e => setPickupFeeAmount(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full text-xs font-bold outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400">Antar Rp</span>
                        <input
                          type="number"
                          step="1000"
                          value={deliveryFeeAmount}
                          onChange={e => setDeliveryFeeAmount(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full text-xs font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ====================================================================
              KOLOM 3 (KANAN - 4 COL): LAUNDRY CART & METODE PEMBAYARAN
             ==================================================================== */}
          <div className="lg:col-span-4 flex flex-col h-full overflow-hidden">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col h-full overflow-hidden">
              {/* Header Laundry Cart */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900">Laundry Cart</h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600">
                    {cart.length} item
                  </span>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                )}
              </div>

              {/* Daftar Item di Keranjang */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2 min-h-[160px]">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-400">
                    <Receipt size={28} className="mb-2 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-600">Keranjang Masih Kosong</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-[220px]">
                      Pilih layanan di tengah lalu klik tombol <strong>+ Tambah</strong>.
                    </p>
                  </div>
                ) : (
                  cart.map(item => {
                    const unitLbl = item.unitType === 'METER' ? 'm²' : item.unitType.toLowerCase();
                    const step = item.unitType === 'KG' || item.unitType === 'METER' ? 0.5 : 1;

                    return (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderServiceIllustration(item.iconType, 'sm')}
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-slate-900 truncate">{item.serviceName}</div>
                            <div className="text-[11px] text-slate-400">
                              {item.qty} {unitLbl} × Rp {item.pricePerUnit.toLocaleString('id-ID')}
                            </div>
                            {item.notes && (
                              <div className="text-[10px] text-blue-600 font-medium truncate">{item.notes}</div>
                            )}

                            {/* Stepper [-][qty][+] */}
                            <div className="inline-flex items-center gap-1 mt-1 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(item.id, item.qty - step)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="px-2 text-xs font-extrabold text-slate-800">{item.qty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(item.id, item.qty + step)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                          <span className="text-xs font-extrabold text-slate-900">
                            Rp {item.subtotal.toLocaleString('id-ID')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.id, 0)}
                            className="p-1 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ringkasan Subtotal, Diskon, Delivery, & Grand Total */}
              <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs shrink-0">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">Rp {itemsSubtotal.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <button
                    type="button"
                    onClick={() => setShowDiscountInput(prev => !prev)}
                    className="hover:text-blue-600 underline decoration-dotted cursor-pointer"
                  >
                    Diskon
                  </button>
                  {showDiscountInput ? (
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={discountAmount || ''}
                      onChange={e => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-24 text-right bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-emerald-600"
                    />
                  ) : (
                    <span className="font-bold text-emerald-600">
                      - Rp {discountAmount.toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Delivery</span>
                  <span className="font-bold text-slate-900">Rp {totalDeliveryFee.toLocaleString('id-ID')}</span>
                </div>

                {speedSurcharge > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Biaya Kilat / Express</span>
                    <span className="font-bold">+ Rp {speedSurcharge.toLocaleString('id-ID')}</span>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between mt-2">
                  <span className="text-xs font-extrabold text-slate-800">Grand Total</span>
                  <span className="text-xl font-black text-slate-900">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Metode Pembayaran Grid (7 Tombol Persis Referensi) */}
              <div className="mt-3 shrink-0">
                <div className="text-[11px] font-bold text-slate-600 mb-2">Metode Pembayaran</div>

                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  {[
                    { id: 'CASH', label: 'Cash', icon: Wallet },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'TRANSFER', label: 'Transfer', icon: Building2 },
                    { id: 'EWALLET', label: 'E-Wallet', icon: Smartphone }
                  ].map(pm => {
                    const Icon = pm.icon;
                    const active = selectedPaymentTile === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setSelectedPaymentTile(pm.id as any)}
                        className={`py-2 px-1 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/70 text-blue-700 ring-1 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'PAY_AT_STORE', label: 'Pay at Store', icon: Store },
                    { id: 'COD_DP', label: 'COD / DP', icon: Bike },
                    { id: 'MEMBER_BALANCE', label: 'Member Balance', icon: Star }
                  ].map(pm => {
                    const Icon = pm.icon;
                    const active = selectedPaymentTile === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setSelectedPaymentTile(pm.id as any)}
                        className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/70 text-blue-700 ring-1 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Icon size={13} />
                        <span className="truncate">{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Input Kontekstual jika pilih COD / DP atau Member Balance */}
                {selectedPaymentTile === 'COD_DP' && (
                  <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs">
                    <span className="font-bold text-amber-800">Nominal DP (Rp):</span>
                    <input
                      type="number"
                      placeholder="0 (Bayar saat kurir antar)"
                      value={dpAmountInput}
                      onChange={e => setDpAmountInput(e.target.value)}
                      className="w-32 text-right bg-white border border-amber-300 rounded-lg px-2 py-1 font-extrabold text-slate-900 outline-none"
                    />
                  </div>
                )}

                {selectedPaymentTile === 'MEMBER_BALANCE' && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 bg-blue-50/60 border border-blue-200 rounded-xl p-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setMemberBalanceMode('QUOTA_KG')}
                      className={`py-1 rounded-lg font-bold cursor-pointer ${
                        memberBalanceMode === 'QUOTA_KG' ? 'bg-blue-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      Kuota ({customerQuotaKg.toFixed(1)} Kg)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberBalanceMode('DEPOSIT')}
                      className={`py-1 rounded-lg font-bold cursor-pointer ${
                        memberBalanceMode === 'DEPOSIT' ? 'bg-blue-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      Deposit (Rp {customerDeposit.toLocaleString('id-ID')})
                    </button>
                  </div>
                )}
              </div>

              {/* Tombol Utama: Bayar & Cetak Struk + Simpan */}
              <div className="mt-3 pt-2 flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmitting || cart.length === 0}
                  onClick={() => handleCreateOrder(true)}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer active:scale-[0.99]"
                >
                  <Printer size={15} />
                  <span>{isSubmitting ? 'Memproses...' : 'Bayar & Cetak Struk'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || cart.length === 0}
                  onClick={() => handleCreateOrder(false)}
                  className="py-3 px-4 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Save size={14} />
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM STATUS BAR (PERSIS REFERENSI FRESHCLEAN) ──────────────────── */}
      <div className="bg-white border-t border-slate-200 px-5 py-2 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-blue-700">
          <Zap size={13} className="text-blue-600" />
          <span>Proses cepat: rata-rata transaksi &lt; 30 detik</span>
        </div>
        <div className="flex items-center gap-4 font-semibold">
          <span className="flex items-center gap-1 text-slate-600">
            <Printer size={13} className="text-emerald-600" /> Printer siap
          </span>
        </div>
      </div>

      {/* ─── MODAL TAMBAH PELANGGAN BARU CEPAT ────────────────────────────────── */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewCustomer}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <User size={16} /> Tambah Pelanggan Laundry Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nomor WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tier Member</label>
                <select
                  value={newCustTier}
                  onChange={e => setNewCustTier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
                >
                  <option value="Gold">Member Gold</option>
                  <option value="Silver">Member Silver</option>
                  <option value="Bronze">Reguler</option>
                </select>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingCustomer}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
              >
                {isSavingCustomer ? 'Menyimpan...' : 'Simpan & Pilih'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL TOP-UP PAKET KUOTA KG & DEPOSIT MEMBER ────────────────────── */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award size={18} />
                <div>
                  <h3 className="text-sm font-black">Top-Up Paket Kuota Kg / Deposit Member</h3>
                  <p className="text-[10px] text-blue-100">Langganan prabayar otomatis masuk Laci Kasir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTopupModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Pelanggan *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nama Member"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">No. WhatsApp *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTopupType('QUOTA_KG')}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    topupType === 'QUOTA_KG' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  ⚖️ Paket Kuota Kg
                </button>
                <button
                  type="button"
                  onClick={() => setTopupType('DEPOSIT')}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    topupType === 'DEPOSIT' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  💳 Saldo Deposit Rp
                </button>
              </div>

              {topupType === 'QUOTA_KG' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: '10 Kg (Rp 75rb)', kg: '10', price: '75000', name: 'Paket 10 Kg' },
                      { label: '20 Kg (Rp 140rb)', kg: '20', price: '140000', name: 'Paket 20 Kg' },
                      { label: '50 Kg (Rp 325rb)', kg: '50', price: '325000', name: 'Paket Keluarga 50 Kg' }
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopupAddedKg(p.kg);
                          setTopupPricePaid(p.price);
                          setTopupPackageName(p.name);
                        }}
                        className="p-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-800 cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Kuota Ditambahkan (Kg)</label>
                      <input
                        type="number"
                        value={topupAddedKg}
                        onChange={e => setTopupAddedKg(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Harga Bayar (Rp)</label>
                      <input
                        type="number"
                        value={topupPricePaid}
                        onChange={e => setTopupPricePaid(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">Saldo Masuk (Rp)</label>
                    <input
                      type="number"
                      value={topupDepositAmt}
                      onChange={e => setTopupDepositAmt(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">Harga Bayar (Rp)</label>
                    <input
                      type="number"
                      value={topupPricePaid}
                      onChange={e => setTopupPricePaid(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTopupModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingTopup}
                onClick={handleSubmitMemberTopup}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {isSubmittingTopup ? 'Memproses...' : 'Simpan & Terima Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CETAK STRUK THERMAL & TAG PRODUKSI ────────────────────────── */}
      {showReceiptModal && createdOrder && (
        <LaundryReceiptPrinter order={createdOrder} onClose={() => setShowReceiptModal(false)} />
      )}

      {/* ─── MODAL KONFIGURASI TIMBANGAN DIGITAL USB ─────────────────────────── */}
      <DigitalScaleModal
        isOpen={showScaleModal}
        onClose={() => setShowScaleModal(false)}
        onApplyWeight={w => setDockQty(w.toFixed(2))}
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
