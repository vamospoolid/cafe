---
name: saas-tenant-suspension-hardening
description: >
  Standar arsitektur & pola perbaikan untuk sistem SaaS multi-tenant CodePOS terkait
  keamanan suspensi tenant: pemisahan namespace audit log platform vs tenant,
  enforcement middleware blokir akses tenant SUSPENDED/INACTIVE, dan invalidasi cache
  tenant real-time saat status berubah via SaaS Control Plane.
---

# SKILL: SaaS Tenant Suspension Hardening

## Konteks Masalah

Terdapat 3 celah keamanan krusial terkait suspensi tenant:

1. BUG #1 (MEDIUM): Event platform (TENANT_UPDATE) ditulis ke namespace tenant, muncul di Audit Trail tenant
2. BUG #2 (CRITICAL): Tidak ada middleware yang memblokir akses saat tenant.status = SUSPENDED
3. BUG #3 (HIGH): tenantCache in-memory tidak di-invalidate saat status tenant berubah

---

## BUG #1 Fix — Platform AuditLog Namespace

SALAH:
  await AuditLogger.log({ tenantId: id, action: 'TENANT_UPDATE', ... }, req);

BENAR:
  await AuditLogger.log({ tenantId: null, action: 'TENANT_UPDATE', ... }, req);

Aturan: Semua aksi dari platformAdmin.ts HARUS menggunakan tenantId: null.

---

## BUG #2 Fix — Middleware requireActiveTenant

`	ypescript
// authMiddleware.ts
export const requireActiveTenant = async (
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> => {
  if (req.user?.isPlatformAdmin) return next();
  const tenantId = (req as any).tenantId || req.user?.tenantId;
  if (!tenantId) return next();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true }
  });

  if (!tenant) {
    res.status(403).json({ error: 'Tenant tidak ditemukan.', code: 'TENANT_NOT_FOUND' });
    return;
  }
  if (tenant.status === 'SUSPENDED') {
    res.status(403).json({
      error: 'Akun tenant sedang ditangguhkan. Hubungi administrator platform.',
      code: 'TENANT_SUSPENDED', tenantName: tenant.name
    });
    return;
  }
  if (tenant.status === 'INACTIVE') {
    res.status(403).json({ error: 'Akun tenant tidak aktif.', code: 'TENANT_INACTIVE' });
    return;
  }
  next();
};
`

Pemasangan di index.ts (urutan wajib):
  app.use(tenantResolverMiddleware);   // 1. resolusi tenantId
  app.use(authenticateToken);          // 2. validasi JWT
  app.use(requireActiveTenant);        // 3. blokir SUSPENDED <- BARU

Whitelist (JANGAN blokir):
  POST /api/auth/login
  POST /api/auth/logout
  GET  /api/health
  /api/platform-admin/*

---

## BUG #3 Fix — Invalidate Cache Real-Time

`	ypescript
// tenantResolver.ts
export function invalidateTenantCache(tenantId: string): void {
  for (const [key, val] of tenantCache.entries()) {
    if (val.id === tenantId) tenantCache.delete(key);
  }
}
`

`	ypescript
// platformAdmin.ts — setelah prisma.tenant.update()
import { invalidateTenantCache } from '../middlewares/tenantResolver';
invalidateTenantCache(id);
`

---

## Urutan Implementasi

1. Fix Bug #3 (cache invalidate) — tidak breaking
2. Fix Bug #2 (middleware requireActiveTenant)
3. Fix Bug #1 (audit log namespace)
4. Buat test suite
5. Rebuild & restart backend

---

## Verifikasi Checklist

- [ ] Suspend tenant A → user A dapat 403 TENANT_SUSPENDED tanpa server restart
- [ ] Platform Admin bypass middleware (tetap bisa akses)
- [ ] Event TENANT_UPDATE tidak muncul di Audit Trail tenant A
- [ ] Activate tenant A → akses pulih normal
- [ ] Test semua 5 skenario otomatis PASS

---

## Referensi File

| File | Perubahan |
|------|-----------|
| backend/src/middlewares/authMiddleware.ts | Tambah requireActiveTenant |
| backend/src/middlewares/tenantResolver.ts | Export invalidateTenantCache |
| backend/src/routes/platformAdmin.ts | tenantId: null + invalidateTenantCache(id) |
| backend/src/index.ts | Pasang requireActiveTenant global |
