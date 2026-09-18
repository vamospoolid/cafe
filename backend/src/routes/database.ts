import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();

// GET /api/database/info - Status & ringkasan metrik database
router.get('/info', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');
    const tenantId = req.user?.tenantId;
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;

    // Filter counts based on tenant if not platform admin
    const whereTenant: any = (!isPlatformAdmin && tenantId) ? { tenantId } : {};

    const [userCount, orderCount, productCount, ingredientCount, saleCount] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.order.count({ where: whereTenant }).catch(() => 0),
      prisma.product.count({ where: whereTenant }).catch(() => 0),
      prisma.ingredient.count({ where: whereTenant }).catch(() => 0),
      prisma.warehouseSale.count({ where: whereTenant }).catch(() => 0),
    ]);

    res.json({
      engine: isPostgres ? 'PostgreSQL' : 'SQLite',
      status: 'Connected',
      timestamp: new Date().toISOString(),
      isPlatformAdmin,
      counts: {
        users: userCount,
        orders: orderCount,
        products: productCount,
        ingredients: ingredientCount,
        warehouseSales: saleCount
      }
    });
  } catch (error: any) {
    console.error('Gagal mengambil info database:', error);
    res.status(500).json({ error: 'Gagal mengambil informasi database' });
  }
});

// GET /api/database/backup - Safe Database Backup (Parametric stream & Tenant Isolation)
router.get('/backup', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;
    const tenantId = req.user?.tenantId;

    // Audit Log: Database Backup Request
    await AuditLogger.log({
      tenantId: tenantId || null,
      action: 'DATABASE_BACKUP',
      resource: 'SETTINGS',
      description: `Mengunduh berkas backup data ${isPlatformAdmin ? '(Full Platform)' : `(Tenant: ${tenantId})`}.`,
      severity: 'WARNING'
    }, req);

    // 1. Jika Platform Admin & PostgreSQL: Jalankan safe pg_dump via spawn (Safe Parametric Stream, NO raw shell exec)
    if (isPlatformAdmin && isPostgres) {
      try {
        const parsedUrl = new URL(dbUrl);
        const host = parsedUrl.hostname || 'localhost';
        const port = parsedUrl.port || '5432';
        const user = parsedUrl.username || 'postgres';
        const password = parsedUrl.password || '';
        const dbName = parsedUrl.pathname.replace(/^\//, '') || 'poscafe_db';

        const dumpArgs = [
          '-h', host,
          '-p', port,
          '-U', user,
          '-d', dbName,
          '--clean',
          '--if-exists'
        ];

        const tempDumpPath = path.join(process.cwd(), `temp_backup_${Date.now()}.sql`);
        const fileStream = fs.createWriteStream(tempDumpPath);

        const pgDumpProcess = spawn('pg_dump', dumpArgs, {
          env: { ...process.env, PGPASSWORD: password }
        });

        pgDumpProcess.stdout.pipe(fileStream);

        pgDumpProcess.on('error', (_spawnErr) => {
          // Fallback ke Prisma JSON export jika pg_dump binary tidak ditemukan di PATH
          fileStream.close();
          try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
          exportPrismaJsonBackup(res, timestamp, isPlatformAdmin, tenantId);
        });

        pgDumpProcess.on('close', (code) => {
          fileStream.close();
          if (code === 0 && fs.existsSync(tempDumpPath) && fs.statSync(tempDumpPath).size > 100) {
            return res.download(tempDumpPath, `codepos-backup-full-${timestamp}.sql`, () => {
              try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
            });
          } else {
            try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
            exportPrismaJsonBackup(res, timestamp, isPlatformAdmin, tenantId);
          }
        });

        return;
      } catch (dumpErr) {
        console.warn('[Backup] Safe pg_dump failed, falling back to structured JSON snapshot:', dumpErr);
      }
    }

    // 2. Default & Tenant-Scoped Backup: Ekspor komprehensif seluruh tabel via Prisma Structured JSON Snapshot
    await exportPrismaJsonBackup(res, timestamp, isPlatformAdmin, tenantId);

  } catch (error: any) {
    console.error('Terjadi kesalahan sistem saat backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Terjadi kesalahan sistem saat memproses backup data' });
    }
  }
});

/**
 * Structured Tenant-Aware / Platform JSON Snapshot
 */
async function exportPrismaJsonBackup(
  res: Response, 
  timestamp: string, 
  isPlatformAdmin: boolean, 
  tenantId?: string | null
) {
  const whereTenant: any = (!isPlatformAdmin && tenantId) ? { tenantId } : {};

  const [
    categories, products, tables, reservations, customers, pointLogs,
    orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
    ingredients, recipeItems, ingredientLogs, purchaseOrders,
    debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists
  ] = await Promise.all([
    prisma.category.findMany({ where: whereTenant }),
    prisma.product.findMany({ where: whereTenant }),
    prisma.table.findMany({ where: whereTenant }),
    prisma.reservation.findMany({ where: whereTenant }),
    prisma.customer.findMany({ where: whereTenant }),
    prisma.pointLog.findMany({ where: whereTenant }),
    prisma.order.findMany({ where: whereTenant }),
    prisma.orderItem.findMany(),
    prisma.cashFlow.findMany({ where: whereTenant }),
    prisma.attendance.findMany({ where: whereTenant }),
    prisma.settings.findMany({ where: whereTenant }),
    prisma.shift.findMany({ where: whereTenant }),
    prisma.supplier.findMany({ where: whereTenant }),
    prisma.ingredient.findMany({ where: whereTenant }),
    prisma.recipeItem.findMany(),
    prisma.ingredientLog.findMany({ where: whereTenant }),
    prisma.purchaseOrder.findMany({ where: whereTenant }),
    prisma.debt.findMany({ where: whereTenant }),
    prisma.debtPayment.findMany({ where: whereTenant }),
    prisma.leaveRequest.findMany({ where: whereTenant }),
    prisma.shiftHandover.findMany({ where: whereTenant }),
    prisma.kitchenChecklist.findMany({ where: whereTenant })
  ]);

  const snapshot = {
    metadata: {
      platform: 'Codenusa Multi-Tenant B2B SaaS POS',
      scope: isPlatformAdmin ? 'PLATFORM_ALL' : `TENANT_${tenantId}`,
      exportedAt: new Date().toISOString(),
      schemaVersion: '2026.2'
    },
    data: {
      categories, products, tables, reservations, customers, pointLogs,
      orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
      ingredients, recipeItems, ingredientLogs, purchaseOrders,
      debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists
    }
  };

  const jsonContent = JSON.stringify(snapshot, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-codepos-${tenantId || 'platform'}-${timestamp}.json"`);
  return res.send(jsonContent);
}

export default router;
