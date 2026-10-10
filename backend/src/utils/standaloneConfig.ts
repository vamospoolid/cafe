export type StandaloneVertical = 'BENGKEL' | 'KAFE' | 'RETAIL' | 'LAUNDRY' | 'RENTAL';

export const STANDALONE_DEFAULT_TENANT_ID = 'standalone';
export const STANDALONE_DEFAULT_OUTLET_ID = 'outlet-standalone-1';

export class StandaloneConfig {
  /**
   * Menentukan apakah backend sedang berjalan dalam mode Offline Standalone (.EXE / .APK)
   */
  public static isStandalone(): boolean {
    return (
      process.env.STANDALONE_MODE === 'true' ||
      process.env.VITE_STANDALONE_MODE === 'true' ||
      process.env.IS_ELECTRON_STANDALONE === 'true'
    );
  }

  /**
   * Mengambil vertikal bisnis yang sedang aktif untuk produk offline
   */
  public static getVertical(): StandaloneVertical {
    const raw = (process.env.STANDALONE_VERTICAL || 'BENGKEL').toUpperCase().trim();
    if (['BENGKEL', 'KAFE', 'RETAIL', 'LAUNDRY', 'RENTAL'].includes(raw)) {
      return raw as StandaloneVertical;
    }
    return 'BENGKEL';
  }

  /**
   * Mengambil Tenant ID baku untuk database lokal single-tenant
   */
  public static getTenantId(): string {
    return process.env.STANDALONE_TENANT_ID || STANDALONE_DEFAULT_TENANT_ID;
  }

  /**
   * Mengambil Outlet ID baku untuk kasir lokal
   */
  public static getOutletId(): string {
    return process.env.STANDALONE_OUTLET_ID || STANDALONE_DEFAULT_OUTLET_ID;
  }
}
