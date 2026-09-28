# Checklist & TODO: Phase 7 — SaaS Cross-Tenant Data Isolation Hardening

Dokumen ini memuat daftar tugas untuk memperbaiki 3 pola kebocoran data lintas tenant
yang ditemukan di modul Bahan Baku, Analitik, Piutang, dan Pelanggan.

---

## Status: ✅ COMPLETED (Semua Test & Hardening Terverifikasi)

---

## Ringkasan Bug & Hasil Perbaikan

| Bug | File | Lokasi | Severity | Status |
|-----|------|--------|----------|--------|
| #1 OR tenantId:null (18 lokasi) | ingredients.ts | L97,119,228,560,580,643,734,763,842,1048,1060,1145,1214,1232,1335,1415,1474,1496 | 🔴 HIGH | ✅ FIXED |
| #2 Hardcoded fallback default | customers.ts | L10,52,103,151,235 | 🟡 MEDIUM | ✅ FIXED |
| #3 tenantWhere fail-open (no filter) | analytics.ts, debts.ts | L15-16 | 🟡 MEDIUM | ✅ FIXED |
| #4 OR tenantId:null di modul lain | suppliers.ts, tables.ts, products.ts, recycleBin.ts | Berbagai endpoint | 🔴 HIGH | ✅ FIXED |

---

## 📌 Checklist Tugas - Phase 7

### 1. Fix Bug #2 — customers.ts: Hapus Hardcoded Fallback
- [x] L10, 52, 103, 151, 235: Ganti `req.user?.tenantId || 'tenant-default-muki'` dengan guard:
  ```typescript
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
  ```
- [x] Cek semua endpoint customers.ts yang lain (POST, PUT, DELETE) — 100% bebas dari fallback hardcoded.

### 2. Fix Bug #3 — analytics.ts: Guard Tenant Context di Setiap Handler
- [x] Ubah `tenantWhere()` menjadi fail-closed (throw `MISSING_TENANT_ID` jika tenantId undefined)
- [x] Tambah router-level fail-closed middleware `router.use((req, res, next) => ...)` menolak request tanpa tenant context (400 MISSING_TENANT_CONTEXT)
- [x] Pastikan `tenantWhere({})` tidak pernah terjadi (mencegah full table scan multi-tenant)

### 3. Fix Bug #3 — debts.ts: Guard Tenant Context
- [x] Ubah `tenantWhere()` fail-closed (throw `MISSING_TENANT_ID`)
- [x] Tambah router-level fail-closed middleware menolak request tanpa tenant context (400 MISSING_TENANT_CONTEXT)
- [x] Cek semua endpoint debts.ts (GET list, GET by customerId, POST payment)

### 4. Fix Bug #1 — ingredients.ts: Hapus Semua `OR tenantId:null` (18 lokasi)
- [x] L97-105: GET /ingredients list → ganti `OR [tenantId, null]` → `{ tenantId }`
- [x] L115-125: GET /ingredients/search / production-forecast → sama
- [x] L228: GET /ingredients/yield-analytics → sama
- [x] L560: GET /ingredients/stock-opname/history → sama
- [x] L580: GET /ingredients/low-stock → sama
- [x] L643: PUT /ingredients/:id → sama
- [x] L734: GET /ingredients/loss-analytics → sama
- [x] L763: GET /ingredients/loss-analytics (productionLogs) → sama
- [x] L842: GET /ingredients/staff-activity-analytics → sama
- [x] L1048: GET /ingredients/shopping-analytics (ingredients) → sama
- [x] L1060: GET /ingredients/shopping-analytics (recentLogs) → sama
- [x] L1145: GET /ingredients/stock-movements → sama
- [x] L1214: GET /ingredients/analytics/daily-usage (logs) → sama
- [x] L1232: GET /ingredients/analytics/daily-usage (orders) → sama
- [x] L1335: DELETE /ingredients/:id → sama
- [x] L1415: POST /ingredients/:id/adjust → sama
- [x] L1474: GET /ingredients/:id/logs → sama
- [x] L1496: DELETE /ingredients/:id (soft delete) → sama
- [x] Tambah router-level fail-closed middleware di ingredients.ts

### 5. Migrate Data null tenantId (DB Cleanup)
- [x] Query DB: verifikasi record `tenantId: null`
  - Ingredient: 0 record null
  - Recipe: 0 record null
  - Customer: 0 record null
  - Debt: 0 record null
  - Supplier: 0 record null
  - Table: 0 record null
  - Product: 1 test record (`Gyudon Beef Bowl Test`) berhasil dimigrasikan ke `tenant-default-muki`
- [x] DB 100% bersih dari data tanpa tenant

### 6. Verifikasi products.ts, suppliers.ts, tables.ts, recycleBin.ts
- [x] products.ts: Hapus `OR tenantId:null` di list, update, soft delete
- [x] suppliers.ts: Hapus `OR tenantId:null` dan pasang router guard fail-closed
- [x] tables.ts: Hapus `OR tenantId:null` di update & delete
- [x] recycleBin.ts: Hapus `OR tenantId:null` dan pasang guard fail-closed 400

### 7. Test Suite & Verifikasi
- [x] Buat backend/scripts/test_phase7_cross_tenant_isolation.js (5 skenario):
  1. Bahan baku terisolasi ketat (tidak ada data global null)
  2. Customers fail-closed (tidak fallback ke default)
  3. Analytics fail-closed (400 MISSING_TENANT_CONTEXT, tenantWhere throw)
  4. Debts fail-closed (400 MISSING_TENANT_CONTEXT, tenantWhere throw)
  5. Recycle Bin & Suppliers strict isolation
- [x] Jalankan test Phase 7: **5/5 PASSED**
- [x] Jalankan regresi Phase 1-6 + Phase 7: **32/32 PASSED**
- [x] TypeScript `tsc --noEmit` & full compilation: **ZERO ERRORS**
- [x] Rebuild backend & restart background server: **ONLINE & HEALTHY**

---

## 📊 Estimasi Dampak Setelah Fix

| Sebelum Fix | Setelah Fix |
|-------------|-------------|
| Tenant A bisa lihat ingredient global (tenantId=null) | Hanya lihat ingredient milik Tenant A |
| Token rusak → query fallback ke MUKI RAMEN | Token rusak → 400 error |
| Analytics tanpa tenantId → full table scan | Analytics tanpa tenantId → 400 error |
| Laporan bisa campur data antar tenant | Laporan 100% isolated per tenant |
