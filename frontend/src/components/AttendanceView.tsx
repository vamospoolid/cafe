import React, { useState, useEffect, useContext } from 'react';
import { 
  UserCheck, Calendar, Clock, Download, CheckCircle2, Fingerprint, 
  FileText, MapPin, Camera, User, TrendingUp, AlertTriangle, 
  Eye, X, Search, RefreshCw, Smartphone, Check, Sparkles, Award, Edit3, Timer, Save
} from 'lucide-react';
import ClockInModal from './ClockInModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from '../utils/alert';
import { exportIndividualAppraisalPDF } from '../utils/pdfGenerator';

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
  cashierStats?: {
    totalShifts: number;
    closedShiftsCount: number;
    balancedShifts: number;
    cashAccuracyRate: number;
    totalShortage: number;
    totalOverage: number;
    totalSalesHandled: number;
    totalOrdersHandled: number;
    voidCount: number;
    voidAmount: number;
  };
  kitchenStats?: {
    totalLossIncidents: number;
    totalLossCost: number;
    humanErrorLossCost: number;
    spoilageLossCost: number;
  };
  kpi?: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D';
    label: string;
    attendanceScore: number;
    cashierScore: number;
    kitchenScore: number;
  };
  recentLogs: any[];
  recentShifts?: any[];
  recentLossLogs?: any[];
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

  // Modal Koreksi Presensi Staf (Admin / Owner only)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    clockInTime: '',
    clockOutTime: '',
    status: 'Hadir',
    lateMinutes: 0,
    notes: ''
  });
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [runningAutoCutoff, setRunningAutoCutoff] = useState(false);

  const posContext = useContext(POSContext);

  const handleOpenAdjustModal = (att: any) => {
    setEditingAttendance(att);
    const inTime = att.clockIn ? new Date(att.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':') : '09:00';
    const outTime = att.clockOut ? new Date(att.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':') : '22:00';
    
    setAdjustForm({
      clockInTime: inTime,
      clockOutTime: att.clockOut ? outTime : '',
      status: att.status || 'Hadir',
      lateMinutes: att.lateMinutes || 0,
      notes: att.notes || ''
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjust = async () => {
    if (!editingAttendance) return;
    setSavingAdjust(true);
    try {
      const dateBase = editingAttendance.date || getTodayStr();
      let newClockIn = editingAttendance.clockIn;
      if (adjustForm.clockInTime) {
        newClockIn = new Date(`${dateBase}T${adjustForm.clockInTime}:00`).toISOString();
      }
      let newClockOut = null;
      if (adjustForm.clockOutTime) {
        newClockOut = new Date(`${dateBase}T${adjustForm.clockOutTime}:00`).toISOString();
      }

      const res = await fetch(`/api/attendance/${editingAttendance.id}/adjust`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          clockIn: newClockIn,
          clockOut: newClockOut,
          status: adjustForm.status,
          lateMinutes: Number(adjustForm.lateMinutes) || 0,
          notes: adjustForm.notes
        })
      });

      if (res.ok) {
        toast('Presensi staf berhasil dikoreksi!', 'success');
        setIsAdjustModalOpen(false);
        setEditingAttendance(null);
        fetchAttendances();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengoreksi presensi', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan saat menyimpan koreksi', 'error');
    } finally {
      setSavingAdjust(false);
    }
  };

  const handleRunAutoCutoff = async () => {
    setRunningAutoCutoff(true);
    try {
      const res = await fetch('/api/attendance/auto-cutoff', {
        method: 'POST',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Auto Cut-off presensi selesai!', 'success');
        fetchAttendances();
      } else {
        toast(data.error || 'Gagal menjalankan auto cut-off', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan saat auto cut-off', 'error');
    } finally {
      setRunningAutoCutoff(false);
    }
  };

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

  const handleExportAppraisalPDF = async (s: IndividualSummary) => {
    try {
      await exportIndividualAppraisalPDF(
        posContext?.settings || {},
        s,
        monthFilter,
        (posContext?.user as any)?.name || (posContext?.user as any)?.username || 'Owner / Management'
      );
      toast(`Rapor Kinerja ${s.user.name} berhasil diunduh!`, 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengunduh rapor kinerja PDF', 'error');
    }
  };

  // Metrics for Tab 1 (Log Harian)
  const totalHadirToday = attendances.filter(a => a.status === 'Hadir' || a.status === 'Terlambat').length;
  const onTimeToday = attendances.filter(a => a.status === 'Hadir').length;
  const lateToday = attendances.filter(a => a.status === 'Terlambat').length;

  // Metrics for Tab 2 (Rekap Individu)
  const totalEmployeesSummary = summaries.length;
  const totalLateCountMonth = summaries.reduce((acc, s) => acc + (s.stats?.totalTerlambat || 0), 0);
  const totalWorkHoursMonth = summaries.reduce((acc, s) => acc + (s.stats?.totalWorkHours || 0), 0);

  // Role check: Only Admin can view attendance management dashboard
  if (posContext?.user && posContext.user.role !== 'Admin') {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center gap-3 min-h-[50vh]">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
          <UserCheck size={28} />
        </div>
        <h3 className="text-base font-bold text-slate-800">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 max-w-sm">Halaman Rekapitulasi &amp; Absensi SDM hanya dapat diakses oleh Admin atau Manajemen.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      {/* HEADER / ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <UserCheck className="text-primary" size={24} /> Absensi &amp; Rekapitulasi Staf
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Monitoring kehadiran real-time via GPS geofencing, foto selfie kamera, dan shift rolling</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <a
            href="/staff"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto btn bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shadow-sm flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Smartphone size={15} /> PWA Staf
          </a>

          <button
            className="w-full sm:w-auto btn btn-primary shadow-md hover:shadow-lg flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-95"
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

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleRunAutoCutoff}
                    disabled={runningAutoCutoff}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    title="Tutup otomatis presensi yang belum clock-out kemarin"
                  >
                    <Timer size={14} className="text-amber-600" />
                    {runningAutoCutoff ? 'Memproses...' : 'Auto Cut-off EOD'}
                  </button>
                  <button
                    onClick={exportDailyPDF}
                    className="flex-1 sm:flex-initial justify-center px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                  >
                    <FileText size={15} className="text-rose-500" /> Export PDF
                  </button>
                </div>
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

                        <div className="flex items-center gap-1.5">
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
                          <button
                            onClick={() => handleOpenAdjustModal(att)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                            title="Koreksi Jam / Status"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
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
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <RefreshCw size={24} className="animate-spin inline-block text-indigo-600 mb-2" />
                          <p>Memuat data absensi...</p>
                        </td>
                      </tr>
                    ) : attendances.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
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
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenAdjustModal(att)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 inline-flex items-center gap-1"
                              title="Koreksi Jam Masuk / Jam Pulang"
                            >
                              <Edit3 size={12} /> Koreksi
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
                  summaries.map(s => {
                    const grade = s.kpi?.grade || 'B';
                    const gradeBg = grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    grade === 'B' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                    grade === 'C' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
                    return (
                      <div key={s.user.id} className="p-3.5 space-y-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-slate-900 leading-tight">{s.user.name}</h4>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${gradeBg}`}>
                                KPI {s.kpi?.score || 80}/100 ({grade})
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold inline-block mt-1">
                              {s.user.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleExportAppraisalPDF(s)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                              title="Cetak Rapor Kinerja PDF"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              onClick={() => setSelectedUserSummary(s)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                            >
                              <Eye size={12} /> Detail
                            </button>
                          </div>
                        </div>

                        {/* Quick KPI Stats Summary */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Presensi</span>
                            <span className="font-bold text-slate-800">{s.stats.totalHadir} Hadir / {s.stats.totalTerlambat}x Telat</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Audit Finansial Kas</span>
                            {s.cashierStats && s.cashierStats.totalShifts > 0 ? (
                              <span className={`font-bold ${s.cashierStats.totalShortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {s.cashierStats.totalShortage > 0 ? `Tekor Rp ${s.cashierStats.totalShortage.toLocaleString()}` : `${s.cashierStats.cashAccuracyRate}% Pas`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">Non-Kasir</span>
                            )}
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
                            {s.kitchenStats && s.kitchenStats.totalLossIncidents > 0 && (
                              <div className="text-[10px] text-amber-600 font-bold">
                                🍳 Loss Dapur: Rp {s.kitchenStats.totalLossCost.toLocaleString()}
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-bold">Estimasi Bersih HR</span>
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
                    );
                  })
                )}
              </div>

              {/* Desktop Table (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Nama Karyawan</th>
                      <th className="py-3.5 px-4">Posisi</th>
                      <th className="py-3.5 px-4 text-center">Skor KPI</th>
                      <th className="py-3.5 px-4 text-center">Presensi</th>
                      <th className="py-3.5 px-4 text-center">Akurasi Kasir</th>
                      <th className="py-3.5 px-4 text-center">Loss Dapur</th>
                      <th className="py-3.5 px-4 text-center">Bonus / Denda HR</th>
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
                      summaries.map(s => {
                        const grade = s.kpi?.grade || 'B';
                        const gradeBg = grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        grade === 'B' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                        grade === 'C' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';
                        return (
                          <tr key={s.user.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-black text-slate-800">
                              <div>{s.user.name}</div>
                              <span className="text-[10px] text-slate-400 font-medium">@{s.user.username}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                                {s.user.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${gradeBg}`}>
                                {s.kpi?.score || 80}/100 ({grade})
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="font-bold text-emerald-600">{s.stats.totalHadir} Hari</div>
                              {s.stats.totalTerlambat > 0 && (
                                <span className="text-[10px] text-rose-500 font-bold block">
                                  {s.stats.totalTerlambat}x telat ({s.stats.totalLateMinutes}m)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {s.cashierStats && s.cashierStats.totalShifts > 0 ? (
                                <div>
                                  <span className={`font-black text-xs ${s.cashierStats.totalShortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {s.cashierStats.cashAccuracyRate}% Akurat
                                  </span>
                                  {s.cashierStats.totalShortage > 0 && (
                                    <span className="text-[10px] text-rose-600 font-bold block">
                                      Tekor: -Rp {s.cashierStats.totalShortage.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {s.kitchenStats && s.kitchenStats.totalLossIncidents > 0 ? (
                                <div>
                                  <span className="font-bold text-xs text-rose-600">
                                    Rp {s.kitchenStats.totalLossCost.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-medium">
                                    {s.kitchenStats.totalLossIncidents} insiden
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">-</span>
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
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleExportAppraisalPDF(s)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                                  title="Unduh Rapor Evaluasi Kinerja (PDF)"
                                >
                                  <FileText size={14} />
                                </button>
                                <button
                                  onClick={() => setSelectedUserSummary(s)}
                                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <Eye size={13} /> Rincian
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
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
            <div className="bg-white w-full h-full md:h-auto md:max-w-3xl md:rounded-3xl shadow-2xl flex flex-col md:overflow-hidden max-h-screen md:max-h-[90vh] animate-in fade-in duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                    <User size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                        {selectedUserSummary.user.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                        {selectedUserSummary.user.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Periode Evaluasi: {monthFilter}</p>
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
              <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto pb-28 md:pb-6">
                {/* SCORECARD KPI HEADER BANNER */}
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-5 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider block">Indeks Kinerja Karyawan (KPI)</span>
                    <h2 className="text-2xl sm:text-3xl font-black mt-0.5 flex items-center gap-2">
                      <span>{selectedUserSummary.kpi?.score || 80} / 100</span>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white/20 text-white">
                        GRADE {selectedUserSummary.kpi?.grade || 'B'}
                      </span>
                    </h2>
                    <p className="text-xs text-indigo-200 mt-1">
                      {selectedUserSummary.kpi?.label || 'Kinerja Baik & Disiplin'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleExportAppraisalPDF(selectedUserSummary)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
                  >
                    <FileText size={15} /> Cetak Rapor PDF
                  </button>
                </div>

                {/* 3 PILAR EVALUASI KINERJA */}
                <div className="space-y-4">
                  {/* PILAR 1: PRESENSI & DISIPLIN KERJA */}
                  <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                      <Clock size={16} className="text-indigo-600" />
                      1. Pilar Kedisiplinan & Presensi HR
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Hadir</span>
                        <span className="text-base font-black text-emerald-700">{selectedUserSummary.stats.totalHadir} Hari</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Terlambat</span>
                        <span className={`text-base font-black ${selectedUserSummary.stats.totalTerlambat > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {selectedUserSummary.stats.totalTerlambat} Kali
                        </span>
                        <span className="text-[10px] text-slate-400 block">({selectedUserSummary.stats.totalLateMinutes} menit)</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Jam Kerja</span>
                        <span className="text-base font-black text-indigo-700">{selectedUserSummary.stats.totalWorkHours} Jam</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Reward Zero Late</span>
                        <span className={`text-xs font-black ${selectedUserSummary.discipline?.zeroLateStatus === 'ELIGIBLE' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {selectedUserSummary.discipline?.zeroLateStatus === 'ELIGIBLE' ? `+Rp ${(selectedUserSummary.discipline.zeroLateBonusEarned || 0).toLocaleString()}` : 'Tidak Dapat'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PILAR 2: KINERJA & AKURASI FINANSIAL KASIR */}
                  <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                      <Fingerprint size={16} className="text-emerald-600" />
                      2. Pilar Integritas & Akurasi Finansial Kasir
                    </h4>
                    {selectedUserSummary.cashierStats && selectedUserSummary.cashierStats.totalShifts > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Shift Dijalankan</span>
                          <span className="text-base font-black text-slate-900">
                            {selectedUserSummary.cashierStats.totalShifts} Shift
                          </span>
                          <span className="text-[10px] text-slate-400 block">({selectedUserSummary.cashierStats.closedShiftsCount} ditutup)</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Akurasi Kas Laci</span>
                          <span className={`text-base font-black ${selectedUserSummary.cashierStats.cashAccuracyRate >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {selectedUserSummary.cashierStats.cashAccuracyRate}% Pas
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Uang Tekor (Minus)</span>
                          <span className={`text-sm font-black ${selectedUserSummary.cashierStats.totalShortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {selectedUserSummary.cashierStats.totalShortage > 0 ? `-Rp ${selectedUserSummary.cashierStats.totalShortage.toLocaleString()}` : 'Rp 0 (Aman)'}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Omzet Ditangani</span>
                          <span className="text-sm font-black text-indigo-700">
                            Rp {selectedUserSummary.cashierStats.totalSalesHandled.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block">({selectedUserSummary.cashierStats.totalOrdersHandled} orders)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-xl border border-slate-100 text-center text-xs text-slate-400">
                        Karyawan ini tidak menjalankan shift kasir pada periode ini.
                      </div>
                    )}
                  </div>

                  {/* PILAR 3: EFISIENSI & STOCK LOSS DAPUR */}
                  <div className="p-4.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp size={16} className="text-rose-600" />
                      3. Pilar Pengendalian Stock Loss & Dapur
                    </h4>
                    {selectedUserSummary.kitchenStats && selectedUserSummary.kitchenStats.totalLossIncidents > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Insiden Kerusakan</span>
                          <span className="text-base font-black text-rose-600">
                            {selectedUserSummary.kitchenStats.totalLossIncidents} Kali
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Valuasi Rugi</span>
                          <span className="text-base font-black text-rose-700">
                            Rp {selectedUserSummary.kitchenStats.totalLossCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Loss Human Error</span>
                          <span className="text-sm font-black text-amber-700">
                            Rp {selectedUserSummary.kitchenStats.humanErrorLossCost.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block">(Gosong / Salah Resep / Tumpah)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-xl border border-slate-100 text-center text-xs text-slate-400">
                        Tidak ada catatan insiden stock loss / waste dapur untuk karyawan ini. 🎉
                      </div>
                    )}
                  </div>
                </div>

                {/* LOGS LIST WITH PHOTOS */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-black text-slate-800">Riwayat Presensi Foto Selfie:</h4>
                  <div className="space-y-2.5 divide-y divide-slate-100 max-h-48 overflow-y-auto">
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
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportAppraisalPDF(selectedUserSummary)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <FileText size={15} /> Cetak Rapor PDF
                </button>
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

        {/* MODAL KOREKSI PRESENSI STAF (ADMIN / OWNER) */}
        {isAdjustModalOpen && editingAttendance && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">Koreksi Presensi Karyawan</h4>
                    <p className="text-[11px] text-slate-500">{editingAttendance.user?.name} • Tanggal {editingAttendance.date}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Jam Masuk (Clock In)</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 outline-none focus:border-indigo-500"
                      value={adjustForm.clockInTime}
                      onChange={e => setAdjustForm({ ...adjustForm, clockInTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Jam Pulang (Clock Out)</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 outline-none focus:border-indigo-500"
                      value={adjustForm.clockOutTime}
                      onChange={e => setAdjustForm({ ...adjustForm, clockOutTime: e.target.value })}
                      placeholder="--:--"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Status Kehadiran</label>
                    <select
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 outline-none focus:border-indigo-500"
                      value={adjustForm.status}
                      onChange={e => setAdjustForm({ ...adjustForm, status: e.target.value })}
                    >
                      <option value="Hadir">Hadir (Tepat Waktu)</option>
                      <option value="Terlambat">Terlambat</option>
                      <option value="Izin">Izin</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Cuti">Cuti</option>
                      <option value="Libur">Libur</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Menit Keterlambatan</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 outline-none focus:border-indigo-500"
                      value={adjustForm.lateMinutes}
                      onChange={e => setAdjustForm({ ...adjustForm, lateMinutes: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Catatan / Alasan Koreksi</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-900 outline-none focus:border-indigo-500 resize-none text-xs"
                    placeholder="Contoh: Lupa absen pulang, staf pulang jam 22:15 dikonfirmasi supervisor."
                    value={adjustForm.notes}
                    onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingAdjust}
                  onClick={handleSaveAdjust}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {savingAdjust ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ClockInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAttendances} />
      </div>
  );
};

export default AttendanceView;
