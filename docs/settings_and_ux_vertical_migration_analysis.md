# Audit UX Frontend, Terminologi Migrasi, Pengaturan & Blueprint Laporan Bengkel
## CodePOS Multi-Tenant SaaS: Kafe & Resto vs Bengkel Motor & Mobil

---

## 1. Ringkasan Eksekutif & Eliminasi Duplikasi Sidebar

### A. Masalah Duplikasi Laporan di Sidebar
Pada sidebar navigasi (`Layout.tsx`), saat tenant bertipe `BENGKEL` aktif, terdapat 2 tombol laporan:
1. **Navigasi Utama Bengkel**: Menampilkan `Laporan Bengkel` (`/bengkel/laporan`).
2. **Kelompok Menu SDM**: Menampilkan `Laporan` (`/laporan`).
* **Akar Masalah**: Rute `/laporan` diarahkan ke komponen `ReportViewAdaptive.tsx` yang secara otomatis mengalihkan (redirect) ke `BengkelReports.tsx`. Akibatnya, kedua menu di sidebar membuka halaman yang 100% identik. Selain itu, meletakkan laporan finansial di dalam kelompok menu "SDM" tidak sesuai dengan taksonomi POS.
* **Solusi**: Bungkus tautan `NavLink to="/laporan"` pada seksi SDM dengan `{!isBengkel && (...)}`. Untuk tenant Bengkel, hanya 1 menu laporan yang tampil, yaitu **Laporan Bengkel** pada posisi menu operasional utama.

---

## 2. Blueprint Komprehensif: Bentuk Laporan Bengkel

Perbedaan mendasar antara **Dashboard** dan **Laporan**:
* **Dashboard (Real-time Snapshot)**: Memantau kondisi hari ini (SPK yang sedang dikerjakan di pit, antrean menunggu sparepart, kas masuk hari ini, alert stok kritis). Tujuannya adalah kecepatan operasional harian.
* **Laporan (Deep Financial & Analytic Audit)**: Analisis retrospektif berdasarkan rentang waktu (Bulan Ini, 7 Hari, Kuartal, atau Custom Date Range) dengan audit mendalam atas margin jasa vs sparepart, laba kotor, arus kas riil, evaluasi produktivitas mekanik, serta dokumen cetak resmi PDF A4 untuk arsip owner/investor.

Berikut adalah 5 pilar laporan yang ideal untuk modul **Laporan Bengkel**:

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

---

### Pilar 1: Grafik Tren Penjualan & Volume SPK (Sales Trend Chart)
* **Visualisasi Recharts**:
  * Bar Chart / Composed Area Chart harian:
    * Warna Ungu/Biru: **Omzet Jasa Servis**
    * Warna Hijau/Emerald: **Omzet Suku Cadang**
    * Garis Oranye/Amber: **Jumlah SPK Selesai (Unit Kendaraan)**
* **Wawasan Bisnis untuk Owner**:
  * Mengetahui pola hari ramai vs hari sepi (misal: lonjakan hari Sabtu-Minggu untuk servis berkala).
  * Mengetahui rasio pendapatan bengkel (apakah bengkel lebih banyak meraup margin dari jasa murni atau dari penjualan sparepart).

---

### Pilar 2: Laporan Laba Rugi Operasional Bengkel (P&L Statement)
Format ringkas standar akuntansi otomotif:
1. **PENDAPATAN USAHA (REVENUE)**:
   * Omzet Jasa Servis (Margin 100% - tidak ada HPP)
   * Omzet Penjualan Suku Cadang & Pelumas
   * *Total Omzet Bersih*
2. **HARGA POKOK PENJUALAN (HPP / COGS)**:
   * Biaya Beli Modal Suku Cadang Terpasang
   * *Laba Kotor (Gross Profit)*
3. **BEBAN LANGSUNG OPERASIONAL**:
   * Beban Komisi Mekanik (Hak pengerjaan servis)
   * *Laba Setelah Komisi*
4. **BEBAN PENGELUARAN KAS (OPEX BENGKEL dari Petty Cash)**:
   * Biaya listrik, air, internet pit
   * Perlengkapan operasional (sabun cuci part, majun, bensin pembersih)
   * Konsumsi staf, perbaikan kompresor / toolkit
5. **ESTIMASI LABA BERSIH OPERASIONAL (NET OPERATING PROFIT)**.

---

### Pilar 3: Laporan Arus Kas Bengkel (Cash Flow Integration)
* Mengintegrasikan data pencatatan pengeluaran kas (`CashFlow`):
  * **Arus Kas Masuk (Cash In)**: Penerimaan tunai & transfer langsung dari pembayaran SPK kasir.
  * **Arus Kas Keluar (Cash Out)**: Belanja sparepart lokal dadakan, pencairan komisi mekanik, biaya operasional.
  * **Net Cash Flow**: Saldo kas bersih yang dihasilkan bengkel dalam periode terpilih.

---

### Pilar 4: Evaluasi Produktivitas & Payroll Komisi Mekanik
* Tabel audit performa mekanik:
  * Nama Mekanik & Status
  * Jumlah SPK Ditangani (Unit Kendaraan)
  * Omzet Jasa yang Dihasilkan
  * Skema Komisi (% atau flat nominal)
  * Hak Komisi Periode Berjalan
  * Akumulasi Komisi Belum Dicairkan (*Pending Commission*)
* **Aksi Cepat**: Tombol Cetak / Unduh Rekap Komisi Mekanik untuk kebutuhan penggajian bulanan.

---

### Pilar 5: Valuasi Suku Cadang & Fast-Moving Stock
* 10 Suku Cadang Terlaris (*Top Moving Parts*): volume keluar, kontribusi margin keuntungan, sisa stok gudang, dan indikator kritis (*Min-Stock Warning*).
* Valuasi Aset Suku Cadang: Total nilai modal yang mengendap di rak bengkel.

---

### Pilar 6: Ekspor Dokumen Resmi PDF dengan Cop Surat Lengkap (Letterhead)
Dukungan penuh pembacaan identitas outlet:
* **Kiri Header**: Logo resmi bengkel (membaca dari `settings.logoUrl` secara asinkronus via canvas base64) dengan fallback aksen warna primer.
* **Teks Kiri**:
  * Nama Bengkel (Bold, kapital, font 14pt).
  * Alamat Lengkap Bengkel (jalan, nomor, kota).
  * Nomor WhatsApp / Telepon Hotline Servis.
* **Kanan Header**:
  * Judul Dokumen: `LAPORAN PERFORMA & KEUANGAN BENGKEL`
  * Nomor Dokumen: `DOC/BKL/YYYYMM/XXXX`
  * Periode: Tanggal Awal s/d Tanggal Akhir
  * Waktu Cetak & Nama Pemeriksa (User Login)
* **Badan Dokumen**:
  * Ringkasan Eksekutif Finansial (Tabel P&L)
  * Rincian Evaluasi Komisi per Mekanik
  * Tabel 10 Sparepart Fast-Moving
* **Footer & Tanda Tangan**:
  * Kotak tanda tangan sah: *Dibuat Oleh (Kasir/Admin)* dan *Disetujui Oleh (Kepala Bengkel/Owner)*.
  * Catatan kaki: *Dokumen resmi terkomputerisasi sistem CodePOS Bengkel*.

---

## 3. Matriks Penyesuaian Modul Pengaturan (Settings)

| Tab Settings | Kafe | Bengkel | Aksi Penyesuaian |
|:---|:---|:---|:---|
| **struk** | Layar KDS, Printer Dapur KOT, Printer Bar | Printer Kasir / SPK saja | Eliminasi blok KDS dan kartu Printer Dapur/Bar untuk bengkel. |
| **struk** (Preview) | Meja 05, Tori Paitan Ramen, Gyoza | No. Polisi, KM, Mekanik, Oli, Kampas Rem, Garansi | Ganti Live Preview Struk menjadi format struk SPK bengkel. |
| **fitur** | Kustomisasi Minuman (Sugar, Ice) | Tiering Harga Grosir / Garansi | Eliminasi opsi minuman untuk bengkel. |
| **inventaris** | Resep gram/ml, Audit Koki, Staff Meal | Stok Satuan Pcs/Botol, Alert Reorder | Sembunyikan resep bahan mentah & audit koki untuk bengkel. |
| **bagi_hasil** | Bagi Hasil Dapur (Kitchen) & Bar | Bagi Hasil Bengkel & Komisi Mekanik | Ubah label divisi F&B menjadi pembagian hasil operasional bengkel. |

---

## 4. Rencana Kerja Selanjutnya (Action Items)

1. **Task 1: Sidebar Deduplication**:
   * Hapus/guard tautan `/laporan` di bawah kelompok menu SDM pada `Layout.tsx` ketika `isBengkel === true`.
2. **Task 2: Backend Enhancement (`/api/bengkel/reports/summary`)**:
   * Tambahkan agregasi tren harian (`dailyTrend`: omzet jasa, omzet part, jumlah SPK per hari).
   * Tambahkan agregasi arus kas pengeluaran operasional (`cashflowSummary`).
3. **Task 3: Frontend Enhancement (`BengkelReports.tsx`)**:
   * Tambahkan grafik visual tren penjualan (Recharts) memisahkan Jasa vs Sparepart.
   * Tambahkan tab Ringkasan P&L & Arus Kas.
   * Tambahkan tombol **"Cetak / Unduh PDF Laporan"**.
4. **Task 4: Generator PDF Laporan Bengkel (`pdfGenerator.ts`)**:
   * Buat fungsi `exportBengkelReportPDF` yang membaca logo, nama bengkel, alamat, telepon, tabel finansial, dan evaluasi mekanik.
5. **Task 5: Hardening Pengaturan (`SettingsView.tsx`) & Arus Kas (`CashFlowModal.tsx`)**:
   * Terapkan guard eliminasi opsi dapur & sesuaikan preview thermal struk bengkel.
