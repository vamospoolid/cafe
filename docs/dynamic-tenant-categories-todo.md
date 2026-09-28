# TODO: Sistem Kategori Menu Dinamis & Adaptif Multi-Tenant (Kafe, Resto & Bakery)

Dokumen pelacak progres implementasi fitur kategori menu dinamis, preset industri, kustomisasi visual (emoji & warna), urutan prioritas di kasir, dan stasiun routing dapur di CodePOS.

---

## 📋 DAFTAR TUGAS (TODO CHECKLIST)

### Fase 1: Database Schema & Migration
- [x] **1.1** Perbarui model `Category` di `backend/prisma/schema.prisma`:
  - Tambahkan `icon` (String, default: "🍽️").
  - Tambahkan `color` (String, default: "#4f46e5").
  - Tambahkan `sortOrder` (Int, default: 0).
  - Tambahkan `stationTarget` (String, default: "KITCHEN").
  - Tambahkan `isActive` (Boolean, default: true).
  - Tambahkan indeks performa `@@index([tenantId, sortOrder])`.
- [x] **1.2** Jalankan sinkronisasi database:
  - Eksekusi `npx prisma db push` & `npx prisma generate`.

### Fase 2: Backend Core & API Endpoints
- [x] **2.1** Buat pustaka template industri `backend/src/utils/categoryPresets.ts`:
  - Template Kafe / Coffee Shop (*Espresso, Manual Brew, Signature Drinks, Non-Coffee, Pastry, Snacks*).
  - Template Restoran / Dine-In (*Appetizer, Main Course Daging/Ayam, Seafood, Nasi & Mie, Sup & Sayur, Dessert, Minuman*).
  - Template Bakery / Toko Roti (*Roti Manis & Savory, Artisan Sourdough, Cakes & Tarts, Cookies, Minuman Pendamping*).
  - Ekspor fungsi pembantu `applyPresetToTenant` yang reusable dan terisolasi ketat.
- [x] **2.2** Perbarui route `backend/src/routes/categories.ts`:
  - Endpoint `POST /api/categories/apply-preset`: Menerapkan preset kategori ke tenant secara atomik tanpa menghapus produk eksisting.
  - Endpoint `POST /api/categories/reorder`: Batch update `sortOrder` kategori untuk tenant aktif dengan anti-IDOR transaction.
  - Perbarui `GET /api/categories`: Mengurutkan berdasarkan `sortOrder ASC, name ASC` dan menyertakan field `icon`, `color`, `sortOrder`, `stationTarget`.
  - Perbarui `POST /api/categories` & `PUT /api/categories/:id`: Menerima dan memvalidasi `icon`, `color`, `sortOrder`, `stationTarget`, serta validasi `parentId` milik tenant aktif.
  - Perbaiki `backend/src/routes/products.ts`: Menambahkan `tenantId` pada pembuatan produk serta validasi kepemilikan `categoryId` & `subCategoryId` per tenant.

### Fase 3: Frontend Manajemen & Visualisasi Kasir
- [x] **3.1** Modifikasi `frontend/src/components/CategoryModal.tsx`:
  - Tambahkan tombol aksi **"Terapkan Template Industri"** dengan modal pilihan (Kafe / Restoran / Bakery).
  - Tambahkan **Emoji Picker** (pilihan ikon makanan, kopi, camilan, hidangan penutup) dan color swatch aksen visual.
  - Tambahkan pemilih **Stasiun Dapur / Printer Routing** (*Dapur Utama, Barista/Bar, Panggang/Grill, Dessert, Kasir*).
  - Tambahkan tombol / kontrol **Urutan Tampil (Sort Order)** dengan tombol panah Naik/Turun dan input numerik.
- [x] **3.2** Modifikasi `frontend/src/components/POSView.tsx` & `DineInView.tsx`:
  - Baca dan prioritaskan `category.icon` dan `category.color` untuk tab kategori kasir dan subkategori.
  - Tampilkan tab kategori di kasir terurut rapi berdasarkan `sortOrder` tenant.
  - Terapkan juga ikon kategori pada tampilan menu pelanggan Dine-in via QR (`DineInView.tsx`).

### Fase 4: Pengujian & Validasi Menyeluruh
- [x] **4.1** Buat automated test script `backend/scripts/test_dynamic_tenant_categories.js`:
  - Uji penerapan preset Kafe vs Restoran antar tenant yang terisolasi 100% (7 kategori vs 5 kategori).
  - Uji reorder `sortOrder` per tenant tanpa memengaruhi tenant lain.
  - Uji pencegahan cross-tenant injection pada `parentId` dan `categoryId` (Anti-IDOR).
  - Semua 7 tes otomatis berhasil lolos (`ALL 7 AUTOMATED VERIFICATION TESTS PASSED`).
- [x] **4.2** Jalankan validasi kompilasi:
  - Backend `npx tsc`: Lolos 0 error (Exit code 0).
  - Frontend `npm run build`: Lolos 0 error (`built in 7.67s`, Exit code 0).
