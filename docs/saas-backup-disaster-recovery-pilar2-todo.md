# Checklist & Dokumentasi: Pilar 2 — Automated Scheduled Backup (03:00 WIB), GFS Retention Policy & Disaster Recovery Engine

Dokumen ini memuat daftar implementasi dan hasil verifikasi untuk **Pilar 2: Backup Otomatis Database PostgreSQL & Disaster Recovery Script** di CodePOS SaaS.

---

## Status: ✅ COMPLETED (100% — 61/61 Tests Passing)

---

## 📌 Checklist Tugas - Pilar 2

### 1. Unified Backup & Cryptographic Engine (`BackupService.ts`)
- [x] **Enkripsi AES-256-CBC**: Enkripsi payload database dengan kunci 32-byte turunan SHA-256 dan IV acak 16 byte (`.enc`).
- [x] **Kompresi Gzip Level 9**: Kompresi data snapshot maksimal untuk menghemat kapasitas disk (`.gz`).
- [x] **Format Penamaan Terstandarisasi**: `backup-full-platform-YYYY-MM-DDTHH-mm-ss-sssZ.json.gz.enc` dan `backup-tenant-<tenantId>-...`.
- [x] **Companion Metadata Descriptor (`.meta.json`)**: Berisi `schemaVersion`, `platform`, `scope`, `sizeBytes`, `checksumSha256`, `signature` HMAC, dan ringkasan `entityCounts`.
- [x] **Integritas Anti-Tamper**: Verifikasi SHA-256 checksum dan HMAC-SHA256 signature sebelum operasi pembacaan/restorasi.
- [x] **API Unifikasi**: Mendukung pemanggilan static (`BackupService.createBackup`, `BackupService.listBackups`, `BackupService.purgeOldBackups`, `BackupService.restoreBackup`) dan instance (`backupService`).

### 2. Kebijakan Retensi & Rotasi GFS (Grandfather-Father-Son)
- [x] **Son (Daily)**: Menyimpan seluruh cadangan harian selama 7 hari terakhir.
- [x] **Father (Weekly)**: Menyimpan 1 cadangan per minggu untuk minggu ke-2 hingga ke-4 (hari ke-8 s/d ke-28).
- [x] **Grandfather (Monthly)**: Menyimpan 1 cadangan per bulan untuk bulan ke-2 hingga ke-3 (hari ke-29 s/d ke-90).
- [x] **Pencegahan Disk Exhaustion**: Otomatis memangkas berkas di luar jadwal retensi (> 90 hari) dan berkas duplikat pada jendela yang sama.

### 3. Background Cron Worker Otonom (`BackupCronService.ts` & `index.ts`)
- [x] **Jadwal 03:00 WIB**: Menghitung waktu lokal WIB (UTC+7) secara akurat.
- [x] **Garansi Idempotensi**: Mencegah eksekusi ganda pada tanggal yang sama.
- [x] **Integrasi Startup & Periodic**: Didaftarkan di `index.ts` untuk memeriksa jendela jadwal saat booting dan per 30 menit.
- [x] **Audit Log Terintegrasi**: Mencatat aktivitas `DATABASE_BACKUP_SCHEDULED`.

### 4. Deterministic Disaster Recovery Restore Engine
- [x] **Full Platform Restore**: Pemulihan atomik transaksional via `prisma.$transaction()` untuk seluruh entitas (Tenant, Outlet, User, Product, Category, Ingredient, Table, Customer, dll).
- [x] **Single-Tenant Scoped Restore**: Pemulihan terisolasi khusus tenant target tanpa mempengaruhi tenant lain (zero cross-tenant impact).
- [x] **SLA RTO < 10 Menit**: Terverifikasi memulihkan dataset dalam waktu < 1 detik (~804 ms).
- [x] **CLI Script Alignment**:
  - `backup_database.ts`: CLI pencadangan aman (`--gfs`, `--retention`, `--tenant`, `--no-encrypt`, `--purge`).
  - `restore_database.ts`: CLI pemulihan darurat VPS (`--file`, `--tenant`).

### 5. Platform Admin Management API & UI Dashboard
- [x] **API Endpoints**:
  - `GET /api/platform-admin/backups`: Daftar berkas dengan klasifikasi GFS & status validitas.
  - `POST /api/platform-admin/backups/create`: Pembuatan backup instan.
  - `POST /api/platform-admin/backups/purge`: Pemicu rotasi retensi GFS.
  - `POST /api/platform-admin/backups/restore`: Eksekusi disaster recovery.
  - `GET /api/platform-admin/backups/verify/:fileName`: Verifikasi integritas anti-tamper.
  - `GET /api/platform-admin/backups/download/:fileName`: Unduh snapshot terenkripsi.
  - `GET /api/platform-admin/backups/cron-status`: Status background cron 03:00 WIB.
- [x] **Frontend UI (`SaaSDatabaseOpsAdmin.tsx`)**:
  - Repositori tabel berkas snapshot interaktif dengan badge GFS (Daily/Weekly/Monthly), badge AES-256, dan badge integritas.
  - Tombol aksi: Verifikasi Integritas, Unduh Berkas, dan Restore Snapshot.
  - Tombol aksi cepat: *Snapshot Backup Sekarang* dan *GFS Prune*.
  - Indikator SLA: RTO < 10 Menit, RPO < 1 Jam, Jadwal 03:00 WIB.

### 6. Hasil Verifikasi Otomatis (61 / 61 Tests Passed)
- [x] `test_phase12_automated_backup_and_disaster_recovery.js`: **6 / 6 PASSED** ✅
- [x] `test_phase11_subscription_lifecycle_and_dunning.js`: **6 / 6 PASSED** ✅
- [x] `test_phase10_idor_and_nested_fk_isolation.js`: **6 / 6 PASSED** ✅
- [x] `test_phase8_cross_tenant_realtime_and_failclosed.js`: **6 / 6 PASSED** ✅
- [x] `test_phase6_suspension_hardening.js`: **5 / 5 PASSED** ✅
- [x] Total Suite: **61 / 61 TESTS PASSED (100%)** 🏆
- [x] Kompilasi: Backend (`tsc`) 0 errors, Frontend (`tsc -b && vite build`) 0 errors.
