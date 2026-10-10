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
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.sqlite.prisma');

    console.log(`[LocalMigrationService] Memeriksa database lokal untuk vertikal: ${vertical}`);
    console.log(`[LocalMigrationService] Lokasi Database: ${paths.dbFilePath}`);

    // Pastikan skema sqlite ada
    if (!fs.existsSync(schemaPath)) {
      console.error(`[LocalMigrationService] File skema SQLite tidak ditemukan: ${schemaPath}`);
      return false;
    }

    const isNewDb = !fs.existsSync(paths.dbFilePath);

    try {
      // Jalankan prisma db push secara senyap
      console.log(`[LocalMigrationService] Menjalankan sinkronisasi skema Prisma SQLite...`);
      execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate`, {
        env: {
          ...process.env,
          DATABASE_URL: paths.databaseUrl
        },
        stdio: 'pipe'
      });
      console.log(`[LocalMigrationService] ✅ Skema SQLite berhasil disinkronkan.`);

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
