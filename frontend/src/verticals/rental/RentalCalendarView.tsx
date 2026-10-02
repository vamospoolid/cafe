import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Shirt, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Plus, 
  MessageSquare, 
  Printer, 
  Search, 
  Filter, 
  Sparkles, 
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  Scissors
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import useSocket from '../../hooks/useSocket';
import { toast } from '../../utils/alert';
import { RentalReceiptPrinter } from './RentalReceiptPrinter';
import { RentalSendReminderModal } from './RentalSendReminderModal';

interface RentalOrderItem {
  id: string;
  attireName: string;
  attireCode: string;
  rackHangerCode?: string;
  color?: string;
  size?: string;
  price: number;
}

interface RentalOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  eventLocation?: string;
  eventDate: string;
  pickupDate: string;
  returnDeadline: string;
  actualReturnDate?: string;
  status: string;
  rentalSubtotal: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  depositAmount: number;
  depositStatus: string;
  fittingNotes?: string;
  fittingDone?: boolean;
  items: RentalOrderItem[];
}

type AgendaEventType = 'EVENT' | 'PICKUP' | 'RETURN' | 'FITTING';

interface DayAgendaItem {
  type: AgendaEventType;
  order: RentalOrder;
  title: string;
  dateStr: string;
}

export const RentalCalendarView: React.FC = () => {
  const navigate = useNavigate();
  const { token, settings } = usePOS();
  const socket = useSocket();

  // Calendar State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  // Data State
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'EVENT' | 'PICKUP' | 'RETURN' | 'FITTING'>('ALL');

  // Modals
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<RentalOrder | null>(null);
  const [selectedReminderOrder, setSelectedReminderOrder] = useState<RentalOrder | null>(null);

  // Fetch Rental Orders for Active Month Range
  const fetchOrders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      // Melingkupi spillover 7 hari sebelum awal bulan & 7 hari sesudah akhir bulan
      const startRange = new Date(year, month, 1 - 7).toISOString().split('T')[0];
      const endRange = new Date(year, month + 1, 7).toISOString().split('T')[0];

      const res = await fetch(`/api/rental/orders?dateType=calendar&startDate=${startRange}&endDate=${endRange}&limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        toast('Gagal memuat agenda sewa busana.', 'error');
      }
    } catch (e) {
      console.error('Fetch rental calendar error:', e);
      toast('Terjadi kesalahan memuat kalender sewa.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token, currentDate]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handleRentalChange = () => {
      fetchOrders();
    };
    socket.on('rental:order_created', handleRentalChange);
    socket.on('rental:order_updated', handleRentalChange);

    return () => {
      socket.off('rental:order_created', handleRentalChange);
      socket.off('rental:order_updated', handleRentalChange);
    };
  }, [socket, currentDate]);

  // Calendar Calculation Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  // Helper to extract YYYY-MM-DD from ISO string
  const toDateString = (iso: string) => {
    if (!iso) return '';
    return iso.split('T')[0];
  };

  // Map Orders to Agenda Events Map: dateString -> DayAgendaItem[]
  const dateAgendaMap = useMemo(() => {
    const map = new Map<string, DayAgendaItem[]>();

    const addEvent = (dateStr: string, item: DayAgendaItem) => {
      if (!dateStr) return;
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(item);
    };

    orders.forEach(order => {
      if (order.status === 'CANCELLED') return;

      const eventDateStr = toDateString(order.eventDate);
      const pickupDateStr = toDateString(order.pickupDate);
      const returnDateStr = toDateString(order.returnDeadline);

      // 1. Hari H Acara
      if (eventDateStr) {
        addEvent(eventDateStr, {
          type: 'EVENT',
          order,
          title: `Acara: ${order.customerName}`,
          dateStr: eventDateStr
        });
      }

      // 2. Jadwal Pengambilan (Pickup)
      if (pickupDateStr && pickupDateStr !== eventDateStr) {
        addEvent(pickupDateStr, {
          type: 'PICKUP',
          order,
          title: `Ambil: ${order.customerName}`,
          dateStr: pickupDateStr
        });
      }

      // 3. Batas Pengembalian
      if (returnDateStr) {
        addEvent(returnDateStr, {
          type: 'RETURN',
          order,
          title: `Kembali: ${order.customerName}`,
          dateStr: returnDateStr
        });
      }

      // 4. Jadwal Fitting
      if (order.status === 'FITTING' && order.fittingNotes) {
        const fittingDateStr = pickupDateStr || eventDateStr;
        addEvent(fittingDateStr, {
          type: 'FITTING',
          order,
          title: `Fitting: ${order.customerName}`,
          dateStr: fittingDateStr
        });
      }
    });

    return map;
  }, [orders]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust so Monday is 0
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      dateString: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayNum: number;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const dateString = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateString,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
        dayNum
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: d,
        dateString,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
        dayNum: i
      });
    }

    // Next month padding days to complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateString = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateString,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
        dayNum: i
      });
    }

    return days;
  }, [year, month]);

  // Selected Day Agenda Items
  const selectedDayItems = useMemo(() => {
    const rawItems = dateAgendaMap.get(selectedDate) || [];
    return rawItems.filter(item => {
      if (activeFilter !== 'ALL' && item.type !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.order.customerName.toLowerCase().includes(q);
        const matchNum = item.order.orderNumber.toLowerCase().includes(q);
        const matchAttire = (item.order.items || []).some(it => 
          it.attireName.toLowerCase().includes(q) || (it.rackHangerCode && it.rackHangerCode.toLowerCase().includes(q))
        );
        return matchName || matchNum || matchAttire;
      }
      return true;
    });
  }, [dateAgendaMap, selectedDate, activeFilter, searchQuery]);

  // Monthly KPIs
  const monthlyMetrics = useMemo(() => {
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    let totalEvents = 0;
    let totalAttires = 0;
    let dueReturns = 0;
    let overdueCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    orders.forEach(o => {
      if (o.status === 'CANCELLED') return;
      if (o.eventDate && toDateString(o.eventDate).startsWith(currentMonthPrefix)) {
        totalEvents++;
        totalAttires += (o.items?.length || 0);
      }
      if (o.returnDeadline && toDateString(o.returnDeadline) === todayStr && o.status !== 'COMPLETED' && o.status !== 'RETURNED') {
        dueReturns++;
      }
      if (o.returnDeadline && toDateString(o.returnDeadline) < todayStr && o.status === 'PICKED_UP') {
        overdueCount++;
      }
    });

    return { totalEvents, totalAttires, dueReturns, overdueCount };
  }, [orders, year, month]);

  const formatCurrency = (val: number) => `Rp ${(Math.round(val || 0)).toLocaleString('id-ID')}`;

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── HEADER & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
              Sanggar Busana Adat
            </span>
            <span className="text-xs text-slate-400 font-medium">Kalender Operasional</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <CalendarDays className="text-indigo-600 shrink-0" size={26} />
            <span>Kalender &amp; Agenda Sewa Busana</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring jadwal fitting, pengambilan busana, hari H acara adat, dan tanggal pengembalian.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all shadow-xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/rental-kanban')}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Layers size={14} className="text-amber-500" />
            <span>Papan Kanban</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-200 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Booking Sewa Baru</span>
          </button>
        </div>
      </div>

      {/* ─── 4 MINI KPI CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CalendarIcon size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Acara Bulan Ini</div>
            <div className="text-lg font-black text-slate-900">{monthlyMetrics.totalEvents} Acara</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Shirt size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Busana Keluar</div>
            <div className="text-lg font-black text-slate-900">{monthlyMetrics.totalAttires} Pasang</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Kembali Hari Ini</div>
            <div className="text-lg font-black text-blue-700">{monthlyMetrics.dueReturns} Kontrak</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Terlambat (Overdue)</div>
            <div className="text-lg font-black text-rose-600">{monthlyMetrics.overdueCount} Kontrak</div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CALENDAR + DAILY AGENDA LAYOUT ─────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* ─── LEFT: MONTH CALENDAR GRID (FLEX-1) ────────────────────── */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          {/* Month Navigator & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-slate-900">
                {monthNames[month]} {year}
              </h2>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="px-2.5 py-0.5 rounded-lg hover:bg-white text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Event Category Badges Legend */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Acara</span>
              </span>
              <span className="flex items-center gap-1 text-blue-700">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Ambil</span>
              </span>
              <span className="flex items-center gap-1 text-purple-700">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Kembali</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Fitting</span>
              </span>
            </div>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] text-slate-400 uppercase tracking-wider py-1">
            {daysOfWeek.map((day, idx) => (
              <div key={idx} className={idx >= 5 ? 'text-rose-500' : ''}>
                {day}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((cell, idx) => {
              const dayEvents = dateAgendaMap.get(cell.dateString) || [];
              const isSelected = cell.dateString === selectedDate;
              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateString)}
                  className={`min-h-[75px] sm:min-h-[92px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm'
                      : cell.isCurrentMonth
                      ? 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      : 'border-transparent bg-slate-50/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isSelected
                          ? 'text-indigo-700 font-extrabold'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-300'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {hasEvents && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </div>

                  {/* Micro Chips preview */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev, evIdx) => {
                      const bgClass =
                        ev.type === 'EVENT'
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : ev.type === 'PICKUP'
                          ? 'bg-blue-100 text-blue-900 border-blue-200'
                          : ev.type === 'RETURN'
                          ? 'bg-purple-100 text-purple-900 border-purple-200'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-200';

                      return (
                        <div
                          key={evIdx}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate border leading-none ${bgClass}`}
                        >
                          {ev.type === 'EVENT' ? '👑' : ev.type === 'PICKUP' ? '📦' : ev.type === 'RETURN' ? '🔄' : '✂️'} {ev.order.customerName}
                        </div>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <div className="text-[9px] font-black text-slate-400 pl-1">
                        +{dayEvents.length - 2} lainnya
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── RIGHT: DAILY AGENDA DRAWER (STICKY SIDEBAR) ─────────── */}
        <div className="w-full xl:w-[380px] shrink-0 bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4 xl:sticky xl:top-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                Agenda Harian Terpilih
              </span>
              <h3 className="font-black text-sm text-slate-900 capitalize">
                {formatDateDisplay(selectedDate)}
              </h3>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              {selectedDayItems.length} Agenda
            </span>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('EVENT')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'EVENT'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              👑 Hari H
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('PICKUP')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'PICKUP'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              📦 Ambil
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('RETURN')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === 'RETURN'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              🔄 Kembali
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama penyewa / nomor kontrak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* List of Agenda Cards */}
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {selectedDayItems.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <CalendarIcon size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">Tidak ada agenda di tanggal ini</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Belum ada jadwal fitting, pengambilan, acara, atau pengembalian busana.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/pos')}
                  className="mt-3 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Buat Booking Baru</span>
                </button>
              </div>
            ) : (
              selectedDayItems.map((item, idx) => {
                const { order, type } = item;
                const isPaid = order.paymentStatus === 'FULL_PAID';
                const remainingPay = Math.max(0, order.totalAmount - order.paidAmount);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white shadow-xs space-y-2.5 transition-all"
                  >
                    {/* Header: Type Badge & Order Number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          type === 'EVENT'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : type === 'PICKUP'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : type === 'RETURN'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {type === 'EVENT' ? '👑 Hari H Acara' : type === 'PICKUP' ? '📦 Jadwal Ambil' : type === 'RETURN' ? '🔄 Batas Kembali' : '✂️ Jadwal Fitting'}
                      </span>

                      <span className="font-mono text-xs font-bold text-slate-500">
                        #{order.orderNumber}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div>
                      <h4 className="font-black text-sm text-slate-900 leading-tight">
                        {order.customerName}
                      </h4>
                      {order.customerPhone && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Phone size={12} className="text-slate-400" />
                          <span>{order.customerPhone}</span>
                        </div>
                      )}
                      {order.eventLocation && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{order.eventLocation}</span>
                        </div>
                      )}
                    </div>

                    {/* Attire Pieces Summary */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Koleksi Busana Disewa:
                        </span>
                        {order.items.map((it, itIdx) => (
                          <div key={itIdx} className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 truncate max-w-[180px]">
                              👘 {it.attireName}
                            </span>
                            {it.rackHangerCode && (
                              <span className="font-mono text-[9px] bg-white border border-slate-200 text-slate-600 px-1 py-0.5 rounded font-bold">
                                {it.rackHangerCode}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fitting Notes if exists */}
                    {order.fittingNotes && (
                      <div className="text-[10px] text-slate-600 bg-amber-50/70 p-2 rounded-xl border border-amber-100 italic">
                        <strong>Catatan Ukuran:</strong> "{order.fittingNotes}"
                      </div>
                    )}

                    {/* Payment & Deposit Summary */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Uang Jaminan:</span>
                        <span className="font-bold text-slate-700">
                          {formatCurrency(order.depositAmount)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Biaya Sewa:</span>
                        <span className="font-black text-slate-900 block">
                          {formatCurrency(order.totalAmount)}
                        </span>
                        <span className={`text-[9px] font-bold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isPaid ? 'Lunas ✓' : `Sisa ${formatCurrency(remainingPay)}`}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedReminderOrder(order)}
                        className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Kirim Pesan WhatsApp"
                      >
                        <MessageSquare size={13} />
                        <span>WA</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedReceiptOrder(order)}
                        className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Cetak Resi / Kontrak / Deposit"
                      >
                        <Printer size={13} />
                        <span>Cetak</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('/rental-kanban')}
                        className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Buka di Papan Status Sewa"
                      >
                        <Layers size={13} />
                        <span>Kanban</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL CETAK RESI & KONTRAK SEWA ─────────────────────────── */}
      {selectedReceiptOrder && (
        <RentalReceiptPrinter
          order={selectedReceiptOrder}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}

      {/* ─── MODAL PENGINGAT WHATSAPP ─────────────────────────────────── */}
      <RentalSendReminderModal
        isOpen={!!selectedReminderOrder}
        onClose={() => setSelectedReminderOrder(null)}
        order={selectedReminderOrder}
      />
    </div>
  );
};

export default RentalCalendarView;
