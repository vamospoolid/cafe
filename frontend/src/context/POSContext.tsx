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
  login: (userData: User, token: string) => void;
  logout: () => void;
  fetchSettings: () => Promise<void>;
  fetchActiveShift: () => Promise<void>;
  syncOfflineOrders: (authToken: string) => Promise<void>;
}

export const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  const syncOfflineOrders = async (authToken: string) => {
    try {
      const queue = await offlineDB.getOfflineQueue();
      if (queue.length === 0) return;

      console.log(`Menyinkronisasikan ${queue.length} transaksi offline ke server...`);
      const res = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ orders: queue })
      });

      if (res.ok) {
        // Hapus dari antrean lokal setelah sukses sinkronisasi
        for (const order of queue) {
          await offlineDB.removeOfflineOrder(order.offlineId);
        }
        toast(`${queue.length} transaksi offline berhasil disinkronisasikan!`, 'success');
      } else {
        const err = await res.json();
        console.error('Gagal melakukan sinkronisasi offline:', err.error);
        toast(err.error || 'Sinkronisasi offline gagal.', 'error');
      }
    } catch (err) {
      console.error('Koneksi gagal saat auto-sync:', err);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (token) {
        syncOfflineOrders(token);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('Koneksi terputus. Mode Offline aktif.', 'warning');
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
    <POSContext.Provider value={{ user, token, settings, activeShift, isOnline, login, logout, fetchSettings, fetchActiveShift, syncOfflineOrders }}>
      {children}
    </POSContext.Provider>
  );
};
