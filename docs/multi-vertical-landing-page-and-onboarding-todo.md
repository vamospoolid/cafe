# TODO List: Multi-Vertical Landing Page & Frictionless Onboarding (CodePOS SaaS)

## Status Ringkasan
- **Tanggal Dibuat:** 3 Oktober 2026
- **Target Release:** CodePOS v2.10 (Multi-Vertical Growth & Onboarding Optimization)
- **Fokus Utama:** Transformasi Landing Page Multi-UMKM, Dynamic Hero Switcher, Visual Onboarding Wizard, Contextual Pre-Fill, dan Instant Demo Mode.
- **Status General:** SELESAI PENUH (5 Fase Telah Diimplementasikan & Teruji 100%)

---

## 🎯 DAFTAR TARGET PERBAIKAN & FASE EKSEKUSI

### 🚀 Fase 1: Data Model Vertikal & Dynamic Hero Switcher
- [x] **[Data] `VERTICAL_LANDING_DATA` Dictionary**:
  - Definisikan konfigurasi 5 vertikal: `CAFE`, `BENGKEL`, `RETAIL`, `LAUNDRY`, dan `RENTAL` pada `frontend/src/data/verticalLandingData.ts`.
  - Sertakan metadata per vertikal:
    - `id`, `name`, `badgeText`, `badgeIcon` (Coffee, Wrench, Package, Shirt, Sparkles).
    - `headline`, `subheadline`.
    - `metrics`: Stat angka riil ("Kecepatan Kasir 1.2 Detik", "Pencatatan SPK 3 Detik", "Scan Barcode Laser Kilat", "Tonase Cucian Desimal Kg", "Jadwal H-Day Anti-Bentrok").
    - `floatingBadges`: 2 pill badge interaktif per vertikal.
    - `themeColor`: Aksen warna dinamis (Amber untuk Kafe, Crimson/Rose untuk Bengkel, Indigo/Blue untuk Retail, Cyan untuk Laundry, Purple/Gold untuk Rental).
    - `ctaText`: Teks tombol tindakan spesifik industri (misal: "Coba Gratis Kasir Bengkel").
- [x] **[Frontend] `LandingPageView.tsx`**:
  - Pasang **Interactive Vertical Selector Bar** di bawah header hero dengan 5 pills visual touch-friendly.
  - Implementasikan state `activeVertical` dengan auto-detection dari URL query parameter (`?vertical=bengkel`, `?vertical=rental`, `?vertical=laundry`, `?vertical=retail`, `?vertical=cafe`) serta pembaruan riwayat URL dinamis (`history.replaceState`).
  - Terapkan micro-animation transisi teks dan mockup layar tablet saat pengguna mengklik tab vertikal yang berbeda.
  - Sesuaikan mockup visual hero agar menampilkan layar POS kasir tablet yang realistis sesuai tab yang dipilih (SPK Servis, Faktur Grosir, Nota Cuci Kiloan, Kontrak Sewa Adat, Pesanan Kafe).

---

### 🎨 Fase 2: Redesain Showcase Solusi Spesifik UMKM
- [x] **[Frontend] Bagian "Solusi Berdasarkan Jenis Usaha"**:
  - Buat grid interaktif 5 pilar usaha dengan visual cards yang menonjolkan fitur kunci masing-masing vertikal:
    1. **Kafe & Resto:** Meja & QR Dine-in, KDS Layar Dapur, Resep & HPP Bahan Baku, Split Bill Kasir.
    2. **Bengkel Motor & Mobil:** SPK Montir Digital, Riwayat Plat Nomor Kendaraan, Manajemen Jasa & Suku Cadang, Komisi Montir Otomatis.
    3. **Toko Grosir & Retail:** Keyboard-first kasir kilat, multi-satuan bertingkat (dus/lusin/pcs), Surat Jalan armada, buku piutang bon tempo & plafon kontraktor.
    4. **Laundry Kiloan & Satuan:** Timbangan desimal Kg, pilihan varian parfum, nomor rak simpan, notifikasi WhatsApp ambil cucian otomatis.
    5. **Penyewaan Busana Adat:** Kalender sewa H-Day anti-bentrok, uang jaminan deposit sewa, checklist perhiasan emas/aksesoris, QC pengembalian & cuci sutra.
- [x] **[Frontend] Contextual CTA Routing**:
  - Setiap kartu memiliki tombol *"Coba Gratis untuk [Nama Usaha]"* yang membuka popup pendaftaran dengan jenis usaha langsung terkunci (`initialBusinessType`) pada vertikal tersebut.

---

### ⚡ Fase 3: Modernisasi & Penyederhanaan Onboarding Wizard (`TenantRegisterWizard.tsx`)
- [x] **[Frontend] Visual Vertical Selection (Langkah 1)**:
  - Tampilkan 5 kartu visual besar yang mudah ditekan (touch-friendly) untuk memilih jenis usaha.
  - Form menerima prop `initialBusinessType` sehingga vertikal yang diklik dari Landing Page langsung otomatis terpilih (*pre-selected*).
- [x] **[Frontend] Informasi Bisnis Cepat (Langkah 2)**:
  - Sederhanakan kolom input wajib menjadi: **Nama Usaha** dan **Subdomain Slug**.
  - Auto-generate slug subdomain secara cerdas (misal: "Bengkel Jaya Motor" -> `bengkeljayamotor`).
  - Tambahkan tombol *"⚡ Isi Otomatis Contoh [Nama Usaha]"* cerdas yang mengisi nama usaha, slug, kategori produk, dan data awal yang sesuai dengan jenis usaha yang dipilih:
    - Kafe -> Kafe Senja, Kopi Susu Aren, Croissant.
    - Bengkel -> Bengkel Jaya Motor, Oli Mesin Matic, Kampas Rem.
    - Retail -> Toko Grosir Berkah Sembako, Beras Premium 5kg, Minyak Goreng 2L.
    - Laundry -> Berkah Laundry Kiloan, Cuci Reguler 2 Hari, Express.
    - Rental -> Sanggar Busana Adat Bugis, Baju Bodo Organza, Jas Tutup Bugis.
- [x] **[Frontend] Akun Pemilik & Instant Provisioning (Langkah 3)**:
  - Input nama pemilik, username, password, dan PIN kasir 6 digit.
  - Selesai! Panggil API `/api/auth/register-tenant`, langsung jalankan auto-login dengan token yang dikembalikan, dan redirect langsung ke `/pos`.

---

### 🎮 Fase 4: Opsi "Coba Demo Instan" (Zero-Friction Sandbox Mode)
- [x] **[Frontend] Tombol Coba Demo di Hero**:
  - Tombol sekunder *"⚡ Coba Demo Kasir (1-Klik)"* terpasang berdampingan di Hero section dan header navbar.
  - Mendukung login demonstrasi instan satu klik tanpa memerlukan formulir registrasi di muka.
- [x] **[Frontend] Guest Demo Environment**:
  - Menghubungkan langsung kredensial demo publik ke backend login dan melakukan auto-routing ke dashboard kasir POS.

---

### 🧪 Fase 5: Pengujian Responsif, Kualitas & Validasi End-to-End
- [x] **[Testing] Script Validasi Pendaftaran Multi-Vertikal**:
  - Dibuat `backend/scripts/test_multi_vertical_onboarding.js` untuk menguji:
    - Registrasi tenant baru untuk masing-masing 5 vertikal (`CAFE`, `BENGKEL`, `RETAIL`, `LAUNDRY`, `RENTAL`).
    - Verifikasi bahwa kategori default, outlet, dan produk contoh ter-generate sesuai vertikal.
    - Verifikasi bahwa token yang dihasilkan langsung valid dan memiliki role OWNER.
    - Hasil pengujian: **Lolos 100% (5/5 vertikal sukses)**.
- [x] **[Testing] Responsiveness & Visual Polish**:
  - Pengujian tata letak responsif mobile (layar 360px - 414px): Tombol dan pills flex-wrap tanpa overflow horizontal.
  - Pengujian tablet (768px - 1024px) dan desktop (1280px+): Bezel tablet POS mockup tampil tajam dengan gradien glassmorphism.
- [x] **[Build] Production Bundle Build**:
  - Dijalankan `npm run build` di folder `frontend`: **Lolos 100% (0 error TypeScript, vite built in 5.76s)**.

---

## 📊 Matriks Dampak & Nilai Tambah

| Komponen | Kondisi Sebelum Pembaruan | Kondisi Setelah Pembaruan |
|---|---|---|
| **Pesan Hero** | 100% Kafe & Kuliner | Adaptif 5 Vertikal UMKM (Kafe, Bengkel, Retail, Laundry, Rental) |
| **Pilihan Usaha** | Tersembunyi di formulir registrasi | 5 Pills Visual Interaktif di Hero & 5 Kartu Touch-friendly di Wizard |
| **Layar Hero Mockup** | Banner foto umum | Simulator Layar Kasir Tablet POS Realistis per Industri |
| **Contoh Data** | Manual atau default kafe | Tombol 1-klik Isi Contoh Cerdas relevan 100% per industri |
| **Batas Keraguan Pengguna** | Wajib isi form sebelum coba | Opsi "⚡ Coba Demo Kasir (1-Klik)" langsung siap pakai |
| **Integrasi URL Pemasaran** | Tidak ada | Mendukung parameter `?vertical=bengkel`, `?vertical=rental`, dll. |
| **Conversion Rate Target** | ~3% pengunjung mendaftar | >10% pengunjung mencoba / mendaftar karena merasa relevan |
