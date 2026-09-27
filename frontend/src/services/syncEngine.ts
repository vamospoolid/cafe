import { offlineDb, type PendingOrder, type PendingAttendance } from '../db/offlineDb';
import { seedLocalCatalogCache } from '../utils/catalogCacheSeeder';
import { toast } from '../utils/alert';

const API = import.meta.env.VITE_API_URL || '/api';

export interface SyncResult {
  ordersSynced: number;
  attendancesSynced: number;
  errors: string[];
  success: boolean;
}

class SyncEngineService {
  private isSyncing = false;
  private syncListeners: Array<(isSyncing: boolean) => void> = [];

  public subscribe(listener: (isSyncing: boolean) => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private setSyncState(state: boolean) {
    this.isSyncing = state;
    this.syncListeners.forEach((l) => l(state));
  }

  public getStatus() {
    return { isSyncing: this.isSyncing };
  }

  /**
   * Synchronize pending offline orders to backend
   */
  async syncPendingOrders(token?: string): Promise<{ syncedCount: number; errors: string[] }> {
    const authToken = token || localStorage.getItem('pos_token') || localStorage.getItem('token') || localStorage.getItem('staff_token');
    if (!authToken) {
      return { syncedCount: 0, errors: ['No auth token available for sync'] };
    }

    const pendingOrders = await offlineDb.getPendingOrders();
    if (pendingOrders.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    const offlineIds = pendingOrders.map((o) => o.offlineId);
    await offlineDb.markOrderSyncing(offlineIds);

    try {
      const res = await fetch(`${API}/orders/sync-offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ orders: pendingOrders }),
      });

      const data = await res.json();
      if (res.ok) {
        // Mark all successfully synced orders
        for (const ord of pendingOrders) {
          await offlineDb.markOrderSynced(ord.offlineId);
        }

        await offlineDb.logSync({
          timestamp: new Date().toISOString(),
          type: 'ORDER_SYNC',
          count: data.syncedCount || pendingOrders.length,
          status: 'SUCCESS',
          details: `Synced ${data.syncedCount} offline orders (${data.skippedCount || 0} duplicates skipped)`,
        });

        return { syncedCount: data.syncedCount || pendingOrders.length, errors: data.errors || [] };
      } else {
        for (const ord of pendingOrders) {
          await offlineDb.markOrderFailed(ord.offlineId, data.error || 'Server rejected batch sync');
        }
        return { syncedCount: 0, errors: [data.error || 'Gagal sinkronisasi order'] };
      }
    } catch (err: any) {
      for (const ord of pendingOrders) {
        await offlineDb.markOrderFailed(ord.offlineId, err.message || 'Network error during sync');
      }
      return { syncedCount: 0, errors: [err.message || 'Network connection failed'] };
    }
  }

  /**
   * Synchronize pending offline staff attendances
   */
  async syncPendingAttendances(token?: string): Promise<{ syncedCount: number; errors: string[] }> {
    const authToken = token || localStorage.getItem('pos_token') || localStorage.getItem('staff_token') || localStorage.getItem('token');
    if (!authToken) {
      return { syncedCount: 0, errors: ['No auth token available'] };
    }

    const pendingAtts = await offlineDb.getPendingAttendances();
    if (pendingAtts.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    try {
      const res = await fetch(`${API}/attendance/sync-offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ attendances: pendingAtts }),
      });

      const data = await res.json();
      if (res.ok) {
        for (const att of pendingAtts) {
          await offlineDb.markAttendanceSynced(att.offlineId);
        }

        await offlineDb.logSync({
          timestamp: new Date().toISOString(),
          type: 'ATTENDANCE_SYNC',
          count: data.syncedCount || pendingAtts.length,
          status: 'SUCCESS',
          details: `Synced ${data.syncedCount} offline staff attendances`,
        });

        return { syncedCount: data.syncedCount || pendingAtts.length, errors: data.errors || [] };
      } else {
        for (const att of pendingAtts) {
          await offlineDb.markAttendanceFailed(att.offlineId, data.error || 'Server error');
        }
        return { syncedCount: 0, errors: [data.error || 'Gagal sinkronisasi absensi'] };
      }
    } catch (err: any) {
      for (const att of pendingAtts) {
        await offlineDb.markAttendanceFailed(att.offlineId, err.message || 'Network error');
      }
      return { syncedCount: 0, errors: [err.message || 'Network error'] };
    }
  }

  /**
   * Master Sync Function: Runs orders, attendances, and catalog refresh
   */
  async syncAll(token?: string, silent = false): Promise<SyncResult> {
    if (this.isSyncing) {
      return { ordersSynced: 0, attendancesSynced: 0, errors: ['Sync already in progress'], success: false };
    }

    this.setSyncState(true);
    const errors: string[] = [];
    let ordersSynced = 0;
    let attendancesSynced = 0;

    try {
      // 1. Sync Orders
      const orderRes = await this.syncPendingOrders(token);
      ordersSynced = orderRes.syncedCount;
      if (orderRes.errors.length > 0) errors.push(...orderRes.errors);

      // 2. Sync Attendances
      const attRes = await this.syncPendingAttendances(token);
      attendancesSynced = attRes.syncedCount;
      if (attRes.errors.length > 0) errors.push(...attRes.errors);

      // 3. Refresh Catalog Cache
      await seedLocalCatalogCache(token);

      // 4. Cleanup old synced items (older than 3 days)
      await offlineDb.clearSyncedOrders(3);

      const total = ordersSynced + attendancesSynced;
      if (!silent && total > 0) {
        toast(
          `✅ Berhasil menyinkronkan ${ordersSynced} transaksi & ${attendancesSynced} presensi ke Cloud!`,
          'success'
        );
      }

      return {
        ordersSynced,
        attendancesSynced,
        errors,
        success: errors.length === 0,
      };
    } catch (err: any) {
      console.error('[SyncEngine] Unexpected sync failure:', err);
      errors.push(err.message || 'Unknown sync error');
      if (!silent) {
        toast(`⚠️ Sinkronisasi offline: ${err.message}`, 'error');
      }
      return { ordersSynced, attendancesSynced, errors, success: false };
    } finally {
      this.setSyncState(false);
    }
  }
}

export const syncEngine = new SyncEngineService();
