# Phase 8: Usage Tracking, Quotas & Rate Limiting

## 🎯 Target & Tujuan
Menerapkan sistem pelacakan penggunaan sumber daya (Usage Tracking), penegakan kuota secara ketat (Quota Enforcement) untuk batas outlet, staff, dan produk, serta proteksi laju request (Rate Limiting) per tenant/IP guna mencegah abuse dan brute-force.

---

## 📋 Checklist Pekerjaan Phase 8

### 1. Database Schema Model
- [x] **8.1.1** Tambahkan model `UsageRecord` (`tenantId`, `metric`, `period`, `currentValue`, `limitValue`) pada `backend/prisma/schema.prisma`.
- [x] **8.1.2** Hubungkan relasi `Tenant` dengan `UsageRecord`.
- [x] **8.1.3** Sinkronisasi database dengan `npx prisma db push` & `npx prisma generate`.

### 2. Quota Service & Interception Middleware
- [x] **8.2.1** Buat `backend/src/services/QuotaService.ts`:
  - `getUsageAndLimits(tenantId)`: Menghitung pemakaian real-time dan limit kuota paket.
  - `canCreateOutlet(tenantId)`: Validasi batas pembuatan outlet cabang.
  - `canCreateUser(tenantId)`: Validasi batas penambahan akun staff/karyawan.
  - `canCreateProduct(tenantId)`: Validasi batas penambahan menu/produk.
  - `trackUsage(tenantId, metric, current, limit)`: Pencatatan ke tabel `UsageRecord`.
- [x] **8.2.2** Buat Express middleware `backend/src/middlewares/quotaMiddleware.ts` (`requireQuota('outlet' | 'user' | 'product')`).
- [x] **8.2.3** Terapkan middleware `requireQuota('user')` pada `backend/src/routes/users.ts` (POST `/api/users`).
- [x] **8.2.4** Terapkan middleware `requireQuota('product')` pada `backend/src/routes/products.ts` (POST `/api/products`).

### 3. Rate Limiting Protection
- [x] **8.3.1** Terapkan `authLimiter` (30 req/15min) pada rute login & switch PIN.
- [x] **8.3.2** Terapkan `paymentLimiter` (60 req/15min) pada rute transaksi pembayaran Midtrans POS.
- [x] **8.3.3** Terapkan `analyticsLimiter` (60 req/15min) pada rute agregasi laporan analitik berat.

### 4. Verification & Testing
- [x] **8.4.1** Buat automated test suite `backend/test_phase8.js`.
- [x] **8.4.2** Jalankan test suite dan verifikasi 100% lulus:
  - Validasi batas kuota Enterprise (999 outlets / 999 users).
  - Validasi batas kuota Starter (1 outlet / 3 users / 100 products).
  - Penolakan pembuatan user ke-4 pada paket Starter (`allowed: false`, HTTP 403 `QUOTA_EXCEEDED`).
  - Pencatatan mutasi kuota pada `UsageRecord`.
- [x] **8.4.3** Backend dan frontend build terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 9)
