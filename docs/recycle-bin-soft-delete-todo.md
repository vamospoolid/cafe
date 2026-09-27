# TODO List: Keranjang Sampah Sementara (Recycle Bin & 30-Day Soft Delete System)

## 1. Database Schema & Migration (`backend/prisma/schema.prisma`)
- [x] Tambahkan kolom `deletedAt DateTime?` dan index `@@index([tenantId, deletedAt])` pada 6 model:
  - [x] `model Product`
  - [x] `model Ingredient`
  - [x] `model Category`
  - [x] `model Table`
  - [x] `model Customer`
  - [x] `model Supplier`
- [x] Jalankan sinkronisasi database: `npx prisma db push --accept-data-loss`
- [x] Generate ulang Prisma Client: `npx prisma generate`

---

## 2. Backend Soft Delete Refactor & Recycle Bin Engine
- [x] **Refaktor Router CRUD Existing (Soft Delete bukannya Hard Delete)**:
  - [x] `backend/src/routes/products.ts`: `findMany` filter `deletedAt: null`, `DELETE` ganti ke `update({ data: { deletedAt: new Date() } })`
  - [x] `backend/src/routes/ingredients.ts`: `findMany` filter `deletedAt: null`, `DELETE` ganti ke `update({ data: { deletedAt: new Date() } })`
  - [x] `backend/src/routes/categories.ts`: `findMany` filter `deletedAt: null`, `DELETE` ganti ke `update({ data: { deletedAt: new Date() } })`
  - [x] `backend/src/routes/tables.ts`: `findMany` filter `deletedAt: null`, `DELETE` ganti ke `update({ data: { deletedAt: new Date() } })`
  - [x] `backend/src/routes/customers.ts`: `findMany` filter `deletedAt: null`, `DELETE` ganti ke `update({ data: { deletedAt: new Date() } })`
  - [x] `backend/src/routes/suppliers.ts`: `findMany` filter `deletedAt: null`, `DELETE` ganti ke `update({ data: { deletedAt: new Date() } })`
- [x] **Buat Router Dedicated `backend/src/routes/recycleBin.ts`**:
  - [x] `GET /api/recycle-bin`: Mengambil seluruh item terhapus per tenant aktif + kalkulasi sisa hari retensi (30 hari)
  - [x] `POST /api/recycle-bin/restore`: Memulihkan item tertentu (`deletedAt: null`)
  - [x] `DELETE /api/recycle-bin/purge/:type/:id`: Hapus permanen satu item dari database
  - [x] `DELETE /api/recycle-bin/empty`: Kosongkan seluruh sampah tenant (dilindungi verifikasi kata sandi Owner)
  - [x] `POST /api/recycle-bin/auto-purge`: Background purge untuk item yang dihapus > 30 hari
  - [x] Catat seluruh mutasi di `AuditLogger` (`action: 'RECYCLE_BIN_RESTORE'`, `'RECYCLE_BIN_PURGE'`)
- [x] Daftarkan endpoint di `backend/src/index.ts` (`app.use('/api/recycle-bin', recycleBinRouter)`)

---

## 3. Frontend UI/UX: Pusat Keranjang Sampah (`RecycleBinModal.tsx`)
- [x] **Buat Komponen `frontend/src/components/RecycleBinModal.tsx`**:
  - [x] Header modal dengan badge jumlah item di tong sampah & banner informasi retensi 30 hari
  - [x] Filter tab kategori: `Semua` | `Produk` | `Bahan Baku` | `Kategori` | `Meja` | `Pelanggan` | `Supplier`
  - [x] Card/List item dengan rincian nama, harga/stok lama, tanggal hapus, dan badge waktu sisa (*misal: "Sisa 24 hari"*)
  - [x] Tombol **"Pulihkan" (Restore)** 1-klik dengan toaster notification
  - [x] Tombol **"Hapus Permanen"** per item dengan popover konfirmasi
  - [x] Tombol **"Kosongkan Keranjang Sampah"** dengan modal keamanan input password Owner
- [x] **Pasang Tombol Pemicu Recycle Bin**:
  - [x] Di halaman Produk & Menu ([`frontend/src/components/ProductView.tsx`](file:///c:/ADATA/codepos/frontend/src/components/ProductView.tsx))
  - [x] Di halaman Bahan Baku & Stok ([`frontend/src/components/IngredientView.tsx`](file:///c:/ADATA/codepos/frontend/src/components/IngredientView.tsx))
  - [x] Di halaman Pengaturan Toko ([`frontend/src/components/SettingsView.tsx`](file:///c:/ADATA/codepos/frontend/src/components/SettingsView.tsx))

---

## 4. Pengujian & Verifikasi Kualitas (*Quality Assurance*)
- [x] **Automated Integration Test**:
  - [x] Uji hapus produk ➔ pastikan hilang dari kasir & POS tapi masuk ke `/api/recycle-bin`
  - [x] Uji pulihkan produk ➔ pastikan muncul kembali di kasir & POS
  - [x] Uji hard delete permanen
  - [x] Uji isolasi tenant (tenant lain tidak dapat melihat atau memulihkan item tenant ini)
- [x] **TypeScript Typecheck**:
  - [x] Backend: `npx tsc --noEmit` (0 error)
  - [x] Frontend: `npx tsc --noEmit` (0 error)
- [x] **Manual End-to-End Verification di Browser**:
  - [x] Tombol Keranjang Sampah terpasang di Produk, Bahan Baku, dan Pengaturan Database
