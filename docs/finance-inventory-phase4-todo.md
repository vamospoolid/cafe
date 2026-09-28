# Checklist & TODO: Phase 4 Pengerasan Operasional Tenant (Warehouse, Debt Void, Kasbon CashFlow, & Voucher)

Dokumen ini memuat daftar tugas (TODO List) untuk perbaikan 4 celah logika finansial dan operasional lanjutan yang ditemukan pada modul Gudang Pusat, Piutang Order Void, Pengembalian Kasbon Staf, dan Siklus Kuota Voucher Promo.

---

## 📌 Checklist Tugas (TODO List) - Phase 4

### 1. Multi-Tenant Scoping Modul Gudang Pusat (`backend/src/routes/warehouse.ts`)
- [x] Ekstraksi `tenantId` & `outletId` dari token autentikasi / `TenantContext` di seluruh route `warehouse.ts`.
- [x] Tambahkan scoping `where: { tenantId }` pada seluruh operasi baca (query):
  - [x] `GET /dashboard`: Filter bahan baku (`ingredient`), modal pemilik (`ownerFundTransaction`), mutasi transfer (`warehouseRequisition`), dan barang masuk (`warehouseInbound`).
  - [x] `GET /stock`: Scoping daftar stok bahan baku per tenant.
  - [x] `GET /inbound`: Scoping riwayat penerimaan barang grosir per tenant.
  - [x] `GET /requisitions`: Scoping riwayat permintaan dapur per tenant.
  - [x] `GET /owner-funds`: Scoping buku transaksi modal pemilik per tenant.
  - [x] `GET /sales`: Scoping penjualan grosir per tenant.
- [x] Di endpoint `POST /quick-distribute` (Distribusi 1-Klik Gudang ke Dapur):
  - [x] Simpan `tenantId` dan `outletId` pada `tx.warehouseRequisition.create`.
  - [x] Simpan `tenantId` dan `outletId` pada `tx.ingredientLog.create`.
  - [x] Simpan `tenantId` pada `tx.ownerFundTransaction.create`.

### 2. Sinkronisasi Pembatalan Piutang saat Void Order (`backend/src/routes/orders.ts`)
- [x] Di endpoint pembatalan pesanan (`PATCH /:id/void`):
  - [x] Periksa apakah pesanan ini memiliki record piutang terhubung di tabel `Debt` (`where: { orderId: Number(id), tenantId }`).
  - [x] Jika ditemukan dan belum ada pembayaran (`debt.remaining === debt.amount`):
    - Ubah status piutang menjadi `'Dibatalkan'`.
    - Nolkan sisa piutang (`remaining: 0`).
    - Tambahkan catatan `notes: 'Dibatalkan otomatis karena Order #' + orderData.orderNumber + ' di-void'`.
  - [x] Jika sudah ada pembayaran sebagian, batalkan sisa piutang aktif dan catat log audit.

### 3. Pencatatan CashFlow Pengembalian Kasbon Staf (`employeeLoans.ts` & `shifts.ts`)
- [x] Di `backend/src/routes/employeeLoans.ts` pada endpoint pembayaran kasbon (`POST /:id/payments`):
  - [x] Catat transaksi penerimaan uang di tabel `CashFlow`:
    - Jika tunai (`TUNAI` / `CASH`): `type: 'Pemasukan'`, `category: 'Pengembalian Kasbon - Tunai'`, simpan `outletId`, `tenantId`, dan `userId`.
    - Jika non-tunai (`TRANSFER` / `NON_TUNAI`): `type: 'Pemasukan'`, `category: 'Pengembalian Kasbon - Non-Tunai'`.
- [x] Di `backend/src/routes/shifts.ts`:
  - [x] Tambahkan `'Pengembalian Kasbon - Non-Tunai'` ke dalam daftar `EXCLUDED_SHIFT_CASH_CATEGORIES` agar tidak mencemari saldo laci fisik kasir.
  - [x] Pastikan `'Pengembalian Kasbon - Tunai'` otomatis dihitung masuk ke `manualCashIn` shift kasir sehingga rekonsiliasi laci fisik kasir (*Blind Closing*) 100% konsisten.

### 4. Siklus Hidup Kuota Voucher Promo (`orders.ts`)
- [x] Di `backend/src/routes/orders.ts` pada endpoint pelunasan tagihan (`PATCH /:id/payment`):
  - [x] Ekstrak `voucherId` dari `req.body`.
  - [x] Validasi bahwa voucher tersebut milik tenant yang bersangkutan dan kuotanya belum habis.
  - [x] Simpan relasi `voucherId` ke tabel `Order`.
  - [x] Tambahkan pemakaian kuota: `tx.voucher.update({ where: { id: voucherId }, data: { usedCount: { increment: 1 } } })`.
- [x] Di `backend/src/routes/orders.ts` pada pembatalan pesanan (`PATCH /:id/void`):
  - [x] Periksa apakah pesanan yang dibatalkan menggunakan voucher (`orderData.voucherId`).
  - [x] Jika ada, pulihkan kuota voucher secara otomatis: `tx.voucher.update({ where: { id: orderData.voucherId }, data: { usedCount: { decrement: 1 } } })`.
- [x] Cegah *double-deduction* poin loyalitas pada `PATCH /:id/payment` jika poin telah dipotong saat pembuatan pesanan pending.

### 5. Verifikasi & Automated Test Suite Phase 4
- [x] Buat skrip automated test suite `backend/scripts/test_phase4_tenant_hardening.js`.
- [x] Jalankan pengujian dan pastikan 100% PASS (4/4 skenario).
- [x] Jalankan regresi seluruh test suite Phase 1, Phase 2, dan Phase 3 untuk memastikan zero regression.
- [x] Validasi kompilasi backend `npx tsc --noEmit` dan frontend build `npm run build`.
