import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, ChefHat, CreditCard, Trash2, CheckCircle2 } from 'lucide-react';
import useSocket from '../hooks/useSocket';

interface Notification {
  id: string;
  type: 'kds:ready' | 'order:new' | 'order:paid' | 'order:void';
  message: string;
  detail?: string;
  timestamp: Date;
  read: boolean;
}

const ICON_MAP = {
  'kds:ready':  { icon: ChefHat,     color: '#166534', bg: '#dcfce7' },
  'order:new':  { icon: Bell,         color: '#1d4ed8', bg: '#dbeafe' },
  'order:paid': { icon: CreditCard,   color: '#7c3aed', bg: '#f5f3ff' },
  'order:void': { icon: Trash2,       color: '#dc2626', bg: '#fee2e2' },
};

const NotificationBell: React.FC = () => {
  const socket = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const addNotif = (type: Notification['type'], message: string, detail?: string) => {
    const notif: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      type, message, detail,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [notif, ...prev].slice(0, 20));

    // Sound cue untuk kds:ready dan order:void
    if (type === 'kds:ready' || type === 'order:void') {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = type === 'kds:ready' ? 880 : 440;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch (_) {}
    }
  };

  useEffect(() => {
    socket.on('kds:ready', (data: any) => {
      addNotif('kds:ready', `🍽️ Makanan Siap Disajikan`, data.tableNo ? `Meja ${data.tableNo} · Order ${data.orderNumber}` : `Order ${data.orderNumber}`);
    });
    socket.on('order:new', (data: any) => {
      addNotif('order:new', `📋 Order Baru Masuk`, data.tableNo ? `Meja ${data.tableNo} · ${data.orderNumber}` : data.orderNumber);
    });
    socket.on('order:paid', () => {
      addNotif('order:paid', `💳 Transaksi Selesai`, 'Pembayaran dikonfirmasi');
    });
    socket.on('order:void', (data: any) => {
      addNotif('order:void', `❌ Order Dibatalkan`, `Order ${data.orderNumber}`);
    });

    return () => {
      socket.off('kds:ready');
      socket.off('order:new');
      socket.off('order:paid');
      socket.off('order:void');
    };
  }, [socket]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter(n => !n.read).length;
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(p => !p); if (!open) markAllRead(); }}
        style={{ position: 'relative', width: 40, height: 40, border: 'none', borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}
        title="Notifikasi"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, background: '#dc2626', color: 'white', fontSize: '.6rem', fontWeight: 900, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{ position: 'absolute', top: 48, right: 0, width: 360, background: 'white', borderRadius: '1.25rem', boxShadow: '0 16px 48px rgba(0,0,0,.15)', border: '1px solid #e2e8f0', zIndex: 9999, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 800, fontSize: '.9rem', color: '#1e293b' }}>Notifikasi Real-time</div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {notifications.length > 0 && (
                <>
                  <button onClick={markAllRead} title="Tandai semua dibaca" style={{ fontSize: '.7rem', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Baca Semua</button>
                  <button onClick={clearAll} title="Hapus semua" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={14} /></button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto .75rem', display: 'block', opacity: .3 }} />
                <div style={{ fontWeight: 600, fontSize: '.85rem' }}>Tidak ada notifikasi</div>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = ICON_MAP[n.type];
                const Icon = cfg.icon;
                return (
                  <div key={n.id} style={{ display: 'flex', gap: '.875rem', padding: '.875rem 1.25rem', borderBottom: '1px solid #f8fafc', background: n.read ? 'white' : '#f8f9ff', transition: 'background .2s' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#1e293b' }}>{n.message}</div>
                      {n.detail && <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: '.1rem' }}>{n.detail}</div>}
                      <div style={{ fontSize: '.7rem', color: '#94a3b8', marginTop: '.2rem' }}>{n.timestamp.toLocaleTimeString('id-ID')}</div>
                    </div>
                    {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, marginTop: '.4rem' }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
