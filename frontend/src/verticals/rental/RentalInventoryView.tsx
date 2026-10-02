import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Shirt, 
  Search, 
  Plus, 
  RefreshCw, 
  Tag, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Boxes, 
  Edit3, 
  Trash2, 
  Eye, 
  Printer, 
  Filter, 
  DollarSign, 
  ArrowUpRight, 
  Calendar, 
  User, 
  Phone, 
  ShieldAlert, 
  Check, 
  X,
  LayoutGrid,
  List,
  Sparkle,
  Image as ImageIcon,
  UploadCloud,
  Camera
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { compressImageFile } from '../../utils/imageCompressor';

interface ActiveRental {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupDate: string;
  returnDeadline: string;
  isOverdue: boolean;
}

interface LaundryDetail {
  orderId: string;
  orderNumber: string;
  customerName: string;
  damageNotes: string | null;
}

interface UpcomingBooking {
  orderId: string;
  orderNumber: string;
  customerName: string;
  eventDate: string;
  pickupDate: string;
  returnDeadline: string;
}

interface InventoryItem {
  id: number;
  name: string;
  code: string;
  category: string;
  categoryId: number;
  color: string;
  size: string;
  storageLocation: string;
  sellPrice: number;
  buyPrice: number;
  stock: number;
  availableStock: number;
  rentedStock: number;
  laundryStock: number;
  bookedStock: number;
  statusBadge: 'READY' | 'RENTED' | 'LAUNDRY' | 'BOOKED' | 'OUT_OF_STOCK' | 'PARTIAL';
  imageUrl?: string | null;
  activeRentals: ActiveRental[];
  laundryDetails: LaundryDetail[];
  upcomingBookings: UpcomingBooking[];
  lifetimeRentals: number;
  lifetimeRevenue: number;
  lifetimeDamagedCount: number;
  roiPercent: number;
}

interface InventorySummary {
  totalAttires: number;
  totalStockUnits: number;
  totalAvailableUnits: number;
  totalRentedUnits: number;
  totalLaundryUnits: number;
  totalBookedUnits: number;
  totalAssetValue: number;
  utilizationRate: number;
}

export const RentalInventoryView: React.FC = () => {
  const { token } = usePOS();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  
  // Filtering & Display
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'RENTED' | 'LAUNDRY' | 'BOOKED'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Modal States
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedItemForTag, setSelectedItemForTag] = useState<InventoryItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form Fields for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    categoryName: 'Baju Bodo Modern',
    color: '',
    size: 'All Size',
    storageLocation: 'Hanger A-01',
    sellPrice: 250000,
    buyPrice: 650000,
    stock: 1,
    imageUrl: ''
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.type.startsWith('image/')) {
      toast('File harus berupa gambar (JPG, PNG, atau WEBP)', 'error');
      return;
    }

    try {
      setUploadingImage(true);
      const compressed = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85,
        format: 'image/webp'
      });

      const data = new FormData();
      data.append('image', compressed, compressed.name || 'attire.webp');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal mengunggah foto');

      const uploadedUrl = resData.imageUrl || resData.url;
      setFormData(prev => ({ ...prev, imageUrl: uploadedUrl }));
      toast('Foto busana berhasil diunggah!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mengunggah foto', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch Inventory Data
  const fetchInventory = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/rental/inventory', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal memuat inventaris');
      const data = await res.json();
      setSummary(data.summary);
      setItems(data.items || []);
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Gagal memuat inventaris', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Unique Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set);
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchSearch = 
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.storageLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.color.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || it.category === selectedCategory;

      let matchStatus = true;
      if (statusFilter === 'READY') {
        matchStatus = it.availableStock > 0;
      } else if (statusFilter === 'RENTED') {
        matchStatus = it.rentedStock > 0;
      } else if (statusFilter === 'LAUNDRY') {
        matchStatus = it.laundryStock > 0;
      } else if (statusFilter === 'BOOKED') {
        matchStatus = it.bookedStock > 0;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, searchQuery, selectedCategory, statusFilter]);

  // Quick Action: Selesaikan Cuci Laundry
  const handleCompleteLaundry = async (item: InventoryItem) => {
    if (!token) return;
    try {
      const res = await fetch('/api/rental/inventory/complete-laundry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ attireCode: item.code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyelesaikan laundry');

      toast(data.message || 'Busana bersih dan siap disewa kembali di rak!', 'success');
      fetchInventory();
    } catch (err: any) {
      console.error(err);
      toast(err.message, 'error');
    }
  };

  // Open Form Modal for Create
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
      code: '',
      categoryName: 'Baju Bodo Modern',
      color: '',
      size: 'M',
      storageLocation: 'Hanger A-01',
      sellPrice: 250000,
      buyPrice: 650000,
      stock: 1,
      imageUrl: ''
    });
    setShowFormModal(true);
  };

  // Open Form Modal for Edit
  const handleOpenEditModal = (item: InventoryItem) => {
    setModalItem(item);
    setIsEditMode(true);
    setFormData({
      name: item.name,
      code: item.code,
      categoryName: item.category,
      color: item.color,
      size: item.size,
      storageLocation: item.storageLocation,
      sellPrice: item.sellPrice,
      buyPrice: item.buyPrice,
      stock: item.stock,
      imageUrl: item.imageUrl || ''
    });
    setShowFormModal(true);
  };

  // Save Add / Edit
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const url = isEditMode && modalItem 
        ? `/api/rental/inventory/${modalItem.id}` 
        : '/api/rental/inventory';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan busana');

      toast(data.message || 'Data busana berhasil disimpan!', 'success');
      setShowFormModal(false);
      fetchInventory();
    } catch (err: any) {
      console.error(err);
      toast(err.message, 'error');
    }
  };

  // Delete Attire
  const handleDeleteAttire = async (item: InventoryItem) => {
    if (!window.confirm(`Yakin ingin menghapus busana "${item.name}" (${item.code}) dari inventaris?`)) return;
    if (!token) return;
    try {
      const res = await fetch(`/api/rental/inventory/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus busana');

      toast(data.message || 'Busana berhasil dihapus', 'success');
      fetchInventory();
    } catch (err: any) {
      console.error(err);
      toast(err.message, 'error');
    }
  };

  // Open History Modal
  const handleOpenHistoryModal = async (item: InventoryItem) => {
    setModalItem(item);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/rental/inventory/${item.id}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal memuat riwayat');
      const data = await res.json();
      setHistoryData(data);
    } catch (err: any) {
      console.error(err);
      toast(err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Tag Print Modal
  const handleOpenTagModal = (item: InventoryItem) => {
    setSelectedItemForTag(item);
    setShowTagModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 sm:pb-16 max-w-[1600px] mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* ─── HEADER BAR: Modern Responsive Gradient Banner ─────────────────── */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md shadow-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
            <Shirt size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-black text-white tracking-tight">
                Inventaris Busana Adat
              </h1>
              <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                <Sparkle size={10} className="text-amber-300" />
                Live Stock
              </span>
            </div>
            <p className="text-xs text-indigo-100 mt-0.5 hidden sm:block">
              Pantau posisi fisik rak/gantungan, status sewa real-time, antrean laundry, dan estimasi ROI modal koleksi.
            </p>
            <p className="text-[11px] text-indigo-100 mt-0.5 sm:hidden">
              Posisi Rak Lemari &amp; Live Stock Sanggar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-white' : 'text-white'} />
            <span className="hidden xs:inline sm:inline">Segarkan</span>
          </button>

          <button
            onClick={() => navigate('/rental-kanban')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
            title="Buka Papan Kanban Sewa"
          >
            <Layers size={13} className="text-white" />
            <span>Papan Sewa</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-95 font-black rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus size={15} className="text-indigo-700" />
            <span>+ Busana</span>
          </button>
        </div>
      </div>

      {/* ─── SUMMARY KPI METRICS: Compact Mobile & Tablet Grid ─────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
          {/* Total Busana */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Koleksi</span>
              <span className="p-1 rounded-lg bg-slate-100 text-slate-600">
                <Boxes size={13} />
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">
                {summary.totalAttires} <span className="text-xs font-semibold text-slate-400">Model</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-medium">{summary.totalStockUnits} Unit Fisik Total</div>
            </div>
          </div>

          {/* Siap Sewa di Rak */}
          <div className="bg-white border border-emerald-100 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between text-emerald-500 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Tersedia Rak</span>
              <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={13} />
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black text-emerald-600 leading-tight">
                {summary.totalAvailableUnits} <span className="text-xs font-semibold text-emerald-500">Unit</span>
              </div>
              <div className="text-[10px] text-emerald-600/80 font-medium mt-0.5">Siap sewa hari ini</div>
            </div>
          </div>

          {/* Sedang Keluar Disewa */}
          <div className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between text-blue-500 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Sedang Disewa</span>
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
                <Shirt size={13} />
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black text-blue-600 leading-tight">
                {summary.totalRentedUnits} <span className="text-xs font-semibold text-blue-500">Unit</span>
              </div>
              <div className="text-[10px] text-blue-600/80 font-medium mt-0.5">Dibawa pelanggan</div>
            </div>
          </div>

          {/* Antrean Cuci / Laundry */}
          <div className="bg-white border border-purple-100 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-purple-300 transition-all">
            <div className="flex items-center justify-between text-purple-500 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Antrean Cuci</span>
              <span className="p-1 rounded-lg bg-purple-50 text-purple-600">
                <Clock size={13} />
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black text-purple-600 leading-tight">
                {summary.totalLaundryUnits} <span className="text-xs font-semibold text-purple-500">Unit</span>
              </div>
              <div className="text-[10px] text-purple-600/80 font-medium mt-0.5">Perlu cuci / setrika</div>
            </div>
          </div>

          {/* Ter-booking Jadwal */}
          <div className="bg-white border border-indigo-100 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-indigo-300 transition-all">
            <div className="flex items-center justify-between text-indigo-500 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Ter-Booking</span>
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                <Calendar size={13} />
              </span>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black text-indigo-700 leading-tight">
                {summary.totalBookedUnits} <span className="text-xs font-semibold text-indigo-500">Unit</span>
              </div>
              <div className="text-[10px] text-indigo-600/80 font-medium mt-0.5">Acara mendatang</div>
            </div>
          </div>

          {/* Total Nilai Aset & Utilisasi */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-indigo-300 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nilai Aset</span>
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                <TrendingUp size={13} />
              </span>
            </div>
            <div>
              <div className="text-base sm:text-xl font-black text-slate-800 leading-tight truncate">
                Rp {Math.round(summary.totalAssetValue / 1000).toLocaleString('id-ID')}k
              </div>
              <div className="text-[10px] text-indigo-600 font-bold mt-0.5">
                Utilisasi: {summary.utilizationRate}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTROLS: SEARCH, FILTERS & VIEW MODE ──────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 md:max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama busana, nomor rak/gantungan, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'GRID' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Kartu (Grid)"
              >
                <LayoutGrid size={13} />
                <span className="hidden sm:inline">Kartu</span>
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Tabel / Daftar"
              >
                <List size={13} />
                <span className="hidden sm:inline">Tabel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Horizontal Scrolling Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
            }`}
          >
            Semua ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('READY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'READY'
                ? 'bg-emerald-600 text-white font-black shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${statusFilter === 'READY' ? 'bg-white' : 'bg-emerald-500'}`} />
            Tersedia ({items.filter(i => i.availableStock > 0).length})
          </button>
          <button
            onClick={() => setStatusFilter('RENTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'RENTED'
                ? 'bg-blue-600 text-white font-black shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${statusFilter === 'RENTED' ? 'bg-white' : 'bg-blue-500'}`} />
            Disewa ({items.filter(i => i.rentedStock > 0).length})
          </button>
          <button
            onClick={() => setStatusFilter('LAUNDRY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'LAUNDRY'
                ? 'bg-purple-600 text-white font-black shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${statusFilter === 'LAUNDRY' ? 'bg-white' : 'bg-purple-500'}`} />
            Laundry ({items.filter(i => i.laundryStock > 0).length})
          </button>
          <button
            onClick={() => setStatusFilter('BOOKED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'BOOKED'
                ? 'bg-indigo-600 text-white font-black shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${statusFilter === 'BOOKED' ? 'bg-white' : 'bg-indigo-400'}`} />
            Ter-Booking ({items.filter(i => i.bookedStock > 0).length})
          </button>
        </div>

        {/* Category Filter Pills (if any categories) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-slate-100 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Kategori:
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── CONTENT: GRID OR TABLE VIEW ─────────────────────────────────────── */}
      {loading ? (
        <div className="p-16 text-center text-indigo-600 font-bold text-xs bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-2 shadow-2xs">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <span>Memuat inventaris busana...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-2 shadow-2xs">
          <Shirt size={40} className="text-slate-300" />
          <div className="text-sm font-bold text-slate-800">Tidak ada busana yang sesuai</div>
          <p className="text-xs text-slate-400 max-w-sm">Coba ubah kata kunci pencarian atau sesuaikan filter status/kategori.</p>
        </div>
      ) : viewMode === 'GRID' ? (
        /* ─── 2-COLUMN MOBILE / 4-COLUMN DESKTOP GRID ─── */
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {filteredItems.map(item => {
            const hasRented = item.rentedStock > 0;
            const hasLaundry = item.laundryStock > 0;
            const isOverdue = item.activeRentals.some(r => r.isOverdue);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between transition-all hover:shadow-md border ${
                  isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200/80 hover:border-indigo-200'
                }`}
              >
                {/* Thumbnail Image + Overlays */}
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex flex-col items-center justify-center p-3 text-white/50">
                      <Shirt size={32} className="text-white/40" />
                      <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">Busana Adat</span>
                    </div>
                  )}

                  {/* Top-Left: Hanger / Location Badge */}
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                      <Tag size={9} />
                      {item.storageLocation}
                    </span>
                  </div>

                  {/* Top-Right: Status Badge */}
                  <div className="absolute top-2 right-2">
                    {item.statusBadge === 'READY' && (
                      <span className="bg-emerald-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        ✓ Ready
                      </span>
                    )}
                    {item.statusBadge === 'RENTED' && (
                      <span className={`text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs ${
                        isOverdue ? 'bg-rose-600 animate-pulse' : 'bg-blue-600'
                      }`}>
                        {isOverdue ? '⚠ Terlambat' : 'Disewa'}
                      </span>
                    )}
                    {item.statusBadge === 'LAUNDRY' && (
                      <span className="bg-purple-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        🫧 Laundry
                      </span>
                    )}
                    {item.statusBadge === 'PARTIAL' && (
                      <span className="bg-cyan-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        {item.availableStock}/{item.stock} Siap
                      </span>
                    )}
                    {item.statusBadge === 'BOOKED' && (
                      <span className="bg-indigo-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        Booked
                      </span>
                    )}
                    {item.statusBadge === 'OUT_OF_STOCK' && (
                      <span className="bg-slate-700 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                        Habis
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      {item.category}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                      {item.name}
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.code}
                    </div>
                  </div>

                  {/* Specs: Color & Size mini-pills */}
                  <div className="flex gap-1 flex-wrap">
                    {item.color && (
                      <span className="bg-slate-100 text-slate-700 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                        {item.color}
                      </span>
                    )}
                    {item.size && (
                      <span className="bg-slate-100 text-slate-700 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                        Size {item.size}
                      </span>
                    )}
                  </div>

                  {/* Stock Mini Visual */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-600">
                      <span>Ketersediaan:</span>
                      <span className="font-bold">
                        <strong className="text-emerald-600">{item.availableStock}</strong> / {item.stock} Unit
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-emerald-500 h-full transition-all" 
                        style={{ width: `${(item.availableStock / item.stock) * 100}%` }}
                        title={`Tersedia: ${item.availableStock}`}
                      />
                      <div 
                        className="bg-blue-500 h-full transition-all" 
                        style={{ width: `${(item.rentedStock / item.stock) * 100}%` }}
                        title={`Disewa: ${item.rentedStock}`}
                      />
                      <div 
                        className="bg-purple-500 h-full transition-all" 
                        style={{ width: `${(item.laundryStock / item.stock) * 100}%` }}
                        title={`Laundry: ${item.laundryStock}`}
                      />
                    </div>
                  </div>

                  {/* Rate & ROI */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div>
                      <div className="text-[9px] text-slate-400 font-medium">Tarif Sewa</div>
                      <div className="font-black text-emerald-600 text-xs sm:text-sm">
                        Rp {item.sellPrice.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.roiPercent >= 100 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {item.roiPercent}% ROI
                      </span>
                    </div>
                  </div>

                  {/* Overdue alert if rented & late */}
                  {isOverdue && item.activeRentals.length > 0 && (
                    <div className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-1.5 flex items-center gap-1">
                      <AlertCircle size={10} className="shrink-0 text-rose-600" />
                      <span className="truncate">Terlambat: {item.activeRentals[0].customerName}</span>
                    </div>
                  )}

                  {/* Quick Action: Selesai Cuci */}
                  {hasLaundry && (
                    <button
                      onClick={() => handleCompleteLaundry(item)}
                      className="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check size={11} />
                      <span>Selesai Cuci ({item.laundryStock} Unit)</span>
                    </button>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div className="p-2 sm:p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1 sm:gap-1.5">
                  <button
                    onClick={() => handleOpenHistoryModal(item)}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] sm:text-xs font-bold transition-all border border-slate-200 flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                    title="Lihat ROI & Riwayat Sewa"
                  >
                    <TrendingUp size={11} className="text-indigo-600" />
                    <span>ROI</span>
                  </button>

                  <button
                    onClick={() => handleOpenTagModal(item)}
                    className="w-7 h-7 sm:w-8 sm:h-8 bg-white hover:bg-slate-100 text-slate-700 rounded-xl transition-all border border-slate-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0"
                    title="Cetak Label Tag Gantungan"
                  >
                    <Printer size={12} />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="w-7 h-7 sm:w-8 sm:h-8 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all border border-slate-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0"
                    title="Edit Busana"
                  >
                    <Edit3 size={12} />
                  </button>

                  <button
                    onClick={() => handleDeleteAttire(item)}
                    className="w-7 h-7 sm:w-8 sm:h-8 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-200 hover:border-rose-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0"
                    title="Hapus Busana"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── TABLE VIEW (RESPONSIVE: DESKTOP TABLE + MOBILE CARD LIST) ────── */
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Busana &amp; SKU</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Lokasi Rak</th>
                  <th className="py-3 px-3 text-right">Tarif Sewa</th>
                  <th className="py-3 px-3 text-right">Modal Aset</th>
                  <th className="py-3 px-3 text-center">Stok (Ready/Tot)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Disewa</th>
                  <th className="py-3 px-3 text-center">ROI</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{item.code} • {item.color} • {item.size}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{item.category}</td>
                    <td className="py-3 px-3">
                      <span className="bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                        {item.storageLocation}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-600">
                      Rp {item.sellPrice.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500">
                      Rp {item.buyPrice.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      <span className={item.availableStock > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {item.availableStock}
                      </span>
                      <span className="text-slate-400"> / {item.stock}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.statusBadge === 'READY' && <span className="text-emerald-600 font-bold">🟢 Ready</span>}
                      {item.statusBadge === 'RENTED' && <span className="text-blue-600 font-bold">🔵 Disewa</span>}
                      {item.statusBadge === 'LAUNDRY' && <span className="text-purple-600 font-bold">🟣 Laundry</span>}
                      {item.statusBadge === 'PARTIAL' && <span className="text-cyan-600 font-bold">Tersedia Sebagian</span>}
                      {item.statusBadge === 'BOOKED' && <span className="text-amber-600 font-bold">🟡 Booked</span>}
                      {item.statusBadge === 'OUT_OF_STOCK' && <span className="text-rose-600 font-bold">🔴 Habis</span>}
                    </td>
                    <td className="py-3 px-3 text-center font-medium">
                      {item.lifetimeRentals}x
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-black text-[11px] px-2 py-0.5 rounded-full ${
                        item.roiPercent >= 100 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.roiPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenHistoryModal(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-indigo-600 rounded-lg cursor-pointer"
                          title="Lihat ROI & Riwayat"
                        >
                          <TrendingUp size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenTagModal(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                          title="Cetak Tag"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteAttire(item)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredItems.map(item => (
              <div key={item.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                        <Shirt size={20} />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">{item.name}</h4>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {item.code} • {item.color} • Size {item.size}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.statusBadge === 'READY' && <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">🟢 Ready</span>}
                    {item.statusBadge === 'RENTED' && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded-full">🔵 Disewa</span>}
                    {item.statusBadge === 'LAUNDRY' && <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded-full">🟣 Laundry</span>}
                    {item.statusBadge === 'PARTIAL' && <span className="text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold px-2 py-0.5 rounded-full">Tersedia Sebagian</span>}
                    {item.statusBadge === 'BOOKED' && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-full">🟡 Booked</span>}
                    {item.statusBadge === 'OUT_OF_STOCK' && <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-full">🔴 Habis</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {item.category}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    🏷️ {item.storageLocation}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Tarif Sewa</div>
                    <div className="text-xs font-black text-emerald-600">Rp {item.sellPrice.toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Stok (Ready/Tot)</div>
                    <div className="text-xs font-bold text-slate-800">
                      <span className={item.availableStock > 0 ? 'text-emerald-600' : 'text-rose-600'}>{item.availableStock}</span>
                      <span className="text-slate-400"> / {item.stock}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">ROI / Disewa</div>
                    <div className="text-xs font-bold text-indigo-700">{item.roiPercent}% ({item.lifetimeRentals}x)</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => handleOpenHistoryModal(item)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-slate-200/80 transition-all cursor-pointer"
                    title="Lihat ROI & Riwayat"
                  >
                    <TrendingUp size={12} />
                    <span className="text-[10px]">ROI</span>
                  </button>
                  <button
                    onClick={() => handleOpenTagModal(item)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-slate-200/80 transition-all cursor-pointer"
                    title="Cetak Tag"
                  >
                    <Printer size={12} />
                    <span className="text-[10px]">Tag</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-slate-200/80 transition-all cursor-pointer"
                    title="Edit"
                  >
                    <Edit3 size={12} />
                    <span className="text-[10px]">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteAttire(item)}
                    className="py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-rose-200/80 transition-all cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={12} />
                    <span className="text-[10px]">Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* ─── MODAL: ADD / EDIT KOLEKSI BUSANA ─────────────────────────────────── */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
                  <Shirt size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    {isEditMode ? 'Edit Data Busana' : 'Tambah Busana Baru'}
                  </h3>
                  <p className="text-[11px] text-indigo-100">Lengkapi identitas busana adat, nomor rak, tarif sewa, &amp; modal aset.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama Busana Adat *</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Baju Bodo Modern Organza Payet Maroon"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Kode SKU / Barcode</label>
                  <input
                    type="text"
                    placeholder="Auto: BBM-ORG-MRH-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 uppercase font-mono"
                  />
                  <p className="text-[10px] text-slate-400">Kosongkan jika ingin auto-generate.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Kategori Busana *</label>
                  <input
                    type="text"
                    required
                    placeholder="Baju Bodo Modern, Pengantin, Jas Tutup"
                    value={formData.categoryName}
                    onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Warna</label>
                  <input
                    type="text"
                    placeholder="Merah Marun, Sage Green"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Ukuran (Size)</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  >
                    <option value="S">S (Small)</option>
                    <option value="M">M (Medium)</option>
                    <option value="L">L (Large)</option>
                    <option value="XL">XL (Extra Large)</option>
                    <option value="XXL">XXL</option>
                    <option value="All Size">All Size</option>
                    <option value="Junior">Junior (Anak)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Lokasi Gantungan / Rak *</label>
                  <input
                    type="text"
                    required
                    placeholder="Hanger A-01, Lemari 2"
                    value={formData.storageLocation}
                    onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-indigo-700">Tarif Sewa (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    required
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Modal Pengadaan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={formData.buyPrice}
                    onChange={(e) => setFormData({ ...formData, buyPrice: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">Untuk kalkulasi ROI modal sewa.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Jumlah Unit Fisik *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Foto Busana Adat</span>
                  <span className="text-[10px] text-slate-400 font-normal">Pilih file foto atau tempel URL</span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {/* Preview Thumbnail */}
                  <div className="w-20 h-20 rounded-xl bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 relative group shadow-2xs">
                    {formData.imageUrl ? (
                      <>
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold"
                        >
                          Hapus Foto
                        </button>
                      </>
                    ) : (
                      <ImageIcon size={24} className="text-slate-400" />
                    )}
                  </div>

                  {/* Upload Button & URL input */}
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="inventory-attire-photo-input"
                      />
                      <label
                        htmlFor="inventory-attire-photo-input"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          uploadingImage
                            ? 'bg-slate-200 text-slate-500 cursor-wait'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {uploadingImage ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" /> Mengunggah...
                          </>
                        ) : (
                          <>
                            <UploadCloud size={13} /> Pilih File / Kamera
                          </>
                        )}
                      </label>

                      {formData.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                          className="text-[11px] text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Atau tempel URL gambar (https://...)"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                    />

                    {/* 1-Klik Pilih Preset Foto */}
                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <Sparkles size={11} className="text-indigo-500" />
                        Pilih Cepat Foto Sampel:
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {[
                          { name: 'Baju Bodo Maroon', url: '/images/rental/baju_bodo_maroon.jpg' },
                          { name: 'Baju Bodo Lilac', url: '/images/rental/baju_bodo_lilac.jpg' },
                          { name: 'Baju La\'bu Hijau', url: '/images/rental/baju_labbu_sutra.jpg' },
                          { name: 'Baju Pengantin Gold', url: '/images/rental/baju_pengantin_gold.jpg' },
                        ].map((p) => (
                          <button
                            key={p.url}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, imageUrl: p.url }))}
                            className={`group relative w-11 h-11 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                              formData.imageUrl === p.url
                                ? 'border-indigo-600 ring-2 ring-indigo-400/40'
                                : 'border-slate-200 hover:border-indigo-400 opacity-80 hover:opacity-100'
                            }`}
                            title={p.name}
                          >
                            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                            {formData.imageUrl === p.url && (
                              <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  {isEditMode ? 'Simpan Perubahan' : 'Tambahkan ke Inventaris'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RIWAYAT SEWA & ANALITIK ROI BUSANA ────────────────────────── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Riwayat Sewa &amp; Analitik ROI Busana
                  </h3>
                  <p className="text-[11px] text-indigo-100">
                    {modalItem?.name} ({modalItem?.code})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {historyLoading ? (
                <div className="p-12 text-center text-indigo-600 font-bold text-xs flex flex-col items-center gap-2">
                  <RefreshCw size={24} className="animate-spin" />
                  <span>Menghitung riwayat sewa &amp; ROI...</span>
                </div>
              ) : historyData ? (
                <>
                  {/* ROI Highlights Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Total Disewa</div>
                      <div className="text-base sm:text-lg font-black text-slate-800">{historyData.product.timesRented}x Transaksi</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Omzet Sewa</div>
                      <div className="text-base sm:text-lg font-black text-emerald-600">
                        Rp {historyData.product.totalRentalRevenue.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Modal Pengadaan</div>
                      <div className="text-base sm:text-lg font-black text-slate-600">
                        Rp {historyData.product.buyPrice.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Status Balik Modal</div>
                      <div className="text-base sm:text-lg font-black text-indigo-600">
                        {historyData.product.roiPercent}% ROI
                      </div>
                    </div>
                  </div>

                  {/* Order History Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Daftar Pelanggan yang Pernah Menyewa
                    </h4>
                    {historyData.history.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                        Belum ada riwayat transaksi sewa untuk busana ini.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200/80 scrollbar-none">
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">No. Nota</th>
                                <th className="py-2.5 px-3">Penyewa</th>
                                <th className="py-2.5 px-3">Tgl Ambil</th>
                                <th className="py-2.5 px-3">Tgl Kembali</th>
                                <th className="py-2.5 px-3">Kondisi</th>
                                <th className="py-2.5 px-3 text-right">Tarif</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {historyData.history.map((h: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-indigo-700">{h.orderNumber}</td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900">{h.customerName}</td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    {new Date(h.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    {h.returnDate ? new Date(h.returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      h.returnCondition === 'GOOD' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      h.returnCondition === 'DIRTY' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {h.returnCondition}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                                    Rp {h.rentalPrice.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="sm:hidden divide-y divide-slate-100">
                          {historyData.history.map((h: any, idx: number) => (
                            <div key={idx} className="p-3 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                  {h.orderNumber}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  h.returnCondition === 'GOOD' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  h.returnCondition === 'DIRTY' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {h.returnCondition}
                                </span>
                              </div>
                              <div className="flex items-center justify-between font-bold text-slate-900">
                                <span>{h.customerName}</span>
                                <span className="text-emerald-600 font-black">Rp {h.rentalPrice.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                                <span>Ambil: {new Date(h.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                <span>Kembali: {h.returnDate ? new Date(h.returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CETAK TAG HANGER / LABEL GANTUNGAN ────────────────────────── */}
      {showTagModal && selectedItemForTag && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-indigo-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Printer size={16} />
                Cetak Tag Gantungan Hanger
              </h3>
              <button onClick={() => setShowTagModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview Tag Hanger Fisik */}
              <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-xs border-2 border-dashed border-indigo-300 text-center space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  RENTAL BUSANA ADAT
                </div>
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-black text-xs px-3 py-1 rounded-lg inline-block">
                  {selectedItemForTag.storageLocation}
                </div>
                <div className="text-sm font-black text-slate-900 leading-tight">
                  {selectedItemForTag.name}
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {selectedItemForTag.color} • Size {selectedItemForTag.size}
                </div>
                <div className="py-2 border-y border-slate-100">
                  <div className="font-mono text-xs tracking-wider font-bold text-slate-800">
                    *{selectedItemForTag.code}*
                  </div>
                  <div className="text-[10px] text-slate-400">Barcode SKU</div>
                </div>
                <div className="text-xs font-bold text-emerald-600">
                  Tarif Sewa: Rp {selectedItemForTag.sellPrice.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTagModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    window.print();
                    toast('Perintah cetak tag dikirim ke printer!', 'success');
                    setShowTagModal(false);
                  }}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Cetak Tag</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RentalInventoryView;
