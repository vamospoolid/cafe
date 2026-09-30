import React, { useEffect, useRef, useState } from 'react';
import { Printer, X, CheckCircle, Package, RefreshCw } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { getSavedBluetoothPrinter, printBluetoothRetailReceipt } from '../../utils/printerBluetooth';
import { toast } from '../../utils/alert';

interface RetailReceiptPrinterProps {
  order: any;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const RetailReceiptPrinter: React.FC<RetailReceiptPrinterProps> = ({
  order,
  onClose,
  autoPrint = false
}) => {
  const { settings, user } = usePOS();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Normalisasi order: ekstrak apakah data mentah atau terbungkus { order: ... }
  const actualOrder = order?.order ? { ...order.order, ...order } : (order || {});

  const formatCurrency = (val: number) => `Rp ${(Math.round(val || 0)).toLocaleString('id-ID')}`;

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = async () => {
    setIsPrinting(true);

    // 1. Cek printer Electron POS jika berjalan di aplikasi desktop Electron
    const win = window as any;
    if (win.electronPOS?.printer?.printReceipt) {
      try {
        await win.electronPOS.printer.printReceipt(actualOrder, settings);
        setIsPrinting(false);
        return;
      } catch (e) {
        console.warn('Electron print failed, falling back:', e);
      }
    }

    // 2. Cek printer Bluetooth / ESC/POS thermal terhubung
    const savedBt = getSavedBluetoothPrinter();
    if (savedBt || localStorage.getItem('bluetooth_printer_mac')) {
      try {
        await printBluetoothRetailReceipt(actualOrder, {
          storeName: settings?.storeName || 'TOKO GROSIR & SEMBAKO',
          address: settings?.address || '',
          phone: settings?.phone || '',
          footer: settings?.receiptFooter || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.'
        }, { autoKickDrawer: true });
        toast('Struk berhasil dicetak ke printer Bluetooth thermal', 'success');
        setIsPrinting(false);
        return;
      } catch (btErr: any) {
        console.warn('Bluetooth print failed, falling back to window.print():', btErr);
        toast(`Printer bluetooth gagal: ${btErr.message || btErr}. Menggunakan dialog cetak browser.`, 'warning');
      }
    }

    // 3. Fallback browser window.print()
    setIsPrinting(false);
    window.print();
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  if (!order) return null;

  const items = actualOrder.items || [];
  const subtotal = actualOrder.subtotal ?? actualOrder.total ?? 0;
  const discount = actualOrder.discount ?? actualOrder.discountAmount ?? 0;
  const tax = actualOrder.tax ?? actualOrder.taxAmount ?? 0;
  const grandTotal = actualOrder.total ?? actualOrder.grandTotal ?? (subtotal - discount + tax);
  const cashReceived = actualOrder.cashReceived ?? actualOrder.paidAmount ?? grandTotal;
  const changeDue = actualOrder.changeDue ?? Math.max(0, cashReceived - grandTotal);
  const paymentMethod = (actualOrder.paymentMethod || 'TUNAI').toUpperCase();
  const isBon = paymentMethod === 'BON' || paymentMethod === 'TEMPO';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {/* Container Preview */}
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col my-auto border border-slate-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Action Bar (Hidden when printing) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm">Struk Kasir Retail / Grosir (58/80mm)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Thermal Receipt Paper */}
        <div className="p-6 bg-slate-100 flex justify-center overflow-y-auto max-h-[75vh]">
          <div 
            ref={printRef}
            id="retail-thermal-receipt"
            className="bg-white p-4 shadow-sm border border-slate-300 w-full max-w-[300px] text-slate-900 font-mono text-[11px] leading-tight select-none"
            style={{ width: '280px' }}
          >
            {/* Header Toko */}
            <div className="text-center space-y-1 mb-2">
              <div className="font-black text-sm uppercase tracking-wide">
                {settings?.storeName || 'TOKO GROSIR & SEMBAKO'}
              </div>
              <div className="text-[10px] text-slate-600 leading-tight">
                {settings?.address || 'Pusat Grosir & Eceran Kebutuhan Pokok'}
              </div>
              {settings?.phone && (
                <div className="text-[10px] text-slate-600">Telp/WA: {settings?.phone}</div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 mb-2">
              ================================
            </div>

            {/* Info Transaksi */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>No. Faktur:</span>
                <span className="font-bold">{actualOrder.orderNumber || actualOrder.id || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formatDate(actualOrder.paidAt || actualOrder.createdAt)} {formatTime(actualOrder.paidAt || actualOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{actualOrder.user?.name || user?.name || actualOrder.cashierName || 'Kasir'}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 mt-1">
                <span>Pelanggan:</span>
                <span className="font-bold truncate max-w-[150px]">
                  {actualOrder.customer?.name || actualOrder.customerName || 'Pelanggan Umum'}
                </span>
              </div>
              {actualOrder.priceTier && actualOrder.priceTier !== 'UMUM' && (
                <div className="flex justify-between text-indigo-700 font-bold">
                  <span>Tier Harga:</span>
                  <span>{actualOrder.priceTier}</span>
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1">
              --------------------------------
            </div>

            {/* Daftar Barang */}
            <div className="space-y-1.5 mb-2">
              {items.map((item: any, idx: number) => {
                const name = item.productName || item.product?.name || item.name || 'Barang';
                const qty = item.qty || item.quantity || 1;
                const uom = item.uomName ? ` ${item.uomName}` : '';
                const price = item.price || item.unitPrice || 0;
                const itemTotal = item.subtotal || (qty * price);

                return (
                  <div key={idx} className="text-[10px]">
                    <div className="font-semibold leading-tight">{name}</div>
                    <div className="flex justify-between text-slate-600 text-[9px]">
                      <span>{qty}{uom} x {formatCurrency(price)}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(itemTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1">
              --------------------------------
            </div>

            {/* Ringkasan Finansial */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>{actualOrder.voucher?.code || actualOrder.voucherCode ? `Voucher (${actualOrder.voucher?.code || actualOrder.voucherCode}):` : 'Diskon:'}</span>
                  <span>- {formatCurrency(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between">
                  <span>PPN:</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-400 text-slate-900">
                <span>TOTAL:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>

              {isBon ? (
                <div className="pt-1 border-t border-dashed border-amber-300 bg-amber-50 p-1.5 rounded text-amber-900">
                  <div className="font-bold flex justify-between">
                    <span>STATUS:</span>
                    <span>BON TEMPO (HUTANG)</span>
                  </div>
                  {actualOrder.dueDate && (
                    <div className="flex justify-between text-[9px]">
                      <span>Jatuh Tempo:</span>
                      <span>{formatDate(actualOrder.dueDate)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-between font-semibold pt-0.5">
                    <span>BAYAR ({paymentMethod}):</span>
                    <span>{formatCurrency(cashReceived)}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>KEMBALIAN:</span>
                      <span>{formatCurrency(changeDue)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-2">
              ================================
            </div>

            {/* Footer */}
            <div className="text-center space-y-1 pt-1 text-[9px] text-slate-500">
              <div>{settings?.receiptFooter || 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.'}</div>
              <div className="text-slate-400 text-[8px] pt-1">
                Terima kasih atas kunjungan Anda!
              </div>
            </div>
          </div>
        </div>

        {/* Modal Buttons (Bottom) */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            {isPrinting ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />}
            {isPrinting ? 'Mencetak...' : 'Cetak Struk Thermal'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RetailReceiptPrinter;
