# Master Todo & Architectural Specification: SaaS Developer Control Plane

Dokumen ini adalah acuan eksekusi modul **SaaS Developer Control Plane (`/platform-admin`)**, memisahkan secara tegas dashboard level Developer vs Tenant HQ, serta mengintegrasikan modul **Database Ops & Backup** dan **Tenant Warning & Broadcast Engine**.

---

## 🏗️ Peta Arsitektur Dua Tingkat (Dual-Plane)

```
                            [ PLATFORM CONTROL PLANE ]
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│    LEVEL 1: SAAS DEVELOPER ADMIN    │   │      LEVEL 2: TENANT CLIENT HQ      │
│  (Privat / admin.codenusa.id)       │   │  (Multi-Outlet / app.codenusa.id)   │
├─────────────────────────────────────┤   ├─────────────────────────────────────┤
│ • Financial Hub (MRR, ARR, ARPU)    │   │ • Konsolidasi Omset Antar Cabang    │
│ • Client & Tenant Provisioning      │   │ • Multi-Outlet Switcher             │
│ • Tier Pricing & Add-on Live Editor │   │ • Master Menu & Harga per Outlet    │
│ • Database Health & 1-Click Backup  │   │ • Gudang Pusat & Distribusi Cabang  │
│ • System Warning & Broadcast Engine │   │ • Absensi GPS & Karyawan Cabang     │
│ • Impersonation Engine (Shadow)     │   │ • Pembayaran Langganan SaaS Sendiri │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
```

---

## 📋 Master Todo List

### [x] FASE 1: Sidebar Layout & Navigation Shell (Frontend UX/UI) (COMPLETED ✅)
- [x] **1.1** Buat komponen **Sidebar Navigasi Modern** (`PlatformAdminSidebar.tsx`) dengan tema *Dark Slate & Indigo Glassmorphism*.
- [x] **1.2** Hubungkan 7 sub-menu navigasi:
  - 📊 **Financial Telemetry** (`overview`): MRR, ARR, ARPU, Invoices Chart, Revenue Breakdown.
  - 🏢 **Client & Tenant Hub** (`tenants`): Direktori Mitra, Status Badge, Search, Filter & Quick Actions.
  - 💎 **Pricing & Feature Matrix** (`plans`): Editor Tier, Biaya Add-on, dan Limit Kuota.
  - 💳 **Invoices & Midtrans** (`invoices`): Tagihan Platform, Verifikasi Bukti Transfer Manual.
  - 🗄️ **Database Ops & Backup** (`database`): Health Ping, Table Capacity, Safe Stream Backup.
  - ⚠️ **System Broadcast & Warning** (`warnings`): Broadcast banner ke kasir POS & dashboard tenant.
  - 📜 **Platform Audit Trail** (`logs`): Log seluruh aksi administratif developer.
- [x] **1.3** Perbarui layout header bar (`PlatformAdminLayout.tsx`): Latency ms, Live WIB Clock, DB Health, dan Back to POS shortcut.

---

### [x] FASE 2: Database Control, Metrics & Safe Backup Hub (COMPLETED ✅)
- [x] **2.1** Endpoint Backend `GET /api/platform-admin/database-stats`:
  - Hitung jumlah baris & estimasi ukuran tabel (`Order`, `Product`, `User`, `Tenant`, `Ingredient`, `AuditLog`).
  - Ambil engine info, pool connection status, dan database uptime.
- [x] **2.2** Endpoint Backend `GET /api/platform-admin/database-backup`:
  - Parameterized safe PostgreSQL / SQLite backup generation stream.
  - Pencatatan otomatis ke `AuditLog` saat backup dieksekusi.
- [x] **2.3** Frontend Component `SaaSDatabaseOpsAdmin.tsx`:
  - Kartu Metrik Database: Health Status, Total Rows, Latency, Engine.
  - Visual Breakdown Kapasitas Tabel dengan progress bar.
  - Tombol aksi: `[ Trigger Safe Backup .SQL ]` & `[ Clean Temporary Logs ]`.

---

### [x] FASE 3: System Warning & Tenant Broadcast Engine (COMPLETED ✅)
- [x] **3.1** In-memory & file-persisted registry untuk siaran pesan darurat (`BroadcastService.ts`).
  - Fields: `id`, `title`, `message`, `type` (`INFO`, `WARNING`, `DANGER`), `targetTenantId` (null = Global all tenants), `isActive`, `createdAt`.
- [x] **3.2** Backend API di `platformAdmin.ts`:
  - `POST /api/platform-admin/broadcasts`: Buat siaran baru.
  - `GET /api/platform-admin/broadcasts`: Ambil daftar siaran aktif.
  - `DELETE /api/platform-admin/broadcasts/:id`: Hentikan/hapus siaran.
  - `GET /api/platform-admin/active-broadcasts`: Endpoint untuk tenant mengambil banner aktif.
- [x] **3.3** Frontend Admin Component `SaaSWarningBroadcastAdmin.tsx`:
  - Form pembuatan broadcast dengan selector tipe warna & target tenant.
  - Tabel siaran aktif dengan toggle status dan tombol hapus.
- [x] **3.4** Integrasi Banner di Sisi Tenant (`Layout.tsx`):
  - Banner pengumuman dinamis di bagian atas layar POS kasir dan dashboard tenant jika ada pesan darurat/pemeliharaan.

---

### [x] FASE 4: Client & Tenant Deep-Inspector & Impersonation (COMPLETED ✅)
- [x] **4.1** Modal / Drawer `TenantDetailModal.tsx`:
  - Menampilkan ringkasan profil tenant, cabang aktif (alamat & GPS), daftar staf & role, kuota pemakaian, dan riwayat tagihan.
  - Tombol aksi cepat:
    - **Ubah Status**: `ACTIVE` ⟷ `GRACE_PERIOD` ⟷ `SUSPENDED` (Kill-switch).
    - **Ganti Tier Langganan**: Mengubah paket tenant secara langsung (`STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`).
    - **Tambah Add-on Override**: Memberikan custom feature add-on per tenant.
    - **Perpanjang Masa Aktif**: `+14 Hari` atau `+30 Hari`.
- [x] **4.2** Penguatan Fitur 1-Click Impersonation ("Login sebagai Tenant"):
  - Pembuatan temporary shadow token untuk masuk ke dashboard tenant dan kembali dengan 1 klik.
- [x] **4.3** Backend Endpoints di `platformAdmin.ts`:
  - `GET /api/platform-admin/tenants/:id/details`: Deep inspector data.
  - `POST /api/platform-admin/tenants/:id/change-plan`: Change tenant plan.
  - `POST /api/platform-admin/tenants/:id/override-feature`: Feature grant/revoke.

---

### [x] FASE 5: Master Tier Pricing & Add-on Live Configurator (COMPLETED ✅)
- [x] **5.1** Penyelarasan Tema & UX Komponen `SaaSPlatformPricingAdmin.tsx`:
  - Desain *Dark Slate & Indigo Glassmorphism* yang elegan.
  - Kartu tier paket (Starter, Growth, Business, Enterprise) dengan badge kuota dinamis.
  - Dialog modal edit harga & limit kuota (Monthly/Yearly pricing, Max Outlets, Max Users, Max Products).
- [x] **5.2** Matriks Fitur & Toggle Interaktif Real-Time:
  - Filter pills per modul (`ALL`, `POS`, `OPERATIONS`, `WAREHOUSE`, `HR`, `FINANCE`, `ADVANCED`).
  - Toggle button per modul fitur (✓ aktif, ✕ nonaktif) dengan proteksi `CORE` features.
- [x] **5.3** Backend Endpoints di `platformAdmin.ts`:
  - `GET /api/platform-admin/plans`: Katalog master paket.
  - `PUT /api/platform-admin/plans/:id`: Update tarif & batas kuota.
  - `GET /api/platform-admin/features`: Master registry modul sistem.
  - `POST /api/platform-admin/plans/:id/toggle-feature`: Buka/kunci fitur per tier.
- [x] **5.4** Verifikasi & Pengujian End-to-End:
  - Build backend (`npm run build`) & frontend (`npm run build`) 0 errors.
  - Verifikasi perubahan harga langsung tersinkronisasi di database PostgreSQL.
