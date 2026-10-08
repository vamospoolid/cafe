import React, { useEffect } from 'react';
import { getSavedBluetoothPrinter, printBluetoothReceipt, printBluetoothKitchenTicket } from '../utils/printerBluetooth';

export type PrintModeType = 'receipt' | 'kitchen' | 'bar' | 'all';

interface ReceiptPrinterProps {
  order: any;
  storeSettings?: any;
  printMode?: PrintModeType;
  onClose: () => void;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ 
  order, 
  storeSettings, 
  printMode = 'receipt',
  onClose 
}) => {
  const fmt = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const fmtDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const fmtTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  useEffect(() => {
    console.log(`ReceiptPrinter mounted with mode: ${printMode}`);
    
    // Check if running inside Electron POS app
    const win = window as any;
    if (win.electronPOS && win.electronPOS.printer) {
      console.log('ReceiptPrinter: executing silent raw print via Electron');
      
      if (printMode === 'kitchen' || printMode === 'all') {
        win.electronPOS.printer.printKitchenTicket?.(order)
          .catch((err: any) => console.error('Kitchen Print failed:', err));
      }

      if (printMode === 'receipt' || printMode === 'all') {
        win.electronPOS.printer.printReceipt(order, storeSettings)
          .then((res: any) => {
            console.log('Print success:', res);
            onClose();
          })
          .catch((err: any) => {
            console.error('Print failed:', err);
            onClose();
          });
      } else {
        setTimeout(onClose, 500);
      }
      return;
    }

    // Check if Bluetooth Printer is configured
    const savedBt = getSavedBluetoothPrinter('cashier') || getSavedBluetoothPrinter('kitchen');
    if (savedBt || localStorage.getItem('bluetooth_printer_mac')) {
      console.log(`ReceiptPrinter: executing silent print via Bluetooth Thermal Printer with mode: ${printMode}`);
      const paperWidth = (localStorage.getItem('printer_paper_width') as any) || '58mm';
      const storeName = storeSettings?.storeName || storeSettings?.name || 'MUKI RAMEN';

      if (printMode === 'kitchen' || printMode === 'bar') {
        printBluetoothKitchenTicket(order, printMode, {
          storeName,
          paperWidth
        })
          .then(() => {
            console.log(`Bluetooth ${printMode} ticket print success`);
            onClose();
          })
          .catch((err) => {
            console.warn(`Bluetooth ${printMode} print failed, falling back to window.print():`, err);
            window.print();
          });
        return;
      }

      printBluetoothReceipt(order, {
        name: storeName,
        address: storeSettings?.address || '',
        phone: storeSettings?.phone || '',
        footer: storeSettings?.receiptFooter || 'Terima kasih atas kunjungannya!',
        paperWidth
      }, { autoKickDrawer: true })
        .then(() => {
          console.log('Bluetooth print success');
          onClose();
        })
        .catch((err) => {
          console.warn('Bluetooth print failed, falling back to window.print():', err);
          window.print();
        });
      return;
    }

    const timer = setTimeout(() => {
      console.log('ReceiptPrinter: executing window.print()');
      window.print();
    }, 500);

    const handleAfterPrint = () => {
      console.log('ReceiptPrinter: afterprint, closing');
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onClose, order, storeSettings, printMode]);

  if (!order) return null;

  // Filter Items
  const isShowcase = (item: any) => {
    const target = item.product?.category?.printerTarget;
    if (target === 'NONE') return true;
    const cat = (item.product?.category?.name || '').toLowerCase();
    const name = (item.product?.name || '').toLowerCase();
    return name.includes('air mineral') || name.includes('mineral water') || cat.includes('showcase') || cat.includes('display') || cat.includes('snack');
  };

  const isDrink = (item: any) => {
    if (isShowcase(item)) return false;
    const target = item.product?.category?.printerTarget;
    if (target === 'BAR') return true;
    if (target === 'KITCHEN') return false;
    const cat = (item.product?.category?.name || '').toLowerCase();
    const name = (item.product?.name || '').toLowerCase();
    return cat.includes('minum') || cat.includes('beverage') || cat.includes('drink') || cat.includes('tea') || cat.includes('kopi') || name.includes('ocha') || name.includes('ice') || name.includes('soda') || name.includes('latte');
  };

  const isKitchen = (item: any) => {
    if (isShowcase(item)) return false;
    if (isDrink(item)) return false;
    return true;
  };

  const kitchenItems = (order.items || []).filter(isKitchen);
  const barItems = (order.items || []).filter(isDrink);

  // ── Inline styles ──
  const base: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '11pt',
    fontWeight: 'bold',
    color: '#000',
    width: '100%',
    padding: '0 2mm',
    margin: 0,
    boxSizing: 'border-box',
  };

  const tbl: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  };

  const tdL: React.CSSProperties = { textAlign: 'left', padding: '0', verticalAlign: 'top' };
  const tdR: React.CSSProperties = { textAlign: 'right', padding: '0', verticalAlign: 'top' };

  const divider = (
    <table style={tbl}>
      <tbody>
        <tr>
          <td style={{ ...tdL, padding: '1px 0', borderBottom: '1px dashed #000' }}></td>
        </tr>
      </tbody>
    </table>
  );

  const doubleDivider = (
    <table style={tbl}>
      <tbody>
        <tr>
          <td style={{ ...tdL, padding: '1px 0', borderBottom: '2px solid #000' }}></td>
        </tr>
      </tbody>
    </table>
  );

  const cutLine = (label: string) => (
    <div style={{ textAlign: 'center', margin: '8mm 0 4mm', padding: '4mm 0', borderTop: '2px dashed #000', borderBottom: '2px dashed #000', fontSize: '9pt', fontWeight: 900 }}>
      ✂ ─── {label} ─── ✂
    </div>
  );

  const row = (label: string, value: string, bold = false) => (
    <tr>
      <td style={{ ...tdL, fontWeight: bold ? '900' : 'bold', fontSize: bold ? '13pt' : '10pt' }}>{label}</td>
      <td style={{ ...tdR, fontWeight: bold ? '900' : 'bold', fontSize: bold ? '13pt' : '10pt' }}>{value}</td>
    </tr>
  );

  const getTableDisplay = () => {
    if (order.table?.tableNo) return `MEJA ${order.table.tableNo}`;
    if (order.table?.name) return order.table.name.toUpperCase();
    if (order.tableName) return order.tableName.toUpperCase();
    if (order.tableId) return `MEJA ${order.tableId}`;
    if (order.orderType === 'Dine In' || order.orderType === 'DINE IN') return 'DINE IN';
    return (order.orderType || 'TAKE AWAY').toUpperCase();
  };

  // ── Sub-component: Kitchen Ticket ──
  const renderKitchenTicket = () => (
    <div style={{ marginBottom: '6mm', padding: '0 1mm' }}>
      <div style={{ textAlign: 'center', padding: '1mm 0' }}>
        <div style={{ fontSize: '15pt', fontWeight: 900, letterSpacing: '1px' }}>
          *** TIKET DAPUR ***
        </div>
        <div style={{ fontSize: '10pt', fontWeight: 900 }}>[ PESANAN MAKANAN ]</div>
      </div>

      {doubleDivider}

      {/* PROMINENT TABLE BADGE */}
      <div style={{ textAlign: 'center', margin: '2mm 0', padding: '2mm 1mm', border: '2px solid #000', borderRadius: '4px' }}>
        <div style={{ fontSize: '16pt', fontWeight: 900, letterSpacing: '1px' }}>
          {getTableDisplay()}
        </div>
        <div style={{ fontSize: '9pt', fontWeight: 800 }}>
          {order.orderType === 'Take Away' || order.orderType === 'TAKE AWAY' ? '--- TAKE AWAY ---' : '--- DINE IN ---'}
        </div>
      </div>

      <table style={{ ...tbl, fontSize: '9.5pt', margin: '1mm 0' }}>
        <tbody>
          <tr>
            <td style={{ ...tdL, width: '22mm', fontWeight: 700 }}>No. Order</td>
            <td style={{ ...tdL, fontWeight: 700 }}>: {order.orderNumber || `#${order.id}`}</td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontWeight: 700 }}>Waktu</td>
            <td style={{ ...tdL, fontWeight: 700 }}>: {fmtTime(order.createdAt)} ({fmtDate(order.createdAt)})</td>
          </tr>
          {order.user?.name && (
            <tr>
              <td style={{ ...tdL, fontWeight: 700 }}>Kasir</td>
              <td style={{ ...tdL, fontWeight: 700 }}>: {order.user.name}</td>
            </tr>
          )}
          {order.customerName && (
            <tr>
              <td style={{ ...tdL, fontWeight: 700 }}>Tamu</td>
              <td style={{ ...tdL, fontWeight: 700 }}>: {order.customerName}</td>
            </tr>
          )}
        </tbody>
      </table>

      {divider}

      <div style={{ fontSize: '10pt', fontWeight: 900, margin: '1.5mm 0' }}>
        DAFTAR PESANAN MAKANAN:
      </div>

      <div style={{ margin: '1mm 0' }}>
        {kitchenItems.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: '2.5mm', paddingBottom: '1.5mm', borderBottom: idx < kitchenItems.length - 1 ? '1px dashed #ddd' : 'none' }}>
            <div style={{ fontSize: '12pt', fontWeight: 900, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13pt', whiteSpace: 'nowrap' }}>[{item.qty}x]</span>
              <span style={{ wordBreak: 'break-word', flex: 1, textTransform: 'uppercase' }}>{item.product?.name || 'Item'}</span>
            </div>
            {item.notes && (
              <div style={{ marginTop: '1mm', paddingLeft: '5mm', fontSize: '9.5pt', fontWeight: 900, color: '#000' }}>
                &gt;&gt; CATATAN: {item.notes}
              </div>
            )}
          </div>
        ))}
        {kitchenItems.length === 0 && (
          <div style={{ fontSize: '9pt', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '2mm 0' }}>
            (Tidak ada item makanan)
          </div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2mm 0 1mm' }}></div>
      <div style={{ fontSize: '9pt', fontWeight: 800, margin: '1mm 0', display: 'flex', justifyContent: 'space-between' }}>
        <span>Total Menu: {kitchenItems.length}</span>
        <span>Total Porsi: {kitchenItems.reduce((acc: number, cur: any) => acc + (Number(cur.qty) || 1), 0)}</span>
      </div>

      {doubleDivider}
      <div style={{ textAlign: 'center', fontSize: '9pt', fontWeight: 900, margin: '1.5mm 0' }}>
        MOHON SEGERA DIPROSES!
      </div>
    </div>
  );

  // ── Sub-component: Bar Ticket ──
  const renderBarTicket = () => (
    <div style={{ marginBottom: '6mm', padding: '0 1mm' }}>
      <div style={{ textAlign: 'center', padding: '1mm 0' }}>
        <div style={{ fontSize: '15pt', fontWeight: 900, letterSpacing: '1px' }}>
          *** TIKET BAR ***
        </div>
        <div style={{ fontSize: '10pt', fontWeight: 900 }}>[ PESANAN MINUMAN ]</div>
      </div>

      {doubleDivider}

      {/* PROMINENT TABLE BADGE */}
      <div style={{ textAlign: 'center', margin: '2mm 0', padding: '2mm 1mm', border: '2px solid #000', borderRadius: '4px' }}>
        <div style={{ fontSize: '16pt', fontWeight: 900, letterSpacing: '1px' }}>
          {getTableDisplay()}
        </div>
        <div style={{ fontSize: '9pt', fontWeight: 800 }}>
          {order.orderType === 'Take Away' || order.orderType === 'TAKE AWAY' ? '--- TAKE AWAY ---' : '--- DINE IN ---'}
        </div>
      </div>

      <table style={{ ...tbl, fontSize: '9.5pt', margin: '1mm 0' }}>
        <tbody>
          <tr>
            <td style={{ ...tdL, width: '22mm', fontWeight: 700 }}>No. Order</td>
            <td style={{ ...tdL, fontWeight: 700 }}>: {order.orderNumber || `#${order.id}`}</td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontWeight: 700 }}>Waktu</td>
            <td style={{ ...tdL, fontWeight: 700 }}>: {fmtTime(order.createdAt)} ({fmtDate(order.createdAt)})</td>
          </tr>
          {order.user?.name && (
            <tr>
              <td style={{ ...tdL, fontWeight: 700 }}>Kasir</td>
              <td style={{ ...tdL, fontWeight: 700 }}>: {order.user.name}</td>
            </tr>
          )}
          {order.customerName && (
            <tr>
              <td style={{ ...tdL, fontWeight: 700 }}>Tamu</td>
              <td style={{ ...tdL, fontWeight: 700 }}>: {order.customerName}</td>
            </tr>
          )}
        </tbody>
      </table>

      {divider}

      <div style={{ fontSize: '10pt', fontWeight: 900, margin: '1.5mm 0' }}>
        DAFTAR PESANAN MINUMAN:
      </div>

      <div style={{ margin: '1mm 0' }}>
        {barItems.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: '2.5mm', paddingBottom: '1.5mm', borderBottom: idx < barItems.length - 1 ? '1px dashed #ddd' : 'none' }}>
            <div style={{ fontSize: '12pt', fontWeight: 900, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <span style={{ fontSize: '13pt', whiteSpace: 'nowrap' }}>[{item.qty}x]</span>
              <span style={{ wordBreak: 'break-word', flex: 1, textTransform: 'uppercase' }}>{item.product?.name || 'Item'}</span>
            </div>
            {item.notes && (
              <div style={{ marginTop: '1mm', paddingLeft: '5mm', fontSize: '9.5pt', fontWeight: 900, color: '#000' }}>
                &gt;&gt; CATATAN: {item.notes}
              </div>
            )}
          </div>
        ))}
        {barItems.length === 0 && (
          <div style={{ fontSize: '9pt', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '2mm 0' }}>
            (Tidak ada item minuman)
          </div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '2mm 0 1mm' }}></div>
      <div style={{ fontSize: '9pt', fontWeight: 800, margin: '1mm 0', display: 'flex', justifyContent: 'space-between' }}>
        <span>Total Menu: {barItems.length}</span>
        <span>Total Porsi: {barItems.reduce((acc: number, cur: any) => acc + (Number(cur.qty) || 1), 0)}</span>
      </div>

      {doubleDivider}
      <div style={{ textAlign: 'center', fontSize: '9pt', fontWeight: 900, margin: '1.5mm 0' }}>
        SAJIKAN DINGIN & SEGAR!
      </div>
    </div>
  );

  // ── Sub-component: Customer Receipt ──
  const renderCustomerReceipt = () => (
    <div>
      {/* ═══ HEADER ═══ */}
      <div style={{ textAlign: 'center', marginBottom: '1mm' }}>
        <div style={{ fontSize: '14pt', fontWeight: '900', letterSpacing: '1px' }}>
          {storeSettings?.storeName || 'KAFE & RESTORAN'}
        </div>
        {storeSettings?.address && (
          <div style={{ fontSize: '9pt' }}>{storeSettings.address}</div>
        )}
        {storeSettings?.phone && (
          <div style={{ fontSize: '9pt' }}>Telp: {storeSettings.phone}</div>
        )}
        {storeSettings?.receiptHeader && (
          <div style={{ fontSize: '8pt' }}>{storeSettings.receiptHeader}</div>
        )}
      </div>

      {divider}

      {/* ═══ INFO ═══ */}
      <table style={{ ...tbl, fontSize: '9pt', margin: '1mm 0' }}>
        <tbody>
          <tr><td style={{ ...tdL, width: '14mm' }}>Tgl</td><td style={tdL}>: {fmtDate(order.paidAt || order.createdAt)}</td></tr>
          <tr><td style={{ ...tdL, width: '14mm' }}>No</td><td style={tdL}>: {order.orderNumber}</td></tr>
          <tr><td style={{ ...tdL, width: '14mm' }}>Kasir</td><td style={tdL}>: {order.user?.name || '-'}</td></tr>
          <tr><td style={{ ...tdL, width: '14mm' }}>Plgn</td><td style={tdL}>: {order.customerName || 'Umum'}</td></tr>
          {getTableDisplay() !== 'TAKE AWAY' && (
            <tr><td style={{ ...tdL, width: '14mm', fontWeight: 900 }}>Meja</td><td style={{ ...tdL, fontWeight: 900 }}>: {getTableDisplay()}</td></tr>
          )}
        </tbody>
      </table>

      {divider}

      {/* ═══ ITEMS ═══ */}
      <table style={{ ...tbl, fontSize: '10pt', margin: '1mm 0' }}>
        <tbody>
          {order.items?.map((item: any, idx: number) => (
            <React.Fragment key={idx}>
              <tr>
                <td colSpan={2} style={{ ...tdL, fontWeight: '900', fontSize: '10pt', paddingTop: idx > 0 ? '1mm' : '0' }}>
                  {item.product?.name || 'Produk'}
                  {item.notes ? <span style={{ fontSize: '8pt', fontWeight: 'bold' }}> *{item.notes}</span> : null}
                </td>
              </tr>
              <tr>
                <td style={{ ...tdL, paddingLeft: '2mm', fontSize: '9pt' }}>
                  {item.qty} x {fmt(item.price)}
                </td>
                <td style={{ ...tdR, fontSize: '10pt' }}>
                  {fmt(item.qty * item.price)}
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {divider}

      {/* ═══ TOTALS ═══ */}
      <table style={{ ...tbl, fontSize: '10pt', margin: '1mm 0' }}>
        <tbody>
          {row('Subtotal', fmt(order.subtotal || order.total))}
          {order.discount > 0 && row('Diskon', `-${fmt(order.discount)}`)}
          {order.tax > 0 && row('Pajak', fmt(order.tax))}
          {order.serviceCharge > 0 && row('Service', fmt(order.serviceCharge))}
        </tbody>
      </table>

      {divider}

      {/* ═══ GRAND TOTAL ═══ */}
      <table style={{ ...tbl, margin: '1mm 0' }}>
        <tbody>
          {row('TOTAL', fmt(order.total), true)}
          {row('Bayar', order.paymentMethod || 'Tunai')}
        </tbody>
      </table>

      {/* ═══ MEMBER ═══ */}
      {order.customer?.name && (
        <>
          {divider}
          <table style={{ ...tbl, fontSize: '9pt', margin: '1mm 0' }}>
            <tbody>
              {row('Member', order.customer.name)}
              {order.customer.points !== undefined && row('Poin', `${order.customer.points} poin`)}
            </tbody>
          </table>
        </>
      )}

      {divider}

      {/* ═══ FOOTER ═══ */}
      <div style={{ textAlign: 'center', fontSize: '9pt', margin: '1mm 0' }}>
        <div>{storeSettings?.receiptFooter || 'Terima kasih atas kunjungannya!'}</div>
        <div style={{ marginTop: '1mm' }}>★ Sampai jumpa lagi ★</div>
      </div>
    </div>
  );

  return (
    <div className="receipt-printer-container">
      <div style={base}>
        {printMode === 'kitchen' && renderKitchenTicket()}
        {printMode === 'bar' && renderBarTicket()}
        {printMode === 'receipt' && renderCustomerReceipt()}
        {printMode === 'all' && (
          <>
            {kitchenItems.length > 0 && (
              <>
                {renderKitchenTicket()}
                {cutLine('POTONG DISINI (TIKET DAPUR)')}
              </>
            )}
            {barItems.length > 0 && (
              <>
                {renderBarTicket()}
                {cutLine('POTONG DISINI (TIKET BAR)')}
              </>
            )}
            {renderCustomerReceipt()}
          </>
        )}

        {/* Spacing before cut */}
        <div style={{ height: '10mm' }}></div>
      </div>
    </div>
  );
};

export default ReceiptPrinter;
