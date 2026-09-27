import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { 
  X, DollarSign, Tag, FileText, Sparkles, Layers, Package, 
  ArrowDownRight, ArrowUpRight, RotateCcw, Building2, Check,
  Zap, Droplets, Snowflake, Flame, ShoppingBag, Truck, Utensils, Clock, Wallet, Coffee,
  Wrench, ShieldCheck, ShoppingCart, Users, Camera, Image as ImageIcon, Trash2, AlertCircle
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
  defaultPocket?: 'KAS_OPERASIONAL' | 'LACI_KASIR';
}

export type ExpenseScope = 'operasional' | 'bahan_baku' | 'sdm' | 'lainnya';

export const EXPENSE_CATEGORIES = [
  {
    id: 'Operasional Cafe',
    name: 'Operasional Cafe (OPEX)',
    subcategories: [
      'Listrik, Air & Internet / WiFi',
      'Gas LPG & Es Batu Rutin',
      'Air Galon & Kebutuhan Minum',
      'Sabun Cuci, Plastik Sampah & Kebersihan',
      'Bensin, Transport & Kurir',
      'Sewa Tempat & Izin Usaha',
      'Operasional Lainnya'
    ]
  },
  {
    id: 'Bahan Makanan',
    name: 'Bahan Makanan (Food Ingredients)',
    subcategories: [
      'Daging & Protein (Ayam, Sapi, Ikan, Telur)',
      'Sayuran & Buah Segar',
      'Bumbu Dapur & Minyak Goreng',
      'Sembako & Beras / Tepung',
      'Bahan Makanan Lainnya'
    ]
  },
  {
    id: 'Bahan Minuman',
    name: 'Bahan Minuman (Beverage Ingredients)',
    subcategories: [
      'Biji Kopi & Bubuk Kopi',
      'Susu & Dairy (Fresh Milk, UHT, Keju)',
      'Sirup, Perisa & Simple Syrup',
      'Bubuk Minuman (Matcha, Cokelat, Red Velvet)',
      'Teh & Minuman Seduh',
      'Bahan Minuman Lainnya'
    ]
  },
  {
    id: 'Kemasan & Packaging',
    name: 'Kemasan & Packaging',
    subcategories: [
      'Cup Minuman (Plastic/Paper Cup)',
      'Sedotan & Tutup Cup',
      'Kotak Makanan & Paper Bag / Kantong Plastik',
      'Sendok, Garpu & Tissue',
      'Kemasan Lainnya'
    ]
  },
  {
    id: 'SDM & Karyawan',
    name: 'SDM & Tenaga Kerja',
    subcategories: [
      'Uang Makan & Lembur Staff',
      'Gaji Karyawan & Staff',
      'Kasbon & Pinjaman Staff',
      'Bonus & Insentif Kasir/Barista',
      'SDM Lainnya'
    ]
  },
  {
    id: 'Perawatan & Aset',
    name: 'Perawatan & Aset (Maintenance)',
    subcategories: [
      'Servis Mesin Kopi / Grinder',
      'Perbaikan Alat Dapur & Kulkas',
      'Pembelian Alat / Perkakas Baru',
      'Lain-lain / Biaya Tak Terduga'
    ]
  }
];

export const BENGKEL_EXPENSE_CATEGORIES = [
  {
    id: 'Operasional Bengkel',
    name: 'Operasional Bengkel (OPEX)',
    subcategories: [
      'Listrik, Kompresor & Internet / WiFi',
      'Air Minum Tamu & Kebersihan Ruang Tunggu',
      'Sabun Cuci Motor/Mobil & Kebersihan Pit',
      'Bensin, Transport & Pengambilan Part',
      'Sewa Kios/Lahan & Izin Usaha',
      'Operasional Bengkel Lainnya'
    ]
  },
  {
    id: 'Suku Cadang & Sparepart',
    name: 'Suku Cadang & Sparepart',
    subcategories: [
      'Kampas Rem & Piringan Cakram',
      'Ban Luar & Ban Dalam',
      'Busi, Koil, CDI & Kelistrikan',
      'Filter Udara, Filter Oli & V-Belt / Rantai',
      'Aki / Baterai Motor & Mobil',
      'Suku Cadang Lainnya'
    ]
  },
  {
    id: 'Oli & Cairan Kimia',
    name: 'Oli, Pelumas & Cairan Kimia',
    subcategories: [
      'Oli Mesin (Matic, Bebek, Sport, Mobil)',
      'Oli Gardan / Transmisi',
      'Minyak Rem, Radiator Coolant & WD-40',
      'Cairan Pembersih Injektor & Karburator',
      'Cairan Kimia Lainnya'
    ]
  },
  {
    id: 'Perawatan Toolkit & Kompresor',
    name: 'Toolkit & Fasilitas Pit',
    subcategories: [
      'Kunci Pas, Ring, Soket & Obeng',
      'Selang Kompresor, Tyre Inflator & Nozzle',
      'Dongkrak, Paddock & Bike Lift',
      'Mata Bor, Gerinda & Las',
      'Toolkit Lainnya'
    ]
  },
  {
    id: 'SDM & Mekanik',
    name: 'SDM, Mekanik & Helper',
    subcategories: [
      'Uang Makan & Lembur Mekanik',
      'Gaji Pokok Mekanik & Helper Pit',
      'Kasbon & Pinjaman Mekanik',
      'Bonus & Insentif Performa Servis',
      'SDM Bengkel Lainnya'
    ]
  },
  {
    id: 'Perawatan & Aset',
    name: 'Perawatan Fasilitas & Aset Bengkel',
    subcategories: [
      'Perbaikan Instalasi Listrik & Kompresor',
      'Cat Bengkel & Papan Nama / Signage',
      'Pembelian Mesin Perkakas Baru',
      'Lain-lain / Biaya Tak Terduga'
    ]
  }
];

export const RETAIL_EXPENSE_CATEGORIES = [
  {
    id: 'Kulakan & Stok Dagangan',
    name: 'Kulakan & Stok Dagangan Cepat',
    subcategories: [
      'Kulakan Sembako Cepat (Beras, Minyak, Telur)',
      'Kulakan Minuman & Makanan Ringan',
      'Kulakan Rokok & Kebutuhan Kasir',
      'Kulakan Bumbu & Sembako Curah',
      'Kulakan Barang Dagangan Lainnya'
    ]
  },
  {
    id: 'Perlengkapan & Kemasan Toko',
    name: 'Plastik Kresek & Perlengkapan Toko',
    subcategories: [
      'Kantong Plastik Kresek (Kecil, Sedang, Jumbo)',
      'Lakban, Tali Rafia & Spidol Dus',
      'Kertas Struk Kasir & Buku Bon Nota',
      'Karet Gelang & Plastik Kiloan',
      'Perlengkapan Toko Lainnya'
    ]
  },
  {
    id: 'Operasional Toko',
    name: 'Operasional Toko (OPEX)',
    subcategories: [
      'Listrik Toko & Pendingin Minuman',
      'Air Galon Kasir & Kebersihan Toko',
      'Sewa Kios/Ruko & Retribusi Pasar/Kebersihan',
      'Keamanan Lingkungan & Iuran Warga',
      'Operasional Toko Lainnya'
    ]
  },
  {
    id: 'Armada & Ekspedisi',
    name: 'Bensin & Armada Kirim / Kurir',
    subcategories: [
      'Bensin Motor / Pickup Kirim Barang',
      'Ongkos Kirim & Ekspedisi Pasokan',
      'Parkir & Tol Pengambilan Barang',
      'Perawatan Motor / Pickup Toko',
      'Armada Lainnya'
    ]
  },
  {
    id: 'SDM & Helper Toko',
    name: 'SDM, Kasir & Helper Toko',
    subcategories: [
      'Uang Makan Kasir & Helper Toko',
      'Upah Helper Angkut / Bongkar Muat',
      'Gaji Karyawan Toko',
      'Kasbon & Pinjaman Staff Toko',
      'SDM Lainnya'
    ]
  },
  {
    id: 'Aset & Inventaris Toko',
    name: 'Aset, Rak & Inventaris Toko',
    subcategories: [
      'Timbangan Digital & Barcode Scanner',
      'Perbaikan Rak Etalase & Lampu Display',
      'Keranjang Belanja & Troly Toko',
      'Pembelian Alat Toko Baru',
      'Lain-lain / Biaya Tak Terduga'
    ]
  }
];

// Presets Cepat 1-Klik Kafe (Tanpa Hardcode Harga - Kasir Input Nominal Riil Sesuai Nota)
export const CAFE_QUICK_CHIPS = [
  { label: 'Air Galon', icon: Droplets, subcat: 'Air Galon & Kebutuhan Minum', desc: 'Isi Ulang Air Galon Aqua Bar/Dapur', category: 'Operasional Cafe', defaultQty: 2, defaultUnit: 'Galon' },
  { label: 'Es Batu Kristal', icon: Snowflake, subcat: 'Gas LPG & Es Batu Rutin', desc: 'Pembelian Es Batu Kristal Tambahan', category: 'Operasional Cafe', defaultQty: 3, defaultUnit: 'Sak' },
  { label: 'Gas LPG Dapur', icon: Flame, subcat: 'Gas LPG & Es Batu Rutin', desc: 'Penggantian Tabung Gas LPG Masak Dapur', category: 'Operasional Cafe', defaultQty: 1, defaultUnit: 'Tabung' },
  { label: 'Token Listrik', icon: Zap, subcat: 'Listrik, Air & Internet / WiFi', desc: 'Pembelian Token Listrik Darurat Outlet', category: 'Operasional Cafe', defaultQty: 0, defaultUnit: '' },
  { label: 'Susu UHT / Fresh', icon: Coffee, subcat: 'Susu & Dairy (Fresh Milk, UHT, Keju)', desc: 'Belanja Susu UHT / Fresh Milk Darurat Minimarket', category: 'Bahan Minuman', defaultQty: 5, defaultUnit: 'Liter' },
  { label: 'Plastik Kresek / Cup', icon: ShoppingBag, subcat: 'Kotak Makanan & Paper Bag / Kantong Plastik', desc: 'Belanja Kantong Plastik & Cup Takeaway', category: 'Kemasan & Packaging', defaultQty: 1, defaultUnit: 'Pack' },
  { label: 'Sabun & Spons', icon: ShoppingCart, subcat: 'Sabun Cuci, Plastik Sampah & Kebersihan', desc: 'Sabun Cuci Piring & Perlengkapan Barista', category: 'Operasional Cafe', defaultQty: 2, defaultUnit: 'Botol' },
  { label: 'Bensin Operasional', icon: Truck, subcat: 'Bensin, Transport & Kurir', desc: 'Bensin Operasional Kurir & Belanja Pasar', category: 'Operasional Cafe', defaultQty: 0, defaultUnit: '' }
];

export const OPERASIONAL_PRESETS = [
  { label: 'Token Listrik', icon: Zap, subcat: 'Listrik, Air & Internet / WiFi', desc: 'Beli Token Listrik' },
  { label: 'Air Galon', icon: Droplets, subcat: 'Air Galon & Kebutuhan Minum', desc: 'Beli Air Galon' },
  { label: 'Es Batu', icon: Snowflake, subcat: 'Gas LPG & Es Batu Rutin', desc: 'Beli Es Batu Kristal' },
  { label: 'Gas LPG', icon: Flame, subcat: 'Gas LPG & Es Batu Rutin', desc: 'Beli Tabung Gas LPG' },
  { label: 'Tissue & Sabun', icon: ShoppingBag, subcat: 'Sabun Cuci, Plastik Sampah & Kebersihan', desc: 'Beli Tissue & Sabun Cuci' },
  { label: 'Bensin & Kurir', icon: Truck, subcat: 'Bensin, Transport & Kurir', desc: 'Bensin & Operasional Kurir' }
];

export const BENGKEL_OPERASIONAL_PRESETS = [
  { label: 'Token Listrik Pit', icon: Zap, subcat: 'Listrik, Kompresor & Internet / WiFi', desc: 'Beli Token Listrik 3-Phase Pit Bengkel' },
  { label: 'Air Tamu & Pit', icon: Droplets, subcat: 'Air Minum Tamu & Kebersihan Ruang Tunggu', desc: 'Beli Air Galon Ruang Tunggu' },
  { label: 'Sabun & Lap Pit', icon: ShoppingBag, subcat: 'Sabun Cuci Motor/Mobil & Kebersihan Pit', desc: 'Beli Sabun Cuci & Lap Chamois' },
  { label: 'Bensin Antar Part', icon: Truck, subcat: 'Bensin, Transport & Pengambilan Part', desc: 'Bensin Motor Operasional Ambil Part' },
  { label: 'Perawatan Kompresor', icon: Wrench, subcat: 'Listrik, Kompresor & Internet / WiFi', desc: 'Perbaikan / Penggantian Selang Kompresor' },
  { label: 'Sewa & Retribusi', icon: Building2, subcat: 'Sewa Kios/Lahan & Izin Usaha', desc: 'Retribusi Kebersihan & Lingkungan Bengkel' }
];

export const SDM_PRESETS = [
  { label: 'Uang Makan Staff', icon: Utensils, subcat: 'Uang Makan & Lembur Staff', desc: 'Uang Makan Staff Harian' },
  { label: 'Uang Lembur Staff', icon: Clock, subcat: 'Uang Makan & Lembur Staff', desc: 'Uang Lembur Staff' },
  { label: 'Kasbon Staff', icon: Wallet, subcat: 'Kasbon & Pinjaman Staff', desc: 'Kasbon / Pinjaman Sementara Staff' }
];

export const BENGKEL_SDM_PRESETS = [
  { label: 'Uang Makan Mekanik', icon: Utensils, subcat: 'Uang Makan & Lembur Mekanik', desc: 'Uang Makan Harian Mekanik' },
  { label: 'Lembur Mekanik', icon: Clock, subcat: 'Uang Makan & Lembur Mekanik', desc: 'Uang Lembur Servis Lembur Malam' },
  { label: 'Kasbon Mekanik', icon: Wallet, subcat: 'Kasbon & Pinjaman Mekanik', desc: 'Kasbon / Pinjaman Sementara Mekanik' }
];

export const BENGKEL_PARTS_PRESETS = [
  { label: 'Beli Drum Oli', icon: Droplets, subcat: 'Oli Mesin (Matic, Bebek, Sport, Mobil)', desc: 'Restock Oli Mesin & Pelumas' },
  { label: 'Kampas & Cakram', icon: Package, subcat: 'Kampas Rem & Piringan Cakram', desc: 'Restock Kampas Rem' },
  { label: 'Ban & Ban Dalam', icon: Layers, subcat: 'Ban Luar & Ban Dalam', desc: 'Restock Ban Luar & Ban Dalam' },
  { label: 'Busi & Kelistrikan', icon: Zap, subcat: 'Busi, Koil, CDI & Kelistrikan', desc: 'Restock Busi & Bohlam Lampu' }
];

export const RETAIL_OPERASIONAL_PRESETS = [
  { label: 'Token Listrik Toko', icon: Zap, subcat: 'Listrik Toko & Pendingin Minuman', desc: 'Beli Token Listrik Toko' },
  { label: 'Plastik Kresek', icon: ShoppingBag, subcat: 'Kantong Plastik Kresek (Kecil, Sedang, Jumbo)', desc: 'Beli Kantong Plastik Kresek Kasir' },
  { label: 'Bensin Pickup/Motor', icon: Truck, subcat: 'Bensin Motor / Pickup Kirim Barang', desc: 'Bensin Operasional Antar Barang' },
  { label: 'Lakban & Kertas Struk', icon: FileText, subcat: 'Lakban, Tali Rafia & Spidol Dus', desc: 'Beli Lakban & Kertas Struk Thermal' },
  { label: 'Air Galon Kasir', icon: Droplets, subcat: 'Air Galon Kasir & Kebersihan Toko', desc: 'Beli Air Galon Kasir' },
  { label: 'Retribusi & Iuran', icon: Building2, subcat: 'Sewa Kios/Ruko & Retribusi Pasar/Kebersihan', desc: 'Bayar Iuran Retribusi Kebersihan/Pasar' }
];

export const INFLOW_CATEGORIES = [
  {
    id: 'Modal & Injeksi',
    name: 'Modal & Injeksi Dana',
    subcategories: [
      'Setoran Modal Awal',
      'Tambahan Modal Kas Kecil'
    ]
  },
  {
    id: 'Pendapatan Non-POS',
    name: 'Pendapatan Non-POS',
    subcategories: [
      'Pendapatan Sewa Tempat / Space Event',
      'Bagi Hasil / Konsinyasi Produk Luar',
      'Penjualan Aset Bekas / Kardus',
      'Pendapatan Lain-lain'
    ]
  }
];

// Helper to convert number to Indonesian words (Terbilang)
const angkaTerbilang = (angka: number): string => {
  if (isNaN(angka) || angka === 0) return '';
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  if (angka < 12) return bilangan[angka];
  if (angka < 20) return `${angkaTerbilang(angka - 10)} Belas`;
  if (angka < 100) return `${angkaTerbilang(Math.floor(angka / 10))} Puluh ${angkaTerbilang(angka % 10)}`.trim();
  if (angka < 200) return `Seratus ${angkaTerbilang(angka - 100)}`.trim();
  if (angka < 1000) return `${angkaTerbilang(Math.floor(angka / 100))} Ratus ${angkaTerbilang(angka % 100)}`.trim();
  if (angka < 2000) return `Seribu ${angkaTerbilang(angka - 1000)}`.trim();
  if (angka < 1000000) return `${angkaTerbilang(Math.floor(angka / 1000))} Ribu ${angkaTerbilang(angka % 1000)}`.trim();
  if (angka < 1000000000) return `${angkaTerbilang(Math.floor(angka / 1000000))} Juta ${angkaTerbilang(angka % 1000000)}`.trim();
  if (angka < 1000000000000) return `${angkaTerbilang(Math.floor(angka / 1000000000))} Miliar ${angkaTerbilang(angka % 1000000000)}`.trim();
  return '';
};

const CashFlowModal: React.FC<CashFlowModalProps> = ({ isOpen, onClose, onSave, defaultPocket = 'KAS_OPERASIONAL' }) => {
  const posContext = useContext(POSContext);
  const { isBengkel, isRetail } = useVertical();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    type: 'Pengeluaran',
    amount: 0,
    description: ''
  });
  const [displayAmount, setDisplayAmount] = useState('');
  const [expenseScope, setExpenseScope] = useState<ExpenseScope>('operasional');
  
  // Dual-Pocket Selection
  const [cashPocket, setCashPocket] = useState<'KAS_OPERASIONAL' | 'LACI_KASIR'>(defaultPocket);
  
  // Foto Nota / Struk Staf
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Auto-Restock Linked Ingredient
  const [autoRestock, setAutoRestock] = useState(false);
  const [restockQty, setRestockQty] = useState<number>(0);

  const isOwnerOrAdmin = useMemo(() => {
    const role = (posContext?.user?.role || '').toUpperCase();
    return ['OWNER', 'ADMIN', 'SUPERADMIN', 'MANAGER'].includes(role) || Boolean(posContext?.user?.isPlatformAdmin);
  }, [posContext?.user]);

  // Pilihan status pengajuan: Default PENDING_APPROVAL untuk Kas Operasional
  const [submissionStatus, setSubmissionStatus] = useState<'PENDING_APPROVAL' | 'APPROVED'>('PENDING_APPROVAL');

  const initialCategory = isBengkel 
    ? 'Operasional Bengkel' 
    : isRetail 
      ? 'Operasional Toko' 
      : 'Operasional Cafe';
  const [mainCategory, setMainCategory] = useState(initialCategory);
  const [subCategory, setSubCategory] = useState('');
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCashPocket(defaultPocket);
      setReceiptImage(null);
      setAutoRestock(false);
      setRestockQty(0);
    }
  }, [isOpen, defaultPocket]);

  useEffect(() => {
    if (isOpen && posContext?.token) {
      if (isRetail) {
        fetch('/api/products', {
          headers: { Authorization: `Bearer ${posContext.token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setProducts(data);
          })
          .catch(err => console.error('Failed to load products in CashFlowModal', err));
      } else {
        fetch('/api/ingredients', {
          headers: { Authorization: `Bearer ${posContext.token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setIngredients(data);
          })
          .catch(err => console.error('Failed to load ingredients in CashFlowModal', err));
      }

      fetch('/api/suppliers', {
        headers: { Authorization: `Bearer ${posContext.token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSuppliers(data);
        })
        .catch(err => console.error('Failed to load suppliers in CashFlowModal', err));
    }
  }, [isOpen, posContext?.token, isRetail]);

  // Scoped Categories
  const activeCategories = useMemo(() => {
    if (formData.type === 'Pemasukan') {
      return INFLOW_CATEGORIES;
    }
    if (isBengkel) {
      switch (expenseScope) {
        case 'operasional':
          return BENGKEL_EXPENSE_CATEGORIES.filter(c => c.id === 'Operasional Bengkel');
        case 'bahan_baku':
          return BENGKEL_EXPENSE_CATEGORIES.filter(c => c.id === 'Suku Cadang & Sparepart' || c.id === 'Oli & Cairan Kimia');
        case 'sdm':
          return BENGKEL_EXPENSE_CATEGORIES.filter(c => c.id === 'SDM & Mekanik');
        case 'lainnya':
          return BENGKEL_EXPENSE_CATEGORIES.filter(c => c.id === 'Perawatan Toolkit & Kompresor' || c.id === 'Perawatan & Aset');
        default:
          return BENGKEL_EXPENSE_CATEGORIES;
      }
    }
    if (isRetail) {
      switch (expenseScope) {
        case 'operasional':
          return RETAIL_EXPENSE_CATEGORIES.filter(c => c.id === 'Operasional Toko' || c.id === 'Armada & Ekspedisi');
        case 'bahan_baku':
          return RETAIL_EXPENSE_CATEGORIES.filter(c => c.id === 'Kulakan & Stok Dagangan');
        case 'sdm':
          return RETAIL_EXPENSE_CATEGORIES.filter(c => c.id === 'SDM & Helper Toko');
        case 'lainnya':
          return RETAIL_EXPENSE_CATEGORIES.filter(c => c.id === 'Perlengkapan & Kemasan Toko' || c.id === 'Aset & Inventaris Toko');
        default:
          return RETAIL_EXPENSE_CATEGORIES;
      }
    }
    switch (expenseScope) {
      case 'operasional':
        return EXPENSE_CATEGORIES.filter(c => c.id === 'Operasional Cafe');
      case 'bahan_baku':
        return EXPENSE_CATEGORIES.filter(c => c.id === 'Bahan Makanan' || c.id === 'Bahan Minuman');
      case 'sdm':
        return EXPENSE_CATEGORIES.filter(c => c.id === 'SDM & Karyawan');
      case 'lainnya':
        return EXPENSE_CATEGORIES.filter(c => c.id === 'Kemasan & Packaging' || c.id === 'Perawatan & Aset');
      default:
        return EXPENSE_CATEGORIES;
    }
  }, [formData.type, expenseScope, isBengkel, isRetail]);

  useEffect(() => {
    if (activeCategories.length > 0) {
      const exists = activeCategories.some(c => c.id === mainCategory);
      if (!exists) {
        setMainCategory(activeCategories[0].id);
      }
    }
  }, [activeCategories, mainCategory]);

  useEffect(() => {
    const currentCatObj = activeCategories.find(c => c.id === mainCategory);
    if (currentCatObj && currentCatObj.subcategories.length > 0) {
      if (!currentCatObj.subcategories.includes(subCategory)) {
        setSubCategory(currentCatObj.subcategories[0]);
      }
    } else {
      setSubCategory('');
    }
  }, [mainCategory, activeCategories]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: string) => {
    setFormData(prev => ({ ...prev, type: newType }));
    if (newType === 'Pengeluaran') {
      setExpenseScope('operasional');
      setMainCategory(isBengkel ? 'Operasional Bengkel' : isRetail ? 'Operasional Toko' : 'Operasional Cafe');
    } else {
      setMainCategory(INFLOW_CATEGORIES[0].id);
    }
    setSelectedIngredient(null);
    setSelectedProduct(null);
    setSelectedSupplierId('');
  };

  const handleScopeChange = (scope: ExpenseScope) => {
    setExpenseScope(scope);
    if (scope === 'operasional') {
      setMainCategory(isBengkel ? 'Operasional Bengkel' : isRetail ? 'Operasional Toko' : 'Operasional Cafe');
      setSelectedIngredient(null);
      setSelectedProduct(null);
      setSelectedSupplierId('');
    } else if (scope === 'bahan_baku') {
      setMainCategory(isBengkel ? 'Suku Cadang & Sparepart' : isRetail ? 'Kulakan & Stok Dagangan' : 'Bahan Makanan');
    } else if (scope === 'sdm') {
      setMainCategory(isBengkel ? 'SDM & Mekanik' : isRetail ? 'SDM & Helper Toko' : 'SDM & Karyawan');
      setSelectedIngredient(null);
      setSelectedProduct(null);
      setSelectedSupplierId('');
    } else if (scope === 'lainnya') {
      setMainCategory(isBengkel ? 'Perawatan Toolkit & Kompresor' : isRetail ? 'Perlengkapan & Kemasan Toko' : 'Kemasan & Packaging');
      setSelectedIngredient(null);
      setSelectedProduct(null);
      setSelectedSupplierId('');
    }
  };

  const handleApplyPreset = (preset: { subcat: string; desc: string }) => {
    setSubCategory(preset.subcat);
    setFormData(prev => ({
      ...prev,
      description: preset.desc
    }));
  };

  const handleApplyCafeQuickChip = (chip: typeof CAFE_QUICK_CHIPS[0]) => {
    setMainCategory(chip.category);
    setSubCategory(chip.subcat);
    setFormData(prev => ({
      ...prev,
      description: chip.desc
    }));

    // Auto-link ingredient jika cocok nama bahan baku
    if (chip.defaultQty > 0) {
      const match = ingredients.find(i => 
        i.name.toLowerCase().includes(chip.label.toLowerCase()) || 
        chip.label.toLowerCase().includes(i.name.toLowerCase())
      );
      if (match) {
        setSelectedIngredient(match);
        setAutoRestock(true);
        setRestockQty(chip.defaultQty);
      }
    }
  };

  const updateDescription = (ingName: string, stockInfo: string, supplierId: string) => {
    let supPrefix = '';
    if (supplierId) {
      const sup = suppliers.find(s => s.id === Number(supplierId));
      if (sup) supPrefix = `[Supplier: ${sup.name}] `;
    } else if (ingName) {
      supPrefix = `[Belanja Langsung / Retail] `;
    }

    if (ingName) {
      setFormData(prev => ({
        ...prev,
        description: `${supPrefix}Beli Bahan Baku: ${ingName} (${stockInfo})`
      }));
    } else if (supplierId) {
      const sup = suppliers.find(s => s.id === Number(supplierId));
      setFormData(prev => ({
        ...prev,
        description: `[Supplier: ${sup?.name}] Pembelanjaan kebutuhan cafe`
      }));
    }
  };

  const handleIngredientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ingId = e.target.value;
    if (!ingId) {
      setSelectedIngredient(null);
      return;
    }

    const ing = ingredients.find(i => i.id === Number(ingId));
    if (ing) {
      setSelectedIngredient(ing);
      if (ing.category === 'DRINK') {
        setMainCategory('Bahan Minuman');
      } else if (ing.category === 'PACKAGING') {
        setMainCategory('Kemasan & Packaging');
      } else {
        setMainCategory('Bahan Makanan');
      }

      const linkedSupId = ing.supplierId ? String(ing.supplierId) : '';
      setSelectedSupplierId(linkedSupId);
      updateDescription(ing.name, `Stok saat ini: ${ing.stock} ${ing.unit}`, linkedSupId);
    }
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supId = e.target.value;
    setSelectedSupplierId(supId);
    if (selectedIngredient) {
      updateDescription(selectedIngredient.name, `Stok saat ini: ${selectedIngredient.stock} ${selectedIngredient.unit}`, supId);
    } else if (supId) {
      updateDescription('', '', supId);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const num = Number(rawVal) || 0;
    setFormData(prev => ({ ...prev, amount: num }));
    setDisplayAmount(num > 0 ? num.toLocaleString('id-ID') : '');
  };

  const addAmount = (increment: number) => {
    const newAmount = (formData.amount || 0) + increment;
    setFormData(prev => ({ ...prev, amount: newAmount }));
    setDisplayAmount(newAmount.toLocaleString('id-ID'));
  };

  const setExactAmount = (amount: number) => {
    setFormData(prev => ({ ...prev, amount }));
    setDisplayAmount(amount > 0 ? amount.toLocaleString('id-ID') : '');
  };

  const resetAmount = () => {
    setFormData(prev => ({ ...prev, amount: 0 }));
    setDisplayAmount('');
  };

  // Upload Foto Nota / Struk
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      const uploadData = new FormData();
      uploadData.append('image', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` },
        body: uploadData
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setReceiptImage(data.imageUrl);
      } else {
        alert(data.error || 'Gagal mengunggah foto nota');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengunggah foto nota struk');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      alert('Nominal harus lebih dari 0');
      return;
    }

    setLoading(true);
    const categoryString = subCategory ? `${mainCategory} - ${subCategory}` : mainCategory;

    await onSave({
      type: formData.type,
      category: categoryString,
      amount: formData.amount,
      description: formData.description,
      cashPocket,
      receiptImage,
      status: formData.type === 'Pengeluaran' ? submissionStatus : 'APPROVED',
      linkedIngredientId: autoRestock && selectedIngredient ? selectedIngredient.id : null,
      restockQty: autoRestock && restockQty > 0 ? restockQty : null
    });

    setLoading(false);
    setFormData({
      type: 'Pengeluaran',
      amount: 0,
      description: ''
    });
    setDisplayAmount('');
    setExpenseScope('operasional');
    setMainCategory('Operasional Cafe');
    setSelectedIngredient(null);
    setSelectedSupplierId('');
    setReceiptImage(null);
    setAutoRestock(false);
    setRestockQty(0);
  };

  const currentCategoryObj = activeCategories.find(c => c.id === mainCategory);
  const terbilangText = formData.amount > 0 ? `${angkaTerbilang(formData.amount)} Rupiah` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl md:max-w-2xl rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/80 my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-gray-900 leading-tight">Catat Transaksi Kas & Pengeluaran</h2>
              <p className="text-[11px] text-gray-500 font-medium">
                {isBengkel 
                  ? 'Pencatatan pengadaan sparepart, operasional bengkel, & kas' 
                  : isRetail 
                    ? 'Pencatatan kulakan darurat, operasional toko, & kas' 
                    : 'Pencatatan pembelanjaan operasional, galon, gas, & bahan baku'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer" 
            onClick={onClose} 
            disabled={loading}
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(88vh-115px)] space-y-3.5">

            {/* DUAL POCKET SELECTION: KAS OPERASIONAL VS LACI KASIR */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/70 p-3 rounded-2xl border border-indigo-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={14} className="text-indigo-600" />
                  Pilih Kantong Kas (Dual-Pocket):
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  cashPocket === 'KAS_OPERASIONAL'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}>
                  {cashPocket === 'KAS_OPERASIONAL' ? 'Kas Operasional (Petty Cash)' : 'Laci Kasir (Sales Float)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCashPocket('KAS_OPERASIONAL')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    cashPocket === 'KAS_OPERASIONAL'
                      ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                      : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                      💼 Kas Operasional
                    </span>
                    {cashPocket === 'KAS_OPERASIONAL' && <Check size={14} className="text-indigo-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Dana harian belanja galon, gas, listrik, & kulakan darurat. Butuh persetujuan Owner.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCashPocket('LACI_KASIR')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    cashPocket === 'LACI_KASIR'
                      ? 'bg-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
                      : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                      💵 Laci Kasir (Sales)
                    </span>
                    {cashPocket === 'LACI_KASIR' && <Check size={14} className="text-emerald-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Uang fisik modal laci / penarikan kasir. Langsung mempengaruhi rekonsiliasi shift.
                  </p>
                </button>
              </div>
            </div>

            {/* Quick Chips 1-Klik Kafe (Air Galon, Es Batu, Gas LPG, Token Listrik, Susu, Kresek) - Tanpa Harga */}
            {!isBengkel && !isRetail && formData.type === 'Pengeluaran' && (
              <div className="p-2.5 sm:p-3 bg-gradient-to-r from-amber-50/80 to-orange-50/80 border border-amber-200/90 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px] text-amber-950 font-black">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-600" />
                    Kebutuhan Rutin Kafe (Preset 1-Klik):
                  </span>
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">Auto-Kategori & Keterangan</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {CAFE_QUICK_CHIPS.map(chip => {
                    const Icon = chip.icon;
                    const isSelected = formData.description === chip.desc;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => handleApplyCafeQuickChip(chip)}
                        className={`py-2 px-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 border-amber-600 text-white shadow-sm ring-2 ring-amber-200 font-extrabold'
                            : 'bg-white/95 border-amber-200/80 text-amber-950 hover:bg-amber-100/70 hover:border-amber-400 font-bold shadow-2xs'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                        }`}>
                          <Icon size={14} />
                        </div>
                        <span className="text-[11px] truncate tracking-tight">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Jenis Transaksi & Ruang Lingkup Bar */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('Pengeluaran')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    formData.type === 'Pengeluaran'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs ring-1 ring-rose-200 font-extrabold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ArrowUpRight size={15} className={formData.type === 'Pengeluaran' ? 'text-rose-600' : 'text-gray-400'} />
                  <span>Pengeluaran (Out)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('Pemasukan')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    formData.type === 'Pemasukan'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs ring-1 ring-emerald-200 font-extrabold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ArrowDownRight size={15} className={formData.type === 'Pemasukan' ? 'text-emerald-600' : 'text-gray-400'} />
                  <span>Pemasukan / Setor Kas (In)</span>
                </button>
              </div>

              {/* 4 Segmented Scope Pills (Hanya saat Pengeluaran) */}
              {formData.type === 'Pengeluaran' && (
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleScopeChange('operasional')}
                    className={`py-1.5 px-1.5 rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] transition-all cursor-pointer ${
                      expenseScope === 'operasional'
                        ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 font-black'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                    }`}
                  >
                    <Zap size={13} className={expenseScope === 'operasional' ? 'text-amber-500' : 'text-gray-400'} />
                    <span className="truncate">Operasional</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScopeChange('bahan_baku')}
                    className={`py-1.5 px-1.5 rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] transition-all cursor-pointer ${
                      expenseScope === 'bahan_baku'
                        ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 font-black'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                    }`}
                  >
                    {isBengkel ? (
                      <Package size={13} className={expenseScope === 'bahan_baku' ? 'text-indigo-600' : 'text-gray-400'} />
                    ) : isRetail ? (
                      <ShoppingCart size={13} className={expenseScope === 'bahan_baku' ? 'text-indigo-600' : 'text-gray-400'} />
                    ) : (
                      <Coffee size={13} className={expenseScope === 'bahan_baku' ? 'text-indigo-600' : 'text-gray-400'} />
                    )}
                    <span className="truncate">{isBengkel ? 'Sparepart' : isRetail ? 'Kulakan' : 'Bahan Baku'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScopeChange('sdm')}
                    className={`py-1.5 px-1.5 rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] transition-all cursor-pointer ${
                      expenseScope === 'sdm'
                        ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 font-black'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                    }`}
                  >
                    {isBengkel ? (
                      <Wrench size={13} className={expenseScope === 'sdm' ? 'text-emerald-600' : 'text-gray-400'} />
                    ) : isRetail ? (
                      <Users size={13} className={expenseScope === 'sdm' ? 'text-emerald-600' : 'text-gray-400'} />
                    ) : (
                      <Utensils size={13} className={expenseScope === 'sdm' ? 'text-emerald-600' : 'text-gray-400'} />
                    )}
                    <span className="truncate">{isBengkel ? 'Mekanik' : isRetail ? 'Helper' : 'Gaji Staff'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScopeChange('lainnya')}
                    className={`py-1.5 px-1.5 rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] transition-all cursor-pointer ${
                      expenseScope === 'lainnya'
                        ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 font-black'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                    }`}
                  >
                    <Layers size={13} className={expenseScope === 'lainnya' ? 'text-purple-600' : 'text-gray-400'} />
                    <span className="truncate">{isBengkel ? 'Toolkit' : isRetail ? 'Kemasan' : 'Aset Toko'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Smart Procurement Box (Bahan Baku / Produk) */}
            {expenseScope === 'bahan_baku' && formData.type === 'Pengeluaran' && (
              <div className="p-2.5 sm:p-3 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-600" />
                    {isBengkel ? 'Master Suku Cadang & Supplier' : isRetail ? 'Master Barang Toko & Supplier' : 'Master Bahan Baku & Supplier'}
                  </span>
                  <span className="text-[9px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full font-bold">Auto-Isi</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 uppercase tracking-wider mb-1">
                      {isRetail ? 'Katalog Produk Toko' : isBengkel ? 'Suku Cadang & Oli' : 'Bahan Baku'}
                    </label>
                    {isRetail ? (
                      <select
                        className="w-full bg-white border border-indigo-200 text-gray-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 shadow-2xs focus:border-indigo-500 outline-none cursor-pointer"
                        value={selectedProduct?.id || ''}
                        onChange={(e) => {
                          const pId = e.target.value;
                          if (!pId) {
                            setSelectedProduct(null);
                            return;
                          }
                          const prod = products.find(p => p.id === Number(pId));
                          if (prod) {
                            setSelectedProduct(prod);
                            setMainCategory('Kulakan & Stok Dagangan');
                            const supPrefix = selectedSupplierId ? `[Supplier: ${suppliers.find(s => s.id === Number(selectedSupplierId))?.name || ''}] ` : '[Kulakan Toko] ';
                            setFormData(prev => ({
                              ...prev,
                              description: `${supPrefix}Beli Barang: ${prod.name} (Stok: ${prod.stock} ${prod.baseUom || 'Pcs'})`
                            }));
                          }
                        }}
                      >
                        <option value="">-- Pilih Produk Toko --</option>
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} (Stok: {prod.stock} {prod.baseUom || 'Pcs'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="w-full bg-white border border-indigo-200 text-gray-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 shadow-2xs focus:border-indigo-500 outline-none cursor-pointer"
                        value={selectedIngredient?.id || ''}
                        onChange={handleIngredientSelect}
                      >
                        <option value="">{isBengkel ? '-- Pilih Suku Cadang --' : '-- Pilih Bahan Baku --'}</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stok: {ing.stock} {ing.unit})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 uppercase tracking-wider mb-1">
                      Supplier / Vendor
                    </label>
                    <select
                      className="w-full bg-white border border-indigo-200 text-gray-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 shadow-2xs focus:border-indigo-500 outline-none cursor-pointer"
                      value={selectedSupplierId}
                      onChange={handleSupplierChange}
                    >
                      <option value="">-- Tanpa Supplier / Toko Bebas --</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          🏢 {sup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-Restock Option (Khusus Kafe & Bahan Baku) */}
            {!isBengkel && !isRetail && formData.type === 'Pengeluaran' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRestock}
                    onChange={(e) => setAutoRestock(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Package size={14} className="text-indigo-600" />
                    Tambah otomatis ke stok bahan baku dapur?
                  </span>
                </label>

                {autoRestock && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">Pilih Bahan Baku Dapur</label>
                      <select
                        className="w-full bg-white border border-gray-300 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"
                        value={selectedIngredient?.id || ''}
                        onChange={handleIngredientSelect}
                        required={autoRestock}
                      >
                        <option value="">-- Pilih Bahan Baku --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stok: {ing.stock} {ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-1">
                        Jumlah Tambah Stok ({selectedIngredient?.unit || 'Unit'})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        placeholder="Contoh: 5"
                        className="w-full bg-white border border-gray-300 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 font-bold"
                        value={restockQty || ''}
                        onChange={(e) => setRestockQty(parseFloat(e.target.value) || 0)}
                        required={autoRestock}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2-Tier Hierarchical Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  <Layers size={13} className="text-indigo-600" />
                  Kategori Utama <span className="text-rose-500">*</span>
                </label>
                <select 
                  className="w-full bg-slate-50 border border-gray-300 text-gray-800 text-xs font-bold rounded-lg px-2.5 py-2 focus:bg-white focus:border-indigo-500 outline-none shadow-2xs cursor-pointer" 
                  value={mainCategory}
                  onChange={(e) => setMainCategory(e.target.value)}
                  required
                >
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  <Tag size={13} className="text-indigo-600" />
                  Sub-Kategori Spesifik <span className="text-rose-500">*</span>
                </label>
                <select 
                  className="w-full bg-slate-50 border border-gray-300 text-gray-800 text-xs font-bold rounded-lg px-2.5 py-2 focus:bg-white focus:border-indigo-500 outline-none shadow-2xs cursor-pointer" 
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  required
                >
                  {currentCategoryObj?.subcategories.map(sub => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nominal Transaksi Card */}
            <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-gray-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                  <DollarSign size={14} className="text-indigo-600" />
                  Nominal Transaksi (Rp) <span className="text-rose-500">*</span>
                </label>
                {formData.amount > 0 && (
                  <button
                    type="button"
                    onClick={resetAmount}
                    className="text-[11px] text-gray-500 hover:text-rose-600 flex items-center gap-0.5 font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
              </div>

              <div className="flex rounded-xl shadow-xs border-2 border-indigo-200/90 focus-within:border-indigo-600 overflow-hidden bg-white transition-all">
                <div className="bg-indigo-600 text-white px-3 py-2 flex items-center font-black text-sm select-none">
                  Rp
                </div>
                <input 
                  type="text" 
                  inputMode="numeric"
                  name="amount"
                  className="w-full px-3 py-2 outline-none font-black text-lg sm:text-xl text-gray-900 tracking-wide placeholder-gray-300" 
                  placeholder="0"
                  value={displayAmount}
                  onChange={handleAmountChange}
                  required
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {[
                  { label: '+10 Rb', val: 10000 },
                  { label: '+20 Rb', val: 20000 },
                  { label: '+50 Rb', val: 50000 },
                  { label: '+100 Rb', val: 100000 },
                  { label: '+500 Rb', val: 500000 },
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => addAmount(p.val)}
                    className="px-2 py-0.5 text-[11px] font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {formData.amount > 0 ? (
                <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                  <div className="text-[11px] font-bold text-emerald-800 truncate">
                    {terbilangText} Rupiah
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 italic">
                  Ketik nominal pengeluaran kas
                </div>
              )}
            </div>

            {/* Catatan / Keterangan Rinci */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                <FileText size={13} className="text-indigo-600" />
                Rincian & Keterangan Belanja <span className="text-rose-500">*</span>
              </label>
              <textarea 
                name="description"
                className="w-full bg-white border border-gray-300 text-gray-800 text-xs rounded-xl p-2.5 focus:border-indigo-500 shadow-2xs outline-none transition-all resize-none" 
                rows={2}
                placeholder="Contoh: Beli 2 Galon Aqua Dapur / Token Listrik Darurat"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              ></textarea>
            </div>

            {/* UPLOAD FOTO NOTA / STRUK STRUK FISIK */}
            {formData.type === 'Pengeluaran' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Camera size={14} className="text-indigo-600" />
                    Lampiran Foto Nota / Struk Fisik
                  </span>
                  <span className="text-[10px] text-gray-500">Opsional tapi disarankan</span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptUpload}
                />

                {receiptImage ? (
                  <div className="relative flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-200">
                    <img 
                      src={receiptImage} 
                      alt="Nota Fisik" 
                      className="w-14 h-14 object-cover rounded-lg border border-gray-200" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">Foto Struk Terlampir</p>
                      <a 
                        href={receiptImage} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[11px] text-indigo-600 hover:underline font-medium inline-block mt-0.5"
                      >
                        Buka Foto Penuh
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptImage(null)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus foto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingReceipt}
                    className="w-full py-2.5 px-3 border border-dashed border-indigo-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-indigo-700 transition-all cursor-pointer"
                  >
                    {uploadingReceipt ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Mengunggah Foto Nota...</span>
                      </>
                    ) : (
                      <>
                        <Camera size={16} className="text-indigo-600" />
                        <span>Foto Struk Belanja / Kamera HP</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            {/* Status Approval Selector (Khusus Owner / Admin jika ingin simulasi atau langsung approve) */}
            {isOwnerOrAdmin && formData.type === 'Pengeluaran' && (
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="font-bold text-gray-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" />
                  Status Pengajuan:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSubmissionStatus('PENDING_APPROVAL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      submissionStatus === 'PENDING_APPROVAL'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    ⏳ Masuk Antrean Approval
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionStatus('APPROVED')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      submissionStatus === 'APPROVED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    ✅ Langsung Disetujui
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-gray-200 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                cashPocket === 'KAS_OPERASIONAL' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}>
                {cashPocket === 'KAS_OPERASIONAL' ? 'Kas Operasional' : 'Laci Kasir'}
              </span>
              {formData.amount > 0 && (
                <span className="font-black text-gray-900 text-sm">
                  Rp {formData.amount.toLocaleString('id-ID')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button 
                type="button" 
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs transition-colors cursor-pointer" 
                onClick={onClose} 
                disabled={loading}
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer" 
                disabled={loading || uploadingReceipt}
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>{cashPocket === 'KAS_OPERASIONAL' ? 'Ajukan Pengeluaran' : 'Simpan Transaksi Kas'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashFlowModal;
