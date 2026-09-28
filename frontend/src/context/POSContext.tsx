import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { offlineDB } from '../utils/offlineDb';
import { offlineDb } from '../db/offlineDb';
import { syncEngine } from '../services/syncEngine';
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
  businessType?: 'CAFE' | 'BENGKEL' | 'RETAIL' | 'LAUNDRY' | string;
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
    businessType?: string;
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
  openOfflineShift: (shiftData: any) => void;
  closeOfflineShift: () => void;
  fetchTenantFeatures: () => Promise<void>;
  syncOfflineOrders: (authToken?: string) => Promise<void>;
  refreshOfflineQueueCount: () => Promise<void>;
  triggerHaptic: (duration?: number) => void;
}

export const POSContext = createContext<POSContextType | undefined>(undefined);

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('pos_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pos_token') || null;
  });
  const [settings, setSettings] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('pos_active_shift');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && parsed.id) return parsed;
      localStorage.removeItem('pos_active_shift');
      return null;
    } catch (e) {
      return null;
    }
  });
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
    const roleLower = (user?.role || '').toLowerCase();
    // If super admin / platform admin / owner, always true
    if ((roleLower === 'owner' || roleLower === 'admin' || roleLower === 'superadmin') && (user?.username === 'admin' || roleLower === 'owner' || roleLower === 'admin')) return true;
    // Core features always allowed
    if (featureKey === 'pos.cashier' || featureKey === 'inventory.basic' || featureKey === 'finance.cashflow') return true;
    return features.includes(featureKey);
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    const roleLower = (user.role || '').toLowerCase();
    if (roleLower === 'owner' || roleLower === 'admin' || roleLower === 'superadmin' || roleLower === 'manager') return true;
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
      // Count from new Dexie-based system first
      const dexieCount = await offlineDb.getAllPendingOrdersCount();
      // Also count from legacy system
      const queue = await offlineDB.getOfflineQueue();
      setOfflineQueueCount(dexieCount + queue.length);
    } catch (e) {
      console.error('Error getting offline queue count:', e);
    }
  };

  const fetchActiveShift = async () => {
    if (!token) return;
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/shifts/current', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const validShift = (data && data.id) ? data : null;
          setActiveShift(validShift);
          if (validShift) {
            localStorage.setItem('pos_active_shift', JSON.stringify(validShift));
          } else {
            localStorage.removeItem('pos_active_shift');
          }
          return;
        }
      } catch (err) {
        console.warn('Gagal fetch shift online, memuat dari local cache:', err);
      }
    }
    // Fallback jika offline atau fetch gagal
    try {
      const saved = localStorage.getItem('pos_active_shift');
      if (saved) {
        setActiveShift(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error membaca pos_active_shift:', e);
    }
  };

  const openOfflineShift = (shiftData: any) => {
    setActiveShift(shiftData);
    try {
      localStorage.setItem('pos_active_shift', JSON.stringify(shiftData));
    } catch (e) {}
  };

  const closeOfflineShift = () => {
    setActiveShift(null);
    try {
      localStorage.removeItem('pos_active_shift');
    } catch (e) {}
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
      // --- Sync via new Dexie-based offlineDb (SyncEngine) ---
      const pendingCount = await offlineDb.getAllPendingOrdersCount();
      if (pendingCount > 0 && activeToken) {
        const result = await syncEngine.syncAll(activeToken, true);
        if (result.ordersSynced > 0) {
          toast(`✅ ${result.ordersSynced} transaksi offline berhasil disinkronisasikan ke server!`, 'success');
        }
        await refreshOfflineQueueCount();
        return;
      }

      // --- Fallback: Sync via legacy offlineDB (utils/offlineDb.ts) ---
      const queue = await offlineDB.getOfflineQueue();
      setOfflineQueueCount(queue.length);
      if (queue.length === 0) return;

      if (!activeToken) {
        console.log('Belum login / tidak ada token untuk sinkronisasi pesanan offline.');
        return;
      }

      console.log(`[PWA Sync] Menyinkronisasikan ${queue.length} transaksi offline (legacy) ke server...`);
      const res = await fetch('/api/orders/sync-offline', {
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

    const handleDiscrepancyAlert = (data: any) => {
      console.warn('[Socket.IO] Shift discrepancy alert:', data);
      const isPrivileged = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner' || user?.permissions?.canViewReports;
      if (isPrivileged) {
        const diffText = data.selisih > 0 ? `+Rp ${Number(data.selisih).toLocaleString('id-ID')} (Lebih)` : `-Rp ${Math.abs(Number(data.selisih)).toLocaleString('id-ID')} (Kurang)`;
        toast(`⚠️ [Selisih Kas Terdeteksi]: Kasir ${data.cashierName} menutup shift #${data.shiftId} dengan selisih ${diffText}!`, 'error');
      }
    };

    socket.on('shift:status_change', handleShiftChange);
    socket.on('shift:opened', handleShiftChange);
    socket.on('shift:closed', handleShiftChange);
    socket.on('shift:discrepancy_alert', handleDiscrepancyAlert);

    return () => {
      socket.off('shift:status_change', handleShiftChange);
      socket.off('shift:opened', handleShiftChange);
      socket.off('shift:closed', handleShiftChange);
      socket.off('shift:discrepancy_alert', handleDiscrepancyAlert);
    };
  }, [socket, token, user]);

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
    if (userData.businessType) {
      localStorage.setItem('pos_business_type', userData.businessType);
    }
  };

  const logout = async () => {
    // 1. Putus koneksi Socket.IO seketika agar tidak menerima event toko lama
    if (socket) {
      try { socket.disconnect(); } catch (e) {}
    }

    // 2. Bersihkan IndexedDB Dexie secara atomik
    try {
      await offlineDb.clearAllCache();
    } catch (e) {
      console.warn('Gagal membersihkan offline cache:', e);
    }

    // 3. Reset React states
    setUser(null);
    setToken(null);
    setSettings(null);
    setActiveShift(null);
    setFeatures([]);
    setTenantPlan(null);

    // 4. Bersihkan LocalStorage sensitif
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_business_type');
    localStorage.removeItem('pos_active_shift');
    localStorage.removeItem('bluetooth_printer_id');
    localStorage.removeItem('bluetooth_printer_name');
    localStorage.removeItem('bluetooth_printer_mac');
    localStorage.removeItem('bluetooth_printer_type');
    localStorage.removeItem('pos_device_paired');

    // 5. Bersihkan Session Storage dan arahkan browser langsung ke /login
    sessionStorage.clear();
    window.location.href = '/login';
  };

  // Dynamic GUI Morphing: Terapkan warna brand tenant secara dinamis
  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      document.documentElement.style.setProperty('--color-primary', settings.primaryColor);
    }
  }, [settings?.primaryColor]);

  // Handle device deactivation remote event
  useEffect(() => {
    if (!socket) return;
    const handleDeviceDeactivated = () => {
      toast('Perangkat kasir telah dinonaktifkan dari dashboard pusat.', 'warning');
      logout();
    };
    socket.on('device:deactivated', handleDeviceDeactivated);
    return () => {
      socket.off('device:deactivated', handleDeviceDeactivated);
    };
  }, [socket]);

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
      openOfflineShift,
      closeOfflineShift,
      fetchTenantFeatures,
      syncOfflineOrders,
      refreshOfflineQueueCount,
      triggerHaptic
    }}>
      {children}
    </POSContext.Provider>
  );
};
