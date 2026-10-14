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
      // Retail vertical entities
      productUoms, productPriceTiers, deliveryOrders, deliveryOrderItems,
      // Laundry vertical entities
      laundryOrders, laundryOrderItems,
      // WhatsApp CRM entities
      whatsAppConfigs, whatsAppTemplates, whatsAppLogs
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
      // Retail vertical entities
      prisma.productUOM.findMany({ where: whereTenant }),
      prisma.productPriceTier.findMany({ where: whereTenant }),
      prisma.deliveryOrder.findMany({ where: whereTenant }),
      prisma.deliveryOrderItem.findMany({
        where: scope === 'FULL' ? {} : { deliveryOrder: { tenantId: tenantId! } }
      }),
      // Laundry queries
      prisma.laundryOrder.findMany({ where: whereTenant }),
      prisma.laundryOrderItem.findMany({
        where: scope === 'FULL' ? {} : { order: { tenantId: tenantId! } }
      }),
      // WhatsApp CRM entities
      prisma.tenantWhatsAppConfig.findMany({ where: whereTenant }),
      prisma.whatsAppTemplate.findMany({ where: whereTenant }),
      prisma.whatsAppLog.findMany({ where: whereTenant })
    ]);

    const targetBusinessType = (tenants && tenants[0]?.businessType) || 'CAFE';

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
      // Retail vertical entities
      productUoms, productPriceTiers, deliveryOrders, deliveryOrderItems,
      // Laundry vertical entities
      laundryOrders, laundryOrderItems,
      // WhatsApp CRM entities
      whatsAppConfigs, whatsAppTemplates, whatsAppLogs
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
        businessType: targetBusinessType,
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

      // 2b. Users & Memberships
      if (Array.isArray(data.users)) {
        let count = 0;
        for (const u of data.users) {
          if (targetTenantId) {
            const hasMembership = Array.isArray(data.memberships) && data.memberships.some((m: any) => m.userId === u.id && m.tenantId === targetTenantId);
            if (!hasMembership && u.tenantId !== targetTenantId) continue;
          }
          await tx.user.upsert({
            where: { id: u.id },
            update: {
              name: u.name,
              username: u.username,
              pin: u.pin || '123456',
              role: u.role || 'Kasir',
              employmentType: u.employmentType || 'FULL_TIME',
              permissions: typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions || {}),
              status: u.status || 'Aktif',
              isPlatformAdmin: Boolean(u.isPlatformAdmin),
              tenantId: u.tenantId
            },
            create: {
              id: u.id,
              name: u.name,
              username: u.username,
              passwordHash: u.passwordHash || '$2a$10$Defaulthashedpasswordplaceholder',
              pin: u.pin || '123456',
              role: u.role || 'Kasir',
              employmentType: u.employmentType || 'FULL_TIME',
              permissions: typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions || {}),
              status: u.status || 'Aktif',
              isPlatformAdmin: Boolean(u.isPlatformAdmin),
              tenantId: u.tenantId
            }
          });
          count++;
        }
        restoredCounts.users = count;
      }

      const defaultUser = await tx.user.findFirst({
        where: targetTenantId ? {
          OR: [
            { tenantId: targetTenantId },
            { memberships: { some: { tenantId: targetTenantId } } }
          ]
        } : {}
      });
      const fallbackUserId = defaultUser?.id || 1;

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
              sellPrice: Number(p.sellPrice) || 0,
              buyPrice: Number(p.buyPrice) || 0,
              stock: Number(p.stock) || 0,
              tenantId: p.tenantId,
              categoryId: p.categoryId,
              status: p.status || 'Aktif',
              imageUrl: p.imageUrl || null
            },
            create: {
              id: p.id,
              name: p.name,
              sellPrice: Number(p.sellPrice) || 0,
              buyPrice: Number(p.buyPrice) || 0,
              stock: Number(p.stock) || 0,
              tenantId: p.tenantId,
              categoryId: p.categoryId,
              status: p.status || 'Aktif',
              imageUrl: p.imageUrl || null
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

      // 5b. Suppliers
      if (Array.isArray(data.suppliers)) {
        let count = 0;
        for (const sup of data.suppliers) {
          if (targetTenantId && sup.tenantId !== targetTenantId) continue;
          await tx.supplier.upsert({
            where: { id: sup.id },
            update: {
              name: sup.name,
              contact: sup.contact || null,
              phone: sup.phone || null,
              email: sup.email || null,
              address: sup.address || null,
              notes: sup.notes || null,
              tenantId: sup.tenantId
            },
            create: {
              id: sup.id,
              name: sup.name,
              contact: sup.contact || null,
              phone: sup.phone || null,
              email: sup.email || null,
              address: sup.address || null,
              notes: sup.notes || null,
              tenantId: sup.tenantId
            }
          });
          count++;
        }
        restoredCounts.suppliers = count;
      }

      // 6. Ingredients
      if (Array.isArray(data.ingredients)) {
        let count = 0;
        for (const ing of data.ingredients) {
          if (targetTenantId && ing.tenantId !== targetTenantId) continue;
          await tx.ingredient.upsert({
            where: { id: ing.id },
            update: {
              name: ing.name,
              category: ing.category || 'FOOD',
              subCategory: ing.subCategory || null,
              unit: ing.unit || 'gram',
              stock: Number(ing.stock) || 0,
              minStock: Number(ing.minStock) || 0,
              buyPrice: Number(ing.buyPrice || ing.costPerUnit) || 0,
              tenantId: ing.tenantId,
              supplierId: ing.supplierId || null
            },
            create: {
              id: ing.id,
              name: ing.name,
              category: ing.category || 'FOOD',
              subCategory: ing.subCategory || null,
              unit: ing.unit || 'gram',
              stock: Number(ing.stock) || 0,
              minStock: Number(ing.minStock) || 0,
              buyPrice: Number(ing.buyPrice || ing.costPerUnit) || 0,
              tenantId: ing.tenantId,
              supplierId: ing.supplierId || null
            }
          });
          count++;
        }
        restoredCounts.ingredients = count;
      }

      // 6b. Recipe Items (Relink Products with Ingredients)
      if (Array.isArray(data.recipeItems)) {
        let count = 0;
        for (const r of data.recipeItems) {
          const prodExists = await tx.product.findUnique({ where: { id: r.productId } });
          const ingExists = await tx.ingredient.findUnique({ where: { id: r.ingredientId } });
          if (prodExists && ingExists) {
            await tx.recipeItem.upsert({
              where: {
                productId_ingredientId: {
                  productId: r.productId,
                  ingredientId: r.ingredientId
                }
              },
              update: {
                qtyPerServing: Number(r.qtyPerServing) || 1,
                tenantId: r.tenantId || prodExists.tenantId
              },
              create: {
                productId: r.productId,
                ingredientId: r.ingredientId,
                qtyPerServing: Number(r.qtyPerServing) || 1,
                tenantId: r.tenantId || prodExists.tenantId
              }
            });
            count++;
          }
        }
        restoredCounts.recipeItems = count;
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

      // 7b. Orders (Full Transaction History)
      if (Array.isArray(data.orders)) {
        let count = 0;
        for (const ord of data.orders) {
          if (targetTenantId && ord.tenantId !== targetTenantId) continue;
          const assignedUserId = ord.userId || fallbackUserId;
          const userExists = await tx.user.findUnique({ where: { id: assignedUserId } });
          const safeUserId = userExists ? assignedUserId : fallbackUserId;

          await tx.order.upsert({
            where: { id: ord.id },
            update: {
              tenantId: ord.tenantId,
              outletId: ord.outletId,
              orderNumber: ord.orderNumber,
              offlineId: ord.offlineId || null,
              customerName: ord.customerName || 'Pelanggan',
              customerPhone: ord.customerPhone || null,
              customerId: ord.customerId || null,
              tableId: ord.tableId || null,
              joinedTableIds: ord.joinedTableIds || null,
              userId: safeUserId,
              subtotal: Number(ord.subtotal) || 0,
              discount: Number(ord.discount) || 0,
              tax: Number(ord.tax) || 0,
              serviceCharge: Number(ord.serviceCharge) || 0,
              total: Number(ord.total) || 0,
              paymentMethod: ord.paymentMethod || 'Cash',
              status: ord.status || 'Paid',
              kdsStatus: ord.kdsStatus || 'Served',
              servedAt: ord.servedAt ? new Date(ord.servedAt) : null,
              paidAt: ord.paidAt ? new Date(ord.paidAt) : null,
              createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date()
            },
            create: {
              id: ord.id,
              tenantId: ord.tenantId,
              outletId: ord.outletId,
              orderNumber: ord.orderNumber,
              offlineId: ord.offlineId || null,
              customerName: ord.customerName || 'Pelanggan',
              customerPhone: ord.customerPhone || null,
              customerId: ord.customerId || null,
              tableId: ord.tableId || null,
              joinedTableIds: ord.joinedTableIds || null,
              userId: safeUserId,
              subtotal: Number(ord.subtotal) || 0,
              discount: Number(ord.discount) || 0,
              tax: Number(ord.tax) || 0,
              serviceCharge: Number(ord.serviceCharge) || 0,
              total: Number(ord.total) || 0,
              paymentMethod: ord.paymentMethod || 'Cash',
              status: ord.status || 'Paid',
              kdsStatus: ord.kdsStatus || 'Served',
              servedAt: ord.servedAt ? new Date(ord.servedAt) : null,
              paidAt: ord.paidAt ? new Date(ord.paidAt) : null,
              createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date()
            }
          });
          count++;
        }
        restoredCounts.orders = count;
      }

      // 7c. Order Items
      if (Array.isArray(data.orderItems)) {
        let count = 0;
        for (const item of data.orderItems) {
          const ordExists = await tx.order.findUnique({ where: { id: item.orderId } });
          const prodExists = await tx.product.findUnique({ where: { id: item.productId } });
          if (ordExists && prodExists) {
            await tx.orderItem.upsert({
              where: { id: item.id },
              update: {
                tenantId: item.tenantId || ordExists.tenantId,
                outletId: item.outletId || ordExists.outletId,
                orderId: item.orderId,
                productId: item.productId,
                qty: Number(item.qty) || 1,
                price: Number(item.price) || 0,
                buyPrice: Number(item.buyPrice) || 0,
                subtotal: Number(item.subtotal) || 0,
                notes: item.notes || null,
                uomName: item.uomName || null,
                uomRatio: item.uomRatio ? Number(item.uomRatio) : null,
                priceTierName: item.priceTierName || null
              },
              create: {
                id: item.id,
                tenantId: item.tenantId || ordExists.tenantId,
                outletId: item.outletId || ordExists.outletId,
                orderId: item.orderId,
                productId: item.productId,
                qty: Number(item.qty) || 1,
                price: Number(item.price) || 0,
                buyPrice: Number(item.buyPrice) || 0,
                subtotal: Number(item.subtotal) || 0,
                notes: item.notes || null,
                uomName: item.uomName || null,
                uomRatio: item.uomRatio ? Number(item.uomRatio) : null,
                priceTierName: item.priceTierName || null
              }
            });
            count++;
          }
        }
        restoredCounts.orderItems = count;
      }

      // 7d. Cash Flows
      if (Array.isArray(data.cashFlows)) {
        let count = 0;
        for (const cf of data.cashFlows) {
          if (targetTenantId && cf.tenantId !== targetTenantId) continue;
          const assignedUserId = cf.userId || fallbackUserId;
          const userExists = await tx.user.findUnique({ where: { id: assignedUserId } });
          const safeUserId = userExists ? assignedUserId : fallbackUserId;

          await tx.cashFlow.upsert({
            where: { id: cf.id },
            update: {
              tenantId: cf.tenantId,
              outletId: cf.outletId,
              type: cf.type || 'Pemasukan',
              category: cf.category || 'Operasional',
              amount: Number(cf.amount) || 0,
              description: cf.description || '-',
              userId: safeUserId,
              date: cf.date ? new Date(cf.date) : new Date(),
              cashPocket: cf.cashPocket || 'KAS_OPERASIONAL',
              status: cf.status || 'APPROVED'
            },
            create: {
              id: cf.id,
              tenantId: cf.tenantId,
              outletId: cf.outletId,
              type: cf.type || 'Pemasukan',
              category: cf.category || 'Operasional',
              amount: Number(cf.amount) || 0,
              description: cf.description || '-',
              userId: safeUserId,
              date: cf.date ? new Date(cf.date) : new Date(),
              cashPocket: cf.cashPocket || 'KAS_OPERASIONAL',
              status: cf.status || 'APPROVED'
            }
          });
          count++;
        }
        restoredCounts.cashFlows = count;
      }

      // 7e. Shifts
      if (Array.isArray(data.shifts)) {
        let count = 0;
        for (const sh of data.shifts) {
          if (targetTenantId && sh.tenantId !== targetTenantId) continue;
          const assignedUserId = sh.userId || fallbackUserId;
          const userExists = await tx.user.findUnique({ where: { id: assignedUserId } });
          const safeUserId = userExists ? assignedUserId : fallbackUserId;

          await tx.shift.upsert({
            where: { id: sh.id },
            update: {
              tenantId: sh.tenantId,
              outletId: sh.outletId,
              userId: safeUserId,
              waktuBuka: sh.waktuBuka ? new Date(sh.waktuBuka) : new Date(),
              waktuTutup: sh.waktuTutup ? new Date(sh.waktuTutup) : null,
              saldoAwal: Number(sh.saldoAwal) || 0,
              saldoSistem: sh.saldoSistem ? Number(sh.saldoSistem) : null,
              saldoElektronik: sh.saldoElektronik ? Number(sh.saldoElektronik) : null,
              saldoFisikLaci: sh.saldoFisikLaci ? Number(sh.saldoFisikLaci) : null,
              selisih: sh.selisih ? Number(sh.selisih) : null,
              status: sh.status || 'Closed'
            },
            create: {
              id: sh.id,
              tenantId: sh.tenantId,
              outletId: sh.outletId,
              userId: safeUserId,
              waktuBuka: sh.waktuBuka ? new Date(sh.waktuBuka) : new Date(),
              waktuTutup: sh.waktuTutup ? new Date(sh.waktuTutup) : null,
              saldoAwal: Number(sh.saldoAwal) || 0,
              saldoSistem: sh.saldoSistem ? Number(sh.saldoSistem) : null,
              saldoElektronik: sh.saldoElektronik ? Number(sh.saldoElektronik) : null,
              saldoFisikLaci: sh.saldoFisikLaci ? Number(sh.saldoFisikLaci) : null,
              selisih: sh.selisih ? Number(sh.selisih) : null,
              status: sh.status || 'Closed'
            }
          });
          count++;
        }
        restoredCounts.shifts = count;
      }

      // 7f. Attendances
      if (Array.isArray(data.attendances)) {
        let count = 0;
        for (const att of data.attendances) {
          if (targetTenantId && att.tenantId !== targetTenantId) continue;
          const assignedUserId = att.userId || fallbackUserId;
          const userExists = await tx.user.findUnique({ where: { id: assignedUserId } });
          const safeUserId = userExists ? assignedUserId : fallbackUserId;

          await tx.attendance.upsert({
            where: { id: att.id },
            update: {
              tenantId: att.tenantId,
              outletId: att.outletId,
              userId: safeUserId,
              clockIn: att.clockIn ? new Date(att.clockIn) : new Date(),
              clockOut: att.clockOut ? new Date(att.clockOut) : null,
              date: att.date || new Date().toISOString().slice(0, 10),
              status: att.status || 'Hadir'
            },
            create: {
              id: att.id,
              tenantId: att.tenantId,
              outletId: att.outletId,
              userId: safeUserId,
              clockIn: att.clockIn ? new Date(att.clockIn) : new Date(),
              clockOut: att.clockOut ? new Date(att.clockOut) : null,
              date: att.date || new Date().toISOString().slice(0, 10),
              status: att.status || 'Hadir'
            }
          });
          count++;
        }
        restoredCounts.attendances = count;
      }

      // 7g. Settings
      if (Array.isArray(data.settings)) {
        let count = 0;
        for (const set of data.settings) {
          if (targetTenantId && set.tenantId !== targetTenantId) continue;
          await tx.settings.upsert({
            where: { id: set.id },
            update: {
              tenantId: set.tenantId,
              storeName: set.storeName,
              address: set.address || set.storeAddress || '',
              phone: set.phone || set.storePhone || '',
              taxRate: Number(set.taxRate) || 0,
              serviceCharge: Number(set.serviceCharge || set.serviceRate) || 0,
              receiptFooter: set.receiptFooter || ''
            },
            create: {
              id: set.id,
              tenantId: set.tenantId,
              storeName: set.storeName,
              address: set.address || set.storeAddress || '',
              phone: set.phone || set.storePhone || '',
              taxRate: Number(set.taxRate) || 0,
              serviceCharge: Number(set.serviceCharge || set.serviceRate) || 0,
              receiptFooter: set.receiptFooter || ''
            }
          });
          count++;
        }
        restoredCounts.settings = count;
      }

      // 7h. Bengkel Vertical (Vehicles, ServiceTypes, MechanicProfiles, WorkOrders)
      if (Array.isArray(data.vehicles)) {
        let count = 0;
        for (const v of data.vehicles) {
          if (targetTenantId && v.tenantId !== targetTenantId) continue;
          await tx.vehicle.upsert({
            where: { id: v.id },
            update: {
              tenantId: v.tenantId,
              plateNumber: v.plateNumber,
              brand: v.brand,
              model: v.model,
              year: v.year ? Number(v.year) : null,
              color: v.color || null,
              notes: v.notes || null,
              customerId: v.customerId || null
            },
            create: {
              id: v.id,
              tenantId: v.tenantId,
              plateNumber: v.plateNumber,
              brand: v.brand,
              model: v.model,
              year: v.year ? Number(v.year) : null,
              color: v.color || null,
              notes: v.notes || null,
              customerId: v.customerId || null
            }
          });
          count++;
        }
        restoredCounts.vehicles = count;
      }

      if (Array.isArray(data.serviceTypes)) {
        let count = 0;
        for (const st of data.serviceTypes) {
          if (targetTenantId && st.tenantId !== targetTenantId) continue;
          await tx.serviceType.upsert({
            where: { id: st.id },
            update: {
              tenantId: st.tenantId,
              name: st.name,
              description: st.description || null,
              priceRetail: Number(st.priceRetail) || 0,
              priceMitra: st.priceMitra ? Number(st.priceMitra) : null,
              priceGrosir: st.priceGrosir ? Number(st.priceGrosir) : null,
              vehicleType: st.vehicleType || 'MOTOR',
              isActive: st.isActive !== false
            },
            create: {
              id: st.id,
              tenantId: st.tenantId,
              name: st.name,
              description: st.description || null,
              priceRetail: Number(st.priceRetail) || 0,
              priceMitra: st.priceMitra ? Number(st.priceMitra) : null,
              priceGrosir: st.priceGrosir ? Number(st.priceGrosir) : null,
              vehicleType: st.vehicleType || 'MOTOR',
              isActive: st.isActive !== false
            }
          });
          count++;
        }
        restoredCounts.serviceTypes = count;
      }

      if (Array.isArray(data.mechanicProfiles)) {
        let count = 0;
        for (const mp of data.mechanicProfiles) {
          if (targetTenantId && mp.tenantId !== targetTenantId) continue;
          await tx.mechanicProfile.upsert({
            where: { id: mp.id },
            update: {
              tenantId: mp.tenantId,
              userId: mp.userId,
              commissionType: mp.commissionType || 'PERCENT',
              commissionRate: Number(mp.commissionRate) || 0,
              pendingCommission: Number(mp.pendingCommission) || 0,
              paidCommission: Number(mp.paidCommission) || 0
            },
            create: {
              id: mp.id,
              tenantId: mp.tenantId,
              userId: mp.userId,
              commissionType: mp.commissionType || 'PERCENT',
              commissionRate: Number(mp.commissionRate) || 0,
              pendingCommission: Number(mp.pendingCommission) || 0,
              paidCommission: Number(mp.paidCommission) || 0
            }
          });
          count++;
        }
        restoredCounts.mechanicProfiles = count;
      }

      if (Array.isArray(data.workOrders)) {
        let count = 0;
        for (const wo of data.workOrders) {
          if (targetTenantId && wo.tenantId !== targetTenantId) continue;
          await tx.workOrder.upsert({
            where: { id: wo.id },
            update: {
              tenantId: wo.tenantId,
              spkNumber: wo.spkNumber,
              vehicleId: wo.vehicleId || null,
              customerId: wo.customerId || null,
              mechanicId: wo.mechanicId || null,
              mechanicName: wo.mechanicName || null,
              status: wo.status || 'PENDING',
              priceTier: wo.priceTier || wo.pricingTier || 'UMUM',
              complaint: wo.complaint || null,
              diagnosis: wo.diagnosis || null,
              notes: wo.notes || null,
              odometer: wo.odometer ? Number(wo.odometer) : null,
              totalServices: Number(wo.totalServices) || 0,
              totalParts: Number(wo.totalParts) || 0,
              totalAmount: Number(wo.totalAmount || wo.grandTotal) || 0,
              paidAmount: Number(wo.paidAmount) || 0,
              createdAt: wo.createdAt ? new Date(wo.createdAt) : new Date()
            },
            create: {
              id: wo.id,
              tenantId: wo.tenantId,
              spkNumber: wo.spkNumber,
              vehicleId: wo.vehicleId || null,
              customerId: wo.customerId || null,
              mechanicId: wo.mechanicId || null,
              mechanicName: wo.mechanicName || null,
              status: wo.status || 'PENDING',
              priceTier: wo.priceTier || wo.pricingTier || 'UMUM',
              complaint: wo.complaint || null,
              diagnosis: wo.diagnosis || null,
              notes: wo.notes || null,
              odometer: wo.odometer ? Number(wo.odometer) : null,
              totalServices: Number(wo.totalServices) || 0,
              totalParts: Number(wo.totalParts) || 0,
              totalAmount: Number(wo.totalAmount || wo.grandTotal) || 0,
              paidAmount: Number(wo.paidAmount) || 0,
              createdAt: wo.createdAt ? new Date(wo.createdAt) : new Date()
            }
          });
          count++;
        }
        restoredCounts.workOrders = count;
      }

      // 7i. Retail Vertical (Product UOMs)
      if (Array.isArray(data.productUoms)) {
        let count = 0;
        for (const u of data.productUoms) {
          if (targetTenantId && u.tenantId !== targetTenantId) continue;
          await tx.productUOM.upsert({
            where: { id: u.id },
            update: {
              tenantId: u.tenantId,
              productId: u.productId,
              unitName: u.unitName || u.name || 'PCS',
              conversionRatio: Number(u.conversionRatio || u.ratio) || 1,
              barcode: u.barcode || null,
              priceSell: Number(u.priceSell || u.sellPrice) || 0,
              isDefaultSale: Boolean(u.isDefaultSale ?? u.isDefaultSell)
            },
            create: {
              id: u.id,
              tenantId: u.tenantId,
              productId: u.productId,
              unitName: u.unitName || u.name || 'PCS',
              conversionRatio: Number(u.conversionRatio || u.ratio) || 1,
              barcode: u.barcode || null,
              priceSell: Number(u.priceSell || u.sellPrice) || 0,
              isDefaultSale: Boolean(u.isDefaultSale ?? u.isDefaultSell)
            }
          });
          count++;
        }
        restoredCounts.productUoms = count;
      }

      // 7j. Retail Vertical (Product Price Tiers)
      if (Array.isArray(data.productPriceTiers)) {
        let count = 0;
        for (const pt of data.productPriceTiers) {
          if (targetTenantId && pt.tenantId !== targetTenantId) continue;
          const prodExists = await tx.product.findUnique({ where: { id: pt.productId } });
          if (!prodExists) continue;

          await tx.productPriceTier.upsert({
            where: { id: pt.id },
            update: {
              tenantId: pt.tenantId,
              productId: pt.productId,
              minQty: Number(pt.minQty) || 1,
              tierName: pt.tierName || 'Grosir',
              unitPrice: Number(pt.unitPrice) || 0,
              customerCategory: pt.customerCategory || null
            },
            create: {
              id: pt.id,
              tenantId: pt.tenantId,
              productId: pt.productId,
              minQty: Number(pt.minQty) || 1,
              tierName: pt.tierName || 'Grosir',
              unitPrice: Number(pt.unitPrice) || 0,
              customerCategory: pt.customerCategory || null
            }
          });
          count++;
        }
        restoredCounts.productPriceTiers = count;
      }

      // 7k. Retail Vertical (Delivery Orders)
      if (Array.isArray(data.deliveryOrders)) {
        let count = 0;
        for (const d of data.deliveryOrders) {
          if (targetTenantId && d.tenantId !== targetTenantId) continue;
          await tx.deliveryOrder.upsert({
            where: { id: d.id },
            update: {
              tenantId: d.tenantId,
              doNumber: d.doNumber,
              orderId: d.orderId || null,
              customerId: d.customerId || null,
              driverName: d.driverName || null,
              vehiclePlate: d.vehiclePlate || null,
              shippingAddress: d.shippingAddress || '-',
              status: d.status || 'PENDING',
              recipientName: d.recipientName || null,
              deliveredAt: d.deliveredAt ? new Date(d.deliveredAt) : null,
              notes: d.notes || null
            },
            create: {
              id: d.id,
              tenantId: d.tenantId,
              doNumber: d.doNumber,
              orderId: d.orderId || null,
              customerId: d.customerId || null,
              driverName: d.driverName || null,
              vehiclePlate: d.vehiclePlate || null,
              shippingAddress: d.shippingAddress || '-',
              status: d.status || 'PENDING',
              recipientName: d.recipientName || null,
              deliveredAt: d.deliveredAt ? new Date(d.deliveredAt) : null,
              notes: d.notes || null
            }
          });
          count++;
        }
        restoredCounts.deliveryOrders = count;
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
      maxWait: 30000,
      timeout: 120000
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
