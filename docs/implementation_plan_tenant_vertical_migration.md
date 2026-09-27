# Implementation Plan: Independensi & Migrasi Multi-Tenant serta Vertikal (Kafe vs Bengkel)
## CodePOS B2B Multi-Tenant SaaS Platform

---

## 1. Ringkasan Eksekutif & Tujuan (Goal)

Sistem CodePOS melayani beragam jenis vertikal bisnis (`CAFE`, `BENGKEL`, `RETAIL`, `LAUNDRY`). Rencana implementasi ini bertujuan untuk:
1. **Menghilangkan Kebocoran Storage Lokal (Dexie IndexedDB)**: Memastikan setiap pembacaan katalog dan antrean offline terisolasi ketat per `tenantId`, serta memvalidasi antrean offline sebelum kasir beralih tenant.
2. **Mencapai Paritas Skema Backup & Reset**: Menjamin data operasional vertikal Bengkel (`WorkOrder`, `Vehicle`, `MechanicProfile`, `ServiceType`, `CommissionPayout`) tercadangkan 100% dan dapat di-reset secara atomik tanpa melanggar foreign key constraint.
3. **Menyediakan Engine & Wizard Migrasi Vertikal**: Memungkinkan pemilik usaha berpindah tipe vertikal (misal: Kafe ke Bengkel) secara terpandu, aman, dan tanpa merusak histori transaksi finansial.
4. **Membersihkan Kebocoran Redaksi & Memperkaya UX**: Mengeliminasi residu terminologi F&B (`printerTarget: 'KITCHEN'`, password `kopi12345`, teks reset "menu & resep") dan menambahkan lencana visual vertikal di switcher serta preset otomotif di Quick Provisioning.

---

## 2. Struktur Modul & File yang Dilibatkan

```
backend/src/
├── routes/
│   ├── database.ts                 <- Tambah entitas Bengkel ke exportPrismaJsonBackup & /info
│   ├── tenantReset.ts              <- Simetris reset WorkOrder, hapus FK conflict, tambah template Bengkel
│   ├── auth.ts                     <- Eliminasi printerTarget: 'KITCHEN' pada seed awal kategori bengkel
│   ├── fastProvisioning.ts         <- Tambah preset Bengkel (Oli, Servis, Sparepart) & businessType selector
│   └── settings.ts                 <- Endpoint POST /api/tenant/migrate-vertical (Audit & Cache Invalidation)
└── middlewares/
    └── requireBusinessType.ts       <- Redaksi penolakan akses yang ramah & edukatif

frontend/src/
├── db/
│   └── offlineDb.ts                <- Partisi tenantId pada getCachedProducts, getCachedCategories, dll.
├── components/
│   ├── TenantOutletSwitcher.tsx    <- Lencana badge vertikal, pre-switch offline check, atomic cache flush
│   ├── QuickProvisionModal.tsx     <- Selector vertikal di Step 1, preset otomotif, password acak aman
│   └── VerticalMigrationModal.tsx  <- [Baru] Wizard terpandu transisi tipe bisnis Kafe <-> Bengkel
└── context/
    └── POSContext.tsx              <- Penanganan flush storage lokal terkoordinasi
```

---

## 3. Rincian Tahapan Eksekusi (Phase by Phase)

### Fase 1: Isolasi Storage Lokal & Keamanan Switch Tenant (Frontend Dexie)
* **Tujuan**: Mencegah kebocoran data produk/katalog antar-tenant di browser kasir dan mengamankan antrean transaksi offline.
* **Tindakan Teknis**:
  1. Di `frontend/src/db/offlineDb.ts`:
     * Modifikasi `getCachedProducts(tenantId?: string)`:
       ```typescript
       async getCachedProducts(tenantId?: string): Promise<CachedProduct[]> {
         let collection = this.cachedProducts.toCollection();
         if (tenantId) {
           collection = this.cachedProducts.where('tenantId').equals(tenantId);
         }
         const list = await collection.toArray();
         return list.map(p => ({
           ...p,
           price: Number(p.sellPrice ?? p.price ?? 0),
           sellPrice: Number(p.sellPrice ?? p.price ?? 0)
         }));
       }
       ```
     * Terapkan pola yang sama pada `getCachedCategories` dan `getCachedTables`.
  2. Di `frontend/src/components/TenantOutletSwitcher.tsx`:
     * Tambahkan pemeriksaan `const pendingCount = await offlineDb.getAllPendingOrdersCount();` sebelum fetch `/api/auth/switch-tenant`.
     * Jika `pendingCount > 0`, munculkan dialog konfirmasi bahaya sinkronisasi.
     * Setelah respon switch berhasil, bersihkan tabel Dexie katalog (`clearAllCache()`) sebelum memanggil `window.location.reload()`.
     * Tampilkan icon & lencana vertikal di samping nama outlet (contoh: ☕ `KAFE & RESTO`, 🔧 `BENGKEL MOTOR/MOBIL`, 🛍️ `RETAIL`).

---

### Fase 2: Paritas Skema Backup & Disaster Recovery (Backend)
* **Tujuan**: Memastikan data Bengkel ikut terunduh dalam file snapshot JSON backup.
* **Tindakan Teknis**:
  1. Di `backend/src/routes/database.ts`:
     * Pada fungsi `exportPrismaJsonBackup`:
       * Tambahkan kueri paralel untuk: `workOrder`, `workOrderPart`, `workOrderService`, `workOrderInvoice`, `vehicle`, `serviceType`, `mechanicProfile`, `commissionPayout`.
       * Sertakan data tersebut ke dalam payload `snapshot.data`.
       * Tambahkan `metadata.businessType` untuk mempermudah deteksi vertikal saat restore.
  2. Pada endpoint `GET /api/database/info`:
     * Jika tenant bertipe `BENGKEL`, sertakan statistik `workOrdersCount` dan `vehiclesCount`.

---

### Fase 3: Paritas Modul Reset Tenant & Penyetelan Template Vertikal (Backend)
* **Tujuan**: Memberikan kemampuan reset simulasi dan factory reset yang aman bagi tenant Bengkel.
* **Tindakan Teknis**:
  1. Di `backend/src/routes/tenantReset.ts`:
     * Pada `POST /api/tenant-reset/transactions`:
       * Tambahkan penghapusan: `commissionPayout`, `workOrderInvoice`, `workOrderReturnItem`, `workOrderReturn`, `workOrderPart`, `workOrderService`, `workOrder`.
       * Reset akumulasi komisi pending mekanik: `mechanicProfile.updateMany({ where: { tenantId }, data: { pendingCommission: 0 } })`.
       * Sesuaikan redaksi respon JSON: `"Riwayat transaksi simulasi berhasil dibersihkan. Master data produk & layanan tetap aman."`
     * Pada `POST /api/tenant-reset/full`:
       * Hapus entitas transaksi dan profil bengkel sebelum menghapus `Product` dan `Category` guna mencegah error foreign key `onDelete: SetNull`.
     * Pada `STARTER_TEMPLATES`:
       * Tambahkan template `BENGKEL_MOTOR_UMUM` (kategori Oli & Pelumas, Ban & Kaki-kaki, Suku Cadang Mesin, Kelistrikan + Layanan Servis Rutin & Tune Up).
       * Tambahkan template `BENGKEL_MOBIL_DAN_AC`.

---

### Fase 4: Engine & UI Wizard Migrasi Vertikal (Kafe $\leftrightarrow$ Bengkel)
* **Tujuan**: Menyediakan mekanisme resmi pergantian model bisnis.
* **Tindakan Teknis**:
  1. Di `backend/src/routes/settings.ts`:
     * Buat endpoint `POST /api/settings/migrate-vertical`:
       * Validasi: Hanya role `OWNER` dengan password akun yang valid.
       * Parameter: `targetBusinessType` (`'CAFE' | 'BENGKEL'`), `migrationStrategy` (`'CLEAN_PIVOT' | 'KEEP_DATA'`).
       * Jika `CLEAN_PIVOT`: Nonaktifkan kategori lama (`isActive: false`), inisialisasi kategori & layanan bawaan vertikal baru.
       * Update `Tenant.businessType` di database.
       * Panggil `invalidateTenantCache(tenantId)` dan hapus cache `cache:tenant:businessType:${tenantId}`.
       * Catat audit log: `TENANT_VERTICAL_MIGRATED`.
  2. Di `backend/src/routes/auth.ts`:
     * Perbaiki seed awal kategori bengkel: ubah `printerTarget: 'KITCHEN'` menjadi `printerTarget: 'NONE'`.
  3. Di Frontend:
     * Buat modal/kartu pengaturan **"Ubah Jenis Bisnis / Migrasi Profil"** di tab Pengaturan Toko.

---

### Fase 5: Redaksi, Copywriting & Preset Onboarding Otomotif
* **Tujuan**: Menghilangkan seluruh bias F&B dan menyediakan onboarding ramah bengkel.
* **Tindakan Teknis**:
  1. Di `backend/src/middlewares/requireBusinessType.ts`:
     * Ubah pesan error penolakan: `"Modul ini dirancang khusus untuk jenis usaha [X]. Akun Anda terdaftar dengan profil [Y]. Hubungi admin atau akses Pengaturan untuk mengubah profil bisnis."`
  2. Di `frontend/src/components/QuickProvisionModal.tsx` & `backend/src/routes/fastProvisioning.ts`:
     * Langkah 1: Tambahkan pemilihan jenis vertikal (`Kafe` vs `Bengkel`).
     * Jika memilih Bengkel:
       * Gunakan preset otomotif (`bengkel_motor`, `bengkel_mobil`).
       * Sembunyikan istilah "Menu", ganti dengan "Suku Cadang & Jasa Servis".
       * Ganti password default statis `kopi12345` menjadi generator kata sandi acak aman (`Bengkel2026!`).

---

## 4. Rencana Pengujian & Kriteria Keberhasilan (Acceptance Criteria)

| Skenario Pengujian | Langkah Pengujian | Kriteria Keberhasilan |
|---|---|---|
| **1. Isolasi Dexie Lintas Tenant** | Login Tenant Kafe $\rightarrow$ Beralih ke Tenant Bengkel via Switcher $\rightarrow$ Matikan internet $\rightarrow$ Buka Kasir POS | Produk Kafe tidak muncul sama sekali di POS Bengkel. |
| **2. Pre-Switch Offline Guard** | Buat 1 order offline di Tenant A $\rightarrow$ Coba switch ke Tenant B | Muncul modal peringatan konfirmasi transaksi belum tersinkronisasi. |
| **3. Paritas Backup Bengkel** | Buat 2 SPK & 1 Mekanik di Tenant Bengkel $\rightarrow$ Unduh Backup JSON | File backup memuat key `workOrders`, `vehicles`, dan `mechanicProfiles`. |
| **4. Paritas Reset Bengkel** | Jalankan Reset Transaksi pada Tenant Bengkel | Data SPK terhapus, komisi mekanik ter-reset ke 0, namun master sparepart & jasa tetap utuh. |
| **5. Registrasi Bengkel Bersih** | Daftarkan tenant baru tipe Bengkel | Kategori default memiliki `printerTarget: 'NONE'` (bukan `KITCHEN`). |
| **6. Build Verification** | Jalankan `npm run build` di frontend dan `npx tsc --noEmit` di backend | Kedua modul berhasil dikompilasi dengan exit code 0. |

---

## 5. Strategi Rollback & Manajemen Risiko

1. **Pencadangan Pra-Migrasi Otomatis**: Endpoint migrasi vertikal otomatis mengeksekusi `backupService.createDatabaseBackup('TENANT', tenantId)` sebelum mengeksekusi perubahan skema di database.
2. **Zero-Regression Kafe Guarantee**: Seluruh perbaikan menggunakan kondisional adaptif `if (businessType === 'BENGKEL')` atau hook terpusat `useVertical()`. Tidak ada tabel atau relasi Kafe (`RecipeItem`, `Ingredient`, `Table`, `KDS`) yang diubah struktur dasarnya.
