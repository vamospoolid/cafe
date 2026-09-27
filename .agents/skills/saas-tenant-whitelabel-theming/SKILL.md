---
name: saas-tenant-whitelabel-theming
description: Standar arsitektur, keamanan isolasi multi-tenant, dan strategi komersialisasi enterprise untuk fitur Dynamic Custom Theme & Login Layout White-Labeling di CodePOS SaaS.
---

# Skill: SaaS Dynamic Multi-Tenant White-Label Theming & Login Layout Engine

Panduan standar arsitektur kelas enterprise untuk mengimplementasikan fitur kustomisasi tema visual (*branding identity*) dan tata letak login (*login layouts*) yang bersifat dinamis, terisolasi 100% antar-tenant, aman dari kebocoran data (*zero information leakage*), dan memiliki nilai komersial tinggi (*high monetization value*) untuk klien kafe, restoran, dan franchise multi-outlet.

---

## 💎 1. Nilai Komersial & Strategi Monetisasi SaaS (Commercial Value)

Fitur White-Labeling bukan sekadar kosmetik visual, melainkan diferensiasi produk premium bernilai tinggi:

```
┌────────────────────────────────────────────────────────────────────────┐
│ STRUKTUR TIERING & ENTITLEMENT WHITE-LABEL                             │
├────────────────────────────────────────────────────────────────────────┤
│ 1. STARTER TIER (Gratis / Standar)                                     │
│    • Branding Default: CodePOS Platform                                │
│    • Layout Login: Standar Split-Screen Default                        │
│    • Skema Warna: Indigo/Slate Default                                 │
│                                                                        │
│ 2. PRO BUSINESS TIER (+Rp 99.000 - Rp 199.000 / bln)                   │
│    • Kustomisasi Warna Primer & Aksen Brand (CSS Variables)            │
│    • Upload Logo Usaha & Wallpaper Login Interior Kafe Sendiri         │
│    • Pilihan 3 Preset Layout Login (Split, Centered Glass, Minimalist) │
│    • Tagline Kustom & Dynamic Browser Tab Title                        │
│    • Subdomain Eksklusif: `[namakafe].codenusa.id`                      │
│                                                                        │
│ 3. ENTERPRISE FRANCHISE TIER (+Rp 499.000 - Rp 999.000 / bln)          │
│    • Seluruh fitur Pro Business                                        │
│    • Custom Domain Mandiri (e.g. `pos.vamospool.id`)                   │
│    • Kustom Favicon & PWA App Manifest Dinamis (Icon Home Screen)      │
│    • Kustom Tipografi (Pilihan Font Google Fonts Terkurasi)            │
│    • Hilangkan tulisan "Powered by CodePOS" (100% Pure White-Label)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ 2. Aturan Emas Keamanan & Isolasi Multi-Tenant (*Golden Rules*)

### Rule 1: Public Branding Endpoint Zero-Leak Principle
Karena halaman login diakses sebelum pengguna terotentikasi (sebelum login), backend harus menyediakan endpoint publik untuk mengambil data tema.
- **Wajib Whitelist Ketat**:
  ```typescript
  // BENAR: Hanya properti visual publik yang dikembalikan
  return res.json({
    storeName: tenant.settings?.storeName || tenant.name,
    slug: tenant.slug,
    logoUrl: tenant.settings?.logoUrl || tenant.logoUrl,
    faviconUrl: tenant.settings?.faviconUrl || null,
    primaryColor: tenant.settings?.primaryColor || '#6366f1',
    accentColor: tenant.settings?.accentColor || '#f59e0b',
    loginLayout: tenant.settings?.loginLayout || 'split_modern',
    loginTagline: tenant.settings?.loginTagline || '',
    loginCoverUrl: tenant.settings?.loginCoverUrl || '/assets/images/cafe_login_cover.png',
    fontFamily: tenant.settings?.fontFamily || 'Inter',
    hidePlatformBranding: isEnterprisePlan(tenant.plan) && tenant.settings?.hidePlatformBranding
  });
  ```
- **DILARANG KERAS**: Mengembalikan `tenantId`, data user/karyawan, daftar order, saldo, API keys, atau konfigurasi payment gateway pada endpoint publik branding ini!

### Rule 2: Hostname & Subdomain Strict Sanitization
- Resolusi tenant dilakukan melalui urutan prioritas:
  1. `req.headers['x-custom-domain']` atau `req.hostname` (pencarian di DB: `Tenant.customDomain === host`).
  2. Subdomain parsing dari `req.hostname` (e.g. `mukiramen.codenusa.id` -> slug `mukiramen`).
  3. Query param eksplisit yang disanitasi: `?tenant=slug` (hanya karakter `[a-z0-9-]`).
  4. Fallback: Profil default CodePOS.
- Semua slug wajib difilter terhadap karakter injeksi SQL / NoSQL / Path Traversal (`/`, `..`, `'`, `"`, `$`).

### Rule 3: Anti-XSS Sanitization pada Nilai Styling Kustom
- Nilai warna heksadesimal (`primaryColor`, `accentColor`) wajib divalidasi dengan regex heksadesimal:
  ```typescript
  const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (primaryColor && !HEX_COLOR_REGEX.test(primaryColor)) {
    throw new Error('Format warna heksadesimal tidak valid');
  }
  ```
- Mencegah injeksi kode berbahaya (`javascript:`, `expression()`, `<script>`) ke dalam atribut CSS atau style DOM.

---

## 🎨 3. Arsitektur Frontend Theming Tanpa Kompilasi Ulang (Zero-Build CSS Variables)

Untuk menjaga performa tanpa perlu me-rebuild bundle Vite/Tailwind untuk setiap kafe:

```
┌────────────────────────────────────────────────────────┐
│ 1. Fetch Public Brand Data                             │
│    GET /api/public-branding?domain=vamoskopi.codenusa  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Injeksi Dinamis CSS Variables ke :root DOM          │
│    document.documentElement.style.setProperty(         │
│      '--tenant-primary', brand.primaryColor            │
│    )                                                   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Tailwind Native CSS Variable Consumer               │
│    • Tombol Utama: `bg-[var(--tenant-primary)]`        │
│    • Border Fokus: `focus:border-[var(--tenant-prim)]` │
│    • Text Accent:  `text-[var(--tenant-accent)]`       │
└────────────────────────────────────────────────────────┘
```

---

## 📐 4. Empat Preset Layout Login Terkurasi (Curated UX Layouts)

1. **`split_modern` (Default)**:
   - Separuh kiri: Wallpaper interior kafe resolusi tinggi dengan filter glassmorphism & statistik operasional.
   - Separuh kanan: Form kasir bersih, elegan, dengan shadow halus.
2. **`centered_glass` (Estetik Kafe)**:
   - Layar penuh wallpaper interior kafe dengan efek blur mendalam (*backdrop-blur-xl*).
   - Form kasir mengambang di tengah (*floating glass card*) dengan border semi-transparan `border-white/20`.
3. **`minimal_luxe` (Cepat & Ringan untuk Tablet Kasir)**:
   - Latar belakang solid slate/dark elegan tanpa gambar berat.
   - Pemuatan instan (< 100ms) di jaringan lambat atau tablet entry-level.
4. **`cafe_atmosphere` (Boutique & Roastery)**:
   - Menampilkan greeting hangat, foto barista/produk andalan, dan jam operasional kafe di samping form login.

---

## 🔄 5. Live Customizer Preview di Menu Pengaturan (Self-Service Dashboard)

Pemilik kafe tidak boleh "membeli kucing dalam karung". Di menu **Pengaturan Toko -> Tampilan & Branding**:
- Tersedia panel **Live Preview Interaktif (Desktop & Mobile Frame)** yang langsung berubah saat warna dipilih atau layout diubah.
- Tombol **"Simpan & Terapkan"** yang memicu audit trail log dan invalidasi cache branding publik secara atomic.
