# TODO: INDEPENDENT MULTI-TENANT WHATSAPP CRM & MVP MIGRATION

Dokumen ini memuat daftar tugas teknis untuk pembangunan fitur WhatsApp CRM yang berdiri independen per tenant, dapat dikustomisasi mandiri oleh klien, terintegrasi sebagai Optional Add-On, dan tetap terjaga utuh saat terjadi migrasi MVP.

---

## 📋 FASE 1: Skema Database & Isolasi Multi-Tenant
- [x] **1.1. Model Database Prisma**
  - [x] Tambahkan model `TenantWhatsAppConfig` di `prisma/schema.prisma` (status koneksi, phone, QR code, kuota, switch trigger).
  - [x] Tambahkan model `WhatsAppTemplate` di `prisma/schema.prisma` (triggerKey, templateBody, vertical, isActive).
  - [x] Tambahkan model `WhatsAppLog` di `prisma/schema.prisma` (recipientPhone, triggerKey, messageBody, status, error).
  - [x] Jalankan `npx prisma db push` & `npx prisma generate` di backend.
- [x] **1.2. Storage Directory & Auth Keys Isolation**
  - [x] Buat helper direktori sesi per tenant: `backend/storage/whatsapp_sessions/{tenantId}/`.
  - [x] Pastikan `.gitignore` mengecualikan seluruh isi folder `backend/storage/whatsapp_sessions/` agar kredensial klien tidak ter-push ke GitHub.
- [x] **1.3. Feature Registry & Add-On Gating**
  - [x] Daftarkan feature key `crm.whatsapp` dan `crm.broadcast` ke `FeatureService` & `seed_features.ts`.
  - [x] Pasang middleware `requireFeature('crm.whatsapp')` pada seluruh endpoint API WhatsApp.

---

## 📋 FASE 2: Backend WhatsApp Gateway Engine (Baileys Multi-Session)
- [x] **2.1. Multi-Session Connection Manager**
  - [x] Buat service singleton `WhatsAppManager.ts` untuk mengelola map sesi koneksi aktif: `Map<string, WASocket>`.
  - [x] Implementasikan auto-reconnect cerdas saat socket disconnect (kecuali jika di-logout oleh user).
  - [x] Batasi pemakaian memori per sesi dan auto restore sesi aktif saat startup backend.
- [x] **2.2. Web QR Code Generator & Status Polling**
  - [x] Endpoint `GET /api/whatsapp/status`: Mengambil status koneksi tenant (CONNECTED, SCAN_QR, DISCONNECTED).
  - [x] Endpoint `POST /api/whatsapp/connect`: Menghasilkan QR code baru untuk di-scan oleh tenant di browser.
  - [x] Endpoint `POST /api/whatsapp/disconnect`: Memutus sesi dan menghapus file kredensial secara aman.
- [x] **2.3. Anti-Spam Queue & Rate Limiting**
  - [x] Implementasikan antrean pengiriman dengan delay acak (1.5 - 3 detik) antar pesan untuk mencegah ban dari Meta.
  - [x] Validasi nomor telepon penerima (format normalisasi nomor HP Indonesia: `08xx` -> `628xx`).
  - [x] Validasi kuota pesan bulanan tenant (`monthlyQuota` vs `usedThisMonth`).

---

## 📋 FASE 3: Template Engine & Kustomisasi Klien
- [x] **3.1. CRUD Master Template per Tenant**
  - [x] Endpoint `GET /api/whatsapp/templates`: Mengambil daftar template milik tenant aktif.
  - [x] Endpoint `PUT /api/whatsapp/templates/:triggerKey`: Mengubah redaksi pesan, title, dan status aktif/non-aktif template.
  - [x] Endpoint `POST /api/whatsapp/templates/reset`: Mengembalikan template ke redaksi default sesuai vertikal toko.
- [x] **3.2. Variable Interpolation Engine**
  - [x] Buat helper parser string untuk mengganti variabel `{variable}` dengan nilai riil dari objek transaksi:
    - `{storeName}`, `{customerName}`, `{orderNumber}`, `{totalAmount}`, `{invoiceUrl}`, dll.
- [x] **3.3. Template Seeder per Vertikal Bisnis**
  - [x] Template Default Kafe: Struk Digital Nota, Konfirmasi Reservasi Meja, Poin Member.
  - [x] Template Default Bengkel: SPK Dibuat, Unit Selesai, Pengingat Ganti Oli Berkala.
  - [x] Template Default Retail: Nota Belanja, Pengingat Piutang Bon Tempo.
  - [x] Template Default Laundry: Nota Cucian Masuk, Cucian Selesai di Rak Simpan.

---

## 📋 FASE 4: Integrasi Trigger Otomatis Antar-Modul
- [x] **4.1. Trigger Kafe (F&B)**
  - [x] Sambungkan kasir `POST /api/orders` (status Paid) untuk mengirim e-receipt jika nomor HP pelanggan terisi dan switch aktif.
  - [x] Sambungkan kasir `PATCH /api/orders/:id/payment` (saat order dibayar lunas) untuk mengirim e-receipt otomatis.
  - [x] Sambungkan `POST /api/reservations` untuk mengirim konfirmasi booking meja.
- [x] **4.2. Trigger Bengkel**
  - [x] Sambungkan `POST /api/bengkel/work-orders` via `WANotifService` & `WhatsAppTriggerService` untuk mengirim notifikasi estimasi SPK.
  - [x] Sambungkan unit selesai (Status DONE) untuk mengirim notifikasi unit siap diambil.
- [x] **4.3. Trigger Retail & Laundry**
  - [x] Sambungkan kasir laundry via `WANotifService` untuk notif drop-off cucian dan notif cucian siap diambil.
  - [x] Sambungkan fallback ke Fonnte jika Baileys belum terhubung.

---

## 📋 FASE 5: Keselarasan Migrasi MVP (Vertical Transition Resilience)
- [x] **5.1. Proteksi Sesi saat Migrasi MVP**
  - [x] Di endpoint `POST /api/settings/business-type-migration`, pastikan baris `TenantWhatsAppConfig` **TIDAK DIHAPUS**.
  - [x] Pastikan folder sesi `/storage/whatsapp_sessions/{tenantId}/` tetap utuh tanpa terputus.
- [x] **5.2. Otomatisasi Adaptasi Template (Template Adapter)**
  - [x] Saat tenant bermigrasi dari `CAFE` ke `BENGKEL`, otomatis seed template default bengkel via `whatsAppTemplateService.seedDefaultTemplates`.
  - [x] Pertahankan riwayat kontak pelanggan (`Customer`) agar basis database CRM tetap bisa digunakan di bisnis baru.
- [x] **5.3. Backup & Reset Simetris**
  - [x] Sertakan konfigurasi WhatsApp (`TenantWhatsAppConfig`, `WhatsAppTemplate`, `WhatsAppLog`) pada ekspor backup JSON (`/api/database/backup`).

---

## 📋 FASE 6: Antarmuka Pengguna (Frontend Back-Office)
- [x] **6.1. Halaman Pengaturan WhatsApp (`/settings` -> Tab WhatsApp Gateway)**
  - [x] Indikator status koneksi (Terhubung / Scan QR / Belum Terhubung).
  - [x] Komponen Scan QR Modal dengan auto-polling status.
  - [x] Kartu Kuota Pesan Bulanan (Terpakai / Sisa Kuota) dengan progress bar visual.
- [x] **6.2. Editor Template Pesan Interaktif**
  - [x] Daftar kartu template per event trigger sesuai vertikal aktif.
  - [x] Input Textarea dengan badge tombol variabel cepat (klik untuk menyisipkan variabel).
  - [x] Layar Pratinjau Pesan Chat WhatsApp (*Interactive Live Phone Mockup Preview*).
  - [x] Tombol "Kirim Pesan Uji Coba" (*Test Send Message*).
- [x] **6.3. Riwayat Pesan & Log Audit CRM**
  - [x] Tabel log pesan terkirim (Waktu, Penerima, Jenis Pesan, Status Terkirim/Gagal, Pesan Error).
  - [x] Terintegrasi di tab Pengaturan Sistem & tab CRM View.
