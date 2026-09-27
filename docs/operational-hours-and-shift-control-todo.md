# TODO: Manajemen Jam Operasional Outlet & Kontrol Shift Kasir

Dokumen pelacak progres implementasi fitur pembatasan dan pengawasan shift kasir terikat jam operasional toko di CodePOS.

---

## 📋 DAFTAR TUGAS (TODO CHECKLIST)

### Fase 1: Database & Backend Core Engine
- [x] **1.1** Perbarui `backend/prisma/schema.prisma`:
  - Tambahkan di `Settings`: `operatingHours` (JSON), `earlyOpenBufferMinutes`, `closingGraceMinutes`, `enforceOperatingHours`, `allowOrdersAfterClose`.
  - Tambahkan di `Shift`: `openingPunctuality`, `lateOpenMinutes`, `supervisorOverride`.
  - Jalankan `npx prisma db push` / `npx prisma generate`.
- [x] **1.2** Buat utilitas evaluasi jam operasional `backend/src/utils/operatingHoursHelper.ts`:
  - Parser jadwal hari & jam (`dayOfWeek`, `openTime`, `closeTime`).
  - Evaluator status operasional saat ini (`STORE_OPEN`, `PREPARATION_WINDOW`, `STORE_CLOSED`, `GRACE_PERIOD_CLOSING`, `OVERDUE`).
  - Kalkulator menit keterlambatan buka toko.
- [x] **1.3** Modifikasi `backend/src/routes/shifts.ts`:
  - Perbarui `POST /api/shifts/open`: validasi terhadap jendela persiapan & jam operasional, dukung PIN supervisor untuk override jika di luar jam.
  - Perbarui `GET /api/shifts/current-summary` & `GET /api/shifts/current`: sertakan status operasional toko hari ini.
  - Perbarui `POST /api/shifts/close`: evaluasi apakah shift ditutup tepat waktu atau melebihi closing grace period.
- [x] **1.4** Modifikasi `backend/src/routes/settings.ts`:
  - Tangani update parameter `operatingHours`, `earlyOpenBufferMinutes`, `closingGraceMinutes`, `enforceOperatingHours`, `allowOrdersAfterClose`.

### Fase 2: Frontend Pengaturan & Kontrol Toko
- [x] **2.1** Modifikasi `frontend/src/components/SettingsView.tsx`:
  - Tambahkan tab/kartu *"Jam Operasional & Shift"*.
  - Buat form input jadwal 7 hari (Senin s/d Minggu) dengan toggle Buka/Tutup dan time-picker.
  - Buat input buffer persiapan buka (menit), buffer closing (menit), switch *"Mode Ketat (Wajib PIN Supervisor untuk Override)"*, dan switch *"Izinkan Kasir Buat Pesanan Setelah Jam Tutup"*.
- [x] **2.2** Perbarui `frontend/src/context/POSContext.tsx`:
  - Muat status jam operasional dan konfigurasi toko ke state global kasir terisolasi per tenant.

### Fase 3: UX Kasir, Modal Buka Shift & Peringatan Overdue
- [x] **3.1** Modifikasi `frontend/src/components/OpenShiftModal.tsx`:
  - Tampilkan ringkasan jam buka toko hari ini dan jendela waktu persiapan kasir.
  - Jika waktu di luar jam operasional & strict mode aktif, sediakan form input PIN Supervisor untuk membuka modal kasir.
- [x] **3.2** Modifikasi `frontend/src/components/POSView.tsx`:
  - Tambahkan badge status toko di header kasir: `🟢 Toko Buka`, `🟡 Jendela Persiapan`, `🟠 Toleransi Closing`, `🔴 Lewat Jam Tutup`.
  - Tambahkan banner peringatan shift overdue (lewat batas toleransi closing) dengan CTA cepat "Tutup Shift Kasir".
  - Tambahkan badge penanda `OVERRIDE` jika shift dibuka melalui persetujuan Supervisor di luar jam operasional.

### Fase 4: Pengujian & Verifikasi Menyeluruh
- [x] **4.1** Buat test script automated `backend/scripts/test_operational_hours_and_shift_control.js`:
  - Uji isolasi antar tenant (Tenant A dan Tenant B memiliki jadwal mandiri dan verifikasi PIN supervisor tidak bocor silang).
  - Uji semua status jendela operasional (`STORE_CLOSED`, `PREPARATION_WINDOW`, `STORE_OPEN`, `CLOSING_GRACE`, `OVERDUE`).
  - Uji perhitungan jam operasional lintas hari/overnight (misal 18:00 - 02:00).
  - Uji penolakan PIN non-supervisor dan pencegahan cross-tenant PIN injection.
  - Uji kebijakan fleksibilitas `allowOrdersAfterClose` sesuai permintaan klien.
- [x] **4.2** Jalankan validasi `npx tsc --noEmit` di backend dan frontend (0 errors).
