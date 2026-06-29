import React, { useState, useEffect, useContext } from 'react';
import { X, ArrowRight, ArrowLeft, Plus, Minus, CreditCard, Scissors } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: number;
  tableName: string;
  activeOrders: any[]; // The active orders at this table
  onSplitSuccess: (newOrder: any) => void;
}

const SplitBillModal: React.FC<SplitBillModalProps> = ({ isOpen, onClose, tableId, tableName, activeOrders, onSplitSuccess }) => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(false);

  // Left Column state: original items available
  const [sourceItems, setSourceItems] = useState<any[]>([]);
  // Right Column state: items moved to the split bill
  const [splitItems, setSplitItems] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && activeOrders.length > 0) {
      // Gather all items from the active orders at the table
      const itemsList: any[] = [];
      activeOrders.forEach(order => {
        if (order.status === 'Pending') {
          order.items.forEach((item: any) => {
            itemsList.push({
              id: item.id,
              orderId: order.id,
              productId: item.productId,
              name: item.product?.name || 'Produk',
              price: item.price,
              qty: item.qty, // original quantity
              notes: item.notes,
              currentQty: item.qty // quantity left on source
            });
          });
        }
      });
      setSourceItems(itemsList);
      setSplitItems([]);
    }
  }, [isOpen, activeOrders]);

  if (!isOpen) return null;

  // Move 1 unit from left to right
  const moveToSplit = (itemId: number) => {
    const item = sourceItems.find(i => i.id === itemId);
    if (!item || item.currentQty <= 0) return;

    // Decrease currentQty on left
    setSourceItems(prev => prev.map(i => i.id === itemId ? { ...i, currentQty: i.currentQty - 1 } : i));

    // Add or increase quantity on right
    setSplitItems(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing) {
        return prev.map(i => i.id === itemId ? { ...i, qtyToMove: i.qtyToMove + 1 } : i);
      } else {
        return [...prev, { ...item, qtyToMove: 1 }];
      }
    });
  };

  // Move 1 unit from right to left
  const moveFromSplit = (itemId: number) => {
    const splitItem = splitItems.find(i => i.id === itemId);
    if (!splitItem || splitItem.qtyToMove <= 0) return;

    // Increase currentQty on left
    setSourceItems(prev => prev.map(i => i.id === itemId ? { ...i, currentQty: i.currentQty + 1 } : i));

    // Decrease or remove quantity on right
    setSplitItems(prev => {
      if (splitItem.qtyToMove === 1) {
        return prev.filter(i => i.id !== itemId);
      } else {
        return prev.map(i => i.id === itemId ? { ...i, qtyToMove: i.qtyToMove - 1 } : i);
      }
    });
  };

  // Calculations
  const taxRate = posContext?.settings?.taxRate || 0;
  const serviceChargeRate = posContext?.settings?.serviceCharge || 0;

  const subtotal = splitItems.reduce((sum, item) => sum + (item.price * item.qtyToMove), 0);
  const tax = subtotal * (taxRate / 100);
  const serviceCharge = subtotal * (serviceChargeRate / 100);
  const total = subtotal + tax + serviceCharge;

  const fmt = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const handleProsesSplit = async () => {
    if (splitItems.length === 0) {
      toast('Pilih minimal 1 item untuk di-split', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tableId,
        splitItems: splitItems.map(item => ({
          orderItemId: item.id,
          qtyToMove: item.qtyToMove
        }))
      };

      const res = await fetch('/api/orders/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast('Pecah bill berhasil', 'success');
        onSplitSuccess(data); // Send new order details back
      } else {
        toast(data.error || 'Gagal memproses split bill', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all flex flex-col h-[600px] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Scissors size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Pecah Tagihan (Split Bill) — {tableName}
              </h2>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mt-0.5">
                Pisahkan beberapa pesanan ke bill baru untuk dibayar terpisah
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors border border-slate-100 shadow-sm"
            onClick={onClose} 
            disabled={loading}
          >
            <X size={16} />
          </button>
        </div>

        {/* Columns Grid */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Unpaid items */}
          <div className="flex-1 flex flex-col border-r border-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-50/30 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Item Belum Dibayar ({sourceItems.filter(i => i.currentQty > 0).length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sourceItems.every(i => i.currentQty === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                  <p className="text-sm font-semibold">Semua item telah dipindahkan</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan tombol minus di kanan jika ingin membatalkan.</p>
                </div>
              ) : (
                sourceItems.map(item => {
                  if (item.currentQty <= 0) return null;
                  return (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 transition-colors">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{fmt(item.price)}</div>
                        {item.notes && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 mt-1 inline-block">{item.notes}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1 min-w-[36px] text-center">
                          {item.currentQty}x
                        </span>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
                          onClick={() => moveToSplit(item.id)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Split Items */}
          <div className="flex-1 flex flex-col bg-slate-50/20 overflow-hidden">
            <div className="p-4 bg-slate-50/30 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Item Bill Baru ({splitItems.reduce((sum, i) => sum + i.qtyToMove, 0)})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {splitItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center p-6">
                  <Scissors size={48} className="stroke-1 mb-2 opacity-50 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-400">Belum ada item terpilih</p>
                  <p className="text-xs text-slate-400 mt-1">Klik tombol plus (+) di sebelah kiri untuk memindahkan item.</p>
                </div>
              ) : (
                splitItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors shadow-sm">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{fmt(item.price)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
                        onClick={() => moveFromSplit(item.id)}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="font-extrabold text-sm text-indigo-600 bg-indigo-50/50 border border-indigo-100/50 rounded-lg px-2.5 py-1 min-w-[36px] text-center">
                        {item.qtyToMove}x
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer with Calculations and Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-6 justify-between items-center">
          
          {/* Summary pricing */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 w-full md:w-auto">
            <div className="flex gap-2">
              Subtotal: <span className="text-slate-800 font-bold">{fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex gap-2">
                Pajak ({taxRate}%): <span className="text-slate-800 font-bold">{fmt(tax)}</span>
              </div>
            )}
            {serviceChargeRate > 0 && (
              <div className="flex gap-2">
                Service: <span className="text-slate-800 font-bold">{fmt(serviceCharge)}</span>
              </div>
            )}
            <div className="flex gap-2 text-sm border-l border-slate-200 pl-6">
              Total Tagihan Baru: <span className="text-indigo-600 font-black">{fmt(total)}</span>
            </div>
          </div>

          {/* Button actions */}
          <div className="flex gap-3 w-full md:w-auto shrink-0">
            <button 
              type="button" 
              className="px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]" 
              onClick={onClose} 
              disabled={loading}
            >
              Batal
            </button>
            <button 
              type="button" 
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center gap-2 shadow-md shadow-indigo-100"
              onClick={handleProsesSplit}
              disabled={loading || splitItems.length === 0}
            >
              <CreditCard size={16} />
              {loading ? 'Memproses...' : 'Proses Split & Bayar'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SplitBillModal;
