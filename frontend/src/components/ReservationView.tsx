import React, { useState, useEffect, useContext } from 'react';
import { Calendar, Plus, Edit, Trash2, Clock, Phone, CheckCircle, Users, MapPin, ChevronLeft, ChevronRight, Search, BookOpen } from 'lucide-react';
import ReservationModal from './ReservationModal';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

const ReservationView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const shiftDate = (days: number) => {
    const d = new Date(dateFilter);
    d.setDate(d.getDate() + days);
    setDateFilter(d.toISOString().split('T')[0]);
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      let url = '/api/reservations';
      if (dateFilter) url += `?date=${dateFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setReservations(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (posContext?.token) fetchReservations();
  }, [posContext?.token, dateFilter]);

  const handleDelete = async (id: number) => {
    const confirmResult = await confirmAlert('Konfirmasi', 'Batalkan reservasi ini?');
    if (!confirmResult.isConfirmed) return;
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) fetchReservations();
      else toast('Gagal membatalkan reservasi', 'error');
    } catch (err) { console.error(err); }
  };

  const handleSave = async (data: any) => {
    const isEdit = !!selectedReservation;
    const url = isEdit
      ? `/api/reservations/${selectedReservation.id}`
      : '/api/reservations';
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) { setIsModalOpen(false); fetchReservations(); }
      else { const err = await res.json(); toast(err.error || 'Gagal menyimpan reservasi', 'error'); }
    } catch (err) { console.error(err); }
  };

  const filtered = reservations.filter(r =>
    r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.phone?.includes(searchQuery)
  );

  const statusConfig: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
    Lunas:      { bg: '#dcfce7', text: '#166534', border: '#bbf7d0', label: 'Selesai', icon: <CheckCircle size={12} /> },
    'DP Dibayar': { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: 'DP Dibayar', icon: <span>ðŸ’µ</span> },
    Booking:    { bg: '#fef9c3', text: '#854d0e', border: '#fef08a', label: 'Booking', icon: <BookOpen size={12} /> },
  };

  const isToday = dateFilter === new Date().toISOString().split('T')[0];

  const stats = {
    total: reservations.length,
    booking: reservations.filter(r => r.status === 'Booking').length,
    dp: reservations.filter(r => r.status === 'DP Dibayar').length,
    done: reservations.filter(r => r.status === 'Lunas').length,
  };

  return (
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', background: '#f4f6f9', overflowY: 'auto', gap: '1.25rem' }}>

      {/* â”€â”€â”€ Header â”€â”€â”€ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-main)', margin: 0 }}>
            <Calendar color="var(--primary)" size={24} /> Reservasi Meja
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Kelola booking dan pantau jadwal kedatangan tamu</p>
        </div>
        <button
          onClick={() => { setSelectedReservation(null); setIsModalOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)', fontSize: '0.9rem' }}
        >
          <Plus size={18} /> Buat Reservasi
        </button>
      </div>

      {/* â”€â”€â”€ Stats Row â”€â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
        {[
          { label: 'Total Hari Ini', val: stats.total, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Menunggu', val: stats.booking, color: '#b45309', bg: '#fefce8' },
          { label: 'DP Dibayar', val: stats.dp, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Selesai', val: stats.done, color: '#166534', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '1rem', padding: '1rem 1.25rem', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* â”€â”€â”€ Toolbar â”€â”€â”€ */}
      <div style={{ background: 'white', borderRadius: '1rem', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* Date Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => shiftDate(-1)} style={{ width: 32, height: 32, borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center', minWidth: 130 }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>{formatDate(dateFilter)}</div>
            {isToday && <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--secondary)', padding: '0.05rem 0.4rem', borderRadius: '0.25rem', display: 'inline-block' }}>HARI INI</div>}
          </div>
          <button onClick={() => shiftDate(1)} style={{ width: 32, height: 32, borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ padding: '0.45rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--secondary)', outline: 'none', cursor: 'pointer' }} />

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text" placeholder="Cari nama / telepon..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1.5px solid #e2e8f0', borderRadius: '0.625rem', fontSize: '0.82rem', fontWeight: 500, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* â”€â”€â”€ Content Area â”€â”€â”€ */}
      <div style={{ flex: 1, background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#94a3b8', padding: '3rem' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Memuat reservasi...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#94a3b8', padding: '3rem' }}>
            <Calendar size={48} style={{ opacity: 0.3 }} />
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Tidak ada reservasi</div>
            <div style={{ fontSize: '0.82rem' }}>Tidak ada data untuk tanggal dan filter ini</div>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['WAKTU', 'PEMESAN', 'MEJA & TAMU', 'UANG MUKA', 'STATUS', 'AKSI'].map(h => (
                    <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((resv, idx) => {
                  const sc = statusConfig[resv.status] || statusConfig['Booking'];
                  return (
                    <tr key={resv.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? 'white' : '#fafafa', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafafa')}
                    >
                      {/* Waktu */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{resv.time || '-'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={10} /> {formatDate(resv.date)}
                        </div>
                      </td>

                      {/* Pemesan */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{resv.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                          <Phone size={11} /> {resv.phone}
                        </div>
                        {resv.notes && <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.25rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{resv.notes}"</div>}
                      </td>

                      {/* Meja & Tamu */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: '0.8rem', padding: '0.3rem 0.65rem', borderRadius: '0.5rem', width: 'fit-content', border: '1px solid #ddd6fe' }}>
                          <MapPin size={12} /> Meja {resv.table?.tableNo}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Users size={11} /> {resv.guests} Tamu
                        </div>
                      </td>

                      {/* DP */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {resv.dpAmount > 0 ? (
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534' }}>{formatCurrency(resv.dpAmount)}</div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic' }}>Belum ada</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, fontWeight: 700, fontSize: '0.72rem', padding: '0.3rem 0.65rem', borderRadius: '0.5rem' }}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button title="Edit" onClick={() => { setSelectedReservation(resv); setIsModalOpen(true); }}
                            style={{ width: 32, height: 32, border: '1.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', transition: 'all 0.12s' }}>
                            <Edit size={14} />
                          </button>
                          <button title="Batalkan" onClick={() => handleDelete(resv.id)}
                            style={{ width: 32, height: 32, border: '1.5px solid #fecaca', background: '#fff1f2', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', transition: 'all 0.12s' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
            ðŸ—ƒï¸ Menampilkan {filtered.length} dari {reservations.length} reservasi
          </span>
          <button onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
            style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--secondary)', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer' }}>
            Kembali ke Hari Ini
          </button>
        </div>
      </div>

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedReservation}
        onSave={handleSave}
      />
    </div>
  );
};

export default ReservationView;
