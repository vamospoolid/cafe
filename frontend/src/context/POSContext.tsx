import { createContext, useState, useEffect, type ReactNode } from 'react';
import { offlineDB } from '../utils/offlineDb';
import { toast } from '../utils/alert';
import useSocket from '../hooks/useSocket';

// Interfaces
export interface User {
  id: number;
  name?: string;
  username: string;
  role: string;
  roleId?: string;
  tenantId?: string;
  outletId?: string;
  permissionKeys?: string[];
  permissions: {
    canVoid: boolean;
    canDiscount: boolean;
    canEditMenu: boolean;
    canViewReports: boolean;
    canManageStaff?: boolean;
  };
  isPlatformAdmin?: boolean;
  memberships?: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    roleName: string;
    status: string;
  }>;
}

interface POSContextType {
  user: User | null;
  token: string | null;
  settings: any;
  activeShift: any | null;
  features: string[];
  tenantPlan: any | null;
  isOnline: boolean;
  offlineQueueCount: number;
  login: (userData: User, token: string) => void;
  logout: () => void;
  hasPermission: (permissionKey: string) => boolean;
  hasFeature: (featureKey: string) => boolean;
  fetchSettings: () => Promise<void>;
  fetchActiveShift: () => Promise<void>;
  fetchTenantFeatures: () => Promise<void>;
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
  const [features, setFeatures] = useState<string[]>([]);
  const [tenantPlan, setTenantPlan] = useState<any | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const triggerHaptic = (duration = 35) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  };

  const hasFeature = (featureKey: string): boolean => {
    // If super admin / platform admin, always true
    if (user?.role === 'OWNER' && user?.username === 'admin') return true;
    // Core features always allowed
    if (featureKey === 'pos.cashier' || featureKey === 'inventory.basic' || featureKey === 'finance.cashflow') return true;
    return features.includes(featureKey);
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    if (user.role === 'OWNER' || user.role === 'Admin') return true;
    if (user.permissionKeys && Array.isArray(user.permissionKeys)) {
      return user.permissionKeys.includes(permissionKey);
    }
    // Fallback checking legacy boolean keys
    if (permissionKey === 'pos.void') return !!user.permissions?.canVoid;
    if (permissionKey === 'pos.discount') return !!user.permissions?.canDiscount;
    if (permissionKey === 'products.manage') return !!user.permissions?.canEditMenu;
    if (permissionKey === 'reports.view') return !!user.permissions?.canViewReports;
    if (permissionKey === 'employees.manage') return !!user.permissions?.canManageStaff;
    return false;
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
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (e) {
        localStorage.removeItem('pos_user');
        localStorage.removeItem('pos_token');
      }
    }
  }, []);

  const socket = useSocket();

  const fetchTenantFeatures = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/features/my-features', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || []);
      }
      
      const planRes = await fetch('/api/features/tenant-plan', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (planRes.ok) {
        const planData = await planRes.json();
        setTenantPlan(planData);
      }
    } catch (err) {
      console.error('Error loading tenant features:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSettings();
      fetchActiveShift();
      fetchTenantFeatures();
      if (navigator.onLine) {
        syncOfflineOrders(token);
      }
    }
  }, [token]);

  // Real-time synchronization saat shift dibuka atau ditutup
  useEffect(() => {
    if (!socket) return;

    const handleShiftChange = (data: any) => {
      console.log('[Socket.IO] Shift status updated:', data);
      if (token) {
        fetchActiveShift();
      }
    };

    socket.on('shift:status_change', handleShiftChange);
    socket.on('shift:opened', handleShiftChange);
    socket.on('shift:closed', handleShiftChange);

    return () => {
      socket.off('shift:status_change', handleShiftChange);
      socket.off('shift:opened', handleShiftChange);
      socket.off('shift:closed', handleShiftChange);
    };
  }, [socket, token]);

  // Re-fetch shift saat tab kasir mendapatkan fokus browser kembali
  useEffect(() => {
    const handleFocus = () => {
      if (token) {
        fetchActiveShift();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
    setFeatures([]);
    setTenantPlan(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
  };

  return (
    <POSContext.Provider value={{
      user,
      token,
      settings,
      activeShift,
      features,
      tenantPlan,
      isOnline,
      offlineQueueCount,
      login,
      logout,
      hasPermission,
      hasFeature,
      fetchSettings,
      fetchActiveShift,
      fetchTenantFeatures,
      syncOfflineOrders,
      refreshOfflineQueueCount,
      triggerHaptic
    }}>
      {children}
    </POSContext.Provider>
  );
};
