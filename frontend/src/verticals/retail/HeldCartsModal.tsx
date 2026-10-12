import React from 'react';
import {
  X,
  Clock,
  User,
  ShoppingBag,
  Trash2,
  ArrowRight,
  Boxes,
  Tag,
  AlertCircle
} from 'lucide-react';

export interface HeldCartItem {
  id: string;
  note?: string;
  customer: any | null;
  customerPhone?: string;
  priceTier: 'UMUM' | 'MITRA' | 'GROSIR';
  cart: any[];
  total: number;
  totalQty: number;
  createdAt: number;
}

interface HeldCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldCarts: HeldCartItem[];
  onRecallCart: (heldCart: HeldCartItem) => void;
  onDeleteHeldCart: (heldCartId: string) => void;
  currentCartLength: number;
}

export const HeldCartsModal: React.FC<HeldCartsModalProps> = ({
  isOpen,
  onClose,
  heldCarts,
  onRecallCart,
  onDeleteHeldCart,
  currentCartLength
}) => {
  if (!isOpen) return null;

  const formatRupiah = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const getTimeAgo = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return `${diffSec} detik lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHours = Math.floor(diffMin / 60);
    return `${diffHours} jam lalu`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] transition-all">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Boxes size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-200 border border-amber-400/20">
                  HOLD &amp; RECALL CART
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {heldCarts.length} Transaksi Parkir
                </span>
              </div>
              <h3 className="font-black text-base sm:text-lg text-white mt-0.5">
                Daftar Keranjang Belanja Terparkir
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info Note jika keranjang saat ini sedang ada isinya */}
        {currentCartLength > 0 && (
          <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle size={15} className="shrink-0 text-amber-600" />
            <span>
              <b>Perhatian:</b> Keranjang kasir saat ini berisi {currentCartLength} item. Mengambil transaksi terparkir akan menukar atau menimpa keranjang aktif.
            </span>
          </div>
        )}

        {/* Body: Daftar Parkir */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {heldCarts.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <ShoppingBag size={28} />
              </div>
              <h4 className="font-black text-slate-700 text-sm">Tidak Ada Transaksi Terparkir</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Gunakan tombol <b>Parkir (F6)</b> saat pembeli ingin mengambil barang tambahan agar antrean kasir tetap lancar.
              </p>
            </div>
          ) : (
            heldCarts.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-900 truncate">
                      {item.customer?.name || item.note || 'Pelanggan Umum'}
                    </span>
                    {item.priceTier && item.priceTier !== 'UMUM' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                        {item.priceTier}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={11} />
                      {getTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  {/* Preview Items */}
                  <div className="text-[11px] text-slate-500 line-clamp-1">
                    {item.cart.slice(0, 3).map((c: any) => `${c.qty}x ${c.productName}`).join(', ')}
                    {item.cart.length > 3 ? ` +${item.cart.length - 3} item lainnya` : ''}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-xs font-black text-slate-900">
                      {formatRupiah(item.total)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      ({item.totalQty || item.cart.reduce((s: number, i: any) => s + (i.qty || 1), 0)} unit)
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => onDeleteHeldCart(item.id)}
                    className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition-all cursor-pointer"
                    title="Hapus transaksi parkir ini"
                  >
                    <Trash2 size={16} />
                  </button>

                  <button
                    onClick={() => {
                      onRecallCart(item);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                  >
                    <span>Lanjutkan Kasir</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Tekan <b>F6</b> untuk membuka/menutup modal ini</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
