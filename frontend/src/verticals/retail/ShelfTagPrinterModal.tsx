import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Tag,
  Search,
  Layers,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Barcode,
  Building2,
  Check
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { renderBarcodeSVG } from '../../utils/barcodeSvg';

interface ShelfTagPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  categories: any[];
}

export const ShelfTagPrinterModal: React.FC<ShelfTagPrinterModalProps> = ({
  isOpen,
  onClose,
  products,
  categories
}) => {
  const { settings } = usePOS();
  const storeName = settings?.storeName || 'TOKO GROSIR & RETAIL';

  const [search, setSearch] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [labelFormat, setLabelFormat] = useState<'58MM' | '80MM' | 'A4_STICKER'>('58MM');
  const [showWholesalePrice, setShowWholesalePrice] = useState<boolean>(true);

  if (!isOpen) return null;

  const formatRupiah = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
    const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.storageLocation || '').toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const toggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleProduct = (id: number) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  const selectedProducts = products.filter(p => selectedProductIds.has(p.id));

  // Handler Print
  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      toast('Pilih minimal 1 produk yang ingin dicetak label raknya.', 'error');
      return;
    }

    const printContent = document.getElementById('printable-shelf-tags');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) return;

    const styles = `
      <style>
        @page {
          size: ${labelFormat === 'A4_STICKER' ? 'A4 portrait' : 'auto'};
          margin: ${labelFormat === 'A4_STICKER' ? '8mm' : '0'};
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: ${labelFormat === 'A4_STICKER' ? '0' : '4px'};
          color: #000;
          background: #fff;
        }
        .tag-card {
          border: 1.5px solid #000;
          border-radius: 4px;
          padding: 6px 8px;
          box-sizing: border-box;
          page-break-inside: avoid;
          background: #fff;
        }
        /* Format 58mm Roll */
        .format-58mm {
          width: 54mm;
          margin: 0 auto 6px auto;
        }
        /* Format 80mm Roll */
        .format-80mm {
          width: 76mm;
          margin: 0 auto 6px auto;
        }
        /* Format A4 Grid (3 x 8 = 24 stiker per lembar) */
        .format-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4mm;
        }
        .format-grid .tag-card {
          width: 100%;
          min-height: 32mm;
        }
        .store-header {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #333;
          border-bottom: 1px dashed #666;
          padding-bottom: 2px;
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
        }
        .product-name {
          font-size: 13px;
          font-weight: 900;
          line-height: 1.2;
          color: #000;
          margin-bottom: 4px;
          word-break: break-word;
        }
        .price-section {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin: 4px 0;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 3px 0;
        }
        .price-main {
          font-size: 18px;
          font-weight: 900;
          color: #000;
        }
        .price-unit {
          font-size: 10px;
          font-weight: bold;
          color: #333;
        }
        .wholesale-badge {
          font-size: 9px;
          font-weight: bold;
          color: #000;
          margin-top: 2px;
        }
        .meta-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }
        .barcode-container svg {
          max-width: 100%;
          height: 28px;
        }
        .location-badge {
          font-size: 9px;
          font-weight: 900;
          padding: 1px 4px;
          border: 1px solid #000;
          border-radius: 3px;
          text-transform: uppercase;
        }
      </style>
    `;

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label Rak Toko - ${storeName}</title>
          ${styles}
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] transition-all">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Tag size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  SHELF TALKER &amp; BARCODE TAG
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedProductIds.size} Produk Dipilih
                </span>
              </div>
              <h3 className="font-black text-base sm:text-lg text-white mt-0.5">
                Cetak Label Harga Rak &amp; Barcode Etalase
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Pengaturan Ukuran & Filter */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Format Pilihan */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200">
            {[
              { id: '58MM', label: '🏷️ 58mm Thermal' },
              { id: '80MM', label: '🏷️ 80mm Lebar' },
              { id: 'A4_STICKER', label: '📄 Stiker A4 Grid' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLabelFormat(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  labelFormat === f.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Toggle Grosir Price */}
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showWholesalePrice}
              onChange={(e) => setShowWholesalePrice(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Tampilkan Harga Grosir/Mitra</span>
          </label>

          {/* Action Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={selectedProductIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Printer size={15} />
            <span>Cetak {selectedProductIds.size} Label</span>
          </button>
        </div>

        {/* Main Body: 2 Kolom (Kiri: Pemilih Produk, Kanan: Pratinjau Label) */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden flex-1">
          
          {/* Kolom Kiri: Pemilih Produk */}
          <div className="p-4 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, barcode, atau rak..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 focus:outline-none"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Select All Row */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 font-bold hover:text-indigo-600 transition-all cursor-pointer"
              >
                {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                  <CheckSquare size={15} className="text-indigo-600" />
                ) : (
                  <Square size={15} />
                )}
                <span>Pilih Semua ({filteredProducts.length})</span>
              </button>
              <span>{selectedProductIds.size} dipilih</span>
            </div>

            {/* List Produk */}
            <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[45vh] md:max-h-[55vh] pr-1">
              {filteredProducts.map(p => {
                const isSelected = selectedProductIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                      }`}>
                        {isSelected && <Check size={12} />}
                      </div>
                      <div className="min-w-0 truncate">
                        <span className="font-bold text-slate-800 block truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.barcode || 'NO-BARCODE'} • {p.storageLocation || 'Etalase'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900 block">{formatRupiah(p.sellPrice)}</span>
                      <span className="text-[10px] text-slate-400 font-bold">/{p.baseUom || 'PCS'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Visual Label Rak */}
          <div className="p-4 bg-slate-50/60 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
              <span>Pratinjau Label Cetak ({selectedProducts.length} Label)</span>
              <span className="text-[11px] text-slate-400 font-mono">{labelFormat}</span>
            </div>

            {/* Container yang akan di-print (memiliki ID printable-shelf-tags) */}
            <div className="overflow-y-auto flex-1 max-h-[45vh] md:max-h-[55vh] p-2 bg-slate-100 rounded-2xl border border-slate-200">
              <div
                id="printable-shelf-tags"
                className={labelFormat === 'A4_STICKER' ? 'format-grid' : ''}
              >
                {selectedProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Pilih produk di sebelah kiri untuk melihat pratinjau label rak.
                  </div>
                ) : (
                  selectedProducts.map(p => {
                    const barcodeVal = p.barcode || String(p.id).padStart(6, '0');
                    const svgBarcodeString = renderBarcodeSVG(barcodeVal, {
                      height: 24,
                      moduleWidth: 1.5,
                      showText: true
                    });

                    return (
                      <div
                        key={p.id}
                        className={`tag-card ${
                          labelFormat === '58MM'
                            ? 'format-58mm'
                            : labelFormat === '80MM'
                            ? 'format-80mm'
                            : ''
                        }`}
                        style={{
                          border: '1.5px solid #000',
                          borderRadius: '4px',
                          padding: '6px 8px',
                          marginBottom: labelFormat === 'A4_STICKER' ? '0' : '6px',
                          backgroundColor: '#fff'
                        }}
                      >
                        {/* Store Header */}
                        <div
                          className="store-header"
                          style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            borderBottom: '1px dashed #666',
                            paddingBottom: '2px',
                            marginBottom: '4px',
                            display: 'flex',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{storeName}</span>
                          <span>{p.category?.name || 'RETAIL'}</span>
                        </div>

                        {/* Nama Produk */}
                        <div
                          className="product-name"
                          style={{
                            fontSize: '12px',
                            fontWeight: 900,
                            lineHeight: '1.2',
                            marginBottom: '4px',
                            color: '#000'
                          }}
                        >
                          {p.name}
                        </div>

                        {/* Harga Utama */}
                        <div
                          className="price-section"
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            borderTop: '1px solid #000',
                            borderBottom: '1px solid #000',
                            padding: '3px 0',
                            margin: '4px 0'
                          }}
                        >
                          <span
                            className="price-main"
                            style={{ fontSize: '16px', fontWeight: 900, color: '#000' }}
                          >
                            {formatRupiah(p.sellPrice)}
                          </span>
                          <span
                            className="price-unit"
                            style={{ fontSize: '10px', fontWeight: 'bold' }}
                          >
                            /{p.baseUom || 'PCS'}
                          </span>
                        </div>

                        {/* Harga Grosir Jika Ada */}
                        {showWholesalePrice && (p.sellPriceGrosir || p.sellPriceMitra) ? (
                          <div
                            className="wholesale-badge"
                            style={{ fontSize: '9px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}
                          >
                            {p.sellPriceMitra ? `Mitra: ${formatRupiah(p.sellPriceMitra)} ` : ''}
                            {p.sellPriceGrosir ? `| Grosir: ${formatRupiah(p.sellPriceGrosir)}` : ''}
                          </div>
                        ) : null}

                        {/* Barcode & Lokasi Rak */}
                        <div
                          className="meta-footer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '4px'
                          }}
                        >
                          <div
                            className="barcode-container"
                            dangerouslySetInnerHTML={{ __html: svgBarcodeString }}
                          />
                          {p.storageLocation && (
                            <span
                              className="location-badge"
                              style={{
                                fontSize: '9px',
                                fontWeight: 900,
                                border: '1px solid #000',
                                padding: '1px 4px',
                                borderRadius: '3px'
                              }}
                            >
                              {p.storageLocation}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={selectedProductIds.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Printer size={16} />
            <span>Cetak {selectedProductIds.size} Label Rak Sekarang</span>
          </button>
        </div>

      </div>
    </div>
  );
};
