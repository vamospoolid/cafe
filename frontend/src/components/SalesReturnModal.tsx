import React, { useState } from 'react';
import { RotateCcw, X, DollarSign, PackageCheck, Utensils, Package } from 'lucide-react';
import { toast, confirmAlert } from '../utils/alert';
import { useVertical } from '../context/VerticalContext';

interface OrderItem {
  id: number;
  productId: number;
  qty: number;
  price: number;
  subtotal: number;
  uomName?: string;
  notes?: string;
  product?: {
    id: number;
    name: string;
    stock: number;
    unit?: string;
    recipes?: any[];
  };
}

interface OrderDetail {
  id: number;
  orderNumber: string;
  total: number;
  paymentMethod?: string;
  customerName?: string;
  createdAt: string;
  status: string;
  items: OrderItem[];
}

interface SalesReturnModalProps {
  order: OrderDetail;
  token?: string | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ReturnItemSelection {
  orderItemId: number;
  productId: number;
  qty: number;
  condition: 'GOOD' | 'DAMAGED';
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  order,
  token,
  isOpen = true,
  onClose,
  onSuccess
}) => {
  const { isCafe } = useVertical();
  if (!isOpen || !order) return null;
  const effectiveToken = token || localStorage.getItem('token') || '';
  const [selectedItems, setSelectedItems] = useState<Record<number, ReturnItemSelection>>({});
  const [reason, setReason] = useState('Salah beli / Tukar barang');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'DEBT_DEDUCTION' | 'NONE'>('CASH');
  const [loading, setLoading] = useState(false);

  const toggleItem = (item: OrderItem) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[item.id]) {
        delete copy[item.id];
      } else {
        copy[item.id] = {
          orderItemId: item.id,
          productId: item.productId,
          qty: 1,
          condition: 'GOOD'
        };
      }
      return copy;
    });
  };

  const updateQty = (orderItemId: number, delta: number, maxQty: number) => {
    setSelectedItems(prev => {
      if (!prev[orderItemId]) return prev;
      const current = prev[orderItemId];
      const nextQty = Math.max(1, Math.min(maxQty, current.qty + delta));
      return {
        ...prev,
        [orderItemId]: { ...current, qty: nextQty }
      };
    });
  };

  const updateCondition = (orderItemId: number, condition: 'GOOD' | 'DAMAGED') => {
    setSelectedItems(prev => {
      if (!prev[orderItemId]) return prev;
      return {
        ...prev,
        [orderItemId]: { ...prev[orderItemId], condition }
      };
    });
  };

  const totalRefund = Object.values(selectedItems).reduce((sum, sel) => {
    const item = order.items.find(i => i.id === sel.orderItemId);
    const price = item?.price || 0;
    return sum + (price * sel.qty);
  }, 0);

  const selectedCount = Object.keys(selectedItems).length;

  const handleSubmit = async () => {
    if (selectedCount === 0) {
      toast('Pilih minimal satu barang yang ingin diretur.', 'warning');
      return;
    }

    const confirm = await confirmAlert(
      'Konfirmasi Retur Barang',
      `Anda akan memproses retur untuk ${selectedCount} jenis barang senilai Rp ${totalRefund.toLocaleString('id-ID')}. Stok barang berkondisi layak jual akan otomatis bertambah ke katalog. Lanjutkan?`
    );
    if (!confirm.isConfirmed) return;

    setLoading(true);
    try {
      const payload = {
        reason,
        refundMethod,
        items: Object.values(selectedItems)
      };

      const res = await fetch(`/api/orders/${order.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast('Retur barang berhasil diproses! Stok produk telah bertambah ke katalog.', 'success');
        onSuccess();
        onClose();
      } else {
        toast(data.error || 'Gagal memproses retur barang.', 'error');
      }
    } catch (err: any) {
      toast('Kesalahan jaringan: ' + (err?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>Retur Barang &amp; Pemulihan Stok</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Faktur: <strong className="text-indigo-600">{order.orderNumber}</strong> • {order.customerName || 'Pelanggan Umum'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-100 flex items-start gap-2.5 text-xs text-purple-900">
            <PackageCheck size={18} className="text-purple-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {isCafe ? (
                <>
                  Pilih item yang dikembalikan. Untuk <strong>Produk Kemasan (RTD/Snack)</strong>, stok bertambah ke katalog jika Layak Jual. Untuk <strong>Menu Olahan Dapur</strong>, kerugian HPP otomatis dicatat ke <em>Food Waste</em> agar stok bahan baku mentah tetap akurat.
                </>
              ) : (
                <>
                  Pilih item yang dikembalikan pelanggan. Barang berkondisi <strong>Layak Jual</strong> otomatis bertambah kembali ke stok katalog toko.
                </>
              )}
            </div>
          </div>

          {/* Item Selector */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              Daftar Produk Pada Faktur ({order.items.length} Item)
            </label>
            
            {order.items.map((item) => {
              const isSelected = Boolean(selectedItems[item.id]);
              const selData = selectedItems[item.id];
              const itemTotal = (item.price || 0) * (selData?.qty || 1);
              const isRecipeItem = Boolean(item.product?.recipes && item.product.recipes.length > 0);

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-purple-50/40 border-purple-300 ring-2 ring-purple-500/10 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item)}
                        className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 block">
                            {item.product?.name || `Produk #${item.productId}`}
                          </span>
                          {isCafe && (
                            isRecipeItem ? (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                🍳 Olahan (Food Waste)
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                📦 Kemasan (Stok Pulih)
                              </span>
                            )
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Beli: <strong>{item.qty} {item.uomName || 'pcs'}</strong> @ Rp {item.price.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </label>

                    {isSelected && (
                      <span className="text-xs font-black text-purple-700">
                        Rp {itemTotal.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>

                  {/* Return Controls (when selected) */}
                  {isSelected && (
                    <div className="mt-3 pt-2.5 border-t border-purple-100 flex flex-wrap items-center justify-between gap-2.5">
                      {/* Qty Counter */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500">Jml Retur:</span>
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, -1, item.qty)}
                            disabled={selData.qty <= 1}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 font-black text-xs"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-xs font-black text-slate-800">
                            {selData.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, 1, item.qty)}
                            disabled={selData.qty >= item.qty}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 font-black text-xs"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">maks {item.qty}</span>
                      </div>

                      {/* Condition Radio Pill */}
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateCondition(item.id, 'GOOD')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                            selData.condition === 'GOOD'
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Layak Jual (+Stok)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCondition(item.id, 'DAMAGED')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                            selData.condition === 'DAMAGED'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Rusak / Cacat
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Refund Details */}
          {selectedCount > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Alasan Retur / Catatan
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Contoh: Salah beli ukuran, cacat kemasan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Metode Pengembalian Dana
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('CASH')}
                    className={`p-2.5 rounded-xl border text-left font-bold text-xs transition ${
                      refundMethod === 'CASH'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={14} />
                      <span>Tunai (Cash Refund)</span>
                    </div>
                    <span className="text-[9.5px] opacity-80 block font-normal mt-0.5">Potong kas laci shift</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRefundMethod('DEBT_DEDUCTION')}
                    className={`p-2.5 rounded-xl border text-left font-bold text-xs transition ${
                      refundMethod === 'DEBT_DEDUCTION'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={14} />
                      <span>Potong Piutang / Bon</span>
                    </div>
                    <span className="text-[9.5px] opacity-80 block font-normal mt-0.5">Kurangi sisa hutang bon</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Pengembalian ({selectedCount} Barang)
            </span>
            <span className="text-lg sm:text-xl font-black text-slate-900">
              Rp {totalRefund.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition active:scale-95"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || selectedCount === 0}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Memproses...' : 'Konfirmasi Retur'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SalesReturnModal;

