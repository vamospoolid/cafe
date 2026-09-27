# Checklist & TODO: Phase 10 — Complete Zero-IDOR & Nested FK Multi-Tenant Hardening

Dokumen ini memuat daftar tugas terperinci untuk menutup seluruh potensi IDOR dan celah fail-open di CodePOS SaaS:
1. **Eliminasi 81 Kueri Fail-Open**: Menghapus seluruh pola `...(tenantId ? { tenantId } : {})` di 12 file rute.
2. **Koreksi Hak Akses OWNER pada Produk**: Memastikan pemilik kafe lokal terisolasi pada produk kafenya sendiri (hanya platform superadmin yang boleh lintas tenant).
3. **Pencegahan Nested FK Injection**: Memvalidasi kepemilikan `productId`, `tableId`, `voucherId`, dan `customerId` saat order dibuat.
4. **Proteksi Endpoint Meja Publik**: Memastikan QR meja publik memvalidasi kesesuaian slug tenant.
5. **Automated Testing Suite**: 6 skenario uji IDOR baru (Target: 49/49 Tests Passing).

---

## Status: ✅ COMPLETED (100% — Zero-IDOR & Zero Fail-Open Queries Achieved)

---

## 📌 Checklist Tugas - Phase 10

### 1. Eliminasi Kueri Fail-Open `...(tenantId ? { tenantId } : {})`
- [x] `backend/src/routes/cashflow.ts`: Kunci `DELETE /:id` dengan `where: { id: Number(id), tenantId }` dan guard awal `if (!tenantId)`.
- [x] `backend/src/routes/products.ts`:
  - [x] Ubah `isSuperOrOwner` agar hanya mengecek `Boolean(user?.isPlatformAdmin)` untuk akses lintas tenant.
  - [x] Kunci `PUT /:id` dan `DELETE /:id` agar wajib mencocokkan `tenantId`.
  - [x] Public endpoint fail-closed dengan verifikasi `tenantId`.
- [x] `backend/src/routes/tables.ts` (9 kemunculan dieliminasi):
  - [x] Tambahkan router-level guard `if (!tenantId) return res.status(400)`.
  - [x] Ganti seluruh kueri meja `where: { id: numId, tenantId }` dan `PUT /layout`.
  - [x] `GET /public/:id`: Validasi meja sesuai dengan tenant context (query param / header).
- [x] `backend/src/routes/shifts.ts` (22 kemunculan dieliminasi):
  - [x] Kueri kas laci, shift aktif, auto-close, rekalkulasi, dan detail shift per ID (`where: { id: shiftId, tenantId }`) wajib menyertakan `tenantId`.
- [x] `backend/src/routes/warehouse.ts` (15 kemunculan dieliminasi):
  - [x] Kunci `where: { id, tenantId }` pada seluruh dokumen permintaan bahan, faktur penjualan gudang, inbound pasokan, transfer, dan rekap keuangan owner.
- [x] `backend/src/routes/purchaseOrders.ts` (6 kemunculan dieliminasi):
  - [x] Kueri PO detail dan approval dikunci per `tenantId`.
- [x] `backend/src/routes/ingredients.ts` (20 kemunculan dieliminasi):
  - [x] Kueri master bahan baku, audit stok, yield analytics, dan mutasi dikunci per `tenantId`. Perbaikan runtime field `qty`.
- [x] `backend/src/routes/kds.ts` (5 kemunculan dieliminasi):
  - [x] Kueri dapur, shift aktif, riwayat sajian, dan update status pesanan dikunci per `tenantId`.
- [x] `backend/src/routes/suppliers.ts` (4 kemunculan dieliminasi):
  - [x] Kueri supplier dikunci per `tenantId`.
- [x] `backend/src/routes/waste.ts` (4 kemunculan dieliminasi):
  - [x] Kueri limbah dikunci per `tenantId` dengan fail-closed guard.
- [x] `backend/src/routes/recycleBin.ts` (1 kemunculan dieliminasi):
  - [x] Kueri auto-purge dan restore dikunci per `tenantId`.
- [x] `backend/src/routes/orders.ts` (21 kemunculan dieliminasi):
  - [x] Kueri orders, move-table, merge-table, dan sync-offline dikunci per `tenantId`.
- [x] `backend/src/routes/database.ts` (1 kemunculan dieliminasi):
  - [x] Export non-platform admin dikunci `{ tenantId: tenantId! }`.

### 2. Nested Foreign Key Ownership Scoping
- [x] `backend/src/routes/orders.ts` (`POST /orders` & `POST /dinein`):
  - [x] Validasi `productIds`: `where: { id: { in: productIds }, tenantId }`. Jika `products.length !== uniqueProductIds.length`, tolak dengan `Error('Satu atau lebih produk tidak ditemukan atau bukan milik tenant ini.')`.
  - [x] Validasi `tableId` & `joinedTableIds`: Wajib milik `tenantId` yang sama.
  - [x] Validasi `voucherId`: Wajib milik `tenantId` yang sama dan berstatus Aktif.
  - [x] Validasi `customerId`: Wajib terdaftar di bawah `tenantId` yang sama.
- [x] `backend/src/routes/purchaseOrders.ts` (`POST /`):
  - [x] Validasi `supplierId` wajib ber-`tenantId` sama.
  - [x] Validasi seluruh `productId` dan `ingredientId` wajib ber-`tenantId` sama.

### 3. Automated Testing & Verifikasi Regresi
- [x] Buat file test `backend/scripts/test_phase10_idor_and_nested_fk_isolation.js`:
  1. Static Code Audit: 0 kata `...(tenantId ? { tenantId } : {})` di seluruh 12 file rute.
  2. Cashflow Deletion IDOR: Tenant B ditolak (404) saat mencoba menghapus kas Tenant A.
  3. Product Owner Privilege Isolation: Pemilik Kafe B ditolak saat mencoba mengedit/menghapus produk Kafe A.
  4. Nested FK Injection (Orders): Tenant B gagal membuat order menggunakan `productId` Tenant A.
  5. Nested FK Injection (PO): Tenant B gagal membuat purchase order menggunakan `supplierId` Tenant A.
  6. Public Table QR Isolation: Request meja publik Kafe A dari konteks Kafe B ditolak 404.
- [x] Jalankan test suite Phase 10: **6/6 PASSED (100%)**.
- [x] Jalankan regresi lengkap Phase 2-9 & Finance: **43/43 PASSED (100%)**.
- [x] Total Hasil Uji Gabungan: **49/49 PASSED (100%)**.
- [x] Kompilasi TypeScript: Backend (`tsc`) dan Frontend (`tsc -b && vite build`) **0 Errors**.
