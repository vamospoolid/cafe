import React, { useState, useEffect } from 'react';
import { X, Droplets, Thermometer, Layers, MessageSquare, Coffee, Check, Sparkles, Plus } from 'lucide-react';

export type ModifierAddon = {
  id: string;
  name: string;
  category: 'SHOT' | 'MILK' | 'TOPPING' | 'SYRUP';
  price: number;
  emoji: string;
  ingredientName?: string;
  qtyUsed?: number;
  unit?: string;
};

export const DEFAULT_CAFE_ADDONS: ModifierAddon[] = [
  { id: 'extra_shot', name: 'Extra Shot Espresso', category: 'SHOT', price: 5000, emoji: '☕', ingredientName: 'Biji Kopi House Blend (Arabica-Robusta)', qtyUsed: 15, unit: 'gram' },
  { id: 'oat_milk', name: 'Upgrade Susu Oat', category: 'MILK', price: 8000, emoji: '🌾', ingredientName: 'Susu Fresh Milk UHT 1L', qtyUsed: 150, unit: 'ml' },
  { id: 'syrup_vanilla', name: 'Sirup Vanilla', category: 'SYRUP', price: 4000, emoji: '🍯', ingredientName: 'Sirup Vanilla Monin', qtyUsed: 20, unit: 'ml' },
  { id: 'syrup_caramel', name: 'Sirup Salted Caramel', category: 'SYRUP', price: 4000, emoji: '🍮', ingredientName: 'Sirup Salted Caramel Monin', qtyUsed: 20, unit: 'ml' },
  { id: 'topping_boba', name: 'Topping Boba Brown Sugar', category: 'TOPPING', price: 4000, emoji: '🧋', ingredientName: 'Topping Boba', qtyUsed: 30, unit: 'gram' },
  { id: 'topping_cheese', name: 'Cream Cheese Foam', category: 'TOPPING', price: 5000, emoji: '🧀', ingredientName: 'Cream Cheese', qtyUsed: 40, unit: 'gram' },
];

export type DrinkCustomization = {
  sugar: string;
  ice: string;
  temperature: string;
  notes: string;
  addons: ModifierAddon[];
  extraPrice: number;
};

interface DrinkCustomizationModalProps {
  productName: string;
  productPrice?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customization: DrinkCustomization) => void;
}

const TEMP_OPTIONS = [
  { label: 'Iced', emoji: '🧊', subtitle: 'Dingin' },
  { label: 'Hot', emoji: '♨️', subtitle: 'Panas' },
  { label: 'Room Temp', emoji: '🌡️', subtitle: 'Normal' },
];

const SUGAR_OPTIONS = [
  { label: 'No Sugar', percent: '0%', emoji: '🚫' },
  { label: 'Less Sugar', percent: '50%', emoji: '☕' },
  { label: 'Normal', percent: '100%', emoji: '👌' },
  { label: 'Extra Sweet', percent: '120%', emoji: '🍯' },
];

const ICE_OPTIONS = [
  { label: 'No Ice', percent: '0%', emoji: '🌡️' },
  { label: 'Less Ice', percent: '50%', emoji: '🧊' },
  { label: 'Normal Ice', percent: '100%', emoji: '❄️' },
  { label: 'Extra Ice', percent: '120%', emoji: '🫙' },
];

const DrinkCustomizationModal: React.FC<DrinkCustomizationModalProps> = ({
  productName,
  productPrice = 0,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [temperature, setTemperature] = useState('Iced');
  const [sugar, setSugar] = useState('Normal');
  const [ice, setIce] = useState('Normal Ice');
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<ModifierAddon[]>([]);

  // Reset state when opening modal
  useEffect(() => {
    if (isOpen) {
      setTemperature('Iced');
      setSugar('Normal');
      setIce('Normal Ice');
      setNotes('');
      setSelectedAddons([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleAddon = (addon: ModifierAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.some(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      } else {
        return [...prev, addon];
      }
    });
  };

  const extraPrice = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const totalItemPrice = Number(productPrice || 0) + extraPrice;

  const handleConfirm = () => {
    onConfirm({
      temperature,
      sugar,
      ice: temperature === 'Iced' ? ice : '-',
      notes: notes.trim(),
      addons: selectedAddons,
      extraPrice,
    });
  };

  return (
    <div 
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200" 
      style={{ zIndex: 1200 }}
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="p-4 sm:p-5 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Coffee size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                  Kustomisasi Minuman
                </h3>
                <Sparkles size={14} className="text-amber-500 shrink-0" />
              </div>
              <p className="text-xs font-bold text-indigo-600 truncate mt-1">
                {productName}
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors shadow-sm shrink-0" 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Body (Scrollable) ─── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-5">

          {/* 1. Suhu Minuman */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider">
                <Thermometer size={14} className="text-indigo-600" />
                Suhu Minuman
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {temperature}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TEMP_OPTIONS.map(t => {
                const isSelected = temperature === t.label;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setTemperature(t.label)}
                    className={`py-2.5 px-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-sm ring-2 ring-indigo-200'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <span className="text-xl mb-0.5">{t.emoji}</span>
                    <span className="text-xs font-bold">{t.label}</span>
                    <span className="text-[10px] text-slate-400">{t.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Tingkat Gula */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider">
                <Layers size={14} className="text-amber-500" />
                Tingkat Gula
              </span>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {sugar}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SUGAR_OPTIONS.map(s => {
                const isSelected = sugar === s.label;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSugar(s.label)}
                    className={`py-2 px-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-amber-200'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <span className="text-lg">{s.emoji}</span>
                    <span className="text-xs font-bold leading-tight mt-0.5">{s.label}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{s.percent}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tingkat Es (Hanya jika Iced) */}
          <div className={temperature === 'Iced' ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider">
                <Droplets size={14} className="text-sky-500" />
                Tingkat Es
                {temperature !== 'Iced' && (
                  <span className="text-[10px] font-semibold text-slate-400 normal-case">(Hanya Iced)</span>
                )}
              </span>
              {temperature === 'Iced' && (
                <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                  {ice}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ICE_OPTIONS.map(i => {
                const isSelected = ice === i.label && temperature === 'Iced';
                return (
                  <button
                    key={i.label}
                    type="button"
                    disabled={temperature !== 'Iced'}
                    onClick={() => setIce(i.label)}
                    className={`py-2 px-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm ring-2 ring-sky-200'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <span className="text-lg">{i.emoji}</span>
                    <span className="text-xs font-bold leading-tight mt-0.5">{i.label}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{i.percent}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Topping & Tambahan Berbayar (Paid Modifiers) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider">
                <Sparkles size={14} className="text-purple-600" />
                Topping &amp; Tambahan (BOM)
              </span>
              {selectedAddons.length > 0 && (
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  +{selectedAddons.length} Dipilih (+Rp {extraPrice.toLocaleString('id-ID')})
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_CAFE_ADDONS.map(addon => {
                const isSelected = selectedAddons.some(a => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`p-2.5 rounded-2xl border-2 flex items-center justify-between gap-2 transition-all active:scale-95 text-left ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/70 shadow-sm ring-2 ring-purple-200'
                        : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl p-1 bg-white rounded-xl shadow-xs shrink-0">{addon.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 leading-tight truncate">
                          {addon.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {addon.qtyUsed && addon.unit ? `${addon.qtyUsed} ${addon.unit}` : addon.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-purple-700 block">
                        +Rp {addon.price.toLocaleString('id-ID')}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${
                        isSelected ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isSelected ? '✓ Terpilih' : '+ Tambah'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Catatan Tambahan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider">
                <MessageSquare size={14} className="text-indigo-600" />
                Catatan Tambahan
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Opsional</span>
            </div>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50/50 placeholder:text-slate-400"
              placeholder="Contoh: Tanpa whip cream, sirup dipisah..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* ─── Preview Ringkasan ─── */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Ringkasan Pilihan (Akan Tertera di KDS &amp; Struk):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                temperature === 'Iced' 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {temperature}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                {sugar}
              </span>
              {temperature === 'Iced' && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                  {ice}
                </span>
              )}
              {selectedAddons.map(a => (
                <span key={a.id} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <span>{a.emoji}</span>
                  <span>{a.name} (+Rp {a.price.toLocaleString('id-ID')})</span>
                </span>
              ))}
              {notes.trim() && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 truncate max-w-full">
                  📝 "{notes.trim()}"
                </span>
              )}
            </div>
          </div>

        </div>

        {/* ─── Footer Action Buttons ─── */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/3 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all text-center"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} />
            <span>Tambah ke Keranjang {totalItemPrice > 0 ? `(Rp ${totalItemPrice.toLocaleString('id-ID')})` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrinkCustomizationModal;
