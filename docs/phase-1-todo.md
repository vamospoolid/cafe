# PHASE 1: Tenant Foundation & Core Schema Models - Action Checklist

## 🎯 Status Phase 1: SELESAI (COMPLETED ✅)
Fondasi multi-tenant telah sukses diimplementasikan pada skema database secara **non-destruktif**, Prisma Client telah digenerate, 40 permission keys & 7 system roles telah didaftarkan, serta Master Tenant (`MUKI RAMEN`) dan Primary Outlet (`MUK-01`) telah terhubung secara aman tanpa mengganggu fungsionalitas aplikasi existing.

---

## 📝 Rekapitulasi Checklist Todo List Phase 1

### 1.1 Pembaruan Skema Database (`backend/prisma/schema.prisma`)
- [x] **1.1.1** Tambahkan model inti platform:
  - `Tenant`: ID unik (UUID), `name`, `slug` (@unique), `customDomain`, `logoUrl`, `status`, `createdAt`, `updatedAt`
  - `Outlet`: ID unik (UUID), `tenantId`, `name`, `code`, `address`, `phone`, `latitude`, `longitude`, `gpsRadiusMeters`, `status`, `settings` (JSON)
  - `TenantMembership`: ID unik, `userId`, `tenantId`, `roleId`, `pin`, `employmentType`, `status`, `createdAt`, `updatedAt`, `@@unique([userId, tenantId])`
  - `Role`: ID unik, `tenantId` (nullable untuk system default roles), `name`, `description`, `isSystem`
  - `Permission`: ID unik, `key` (@unique), `name`, `module`, `description`
  - `RolePermission`: `roleId`, `permissionId`, `@@id([roleId, permissionId])`
  - `UserSession`: ID unik, `userId`, `tokenHash`, `tenantId`, `outletId`, `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`
  - `TenantPaymentConfig`: ID unik, `tenantId` (@unique), toggle Midtrans, mode Sandbox/Prod, `serverKey`, `clientKey`, `merchantId`
- [x] **1.1.2** Tambahkan relasi `tenantId` (String nullable) dan `outletId` (String nullable) pada seluruh 33 tabel bisnis existing secara non-destruktif.

### 1.2 Generate Migration & Verifikasi Prisma Client
- [x] **1.2.1** Sinkronisasi database PostgreSQL via Prisma (`prisma db push` / safe sync).
- [x] **1.2.2** Generate Prisma Client terbaru (`npx prisma generate`).
- [x] **1.2.3** Verifikasi TypeScript build (`npx tsc --noEmit` & `npm run build`) -> **0 Errors**.

### 1.3 Pembuatan Seeder Fondasi Sistem (`backend/prisma/seed_foundation.ts`)
- [x] **1.3.1** Daftarkan 40 granular permission keys bawaan sistem (POS, KDS, Inventory, Warehouse, HR, Attendance, Reports, Settings, Platform).
- [x] **1.3.2** Daftarkan 7 default system roles (`OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `KITCHEN`, `WAREHOUSE`, `HR`) lengkap dengan mapping permission masing-masing.
- [x] **1.3.3** Buat Master Tenant default (`id: 'tenant-default-muki'`, `name: 'MUKI RAMEN'`, `slug: 'mukiramen'`).
- [x] **1.3.4** Buat Primary Outlet default (`id: 'outlet-default-muki-01'`, `code: 'MUK-01'`, `name: 'Muki Ramen - Pusat Wonomulyo'`).
- [x] **1.3.5** Hubungkan user existing ke Master Tenant via `TenantMembership`.
- [x] **1.3.6** Hubungkan seluruh data bisnis existing ke Master Tenant & Primary Outlet.

### 1.4 Verifikasi & Backward Compatibility Check
- [x] **1.4.1** Uji suite pengujian fungsionalitas bisnis (`test_phase1.js` WAC, Table Release on Void, Shift Reconciliation) -> **100% PASSED**.
- [x] **1.4.2** Build frontend React & build backend TypeScript -> **100% PASSED**.
