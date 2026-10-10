import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Master secret key for HMAC license verification
// Di production, secret key ini juga disimpan di server SaaS VPS untuk generator lisensi
export const MASTER_LICENSE_SALT = 'CODEPOS_STANDALONE_MASTER_SALT_2026_KEY_PRO_SECURE';

export interface LicensePayload {
  hardwareId: string;
  vertical: 'BENGKEL' | 'KAFE' | 'RETAIL' | 'LAUNDRY' | 'RENTAL';
  tier: 'PRO' | 'ENTERPRISE';
  storeName?: string;
  ownerName?: string;
  issuedAt: string;
  expiresAt: string | null; // null = Seumur Hidup (Lifetime)
}

export interface ActivationStatus {
  isActivated: boolean;
  hardwareId: string;
  vertical: string;
  licenseDetails?: LicensePayload;
  errorMessage?: string;
  offlineDaysRemaining?: number;
}

/**
 * Manager Lisensi Anti-Pirasi & Hardware Lock (CPU & Motherboard)
 */
export class LicenseManager {
  private static cachedHardwareId: string | null = null;

  /**
   * Mendapatkan direktori aman %APPDATA%\CodePOS_[Vertical]\
   */
  public static getAppDataDir(vertical: string = 'BENGKEL'): string {
    const base = process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? path.join(process.env.HOME || '', 'Library', 'Application Support')
        : path.join(process.env.HOME || '', '.config'));
    
    const vUpper = vertical.toUpperCase();
    const dir = path.join(base, `CodePOS_${vUpper}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Lokasi file license.key
   */
  public static getLicenseFilePath(vertical: string = 'BENGKEL'): string {
    return path.join(this.getAppDataDir(vertical), 'license.key');
  }

  /**
   * Membaca serial number Motherboard dan CPU processor untuk membentuk Hardware ID unik
   */
  public static async getHardwareId(verticalPrefix: string = 'BENGKEL'): Promise<string> {
    if (this.cachedHardwareId) {
      return this.cachedHardwareId;
    }

    let boardSerial = '';
    let cpuId = '';
    let biosSerial = '';

    if (process.platform === 'win32') {
      try {
        const { stdout: bOut } = await execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"');
        boardSerial = bOut.trim();
      } catch { /* ignore */ }

      try {
        const { stdout: cOut } = await execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).ProcessorId"');
        cpuId = cOut.trim();
      } catch { /* ignore */ }

      try {
        const { stdout: sOut } = await execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_BIOS).SerialNumber"');
        biosSerial = sOut.trim();
      } catch { /* ignore */ }
    } else {
      // Fallback untuk Linux / macOS
      try {
        if (fs.existsSync('/etc/machine-id')) {
          boardSerial = fs.readFileSync('/etc/machine-id', 'utf8').trim();
        } else if (fs.existsSync('/var/lib/dbus/machine-id')) {
          boardSerial = fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
        }
      } catch { /* ignore */ }
    }

    // Fallback jika WMI kosong (misal VM / sanitasi hardware)
    if (!boardSerial && !cpuId && !biosSerial) {
      boardSerial = osFallbackId();
    }

    const combinedRaw = `CODEPOS_${boardSerial}_${cpuId}_${biosSerial}`.toUpperCase();
    const sha256 = crypto.createHash('sha256').update(combinedRaw).digest('hex').toUpperCase();

    // Format menjadi 16 karakter terbagi 4 grup: [PREFIX]-[4 CHAR]-[4 CHAR]-[4 CHAR]
    // Contoh: BK-8821-F904-77A1
    const prefixMap: Record<string, string> = {
      BENGKEL: 'BK',
      KAFE: 'KF',
      RETAIL: 'RT',
      LAUNDRY: 'LD',
      RENTAL: 'RN'
    };
    const prefix = prefixMap[verticalPrefix.toUpperCase()] || 'CP';
    const group1 = sha256.substring(0, 4);
    const group2 = sha256.substring(4, 8);
    const group3 = sha256.substring(8, 12);

    this.cachedHardwareId = `${prefix}-${group1}-${group2}-${group3}`;
    return this.cachedHardwareId;
  }

  /**
   * Membuat Serial Activation Key berlisensi kriptografis HMAC-SHA256
   * (Digunakan di Control Plane / VPS untuk menerbitkan lisensi pembeli)
   */
  public static generateLicenseKey(payload: LicensePayload, secretKey: string = MASTER_LICENSE_SALT): string {
    const jsonStr = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', secretKey).update(payloadBase64).digest('hex').substring(0, 32).toUpperCase();
    return `LIC-${payload.vertical.toUpperCase()}-${payloadBase64}.${signature}`;
  }

  /**
   * Memvalidasi Serial Activation Key terhadap Hardware ID laptop saat ini
   */
  public static async verifyLicenseKey(
    licenseKey: string,
    expectedVertical: string = 'BENGKEL',
    secretKey: string = MASTER_LICENSE_SALT
  ): Promise<{ valid: boolean; payload?: LicensePayload; error?: string }> {
    try {
      if (!licenseKey || !licenseKey.startsWith('LIC-')) {
        return { valid: false, error: 'Format lisensi tidak valid (harus diawali LIC-).' };
      }

      const parts = licenseKey.split('.');
      if (parts.length !== 2) {
        return { valid: false, error: 'Struktur serial key tidak valid.' };
      }

      const [headerAndPayload, providedSignature] = parts;
      const payloadBase64 = headerAndPayload.replace(/^LIC-[A-Z]+-/, '');

      // 1. Verifikasi Signature HMAC
      const expectedSignature = crypto.createHmac('sha256', secretKey)
        .update(payloadBase64)
        .digest('hex')
        .substring(0, 32)
        .toUpperCase();

      if (providedSignature.toUpperCase() !== expectedSignature) {
        return { valid: false, error: 'Tanda tangan lisensi tidak cocok (Serial Key palsu atau rusak).' };
      }

      // 2. Decode payload
      const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload: LicensePayload = JSON.parse(jsonStr);

      // 3. Validasi Hardware ID
      const currentHardwareId = await this.getHardwareId(expectedVertical);
      if (payload.hardwareId !== currentHardwareId) {
        return {
          valid: false,
          error: `Lisensi ini terdaftar untuk Hardware ID lain (${payload.hardwareId}), bukan untuk perangkat ini (${currentHardwareId}).`
        };
      }

      // 4. Validasi Vertikal
      if (payload.vertical.toUpperCase() !== expectedVertical.toUpperCase()) {
        return {
          valid: false,
          error: `Lisensi ini khusus untuk vertikal ${payload.vertical}, tidak berlaku untuk ${expectedVertical}.`
        };
      }

      // 5. Validasi Masa Berlaku (jika bukan lifetime)
      if (payload.expiresAt) {
        const expDate = new Date(payload.expiresAt);
        if (new Date() > expDate) {
          return {
            valid: false,
            error: `Masa aktif lisensi telah berakhir pada ${expDate.toLocaleDateString('id-ID')}.`
          };
        }
      }

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, error: `Gagal memvalidasi serial key: ${err.message}` };
    }
  }

  /**
   * Menyimpan Serial Key ke file %APPDATA%\CodePOS_[Vertical]\license.key
   */
  public static async saveLicenseKey(licenseKey: string, vertical: string = 'BENGKEL'): Promise<void> {
    const filePath = this.getLicenseFilePath(vertical);
    await fs.promises.writeFile(filePath, licenseKey.trim(), 'utf8');
  }

  /**
   * Membaca Serial Key dari file %APPDATA%\CodePOS_[Vertical]\license.key
   */
  public static async loadLicenseKey(vertical: string = 'BENGKEL'): Promise<string | null> {
    const filePath = this.getLicenseFilePath(vertical);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    return content.trim() || null;
  }

  /**
   * Memeriksa status aktivasi saat booting
   */
  public static async checkActivationStatus(vertical: string = 'BENGKEL'): Promise<ActivationStatus> {
    const hardwareId = await this.getHardwareId(vertical);
    const savedKey = await this.loadLicenseKey(vertical);

    if (!savedKey) {
      return {
        isActivated: false,
        hardwareId,
        vertical: vertical.toUpperCase(),
        errorMessage: 'Aplikasi belum diaktivasi. Masukkan Serial Activation Key.'
      };
    }

    const verification = await this.verifyLicenseKey(savedKey, vertical);
    if (!verification.valid) {
      return {
        isActivated: false,
        hardwareId,
        vertical: vertical.toUpperCase(),
        errorMessage: verification.error
      };
    }

    return {
      isActivated: true,
      hardwareId,
      vertical: vertical.toUpperCase(),
      licenseDetails: verification.payload
    };
  }
}

function osFallbackId(): string {
  const cpus = require('os').cpus();
  const cpuModel = cpus && cpus[0] ? cpus[0].model : 'GENERIC_CPU';
  const homedir = require('os').homedir() || 'DEFAULT_USER';
  return `${cpuModel}_${homedir}`;
}
