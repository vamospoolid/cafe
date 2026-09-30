import React, { useEffect, useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  CheckCircle, 
  Share2, 
  FileText, 
  Sparkles, 
  Phone, 
  Calendar, 
  User, 
  ShieldCheck, 
  Clock,
  Layers,
  Copy
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { getSavedBluetoothPrinter, printBluetoothRentalOrder } from '../../utils/printerBluetooth';
import { toast } from '../../utils/alert';

interface RentalReceiptPrinterProps {
  order: any;
  onClose?: () => void;
  autoPrint?: boolean;
}

export const RentalReceiptPrinter: React.FC<RentalReceiptPrinterProps> = ({
  order,
  onClose,
  autoPrint = false
}) => {
  const { settings, user } = usePOS();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDocType, setPrintDocType] = useState<'THERMAL' | 'CONTRACT_A4'>('THERMAL');

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

  const handlePrint = async () => {
    setIsPrinting(true);

    if (printDocType === 'THERMAL') {
      // 1. Cek printer Electron POS jika ada
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
          await printBluetoothRentalOrder(actualOrder, {
            storeName: settings?.storeName || 'SANGGAR SEWA BUSANA ADAT',
            address: settings?.address || '',
            phone: settings?.phone || '',
            footer: settings?.receiptFooter || 'Maksimal sewa 3 hari kerja. Mohon kembalikan busana & aksesoris lengkap.'
          }, { autoKickDrawer: true });
          toast('Struk berhasil dicetak ke printer Bluetooth thermal', 'success');
          setIsPrinting(false);
          return;
        } catch (btErr: any) {
          console.warn('Bluetooth print failed, falling back to window.print():', btErr);
          toast(`Printer bluetooth gagal: ${btErr.message || btErr}. Menggunakan dialog cetak browser.`, 'warning');
        }
      }
    }

    // Fallback cetak via browser (mendukung Thermal & A4 via CSS print)
    setIsPrinting(false);
    window.print();
  };

  const handleShareWhatsApp = () => {
    const phone = actualOrder.customerPhone ? actualOrder.customerPhone.replace(/[^0-9]/g, '') : '';
    const formattedPhone = phone.startsWith('0') ? '62' + phone.substring(1) : phone;
    const invoiceUrl = `${window.location.origin}/invoice/order/${actualOrder.orderNumber}`;
    
    const message = `Halo Kak ${actualOrder.customerName || ''}, terima kasih telah menyewa busana adat di *${settings?.storeName || 'Sanggar Kami'}* ✨\n\n`
      + `Berikut resi digital & kontrak bukti sewa Anda:\n`
      + `📋 *No. Kontrak:* ${actualOrder.orderNumber}\n`
      + `📅 *Tgl Acara:* ${formatDate(actualOrder.eventDate)}\n`
      + `⏰ *Batas Kembali:* ${formatDate(actualOrder.returnDeadline)}\n`
      + `💰 *Total Biaya:* ${formatCurrency(actualOrder.totalAmount)}\n`
      + `🛡️ *Uang Jaminan:* ${formatCurrency(actualOrder.depositAmount)}\n\n`
      + `Buka tautan struk & detail busana lengkap di sini:\n${invoiceUrl}\n\n`
      + `Mohon busana tidak dicuci sendiri demi menjaga keaslian sutera adat. Sampai jumpa di hari pengambilan! 🙏`;

    const waLink = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waLink, '_blank');
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  if (!actualOrder || !actualOrder.orderNumber) return null;

  const subtotal = actualOrder.rentalSubtotal || actualOrder.subtotal || 0;
  const deposit = actualOrder.depositAmount || 0;
  const paid = actualOrder.paidAmount || 0;
  const total = actualOrder.totalAmount || subtotal;
  const remaining = Math.max(0, total - paid);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden cursor-default my-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                Manajemen Resi & Kontrak Sewa
              </h3>
              <p className="text-[11px] text-slate-400">
                {actualOrder.orderNumber} • {actualOrder.customerName || 'Pelanggan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Thermal vs Surat Kontrak A4 */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setPrintDocType('THERMAL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  printDocType === 'THERMAL' 
                    ? 'bg-amber-500 text-slate-950 shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Printer size={13} />
                <span>Thermal 58/80</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintDocType('CONTRACT_A4')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  printDocType === 'CONTRACT_A4' 
                    ? 'bg-amber-500 text-slate-950 shadow-sm' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>Surat Perjanjian A4</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document Preview Viewport */}
        <div className="p-6 bg-slate-100 flex justify-center overflow-y-auto max-h-[65vh]">
          {printDocType === 'THERMAL' ? (
            /* THERMAL RECEIPT PREVIEW */
            <div 
              ref={printRef}
              id="rental-thermal-receipt"
              className="bg-white p-5 shadow-sm border border-slate-300 w-full max-w-[320px] text-slate-900 font-mono text-[11px] leading-tight select-none rounded-lg"
            >
              {/* Header Toko */}
              <div className="text-center space-y-1 mb-2">
                <div className="font-black text-sm uppercase tracking-wide">
                  {settings?.storeName || 'SANGGAR SEWA BUSANA ADAT'}
                </div>
                <div className="text-[10px] text-slate-600 leading-tight">
                  {settings?.address || 'Spesialis Baju Bodo, Jas Tutup & Pakaian Pengantin Adat'}
                </div>
                {settings?.phone && (
                  <div className="text-[10px] text-slate-600">WA: {settings?.phone}</div>
                )}
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 mb-2">
                ================================
              </div>

              {/* Data Order & Penyewa */}
              <div className="space-y-1 text-[10px] mb-2">
                <div className="flex justify-between">
                  <span>No. Kontrak:</span>
                  <span className="font-bold">{actualOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Penyewa:</span>
                  <span className="font-bold">{actualOrder.customerName || 'Pelanggan'}</span>
                </div>
                {actualOrder.customerPhone && (
                  <div className="flex justify-between text-slate-600">
                    <span>No. WhatsApp:</span>
                    <span>{actualOrder.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 mt-1">
                  <span>Tanggal Acara:</span>
                  <span className="font-bold">{formatDate(actualOrder.eventDate)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Jadwal Ambil:</span>
                  <span>{formatDate(actualOrder.pickupDate)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-900">
                  <span>Batas Kembali:</span>
                  <span>{formatDate(actualOrder.returnDeadline)}</span>
                </div>
                {actualOrder.eventLocation && (
                  <div className="flex justify-between text-slate-600">
                    <span>Lokasi Acara:</span>
                    <span className="truncate max-w-[150px]">{actualOrder.eventLocation}</span>
                  </div>
                )}
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1">
                --------------------------------
              </div>

              {/* Rincian Busana & Aksesoris */}
              <div className="mb-2">
                <div className="font-bold text-[10px] uppercase text-amber-900 mb-1">
                  [ RINCIAN BUSANA DISEWA ]
                </div>
                <div className="space-y-1.5">
                  {(actualOrder.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="text-[10px]">
                      <div className="font-bold leading-tight text-slate-800">
                        {it.attireName || it.name}
                      </div>
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>
                          {it.rackHangerCode ? `[${it.rackHangerCode}] ` : ''}
                          {it.size ? `Size ${it.size}` : ''} {it.color ? `• ${it.color}` : ''}
                        </span>
                        <span className="font-bold text-slate-900">{formatCurrency(it.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catatan Fitting */}
              {actualOrder.fittingNotes && (
                <div className="my-2 p-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-600">
                  <b>Catatan Fitting:</b> {actualOrder.fittingNotes}
                </div>
              )}

              {/* Kelengkapan Aksesoris Checklist */}
              {actualOrder.accessoryChecklist && actualOrder.accessoryChecklist.length > 0 && (
                <div className="my-2 text-[9px]">
                  <div className="font-bold text-slate-700 uppercase mb-0.5">Kelengkapan Aksesoris:</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {actualOrder.accessoryChecklist.map((acc: any, i: number) => (
                      <div key={i} className="flex items-center gap-1">
                        <span>[✓]</span>
                        <span>{acc.name || acc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1">
                --------------------------------
              </div>

              {/* Rincian Pembayaran */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal Sewa:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {actualOrder.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-{formatCurrency(actualOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 border-t border-slate-300 pt-1">
                  <span>TOTAL SEWA:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {deposit > 0 && (
                  <div className="flex justify-between text-amber-800 font-bold bg-amber-50 p-1 rounded">
                    <span>Uang Jaminan (Deposit):</span>
                    <span>{formatCurrency(deposit)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span>DP Dibayar:</span>
                  <span>{formatCurrency(paid)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700 border-t border-dashed border-slate-300 pt-1">
                  <span>Sisa Pelunasan:</span>
                  <span>{formatCurrency(remaining)}</span>
                </div>
              </div>

              <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-2">
                ================================
              </div>

              {/* Syarat & Ketentuan Sewa */}
              <div className="text-[8px] text-slate-600 space-y-1 mb-3">
                <div className="font-bold text-slate-800 text-center uppercase">KETENTUAN SEWA:</div>
                <p>1. Maksimal sewa busana 3 hari kerja.</p>
                <p>2. Keterlambatan dikenakan denda Rp 50.000 / hari.</p>
                <p>3. DILARANG mencuci sendiri (khusus sutera bugis).</p>
                <p>4. Aksesoris wajib kembali lengkap & utuh.</p>
                <p>5. Deposit dikembalikan penuh setelah inspeksi QC.</p>
              </div>

              <div className="text-center text-[10px] font-bold text-slate-800 italic">
                "{settings?.receiptFooter || 'Terima kasih atas kepercayaan Anda!'}"
              </div>
            </div>
          ) : (
            /* SURAT PERJANJIAN SEWA MENYEWA A4 PREVIEW */
            <div 
              ref={printRef}
              id="rental-contract-a4"
              className="bg-white p-8 shadow-sm border border-slate-300 w-full max-w-[560px] text-slate-900 font-sans text-xs leading-relaxed rounded-xl select-none"
            >
              {/* Kop Surat Resmi */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4 text-center">
                <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                  {settings?.storeName || 'SANGGAR BUSANA ADAT & BAJU BODO'}
                </h2>
                <p className="text-[11px] text-slate-600">
                  {settings?.address || 'Spesialis Busana Tradisional Sulawesi & Pengantin Modern'}
                </p>
                {settings?.phone && (
                  <p className="text-[11px] text-slate-600 font-medium">Layanan Pelanggan / WhatsApp: {settings?.phone}</p>
                )}
              </div>

              {/* Judul Dokumen */}
              <div className="text-center mb-5">
                <h3 className="font-black text-sm uppercase underline tracking-wide">
                  SURAT PERJANJIAN SEWA MENYEWA BUSANA ADAT
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  No. Kontrak: {actualOrder.orderNumber}
                </span>
              </div>

              <p className="text-slate-700 mb-3 text-justify">
                Pada hari ini, tanggal <b>{formatDate(actualOrder.createdAt)}</b>, telah dibuat dan disepakati perjanjian sewa busana antara pihak pengelola sanggar (selanjutnya disebut <b>PIHAK PERTAMA</b>) dengan penyewa (selanjutnya disebut <b>PIHAK KEDUA</b>) dengan ketentuan sebagai berikut:
              </p>

              {/* Data Pihak Kedua */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-[11px] space-y-1">
                <div className="font-bold text-slate-800 uppercase mb-1">Identitas Penyewa (Pihak Kedua):</div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500">Nama Lengkap</span>
                  <span className="col-span-2 font-bold text-slate-800">: {actualOrder.customerName || '-'}</span>
                  <span className="text-slate-500">No. WhatsApp / HP</span>
                  <span className="col-span-2 font-bold text-slate-800">: {actualOrder.customerPhone || '-'}</span>
                  <span className="text-slate-500">Lokasi Acara</span>
                  <span className="col-span-2 font-bold text-slate-800">: {actualOrder.eventLocation || 'Kota Makassar & Sekitarnya'}</span>
                </div>
              </div>

              {/* Tabel Item yang Disewa */}
              <div className="mb-4">
                <div className="font-bold text-slate-800 mb-1.5 uppercase text-[11px]">
                  Pasal 1: Rincian Busana & Aksesoris yang Disewa
                </div>
                <table className="w-full text-[10px] border border-slate-300">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-1.5 border border-slate-300 text-left">No</th>
                      <th className="p-1.5 border border-slate-300 text-left">Nama Busana & Hanger</th>
                      <th className="p-1.5 border border-slate-300 text-center">Ukuran / Warna</th>
                      <th className="p-1.5 border border-slate-300 text-right">Tarif Sewa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(actualOrder.items || []).map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="p-1.5 border border-slate-300 text-center">{i + 1}</td>
                        <td className="p-1.5 border border-slate-300 font-semibold">
                          {it.attireName || it.name}
                          {it.rackHangerCode && <span className="text-amber-700 ml-1">[{it.rackHangerCode}]</span>}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-center">{it.size || '-'} / {it.color || '-'}</td>
                        <td className="p-1.5 border border-slate-300 text-right font-bold">{formatCurrency(it.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Jadwal Pengambilan & Pengembalian */}
              <div className="mb-4">
                <div className="font-bold text-slate-800 mb-1 uppercase text-[11px]">
                  Pasal 2: Jadwal Sewa & Batas Waktu
                </div>
                <div className="grid grid-cols-3 gap-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Tgl Pengambilan:</span>
                    <span className="font-bold text-slate-800">{formatDate(actualOrder.pickupDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Hari H Acara:</span>
                    <span className="font-bold text-slate-800">{formatDate(actualOrder.eventDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Batas Pengembalian:</span>
                    <span className="font-bold text-rose-700">{formatDate(actualOrder.returnDeadline)}</span>
                  </div>
                </div>
              </div>

              {/* Ketentuan Keuangan & Tanggung Jawab */}
              <div className="mb-4">
                <div className="font-bold text-slate-800 mb-1 uppercase text-[11px]">
                  Pasal 3: Nilai Sewa & Uang Jaminan (Deposit)
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed mb-2">
                  Total biaya sewa disepakati sebesar <b>{formatCurrency(total)}</b> dengan Uang Jaminan (Deposit) sebesar <b>{formatCurrency(deposit)}</b>. Uang muka yang telah diterima sebesar <b>{formatCurrency(paid)}</b>, dan sisa pelunasan sebesar <b>{formatCurrency(remaining)}</b> wajib dilunasi paling lambat saat pengambilan busana.
                </p>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 space-y-1">
                  <p>1. Uang jaminan (deposit) akan dikembalikan secara penuh kepada PIHAK KEDUA apabila busana dan seluruh aksesoris dikembalikan tepat waktu dalam kondisi utuh.</p>
                  <p>2. Keterlambatan pengembalian dikenakan denda administratif sebesar <b>Rp 50.000 / hari</b>.</p>
                  <p>3. PIHAK KEDUA dilarang mencuci sendiri busana adat karena dapat merusak serat tenun sutera Bugis asli. Cucian/laundry adalah tanggung jawab pihak sanggar.</p>
                </div>
              </div>

              {/* Tanda Tangan */}
              <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[11px]">
                <div>
                  <p className="text-slate-500 mb-12">PIHAK PERTAMA (Sanggar)</p>
                  <p className="font-bold underline text-slate-900">{settings?.storeName || 'Pengelola Sanggar'}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-12">PIHAK KEDUA (Penyewa)</p>
                  <p className="font-bold underline text-slate-900">{actualOrder.customerName || 'Penyewa Busana'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="bg-white border-t border-slate-100 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
            >
              <Share2 size={15} />
              <span>Kirim Resi ke WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/invoice/order/${actualOrder.orderNumber}`;
                navigator.clipboard.writeText(url);
                toast('Link resi digital berhasil disalin!', 'success');
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <Copy size={14} />
              <span>Salin Tautan</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-slate-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Printer size={15} className="text-amber-400" />
              <span>{isPrinting ? 'Mencetak...' : (printDocType === 'THERMAL' ? 'Cetak Struk Thermal' : 'Cetak Dokumen A4')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
