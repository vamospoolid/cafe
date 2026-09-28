# TODO: Sistem Pengadaan Sparepart, PO Gudang & Buku Permintaan Barang (Lost Sales Defecta)

Dokumen rencana kerja teknis untuk mengimplementasikan sistem pengadaan suku cadang bengkel, pencatatan permintaan barang yang dicari konsumen (*lost sales / defecta*), pengelompokan belanja per Brand & Kategori, integrasi Purchase Order (grosir tempo vs belanja tunai langsung), serta penjagaan ketat isolasi multi-tenant dan keselamatan migrasi vertikal di CodePOS.

---

## Prinsip Kunci Arsitektur (Wajib Dipatuhi)
1. **Zero Cross-Tenant Leak**: Setiap baris `PartRequest` dan item pengadaan WAJIB menyertakan `tenantId` dan dicek kepemilikan gandanya (`where: { id, tenantId }`).
2. **Zero Spaghetti Code**: Seluruh logika dan route backend berada di bawah `backend/src/routes/bengkel/partRequests.ts`. Komponen frontend berada di `frontend/src/verticals/bengkel/`.
3. **Isolasi Vertikal Penuh**: Tenant bertipe `CAFE` tidak memiliki akses ke endpoint pengadaan bengkel (`requireBusinessType('BENGKEL')`), dan tidak ada kebocoran istilah bengkel ke antarmuka kafe.
4. **Paritas Disaster Recovery & Reset**: Entitas `PartRequest` didaftarkan ke `BackupService.ts` dan `tenantReset.ts` agar tidak terjadi error foreign key saat tenant melakukan reset transaksi atau ekspor cadangan data.

---

## Fase 1: Skema Prisma & Model Permintaan Barang (`PartRequest`)
> **Tujuan**: Menyediakan struktur data untuk mencatat suku cadang kosong / belum ada di katalog yang dicari oleh konsumen atau mekanik.

- [x] **1.1. Penambahan Model `PartRequest` pada Prisma Schema**
  - File: `backend/prisma/schema.prisma`
  - Field:
    - `id String @id @default(uuid())`
    - `tenantId String` (relasi ke `Tenant` dengan `onDelete: Cascade`)
    - `productId Int?` (relasi ke `Product`, null jika part baru)
    - `partName String`
    - `brand String?`
    - `vehicleType String?` (MOTOR / MOBIL / UMUM)
    - `requestedQty Int @default(1)`
    - `notes String?`
    - `customerName String?`
    - `customerPhone String?`
    - `status String @default("PENDING")` (`PENDING`, `IN_PURCHASE_LIST`, `PURCHASED`, `CANCELLED`)
    - `targetPurchaseDate DateTime?`
    - `createdAt DateTime @default(now())`
    - `updatedAt DateTime @updatedAt`
  - Indeks: `@@index([tenantId])`, `@@index([tenantId, status])`, `@@index([productId])`.
- [x] **1.2. Eksekusi Sinkronisasi Database**
  - Jalankan `npx prisma db push` dan validasi prisma client.

---

## Fase 2: Backend Controller & API Endpoint Pengadaan Bengkel
> **Tujuan**: Menyediakan REST API aman untuk CRUD permintaan barang, konversi instan jadi master barang, dan generator lembar belanja.

- [x] **2.1. Route Permintaan Barang (`partRequests.ts`)**
  - File: `backend/src/routes/bengkel/partRequests.ts`
  - `GET /api/bengkel/part-requests`: Daftar permintaan dengan filter status, search, dan grouping per Brand.
  - `POST /api/bengkel/part-requests`: Simpan catatan permintaan baru (validasi `tenantId` & relasi `productId`).
  - `PATCH /api/bengkel/part-requests/:id/status`: Perbarui status (`PENDING` $\rightarrow$ `IN_PURCHASE_LIST` $\rightarrow$ `PURCHASED` $\rightarrow$ `CANCELLED`).
  - `DELETE /api/bengkel/part-requests/:id`: Hapus catatan (soft/hard dengan proteksi tenant).
- [x] **2.2. Endpoint 1-Klik Konversi Produk Baru**
  - File: `backend/src/routes/bengkel/partRequests.ts`
  - `POST /api/bengkel/part-requests/:id/convert-to-product`:
    - Membuat baris baru di `Product` menggunakan data `partName`, `brand`, `vehicleType`, `categoryId`, `buyPrice`, `sellPriceRetail/Mitra/Grosir`, `stock`.
    - Mengubah status `PartRequest` menjadi `PURCHASED` dan menautkan `productId`-nya.
- [x] **2.3. Endpoint Lembar Rekomendasi Belanja (`procurement-sheet`)**
  - File: `backend/src/routes/bengkel/partRequests.ts`
  - `GET /api/bengkel/part-requests/shopping-sheet`:
    - Mengambil barang stok minimum (`stock <= minStock`).
    - Mengambil permintaan terbuka (`status IN ['PENDING', 'IN_PURCHASE_LIST']`).
    - Menyatukan dan mengelompokkan data berdasarkan **Brand** dan **Kategori**.
    - Menghitung estimasi total modal belanja yang dibutuhkan berdasarkan `buyPrice`.
- [x] **2.4. Registrasi Route di `backend/src/routes/bengkel/index.ts`**
  - Pastikan terlindungi oleh `requireBusinessType('BENGKEL')`.

---

## Fase 3: Paritas Backup & Factory Reset
> **Tujuan**: Menjamin kelancaran operasi data tanpa pelanggaran foreign key atau data tertinggal.

- [x] **3.1. Registrasi `partRequest` di BackupService & Database Route**
  - File: `backend/src/routes/database.ts`
  - Sertakan `partRequests` dalam ekspor snapshot JSON backup multi-tenant dan hitungan `/api/database/info`.
- [x] **3.2. Pembersihan di Modul Reset Tenant**
  - File: `backend/src/routes/tenantReset.ts`
  - Hapus data `partRequest` saat melakukan reset transaksi simulasi dan factory reset total.

---

## Fase 4: Antarmuka Frontend (Dashboard & Form Cepat)
> **Tujuan**: Memungkinkan kasir dan mekanik mencatat barang kosong seketika tanpa meninggalkan layar.

- [x] **4.1. Modal Catat Permintaan Barang (`PartRequestModal.tsx`)**
  - File: `frontend/src/verticals/bengkel/PartRequestModal.tsx`
  - Form ringan: Nama part, Merk, Tipe Kendaraan, Qty, Catatan, Nama & WA Pelanggan (opsional).
  - Autocomplete jika nama barang mirip dengan yang sudah ada di katalog.
- [x] **4.2. Pembaruan Widget Inventory Dashboard (`BengkelInventoryBlok.tsx`)**
  - File: `frontend/src/verticals/bengkel/BengkelInventoryBlok.tsx`
  - Tampilkan metrik:
    - 🔴 Item Stok Minimum
    - 🟠 Catatan Permintaan Belanja Menunggu
  - Tambahkan tombol aksi: `+ Catat Barang Kosong` dan `Buka Lembar Belanja`.
- [x] **4.3. Tombol Entri Cepat di Kasir POS Bengkel (`POSBengkel.tsx`)**
  - File: `frontend/src/verticals/bengkel/POSBengkel.tsx`
  - Jika pencarian produk menghasilkan 0 hasil atau stok = 0, tampilkan tombol: *"Catat Permintaan Konsumen"*.

---

## Fase 5: Halaman Pengadaan & Lembar Belanja Mobile (`BengkelProcurementView.tsx`)
> **Tujuan**: Lembar checklist digital responsif yang siap dibawa saat belanja grosir ke Makassar atau order tempo ke distributor.

- [x] **5.1. Komponen Lembar Belanja Interaktif**
  - File: `frontend/src/verticals/bengkel/BengkelProcurementView.tsx`
  - Tab 1: **Lembar Belanja Aktif (Shopping Sheet)**:
    - Grouping per Brand (AHM, Yamalube, Aspira, Federal, Motul, dsb.).
    - Checkbox fisik digital per item untuk menandai barang yang sudah masuk keranjang belanja.
    - Ringkasan total estimasi dana modal belanja.
    - Opsi Cetak PDF / Struk Belanja.
  - Tab 2: **Buku Catatan Permintaan Konsumen**:
    - Tabel riwayat permintaan, status, no. kontak konsumen, dan tombol aksi 1-klik konversi jadi produk.
- [x] **5.2. Pendaftaran Route di `BengkelRoutes.tsx`**
  - Route: `/bengkel/pengadaan` (terproteksi `VerticalGuard allow="BENGKEL"`).

---

## Fase 6: Validasi & Pengujian Multi-Tenant
> **Tujuan**: Verifikasi tidak ada celah keamanan atau kebocoran data antar tenant.

- [x] **6.1. Script Uji Isolasi Multi-Tenant**
  - Script: `backend/scripts/test_bengkel_procurement_and_isolation.js`
  - Hasil: Isolasi tenant A & B, pencegahan IDOR, dan proteksi tenant Kafe lulus 100%.
- [x] **6.2. Uji Konversi Produk Baru**
  - Konversi 1-klik dari `PartRequest` ke `Product` terverifikasi dengan relasi `productId` dan status `PURCHASED`.
- [x] **6.3. Verifikasi Build & Typecheck**
  - Backend `tsc --noEmit` lulus (exit code 0).
  - Frontend `tsc -b && vite build` lulus (exit code 0).
