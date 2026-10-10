# Master Implementation Plan & Todo List: Standalone Offline (.EXE) & Mobile (.APK) Multi-Vertical Engine

Dokumen arsitektur, panduan implementasi teknis bertahap, dan master checklist TODO untuk membangun sistem **Offline Standalone (Installer Windows `.exe` Electron)** dan **Aplikasi Android Mobile (`.apk` Capacitor)** untuk model bisnis **Beli-Putus (One-Time License)** pada 5 tier vertikal MVP (Bengkel, Kafe, Retail, Laundry, Rental) dengan proteksi lisensi Hardware ID, absensi adaptif, dan periodic heartbeat cloud sync.

---

## 🧭 1. Tanya-Jawab Kritis: Bagaimana Nasib Absensi Karyawan di Mode Offline?

### Apakah Absensi Dihilangkan di Mode Offline?
> **JAWABAN TEGAS: TIDAK DIHILANGKAN, MELAINKAN DIADAPTASI MENJADI "OFFLINE PIN/BARCODE TERMINAL" (ADAPTIVE OFFLINE ATTENDANCE).**

Menghapus fitur absensi secara membabi-buta pada mode offline akan **merusak ekosistem operasional toko/bengkel**:
1. **Di Bengkel Motor & Mobil**:
   - Fitur Surat Perintah Kerja (SPK / Work Order) membutuhkan pemilihan **"Mekanik yang Aktif/Masuk Hari Ini"**.
   - Perhitungan komisi mekanik (misal 30% dari jasa servis/pasang sparepart) dihitung berdasarkan shift dan kehadiran mekanik. Jika absensi dihapus, modul pembagian komisi dan rekap pendapatan mekanik menjadi berantakan.
2. **Di Kafe, Retail & Laundry**:
   - Transaksi kasir mewajibkan adanya penanggung jawab shift kasir.
   - Saat kasir melakukan absensi/clock-in, sistem otomatis membuka **Drawer Kas (Petty Cash Shift)**. Saat pulang (clock-out), sistem mencetak **Blind Z-Report Rekonsiliasi Kas**.
   - Menghilangkan absensi akan menghilangkan akuntabilitas selisih uang fisik di laci kasir.
3. **Kebutuhan Penggajian & Uang Makan (Payroll Lokal)**:
   - Pemilik usaha offline tetap membutuhkan rekap kehadiran untuk membayar gaji bulanan atau uang makan harian karyawan secara akurat.

---

### Matriks Adaptasi: Absensi SaaS Cloud vs Mode Offline Standalone

| Fitur Absensi | Versi SaaS Cloud (Online) | Versi Offline Standalone (.EXE / .APK) | Rationale / Alasan Teknis |
| :--- | :--- | :--- | :--- |
| **Validasi Geofencing GPS** | ✅ Wajib (Cek radius toko via Google Maps API) | ❌ **DINONAKTIFKAN** | Komputer kasir / tablet kasir fisiknya **sudah berada di dalam toko/bengkel**, sehingga cek GPS tidak relevan & boros dependensi. |
| **Upload Foto Selfie Kamera** | ✅ Upload ke Cloud CDN / Storage Server | ❌ **DINONAKTIFKAN / OPSIONAL WEBCAM LOKAL** | Mencegah pembengkakan penyimpanan lokal laptop dan tidak memerlukan koneksi internet untuk mengunggah gambar. |
| **Metode Input Kehadiran** | Login HP masing-masing staf via Staff PWA | ✅ **PIN Pad 4–6 Digit & Barcode Scan Langsung di Kasir** | Mekanik/kasir cukup mengetik PIN di layar kasir (`ClockInModal`) atau tap kartu barcode ID ke scanner kasir. |
| **Penyimpanan Data Log** | PostgreSQL Cloud VPS | ✅ **Database Lokal SQLite (`app.db`)** | Disimpan seketika di tabel `Attendance` tanpa lag jaringan. |
| **Validasi Waktu / Jam Masuk** | Server NTP Cloud | ✅ **Local Clock + Anti-Clock Tampering Guard** | Sistem memvalidasi bahwa waktu Windows tidak dimundurkan sengaja oleh staf nakal. |
| **Sinkronisasi ke Cloud** | Real-time via WebSocket / Polling | ✅ **Background Silent Sync saat Tethering HP** | Rekap absensi otomatis terkirim ke cloud saat laptop terhubung internet mingguan/bulanan. |
| **Toggle Aktivasi Toko** | Diatur oleh sistem SaaS | ✅ **Bebas On/Off di Menu Pengaturan Toko** | Jika toko dijaga sendiri oleh pemilik (tanpa karyawan), fitur absensi dapat dinonaktifkan dalam 1-klik. |

---

## 🏛️ 2. Arsitektur Dual-Target Build & Isolasi 5 MVP Vertikal

Sistem tetap menggunakan prinsip **Single Codebase, Dual-Target Build**:
- **Target 1: SaaS Cloud (codenusa.id)**: Multi-Tenant PostgreSQL, subdomain dynamic router, paywall & billing engine aktif.
- **Target 2: Offline Standalone (.exe & .apk)**: Single-Tenant terkunci, Local SQLite di `%APPDATA%`, 100% unlocked beli-putus tanpa paywall.

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

### Matriks Konfigurasi per Tier Vertikal:
1. **BENGKEL MOTOR & MOBIL**:
   - *Modul Aktif*: SPK, Pit Board Servis, 3-Tier Harga (Umum/Bengkel/Grosir), Mekanik & Komisi, Riwayat Nopol, Part Request, Cash Flow.
   - *Modul Nonaktif*: Dapur KDS, Denah Meja, BOM Resep Kafe, Laundry Kiloan.
2. **KAFE & RESTORAN (F&B)**:
   - *Modul Aktif*: Denah Meja 2D, Dapur KDS, Split Bill, Menu Varian, Bahan Baku & Resep (BOM), Shift Kasir, Petty Cash.
   - *Modul Nonaktif*: SPK Nopol, Komisi Mekanik, Timbangan Laundry, Surat Jalan Toko Bangunan.
3. **RETAIL, GROSIR & TOKO BANGUNAN**:
   - *Modul Aktif*: Kasir Kilat Barcode HID, Multi-Satuan (Pcs/Dus/Palet), Surat Jalan DO, Bon Tempo Kontraktor (AR Ledger), Rak Gudang.
   - *Modul Nonaktif*: Denah Meja, Dapur KDS, SPK Servis, Mesin Cuci Laundry.
4. **JASA LAUNDRY**:
   - *Modul Aktif*: Timbangan Kg Desimal, SLA Reguler/Kilat/Express, Varian Parfum, Kanban Rak Simpan, Cuci Satuan.
   - *Modul Nonaktif*: SPK Kendaraan, Dapur KDS, Multi-UOM Bangunan.
5. **RENTAL & PERSEWAAN**:
   - *Modul Aktif*: Kalender Booking, Durasi Sewa Jam/Hari, Uang Jaminan/Deposit, Denda Keterlambatan, Retur Unit.
   - *Modul Nonaktif*: Resep Makanan, Dapur KDS, SPK Bengkel.

---

## 🗺️ 3. Rencana Implementasi Bertahap (6-Phase Implementation Plan)

### 🔹 FASE 1: Core Standalone & Database Engine Isolation
Tujuan: Memastikan backend dan frontend dapat berjalan 100% tanpa PostgreSQL VPS, menggunakan SQLite lokal, dan login offline instan.
- **1.1. Dual-Datasource Prisma Switcher**:
  - Konfigurasi skema SQLite lokal `backend/prisma/schema.sqlite.prisma` dengan provider `sqlite` dan url `file:%APPDATA%/CodePOS/data/app.db`.
  - Skrip build otomatis yang menyalin skema yang tepat saat kompilasi standalone.
- **1.2. Local Storage Safe-Path Resolution**:
  - Utility pembaca direktori aman:
    - Windows: `path.join(process.env.APPDATA, 'CodePOS_' + vertical, 'data')`.
    - Cegah error izin Windows UAC (`C:\Program Files` dilarang untuk simpan database).
- **1.3. Single-Tenant Mode Hardcoding**:
  - Bypass subdomain resolver saat `STANDALONE_MODE=true`. Kunci `tenantId = 'standalone'` secara internal.
  - Bypass paywall dan masa langganan (`FeatureService` otomatis mengembalikan seluruh modul unlocked untuk vertikal terpilih).
- **1.4. Silent First-Boot Auto-Migration**:
  - Eksekusi `prisma migrate deploy` secara senyap di background saat pertama kali aplikasi dibuka tanpa memunculkan jendela terminal hitam.

---

### 🔹 FASE 2: Adaptive Offline Attendance & Shift Drawer Integration
Tujuan: Menyediakan terminal absensi karyawan offline yang mulus, mendukung SPK bengkel dan shift kasir tanpa dependensi cloud.
- **2.1. Adaptasi Backend Attendance (`backend/src/routes/attendance.ts`)**:
  - Deteksi mode offline standalone: Otomatis bypass `enableGpsValidation` dan `enableCameraPhoto`.
  - Validasi PIN staf berbasis data user lokal (`User.pin` atau `StaffMember.pin`).
- **2.2. Terminal Absensi PIN Pad & Barcode Scanner (`frontend/src/components/ClockInModal.tsx`)**:
  - Integrasikan numpad cepat 4–6 digit.
  - Integrasikan listener barcode scanner kasir: mekanik/staf cukup men-scan kartu ID staf mereka untuk langsung clock-in/out seketika.
- **2.3. Integrasi Dropdown Mekanik Aktif di SPK Bengkel**:
  - Pada pembuatan SPK bengkel, filter otomatis mekanik yang berstatus `HADIR HARI INI` berdasarkan log absensi lokal hari tersebut.
  - Rekap komisi mekanik otomatis terhubung ke mekanik yang clock-in.
- **2.4. Integrasi Shift Kasir & Petty Cash Drawer**:
  - Saat kasir clock-in, prompt modal: *"Buka Shift Kasir Baru? Masukkan Modal Awal Laci Kas (Cash Float)"*.
  - Saat kasir clock-out, otomatis cetak *Blind Z-Report* rekonsiliasi kas.
- **2.5. Clock Tampering Guard (Anti-Manipulasi Jam Komputer)**:
  - Cek timestamp log absensi dan transaksi terakhir. Jika jam Windows dimundurkan, munculkan alert: *"Jam sistem tidak valid. Harap sesuaikan tanggal & waktu Windows Anda."*

---

### 🔹 FASE 3: Hardware Abstraction & POS Peripheral Drivers
Tujuan: Menghubungkan kasir standalone langsung ke printer thermal USB, laci kasir RJ11, dan scanner barcode tanpa browser print dialog.
- **3.1. Direct USB ESC/POS Thermal Printing (Windows Electron)**:
  - Layanan cetak langsung ke port USB printer (tanpa dialog print Windows Ctrl+P).
  - Dukungan ukuran kertas 58mm (32 karakter) dan 80mm (48 karakter).
  - Auto-cutter paper command (`\x1d\x56\x00`).
- **3.2. RJ11 Cash Drawer Kick Trigger**:
  - Kirim sinyal pulsa drawer kick (`\x1b\x70\x00\x19\xfa`) setiap transaksi tunai selesai atau kasir menekan tombol "Buka Laci" (dengan otorisasi PIN supervisor).
- **3.3. Android Bluetooth Thermal SPP Classic (Capacitor APK)**:
  - Driver Bluetooth SPP auto-reconnect untuk tablet Android kasir & staf.
- **3.4. Barcode Scanner USB HID Global Keystroke Buffer**:
  - Tangkap input scanner barcode berkecapatan tinggi (< 45ms antar karakter) langsung masuk ke keranjang kasir / form pencarian part tanpa perlu klik mouse.

---

### 🔹 FASE 4: Proteksi Lisensi Anti-Pirasi & Periodic Heartbeat Sync
Tujuan: Mengamankan software beli-putus agar tidak dicopy gratis ke komputer lain, serta menyelamatkan data transaksi klien jika laptop rusak.
- **4.1. Hardware ID Fingerprint Generator**:
  - Modul pembaca hardware: Serial Motherboard (`wmic baseboard get serialnumber`) + Processor ID (`wmic cpu get processorid`).
  - Hashing SHA-256 menjadi string ringkas: `BK-8821-F904-77A1`.
- **4.2. Kriptografi Lisensi RSA / HMAC**:
  - Klien mengirim Kode Hardware ke WhatsApp developer.
  - Developer memasukkan kode ke "License Generator" di dashboard SaaS `/platform-admin`.
  - Diterbitkan file lisensi / serial key `license.key` yang disimpan di `%APPDATA%\...\license.key`.
- **4.3. Silent Periodic Heartbeat Sync (Penyelamat Data Klien)**:
  - Listener jaringan background: Cek `navigator.onLine`.
  - Saat laptop klien terhubung WiFi/tethering HP sebentar (1-2 menit), sistem otomatis mengirim ringkasan omset dan snapshot database terenkripsi ke endpoint SaaS VPS: `POST /api/sync/heartbeat`.
  - Toleransi offline: 30 hari bebas offline. Notifikasi pengingat ramah jika >30 hari belum pernah tethering.

---

### 🔹 FASE 5: Packaging & Build Automation Pipeline
Tujuan: Membangun executable `.exe` Windows dan paket `.apk` Android dalam 1 perintah otomatis.
- **5.1. Setup Electron Wrapper Standalone (`desktop-standalone/`)**:
  - Konfigurasi `electron-builder.json` dengan installer NSIS.
  - Setup script build per vertikal:
    - `npm run build:bengkel-exe`
    - `npm run build:kafe-exe`
    - `npm run build:retail-exe`
    - `npm run build:laundry-exe`
    - `npm run build:rental-exe`
- **5.2. Setup Capacitor Android Standalone (`mobile/`)**:
  - Konfigurasi script `scripts/generate_branded_apk.js` untuk build APK per vertikal dengan icon adaptive mipmaps khusus.
- **5.3. Pemisahan Folder Instalasi vs Folder Database**:
  - Folder Instalasi (Boleh ditimpa saat update): `C:\Program Files\CodePOS_[Vertical]\`.
  - Folder Database (HARAM ditimpa saat update): `%APPDATA%\CodePOS_[Vertical]\data\app.db`.

---

### 🔹 FASE 6: Zero-Data-Loss Upgrade Lifecycle & Control Plane UI
Tujuan: Mempermudah developer menjual versi baru kepada klien baru, serta meng-upgrade klien lama tanpa pernah menghapus database mereka.
- **6.1. Mekanisme Zero-Data-Loss Update**:
  - Installer pembaruan NSIS dikonfigurasi hanya memperbarui binary aplikasi di `Program Files`.
  - Saat aplikasi versi baru pertama kali dibuka, jalankan `npx prisma migrate deploy` di background untuk menambahkan tabel/kolom baru tanpa merusak data lama.
- **6.2. Jalur Distribusi Pembaruan**:
  - **Jalur A (OTA Auto-Updater via Tethering)**: Klien klik "Perbarui" saat laptop tethering internet ➔ aplikasi update otomatis dalam 10 detik.
  - **Jalur B (Manual Patch Installer)**: Developer kirim file `Update-BengkelPOS-v1.1.exe` via WA/Flashdisk untuk toko yang 100% tanpa internet.
- **6.3. Platform Admin Control Plane UI (`/platform-admin`)**:
  - Halaman manajemen klien beli-putus offline.
  - Generator serial lisensi hardware.
  - Tombol 1-klik untuk kompilasi installer `.exe` dan `.apk`.
  - Fitur Disaster Recovery: Unduh snapshot database klien dari backup heartbeat terakhir.

---

## 📋 4. Master TODO Checklist (Confirmable Tasks)

### 📌 FASE 1: Database & Standalone Routing Engine
- [ ] Buat file skema Prisma SQLite: `backend/prisma/schema.sqlite.prisma`.
- [ ] Buat utility helper `backend/src/utils/localDatabasePaths.ts` untuk mengamankan lokasi `%APPDATA%` di Windows dan sandbox internal di Android.
- [ ] Buat switch env variable `STANDALONE_VERTICAL` (`BENGKEL` | `KAFE` | `RETAIL` | `LAUNDRY` | `RENTAL`).
- [ ] Implementasikan bypass subdomain router dan kunci `tenantId = 'standalone'` jika berjalan dalam mode standalone.
- [ ] Bypass subscription paywall di `FeatureService.ts` untuk mode standalone (seluruh fitur vertikal 100% aktif).
- [ ] Buat runner senyap `runLocalDatabaseMigration()` di Electron main process saat aplikasi booting pertama.

### 📌 FASE 2: Adaptive Offline Attendance & Shift Drawer
- [ ] Modifikasi `backend/src/routes/attendance.ts`:
  - [ ] Auto-bypass `enableGpsValidation` dan `enableCameraPhoto` jika mode standalone offline aktif.
  - [ ] Validasi PIN staf berbasis tabel `User` lokal di SQLite.
- [ ] Perkuat `frontend/src/components/ClockInModal.tsx`:
  - [ ] Numpad PIN 4–6 digit responsif untuk layar sentuh kasir / tablet.
  - [ ] Listener barcode scanner kasir untuk auto-clockin via kartu ID barcode staf.
- [ ] Hubungkan log absensi dengan modul SPK Bengkel (`WorkOrderView.tsx`):
  - [ ] Dropdown teknisi/mekanik hanya memuat staf yang tercatat hadir hari ini.
  - [ ] Perhitungan komisi mekanik akurat berdasarkan servis yang dikerjakan mekanik hadir.
- [ ] Hubungkan log absensi dengan Kasir & Petty Cash Drawer:
  - [ ] Prompt input modal awal laci kas (Cash Float) saat kasir clock-in.
  - [ ] Prompt cetak Blind Z-Report saat kasir clock-out shift.
- [ ] Terapkan Clock Tampering Guard:
  - [ ] Cek selisih waktu log transaksi terakhir vs waktu sistem lokal komputer. Blokir aksi jika jam Windows sengaja dimundurkan.
- [ ] Tambahkan toggle konfigurasi di `SettingsView.tsx`:
  - [ ] `Aktifkan Absensi Karyawan (ON/OFF)` untuk toko yang dijalankan sendiri oleh pemilik tanpa karyawan.

### 📌 FASE 3: Hardware Peripheral Drivers (Printer, Drawer, Scanner)
- [ ] Buat modul print Electron `desktop-standalone/main/printerService.ts`:
  - [ ] Direct USB printing ESC/POS untuk ukuran kertas 58mm & 80mm.
  - [ ] Cetak nota tanpa popup jendela Ctrl+P browser.
  - [ ] Trigger pulsa tendang laci kasir RJ11 (`0x1B 0x70`).
- [ ] Perkuat Android Bluetooth Printing di `frontend/src/utils/printerBluetooth.ts` untuk tablet kasir.
- [ ] Integrasikan Global HID Keystroke Buffer di `frontend/src/utils/hardwareBarcodeListener.ts` agar pemindaian barcode langsung terbaca tanpa memfokuskan mouse ke kolom input.

### 📌 FASE 4: Proteksi Lisensi Anti-Pirasi & Heartbeat Telemetry
- [ ] Buat modul pembaca Hardware ID di `desktop-standalone/main/licenseManager.ts`:
  - [ ] Ekstrak serial number Motherboard & CPU via WMI command.
  - [ ] Generate string Hardware ID unik klien (misal `BK-8821-F904-77A1`).
- [ ] Buat algoritma verifikasi Lisensi RSA/HMAC:
  - [ ] Validasi file lisensi `%APPDATA%\CodePOS_[Vertical]\license.key`.
  - [ ] Tampilkan layar aktivasi cantik saat aplikasi baru diinstal di komputer baru.
- [ ] Bangun backend endpoint di SaaS Cloud VPS:
  - [ ] `POST /api/sync/heartbeat` di `backend/src/routes/sync.ts`.
  - [ ] Menerima metrik omset ringkas & snapshot database terenkripsi.
- [ ] Buat background worker di frontend/electron:
  - [ ] Deteksi koneksi internet (`navigator.onLine`).
  - [ ] Kirim payload heartbeat saat terhubung internet (tethering 1 menit).
  - [ ] Tampilkan pengingat ramah jika masa offline melewati toleransi 30 hari.

### 📌 FASE 5: Packaging & Compilation Automation
- [ ] Setup direktori `desktop-standalone/`:
  - [ ] `package.json` dan `electron-builder.json`.
  - [ ] Skrip build installer NSIS untuk 5 vertikal:
    - [ ] Bengkel: `build:bengkel-exe`
    - [ ] Kafe: `build:kafe-exe`
    - [ ] Retail: `build:retail-exe`
    - [ ] Laundry: `build:laundry-exe`
    - [ ] Rental: `build:rental-exe`
- [ ] Pastikan konfigurasi NSIS memisahkan:
  - [ ] Folder binary: `C:\Program Files\CodePOS_[Vertical]\`
  - [ ] Folder persistent database: `%APPDATA%\CodePOS_[Vertical]\data\`
- [ ] Perbarui `scripts/generate_branded_apk.js` untuk build APK Android standalone per vertikal.
- [ ] Uji kompilasi installer Windows `.exe` dan instalasi pada PC bersih (clean environment).

### 📌 FASE 6: Zero-Data-Loss Upgrade & Control Plane UI
- [ ] Uji skenario upgrade: Instal versi v1.0 ➔ Input 10 transaksi SPK ➔ Instal versi v1.1 di atasnya ➔ Pastikan data 10 transaksi tetap utuh dan kolom baru termigrasi sempurna.
- [ ] Siapkan konfigurasi `electron-updater` untuk dukungan pembaruan Over-The-Air (OTA) saat klien tethering.
- [ ] Bangun UI Dashboard Admin di SaaS `/platform-admin`:
  - [ ] Tab **"Klien Offline & Beli-Putus"**.
  - [ ] Generator Serial Lisensi (input Hardware ID ➔ output License Key).
  - [ ] Status Heartbeat & Tanggal Terakhir Backup Klien.
  - [ ] Tombol Download Cadangan Database Darurat (Disaster Recovery).

---

## 🛡️ 5. Pedoman Pengujian & Mitigasi Risiko

1. **Uji Coba Database UAC**:
   - Pastikan aplikasi kasir dibuka oleh user Windows biasa (Non-Administrator).
   - Pastikan transaksi kasir, tambah nopol, dan input stok sparepart berhasil disimpan tanpa error *EACCES: permission denied*.
2. **Uji Coba Absensi Offline**:
   - Putuskan koneksi internet (Airplane mode / cabut kabel LAN).
   - Buka modal absensi staf ➔ Ketik PIN 1234 ➔ Pastikan sukses clock-in.
   - Buka SPK Bengkel ➔ Pastikan nama mekanik tersebut muncul di dropdown mekanik aktif.
3. **Uji Coba Anti-Pirasi**:
   - Copy folder aplikasi ke laptop lain tanpa memasukkan serial key baru.
   - Pastikan aplikasi terkunci dan memunculkan modal: *"Perangkat ini belum teraktivasi. Hubungi Admin dengan Kode Hardware ini."*
4. **Uji Coba Upgrade Zero-Data-Loss**:
   - Tambah kolom baru di schema Prisma SQLite.
   - Jalankan installer update.
   - Pastikan database tidak ter-reset menjadi kosong dan skema baru langsung aktif.

---
*Dokumen ini merupakan panduan implementasi resmi untuk rilis Offline Standalone & APK Android CodePOS. Dikelola dan diperbarui di cabang `saas`.*
