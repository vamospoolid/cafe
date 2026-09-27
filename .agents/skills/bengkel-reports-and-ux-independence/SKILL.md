---
name: bengkel-reports-and-ux-independence
description: >
  Standar arsitektur, laporan finansial, analitik performa mekanik, generator PDF
  berkop surat dinamis, serta eliminasi kebocoran istilah F&B/Kafe di Pengaturan & Arus Kas CodePOS.
---

# Standar Laporan Finansial, PDF Letterhead & Isolasi UX Bengkel

## 1. Latar Belakang & Masalah Utama

Ketika vertikal Bengkel diintegrasikan ke dalam CodePOS (yang awalnya dibangun untuk F&B), terdapat 3 kelemahan mendasar:
1. **Laporan Masih Sederhana & Belum Memiliki Grafik/PDF**: Modul Laporan Bengkel belum memiliki grafik visual tren harian, belum mengintegrasikan pengeluaran arus kas operasional (OPEX), serta belum mendukung ekspor PDF dokumen A4 berkop surat resmi bengkel.
2. **Duplikasi Navigasi Sidebar**: Tautan laporan muncul ganda (di navigasi utama Bengkel `/bengkel/laporan` dan di bawah kelompok menu SDM `/laporan`).
3. **Kebocoran Istilah F&B di Pengaturan & Arus Kas**:
   * Di `SettingsView.tsx`: Masih muncul printer dapur (KOT), printer bar, kustomisasi minuman (sugar/ice), audit koki gosong/tumpah/basi, dan live thermal receipt yang menampilkan ramen/gyoza/meja 05.
   * Di `CashFlowModal.tsx`: Kasir bengkel yang mencatat belanja oli/sparepart terpaksa memilih kategori "Bahan Makanan (Food Ingredients)".
   * Di `pdfGenerator.ts` & `excelGenerator.ts`: Masih terdapat fallback hardcoded `settings?.storeName || 'KAFE & RESTORAN'`.

---

## 2. Prinsip Arsitektur — Zero Regression & Strict Independence

1. **Kafe 100% Utuh (Zero Regression)**:
   Seluruh fungsionalitas Kafe (resep bahan baku gram/ml, KDS dapur, KOT printer, meja dine-in, kustomisasi minuman, staff meal) harus tetap berjalan normal tanpa perubahan logika bisnis.
2. **Bengkel 100% Nuansa Otomotif**:
   Tenant dengan `businessType === 'BENGKEL'` tidak boleh melihat satu pun istilah dapur, koki, barista, atau meja.
3. **Pola Adaptif Terpusat via `VerticalContext`**:
   Gunakan hook `useVertical()` (`isBengkel`, `businessType`, `profile`). Jangan membuat kueri database terpisah jika skema relasi dapat diabstraksikan secara bersih.
4. **Header Dokumen Dinamis (Dynamic Letterhead)**:
   Generator PDF wajib membaca `settings.logoUrl`, `settings.storeName`, `settings.address`, dan `settings.phone`. Fallback nama toko tidak boleh menyebut kata "KAFE" untuk tenant bengkel.

---

## 3. Spesifikasi Arsitektur Laporan Bengkel

### A. Pilar Data Finansial & Operasional
Modul Laporan Bengkel wajib menyajikan 5 pilar analitik:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ARSITEKTUR MODUL LAPORAN BENGKEL                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. GRAFIK TREN PENJUALAN & SPK (Jasa Servis vs Penjualan Sparepart)   │
│ 2. LAPORAN LABA RUGI OPERASIONAL (P&L: Omzet, HPP Part, Komisi, OPEX)  │
│ 3. LAPORAN ARUS KAS BENGKEL (Inflow Kas POS vs Outflow Belanja/Beban) │
│ 4. EVALUASI PRODUKTIVITAS & SLIP KOMISI MEKANIK (Owner View)          │
│ 5. VALUASI INVENTARIS & FAST-MOVING PARTS (Monitoring Stok Kritis)     │
│ 6. EKSPOR DOKUMEN RESMI PDF (Letterhead Logo, Alamat & Tanda Tangan)   │
└────────────────────────────────────────────────────────────────────────┘
```

### B. Grafik Tren Penjualan Harian (Recharts ComposedChart)
Endpoint `/api/bengkel/reports/summary` wajib mengembalikan `dailyTrend`:
```typescript
interface DailyTrendItem {
  date: string;       // YYYY-MM-DD
  dateFormatted: string; // "24 Sep"
  omzetJasa: number;
  omzetParts: number;
  totalOmzet: number;
  spkCount: number;
}
```
Visualisasi:
* Bar Biru/Indigo (`#4f46e5`): Omzet Jasa Servis
* Bar Hijau/Emerald (`#10b981`): Omzet Suku Cadang & Pelumas
* Garis Oranye/Amber (`#f59e0b`, right y-axis): Volume SPK Selesai (Unit Kendaraan)

### C. Laporan Laba Rugi Operasional (P&L) Standar Otomotif
Perhitungan laba bersih riil bengkel:
$$\text{Laba Kotor} = \text{Omzet Jasa} + (\text{Omzet Parts} - \text{HPP Parts}) - \text{Diskon}$$
$$\text{Laba Bersih Operasional} = \text{Laba Kotor} - \text{Beban Komisi Mekanik} - \text{Beban OPEX Kas}$$

Data Beban OPEX diambil dari tabel `CashFlow` dengan tipe `EXPENSE` dan kategori pengeluaran operasional bengkel (listrik, air, alat bengkel, konsumsi).

### D. Evaluasi Produktivitas Mekanik
* Tabel evaluasi performa mekanik menampilkan:
  * Nama Mekanik & Kontak
  * Total Unit Kendaraan / SPK Diselesaikan
  * Total Omzet Jasa yang Dihasilkan
  * Skema Komisi (% atau flat)
  * Hak Komisi Periode Ini
  * Total Komisi Pending (Belum Dibayar)
* Fitur Cetak Slip Komisi per mekanik.

---

## 4. Standar Generator Dokumen PDF Resmi A4

### A. Template Letterhead Bengkel
Generator PDF (`bengkelPdfGenerator.ts` / `pdfGenerator.ts`) wajib mengikuti format cop surat resmi:
```
┌────────────────────────────────────────────────────────────────────────┐
│ [LOGO]   BENGKEL JAYA MOTOR                    LAPORAN PERFORMA BENGKEL│
│          Jl. Otomotif No. 12, Jakarta Selatan  Periode: 01 - 24 Sep 2026│
│          WhatsApp: 0812-3456-7890              Dicetak: Budi (Admin)   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. RINGKASAN EKSEKUTIF FINANSIAL (P&L)                                │
│    - Omzet Jasa Servis : Rp 3.200.000                                 │
│    - Omzet Sparepart   : Rp 2.500.000 (HPP: Rp 1.600.000)             │
│    - Komisi Mekanik    : Rp   960.000                                 │
│    - Beban OPEX Kas    : Rp   550.000                                 │
│    - Estimasi Laba Bersih : Rp 2.440.000                              │
│                                                                        │
│ 2. TABEL EVALUASI PRODUKTIVITAS MEKANIK                                │
│    [Nama] | [Unit SPK] | [Omzet Jasa] | [% Komisi] | [Hak Komisi]      │
│                                                                        │
│ 3. 10 SUKU CADANG TERLARIS (FAST-MOVING)                               │
│    [Kode/Part] | [Qty Terjual] | [Omzet] | [Sisa Stok] | [Status Stok] │
├────────────────────────────────────────────────────────────────────────┤
│ Tanda Tangan:                                                          │
│ Dibuat Oleh (Admin/Kasir),               Disetujui Oleh (Owner),       │
│                                                                        │
│ (...........................)            (...........................) │
└────────────────────────────────────────────────────────────────────────┘
```

### B. Aturan Implementasi PDF
1. **Asynchronous Logo Loader**: Gunakan canvas base64 conversion dengan `img.crossOrigin = 'Anonymous'`. Jika logo tidak tersedia, berikan aksen badge warna primer bengkel tanpa crash.
2. **Zero Hardcoded F&B String**:
   ```typescript
   // SALAH:
   pdfDoc.text(settings?.storeName || 'KAFE & RESTORAN', x, y);
   
   // BENAR:
   const defaultName = isBengkel ? 'BENGKEL MOTOR & MOBIL' : 'KAFE & RESTORAN';
   pdfDoc.text(settings?.storeName || defaultName, x, y);
   ```

---

## 5. Standar Isolasi Pengaturan (Settings View)

### A. Komponen yang Dieliminasi jika `isBengkel === true`
1. Kartu **PRINTER DAPUR (KOT)** dan **PRINTER BAR (DRINK)**.
2. Seksi **Pemetaan Kategori ke Target Printer (Routing Otomatis)**.
3. Seksi **Layar Dapur (Kitchen Display System / KDS)**.
4. Toggle **Kustomisasi Minuman (Sugar, Ice, Temperature)**.
5. Blok **Kontrol Dapur & Mode Audit Detail Koki (Gosong, Tumpah, Basi)**.
6. Toggle **Pencatatan Makan Karyawan (Staff Meal)**.

### B. Komponen yang Diubah Redaksinya jika `isBengkel === true`
1. Input Nama Bisnis: `placeholder="Nama Bengkel Anda"`.
2. Checkbox Cetak Struk:
   * Kafe: `Cetak Nomor Meja`.
   * Bengkel: `Cetak No. Polisi & Tipe Kendaraan` dan `Cetak Odometer (KM)`.
3. Live Preview Struk Thermal:
   * Kafe: Menampilkan Ramen, Gyoza, Ocha Dingin, Meja 05.
   * Bengkel: Menampilkan No. SPK, No. Polisi, KM, Mekanik, Oli Mesin, Kampas Rem, Servis Ringan, Garansi Servis (14 Hari / 1.000 KM).
4. Tab Inventaris:
   * Kafe: Pelacakan Resep Bahan Baku gram/ml.
   * Bengkel: Pelacakan Stok Sparepart Satuan Pcs/Botol dengan Reorder Point Alert.
5. Tab Bagi Hasil:
   * Kafe: Bagi Hasil Divisi Makanan (Kitchen) & Minuman (Bar).
   * Bengkel: Bagi Hasil Usaha Bengkel (Owner vs Mitra Operasional) & Informasi Komisi Mekanik.

---

## 6. Standar Arus Kas Operasional (Cash Flow)

Pada `CashFlowModal.tsx` dan `CashFlowView.tsx`:
* Jika `isBengkel === true`:
  * Kategori `Bahan Makanan` $\rightarrow$ `Suku Cadang & Sparepart` (Ikon `<Package />` atau `<Wrench />`).
  * Kategori `Bahan Minuman` $\rightarrow$ `Oli, Pelumas & Cairan Kimia` (Ikon `<Droplet />`).
  * Sub-kategori perlengkapan $\rightarrow$ `Perawatan Toolkit & Kompresor Pit`.

---

## 7. Checklist Validasi & Uji Bebas Regresi

- [ ] Navigasi sidebar hanya menampilkan 1 menu laporan untuk bengkel (`/bengkel/laporan`).
- [ ] Grafik tren harian di Laporan Bengkel memisahkan omzet jasa dan sparepart dengan jelas.
- [ ] Ekspor PDF Laporan Bengkel berhasil mencetak logo outlet, nama bengkel, alamat, dan nomor kontak.
- [ ] Tab Settings tidak menampilkan KDS, printer dapur, opsi minuman, atau audit koki saat dibuka oleh tenant bengkel.
- [ ] Mockup struk thermal di Settings Bengkel menampilkan No. Polisi, KM, mekanik, dan garansi servis.
- [ ] Modal Kas Keluar menampilkan kategori suku cadang & pelumas saat tenant bengkel mencatat pengeluaran.
- [ ] Tenant Kafe tetap mempertahankan 100% tampilan dan fungsi aslinya tanpa regresi.
- [ ] `npm run build` di frontend lulus dengan exit code 0.
