# Checklist & TODO: Phase 3 Pengerasan Operasional Tenant

Dokumen ini memuat daftar tugas (TODO List) untuk perbaikan 4 celah operasional lanjutan pada Meja Gabungan, Kas Refund, Pelunasan Piutang Non-Tunai, dan Perekaman HPP Riil Menu Resep.

---

## 📌 Checklist Tugas (TODO List) - Phase 3

### 1. Auto-Release Meja Gabungan (Joined Tables) saat Bayar & Void
- [x] Di `backend/src/routes/orders.ts` pada endpoint pembayaran tagihan (`PATCH /:id/payment`):
  - [x] Urai `joinedTableIds` (array ID meja gabungan, misal `[2, 3]`).
  - [x] Periksa apakah meja-meja gabungan tersebut memiliki pesanan pending lainnya.
  - [x] Jika tidak ada pesanan aktif lain, ubah status meja gabungan menjadi `'Kosong'`.
  - [x] Kirimkan event real-time socket `table:update` untuk seluruh meja gabungan.
- [x] Di `backend/src/routes/orders.ts` pada pembatalan pesanan (`PATCH /:id/void`):
  - [x] Urai `joinedTableIds` dan kosongkan status meja gabungan jika tidak ada pesanan pending lain (`releaseTablesIfClear`).
  - [x] Emit socket `table:update` untuk seluruh meja terkait.

### 2. Pencatatan Pengeluaran Kas Refund saat Void Pesanan Lunas Tunai
- [x] Di `backend/src/routes/orders.ts` pada endpoint pembatalan pesanan (`PATCH /:id/void`):
  - [x] Periksa apakah pesanan sebelumnya sudah lunas (`orderData.status === 'Paid'`).
  - [x] Hitung nominal uang tunai yang riil dibayar: `refundCash = getCashPortion(orderData.paymentMethod, orderData.total)`.
  - [x] Jika `refundCash > 0`, otomatis buat entri `CashFlow`:
    - `type: 'Pengeluaran'`
    - `category: 'Refund Penjualan Tunai'`
    - `amount: refundCash`
    - `description: 'Pengembalian uang tunai (Refund) untuk Void Order #' + orderData.orderNumber`
    - `userId: user?.id || orderData.userId || 1`
- [x] Pastikan shift kasir (`shifts.ts`) menghitung pengeluaran refund ini (`manualCashOut`) sehingga uang fisik yang keluar dari laci kasir tidak menyebabkan selisih minus (`selisih == 0`).

### 3. Pencatatan Buku Kas untuk Pelunasan Piutang Non-Tunai (QRIS/Bank)
- [x] Di `backend/src/routes/debts.ts` pada endpoint pelunasan piutang (`POST /:id/payments`):
  - [x] Catat entri `CashFlow` untuk **semua metode pembayaran**:
    - Jika tunai: Kategori `'Pembayaran Piutang - Tunai'`
    - Jika non-tunai (QRIS / Transfer / Debit): Kategori `'Pembayaran Piutang - Non-Tunai'`
- [x] Di `backend/src/routes/shifts.ts`:
  - [x] Pastikan kategori `'Pembayaran Piutang - Non-Tunai'` masuk ke laporan kas akuntansi namun dikecualikan dari saldo kas fisik laci kasir (`EXCLUDED_SHIFT_CASH_CATEGORIES`). Diselaraskan di seluruh fungsi shift detail, auto-close, dan close-by-id.

### 4. Perekaman HPP Riil Menu Olahan Resep pada OrderItem.buyPrice
- [x] Di `backend/src/routes/orders.ts` pada proses pembuatan order (`/dinein`, `/sync`, dan `/` POS Checkout):
  - [x] Ambil data produk beserta resep dan harga beli bahan bakunya:
    `include: { recipes: { include: { ingredient: { select: { buyPrice: true } } } } }`.
  - [x] Hitung modal HPP resep per porsi:
    `HPP Resep = sum(qtyPerServing * ingredient.buyPrice)`.
  - [x] Simpan HPP riil tersebut ke kolom `OrderItem.buyPrice` (fallback ke `product.buyPrice` untuk barang retail).

### 5. Verifikasi & Automated Test Suite Phase 3
- [x] Buat skrip automated test suite `backend/scripts/test_phase3_tenant_hardening.js`.
- [x] Jalankan pengujian dan pastikan 100% PASS (4/4 PASS).
- [x] Regresi test suite Phase 1 (5/5 PASS) dan Phase 2 (4/4 PASS) tetap 100% PASS.
- [x] Validasi kompilasi backend `npx tsc --noEmit` (0 error) dan build frontend `npm run build` (sukses).
