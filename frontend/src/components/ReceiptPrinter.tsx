import React, { useEffect } from 'react';

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

  // ── Sub-component: Kitchen Ticket ──
  const renderKitchenTicket = () => (
    <div style={{ marginBottom: '6mm' }}>
      <div style={{ textAlign: 'center', padding: '1mm 0' }}>
        <div style={{ fontSize: '15pt', fontWeight: 900, letterSpacing: '1px' }}>
          *** TIKET DAPUR ***
        </div>
        <div style={{ fontSize: '10pt', fontWeight: 900 }}>[ MAKANAN / KITCHEN ]</div>
      </div>

      {doubleDivider}

      <table style={{ ...tbl, fontSize: '11pt', margin: '1mm 0' }}>
        <tbody>
          <tr>
            <td style={{ ...tdL, width: '16mm', fontSize: '13pt', fontWeight: 900 }}>MEJA</td>
            <td style={{ ...tdL, fontSize: '14pt', fontWeight: 900 }}>: {order.table?.tableNo || order.orderType || 'Take Away'}</td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontSize: '9pt' }}>No. Ord</td>
            <td style={{ ...tdL, fontSize: '9pt' }}>: {order.orderNumber || `#${order.id}`}</td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontSize: '9pt' }}>Waktu</td>
            <td style={{ ...tdL, fontSize: '9pt' }}>: {fmtTime(order.createdAt)} ({fmtDate(order.createdAt)})</td>
          </tr>
          {order.user?.name && (
            <tr>
              <td style={{ ...tdL, fontSize: '9pt' }}>Pelayan</td>
              <td style={{ ...tdL, fontSize: '9pt' }}>: {order.user.name}</td>
            </tr>
          )}
        </tbody>
      </table>

      {divider}

      <div style={{ fontSize: '10pt', fontWeight: 900, margin: '1mm 0' }}>
        DAFTAR PESANAN MAKANAN:
      </div>

      <table style={{ ...tbl, margin: '1mm 0' }}>
        <tbody>
          {kitchenItems.map((item: any, idx: number) => (
            <React.Fragment key={idx}>
              <tr>
                <td style={{ ...tdL, fontSize: '13pt', fontWeight: 900, paddingTop: idx > 0 ? '2mm' : '0' }}>
                  [{item.qty}x] {item.product?.name || 'Item'}
                </td>
              </tr>
              {item.notes && (
                <tr>
                  <td style={{ ...tdL, paddingLeft: '4mm', fontSize: '10pt', fontWeight: 900, color: '#000' }}>
                    &gt;&gt; CATATAN: {item.notes}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {kitchenItems.length === 0 && (
            <tr><td style={{ ...tdL, fontSize: '9pt', color: '#666' }}>(Tidak ada item makanan)</td></tr>
          )}
        </tbody>
      </table>

      {doubleDivider}
      <div style={{ textAlign: 'center', fontSize: '8pt', margin: '1mm 0' }}>
        Mohon segera diproses & disajikan!
      </div>
    </div>
  );

  // ── Sub-component: Bar Ticket ──
  const renderBarTicket = () => (
    <div style={{ marginBottom: '6mm' }}>
      <div style={{ textAlign: 'center', padding: '1mm 0' }}>
        <div style={{ fontSize: '15pt', fontWeight: 900, letterSpacing: '1px' }}>
          *** TIKET BAR ***
        </div>
        <div style={{ fontSize: '10pt', fontWeight: 900 }}>[ MINUMAN / BARISTA ]</div>
      </div>

      {doubleDivider}

      <table style={{ ...tbl, fontSize: '11pt', margin: '1mm 0' }}>
        <tbody>
          <tr>
            <td style={{ ...tdL, width: '16mm', fontSize: '13pt', fontWeight: 900 }}>MEJA</td>
            <td style={{ ...tdL, fontSize: '14pt', fontWeight: 900 }}>: {order.table?.tableNo || order.orderType || 'Take Away'}</td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontSize: '9pt' }}>No. Ord</td>
            <td style={{ ...tdL, fontSize: '9pt' }}>: {order.orderNumber || `#${order.id}`}</td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontSize: '9pt' }}>Waktu</td>
            <td style={{ ...tdL, fontSize: '9pt' }}>: {fmtTime(order.createdAt)} ({fmtDate(order.createdAt)})</td>
          </tr>
        </tbody>
      </table>

      {divider}

      <div style={{ fontSize: '10pt', fontWeight: 900, margin: '1mm 0' }}>
        DAFTAR PESANAN MINUMAN:
      </div>

      <table style={{ ...tbl, margin: '1mm 0' }}>
        <tbody>
          {barItems.map((item: any, idx: number) => (
            <React.Fragment key={idx}>
              <tr>
                <td style={{ ...tdL, fontSize: '13pt', fontWeight: 900, paddingTop: idx > 0 ? '2mm' : '0' }}>
                  [{item.qty}x] {item.product?.name || 'Item'}
                </td>
              </tr>
              {item.notes && (
                <tr>
                  <td style={{ ...tdL, paddingLeft: '4mm', fontSize: '10pt', fontWeight: 900 }}>
                    &gt;&gt; CATATAN: {item.notes}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {barItems.length === 0 && (
            <tr><td style={{ ...tdL, fontSize: '9pt', color: '#666' }}>(Tidak ada item minuman)</td></tr>
          )}
        </tbody>
      </table>

      {doubleDivider}
      <div style={{ textAlign: 'center', fontSize: '8pt', margin: '1mm 0' }}>
        Sajikan dingin & segar!
      </div>
    </div>
  );

  // ── Sub-component: Customer Receipt ──
  const renderCustomerReceipt = () => (
    <div>
      {/* ═══ HEADER ═══ */}
      <div style={{ textAlign: 'center', marginBottom: '1mm' }}>
        <div style={{ fontSize: '14pt', fontWeight: '900', letterSpacing: '1px' }}>
          {storeSettings?.storeName || 'MUKI RAMEN'}
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
          {order.table?.tableNo && (
            <tr><td style={{ ...tdL, width: '14mm' }}>Meja</td><td style={tdL}>: {order.table.tableNo}</td></tr>
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
