# TODO: Hardening Kategori & Katalog POS Multi-Tenant (Anti-IDOR, Offline Resilience, Real-Time & KDS Station Routing)

Dokumen pelacak progres implementasi perbaikan teknis mendalam berdasarkan standar [pos-category-catalog-hardening](file:///c:/ADATA/codepos/.agents/skills/pos-category-catalog-hardening/SKILL.md) untuk memastikan sistem kategori dan katalog produk multi-tenant di CodePOS aman dari IDOR, tahan kegagalan saat offline, tersinkronisasi real-time, dan terbebas dari regresi.

---

## 📋 DAFTAR TUGAS (TODO CHECKLIST)

### Fase 1: Keamanan & Integritas Data (Zero-IDOR & Cascade Soft-Delete)
- [x] **1.1** Perbaiki Validasi Cascade Soft-Delete di `backend/src/routes/categories.ts`:
  - Kumpulkan seluruh ID sub-kategori (`childCategories`) milik tenant.
  - Periksa apakah ada produk aktif yang masih mereferensikan `categoryId` maupun `subCategoryId` dari kategori induk atau anak-anaknya.
  - Tolak penghapusan (*fail-closed*) dengan pesan ramah jika masih ada produk aktif yang bergantung.
  - Gunakan `updateMany` atomik scoped per `tenantId` untuk menandai `deletedAt`.
- [x] **1.2** Eliminasi IDOR pada Restore Recycle Bin di `backend/src/routes/recycleBin.ts`:
  - Kunci kueri restore `CATEGORY` dengan `where: { id: numericId, tenantId }`.
  - Pastikan sub-kategori yang ikut dipulihkan juga terkunci dengan `where: { parentId: numericId, tenantId }`.
  - Periksa dan amankan entitas lainnya (`PRODUCT`, `INGREDIENT`, `TABLE`, `CUSTOMER`, `SUPPLIER`) dari kebocoran kueri `findUnique` tanpa tenant.
- [x] **1.3** Eliminasi IDOR & Mitigasi Crash P2003 pada Purge (Hard-Delete) di `backend/src/routes/recycleBin.ts`:
  - Validasi kepemilikan entitas terhadap `tenantId` aktif sebelum dihapus permanen.
  - Bersihkan referensi `subCategoryId` pada produk di keranjang sampah (`subCategoryId: null`) sebelum kategori dimusnahkan.
  - Tolak pemusnahan jika masih ada produk aktif yang mereferensikan kategori atau sub-kategori guna mencegah Prisma Foreign Key Constraint Failure (`P2003`).

---

### Fase 2: Real-Time Sync & Resiliensi Offline
- [x] **2.1** Tambahkan Broadcast Socket.IO Berlingkup Tenant di `backend/src/routes/categories.ts`:
  - Panggil `emitToTenant(io, tenantId, 'categories:updated', ...)` pada setiap operasi:
    - Tambah kategori baru (`POST /`)
    - Ubah atribut/warna/ikon (`PUT /:id`)
    - Hapus kategori (`DELETE /:id`)
    - Terapkan preset template industri (`POST /apply-preset`)
    - Batch reorder urutan kategori (`POST /reorder`)
- [x] **2.2** Tambahkan Socket Listener dengan Debounce di Frontend:
  - Pasang listener `categories:updated` pada `frontend/src/components/POSView.tsx` untuk auto-refresh tab kategori kasir.
  - Pasang listener `categories:updated` pada `frontend/src/components/KDSView.tsx` untuk auto-refresh stasiun dapur.
  - Terapkan debounce (minimal 300ms) untuk mencegah render storm saat batch updates.
- [x] **2.3** Hardening Resiliensi Offline Dexie IndexedDB di `frontend/src/db/offlineDb.ts`:
  - Perbarui interface `CachedCategory` agar menyertakan `color`, `sortOrder`, `stationTarget`, `isActive`, dan `subCategories`.
  - Simpan metadata lengkap saat `saveCatalogToCache`.
  - Terapkan *deterministic offline sorting* pada fungsi `getCachedCategories()`: urutkan array secara lokal berdasarkan `sortOrder ASC, name ASC` agar urutan tab kasir offline tetap 100% konsisten dengan server.

---

### Fase 3: Multi-Channel Enforcement & KDS Station Routing
- [x] **3.1** Enforcement Filter `isActive` Multi-Channel di `backend/src/routes/categories.ts`:
  - Pada `GET /api/categories`: Tambahkan dukungan parameter kueri `includeInactive=true`.
  - Default: Hanya kembalikan kategori yang `isActive: true` untuk kanal Kasir POS.
  - Tetap izinkan halaman Manajemen Produk/Pengaturan melihat kategori non-aktif jika menyertakan `includeInactive=true`.
- [x] **3.2** Routing Berbasis Stasiun Dapur di `frontend/src/components/KDSView.tsx`:
  - Perbarui dropdown selector stasiun di header KDS:
    - Opsi Stasiun Utama: **Semua Stasiun (ALL)**, **Dapur Utama (KITCHEN)**, **Barista / Bar (BAR)**, **Panggang / Grill (GRILL)**, **Dessert & Pastry (DESSERT)**.
    - Opsi Sub-Grup: Kategori spesifik individual.
  - Filter item pesanan berdasarkan `stationTarget` kategori produk (dengan fallback legacy `printerTarget`).

---

### Fase 4: Pengujian, Validasi & Anti-Regresi Menyeluruh
- [x] **4.1** Buat Automated Test Script `backend/scripts/test_category_catalog_hardening.js`:
  - **Uji 1**: Cascade Child Check — Tolak soft-delete kategori induk jika sub-kategorinya memiliki produk aktif.
  - **Uji 2**: Cross-Tenant Restore Check — Pastikan Tenant B ditolak (404) saat mencoba merestore kategori milik Tenant A.
  - **Uji 3**: Cross-Tenant Purge Check — Pastikan Tenant B ditolak (404/403) saat mencoba memusnahkan kategori milik Tenant A.
  - **Uji 4**: Mitigasi Crash P2003 — Memusnahkan kategori yang bersih tidak boleh melempar error constraint PostgreSQL/Prisma.
  - **Uji 5**: Filter `isActive` — Pastikan kategori non-aktif tersembunyi dari kueri standar kasir.
  - **Uji 6**: Offline Sort Order — Pastikan sorting lokal Dexie mengembalikan urutan yang identik dengan server.
  - *Hasil: 6/6 Uji Otomatis Lolos (ALL PASSED)*.
- [x] **4.2** Validasi Kompilasi Kode (TypeScript & Vite):
  - Backend `npx tsc`: Lolos 0 error (Exit code 0).
  - Frontend `npm run build`: Lolos 0 error (`built in 5.13s`, Exit code 0).
- [x] **4.3** Verifikasi Manual & Dokumentasi:
  - Seluruh alur diuji aman dari IDOR, crash P2003, dan regresi antarmuka.
  - Dokumentasikan hasil pengujian dan perubahan di [walkthrough.md](file:///C:/Users/Balanipastudio/.gemini/antigravity-ide/brain/2340fa67-37e7-46c4-85f2-7d7990e02165/walkthrough.md).
