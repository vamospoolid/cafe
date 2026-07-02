import React, { useState, useContext, useEffect } from 'react';
import { X, Wallet, QrCode, CreditCard, CheckCircle, Scissors, Tag, User, UserPlus, Check, Printer } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { offlineDB } from '../utils/offlineDb';
import CustomerModal from './CustomerModal';
import ReceiptPrinter from './ReceiptPrinter';
import { 
  isNativeMobile, 
  connectBluetoothPrinter, 
  printBluetoothReceipt, 
  disconnectBluetoothPrinter 
} from '../utils/printerBluetooth';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  total: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  cart: any[];
  customer: any;
  orderId?: number | string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, total, subtotal, tax, serviceCharge, cart, customer, orderId }) => {
  const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'qris' | 'kartu' | 'split' | 'piutang'>('tunai');
  const [cashGiven, setCashGiven]         = useState<number>(0);
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [splitCash, setSplitCash]         = useState<number>(0);
  const [dueDate, setDueDate]             = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14); // default 14 hari
    return date.toISOString().slice(0, 10);
  });
  const [debtNotes, setDebtNotes]         = useState<string>('');
  const [isSuccess, setIsSuccess]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const posContext = useContext(POSContext);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printOrderData, setPrintOrderData] = useState<any | null>(null);

  const handleDirectPrint = async (id: number) => {
    const isHighPrecision = localStorage.getItem('high_precision_mode') === 'true';
    // Check if running on native mobile platform with Bluetooth printer configured and high precision mode is enabled
    if (isHighPrecision && isNativeMobile() && localStorage.getItem('bluetooth_printer_mac')) {
      const macAddress = localStorage.getItem('bluetooth_printer_mac')!;
      setPrintLoading(true);
      try {
        const orderRes = await fetch(`/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (!orderRes.ok) throw new Error('Gagal mengambil detail order untuk cetak Bluetooth');
        const orderData = await orderRes.json();
        
        await connectBluetoothPrinter(macAddress);
        await printBluetoothReceipt(orderData, {
          name: posContext?.settings?.storeName || 'SOL CAFE',
          address: posContext?.settings?.address || 'Jl. Kopi No.1',
          footer: posContext?.settings?.receiptFooter || 'Terima kasih!'
        });
        await disconnectBluetoothPrinter();
        toast('Struk berhasil dicetak via Bluetooth!', 'success');
      } catch (err: any) {
        toast(err.message || 'Gagal cetak via Bluetooth', 'error');
      } finally {
        setPrintLoading(false);
      }
      return;
    }

    if (!posContext?.settings?.printerIp) {
      // Fallback to browser standard print for USB connected printer on Web Desktop
      console.log('handleDirectPrint: starting fallback browser print for order id:', id);
      setPrintLoading(true);
      try {
        const orderRes = await fetch(`/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (!orderRes.ok) throw new Error('Gagal mengambil detail order');
        const orderData = await orderRes.json();
        console.log('handleDirectPrint: fetched orderData successfully:', orderData);
        setPrintOrderData(orderData);
      } catch (err: any) {
        console.error('handleDirectPrint: fallback print failed with error:', err);
        toast(err.message || 'Gagal menyiapkan cetak browser', 'error');
      } finally {
        setPrintLoading(false);
      }
      return;
    }
    setPrintLoading(true);
    try {
      const res = await fetch('/api/printer/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ orderId: id })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Struk berhasil dicetak langsung ke printer!', 'success');
      } else {
        toast(data.error || 'Gagal mencetak struk', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan jaringan ke printer', 'error');
    } finally {
      setPrintLoading(false);
    }
  };

  const [currentCustomer, setCurrentCustomer] = useState<any>(customer || null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  useEffect(() => {
    setCurrentCustomer(customer || null);
  }, [customer]);

  if (!isOpen) return null;

  const fmt = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  const parentDiscount = customer?.discountAmount || 0;
  const currentDiscount = currentCustomer?.discountAmount || 0;
  const finalTotal   = Math.max(0, total + parentDiscount - currentDiscount - manualDiscount);
  
  const change       = cashGiven - finalTotal;
  const nonCash      = Math.max(0, finalTotal - splitCash);
  const isPayable =
    paymentMethod === 'tunai'  ? cashGiven >= finalTotal
    : paymentMethod === 'split' ? splitCash > 0 && splitCash < finalTotal
    : paymentMethod === 'piutang' ? !!currentCustomer?.id
    : true;

  const quickAmounts = Array.from(new Set([finalTotal, 50000, 100000, 150000, 200000]))
    .filter(a => a >= finalTotal).sort((a, b) => a - b).slice(0, 4);

  const handleCheckout = async () => {
    setLoading(true);
    const pmString =
      paymentMethod === 'tunai'  ? 'Cash'
      : paymentMethod === 'qris' ? 'QRIS'
      : paymentMethod === 'split' ? `Split (Tunai ${fmt(splitCash)} + Non-Tunai ${fmt(nonCash)})`
      : paymentMethod === 'piutang' ? 'Piutang'
      : 'Card';
    // Handler Mode Offline
    if (!navigator.onLine || !posContext?.isOnline) {
      try {
        const offlineId = 'off-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const offlineOrder = {
          offlineId,
          customerName: currentCustomer?.name || 'Pelanggan Umum',
          customerPhone: currentCustomer?.phone || '',
          customerId: currentCustomer?.id || null,
          tableId: customer?.tableId || null,
          items: cart.map((item: any) => ({
            productId: item.product.id,
            qty: item.qty,
            price: item.product.sellPrice,
            notes: item.notes || ''
          })),
          subtotal,
          discount: (currentCustomer?.discountAmount || 0) + manualDiscount,
          pointsUsed: currentCustomer?.pointsUsed || 0,
          tax,
          serviceCharge,
          total: finalTotal,
          paymentMethod: pmString,
          isPaid: true,
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          dueDate: paymentMethod === 'piutang' ? dueDate : undefined,
          debtNotes: paymentMethod === 'piutang' ? debtNotes : undefined
        };

        await offlineDB.addOfflineOrder(offlineOrder);
        setCreatedOrderId(null);
        setIsSuccess(true);
        toast('Transaksi berhasil disimpan secara offline!', 'warning');
      } catch (err: any) {
        toast(err.message || 'Gagal menyimpan transaksi offline', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      let res: Response;
      if (orderId) {
        res = await fetch(`/api/orders/${orderId}/payment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
          body: JSON.stringify({ 
            paymentMethod: pmString, 
            discount: (currentCustomer?.discountAmount || 0) + manualDiscount, 
            total: finalTotal,
            customerId: currentCustomer?.id || null,
            pointsUsed: currentCustomer?.pointsUsed || 0,
            dueDate: paymentMethod === 'piutang' ? dueDate : undefined,
            debtNotes: paymentMethod === 'piutang' ? debtNotes : undefined
          }),
        });
      } else {
        res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
          body: JSON.stringify({
            customerName: currentCustomer?.name || 'Pelanggan Umum',
            customerPhone: currentCustomer?.phone || '',
            customerId: currentCustomer?.id || null,
            tableId: customer?.tableId || null,
            items: cart.map((item: any) => ({ productId: item.product.id, qty: item.qty, price: item.product.sellPrice, notes: item.notes || '' })),
            subtotal,
            discount: (currentCustomer?.discountAmount || 0) + manualDiscount,
            pointsUsed: currentCustomer?.pointsUsed || 0,
            tax, serviceCharge, total: finalTotal, paymentMethod: pmString, isPaid: true,
            dueDate: paymentMethod === 'piutang' ? dueDate : undefined,
            debtNotes: paymentMethod === 'piutang' ? debtNotes : undefined
          }),
        });
      }
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Gagal checkout'); }
      const data = await res.json();
      
      // Ambil ID order yang baru dibuat dari respon backend
      const createdOrder = data.order || (data.orders && data.orders[0]) || data.orderItem?.order;
      if (createdOrder) {
        setCreatedOrderId(createdOrder.id);
      }
      
      setIsSuccess(true);
    } catch (err: any) {
      toast(err.message || 'Gagal memproses pesanan.', 'error');
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="modal-overlay">
        <div style={{ background: 'var(--bg-card)', borderRadius: '1.5rem', padding: '2.5rem', textAlign: 'center', maxWidth: 400, width: '90%', animation: 'modalIn 0.3s ease-out' }}>
          <div style={{ width: 72, height: 72, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Pembayaran Berhasil!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Pesanan Anda telah diproses dan dikirim ke dapur.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {createdOrderId && (
              <button 
                onClick={() => handleDirectPrint(createdOrderId)}
                disabled={printLoading}
                style={{ 
                  width: '100%', 
                  padding: '0.8rem', 
                  fontWeight: 700, 
                  borderRadius: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'var(--primary)',
                  color: 'white'
                }}
              >
                <Printer size={16} />
                <span>{printLoading ? 'Mencetak...' : 'Cetak Struk Termal'}</span>
              </button>
            )}
            
            <button 
              onClick={() => {
                setIsSuccess(false);
                setCreatedOrderId(null);
                setLoading(false);
                onSuccess();
                onClose();
              }}
              style={{ 
                width: '100%', 
                padding: '0.8rem', 
                fontWeight: 700, 
                borderRadius: '0.75rem', 
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'white',
                color: 'var(--text-main)'
              }}
            >
              Selesai & Tutup
            </button>
          </div>
        </div>

        {printOrderData && (
          <ReceiptPrinter 
            order={printOrderData} 
            storeSettings={posContext?.settings} 
            onClose={() => setPrintOrderData(null)} 
          />
        )}
      </div>
    );
  }

  const methods: { key: 'tunai' | 'qris' | 'kartu' | 'split' | 'piutang'; label: string; icon: React.ReactNode }[] = [
    { key: 'tunai',  label: 'Tunai',  icon: <Wallet size={20} /> },
    { key: 'qris',   label: 'QRIS',   icon: <QrCode size={20} /> },
    { key: 'kartu',  label: 'Kartu',  icon: <CreditCard size={20} /> },
    { key: 'split',  label: 'Split',  icon: <Scissors size={20} /> },
    { key: 'piutang', label: 'Piutang', icon: <User size={20} /> },
  ];

  return (
    <div className="modal-overlay">
      {/* Landscape: max-w-3xl, flex-row */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: '1.5rem', boxShadow: 'var(--shadow-lg)',
        width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column',
        animation: 'modalIn 0.3s ease-out', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={20} color="var(--primary)" />
            <span>Proses Pembayaran</span>
          </h2>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>

        {/* Body: 2 columns */}
        <div style={{ display: 'flex', gap: 0, flex: 1 }}>

          {/* LEFT COLUMN: Order Summary */}
          <div style={{ width: '42%', borderRight: '1px solid var(--border-color)', padding: '1.5rem', background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Ringkasan Pesanan</p>

            {/* List Item yang Dipesan */}
            {cart && cart.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem', 
                maxHeight: '130px', 
                overflowY: 'auto', 
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                marginBottom: '0.25rem'
              }} className="scrollbar-thin">
                {cart.map((item: any, idx: number) => {
                  const prod = item.product || item;
                  const qty = item.qty;
                  const notes = item.notes;
                  const price = prod.sellPrice || item.price || 0;
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.75rem', borderBottom: idx < cart.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: idx < cart.length - 1 ? '0.375rem' : '0' }}>
                      <div style={{ flex: 1, paddingRight: '0.5rem', textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{prod.name || 'Menu'}</div>
                        {notes && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>* {notes}</div>}
                      </div>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '0.25rem', fontSize: '0.7rem' }}>{qty}x</span>
                        <span style={{ fontWeight: 700 }}>{fmt(price * qty)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PPN</span>
                  <span style={{ fontWeight: 600 }}>{fmt(tax)}</span>
                </div>
              )}
              {serviceCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Layanan</span>
                  <span style={{ fontWeight: 600 }}>{fmt(serviceCharge)}</span>
                </div>
              )}
              {(manualDiscount > 0 || currentDiscount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#dc2626' }}>Diskon</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>-{fmt(currentDiscount + manualDiscount)}</span>
                </div>
              )}
            </div>

            {/* Discount input - tucked in bottom left */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', borderRadius: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)' }}>
                <Tag size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Diskon</span>
                <input
                  type="number"
                  style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, textAlign: 'right', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}
                  value={manualDiscount || ''}
                  onChange={e => setManualDiscount(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Big total */}
            <div style={{ background: 'var(--primary)', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', marginBottom: '0.25rem' }}>Total Bayar</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{fmt(finalTotal)}</div>
            </div>

            {/* Customer / Member Info */}
            {posContext?.settings?.loyaltyEnabled !== false && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                {currentCustomer?.name && currentCustomer?.name !== 'Pelanggan Umum' ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User size={14} />
                        <span>{currentCustomer.name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#15803d', textAlign: 'left' }}>
                        {currentCustomer.phone} {currentCustomer.points !== undefined ? `• ${currentCustomer.points} pts` : ''}
                      </div>
                      {currentCustomer.discountAmount > 0 && (
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', marginTop: '0.1rem', textAlign: 'left' }}>
                          Redeem: -{fmt(currentCustomer.discountAmount)}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsCustomerModalOpen(true)}
                      style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'white', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                    >
                      Ubah
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsCustomerModalOpen(true)}
                    style={{ width: '100%', padding: '0.75rem', background: 'white', border: '1px dashed var(--border-color)', borderRadius: '0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  >
                    <UserPlus size={16} />
                    <span>Hubungkan Member & Poin</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Payment Input */}
          <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Payment method tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {methods.map(m => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                    padding: '0.75rem 0.25rem', borderRadius: '0.75rem', border: '2px solid',
                    borderColor: paymentMethod === m.key ? 'var(--primary)' : 'var(--border-color)',
                    background: paymentMethod === m.key ? 'var(--secondary)' : 'transparent',
                    color: paymentMethod === m.key ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.15s',
                  }}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {/* Payment inputs */}
            <div style={{ flex: 1 }}>
              {paymentMethod === 'tunai' && (
                <>
                  <p style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Uang Diterima</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {quickAmounts.map(amt => (
                      <button key={amt} onClick={() => setCashGiven(amt)} style={{
                        padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.6rem',
                        background: cashGiven === amt ? 'var(--secondary)' : 'white',
                        borderColor: cashGiven === amt ? 'var(--primary)' : 'var(--border-color)',
                        color: cashGiven === amt ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        {amt === finalTotal ? 'Uang Pas' : fmt(amt)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid var(--border-color)', borderRadius: '0.75rem', fontSize: '1.25rem', fontWeight: 800, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                    value={cashGiven || ''}
                    onChange={e => setCashGiven(Number(e.target.value))}
                    placeholder="0"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 0 0', borderTop: '1px dashed var(--border-color)', marginTop: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Kembalian</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: change < 0 ? '#dc2626' : '#16a34a' }}>
                      {change < 0 ? 'Kurang bayar' : fmt(change)}
                    </span>
                  </div>
                </>
              )}

              {paymentMethod === 'qris' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '1rem 0' }}>
                  <div style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '2px dashed var(--border-color)' }}>
                    <QrCode size={120} color="var(--primary)" />
                  </div>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>Scan QRIS via M-Banking / E-Wallet</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tunjukkan ke pelanggan atau cetak QR</p>
                </div>
              )}

              {paymentMethod === 'kartu' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem', padding: '1rem 0' }}>
                  <div style={{ width: 72, height: 72, background: '#ede9fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={32} color="var(--primary)" />
                  </div>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>Kartu Debit / Kredit</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Minta pelanggan untuk tap atau gesek kartu pada mesin EDC</p>
                </div>
              )}

              {paymentMethod === 'split' && (
                <>
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Scissors size={14} />
                      <span>Pembayaran dipisah antara Tunai dan Non-Tunai</span>
                    </p>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Berapa yang dibayar Tunai?</p>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid var(--border-color)', borderRadius: '0.75rem', fontSize: '1.25rem', fontWeight: 800, textAlign: 'right', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
                    value={splitCash || ''}
                    onChange={e => setSplitCash(Number(e.target.value))}
                    placeholder="0"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', background: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
                    <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.875rem' }}>Sisa Non-Tunai (QRIS/Kartu)</span>
                    <span style={{ fontWeight: 900, color: '#2563eb' }}>{fmt(nonCash)}</span>
                  </div>
                </>
              )}

              {paymentMethod === 'piutang' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0 }}>
                      <User size={14} />
                      <span>Metode Pembayaran Piutang / Kasbon</span>
                    </p>
                    {!currentCustomer?.id && (
                      <p style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, margin: '0.25rem 0 0' }}>
                        * Hubungkan member terlebih dahulu untuk menggunakan metode ini!
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Tanggal Jatuh Tempo</label>
                    <input
                      type="date"
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem', fontSize: '0.85rem', outline: 'none', color: 'var(--text-main)', boxSizing: 'border-box' }}
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      required
                      disabled={!currentCustomer?.id}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Catatan Piutang (Opsional)</label>
                    <textarea
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.5rem', fontSize: '0.85rem', outline: 'none', height: '60px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: 'var(--text-main)' }}
                      placeholder="Contoh: Dibayar oleh instansi / Kasbon mingguan"
                      value={debtNotes}
                      onChange={e => setDebtNotes(e.target.value)}
                      disabled={!currentCustomer?.id}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm button */}
            <button
              className="btn-checkout"
              style={{ padding: '0.9rem' }}
              disabled={!isPayable || loading}
              onClick={handleCheckout}
            >
              {loading ? 'Memproses...' : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  <Check size={18} />
                  <span>Konfirmasi Pembayaran</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={(selected) => setCurrentCustomer(selected)}
      />

      {printOrderData && (
        <ReceiptPrinter 
          order={printOrderData} 
          storeSettings={posContext?.settings} 
          onClose={() => setPrintOrderData(null)} 
        />
      )}
    </div>
  );
};

export default CheckoutModal;
