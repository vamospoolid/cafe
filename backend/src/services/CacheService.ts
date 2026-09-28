import { getRedisClient, isRedisReady } from '../lib/redis';

interface MemoryCacheEntry {
  val: any;
  expiry: number; // timestamp in ms
}

class CacheService {
  private static instance: CacheService;
  // In-memory fallback storage with TTL
  private memoryCache = new Map<string, MemoryCacheEntry>();

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get parsed value from cache (Redis or In-Memory fallback)
   */
  public async get<T>(key: string): Promise<T | null> {
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (client) {
          const raw = await client.get(key);
          if (raw !== null) {
            return JSON.parse(raw) as T;
          }
          return null;
        }
      } catch (err: any) {
        console.warn(`[CacheService get error on key "${key}"]:`, err.message);
      }
    }

    // In-memory fallback
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (entry.expiry > Date.now()) {
        return entry.val as T;
      }
      this.memoryCache.delete(key);
    }
    return null;
  }

  /**
   * Set value in cache with optional TTL in seconds
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const stringified = JSON.stringify(value);

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (client) {
          if (ttlSeconds > 0) {
            await client.set(key, stringified, 'EX', ttlSeconds);
          } else {
            await client.set(key, stringified);
          }
          return;
        }
      } catch (err: any) {
        console.warn(`[CacheService set error on key "${key}"]:`, err.message);
      }
    }

    // In-memory fallback
    this.memoryCache.set(key, {
      val: value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  /**
   * Delete a specific key from cache
   */
  public async del(key: string): Promise<void> {
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (client) {
          await client.del(key);
        }
      } catch (err: any) {
        console.warn(`[CacheService del error on key "${key}"]:`, err.message);
      }
    }

    this.memoryCache.delete(key);
  }

  /**
   * Cache-Aside Helper: Read from cache, or invoke fetcher and cache the result.
   */
  public async remember<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetcher();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  /**
   * Get current catalog version for a specific tenant (default 1)
   */
  public async getTenantCatalogVersion(tenantId: string): Promise<number> {
    const verKey = `cache:catalog_ver:${tenantId}`;
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (client) {
          const val = await client.get(verKey);
          if (val) return parseInt(val, 10) || 1;
        }
      } catch (_e) {}
    }

    const mem = this.memoryCache.get(verKey);
    if (mem && mem.expiry > Date.now()) {
      return (mem.val as number) || 1;
    }
    return 1;
  }

  /**
   * Bump tenant catalog version by 1.
   * Instantly invalidates all cached catalog variants for this specific tenant without scanning KEYS.
   */
  public async bumpTenantCatalogVersion(tenantId: string): Promise<number> {
    if (!tenantId) return 1;
    const verKey = `cache:catalog_ver:${tenantId}`;

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (client) {
          const newVer = await client.incr(verKey);
          // Set TTL 7 days on the version key to keep it clean
          await client.expire(verKey, 7 * 24 * 3600);
          console.log(`[CacheService] Bumped catalog version for tenant ${tenantId} to v${newVer}`);
          return newVer;
        }
      } catch (err: any) {
        console.warn(`[CacheService bumpTenantCatalogVersion error]:`, err.message);
      }
    }

    const current = (this.memoryCache.get(verKey)?.val as number) || 1;
    const nextVer = current + 1;
    this.memoryCache.set(verKey, {
      val: nextVer,
      expiry: Date.now() + 7 * 24 * 3600 * 1000
    });
    return nextVer;
  }

  /**
   * Invalidate tenant context (slug, id, domain) and feature overrides.
   * Scoped strictly to the target tenantId.
   */
  public async invalidateTenant(tenantId: string, slug?: string, customDomain?: string): Promise<void> {
    const keysToDelete: string[] = [
      `cache:tenant:id:${tenantId}`,
      `cache:features:${tenantId}`
    ];
    if (slug) keysToDelete.push(`cache:tenant:slug:${slug}`);
    if (customDomain) keysToDelete.push(`cache:tenant:domain:${customDomain}`);

    for (const k of keysToDelete) {
      await this.del(k);
    }

    // Also clear memory entries that match tenantId
    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.includes(tenantId) || (slug && key.includes(slug))) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries (emergency / test reset)
   */
  public async clearAll(): Promise<void> {
    this.memoryCache.clear();
    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        if (client) {
          // Flush only keys starting with cache:
          const stream = client.scanStream({ match: 'cache:*', count: 100 });
          stream.on('data', async (keys: string[]) => {
            if (keys.length > 0) {
              const pipeline = client.pipeline();
              keys.forEach((k) => pipeline.del(k));
              await pipeline.exec();
            }
          });
        }
      } catch (_e) {}
    }
  }
}

export const cacheService = CacheService.getInstance();
