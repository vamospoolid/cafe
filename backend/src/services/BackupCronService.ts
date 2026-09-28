import { BackupService, BackupMetadata, PurgeResult } from './BackupService';
import { AuditLogger } from './AuditLogger';

export interface BackupCronRunResult {
  executed: boolean;
  reason?: string;
  backup?: BackupMetadata;
  purgeResult?: PurgeResult;
  timestamp: string;
}

export class BackupCronService {
  private static instance: BackupCronService;
  private lastExecutedDate: string | null = null;
  private isRunning: boolean = false;

  public static getInstance(): BackupCronService {
    if (!BackupCronService.instance) {
      BackupCronService.instance = new BackupCronService();
    }
    return BackupCronService.instance;
  }

  /**
   * Mendapatkan tanggal WIB (Asia/Jakarta, UTC+7) saat ini dalam format YYYY-MM-DD
   */
  public getCurrentWibDate(): { dateString: string; hour: number; minute: number } {
    const now = new Date();
    // UTC + 7 Jam untuk Waktu Indonesia Barat (WIB)
    const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dateString = wibTime.toISOString().split('T')[0];
    const hour = wibTime.getUTCHours();
    const minute = wibTime.getUTCMinutes();
    return { dateString, hour, minute };
  }

  /**
   * Menjalankan siklus backup harian otonom dengan garansi idempotensi.
   * Jadwal target: Pukul 03:00 WIB (toleransi rentang jam 03:00 - 03:59 WIB).
   */
  public async runDailyBackupCycle(force: boolean = false): Promise<BackupCronRunResult> {
    const timestamp = new Date().toISOString();
    const { dateString, hour } = this.getCurrentWibDate();

    if (this.isRunning) {
      return {
        executed: false,
        reason: 'Siklus backup sedang berjalan saat ini.',
        timestamp
      };
    }

    // Jika bukan pemanggilan paksa, verifikasi jadwal jam 03:00 WIB dan idempotensi
    if (!force) {
      if (hour !== 3) {
        return {
          executed: false,
          reason: `Di luar jendela jadwal 03:00 WIB (Waktu server WIB saat ini: ${hour}:00).`,
          timestamp
        };
      }

      if (this.lastExecutedDate === dateString) {
        return {
          executed: false,
          reason: `Backup harian untuk tanggal ${dateString} sudah berhasil dieksekusi sebelumnya.`,
          timestamp
        };
      }
    }

    this.isRunning = true;
    console.log(`[BackupCronService] Memulai siklus pencadangan otomatis PostgreSQL (WIB Date: ${dateString}, Force: ${force})...`);

    try {
      // 1. Eksekusi Full Platform Backup Terenkripsi AES-256 + Gzip
      const backup = await BackupService.createBackup({
        scope: 'FULL',
        isEncrypted: true,
        compress: true,
        type: 'json'
      });

      // 2. Jalankan rotasi retensi GFS (Grandfather-Father-Son)
      const purgeResult = await BackupService.purgeOldBackups();

      this.lastExecutedDate = dateString;

      console.log(`[BackupCronService] ✅ Siklus backup harian 03:00 WIB selesai. Berkas: ${backup.filename}, Ukuran: ${backup.sizeFormatted}`);
      if (purgeResult.prunedCount > 0) {
        console.log(`[BackupCronService] 🗑️ Rotasi GFS memangkas ${purgeResult.prunedCount} berkas lama (${purgeResult.freedFormatted} dibebaskan).`);
      }

      await AuditLogger.log({
        tenantId: null,
        action: 'DATABASE_BACKUP_SCHEDULED',
        resource: 'BACKUP_CRON',
        resourceId: backup.filename,
        description: `Pencadangan otonom PostgreSQL 03:00 WIB berhasil (${backup.sizeFormatted}). Retensi GFS membebaskan ${purgeResult.freedFormatted}.`,
        severity: 'INFO'
      });

      return {
        executed: true,
        backup,
        purgeResult,
        timestamp
      };
    } catch (err: any) {
      console.error('[BackupCronService] ❌ Gagal mengeksekusi siklus backup harian:', err);
      return {
        executed: false,
        reason: `Error: ${err.message}`,
        timestamp
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Mendapatkan status eksekusi terakhir
   */
  public getStatus() {
    const { dateString, hour, minute } = this.getCurrentWibDate();
    return {
      lastExecutedDate: this.lastExecutedDate,
      isRunning: this.isRunning,
      currentWibTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} WIB`,
      currentWibDate: dateString,
      targetSchedule: '03:00 WIB (Daily)',
      retentionPolicy: 'GFS (7 Days Daily, 4 Weeks Weekly, 3 Months Monthly)'
    };
  }
}

export const backupCronService = BackupCronService.getInstance();
