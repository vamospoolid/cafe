# TODO List: Tenant Reset & Onboarding Template System

## 1. Backend Implementation
- [x] Buat file `backend/src/routes/tenantReset.ts`
  - [x] Implementasi `GET /api/tenant-reset/templates` (Metadata preset industri)
  - [x] Implementasi `POST /api/tenant-reset/transactions` (Hapus order, orderItems, shift, attendance, cashflow untuk tenant aktif)
  - [x] Implementasi `POST /api/tenant-reset/full` (Factory reset katalog + transaksi untuk tenant aktif)
  - [x] Implementasi `POST /api/tenant-reset/apply-template` (Inject preset Coffee Shop / Resto F&B / Bakery ke tenant aktif)
  - [x] Pasang `AuditLogger.log` dengan severity `CRITICAL` / `WARNING` untuk setiap aksi reset
- [x] Daftarkan endpoint di `backend/src/index.ts` (`app.use('/api/tenant-reset', tenantResetRouter)`)

## 2. Frontend Implementation
- [x] Buat komponen `frontend/src/components/TenantResetModal.tsx`
  - [x] Tab 1: Template Usaha Awal (Katalog Coffee Shop, Resto F&B, Bakery)
  - [x] Tab 2: Pulihkan dari Backup (Restore JSON + Dry Run Inspector)
  - [x] Tab 3: Reset Riwayat Transaksi (Simulasi Pre-Launch Kasir) dengan input proteksi `"RESET-TRANSAKSI"`
  - [x] Tab 4: Factory Reset Total (Clean Slate) dengan input proteksi `"RESET-TOTAL"`
- [x] Integrasikan tombol pemicu modal di `frontend/src/components/SettingsView.tsx` (Menu Pengaturan > Manajemen Data & Reset Toko)
- [x] Tambahkan notifikasi toast sukses/gagal & auto reload data setelah reset/template diterapkan

## 3. Automated & Manual Verification
- [x] Jalankan uji script isolasi multi-tenant (verifikasi tenant lain tidak terpengaruh)
- [x] Uji Reset Transaksi di backend & frontend
- [x] Uji Apply Template Coffee Shop di backend & frontend
- [x] Uji Full Factory Reset di backend & frontend
- [x] Uji Restore & Rollback engine
