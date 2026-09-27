# Master Todo List: Pengerasan Multi-Tenant & Konkurensi POS (Multi-Tenant Hardening)

Dokumen pelacak pekerjaan dan hasil audit teknis untuk menangani potensi **miss-logic, kebocoran data, benturan transaksi (race condition), overselling stok, dan kehabisan connection pool database** saat melayani **10+ unit kafe secara bersamaan pada jam sibuk (peak hours)**.

---

## 🔍 Ringkasan Hasil Audit Konkurensi 10 Kafe (Temuan Miss-Logic & Bottleneck)

Berdasarkan inspeksi langsung terhadap file controller, router, dan skema database, ditemukan beberapa celah konkurensi krusial yang dapat memicu error/crash pada kondisi 10 kafe sibuk:

1. **⚠️ Connection Pool Starvation (Kehabisan Pool Koneksi DB)**:
   - File `backend/src/db.ts` dan `DATABASE_URL` belum mendefinisikan `connection_limit` eksplisit (Prisma default hanya 5–10 koneksi).
   - 10 kafe × 3-5 terminal kasir/KDS/QR self-order = 30-50 request bersamaan. Server berisiko melempar error: `PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool`.
2. **⚠️ Race Condition Unique Order Number**:
   - `generateOrderNumber` di `orders.ts` melakukan `findFirst` lalu `+1` di **luar** transaksi database.
   - Jika 2 kasir atau pelanggan self-order klik checkout di detik yang sama, keduanya menghasilkan nomor sama (misal `ORD-260920-001`). Satu transaksi akan gagal dengan error 500 (`Unique constraint failed on ("tenantId", "orderNumber")`).
3. **⚠️ Overselling Tanpa Atomic Stock Guard**:
   - Pengurangan stok produk dan bahan baku masih menggunakan `tx.product.update({ data: { stock: { decrement } } })`.
   - Tanpa klausa proteksi `WHERE stock >= qty`, jika stok tersisa 1 dan ada 2 transaksi bersamaan, stok akan tembus ke angka minus.
4. **⚠️ Benturan Shift Kasir (Shift Ambiguity)**:
   - Endpoint `GET /api/shifts/current` hanya memfilter `{ where: { status: 'Open', tenantId } }` tanpa memfilter `userId` kasir.
   - Jika satu kafe memiliki 2 kasir dengan laci berbeda, Kasir 2 akan tertimpa menggunakan shift Kasir 1. Tutup shift kasir 1 akan menutup shift kasir 2 secara sepihak.
5. **⚠️ Kebocoran Room Socket.IO (Default Room Fallback)**:
   - Di `backend/src/index.ts` baris 217, client yang terhubung tanpa handshake token secara default dimasukkan ke `'tenant-default-muki'`.
   - Tamu/client dari Kafe B yang reconnect tanpa token berpotensi mendengarkan notifikasi dapur/order Kafe A.
6. **⚠️ False-Positive Rate Limiting Kasir Jam Sibuk**:
   - `paymentLimiter` di `index.ts` membatasi 60 request per 15 menit berbasis IP (`req.ip`).
   - Pada jam makan siang (peak hours), kafe yang sibuk dengan 2 terminal kasir bisa dengan mudah melampaui 60 order dalam 15 menit, menyebabkan kasir terkena blokir HTTP 429!
7. **⚠️ Prisma Transaction Timeout (Default 5000ms)**:
   - Transaksi checkout yang memproses pembuatan order, pengurangan stok banyak item resep, pembuatan log bahan, dan kalkulasi poin loyalitas rentan timeout jika database sedang antre melayani 10 kafe.
8. **⚠️ Data Meja Legacy Bocor di Endpoint `/api/tables`**:
   - Endpoint `GET /api/tables` di `tables.ts` masih menggunakan `where: { OR: [{ tenantId }, { tenantId: null }] }`. Data meja lama tanpa tenantId bisa terbaca oleh kafe lain.

---

## 📋 Daftar Tugas Perbaikan & Pengerasan (Master Action Items)

### 🧱 Fase 1: Fondasi Basis Data & Connection Pooling (P0 - Server Stability)
- [x] **1.1** Buat `backend/src/db.ts` sebagai Singleton Prisma Client.
- [x] **1.2** Migrasi 35+ file route & service agar mengimpor dari `src/db.ts` dan menghapus instansiasi `new PrismaClient()` lokal.
- [x] **1.3** **[SELESAI ✅]** Konfigurasi Connection Pool Tuning untuk 10+ Kafe:
  - Update `DATABASE_URL` di `backend/.env` dengan parameter `&connection_limit=50&pool_timeout=20`.
  - Atur konfigurasi Prisma Client dengan logging error timeout yang jelas.

---

### 🛡️ Fase 2: Karantina Data Multi-Tenant & Keamanan Real-Time (P0 - Data Isolation)
- [x] **2.1** Filter `tenantId` pada endpoint orders (`orders.ts`).
- [x] **2.2** Perbaiki kalkulasi saldo pada Z-Report & X-Report agar terisolasi per tenant.
- [x] **2.3** Karantina modul `cashflow.ts`, `kds.ts`, `analytics.ts`, `reservations.ts`, `debts.ts`, `employeeLoans.ts`.
- [x] **2.4** **[SELESAI ✅]** Perbaiki kebocoran data meja di `tables.ts`:
  - Hapus klausa `{ tenantId: null }` pada query `findMany` di `backend/src/routes/tables.ts`.
- [x] **2.5** **[SELESAI ✅]** Perbaiki Socket.IO Default Fallback di `backend/src/index.ts`:
  - Hapus fallback default ke `'tenant-default-muki'`. Client tanpa token masuk ke room unauthenticated.
- [x] **2.6** **[SELESAI ✅]** Pisahkan Shift Aktif per Kasir (`userId`) di `backend/src/routes/shifts.ts`:
  - Ubah query `/current` dan `/active` agar menyertakan `userId` kasir yang sedang login.

---

### ⚡ Fase 3: Penanganan Konkurensi & Anti-Tabrakan Transaksi (P0 - Concurrency Safety)
- [x] **3.1** **[SELESAI ✅]** Atomic Order Number Generator (Thread-Safe):
  - Mekanisme auto-retry P2002 collision di dalam `prisma.$transaction` pada `POST /dinein` dan `POST /`.
  - Kasir tidak mendapat error 500 saat 2 order dibuat pada detik yang sama.
- [x] **3.2** **[SELESAI ✅]** Atomic Stock Guard (Anti-Overselling):
  - Menggunakan validasi atomik raw SQL `WHERE stock >= qty` pada produk dan bahan baku. Stok terproteksi dari angka minus.
- [x] **3.3** **[SELESAI ✅]** Perpanjang Timeout Prisma `$transaction`:
  - Opsi `{ maxWait: 10000, timeout: 20000 }` diterapkan pada `$transaction` checkout dan payment.
- [x] **3.4** **[SELESAI ✅]** Sinkronisasi Offline Multi-Device (`POST /api/orders/sync`):
  - Validasi duplikasi `offlineId` terisolasi per `tenantId`.
  - Dilengkapi Atomic Stock Guard raw SQL (`WHERE stock >= qty`), Auto-retry collision `P2002`, dan perpanjangan timeout transaksi `{ maxWait: 10000, timeout: 20000 }`.

---

### 🔧 Fase 4: Optimasi Operasional & Traffic Management (P1 - High Traffic)
- [x] **4.1** **[SELESAI ✅]** Penyesuaian Rate Limiter Transaksi Kasir:
  - Kasir login dengan header `Authorization` dikecualikan dari `paymentLimiter` agar tidak terblokir HTTP 429 di jam sibuk.
- [x] **4.2** Karantina Ganti Kasir Cepat (`/api/auth/switch-pin`) terisolasi ke keanggotaan tenant aktif.
- [x] **4.3** Geofencing GPS Absensi terikat ke `Settings` milik tenant karyawan.
- [x] **4.4** Karantina menu publik QR Dine-In per `tenantId`/`tenantSlug`.

---

### 🧪 Fase 5: Pengujian Konkurensi & Simulasi Beban
- [x] **5.1** Kompilasi TypeScript Backend (`npx tsc --noEmit`) -> 0 error.
- [x] **5.2** Kompilasi Bundle Frontend (`npm run build`) -> 0 error.
- [x] **5.3** Uji simulasi konkurensi checkout simultan (30 nomor order simultan unik 100% tanpa collision).
- [x] **5.4** Uji simulasi stok habis (Atomic Stock Guard: transaksi ke-2 ditolak dan stok tetap 0 tanpa tembus minus).
