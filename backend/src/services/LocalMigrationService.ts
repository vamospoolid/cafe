import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { StandaloneConfig } from '../utils/standaloneConfig';
import { getLocalDatabasePaths } from '../utils/localDatabasePaths';
import prisma from '../db';
import bcrypt from 'bcryptjs';

export class LocalMigrationService {
  /**
   * Menjalankan sinkronisasi skema database SQLite lokal secara senyap saat booting pertama
   */
  public static async ensureLocalDatabaseReady(): Promise<boolean> {
    if (!StandaloneConfig.isStandalone()) {
      return false;
    }

    const vertical = StandaloneConfig.getVertical();
    const paths = getLocalDatabasePaths(vertical);
    const candidateSchemaPaths = [
      path.resolve(__dirname, '../../prisma/schema.sqlite.prisma'),
      path.resolve(__dirname, '../../../prisma/schema.sqlite.prisma'),
      path.resolve(process.cwd(), 'backend/prisma/schema.sqlite.prisma'),
      path.resolve(process.cwd(), 'prisma/schema.sqlite.prisma'),
      path.resolve(__dirname, '../backend-prisma/schema.sqlite.prisma')
    ];

    const schemaPath = candidateSchemaPaths.find(p => fs.existsSync(p)) || candidateSchemaPaths[0];

    console.log(`[LocalMigrationService] Memeriksa database lokal untuk vertikal: ${vertical}`);
    console.log(`[LocalMigrationService] Lokasi Database: ${paths.dbFilePath}`);
    console.log(`[LocalMigrationService] Lokasi Skema: ${schemaPath}`);

    // Pastikan skema sqlite ada
    if (!fs.existsSync(schemaPath)) {
      console.error(`[LocalMigrationService] File skema SQLite tidak ditemukan di jalur kandidat: ${schemaPath}`);
      return false;
    }

    const isNewDb = !fs.existsSync(paths.dbFilePath);
    process.env.DATABASE_URL = paths.databaseUrl;

    try {
      // Jalankan prisma db push secara senyap menggunakan binary lokal
      console.log(`[LocalMigrationService] Menjalankan sinkronisasi skema Prisma SQLite...`);
      const candidateBins = [
        path.resolve(__dirname, '../../node_modules/.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma'),
        path.resolve(__dirname, '../../../node_modules/.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma'),
        path.resolve(process.cwd(), 'backend/node_modules/.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma'),
        path.resolve(process.cwd(), 'node_modules/.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma')
      ];
      const prismaBin = candidateBins.find(p => fs.existsSync(p));
      const prismaCmd = prismaBin ? `"${prismaBin}"` : 'npx prisma';

      execSync(`${prismaCmd} db push --schema="${schemaPath}" --skip-generate`, {
        env: {
          ...process.env,
          DATABASE_URL: paths.databaseUrl
        },
        stdio: 'pipe'
      });
      console.log(`[LocalMigrationService] ✅ Skema SQLite berhasil disinkronkan.`);

      // Optimasi Performa & Anti-Locking (WAL Mode & Busy Timeout) KHUSUS SQLite Lokal
      try {
        console.log('[LocalMigrationService] Mengaktifkan mode performa tinggi SQLite (WAL Mode & Anti-Locking)...');
        await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
        await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
        await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
        console.log('[LocalMigrationService] ✅ Mode WAL & Concurrency Protection SQLite aktif.');
      } catch (pragmaErr: any) {
        console.warn('[LocalMigrationService] Peringatan PRAGMA SQLite (dilewati):', pragmaErr.message);
      }

      // Jika database baru dibuat, inisialisasi data fondasi default
      if (isNewDb) {
        await LocalMigrationService.seedInitialStandaloneData();
      }

      return true;
    } catch (err: any) {
      console.error(`[LocalMigrationService] ❌ Gagal melakukan migrasi database SQLite:`, err?.message || err);
      return false;
    }
  }

  /**
   * Mengisi data fondasi default pada instalasi baru (Tanpa koneksi internet)
   */
  public static async seedInitialStandaloneData(): Promise<void> {
    const vertical = StandaloneConfig.getVertical();
    const tenantId = StandaloneConfig.getTenantId();
    const outletId = StandaloneConfig.getOutletId();

    console.log(`[LocalMigrationService] Menyiapkan data fondasi awal (${vertical})...`);

    try {
      // 1. Buat Tenant Default
      const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!existingTenant) {
        await prisma.tenant.create({
          data: {
            id: tenantId,
            name: `CodePOS ${vertical} Pro`,
            slug: 'standalone-store',
            status: 'ACTIVE',
            businessType: vertical,
            ownerName: 'Pemilik Toko',
            phone: '08123456789'
          }
        });
      }

      // 2. Buat Outlet Default
      const existingOutlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
      if (!existingOutlet) {
        await prisma.outlet.create({
          data: {
            id: outletId,
            tenantId,
            code: 'OUT-01',
            name: 'Outlet Utama',
            address: 'Jl. Raya Operasional No. 1',
            phone: '08123456789'
          }
        });
      }

      // 3. Buat Akun Owner / Admin Default
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const existingUser = await prisma.user.findFirst({
        where: { username: 'admin', tenantId }
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            username: 'admin',
            passwordHash: hashedPassword,
            name: 'Administrator',
            role: 'OWNER',
            pin: '1234',
            permissions: '[]',
            status: 'Aktif',
            tenantId
          }
        });
      }

      // 4. Buat Akun Kasir Default
      const existingKasir = await prisma.user.findFirst({
        where: { username: 'kasir', tenantId }
      });

      if (!existingKasir) {
        await prisma.user.create({
          data: {
            username: 'kasir',
            passwordHash: hashedPassword,
            name: 'Kasir Utama',
            role: 'KASIR',
            pin: '1111',
            permissions: '[]',
            status: 'Aktif',
            tenantId
          }
        });
      }

      // 5. Buat Pengaturan Toko Default
      const existingSettings = await prisma.settings.findFirst({ where: { tenantId } });
      if (!existingSettings) {
        await prisma.settings.create({
          data: {
            tenantId,
            storeName: `Bengkel & Toko ${vertical}`,
            address: 'Jl. Raya Utama No. 1',
            phone: '08123456789',
            receiptFooter: 'Terima kasih atas kunjungan Anda!',
            enableGpsValidation: false,
            enableCameraPhoto: false
          }
        });
      }

      console.log(`[LocalMigrationService] ✅ Inisialisasi data awal selesai. Siap transaksi offline.`);
    } catch (seedErr) {
      console.error(`[LocalMigrationService] Warning saat seeding awal:`, seedErr);
    }
  }
}
