# Phase 11: DevSecOps Hardening & Security Protections

## 🎯 Target & Tujuan
Menguatkan pertahanan keamanan aplikasi (*defense-in-depth*), mengeliminasi celah kerentanan Command Injection pada backup database, mengisolasi direktori upload berkas per tenant dengan randomisasi UUID dan verifikasi MIME, menerapkan HTTP Security Headers (CSP, HSTS, noSniff) serta dynamic CORS allowlist, dan memasang middleware input sanitization untuk perlindungan anti-XSS dan anti-prototype pollution.

---

## 📋 Checklist Pekerjaan Phase 11

### 1. Database Backup Hardening & Command Injection Defense
- [x] **11.1.1** Ganti raw string interpolation shell `exec(pg_dump)` dengan safe parameter stream `spawn('pg_dump', args)` menggunakan array argumen terisolasi (`-h`, `-p`, `-U`, `-d`, `--clean`, `--if-exists`) dan environment variable `PGPASSWORD` yang aman.
- [x] **11.1.2** Tambahkan proteksi tenant scoping pada ekspor database: tenant biasa hanya mengekspor data yang dimiliki oleh `tenantId` mereka, sedangkan Full Platform Export hanya dapat diakses oleh Super Platform Admin (`isPlatformAdmin === true`).
- [x] **11.1.3** Tambahkan pencatatan audit log `DATABASE_BACKUP` dengan severity `WARNING`.

### 2. Tenant-Isolated File Uploads & Storage Security
- [x] **11.2.1** Terapkan isolasi direktori upload per tenant: `/uploads/tenants/:tenantId/:uuid.:ext`.
- [x] **11.2.2** Terapkan fungsi `sanitizeTenantPath()` untuk memblokir seluruh variasi serangan Path Traversal (`../../`, `..\..\`, `/etc/passwd`, karakter ilegal).
- [x] **11.2.3** Gunakan `crypto.randomUUID()` untuk menghasilkan nama berkas acak yang tidak dapat ditebak (*unpredictable & collision-free*).
- [x] **11.2.4** Terapkan filter ketat MIME Type dan pemetaan ekstensi gambar (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) serta pembatasan ukuran maksimal 5MB.
- [x] **11.2.5** Integrasikan pencatatan audit log `FILE_UPLOAD` saat berkas berhasil disimpan.

### 3. HTTP Security Headers, CSP & Dynamic Multi-Tenant CORS
- [x] **11.3.1** Konfigurasi Helmet dengan Content Security Policy (CSP) yang mengizinkan resource lokal, Google Fonts, WebSockets, dan Midtrans Snap (`app.sandbox.midtrans.com`, `app.midtrans.com`).
- [x] **11.3.2** Aktifkan HTTP Strict Transport Security (HSTS) dengan `maxAge: 31536000` (1 tahun), `includeSubDomains: true`, dan `preload: true`.
- [x] **11.3.3** Nonaktifkan header server identity (`x-powered-by`) dan aktifkan `X-Content-Type-Options: nosniff` serta `Referrer-Policy: strict-origin-when-cross-origin`.
- [x] **11.3.4** Terapkan Dynamic Multi-Tenant CORS Allowlist yang memvalidasi origin `localhost`, `127.0.0.1`, root `codenusa.id`, dan seluruh subdomain `*.codenusa.id`.
- [x] **11.3.5** Konfigurasi Express static server untuk `/uploads` dengan `dotfiles: 'ignore'` dan `maxAge: '1d'`.

### 4. Input Sanitization & Anti-XSS Middleware
- [x] **11.4.1** Buat middleware `backend/src/middlewares/securitySanitizer.ts` yang menyaring payload `req.body`, `req.query`, dan `req.params`.
- [x] **11.4.2** Bersihkan tag `<script>`, `javascript:`, dan event handler inline (`onerror=`, `onload=`, dll.).
- [x] **11.4.3** Blokir serangan Prototype Pollution dengan membuang manipulasi `__proto__`, `constructor`, dan `prototype`.
- [x] **11.4.4** Batasi payload JSON dan URL-encoded request body maksimal 2MB.

### 5. Verification & Testing
- [x] **11.5.1** Buat automated test suite `backend/test_phase11.js`.
- [x] **11.5.2** Jalankan pengujian dan verifikasi 100% lulus:
  - Path traversal attack vectors netral 100%.
  - Pemisahan folder upload antar tenant terisolasi.
  - Skenario XSS injection dan prototype pollution dinetralkan.
  - Safe parametric database backup snapshot terverifikasi valid.
- [x] **11.5.3** Backend (`tsc`) dan Frontend (`vite build`) terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 12)
