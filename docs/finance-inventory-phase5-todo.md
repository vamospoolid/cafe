# Checklist & TODO: Phase 5 Pengerasan Finansial, Inventaris & Multi-Tenant SaaS

Dokumen ini memuat daftar tugas (TODO List) terperinci untuk memperbaiki 5 celah logika krusial yang ditemukan pada modul Bagi Hasil (Profit Sharing), Kerugian Limbah (Waste Tracking), Siaran Socket.IO Menu Sold Out, Uang Muka Reservasi (DP), dan Stock Opname Susut Bahan Baku.

---

## ✅ STATUS: SELESAI — Semua 5/5 item diimplementasikan & diverifikasi (21 Sep 2026)

### 📊 Hasil Verifikasi Final

| Phase | Tes | Status |
|-------|-----|--------|
| Phase 1 (Audit Dasar) | 5/5 | ✅ PASSED |
| Phase 2 (Operasional) | 4/4 | ✅ PASSED |
| Phase 3 (Meja & Kas) | 4/4 | ✅ PASSED |
| Phase 4 (Gudang & Voucher) | 4/4 | ✅ PASSED |
| **Phase 5 (Tenant SaaS)** | **5/5** | ✅ **PASSED** |
| **TOTAL** | **22/22** | ✅ **100% PASSED** |

TypeScript Compilation: **✅ Zero Errors**

---

## 📌 Checklist Tugas (TODO List) - Phase 5

### 1. Perbaikan Logika Biaya Bagi Hasil & HPP Menu (`backend/src/routes/analytics.ts`)
- [x] Ganti rumus ternary keliru `foodDirectExpense > 0 ? foodDirectExpense : foodHpp` menjadi akumulatif:
  - `foodTotalExpense = foodHpp + foodDirectExpense`
  - `drinkTotalExpense = drinkHpp + drinkDirectExpense`
  - Terapkan di kedua blok perhitungan: rekapitulasi periode utama dan rekap harian (`dailyBreakdown`).
- [x] Generalisasi pengelompokan divisi biaya (`getExpenseDivision`) agar tidak meng-hardcode nama menu ramen/spesifik kafe tunggal, serta mengambil nama divisi/toko secara dinamis dari `Settings.storeName`.

### 2. Pengerasan Multi-Tenant Modul Kerugian Limbah (`backend/src/routes/waste.ts`)
- [x] Scoping penuh pada analitik kerugian:
  - Di `GET /analytics`: Tambahkan scoping `whereCondition.tenantId = tenantId` dan `orderWhere.tenantId = tenantId`.
  - Di `GET /logs`: Tambahkan filter `where.tenantId = tenantId`.
- [x] Validasi kepemilikan tenant pada mutasi:
  - Di `POST /`: Validasi `tx.ingredient.findFirst({ where: { id, tenantId } })` dan `tx.product.findFirst({ where: { id, tenantId } })`. Tolak mutasi jika bahan/produk milik tenant lain.
  - Di `DELETE /:id`: Validasi `tx.wasteLog.findFirst({ where: { id, tenantId } })`.

### 3. Isolasi Siaran Status Stok Menu Real-Time (`backend/src/routes/ingredients.ts`)
- [x] Tambahkan parameter `tenantId` pada fungsi `syncMenuSoldOutStatus(txOrPrisma, tenantId?: string)`.
- [x] Filter query produk aktif per tenant: `where: { status: 'Aktif', ...(tenantId ? { tenantId } : {}) }`.
- [x] Ganti siaran global `io.emit(...)` menjadi siaran per room tenant: `emitToTenant(tenantId, 'menu:stock_sync', ...)`.

### 4. Sinkronisasi Uang Muka Reservasi (DP) dengan Kasir & Billing POS (`reservations.ts`, `shifts.ts`, `orders.ts`)
- [x] Di `backend/src/routes/reservations.ts`:
  - Terima `paymentMethod` saat pembayaran DP (default: `'Tunai'` atau `'Transfer'`).
  - Jika metode non-tunai, catat ke `CashFlow` dengan kategori `'Uang Muka Reservasi - Non-Tunai'`, dan jika tunai catat `'Uang Muka Reservasi - Tunai'`.
- [x] Di `backend/src/routes/shifts.ts`:
  - Tambahkan `'Uang Muka Reservasi - Non-Tunai'` ke `EXCLUDED_SHIFT_CASH_CATEGORIES` agar transfer bank DP tidak menggelembungkan laci kasir fisik.
- [x] Di `backend/src/routes/orders.ts`:
  - Saat pesanan meja makan dibuat/dibayar, periksa apakah meja memiliki reservasi aktif berstatus `'DP Dibayar'` dengan `dpAmount > 0`.
  - Hubungkan nilai DP sebagai potongan pembayaran sah dan update status reservasi menjadi `'Lunas'` secara atomik.

### 5. Pengerasan Stock Opname & Pencatatan Kerugian Susut HPP (`backend/src/routes/ingredients.ts`)
- [x] Di `POST /stock-opname`:
  - Validasi bahwa bahan baku yang di-opname milik tenant: `findFirst({ where: { id, tenantId } })`.
  - Jika selisih minus (`variance < 0`), otomatis buat entri di tabel `WasteLog`:
    - `type: 'INGREDIENT'`
    - `reason: 'Selisih Stock Opname (Susut/Hilang)'`
    - `totalCost: Math.abs(varianceValue)`
  - Panggil `syncMenuSoldOutStatus(tx, tenantId)` setelah stok diperbarui agar status menu kasir sinkron seketika.

### 6. Verifikasi & Automated Test Suite Phase 5
- [x] Buat skrip automated test suite `backend/scripts/test_phase5_tenant_hardening.js` mencakup kelima skenario di atas.
- [x] Jalankan pengujian dan pastikan 100% PASS (5/5 skenario).
- [x] Jalankan uji regresi seluruh Phase 1 s/d Phase 4 (22 skenario total).
- [x] Validasi kompilasi backend TypeScript (`tsc`) dan frontend build (`vite build`).
