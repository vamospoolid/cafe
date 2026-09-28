import Redis, { RedisOptions } from 'ioredis';

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const commonRedisOptions: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  connectTimeout: 3000,
  retryStrategy(times) {
    if (!REDIS_ENABLED) return null;
    // Exponential backoff up to 10 seconds
    const delay = Math.min(times * 1000, 10000);
    return delay;
  },
  reconnectOnError(_err) {
    return true;
  }
};

let redisClientInstance: Redis | null = null;
let pubClientInstance: Redis | null = null;
let subClientInstance: Redis | null = null;
let redisReady = false;
let initAttempted = false;

function createClient(role: string): Redis {
  const client = new Redis(REDIS_URL, commonRedisOptions);

  client.on('connect', () => {
    // Connected to socket
  });

  client.on('ready', () => {
    redisReady = true;
    console.log(`[Redis] Connection ready for [${role}] on ${REDIS_URL.replace(/:\/\/[^@]*@/, '://***@')}`);
  });

  client.on('error', (err: any) => {
    // Graceful error logging - do not crash process
    if (!redisReady && !initAttempted) {
      // Still in startup probe
    } else {
      console.warn(`[Redis Warn] [${role}] connection issue: ${err.message || err.code || err}`);
    }
  });

  client.on('close', () => {
    // If all connections close, mark not ready
    if (role === 'main') {
      redisReady = false;
    }
  });

  return client;
}

/**
 * Initialize Redis clients and test connectivity gracefully.
 * Will not throw or crash if Redis is unavailable.
 */
export async function initRedis(): Promise<{ ready: boolean; latencyMs: number }> {
  initAttempted = true;
  if (!REDIS_ENABLED) {
    console.log('[Redis] REDIS_ENABLED=false: Menjalankan sistem dengan In-Memory Local Cache & Standalone Socket.IO');
    redisReady = false;
    return { ready: false, latencyMs: -1 };
  }

  try {
    if (!redisClientInstance || !pubClientInstance || !subClientInstance) {
      redisClientInstance = createClient('main');
      pubClientInstance = createClient('socket-pub');
      subClientInstance = createClient('socket-sub');
    }

    const mainClient = redisClientInstance;
    const pubClient = pubClientInstance;
    const subClient = subClientInstance;

    const start = Date.now();
    await Promise.all([
      mainClient.connect().catch((e) => { throw e; }),
      pubClient.connect().catch((e) => { throw e; }),
      subClient.connect().catch((e) => { throw e; })
    ]);

    await mainClient.ping();
    const latencyMs = Date.now() - start;
    redisReady = true;
    console.log(`[Redis] Terhubung sukses ke Redis cluster/server (Latency: ${latencyMs}ms)`);
    return { ready: true, latencyMs };
  } catch (err: any) {
    redisReady = false;
    // Disconnect client loop to prevent continuous reconnect chatter when Redis is not installed locally
    try {
      redisClientInstance?.disconnect();
      pubClientInstance?.disconnect();
      subClientInstance?.disconnect();
      redisClientInstance = null;
      pubClientInstance = null;
      subClientInstance = null;
    } catch (_e) {}

    console.log(`[Redis Notice] Redis server tidak aktif di host lokal (${err.code || err.message}).`);
    console.log(`[Redis Notice] Sistem otomatis beralih ke Graceful In-Memory Fallback (Tanpa downtime / crash).`);
    return { ready: false, latencyMs: -1 };
  }
}

/**
 * Check if Redis is actively connected and ready for queries
 */
export function isRedisReady(): boolean {
  return redisReady && redisClientInstance !== null && redisClientInstance.status === 'ready';
}

/**
 * Get primary Redis client for key-value caching
 */
export function getRedisClient(): Redis | null {
  return redisClientInstance;
}

/**
 * Get dedicated Redis publisher client for Socket.IO
 */
export function getPubClient(): Redis | null {
  return pubClientInstance;
}

/**
 * Get dedicated Redis subscriber client for Socket.IO
 */
export function getSubClient(): Redis | null {
  return subClientInstance;
}

/**
 * Disconnect all Redis clients gracefully during server shutdown
 */
export async function closeRedis(): Promise<void> {
  const clients = [redisClientInstance, pubClientInstance, subClientInstance].filter(Boolean) as Redis[];
  await Promise.all(
    clients.map(async (client) => {
      try {
        if (client.status === 'ready' || client.status === 'connecting') {
          await client.quit();
        }
      } catch (_e) {
        client.disconnect();
      }
    })
  );
  redisReady = false;
  console.log('[Redis] Seluruh koneksi Redis berhasil ditutup dengan rapi.');
}

/**
 * Get Redis connection options specifically formatted for BullMQ
 * BullMQ requires maxRetriesPerRequest: null
 */
export function getBullMQConnectionOptions(): RedisOptions {
  return {
    ...commonRedisOptions,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export function getRedisUrl(): string {
  return REDIS_URL;
}
