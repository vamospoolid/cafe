import React, { useState, useEffect, useContext } from 'react';
import { 
  X, Trash2, AlertTriangle, Flame, Clock, Sparkles, 
  CheckCircle2, DollarSign, Package, Utensils, Info, 
  HelpCircle, AlertOctagon, RefreshCw, ArrowRight 
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface WasteLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'INGREDIENT' | 'PRODUCT';
  initialItemId?: number;
}

const REASONS = [
  { id: 'Busuk / Basi', label: 'Busuk / Basi', icon: '🥩', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Kadaluarsa (Expired)', label: 'Kadaluarsa (Expired)', icon: '⏳', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Gosong / Overcooked', label: 'Gosong / Overcooked', icon: '🔥', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'Salah Buat Dapur', label: 'Salah Buat Dapur', icon: '❌', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'Tumpah / Jatuh', label: 'Tumpah / Terjatuh', icon: '🧻', color: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { id: 'Trimming Kulit/Lemak', label: 'Trimming / Kulit Berlebih', icon: '🔪', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'Sisa Tutup Toko', label: 'Sisa Tutup Toko', icon: '📦', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Lainnya', label: 'Lainnya / Kerusakan Lain', icon: '⚠️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

const WasteLogModal: React.FC<WasteLogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'INGREDIENT',
  initialItemId
}) => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [type, setType] = useState<'INGREDIENT' | 'PRODUCT'>(initialType);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId ? String(initialItemId) : '');
  const [qty, setQty] = useState<string>('1');
  const [reason, setReason] = useState<string>('Busuk / Basi');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setSelectedItemId(initialItemId ? String(initialItemId) : '');
      setQty('1');
      setReason('Busuk / Basi');
      setNotes('');
      fetchItems();
    }
  }, [isOpen, initialType, initialItemId]);

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const [ingRes, prodRes] = await Promise.all([
        fetch('/api/ingredients', { headers }),
        fetch('/api/products', { headers })
      ]);
      if (ingRes.ok) setIngredients(await ingRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (err) {
      console.error('Gagal mengambil data items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  if (!isOpen) return null;

  // Selected item detail
  const selectedIngredient = ingredients.find(i => String(i.id) === selectedItemId);
  const selectedProduct = products.find(p => String(p.id) === selectedItemId);

  // Unit and Cost Calculations
  let unit = type === 'INGREDIENT' ? (selectedIngredient?.unit || 'satuan') : 'porsi';
  let costPerUnit = 0;

  if (type === 'INGREDIENT' && selectedIngredient) {
    costPerUnit = Number(selectedIngredient.buyPrice) || 0;
  } else if (type === 'PRODUCT' && selectedProduct) {
    if (selectedProduct.recipes && selectedProduct.recipes.length > 0) {
      costPerUnit = selectedProduct.recipes.reduce((s: number, r: any) => s + (r.qtyPerServing * (r.ingredient?.buyPrice || 0)), 0);
    } else {
      costPerUnit = Number(selectedProduct.buyPrice) || 0;
    }
  }

  const numQty = Math.max(0, parseFloat(qty) || 0);
  const totalHppLoss = Math.round(numQty * costPerUnit);

  const handleIncrementQty = (step: number) => {
    const current = parseFloat(qty) || 0;
    const nextVal = Math.max(0, Math.round((current + step) * 100) / 100);
    setQty(String(nextVal));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      return toast(type === 'INGREDIENT' ? 'Pilih bahan baku yang terbuang' : 'Pilih menu masakan yang rusak', 'error');
    }
    if (numQty <= 0) {
      return toast('Kuantitas waste harus lebih dari 0', 'error');
    }

    setSubmitting(true);
    try {
      const body: any = {
        type,
        qty: numQty,
        reason,
        notes: notes.trim()
      };

      if (type === 'INGREDIENT') {
        body.ingredientId = Number(selectedItemId);
      } else {
        body.productId = Number(selectedItemId);
      }

      const res = await fetch('/api/waste', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        toast(`Waste berhasil dicatat! Kerugian HPP: Rp ${totalHppLoss.toLocaleString('id-ID')}`, 'success');
        onSuccess();
        onClose();
      } else {
        toast(data.error || 'Gagal mencatat waste', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-rose-50 to-orange-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">Catat Food Waste &amp; Spoilage</h3>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                Pencatatan Limbah Bahan Basi / Masakan Rusak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center border border-slate-200/70 shadow-sm transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Tab Selector: Bahan Mentah vs Menu Jadi */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setType('INGREDIENT'); setSelectedItemId(''); }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                type === 'INGREDIENT'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package size={14} className={type === 'INGREDIENT' ? 'text-rose-600' : ''} />
              Bahan Baku Mentah
            </button>
            <button
              type="button"
              onClick={() => { setType('PRODUCT'); setSelectedItemId(''); }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                type === 'PRODUCT'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Utensils size={14} className={type === 'PRODUCT' ? 'text-orange-600' : ''} />
              Menu / Porsi Masakan Jadi
            </button>
          </div>

          {/* Item Selector */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              {type === 'INGREDIENT' ? 'Pilih Bahan Baku' : 'Pilih Menu / Porsi Masakan'}
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs outline-none focus:border-rose-500 focus:bg-white transition-all"
              required
            >
              <option value="">-- Pilih {type === 'INGREDIENT' ? 'Bahan Baku' : 'Menu Produk'} --</option>
              {type === 'INGREDIENT'
                ? ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Sisa Stok: {ing.stock} {ing.unit} • HPP: Rp {Number(ing.buyPrice || 0).toLocaleString('id-ID')}/{ing.unit})
                    </option>
                  ))
                : products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} (Harga: Rp {prod.sellPrice.toLocaleString('id-ID')})
                    </option>
                  ))}
            </select>
          </div>

          {/* Quantity & Unit Stepper */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Jumlah Kuantitas Terbuang
              </label>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Satuan: <strong className="text-slate-700">{unit}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-black text-lg outline-none focus:border-rose-500 focus:bg-white text-center"
                  placeholder="0"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 select-none">
                  {unit}
                </span>
              </div>

              {/* Quick Stepper Buttons */}
              <div className="flex gap-1.5 shrink-0">
                {[0.1, 0.5, 1, 5].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => handleIncrementQty(step)}
                    className="py-2.5 px-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-700 font-black text-xs transition-all shadow-2xs"
                  >
                    +{step}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reason Selector Chips */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Alasan Kerusakan / Pembuangan
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => {
                const isSelected = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? `${r.color} font-black shadow-sm scale-[1.01] ring-2 ring-rose-500/20`
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-base">{r.icon}</span>
                    <span className="text-xs truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Keterangan Tambahan / Kronologi <span className="text-slate-400 font-normal lowercase">(opsional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Suhu chiller drop saat malam hari / salah input pesanan kasir..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 font-medium text-xs outline-none focus:border-rose-500 focus:bg-white resize-none"
            />
          </div>

          {/* Live HPP Loss Preview Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
            totalHppLoss >= 50000 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${totalHppLoss >= 50000 ? 'bg-rose-200/70 text-rose-800' : 'bg-amber-200/70 text-amber-800'}`}>
                <DollarSign size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                  Estimasi Kerugian HPP Riil
                </span>
                <span className="text-xs font-semibold">
                  {numQty} {unit} × Rp {costPerUnit.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base sm:text-lg font-black tracking-tight block">
                Rp {totalHppLoss.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] font-bold opacity-75">
                {totalHppLoss >= 50000 ? '⚠️ High Impact Loss' : 'Tercatat ke Food Waste'}
              </span>
            </div>
          </div>

          {/* Footer Form Action */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold transition-all text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedItemId || numQty <= 0}
              className="flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-200 text-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Mencatat Waste...
                </>
              ) : (
                <>
                  Simpan Log Waste
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default WasteLogModal;
