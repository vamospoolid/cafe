# 📱 Panduan Lengkap Build Android APK & Setup Tablet Kasir (Capacitor)
**Aplikasi POS Cafe & Resto Multi-Tenant (Offline-First)**

---

## 📑 Daftar Isi
1. [Arsitektur Single Universal APK](#1-arsitektur-single-universal-apk)
2. [Prasyarat Sistem (Prerequisites)](#2-prasyarat-sistem-prerequisites)
3. [Konfigurasi Capacitor (`capacitor.config.ts`)](#3-konfigurasi-capacitor)
4. [Langkah-Langkah Build APK (Step-by-Step)](#4-langkah-langkah-build-apk-step-by-step)
5. [Konfigurasi Izin Perangkat (`AndroidManifest.xml`)](#5-konfigurasi-izin-perangkat-androidmanifestxml)
6. [Setup Kiosk Mode di Tablet Kasir (Lock Screen Dedikasi)](#6-setup-kiosk-mode-di-tablet-kasir)
7. [Tips Troubleshooting & FAQ](#7-tips-troubleshooting--faq)

---

## 1. Arsitektur Single Universal APK

Aplikasi POS ini menggunakan pendekatan **Single Universal APK**. Anda **TIDAK PERLU** membuat atau memelihara file APK terpisah untuk Tablet, HP Pelayan, maupun HP Staf.

| Tipe Perangkat | Resolusi Layar | Tampilan & Fitur Otomatis |
| :--- | :--- | :--- |
| **Tablet Kasir (10"+)** | Landscape (1280x800 ke atas) | Layout POS 2-kolom (Katalog grid + Panel Cart kasir selalu terlihat) + Scanner Barcode + Cetak Bluetooth. |
| **HP Waitress / Pelayan** | Portrait / Mobile Screen | Bottom drawer order, pemesanan meja cepat, kirim order ke dapur. |
| **HP Staf / Karyawan** | Mobile Screen (`/staff`) | Portal Absensi Selfie On-Demand Camera + GPS radius check + Riwayat jam kerja & slip gaji. |

> **Keamanan Multi-Tenant & RBAC:**
> Saat login menggunakan akun kasir/waitress/staf, JWT Token secara otomatis mengunci `tenantId` dan `outletId`, serta menyembunyikan HPP (COGS), laba bersih, dan menu administratif dari staf yang tidak berhak.

---

## 2. Prasyarat Sistem (Prerequisites)

Sebelum melakukan build APK, pastikan komputer development Anda telah terpasang:
1. **Node.js**: Versi 18.x atau 20.x LTS
2. **Java Development Kit (JDK)**: JDK 17 atau JDK 21 (Disarankan OpenJDK 17)
3. **Android Studio**: Versi terbaru (Ladybug / Hedgehog / Flamingo) dengan:
   - Android SDK Platform (API Level 33 / 34)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools

---

## 3. Konfigurasi Capacitor

File konfigurasi berada di [`frontend/capacitor.config.ts`](file:///c:/ADATA/codepos/frontend/capacitor.config.ts):

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codenusa.poscafe',
  appName: 'Codenusa POS & Cafe',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
```

---

## 4. Langkah-Langkah Build APK (Step-by-Step)

### Opsi A: Menggunakan Command Script Cepat (Recommended)

1. **Buka terminal di folder `frontend`**:
   ```bash
   cd c:\ADATA\codepos\frontend
   ```

2. **Inisialisasi platform Android (Hanya jika folder `android` belum ada)**:
   ```bash
   npx cap add android
   ```

3. **Build Web & Sinkronkan ke Android**:
   ```bash
   npm run build:apk
   ```

4. **Buka Project di Android Studio**:
   ```bash
   npm run cap:open
   ```

5. **Generate APK di Android Studio**:
   * Di menu atas Android Studio: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   * File APK debug akan tersimpan di:
     `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
   * Untuk APK rilis resmi (Signed APK): **Build** > **Generate Signed Bundle / APK** > Pilih **APK** > Masukkan Keystore.

---

## 5. Konfigurasi Izin Perangkat (`AndroidManifest.xml`)

Untuk memastikan Printer Thermal Bluetooth, Kamera Scanner, dan GPS Absensi berfungsi lancar tanpa terblokir sistem Android, pastikan permissions berikut terdaftar pada file `frontend/android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- 🖨️ Izin Bluetooth Printer Thermal ESC/POS -->
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />

    <!-- 📷 Izin Kamera (Barcode Scanner & Absensi Selfie Staf) -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <!-- 📍 Izin Lokasi (Verifikasi Radius GPS Absensi Staf) -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- 🌐 Izin Jaringan (Sync Offline-First Engine) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        ...
    </application>
</manifest>
```

---

## 6. Setup Kiosk Mode di Tablet Kasir

Agar tablet kasir di outlet cafe bekerja secara profesional dan kasir tidak dapat membuka aplikasi lain (seperti YouTube, Game, atau Media Sosial):

### Cara 1: Fitur Bawaan Android (App Pinning / Sematkan Aplikasi)
1. Buka **Pengaturan Android (Settings)** > **Keamanan (Security)**.
2. Cari dan aktifkan menu **Sematkan Aplikasi (App Pinning / Pin App)**.
3. Buka aplikasi **Codenusa POS**.
4. Buka menu Recent Apps (ikon kotak atau geser ke atas), ketuk ikon aplikasi Codenusa POS di atas jendela, lalu pilih **Sematkan (Pin)**.
5. Layar tablet sekarang terkunci khusus untuk POS. Kasir memerlukan PIN/Password perangkat untuk keluar.

### Cara 2: Tombol Fullscreen Kiosk Bawaan POS
* Di pojok kanan atas tampilan POS, kasir dapat menekan tombol **`Layar Penuh (Kiosk)`**.
* Aplikasi akan otomatis menyembunyikan status bar jam dan tombol navigasi bawah browser/OS.

---

## 7. Tips Troubleshooting & FAQ

### Q: Kenapa printer thermal bluetooth tidak terdeteksi di Android 12 ke atas?
> **Solusi:** Di Android 12+ (API 31+), Android mewajibkan izin runtime `BLUETOOTH_CONNECT` dan `BLUETOOTH_SCAN`. Pastikan tablet kasir telah menyetujui prompt izin saat aplikasi pertama kali meminta akses Bluetooth.

### Q: Bagaimana cara update aplikasi jika ada fitur baru di cloud?
> **Solusi:** Karena aplikasi menggunakan Capacitor Web View, pembaruan frontend dapat dilakukan secara instan melalui Live Update / Web Deployment tanpa perlu menginstal ulang file APK jika tidak ada penambahan native plugin baru.

### Q: Apakah transaksi tetap tersimpan jika tablet kasir tiba-tiba mati atau restart?
> **Solusi:** Ya! Database lokal menggunakan **IndexedDB (Dexie.js)** yang tersimpan permanen di storage internal tablet Android. Saat tablet dinyalakan kembali dan terhubung internet, Sync Engine akan otomatis mengunggah seluruh transaksi yang tertunda ke server cloud.
