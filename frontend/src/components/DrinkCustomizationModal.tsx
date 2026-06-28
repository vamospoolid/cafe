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
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '0.25rem', padding: desc ? '0.75rem 0.5rem' : '0.5rem 1rem',
        flex: desc ? 1 : undefined,
        minWidth: desc ? 0 : undefined,
        borderRadius: '0.75rem', border: '2px solid',
        borderColor: selected ? 'var(--primary)' : '#e2e8f0',
        background: selected ? 'var(--secondary)' : '#fafafa',
        color: selected ? 'var(--primary)' : '#64748b',
        fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: selected ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {emoji && <span style={{ fontSize: '1.1rem' }}>{emoji}</span>}
      <span>{label}</span>
      {desc && <span style={{ fontSize: '0.65rem', fontWeight: 500, color: selected ? 'var(--primary)' : '#94a3b8' }}>{desc}</span>}
    </button>
  );

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      {/* Landscape container */}
      <div style={{
        background: 'white', borderRadius: '1.5rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 780,
        animation: 'modalIn 0.25s ease-out',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>

        {/* ─── Header ─── */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--secondary) 0%, #f5f3ff 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '0.75rem',
              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Coffee size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>Kustomisasi Minuman</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>{productName}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* ─── Body: 2-column layout ─── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* LEFT: Options */}
          <div style={{ flex: 1, padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRight: '1px solid #f1f5f9' }}>

            {/* Suhu */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <Thermometer size={15} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Suhu Minuman</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {TEMP_OPTIONS.map(t => (
                  <OptionChip key={t.label} label={t.label} emoji={t.emoji} desc={t.desc} selected={temperature === t.label} onClick={() => setTemperature(t.label)} />
                ))}
              </div>
            </div>

            {/* Gula */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <Layers size={15} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tingkat Gula</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {SUGAR_OPTIONS.map(s => (
                  <OptionChip key={s.label} label={s.label} emoji={s.emoji} selected={sugar === s.label} onClick={() => setSugar(s.label)} />
                ))}
              </div>
            </div>

            {/* Es (only Iced) */}
            <div style={{ opacity: temperature === 'Iced' ? 1 : 0.3, pointerEvents: temperature === 'Iced' ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <Droplets size={15} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tingkat Es</span>
                {temperature !== 'Iced' && <span style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 600, background: '#fef9c3', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>Khusus Iced</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ICE_OPTIONS.map(i => (
                  <OptionChip key={i.label} label={i.label} emoji={i.emoji} selected={ice === i.label} onClick={() => setIce(i.label)} />
                ))}
              </div>
            </div>

            {/* Catatan */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <MessageSquare size={15} color="var(--primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Catatan Tambahan</span>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>opsional</span>
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="cth: tanpa whip cream, pake gelas besar..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ fontSize: '0.875rem', borderRadius: '0.75rem' }}
              />
            </div>
          </div>

          {/* RIGHT: Summary + CTA */}
          <div style={{
            width: 240, padding: '1.5rem',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: '#fafafa',
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Preview Pesanan
              </div>

              <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 120 }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  {productName}
                </div>
                {summaryTags.map((tag, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={12} color={tag.text} />
                    <span style={{
                      background: tag.color, color: tag.text,
                      fontWeight: 700, fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem', borderRadius: '0.4rem',
                    }}>
                      {tag.label}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Pilihan ini akan tampil di<br />
                <strong style={{ color: 'var(--primary)' }}>KDS Dapur</strong> dan <strong style={{ color: 'var(--primary)' }}>Struk</strong>.
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  padding: '0.875rem', borderRadius: '0.875rem', border: 'none',
                  background: 'var(--primary)', color: 'white', fontWeight: 700,
                  fontSize: '0.9rem', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'translateY(-1px)'; (e.target as HTMLElement).style.boxShadow = '0 6px 18px rgba(124,58,237,0.4)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.transform = ''; (e.target as HTMLElement).style.boxShadow = '0 4px 14px rgba(124,58,237,0.35)'; }}
              >
                ✓ Tambah ke Keranjang
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.75rem', borderRadius: '0.875rem',
                  border: '2px solid #e2e8f0', background: 'white',
                  fontWeight: 600, cursor: 'pointer', color: '#64748b', fontSize: '0.875rem',
                  transition: 'border-color 0.15s',
                }}
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
