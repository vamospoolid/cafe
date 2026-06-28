import React, { useState, useEffect, useContext } from 'react';
import { X, Calendar, Clock, User, Phone, Users, CreditCard, FileText, MapPin, ChevronDown } from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const ReservationModal: React.FC<ReservationModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    date: '',
    time: '',
    tableId: '',
    guests: 2,
    dpAmount: '',
    notes: '',
    status: 'Booking'
  });
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const posContext = useContext(POSContext);

  useEffect(() => {
    if (isOpen && posContext?.token) fetchTables();
    if (initialData) {
      setFormData({
        customerName: initialData.customerName || '',
        phone: initialData.phone || '',
        date: initialData.date || '',
        time: initialData.time || '',
        tableId: initialData.tableId || '',
        guests: initialData.guests || 2,
        dpAmount: initialData.dpAmount || '',
        notes: initialData.notes || '',
        status: initialData.status || 'Booking'
      });
    } else {
      setFormData({
        customerName: '',
        phone: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        tableId: '',
        guests: 2,
        dpAmount: '',
        notes: '',
        status: 'Booking'
      });
    }
  }, [initialData, isOpen, posContext?.token]);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) setTables(await res.json());
    } catch (err) { console.error(err); }
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(formData);
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.875rem', border: '1.5px solid #e2e8f0',
    borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600,
    color: 'var(--text-main)', background: '#fafafa', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem',
  };

  const sectionTitle = (icon: React.ReactNode, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: 'var(--primary)' }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>{title}</span>
    </div>
  );

  return (
    <div className="modal-overlay" style={{ zIndex: 1050 }}>
      {/* Wide landscape modal */}
      <div style={{
        background: 'white', borderRadius: '1.5rem',
        boxShadow: '0 30px 70px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 820,
        animation: 'modalIn 0.25s ease-out', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>

        {/* â”€â”€â”€ Header â”€â”€â”€ */}
        <div style={{
          padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--secondary) 0%, #f5f3ff 100%)',
          borderBottom: '1px solid #e8e3ff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '0.875rem', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                {initialData ? 'Edit Data Reservasi' : 'Buat Reservasi Baru'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Isi detail pemesanan meja untuk pelanggan
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>

        {/* â”€â”€â”€ Body â”€â”€â”€ */}
        <form onSubmit={handleSave} style={{ display: 'flex', flex: 1 }}>
          <div style={{ display: 'flex', flex: 1, gap: 0 }}>

            {/* LEFT COLUMN */}
            <div style={{ flex: 1, padding: '1.5rem 1.75rem', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {sectionTitle(<User size={14} />, 'Identitas Pemesan')}

              {/* Nama */}
              <div>
                <label style={labelStyle}>Nama Lengkap <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange}
                    placeholder="cth: Budi Santoso" style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
                </div>
              </div>

              {/* Telepon */}
              <div>
                <label style={labelStyle}>No. WhatsApp <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                    placeholder="0812xxxxxx" style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
                </div>
              </div>

              {sectionTitle(<Clock size={14} />, 'Jadwal Kedatangan')}

              {/* Tanggal + Jam */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Tanggal <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" name="date" required value={formData.date} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Jam Kedatangan <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="time" name="time" required value={formData.time} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label style={labelStyle}>Catatan Khusus</label>
                <div style={{ position: 'relative' }}>
                  <FileText size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                  <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3}
                    placeholder="cth: Minta dekorasi ulang tahun, alergi kacang, dll..."
                    style={{ ...inputStyle, paddingLeft: '2.25rem', resize: 'none', paddingTop: '0.65rem', lineHeight: 1.5 }} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ width: 280, padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {sectionTitle(<MapPin size={14} />, 'Detail Meja')}

              {/* Meja */}
              <div>
                <label style={labelStyle}>Pilih Meja <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <select name="tableId" required value={formData.tableId} onChange={handleChange}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: '2.25rem' }}>
                    <option value="">â€” Pilih Meja â€”</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>Meja {t.tableNo} (Kap. {t.capacity})</option>
                    ))}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Jumlah Tamu */}
              <div>
                <label style={labelStyle}>Jumlah Tamu</label>
                <div style={{ position: 'relative' }}>
                  <Users size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input type="number" name="guests" min="1" value={formData.guests} onChange={handleChange}
                    style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
                </div>
              </div>

              {sectionTitle(<CreditCard size={14} />, 'Pembayaran DP')}

              {/* DP */}
              <div>
                <label style={labelStyle}>Uang Muka <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>(opsional)</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>Rp</span>
                  <input type="number" name="dpAmount" value={formData.dpAmount} onChange={handleChange}
                    placeholder="0" style={{ ...inputStyle, paddingLeft: '2.5rem' }} />
                </div>
              </div>

              {/* Status â€” only edit mode */}
              {initialData && (
                <div>
                  <label style={labelStyle}>Status Reservasi</label>
                  <div style={{ position: 'relative' }}>
                    <select name="status" value={formData.status} onChange={handleChange}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: '2.25rem', fontWeight: 700 }}>
                      <option value="Booking">ðŸ“‹ Booking Baru</option>
                      <option value="DP Dibayar">ðŸ’µ DP Dibayar</option>
                      <option value="Lunas">âœ… Selesai (Lunas)</option>
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  </div>
                </div>
              )}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* CTA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="submit" disabled={loading} style={{
                  padding: '0.875rem', borderRadius: '0.875rem', border: 'none',
                  background: 'var(--primary)', color: 'white', fontWeight: 700,
                  fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.3)', opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? 'Menyimpan...' : (initialData ? 'âœ“ Simpan Perubahan' : 'âœ“ Buat Reservasi')}
                </button>
                <button type="button" onClick={onClose} disabled={loading} style={{
                  padding: '0.75rem', borderRadius: '0.875rem',
                  border: '2px solid #e2e8f0', background: 'white',
                  fontWeight: 600, cursor: 'pointer', color: '#64748b', fontSize: '0.875rem',
                }}>
                  Batal
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
