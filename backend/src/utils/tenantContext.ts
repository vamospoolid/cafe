import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  tenantId: string;
  tenantSlug?: string;
  outletId?: string;
  userId?: number;
  role?: string;
  permissions?: string[];
  isPlatformAdmin?: boolean;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContextData>();

export const TenantContext = {
  /**
   * Run an asynchronous function within a specific Tenant Context
   */
  run<R>(context: TenantContextData, callback: () => R): R {
    return asyncLocalStorage.run(context, callback);
  },

  /**
   * Get the current active Tenant Context from the async execution tree
   */
  get(): TenantContextData | undefined {
    return asyncLocalStorage.getStore();
  },

  /**
   * Get the current active tenantId (or fallback default)
   */
  getTenantId(): string {
    const store = asyncLocalStorage.getStore();
    return store?.tenantId || 'tenant-default-muki';
  },

  /**
   * Get the current active outletId (or fallback default)
   */
  getOutletId(): string | undefined {
    const store = asyncLocalStorage.getStore();
    return store?.outletId;
  },

  /**
   * Check if the current context is a platform super admin
   */
  isPlatformAdmin(): boolean {
    const store = asyncLocalStorage.getStore();
    return store?.isPlatformAdmin === true;
  }
};
