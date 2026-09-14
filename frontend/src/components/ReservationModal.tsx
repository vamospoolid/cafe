import React, { useState, useEffect, useContext } from 'react';
import { X, Calendar, Clock, User, Phone, Users, CreditCard, FileText, MapPin, ChevronDown, Check } from 'lucide-react';
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-slate-100 animate-in fade-in zoom-in-95 duration-200">

        {/* ─── Header ─── */}
        <div className="p-4 sm:p-5 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base text-slate-800">
                {initialData ? 'Edit Data Reservasi' : 'Buat Reservasi Baru'}
              </div>
              <div className="text-[11px] text-slate-500">
                Isi detail pemesanan meja untuk pelanggan
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors shadow-sm"
            onClick={onClose} 
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Form Body ─── */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-y-auto min-h-0">
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto pb-16 sm:pb-0">

            {/* LEFT COLUMN: Customer Info & Timing */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col gap-4 md:border-r border-slate-100">

              {sectionTitle(<User size={15} />, 'Identitas Pemesan')}

              {/* Nama */}
              <div>
                <label style={labelStyle}>Nama Lengkap <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange}
                    placeholder="cth: Budi Santoso" style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
                </div>
              </div>

              {/* Telepon */}
              <div>
                <label style={labelStyle}>No. WhatsApp <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                    placeholder="0812xxxxxx" style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
                </div>
              </div>

              {sectionTitle(<Clock size={15} />, 'Jadwal Kedatangan')}

              {/* Tanggal + Jam */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Tanggal <span className="text-rose-500">*</span></label>
                  <input type="date" name="date" required value={formData.date} onChange={handleChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Jam Kedatangan <span className="text-rose-500">*</span></label>
                  <input type="time" name="time" required value={formData.time} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label style={labelStyle}>Catatan Khusus</label>
                <div className="relative">
                  <FileText size={15} className="absolute left-3 top-3 text-slate-400" />
                  <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
                    placeholder="cth: Minta dekorasi ulang tahun, alergi kacang, dll..."
                    style={{ ...inputStyle, paddingLeft: '2.25rem', resize: 'none', paddingTop: '0.65rem', lineHeight: 1.5 }} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Table, Guests & DP */}
            <div className="w-full md:w-72 p-4 sm:p-6 bg-slate-50/70 flex flex-col gap-4 shrink-0">

              {sectionTitle(<MapPin size={15} />, 'Detail Meja')}

              {/* Meja */}
              <div>
                <label style={labelStyle}>Pilih Meja <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select name="tableId" required value={formData.tableId} onChange={handleChange}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: '2.25rem' }}>
                    <option value="">— Pilih Meja —</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>Meja {t.tableNo} (Kap. {t.capacity})</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Jumlah Tamu */}
              <div>
                <label style={labelStyle}>Jumlah Tamu</label>
                <div className="relative">
                  <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="number" name="guests" min="1" value={formData.guests} onChange={handleChange}
                    style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
                </div>
              </div>

              {sectionTitle(<CreditCard size={15} />, 'Pembayaran DP')}

              {/* DP */}
              <div>
                <label style={labelStyle}>Uang Muka <span className="text-[11px] text-slate-400 font-normal lowercase">(opsional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <input type="number" name="dpAmount" value={formData.dpAmount} onChange={handleChange}
                    placeholder="0" style={{ ...inputStyle, paddingLeft: '2.5rem' }} />
                </div>
              </div>

              {/* Status — only edit mode */}
              {initialData && (
                <div>
                  <label style={labelStyle}>Status Reservasi</label>
                  <div className="relative">
                    <select name="status" value={formData.status} onChange={handleChange}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: '2.25rem', fontWeight: 700 }}>
                      <option value="Booking">📋 Booking Baru</option>
                      <option value="DP Dibayar">💵 DP Dibayar</option>
                      <option value="Lunas">✅ Selesai (Lunas)</option>
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1 hidden md:block" />

              {/* CTA */}
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-200/80">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs shadow-md shadow-primary/25 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {loading ? 'Menyimpan...' : (
                    <>
                      <Check size={16} />
                      <span>{initialData ? 'Simpan Perubahan' : 'Buat Reservasi'}</span>
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={onClose} 
                  disabled={loading} 
                  className="w-full py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
                >
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
