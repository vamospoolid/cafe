# Checklist & TODO: Phase 8 — SaaS Comprehensive Cross-Tenant & Real-Time Hardening

Dokumen ini memuat daftar tugas untuk memperbaiki 4 kategori celah kebocoran lintas tenant lanjutan:
1. WebSocket / Real-Time global broadcast leaks (`io.emit`)
2. Root middleware & route hardcoded fallback (`tenant-default-muki`)
3. Fail-open queries pada modul operasional utama (Orders, Cashflow, Attendance, Loans, Reservations, PO, KDS)
4. Residual data leak `OR tenantId: null` pada Categories

---

## Status: ✅ COMPLETED — 100% Teruji & Berhasil Diverifikasi

---

## Ringkasan Celah yang Ditemukan & Hasil Perbaikan

| Kategori | Modul / File | Detail Masalah | Severity | Status |
|---|---|---|---|---|
| **1. Real-Time WebSocket** | `warehouse.ts` (13x), `tables.ts` (3x), `ingredients.ts` (2x), `waste.ts` (1x) | Menggunakan `io.emit()` broadcast global bukan `emitToTenant()` | 🔴 CRITICAL | [x] FIXED |
| **2. Root Fallback** | `authMiddleware.ts` (L104), `tenantContext.ts` (L35), `tenantResolver.ts` (L122) | `tenantId: activeTenantId \|\| 'tenant-default-muki'` | 🔴 HIGH | [x] FIXED |
| **2. Route Fallback** | `users.ts` (5x), `vouchers.ts` (5x), `settings.ts` (L15), `shifts.ts` (L870), `manifest.ts` | Fallback hardcoded ke `tenant-default-muki` jika context lepas | 🔴 HIGH | [x] FIXED |
| **3. Fail-Open Transaksi** | `orders.ts`, `cashflow.ts` | `if (tenantId) where.tenantId = tenantId` (jika kosong → query ALL tenants) | 🔴 HIGH | [x] FIXED |
| **3. Fail-Open tenantWhere** | `attendance.ts`, `employeeLoans.ts`, `reservations.ts` | `function tenantWhere() { return tenantId ? {tenantId} : {} }` | 🟡 MEDIUM | [x] FIXED |
| **3. Fail-Open Operasional** | `purchaseOrders.ts`, `kds.ts`, `waste.ts`, `shifts.ts` | Missing strict tenant guards pada query & Z-report | 🟡 MEDIUM | [x] FIXED |
| **4. Residual OR Null** | `categories.ts` (L46, 140, 177) | `tenantCondition = tenantId ? { OR: [{tenantId}, {tenantId:null}] } : {}` | 🟡 MEDIUM | [x] FIXED |

---

## 📌 Checklist Tugas - Phase 8

### 1. Fix WebSocket / Real-Time Broadcast Leaks (Room Isolation)
- [x] `backend/src/routes/warehouse.ts`: Ganti 13 lokasi `io.emit(...)` menjadi `emitToTenant(tenantId, ...)`
  - [x] L255: `warehouse:stock_updated` (Inbound)
  - [x] L345, L376: `warehouse:stock_updated` (Opname)
  - [x] L488: `warehouse:transfer_created`
  - [x] L639: `warehouse:stock_updated` (Quick Adjustment)
  - [x] L738: `warehouse:transfer_approved`
  - [x] L777, L778: `warehouse:transfer_cancelled`, `warehouse:stock_updated`
  - [x] L877: `warehouse:stock_updated`
  - [x] L982: `warehouse:owner_reimbursed`
  - [x] L1206, L1207: `warehouse:sale_created`, `warehouse:stock_updated`
  - [x] L1292, L1293: `warehouse:sale_voided`, `warehouse:stock_updated`
- [x] `backend/src/routes/tables.ts`:
  - [x] L276-278: Ganti `io.emit('order:paid')`, `io.emit('order:new')`, `io.emit('kds:statusChanged')` menjadi `emitToTenant(tenantId, ...)`
- [x] `backend/src/routes/ingredients.ts`:
  - [x] L75, L81: Ganti `io.emit('menu:stock_sync')` dan `io.emit('product:sold_out')` menjadi `emitToTenant(tenantId, ...)`
- [x] `backend/src/routes/waste.ts`:
  - [x] L237: Ganti `io.emit('inventory:waste_logged')` menjadi `emitToTenant(tenantId, ...)`

### 2. Eliminasi Root Middleware & Route Hardcoded Fallback
- [x] `backend/src/middlewares/authMiddleware.ts`:
  - [x] L104: Hapus `|| 'tenant-default-muki'`. Jika `activeTenantId` tidak ada, set `undefined`.
- [x] `backend/src/utils/tenantContext.ts`:
  - [x] L35: `getTenantId()` mengembalikan `string | undefined` murni (tidak fallback default muki).
- [x] `backend/src/middlewares/tenantResolver.ts`:
  - [x] L122: Hapus fallback `|| 'tenant-default-muki'`.
- [x] `backend/src/routes/users.ts`:
  - [x] L13, L178, L240, L342, L440: Hapus `|| 'tenant-default-muki'` dan tambahkan guard fail-closed 400
- [x] `backend/src/routes/vouchers.ts`:
  - [x] L10, L33, L115, L170, L218: Hapus `|| 'tenant-default-muki'` dan pasang guard fail-closed 400
- [x] `backend/src/routes/settings.ts`:
  - [x] L15: Hapus fallback `|| 'tenant-default-muki'` di `resolveSettingsTenantId`
- [x] `backend/src/routes/shifts.ts`:
  - [x] L870: Hapus `|| 'tenant-default-muki'` pada `emitToTenant`
- [x] `backend/src/routes/manifest.ts`:
  - [x] L11-19: Hapus fallback `tenant-default-muki` dan batasi query settings hanya dengan `tenantId`.

### 3. Hardening Fail-Closed pada Modul Transaksi & Operasional
- [x] `backend/src/routes/orders.ts`:
  - [x] L214-217: Pasang guard `if (!tenantId) return res.status(400)...`, jangan biarkan `whereCondition` tanpa `tenantId`
  - [x] L276-279: Pastikan `GET /:id` wajib menyertakan `tenantId` (mencegah IDOR order antar tenant)
  - [x] L1245: Pastikan pelunasan order (`PATCH /:id/payment`) mewajibkan `tenantId`
  - [x] Seluruh endpoint (`/dinein`, `/sync`, `/`, `/:id/void`, `/split`, `/move-table`, `/merge-table`, `/sync-offline`) diproteksi fail-closed.
- [x] `backend/src/routes/cashflow.ts`:
  - [x] L16-19: Pasang guard `if (!tenantId) return res.status(400)...`, jangan biarkan `whereClause` tanpa `tenantId`
  - [x] L56: Pastikan pembuatan catatan kas (`POST /`) wajib memiliki `tenantId`
- [x] `backend/src/routes/attendance.ts`:
  - [x] L14-15: Ubah `tenantWhere` agar melempar error (`MISSING_TENANT_ID`) jika `tenantId` kosong
  - [x] Pasang router-level fail-closed middleware
- [x] `backend/src/routes/employeeLoans.ts`:
  - [x] L13-14: Ubah `tenantWhere` agar melempar error jika `tenantId` kosong
  - [x] Pasang router-level fail-closed middleware
- [x] `backend/src/routes/reservations.ts`:
  - [x] L13-14: Ubah `tenantWhere` agar melempar error jika `tenantId` kosong
  - [x] Pasang router-level fail-closed middleware
- [x] `backend/src/routes/purchaseOrders.ts`:
  - [x] L29, L58, L137, L187: Pasang guard `if (!tenantId) return 400` dan router-level guard
- [x] `backend/src/routes/kds.ts`:
  - [x] L19, L77, L131, L160: Pasang guard `if (!tenantId) return 400` dan router-level guard
- [x] `backend/src/routes/waste.ts`:
  - [x] L265-267: Pasang guard `if (!tenantId) return 400` pada analytics limbah
- [x] `backend/src/routes/shifts.ts`:
  - [x] L79-80, L642, L658: Pasang guard pada Z-report & query active shift

### 4. Bersihkan Sisa Pola `OR tenantId: null` pada Kategori
- [x] `backend/src/routes/categories.ts`:
  - [x] L46: Ganti `tenantCondition = tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}` menjadi `{ tenantId }`
  - [x] L140: Ganti `OR null` menjadi `{ tenantId }`
  - [x] L177: Ganti `OR null` menjadi `{ tenantId }`
  - [x] L22: Pada endpoint `/public`, tolak (400 MISSING_TENANT_CONTEXT) jika `tenantId` tidak ditemukan

### 5. Automated Testing & Verifikasi Regresi
- [x] Buat file test `backend/scripts/test_phase8_cross_tenant_realtime_and_failclosed.js`:
  1. Room Isolation: Event Socket.IO hanya diterima oleh room tenant yang bersangkutan (Zero io.emit di seluruh route)
  2. Zero loose OR tenantId null di seluruh route
  3. TenantContext returns undefined di luar context tenant (tidak mencemari runtime)
  4. Public categories tolak request tanpa tenant context (400)
  5. PWA Manifest tidak membocorkan branding Muki Ramen ke caller tanpa tenant
  6. Operational routes (Orders, Cashflow, Vouchers, Users, Settings) fail-closed 400 untuk token yatim
- [x] Jalankan test suite Phase 8: **6/6 PASSED (100%)**
- [x] Jalankan regresi lengkap Phase 1-7: **32/32 PASSED (100%)**
- [x] Total Uji Regresi Keseluruhan: **38/38 PASSED (100%)**
- [x] Kompilasi TypeScript `npx tsc --noEmit` & `npm run build` (Zero Errors)
- [x] Restart server backend dan verifikasi status health Socket.IO
