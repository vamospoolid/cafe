/**
 * LocalBackupService.ts
 * Engine Cadangan & Pemulihan Data Lokal (Disaster Recovery & Silent Snapshot)
 * Mengamankan seluruh database Dexie v2 ke dalam berkas .cpb (CodePOS Backup JSON)
 */

import { offlineDb } from '../db/offlineDb';

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  vertical?: string;
  data: {
    products: any[];
    categories: any[];
    ingredients: any[];
    recipes: any[];
    orders: any[];
    orderItems: any[];
    shifts: any[];
    cashFlow: any[];
    customers: any[];
    debts: any[];
    debtPayments: any[];
    workOrders: any[];
    deliveryOrders: any[];
    license: any[];
    settings: any[];
  };
}

export class LocalBackupService {
  /**
   * Ekstrak seluruh database Dexie v2 menjadi objek JSON cadangan
   */
  static async createBackupPayload(vertical: string = 'RETAIL'): Promise<BackupPayload> {
    const [
      products,
      categories,
      ingredients,
      recipes,
      orders,
      orderItems,
      shifts,
      cashFlow,
      customers,
      debts,
      debtPayments,
      workOrders,
      deliveryOrders,
      license,
      settings
    ] = await Promise.all([
      offlineDb.localProducts.toArray(),
      offlineDb.localCategories.toArray(),
      offlineDb.localIngredients.toArray(),
      offlineDb.localRecipes.toArray(),
      offlineDb.localOrders.toArray(),
      offlineDb.localOrderItems.toArray(),
      offlineDb.localShifts.toArray(),
      offlineDb.localCashFlow.toArray(),
      offlineDb.localCustomers.toArray(),
      offlineDb.localDebts.toArray(),
      offlineDb.localDebtPayments.toArray(),
      offlineDb.localWorkOrders.toArray(),
      offlineDb.localDeliveryOrders.toArray(),
      offlineDb.localLicense.toArray(),
      offlineDb.cachedSettings.toArray()
    ]);

    return {
      app: 'CodePOS Standalone',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      vertical,
      data: {
        products,
        categories,
        ingredients,
        recipes,
        orders,
        orderItems,
        shifts,
        cashFlow,
        customers,
        debts,
        debtPayments,
        workOrders,
        deliveryOrders,
        license,
        settings
      }
    };
  }

  /**
   * Unduh file cadangan fisik (.cpb / .json) ke memori tablet atau flashdisk OTG
   */
  static async downloadBackup(vertical: string = 'RETAIL'): Promise<string> {
    const payload = await this.createBackupPayload(vertical);
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `CodePOS_Backup_${vertical.toUpperCase()}_${dateStr}.cpb`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return fileName;
  }

  /**
   * Pulihkan (Restore) database Dexie dari payload JSON cadangan
   */
  static async restoreBackupPayload(payload: BackupPayload): Promise<{ success: boolean; message: string }> {
    if (!payload || !payload.data || payload.version !== '2.0') {
      throw new Error('Format berkas cadangan tidak valid atau versi tidak kompatibel.');
    }

    const { data } = payload;

    await offlineDb.transaction('rw', [
      offlineDb.localProducts,
      offlineDb.localCategories,
      offlineDb.localIngredients,
      offlineDb.localRecipes,
      offlineDb.localOrders,
      offlineDb.localOrderItems,
      offlineDb.localShifts,
      offlineDb.localCashFlow,
      offlineDb.localCustomers,
      offlineDb.localDebts,
      offlineDb.localDebtPayments,
      offlineDb.localWorkOrders,
      offlineDb.localDeliveryOrders,
      offlineDb.cachedSettings
    ], async () => {
      // 1. Bersihkan tabel lama
      await Promise.all([
        offlineDb.localProducts.clear(),
        offlineDb.localCategories.clear(),
        offlineDb.localIngredients.clear(),
        offlineDb.localRecipes.clear(),
        offlineDb.localOrders.clear(),
        offlineDb.localOrderItems.clear(),
        offlineDb.localShifts.clear(),
        offlineDb.localCashFlow.clear(),
        offlineDb.localCustomers.clear(),
        offlineDb.localDebts.clear(),
        offlineDb.localDebtPayments.clear(),
        offlineDb.localWorkOrders.clear(),
        offlineDb.localDeliveryOrders.clear(),
        offlineDb.cachedSettings.clear()
      ]);

      // 2. Isi dengan data pulihan
      if (data.products?.length) await offlineDb.localProducts.bulkPut(data.products);
      if (data.categories?.length) await offlineDb.localCategories.bulkPut(data.categories);
      if (data.ingredients?.length) await offlineDb.localIngredients.bulkPut(data.ingredients);
      if (data.recipes?.length) await offlineDb.localRecipes.bulkPut(data.recipes);
      if (data.orders?.length) await offlineDb.localOrders.bulkPut(data.orders);
      if (data.orderItems?.length) await offlineDb.localOrderItems.bulkPut(data.orderItems);
      if (data.shifts?.length) await offlineDb.localShifts.bulkPut(data.shifts);
      if (data.cashFlow?.length) await offlineDb.localCashFlow.bulkPut(data.cashFlow);
      if (data.customers?.length) await offlineDb.localCustomers.bulkPut(data.customers);
      if (data.debts?.length) await offlineDb.localDebts.bulkPut(data.debts);
      if (data.debtPayments?.length) await offlineDb.localDebtPayments.bulkPut(data.debtPayments);
      if (data.workOrders?.length) await offlineDb.localWorkOrders.bulkPut(data.workOrders);
      if (data.deliveryOrders?.length) await offlineDb.localDeliveryOrders.bulkPut(data.deliveryOrders);
      if (data.settings?.length) await offlineDb.cachedSettings.bulkPut(data.settings);
    });

    return {
      success: true,
      message: `Database berhasil dipulihkan dari cadangan tanggal ${new Date(payload.exportedAt).toLocaleString('id-ID')}.`
    };
  }

  /**
   * Auto-snapshot senyap saat kasir menutup shift (Z-Report)
   * Menyimpan salinan terakhir ke storage lokal perangkat
   */
  static async createSilentShiftSnapshot(vertical: string = 'RETAIL'): Promise<{ success: boolean; filename: string }> {
    try {
      const payload = await this.createBackupPayload(vertical);
      const snapshotString = JSON.stringify(payload);
      const nowIso = new Date().toISOString();
      const filename = `auto_backup_${vertical.toLowerCase()}_${nowIso.slice(0, 10)}.cpb`;
      localStorage.setItem('codepos_last_auto_snapshot', snapshotString);
      localStorage.setItem('codepos_last_auto_snapshot_time', nowIso);
      return { success: true, filename };
    } catch (err) {
      console.warn('[LocalBackupService] Gagal membuat auto-snapshot shift:', err);
      return { success: false, filename: '' };
    }
  }

  /**
   * Alias semantik untuk createSilentShiftSnapshot
   */
  static async createAutoSnapshot(vertical: string = 'RETAIL'): Promise<{ success: boolean; filename: string }> {
    return this.createSilentShiftSnapshot(vertical);
  }
}
