# Phase 9: Tenant Onboarding & Multi-Tenant Frontend Navigation

## 🎯 Target & Tujuan
Membangun alur pendaftaran mandiri bisnis baru (Self-Serve Tenant Onboarding Wizard) dan sistem navigasi multi-tenant / multi-outlet (Tenant & Outlet Switcher) di antarmuka frontend sehingga pengguna dapat mendaftarkan usaha baru dan berpindah cabang secara instan.

---

## 📋 Checklist Pekerjaan Phase 9

### 1. Backend Tenant Registration & Branch Switching API
- [x] **9.1.1** Buat endpoint `POST /api/auth/register-tenant`:
  - Validasi keunikan subdomain slug (`[slug].codenusa.id`) dan username.
  - Transaksi Prisma: Buat `Tenant`, `Outlet` utama, `User` Owner, `TenantMembership` dengan role `OWNER`, inisialisasi default categories, tables, settings, dan `TenantPaymentConfig`.
  - Auto-grant 14-day trial period.
  - Menghasilkan token JWT login langsung dengan tenant & outlet context terisolasi.
- [x] **9.1.2** Buat endpoint `POST /api/auth/switch-tenant`:
  - Validasi keanggotaan user di tenant tujuan.
  - Re-issue JWT token dengan `tenantId` dan role aktif tenant baru.
- [x] **9.1.3** Buat endpoint `POST /api/auth/switch-outlet`:
  - Memperbarui cabang aktif (`outletId`) dalam tenant yang sama tanpa perlu login ulang.

### 2. Frontend Onboarding Wizard & Switcher Navigation
- [x] **9.2.1** Buat `frontend/src/components/TenantRegisterWizard.tsx`:
  - **Step 1: Info Bisnis**: Nama Brand Kafe/Restoran & Subdomain Slug URL (`.codenusa.id`).
  - **Step 2: Outlet Pertama**: Nama Cabang & Kode Outlet unik.
  - **Step 3: Akun Pemilik**: Nama Owner, Username, Password, dan Quick PIN Kasir.
  - **Step 4: Pilihan Paket**: Pilihan paket awal (`STARTER`, `GROWTH`, `BUSINESS`) dengan 14 hari free trial.
- [x] **9.2.2** Buat `frontend/src/components/TenantOutletSwitcher.tsx`:
  - Dropdown navigasi multi-tenant dengan nama bisnis aktif, role badge, dan list seluruh akun bisnis yang dimiliki user.
  - Satu klik beralih tenant (`switch-tenant`) atau beralih cabang (`switch-outlet`).
  - Tombol "+ Daftarkan Usaha Baru" untuk memicu Onboarding Wizard.
- [x] **9.2.3** Integrasikan `TenantOutletSwitcher` ke dalam navbar sidebar `frontend/src/components/Layout.tsx`.

### 3. Verification & Testing
- [x] **9.3.1** Buat automated test suite `backend/test_phase9.js`.
- [x] **9.3.2** Jalankan test suite dan verifikasi 100% lulus:
  - Pendaftaran tenant baru secara transaksional dengan seeding data bawaan.
  - Resolusi JWT multi-tenant context.
  - Beralih cabang / outlet context switching.
- [x] **9.3.3** Backend dan frontend build terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 10)
