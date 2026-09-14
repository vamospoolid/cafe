import React, { useState, useEffect, useRef } from 'react';
import { 
  Fingerprint, Camera, MapPin, CheckCircle2, AlertTriangle, 
  Clock, Package, TrendingDown, RefreshCw, Plus, ArrowLeft, 
  LogOut, Sparkles, Coffee, Utensils, ShoppingBag, 
  Calendar, Check, AlertCircle, ChevronRight, X, User,
  Award, ShieldCheck, DollarSign, ChevronDown, CheckCircle,
  Zap, Info, Bell, Search, Filter, Trash2, CheckSquare,
  FileText, ClipboardList, Send, Upload, FileCheck, CheckCheck, RefreshCcw,
  Smartphone, UserCheck, KeyRound
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

  // Helper avatar gradient based on role/name
  const getAvatarGradient = (role: string = '', name: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('barista') || r.includes('kopi')) return 'from-amber-500 to-orange-600';
    if (r.includes('chef') || r.includes('dapur') || r.includes('cook')) return 'from-rose-500 to-red-600';
    if (r.includes('kasir') || r.includes('cashier')) return 'from-emerald-500 to-teal-600';
    if (r.includes('waiter') || r.includes('server') || r.includes('pramusaji')) return 'from-cyan-500 to-blue-600';
    if (r.includes('admin') || r.includes('manager') || r.includes('lead')) return 'from-purple-500 to-indigo-600';
    
    const colors = [
      'from-blue-600 to-indigo-700',
      'from-emerald-500 to-teal-600',
      'from-purple-600 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-cyan-600 to-blue-700'
    ];
    const idx = (name || 'A').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
    return colors[idx];
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
      setCurrentDateStr(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
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

  // Change PIN Modal State
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinForm, setChangePinForm] = useState({ oldPin: '', newPin: '', confirmPin: '' });
  const [submittingChangePin, setSubmittingChangePin] = useState(false);

  // Distance calculator (Haversine)
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
        setGpsError('Gagal mendeteksi GPS. Harap izinkan akses lokasi di browser/aplikasi.');
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
        setIngredients(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStockLoading(false);
    }
  };

  // Fetch Leave Requests
  const fetchMyLeaves = async () => {
    if (!token || !user?.id) return;
    setLeaveLoading(true);
    try {
      const res = await fetch(`/api/attendance/leaves?userId=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setLeaveRequests(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLeaveLoading(false);
    }
  };

  // Tab Change Fetcher
  useEffect(() => {
    if (!token) return;
    fetchMySummary();
    if (activeTab === 'attendance') {
      requestGpsLocation();
    } else if (activeTab === 'stock') {
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
        setTimeout(() => handlePinSubmit(newPin), 150);
      }
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
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto shadow-2xl relative select-none font-sans text-white antialiased overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand & Time Header */}
        <div className="text-center pt-2 space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">
              {currentTime} • {settings?.storeName || 'SOL CAFE'}
            </span>
          </div>
          <h1 className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-2">
            <Sparkles size={16} className="text-[#0052cc]" />
            <span>Portal Karyawan & Absensi</span>
          </h1>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-[2.2rem] p-5 shadow-2xl relative z-10 space-y-4 my-auto backdrop-blur-xl">
          {activeStaffToLogin ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffUser(null);
                    setSavedDeviceStaff(null);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <ArrowLeft size={13} />
                  <span>Ganti Akun</span>
                </button>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  PIN Individu
                </span>
              </div>

              <div className="text-center space-y-2 pt-1">
                <div className="relative inline-block">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(activeStaffToLogin.role, activeStaffToLogin.name)} text-white flex items-center justify-center font-black text-xl shadow-lg border-2 border-white/20 mx-auto ring-4 ring-blue-500/20`}>
                    {activeStaffToLogin.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
                </div>

                <div>
                  <h2 className="text-base font-black text-white tracking-tight">
                    {activeStaffToLogin.name}
                  </h2>
                  <div className="inline-flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-blue-300 font-extrabold border border-slate-700">
                      {activeStaffToLogin.role}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Ketik 6-digit PIN rahasia Anda untuk mulai bertugas
                </p>
              </div>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3 py-1">
                {[0, 1, 2, 3, 4, 5].map(idx => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      pinInput.length > idx
                        ? 'bg-[#0052cc] scale-125 shadow-md shadow-blue-500/60 ring-2 ring-blue-400/40'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-xs text-rose-400 font-bold text-center bg-rose-500/10 py-2 px-3 rounded-xl border border-rose-500/30 animate-shake">
                  {pinError}
                </p>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    disabled={pinLoading}
                    onClick={() => handleKeypadClick(num)}
                    className="h-12 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:bg-blue-600 text-white text-lg font-black transition-all active:scale-95 border border-slate-700/80 flex items-center justify-center shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => setPinInput('')}
                  className="h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-black transition-all active:scale-95 border border-rose-500/20 flex items-center justify-center"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handleKeypadClick('0')}
                  className="h-12 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:bg-blue-600 text-white text-lg font-black transition-all active:scale-95 border border-slate-700/80 flex items-center justify-center shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => setPinInput(prev => prev.slice(0, -1))}
                  className="h-12 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all active:scale-95 border border-slate-700/80 flex items-center justify-center"
                >
                  ⌫
                </button>
              </div>

              {/* Remember Profile Toggle */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between px-2">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={e => setRememberDevice(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-[#0052cc] focus:ring-0"
                  />
                  <span>Ingat profil di HP ini</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffUser(null);
                    setSavedDeviceStaff(null);
                    setPinInput('');
                  }}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Pilih Staf Lain →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <User size={16} className="text-[#0052cc]" />
                    <span>Pilih Profil Anda</span>
                  </h3>
                  <p className="text-[10px] text-slate-400">Pilih nama karyawan untuk memasukkan PIN</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-blue-400 border border-slate-700">
                  {staffList.length} Staf
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={e => setStaffSearchQuery(e.target.value)}
                  placeholder="Cari nama atau role staf..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold scrollbar-none">
                {['ALL', 'BARISTA', 'KITCHEN', 'CASHIER', 'WAITER', 'MANAGER'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelectedRoleFilter(chip)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                      selectedRoleFilter === chip
                        ? 'bg-[#0052cc] text-white shadow-sm font-black'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
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
                    className="p-3 rounded-2xl border border-slate-800 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500/50 text-left transition-all active:scale-95 group shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${getAvatarGradient(st.role, st.name)} text-white flex items-center justify-center font-black text-xs group-hover:scale-105 transition-transform shadow-sm`}>
                        {st.name.substring(0, 2).toUpperCase()}
                      </div>
                      <ChevronRight size={14} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white truncate">{st.name}</div>
                      <div className="text-[10px] text-blue-300 font-semibold truncate mt-0.5">{st.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Return Link */}
        <div className="text-center pb-2 relative z-10">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors py-1 px-3 rounded-full hover:bg-slate-800/50"
          >
            <ArrowLeft size={14} /> Kembali ke Kasir Utama POS
          </a>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER AUTHENTICATED STAFF APP WITH 4 ESSENTIAL TABS
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900/90 flex flex-col items-center justify-start sm:py-6 sm:px-4 font-sans select-none antialiased">
      <div className="w-full sm:max-w-[430px] min-h-screen sm:min-h-[860px] bg-slate-100 sm:rounded-[2rem] shadow-2xl sm:border sm:border-slate-800 flex flex-col relative overflow-hidden">
        
        {/* TOP APP BAR */}
        <div className="bg-slate-900 text-white px-5 pt-4 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                {settings?.storeName || 'SOL CAFE'} • PORTAL STAF
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <LogOut size={13} />
              <span>Keluar</span>
            </button>
          </div>

          <div className="pt-3 flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${getAvatarGradient(user.role, user.name)} text-white flex items-center justify-center font-black text-base shadow-sm shrink-0`}>
              {user.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white truncate">{user.name}</h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-blue-300 font-extrabold border border-slate-700">
                  {user.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                <Clock size={12} className="text-emerald-400" />
                <span className="font-mono font-bold text-slate-200">{currentTime}</span>
                <span className="text-slate-600">•</span>
                <span className="truncate">{currentDateStr}</span>
              </p>
            </div>
          </div>

          {/* Shift status banner */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Status:</span>
              {mySummary?.todayStatus?.clockedIn ? (
                mySummary?.todayStatus?.clockedOut ? (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[10px] font-black">
                    ✓ Selesai Shift
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Sedang Bertugas
                  </span>
                )
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Belum Presensi
                </span>
              )}
            </div>

            {mySummary?.todayStatus?.todayLog?.shiftName && (
              <span className="text-[10px] text-slate-300 font-extrabold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                {mySummary.todayStatus.todayLog.shiftName.split('(')[0]}
              </span>
            )}
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto pb-24">
          {/* TAB 1: PRESENSI */}
          {activeTab === 'attendance' && (
            <div className="p-4 space-y-4 animate-fade-in">
              {/* GPS RADAR CARD */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                    isWithinRadius ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>{settings?.storeName || 'SOL CAFE'}</span>
                      {isWithinRadius && <CheckCircle2 size={14} className="text-emerald-500" />}
                    </h4>
                    <p className="text-[11px] font-semibold mt-0.5">
                      {gpsLoading ? (
                        <span className="text-amber-600 flex items-center gap-1">
                          <RefreshCw size={11} className="animate-spin" /> Mengunci koordinat GPS...
                        </span>
                      ) : isWithinRadius ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <span>✓ GPS Valid</span>
                          <span className="text-slate-400 font-normal font-mono">
                            ({gpsDistance !== null ? `${gpsDistance}m` : '0m'} / {settings?.gpsRadiusMeters || 150}m)
                          </span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">
                          Di Luar Radius ({gpsDistance !== null ? `${gpsDistance}m` : '-'})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={requestGpsLocation}
                  disabled={gpsLoading}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 active:scale-95 shrink-0 transition-all shadow-sm"
                  title="Perbarui GPS"
                >
                  <RefreshCw size={14} className={gpsLoading ? 'animate-spin text-[#0052cc]' : ''} />
                </button>
              </div>

              {/* SHIFT SELECTOR */}
              {!mySummary?.todayStatus?.clockedIn && shifts.length > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock size={14} className="text-[#0052cc]" /> Jadwal Shift Kerja:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {shifts.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedShiftId(s.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedShiftId === s.id
                            ? 'border-2 border-[#0052cc] bg-blue-50/70 shadow-sm'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-black text-slate-900 truncate flex items-center justify-between">
                          <span>{s.name}</span>
                          {selectedShiftId === s.id && <Check size={12} className="text-[#0052cc]" />}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold mt-0.5">{s.start} - {s.end}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DIRECT ACTIVE CAMERA CONTAINER */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-xs font-black text-slate-900">
                      Live Kamera Selfie Presensi
                    </h4>
                  </div>
                  {capturedPhoto && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      ✓ Foto Terverifikasi
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
                    {/* Live Video Viewfinder */}
                    <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-square max-w-[290px] mx-auto border-4 border-[#0052cc] shadow-xl ring-4 ring-blue-500/15">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'transform -scale-x-100' : ''}`}
                      />
                      
                      {/* Face Alignment Oval Guide */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-56 border-2 border-dashed border-emerald-400/70 rounded-[4rem] animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center justify-center">
                          <span className="text-[9px] font-black text-white/80 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            Posisikan Wajah
                          </span>
                        </div>
                      </div>

                      {/* Top Floating Controls */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-black text-emerald-400 border border-white/10 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE
                        </span>

                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 active:scale-90 transition-transform shadow-md"
                          title="Ganti Kamera Depan/Belakang"
                        >
                          <RefreshCcw size={14} />
                        </button>
                      </div>

                      {/* Bottom Shutter Capture Action */}
                      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center pointer-events-auto">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="w-14 h-14 rounded-full bg-white text-[#0052cc] flex items-center justify-center shadow-2xl active:scale-90 border-4 border-blue-500 hover:scale-105 transition-all group"
                          title="Ambil Foto Presensi"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#0052cc] group-hover:bg-blue-700 transition-colors flex items-center justify-center text-white">
                            <Camera size={16} />
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Fallback Native Camera Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Smartphone size={13} className="text-[#0052cc]" />
                      <span>Buka Kamera HP (Jika Browser Tidak Mendukung)</span>
                    </button>
                  </div>
                ) : (
                  /* Captured Photo Preview Card */
                  <div className="space-y-3">
                    <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-square max-w-[220px] mx-auto border-4 border-emerald-500 shadow-xl ring-4 ring-emerald-500/20">
                      <img src={capturedPhoto} alt="Selfie" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          startCamera();
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors shadow-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhoto(null);
                        startCamera();
                      }}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <RefreshCw size={13} />
                      <span>Ambil Ulang Foto Selfie</span>
                    </button>
                  </div>
                )}

                {/* BUTTON ACTION CLOCK IN / OUT */}
                <div className="pt-2 border-t border-slate-100">
                  {!mySummary?.todayStatus?.clockedIn ? (
                    <button
                      type="button"
                      disabled={clockLoading || !isWithinRadius}
                      onClick={() => handleClockAction('IN')}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                      <CheckCircle2 size={18} />
                      <span>{clockLoading ? 'Memproses Presensi...' : 'CLOCK IN (MASUK KERJA)'}</span>
                    </button>
                  ) : !mySummary?.todayStatus?.clockedOut ? (
                    <button
                      type="button"
                      disabled={clockLoading}
                      onClick={() => handleClockAction('OUT')}
                      className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95"
                    >
                      <LogOut size={18} />
                      <span>{clockLoading ? 'Memproses Presensi...' : 'CLOCK OUT (SELESAI SHIFT)'}</span>
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 text-center text-xs font-bold text-emerald-800 border border-emerald-200">
                      ✓ Anda telah menyelesaikan shift hari ini. Terima kasih atas kerja keras Anda!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IZIN & CUTI */}
          {activeTab === 'leave' && (
            <div className="p-4 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Pengajuan Izin & Sakit</h3>
                  <p className="text-[10px] text-slate-400">Pengajuan digital tanpa surat manual</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewLeaveModal(true)}
                  className="py-2 px-3 rounded-2xl bg-[#0052cc] hover:bg-blue-800 text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Plus size={14} />
                  <span>Buat Izin</span>
                </button>
              </div>

              {leaveRequests.length === 0 ? (
                <div className="py-12 bg-white rounded-3xl border border-slate-200 text-center space-y-2 p-4">
                  <FileCheck size={36} className="mx-auto text-slate-300" />
                  <h4 className="text-sm font-black text-slate-700">Belum Ada Pengajuan</h4>
                  <p className="text-xs text-slate-400">Tekan tombol "+ Buat Izin" untuk mengajukan izin/sakit/cuti.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map(item => (
                    <div
                      key={item.id}
                      className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">{item.type}</span>
                          <span className="text-[10px] text-slate-400">
                            ({item.startDate === item.endDate ? item.startDate : `${item.startDate} s/d ${item.endDate}`})
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
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

                      {item.adminNotes && (
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                          <strong>Catatan Admin ({item.approvedBy || 'Admin'}):</strong> {item.adminNotes}
                        </div>
                      )}

                      {item.photoUrl && (
                        <div className="pt-1">
                          <a
                            href={item.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#0052cc] font-bold hover:underline flex items-center gap-1"
                          >
                            <FileText size={11} /> Lihat Bukti / Surat Dokter
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STOK BAHAN BAKU & KERUSAKAN */}
          {activeTab === 'stock' && (
            <div className="p-4 space-y-4 animate-fade-in">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLossModal(true)}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-rose-100 shadow-sm"
                >
                  <TrendingDown size={14} />
                  <span>Lapor Bahan Rusak / Basi</span>
                </button>
                <button
                  type="button"
                  onClick={fetchIngredients}
                  className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Refresh Stok"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="bg-white p-3 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="Cari bahan (kopi, susu, sirup, dll)..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1 text-center">
                  <button
                    onClick={() => setStockCategory('ALL')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold ${
                      stockCategory === 'ALL' ? 'bg-[#0052cc] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Semua ({ingredients.length})
                  </button>
                  <button
                    onClick={() => setStockCategory('FOOD')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold ${
                      stockCategory === 'FOOD' ? 'bg-[#0052cc] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Makanan
                  </button>
                  <button
                    onClick={() => setStockCategory('DRINK')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold ${
                      stockCategory === 'DRINK' ? 'bg-[#0052cc] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Minuman
                  </button>
                  <button
                    onClick={() => setStockCategory('LOW')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold ${
                      stockCategory === 'LOW' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ⚠️ Kritis ({ingredients.filter(i => i.stock <= i.minStock).length})
                  </button>
                </div>
              </div>

              {/* List Ingredients */}
              <div className="space-y-2.5">
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
                          isLow ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-black text-slate-900">{ing.name}</h5>
                            {isLow && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
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
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {ing.stock} <span className="text-[10px] font-bold text-slate-500">{ing.unit}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustModal({ open: true, ingredient: ing });
                              setAdjustForm({ change: '', description: '' });
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-[#0052cc] hover:bg-blue-100 font-bold text-[10px] border border-blue-200"
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

          {/* TAB 4: PROFIL SAYA & STATISTIK PRESENSI */}
          {activeTab === 'profile' && (
            <div className="p-4 space-y-4 animate-fade-in">
              {/* Profil Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
                <div className="relative inline-block">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(user?.role, user?.name)} text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-white mx-auto`}>
                    {user?.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900">{user?.name}</h3>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100 inline-block mt-1">
                    {user?.role}
                  </span>
                </div>
              </div>

              {/* STATS TILES */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-400">Total Hadir</p>
                  <h4 className="text-base font-black text-[#0052cc]">{mySummary?.stats?.totalHadir || 0} Hari</h4>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-400">Terlambat</p>
                  <h4 className="text-base font-black text-rose-600">{mySummary?.stats?.totalTerlambat || 0}x</h4>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-400">Jam Kerja</p>
                  <h4 className="text-base font-black text-slate-800">{mySummary?.stats?.totalWorkHours || 0} Jam</h4>
                </div>
              </div>

              {/* Shift Bertugas Hari Ini */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <h4 className="text-xs font-black text-slate-900 border-b pb-2 flex items-center justify-between">
                  <span>Informasi Shift Bertugas</span>
                  <span className="text-[10px] font-bold text-slate-400">Hari Ini</span>
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
                      {mySummary?.todayStatus?.todayLog?.clockIn || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jam Pulang (Clock Out):</span>
                    <span className="font-bold text-slate-800">
                      {mySummary?.todayStatus?.todayLog?.clockOut || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout Action */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs rounded-2xl border border-rose-200 flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <LogOut size={15} />
                <span>Keluar dari Akun Staf</span>
              </button>
            </div>
          )}
        </div>

        {/* STICKY BOTTOM 4 TABS DOCK */}
        <nav className="fixed bottom-0 left-0 right-0 sm:max-w-[430px] mx-auto z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] py-2 px-3 sm:rounded-b-[2rem]">
          <div className="flex items-center justify-around">
            {/* Tab 1: Presensi */}
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'attendance'
                  ? 'text-[#0052cc] font-black scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${activeTab === 'attendance' ? 'bg-blue-50 text-[#0052cc]' : ''}`}>
                <Fingerprint size={20} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Presensi</span>
            </button>

            {/* Tab 2: Izin / Cuti */}
            <button
              type="button"
              onClick={() => setActiveTab('leave')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                activeTab === 'leave'
                  ? 'text-[#0052cc] font-black scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${activeTab === 'leave' ? 'bg-blue-50 text-[#0052cc]' : ''}`}>
                <FileText size={20} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Izin / Cuti</span>
            </button>

            {/* Tab 3: Stok Bahan */}
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                activeTab === 'stock'
                  ? 'text-[#0052cc] font-black scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${activeTab === 'stock' ? 'bg-blue-50 text-[#0052cc]' : ''}`}>
                <Package size={20} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Stok Bahan</span>
              {ingredients.filter(i => i.stock <= i.minStock).length > 0 && (
                <span className="absolute top-1 right-6 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>

            {/* Tab 4: Profil Saya */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'profile'
                  ? 'text-[#0052cc] font-black scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${activeTab === 'profile' ? 'bg-blue-50 text-[#0052cc]' : ''}`}>
                <UserCheck size={20} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">Profil Saya</span>
            </button>
          </div>
        </nav>

        {/* MODAL BUAT PENGAJUAN IZIN */}
        {showNewLeaveModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-sm font-black text-slate-900">Form Pengajuan Izin / Cuti</h3>
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
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
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Mulai:</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Sampai:</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Alasan / Keterangan:</label>
                  <textarea
                    rows={3}
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Ketik alasan izin secara jelas..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewLeaveModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLeave}
                    className="flex-1 py-2.5 bg-[#0052cc] text-white rounded-xl text-xs font-black shadow-md"
                  >
                    {submittingLeave ? 'Mengirim...' : 'Kirim Izin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL LAPOR BAHAN RUSAK */}
        {showLossModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 text-rose-600">
                  <TrendingDown size={16} /> Lapor Bahan Rusak / Basi
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  >
                    <option value="">-- Pilih Bahan --</option>
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} (Sisa: {i.stock} {i.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Jumlah Rusak / Terbuang:</label>
                  <input
                    type="number"
                    step="any"
                    value={lossForm.qtyLoss}
                    onChange={e => setLossForm({ ...lossForm, qtyLoss: e.target.value })}
                    placeholder="Misal: 250"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Penyebab Kerusakan:</label>
                  <select
                    value={lossForm.reason}
                    onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="Busuk / Kadaluarsa">Busuk / Kadaluarsa</option>
                    <option value="Tumpah / Rusak">Tumpah / Rusak</option>
                    <option value="Kesalahan Masak / Gosong">Kesalahan Masak / Gosong</option>
                    <option value="Sisa Trimming / Kupas">Sisa Trimming / Kupas</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLossModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLoss}
                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black shadow-md"
                  >
                    {submittingLoss ? 'Menyimpan...' : 'Simpan Laporan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL QUICK RESTOCK */}
        {adjustModal.open && adjustModal.ingredient && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <h3 className="text-sm font-black text-slate-900">
                  Restock: {adjustModal.ingredient.name}
                </h3>
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
                    Jumlah Masuk ({adjustModal.ingredient.unit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={adjustForm.change}
                    onChange={e => setAdjustForm({ ...adjustForm, change: e.target.value })}
                    placeholder="Misal: 10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModal({ open: false, ingredient: null })}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdjust}
                    className="flex-1 py-2.5 bg-[#0052cc] text-white rounded-xl text-xs font-black shadow-md"
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
