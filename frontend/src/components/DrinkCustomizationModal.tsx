import React from 'react';
import { X, Droplets, Thermometer, Layers, MessageSquare, Coffee, CheckCircle2 } from 'lucide-react';

export type DrinkCustomization = {
  sugar: string;
  ice: string;
  temperature: string;
  notes: string;
};

interface DrinkCustomizationModalProps {
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customization: DrinkCustomization) => void;
}

const SUGAR_OPTIONS = [
  { label: 'No Sugar', emoji: '🚫' },
  { label: 'Less Sugar', emoji: '☕' },
  { label: 'Normal', emoji: '👌' },
  { label: 'Extra Sweet', emoji: '🍯' },
];

const ICE_OPTIONS = [
  { label: 'No Ice', emoji: '🌡️' },
  { label: 'Less Ice', emoji: '🧊' },
  { label: 'Normal Ice', emoji: '❄️' },
  { label: 'Extra Ice', emoji: '🫙' },
];

const TEMP_OPTIONS = [
  { label: 'Iced', emoji: '🧊', desc: 'Minuman dingin' },
  { label: 'Hot', emoji: '♨️', desc: 'Minuman panas' },
  { label: 'Room Temp', emoji: '🌡️', desc: 'Suhu ruangan' },
];

const DrinkCustomizationModal: React.FC<DrinkCustomizationModalProps> = ({
  productName, isOpen, onClose, onConfirm,
}) => {
  const [sugar, setSugar]             = React.useState('Normal');
  const [ice, setIce]                 = React.useState('Normal Ice');
  const [temperature, setTemperature] = React.useState('Iced');
  const [notes, setNotes]             = React.useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({ sugar, ice: temperature === 'Iced' ? ice : '-', temperature, notes });
    setSugar('Normal'); setIce('Normal Ice'); setTemperature('Iced'); setNotes('');
  };

  const summaryTags = [
    { label: temperature, color: temperature === 'Iced' ? '#dbeafe' : '#fee2e2', text: temperature === 'Iced' ? '#1e40af' : '#991b1b' },
    { label: sugar, color: '#fef9c3', text: '#92400e' },
    ...(temperature === 'Iced' ? [{ label: ice, color: '#e0f2fe', text: '#075985' }] : []),
    ...(notes ? [{ label: `📝 ${notes}`, color: '#f0fdf4', text: '#166534' }] : []),
  ];

  const OptionChip = ({
    label, emoji, desc, selected, onClick,
  }: { label: string; emoji?: string; desc?: string; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center text-center transition-all cursor-pointer rounded-2xl border-2 active:scale-95 ${
        desc ? 'flex-1 min-w-0 p-2 sm:p-3' : 'p-2 sm:p-2.5 flex-1 min-w-[70px] sm:min-w-0'
      } ${
        selected 
          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm ring-2 ring-indigo-200/50' 
          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 text-slate-600'
      }`}
    >
      {emoji && <span className="text-lg sm:text-xl leading-tight mb-0.5">{emoji}</span>}
      <span className="font-bold text-xs sm:text-xs leading-tight">{label}</span>
      {desc && <span className={`text-[10px] mt-0.5 font-medium leading-tight ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>{desc}</span>}
    </button>
  );

  return (
    <div className="modal-overlay p-3 sm:p-4" style={{ zIndex: 1100 }}>
      {/* Container: Full width on mobile vertical, Max 780px on tablet/web */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[780px] max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-scale-up border border-slate-200/80">

        {/* ─── Header ─── */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-200">
              <Coffee size={18} />
            </div>
            <div className="truncate">
              <div className="font-extrabold text-sm sm:text-base text-slate-900 truncate">Kustomisasi Minuman</div>
              <div className="text-xs font-bold text-indigo-600 truncate">{productName}</div>
            </div>
          </div>
          <button 
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shrink-0 ml-2" 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Body: 2-column layout on Desktop/Tablet, Vertical Scrollable Stack on Mobile ─── */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">

          {/* LEFT: Options (Scrollable) */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 overflow-y-auto md:border-r border-slate-100">

            {/* Suhu */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Thermometer size={14} className="text-indigo-600" />
                <span className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wider">Suhu Minuman</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TEMP_OPTIONS.map(t => (
                  <OptionChip 
                    key={t.label} 
                    label={t.label} 
                    emoji={t.emoji} 
                    desc={t.desc} 
                    selected={temperature === t.label} 
                    onClick={() => setTemperature(t.label)} 
                  />
                ))}
              </div>
            </div>

            {/* Gula */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={14} className="text-indigo-600" />
                <span className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wider">Tingkat Gula</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUGAR_OPTIONS.map(s => (
                  <OptionChip 
                    key={s.label} 
                    label={s.label} 
                    emoji={s.emoji} 
                    selected={sugar === s.label} 
                    onClick={() => setSugar(s.label)} 
                  />
                ))}
              </div>
            </div>

            {/* Es (only Iced) */}
            <div className={`transition-opacity duration-200 ${temperature === 'Iced' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Droplets size={14} className="text-indigo-600" />
                <span className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wider">Tingkat Es</span>
                {temperature !== 'Iced' && (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200/70 px-1.5 py-0.2 rounded-md ml-1">
                    Khusus Iced
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ICE_OPTIONS.map(i => (
                  <OptionChip 
                    key={i.label} 
                    label={i.label} 
                    emoji={i.emoji} 
                    selected={ice === i.label} 
                    onClick={() => setIce(i.label)} 
                  />
                ))}
              </div>
            </div>

            {/* Catatan */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare size={14} className="text-indigo-600" />
                <span className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wider">Catatan Tambahan</span>
                <span className="text-[10px] text-slate-400 font-medium">opsional</span>
              </div>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50/50"
                placeholder="cth: tanpa whip cream, ekstra saus..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* RIGHT / BOTTOM: Summary + CTA */}
          <div className="w-full md:w-[260px] p-4 sm:p-5 flex flex-col justify-between bg-slate-50/90 border-t md:border-t-0 border-slate-100 shrink-0">
            <div>
              <div className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wider mb-2">
                Preview Kustomisasi
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col gap-1.5 shadow-sm">
                <div className="font-bold text-xs sm:text-sm text-slate-800 border-b border-dashed border-slate-200 pb-1.5 truncate">
                  {productName}
                </div>
                <div className="flex flex-wrap md:flex-col gap-1.5">
                  {summaryTags.map((tag, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} style={{ color: tag.text }} className="shrink-0" />
                      <span 
                        style={{ background: tag.color, color: tag.text }} 
                        className="font-bold text-[11px] px-2 py-0.5 rounded-md"
                      >
                        {tag.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="hidden md:block mt-3 text-[11px] text-slate-400 leading-relaxed">
                Pilihan ini akan diteruskan ke <strong className="text-indigo-600 font-bold">KDS Dapur</strong> &amp; <strong className="text-indigo-600 font-bold">Struk Kasir</strong>.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 mt-3 sm:mt-4">
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span>✓ Tambah ke Keranjang</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs active:scale-95 transition-all"
              >
                Lewati / Tanpa Kustomisasi
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DrinkCustomizationModal;
