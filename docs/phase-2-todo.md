# PHASE 2: User, Membership, Granular RBAC & Permissions Engine - Action Checklist

## 🎯 Status Phase 2: SELESAI (COMPLETED ✅)
Sistem membership multi-tenant dan granular RBAC engine telah sukses diimplementasikan. Pengguna sekarang memiliki hubungan `TenantMembership`, token JWT menyertakan konteks `tenantId`, `role`, dan daftar `permissions` granular. Middleware `requirePermission` dan `requireRole` telah aktif, serta antarmuka manajemen karyawan telah dipercantik dengan pemilih Role & Permission Matrix interaktif.

---

## 📝 Rekapitulasi Checklist Todo List Phase 2

### 2.1 Refaktor Autentikasi & Multi-Tenant Token (`backend/src/routes/auth.ts`)
- [x] **2.1.1** Login (`/api/auth/login`): Menghubungkan user dengan membership tenant aktif, menghasilkan JWT yang membawa `tenantId`, `outletId`, `role`, dan `permissions` array.
- [x] **2.1.2** Switch PIN (`/api/auth/switch-pin`): Resolusi PIN dalam konteks tenant aktif.
- [x] **2.1.3** Switch Tenant (`/api/auth/switch-tenant`): Endpoint untuk beralih antar tenant bagi user yang memiliki membership di lebih dari 1 outlet.
- [x] **2.1.4** QR Login (`/api/auth/qr-login`): Autentikasi kartu QR badge terhubung ke tenant context.

### 2.2 Middleware Otorisasi & RBAC (`backend/src/middlewares/authMiddleware.ts`)
- [x] **2.2.1** `authenticateToken`: Mengekstrak `tenantId`, `role`, dan `permissions` dari JWT dengan fallback kompatibilitas legacy.
- [x] **2.2.2** `requirePermission(permKey)`: Memvalidasi izin spesifik (misal: `employees.view`, `employees.manage`, `pos.void`).
- [x] **2.2.3** `requireRole(roleNames)`: Memvalidasi role pengguna.
- [x] **2.2.4** Super Admin / OWNER bypass untuk kelancaran operasional pemilik bisnis.

### 2.3 Manajemen Staf & Membership API (`backend/src/routes/users.ts`)
- [x] **2.3.1** `GET /api/users`: Menampilkan staf yang terikat pada `tenantId` aktif.
- [x] **2.3.2** `POST /api/users`: Mendaftarkan staf baru langsung ke `TenantMembership` dengan Role yang dipilih.
- [x] **2.3.3** `PUT /api/users/:id`: Mengubah role, PIN, dan data staf di level tenant.
- [x] **2.3.4** `DELETE /api/users/:id`: Soft delete/suspend membership staf dalam tenant aktif.
- [x] **2.3.5** `GET /api/users/roles-permissions`: Menyediakan katalog role dan daftar permission untuk UI.

### 2.4 Frontend Integration & UI Estetika (`frontend`)
- [x] **2.4.1** `POSContext.tsx`: Menambahkan helper `hasPermission(permissionKey)` dan menyimpan data `memberships`.
- [x] **2.4.2** `UserView.tsx`: Proteksi tampilan berbasis `hasPermission('employees.view')` & badge role modern (`OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `KITCHEN`, `WAREHOUSE`, `HR`).
- [x] **2.4.3** `UserModal.tsx`: Dropdown Role dinamis, preset permission otomatis sesuai role yang dipilih, dan toggle fine-tuning hak akses staf.

### 2.5 Verifikasi & Automated Test Suite
- [x] **2.5.1** `test_phase2.js` (Pengujian integritas seeding role/permissions, resolusi membership, isolasi privilege cashier, dan payload JWT): **100% PASSED**.
- [x] **2.5.2** `test_phase1.js` (Regression testing): **100% PASSED**.
- [x] **2.5.3** Backend build (`tsc`) & Frontend build (`vite build`): **0 Error / Lolos**.
