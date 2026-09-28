# Checklist & TODO: Perbaikan Logika Keuangan, Pembelanjaan Stok PO, dan Void Transaksi

Dokumen ini memuat daftar tugas (TODO List) untuk perbaikan 5 celah logika dan konektivitas operasional tenant di CodePOS.

---

## 📌 Checklist Tugas (TODO List) - STATUS: SELESAI (100%)

### 1. Modul Shifts & Cashflow (Anti Double-Counting)
- [x] Buat konstanta `EXCLUDED_SHIFT_CASH_CATEGORIES` di `backend/src/routes/shifts.ts` (`'Pembayaran Piutang'`, `'Saldo Awal Shift'`, `'Omset POS - Tunai'`, `'Omset POS - Non-Tunai'`).
- [x] Perbarui filter `manualCashIn` di route `GET /shifts` agar mengecualikan kategori di atas.
- [x] Perbarui filter `manualCashIn` di route `GET /shifts/current-summary`.
- [x] Perbarui filter `manualCashIn` di route `POST /shifts/close`.
- [x] Perbarui kalkulasi `manualCashIn` di `backend/src/routes/orders.ts` (pada penanganan sinkronisasi pesanan offline yang menimpa closed shift).

### 2. Modul Purchase Order: Stok Retail di Mode Resep (Bahan Mentah vs Barang Jadi)
- [x] Hilangkan penguncian `else if (!isAdvancedMode)` pada route `PATCH /purchase-orders/:id/receive`.
- [x] Jika PO item memiliki `ingredientId`, lakukan kenaikan stok `Ingredient` dan catat `IngredientLog`.
- [x] Jika PO item memiliki `productId`, lakukan kenaikan stok `Product` tanpa peduli status `isAdvancedMode`.

### 3. Modul Purchase Order: Pengeluaran Kas Bertahap (Partial Receive)
- [x] Ganti pembuatan `CashFlow` yang sebelumnya hanya dieksekusi saat `allFullyReceived`.
- [x] Hitung nilai belanja masuk pada setiap batch penerimaan barang: `batchExpense = qtyReceived * unitPrice`.
- [x] Buat entri `CashFlow` bertipe `'Pengeluaran'` dan kategori `'Pembelian Stok'` untuk batch tersebut dengan menyertakan `tenantId` dan `outletId`.

### 4. Modul Orders & Void: Integrasi WasteLog (Anti-Phantom Inventory)
- [x] Periksa status dapur (`kdsStatus`) pada route `PATCH /orders/:id/void`.
- [x] Jika status pesanan adalah `Pending` (belum dimasak): kembalikan stok bahan mentah / produk ke gudang seperti biasa.
- [x] Jika status pesanan adalah `Cooking`, `Ready`, atau `Served`:
  - [x] Jangan kembalikan bahan mentah ke stok aktif layak jual.
  - [x] Otomatis buat catatan di tabel `WasteLog` dengan tipe `PRODUCT` atau `INGREDIENT`.
  - [x] Hitung total kerugian HPP (*cost of waste*).
  - [x] Beri alasan `"Void Pesanan Batal Masak (#ORD-...)"`.

### 5. Multi-Tenant Scoping pada Seluruh Alur Purchase Order
- [x] Tambahkan filter `tenantId` pada fungsi penomoran `generatePoNumber`.
- [x] Tambahkan filter `where: { tenantId }` pada route `GET /purchase-orders`.
- [x] Tambahkan validasi `tenantId` pada route `GET /purchase-orders/:id`.
- [x] Simpan `tenantId` dan `outletId` pada route `POST /purchase-orders` (di level PO dan setiap itemnya).
- [x] Pastikan route pembatalan `PATCH /purchase-orders/:id/cancel` mengisolasi data per tenant.

### 6. Verifikasi & Automated Testing
- [x] Buat skrip automated test suite `backend/scripts/test_finance_inventory_audit.js`.
- [x] Jalankan pengujian dan pastikan kelima skenario lulus 100% (5/5 PASS).
- [x] Validasi kompilasi TypeScript `tsc` backend dan `vite build` frontend (0 error, build lulus).

---

## 🔬 Hasil Verifikasi Automated Test Suite (`test_finance_inventory_audit.js`):
1. **Pencegahan Double Counting Kas**: `manualCashIn` tepat Rp 15.000 (tidak lagi menduplikasi Saldo Awal Rp 100.000 dan Omset Tunai Rp 250.000).
2. **Stok Barang Retail di Mode Resep**: Biji kopi mentah naik dari 10 kg -> 15 kg dan Keripik Singkong retail naik dari 5 pcs -> 25 pcs secara simultan pada satu PO.
3. **Pengeluaran PO Bertahap**: Saat PO diterima sebagian (4 dari 10 pcs), pengeluaran kas tercatat proporsional Rp 32.000 dengan `tenantId` dan `outletId` valid.
4. **Anti-Phantom Inventory Makanan Rusak**: Pesanan yang di-void saat `kdsStatus: 'Cooking'` tidak mengembalikan 300 ml susu secara fiktif ke kulkas dan otomatis membuat entri `WasteLog` dengan kerugian HPP Rp 7.500.
5. **Isolasi Multi-Tenant PO**: Query dan hitungan PO Tenant A tidak pernah bocor ke Tenant B.
