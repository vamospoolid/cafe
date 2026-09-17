import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Layers, 
  Calendar, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Video, 
  FileText, 
  Award, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  ExternalLink,
  DollarSign,
  Search,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

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
}

interface Subject {
  id: number;
  name: string;
  description?: string;
  orderIndex: number;
  sessions: Session[];
}

interface Instructor {
  id: number;
  name: string;
  role: string;
  username: string;
}

interface BatchInstructor {
  id: number;
  instructorId: number;
  role: string;
  hourlyRate: number;
  instructor: Instructor;
}

interface LiveSession {
  id: number;
  sessionId: number;
  instructorId: number;
  scheduledAt: string;
  durationMin: number;
  meetingUrl?: string;
  meetingPass?: string;
  status: string;
  session?: { title: string };
  instructor?: { name: string };
}

interface Batch {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  maxStudents: number;
  status: string;
  instructors: BatchInstructor[];
  liveSessions?: LiveSession[];
  _count?: { liveSessions: number };
}

interface Course {
  id: number;
  code: string;
  title: string;
  category: string;
  description?: string;
  price: number;
  status: string;
  subjects?: Subject[];
  batches?: Batch[];
  _count?: { subjects: number; batches: number };
}

export const CourseManagementView: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'syllabus' | 'batches' | 'courses'>('courses');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAssignTutorModal, setShowAssignTutorModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Form States
  const [courseForm, setCourseForm] = useState({ code: '', title: '', category: 'BIMBEL', description: '', price: 0, status: 'ACTIVE' });
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', orderIndex: 1 });
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    orderIndex: 1,
    handoutPdfUrl: '',
    vodVideoUrl: '',
    vodDurationSec: 3600,
    quizUrl: '',
    minPassingScore: 70
  });
  const [batchForm, setBatchForm] = useState({ name: '', startDate: '', endDate: '', maxStudents: 50, status: 'OPEN' });
  const [tutorForm, setTutorForm] = useState({ instructorId: '', role: 'LEAD_INSTRUCTOR', hourlyRate: 150000 });
  const [availableUsers, setAvailableUsers] = useState<Instructor[]>([]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
        if (data.length > 0 && !selectedCourse) {
          fetchCourseDetail(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/courses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCourse(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchUsers();
  }, []);

  // Save Course
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseForm),
      });
      if (res.ok) {
        setShowCourseModal(false);
        setCourseForm({ code: '', title: '', category: 'BIMBEL', description: '', price: 0, status: 'ACTIVE' });
        fetchCourses();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Subject
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/courses/${selectedCourse.id}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subjectForm),
      });
      if (res.ok) {
        setShowSubjectModal(false);
        setSubjectForm({ name: '', description: '', orderIndex: 1 });
        fetchCourseDetail(selectedCourse.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Session
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedCourse) return;
    try {
      const res = await fetch(`/api/courses/subjects/${selectedSubjectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionForm),
      });
      if (res.ok) {
        setShowSessionModal(false);
        setSessionForm({
          title: '',
          description: '',
          orderIndex: 1,
          handoutPdfUrl: '',
          vodVideoUrl: '',
          vodDurationSec: 3600,
          quizUrl: '',
          minPassingScore: 70
        });
        fetchCourseDetail(selectedCourse.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...batchForm, courseId: selectedCourse.id }),
      });
      if (res.ok) {
        setShowBatchModal(false);
        setBatchForm({ name: '', startDate: '', endDate: '', maxStudents: 50, status: 'OPEN' });
        fetchCourseDetail(selectedCourse.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Assign Tutor to Batch
  const handleAssignTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !selectedCourse) return;
    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/instructors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tutorForm),
      });
      if (res.ok) {
        setShowAssignTutorModal(false);
        fetchCourseDetail(selectedCourse.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-indigo-700/50">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-500/30 text-blue-200 text-xs font-semibold rounded-full border border-blue-400/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-300" /> Kurikulum & Akademik
            </span>
            <span className="px-3 py-1 bg-emerald-500/30 text-emerald-200 text-xs font-semibold rounded-full border border-emerald-400/30">
              Bimbel / Course / Bootcamp
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Materi Ajar & Penugasan Pengajar</h1>
          <p className="text-indigo-200 text-sm mt-1">Kelola silabus mapel, video VOD, modul PDF, angkatan batch, dan tarif honor tutor.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCourseModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg font-medium text-sm flex items-center gap-2 transition-all transform hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Tambah Paket Kursus
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar Course List & Content Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Course Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cari program kursus / kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredCourses.map((c) => {
                const isSelected = selectedCourse?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => fetchCourseDetail(c.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          {c.code}
                        </span>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mt-0.5 line-clamp-1">
                          {c.title}
                        </h3>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                        {c.category}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                      <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        Rp {c.price.toLocaleString('id-ID')}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {c._count?.subjects || 0} Mapel</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c._count?.batches || 0} Batch</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Detail & Silabus Management (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedCourse ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Course Title Header & Tabs */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        {selectedCourse.code}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                        {selectedCourse.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {selectedCourse.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedCourse.description || 'Tidak ada deskripsi kursus.'}
                    </p>
                  </div>

                  {/* Tab Pill Buttons */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveTab('syllabus')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        activeTab === 'syllabus'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Silabus & Materi
                    </button>
                    <button
                      onClick={() => setActiveTab('batches')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        activeTab === 'batches'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Batch & Tutor ({selectedCourse.batches?.length || 0})
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab 1: Silabus & Modul Ajar */}
              {activeTab === 'syllabus' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Daftar Mata Pelajaran / Silabus ({selectedCourse.subjects?.length || 0})
                    </h3>
                    <button
                      onClick={() => setShowSubjectModal(true)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Mapel
                    </button>
                  </div>

                  {selectedCourse.subjects && selectedCourse.subjects.length > 0 ? (
                    <div className="space-y-4">
                      {selectedCourse.subjects.map((subject, idx) => (
                        <div
                          key={subject.id}
                          className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-800/30 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                  {subject.name}
                                </h4>
                                {subject.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {subject.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedSubjectId(subject.id);
                                setShowSessionModal(true);
                              }}
                              className="px-2.5 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 flex items-center gap-1 shadow-sm"
                            >
                              <Plus className="w-3 h-3 text-indigo-500" /> Tambah Sesi
                            </button>
                          </div>

                          {/* Sessions List */}
                          <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                            {subject.sessions && subject.sessions.length > 0 ? (
                              subject.sessions.map((sess, sIdx) => (
                                <div
                                  key={sess.id}
                                  className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className="text-xs font-bold text-slate-400 mt-0.5">#{sIdx + 1}</span>
                                    <div>
                                      <h5 className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                                        {sess.title}
                                      </h5>
                                      {sess.description && (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                          {sess.description}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        {sess.handoutPdfUrl && (
                                          <a
                                            href={sess.handoutPdfUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/50"
                                          >
                                            <FileText className="w-3 h-3" /> PDF Handout
                                          </a>
                                        )}
                                        {sess.vodVideoUrl && (
                                          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                                            <Video className="w-3 h-3" /> Video VOD ({sess.vodDurationSec ? `${Math.round(sess.vodDurationSec / 60)}m` : 'VOD'})
                                          </span>
                                        )}
                                        {sess.quizUrl && (
                                          <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900/50">
                                            <Award className="w-3 h-3" /> Kuis CBT (Pass: {sess.minPassingScore || 70})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic py-1">Belum ada sesi materi ditambahkan.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Belum ada mata pelajaran. Klik tombol "Tambah Mapel" di atas.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Batch & Penugasan Pengajar */}
              {activeTab === 'batches' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      Daftar Angkatan / Batch ({selectedCourse.batches?.length || 0})
                    </h3>
                    <button
                      onClick={() => setShowBatchModal(true)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Buka Batch Baru
                    </button>
                  </div>

                  {selectedCourse.batches && selectedCourse.batches.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCourse.batches.map((batch) => (
                        <div
                          key={batch.id}
                          className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-800/40 shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                                {batch.status}
                              </span>
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1.5">
                                {batch.name}
                              </h4>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" /> {new Date(batch.startDate).toLocaleDateString('id-ID')} - {new Date(batch.endDate).toLocaleDateString('id-ID')}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedBatchId(batch.id);
                                setShowAssignTutorModal(true);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Tugaskan Tutor
                            </button>
                          </div>

                          {/* Tutor List */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Tenaga Pengajar Pengampu:
                            </span>
                            {batch.instructors && batch.instructors.length > 0 ? (
                              batch.instructors.map((ins) => (
                                <div
                                  key={ins.id}
                                  className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-xs border border-slate-200/60 dark:border-slate-700/60"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {ins.instructor.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 ml-1.5">({ins.role})</span>
                                  </div>
                                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    Rp {ins.hourlyRate.toLocaleString('id-ID')}/jam
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">Belum ada tutor ditugaskan.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Belum ada batch angkatan. Klik tombol "Buka Batch Baru" di atas.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800 shadow-sm">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-sm">Pilih program kursus di sebelah kiri untuk melihat silabus materi dan batch.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tambah Course */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Tambah Paket Program Kursus</h3>
            <form onSubmit={handleSaveCourse} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kode Kursus</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SNBT-2027"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Judul Kursus</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Program Intensif UTBK SNBT 2027"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kategori</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="BIMBEL">BIMBEL</option>
                    <option value="BOOTCAMP">BOOTCAMP</option>
                    <option value="SERTIFIKASI">SERTIFIKASI</option>
                    <option value="PRIVAT">PRIVAT</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Harga (Rp)</label>
                  <input
                    type="number"
                    value={courseForm.price}
                    onChange={(e) => setCourseForm({ ...courseForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Deskripsi</label>
                <textarea
                  rows={2}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Simpan Kursus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Subject */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Tambah Mata Pelajaran / Silabus</h3>
            <form onSubmit={handleSaveSubject} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pengetahuan Kuantitatif"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Deskripsi / Ruang Lingkup</label>
                <textarea
                  rows={2}
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Sesi Materi */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Tambah Sesi / Materi Ajar</h3>
            <form onSubmit={handleSaveSession} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Judul Sesi Pertemuan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sesi 01: Trik Cepat Aljabar & Fungsi"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">URL E-Book / Handout PDF</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... atau link PDF"
                  value={sessionForm.handoutPdfUrl}
                  onChange={(e) => setSessionForm({ ...sessionForm, handoutPdfUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">URL Video VOD Pembahasan</label>
                <input
                  type="url"
                  placeholder="https://youtube.com/... atau link Vimeo"
                  value={sessionForm.vodVideoUrl}
                  onChange={(e) => setSessionForm({ ...sessionForm, vodVideoUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">URL Kuis / CBT Exam</label>
                  <input
                    type="url"
                    placeholder="https://cbt.fermatacademy.com/..."
                    value={sessionForm.quizUrl}
                    onChange={(e) => setSessionForm({ ...sessionForm, quizUrl: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Min. Skor Kelulusan</label>
                  <input
                    type="number"
                    value={sessionForm.minPassingScore}
                    onChange={(e) => setSessionForm({ ...sessionForm, minPassingScore: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Simpan Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Buka Batch Baru */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Buka Angkatan / Batch Baru</h3>
            <form onSubmit={handleSaveBatch} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Batch</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gelombang 1 - Kelas Intensif Malam"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={batchForm.startDate}
                    onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={batchForm.endDate}
                    onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Maks. Kuota Siswa</label>
                <input
                  type="number"
                  value={batchForm.maxStudents}
                  onChange={(e) => setBatchForm({ ...batchForm, maxStudents: parseInt(e.target.value) || 50 })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Buka Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tugaskan Tutor ke Batch */}
      {showAssignTutorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Tugaskan Tenaga Pengajar (Tutor)</h3>
            <form onSubmit={handleAssignTutor} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pilih Tutor / Instruktur</label>
                <select
                  required
                  value={tutorForm.instructorId}
                  onChange={(e) => setTutorForm({ ...tutorForm, instructorId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- Pilih Tutor --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Peran Pengajar</label>
                <select
                  value={tutorForm.role}
                  onChange={(e) => setTutorForm({ ...tutorForm, role: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="LEAD_INSTRUCTOR">Master Tutor / Lead Instructor</option>
                  <option value="ASSISTANT_MENTOR">Mentor Pendamping / Q&A</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tarif Honor per Jam (Rp)</label>
                <input
                  type="number"
                  required
                  value={tutorForm.hourlyRate}
                  onChange={(e) => setTutorForm({ ...tutorForm, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssignTutorModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow"
                >
                  Tugaskan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseManagementView;
