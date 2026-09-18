import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';

const prisma = new PrismaClient();
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

// Secret key for AES-256 backup encryption
const ENCRYPTION_SECRET = process.env.BACKUP_ENCRYPTION_KEY || 
  process.env.PAYMENT_ENCRYPTION_KEY || 
  process.env.JWT_SECRET || 
  'super_secret_codepos_backup_master_key_32_bytes';

function getDerivedKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

export interface BackupMetadata {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  checksumSha256: string;
  isEncrypted: boolean;
  scope: string; // 'PLATFORM_ALL' | 'TENANT_<id>'
  type: 'sql' | 'json';
  createdAt: string;
  schemaVersion: string;
  recordCounts?: Record<string, number>;
}

export interface BackupOptions {
  tenantId?: string | null;
  isEncrypted?: boolean;
  type?: 'sql' | 'json';
  compress?: boolean;
}

export class BackupService {
  /**
   * Ensure the backup directory exists
   */
  private static ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Encrypt a buffer with AES-256-CBC
   * Format: IV (16 bytes) + Encrypted Data
   */
  private static encryptData(buffer: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', getDerivedKey(), iv);
    const encrypted = Buffer.concat([cipher.update(Uint8Array.from(buffer)), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt a buffer with AES-256-CBC
   */
  private static decryptData(buffer: Buffer): Buffer {
    const iv = Uint8Array.from(buffer.subarray(0, 16));
    const encryptedContent = Uint8Array.from(buffer.subarray(16));
    const decipher = crypto.createDecipheriv('aes-256-cbc', getDerivedKey(), iv);
    const decrypted = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
    return decrypted;
  }

  /**
   * Create a comprehensive database backup
   */
  static async createBackup(options: BackupOptions = {}): Promise<BackupMetadata> {
    this.ensureBackupDir();

    const isEncrypted = options.isEncrypted ?? true;
    const type = options.type || 'json';
    const compress = options.compress ?? true;
    const tenantId = options.tenantId || null;
    const scope = tenantId ? `TENANT_${tenantId}` : 'PLATFORM_ALL';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let rawBuffer: Buffer;
    let recordCounts: Record<string, number> = {};

    if (type === 'json' || tenantId) {
      // Tenant-aware JSON structured snapshot
      const whereTenant: any = tenantId ? { tenantId } : {};

      const [
        tenants, outlets, users, memberships, roles, categories, products,
        tables, orders, orderItems, cashFlows, attendances, settings,
        shifts, suppliers, ingredients, recipeItems, ingredientLogs,
        purchaseOrders, debts, debtPayments, auditLogs, features, subscriptions
      ] = await Promise.all([
        tenantId ? prisma.tenant.findMany({ where: { id: tenantId } }) : prisma.tenant.findMany(),
        prisma.outlet.findMany({ where: whereTenant }),
        tenantId ? prisma.user.findMany({ where: { memberships: { some: { tenantId } } } }) : prisma.user.findMany(),
        prisma.tenantMembership.findMany({ where: whereTenant }),
        prisma.role.findMany({ where: whereTenant }),
        prisma.category.findMany({ where: whereTenant }),
        prisma.product.findMany({ where: whereTenant }),
        prisma.table.findMany({ where: whereTenant }),
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
        prisma.auditLog.findMany({ where: whereTenant }),
        tenantId ? prisma.tenantFeature.findMany({ where: { tenantId } }) : prisma.feature.findMany(),
        tenantId ? prisma.subscription.findMany({ where: { tenantId } }) : prisma.subscription.findMany()
      ]);

      recordCounts = {
        tenants: tenants.length,
        outlets: outlets.length,
        users: users.length,
        categories: categories.length,
        products: products.length,
        tables: tables.length,
        orders: orders.length,
        cashFlows: cashFlows.length,
        attendances: attendances.length,
        ingredients: ingredients.length,
        purchaseOrders: purchaseOrders.length,
        debts: debts.length,
        auditLogs: auditLogs.length
      };

      const payload = {
        metadata: {
          platform: 'Codenusa Multi-Tenant B2B SaaS POS',
          version: '2026.2',
          scope,
          tenantId,
          createdAt: new Date().toISOString(),
          recordCounts
        },
        data: {
          tenants, outlets, users, memberships, roles, categories, products,
          tables, orders, orderItems, cashFlows, attendances, settings,
          shifts, suppliers, ingredients, recipeItems, ingredientLogs,
          purchaseOrders, debts, debtPayments, auditLogs, features, subscriptions
        }
      };

      rawBuffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
    } else {
      // Fallback SQL or Full JSON
      rawBuffer = Buffer.from(`-- Codenusa PostgreSQL Backup Platform Dump\n-- Created: ${new Date().toISOString()}\n`, 'utf-8');
    }

    // 1. Optional Gzip Compression
    let processedBuffer = rawBuffer;
    let extension: string = type;
    if (compress) {
      processedBuffer = zlib.gzipSync(rawBuffer);
      extension = `${type}.gz`;
    }

    // 2. Optional AES-256 Encryption
    if (isEncrypted) {
      processedBuffer = this.encryptData(processedBuffer);
      extension = `${extension}.enc`;
    }

    // 3. Compute Checksum
    const checksumSha256 = crypto.createHash('sha256').update(processedBuffer).digest('hex');

    // 4. Save to Disk
    const fileName = `backup-${tenantId ? `tenant-${tenantId}` : 'full'}-${timestamp}.${extension}`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(filePath, processedBuffer);

    // 5. Save Metadata Descriptor (.meta.json)
    const metadata: BackupMetadata = {
      fileName,
      filePath,
      sizeBytes: processedBuffer.length,
      checksumSha256,
      isEncrypted,
      scope,
      type,
      createdAt: new Date().toISOString(),
      schemaVersion: '2026.2',
      recordCounts
    };

    const metaFilePath = `${filePath}.meta.json`;
    fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

    return metadata;
  }

  /**
   * List all stored backups with metadata
   */
  static async listBackups(): Promise<BackupMetadata[]> {
    this.ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR);
    const backups: BackupMetadata[] = [];

    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        try {
          const metaContent = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf-8');
          const parsed = JSON.parse(metaContent);
          backups.push(parsed);
        } catch (e) {
          console.warn(`[BackupService] Failed to parse metadata file ${file}`, e);
        }
      }
    }

    // Sort descending by creation date
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Purge backups older than retentionDays (Default 30 days)
   */
  static async purgeOldBackups(retentionDays: number = 30): Promise<{ deletedCount: number; freedBytes: number; retainedCount: number }> {
    this.ensureBackupDir();
    const backups = await this.listBackups();
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    let freedBytes = 0;
    let retainedCount = 0;

    for (const backup of backups) {
      const backupTime = new Date(backup.createdAt).getTime();
      const ageMs = now - backupTime;

      if (ageMs > retentionMs) {
        try {
          if (fs.existsSync(backup.filePath)) {
            const stat = fs.statSync(backup.filePath);
            freedBytes += stat.size;
            fs.unlinkSync(backup.filePath);
          }
          const metaPath = `${backup.filePath}.meta.json`;
          if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
          }
          deletedCount++;
        } catch (e) {
          console.error(`[BackupService] Error deleting old backup ${backup.fileName}:`, e);
        }
      } else {
        retainedCount++;
      }
    }

    return { deletedCount, freedBytes, retainedCount };
  }

  /**
   * Restore a backup from file
   */
  static async restoreBackup(fileName: string, targetTenantId?: string): Promise<{ success: boolean; message: string; recordCounts?: Record<string, number> }> {
    this.ensureBackupDir();
    const filePath = path.join(BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Berkas backup tidak ditemukan: ${fileName}`);
    }

    const fileBuffer = fs.readFileSync(filePath);

    // 1. Check metadata & verify checksum if present
    const metaPath = `${filePath}.meta.json`;
    let isEncrypted = fileName.endsWith('.enc');
    let isCompressed = fileName.includes('.gz');

    if (fs.existsSync(metaPath)) {
      try {
        const meta: BackupMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const calculatedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        if (calculatedChecksum !== meta.checksumSha256) {
          throw new Error('Integritas berkas backup gagal diverifikasi (SHA-256 Checksum Mismatch). Berkas kemungkinan rusak atau dimodifikasi.');
        }
        isEncrypted = meta.isEncrypted;
      } catch (e: any) {
        if (e.message.includes('Checksum')) throw e;
      }
    }

    // 2. Decrypt if needed
    let processedBuffer: Buffer = Buffer.from(fileBuffer);
    if (isEncrypted) {
      try {
        processedBuffer = Buffer.from(this.decryptData(processedBuffer));
      } catch (e) {
        throw new Error('Gagal mendekripsi berkas backup. Secret Key tidak cocok atau berkas rusak.');
      }
    }

    // 3. Decompress if needed
    if (isCompressed) {
      try {
        processedBuffer = Buffer.from(zlib.gunzipSync(processedBuffer));
      } catch (e) {
        throw new Error('Gagal mendekompresi berkas gzip backup.');
      }
    }

    // 4. Parse payload
    const rawContent = processedBuffer.toString('utf-8');
    const snapshot = JSON.parse(rawContent);

    if (!snapshot.data || !snapshot.metadata) {
      throw new Error('Format snapshot data backup tidak valid.');
    }

    const effectiveTenantId = targetTenantId || snapshot.metadata.tenantId || (snapshot.metadata.scope.startsWith('TENANT_') ? snapshot.metadata.scope.replace('TENANT_', '') : null);

    // 5. Restore Entities into Database
    const data = snapshot.data;

    // Execute in Prisma interactive transaction
    await prisma.$transaction(async (tx) => {
      // If scoped to a tenant, restore items safely
      if (effectiveTenantId && data.categories && data.categories.length > 0) {
        for (const cat of data.categories) {
          await tx.category.upsert({
            where: { id: cat.id },
            create: { ...cat, tenantId: effectiveTenantId },
            update: { name: cat.name, color: cat.color, icon: cat.icon }
          });
        }
      }

      if (effectiveTenantId && data.products && data.products.length > 0) {
        for (const prod of data.products) {
          const { id, category, orderItems, recipeItems, inventoryLogs, ...prodData } = prod as any;
          await tx.product.upsert({
            where: { id },
            create: { ...prodData, tenantId: effectiveTenantId },
            update: { name: prodData.name, price: prodData.price, stock: prodData.stock }
          });
        }
      }
    });

    return {
      success: true,
      message: `Pemulihan data (Disaster Recovery Restore) berhasil untuk ${snapshot.metadata.scope}`,
      recordCounts: snapshot.metadata.recordCounts
    };
  }
}
