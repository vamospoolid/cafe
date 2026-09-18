# Phase 6: SaaS Plans, Add-ons & Tenant Feature Overrides

## 🎯 Target & Tujuan
Menyediakan sistem manajemen paket SaaS (Tiered Plans), monitoring kuota pemakaian sumber daya (outlets, users, menu items), pengelolaan add-on modul, serta antarmuka UI interaktif yang elegan untuk pemilik bisnis (Tenant Owner) dan Platform Admin.

---

## 📋 Checklist Pekerjaan Phase 6

### 1. Model SaaS Plans & Database Entities
- [x] **6.1.1** Model `Plan`, `PlanFeature`, dan `TenantFeature` terhubung di Prisma Schema.
- [x] **6.1.2** Seed 4 paket SaaS bawaan:
  - `STARTER` (Paket UMKM): 1 Outlet, 3 User, 100 Produk (Fitur Inti POS, Kasir, Cashflow).
  - `GROWTH` (Paket Berkembang): 2 Outlet, 10 User, 500 Produk (KDS, Tables, Reservations, Recipe Costing, CRM Loyalty, Absensi GPS).
  - `BUSINESS` (Paket Lengkap): 5 Outlet, 30 User, 2000 Produk (Central Warehouse, Payroll, Kasbon, Advanced Analytics, Debts, Multi-Outlet).
  - `ENTERPRISE` (Skala Besar): Tanpa batas outlet & user, semua 16 fitur aktif.

### 2. Backend Plans & Add-on API Endpoints
- [x] **6.2.1** `POST /api/features/change-plan`: Endpoint untuk mengganti tier paket langganan tenant secara real-time.
- [x] **6.2.2** `POST /api/features/override`: Endpoint untuk memberikan (grant) atau mencabut (revoke) add-on fitur kustom per tenant.
- [x] **6.2.3** `GET /api/features/tenants-overview`: Endpoint agregasi data seluruh tenant, paket aktif, dan kuota untuk Platform Admin.
- [x] **6.2.4** `GET /api/features/tenant-plan`: Endpoint detail paket, batas limit, dan pemakaian real-time tenant saat ini.

### 3. Frontend SaaS Subscription & Feature Add-ons Manager UI
- [x] **6.3.1** Buat komponen modern `frontend/src/components/SaaSPlanManager.tsx`:
  - **Hero Overview Card**: Badge paket aktif (`ENTERPRISE`/`BUSINESS`/dll), status langganan, dan tombol sinkronisasi.
  - **Quota Progress Meters**: Progress bar visual untuk pemakaian Outlets, Akun Staff, dan Produk terhadap kuota paket.
  - **Pricing & Plan Switcher**: Grid 4 kartu paket interaktif dengan toggle siklus tagihan Bulanan / Tahunan (Diskon 17%) dan tombol "Pilih Paket".
  - **Feature Matrix & Add-on Overrides**: Matriks 16 fitur sistem dengan filter modul (`POS`, `OPERATIONS`, `WAREHOUSE`, `HR`, `FINANCE`, `ADVANCED`), badge status (`Fitur Inti`, `Aktif`, `Terkunci`), dan tombol toggle Add-on instan.
- [x] **6.3.2** Integrasikan tab `saas_plan` ("Paket & Add-on SaaS") ke dalam `frontend/src/components/SettingsView.tsx`.

### 4. Verification & Testing
- [x] **6.4.1** Jalankan automated test suite `backend/test_phase5.js` & verifikasi fungsionalitas pergantian plan dan override add-on.
- [x] **6.4.2** Backend TypeScript build terverifikasi 0 error (`npm run build`).
- [x] **6.4.3** Frontend Vite build terverifikasi 0 error (`npm run build`).

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 7)
