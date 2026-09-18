# Phase 13: Automated Security & Isolation Testing

## 🎯 Target & Tujuan
Membangun dan menjalankan *automated end-to-end security test suite* untuk memverifikasi secara matematis dan empiris bahwa seluruh lapisan arsitektur keamanan multi-tenant, otentikasi granular RBAC, pencegahan eskalasi hak akses, kriptografi AES-256, dan validasi signature anti-forgery webhook pembayaran berfungsi 100% tanpa celah.

---

## 📋 Checklist Pekerjaan Phase 13

### 1. Cross-Tenant Read & Write Attack Suite
- [x] **13.1.1** Skenario Penyerangan 1A (Cross-Tenant Read):
  - Tenant A mencoba query seluruh produk menggunakan Prisma Scoped Client dan JWT miliknya.
  - Hasil: Hanya produk milik Tenant A yang kembali. Data Tenant B terisolasi 100% dan tidak bocor.
- [x] **13.1.2** Skenario Penyerangan 1B (Cross-Tenant Write / Sabotase Harga):
  - Tenant A mencoba mengeksekusi `updateMany` untuk mengubah harga produk milik Tenant B menjadi Rp 1.000.
  - Hasil: Operasi menghasilkan 0 affected rows. Harga asli produk Tenant B tetap aman tidak berubah.

### 2. Privilege Escalation & Granular RBAC Attack Suite
- [x] **13.2.1** Skenario Penyerangan 2A (Kasir mencoba akses Penggajian & Analitik Laba):
  - Kasir dengan izin `['pos.view', 'pos.create']` mencoba mengakses endpoint `employees.manage` dan `analytics.view`.
  - Hasil: Ditolak dengan status HTTP 403 Forbidden.
- [x] **13.2.2** Skenario Penyerangan 2B (Dapur mencoba mengubah harga menu):
  - Akun dapur dengan izin `['kds.view', 'kds.cook', 'kds.serve']` mencoba mengakses endpoint `products.manage`.
  - Hasil: Ditolak dengan status HTTP 403 Forbidden.
- [x] **13.2.3** Skenario Penyerangan 2C (Manager mencoba bypass Platform SuperAdmin):
  - Akun manager outlet mencoba mengakses konfigurasi platform multi-tenant tanpa flag `isPlatformAdmin`.
  - Hasil: Ditolak tegas HTTP 403 Forbidden.

### 3. Webhook Forgery & Signature Tampering Defense
- [x] **13.3.1** Skenario Penyerangan 3A (Pemalsuan Signature / Forged Signature):
  - Mengirimkan payload notifikasi pembayaran Midtrans dengan hash SHA-512 palsu.
  - Hasil: Ditolak (HTTP 401 Unauthorized).
- [x] **13.3.2** Skenario Penyerangan 3B (Manipulasi Nominal Transaksi / Tampered Amount):
  - Mengirimkan payload nominal Rp 99.000 menggunakan signature dari transaksi Rp 199.000.
  - Hasil: Ditolak karena ketidakcocokan nilai hash SHA-512.
- [x] **13.3.3** Skenario Penyerangan 3C (Payload Tanpa Signature):
  - Hasil: Ditolak langsung (HTTP 401 Unauthorized).
- [x] **13.3.4** Skenario Transaksi Asli:
  - Payload dengan signature SHA-512 valid terverifikasi 100% sukses (HTTP 200 OK).

### 4. Sensitive Credential Protection (AES-256 & Masking)
- [x] **13.4.1** Verifikasi penyimpanan Server Key Midtrans: Database hanya menyimpan format ciphertext `IV:encrypted_hex`.
- [x] **13.4.2** Verifikasi fungsi dekripsi `decryptAES()` mengembalikan plaintext secara akurat.
- [x] **13.4.3** Verifikasi masking antarmuka publik (`SB-Mid••••••••_999`) untuk mencegah pencurian credential dari tampilan layar.

### 5. Token Integrity & Rate Limiting Audit
- [x] **13.5.1** Verifikasi JWT Cryptographic Signature menolak token yang dimanipulasi (*tampered token*).
- [x] **13.5.2** Seluruh test suite terangkum dalam `backend/test_phase13.js` dan lulus 100%.
- [x] **13.5.3** Backend (`tsc`) dan Frontend (`vite build`) terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 14)
