# TODO List: Sistem Restore & Rollback Data Toko (Disaster Recovery)

## 1. Backend Engine & API Routes (`backend/src/routes/tenantReset.ts`)
- [x] **API Inspector & Validasi Berkas**: `POST /api/tenant-reset/restore/inspect`
  - [x] Membaca payload berkas backup JSON
  - [x] Validasi skema metadata (`schemaVersion`, `platform`, `exportedAt`, `scope`)
  - [x] Menghitung ringkasan item (Jumlah Produk, Bahan Baku, Kategori, Meja, Transaksi) untuk ditampilkan di pratinjau sebelum dieksekusi
  - [x] Validasi isolasi tenant (mencegah impor data tanpa otorisasi)
- [x] **API Eksekusi Restore Transaksional**: `POST /api/tenant-reset/restore/execute`
  - [x] Validasi Role (`OWNER` / `ADMIN`) dan verifikasi kata sandi via `bcrypt.compare`
  - [x] **Auto Pre-Restore Snapshot**: Membuat cadangan darurat otomatis tepat sebelum data ditimpa
  - [x] **Mesin Pemetaan Ulang ID (*ID Re-mapping Engine*)**:
    - [x] Map `Category ID` lama ➔ baru
    - [x] Map `Ingredient ID` lama ➔ baru
    - [x] Map `Product ID` lama ➔ baru
    - [x] Relink `RecipeItem` (Product ➔ Ingredient)
    - [x] Map `Table ID` & `Supplier ID`
    - [x] Map `Order ID` & `OrderItem`
  - [x] Mendukung 2 mode pemulihan aman:
    - [x] `FULL_OVERWRITE`: Bersihkan data tenant lama dan pulihkan seluruh snapshot
    - [x] `CATALOG_ONLY`: Hanya pulihkan Kategori, Produk, Resep, dan Bahan Baku
  - [x] Eksekusi seluruh operasi di dalam 1 transaksi atomik `prisma.$transaction()`
  - [x] Pencatatan permanen di `AuditLog` dengan tingkat keparahan `CRITICAL`
- [x] **API Rollback Darurat**: `POST /api/tenant-reset/rollback`
  - [x] Mengembalikan toko ke kondisi darurat tepat sebelum restore terakhir dilakukan

---

## 2. Frontend UI/UX (`frontend/src/components/TenantResetModal.tsx`)
- [x] **Tambahkan Tab 2: "Pulihkan dari Backup (Restore)"** di `TenantResetModal.tsx`
- [x] **File Dropzone Komponen**:
  - [x] Drag & drop atau klik pilih berkas `.json`
  - [x] Indikator status pembacaan berkas
- [x] **Snapshot Inspector Card (Kartu Pratinjau)**:
  - [x] Menampilkan nama toko asal, tanggal backup, jumlah menu, bahan baku, dan riwayat pesanan
- [x] **Pilihan Mode Pemulihan**:
  - [x] Radio button: *Ganti Total (Full Overwrite)* vs *Katalog Saja (Menu & Bahan Baku)*
- [x] **Proteksi Keamanan Berlapis**:
  - [x] Input kata sandi akun Owner
  - [x] Tombol eksekusi dengan hitung mundur 3 detik (*3-Second Safety Cooldown*) & tombol *Batalkan*
- [x] **Banner Rollback Cepat**:
  - [x] Tampilkan opsi *Rollback ke Kondisi Sebelumnya* jika tersedia *Pre-Restore Snapshot*

---

## 3. Pengujian & Verifikasi Kualitas (*Quality Assurance*)
- [x] **Automated Integration Test Script**:
  - [x] Generate snapshot toko uji coba
  - [x] Jalankan Factory Reset (data menjadi 0)
  - [x] Jalankan API Restore
  - [x] Verifikasi seluruh Produk, Resep, Bahan Baku, dan Transaksi kembali 100% utuh
  - [x] Uji skenario kata sandi salah (harus ditolak `401 Unauthorized`)
  - [x] Uji skenario berkas JSON korup / tidak valid (harus ditolak `400 Bad Request`)
  - [x] Verifikasi data tenant lain tetap aman dan tidak terpengaruh
- [x] **Frontend & Backend TypeScript Verification**:
  - [x] `npx tsc --noEmit` di backend (0 error)
  - [x] `npx tsc --noEmit` di frontend (0 error)
- [x] **Manual End-to-End Test di Browser**:
  - [x] Uji alur unduh backup ➔ reset ➔ upload restore di menu Pengaturan
