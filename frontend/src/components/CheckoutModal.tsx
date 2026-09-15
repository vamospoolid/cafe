import React, { useState, useContext, useEffect } from 'react';
import { 
  X, Wallet, QrCode, CreditCard, CheckCircle, Scissors, Tag, User, UserPlus, Check, 
  Printer, Utensils, Coffee, Layers, Sparkles, ArrowRight, Banknote, Calendar, 
  FileText, ChevronDown, ChevronUp, AlertCircle, ShoppingBag, ShieldCheck
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { offlineDB } from '../utils/offlineDb';
import CustomerModal from './CustomerModal';
import ReceiptPrinter from './ReceiptPrinter';
import SplitPrintModal from './SplitPrintModal';
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

const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, onClose, onSuccess, total, subtotal, tax, serviceCharge, cart, customer, orderId 
}) => {
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
  const [showItemsList, setShowItemsList] = useState(false);
  const [showNumpad, setShowNumpad]       = useState(false);

  const posContext = useContext(POSContext);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printOrderData, setPrintOrderData] = useState<any | null>(null);

  const [currentCustomer, setCurrentCustomer] = useState<any>(customer || null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [showSplitPrintModal, setShowSplitPrintModal] = useState(false);
  const [fetchedFullOrder, setFetchedFullOrder] = useState<any | null>(null);

  useEffect(() => {
    setCurrentCustomer(customer || null);
  }, [customer]);

  const fmt = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;
  
  const parentDiscount = customer?.discountAmount || 0;
  const currentDiscount = currentCustomer?.discountAmount || 0;
  const finalTotal = Math.max(0, total + parentDiscount - currentDiscount - manualDiscount);
  
  // Initialize cashGiven with exact total when opening or changing method
  useEffect(() => {
    if (isOpen && paymentMethod === 'tunai' && cashGiven === 0) {
      setCashGiven(finalTotal);
    }
  }, [isOpen, finalTotal, paymentMethod]);

  if (!isOpen) return null;

  const change = cashGiven - finalTotal;
  const nonCash = Math.max(0, finalTotal - splitCash);
  const isPayable =
    paymentMethod === 'tunai' ? cashGiven >= finalTotal
    : paymentMethod === 'split' ? splitCash > 0 && splitCash < finalTotal
    : paymentMethod === 'piutang' ? !!currentCustomer?.id
    : true;

  // Smart quick preset amounts calculation
  const getSmartPresets = (target: number) => {
    if (target <= 0) return [0];
    const list: number[] = [target];
    if (target % 10000 !== 0) list.push(Math.ceil(target / 10000) * 10000);
    if (target % 50000 !== 0) list.push(Math.ceil(target / 50000) * 50000);
    if (target % 100000 !== 0) list.push(Math.ceil(target / 100000) * 100000);
    [50000, 100000, 150000, 200000, 500000].forEach(v => {
      if (v > target) list.push(v);
    });
    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 4);
  };

  const quickAmounts = getSmartPresets(finalTotal);

  const handleDirectPrint = async (id: number) => {
    const isHighPrecision = localStorage.getItem('high_precision_mode') === 'true';
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

    // ELECTRON RAW PRINT
    if ((window as any).electronPOS?.isElectron) {
      setPrintLoading(true);
      try {
        const orderRes = await fetch(`/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (!orderRes.ok) throw new Error('Gagal mengambil detail order');
        const orderData = await orderRes.json();
        
        const result = await (window as any).electronPOS.printer.printReceipt(
          orderData, 
          posContext?.settings
        );
        
        if (result.success) {
          toast('Struk berhasil dicetak!', 'success');
        } else {
          toast(`Gagal cetak: ${result.message}`, 'error');
        }
      } catch (err: any) {
        toast(err.message || 'Gagal cetak via Electron', 'error');
      } finally {
        setPrintLoading(false);
      }
      return;
    }

    if (!posContext?.settings?.printerIp) {
      setPrintLoading(true);
      try {
        const orderRes = await fetch(`/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (!orderRes.ok) throw new Error('Gagal mengambil detail order');
        const orderData = await orderRes.json();
        setPrintOrderData(orderData);
      } catch (err: any) {
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

  const handleOpenSplitPrint = async (id: number) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFetchedFullOrder(data);
        setShowSplitPrintModal(true);
      }
    } catch (e) {
      toast('Gagal mengambil rincian pesanan untuk cetak', 'error');
    }
  };

  const handlePrintSpecificTarget = async (id: number, target: 'kitchen' | 'bar') => {
    try {
      setPrintLoading(true);
      const res = await fetch(`/api/printer/${target}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ orderId: id })
      });
      if (res.ok) {
        toast(`Tiket pesanan ${target === 'kitchen' ? 'Dapur (Makanan)' : 'Bar (Minuman)'} berhasil dicetak!`, 'success');
      } else {
        await handleOpenSplitPrint(id);
      }
    } catch (e) {
      await handleOpenSplitPrint(id);
    } finally {
      setPrintLoading(false);
    }
  };

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
      
      const createdOrder = data.order || (data.orders && data.orders[0]) || data.orderItem?.order;
      if (createdOrder) {
        setCreatedOrderId(createdOrder.id);
        
        if (posContext?.settings?.autoPrintReceipt) {
          handleDirectPrint(createdOrder.id);
        }
        if (posContext?.settings?.autoPrintKitchen) {
          handlePrintSpecificTarget(createdOrder.id, 'kitchen');
        }
        if (posContext?.settings?.autoPrintBar) {
          handlePrintSpecificTarget(createdOrder.id, 'bar');
        }
      }
      
      setIsSuccess(true);
    } catch (err: any) {
      toast(err.message || 'Gagal memproses pesanan.', 'error');
      setLoading(false);
    }
  };

  // SUCCESS STATE VIEW
  if (isSuccess) {
    return (
      <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full shadow-2xl border border-slate-100 animate-scale-up">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5 ring-8 ring-emerald-50/50">
            <CheckCircle size={44} className="text-emerald-500 animate-bounce" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">Pembayaran Sukses!</h2>
          <p className="text-slate-500 text-sm mb-6">Transaksi berhasil dicatat ke sistem POS.</p>

          {/* Change pill if cash */}
          {paymentMethod === 'tunai' && change > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6 text-emerald-800">
              <span className="text-xs uppercase font-bold tracking-wider block text-emerald-600 mb-0.5">Kembalian Pelanggan</span>
              <span className="text-2xl font-black">{fmt(change)}</span>
            </div>
          )}
          
          <div className="flex flex-col gap-2.5">
            {createdOrderId && (
              <>
                <button 
                  onClick={() => handleDirectPrint(createdOrderId)}
                  disabled={printLoading}
                  className="w-full py-3 px-4 font-bold rounded-xl flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-md transition-all active:scale-[0.98]"
                >
                  <Printer size={18} />
                  <span>{printLoading ? 'Mencetak...' : 'Cetak Struk Kasir'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePrintSpecificTarget(createdOrderId, 'kitchen')}
                    disabled={printLoading}
                    className="py-2.5 px-3 font-semibold rounded-xl flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs transition-all"
                  >
                    <Utensils size={15} />
                    <span>Tiket Dapur</span>
                  </button>
                  <button
                    onClick={() => handlePrintSpecificTarget(createdOrderId, 'bar')}
                    disabled={printLoading}
                    className="py-2.5 px-3 font-semibold rounded-xl flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 text-xs transition-all"
                  >
                    <Coffee size={15} />
                    <span>Tiket Bar</span>
                  </button>
                </div>

                <button
                  onClick={() => handleOpenSplitPrint(createdOrderId)}
                  className="w-full py-2.5 px-3 font-semibold rounded-xl flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-all"
                >
                  <Layers size={15} />
                  <span>Pusat Multi-Print & Potong Tiket</span>
                </button>
              </>
            )}
            
            <button 
              onClick={() => {
                setIsSuccess(false);
                setCreatedOrderId(null);
                setLoading(false);
                onSuccess();
                onClose();
              }}
              className="w-full py-3 px-4 font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm shadow-lg mt-2 transition-all active:scale-[0.98]"
            >
              Selesai & Transaksi Baru
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

        {showSplitPrintModal && fetchedFullOrder && (
          <SplitPrintModal
            order={fetchedFullOrder}
            isOpen={showSplitPrintModal}
            onClose={() => {
              setShowSplitPrintModal(false);
              setFetchedFullOrder(null);
            }}
          />
        )}
      </div>
    );
  }

  const paymentTabs = [
    { key: 'tunai', label: 'Tunai', icon: Banknote, color: 'text-emerald-600' },
    { key: 'qris', label: 'QRIS', icon: QrCode, color: 'text-indigo-600' },
    { key: 'kartu', label: 'Kartu', icon: CreditCard, color: 'text-blue-600' },
    { key: 'split', label: 'Split', icon: Scissors, color: 'text-amber-600' },
    { key: 'piutang', label: 'Piutang', icon: User, color: 'text-purple-600' },
  ];

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="bg-white rounded-[28px] shadow-2xl border border-slate-100 w-full max-w-4xl flex flex-col md:flex-row overflow-hidden my-auto"
        style={{ animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* ================= LEFT COLUMN: ORDER HERO & BREAKDOWN ================= */}
        <div className="w-full md:w-[42%] bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 p-5 md:p-6 flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            {/* Header / Table tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                  <ShoppingBag size={13} />
                  {orderId ? `Order #${orderId}` : (customer?.tableId ? `Meja ${customer.tableId}` : 'Pesanan Baru')}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {cart?.length || 0} Item
                </span>
              </div>
              <button 
                onClick={() => setShowItemsList(!showItemsList)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 md:hidden"
              >
                <span>{showItemsList ? 'Sembunyikan' : 'Rincian'}</span>
                {showItemsList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* HERO TOTAL TAGIHAN */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="text-indigo-200/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-300" />
                <span>Total Pembayaran</span>
              </div>
              <div className="text-3xl font-black tracking-tight text-white">
                {fmt(finalTotal)}
              </div>
            </div>

            {/* Accordion / Item list */}
            <div className={`flex flex-col gap-2 ${showItemsList ? 'block' : 'hidden md:flex'}`}>
              <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {cart && cart.map((item: any, idx: number) => {
                  const prod = item.product || item;
                  const price = prod.sellPrice || item.price || 0;
                  return (
                    <div key={idx} className="flex justify-between items-start text-xs py-1 border-b border-slate-200/60 last:border-none">
                      <div className="flex-1 pr-2">
                        <div className="font-semibold text-slate-800 line-clamp-1">{prod.name}</div>
                        {item.notes && <div className="text-[10px] text-slate-400 italic">*{item.notes}</div>}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <span className="text-slate-400 mr-1.5">{item.qty}x</span>
                        <span className="font-bold text-slate-700">{fmt(price * item.qty)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal, Tax, Discounts Details */}
              <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-700">{fmt(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>PPN (Pajak)</span>
                    <span className="font-semibold text-slate-700">+{fmt(tax)}</span>
                  </div>
                )}
                {serviceCharge > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Service Charge</span>
                    <span className="font-semibold text-slate-700">+{fmt(serviceCharge)}</span>
                  </div>
                )}
                {(manualDiscount > 0 || currentDiscount > 0) && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon & Poin</span>
                    <span>-{fmt(currentDiscount + manualDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Quick Discount Input */}
              <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2 mt-1">
                <Tag size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-500 shrink-0">Diskon Khusus:</span>
                <input
                  type="number"
                  placeholder="0"
                  max={Math.max(0, total + parentDiscount - currentDiscount)}
                  value={manualDiscount || ''}
                  onChange={e => {
                    const maxAllowed = Math.max(0, total + parentDiscount - currentDiscount);
                    const val = Number(e.target.value) || 0;
                    setManualDiscount(Math.max(0, Math.min(val, maxAllowed)));
                  }}
                  className="w-full text-right font-bold text-xs text-rose-600 outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Member Loyalty / Guest Card */}
          {posContext?.settings?.loyaltyEnabled !== false && (
            <div className="mt-4 pt-3 border-t border-slate-200/80">
              {currentCustomer?.id ? (
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs">
                      {currentCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-900 leading-tight flex items-center gap-1">
                        <span>{currentCustomer.name}</span>
                        <ShieldCheck size={12} className="text-emerald-600" />
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 uppercase">
                          {currentCustomer.tier || 'Member'}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        {currentCustomer.points || 0} Poin Tersedia
                        {currentCustomer.discountAmount > 0 && ` • Hemat ${fmt(currentCustomer.discountAmount)}`}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-2 py-1 rounded-lg shadow-sm"
                  >
                    Ganti
                  </button>
                </div>
              ) : currentCustomer?.name && currentCustomer?.name !== 'Pelanggan Umum' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs">
                      {currentCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1">
                        <span>{currentCustomer.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">Tamu</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {currentCustomer.phone || 'Non-Member'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm"
                  >
                    Ubah / Member
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <UserPlus size={14} />
                  <span>Pilih Pelanggan / Member & Poin</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: PAYMENT SELECTION & INPUTS ================= */}
        <div className="flex-1 p-5 md:p-6 flex flex-col justify-between bg-white">
          <div>
            {/* Top Modal Bar: Title & Close Button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <span>Pilih Metode Pembayaran</span>
              </h3>
              <button 
                onClick={onClose} 
                disabled={loading}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* PAYMENT METHOD SELECTOR TABS */}
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100/90 rounded-2xl mb-5">
              {paymentTabs.map(tab => {
                const IconComponent = tab.icon;
                const isSelected = paymentMethod === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      posContext?.triggerHaptic(15);
                      setPaymentMethod(tab.key as any);
                    }}
                    className={`py-2.5 px-1 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all relative ${
                      isSelected 
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5 scale-[1.02]' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                    }`}
                  >
                    <IconComponent size={18} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[11px] tracking-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: TUNAI (CASH) */}
            {paymentMethod === 'tunai' && (
              <div className="space-y-4 animate-fade-in">
                {/* 1. FAST TENDER CHIPS (1-TAP SELECTION) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                    <span>Pilihan Cepat Uang Diterima</span>
                    <span className="text-[11px] text-indigo-600 font-medium">1-Tap Langsung Hitung</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {quickAmounts.map(amt => {
                      const isSelected = cashGiven === amt;
                      const returnVal = amt - finalTotal;
                      const isExact = amt === finalTotal;

                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            posContext?.triggerHaptic(20);
                            setCashGiven(amt);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            isSelected 
                              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className={`text-xs font-black ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {isExact ? '⚡ Uang Pas' : fmt(amt)}
                          </div>
                          <div className={`text-[10px] mt-1 font-medium ${isExact ? 'text-slate-500' : (returnVal >= 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400')}`}>
                            {isExact ? 'Pas (Rp 0)' : `Kembali ${fmt(returnVal)}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. CUSTOM AMOUNT INPUT BAR */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-600">Nominal Tunai Manual</label>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => setShowNumpad(!showNumpad)}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline px-1.5 py-0.5"
                      >
                        {showNumpad ? 'Sembunyikan Keypad' : 'Tampilkan Keypad'}
                      </button>
                      {cashGiven > 0 && (
                        <button 
                          type="button"
                          onClick={() => setCashGiven(0)}
                          className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 px-1.5 py-0.5"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-base font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={cashGiven || ''}
                      onChange={e => setCashGiven(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xl font-black text-slate-900 text-right outline-none transition-all"
                    />
                  </div>

                  {/* Quick Add Pills */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                    {[10000, 20000, 50000, 100000].map(addVal => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => {
                          posContext?.triggerHaptic(15);
                          setCashGiven((prev) => (prev || 0) + addVal);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-[11px] font-bold text-slate-600 hover:text-indigo-600 whitespace-nowrap shadow-2xl transition-all"
                      >
                        +{addVal / 1000}k
                      </button>
                    ))}
                  </div>

                  {/* Optional Compact Touch Numpad */}
                  {showNumpad && (
                    <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-200/80 animate-fade-in">
                      {['1', '2', '3', '000', '4', '5', '6', '0', '7', '8', '9', '⌫'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            posContext?.triggerHaptic(15);
                            if (k === '⌫') {
                              const s = cashGiven.toString();
                              setCashGiven(s.length > 1 ? Number(s.slice(0, -1)) : 0);
                            } else if (k === '000') {
                              if (cashGiven > 0) setCashGiven(Number(cashGiven.toString() + '000'));
                            } else {
                              const s = cashGiven > 0 ? cashGiven.toString() : '';
                              setCashGiven(Number(s + k));
                            }
                          }}
                          className="py-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 font-bold text-sm text-slate-700 shadow-sm active:scale-95 transition-all"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. DYNAMIC CHANGE BADGE */}
                <div className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                  change >= 0 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-900' 
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${change >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                      {change >= 0 ? <Check size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold block uppercase tracking-wider opacity-80">
                        {change >= 0 ? 'Kembalian' : 'Kekurangan Bayar'}
                      </span>
                      <span className="text-lg font-black leading-none">
                        {change >= 0 ? fmt(change) : fmt(Math.abs(change))}
                      </span>
                    </div>
                  </div>
                  {change === 0 && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                      Uang Pas ✨
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: QRIS */}
            {paymentMethod === 'qris' && (
              <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 animate-fade-in">
                <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-slate-200">
                  <QrCode size={130} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">QRIS Standar Nasional</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                    Scan menggunakan BCA Mobile, GoPay, OVO, Dana, ShopeePay atau aplikasi e-wallet lainnya.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Siap Terima Transaksi {fmt(finalTotal)}</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: KARTU (EDC) */}
            {paymentMethod === 'kartu' && (
              <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <CreditCard size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Mesin EDC Debit & Kredit</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                    Gesek atau Tap kartu pelanggan pada mesin EDC kasir untuk tagihan senilai <strong className="text-slate-800">{fmt(finalTotal)}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SPLIT */}
            {paymentMethod === 'split' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                  <Scissors size={15} className="shrink-0 text-amber-600" />
                  <span>Bagi pembayaran antara Tunai dan Non-Tunai (QRIS/EDC)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nominal Tunai</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={splitCash || ''}
                      onChange={e => setSplitCash(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-base font-bold text-right outline-none"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-semibold text-indigo-900">Sisa Non-Tunai (QRIS/Kartu):</span>
                  <span className="text-base font-black text-indigo-700">{fmt(nonCash)}</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PIUTANG */}
            {paymentMethod === 'piutang' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 animate-fade-in">
                {!currentCustomer?.id ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-rose-500" />
                    <span>Pilih data pelanggan/member terlebih dahulu di panel kiri untuk mencatat piutang!</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-semibold flex items-center gap-2">
                    <User size={15} className="text-purple-600" />
                    <span>Piutang atas nama: <strong>{currentCustomer.name}</strong></span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Jatuh Tempo Pembayaran</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    disabled={!currentCustomer?.id}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Piutang</label>
                  <textarea
                    rows={2}
                    value={debtNotes}
                    onChange={e => setDebtNotes(e.target.value)}
                    placeholder="Contoh: Tagihan kantor / pelunasan akhir bulan"
                    disabled={!currentCustomer?.id}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CONFIRMATION CHECKOUT BUTTON */}
          <div className="mt-5 pt-3 border-t border-slate-100">
            <button
              onClick={handleCheckout}
              disabled={!isPayable || loading}
              className={`w-full py-3.5 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                isPayable && !loading
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white hover:shadow-indigo-500/25 hover:from-indigo-500 hover:to-indigo-700 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Memproses Pembayaran...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Konfirmasi Pembayaran ({fmt(finalTotal)})</span>
                  <ArrowRight size={16} className="opacity-70" />
                </>
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
