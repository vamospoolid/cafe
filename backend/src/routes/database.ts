import prisma from '../db';
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { backupService } from '../services/BackupService';

const router = Router();

// GET /api/database/info - Status & ringkasan metrik database
router.get('/info', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');
    const tenantId = req.user?.tenantId;
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;

    // Filter counts based on tenant if not platform admin
    const whereTenant: any = (!isPlatformAdmin && tenantId) ? { tenantId } : {};

    let businessType = 'CAFE';
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessType: true }
      });
      if (tenant?.businessType) businessType = tenant.businessType;
    }

      const [
      userCount, orderCount, productCount, ingredientCount, saleCount,
      workOrderCount, vehicleCount, mechanicCount, partRequestCount,
      supplierInvoiceCount, deliveryOrderCount, productUomCount,
      laundryOrderCount
    ] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.order.count({ where: whereTenant }).catch(() => 0),
      prisma.product.count({ where: whereTenant }).catch(() => 0),
      prisma.ingredient.count({ where: whereTenant }).catch(() => 0),
      prisma.warehouseSale.count({ where: whereTenant }).catch(() => 0),
      prisma.workOrder.count({ where: whereTenant }).catch(() => 0),
      prisma.vehicle.count({ where: whereTenant }).catch(() => 0),
      prisma.mechanicProfile.count({ where: whereTenant }).catch(() => 0),
      prisma.partRequest.count({ where: whereTenant }).catch(() => 0),
      prisma.supplierInvoice.count({ where: whereTenant }).catch(() => 0),
      prisma.deliveryOrder.count({ where: whereTenant }).catch(() => 0),
      prisma.productUOM.count({ where: whereTenant }).catch(() => 0),
      prisma.laundryOrder.count({ where: whereTenant }).catch(() => 0)
    ]);

    res.json({
      engine: isPostgres ? 'PostgreSQL' : 'SQLite',
      status: 'Connected',
      timestamp: new Date().toISOString(),
      isPlatformAdmin,
      businessType,
      counts: {
        users: userCount,
        orders: orderCount,
        products: productCount,
        ingredients: ingredientCount,
        warehouseSales: saleCount,
        workOrders: workOrderCount,
        vehicles: vehicleCount,
        mechanics: mechanicCount,
        partRequests: partRequestCount,
        supplierInvoices: supplierInvoiceCount,
        deliveryOrders: deliveryOrderCount,
        productUoms: productUomCount,
        laundryOrders: laundryOrderCount
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

  let businessType = 'CAFE';
  if (tenantId) {
    const tenantObj = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    if (tenantObj?.businessType) businessType = tenantObj.businessType;
  }

  const [
    categories, products, tables, reservations, customers, pointLogs,
    orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
    ingredients, recipeItems, ingredientLogs, purchaseOrders,
    debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
    // Bengkel vertical entities
    workOrders, workOrderParts, workOrderServices, workOrderInvoices,
    vehicles, serviceTypes, mechanicProfiles, commissionPayouts, partRequests,
    supplierInvoices, supplierInvoiceItems, supplierInvoicePayments,
    // Retail vertical entities
    productUoms, productPriceTiers, deliveryOrders, deliveryOrderItems,
    // Laundry vertical entities
    laundryOrders, laundryOrderItems
  ] = await Promise.all([
    prisma.category.findMany({ where: whereTenant }),
    prisma.product.findMany({ where: whereTenant }),
    prisma.table.findMany({ where: whereTenant }),
    prisma.reservation.findMany({ where: whereTenant }),
    prisma.customer.findMany({ where: whereTenant }),
    prisma.pointLog.findMany({ where: whereTenant }),
    prisma.order.findMany({ where: whereTenant }),
    prisma.orderItem.findMany({
      where: isPlatformAdmin ? {} : {
        OR: [
          { tenantId: tenantId! },
          { order: { tenantId: tenantId! } }
        ]
      }
    }),
    prisma.cashFlow.findMany({ where: whereTenant }),
    prisma.attendance.findMany({ where: whereTenant }),
    prisma.settings.findMany({ where: whereTenant }),
    prisma.shift.findMany({ where: whereTenant }),
    prisma.supplier.findMany({ where: whereTenant }),
    prisma.ingredient.findMany({ where: whereTenant }),
    prisma.recipeItem.findMany({
      where: isPlatformAdmin ? {} : {
        ingredient: { tenantId: tenantId! }
      }
    }),
    prisma.ingredientLog.findMany({ where: whereTenant }),
    prisma.purchaseOrder.findMany({ where: whereTenant }),
    prisma.debt.findMany({ where: whereTenant }),
    prisma.debtPayment.findMany({ where: whereTenant }),
    prisma.leaveRequest.findMany({ where: whereTenant }),
    prisma.shiftHandover.findMany({ where: whereTenant }),
    prisma.kitchenChecklist.findMany({ where: whereTenant }),
    // Bengkel queries
    prisma.workOrder.findMany({ where: whereTenant }),
    prisma.workOrderPart.findMany({ where: whereTenant }),
    prisma.workOrderService.findMany({ where: whereTenant }),
    prisma.workOrderInvoice.findMany({ where: whereTenant }),
    prisma.vehicle.findMany({ where: whereTenant }),
    prisma.serviceType.findMany({ where: whereTenant }),
    prisma.mechanicProfile.findMany({ where: whereTenant }),
    prisma.commissionPayout.findMany({ where: whereTenant }),
    prisma.partRequest.findMany({ where: whereTenant }),
    prisma.supplierInvoice.findMany({ where: whereTenant }),
    prisma.supplierInvoiceItem.findMany({
      where: isPlatformAdmin ? {} : { invoice: { tenantId: tenantId! } }
    }),
    prisma.supplierInvoicePayment.findMany({ where: whereTenant }),
    // Retail queries
    prisma.productUOM.findMany({ where: whereTenant }),
    prisma.productPriceTier.findMany({ where: whereTenant }),
    prisma.deliveryOrder.findMany({ where: whereTenant }),
    prisma.deliveryOrderItem.findMany({
      where: isPlatformAdmin ? {} : { deliveryOrder: { tenantId: tenantId! } }
    }),
    // Laundry queries
    prisma.laundryOrder.findMany({ where: whereTenant }),
    prisma.laundryOrderItem.findMany({
      where: isPlatformAdmin ? {} : { order: { tenantId: tenantId! } }
    })
  ]);

  const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';
  const exportedAt = new Date().toISOString();
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${tenantId || 'platform'}:${exportedAt}`)
    .digest('hex');

  const snapshot = {
    metadata: {
      platform: 'Codenusa Multi-Tenant B2B SaaS POS',
      scope: isPlatformAdmin ? 'PLATFORM_ALL' : `TENANT_${tenantId}`,
      sourceTenantId: tenantId || (isPlatformAdmin ? 'PLATFORM' : null),
      businessType,
      signature,
      exportedAt,
      schemaVersion: '2026.3'
    },
    data: {
      categories, products, tables, reservations, customers, pointLogs,
      orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
      ingredients, recipeItems, ingredientLogs, purchaseOrders,
      debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
      // Bengkel vertical entities
      workOrders, workOrderParts, workOrderServices, workOrderInvoices,
      vehicles, serviceTypes, mechanicProfiles, commissionPayouts, partRequests,
      supplierInvoices, supplierInvoiceItems, supplierInvoicePayments,
      // Retail vertical entities
      productUoms, productPriceTiers, deliveryOrders, deliveryOrderItems,
      // Laundry vertical entities
      laundryOrders, laundryOrderItems
    }
  };

  const jsonContent = JSON.stringify(snapshot, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-codepos-${tenantId || 'platform'}-${timestamp}.json"`);
  return res.send(jsonContent);
}

// ─── Automated Backup & Disaster Recovery Management Endpoints ─────────────

/**
 * GET /api/database/backups - Daftar riwayat backup tersimpan
 */
router.get('/backups', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;
    const tenantId = req.user?.tenantId;

    let backups = backupService.listBackups();

    // Jika bukan platform admin, hanya tampilkan backup milik tenant yang bersangkutan
    if (!isPlatformAdmin) {
      backups = backups.filter(b => b.filename.includes(`tenant-${tenantId}`) || (b.tenantId && b.tenantId === tenantId));
    }

    return res.json({
      success: true,
      count: backups.length,
      backups
    });
  } catch (err: any) {
    console.error('[Database API /backups Error]', err);
    return res.status(500).json({ error: 'Gagal memuat daftar berkas backup' });
  }
});

/**
 * POST /api/database/backup-now - Memicu backup instan
 */
router.post('/backup-now', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;
    const tenantId = req.user?.tenantId;
    const scope = isPlatformAdmin ? 'FULL' : 'TENANT';

    const metadata = await backupService.createDatabaseBackup(scope, tenantId);
    return res.json({
      success: true,
      message: `Pencadangan database (${scope}) berhasil dibuat.`,
      backup: metadata
    });
  } catch (err: any) {
    console.error('[Database API /backup-now Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal memproses backup database' });
  }
});

/**
 * POST /api/database/verify - Verifikasi integritas berkas backup
 */
router.post('/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'filename wajib disertakan' });
    }

    // Path traversal defense
    const safeFilename = path.basename(filename);
    const filepath = path.resolve(process.cwd(), 'backups', 'db', safeFilename);

    const result = backupService.verifyBackupIntegrity(filepath);
    return res.json(result);
  } catch (err: any) {
    console.error('[Database API /verify Error]', err);
    return res.status(500).json({ error: err.message || 'Gagal memverifikasi berkas backup' });
  }
});

/**
 * GET /api/database/download/:filename - Mengunduh berkas backup spesifik
 */
router.get('/download/:filename', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const isPlatformAdmin = req.user?.isPlatformAdmin ?? false;
    const tenantId = req.user?.tenantId;
    const filename = req.params.filename as string;

    // Path traversal defense
    const safeFilename = path.basename(filename);
    const filepath = path.resolve(process.cwd(), 'backups', 'db', safeFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Berkas backup tidak ditemukan' });
    }

    // Tenant authorization check
    if (!isPlatformAdmin && (!tenantId || !safeFilename.includes(tenantId))) {
      return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin mengunduh berkas backup ini' });
    }

    return res.download(filepath, safeFilename);
  } catch (err: any) {
    console.error('[Database API /download Error]', err);
    return res.status(500).json({ error: 'Gagal mengunduh berkas backup' });
  }
});

export default router;
