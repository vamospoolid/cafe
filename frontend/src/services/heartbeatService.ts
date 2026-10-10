/**
 * Silent Periodic Heartbeat & Offline Telemetry Service
 * 
 * Melakukan sinkronisasi omset ringkas dan snapshot data secara senyap
 * saat laptop kasir offline mendeteksi koneksi internet (tethering HP 1–2 menit).
 */
import { toast } from '../utils/alert';

const LAST_HEARTBEAT_KEY = 'codepos_last_heartbeat_timestamp';
const HEARTBEAT_INTERVAL_MS = 6 * 60 * 60 * 1000; // Cek setiap 6 jam
const MAX_OFFLINE_DAYS = 30; // Batas toleransi offline 30 hari

export interface HeartbeatMetrics {
  totalOrders?: number;
  totalRevenue?: number;
  lastTransactionAt?: string;
}

export class HeartbeatService {
  private static intervalTimer: any = null;
  private static isSending = false;

  /**
   * Memulai listener navigator.onLine dan periodik timer
   */
  public static init(): () => void {
    // 1. Cek langsung saat aplikasi pertama kali terbuka jika online
    if (navigator.onLine) {
      setTimeout(() => this.triggerSilentHeartbeat(), 3000);
    }

    // 2. Listener event online: kasir baru saja menyalakan tethering HP
    const handleOnline = () => {
      console.log('[Heartbeat] Koneksi internet terdeteksi. Menjalankan sinkronisasi senyap...');
      setTimeout(() => this.triggerSilentHeartbeat(), 2000);
    };

    window.addEventListener('online', handleOnline);

    // 3. Periodic timer setiap 6 jam
    this.intervalTimer = setInterval(() => {
      if (navigator.onLine) {
        this.triggerSilentHeartbeat();
      } else {
        this.checkOfflineGracePeriod();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // 4. Periksa batas toleransi 30 hari saat booting
    this.checkOfflineGracePeriod();

    return () => {
      window.removeEventListener('online', handleOnline);
      if (this.intervalTimer) clearInterval(this.intervalTimer);
    };
  }

  /**
   * Menghitung berapa hari laptop kasir berjalan 100% tanpa internet
   */
  public static getOfflineDays(): number {
    const lastTimestampStr = localStorage.getItem(LAST_HEARTBEAT_KEY);
    if (!lastTimestampStr) return 0;
    const last = new Date(lastTimestampStr).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Peringatan ramah jika sudah > 30 hari belum pernah tethering HP
   */
  public static checkOfflineGracePeriod(): void {
    const days = this.getOfflineDays();
    if (days >= MAX_OFFLINE_DAYS) {
      toast(
        `ℹ️ Pengingat Cadangan Data: Aplikasi telah berjalan offline selama ${days} hari. Sambungkan WiFi atau tethering HP sebentar (1 menit) untuk mengamankan data dan memvalidasi lisensi.`,
        'info'
      );
    }
  }

  /**
   * Mengirim payload heartbeat ringkas ke SaaS VPS secara senyap
   */
  public static async triggerSilentHeartbeat(customMetrics?: HeartbeatMetrics): Promise<boolean> {
    if (this.isSending || !navigator.onLine) return false;

    try {
      this.isSending = true;

      // 1. Dapatkan Hardware ID & Lisensi
      let hardwareId = localStorage.getItem('codepos_hardware_id') || '';
      let licenseKey = localStorage.getItem('codepos_license_key') || '';

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          if (!hardwareId && (window as any).electronAPI.getHardwareId) {
            hardwareId = await (window as any).electronAPI.getHardwareId();
          }
          if (!licenseKey && (window as any).electronAPI.getLicenseStatus) {
            const status = await (window as any).electronAPI.getLicenseStatus();
            licenseKey = status?.licenseDetails ? status.licenseKey : licenseKey;
          }
        } catch { /* ignore */ }
      }

      if (!hardwareId || !licenseKey) {
        // Belum diaktivasi atau bukan mode beli-putus
        return false;
      }

      // 2. Kumpulkan metrik omset ringkas dari localStorage atau parameter
      const vertical = (import.meta.env.VITE_STANDALONE_VERTICAL || 'BENGKEL').toUpperCase();
      const payload = {
        hardwareId,
        licenseKey,
        vertical,
        version: '1.0.0',
        metrics: customMetrics || {
          totalOrders: Number(localStorage.getItem('codepos_cached_total_orders') || 0),
          totalRevenue: Number(localStorage.getItem('codepos_cached_total_revenue') || 0),
          lastTransactionAt: new Date().toISOString()
        }
      };

      const res = await fetch('/api/sync/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          localStorage.setItem(LAST_HEARTBEAT_KEY, new Date().toISOString());
          console.log('[Heartbeat] ✅ Silent Cloud Backup & Heartbeat berhasil disinkronkan.');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('[Heartbeat] Gagal mengirim heartbeat (koneksi terputus):', err);
      return false;
    } finally {
      this.isSending = false;
    }
  }
}
