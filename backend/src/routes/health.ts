import prisma from '../db';
import { Router, Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { BackupService } from '../services/BackupService';
import { authenticateToken, requireRole, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { isRedisReady } from '../lib/redis';
import { queueManager } from '../queues/queueManager';

const router = Router();

/**
 * Basic Liveness Endpoint (GET /api/health)
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    message: 'Codenusa Multi-Tenant SaaS Backend is running',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

/**
 * Fast Liveness Probe (Used by Load Balancers / Kubernetes / Uptime Monitors)
 */
router.get('/ping', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'codepos-saas-core'
  });
});

/**
 * Deep Readiness & Observability Probe
 * Checks Database latency, memory usage, disk storage, RLS status, and multi-tenant telemetry
 */
router.get('/deep', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let dbHealthy = false;
  let dbLatencyMs = 0;
  let rlsActive = false;
  let tenantCount = 0;
  let outletCount = 0;
  let userCount = 0;
  let orderCount = 0;
  let subscriptionCount = 0;

  try {
    const dbQueryStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbQueryStart;
    dbHealthy = true;

    // Check RLS status on PostgreSQL
    try {
      const rlsCheck: any[] = await prisma.$queryRaw`
        SELECT count(*)::int as count 
        FROM pg_tables 
        WHERE rowsecurity = true AND schemaname = 'public'
      `;
      if (rlsCheck && rlsCheck.length > 0 && rlsCheck[0].count > 0) {
        rlsActive = true;
      }
    } catch {
      rlsActive = false;
    }

    // High-level telemetry
    const [tCount, oCount, uCount, ordCount, subCount] = await Promise.all([
      prisma.tenant.count().catch(() => 0),
      prisma.outlet.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.order.count().catch(() => 0),
      prisma.subscription.count().catch(() => 0)
    ]);

    tenantCount = tCount;
    outletCount = oCount;
    userCount = uCount;
    orderCount = ordCount;
    subscriptionCount = subCount;
  } catch (dbErr) {
    dbHealthy = false;
  }

  // Memory Metrics
  const mem = process.memoryUsage();
  const systemTotalMem = os.totalmem();
  const systemFreeMem = os.freemem();
  const systemUsedMemPercent = Math.round(((systemTotalMem - systemFreeMem) / systemTotalMem) * 100);

  // Storage Metrics for Uploads & Backups
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  let uploadsSize = 0;
  let uploadsFiles = 0;

  function calculateDirSize(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        calculateDirSize(fullPath);
      } else {
        try {
          const stat = fs.statSync(fullPath);
          uploadsSize += stat.size;
          uploadsFiles++;
        } catch (_) {}
      }
    }
  }

  calculateDirSize(uploadsDir);

  // Backups Metrics
  let backupsCount = 0;
  let backupsTotalSize = 0;
  try {
    const backupList = await BackupService.listBackups();
    backupsCount = backupList.length;
    backupsTotalSize = backupList.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);
  } catch (_) {}

  // Socket Connections Count
  let activeSocketClients = 0;
  try {
    const socketIo = (_req.app && typeof _req.app.get === 'function') ? _req.app.get('io') : null;
    if (socketIo && socketIo.sockets) {
      activeSocketClients = socketIo.sockets.sockets.size;
    }
  } catch (_) {}

  // BullMQ Queue Telemetry
  let queueStats: any = {};
  try {
    const [syncStats, waStats, reportStats] = await Promise.all([
      queueManager.getQueueStats('sync-queue'),
      queueManager.getQueueStats('wa-queue'),
      queueManager.getQueueStats('report-queue')
    ]);
    queueStats = {
      syncQueue: syncStats,
      waQueue: waStats,
      reportQueue: reportStats
    };
  } catch (_) {}

  const isHealthy = dbHealthy && dbLatencyMs < 2000;
  const isDegraded = dbHealthy && dbLatencyMs >= 2000;

  const responsePayload = {
    status: isHealthy ? 'healthy' : (isDegraded ? 'degraded' : 'unhealthy'),
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    server: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      pid: process.pid,
      platform: process.platform,
      arch: process.arch
    },
    database: {
      status: dbHealthy ? 'connected' : 'disconnected',
      latencyMs: dbLatencyMs,
      engine: (process.env.DATABASE_URL || '').startsWith('postgres') ? 'PostgreSQL' : 'SQLite',
      rlsEnforced: rlsActive,
      telemetry: {
        tenants: tenantCount,
        outlets: outletCount,
        users: userCount,
        orders: orderCount,
        activeSubscriptions: subscriptionCount
      }
    },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      systemFreeMemMb: Math.round(systemFreeMem / 1024 / 1024),
      systemTotalMemMb: Math.round(systemTotalMem / 1024 / 1024),
      systemMemoryUsedPercent: systemUsedMemPercent
    },
    storage: {
      uploads: {
        fileCount: uploadsFiles,
        sizeMb: Math.round(uploadsSize / 1024 / 1024 * 100) / 100
      },
      backups: {
        totalBackups: backupsCount,
        sizeMb: Math.round(backupsTotalSize / 1024 / 1024 * 100) / 100
      }
    },
    realtime: {
      activeSocketClients,
      socketAdapter: isRedisReady() ? 'RedisAdapter (Cluster Mesh)' : 'InMemoryAdapter (Standalone)'
    },
    redis: {
      status: isRedisReady() ? 'connected' : 'fallback_in_memory',
      adapter: isRedisReady() ? 'RedisAdapter' : 'InMemoryAdapter',
      distributedCache: isRedisReady() ? 'active' : 'local_memory_fallback'
    },
    queues: queueStats
  };

  const httpStatus = isHealthy ? 200 : (isDegraded ? 200 : 503);
  res.status(httpStatus).json(responsePayload);
});

/**
 * GET /api/health/backups - List all backups (Admin only)
 */
router.get('/backups', authenticateToken, requireRole('SUPERADMIN', 'OWNER', 'ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const backups = await BackupService.listBackups();
    res.json({
      success: true,
      total: backups.length,
      backups
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil daftar backup' });
  }
});

/**
 * POST /api/health/backups/create - Create on-demand backup (Admin only)
 */
router.post('/backups/create', authenticateToken, requireRole('SUPERADMIN', 'OWNER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { isEncrypted, compress, type } = req.body;
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;
    const tenantId = isPlatformAdmin ? null : req.user?.tenantId;

    const backup = await BackupService.createBackup({
      tenantId,
      isEncrypted: isEncrypted ?? true,
      compress: compress ?? true,
      type: type || 'json'
    });

    await AuditLogger.log({
      tenantId: tenantId || null,
      action: 'DATABASE_BACKUP',
      resource: 'BACKUP_ENGINE',
      description: `Membuat backup database terenkripsi ${backup.fileName}`,
      severity: 'WARNING'
    }, req);

    res.status(201).json({
      success: true,
      message: 'Backup database berhasil dibuat',
      backup
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat backup database' });
  }
});

/**
 * POST /api/health/backups/purge - Retention Purge (Admin only)
 */
router.post('/backups/purge', authenticateToken, requireRole('SUPERADMIN', 'OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { retentionDays } = req.body;
    const days = parseInt(retentionDays, 10) || 30;

    const result = await BackupService.purgeOldBackups(days);

    await AuditLogger.log({
      tenantId: req.user?.tenantId || null,
      action: 'DATABASE_BACKUP',
      resource: 'BACKUP_ENGINE',
      description: `Menjalankan pembersihan retensi backup (> ${days} hari): ${result.deletedCount} berkas dihapus`,
      severity: 'WARNING'
    }, req);

    res.json({
      success: true,
      message: `Pembersihan retensi selesai. ${result.deletedCount} backup dihapus.`,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membersihkan backup lama' });
  }
});

/**
 * POST /api/health/backups/restore - Disaster Recovery Restore (Superadmin only)
 */
router.post('/backups/restore', authenticateToken, requireRole('SUPERADMIN', 'OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { fileName, targetTenantId } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'Parameter fileName wajib disertakan' });
    }

    const result = await BackupService.restoreBackup(fileName, targetTenantId);

    await AuditLogger.log({
      tenantId: targetTenantId || req.user?.tenantId || null,
      action: 'DATABASE_RESTORE',
      resource: 'BACKUP_ENGINE',
      description: `Melakukan restore disaster recovery dari berkas ${fileName}`,
      severity: 'CRITICAL'
    }, req);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memulihkan database dari backup' });
  }
});

export default router;
