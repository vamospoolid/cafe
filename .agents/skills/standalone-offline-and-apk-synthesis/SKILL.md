---
name: standalone-offline-and-apk-synthesis
description: Standar arsitektur, prosedur kompilasi, dan tata kelola sistem Offline Standalone (Windows .EXE Electron) & Mobile Standalone (Android APK Capacitor) untuk seluruh tier vertikal MVP (Bengkel, Kafe, Retail, Laundry, Rental), mencakup database lokal SQLite, proteksi lisensi Hardware ID, auto-migration, dan periodic heartbeat cloud sync.
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

## 💾 3. Arsitektur Database Lokal (SQLite Engine & Lokasi Aman)

### 3.1. Isolasi File Database & Proteksi Windows UAC
- **ATURAN MUTLAK**: Dilarang keras menaruh database SQLite di `C:\Program Files\` karena proteksi Windows UAC (*User Account Control*) akan memblokir transaksi tulis kasir.
- **Lokasi Wajib**:
  - Windows: `%APPDATA%\CodePOS_[Vertical]\data\app.db` (misal: `C:\Users\[User]\AppData\Roaming\BengkelPOS\data\bengkel.db`)
  - Android: Internal Storage App Sandbox (`/data/user/0/[package_name]/databases/bengkel.db`)

### 3.2. Skema Prisma SQLite Engine
Saat kompilasi standalone, backend mengalihkan file `schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // "file:%APPDATA%/BengkelPOS/data/bengkel.db"
}
```

### 3.3. Auto-Migration Saat Booting Pertama
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

## 🛡️ 4. Proteksi Lisensi Beli-Putus & Anti-Pirasi (Hardware Fingerprint)

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

### 4.1. Komponen Machine Fingerprint:
1. `systeminformation` / WMI Windows membaca:
   - Serial Number Motherboard (`wmic baseboard get serialnumber`)
   - CPU Processor ID (`wmic cpu get processorid`)
2. Menggabungkan string dan membuat SHA-256 Hash.
3. Lisensi tersimpan di `%APPDATA%\CodePOS_[Vertical]\license.key` dalam bentuk terenkripsi.

### 4.2. Deteksi Manipulasi Jam Windows (Clock Tampering Guard)
Kasir nakal dilarang memundurkan jam laptop untuk memanipulasi buku kas atau masa garansi:
```typescript
// Validasi transaksi terhadap timestamp terakhir
const lastTx = await prisma.cashFlow.findFirst({ orderBy: { createdAt: 'desc' } });
if (lastTx && new Date() < new Date(lastTx.createdAt)) {
  throw new Error("Jam sistem komputer tidak valid. Jam komputer telah dimundurkan. Harap sesuaikan tanggal & waktu Windows.");
}
```

---

## 💓 5. Metode "Periodic Heartbeat & Silent Cloud Backup"

Klien bertransaksi 100% offline sepuasnya tanpa kuota internet. Namun sistem dilengkapi fitur **penyelamat data otomatis**:

### 5.1. Alur Sinkronisasi Latar Belakang:
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

## 💻 6. Prosedur Build Windows Standalone (.EXE via Electron)

### 6.1. Struktur Folder Standalone Electron:
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

### 6.2. Skrip Kompilasi Windows Installer:
```bash
# Kompilasi installer khusus Bengkel
npm run build:bengkel-exe
```
Konfigurasi `electron-builder.json` menghasilkan installer NSIS modern:
- Menghasilkan: `BengkelPOS-Pro-Setup-v1.0.exe`.
- Auto-create shortcut Desktop & Start Menu.
- Auto-permission write ke `%APPDATA%`.

---

## 📱 7. Prosedur Build APK Android Standalone & Hybrid

### 7.1. Model A: Full Offline Standalone Tablet Android
- Menggunakan `@capacitor-community/sqlite` atau **Dexie (IndexedDB)**.
- Seluruh katalog produk, transaksi SPK, dan riwayat pelanggan tersimpan di storage internal tablet Android.
- Bluetooth printing langsung terhubung via `@capacitor/core` plugin hardware bridge.

### 7.2. Model B: Local LAN Hybrid (Rekomendasi untuk Bengkel Banyak Mekanik)
- **Laptop Kasir**: Bertindak sebagai Local Server di meja depan (menjalankan Electron + SQLite lokal).
- **HP/Tablet Mekanik**: Menginstal APK Android.
- Di halaman koneksi APK, mekanik cukup mengetik IP lokal laptop kasir (misal: `http://192.168.1.15:3000`).
- Mekanik input sparepart di pit servis ➔ Kasir langsung melihat total tagihan di laptop tanpa kuota internet!

### 7.3. Perintah Build APK Branded Otomatis:
```bash
node scripts/generate_branded_apk.js --tenant=usahabersama --target=cashier --env=prod
```
Output:
- File APK tersimpan di: `release/usahabersama-cashier-v1.0.apk`.
- Mipmaps adaptive icons otomatis mengambil logo bengkel klien.

---

## 📊 8. Dashboard SaaS: "App Builder & Licensing Control Plane"

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

## 📋 9. Checklist Task & SOP Pengerjaan (Confirmable TODO)

Gunakan checklist ini saat mempersiapkan paket rilis offline:

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
- [ ] **Fase 5: Kompilasi & Installer Builder**
  - [ ] Script builder Electron NSIS Windows `.exe`.
  - [ ] Script builder Capacitor Android `.apk` dengan branded mipmaps.
  - [ ] UI terpadu di Dashboard Platform Admin untuk build 1-klik.
