import React, { useEffect } from 'react';

interface ReceiptPrinterProps {
  order: any;
  storeSettings?: any;
  onClose: () => void;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ order, storeSettings, onClose }) => {
  const fmt = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const fmtDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  useEffect(() => {
    console.log('ReceiptPrinter: mounted');
    
    // Check if running inside Electron POS app
    const win = window as any;
    if (win.electronPOS && win.electronPOS.printer) {
      console.log('ReceiptPrinter: executing silent raw print via Electron');
      win.electronPOS.printer.printReceipt(order, storeSettings)
        .then((res: any) => {
          console.log('Print success:', res);
          onClose(); // Close modal immediately
        })
        .catch((err: any) => {
          console.error('Print failed:', err);
          alert('Gagal mencetak struk: ' + err.message);
          onClose();
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
  }, [onClose, order, storeSettings]);

  if (!order) return null;

  // ── Shared inline styles ──
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

  const row = (label: string, value: string, bold = false) => (
    <tr>
      <td style={{ ...tdL, fontWeight: bold ? '900' : 'bold', fontSize: bold ? '13pt' : '10pt' }}>{label}</td>
      <td style={{ ...tdR, fontWeight: bold ? '900' : 'bold', fontSize: bold ? '13pt' : '10pt' }}>{value}</td>
    </tr>
  );

  return (
    <div className="receipt-printer-container">
      <div style={base}>

        {/* ═══ HEADER ═══ */}
        <div style={{ textAlign: 'center', marginBottom: '1mm' }}>
          <div style={{ fontSize: '14pt', fontWeight: '900', letterSpacing: '1px' }}>
            {storeSettings?.storeName || 'SOL CAFE'}
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

        {/* Spacing before cut */}
        <div style={{ height: '10mm' }}></div>
      </div>
    </div>
  );
};

export default ReceiptPrinter;
