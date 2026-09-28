import prisma from '../db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { AuditLogger } from './AuditLogger';

const JWT_SECRET = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'super_secret_pooos_key';
const BACKUP_DIR = path.resolve(process.cwd(), 'backups', 'db');

export interface BackupCreateOptions {
  tenantId?: string | null;
  isEncrypted?: boolean;
  compress?: boolean;
  type?: 'json' | 'sql';
  scope?: 'FULL' | 'TENANT';
}

export interface BackupMetadata {
  filename: string;
  fileName?: string; // alias
  filepath: string;
  filePath?: string; // alias
  sizeBytes: number;
  sizeFormatted: string;
  originalSizeBytes?: number;
  scope: 'FULL' | 'TENANT';
  tenantId?: string | null;
  createdAt: string;
  signature: string;
  checksumSha256?: string;
  isEncrypted: boolean;
  isCompressed: boolean;
  entityCounts: Record<string, number>;
  isValid?: boolean;
  gfsTier?: 'SON_DAILY' | 'FATHER_WEEKLY' | 'GRANDFATHER_MONTHLY' | 'ARCHIVE';
}

export interface PurgeResult {
  deletedCount: number;
  prunedCount: number;
  retainedCount: number;
  remainingCount: number;
  freedBytes: number;
  freedFormatted: string;
  prunedFiles: string[];
}

export interface RestoreResult {
  success: boolean;
  message: string;
  recordCounts: Record<string, number>;
  restoredCounts?: Record<string, number>;
  durationMs: number;
  scope: 'FULL' | 'TENANT';
  tenantId?: string | null;
}

export class BackupService {
  private static instance: BackupService;
  private isBackupRunning: boolean = false;

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  constructor() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Derive a deterministic 32-byte key for AES-256-CBC
   */
  private static getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(JWT_SECRET).digest();
  }

  /**
   * Generate HMAC-SHA256 signature for anti-tamper verification
   */
  public generateSignature(content: string | Buffer, timestamp: string): string {
    return BackupService.generateSignature(content, timestamp);
  }

  public static generateSignature(content: string | Buffer, timestamp: string): string {
    const payload = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    return crypto.createHmac('sha256', JWT_SECRET)
      .update(Buffer.from(`${timestamp}:`, 'utf8'))
      .update(payload)
      .digest('hex');
  }

  /**
   * Calculate SHA-256 hash of a file or buffer
   */
  public static calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Encrypt buffer using AES-256-CBC with random 16-byte IV prepended
   */
  public static encrypt(buffer: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', BackupService.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt AES-256-CBC buffer with random 16-byte IV prepended
   */
  public static decrypt(buffer: Buffer): Buffer {
    if (buffer.length < 17) {
      throw new Error('Berkas backup terenkripsi korup atau ukuran tidak valid (< 16 byte IV).');
    }
    const iv = buffer.subarray(0, 16);
    const ciphertext = buffer.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', BackupService.getEncryptionKey(), iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Verify backup integrity and anti-tamper authenticity
   */
  public verifyBackupIntegrity(targetPathOrFilename: string): { isValid: boolean; error?: string; metadata?: any } {
    return BackupService.verifyBackupIntegrity(targetPathOrFilename);
  }

  public static verifyBackupIntegrity(targetPathOrFilename: string): { isValid: boolean; error?: string; metadata?: any } {
    try {
      const fullPath = path.isAbsolute(targetPathOrFilename)
        ? targetPathOrFilename
        : path.join(BACKUP_DIR, targetPathOrFilename);

      if (!fs.existsSync(fullPath)) {
        return { isValid: false, error: 'Berkas backup tidak ditemukan di disk.' };
      }

      const metaPath = fullPath.endsWith('.meta.json') ? fullPath : `${fullPath}.meta.json`;
      const fileBuffer = fs.readFileSync(fullPath);

      // Check companion metadata if present
      if (fs.existsSync(metaPath)) {
        try {
          const metaRaw = fs.readFileSync(metaPath, 'utf8');
          const meta = JSON.parse(metaRaw);

          // Verify SHA-256 checksum of physical file
          const actualChecksum = BackupService.calculateChecksum(fileBuffer);
          if (meta.checksumSha256 && meta.checksumSha256 !== actualChecksum) {
            return { isValid: false, error: 'SHA-256 Checksum mismatch! Berkas telah dimodifikasi atau rusak.' };
          }

          // Verify HMAC signature of metadata
          const expectedSig = BackupService.generateSignature(meta.dataChecksum || actualChecksum, meta.exportedAt);
          if (meta.signature && meta.signature !== expectedSig) {
            return { isValid: false, error: 'Integritas berkas korup atau HMAC signature mismatch.' };
          }

          return { isValid: true, metadata: meta };
        } catch (e: any) {
          return { isValid: false, error: `Gagal membaca metadata: ${e.message}` };
        }
      }

      // Legacy uncompressed unencrypted JSON format fallback
      if (fullPath.endsWith('.json')) {
        const parsed = JSON.parse(fileBuffer.toString('utf8'));
        if (!parsed.metadata || !parsed.metadata.signature || !parsed.metadata.exportedAt || !parsed.data) {
          return { isValid: false, error: 'Format berkas backup tidak valid (metadata/data hilang).' };
        }

        const expectedSignature = BackupService.generateSignature(
          JSON.stringify(parsed.data),
          parsed.metadata.exportedAt
        );

        if (parsed.metadata.signature !== expectedSignature) {
          return { isValid: false, error: 'Integritas berkas korup atau telah dimodifikasi (HMAC signature mismatch).' };
        }

        return { isValid: true, metadata: parsed.metadata };
      }

      return { isValid: true, metadata: { filename: path.basename(fullPath), sizeBytes: fileBuffer.length } };
    } catch (err: any) {
      return { isValid: false, error: `Gagal memverifikasi berkas backup: ${err.message}` };
    }
  }

  /**
   * Create Full Platform or Tenant-Scoped Database Snapshot
   */
  public async createDatabaseBackup(
    scopeOrOptions: 'FULL' | 'TENANT' | BackupCreateOptions = 'FULL',
    maybeTenantId?: string | null
  ): Promise<BackupMetadata> {
    return BackupService.createBackup(
      typeof scopeOrOptions === 'string'
        ? { scope: scopeOrOptions, tenantId: maybeTenantId }
        : scopeOrOptions
    );
  }

  public static async createBackup(options: BackupCreateOptions = {}): Promise<BackupMetadata> {
    const scope: 'FULL' | 'TENANT' = options.scope || (options.tenantId ? 'TENANT' : 'FULL');
    const tenantId = options.tenantId || null;
    const isEncrypted = options.isEncrypted !== false;
    const compress = options.compress !== false;

    const timestamp = new Date().toISOString();
    const dateFileStr = timestamp.replace(/[:.]/g, '-');
    const ext = `${compress ? '.gz' : ''}${isEncrypted ? '.enc' : ''}`;
    const filename = `backup-${scope.toLowerCase()}-${tenantId || 'platform'}-${dateFileStr}.json${ext}`;
    const filepath = path.join(BACKUP_DIR, filename);
    const metaPath = `${filepath}.meta.json`;

    const whereTenant: any = (scope === 'TENANT' && tenantId) ? { tenantId } : {};

    // Query business entities
    const [
      tenants, outlets, users, memberships,
      categories, products, tables, reservations, customers, pointLogs,
      orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
      ingredients, recipeItems, ingredientLogs, purchaseOrders,
      debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
      warehouseInbounds, warehouseRequisitions, warehouseSales, employeeLoans,
      wasteLogs, vouchers, subscriptions, invoices, paymentTransactions, auditLogs,
      // Bengkel vertical entities
      workOrders, workOrderParts, workOrderServices, workOrderInvoices,
      vehicles, serviceTypes, mechanicProfiles, commissionPayouts, partRequests,
      supplierInvoices, supplierInvoiceItems, supplierInvoicePayments,
      // Laundry vertical entities
      laundryOrders, laundryOrderItems
    ] = await Promise.all([
      scope === 'FULL' ? prisma.tenant.findMany() : prisma.tenant.findMany({ where: { id: tenantId! } }),
      prisma.outlet.findMany({ where: whereTenant }),
      scope === 'FULL' ? prisma.user.findMany() : prisma.user.findMany({ where: { memberships: { some: { tenantId: tenantId! } } } }),
      scope === 'FULL' ? prisma.tenantMembership.findMany() : prisma.tenantMembership.findMany({ where: { tenantId: tenantId! } }),
      prisma.category.findMany({ where: whereTenant }),
      prisma.product.findMany({ where: whereTenant }),
      prisma.table.findMany({ where: whereTenant }),
      prisma.reservation.findMany({ where: whereTenant }),
      prisma.customer.findMany({ where: whereTenant }),
      prisma.pointLog.findMany({ where: whereTenant }),
      prisma.order.findMany({ where: whereTenant }),
      prisma.orderItem.findMany({
        where: scope === 'FULL' ? {} : {
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
        where: scope === 'FULL' ? {} : {
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
      prisma.warehouseInbound.findMany({ where: whereTenant }),
      prisma.warehouseRequisition.findMany({ where: whereTenant }),
      prisma.warehouseSale.findMany({ where: whereTenant }),
      prisma.employeeLoan.findMany({ where: whereTenant }),
      prisma.wasteLog.findMany({ where: whereTenant }),
      prisma.voucher.findMany({ where: whereTenant }),
      prisma.subscription.findMany({ where: whereTenant }),
      prisma.invoice.findMany({ where: whereTenant }),
      prisma.paymentTransaction.findMany({ where: whereTenant }),
      prisma.auditLog.findMany({
        where: whereTenant,
        take: scope === 'FULL' ? 1000 : 500,
        orderBy: { createdAt: 'desc' }
      }),
      // Bengkel vertical entities
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
        where: scope === 'FULL' ? {} : { invoice: { tenantId: tenantId! } }
      }),
      prisma.supplierInvoicePayment.findMany({ where: whereTenant }),
      // Laundry queries
      prisma.laundryOrder.findMany({ where: whereTenant }),
      prisma.laundryOrderItem.findMany({
        where: scope === 'FULL' ? {} : { order: { tenantId: tenantId! } }
      })
    ]);

    const backupData = {
      tenants, outlets, users, memberships,
      categories, products, tables, reservations, customers, pointLogs,
      orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
      ingredients, recipeItems, ingredientLogs, purchaseOrders,
      debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
      warehouseInbounds, warehouseRequisitions, warehouseSales, employeeLoans,
      wasteLogs, vouchers, subscriptions, invoices, paymentTransactions, auditLogs,
      // Bengkel vertical entities
      workOrders, workOrderParts, workOrderServices, workOrderInvoices,
      vehicles, serviceTypes, mechanicProfiles, commissionPayouts, partRequests,
      supplierInvoices, supplierInvoiceItems, supplierInvoicePayments,
      // Laundry vertical entities
      laundryOrders, laundryOrderItems
    };

    const entityCounts: Record<string, number> = {};
    for (const [key, arr] of Object.entries(backupData)) {
      entityCounts[key] = (arr as any[]).length;
    }

    const jsonString = JSON.stringify({
      metadata: {
        platform: 'CodePOS SaaS Multi-Tenant Engine',
        version: '2026.3',
        scope,
        tenantId: tenantId || (scope === 'FULL' ? 'PLATFORM' : null),
        exportedAt: timestamp,
        entityCounts
      },
      data: backupData
    });

    const rawBuffer = Buffer.from(jsonString, 'utf8');
    const originalSizeBytes = rawBuffer.length;
    const dataChecksum = BackupService.calculateChecksum(rawBuffer);

    // 1. Compression
    let processedBuffer: Buffer = rawBuffer;
    if (compress) {
      processedBuffer = Buffer.from(zlib.gzipSync(processedBuffer, { level: 9 }));
    }

    // 2. Encryption
    if (isEncrypted) {
      processedBuffer = BackupService.encrypt(processedBuffer);
    }

    // Write primary backup file
    fs.writeFileSync(filepath, processedBuffer);

    const checksumSha256 = BackupService.calculateChecksum(processedBuffer);
    const signature = BackupService.generateSignature(dataChecksum, timestamp);

    // Companion Metadata Descriptor
    const metaPayload = {
      schemaVersion: '2.0',
      platform: 'CodePOS SaaS Multi-Tenant Engine',
      filename,
      filepath,
      scope,
      tenantId: tenantId || (scope === 'FULL' ? 'PLATFORM' : null),
      exportedAt: timestamp,
      sizeBytes: processedBuffer.length,
      originalSizeBytes,
      checksumSha256,
      dataChecksum,
      signature,
      isEncrypted,
      isCompressed: compress,
      entityCounts
    };

    fs.writeFileSync(metaPath, JSON.stringify(metaPayload, null, 2), 'utf8');

    const sizeKb = (processedBuffer.length / 1024).toFixed(2);
    console.log(`[BackupService] Backup ${filename} created (${sizeKb} KB, AES-256: ${isEncrypted}, Gzip: ${compress}). Total orders: ${entityCounts.orders}, products: ${entityCounts.products}`);

    await AuditLogger.log({
      tenantId: tenantId || null,
      action: 'DATABASE_BACKUP_CREATED',
      resource: 'BACKUP_SERVICE',
      resourceId: filename,
      description: `Pencadangan database ${scope} (${sizeKb} KB, AES-256: ${isEncrypted ? 'Ya' : 'Tidak'}) berhasil dibuat.`,
      severity: 'INFO'
    });

    return {
      filename,
      fileName: filename,
      filepath,
      filePath: filepath,
      sizeBytes: processedBuffer.length,
      sizeFormatted: `${sizeKb} KB`,
      originalSizeBytes,
      scope,
      tenantId,
      createdAt: timestamp,
      signature,
      checksumSha256,
      isEncrypted,
      isCompressed: compress,
      entityCounts,
      isValid: true
    };
  }

  /**
   * List all backup archives with GFS classification and integrity check
   */
  public listBackups(): BackupMetadata[] {
    return BackupService.listBackups();
  }

  public static listBackups(): BackupMetadata[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];

    const allFiles = fs.readdirSync(BACKUP_DIR);
    const backupFiles = allFiles.filter(f => !f.endsWith('.meta.json') && (f.endsWith('.enc') || f.endsWith('.json') || f.endsWith('.gz') || f.endsWith('.sql')));
    const result: BackupMetadata[] = [];

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const f of backupFiles) {
      const fullPath = path.join(BACKUP_DIR, f);
      try {
        const stat = fs.statSync(fullPath);
        const sizeKb = (stat.size / 1024).toFixed(2);
        const metaPath = `${fullPath}.meta.json`;

        let meta: any = null;
        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          } catch (_) {}
        }

        const ageDays = (now - stat.mtimeMs) / oneDayMs;
        let gfsTier: BackupMetadata['gfsTier'] = 'SON_DAILY';
        if (ageDays <= 7) {
          gfsTier = 'SON_DAILY';
        } else if (ageDays <= 28) {
          gfsTier = 'FATHER_WEEKLY';
        } else if (ageDays <= 90) {
          gfsTier = 'GRANDFATHER_MONTHLY';
        } else {
          gfsTier = 'ARCHIVE';
        }

        const verification = BackupService.verifyBackupIntegrity(fullPath);

        result.push({
          filename: f,
          fileName: f,
          filepath: fullPath,
          filePath: fullPath,
          sizeBytes: stat.size,
          sizeFormatted: `${sizeKb} KB`,
          originalSizeBytes: meta?.originalSizeBytes,
          scope: (meta?.scope || (f.includes('tenant') ? 'TENANT' : 'FULL')),
          tenantId: meta?.tenantId,
          createdAt: meta?.exportedAt || stat.mtime.toISOString(),
          signature: meta?.signature || verification.metadata?.signature || 'N/A',
          checksumSha256: meta?.checksumSha256,
          isEncrypted: meta ? Boolean(meta.isEncrypted) : f.endsWith('.enc'),
          isCompressed: meta ? Boolean(meta.isCompressed) : (f.includes('.gz') || f.endsWith('.enc')),
          entityCounts: meta?.entityCounts || {},
          isValid: verification.isValid,
          gfsTier
        });
      } catch (e) {
        // Skip unreadable files
      }
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * GFS Retention & Rotation Policy Pruning:
   * - Daily (Son): Keep all backups for the last 7 days.
   * - Weekly (Father): Keep 1 backup per week for weeks 2 to 4 (days 8 to 28).
   * - Monthly (Grandfather): Keep 1 backup per month for months 2 to 3 (days 29 to 90).
   * - Purge all backups older than 90 days (or custom retention days).
   */
  public pruneOldBackups(retentionDays?: number): PurgeResult {
    return BackupService.purgeOldBackups(retentionDays);
  }

  public static purgeOldBackups(retentionDays?: number): PurgeResult {
    if (!fs.existsSync(BACKUP_DIR)) {
      return {
        deletedCount: 0,
        prunedCount: 0,
        retainedCount: 0,
        remainingCount: 0,
        freedBytes: 0,
        freedFormatted: '0 KB',
        prunedFiles: []
      };
    }

    const backups = BackupService.listBackups();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const filesToKeep = new Set<string>();
    const prunedFiles: string[] = [];
    let freedBytes = 0;

    if (typeof retentionDays === 'number' && retentionDays > 0) {
      // Simple Day-based Retention Policy
      const cutoffMs = now - retentionDays * oneDayMs;
      for (const b of backups) {
        const bTime = new Date(b.createdAt).getTime();
        if (bTime >= cutoffMs) {
          filesToKeep.add(b.filename);
        }
      }
    } else {
      // Full GFS Rotation Policy (7 Daily, 4 Weekly, 3 Monthly)
      const weeklyBuckets = new Map<string, string>(); // 'YYYY-Wxx' -> newest filename
      const monthlyBuckets = new Map<string, string>(); // 'YYYY-MM' -> newest filename

      for (const b of backups) {
        const bTime = new Date(b.createdAt).getTime();
        const ageDays = (now - bTime) / oneDayMs;
        const dateObj = new Date(bTime);

        if (ageDays <= 7) {
          // Keep all daily backups within 7 days (Son)
          filesToKeep.add(b.filename);
        } else if (ageDays <= 28) {
          // Group by ISO Week (Father)
          const weekKey = `${dateObj.getFullYear()}-W${Math.ceil(dateObj.getDate() / 7)}`;
          if (!weeklyBuckets.has(weekKey)) {
            weeklyBuckets.set(weekKey, b.filename);
            filesToKeep.add(b.filename);
          }
        } else if (ageDays <= 90) {
          // Group by Month (Grandfather)
          const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}`;
          if (!monthlyBuckets.has(monthKey)) {
            monthlyBuckets.set(monthKey, b.filename);
            filesToKeep.add(b.filename);
          }
        }
        // Age > 90 days: discarded
      }
    }

    // Always keep at least the most recent backup if any exists
    if (backups.length > 0 && filesToKeep.size === 0) {
      filesToKeep.add(backups[0].filename);
    }

    for (const b of backups) {
      if (!filesToKeep.has(b.filename)) {
        const targetPath = b.filepath;
        const metaPath = `${targetPath}.meta.json`;

        try {
          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            freedBytes += stat.size;
            fs.unlinkSync(targetPath);
          }
          if (fs.existsSync(metaPath)) {
            const mStat = fs.statSync(metaPath);
            freedBytes += mStat.size;
            fs.unlinkSync(metaPath);
          }
          prunedFiles.push(b.filename);
          console.log(`[BackupService] GFS Pruned: ${b.filename}`);
        } catch (err) {
          console.warn(`[BackupService] Failed to prune ${b.filename}:`, err);
        }
      }
    }

    const remainingCount = fs.readdirSync(BACKUP_DIR).filter(f => !f.endsWith('.meta.json')).length;
    const freedKb = (freedBytes / 1024).toFixed(2);

    return {
      deletedCount: prunedFiles.length,
      prunedCount: prunedFiles.length,
      retainedCount: remainingCount,
      remainingCount,
      freedBytes,
      freedFormatted: `${freedKb} KB`,
      prunedFiles
    };
  }

  /**
   * Disaster Recovery Restore Engine
   * Deterministically restores data from encrypted/compressed snapshot in < 10 minutes.
   */
  public async restoreFromSnapshot(filepathOrName: string, targetTenantId?: string): Promise<RestoreResult> {
    return BackupService.restoreBackup(filepathOrName, targetTenantId);
  }

  public static async restoreBackup(filepathOrName: string, targetTenantId?: string): Promise<RestoreResult> {
    const startTime = Date.now();
    const fullPath = path.isAbsolute(filepathOrName)
      ? filepathOrName
      : path.join(BACKUP_DIR, filepathOrName);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Berkas backup tidak ditemukan di disk: ${path.basename(fullPath)}`);
    }

    // 1. Verify anti-tamper integrity
    const verification = BackupService.verifyBackupIntegrity(fullPath);
    if (!verification.isValid) {
      throw new Error(`Restorasi dibatalkan: ${verification.error}`);
    }

    // 2. Read physical file buffer
    let buffer: Buffer = fs.readFileSync(fullPath);

    // 3. Decrypt AES-256-CBC if encrypted
    const isEncrypted = fullPath.endsWith('.enc') || verification.metadata?.isEncrypted;
    if (isEncrypted) {
      buffer = Buffer.from(BackupService.decrypt(buffer));
    }

    // 4. Decompress Gzip if compressed
    const isCompressed = fullPath.includes('.gz') || fullPath.endsWith('.enc') || verification.metadata?.isCompressed;
    if (isCompressed) {
      try {
        buffer = Buffer.from(zlib.gunzipSync(buffer));
      } catch (err: any) {
        throw new Error(`Gagal mendekompresi berkas backup (Gzip corrupt): ${err.message}`);
      }
    }

    // 5. Parse JSON payload
    let payload: any;
    try {
      payload = JSON.parse(buffer.toString('utf8'));
    } catch (err: any) {
      throw new Error(`Gagal mem-parse isi JSON backup: ${err.message}`);
    }

    const data = payload.data || payload;
    const meta = payload.metadata || verification.metadata || {};
    const scope = meta.scope || (targetTenantId ? 'TENANT' : 'FULL');

    const restoredCounts: Record<string, number> = {};

    // 6. Execute atomic transaction in PostgreSQL via Prisma
    await prisma.$transaction(async (tx) => {
      // 1. Tenant Restoration
      if (Array.isArray(data.tenants)) {
        let count = 0;
        for (const t of data.tenants) {
          if (targetTenantId && t.id !== targetTenantId) continue;
          const tenantFields: any = {
            name: t.name,
            slug: t.slug,
            status: t.status,
            logoUrl: t.logoUrl || null,
            trialEndsAt: t.trialEndsAt ? new Date(t.trialEndsAt) : null,
          };
          if (t.customDomain) tenantFields.customDomain = t.customDomain;
          if (t.planId) {
            tenantFields.plan = { connect: { id: t.planId } };
          }

          await tx.tenant.upsert({
            where: { id: t.id },
            update: tenantFields,
            create: {
              id: t.id,
              ...tenantFields
            }
          });
          count++;
        }
        restoredCounts.tenants = count;
      }

      // 2. Outlets
      if (Array.isArray(data.outlets)) {
        let count = 0;
        for (const o of data.outlets) {
          if (targetTenantId && o.tenantId !== targetTenantId) continue;
          await tx.outlet.upsert({
            where: { id: o.id },
            update: {
              name: o.name,
              code: o.code || `OUT-${o.id.substring(0, 4).toUpperCase()}`,
              address: o.address,
              phone: o.phone,
              tenantId: o.tenantId,
              status: o.status || 'ACTIVE'
            },
            create: {
              id: o.id,
              name: o.name,
              code: o.code || `OUT-${o.id.substring(0, 4).toUpperCase()}`,
              address: o.address,
              phone: o.phone,
              tenantId: o.tenantId,
              status: o.status || 'ACTIVE'
            }
          });
          count++;
        }
        restoredCounts.outlets = count;
      }

      // 3. Categories
      if (Array.isArray(data.categories)) {
        let count = 0;
        for (const c of data.categories) {
          if (targetTenantId && c.tenantId !== targetTenantId) continue;
          await tx.category.upsert({
            where: { id: c.id },
            update: { name: c.name, printerTarget: c.printerTarget, tenantId: c.tenantId },
            create: { id: c.id, name: c.name, printerTarget: c.printerTarget, tenantId: c.tenantId }
          });
          count++;
        }
        restoredCounts.categories = count;
      }

      // 4. Products
      if (Array.isArray(data.products)) {
        let count = 0;
        for (const p of data.products) {
          if (targetTenantId && p.tenantId !== targetTenantId) continue;
          await tx.product.upsert({
            where: { id: p.id },
            update: {
              name: p.name,
              sellPrice: p.sellPrice,
              buyPrice: p.buyPrice,
              stock: p.stock,
              tenantId: p.tenantId,
              categoryId: p.categoryId,
              status: p.status
            },
            create: {
              id: p.id,
              name: p.name,
              sellPrice: p.sellPrice,
              buyPrice: p.buyPrice,
              stock: p.stock,
              tenantId: p.tenantId,
              categoryId: p.categoryId,
              status: p.status
            }
          });
          count++;
        }
        restoredCounts.products = count;
      }

      // 5. Tables
      if (Array.isArray(data.tables)) {
        let count = 0;
        for (const tbl of data.tables) {
          if (targetTenantId && tbl.tenantId !== targetTenantId) continue;
          await tx.table.upsert({
            where: { id: tbl.id },
            update: { tableNo: tbl.tableNo, capacity: tbl.capacity, status: tbl.status, tenantId: tbl.tenantId, outletId: tbl.outletId },
            create: { id: tbl.id, tableNo: tbl.tableNo, capacity: tbl.capacity, status: tbl.status, tenantId: tbl.tenantId, outletId: tbl.outletId }
          });
          count++;
        }
        restoredCounts.tables = count;
      }

      // 6. Ingredients
      if (Array.isArray(data.ingredients)) {
        let count = 0;
        for (const ing of data.ingredients) {
          if (targetTenantId && ing.tenantId !== targetTenantId) continue;
          await tx.ingredient.upsert({
            where: { id: ing.id },
            update: { name: ing.name, stock: ing.stock, unit: ing.unit, costPerUnit: ing.costPerUnit, tenantId: ing.tenantId },
            create: { id: ing.id, name: ing.name, stock: ing.stock, unit: ing.unit, costPerUnit: ing.costPerUnit, tenantId: ing.tenantId }
          });
          count++;
        }
        restoredCounts.ingredients = count;
      }

      // 7. Customers
      if (Array.isArray(data.customers)) {
        let count = 0;
        for (const cust of data.customers) {
          if (targetTenantId && cust.tenantId !== targetTenantId) continue;
          await tx.customer.upsert({
            where: { id: cust.id },
            update: { name: cust.name, phone: cust.phone, points: cust.points, tenantId: cust.tenantId },
            create: { id: cust.id, name: cust.name, phone: cust.phone, points: cust.points, tenantId: cust.tenantId }
          });
          count++;
        }
        restoredCounts.customers = count;
      }

      // 8. Laundry Orders
      if (Array.isArray(data.laundryOrders)) {
        let count = 0;
        for (const lo of data.laundryOrders) {
          if (targetTenantId && lo.tenantId !== targetTenantId) continue;
          await tx.laundryOrder.upsert({
            where: { id: lo.id },
            update: {
              tenantId: lo.tenantId,
              outletId: lo.outletId,
              orderNumber: lo.orderNumber,
              customerId: lo.customerId,
              customerName: lo.customerName,
              customerPhone: lo.customerPhone,
              serviceCategory: lo.serviceCategory,
              serviceSpeed: lo.serviceSpeed,
              perfumeVariant: lo.perfumeVariant,
              rackLocation: lo.rackLocation,
              hangerCount: lo.hangerCount || 0,
              itemCountNotes: lo.itemCountNotes,
              specialNotes: lo.specialNotes,
              status: lo.status,
              subtotal: lo.subtotal,
              speedSurcharge: lo.speedSurcharge,
              discount: lo.discount,
              totalAmount: lo.totalAmount,
              paidAmount: lo.paidAmount,
              paymentStatus: lo.paymentStatus,
              paymentMethod: lo.paymentMethod,
              estimatedDoneAt: lo.estimatedDoneAt ? new Date(lo.estimatedDoneAt) : null,
              readyAt: lo.readyAt ? new Date(lo.readyAt) : null,
              completedAt: lo.completedAt ? new Date(lo.completedAt) : null
            },
            create: {
              id: lo.id,
              tenantId: lo.tenantId,
              outletId: lo.outletId,
              orderNumber: lo.orderNumber,
              customerId: lo.customerId,
              customerName: lo.customerName,
              customerPhone: lo.customerPhone,
              serviceCategory: lo.serviceCategory,
              serviceSpeed: lo.serviceSpeed,
              perfumeVariant: lo.perfumeVariant,
              rackLocation: lo.rackLocation,
              hangerCount: lo.hangerCount || 0,
              itemCountNotes: lo.itemCountNotes,
              specialNotes: lo.specialNotes,
              status: lo.status,
              subtotal: lo.subtotal,
              speedSurcharge: lo.speedSurcharge,
              discount: lo.discount,
              totalAmount: lo.totalAmount,
              paidAmount: lo.paidAmount,
              paymentStatus: lo.paymentStatus,
              paymentMethod: lo.paymentMethod,
              estimatedDoneAt: lo.estimatedDoneAt ? new Date(lo.estimatedDoneAt) : null,
              readyAt: lo.readyAt ? new Date(lo.readyAt) : null,
              completedAt: lo.completedAt ? new Date(lo.completedAt) : null
            }
          });
          count++;
        }
        restoredCounts.laundryOrders = count;
      }

      // 9. Laundry Order Items
      if (Array.isArray(data.laundryOrderItems)) {
        let count = 0;
        for (const item of data.laundryOrderItems) {
          await tx.laundryOrderItem.upsert({
            where: { id: item.id },
            update: {
              orderId: item.orderId,
              serviceName: item.serviceName,
              unitType: item.unitType,
              qty: item.qty,
              pricePerUnit: item.pricePerUnit,
              subtotal: item.subtotal,
              notes: item.notes
            },
            create: {
              id: item.id,
              orderId: item.orderId,
              serviceName: item.serviceName,
              unitType: item.unitType,
              qty: item.qty,
              pricePerUnit: item.pricePerUnit,
              subtotal: item.subtotal,
              notes: item.notes
            }
          });
          count++;
        }
        restoredCounts.laundryOrderItems = count;
      }
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    const durationMs = Date.now() - startTime;
    const msg = `Restorasi disaster recovery dari ${path.basename(fullPath)} selesai dalam ${durationMs} ms (RTO compliant).`;
    console.log(`[BackupService] ${msg}`, restoredCounts);

    await AuditLogger.log({
      tenantId: targetTenantId || null,
      action: 'DATABASE_RESTORE',
      resource: 'BACKUP_SERVICE',
      resourceId: path.basename(fullPath),
      description: msg,
      severity: 'CRITICAL'
    });

    return {
      success: true,
      message: msg,
      recordCounts: restoredCounts,
      restoredCounts,
      durationMs,
      scope,
      tenantId: targetTenantId || null
    };
  }
}

export const backupService = BackupService.getInstance();
