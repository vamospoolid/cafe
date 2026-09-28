import React, { useState, useEffect, useContext } from 'react';
import { 
  Package, Plus, Edit2, Trash2, AlertTriangle, ChevronDown, ChevronUp, 
  RefreshCw, TrendingDown, TrendingUp, Search, History, Utensils, ClipboardCheck, 
  CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, DollarSign, ArrowRight, 
  ShieldAlert, FileText, Coffee, ShoppingBag, Truck, BarChart3, PieChart, 
  ArrowUpRight, ArrowDownRight, Layers, HelpCircle, Send, ShoppingCart,
  Download, Printer, MessageCircle, Copy, Boxes, ChefHat, UserCheck, Flame, Award, Activity, Users, Target, X
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import { 
  exportIngredientValuationPDF, 
  exportStockLossAuditPDF, 
  exportProcurementForecastPDF, 
  exportStockOpnameVariancePDF,
  exportDailyMaterialConsumptionPDF,
  exportSimplePurchaseOrderPDF,
  exportYieldVarianceAuditPDF
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
  profitMargin?: number;
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

  // Tab State: 'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname' | 'daily_usage' | 'staff_activity' | 'yield'
  const [activeTab, setActiveTab] = useState<'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname' | 'daily_usage' | 'staff_activity' | 'yield'>('master');

  // Master Ingredients Data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'safe'>('all');

  // Yield & Variance Analytics (Tingkat Keberhasilan Porsi)
  const [yieldData, setYieldData] = useState<any>(null);
  const [yieldLoading, setYieldLoading] = useState(false);
  const [yieldPreset, setYieldPreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('this_month');
  const [yieldStartDate, setYieldStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [yieldEndDate, setYieldEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [yieldCategoryFilter, setYieldCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [yieldScopeFilter, setYieldScopeFilter] = useState<'ALL' | 'KEY_ONLY'>('ALL');
  const [yieldSearch, setYieldSearch] = useState<string>('');
  const [expandedYieldId, setExpandedYieldId] = useState<number | null>(null);

  // Staff Activity & Loss Analytics State
  const [staffActivityData, setStaffActivityData] = useState<any>(null);
  const [staffActivityLoading, setStaffActivityLoading] = useState(false);
  const [staffDatePreset, setStaffDatePreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('this_month');
  const [staffStartDate, setStaffStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [staffEndDate, setStaffEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStaffUserFilter, setSelectedStaffUserFilter] = useState<string>('ALL');

  // Daily Usage & COGS Analytics State
  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usagePreset, setUsagePreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('today');
  const [usageStartDate, setUsageStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [usageEndDate, setUsageEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [usageCategoryFilter, setUsageCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [usageTypeFilter, setUsageTypeFilter] = useState<string>('ALL');
  const [usageSearch, setUsageSearch] = useState<string>('');

  // Stock Loss Data & Analytics
  const [lossData, setLossData] = useState<any>(null);
  const [lossLoading, setLossLoading] = useState(false);
  const [lossPreset, setLossPreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('this_month');
  const [lossStartDate, setLossStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [lossEndDate, setLossEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showLossModal, setShowLossModal] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [lossForm, setLossForm] = useState({
    targetType: 'INGREDIENT' as 'INGREDIENT' | 'PRODUCT',
    ingredientId: '',
    productId: '',
    qtyLoss: '1',
    reason: 'Busuk / Basi',
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
  const [movementSearch, setMovementSearch] = useState<string>('');
  const [showAdjustPickerModal, setShowAdjustPickerModal] = useState<boolean>(false);
  const [pickerSearch, setPickerSearch] = useState<string>('');

  // Production Forecast Data
  const [forecastList, setForecastList] = useState<ProductionForecastItem[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastCategory, setForecastCategory] = useState<string>('Semua');
  const [forecastStatusFilter, setForecastStatusFilter] = useState<'ALL' | 'READY' | 'LOW' | 'OUT'>('ALL');
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

  const handleExportYieldPDF = async () => {
    try {
      setGeneratingPdf(true);
      let raw = yieldData;
      if (!raw) {
        const url = new URL(`${window.location.origin}${API}/ingredients/yield-analytics`);
        if (yieldStartDate) url.searchParams.set('startDate', yieldStartDate);
        if (yieldEndDate) url.searchParams.set('endDate', yieldEndDate);
        if (yieldCategoryFilter !== 'ALL') url.searchParams.set('category', yieldCategoryFilter);
        if (yieldScopeFilter !== 'ALL') url.searchParams.set('scope', yieldScopeFilter);
        const res = await fetch(url.toString(), { headers });
        if (res.ok) raw = await res.json();
      }
      await exportYieldVarianceAuditPDF(
        posContext?.settings || {},
        raw,
        yieldStartDate,
        yieldEndDate,
        posContext?.user?.username || 'Auditor / Manager'
      );
      toast('Laporan Audit Tingkat Keberhasilan & Yield berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh Laporan Audit Yield', 'error');
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
      fetchProducts();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', { headers });
      if (res.ok) setAllProducts(await res.json());
    } catch (e) {
      console.error('Error fetching products:', e);
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

  const fetchStaffActivityAnalytics = async (start?: string, end?: string, uId?: string) => {
    setStaffActivityLoading(true);
    try {
      const s = start !== undefined ? start : staffStartDate;
      const e = end !== undefined ? end : staffEndDate;
      const user = uId !== undefined ? uId : selectedStaffUserFilter;
      const url = new URL(`${window.location.origin}${API}/ingredients/staff-activity-analytics`);
      if (s) url.searchParams.set('startDate', `${s}T00:00:00.000Z`);
      if (e) url.searchParams.set('endDate', `${e}T23:59:59.999Z`);
      if (user && user !== 'ALL') url.searchParams.set('userId', user);

      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const data = await res.json();
        setStaffActivityData(data);
      }
    } catch (e) {
      console.error('Error staff activity analytics:', e);
    } finally {
      setStaffActivityLoading(false);
    }
  };

  const setStaffPresetDate = (preset: 'today' | 'yesterday' | 'last7' | 'this_month') => {
    setStaffDatePreset(preset);
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
    setStaffStartDate(startStr);
    setStaffEndDate(endStr);
    fetchStaffActivityAnalytics(startStr, endStr, selectedStaffUserFilter);
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

  const fetchYieldAnalytics = async (start?: string, end?: string, cat?: string, scope?: string) => {
    setYieldLoading(true);
    try {
      const s = start !== undefined ? start : yieldStartDate;
      const e = end !== undefined ? end : yieldEndDate;
      const c = cat !== undefined ? cat : yieldCategoryFilter;
      const sc = scope !== undefined ? scope : yieldScopeFilter;

      const url = new URL(`${window.location.origin}${API}/ingredients/yield-analytics`);
      if (s) url.searchParams.set('startDate', s);
      if (e) url.searchParams.set('endDate', e);
      if (c && c !== 'ALL') url.searchParams.set('category', c);
      if (sc && sc !== 'ALL') url.searchParams.set('scope', sc);

      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        setYieldData(await res.json());
      }
    } catch (err) {
      console.error('Error fetching yield analytics:', err);
    } finally {
      setYieldLoading(false);
    }
  };

  const handleYieldPresetChange = (preset: 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom') => {
    setYieldPreset(preset);
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
    } else {
      return;
    }
    const startStr = s.toISOString().split('T')[0];
    const endStr = e.toISOString().split('T')[0];
    setYieldStartDate(startStr);
    setYieldEndDate(endStr);
    fetchYieldAnalytics(startStr, endStr, yieldCategoryFilter, yieldScopeFilter);
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'loss') fetchLossAnalytics();
    else if (activeTab === 'staff_activity') fetchStaffActivityAnalytics();
    else if (activeTab === 'shopping') fetchShoppingAnalytics();
    else if (activeTab === 'movements') fetchMovements();
    else if (activeTab === 'forecast') fetchForecast();
    else if (activeTab === 'opname') fetchOpnameHistory();
    else if (activeTab === 'daily_usage') fetchDailyUsage();
    else if (activeTab === 'yield') fetchYieldAnalytics();
  }, [activeTab, movementTypeFilter, movementIngredientFilter, usageCategoryFilter, usageTypeFilter, selectedStaffUserFilter, yieldCategoryFilter, yieldScopeFilter, token]);

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

  const handleOpenLossModal = (preselectedId?: number, initialType: 'INGREDIENT' | 'PRODUCT' = 'INGREDIENT') => {
    setLossForm({
      targetType: initialType,
      ingredientId: preselectedId ? preselectedId.toString() : (ingredients[0]?.id.toString() || ''),
      productId: allProducts[0]?.id?.toString() || '',
      qtyLoss: '1',
      reason: 'Busuk / Basi',
      notes: ''
    });
    setShowLossModal(true);
    if (allProducts.length === 0) fetchProducts();
  };

  const handleIncrementQty = (increment: number) => {
    if (increment === 0) {
      setLossForm(prev => ({ ...prev, qtyLoss: '0' }));
      return;
    }
    const current = parseFloat(lossForm.qtyLoss) || 0;
    const next = Math.max(0, current + increment);
    const formatted = parseFloat(next.toFixed(2)).toString();
    setLossForm(prev => ({ ...prev, qtyLoss: formatted }));
  };

  const handleSubmitLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(lossForm.qtyLoss);
    if (isNaN(qty) || qty <= 0) {
      return toast('Masukkan jumlah kuantitas terbuang yang valid', 'warning');
    }
    if (lossForm.targetType === 'INGREDIENT' && !lossForm.ingredientId) {
      return toast('Pilih bahan baku terlebih dahulu', 'warning');
    }
    if (lossForm.targetType === 'PRODUCT' && !lossForm.productId) {
      return toast('Pilih menu masakan jadi terlebih dahulu', 'warning');
    }

    setSubmittingLoss(true);
    try {
      const res = await fetch(`${API}/ingredients/loss`, {
        method: 'POST',
        headers,
        body: JSON.stringify(lossForm)
      });
      if (res.ok) {
        toast('Pencatatan food waste berhasil disimpan!', 'success');
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

  const handleDeleteLoss = async (id: number) => {
    const res = await confirmAlert(
      'Batalkan Catatan Stock Loss?',
      'Stok bahan baku akan dikembalikan otomatis ke inventaris dan catatan insiden ini akan dihapus dari riwayat audit.'
    );
    if (!res.isConfirmed) return;

    try {
      const res = await fetch(`${API}/ingredients/loss/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        toast('Catatan loss berhasil dibatalkan dan stok dikembalikan!', 'success');
        fetchLossAnalytics();
        fetchData();
        if (activeTab === 'movements') fetchMovements();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal membatalkan loss', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
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
  const safeStockCount = ingredients.filter(i => i.stock > i.minStock).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + (i.stock * i.buyPrice), 0);

  // Selected ingredient / product in loss modal calculation
  const selectedLossIngredient = ingredients.find(i => i.id === Number(lossForm.ingredientId));
  const selectedLossProduct = allProducts.find(p => p.id === Number(lossForm.productId));
  const selectedProductForecast = forecastList.find(f => f.productId === Number(lossForm.productId));
  const fallbackHpp = selectedLossProduct?.price ? Math.round(selectedLossProduct.price * 0.4) : 0;
  const selectedProductHpp = (selectedLossProduct?.buyPrice && selectedLossProduct.buyPrice > 0)
    ? selectedLossProduct.buyPrice
    : ((selectedProductForecast?.buyPrice && selectedProductForecast.buyPrice > 0) ? selectedProductForecast.buyPrice : fallbackHpp);

  const unitHpp = lossForm.targetType === 'INGREDIENT'
    ? (selectedLossIngredient?.buyPrice || 0)
    : selectedProductHpp;
  const unitLabel = lossForm.targetType === 'INGREDIENT'
    ? (selectedLossIngredient?.unit || 'satuan')
    : 'porsi';
  const estimatedLossAmount = (parseFloat(lossForm.qtyLoss) || 0) * unitHpp;

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP ACTION BAR
      ────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────
          1. SUB-HEADER & STORE BADGE (CLEAN HEADER - NO COLLISION)
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-0.5 shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
              Master Bahan Baku & Intelijen Stok
            </h2>
            <span className="px-2.5 py-0.5 bg-purple-50 text-indigo-700 border border-purple-200/80 rounded-full text-xs font-black">
              {posContext?.settings?.storeName || 'MUKI RAMEN'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Klasifikasi stok, audit potensi stock loss, mutasi distribusi, dan analisis rekomendasi belanja
          </p>
        </div>

        {/* Global Toolbar: Refresh & PDF Export */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {/* EXPORT LAPORAN PDF DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)}
              disabled={generatingPdf}
              className="px-3.5 py-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
            >
              <FileText size={15} />
              <span>{generatingPdf ? 'Membuat...' : 'Cetak PDF'}</span>
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

                  <button
                    onClick={handleExportYieldPDF}
                    className="w-full px-4 py-2.5 hover:bg-violet-50 text-left flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                      <Target size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 group-hover:text-violet-900">Laporan Audit Tingkat Keberhasilan (Yield)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Analisis akurasi takaran resep vs porsi terjual riil</p>
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
              if (activeTab === 'yield') fetchYieldAnalytics();
            }}
            title="Perbarui Data"
            className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-xs active:scale-95 transition-all shrink-0"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGASI 9 TAB UTAMA BAHAN BAKU 
          Mobile: 3x3 Super App Icon Hub (1-Tap Fast Access)
          Desktop: Structured 3-Column Bento Grid
      ────────────────────────────────────────────────────────────── */}
      {/* Mobile 3x3 Super App Icon Hub (Zero Scroll Samping, 1-Tap Access) */}
      <div className="bento-nav-mobile sm:!hidden bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs shrink-0">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { 
              id: 'master', 
              title: 'Master Bahan', 
              icon: Package, 
              badge: ingredients.length > 0 ? `${ingredients.length}` : null,
              color: 'text-purple-600 bg-purple-50 border-purple-100',
              activeColor: 'from-purple-600 to-indigo-600 text-white shadow-purple-500/30'
            },
            { 
              id: 'daily_usage', 
              title: 'Konsumsi Harian', 
              icon: BarChart3, 
              badge: (usageData?.items?.length || 0) > 0 ? `${usageData?.items?.length}` : null,
              color: 'text-sky-600 bg-sky-50 border-sky-100',
              activeColor: 'from-sky-500 to-blue-600 text-white shadow-sky-500/30'
            },
            { 
              id: 'loss', 
              title: 'Stock Loss', 
              icon: TrendingDown, 
              badge: (lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount ?? 0) > 0 ? `${lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount}` : null,
              color: 'text-rose-600 bg-rose-50 border-rose-100',
              activeColor: 'from-rose-500 to-red-600 text-white shadow-rose-500/30'
            },
            { 
              id: 'staff_activity', 
              title: 'Staf Dapur', 
              icon: ChefHat, 
              badge: 'KPI',
              color: 'text-amber-600 bg-amber-50 border-amber-100',
              activeColor: 'from-amber-500 to-orange-600 text-white shadow-amber-500/30'
            },
            { 
              id: 'movements', 
              title: 'Kartu Stok', 
              icon: History, 
              badge: movements.length > 0 ? `${movements.length}` : null,
              color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
              activeColor: 'from-emerald-500 to-teal-600 text-white shadow-emerald-500/30'
            },
            { 
              id: 'shopping', 
              title: 'Rencana Belanja', 
              icon: ShoppingCart, 
              badge: (lowStockCount + outStockCount) > 0 ? `${lowStockCount + outStockCount}` : null,
              color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
              activeColor: 'from-indigo-600 to-violet-600 text-white shadow-indigo-500/30'
            },
            { 
              id: 'forecast', 
              title: 'Kapasitas (BOM)', 
              icon: Utensils, 
              badge: forecastList.length > 0 ? `${forecastList.length}` : null,
              color: 'text-teal-600 bg-teal-50 border-teal-100',
              activeColor: 'from-teal-500 to-cyan-600 text-white shadow-teal-500/30'
            },
            { 
              id: 'opname', 
              title: 'Stock Opname', 
              icon: ClipboardCheck, 
              badge: opnameHistory.length > 0 ? `${opnameHistory.length}` : null,
              color: 'text-blue-600 bg-blue-50 border-blue-100',
              activeColor: 'from-blue-600 to-indigo-600 text-white shadow-blue-500/30'
            },
            { 
              id: 'yield', 
              title: 'Yield Efisiensi', 
              icon: Target, 
              badge: (yieldData?.summary?.storeEfficiencyRate !== undefined) ? `${yieldData?.summary?.storeEfficiencyRate}%` : 'Yield',
              color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100',
              activeColor: 'from-fuchsia-600 to-purple-600 text-white shadow-fuchsia-500/30'
            },
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? `bg-gradient-to-br ${tab.activeColor} shadow-md`
                    : 'bg-slate-50/70 hover:bg-slate-100/90 border border-slate-100 text-slate-700'
                }`}
              >
                {/* Micro Badge */}
                {tab.badge && (
                  <span className={`absolute top-1 right-1 text-[8px] px-1.5 py-0.2 rounded-full font-black tracking-tight ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-700 border border-purple-200/60'
                  }`}>
                    {tab.badge}
                  </span>
                )}

                {/* Squircle Icon Box */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 transition-all ${
                  isSelected ? 'bg-white/20 text-white' : `${tab.color} border`
                }`}>
                  <Icon size={16} />
                </div>

                {/* Micro Label */}
                <span className={`text-[10px] font-black leading-tight line-clamp-1 ${
                  isSelected ? 'text-white font-extrabold' : 'text-slate-800'
                }`}>
                  {tab.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop & Tablet Bento Grid */}
      <div className="bento-nav-desktop hidden sm:!grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 shrink-0 bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-sm">
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
            id: 'staff_activity', 
            title: 'Analisis Staf Dapur', 
            subtitle: 'Audit & Akuntabilitas', 
            icon: ChefHat,
            badge: (staffActivityData?.staffList?.length || 0) > 0 ? `${staffActivityData?.staffList?.length} Staf` : 'KPI'
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
          { 
            id: 'yield', 
            title: 'Tingkat Keberhasilan', 
            subtitle: 'Yield & Efisiensi Resep', 
            icon: Target,
            badge: (yieldData?.summary?.storeEfficiencyRate !== undefined) ? `${yieldData?.summary?.storeEfficiencyRate}% Sukses` : 'Yield'
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
                padding: '.85rem 1rem',
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
                width: '100%'
              }}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '.65rem',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#ede9fe',
                  color: isSelected ? '#ffffff' : '#7c3aed',
                  flexShrink: 0
                }}
              >
                <Icon size={19} />
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
                        padding: '.15rem .45rem', 
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
                <span style={{ fontSize: '.72rem', color: isSelected ? 'rgba(255,255,255,0.8)' : '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '.1rem' }}>
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
        <div className="space-y-3.5 sm:space-y-6 animate-fade-in">
          {/* STATS OVERVIEW CARDS (2x2 on Mobile, 4 Columns on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Total Bahan */}
            <div className="p-3 sm:p-4 bg-purple-50/80 border border-purple-200/80 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-purple-800 uppercase tracking-wider">Total Bahan Baku</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Package size={16} />
                </div>
              </div>
              <div className="mt-1">
                <h4 className="text-base sm:text-2xl font-black text-purple-950">
                  {ingredients.length} <span className="text-xs font-bold text-purple-700">Item</span>
                </h4>
                <p className="text-[10px] text-purple-700/80 mt-0.5">Semua jenis bahan aktif</p>
              </div>
            </div>

            {/* Card 2: Stok Menipis */}
            <div className="p-3 sm:p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-amber-800 uppercase tracking-wider">Stok Menipis</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle size={15} />
                </div>
              </div>
              <div className="mt-1">
                <h4 className="text-base sm:text-2xl font-black text-amber-950">
                  {lowStockCount} <span className="text-xs font-bold text-amber-700">Bahan</span>
                </h4>
                <p className="text-[10px] text-amber-700/80 mt-0.5">Mendekati batas minimum</p>
              </div>
            </div>

            {/* Card 3: Stok Habis (Kritis) */}
            <div className="p-3 sm:p-4 bg-rose-50/80 border border-rose-200/80 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider">Stok Habis (Kritis)</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ShieldAlert size={15} />
                </div>
              </div>
              <div className="mt-1">
                <h4 className="text-base sm:text-2xl font-black text-rose-600">
                  {outStockCount} <span className="text-xs font-bold text-rose-500">Bahan</span>
                </h4>
                <p className="text-[10px] text-rose-600/80 mt-0.5">Harus segera di-restock</p>
              </div>
            </div>

            {/* Card 4: Valuasi Aset Stok */}
            <div className="p-3 sm:p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider">Valuasi Aset Stok</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="mt-1">
                <h4 className="text-base sm:text-xl font-black text-emerald-950 truncate">
                  Rp {totalValuation.toLocaleString('id-ID')}
                </h4>
                <p className="text-[10px] text-emerald-700/80 mt-0.5">{ingredients.length} item tersimpan</p>
              </div>
            </div>
          </div>

          {/* FILTER & CONTROL TOOLBAR */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Package size={18} className="text-purple-600 shrink-0" />
                  Katalog Master Bahan Baku
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Kelola stok fisik dapur, harga beli HPP, klasifikasi stasiun, dan supplier langganan.
                </p>
              </div>

              {/* ACTION BUTTONS: + TAMBAH BAHAN & REFRESH */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={handleOpenAdd}
                  className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-purple-600/20 active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={15} />
                  <span>Tambah Bahan</span>
                </button>

                <button
                  onClick={() => fetchData()}
                  className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shrink-0"
                  title="Perbarui Data Master Bahan"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* SEARCH & CATEGORY PILLS ROW */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
              <div className="relative w-full md:w-72 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama bahan atau supplier..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Station Category Quick Pills (Scrollable horizontal strip) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                {[
                  { id: 'ALL', label: 'Semua Kategori' },
                  { id: 'FOOD', label: '🍲 Dapur (Food)' },
                  { id: 'DRINK', label: '☕ Bar (Drink)' },
                  { id: 'PACKAGING', label: '📦 Kemasan' },
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCategoryFilter(c.id as any);
                      setSubCategoryFilter('ALL');
                    }}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      categoryFilter === c.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* STATUS PILLS & SUB-CATEGORY ROW */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
              {/* Status Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mr-0.5 shrink-0">Status:</span>
                {[
                  { id: 'all', label: `Semua (${ingredients.length})` },
                  { id: 'low', label: `● Menipis (${lowStockCount})`, color: 'text-amber-600' },
                  { id: 'out', label: `● Habis (${outStockCount})`, color: 'text-rose-600' },
                  { id: 'safe', label: `● Aman (${safeStockCount})`, color: 'text-emerald-600' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStatusFilter(s.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      statusFilter === s.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : `bg-slate-50 hover:bg-slate-100 border border-slate-200 ${s.color || 'text-slate-600'}`
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Sub-Category Dropdown */}
              {categoryFilter !== 'ALL' && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Sub:</span>
                  <select
                    value={subCategoryFilter}
                    onChange={e => setSubCategoryFilter(e.target.value)}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 outline-none max-w-[200px] truncate"
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
          </div>

          {/* INGREDIENTS VIEW: MOBILE CARDS & DESKTOP TABLE */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-3 sm:space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Package size={16} className="text-purple-600" />
                Daftar Bahan Baku Terdaftar
              </h4>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                {filtered.length} Bahan
              </span>
            </div>

            {/* MOBILE CARDS VIEW (< md screen) */}
            <div className="block md:hidden space-y-2.5">
              {loading ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  <RefreshCw className="animate-spin inline-block mb-2 text-purple-600" size={20} />
                  <p>Memuat katalog bahan baku...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl p-4 space-y-3">
                  <Package className="mx-auto mb-1 opacity-40 text-slate-400" size={28} />
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Tidak ada bahan baku yang cocok.</p>
                    <p className="text-slate-400 text-xs mt-0.5">Sesuaikan filter atau buat bahan baku baru.</p>
                  </div>
                  <button
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95"
                  >
                    <Plus size={14} />
                    <span>Tambah Bahan Baku</span>
                  </button>
                </div>
              ) : (
                filtered.map((ing) => {
                  const isOut = ing.stock === 0;
                  const isLow = ing.stock > 0 && ing.stock <= ing.minStock;
                  const cat = ing.category || 'FOOD';
                  const valuation = ing.stock * ing.buyPrice;

                  return (
                    <div key={ing.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 space-y-2.5 transition-colors">
                      {/* Card Header: Category Icon, Name, and Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-lg shrink-0 mt-0.5">
                            {cat === 'FOOD' ? '🍲' : (cat === 'DRINK' ? '☕' : '📦')}
                          </span>
                          <div className="min-w-0">
                            <h5 className="font-black text-sm text-slate-900 truncate">{ing.name}</h5>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-purple-700 font-extrabold uppercase bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60">
                                {cat === 'FOOD' ? 'Dapur' : (cat === 'DRINK' ? 'Bar' : 'Kemasan')}
                              </span>
                              {ing.subCategory && (
                                <span className="text-[9px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {ing.subCategory}
                                </span>
                              )}
                              {typeof ing.warehouseStock === 'number' && ing.warehouseStock > 0 && (
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 inline-flex items-center gap-0.5">
                                  <Boxes size={9} /> {ing.warehouseStock.toLocaleString('id-ID')} {ing.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                              Habis
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Aman
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3-Column Sub-Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 bg-white rounded-xl border border-slate-200/80 text-center">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Stok Fisik</p>
                          <p className={`text-xs font-black mt-0.5 ${isOut ? 'text-rose-600' : (isLow ? 'text-amber-600' : 'text-slate-900')}`}>
                            {ing.stock.toLocaleString('id-ID')} <span className="text-[10px] font-medium text-slate-500">{ing.unit}</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Min: {ing.minStock.toLocaleString('id-ID')}</p>
                        </div>

                        <div className="border-x border-slate-100 px-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Harga Beli</p>
                          <p className="text-xs font-black text-slate-800 mt-0.5">
                            Rp {ing.buyPrice.toLocaleString('id-ID')}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">per {ing.unit}</p>
                        </div>

                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Valuasi Stok</p>
                          <p className="text-xs font-black text-emerald-700 mt-0.5">
                            Rp {valuation.toLocaleString('id-ID')}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Total Modal</p>
                        </div>
                      </div>

                      {/* Supplier & Actions Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[130px]">
                          {ing.supplier ? `🏢 ${ing.supplier.name}` : <span className="italic text-slate-400">Supplier: -</span>}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Sesuaikan Stok */}
                          <button
                            onClick={() => {
                              setAdjustModal({ open: true, ingredient: ing });
                              setAdjustForm({ change: '', type: 'Restock', description: '' });
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-purple-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1 active:scale-95"
                            title="Sesuaikan Stok"
                          >
                            <RefreshCw size={11} />
                            <span>Sesuaikan</span>
                          </button>

                          {/* Loss */}
                          <button
                            onClick={() => handleOpenLossModal(ing.id)}
                            className="p-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-lg transition-all active:scale-95"
                            title="Catat Kerusakan/Loss"
                          >
                            <TrendingDown size={13} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(ing)}
                            className="p-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-all active:scale-95"
                            title="Edit Bahan Baku"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(ing.id, ing.name)}
                            className="p-1 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-lg transition-all active:scale-95"
                            title="Hapus Bahan Baku"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (>= md screen) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase sticky top-0">
                  <tr>
                    <th className="py-3.5 px-5">Nama Bahan & Kategori</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Stok Riil</th>
                    <th className="py-3.5 px-3 text-right">Batas Min.</th>
                    <th className="py-3.5 px-4 text-right">Harga Beli / Unit</th>
                    <th className="py-3.5 px-4 text-right">Valuasi Stok</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
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
                      const valuation = ing.stock * ing.buyPrice;

                      return (
                        <tr key={ing.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base shrink-0">
                                {cat === 'FOOD' ? '🍲' : (cat === 'DRINK' ? '☕' : '📦')}
                              </span>
                              <div>
                                <div className="font-black text-slate-900">{ing.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">
                                    {cat === 'FOOD' ? 'Dapur' : (cat === 'DRINK' ? 'Bar' : 'Kemasan')}
                                  </span>
                                  {ing.subCategory && (
                                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                                      &gt; {ing.subCategory}
                                    </span>
                                  )}
                                  {typeof ing.warehouseStock === 'number' && ing.warehouseStock > 0 && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60 inline-flex items-center gap-1">
                                      <Boxes size={10} /> Gudang: {ing.warehouseStock.toLocaleString('id-ID')} {ing.unit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                                Habis
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Aman
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                            {ing.stock.toLocaleString('id-ID')} <span className="text-[10px] font-bold text-slate-400">{ing.unit}</span>
                          </td>

                          <td className="py-3.5 px-3 text-right font-bold text-slate-500 whitespace-nowrap">
                            {ing.minStock.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{ing.unit}</span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                            Rp {ing.buyPrice.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">/{ing.unit}</span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                            Rp {valuation.toLocaleString('id-ID')}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 text-xs">
                            {ing.supplier ? (
                              <div className="font-bold text-slate-700 truncate max-w-[150px]">{ing.supplier.name}</div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Belum diatur</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setAdjustModal({ open: true, ingredient: ing });
                                  setAdjustForm({ change: '', type: 'Restock', description: '' });
                                }}
                                title="Sesuaikan Stok / Restock"
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-purple-700 hover:border-purple-300 border border-slate-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs"
                              >
                                Sesuaikan
                              </button>

                              <button
                                onClick={() => handleOpenLossModal(ing.id)}
                                title="Catat Kerusakan/Loss"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                              >
                                <TrendingDown size={13} />
                              </button>

                              <button
                                onClick={() => handleOpenEdit(ing)}
                                title="Edit Bahan"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                onClick={() => handleDelete(ing.id, ing.name)}
                                title="Hapus Bahan"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                              >
                                <Trash2 size={13} />
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
      {activeTab === 'daily_usage' && (() => {
        const filteredUsageItems = (usageData?.items || []).filter((item: any) => {
          if (!usageSearch.trim()) return true;
          const q = usageSearch.toLowerCase();
          return item.name?.toLowerCase().includes(q) || item.subCategory?.toLowerCase().includes(q);
        });

        return (
          <div className="space-y-3.5 sm:space-y-6 animate-fade-in">
            {/* FILTER & CONTROL TOOLBAR */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-600 shrink-0" />
                    Analisis Konsumsi Bahan & COGS
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Pantau pemakaian bahan riil harian dari pesanan POS, evaluasi HPP, dan rasio food cost.
                  </p>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={handleExportDailyUsagePDF}
                    disabled={generatingPdf}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                    title="Cetak Laporan PDF Konsumsi Bahan Baku & COGS"
                  >
                    <Printer size={14} />
                    <span>{generatingPdf ? 'Membuat...' : 'Cetak PDF'}</span>
                  </button>

                  <button
                    onClick={() => fetchDailyUsage()}
                    className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shrink-0"
                    title="Perbarui Data"
                  >
                    <RefreshCw size={14} className={usageLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* PRESETS & FILTERS ROW */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                {/* Quick Date Presets (Scrollable horizontal strip on mobile) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mr-0.5 shrink-0">Periode:</span>
                  {[
                    { id: 'today', label: 'Hari Ini' },
                    { id: 'yesterday', label: 'Kemarin' },
                    { id: 'last7', label: '7 Hari' },
                    { id: 'this_month', label: 'Bulan Ini' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPresetDate(p.id as any)}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        usagePreset === p.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Inputs & Dropdowns */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs">
                    <span className="text-[9px] font-bold text-slate-400">Dari:</span>
                    <input
                      type="date"
                      value={usageStartDate}
                      onChange={e => {
                        setUsagePreset('custom' as any);
                        setUsageStartDate(e.target.value);
                        fetchDailyUsage(e.target.value, usageEndDate, usageCategoryFilter, usageTypeFilter);
                      }}
                      className="bg-transparent border-none outline-none text-[11px] sm:text-xs font-bold text-slate-800"
                    />
                    <span className="text-[9px] font-bold text-slate-400">s/d:</span>
                    <input
                      type="date"
                      value={usageEndDate}
                      onChange={e => {
                        setUsagePreset('custom' as any);
                        setUsageEndDate(e.target.value);
                        fetchDailyUsage(usageStartDate, e.target.value, usageCategoryFilter, usageTypeFilter);
                      }}
                      className="bg-transparent border-none outline-none text-[11px] sm:text-xs font-bold text-slate-800"
                    />
                  </div>

                  <select
                    value={usageCategoryFilter}
                    onChange={e => {
                      setUsageCategoryFilter(e.target.value as any);
                      fetchDailyUsage(usageStartDate, usageEndDate, e.target.value, usageTypeFilter);
                    }}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="FOOD">🍲 Dapur</option>
                    <option value="DRINK">☕ Bar</option>
                    <option value="PACKAGING">📦 Kemasan</option>
                  </select>

                  <select
                    value={usageTypeFilter}
                    onChange={e => {
                      setUsageTypeFilter(e.target.value);
                      fetchDailyUsage(usageStartDate, usageEndDate, usageCategoryFilter, e.target.value);
                    }}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="ALL">Semua Pemakaian</option>
                    <option value="Produksi">🍳 Produksi POS</option>
                    <option value="Rusak">🗑️ Loss / Waste</option>
                  </select>
                </div>
              </div>
            </div>

            {/* KPI METRIC CARDS (2x2 on Mobile, 4 Columns on Desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Card 1: Total HPP (COGS) */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-md shadow-indigo-600/20 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] sm:text-xs font-bold text-indigo-100 uppercase tracking-wider">Total HPP Terpakai</p>
                    <span className="px-1.5 py-0.2 bg-white/20 text-white rounded text-[9px] font-black">COGS</span>
                  </div>
                  <h3 className="text-base sm:text-2xl font-black mt-1">
                    Rp {(usageData?.summary?.totalCostUsage || 0).toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="text-[10px] sm:text-xs text-indigo-100/90 mt-2 flex items-center gap-1.5 flex-wrap">
                  <span>Food Cost:</span>
                  <span className="font-black px-1.5 py-0.2 bg-white text-indigo-900 rounded-md text-[10px]">
                    {usageData?.summary?.foodCostRatio || 0}%
                  </span>
                </div>
              </div>

              {/* Card 2: Omzet Penjualan POS */}
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider">Omzet POS</p>
                    <h3 className="text-base sm:text-2xl font-black text-slate-900 mt-1">
                      Rp {(usageData?.summary?.totalRevenue || 0).toLocaleString('id-ID')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <DollarSign size={18} />
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-2">Penjualan lunas</p>
              </div>

              {/* Card 3: Biaya Kerugian (Loss/Waste) */}
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-rose-600 uppercase tracking-wider">Loss / Waste</p>
                    <h3 className="text-base sm:text-2xl font-black text-rose-600 mt-1">
                      Rp {(usageData?.summary?.totalLossCost || 0).toLocaleString('id-ID')}
                    </h3>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <TrendingDown size={18} />
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-2">Bahan rusak / basi</p>
              </div>

              {/* Card 4: Bahan Aktif Terpakai */}
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Bahan Aktif</p>
                    <h3 className="text-base sm:text-2xl font-black text-slate-900 mt-1">
                      {usageData?.summary?.totalActiveIngredientsUsed || 0} <span className="text-xs font-bold text-slate-400">Bahan</span>
                    </h3>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Package size={18} />
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-2">Macam bahan keluar</p>
              </div>
            </div>

            {/* BREAKDOWN PER STASIUN (FOOD vs DRINK vs PACKAGING) - 3 Columns on all devices */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="p-2.5 sm:p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-tight">🍲 Dapur</div>
                  <div className="text-xs sm:text-base font-black text-amber-950 mt-0.5">
                    Rp {(usageData?.summary?.foodCost || 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <span className="text-lg sm:text-2xl self-end sm:self-center">🍜</span>
              </div>

              <div className="p-2.5 sm:p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase tracking-tight">☕ Bar</div>
                  <div className="text-xs sm:text-base font-black text-sky-950 mt-0.5">
                    Rp {(usageData?.summary?.drinkCost || 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <span className="text-lg sm:text-2xl self-end sm:self-center">🥤</span>
              </div>

              <div className="p-2.5 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-tight">📦 Kemasan</div>
                  <div className="text-xs sm:text-base font-black text-slate-900 mt-0.5">
                    Rp {(usageData?.summary?.packagingCost || 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <span className="text-lg sm:text-2xl self-end sm:self-center">🛍️</span>
              </div>
            </div>

            {/* TABEL & KARTU RINCIAN KONSUMSI BAHAN BAKU */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers size={18} className="text-indigo-600" />
                    Rincian Pemakaian Riil per-Item Bahan Baku
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total kuantitas gram/ml/pcs bahan yang terpakai beserta nilai rupiah HPP-nya.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={usageSearch}
                      onChange={e => setUsageSearch(e.target.value)}
                      placeholder="Cari bahan..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 whitespace-nowrap shrink-0">
                    {filteredUsageItems.length} Bahan
                  </span>
                </div>
              </div>

              {/* MOBILE CARDS VIEW (< md screen) */}
              <div className="block md:hidden space-y-2.5">
                {usageLoading ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    <RefreshCw className="animate-spin inline-block mb-2 text-indigo-600" size={20} />
                    <p>Menghitung analisis konsumsi bahan...</p>
                  </div>
                ) : filteredUsageItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl p-4">
                    <Package className="mx-auto mb-1.5 opacity-40 text-slate-400" size={28} />
                    <p className="font-bold text-slate-600">Tidak ada data pemakaian bahan baku.</p>
                  </div>
                ) : (
                  filteredUsageItems.map((item: any, idx: number) => {
                    const cat = item.category || 'FOOD';
                    return (
                      <div key={item.ingredientId || idx} className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h5 className="font-black text-sm text-slate-900 truncate">{item.name}</h5>
                            {item.subCategory && (
                              <span className="text-[10px] text-indigo-600 font-semibold">{item.subCategory}</span>
                            )}
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-white text-slate-700 border border-slate-200 shrink-0">
                            {cat === 'FOOD' ? '🍲 Dapur' : (cat === 'DRINK' ? '☕ Bar' : '📦 Kemasan')}
                          </span>
                        </div>

                        {/* Middle Stat Highlight */}
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Terpakai</span>
                            <div className="text-sm font-black text-indigo-700 mt-0.5">
                              {(item.totalQtyUsed || 0).toLocaleString('id-ID')} <span className="text-[10px] font-bold text-slate-500">{item.unit}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Biaya HPP</span>
                            <div className="text-sm font-black text-slate-900 mt-0.5">
                              Rp {(item.totalCost || 0).toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>

                        {/* Sub Metrics (Produksi, Loss, Sisa Stok) */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1 border-t border-slate-200/60">
                          <div className="bg-white/90 p-1.5 rounded-lg border border-slate-200/60">
                            <div className="text-slate-400 font-semibold">Produksi</div>
                            <div className="font-black text-slate-800 mt-0.5 truncate">
                              {(item.productionQty || 0).toLocaleString('id-ID')} {item.unit}
                            </div>
                          </div>
                          <div className="bg-white/90 p-1.5 rounded-lg border border-slate-200/60">
                            <div className="text-slate-400 font-semibold">Loss / Waste</div>
                            <div className={`font-black mt-0.5 truncate ${item.lossQty > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              {item.lossQty > 0 ? `${item.lossQty.toLocaleString('id-ID')} ${item.unit}` : '-'}
                            </div>
                          </div>
                          <div className="bg-white/90 p-1.5 rounded-lg border border-slate-200/60">
                            <div className="text-slate-400 font-semibold">Sisa Stok</div>
                            <div className="font-black text-emerald-700 mt-0.5 truncate">
                              {(item.currentStock || 0).toLocaleString('id-ID')} {item.unit}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP TABLE VIEW (>= md screen) */}
              <div className="hidden md:block overflow-x-auto">
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
                    ) : filteredUsageItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Package className="inline-block mb-2 opacity-40 text-slate-400" size={32} />
                          <p className="font-semibold text-slate-600">Tidak ada data pemakaian bahan baku pada periode ini.</p>
                          <p className="text-[11px] text-slate-400 mt-1">Pastikan sudah ada transaksi POS atau pencatatan stock loss di rentang tanggal yang dipilih.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsageItems.map((item: any, idx: number) => {
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
        );
      })()}

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
                onClick={() => handleOpenLossModal(undefined, 'INGREDIENT')}
                className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Plus size={15} />
                <span>Catat Waste / Loss</span>
              </button>
            </div>
          </div>

          {/* 4 KPI CARDS: 2x2 on Mobile, 4 columns on Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Kerugian */}
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-lg shadow-rose-500/20 flex flex-col justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-rose-100 uppercase tracking-wider">Total Kerugian (Loss)</p>
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-black mt-1">
                  Rp {(lossData?.summary?.totalLossCost || 0).toLocaleString('id-ID')}
                </h3>
              </div>
              <p className="text-[10px] sm:text-xs text-rose-100/80 mt-2">
                {lossData?.summary?.totalLossCount || 0} insiden tercatat
              </p>
            </div>

            {/* Card 2: Waste Ratio */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between gap-1">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Waste Ratio</p>
                  <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-rose-600 mt-1">
                    {Number(lossData?.summary?.wasteRatio || lossData?.summary?.lossPercentage || 0).toFixed(2)}%
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black shrink-0 ${
                  Number(lossData?.summary?.wasteRatio || 0) <= 2.0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  &lt; 2.0% Target
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-2">vs Total Penjualan Kotor</p>
            </div>

            {/* Card 3: Bahan Mentah */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider">Bahan Mentah</p>
                  <h3 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 mt-1">
                    Rp {(lossData?.summary?.rawLossCost || 0).toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-2">
                {lossData?.summary?.rawLossCount || 0} kali insiden bahan
              </p>
            </div>

            {/* Card 4: Porsi Masakan */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-purple-600 uppercase tracking-wider">Porsi Masakan</p>
                  <h3 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 mt-1">
                    Rp {(lossData?.summary?.dishLossCost || 0).toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Utensils size={18} />
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-2">
                {lossData?.summary?.dishLossCount || 0} porsi terbuang
              </p>
            </div>
          </div>

          {/* TOP 5 ITEMS, DISTRIBUSI ALASAN & SOP DARK CARD (3-COLUMN BENTO GRID) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Kolom 1: Top 5 Loss Items */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <ShieldAlert size={18} className="text-rose-600" />
                    Top 5 Item Penyumbang Kerugian
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Paling Berdampak</span>
                </div>

                <div className="space-y-3 mt-3.5">
                  {(!lossData?.topLossItems || lossData.topLossItems.length === 0) ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Belum ada data kerugian pada periode ini 🎉
                    </div>
                  ) : (
                    lossData.topLossItems.map((item: any, idx: number) => (
                      <div key={item.id || idx} className="p-3 bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs text-slate-800 truncate">{item.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                                item.type === 'PRODUCT'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {item.type === 'PRODUCT' ? 'Menu' : 'Bahan'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Total Loss: {item.totalQty.toLocaleString('id-ID')} {item.unit}
                            </div>
                          </div>
                        </div>
                        <div className="font-black text-xs text-rose-600 text-right shrink-0">
                          Rp {item.totalCost.toLocaleString('id-ID')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Kolom 2: Distribusi Alasan Kerugian */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <PieChart size={18} className="text-indigo-600" />
                    Distribusi Alasan Kerugian
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Penyebab Waste</span>
                </div>

                <div className="space-y-3 mt-3.5">
                  {(!lossData?.reasonDistribution || lossData.reasonDistribution.length === 0) ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Belum ada insiden tercatat pada periode ini 🎉
                    </div>
                  ) : (
                    lossData.reasonDistribution.map((r: any, idx: number) => (
                      <div key={idx} className="space-y-1.5 p-2 rounded-xl hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate mr-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                            <span className="truncate">{r.reason}</span>
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">({r.count}x)</span>
                          </span>
                          <div className="text-right shrink-0">
                            <span className="font-black text-slate-900">Rp {r.cost.toLocaleString('id-ID')}</span>
                            <span className="text-[10px] font-bold text-rose-600 ml-1.5">({r.percentage}%)</span>
                          </div>
                        </div>
                        {/* Visual progress bar */}
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(2, r.percentage))}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Kolom 3: SOP Dark Card */}
            <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <ChefHat size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Standar Operasional</span>
                    <h4 className="text-sm font-black text-white leading-tight">
                      Cegah Kebocoran Biaya Dapur
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Setiap kegagalan porsi menu, tumpah, atau bahan mentah kadaluarsa wajib dicatat langsung oleh staf dapur demi akurasi HPP & kepastian stok.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => handleOpenLossModal(undefined, 'INGREDIENT')}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                >
                  <Layers size={15} className="text-amber-600" />
                  <span>+ Catat Bahan Terbuang</span>
                </button>
                <button
                  onClick={() => handleOpenLossModal(undefined, 'PRODUCT')}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 active:scale-98 flex items-center justify-center gap-2"
                >
                  <Utensils size={15} />
                  <span>+ Catat Menu / Porsi Rusak</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[10px] text-slate-400">
                <ShieldAlert size={13} className="text-emerald-400 shrink-0" />
                <span>Setiap laporan diverifikasi otomatis ke pergerakan stok & HPP.</span>
              </div>
            </div>
          </div>

          {/* RIWAYAT LOG KERUGIAN (AUDIT LOG) - RESPONSIVE MOBILE CARDS + DESKTOP TABLE */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-indigo-600" />
                  Riwayat Log Kerusakan & Waste Dapur
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Jejak audit insiden bahan busuk, kadaluarsa, salah masak, atau porsi gagal.</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg self-start sm:self-auto">
                {lossData?.logs?.length || 0} entri riwayat
              </span>
            </div>

            {/* MOBILE CARD VIEW (< md screen) */}
            <div className="block md:hidden space-y-3">
              {lossLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Memuat data riwayat loss...
                </div>
              ) : (!lossData?.logs || lossData.logs.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada log stock loss yang tercatat pada rentang tanggal ini.
                </div>
              ) : (
                lossData.logs.map((l: any) => {
                  const isMenu = l.targetType === 'PRODUCT' || !!l.productName;
                  const itemName = l.productName || l.ingredient?.name || 'Item Unknown';
                  const unitStr = isMenu ? 'porsi' : (l.ingredient?.unit || 'unit');
                  const lossCost = l.cost || (Math.abs(l.change) * (l.ingredient?.buyPrice || 0));

                  return (
                    <div key={l.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold">{new Date(l.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {l.user?.name || 'Staff Dapur'}
                          </span>
                          <button
                            onClick={() => handleDeleteLoss(l.id)}
                            title="Batalkan / Void Loss"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-slate-900">{itemName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              isMenu
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {isMenu ? 'Menu Porsi' : 'Bahan'}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                          {l.reason || 'Rusak'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        <span className="text-slate-600 font-bold">
                          Qty: <span className="text-rose-600 font-black">{Math.abs(l.change).toLocaleString('id-ID')}</span> {unitStr}
                        </span>
                        <span className="font-black text-sm text-rose-700">
                          Rp {lossCost.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {l.notes && (
                        <div className="text-[11px] bg-white p-2 rounded-xl border border-slate-200 text-slate-600 italic">
                          "{l.notes}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (>= md screen) */}
            <div className="hidden md:block overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Item / Target</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th className="py-3 px-3 text-right">Jumlah Rusak</th>
                    <th className="py-3 px-4 text-right">Kerugian (Rp)</th>
                    <th className="py-3 px-4">Alasan</th>
                    <th className="py-3 px-4">Dicatat Oleh & Catatan</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {lossLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Memuat data riwayat loss...
                      </td>
                    </tr>
                  ) : (!lossData?.logs || lossData.logs.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada log stock loss yang tercatat pada rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    lossData.logs.map((l: any) => {
                      const isMenu = l.targetType === 'PRODUCT' || !!l.productName;
                      const itemName = l.productName || l.ingredient?.name || 'Unknown';
                      const unitStr = isMenu ? 'porsi' : (l.ingredient?.unit || '');
                      const lossCost = l.cost || (Math.abs(l.change) * (l.ingredient?.buyPrice || 0));

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                            {new Date(l.createdAt).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            {itemName}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isMenu
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {isMenu ? 'Menu Porsi' : 'Bahan Mentah'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                            {Math.abs(l.change).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{unitStr}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-rose-700 whitespace-nowrap">
                            Rp {lossCost.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {l.reason || 'Rusak'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-600">
                            <div className="font-semibold text-slate-800">{l.user?.name || 'Staff Dapur'}</div>
                            {l.notes && <div className="text-[10px] text-slate-400 italic truncate max-w-xs">{l.notes}</div>}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteLoss(l.id)}
                              title="Batalkan / Void Loss dan Kembalikan Stok"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
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
          TAB: ANALISIS AKTIVITAS & AKUNTABILITAS STAF DAPUR
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'staff_activity' && (
        <div className="space-y-6 animate-fade-in">
          {/* HEADER & FILTER BAR */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ChefHat size={20} className="text-violet-600" />
                  Analisis Aktivitas & Akuntabilitas Staf Dapur
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluasi kinerja tim: distribusi tindakan, klasifikasi kerugian (Human Error vs Basi), dan konsumsi staf.
                </p>
              </div>

              {/* Filter Per Staf */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedStaffUserFilter}
                  onChange={e => {
                    setSelectedStaffUserFilter(e.target.value);
                    fetchStaffActivityAnalytics(staffStartDate, staffEndDate, e.target.value);
                  }}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 w-full sm:w-48"
                >
                  <option value="ALL">Semua Anggota Tim</option>
                  {staffActivityData?.staffList?.map((s: any) => (
                    <option key={s.user.id} value={s.user.id.toString()}>
                      {s.user.name} ({s.user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Date Range Filter */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={14} /> Periode:
              </span>
              {[
                { label: 'Hari Ini', val: 'today' },
                { label: 'Kemarin', val: 'yesterday' },
                { label: '7 Hari Terakhir', val: 'last7' },
                { label: 'Bulan Ini', val: 'this_month' }
              ].map(p => (
                <button
                  key={p.val}
                  onClick={() => setStaffPresetDate(p.val as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    staffDatePreset === p.val
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <input
                  type="date"
                  value={staffStartDate}
                  onChange={e => {
                    setStaffStartDate(e.target.value);
                    setStaffDatePreset('custom');
                    fetchStaffActivityAnalytics(e.target.value, staffEndDate, selectedStaffUserFilter);
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium"
                />
                <span className="text-xs text-slate-400">s/d</span>
                <input
                  type="date"
                  value={staffEndDate}
                  onChange={e => {
                    setStaffEndDate(e.target.value);
                    setStaffDatePreset('custom');
                    fetchStaffActivityAnalytics(staffStartDate, e.target.value, selectedStaffUserFilter);
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium"
                />
              </div>
            </div>
          </div>

          {staffActivityLoading ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center text-slate-400">
              <RefreshCw className="animate-spin inline-block mb-2 text-violet-600" size={24} />
              <p>Menganalisis data aktivitas & kinerja staf dapur...</p>
            </div>
          ) : (
            <>
              {/* TOP 4 KPI CARDS (2 cols on mobile, 4 cols on desktop) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {/* Total Tindakan */}
                <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Aksi Tim</p>
                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
                      {(staffActivityData?.summary?.teamTotalActions || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                      Mutasi, restock, waste
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Activity size={18} className="sm:w-6 sm:h-6" />
                  </div>
                </div>

                {/* Total Kerugian (Loss / Waste) */}
                <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold text-rose-500 uppercase tracking-wider truncate">Total Biaya Waste</p>
                    <h3 className="text-base sm:text-2xl font-black text-rose-600 mt-0.5 truncate">
                      Rp {(staffActivityData?.summary?.teamTotalLossCost || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                      {(staffActivityData?.summary?.teamLossCount || 0)} insiden
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <TrendingDown size={18} className="sm:w-6 sm:h-6" />
                  </div>
                </div>

                {/* Human Error Loss */}
                <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold text-amber-500 uppercase tracking-wider truncate">Salah Masak</p>
                    <h3 className="text-base sm:text-2xl font-black text-amber-600 mt-0.5 truncate">
                      Rp {(staffActivityData?.summary?.teamHumanErrorCost || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[9px] sm:text-[11px] text-amber-700 font-bold mt-0.5 truncate">
                      {staffActivityData?.summary?.teamLossCompositionPercentages?.humanError || 0}% waste
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Flame size={18} className="sm:w-6 sm:h-6" />
                  </div>
                </div>

                {/* Staff Meal / Konsumsi Karyawan */}
                <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider truncate">Makan Karyawan</p>
                    <h3 className="text-base sm:text-2xl font-black text-emerald-700 mt-0.5 truncate">
                      Rp {(staffActivityData?.summary?.teamStaffMealCost || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[9px] sm:text-[11px] text-emerald-600 font-bold mt-0.5 truncate">
                      Konsumsi resmi
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Utensils size={18} className="sm:w-6 sm:h-6" />
                  </div>
                </div>
              </div>

              {/* DUA GRAFIK VISUAL BREAKDOWN & PERSENTASE */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* GRAFIK 1: KOMPOSISI DISTRIBUSI TINDAKAN TIM */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <PieChart size={18} className="text-violet-600" />
                        Distribusi Tindakan Operasional Tim (%)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Persentase fokus jenis interaksi stok yang dilakukan staf.</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* Restock Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                          📥 Restock & Pasokan Masuk
                        </span>
                        <span className="text-indigo-600">
                          {staffActivityData?.summary?.teamActivityPercentages?.restock || 0}% ({staffActivityData?.summary?.teamRestockCount || 0} aksi)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, staffActivityData?.summary?.teamActivityPercentages?.restock || 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Penyesuaian & Opname Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
                          🔧 Penyesuaian & Opname Fisik
                        </span>
                        <span className="text-sky-600">
                          {staffActivityData?.summary?.teamActivityPercentages?.adjustment || 0}% ({staffActivityData?.summary?.teamAdjustmentCount || 0} aksi)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-sky-500 to-sky-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, staffActivityData?.summary?.teamActivityPercentages?.adjustment || 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Waste / Rusak Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                          ⚠️ Catat Kerusakan / Stock Loss
                        </span>
                        <span className="text-rose-600">
                          {staffActivityData?.summary?.teamActivityPercentages?.loss || 0}% ({staffActivityData?.summary?.teamLossCount || 0} aksi)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, staffActivityData?.summary?.teamActivityPercentages?.loss || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRAFIK 2: BREAKDOWN KLASIFIKASI KERUGIAN */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <BarChart3 size={18} className="text-rose-600" />
                        Breakdown Faktor Kerugian (Waste vs Konsumsi)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Membedakan kerugian kelalaian manusia, kadaluarsa, dan makan staf.</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* Human Error Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                          🍳 Human Error (Gosong / Tumpah / Salah Olah)
                        </span>
                        <span className="text-rose-600">
                          {staffActivityData?.summary?.teamLossCompositionPercentages?.humanError || 0}% (Rp {(staffActivityData?.summary?.teamHumanErrorCost || 0).toLocaleString('id-ID')})
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, staffActivityData?.summary?.teamLossCompositionPercentages?.humanError || 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Spoilage / Expired Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                          🥀 Basi / Kadaluarsa Alamiah
                        </span>
                        <span className="text-amber-600">
                          {staffActivityData?.summary?.teamLossCompositionPercentages?.spoilage || 0}% (Rp {(staffActivityData?.summary?.teamSpoilageCost || 0).toLocaleString('id-ID')})
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, staffActivityData?.summary?.teamLossCompositionPercentages?.spoilage || 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Staff Meal Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          🍱 Konsumsi Resmi Staf (Staff Meal)
                        </span>
                        <span className="text-emerald-700">
                          {staffActivityData?.summary?.teamLossCompositionPercentages?.staffMeal || 0}% (Rp {(staffActivityData?.summary?.teamStaffMealCost || 0).toLocaleString('id-ID')})
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, staffActivityData?.summary?.teamLossCompositionPercentages?.staffMeal || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TABEL LEADERBOARD & AKUNTABILITAS PER STAF */}
              <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-3 sm:space-y-4">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Users size={18} className="text-indigo-600" />
                      Rincian Aktivitas & Akuntabilitas Per Anggota Tim
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Evaluasi objektif kontribusi restock, pemeliharaan stok, dan beban kerugian per individu.
                    </p>
                  </div>
                </div>

                {staffActivityData?.staffList?.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-medium">
                    Belum ada rekaman aktivitas mutasi stok oleh staf pada periode ini.
                  </div>
                ) : (
                  <>
                    {/* MOBILE CARD VIEW (< md) */}
                    <div className="md:hidden divide-y divide-slate-100 space-y-1">
                      {staffActivityData?.staffList?.map((s: any) => {
                        const isHighLoss = s.teamLossSharePercentage > 40 && s.totalLossCost > 50000;
                        const isZeroLoss = s.totalLossCost === 0;

                        return (
                          <div key={s.user.id} className="p-3 bg-white hover:bg-slate-50/50 rounded-xl space-y-2.5 transition-colors">
                            {/* Header: User, Role, Status */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-black shrink-0">
                                  {s.user.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">{s.user.name}</div>
                                  <div className="text-[10px] text-slate-400 font-normal font-mono">@{s.user.username}</div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  s.user.role === 'Dapur' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  s.user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {s.user.role}
                                </span>
                                {isZeroLoss ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <Award size={10} /> 0 Loss
                                  </span>
                                ) : isHighLoss ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                    <Flame size={10} /> Review Resep
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                    <UserCheck size={10} /> Wajar
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 3 Metrics Row */}
                            <div className="grid grid-cols-3 gap-1.5 text-center">
                              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Aksi</span>
                                <span className="text-xs font-black text-slate-900">{s.totalActions}</span>
                              </div>
                              <div className="p-2 bg-rose-50/60 rounded-xl border border-rose-100">
                                <span className="text-[9px] font-bold text-rose-500 block uppercase">Total Loss</span>
                                <span className="text-xs font-black text-rose-600 truncate block">Rp {s.totalLossCost.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Beban Tim</span>
                                <span className="text-xs font-black text-slate-700">{s.teamLossSharePercentage}%</span>
                              </div>
                            </div>

                            {/* Activity Distribution Pills */}
                            <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px]">
                              <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Distribusi:</span>
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold">
                                📥 Restock {s.activityPercentages?.restock || 0}%
                              </span>
                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded font-bold">
                                🔧 Opname {s.activityPercentages?.adjustment || 0}%
                              </span>
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">
                                ⚠️ Loss {s.activityPercentages?.loss || 0}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* DESKTOP TABLE VIEW (>= md) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase">
                          <tr>
                            <th className="py-3 px-4">Nama Staf</th>
                            <th className="py-3 px-4 text-center">Role / Peran</th>
                            <th className="py-3 px-4 text-right">Total Aksi</th>
                            <th className="py-3 px-4">Distribusi Aktivitas (%)</th>
                            <th className="py-3 px-4 text-right">Total Loss (Rp)</th>
                            <th className="py-3 px-4 text-center">Beban Tim (%)</th>
                            <th className="py-3 px-4 text-center">Status KPI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {staffActivityData?.staffList?.map((s: any) => {
                            const isHighLoss = s.teamLossSharePercentage > 40 && s.totalLossCost > 50000;
                            const isZeroLoss = s.totalLossCost === 0;

                            return (
                              <tr key={s.user.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-black shrink-0">
                                    {s.user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div>{s.user.name}</div>
                                    <div className="text-[10px] text-slate-400 font-normal">@{s.user.username}</div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    s.user.role === 'Dapur' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    s.user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {s.user.role}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-black text-slate-900">
                                  {s.totalActions}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold" title="Restock">
                                      📥 {s.activityPercentages?.restock || 0}%
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded font-bold" title="Opname / Koreksi">
                                      🔧 {s.activityPercentages?.adjustment || 0}%
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-bold" title="Loss / Rusak">
                                      ⚠️ {s.activityPercentages?.loss || 0}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-black text-rose-600">
                                  Rp {s.totalLossCost.toLocaleString('id-ID')}
                                </td>
                                <td className="py-3 px-4 text-center font-bold text-slate-700">
                                  {s.teamLossSharePercentage}%
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isZeroLoss ? (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1 mx-auto w-max">
                                      <Award size={12} /> Sangat Hemat (0 Loss)
                                    </span>
                                  ) : isHighLoss ? (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center gap-1 mx-auto w-max">
                                      <Flame size={12} /> Perlu Review Resep
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center gap-1 mx-auto w-max">
                                      <UserCheck size={12} /> Normal / Wajar
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: KARTU STOK & ALUR DISTRIBUSI
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'movements' && (() => {
        const filteredMovements = movements.filter((m: any) => {
          if (!movementSearch.trim()) return true;
          const q = movementSearch.toLowerCase();
          return (
            m.ingredient?.name?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q) ||
            m.referenceId?.toLowerCase().includes(q) ||
            m.user?.name?.toLowerCase().includes(q) ||
            m.type?.toLowerCase().includes(q)
          );
        });

        // Quick KPI calculations
        const restockCount = movements.filter(m => m.type === 'Restock' || m.change > 0).length;
        const produksiCount = movements.filter(m => m.type === 'Produksi').length;
        const lossCount = movements.filter(m => m.type === 'Rusak').length;
        const adjustCount = movements.filter(m => m.type === 'Penyesuaian' || m.type === 'Stock Opname').length;

        const handleOpenAdjustFromMovements = () => {
          if (movementIngredientFilter !== 'ALL') {
            const ing = ingredients.find(i => i.id.toString() === movementIngredientFilter);
            if (ing) {
              setAdjustModal({ open: true, ingredient: ing });
              return;
            }
          }
          setShowAdjustPickerModal(true);
        };

        return (
          <div className="space-y-3.5 sm:space-y-6 animate-fade-in">
            {/* TOOLBAR HEADER */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <History size={18} className="text-emerald-600 shrink-0" />
                    Kartu Stok Digital & Alur Mutasi
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Jejak lengkap keluar/masuk stok: Restock PO, Produksi POS, Stock Loss, dan Opname.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={handleOpenAdjustFromMovements}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5 shrink-0"
                  >
                    <Plus size={14} />
                    <span>Sesuaikan Stok</span>
                  </button>

                  <button
                    onClick={() => fetchMovements()}
                    className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shrink-0"
                    title="Perbarui Data Mutasi"
                  >
                    <RefreshCw size={14} className={movementsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* SEARCH & MUTATION TYPE PILLS */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                <div className="relative w-full md:w-72 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={movementSearch}
                    onChange={e => setMovementSearch(e.target.value)}
                    placeholder="Cari bahan, keterangan, ref, petugas..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Mutation Type Quick Pills (Scrollable horizontal strip) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  {[
                    { id: 'ALL', label: 'Semua Mutasi' },
                    { id: 'Produksi', label: '🍳 Produksi POS' },
                    { id: 'Restock', label: '📥 Restock Masuk' },
                    { id: 'Rusak', label: '🗑️ Stock Loss' },
                    { id: 'Penyesuaian', label: '🔧 Penyesuaian' },
                    { id: 'Stock Opname', label: '⚖️ Opname Fisik' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setMovementTypeFilter(t.id);
                        fetchMovements(movementStartDate, movementEndDate, t.id, movementIngredientFilter);
                      }}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        movementTypeFilter === t.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* DATE PRESETS & INGREDIENT FILTER ROW */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                {/* Date Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mr-0.5 shrink-0">Waktu:</span>
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'today', label: 'Hari Ini' },
                    { id: 'yesterday', label: 'Kemarin' },
                    { id: 'last7', label: '7 Hari' },
                    { id: 'this_month', label: 'Bulan Ini' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setMovementPresetDate(p.id as any)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        movementPreset === p.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Specific Ingredient Picker & Date Pickers */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <select
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 outline-none max-w-[180px] sm:max-w-xs truncate"
                    value={movementIngredientFilter}
                    onChange={e => {
                      setMovementIngredientFilter(e.target.value);
                      fetchMovements(movementStartDate, movementEndDate, movementTypeFilter, e.target.value);
                    }}
                  >
                    <option value="ALL">Semua Bahan Baku ({ingredients.length})</option>
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id.toString()}>{i.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs">
                    <span className="text-[9px] font-bold text-slate-400">Dari:</span>
                    <input
                      type="date"
                      value={movementStartDate}
                      onChange={e => {
                        setMovementPreset('custom' as any);
                        setMovementStartDate(e.target.value);
                        fetchMovements(e.target.value, movementEndDate, movementTypeFilter, movementIngredientFilter);
                      }}
                      className="bg-transparent border-none outline-none text-[11px] sm:text-xs font-bold text-slate-800"
                    />
                    <span className="text-[9px] font-bold text-slate-400">s/d:</span>
                    <input
                      type="date"
                      value={movementEndDate}
                      onChange={e => {
                        setMovementPreset('custom' as any);
                        setMovementEndDate(e.target.value);
                        fetchMovements(movementStartDate, e.target.value, movementTypeFilter, movementIngredientFilter);
                      }}
                      className="bg-transparent border-none outline-none text-[11px] sm:text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* KPI METRIC CARDS (2x2 on Mobile, 4 Columns on Desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Card 1: Masuk / Restock */}
              <div className="p-3 sm:p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider">Restock Masuk</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ArrowDownRight size={16} />
                  </div>
                </div>
                <div className="mt-1">
                  <h4 className="text-base sm:text-2xl font-black text-emerald-950">
                    {restockCount} <span className="text-xs font-bold text-emerald-700">Entri</span>
                  </h4>
                  <p className="text-[10px] text-emerald-700/80 mt-0.5">Penambahan inventaris</p>
                </div>
              </div>

              {/* Card 2: Produksi POS */}
              <div className="p-3 sm:p-4 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-indigo-800 uppercase tracking-wider">Produksi POS</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Utensils size={15} />
                  </div>
                </div>
                <div className="mt-1">
                  <h4 className="text-base sm:text-2xl font-black text-indigo-950">
                    {produksiCount} <span className="text-xs font-bold text-indigo-700">Order</span>
                  </h4>
                  <p className="text-[10px] text-indigo-700/80 mt-0.5">Potong resep otomatis</p>
                </div>
              </div>

              {/* Card 3: Stock Loss / Rusak */}
              <div className="p-3 sm:p-4 bg-rose-50/80 border border-rose-200/80 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider">Waste / Loss</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <TrendingDown size={15} />
                  </div>
                </div>
                <div className="mt-1">
                  <h4 className="text-base sm:text-2xl font-black text-rose-600">
                    {lossCount} <span className="text-xs font-bold text-rose-500">Insiden</span>
                  </h4>
                  <p className="text-[10px] text-rose-600/80 mt-0.5">Bahan rusak / tumpah</p>
                </div>
              </div>

              {/* Card 4: Penyesuaian Koreksi */}
              <div className="p-3 sm:p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-amber-800 uppercase tracking-wider">Penyesuaian</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <ClipboardCheck size={15} />
                  </div>
                </div>
                <div className="mt-1">
                  <h4 className="text-base sm:text-2xl font-black text-amber-950">
                    {adjustCount} <span className="text-xs font-bold text-amber-700">Koreksi</span>
                  </h4>
                  <p className="text-[10px] text-amber-700/80 mt-0.5">Opname / adjust staf</p>
                </div>
              </div>
            </div>

            {/* MUTATION RECORDS: MOBILE CARDS & DESKTOP TABLE */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History size={16} className="text-emerald-600" />
                  Log Mutasi Stok Terverifikasi
                </h4>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  {filteredMovements.length} Log Mutasi
                </span>
              </div>

              {/* MOBILE CARDS VIEW (< md screen) */}
              <div className="block md:hidden space-y-2.5">
                {movementsLoading ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    <RefreshCw className="animate-spin inline-block mb-2 text-emerald-600" size={20} />
                    <p>Memuat kartu stok mutasi...</p>
                  </div>
                ) : filteredMovements.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl p-4">
                    <Package className="mx-auto mb-1.5 opacity-40 text-slate-400" size={28} />
                    <p className="font-bold text-slate-600">Tidak ada riwayat mutasi yang cocok.</p>
                  </div>
                ) : (
                  filteredMovements.map((m: any) => {
                    const isPositive = m.change > 0;
                    const ingObj = ingredients.find(i => i.id === m.ingredient?.id) || m.ingredient;
                    const currentStockVal = ingObj?.stock ?? m.ingredient?.stock;

                    return (
                      <div key={m.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold">
                            {new Date(m.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {m.user?.name || 'Sistem POS'}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h5 className="font-black text-sm text-slate-900 truncate">{m.ingredient?.name}</h5>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                                m.type === 'Produksi' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                (m.type === 'Restock' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                (m.type === 'Rusak' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 
                                (m.type === 'Penyesuaian' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200')))
                              }`}>
                                {m.type === 'Produksi' && '🍳 Produksi POS'}
                                {m.type === 'Restock' && '📥 Restock Masuk'}
                                {m.type === 'Rusak' && '🗑️ Stock Loss'}
                                {m.type === 'Stock Opname' && '⚖️ Opname Fisik'}
                                {m.type === 'Penyesuaian' && '🔧 Penyesuaian'}
                                {!['Produksi', 'Restock', 'Rusak', 'Stock Opname', 'Penyesuaian'].includes(m.type) && m.type}
                              </span>
                            </div>
                          </div>

                          <div className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                            isPositive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {isPositive ? `+${m.change.toLocaleString('id-ID')}` : m.change.toLocaleString('id-ID')} {m.ingredient?.unit}
                          </div>
                        </div>

                        {m.description && (
                          <div className="text-[11px] bg-white p-2 rounded-xl border border-slate-200 text-slate-600">
                            {m.description}
                            {m.referenceId && (
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Ref: {m.referenceId}</span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                          <span className="text-[10px] font-semibold text-slate-400">
                            Stok Fisik Saat Ini: <strong className="text-slate-800 font-bold">{currentStockVal !== undefined ? Number(currentStockVal).toLocaleString('id-ID') : '-'} {m.ingredient?.unit}</strong>
                          </span>
                          <button
                            onClick={() => {
                              if (ingObj) setAdjustModal({ open: true, ingredient: ingObj });
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                          >
                            <span>Sesuaikan Stok</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP TABLE VIEW (>= md screen) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase sticky top-0">
                    <tr>
                      <th className="py-3.5 px-4">Waktu Mutasi</th>
                      <th className="py-3.5 px-4">Bahan Baku</th>
                      <th className="py-3.5 px-3">Tipe Alur</th>
                      <th className="py-3.5 px-3 text-right">Perubahan Qty</th>
                      <th className="py-3.5 px-4 text-right">Stok Riil Sekarang</th>
                      <th className="py-3.5 px-4">Keterangan / Referensi</th>
                      <th className="py-3.5 px-4">Petugas</th>
                      <th className="py-3.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {movementsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw className="animate-spin inline-block mb-2 text-indigo-600" size={24} />
                          <p>Memuat kartu stok mutasi...</p>
                        </td>
                      </tr>
                    ) : filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Belum ada riwayat mutasi yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((m: any) => {
                        const isPositive = m.change > 0;
                        const ingObj = ingredients.find(i => i.id === m.ingredient?.id) || m.ingredient;
                        const currentStockVal = ingObj?.stock ?? m.ingredient?.stock;

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString('id-ID')}
                            </td>

                            <td className="py-3.5 px-4 font-black text-slate-900">
                              {m.ingredient?.name}
                            </td>

                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                m.type === 'Produksi' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                (m.type === 'Restock' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                (m.type === 'Rusak' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                                (m.type === 'Penyesuaian' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200')))
                              }`}>
                                {m.type === 'Produksi' && '🍳 Produksi POS'}
                                {m.type === 'Restock' && '📥 Restock Masuk'}
                                {m.type === 'Rusak' && '🗑️ Stock Loss'}
                                {m.type === 'Stock Opname' && '⚖️ Opname Fisik'}
                                {m.type === 'Penyesuaian' && '🔧 Penyesuaian'}
                                {!['Produksi', 'Restock', 'Rusak', 'Stock Opname', 'Penyesuaian'].includes(m.type) && m.type}
                              </span>
                            </td>

                            <td className={`py-3.5 px-3 text-right font-black whitespace-nowrap ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? `+${m.change.toLocaleString('id-ID')}` : m.change.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">{m.ingredient?.unit}</span>
                            </td>

                            <td className="py-3.5 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                              {currentStockVal !== undefined ? Number(currentStockVal).toLocaleString('id-ID') : '-'} <span className="text-[10px] text-slate-400">{m.ingredient?.unit}</span>
                            </td>

                            <td className="py-3.5 px-4 text-slate-600">
                              <div className="font-semibold text-xs text-slate-800">{m.description || '-'}</div>
                              {m.referenceId && (
                                <div className="text-[10px] font-mono text-slate-400">Ref: {m.referenceId}</div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-slate-600 font-bold text-[11px] whitespace-nowrap">
                              {m.user?.name || 'Sistem'}
                            </td>

                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  if (ingObj) setAdjustModal({ open: true, ingredient: ingObj });
                                }}
                                title="Sesuaikan Stok Bahan Ini"
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs"
                              >
                                Sesuaikan
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QUICK INGREDIENT PICKER MODAL FOR STAFF ADJUSTMENT */}
            {showAdjustPickerModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up space-y-4 p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                        <Plus size={16} className="text-emerald-600" />
                        Pilih Bahan untuk Disesuaikan
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Pilih bahan baku yang ingin disesuaikan stok fisiknya.</p>
                    </div>
                    <button
                      onClick={() => setShowAdjustPickerModal(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Ketik nama bahan baku..."
                      autoFocus
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-500"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {ingredients
                      .filter(i => !pickerSearch.trim() || i.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                      .map(ing => (
                        <button
                          key={ing.id}
                          onClick={() => {
                            setShowAdjustPickerModal(false);
                            setPickerSearch('');
                            setAdjustModal({ open: true, ingredient: ing });
                          }}
                          className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl text-left flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="font-black text-xs text-slate-800 group-hover:text-emerald-950 block">{ing.name}</span>
                            <span className="text-[10px] text-slate-400">{ing.category || 'FOOD'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-900 group-hover:text-emerald-700 block">
                              {ing.stock.toLocaleString('id-ID')} {ing.unit}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">Stok Saat Ini</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

          {/* SHOPPING SUMMARY CARDS (2 cols on mobile, 3 cols on desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-600 to-teal-700 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl text-white shadow-md shadow-emerald-600/20">
              <p className="text-[10px] sm:text-xs font-bold text-emerald-100 uppercase tracking-wider">Estimasi Modal Belanja ({shoppingHorizonDays} Hari)</p>
              <h3 className="text-xl sm:text-2xl font-black mt-0.5 sm:mt-1">
                Rp {(shoppingData?.summary?.totalRestockCost || 0).toLocaleString('id-ID')}
              </h3>
              <p className="text-[10px] sm:text-xs text-emerald-100/80 mt-0.5">
                Untuk mengembalikan seluruh stok menipis ke batas aman optimal {shoppingHorizonDays} hari ke depan.
              </p>
            </div>

            <div className="col-span-1 bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider truncate">Menipis / Kritis</p>
                <h3 className="text-lg sm:text-2xl font-black text-amber-600 mt-0.5">
                  {shoppingData?.summary?.totalLowStockCount || 0}
                </h3>
                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">
                  {shoppingData?.summary?.totalCriticalCount || 0} Sold Out
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="sm:w-6 sm:h-6" />
              </div>
            </div>

            <div className="col-span-1 bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider truncate">Supplier Terkait</p>
                <h3 className="text-lg sm:text-2xl font-black text-indigo-600 mt-0.5">
                  {shoppingData?.supplierGrouping?.length || 0}
                </h3>
                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate">Vendor siap PO</p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Truck size={18} className="sm:w-6 sm:h-6" />
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
      {activeTab === 'forecast' && (() => {
        const readyCount = forecastList.filter(p => p.maxPortions > 15).length;
        const lowCount = forecastList.filter(p => p.maxPortions > 0 && p.maxPortions <= 15).length;
        const outCount = forecastList.filter(p => p.maxPortions <= 0).length;
        const totalCapacity = forecastList.reduce((sum, p) => sum + (p.maxPortions || 0), 0);

        const filteredForecastList = forecastList.filter(prod => {
          const matchesSearch = prod.productName.toLowerCase().includes(forecastSearch.toLowerCase()) ||
            prod.categoryName.toLowerCase().includes(forecastSearch.toLowerCase());
          if (!matchesSearch) return false;

          if (forecastStatusFilter === 'READY') return prod.maxPortions > 15;
          if (forecastStatusFilter === 'LOW') return prod.maxPortions > 0 && prod.maxPortions <= 15;
          if (forecastStatusFilter === 'OUT') return prod.maxPortions <= 0;
          return true;
        });

        return (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* TOOLBAR: SEARCH & STATUS PILLS & TOTAL COUNTER */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Utensils size={20} className="text-amber-600" />
                    Analisis Kapasitas Produksi Menu & Bottleneck (BOM)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Memprediksi berapa porsi menu ramen & minuman yang dapat disajikan dari stok bahan saat ini.</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={forecastSearch}
                      onChange={e => setForecastSearch(e.target.value)}
                      placeholder="Cari nama menu..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-amber-500 outline-none transition-colors"
                    />
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-black shrink-0 shadow-sm">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Kapasitas:</span>
                    <span className="text-amber-400">{totalCapacity.toLocaleString('id-ID')} Porsi</span>
                  </div>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setForecastStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      forecastStatusFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Semua ({forecastList.length})
                  </button>

                  <button
                    onClick={() => setForecastStatusFilter('READY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      forecastStatusFilter === 'READY'
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Siap Saji ({readyCount})</span>
                  </button>

                  <button
                    onClick={() => setForecastStatusFilter('LOW')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      forecastStatusFilter === 'LOW'
                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                        : 'bg-amber-50/70 text-amber-800 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Menipis ({lowCount})</span>
                  </button>

                  <button
                    onClick={() => setForecastStatusFilter('OUT')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      forecastStatusFilter === 'OUT'
                        ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                        : 'bg-rose-50/70 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Habis ({outCount})</span>
                  </button>
                </div>

                <div className="sm:hidden text-xs font-bold text-slate-600">
                  Total: <span className="font-black text-slate-900">{totalCapacity} Porsi</span>
                </div>
              </div>
            </div>

            {/* PRODUCT BOM CARDS GRID (3 COLUMNS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {forecastLoading ? (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <RefreshCw className="animate-spin inline-block mb-3 text-amber-500" size={28} />
                  <p className="text-xs font-bold">Menganalisis kapasitas menu dari resep BOM...</p>
                </div>
              ) : filteredForecastList.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8">
                  <Utensils className="mx-auto mb-2 text-slate-300" size={32} />
                  <p className="font-bold text-sm text-slate-600">Tidak ada menu yang sesuai kriteria filter.</p>
                  <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau status filter.</p>
                </div>
              ) : (
                filteredForecastList.map(prod => {
                  const isExpanded = expandedForecastId === prod.productId;
                  const isOut = prod.maxPortions <= 0;
                  const isLow = prod.maxPortions > 0 && prod.maxPortions <= 15;

                  return (
                    <div
                      key={prod.productId}
                      className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3.5"
                    >
                      <div className="space-y-3">
                        {/* Top Row: Thumbnail + Category & Sell Price + Status Pill */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                              {prod.imageUrl ? (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.productName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Utensils size={20} className="text-amber-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 tracking-wide uppercase">
                                  {prod.categoryName || 'MENU'}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500">
                                  Jual: Rp {(prod.sellPrice || 0).toLocaleString('id-ID')}
                                </span>
                              </div>
                              <h4 className="font-black text-sm text-slate-900 mt-0.5 truncate" title={prod.productName}>
                                {prod.productName}
                              </h4>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            {isOut ? 'Habis' : isLow ? 'Menipis' : 'Siap Saji'}
                          </span>
                        </div>

                        {/* Capacity & HPP Box */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kapasitas Saji</div>
                            <div className="text-2xl font-black text-slate-900 mt-0.5 flex items-baseline gap-1">
                              {prod.maxPortions.toLocaleString('id-ID')}
                              <span className="text-xs font-bold text-slate-500">Porsi</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HPP / Porsi</div>
                            <div className="text-xs font-black text-slate-800 mt-0.5">
                              Rp {(prod.buyPrice || 0).toLocaleString('id-ID')}
                            </div>
                            {prod.profitMargin !== undefined && prod.profitMargin > 0 && (
                              <span className="inline-block mt-0.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                +{prod.profitMargin}% Margin
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottleneck Alert or Optimal Badge */}
                        {prod.bottleneck ? (
                          <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 space-y-0.5">
                            <div className="font-black flex items-center gap-1.5 text-amber-800">
                              <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                              Bahan Pembatas (Bottleneck):
                            </div>
                            <p className="font-semibold text-amber-950 text-[11px] leading-tight">
                              {prod.bottleneck.ingredientName} tersisa {prod.bottleneck.currentStock} {prod.bottleneck.unit} (hanya cukup {prod.bottleneck.maxPortions} porsi).
                            </p>
                          </div>
                        ) : prod.maxPortions > 0 ? (
                          <div className="p-2.5 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            <span className="font-semibold">Seluruh stok bahan baku mencukupi dengan optimal.</span>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-[11px] text-rose-800 flex items-center gap-1.5">
                            <XCircle size={13} className="text-rose-600 shrink-0" />
                            <span className="font-semibold">Bahan baku habis, menu tidak dapat disajikan.</span>
                          </div>
                        )}
                      </div>

                      {/* Recipe Accordion */}
                      {prod.recipeDetails && prod.recipeDetails.length > 0 && (
                        <div className="pt-1">
                          <button
                            onClick={() => setExpandedForecastId(isExpanded ? null : prod.productId)}
                            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span>{isExpanded ? 'Sembunyikan Komposisi Bahan' : `Komposisi Resep (${prod.recipeDetails.length} Bahan)`}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 space-y-1.5 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto pr-1">
                              {prod.recipeDetails.map(r => (
                                <div key={r.ingredientId} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 rounded-xl border border-slate-100/80">
                                  <span className="font-bold text-slate-800 truncate mr-2">{r.ingredientName}</span>
                                  <span className="text-slate-500 whitespace-nowrap text-[10px]">
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
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: AUDIT STOCK OPNAME FISIK
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'opname' && (
        <div className="space-y-3.5 sm:space-y-6 animate-fade-in">
          <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-3 sm:pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-blue-600 shrink-0" />
                  Formulir Audit Stock Opname Fisik
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Cocokkan stok fisik di gudang/chiller dengan stok sistem untuk auto-adjust selisih.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportOpnamePDF}
                  className="flex-1 sm:flex-none px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                  title="Cetak Berita Acara Stock Opname (PDF)"
                >
                  <Printer size={14} />
                  <span>Cetak PDF</span>
                </button>
                <input
                  type="text"
                  value={auditorName}
                  onChange={e => setAuditorName(e.target.value)}
                  placeholder="Nama Auditor"
                  className="flex-1 sm:flex-none w-28 sm:w-36 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
                <button
                  onClick={handleSubmitOpname}
                  disabled={submittingOpname}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <CheckCircle2 size={15} />
                  <span>{submittingOpname ? 'Menyimpan...' : 'Simpan & Sinkronkan Opname'}</span>
                </button>
              </div>
            </div>

            {/* MOBILE CARD VIEW (< md) */}
            <div className="md:hidden divide-y divide-slate-100 max-h-[600px] overflow-y-auto space-y-1">
              {opnameItems.map(item => {
                const diff = Number(item.physicalStock) - item.systemStock;
                const isMiss = Math.abs(diff) > 0.001;

                return (
                  <div key={item.ingredientId} className={`p-2.5 space-y-2 rounded-xl transition-colors ${isMiss ? 'bg-amber-50/50' : 'bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 text-xs truncate">{item.name}</div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        diff < 0 ? 'bg-rose-50 text-rose-600 border border-rose-200' : (diff > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500')
                      }`}>
                        {diff !== 0 ? (diff > 0 ? `+${diff.toLocaleString('id-ID')}` : diff.toLocaleString('id-ID')) : '0'} {item.unit}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Stok Sistem</span>
                        <span className="text-xs font-black text-slate-700">{item.systemStock.toLocaleString('id-ID')} {item.unit}</span>
                      </div>
                      <div className="p-1.5 bg-blue-50/60 rounded-lg border border-blue-100 text-center">
                        <span className="text-[9px] font-bold text-blue-600 block uppercase">Fisik Riil</span>
                        <input
                          type="number"
                          step="any"
                          value={item.physicalStock}
                          onChange={e => handleOpnameChange(item.ingredientId, e.target.value)}
                          className="w-full mt-0.5 px-2 py-0.5 bg-white border border-blue-200 rounded text-center text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={item.reason}
                        onChange={e => handleOpnameReasonChange(item.ingredientId, e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Susut/Trimming">Susut / Trimming</option>
                        <option value="Busuk/Rusak">Busuk / Rusak</option>
                        <option value="Selisih Timbang">Selisih Timbang</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => handleOpnameNotesChange(item.ingredientId, e.target.value)}
                        placeholder="Catatan..."
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (>= md) */}
            <div className="hidden md:block overflow-x-auto max-h-[600px]">
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
          TAB 9: AUDIT EFISIENSI & TINGKAT KEBERHASILAN (YIELD & VARIANCE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'yield' && (
        <div className="space-y-6 animate-fade-in">
          {/* HEADER & COMPREHENSIVE FILTER BAR */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Target size={22} className="text-violet-600" />
                  Audit Tingkat Keberhasilan Porsi (Yield & Variance)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Membandingkan bahan baku yang terpakai di dapur vs target porsi standar resep (BOM) dan penjualan riil kasir.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportYieldPDF}
                  disabled={generatingPdf}
                  className="px-3.5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-violet-500/20 active:scale-95"
                  title="Cetak Laporan Audit Yield & Variance (PDF)"
                >
                  <Printer size={15} />
                  <span>{generatingPdf ? 'Memproses...' : 'Cetak Laporan PDF'}</span>
                </button>
                <button
                  onClick={() => fetchYieldAnalytics()}
                  disabled={yieldLoading}
                  className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all active:scale-95"
                  title="Segarkan Data"
                >
                  <RefreshCw size={15} className={yieldLoading ? 'animate-spin text-violet-600' : ''} />
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              {/* Filter 1: Horizon Preset */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Rentang Waktu</label>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                  {[
                    { id: 'today', label: 'Hari Ini' },
                    { id: 'yesterday', label: 'Kemarin' },
                    { id: 'last7', label: '7 Hari' },
                    { id: 'this_month', label: 'Bulan Ini' },
                    { id: 'custom', label: 'Kustom' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleYieldPresetChange(p.id as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        yieldPreset === p.id 
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20' 
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter 2: Custom Date if active */}
              {yieldPreset === 'custom' ? (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Pilih Tanggal</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={yieldStartDate}
                      onChange={e => {
                        setYieldStartDate(e.target.value);
                        fetchYieldAnalytics(e.target.value, yieldEndDate);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                      type="date"
                      value={yieldEndDate}
                      onChange={e => {
                        setYieldEndDate(e.target.value);
                        fetchYieldAnalytics(yieldStartDate, e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                    />
                  </div>
                </div>
              ) : (
                /* Filter 2 Alternate: Scope Cakupan */
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Cakupan Bahan</label>
                  <select
                    value={yieldScopeFilter}
                    onChange={e => {
                      setYieldScopeFilter(e.target.value as any);
                      fetchYieldAnalytics(undefined, undefined, undefined, e.target.value);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-violet-500"
                  >
                    <option value="ALL">📋 Semua Bahan (Termasuk Pelengkap & Garnish)</option>
                    <option value="KEY_ONLY">⚡ Bahan Utama Saja (High Cost & Kunci Porsi)</option>
                  </select>
                </div>
              )}

              {/* Filter 3: Category Area */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Area / Kategori</label>
                <select
                  value={yieldCategoryFilter}
                  onChange={e => {
                    setYieldCategoryFilter(e.target.value as any);
                    fetchYieldAnalytics(undefined, undefined, e.target.value);
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-violet-500"
                >
                  <option value="ALL">🌐 Semua Area (Dapur & Bar)</option>
                  <option value="FOOD">🍲 Dapur (Makanan, Daging & Sayur)</option>
                  <option value="DRINK">☕ Bar (Kopi, Susu, Sirup Minuman)</option>
                  <option value="PACKAGING">📦 Kemasan & Cup</option>
                </select>
              </div>

              {/* Filter 4: Search Input */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Cari Bahan</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ketik nama bahan baku..."
                    value={yieldSearch}
                    onChange={e => setYieldSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4 SUMMARY KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Skor Efisiensi Toko */}
            <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-lg shadow-indigo-600/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Skor Efisiensi Porsi Toko</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white backdrop-blur-sm">
                    {yieldData?.summary?.storeEfficiencyRate >= 95 ? 'Optimal' : (yieldData?.summary?.storeEfficiencyRate >= 90 ? 'Toleransi' : 'Perlu Evaluasi')}
                  </span>
                </div>
                <h3 className="text-3xl font-black mt-2">
                  {yieldData?.summary?.storeEfficiencyRate || 100}%
                </h3>
                <p className="text-[11px] text-indigo-100/80 mt-1">
                  Akurasi konversi bahan ke menu terjual berdasarkan pembobotan nilai modal (Cost-Weighted).
                </p>
              </div>

              {/* Progress Bar Visual */}
              <div className="mt-4 pt-3 border-t border-white/15">
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-500" 
                    style={{ width: `${Math.min(100, yieldData?.summary?.storeEfficiencyRate || 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* KPI 2: Total Porsi Miss */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Porsi Miss / Loss</p>
                <h3 className="text-3xl font-black text-rose-600 mt-1">
                  {(yieldData?.summary?.totalMissPortions || 0).toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-500">Porsi</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Setara porsi yang terbuang akibat takaran berlebih atau loss.
                </p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
            </div>

            {/* KPI 3: Estimasi Biaya Kerugian */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Nilai Selisih Bahan</p>
                <h3 className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
                  Rp {(yieldData?.summary?.totalVarianceCost || 0).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Estimasi nilai modal bahan yang hilang / melebihi target resep.
                </p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <DollarSign size={24} />
              </div>
            </div>

            {/* KPI 4: Kepatuhan Standar SOP */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Kepatuhan Standar SOP</p>
                <h3 className="text-2xl sm:text-3xl font-black text-indigo-600 mt-1">
                  {yieldData?.summary?.perfectCount || 0} <span className="text-xs font-bold text-slate-500">Presisi</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {yieldData?.summary?.warningCount || 0} Toleransi | {yieldData?.summary?.criticalCount || 0} Boros
                </p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Award size={24} />
              </div>
            </div>
          </div>

          {/* TABLE & ACCORDION DETAIL */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-sm text-slate-900">Rincian Performa Takaran per Bahan Baku</h4>
                <p className="text-xs text-slate-400">Klik baris bahan untuk melihat rincian menu yang mengonsumsi bahan tersebut.</p>
              </div>
              <div className="text-xs text-slate-500 font-bold">
                Menampilkan {((yieldData?.items || []).filter((i: any) => i.name.toLowerCase().includes(yieldSearch.toLowerCase()))).length} Bahan
              </div>
            </div>

            {yieldLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="animate-spin inline-block mb-2 text-violet-600" size={26} />
                <p className="font-bold text-xs">Menganalisis data penjualan resep dan mutasi riil bahan...</p>
              </div>
            ) : (yieldData?.items || []).length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Target size={36} className="mx-auto text-slate-300" />
                <p className="font-bold text-sm text-slate-600">Belum ada data konsumsi resep pada periode ini.</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Pastikan menu di kasir telah memiliki resep bahan baku (BOM) yang terkonfigurasi.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4 text-center w-10">No</th>
                      <th className="py-3 px-4">Nama Bahan & Menu Terkait</th>
                      <th className="py-3 px-4 text-center">Area</th>
                      <th className="py-3 px-4 text-right">Target Teori Resep</th>
                      <th className="py-3 px-4 text-right">Realita Terpakai</th>
                      <th className="py-3 px-4 text-right">Selisih (Miss)</th>
                      <th className="py-3 px-4 text-right">Biaya Kerugian</th>
                      <th className="py-3 px-4 text-center">Efisiensi Hasil</th>
                      <th className="py-3 px-4">Diagnosis & Rekomendasi SOP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {(yieldData?.items || [])
                      .filter((item: any) => item.name.toLowerCase().includes(yieldSearch.toLowerCase()))
                      .map((item: any, idx: number) => {
                        const isExpanded = expandedYieldId === item.id;
                        const hasRelatedMenu = item.relatedProducts && item.relatedProducts.length > 0;

                        return (
                          <React.Fragment key={item.id}>
                            <tr 
                              onClick={() => hasRelatedMenu && setExpandedYieldId(isExpanded ? null : item.id)}
                              className={`transition-colors cursor-pointer ${
                                isExpanded ? 'bg-violet-50/50' : 'hover:bg-slate-50/80'
                              } ${
                                item.statusType === 'OVER_PORTION' ? 'bg-rose-50/20' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                                      {item.name}
                                      {item.isKeyIngredient && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800" title="Bahan Utama (High Impact)">
                                          Bahan Utama
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Harga Beli: Rp {item.buyPrice.toLocaleString('id-ID')}/{item.unit}
                                      {item.avgQtyPerServing > 0 && ` • Standar: ${item.avgQtyPerServing} ${item.unit}/porsi`}
                                    </p>
                                  </div>
                                  {hasRelatedMenu && (
                                    <div className="ml-auto text-slate-400">
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  item.category === 'DRINK' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                  item.category === 'FOOD' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.category === 'DRINK' ? 'Bar' : item.category === 'FOOD' ? 'Dapur' : 'Kemasan'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                                {item.theoreticalQty.toLocaleString('id-ID')} {item.unit}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                                {item.actualQty.toLocaleString('id-ID')} {item.unit}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <span className={`font-black ${
                                  item.varianceQty > 0 ? 'text-rose-600' : (item.varianceQty < 0 ? 'text-sky-600' : 'text-emerald-600')
                                }`}>
                                  {item.varianceQty > 0 ? `+${item.varianceQty.toLocaleString('id-ID')}` : item.varianceQty.toLocaleString('id-ID')} {item.unit}
                                </span>
                                {item.missPortions > 0 && (
                                  <div className="text-[10px] text-rose-500 font-bold mt-0.5">
                                    ~{item.missPortions} Porsi Hilang
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-slate-800">
                                {item.varianceCost > 0 ? (
                                  <span className="text-amber-700 font-black">
                                    Rp {item.varianceCost.toLocaleString('id-ID')}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Rp 0</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className={`text-xs font-black ${
                                    item.statusType === 'PERFECT' ? 'text-emerald-600' :
                                    item.statusType === 'WARNING' ? 'text-amber-600' :
                                    item.statusType === 'UNDER_PORTION' ? 'text-blue-600' :
                                    item.statusType === 'INACTIVE' ? 'text-slate-400' :
                                    'text-rose-600'
                                  }`}>
                                    {item.efficiencyRate}%
                                  </span>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                    <div 
                                      className={`h-full ${
                                        item.statusType === 'PERFECT' ? 'bg-emerald-500' :
                                        item.statusType === 'WARNING' ? 'bg-amber-500' :
                                        item.statusType === 'UNDER_PORTION' ? 'bg-blue-500' :
                                        'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(100, item.efficiencyRate)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="space-y-1">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black inline-block ${
                                    item.statusType === 'PERFECT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    item.statusType === 'WARNING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    item.statusType === 'UNDER_PORTION' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                    item.statusType === 'INACTIVE' ? 'bg-slate-50 text-slate-500 border border-slate-200' :
                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {item.status}
                                  </span>
                                  <p className="text-[10px] text-slate-500 leading-tight">
                                    {item.recommendation}
                                  </p>
                                </div>
                              </td>
                            </tr>

                            {/* ACCORDION MENU COMPOSITION BREAKDOWN */}
                            {isExpanded && hasRelatedMenu && (
                              <tr className="bg-slate-50/70 border-t border-b border-slate-200/80">
                                <td colSpan={9} className="p-4 sm:p-5">
                                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                      <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                                        <Utensils size={14} className="text-violet-600" />
                                        <span>Rincian Menu yang Menggunakan {item.name}:</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">Total {item.relatedProducts.length} Menu Terkait</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                      {item.relatedProducts.map((p: any, pIdx: number) => (
                                        <div key={pIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                          <div>
                                            <p className="font-black text-xs text-slate-900">{p.name}</p>
                                            <p className="text-[10px] text-slate-500">
                                              Takaran: {p.qtyPerServing} {p.unit}/porsi
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200">
                                              {p.portionsSold || 0} Terjual
                                            </span>
                                            <p className="text-[9px] text-slate-400 mt-0.5">
                                              ={((p.portionsSold || 0) * p.qtyPerServing).toLocaleString('id-ID')} {p.unit}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up my-auto border border-slate-100 max-h-[92vh] flex flex-col">
            
            {/* Header with Title & Close button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                  <TrendingDown size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Catat Kerusakan / Stock Loss</h3>
                  <p className="text-xs text-slate-500">Mencatat bahan busuk, rusak, expired, atau porsi menu gagal.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLossModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitLoss} className="space-y-4 overflow-y-auto pr-1 flex-1">
              
              {/* DUAL-MODE TOGGLE TABS */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Tipe Objek Yang Terbuang
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setLossForm(prev => ({
                        ...prev,
                        targetType: 'INGREDIENT',
                        ingredientId: prev.ingredientId || (ingredients[0]?.id?.toString() || ''),
                        qtyLoss: '1'
                      }));
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      lossForm.targetType === 'INGREDIENT'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers size={15} className={lossForm.targetType === 'INGREDIENT' ? 'text-amber-500' : ''} />
                    <span>Bahan Baku Mentah</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (allProducts.length === 0) fetchProducts();
                      setLossForm(prev => ({
                        ...prev,
                        targetType: 'PRODUCT',
                        productId: prev.productId || (allProducts[0]?.id?.toString() || ''),
                        qtyLoss: '1'
                      }));
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      lossForm.targetType === 'PRODUCT'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Utensils size={15} className={lossForm.targetType === 'PRODUCT' ? 'text-purple-600' : ''} />
                    <span>Menu / Porsi Masakan</span>
                  </button>
                </div>
              </div>

              {/* SELECT ITEM ACCORDING TO TARGET TYPE */}
              {lossForm.targetType === 'INGREDIENT' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Pilih Bahan Baku</label>
                    <span className="text-[11px] text-slate-500">
                      Stok saat ini: <strong className="text-slate-800">{selectedLossIngredient?.stock || 0} {selectedLossIngredient?.unit}</strong>
                    </span>
                  </div>
                  <select
                    value={lossForm.ingredientId}
                    onChange={e => setLossForm({ ...lossForm, ingredientId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-all"
                  >
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id.toString()}>
                        {i.name} (Stok: {i.stock} {i.unit}) — Rp {i.buyPrice.toLocaleString('id-ID')}/{i.unit}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Pilih Menu / Porsi Masakan</label>
                    <span className="text-[11px] text-purple-600 font-bold">
                      HPP Satuan: Rp {unitHpp.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <select
                    value={lossForm.productId}
                    onChange={e => setLossForm({ ...lossForm, productId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-purple-50/50 border border-purple-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-500 focus:bg-white transition-all"
                  >
                    {allProducts.map(p => {
                      const pCost = p.buyPrice || 0;
                      return (
                        <option key={p.id} value={p.id.toString()}>
                          {p.name} {pCost > 0 ? `— HPP: Rp ${pCost.toLocaleString('id-ID')}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-xl border border-purple-200/80 mt-1.5 flex items-center gap-1.5">
                    <Sparkles size={12} className="shrink-0" />
                    <span>Sistem otomatis mengurangi stok bahan baku penyusun resep menu ini di database.</span>
                  </p>
                </div>
              )}

              {/* QUANTITY & QUICK INCREMENTS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Jumlah Terbuang / Rusak ({unitLabel.toUpperCase()})
                  </label>
                  <span className="text-[11px] font-bold text-rose-600">
                    {lossForm.qtyLoss || 0} {unitLabel}
                  </span>
                </div>
                
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0"
                  value={lossForm.qtyLoss}
                  onChange={e => setLossForm({ ...lossForm, qtyLoss: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-900 outline-none focus:border-rose-500 focus:bg-white transition-all"
                />

                {/* Quick Increment Buttons */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {(lossForm.targetType === 'INGREDIENT'
                    ? [0.1, 0.5, 1, 5]
                    : [0.5, 1, 2, 5]
                  ).map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => handleIncrementQty(inc)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-lg text-xs font-black transition-all border border-slate-200"
                    >
                      +{inc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleIncrementQty(0)}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all border border-rose-200 ml-auto"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* 8 INTERACTIVE 1-TAP REASON BUTTONS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alasan Kerusakan / Pembuangan (Pilih 1-Tap)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Busuk / Basi', val: 'Busuk / Basi', color: 'border-amber-200 text-amber-800 bg-amber-50/80', active: 'bg-amber-600 text-white border-amber-600' },
                    { label: 'Kadaluarsa (Expired)', val: 'Kadaluarsa (Expired)', color: 'border-rose-200 text-rose-800 bg-rose-50/80', active: 'bg-rose-600 text-white border-rose-600' },
                    { label: 'Gosong / Overcooked', val: 'Gosong / Overcooked', color: 'border-stone-300 text-stone-800 bg-stone-100', active: 'bg-stone-800 text-white border-stone-800' },
                    { label: 'Salah Buat Dapur', val: 'Salah Buat Dapur', color: 'border-purple-200 text-purple-800 bg-purple-50/80', active: 'bg-purple-600 text-white border-purple-600' },
                    { label: 'Tumpah / Terjatuh', val: 'Tumpah / Terjatuh', color: 'border-sky-200 text-sky-800 bg-sky-50/80', active: 'bg-sky-600 text-white border-sky-600' },
                    { label: 'Trimming / Kulit Berlebih', val: 'Trimming / Kulit Berlebih', color: 'border-emerald-200 text-emerald-800 bg-emerald-50/80', active: 'bg-emerald-600 text-white border-emerald-600' },
                    { label: 'Sisa Tutup Toko', val: 'Sisa Tutup Toko', color: 'border-indigo-200 text-indigo-800 bg-indigo-50/80', active: 'bg-indigo-600 text-white border-indigo-600' },
                    { label: 'Lainnya / Kerusakan Lain', val: 'Lainnya / Kerusakan Lain', color: 'border-slate-300 text-slate-800 bg-slate-100', active: 'bg-slate-800 text-white border-slate-800' },
                  ].map(r => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setLossForm({ ...lossForm, reason: r.val })}
                      className={`p-2 rounded-xl text-[11px] font-black border text-left transition-all flex items-center justify-between gap-1 ${
                        lossForm.reason === r.val
                          ? `${r.active} shadow-sm ring-2 ring-slate-900/10`
                          : `${r.color} hover:opacity-90`
                      }`}
                    >
                      <span className="truncate">{r.label}</span>
                      {lossForm.reason === r.val && <CheckCircle2 size={13} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* LIVE HPP CALCULATION CARD */}
              <div className="p-3.5 bg-gradient-to-br from-rose-50 to-amber-50 rounded-2xl border border-rose-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-rose-600 uppercase tracking-wider">
                    Estimasi Kerugian HPP Riil
                  </div>
                  <div className="text-lg sm:text-xl font-black text-rose-700">
                    Rp {estimatedLossAmount.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-600 font-medium">
                  <div>{lossForm.qtyLoss || 0} {unitLabel} × Rp {unitHpp.toLocaleString('id-ID')}</div>
                  <div className="text-[10px] text-slate-400">HPP Satuan {unitLabel}</div>
                </div>
              </div>

              {/* CATATAN TAMBAHAN (OPSIONAL) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Chiller mati semalam / Salah resep ramen pedas meja 4..."
                  value={lossForm.notes}
                  onChange={e => setLossForm({ ...lossForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 resize-none outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              {/* MODAL FOOTER ACTIONS */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLoss}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {submittingLoss ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Simpan Stock Loss</span>
                    </>
                  )}
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
