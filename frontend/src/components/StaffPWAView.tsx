import React, { useState, useEffect, useRef } from 'react';
import { 
  Fingerprint, Camera, MapPin, CheckCircle2, AlertTriangle, 
  Clock, Package, TrendingDown, RefreshCw, Plus, ArrowLeft, 
  LogOut, Coffee, Calendar, Check, AlertCircle, ChevronRight, X, User,
  Award, ShieldCheck, DollarSign, ChevronDown, CheckCircle,
  Zap, Info, Bell, Search, Filter, Trash2, CheckSquare,
  FileText, ClipboardList, Send, Upload, FileCheck, CheckCheck, RefreshCcw,
  Smartphone, UserCheck, KeyRound, ArrowRight, CornerDownLeft, Sparkles, Activity,
  Lock, Eye, EyeOff, QrCode, Share2, Download, Shield, ShieldAlert,
  Sliders, Thermometer, Flame, Star, BadgeCheck, HelpCircle, Timer, Compass
} from 'lucide-react';
import { toast, confirmAlert } from '../utils/alert';

interface WorkShift {
  id: string;
  name: string;
  start: string;
  end: string;
  lateTolerance?: number;
}

interface Ingredient {
  id: number;
  name: string;
  category?: 'FOOD' | 'DRINK' | 'PACKAGING' | string;
  subCategory?: string;
  unit: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  supplier?: { id: number; name: string; phone?: string } | null;
}

interface LeaveRequestItem {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  photoUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  approvedBy?: string;
  adminNotes?: string;
  createdAt: string;
}

interface ShiftHandoverItem {
  id: number;
  userId: number;
  shiftName: string;
  date: string;
  cashBalance: number;
  equipmentStatus?: string;
  notes: string;
  createdAt: string;
  user?: { id: number; name: string; username: string; role: string };
}

interface SOPCheckItem {
  id: string;
  text: string;
  checked: boolean;
  category: 'bar' | 'clean' | 'cash' | 'chiller';
}

const DEFAULT_SHIFTS: WorkShift[] = [
  { id: 'pagi', name: 'Shift Pagi', start: '08:00', end: '16:00', lateTolerance: 15 },
  { id: 'siang', name: 'Shift Siang / Sore', start: '14:00', end: '22:00', lateTolerance: 15 },
  { id: 'middle', name: 'Shift Middle', start: '11:00', end: '19:00', lateTolerance: 15 },
  { id: 'full', name: 'Shift Full Day', start: '09:00', end: '18:00', lateTolerance: 15 },
];

const DEFAULT_OPENING_SOP: SOPCheckItem[] = [
  { id: 'op1', text: 'Kalibrasi Grinder & Cek Rasa Espresso (Dose & Yield)', checked: false, category: 'bar' },
  { id: 'op2', text: 'Periksa Suhu Chiller / Kulkas Susu (< 4°C)', checked: false, category: 'chiller' },
  { id: 'op3', text: 'Cek Kesiapan Bahan Baku & Stock Susu Segar', checked: false, category: 'bar' },
  { id: 'op4', text: 'Sanitasi Meja Bar, Portafilter & Steam Wand', checked: false, category: 'clean' },
  { id: 'op5', text: 'Hitung Kas Awal / Modal Uang Pas di Laci Kasir', checked: false, category: 'cash' },
  { id: 'op6', text: 'Nyalakan POS & Pastikan Kertas Thermal Siap', checked: false, category: 'cash' },
];

const DEFAULT_CLOSING_SOP: SOPCheckItem[] = [
  { id: 'cl1', text: 'Backflush & Chemical Cleaning Mesin Espresso', checked: false, category: 'bar' },
  { id: 'cl2', text: 'Bersihkan & Kosongkan Hopper Grinder Kopi', checked: false, category: 'bar' },
  { id: 'cl3', text: 'Simpan Semua Bahan Sisa ke Dalam Chiller', checked: false, category: 'chiller' },
  { id: 'cl4', text: 'Sapu, Pel Lantai & Buang Sampah Bar/Dapur', checked: false, category: 'clean' },
  { id: 'cl5', text: 'Rekonsiliasi Kas Laci & Tutup Shift Kasir', checked: false, category: 'cash' },
  { id: 'cl6', text: 'Matikan Semua Mesin, AC, Lampu & Kunci Pintu', checked: false, category: 'clean' },
];

export const StaffPWAView: React.FC = () => {
  // Authentication state
  const [token, setToken] = useState<string>(() => localStorage.getItem('staff_token') || '');
  const [user, setUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('staff_user') || 'null');
    } catch {
      return null;
    }
  });

  // Individual Login Form State
  const [loginUsername, setLoginUsername] = useState<string>(() => localStorage.getItem('staff_saved_username') || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Active Tab: 'attendance' | 'handover' | 'leave' | 'stock' | 'profile'
  const [activeTab, setActiveTab] = useState<'attendance' | 'handover' | 'leave' | 'stock' | 'profile'>('attendance');

  // Live Digital Time
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentSeconds, setCurrentSeconds] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      setCurrentSeconds(now.toLocaleTimeString('id-ID', { second: '2-digit' }));
      setCurrentDateStr(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Store Settings & Shifts
  const [settings, setSettings] = useState<any>(null);
  const [shifts, setShifts] = useState<WorkShift[]>(DEFAULT_SHIFTS);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('pagi');

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leavePhotoRef = useRef<HTMLInputElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  // Attendance Clocking State & My Summary
  const [clockLoading, setClockLoading] = useState(false);
  const [mySummary, setMySummary] = useState<any>(null);

  // SOP Checklist State
  const [sopType, setSopType] = useState<'OPENING' | 'CLOSING'>('OPENING');
  const [sopList, setSopList] = useState<SOPCheckItem[]>(DEFAULT_OPENING_SOP);
  const [savingSOP, setSavingSOP] = useState(false);

  // Handover State
  const [handovers, setHandovers] = useState<ShiftHandoverItem[]>([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [showNewHandoverModal, setShowNewHandoverModal] = useState(false);
  const [handoverForm, setHandoverForm] = useState({
    shiftName: 'Shift Pagi ke Shift Sore',
    cashBalance: '',
    equipmentStatus: 'Semua mesin normal & area bar bersih',
    notes: ''
  });
  const [submittingHandover, setSubmittingHandover] = useState(false);

  // Stock State
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING' | 'LOW'>('ALL');

  // Stock Modals
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossForm, setLossForm] = useState({
    ingredientId: '',
    qtyLoss: '',
    reason: 'Busuk / Kadaluarsa',
    notes: ''
  });
  const [submittingLoss, setSubmittingLoss] = useState(false);

  const [adjustModal, setAdjustModal] = useState<{ open: boolean; ingredient: Ingredient | null }>({
    open: false,
    ingredient: null
  });
  const [adjustForm, setAdjustForm] = useState({ change: '', description: '' });
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Leave Requests State
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'Izin',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
    photoUrl: ''
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Modals for ID Card & Security
  const [showIDCardModal, setShowIDCardModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    oldPin: '',
    newPin: '',
    confirmPin: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [securityTab, setSecurityTab] = useState<'pin' | 'password'>('pin');
  const [submittingSecurity, setSubmittingSecurity] = useState(false);

  // Edit Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Helper styling
  const getAvatarGradient = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('barista') || r.includes('kopi')) return 'bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] text-white';
    if (r.includes('chef') || r.includes('dapur') || r.includes('cook')) return 'bg-gradient-to-tr from-[#F43F5E] to-[#FDA4AF] text-white';
    if (r.includes('kasir') || r.includes('cashier')) return 'bg-gradient-to-tr from-[#10B981] to-[#6EE7B7] text-white';
    if (r.includes('waiter') || r.includes('server')) return 'bg-gradient-to-tr from-[#06B6D4] to-[#67E8F9] text-white';
    if (r.includes('admin') || r.includes('manager')) return 'bg-gradient-to-tr from-[#1A1033] to-[#7C3AED] text-white';
    return 'bg-gradient-to-tr from-[#6366F1] to-[#A5B4FC] text-white';
  };

  const getRoleBadge = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('barista')) return 'bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]';
    if (r.includes('chef') || r.includes('dapur')) return 'bg-rose-50 text-[#F43F5E] border border-rose-200';
    if (r.includes('kasir')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (r.includes('waiter')) return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  // Selected shift helper
  const currentShift = shifts.find(s => s.id === selectedShiftId) || shifts[0] || DEFAULT_SHIFTS[0];

  // Calculate Distance (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Fetch Settings & Shifts
  const fetchSettingsAndShifts = async () => {
    try {
      const [setRes, shiftRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/attendance/shifts')
      ]);
      if (setRes.ok) setSettings(await setRes.json());
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        if (Array.isArray(shiftData) && shiftData.length > 0) {
          setShifts(shiftData);
          setSelectedShiftId(shiftData[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettingsAndShifts();
  }, []);

  // Request GPS Location
  const requestGpsLocation = () => {
    setGpsLoading(true);
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung Geolocation');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsLocation({ lat, lng });
        setGpsLoading(false);

        const storeLat = settings?.storeLatitude ?? -6.200000;
        const storeLon = settings?.storeLongitude ?? 106.816666;
        const maxRadius = settings?.gpsRadiusMeters ?? 150;

        const dist = calculateDistance(lat, lng, storeLat, storeLon);
        setGpsDistance(dist);
        setIsWithinRadius(dist <= maxRadius);
      },
      err => {
        setGpsLoading(false);
        setGpsError('Izin GPS belum aktif / tidak diizinkan');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Camera WebRTC + fallback
  const startCamera = async (facing = cameraFacing) => {
    setIsCameraActive(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false
        });
      } catch (err1) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.warn('Video stream play error:', err));
      }
    } catch (e) {
      console.error('Camera error:', e);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      startCamera(nextFacing);
    }
  };

  useEffect(() => {
    if (videoRef.current && cameraStream && isCameraActive) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, [cameraStream, isCameraActive, activeTab, capturedPhoto]);

  useEffect(() => {
    if (token && activeTab === 'attendance' && !capturedPhoto) {
      startCamera();
      requestGpsLocation();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [token, activeTab, capturedPhoto]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 480;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (cameraFacing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedPhoto(dataUrl);
        stopCamera();
        toast('Foto selfie berhasil diambil!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Fetch My Summary Data (Presensi, KPI, History, Discipline)
  const fetchMySummary = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/attendance/my-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMySummary(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Ingredients
  const fetchIngredients = async () => {
    if (!token) return;
    setStockLoading(true);
    try {
      const res = await fetch('/api/ingredients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIngredients(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStockLoading(false);
    }
  };

  // Fetch Leaves
  const fetchMyLeaves = async () => {
    if (!token) return;
    setLeaveLoading(true);
    try {
      const res = await fetch('/api/attendance/leaves', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaveRequests(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLeaveLoading(false);
    }
  };

  // Fetch Handovers
  const fetchHandovers = async () => {
    if (!token) return;
    setHandoverLoading(true);
    try {
      const res = await fetch('/api/attendance/handover', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHandovers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHandoverLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchMySummary();
    if (activeTab === 'stock') {
      fetchIngredients();
    } else if (activeTab === 'leave') {
      fetchMyLeaves();
    } else if (activeTab === 'handover') {
      fetchHandovers();
    }
  }, [token, activeTab]);

  // Handle Login
  const handleIndividualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) {
      return setLoginError('Harap masukkan Username Anda.');
    }
    if (!loginPassword) {
      return setLoginError('Harap masukkan Password atau PIN Anda.');
    }

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('staff_token', data.token);
        localStorage.setItem('staff_user', JSON.stringify(data.user));
        if (rememberMe) {
          localStorage.setItem('staff_saved_username', loginUsername.trim());
        } else {
          localStorage.removeItem('staff_saved_username');
        }
        setToken(data.token);
        setUser(data.user);
        setLoginPassword('');
        setCapturedPhoto(null);
        toast(`Selamat datang, ${data.user.name}!`, 'success');
      } else {
        setLoginError(data.error || 'Username atau Password salah.');
      }
    } catch (e) {
      setLoginError('Terjadi kesalahan koneksi ke server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    setToken('');
    setUser(null);
    setCapturedPhoto(null);
    stopCamera();
    toast('Berhasil keluar sesi portal staf', 'info');
  };

  // Perform Clock In / Out
  const handleClockAction = async (type: 'IN' | 'OUT') => {
    if (type === 'IN' && !capturedPhoto && settings?.enableCameraPhoto) {
      return toast('Harap ambil foto selfie verifikasi kehadiran terlebih dahulu', 'warning');
    }

    if (type === 'IN' && !isWithinRadius && settings?.enableGpsValidation) {
      return toast(`Anda berada di luar radius absensi (${gpsDistance}m dari outlet)`, 'error');
    }

    setClockLoading(true);
    try {
      const selectedShift = shifts.find(s => s.id === selectedShiftId) || DEFAULT_SHIFTS[0];
      const payload = {
        pin: user?.pin || '',
        type,
        shiftId: selectedShiftId,
        shiftName: `${selectedShift.name} (${selectedShift.start} - ${selectedShift.end})`,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng,
        photo: capturedPhoto,
        notes: ''
      };

      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Presensi berhasil dicatat!', 'success');
        setCapturedPhoto(null);
        fetchMySummary();
      } else {
        toast(data.error || 'Gagal memproses absensi', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setClockLoading(false);
    }
  };

  // Handle SOP Checklist Toggle & Save
  const toggleSopItem = (id: string) => {
    setSopList(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleSaveSOP = async () => {
    setSavingSOP(true);
    try {
      const res = await fetch('/api/attendance/checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          type: sopType,
          shiftName: selectedShiftId,
          items: sopList,
          notes: `Checklist ${sopType} oleh ${user.name}`
        })
      });

      if (res.ok) {
        toast(`SOP ${sopType === 'OPENING' ? 'Opening' : 'Closing'} berhasil disimpan!`, 'success');
      } else {
        toast('Gagal menyimpan checklist SOP', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSavingSOP(false);
    }
  };

  // Submit Shift Handover
  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverForm.notes.trim()) {
      return toast('Harap isi catatan serah terima shift', 'warning');
    }

    setSubmittingHandover(true);
    try {
      const res = await fetch('/api/attendance/handover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          ...handoverForm
        })
      });

      if (res.ok) {
        toast('Catatan serah terima shift berhasil disimpan!', 'success');
        setShowNewHandoverModal(false);
        setHandoverForm({
          shiftName: 'Shift Pagi ke Shift Sore',
          cashBalance: '',
          equipmentStatus: 'Semua mesin normal & area bar bersih',
          notes: ''
        });
        fetchHandovers();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan handover', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingHandover(false);
    }
  };

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.reason.trim()) {
      return toast('Harap isi alasan pengajuan izin/sakit', 'warning');
    }

    setSubmittingLeave(true);
    try {
      const res = await fetch('/api/attendance/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          ...leaveForm
        })
      });

      if (res.ok) {
        toast('Pengajuan izin berhasil dikirim ke Admin!', 'success');
        setShowNewLeaveModal(false);
        setLeaveForm({
          type: 'Izin',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          reason: '',
          photoUrl: ''
        });
        fetchMyLeaves();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mengirim pengajuan', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Submit Stock Loss
  const handleSubmitStockLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(lossForm.qtyLoss);
    if (!lossForm.ingredientId || isNaN(qty) || qty <= 0) {
      return toast('Masukkan jumlah kerugian yang valid', 'warning');
    }

    setSubmittingLoss(true);
    try {
      const res = await fetch('/api/ingredients/loss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...lossForm,
          notes: `${lossForm.notes ? lossForm.notes + ' - ' : ''}[Staf: ${user?.name}]`
        })
      });

      if (res.ok) {
        toast('Pencatatan stock loss berhasil disimpan!', 'success');
        setShowLossModal(false);
        setLossForm({ ingredientId: '', qtyLoss: '', reason: 'Busuk / Kadaluarsa', notes: '' });
        fetchIngredients();
      } else {
        toast('Gagal menyimpan stock loss', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingLoss(false);
    }
  };

  // Submit Quick Restock
  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.ingredient) return;
    const changeVal = parseFloat(adjustForm.change);
    if (isNaN(changeVal) || changeVal <= 0) {
      return toast('Masukkan jumlah barang masuk yang valid', 'warning');
    }

    setSubmittingAdjust(true);
    try {
      const res = await fetch(`/api/ingredients/${adjustModal.ingredient.id}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          change: changeVal,
          type: 'Restock',
          description: adjustForm.description || `Quick Restock Staf (${user?.name})`
        })
      });

      if (res.ok) {
        toast(`Berhasil restock ${adjustModal.ingredient.name}!`, 'success');
        setAdjustModal({ open: false, ingredient: null });
        setAdjustForm({ change: '', description: '' });
        fetchIngredients();
      } else {
        toast('Gagal melakukan restock', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Submit Security Update (PIN / Password)
  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityTab === 'pin') {
      if (!securityForm.newPin || securityForm.newPin.length < 4) {
        return toast('PIN baru minimal 4-6 digit angka', 'warning');
      }
      if (securityForm.newPin !== securityForm.confirmPin) {
        return toast('Konfirmasi PIN tidak cocok', 'warning');
      }
    } else {
      if (!securityForm.newPassword || securityForm.newPassword.length < 4) {
        return toast('Password baru minimal 4 karakter', 'warning');
      }
      if (securityForm.newPassword !== securityForm.confirmPassword) {
        return toast('Konfirmasi password tidak cocok', 'warning');
      }
    }

    setSubmittingSecurity(true);
    try {
      const payload: any = {};
      if (securityTab === 'pin') {
        payload.newPin = securityForm.newPin;
        if (securityForm.oldPin) payload.oldPin = securityForm.oldPin;
      } else {
        payload.newPassword = securityForm.newPassword;
        if (securityForm.oldPassword) payload.oldPassword = securityForm.oldPassword;
      }

      const res = await fetch('/api/users/me/security', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Keamanan akun berhasil diperbarui!', 'success');
        setShowSecurityModal(false);
        setSecurityForm({
          oldPin: '',
          newPin: '',
          confirmPin: '',
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        if (data.user) {
          setUser((prev: any) => ({ ...prev, ...data.user }));
          localStorage.setItem('staff_user', JSON.stringify({ ...user, ...data.user }));
        }
      } else {
        toast(data.error || 'Gagal memperbarui keamanan', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingSecurity(false);
    }
  };

  // Submit Profile Name Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNameInput.trim()) return toast('Nama tidak boleh kosong', 'warning');

    setSubmittingProfile(true);
    try {
      const res = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: profileNameInput.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        toast('Nama profil berhasil diperbarui!', 'success');
        setShowProfileModal(false);
        setUser((prev: any) => ({ ...prev, name: profileNameInput.trim() }));
        localStorage.setItem('staff_user', JSON.stringify({ ...user, name: profileNameInput.trim() }));
      } else {
        toast(data.error || 'Gagal memperbarui profil', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingProfile(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. RENDER UN-AUTHENTICATED LOGIN SCREEN
  // ─────────────────────────────────────────────────────────────
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-[#1A1033] flex flex-col justify-between sm:py-8 sm:px-4 max-w-md mx-auto select-none font-sans text-slate-800 antialiased">
        
        {/* Brand Header */}
        <div className="px-6 pt-8 pb-8 text-center text-white space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold border border-white/10">
            <span className="w-2 h-2 rounded-full bg-[#FFD600] animate-pulse" />
            <span className="font-mono text-purple-200">{currentTime || '08:00'}</span>
            <span className="text-white/40">•</span>
            <span className="uppercase tracking-wider font-bold text-white">
              {settings?.storeName || 'POS PORTAL STAF'}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white pt-2">
            Portal Staf Operasional
          </h1>
          <p className="text-xs text-purple-200/70">
            Presensi, Jadwal Shift, SOP, Serah Terima & Inventaris
          </p>
        </div>

        {/* Soft White Rounded Sheet Container */}
        <div className="bg-[#F4F6F9] rounded-t-[36px] sm:rounded-3xl p-6 sm:p-7 shadow-2xl flex-1 flex flex-col justify-between">
          
          <form onSubmit={handleIndividualLogin} className="space-y-4 pt-2">
            
            <div className="text-center pb-2">
              <div className="w-16 h-16 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-bold text-xl mx-auto shadow-md ring-4 ring-[#F5F3FF] mb-2">
                <User size={28} className="text-[#FFD600]" />
              </div>
              <h2 className="text-base font-bold text-[#1A1033]">Masuk Akun Staf</h2>
              <p className="text-xs text-slate-500">Gunakan Username dan Password atau PIN kerja Anda</p>
            </div>

            {loginError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center text-xs font-semibold text-[#F43F5E] flex items-center justify-center gap-2">
                <AlertCircle size={15} />
                <span>{loginError}</span>
              </div>
            )}

            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A1033] block px-0.5">
                Username Staf:
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  required
                  value={loginUsername}
                  onChange={e => {
                    setLoginUsername(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Contoh: rian, barista1, atau chef"
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Password / PIN Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A1033] block px-0.5">
                Password atau 6-Digit PIN:
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={e => {
                    setLoginPassword(e.target.value);
                    setLoginError('');
                  }}
                  placeholder="Masukkan password atau PIN..."
                  className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-slate-300"
                />
                <span>Ingat username di perangkat ini</span>
              </label>
            </div>

            {/* Submit Login Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] disabled:bg-slate-300 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#7C3AED]/25 active:scale-98"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Memeriksa Akun...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={16} className="text-[#FFD600]" />
                    <span>Masuk ke Portal Staf</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Return Link */}
          <div className="text-center pt-4 border-t border-slate-200">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#7C3AED] transition-colors"
            >
              <ArrowLeft size={14} /> Kembali ke Kasir Utama POS
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RENDER AUTHENTICATED STAFF APP (HIGH-END & PROFESSIONAL UX)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1A1033] flex flex-col items-center justify-start sm:py-6 sm:px-4 font-sans select-none antialiased">
      <div className="w-full sm:max-w-[430px] min-h-screen sm:min-h-[880px] bg-[#F4F6F9] sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* ── TOP DEEP PLUM HEADER BANNER ── */}
        <header className="bg-[#1A1033] text-white px-5 pt-4 pb-10 shrink-0 relative">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between text-xs text-purple-200/80 font-medium mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600] animate-pulse" />
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                {settings?.storeName || 'DEMO CAFE'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick ID Card Modal Button */}
              <button
                type="button"
                onClick={() => setShowIDCardModal(true)}
                className="px-3 py-1 rounded-full bg-[#FFD600] text-[#1A1033] font-bold text-[10px] flex items-center gap-1 shadow-sm hover:bg-[#FACC15] active:scale-95 transition-all"
                title="Buka Kartu ID Digital"
              >
                <QrCode size={13} />
                <span>ID Card</span>
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                title="Keluar Akun"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* User Welcome & Time */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs text-purple-200/70 font-medium">Selamat bertugas,</span>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>{user.name}</span>
                <span className="text-[10px] font-semibold text-[#FFD600] bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                  {user.role}
                </span>
              </h1>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-white font-mono flex items-baseline justify-end gap-0.5">
                <span>{currentTime}</span>
                <span className="text-[10px] text-purple-300/80 font-normal">.{currentSeconds}</span>
              </div>
              <div className="text-[10px] text-purple-200/70">{currentDateStr}</div>
            </div>
          </div>
        </header>

        {/* ── FLOATING SHEET CONTAINER ── */}
        <div className="-mt-6 bg-[#F4F6F9] rounded-t-[32px] sm:rounded-3xl flex-1 flex flex-col relative z-10 overflow-hidden">
          
          {/* ── PROFILE & STATS SUMMARY BAR ── */}
          <div className="bg-white px-5 pt-3.5 pb-4 rounded-b-[28px] shadow-[0_4px_25px_rgba(124,58,237,0.06)] border-b border-slate-100">
            <div className="flex items-center justify-between">
              
              {/* Avatar + Name */}
              <div className="flex items-center gap-3">
                <div className={`w-13 h-13 rounded-full ${getAvatarGradient(user.role)} flex items-center justify-center font-bold text-base shadow-md ring-4 ring-white`}>
                  {user.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#1A1033] flex items-center gap-1">
                    <span>{user.name}</span>
                    <BadgeCheck size={14} className="text-[#7C3AED]" />
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID #{user.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shift Status Badge */}
              <div>
                {mySummary?.todayStatus?.clockedIn ? (
                  mySummary?.todayStatus?.clockedOut ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                      <CheckCircle2 size={12} className="text-[#7C3AED]" /> Shift Selesai
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sedang Shift
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-[#F43F5E] font-bold text-[10px] border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" /> Belum Masuk
                  </span>
                )}
              </div>
            </div>

            {/* 3-Column Performance Bar in Lavender Soft Tint */}
            <div className="grid grid-cols-3 gap-2 mt-3.5 text-center">
              <div className="bg-[#F5F3FF] p-2 rounded-2xl border border-[#DDD6FE]/60">
                <div className="text-sm font-bold text-[#1A1033]">
                  {mySummary?.stats?.totalHadir || 0}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Hari Hadir</div>
              </div>

              <div className="bg-[#F5F3FF] p-2 rounded-2xl border border-[#DDD6FE]/60">
                <div className="text-sm font-bold text-[#F43F5E]">
                  {mySummary?.stats?.totalTerlambat || 0}x
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Terlambat</div>
              </div>

              <div className="bg-[#F5F3FF] p-2 rounded-2xl border border-[#DDD6FE]/60">
                <div className="text-sm font-bold text-[#7C3AED]">
                  {mySummary?.stats?.totalWorkHours || 0}j
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Jam Kerja</div>
              </div>
            </div>
          </div>

          {/* ── SCROLLABLE TAB CONTENTS ── */}
          <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4">
            
            {/* ══════════════════════════════════════════════════════════════
                TAB 1: PRESENSI, JADWAL SHIFT, BIOMETRIC & SOP
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'attendance' && (
              <div className="space-y-4">
                
                {/* ── JADWAL & JAM SHIFT KERJA HERO CARD ── */}
                <div className="bg-gradient-to-br from-white to-[#F5F3FF] rounded-3xl p-4 border border-[#DDD6FE] shadow-sm space-y-3 relative overflow-hidden">
                  
                  {/* Decorative ambient badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1.5 rounded-xl bg-[#7C3AED] text-white">
                        <Clock size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#1A1033]">Jadwal Shift Kerja</h4>
                        <p className="text-[10px] text-slate-500">Pilih & pantau jam kerja bertugas</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] font-bold text-[10px] border border-[#DDD6FE]">
                      Toleransi: +{currentShift?.lateTolerance || 15}m
                    </span>
                  </div>

                  {/* Selected Shift Highlight Banner */}
                  <div className="p-3 bg-[#1A1033] text-white rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-purple-200 font-semibold uppercase tracking-wider">
                        {currentShift.name}
                      </div>
                      <div className="text-base font-extrabold text-white font-mono mt-0.5 flex items-center gap-1.5">
                        <span className="text-[#FFD600]">{currentShift.start}</span>
                        <span className="text-purple-300 text-xs font-sans">s/d</span>
                        <span className="text-[#FFD600]">{currentShift.end}</span>
                        <span className="text-xs font-normal text-purple-200 font-sans">WIB</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-purple-300 block">Durasi Kerja:</span>
                      <span className="text-xs font-bold text-[#FFD600] font-mono">
                        8 Jam Kerja
                      </span>
                    </div>
                  </div>

                  {/* Shift Selection Tabs */}
                  {!mySummary?.todayStatus?.clockedIn && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 block px-0.5">
                        Ganti Shift Bertugas Hari Ini:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {shifts.map(s => {
                          const isSelected = selectedShiftId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelectedShiftId(s.id)}
                              className={`py-2 px-2.5 rounded-2xl text-left border transition-all ${
                                isSelected
                                  ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm font-bold'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                              }`}
                            >
                              <div className="text-xs truncate">{s.name}</div>
                              <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-purple-100' : 'text-[#7C3AED] font-semibold'}`}>
                                {s.start} - {s.end}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* If Already Clocked In: Show Live Shift Status */}
                  {mySummary?.todayStatus?.clockedIn && (
                    <div className="p-2.5 rounded-2xl bg-white border border-[#DDD6FE] text-xs space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Jam Masuk (Clock In):</span>
                        <span className="font-bold text-emerald-700 font-mono">
                          {mySummary?.todayStatus?.todayLog?.clockIn 
                            ? new Date(mySummary.todayStatus.todayLog.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                            : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Shift Terdaftar:</span>
                        <span className="font-bold text-[#1A1033]">
                          {mySummary?.todayStatus?.todayLog?.shiftName || currentShift.name}
                        </span>
                      </div>
                    </div>
                  )}

                </div>

                {/* Hero Biometric Camera Card */}
                <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-3">
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1A1033] flex items-center gap-1.5">
                      <Camera size={15} className="text-[#7C3AED]" /> Kamera Selfie Presensi
                    </span>
                    {capturedPhoto ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Foto Siap
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Posisikan wajah Anda</span>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    ref={fileInputRef}
                    onChange={handleNativeCameraCapture}
                    className="hidden"
                  />

                  {!capturedPhoto ? (
                    <div className="space-y-3">
                      {/* Viewfinder Frame */}
                      <div className="relative rounded-3xl overflow-hidden bg-[#1A1033] aspect-square max-w-[270px] mx-auto shadow-inner">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'transform -scale-x-100' : ''}`}
                        />
                        
                        {/* Soft Guide Corners */}
                        <div className="absolute inset-0 pointer-events-none p-5 flex flex-col justify-between">
                          <div className="flex justify-between">
                            <div className="w-5 h-5 border-t-2 border-l-2 border-[#FFD600] rounded-tl-lg" />
                            <div className="w-5 h-5 border-t-2 border-r-2 border-[#FFD600] rounded-tr-lg" />
                          </div>
                          <div className="flex justify-between">
                            <div className="w-5 h-5 border-b-2 border-l-2 border-[#FFD600] rounded-bl-lg" />
                            <div className="w-5 h-5 border-b-2 border-r-2 border-[#FFD600] rounded-br-lg" />
                          </div>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-auto">
                          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-bold text-emerald-400 border border-white/10 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                          </span>

                          <button
                            type="button"
                            onClick={toggleCameraFacing}
                            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all active:scale-90"
                            title="Putar Kamera"
                          >
                            <RefreshCcw size={13} />
                          </button>
                        </div>

                        {/* Shutter Capture Button */}
                        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center pointer-events-auto">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="w-13 h-13 p-1 rounded-full bg-white text-[#7C3AED] flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                            title="Ambil Foto"
                          >
                            <div className="w-10 h-10 rounded-full bg-[#7C3AED] text-white flex items-center justify-center">
                              <Camera size={16} />
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Native Camera Trigger */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] rounded-2xl text-xs font-semibold border border-[#DDD6FE]/60 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Smartphone size={14} />
                        <span>Buka Kamera Bawaan HP</span>
                      </button>
                    </div>
                  ) : (
                    /* Captured Photo Preview */
                    <div className="space-y-3">
                      <div className="relative rounded-3xl overflow-hidden bg-[#1A1033] aspect-square max-w-[220px] mx-auto border-2 border-emerald-500 shadow-md">
                        <img src={capturedPhoto} alt="Selfie" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setCapturedPhoto(null);
                            startCamera();
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          startCamera();
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RefreshCw size={12} />
                        <span>Foto Ulang</span>
                      </button>
                    </div>
                  )}

                  {/* GPS Status Strip */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-full shrink-0 ${isWithinRadius ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-[#F43F5E]'}`}>
                        <MapPin size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1A1033] text-[11px] truncate">
                          {settings?.storeName || 'DEMO CAFE'}
                        </div>
                        <div className="text-[10px]">
                          {gpsLoading ? (
                            <span className="text-slate-400 flex items-center gap-1">
                              <RefreshCw size={10} className="animate-spin text-[#7C3AED]" /> Mengunci GPS...
                            </span>
                          ) : isWithinRadius ? (
                            <span className="text-emerald-600 font-medium">
                              ✓ Tepat di Lokasi ({gpsDistance !== null ? `${gpsDistance}m` : '0m'} / {settings?.gpsRadiusMeters || 150}m)
                            </span>
                          ) : (
                            <span className="text-[#F43F5E] font-medium">
                              Di Luar Radius ({gpsDistance !== null ? `${gpsDistance}m` : '-'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={requestGpsLocation}
                      disabled={gpsLoading}
                      className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all active:scale-95 shrink-0"
                      title="Perbarui GPS"
                    >
                      <RefreshCw size={12} className={gpsLoading ? 'animate-spin text-[#7C3AED]' : ''} />
                    </button>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div>
                  {!mySummary?.todayStatus?.clockedIn ? (
                    <button
                      type="button"
                      disabled={clockLoading || !isWithinRadius}
                      onClick={() => handleClockAction('IN')}
                      className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] disabled:bg-slate-300 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#7C3AED]/25 active:scale-98"
                    >
                      <CheckCircle2 size={16} className="text-[#FFD600]" />
                      <span>{clockLoading ? 'Memproses Presensi...' : `Presensi Masuk (${currentShift.name})`}</span>
                    </button>
                  ) : !mySummary?.todayStatus?.clockedOut ? (
                    <button
                      type="button"
                      disabled={clockLoading}
                      onClick={() => handleClockAction('OUT')}
                      className="w-full py-4 bg-[#F43F5E] hover:bg-rose-600 active:bg-rose-700 disabled:bg-slate-300 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 active:scale-98"
                    >
                      <LogOut size={16} />
                      <span>{clockLoading ? 'Memproses Pulang...' : 'Presensi Pulang (Clock Out)'}</span>
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-3xl bg-emerald-50 text-center text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Shift hari ini telah selesai. Terima kasih atas kerja keras Anda!</span>
                    </div>
                  )}
                </div>

                {/* Daily SOP Checklist Section */}
                <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} className="text-[#7C3AED]" />
                      <h4 className="text-xs font-bold text-[#1A1033]">Daily SOP Checklist</h4>
                    </div>

                    <div className="flex bg-[#F5F3FF] p-0.5 rounded-full border border-[#DDD6FE]/60">
                      <button
                        type="button"
                        onClick={() => {
                          setSopType('OPENING');
                          setSopList(DEFAULT_OPENING_SOP);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          sopType === 'OPENING' ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        Opening
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSopType('CLOSING');
                          setSopList(DEFAULT_CLOSING_SOP);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          sopType === 'CLOSING' ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        Closing
                      </button>
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2 pt-1">
                    {sopList.map(item => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
                          item.checked
                            ? 'bg-[#F5F3FF] border-[#DDD6FE] text-[#1A1033]'
                            : 'bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleSopItem(item.id)}
                          className="mt-0.5 w-4 h-4 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-slate-300"
                        />
                        <span className={`text-xs ${item.checked ? 'line-through text-slate-400' : 'font-medium'}`}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveSOP}
                    disabled={savingSOP}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1A1033] font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    {savingSOP ? (
                      <RefreshCw size={13} className="animate-spin text-[#7C3AED]" />
                    ) : (
                      <CheckCheck size={14} className="text-[#7C3AED]" />
                    )}
                    <span>Simpan Status Checklist SOP</span>
                  </button>
                </div>

              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 2: SERAH TERIMA SHIFT (HANDOVER LOGBOOK)
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'handover' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider">Serah Terima Shift</h3>
                    <p className="text-[10px] text-slate-400">Catatan operasional & kondisi mesin antar-shift</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewHandoverModal(true)}
                    className="py-1.5 px-3 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <Plus size={13} />
                    <span>+ Handover</span>
                  </button>
                </div>

                {handovers.length === 0 ? (
                  <div className="py-12 bg-white rounded-3xl border border-slate-100 text-center space-y-2 p-5 shadow-sm">
                    <ClipboardList size={34} className="mx-auto text-purple-200" />
                    <h4 className="text-xs font-bold text-[#1A1033]">Belum Ada Catatan Handover</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Buat catatan serah terima saat pergantian shift agar shift berikutnya mengetahui kondisi kas & peralatan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {handovers.map(item => (
                      <div
                        key={item.id}
                        className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center font-bold text-xs">
                              {item.user?.name?.substring(0, 1) || 'S'}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-[#1A1033]">{item.shiftName}</h5>
                              <p className="text-[10px] text-slate-400 font-medium">Oleh: {item.user?.name || 'Staf'}</p>
                            </div>
                          </div>

                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {item.date}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-[#F5F3FF] p-2 rounded-2xl border border-[#DDD6FE]/40">
                            <span className="text-[10px] text-slate-400 block font-medium">Sisa Kas Laci:</span>
                            <span className="font-bold text-[#1A1033] font-mono">
                              Rp {Number(item.cashBalance).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="bg-[#F5F3FF] p-2 rounded-2xl border border-[#DDD6FE]/40">
                            <span className="text-[10px] text-slate-400 block font-medium">Kondisi Mesin:</span>
                            <span className="font-bold text-emerald-700 truncate block">
                              {item.equipmentStatus || 'Normal'}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-slate-50 text-xs text-slate-700">
                          <strong className="text-[#1A1033]">Catatan Tugas:</strong> "{item.notes}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 3: IZIN & CUTI (LEAVE MANAGEMENT)
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'leave' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider">Pengajuan Izin & Sakit</h3>
                    <p className="text-[10px] text-slate-400">Pengajuan izin, sakit, cuti & tukar shift kerja</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewLeaveModal(true)}
                    className="py-1.5 px-3 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <Plus size={13} />
                    <span>+ Buat Izin</span>
                  </button>
                </div>

                {leaveRequests.length === 0 ? (
                  <div className="py-12 bg-white rounded-3xl border border-slate-100 text-center space-y-2 p-5 shadow-sm">
                    <FileCheck size={34} className="mx-auto text-purple-200" />
                    <h4 className="text-xs font-bold text-[#1A1033]">Belum Ada Pengajuan Izin</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Tekan tombol "+ Buat Izin" untuk mengajukan izin tidak hadir atau sakit dengan lampiran surat dokter.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {leaveRequests.map(item => (
                      <div
                        key={item.id}
                        className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#1A1033]">{item.type}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({item.startDate === item.endDate ? item.startDate : `${item.startDate} s/d ${item.endDate}`})
                            </span>
                          </div>

                          <span
                            className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${
                              item.status === 'Approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'Rejected'
                                ? 'bg-rose-50 text-[#F43F5E] border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {item.status === 'Approved' ? '✓ Disetujui' : item.status === 'Rejected' ? '✕ Ditolak' : '⏳ Menunggu'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600">"{item.reason}"</p>

                        {item.photoUrl && (
                          <div className="pt-1">
                            <span className="text-[10px] text-slate-400 block mb-1">Bukti Foto / Surat Dokter:</span>
                            <img src={item.photoUrl} alt="Bukti" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                          </div>
                        )}

                        {item.adminNotes && (
                          <div className="p-2.5 rounded-2xl bg-slate-50 text-[10px] text-slate-600">
                            <strong className="text-[#1A1033]">Catatan Admin:</strong> {item.adminNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 4: STOK BAHAN BAKU & QUICK LOSS / RESTOCK
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'stock' && (
              <div className="space-y-3">
                
                {/* Action Bar */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLossModal(true)}
                    className="flex-1 py-2 px-3 rounded-full bg-rose-50 text-[#F43F5E] border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-100 shadow-sm transition-all"
                  >
                    <TrendingDown size={14} />
                    <span>Lapor Basi / Rusak</span>
                  </button>

                  <button
                    type="button"
                    onClick={fetchIngredients}
                    className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                    title="Refresh Stok"
                  >
                    <RefreshCw size={13} className={stockLoading ? 'animate-spin text-[#7C3AED]' : ''} />
                  </button>
                </div>

                {/* Search & Category Tabs */}
                <div className="bg-white p-3.5 rounded-3xl border border-slate-100 shadow-sm space-y-2.5">
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                      placeholder="Cari bahan baku (kopi, susu, sirup)..."
                      className="w-full pl-9 pr-3.5 py-2 bg-[#F4F6F9] border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    <button
                      onClick={() => setStockCategory('ALL')}
                      className={`py-1.5 rounded-xl font-bold transition-all ${
                        stockCategory === 'ALL' ? 'bg-[#7C3AED] text-white shadow-sm' : 'bg-[#F4F6F9] text-slate-600'
                      }`}
                    >
                      Semua ({ingredients.length})
                    </button>
                    <button
                      onClick={() => setStockCategory('FOOD')}
                      className={`py-1.5 rounded-xl font-bold transition-all ${
                        stockCategory === 'FOOD' ? 'bg-[#7C3AED] text-white shadow-sm' : 'bg-[#F4F6F9] text-slate-600'
                      }`}
                    >
                      Makanan
                    </button>
                    <button
                      onClick={() => setStockCategory('DRINK')}
                      className={`py-1.5 rounded-xl font-bold transition-all ${
                        stockCategory === 'DRINK' ? 'bg-[#7C3AED] text-white shadow-sm' : 'bg-[#F4F6F9] text-slate-600'
                      }`}
                    >
                      Minuman
                    </button>
                    <button
                      onClick={() => setStockCategory('LOW')}
                      className={`py-1.5 rounded-xl font-bold transition-all ${
                        stockCategory === 'LOW' ? 'bg-[#F43F5E] text-white shadow-sm' : 'bg-[#F4F6F9] text-slate-600'
                      }`}
                    >
                      Menipis ({ingredients.filter(i => i.stock <= i.minStock).length})
                    </button>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="space-y-2">
                  {ingredients
                    .filter(i => {
                      if (stockCategory === 'FOOD') return (i.category || 'FOOD') === 'FOOD';
                      if (stockCategory === 'DRINK') return i.category === 'DRINK';
                      if (stockCategory === 'PACKAGING') return i.category === 'PACKAGING';
                      if (stockCategory === 'LOW') return i.stock <= i.minStock;
                      return true;
                    })
                    .filter(i => i.name.toLowerCase().includes(stockSearch.toLowerCase()))
                    .map(ing => {
                      const isLow = ing.stock <= ing.minStock;
                      return (
                        <div
                          key={ing.id}
                          className={`bg-white p-3.5 rounded-3xl border shadow-sm flex items-center justify-between gap-3 ${
                            isLow ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-bold text-[#1A1033]">{ing.name}</h5>
                              {isLow && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#F43F5E] text-white">
                                  Menipis
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Min: {ing.minStock} {ing.unit} {ing.subCategory ? `• ${ing.subCategory}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1A1033] font-mono">
                              {ing.stock} <span className="text-[10px] font-normal text-slate-400">{ing.unit}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustModal({ open: true, ingredient: ing });
                                setAdjustForm({ change: '', description: '' });
                              }}
                              className="px-2.5 py-1 rounded-full bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-bold text-[10px] border border-[#DDD6FE]/60"
                            >
                              +Restock
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 5: PROFIL LENGKAP, KPI, ID CARD & KEAMANAN AKUN
               ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                
                {/* ── DIGITAL EMPLOYEE ID CARD BANNER ── */}
                <div className="bg-gradient-to-br from-[#1A1033] to-[#2E1A47] text-white p-5 rounded-3xl shadow-lg border border-purple-900/40 relative overflow-hidden">
                  
                  {/* Subtle Background Glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#7C3AED]/20 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FFD600] animate-pulse" />
                      <span className="text-[11px] font-bold tracking-wider uppercase text-purple-200">
                        {settings?.storeName || 'DEMO CAFE'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#FFD600] bg-white/10 px-2.5 py-0.5 rounded-full font-semibold">
                      EMP-0{user.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-16 h-16 rounded-2xl ${getAvatarGradient(user.role)} flex items-center justify-center font-bold text-2xl shadow-md ring-2 ring-[#FFD600]/80 shrink-0`}>
                      {user.name?.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white truncate">{user.name}</h3>
                      <div className="text-[11px] text-purple-200 font-medium">{user.role}</div>
                      <div className="text-[10px] text-purple-300/70 mt-1 font-mono">
                        Username: @{user.username}
                      </div>
                    </div>

                    {/* QR Code Mini Stamp */}
                    <button
                      type="button"
                      onClick={() => setShowIDCardModal(true)}
                      className="p-2 bg-white rounded-xl shadow-md shrink-0 hover:scale-105 active:scale-95 transition-transform"
                      title="Perbesar Kartu ID"
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`STAFF-${user.id}`)}`}
                        alt="QR ID"
                        className="w-10 h-10 object-contain"
                      />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-purple-200/80">
                    <span>Status: <strong className="text-emerald-400">Aktif</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileNameInput(user.name);
                        setShowProfileModal(true);
                      }}
                      className="text-[#FFD600] hover:underline font-semibold"
                    >
                      Edit Nama
                    </button>
                  </div>
                </div>

                {/* ── KPI PERFORMANCE & SCORECARD ── */}
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Award size={16} className="text-[#FFD600]" />
                      <h4 className="text-xs font-bold text-[#1A1033]">Scorecard & Disiplin Staf</h4>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFD600] text-[#1A1033] font-bold text-[10px] shadow-sm">
                      Grade A • Teladan
                    </span>
                  </div>

                  {/* Zero Late Bonus Tracker */}
                  <div className="p-3 rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE]/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1A1033]">Bonus Zero-Late Bulan Ini:</span>
                      <span className="font-bold text-[#7C3AED] font-mono">
                        {mySummary?.discipline?.isOnTrackZeroLate ? 'On-Track (Rp 200.000)' : 'Tidak Memenuhi Syarat'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#7C3AED] h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, ((mySummary?.stats?.totalHadir || 0) / (mySummary?.discipline?.zeroLateMinAttendance || 20)) * 100)}%`
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{mySummary?.stats?.totalHadir || 0} / {mySummary?.discipline?.zeroLateMinAttendance || 20} Hari Hadir</span>
                      <span>{mySummary?.stats?.totalTerlambat || 0}x Terlambat</span>
                    </div>
                  </div>
                </div>

                {/* ── 30-DAY ATTENDANCE HISTORY TIMELINE ── */}
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#1A1033] flex items-center gap-1.5">
                      <Calendar size={15} className="text-[#7C3AED]" /> Riwayat Presensi Bulan Ini
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {mySummary?.history?.length || 0} Catatan
                    </span>
                  </div>

                  {mySummary?.history && mySummary.history.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {mySummary.history.slice(0, 10).map((log: any) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F4F6F9] border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            {log.photoIn ? (
                              <img src={log.photoIn} alt="Selfie" className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">
                                📸
                              </div>
                            )}

                            <div>
                              <div className="font-bold text-[#1A1033] text-[11px]">{log.date}</div>
                              <div className="text-[10px] text-slate-500">
                                In: {new Date(log.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • 
                                Out: {log.clockOut ? new Date(log.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            log.status === 'Hadir' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-rose-50 text-[#F43F5E] border border-rose-200'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      Belum ada riwayat kehadiran bulan ini.
                    </div>
                  )}
                </div>

                {/* ── SECURITY & CREDENTIALS ── */}
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2.5">
                  <h4 className="text-xs font-bold text-[#1A1033] flex items-center gap-1.5">
                    <Shield size={15} className="text-[#7C3AED]" /> Keamanan & Akun
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSecurityTab('pin');
                        setShowSecurityModal(true);
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-bold text-xs border border-[#DDD6FE]/60 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <KeyRound size={14} />
                      <span>Ubah PIN 6-Digit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSecurityTab('password');
                        setShowSecurityModal(true);
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-bold text-xs border border-[#DDD6FE]/60 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Lock size={14} />
                      <span>Ubah Password</span>
                    </button>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3 bg-white hover:bg-rose-50 text-[#F43F5E] font-bold text-xs rounded-full border border-rose-200 flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
                >
                  <LogOut size={14} />
                  <span>Keluar dari Akun Portal Staf</span>
                </button>

              </div>
            )}

          </main>
        </div>

        {/* ── STICKY BOTTOM 5 TABS NAVIGATION DOCK ── */}
        <nav className="fixed bottom-0 left-0 right-0 sm:max-w-[430px] mx-auto z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-2 px-3 sm:rounded-b-3xl shadow-[0_-4px_25px_rgba(124,58,237,0.08)]">
          <div className="flex items-center justify-around">
            
            {/* Tab 1: Presensi */}
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'attendance'
                  ? 'text-[#7C3AED] font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Fingerprint size={20} className={activeTab === 'attendance' ? 'text-[#7C3AED]' : 'text-slate-400'} />
              <span className="text-[10px] mt-0.5">Presensi</span>
              {activeTab === 'attendance' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600] mt-0.5" />
              )}
            </button>

            {/* Tab 2: Handover */}
            <button
              type="button"
              onClick={() => setActiveTab('handover')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'handover'
                  ? 'text-[#7C3AED] font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <ClipboardList size={20} className={activeTab === 'handover' ? 'text-[#7C3AED]' : 'text-slate-400'} />
              <span className="text-[10px] mt-0.5">Handover</span>
              {activeTab === 'handover' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600] mt-0.5" />
              )}
            </button>

            {/* Tab 3: Izin / Cuti */}
            <button
              type="button"
              onClick={() => setActiveTab('leave')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'leave'
                  ? 'text-[#7C3AED] font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <FileText size={20} className={activeTab === 'leave' ? 'text-[#7C3AED]' : 'text-slate-400'} />
              <span className="text-[10px] mt-0.5">Izin/Cuti</span>
              {activeTab === 'leave' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600] mt-0.5" />
              )}
            </button>

            {/* Tab 4: Stok Bahan */}
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                activeTab === 'stock'
                  ? 'text-[#7C3AED] font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Package size={20} className={activeTab === 'stock' ? 'text-[#7C3AED]' : 'text-slate-400'} />
              <span className="text-[10px] mt-0.5">Stok</span>
              {activeTab === 'stock' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600] mt-0.5" />
              ) : ingredients.filter(i => i.stock <= i.minStock).length > 0 ? (
                <span className="absolute top-1 right-6 w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse" />
              ) : null}
            </button>

            {/* Tab 5: Profil */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'profile'
                  ? 'text-[#7C3AED] font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <UserCheck size={20} className={activeTab === 'profile' ? 'text-[#7C3AED]' : 'text-slate-400'} />
              <span className="text-[10px] mt-0.5">Profil</span>
              {activeTab === 'profile' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600] mt-0.5" />
              )}
            </button>

          </div>
        </nav>

        {/* ══════════════════════════════════════════════════════════════
            MODAL 1: DIGITAL EMPLOYEE ID CARD & QR CODE
           ══════════════════════════════════════════════════════════════ */}
        {showIDCardModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative border border-slate-100">
              <button
                onClick={() => setShowIDCardModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>

              <div className="pt-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#7C3AED] bg-[#F5F3FF] px-3 py-1 rounded-full border border-[#DDD6FE]">
                  Kartu Identitas Karyawan Digital
                </span>
              </div>

              {/* ID Badge Preview */}
              <div className="bg-gradient-to-b from-[#1A1033] to-[#2E1A47] text-white p-6 rounded-3xl shadow-xl space-y-4 border-2 border-[#FFD600]/80">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-[#FFD600] uppercase tracking-wider">
                    {settings?.storeName || 'DEMO CAFE'}
                  </span>
                  <span className="text-[10px] font-mono text-purple-200">
                    ID #{user.id}
                  </span>
                </div>

                <div className={`w-20 h-20 rounded-2xl ${getAvatarGradient(user.role)} flex items-center justify-center font-bold text-3xl mx-auto shadow-lg ring-4 ring-white/20`}>
                  {user.name?.substring(0, 2).toUpperCase()}
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{user.name}</h3>
                  <p className="text-xs text-[#FFD600] font-semibold">{user.role}</p>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-3.5 rounded-2xl max-w-[170px] mx-auto shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`STAFF-${user.id}`)}`}
                    alt="Staff QR"
                    className="w-full h-full object-contain"
                  />
                  <span className="text-[9px] font-mono text-slate-600 font-bold block mt-1">
                    STAFF-{user.id}
                  </span>
                </div>

                <p className="text-[10px] text-purple-200/70">
                  Scan QR code ini di POS Kasir atau KDS Dapur untuk otentikasi instan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIDCardModal(false)}
                className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full shadow-md active:scale-98 transition-all"
              >
                Tutup Kartu ID
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 2: GANTI PIN / PASSWORD
           ══════════════════════════════════════════════════════════════ */}
        {showSecurityModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={15} className="text-[#7C3AED]" />
                  <span>Keamanan Akun Pribadi</span>
                </h3>
                <button onClick={() => setShowSecurityModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              {/* Tabs PIN vs Password */}
              <div className="flex bg-[#F4F6F9] p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setSecurityTab('pin')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    securityTab === 'pin' ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Ubah 6-Digit PIN
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityTab('password')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    securityTab === 'password' ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Ubah Password
                </button>
              </div>

              <form onSubmit={handleUpdateSecurity} className="space-y-3">
                {securityTab === 'pin' ? (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">PIN Lama (Opsional):</label>
                      <input
                        type="password"
                        maxLength={8}
                        value={securityForm.oldPin}
                        onChange={e => setSecurityForm({ ...securityForm, oldPin: e.target.value })}
                        placeholder="Masukkan PIN lama jika ada"
                        className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">PIN Baru (4-8 Digit):</label>
                      <input
                        type="password"
                        required
                        maxLength={8}
                        value={securityForm.newPin}
                        onChange={e => setSecurityForm({ ...securityForm, newPin: e.target.value })}
                        placeholder="Contoh: 123456"
                        className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Konfirmasi PIN Baru:</label>
                      <input
                        type="password"
                        required
                        maxLength={8}
                        value={securityForm.confirmPin}
                        onChange={e => setSecurityForm({ ...securityForm, confirmPin: e.target.value })}
                        placeholder="Ketik ulang PIN baru"
                        className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Password Lama:</label>
                      <input
                        type="password"
                        value={securityForm.oldPassword}
                        onChange={e => setSecurityForm({ ...securityForm, oldPassword: e.target.value })}
                        placeholder="Masukkan password saat ini"
                        className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Password Baru:</label>
                      <input
                        type="password"
                        required
                        value={securityForm.newPassword}
                        onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                        placeholder="Minimal 4 karakter"
                        className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Konfirmasi Password Baru:</label>
                      <input
                        type="password"
                        required
                        value={securityForm.confirmPassword}
                        onChange={e => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                        placeholder="Ketik ulang password baru"
                        className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSecurityModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSecurity}
                    className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full shadow-md"
                  >
                    {submittingSecurity ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 3: EDIT PROFILE NAME
           ══════════════════════════════════════════════════════════════ */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider">Perbarui Nama Profil</h3>
                <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Nama Lengkap:</label>
                  <input
                    type="text"
                    required
                    value={profileNameInput}
                    onChange={e => setProfileNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-[#7C3AED]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProfile}
                    className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full shadow-md"
                  >
                    {submittingProfile ? 'Menyimpan...' : 'Simpan Nama'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 4: BUAT CATATAN SERAH TERIMA SHIFT (HANDOVER)
           ══════════════════════════════════════════════════════════════ */}
        {showNewHandoverModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList size={15} className="text-[#7C3AED]" />
                  <span>Buat Serah Terima Shift</span>
                </h3>
                <button onClick={() => setShowNewHandoverModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitHandover} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Operan Shift:</label>
                  <select
                    value={handoverForm.shiftName}
                    onChange={e => setHandoverForm({ ...handoverForm, shiftName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Shift Pagi ke Shift Sore">Shift Pagi ➔ Shift Sore</option>
                    <option value="Shift Sore ke Shift Malam">Shift Sore ➔ Shift Malam</option>
                    <option value="Shift Malam ke Shift Pagi">Shift Malam ➔ Shift Pagi</option>
                    <option value="Handover General / Penutupan">Handover General / Penutupan</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Sisa Kas Fisik di Laci (Rp):</label>
                  <input
                    type="number"
                    value={handoverForm.cashBalance}
                    onChange={e => setHandoverForm({ ...handoverForm, cashBalance: e.target.value })}
                    placeholder="Contoh: 500000"
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Status Mesin & Area:</label>
                  <input
                    type="text"
                    value={handoverForm.equipmentStatus}
                    onChange={e => setHandoverForm({ ...handoverForm, equipmentStatus: e.target.value })}
                    placeholder="Contoh: Mesin espresso & grinder normal, chiller aman"
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Catatan Tugas / Titipan:</label>
                  <textarea
                    rows={3}
                    required
                    value={handoverForm.notes}
                    onChange={e => setHandoverForm({ ...handoverForm, notes: e.target.value })}
                    placeholder="Contoh: Stok susu tinggal 2 botol di kulkas, tolong restock saat supplier datang..."
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewHandoverModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingHandover}
                    className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full shadow-md"
                  >
                    {submittingHandover ? 'Menyimpan...' : 'Simpan Handover'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 5: BUAT PENGAJUAN IZIN / SAKIT
           ══════════════════════════════════════════════════════════════ */}
        {showNewLeaveModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider">Pengajuan Izin / Cuti</h3>
                <button onClick={() => setShowNewLeaveModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitLeave} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Jenis Pengajuan:</label>
                  <select
                    value={leaveForm.type}
                    onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Izin">Izin (Keperluan Mendesak)</option>
                    <option value="Sakit">Sakit (Dengan / Tanpa Surat Dokter)</option>
                    <option value="Cuti">Cuti Tahunan</option>
                    <option value="Tukar Shift">Tukar Shift Kerja</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Mulai Tanggal:</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Sampai Tanggal:</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Alasan Pengajuan:</label>
                  <textarea
                    rows={3}
                    required
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Tuliskan alasan izin atau kondisi sakit..."
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>

                {/* Upload Foto Surat Dokter */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={leavePhotoRef}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setLeaveForm({ ...leaveForm, photoUrl: ev.target?.result as string });
                        };
                        reader.readAsDataURL(f);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => leavePhotoRef.current?.click()}
                    className="w-full py-2 bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] rounded-xl text-xs font-semibold border border-[#DDD6FE]/60 flex items-center justify-center gap-1.5"
                  >
                    <Upload size={13} />
                    <span>{leaveForm.photoUrl ? '✓ Foto Lampiran Terpilih' : 'Unggah Foto Bukti / Surat Dokter'}</span>
                  </button>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewLeaveModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLeave}
                    className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full shadow-md"
                  >
                    {submittingLeave ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 6: LAPOR STOCK LOSS
           ══════════════════════════════════════════════════════════════ */}
        {showLossModal && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-[#F43F5E] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown size={14} />
                  <span>Pencatatan Bahan Rusak / Basi</span>
                </h3>
                <button onClick={() => setShowLossModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitStockLoss} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Pilih Bahan Baku:</label>
                  <select
                    required
                    value={lossForm.ingredientId}
                    onChange={e => setLossForm({ ...lossForm, ingredientId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Pilih Bahan --</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (Stok: {ing.stock} {ing.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Jumlah Rusak / Terbuang:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={lossForm.qtyLoss}
                    onChange={e => setLossForm({ ...lossForm, qtyLoss: e.target.value })}
                    placeholder="Contoh: 0.5 atau 2"
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Penyebab Kerugian:</label>
                  <select
                    value={lossForm.reason}
                    onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Busuk / Kadaluarsa">Busuk / Kadaluarsa</option>
                    <option value="Tumpah / Pecah">Tumpah / Pecah</option>
                    <option value="Salah Buat / Reject Order">Salah Buat / Reject Order</option>
                    <option value="Hilang / Selisih Opname">Hilang / Selisih Opname</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Catatan Tambahan:</label>
                  <input
                    type="text"
                    value={lossForm.notes}
                    onChange={e => setLossForm({ ...lossForm, notes: e.target.value })}
                    placeholder="Contoh: Susu basi saat chiller mati semalam"
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLossModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLoss}
                    className="flex-1 py-2.5 bg-[#F43F5E] hover:bg-rose-600 text-white font-bold text-xs rounded-full shadow-md"
                  >
                    {submittingLoss ? 'Menyimpan...' : 'Simpan Loss'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 7: QUICK RESTOCK
           ══════════════════════════════════════════════════════════════ */}
        {adjustModal.open && adjustModal.ingredient && (
          <div className="fixed inset-0 z-50 bg-[#1A1033]/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-[#1A1033] uppercase tracking-wider">+ Restock Masuk</h3>
                  <p className="text-[11px] text-[#7C3AED] font-bold">{adjustModal.ingredient.name}</p>
                </div>
                <button
                  onClick={() => setAdjustModal({ open: false, ingredient: null })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleQuickAdjust} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Jumlah Barang Masuk ({adjustModal.ingredient.unit}):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    required
                    value={adjustForm.change}
                    onChange={e => setAdjustForm({ ...adjustForm, change: e.target.value })}
                    placeholder={`Contoh: 5 atau 10 ${adjustModal.ingredient.unit}`}
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Keterangan / Faktur:</label>
                  <input
                    type="text"
                    value={adjustForm.description}
                    onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })}
                    placeholder="Contoh: Belanja di pasar / supplier datang"
                    className="w-full px-3 py-2 bg-[#F4F6F9] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModal({ open: false, ingredient: null })}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdjust}
                    className="flex-1 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-full shadow-md"
                  >
                    {submittingAdjust ? 'Menyimpan...' : 'Simpan Restock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StaffPWAView;
