# Checklist & TODO: Phase 6 — SaaS Tenant Suspension Security Hardening

Dokumen ini memuat daftar tugas untuk memperbaiki 3 celah keamanan krusial terkait
suspensi tenant di platform SaaS CodePOS.

---

## Status: PENDING — Menunggu Approval Implementation Plan

---

## Ringkasan Bug yang Diperbaiki

| Bug | File | Severity |
|-----|------|----------|
| #1 Platform audit log bocor ke namespace tenant | platformAdmin.ts, AuditLogger.ts | 🟡 MEDIUM |
| #2 Tidak ada gerbang blokir akses tenant SUSPENDED | authMiddleware.ts, index.ts | 🔴 CRITICAL |
| #3 tenantCache stale, suspend tidak real-time | tenantResolver.ts | 🔴 HIGH |

---

## 📌 Checklist Tugas - Phase 6

### 1. Fix Bug #3 — Cache Invalidation (tenantResolver.ts)
- [ ] Export fungsi invalidateTenantCache(tenantId: string) di tenantResolver.ts
  - Loop semua entry cache, hapus yang val.id === tenantId
- [ ] Export fungsi clearAllTenantCache() untuk testing/reset darurat

### 2. Fix Bug #2 — Middleware requireActiveTenant (authMiddleware.ts)
- [ ] Tambah middleware equireActiveTenant di authMiddleware.ts:
  - Platform Admin bypass (isPlatformAdmin = true → next())
  - Query prisma.tenant.findUnique({ select: { status, name } })
  - SUSPENDED → 403 { code: 'TENANT_SUSPENDED' }
  - INACTIVE → 403 { code: 'TENANT_INACTIVE' }
  - DB error → fail-open (next())

### 3. Fix Bug #2 — Pasang Middleware Global (index.ts)
- [ ] Import requireActiveTenant di index.ts
- [ ] Pasang SETELAH authenticateToken, SEBELUM semua route:
  app.use(tenantResolverMiddleware);
  app.use(authenticateToken);
  app.use(requireActiveTenant);  <- BARU
- [ ] Konfigurasi whitelist path yang di-skip:
  - /api/auth/login
  - /api/auth/logout
  - /api/health
  - /api/platform-admin/*

### 4. Fix Bug #1 — Platform Audit Log Namespace (platformAdmin.ts)
- [ ] Di handler POST /tenants/:id/status:
  - Ubah tenantId: id → tenantId: null pada AuditLogger.log()
  - Tambahkan invalidateTenantCache(id) setelah prisma.tenant.update()
- [ ] Di handler POST /tenants/:id/extend-trial:
  - Ubah tenantId: id → tenantId: null pada AuditLogger.log()
  - Tambahkan invalidateTenantCache(id)
- [ ] Cek semua AuditLogger.log() lainnya di platformAdmin.ts → semua pakai tenantId: null

### 5. (Opsional) Platform Audit Endpoint (AuditLogger.ts)
- [ ] Tambah static method getPlatformLogs(filter) dengan where: { tenantId: null }
  untuk Audit Trail di SaaS Control Plane

### 6. Frontend — Error Handling TENANT_SUSPENDED
- [ ] Di frontend (POSContext / interceptor axios/fetch), tangkap response 403 dengan
  code === 'TENANT_SUSPENDED' dan tampilkan halaman "Akun Anda Ditangguhkan"
- [ ] Redirect ke halaman suspended dengan informasi kontak support

### 7. Test Suite & Verifikasi
- [ ] Buat skrip backend/scripts/test_phase6_suspension_hardening.js (5 skenario):
  1. User SUSPENDED dapat 403 TENANT_SUSPENDED
  2. Platform Admin bypass middleware
  3. TENANT_UPDATE tidak muncul di Audit Trail tenant
  4. Cache invalidasi real-time (tanpa restart)
  5. Aktivasi ulang memulihkan akses
- [ ] Jalankan test suite — 5/5 PASS
- [ ] Jalankan regresi Phase 1-5 — 22/22 PASS
- [ ] TypeScript tsc --noEmit — zero errors
- [ ] Manual test: Suspend → Login denied → Activate → Login sukses
