---
name: saas-tenant-financial-audit
description: Standar arsitektur, audit integritas finansial, pelacakan inventaris, rekonsiliasi kas laci shift, perhitungan laba bagi hasil, dan isolasi ketat multi-tenant SaaS CodePOS.
---

# Standar Audit & Pengerasan Finansial & Inventaris Multi-Tenant SaaS (CodePOS)

Dokumen ini adalah standar operasional dan referensi kepatuhan arsitektur untuk memastikan sistem SaaS CodePOS memiliki integritas finansial tanpa celah (*watertight financial logic*), pembagian laba yang adil, rekonsiliasi kas laci kasir yang presisi, dan isolasi data 100% antar tenant.

---

## 1. Prinsip Utama Integritas Finansial SaaS

Dalam sistem kasir dan akuntansi restoran multi-tenant:
1. **Laba Bersih & Bagi Hasil (*Profit Sharing*)**:
   - Total beban makanan/minuman adalah **`HPP Riil Bahan Baku (foodHpp) + Biaya Langsung Tunai (directExpense)`**, BUKAN pilihan salah satu (*either-or*). Mengabaikan `HPP` hanya karena ada pengeluaran kas kecil akan menggembungkan laba secara fiktif dan membahayakan modal kerja pemilik (*cash bleeding*).
   - Pengelompokan divisi biaya tidak boleh di-hardcode ke satu jenis kafe (misal *ramen* atau *nori*), melainkan harus adaptif terhadap seluruh industri F&B (kafe, bakery, steakhouse, bar, dll.).

2. **Segregasi Uang Tunai vs Non-Tunai pada Arus Kas (*CashFlow*)**:
   - Saldo fisik laci kasir (*cash drawer*) HANYA dipengaruhi oleh perpindahan uang fisik rupiah kartal.
   - Transaksi Non-Tunai (Transfer Bank, QRIS, Kartu Debit, Potong Gaji) yang dicatat ke `CashFlow` untuk keperluan pembukuan rugi/laba HARUS dimasukkan ke dalam `EXCLUDED_SHIFT_CASH_CATEGORIES` di `shifts.ts` agar kasir tidak mengalami selisih minus misterius saat penutupan kas (*Blind Closing*).

3. **Uang Muka Reservasi (Down Payment) Terintegrasi**:
   - Pembayaran DP reservasi wajib mencatat metode bayar (`Tunai` vs `Transfer/QRIS`).
   - Saat tamu reservasi datang dan makan (*Dine-In*), tagihan pesanan di meja tersebut harus otomatis terhubung dengan DP yang sudah dibayar, memotong tagihan tanpa mendistorsi laporan omset kotor (*Gross Sales*).
   - Jika reservasi dibatalkan, status DP harus jelas (apakah dikembalikan via refund `CashFlow: Pengeluaran` atau hangus sebagai pendapatan lain-lain).

4. **Isolasi Analisis Kerugian & Pemotongan Stok (*Waste & Spoilage*)**:
   - Seluruh endpoint agregasi analitik (`/api/waste/analytics`, `/api/waste/logs`) WAJIB membatasi query dengan `where: { tenantId }`.
   - Pemotongan dan pengembalian stok bahan/menu pada pencatatan limbah wajib memverifikasi kepemilikan tenant (`where: { id, tenantId }`).

5. **Stock Opname & Kerugian Susut (*Inventory Shrinkage*)**:
   - Selisih minus pada stock opname fisik (`variance < 0`) merepresentasikan kerugian nyata yang wajib dicatat ke `WasteLog` agar terpantau di dashboard KPI kehilangan bahan baku pemilik (*food waste & theft control*).
   - Penyesuaian stok opname wajib memicu sinkronisasi status menu (*Sold Out Sync*) yang terisolasi per *room* tenant.

---

## 2. Aturan Isolasi Socket.IO Real-Time per Tenant

### ⛔ Larangan Keras:
Dilarang memanggil `io.emit(...)` untuk event operasional toko (stok habis, pesanan baru, shift buka/tutup, status meja). Panggilan global akan membocorkan data dan mengganggu layar kasir tenant lain.

### ✅ Standar yang Benar:
Gunakan `emitToTenant(tenantId, event, data)` atau kirimkan hanya ke *room* tenant:
```typescript
import { emitToTenant } from '../index';

// ✅ Benar: Hanya diterima oleh perangkat kasir & dapur di tenant yang bersangkutan
emitToTenant(tenantId, 'menu:stock_sync', {
  soldOutProducts,
  availableProducts
});
```

---

## 3. Checklist Kepatuhan Modul Finansial & Inventaris

Setiap kali memodifikasi atau menambah fitur baru di backend:
- [ ] Apakah query `prisma.<model>.findMany` atau `findFirst` sudah dibatasi `tenantId`?
- [ ] Apakah mutasi `create`, `update`, `delete` memverifikasi kepemilikan `tenantId`?
- [ ] Apakah transaksi arus kas (`CashFlow`) non-tunai sudah dieksklusi dari laci kas shift kasir?
- [ ] Apakah perhitungan HPP pesanan menggabungkan harga pokok bahan resep (`buyPrice`) secara akurat?
- [ ] Apakah penghapusan atau pembatalan transaksi (void) memulihkan piutang, kuota voucher, meja, dan kas secara atomik?
