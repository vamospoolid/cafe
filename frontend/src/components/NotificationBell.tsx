import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  X, 
  ChefHat, 
  CreditCard, 
  Trash2, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  MapPin, 
  ExternalLink,
  Smartphone,
  Check
} from 'lucide-react';
import useSocket from '../hooks/useSocket';

export interface NotificationItem {
  id: string;
  type: 'order:new' | 'kds:ready' | 'order:paid' | 'order:void' | 'waiter:call';
  message: string;
  detail?: string;
  tableNo?: string | null;
  tableId?: number | string | null;
  orderNumber?: string | null;
  customerName?: string | null;
  total?: number | null;
  timestamp: Date;
  read: boolean;
}

interface FloatingAlert {
  id: string;
  notification: NotificationItem;
  createdAt: number;
}

// Global shared AudioContext to prevent autoplay blocking issues
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (_) {
    return null;
  }
};

const NotificationBell: React.FC = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [floatingAlerts, setFloatingAlerts] = useState<FloatingAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('codepos_notif_sound') !== 'disabled';
  });
  const [hasDesktopPerm, setHasDesktopPerm] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-unlock AudioContext on first user interaction in browser
  useEffect(() => {
    const unlockAudio = () => {
      getAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Request Desktop Notification Permission
  const requestDesktopPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setHasDesktopPerm(perm === 'granted');
    } catch (_) {}
  }, []);

  // Professional Multi-Tone Synthesizer Sound Generator
  const playAlertSound = useCallback((type: NotificationItem['type']) => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (type === 'order:new') {
        // 🎵 LOUD & CHEERFUL CASHIER ORDER BELL (4-Tone Ascending Melodic Chime)
        // Melodi khas mesin kasir: E5 -> G#5 -> B5 -> E6
        const notes = [
          { freq: 659.25, time: 0.00, dur: 0.4 }, // E5
          { freq: 830.61, time: 0.12, dur: 0.4 }, // G#5
          { freq: 987.77, time: 0.24, dur: 0.4 }, // B5
          { freq: 1318.51, time: 0.36, dur: 0.9 } // E6 (Resonant bell finish)
        ];

        notes.forEach(note => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'triangle'; // Clear, warm bell harmonic
          osc.frequency.setValueAtTime(note.freq, now + note.time);

          // Envelope: Quick attack, smooth exponential decay
          gain.gain.setValueAtTime(0.001, now + note.time);
          gain.gain.linearRampToValueAtTime(0.45, now + note.time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + note.time);
          osc.stop(now + note.time + note.dur);
        });

        // Trigger mobile vibration if supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([250, 100, 250, 100, 400]);
        }
      } else if (type === 'waiter:call') {
        // 🛎️ SERVICE DESK DING-DONG (High C6 -> G5 -> C6)
        const notes = [
          { freq: 1046.50, time: 0.00, dur: 0.5 },
          { freq: 783.99, time: 0.18, dur: 0.5 },
          { freq: 1046.50, time: 0.35, dur: 0.8 }
        ];

        notes.forEach(note => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, now + note.time);
          gain.gain.setValueAtTime(0.4, now + note.time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + note.time);
          osc.stop(now + note.time + note.dur);
        });

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([300, 150, 300]);
        }
      } else if (type === 'kds:ready') {
        // 🍽️ KITCHEN READY BELL (High Pitch Ding)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.4);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'order:paid') {
        // 💳 REGISTER KA-CHING
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [soundEnabled]);

  // Dispatch Desktop OS Notification
  const triggerDesktopNotification = useCallback((notif: NotificationItem) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const title = notif.tableNo 
        ? `🔔 ORDER BARU: Meja ${notif.tableNo}` 
        : `🔔 ${notif.message}`;

      const bodyText = `${notif.customerName ? `Pelanggan: ${notif.customerName}` : ''}${notif.total ? ` • Total: Rp ${notif.total.toLocaleString('id-ID')}` : ''}\nKlik untuk membuka sistem kasir.`;

      const nativeNotif = new Notification(title, {
        body: bodyText,
        icon: '/logo.png',
        tag: `order-${notif.id}`
      });

      nativeNotif.onclick = () => {
        window.focus();
        nativeNotif.close();
        navigate('/meja');
      };
    } catch (_) {}
  }, [navigate]);

  // Add Notification to Store & Show Floating Alert
  const addNotification = useCallback((itemData: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const notif: NotificationItem = {
      ...itemData,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [notif, ...prev].slice(0, 30));

    // Play Sound & Vibrate
    playAlertSound(notif.type);

    // Trigger Desktop Notification
    triggerDesktopNotification(notif);

    // Show Floating Toast Alert for Order and Waiter Call
    if (notif.type === 'order:new' || notif.type === 'waiter:call' || notif.type === 'kds:ready') {
      const alertItem: FloatingAlert = {
        id: notif.id,
        notification: notif,
        createdAt: Date.now()
      };

      setFloatingAlerts(prev => [alertItem, ...prev].slice(0, 3)); // Max 3 stacked toasts
    }
  }, [playAlertSound, triggerDesktopNotification]);

  // Auto-dismiss floating alerts after 12 seconds
  useEffect(() => {
    if (floatingAlerts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setFloatingAlerts(prev => prev.filter(alert => now - alert.createdAt < 12000));
    }, 1000);
    return () => clearInterval(interval);
  }, [floatingAlerts]);

  // Socket.IO Real-time listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (data: any) => {
      console.log('[NotificationBell Socket] order:new received:', data);
      
      const tableLabel = data?.tableNo ? `Meja ${data.tableNo}` : (data?.tableId ? `Meja #${data.tableId}` : 'Pesanan Langsung');
      const custLabel = data?.customerName ? ` • ${data.customerName}` : '';
      const orderNum = data?.orderNumber || 'Order Baru';

      addNotification({
        type: 'order:new',
        message: `🔥 Order Baru Masuk (${tableLabel})`,
        detail: `${orderNum}${custLabel}${data?.total ? ` • Rp ${Number(data.total).toLocaleString('id-ID')}` : ''}`,
        tableNo: data?.tableNo || null,
        tableId: data?.tableId || null,
        orderNumber: data?.orderNumber || null,
        customerName: data?.customerName || null,
        total: data?.total || null
      });
    };

    const handleWaiterCall = (data: any) => {
      console.log('[NotificationBell Socket] waiter:call received:', data);
      const tableLabel = data?.tableNo ? `Meja ${data.tableNo}` : 'Dine-In';

      addNotification({
        type: 'waiter:call',
        message: `🛎️ Panggilan Pelayan!`,
        detail: `${tableLabel} memanggil pelayan ke meja.`,
        tableNo: data?.tableNo || null,
        tableId: data?.tableId || null
      });
    };

    const handleKdsReady = (data: any) => {
      console.log('[NotificationBell Socket] kds:ready received:', data);
      addNotification({
        type: 'kds:ready',
        message: `🍽️ Makanan Siap Disajikan`,
        detail: data?.tableNo ? `Meja ${data.tableNo} • Order #${data.orderNumber}` : `Order #${data.orderNumber}`,
        tableNo: data?.tableNo || null,
        orderNumber: data?.orderNumber || null
      });
    };

    const handleOrderPaid = (data: any) => {
      console.log('[NotificationBell Socket] order:paid received:', data);
      addNotification({
        type: 'order:paid',
        message: `💳 Transaksi Berhasil`,
        detail: data?.order?.orderNumber ? `Order #${data.order?.orderNumber} lunas` : 'Pembayaran terkonfirmasi',
        orderNumber: data?.order?.orderNumber || null
      });
    };

    const handleOrderVoid = (data: any) => {
      console.log('[NotificationBell Socket] order:void received:', data);
      addNotification({
        type: 'order:void',
        message: `❌ Order Dibatalkan`,
        detail: data?.orderNumber ? `Order #${data.orderNumber}` : 'Pesanan telah di-void',
        orderNumber: data?.orderNumber || null
      });
    };

    socket.on('order:new', handleNewOrder);
    socket.on('waiter:call', handleWaiterCall);
    socket.on('kds:ready', handleKdsReady);
    socket.on('order:paid', handleOrderPaid);
    socket.on('order:void', handleOrderVoid);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('waiter:call', handleWaiterCall);
      socket.off('kds:ready', handleKdsReady);
      socket.off('order:paid', handleOrderPaid);
      socket.off('order:void', handleOrderVoid);
    };
  }, [socket, addNotification]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('codepos_notif_sound', nextVal ? 'enabled' : 'disabled');
    if (nextVal) {
      playAlertSound('order:new');
    }
  };

  const dismissFloatingAlert = (id: string) => {
    setFloatingAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAlertClick = (notif: NotificationItem) => {
    dismissFloatingAlert(notif.id);
    navigate('/meja');
  };

  return (
    <>
      {/* ─── 1. TOPBAR BELL BUTTON ─── */}
      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen(prev => !prev);
            if (!open) markAllRead();
          }}
          className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            unreadCount > 0 
              ? 'bg-amber-100/80 text-amber-700 animate-pulse border border-amber-300 shadow-sm' 
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          title="Notifikasi Kasir & Pesanan"
        >
          <Bell size={18} className={unreadCount > 0 ? 'animate-bounce' : ''} />
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* ─── 2. DROPDOWN NOTIFICATION PANEL ─── */}
        {open && (
          <div className="absolute top-11 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-3.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <Bell size={14} className="text-amber-600" />
                  <span>Notifikasi Kasir Real-Time</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">Update pesanan meja & dapur</p>
              </div>

              <div className="flex items-center gap-1">
                {/* Sound Test / Toggle */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                    soundEnabled 
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                      : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                  }`}
                  title={soundEnabled ? 'Suara Bel Aktif (Klik untuk Matikan)' : 'Suara Bel Mati (Klik untuk Aktifkan)'}
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>

                {/* Mark read / Clear */}
                {notifications.length > 0 && (
                  <button 
                    type="button"
                    onClick={clearAll} 
                    title="Bersihkan Semua"
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Notification Banner if not granted */}
            {!hasDesktopPerm && (
              <div className="p-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900">
                <div className="flex items-center gap-1.5">
                  <Smartphone size={14} className="text-amber-600 flex-shrink-0" />
                  <span>Aktifkan notifikasi browser agar bel tetap berbunyi saat buka tab lain.</span>
                </div>
                <button
                  type="button"
                  onClick={requestDesktopPermission}
                  className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[10px] whitespace-nowrap ml-2 shadow-xs hover:bg-amber-700 active:scale-95"
                >
                  Izinkan
                </button>
              </div>
            )}

            {/* Quick Sound Test Action */}
            <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Audio Bel Notifikasi</span>
              <button
                type="button"
                onClick={() => playAlertSound('order:new')}
                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs transition-all"
              >
                <Volume2 size={12} />
                <span>Uji Suara Bel Kasir</span>
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-1.5">
                  <CheckCircle2 size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">Belum ada pesanan baru</p>
                  <p className="text-[11px] text-slate-400">Notifikasi order dari meja akan otomatis muncul di sini.</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id}
                    onClick={() => {
                      if (n.tableNo || n.tableId) {
                        navigate('/meja');
                        setOpen(false);
                      }
                    }}
                    className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer ${
                      n.read ? 'bg-white hover:bg-slate-50' : 'bg-amber-50/40 hover:bg-amber-50/70'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs bg-amber-100 text-amber-700">
                      {n.type === 'order:new' && <Bell size={15} />}
                      {n.type === 'waiter:call' && <Bell size={15} className="animate-spin" />}
                      {n.type === 'kds:ready' && <ChefHat size={15} className="text-emerald-700" />}
                      {n.type === 'order:paid' && <CreditCard size={15} className="text-indigo-700" />}
                      {n.type === 'order:void' && <Trash2 size={15} className="text-rose-700" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1">
                          {n.message}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                          {n.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {n.detail && (
                        <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-0.5">
                          {n.detail}
                        </p>
                      )}

                      {n.tableNo && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            <MapPin size={10} /> Meja {n.tableNo}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5 hover:underline">
                            <span>Buka Meja</span>
                            <ExternalLink size={10} />
                          </span>
                        </div>
                      )}
                    </div>

                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Tandai Semua Sudah Dibaca
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. PROMINENT FLOATING TOAST ALERTS (LOUD SCREEN OVERLAY) ─── */}
      {floatingAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2.5 max-w-sm w-full pointer-events-none">
          {floatingAlerts.map(alert => {
            const notif = alert.notification;
            const isWaiterCall = notif.type === 'waiter:call';

            return (
              <div 
                key={alert.id}
                className="pointer-events-auto bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-amber-500 shadow-[0_16px_40px_rgba(217,119,6,0.25)] p-4 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden transition-all"
              >
                {/* Visual pulse glow stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isWaiterCall ? 'bg-rose-500 animate-pulse' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`} />

                <div className="flex items-start justify-between gap-3 pt-0.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0 ${
                      isWaiterCall ? 'bg-rose-600 animate-bounce' : 'bg-amber-600'
                    }`}>
                      <Bell size={20} />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isWaiterCall ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isWaiterCall ? 'PANGGILAN PELAYAN' : 'PESANAN MASUK'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">Baru Saja</span>
                      </div>

                      <h3 className="text-sm font-black text-slate-900 mt-0.5">
                        {notif.tableNo ? `Meja ${notif.tableNo}` : 'Dine-In Self-Order'}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissFloatingAlert(alert.id)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Details */}
                <div className="mt-2 text-xs text-slate-600 font-medium pl-12 space-y-0.5">
                  {notif.customerName && (
                    <p className="line-clamp-1 font-bold text-slate-800">
                      Pemesan: {notif.customerName}
                    </p>
                  )}
                  {notif.total && (
                    <p className="text-amber-700 font-black text-xs">
                      Total: Rp {Number(notif.total).toLocaleString('id-ID')}
                    </p>
                  )}
                  {notif.orderNumber && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      #{notif.orderNumber}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2 pl-12">
                  <button
                    type="button"
                    onClick={() => dismissFloatingAlert(alert.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Tutup
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAlertClick(notif)}
                    className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-amber-600/25 transition-all"
                  >
                    <span>Buka Meja</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default NotificationBell;
