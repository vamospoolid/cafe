---
name: retail-reports-and-ux-independence
description: >
  Standar arsitektur, laporan finansial retail/grosir 3-tier pricing, analitik fast/slow moving stock,
  buku piutang bon tempo (AR ageing), generator PDF A4 berkop surat dinamis, serta eliminasi kebocoran
  istilah F&B/Kafe pada modul Laporan & Kasir CodePOS.
---

# Standar Laporan Finansial, PDF Letterhead & Isolasi UX Retail & Grosir

## 1. Latar Belakang & Masalah Utama

Ketika vertikal Toko Retail, Grosir & Bangunan diakses di CodePOS:
1. **Kebocoran Istilah F&B pada Modul Laporan**: `ReportViewAdaptive.tsx` masih mengarahkan tenant Retail ke `ReportView.tsx` (F&B/Cafe) yang berisi *Analisis Resep*, *Bahan Baku Dapur*, *Menu Terlaris*, dan *Waste Koki*.
2. **Kebutuhan Spesifik Retail & Grosir**: Pemilik toko retail dan toko grosir membutuhkan laporan penjualan bertingkat (Ecer vs Mitra vs Grosir), analisis perputaran stok (Fast vs Slow Moving), buku piutang bon tempo (AR Ageing), dan laporan pengiriman armada toko (Surat Jalan/DO).
3. **Keterisolasian Multi-Tenant & Zero Spaghetti Code**: Seluruh laporan retail harus terpisah dalam komponen independen (`RetailReports.tsx`) tanpa merusak fungsionalitas Kafe maupun Bengkel.

---

## 2. Prinsip Arsitektur — Zero Spaghetti Code & Strict Independence

1. **Komponen Independen `RetailReports.tsx`**:
   Seluruh logika analitik, chart visual, tabel transaksi, dan ekspor PDF khusus retail dikelompokkan dalam `frontend/src/verticals/retail/RetailReports.tsx`.
2. **Pola Adaptif Terisolasi via `ReportViewAdaptive.tsx`**:
   Route `/laporan` memilih komponen secara dinamis:
   `isBengkel ? <BengkelReports /> : isRetail ? <RetailReports /> : <ReportViewCafe />`
3. **6 Pilar Laporan Khusus Retail**:
   - **Pilar 1**: Ringkasan Penjualan 3-Tier Pricing (Ecer, Mitra, Grosir) & Laba Kotor.
   - **Pilar 2**: Perputaran Stok Fast Moving vs Slow Moving & Valuasi Persediaan Rak/Gudang.
   - **Pilar 3**: Buku Piutang Pelanggan & Bon Tempo (AR Ageing Ledger).
   - **Pilar 4**: Rekapitulasi Pengiriman Armada Toko & Surat Jalan (DO Dispatch Log).
   - **Pilar 5**: Laporan Laba Rugi Bersih Retail (Net Profit & Loss).
   - **Pilar 6**: Rekapitulasi Kas Laci & Shift Kasir Retail.
4. **Header & PDF Export Dinamis**:
   Generator PDF (`retailPdfGenerator.ts`) menggunakan logo, nama toko, alamat, dan nomor telp tenant dari `settings` dengan fallback nama toko `TOKO RETAIL & GROSIR` (bebas dari klausal "KAFE").

---

## 3. Spesifikasi Data & Endpoint API Retail Reports

Modul `RetailReports.tsx` mengonsumsi data dari endpoint berikut dengan penguncian `where: { tenantId }`:

- `GET /api/reports/retail/summary?startDate=...&endDate=...` (Ringkasan Omzet, Laba Kotor, Margin)
- `GET /api/reports/retail/tiered-sales` (Penjualan per Price Tier: UMUM, MITRA, GROSIR)
- `GET /api/reports/retail/stock-velocity` (Fast vs Slow Moving Products)
- `GET /api/reports/retail/ar-ageing` (Buku Piutang Bon Tempo & Umur Piutang)
- `GET /api/reports/retail/deliveries` (Rekapitulasi Pengiriman Armada & Surat Jalan)
- `GET /api/reports/retail/shift-summary` (Audit Kas Shift Kasir Retail)

---

## 4. Panduan Ekspor PDF & Kop Surat Resmi Retail

File `frontend/src/utils/retailPdfGenerator.ts` mengelola ekspor dokumen A4:
- Menggunakan `jsPDF` (`orientation: 'portrait', unit: 'mm', format: 'a4', compress: true`).
- Membungkus output Blob dalam `new File([pdfBlob], filename, { type: 'application/pdf' })` agar nama file kustom ber-ekstensi `.pdf` terjaga di seluruh browser (Chrome & Edge).
