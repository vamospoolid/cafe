import React, { useState, useEffect, useContext } from 'react';
import { Calendar, Plus, Edit, Trash2, Clock, Phone, CheckCircle, Users, MapPin, ChevronLeft, ChevronRight, Search, BookOpen, Banknote } from 'lucide-react';
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
    'DP Dibayar': { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: 'DP Dibayar', icon: <Banknote size={12} /> },
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
    <div className="p-3.5 sm:p-6 pb-32 sm:pb-8 h-full overflow-y-auto bg-slate-50 flex flex-col gap-4">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Calendar className="text-primary" size={24} /> Reservasi Meja
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola booking dan pantau jadwal kedatangan tamu</p>
        </div>
        <button
          onClick={() => { setSelectedReservation(null); setIsModalOpen(true); }}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-xs shadow-md shadow-primary/20 transition-all active:scale-95"
        >
          <Plus size={16} /> Buat Reservasi
        </button>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total Hari Ini', val: stats.total, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'Menunggu', val: stats.booking, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'DP Dibayar', val: stats.dp, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Selesai', val: stats.done, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-3.5 sm:p-4 shadow-sm`}>
            <div className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.val}</div>
            <div className={`text-xs font-bold ${s.color} opacity-80 mt-0.5`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Toolbar ─── */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border border-slate-200 shadow-sm shrink-0">
        {/* Date Navigator */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button onClick={() => shiftDate(-1)} className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center min-w-[120px]">
            <div className="font-extrabold text-xs sm:text-sm text-slate-800">{formatDate(dateFilter)}</div>
            {isToday && <div className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block mt-0.5">HARI INI</div>}
          </div>
          <button onClick={() => shiftDate(1)} className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors">
            <ChevronRight size={16} />
          </button>
          <input 
            type="date" 
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-primary bg-slate-50 outline-none cursor-pointer" 
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 md:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" 
            placeholder="Cari nama / telepon..."
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
            <span className="font-bold text-xs">Memuat data reservasi...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Calendar size={40} className="opacity-30" />
            <div className="font-extrabold text-sm text-slate-700">Tidak ada reservasi</div>
            <div className="text-xs">Tidak ada jadwal reservasi untuk filter tanggal ini</div>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map(resv => {
                const sc = statusConfig[resv.status] || statusConfig['Booking'];
                return (
                  <div key={resv.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-primary">{resv.time || '-'}</span>
                        <span className="text-[11px] text-slate-400 font-medium">({formatDate(resv.date)})</span>
                      </div>
                      <span 
                        className="inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                      >
                        {sc.icon} {sc.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Pemesan:</span>
                        <span className="font-extrabold text-slate-800">{resv.customerName}</span>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {resv.phone}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 block">Meja & Tamu:</span>
                        <div className="font-bold text-indigo-700 flex items-center gap-1">
                          <MapPin size={12} /> Meja {resv.table?.tableNo}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Users size={11} /> {resv.guests} Tamu
                        </div>
                      </div>
                    </div>

                    {resv.notes && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                        "{resv.notes}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Uang Muka (DP)</span>
                        <span className="text-xs font-black text-emerald-700">
                          {resv.dpAmount > 0 ? formatCurrency(resv.dpAmount) : '—'}
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => { setSelectedReservation(resv); setIsModalOpen(true); }}
                          className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1"
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(resv.id)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-1"
                        >
                          <Trash2 size={13} /> Batal
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tablet & Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['WAKTU', 'PEMESAN', 'MEJA & TAMU', 'UANG MUKA', 'STATUS', 'AKSI'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-400 tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(resv => {
                    const sc = statusConfig[resv.status] || statusConfig['Booking'];
                    return (
                      <tr key={resv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-black text-sm text-primary">{resv.time || '-'}</div>
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={11} /> {formatDate(resv.date)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-extrabold text-xs text-slate-800">{resv.customerName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {resv.phone}
                          </div>
                          {resv.notes && <div className="text-[10px] text-slate-400 italic mt-0.5 max-w-xs truncate">"{resv.notes}"</div>}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-indigo-100">
                            <MapPin size={12} /> Meja {resv.table?.tableNo}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                            <Users size={11} /> {resv.guests} Tamu
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {resv.dpAmount > 0 ? (
                            <div className="font-black text-xs text-emerald-700">{formatCurrency(resv.dpAmount)}</div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">Belum ada</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span 
                            className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-lg"
                            style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                          >
                            {sc.icon} {sc.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button title="Edit" onClick={() => { setSelectedReservation(resv); setIsModalOpen(true); }}
                              className="w-8 h-8 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors">
                              <Edit size={14} />
                            </button>
                            <button title="Batalkan" onClick={() => handleDelete(resv.id)}
                              className="w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors">
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
          </>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <Calendar size={14} />
            <span>Menampilkan {filtered.length} dari {reservations.length} reservasi</span>
          </span>
          <button 
            onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
            className="text-xs font-bold text-primary hover:underline"
          >
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
