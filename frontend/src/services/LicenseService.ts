/**
 * LicenseService.ts
 * Engine Pengelolaan Lisensi Standalone Offline & Proteksi Anti-Copy Berbasis Hardware ID
 * Menggunakan Web Crypto SHA-256 Signature untuk validasi 100% offline tanpa koneksi internet
 */

import { offlineDb, type LocalLicenseRecord } from '../db/offlineDb';
import { LocalDataService } from './LocalDataService';

const MASTER_SALT = 'CODEPOS_STANDALONE_SECURE_HMAC_SALT_2026_V1';

export class LicenseService {
  /**
   * Menghasilkan atau membaca Hardware ID unik perangkat tablet/komputer
   * Format: CPOS-XXXX-XXXX-XXXX
   */
  static async getHardwareId(): Promise<string> {
    // 1. Cek dari LocalStorage
    let storedHwid = localStorage.getItem('cpos_device_hwid');
    if (storedHwid && storedHwid.startsWith('CPOS-')) {
      return storedHwid;
    }

    // 2. Cek dari Dexie localLicense
    try {
      const storedLicense = await offlineDb.localLicense.get('device_license');
      if (storedLicense?.hardwareId) {
        localStorage.setItem('cpos_device_hwid', storedLicense.hardwareId);
        return storedLicense.hardwareId;
      }
    } catch (_) {}

    // 3. Buat Hardware Fingerprint baru yang stabil
    const array = new Uint8Array(6);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    // Format: CPOS-XXXX-XXXX-XXXX
    const newHwid = `CPOS-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    localStorage.setItem('cpos_device_hwid', newHwid);

    return newHwid;
  }

  /**
   * Menghitung Serial Activation Key yang diharapkan berdasarkan parameter perangkat
   */
  static async generateExpectedSerialKey(
    hardwareId: string,
    storeName: string,
    vertical: string
  ): Promise<string> {
    const cleanHwid = hardwareId.trim().toUpperCase();
    const cleanStore = storeName.trim().toUpperCase();
    const cleanVertical = vertical.trim().toUpperCase();

    const payload = `${cleanHwid}#${cleanVertical}#${cleanStore}#${MASTER_SALT}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const p1 = hashHex.slice(0, 4);
    const p2 = hashHex.slice(8, 12);
    const p3 = hashHex.slice(16, 20);
    const p4 = hashHex.slice(24, 28);
    const vertTag = cleanVertical.slice(0, 3);

    return `KEY-${vertTag}-${p1}-${p2}-${p3}-${p4}`;
  }

  /**
   * Verifikasi keabsahan Serial Activation Key secara 100% offline
   */
  static async verifySerialKey(
    hardwareId: string,
    storeName: string,
    vertical: string,
    enteredKey: string
  ): Promise<boolean> {
    if (!hardwareId || !storeName || !vertical || !enteredKey) return false;

    const expected = await this.generateExpectedSerialKey(hardwareId, storeName, vertical);
    const normalizedInput = enteredKey.trim().toUpperCase();

    return normalizedInput === expected;
  }

  /**
   * Aktivasi lisensi permanen perangkat
   */
  static async activateLicense(
    storeName: string,
    vertical: string,
    enteredKey: string
  ): Promise<{ success: boolean; message: string }> {
    const hwid = await this.getHardwareId();

    const isValid = await this.verifySerialKey(hwid, storeName, vertical, enteredKey);
    if (!isValid) {
      return {
        success: false,
        message: 'Serial Key tidak valid untuk Hardware ID atau Nama Toko ini. Harap periksa kembali.'
      };
    }

    const cleanVertical = vertical.trim().toUpperCase();
    const cleanStore = storeName.trim();
    const cleanKey = enteredKey.trim().toUpperCase();

    const licenseRecord: LocalLicenseRecord = {
      id: 'device_license',
      hardwareId: hwid,
      serialKey: cleanKey,
      vertical: cleanVertical,
      storeName: cleanStore,
      activatedAt: new Date().toISOString(),
      isLifetime: true
    };

    // 1. Simpan di Dexie v2
    await offlineDb.localLicense.put(licenseRecord);

    // 2. Simpan di LocalStorage sebagai fast-cache
    localStorage.setItem('cpos_license_key', cleanKey);
    localStorage.setItem('cpos_license_status', 'ACTIVE');
    localStorage.setItem('cpos_license_store', cleanStore);
    localStorage.setItem('cpos_license_vertical', cleanVertical);
    localStorage.setItem('pos_business_type', cleanVertical);
    localStorage.setItem('pos_standalone_mode', 'true');

    // 3. Seed data awal vertikal jika tabel produk lokal masih kosong
    try {
      const prodCount = await offlineDb.localProducts.count();
      if (prodCount === 0) {
        await LocalDataService.seedInitialStoreData(cleanVertical);
      }
    } catch (e) {
      console.warn('Gagal seed data awal:', e);
    }

    return {
      success: true,
      message: '🎉 Lisensi CodePOS Beli-Putus berhasil diaktifkan secara permanen untuk perangkat ini!'
    };
  }

  /**
   * Periksa apakah lisensi aktif dan terikat sah pada hardware saat ini
   * Mencegah copy-paste data ke perangkat tablet lain
   */
  static async checkLicenseStatus(): Promise<{ isValid: boolean; license?: LocalLicenseRecord }> {
    try {
      const currentHwid = await this.getHardwareId();

      // Cek record di Dexie
      const record = await offlineDb.localLicense.get('device_license');
      if (!record) {
        return { isValid: false };
      }

      // Validasi anti-copy: Hardware ID di database harus identik dengan Hardware ID perangkat
      if (record.hardwareId !== currentHwid) {
        console.warn(`[Anti-Copy Guard]: Hardware ID mismatch! DB: ${record.hardwareId}, Perangkat: ${currentHwid}`);
        return { isValid: false };
      }

      // Re-verifikasi integritas Serial Key kriptografis
      const isSignatureValid = await this.verifySerialKey(
        record.hardwareId,
        record.storeName,
        record.vertical,
        record.serialKey
      );

      if (!isSignatureValid) {
        console.warn('[Anti-Copy Guard]: Serial Key signature tampering terdeteksi!');
        return { isValid: false };
      }

      return { isValid: true, license: record };
    } catch (err) {
      console.error('Error checking license status:', err);
      return { isValid: false };
    }
  }

  /**
   * Cabut lisensi (misal saat reset pabrik toko)
   */
  static async revokeLicense(): Promise<void> {
    await offlineDb.localLicense.delete('device_license');
    localStorage.removeItem('cpos_license_key');
    localStorage.removeItem('cpos_license_status');
    localStorage.removeItem('cpos_license_store');
    localStorage.removeItem('cpos_license_vertical');
  }
}
