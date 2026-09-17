import React, { useState, useEffect, useContext } from 'react';
import { 
  Video, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  Play, 
  FileText, 
  ExternalLink, 
  Sparkles,
  BookOpen,
  Users,
  Award,
  AlertCircle
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface LiveSession {
  id: number;
  batchId: number;
  sessionId: number;
  instructorId: number;
  scheduledAt: string;
  durationMin: number;
  meetingUrl?: string;
  meetingPass?: string;
  recordingUrl?: string;
  status: string;
  actualStartAt?: string;
  actualEndAt?: string;
  tutorNotes?: string;
  feeCalculated?: number;
  batch?: { id: number; name: string; course?: { title: string } };
  session?: { id: number; title: string; subject?: { name: string } };
  instructor?: { id: number; name: string };
}

interface TutorRecap {
  tutorId: number;
  totalSessions: number;
  totalMinutes: number;
  totalHours: string;
  totalFees: number;
  sessions: LiveSession[];
}

export const TutorPortalView: React.FC = () => {
  const posContext = useContext(POSContext);
  const currentUserId = (posContext?.user as any)?.id || 1;
  const currentUserName = (posContext?.user as any)?.name || 'Tutor / Mentor';

  const [activeTab, setActiveTab] = useState<'schedule' | 'recap'>('schedule');
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [recapData, setRecapData] = useState<TutorRecap | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal Selesaikan Sesi
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [tutorNotes, setTutorNotes] = useState('');

  const fetchTutorSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/live-sessions?instructorId=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        setLiveSessions(data);
      }

      const recapRes = await fetch(`/api/live-sessions/tutor/${currentUserId}/recap`);
      if (recapRes.ok) {
        const recap = await recapRes.json();
        setRecapData(recap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutorSessions();
  }, [currentUserId]);

  const handleStartSession = async (id: number, meetingUrl?: string) => {
    try {
      await fetch(`/api/live-sessions/${id}/start`, { method: 'PUT' });
      fetchTutorSessions();
      if (meetingUrl) {
        window.open(meetingUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    try {
      const res = await fetch(`/api/live-sessions/${selectedSession.id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingUrl, tutorNotes }),
      });
      if (res.ok) {
        setCompleteModalOpen(false);
        setRecordingUrl('');
        setTutorNotes('');
        setSelectedSession(null);
        fetchTutorSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Tutor Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full border border-indigo-400/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-400" /> Portal Pengajar & Mentor
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Selamat Datang, {currentUserName}</h1>
          <p className="text-slate-300 text-sm mt-1">Kelola sesi live class interaktif, input rekaman siaran ulang, dan pantau rekap honorarium mengajar Anda.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" /> Agenda Mengajar ({liveSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'recap'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Rekap Fee & Kinerja
          </button>
        </div>
      </div>

      {/* Summary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Sesi Selesai</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {recapData?.totalSessions || 0} Sesi
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Jam Mengajar</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {recapData?.totalHours || '0.0'} Jam
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Akumulasi Honorarium</p>
            <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              Rp {(recapData?.totalFees || 0).toLocaleString('id-ID')}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Status Pengajar</p>
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
              <Award className="w-4 h-4" /> Lead Tutor Aktif
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tab Content 1: Agenda Live Mengajar */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Jadwal Sesi Live Class & Bimbingan
            </h2>
          </div>

          {liveSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveSessions.map((session) => {
                const isCompleted = session.status === 'COMPLETED';
                const isLive = session.status === 'LIVE';

                return (
                  <div
                    key={session.id}
                    className={`rounded-2xl p-5 border transition-all ${
                      isLive
                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-700 shadow-md ring-2 ring-red-400/30'
                        : isCompleted
                        ? 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-90'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              isLive
                                ? 'bg-red-500 text-white animate-pulse'
                                : isCompleted
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            }`}
                          >
                            {session.status}
                          </span>
                          <span className="text-xs text-slate-400">
                            {session.batch?.course?.title || 'Program Bimbel'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mt-1.5">
                          {session.session?.title || 'Sesi Live Class'}
                        </h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          {session.batch?.name} • {session.session?.subject?.name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(session.scheduledAt).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Estimasi: {session.durationMin} Menit</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {!isCompleted ? (
                        <div className="flex items-center gap-2 w-full">
                          <button
                            onClick={() => handleStartSession(session.id, session.meetingUrl)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow"
                          >
                            <Play className="w-3.5 h-3.5" /> Masuk Ruang Kelas Live
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSession(session);
                              setCompleteModalOpen(true);
                            }}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Selesaikan
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Sesi Selesai (Honor: Rp {(session.feeCalculated || 0).toLocaleString('id-ID')})
                          </span>
                          {session.recordingUrl && (
                            <a
                              href={session.recordingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <Video className="w-3.5 h-3.5" /> Rekaman <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">Belum ada sesi live class yang ditugaskan kepada Anda saat ini.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Rekapitulasi Honor & Fee */}
      {activeTab === 'recap' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Rincian Transparansi Honorarium Mengajar
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Kalkulasi otomatis berbasis durasi KBM aktual
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3 px-4 font-semibold">Tanggal / Sesi</th>
                  <th className="py-3 px-4 font-semibold">Program & Batch</th>
                  <th className="py-3 px-4 font-semibold">Durasi</th>
                  <th className="py-3 px-4 font-semibold">Catatan Evaluasi</th>
                  <th className="py-3 px-4 font-semibold text-right">Fee Terhitung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recapData?.sessions && recapData.sessions.length > 0 ? (
                  recapData.sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {sess.session?.title}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(sess.scheduledAt).toLocaleDateString('id-ID')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-700 dark:text-slate-300 block">{sess.batch?.course?.title}</span>
                        <span className="text-[11px] text-slate-400">{sess.batch?.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {sess.durationMin} Menit
                      </td>
                      <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                        {sess.tutorNotes || 'Tidak ada catatan'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Rp {(sess.feeCalculated || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada riwayat sesi mengajar yang selesai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Selesaikan Sesi & Input Rekaman */}
      {completeModalOpen && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2">Selesaikan Sesi Mengajar</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedSession.session?.title} - {selectedSession.batch?.name}</p>

            <form onSubmit={handleCompleteSession} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">URL Rekaman Siaran Ulang (VOD / Cloud Recording)</label>
                <input
                  type="url"
                  placeholder="https://zoom.us/rec/... atau YouTube Unlisted"
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan Evaluasi / PR Siswa</label>
                <textarea
                  rows={3}
                  placeholder="Catatan ketercapaian materi atau materi yang perlu diulang pada pertemuan berikutnya..."
                  value={tutorNotes}
                  onChange={(e) => setTutorNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Menyelesaikan sesi ini akan otomatis menghitung honorarium mengajar Anda sesuai durasi sesi.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Konfirmasi Selesai & Klaim Fee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorPortalView;
