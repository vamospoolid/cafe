---
name: standalone-offline-and-apk-synthesis
description: Standar arsitektur, prosedur kompilasi, tata kelola sistem Offline Standalone (Windows .EXE Electron) & Mobile Standalone (Android APK Capacitor), serta siklus hidup upgrade & migrasi database zero-data-loss untuk seluruh tier vertikal MVP (Bengkel, Kafe, Retail, Laundry, Rental) dengan proteksi lisensi Hardware ID dan periodic heartbeat cloud sync.
---

# Skill: Standalone Offline & Android APK Synthesis Engine (Multi-Vertical MVP)

Standar arsitektur, panduan teknis, dan prosedur operasional untuk mengonversi sistem SaaS CodePOS menjadi produk **Offline Standalone (Installer Windows `.exe`)** dan **Aplikasi Android Native (`.apk`)** untuk model bisnis **Beli-Putus (One-Time License)** tanpa ketergantungan internet harian.

---

## 🎯 1. Filosofi & Arsitektur Dual-Target Build

Sistem menggunakan prinsip **"Single Codebase, Dual-Target"** agar developer tidak perlu memelihara dua repositori terpisah:

```
                               ┌────────────────────────────────┐
                               │   CodePOS Unified Codebase     │
                               │  (React Vite + Node Express)   │
                               └───────────────┬────────────────┘
                                               │
                    PILIHAN TARGET SAAT BUILD WAKTU RUNTIME / COMPILATION:
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
    TARGET 1: SAAS CLOUD                                            TARGET 2: OFFLINE STANDALONE
    • Multi-Tenant (PostgreSQL VPS)                                 • Single-Tenant Terkunci (Local SQLite)
    • Subdomain & Cloud JWT Auth                                    • Local Auth di Database Laptop
    • Subscription & Paywall Aktif                                  • Paywall Mati (100% Unlocked Beli-Putus)
    • URL: codenusa.id                                              • File: BengkelPOS-Setup.exe / .apk
```

---

## 🏢 2. Matriks Spesifikasi per Tier Vertikal MVP (Offline Mode)

Setiap vertikal memiliki profil terisolasi saat di-build menjadi `.exe` atau `.apk`:

| Tier Vertikal MVP | Modul Utama yang Diaktifkan | Modul Cloud/SaaS yang Dimatikan | Database Lokal yang Disimpan | Fitur Spesifik Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **BENGKEL** | SPK, Pit Board Servis, 3-Tier Harga (Umum/Mitra/Grosir), Mekanik & Komisi, Riwayat Nopol, Part Requests. | Meja, Dapur KDS, Bahan Baku BOM, Laundry, Subdomain switcher. | `bengkel.db`: WorkOrders, Vehicles, Products (Sparepart), Services, Mechanics, CashFlow. | Cetak Struk SPK Thermal 58/80mm USB, Kick Drawer RJ11, Barcode Scanner. |
| **KAFE & RESTO** | Denah Meja 2D, Dapur KDS, Split Bill, Menu Varian, Bahan Baku & Resep, Kasir Cepat. | Modul SPK Nopol, Laundry kiloan, Surat Jalan DO Toko Bangunan. | `kafe.db`: Orders, OrderItems, Tables, Products, Recipes, Ingredients, Shifts. | Split print dapur vs bar, cetak struk kasir, cetak QR Meja. |
| **RETAIL & BANGUNAN** | Kasir Kilat Barcode, Multi-Satuan (Pcs/Dus/Palet), Surat Jalan DO Armada, Bon Tempo Kontraktor, Rak Gudang. | Meja, Dapur KDS, SPK Mekanik, Mesin Laundry. | `retail.db`: Products, ProductUOMs, Customers, Debts, DeliveryOrders, CashFlow. | Barcode Scanner USB HID (Auto-Enter), Cetak Surat Jalan A4/Thermal. |
| **LAUNDRY** | Timbangan Kg (Desimal), SLA Reguler/Kilat/Express, Varian Parfum, Kanban Rak Simpan, Cuci Satuan. | Meja, Dapur, SPK Kendaraan, Multi-UOM bangunan. | `laundry.db`: LaundryOrders, Customers, Perfumes, Racks, Shifts, PettyCash. | Timbangan Digital Serial COM/Bluetooth, Label Tag Thermal anti-air. |
| **RENTAL / PERSEWAAN** | Kalender Booking, Durasi Sewa Jam/Hari, Uang Jaminan/Deposit, Denda Keterlambatan, Retur Unit. | Dapur, Resep, SPK Kendaraan, Timbangan Laundry. | `rental.db`: RentalOrders, RentalUnits, Customers, Deposits, Shifts. | Cetak Surat Perjanjian Sewa, Struk Deposit Kasir. |

---

## 🔍 3. Analisis Fungsional Sistem (Functional Requirements & Operational Use Cases)

Analisis fungsional merinci bagaimana sistem beroperasi dari sudut pandang peran pengguna (*User Personas*), alur operasional toko harian (*Operational Workflows*), dan batasan fungsionalitas ketika berjalan 100% tanpa internet.

### 3.1. Analisis Kebutuhan Fungsional Berdasarkan Aktor (User Personas)

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

1. **Owner / Pemilik Usaha Beli-Putus**:
   - **FR-OWN-01 (Aktivasi Mandiri)**: Membaca Hardware ID komputer saat booting pertama dan memasukkan Serial Activation Key dari developer.
   - **FR-OWN-02 (Manajemen Katalog & Harga)**: Mengubah harga jual sparepart/menu/layanan (termasuk 3-tier harga bengkel: Umum, Mitra, Grosir) langsung di database lokal.
   - **FR-OWN-03 (Manajemen Staf & Otorisasi)**: Mendaftarkan akun kasir & staf, mengatur 4–6 digit PIN absensi, serta menentukan besaran komisi mekanik (% atau nominal flat).
   - **FR-OWN-04 (Pengaturan Fleksibilitas Toko)**: Memiliki toggle kontrol untuk mematikan modul absensi (`Attendance Mode: ON/OFF`) jika toko dikelola sendiri tanpa karyawan.
   - **FR-OWN-05 (Pelaporan Finansial Komprehensif)**: Menampilkan laporan laba-rugi kotor, rekonsiliasi kas shift, arus kas kas kecil (*Petty Cash*), dan mengekspor ke Excel/PDF lokal.

2. **Kasir / Frontdesk Operator**:
   - **FR-CSR-01 (Buka Shift & Modal Kasir)**: Wajib memasukkan modal awal laci kas (*Cash Float*) sebelum transaksi pertama diizinkan.
   - **FR-CSR-02 (Pencarian Kilat & Barcode HID)**: Menemukan produk via barcode gun scanner otomatis tanpa perlu mengklik kolom pencarian, atau via plat nopol kendaraan (bengkel).
   - **FR-CSR-03 (Multi-Metode Pembayaran)**: Mendukung Tunai (otomatis kalkulasi kembalian), QRIS Statis (foto QR dicetak di struk), dan Bon Tempo / Piutang Pelanggan.
   - **FR-CSR-04 (Direct Hardware Dispatch)**: Mengirim sinyal cetak nota ke printer thermal ESC/POS USB (58mm/80mm) dan memicu tendang laci kas RJ11 secara instan tanpa dialog browser print.
   - **FR-CSR-05 (Tutup Shift & Blind Cash Drop)**: Menginput total fisik uang tunai di laci tanpa melihat angka sistem (*blind reconciliation*), lalu mencetak Z-Report selisih kas.

3. **Mekanik / Operator Cuci / Staf Produksi**:
   - **FR-STF-01 (Adaptive Offline Attendance)**: Mencatatkan jam masuk & pulang via Numpad PIN 4–6 digit atau tap kartu barcode ID pada terminal kasir.
   - **FR-STF-02 (Status Kehadiran Aktif)**: Nama staf otomatis muncul di daftar teknisi aktif hari itu untuk penugasan SPK/servis.
   - **FR-STF-03 (Transparansi Komisi Servis)**: Staf dapat melihat rekap riwayat pengerjaan unit dan akumulasi komisi yang berhak diterima pada hari/minggu berjalan.

4. **Developer SaaS / Platform Admin**:
   - **FR-DEV-01 (Generator Lisensi Kriptografis)**: Menginput Hardware ID klien ke dashboard SaaS `/platform-admin` untuk menghasilkan Serial Activation Key berlisensi RSA.
   - **FR-DEV-02 (On-Demand App Compiler)**: Mengompilasi paket installer `.exe` (NSIS) dan file `.apk` (Capacitor) yang terisolasi khusus per vertikal dalam 1-klik.
   - **FR-DEV-03 (Heartbeat Telemetry & Backup Receiver)**: Menerima metrik kesehatan transaksi dan snapshot database darurat saat perangkat klien mendeteksi jaringan internet.

---

### 3.2. Alur Fungsional Operasional Utama (Core Operational Use Cases)

#### 🔄 UC-01: Alur Booting Pertama & Aktivasi Lisensi Hardware
1. Klien mendownload installer `BengkelPOS-Setup.exe` dan menginstal di laptop toko.
2. Aplikasi dijalankan pertama kali:
   - Engine mengecek `%APPDATA%\CodePOS_BENGKEL\license.key`.
   - Jika belum ada, sistem membaca Serial Motherboard + Processor ID dan menampilkan layar aktivasi:
     *"Hardware ID Anda: `BK-8821-F904-77A1`. Kirim kode ini ke WhatsApp Admin untuk mendapatkan Serial Key."*
3. Developer memasukkan kode tersebut ke generator di dashboard SaaS, menerbitkan serial key (misal `LIC-BENGKEL-9901-XYZ`), dan mengirimkan kembali ke klien.
4. Klien menempelkan serial key ke aplikasi ➔ Lisensi divalidasi secara kriptografis ➔ Aplikasi terbuka permanen selamanya.

#### 🔄 UC-02: Alur Operasional Harian Toko (Absensi ➔ Shift ➔ Transaksi ➔ Tutup Buku)
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

#### 🔄 UC-03: Alur Silent Heartbeat & Penyelamat Data Klien
1. Klien menggunakan aplikasi offline selama berhari-hari tanpa internet.
2. Suatu hari, kasir mengaktifkan hotspot/tethering HP ke laptop kasir selama 1–2 menit.
3. Listener `navigator.onLine` di Electron mendeteksi internet aktif secara senyap:
   - Membaca ringkasan total omset dan jumlah transaksi yang belum dilaporkan.
   - Membuat snapshot database lokal terenkripsi.
   - Mengirim payload ke endpoint SaaS VPS: `POST /api/sync/heartbeat`.
   - Proses berlangsung di latar belakang dalam 3–5 detik tanpa mengganggu kasir yang sedang mengetik.
4. Jika laptop kasir suatu saat rusak total atau tersiram air, developer memiliki snapshot database terakhir di server SaaS untuk dipulihkan ke laptop baru klien.

---

### 3.3. Matriks Batasan Fungsional (Capabilities Boundary: Offline vs Deferred vs Eliminated)

| Kategori Fitur | Mode 100% Mandiri Offline | Mode Sinkronisasi Tertunda (*Deferred*) | Modul yang Dieliminasi dari Cloud |
| :--- | :--- | :--- | :--- |
| **Katalog & Stok** | Tambah/edit produk, potong stok otomatis, opname stok lokal. | Sinkronisasi master katalog pusat (jika cabang multi-outlet). | Sinkronisasi real-time multi-tenant via Socket.IO cloud. |
| **Transaksi & Nota** | Input SPK/penjualan, kalkulasi diskon/pajak, cetak thermal ESC/POS, tendang laci. | Pengiriman e-receipt nota via WhatsApp gateway (antre di outbox sampai ada internet). | Pemrosesan payment gateway online (Midtrans/Xendit kartu kredit). |
| **Absensi & SDM** | Absensi PIN 4-digit, tap barcode ID, rekap komisi mekanik, buka/tutup shift kasir. | Pengiriman rekap kehadiran ke HP Owner via SaaS cloud dashboard. | Validasi GPS Geofencing radius Google Maps dan upload foto selfie CDN. |
| **Finansial** | Pencatatan arus kas operasional (Petty Cash), piutang bon tempo, laporan laba rugi lokal. | Backup snapshot database otomatis saat tethering HP (*Heartbeat*). | Tagihan subscription bulanan SaaS dan paywall pengunci fitur. |

---

## 💾 4. Arsitektur Database Lokal (SQLite Engine & Lokasi Aman)

### 4.1. Isolasi File Database & Proteksi Windows UAC
- **ATURAN MUTLAK**: Dilarang keras menaruh database SQLite di `C:\Program Files\` karena proteksi Windows UAC (*User Account Control*) akan memblokir transaksi tulis kasir.
- **Lokasi Wajib**:
  - Windows: `%APPDATA%\CodePOS_[Vertical]\data\app.db` (misal: `C:\Users\[User]\AppData\Roaming\BengkelPOS\data\bengkel.db`)
  - Android: Internal Storage App Sandbox (`/data/user/0/[package_name]/databases/bengkel.db`)

### 4.2. Skema Prisma SQLite Engine
Saat kompilasi standalone, backend mengalihkan file `schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // "file:%APPDATA%/BengkelPOS/data/bengkel.db"
}
```

### 4.3. Auto-Migration Saat Booting Pertama
Saat aplikasi Electron pertama kali dibuka oleh klien, sistem menjalankan auto-migrasi senyap tanpa membuka terminal:
```typescript
import { execSync } from 'child_process';
export function runLocalDatabaseMigration() {
  try {
    execSync('npx prisma migrate deploy', { stdio: 'ignore' });
  } catch (err) {
    console.error('Local migration warning:', err);
  }
}
```

---

## 🛡️ 5. Proteksi Lisensi Beli-Putus & Anti-Pirasi (Hardware Fingerprint)

Agar file installer `.exe` tidak dicopy-paste gratis ke komputer bengkel lain:

```
[ LAPTOP KLIEN ]                                                 [ DEVELOPER SAAS ]
Membaca Hardware ID (CPU + Motherboard UUID)
                │
                ▼
Kode Aktivasi: `BK-8821-F904-77A1` ────────(Kirim WA)──────────► Masukkan ke License Generator
                                                                            │
Aplikasi Terbuka & Aktif Permanen ◄───────(Kirim Serial Key)────── Serial Lisensi Terenkripsi RSA
```

### 5.1. Komponen Machine Fingerprint:
1. `systeminformation` / WMI Windows membaca:
   - Serial Number Motherboard (`wmic baseboard get serialnumber`)
   - CPU Processor ID (`wmic cpu get processorid`)
2. Menggabungkan string dan membuat SHA-256 Hash.
3. Lisensi tersimpan di `%APPDATA%\CodePOS_[Vertical]\license.key` dalam bentuk terenkripsi.

### 5.2. Deteksi Manipulasi Jam Windows (Clock Tampering Guard)
Kasir nakal dilarang memundurkan jam laptop untuk memanipulasi buku kas atau masa garansi:
```typescript
// Validasi transaksi terhadap timestamp terakhir
const lastTx = await prisma.cashFlow.findFirst({ orderBy: { createdAt: 'desc' } });
if (lastTx && new Date() < new Date(lastTx.createdAt)) {
  throw new Error("Jam sistem komputer tidak valid. Jam komputer telah dimundurkan. Harap sesuaikan tanggal & waktu Windows.");
}
```

---

## 💓 6. Metode "Periodic Heartbeat & Silent Cloud Backup"

Klien bertransaksi 100% offline sepuasnya tanpa kuota internet. Namun sistem dilengkapi fitur **penyelamat data otomatis**:

### 6.1. Alur Sinkronisasi Latar Belakang:
1. **Pendeteksi Jaringan**: Listener memeriksa koneksi internet (`navigator.onLine`).
2. **Saat Klien Tethering HP (1–2 Menit)**:
   - Sistem membaca data transaksi yang belum di-backup.
   - Mengirim payload ringkas ke endpoint SaaS VPS:
     `POST https://codenusa.id/api/sync/heartbeat`
   - Payload:
     ```json
     {
       "licenseKey": "LIC-BENGKEL-8821",
       "hardwareId": "MB-X8821-CPU-9941",
       "tenantSlug": "usahabersama",
       "version": "1.0.2",
       "metrics": {
         "totalOrders": 142,
         "totalRevenue": 18500000,
         "lastTransactionAt": "2026-10-10T14:30:00Z"
       },
       "encryptedSnapshotUrl": "optional_db_backup_blob"
     }
     ```
3. **Grace Period (Toleransi Offline)**:
   - Default: **30 Hari bebas offline**.
   - Jika dalam 30 hari tidak pernah terhubung sama sekali, aplikasi menampilkan popup ramah:
     *"Cadangan data Anda belum diperbarui selama 30 hari. Sambungkan WiFi/tethering HP sebentar (1 menit) untuk mengamankan data dan memvalidasi lisensi."*

---

## 💻 7. Prosedur Build Windows Standalone (.EXE via Electron)

### 7.1. Struktur Folder Standalone Electron:
```
desktop-standalone/
├── package.json
├── electron-builder.json
├── main/
│   ├── index.ts          (Main process Electron, window control, local server launcher)
│   ├── printerService.ts (Direct thermal printing ESC/POS USB & Bluetooth)
│   └── licenseManager.ts (Hardware ID check)
└── resources/
    ├── icon-bengkel.ico
    └── installer-banner.bmp
```

### 7.2. Skrip Kompilasi Windows Installer:
```bash
# Kompilasi installer khusus Bengkel
npm run build:bengkel-exe
```
Konfigurasi `electron-builder.json` menghasilkan installer NSIS modern:
- Menghasilkan: `BengkelPOS-Pro-Setup-v1.0.exe`.
- Auto-create shortcut Desktop & Start Menu.
- Auto-permission write ke `%APPDATA%`.

---

## 📱 8. Prosedur Build APK Android Standalone & Hybrid

### 8.1. Model A: Full Offline Standalone Tablet Android
- Menggunakan `@capacitor-community/sqlite` atau **Dexie (IndexedDB)**.
- Seluruh katalog produk, transaksi SPK, dan riwayat pelanggan tersimpan di storage internal tablet Android.
- Bluetooth printing langsung terhubung via `@capacitor/core` plugin hardware bridge.

### 8.2. Model B: Local LAN Hybrid (Rekomendasi untuk Bengkel Banyak Mekanik)
- **Laptop Kasir**: Bertindak sebagai Local Server di meja depan (menjalankan Electron + SQLite lokal).
- **HP/Tablet Mekanik**: Menginstal APK Android.
- Di halaman koneksi APK, mekanik cukup mengetik IP lokal laptop kasir (misal: `http://192.168.1.15:3000`).
- Mekanik input sparepart di pit servis ➔ Kasir langsung melihat total tagihan di laptop tanpa kuota internet!

### 8.3. Perintah Build APK Branded Otomatis:
```bash
node scripts/generate_branded_apk.js --tenant=usahabersama --target=cashier --env=prod
```
Output:
- File APK tersimpan di: `release/usahabersama-cashier-v1.0.apk`.
- Mipmaps adaptive icons otomatis mengambil logo bengkel klien.

---

## 📊 9. Dashboard SaaS: "App Builder & Licensing Control Plane"

Di dashboard SaaS Admin (`/platform-admin`), developer memiliki kontrol penuh:

1. **Card Manajemen Klien Beli-Putus**:
   - Menampilkan daftar bengkel offline yang aktif.
   - Indikator tanggal terakhir heartbeat / backup cloud.
   - Tombol **[Reset Kunci Hardware]** (jika klien ganti laptop baru).
2. **On-Demand App Compiler Buttons**:
   - **`[ 💻 Generate Installer .EXE ]`** ➔ Memanggil electron-builder per vertikal.
   - **`[ 📱 Generate APK Android ]`** ➔ Memanggil `generate_branded_apk.js`.
   - Menampilkan link unduhan instan dan QR Code untuk scan langsung di HP klien.
3. **Disaster Recovery (Pemulihan Darurat)**:
   - Tombol **`[ ⬇️ Download Database Backup ]`** untuk mengambil cadangan database terakhir jika laptop klien rusak total.

---

## 🔄 10. Tata Kelola Upgrade Sistem Offline & Siklus Rilis (Product Lifecycle & Database Safety)

Ketika developer melakukan upgrade fitur pada MVP (misalnya menambah modul baru di Bengkel, Kafe, atau Retail), sistem harus mampu:
1. **Langsung menyediakan versi terbaru untuk calon pembeli baru** tanpa kompilasi ulang kode dari nol.
2. **Meng-upgrade laptop klien lama tanpa pernah menghapus database atau riwayat transaksi mereka**.

```
                           [ DEVELOPER UPGRADE KODE DI REPO ]
                                (React Vite + Node Prisma)
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
          UNTUK PENJUALAN KLIEN BARU                     UNTUK KLIEN LAMA (EKSISTING)
      • Sekali klik: `npm run build:exe`             • File aplikasi di-update (v1.0 ➔ v1.1)
      • Installer baru langsung memuat fitur baru    • Database `%APPDATA%/bengkel.db` AMAN UTUH
      • Siap dijual beli-putus hari itu juga         • Auto-migration: `prisma migrate deploy`
```

### 10.1. Aturan Pemisahan File Aplikasi vs File Database
- **Folder Instalasi (Volatile / Boleh Ditimpa)**:
  `C:\Program Files\CodePOS_[Vertical]\`
  Berisi binary Electron, asset HTML/CSS, Node runtime. Folder ini bebas ditimpa/di-uninstall saat update.
- **Folder Database (Persistent / Dilarang Keras Ditimpa)**:
  `%APPDATA%\CodePOS_[Vertical]\data\app.db`
  File ini **tidak pernah disentuh atau dihapus oleh installer update**.

### 10.2. Prosedur Auto-Migrasi Skema (Zero-Data-Loss Migration)
Saat aplikasi versi baru pertama kali dijalankan di laptop klien:
1. Engine Electron mendeteksi versi skema database SQLite lokal.
2. Menjalankan migrasi Prisma secara otomatis di background:
   ```typescript
   // Di main process Electron saat app.whenReady()
   import { execSync } from 'child_process';
   export async function ensureDatabaseMigration() {
     try {
       // Menambahkan kolom/tabel baru tanpa merusak data lama
       execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: localSqliteUrl } });
       console.log('✅ Auto-migration SQLite berhasil.');
     } catch (err) {
       console.error('❌ Gagal menjalankan auto-migration:', err);
     }
   }
   ```
3. Seluruh riwayat SPK, nopol, pelanggan, dan stok lama tetap 100% utuh, dan kolom fitur baru langsung aktif!

### 10.3. Dua Pilihan Jalur Distribusi Pembaruan ke Klien
1. **Jalur A: Over-The-Air (OTA Auto-Updater via Tethering Internet)**
   - Menggunakan library `electron-updater`.
   - Di server SaaS VPS (`codenusa.id`), upload file rilis: `latest.yml` dan `Setup-v1.1.exe`.
   - Saat laptop klien terhubung WiFi/tethering HP sebentar, aplikasi mendeteksi versi baru:
     > *"Tersedia pembaruan Versi 1.1 (Perbaikan Cetak Struk). Perbarui sekarang?"*
   - Klien klik **Ya** ➔ download patch senyap di background ➔ restart dalam 5 detik.
2. **Jalur B: Manual Patch Installer (Untuk Bengkel 100% Nol Internet)**
   - Developer mengirim file installer update `Update-BengkelPOS-v1.1.exe` via WhatsApp / Flashdisk.
   - Klien cukup double-click installer tersebut. NSIS installer otomatis menimpa file program di `Program Files` dan mempertahankan `%APPDATA%\...\app.db`.

### 10.4. Strategi Bisnis: Pembaruan Gratis vs Upgrade Berbayar
- **Minor Patch (v1.0.1 ➔ v1.0.2)**: Gratis sebagai bagian dari garansi purna jual & stabilitas.
- **Major Upgrade (BengkelPOS 2026 ➔ BengkelPOS 2027)**:
  - Dijual sebagai paket upgrade lisensi (misal Rp 250.000 – Rp 500.000).
  - Installer v2.0 meminta Serial Activation Key baru dari developer sebelum mengizinkan pembaruan struktur database.
  - Menjadi sumber **pendapatan berulang (*recurring revenue*)** tahunan bagi developer SaaS dari klien beli-putus.

---

## 📋 11. Checklist Task & SOP Pengerjaan (Confirmable TODO)

Gunakan checklist ini saat mempersiapkan paket rilis offline dan siklus upgrade:

- [ ] **Fase 1: Database & Standalone Routing**
  - [ ] Konfigurasi skema Prisma SQLite (`file:./data/app.db`).
  - [ ] Buat runtime env switcher (`VITE_STANDALONE_VERTICAL=BENGKEL`).
  - [ ] Kunci `tenantId` ke `'standalone'` dan nonaktifkan paywall/langganan.
- [ ] **Fase 2: Hardware Driver & Cetak Struk**
  - [ ] Integrasikan ESC/POS direct USB printing (lebar 58mm & 80mm).
  - [ ] Tambahkan sinyal tendang laci kasir RJ11 (`0x1B 0x70`).
  - [ ] Hubungkan scanner barcode USB HID auto-enter.
- [ ] **Fase 3: Lisensi & Hardware ID**
  - [ ] Modul pembaca CPU & Motherboard serial number.
  - [ ] Generator RSA / HMAC license key di dashboard developer.
  - [ ] Guard anti clock tampering (pengecekan tanggal mundur).
- [ ] **Fase 4: Heartbeat & Cloud Backup**
  - [ ] Endpoint `POST /api/sync/heartbeat` di server SaaS.
  - [ ] Background uploader saat laptop mendeteksi internet aktif.
- [ ] **Fase 5: Kompilasi, Auto-Updater & Prosedur Upgrade**
  - [ ] Script builder Electron NSIS Windows `.exe`.
  - [ ] Script builder Capacitor Android `.apk` dengan branded mipmaps.
  - [ ] Auto-migration SQLite (`prisma migrate deploy`) saat booting versi baru.
  - [ ] Konfigurasi `electron-updater` (OTA patch delivery) di server SaaS.
  - [ ] UI terpadu di Dashboard Platform Admin untuk build 1-klik & manajemen lisensi.
