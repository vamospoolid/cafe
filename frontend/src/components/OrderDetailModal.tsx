import React from 'react';
import { 
  X, Printer, Zap, XCircle, ShoppingBag, User, Calendar, 
  Clock, Hash, CreditCard, Tag, DollarSign, Utensils, MessageSquare, CheckCircle2, AlertCircle
} from 'lucide-react';

interface OrderDetailModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onDirectPrint?: (orderId: number) => void;
  onPreviewReceipt?: (order: any) => void;
  onVoid?: (orderId: number, orderNumber: string) => void;
  canVoid?: boolean;
  printLoading?: boolean;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onDirectPrint,
  onPreviewReceipt,
  onVoid,
  canVoid = false,
  printLoading = false
}) => {
  if (!isOpen || !order) return null;

  const formatCurrency = (val: any) => {
    const num = Number(val) || 0;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return String(isoString);
    }
  };

  // Safe parse customizations
  const parseCustomizations = (cust: any) => {
    if (!cust) return null;
    if (typeof cust === 'object') return cust;
    try {
      return JSON.parse(cust);
    } catch {
      return null;
    }
  };

  const isVoid = order.status === 'Void';
  const isPaid = order.status === 'Paid';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${
              isVoid ? 'bg-rose-100 text-rose-600' : isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {order.orderNumber}
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  isVoid ? 'bg-rose-50 text-rose-700 border-rose-200' : isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isVoid ? 'VOID' : isPaid ? 'LUNAS' : 'PENDING'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                <Clock size={12} /> {formatDate(order.createdAt)}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Order Meta Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-150">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Meja / Layanan</span>
              <span className="font-extrabold text-slate-800 text-xs mt-0.5 block truncate">
                {order.table?.name || order.tableName || 'Take Away / Luar'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Pelanggan</span>
              <span className="font-extrabold text-slate-800 text-xs mt-0.5 block truncate">
                {order.customerName || 'Tamu Umum'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Kasir / Staff</span>
              <span className="font-extrabold text-slate-800 text-xs mt-0.5 block truncate">
                {order.user?.name || order.user?.username || 'Staff'}
              </span>
            </div>
          </div>

          {/* Itemized Order List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Utensils size={13} className="text-indigo-600" />
                <span>Rincian Item Menu</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  {order.items?.length || 0} Menu
                </span>
              </h4>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              {order.items && order.items.length > 0 ? (
                order.items.map((item: any, idx: number) => {
                  const cust = parseCustomizations(item.customizations);
                  return (
                    <div key={item.id || idx} className="p-3 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                            {item.quantity}x
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {item.product?.name || item.productName || 'Menu Produk'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              @{formatCurrency(item.price)}
                            </div>
                          </div>
                        </div>

                        <div className="font-black text-slate-900 text-xs text-right shrink-0">
                          {formatCurrency(item.subtotal || (item.price * item.quantity))}
                        </div>
                      </div>

                      {/* Customizations / Variant Notes */}
                      {cust && (
                        <div className="mt-1.5 pl-7 flex flex-wrap gap-1">
                          {cust.sugar && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                              Gula: {cust.sugar}
                            </span>
                          )}
                          {cust.ice && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                              Es: {cust.ice}
                            </span>
                          )}
                          {cust.variant && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-semibold border border-purple-100">
                              {cust.variant}
                            </span>
                          )}
                          {Array.isArray(cust.toppings) && cust.toppings.map((top: any, tIdx: number) => (
                            <span key={tIdx} className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-semibold border border-amber-100">
                              +{top.name || top}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Kitchen Special Notes */}
                      {item.notes && (
                        <div className="mt-1 pl-7 text-[10px] text-amber-700 italic flex items-center gap-1 font-medium">
                          <MessageSquare size={10} className="shrink-0" />
                          <span>Catatan: "{item.notes}"</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400">Tidak ada rincian item</div>
              )}
            </div>
          </div>

          {/* Financial Summary Box */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal Penjualan</span>
              <span className="text-slate-700 font-bold">{formatCurrency(order.subtotal || order.total)}</span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span className="flex items-center gap-1"><Tag size={12} /> Diskon / Promo</span>
                <span className="font-bold">-{formatCurrency(order.discount)}</span>
              </div>
            )}

            {order.tax > 0 && (
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Pajak (PB1)</span>
                <span className="text-slate-700 font-bold">+{formatCurrency(order.tax)}</span>
              </div>
            )}

            {order.serviceCharge > 0 && (
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Service Charge</span>
                <span className="text-slate-700 font-bold">+{formatCurrency(order.serviceCharge)}</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
              <div>
                <span className="font-black text-slate-900 text-sm block">Total Tagihan</span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Metode: <b className="text-slate-700 uppercase">{order.paymentMethod || 'TUNAI'}</b>
                </span>
              </div>
              <div className="text-right">
                <span className="font-black text-lg text-indigo-700 tracking-tight">
                  {formatCurrency(order.total)}
                </span>
                {order.cashGiven > 0 && (
                  <div className="text-[10px] text-slate-500">
                    Bayar: {formatCurrency(order.cashGiven)} • Kembalian: {formatCurrency(order.change || 0)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            {!isVoid && canVoid && onVoid && (
              <button 
                type="button"
                onClick={() => onVoid(order.id, order.orderNumber)}
                className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
              >
                <XCircle size={15} />
                <span>Void Pesanan</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onPreviewReceipt && (
              <button 
                type="button"
                onClick={() => onPreviewReceipt(order)}
                className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Printer size={15} className="text-slate-500" />
                <span>Preview Struk</span>
              </button>
            )}

            {onDirectPrint && (
              <button 
                type="button"
                onClick={() => onDirectPrint(order.id)}
                disabled={printLoading}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-200 transition-all active:scale-95"
              >
                <Zap size={15} className={printLoading ? 'animate-pulse' : ''} />
                <span>{printLoading ? 'Mencetak...' : 'Cetak Struk'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
