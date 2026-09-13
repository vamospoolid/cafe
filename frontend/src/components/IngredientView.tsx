import React, { useState, useEffect, useContext } from 'react';
import { 
  Package, Plus, Edit2, Trash2, AlertTriangle, ChevronDown, ChevronUp, 
  RefreshCw, TrendingDown, TrendingUp, Search, History, Utensils, ClipboardCheck, 
  CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, DollarSign, ArrowRight, 
  ShieldAlert, FileText, Coffee, ShoppingBag, Truck, BarChart3, PieChart, 
  ArrowUpRight, ArrowDownRight, Layers, HelpCircle, Send, ShoppingCart,
  Download, Printer, MessageCircle, Copy
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import { 
  exportIngredientValuationPDF, 
  exportStockLossAuditPDF, 
  exportProcurementForecastPDF, 
  exportStockOpnameVariancePDF 
} from '../utils/pdfGenerator';

interface Ingredient {
  id: number;
  name: string;
  category?: 'FOOD' | 'DRINK' | 'PACKAGING' | string;
  unit: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  supplierId: number | null;
  supplier?: { id: number; name: string; phone?: string } | null;
}

interface ProductionForecastItem {
  productId: number;
  productName: string;
  categoryName: string;
  sellPrice: number;
  buyPrice: number;
  imageUrl?: string;
  hasRecipe: boolean;
  maxPortions: number;
  status: 'Aman' | 'Menipis' | 'Kritis (Hampir Habis)' | 'Habis (Sold Out)' | string;
  bottleneck?: {
    ingredientId: number;
    ingredientName: string;
    currentStock: number;
    qtyPerServing: number;
    unit: string;
    maxPortions: number;
  } | null;
  recipeDetails: Array<{
    ingredientId: number;
    ingredientName: string;
    unit: string;
    qtyPerServing: number;
    currentStock: number;
    costPerServing: number;
    maxPortions: number;
  }>;
}

interface OpnameItemState {
  ingredientId: number;
  name: string;
  unit: string;
  buyPrice: number;
  systemStock: number;
  physicalStock: number | string;
  reason: string;
  notes: string;
}

const API = '/api';

export const IngredientView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Tab State: 'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname'
  const [activeTab, setActiveTab] = useState<'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname'>('master');

  // Master Ingredients Data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'safe'>('all');

  // Stock Loss Data & Analytics
  const [lossData, setLossData] = useState<any>(null);
  const [lossLoading, setLossLoading] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossForm, setLossForm] = useState({
    ingredientId: '',
    qtyLoss: '',
    reason: 'Busuk / Kadaluarsa',
    notes: ''
  });
  const [submittingLoss, setSubmittingLoss] = useState(false);

  // Shopping & Restock Analytics
  const [shoppingData, setShoppingData] = useState<any>(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);

  // Stock Movements Ledger
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [movementIngredientFilter, setMovementIngredientFilter] = useState<string>('ALL');

  // Production Forecast Data
  const [forecastList, setForecastList] = useState<ProductionForecastItem[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastCategory, setForecastCategory] = useState<string>('Semua');
  const [expandedForecastId, setExpandedForecastId] = useState<number | null>(null);

  // Stock Opname Audit State
  const [opnameItems, setOpnameItems] = useState<OpnameItemState[]>([]);
  const [auditorName, setAuditorName] = useState<string>(posContext?.user?.username || 'Admin');
  const [opnameNotes, setOpnameNotes] = useState<string>('Stock Opname Rutin Dapur');
  const [submittingOpname, setSubmittingOpname] = useState(false);
  const [opnameHistory, setOpnameHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modals & PDF Dropdown
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<Ingredient | null>(null);
  const [adjustModal, setAdjustModal] = useState<{ open: boolean; ingredient: Ingredient | null }>({ open: false, ingredient: null });
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // PDF Export Handlers
  const handleExportValuationPDF = async () => {
    try {
      setGeneratingPdf(true);
      await exportIngredientValuationPDF(posContext?.settings || {}, ingredients, posContext?.user?.username || 'Finance');
      toast('Laporan Valuasi Aset Persediaan berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh laporan PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportLossPDF = async () => {
    try {
      setGeneratingPdf(true);
      let data = lossData;
      if (!data) {
        const res = await fetch(`${API}/ingredients/loss/analytics`, { headers });
        if (res.ok) data = await res.json();
      }
      await exportStockLossAuditPDF(posContext?.settings || {}, data, posContext?.user?.username || 'Auditor Dapur');
      toast('Laporan Audit Stock Loss berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh laporan PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportShoppingPDF = async () => {
    try {
      setGeneratingPdf(true);
      let data = shoppingData;
      if (!data) {
        const res = await fetch(`${API}/ingredients/shopping/analytics`, { headers });
        if (res.ok) data = await res.json();
      }
      await exportProcurementForecastPDF(posContext?.settings || {}, data, posContext?.user?.username || 'Purchasing');
      toast('Laporan Rencana Anggaran Belanja berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh laporan PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportOpnamePDF = async () => {
    try {
      setGeneratingPdf(true);
      await exportStockOpnameVariancePDF(posContext?.settings || {}, opnameItems, auditorName, opnameNotes);
      toast('Berita Acara Stock Opname berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh laporan PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const copySupplierOrderToWA = (sup: any) => {
    const store = posContext?.settings?.storeName || 'MUKI RAMEN';
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    let text = `*ORDER PEMBELIAN BAHAN BAKU*\n`;
    text += `🏬 Toko: ${store}\n`;
    text += `📦 Supplier: ${sup.supplierName}\n`;
    text += `📅 Tanggal: ${dateStr}\n\n`;
    text += `Halo ${sup.supplierName}, mohon diproses pesanan kebutuhan bahan baku berikut:\n\n`;
    
    sup.items.forEach((item: any, idx: number) => {
      text += `${idx + 1}. *${item.name}*: ${item.suggestedBuy} ${item.unit} (Sisa stok: ${item.stock} ${item.unit})\n`;
    });
    
    text += `\n💰 *Total Estimasi Biaya:* Rp ${sup.totalCost.toLocaleString('id-ID')}\n\n`;
    text += `Mohon konfirmasi ketersediaan dan jadwal pengirimannya. Terima kasih! 🙏`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast(`✓ Pesanan ${sup.supplierName} berhasil disalin ke WhatsApp!`, 'success'))
        .catch(() => toast('Gagal menyalin format WA.', 'error'));
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast(`✓ Pesanan ${sup.supplierName} berhasil disalin ke WhatsApp!`, 'success');
    }
  };

  const copyAllShoppingToWA = () => {
    const store = posContext?.settings?.storeName || 'MUKI RAMEN';
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    let text = `*DAFTAR KEBUTUHAN BELANJA DAPUR*\n`;
    text += `🏬 Toko: ${store}\n`;
    text += `📅 Tanggal: ${dateStr}\n\n`;
    
    if (shoppingData?.supplierGrouping?.length > 0) {
      shoppingData.supplierGrouping.forEach((sup: any) => {
        text += `📦 *${sup.supplierName}*:\n`;
        sup.items.forEach((item: any) => {
          text += `• ${item.name}: ${item.suggestedBuy} ${item.unit} (Sisa: ${item.stock} ${item.unit})\n`;
        });
        text += `Subtotal: Rp ${sup.totalCost.toLocaleString('id-ID')}\n\n`;
      });
      text += `💰 *TOTAL ESTIMASI BELANJA:* Rp ${(shoppingData?.summary?.totalRestockCost || 0).toLocaleString('id-ID')}\n\n`;
    }
    text += `Mohon segera dicek dan diproses. Terima kasih! 🙏`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast('✓ Semua kebutuhan belanja disalin ke format WhatsApp!', 'success'))
        .catch(() => toast('Gagal menyalin format WA.', 'error'));
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast('✓ Semua kebutuhan belanja disalin ke format WhatsApp!', 'success');
    }
  };

  // Forms
  const [form, setForm] = useState({ 
    name: '', 
    category: 'FOOD', 
    unit: 'gram', 
    stock: '', 
    minStock: '', 
    buyPrice: '', 
    supplierId: '' 
  });
  const [adjustForm, setAdjustForm] = useState({ change: '', type: 'Restock', description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resIng, resSup] = await Promise.all([
        fetch(`${API}/ingredients`, { headers }),
        fetch(`${API}/suppliers`, { headers })
      ]);
      if (resIng.ok) {
        const data = await resIng.json();
        setIngredients(data);
        initOpnameItems(data);
      }
      if (resSup.ok) setSuppliers(await resSup.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLossAnalytics = async () => {
    setLossLoading(true);
    try {
      const res = await fetch(`${API}/ingredients/loss-analytics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLossData(data);
      }
    } catch (e) {
      console.error('Error loss analytics:', e);
    } finally {
      setLossLoading(false);
    }
  };

  const fetchShoppingAnalytics = async () => {
    setShoppingLoading(true);
    try {
      const res = await fetch(`${API}/ingredients/shopping-analytics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setShoppingData(data);
      }
    } catch (e) {
      console.error('Error shopping analytics:', e);
    } finally {
      setShoppingLoading(false);
    }
  };

  const fetchMovements = async () => {
    setMovementsLoading(true);
    try {
      const url = new URL(`${window.location.origin}${API}/ingredients/stock-movements`);
      if (movementTypeFilter !== 'ALL') url.searchParams.set('type', movementTypeFilter);
      if (movementIngredientFilter !== 'ALL') url.searchParams.set('ingredientId', movementIngredientFilter);
      
      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const data = await res.json();
        setMovements(data);
      }
    } catch (e) {
      console.error('Error fetching stock movements:', e);
    } finally {
      setMovementsLoading(false);
    }
  };

  const fetchForecast = async () => {
    setForecastLoading(true);
    try {
      const res = await fetch(`${API}/ingredients/production-forecast`, { headers });
      if (res.ok) {
        setForecastList(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setForecastLoading(false);
    }
  };

  const fetchOpnameHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/ingredients/stock-opname/history`, { headers });
      if (res.ok) setOpnameHistory(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'loss') fetchLossAnalytics();
    else if (activeTab === 'shopping') fetchShoppingAnalytics();
    else if (activeTab === 'movements') fetchMovements();
    else if (activeTab === 'forecast') fetchForecast();
    else if (activeTab === 'opname') fetchOpnameHistory();
  }, [activeTab, movementTypeFilter, movementIngredientFilter, token]);

  const initOpnameItems = (ings: Ingredient[]) => {
    setOpnameItems(
      ings.map(i => ({
        ingredientId: i.id,
        name: i.name,
        unit: i.unit,
        buyPrice: i.buyPrice,
        systemStock: i.stock,
        physicalStock: i.stock,
        reason: 'Normal',
        notes: ''
      }))
    );
  };

  const handleOpenAdd = () => {
    setEditData(null);
    setForm({ name: '', category: 'FOOD', unit: 'gram', stock: '', minStock: '', buyPrice: '', supplierId: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (ing: Ingredient) => {
    setEditData(ing);
    setForm({
      name: ing.name,
      category: ing.category || 'FOOD',
      unit: ing.unit,
      stock: ing.stock.toString(),
      minStock: ing.minStock.toString(),
      buyPrice: ing.buyPrice.toString(),
      supplierId: ing.supplierId ? ing.supplierId.toString() : ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Nama bahan baku wajib diisi', 'warning');

    const payload = {
      name: form.name.trim(),
      category: form.category || 'FOOD',
      unit: form.unit.trim() || 'gram',
      stock: parseFloat(form.stock) || 0,
      minStock: parseFloat(form.minStock) || 0,
      buyPrice: parseFloat(form.buyPrice) || 0,
      supplierId: form.supplierId ? parseInt(form.supplierId) : null
    };

    try {
      const url = editData ? `${API}/ingredients/${editData.id}` : `${API}/ingredients`;
      const method = editData ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        toast(`Bahan baku berhasil ${editData ? 'diperbarui' : 'ditambahkan'}!`, 'success');
        setShowModal(false);
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan data', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const res = await confirmAlert(
      'Hapus Bahan Baku?',
      `Apakah Anda yakin ingin menghapus "${name}"?`
    );
    if (!res.isConfirmed) return;

    try {
      const res = await fetch(`${API}/ingredients/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        toast('Bahan baku berhasil dihapus', 'success');
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menghapus bahan baku', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleOpenLossModal = (preselectedId?: number) => {
    setLossForm({
      ingredientId: preselectedId ? preselectedId.toString() : (ingredients[0]?.id.toString() || ''),
      qtyLoss: '',
      reason: 'Busuk / Kadaluarsa',
      notes: ''
    });
    setShowLossModal(true);
  };

  const handleSubmitLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(lossForm.qtyLoss);
    if (!lossForm.ingredientId || isNaN(qty) || qty <= 0) {
      return toast('Masukkan jumlah kerugian yang valid', 'warning');
    }

    setSubmittingLoss(true);
    try {
      const res = await fetch(`${API}/ingredients/loss`, {
        method: 'POST',
        headers,
        body: JSON.stringify(lossForm)
      });
      if (res.ok) {
        toast('Pencatatan stock loss berhasil disimpan!', 'success');
        setShowLossModal(false);
        fetchData();
        if (activeTab === 'loss') fetchLossAnalytics();
        if (activeTab === 'movements') fetchMovements();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mencatat loss', 'error');
      }
    } catch (e: any) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingLoss(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.ingredient) return;
    const change = parseFloat(adjustForm.change);
    if (isNaN(change) || change === 0) return toast('Jumlah perubahan tidak boleh 0', 'warning');

    try {
      const res = await fetch(`${API}/ingredients/${adjustModal.ingredient.id}/adjust`, {
        method: 'POST',
        headers,
        body: JSON.stringify(adjustForm)
      });
      if (res.ok) {
        toast('Stok berhasil disesuaikan!', 'success');
        setAdjustModal({ open: false, ingredient: null });
        setAdjustForm({ change: '', type: 'Restock', description: '' });
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyesuaikan stok', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleOpnameChange = (ingId: number, val: string) => {
    setOpnameItems(prev => prev.map(item => {
      if (item.ingredientId === ingId) {
        return { ...item, physicalStock: val };
      }
      return item;
    }));
  };

  const handleOpnameReasonChange = (ingId: number, reason: string) => {
    setOpnameItems(prev => prev.map(item => {
      if (item.ingredientId === ingId) {
        return { ...item, reason };
      }
      return item;
    }));
  };

  const handleOpnameNotesChange = (ingId: number, notes: string) => {
    setOpnameItems(prev => prev.map(item => {
      if (item.ingredientId === ingId) {
        return { ...item, notes };
      }
      return item;
    }));
  };

  const handleSubmitOpname = async () => {
    const invalid = opnameItems.some(i => i.physicalStock === '' || isNaN(Number(i.physicalStock)));
    if (invalid) {
      return toast('Harap isi semua jumlah stok fisik dengan angka valid', 'warning');
    }

    const res = await confirmAlert(
      'Konfirmasi Simpan Stock Opname?',
      'Stok sistem akan otomatis disinkronkan ke jumlah stok fisik riil, dan selisih kerugian akan dicatat.'
    );
    if (!res.isConfirmed) return;

    setSubmittingOpname(true);
    try {
      const res = await fetch(`${API}/ingredients/stock-opname`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          auditorName,
          notes: opnameNotes,
          items: opnameItems
        })
      });
      if (res.ok) {
        toast('Stock opname berhasil disimpan dan stok telah diperbarui!', 'success');
        fetchData();
        fetchOpnameHistory();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal memproses stock opname', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingOpname(false);
    }
  };

  // Filtered ingredients
  const filtered = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || 
      (i.supplier?.name || '').toLowerCase().includes(search.toLowerCase());
    
    let matchCat = true;
    if (categoryFilter !== 'ALL') {
      matchCat = (i.category || 'FOOD') === categoryFilter;
    }

    let matchStatus = true;
    if (statusFilter === 'out') matchStatus = i.stock === 0;
    else if (statusFilter === 'low') matchStatus = i.stock > 0 && i.stock <= i.minStock;
    else if (statusFilter === 'safe') matchStatus = i.stock > i.minStock;

    return matchSearch && matchCat && matchStatus;
  });

  const lowStockCount = ingredients.filter(i => i.stock > 0 && i.stock <= i.minStock).length;
  const outStockCount = ingredients.filter(i => i.stock === 0).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + (i.stock * i.buyPrice), 0);

  // Selected ingredient in loss modal calculation
  const selectedLossIngredient = ingredients.find(i => i.id === Number(lossForm.ingredientId));
  const estimatedLossAmount = (parseFloat(lossForm.qtyLoss) || 0) * (selectedLossIngredient?.buyPrice || 0);

  return (
    <div className="h-full flex-1 overflow-y-auto w-full bg-slate-50/50">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Package size={26} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Master Bahan Baku & Intelijen Stok
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                Klasifikasi stok, audit potensi stock loss, mutasi distribusi, dan analisis rekomendasi belanja.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              fetchData();
              if (activeTab === 'loss') fetchLossAnalytics();
              if (activeTab === 'shopping') fetchShoppingAnalytics();
              if (activeTab === 'movements') fetchMovements();
              if (activeTab === 'forecast') fetchForecast();
            }}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* EXPORT LAPORAN PDF DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)}
              disabled={generatingPdf}
              className="py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <FileText size={16} />
              <span>{generatingPdf ? 'Membuat PDF...' : 'Cetak Laporan PDF'}</span>
              <ChevronDown size={14} className={`transition-transform ${pdfDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {pdfDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setPdfDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-200/90 py-3 z-50 animate-fade-in space-y-1">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">PILIH LAPORAN AUDIT KEUANGAN</p>
                  </div>

                  <button
                    onClick={handleExportValuationPDF}
                    className="w-full px-4 py-2.5 hover:bg-amber-50/70 text-left flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 group-hover:text-amber-900">Laporan Valuasi Aset Persediaan</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Posisi modal uang mengendap di gudang & dapur</p>
                    </div>
                  </button>

                  <button
                    onClick={handleExportLossPDF}
                    className="w-full px-4 py-2.5 hover:bg-rose-50/70 text-left flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <TrendingDown size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 group-hover:text-rose-900">Laporan Audit Kerusakan (Stock Loss)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Evaluasi biaya waste, bahan busuk & yield chef</p>
                    </div>
                  </button>

                  <button
                    onClick={handleExportShoppingPDF}
                    className="w-full px-4 py-2.5 hover:bg-indigo-50/70 text-left flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <ShoppingCart size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 group-hover:text-indigo-900">Laporan Estimasi Belanja (Restock)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Proyeksi kebutuhan dana kas keluar supplier</p>
                    </div>
                  </button>

                  <button
                    onClick={handleExportOpnamePDF}
                    className="w-full px-4 py-2.5 hover:bg-sky-50/70 text-left flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <ClipboardCheck size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 group-hover:text-sky-900">Berita Acara Stock Opname Fisik</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Rekonsiliasi selisih fisik riil vs stok buku sistem</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => handleOpenLossModal()}
            className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm shadow-rose-500/10"
          >
            <TrendingDown size={16} />
            <span>Catat Stock Loss</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} />
            <span>Tambah Bahan Baku</span>
          </button>
        </div>
      </div>

      {/* 5 NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200">
        <button
          onClick={() => setActiveTab('master')}
          className={`px-4 py-3 font-black text-xs rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'master'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Package size={16} />
          <span>Master Bahan ({ingredients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('loss')}
          className={`px-4 py-3 font-black text-xs rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'loss'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <TrendingDown size={16} />
          <span>Stock Loss & Kerusakan</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-3 font-black text-xs rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'movements'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <History size={16} />
          <span>Kartu Stok & Alur Distribusi</span>
        </button>

        <button
          onClick={() => setActiveTab('shopping')}
          className={`px-4 py-3 font-black text-xs rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'shopping'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ShoppingCart size={16} />
          <span>Analisis Belanja & Stok Minim ({lowStockCount + outStockCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-3 font-black text-xs rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'forecast'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Utensils size={16} />
          <span>Kapasitas Menu (BOM)</span>
        </button>

        <button
          onClick={() => setActiveTab('opname')}
          className={`px-4 py-3 font-black text-xs rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'opname'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ClipboardCheck size={16} />
          <span>Audit Opname Fisik</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MASTER BAHAN & KLASIFIKASI
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'master' && (
        <div className="space-y-6">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bahan Baku</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{ingredients.length}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Semua jenis bahan aktif</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Package size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Stok Menipis</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{lowStockCount}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Mendekati batas minimum</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Stok Habis (Kritis)</p>
                <h3 className="text-2xl font-black text-rose-600 mt-1">{outStockCount}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Harus segera di-restock</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldAlert size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Valuasi Aset Stok</p>
                <h3 className="text-xl font-black text-emerald-700 mt-1">
                  Rp {totalValuation.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{ingredients.length} item tersimpan</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign size={22} />
              </div>
            </div>
          </div>

          {/* FILTER CONTROLS */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama bahan atau supplier..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* CATEGORY FILTER PILLS */}
            <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Kategori:</span>
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  categoryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setCategoryFilter('FOOD')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  categoryFilter === 'FOOD' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Utensils size={13} />
                <span>🍲 Dapur (Food)</span>
              </button>
              <button
                onClick={() => setCategoryFilter('DRINK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  categoryFilter === 'DRINK' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Coffee size={13} />
                <span>☕ Bar (Drink)</span>
              </button>
              <button
                onClick={() => setCategoryFilter('PACKAGING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  categoryFilter === 'PACKAGING' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShoppingBag size={13} />
                <span>📦 Kemasan</span>
              </button>
            </div>

            {/* STATUS FILTER PILLS */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('low')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'low' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Menipis
              </button>
              <button
                onClick={() => setStatusFilter('out')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'out' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Habis
              </button>
            </div>
          </div>

          {/* INGREDIENTS TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Nama Bahan & Kategori</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Stok Saat Ini</th>
                    <th className="py-4 px-4 text-right">Min. Stok</th>
                    <th className="py-4 px-4 text-right">Harga Beli / Unit</th>
                    <th className="py-4 px-4 text-right">Est. Total Nilai</th>
                    <th className="py-4 px-4">Supplier Langganan</th>
                    <th className="py-4 px-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="animate-spin inline-block mb-2 text-amber-500" size={24} />
                        <p>Memuat data bahan baku...</p>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Package className="inline-block mb-2 opacity-40 text-slate-400" size={32} />
                        <p>Tidak ada bahan baku yang cocok dengan filter pencarian.</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((ing) => {
                      const isOut = ing.stock === 0;
                      const isLow = ing.stock > 0 && ing.stock <= ing.minStock;
                      const cat = ing.category || 'FOOD';

                      return (
                        <tr key={ing.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">
                                {cat === 'FOOD' ? '🍲' : (cat === 'DRINK' ? '☕' : '📦')}
                              </span>
                              <div>
                                <div className="font-black text-slate-900">{ing.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {cat === 'FOOD' ? 'Dapur (Food)' : (cat === 'DRINK' ? 'Bar (Minuman)' : 'Kemasan / Display')}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                                Habis
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Aman
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right font-black text-slate-900">
                            {ing.stock.toLocaleString('id-ID')} <span className="text-[11px] font-bold text-slate-400">{ing.unit}</span>
                          </td>

                          <td className="py-4 px-4 text-right font-bold text-slate-500">
                            {ing.minStock.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{ing.unit}</span>
                          </td>

                          <td className="py-4 px-4 text-right font-bold text-slate-800">
                            Rp {ing.buyPrice.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">/{ing.unit}</span>
                          </td>

                          <td className="py-4 px-4 text-right font-black text-emerald-700">
                            Rp {(ing.stock * ing.buyPrice).toLocaleString('id-ID')}
                          </td>

                          <td className="py-4 px-4">
                            {ing.supplier ? (
                              <div className="font-bold text-slate-700">{ing.supplier.name}</div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Belum diatur</span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenLossModal(ing.id)}
                                title="Catat Kerusakan/Loss"
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                              >
                                <TrendingDown size={14} />
                              </button>

                              <button
                                onClick={() => {
                                  setAdjustModal({ open: true, ingredient: ing });
                                  setAdjustForm({ change: '', type: 'Restock', description: '' });
                                }}
                                title="Penyesuaian Cepat / Restock"
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors"
                              >
                                <RefreshCw size={14} />
                              </button>

                              <button
                                onClick={() => handleOpenEdit(ing)}
                                title="Edit Bahan"
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                onClick={() => handleDelete(ing.id, ing.name)}
                                title="Hapus Bahan"
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: STOCK LOSS & ANALISIS KERUSAKAN
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'loss' && (
        <div className="space-y-6 animate-fade-in">
          {/* LOSS SUMMARY METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-6 rounded-3xl text-white shadow-lg shadow-rose-500/20">
              <p className="text-xs font-bold text-rose-100 uppercase tracking-wider">Total Kerugian Stock Loss</p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                Rp {(lossData?.summary?.totalLossCost || 0).toLocaleString('id-ID')}
              </h3>
              <p className="text-xs text-rose-100/80 mt-1">
                {lossData?.summary?.totalLossCount || 0} insiden tercatat
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">% Tingkat Kerugian</p>
                <h3 className="text-2xl font-black text-rose-600 mt-1">
                  {lossData?.summary?.lossPercentage || 0}%
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Dari total bahan keluar</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">% Efisiensi Pemakaian</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">
                  {lossData?.summary?.efficiencyPercentage || 100}%
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Yield bahan sukses terjual</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Nilai Produksi Sukses</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Rp {(lossData?.summary?.totalProductionCost || 0).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Bahan keluar via POS</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Utensils size={22} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* TOP 5 LOSS ITEMS */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-600" />
                  Top 5 Bahan Paling Banyak Rugi
                </h3>
              </div>

              <div className="space-y-3">
                {lossData?.topLossItems?.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Belum ada data kerugian tercatat 🎉
                  </div>
                ) : (
                  lossData?.topLossItems?.map((item: any, idx: number) => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-black text-xs text-slate-800">{item.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Total Loss: {item.totalQty.toLocaleString('id-ID')} {item.unit}
                          </div>
                        </div>
                      </div>
                      <div className="font-black text-xs text-rose-600 text-right">
                        Rp {item.totalCost.toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIWAYAT LOG KERUGIAN */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <History size={18} className="text-indigo-600" />
                    Riwayat Pencatatan Kerusakan & Pembuangan (Loss Log)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Jejak audit insiden bahan busuk, kadaluarsa, atau rusak.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportLossPDF}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    title="Cetak Laporan Audit Kerusakan (PDF)"
                  >
                    <Printer size={14} />
                    <span>Cetak PDF</span>
                  </button>
                  <button
                    onClick={() => handleOpenLossModal()}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    + Catat Loss
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4">Waktu</th>
                      <th className="py-3 px-4">Bahan Baku</th>
                      <th className="py-3 px-3 text-right">Jumlah Rusak</th>
                      <th className="py-3 px-4 text-right">Kerugian (Rp)</th>
                      <th className="py-3 px-4">Alasan</th>
                      <th className="py-3 px-4">Dicatat Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {lossLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Memuat data riwayat loss...
                        </td>
                      </tr>
                    ) : lossData?.logs?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada log stock loss yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      lossData?.logs?.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 text-[11px] font-bold text-slate-500">
                            {new Date(l.createdAt).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            {l.ingredient?.name || 'Unknown'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-rose-600">
                            {Math.abs(l.change).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{l.ingredient?.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-rose-700">
                            Rp {(l.cost || (Math.abs(l.change) * (l.ingredient?.buyPrice || 0))).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {l.reason || 'Rusak'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-600">
                            {l.user?.name || 'Staff Dapur'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: KARTU STOK & ALUR DISTRIBUSI
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'movements' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <History size={20} className="text-indigo-600" />
                Kartu Stok Digital & Alur Mutasi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Jejak lengkap keluar/masuk stok: Restock PO, Produksi POS, Stock Loss, dan Opname.</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                className="form-control text-xs font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl"
                value={movementIngredientFilter}
                onChange={e => setMovementIngredientFilter(e.target.value)}
              >
                <option value="ALL">Semua Bahan Baku</option>
                {ingredients.map(i => (
                  <option key={i.id} value={i.id.toString()}>{i.name}</option>
                ))}
              </select>

              <select
                className="form-control text-xs font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl"
                value={movementTypeFilter}
                onChange={e => setMovementTypeFilter(e.target.value)}
              >
                <option value="ALL">Semua Jenis Mutasi</option>
                <option value="Produksi">🍳 Produksi (POS Sale)</option>
                <option value="Restock">📥 Restock / Pembelian</option>
                <option value="Rusak">🗑️ Stock Loss / Rusak</option>
                <option value="Stock Opname">⚖️ Stock Opname Audit</option>
                <option value="Penyesuaian">🔧 Penyesuaian Manual</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase">
                  <tr>
                    <th className="py-4 px-6">Waktu Mutasi</th>
                    <th className="py-4 px-4">Bahan Baku</th>
                    <th className="py-4 px-4">Tipe Alur</th>
                    <th className="py-4 px-4 text-right">Perubahan Qty</th>
                    <th className="py-4 px-4">Keterangan / Referensi</th>
                    <th className="py-4 px-6">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {movementsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="animate-spin inline-block mb-2 text-indigo-600" size={24} />
                        <p>Memuat kartu stok mutasi...</p>
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Belum ada riwayat mutasi yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m: any) => {
                      const isPositive = m.change > 0;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6 text-[11px] font-bold text-slate-500">
                            {new Date(m.createdAt).toLocaleString('id-ID')}
                          </td>

                          <td className="py-4 px-4 font-black text-slate-900">
                            {m.ingredient?.name}
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                              m.type === 'Produksi' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              (m.type === 'Restock' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              (m.type === 'Rusak' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'))
                            }`}>
                              {m.type === 'Produksi' && '🍳 Produksi POS'}
                              {m.type === 'Restock' && '📥 Restock Masuk'}
                              {m.type === 'Rusak' && '🗑️ Stock Loss'}
                              {m.type === 'Stock Opname' && '⚖️ Opname Fisik'}
                              {m.type === 'Penyesuaian' && '🔧 Penyesuaian'}
                              {!['Produksi', 'Restock', 'Rusak', 'Stock Opname', 'Penyesuaian'].includes(m.type) && m.type}
                            </span>
                          </td>

                          <td className={`py-4 px-4 text-right font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPositive ? `+${m.change.toLocaleString('id-ID')}` : m.change.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{m.ingredient?.unit}</span>
                          </td>

                          <td className="py-4 px-4 text-slate-600">
                            <div className="font-semibold text-xs text-slate-800">{m.description || '-'}</div>
                            {m.referenceId && (
                              <div className="text-[10px] font-mono text-slate-400">Ref: {m.referenceId}</div>
                            )}
                          </td>

                          <td className="py-4 px-6 text-slate-600 font-bold text-[11px]">
                            {m.user?.name || 'Sistem'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: ANALISIS BELANJA & STOK MINIM
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'shopping' && (
        <div className="space-y-6 animate-fade-in">
          {/* SHOPPING SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl text-white shadow-lg shadow-emerald-600/20">
              <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Estimasi Modal Belanja Restock</p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                Rp {(shoppingData?.summary?.totalRestockCost || 0).toLocaleString('id-ID')}
              </h3>
              <p className="text-xs text-emerald-100/80 mt-1">
                Untuk mengembalikan seluruh stok menipis ke batas aman optimal.
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Item Menipis / Kritis</p>
                <h3 className="text-3xl font-black text-amber-600 mt-1">
                  {shoppingData?.summary?.totalLowStockCount || 0}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {shoppingData?.summary?.totalCriticalCount || 0} di antaranya sudah Sold Out (0).
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={26} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Supplier Terkait</p>
                <h3 className="text-3xl font-black text-indigo-600 mt-1">
                  {shoppingData?.supplierGrouping?.length || 0}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Vendor siap dihubungi untuk PO</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Truck size={26} />
              </div>
            </div>
          </div>

          {/* REKOMENDASI BELANJA PER SUPPLIER */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-emerald-600" />
                Rekomendasi Pengadaan Cerdas per Supplier
              </h3>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  onClick={copyAllShoppingToWA}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title="Salin Semua Daftar Belanja ke Format WhatsApp"
                >
                  <MessageCircle size={14} />
                  <span>Salin Format WA</span>
                </button>
                <button
                  onClick={handleExportShoppingPDF}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title="Cetak Laporan Rencana Anggaran Belanja (PDF)"
                >
                  <Printer size={14} />
                  <span>Cetak PDF</span>
                </button>
              </div>
            </div>

            {shoppingLoading ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center text-slate-400">
                <RefreshCw className="animate-spin inline-block mb-2 text-emerald-600" size={24} />
                <p>Menganalisis kebutuhan belanja stok...</p>
              </div>
            ) : shoppingData?.supplierGrouping?.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center text-slate-500 font-bold">
                🎉 Luar biasa! Seluruh stok bahan baku berada pada tingkat yang aman. Tidak ada kebutuhan belanja darurat.
              </div>
            ) : (
              shoppingData?.supplierGrouping?.map((sup: any, idx: number) => (
                <div key={idx} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                        {sup.supplierName}
                      </h4>
                      {sup.phone && (
                        <p className="text-xs font-mono text-slate-400 mt-0.5">Kontak / WA: {sup.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-400 uppercase">Subtotal Belanja Supplier</div>
                        <div className="text-lg font-black text-emerald-700">
                          Rp {sup.totalCost.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copySupplierOrderToWA(sup)}
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                        title={`Salin Pesanan WA khusus ${sup.supplierName}`}
                      >
                        <MessageCircle size={15} />
                        <span className="hidden sm:inline">Order WA</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Bahan</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Stok Sekarang</th>
                          <th className="py-2.5 px-3 text-right">Min. Stok</th>
                          <th className="py-2.5 px-3 text-right">Burn Rate (Harian)</th>
                          <th className="py-2.5 px-3 text-right">Saran Beli</th>
                          <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                          <th className="py-2.5 px-3 text-right">Estimasi Biaya</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {sup.items.map((item: any) => (
                          <tr key={item.id}>
                            <td className="py-3 px-3 font-black text-slate-900">{item.name}</td>
                            <td className="py-3 px-3 text-center">
                              {item.stock === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
                                  Habis
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                  Menipis
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900">
                              {item.stock.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{item.unit}</span>
                            </td>
                            <td className="py-3 px-3 text-right text-slate-500">
                              {item.minStock.toLocaleString('id-ID')} {item.unit}
                            </td>
                            <td className="py-3 px-3 text-right text-indigo-600 font-bold">
                              ~{item.dailyBurnRate.toLocaleString('id-ID')} {item.unit}/hari
                            </td>
                            <td className="py-3 px-3 text-right font-black text-emerald-700">
                              +{item.suggestedQty.toLocaleString('id-ID')} {item.unit}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600">
                              Rp {item.buyPrice.toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900">
                              Rp {item.estimatedCost.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: KAPASITAS MENU (BOM)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'forecast' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Utensils size={20} className="text-amber-600" />
                Analisis Kapasitas Produksi Menu & Bottleneck (BOM)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Memprediksi berapa porsi menu ramen & minuman yang dapat disajikan dari stok bahan saat ini.</p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={forecastSearch}
                onChange={e => setForecastSearch(e.target.value)}
                placeholder="Cari nama menu..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {forecastLoading ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                <RefreshCw className="animate-spin inline-block mb-2 text-amber-500" size={24} />
                <p>Menganalisis kapasitas menu dari resep BOM...</p>
              </div>
            ) : forecastList.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                Belum ada data resep menu yang terkonfigurasi.
              </div>
            ) : (
              forecastList
                .filter(p => p.productName.toLowerCase().includes(forecastSearch.toLowerCase()))
                .map(prod => {
                  const isExpanded = expandedForecastId === prod.productId;
                  return (
                    <div key={prod.productId} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-black text-sm text-slate-900">{prod.productName}</h4>
                            <p className="text-[11px] text-slate-400 font-bold uppercase">{prod.categoryName}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            prod.maxPortions === 0 ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                            (prod.maxPortions <= 5 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                          }`}>
                            {prod.status}
                          </span>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Kapasitas Saji Tersedia</div>
                            <div className="text-2xl font-black text-slate-900 mt-0.5">
                              {prod.maxPortions.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-500">Porsi</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">HPP / Porsi</div>
                            <div className="text-xs font-black text-emerald-700 mt-0.5">
                              Rp {prod.buyPrice.toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>

                        {prod.bottleneck && (
                          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 space-y-1">
                            <div className="font-black flex items-center gap-1.5">
                              <AlertTriangle size={13} />
                              Bahan Pembatas (Bottleneck):
                            </div>
                            <p className="font-medium text-amber-900">
                              {prod.bottleneck.ingredientName} tersisa {prod.bottleneck.currentStock} {prod.bottleneck.unit} (hanya cukup {prod.bottleneck.maxPortions} porsi).
                            </p>
                          </div>
                        )}
                      </div>

                      {prod.recipeDetails.length > 0 && (
                        <div>
                          <button
                            onClick={() => setExpandedForecastId(isExpanded ? null : prod.productId)}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span>{isExpanded ? 'Sembunyikan Komposisi Bahan' : 'Lihat Komposisi Bahan Resep'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                              {prod.recipeDetails.map(r => (
                                <div key={r.ingredientId} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 rounded-lg">
                                  <span className="font-bold text-slate-800">{r.ingredientName}</span>
                                  <span className="text-slate-500">
                                    {r.qtyPerServing} {r.unit}/porsi (stok: {r.currentStock})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: AUDIT STOCK OPNAME FISIK
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'opname' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-blue-600" />
                  Formulir Audit Stock Opname Fisik
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Cocokkan stok fisik di gudang/chiller dengan stok sistem untuk auto-adjust selisih.</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleExportOpnamePDF}
                  className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  title="Cetak Berita Acara Stock Opname (PDF)"
                >
                  <Printer size={15} />
                  <span>Cetak Berita Acara (PDF)</span>
                </button>
                <input
                  type="text"
                  value={auditorName}
                  onChange={e => setAuditorName(e.target.value)}
                  placeholder="Nama Auditor"
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
                <button
                  onClick={handleSubmitOpname}
                  disabled={submittingOpname}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
                >
                  <CheckCircle2 size={16} />
                  <span>{submittingOpname ? 'Menyimpan...' : 'Simpan & Sinkronkan Opname'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Nama Bahan</th>
                    <th className="py-3 px-4 text-right">Stok Sistem</th>
                    <th className="py-3 px-4 text-center">Stok Fisik Riil</th>
                    <th className="py-3 px-4 text-right">Selisih (Variance)</th>
                    <th className="py-3 px-4">Alasan Selisih</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {opnameItems.map(item => {
                    const diff = Number(item.physicalStock) - item.systemStock;
                    const isMiss = Math.abs(diff) > 0.001;

                    return (
                      <tr key={item.ingredientId} className={isMiss ? 'bg-amber-50/40' : ''}>
                        <td className="py-3 px-4 font-black text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-600">
                          {item.systemStock.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            step="any"
                            value={item.physicalStock}
                            onChange={e => handleOpnameChange(item.ingredientId, e.target.value)}
                            className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-center text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </td>
                        <td className={`py-3 px-4 text-right font-black ${
                          diff < 0 ? 'text-rose-600' : (diff > 0 ? 'text-emerald-600' : 'text-slate-400')
                        }`}>
                          {diff !== 0 ? (diff > 0 ? `+${diff.toLocaleString('id-ID')}` : diff.toLocaleString('id-ID')) : '0'} {item.unit}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={item.reason}
                            onChange={e => handleOpnameReasonChange(item.ingredientId, e.target.value)}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                          >
                            <option value="Normal">Normal</option>
                            <option value="Susut/Trimming">Susut / Trimming</option>
                            <option value="Busuk/Rusak">Busuk / Rusak</option>
                            <option value="Selisih Timbang">Selisih Timbang</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={e => handleOpnameNotesChange(item.ingredientId, e.target.value)}
                            placeholder="Catatan..."
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: TAMBAH / EDIT BAHAN BAKU
      ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <h3 className="text-lg font-black text-slate-900">
              {editData ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Bahan Baku</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daging Chicken Chashu, Tomat Segar"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Klasifikasi / Kategori Bahan</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="FOOD">🍲 Bahan Dapur (Makanan & Sayuran)</option>
                  <option value="DRINK">☕ Bahan Bar (Minuman Racikan)</option>
                  <option value="PACKAGING">📦 Packaging & Showcase (Display)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Satuan (Unit)</label>
                  <input
                    type="text"
                    required
                    placeholder="gram, ml, buah, kg"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Harga Beli / Unit (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={form.buyPrice}
                    onChange={e => setForm({ ...form, buyPrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Batas Min. Stok (Alert)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={form.minStock}
                    onChange={e => setForm({ ...form, minStock: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Supplier Langganan</label>
                <select
                  value={form.supplierId}
                  onChange={e => setForm({ ...form, supplierId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id.toString()}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/20"
                >
                  Simpan Bahan Baku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: CATAT STOCK LOSS (WASTE & KERUSAKAN)
      ───────────────────────────────────────────────────────────── */}
      {showLossModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Catat Kerusakan / Stock Loss</h3>
                <p className="text-xs text-slate-500">Mencatat bahan busuk, rusak, expired, atau trimming.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitLoss} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Bahan Baku</label>
                <select
                  value={lossForm.ingredientId}
                  onChange={e => setLossForm({ ...lossForm, ingredientId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id.toString()}>
                      {i.name} (Stok: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Jumlah Rusak / Loss ({selectedLossIngredient?.unit || 'unit'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Contoh: 2.5"
                    value={lossForm.qtyLoss}
                    onChange={e => setLossForm({ ...lossForm, qtyLoss: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Loss</label>
                  <select
                    value={lossForm.reason}
                    onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="Busuk / Kadaluarsa">Busuk / Kadaluarsa</option>
                    <option value="Tumpah / Rusak">Tumpah / Rusak Fisik</option>
                    <option value="Sisa Trimming / Kupas">Sisa Trimming / Kupas</option>
                    <option value="Kesalahan Masak">Kesalahan Masak / Olah</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* ESTIMATED LOSS BADGE */}
              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase">Kalkulasi Kerugian (Rp)</div>
                  <div className="text-base font-black text-rose-700">
                    Rp {estimatedLossAmount.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="text-right text-[11px] text-rose-800 font-medium">
                  Harga Beli: Rp {selectedLossIngredient?.buyPrice.toLocaleString('id-ID') || 0}/{selectedLossIngredient?.unit}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Tomat layu di chiller bagian bawah"
                  value={lossForm.notes}
                  onChange={e => setLossForm({ ...lossForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLoss}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-500/20"
                >
                  {submittingLoss ? 'Menyimpan...' : 'Simpan Stock Loss'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ADJUST / RESTOCK CEPAT
      ───────────────────────────────────────────────────────────── */}
      {adjustModal.open && adjustModal.ingredient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <h3 className="text-base font-black text-slate-900">
              Penyesuaian Stok: {adjustModal.ingredient.name}
            </h3>
            <p className="text-xs text-slate-500">Stok saat ini: {adjustModal.ingredient.stock} {adjustModal.ingredient.unit}</p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Perubahan</label>
                <select
                  value={adjustForm.type}
                  onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="Restock">📥 Restock / Pembelian Tambahan (+)</option>
                  <option value="Penyesuaian">🔧 Koreksi / Penyesuaian (+/-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Jumlah Perubahan (+ untuk tambah, - untuk kurang)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Contoh: 1000 atau -200"
                  value={adjustForm.change}
                  onChange={e => setAdjustForm({ ...adjustForm, change: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Keterangan / Nomor Nota</label>
                <input
                  type="text"
                  placeholder="Contoh: Pembelian pasar dadakan"
                  value={adjustForm.description}
                  onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModal({ open: false, ingredient: null })}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default IngredientView;
