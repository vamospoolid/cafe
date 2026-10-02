import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  History, 
  Search, 
  RotateCcw, 
  Filter, 
  Shirt, 
  DollarSign, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Eye, 
  Zap, 
  MessageSquare, 
  FileText, 
  Download, 
  Layers, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Printer,
  ChevronRight,
  Tag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { POSContext } from '../../context/POSContext';
import { useVertical } from '../../context/VerticalContext';
import * as XLSX from 'xlsx';
import { toast } from '../../utils/alert';
import { getTodayStr, getYesterdayStr, getLast7DaysRange, getThisMonthRange } from '../../utils/dateUtils';
import { RentalReceiptPrinter } from './RentalReceiptPrinter';
import { RentalSendReminderModal, type RentalOrderReminderTarget } from './RentalSendReminderModal';
import { generateRentalFinancialPDF } from '../../utils/pdfGenerator';

interface RentalOrderItem {
  id: string;
  attireName: string;
  attireCode: string;
  color?: string;
  size?: string;
  price?: number;
  rentalPrice?: number;
  rackHangerCode?: string;
  accessories?: string[];
  quantity?: number;
}

interface RentalOrderData {
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
  discount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  depositAmount: number;
  depositRefunded: number;
  depositStatus: string;
  lateFee: number;
  damageFee: number;
  fittingNotes?: string;
  fittingDone: boolean;
  createdAt: string;
  items: RentalOrderItem[];
  customer?: { id: number; name: string; phone?: string };
}

export const RentalTransactionHistoryView: React.FC = () => {
  const navigate = useNavigate();
  const posContext = useContext(POSContext);
  const { profile } = useVertical();

  const [orders, setOrders] = useState<RentalOrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  // Filter States
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('all');
  const [dateField, setDateField] = useState<'createdAt' | 'eventDate'>('createdAt');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<RentalOrderData | null>(null);
  const [printOrder, setPrintOrder] = useState<RentalOrderData | null>(null);
  const [reminderOrder, setReminderOrder] = useState<RentalOrderReminderTarget | null>(null);

  const handleSelectPreset = (newPreset: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all') => {
    setPreset(newPreset);
    if (newPreset === 'today') {
      const t = getTodayStr();
      setStartDate(t);
      setEndDate(t);
    } else if (newPreset === 'yesterday') {
      const y = getYesterdayStr();
      setStartDate(y);
      setEndDate(y);
    } else if (newPreset === 'week') {
      const r = getLast7DaysRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (newPreset === 'month') {
      const r = getThisMonthRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (newPreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchRentalOrders = async () => {
    if (!posContext?.token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('dateType', dateField);
      params.append('limit', '200');
      params.append('orderBy', dateField);
      params.append('orderDirection', 'desc');

      if (statusFilter) params.append('status', statusFilter);
      if (paymentStatusFilter) params.append('paymentStatus', paymentStatusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/rental/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${posContext.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } else {
        toast(data.error || 'Gagal mengambil riwayat kontrak sewa.', 'error');
      }
    } catch (err: any) {
      console.error('[RentalHistory] Error:', err);
      toast('Terjadi gangguan jaringan saat memuat riwayat rental.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentalOrders();
  }, [posContext?.token, startDate, endDate, dateField, statusFilter, paymentStatusFilter]);

  // Client-side quick search
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(o => 
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.eventLocation && o.eventLocation.toLowerCase().includes(q)) ||
      o.items.some(it => 
        it.attireName.toLowerCase().includes(q) || 
        (it.attireCode && it.attireCode.toLowerCase().includes(q)) ||
        (it.rackHangerCode && it.rackHangerCode.toLowerCase().includes(q))
      )
    );
  }, [orders, searchQuery]);

  // Financial & Operational Metrics
  const metrics = useMemo(() => {
    const valid = filteredOrders.filter(o => o.status !== 'CANCELLED');
    const totalRevenue = valid.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalDepositHeld = valid.reduce((sum, o) => sum + Math.max(0, (o.depositAmount || 0) - (o.depositRefunded || 0)), 0);
    const inUseCount = valid.filter(o => o.status === 'PICKED_UP').length;
    return {
      count: valid.length,
      revenue: totalRevenue,
      depositHeld: totalDepositHeld,
      inUse: inUseCount
    };
  }, [filteredOrders]);

  const formatCurrency = (val: number) => `Rp ${(Math.round(val || 0)).toLocaleString('id-ID')}`;
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatDateTime = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'BOOKED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">BOOKED (Masuk)</span>;
      case 'FITTING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">FITTING</span>;
      case 'PICKED_UP':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">SEDANG DISEWA</span>;
      case 'RETURNED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">KEMBALI (Antre QC)</span>;
      case 'QC_CHECK':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">PENGECEKAN QC</span>;
      case 'LAUNDRY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">PROSES CUCI</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">SELESAI</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">DIBATALKAN</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'FULL_PAID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">LUNAS</span>;
      case 'DP_PAID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">DP MASUK</span>;
      case 'UNPAID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">BELUM BAYAR</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const handleReset = () => {
    handleSelectPreset('all');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setSearchQuery('');
    setDateField('createdAt');
  };

  const exportExcel = () => {
    const rows = filteredOrders.map((o, idx) => ({
      "No": idx + 1,
      "No. Kontrak": o.orderNumber,
      "Penyewa": o.customerName,
      "No. HP": o.customerPhone || '-',
      "Tgl Booking": formatDateTime(o.createdAt),
      "Tgl Acara": formatDate(o.eventDate),
      "Tgl Diambil": formatDate(o.pickupDate),
      "Batas Kembali": formatDate(o.returnDeadline),
      "Koleksi Busana": o.items.map(it => `${it.attireName} [${it.rackHangerCode || '-'}]`).join(', '),
      "Total Sewa (Rp)": o.totalAmount,
      "Terbayar (Rp)": o.paidAmount,
      "Deposit Jaminan (Rp)": o.depositAmount,
      "Status Siklus": o.status,
      "Status Bayar": o.paymentStatus,
      "Metode": o.paymentMethod || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kontrak Sewa");
    XLSX.writeFile(workbook, `Rekap_Kontrak_Rental_${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    try {
      const analyticsData = {
        period: { type: preset, start: startDate || 'Awal', end: endDate || 'Sekarang' },
        kpis: {
          totalRevenue: metrics.revenue,
          activeRentalsCount: metrics.inUse,
          totalDepositHeld: metrics.depositHeld,
          totalRentalOrders: metrics.count
        },
        orders: filteredOrders
      };
      await generateRentalFinancialPDF(analyticsData, posContext?.settings || {}, (posContext?.user as any)?.name || 'Admin');
      toast('Laporan kontrak sewa berhasil diexport ke PDF!', 'success');
    } catch (err: any) {
      console.error('[ExportPDF] Error:', err);
      toast('Gagal mengekspor laporan PDF: ' + err.message, 'error');
    }
  };

  return (
    <div className="p-2.5 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3 sm:gap-4 max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
              <Shirt size={18} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Riwayat Kontrak Sewa Busana
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <Sparkles size={11} /> Baju Bodo &amp; Adat
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar lengkap kontrak persewaan pakaian adat Bugis-Makassar, jadwal ambil, tenggat kembali, dan rekonsiliasi deposit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => navigate('/rental-kanban')}
            className="flex-1 sm:flex-none btn bg-amber-500 hover:bg-amber-600 text-white py-2 px-3.5 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95"
          >
            <Layers size={14} /> Papan Kanban
          </button>
          <button 
            onClick={exportPDF}
            className="flex-1 sm:flex-none btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2 px-3 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95"
          >
            <FileText size={14} className="text-rose-500 shrink-0" /> Export PDF
          </button>
          <button 
            onClick={exportExcel}
            className="flex-1 sm:flex-none btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2 px-3 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95"
          >
            <Download size={14} className="text-emerald-600 shrink-0" /> Excel
          </button>
        </div>
      </div>

      {/* 4 KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
        <div className="card p-3 sm:p-4 border-l-4 border-amber-500 bg-white shadow-xs rounded-xl sm:rounded-2xl flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight truncate">{metrics.count} Kontrak</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Total Kontrak Sewa Sah</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Shirt size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="card p-3 sm:p-4 border-l-4 border-emerald-500 bg-white shadow-xs rounded-xl sm:rounded-2xl flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-emerald-600 tracking-tight truncate">{formatCurrency(metrics.revenue)}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Total Nilai Omset Sewa</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <DollarSign size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="card p-3 sm:p-4 border-l-4 border-indigo-500 bg-white shadow-xs rounded-xl sm:rounded-2xl flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-indigo-700 tracking-tight truncate">{formatCurrency(metrics.depositHeld)}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Uang Jaminan / Deposit Ditahan</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <ShieldCheck size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="card p-3 sm:p-4 border-l-4 border-purple-500 bg-white shadow-xs rounded-xl sm:rounded-2xl flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm sm:text-2xl font-black text-purple-700 tracking-tight truncate">{metrics.inUse} Set Busana</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Sedang Di Luar / Disewa</div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Clock size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* FILTER ACCORDION BOX */}
      <div className="card p-0 shadow-xs bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 overflow-hidden shrink-0">
        <button 
          className="w-full p-2.5 sm:p-3.5 flex justify-between items-center bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-800">
            <Filter size={15} className="text-amber-600" /> Filter &amp; Pencarian Kontrak Sewa Busana
          </div>
          <span className={`text-xs text-slate-400 transform transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {isFilterOpen && (
          <div className="p-3 sm:p-4 bg-white space-y-3 border-t border-slate-100">
            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
                <Calendar size={12} /> Periode:
              </span>
              {(['all', 'today', 'yesterday', 'week', 'month'] as const).map(p => {
                const labels: Record<string, string> = {
                  all: 'Semua',
                  today: 'Hari Ini',
                  yesterday: 'Kemarin',
                  week: '7 Hari Terakhir',
                  month: 'Bulan Ini'
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      preset === p 
                        ? 'bg-amber-500 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setDateField('createdAt')}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    dateField === 'createdAt' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tgl Booking
                </button>
                <button
                  type="button"
                  onClick={() => setDateField('eventDate')}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    dateField === 'eventDate' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tgl Acara
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Status Siklus Busana</label>
                <select 
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="">Semua Siklus</option>
                  <option value="BOOKED">BOOKED (Booking)</option>
                  <option value="FITTING">FITTING (Fitting)</option>
                  <option value="PICKED_UP">PICKED_UP (Diambil)</option>
                  <option value="RETURNED">RETURNED (Kembali)</option>
                  <option value="QC_CHECK">QC_CHECK (Pengecekan)</option>
                  <option value="LAUNDRY">LAUNDRY (Cuci)</option>
                  <option value="COMPLETED">COMPLETED (Selesai)</option>
                  <option value="CANCELLED">CANCELLED (Batal)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Status Pembayaran</label>
                <select 
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  value={paymentStatusFilter}
                  onChange={e => setPaymentStatusFilter(e.target.value)}
                >
                  <option value="">Semua Pembayaran</option>
                  <option value="FULL_PAID">Lunas (Full Paid)</option>
                  <option value="DP_PAID">Uang Muka (DP Masuk)</option>
                  <option value="UNPAID">Belum Bayar (Unpaid)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Cari Kontak / Pakaian / No. Hanger</label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input 
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="Cari RNT-..., nama penyewa, no. HP, hanger..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LIST OR TABLE VIEW */}
      <div className="card p-0 shadow-xs bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-slate-600">Menyinkronkan data kontrak sewa busana...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center justify-center gap-2">
            <Shirt size={32} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Tidak ada kontrak sewa ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Cobalah ubah filter periode atau kata kunci pencarian di atas, atau buat sewa baru melalui menu Kasir.
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE CARD VIEW (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredOrders.map((ord, idx) => (
                <div key={ord.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
                      <span className="font-black text-xs text-amber-700 truncate tracking-tight">{ord.orderNumber}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {getStatusBadge(ord.status)}
                      {getPaymentBadge(ord.paymentStatus)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1">
                        <User size={12} className="text-amber-600" /> {ord.customerName}
                      </span>
                      {ord.customerPhone && (
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Phone size={10} /> {ord.customerPhone}
                        </span>
                      )}
                    </div>
                    {ord.eventLocation && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                        <MapPin size={11} className="text-slate-400 shrink-0" /> {ord.eventLocation}
                      </p>
                    )}
                  </div>

                  {/* Attire items summary */}
                  <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100/70 space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">Koleksi Busana Adat ({ord.items.length} Set):</span>
                    <div className="space-y-1">
                      {ord.items.slice(0, 3).map((it, i) => (
                        <div key={i} className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                          <span className="truncate pr-2">• {it.attireName}</span>
                          {it.rackHangerCode && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 font-mono font-bold shrink-0">
                              {it.rackHangerCode}
                            </span>
                          )}
                        </div>
                      ))}
                      {ord.items.length > 3 && (
                        <div className="text-[10px] font-bold text-amber-700 italic">
                          +{ord.items.length - 3} busana / aksesoris lainnya...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Schedule info */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-50">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Tenggat Kembali:</span>
                      <span className="font-bold text-slate-800 text-[11px] block">{formatDate(ord.returnDeadline)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Sewa &amp; Deposit:</span>
                      <span className="font-black text-xs text-slate-900 block">{formatCurrency(ord.totalAmount)}</span>
                      {ord.depositAmount > 0 && (
                        <span className="text-[9.5px] text-indigo-600 font-bold block">+Jaminan {formatCurrency(ord.depositAmount)}</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => setSelectedDetailOrder(ord)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Eye size={12} /> Rincian
                    </button>
                    <button 
                      onClick={() => setPrintOrder(ord)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Printer size={12} /> Cetak Nota
                    </button>
                    <button 
                      onClick={() => setReminderOrder({
                        id: ord.id,
                        orderNumber: ord.orderNumber,
                        customerName: ord.customerName,
                        customerPhone: ord.customerPhone,
                        returnDeadline: ord.returnDeadline,
                        pickupDate: ord.pickupDate,
                        status: ord.status,
                        totalAmount: ord.totalAmount,
                        depositAmount: ord.depositAmount,
                        attireSummary: ord.items.map(it => it.attireName).join(', ')
                      })}
                      className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-bold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <MessageSquare size={12} /> WA Notif
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">No. Kontrak</th>
                    <th className="py-3 px-4">Penyewa &amp; Lokasi</th>
                    <th className="py-3 px-4">Koleksi Busana &amp; Hanger</th>
                    <th className="py-3 px-4">Jadwal Acara / Kembali</th>
                    <th className="py-3 px-4">Nilai Sewa</th>
                    <th className="py-3 px-4">Status Siklus</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredOrders.map((ord, idx) => (
                    <tr key={ord.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 font-black text-amber-700">
                        <div>{ord.orderNumber}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{formatDate(ord.createdAt)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900">{ord.customerName}</div>
                        <div className="text-[11px] text-slate-500">{ord.customerPhone || '-'}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-800 truncate">
                          {ord.items[0]?.attireName || 'Set Busana Adat'}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          {ord.items[0]?.rackHangerCode && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono font-bold">
                              {ord.items[0].rackHangerCode}
                            </span>
                          )}
                          {ord.items.length > 1 && (
                            <span className="text-amber-700 font-semibold">+{ord.items.length - 1} item lain</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-700">Kembali: <span className="font-bold text-slate-900">{formatDate(ord.returnDeadline)}</span></div>
                        <div className="text-[10px] text-slate-400">Acara: {formatDate(ord.eventDate)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900">{formatCurrency(ord.totalAmount)}</div>
                        <div className="text-[10px] text-indigo-600 font-bold">Deposit: {formatCurrency(ord.depositAmount)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getStatusBadge(ord.status)}
                          {getPaymentBadge(ord.paymentStatus)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => setSelectedDetailOrder(ord)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Rincian Kontrak"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            onClick={() => setPrintOrder(ord)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            title="Cetak Nota / Lembar Kontrak"
                          >
                            <Printer size={15} />
                          </button>
                          <button 
                            onClick={() => setReminderOrder({
                              id: ord.id,
                              orderNumber: ord.orderNumber,
                              customerName: ord.customerName,
                              customerPhone: ord.customerPhone,
                              returnDeadline: ord.returnDeadline,
                              pickupDate: ord.pickupDate,
                              status: ord.status,
                              totalAmount: ord.totalAmount,
                              depositAmount: ord.depositAmount,
                              attireSummary: ord.items.map(it => it.attireName).join(', ')
                            })}
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
                            title="Kirim Notifikasi WhatsApp"
                          >
                            <MessageSquare size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                  <Shirt size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900">
                    Kontrak Sewa #{selectedDetailOrder.orderNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dibuat pada {formatDateTime(selectedDetailOrder.createdAt)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDetailOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Status and Customer Overview */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Penyewa:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedDetailOrder.customerName}</span>
                  <p className="text-slate-600 font-medium mt-0.5">{selectedDetailOrder.customerPhone || 'Tidak ada no. telp'}</p>
                  {selectedDetailOrder.eventLocation && (
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={11} /> {selectedDetailOrder.eventLocation}
                    </p>
                  )}
                </div>
                <div className="text-right space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Status Kontrak:</span>
                  <div>{getStatusBadge(selectedDetailOrder.status)}</div>
                  <div>{getPaymentBadge(selectedDetailOrder.paymentStatus)}</div>
                </div>
              </div>

              {/* Schedule Timeline */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200/70 text-center">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 block">JADWAL AMBIL</span>
                  <span className="font-black text-slate-900 text-xs">{formatDate(selectedDetailOrder.pickupDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-800 block">TANGGAL ACARA</span>
                  <span className="font-black text-slate-900 text-xs">{formatDate(selectedDetailOrder.eventDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-rose-800 block">BATAS KEMBALI</span>
                  <span className="font-black text-rose-700 text-xs">{formatDate(selectedDetailOrder.returnDeadline)}</span>
                </div>
              </div>

              {/* Attire Items */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shirt size={14} className="text-amber-600" /> Daftar Busana &amp; Aksesoris yang Disewa:
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedDetailOrder.items.map((it, i) => (
                    <div key={i} className="p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">{it.attireName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {it.size && <span>Ukuran: <b>{it.size}</b></span>}
                          {it.color && <span>Warna: <b>{it.color}</b></span>}
                          {it.rackHangerCode && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-mono font-bold">
                              Hanger: {it.rackHangerCode}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-black text-slate-900 text-right">
                        {formatCurrency(it.price || it.rentalPrice || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Biaya Sewa:</span>
                  <span className="font-bold">{formatCurrency(selectedDetailOrder.rentalSubtotal)}</span>
                </div>
                {selectedDetailOrder.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon Khusus:</span>
                    <span className="font-bold">-{formatCurrency(selectedDetailOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 text-sm font-black pt-1 border-t border-slate-200">
                  <span>Total Tagihan Sewa:</span>
                  <span className="text-amber-700">{formatCurrency(selectedDetailOrder.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Uang Muka / Sudah Bayar:</span>
                  <span>{formatCurrency(selectedDetailOrder.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-indigo-700 font-bold pt-1 border-t border-slate-200/60">
                  <span>Uang Jaminan Fisik (Deposit):</span>
                  <span>{formatCurrency(selectedDetailOrder.depositAmount)}</span>
                </div>
              </div>

              {/* Fitting Notes if present */}
              {selectedDetailOrder.fittingNotes && (
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900">
                  <span className="text-[10px] font-black uppercase tracking-wider block text-blue-800">Catatan Fitting &amp; Permak:</span>
                  <p className="mt-0.5 text-xs">{selectedDetailOrder.fittingNotes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <button 
                onClick={() => {
                  setSelectedDetailOrder(null);
                  navigate('/rental-kanban');
                }}
                className="btn bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Layers size={14} /> Papan Sirkulasi
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const ord = selectedDetailOrder;
                    setSelectedDetailOrder(null);
                    setReminderOrder({
                      id: ord.id,
                      orderNumber: ord.orderNumber,
                      customerName: ord.customerName,
                      customerPhone: ord.customerPhone,
                      returnDeadline: ord.returnDeadline,
                      pickupDate: ord.pickupDate,
                      status: ord.status,
                      totalAmount: ord.totalAmount,
                      depositAmount: ord.depositAmount,
                      attireSummary: ord.items.map(it => it.attireName).join(', ')
                    });
                  }}
                  className="btn bg-green-600 hover:bg-green-700 text-white py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
                <button 
                  onClick={() => {
                    const ord = selectedDetailOrder;
                    setSelectedDetailOrder(null);
                    setPrintOrder(ord);
                  }}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <Printer size={14} /> Cetak Struk / Kontrak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENTAL RECEIPT PRINTER MODAL */}
      {printOrder && (
        <RentalReceiptPrinter 
          order={printOrder} 
          onClose={() => setPrintOrder(null)} 
        />
      )}

      {/* WHATSAPP REMINDER MODAL */}
      {reminderOrder && (
        <RentalSendReminderModal 
          isOpen={Boolean(reminderOrder)}
          order={reminderOrder}
          onClose={() => setReminderOrder(null)}
          onSuccess={() => {
            fetchRentalOrders();
            setReminderOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default RentalTransactionHistoryView;
