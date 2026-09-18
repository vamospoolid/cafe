# Phase 12: PostgreSQL Row-Level Security (RLS) Defense-in-Depth

## 🎯 Target & Tujuan
Mengimplementasikan perlindungan isolasi data pada lapisan paling mendalam (*kernel database level*) menggunakan fitur asli **PostgreSQL Row-Level Security (RLS)**. Dengan RLS, database PostgreSQL secara mandiri menolak pembacaan, modifikasi, dan penyisipan data antar-tenant bahkan jika aplikasi secara keliru mengeksekusi query raw SQL tanpa klausa `WHERE "tenantId" = ...`.

---

## 📋 Checklist Pekerjaan Phase 12

### 1. Database Migration & RLS Policy Definitions
- [x] **12.1.1** Buat script SQL migrasi `backend/prisma/rls_policies.sql`:
  - Mengaktifkan `ENABLE ROW LEVEL SECURITY` dan `FORCE ROW LEVEL SECURITY` pada seluruh 32 tabel bisnis:
    *Category, Product, Table, Reservation, Customer, PointLog, Order, CashFlow, Attendance, Settings, Shift, Supplier, Ingredient, IngredientLog, PurchaseOrder, Debt, DebtPayment, LeaveRequest, ShiftHandover, KitchenChecklist, WarehouseInbound, WarehouseRequisition, OwnerFundTransaction, WarehouseSale, EmployeeLoan, TenantPaymentConfig, AuditLog, UsageRecord, Subscription, Invoice, PaymentTransaction, TenantFeature*.
  - Menetapkan policy `tenant_isolation_policy` dengan aturan `USING` dan `WITH CHECK` berbasis parameter sesi `current_setting('app.current_tenant_id', true)`.
  - Mendukung bypass mode khusus `PLATFORM_SUPERADMIN` untuk operasional analitik platform SaaS.
- [x] **12.1.2** Buat migration runner `backend/src/scripts/apply_rls.ts` dan eksekusi pada PostgreSQL.
- [x] **12.1.3** Buat Application Role terisolasi `codepos_app` (Non-Superuser) dengan hak akses penuh ke schema `public` untuk memastikan penegakan aturan RLS kernel.

### 2. Transaction-Scoped Prisma RLS Hook
- [x] **12.2.1** Tambahkan fungsi helper `withTenantRLS<T>(tenantId, callback, prisma)` di `backend/src/utils/prismaTenant.ts`:
  - Mengeksekusi interactive transaction Prisma.
  - Mengatur `SET ROLE codepos_app;` dan `SET LOCAL app.current_tenant_id = '<tenantId>';` pada lifecycle transaksi.
  - Menjamin setiap query di dalam callback terisolasi 100% pada level kernel database PostgreSQL.
- [x] **12.2.2** Perluas daftar `TENANT_SCOPED_MODELS` di `prismaTenant.ts` agar mencakup seluruh model platform baru (*AuditLog, UsageRecord, Subscription, Invoice, PaymentTransaction, TenantFeature*).

### 3. Automated Verification & Isolation Testing
- [x] **12.3.1** Buat automated test suite `backend/test_phase12.js`.
- [x] **12.3.2** Jalankan pengujian dan verifikasi 100% lulus:
  - **Katalog PostgreSQL**: 32 dari 32 tabel bisnis berstatus `rowsecurity = true`.
  - **Kernel-Level Read Isolation**: Query `SELECT * FROM "Product"` tanpa klausa WHERE hanya mengembalikan produk milik tenant aktif sesi.
  - **Cross-Tenant Write Protection (`WITH CHECK`)**: Percobaan insert record milik Tenant B saat sesi diset ke Tenant A digagalkan oleh PostgreSQL kernel (`ERROR: 42501 new row violates row-level security policy`).
  - **Platform SuperAdmin Bypass**: Mode `PLATFORM_SUPERADMIN` dapat membaca seluruh dataset multi-tenant untuk analitik.
  - **withTenantRLS Helper**: Helper transaksi terintegrasi mulus dengan session RLS.
- [x] **12.3.3** Backend (`tsc`) dan Frontend (`vite build`) terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 13)
