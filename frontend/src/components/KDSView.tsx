import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  ChefHat, 
  Clock, 
  CheckCircle, 
  Bell, 
  ArrowRight, 
  Flame, 
  CheckCircle2, 
  User, 
  Undo2, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Maximize2,
  Minimize2,
  X, 
  RefreshCw,
  UtensilsCrossed,
  Layers,
  Check,
  AlertTriangle,
  Store
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import useSocket from '../hooks/useSocket';
import { formatTableTitle } from '../utils/tableUtils';

const KDSView = () => {
  const { profile, isCafe } = useVertical();

  if (!isCafe || !profile.enableKds) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[70vh] bg-slate-50/50">
        <div className="w-16 h-16 rounded-3xl bg-amber-100/70 border border-amber-200 text-amber-700 flex items-center justify-center mb-4 shadow-sm">
          <Store size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800">Modul Dapur (KDS) Tidak Aktif</h2>
        <p className="text-sm text-slate-500 max-w-md mt-2 mb-6 leading-relaxed">
          Bisnis vertikal Anda <strong>({profile.displayName})</strong> tidak menggunakan sistem antrean dapur (KDS).
        </p>
        <Link 
          to="/pos" 
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
        >
          Buka Kasir POS
        </Link>
      </div>
    );
  }

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const [lastServed, setLastServed] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [servedHistory, setServedHistory] = useState<any[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'Pending' | 'Cooking' | 'Ready' | 'summary'>('all');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('kds_muted') === 'true');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const posContext = useContext(POSContext);
  const prevOrderIds = useRef<number[]>([]);
  const socket = useSocket();

  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    return localStorage.getItem('kds_selected_category') || 'all';
  });

  // Track fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('kds_muted', String(next));
      if (!next) {
        playBeep();
      }
      return next;
    });
  };

  // Screen Wake Lock to prevent screen sleep/lock on KDS tablet
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          console.warn('[KDS] Wake Lock failed:', err.message);
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchCategories();
    }
  }, [posContext?.token]);

  useEffect(() => {
    localStorage.setItem('kds_selected_category', selectedCategoryId);
  }, [selectedCategoryId]);

  // Sound generator
  const playBeep = () => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch notification beep
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn("AudioContext blocked or not supported", e);
    }
  };

  // Urgent Void/Cancellation Alarm (double beep siren)
  const playCancellationAlarm = () => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("AudioContext blocked or not supported", e);
    }
  };

  const fetchServedHistory = async () => {
    try {
      const res = await fetch('/api/kds/history', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setServedHistory(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isHistoryOpen && posContext?.token) {
      fetchServedHistory();
    }
  }, [isHistoryOpen, posContext?.token]);

  const fetchLastServed = async () => {
    try {
      const res = await fetch('/api/kds/last-served', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setLastServed(await res.json());
      }
      fetchServedHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchKDSOrders = async () => {
    try {
      const res = await fetch('/api/kds/active', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data);
        fetchLastServed();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Sync tick every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync new orders beep sound
  useEffect(() => {
    const pendingOrders = orders.filter(o => o.kdsStatus === 'Pending');
    const currentIds = pendingOrders.map(o => o.id);
    const hasNewOrder = currentIds.some(id => !prevOrderIds.current.includes(id));
    
    if (hasNewOrder && prevOrderIds.current.length > 0) {
      playBeep();
    }
    prevOrderIds.current = currentIds;
  }, [orders, isMuted]);

  // Persistent cancellation/void alarm loop
  useEffect(() => {
    const hasCancelled = orders.some(o => o.kdsStatus === 'Cancelled');
    if (hasCancelled) {
      playCancellationAlarm();
      const alarmTimer = setInterval(() => {
        playCancellationAlarm();
      }, 1500);
      return () => clearInterval(alarmTimer);
    }
  }, [orders, isMuted]);

  useEffect(() => {
    if (posContext?.token) {
      fetchKDSOrders();
    }
  }, [posContext?.token]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    setIsSocketConnected(socket.connected);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('order:new', fetchKDSOrders);
    socket.on('order:void', fetchKDSOrders);
    socket.on('kds:statusChanged', fetchKDSOrders);
    socket.on('order:paid', fetchKDSOrders);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('order:new', fetchKDSOrders);
      socket.off('order:void', fetchKDSOrders);
      socket.off('kds:statusChanged', fetchKDSOrders);
      socket.off('order:paid', fetchKDSOrders);
    };
  }, [socket]);

  const handleUpdateStatus = async (orderId: number, currentStatus: string) => {
    let nextStatus = '';
    if (currentStatus === 'Pending') nextStatus = 'Cooking';
    else if (currentStatus === 'Cooking') nextStatus = 'Ready';
    else if (currentStatus === 'Ready') nextStatus = 'Served';
    else if (currentStatus === 'Cancelled') nextStatus = 'Served';
    
    if (!nextStatus) return;

    try {
      const res = await fetch(`/api/kds/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ kdsStatus: nextStatus })
      });
      if (res.ok) {
        fetchKDSOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUndoStatus = async (orderId: number) => {
    try {
      const res = await fetch(`/api/kds/${orderId}/undo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${posContext?.token}`
        }
      });
      if (res.ok) {
        fetchKDSOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleItemChecked = (itemId: number | string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Helper untuk menentukan warna card berdasarkan status dan waktu tunggu
  const getCardStyle = (status: string, createdAt: string) => {
    if (status === 'Cancelled') {
      return 'bg-red-50/95 border-red-500 text-slate-800 shadow-md border-l-4 border-l-red-600 animate-pulse';
    }

    const waitMins = (new Date().getTime() - new Date(createdAt).getTime()) / 60000;
    
    // 1. Overdue warning (>15m)
    if (status !== 'Ready' && waitMins > 15) {
      return 'bg-rose-50/70 border-rose-300 text-slate-800 shadow-sm border-l-4 border-l-rose-500';
    }
    
    // 2. SLA Warning (> 10m)
    if (status !== 'Ready' && waitMins > 10) {
      return 'bg-amber-50/60 border-amber-300 text-slate-800 shadow-sm border-l-4 border-l-amber-500';
    }

    // 3. Normal status coloring
    if (status === 'Ready') {
      return 'bg-emerald-50/40 border-emerald-300 text-slate-800 shadow-sm border-l-4 border-l-emerald-500';
    }
    if (status === 'Cooking') {
      return 'bg-amber-50/20 border-amber-300/80 text-slate-800 shadow-sm border-l-4 border-l-amber-500';
    }
    
    // default (Pending / Antrean)
    return 'bg-white border-slate-200 text-slate-800 shadow-sm border-l-4 border-l-indigo-600';
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Cancelled': 
        return (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white border border-red-700 animate-pulse flex items-center gap-1">
            <Volume2 size={10} /> BATAL / VOID
          </span>
        );
      case 'Pending': 
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Antrean Baru
          </span>
        );
      case 'Cooking': 
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Flame size={10} className="text-amber-600 animate-pulse" /> Dimasak
          </span>
        );
      case 'Ready': 
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 size={10} className="text-emerald-600" /> Siap Saji
          </span>
        );
      default: return null;
    }
  };

  const formatTableLabel = (tableNo?: string) => {
    if (!tableNo) return 'TAKE AWAY';
    return formatTableTitle(tableNo).toUpperCase();
  };

  const getWaitTime = (createdAt: string) => {
    const diffMs = new Date().getTime() - new Date(createdAt).getTime();
    const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const getWaitTimeBadge = (createdAt: string, status: string) => {
    if (status === 'Cancelled') {
      return (
        <span className="text-[11px] font-black text-red-600 flex items-center gap-1">
          <AlertTriangle size={12} /> Batal
        </span>
      );
    }
    if (status === 'Ready') {
      return (
        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-100/60 px-2 py-0.5 rounded-lg">
          <Clock size={11} /> {getWaitTime(createdAt)}
        </span>
      );
    }
    const waitMins = (new Date().getTime() - new Date(createdAt).getTime()) / 60000;
    if (waitMins > 15) {
      return (
        <span className="text-[11px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse border border-rose-200">
          <Clock size={11} /> {getWaitTime(createdAt)} (15m+)
        </span>
      );
    }
    if (waitMins > 10) {
      return (
        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-amber-200">
          <Clock size={11} /> {getWaitTime(createdAt)}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
        <Clock size={11} /> {getWaitTime(createdAt)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center bg-slate-50 text-slate-600 h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
        <p className="font-bold text-xs text-slate-500">Menghubungkan ke Dapur (KDS)...</p>
      </div>
    );
  }

  // Filter dan olah data order berdasarkan stasiun yang dipilih
  const getFilteredOrders = (rawOrders: any[]) => {
    let result = rawOrders;
    if (selectedCategoryId !== 'all') {
      result = result
        .map(order => {
          const filteredItems = order.items.filter((item: any) => {
            return String(item.product?.categoryId) === String(selectedCategoryId);
          });
          return {
            ...order,
            items: filteredItems
          };
        })
        .filter(order => order.items.length > 0);
    }

    if (activeTab !== 'all' && activeTab !== 'summary') {
      result = result.filter(o => o.kdsStatus === activeTab);
    }

    return result;
  };

  // Base raw orders filtered by category alone for counts
  const categoryOrders = selectedCategoryId === 'all' 
    ? orders 
    : orders
        .map(order => ({
          ...order,
          items: order.items.filter((item: any) => String(item.product?.categoryId) === String(selectedCategoryId))
        }))
        .filter(order => order.items.length > 0);

  const queueCount = categoryOrders.filter(o => o.kdsStatus === 'Pending').length;
  const cookingCount = categoryOrders.filter(o => o.kdsStatus === 'Cooking').length;
  const readyCount = categoryOrders.filter(o => o.kdsStatus === 'Ready').length;
  const totalActiveCount = queueCount + cookingCount + readyCount;

  const displayOrders = getFilteredOrders(orders);

  // Consolidated summary for active items
  const getConsolidatedSummary = (rawOrders: any[]) => {
    const activeOrders = rawOrders.filter(o => o.kdsStatus === 'Pending' || o.kdsStatus === 'Cooking');
    const summaryMap: Record<string, { name: string, qty: number, pendingQty: number, cookingQty: number }> = {};
    
    activeOrders.forEach(order => {
      order.items.forEach((item: any) => {
        const key = item.product.name;
        if (!summaryMap[key]) {
          summaryMap[key] = {
            name: item.product.name,
            qty: 0,
            pendingQty: 0,
            cookingQty: 0
          };
        }
        summaryMap[key].qty += item.qty;
        if (order.kdsStatus === 'Pending') summaryMap[key].pendingQty += item.qty;
        if (order.kdsStatus === 'Cooking') summaryMap[key].cookingQty += item.qty;
      });
    });
    return Object.values(summaryMap).sort((a, b) => b.qty - a.qty);
  };

  const consolidatedSummary = getConsolidatedSummary(categoryOrders);

  return (
    <div className="p-3 sm:p-4 md:p-6 w-full flex-1 flex flex-col bg-slate-100/70 text-slate-800 min-h-0">
      {/* Offline Alert Banner */}
      {!isSocketConnected && (
        <div className="bg-rose-600 text-white px-3.5 py-2.5 rounded-xl mb-3 flex items-center justify-between text-xs font-bold shadow-sm animate-pulse flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Koneksi Offline. Menghubungkan ulang...</span>
          </div>
          <button 
            onClick={() => {
              socket.connect();
              setIsSocketConnected(socket.connected);
            }} 
            className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition-all active:scale-95"
          >
            Hubungkan
          </button>
        </div>
      )}

      {/* Top Operational Bar: Station Selector & Quick Action Buttons */}
      <div className="flex items-center justify-between gap-1.5 mb-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs flex-shrink-0">
        {/* Left: Station Dropdown with Chef Icon */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <ChefHat size={15} />
          </div>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[145px] sm:max-w-[200px] truncate"
          >
            <option value="all">Semua Stasiun</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {cat.name}
              </option>
            ))}
          </select>
          <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500' : 'bg-rose-500'} flex-shrink-0`} title={isSocketConnected ? 'Live' : 'Offline'} />
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Sound Toggle */}
          <button
            onClick={toggleMute}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-all active:scale-95 ${
              isMuted 
                ? 'bg-rose-50 border-rose-200 text-rose-600' 
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
            title={isMuted ? 'Suara Senyap' : 'Suara Aktif'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* History / Recall Modal */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95"
            title="Riwayat Saji"
          >
            <Clock size={14} />
            {servedHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {servedHistory.length > 9 ? '9+' : servedHistory.length}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchKDSOrders}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95"
            title="Refresh Pesanan"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Recall Notification Chip if lastServed exists */}
      {lastServed && (
        <div className="mb-2 bg-amber-50 border border-amber-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between text-[11px] text-amber-900 shadow-2xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold">Selesai:</span>
            <span className="truncate">{formatTableLabel(lastServed.table?.tableNo)} (#{lastServed.orderNumber})</span>
          </div>
          <button
            onClick={() => handleUndoStatus(lastServed.id)}
            className="ml-2 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg shadow-2xs flex items-center gap-1 active:scale-95 flex-shrink-0"
          >
            <RotateCcw size={10} /> Recall
          </button>
        </div>
      )}

      {/* Zero-Scroll 5-Button Filter Grid (100% Screen Width) */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full mb-2.5 flex-shrink-0">
        {/* Button 1: Semua */}
        <button
          onClick={() => setActiveTab('all')}
          className={`py-1.5 px-0.5 sm:px-2 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 font-bold'
          }`}
        >
          <span className="text-[11px] sm:text-xs">Semua</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
            activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {totalActiveCount}
          </span>
        </button>

        {/* Button 2: Antrean */}
        <button
          onClick={() => setActiveTab('Pending')}
          className={`py-1.5 px-0.5 sm:px-2 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 ${
            activeTab === 'Pending'
              ? 'bg-indigo-600 text-white shadow-xs font-black'
              : 'bg-white text-indigo-700 border border-indigo-150 hover:bg-indigo-50/50 font-bold'
          }`}
        >
          <div className="flex items-center gap-0.5">
            <Bell size={11} className={queueCount > 0 ? 'animate-bounce' : ''} />
            <span className="text-[11px] sm:text-xs">Antre</span>
          </div>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
            activeTab === 'Pending' ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {queueCount}
          </span>
        </button>

        {/* Button 3: Dimasak */}
        <button
          onClick={() => setActiveTab('Cooking')}
          className={`py-1.5 px-0.5 sm:px-2 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 ${
            activeTab === 'Cooking'
              ? 'bg-amber-600 text-white shadow-xs font-black'
              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50/50 font-bold'
          }`}
        >
          <div className="flex items-center gap-0.5">
            <Flame size={11} className={cookingCount > 0 ? 'animate-pulse' : ''} />
            <span className="text-[11px] sm:text-xs">Masak</span>
          </div>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
            activeTab === 'Cooking' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
          }`}>
            {cookingCount}
          </span>
        </button>

        {/* Button 4: Siap */}
        <button
          onClick={() => setActiveTab('Ready')}
          className={`py-1.5 px-0.5 sm:px-2 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 ${
            activeTab === 'Ready'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50/50 font-bold'
          }`}
        >
          <div className="flex items-center gap-0.5">
            <CheckCircle2 size={11} />
            <span className="text-[11px] sm:text-xs">Siap</span>
          </div>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
            activeTab === 'Ready' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-900'
          }`}>
            {readyCount}
          </span>
        </button>

        {/* Button 5: Ringkasan Menu */}
        <button
          onClick={() => setIsSummaryModalOpen(true)}
          className="py-1.5 px-0.5 sm:px-2 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 bg-white text-slate-700 border border-slate-200/80 hover:bg-indigo-50/50 hover:text-indigo-700 transition-all active:scale-95 font-bold"
          title="Buka Ringkasan Porsi Menu"
        >
          <div className="flex items-center gap-0.5">
            <Layers size={11} className="text-indigo-600" />
            <span className="text-[11px] sm:text-xs">Menu</span>
          </div>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
            {consolidatedSummary.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* Ticket List View (Grid) */}
        <div className="flex-1 h-full overflow-y-auto pr-0.5">
          {displayOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 flex flex-col items-center justify-center text-center text-slate-400 my-auto min-h-[300px] shadow-xs">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <UtensilsCrossed size={32} className="text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-700">Dapur Bersih!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Tidak ada pesanan aktif pada stasiun dan filter ini. Siap menerima pesanan baru!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-32 sm:pb-12 items-start">
              {displayOrders.map(order => {
                const isAllChecked = order.items.length > 0 && order.items.every((it: any) => checkedItems[`${order.id}-${it.id}`]);

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col ${getCardStyle(order.kdsStatus, order.createdAt)}`}
                  >
                    {/* Ticket Header */}
                    <div className="p-3 sm:p-3.5 border-b border-inherit bg-black/[0.02]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        {/* Table Indicator Badge */}
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 text-white font-black text-xs sm:text-sm rounded-lg shadow-2xs tracking-wide ${
                            order.table?.tableNo ? 'bg-slate-900' : 'bg-amber-600'
                          }`}>
                            {formatTableLabel(order.table?.tableNo)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 font-mono">
                            #{order.orderNumber}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {getStatusBadge(order.kdsStatus)}
                        </div>
                      </div>

                      {/* Customer Name & Timer */}
                      <div className="flex items-center justify-between text-xs mt-2">
                        <div className="flex items-center gap-1 text-slate-600 truncate max-w-[140px] sm:max-w-[170px]">
                          <User size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="font-semibold truncate">{order.customerName || 'Pelanggan'}</span>
                        </div>
                        <div>
                          {getWaitTimeBadge(order.createdAt, order.kdsStatus)}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Items List */}
                    <div className="p-3 sm:p-3.5 flex-1 bg-white/70 space-y-2.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Item Masakan ({order.items.length})</span>
                        <span className="text-[9px] text-slate-400 font-normal">Ketuk untuk centang</span>
                      </div>

                      <div className="space-y-2">
                        {order.items.map((item: any) => {
                          const itemKey = `${order.id}-${item.id}`;
                          const isChecked = !!checkedItems[itemKey];

                          return (
                            <div 
                              key={item.id}
                              onClick={() => toggleItemChecked(itemKey)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                                isChecked 
                                  ? 'bg-slate-50/80 border-slate-200/60 opacity-60' 
                                  : 'bg-white border-slate-200 hover:border-indigo-200 shadow-2xs'
                              }`}
                            >
                              {/* Quantity Badge */}
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 transition-colors ${
                                isChecked
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-900 text-white shadow-2xs'
                              }`}>
                                {isChecked ? <Check size={14} /> : `${item.qty}x`}
                              </div>

                              {/* Item Details */}
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs sm:text-sm font-bold leading-snug ${
                                  isChecked ? 'line-through text-slate-400' : 'text-slate-800'
                                }`}>
                                  {item.product?.name}
                                </div>

                                {/* Custom notes / modifiers */}
                                {item.notes && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.notes.split(' • ').map((tag: string, idx: number) => (
                                      <span 
                                        key={idx}
                                        className="inline-block bg-amber-100/90 text-amber-900 font-bold text-[9px] px-1.5 py-0.5 rounded border border-amber-200/80"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ticket Action Buttons (Thumb-friendly for Kitchen) */}
                    <div className="p-2.5 sm:p-3 bg-white border-t border-slate-100">
                      {order.kdsStatus === 'Cancelled' && (
                        <button 
                          className="w-full h-12 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
                          onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                        >
                          <AlertTriangle size={16} /> Hapus Alert Void (Acknowledge)
                        </button>
                      )}

                      {order.kdsStatus === 'Pending' && (
                        <button 
                          className="w-full h-12 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.98] text-white font-black rounded-xl shadow-sm shadow-indigo-200 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm tracking-wide"
                          onClick={() => handleUpdateStatus(order.id, order.kdsStatus)}
                        >
                          <Flame size={16} /> Mulai Masak <ArrowRight size={15} />
                        </button>
                      )}

                      {order.kdsStatus === 'Cooking' && (
                        <div className="flex items-center gap-2">
                          <button 
                            className="h-12 w-12 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center flex-shrink-0"
                            onClick={() => handleUndoStatus(order.id)}
                            title="Kembali ke Antrean"
                          >
                            <Undo2 size={17} />
                          </button>
                          <button 
                            className={`flex-1 h-12 active:scale-[0.98] text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all text-xs sm:text-sm tracking-wide ${
                              isAllChecked
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-200 animate-pulse'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                            }`}
                            onClick={() => handleUpdateStatus(order.id, order.kdsStatus)}
                          >
                            <CheckCircle2 size={17} /> Siap Disajikan
                          </button>
                        </div>
                      )}

                      {order.kdsStatus === 'Ready' && (
                        <div className="flex items-center gap-2">
                          <button 
                            className="h-12 w-12 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center flex-shrink-0"
                            onClick={() => handleUndoStatus(order.id)}
                            title="Kembali ke Memasak"
                          >
                            <Undo2 size={17} />
                          </button>
                          <button 
                            className="flex-1 h-12 bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all text-xs sm:text-sm tracking-wide"
                            onClick={() => handleUpdateStatus(order.id, order.kdsStatus)}
                          >
                            <CheckCircle size={17} /> Sajikan Pesanan
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Sidebar for Ringkasan Masakan (Hidden on Mobile, replaced by Bottom Sheet Modal) */}
        <div className="hidden lg:flex w-72 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs h-full flex-col flex-shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 flex-shrink-0">
            <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
              <ChefHat size={15} className="text-indigo-600" /> Ringkasan Masakan
            </h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {consolidatedSummary.length} Menu
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {consolidatedSummary.length === 0 ? (
              <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                <CheckCircle size={28} className="text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold">Semua masakan selesai.</p>
              </div>
            ) : (
              consolidatedSummary.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/60 transition-colors">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-700 text-xs truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {item.pendingQty > 0 && <span className="text-indigo-600 font-semibold">{item.pendingQty} antre </span>}
                      {item.cookingQty > 0 && <span className="text-amber-600 font-semibold">({item.cookingQty} dimasak)</span>}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-black text-xs flex-shrink-0 shadow-2xs">
                    {item.qty}x
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Ringkasan Masakan Modal / Bottom Sheet (For Mobile & Tablet) */}
      {isSummaryModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setIsSummaryModalOpen(false)}
        >
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Akumulasi Menu Dapur</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Total porsi masakan yang harus disiapkan</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSummaryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shadow-2xs"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {consolidatedSummary.length === 0 ? (
                <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                  <CheckCircle size={36} className="text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Tidak ada menu aktif yang perlu dimasak saat ini.</p>
                </div>
              ) : (
                consolidatedSummary.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-2xl border border-slate-150">
                    <div className="min-w-0 pr-3">
                      <span className="font-bold text-slate-800 text-xs sm:text-sm block truncate" title={item.name}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                        {item.pendingQty > 0 && (
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-150">
                            {item.pendingQty}x Antre
                          </span>
                        )}
                        {item.cookingQty > 0 && (
                          <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {item.cookingQty}x Dimasak
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 bg-indigo-600 text-white font-black text-sm rounded-xl shadow-xs flex-shrink-0">
                      {item.qty} porsi
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl active:scale-[0.98] transition-all"
              >
                Tutup Ringkasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Saji Modal / Drawer */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:justify-end p-0 z-50 animate-in fade-in duration-150"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div 
            className="bg-white w-full sm:max-w-md h-[85vh] sm:h-full shadow-2xl flex flex-col rounded-t-3xl sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Riwayat Saji Hari Ini</h3>
                  <span className="text-[10px] text-slate-400 font-medium">Pesanan yang telah disajikan ke pelanggan</span>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shadow-2xs"
              >
                <X size={15} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {servedHistory.length === 0 ? (
                <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                  <CheckCircle size={36} className="text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Belum ada pesanan disajikan hari ini.</p>
                </div>
              ) : (
                servedHistory.map(order => (
                  <div key={order.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col gap-2.5 shadow-2xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-black text-slate-800 text-xs">{order.orderNumber}</div>
                        <div className="text-[11px] font-bold text-indigo-700 mt-0.5">
                          {order.table?.tableNo ? `Meja ${order.table.tableNo}` : 'Take Away'} • {order.customerName}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleUndoStatus(order.id);
                        }}
                        className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"
                      >
                        <RotateCcw size={10} /> Recall
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                      <ul className="space-y-1">
                        {order.items.map((item: any) => (
                          <li key={item.id} className="font-medium text-slate-700 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span>{item.qty}x {item.product?.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="text-[10px] text-slate-400 font-medium text-right border-t border-dashed border-slate-100 pt-1.5">
                      Disajikan: {new Date(order.servedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KDSView;
