import { useState, useEffect, useCallback } from 'react';
import { offlineDb } from '../db/offlineDb';
import { syncEngine } from '../services/syncEngine';

const API = import.meta.env.VITE_API_URL || '/api';

export interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
  isSyncing: boolean;
  pendingOrdersCount: number;
  pendingAttendancesCount: number;
  totalPendingCount: number;
  lastCheckedAt: Date;
  checkConnectivity: () => Promise<boolean>;
  triggerSync: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [pendingAttendancesCount, setPendingAttendancesCount] = useState<number>(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(new Date());

  // Subscribe to syncEngine status
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((syncing) => {
      setIsSyncing(syncing);
      refreshPendingCounts();
    });
    return unsubscribe;
  }, []);

  // Function to refresh pending queue counts from IndexedDB
  const refreshPendingCounts = useCallback(async () => {
    try {
      const orders = await offlineDb.getAllPendingOrdersCount();
      const attendances = await offlineDb.getAllPendingAttendancesCount();
      setPendingOrdersCount(orders);
      setPendingAttendancesCount(attendances);
    } catch (err) {
      console.error('[NetworkStatus] Failed to read pending counts:', err);
    }
  }, []);

  // Manual or automatic sync trigger
  const triggerSync = useCallback(async () => {
    await syncEngine.syncAll();
    await refreshPendingCounts();
  }, [refreshPendingCounts]);

  // Ping backend to verify real internet connectivity (anti-captive portal)
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setIsOnline(false);
      await refreshPendingCounts();
      return false;
    }

    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Lightweight ping to health endpoint
      const res = await fetch(`${API}/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const online = res.ok;
      setIsOnline(online);
      setLastCheckedAt(new Date());
      await refreshPendingCounts();

      // Auto-trigger sync when connection is verified and there are pending items
      if (online) {
        const total = await offlineDb.getAllPendingOrdersCount() + await offlineDb.getAllPendingAttendancesCount();
        if (total > 0) {
          syncEngine.syncAll(undefined, true);
        }
      }

      return online;
    } catch (err) {
      setIsOnline(false);
      setLastCheckedAt(new Date());
      await refreshPendingCounts();
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [refreshPendingCounts]);

  useEffect(() => {
    const handleOnline = () => {
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCounts();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check & initial count
    checkConnectivity();

    // Periodic heartbeat check every 25 seconds
    const interval = setInterval(() => {
      checkConnectivity();
    }, 25000);

    // Fast poll for pending counts every 4 seconds
    const countInterval = setInterval(() => {
      refreshPendingCounts();
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      clearInterval(countInterval);
    };
  }, [checkConnectivity, refreshPendingCounts]);

  return {
    isOnline,
    isChecking,
    isSyncing,
    pendingOrdersCount,
    pendingAttendancesCount,
    totalPendingCount: pendingOrdersCount + pendingAttendancesCount,
    lastCheckedAt,
    checkConnectivity,
    triggerSync,
  };
}
