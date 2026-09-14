import React, { useState, useEffect, useContext } from 'react';
import { 
  X, Calendar, Clock, User, Phone, Users, CreditCard, 
  FileText, MapPin, ChevronDown, Check, Plus, Minus, Sparkles,
  ArrowLeft, Save, Info, Banknote, BookOpen
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const QUICK_TIMES = ['11:30', '12:00', '13:00', '17:30', '18:30', '19:00', '20:00', '21:00'];
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
        date: initialData.date || '',
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
        date: new Date().toISOString().split('T')[0],
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
      if (res.ok) setTables(await res.json());
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
    setFormData(prev => ({ ...prev, date: d.toISOString().split('T')[0] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
      {/* ─── FULL-PAGE TOP NAVBAR ─── */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
              <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700">
                <Calendar size={18} />
              </span>
              <span>{initialData ? 'Edit Data Reservasi' : 'Buat Reservasi Baru Meja'}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              Atur jadwal kedatangan tamu, alokasi meja, kapasitas pax, dan uang muka (DP)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            className="px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
        <form onSubmit={handleSave} className="max-w-6xl mx-auto w-full space-y-6 pb-24">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ─── LEFT COLUMN: Identitas Pemesan & Waktu Kedatangan (7 cols) ─── */}
            <div className="lg:col-span-7 space-y-6">

              {/* Card 1: Identitas Pemesan */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <User size={18} />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-800">Identitas Pemesan</h2>
                    <p className="text-xs text-slate-400">Informasi kontak pelanggan untuk konfirmasi kedatangan</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nama Lengkap */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Lengkap Pelanggan <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="text" 
                        name="customerName" 
                        required 
                        value={formData.customerName} 
                        onChange={handleChange}
                        placeholder="Contoh: Budi Santoso" 
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* No WhatsApp */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nomor WhatsApp / Telepon <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="tel" 
                        name="phone" 
                        required 
                        value={formData.phone} 
                        onChange={handleChange}
                        placeholder="Contoh: 081234567890" 
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
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
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-800">Jadwal Kedatangan</h2>
                    <p className="text-xs text-slate-400">Pilih tanggal dan jam kehadiran tamu</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tanggal */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tanggal Reservasi <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="date" 
                        name="date" 
                        required 
                        value={formData.date} 
                        onChange={handleChange}
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
                      />
                    </div>
                    {/* Quick Date Shortcuts */}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => handleQuickDate(0)}
                        className="text-[11px] py-1 px-2.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDate(1)}
                        className="text-[11px] py-1 px-2.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        Besok
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDate(2)}
                        className="text-[11px] py-1 px-2.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        Lusa
                      </button>
                    </div>
                  </div>

                  {/* Jam */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Jam Kedatangan <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="time" 
                        name="time" 
                        required 
                        value={formData.time} 
                        onChange={handleChange}
                        className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all"
                      />
                    </div>

                    {/* Quick Times Chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {QUICK_TIMES.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, time: t }))}
                          className={`text-[10px] py-1 px-2 rounded-md font-bold transition-all ${
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
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Khusus / Permintaan Tamu
                  </label>
                  <textarea 
                    name="notes" 
                    rows={3} 
                    value={formData.notes} 
                    onChange={handleChange}
                    placeholder="Contoh: Meja dekat jendela, perayaan ulang tahun, butuh kursi bayi, dll." 
                    className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all resize-none"
                  />
                </div>
              </div>

            </div>

            {/* ─── RIGHT COLUMN: Kapasitas, Meja, DP & Status (5 cols) ─── */}
            <div className="lg:col-span-5 space-y-6">

              {/* Card 3: Jumlah Tamu & Alokasi Meja */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-800">Meja & Tamu (Pax)</h2>
                    <p className="text-xs text-slate-400">Pilih kapasitas kursi dan meja restoran</p>
                  </div>
                </div>

                {/* Counter Tamu (Pax) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Jumlah Tamu (Pax)
                  </label>
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <Users size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800">
                          {formData.guests} Orang
                        </div>
                        <div className="text-[10px] text-slate-400">Kapasitas kursi yang disiapkan</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGuestChange(-1)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold active:scale-95 transition-all shadow-xs"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-black text-base text-slate-800">
                        {formData.guests}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGuestChange(1)}
                        className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center font-bold active:scale-95 transition-all shadow-xs"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pilih Meja */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Alokasi Nomor Meja <span className="text-rose-500">*</span>
                    </label>
                    {selectedTable && (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Kapasitas {selectedTable.capacity} Kursi
                      </span>
                    )}
                  </div>

                  <div className="relative mb-3">
                    <select 
                      name="tableId" 
                      required 
                      value={formData.tableId} 
                      onChange={handleChange}
                      className="w-full py-3 px-3.5 pr-9 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-extrabold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- Pilih Meja Restoran --</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>
                          Meja {t.number} — Kapasitas {t.capacity} Kursi {t.section ? `(${t.section})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Visual Grid Meja Cepat */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                    {tables.map(t => {
                      const isSelected = String(formData.tableId) === String(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, tableId: String(t.id) }))}
                          className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20 font-black scale-[1.02]'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                          }`}
                        >
                          <div className="text-xs">Meja {t.number}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
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
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-800">Uang Muka (DP) & Status</h2>
                    <p className="text-xs text-slate-400">Pencatatan pembayaran muka reservasi</p>
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
                          className={`text-[10px] py-1.5 px-1.5 rounded-lg font-bold border transition-all text-center ${
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
                  <div className="relative">
                    <select 
                      name="status" 
                      value={formData.status} 
                      onChange={handleChange}
                      className="w-full py-2.5 px-3.5 pr-9 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all appearance-none cursor-pointer"
                    >
                      <option value="Booking">📋 Booking Baru (Menunggu)</option>
                      <option value="DP Dibayar">💵 DP Telah Dibayar</option>
                      <option value="Lunas">✅ Selesai (Lunas / Hadir)</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

            </div>

          </div>

        </form>
      </main>

      {/* ─── STICKY BOTTOM ACTION BAR ─── */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
          <span className="font-bold text-slate-800">Ringkasan:</span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
            Tamu: <strong>{formData.customerName || '-'}</strong>
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
            Jadwal: <strong>{formData.date || '-'} ({formData.time || '-'})</strong>
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
            Meja: <strong>{selectedTable ? `No. ${selectedTable.number}` : 'Belum dipilih'}</strong> ({formData.guests} Pax)
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
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Menyimpan...' : initialData ? 'Simpan Perubahan' : 'Konfirmasi Buat Reservasi'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ReservationModal;
