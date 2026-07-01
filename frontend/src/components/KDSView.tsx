import React, { useState, useEffect, useContext, useRef } from 'react';
import { ChefHat, Clock, CheckCircle, Bell, ArrowRight, Flame, CheckCircle2, User, Undo2, RotateCcw, Volume2, X } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import useSocket from '../hooks/useSocket';

const KDSView = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [lastServed, setLastServed] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [servedHistory, setServedHistory] = useState<any[]>([]);
  const posContext = useContext(POSContext);
  const prevOrderIds = useRef<number[]>([]);
  const socket = useSocket();

  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    return localStorage.getItem('kds_selected_category') || 'all';
  });
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  // Screen Wake Lock to prevent screen sleep/lock on KDS tablet
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[KDS] Screen Wake Lock is active.');
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
          console.log('[KDS] Screen Wake Lock released.');
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
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch notification beep
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("AudioContext blocked or not supported", e);
    }
  };

  // Urgent Void/Cancellation Alarm (double beep siren)
  const playCancellationAlarm = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
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
  }, [orders]);

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
  }, [orders]);

  useEffect(() => {
    if (posContext?.token) {
      fetchKDSOrders();
    }
  }, [posContext?.token]);

  // Real-time synchronization via Socket.IO instead of polling
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

  // Helper untuk menentukan warna card berdasarkan status dan waktu tunggu
  const getCardStyle = (status: string, createdAt: string) => {
    if (status === 'Cancelled') {
      return 'bg-red-50/95 border-red-500 text-slate-800 shadow-lg shadow-red-150/20 animate-pulse border-l-4 border-l-red-600 hover:border-red-400 transition-all duration-200';
    }

    const waitMins = (new Date().getTime() - new Date(createdAt).getTime()) / 60000;
    
    // 1. Overdue warning (red pulse) - highest priority if not ready
    if (status !== 'Ready' && waitMins > 15) {
      return 'bg-rose-50/50 border-rose-200 text-slate-800 shadow-md shadow-rose-100/10 animate-pulse border-l-4 border-l-rose-500 hover:border-rose-300 transition-all duration-200';
    }
    
    // 2. SLA Warning (> 10m) - amber warning if not ready
    if (status !== 'Ready' && waitMins > 10) {
      return 'bg-amber-50/60 border-amber-200 text-slate-800 shadow-sm border-l-4 border-l-amber-500 hover:border-amber-300 transition-all duration-200';
    }

    // 3. Normal status coloring
    if (status === 'Ready') {
      return 'bg-emerald-50/30 border-emerald-200 text-slate-800 shadow-sm border-l-4 border-l-emerald-500 hover:border-emerald-300 transition-all duration-200';
    }
    if (status === 'Cooking') {
      return 'bg-amber-50/20 border-amber-200/80 text-slate-800 shadow-sm border-l-4 border-l-amber-500 hover:border-amber-300 transition-all duration-200';
    }
    
    // default (Pending / Antrean)
    return 'bg-indigo-50/20 border-indigo-200/60 text-slate-800 shadow-sm border-l-4 border-l-indigo-500 hover:border-indigo-300 transition-all duration-200';
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Cancelled': return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white border border-red-700 animate-pulse flex items-center gap-1"><Volume2 size={10} /> BATAL</span>;
      case 'Pending': return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Antrean</span>;
      case 'Cooking': return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Dimasak</span>;
      case 'Ready': return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Siap Saji</span>;
      default: return null;
    }
  };

  const getWaitTime = (createdAt: string) => {
    const diffMs = new Date().getTime() - new Date(createdAt).getTime();
    const totalSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const getWaitTimeColor = (createdAt: string, status: string) => {
    if (status === 'Cancelled') return 'text-red-600 font-extrabold';
    if (status === 'Ready') return 'text-emerald-600 font-bold';
    const waitMins = (new Date().getTime() - new Date(createdAt).getTime()) / 60000;
    if (waitMins > 15) return 'text-rose-600 font-black';
    if (waitMins > 10) return 'text-amber-600 font-bold';
    return 'text-emerald-600 font-bold';
  };

  const getSlaBadge = (createdAt: string, status: string) => {
    if (status === 'Cancelled') return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-700 animate-bounce">DI-VOID / BATAL</span>;
    if (status === 'Ready') return null;
    const waitMins = (new Date().getTime() - new Date(createdAt).getTime()) / 60000;
    if (waitMins > 15) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 animate-pulse">OVERDUE (15m+)</span>;
    }
    if (waitMins > 10) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">WARNING (10m+)</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">AMAN</span>;
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center bg-slate-50 text-slate-600 h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="font-semibold text-slate-500">Sinkronisasi data dapur...</p>
      </div>
    );
  }

  // Filter dan olah data order berdasarkan stasiun yang dipilih
  const getFilteredOrders = (rawOrders: any[]) => {
    if (selectedCategoryId === 'all') return rawOrders;
    return rawOrders
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
  };

  const filteredOrders = getFilteredOrders(orders);

  // Akumulasikan menu masakan aktif (Pending / Cooking)
  const getConsolidatedSummary = (rawFilteredOrders: any[]) => {
    const activeOrders = rawFilteredOrders.filter(o => o.kdsStatus === 'Pending' || o.kdsStatus === 'Cooking');
    const summaryMap: Record<string, { name: string, qty: number }> = {};
    activeOrders.forEach(order => {
      order.items.forEach((item: any) => {
        const key = item.product.name;
        if (summaryMap[key]) {
          summaryMap[key].qty += item.qty;
        } else {
          summaryMap[key] = {
            name: item.product.name,
            qty: item.qty
          };
        }
      });
    });
    return Object.values(summaryMap).sort((a, b) => b.qty - a.qty);
  };

  const consolidatedSummary = getConsolidatedSummary(filteredOrders);

  const queueCount = filteredOrders.filter(o => o.kdsStatus === 'Pending').length;
  const cookingCount = filteredOrders.filter(o => o.kdsStatus === 'Cooking').length;
  const readyCount = filteredOrders.filter(o => o.kdsStatus === 'Ready').length;

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
      {/* Offline Banner */}
      {!isSocketConnected && (
        <div className="bg-rose-600 text-white px-5 py-3.5 rounded-2xl mb-4 flex items-center justify-between text-xs font-bold shadow-md shadow-rose-100/10 animate-pulse border border-rose-500 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>Koneksi Terputus! Layar KDS berjalan offline. Menghubungkan kembali...</span>
          </div>
          <button 
            onClick={() => {
              socket.connect();
              setIsSocketConnected(socket.connected);
            }} 
            className="bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95"
          >
            Hubungkan Ulang
          </button>
        </div>
      )}

      {/* KDS Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900">
            <ChefHat className="text-indigo-600" /> Kitchen Display System
          </h2>
          <p className="text-slate-500 mt-1 text-xs">Layar khusus area dapur untuk memantau pesanan masuk secara real-time</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Station/Category Filter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stasiun:</span>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Stasiun (All)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <button 
            className={`btn border shadow-sm rounded-xl px-4 py-2 flex items-center gap-2 transition-all active:scale-95 text-xs font-bold ${isSummaryOpen ? 'bg-indigo-600 border-indigo-750 text-white hover:bg-indigo-700' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'}`}
            onClick={() => setIsSummaryOpen(prev => !prev)}
          >
            <ChefHat size={14} /> {isSummaryOpen ? 'Sembunyikan Ringkasan' : 'Tampilkan Ringkasan'}
          </button>

          <button 
            className="btn bg-indigo-50 hover:bg-indigo-100 border border-indigo-250 text-indigo-750 shadow-sm rounded-xl px-4 py-2 flex items-center gap-2 transition-all active:scale-95 text-xs font-bold"
            onClick={() => setIsHistoryOpen(true)}
          >
            <Clock size={14} /> Riwayat Saji ({servedHistory.length})
          </button>
          
          {lastServed && (
            <button 
              className="btn bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-800 shadow-sm rounded-xl px-4 py-2 flex items-center gap-2 transition-all active:scale-95 text-xs font-bold"
              onClick={() => handleUndoStatus(lastServed.id)}
              title={`Recall ${lastServed.orderNumber}`}
            >
              <RotateCcw size={14} /> Recall Meja {lastServed.table?.tableNo || 'TA'}
            </button>
          )}
          
          <button 
            className="btn bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-sm rounded-xl px-4 py-2 flex items-center gap-2 transition-transform active:scale-95 text-xs font-bold" 
            onClick={fetchKDSOrders}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 flex-shrink-0">
        <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/80 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 flex-shrink-0">
            <Bell size={22} className={queueCount > 0 ? 'animate-bounce' : ''} />
          </div>
          <div>
            <div className="text-xs text-indigo-600 font-bold tracking-wider uppercase">Antrean Baru</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{queueCount} <span className="text-xs font-normal text-slate-400">pesanan</span></div>
          </div>
        </div>

        <div className="bg-amber-50/45 p-4 rounded-2xl border border-amber-100/80 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Flame size={22} className={cookingCount > 0 ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div className="text-xs text-amber-700 font-bold tracking-wider uppercase">Sedang Dimasak</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{cookingCount} <span className="text-xs font-normal text-slate-400">pesanan</span></div>
          </div>
        </div>

        <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/80 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-705 flex-shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-xs text-emerald-700 font-bold tracking-wider uppercase">Siap Disajikan</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{readyCount} <span className="text-xs font-normal text-slate-400">pesanan</span></div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Grid + Summary Sidebar */}
      <div className="flex-1 flex gap-6 min-h-0 items-start overflow-hidden">
        {/* Orders Grid Wrapper */}
        <div className="flex-1 h-full overflow-y-auto pr-1">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/60 py-16 flex flex-col items-center justify-center text-slate-400 w-full min-h-[350px] shadow-sm">
              <ChefHat size={72} className="mb-4 opacity-30 text-slate-300" />
              <p className="text-xl font-bold text-slate-700">Dapur Bersih!</p>
              <p className="text-sm text-slate-400 mt-1">Tidak ada pesanan aktif untuk filter stasiun ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 items-start pb-8">
              {filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`flex flex-col rounded-2xl border-2 overflow-hidden bg-white transition-all duration-200 ${getCardStyle(order.kdsStatus, order.createdAt)}`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-inherit bg-black/5 bg-opacity-[0.02]">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-extrabold text-slate-800 tracking-tight text-base">{order.orderNumber}</div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(order.kdsStatus)}
                        {getSlaBadge(order.createdAt, order.kdsStatus)}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs mt-3">
                      <div className="font-bold text-indigo-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        {order.table?.tableNo ? `Meja ${order.table.tableNo}` : 'Take Away'}
                      </div>
                      <div className={`flex items-center gap-1 font-bold ${getWaitTimeColor(order.createdAt, order.kdsStatus)}`}>
                        <Clock size={12} /> {getWaitTime(order.createdAt)}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-2 font-medium flex items-center gap-1 border-t border-slate-200/40 pt-2">
                      <User size={11} className="text-slate-400" />
                      <span>Pemesan: <strong className="text-slate-700">{order.customerName}</strong></span>
                    </div>
                  </div>

                  {/* Card Items List */}
                  <div className="flex-1 p-4 bg-transparent text-slate-700">
                    <ul className="space-y-3">
                      {order.items.map((item: any) => (
                        <li key={item.id} className="flex gap-3 items-start border-b border-slate-200/40 pb-3 last:border-0 last:pb-0">
                          <div className="w-7 h-7 rounded-lg bg-black/5 flex items-center justify-center font-extrabold text-slate-700 text-xs flex-shrink-0">
                            {item.qty}x
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-slate-800 text-[13px] leading-tight">{item.product.name}</div>
                            {item.notes && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.notes.split(' • ').map((tag: string, i: number) => (
                                  <span 
                                    key={i} 
                                    className="inline-block bg-amber-100 text-amber-900 font-bold text-[9px] px-2 py-0.5 rounded border border-amber-200/70"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 bg-transparent border-t border-slate-200/40 space-y-2">
                    {order.kdsStatus === 'Cancelled' && (
                      <button 
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-md shadow-rose-100 flex items-center justify-center gap-2 transition-all text-xs"
                        onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                      >
                        Hapus Alert (Acknowledge)
                      </button>
                    )}
                    {order.kdsStatus === 'Pending' && (
                      <button 
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-sm shadow-indigo-100 flex items-center justify-center gap-2 transition-all text-xs"
                        onClick={() => handleUpdateStatus(order.id, order.kdsStatus)}
                      >
                        Mulai Masak <ArrowRight size={14} />
                      </button>
                    )}
                    {order.kdsStatus === 'Cooking' && (
                      <div className="flex gap-2">
                        <button 
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl transition-all active:scale-[0.98]"
                          onClick={() => handleUndoStatus(order.id)}
                          title="Batal Mulai Masak"
                        >
                          <Undo2 size={14} />
                        </button>
                        <button 
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-sm shadow-emerald-100 flex items-center justify-center gap-2 transition-all text-xs"
                          onClick={() => handleUpdateStatus(order.id, order.kdsStatus)}
                        >
                          Pesanan Siap <CheckCircle2 size={14} />
                        </button>
                      </div>
                    )}
                    {order.kdsStatus === 'Ready' && (
                      <div className="flex gap-2">
                        <button 
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl transition-all active:scale-[0.98]"
                          onClick={() => handleUndoStatus(order.id)}
                          title="Kembali ke Memasak"
                        >
                          <Undo2 size={14} />
                        </button>
                        <button 
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all text-xs"
                          onClick={() => handleUpdateStatus(order.id, order.kdsStatus)}
                        >
                          Sajikan Pesanan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consolidated Summary Sidebar */}
        {isSummaryOpen && (
          <div className="w-80 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm h-full flex flex-col flex-shrink-0 animate-in slide-in-from-right duration-200">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center justify-between mb-3.5 pb-3 border-b border-slate-100 flex-shrink-0">
              <span className="flex items-center gap-2">
                <ChefHat className="text-indigo-650" size={16} /> Ringkasan Masakan
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                {consolidatedSummary.length} Jenis Menu
              </span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {consolidatedSummary.length === 0 ? (
                <div className="text-center py-20 text-slate-450 flex flex-col items-center justify-center">
                  <CheckCircle className="text-slate-200 mb-2" size={32} />
                  <p className="text-xs font-semibold">Semua masakan selesai.</p>
                </div>
              ) : (
                consolidatedSummary.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-150 p-3 rounded-xl shadow-2xs hover:bg-slate-100/50 transition-colors animate-in fade-in duration-200">
                    <span className="font-semibold text-slate-700 text-[12.5px] truncate max-w-[200px]" title={item.name}>
                      {item.name}
                    </span>
                    <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-xs shadow-sm flex-shrink-0">
                      {item.qty}x
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Riwayat Saji Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Riwayat Saji Hari Ini</h3>
                  <span className="text-[10px] text-slate-400 font-medium">Daftar pesanan yang telah selesai disajikan</span>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-150 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shadow-sm"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {servedHistory.length === 0 ? (
                <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                  <CheckCircle size={40} className="text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Belum ada pesanan disajikan.</p>
                </div>
              ) : (
                servedHistory.map(order => (
                  <div key={order.id} className="p-4 rounded-2xl border border-slate-150 bg-slate-50/30 flex flex-col justify-between gap-3 hover:border-slate-300 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-black text-slate-800 text-xs">{order.orderNumber}</div>
                        <div className="text-[10px] font-bold text-indigo-700 mt-1">Meja {order.table?.tableNo || 'TA'} - {order.customerName}</div>
                      </div>
                      <button
                        onClick={() => {
                          handleUndoStatus(order.id);
                        }}
                        className="py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <RotateCcw size={10} /> Recall
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-500 border-t border-dashed border-slate-200 pt-2">
                      <ul className="space-y-1">
                        {order.items.map((item: any) => (
                          <li key={item.id} className="font-medium text-slate-600">
                            {item.qty}x {item.product?.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 self-end font-medium">
                      Disajikan pada: {new Date(order.servedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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
