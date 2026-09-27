# Checklist & TODO: Phase 2 Pengerasan Logika Operasional Tenant

Dokumen ini memuat daftar tugas (TODO List) untuk perbaikan 5 celah lanjutan pada Keuangan, HPP Dinamis, dan Transaksi Menu Olahan CodePOS.

---

## 📌 Checklist Tugas (TODO List) - Phase 2 - STATUS: SELESAI (100%)

### 1. Pemisahan Sumber Kas Belanja PO (Laci Kasir vs Rekening Pusat / Bank)
- [x] Tambahkan parameter `paymentSource` pada route `PATCH /purchase-orders/:id/receive`.
- [x] Bedakan kategori arus kas pengeluaran belanja PO: `'Pembelian Stok - Kasir'` vs `'Pembelian Stok - Bank'` vs `'Pembelian Stok - Tempo'`.
- [x] Perbarui kalkulasi `manualCashOut` di `backend/src/routes/shifts.ts` (pada `GET /`, `GET /current-summary`, dan `POST /close`) agar tidak memotong uang fisik kasir jika belanja dibayar dari Bank/Tempo.
- [x] Perbarui kalkulasi `manualCashOut` di `backend/src/routes/orders.ts` (pada rekonsiliasi sync shift tertutup).

### 2. Otomatisasi HPP Dinamis (Weighted Moving Average Costing)
- [x] Pada `purchaseOrders.ts` saat penerimaan barang:
  - [x] Ambil stok lama dan `buyPrice` lama dari `Ingredient`.
  - [x] Hitung HPP baru: `((oldStock * oldBuyPrice) + (qtyReceived * unitPrice)) / (oldStock + qtyReceived)`.
  - [x] Update `Ingredient.buyPrice` dengan angka rata-rata tertimbang tersebut.
  - [x] Terapkan hal yang sama untuk `Product.buyPrice` (pada barang retail jadi).

### 3. Bypass Penguncian Stok Produk pada Menu Olahan Resep (Kitchen / Bar Dish)
- [x] Pada `backend/src/routes/orders.ts` route `POST /dinein`:
  - [x] Jika `isAdvancedMode === true` dan produk memiliki resep (`recipes.length > 0`): potong stok bahan baku `Ingredient` tanpa memblokir pesanan karena `Product.stock = 0`.
  - [x] Jika tidak memiliki resep (barang retail kemasan): potong `Product.stock` seperti biasa.
- [x] Terapkan logika yang sama pada route `POST /` (POS Cashier Checkout).
- [x] Terapkan logika yang sama pada route `POST /sync` (Offline Sync).

### 4. Perhitungan Pajak Restoran Berdasarkan DPP Murni (Subtotal - Diskon)
- [x] Pastikan dasar pengenaan pajak (DPP) dihitung setelah diskon: `dpp = Math.max(0, subtotal - discount)`.
- [x] Validasi perhitungan di `orders.ts` formula `total = dpp + tax + serviceCharge`.

### 5. Toleransi Regex Dwibahasa pada Split Payment
- [x] Perbarui regex di `shifts.ts` (`getCashPortion` dan `getNonCashPortion`) menjadi `/(?:Tunai|Cash)\s*(?:Rp)?\s*([\d\.]+)/i`.

### 6. Verifikasi & Pengujian Otomatis
- [x] Buat skrip automated test `backend/scripts/test_phase2_tenant_hardening.js`.
- [x] Jalankan pengujian dan pastikan seluruh 4/4 skenario lulus (PASS 100%).
- [x] Validasi `npx tsc --noEmit` backend dan `vite build` frontend (0 error, build lulus).

---

## 🔬 Hasil Pengujian Otomatis Phase 2 (`test_phase2_tenant_hardening.js`):
1. **Pemisahan Sumber Kas PO**: Belanja PO Rp 3.000.000 via Transfer Bank terbukti 100% tidak memotong laci kasir. Hanya belanja kasir Rp 50.000 yang memotong laci kasir (Saldo akhir laci: Rp 450.000 presisi).
2. **Weighted Moving Average Costing**: Biji Kopi yang dibeli lebih mahal di PO berhasil memperbarui `buyPrice` rata-rata dari Rp 100.000/kg menjadi Rp 130.000/kg secara otomatis.
3. **Bypass Kunci Stok Menu Olahan Dapur**: Nasi Goreng Spesial dengan `Product.stock = 0` berhasil dipesan dan memotong 400 gr stok beras di dapur tanpa error stok habis.
4. **Toleransi Regex Split Payment**: Berhasil mengurai nominal uang tunai dan non-tunai dari format `Split (Tunai Rp 35.000...)`, `Split (Cash Rp 40.000...)`, dan `Split Cash 25000...`.
