# Codenusa SaaS POS - Offline-First & Local Sync Master TODO

## 🎯 Objektif & Standar Sistem
1. **Zero Downtime POS**: Kasir dapat membuat transaksi, memilih meja, menerapkan diskon, dan mencetak struk thermal meskipun koneksi internet terputus total.
2. **Resilient Staff PWA**: Staf tetap dapat melakukan presensi (Clock-In/Out) dengan foto selfie dan GPS tersimpan di IndexedDB saat offline.
3. **Idempotent Cloud Sync**: Saat internet pulih, antrean transaksi dan absensi diunggah ke backend PostgreSQL tanpa ada data duplikat atau bentrok (anti-duplicate).
4. **Android APK Ready**: Konfigurasi Capacitor sehingga seluruh aset web terbundel lokal di dalam file APK tablet Android.

---

## 📋 Breakdown Task & Checklist

### 📦 PHASE 1: IndexedDB Local Database & Storage Architecture (COMPLETED ✅)
- [x] **1.1** Pasang library IndexedDB wrapper yang tangguh dan ringan (`dexie`) di frontend.
- [x] **1.2** Buat modul database lokal `frontend/src/db/offlineDb.ts`:
  - Table `cachedProducts`: Menyimpan katalog menu, varian, modifier, stok lokal, dan gambar base64/URL.
  - Table `cachedCategories`: Menyimpan kategori produk.
  - Table `cachedTables`: Menyimpan daftar meja dine-in.
  - Table `cachedSettings`: Menyimpan profil toko, info struk, dan opsi hardware.
  - Table `pendingOrders`: Antrean transaksi offline kasir (`offlineId`, `cartItems`, `paymentMethod`, `createdAt`, `syncStatus`).
  - Table `pendingAttendances`: Antrean absensi staf (`offlineId`, `userId`, `type`, `photoBase64`, `latitude`, `longitude`, `createdAt`).
  - Table `syncLogs`: Riwayat log sinkronisasi dan status error/sukses.
- [x] **1.3** Buat background cache seeder (`frontend/src/utils/catalogCacheSeeder.ts`): Otomatis mendownload dan memperbarui katalog menu & kategori ke IndexedDB setiap kali aplikasi dibuka atau saat ada perubahan data.

---

### 🌐 PHASE 2: Reactive Network Monitoring & UI Indicator (COMPLETED ✅)
- [x] **2.1** Buat custom hook `frontend/src/hooks/useNetworkStatus.ts`:
  - Memonitor event `window.addEventListener('online')` dan `'offline'`.
  - Dilengkapi heartbeat ping ringan ke `/api/health` setiap 15–30 detik untuk mendeteksi *false online* (misal: terhubung ke WiFi cafe tapi internet mati/tidak ada paket data).
- [x] **2.2** Buat komponen visual indicator `frontend/src/components/NetworkStatusBanner.tsx`:
  - **🟢 Hijau:** "Online - Terhubung ke Cloud".
  - **🟡 Kuning:** "Mode Offline - X Transaksi Menunggu Sync".
  - **🔄 Biru:** "Sedang Menyinkronkan Data ke Cloud...".
  - Tombol aksi manual: *"Sync Sekarang"* dan *"Lihat Antrean"*.
- [x] **2.3** Buat modal antrean `frontend/src/components/OfflineQueueModal.tsx` yang menampilkan daftar transaksi lokal di tablet dan tombol coba kirim ulang.
- [x] **2.4** Integrasikan status banner ke Layout utama ([`Layout.tsx`](file:///c:/ADATA/codepos/frontend/src/components/Layout.tsx)), topbar actions, dan background catalog seeder.

---

### 🛒 PHASE 3: POS Offline Checkout & Local Receipt Printing (COMPLETED ✅)
- [x] **3.1** Modifikasi `POSView.tsx`:
  - Saat offline, katalog produk, kategori, dan meja langsung dibaca dari IndexedDB (`cachedProducts`, `cachedCategories`, `cachedTables`).
  - Saat kasir menekan tombol bayar:
    - Generate ID transaksi unik: `offlineId = "OFF-" + crypto.randomUUID()`.
    - Simpan order ke IndexedDB `pendingOrders` dengan status `PENDING`.
- [x] **3.2** Cetak Struk Offline:
  - Format data struk langsung dikirim ke printer Bluetooth Thermal / USB via ESC/POS Web Bluetooth / Browser Print modal tanpa menunggu respon dari server cloud.
- [x] **3.3** Modal Antrean Transaksi Offline (`OfflineQueueModal.tsx`):
  - Kasir dan manager dapat melihat daftar transaksi offline yang tersimpan di tablet, total rupiah lokal, dan tombol re-try sync per transaksi.

---

### 📸 PHASE 4: Staff PWA Offline Attendance & Photo Compression (COMPLETED ✅)
- [x] **4.1** Buat utilitas kompresi foto selfie `frontend/src/utils/imageCompressor.ts` (mengompres foto dari ~3MB menjadi <70KB JPEG menggunakan HTML5 Canvas).
- [x] **4.2** Modifikasi `StaffPWAView.tsx`:
  - Siklus Hidup Kamera On-Demand: Kamera **100% MATI** saat staf sedang bertugas (menghemat baterai, memori & menjaga privasi).
  - Kamera hanya aktif saat user menekan *"Buka Kamera"* untuk verifikasi masuk atau verifikasi pulang, dan langsung mati kembali setelah foto terjepret.
  - Simpan absensi ke IndexedDB `pendingAttendances` saat offline lengkap dengan koordinat GPS dan `clientTimestamp`.

---

### ⚙️ PHASE 5: Backend Idempotent Sync Endpoints (COMPLETED ✅)
- [x] **5.1** Endpoint Batch Sync Order (`backend/src/routes/orders.ts`):
  - Tambahkan `POST /api/orders/sync-offline`:
    - Menerima array `orders: []`.
    - Menggunakan Prisma `$transaction` atomic:
      - Validasi `offlineId`: Cek apakah `offlineId` sudah pernah masuk (`where: { tenantId, offlineId }`). Jika sudah ada, lewati (anti-duplicate).
      - Buat baris `Order` dan `OrderItem` dengan timestamp asli dari tablet (`createdAt = clientTimestamp`).
      - Kurangi stok bahan baku / produk (soft deduction).
      - Catat `CashFlow` & audit trail log.
- [x] **5.2** Endpoint Batch Sync Absensi (`backend/src/routes/attendance.ts`):
  - Tambahkan `POST /api/attendance/sync-offline`:
    - Menerima array `attendances: []`.
    - Simpan baris `Attendance` dengan jam kehadiran aktual (`clockIn = clientTimestamp`, `clockOut = clientTimestamp`) dan koordinat GPS.

---

### 🔄 PHASE 6: Background Sync Engine & Conflict Resolution (COMPLETED ✅)
- [x] **6.1** Buat service `frontend/src/services/syncEngine.ts`:
  - Mendengarkan status koneksi dan mengunggah antrean offline secara otomatis.
  - Memproses batch `POST /api/orders/sync-offline` & `POST /api/attendance/sync-offline`.
  - Memperbarui status item di IndexedDB menjadi `SYNCED` dan membersihkan riwayat lama.
  - Menampilkan toast feedback real-time saat data berhasil disinkronkan ke cloud.
- [x] **6.2** Integrasikan auto-sync trigger saat koneksi online pulih pada `useNetworkStatus.ts`.
- [x] **6.3** Tambahkan tombol manual *"Sync Sekarang"* dan retry logic di `NetworkStatusBanner.tsx` dan `OfflineQueueModal.tsx`.
- [x] **6.4** Catat riwayat proses sinkronisasi ke tabel `syncLogs` di IndexedDB.

---

### 📱 PHASE 7: Android APK (Capacitor) Packaging Configuration
- [x] **7.1** Konfigurasi `@capacitor/core` dan `@capacitor/cli` pada project root / frontend.
- [x] **7.2** Buat file `capacitor.config.ts`:
  - `appId: 'com.codenusa.poscafe'`
  - `appName: 'Codenusa POS & Cafe'`
  - `webDir: 'dist'`
- [x] **7.3** Tambahkan scripts di `frontend/package.json`:
  - `"build:apk"`: `npm run build && npx cap sync android`
  - `"cap:sync"`: `npx cap sync`
  - `"cap:open"`: `npx cap open android`
- [x] **7.4** Dokumentasi panduan instalasi APK pada tablet Android kasir (`docs/apk-build-guide.md`).
