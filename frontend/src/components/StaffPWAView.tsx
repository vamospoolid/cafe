import React, { useState, useEffect, useRef } from 'react';
import { 
  Fingerprint, Camera, MapPin, CheckCircle2, AlertTriangle, 
  Clock, Package, TrendingDown, RefreshCw, Plus, ArrowLeft, 
  LogOut, Coffee, Calendar, Check, AlertCircle, ChevronRight, X, User,
  Award, ShieldCheck, DollarSign, ChevronDown, CheckCircle,
  Zap, Info, Bell, Search, Filter, Trash2, CheckSquare,
  FileText, ClipboardList, Send, Upload, FileCheck, CheckCheck, RefreshCcw,
  Smartphone, UserCheck, KeyRound, ArrowRight, CornerDownLeft, Sparkles
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

  // Login PIN & Fast Switch State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffUser, setSelectedStaffUser] = useState<any | null>(null);

  // Individual Device Memory & Search State
  const [savedDeviceStaff, setSavedDeviceStaff] = useState<any | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('staff_saved_user') || 'null');
    } catch {
      return null;
    }
  });
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');

  // Solid avatar color (no gradient) based on role
  const getAvatarColor = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('barista') || r.includes('kopi')) return 'bg-amber-600 text-white';
    if (r.includes('chef') || r.includes('dapur') || r.includes('cook')) return 'bg-rose-600 text-white';
    if (r.includes('kasir') || r.includes('cashier')) return 'bg-emerald-600 text-white';
    if (r.includes('waiter') || r.includes('server') || r.includes('pramusaji')) return 'bg-sky-600 text-white';
    if (r.includes('admin') || r.includes('manager') || r.includes('lead')) return 'bg-indigo-600 text-white';
    return 'bg-slate-700 text-white';
  };

  // Active Tab: 4 Bottom Tabs: 'attendance' | 'leave' | 'stock' | 'profile'
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'stock' | 'profile'>('attendance');

  // Live Digital Time
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDateStr(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Store Settings & Shifts
  const [settings, setSettings] = useState<any>(null);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('1');

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  // Attendance Clocking State
  const [clockLoading, setClockLoading] = useState(false);
  const [mySummary, setMySummary] = useState<any>(null);

  // Stock State
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING' | 'LOW'>('ALL');

  // Stock Loss Modal State
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossForm, setLossForm] = useState({
    ingredientId: '',
    qtyLoss: '',
    reason: 'Busuk / Kadaluarsa',
    notes: ''
  });
  const [submittingLoss, setSubmittingLoss] = useState(false);

  // Quick Restock Modal State
  const [adjustModal, setAdjustModal] = useState<{ open: boolean; ingredient: Ingredient | null }>({
    open: false,
    ingredient: null
  });
  const [adjustForm, setAdjustForm] = useState({ change: '', description: '' });
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Leave & Permission Requests State
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

  // Calculate Distance (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
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
        setShifts(shiftData);
        if (shiftData.length > 0) setSelectedShiftId(shiftData[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Staff List for Login
  const fetchStaffList = async () => {
    try {
      const res = await fetch('/api/auth/staff-list');
      if (res.ok) {
        const users = await res.json();
        setStaffList(users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettingsAndShifts();
    fetchStaffList();
  }, []);

  // Request GPS
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

        const storeLat = settings?.storeLatitude ?? -6.229728;
        const storeLon = settings?.storeLongitude ?? 106.807464;
        const maxRadius = settings?.gpsRadiusMeters ?? 150;

        const dist = calculateDistance(lat, lng, storeLat, storeLon);
        setGpsDistance(dist);
        setIsWithinRadius(dist <= maxRadius);
      },
      err => {
        setGpsLoading(false);
        setGpsError('Gagal mendeteksi GPS. Harap izinkan akses lokasi di pengaturan HP/browser.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Camera Management with WebRTC + fallback
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
        console.warn('First camera constraint failed, fallback to basic video...', err1);
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

  // Auto attach video stream whenever cameraStream or activeTab changes
  useEffect(() => {
    if (videoRef.current && cameraStream && isCameraActive) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, [cameraStream, isCameraActive, activeTab, capturedPhoto]);

  // Automatically start camera on Attendance Tab when photo is not captured yet
  useEffect(() => {
    if (token && activeTab === 'attendance' && !capturedPhoto) {
      startCamera();
      requestGpsLocation();
    } else if (activeTab !== 'attendance' || !token) {
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

  // Fetch Attendance Summary
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

  // Fetch Leave Requests
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

  useEffect(() => {
    if (!token) return;
    fetchMySummary();
    if (activeTab === 'stock') {
      fetchIngredients();
    } else if (activeTab === 'leave') {
      fetchMyLeaves();
    }
  }, [token, activeTab]);

  // Submit Login PIN
  const handlePinSubmit = async (pinValue: string) => {
    setPinLoading(true);
    setPinError('');
    try {
      const targetUser = selectedStaffUser || savedDeviceStaff;
      const payload: any = { pin: pinValue };
      if (targetUser?.id) {
        payload.userId = targetUser.id;
      }
      const res = await fetch('/api/auth/switch-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('staff_token', data.token);
        localStorage.setItem('staff_user', JSON.stringify(data.user));
        if (rememberDevice) {
          localStorage.setItem('staff_saved_user', JSON.stringify(data.user));
          setSavedDeviceStaff(data.user);
        }
        setToken(data.token);
        setUser(data.user);
        setSelectedStaffUser(null);
        setPinInput('');
        setCapturedPhoto(null);
        toast(`Selamat bertugas, ${data.user.name}!`, 'success');
      } else {
        setPinError(data.error || 'PIN salah atau tidak valid.');
        setPinInput('');
      }
    } catch (e) {
      setPinError('Terjadi kesalahan koneksi.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleKeypadClick = (num: string) => {
    setPinError('');
    if (pinInput.length < 6) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      if (newPin.length === 6) {
        setTimeout(() => handlePinSubmit(newPin), 120);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPinError('');
    if (pinInput.length > 0) {
      setPinInput(pinInput.slice(0, -1));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    setToken('');
    setUser(null);
    setCapturedPhoto(null);
    stopCamera();
    toast('Berhasil keluar sesi', 'info');
  };

  // Perform Clock In / Out
  const handleClockAction = async (type: 'IN' | 'OUT') => {
    if (type === 'IN' && !capturedPhoto && settings?.enableCameraPhoto) {
      return toast('Harap ambil foto selfie terlebih dahulu sebelum Clock In', 'warning');
    }

    if (type === 'IN' && !isWithinRadius && settings?.enableGpsValidation) {
      return toast(`Anda berada di luar radius absensi (${gpsDistance}m dari toko)`, 'error');
    }

    setClockLoading(true);
    try {
      const selectedShift = shifts.find(s => s.id === selectedShiftId);
      const payload = {
        pin: user?.pin || '',
        type,
        shiftId: selectedShiftId,
        shiftName: selectedShift ? `${selectedShift.name} (${selectedShift.start} - ${selectedShift.end})` : 'Shift Pagi',
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
        toast(data.message || 'Absensi berhasil diproses!', 'success');
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

  // ─────────────────────────────────────────────────────────────
  // RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  // ─────────────────────────────────────────────────────────────
  if (!token || !user) {
    const activeStaffToLogin = selectedStaffUser || savedDeviceStaff;

    const filteredStaffList = staffList.filter(st => {
      const matchQuery = st.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                         (st.role && st.role.toLowerCase().includes(staffSearchQuery.toLowerCase()));
      if (!matchQuery) return false;
      if (selectedRoleFilter === 'ALL') return true;
      const r = (st.role || '').toLowerCase();
      if (selectedRoleFilter === 'BARISTA') return r.includes('barista') || r.includes('kopi');
      if (selectedRoleFilter === 'KITCHEN') return r.includes('chef') || r.includes('dapur') || r.includes('cook');
      if (selectedRoleFilter === 'CASHIER') return r.includes('kasir') || r.includes('cashier');
      if (selectedRoleFilter === 'WAITER') return r.includes('waiter') || r.includes('server') || r.includes('pramusaji');
      if (selectedRoleFilter === 'MANAGER') return r.includes('admin') || r.includes('manager') || r.includes('lead');
      return true;
    });

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto relative select-none font-sans text-slate-100 antialiased">
        {/* Brand & Time Header */}
        <div className="text-center pt-3 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300 font-mono tracking-wide">
              {settings?.storeName || 'SOL CAFE'} • {currentTime}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-tight">
            Portal Karyawan & Presensi
          </h1>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 my-auto">
          {activeStaffToLogin ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffUser(null);
                    setSavedDeviceStaff(null);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <ArrowLeft size={13} />
                  <span>Ganti Akun</span>
                </button>

                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  PIN Akses
                </span>
              </div>

              <div className="text-center space-y-2 pt-1">
                <div className={`w-16 h-16 rounded-2xl ${getAvatarColor(activeStaffToLogin.role)} flex items-center justify-center font-bold text-xl mx-auto shadow-md border border-slate-700`}>
                  {activeStaffToLogin.name.substring(0, 2).toUpperCase()}
                </div>

                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {activeStaffToLogin.name}
                  </h2>
                  <div className="inline-flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {activeStaffToLogin.role}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Masukkan 6-digit PIN Anda
                </p>
              </div>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3.5 py-2">
                {[0, 1, 2, 3, 4, 5].map(idx => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      pinInput.length > idx
                        ? 'bg-blue-500 scale-125 shadow-md shadow-blue-500/40'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-center text-xs font-medium text-rose-300">
                  {pinError}
                </div>
              )}

              {/* Minimal Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    disabled={pinLoading}
                    onClick={() => handleKeypadClick(num)}
                    className="h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 text-white font-bold text-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPinInput('')}
                  className="h-14 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 font-semibold text-xs flex items-center justify-center border border-slate-800 transition-all active:scale-95"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handleKeypadClick('0')}
                  className="h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 text-white font-bold text-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-14 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 font-semibold text-xs flex items-center justify-center border border-slate-800 transition-all active:scale-95"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* Staff Selector List */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-white">Pilih Profil Karyawan</h2>
                <p className="text-xs text-slate-400">Pilih nama Anda untuk masuk ke sistem</p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={e => setStaffSearchQuery(e.target.value)}
                  placeholder="Cari nama atau jabatan..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium scrollbar-none">
                {['ALL', 'BARISTA', 'KITCHEN', 'CASHIER', 'WAITER', 'MANAGER'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelectedRoleFilter(chip)}
                    className={`px-3 py-1 rounded-lg shrink-0 transition-all ${
                      selectedRoleFilter === chip
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {chip === 'ALL' ? 'Semua' : chip}
                  </button>
                ))}
              </div>

              {/* Staff Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredStaffList.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedStaffUser(st);
                      setPinInput('');
                      setPinError('');
                    }}
                    className="p-3 rounded-2xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-700 text-left transition-all active:scale-95 group shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 rounded-xl ${getAvatarColor(st.role)} flex items-center justify-center font-bold text-xs shadow-sm`}>
                        {st.name.substring(0, 2).toUpperCase()}
                      </div>
                      <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-300 transition-all" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white truncate">{st.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{st.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Return Link */}
        <div className="text-center pb-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1 px-3 rounded-full hover:bg-slate-900"
          >
            <ArrowLeft size={13} /> Kembali ke Layar Kasir POS
          </a>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER AUTHENTICATED STAFF APP WITH CLEAN 4 TABS
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start sm:py-6 sm:px-4 font-sans select-none antialiased">
      <div className="w-full sm:max-w-[420px] min-h-screen sm:min-h-[850px] bg-slate-50 sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* REFINED COMPACT HEADER */}
        <header className="bg-slate-900 text-white px-4 pt-3.5 pb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl ${getAvatarColor(user.role)} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}>
                {user.name.substring(0, 2).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-bold text-white truncate">{user.name}</h2>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700 shrink-0">
                    {user.role}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                  <Clock size={11} className="text-slate-400" />
                  <span>{currentTime}</span>
                  <span className="text-slate-600">•</span>
                  <span className="truncate">{currentDateStr}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 shrink-0"
              title="Keluar Akun"
            >
              <LogOut size={14} />
            </button>
          </div>

          {/* Clean Status & Shift Sub-bar */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              {mySummary?.todayStatus?.clockedIn ? (
                mySummary?.todayStatus?.clockedOut ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                    <CheckCircle2 size={11} className="text-blue-400" /> Selesai Shift
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sedang Bertugas
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 font-semibold border border-amber-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Belum Presensi
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-400 font-medium">
              {mySummary?.todayStatus?.todayLog?.shiftName ? (
                <span className="text-slate-300 font-semibold">{mySummary.todayStatus.todayLog.shiftName.split('(')[0]}</span>
              ) : (
                <span>{settings?.storeName || 'SOL CAFE'}</span>
              )}
            </div>
          </div>
        </header>

        {/* SCROLLABLE MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto pb-24">
          
          {/* ─────────────────────────────────────────────────────────────
              TAB 1: HERO PRESENSI BIOMETRIC SCANNER
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <div className="p-4 space-y-4">
              
              {/* Shift Selector Buttons */}
              {!mySummary?.todayStatus?.clockedIn && shifts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block px-0.5">
                    Pilih Shift Kerja:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {shifts.map(s => {
                      const isSelected = selectedShiftId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedShiftId(s.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/90 text-blue-950 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate">{s.name}</span>
                            {isSelected && <Check size={12} className="text-blue-600 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            {s.start} - {s.end}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CAMERA SCANNER HERO VIEWFINDER */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
                
                {/* Viewfinder Header Status */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Camera size={15} className="text-slate-600" />
                    <span>Verifikasi Wajah Selfie</span>
                  </div>

                  {capturedPhoto ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle size={11} /> Foto Siap
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">
                      Posisikan di tengah
                    </span>
                  )}
                </div>

                {/* Hidden native camera file input */}
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
                    {/* Live Viewfinder Frame */}
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-w-[280px] mx-auto border border-slate-800 shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'transform -scale-x-100' : ''}`}
                      />
                      
                      {/* Biometric Corner Framing Guides */}
                      <div className="absolute inset-0 pointer-events-none p-5 flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                          <div className="w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                        </div>
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                          <div className="w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                        </div>
                      </div>

                      {/* Face Silhouette Guide */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-40 h-48 border border-dashed border-white/40 rounded-[3rem] flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white/90 bg-black/60 px-2 py-0.5 rounded-full">
                            Wajah
                          </span>
                        </div>
                      </div>

                      {/* Top Overlay Bar */}
                      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-auto">
                        <span className="px-2 py-0.5 rounded-md bg-black/70 text-[9px] font-bold text-emerald-400 border border-white/10 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                        </span>

                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white border border-white/10 transition-all active:scale-90"
                          title="Putar Kamera"
                        >
                          <RefreshCcw size={13} />
                        </button>
                      </div>

                      {/* Tactile Shutter Button */}
                      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center pointer-events-auto">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="w-13 h-13 p-1 rounded-full bg-white/90 border-2 border-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                          title="Ambil Foto"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center">
                            <Camera size={16} />
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Fallback Native Camera Trigger */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Smartphone size={13} />
                      <span>Gunakan Kamera Bawaan HP</span>
                    </button>
                  </div>
                ) : (
                  /* Captured Photo Preview */
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-w-[230px] mx-auto border-2 border-emerald-600 shadow-md">
                      <img src={capturedPhoto} alt="Selfie Presensi" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          startCamera();
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors shadow"
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
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw size={12} />
                      <span>Foto Ulang</span>
                    </button>
                  </div>
                )}

                {/* GPS Status Strip */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isWithinRadius ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      <MapPin size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-[11px] truncate">
                        {settings?.storeName || 'SOL CAFE'}
                      </div>
                      <div className="text-[10px]">
                        {gpsLoading ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" /> Mengunci GPS...
                          </span>
                        ) : isWithinRadius ? (
                          <span className="text-emerald-700 font-medium">
                            ✓ Lokasi Valid ({gpsDistance !== null ? `${gpsDistance}m` : '0m'} / {settings?.gpsRadiusMeters || 150}m)
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium">
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
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all active:scale-95 shrink-0"
                    title="Refresh GPS"
                  >
                    <RefreshCw size={12} className={gpsLoading ? 'animate-spin text-blue-600' : ''} />
                  </button>
                </div>
              </div>

              {/* PRIMARY CLOCK IN / OUT ACTION BUTTON */}
              <div>
                {!mySummary?.todayStatus?.clockedIn ? (
                  <button
                    type="button"
                    disabled={clockLoading || !isWithinRadius}
                    onClick={() => handleClockAction('IN')}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-black disabled:bg-slate-300 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                  >
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{clockLoading ? 'Memproses Presensi...' : 'Presensi Masuk (Clock In)'}</span>
                  </button>
                ) : !mySummary?.todayStatus?.clockedOut ? (
                  <button
                    type="button"
                    disabled={clockLoading}
                    onClick={() => handleClockAction('OUT')}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                  >
                    <LogOut size={16} />
                    <span>{clockLoading ? 'Memproses Presensi...' : 'Presensi Pulang (Clock Out)'}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-50 text-center text-xs font-medium text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>Shift hari ini telah selesai. Terima kasih atas dedikasi Anda!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: IZIN & CUTI
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'leave' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pengajuan Izin & Sakit</h3>
                  <p className="text-[11px] text-slate-500">Kirim permohonan digital ke manajemen</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewLeaveModal(true)}
                  className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Plus size={13} />
                  <span>Buat Izin</span>
                </button>
              </div>

              {leaveRequests.length === 0 ? (
                <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2 p-4">
                  <FileCheck size={32} className="mx-auto text-slate-300" />
                  <h4 className="text-xs font-bold text-slate-700">Belum Ada Pengajuan</h4>
                  <p className="text-[11px] text-slate-400">Tekan "+ Buat Izin" untuk mengajukan izin kerja atau sakit.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {leaveRequests.map(item => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{item.type}</span>
                          <span className="text-[10px] text-slate-500">
                            ({item.startDate === item.endDate ? item.startDate : `${item.startDate} s/d ${item.endDate}`})
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status === 'Approved' ? '✓ Disetujui' : item.status === 'Rejected' ? '✕ Ditolak' : '⏳ Menunggu'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700">"{item.reason}"</p>

                      {item.adminNotes && (
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-600">
                          <strong>Catatan Manajemen ({item.approvedBy || 'Admin'}):</strong> {item.adminNotes}
                        </div>
                      )}

                      {item.photoUrl && (
                        <div className="pt-0.5">
                          <a
                            href={item.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <FileText size={11} /> Lihat Lampiran Surat Dokter
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: STOK BAHAN BAKU
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'stock' && (
            <div className="p-4 space-y-3.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLossModal(true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-100 shadow-sm"
                >
                  <TrendingDown size={13} />
                  <span>Lapor Bahan Basi / Rusak</span>
                </button>
                <button
                  type="button"
                  onClick={fetchIngredients}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Refresh Stok"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Search & Filter */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="Cari nama bahan baku..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                  <button
                    onClick={() => setStockCategory('ALL')}
                    className={`py-1 rounded-lg font-bold ${
                      stockCategory === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Semua ({ingredients.length})
                  </button>
                  <button
                    onClick={() => setStockCategory('FOOD')}
                    className={`py-1 rounded-lg font-bold ${
                      stockCategory === 'FOOD' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Makanan
                  </button>
                  <button
                    onClick={() => setStockCategory('DRINK')}
                    className={`py-1 rounded-lg font-bold ${
                      stockCategory === 'DRINK' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Minuman
                  </button>
                  <button
                    onClick={() => setStockCategory('LOW')}
                    className={`py-1 rounded-lg font-bold ${
                      stockCategory === 'LOW' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
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
                        className={`bg-white p-3 rounded-2xl border shadow-sm flex items-center justify-between gap-3 ${
                          isLow ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-bold text-slate-900">{ing.name}</h5>
                            {isLow && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-600 text-white">
                                Menipis
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Min: {ing.minStock} {ing.unit} {ing.subCategory ? `• ${ing.subCategory}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900 font-mono">
                              {ing.stock} <span className="text-[10px] font-normal text-slate-500">{ing.unit}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustModal({ open: true, ingredient: ing });
                              setAdjustForm({ change: '', description: '' });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] border border-slate-200"
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

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: PROFIL SAYA & REKAP PRESENSI
             ───────────────────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="p-4 space-y-4">
              {/* Profil Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center space-y-2.5">
                <div className={`w-14 h-14 rounded-2xl ${getAvatarColor(user?.role)} flex items-center justify-center font-bold text-xl mx-auto shadow-sm`}>
                  {user?.name?.substring(0, 2).toUpperCase()}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{user?.name}</h3>
                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 inline-block mt-1">
                    {user?.role}
                  </span>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-medium text-slate-500">Total Hadir</p>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{mySummary?.stats?.totalHadir || 0} Hari</h4>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-medium text-slate-500">Terlambat</p>
                  <h4 className="text-sm font-bold text-rose-600 mt-0.5">{mySummary?.stats?.totalTerlambat || 0}x</h4>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-medium text-slate-500">Jam Kerja</p>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{mySummary?.stats?.totalWorkHours || 0} Jam</h4>
                </div>
              </div>

              {/* Shift Bertugas Hari Ini */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <h4 className="text-xs font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                  <span>Status Kehadiran Hari Ini</span>
                  <span className="text-[10px] text-slate-400 font-normal">{currentDateStr}</span>
                </h4>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Shift Terpilih:</span>
                    <span className="font-bold text-slate-800">
                      {mySummary?.todayStatus?.todayLog?.shiftName || 'Belum Presensi'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jam Masuk (Clock In):</span>
                    <span className="font-bold text-emerald-600">
                      {mySummary?.todayStatus?.todayLog?.clockIn 
                        ? new Date(mySummary.todayStatus.todayLog.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jam Pulang (Clock Out):</span>
                    <span className="font-bold text-slate-800">
                      {mySummary?.todayStatus?.todayLog?.clockOut 
                        ? new Date(mySummary.todayStatus.todayLog.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout Action */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs rounded-2xl border border-rose-200 flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <LogOut size={14} />
                <span>Ganti Akun / Keluar</span>
              </button>
            </div>
          )}
        </main>

        {/* ─────────────────────────────────────────────────────────────
            STICKY MINIMAL BOTTOM 4 TABS DOCK
           ───────────────────────────────────────────────────────────── */}
        <nav className="fixed bottom-0 left-0 right-0 sm:max-w-[420px] mx-auto z-40 bg-white border-t border-slate-200 py-2 px-3 sm:rounded-b-3xl shadow-lg">
          <div className="flex items-center justify-around">
            {/* Tab 1: Presensi */}
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'attendance'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'attendance' ? 'bg-slate-100 text-slate-900' : ''}`}>
                <Fingerprint size={19} />
              </div>
              <span className="text-[10px] mt-0.5">Presensi</span>
            </button>

            {/* Tab 2: Izin / Cuti */}
            <button
              type="button"
              onClick={() => setActiveTab('leave')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'leave'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'leave' ? 'bg-slate-100 text-slate-900' : ''}`}>
                <FileText size={19} />
              </div>
              <span className="text-[10px] mt-0.5">Izin / Cuti</span>
            </button>

            {/* Tab 3: Stok Bahan */}
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                activeTab === 'stock'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'stock' ? 'bg-slate-100 text-slate-900' : ''}`}>
                <Package size={19} />
              </div>
              <span className="text-[10px] mt-0.5">Stok Bahan</span>
              {ingredients.filter(i => i.stock <= i.minStock).length > 0 && (
                <span className="absolute top-1 right-6 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>

            {/* Tab 4: Profil Saya */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'profile'
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-slate-100 text-slate-900' : ''}`}>
                <UserCheck size={19} />
              </div>
              <span className="text-[10px] mt-0.5">Profil Saya</span>
            </button>
          </div>
        </nav>

        {/* MODAL BUAT PENGAJUAN IZIN */}
        {showNewLeaveModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Form Pengajuan Izin / Cuti</h3>
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
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
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Sampai Tanggal:</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Alasan Pengajuan:</label>
                  <textarea
                    rows={3}
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Tulis alasan izin / sakit secara jelas..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewLeaveModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLeave}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    {submittingLeave ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL LAPOR STOCK LOSS */}
        {showLossModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
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
                    value={lossForm.ingredientId}
                    onChange={e => setLossForm({ ...lossForm, ingredientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
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
                    value={lossForm.qtyLoss}
                    onChange={e => setLossForm({ ...lossForm, qtyLoss: e.target.value })}
                    placeholder="Contoh: 0.5 atau 2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Penyebab Kerugian:</label>
                  <select
                    value={lossForm.reason}
                    onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
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
                    placeholder="Contoh: Susu basi saat buka kulkas pagi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLossModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLoss}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    {submittingLoss ? 'Menyimpan...' : 'Simpan Loss'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL QUICK RESTOCK */}
        {adjustModal.open && adjustModal.ingredient && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">+ Restock Masuk</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">{adjustModal.ingredient.name}</p>
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
                    value={adjustForm.change}
                    onChange={e => setAdjustForm({ ...adjustForm, change: e.target.value })}
                    placeholder={`Misal: 5 atau 10 ${adjustModal.ingredient.unit}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Keterangan / Faktur:</label>
                  <input
                    type="text"
                    value={adjustForm.description}
                    onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })}
                    placeholder="Contoh: Beli di pasar / supplier datang"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModal({ open: false, ingredient: null })}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdjust}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm"
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
