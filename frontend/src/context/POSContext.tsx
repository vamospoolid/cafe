import { createContext, useState, useEffect, type ReactNode } from 'react';
import { offlineDB } from '../utils/offlineDb';
import { toast } from '../utils/alert';

// Interfaces
export interface User {
  id: number;
  username: string;
  role: string;
  permissions: {
    canVoid: boolean;
    canDiscount: boolean;
    canEditMenu: boolean;
    canViewReports: boolean;
  };
}

interface POSContextType {
  user: User | null;
  token: string | null;
  settings: any;
  activeShift: any | null;
  isOnline: boolean;
  offlineQueueCount: number;
  login: (userData: User, token: string) => void;
  logout: () => void;
  fetchSettings: () => Promise<void>;
  fetchActiveShift: () => Promise<void>;
  syncOfflineOrders: (authToken?: string) => Promise<void>;
  refreshOfflineQueueCount: () => Promise<void>;
  triggerHaptic: (duration?: number) => void;
}

export const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const triggerHaptic = (duration = 35) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  };

  const refreshOfflineQueueCount = async () => {
    try {
      const queue = await offlineDB.getOfflineQueue();
      setOfflineQueueCount(queue.length);
    } catch (e) {
      console.error('Error getting offline queue count:', e);
    }
  };

  const fetchActiveShift = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/shifts/current', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    if (!token) return;
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          // Simpan ke offline cache IndexedDB
          await offlineDB.saveSettings(data);
        }
      } catch (err) {
        console.error('Gagal fetch settings online, memuat dari local cache:', err);
        const cached = await offlineDB.getSettings();
        if (cached) setSettings(cached);
      }
    } else {
      const cached = await offlineDB.getSettings();
      if (cached) {
        setSettings(cached);
      }
    }
  };

  const syncOfflineOrders = async (authToken?: string) => {
    const activeToken = authToken || token;
    try {
      const queue = await offlineDB.getOfflineQueue();
      setOfflineQueueCount(queue.length);
      if (queue.length === 0) return;

      if (!activeToken) {
        console.log('Belum login / tidak ada token untuk sinkronisasi pesanan offline.');
        return;
      }

      console.log(`[PWA Sync] Menyinkronisasikan ${queue.length} transaksi offline ke server...`);
      const res = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ orders: queue })
      });

      if (res.ok) {
        for (const order of queue) {
          await offlineDB.removeOfflineOrder(order.offlineId);
        }
        await refreshOfflineQueueCount();
        triggerHaptic(60);
        toast(`✅ ${queue.length} transaksi offline berhasil disinkronisasikan ke server!`, 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Gagal melakukan sinkronisasi offline:', err.error);
        toast(err.error || 'Sinkronisasi offline gagal.', 'error');
      }
    } catch (err) {
      console.error('Koneksi gagal saat auto-sync:', err);
    }
  };

  useEffect(() => {
    refreshOfflineQueueCount();

    const handleOnline = () => {
      setIsOnline(true);
      toast('🌐 Koneksi internet tersambung kembali.', 'success');
      syncOfflineOrders();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('⚠️ Mode Offline Aktif. Transaksi disimpan di tablet.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token]);

  useEffect(() => {
    const savedUser = localStorage.getItem('pos_user');
    const savedToken = localStorage.getItem('pos_token');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchSettings();
      fetchActiveShift();
      if (navigator.onLine) {
        syncOfflineOrders(token);
      }
    }
  }, [token]);

  const login = (userData: User, newToken: string) => {
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('pos_user', JSON.stringify(userData));
    localStorage.setItem('pos_token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setSettings(null);
    setActiveShift(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
  };

  return (
    <POSContext.Provider value={{
      user,
      token,
      settings,
      activeShift,
      isOnline,
      offlineQueueCount,
      login,
      logout,
      fetchSettings,
      fetchActiveShift,
      syncOfflineOrders,
      refreshOfflineQueueCount,
      triggerHaptic
    }}>
      {children}
    </POSContext.Provider>
  );
};
