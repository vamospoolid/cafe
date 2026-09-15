import React, { useState, useEffect, useContext } from 'react';
import { 
  X, Calendar, Clock, User, Phone, Users, CreditCard, 
  FileText, MapPin, ChevronDown, Check, Plus, Minus, Sparkles,
  ArrowLeft, Save, Info, Banknote, BookOpen, CheckCircle2,
  CalendarDays, Armchair, AlertCircle
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { formatLocalDate, getTodayStr } from '../utils/dateUtils';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const QUICK_TIMES = ['11:30', '12:00', '13:00', '17:30', '18:30', '19:00', '20:00', '21:00'];
const QUICK_PAX = [2, 4, 6, 8, 10, 12];
const QUICK_DPS = [
  { label: 'Tanpa DP', val: '0' },
  { label: '50 Ribu', val: '50000' },
  { label: '100 Ribu', val: '100000' },
  { label: '200 Ribu', val: '200000' },
  { label: '500 Ribu', val: '500000' }
];

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
        date: initialData.date ? initialData.date.split('T')[0] : getTodayStr(),
        time: initialData.time || '',
        tableId: initialData.tableId ? String(initialData.tableId) : '',
        guests: initialData.guests || 2,
        dpAmount: initialData.dpAmount ? String(initialData.dpAmount) : '',
        notes: initialData.notes || '',
        status: initialData.status || 'Booking'
      });
    } else {
      setFormData({
        customerName: '',
        phone: '',
        date: getTodayStr(),
        time: '19:00',
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
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuestChange = (delta: number) => {
    setFormData(prev => ({
      ...prev,
      guests: Math.max(1, (Number(prev.guests) || 1) + delta)
    }));
  };

  const handleQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setFormData(prev => ({ ...prev, date: formatLocalDate(d) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      alert('Nama pelanggan wajib diisi.');
      return;
    }
    if (!formData.phone.trim()) {
      alert('Nomor WhatsApp / telepon pelanggan wajib diisi.');
      return;
    }
    if (!formData.tableId) {
      alert('Harap pilih alokasi meja restoran.');
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  const selectedTable = tables.find(t => String(t.id) === String(formData.tableId));

  const formatRupiah = (num: number | string) => {
    const n = Number(num) || 0;
    return `Rp ${n.toLocaleString('id-ID')}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* ─── FULL-PAGE TOP NAVBAR ─── */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
              <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700 shadow-xs">
                <Calendar size={18} />
              </span>
              <span>{initialData ? 'Edit Data Reservasi' : 'Buat Reservasi Baru Meja'}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate hidden sm:block">
              Atur kontak tamu, jadwal kehadiran, nomor meja, kapasitas pax, dan uang muka (DP)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer hidden sm:block"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{initialData ? 'Simpan Perubahan' : 'Konfirmasi Reservasi'}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ─── FULL-PAGE SCROLLABLE CONTENT ─── */}
      <main className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 lg:p-8">
        <form onSubmit={handleSave} className="max-w-6xl mx-auto w-full pb-28 sm:pb-24">

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">
            
            {/* ─── LEFT COLUMN: Identitas Tamu & Jadwal Kedatangan (7 cols) ─── */}
            <div className="md:col-span-7 space-y-5 sm:space-y-6">

              {/* Card 1: Identitas Pemesan */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <User size={18} />
                  </span>
                  <div>
                    <h2 className="font-black text-sm sm:text-base text-slate-800">Identitas Pemesan</h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">Informasi kontak tamu untuk konfirmasi reservasi</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nama Lengkap */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Lengkap Tamu <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="text" 
                        name="customerName" 
                        required 
                        value={formData.customerName} 
                        onChange={handleChange}
                        placeholder="Contoh: Budi Santoso" 
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* No WhatsApp */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nomor WhatsApp / HP <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="tel" 
                        name="phone" 
                        required 
                        value={formData.phone} 
                        onChange={handleChange}
                        placeholder="Contoh: 081234567890" 
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Jadwal & Waktu Kedatangan */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Clock size={18} />
                  </span>
                  <div>
                    <h2 className="font-black text-sm sm:text-base text-slate-800">Jadwal Kedatangan</h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">Pilih tanggal dan jam kehadiran tamu</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tanggal */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tanggal Reservasi <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="date" 
                        name="date" 
                        required 
                        value={formData.date} 
                        onChange={handleChange}
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all cursor-pointer"
                      />
                    </div>
                    {/* Quick Date Shortcuts */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        { label: 'Hari Ini', days: 0 },
                        { label: 'Besok', days: 1 },
                        { label: 'Lusa', days: 2 },
                        { label: '+3 Hari', days: 3 }
                      ].map(item => {
                        const targetDate = new Date();
                        targetDate.setDate(targetDate.getDate() + item.days);
                        const isMatch = formData.date === formatLocalDate(targetDate);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleQuickDate(item.days)}
                            className={`text-[11px] py-1 px-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                              isMatch
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Jam */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Jam Kedatangan <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="time" 
                        name="time" 
                        required 
                        value={formData.time} 
                        onChange={handleChange}
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all cursor-pointer"
                      />
                    </div>

                    {/* Quick Times Chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {QUICK_TIMES.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, time: t }))}
                          className={`text-[10px] py-1 px-2 rounded-md font-bold transition-all cursor-pointer ${
                            formData.time === t 
                              ? 'bg-indigo-600 text-white shadow-xs' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Catatan / Special Request */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Khusus / Permintaan Tamu
                  </label>
                  <textarea 
                    name="notes" 
                    rows={2} 
                    value={formData.notes} 
                    onChange={handleChange}
                    placeholder="Contoh: Meja dekat jendela, butuh baby chair, perayaan ulang tahun, dll." 
                    className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all resize-none"
                  />
                </div>
              </div>

            </div>

            {/* ─── RIGHT COLUMN: Meja, Pax, DP & Ringkasan Booking (5 cols) ─── */}
            <div className="md:col-span-5 space-y-5 sm:space-y-6">

              {/* Card 3: Jumlah Tamu & Alokasi Meja */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <h2 className="font-black text-sm sm:text-base text-slate-800">Meja & Tamu (Pax)</h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">Pilih kapasitas kursi dan meja restoran</p>
                  </div>
                </div>

                {/* Counter Tamu (Pax) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jumlah Tamu (Pax)
                  </label>
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <Users size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800">
                          {formData.guests} Orang
                        </div>
                        <div className="text-[10px] text-slate-400">Kapasitas kursi disiapkan</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGuestChange(-1)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-black text-base text-slate-800">
                        {formData.guests}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGuestChange(1)}
                        className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Preset Pax Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {QUICK_PAX.map(pax => (
                      <button
                        key={pax}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, guests: pax }))}
                        className={`text-[10px] py-1 px-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                          formData.guests === pax
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {pax} Pax
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pilih Meja */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Alokasi Nomor Meja <span className="text-rose-500">*</span>
                    </label>
                    {selectedTable && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        ✓ Kapasitas {selectedTable.capacity} Kursi
                      </span>
                    )}
                  </div>

                  <div className="relative mb-2.5">
                    <select 
                      name="tableId" 
                      required 
                      value={formData.tableId} 
                      onChange={handleChange}
                      className="w-full py-2.5 px-3.5 pr-9 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- Pilih Meja Restoran --</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>
                          Meja {t.tableNo || t.number} — Kapasitas {t.capacity} Kursi {t.name ? `(${t.name})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Visual Grid Meja Cepat */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200/70">
                    {tables.map(t => {
                      const isSelected = String(formData.tableId) === String(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, tableId: String(t.id) }))}
                          className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-black scale-[1.02]'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                          }`}
                        >
                          <div className="text-xs truncate">Meja {t.tableNo || t.number}</div>
                          <div className={`text-[9px] ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                            {t.capacity} Pax
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 4: Uang Muka (DP) & Status */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Banknote size={18} />
                  </span>
                  <div>
                    <h2 className="font-black text-sm sm:text-base text-slate-800">Uang Muka (DP) & Status</h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">Pencatatan pembayaran uang muka reservasi</p>
                  </div>
                </div>

                {/* DP Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nominal DP / Down Payment (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">Rp</span>
                    <input 
                      type="number" 
                      name="dpAmount" 
                      value={formData.dpAmount} 
                      onChange={handleChange}
                      placeholder="0" 
                      min="0"
                      className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-black text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
                    />
                  </div>

                  {/* Quick DP Chips */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
                    {QUICK_DPS.map(dp => {
                      const isActive = String(formData.dpAmount) === dp.val;
                      return (
                        <button
                          key={dp.val}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dpAmount: dp.val }))}
                          className={`text-[10px] py-1.5 px-1.5 rounded-lg font-bold border transition-all text-center cursor-pointer ${
                            isActive 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                              : 'bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200'
                          }`}
                        >
                          {dp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Reservasi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Reservasi
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { val: 'Booking', label: 'Booking Baru', icon: '📋' },
                      { val: 'DP Dibayar', label: 'DP Terbayar', icon: '💵' },
                      { val: 'Lunas', label: 'Hadir / Lunas', icon: '✅' }
                    ].map(st => {
                      const isSelected = formData.status === st.val;
                      return (
                        <button
                          key={st.val}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, status: st.val }))}
                          className={`py-2 px-2 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-[1.02]'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <div>{st.icon}</div>
                          <div className="text-[10px] mt-0.5 truncate">{st.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 5: Ringkasan Tiket Reservasi (Live Preview) */}
              <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Ringkasan Reservasi</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono">
                    {formData.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Tamu:</span>
                    <strong className="text-white truncate max-w-[180px]">{formData.customerName || '-'}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Jadwal:</span>
                    <strong className="text-white">{formatDateDisplay(formData.date)} ({formData.time || '-'})</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Alokasi Meja:</span>
                    <strong className="text-purple-200">
                      {selectedTable ? `Meja ${selectedTable.tableNo || selectedTable.number}` : 'Belum dipilih'} ({formData.guests} Pax)
                    </strong>
                  </div>
                  {Number(formData.dpAmount) > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                      <span className="text-emerald-300 font-bold">Uang Muka (DP):</span>
                      <strong className="text-emerald-400 font-black text-sm">{formatRupiah(formData.dpAmount)}</strong>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

        </form>
      </main>

      {/* ─── STICKY BOTTOM ACTION BAR ─── */}
      <footer className="bg-white border-t border-slate-200/90 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg z-20">
        <div className="hidden sm:flex items-center gap-2.5 text-xs text-slate-600 flex-wrap">
          <span className="font-bold text-slate-800">Info Cepat:</span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
            Tamu: <strong>{formData.customerName || '-'}</strong>
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
            Jadwal: <strong>{formData.date || '-'} ({formData.time || '-'})</strong>
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
            Meja: <strong>{selectedTable ? `No. ${selectedTable.tableNo || selectedTable.number}` : '-'}</strong> ({formData.guests} Pax)
          </span>
          {Number(formData.dpAmount) > 0 && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold">
              DP: {formatRupiah(formData.dpAmount)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-2 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Menyimpan...' : initialData ? 'Simpan Perubahan' : 'Konfirmasi Buat Reservasi'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ReservationModal;
