import React from 'react';
import { Package, AlertTriangle, ArrowUpRight, ShieldCheck, ClipboardList, ShoppingCart, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BengkelInventoryBlokProps {
  stockAssetValue: number;
  stockAssetHPP: number;
  stockMarginPersen: number;
  lowStockCount: number;
  pendingPartRequestsCount?: number;
  onOpenPartRequestModal?: () => void;
}

export const BengkelInventoryBlok: React.FC<BengkelInventoryBlokProps> = ({
  stockAssetValue = 0,
  stockAssetHPP = 0,
  stockMarginPersen = 0,
  lowStockCount = 0,
  pendingPartRequestsCount = 0,
  onOpenPartRequestModal
}) => {
  const navigate = useNavigate();
  const profitPotential = Math.max(0, stockAssetValue - stockAssetHPP);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Package size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Ringkasan Aset Sparepart
            </h3>
          </div>
          <button
            onClick={() => navigate('/bengkel/pengadaan')}
            className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Rencana Belanja</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Valuasi modal & ketersediaan stok suku cadang
        </p>
      </div>

      <div className="flex flex-col gap-2.5 my-3">
        {/* Nilai Jual */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-500">
              Nilai Aset Pasar (Harga Jual)
            </span>
            <span className="text-base font-black text-slate-900">
              Rp {stockAssetValue.toLocaleString('id-ID')}
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
            Valuasi
          </span>
        </div>

        {/* Modal HPP & Margin */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col">
            <span className="text-[10px] text-slate-500">Modal Tertanam (HPP)</span>
            <span className="text-xs font-bold text-slate-800 mt-0.5">
              Rp {stockAssetHPP.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col">
            <span className="text-[10px] text-emerald-700">Potensi Laba Kotor</span>
            <span className="text-xs font-bold text-emerald-800 mt-0.5">
              Rp {profitPotential.toLocaleString('id-ID')} ({stockMarginPersen}%)
            </span>
          </div>
        </div>
      </div>

      {/* Stok Alert & Request Part Section */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        {lowStockCount > 0 || pendingPartRequestsCount > 0 ? (
          <div
            onClick={() => navigate('/bengkel/pengadaan')}
            className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-50 text-amber-900 cursor-pointer hover:bg-amber-100/80 transition-all border border-amber-200/60"
          >
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span>
                {lowStockCount > 0 && `${lowStockCount} stok limit`}
                {lowStockCount > 0 && pendingPartRequestsCount > 0 && ' • '}
                {pendingPartRequestsCount > 0 && `${pendingPartRequestsCount} request part`}
              </span>
            </div>
            <span className="font-bold underline text-[11px] shrink-0">Buka Lembar Belanja</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Ketersediaan stok sparepart dalam batas aman</span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenPartRequestModal ? onOpenPartRequestModal : () => navigate('/bengkel/pengadaan')}
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Catat Part Kosong</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/bengkel/pengadaan')}
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <ShoppingCart size={13} />
            <span>Trip Belanja</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BengkelInventoryBlok;
