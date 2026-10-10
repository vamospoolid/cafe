import { PrismaClient as PgPrismaClient } from '@prisma/client';

const isStandalone = process.env.STANDALONE_MODE === 'true' || process.env.DATABASE_URL?.startsWith('file:');

// Singleton instance across module reloads and executions
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PgPrismaClient | undefined;
}

function createPrismaInstance(): PgPrismaClient {
  if (isStandalone) {
    try {
      const candidates = [
        './generated/sqlite-client',
        '../src/generated/sqlite-client',
        '../../src/generated/sqlite-client',
        '../generated/sqlite-client'
      ];
      let SQLitePrismaClient: any = null;
      for (const c of candidates) {
        try {
          const mod = require(c);
          SQLitePrismaClient = mod.PrismaClient;
          if (SQLitePrismaClient) break;
        } catch { /* continue */ }
      }

      if (SQLitePrismaClient) {
        console.log('[DB Engine] Menggunakan Prisma SQLite Client Lokal.');
        return new SQLitePrismaClient({
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
        }) as unknown as PgPrismaClient;
      }
    } catch (e: any) {
      console.warn('[DB Engine] Fallback ke standard Prisma Client:', e.message);
    }
  }

  return new PgPrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
}

export const prisma: PgPrismaClient = global.prismaGlobal || createPrismaInstance();

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export default prisma;
