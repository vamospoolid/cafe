import React, { useState, useEffect, useContext } from 'react';
import { 
  Package, Plus, Edit2, Trash2, AlertTriangle, ChevronDown, ChevronUp, 
  RefreshCw, TrendingDown, TrendingUp, Search, History, Utensils, ClipboardCheck, 
  CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, DollarSign, ArrowRight, 
  ShieldAlert, FileText, Coffee, ShoppingBag, Truck, BarChart3, PieChart, 
  ArrowUpRight, ArrowDownRight, Layers, HelpCircle, Send, ShoppingCart,
  Download, Printer, MessageCircle, Copy, Boxes
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import { 
  exportIngredientValuationPDF, 
  exportStockLossAuditPDF, 
  exportProcurementForecastPDF, 
  exportStockOpnameVariancePDF,
  exportDailyMaterialConsumptionPDF,
  exportSimplePurchaseOrderPDF
} from '../utils/pdfGenerator';

const INGREDIENT_SUB_CATEGORIES: Record<string, string[]> = {
  FOOD: [
    'Daging & Seafood',
    'Sayuran Segar',
    'Bumbu & Saus',
    'Tepung & Mie',
    'Dairy & Telur',
    'Bahan Kering & Rempah'
  ],
  DRINK: [
    'Biji Kopi (Beans)',
    'Sirup & Puree',
    'Susu & Dairy',
    'Teh & Powder',
    'Topping Minuman'
  ],
  PACKAGING: [
    'Cup & Tutup',
    'Paper Box & Kantong',
    'Plastik & Seal',
    'Sedotan & Sendok'
  ]
};

interface Ingredient {
  id: number;
  name: string;
  category?: 'FOOD' | 'DRINK' | 'PACKAGING' | string;
  subCategory?: string | null;
  unit: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  supplierId: number | null;
  supplier?: { id: number; name: string; phone?: string } | null;
  purchaseUnit?: string | null;
  conversionRatio?: number;
  warehouseStock?: number;
  warehouseMinStock?: number;
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

  // Tab State: 'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname' | 'daily_usage'
  const [activeTab, setActiveTab] = useState<'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname' | 'daily_usage'>('master');

  // Master Ingredients Data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'safe'>('all');

  // Daily Usage & COGS Analytics State
  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usagePreset, setUsagePreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('today');
  const [usageStartDate, setUsageStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [usageEndDate, setUsageEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [usageCategoryFilter, setUsageCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [usageTypeFilter, setUsageTypeFilter] = useState<string>('ALL');

  // Stock Loss Data & Analytics
  const [lossData, setLossData] = useState<any>(null);
  const [lossLoading, setLossLoading] = useState(false);
  const [lossPreset, setLossPreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('this_month');
  const [lossStartDate, setLossStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [lossEndDate, setLossEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
  const [shoppingHorizonDays, setShoppingHorizonDays] = useState<number>(14);

  // Stock Movements Ledger
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementPreset, setMovementPreset] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('all');
  const [movementStartDate, setMovementStartDate] = useState<string>('');
  const [movementEndDate, setMovementEndDate] = useState<string>('');
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
      let raw = lossData;
      if (!raw) {
        const url = new URL(`${window.location.origin}${API}/ingredients/loss-analytics`);
        if (lossStartDate) url.searchParams.set('startDate', `${lossStartDate}T00:00:00.000Z`);
        if (lossEndDate) url.searchParams.set('endDate', `${lossEndDate}T23:59:59.999Z`);
        const res = await fetch(url.toString(), { headers });
        if (res.ok) raw = await res.json();
      }
      // Mapping field API -> format yang diexpect exportStockLossAuditPDF
      const mappedData = raw ? {
        totalLossRupiah: raw.summary?.totalLossCost || 0,
        totalLossIncidents: raw.summary?.totalLossCount || 0,
        lossRatePercentage: raw.summary?.lossPercentage || 0,
        efficiencyRate: raw.summary?.efficiencyPercentage || 100,
        totalProductionValue: raw.summary?.totalProductionCost || 0,
        topLossItems: (raw.topLossItems || []).map((t: any) => ({
          name: t.name,
          unit: t.unit,
          totalQty: t.totalQty,
          totalRupiah: t.totalCost
        })),
        lossLogs: (raw.logs || []).map((l: any) => ({
          date: l.createdAt,
          ingredient: l.ingredient,
          qtyLoss: Math.abs(l.change),
          costLoss: l.cost || (Math.abs(l.change) * (l.ingredient?.buyPrice || 0)),
          reason: l.reason || 'Lainnya',
          recordedBy: l.user?.name || 'Staf Dapur'
        }))
      } : null;
      await exportStockLossAuditPDF(posContext?.settings || {}, mappedData, posContext?.user?.username || 'Auditor Dapur');
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
      let raw = shoppingData;
      if (!raw) {
        const url = new URL(`${window.location.origin}${API}/ingredients/shopping-analytics`);
        if (shoppingHorizonDays) url.searchParams.set('days', shoppingHorizonDays.toString());
        const res = await fetch(url.toString(), { headers });
        if (res.ok) raw = await res.json();
      }
      // Mapping field API -> format yang diexpect exportProcurementForecastPDF
      const mappedData = raw ? {
        totalEstimatedCost: raw.summary?.totalRestockCost || 0,
        criticalItems: (raw.lowStockItems || []).map((item: any) => ({
          name: item.name,
          unit: item.unit,
          currentStock: item.stock,        // API: stock  -> PDF: currentStock
          minStock: item.minStock,
          recommendedBuyQty: item.suggestedQty,  // API: suggestedQty -> PDF: recommendedBuyQty
          buyPrice: item.buyPrice,
          estimatedCost: item.estimatedCost,
          supplierName: item.supplier?.name || 'Umum / Pasar'  // API: supplier.name -> PDF: supplierName
        }))
      } : null;
      await exportProcurementForecastPDF(posContext?.settings || {}, mappedData, posContext?.user?.username || 'Purchasing');
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
      let itemsToExport = opnameItems;
      if (itemsToExport.length === 0) {
        let currentIngredients = ingredients;
        if (currentIngredients.length === 0) {
          const res = await fetch(`${API}/ingredients`, { headers });
          if (res.ok) currentIngredients = await res.json();
        }
        itemsToExport = currentIngredients.map(i => ({
          ingredientId: i.id,
          name: i.name,
          unit: i.unit,
          buyPrice: i.buyPrice,
          systemStock: i.stock,
          physicalStock: i.stock,
          reason: 'Normal',
          notes: 'Audit Rutin Persediaan'
        }));
      }
      await exportStockOpnameVariancePDF(posContext?.settings || {}, itemsToExport, auditorName, opnameNotes);
      toast('Berita Acara Stock Opname berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh laporan PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportDailyUsagePDF = async () => {
    try {
      setGeneratingPdf(true);
      let data = usageData;
      if (!data) {
        const s = usageStartDate;
        const e = usageEndDate;
        const c = usageCategoryFilter;
        const t = usageTypeFilter;
        const url = `${API}/ingredients/analytics/daily-usage?startDate=${s}T00:00:00.000Z&endDate=${e}T23:59:59.999Z&category=${c}&type=${t}`;
        const res = await fetch(url, { headers });
        if (res.ok) data = await res.json();
      }
      await exportDailyMaterialConsumptionPDF(
        posContext?.settings || {},
        data,
        posContext?.user?.username || 'Head Chef / Finance',
        usageStartDate,
        usageEndDate
      );
      toast('Laporan Konsumsi Bahan Baku Harian berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh Laporan Konsumsi Harian', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleGenerateSupplierPO = async (sup: any) => {
    try {
      setGeneratingPdf(true);
      await exportSimplePurchaseOrderPDF(
        posContext?.settings || {},
        {
          supplierName: sup.supplierName,
          supplierPhone: sup.phone,
          items: sup.items.map((i: any) => ({
            name: i.name,
            qty: i.suggestedQty,
            unit: i.unit,
            estimatedPrice: i.buyPrice
          })),
          notes: 'Mohon barang dikirim dalam kondisi segar & segel utuh. Sertakan surat jalan resmi.'
        },
        posContext?.user?.username || 'Bagian Purchasing'
      );
      toast(`Surat PO untuk ${sup.supplierName} berhasil diunduh!`, 'success');
    } catch (e) {
      console.error(e);
      toast('Gagal membuat Surat PO', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const fetchDailyUsage = async (start?: string, end?: string, cat?: string, type?: string) => {
    setUsageLoading(true);
    try {
      const s = start || usageStartDate;
      const e = end || usageEndDate;
      const c = cat || usageCategoryFilter;
      const t = type || usageTypeFilter;
      const url = `${API}/ingredients/analytics/daily-usage?startDate=${s}T00:00:00.000Z&endDate=${e}T23:59:59.999Z&category=${c}&type=${t}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (err) {
      console.error('Error daily usage:', err);
      toast('Gagal memuat data konsumsi harian', 'error');
    } finally {
      setUsageLoading(false);
    }
  };

  const setPresetDate = (preset: 'today' | 'yesterday' | 'last7' | 'this_month') => {
    setUsagePreset(preset);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === 'today') {
      // today
    } else if (preset === 'yesterday') {
      s.setDate(now.getDate() - 1);
      e.setDate(now.getDate() - 1);
    } else if (preset === 'last7') {
      s.setDate(now.getDate() - 6);
    } else if (preset === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startStr = s.toISOString().split('T')[0];
    const endStr = e.toISOString().split('T')[0];
    setUsageStartDate(startStr);
    setUsageEndDate(endStr);
    fetchDailyUsage(startStr, endStr, usageCategoryFilter, usageTypeFilter);
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
    subCategory: '',
    unit: 'gram', 
    stock: '', 
    minStock: '', 
    buyPrice: '', 
    supplierId: '',
    purchaseUnit: '',
    conversionRatio: '1',
    warehouseMinStock: '0'
  });
  const [adjustForm, setAdjustForm] = useState<{ change: string; type: string; description: string; newBuyPrice?: string }>({ change: '', type: 'Restock', description: '', newBuyPrice: '' });

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

  const fetchLossAnalytics = async (start?: string, end?: string) => {
    setLossLoading(true);
    try {
      const s = start !== undefined ? start : lossStartDate;
      const e = end !== undefined ? end : lossEndDate;
      const url = new URL(`${window.location.origin}${API}/ingredients/loss-analytics`);
      if (s) url.searchParams.set('startDate', `${s}T00:00:00.000Z`);
      if (e) url.searchParams.set('endDate', `${e}T23:59:59.999Z`);

      const res = await fetch(url.toString(), { headers });
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

  const setLossPresetDate = (preset: 'today' | 'yesterday' | 'last7' | 'this_month') => {
    setLossPreset(preset);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === 'today') {
      // today
    } else if (preset === 'yesterday') {
      s.setDate(now.getDate() - 1);
      e.setDate(now.getDate() - 1);
    } else if (preset === 'last7') {
      s.setDate(now.getDate() - 6);
    } else if (preset === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startStr = s.toISOString().split('T')[0];
    const endStr = e.toISOString().split('T')[0];
    setLossStartDate(startStr);
    setLossEndDate(endStr);
    fetchLossAnalytics(startStr, endStr);
  };

  const fetchShoppingAnalytics = async (days?: number) => {
    setShoppingLoading(true);
    try {
      const d = days !== undefined ? days : shoppingHorizonDays;
      const url = new URL(`${window.location.origin}${API}/ingredients/shopping-analytics`);
      if (d) url.searchParams.set('days', d.toString());

      const res = await fetch(url.toString(), { headers });
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

  const fetchMovements = async (start?: string, end?: string, type?: string, ingredientId?: string) => {
    setMovementsLoading(true);
    try {
      const s = start !== undefined ? start : movementStartDate;
      const e = end !== undefined ? end : movementEndDate;
      const t = type !== undefined ? type : movementTypeFilter;
      const ingId = ingredientId !== undefined ? ingredientId : movementIngredientFilter;

      const url = new URL(`${window.location.origin}${API}/ingredients/stock-movements`);
      if (s) url.searchParams.set('startDate', `${s}T00:00:00.000Z`);
      if (e) url.searchParams.set('endDate', `${e}T23:59:59.999Z`);
      if (t !== 'ALL') url.searchParams.set('type', t);
      if (ingId !== 'ALL') url.searchParams.set('ingredientId', ingId);
      
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

  const setMovementPresetDate = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'this_month') => {
    setMovementPreset(preset);
    if (preset === 'all') {
      setMovementStartDate('');
      setMovementEndDate('');
      fetchMovements('', '', movementTypeFilter, movementIngredientFilter);
      return;
    }
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === 'today') {
      // today
    } else if (preset === 'yesterday') {
      s.setDate(now.getDate() - 1);
      e.setDate(now.getDate() - 1);
    } else if (preset === 'last7') {
      s.setDate(now.getDate() - 6);
    } else if (preset === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startStr = s.toISOString().split('T')[0];
    const endStr = e.toISOString().split('T')[0];
    setMovementStartDate(startStr);
    setMovementEndDate(endStr);
    fetchMovements(startStr, endStr, movementTypeFilter, movementIngredientFilter);
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
    else if (activeTab === 'daily_usage') fetchDailyUsage();
  }, [activeTab, movementTypeFilter, movementIngredientFilter, usageCategoryFilter, usageTypeFilter, token]);

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
    setForm({ name: '', category: 'FOOD', subCategory: '', unit: 'gram', stock: '', minStock: '', buyPrice: '', supplierId: '', purchaseUnit: 'Karton', conversionRatio: '1', warehouseMinStock: '0' });
    setShowModal(true);
  };

  const handleOpenEdit = (ing: Ingredient) => {
    setEditData(ing);
    setForm({
      name: ing.name,
      category: ing.category || 'FOOD',
      subCategory: ing.subCategory || '',
      unit: ing.unit,
      stock: ing.stock.toString(),
      minStock: ing.minStock.toString(),
      buyPrice: ing.buyPrice.toString(),
      supplierId: ing.supplierId ? ing.supplierId.toString() : '',
      purchaseUnit: ing.purchaseUnit || '',
      conversionRatio: (ing.conversionRatio || 1).toString(),
      warehouseMinStock: (ing.warehouseMinStock || 0).toString()
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Nama bahan baku wajib diisi', 'warning');

    const payload = {
      name: form.name.trim(),
      category: form.category || 'FOOD',
      subCategory: form.subCategory ? form.subCategory.trim() : null,
      unit: form.unit.trim() || 'gram',
      stock: parseFloat(form.stock) || 0,
      minStock: parseFloat(form.minStock) || 0,
      buyPrice: parseFloat(form.buyPrice) || 0,
      supplierId: form.supplierId ? parseInt(form.supplierId) : null,
      purchaseUnit: form.purchaseUnit ? form.purchaseUnit.trim() : null,
      conversionRatio: parseFloat(form.conversionRatio) > 0 ? parseFloat(form.conversionRatio) : 1,
      warehouseMinStock: parseFloat(form.warehouseMinStock) || 0
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

    let matchSubCat = true;
    if (subCategoryFilter !== 'ALL') {
      matchSubCat = (i.subCategory || 'Lainnya') === subCategoryFilter;
    }

    let matchStatus = true;
    if (statusFilter === 'out') matchStatus = i.stock === 0;
    else if (statusFilter === 'low') matchStatus = i.stock > 0 && i.stock <= i.minStock;
    else if (statusFilter === 'safe') matchStatus = i.stock > i.minStock;

    return matchSearch && matchCat && matchSubCat && matchStatus;
  });

  const lowStockCount = ingredients.filter(i => i.stock > 0 && i.stock <= i.minStock).length;
  const outStockCount = ingredients.filter(i => i.stock === 0).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + (i.stock * i.buyPrice), 0);

  // Selected ingredient in loss modal calculation
  const selectedLossIngredient = ingredients.find(i => i.id === Number(lossForm.ingredientId));
  const estimatedLossAmount = (parseFloat(lossForm.qtyLoss) || 0) * (selectedLossIngredient?.buyPrice || 0);

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP ACTION BAR
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-5 flex flex-col gap-3.5 shadow-sm shrink-0">
        <div className="flex justify-between items-center flex-wrap gap-2.5 sm:gap-4">
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-purple-50 text-indigo-700 rounded-lg text-xs font-extrabold">
                {posContext?.settings?.storeName || 'SOL CAFE & EATERY'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                Master Bahan Baku & Intelijen Stok
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Klasifikasi stok, audit potensi stock loss, mutasi distribusi, dan analisis rekomendasi belanja
            </p>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-purple-200 active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} /> <span>Tambah Bahan</span>
            </button>

            <button
              onClick={() => handleOpenLossModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all shrink-0"
            >
              <TrendingDown size={15} /> <span>Catat Stock Loss</span>
            </button>

            {/* EXPORT LAPORAN PDF DROPDOWN */}
            <div className="relative flex-1 sm:flex-none">
              <button
                onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)}
                disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all shrink-0"
              >
                <FileText size={15} />
                <span>{generatingPdf ? 'Membuat PDF...' : 'Cetak PDF'}</span>
                <ChevronDown size={14} className={`transition-transform ${pdfDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {pdfDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setPdfDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fade-in space-y-1">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">PILIH LAPORAN AUDIT STOK & KEUANGAN</p>
                    </div>

                    <button
                      onClick={handleExportValuationPDF}
                      className="w-full px-4 py-2.5 hover:bg-purple-50 text-left flex items-start gap-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <DollarSign size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 group-hover:text-purple-900">Laporan Valuasi Aset Persediaan</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Posisi modal uang mengendap di gudang & dapur</p>
                      </div>
                    </button>

                    <button
                      onClick={handleExportLossPDF}
                      className="w-full px-4 py-2.5 hover:bg-rose-50 text-left flex items-start gap-3 transition-colors group"
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
                      className="w-full px-4 py-2.5 hover:bg-indigo-50 text-left flex items-start gap-3 transition-colors group"
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
                      onClick={handleExportDailyUsagePDF}
                      className="w-full px-4 py-2.5 hover:bg-emerald-50 text-left flex items-start gap-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <BarChart3 size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 group-hover:text-emerald-900">Laporan Konsumsi Harian (Daily COGS)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Rekapitulasi HPP bahan keluar & rasio food cost</p>
                      </div>
                    </button>

                    <button
                      onClick={handleExportOpnamePDF}
                      className="w-full px-4 py-2.5 hover:bg-sky-50 text-left flex items-start gap-3 transition-colors group"
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
              onClick={() => {
                fetchData();
                if (activeTab === 'loss') fetchLossAnalytics();
                if (activeTab === 'shopping') fetchShoppingAnalytics();
                if (activeTab === 'movements') fetchMovements();
                if (activeTab === 'forecast') fetchForecast();
                if (activeTab === 'opname') fetchOpnameHistory();
                if (activeTab === 'daily_usage') fetchDailyUsage();
              }}
              title="Perbarui Data"
              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-sm active:scale-95 transition-all shrink-0"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGASI 7 TAB UTAMA BAHAN BAKU (RESPONSIVE)
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-1.5 sm:p-2 border border-slate-200 shadow-sm flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1.5 sm:gap-2 shrink-0">
        {[
          { 
            id: 'master', 
            title: 'Master Bahan', 
            subtitle: 'Katalog & Stok Fisik', 
            icon: Package,
            badge: ingredients.length > 0 ? `${ingredients.length} Bahan` : null
          },
          { 
            id: 'daily_usage', 
            title: 'Konsumsi Harian', 
            subtitle: 'Daily Usage & COGS', 
            icon: BarChart3,
            badge: (usageData?.items?.length || 0) > 0 ? `${usageData?.items?.length} Dipakai` : null
          },
          { 
            id: 'loss', 
            title: 'Stock Loss & Kerusakan', 
            subtitle: 'Audit Waste & Kerugian', 
            icon: TrendingDown, 
            badge: (lossData?.summary?.totalLossCount || 0) > 0 ? `${lossData?.summary?.totalLossCount} Insiden` : null
          },
          { 
            id: 'movements', 
            title: 'Kartu Stok & Alur', 
            subtitle: 'Mutasi & Log Distribusi', 
            icon: History,
            badge: movements.length > 0 ? `${movements.length} Log` : null
          },
          { 
            id: 'shopping', 
            title: 'Analisis Belanja', 
            subtitle: 'Stok Minim & Forecast', 
            icon: ShoppingCart,
            badge: (lowStockCount + outStockCount) > 0 ? `${lowStockCount + outStockCount} Kritis` : null
          },
          { 
            id: 'forecast', 
            title: 'Kapasitas Menu (BOM)', 
            subtitle: 'Resep & Yield Menu', 
            icon: Utensils,
            badge: forecastList.length > 0 ? `${forecastList.length} Menu` : null
          },
          { 
            id: 'opname', 
            title: 'Audit Opname Fisik', 
            subtitle: 'Rekonsiliasi Stok Riil', 
            icon: ClipboardCheck,
            badge: opnameHistory.length > 0 ? `${opnameHistory.length} Audit` : null
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.75rem',
                padding: '.75rem 1rem',
                background: isSelected 
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)' 
                  : '#f8fafc',
                color: isSelected ? '#ffffff' : '#334155',
                border: isSelected ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                borderRadius: '.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                boxShadow: isSelected ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none',
                minWidth: '150px',
                flexShrink: 0
              }}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '.65rem',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#ede9fe',
                  color: isSelected ? '#ffffff' : '#7c3aed',
                  flexShrink: 0
                }}
              >
                <Icon size={18} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.25rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '.85rem', color: isSelected ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.title}
                  </span>
                  {tab.badge && (
                    <span 
                      style={{ 
                        fontSize: '.62rem', 
                        padding: '.12rem .4rem', 
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#ede9fe', 
                        color: isSelected ? '#ffffff' : '#7c3aed', 
                        borderRadius: '9999px', 
                        fontWeight: 800,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '.72rem', color: isSelected ? 'rgba(255,255,255,0.8)' : '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tab.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MASTER BAHAN & KLASIFIKASI
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'master' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* STATS OVERVIEW CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Bahan Baku</p>
                <h3 style={{ margin: '.35rem 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>{ingredients.length}</h3>
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: '#64748b', fontWeight: 500 }}>Semua jenis bahan aktif</p>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '.85rem', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={22} />
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '.75rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stok Menipis</p>
                <h3 style={{ margin: '.35rem 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>{lowStockCount}</h3>
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: '#64748b', fontWeight: 500 }}>Mendekati batas minimum</p>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '.85rem', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '.75rem', fontWeight: 800, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stok Habis (Kritis)</p>
                <h3 style={{ margin: '.35rem 0 0', fontSize: '1.6rem', fontWeight: 900, color: '#e11d48' }}>{outStockCount}</h3>
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: '#64748b', fontWeight: 500 }}>Harus segera di-restock</p>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '.85rem', background: '#ffe4e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={22} />
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '.75rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valuasi Aset Stok</p>
                <h3 style={{ margin: '.35rem 0 0', fontSize: '1.45rem', fontWeight: 900, color: '#059669' }}>
                  Rp {totalValuation.toLocaleString('id-ID')}
                </h3>
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: '#64748b', fontWeight: 500 }}>{ingredients.length} item tersimpan</p>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '.85rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
            </div>
          </div>

          {/* FILTER CONTROLS */}
          <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama bahan atau supplier..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {/* CATEGORY FILTER PILLS */}
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Kategori:</span>
                <button
                  onClick={() => {
                    setCategoryFilter('ALL');
                    setSubCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    categoryFilter === 'ALL' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('FOOD');
                    setSubCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    categoryFilter === 'FOOD' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Utensils size={13} />
                  <span>🍲 Dapur (Food)</span>
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('DRINK');
                    setSubCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    categoryFilter === 'DRINK' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Coffee size={13} />
                  <span>☕ Bar (Drink)</span>
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('PACKAGING');
                    setSubCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    categoryFilter === 'PACKAGING' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ShoppingBag size={13} />
                  <span>📦 Kemasan</span>
                </button>

                {/* DYNAMIC SUBCATEGORY SELECTOR IN FILTER */}
                {categoryFilter !== 'ALL' && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 animate-fade-in">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sub:</span>
                    <select
                      value={subCategoryFilter}
                      onChange={e => setSubCategoryFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="ALL">Semua Sub-Kategori</option>
                      {(INGREDIENT_SUB_CATEGORIES[categoryFilter] || []).map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                      {Array.from(new Set(ingredients.filter(i => (i.category || 'FOOD') === categoryFilter && i.subCategory && !(INGREDIENT_SUB_CATEGORIES[categoryFilter] || []).includes(i.subCategory)).map(i => i.subCategory as string))).map(customSc => (
                        <option key={customSc} value={customSc}>{customSc}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* STATUS FILTER PILLS */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setStatusFilter('low')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'low' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Menipis
                </button>
                <button
                  onClick={() => setStatusFilter('out')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'out' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Habis
                </button>
              </div>
            </div>
          </div>

          {/* INGREDIENTS TABLE */}
          <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
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
                        <RefreshCw className="animate-spin inline-block mb-2 text-purple-600" size={24} />
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
                        <tr key={ing.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">
                                {cat === 'FOOD' ? '🍲' : (cat === 'DRINK' ? '☕' : '📦')}
                              </span>
                              <div>
                                <div className="font-black text-slate-900">{ing.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">
                                    {cat === 'FOOD' ? 'Dapur' : (cat === 'DRINK' ? 'Bar' : 'Kemasan')}
                                  </span>
                                  {ing.subCategory && (
                                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                                      &gt; {ing.subCategory}
                                    </span>
                                  )}
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
                                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition-colors"
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
          TAB: KONSUMSI BAHAN BAKU HARIAN & COGS ANALYTICS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'daily_usage' && (
        <div className="space-y-6 animate-fade-in">
          {/* FILTER & CONTROL TOOLBAR */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 size={20} className="text-indigo-600" />
                  Analisis Konsumsi Bahan Baku & Beban Pokok Penjualan (HPP)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pantau total pemakaian bahan riil harian dari pesanan POS, evaluasi biaya HPP, dan rasio food cost.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
                <button
                  onClick={handleExportDailyUsagePDF}
                  disabled={generatingPdf}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95"
                  title="Cetak Laporan PDF Konsumsi Bahan Baku & COGS"
                >
                  <Printer size={15} />
                  <span>{generatingPdf ? 'Membuat PDF...' : 'Cetak Laporan PDF'}</span>
                </button>

                <button
                  onClick={() => fetchDailyUsage()}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                  title="Perbarui Data"
                >
                  <RefreshCw size={15} className={usageLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* PRESETS & FILTERS ROW */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {/* Quick Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Periode:</span>
                {[
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'yesterday', label: 'Kemarin' },
                  { id: 'last7', label: '7 Hari Terakhir' },
                  { id: 'this_month', label: 'Bulan Ini' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPresetDate(p.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      usagePreset === p.id
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs & Category Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400">Dari:</span>
                  <input
                    type="date"
                    value={usageStartDate}
                    onChange={e => {
                      setUsagePreset('custom' as any);
                      setUsageStartDate(e.target.value);
                      fetchDailyUsage(e.target.value, usageEndDate, usageCategoryFilter, usageTypeFilter);
                    }}
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-800"
                  />
                  <span className="text-[10px] font-bold text-slate-400 ml-1">s/d:</span>
                  <input
                    type="date"
                    value={usageEndDate}
                    onChange={e => {
                      setUsagePreset('custom' as any);
                      setUsageEndDate(e.target.value);
                      fetchDailyUsage(usageStartDate, e.target.value, usageCategoryFilter, usageTypeFilter);
                    }}
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-800"
                  />
                </div>

                <select
                  value={usageCategoryFilter}
                  onChange={e => {
                    setUsageCategoryFilter(e.target.value as any);
                    fetchDailyUsage(usageStartDate, usageEndDate, e.target.value, usageTypeFilter);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="FOOD">🍲 Dapur (Food)</option>
                  <option value="DRINK">☕ Bar (Drink)</option>
                  <option value="PACKAGING">📦 Kemasan (Packaging)</option>
                </select>

                <select
                  value={usageTypeFilter}
                  onChange={e => {
                    setUsageTypeFilter(e.target.value);
                    fetchDailyUsage(usageStartDate, usageEndDate, usageCategoryFilter, e.target.value);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">Semua Pengurangan</option>
                  <option value="Produksi">🍳 Produksi POS Saja</option>
                  <option value="Rusak">🗑️ Waste / Kerusakan Saja</option>
                </select>
              </div>
            </div>
          </div>

          {/* KPI METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl text-white shadow-lg shadow-indigo-600/20">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Total Estimasi HPP Terpakai</p>
                <span className="px-2 py-0.5 bg-white/20 text-white rounded-md text-[10px] font-black">
                  COGS
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                Rp {(usageData?.summary?.totalCostUsage || 0).toLocaleString('id-ID')}
              </h3>
              <p className="text-xs text-indigo-100/90 mt-1 flex items-center gap-1.5">
                <span>Rasio Food Cost:</span>
                <span className="font-black px-1.5 py-0.2 bg-white text-indigo-900 rounded-md text-[11px]">
                  {usageData?.summary?.foodCostRatio || 0}%
                </span>
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Omzet Penjualan POS</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                  Rp {(usageData?.summary?.totalRevenue || 0).toLocaleString('id-ID')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Penjualan lunas periode ini</p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Biaya Kerugian (Loss/Waste)</p>
                <h3 className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                  Rp {(usageData?.summary?.totalLossCost || 0).toLocaleString('id-ID')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Bahan basi / tumpah / rusak</p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <TrendingDown size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bahan Aktif Terpakai</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                  {usageData?.summary?.totalActiveIngredientsUsed || 0}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Macam bahan baku yang keluar</p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Package size={24} />
              </div>
            </div>
          </div>

          {/* BREAKDOWN PER STASIUN (FOOD vs DRINK vs PACKAGING) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-amber-700 uppercase">🍲 Biaya Dapur (Food)</div>
                <div className="text-lg font-black text-amber-900 mt-0.5">
                  Rp {(usageData?.summary?.foodCost || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <span className="text-2xl">🍜</span>
            </div>

            <div className="p-4 bg-sky-50/60 border border-sky-200/70 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-sky-700 uppercase">☕ Biaya Bar (Drink)</div>
                <div className="text-lg font-black text-sky-900 mt-0.5">
                  Rp {(usageData?.summary?.drinkCost || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <span className="text-2xl">🥤</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-600 uppercase">📦 Biaya Kemasan (Packaging)</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  Rp {(usageData?.summary?.packagingCost || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <span className="text-2xl">🛍️</span>
            </div>
          </div>

          {/* TABEL RINCIAN KONSUMSI BAHAN BAKU */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600" />
                  Rincian Pemakaian Riil per-Item Bahan Baku
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total kuantitas gram/ml/pcs bahan yang terpakai beserta nilai rupiah HPP-nya.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                Total {usageData?.items?.length || 0} Bahan Terkonsumsi
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase">
                  <tr>
                    <th className="py-3.5 px-4">Nama Bahan Baku</th>
                    <th className="py-3.5 px-3">Kategori</th>
                    <th className="py-3.5 px-4 text-right">Total Pakai</th>
                    <th className="py-3.5 px-3 text-right">Produksi POS</th>
                    <th className="py-3.5 px-3 text-right">Waste / Loss</th>
                    <th className="py-3.5 px-4 text-right">Harga Beli</th>
                    <th className="py-3.5 px-4 text-right">Total Biaya (HPP)</th>
                    <th className="py-3.5 px-4 text-right">Sisa Stok Fisik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {usageLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="animate-spin inline-block mb-2 text-indigo-600" size={24} />
                        <p>Menghitung analisis konsumsi bahan baku...</p>
                      </td>
                    </tr>
                  ) : usageData?.items?.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Package className="inline-block mb-2 opacity-40 text-slate-400" size={32} />
                        <p className="font-semibold text-slate-600">Tidak ada data pemakaian bahan baku pada periode ini.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Pastikan sudah ada transaksi POS atau pencatatan stock loss di rentang tanggal yang dipilih.</p>
                      </td>
                    </tr>
                  ) : (
                    usageData?.items?.map((item: any, idx: number) => {
                      const cat = item.category || 'FOOD';
                      return (
                        <tr key={item.ingredientId || idx} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="py-3.5 px-4 font-black text-slate-900">
                            <div>{item.name}</div>
                            {item.subCategory && (
                              <span className="text-[10px] text-indigo-600 font-semibold">
                                {item.subCategory}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {cat === 'FOOD' ? '🍲 Dapur' : (cat === 'DRINK' ? '☕ Bar' : '📦 Kemasan')}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-indigo-700 text-sm">
                            {(item.totalQtyUsed || 0).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                          </td>

                          <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                            {(item.productionQty || 0).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            {item.lossQty > 0 ? (
                              <span className="font-bold text-rose-600">
                                {item.lossQty.toLocaleString('id-ID')} <span className="text-[10px] text-rose-400">{item.unit}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-600">
                            Rp {(item.buyPrice || 0).toLocaleString('id-ID')}
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                            Rp {(item.totalCost || 0).toLocaleString('id-ID')}
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                            {(item.currentStock || 0).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{item.unit}</span>
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
          TAB 3: STOCK LOSS & ANALISIS KERUSAKAN
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'loss' && (
        <div className="space-y-6 animate-fade-in">
          {/* RESPONSIVE DATE FILTER & ACTION BAR */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
              {/* Quick Date Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
                <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Periode:</span>
                {[
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'yesterday', label: 'Kemarin' },
                  { id: 'last7', label: '7 Hari' },
                  { id: 'this_month', label: 'Bulan Ini' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setLossPresetDate(p.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      lossPreset === p.id
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range Picker */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[10px] font-bold text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={lossStartDate}
                  onChange={e => {
                    setLossPreset('custom' as any);
                    setLossStartDate(e.target.value);
                    fetchLossAnalytics(e.target.value, lossEndDate);
                  }}
                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-800 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-slate-400 ml-1">s/d:</span>
                <input
                  type="date"
                  value={lossEndDate}
                  onChange={e => {
                    setLossPreset('custom' as any);
                    setLossEndDate(e.target.value);
                    fetchLossAnalytics(lossStartDate, e.target.value);
                  }}
                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-800 cursor-pointer"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-stretch sm:self-end lg:self-auto justify-end flex-wrap">
              <button
                onClick={handleExportLossPDF}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                title="Cetak Laporan Audit Kerusakan (PDF)"
              >
                <Printer size={14} />
                <span>Cetak PDF</span>
              </button>
              <button
                onClick={() => handleOpenLossModal()}
                className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Plus size={15} />
                <span>Catat Loss</span>
              </button>
            </div>
          </div>

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
                    Belum ada data kerugian pada periode ini 🎉
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
                  <p className="text-xs text-slate-500 mt-0.5">Jejak audit insiden bahan busuk, kadaluarsa, atau rusak periode ini.</p>
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
                          Belum ada log stock loss yang tercatat pada rentang tanggal ini.
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
          TAB 4: KARTU STOK & ALUR DISTRIBUSI
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'movements' && (
        <div className="space-y-6 animate-fade-in">
          {/* RESPONSIVE FILTER BAR */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <History size={20} className="text-indigo-600" />
                  Kartu Stok Digital & Alur Mutasi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Jejak lengkap keluar/masuk stok: Restock PO, Produksi POS, Stock Loss, dan Opname.</p>
              </div>

              {/* Dropdown Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <select
                  className="form-control text-xs font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl flex-1 sm:flex-none"
                  value={movementIngredientFilter}
                  onChange={e => {
                    setMovementIngredientFilter(e.target.value);
                    fetchMovements(movementStartDate, movementEndDate, movementTypeFilter, e.target.value);
                  }}
                >
                  <option value="ALL">Semua Bahan Baku</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id.toString()}>{i.name}</option>
                  ))}
                </select>

                <select
                  className="form-control text-xs font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl flex-1 sm:flex-none"
                  value={movementTypeFilter}
                  onChange={e => {
                    setMovementTypeFilter(e.target.value);
                    fetchMovements(movementStartDate, movementEndDate, e.target.value, movementIngredientFilter);
                  }}
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

            {/* Date Filters Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
              {/* Quick Date Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
                <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0">Tanggal:</span>
                {[
                  { id: 'all', label: 'Semua Waktu' },
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'yesterday', label: 'Kemarin' },
                  { id: 'last7', label: '7 Hari' },
                  { id: 'this_month', label: 'Bulan Ini' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setMovementPresetDate(p.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      movementPreset === p.id
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[10px] font-bold text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={movementStartDate}
                  onChange={e => {
                    setMovementPreset('custom' as any);
                    setMovementStartDate(e.target.value);
                    fetchMovements(e.target.value, movementEndDate, movementTypeFilter, movementIngredientFilter);
                  }}
                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-800 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-slate-400 ml-1">s/d:</span>
                <input
                  type="date"
                  value={movementEndDate}
                  onChange={e => {
                    setMovementPreset('custom' as any);
                    setMovementEndDate(e.target.value);
                    fetchMovements(movementStartDate, e.target.value, movementTypeFilter, movementIngredientFilter);
                  }}
                  className="bg-transparent border-none outline-none text-xs font-bold text-slate-800 cursor-pointer"
                />
              </div>
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
          TAB 5: ANALISIS BELANJA & STOK MINIM
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'shopping' && (
        <div className="space-y-6 animate-fade-in">
          {/* HORIZON SELECTOR & ACTIONS HEADER BAR */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <Sparkles size={16} className="text-emerald-600" />
                Horizon Pemakaian:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
                {[
                  { days: 3, label: '3 Hari' },
                  { days: 7, label: '7 Hari (1 Mgg)' },
                  { days: 14, label: '14 Hari (Standar)' },
                  { days: 30, label: '30 Hari (1 Bln)' },
                ].map(h => (
                  <button
                    key={h.days}
                    onClick={() => {
                      setShoppingHorizonDays(h.days);
                      fetchShoppingAnalytics(h.days);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      shoppingHorizonDays === h.days
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-stretch sm:self-end lg:self-auto justify-end flex-wrap">
              <button
                onClick={copyAllShoppingToWA}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                title="Salin Semua Daftar Belanja ke Format WhatsApp"
              >
                <MessageCircle size={14} />
                <span>Salin WA</span>
              </button>
              <button
                onClick={handleExportShoppingPDF}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                title="Cetak Laporan Rencana Anggaran Belanja (PDF)"
              >
                <Printer size={14} />
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>

          {/* SHOPPING SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl text-white shadow-lg shadow-emerald-600/20">
              <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Estimasi Modal Belanja ({shoppingHorizonDays} Hari)</p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                Rp {(shoppingData?.summary?.totalRestockCost || 0).toLocaleString('id-ID')}
              </h3>
              <p className="text-xs text-emerald-100/80 mt-1">
                Untuk mengembalikan seluruh stok menipis ke batas aman optimal {shoppingHorizonDays} hari ke depan.
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Truck size={18} className="text-emerald-600" />
                  Rekomendasi Pengadaan Cerdas per Supplier
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Dikelompokkan otomatis per vendor untuk kemudahan pembuatan Surat PO dan Order WhatsApp.</p>
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
                        onClick={() => handleGenerateSupplierPO(sup)}
                        className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                        title={`Unduh Surat Purchase Order (PO) Resmi ${sup.supplierName}`}
                      >
                        <FileText size={15} />
                        <span className="hidden sm:inline">Surat PO (PDF)</span>
                      </button>
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
          MODAL 1: TAMBAH / EDIT BAHAN BAKU (FULL-PAGE MOBILE VIEW)
      ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto">
          <div className="bg-white w-full h-full md:h-auto md:max-w-xl md:rounded-3xl shadow-2xl flex flex-col md:overflow-hidden max-h-screen md:max-h-[92vh] animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <Package size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    {editData ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editData ? `Perbarui data & HPP ${editData.name}` : 'Katalog persediaan bahan dapur & bar'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                onClick={() => setShowModal(false)}
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[72vh] pb-32 md:pb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Bahan Baku <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Daging Chicken Chashu, Biji Kopi Arabica"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Kategori Utama</label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value, subCategory: '' })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      <option value="FOOD">🍲 Bahan Dapur (Makanan & Sayur)</option>
                      <option value="DRINK">☕ Bahan Bar (Minuman Racikan)</option>
                      <option value="PACKAGING">📦 Packaging & Showcase (Display)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Sub-Kategori Bahan</label>
                    <div className="space-y-1.5">
                      <select
                        value={
                          (INGREDIENT_SUB_CATEGORIES[form.category] || []).includes(form.subCategory)
                            ? form.subCategory
                            : (form.subCategory ? '__CUSTOM__' : '')
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__CUSTOM__') {
                            setForm({ ...form, subCategory: form.subCategory || 'Lainnya' });
                          } else {
                            setForm({ ...form, subCategory: val });
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                      >
                        <option value="">-- Pilih Sub-Kategori --</option>
                        {(INGREDIENT_SUB_CATEGORIES[form.category] || []).map(sc => (
                          <option key={sc} value={sc}>{sc}</option>
                        ))}
                        <option value="__CUSTOM__">✍️ Input Sub-Kategori Kustom / Lainnya...</option>
                      </select>

                      {/* Show text input if custom subcategory is selected or active */}
                      {(!(INGREDIENT_SUB_CATEGORIES[form.category] || []).includes(form.subCategory) && form.subCategory !== '') && (
                        <input
                          type="text"
                          placeholder="Ketik nama sub-kategori khusus..."
                          value={form.subCategory}
                          onChange={e => setForm({ ...form, subCategory: e.target.value })}
                          className="w-full px-3.5 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800"
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Satuan / Unit <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="gram, ml, pcs, kg, porsi"
                      value={form.unit}
                      onChange={e => setForm({ ...form, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1.5">
                      Harga Beli / Unit (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0"
                      value={form.buyPrice}
                      onChange={e => setForm({ ...form, buyPrice: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Stok Awal</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={form.stock}
                      onChange={e => setForm({ ...form, stock: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Batas Minimum Stok (Alert)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={form.minStock}
                      onChange={e => setForm({ ...form, minStock: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Konversi Satuan Grosir (Gudang Pusat) */}
                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100/90 space-y-3">
                  <div className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <Boxes size={15} className="text-indigo-600" />
                    Konversi Satuan Grosir (Gudang Pusat)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Satuan Grosir / Kemasan Beli
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Karton, Dus, Karung"
                        value={form.purchaseUnit}
                        onChange={e => setForm({ ...form, purchaseUnit: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Isi per Satuan Grosir (ke {form.unit || 'unit'})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Contoh: 12 (1 Karton = 12 Botol)"
                        value={form.conversionRatio}
                        onChange={e => setForm({ ...form, conversionRatio: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {form.purchaseUnit && Number(form.conversionRatio) > 1 ? (
                      <span className="text-indigo-700 font-bold">
                        Rumus Konversi: 1 {form.purchaseUnit} = {form.conversionRatio} {form.unit}
                      </span>
                    ) : (
                      <span className="text-slate-400">Rasio standar 1:1 (satuan grosir sama dengan satuan dapur)</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Supplier / Mitra Langganan</label>
                  <select
                    value={form.supplierId}
                    onChange={e => setForm({ ...form, supplierId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id.toString()}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sticky Bottom Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
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

              {adjustForm.type === 'Restock' && (
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-1 animate-fade-in">
                  <label className="block text-xs font-bold text-indigo-900">
                    Harga Beli Masuk per {adjustModal.ingredient.unit} (Opsional untuk WAC)
                  </label>
                  <p className="text-[10px] text-indigo-600">
                    Harga sistem saat ini: Rp {adjustModal.ingredient.buyPrice.toLocaleString('id-ID')}/{adjustModal.ingredient.unit}. Masukkan jika harga nota baru berbeda untuk menghitung HPP rata-rata bergerak otomatis.
                  </p>
                  <input
                    type="number"
                    step="any"
                    placeholder={`Default: ${adjustModal.ingredient.buyPrice}`}
                    value={adjustForm.newBuyPrice || ''}
                    onChange={e => setAdjustForm({ ...adjustForm, newBuyPrice: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              )}

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
                  style={{
                    padding: '.65rem 1.25rem',
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '.75rem',
                    fontWeight: 800,
                    fontSize: '.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
                  }}
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngredientView;
