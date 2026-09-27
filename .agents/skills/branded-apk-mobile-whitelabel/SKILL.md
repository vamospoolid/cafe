---
name: branded-apk-mobile-whitelabel
description: Standar operasional pembangunan APK Android multi-tenant berlogo kustom, pemrosesan asset icon Mipmaps dari menu Pengaturan, kompilasi APK Kasir Tablet & Staf, serta Dynamic PWA Manifest.
---

# Skill: Dynamic Branded Android APK Generator & Mobile White-Label Ecosystem

Panduan arsitektur, prosedur otomatisasi build, dan checklist verifikasi untuk menghasilkan aplikasi Android Native (`.apk`) dan PWA terisolasi dengan logo dan nama usaha yang disesuaikan secara dinamis dari menu Pengaturan kafe.

---

## 🎯 1. Arsitektur Target Mobile White-Label

Sistem ini memproduksi **2 varian aplikasi Android** terpisah per tenant:

| Target Aplikasi | Orientasi | URL Target | Fungsi & Fitur Utama |
|---|---|---|---|
| **1. APK Kasir & Tablet POS** | Landscape (Mendatar) | `https://[subdomain].codenusa.id/pos` | Layar Kasir, Transaksi Cepat, Print Bluetooth/USB Thermal 58/80mm, KDS Dapur, Peta Meja 2D, Shift Closing. |
| **2. APK Portal Staf & Absensi** | Portrait (Tegak) | `https://[subdomain].codenusa.id/staff` | Presensi Selfie GPS Geofencing, Jadwal Shift Kerja, Form Izin/Cuti, Cek Slip Gaji & Kasbon, Mobile Order Waiter. |

---

## 🛠️ 2. Standar Pemrosesan Icon Toko (Android Mipmaps Engine)

Ketika logo toko diunggah di Pengaturan Toko (`Settings.logoUrl`), engine generator wajib memproses dan menyalin icon ke direktori Android:
`mobile/android/app/src/main/res/`

### Spesifikasi Resolusi Wajib:
- `mipmap-mdpi/ic_launcher.png` : **48 x 48 px**
- `mipmap-hdpi/ic_launcher.png` : **72 x 72 px**
- `mipmap-xhdpi/ic_launcher.png` : **96 x 96 px**
- `mipmap-xxhdpi/ic_launcher.png` : **144 x 144 px**
- `mipmap-xxxhdpi/ic_launcher.png` : **192 x 192 px**
- `mipmap-anydpi-v26/ic_launcher.xml` : **Adaptive Vector XML** (Android 8.0+)
- `drawable/splash.png` : **1080 x 1920 px** (Splash Screen pembuka)

---

## 📋 3. Checklist Task & Status Pengerjaan (Confirmable TODO)

Gunakan checklist ini untuk melacak status pengerjaan setiap tahapan:

### ✅ Fase 1: Engine Pemroses Icon & Asset Android
- [x] **Task 1.1**: Buat helper pemroses gambar / icon generator (`scripts/lib/icon_generator.js`).
- [x] **Task 1.2**: Dukung format input `.png`, `.jpg`, `.jpeg`, `.webp`.
- [x] **Task 1.3**: Auto-generate seluruh layer mipmap Android (`mdpi` s/d `xxxhdpi`) & Adaptive Icons.
- [x] **Task 1.4**: Buat generator Splash Screen bertema brand kafe (`drawable/splash.png`).

### ✅ Fase 2: Script Otomatisasi Build APK Multi-Target
- [x] **Task 2.1**: Buat script utama `scripts/generate_branded_apk.js` dengan opsi parameter `--tenant`, `--target`, `--env`.
- [x] **Task 2.2**: Ambil `storeName`, `logoUrl`, `slug`, dan `customDomain` dari database toko.
- [x] **Task 2.3**: Injeksi nama toko ke `strings.xml` dan `capacitor.config.json`.
- [x] **Task 2.4**: Eksekusi `npx cap sync android` dan kompilasi Gradle (`assembleDebug` / `assembleRelease`).
- [x] **Task 2.5**: Output file APK tersimpan di `release/[slug]-pos-cashier.apk` & `release/[slug]-staff.apk`.
- [x] **Task 2.6**: Buat batch runner `generate_branded_apk.bat` untuk eksekusi 1-klik di Windows.

### ✅ Fase 3: Dynamic PWA Manifest (Instan di Tablet/HP)
- [x] **Task 3.1**: Buat endpoint `GET /api/manifest.json` di `backend/src/routes/manifest.ts`.
- [x] **Task 3.2**: Resolusikan data nama toko, warna tema, dan icon logo secara dinamis per subdomain/domain.
- [x] **Task 3.3**: Hubungkan `<link rel="manifest" href="/api/manifest.json">` di `frontend/index.html`.

### ✅ Fase 4: Integrasi Platform Master Admin (`/platform-admin`)
- [x] **Task 4.1**: Tambahkan endpoint API build & download APK di backend platform admin.
- [x] **Task 4.2**: Tambahkan panel aksi **"📱 Mobile White-Label & Download APK"** di `TenantDetailModal.tsx`.

### ✅ Fase 5: Pengujian & Verifikasi
- [x] **Task 5.1**: Verifikasi generasi icon logo MUKI RAMEN & file Mipmap.
- [x] **Task 5.2**: Verifikasi eksekusi build APK.
- [x] **Task 5.3**: Verifikasi Dynamic Manifest di browser tablet.

---

## ⚡ 4. Prosedur Eksekusi & Perintah Build

### 1. Build APK untuk Tenant Tertentu:
```bash
# Build APK Kasir Tablet & Staf untuk tenant 'mukiramen'
node scripts/generate_branded_apk.js --tenant=mukiramen --target=all

# Hanya build APK Kasir
node scripts/generate_branded_apk.js --tenant=mukiramen --target=cashier

# Hanya build APK Staf & Absensi
node scripts/generate_branded_apk.js --tenant=mukiramen --target=staff
```

### 2. Lokasi Output File APK:
Semua file APK yang berhasil dikompilasi akan otomatis tersimpan di:
* `c:\ADATA\codepos\release\mukiramen-pos-cashier.apk`
* `c:\ADATA\codepos\release\mukiramen-staff.apk`

---

## 🔒 5. Standar Keamanan & Independensi Data Mobile

1. **Android App Sandbox:**
   Setiap instance APK menyimpan token JWT dan cache IndexedDB di ruang penyimpanan privat (*Android Sandbox Storage*).
2. **Koneksi Terenkripsi (HTTPS / WSS):**
   Semua request API dan sinkronisasi real-time Socket.IO wajib melalui protokol terenkripsi `https://` dan `wss://`.
3. **Session Token Expiry:**
   Token kasir di APK berlaku hingga 30 hari dengan auto-refresh, sedangkan otorisasi admin dilindungi PIN supervisor.
