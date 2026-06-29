// Database offline POS Cafe berbasis IndexedDB murni (tanpa dependensi luar)

const DB_NAME = 'poscafe_offline_db';
const DB_VERSION = 1;

export interface OfflineOrder {
  offlineId: string;
  customerName: string;
  customerPhone?: string;
  customerId?: number | null;
  tableId?: number | null;
  items: Array<{
    productId: number;
    qty: number;
    price: number;
    notes?: string;
  }>;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  total: number;
  pointsUsed?: number;
  paymentMethod: string;
  isPaid: boolean;
  createdAt: string;
  paidAt?: string | null;
}

class OfflineDB {
  private db: IDBDatabase | null = null;

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        
        // Buat store jika belum ada
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' }); // id = 'current'
        }
        if (!db.objectStoreNames.contains('offlineQueue')) {
          db.createObjectStore('offlineQueue', { keyPath: 'offlineId' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = (event: any) => {
        reject(event.target.error || new Error('Gagal membuka IndexedDB'));
      };
    });
  }

  // --- Generic store handlers ---
  private async getStoreData<T>(storeName: string): Promise<T[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveStoreData<T>(storeName: string, items: T[], clearFirst = true): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      if (clearFirst) {
        store.clear();
      }

      items.forEach(item => {
        store.put(item);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // --- Products ---
  public async getProducts(): Promise<any[]> {
    return this.getStoreData<any>('products');
  }

  public async saveProducts(products: any[]): Promise<void> {
    return this.saveStoreData<any>('products', products);
  }

  // --- Categories ---
  public async getCategories(): Promise<any[]> {
    return this.getStoreData<any>('categories');
  }

  public async saveCategories(categories: any[]): Promise<void> {
    return this.saveStoreData<any>('categories', categories);
  }

  // --- Settings ---
  public async getSettings(): Promise<any | null> {
    const data = await this.getStoreData<any>('settings');
    return data.length > 0 ? data[0] : null;
  }

  public async saveSettings(settings: any): Promise<void> {
    // Pastikan settings memiliki keyPath 'id'
    const payload = { ...settings, id: 'current' };
    return this.saveStoreData<any>('settings', [payload]);
  }

  // --- Offline Order Queue ---
  public async getOfflineQueue(): Promise<OfflineOrder[]> {
    return this.getStoreData<OfflineOrder>('offlineQueue');
  }

  public async addOfflineOrder(order: OfflineOrder): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offlineQueue', 'readwrite');
      const store = transaction.objectStore('offlineQueue');
      const request = store.put(order);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async removeOfflineOrder(offlineId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offlineQueue', 'readwrite');
      const store = transaction.objectStore('offlineQueue');
      const request = store.delete(offlineId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async clearOfflineQueue(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offlineQueue', 'readwrite');
      const store = transaction.objectStore('offlineQueue');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineDB = new OfflineDB();
