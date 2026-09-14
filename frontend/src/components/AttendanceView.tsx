import React, { useState, useEffect, useContext } from 'react';
import { 
  UserCheck, Calendar, Clock, Download, CheckCircle2, Fingerprint, 
  FileText, MapPin, Camera, User, TrendingUp, AlertTriangle, 
  Eye, X, Search, RefreshCw, Smartphone, Check, Sparkles, Award
} from 'lucide-react';
import ClockInModal from './ClockInModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { getTodayStr, formatLocalDate } from '../utils/dateUtils';

interface IndividualSummary {
  user: {
    id: number;
    name: string;
    username: string;
    role: string;
    phone?: string;
    status: string;
  };
  stats: {
    totalEntries: number;
    totalHadir: number;
    totalTerlambat: number;
    totalLuarRadius: number;
    totalLateMinutes: number;
    totalWorkHours: number;
  };
  discipline?: {
    enableZeroLateBonus: boolean;
    zeroLateStatus: 'ELIGIBLE' | 'ON_TRACK' | 'HANGUS' | 'DISABLED';
    isEligibleZeroLate: boolean;
    isOnTrackZeroLate: boolean;
    zeroLateBonusEarned: number;
    zeroLateBonusAmount: number;
    zeroLateMinAttendance: number;
    enableLatePenalty: boolean;
    latePenaltyType: string;
    latePenaltyAmount: number;
    totalLatePenalty: number;
    netDisciplineAmount: number;
  };
  recentLogs: any[];
}

export const AttendanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'individual' | 'leaves' | 'sop_handover'>('daily');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<IndividualSummary[]>([]);
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [handoverList, setHandoverList] = useState<any[]>([]);
  const [todaySopList, setTodaySopList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Rejected'>('ALL');
  
  const [dateFilter, setDateFilter] = useState(() => getTodayStr());

  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modal Foto Zoom / Detail Log
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null);

  // Modal Detail Karyawan
  const [selectedUserSummary, setSelectedUserSummary] = useState<IndividualSummary | null>(null);

  const posContext = useContext(POSContext);

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      let url = '/api/attendance';
      if (dateFilter) url += `?date=${dateFilter}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setAttendances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIndividualSummaries = async () => {
    setLoading(true);
    try {
      let url = `/api/attendance/summary-individual?month=${monthFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setSummaries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      let url = '/api/attendance/leaves';
      if (leaveStatusFilter !== 'ALL') url += `?status=${leaveStatusFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      if (res.ok) setLeavesList(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHandoverAndSop = async () => {
    setLoading(true);
    try {
      const [hoRes, sopRes] = await Promise.all([
        fetch('/api/attendance/handover', { headers: { Authorization: `Bearer ${posContext?.token}` } }),
        fetch('/api/attendance/checklist/today', { headers: { Authorization: `Bearer ${posContext?.token}` } })
      ]);
      if (hoRes.ok) setHandoverList(await hoRes.json());
      if (sopRes.ok) setTodaySopList(await sopRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLeaveStatus = async (id: number, status: 'Approved' | 'Rejected', adminNotes?: string) => {
    try {
      const res = await fetch(`/api/attendance/leaves/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          status,
          approvedBy: (posContext?.user as any)?.name || 'Admin',
          adminNotes: adminNotes || (status === 'Approved' ? 'Disetujui oleh Manajemen' : 'Ditolak')
        })
      });
      if (res.ok) {
        fetchLeaves();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      if (activeTab === 'daily') fetchAttendances();
      if (activeTab === 'individual') fetchIndividualSummaries();
      if (activeTab === 'leaves') fetchLeaves();
      if (activeTab === 'sop_handover') fetchHandoverAndSop();
    }
  }, [posContext?.token, activeTab, dateFilter, monthFilter, leaveStatusFilter]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const calculateDuration = (clockIn?: string, clockOut?: string) => {
    if (!clockIn || !clockOut) return '-';
    try {
      const start = new Date(clockIn).getTime();
      const end = new Date(clockOut).getTime();
      const diffMinutes = Math.floor((end - start) / (1000 * 60));
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}j ${mins}m`;
    } catch {
      return '-';
    }
  };

  const exportDailyPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Harian Absensi Karyawan', 14, 15);
    doc.setFontSize(10);
    doc.text(`Filter Tanggal: ${dateFilter}`, 14, 22);
    doc.text(`Dicetak Pada: ${new Date().toLocaleString('id-ID')}`, 14, 28);

    const tableColumn = ["Nama", "Role", "Shift", "Jam Masuk", "Jam Keluar", "Durasi", "Jarak GPS", "Status"];
    const tableRows: any[] = [];

    attendances.forEach((att) => {
      tableRows.push([
        att.user?.name,
        att.user?.role,
        att.shiftName?.split('(')[0] || '-',
        formatTime(att.clockIn),
        formatTime(att.clockOut),
        calculateDuration(att.clockIn, att.clockOut),
        att.distanceIn ? `${att.distanceIn}m` : '-',
        att.status + (att.lateMinutes ? ` (+${att.lateMinutes}m)` : '')
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 32,
    });
    doc.save(`Laporan_Absensi_Harian_${dateFilter}.pdf`);
  };

  const exportSummaryPDF = () => {
    const doc = new jsPDF();
    doc.text('Rekapitulasi Individu Absensi Karyawan', 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode Bulan: ${monthFilter}`, 14, 22);
    doc.text(`Dicetak Pada: ${new Date().toLocaleString('id-ID')}`, 14, 28);

    const tableColumn = ["Nama Karyawan", "Role", "Total Hadir", "Frekuensi Telat", "Status Zero Late", "Potongan Telat", "Estimasi Bonus"];
    const tableRows: any[] = [];

    summaries.forEach((s) => {
      const zStatus = s.discipline?.enableZeroLateBonus
        ? s.discipline.zeroLateStatus === 'ELIGIBLE'
          ? `DAPAT (+Rp ${(s.discipline.zeroLateBonusEarned || 0).toLocaleString()})`
          : s.discipline.zeroLateStatus === 'ON_TRACK'
          ? `ON TRACK (Target ${s.discipline.zeroLateMinAttendance} Hari)`
          : 'HANGUS (Terlambat)'
        : 'Nonaktif';

      const denda = s.discipline?.enableLatePenalty
        ? `Rp ${(s.discipline.totalLatePenalty || 0).toLocaleString()}`
        : 'Rp 0';

      const netBonus = s.discipline?.netDisciplineAmount !== undefined
        ? `Rp ${(s.discipline.netDisciplineAmount || 0).toLocaleString()}`
        : '-';

      tableRows.push([
        s.user?.name,
        s.user?.role,
        `${s.stats?.totalHadir} Hari`,
        `${s.stats?.totalTerlambat} Kali (${s.stats?.totalLateMinutes} mnt)`,
        zStatus,
        denda,
        netBonus
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 32,
    });
    doc.save(`Rekapitulasi_Absensi_Karyawan_${monthFilter}.pdf`);
  };

  // Metrics for Tab 1 (Log Harian)
  const totalHadirToday = attendances.filter(a => a.status === 'Hadir' || a.status === 'Terlambat').length;
  const onTimeToday = attendances.filter(a => a.status === 'Hadir').length;
  const lateToday = attendances.filter(a => a.status === 'Terlambat').length;

  // Metrics for Tab 2 (Rekap Individu)
  const totalEmployeesSummary = summaries.length;
  const totalLateCountMonth = summaries.reduce((acc, s) => acc + (s.stats?.totalTerlambat || 0), 0);
  const totalWorkHoursMonth = summaries.reduce((acc, s) => acc + (s.stats?.totalWorkHours || 0), 0);

  return (
    <div 
      className="h-full flex-1 overflow-y-auto w-full bg-slate-50/50"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto pb-44 sm:pb-24">
        {/* HEADER UTAMA */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <UserCheck size={26} />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Absensi & Rekapitulasi Staf
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                Monitoring kehadiran real-time via GPS geofencing, foto selfie kamera, dan shift rolling.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <a
              href="/staff"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Smartphone size={15} /> PWA Staf & Dapur
            </a>

            <button
              className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Fingerprint size={16} /> Terminal Absensi
            </button>
          </div>
        </div>

        {/* TAB CONTROLS (HORIZONTALLY SCROLLABLE ON MOBILE) */}
        <div className="overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-max min-w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'daily'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={15} />
              <span>Log Harian</span>
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'individual'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={15} />
              <span>Rekapitulasi Bulanan</span>
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'leaves'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={15} />
              <span>Pengajuan Izin & Sakit</span>
              {leavesList.filter(l => l.status === 'Pending').length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                  {leavesList.filter(l => l.status === 'Pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sop_handover')}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'sop_handover'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={15} />
              <span>SOP Dapur & Handover</span>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: LOG HARIAN ABSENSI
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            {/* KPI STATS HARIAN */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm text-center sm:text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Hadir</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5 block">{totalHadirToday}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm text-center sm:text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tepat Waktu</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 block">{onTimeToday}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm text-center sm:text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Terlambat</span>
                <span className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 block">{lateToday}</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Calendar size={18} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                  />
                  <button
                    onClick={() => setDateFilter(getTodayStr())}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                  >
                    Hari Ini
                  </button>
                </div>

                <button
                  onClick={exportDailyPDF}
                  className="w-full sm:w-auto justify-center px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <FileText size={15} className="text-rose-500" /> Export PDF Harian
                </button>
              </div>

              {/* Mobile Cards View (< 640px) */}
              <div className="sm:hidden divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline-block text-indigo-600 mb-2" />
                    <p className="text-xs">Memuat data absensi...</p>
                  </div>
                ) : attendances.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <UserCheck size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs">Tidak ada data absensi untuk tanggal {dateFilter}.</p>
                  </div>
                ) : (
                  attendances.map(att => (
                    <div key={att.id} className="p-3.5 space-y-2.5 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {att.photoIn ? (
                            <img
                              src={att.photoIn}
                              alt="Selfie"
                              onClick={() => setSelectedPhoto({ url: att.photoIn, title: `${att.user?.name} - ${att.date}` })}
                              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-sm cursor-pointer shrink-0 active:scale-95 transition-transform"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {att.user?.name?.slice(0, 2).toUpperCase() || 'ST'}
                            </div>
                          )}
                          <div>
                            <h4 className="font-black text-sm text-slate-900 leading-tight">{att.user?.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
                                {att.user?.role}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {att.shiftName?.split('(')[0] || 'Shift Pagi'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 shrink-0 ${
                            att.status === 'Hadir'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : att.status === 'Terlambat'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {att.status} {att.lateMinutes ? `(+${att.lateMinutes}m)` : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Masuk (IN)</span>
                          <span className="font-bold text-emerald-600 flex items-center gap-1">
                            <Clock size={11} /> {formatTime(att.clockIn)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Keluar (OUT)</span>
                          <span className={`font-bold flex items-center gap-1 ${att.clockOut ? 'text-rose-600' : 'text-slate-400'}`}>
                            <Clock size={11} /> {formatTime(att.clockOut)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Durasi</span>
                          <span className="font-bold text-indigo-600">
                            {calculateDuration(att.clockIn, att.clockOut)}
                          </span>
                        </div>
                      </div>

                      {att.distanceIn !== null && att.distanceIn !== undefined && (
                        <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                          <span className="flex items-center gap-1 font-semibold">
                            <MapPin size={12} className={att.isWithinRadius ? 'text-emerald-500' : 'text-rose-500'} />
                            Jarak GPS: {att.distanceIn}m ({att.isWithinRadius ? 'Dalam Radius' : 'Luar Radius'})
                          </span>
                          {att.notes && <span className="text-slate-400 italic truncate max-w-[120px]">"{att.notes}"</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Foto Selfie</th>
                      <th className="py-3.5 px-4">Nama Karyawan &amp; Role</th>
                      <th className="py-3.5 px-4">Shift Kerja</th>
                      <th className="py-3.5 px-4">Jam Masuk (IN)</th>
                      <th className="py-3.5 px-4">Jam Keluar (OUT)</th>
                      <th className="py-3.5 px-4">Durasi Kerja</th>
                      <th className="py-3.5 px-4">Jarak GPS</th>
                      <th className="py-3.5 px-4 text-center">Status Absensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw size={24} className="animate-spin inline-block text-indigo-600 mb-2" />
                          <p>Memuat data absensi...</p>
                        </td>
                      </tr>
                    ) : attendances.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <UserCheck size={32} className="mx-auto text-slate-300 mb-2" />
                          <p>Tidak ada data absensi untuk tanggal {dateFilter}.</p>
                        </td>
                      </tr>
                    ) : (
                      attendances.map(att => (
                        <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            {att.photoIn ? (
                              <img
                                src={att.photoIn}
                                alt="Selfie"
                                onClick={() => setSelectedPhoto({ url: att.photoIn, title: `${att.user?.name} - ${att.date}` })}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                title="Klik untuk memperbesar foto"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                                <User size={16} />
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <h4 className="font-black text-slate-800">{att.user?.name}</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                              {att.user?.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-600">
                            {att.shiftName?.split('(')[0] || 'Shift Pagi'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                              <Clock size={13} /> {formatTime(att.clockIn)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-bold flex items-center gap-1.5 ${att.clockOut ? 'text-rose-600' : 'text-slate-400'}`}>
                              <Clock size={13} /> {formatTime(att.clockOut)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-indigo-600">
                            {calculateDuration(att.clockIn, att.clockOut)}
                          </td>
                          <td className="py-3 px-4">
                            {att.distanceIn !== null && att.distanceIn !== undefined ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                <MapPin size={12} className={att.isWithinRadius ? 'text-emerald-500' : 'text-rose-500'} />
                                {att.distanceIn}m
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                                att.status === 'Hadir'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : att.status === 'Terlambat'
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {att.status} {att.lateMinutes ? `(+${att.lateMinutes}m)` : ''}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: REKAPITULASI BULANAN INDIVIDU KARYAWAN
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'individual' && (
          <div className="space-y-4">
            {/* KPI STATS BULANAN */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm text-center sm:text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Staf</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5 block">{totalEmployeesSummary}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm text-center sm:text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Telat Bulan Ini</span>
                <span className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 block">{totalLateCountMonth}x</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm text-center sm:text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Jam Kerja</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 block">{totalWorkHoursMonth} Jam</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Calendar size={18} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-500">Periode Bulan:</span>
                  <input
                    type="month"
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                  />
                </div>

                <button
                  onClick={exportSummaryPDF}
                  className="w-full sm:w-auto justify-center px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <FileText size={15} className="text-rose-500" /> Export Rekapitulasi PDF
                </button>
              </div>

              {/* Mobile Cards View (< 640px) */}
              <div className="sm:hidden divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline-block text-indigo-600 mb-2" />
                    <p className="text-xs">Memuat rekapitulasi data staf...</p>
                  </div>
                ) : summaries.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <UserCheck size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs">Tidak ada data staf yang ditemukan.</p>
                  </div>
                ) : (
                  summaries.map(s => (
                    <div key={s.user.id} className="p-3.5 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-black text-sm text-slate-900 leading-tight">{s.user.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold inline-block mt-1">
                            {s.user.role}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedUserSummary(s)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                        >
                          <Eye size={12} /> Detail
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Total Hadir</span>
                          <span className="font-bold text-emerald-600">{s.stats.totalHadir} Hari</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Terlambat</span>
                          <span className={`font-bold ${s.stats.totalTerlambat > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {s.stats.totalTerlambat} Kali {s.stats.totalLateMinutes ? `(${s.stats.totalLateMinutes}m)` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Reward & Penalty Badges */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <div className="space-y-0.5">
                          {s.discipline?.enableZeroLateBonus && (
                            <div>
                              {s.discipline.zeroLateStatus === 'ELIGIBLE' ? (
                                <span className="text-[10px] text-emerald-700 font-black">⭐ Bonus Rp {(s.discipline.zeroLateBonusEarned || 0).toLocaleString()}</span>
                              ) : s.discipline.zeroLateStatus === 'ON_TRACK' ? (
                                <span className="text-[10px] text-blue-700 font-bold">🎯 On Track ({s.stats.totalHadir}/{s.discipline.zeroLateMinAttendance})</span>
                              ) : (
                                <span className="text-[10px] text-rose-500 font-bold">❌ Bonus Hangus</span>
                              )}
                            </div>
                          )}
                          {s.discipline?.enableLatePenalty && (s.discipline.totalLatePenalty || 0) > 0 && (
                            <div className="text-[10px] text-rose-600 font-bold">
                              Denda: -Rp {(s.discipline.totalLatePenalty || 0).toLocaleString()}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">Estimasi Bersih</span>
                          <span className={`font-black text-sm ${
                            (s.discipline?.netDisciplineAmount || 0) > 0 
                              ? 'text-emerald-600' 
                              : (s.discipline?.netDisciplineAmount || 0) < 0 
                              ? 'text-rose-600' 
                              : 'text-slate-700'
                          }`}>
                            Rp {(s.discipline?.netDisciplineAmount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Nama Karyawan</th>
                      <th className="py-3.5 px-4">Role / Posisi</th>
                      <th className="py-3.5 px-4 text-center">Total Hadir</th>
                      <th className="py-3.5 px-4 text-center">Terlambat</th>
                      <th className="py-3.5 px-4 text-center">Bonus Zero Late</th>
                      <th className="py-3.5 px-4 text-center">Potongan Denda</th>
                      <th className="py-3.5 px-4 text-center">Estimasi Bonus</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw size={24} className="animate-spin inline-block text-indigo-600 mb-2" />
                          <p>Memuat rekapitulasi data staf...</p>
                        </td>
                      </tr>
                    ) : summaries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <UserCheck size={32} className="mx-auto text-slate-300 mb-2" />
                          <p>Tidak ada data staf yang ditemukan.</p>
                        </td>
                      </tr>
                    ) : (
                      summaries.map(s => (
                        <tr key={s.user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-black text-slate-800">{s.user.name}</td>
                          <td className="py-3.5 px-4">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                              {s.user.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                            {s.stats.totalHadir} Hari
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`font-black px-2 py-0.5 rounded-full text-xs ${
                                s.stats.totalTerlambat > 0
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                  : 'text-slate-400'
                              }`}
                            >
                              {s.stats.totalTerlambat} Kali {s.stats.totalLateMinutes ? `(${s.stats.totalLateMinutes}m)` : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {s.discipline?.enableZeroLateBonus ? (
                              s.discipline.zeroLateStatus === 'ELIGIBLE' ? (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-[10px] border border-emerald-200 inline-flex items-center gap-1">
                                  ⭐ Dapat Rp {(s.discipline.zeroLateBonusEarned || 0).toLocaleString()}
                                </span>
                              ) : s.discipline.zeroLateStatus === 'ON_TRACK' ? (
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-[10px] border border-blue-200 inline-flex items-center gap-1">
                                  🎯 On Track ({s.stats.totalHadir}/{s.discipline.zeroLateMinAttendance})
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full font-bold text-[10px] border border-rose-200 inline-flex items-center gap-1">
                                  ❌ Hangus
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300 text-[10px]">Nonaktif</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {s.discipline?.enableLatePenalty && (s.discipline.totalLatePenalty || 0) > 0 ? (
                              <span className="font-black text-rose-600 text-xs">
                                -Rp {(s.discipline.totalLatePenalty || 0).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Rp 0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`font-black text-xs ${
                              (s.discipline?.netDisciplineAmount || 0) > 0 
                                ? 'text-emerald-600' 
                                : (s.discipline?.netDisciplineAmount || 0) < 0 
                                ? 'text-rose-600' 
                                : 'text-slate-700'
                            }`}>
                              Rp {(s.discipline?.netDisciplineAmount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedUserSummary(s)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 mx-auto"
                            >
                              <Eye size={13} /> Rincian
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODAL DETAIL REKAP INDIVIDU KARYAWAN (SEAMLESS FULL-PAGE ON MOBILE)
            ───────────────────────────────────────────────────────────── */}
        {selectedUserSummary && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 overflow-y-auto">
            <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl flex flex-col md:overflow-hidden max-h-screen md:max-h-[90vh] animate-in fade-in duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                    <User size={22} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {selectedUserSummary.user.name} ({selectedUserSummary.user.role})
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Periode Rekapitulasi: {monthFilter}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedUserSummary(null)} 
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto pb-28 md:pb-6">
                {/* STATS TILES */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Hadir</p>
                    <h4 className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5">{selectedUserSummary.stats.totalHadir} Hari</h4>
                  </div>
                  <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-100 text-center">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Terlambat</p>
                    <h4 className="text-lg sm:text-xl font-black text-rose-800 mt-0.5">{selectedUserSummary.stats.totalTerlambat} Kali</h4>
                    <span className="text-[10px] text-rose-600 font-bold block">({selectedUserSummary.stats.totalLateMinutes} menit)</span>
                  </div>
                  <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-100 text-center">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Jam Kerja</p>
                    <h4 className="text-lg sm:text-xl font-black text-indigo-800 mt-0.5">{selectedUserSummary.stats.totalWorkHours} Jam</h4>
                    <span className="text-[10px] text-indigo-600 font-bold block">Durasi Efektif</span>
                  </div>
                </div>

                {/* REWARD & PUNISHMENT BREAKDOWN TILE */}
                {selectedUserSummary.discipline && (
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" /> Rincian Reward & Punishment Kedisiplinan
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Bonus Zero Late</p>
                        <p className={`font-black text-sm mt-1 ${
                          selectedUserSummary.discipline.zeroLateStatus === 'ELIGIBLE' ? 'text-emerald-600' :
                          selectedUserSummary.discipline.zeroLateStatus === 'ON_TRACK' ? 'text-blue-600' : 'text-slate-400 line-through'
                        }`}>
                          Rp {(selectedUserSummary.discipline.zeroLateBonusAmount || 0).toLocaleString()}
                        </p>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {selectedUserSummary.discipline.zeroLateStatus === 'ELIGIBLE' ? '✓ Memenuhi syarat' :
                           selectedUserSummary.discipline.zeroLateStatus === 'ON_TRACK' ? `Progress: ${selectedUserSummary.stats.totalHadir}/${selectedUserSummary.discipline.zeroLateMinAttendance} Hari` :
                           '❌ Hangus (Ada keterlambatan)'}
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Potongan Telat</p>
                        <p className="font-black text-sm text-rose-600 mt-1">
                          -Rp {(selectedUserSummary.discipline.totalLatePenalty || 0).toLocaleString()}
                        </p>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {selectedUserSummary.discipline.enableLatePenalty 
                            ? `${selectedUserSummary.stats.totalTerlambat}x telat (${selectedUserSummary.discipline.latePenaltyType === 'PER_MINUTE' ? 'Per Menit' : 'Flat/Kejadian'})`
                            : 'Denda nonaktif'}
                        </span>
                      </div>

                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">Estimasi Bersih</p>
                        <p className="font-black text-indigo-900 mt-1 text-sm">
                          Rp {(selectedUserSummary.discipline.netDisciplineAmount || 0).toLocaleString()}
                        </p>
                        <span className="text-[10px] text-indigo-500 block mt-0.5">
                          Reward bersih bulan ini
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* LOGS LIST WITH PHOTOS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-800">Riwayat Log Kehadiran Terakhir:</h4>
                  <div className="space-y-2.5 divide-y divide-slate-100">
                    {selectedUserSummary.recentLogs?.map(log => (
                      <div key={log.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {log.photoIn ? (
                            <img
                              src={log.photoIn}
                              alt="Selfie"
                              onClick={() => setSelectedPhoto({ url: log.photoIn, title: `${selectedUserSummary.user.name} - ${log.date}` })}
                              className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                              <User size={18} />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-black text-slate-800">{log.date}</h5>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                  log.status === 'Hadir'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-600'
                                }`}
                              >
                                {log.status} {log.lateMinutes ? `(+${log.lateMinutes}m)` : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {log.shiftName?.split('(')[0]} • Masuk: {formatTime(log.clockIn)} - Pulang: {formatTime(log.clockOut)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right text-xs">
                          <span className="font-black text-indigo-600">{calculateDuration(log.clockIn, log.clockOut)}</span>
                          {log.distanceIn !== null && log.distanceIn !== undefined && (
                            <p className="text-[10px] text-slate-400">{log.distanceIn}m dari toko</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedUserSummary(null)}
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all"
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: PENGAJUAN IZIN & SAKIT KARYAWAN (APPROVAL FLOW)
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'leaves' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Daftar Pengajuan Izin & Sakit</h3>
                <p className="text-xs text-slate-500">Persetujuan atau penolakan permohonan izin karyawan secara online.</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['ALL', 'Pending', 'Approved', 'Rejected'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setLeaveStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      leaveStatusFilter === st ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'Semua' : st === 'Pending' ? 'Menunggu' : st === 'Approved' ? 'Disetujui' : 'Ditolak'}
                  </button>
                ))}
              </div>
            </div>

            {leavesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Tidak ada data pengajuan izin dengan filter ini.
              </div>
            ) : (
              <div className="space-y-3">
                {leavesList.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900">{item.user?.name}</span>
                        <span className="text-xs font-bold text-slate-500">({item.user?.role})</span>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {item.type}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status === 'Approved' ? '✓ Disetujui' : item.status === 'Rejected' ? '✕ Ditolak' : '⏳ Menunggu Review'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-medium">"{item.reason}"</p>

                      <p className="text-[11px] text-slate-400">
                        Periode: <strong>{item.startDate}</strong> s/d <strong>{item.endDate}</strong> • Diajukan: {new Date(item.createdAt).toLocaleDateString('id-ID')}
                      </p>

                      {item.adminNotes && (
                        <p className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-100">
                          <strong>Catatan Manajer ({item.approvedBy || 'Admin'}):</strong> {item.adminNotes}
                        </p>
                      )}
                    </div>

                    {item.status === 'Pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateLeaveStatus(item.id, 'Approved')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
                        >
                          ✓ Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateLeaveStatus(item.id, 'Rejected')}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
                        >
                          ✕ Tolak
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: MONITORING SOP DAPUR & HANDOVER SERAH TERIMA SHIFT
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'sop_handover' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Checklist SOP Harian */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <span>Kepatuhan SOP Buka / Tutup Dapur Hari Ini</span>
                </h3>
                <span className="text-xs font-bold text-slate-400">{todaySopList.length} Sesi</span>
              </div>

              {todaySopList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada laporan checklist SOP yang dikirim staf hari ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySopList.map(sop => {
                    let items: any[] = [];
                    try {
                      items = typeof sop.itemsJson === 'string' ? JSON.parse(sop.itemsJson) : sop.itemsJson;
                    } catch {
                      items = [];
                    }
                    const totalChecked = items.filter((i: any) => i.checked).length;

                    return (
                      <div key={sop.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-900">
                            {sop.type === 'OPENING' ? '🌅 Opening Checklist' : '🌙 Closing Checklist'} • {sop.user?.name}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0052cc]">
                            {totalChecked}/{items.length} Selesai
                          </span>
                        </div>
                        {sop.notes && <p className="text-[11px] text-slate-500 italic">"{sop.notes}"</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Handover Serah Terima Shift */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <UserCheck size={16} className="text-indigo-600" />
                  <span>Log Serah Terima (Handover) Shift</span>
                </h3>
                <span className="text-xs font-bold text-slate-400">{handoverList.length} Catatan</span>
              </div>

              {handoverList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada catatan handover shift.
                </div>
              ) : (
                <div className="space-y-3">
                  {handoverList.slice(0, 10).map(ho => (
                    <div key={ho.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-black text-slate-900">
                        <span>{ho.shiftName}</span>
                        <span className="text-[10px] text-slate-400">{ho.date}</span>
                      </div>
                      <p className="text-slate-700 font-medium">"{ho.notes}"</p>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        <span>Staf: <strong>{ho.user?.name}</strong></span>
                        <span>Kas Laci: <strong>Rp {Number(ho.cashBalance).toLocaleString('id-ID')}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL ZOOM FOTO SELFIE */}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-100 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800">{selectedPhoto.title}</h4>
                <button onClick={() => setSelectedPhoto(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={16} />
                </button>
              </div>
              <img src={selectedPhoto.url} alt="Selfie Zoom" className="w-full rounded-2xl object-cover aspect-square border border-slate-200" />
            </div>
          </div>
        )}

        <ClockInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAttendances} />
      </div>
    </div>
  );
};

export default AttendanceView;
