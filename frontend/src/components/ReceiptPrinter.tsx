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

  return (
    <div className="receipt-printer-container">
      <div className="receipt-paper">
        {/* Header */}
        <div className="receipt-header">
          <h2 className="receipt-store-name">{storeSettings?.storeName || 'SOL CAFE'}</h2>
          <p className="receipt-address">{storeSettings?.address || 'Jl. Kopi No.1, Jakarta Raya'}</p>
          <p className="receipt-phone">Telp: {storeSettings?.phone || '0812-3456-7890'}</p>
        </div>
        
        <div className="receipt-divider">--------------------------------</div>

        {/* Info */}
        <div className="receipt-info">
          <div>
            <span>Tgl</span>
            <span>: {formatDate(order.createdAt)}</span>
          </div>
          <div>
            <span>No</span>
            <span>: {order.orderNumber}</span>
          </div>
          <div>
            <span>Kasir</span>
            <span>: {order.user?.name || 'Kasir'}</span>
          </div>
          <div>
            <span>Plgn</span>
            <span>: {order.customerName || 'Umum'}</span>
          </div>
          {order.table?.tableNo && (
            <div>
              <span>Meja</span>
              <span>: {order.table.tableNo}</span>
            </div>
          )}
        </div>

        <div className="receipt-divider">--------------------------------</div>

        {/* Items */}
        <div className="receipt-items">
          {order.items?.map((item: any, idx: number) => (
            <div key={idx} className="receipt-item">
              <div className="item-name">{item.product?.name || 'Produk'}</div>
              <div className="item-calc">
                <span>{item.qty} x {formatCurrency(item.price)}</span>
                <span>{formatCurrency(item.qty * item.price)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="receipt-divider">--------------------------------</div>

        {/* Totals */}
        <div className="receipt-totals">
          <div className="flex-between">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal || order.total)}</span>
          </div>
          {(order.discount > 0) && (
            <div className="flex-between">
              <span>Diskon</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          {(order.tax > 0) && (
            <div className="flex-between">
              <span>Pajak (PB1)</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
          )}
          <div className="flex-between receipt-grand-total">
            <span>TOTAL</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex-between">
            <span>Metode</span>
            <span>{order.paymentMethod || 'Tunai'}</span>
          </div>
        </div>

        <div className="receipt-divider">--------------------------------</div>

        {/* Footer */}
        <div className="receipt-footer">
          <p>{storeSettings?.receiptFooter || 'Terima kasih atas kunjungannya!'}</p>
          <p>Powered by {storeSettings?.storeName || 'SOL CAFE'} Enterprise</p>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPrinter;
