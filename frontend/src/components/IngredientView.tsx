import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  Package, Plus, Edit2, Trash2, X, AlertTriangle, ChevronDown, ChevronUp, 
  RefreshCw, TrendingDown, TrendingUp, Search, History, Utensils, ClipboardCheck, 
  CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, DollarSign, ArrowRight, 
  ShieldAlert, FileText, Coffee, ShoppingBag, Truck, BarChart3, PieChart, 
  ArrowUpRight, ArrowDownRight, Layers, HelpCircle, Send, ShoppingCart,
  Download, Printer, MessageCircle, Copy, Boxes, ChefHat, UserCheck, Flame, Award, Activity, Users, Target
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
  exportYieldAuditPDF
} from '../utils/pdfGenerator';
import WasteLogModal from './WasteLogModal';
import RecycleBinModal from './RecycleBinModal';
import AIIngredientGeneratorModal from './AIIngredientGeneratorModal';
import { ProductImage } from './ProductImage';
import { useVertical } from '../context/VerticalContext';

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

const LAUNDRY_SUB_CATEGORIES: Record<string, string[]> = {
  FOOD: [
    'Deterjen Cair Mesin',
    'Deterjen Bubuk',
    'Softener & Pelembut',
    'Pemutih & Pencerah (Bleach)',
    'Penghilang Noda (Spotting)'
  ],
  DRINK: [
    'Bibit Parfum Murni',
    'Pelarut Parfum (Methanol)',
    'Parfum Semprot Siap Pakai'
  ],
  PACKAGING: [
    'Plastik Jinjing HD',
    'Plastik PP Rol / Karung',
    'Hanger Kawat & Plastik',
    'Label Tag & Klip Penanda'
  ],
  CHEMICAL: [
    'Deterjen Cair Mesin',
    'Deterjen Bubuk',
    'Softener & Pelembut',
    'Pemutih & Pencerah (Bleach)',
    'Penghilang Noda (Spotting)'
  ],
  PERFUME: [
    'Bibit Parfum Murni',
    'Pelarut Parfum (Methanol)',
    'Parfum Semprot Siap Pakai'
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
  category?: string;
  subCategory?: string;
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
  const { isLaundry } = useVertical();
  const currentSubCategories = isLaundry ? LAUNDRY_SUB_CATEGORIES : INGREDIENT_SUB_CATEGORIES;
  const token = posContext?.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Tab State: 'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname' | 'daily_usage' | 'staff_activity' | 'yield'
  const [activeTab, setActiveTab] = useState<'master' | 'loss' | 'movements' | 'shopping' | 'forecast' | 'opname' | 'daily_usage' | 'staff_activity' | 'yield'>('master');
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);

  // Yield & Variance Audit State (Gambar 2)
  const [yieldData, setYieldData] = useState<any>(null);
  const [yieldLoading, setYieldLoading] = useState(false);
  const [yieldPreset, setYieldPreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('this_month');
  const [yieldStartDate, setYieldStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [yieldEndDate, setYieldEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [yieldAreaFilter, setYieldAreaFilter] = useState<string>('ALL');
  const [yieldSearch, setYieldSearch] = useState<string>('');

  // Master Ingredients Data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'safe'>('all');

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

  // Stock Waste & Loss Data & Analytics (Priority 3)
  const [lossData, setLossData] = useState<any>(null);
  const [lossLoading, setLossLoading] = useState(false);
  const [lossPreset, setLossPreset] = useState<'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('this_month');
  const [lossStartDate, setLossStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [lossEndDate, setLossEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteModalType, setWasteModalType] = useState<'INGREDIENT' | 'PRODUCT'>('INGREDIENT');
  const [wasteModalItemId, setWasteModalItemId] = useState<number | undefined>(undefined);

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
  const [forecastStatusFilter, setForecastStatusFilter] = useState<'ALL' | 'AMAN' | 'MENIPIS' | 'HABIS'>('ALL');
  const [expandedForecastId, setExpandedForecastId] = useState<number | null>(null);

  const forecastStats = useMemo(() => {
    let totalPortions = 0;
    let safeCount = 0;
    let warningCount = 0;
    let outOfStockCount = 0;

    for (const item of forecastList) {
      totalPortions += item.maxPortions || 0;
      if (item.maxPortions === 0) outOfStockCount++;
      else if (item.maxPortions <= 15) warningCount++;
      else safeCount++;
    }

    return {
      totalMenus: forecastList.length,
      totalPortions,
      safeCount,
      warningCount,
      outOfStockCount
    };
  }, [forecastList]);

  const filteredForecastList = useMemo(() => {
    return forecastList.filter(p => {
      const matchSearch = !forecastSearch.trim() || 
        p.productName.toLowerCase().includes(forecastSearch.toLowerCase()) ||
        p.categoryName.toLowerCase().includes(forecastSearch.toLowerCase());
      
      let matchStatus = true;
      if (forecastStatusFilter === 'AMAN') matchStatus = p.maxPortions > 15;
      else if (forecastStatusFilter === 'MENIPIS') matchStatus = p.maxPortions > 0 && p.maxPortions <= 15;
      else if (forecastStatusFilter === 'HABIS') matchStatus = p.maxPortions === 0;

      return matchSearch && matchStatus;
    });
  }, [forecastList, forecastSearch, forecastStatusFilter]);

  // Stock Opname Audit State
  const [opnameItems, setOpnameItems] = useState<OpnameItemState[]>([]);
  const [auditorName, setAuditorName] = useState<string>(posContext?.user?.username || 'Admin');
  const [opnameNotes, setOpnameNotes] = useState<string>('Stock Opname Rutin Dapur');
  const [submittingOpname, setSubmittingOpname] = useState(false);
  const [opnameHistory, setOpnameHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [opnameSearch, setOpnameSearch] = useState<string>('');
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING'>('ALL');
  const [opnameVarianceOnly, setOpnameVarianceOnly] = useState<boolean>(false);

  const filteredOpnameItems = useMemo(() => {
    return opnameItems.filter(item => {
      const matchSearch = !opnameSearch || 
        item.name.toLowerCase().includes(opnameSearch.toLowerCase()) ||
        (item.subCategory && item.subCategory.toLowerCase().includes(opnameSearch.toLowerCase()));
      const matchCategory = opnameCategoryFilter === 'ALL' || item.category === opnameCategoryFilter;
      const diff = Number(item.physicalStock) - item.systemStock;
      const matchVariance = !opnameVarianceOnly || Math.abs(diff) > 0.001;
      return matchSearch && matchCategory && matchVariance;
    });
  }, [opnameItems, opnameSearch, opnameCategoryFilter, opnameVarianceOnly]);

  const opnameVarianceCount = useMemo(() => {
    return opnameItems.filter(item => Math.abs(Number(item.physicalStock) - item.systemStock) > 0.001).length;
  }, [opnameItems]);

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
        const url = new URL(`${window.location.origin}${API}/waste/analytics`);
        if (lossStartDate) url.searchParams.set('startDate', lossStartDate);
        if (lossEndDate) url.searchParams.set('endDate', lossEndDate);
        const res = await fetch(url.toString(), { headers });
        if (res.ok) raw = await res.json();
      }
      // Mapping field API -> format yang diexpect exportStockLossAuditPDF
      const mappedData = raw ? {
        totalLossRupiah: raw.summary?.totalWasteCost ?? raw.summary?.totalLossCost ?? 0,
        totalLossIncidents: raw.summary?.totalWasteIncidents ?? raw.summary?.totalLossCount ?? 0,
        lossRatePercentage: raw.summary?.wasteToSalesRatio ?? raw.summary?.lossPercentage ?? 0,
        efficiencyRate: raw.summary?.efficiencyPercentage || 100,
        totalProductionValue: raw.summary?.totalSales ?? raw.summary?.totalProductionCost ?? 0,
        topLossItems: (raw.topWasteItems || raw.topLossItems || []).map((t: any) => ({
          name: t.itemName || t.name,
          unit: t.unit || 'unit',
          totalQty: t.totalQty || 0,
          totalRupiah: t.totalCost || 0
        })),
        lossLogs: (raw.logs || []).map((l: any) => ({
          date: l.createdAt,
          ingredient: l.ingredient || { name: l.itemName || l.product?.name || 'Item' },
          qtyLoss: l.qty !== undefined ? l.qty : Math.abs(l.change || 0),
          costLoss: l.totalCost !== undefined ? l.totalCost : (l.cost || (Math.abs(l.change || 0) * (l.ingredient?.buyPrice || 0))),
          reason: l.reason || 'Lainnya',
          recordedBy: l.userName || l.user?.name || 'Staf Dapur'
        }))
      } : null;
      await exportStockLossAuditPDF(posContext?.settings || {}, mappedData, posContext?.user?.username || 'Auditor Dapur');
      toast('Laporan Audit Stock Loss & Waste berhasil diunduh!', 'success');
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
    const store = posContext?.settings?.storeName || 'KAFE & RESTORAN';
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
    const store = posContext?.settings?.storeName || 'KAFE & RESTORAN';
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
      const url = new URL(`${window.location.origin}${API}/waste/analytics`);
      if (s) url.searchParams.set('startDate', s);
      if (e) url.searchParams.set('endDate', e);

      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const data = await res.json();
        setLossData(data);
      }
    } catch (e) {
      console.error('Error waste analytics:', e);
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

  const fetchYieldAnalytics = async (start?: string, end?: string, area?: string, searchStr?: string) => {
    setYieldLoading(true);
    try {
      const s = start !== undefined ? start : yieldStartDate;
      const e = end !== undefined ? end : yieldEndDate;
      const a = area !== undefined ? area : yieldAreaFilter;
      const q = searchStr !== undefined ? searchStr : yieldSearch;

      const url = new URL(`${window.location.origin}${API}/ingredients/yield-analytics`);
      if (s) url.searchParams.set('startDate', `${s}T00:00:00.000Z`);
      if (e) url.searchParams.set('endDate', `${e}T23:59:59.999Z`);
      if (a && a !== 'ALL') url.searchParams.set('area', a);
      if (q && q.trim()) url.searchParams.set('search', q.trim());

      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const data = await res.json();
        setYieldData(data);
      }
    } catch (e) {
      console.error('Error fetching yield analytics:', e);
    } finally {
      setYieldLoading(false);
    }
  };

  const setYieldPresetDate = (preset: 'today' | 'yesterday' | 'last7' | 'this_month') => {
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
    }

    const startStr = s.toISOString().split('T')[0];
    const endStr = e.toISOString().split('T')[0];
    setYieldStartDate(startStr);
    setYieldEndDate(endStr);
    fetchYieldAnalytics(startStr, endStr, yieldAreaFilter, yieldSearch);
  };

  const handleExportYieldPDF = async () => {
    try {
      setGeneratingPdf(true);
      let dataToExport = yieldData;
      if (!dataToExport) {
        const url = new URL(`${window.location.origin}${API}/ingredients/yield-analytics`);
        if (yieldStartDate) url.searchParams.set('startDate', `${yieldStartDate}T00:00:00.000Z`);
        if (yieldEndDate) url.searchParams.set('endDate', `${yieldEndDate}T23:59:59.999Z`);
        const res = await fetch(url.toString(), { headers });
        if (res.ok) dataToExport = await res.json();
      }
      await exportYieldAuditPDF(
        posContext?.settings || {},
        dataToExport,
        yieldStartDate,
        yieldEndDate,
        posContext?.user?.username || 'Head Chef / Auditor'
      );
      toast('Laporan Audit Yield & Efisiensi Resep berhasil diunduh!', 'success');
      setPdfDropdownOpen(false);
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh Laporan Audit Yield', 'error');
    } finally {
      setGeneratingPdf(false);
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
    else if (activeTab === 'staff_activity') fetchStaffActivityAnalytics();
    else if (activeTab === 'shopping') fetchShoppingAnalytics();
    else if (activeTab === 'movements') fetchMovements();
    else if (activeTab === 'forecast') fetchForecast();
    else if (activeTab === 'opname') fetchOpnameHistory();
    else if (activeTab === 'daily_usage') fetchDailyUsage();
    else if (activeTab === 'yield') fetchYieldAnalytics();
  }, [activeTab, movementTypeFilter, movementIngredientFilter, usageCategoryFilter, usageTypeFilter, selectedStaffUserFilter, token]);

  const initOpnameItems = (ings: Ingredient[]) => {
    setOpnameItems(
      ings.map(i => ({
        ingredientId: i.id,
        name: i.name,
        category: i.category,
        subCategory: i.subCategory || '',
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
    setWasteModalType(initialType);
    setWasteModalItemId(preselectedId);
    setShowWasteModal(true);
  };

  const handleDeleteWasteLog = async (id: number, itemName: string) => {
    const res = await confirmAlert(
      'Batalkan Log Waste?',
      `Apakah Anda yakin ingin membatalkan pencatatan waste "${itemName}"? Stok bahan/produk akan otomatis dikembalikan ke sistem.`
    );
    if (!res.isConfirmed) return;

    try {
      const res = await fetch(`${API}/waste/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        toast('Log waste berhasil dibatalkan dan stok dikembalikan!', 'success');
        fetchLossAnalytics();
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal membatalkan log waste', 'error');
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

  const handleSetAllPhysicalToSystem = () => {
    setOpnameItems(prev => prev.map(item => ({
      ...item,
      physicalStock: item.systemStock,
      reason: 'Normal'
    })));
    toast('Semua stok fisik riil berhasil disamakan dengan stok sistem', 'success');
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
                {posContext?.settings?.storeName || (isLaundry ? 'UNIT USAHA LAUNDRY' : 'KAFE & RESTORAN')}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                {isLaundry ? 'Bahan Kimia & Parfum Laundry' : 'Master Bahan Baku & Intelijen Stok'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isLaundry 
                ? 'Kelola persediaan konsentrat deterjen, softener mesin, aneka bibit parfum, dan kemasan laundry'
                : 'Klasifikasi stok, audit potensi stock loss, mutasi distribusi, dan analisis rekomendasi belanja'}
            </p>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Primary Action Button */}
            <button
              onClick={handleOpenAdd}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-purple-200 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Plus size={16} /> <span>{isLaundry ? 'Tambah Bahan Kimia' : 'Tambah Bahan Baku'}</span>
            </button>

            {/* Secondary Actions (Scrollable Pills on Mobile, Inline on Desktop) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto shrink-0">
              <button
                onClick={() => setIsAIGeneratorOpen(true)}
                className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles size={14} className="text-yellow-200 animate-pulse" />
                <span className="whitespace-nowrap">AI Starter</span>
              </button>

              <button
                onClick={() => handleOpenLossModal()}
                className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <TrendingDown size={14} /> <span className="whitespace-nowrap">Catat Loss</span>
              </button>

              <button
                onClick={() => setIsRecycleBinOpen(true)}
                className="shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 size={14} /> <span className="whitespace-nowrap">Sampah</span>
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

                    <button
                      onClick={handleExportYieldPDF}
                      className="w-full px-4 py-2.5 hover:bg-purple-50 text-left flex items-start gap-3 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Award size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 group-hover:text-purple-900">Laporan Audit Yield & Efisiensi Resep</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Analisis akurasi takaran porsi & kerugian Rp</p>
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
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGASI 9 TAB UTAMA BAHAN BAKU 
          Mobile: Sleek Horizontal Scrollable Pill Slider (Zero Vertical Bloat)
          Desktop: Structured 3-Column Bento Grid
      ────────────────────────────────────────────────────────────── */}
      {/* Mobile Horizontal Pill Scrollable Bar */}
      <div className="bento-nav-mobile flex sm:!hidden items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 -mx-1 snap-x scroll-px-2 shrink-0">
        {[
          { id: 'master', title: isLaundry ? 'Bahan Kimia' : 'Master Bahan', icon: Package, badge: ingredients.length > 0 ? `${ingredients.length}` : null },
          { id: 'daily_usage', title: isLaundry ? 'Konsumsi Kimia' : 'Konsumsi Harian', icon: BarChart3, badge: (usageData?.items?.length || 0) > 0 ? `${usageData?.items?.length}` : null },
          { id: 'loss', title: isLaundry ? 'Tumpah / Rusak' : 'Stock Loss', icon: TrendingDown, badge: (lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount ?? 0) > 0 ? `${lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount}` : null },
          { id: 'staff_activity', title: isLaundry ? 'Operator Cuci' : 'Staf Dapur', icon: ChefHat, badge: 'KPI' },
          { id: 'movements', title: 'Kartu Stok', icon: History, badge: movements.length > 0 ? `${movements.length}` : null },
          { id: 'shopping', title: 'Rencana Belanja', icon: ShoppingCart, badge: (lowStockCount + outStockCount) > 0 ? `${lowStockCount + outStockCount} Kritis` : null },
          { id: 'forecast', title: isLaundry ? 'Estimasi Cucian' : 'Kapasitas (BOM)', icon: Utensils, badge: forecastList.length > 0 ? `${forecastList.length}` : null },
          { id: 'opname', title: 'Stock Opname', icon: ClipboardCheck, badge: opnameHistory.length > 0 ? `${opnameHistory.length}` : null },
          { id: 'yield', title: 'Yield Efisiensi', icon: Award, badge: `${yieldData?.summary?.storeEfficiencyScore || 68.7}%` },
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-600/30'
                  : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} className={isSelected ? 'text-white' : 'text-purple-600'} />
              <span className="whitespace-nowrap">{tab.title}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop & Tablet Bento Grid */}
      <div className="bento-nav-desktop hidden sm:!grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3 shrink-0 bg-white rounded-3xl p-3 sm:p-4 border border-slate-200 shadow-sm">
        {[
          { 
            id: 'master', 
            title: isLaundry ? 'Bahan Kimia & Parfum' : 'Master Bahan', 
            subtitle: isLaundry ? 'Deterjen, Pewangi & Plastik' : 'Katalog & Stok Fisik', 
            icon: Package,
            badge: ingredients.length > 0 ? `${ingredients.length} Bahan` : null
          },
          { 
            id: 'daily_usage', 
            title: isLaundry ? 'Konsumsi Kimia' : 'Konsumsi Harian', 
            subtitle: isLaundry ? 'Pemakaian Deterjen & Parfum' : 'Daily Usage & COGS', 
            icon: BarChart3,
            badge: (usageData?.items?.length || 0) > 0 ? `${usageData?.items?.length} Dipakai` : null
          },
          { 
            id: 'loss', 
            title: isLaundry ? 'Tumpahan & Kerusakan' : 'Waste & Kerugian HPP', 
            subtitle: isLaundry ? 'Insiden Bahan Kimia Rusak' : 'Bahan Basi & Waste Ratio', 
            icon: TrendingDown, 
            badge: (lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount ?? 0) > 0 ? `${lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount} Insiden` : null
          },
          { 
            id: 'staff_activity', 
            title: isLaundry ? 'Operator Cuci & Setrika' : 'Analisis Staf Dapur', 
            subtitle: isLaundry ? 'Audit & Produktivitas Mesin' : 'Audit & Akuntabilitas', 
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
            title: isLaundry ? 'Estimasi Kapasitas Cucian' : 'Kapasitas Menu (BOM)', 
            subtitle: isLaundry ? 'Estimasi Kg Cucian Maksimal' : 'Resep & Yield Menu', 
            icon: Utensils,
            badge: forecastList.length > 0 ? `${forecastList.length} Item` : null
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
            subtitle: isLaundry ? 'Efisiensi Takaran Kimia' : 'Yield & Efisiensi Resep', 
            icon: Award,
            badge: `${yieldData?.summary?.storeEfficiencyScore || 68.7}% Sukses`
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
                width: '100%'
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* 1. Total Bahan */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Total Bahan</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Package size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {ingredients.length}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 truncate">
                Semua bahan aktif
              </p>
            </div>

            {/* 2. Stok Menipis */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-amber-200/80 p-3 sm:p-4 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all bg-gradient-to-b from-white to-amber-50/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-700">Stok Menipis</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 leading-tight">
                {lowStockCount}
              </div>
              <p className="text-[10px] sm:text-xs text-amber-700/80 font-medium mt-1 truncate">
                Batas minimum
              </p>
            </div>

            {/* 3. Stok Habis (Kritis) */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-rose-200/80 p-3 sm:p-4 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all bg-gradient-to-b from-white to-rose-50/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-700">Stok Kritis</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert size={15} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 leading-tight">
                {outStockCount}
              </div>
              <p className="text-[10px] sm:text-xs text-rose-700/80 font-medium mt-1 truncate">
                Perlu restock segera
              </p>
            </div>

            {/* 4. Valuasi Aset Stok */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-emerald-200/80 p-3 sm:p-4 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all bg-gradient-to-b from-white to-emerald-50/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-700">Valuasi Stok</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <DollarSign size={15} />
                </div>
              </div>
              <div className="text-base sm:text-xl font-black text-emerald-700 leading-tight truncate" title={`Rp ${Math.round(totalValuation).toLocaleString('id-ID')}`}>
                Rp {Math.round(totalValuation).toLocaleString('id-ID')}
              </div>
              <p className="text-[10px] sm:text-xs text-emerald-700/80 font-medium mt-1 truncate">
                {ingredients.length} item tersimpan
              </p>
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
                  <span>{isLaundry ? '🧪 Deterjen & Kimia' : '🍲 Dapur (Food)'}</span>
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
                  <span>{isLaundry ? '🌸 Parfum & Pewangi' : '☕ Bar (Drink)'}</span>
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
                  <span>{isLaundry ? '📦 Kemasan & Hanger' : '📦 Kemasan'}</span>
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
                      {(currentSubCategories[categoryFilter] || []).map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                      {Array.from(new Set(ingredients.filter(i => (i.category || 'FOOD') === categoryFilter && i.subCategory && !(currentSubCategories[categoryFilter] || []).includes(i.subCategory)).map(i => i.subCategory as string))).map(customSc => (
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

          {/* INGREDIENTS TABLE & MOBILE CARDS */}
          <div style={{ background: 'white', borderRadius: '1.15rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            
            {/* Mobile Card List View (Visible on < sm) */}
            <div className="block sm:hidden p-2.5 space-y-2.5">
              {loading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="animate-spin inline-block mb-2 text-purple-600" size={24} />
                  <p className="text-xs font-bold">Memuat data bahan baku...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Package className="inline-block mb-2 opacity-40 text-slate-400" size={32} />
                  <p className="text-xs font-bold">Tidak ada bahan baku yang cocok.</p>
                </div>
              ) : (
                filtered.map((ing) => {
                  const isOut = ing.stock === 0;
                  const isLow = ing.stock > 0 && ing.stock <= ing.minStock;
                  const cat = ing.category || 'FOOD';

                  return (
                    <div 
                      key={ing.id} 
                      className={`p-3 rounded-2xl border transition-all shadow-xs ${
                        isOut 
                          ? 'bg-rose-50/30 border-rose-200' 
                          : isLow 
                          ? 'bg-amber-50/30 border-amber-200' 
                          : 'bg-white border-slate-200/80 hover:border-purple-200'
                      }`}
                    >
                      {/* Top: Name, Emoji & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0">
                            {cat === 'FOOD' ? '🍲' : (cat === 'DRINK' ? '☕' : '📦')}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate">
                              {ing.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-purple-700 font-extrabold uppercase tracking-wider">
                                {cat === 'FOOD' ? 'Dapur' : (cat === 'DRINK' ? 'Bar' : 'Kemasan')}
                              </span>
                              {ing.subCategory && (
                                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/60">
                                  {ing.subCategory}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                              Habis
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Aman
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Stock Details Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-2 mt-2.5 border border-slate-100 text-center">
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Stok Fisik</div>
                          <div className="text-xs font-black text-slate-900 mt-0.5">
                            {ing.stock.toLocaleString('id-ID')} <span className="text-[9px] font-semibold text-slate-500">{ing.unit}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Harga Beli</div>
                          <div className="text-xs font-bold text-slate-700 mt-0.5 truncate">
                            Rp {ing.buyPrice.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Nilai Total</div>
                          <div className="text-xs font-black text-emerald-700 mt-0.5 truncate">
                            Rp {(ing.stock * ing.buyPrice).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div className="flex items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                        <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                          {ing.supplier ? `Supplier: ${ing.supplier.name}` : 'Tanpa Supplier'}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenLossModal(ing.id)}
                            title="Catat Stock Loss"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors active:scale-95"
                          >
                            <TrendingDown size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setAdjustModal({ open: true, ingredient: ing });
                              setAdjustForm({ change: '', type: 'Restock', description: '' });
                            }}
                            title="Penyesuaian / Restock"
                            className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors active:scale-95"
                          >
                            <RefreshCw size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(ing)}
                            title="Edit Bahan"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors active:scale-95"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(ing.id, ing.name)}
                            title="Hapus Bahan"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors active:scale-95"
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

            {/* Desktop Table View (Visible on sm+) */}
            <div className="hidden sm:block overflow-x-auto">
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
          TAB 3: FOOD WASTE & SPOILAGE TRACKING (PRIORITY 3)
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
                className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-500/25 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Plus size={15} />
                <span>+ Catat Waste Dapur</span>
              </button>
            </div>
          </div>

          {/* LOSS SUMMARY METRICS (4 CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-rose-600 to-red-700 p-6 rounded-3xl text-white shadow-lg shadow-rose-600/20">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-rose-100 uppercase tracking-wider">Total Kerugian Food Waste</p>
                <span className="px-2 py-0.5 bg-white/20 text-white rounded-md text-[10px] font-black">
                  HPP Loss
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                Rp {(lossData?.summary?.totalWasteCost ?? lossData?.summary?.totalLossCost ?? 0).toLocaleString('id-ID')}
              </h3>
              <p className="text-xs text-rose-100/90 mt-1">
                {lossData?.summary?.totalWasteIncidents ?? lossData?.summary?.totalLossCount ?? 0} insiden terbuang tercatat
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waste-to-Sales Ratio</p>
                <h3 className="text-2xl font-black mt-1 flex items-center gap-2">
                  <span className={
                    (lossData?.summary?.wasteToSalesRatio || 0) <= 2 
                      ? 'text-emerald-600' 
                      : (lossData?.summary?.wasteToSalesRatio || 0) <= 4 
                        ? 'text-amber-600' 
                        : 'text-rose-600'
                  }>
                    {lossData?.summary?.wasteToSalesRatio || 0}%
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  {(lossData?.summary?.wasteToSalesRatio || 0) <= 2 ? (
                    <span className="text-emerald-600 font-bold">✓ Target Ideal (&lt;2%)</span>
                  ) : (lossData?.summary?.wasteToSalesRatio || 0) <= 4 ? (
                    <span className="text-amber-600 font-bold">⚠ Waspada (2 - 4%)</span>
                  ) : (
                    <span className="text-rose-600 font-bold">🚨 Tinggi (&gt;4% Bocor)</span>
                  )}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <TrendingDown size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Kerugian Bahan Mentah</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Rp {(lossData?.summary?.totalIngredientLossCost ?? (lossData?.wasteByType?.INGREDIENT?.cost || 0)).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {lossData?.wasteByType?.INGREDIENT?.count || 0} kali pembuangan bahan
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Package size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Kerugian Porsi Masakan</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Rp {(lossData?.summary?.totalProductLossCost ?? (lossData?.wasteByType?.PRODUCT?.cost || 0)).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {lossData?.wasteByType?.PRODUCT?.count || 0} porsi gagal / salah masak
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Utensils size={22} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* TOP 5 WASTE ITEMS */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-600" />
                  Top 5 Item Penyumbang Kerugian
                </h3>
              </div>

              <div className="space-y-3">
                {(!lossData?.topWasteItems || lossData?.topWasteItems?.length === 0) && (!lossData?.topLossItems || lossData?.topLossItems?.length === 0) ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Belum ada data kerugian pada periode ini 🎉
                  </div>
                ) : (
                  (lossData?.topWasteItems || lossData?.topLossItems || []).slice(0, 5).map((item: any, idx: number) => {
                    const isProduct = item.type === 'PRODUCT';
                    return (
                      <div key={item.id || `${item.type}_${item.itemName || item.name}`} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs text-slate-800 truncate">{item.itemName || item.name}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${isProduct ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                {isProduct ? 'Menu Jadi' : 'Bahan Mentah'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Terbuang: {(item.totalQty || 0).toLocaleString('id-ID')} {item.unit || 'unit'}
                            </div>
                          </div>
                        </div>
                        <div className="font-black text-xs text-rose-600 text-right shrink-0">
                          Rp {(item.totalCost || 0).toLocaleString('id-ID')}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* DISTRIBUSI ALASAN WASTE (REASON BREAKDOWN) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Flame size={18} className="text-amber-500" />
                  Distribusi Alasan Kerugian
                </h3>
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto no-scrollbar">
                {!lossData?.reasonBreakdown || Object.keys(lossData.reasonBreakdown).length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Tidak ada insiden kerugian pada rentang tanggal ini.
                  </div>
                ) : (
                  Object.entries(lossData.reasonBreakdown).map(([reasonName, stat]: [string, any]) => {
                    const totalLoss = lossData?.summary?.totalWasteCost || 1;
                    const percent = Math.min(100, Math.round((stat.totalCost / totalLoss) * 100));
                    return (
                      <div key={reasonName} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{reasonName}</span>
                          <span className="font-black text-rose-600">Rp {stat.totalCost.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{stat.count} insiden</span>
                          <span>{percent}% dari total HPP loss</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* QUICK ACTIONS & INSIGHT CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-lg space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-wider">
                  <Sparkles size={16} />
                  <span>SOP Pengendalian Waste</span>
                </div>
                <h4 className="text-base font-black mt-2 text-white">Cegah Kebocoran Biaya Dapur</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Setiap kali ada bahan busuk, kadaluarsa, tumpah, atau porsi masakan gosong/salah buat, segera catat agar stok sistem tetap sinkron & HPP tercatat akurat.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleOpenLossModal(undefined, 'INGREDIENT')}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-900/30 active:scale-95"
                >
                  <Package size={15} />
                  <span>Catat Bahan Mentah Terbuang</span>
                </button>
                <button
                  onClick={() => handleOpenLossModal(undefined, 'PRODUCT')}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-900/30 active:scale-95"
                >
                  <Utensils size={15} />
                  <span>Catat Porsi Masakan / Menu Rusak</span>
                </button>
              </div>
            </div>
          </div>

          {/* TABEL RINCIAN LOG WASTE LENGKAP */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-indigo-600" />
                  Riwayat Pencatatan Food Waste & Kerugian (Audit Log)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jejak audit lengkap bahan basi, kadaluarsa, salah masak, atau porsi sisa tutup toko.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                Total {lossData?.logs?.length || 0} Insiden Tercatat
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase sticky top-0 z-10 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th className="py-3 px-4">Nama Item</th>
                    <th className="py-3 px-3 text-right">Jumlah Rusak</th>
                    <th className="py-3 px-4 text-right">Kerugian HPP (Rp)</th>
                    <th className="py-3 px-4">Alasan & Catatan</th>
                    <th className="py-3 px-4">Dicatat Oleh</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {lossLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="animate-spin inline-block mb-2 text-rose-600" size={24} />
                        <p>Memuat riwayat pencatatan waste...</p>
                      </td>
                    </tr>
                  ) : !lossData?.logs || lossData?.logs?.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Package className="inline-block mb-2 opacity-40 text-slate-400" size={32} />
                        <p className="font-semibold text-slate-600">Belum ada log food waste yang tercatat pada rentang tanggal ini.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol "+ Catat Waste Dapur" jika terdapat bahan atau masakan yang terbuang.</p>
                      </td>
                    </tr>
                  ) : (
                    lossData?.logs?.map((l: any) => {
                      const isProduct = l.type === 'PRODUCT';
                      const displayName = l.itemName || l.ingredient?.name || l.product?.name || 'Unknown';
                      const displayQty = l.qty !== undefined ? l.qty : Math.abs(l.change || 0);
                      const displayUnit = l.unit || l.ingredient?.unit || (isProduct ? 'porsi' : 'unit');
                      const displayCost = l.totalCost !== undefined ? l.totalCost : (l.cost || (Math.abs(l.change || 0) * (l.ingredient?.buyPrice || 0)));

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                            {new Date(l.createdAt).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isProduct 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {isProduct ? '🍜 Porsi Masakan' : '🍲 Bahan Mentah'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            {displayName}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-rose-600">
                            {displayQty.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-normal">{displayUnit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-rose-700 text-sm">
                            Rp {displayCost.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 w-fit">
                                {l.reason || 'Rusak'}
                              </span>
                              {l.notes && (
                                <span className="text-[11px] text-slate-500 italic">
                                  "{l.notes}"
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                            {l.userName || l.user?.name || 'Staff Dapur'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleDeleteWasteLog(l.id, displayName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Batalkan & Rollback Stok"
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
              {/* TOP 4 KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Tindakan */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Aksi Tim</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                      {(staffActivityData?.summary?.teamTotalActions || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Mutasi stok, restock, waste & opname
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Activity size={24} />
                  </div>
                </div>

                {/* Total Kerugian (Loss / Waste) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Total Biaya Waste</p>
                    <h3 className="text-2xl font-black text-rose-600 mt-0.5">
                      Rp {(staffActivityData?.summary?.teamTotalLossCost || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(staffActivityData?.summary?.teamLossCount || 0)} insiden tercatat
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <TrendingDown size={24} />
                  </div>
                </div>

                {/* Human Error Loss */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Kelalaian / Salah Masak</p>
                    <h3 className="text-2xl font-black text-amber-600 mt-0.5">
                      Rp {(staffActivityData?.summary?.teamHumanErrorCost || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[11px] text-amber-700 font-bold mt-0.5">
                      {staffActivityData?.summary?.teamLossCompositionPercentages?.humanError || 0}% dari seluruh waste
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Flame size={24} />
                  </div>
                </div>

                {/* Staff Meal / Konsumsi Karyawan */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Makan Karyawan</p>
                    <h3 className="text-2xl font-black text-emerald-700 mt-0.5">
                      Rp {(staffActivityData?.summary?.teamStaffMealCost || 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                      Tercatat resmi sebagai konsumsi
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Utensils size={24} />
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
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
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

                <div className="overflow-x-auto">
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
                      {staffActivityData?.staffList?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Belum ada rekaman aktivitas mutasi stok oleh staf pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        staffActivityData?.staffList?.map((s: any) => {
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
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
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
          {/* HEADER & CONTROLS */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <Utensils size={20} />
                  </span>
                  <span>Analisis Kapasitas Produksi Menu & Bottleneck (BOM)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Simulasi ketersediaan porsi menu olahan dapur yang dapat diproduksi dari stok bahan baku secara real-time.
                </p>
              </div>

              {/* SEARCH BOX */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={forecastSearch}
                  onChange={e => setForecastSearch(e.target.value)}
                  placeholder="Cari nama menu atau kategori..."
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-inner"
                />
                {forecastSearch && (
                  <button 
                    type="button" 
                    onClick={() => setForecastSearch('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* QUICK STAT SUMMARY & FILTER PILLS */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setForecastStatusFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    forecastStatusFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Semua ({forecastStats.totalMenus})
                </button>
                <button
                  type="button"
                  onClick={() => setForecastStatusFilter('AMAN')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    forecastStatusFilter === 'AMAN'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Siap Saji ({forecastStats.safeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setForecastStatusFilter('MENIPIS')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    forecastStatusFilter === 'MENIPIS'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Menipis ({forecastStats.warningCount})
                </button>
                <button
                  type="button"
                  onClick={() => setForecastStatusFilter('HABIS')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    forecastStatusFilter === 'HABIS'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Habis ({forecastStats.outOfStockCount})
                </button>
              </div>

              <div className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-2">
                <span>Total Kapasitas:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-black">
                  {forecastStats.totalPortions.toLocaleString('id-ID')} Porsi
                </span>
              </div>
            </div>
          </div>

          {/* CARD GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forecastLoading ? (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
                <RefreshCw className="animate-spin inline-block mb-3 text-amber-500" size={28} />
                <p className="font-bold text-slate-700">Menganalisis kapasitas menu dari resep BOM...</p>
                <p className="text-xs text-slate-400 mt-1">Menghitung stok bahan baku dan mencari batas bottleneck produksi dapur.</p>
              </div>
            ) : filteredForecastList.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
                <ChefHat className="inline-block mb-3 text-slate-300" size={40} />
                <p className="font-bold text-slate-800 text-base">Tidak ada menu yang sesuai filter</p>
                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ganti filter status di atas.</p>
              </div>
            ) : (
              filteredForecastList.map(prod => {
                const isExpanded = expandedForecastId === prod.productId;
                const grossProfit = Math.max(0, prod.sellPrice - prod.buyPrice);
                const marginPercent = prod.sellPrice > 0 ? Math.round((grossProfit / prod.sellPrice) * 100) : 0;

                return (
                  <div 
                    key={prod.productId} 
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
                  >
                    <div>
                      {/* HERO IMAGE BANNER */}
                      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-900">
                        <ProductImage 
                          src={prod.imageUrl} 
                          alt={prod.productName} 
                          categoryName={prod.categoryName} 
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" 
                        />
                        {/* Ambient gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                        {/* Floating Badges Header */}
                        <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md bg-black/50 text-white/90 border border-white/20 shadow-sm">
                            <Utensils size={10} className="text-amber-400" />
                            {prod.categoryName || 'Menu Olahan'}
                          </span>

                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black backdrop-blur-md shadow-md ${
                            prod.maxPortions === 0 
                              ? 'bg-rose-500/90 text-white border border-rose-400/40 animate-pulse' 
                              : prod.maxPortions <= 5 
                                ? 'bg-amber-500/90 text-white border border-amber-400/40' 
                                : prod.maxPortions <= 15
                                  ? 'bg-yellow-500/90 text-slate-950 border border-yellow-300/40'
                                  : 'bg-emerald-500/90 text-white border border-emerald-400/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              prod.maxPortions === 0 ? 'bg-white' : prod.maxPortions <= 15 ? 'bg-amber-950 animate-ping' : 'bg-white'
                            }`} />
                            {prod.maxPortions === 0 
                              ? 'Habis (Sold Out)' 
                              : prod.maxPortions <= 5
                                ? `Kritis (${prod.maxPortions} Porsi)`
                                : prod.maxPortions <= 15
                                  ? `Menipis (${prod.maxPortions} Porsi)`
                                  : `Aman (${prod.maxPortions} Porsi)`
                            }
                          </span>
                        </div>

                        {/* Bottom overlay inside image: Product Name & Selling Price */}
                        <div className="absolute bottom-3 inset-x-3 z-10 flex items-end justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-base text-white leading-tight drop-shadow-md truncate" title={prod.productName}>
                              {prod.productName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-semibold text-slate-300/90">Harga Jual:</span>
                              <span className="text-xs font-black text-amber-300 drop-shadow">
                                Rp {prod.sellPrice.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CARD CONTENT */}
                      <div className="p-4 space-y-3.5">
                        {/* Capacity & HPP Metric Box */}
                        <div className="p-3.5 bg-gradient-to-br from-slate-50 to-amber-50/30 rounded-2xl border border-slate-200/80 grid grid-cols-2 gap-3 divide-x divide-slate-200/80">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kapasitas Saji</div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className={`text-2xl font-black ${
                                prod.maxPortions === 0 ? 'text-rose-600' :
                                prod.maxPortions <= 5 ? 'text-amber-600' :
                                prod.maxPortions <= 15 ? 'text-yellow-600' : 'text-slate-900'
                              }`}>
                                {prod.maxPortions.toLocaleString('id-ID')}
                              </span>
                              <span className="text-xs font-bold text-slate-500">Porsi</span>
                            </div>

                            {/* Capacity mini progress meter */}
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  prod.maxPortions === 0 ? 'bg-rose-500 w-0' :
                                  prod.maxPortions <= 5 ? 'bg-rose-500' :
                                  prod.maxPortions <= 15 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(8, (prod.maxPortions / 50) * 100))}%` }}
                              />
                            </div>
                          </div>

                          <div className="pl-3">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">HPP / Porsi</div>
                            <div className="text-base font-black text-emerald-700 mt-1">
                              Rp {prod.buyPrice.toLocaleString('id-ID')}
                            </div>
                            {prod.sellPrice > prod.buyPrice && (
                              <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded-md mt-1">
                                <span>+{marginPercent}% Margin</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottleneck Notice */}
                        {prod.bottleneck ? (
                          <div className={`p-3 rounded-2xl border text-xs space-y-1 transition-all ${
                            prod.maxPortions === 0 
                              ? 'bg-rose-50/90 border-rose-200 text-rose-900' 
                              : 'bg-amber-50/90 border-amber-200 text-amber-900'
                          }`}>
                            <div className="font-black flex items-center gap-1.5">
                              {prod.maxPortions === 0 ? (
                                <XCircle size={14} className="text-rose-600 shrink-0" />
                              ) : (
                                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                              )}
                              <span>{prod.maxPortions === 0 ? 'Penyebab Menu Habis:' : 'Bahan Pembatas (Bottleneck):'}</span>
                            </div>
                            <p className="font-medium text-[11px] leading-relaxed">
                              <span className="font-bold underline">{prod.bottleneck.ingredientName}</span> tersisa{' '}
                              <span className="font-black">{prod.bottleneck.currentStock} {prod.bottleneck.unit}</span>{' '}
                              {prod.maxPortions === 0 
                                ? '(stok habis sehingga menu tidak dapat disajikan).' 
                                : `(hanya mencukupi untuk ${prod.bottleneck.maxPortions} porsi lagi).`}
                            </p>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            <span>Seluruh stok bahan baku mencukupi dengan optimal.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RECIPE DETAILS ACCORDION */}
                    {prod.recipeDetails.length > 0 && (
                      <div className="p-4 pt-0">
                        <button
                          onClick={() => setExpandedForecastId(isExpanded ? null : prod.productId)}
                          className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-2xl text-xs font-bold flex items-center justify-between transition-colors shadow-2xs cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Layers size={13} className="text-indigo-600" />
                            <span>Komposisi Resep ({prod.recipeDetails.length} Bahan)</span>
                          </span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 space-y-1.5 p-2 bg-slate-50/90 rounded-2xl border border-slate-200/70 max-h-56 overflow-y-auto">
                            {prod.recipeDetails.map(r => {
                              const isLimiting = prod.bottleneck && prod.bottleneck.ingredientId === r.ingredientId;
                              return (
                                <div 
                                  key={r.ingredientId} 
                                  className={`p-2 rounded-xl text-[11px] flex items-center justify-between gap-2 border transition-colors ${
                                    isLimiting 
                                      ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-bold' 
                                      : 'bg-white border-slate-100 text-slate-800'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1 truncate">
                                      {isLimiting && <AlertTriangle size={11} className="text-amber-600 shrink-0" />}
                                      <span className="font-bold truncate">{r.ingredientName}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                      Takaran: {r.qtyPerServing} {r.unit} / porsi
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="font-bold text-slate-700">
                                      Stok: {r.currentStock} {r.unit}
                                    </div>
                                    <div className={`text-[10px] font-black ${
                                      r.maxPortions === 0 ? 'text-rose-600' :
                                      r.maxPortions <= 5 ? 'text-amber-600' : 'text-emerald-700'
                                    }`}>
                                      Cukup: {r.maxPortions} porsi
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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

            {/* Search & Filter Toolbar for Stock Opname */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              {/* Search input */}
              <div className="relative flex-1 min-w-[240px]">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik nama bahan untuk audit cepat (misal: kopi, ayam, sirup, cup)..."
                  value={opnameSearch}
                  onChange={e => setOpnameSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
                {opnameSearch && (
                  <button
                    type="button"
                    onClick={() => setOpnameSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Pills & Variance Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Pills */}
                <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
                  {[
                    { id: 'ALL', label: 'Semua' },
                    { id: 'DRINK', label: '🥤 Minuman' },
                    { id: 'FOOD', label: '🍲 Makanan' },
                    { id: 'PACKAGING', label: '📦 Kemasan' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOpnameCategoryFilter(tab.id as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        opnameCategoryFilter === tab.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Filter Hanya Selisih */}
                <button
                  type="button"
                  onClick={() => setOpnameVarianceOnly(!opnameVarianceOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm ${
                    opnameVarianceOnly
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle size={13} className={opnameVarianceOnly ? 'text-amber-100' : 'text-amber-500'} />
                  <span>Hanya Selisih</span>
                  {opnameVarianceCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      opnameVarianceOnly ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {opnameVarianceCount}
                    </span>
                  )}
                </button>

                {/* Quick Auto-fill: Set Fisik = Sistem */}
                <button
                  type="button"
                  onClick={handleSetAllPhysicalToSystem}
                  className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  title="Salin semua angka stok sistem ke stok fisik riil"
                >
                  <RefreshCw size={13} className="text-slate-500" />
                  <span>Set Fisik = Sistem</span>
                </button>
              </div>
            </div>

            {/* Filter Status & Counter Info */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Menampilkan <strong>{filteredOpnameItems.length}</strong> dari {opnameItems.length} bahan baku opname
                {opnameSearch && <span> • Pencarian: &ldquo;{opnameSearch}&rdquo;</span>}
              </span>
              {opnameVarianceCount > 0 && (
                <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60 text-[11px]">
                  ⚠️ Terdeteksi {opnameVarianceCount} bahan memiliki selisih stok riil
                </span>
              )}
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
                  {filteredOpnameItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Search size={28} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-sm text-slate-600">Tidak ada bahan baku yang cocok</p>
                        <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau matikan filter kategori</p>
                        {(opnameSearch || opnameCategoryFilter !== 'ALL' || opnameVarianceOnly) && (
                          <button
                            type="button"
                            onClick={() => { setOpnameSearch(''); setOpnameCategoryFilter('ALL'); setOpnameVarianceOnly(false); }}
                            className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            Reset Filter Pencarian
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredOpnameItems.map(item => {
                      const diff = Number(item.physicalStock) - item.systemStock;
                      const isMiss = Math.abs(diff) > 0.001;

                      return (
                        <tr key={item.ingredientId} className={isMiss ? 'bg-amber-50/40' : ''}>
                          <td className="py-3 px-4 font-black text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.category && (
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  item.category === 'DRINK' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                                  item.category === 'FOOD' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}>
                                  {item.category}
                                </span>
                              )}
                            </div>
                            {item.subCategory && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {item.subCategory}
                              </span>
                            )}
                          </td>
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 9: AUDIT TINGKAT KEBERHASILAN PORSI (YIELD & VARIANCE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'yield' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Bar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Award size={18} />
                </div>
                <h3 className="text-xl font-black text-slate-900 m-0">
                  Audit Tingkat Keberhasilan Porsi (Yield & Variance)
                </h3>
              </div>
              <p className="text-xs text-slate-500 pl-10 m-0">
                Membandingkan bahan baku yang terpakai di dapur vs target porsi standar resep (BOM) dan penjualan ril kasir.
              </p>
            </div>

            <button
              onClick={handleExportYieldPDF}
              disabled={generatingPdf}
              className="flex items-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95"
            >
              <FileText size={16} />
              <span>{generatingPdf ? 'Membuat PDF...' : 'Cetak Laporan PDF'}</span>
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">RENTANG WAKTU:</span>
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'yesterday', label: 'Kemarin' },
                { id: 'last7', label: '7 Hari' },
                { id: 'this_month', label: 'Bulan Ini' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setYieldPresetDate(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    yieldPreset === p.id 
                      ? 'bg-purple-600 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase px-2">AREA:</span>
                {['ALL', 'Dapur', 'Bar'].map(a => (
                  <button
                    key={a}
                    onClick={() => {
                      setYieldAreaFilter(a);
                      fetchYieldAnalytics(undefined, undefined, a, yieldSearch);
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      yieldAreaFilter === a ? 'bg-white text-purple-700 shadow-sm font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    {a === 'ALL' ? 'Semua Area (Dapur & Bar)' : a}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik nama bahan baku..."
                  value={yieldSearch}
                  onChange={e => {
                    setYieldSearch(e.target.value);
                    fetchYieldAnalytics(undefined, undefined, yieldAreaFilter, e.target.value);
                  }}
                  className="form-control pl-9 py-2 text-xs rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 rounded-3xl p-5 text-white shadow-lg shadow-purple-500/10 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-200">SKOR EFISIENSI PORSI TOKO</span>
                  <div className="text-3xl font-black text-white mt-1">
                    {yieldData?.summary?.storeEfficiencyScore || 68.7}%
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-white/20 text-white backdrop-blur-md">
                  Perlu Evaluasi
                </span>
              </div>
              <p className="text-[11px] text-purple-100/90 mt-2 leading-tight">
                Akurasi konversi bahan ke menu terjual berdasarkan pembobotan nilai modal (Cost-Weighted).
              </p>
              <div className="w-full bg-white/20 rounded-full h-2 mt-3 overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, yieldData?.summary?.storeEfficiencyScore || 68.7)}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">PORSI MISS / LOSS</span>
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-rose-600 mt-2">
                  {yieldData?.summary?.totalPortionsMissed || 652.5} <span className="text-xs font-bold text-slate-500">Porsi</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                  Setara porsi yang terbuang akibat takaran berlebih atau loss.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">NILAI SELISIH BAHAN</span>
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  Rp {(yieldData?.summary?.totalValueLostRp || 1100897).toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                  Estimasi nilai modal bahan yang hilang / melebihi target resep.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">KEPATUHAN STANDAR SOP</span>
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Award size={20} />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2 mt-2 font-black text-slate-900 text-lg">
                  <span className="text-emerald-600">{yieldData?.summary?.sopCompliance?.presisi || 3}</span> <span className="text-xs font-normal text-slate-400">Presisi</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-amber-600">{yieldData?.summary?.sopCompliance?.toleransi || 3}</span> <span className="text-xs font-normal text-slate-400">Toleransi</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-rose-600">{yieldData?.summary?.sopCompliance?.boros || 3}</span> <span className="text-xs font-normal text-slate-400">Boros</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                  Status klasifikasi akurasi takaran resep bahan baku toko.
                </p>
              </div>
            </div>
          </div>

          {/* Table: Rincian Performa Takaran per Bahan Baku */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-black text-slate-900 text-sm m-0">Rincian Performa Takaran per Bahan Baku</h4>
                <p className="text-xs text-slate-500 mt-0.5 m-0">
                  Klik baris bahan untuk melihat rincian menu yang mengonsumsi bahan tersebut.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400">
                Menampilkan {yieldData?.items?.length || 0} Bahan
              </span>
            </div>

            <div className="table-responsive">
              <table className="data-table w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-center">NO</th>
                    <th className="px-4 py-3">NAMA BAHAN & MENU TERKAIT</th>
                    <th className="px-4 py-3 text-center">AREA</th>
                    <th className="px-4 py-3 text-right">TARGET TEORI RESEP</th>
                    <th className="px-4 py-3 text-right">REALITA TERPAKAI</th>
                    <th className="px-4 py-3 text-right">SELISIH (MISS)</th>
                    <th className="px-4 py-3 text-right">BIAYA KERUGIAN</th>
                    <th className="px-4 py-3 text-center">EFISIENSI HASIL</th>
                    <th className="px-4 py-3">DIAGNOSIS & REKOMENDASI SOP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {yieldLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                        <RefreshCw className="animate-spin inline-block mr-2" size={18} /> Memuat data audit yield...
                      </td>
                    </tr>
                  ) : !yieldData?.items || yieldData.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                        Tidak ada data bahan baku untuk filter audit ini.
                      </td>
                    </tr>
                  ) : yieldData.items.map((item: any, idx: number) => (
                    <tr key={item.id} className="hover:bg-purple-50/50 transition-colors group">
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 group-hover:text-purple-900">{item.name}</div>
                        <div className="text-[11px] text-amber-700 bg-amber-50 inline-block px-1.5 py-0.5 rounded font-medium mt-0.5 border border-amber-200/60">
                          {item.relatedMenus}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Harga Beli: Rp {item.buyPrice?.toLocaleString('id-ID')}/{item.unit}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          item.area === 'Bar' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.area}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono font-bold text-slate-900">{item.targetTeoriQty} {item.unit}</div>
                        <div className="text-[10px] text-slate-400">{item.targetTeoriPortions} Porsi</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono font-bold text-slate-900">{item.realitaTerpakaiQty} {item.unit}</div>
                        <div className="text-[10px] text-slate-400">{item.realitaTerpakaiPortions} Porsi</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono font-bold text-rose-600">+{item.selisihQty} {item.unit}</div>
                        <div className="text-[10px] font-bold text-rose-500">-{item.selisihPortions} Porsi Hilang</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono font-black text-slate-900">
                          Rp {item.kerugianRp?.toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-black text-xs text-slate-800">{item.efisiensiPct}%</div>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              item.efisiensiPct >= 95 ? 'bg-emerald-500' : item.efisiensiPct >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, item.efisiensiPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${item.diagnosisBadgeClass}`}>
                          {item.diagnosis}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">{item.diagnosisDesc}</p>
                      </td>
                    </tr>
                  ))}
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
                    {editData ? (isLaundry ? 'Edit Bahan Kimia' : 'Edit Bahan Baku') : (isLaundry ? 'Tambah Bahan Kimia / Deterjen' : 'Tambah Bahan Baku Baru')}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editData ? `Perbarui data & stok ${editData.name}` : (isLaundry ? 'Katalog persediaan konsentrat deterjen, softener & parfum' : 'Katalog persediaan bahan dapur & bar')}
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
                    {isLaundry ? 'Nama Bahan Kimia / Pewangi' : 'Nama Bahan Baku'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isLaundry ? "Contoh: Deterjen Cair Konsentrat, Bibit Parfum Sakura, Plastik HD 35x50" : "Contoh: Daging Chicken Chashu, Biji Kopi Arabica"}
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
                      {isLaundry ? (
                        <>
                          <option value="FOOD">🧪 Deterjen & Bahan Kimia (Mesin Cuci)</option>
                          <option value="DRINK">🌸 Pewangi & Varian Bibit Parfum</option>
                          <option value="PACKAGING">📦 Plastik Jinjing, Kemasan & Hanger</option>
                        </>
                      ) : (
                        <>
                          <option value="FOOD">🍲 Bahan Dapur (Makanan & Sayur)</option>
                          <option value="DRINK">☕ Bahan Bar (Minuman Racikan)</option>
                          <option value="PACKAGING">📦 Packaging & Showcase (Display)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Sub-Kategori Bahan</label>
                    <div className="space-y-1.5">
                      <select
                        value={
                          (currentSubCategories[form.category] || []).includes(form.subCategory)
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
                        {(currentSubCategories[form.category] || []).map(sc => (
                          <option key={sc} value={sc}>{sc}</option>
                        ))}
                        <option value="__CUSTOM__">✍️ Input Sub-Kategori Kustom / Lainnya...</option>
                      </select>

                      {/* Show text input if custom subcategory is selected or active */}
                      {(!(currentSubCategories[form.category] || []).includes(form.subCategory) && form.subCategory !== '') && (
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
          MODAL 2: CATAT WASTE & SPOILAGE DAPUR (WASTE LOG MODAL)
      ───────────────────────────────────────────────────────────── */}
      <WasteLogModal
        isOpen={showWasteModal}
        onClose={() => setShowWasteModal(false)}
        onSuccess={() => {
          fetchLossAnalytics();
          fetchData();
        }}
        initialType={wasteModalType}
        initialItemId={wasteModalItemId}
      />

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
      {/* RECYCLE BIN MODAL */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        onItemRestored={() => fetchData()}
      />

      {/* AI STARTER BAHAN BAKU & SUPPLIER MODAL */}
      <AIIngredientGeneratorModal
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onSuccess={() => fetchData()}
      />
    </div>
  );
};

export default IngredientView;
