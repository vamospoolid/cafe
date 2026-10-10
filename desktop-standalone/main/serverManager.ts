import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';

export class ServerManager {
  private static backendProcess: ChildProcess | null = null;
  private static isStarting = false;

  /**
   * Mengecek apakah endpoint HTTP tertentu sudah aktif dan merespon
   */
  public static async checkHealth(url: string, timeoutMs: number = 2000): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const req = http.get(url, { timeout: timeoutMs }, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve(true);
          } else {
            resolve(false);
          }
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Menunggu server aktif dengan polling berkala
   */
  public static async waitForServerReady(url: string, maxWaitMs: number = 20000, intervalMs: number = 600): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const isReady = await this.checkHealth(url, 1500);
      if (isReady) return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  /**
   * Memastikan backend lokal Express aktif. Jika belum ada yang listen di PORT,
   * spawn child process node untuk menjalankan server backend.
   */
  public static async ensureBackendRunning(options: {
    port: number;
    vertical: string;
    appDataDir: string;
    rootDir: string;
  }): Promise<{ success: boolean; port: number; message?: string }> {
    const healthUrl = `http://localhost:${options.port}/api/health`;

    // 1. Cek apakah server sudah aktif di port tersebut
    const alreadyRunning = await this.checkHealth(healthUrl);
    if (alreadyRunning) {
      console.log(`[ServerManager] Backend sudah berjalan di port ${options.port}`);
      return { success: true, port: options.port };
    }

    if (this.isStarting) {
      const ready = await this.waitForServerReady(healthUrl);
      return { success: ready, port: options.port };
    }

    this.isStarting = true;

    try {
      // 2. Lokasi backend entry file
      const backendDistPath = path.join(options.rootDir, 'backend', 'dist', 'index.js');
      const backendTsPath = path.join(options.rootDir, 'backend', 'src', 'index.ts');

      let entryScript = backendDistPath;
      if (!fs.existsSync(backendDistPath) && fs.existsSync(backendTsPath)) {
        entryScript = backendTsPath;
      }

      console.log(`[ServerManager] Meluncurkan backend lokal: ${entryScript}`);

      // Database URL SQLite di AppData pengguna
      const dbPath = path.join(options.appDataDir, 'data', 'app.db');
      const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`;

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PORT: String(options.port),
        STANDALONE_MODE: 'true',
        STANDALONE_VERTICAL: options.vertical,
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        JWT_SECRET: process.env.JWT_SECRET || 'codepos_standalone_offline_secret_key_32chars_min'
      };

      // Jalankan backend via Node
      const nodeExe = process.execPath; // Node runtime dari electron atau sistem
      this.backendProcess = spawn(process.platform === 'win32' ? 'node.exe' : 'node', [entryScript], {
        env,
        cwd: path.join(options.rootDir, 'backend'),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      this.backendProcess.stdout?.on('data', (chunk) => {
        const str = chunk.toString().trim();
        if (str) console.log(`[Backend] ${str}`);
      });

      this.backendProcess.stderr?.on('data', (chunk) => {
        const str = chunk.toString().trim();
        if (str) console.error(`[Backend Err] ${str}`);
      });

      this.backendProcess.on('exit', (code, sig) => {
        console.log(`[ServerManager] Backend process exit dengan kode: ${code}, signal: ${sig}`);
        this.backendProcess = null;
      });

      // Tunggu hingga server siap merespon health check
      const ready = await this.waitForServerReady(healthUrl, 25000);
      this.isStarting = false;

      if (ready) {
        console.log(`[ServerManager] ✅ Backend berhasil aktif dan siap di port ${options.port}`);
        return { success: true, port: options.port };
      } else {
        console.warn(`[ServerManager] ⚠️ Backend belum merespon setelah timeout, melanjutkan tetap...`);
        return { success: false, port: options.port, message: 'Server startup timed out' };
      }
    } catch (err: any) {
      this.isStarting = false;
      console.error(`[ServerManager] ❌ Gagal meluncurkan backend:`, err.message);
      return { success: false, port: options.port, message: err.message };
    }
  }

  /**
   * Graceful shutdown untuk mematikan child process backend saat Electron ditutup
   */
  public static stopBackend(): void {
    if (this.backendProcess) {
      console.log(`[ServerManager] Menghentikan proses backend child...`);
      try {
        this.backendProcess.kill('SIGTERM');
      } catch (e) {
        // Abaikan jika sudah mati
      }
      this.backendProcess = null;
    }
  }
}
