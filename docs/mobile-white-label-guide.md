# 📱 Panduan Lengkap: Mobile White-Label & Dynamic Branded APK Generator

Panduan operasional dan teknis ekosistem White-Label Mobile POS & Staf untuk platform Codenusa Cafe & Resto POS Multi-Tenant.

---

## 🌟 1. Ikhtisar Solusi White-Label

Sistem POS Codenusa memungkinkan setiap pemilik kafe/resto memiliki aplikasi mobile dengan nama dan logo bisnis mereka sendiri:
1. **Logo & Nama Toko Otomatis**: Diambil langsung dari menu **Pengaturan Toko** (`Settings.logoUrl` dan `Settings.storeName`).
2. **2 Varian Aplikasi Khusus**:
   - 🛒 **APK Kasir & Tablet POS (Landscape)**: Khusus tablet kasir, printer thermal USB/Bluetooth, dan Kitchen Display System.
   - 📱 **APK Portal Staf & Absensi (Portrait)**: Khusus smartphone staf untuk presensi GPS Selfie, jadwal kerja, dan slip gaji.
3. **Penyediaan Instan (Dynamic PWA)**: Staf dan kasir bisa langsung "Add to Home Screen" dari browser tanpa instalasi APK fisik.

---

## 🚀 2. Cara Menggunakan Generator APK

### Cara 1: Melalui Platform Master Admin (`/platform-admin`)
1. Buka browser dan login ke **Portal Platform Master Admin** (`http://localhost:5173/platform-admin` atau domain admin).
2. Klik tombol **Detail & Kelola** pada tenant/kafe yang diinginkan.
3. Buka tab **"📱 Mobile APK & White-Label"**.
4. Klik tombol **"🔨 Generate / Rebuild APK"**.
5. Tunggu proses kompilasi selesai. Status akan berubah menjadi **Tersedia** dan tombol **"⬇️ Download APK"** akan aktif untuk diunduh.

---

### Cara 2: Melalui Terminal CLI / Batch Script

#### A. Menggunakan Batch File Windows (1-Klik):
Jalankan file berikut di root direktori project:
```powershell
.\generate_branded_apk.bat
```

#### B. Menggunakan Perintah Node.js CLI:
```bash
# Build seluruh APK (Kasir + Staf) untuk tenant tertentu
node scripts/generate_branded_apk.js --tenant=mukiramen --target=all

# Hanya build APK Kasir Tablet
node scripts/generate_branded_apk.js --tenant=mukiramen --target=cashier

# Hanya build APK Staf Smartphone
node scripts/generate_branded_apk.js --tenant=mukiramen --target=staff
```

---

## 📂 3. Lokasi Output File APK

Setiap proses build akan menghasilkan file APK yang siap di-distribusikan di folder:
```
c:\ADATA\codepos\release\
  ├── [tenantSlug]-pos-cashier.apk   (Aplikasi Tablet Kasir)
  └── [tenantSlug]-staff.apk         (Aplikasi Staf Smartphone)
```

---

## 🌐 4. Dynamic Web App Manifest (PWA)

Selain APK Native, sistem menyediakan endpoint manifest dinamis:
- Endpoint: `GET /api/manifest.json`
- Menyesuaikan nama toko, warna tema, serta logo secara instan sesuai subdomain atau header `host` pemanggil.

---

## 🎧 5. Lokasi Fitur Bantuan & CS

Fitur **Bantuan & Customer Support 24/7** telah dipindahkan dari floating widget global ke:
- **Di Aplikasi POS / Backoffice**: Menu **Pengaturan** (`/settings`) -> Tab **🎧 Bantuan & CS 24/7**.
- **Di Halaman Depan**: Tetap tersedia di **Landing Page SaaS** (`/`).
