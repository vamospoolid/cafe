# Master Todo: Background Queue (BullMQ) untuk PDF, Offline Sync & WhatsApp (P1 High Impact)

Dokumen eksekusi step-by-step implementasi sistem antrean latar belakang (*background job queue*) menggunakan **BullMQ** di atas Redis untuk mengisolasi beban kerja berat, mencegah request blocking / timeout HTTP 504, dan menjaga performa instan kasir POS di jam sibuk.

---

## 🎯 Prinsip & Standar Keamanan Sistem
1. **Zero Client Disruption & Tenant Independence**: Setiap antrean wajib menyertakan `tenantId`. Eksekusi job dan notifikasi Socket.IO terisolasi 100% per tenant tanpa interferensi antar-tenant.
2. **Graceful In-Memory Fallback**: Jika server Redis offline (misal saat development lokal di Windows), sistem otomatis mengeksekusi job via *in-memory asynchronous runner* tanpa melempar crash.
3. **Non-Breaking API Compatibility**: Endpoint sinkron eksisting (`POST /api/orders/sync`) tetap dipertahankan untuk backward compatibility, sementara endpoint antrean baru (`POST /api/orders/sync-queue`) disediakan untuk pemrosesan batch bervolume tinggi.
4. **Idempotency & Anti-Duplication**: Job ID pada antrean sinkronisasi offline menggunakan `offlineId` transaksi, menjamin transaksi tidak pernah diproses ganda.

---

## 📋 Checklist Eksekusi Step-by-Step

### 📦 FASE 1: Dependensi & Infrastruktur Queue Core (COMPLETED ✅)
- [x] **1.1** Instalasi dependensi `bullmq` di `backend/package.json`.
- [x] **1.2** Buat `backend/src/queues/queueManager.ts`:
  - Mengelola inisialisasi instance `Queue` dan `Worker` BullMQ menggunakan konfigurasi koneksi Redis dari `src/lib/redis.ts`.
  - Mekanisme **Graceful Fallback**: Jika Redis tidak aktif, antrean beralih ke *in-memory immediate runner* (`setImmediate`).
  - Graceful shutdown: Menutup worker dan queue dengan aman saat server shutdown.

---

### 🔄 FASE 2: Offline Batch Sync Queue (`sync-queue`) (COMPLETED ✅)
- [x] **2.1** Buat produser antrean `backend/src/queues/syncQueue.ts`:
  - Fungsi `enqueueOfflineOrdersBatch(tenantId, outletId, userId, orders)`.
  - Deduplikasi: Gunakan `jobId = ord.offlineId`.
- [x] **2.2** Buat konsumen/worker `backend/src/workers/syncWorker.ts`:
  - Memproses setiap order secara atomik: potong stok bahan baku, rekap mutasi kas laci, create order.
  - Memancarkan event Socket.IO `sync:progress` (`completed`, `total`, `percent`) ke tenant yang bersangkutan.
  - Memancarkan event Socket.IO `sync:completed` saat seluruh antrean selesai.
- [x] **2.3** Buat endpoint API `POST /api/orders/sync-queue` di `backend/src/routes/orders.ts`.

---

### 📱 FASE 3: WhatsApp E-Receipt & Notification Queue (`wa-queue`) (COMPLETED ✅)
- [x] **3.1** Buat produser antrean `backend/src/queues/waQueue.ts`:
  - Fungsi `enqueueWhatsAppMessage(tenantId, phone, content, messageType, recipientName, metadata)`.
  - Normalisasi otomatis nomor telepon (08xx -> 628xx).
- [x] **3.2** Buat konsumen/worker `backend/src/workers/waWorker.ts`:
  - Rate limiting bawaan BullMQ: Maksimal 1 pesan per 1.5 detik per gateway (mencegah blokir nomor / anti-ban).
  - Retry policy: 3 percobaan dengan exponential backoff (5s, 10s, 20s).
  - Logging kegagalan ke tabel `AuditLog` dengan tingkat keparahan `WARNING` dan event `wa:delivery_failed`.
- [x] **3.3** Integrasikan pemanggilan antrean WA pada endpoint `POST /api/printer/send-whatsapp`.

---

### 📄 FASE 4: Heavy Reports & PDF Export Queue (`report-queue`) (COMPLETED ✅)
- [x] **4.1** Buat produser antrean `backend/src/queues/reportQueue.ts`:
  - Fungsi `enqueueReportGeneration(data)`.
- [x] **4.2** Buat konsumen/worker `backend/src/workers/reportWorker.ts`:
  - Melakukan agregasi data besar di background thread tanpa memblokir Express Event Loop.
  - Menghasilkan file laporan penjualan/keuangan dan menyimpannya di direktori aman `/uploads/reports/temp/:tenantId/`.
  - Mengirim event Socket.IO `report:ready` ke user peminta berisi tautan unduh laporan.
- [x] **4.3** Buat endpoint API `POST /api/analytics/queue-export` dan `GET /api/analytics/download-report/:tenantId/:filename` dengan zero-IDOR multi-tenant path protection.

---

### 🧪 FASE 5: Pengujian, Validasi & Observabilitas (COMPLETED ✅)
- [x] **5.1** Buat skrip automated test `backend/scripts/test_bullmq_queues.js`:
  - Uji enqueue & dequeue `sync-queue` dengan order offline mock (15 passed, 0 failed).
  - Uji dedup `offlineId` (job ID otomatis menyertakan offlineId).
  - Uji `wa-queue` dengan normalisasi nomor telepon dan rate-limiting.
  - Uji isolasi tenant: Tenant A dan Tenant B strictly scoped.
  - Uji graceful fallback saat Redis offline.
- [x] **5.2** Update endpoint `/api/health/deep` untuk menyertakan metrik status antrean:
  - Jumlah job aktif, waiting, dan failed per antrean terlaporkan secara real-time.
- [x] **5.3** Uji kompilasi TypeScript (`npx tsc --noEmit`) dan build backend (`npm run build`) -> 0 errors.
- [x] **5.4** Jalankan regression test Phase 10 IDOR untuk menjamin zero regression (6 passed, 0 failed).
