import React, { useState, useEffect, useContext } from 'react';
import { 
  BookOpen, 
  Play, 
  FileText, 
  CheckCircle2, 
  Circle, 
  Video, 
  Award, 
  ExternalLink, 
  Sparkles, 
  Layers, 
  Calendar, 
  Clock, 
  ChevronRight,
  ArrowRight,
  Check
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface SessionProgress {
  isPdfRead: boolean;
  isVideoDone: boolean;
  quizScore: number | null;
  isCompleted: boolean;
}

interface Session {
  id: number;
  title: string;
  description?: string;
  orderIndex: number;
  handoutPdfUrl?: string;
  vodVideoUrl?: string;
  vodDurationSec?: number;
  quizUrl?: string;
  minPassingScore?: number;
  progress?: SessionProgress;
}

interface Subject {
  id: number;
  name: string;
  description?: string;
  orderIndex: number;
  sessions: Session[];
}

interface CourseProgress {
  courseId: number;
  studentId: number;
  totalSessions: number;
  completedCount: number;
  percentage: number;
  subjects: Subject[];
}

interface Course {
  id: number;
  code: string;
  title: string;
  description?: string;
}

export const StudentLearningView: React.FC = () => {
  const posContext = useContext(POSContext);
  const currentUserId = (posContext?.user as any)?.id || 2; // fallback student id
  const currentUserName = (posContext?.user as any)?.name || 'Siswa Bimbel';

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseData, setCourseData] = useState<CourseProgress | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  // Ambil daftar kursus
  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0 && !selectedCourseId) {
          setSelectedCourseId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Ambil progres & silabus belajar kursus
  const fetchCourseProgress = async (cId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/progress/course/${cId}/student/${currentUserId}`);
      if (res.ok) {
        const data: CourseProgress = await res.json();
        setCourseData(data);

        // Set default active session jika belum terpilih
        if (data.subjects && data.subjects.length > 0) {
          const firstSub = data.subjects[0];
          if (firstSub.sessions && firstSub.sessions.length > 0) {
            setActiveSession(firstSub.sessions[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseProgress(selectedCourseId);
    }
  }, [selectedCourseId, currentUserId]);

  const handleToggleProgress = async (field: 'isPdfRead' | 'isVideoDone' | 'isCompleted') => {
    if (!activeSession || !selectedCourseId) return;
    const currentProg = activeSession.progress || { isPdfRead: false, isVideoDone: false, isCompleted: false, quizScore: null };
    const newValue = !currentProg[field];

    try {
      const res = await fetch('/api/progress/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUserId,
          sessionId: activeSession.id,
          [field]: newValue,
        }),
      });
      if (res.ok) {
        fetchCourseProgress(selectedCourseId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Convert regular YouTube URL to embed URL
  const getEmbedVideoUrl = (url?: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    if (url.includes('youtu.be/')) {
      return url.replace('youtu.be/', 'youtube.com/embed/');
    }
    return url;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Banner: Progress Bar & Selector */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-0.5 bg-indigo-500/30 text-indigo-200 text-xs font-semibold rounded-full border border-indigo-400/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-yellow-300" /> Ruang Belajar & Modul Siswa
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Halo, {currentUserName}! 👋</h1>
            <p className="text-indigo-200 text-xs md:text-sm mt-1">Lanjutkan modul materi ajar dan selesaikan kuis untuk mencapai kelulusan target Anda.</p>
          </div>

          {/* Course Selector Dropdown */}
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-300" />
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(parseInt(e.target.value))}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id} className="text-slate-900">
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Progress Bar */}
        {courseData && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center text-xs font-semibold text-indigo-200 mb-1.5">
              <span>Progres Kelulusan Silabus</span>
              <span>{courseData.percentage}% ({courseData.completedCount} / {courseData.totalSessions} Sesi Selesai)</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${courseData.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Course Player Grid (Sidebar Silabus + Area Belajar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Syllabus Tree (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" /> Silabus Pembelajaran
            </h3>

            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
              {courseData?.subjects && courseData.subjects.length > 0 ? (
                courseData.subjects.map((sub, sIdx) => (
                  <div key={sub.id} className="space-y-1.5">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="truncate">{sub.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sub.sessions.filter(s => s.progress?.isCompleted).length}/{sub.sessions.length}
                      </span>
                    </div>

                    <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-slate-700 ml-2">
                      {sub.sessions.map((sess) => {
                        const isSelected = activeSession?.id === sess.id;
                        const isDone = sess.progress?.isCompleted;

                        return (
                          <div
                            key={sess.id}
                            onClick={() => setActiveSession(sess)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-2.5 ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-300 dark:border-indigo-700 shadow-xs'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="mt-0.5">
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-xs font-medium leading-snug line-clamp-2 ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''}`}>
                                {sess.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                {sess.vodVideoUrl && <span className="flex items-center gap-0.5"><Video className="w-2.5 h-2.5" /> Video</span>}
                                {sess.handoutPdfUrl && <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /> PDF</span>}
                                {sess.quizUrl && <span className="flex items-center gap-0.5"><Award className="w-2.5 h-2.5" /> Kuis</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">Belum ada silabus materi pada kursus ini.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Learning Material Viewer (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {activeSession ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              {/* Header Sesi */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Sesi Pembelajaran Aktif
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                      {activeSession.title}
                    </h2>
                    {activeSession.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {activeSession.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleProgress('isCompleted')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                      activeSession.progress?.isCompleted
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {activeSession.progress?.isCompleted ? (
                      <>
                        <Check className="w-4 h-4" /> Selesai Dipelajari
                      </>
                    ) : (
                      'Tandai Selesai'
                    )}
                  </button>
                </div>
              </div>

              {/* Video VOD Embed Player */}
              {activeSession.vodVideoUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-blue-500" /> Video Pembahasan Konsep
                    </h3>
                    <button
                      onClick={() => handleToggleProgress('isVideoDone')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                        activeSession.progress?.isVideoDone
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {activeSession.progress?.isVideoDone ? '✓ Video Selesai Ditonton' : 'Tandai Selesai Menonton'}
                    </button>
                  </div>

                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-md border border-slate-200 dark:border-slate-800">
                    <iframe
                      src={getEmbedVideoUrl(activeSession.vodVideoUrl) || ''}
                      title={activeSession.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Handout PDF Card */}
              {activeSession.handoutPdfUrl && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-200/60 dark:border-red-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">E-Book & Handout Ringkasan Rumus</h4>
                      <p className="text-xs text-slate-500">Materi pegangan siswa dan ringkasan rumus cepat.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleProgress('isPdfRead')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        activeSession.progress?.isPdfRead
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {activeSession.progress?.isPdfRead ? '✓ Sudah Dibaca' : 'Tandai Dibaca'}
                    </button>
                    <a
                      href={activeSession.handoutPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      Buka PDF <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* CBT Quiz Section */}
              {activeSession.quizUrl && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Latihan Soal & Kuis CBT Topikal</h4>
                      <p className="text-xs text-slate-500">
                        Target skor kelulusan: <span className="font-bold">{activeSession.minPassingScore || 70}</span> | Skor Anda saat ini:{' '}
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {activeSession.progress?.quizScore !== null && activeSession.progress?.quizScore !== undefined
                            ? activeSession.progress.quizScore
                            : 'Belum Dikerjakan'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <a
                    href={activeSession.quizUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
                  >
                    Mulai Kerjakan Kuis <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800 shadow-sm">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">Pilih sesi materi pada silabus di sebelah kiri untuk mulai belajar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentLearningView;
