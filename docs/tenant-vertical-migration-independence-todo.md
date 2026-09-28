# TODO: Independensi & Migrasi Multi-Tenant serta Vertikal (Kafe vs Bengkel)

Dokumen rencana kerja teknis untuk mengeliminasi kebocoran cache lokal Dexie, memperbaiki asimetri backup dan reset toko, menyediakan modul transisi profil vertikal, serta menstandarkan redaksi dan UX switching multi-tenant di CodePOS.

---

## Fase 1: Isolasi Storage Lokal & Keamanan Switch Tenant (Frontend Dexie)
> **Tujuan**: Mencegah kebocoran data katalog antar tenant di browser yang sama dan mengamankan antrean sinkronisasi offline.

- [x] **1.1. Partisi Kueri Dexie dengan Tenant ID**
  - File: `frontend/src/db/offlineDb.ts`
  - Perbarui method `getCachedProducts`, `getCachedCategories`, `getCachedTables`, `getCachedSettings` agar menerima parameter `tenantId?: string`.
  - Pastikan kueri membaca dengan klausa `.where('tenantId').equals(tenantId)` jika `tenantId` tersedia.
- [x] **1.2. Pre-Switch Offline Guard di TenantOutletSwitcher**
  - File: `frontend/src/components/TenantOutletSwitcher.tsx`
  - Sebelum memanggil endpoint `/api/auth/switch-tenant`, periksa jumlah antrean transaksi di Dexie (`offlineDb.getAllPendingOrdersCount()`).
  - Jika ada pesanan offline yang belum tersinkronisasi, tampilkan modal peringatan konfirmasi agar kasir tidak kehilangan atau salah menyinkronkan data transaksi.
- [x] **1.3. Pembersihan Cache Atomik Saat Beralih Tenant**
  - File: `frontend/src/components/TenantOutletSwitcher.tsx` & `frontend/src/context/POSContext.tsx`
  - Eksekusi pembersihan cache katalog lokal (`offlineDb.clearCatalogCache()`, dsb.) dan reset cart belanja lokal tepat saat peralihan tenant berhasil sebelum melakukan reload.
- [x] **1.4. Lencana Visual Vertikal di Switcher**
  - File: `frontend/src/components/TenantOutletSwitcher.tsx`
  - Tampilkan icon & badge tipe bisnis di dropdown daftar outlet/tenant (contoh: ☕ `KAFE`, 🔧 `BENGKEL`, 🛍️ `RETAIL`).

---

## Fase 2: Paritas Skema Backup & Disaster Recovery (Backend)
> **Tujuan**: Memastikan data operasional Bengkel (SPK, kendaraan, mekanik, komisi) ikut tercadangkan 100% secara utuh.

- [x] **2.1. Ekspor Snapshot JSON Simetris**
  - File: `backend/src/routes/database.ts` & `backend/src/services/BackupService.ts`
  - Tambahkan entitas vertikal bengkel ke fungsi `exportPrismaJsonBackup` dan `BackupService`:
    - `workOrder`, `workOrderPart`, `workOrderService`, `workOrderInvoice`
    - `vehicle`, `serviceType`, `mechanicProfile`, `commissionPayout`
  - Sertakan `businessType` di metadata file backup JSON (`metadata.businessType`).
- [x] **2.2. Validasi & Hitungan Entitas Database Info**
  - File: `backend/src/routes/database.ts`
  - Pada endpoint `GET /api/database/info`, sertakan metrik jumlah SPK (`workOrdersCount`), kendaraan (`vehiclesCount`), dan mekanik (`mechanicsCount`) serta `businessType` tenant.

---

## Fase 3: Paritas Modul Reset Tenant & Penyetelan Template Vertikal
> **Tujuan**: Memungkinkan tenant Bengkel mereset transaksi uji coba atau factory reset secara aman tanpa error foreign key.

- [x] **3.1. Penyesuaian Reset Transaksi Simulasi**
  - File: `backend/src/routes/tenantReset.ts`
  - Pada `POST /api/tenant-reset/transactions`, tambahkan penghapusan entitas transaksi bengkel:
    - `workOrderInvoice`, `workOrderReturnItem`, `workOrderReturn`, `workOrderPart`, `workOrderService`, `workOrder`
    - `commissionPayout`
    - Reset `pendingCommission` pada `mechanicProfile` ke 0.
- [x] **3.2. Penyesuaian Factory Reset Total**
  - File: `backend/src/routes/tenantReset.ts`
  - Pada `POST /api/tenant-reset/full`, bersihkan seluruh entitas bengkel (`workOrder`, `vehicle`, `serviceType`, `mechanicProfile`) sebelum menghapus katalog produk untuk mencegah pelanggaran foreign key `onDelete: SetNull`.
- [x] **3.3. Penambahan Starter Template Industri Otomotif**
  - File: `backend/src/routes/tenantReset.ts`
  - Tambahkan template bengkel di `STARTER_TEMPLATES`:
    - `BENGKEL_MOTOR_UMUM`: Kategori oli, kampas rem, ban, busi, aki + 5 jenis jasa servis dasar.
    - `BENGKEL_MOBIL_DAN_AC`: Kategori oli mesin, filter udara, freon, brake cleaner + jasa servis mobil.

---

## Fase 4: Transisi & Migrasi Vertikal Terpandu (Kafe $\leftrightarrow$ Bengkel)
> **Tujuan**: Menyediakan alur resmi jika tenant ingin berganti model bisnis tanpa merusak integritas finansial.

- [x] **4.1. Endpoint Migrasi Vertikal di Backend**
  - File: `backend/src/routes/settings.ts`
  - Buat endpoint `POST /api/settings/migrate-vertical`:
    - Proteksi role: Hanya `OWNER` atau `PLATFORM_ADMIN` dengan verifikasi kata sandi.
    - Opsi A (*Clean Pivot*): Arsipkan transaksi lama, nonaktifkan kategori lama, buat kategori dan master jasa bawaan vertikal baru.
    - Invalidate cache `cache:tenant:businessType:${tenantId}` dan `invalidateTenantCache`.
    - Catat riwayat perubahan ke `AuditLogger`.
- [x] **4.2. Eliminasi printerTarget KITCHEN pada Seed Bengkel**
  - File: `backend/src/routes/auth.ts`
  - Ubah inisialisasi kategori awal bengkel saat pendaftaran tenant dari `printerTarget: 'KITCHEN'` menjadi `printerTarget: 'NONE'`.

---

## Fase 5: Redaksi, Copywriting & Preset Onboarding Otomotif
> **Tujuan**: Menghilangkan seluruh residu istilah F&B saat mengelola bengkel dan memperkaya antarmuka pendaftaran cepat.

- [x] **5.1. Normalisasi Redaksi Pesan Notifikasi & Modal**
  - File: `backend/src/routes/tenantReset.ts`
  - Ganti pesan respons reset: dari `"Daftar menu & bahan baku tetap aman"` menjadi pesan netral/adaptif: `"Master data produk & layanan tetap aman"`.
  - File: `backend/src/middlewares/requireBusinessType.ts`
  - Ubah teks penolakan akses menjadi ramah dan edukatif.
- [x] **5.2. Dukungan Vertikal pada Quick Provisioning Modal**
  - File: `frontend/src/components/QuickProvisionModal.tsx` & `backend/src/routes/fastProvisioning.ts`
  - Tambahkan pemilih vertikal pada Langkah 1 (Kafe vs Bengkel).
  - Ganti password default statis `kopi12345` dengan password acak aman (`Aman${tahun}!`).
  - Tambahkan preset menu bengkel di backend `fastProvisioning.ts`.

---

## Fase 6: Validasi & Pengujian End-to-End
> **Tujuan**: Memastikan seluruh skenario bebas regresi dan stabil.

- [x] **6.1. Uji Multi-Tenant Storage Isolation**
  - Pemisahan data IndexedDB via Dexie multi-tenant compound index (`tenantId`) teruji aman, switch tenant membersihkan cache katalog.
- [x] **6.2. Uji Backup & Restore Bengkel**
  - Script `test_phase2_backup_parity.js` berhasil mengekspor seluruh 8 entitas bengkel ke dalam payload backup JSON tanpa celah.
- [x] **6.3. Uji Reset Transaksi Bengkel**
  - Script `test_phase3_tenant_reset_parity.js` berhasil memvalidasi reset transaksi bengkel (pembersihan invoice, return, parts, SPK, komisi mekanik) dan template starter otomotif.
- [x] **6.4. Frontend & Backend Build Typecheck**
  - Backend `tsc` (exit code 0) dan Frontend `tsc -b && vite build` (exit code 0) 100% lulus kompilasi bersih tanpa regresi.
