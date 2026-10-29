import React, { useEffect, useRef, useState } from 'react';
import { Printer, X, Shirt, CheckCircle2, AlertCircle, MessageSquare, Tag, Receipt } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

// Deterministic offline SVG Barcode renderer (no external internet dependency required)
function renderSvgBarcode(text: string) {
  const clean = (text || 'LD-0001').toUpperCase();
  const bars: number[] = [2, 1, 1, 2]; // Start pattern
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    bars.push(((code >> 4) & 3) + 1);
    bars.push(((code >> 2) & 3) + 1);
    bars.push((code & 3) + 1);
    bars.push(1);
  }
  bars.push(2, 1, 2, 1, 2); // Stop pattern

  let totalUnits = 0;
  for (const w of bars) totalUnits += w;

  let x = 0;
  const rects: React.ReactNode[] = [];
  for (let i = 0; i < bars.length; i++) {
    const w = bars[i];
    if (i % 2 === 0) {
      rects.push(<rect key={i} x={x} y={0} width={w} height={34} fill="#0f172a" />);
    }
    x += w;
  }

  return (
    <div className="flex flex-col items-center my-1.5">
      <svg
        viewBox={`0 0 ${totalUnits} 34`}
        className="w-full max-w-[220px] h-9"
        preserveAspectRatio="none"
      >
        {rects}
      </svg>
      <div className="text-[10px] font-mono font-black tracking-[0.22em] text-slate-900 mt-0.5">
        *{clean}*
      </div>
    </div>
  );
}

interface LaundryReceiptPrinterProps {
  order: any;
  onClose?: () => void;
  autoPrint?: boolean;
  initialMode?: 'CUSTOMER_RECEIPT' | 'PRODUCTION_TAG';
}

export const LaundryReceiptPrinter: React.FC<LaundryReceiptPrinterProps> = ({
  order,
  onClose,
  autoPrint = false,
  initialMode = 'CUSTOMER_RECEIPT'
}) => {
  const { settings, user } = usePOS();
  const printRef = useRef<HTMLDivElement>(null);
  const [printMode, setPrintMode] = useState<'CUSTOMER_RECEIPT' | 'PRODUCTION_TAG'>(initialMode);

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

  const handlePrint = () => {
    window.print();
  };

  const computedItemsSubtotal = Array.isArray(order?.items)
    ? order.items.reduce((s: number, it: any) => s + (Number(it.subtotal) || (Number(it.qty) * Number(it.pricePerUnit)) || 0), 0)
    : 0;
  const surcharge = Number(order?.speedSurcharge) || 0;
  const disc = Number(order?.discount) || 0;
  const computedTotal = Math.max(0, computedItemsSubtotal + surcharge - disc);

  const totalAmount = Number(order?.totalAmount) > 0 ? Number(order.totalAmount) : computedTotal;
  const paidAmount = Number(order?.paidAmount) || 0;
  const remainingDue = Math.max(0, totalAmount - paidAmount);
  const isPaidLunas = remainingDue === 0 && totalAmount > 0;

  const handleSendWhatsApp = () => {
    if (!order?.customerPhone) {
      alert('Nomor WhatsApp pelanggan belum tercatat');
      return;
    }
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const storeName = settings?.storeName || 'Laundry Kami';

    const itemsText = (order.items || [])
      .map((it: any) => `• ${it.qty} ${String(it.unitType || 'KG').toLowerCase()} ${it.serviceName} = Rp ${(it.subtotal || 0).toLocaleString('id-ID')}`)
      .join('\n');

    const msg =
      `*NOTA ELEKTRONIK LAUNDRY*\n` +
      `*${storeName.toUpperCase()}*\n` +
      `--------------------------------\n` +
      `No. Nota: *${order.orderNumber}*\n` +
      `Pelanggan: *${order.customerName}*\n` +
      `Waktu Terima: ${formatDate(order.createdAt)} ${formatTime(order.createdAt)}\n` +
      `Kecepatan: ${order.serviceSpeed === 'EXPRESS_6H' ? 'Super Express (6 Jam)' : order.serviceSpeed === 'KILAT_24H' ? 'Kilat (24 Jam)' : 'Reguler (2-3 Hari)'}\n` +
      `Parfum: ${order.perfumeVariant || 'Standard Fresh'}\n` +
      (order.estimatedDoneAt ? `Est. Selesai: ${formatDate(order.estimatedDoneAt)} ${formatTime(order.estimatedDoneAt)}\n` : '') +
      (order.rackLocation ? `Lokasi Rak: *${order.rackLocation}*\n` : '') +
      `--------------------------------\n` +
      `*Rincian Layanan:*\n` +
      `${itemsText}\n` +
      `--------------------------------\n` +
      `Total Tagihan: *Rp ${totalAmount.toLocaleString('id-ID')}*\n` +
      `Dibayar: *Rp ${paidAmount.toLocaleString('id-ID')}*\n` +
      (remainingDue > 0 ? `Sisa Tagihan: *Rp ${remainingDue.toLocaleString('id-ID')}* (Pelunasan saat ambil cucian)\n` : `Status: *LUNAS*\n`) +
      (order.trackingCode ? `\n📲 *Lacak Status & Bayar Online:*\n${window.location.origin}/track/${order.trackingCode}\n` : '') +
      `--------------------------------\n` +
      `Terima kasih telah mempercayakan cucian Anda kepada kami! 🙏✨`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  if (!order) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto cursor-pointer print:p-0 print:bg-white"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {/* Container Preview Modal */}
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col my-auto border border-slate-200 cursor-default print:shadow-none print:border-none print:max-w-none print:w-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Action Bar (Hidden when printing) */}
        <div className="p-3 bg-slate-900 text-white flex flex-col gap-2.5 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer size={16} className="text-cyan-400" />
              <h3 className="font-bold text-xs truncate max-w-[140px] sm:max-w-none">
                {printMode === 'CUSTOMER_RECEIPT' ? 'Struk Kasir Pelanggan' : 'Nota Produksi (Keranjang)'}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {order.customerPhone && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Kirim Nota ke WhatsApp Pelanggan"
                >
                  <MessageSquare size={13} />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Printer size={13} />
                <span>Cetak</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Tutup"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Switcher Mode Cetak: Struk Pelanggan vs Tag Produksi Keranjang */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPrintMode('CUSTOMER_RECEIPT')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                printMode === 'CUSTOMER_RECEIPT'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Receipt size={13} />
              <span>Struk Pelanggan</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('PRODUCTION_TAG')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                printMode === 'PRODUCTION_TAG'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Tag size={13} />
              <span>Nota Produksi</span>
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper */}
        <div className="p-4 sm:p-6 bg-slate-100 flex justify-center overflow-y-auto max-h-[78vh] print:p-0 print:bg-white print:max-h-none">
          <div 
            ref={printRef}
            id="laundry-thermal-receipt"
            className="bg-white p-4 shadow-sm border border-slate-300 w-full max-w-[290px] text-slate-900 font-mono text-[11px] leading-tight select-none print:border-none print:shadow-none print:p-0"
            style={{ width: '280px' }}
          >
            {printMode === 'PRODUCTION_TAG' ? (
              /* ─── MODE 2: NOTA PRODUKSI / TAG KERANJANG (TANPA HARGA) ─── */
              <div className="space-y-2">
                <div className="text-center border-2 border-slate-900 p-1.5 rounded">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    TAG PRODUKSI & KERANJANG
                  </div>
                  <div className="text-base font-black tracking-tight mt-0.5">
                    {order.orderNumber}
                  </div>
                </div>

                {renderSvgBarcode(order.orderNumber)}

                <div className="space-y-1 text-[11px] border-t border-b border-dashed border-slate-400 py-2">
                  <div className="flex justify-between">
                    <span>PELANGGAN:</span>
                    <span className="font-black text-xs uppercase">{order.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TERIMA:</span>
                    <span>{formatDate(order.createdAt)} {formatTime(order.createdAt)}</span>
                  </div>
                  {order.estimatedDoneAt && (
                    <div className="flex justify-between font-black">
                      <span>TARGET SELESAI:</span>
                      <span>{formatDate(order.estimatedDoneAt)} {formatTime(order.estimatedDoneAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>PRIORITAS:</span>
                    <span className="font-black uppercase">
                      {order.serviceSpeed === 'EXPRESS_6H'
                        ? 'SUPER EXPRESS (6H)'
                        : order.serviceSpeed === 'KILAT_24H'
                        ? 'KILAT (24 JAM)'
                        : 'REGULER'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>PARFUM:</span>
                    <span className="font-black uppercase">{order.perfumeVariant || 'STANDAR'}</span>
                  </div>
                  {order.itemCountNotes && (
                    <div className="flex justify-between">
                      <span>JML POTONG:</span>
                      <span className="font-black">{order.itemCountNotes}</span>
                    </div>
                  )}
                  {order.rackLocation && (
                    <div className="flex justify-between">
                      <span>LOKASI RAK:</span>
                      <span className="font-black">{order.rackLocation}</span>
                    </div>
                  )}
                </div>

                {order.specialNotes && (
                  <div className="p-2 border-2 border-slate-900 rounded bg-amber-50 text-[10px] font-black uppercase">
                    ⚠️ INSTRUKSI KHUSUS: {order.specialNotes}
                  </div>
                )}

                <div className="space-y-1.5 py-1">
                  <div className="text-[10px] font-black uppercase underline">Daftar Item Dikerjakan:</div>
                  {(order.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="border-b border-dotted border-slate-300 pb-1">
                      <div className="flex justify-between font-black text-xs">
                        <span>{it.serviceName}</span>
                        <span>{it.qty} {it.unitType === 'METER' ? 'm²' : it.unitType}</span>
                      </div>
                      {it.notes && (
                        <div className="text-[9.5px] text-slate-700 font-bold">
                          • {it.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-slate-900 pt-2 mt-2 space-y-1.5 text-[10px] font-bold">
                  <div className="text-center uppercase font-black">Kontrol Kualitas Operator</div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className="border border-slate-400 p-1.5 rounded">[ ] 1. CUCI</div>
                    <div className="border border-slate-400 p-1.5 rounded">[ ] 2. KERING</div>
                    <div className="border border-slate-400 p-1.5 rounded">[ ] 3. SETRIKA</div>
                    <div className="border border-slate-400 p-1.5 rounded">[ ] 4. PACKING</div>
                  </div>
                </div>
              </div>
            ) : (
              /* ─── MODE 1: STRUK PELANGGAN STANDAR ─── */
              <>
            {/* Header Laundry */}
            <div className="text-center space-y-1 mb-2">
              <div className="font-black text-sm uppercase tracking-wide">
                {settings?.storeName || 'LAUNDRY BERSIH WANGI'}
              </div>
              <div className="text-[10px] text-slate-600 leading-tight">
                {settings?.address || 'Jasa Cuci Kiloan & Satuan Premium'}
              </div>
              {settings?.phone && (
                <div className="text-[10px] text-slate-600">WhatsApp: {settings?.phone}</div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 mb-2">
              ================================
            </div>

            {/* Info Nota & Pelanggan */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>No. Nota:</span>
                <span className="font-black text-xs">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu Terima:</span>
                <span>{formatDate(order.createdAt)} {formatTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{user?.name || 'Kasir'}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 mt-1">
                <span className="font-bold">Pelanggan:</span>
                <span className="font-black">{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span>No. HP:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
              {order.rackLocation && (
                <div className="flex justify-between font-bold text-cyan-800 bg-cyan-50 px-1 py-0.5 rounded">
                  <span>Lokasi Rak Simpan:</span>
                  <span>{order.rackLocation}</span>
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              --------------------------------
            </div>

            {/* Layanan & Kecepatan */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>Kecepatan:</span>
                <span className="font-bold">
                  {order.serviceSpeed === 'EXPRESS_6H' 
                    ? '🚀 Super Express (6 Jam)' 
                    : order.serviceSpeed === 'KILAT_24H'
                    ? '⚡ Kilat (24 Jam)'
                    : 'Reguler (2-3 Hari)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Aroma Parfum:</span>
                <span className="font-bold text-slate-700">{order.perfumeVariant || 'Sakura Fresh'}</span>
              </div>
              {order.estimatedDoneAt && (
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Est. Selesai:</span>
                  <span>{formatDate(order.estimatedDoneAt)} {formatTime(order.estimatedDoneAt)}</span>
                </div>
              )}
              {order.itemCountNotes && (
                <div className="flex justify-between text-slate-600">
                  <span>Jumlah Potong:</span>
                  <span className="font-bold">{order.itemCountNotes}</span>
                </div>
              )}
              {order.specialNotes && (
                <div className="text-[9px] text-amber-700 bg-amber-50 p-1 rounded border border-amber-200 mt-1">
                  Catatan: {order.specialNotes}
                </div>
              )}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              --------------------------------
            </div>

            {/* Daftar Layanan Cucian */}
            <div className="space-y-1.5 text-[10px] mb-2">
              {(order.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <div className="font-bold leading-tight">{it.serviceName}</div>
                    <div className="text-[9px] text-slate-500">
                      {it.qty} {it.unitType === 'METER' ? 'm²' : String(it.unitType || 'KG').toLowerCase()} × {formatCurrency(it.pricePerUnit)}
                    </div>
                    {it.notes && (
                      <div className="text-[9px] text-amber-800 font-semibold">
                        ({it.notes})
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-right shrink-0">
                    {formatCurrency(it.subtotal)}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              --------------------------------
            </div>

            {/* Perhitungan Finansial */}
            <div className="space-y-1 text-[10px] mb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal || totalAmount)}</span>
              </div>
              {order.speedSurcharge > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Biaya Express/Kilat:</span>
                  <span>+{formatCurrency(order.speedSurcharge)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Diskon:</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-black border-t border-slate-300 pt-1">
                <span>TOTAL:</span>
                <span className="text-sm">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>{paidAmount > 0 && remainingDue > 0 ? 'Uang Muka (DP):' : 'Bayar:'}</span>
                <span>{formatCurrency(paidAmount)}</span>
              </div>
              {Number(order.quotaKgUsed) > 0 && (
                <div className="flex justify-between text-cyan-800 font-bold">
                  <span>Potong Kuota Member:</span>
                  <span>-{order.quotaKgUsed} Kg</span>
                </div>
              )}
              {Number(order.depositUsed) > 0 && (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Potong Saldo Deposit:</span>
                  <span>{formatCurrency(order.depositUsed)}</span>
                </div>
              )}

              {/* Status Sisa Pembayaran */}
              <div className="border-t border-dashed border-slate-300 pt-1 mt-1">
                {isPaidLunas ? (
                  <div className="text-center p-1 bg-emerald-50 text-emerald-800 font-black text-xs rounded border border-emerald-200">
                    *** LUNAS ***
                  </div>
                ) : (
                  <div className="p-1 bg-amber-50 text-amber-900 font-bold text-[11px] rounded border border-amber-200 flex justify-between">
                    <span>{paidAmount > 0 ? 'SISA PELUNASAN:' : 'SISA TAGIHAN:'}</span>
                    <span className="font-black text-xs text-rose-700">{formatCurrency(remainingDue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Barcode Nota untuk Scan Cepat saat Pengambilan */}
            <div className="border-t border-dashed border-slate-300 pt-1.5 mt-1.5">
              {renderSvgBarcode(order.orderNumber)}
            </div>

            <div className="text-center font-bold tracking-widest text-[10px] text-slate-400 my-1.5">
              ================================
            </div>

            {/* Klausul Syarat & Ketentuan (Anti Sengketa) */}
            <div className="space-y-1 text-[8.5px] text-slate-500 leading-tight text-justify">
              <div className="font-bold text-center text-slate-700 uppercase mb-0.5">Syarat & Ketentuan:</div>
              <p>1. Pengambilan cucian wajib menunjukkan struk ini / bukti WA resmi.</p>
              <p>2. Komplain kehilangan/cacat maksimal 1x24 jam sejak barang diserahkan.</p>
              <p>3. Pakaian susut/luntur akibat sifat alami kain di luar tanggung jawab kami.</p>
              <p>4. Pakaian yang tidak diambil lebih dari 30 hari di luar tanggung jawab laundry.</p>
            </div>

            <div className="text-center text-[10px] text-slate-600 font-bold mt-3 pt-2 border-t border-slate-200">
              Terima Kasih Atas Kepercayaan Anda!
            </div>
            <div className="text-center text-[8px] text-slate-400 mt-0.5">
              Powered by CodePOS Laundry SaaS
            </div>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default LaundryReceiptPrinter;
