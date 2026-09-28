# Master Todo: Universal Tablet APK & Hardware Ecosystem (Printer Thermal & Barcode Scanner)

Dokumen master todo untuk implementasi arsitektur **Single Universal Tablet APK** dengan integrasi hardware tingkat industri F&B & Retail (Printer Thermal Bluetooth/USB/LAN ESC/POS & Barcode Scanner HID Global Listener), serta zero-leakage dynamic GUI tenant provisioning.

---

## 🎯 Standar Arsitektur & Keunggulan Utama
1. **Single Universal APK (0 Rebuilds for Feature Updates)**:
   - APK dikompilasi **1 kali saja** sebagai shell native Android (Capacitor).
   - Logika aplikasi, GUI, dashboard, dan penambahan fitur baru di masa depan ditarik secara dinamis dari web server terpusat.
   - Saat Anda memperbarui kode di web server, 100% tablet klien langsung ter-update seketika tanpa perlu build ulang APK.
2. **Kekuatan Hardware Printer F&B (Triple-Channel Driver)**:
   - **Bluetooth Thermal 58mm / 80mm**: Mendukung Web Bluetooth BLE & Android SPP Classic (Panda, RPP02N, VSC, Eppos, Iware, Sunmi).
   - **USB OTG Direct Printing**: Menghubungkan tablet ke printer meja kasir via kabel USB type-C/OTG (Epson TM-T82, Xprinter, dll).
   - **Network LAN/WiFi Printer (Dapur & Bar)**: Cetak tiket dapur KDS otomatis ke printer IP via socket TCP Port 9100.
   - **RJ11 Cash Drawer Kick**: Trigger sinyal pembuka laci kasir otomatis saat transaksi tunai selesai (`ESC p 0 25 250`).
3. **Kekuatan Hardware Barcode & QR Scanner**:
   - **Global HID Keystroke Buffer (Gun Scanner)**: Barcode scanner USB/Bluetooth nirkabel (Honeywell, Zebra, Eyoyo) terbaca otomatis tanpa kasir harus mengklik kolom pencarian (deteksi ketukan cepat < 45ms + Enter).
   - **Native Camera Scanner**: Pemindai kamera tablet ultra-cepat menggunakan Google ML Kit Barcode Scanning.
4. **Keamanan Multi-Tenant & Zero Data Leakage**:
   - **Atomic Storage Purge**: Menghapus bersih IndexedDB Dexie & LocalStorage saat kasir logout / ganti tenant.
   - **Kriptografis Device Pairing**: Kode aktivasi 6-karakter (misal `POS-8921`) berdurasi 10 menit dengan proteksi rate-limiting.
   - **Socket.IO Room Scoping**: Handshake terikat erat ke `tenant:${tenantId}` via signed JWT.

---

## 📋 Checklist Eksekusi Step-by-Step

### 🔌 FASE 1: Hardware Abstraction Layer (Printer & Scanner)
- [x] **1.1** Buat Global HID Scanner Listener (`frontend/src/utils/hardwareBarcodeListener.ts`):
  - Deteksi ketukan keyboard berkecepatan tinggi (< 45ms interval) di level window event listener.
  - Tangkap string barcode secara utuh saat tombol `Enter` terdeteksi.
  - Integrasikan auto-add to cart di `POSView.tsx` tanpa kasir perlu memfokuskan kursor pada kotak input pencarian.
  - Dukung audio beep / haptic feedback saat barcode berhasil dipindai.
- [x] **1.2** Perkuat Driver Bluetooth Thermal (`frontend/src/utils/printerBluetooth.ts`):
  - Tambahkan fungsi auto-reconnect printer bluetooth yang tersimpan saat kasir membuka aplikasi / jendela kasir kembali fokus.
  - Tambahkan helper perintah pemotong kertas otomatis (*paper cut* `\x1d\x56\x00` / `ESC i`).
  - Tambahkan sinyal pembuka laci kasir otomatis RJ11 (`\x1b\x70\x00\x19\xfa`).
  - Dukung pengaturan lebar kertas dinamis (58mm = 32 kolom vs 80mm = 48 kolom).
- [x] **1.3** Bangun Network/LAN Kitchen Printer Relay di Backend (`backend/src/routes/printer.ts`):
  - Tambahkan endpoint `POST /api/printer/network-print` yang membuka socket TCP port 9100 ke IP printer dapur/bar (`192.168.1.xxx`).
  - Cegah pembatasan browser sandbox dan validasi bahwa target printer terisolasi per outlet & per stasiun (`stationTarget: 'KITCHEN' | 'BAR'`).

---

### 🔑 FASE 2: Cryptographic Device Pairing & Activation (Backend)
- [x] **2.1** Buat router `backend/src/routes/devicePairing.ts`:
  - `POST /api/devices/generate-code`:
    - Khusus Owner/Admin di dashboard web untuk generate kode 6-digit alfanumerik (misal: `POS-8921`).
    - Simpan di memori/Redis dengan TTL 10 menit, terikat ke `tenantId` dan `outletId`.
  - `POST /api/devices/pair`:
    - Dipanggil tablet saat aktivasi pertama kali dengan payload `{ pairingCode, deviceName, appVersion }`.
    - Validasi kode -> terbitkan Device Identity & JWT Token kasir tablet.
    - Sertakan bundle konfigurasi lengkap: profil toko, logo, warna tema brand, mode bisnis, dan lisensi modul dari `FeatureService`.
    - Hanguskan (*burn*) kode pairing secara atomik setelah digunakan.
  - `POST /api/devices/unpair`:
    - Deaktivasi tablet dan pancarkan event Socket.IO `device:deactivated` ke tablet terkait untuk memicu *wipeout* data lokal seketika.
- [x] **2.2** Daftarkan router `/api/devices` di `backend/src/index.ts`.
- [x] **2.3** Terapkan Rate Limiter anti brute-force:
  - Maksimal 5 kali percobaan gagal per IP per 15 menit.

---

### 🎨 FASE 3: Dynamic GUI Morphing & Atomic Storage Purge (Frontend)
- [x] **3.1** Buat komponen `frontend/src/components/DeviceActivationView.tsx`:
  - Layar aktivasi tablet modern untuk perangkat yang baru diinstal.
  - Keypad numerik 6 digit untuk input kode aktivasi dari dashboard owner.
  - Tombol alternatif *"Masuk dengan Akun Kasir (Username & Password)"*.
- [x] **3.2** Perkuat fungsi `logout()` & de-aktivasi di `frontend/src/context/POSContext.tsx`:
  - Putus koneksi Socket.IO seketika (`socket.disconnect()`) agar tidak menerima event toko lama lagi.
  - Eksekusi pembersihan atomik pada Dexie (`offlineDb.clearAllCache()`).
  - Hapus seluruh LocalStorage (`pos_token`, `pos_user`, `pos_active_shift`, `bluetooth_printer_id`).
- [x] **3.3** Terapkan Dynamic GUI Morphing di `frontend/src/context/POSContext.tsx`:
  - Ubah variabel CSS `--primary-color`, logo header, dan struk seketika setelah pairing berhasil.
  - Tampilkan mode F&B (Peta Meja & KDS) vs mode Quick Retail (Scan Barcode & Quick Pay) sesuai jenis bisnis toko klien.

---

### 🌐 FASE 4: Live Web Update & In-App Version Checker (0 Rebuilds)
- [x] **4.1** Konfigurasi `frontend/capacitor.config.ts`:
  - Konfigurasi universal tablet (`appId: 'com.codenusa.universalpos'`, `appName: 'CodePOS Tablet'`).
  - Atur skema komunikasi Android native bridge yang aman (`androidScheme: 'https'`).
- [x] **4.2** Buat endpoint `GET /api/app/version` di backend:
  - Menyajikan informasi versi web & APK saat ini.
- [x] **4.3** Buat komponen `InAppUpdateBanner.tsx` di frontend:
  - Memberitahu kasir jika ada pembaruan fitur baru dari server web secara elegan tanpa perlu download ulang APK.

---

### 🧪 FASE 5: Pengujian, Validasi Keamanan & Hardware Mocking
- [x] **5.1** Buat script pengujian automated `backend/scripts/test_device_pairing_security.js`:
  - Uji pembuatan kode pairing, verifikasi TTL kedaluwarsa 10 menit, dan proteksi brute-force.
  - Uji aktivasi perangkat dan verifikasi bundle konfigurasi profil toko yang diterima.
  - Uji isolasi tenant: Tablet Kafe A tidak bisa menggunakan kode aktivasi milik Kafe B.
  - Uji unpair & pencabutan token seketika.
- [x] **5.2** Buat script pengujian hardware & penyimpanan atomik `backend/scripts/test_hardware_and_storage_wipe.js`:
  - Uji emulasi global barcode scanner HID (ketukan < 45ms).
  - Uji simulasi escape code printer Bluetooth & Network LAN TCP port 9100 (sinyal potong kertas & kick laci RJ11).
  - Uji simulasi pembersihan penyimpanan atomik IndexedDB Dexie (0 sisa data).
- [x] **5.3** Uji build TypeScript backend (`npx tsc --noEmit`) & frontend (`npm run build`).
- [x] **5.4** Verifikasi regresi keamanan (BullMQ, Redis, Zero-IDOR, AI Menu Advisor).
