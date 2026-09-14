import React, { useState, useEffect, useContext } from 'react';
import { 
  X, Calendar, Clock, User, Phone, Users, CreditCard, 
  FileText, MapPin, ChevronDown, Check, Plus, Minus, Sparkles 
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const QUICK_TIMES = ['12:00', '13:00', '18:00', '19:00', '20:00'];
const QUICK_DPS = [
  { label: 'Tanpa DP', val: '0' },
  { label: '50 Ribu', val: '50000' },
  { label: '100 Ribu', val: '100000' },
  { label: '200 Ribu', val: '200000' }
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
    } catch (err) { console.error(err); }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-fade-in">
      {/* Modal Container */}
      <div className="bg-white w-full max-w-lg md:max-w-3xl lg:max-w-4xl max-h-[94vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 my-auto animate-in fade-in zoom-in-95 duration-200">

        {/* ─── Header ─── */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50/60 to-white border-b border-purple-100/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
              <Calendar size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base text-slate-800 leading-tight">
                {initialData ? 'Edit Data Reservasi' : 'Buat Reservasi Baru'}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                Isi detail jadwal, meja, dan kontak pemesan
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="w-8 h-8 rounded-full bg-white/90 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors shadow-sm border border-slate-200/60"
            onClick={onClose} 
            disabled={loading}
          >
            <X size={17} />
          </button>
        </div>

        {/* ─── Form Body ─── */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-full">

              {/* ─── LEFT COLUMN: Customer Info & Timing (7 cols on Desktop/Tablet) ─── */}
              <div className="md:col-span-7 p-4 sm:p-6 flex flex-col gap-4 md:border-r border-slate-100 bg-white">
                
                {/* Section: Identitas Pemesan */}
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                    <span className="p-1 rounded-lg bg-purple-50 text-purple-600">
                      <User size={15} />
                    </span>
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                      Identitas Pemesan
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Nama Lengkap */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Nama Lengkap <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="text" 
                          name="customerName" 
                          required 
                          value={formData.customerName} 
                          onChange={handleChange}
                          placeholder="cth: Budi Santoso" 
                          className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all duration-150 box-border"
                        />
                      </div>
                    </div>

                    {/* No. WhatsApp */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        No. WhatsApp / Telepon <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="tel" 
                          name="phone" 
                          required 
                          value={formData.phone} 
                          onChange={handleChange}
                          placeholder="cth: 081234567890" 
                          className="w-full py-2.5 px-3.5 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all duration-150 box-border"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Jadwal Kedatangan */}
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                    <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                      <Clock size={15} />
                    </span>
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                      Jadwal Kedatangan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tanggal */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Tanggal Kedatangan <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="date" 
                          name="date" 
                          required 
                          value={formData.date} 
                          onChange={handleChange}
                          className="w-full py-2.5 px-3 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all duration-150 box-border"
                        />
                      </div>
                    </div>

                    {/* Jam */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Jam Kedatangan <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="time" 
                          name="time" 
                          required 
                          value={formData.time} 
                          onChange={handleChange}
                          className="w-full py-2.5 px-3 pl-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all duration-150 box-border"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Time Pills */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                      <Sparkles size={11} /> Cepat:
                    </span>
                    {QUICK_TIMES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, time: t }))}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                          formData.time === t 
                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30' 
                            : 'bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section: Catatan Khusus */}
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100">
                    <span className="p-1 rounded-lg bg-slate-100 text-slate-600">
                      <FileText size={15} />
                    </span>
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                      Catatan / Permintaan Khusus
                    </span>
                  </div>

                  <div className="relative">
                    <textarea 
                      name="notes" 
                      value={formData.notes} 
                      onChange={handleChange} 
                      rows={2}
                      placeholder="cth: Meja dekat jendela, request dekorasi ulang tahun, alergi makanan..."
                      className="w-full p-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all duration-150 resize-none leading-relaxed box-border"
                    />
                  </div>
                </div>
              </div>

              {/* ─── RIGHT COLUMN: Table, Guests, DP & CTA (5 cols on Desktop/Tablet) ─── */}
              <div className="md:col-span-5 p-4 sm:p-6 bg-slate-50/70 flex flex-col justify-between gap-5 border-t md:border-t-0 border-slate-100">
                <div className="space-y-4">
                  
                  {/* Section: Detail Meja & Tamu */}
                  <div>
                    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200/80">
                      <span className="p-1 rounded-lg bg-purple-100/70 text-purple-700">
                        <MapPin size={15} />
                      </span>
                      <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                        Detail Meja & Tamu
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* Pilih Meja */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Pilih Meja <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <select 
                            name="tableId" 
                            required 
                            value={formData.tableId} 
                            onChange={handleChange}
                            className="w-full py-2.5 px-3.5 pr-9 bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all appearance-none cursor-pointer box-border"
                          >
                            <option value="">— Pilih Meja Tersedia —</option>
                            {tables.map(t => (
                              <option key={t.id} value={t.id}>
                                Meja {t.tableNo} (Kap. {t.capacity} Orang) - {t.status || 'Tersedia'}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {selectedTable && (
                          <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1.5">
                            <Check size={13} />
                            <span>Meja {selectedTable.tableNo} dipilih (Kapasitas: {selectedTable.capacity} orang)</span>
                          </div>
                        )}
                      </div>

                      {/* Jumlah Tamu (Stepper) */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Jumlah Tamu (Orang)
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleGuestChange(-1)}
                            className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm shrink-0"
                          >
                            <Minus size={15} />
                          </button>
                          
                          <div className="relative flex-1">
                            <Users size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input 
                              type="number" 
                              name="guests" 
                              min="1" 
                              value={formData.guests} 
                              onChange={handleChange}
                              className="w-full py-2.5 px-3 pl-10 text-center bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-extrabold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all box-border"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleGuestChange(1)}
                            className="w-10 h-10 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm shrink-0"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Pembayaran DP */}
                  <div>
                    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200/80">
                      <span className="p-1 rounded-lg bg-emerald-100/70 text-emerald-700">
                        <CreditCard size={15} />
                      </span>
                      <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                        Uang Muka (Down Payment)
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Nominal DP <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                          Rp
                        </span>
                        <input 
                          type="number" 
                          name="dpAmount" 
                          value={formData.dpAmount} 
                          onChange={handleChange}
                          placeholder="0 (Tanpa DP)" 
                          className="w-full py-2.5 px-3 pl-10 bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-extrabold text-slate-800 placeholder-slate-300 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all box-border"
                        />
                      </div>

                      {/* Quick DP Pills */}
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {QUICK_DPS.map(dp => (
                          <button
                            key={dp.val}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, dpAmount: dp.val }))}
                            className={`text-[11px] py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                              formData.dpAmount === dp.val 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                : 'bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200'
                            }`}
                          >
                            {dp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Status — only in edit mode */}
                  {initialData && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Status Reservasi
                      </label>
                      <div className="relative">
                        <select 
                          name="status" 
                          value={formData.status} 
                          onChange={handleChange}
                          className="w-full py-2.5 px-3.5 pr-9 bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-600/10 transition-all appearance-none cursor-pointer box-border"
                        >
                          <option value="Booking">📋 Booking Baru</option>
                          <option value="DP Dibayar">💵 DP Telah Dibayar</option>
                          <option value="Lunas">✅ Selesai (Lunas)</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                </div>

                {/* ─── Bottom Action Buttons (CTA) ─── */}
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-200/90 mt-2">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </span>
                    ) : (
                      <>
                        <Check size={17} />
                        <span>{initialData ? 'Simpan Perubahan Reservasi' : 'Konfirmasi Buat Reservasi'}</span>
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={onClose} 
                    disabled={loading} 
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
