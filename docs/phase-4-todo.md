# Phase 4: Tenant-Aware API & Service Layer Architecture

## 🎯 Target & Tujuan
Mengisolasi seluruh query data dan komunikasi real-time pada level runtime (API context, Prisma queries, dan Socket.IO rooms) secara otomatis sehingga tidak ada data antar-tenant yang dapat bocor atau tertukar.

---

## 📋 Checklist Pekerjaan Phase 4

### 1. Tenant Context & AsyncLocalStorage
- [x] **4.1.1** Buat `backend/src/utils/tenantContext.ts` menggunakan Node.js `AsyncLocalStorage` untuk menyimpan dan membaca metadata tenant (`tenantId`, `outletId`, `userId`, `role`, `isSuperAdmin`) per thread/request lifecycle.
- [x] **4.1.2** Buat `backend/src/middlewares/tenantResolver.ts`:
  - Mengekstrak `tenantId` dari JWT payload (`Authorization: Bearer <token>`).
  - Mengekstrak `tenantId` dari custom header `x-tenant-id` / `x-outlet-id`.
  - Mengekstrak tenant subdomain (misal: `subdomain.codenusa.id`).
  - Fallback ke default master tenant `tenant-default-muki` untuk backwards compatibility.
  - Membungkus eksekusi request ke dalam `TenantContext.run(...)`.

### 2. Prisma Multi-Tenant Extension (Automated Query Scoping)
- [x] **4.2.1** Buat `backend/src/utils/prismaTenant.ts`:
  - Menggunakan Prisma Client Extension (`$extends`) untuk membaca konteks `TenantContext.getTenantId()`.
  - Mengotomatiskan injeksi filter `where: { tenantId }` pada seluruh operasi baca (`findMany`, `findFirst`, `count`, `aggregate`, dll).
  - Mengotomatiskan injeksi `data: { tenantId }` pada seluruh operasi tulis (`create`, `createMany`).
  - Menyediakan bypass aman untuk admin platform/superadmin (`isSuperAdmin: true`).

### 3. Express Application & Socket.IO Room Scoping
- [x] **4.3.1** Pasang `tenantResolverMiddleware` pada `backend/src/index.ts` sebelum seluruh handler routes API.
- [x] **4.3.2** Update Socket.IO connection handler pada `backend/src/index.ts` untuk memisahkan room tenant (`tenant:${tenantId}`) dan room outlet (`outlet:${outletId}`).
- [x] **4.3.3** Sediakan helper broadcast `emitToTenant(tenantId, event, data)` dan `emitToOutlet(outletId, event, data)`.
- [x] **4.3.4** Update `frontend/src/hooks/useSocket.ts` agar menyertakan auth token pada koneksi Socket.IO client.

### 4. Verification & Testing
- [x] **4.4.1** Buat automated test suite `backend/test_phase4.js`.
- [x] **4.4.2** Jalankan test suite dan verifikasi 100% lulus (Data isolation test, AsyncLocalStorage isolation, Automated tenant filter, Automated create injection).
- [x] **4.4.3** Build backend dan frontend terverifikasi lulus tanpa error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 5)
