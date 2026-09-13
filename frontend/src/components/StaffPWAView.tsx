import React, { useState, useEffect, useRef } from 'react';
import { 
  Fingerprint, Camera, MapPin, CheckCircle2, AlertTriangle, 
  Clock, Package, TrendingDown, RefreshCw, Plus, ArrowLeft, 
  LogOut, ShieldAlert, Sparkles, Coffee, Utensils, ShoppingBag, 
  History, Calendar, Check, AlertCircle, ChevronRight, X, Phone, User,
  Award, ShieldCheck, Flame, DollarSign, Layers, ChevronDown, CheckCircle,
  Zap, Info, Bell, Search, Filter, ArrowUpRight, Copy, ShoppingCart, List, 
  ArrowDownLeft, FileDown, Trash2, CheckSquare, MessageCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  unit: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  supplier?: { id: number; name: string; phone?: string } | null;
}

interface AttendanceLog {
  id: number;
  date: string;
  clockIn: string;
  clockOut?: string;
  shiftName?: string;
  photoIn?: string;
  photoOut?: string;
  distanceIn?: number;
  isWithinRadius?: boolean;
  status: string;
  lateMinutes?: number;
  notes?: string;
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
  const [loginMode, setLoginMode] = useState<'pin' | 'kiosk' | 'qr'>('kiosk');
  const [badgeCodeInput, setBadgeCodeInput] = useState('');
  
  // Barcode / QR Camera Scanner State
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const [isScannerScanning, setIsScannerScanning] = useState(false);
  const scannerIntervalRef = useRef<any>(null);

  // Active Tab: 'attendance' | 'stock' | 'recap'
  const [activeTab, setActiveTab] = useState<'attendance' | 'stock' | 'recap'>('attendance');

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
  const [selectedShiftId, setSelectedShiftId] = useState<string>('pagi');

  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');

  // Attendance Clocking State
  const [clockLoading, setClockLoading] = useState(false);
  const [mySummary, setMySummary] = useState<any>(null);

  // Kitchen Stock State
  const [stockSubTab, setStockSubTab] = useState<'catalog' | 'movements' | 'shopping'>('catalog');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState<'ALL' | 'FOOD' | 'DRINK' | 'PACKAGING' | 'LOW'>('ALL');

  // Daily Movements State
  const [todayMovements, setTodayMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Custom Shopping List State
  const [customShoppingItems, setCustomShoppingItems] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('staff_custom_shopping_items') || '[]');
    } catch {
      return [];
    }
  });
  const [newShoppingInput, setNewShoppingInput] = useState('');

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

  const userRole = (user?.role || '').trim().toLowerCase();
  const isCashierOrWaiter = ['kasir', 'cashier', 'waiter', 'pelayan'].includes(userRole);
  const isKitchenStaff = !!user && !isCashierOrWaiter && ['dapur', 'kitchen', 'barista', 'chef', 'admin', 'superadmin', 'owner'].includes(userRole);

  // Auto-switch to attendance tab if user is not authorized for kitchen/stock activities
  useEffect(() => {
    if (!isKitchenStaff && activeTab === 'stock') {
      setActiveTab('attendance');
    }
  }, [isKitchenStaff, activeTab]);

  // Distance calculator helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Fetch Settings & Shifts
  const fetchSettingsAndShifts = async () => {
    try {
      const resShifts = await fetch('/api/attendance/shifts');
      if (resShifts.ok) {
        const data = await resShifts.json();
        setShifts(data);
        if (data.length > 0) setSelectedShiftId(data[0].id);
      }

      if (token) {
        const resSet = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resSet.ok) {
          const s = await resSet.json();
          setSettings(s);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch GPS Location
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
        const maxRadius = settings?.gpsRadiusMeters ?? 100;

        const dist = calculateDistance(lat, lng, storeLat, storeLon);
        setGpsDistance(dist);
        setIsWithinRadius(dist <= maxRadius);
      },
      err => {
        setGpsLoading(false);
        setGpsError('Gagal mendeteksi GPS. Harap izinkan akses lokasi di browser HP.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Camera Management
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('Camera error:', e);
      toast('Gagal mengakses kamera. Harap beri izin kamera.', 'error');
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

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 480;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  // Fetch My Attendance Summary
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

  // Fetch Kitchen Stock
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

  // Fetch Active Staff for 1-Tap Avatar Switcher
  const fetchStaffList = async () => {
    try {
      const res = await fetch('/api/auth/staff-list');
      if (res.ok) {
        const list = await res.json();
        setStaffList(list);
      }
    } catch (e) {
      console.error('Failed to load staff list:', e);
    }
  };

  // Fetch Today's Stock Movements
  const fetchTodayMovements = async () => {
    if (!token) return;
    setMovementsLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/ingredients/stock-movements?date=${todayStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTodayMovements(data);
      }
    } catch (e) {
      console.error('Failed to fetch stock movements:', e);
    } finally {
      setMovementsLoading(false);
    }
  };

  const handleAddCustomShoppingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShoppingInput.trim()) return;
    const updated = [...customShoppingItems, newShoppingInput.trim()];
    setCustomShoppingItems(updated);
    localStorage.setItem('staff_custom_shopping_items', JSON.stringify(updated));
    setNewShoppingInput('');
    toast('Item belanja berhasil ditambahkan!', 'success');
  };

  const handleRemoveCustomShoppingItem = (index: number) => {
    const updated = customShoppingItems.filter((_, i) => i !== index);
    setCustomShoppingItems(updated);
    localStorage.setItem('staff_custom_shopping_items', JSON.stringify(updated));
    toast('Item dihapus dari daftar', 'info');
  };

  const handleClearCustomShoppingItems = () => {
    setCustomShoppingItems([]);
    localStorage.removeItem('staff_custom_shopping_items');
    toast('Catatan tambahan belanja dikosongkan', 'info');
  };

  const copyShoppingListToWA = () => {
    const lowItems = ingredients.filter(i => i.stock <= i.minStock);
    const nowStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const store = settings?.storeName || 'MUKI RAMEN';
    
    let text = `🛒 *DAFTAR KEBUTUHAN BELANJA DAPUR - ${store.toUpperCase()}*\n`;
    text += `📅 *Tanggal*: ${nowStr}\n`;
    text += `👨‍🍳 *Dicatat Oleh*: ${user?.name || 'Staff Dapur'} (${user?.role || 'Staff'})\n\n`;

    if (lowItems.length > 0) {
      text += `🚨 *BAHAN KRITIS / MENIPIS SISTEM:*\n`;
      lowItems.forEach((ing, idx) => {
        const targetStock = Math.max(ing.minStock * 2, 1);
        const needed = Math.max(1, targetStock - ing.stock);
        text += `${idx + 1}. *${ing.name}*\n`;
        text += `   • Sisa Stok: ${ing.stock} ${ing.unit} (Min: ${ing.minStock} ${ing.unit})\n`;
        text += `   • Kebutuhan Beli: *${needed} ${ing.unit}*\n`;
        if (ing.supplier?.name) {
          text += `   • Supplier: ${ing.supplier.name} ${ing.supplier.phone ? `(${ing.supplier.phone})` : ''}\n`;
        }
      });
      text += `\n`;
    } else {
      text += `✅ *Stok Sistem: Semua bahan masih dalam batas aman.*\n\n`;
    }

    if (customShoppingItems.length > 0) {
      text += `📝 *CATATAN TAMBAHAN DARI DAPUR:*\n`;
      customShoppingItems.forEach((item, idx) => {
        text += `• ${item}\n`;
      });
      text += `\n`;
    }

    text += `Mohon segera dicek dan diproses untuk kelancaran operasional. Terima kasih! 🙏`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast('✓ Format WhatsApp berhasil disalin ke clipboard!', 'success'))
        .catch(() => toast('Gagal menyalin otomatis. Silakan salin manual.', 'error'));
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast('✓ Format WhatsApp berhasil disalin!', 'success');
    }
  };

  const exportShoppingPDF = () => {
    const doc = new jsPDF();
    const store = settings?.storeName || 'MUKI RAMEN';
    const nowStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`DAFTAR KEBUTUHAN BELANJA DAPUR`, 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Toko: ${store} | Dicatat Oleh: ${user?.name || 'Staff Dapur'}`, 14, 22);
    doc.text(`Tanggal: ${nowStr} (${new Date().toLocaleTimeString('id-ID')})`, 14, 28);

    const lowItems = ingredients.filter(i => i.stock <= i.minStock);
    const tableColumn = ["No", "Bahan Baku", "Kategori", "Sisa Stok", "Batas Min", "Kebutuhan Beli", "Supplier", "Est. Biaya"];
    const tableRows: any[] = [];
    let totalEstCost = 0;

    lowItems.forEach((ing, idx) => {
      const targetStock = Math.max(ing.minStock * 2, 1);
      const needed = Math.max(1, targetStock - ing.stock);
      const cost = needed * ing.buyPrice;
      totalEstCost += cost;
      tableRows.push([
        idx + 1,
        ing.name,
        ing.category || 'FOOD',
        `${ing.stock} ${ing.unit}`,
        `${ing.minStock} ${ing.unit}`,
        `${needed} ${ing.unit}`,
        ing.supplier?.name || '-',
        `Rp ${cost.toLocaleString('id-ID')}`
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows.length > 0 ? tableRows : [["-", "Semua bahan baku dalam kondisi aman", "-", "-", "-", "-", "-", "-"]],
      startY: 34,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 8 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 60;
    
    if (customShoppingItems.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Catatan Tambahan Belanja / Pasar:`, 14, finalY + 10);
      doc.setFont('helvetica', 'normal');
      let lineY = finalY + 16;
      customShoppingItems.forEach((item) => {
        doc.text(`• ${item}`, 16, lineY);
        lineY += 6;
      });
    }

    doc.save(`Kebutuhan_Belanja_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast('Laporan PDF Kebutuhan Belanja berhasil diunduh!', 'success');
  };

  useEffect(() => {
    fetchSettingsAndShifts();
    fetchStaffList();
    if (token) {
      fetchMySummary();
      fetchIngredients();
      requestGpsLocation();
      if (stockSubTab === 'movements') {
        fetchTodayMovements();
      }
    }
    return () => {
      stopCamera();
      stopQrScanner();
    };
  }, [token, stockSubTab]);

  // QR / Barcode Login Handler
  const handleQrLogin = async (code: string) => {
    if (!code || !code.trim()) return;
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('staff_token', data.token);
        localStorage.setItem('staff_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setBadgeCodeInput('');
        stopQrScanner();
        toast(`Selamat bertugas, ${data.user.name}! 🚀`, 'success');
      } else {
        setPinError(data.error || 'Barcode / Badge ID tidak dikenali.');
        toast(data.error || 'Barcode / Badge ID tidak dikenali', 'error');
      }
    } catch (e) {
      setPinError('Terjadi kesalahan koneksi.');
    } finally {
      setPinLoading(false);
    }
  };

  // Camera QR / Barcode Scanner Controls
  const startQrScanner = async () => {
    setIsScannerScanning(true);
    setPinError('');
    try {
      if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      setScannerStream(stream);
      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        scannerVideoRef.current.play();
      }

      // If BarcodeDetector API exists on browser (Chrome/Edge/Android Web)
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'data_matrix']
        });

        scannerIntervalRef.current = setInterval(async () => {
          if (scannerVideoRef.current && scannerVideoRef.current.readyState >= 2) {
            try {
              const barcodes = await detector.detect(scannerVideoRef.current);
              if (barcodes.length > 0) {
                const detectedCode = barcodes[0].rawValue;
                if (detectedCode) {
                  stopQrScanner();
                  handleQrLogin(detectedCode);
                }
              }
            } catch (err) {
              // Ignore frame detection skips
            }
          }
        }, 300);
      }
    } catch (e) {
      console.error('QR Scanner error:', e);
      toast('Gagal mengakses kamera scanner. Pastikan izin kamera aktif.', 'error');
      setIsScannerScanning(false);
    }
  };

  const stopQrScanner = () => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => t.stop());
      setScannerStream(null);
    }
    setIsScannerScanning(false);
  };

  // Listen to Hardware USB/Bluetooth Barcode Scanner keystrokes on login page
  useEffect(() => {
    if (token) return;
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in a text input field directly
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 150) {
        barcodeBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
          e.preventDefault();
          handleQrLogin(barcodeBuffer);
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [token]);

  // Submit Login PIN
  const handlePinSubmit = async (pinValue: string) => {
    setPinLoading(true);
    setPinError('');
    try {
      const payload: any = { pin: pinValue };
      if (loginMode === 'kiosk' && selectedStaffUser?.id) {
        payload.userId = selectedStaffUser.id;
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
        setToken(data.token);
        setUser(data.user);
        setSelectedStaffUser(null);
        setPinInput('');
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
    stopCamera();
    stopQrScanner();
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

  // Submit Stock Loss from Kitchen PWA
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
          notes: `${lossForm.notes ? lossForm.notes + ' - ' : ''}[PWA Dapur: ${user?.name}]`
        })
      });

      if (res.ok) {
        toast('Pencatatan stock loss berhasil disimpan!', 'success');
        setShowLossModal(false);
        setLossForm({ ingredientId: '', qtyLoss: '', reason: 'Busuk / Kadaluarsa', notes: '' });
        fetchIngredients();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal mencatat loss', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingLoss(false);
    }
  };

  // Submit Quick Adjust / Restock from Kitchen PWA
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.ingredient) return;
    const change = parseFloat(adjustForm.change);
    if (isNaN(change) || change === 0) return toast('Jumlah perubahan tidak boleh 0', 'warning');

    setSubmittingAdjust(true);
    try {
      const res = await fetch(`/api/ingredients/${adjustModal.ingredient.id}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          change,
          type: change > 0 ? 'Restock' : 'Penyesuaian',
          description: `${adjustForm.description ? adjustForm.description + ' ' : ''}[PWA Dapur: ${user?.name}]`
        })
      });

      if (res.ok) {
        toast('Stok berhasil disesuaikan!', 'success');
        setAdjustModal({ open: false, ingredient: null });
        setAdjustForm({ change: '', description: '' });
        fetchIngredients();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyesuaikan stok', 'error');
      }
    } catch {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Filtered ingredients
  const filteredIngredients = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(stockSearch.toLowerCase());
    let matchCat = true;
    if (stockCategory === 'FOOD') matchCat = (i.category || 'FOOD') === 'FOOD';
    else if (stockCategory === 'DRINK') matchCat = i.category === 'DRINK';
    else if (stockCategory === 'PACKAGING') matchCat = i.category === 'PACKAGING';
    else if (stockCategory === 'LOW') matchCat = i.stock <= i.minStock;

    return matchSearch && matchCat;
  });

  // Selected ingredient in loss modal
  const selectedLossItem = ingredients.find(i => i.id === Number(lossForm.ingredientId));
  const estimatedLossRupiah = (parseFloat(lossForm.qtyLoss) || 0) * (selectedLossItem?.buyPrice || 0);

  // ─────────────────────────────────────────────────────────────
  // RENDER LOGIN SCREEN (IF NOT LOGGED IN)
  // ─────────────────────────────────────────────────────────────
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-5 text-slate-900 max-w-md mx-auto relative overflow-hidden font-sans">
        {/* Top Decorative Blue Curved Background */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#0052cc] via-[#004bbd] to-[#003d99] rounded-b-[3rem] shadow-xl pointer-events-none" />

        {/* Top Branding */}
        <div className="pt-6 text-center relative z-10 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto shadow-lg mb-2.5 border border-white/25">
            <Utensils size={26} className="text-white drop-shadow" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/20 text-blue-100 border border-white/20 inline-block mb-1">
            KITCHEN & STAFF SUPERAPP
          </span>
          <h1 className="text-xl font-black tracking-tight text-white drop-shadow-sm">PORTAL STAF & DAPUR</h1>
          <p className="text-[11px] font-semibold text-blue-100/90 mt-0.5">
            1-Tap Kiosk Switch &bull; Scan ID Badge &bull; Live Stock Lock
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-white/20 backdrop-blur-md p-1 rounded-2xl border border-white/20 mt-4 shadow-md max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => { setLoginMode('kiosk'); stopQrScanner(); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'kiosk'
                  ? 'bg-white text-[#0052cc] shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Zap size={14} /> 1-Tap Kiosk
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('qr'); startQrScanner(); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'qr'
                  ? 'bg-white text-[#0052cc] shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Camera size={14} /> Scan Badge
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('pin'); stopQrScanner(); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'pin'
                  ? 'bg-white text-[#0052cc] shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Fingerprint size={14} /> PIN
            </button>
          </div>
        </div>

        {/* Dynamic Card Container */}
        <div className="my-auto py-4 relative z-10">
          {/* MODE 1: 1-TAP KIOSK AVATAR SWITCHER */}
          {loginMode === 'kiosk' && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <User size={14} className="text-[#0052cc]" /> Pilih Profil Karyawan
                </span>
                <span className="text-[10px] bg-blue-50 text-[#0052cc] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                  {staffList.length} Staf Aktif
                </span>
              </div>

              {/* Avatar Grid / List */}
              <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {staffList.map(st => {
                  const isSelected = selectedStaffUser?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaffUser(st);
                        setPinError('');
                        setPinInput('');
                      }}
                      className={`p-2.5 rounded-2xl border transition-all flex flex-col items-center text-center relative ${
                        isSelected
                          ? 'bg-blue-50/80 border-[#0052cc] shadow-md shadow-blue-500/10 scale-[1.02]'
                          : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0052cc] to-indigo-500 p-0.5 mb-1.5 shadow-sm">
                        <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center font-black text-sm text-[#0052cc]">
                          {st.name.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate w-full">{st.name}</span>
                      <span className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wide">
                        {st.role}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* PIN / Quick Confirm for Selected Staff */}
              {selectedStaffUser ? (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-600 font-bold">
                      Masukkan PIN untuk <span className="text-[#0052cc] font-black">{selectedStaffUser.name}</span>
                    </p>
                  </div>

                  <div className="flex justify-center gap-2.5">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                          i < pinInput.length
                            ? 'bg-[#0052cc] border-[#0052cc] scale-110 shadow-sm shadow-blue-400'
                            : 'border-slate-300 bg-slate-100'
                        }`}
                      />
                    ))}
                  </div>

                  {pinError && (
                    <p className="text-[11px] text-rose-600 font-bold text-center bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200">
                      {pinError}
                    </p>
                  )}

                  {/* Compact Keypad */}
                  <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                      <button
                        key={num}
                        type="button"
                        disabled={pinLoading}
                        onClick={() => handleKeypadClick(num)}
                        className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-lg font-black transition-all active:scale-95 border border-slate-200 flex items-center justify-center shadow-sm"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={pinLoading}
                      onClick={() => setPinInput('')}
                      className="h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black border border-rose-200 flex items-center justify-center"
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      disabled={pinLoading}
                      onClick={() => handleKeypadClick('0')}
                      className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-lg font-black border border-slate-200 flex items-center justify-center shadow-sm"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={pinLoading}
                      onClick={() => setPinInput(prev => prev.slice(0, -1))}
                      className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 text-sm font-bold border border-slate-200 flex items-center justify-center"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                  <p className="text-xs text-slate-500">
                    👆 Ketuk avatar Anda di atas untuk login cepat dapur
                  </p>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: QR & BARCODE BADGE CAMERA SCANNER */}
          {loginMode === 'qr' && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Camera size={14} className="text-[#0052cc]" /> Arahkan QR / Barcode ID
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live Scanner
                </span>
              </div>

              {/* Camera Scanner Viewfinder */}
              <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-blue-500/40 shadow-inner flex items-center justify-center">
                <video
                  ref={scannerVideoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Reticle Scanner Line Overlay */}
                <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-3xl pointer-events-none"></div>
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-lg shadow-cyan-400"></div>

                {!isScannerScanning && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4 text-center">
                    <Camera size={36} className="text-slate-500 mb-2" />
                    <p className="text-xs font-bold text-slate-300 mb-3">Kamera scanner belum aktif</p>
                    <button
                      type="button"
                      onClick={startQrScanner}
                      className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg"
                    >
                      Nyalakan Kamera
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Badge code fallback */}
              <div className="pt-2 border-t border-slate-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleQrLogin(badgeCodeInput);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Scan atau ketik ID Badge / Barcode..."
                    value={badgeCodeInput}
                    onChange={(e) => setBadgeCodeInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#0052cc]"
                  />
                  <button
                    type="submit"
                    disabled={pinLoading || !badgeCodeInput.trim()}
                    className="px-4 py-2 bg-[#0052cc] hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black"
                  >
                    Masuk
                  </button>
                </form>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  💡 Scanner Barcode Fisik (USB / Bluetooth) aktif otomatis saat ditembakkan.
                </p>
              </div>

              {pinError && (
                <p className="text-xs text-rose-600 font-bold text-center bg-rose-50 py-2 px-3 rounded-xl border border-rose-200">
                  {pinError}
                </p>
              )}
            </div>
          )}

          {/* MODE 3: KEYPAD PIN TRADITIONAL */}
          {loginMode === 'pin' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xl space-y-5">
              <p className="text-xs font-bold text-center text-slate-600">
                Masukkan 6 Digit PIN Karyawan Anda
              </p>

              <div className="flex justify-center gap-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      i < pinInput.length
                        ? 'bg-[#0052cc] border-[#0052cc] scale-125 shadow-sm shadow-blue-400'
                        : 'border-slate-300 bg-slate-100'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-xs text-rose-600 font-bold text-center bg-rose-50 py-2 px-3 rounded-xl border border-rose-200 animate-pulse">
                  {pinError}
                </p>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    disabled={pinLoading}
                    onClick={() => handleKeypadClick(num)}
                    className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xl font-black transition-all active:scale-90 border border-slate-200 flex items-center justify-center shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => setPinInput('')}
                  className="h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black transition-all active:scale-90 border border-rose-200 flex items-center justify-center"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handleKeypadClick('0')}
                  className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xl font-black transition-all active:scale-90 border border-slate-200 flex items-center justify-center shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => setPinInput(prev => prev.slice(0, -1))}
                  className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 text-sm font-bold transition-all active:scale-90 border border-slate-200 flex items-center justify-center"
                >
                  ⌫
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pb-2 relative z-10">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0052cc] hover:text-blue-800 transition-colors"
          >
            <ArrowLeft size={14} /> Kembali ke Kasir Utama
          </a>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER AUTHENTICATED STAFF APP (GAMBAR 2 LUXE ROYAL BLUE EXPERIENCE)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col max-w-md mx-auto pb-24 shadow-2xl relative font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. GAMBAR 2 ROYAL BLUE HERO TOP HEADER & PROFILE BANNER
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#0052cc] via-[#004bbd] to-[#003d99] text-white p-5 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Mini-Bar */}
        <div className="flex items-center justify-between relative z-10 pb-3.5 border-b border-white/15">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-100">
              {settings?.storeName || 'MUKI RAMEN'} • PORTAL STAF
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="Keluar Sesi"
          >
            <LogOut size={13} />
            <span>Keluar</span>
          </button>
        </div>

        {/* Profile Details */}
        <div className="pt-3.5 flex items-center gap-3.5 relative z-10">
          {/* Avatar with Ring */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-white/20 p-0.5 shadow-md backdrop-blur-sm border border-white/30">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center font-black text-lg text-[#0052cc]">
                {user.name.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full bg-emerald-400 border-2 border-[#0052cc] flex items-center justify-center text-slate-900 text-[9px] font-black">
              ✓
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white truncate">{user.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-black border border-white/25 backdrop-blur-sm">
                {user.role}
              </span>
            </div>
            <p className="text-[11px] text-blue-100/85 font-semibold mt-0.5">
              ID Karyawan: <span className="text-white font-mono font-bold">#EMP-{user.id.toString().padStart(3, '0')}</span>
            </p>
            <p className="text-[10px] text-blue-100/80 font-medium mt-0.5 flex items-center gap-1">
              <Clock size={11} className="text-emerald-300" /> {currentTime} • {currentDateStr}
            </p>
          </div>
        </div>

        {/* Shift Status Bar */}
        <div className="mt-3.5 pt-3 border-t border-white/15 flex items-center justify-between text-xs relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-blue-100/90 text-[11px] font-semibold">Status Hari Ini:</span>
            {mySummary?.todayStatus?.clockedIn ? (
              mySummary?.todayStatus?.clockedOut ? (
                <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-black border border-white/20">
                  Selesai Shift
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-400 text-slate-950 text-[10px] font-black shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" /> Sedang Bertugas
                </span>
              )
            ) : (
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black shadow-sm">
                Belum Presensi Masuk
              </span>
            )}
          </div>

          {mySummary?.todayStatus?.todayLog?.shiftName && (
            <span className="text-[10px] text-white font-bold bg-white/15 px-2 py-0.5 rounded-md border border-white/20">
              {mySummary.todayStatus.todayLog.shiftName.split('(')[0]}
            </span>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. FLOATING SEGMENTED TAB NAVIGATION (GAMBAR 2 WHITE PILL BAR)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sticky top-0 z-30">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-md flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-[#0052cc] text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Camera size={14} />
            <span>Presensi Selfie</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'recap'
                ? 'bg-[#0052cc] text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History size={14} />
            <span>Rekap Kehadiran</span>
          </button>

          {isKitchenStaff && (
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'stock'
                  ? 'bg-[#0052cc] text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Package size={14} />
              <span>Stok Dapur</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ABSENSI GPS & BIOMETRIC FACE SCANNER (GAMBAR 2 LUXE WHITE CARDS)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div className="p-4 space-y-4 max-w-md mx-auto animate-fade-in">
          {/* GPS RADAR CARD */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${
                isWithinRadius ? 'bg-blue-50 text-[#0052cc] border border-blue-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}>
                <MapPin size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>{settings?.storeName || 'Muki Ramen'}</span>
                  {isWithinRadius && (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  )}
                </h4>
                <p className="text-[11px] font-semibold mt-0.5">
                  {gpsLoading ? (
                    <span className="text-amber-600 flex items-center gap-1">
                      <RefreshCw size={10} className="animate-spin" /> Mengunci koordinat GPS...
                    </span>
                  ) : isWithinRadius ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <span>✓ GPS Terverifikasi</span>
                      <span className="text-slate-400 font-normal font-mono">
                        ({gpsDistance !== null ? `${gpsDistance}m` : '0m'})
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
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all border border-slate-200 active:scale-95 shrink-0"
              title="Perbarui GPS"
            >
              <RefreshCw size={14} className={gpsLoading ? 'animate-spin text-[#0052cc]' : ''} />
            </button>
          </div>

          {/* PILIHAN SHIFT (JIKA BELUM CLOCK IN) */}
          {!mySummary?.todayStatus?.clockedIn && shifts.length > 0 && (
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-2.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-[#0052cc]" /> Jadwal Shift Kerja:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {shifts.map(shift => {
                  const isSelected = selectedShiftId === shift.id;
                  return (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => setSelectedShiftId(shift.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#0052cc] bg-blue-50/70 text-[#0052cc] shadow-sm'
                          : 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">{shift.name}</span>
                        {isSelected && <Check size={14} className="text-[#0052cc] font-bold" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {shift.start} - {shift.end}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BIOMETRIC CAMERA SCANNER VIEWPORT */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-slate-200/80 bg-slate-950 aspect-[3/4] max-w-xs sm:max-w-sm mx-auto flex items-center justify-center shadow-2xl ring-4 ring-blue-500/10">
            {capturedPhoto ? (
              <div className="w-full h-full relative">
                <img src={capturedPhoto} alt="Captured Selfie" className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#0052cc] text-white text-[10px] font-black backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                  <CheckCircle2 size={12} />
                  <span>Foto Terkunci</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhoto(null);
                    startCamera();
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-900/85 hover:bg-slate-900 text-white rounded-full text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <RefreshCw size={12} />
                  <span>Ulangi</span>
                </button>
              </div>
            ) : isCameraActive ? (
              <div className="w-full h-full relative flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                {/* Top Badge 1: Mode Clock In/Out */}
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/15 text-[10px] font-black text-white flex items-center gap-1.5 shadow-lg">
                  <span className={`w-2 h-2 rounded-full ${!mySummary?.todayStatus?.clockedIn ? 'bg-cyan-400 animate-ping' : 'bg-rose-400 animate-ping'}`} />
                  <span>{!mySummary?.todayStatus?.clockedIn ? 'Presensi Masuk' : 'Presensi Selesai'}</span>
                </div>

                {/* Top Badge 2: In-App Camera + Flip Toggle */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraFacing(prev => (prev === 'user' ? 'environment' : 'user'));
                      startCamera();
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-950/80 text-white border border-white/15 backdrop-blur-md text-[10px] font-bold flex items-center gap-1 active:scale-95"
                    title="Ganti Kamera Depan/Belakang"
                  >
                    <RefreshCw size={11} />
                    <span>Putar</span>
                  </button>
                </div>

                {/* Biometric Oval Face Guide Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                  <div className="w-48 h-64 sm:w-52 sm:h-72 border-2 border-dashed border-cyan-400/90 rounded-[50%] shadow-[0_0_25px_rgba(6,182,212,0.4)] animate-pulse" />
                  <p className="text-[10px] text-cyan-300 font-bold bg-slate-950/80 px-3 py-1 rounded-full mt-3 backdrop-blur-sm border border-cyan-500/30 shadow-md">
                    Posisikan wajah Anda di dalam lingkaran oval
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-cyan-400 flex items-center justify-center mx-auto border border-slate-800">
                  <Camera size={28} />
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Kamera selfie siap digunakan untuk verifikasi kehadiran.
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0052cc] to-blue-600 hover:from-blue-700 hover:to-blue-800 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/25 inline-flex items-center gap-1.5 active:scale-95"
                >
                  <Camera size={14} />
                  <span>Buka Kamera Presensi</span>
                </button>
              </div>
            )}
          </div>

          {/* MAIN BOTTOM ACTION BUTTONS */}
          <div className="pt-2 max-w-xs sm:max-w-sm mx-auto space-y-2">
            {!capturedPhoto ? (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!isCameraActive}
                className="w-full py-4 bg-gradient-to-r from-[#0052cc] to-blue-600 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                <span>Jepret Foto Presensi</span>
              </button>
            ) : (
              <div className="space-y-2">
                {!mySummary?.todayStatus?.clockedIn ? (
                  <button
                    type="button"
                    disabled={clockLoading}
                    onClick={() => handleClockAction('IN')}
                    className="w-full py-4 bg-gradient-to-r from-[#0052cc] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {clockLoading ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    <span>KONFIRMASI CLOCK-IN</span>
                  </button>
                ) : !mySummary?.todayStatus?.clockedOut ? (
                  <button
                    type="button"
                    disabled={clockLoading}
                    onClick={() => handleClockAction('OUT')}
                    className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {clockLoading ? <RefreshCw size={18} className="animate-spin" /> : <LogOut size={18} />}
                    <span>KONFIRMASI CLOCK-OUT</span>
                  </button>
                ) : (
                  <div className="p-4 bg-white text-slate-500 rounded-2xl text-center text-xs font-black border border-slate-200">
                    Shift Anda hari ini telah selesai. Terima kasih atas dedikasinya!
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhoto(null);
                    startCamera();
                  }}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <RefreshCw size={12} />
                  <span>Ambil Ulang Foto</span>
                </button>
              </div>
            )}

            <p className="text-[10px] text-slate-400 text-center font-medium pt-1">
              🔒 Lokasi GPS & foto selfie diverifikasi secara real-time demi akurasi reward.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: STOK DAPUR & BAR (PENGINPUTAN MUDAH BERDASARKAN KATEGORI)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'stock' && isKitchenStaff && (
        <div className="p-4 space-y-4">
          {/* SUB-TAB NAVIGATOR (STOK FISIK / MUTASI HARI INI / KEBUTUHAN BELANJA) */}
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm flex gap-1">
            <button
              type="button"
              onClick={() => setStockSubTab('catalog')}
              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                stockSubTab === 'catalog'
                  ? 'bg-[#0052cc] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package size={13} />
              <span>Stok Fisik</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStockSubTab('movements');
                fetchTodayMovements();
              }}
              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                stockSubTab === 'movements'
                  ? 'bg-[#0052cc] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History size={13} />
              <span>Mutasi Hari Ini</span>
            </button>
            <button
              type="button"
              onClick={() => setStockSubTab('shopping')}
              className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                stockSubTab === 'shopping'
                  ? 'bg-[#0052cc] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart size={13} />
              <span>List Belanja</span>
              {ingredients.filter(i => i.stock <= i.minStock).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                  {ingredients.filter(i => i.stock <= i.minStock).length}
                </span>
              )}
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SUB-VIEW 1: KATALOG BAHAN BAKU & QUICK ACTIONS
              ───────────────────────────────────────────────────────────── */}
          {stockSubTab === 'catalog' && (
            <div className="space-y-4 animate-fade-in">
              {/* TOP CATEGORY PILLS (MAKANAN / MINUMAN / KEMASAN / MENIPIS) */}
              <div className="bg-white p-3 rounded-3xl border border-slate-200/80 shadow-sm space-y-2.5">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="Cari bahan (mie, telur, sirup, teh)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* CATEGORY SELECTOR CAROUSEL */}
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setStockCategory('ALL')}
                    className={`py-2 px-2 rounded-xl text-center transition-all ${
                      stockCategory === 'ALL'
                        ? 'bg-[#0052cc] text-white font-black shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-[11px]'
                    }`}
                  >
                    <div className="text-xs">✨ Semua</div>
                    <div className="text-[10px] opacity-75">{ingredients.length}</div>
                  </button>

                  <button
                    onClick={() => setStockCategory('FOOD')}
                    className={`py-2 px-2 rounded-xl text-center transition-all ${
                      stockCategory === 'FOOD'
                        ? 'bg-[#0052cc] text-white font-black shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-[11px]'
                    }`}
                  >
                    <div className="text-xs">🍲 Makanan</div>
                    <div className="text-[10px] opacity-75">{ingredients.filter(i => (i.category || 'FOOD') === 'FOOD').length}</div>
                  </button>

                  <button
                    onClick={() => setStockCategory('DRINK')}
                    className={`py-2 px-2 rounded-xl text-center transition-all ${
                      stockCategory === 'DRINK'
                        ? 'bg-[#0052cc] text-white font-black shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-[11px]'
                    }`}
                  >
                    <div className="text-xs">☕ Minuman</div>
                    <div className="text-[10px] opacity-75">{ingredients.filter(i => i.category === 'DRINK').length}</div>
                  </button>

                  <button
                    onClick={() => setStockCategory('LOW')}
                    className={`py-2 px-2 rounded-xl text-center transition-all ${
                      stockCategory === 'LOW'
                        ? 'bg-rose-600 text-white font-black shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-[11px]'
                    }`}
                  >
                    <div className="text-xs">⚠️ Kritis</div>
                    <div className="text-[10px] opacity-75">{ingredients.filter(i => i.stock <= i.minStock).length}</div>
                  </button>
                </div>
              </div>

              {/* INGREDIENT LIST CARDS */}
              <div className="space-y-3">
                {stockLoading ? (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                    <RefreshCw size={24} className="animate-spin inline-block text-[#0052cc] mb-2" />
                    <p>Memuat data stok...</p>
                  </div>
                ) : filteredIngredients.length === 0 ? (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                    <Package size={32} className="mx-auto text-slate-300 mb-2" />
                    <p>Tidak ada bahan yang cocok dengan kategori ini.</p>
                  </div>
                ) : (
                  filteredIngredients.map(ing => {
                    const isLow = ing.stock <= ing.minStock && ing.stock > 0;
                    const isOut = ing.stock === 0;
                    const cat = ing.category || 'FOOD';
                    const stockPercent = ing.minStock > 0 ? Math.min(100, Math.round((ing.stock / (ing.minStock * 2)) * 100)) : 100;

                    return (
                      <div
                        key={ing.id}
                        className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3 transition-all hover:border-slate-300"
                      >
                        {/* Top Row: Name & Category */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${
                              cat === 'DRINK' ? 'bg-emerald-50 text-emerald-600' : (cat === 'PACKAGING' ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-[#0052cc]')
                            }`}>
                              {cat === 'DRINK' ? '☕' : (cat === 'PACKAGING' ? '📦' : '🍲')}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900 leading-snug">{ing.name}</h4>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                {cat === 'DRINK' ? 'Bar & Minuman' : (cat === 'PACKAGING' ? 'Kemasan' : 'Dapur & Makanan')} • Rp {ing.buyPrice.toLocaleString('id-ID')}/{ing.unit}
                              </p>
                            </div>
                          </div>

                          {/* Status Chip */}
                          <div>
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black border border-rose-200">
                                Habis
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-200">
                                Menipis
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200">
                                Aman
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock Bar & Quantity Display */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-slate-500">Sisa Stok Fisik:</span>
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-900">{ing.stock.toLocaleString('id-ID')}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">{ing.unit}</span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOut ? 'bg-rose-500 w-0' : (isLow ? 'bg-amber-500' : 'bg-blue-600')
                              }`}
                              style={{ width: `${isOut ? 0 : Math.max(8, stockPercent)}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>Batas Minimum: {ing.minStock} {ing.unit}</span>
                            <span>{ing.supplier?.name || 'Supplier Utama'}</span>
                          </div>
                        </div>

                        {/* ACTION BUTTONS (1-TAP RESTOCK & 1-TAP LOSS) */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setLossForm({
                                ingredientId: ing.id.toString(),
                                qtyLoss: '',
                                reason: 'Busuk / Kadaluarsa',
                                notes: ''
                              });
                              setShowLossModal(true);
                            }}
                            className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <TrendingDown size={14} className="text-rose-600" />
                            <span>Catat Rusak / Loss</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAdjustModal({ open: true, ingredient: ing });
                              setAdjustForm({ change: '', description: '' });
                            }}
                            className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-[#0052cc] border border-blue-200 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <Plus size={14} className="text-[#0052cc]" />
                            <span>Restock (+)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SUB-VIEW 2: MUTASI & LOG PERUBAHAN STOK HARI INI
              ───────────────────────────────────────────────────────────── */}
          {stockSubTab === 'movements' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-sm">
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <History size={14} className="text-[#0052cc]" /> Mutasi Stok Hari Ini
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {currentDateStr} • {todayMovements.length} transaksi mutasi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchTodayMovements}
                  disabled={movementsLoading}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0052cc] rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-blue-200"
                >
                  <RefreshCw size={12} className={movementsLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* MOVEMENT LOGS LIST */}
              <div className="space-y-2.5">
                {movementsLoading ? (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                    <RefreshCw size={24} className="animate-spin inline-block text-[#0052cc] mb-2" />
                    <p>Memuat riwayat mutasi stok hari ini...</p>
                  </div>
                ) : todayMovements.length === 0 ? (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-400 space-y-1">
                    <Package size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">Belum ada mutasi stok hari ini.</p>
                    <p className="text-[11px]">Setiap restock, bahan terpakai kasir, atau catatan rusak akan tercatat di sini.</p>
                  </div>
                ) : (
                  todayMovements.map(log => {
                    const isPlus = log.change > 0;
                    const timeStr = new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={log.id}
                        className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${
                            log.type === 'Restock'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : log.type === 'Rusak'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : log.type === 'Produksi'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-[#0052cc] border border-blue-200'
                          }`}>
                            {log.type === 'Restock' ? 'IN' : log.type === 'Rusak' ? 'LOSS' : log.type === 'Produksi' ? 'OUT' : 'ADJ'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-black text-slate-900">{log.ingredient?.name || 'Bahan Baku'}</h5>
                              <span className="text-[10px] text-slate-400 font-medium font-mono">{timeStr}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {log.description || log.reason || log.type}
                              {log.user?.name && <span className="text-slate-400"> • {log.user.name}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-black font-mono ${
                            isPlus ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isPlus ? `+${log.change}` : log.change} {log.ingredient?.unit}
                          </span>
                          {log.cost > 0 && (
                            <p className="text-[10px] text-slate-400 font-bold">
                              Rp {log.cost.toLocaleString('id-ID')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SUB-VIEW 3: DAFTAR KEBUTUHAN BELANJA & SHARE WHATSAPP / PDF
              ───────────────────────────────────────────────────────────── */}
          {stockSubTab === 'shopping' && (
            <div className="space-y-4 animate-fade-in">
              {/* ACTION BUTTONS (COPY WHATSAPP & DOWNLOAD PDF) */}
              <div className="bg-gradient-to-br from-[#0052cc] via-[#0047b3] to-[#1e3a8a] p-4 rounded-3xl text-white shadow-xl space-y-3 border border-blue-400/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white/20 text-amber-300 flex items-center justify-center font-bold border border-white/20">
                      <ShoppingCart size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Kebutuhan Belanja Dapur
                      </h4>
                      <p className="text-[10px] text-blue-100/90">
                        Siap dibagikan ke WhatsApp atau diunduh sebagai PDF
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={copyShoppingListToWA}
                    className="py-3 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl text-xs transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={15} />
                    <span>Salin WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportShoppingPDF}
                    className="py-3 px-3 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-2 backdrop-blur-sm"
                  >
                    <FileDown size={15} />
                    <span>Unduh PDF</span>
                  </button>
                </div>
              </div>

              {/* SECTION: BAHAN KRITIS & MENIPIS OTOMATIS */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span>Bahan Kritis / Menipis Sistem</span>
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {ingredients.filter(i => i.stock <= i.minStock).length} Bahan
                  </span>
                </div>

                {ingredients.filter(i => i.stock <= i.minStock).length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                    <CheckCircle size={28} className="mx-auto text-emerald-500 mb-1" />
                    <p className="font-bold text-slate-700">Semua bahan baku dalam kondisi aman!</p>
                    <p className="text-[11px] text-slate-400">Tidak ada stok yang berada di bawah batas minimum.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {ingredients.filter(i => i.stock <= i.minStock).map((ing, idx) => {
                      const targetStock = Math.max(ing.minStock * 2, 1);
                      const needed = Math.max(1, targetStock - ing.stock);
                      return (
                        <div
                          key={ing.id}
                          className="p-3 rounded-2xl border border-amber-100 bg-amber-50/40 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black w-4 h-4 rounded bg-amber-200/80 text-amber-900 flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <h5 className="text-xs font-black text-slate-900">{ing.name}</h5>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Sisa: <strong>{ing.stock} {ing.unit}</strong> • Min: {ing.minStock} {ing.unit}
                              {ing.supplier?.name && ` • ${ing.supplier.name}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-xl border border-rose-200">
                              +Beli {needed} {ing.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION: CATATAN TAMBAHAN DARI DAPUR (MANUAL ITEMS) */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <List size={14} className="text-indigo-600" />
                    <span>Catatan Tambahan Belanja / Pasar</span>
                  </h4>
                  {customShoppingItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCustomShoppingItems}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {/* INPUT FORM TAMBAH ITEM */}
                <form onSubmit={handleAddCustomShoppingItem} className="flex gap-2">
                  <input
                    type="text"
                    value={newShoppingInput}
                    onChange={e => setNewShoppingInput(e.target.value)}
                    placeholder="Misal: Gas LPG 3kg 2 tabung, Sayur Pakcoy 5 ikat..."
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition-all active:scale-95 shadow-sm whitespace-nowrap"
                  >
                    + Tambah
                  </button>
                </form>

                {/* CUSTOM ITEMS LIST */}
                {customShoppingItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-3">
                    Belum ada catatan tambahan. Ketik item di atas untuk menyertakan barang belanjaan non-stok.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {customShoppingItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-bold text-slate-800">
                          {idx + 1}. {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomShoppingItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Hapus item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: REKAP SAYA & RIWAYAT ABSENSI (GAMBAR 2 COLORTONE)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'recap' && (
        <div className="p-4 space-y-4">
          {/* STATS SUMMARY TILES */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Hadir</p>
              <h3 className="text-xl font-black text-[#0052cc]">{mySummary?.stats?.totalHadir || 0}</h3>
              <p className="text-[9px] text-slate-400 font-semibold">Hari Bulan Ini</p>
            </div>
            <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terlambat</p>
              <h3 className="text-xl font-black text-rose-600">{mySummary?.stats?.totalTerlambat || 0}</h3>
              <p className="text-[9px] text-slate-400 font-semibold">{mySummary?.stats?.totalLateMinutes || 0} mnt total</p>
            </div>
            <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jam Kerja</p>
              <h3 className="text-xl font-black text-[#0052cc]">{mySummary?.stats?.totalWorkHours || 0}</h3>
              <p className="text-[9px] text-slate-400 font-semibold">Jam Akumulasi</p>
            </div>
          </div>

          {/* REWARD & PUNISHMENT DISCIPLINE CARD */}
          {mySummary?.discipline && (
            <div className="bg-gradient-to-br from-[#0052cc] via-[#0047b3] to-[#1e3a8a] text-white p-5 rounded-3xl border border-blue-400/20 shadow-xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center justify-between relative z-10">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-300" /> Reward & Kedisiplinan Staf
                </span>
                {mySummary.discipline.enableZeroLateBonus && (
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    mySummary.discipline.zeroLateStatus === 'ELIGIBLE' ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40' :
                    mySummary.discipline.zeroLateStatus === 'ON_TRACK' ? 'bg-white/20 text-white border-white/40 animate-pulse' :
                    'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  }`}>
                    {mySummary.discipline.zeroLateStatus === 'ELIGIBLE' ? '⭐ DAPAT BONUS' :
                     mySummary.discipline.zeroLateStatus === 'ON_TRACK' ? '🎯 ON TRACK' : '❌ HANGUS'}
                  </span>
                )}
              </div>

              {/* Progress & Target */}
              {mySummary.discipline.enableZeroLateBonus && (
                <div className="space-y-1.5 relative z-10">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-blue-100">Target Zero Late:</span>
                    <span className="text-amber-300 font-mono font-black">Rp {(mySummary.discipline.zeroLateBonusAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-blue-950/40 rounded-full overflow-hidden border border-white/20">
                    <div
                      className={`h-full transition-all duration-500 ${
                        mySummary.discipline.zeroLateStatus === 'HANGUS'
                          ? 'bg-rose-500 w-full'
                          : 'bg-gradient-to-r from-amber-300 to-emerald-300'
                      }`}
                      style={{
                        width: mySummary.discipline.zeroLateStatus === 'HANGUS'
                          ? '100%'
                          : `${Math.min(100, ((mySummary.stats?.totalHadir || 0) / (mySummary.discipline.zeroLateMinAttendance || 20)) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-blue-100/80">
                    {mySummary.discipline.zeroLateStatus === 'ELIGIBLE'
                      ? 'Selamat! Anda memenuhi target hari hadir tanpa ada keterlambatan.'
                      : mySummary.discipline.zeroLateStatus === 'ON_TRACK'
                      ? `Tercapai ${mySummary.stats?.totalHadir || 0} dari min. ${mySummary.discipline.zeroLateMinAttendance} hari kerja. Pertahankan 0 keterlambatan!`
                      : `Bonus hangus karena tercatat ${mySummary.stats?.totalTerlambat || 0}x keterlambatan bulan ini.`}
                  </p>
                </div>
              )}

              {/* Deductions breakdown if any */}
              {mySummary.discipline.enableLatePenalty && (mySummary.discipline.totalLatePenalty || 0) > 0 && (
                <div className="pt-2 border-t border-white/15 flex justify-between items-center text-xs relative z-10">
                  <span className="text-rose-200 font-semibold">Potongan Keterlambatan:</span>
                  <span className="text-rose-200 font-black font-mono">
                    -Rp {(mySummary.discipline.totalLatePenalty || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* HISTORY LOG CARDS */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar size={14} className="text-[#0052cc]" /> Riwayat Log Kehadiran Anda
            </h4>

            {mySummary?.history?.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Belum ada riwayat absensi bulan ini.</p>
            ) : (
              <div className="space-y-2.5 divide-y divide-slate-100">
                {mySummary?.history?.map((log: AttendanceLog) => (
                  <div key={log.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {log.photoIn ? (
                        <img src={log.photoIn} alt="Foto Selfie" className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-sm" />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                          <User size={18} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-black text-slate-800">{log.date}</h5>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                              log.status === 'Hadir'
                                ? 'bg-emerald-50 text-emerald-700'
                                : log.status === 'Terlambat'
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.status} {log.lateMinutes ? `(+${log.lateMinutes}m)` : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {log.shiftName?.split('(')[0] || 'Shift'} • Masuk: {new Date(log.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {log.clockOut ? ` - Pulang: ${new Date(log.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-slate-400 font-semibold">
                      {log.distanceIn !== null && log.distanceIn !== undefined && (
                        <span>{log.distanceIn}m</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL BOTTOM SHEET: CATAT STOCK LOSS (SUPER CEPAT)
          ───────────────────────────────────────────────────────────── */}
      {showLossModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-md p-6 border border-slate-100 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Catat Stock Loss & Kerusakan</h3>
                  <p className="text-[10px] text-slate-400">Dicatat oleh: <strong>{user?.name}</strong></p>
                </div>
              </div>
              <button onClick={() => setShowLossModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitStockLoss} className="space-y-4">
              {/* PILIH BAHAN BAKU */}
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">Pilih Bahan Baku</label>
                <select
                  value={lossForm.ingredientId}
                  onChange={e => setLossForm({ ...lossForm, ingredientId: e.target.value })}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800"
                  required
                >
                  <option value="">-- Pilih Bahan Baku --</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.category === 'DRINK' ? '☕' : (i.category === 'PACKAGING' ? '📦' : '🍲')} {i.name} (Sisa: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* INPUT JUMLAH & PRESET BUTTONS */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-black text-slate-700">
                    Jumlah Kerusakan ({selectedLossItem?.unit || 'Unit'})
                  </label>
                  {selectedLossItem && (
                    <span className="text-[10px] text-slate-400">
                      Sisa: {selectedLossItem.stock} {selectedLossItem.unit}
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  step="any"
                  value={lossForm.qtyLoss}
                  onChange={e => setLossForm({ ...lossForm, qtyLoss: e.target.value })}
                  placeholder="Ketik jumlah rusak (misal: 0.5)"
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800"
                  required
                />

                {/* PRESET BUTTONS */}
                <div className="flex gap-1.5 mt-2">
                  {['0.25', '0.5', '1', '2', '5'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLossForm(prev => ({ ...prev, qtyLoss: val }))}
                      className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-black text-slate-700 transition-all"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* ESTIMASI NILAI KERUGIAN REAL-TIME */}
              {estimatedLossRupiah > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-700">
                    <DollarSign size={16} />
                    <span className="text-xs font-black">Estimasi Nilai Kerugian:</span>
                  </div>
                  <span className="text-sm font-black text-rose-700">
                    Rp {estimatedLossRupiah.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* ALASAN KERUSAKAN (VISUAL PILLS) */}
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1.5">Alasan Kerusakan</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Busuk / Kadaluarsa', label: '🍅 Busuk / Expired' },
                    { id: 'Tumpah / Rusak Fisik', label: '💥 Tumpah / Bocor' },
                    { id: 'Sisa Trimming / Kupas', label: '🔪 Sisa Trimming' },
                    { id: 'Kesalahan Masak / Hangus', label: '🍳 Kesalahan Masak' },
                    { id: 'Kualitas Buruk Supplier', label: '📦 Rusak dr Supplier' },
                    { id: 'Lainnya', label: '⚠️ Lainnya' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setLossForm(prev => ({ ...prev, reason: r.id }))}
                      className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all border ${
                        lossForm.reason === r.id
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CATATAN INSIDEN */}
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">Catatan Insiden (Opsional)</label>
                <input
                  type="text"
                  value={lossForm.notes}
                  onChange={e => setLossForm({ ...lossForm, notes: e.target.value })}
                  placeholder="Misal: Tomat lembek berjamur di chiller"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              {/* SUBMIT BUTTONS */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLoss}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-rose-600/20"
                >
                  {submittingLoss ? 'Menyimpan...' : 'Simpan Stock Loss'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL BOTTOM SHEET: QUICK RESTOCK (+)
          ───────────────────────────────────────────────────────────── */}
      {adjustModal.open && adjustModal.ingredient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-md p-6 border border-slate-100 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Tambah / Restock Bahan</h3>
                  <p className="text-[10px] text-slate-400">
                    {adjustModal.ingredient.name} (Sisa: {adjustModal.ingredient.stock} {adjustModal.ingredient.unit})
                  </p>
                </div>
              </div>
              <button onClick={() => setAdjustModal({ open: false, ingredient: null })} className="text-slate-400 p-1.5 rounded-full bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjust} className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">
                  Jumlah Tambahan (+ {adjustModal.ingredient.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={adjustForm.change}
                  onChange={e => setAdjustForm({ ...adjustForm, change: e.target.value })}
                  placeholder="Ketik jumlah masuk (misal: 10)"
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800"
                  required
                />

                {/* PRESET BUTTONS */}
                <div className="flex gap-1.5 mt-2">
                  {['1', '5', '10', '25', '50'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAdjustForm(prev => ({ ...prev, change: val }))}
                      className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-black text-slate-700 transition-all"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">Keterangan / Sumber Barang</label>
                <input
                  type="text"
                  value={adjustForm.description}
                  onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })}
                  placeholder="Misal: Kiriman pasar pagi / supplier"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModal({ open: false, ingredient: null })}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-500/20"
                >
                  {submittingAdjust ? 'Menyimpan...' : 'Simpan Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPWAView;
