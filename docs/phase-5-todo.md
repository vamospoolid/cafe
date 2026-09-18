# Phase 5: Centralized Feature Registry & Entitlements

## 🎯 Target & Tujuan
Membangun registry fitur terpusat (Feature Registry) dan sistem perizinan fitur (Feature Entitlements / Feature Flags) untuk mengontrol visibilitas dan hak akses modul sistem berdasarkan paket langganan (SaaS Plans) maupun add-on overrides per tenant.

---

## 📋 Checklist Pekerjaan Phase 5

### 1. Schema Model Prisma
- [x] **5.1.1** Tambahkan model `Feature` di `backend/prisma/schema.prisma` (`id`, `key`, `name`, `module`, `description`, `isCore`, `status`).
- [x] **5.1.2** Tambahkan model `Plan` (`id`, `code`, `name`, `priceMonthly`, `priceYearly`, `maxOutlets`, `maxUsers`, `maxProducts`).
- [x] **5.1.3** Tambahkan model `PlanFeature` (relasi M:N antara Plan dan Feature dengan limitValue opsional).
- [x] **5.1.4** Tambahkan model `TenantFeature` (add-on grants dan explicit revokes per tenant).
- [x] **5.1.5** Hubungkan relasi `Tenant` dengan `Plan` dan `TenantFeature`.
- [x] **5.1.6** Jalankan `npx prisma db push` dan generate Prisma Client.

### 2. Feature & Plan Seeding
- [x] **5.2.1** Buat `backend/prisma/seed_features.ts`:
  - Mendaftarkan 16 fitur modul sistem: `pos.cashier`, `pos.kds`, `pos.tables`, `pos.reservations`, `inventory.basic`, `inventory.advanced`, `warehouse.management`, `crm.loyalty`, `hr.attendance`, `hr.payroll`, `finance.loans`, `finance.cashflow`, `finance.debts`, `analytics.advanced`, `multi_outlet`, `payment.digital`.
  - Mendaftarkan 4 paket SaaS bawaan: `STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`.
  - Mengasosiasikan Master Tenant (`MUKI RAMEN`) ke paket `ENTERPRISE`.
- [x] **5.2.2** Eksekusi seed script dan pastikan database tersinkronisasi.

### 3. Backend Feature Service & Entitlements Engine
- [x] **5.3.1** Buat `backend/src/services/FeatureService.ts`:
  - Resolusi hak akses: `Core Feature -> Tenant Overrides (Add-on/Revoke) -> SaaS Plan Features`.
  - In-memory cache TTL 60 detik untuk performa ultra-cepat tanpa overhead query berlebih.
  - Method `isEnabled(tenantId, featureKey)`, `getTenantFeatures(tenantId)`, `getTenantPlanAndLimits(tenantId)`, `grantTenantFeature(...)`, `revokeTenantFeature(...)`.
- [x] **5.3.2** Buat Express middleware `backend/src/middlewares/featureMiddleware.ts` (`requireFeature(featureKey)`).
- [x] **5.3.3** Buat router `backend/src/routes/features.ts` (`/api/features/my-features`, `/api/features/tenant-plan`, `/api/features/all`, `/api/features/plans`, `/api/features/override`).
- [x] **5.3.4** Terapkan `requireFeature` pada route penting di `backend/src/index.ts` (`/api/kds`, `/api/tables`, `/api/reservations`, `/api/ingredients`, `/api/recipes`, `/api/warehouse`, `/api/employee-loans`, `/api/debts`, `/api/analytics`).

### 4. Frontend Hooks & Dynamic Context
- [x] **5.4.1** Update `frontend/src/context/POSContext.tsx` untuk memuat `features`, `tenantPlan`, dan method `hasFeature(featureKey)`.
- [x] **5.4.2** Buat custom hook `frontend/src/hooks/useFeature.ts` (`useFeature(key)`, `useFeatures()`).

### 5. Verification & Testing
- [x] **5.5.1** Buat automated test suite `backend/test_phase5.js`.
- [x] **5.5.2** Jalankan test suite dan verifikasi 100% lulus (Enterprise resolution, Starter limitation, Add-on override grant, Explicit revoke).
- [x] **5.5.3** Backend dan frontend build terverifikasi 0 compilation error.

---

## 🚀 Status: COMPLETED ✅ (Siap Lanjut ke Fase 6)
