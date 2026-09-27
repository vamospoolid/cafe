# TODO: Hardening SaaS Backend & Control Plane (Cyber Security & Anti Miss-Logic)

Dokumen pelacak progres implementasi perbaikan teknis mendalam untuk Master Control Plane SaaS, billing subscription, impersonasi developer, serta keamanan multi-tenant platform.

---

## 📋 DAFTAR TUGAS (TODO CHECKLIST)

### Fase 1: Perbaikan Miss-Logic Finansial & Subskripsi (SaaS Billing Core)
- [x] **1.1** **Kalkulasi Durasi Invoice Tahunan (SAA-001)**:
  - Perbaiki `POST /api/platform-admin/invoices/:id/verify` di `platformAdmin.ts`.
  - Jika `subscription.billingCycle === 'YEARLY'`, tambahkan **365 hari** (`365 * 24 * 60 * 60 * 1000`) ke `currentPeriodEnd` dan `trialEndsAt`. Jika Bulanan, tambahkan **30 hari**.
  - Panggil `invalidateTenantCache(invoice.tenantId)` dan kirimkan `emitToTenant(invoice.tenantId, 'subscription:renewed', ...)`.
- [x] **1.2** **Invalidasi Cache Memori pada Perubahan Paket (SAA-002)**:
  - Panggil `invalidateTenantCache(id)` di `POST /api/platform-admin/tenants/:id/change-plan`.
  - Kirimkan `emitToTenant(id, 'tenant:plan_changed', ...)` agar tenant yang di-upgrade langsung mendapat limitasi kuota paket baru secara real-time tanpa restart server.
- [x] **1.3** **Kalkulasi Perpanjangan Masa Aktif dari `Date.now()` (SAA-003)**:
  - Perbaiki `POST /api/platform-admin/tenants/:id/extend-trial`.
  - Gunakan `baseDate = Math.max(Date.now(), new Date(currentExpiry).getTime())` agar perpanjangan +14 hari pada tenant yang sudah kadaluarsa lama tetap menghasilkan tanggal expiry di masa depan.
  - Kirim event WebSocket `tenant:status_changed` dan `tenant:reactivated`.

---

## Fase 2: Cyber Security Hardening & Isolation Protections
- [x] **2.1** **Pengetatan Security Impersonation & Audit Trail (SEC-001 & SAA-004)**:
  - Di `POST /api/platform-admin/tenants/:id/impersonate`:
    - Batasi durasi token impersonasi menjadi max **1 hari** (`1d`).
    - Tambahkan claim `isImpersonated: true`, `impersonatorId: req.user.id`, dan `impersonatorUsername`.
    - Catat audit log dengan identitas asli Platform Admin.
  - Di `authMiddleware.ts`:
    - Ekstrak claim `isImpersonated` dan `impersonatorId` ke dalam `req.user`.
    - Blokir seluruh sesi impersonasi dari mengakses Master Control Plane (`requirePlatformAdmin`).
  - Di `AuditLogger.ts`:
    - Catat prefix `[IMPERSONATED by Admin #...]` pada setiap entri mutasi/audit log yang dieksekusi selama sesi impersonasi.
- [x] **2.2** **Re-Authentication Guard pada Database Backup Dump (SEC-002)**:
  - Di `GET /api/platform-admin/database-backup`:
    - Wajibkan query parameter `?confirm=true` atau header `x-confirm-backup: true`.
    - Blokir sesi impersonasi dari mendownload database backup.
    - Catat detail IP Address dan User ID pada audit log berkategori CRITICAL.
- [x] **2.3** **Sanitasi HTML & Escaping pada Broadcast System (SEC-003)**:
  - Tambahkan sanitasi input `title` dan `message` pada `POST /api/platform-admin/broadcasts` menggunakan escaping HTML (`&lt;`, `&gt;`, dll) untuk mencegah Stored XSS di layar kasir POS PWA.
  - Integrasikan siaran real-time via `emitToTenant(targetTenantId, 'system:broadcast', created)`.
- [x] **2.4** **Real-Time Disconnect saat Tenant Disuspensi (SAA-005)**:
  - Pada `POST /api/platform-admin/tenants/:id/status`:
  - Jika status diubah ke `SUSPENDED` atau `INACTIVE`, panggil `emitToTenant(id, 'tenant:suspended', { message: 'Akses tenant telah ditangguhkan.' })` dan `emitToTenant(id, 'tenant:status_changed', { status })` untuk memutuskan koneksi Socket.IO kasir secara real-time.

---

## Fase 3: Pengujian & Anti-Regresi
- [x] **3.1** **Automated Penetration & SaaS Logic Test Script**:
  - Buat skrip `backend/scripts/test_saas_control_plane_hardening.js`.
  - Uji kalkulasi Yearly invoice (+365 hari vs +30 hari).
  - Uji perpanjangan trial dari tenant yang sudah expired lampau.
  - Uji token impersonasi claims, durasi 1 hari, dan pencegahan eskalasi hak akses.
  - Uji sanitasi XSS pada broadcast.
  - Hasil: **5/5 tests PASSED**.
- [x] **3.2** **Verifikasi TypeScript & Build Check**:
  - Jalankan `npm run build` (`tsc`) — **0 error, Exit Code 0**.
