import React, { useState } from 'react';
import { 
  Barcode, Printer, Sliders, Eye, Check, Sparkles, 
  Tag, Store, RefreshCw, CheckCircle, MapPin, Layers
} from 'lucide-react';
import { toast } from '../../utils/alert';
import { LABEL_PRESETS, type LabelPreset } from '../BarcodeLabelPrintModal';
import { generateBarcodeSvgString } from '../../utils/barcode128';

interface SettingsBarcodePrinterProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleSave: (e: React.FormEvent) => Promise<void>;
  token?: string | null;
}

export const SettingsBarcodePrinter: React.FC<SettingsBarcodePrinterProps> = ({
  formData,
  setFormData,
  handleSave,
  token
}) => {
  const [saving, setSaving] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);

  // Read current configuration
  const currentPresetId = formData.barcodeLabelPreset || 'medium';
  const currentDesign = formData.barcodeLabelDesign || 'landscape_split';
  const showPrice = formData.barcodeLabelShowPrice !== false;
  const showStore = formData.barcodeLabelShowStore !== false;
  const showBrandRak = formData.barcodeLabelShowBrandRak !== false;
  const priceTier = formData.barcodeLabelPriceTier || 'retail';

  const selectedPreset: LabelPreset = LABEL_PRESETS.find(p => p.id === currentPresetId) || LABEL_PRESETS[1];

  // Handlers for instant updates
  const handleSelectPreset = (id: string) => {
    setFormData((prev: any) => ({ ...prev, barcodeLabelPreset: id }));
    localStorage.setItem('barcode_label_preset', id);
  };

  const handleSelectDesign = (design: 'landscape_split' | 'stacked') => {
    setFormData((prev: any) => ({ ...prev, barcodeLabelDesign: design }));
    localStorage.setItem('barcode_label_design', design);
  };

  const handleTogglePrice = (val: boolean) => {
    setFormData((prev: any) => ({ ...prev, barcodeLabelShowPrice: val }));
    localStorage.setItem('barcode_label_show_price', String(val));
  };

  const handleToggleStore = (val: boolean) => {
    setFormData((prev: any) => ({ ...prev, barcodeLabelShowStore: val }));
    localStorage.setItem('barcode_label_show_store', String(val));
  };

  const handleToggleBrandRak = (val: boolean) => {
    setFormData((prev: any) => ({ ...prev, barcodeLabelShowBrandRak: val }));
    localStorage.setItem('barcode_label_show_brand_rak', String(val));
  };

  const handleSelectTier = (tier: string) => {
    setFormData((prev: any) => ({ ...prev, barcodeLabelPriceTier: tier }));
    localStorage.setItem('barcode_label_price_tier', tier);
  };

  const onSaveClick = async (e: React.FormEvent) => {
    setSaving(true);
    try {
      await handleSave(e);
      toast('✅ Pengaturan Default Printer Barcode berhasil disimpan!', 'success');
    } catch {
      toast('Gagal menyimpan pengaturan barcode', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Uji Cetak 1 Lembar Kalibrasi via native print
  const handleTestPrint = () => {
    setTestPrinting(true);
    toast('Membuka dialog cetak kalibrasi stiker...', 'info');
    setTimeout(() => {
      window.print();
      setTestPrinting(false);
    }, 300);
  };

  // Sample data for preview
  const sampleProduct = {
    name: 'OLI MESIN MPX2 0.8L MATIC',
    barcode: '8991001234567',
    brand: 'AHM HONDA',
    storageLocation: 'RAK A-02',
    price: 58000
  };

  return (
    <div className="space-y-6">
      
      {/* ── BANNER INFORMASI HARDWARE ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-900/10 via-indigo-900/5 to-transparent border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Barcode className="text-purple-700" size={20} />
            <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">
              Konfigurasi Hardware Printer Barcode &amp; Stiker Label
            </h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Atur ukuran kertas thermal stiker bawaan toko, gaya desain 2-kolom, dan data identitas yang otomatis tercetak. 
            Kompatibel dengan printer label USB / Bluetooth (Xprinter, Zebra, Blueprint, Panda, Kassen, TSC, Postek, dll).
          </p>
        </div>

        <button
          type="button"
          onClick={handleTestPrint}
          disabled={testPrinting}
          className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
          title="Uji cetak 1 lembar stiker ke printer barcode Anda"
        >
          <Printer size={15} />
          <span>{testPrinting ? 'Mencetak...' : 'Uji Cetak 1 Lembar'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── KOLOM KIRI (7/12): KONTROL PENGATURAN ── */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. PRESET UKURAN KERTAS DEFAULT */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                  <Sliders size={15} className="text-purple-600" />
                  <span>Preset Ukuran Kertas Stiker Default</span>
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pilih ukuran kertas roll yang terpasang di printer barcode toko Anda
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {selectedPreset.dimension}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {LABEL_PRESETS.map(preset => {
                const isSelected = currentPresetId === preset.id;
                const isBengkelFav = preset.id === 'medium';
                const isRetailFav = preset.id === 'col2_52mm';

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer select-none relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-2 ring-purple-500/30 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="font-bold text-xs block">{preset.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{preset.dimension}</span>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-white/80 border border-slate-200/80 text-slate-600">
                        {preset.columns > 1 ? `Kertas Roll ${preset.columns} Kolom` : '1 Kolom Roll'}
                      </span>
                      {isBengkelFav && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          Favorit Bengkel
                        </span>
                      )}
                      {isRetailFav && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Favorit Retail
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. GAYA DESAIN STIKER DEFAULT */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div>
              <h5 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Layers size={15} className="text-purple-600" />
                <span>Gaya Desain Stiker Bawaan</span>
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pilih susunan tata letak teks dan barcode pada kertas stiker
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectDesign('landscape_split')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col justify-between gap-2 ${
                  currentDesign === 'landscape_split'
                    ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-2 ring-purple-500/30 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span>Landscape 2-Kolom Split</span>
                  </span>
                  {currentDesign === 'landscape_split' && <Check size={14} className="text-purple-700" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Kiri: Nama toko, nama barang, brand &amp; harga. Kanan: Barcode tegak &amp; nomor SKU. Hemat tinggi kertas stiker roll.
                </p>
                <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded w-fit">
                  Disarankan untuk Bengkel &amp; Grosir
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDesign('stacked')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col justify-between gap-2 ${
                  currentDesign === 'stacked'
                    ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-2 ring-purple-500/30 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    <span>Vertikal Tumpuk Klasik</span>
                  </span>
                  {currentDesign === 'stacked' && <Check size={14} className="text-purple-700" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Atas: Toko &amp; nama produk. Tengah: Barcode horizontal lebar. Bawah: Nominal harga. Format label ritel klasik.
                </p>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded w-fit">
                  Klasik Supermarket / Minimarket
                </span>
              </button>
            </div>
          </div>

          {/* 3. TOGGLE DATA BAWAAN YANG TERCETAK */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div>
              <h5 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                <Tag size={15} className="text-purple-600" />
                <span>Data Default yang Tercetak di Stiker</span>
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tentukan informasi apa saja yang otomatis diaktifkan saat kasir mencetak label
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              
              {/* Toggle Nama Toko / Bengkel */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-xs text-slate-800 block">Nama Toko / Bengkel</span>
                  <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                    Kop identitas toko: {formData.storeName || 'TOKO / BENGKEL'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleStore(!showStore)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer shrink-0 ${
                    showStore ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition" />
                </button>
              </div>

              {/* Toggle Brand & Lokasi Rak Gudang */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-xs text-slate-800 block">Brand &amp; Lokasi Rak Simpan</span>
                  <span className="text-[11px] text-slate-400 block">
                    Cetak merk sparepart (AHM/Federal/dll) dan nomor rak gudang (📍 Rak A-02)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleBrandRak(!showBrandRak)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer shrink-0 ${
                    showBrandRak ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition" />
                </button>
              </div>

              {/* Toggle Harga Produk & Pilihan Tier */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <span className="font-bold text-xs text-slate-800 block">Harga Produk</span>
                    <span className="text-[11px] text-slate-400 block">
                      Tampilkan nominal harga jual rupiah pada stiker
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrice(!showPrice)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer shrink-0 ${
                      showPrice ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition" />
                  </button>
                </div>

                {showPrice && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Tier Bawaan:</span>
                    {(['retail', 'mitra', 'grosir'] as const).map(tier => {
                      const isActive = priceTier === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => handleSelectTier(tier)}
                          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tier === 'retail' ? 'Eceran (Umum)' : tier === 'mitra' ? 'Mitra / Bengkel' : 'Grosir (Partai)'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* TOMBOL SIMPAN PENGATURAN */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onSaveClick}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle size={16} />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Default Barcode'}</span>
            </button>
          </div>

        </div>

        {/* ── KOLOM KANAN (5/12): LIVE PREVIEW STIKER ── */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 sticky top-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Eye size={14} className="text-purple-600" />
                <span>Live Preview Hasil Cetak</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                1 Lembar ({selectedPreset.dimension})
              </span>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex items-center justify-center min-h-[220px]">
              
              {/* STIKER THERMAL PUTIH */}
              {currentDesign === 'landscape_split' ? (
                /* Landscape 2-Kolom Split */
                <div 
                  className="bg-white text-slate-900 rounded-xl p-3.5 flex flex-row items-center justify-between text-left select-none shadow-lg border border-slate-300 w-full max-w-[340px] gap-2.5 overflow-hidden"
                  style={{ minHeight: Math.max(80, selectedPreset.heightMm * 2.8) + 'px' }}
                >
                  {/* Left Column */}
                  <div className="flex-1 flex flex-col justify-between h-full min-w-0 pr-1">
                    <div>
                      {showStore && (
                        <div className="font-black text-[8.5px] uppercase tracking-wider text-purple-900 truncate">
                          {formData.storeName || 'TOKO / BENGKEL'}
                        </div>
                      )}
                      <div className="font-black text-slate-900 uppercase tracking-tight line-clamp-2 mt-0.5 leading-snug text-[10.5px]">
                        {sampleProduct.name}
                      </div>
                      {showBrandRak && (
                        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-500 mt-1 flex-wrap">
                          <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200 font-semibold truncate max-w-[80px]">
                            {sampleProduct.brand}
                          </span>
                          <span className="text-purple-700 font-black">
                            📍 {sampleProduct.storageLocation}
                          </span>
                        </div>
                      )}
                    </div>

                    {showPrice && (
                      <div className="mt-2 pt-1 border-t border-slate-100">
                        <span className="text-[7.5px] font-bold text-slate-400 block uppercase leading-none">
                          {priceTier === 'mitra' ? 'Harga Mitra' : priceTier === 'grosir' ? 'Harga Grosir' : 'Harga Eceran'}
                        </span>
                        <span className="font-black text-slate-950 tracking-tight leading-none text-xs sm:text-sm">
                          Rp {sampleProduct.price.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: SVG Barcode */}
                  <div className="w-[45%] shrink-0 flex flex-col items-center justify-center pl-2 border-l border-dashed border-slate-200">
                    <div 
                      className="w-full flex justify-center overflow-hidden"
                      dangerouslySetInnerHTML={{
                        __html: generateBarcodeSvgString(
                          sampleProduct.barcode,
                          Math.max(26, selectedPreset.barcodeHeight - 6),
                          Math.max(0.85, selectedPreset.barcodeWidth * 0.82),
                          false
                        )
                      }}
                    />
                    <div className="font-mono text-[8px] font-bold text-slate-700 tracking-wider mt-1 text-center truncate max-w-full">
                      {sampleProduct.barcode}
                    </div>
                  </div>
                </div>
              ) : (
                /* Vertikal Tumpuk Klasik */
                <div 
                  className="bg-white text-slate-900 rounded-xl p-3 flex flex-col items-center justify-between text-center select-none shadow-lg border border-slate-300 w-full max-w-[260px] gap-1 overflow-hidden"
                  style={{ minHeight: selectedPreset.heightMm * 2.8 + 'px' }}
                >
                  {showStore && (
                    <div className="font-black text-[9px] uppercase tracking-tight text-slate-900 truncate w-full">
                      {formData.storeName || 'TOKO / BENGKEL'}
                    </div>
                  )}

                  <div className={`font-black text-slate-900 uppercase tracking-tight line-clamp-1 w-full mt-0.5 ${selectedPreset.fontSizeName}`}>
                    {sampleProduct.name}
                  </div>

                  {showBrandRak && (
                    <div className="flex items-center justify-center gap-1 text-[8px] text-slate-600 font-bold truncate max-w-full">
                      <span>{sampleProduct.brand}</span>
                      <span>• 📍 {sampleProduct.storageLocation}</span>
                    </div>
                  )}

                  <div 
                    className="w-full flex justify-center my-1"
                    dangerouslySetInnerHTML={{
                      __html: generateBarcodeSvgString(
                        sampleProduct.barcode,
                        selectedPreset.barcodeHeight,
                        selectedPreset.barcodeWidth,
                        false
                      )
                    }}
                  />

                  <div className="font-mono text-[9px] font-bold text-slate-700 tracking-wider">
                    {sampleProduct.barcode}
                  </div>

                  {showPrice && (
                    <div className={`font-black text-slate-900 mt-0.5 ${selectedPreset.fontSizePrice}`}>
                      Rp {sampleProduct.price.toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              )}

            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Format stiker ini akan otomatis menjadi format bawaan di Kasir Bengkel, Kasir Grosir, dan Master Produk.
            </p>
          </div>
        </div>

      </div>

      {/* ── HIDDEN PRINT MARKUP FOR KALIBRASI TEST PRINT ── */}
      <div id="calibration-barcode-print-sheet" className="hidden print:block">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${selectedPreset.pageSize};
                margin: 0 !important;
              }
              body * {
                visibility: hidden !important;
              }
              #calibration-barcode-print-sheet, #calibration-barcode-print-sheet * {
                visibility: visible !important;
              }
              #calibration-barcode-print-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .calib-label-box {
                width: ${selectedPreset.widthMm}mm !important;
                height: ${selectedPreset.heightMm}mm !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: always !important;
                padding: 1.2mm 1.5mm !important;
                display: flex !important;
              }
              .calib-label-box.style-landscape {
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
              }
              .calib-label-box.style-stacked {
                flex-direction: column !important;
                align-items: center !important;
                justify-content: space-between !important;
                text-align: center !important;
              }
            }
          `
        }} />

        <div className={`calib-label-box ${currentDesign === 'landscape_split' ? 'style-landscape' : 'style-stacked'}`}>
          {currentDesign === 'landscape_split' ? (
            <>
              <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', paddingRight: '1mm', overflow: 'hidden' }}>
                <div>
                  {showStore && (
                    <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1 }}>
                      {formData.storeName || 'TOKO / BENGKEL'}
                    </div>
                  )}
                  <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.15, marginTop: '0.6mm', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {sampleProduct.name}
                  </div>
                  {showBrandRak && (
                    <div style={{ fontSize: '6pt', fontWeight: 700, color: '#333', marginTop: '0.4mm', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {sampleProduct.brand} • 📍 {sampleProduct.storageLocation}
                    </div>
                  )}
                </div>
                {showPrice && (
                  <div style={{ fontSize: '8.5pt', fontWeight: 900, marginTop: '0.6mm', lineHeight: 1 }}>
                    Rp {sampleProduct.price.toLocaleString('id-ID')}
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', borderLeft: '0.5px dashed #ccc', paddingLeft: '1mm' }}>
                <div 
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{
                    __html: generateBarcodeSvgString(
                      sampleProduct.barcode,
                      Math.max(16, selectedPreset.barcodeHeight - 8),
                      Math.max(0.75, selectedPreset.barcodeWidth * 0.8),
                      false
                    )
                  }}
                />
                <div style={{ fontFamily: 'monospace', fontSize: '6.5pt', fontWeight: 'bold', marginTop: '0.4mm' }}>
                  {sampleProduct.barcode}
                </div>
              </div>
            </>
          ) : (
            <>
              {showStore && (
                <div style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>
                  {formData.storeName || 'TOKO / BENGKEL'}
                </div>
              )}
              <div style={{ fontSize: '7.5pt', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', lineHeight: 1.1, marginTop: '0.8mm' }}>
                {sampleProduct.name}
              </div>
              {showBrandRak && (
                <div style={{ fontSize: '6pt', fontWeight: 700, color: '#333', marginTop: '0.4mm', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {sampleProduct.brand} • 📍 {sampleProduct.storageLocation}
                </div>
              )}
              <div 
                style={{ width: '100%', margin: '0.8mm 0', display: 'flex', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{
                  __html: generateBarcodeSvgString(
                    sampleProduct.barcode,
                    selectedPreset.barcodeHeight,
                    selectedPreset.barcodeWidth,
                    false
                  )
                }}
              />
              <div style={{ fontFamily: 'monospace', fontSize: '7pt', fontWeight: 'bold' }}>
                {sampleProduct.barcode}
              </div>
              {showPrice && (
                <div style={{ fontSize: '8pt', fontWeight: 900, marginTop: '0.5mm' }}>
                  Rp {sampleProduct.price.toLocaleString('id-ID')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default SettingsBarcodePrinter;
