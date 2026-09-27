---
name: saas-fast-onboarding-ai
description: Standar arsitektur & operasional onboarding cepat klien SaaS CodePOS via Link Google Maps, ekstraksi menu OCR berbasis Gemini 1.5 Flash Vision, generator foto menu estetik AI, dan atomic tenant provisioning.
---

# Skill: SaaS Fast Client Onboarding & AI Provisioning Engine

Panduan arsitektur, spesifikasi API, prompt engineering AI, dan checklist pengerjaan sistem pendaftaran instan klien baru CodePOS langsung dari Dashboard Platform Admin (`/platform-admin`).

---

## 🎯 1. Arsitektur & Alur Kerja (Workflow)

```
[Link Google Maps] ──► [URL Redirect Resolver] ──► [Ekstraksi Data Toko]
 (maps.app.goo.gl)      • Canonical URL             • Nama Kafe
                        • Regex @lat,lng            • GPS Lat/Lng (Absensi)
                        • OpenGraph og:image        • Alamat Lengkap & Logo
                                                           │
┌──────────────────────────────────────────────────────────┘
▼
[Input Menu Kafe]  ──► [Gemini 1.5 Flash Vision] ──► [Structured JSON Menu]
 • Foto Buku Menu       • Teks & Kategori OCR        • Kategori (Coffee, Snack, dll)
 • Desain Canva / PDF   • Normalisasi Harga (25k)    • Produk, Harga, SKU
 • Preset Template 1-Klik                                  │
                                                           │
┌──────────────────────────────────────────────────────────┘
▼
[AI Image Engine]  ──► [Food Aesthetic Prompt]   ──► [WebP Photo Grid]
 • Pollinations/Flux    • Studio food photography    • Foto 1:1 HD (~35KB)
 • Per-item Regenerate  • Soft cafe aesthetic lighting • Tampil di POS Kasir
                                                           │
┌──────────────────────────────────────────────────────────┘
▼
[Atomic Provision] ──► [Database Multi-Tenant]   ──► [Welcome Kit Owner]
 • POST /execute        • Tenant, Subscriptions      • Link Login Instan
                        • Outlet, User Owner         • Salin Pesan WhatsApp
                        • Categories & Products      • POS Siap Pakai (< 2 Menit)
```

---

## 🛠️ 2. Standar Spesifikasi Teknis

### A. Google Maps Link Resolver (`/resolve-gmaps`)
* **Input:** URL Google Maps (`https://maps.app.goo.gl/...` atau `https://www.google.com/maps/place/...`).
* **Mekanisme:**
  1. Melakukan HTTP `fetch` dengan `redirect: 'follow'` untuk mendapatkan URL tujuan akhir.
  2. Ekstraksi GPS Coordinates menggunakan Regex: `/@(-?\d+\.\d+),(-?\d+\.\d+)/` atau `!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)`.
  3. Ekstraksi Nama Tempat dari URL path segment atau tag `<title>` / `og:title`.
  4. Ekstraksi Foto/Logo dari meta tag `og:image`.

### B. AI Vision Menu Extractor (`/ai-extract-menu`)
* **Engine:** Google Gemini 1.5 Flash Vision API (`GEMINI_API_KEY`) dengan fallback smart parser.
* **System Prompt:**
  ```text
  Extract all menu items and categories from this cafe menu image.
  Normalize all prices to plain integers in IDR (e.g. 18k -> 18000, 22.000 -> 22000).
  Return strictly valid JSON:
  [
    {
      "category": "Coffee",
      "items": [
        { "name": "Kopi Susu Gula Aren", "price": 18000, "sku": "CF-01" }
      ]
    }
  ]
  ```

### C. AI Food Image Generator (`/generate-product-image`)
* **Engine:** Pollinations AI / Flux Schnell Food Aesthetic Model (Fast, 0-cost, High Visual Quality).
* **Prompt Builder:**
  ```text
  https://image.pollinations.ai/prompt/commercial%20studio%20food%20photography%20of%20[PRODUCT_NAME]%2C%20[CATEGORY]%2C%20cozy%20cafe%20aesthetic%2C%20soft%20warm%20lighting%2C%20ultra%20detailed%204k?width=512&height=512&nologo=true&enhance=true
  ```

### D. Atomic Multi-Tenant Provisioning (`/execute`)
* Eksekusi dalam satu transaksi Prisma `prisma.$transaction`:
  1. `Tenant` baru (`status: ACTIVE` atau `TRIAL`).
  2. `Subscription` sesuai pilihan (`STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`).
  3. `Outlet` lengkap dengan alamat, koordinat `latitude`/`longitude`, dan `radiusMeter` untuk geofencing absensi.
  4. `User` (Role `OWNER`, password di-hash `bcrypt`).
  5. `Setting` toko (logo, nama kafe, format struk, nomor WhatsApp).
  6. `Category` & `Product` (lengkap dengan harga jual, foto produk AI, dan stok default).

---

## 📋 3. Confirmable TODO List Pengerjaan

Gunakan daftar TODO ini untuk memantau pengerjaan:

### ✅ Fase 1: Backend API Engine (`backend/src/routes/fastProvisioning.ts`)
- [x] **Task 1.1**: Buat endpoint `POST /api/platform-admin/quick-provision/resolve-gmaps` untuk parsing link Google Maps dan ekstraksi GPS Lat/Lng, Nama Toko, Alamat, dan Logo.
- [x] **Task 1.2**: Buat endpoint `POST /api/platform-admin/quick-provision/ai-extract-menu` dengan integrasi Gemini 1.5 Flash Vision & normalisasi harga.
- [x] **Task 1.3**: Buat endpoint `POST /api/platform-admin/quick-provision/generate-product-image` untuk pembuatan foto kuliner estetik AI.
- [x] **Task 1.4**: Buat endpoint `POST /api/platform-admin/quick-provision/execute` untuk atomic database seeding (Tenant, Outlet, User, Settings, Categories, Products).
- [x] **Task 1.5**: Registrasikan route di `backend/src/index.ts` dengan perlindungan `authenticateToken` + `requirePlatformAdmin`.

### ✅ Fase 2: Frontend Wizard UI (`frontend/src/components/QuickProvisionModal.tsx`)
- [x] **Task 2.1**: Buat modal wizard 5 langkah (`Step 1: GMaps Link` $\rightarrow$ `Step 2: Menu Source` $\rightarrow$ `Step 3: AI Images Matrix` $\rightarrow$ `Step 4: Plan & Account` $\rightarrow$ `Step 5: Welcome Kit`).
- [x] **Task 2.2**: Implementasikan fetcher & auto-fill dari link Google Maps dengan indikator loading animasi.
- [x] **Task 2.3**: Buat editor tabel menu interaktif (tambah menu baru, edit nama & harga, hapus item).
- [x] **Task 2.4**: Tambahkan toggle Auto-Generate Foto AI + kartu preview thumbnail dengan tombol *Regenerate Image*.
- [x] **Task 2.5**: Pasang generator teks WhatsApp Welcome Kit lengkap dengan tombol 1-Click Copy ke clipboard.

### ✅ Fase 3: Integrasi Platform Admin Dashboard
- [x] **Task 3.1**: Tambahkan tombol **"+ Fast Onboard via GMaps & AI"** di `SaaSPlatformAdminView.tsx` (Tab Tenants).
- [x] **Task 3.2**: Hubungkan modal dengan reload data tabel tenant setelah provisioning selesai.

### ✅ Fase 4: Uji Coba & Verifikasi End-to-End
- [x] **Task 4.1**: Test ekstraksi URL Google Maps nyata (Shortlink & Full URL).
- [x] **Task 4.2**: Test ekstraksi foto lembar menu & verifikasi normalisasi format harga rupiah.
- [x] **Task 4.3**: Test generate foto kuliner AI dan pastikan URL gambar dapat di-render cepat di browser.
- [x] **Task 4.4**: Verifikasi login menggunakan akun klien yang baru dibuat dan cek kelengkapan data di layar POS Kasir.
