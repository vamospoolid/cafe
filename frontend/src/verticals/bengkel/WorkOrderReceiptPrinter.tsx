import React, { useEffect, useRef, useState } from 'react';
import { Printer, X, CheckCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { getSavedBluetoothPrinter, printBluetoothBengkelWorkOrder } from '../../utils/printerBluetooth';
import { toast } from '../../utils/alert';

interface WorkOrderReceiptPrinterProps {
  workOrder: any;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const WorkOrderReceiptPrinter: React.FC<WorkOrderReceiptPrinterProps> = ({
  workOrder,
  onClose,
  autoPrint = false
}) => {
  const { settings, user } = usePOS();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

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

    // 1. Cek printer Electron POS jika ada
    const win = window as any;
    if (win.electronPOS?.printer?.printReceipt) {
      try {
        await win.electronPOS.printer.printReceipt(workOrder, settings);
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
        await printBluetoothBengkelWorkOrder(workOrder, {
          storeName: settings?.storeName || 'BENGKEL REPARASI RESMI',
          address: settings?.address || '',
          phone: settings?.phone || '',
          footer: settings?.receiptFooter || 'Harap simpan struk untuk klaim garansi servis.'
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

  if (!workOrder) return null;

  const subtotalBeforeDiscount = (workOrder.totalServices || 0) + (workOrder.totalParts || 0);
  const changeAmount = Math.max(0, (workOrder.paidAmount || 0) - (workOrder.totalAmount || 0));

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
            <Printer size={18} className="text-amber-400" />
            <h3 className="font-bold text-sm">Struk Kasir Bengkel (58/80mm)</h3>
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
            id="bengkel-thermal-receipt"
            className="bg-white p-4 shadow-sm border border-slate-300 w-full max-w-[300px] text-slate-900 font-mono text-[11px] leading-tight select-none"
            style={{ width: '280px' }}
          >
            {/* Header Bengkel */}
            <div className="text-center space-y-1 mb-2">
              <div className="font-black text-sm uppercase tracking-wide">
                {settings?.storeName || 'BENGKEL REPARASI RESMI'}
              </div>
              <div className="text-[10px] text-slate-600 leading-tight">
                {settings?.address || 'Layanan Servis & Suku Cadang Otomotif'}
              </div>
              {settings?.phone && (
                <div className="text-[10px] text-slate-600">Telp: {settings?.phone}</div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 mb-2">
              ================================
            </div>

            {/* Info SPK & Kendaraan */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>No. SPK:</span>
                <span className="font-bold">{workOrder.spkNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formatDate(workOrder.createdAt)} {formatTime(workOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{user?.name || 'Kasir'}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 mt-1">
                <span className="font-bold">No. Polisi:</span>
                <span className="font-bold bg-slate-100 px-1 py-0.5 rounded text-[11px]">
                  {workOrder.vehiclePlate || 'WALK-IN'}
                </span>
              </div>
              {(workOrder.vehicleBrand || workOrder.vehicleModel) && (
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Kendaraan:</span>
                  <span>{workOrder.vehicleBrand} {workOrder.vehicleModel}</span>
                </div>
              )}
              {workOrder.odometer && (
                <div className="flex justify-between text-[10px]">
                  <span>Kilometer:</span>
                  <span>{workOrder.odometer.toLocaleString('id-ID')} km</span>
                </div>
              )}
              {workOrder.customerName && (
                <div className="flex justify-between text-[10px]">
                  <span>Konsumen:</span>
                  <span className="truncate max-w-[150px]">{workOrder.customerName}</span>
                </div>
              )}
              {workOrder.mechanicName && (
                <div className="flex justify-between text-[10px]">
                  <span>Mekanik:</span>
                  <span className="font-semibold">{workOrder.mechanicName}</span>
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1">
              --------------------------------
            </div>

            {/* Rincian Jasa Servis */}
            {workOrder.services && workOrder.services.length > 0 && (
              <div className="mb-2">
                <div className="font-bold text-[10px] uppercase text-purple-900 mb-1">
                  [ JASA REPARASI & SERVIS ]
                </div>
                <div className="space-y-1.5">
                  {workOrder.services.map((s: any, idx: number) => (
                    <div key={idx} className="text-[10px]">
                      <div className="font-semibold leading-tight">{s.serviceName}</div>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>{s.qty || 1}x @ {formatCurrency(s.price)}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(s.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rincian Sparepart */}
            {workOrder.parts && workOrder.parts.length > 0 && (
              <div className="mb-2">
                <div className="font-bold text-[10px] uppercase text-purple-900 mb-1 border-t border-dashed border-slate-300 pt-1">
                  [ SUKU CADANG / OLI ]
                </div>
                <div className="space-y-1.5">
                  {workOrder.parts.map((p: any, idx: number) => (
                    <div key={idx} className="text-[10px]">
                      <div className="font-semibold leading-tight">{p.partName}</div>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>{p.qty}x @ {formatCurrency(p.price)}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(p.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1">
              --------------------------------
            </div>

            {/* Ringkasan Finansial */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotalBeforeDiscount)}</span>
              </div>
              {workOrder.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Diskon:</span>
                  <span>- {formatCurrency(workOrder.discount)}</span>
                </div>
              )}
              {workOrder.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>PPN:</span>
                  <span>{formatCurrency(workOrder.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-400 text-slate-900">
                <span>TOTAL:</span>
                <span>{formatCurrency(workOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-0.5">
                <span>BAYAR ({workOrder.paymentMethod || 'TUNAI'}):</span>
                <span>{formatCurrency(workOrder.paidAmount || workOrder.totalAmount)}</span>
              </div>
              {changeAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>KEMBALIAN:</span>
                  <span>{formatCurrency(changeAmount)}</span>
                </div>
              )}
              {workOrder.paidAmount < workOrder.totalAmount && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>SISA PIUTANG:</span>
                  <span>{formatCurrency(workOrder.totalAmount - workOrder.paidAmount)}</span>
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-2">
              ================================
            </div>

            {/* Footer & Kartu Garansi Servis */}
            <div className="text-center space-y-1 pt-1 text-[9px]">
              <div className="font-black text-[10px] uppercase text-purple-950 flex items-center justify-center gap-1">
                <ShieldCheck size={11} className="text-purple-700" />
                GARANSI SERVIS 7 HARI KERJA
              </div>
              <div className="text-slate-500 leading-tight">
                Harap simpan struk ini sebagai bukti resmi saat klaim garansi servis kendaraan Anda.
              </div>
              <div className="text-slate-400 text-[8px] pt-1">
                Terima kasih atas kepercayaan Anda!
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
            className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            {isPrinting ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />}
            {isPrinting ? 'Mencetak...' : 'Cetak Struk Thermal'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderReceiptPrinter;
