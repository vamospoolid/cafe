# Phase 7: Subscription Lifecycle, Invoicing & Optional Midtrans Gateway

## 🎯 Target & Tujuan
Mengimplementasikan sistem siklus langganan SaaS (Subscription Lifecycle), invoicing otomatis, dan integrasi modular gateway pembayaran **Midtrans** pada dua level arsitektur terpisah:
- **Level 1 (SaaS Billing)**: Pembayaran tagihan langganan paket Codenusa oleh Tenant (Midtrans Snap / Bank Transfer).
- **Level 2 (Tenant POS BYOK)**: Pembayaran pesanan menu kasir oleh pelanggan kafe menggunakan akun Midtrans milik tenant sendiri (Bring Your Own Keys - terenkripsi AES-256).

---

## 📋 Checklist Pekerjaan Phase 7

### 1. Database Schema & Relasi Billing
- [x] **7.1.1** Tambahkan model `Subscription` (`tenantId`, `planId`, `status`, `billingCycle`, `amount`, `startDate`, `currentPeriodEnd`).
- [x] **7.1.2** Tambahkan model `Invoice` (`invoiceNumber`, `tenantId`, `subscriptionId`, `planId`, `totalAmount`, `status`, `dueDate`, `paidAt`, `paymentMethod`).
- [x] **7.1.3** Tambahkan model `PaymentTransaction` (`tenantId`, `invoiceId`, `orderId`, `gateway`, `gatewayOrderId`, `status`, `snapToken`, `snapRedirectUrl`, `rawResponse`).
- [x] **7.1.4** Perbarui `TenantPaymentConfig` dan relasi `Tenant` serta `Order`.
- [x] **7.1.5** Sinkronisasi database dengan `npx prisma db push` & generate Prisma Client.

### 2. Kriptografi & Keamanan Gateway
- [x] **7.2.1** Buat `backend/src/utils/crypto.ts`:
  - Enkripsi dan dekripsi `encryptAES` / `decryptAES` menggunakan algoritma AES-256-CBC untuk mengamankan Server Key & Client Key Midtrans.
  - Verifikasi signature webhook `verifyMidtransSignature` berbasis hash SHA-512 (`SHA512(order_id + status_code + gross_amount + ServerKey)`).

### 3. Backend Payment Service & Webhook Idempotency
- [x] **7.3.1** Buat `backend/src/services/PaymentService.ts`:
  - `createSaaSInvoice`: Generate invoice tagihan SaaS dan Midtrans Snap token (L1).
  - `createPOSTransaction`: Generate transaksi Snap & Dynamic QRIS untuk pesanan kasir POS tenant (L2).
  - `handleWebhook`: Universal webhook receiver dengan signature check, anti-tamper, dan idempotency handler (mencegah double settlement).
  - `getTenantPaymentConfig` / `updateTenantPaymentConfig`: Mengelola Server Key tenant dengan masking (`SB-Mid******1234`).
  - `getTenantInvoices`: Mengambil riwayat invoice tenant.
- [x] **7.3.2** Buat router `backend/src/routes/payments.ts` dan daftarkan di `backend/src/index.ts`.

### 4. Frontend Billing & BYOK Gateway Interface
- [x] **7.4.1** Update `frontend/src/components/SaaSPlanManager.tsx`:
  - Tab **Pilihan Paket SaaS**: Tombol beli/upgrade paket dengan pembuatan Snap invoice instan.
  - Tab **Riwayat Invoice Tagihan**: Tabel invoice resmi, status pembayaran (`LUNAS`/`MENUNGGU PEMBAYARAN`), jatuh tempo, dan tombol bayar langsung.
  - Tab **Gateway Midtrans Toko (BYOK)**: Form aktivasi gateway kasir, Server Key AES-256, Client Key, Merchant ID, dan toggle channels (QRIS Dinamis, GoPay, ShopeePay, VA).

### 5. Verification & Testing
- [x] **7.5.1** Buat automated test suite `backend/test_phase7.js`.
- [x] **7.5.2** Jalankan test suite dan verifikasi 100% lulus:
  - AES-256 encryption & decryption verification.
  - SHA-512 anti-tamper signature validation.
  - L1 SaaS Invoice creation & Snap token generation.
  - L1 Webhook settlement & auto-extension of subscription period.
  - L2 Tenant POS BYOK custom server key encryption & order payment webhook.
- [x] **7.5.3** Backend dan frontend build terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 8)
