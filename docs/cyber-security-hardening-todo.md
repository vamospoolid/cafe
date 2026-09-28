# 🛡️ TODO LIST: CYBER SECURITY HARDENING & VULNERABILITY REMEDIATION

Dokumen ini berisi daftar tugas eksekusi perbaikan celah keamanan (*vulnerability remediation*) yang ditemukan pada audit keamanan siber sistem SaaS & POS Codenusa.

---

## 📌 Phase 1: Critical Authentication & IAM Hardening (Otentikasi & Kasir)
- [x] **1.1. Tutup Celah Identifier Guessing di QR Login** (`backend/src/routes/auth.ts`)
  - [x] Hapus pencarian akun langsung via `username` atau `name` tanpa verifikasi PIN di `/api/auth/qr-login`.
  - [x] Hapus parsing `STAFF-1` / `ID-X` yang memungkinkan login tanpa kredensial.
  - [x] Wajibkan verifikasi PIN atau *Signed HMAC Payload* pada kartu fisik/QR staf.
- [x] **1.2. Perketat Multi-Tenant Scoping pada Switch PIN** (`backend/src/routes/auth.ts`)
  - [x] Pastikan pencarian PIN staf wajib terikat ke tenant aktif (`memberships.some.tenantId = targetTenantId`).
- [x] **1.3. Hardening JWT Secret & Boot Check** (`backend/src/index.ts` & `backend/src/middlewares/authMiddleware.ts`)
  - [x] Tambahkan validasi saat server start: Jika `NODE_ENV === 'production'`, tolak default secret dan wajibkan `JWT_SECRET` berukuran minimal 32 karakter.

---

## 📌 Phase 2: Financial & Payment Gateway Hardening (Midtrans SaaS L1 & POS L2 BYOK)
- [x] **2.1. Mandatory Signature Key Verification** (`backend/src/services/PaymentService.ts`)
  - [x] Wajibkan parameter `signature_key` hadir dalam payload webhook.
  - [x] Tolak request dengan HTTP 401/400 jika `signature_key` kosong atau tidak valid (Anti-Spoofing & Anti-Tampering).
- [x] **2.2. Webhook Idempotency & Replay Protection** (`backend/src/services/PaymentService.ts`)
  - [x] Pastikan transaksi yang sudah berstatus `SUCCESS` tidak dapat di-replay atau diubah menjadi status lain tanpa verifikasi ketat.
- [x] **2.3. Sanitasi Response BYOK Server Key** (`backend/src/routes/payments.ts`)
  - [x] Pastikan endpoint `GET /api/payments/tenant-config` selalu me-mask Server Key (contoh: `SB-Mid-server-****...`) dan tidak pernah membocorkan plaintext key ke browser.

---

## 📌 Phase 3: Multi-Tenant Data Isolation & Backup Scoping
- [x] **3.1. Tutup Cross-Tenant Data Leak pada Backup JSON** (`backend/src/routes/database.ts`)
  - [x] Tambahkan relasi scoping filter untuk `orderItem`:
    ```typescript
    where: isPlatformAdmin ? {} : { order: { tenantId } }
    ```
  - [x] Tambahkan relasi scoping filter untuk `recipeItem`:
    ```typescript
    where: isPlatformAdmin ? {} : { ingredient: { tenantId } }
    ```
- [x] **3.2. Platform Admin vs Tenant User Privilege Boundary** (`backend/src/routes/database.ts`)
  - [x] Pastikan `pg_dump` full-platform hanya dapat dijalankan jika `req.user.isPlatformAdmin === true`.

---

## 📌 Phase 4: POS Concurrency, Race Condition & Stock Protection
- [x] **4.1. Thread-Safe Order Number Generator** (`backend/src/routes/orders.ts`)
  - [x] Format nomor order dengan menyertakan kode tenant/outlet unik: `ORD-{TENANT_CODE}-{YYYYMMDD}-{SEQ}`.
  - [x] Pastikan counter harian terisolasi per `tenantId` agar tidak terjadi tabrakan nomor antar-kafe.
- [x] **4.2. Atomic Stock & Recipe Deduction Validation** (`backend/src/routes/orders.ts`)
  - [x] Verifikasi semua query pengurangan stok produk dan bahan baku menggunakan raw atomic update (`WHERE stock >= usedQty`) untuk mencegah stok minus (*overselling*).

---

## 📌 Phase 5: Network, HTTP Headers, CSP & CORS Hardening
- [x] **5.1. Perketat Dynamic CORS Allowlist** (`backend/src/index.ts`)
  - [x] Hapus fallback permissive yang meloloskan origin tidak dikenal.
  - [x] Batasi origin secara eksplisit ke: `localhost`, `127.0.0.1`, `codenusa.id`, `*.codenusa.id`, dan custom domain terverifikasi di database.
- [x] **5.2. Audit Rate Limiting & Nginx Proxy Headers** (`deployment/nginx/codepos.conf`)
  - [x] Pastikan `X-Forwarded-For` dan `X-Real-IP` ter-set dengan benar agar Express Rate Limiter membaca IP asli klien, bukan IP Nginx gateway.

---

## 📌 Phase 6: Automated Verification & Security Testing
- [x] **6.1. Build & Typecheck**:
  - [x] Jalankan `npx tsc --noEmit` di backend (0 error).
  - [x] Jalankan `npm run build` di frontend (0 error).
- [x] **6.2. Penetration Testing Emulation**:
  - [x] Uji tembak QR Login dengan ID palsu -> Berhasil ditolak (401).
  - [x] Uji kirim Webhook tanpa signature -> Berhasil ditolak (401/400).
  - [x] Unduh backup JSON Kafe A -> Terisolasi ketat, bebas data kafe lain.
