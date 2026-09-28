# Prioritas 2: Blind Z-Report & Cash Variance (Tutup Kasir Anti-Curang & Rekonsiliasi Kas Laci)

## 📋 Status & Progres
- [x] **Fase 1: Database Schema & Migration (Shift Denominations & Reason)**
  - [x] Update `model Shift` di `schema.prisma` (`denominations String?`, `varianceReason String?`).
  - [x] Sinkronisasi database menggunakan Prisma (`npx prisma db push --accept-data-loss; npx prisma generate`).
- [x] **Fase 2: Backend API Upgrade (Blind Mode & Z-Report Engine)**
  - [x] Upgrade `POST /api/shifts/close` untuk memproses `denominations`, `varianceReason`, dan menghitung status rekonsiliasi kas (`MATCHED`, `SHORT`, `OVER`).
  - [x] Integrasikan pencatatan `AuditLog` otomatis dengan severity `WARNING` bila kas laci tekor/selisih.
  - [x] Buat / optimasi endpoint `GET /api/shifts/:id/z-report` untuk data cetak struk Z-Report komprehensif.
  - [x] Tambahkan proteksi blind pada `GET /api/shifts/current-summary?blind=true` agar kasir tidak mengintip ekspektasi kas sebelum menghitung fisik.
- [x] **Fase 3: Frontend Cash Denomination Counter & Blind Close Modal**
  - [x] Upgrade `OpenShiftModal.tsx` dengan UI Interactive Denomination Grid (Rp 100k, 50k, 20k, 10k, 5k, 2k, 1k, Koin) + auto-sum.
  - [x] Implementasikan Blind Flow: Sembunyikan saldo sistem sampai kasir submit hitungan fisik.
  - [x] Form input keterangan selisih (Variance Reason) saat kas tidak seimbang.
  - [x] Layar Hasil Z-Report Pasca-Tutup: Indikator visual selisih, rincian ekspektasi vs fisik, tombol Cetak Struk Z-Report Thermal 58/80mm & Unduh PDF Berita Acara.
- [x] **Fase 4: Supervisor Shift History & Audit Inspector Upgrade**
  - [x] Update `ShiftHistoryView.tsx` dengan rincian pecahan kas, badge status selisih (Pas, Kurang, Lebih), filter shift berselisih.
  - [x] Modal inspeksi detail shift supervisor dengan print ulang struk Z-Report resmi.
- [x] **Fase 5: Pengujian & Validasi End-to-End**
  - [x] Buat script pengujian simulasi transaksi & blind shift closing (`backend/test_blind_zreport.js`).
  - [x] Validasi build TypeScript frontend (`npm run build`) & backend (`npx tsc --noEmit`).
