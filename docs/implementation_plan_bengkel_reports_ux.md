# Implementation Plan: Peningkatan Laporan Bengkel & Pembersihan Isolasi UX
## CodePOS Multi-Tenant SaaS (Bengkel Motor & Mobil vs Kafe & Resto)

---

## 1. Ringkasan Tujuan (Goal)
Mengupgrade modul **Laporan Bengkel** agar menyajikan analitik bisnis yang komprehensif (Grafik Tren Recharts Jasa vs Sparepart, P&L Operasional, Rekonsiliasi Arus Kas, Slip Komisi Mekanik, dan Generator PDF A4 Letterhead Resmi dengan Logo & Alamat), serta membersihkan kebocoran istilah F&B/Kafe di **Pengaturan (Settings)** dan **Arus Kas (Cash Flow)** dengan tetap menjaga 100% independensi dan zero-regression pada Kafe.

---

## 2. Struktur Arsitektur & File yang Dilibatkan

```
frontend/src/
├── components/
│   ├── Layout.tsx                  <- [SELESAI] Eliminasi duplikasi NavLink /laporan untuk bengkel
│   ├── SettingsView.tsx            <- Guard KDS/printer dapur/minuman & mock preview struk SPK
│   ├── CashFlowModal.tsx           <- Kategori pengeluaran kas adaptif (sparepart/pelumas vs bahan makanan)
│   └── CashFlowView.tsx            <- Badge & ikon adaptif untuk kategori pengeluaran kas
├── verticals/bengkel/
│   ├── BengkelReports.tsx          <- Tambah Grafik Tren Recharts, P&L, Arus Kas, & Tombol Download PDF
│   └── BengkelReportCharts.tsx     <- Komponen grafik Recharts (Jasa vs Part vs Volume SPK)
└── utils/
    ├── bengkelPdfGenerator.ts      <- Generator PDF resmi A4 berkop surat logo, alamat & tabel finansial
    └── pdfGenerator.ts             <- Ganti fallback 'KAFE & RESTORAN' menjadi dinamis/netral

backend/src/
└── routes/bengkel/
    └── reports.ts                  <- Enhanced /summary: hitung dailyTrend & cashflowSummary
```

---

## 3. Rincian Tahapan Eksekusi (Phase by Phase)

### Fase 1: Eliminasi Duplikasi Sidebar & Backend Report Data Expansion
1. **[SELESAI]** Di `Layout.tsx:565`, tautan `/laporan` di bawah kelompok menu SDM telah dibungkus `!isBengkel`.
2. **[SELESAI]** Di `backend/src/routes/bengkel/reports.ts`:
   * Perluas endpoint `GET /api/bengkel/reports/summary`:
     * Agregasi `dailyTrend`: Mengelompokkan per tanggal dalam periode (omzet jasa servis, omzet suku cadang, total omzet, jumlah SPK selesai).
     * Agregasi `cashflowSummary`: Menghitung total kas masuk, kas keluar operasional bengkel (`CashFlow` category EXPENSE), dan saldo kas operasional bersih.
   * Uji sintaks & backend TypeScript build: PASS (`npx tsc --noEmit` exit code 0).

---

### Fase 2: Generator Dokumen PDF Resmi Bengkel (`bengkelPdfGenerator.ts`)
1. **[SELESAI]** Buat utilitas khusus `frontend/src/utils/bengkelPdfGenerator.ts`:
   * Fungsi `exportBengkelReportPDF()`:
     * Muat logo bengkel secara asinkron dari `settings.logoUrl` via HTML Canvas base64.
     * Render header formal: Logo, Nama Bengkel, Alamat Fisik, WhatsApp Hotline, Nomor Dokumen, Periode, dan Nama Admin pencetak.
     * Render tabel Ringkasan Eksekutif P&L (Omzet Jasa, Omzet Part, HPP Part, Laba Kotor, Komisi Mekanik, Beban OPEX, Laba Bersih).
     * Render tabel Evaluasi Performa Mekanik (Unit SPK, Omzet Jasa, % Komisi, Hak Komisi, Pending Komisi).
     * Render tabel Top 10 Suku Cadang Fast-Moving.
     * Render Signature Block (Dibuat Oleh Kasir/Admin & Disetujui Oleh Kepala Bengkel/Owner).
   * Fungsi `exportMechanicCommissionSlipPDF()`:
     * Slip gaji/komisi perorangan mekanik untuk arsip penggajian.
2. **[SELESAI]** Fallback default `pdfGenerator.ts` dinetralkan dari `'KAFE & RESTORAN'` menjadi `'CodePOS Merchant'`.

---

### Fase 3: Upgrade Tampilan Frontend `BengkelReports.tsx`
1. **[SELESAI]** Ditambahkan **Grafik Tren Penjualan Visual (Recharts ComposedChart)**:
   * Bar Biru (`#4f46e5`): Omzet Jasa Servis per hari.
   * Bar Hijau (`#10b981`): Omzet Suku Cadang per hari.
   * Garis Oranye (`#f59e0b`): Volume SPK Selesai (Unit Kendaraan).
2. **[SELESAI]** Ditambahkan **Kartu Ringkasan P&L Operasional** dan **Arus Kas Masuk/Keluar**.
3. **[SELESAI]** Dipasang tombol utama **"Download Laporan PDF Resmi"** di header halaman.
4. **[SELESAI]** Ditambahkan tombol **"Cetak Slip Komisi"** pada baris tabel masing-masing mekanik.

---

### Fase 4: Pembersihan UX Pengaturan (`SettingsView.tsx`)
1. **[SELESAI]** Guard kartu **Printer Dapur (KOT)** dan **Printer Bar (DRINK)** dengan `{!isBengkel && (...)}`.
2. **[SELESAI]** Guard dropdown **Pemetaan Kategori ke Printer Dapur/Bar** dengan `{!isBengkel && (...)}`.
3. **[SELESAI]** Guard opsi **Kustomisasi Minuman (Sugar, Ice, Temperature)** di tab `fitur` dengan `{!isBengkel && (...)}`.
4. **[SELESAI]** Guard seksi **Mode Audit Detail Dapur (Gosong, Tumpah, Basi)** dan **Staff Meal** di tab `inventaris` dengan `{!isBengkel && (...)}`.
5. **[SELESAI]** Disesuaikan **Live Preview Struk Thermal**:
   * Jika `isBengkel`: Tampilkan No. SPK, No. Polisi, KM, Mekanik, Oli Mesin, Kampas Rem, Tune Up, dan Garansi Servis (14 Hari / 1.000 KM).

---

### Fase 5: Pembersihan Arus Kas Operasional (`CashFlowModal.tsx` & `CashFlowView.tsx`)
1. **[SELESAI]** Di `CashFlowModal.tsx`:
   * Menggunakan `useVertical()`.
   * Jika `isBengkel`: Kategori bahan baku digantikan `Suku Cadang & Sparepart` (Ikon `<Package />`), `Oli, Pelumas & Cairan Kimia` (Ikon `<Droplet />`), sub-kategori perlengkapan digantikan `Perawatan Toolkit & Kompresor Pit`, dan preset SDM khusus Bengkel (`Gaji Mekanik`, `Insentif Lembur Pit`).
2. **[SELESAI]** Di `CashFlowView.tsx`:
   * Pengelompokan breakdown pengeluaran adaptif ke otomotif saat `isBengkel`.
   * Filter pill baris atas dan select dropdown adaptif tanpa residu F&B.

---

### Fase 6: Verifikasi Akhir, Uji Bebas Regresi & Build
1. **[SELESAI]** Jalankan `npm run build` di frontend: PASS (Exit code 0, no TS / Vite errors).
2. **[SELESAI]** Jalankan `npx tsc --noEmit` di backend: PASS (Exit code 0, clean compile).
3. **[SELESAI]** Zero-regression verification: Semua guard bersyarat `isBengkel` aman, tenant Kafe tetap mempertahankan fitur F&B 100%.
