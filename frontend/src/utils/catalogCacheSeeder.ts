import { offlineDb, type CachedProduct, type CachedCategory, type CachedTable, type CachedSetting } from '../db/offlineDb';

const API = import.meta.env.VITE_API_URL || '/api';

/**
 * Fetches latest catalog data from backend and saves it to local IndexedDB.
 * Fails gracefully if device is already offline.
 */
export async function seedLocalCatalogCache(token?: string): Promise<{
  success: boolean;
  productsCount: number;
  categoriesCount: number;
  tablesCount: number;
  error?: string;
}> {
  const authToken = token || localStorage.getItem('pos_token') || localStorage.getItem('token');
  if (!authToken) {
    return { success: false, productsCount: 0, categoriesCount: 0, tablesCount: 0, error: 'No auth token found' };
  }

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const [productsRes, categoriesRes, tablesRes, settingsRes] = await Promise.allSettled([
      fetch(`${API}/products`, { headers }),
      fetch(`${API}/categories`, { headers }),
      fetch(`${API}/tables`, { headers }),
      fetch(`${API}/settings`, { headers }),
    ]);

    let products: CachedProduct[] = [];
    let categories: CachedCategory[] = [];
    let tables: CachedTable[] = [];
    let settings: CachedSetting | undefined = undefined;

    if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
      const data = await productsRes.value.json();
      products = (Array.isArray(data) ? data : []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price || p.sellPrice || 0),
        sellPrice: Number(p.sellPrice || p.price || 0), // alias used by POSView
        cost: Number(p.cost || p.cogs || 0),
        categoryId: p.categoryId,
        categoryName: p.category?.name,
        barcode: p.barcode,
        imageUrl: p.imageUrl,
        trackStock: p.trackStock ?? true,
        stock: Number(p.stock || 0),
        minStock: Number(p.minStock || 0),
        variants: p.variants || [],
        tenantId: p.tenantId,
      }));
    }

    if (categoriesRes.status === 'fulfilled' && categoriesRes.value.ok) {
      const data = await categoriesRes.value.json();
      categories = (Array.isArray(data) ? data : []).map((c: any) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        tenantId: c.tenantId,
      }));
    }

    if (tablesRes.status === 'fulfilled' && tablesRes.value.ok) {
      const data = await tablesRes.value.json();
      tables = (Array.isArray(data) ? data : []).map((t: any) => ({
        id: t.id,
        tableNo: t.tableNo || t.name,
        capacity: Number(t.capacity || 4),
        status: t.status || 'AVAILABLE',
        tenantId: t.tenantId,
      }));
    }

    if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
      const data = await settingsRes.value.json();
      if (data) {
        settings = {
          id: 'current_settings',
          storeName: data.storeName || data.name || 'Codenusa Cafe POS',
          address: data.address,
          phone: data.phone,
          receiptFooter: data.receiptFooter,
          taxPercentage: Number(data.taxPercentage || 0),
          servicePercentage: Number(data.servicePercentage || 0),
          qrisUrl: data.qrisUrl,
          tenantId: data.tenantId,
        };
      }
    }

    // Save to IndexedDB
    if (products.length > 0 || categories.length > 0 || tables.length > 0 || settings) {
      await offlineDb.saveCatalogToCache({
        products: products.length > 0 ? products : undefined,
        categories: categories.length > 0 ? categories : undefined,
        tables: tables.length > 0 ? tables : undefined,
        settings,
      });

      await offlineDb.logSync({
        timestamp: new Date().toISOString(),
        type: 'CATALOG_DOWNLOAD',
        count: products.length,
        status: 'SUCCESS',
        details: `Seeded ${products.length} products, ${categories.length} categories, ${tables.length} tables`,
      });

      return {
        success: true,
        productsCount: products.length,
        categoriesCount: categories.length,
        tablesCount: tables.length,
      };
    }

    return { success: false, productsCount: 0, categoriesCount: 0, tablesCount: 0, error: 'Empty responses' };
  } catch (err: any) {
    console.warn('[OfflineDB] Failed to seed local catalog (likely offline):', err.message);
    return {
      success: false,
      productsCount: 0,
      categoriesCount: 0,
      tablesCount: 0,
      error: err.message,
    };
  }
}
