import React, { useEffect } from 'react';

interface ReceiptPrinterProps {
  order: any;
  storeSettings?: any;
  onClose: () => void;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ order, storeSettings, onClose }) => {
  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const padLine = (left: string, right: string, totalWidth = 32): string => {
    const space = totalWidth - left.length - right.length;
    return left + ' '.repeat(Math.max(1, space)) + right;
  };

  useEffect(() => {
    console.log('ReceiptPrinter: mounted, scheduling window.print() with 500ms delay');
    const timer = setTimeout(() => {
      console.log('ReceiptPrinter: executing window.print() now');
      window.print();
    }, 500);

    const handleAfterPrint = () => {
      console.log('ReceiptPrinter: window.onafterprint event detected, closing...');
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      console.log('ReceiptPrinter: unmounting, clearing timer...');
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onClose]);

  if (!order) return null;

  const S: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '12pt',
    color: '#000',
    lineHeight: '1.3',
    width: '100%',
    padding: 0,
    margin: 0,
  };

  const divider = '─'.repeat(32);

  return (
    <div className="receipt-printer-container">
      <div style={S}>

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '2px' }}>
          <div style={{ fontSize: '14pt', fontWeight: '900', letterSpacing: '1px' }}>
            {storeSettings?.storeName || 'SOL CAFE'}
          </div>
          {storeSettings?.address && (
            <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{storeSettings.address}</div>
          )}
          {storeSettings?.phone && (
            <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>Telp: {storeSettings.phone}</div>
          )}
          {storeSettings?.receiptHeader && (
            <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>{storeSettings.receiptHeader}</div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2px 0' }}>{divider}</div>

        {/* INFO */}
        <table style={{ width: '100%', fontSize: '10pt', fontWeight: 'bold', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '12mm' }}>Tgl</td>
              <td style={{ width: '4px' }}>:</td>
              <td>{formatDate(order.paidAt || order.createdAt)}</td>
            </tr>
            <tr>
              <td>No</td>
              <td>:</td>
              <td>{order.orderNumber}</td>
            </tr>
            <tr>
              <td>Kasir</td>
              <td>:</td>
              <td>{order.user?.name || 'Kasir'}</td>
            </tr>
            <tr>
              <td>Plgn</td>
              <td>:</td>
              <td>{order.customerName || 'Umum'}</td>
            </tr>
            {order.table?.tableNo && (
              <tr>
                <td>Meja</td>
                <td>:</td>
                <td>{order.table.tableNo}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2px 0' }}>{divider}</div>

        {/* ITEMS */}
        <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>
          {order.items?.map((item: any, idx: number) => (
            <div key={idx} style={{ marginBottom: '3px' }}>
              <div style={{ fontWeight: '900', fontSize: '10.5pt' }}>
                {item.product?.name || 'Produk'}
                {item.notes ? <span style={{ fontWeight: 'bold', fontSize: '9pt' }}> *{item.notes}</span> : null}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ paddingLeft: '8px' }}>
                  {item.qty} x {formatCurrency(item.price)}
                </span>
                <span>{formatCurrency(item.qty * item.price)}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2px 0' }}>{divider}</div>

        {/* TOTALS */}
        <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal || order.total)}</span>
          </div>
          {order.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Diskon</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          {order.tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pajak</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
          )}
          {order.serviceCharge > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Service</span>
              <span>{formatCurrency(order.serviceCharge)}</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2px 0' }}>{divider}</div>

        {/* GRAND TOTAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14pt', fontWeight: '900', margin: '2px 0' }}>
          <span>TOTAL</span>
          <span>{formatCurrency(order.total)}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', fontWeight: 'bold' }}>
          <span>Bayar</span>
          <span>{order.paymentMethod || 'Tunai'}</span>
        </div>

        {/* LOYALTY MEMBER */}
        {order.customer?.name && (
          <>
            <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2px 0' }}>{divider}</div>
            <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Member</span>
                <span>{order.customer.name}</span>
              </div>
              {order.customer.points !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Poin</span>
                  <span>{order.customer.points} poin</span>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '2px 0' }}>{divider}</div>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', fontSize: '10pt', fontWeight: 'bold', marginTop: '2px' }}>
          <div>{storeSettings?.receiptFooter || 'Terima kasih atas kunjungannya!'}</div>
          <div style={{ marginTop: '2px', fontSize: '9pt' }}>★ Sampai jumpa lagi ★</div>
        </div>

        {/* Spacing before cut */}
        <div style={{ height: '8mm' }}></div>

      </div>
    </div>
  );
};

export default ReceiptPrinter;
