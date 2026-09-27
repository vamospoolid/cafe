# Master Execution Todo: Solusi 8 Masalah Konkurensi & Hardening 10 Kafe

Dokumen eksekusi step-by-step untuk mengatasi 8 temuan masalah arsitektur konkurensi tinggi (*high concurrency*) saat 10 unit kafe melakukan transaksi POS secara simultan pada jam sibuk (*peak hours*).

---

## 📋 Checklist Eksekusi Step-by-Step

### 🧱 Langkah 1: Connection Pool Tuning & Database Resilience (P0) (COMPLETED ✅)
- [x] **1.1** Tambahkan parameter connection pool di `backend/.env`:
  - `DATABASE_URL="postgresql://...?schema=public&connection_limit=50&pool_timeout=20"`
  - Mengalokasikan hingga 50 koneksi aktif dengan waktu tunggu antrean 20 detik.
- [x] **1.2** Konfigurasi `backend/src/db.ts`:
  - Konfigurasi Singleton Prisma Client siap menangani pooling hingga 50 koneksi.

---

### ⚡ Langkah 2: Thread-Safe Order Number & Auto-Retry Collision (P0) (COMPLETED ✅)
- [x] **2.1** Modifikasi generator nomor transaksi di `backend/src/routes/orders.ts`:
  - Format `ORD-{YYMMDD}-{RANDOM4}` dengan retry loop mikro-entropi.
- [x] **2.2** Tambahkan **Auto-Retry Block** pada pembuatan order di `orders.ts` (`POST /dinein` & `POST /`):
  - Menangkap kode error PostgreSQL `P2002` (unique constraint `orderNumber`).
  - Lakukan retry otomatis hingga 3 kali dengan nomor baru tanpa mengembalikan error 500 ke kasir.

---

### 🛡️ Langkah 3: Atomic Stock Guard on Product & Ingredients (P0 - Anti-Overselling) (COMPLETED ✅)
- [x] **3.1** Terapkan Atomic Update Guard pada Produk di `POST /api/orders`, `POST /api/orders/dinein`, dan `POST /api/orders/sync`:
  - Menggunakan raw SQL atomic check:
    ```sql
    UPDATE "Product" SET "stock" = "stock" - ${qty} WHERE "id" = ${id} AND "stock" >= ${qty}
    ```
  - Lempar error validasi jika stok tidak mencukupi (`affected === 0`).
- [x] **3.2** Terapkan Atomic Update Guard pada Bahan Baku Resep (`Ingredient`):
  - Validasi stok bahan baku mencukupi sebelum dikurangi, cegah stok minus saat jam makan siang.
- [x] **3.3** Terapkan Auto-Retry Collision Guard `P2002` pada `POST /api/orders/sync` agar sinkronisasi transaksi offline tidak terputus saat benturan nomor order.

---

### ⏱️ Langkah 4: Prisma `$transaction` Timeout Extension (P0) (COMPLETED ✅)
- [x] **4.1** Perbarui seluruh pemanggilan `prisma.$transaction` di `backend/src/routes/orders.ts`:
  - Tambahkan opsi timeout: `{ maxWait: 10000, timeout: 20000 }` pada `POST /dinein`, `POST /`, `POST /sync`, dan `PATCH /:id/payment`.
  - Mencegah transaksi checkout kompleks terputus saat beban database 10 kafe sedang padat.

---

### 👥 Langkah 5: Shift User Isolation for Multi-Terminal Cashiers (P1) (COMPLETED ✅)
- [x] **5.1** Modifikasi endpoint `GET /api/shifts/current` & `/active` di `backend/src/routes/shifts.ts`:
  - Wajib menyertakan `userId: user.id` dari token kasir yang sedang login.
  - Menghindari 2 kasir dalam 1 kafe saling bertubrukan dan menutup laci kasir lain.

---

### 📡 Langkah 6: Socket.IO Room Scoping & Default Leak Removal (P1) (COMPLETED ✅)
- [x] **6.1** Hapus fallback default tenant di `backend/src/index.ts`:
  - Hapus inisialisasi default `'tenant-default-muki'`.
  - Client tanpa token/tenantId valid hanya bergabung ke room `unauthenticated` dan tidak menerima siaran kafe manapun.

---

### 🚦 Langkah 7: Smart Rate Limiter for Cashiers During Peak Hours (P1) (COMPLETED ✅)
- [x] **7.1** Perbarui `paymentLimiter` di `backend/src/index.ts`:
  - Tambahkan opsi `skip: (req) => Boolean(req.headers.authorization)` agar kasir resmi yang bertransaksi cepat di jam sibuk tidak terblokir HTTP 429.
  - Endpoint tetap terproteksi dari brute force untuk request publik tanpa token.

---

### 🪑 Langkah 8: Table Data Isolation on `GET /api/tables` (P1) (COMPLETED ✅)
- [x] **8.1** Perbaiki query filter meja di `backend/src/routes/tables.ts`:
  - Hapus klausa `{ tenantId: null }` pada query `findMany`.
  - Hanya meja milik tenant login yang dikembalikan.

---

### 🧪 Langkah 9: Verifikasi, Build & Simulasi Konkurensi 10 Kafe (COMPLETED ✅)
- [x] **9.1** Uji kompilasi TypeScript Backend (`npx tsc --noEmit`) -> 0 error.
- [x] **9.2** Uji kompilasi Bundle Frontend (`npm run build`) -> 0 error.
- [x] **9.3** Buat dan jalankan script automated simulation `backend/test_concurrency_10cafes.js`:
  - Uji Atomic Stock Guard: tepat 1 transaksi tembus, transaksi kedua ditolak, stok akhir 0 (tidak pernah minus).
  - Uji Thread-Safety Order Number: 30 nomor transaksi unik serentak lolos 100% tanpa tabrakan.
  - Uji Shift Isolation: kasir terisolasi per `userId`.

---

### 📦 Langkah 10: Atomic Row Lock Mutex Transfer Stok Antar-Gudang (COMPLETED ✅)
- [x] **10.1** Terapkan Atomic Row Guard raw SQL pada `PUT /transfers/:id/receive`:
  - `UPDATE "Ingredient" SET "warehouseStock" = "warehouseStock" - ${it.baseQty}, "stock" = "stock" + ${it.baseQty} WHERE "id" = ${it.ingredientId} AND "warehouseStock" >= ${it.baseQty}`
  - Mencegah kuota stok gudang pusat didistribusikan melebihi stok fisik.
- [x] **10.2** Terapkan Atomic Row Guard raw SQL pada `POST /quick-distribute` dan `POST /sales` (B2B wholesale).
- [x] **10.3** Perpanjang timeout transaksi `{ maxWait: 10000, timeout: 20000 }` pada seluruh transaksi gudang.

---

### 🚀 Langkah 11: HTTP Stress Test Jaringan Nyata dengan Autocannon (COMPLETED ✅)
- [x] **11.1** Buat automated stress test runner `backend/test_http_stress_suite.js`.
- [x] **11.2** Uji beban `GET /api/products/public` (QR Dine-in / Kios):
  - Hasil: **411.20 req/sec** (Jauh melampaui target 50-100 req/s), rata-rata latensi **35.83 ms**, 100% sukses 2xx (2.056 request), 0 error.
- [x] **11.3** Uji beban `GET /api/orders` dengan otentikasi kasir resmi & token multi-tenant:
  - Hasil: **359.60 req/sec**, rata-rata latensi **41.03 ms**, 100% sukses 2xx (1.798 request), 0 error.
