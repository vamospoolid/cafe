import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Printer, RefreshCw, Plus, Minus, Trash2, 
  Sparkles, AlertCircle, Search, Layers, Tag, Eye
} from 'lucide-react';
import { generateBarcodeSvgString } from '../utils/barcode128';
import { usePOS } from '../context/POSContext';
import { toast } from '../utils/alert';

export interface BarcodeProductItem {
  id: number;
  name: string;
  barcode?: string;
  category?: { name: string };
  sellPrice?: number;
  sellPriceRetail?: number;
  sellPriceMitra?: number;
  sellPriceGrosir?: number;
  stock?: number;
  qtyToPrint: number;
}

interface BarcodeLabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: any[];
  initialSelectedProducts?: any[];
  onProductsUpdated?: () => void;
}

// 9 Preset Ukuran Standard Bengkel & Retail Indonesia
interface LabelPreset {
  id: string;
  name: string;
  dimension: string;
  columns: number;
  widthMm: number;
  heightMm: number;
  pageSize: string;
  barcodeHeight: number;
  barcodeWidth: number;
  fontSizeName: string;
  fontSizePrice: string;
}

const LABEL_PRESETS: LabelPreset[] = [
  {
    id: 'small',
    name: 'Small',
    dimension: '40 × 20 mm',
    columns: 1,
    widthMm: 40,
    heightMm: 20,
    pageSize: '40mm 20mm',
    barcodeHeight: 24,
    barcodeWidth: 1.1,
    fontSizeName: 'text-[9px]',
    fontSizePrice: 'text-[10px]'
  },
  {
    id: 'medium',
    name: 'Medium',
    dimension: '60 × 30 mm',
    columns: 1,
    widthMm: 60,
    heightMm: 30,
    pageSize: '60mm 30mm',
    barcodeHeight: 38,
    barcodeWidth: 1.5,
    fontSizeName: 'text-[11px]',
    fontSizePrice: 'text-xs'
  },
  {
    id: 'large',
    name: 'Large',
    dimension: '80 × 40 mm',
    columns: 1,
    widthMm: 80,
    heightMm: 40,
    pageSize: '80mm 40mm',
    barcodeHeight: 48,
    barcodeWidth: 1.8,
    fontSizeName: 'text-xs',
    fontSizePrice: 'text-sm'
  },
  {
    id: 'col2_52mm',
    name: 'Label 2 Kolom (52mm)',
    dimension: '24 × 15 mm (2 Kolom - 52mm)',
    columns: 2,
    widthMm: 24,
    heightMm: 15,
    pageSize: '52mm 15mm',
    barcodeHeight: 18,
    barcodeWidth: 0.85,
    fontSizeName: 'text-[8px]',
    fontSizePrice: 'text-[8.5px]'
  },
  {
    id: 'col2_33x15',
    name: 'Label Harga 2 Kol',
    dimension: '33 × 15 mm (2 Kolom)',
    columns: 2,
    widthMm: 33,
    heightMm: 15,
    pageSize: '75mm 15mm',
    barcodeHeight: 20,
    barcodeWidth: 0.95,
    fontSizeName: 'text-[8px]',
    fontSizePrice: 'text-[9px]'
  },
  {
    id: 'col3_33x15',
    name: 'Label Harga 3 Kol',
    dimension: '33 × 15 mm (3 Kolom)',
    columns: 3,
    widthMm: 33,
    heightMm: 15,
    pageSize: '105mm 15mm',
    barcodeHeight: 20,
    barcodeWidth: 0.9,
    fontSizeName: 'text-[8px]',
    fontSizePrice: 'text-[8.5px]'
  },
  {
    id: 'col1_40x30',
    name: 'Label 40x30 (1 Kol)',
    dimension: '40 × 30 mm (1 Kolom)',
    columns: 1,
    widthMm: 40,
    heightMm: 30,
    pageSize: '40mm 30mm',
    barcodeHeight: 32,
    barcodeWidth: 1.2,
    fontSizeName: 'text-[9.5px]',
    fontSizePrice: 'text-[11px]'
  },
  {
    id: 'resi_portrait',
    name: 'Resi Portrait',
    dimension: '70 × 100 mm (Portrait)',
    columns: 1,
    widthMm: 70,
    heightMm: 100,
    pageSize: '70mm 100mm',
    barcodeHeight: 65,
    barcodeWidth: 2.0,
    fontSizeName: 'text-sm',
    fontSizePrice: 'text-base'
  },
  {
    id: 'resi_landscape',
    name: 'Resi Landscape',
    dimension: '100 × 70 mm (Landscape)',
    columns: 1,
    widthMm: 100,
    heightMm: 70,
    pageSize: '100mm 70mm',
    barcodeHeight: 55,
    barcodeWidth: 2.0,
    fontSizeName: 'text-sm',
    fontSizePrice: 'text-base'
  }
];

export const BarcodeLabelPrintModal: React.FC<BarcodeLabelPrintModalProps> = ({
  isOpen,
  onClose,
  allProducts,
  initialSelectedProducts = [],
  onProductsUpdated
}) => {
  const { settings, token } = usePOS();

  // Selected Preset (Default: Medium 60x30mm)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('medium');
  
  // Customization Toggles
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [labelDesignStyle, setLabelDesignStyle] = useState<'landscape_split' | 'stacked'>('landscape_split');
  const [priceTier, setPriceTier] = useState<'retail' | 'mitra' | 'grosir'>('retail');

  // Preview Columns Override (1, 2, 3 or auto)
  const [previewColumnsOverride, setPreviewColumnsOverride] = useState<number | 'auto'>('auto');

  // Items queue
  const [items, setItems] = useState<BarcodeProductItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  // Active Preset Object
  const currentPreset = useMemo(() => {
    return LABEL_PRESETS.find(p => p.id === selectedPresetId) || LABEL_PRESETS[1];
  }, [selectedPresetId]);

  // Preview Column Count
  const effectivePreviewColumns = previewColumnsOverride === 'auto' ? currentPreset.columns : previewColumnsOverride;

  // Initialize queue when opened
  useEffect(() => {
    if (!isOpen) return;

    if (initialSelectedProducts && initialSelectedProducts.length > 0) {
      setItems(
        initialSelectedProducts.map(p => ({
          ...p,
          qtyToPrint: Math.max(1, p.stock && p.stock > 0 ? p.stock : 1)
        }))
      );
    } else {
      setItems(
        allProducts.slice(0, 6).map(p => ({
          ...p,
          qtyToPrint: 1
        }))
      );
    }
  }, [isOpen, initialSelectedProducts, allProducts]);

  if (!isOpen) return null;

  // Total labels to print
  const totalLabels = items.reduce((sum, item) => sum + (item.qtyToPrint || 0), 0);

  // Missing barcodes count
  const missingBarcodeItems = items.filter(i => !i.barcode || i.barcode.trim() === '');

  // Flattened array for printing & live preview
  const flattenedLabels = useMemo(() => {
    const list: BarcodeProductItem[] = [];
    items.forEach(item => {
      const qty = Math.max(1, item.qtyToPrint || 1);
      for (let i = 0; i < qty; i++) {
        list.push(item);
      }
    });
    return list;
  }, [items]);

  // Subtitle Product Name preview
  const headerSubtitle = items.length === 1 
    ? items[0].name 
    : items.length > 1 
    ? `${items.length} Sparepart Bengkel Terpilih (${totalLabels} Lembar)`
    : 'Pilih produk untuk dicetak';

  // Stepper Qty
  const handleUpdateQty = (id: number, delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(1, (item.qtyToPrint || 1) + delta);
          return { ...item, qtyToPrint: newQty };
        }
        return item;
      })
    );
  };

  const handleSetQty = (id: number, val: number) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, qtyToPrint: Math.max(1, val || 1) } : item))
    );
  };

  const handleRemoveItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Add Product to Queue
  const handleAddProduct = (prod: any) => {
    if (items.some(i => i.id === prod.id)) {
      handleUpdateQty(prod.id, 1);
      toast(`Menambah qty cetak ${prod.name}`, 'info');
      return;
    }
    setItems(prev => [...prev, { ...prod, qtyToPrint: 1 }]);
    setSearchProductQuery('');
  };

  // Generate / Regenerate Barcode (Single or Bulk)
  const handleGenerateBarcodes = async (targetId?: number, forceRegen: boolean = false) => {
    if (!token) return;
    
    if (targetId) setRegeneratingId(targetId);
    else setIsGenerating(true);

    try {
      const ids = targetId ? [targetId] : missingBarcodeItems.map(i => i.id);
      if (ids.length === 0 && !forceRegen) {
        toast('Semua produk di antrean sudah memiliki barcode', 'info');
        return;
      }

      const res = await fetch('/api/products/generate-missing-barcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          productIds: ids,
          forceRegenerate: forceRegen
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate barcode');

      // Update local state
      const updatedMap = new Map<number, string>();
      (data.products || []).forEach((p: any) => {
        updatedMap.set(p.id, p.barcode);
      });

      setItems(prev =>
        prev.map(item => {
          if (updatedMap.has(item.id)) {
            return { ...item, barcode: updatedMap.get(item.id) };
          }
          return item;
        })
      );

      toast(data.message || 'Barcode berhasil digenerate otomatis!', 'success');
      if (onProductsUpdated) onProductsUpdated();
    } catch (err: any) {
      toast(err.message || 'Gagal generate barcode', 'error');
    } finally {
      setIsGenerating(false);
      setRegeneratingId(null);
    }
  };

  // Formatter Currency
  const formatRupiah = (val?: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;

  // Execute Print
  const handlePrint = () => {
    window.print();
  };

  // Filter available products
  const filteredAvailable = searchProductQuery.trim()
    ? allProducts
        .filter(
          p =>
            p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchProductQuery.toLowerCase()))
        )
        .slice(0, 5)
    : [];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* MODAL WRAPPER (Harmonized with CodePOS Light UX: Wide 2-Column Split) */}
      <div 
        className="bg-white text-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="p-4 sm:px-6 border-b border-slate-200/90 flex items-center justify-between shrink-0 print:hidden bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-700 flex items-center justify-center text-white shadow-md shadow-purple-600/20">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
                Generate Label Barcode
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-md">
                {headerSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition active:scale-95 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY CONTAINER (Side-by-Side: Settings Left, Preview Right) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden print:hidden min-h-0">
          
          {/* SISI KIRI: PENGATURAN, DESAIN & DAFTAR BARANG (40%) */}
          <div className="w-full md:w-[42%] lg:w-[40%] border-b md:border-b-0 md:border-r border-slate-200 flex flex-col overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/80 scrollbar-thin shrink-0">
            
            {/* 1. UKURAN LABEL (9 PRESETS) */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 tracking-wider uppercase mb-2">
                Ukuran Label
              </label>
              
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {LABEL_PRESETS.map(preset => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`w-full py-2 px-3.5 rounded-xl border flex items-center justify-between text-left transition cursor-pointer select-none ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold shadow-xs ring-1 ring-purple-500/40'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{preset.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {preset.columns > 1 ? `Kertas Roll ${preset.columns} Kolom` : 'Kertas Roll 1 Kolom'}
                        </span>
                      </div>
                      <span className={`text-[11px] font-mono ${isSelected ? 'text-purple-700 font-bold' : 'text-slate-400'}`}>
                        {preset.dimension}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1B. GAYA DESAIN STIKER (LANDSCAPE 2 KOLOM VS VERTIKAL TUMPUK) */}
            <div>
              <label className="block text-[11px] font-black text-slate-500 tracking-wider uppercase mb-2">
                Gaya Desain Stiker
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLabelDesignStyle('landscape_split')}
                  className={`p-2.5 rounded-2xl border flex flex-col items-start gap-1 transition cursor-pointer text-left ${
                    labelDesignStyle === 'landscape_split'
                      ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-1 ring-purple-500/40 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span>Landscape 2 Kolom</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Kiri info &amp; harga, kanan barcode (Sangat populer di bengkel)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLabelDesignStyle('stacked')}
                  className={`p-2.5 rounded-2xl border flex flex-col items-start gap-1 transition cursor-pointer text-left ${
                    labelDesignStyle === 'stacked'
                      ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-1 ring-purple-500/40 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className={`w-2 h-2 rounded-full ${labelDesignStyle === 'stacked' ? 'bg-purple-600' : 'bg-slate-300'}`} />
                    <span>Vertikal Tumpuk</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Tumpuk tengah atas-bawah (Format klasik retail)
                  </span>
                </button>
              </div>
            </div>

            {/* 2. AUTO-GENERATE BARCODE BANNER JIKA ADA YANG KOSONG */}
            {missingBarcodeItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-amber-900">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>Ada <strong>{missingBarcodeItems.length} produk</strong> belum memiliki barcode</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateBarcodes(undefined, false)}
                  disabled={isGenerating}
                  className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>{isGenerating ? 'Membuat Barcode...' : 'Auto-Generate Semua Barcode Kosong'}</span>
                </button>
              </div>
            )}

            {/* 3. DAFTAR BARANG & JUMLAH */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black text-slate-500 tracking-wider uppercase">
                  Daftar Barang &amp; Jumlah
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">{items.length} item antrean</span>
              </div>

              {/* Search Add Product */}
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchProductQuery}
                  onChange={e => setSearchProductQuery(e.target.value)}
                  placeholder="+ Tambah produk lain ke antrean..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-2xs"
                />

                {filteredAvailable.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {filteredAvailable.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-slate-800 block truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.barcode || 'Belum ada barcode'}
                          </span>
                        </div>
                        <span className="text-purple-700 font-bold text-[11px] shrink-0">
                          + Tambah
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items List Stepper */}
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                {items.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-white">
                    <span>Belum ada barang di antrean</span>
                  </div>
                ) : (
                  items.map(item => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="font-bold text-xs text-slate-800 truncate uppercase tracking-tight" title={item.name}>
                          {item.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono">{item.barcode || 'SK-NOBARCODE'}</span>
                          
                          {/* Button Regenerate Single Barcode */}
                          <button
                            type="button"
                            onClick={() => handleGenerateBarcodes(item.id, true)}
                            disabled={regeneratingId === item.id}
                            className="p-1 rounded text-purple-600 hover:text-purple-800 hover:bg-purple-50 transition cursor-pointer"
                            title="Generate / Buat ulang barcode acak baru"
                          >
                            <RefreshCw size={11} className={regeneratingId === item.id ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </div>

                      {/* Stepper Controls exact to reference: [-] Qty [+] */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 cursor-pointer border border-slate-200/60"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.qtyToPrint}
                          onChange={e => handleSetQty(item.id, parseInt(e.target.value) || 1)}
                          className="w-9 h-7 text-center text-xs font-black bg-transparent text-slate-900 border-none focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 cursor-pointer border border-slate-200/60"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition ml-0.5 cursor-pointer"
                          title="Hapus dari antrean"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. TOTAL LABEL & TOGGLES (Matching Reference) */}
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Total Label:</span>
                <span className="font-black text-purple-700 text-sm">
                  {totalLabels} Lembar
                </span>
              </div>

              {/* Toggle Harga & Pilihan Tier Harga */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Harga</span>
                    <span className="text-[10px] text-slate-400">Tampilkan nominal di label</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrice(!showPrice)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                      showPrice ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition" />
                  </button>
                </div>

                {showPrice && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPriceTier('retail')}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        priceTier === 'retail'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Eceran
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceTier('mitra')}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        priceTier === 'mitra'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Mitra/Bengkel
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceTier('grosir')}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        priceTier === 'grosir'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Grosir
                    </button>
                  </div>
                )}
              </div>

              {/* Toggle Nama Bengkel */}
              <div className="flex items-center justify-between bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <span className="font-bold text-xs text-slate-800 block">Nama Bengkel</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">{settings?.storeName || 'BENGKEL'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoreName(!showStoreName)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                    showStoreName ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition" />
                </button>
              </div>
            </div>

          </div>

          {/* SISI KANAN: PREVIEW LABEL STIKER & TOMBOL CETAK (FLEX-1) */}
          <div className="flex-1 flex flex-col bg-slate-100/90 p-4 sm:p-6 overflow-hidden justify-between min-h-0">
            
            {/* PREVIEW HEADER */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Eye size={14} className="text-purple-600" />
                <span>Preview Label ({labelDesignStyle === 'landscape_split' ? 'Landscape 2 Kolom' : 'Vertikal Tumpuk'})</span>
              </span>

              {/* Preview Kolom Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Layout Roll:</span>
                <select
                  value={previewColumnsOverride}
                  onChange={e => setPreviewColumnsOverride(e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-semibold focus:outline-none focus:border-purple-500 shadow-2xs cursor-pointer"
                >
                  <option value="auto">Auto ({currentPreset.columns} Kolom Roll)</option>
                  <option value="1">1 Kolom</option>
                  <option value="2">2 Kolom</option>
                  <option value="3">3 Kolom</option>
                </select>
              </div>
            </div>

            {/* PREVIEW CANVAS (Clean Slate Canvas with White Thermal Sticker) */}
            <div className="flex-1 bg-slate-200/60 rounded-3xl p-4 sm:p-6 border border-slate-300/80 flex items-center justify-center overflow-y-auto scrollbar-thin shadow-inner min-h-0">
              {flattenedLabels.length === 0 ? (
                <div className="text-slate-400 text-xs">Pilih produk untuk melihat preview</div>
              ) : (
                <div
                  className={`w-full grid gap-3 max-h-full overflow-y-auto p-2 scrollbar-thin justify-items-center ${
                    effectivePreviewColumns === 1
                      ? 'grid-cols-1 max-w-[360px]'
                      : effectivePreviewColumns === 2
                      ? 'grid-cols-2 max-w-[540px]'
                      : 'grid-cols-3 max-w-[680px]'
                  }`}
                >
                  {flattenedLabels.slice(0, 12).map((prod, idx) => {
                    const priceVal = 
                      priceTier === 'mitra' 
                        ? (prod.sellPriceMitra || prod.sellPriceRetail || prod.sellPrice || 0)
                        : priceTier === 'grosir'
                        ? (prod.sellPriceGrosir || prod.sellPriceRetail || prod.sellPrice || 0)
                        : (prod.sellPriceRetail ?? prod.sellPrice ?? 0);

                    return labelDesignStyle === 'landscape_split' ? (
                      /* =================================================== */
                      /* DESIGN A: LANDSCAPE 2-COLUMN SPLIT (USER REQUEST)   */
                      /* Left: Store + Product + Price | Right: SVG Barcode   */
                      /* =================================================== */
                      <div
                        key={idx}
                        className="bg-white text-slate-900 rounded-xl p-3 flex flex-row items-center justify-between text-left select-none shadow-md border border-slate-300 w-full gap-2.5 overflow-hidden transition hover:shadow-lg"
                        style={{
                          minHeight: Math.max(76, currentPreset.heightMm * 2.8) + 'px'
                        }}
                      >
                        {/* Left Column: Info & Price */}
                        <div className="flex-1 flex flex-col justify-between h-full min-w-0 pr-1">
                          <div>
                            {showStoreName && (
                              <div className="font-black text-[8px] uppercase tracking-wider text-purple-900 truncate">
                                {settings?.storeName || 'BENGKEL RESMI'}
                              </div>
                            )}
                            <div className="font-black text-slate-900 uppercase tracking-tight line-clamp-2 mt-0.5 leading-snug text-[10.5px]">
                              {prod.name}
                            </div>
                          </div>

                          {showPrice && priceVal > 0 && (
                            <div className="mt-1.5 pt-0.5">
                              <span className="text-[7.5px] font-bold text-slate-400 block uppercase leading-none">
                                {priceTier === 'mitra' ? 'Harga Mitra' : priceTier === 'grosir' ? 'Harga Grosir' : 'Harga Eceran'}
                              </span>
                              <span className="font-black text-slate-950 tracking-tight leading-none text-xs sm:text-sm">
                                {formatRupiah(priceVal)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right Column: Barcode SVG + Number */}
                        <div className="w-[45%] shrink-0 flex flex-col items-center justify-center pl-2 border-l border-dashed border-slate-200">
                          <div 
                            className="w-full flex justify-center overflow-hidden"
                            dangerouslySetInnerHTML={{
                              __html: generateBarcodeSvgString(
                                prod.barcode || '000000000000',
                                Math.max(26, currentPreset.barcodeHeight - 6),
                                Math.max(0.85, currentPreset.barcodeWidth * 0.82),
                                false
                              )
                            }}
                          />
                          <div className="font-mono text-[8px] font-bold text-slate-700 tracking-wider mt-1 text-center truncate max-w-full">
                            {prod.barcode || 'SK-00000'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* =================================================== */
                      /* DESIGN B: VERTIKAL TUMPUK KLASIK                    */
                      /* =================================================== */
                      <div
                        key={idx}
                        className="bg-white text-slate-900 rounded-xl p-2.5 flex flex-col items-center justify-between text-center select-none shadow-md border border-slate-300 w-full transition hover:shadow-lg"
                        style={{
                          minHeight: currentPreset.heightMm * 2.8 + 'px'
                        }}
                      >
                        {/* Header Store Name */}
                        {showStoreName && (
                          <div className="font-black text-[9px] uppercase tracking-tight text-slate-900 truncate w-full">
                            {settings?.storeName || 'BENGKEL RESMI'}
                          </div>
                        )}

                        {/* Product Name */}
                        <div className={`font-black text-slate-900 uppercase tracking-tight line-clamp-1 w-full mt-0.5 ${currentPreset.fontSizeName}`}>
                          {prod.name}
                        </div>

                        {/* SVG Barcode Vector */}
                        <div 
                          className="w-full flex justify-center my-1"
                          dangerouslySetInnerHTML={{
                            __html: generateBarcodeSvgString(
                              prod.barcode || '000000000000',
                              currentPreset.barcodeHeight,
                              currentPreset.barcodeWidth,
                              false
                            )
                          }}
                        />

                        {/* Barcode Number SKU */}
                        <div className="font-mono text-[9px] font-bold text-slate-700 tracking-wider">
                          {prod.barcode || 'SK-00000'}
                        </div>

                        {/* Price */}
                        {showPrice && priceVal > 0 && (
                          <div className={`font-black text-slate-900 mt-0.5 ${currentPreset.fontSizePrice}`}>
                            {formatRupiah(priceVal)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BOTTOM ACTION BUTTONS */}
            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                disabled={items.length === 0}
                className="flex-1 py-3.5 px-5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-700/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Printer size={16} />
                <span>Cetak Langsung (Silent)</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={items.length === 0}
                className="py-3.5 px-6 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-2xl border border-slate-300 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Dialog Browser
              </button>
            </div>

          </div>

        </div>

        {/* ============================================================== */}
        {/* PRINTABLE AREA (Visible ONLY during window.print)               */}
        {/* ============================================================== */}
        <div id="barcode-printable-area" className="hidden print:block w-full">
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  margin: 0 !important;
                  size: ${currentPreset.pageSize} !important;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #fff !important;
                }
                .barcode-print-container {
                  display: grid;
                  grid-template-columns: repeat(${currentPreset.columns}, 1fr);
                  width: 100%;
                  box-sizing: border-box;
                }
                .barcode-label-box {
                  page-break-inside: avoid;
                  break-inside: avoid;
                  box-sizing: border-box;
                  overflow: hidden;
                  height: ${currentPreset.heightMm}mm;
                }
                .barcode-label-box.style-stacked {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                  padding: 1.5mm;
                }
                .barcode-label-box.style-landscape {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  padding: 1.5mm 2.5mm;
                  text-align: left;
                }
                .barcode-label-box.style-landscape .label-left {
                  flex: 1 1 55%;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  height: 100%;
                  overflow: hidden;
                  padding-right: 1.5mm;
                }
                .barcode-label-box.style-landscape .label-right {
                  flex: 1 1 45%;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                  border-left: 0.5px dashed #ccc;
                  padding-left: 1mm;
                }
              }
            `
          }} />

          <div className="barcode-print-container">
            {flattenedLabels.map((prod, idx) => {
              const priceVal = 
                priceTier === 'mitra' 
                  ? (prod.sellPriceMitra || prod.sellPriceRetail || prod.sellPrice || 0)
                  : priceTier === 'grosir'
                  ? (prod.sellPriceGrosir || prod.sellPriceRetail || prod.sellPrice || 0)
                  : (prod.sellPriceRetail ?? prod.sellPrice ?? 0);

              return labelDesignStyle === 'landscape_split' ? (
                /* Landscape 2-Column Split Print Box */
                <div key={idx} className="barcode-label-box style-landscape">
                  <div className="label-left">
                    <div>
                      {showStoreName && (
                        <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1 }}>
                          {settings?.storeName || 'BENGKEL'}
                        </div>
                      )}
                      <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.15, marginTop: '0.6mm', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {prod.name}
                      </div>
                    </div>
                    {showPrice && priceVal > 0 && (
                      <div style={{ fontSize: '8.5pt', fontWeight: 900, marginTop: '0.6mm', lineHeight: 1 }}>
                        {formatRupiah(priceVal)}
                      </div>
                    )}
                  </div>
                  <div className="label-right">
                    <div 
                      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                      dangerouslySetInnerHTML={{
                        __html: generateBarcodeSvgString(
                          prod.barcode || '000000000000',
                          Math.max(16, currentPreset.barcodeHeight - 8),
                          Math.max(0.75, currentPreset.barcodeWidth * 0.8),
                          false
                        )
                      }}
                    />
                    <div style={{ fontFamily: 'monospace', fontSize: '6.5pt', fontWeight: 'bold', marginTop: '0.4mm' }}>
                      {prod.barcode || '000000000000'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Stacked Print Box */
                <div key={idx} className="barcode-label-box style-stacked">
                  {showStoreName && (
                    <div style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>
                      {settings?.storeName || 'BENGKEL'}
                    </div>
                  )}

                  <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', lineHeight: 1.1, marginTop: '0.8mm' }}>
                    {prod.name}
                  </div>

                  <div 
                    style={{ width: '100%', margin: '0.8mm 0', display: 'flex', justifyContent: 'center' }}
                    dangerouslySetInnerHTML={{
                      __html: generateBarcodeSvgString(
                        prod.barcode || '000000000000',
                        currentPreset.barcodeHeight,
                        currentPreset.barcodeWidth,
                        false
                      )
                    }}
                  />

                  <div style={{ fontFamily: 'monospace', fontSize: '7pt', fontWeight: 'bold' }}>
                    {prod.barcode || '000000000000'}
                  </div>

                  {showPrice && priceVal > 0 && (
                    <div style={{ fontSize: '8pt', fontWeight: 900, marginTop: '0.5mm' }}>
                      {formatRupiah(priceVal)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BarcodeLabelPrintModal;
