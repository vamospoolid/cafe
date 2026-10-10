# Master Implementation Plan & Master Todo List
# Standalone Offline (.EXE) & Mobile (.APK) Multi-Vertical Engine

**Kode Dokumen**: `DOC-STANDALONE-OFFLINE-PLAN-v2`  
**Target Sistem**: Windows Standalone (.EXE via Electron NSIS) & Android Standalone/Hybrid (.APK via Capacitor)  
**Model Bisnis**: Beli-Putus (*One-Time Perpetual License*) dengan Opsi Annual Upgrade & Periodic Cloud Backup  
**Tier Vertikal MVP**: Bengkel Motor/Mobil, Kafe & Resto (F&B), Retail & Toko Bangunan, Jasa Laundry, Rental/Persewaan  
**Referensi Skill**: [`.agents/skills/standalone-offline-and-apk-synthesis/SKILL.md`](file:///c:/ADATA/codepos/.agents/skills/standalone-offline-and-apk-synthesis/SKILL.md)  

---

## 📑 Daftar Isi
1. [Analisis Fungsional Sistem & Kebutuhan Pengguna](#-1-analisis-fungsional-sistem--kebutuhan-pengguna)
2. [Tata Kelola Absensi Karyawan & Shift Kasir pada Mode Offline](#-2-tata-kelola-absensi-karyawan--shift-kasir-pada-mode-offline)
3. [Arsitektur Dual-Target Build & Spesifikasi 5 MVP Vertikal](#-3-arsitektur-dual-target-build--spesifikasi-5-mvp-vertikal)
4. [Arsitektur Teknis Database, Lisensi & Silent Backup](#-4-arsitektur-teknis-database-lisensi--silent-backup)
5. [Rencana Implementasi Bertahap (6-Phase Implementation Plan)](#-5-rencana-implementasi-bertahap-6-phase-implementation-plan)
6. [Master Actionable TODO List (Trackable Checkboxes)](#-6-master-actionable-todo-list-trackable-checkboxes)
7. [SOP Pengujian (QA Testing) & Mitigasi Risiko](#-7-sop-pengujian-qa-testing--mitigasi-risiko)

---

## 🔍 1. Analisis Fungsional Sistem & Kebutuhan Pengguna

Analisis fungsional ini merinci seluruh kapabilitas sistem dari perspektif 4 aktor pengguna (*User Personas*), alur operasional toko harian (*Operational Use Cases*), dan pemetaan batas fungsional (*Capabilities Boundary*).

### 1.1. Pemetaan Kebutuhan Fungsional per Aktor (*User Personas*)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AKTOR & PERAN SISTEM STANDALONE OFFLINE                         │
├───────────────────┬───────────────────┬──────────────────────┬─────────────────────────┤
│ 👑 OWNER BISNIS   │ 💻 KASIR / FRONT  │ 🔧 MEKANIK / STAF    │ 🛡️ SAAS DEVELOPER       │
│ • Aktivasi Lisensi│ • Buka Shift Kas  │ • Absensi PIN Pad    │ • Issue License Key RSA │
│ • Atur Harga/Katalog • Kasir Kilat POS│ • Ambil SPK / Servis │ • Compile .EXE / .APK   │
│ • Rekap Laba/Komisi • Cetak Struk USB │ • Ambil Sparepart    │ • Pantau Heartbeat Tele │
│ • Ekspor Lap. XLS │ • Blind Z-Report  │ • Pantau Komisi Harian│ • Disaster Recovery DB  │
└───────────────────┴───────────────────┴──────────────────────┴─────────────────────────┘
```

#### 👑 Aktor 1: Owner / Pemilik Usaha Beli-Putus
- **FR-OWN-01 (Aktivasi Lisensi Mandiri)**: Membaca Hardware ID saat aplikasi pertama kali diinstal di laptop toko, mengirimkan kode via WhatsApp, dan memasukkan Serial Activation Key untuk aktivasi permanen.
- **FR-OWN-02 (Manajemen Katalog & 3-Tier Harga)**: Mengatur daftar barang/jasa dan tier harga (Umum, Mitra/Pelanggan Tetap, Grosir) langsung di database lokal SQLite tanpa koneksi cloud.
- **FR-OWN-03 (Manajemen Staf & Hak Akses)**: Mendaftarkan staf/kasir/mekanik, menentukan PIN absensi 4–6 digit, dan mengatur skema komisi (% jasa atau nominal tetap).
- **FR-OWN-04 (Kontrol Fleksibilitas Toko)**: Toggle kontrol di menu Pengaturan: `Mode Absensi (ON/OFF)`. Jika toko dikelola mandiri tanpa karyawan, modul absensi dapat dimatikan dengan 1 klik.
- **FR-OWN-05 (Pelaporan Finansial Komprehensif)**: Menampilkan laporan laba-rugi kotor, rekonsiliasi kas shift, arus kas kas kecil (*Petty Cash*), dan mengekspor ke Excel/PDF lokal.

#### 💻 Aktor 2: Kasir / Frontdesk Operator
- **FR-CSR-01 (Buka Shift & Modal Kasir)**: Wajib menginput modal awal kas di laci (*Cash Float*) sebelum memulai transaksi pertama di hari tersebut.
- **FR-CSR-02 (Pencarian Kilat & Barcode HID)**: Mencari produk/part secara otomatis via pemindai barcode gun nirkabel/USB tanpa perlu mengklik form pencarian dengan kursor mouse.
- **FR-CSR-03 (Multi-Metode Pembayaran)**: Mendukung Tunai (otomatis kalkulasi uang kembalian), QRIS Statis (foto QR dicetak di struk nota), dan Bon Tempo / Piutang Pelanggan.
- **FR-CSR-04 (Direct Hardware Dispatch)**: Cetak struk otomatis ke printer thermal ESC/POS USB (58mm/80mm) dan kirim pulsa tendang laci kas RJ11 secara instan tanpa dialog browser print.
- **FR-CSR-05 (Tutup Shift & Blind Cash Drop)**: Menginput hitungan fisik uang kertas & koin di laci tanpa melihat estimasi sistem (*blind reconciliation*), lalu mencetak Z-Report selisih kas.

#### 🔧 Aktor 3: Mekanik / Operator Cuci / Staf Teknis
- **FR-STF-01 (Adaptive Offline Attendance)**: Mencatatkan kehadiran jam masuk & pulang via Numpad PIN 4–6 digit atau scan kartu ID barcode di terminal kasir.
- **FR-STF-02 (Status Kehadiran Aktif)**: Nama staf otomatis terdaftar di dropdown teknisi aktif hari itu untuk penugasan SPK/servis.
- **FR-STF-03 (Transparansi Komisi Servis)**: Staf dapat melihat rekap unit yang telah dikerjakan dan akumulasi komisi yang berhak diterima pada hari/minggu berjalan.

#### 🛡️ Aktor 4: Developer SaaS / Platform Admin
- **FR-DEV-01 (Generator Lisensi Kriptografis)**: Menginput Hardware ID klien ke dashboard SaaS `/platform-admin` untuk menghasilkan Serial Activation Key berlisensi RSA.
- **FR-DEV-02 (On-Demand App Compiler)**: Mengompilasi paket installer `.exe` (NSIS) dan file `.apk` (Capacitor) yang terisolasi khusus per vertikal dalam 1-klik.
- **FR-DEV-03 (Heartbeat Telemetry & Backup Receiver)**: Menerima metrik kesehatan transaksi dan snapshot database darurat saat perangkat klien mendeteksi jaringan internet.

---

### 1.2. Alur Fungsional Operasional Utama (*Operational Use Cases*)

#### 🔄 UC-01: First-Boot Activation & Hardware Binding
```
[ LAPTOP KLIEN ]                                                 [ DEVELOPER SAAS ]
Installer .EXE Dibuka Pertama Kali
Membaca Hardware ID (CPU + Mobo UUID)
                │
                ▼
Tampil Layar: `BK-8821-F904-77A1` ────────(Kirim WA)──────────► Masukkan ke Generator /platform-admin
                                                                            │
Aplikasi Terbuka & Aktif Permanen ◄───────(Kirim Serial Key)────── Serial Lisensi Terenkripsi RSA
```

#### 🔄 UC-02: Siklus Harian Toko (Absensi ➔ Shift ➔ Transaksi ➔ Tutup Buku)
```
[ 08:00 PAGI: BUKA TOKO ]
Staf / Mekanik Ketik PIN 4 Digit di Kasir ──► Hadir Tercatat di SQLite Lokal (Anti-Tamper Clock)
                 │
                 ▼
Kasir Buka Shift & Masukkan Modal Awal Laci (Misal: Rp 200.000)
                 │
                 ▼
[ 08:30 - 17:00: TRANSAKSI HARIAN 100% TANPA INTERNET ]
Pelanggan Datang ──► Buat SPK / Scan Barcode ──► Pilih Mekanik Aktif ──► Cetak Struk USB Thermal
                 │
                 ▼
[ 17:00 SORE: TUTUP TOKO & REKONSILIASI ]
Kasir Tutup Shift ──► Hitung Uang Fisik di Laci (Blind Cash Drop) ──► Cetak Z-Report Selisih Kas
                 │
                 ▼
Staf / Mekanik Ketik PIN 4 Digit Pulang ──► Komisi Hari Ini Terkunci Otomatis
```

#### 🔄 UC-03: Silent Periodic Heartbeat & Penyelamat Data Klien
1. Klien bertransaksi 100% offline berhari-hari tanpa internet.
2. Kasir mengaktifkan hotspot/tethering HP ke laptop kasir selama 1–2 menit.
3. Listener `navigator.onLine` di Electron mendeteksi internet aktif secara senyap:
   - Membaca ringkasan total omset dan jumlah transaksi yang belum dilaporkan.
   - Membuat snapshot database lokal terenkripsi.
   - Mengirim payload ke endpoint SaaS VPS: `POST /api/sync/heartbeat`.
   - Proses berlangsung di latar belakang dalam 3–5 detik tanpa mengganggu kasir yang sedang mengetik.
4. Jika laptop kasir suatu saat rusak total atau tersiram air, developer memiliki snapshot database terakhir di server SaaS untuk dipulihkan ke laptop baru klien.

---

### 1.3. Matriks Batasan Fungsional (*Capabilities Boundary*)

| Kategori Fitur | Mode 100% Mandiri Offline | Mode Ditangguhkan (*Deferred*) | Modul yang Dieliminasi dari Cloud |
| :--- | :--- | :--- | :--- |
| **Katalog & Stok** | Tambah/edit harga, potong stok otomatis, opname stok lokal. | Sinkronisasi master katalog pusat (multi-outlet). | Real-time Socket.IO sync lintas tenant. |
| **Transaksi & Nota** | Input SPK/penjualan, kalkulasi diskon/pajak, cetak thermal USB, tendang laci. | Pengiriman e-receipt WhatsApp (antre sampai ada internet). | Gateway kartu kredit online (Midtrans/Xendit). |
| **Absensi & SDM** | PIN pad 4-digit, scan barcode ID staf, komisi mekanik, shift drawer kasir. | Pengiriman rekap kehadiran ke HP Owner via Cloud. | Validasi GPS geofencing & upload foto selfie CDN. |
| **Finansial** | Arus kas operasional (Petty Cash), buku bon tempo, laba rugi lokal. | Backup snapshot database otomatis saat tethering HP. | Paywall & penagihan langganan SaaS bulanan. |

---

## 👥 2. Tata Kelola Absensi Karyawan & Shift Kasir pada Mode Offline

### 2.1. Rationale: Kenapa Absensi Tidak Boleh Dihilangkan?
Absensi karyawan adalah **tulang punggung perhitungan komisi mekanik dan akuntabilitas uang laci kasir**:
- **Bengkel**: Setiap SPK Servis membutuhkan penugasan mekanik yang bertugas. Jika absensi dihapus, sistem tidak dapat menentukan mekanik mana yang standby, dan kalkulasi bagi hasil/komisi mekanik harian akan rusak.
- **Kasir Semua Vertikal**: Kasir yang clock-in otomatis memegang tanggung jawab atas uang fisik di laci kas. Saat clock-out, sistem membandingkan penjualan kasir dengan fisik uang di laci kas (rekonsiliasi shift).
- **Penggajian**: Pemilik toko offline tetap memerlukan rekap kehadiran bulanan untuk penggajian atau uang makan harian.

### 2.2. Spesifikasi Teknis Absensi Offline Adaptif

```
┌────────────────────────────────────────────────────────────────────────┐
│               ALUR ABSENSI TERMINAL KASIR (OFFLINE PIN / BARCODE)      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Mekanik / Kasir berdiri di depan laptop kasir                       │
│ 2. Klik tombol "Absensi Staf" atau scan kartu barcode ID staf          │
│ 3. Ketik PIN 4–6 Digit pada Numpad layar sentuh                        │
│ 4. Backend lokal SQLite validasi PIN ke tabel `User` lokal             │
│ 5. Validasi Clock Tampering: Waktu sistem >= Waktu transaksi terakhir │
│ 6. Catat Clock-In di tabel `Attendance` lokal                          │
│ 7. Mekanik langsung muncul di dropdown "Mekanik Aktif" pada SPK!      │
└────────────────────────────────────────────────────────────────────────┘
```

1. **GPS & Kamera Dinonaktifkan**: Parameter `enableGpsValidation = false` dan `enableCameraPhoto = false` secara otomatis saat aplikasi berjalan dalam mode standalone.
2. **Clock Tampering Guard**: Sistem memeriksa transaksi terakhir di tabel `CashFlow` atau `WorkOrder`. Jika jam Windows sengaja dimundurkan oleh staf nakal, aplikasi menolak clock-in dan memunculkan peringatan kalibrasi jam.
3. **Toggle Fleksibel**: Pada `SettingsView.tsx`, pemilik usaha perseorangan (*solo operator*) dapat mematikan fitur absensi jika toko tidak memiliki karyawan.

---

## 🏛️ 3. Arsitektur Dual-Target Build & Spesifikasi 5 MVP Vertikal

Sistem tetap menggunakan prinsip **Single Codebase, Dual-Target Build**:

```
                           ┌───────────────────────────────────────────────┐
                           │      Unified CodePOS Repository (Monorepo)    │
                           │       (React 19 Vite + Node Express Prisma)   │
                           └───────────────────────┬───────────────────────┘
                                                   │
                   BUILD SCRIPT SELECTOR (Berdasarkan Target & Mode Vertikal):
                                                   │
        ┌──────────────────────────────────────────┴──────────────────────────────────────────┐
        ▼                                                                                     ▼
[ 1. TARGET WINDOWS STANDALONE (.EXE) ]                               [ 2. TARGET ANDROID STANDALONE (.APK) ]
• Runtime: Electron Packaging (NSIS Installer)                         • Runtime: Capacitor Native Shell
• Backend: Local Express Server (Port 3001)                            • Engine: Local SQLite / Dexie IndexedDB
• DB: `%APPDATA%\CodePOS_[Vertical]\data\app.db`                       • DB: Internal Sandbox Storage Android
• Driver: Direct ESC/POS USB, RJ11 Drawer, HID Scanner                 • Driver: Bluetooth SPP Classic / Camera MLKit
```

### 3.1. Matriks Spesifikasi per Tier Vertikal MVP (Offline Mode)

| Tier Vertikal MVP | Modul Utama yang Diaktifkan | Modul Cloud/SaaS yang Dimatikan | Database Lokal yang Disimpan | Fitur Spesifik Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **BENGKEL** | SPK, Pit Board Servis, 3-Tier Harga (Umum/Mitra/Grosir), Mekanik & Komisi, Riwayat Nopol, Part Requests. | Meja, Dapur KDS, Bahan Baku BOM, Laundry, Subdomain switcher. | `bengkel.db`: WorkOrders, Vehicles, Products (Sparepart), Services, Mechanics, CashFlow. | Cetak Struk SPK Thermal 58/80mm USB, Kick Drawer RJ11, Barcode Scanner. |
| **KAFE & RESTO** | Denah Meja 2D, Dapur KDS, Split Bill, Menu Varian, Bahan Baku & Resep, Kasir Cepat. | Modul SPK Nopol, Laundry kiloan, Surat Jalan DO Toko Bangunan. | `kafe.db`: Orders, OrderItems, Tables, Products, Recipes, Ingredients, Shifts. | Split print dapur vs bar, cetak struk kasir, cetak QR Meja. |
| **RETAIL & BANGUNAN** | Kasir Kilat Barcode, Multi-Satuan (Pcs/Dus/Palet), Surat Jalan DO Armada, Bon Tempo Kontraktor, Rak Gudang. | Meja, Dapur KDS, SPK Mekanik, Mesin Laundry. | `retail.db`: Products, ProductUOMs, Customers, Debts, DeliveryOrders, CashFlow. | Barcode Scanner USB HID (Auto-Enter), Cetak Surat Jalan A4/Thermal. |
| **LAUNDRY** | Timbangan Kg (Desimal), SLA Reguler/Kilat/Express, Varian Parfum, Kanban Rak Simpan, Cuci Satuan. | Meja, Dapur, SPK Kendaraan, Multi-UOM bangunan. | `laundry.db`: LaundryOrders, Customers, Perfumes, Racks, Shifts, PettyCash. | Timbangan Digital Serial COM/Bluetooth, Label Tag Thermal anti-air. |
| **RENTAL / PERSEWAAN** | Kalender Booking, Durasi Sewa Jam/Hari, Uang Jaminan/Deposit, Denda Keterlambatan, Retur Unit. | Dapur, Resep, SPK Kendaraan, Timbangan Laundry. | `rental.db`: RentalOrders, RentalUnits, Customers, Deposits, Shifts. | Cetak Surat Perjanjian Sewa, Struk Deposit Kasir. |

---

## 💾 4. Arsitektur Teknis Database, Lisensi & Silent Backup

### 4.1. Lokasi Database SQLite & Pencegahan Crash UAC Windows
- **ATURAN MUTLAK**: Dilarang keras menaruh file SQLite di dalam `C:\Program Files\` karena proteksi Windows UAC (*User Account Control*) akan memblokir hak tulis kasir saat transaksi!
- **Lokasi Penyimpanan Resmi**:
  - Windows: `%APPDATA%\CodePOS_[Vertical]\data\app.db`
  - Android: Sandbox Internal App Storage (`/data/user/0/[package_name]/databases/app.db`)

### 4.2. Dual-Datasource Prisma Engine
- Skema PostgreSQL Cloud: `backend/prisma/schema.prisma`
- Skema SQLite Standalone: `backend/prisma/schema.sqlite.prisma`
  ```prisma
  datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL") // "file:%APPDATA%/CodePOS_BENGKEL/data/app.db"
  }
  ```

### 4.3. Proteksi Lisensi Hardware ID (Anti-Copy Paste)
1. Aplikasi membaca:
   - Serial Number Motherboard: `wmic baseboard get serialnumber`
   - CPU Processor ID: `wmic cpu get processorid`
2. String digabungkan dan di-hash SHA-256 menjadi Hardware ID klien (misal `BK-8821-F904-77A1`).
3. Developer memasukkan Hardware ID ke generator di dashboard SaaS `/platform-admin` untuk menghasilkan Serial Activation Key berlisensi RSA.
4. Serial Key disimpan di `%APPDATA%\CodePOS_[Vertical]\license.key`.

### 4.4. Silent Heartbeat & Emergency Cloud Backup
- Listener `navigator.onLine` memeriksa konektivitas internet secara berkala.
- Saat laptop mendeteksi internet (klien tethering HP 1–2 menit), sistem mengirim ringkasan transaksi & snapshot database terenkripsi ke SaaS VPS: `POST /api/sync/heartbeat`.
- Toleransi masa offline: **30 hari bebas offline murni**. Peringatan ramah muncul jika >30 hari belum pernah tethering.

---

## 🗺️ 5. Rencana Implementasi Bertahap (6-Phase Implementation Plan)

### 🔹 FASE 1: Core Engine, SQLite & Standalone Routing Isolation
**Tujuan**: Memastikan backend dan frontend dapat berjalan 100% tanpa PostgreSQL VPS, menggunakan SQLite lokal di `%APPDATA%`, dan login offline instan tanpa paywall.
- **File Terkait**:
  - `backend/prisma/schema.sqlite.prisma` (baru)
  - `backend/src/utils/localDatabasePaths.ts` (baru)
  - `backend/src/middlewares/authMiddleware.ts`
  - `backend/src/services/FeatureService.ts`
- **Langkah Kerja**:
  1. Buat skema Prisma SQLite yang kompatibel dengan seluruh model tabel inti.
  2. Buat utility resolver folder `%APPDATA%\CodePOS_[Vertical]\data\` dengan auto-create directory jika belum ada.
  3. Kunci mode standalone: jika `process.env.STANDALONE_MODE === 'true'`, kunci `tenantId = 'standalone'`.
  4. Nonaktifkan paywall di `FeatureService.ts` untuk seluruh modul pada vertikal yang sedang aktif.
  5. Buat runner auto-migrasi senyap `runLocalDatabaseMigration()` via `npx prisma migrate deploy` saat booting awal.

---

### 🔹 FASE 2: Adaptive Offline Attendance, Shift Kasir & Mekanik Integration
**Tujuan**: Menghadirkan terminal absensi offline PIN pad & barcode scanner yang terintegrasi dengan penugasan SPK bengkel dan pembukaan shift kasir.
- **File Terkait**:
  - `backend/src/routes/attendance.ts`
  - `frontend/src/components/ClockInModal.tsx`
  - `frontend/src/verticals/bengkel/WorkOrderView.tsx`
  - `frontend/src/components/POSView.tsx`
  - `frontend/src/components/SettingsView.tsx`
- **Langkah Kerja**:
  1. Modifikasi `attendance.ts` agar otomatis membypass validasi GPS dan upload foto selfie saat mode standalone aktif.
  2. Perkuat UI `ClockInModal.tsx`: sediakan Numpad PIN 4–6 digit layar sentuh dan listener barcode scanner untuk tap kartu staf.
  3. Hubungkan log absensi dengan modul SPK Bengkel: filter dropdown mekanik yang bertugas hanya memuat mekanik yang hadir hari ini.
  4. Hubungkan absensi dengan shift kasir: prompt input modal awal laci kas (*Cash Float*) saat clock-in, dan prompt hitung fisik kas (*Blind Z-Report*) saat clock-out.
  5. Terapkan Clock Tampering Guard pada backend: tolak clock-in jika jam sistem komputer lebih lampau daripada timestamp transaksi terakhir.
  6. Sediakan toggle `Aktifkan Absensi Karyawan (ON/OFF)` di `SettingsView.tsx`.

---

### 🔹 FASE 3: Hardware Peripheral Drivers (Printer, Drawer, Scanner)
**Tujuan**: Menghubungkan kasir langsung ke printer thermal USB, laci kasir RJ11, dan pemindai barcode nirkabel tanpa dialog browser print.
- **File Terkait**:
  - `desktop-standalone/main/printerService.ts` (baru)
  - `frontend/src/utils/printerBluetooth.ts`
  - `frontend/src/utils/hardwareBarcodeListener.ts`
- **Langkah Kerja**:
  1. Buat direct USB ESC/POS thermal printing service di Electron untuk kertas 58mm (32 kolom) dan 80mm (48 kolom).
  2. Kirim sinyal pulsa drawer kick RJ11 (`\x1b\x70\x00\x19\xfa`) setiap transaksi tunai selesai.
  3. Perkuat driver Bluetooth SPP Classic di Capacitor untuk tablet kasir & printer mobile Android.
  4. Integrasikan Global HID Keystroke Buffer di `hardwareBarcodeListener.ts` agar barcode gun scanner langsung memasukkan barang ke keranjang tanpa fokus kursor mouse.

---

### 🔹 FASE 4: Anti-Piracy Hardware Licensing & Heartbeat Telemetry
**Tujuan**: Mengamankan installer beli-putus agar terkunci pada motherboard & CPU laptop klien, serta mengamankan backup data darurat.
- **File Terkait**:
  - `desktop-standalone/main/licenseManager.ts` (baru)
  - `backend/src/routes/sync.ts` (baru)
  - `frontend/src/components/ActivationModal.tsx` (baru)
- **Langkah Kerja**:
  1. Implementasikan pembacaan Serial Motherboard & Processor ID via WMI di Electron.
  2. Buat algoritma verifikasi lisensi kriptografis RSA/HMAC menggunakan public/private key.
  3. Buat UI `ActivationModal.tsx` cantik yang memunculkan Hardware ID dan form input Serial Activation Key saat aplikasi belum teraktivasi.
  4. Buat endpoint penerima heartbeat di VPS SaaS: `POST /api/sync/heartbeat` yang menyimpan omset ringkas dan snapshot database terenkripsi.
  5. Buat background worker yang otomatis menembak heartbeat saat laptop mendeteksi koneksi internet (tethering HP 1–2 menit).

---

### 🔹 FASE 5: Packaging & Build Automation Pipeline
**Tujuan**: Mengompilasi installer Windows `.exe` (NSIS) dan file `.apk` (Capacitor) yang terisolasi khusus per vertikal dalam 1-klik perintah.
- **File Terkait**:
  - `desktop-standalone/package.json` & `electron-builder.json` (baru)
  - `scripts/build_standalone_exe.js` (baru)
  - `scripts/generate_branded_apk.js`
- **Langkah Kerja**:
  1. Konfigurasi `electron-builder.json` dengan installer NSIS Windows:
     - Folder instalasi binary: `C:\Program Files\CodePOS_[Vertical]\`
     - Folder persistent database: `%APPDATA%\CodePOS_[Vertical]\data\`
  2. Buat skrip kompilasi per vertikal:
     - `npm run build:bengkel-exe`
     - `npm run build:kafe-exe`
     - `npm run build:retail-exe`
     - `npm run build:laundry-exe`
     - `npm run build:rental-exe`
  3. Konfigurasi `scripts/generate_branded_apk.js` untuk build APK Android standalone per vertikal dengan icon adaptive mipmaps khusus.

---

### 🔹 FASE 6: Zero-Data-Loss Upgrade Lifecycle & Control Plane UI
**Tujuan**: Memastikan developer dapat meng-upgrade aplikasi klien lama tanpa pernah menghapus database mereka, serta menyediakan panel kontrol di dashboard SaaS.
- **File Terkait**:
  - `desktop-standalone/main/updaterService.ts` (baru)
  - `frontend/src/components/PlatformAdminDashboard.tsx`
- **Langkah Kerja**:
  1. Uji skenario upgrade: installer update menimpa binary aplikasi di `Program Files`, sedangkan file `%APPDATA%\...\app.db` tetap 100% utuh.
  2. Implementasikan auto-migration saat app versi baru dijalankan: Prisma otomatis mengeksekusi `prisma migrate deploy` di background untuk menambah tabel/kolom baru.
  3. Konfigurasi `electron-updater` untuk dukungan pembaruan Over-The-Air (OTA) saat laptop klien tethering internet.
  4. Bangun UI di dashboard SaaS Platform Admin (`/platform-admin`):
     - Tab **Klien Beli-Putus Offline**.
     - Generator Serial Lisensi (Input Hardware ID ➔ Output Serial Key).
     - Tombol 1-klik build installer `.exe` dan `.apk`.
     - Fitur Disaster Recovery: Unduh snapshot database klien dari backup heartbeat terakhir.

---

## 📋 6. Master Actionable TODO List (Trackable Checkboxes)

### 📌 FASE 1: Core Database & Standalone Routing Engine
- [x] Buat file skema Prisma SQLite: `backend/prisma/schema.sqlite.prisma`.
- [x] Buat helper lokasi database aman: `backend/src/utils/localDatabasePaths.ts` (`%APPDATA%` di Windows & Sandbox di Android).
- [x] Buat switcher environment variable: `STANDALONE_VERTICAL` (`BENGKEL` | `KAFE` | `RETAIL` | `LAUNDRY` | `RENTAL`).
- [x] Kunci mode `tenantId = 'standalone'` dan bypass subdomain resolver di mode standalone.
- [x] Bypass paywall langganan di `FeatureService.ts` untuk seluruh modul pada tier vertikal aktif.
- [x] Buat runner migrasi senyap `runLocalDatabaseMigration()` di Electron main process saat aplikasi booting.

### 📌 FASE 2: Adaptive Offline Attendance & Shift Drawer Integration
- [x] Modifikasi `backend/src/routes/attendance.ts`:
  - [x] Auto-bypass `enableGpsValidation` dan `enableCameraPhoto` jika mode standalone aktif.
  - [x] Validasi PIN / Barcode staf berbasis tabel `User` lokal di SQLite.
- [x] Perkuat `frontend/src/components/ClockInModal.tsx`:
  - [x] Numpad PIN 4–6 digit layar sentuh yang responsif.
  - [x] Listener barcode scanner kasir untuk auto-clockin via kartu ID barcode staf.
- [x] Hubungkan log absensi dengan modul SPK Bengkel (`WorkOrderForm.tsx` & `POSBengkel.tsx`):
  - [x] Dropdown mekanik memprioritaskan dan menandai teknisi yang hadir hari ini (`🟢 [Nama] (Hadir)`).
  - [x] Perhitungan komisi mekanik otomatis terhubung ke mekanik yang clock-in.
- [x] Hubungkan log absensi dengan Kasir & Petty Cash Drawer:
  - [x] Prompt modal awal laci kas (Cash Float) saat kasir clock-in dan buka shift kasir.
  - [x] Prompt hitung fisik kas dan cetak Blind Z-Report saat kasir clock-out shift di POS Bengkel & Kafe.
- [x] Terapkan Clock Tampering Guard pada backend:
  - [x] Blokir aksi jika jam sistem komputer lebih lampau daripada timestamp transaksi terakhir.
- [x] Sediakan toggle konfigurasi di `SettingsView.tsx`:
  - [x] `Aktifkan Absensi Karyawan (ON/OFF)` untuk toko milik solo operator.

### 📌 FASE 3: Hardware Peripheral Drivers (Printer, Drawer, Scanner)
- [x] Buat modul print Electron `desktop-standalone/main/printerService.ts`:
  - [x] Direct USB printing ESC/POS untuk ukuran kertas 58mm & 80mm via Windows raw spooler.
  - [x] Cetak nota tanpa popup jendela browser print via Electron IPC bridge.
  - [x] Kirim pulsa tendang laci kasir RJ11 (`\x1b\x70\x00\x19\xfa` pin 2 & 5) otomatis setiap transaksi tunai.
- [x] Perkuat driver Bluetooth Android & Electron bridge di `frontend/src/utils/printerBluetooth.ts` & `PrinterContext.tsx`.
- [x] Integrasikan Global HID Keystroke Buffer di `frontend/src/utils/hardwareBarcodeListener.ts` untuk seluruh modul kasir (Retail, Bengkel, Rental) agar pemindaian barcode langsung masuk keranjang tanpa klik mouse.

### 📌 FASE 4: Proteksi Lisensi Anti-Pirasi & Heartbeat Telemetry
- [x] Buat modul pembaca Hardware ID di `desktop-standalone/main/licenseManager.ts`:
  - [x] Ekstrak serial number Motherboard & CPU via WMI command.
  - [x] Generate string Hardware ID unik klien (misal `BK-8821-F904-77A1`).
- [x] Buat modul verifikasi lisensi kriptografis RSA/HMAC:
  - [x] Validasi file lisensi `%APPDATA%\CodePOS_[Vertical]\license.key`.
  - [x] Buat UI aktivasi `ActivationModal.tsx` jika aplikasi belum teraktivasi.
- [x] Bangun endpoint backend di SaaS VPS:
  - [x] `POST /api/sync/heartbeat` di `backend/src/routes/sync.ts`.
  - [x] Terima metrik omset ringkas dan snapshot database terenkripsi.
- [x] Buat background worker uploader di frontend/electron:
  - [x] Deteksi koneksi internet (`navigator.onLine`).
  - [x] Kirim payload heartbeat saat terhubung internet (tethering HP 1–2 menit).
  - [x] Tampilkan pengingat ramah jika masa offline melebihi batas 30 hari.

### 📌 FASE 5: Packaging & Build Automation Pipeline
- [x] Setup folder `desktop-standalone/`:
  - [x] `package.json` dan `electron-builder.json`.
  - [x] Skrip build installer NSIS untuk 5 vertikal:
    - [x] Bengkel: `build:bengkel-exe`
    - [x] Kafe: `build:kafe-exe`
    - [x] Retail: `build:retail-exe`
    - [x] Laundry: `build:laundry-exe`
    - [x] Rental: `build:rental-exe`
- [x] Pastikan konfigurasi NSIS memisahkan:
  - [x] Folder binary: `C:\Program Files\CodePOS_[Vertical]\`
  - [x] Folder persistent database: `%APPDATA%\CodePOS_[Vertical]\data\`
- [x] Perbarui `scripts/generate_branded_apk.js` untuk build APK Android standalone per vertikal.
- [x] Uji kompilasi installer Windows `.exe` dan instalasi pada PC bersih (*clean environment*).

### 📌 FASE 6: Zero-Data-Loss Upgrade Lifecycle & Control Plane UI
- [ ] Uji coba skenario upgrade aplikasi:
  - [ ] Instal versi v1.0 ➔ Input 10 transaksi SPK ➔ Instal versi v1.1 di atasnya.
  - [ ] Pastikan 10 transaksi tetap utuh dan kolom database baru termigrasi sempurna.
- [ ] Konfigurasi `electron-updater` untuk dukungan Over-The-Air (OTA) patch saat tethering internet.
- [ ] Bangun UI Dashboard Admin di SaaS `/platform-admin`:
  - [ ] Tab **Klien Offline & Beli-Putus**.
  - [ ] Generator Serial Lisensi (Input Hardware ID ➔ Output License Key).
  - [ ] Status Heartbeat & Tanggal Terakhir Backup Klien.
  - [ ] Tombol Download Cadangan Database Darurat (*Disaster Recovery*).

---

## 🛡️ 7. SOP Pengujian (QA Testing) & Mitigasi Risiko

| Skenario Pengujian | Langkah Pengujian | Kriteria Sukses (Passed) |
| :--- | :--- | :--- |
| **1. Uji Proteksi UAC Windows** | Buka aplikasi dengan user Windows standar (*Non-Administrator*). Tambah produk baru dan buat transaksi penjualan. | Transaksi tersimpan mulus di `%APPDATA%` tanpa pesan error *EACCES: permission denied*. |
| **2. Uji Absensi Offline Murni** | Matikan seluruh koneksi internet (Airplane mode). Buka modal absensi ➔ ketik PIN staf. | Clock-in berhasil tercatat di SQLite lokal, dan nama mekanik langsung muncul di dropdown SPK. |
| **3. Uji Anti Clock Tampering** | Mundurkan tanggal Windows 3 hari ke belakang. Coba lakukan transaksi kasir atau clock-in. | Sistem menolak aksi dan memunculkan notifikasi peringatan: *"Jam sistem tidak valid. Sesuaikan tanggal & waktu Windows."* |
| **4. Uji Anti-Pirasi Hardware** | Copy folder aplikasi ke laptop lain tanpa memasukkan serial key baru. | Aplikasi terkunci dan menampilkan modal aktivasi dengan Hardware ID laptop baru tersebut. |
| **5. Uji Upgrade Zero-Data-Loss** | Tambahkan kolom baru pada skema SQLite. Jalankan installer update v1.1 menimpa versi v1.0. | Data transaksi lama tetap 100% utuh, tabel baru termigrasi, dan aplikasi berjalan normal. |
| **6. Uji Silent Heartbeat Sync** | Nyalakan tethering HP selama 2 menit pada laptop kasir yang telah melakukan transaksi offline. | Sistem otomatis mengirim metrik omset ke SaaS VPS di latar belakang tanpa mengganggu kasir. |

---
*Dokumen Master Plan ini adalah panduan kerja resmi untuk kompilasi Offline Standalone & APK Android CodePOS. Tersimpan dan tersinkronisasi di branch `saas`.*
