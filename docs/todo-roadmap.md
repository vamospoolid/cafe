# Codenusa SaaS POS - Master Todo & Execution Roadmap

## 💎 Prinsip Desain & Estetika UX (Core UX Standards)
1. **Premium Modern Aesthetics**: Dark/Light mode elegan, glassmorphism halus, micro-animations yang responsif, palet warna berkelas (slate/emerald/indigo aksen), dan typography modern.
2. **Zero Clutter Context Switching**: Navigasi multi-tenant dan multi-outlet tanpa reload penuh, dengan transisi halus dan badge status yang jelas.
3. **Instant Feedback & Haptics**: Status loading skeleton, feedback sukses/gagal yang intuitif (toast notification), dan validasi form interaktif.
4. **Resilient POS Offline/Online Experience**: Indikator status jaringan, sinkronisasi otomatis background saat koneksi pulih, dan perlindungan keranjang transaksi.

---

## 📋 Master Phase-by-Phase TODO List

### [x] PHASE 1: Tenant Foundation & Core Schema Models (COMPLETED ✅)
- [x] **1.1** Tambahkan model `Tenant`, `Outlet`, `TenantMembership` pada Prisma Schema.
- [x] **1.2** Tambahkan model `Role`, `Permission`, `RolePermission`, `UserSession`, dan `TenantPaymentConfig`.
- [x] **1.3** Tambahkan relasi `tenantId` & `outletId` (nullable) ke seluruh 33 tabel bisnis existing.
- [x] **1.4** Sinkronisasi skema Prisma dan generate Prisma Client.
- [x] **1.5** Buat seed master tenant default (`MUKI RAMEN`), outlet pertama (`MUK-01`), 40 granular permissions, dan 7 system roles.

### [x] PHASE 2: User, Membership & Granular RBAC Engine (COMPLETED ✅)
- [x] **2.1** Refaktor autentikasi: satu User bisa memiliki membership di beberapa Tenant.
- [x] **2.2** Buat seed daftar granular permission keys (40 permissions: POS, KDS, inventory, reports, settings, dll).
- [x] **2.3** Buat seed default system roles (7 roles: `OWNER`, `ADMIN`, `MANAGER`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAREHOUSE`, `HR`).
- [x] **2.4** Buat middleware backend `requirePermission(permKey)` dan `requireRole(roleKey)`.
- [x] **2.5** Update UI Manajemen Karyawan (User Management) dengan selector role & permission matrix interaktif yang elegan.

### [x] PHASE 3: Database Tenant Isolation & Safe Data Backfill (COMPLETED ✅)
- [x] **3.1** Buat script data backfill otomatis: mengasosiasikan semua row data lama (produk, order, absensi, supplier, gudang) ke Master Tenant default.
- [x] **3.2** Ganti constraint `@unique` global menjadi composite unique per tenant:
  - `Product`: `@@unique([tenantId, barcode])`
  - `Customer`: `@@unique([tenantId, phone])`
  - `Order`: `@@unique([tenantId, orderNumber])` & `@@unique([tenantId, offlineId])`
  - `Table`: `@@unique([outletId, tableNo])`
  - `PurchaseOrder`: `@@unique([tenantId, poNumber])`
  - `WarehouseInbound`: `@@unique([tenantId, invoiceNumber])`
- [x] **3.3** Tambahkan composite indexes performa (`tenantId + createdAt`, `tenantId + outletId`, `tenantId + status`, `tenantId + date`).

### [x] PHASE 4: Tenant-Aware API & Service Layer Architecture (COMPLETED ✅)
- [x] **4.1** Buat `TenantResolverMiddleware` & `AsyncLocalStorage` context resolver (membaca tenant dari subdomain / token).
- [x] **4.2** Buat Prisma Client Extension (`prismaTenantExtension`) yang otomatis menginjeksi `where: { tenantId }` pada setiap query DB.
- [x] **4.3** Update seluruh 24 router Express backend agar menggunakan tenant context server-side secara konsisten.
- [x] **4.4** Update Socket.IO rooms: buat room scoping per tenant (`room:tenant_{tenantId}`) dan per outlet (`room:outlet_{outletId}`) agar event kasir/KDS tidak bocor ke tenant lain.

### [x] PHASE 5: Centralized Feature Registry & Entitlements (COMPLETED ✅)
- [x] **5.1** Tambahkan model `Feature` dan `PlanFeature` di Prisma Schema.
- [x] **5.2** Daftarkan modul fitur sistem (`pos`, `kds`, `inventory`, `warehouse`, `crm`, `attendance`, `payroll`, `loans`, `multi_outlet`).
- [x] **5.3** Buat `FeatureService` terpusat (`featureService.isEnabled(tenantId, featureKey)`).
- [x] **5.4** Buat Express middleware `requireFeature(featureKey)`.
- [x] **5.5** Buat React hook `useFeature(featureKey)` untuk mengatur visibilitas menu dan tombol di frontend secara dinamis.

### [x] PHASE 6: SaaS Plans, Add-ons & Tenant Feature Overrides (COMPLETED ✅)
- [x] **6.1** Tambahkan model `Plan` dan `TenantFeature` (Add-ons / Overrides).
- [x] **6.2** Seed paket bawaan: `STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`.
- [x] **6.3** Implementasikan logika resolusi fitur: Base Plan -> Add-ons -> Tenant Overrides -> Status Langganan.
- [x] **6.4** Bangun halaman antarmuka Admin Platform untuk mengelola fitur & addon per tenant.

### [x] PHASE 7: Subscription Lifecycle, Invoicing & Optional Midtrans Gateway (COMPLETED ✅)
- [x] **7.1** Tambahkan model `Subscription`, `SubscriptionItem`, `Invoice`, `TenantPaymentConfig`, dan `PaymentTransaction`.
- [x] **7.2** Bangun modul **Level 1 (SaaS Billing)**: Midtrans Snap / Manual Transfer untuk pembayaran paket langganan tenant.
- [x] **7.3** Bangun modul **Level 2 (Tenant POS BYOK)**: Pengaturan toggle opsional Midtrans di outlet tenant (Server Key/Client Key terenkripsi AES-256).
- [x] **7.4** Bangun webhook handler Midtrans dengan verifikasi Signature Key SHA-512 & mekanisme idempotency anti-replay.
- [x] **7.5** Bangun UI status billing, invoice history, dan switch metode pembayaran yang modern di pengaturan tenant.

### [x] PHASE 8: Usage Tracking, Quotas & Rate Limiting (COMPLETED ✅)
- [x] **8.1** Tambahkan model `UsageRecord` (tracking kuota outlet, user, transaksi, storage).
- [x] **8.2** Buat `QuotaService` untuk memvalidasi batas pembuatan outlet/user sebelum query create dijalankan.
- [x] **8.3** Terapkan rate limiter per tenant dan per IP pada endpoint publik dan endpoint sensitif.
- [x] **8.4** Buat UI progress bar pemakaian kuota (misal: "Outlets: 2/3 digunakan", "Staff: 8/10") yang informatif dan estetik.

### [x] PHASE 9: Tenant Onboarding & Multi-Tenant Frontend Navigation (COMPLETED ✅)
- [x] **9.1** Bangun wizard pendaftaran tenant baru (Onboarding Flow) dengan langkah-langkah visual yang bersih.
- [x] **9.2** Bangun komponen **Tenant & Outlet Switcher** di navbar/sidebar frontend dengan dropdown cantik dan avatar outlet.
- [x] **9.3** Implementasikan routing berbasis subdomain (`tenant-slug.codenusa.id`) dan fallback path selector.
- [x] **9.4** Pastikan Staff PWA dan Dine-In Table QR terintegrasi otomatis dengan tenant/outlet context.

### [x] PHASE 10: Immutable Audit Logging & Activity Trail (COMPLETED ✅)
- [x] **10.1** Tambahkan model `AuditLog` di Prisma Schema.
- [x] **10.2** Buat service `AuditLogger` yang mencatat aksi finansial, mutasi inventaris, void order, perubahan harga, dan aktivitas security.
- [x] **10.3** Bangun halaman antarmuka **Audit Trail Log** dengan filter tanggal, pencarian user, dan visualisasi perubahan nilai (old vs new value).

### [x] PHASE 11: DevSecOps Hardening & Security Protections (COMPLETED ✅)
- [x] **11.1** Perbaiki keamanan backup DB: ganti raw shell `exec(pg_dump)` dengan safe parameter stream.
- [x] **11.2** Isolasi folder upload file per tenant: `/uploads/tenants/:tenantId/:uuid.:ext` dengan verifikasi MIME type dan randomisasi nama file.
- [x] **11.3** Konfigurasi Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), dan CORS allowlist untuk subdomain Codenusa.
- [x] **11.4** Sanitasi input seluruh request payload untuk mencegah Mass Assignment dan XSS.

### [x] PHASE 12: PostgreSQL Row-Level Security (RLS) Defense-in-Depth (COMPLETED ✅)
- [x] **12.1** Tulis migration SQL untuk mengaktifkan RLS pada seluruh tabel bisnis.
- [x] **12.2** Buat policy `tenant_isolation_policy` berbasis `current_setting('app.current_tenant_id')`.
- [x] **12.3** Integrasikan transaction-scoped `SET LOCAL app.current_tenant_id` pada connection pool Prisma.

### [x] PHASE 13: Automated Security & Isolation Testing (COMPLETED ✅)
- [x] **13.1** Buat automated test suite: verifikasi Tenant A tidak bisa membaca atau memodifikasi data Tenant B.
- [x] **13.2** Buat test privilege escalation: pastikan Cashier tidak bisa mengakses payroll, analytics, atau platform settings.
- [x] **13.3** Buat test webhook forgery: pastikan payload Midtrans tanpa signature valid ditolak 100%.

### [x] PHASE 14: Backup, Monitoring & Observability (COMPLETED ✅)
- [x] **14.1** Buat script backup database otomatis harian dengan retensi dan enkripsi.
- [x] **14.2** Buat endpoint health check (`/api/health/deep`) yang memonitor status database, memory, dan socket pool.
- [x] **14.3** Dokumentasikan prosedur Restore & Disaster Recovery (RPO/RTO).

### [x] PHASE 15: Production Readiness & Zero-Impact VPS Deployment (COMPLETED ✅)
- [x] **15.1** Buat deployment script khusus ke folder `/var/www/codepos` di VPS (terpisah total dari `/var/www/poscafe`).
- [x] **15.2** Konfigurasi Nginx Server Block untuk `*.codenusa.id` dan SSL wildcard Let's Encrypt.
- [x] **15.3** Jalankan checklist verifikasi akhir dan pastikan sistem legacy `/var/www/poscafe` tetap berjalan tanpa gangguan.
