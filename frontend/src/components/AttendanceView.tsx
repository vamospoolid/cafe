import React, { useState, useEffect, useContext } from 'react';
import { 
  UserCheck, Calendar, Clock, Download, CheckCircle, Fingerprint, 
  FileText, MapPin, Camera, User, TrendingUp, AlertTriangle, 
  Eye, X, Search, RefreshCw, Smartphone, Check, Sparkles
} from 'lucide-react';
import ClockInModal from './ClockInModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [activeTab, setActiveTab] = useState<'daily' | 'individual'>('daily');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<IndividualSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7); // YYYY-MM
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

  useEffect(() => {
    if (posContext?.token) {
      if (activeTab === 'daily') fetchAttendances();
      else fetchIndividualSummaries();
    }
  }, [posContext?.token, dateFilter, monthFilter, activeTab]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (inTime: string, outTime?: string) => {
    if (!outTime) return '-';
    const start = new Date(inTime).getTime();
    const end = new Date(outTime).getTime();
    const diffHours = (end - start) / (1000 * 60 * 60);
    return `${diffHours.toFixed(1)} Jam`;
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

  return (
    <div className="h-full flex-1 overflow-y-auto w-full bg-slate-50/50">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto pb-24">
        {/* HEADER UTAMA */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserCheck size={26} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Absensi & Rekapitulasi Karyawan
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                Monitoring kehadiran real-time via GPS geofencing, foto selfie kamera, dan shift rolling.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href="/staff"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Smartphone size={15} /> Buka PWA Staf & Dapur
            </a>

            <button
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <Fingerprint size={16} /> Terminal Absensi (Mesin)
            </button>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'daily'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={15} />
            <span>Log Harian Absensi</span>
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'individual'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User size={15} />
            <span>Rekapitulasi Individu Karyawan</span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: LOG HARIAN ABSENSI
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'daily' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-slate-400" />
                <input
                  type="date"
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                />
              </div>

              <button
                onClick={exportDailyPDF}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <FileText size={15} className="text-rose-500" /> Export PDF Harian
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Foto Selfie</th>
                    <th className="py-3.5 px-4">Nama Karyawan & Role</th>
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
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: REKAPITULASI INDIVIDU KARYAWAN
            ───────────────────────────────────────────────────────────── */}
        {activeTab === 'individual' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Filter Periode Bulan:</span>
                <input
                  type="month"
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                />
              </div>

              <button
                onClick={exportSummaryPDF}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <FileText size={15} className="text-rose-500" /> Export Rekapitulasi PDF
              </button>
            </div>

            <div className="overflow-x-auto">
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
        )}

        {/* MODAL ZOOM FOTO SELFIE */}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-100 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800">{selectedPhoto.title}</h4>
                <button onClick={() => setSelectedPhoto(null)} className="text-slate-400 p-1">
                  <X size={16} />
                </button>
              </div>
              <img src={selectedPhoto.url} alt="Selfie Zoom" className="w-full rounded-2xl object-cover aspect-square border border-slate-200" />
            </div>
          </div>
        )}

        {/* MODAL DETAIL REKAP INDIVIDU KARYAWAN */}
        {selectedUserSummary && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-100 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Rekap Absensi: {selectedUserSummary.user.name} ({selectedUserSummary.user.role})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Periode Bulan: {monthFilter}</p>
                </div>
                <button onClick={() => setSelectedUserSummary(null)} className="text-slate-400 p-1">
                  <X size={18} />
                </button>
              </div>

              {/* STATS TILES */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Total Hadir</p>
                  <h4 className="text-lg font-black text-emerald-800 mt-0.5">{selectedUserSummary.stats.totalHadir} Hari</h4>
                </div>
                <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-100 text-center">
                  <p className="text-[10px] font-bold text-rose-600 uppercase">Terlambat</p>
                  <h4 className="text-lg font-black text-rose-800 mt-0.5">{selectedUserSummary.stats.totalTerlambat} Kali ({selectedUserSummary.stats.totalLateMinutes} mnt)</h4>
                </div>
                <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-100 text-center">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase">Jam Kerja</p>
                  <h4 className="text-lg font-black text-indigo-800 mt-0.5">{selectedUserSummary.stats.totalWorkHours} Jam</h4>
                </div>
              </div>

              {/* REWARD & PUNISHMENT BREAKDOWN TILE */}
              {selectedUserSummary.discipline && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" /> Rincian Reward & Punishment Kedisiplinan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Bonus Zero Late</p>
                      <p className={`font-black mt-1 ${
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
                      <p className="font-black text-rose-600 mt-1">
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
          </div>
        )}

        <ClockInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAttendances} />
      </div>
    </div>
  );
};

export default AttendanceView;
