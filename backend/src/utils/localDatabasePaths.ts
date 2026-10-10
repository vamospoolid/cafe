import path from 'path';
import fs from 'fs';

export type StandaloneVertical = 'BENGKEL' | 'KAFE' | 'RETAIL' | 'LAUNDRY' | 'RENTAL';

export interface StandaloneStoragePaths {
  rootDir: string;
  dataDir: string;
  dbFilePath: string;
  databaseUrl: string;
  licenseFilePath: string;
  backupDir: string;
}

/**
 * Mendapatkan direktori dasar penyimpanan yang aman dari proteksi Windows UAC.
 * Menggunakan %APPDATA% pada Windows, internal sandbox pada Android,
 * dan ~/.config pada Linux/macOS.
 */
export function getLocalDatabasePaths(
  vertical: StandaloneVertical | string = process.env.STANDALONE_VERTICAL || 'BENGKEL'
): StandaloneStoragePaths {
  const normalizedVertical = (vertical || 'BENGKEL').toUpperCase().trim();
  const folderName = `CodePOS_${normalizedVertical}`;

  let baseDir: string;

  if (process.platform === 'win32') {
    // Windows: Gunakan %APPDATA% (Roaming) untuk data pengguna persisten
    const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : null);
    if (appData) {
      baseDir = path.join(appData, folderName);
    } else {
      baseDir = path.join(process.cwd(), 'local_storage', folderName);
    }
  } else if (process.env.ANDROID_STORAGE_PATH) {
    // Android (Capacitor / Termux / Node runtime sandbox)
    baseDir = path.join(process.env.ANDROID_STORAGE_PATH, folderName);
  } else {
    // Linux / macOS
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      baseDir = path.join(homeDir, '.config', folderName);
    } else {
      baseDir = path.join(process.cwd(), 'local_storage', folderName);
    }
  }

  const dataDir = path.join(baseDir, 'data');
  const backupDir = path.join(baseDir, 'backups');
  const dbFilePath = path.join(dataDir, 'app.db');
  const licenseFilePath = path.join(baseDir, 'license.key');

  // Pastikan folder data dan backup selalu tersedia (Anti-ENOENT crash)
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch (err) {
    console.error(`[LocalDatabasePaths] Gagal membuat direktori penyimpanan: ${dataDir}`, err);
  }

  // Format URL SQLite untuk Prisma (gunakan forward slashes agar aman di Windows)
  const normalizedDbPath = dbFilePath.replace(/\\/g, '/');
  const databaseUrl = `file:${normalizedDbPath}`;

  return {
    rootDir: baseDir,
    dataDir,
    dbFilePath,
    databaseUrl,
    licenseFilePath,
    backupDir
  };
}

/**
 * Menginisialisasi environment variable DATABASE_URL saat booting mode standalone
 */
export function initializeStandaloneDatabaseUrl(
  vertical?: StandaloneVertical | string
): string {
  const paths = getLocalDatabasePaths(vertical);
  process.env.DATABASE_URL = paths.databaseUrl;
  return paths.databaseUrl;
}
