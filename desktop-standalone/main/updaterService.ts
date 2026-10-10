import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

export class UpdaterService {
  private static CURRENT_VERSION = '1.0.0';

  /**
   * Memeriksa ketersediaan versi pembaruan aplikasi ke SaaS VPS Control Plane
   */
  public static async checkForUpdates(options: {
    serverBaseUrl?: string;
    vertical: string;
  }): Promise<UpdateCheckResult> {
    const baseUrl = options.serverBaseUrl || 'https://mukiramen.codenusa.id';
    const checkUrl = `${baseUrl}/api/sync/check-update?version=${this.CURRENT_VERSION}&vertical=${options.vertical}`;

    return new Promise((resolve) => {
      try {
        const client = checkUrl.startsWith('https') ? https : http;
        const req = client.get(checkUrl, { timeout: 4000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                resolve({
                  hasUpdate: Boolean(parsed.hasUpdate),
                  currentVersion: this.CURRENT_VERSION,
                  latestVersion: parsed.latestVersion || this.CURRENT_VERSION,
                  releaseNotes: parsed.releaseNotes || 'Pembaruan stabilitas dan peningkatan performa.',
                  downloadUrl: parsed.downloadUrl
                });
              } else {
                resolve({
                  hasUpdate: false,
                  currentVersion: this.CURRENT_VERSION,
                  latestVersion: this.CURRENT_VERSION
                });
              }
            } catch {
              resolve({
                hasUpdate: false,
                currentVersion: this.CURRENT_VERSION,
                latestVersion: this.CURRENT_VERSION
              });
            }
          });
        });

        req.on('error', () => {
          resolve({
            hasUpdate: false,
            currentVersion: this.CURRENT_VERSION,
            latestVersion: this.CURRENT_VERSION
          });
        });
      } catch {
        resolve({
          hasUpdate: false,
          currentVersion: this.CURRENT_VERSION,
          latestVersion: this.CURRENT_VERSION
        });
      }
    });
  }

  /**
   * Memastikan integritas folder penyimpanan data pengguna (%APPDATA%)
   * dan file database SQLite sebelum proses update dijalankan.
   */
  public static verifyDataIntegrity(storageDir: string): { ok: boolean; dbExists: boolean; dbSizeKb: number } {
    const dbPath = path.join(storageDir, 'data', 'app.db');
    if (!fs.existsSync(dbPath)) {
      return { ok: true, dbExists: false, dbSizeKb: 0 };
    }

    try {
      const stats = fs.statSync(dbPath);
      return {
        ok: true,
        dbExists: true,
        dbSizeKb: Math.round(stats.size / 1024)
      };
    } catch {
      return { ok: false, dbExists: true, dbSizeKb: 0 };
    }
  }
}
