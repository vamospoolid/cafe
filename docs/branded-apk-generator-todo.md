# TODO List: Dynamic Branded Android APK Generator & Mobile White-Label Ecosystem

Checklist langkah kerja komprehensif untuk pembangunan generator APK Android otomatis, penyesuaian icon dinamis dari menu Pengaturan, dan integrasi multi-tenant mobile.

---

## 📋 Fase 1: Engine Pemroses Icon & Asset Android
- [x] **1.1** Buat helper pemroses gambar / icon generator (`scripts/lib/icon_generator.js`):
  - [x] Auto-detect format logo toko (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`).
  - [x] Resize ke seluruh ukuran standar Android Mipmaps:
    - `mipmap-mdpi` (48x48 px)
    - `mipmap-hdpi` (72x72 px)
    - `mipmap-xhdpi` (96x96 px)
    - `mipmap-xxhdpi` (144x144 px)
    - `mipmap-xxxhdpi` (192x192 px)
  - [x] Generate `mipmap-anydpi-v26/ic_launcher.xml` dan `ic_launcher_round.xml` (Adaptive Icons).
- [x] **1.2** Buat generator Splash Screen bertema brand kafe (`res/drawable/splash.png`).

---

## 📋 Fase 2: Script Otomatisasi Build APK Multi-Target
- [x] **2.1** Buat script utama `scripts/generate_branded_apk.js`:
  - [x] Parameter CLI: `--tenant=<tenantSlug|tenantId>`, `--target=<cashier|staff|all>`, `--env=<dev|prod>`.
  - [x] Ambil `storeName`, `logoUrl`, `subdomainSlug`, dan `customDomain` dari database toko.
  - [x] Injeksi nama toko ke `mobile/android/app/src/main/res/values/strings.xml` (`app_name`).
  - [x] Injeksi konfigurasi Capacitor `mobile/capacitor.config.json` (`appId`, `appName`, `server.url`).
  - [x] Eksekusi `npx cap sync android`.
  - [x] Eksekusi Gradle Build (`assembleDebug` / `assembleRelease`).
  - [x] Simpan output APK terbit ke `release/[slug]-pos-cashier.apk` & `release/[slug]-staff.apk`.
- [x] **2.2** Buat batch shortcut `generate_branded_apk.bat` untuk eksekusi mudah di Windows.

---

## 📋 Fase 3: Dynamic PWA Web App Manifest (Instan di Tablet / HP)
- [x] **3.1** Buat route backend `backend/src/routes/manifest.ts`:
  - [x] Endpoint `GET /api/manifest.json` (resolusi dinamis berdasarkan subdomain/domain request).
  - [x] Sajikan nama toko, short name, logo URL resolusi tinggi, tema warna, dan start URL (`/pos` atau `/staff`).
- [x] **3.2** Daftarkan route manifest di `backend/src/index.ts`.
- [x] **3.3** Hubungkan `<link rel="manifest" href="/api/manifest.json">` di `frontend/index.html`.

---

## 📋 Fase 4: Integrasi Platform Master Admin (`/platform-admin`)
- [x] **4.1** Buat backend endpoint API di `backend/src/routes/platformAdmin.ts` / `backend/src/routes/mobileBuild.ts`:
  - [x] `POST /api/platform-admin/tenants/:tenantId/build-apk` (Trigger background build).
  - [x] `GET /api/platform-admin/tenants/:tenantId/apk-status` (Cek status file APK).
  - [x] `GET /api/platform-admin/tenants/:tenantId/download-apk/:type` (Download file APK yang sudah jadi).
- [x] **4.2** Perbarui UI `frontend/src/components/TenantDetailModal.tsx`:
  - [x] Tambahkan panel **"📱 Mobile White-Label & Download APK"**.
  - [x] Tampilkan tombol aksi build dan link unduh APK Kasir & Staf.

---

## 📋 Fase 5: Pengujian, Verifikasi, & Walkthrough
- [x] **5.1** Uji generasi icon dengan logo MUKI RAMEN & verifikasi folder drawable mipmap.
- [x] **5.2** Uji eksekusi build APK Kasir & Staf.
- [x] **5.3** Uji Dynamic Manifest PWA di browser.
- [x] **5.4** Dokumentasikan panduan lengkap di `docs/mobile-white-label-guide.md`.
