import Dexie, { type Table } from 'dexie';

// â”€â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CachedProduct {
  id: number;
  name: string;
  price: number;
  sellPrice?: number; // alias of price, used by POSView
  cost?: number;
  categoryId?: number;
  categoryName?: string;
  barcode?: string;
  imageUrl?: string;
  trackStock?: boolean;
  stock?: number;
  minStock?: number;
  variants?: any[];
  tenantId?: string;
  updatedAt?: string;
}

export interface CachedCategory {
  id: number;
  name: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  printerTarget?: string;
  stationTarget?: string;
  isActive?: boolean;
  parentId?: number | null;
  subCategories?: any[];
  tenantId?: string;
}

export interface CachedTable {
  id: number;
  tableNo: string;
  capacity: number;
  status: string;
  tenantId?: string;
  offlineOccupied?: boolean;
  offlineOrderNumber?: string;
}

export interface CachedSetting {
  id: string; // usually 'current_settings'
  storeName: string;
  address?: string;
  phone?: string;
  receiptFooter?: string;
  taxPercentage: number;
  servicePercentage: number;
  qrisUrl?: string;
  tenantId?: string;
  updatedAt?: string;
}

export interface PendingOrder {
  id?: number; // local auto-increment key
  offlineId: string; // Unique UUID (e.g. "OFF-uuid-2026")
  orderNumber: string;
  tableId?: number;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  items: {
    productId: number;
    productName: string;
    quantity: number;
    price: number;
    cost?: number;
    notes?: string;
    selectedVariants?: any[];
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  service: number;
  total: number;
  paymentMethod: 'CASH' | 'QRIS_MANUAL' | 'DEBIT' | 'TRANSFER';
  cashAmountPaid?: number;
  cashChange?: number;
  clientTimestamp: string; // ISO string when order was placed
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  syncError?: string;
  retryCount: number;
  tenantId?: string;
  outletId?: string;
  cashierId?: string;
  cashierName?: string;
  rawPayload?: any;
}

export interface PendingAttendance {
  id?: number; // local auto-increment key
  offlineId: string; // Unique UUID
  userId: string;
  userName: string;
  tenantId?: string;
  type: 'IN' | 'OUT' | 'BREAK_IN' | 'BREAK_OUT';
  photoBase64?: string; // Compressed JPEG
  latitude?: number;
  longitude?: number;
  notes?: string;
  clientTimestamp: string; // ISO string
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  syncError?: string;
  retryCount: number;
}

export interface SyncLog {
  id?: number;
  timestamp: string;
  type: 'ORDER_SYNC' | 'ATTENDANCE_SYNC' | 'CATALOG_DOWNLOAD';
  count: number;
  status: 'SUCCESS' | 'ERROR';
  details?: string;
}

// ─── Standalone Offline Operational Interfaces (Version 2) ───────────────────

export interface LocalProduct {
  id?: number;
  code?: string;
  name: string;
  price: number;
  sellPrice?: number;
  cost?: number;
  buyPrice?: number;
  categoryId?: number;
  categoryName?: string;
  barcode?: string;
  imageUrl?: string;
  trackStock?: boolean;
  stock?: number;
  minStock?: number;
  unit?: string;
  // Multi-UOM
  multiUomEnabled?: boolean;
  uomList?: { unit: string; conversion: number; price: number; barcode?: string }[];
  // 3-Tier Pricing
  wholesalePrice?: number;
  contractorPrice?: number;
  wholesaleMinQty?: number;
  variants?: any[];
  tenantId?: string;
  updatedAt?: string;
}

export interface LocalCategory {
  id?: number;
  name: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  parentId?: number | null;
  tenantId?: string;
}

export interface LocalIngredient {
  id?: number;
  name: string;
  category?: string;
  unit: string;
  stock: number;
  minStock?: number;
  buyPrice: number;
  tenantId?: string;
}

export interface LocalRecipe {
  id?: number;
  productId: number;
  ingredientId: number;
  qtyPerServing: number;
}

export interface LocalOrder {
  id?: number;
  orderNumber: string;
  offlineId: string;
  tableId?: number | null;
  tableName?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  paymentMethod: string; // CASH | QRIS | TRANSFER | BON | TEMPO | SPLIT
  status: 'Paid' | 'Pending' | 'Void';
  isPaid: boolean;
  shiftId?: number | null;
  userId?: number | null;
  cashierName?: string | null;
  notes?: string | null;
  createdAt: string; // ISO timestamp
  paidAt?: string | null;
  tenantId?: string;
  businessType?: string; // CAFE | RETAIL | BENGKEL | LAUNDRY | RENTAL
}

export interface LocalOrderItem {
  id?: number;
  orderId: number;
  productId: number;
  productName: string;
  qty: number;
  price: number;
  cost?: number;
  subtotal: number;
  notes?: string;
  selectedUom?: string;
  selectedVariants?: any[];
}

export interface LocalShift {
  id?: number;
  status: 'Open' | 'Closed';
  waktuBuka: string; // ISO string
  waktuTutup?: string | null;
  userId?: number;
  cashierName?: string;
  saldoAwal: number;
  saldoSistem?: number;
  saldoElektronik?: number;
  saldoFisikLaci?: number;
  selisih?: number;
  varianceReason?: string | null;
  tenantId?: string;
}

export interface LocalCashFlow {
  id?: number;
  type: 'Pemasukan' | 'Pengeluaran';
  category: string;
  cashPocket: 'LACI_KASIR' | 'KAS_OPERASIONAL';
  amount: number;
  description?: string;
  shiftId?: number | null;
  userId?: number;
  createdAt: string;
  tenantId?: string;
}

export interface LocalCustomer {
  id?: number;
  name: string;
  phone?: string;
  points: number;
  totalSpent: number;
  tier?: string;
  creditLimit?: number; // Plafon bon tempo (Retail/Bengkel)
  currentDebt?: number; // Sisa hutang aktif
  tenantId?: string;
}

export interface LocalDebt {
  id?: number;
  orderId?: number | null;
  orderNumber?: string | null;
  customerId: number;
  customerName?: string;
  totalAmount: number;
  remaining: number;
  status: 'Belum Lunas' | 'Lunas';
  dueDate?: string | null;
  createdAt: string;
  tenantId?: string;
}

export interface LocalDebtPayment {
  id?: number;
  debtId: number;
  amountPaid: number;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  tenantId?: string;
}

export interface LocalWorkOrder {
  id?: number;
  spkNumber: string;
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  customerName: string;
  customerPhone?: string;
  mechanicId?: number;
  mechanicName?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAID' | 'CANCELLED';
  total: number;
  createdAt: string;
  tenantId?: string;
}

export interface LocalDeliveryOrder {
  id?: number;
  doNumber: string;
  orderId: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';
  recipientName?: string;
  driverName?: string;
  vehiclePlate?: string;
  notes?: string;
  createdAt: string;
  deliveredAt?: string;
  tenantId?: string;
}

export interface LocalLicenseRecord {
  id: string; // 'device_license'
  hardwareId: string;
  serialKey: string;
  vertical: string;
  storeName: string;
  activatedAt: string;
  isLifetime: boolean;
}

// ─── Dexie Database Class ───────────────────────────────────────────────────

export class CodenusaOfflineDatabase extends Dexie {
  cachedProducts!: Table<CachedProduct, number>;
  cachedCategories!: Table<CachedCategory, number>;
  cachedTables!: Table<CachedTable, number>;
  cachedSettings!: Table<CachedSetting, string>;
  pendingOrders!: Table<PendingOrder, number>;
  pendingAttendances!: Table<PendingAttendance, number>;
  syncLogs!: Table<SyncLog, number>;

  // Standalone Offline Tables (Version 2)
  localProducts!: Table<LocalProduct, number>;
  localCategories!: Table<LocalCategory, number>;
  localIngredients!: Table<LocalIngredient, number>;
  localRecipes!: Table<LocalRecipe, number>;
  localOrders!: Table<LocalOrder, number>;
  localOrderItems!: Table<LocalOrderItem, number>;
  localShifts!: Table<LocalShift, number>;
  localCashFlow!: Table<LocalCashFlow, number>;
  localCustomers!: Table<LocalCustomer, number>;
  localDebts!: Table<LocalDebt, number>;
  localDebtPayments!: Table<LocalDebtPayment, number>;
  localWorkOrders!: Table<LocalWorkOrder, number>;
  localDeliveryOrders!: Table<LocalDeliveryOrder, number>;
  localLicense!: Table<LocalLicenseRecord, string>;

  constructor() {
    super('CodenusaPOS_OfflineDB');

    // Schema Version 1 (Legacy Cache / Queue)
    this.version(1).stores({
      cachedProducts: 'id, categoryId, name, barcode, tenantId',
      cachedCategories: 'id, name, tenantId',
      cachedTables: 'id, tableNo, status, tenantId',
      cachedSettings: 'id, tenantId',
      pendingOrders: '++id, offlineId, syncStatus, clientTimestamp, tenantId',
      pendingAttendances: '++id, offlineId, userId, syncStatus, clientTimestamp, tenantId',
      syncLogs: '++id, timestamp, type, status',
    });

    // Schema Version 2 (Full Standalone Offline Architecture)
    this.version(2).stores({
      cachedProducts: 'id, categoryId, name, barcode, tenantId',
      cachedCategories: 'id, name, tenantId',
      cachedTables: 'id, tableNo, status, tenantId',
      cachedSettings: 'id, tenantId',
      pendingOrders: '++id, offlineId, syncStatus, clientTimestamp, tenantId',
      pendingAttendances: '++id, offlineId, userId, syncStatus, clientTimestamp, tenantId',
      syncLogs: '++id, timestamp, type, status',

      // Operational Standalone Local Tables
      localProducts: '++id, name, barcode, categoryId, tenantId',
      localCategories: '++id, name, tenantId',
      localIngredients: '++id, name, category, tenantId',
      localRecipes: '++id, productId, ingredientId',
      localOrders: '++id, orderNumber, offlineId, status, paymentMethod, customerId, shiftId, createdAt, tenantId',
      localOrderItems: '++id, orderId, productId',
      localShifts: '++id, status, waktuBuka, waktuTutup, userId, tenantId',
      localCashFlow: '++id, type, category, cashPocket, shiftId, createdAt, tenantId',
      localCustomers: '++id, name, phone, tenantId',
      localDebts: '++id, orderId, customerId, status, dueDate, tenantId',
      localDebtPayments: '++id, debtId, createdAt, tenantId',
      localWorkOrders: '++id, spkNumber, vehiclePlate, status, tenantId',
      localDeliveryOrders: '++id, doNumber, orderId, status, tenantId',
      localLicense: 'id, hardwareId'
    });
  }

  /**
   * Helper internal untuk mengambil active tenantId dari local storage secara aman
   */
  getActiveTenantId(): string | undefined {
    try {
      const raw = localStorage.getItem('pos_user') || localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.tenantId) return String(parsed.tenantId);
      }
    } catch (_) {}
    return undefined;
  }

  // â”€â”€â”€ Catalog Caching Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async saveCatalogToCache(params: {
    products?: CachedProduct[];
    categories?: CachedCategory[];
    tables?: CachedTable[];
    settings?: CachedSetting;
  }) {
    const activeTenantId = params.settings?.tenantId || this.getActiveTenantId();

    return this.transaction('rw', [this.cachedProducts, this.cachedCategories, this.cachedTables, this.cachedSettings], async () => {
      if (params.products && params.products.length > 0) {
        const normalized = params.products.map(p => {
          const val = Number(p.sellPrice ?? p.price ?? 0);
          return {
            ...p,
            tenantId: p.tenantId || activeTenantId,
            price: val,
            sellPrice: val
          };
        });

        // Partisi penghapusan: jika ada activeTenantId, bersihkan hanya katalog tenant bersangkutan
        if (activeTenantId) {
          await this.cachedProducts.where('tenantId').equals(activeTenantId).delete();
        } else {
          await this.cachedProducts.clear();
        }
        await this.cachedProducts.bulkPut(normalized);
      }

      if (params.categories && params.categories.length > 0) {
        const normalizedCats = params.categories.map(c => ({
          ...c,
          tenantId: c.tenantId || activeTenantId
        }));
        if (activeTenantId) {
          await this.cachedCategories.where('tenantId').equals(activeTenantId).delete();
        } else {
          await this.cachedCategories.clear();
        }
        await this.cachedCategories.bulkPut(normalizedCats);
      }

      if (params.tables && params.tables.length > 0) {
        const normalizedTables = params.tables.map(t => ({
          ...t,
          tenantId: t.tenantId || activeTenantId
        }));
        if (activeTenantId) {
          await this.cachedTables.where('tenantId').equals(activeTenantId).delete();
        } else {
          await this.cachedTables.clear();
        }
        await this.cachedTables.bulkPut(normalizedTables);
      }

      if (params.settings) {
        const tenantSettingId = activeTenantId ? `settings_${activeTenantId}` : 'current_settings';
        await this.cachedSettings.put({
          ...params.settings,
          id: tenantSettingId,
          tenantId: params.settings.tenantId || activeTenantId,
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }

  async getCachedProducts(tenantId?: string): Promise<CachedProduct[]> {
    const activeTenantId = tenantId || this.getActiveTenantId();
    if (!activeTenantId) {
      return [];
    }

    const list = await this.cachedProducts.where('tenantId').equals(activeTenantId).toArray();

    return list.map(p => {
      const val = Number(p.sellPrice ?? p.price ?? 0);
      return {
        ...p,
        price: val,
        sellPrice: val
      };
    });
  }

  async getCachedCategories(tenantId?: string): Promise<CachedCategory[]> {
    const activeTenantId = tenantId || this.getActiveTenantId();
    if (!activeTenantId) {
      return [];
    }

    const list = await this.cachedCategories.where('tenantId').equals(activeTenantId).toArray();

    return list.sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  async getCachedTables(tenantId?: string): Promise<CachedTable[]> {
    const activeTenantId = tenantId || this.getActiveTenantId();
    if (!activeTenantId) {
      return [];
    }
    return this.cachedTables.where('tenantId').equals(activeTenantId).toArray();
  }

  async getCachedSettings(tenantId?: string): Promise<CachedSetting | undefined> {
    const activeTenantId = tenantId || this.getActiveTenantId();
    if (!activeTenantId) {
      return undefined;
    }
    const scoped = await this.cachedSettings.where('tenantId').equals(activeTenantId).first();
    if (scoped) return scoped;
    return this.cachedSettings.get(`settings_${activeTenantId}`);
  }

  // â”€â”€â”€ Table & Local Stock Optimistic Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async occupyTableOffline(tableId: number, orderNumber: string) {
    const table = await this.cachedTables.get(tableId);
    if (table) {
      await this.cachedTables.update(tableId, {
        status: 'Terisi',
        offlineOccupied: true,
        offlineOrderNumber: orderNumber,
      });
    }
  }

  async releaseTableOffline(tableId: number) {
    const table = await this.cachedTables.get(tableId);
    if (table) {
      await this.cachedTables.update(tableId, {
        status: 'Kosong',
        offlineOccupied: false,
        offlineOrderNumber: undefined,
      });
    }
  }

  async deductLocalCachedStock(items: { productId: number; quantity: number }[]) {
    for (const item of items) {
      const prod = await this.cachedProducts.get(item.productId);
      if (prod && typeof prod.stock === 'number') {
        const currentStock = prod.stock;
        await this.cachedProducts.update(item.productId, {
          stock: currentStock - item.quantity,
        });
      }
    }
  }

  // â”€â”€â”€ Order Queue Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async queueOfflineOrder(orderData: Omit<PendingOrder, 'id' | 'syncStatus' | 'retryCount'>): Promise<number> {
    const record: PendingOrder = {
      ...orderData,
      syncStatus: 'PENDING',
      retryCount: 0,
    };
    const id = await this.pendingOrders.add(record);
    return id as number;
  }

  async getPendingOrders(tenantId?: string): Promise<PendingOrder[]> {
    const activeTenantId = tenantId || this.getActiveTenantId();
    let query = this.pendingOrders.where('syncStatus').anyOf(['PENDING', 'FAILED']);
    if (activeTenantId) {
      return query.and((o) => !o.tenantId || o.tenantId === activeTenantId).toArray();
    }
    return query.toArray();
  }

  async getAllPendingOrdersCount(tenantId?: string): Promise<number> {
    const activeTenantId = tenantId || this.getActiveTenantId();
    let query = this.pendingOrders.where('syncStatus').anyOf(['PENDING', 'FAILED', 'SYNCING']);
    if (activeTenantId) {
      return query.and((o) => !o.tenantId || o.tenantId === activeTenantId).count();
    }
    return query.count();
  }

  async markOrderSyncing(offlineIds: string[]) {
    await this.pendingOrders
      .where('offlineId')
      .anyOf(offlineIds)
      .modify({ syncStatus: 'SYNCING' });
  }

  async markOrderSynced(offlineId: string) {
    await this.pendingOrders
      .where('offlineId')
      .equals(offlineId)
      .modify({ syncStatus: 'SYNCED' });
  }

  async markOrderFailed(offlineId: string, errorMsg: string) {
    await this.pendingOrders
      .where('offlineId')
      .equals(offlineId)
      .modify((order) => {
        order.syncStatus = 'FAILED';
        order.syncError = errorMsg;
        order.retryCount = (order.retryCount || 0) + 1;
      });
  }

  async clearSyncedOrders(daysToKeep = 3) {
    const threshold = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    return this.pendingOrders
      .where('syncStatus')
      .equals('SYNCED')
      .and((o) => o.clientTimestamp < threshold)
      .delete();
  }

  // â”€â”€â”€ Attendance Queue Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async queueOfflineAttendance(
    attendanceData: Omit<PendingAttendance, 'id' | 'syncStatus' | 'retryCount'>
  ): Promise<number> {
    const record: PendingAttendance = {
      ...attendanceData,
      syncStatus: 'PENDING',
      retryCount: 0,
    };
    const id = await this.pendingAttendances.add(record);
    return id as number;
  }

  async getPendingAttendances(): Promise<PendingAttendance[]> {
    return this.pendingAttendances
      .where('syncStatus')
      .anyOf(['PENDING', 'FAILED'])
      .toArray();
  }

  async getAllPendingAttendancesCount(): Promise<number> {
    return this.pendingAttendances
      .where('syncStatus')
      .anyOf(['PENDING', 'FAILED', 'SYNCING'])
      .count();
  }

  async markAttendanceSynced(offlineId: string) {
    await this.pendingAttendances
      .where('offlineId')
      .equals(offlineId)
      .modify({ syncStatus: 'SYNCED' });
  }

  async markAttendanceFailed(offlineId: string, errorMsg: string) {
    await this.pendingAttendances
      .where('offlineId')
      .equals(offlineId)
      .modify((att) => {
        att.syncStatus = 'FAILED';
        att.syncError = errorMsg;
        att.retryCount = (att.retryCount || 0) + 1;
      });
  }

  // â”€â”€â”€ Sync Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async logSync(entry: Omit<SyncLog, 'id'>) {
    await this.syncLogs.add(entry);
  }

  async getRecentSyncLogs(limit = 20): Promise<SyncLog[]> {
    return this.syncLogs.orderBy('id').reverse().limit(limit).toArray();
  }

  /**
   * Atomic Catalog Purge: Menghapus bersih cache katalog (produk, kategori, meja, pengaturan)
   * tanpa menghapus antrean order/attendance offline yang belum tersinkronisasi.
   */
  async clearCatalogCache(tenantId?: string): Promise<void> {
    const activeTenantId = tenantId;
    await this.transaction('rw', [
      this.cachedProducts,
      this.cachedCategories,
      this.cachedTables,
      this.cachedSettings
    ], async () => {
      if (activeTenantId) {
        await this.cachedProducts.where('tenantId').equals(activeTenantId).delete();
        await this.cachedCategories.where('tenantId').equals(activeTenantId).delete();
        await this.cachedTables.where('tenantId').equals(activeTenantId).delete();
        await this.cachedSettings.where('tenantId').equals(activeTenantId).delete();
        await this.cachedSettings.delete(`settings_${activeTenantId}`);
      } else {
        await this.cachedProducts.clear();
        await this.cachedCategories.clear();
        await this.cachedTables.clear();
        await this.cachedSettings.clear();
      }
    });
  }

  /**
   * Atomic Storage Purge: Menghapus bersih seluruh tabel lokal untuk mencegah kebocoran data saat logout/unpair
   */
  async clearAllCache(): Promise<void> {
    await this.transaction('rw', [
      this.cachedProducts,
      this.cachedCategories,
      this.cachedTables,
      this.cachedSettings,
      this.pendingOrders,
      this.pendingAttendances,
      this.syncLogs
    ], async () => {
      await this.cachedProducts.clear();
      await this.cachedCategories.clear();
      await this.cachedTables.clear();
      await this.cachedSettings.clear();
      await this.pendingOrders.clear();
      await this.pendingAttendances.clear();
      await this.syncLogs.clear();
    });
  }
}

// Export a singleton instance
export const offlineDb = new CodenusaOfflineDatabase();
