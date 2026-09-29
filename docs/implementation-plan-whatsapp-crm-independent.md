# IMPLEMENTATION PLAN: INDEPENDENT MULTI-TENANT WHATSAPP CRM & MVP MIGRATION

## 1. Executive Summary & Visi Arsitektur

Fitur **WhatsApp CRM & Notifikasi Otomatis** di CodePOS SaaS dirancang sebagai **Modular Optional Add-On** yang berdiri 100% independen per tenant. 

Setiap tenant (klien) memiliki otoritas penuh untuk:
1. Menghubungkan nomor WhatsApp bisnisnya sendiri secara terisolasi (*Bring Your Own Number via Web QR Scan / Multi-Device Baileys*).
2. Mengatur dan mengkustomisasi redaksi pesan, header, footer, dan variabel dinamis sesuai identitas brand masing-masing.
3. Mengaktifkan/menonaktifkan pemicu notifikasi otomatis (*Event Triggers*) sesuai vertikal bisnis yang dijalankan.
4. Menjaga sesi koneksi dan basis data pelanggan tetap utuh dan aman saat melakukan transisi / migrasi jenis usaha antar-MVP (misal dari Kafe ke Bengkel).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               ARSITEKTUR INDEPENDENSI WHATSAPP MULTI-TENANT                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   [ Tenant A: Muki Ramen (Kafe) ]      [ Tenant B: Bengkel Motor Berkah ]       │
│        Session: /wa_sessions/tenant_A       Session: /wa_sessions/tenant_B      │
│        Nomor WA: 0812-XXXX (Kasir)          Nomor WA: 0857-XXXX (Admin Servis)  │
│        Templates: Struk & Meja              Templates: SPK & Reminder Oli       │
│                  │                                    │                         │
│                  ▼                                    ▼                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                 CODEPOS WHATSAPP WORKER MANAGER ENGINE                  │   │
│   │   - Multi-Session Isolation (Isolated RAM, Isolated Auth Keys, Safe DB) │   │
│   │   - Queue Worker & Rate Limiter (Cegah Banned Meta)                     │   │
│   │   - Multi-Tenant Fail-Closed Security & Quota Guard                     │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prinsip Arsitektur Utama

### A. Isolasi Sesi Multi-Tenant (Zero Cross-Contamination)
* Sesi autentikasi WhatsApp (`baileys` credentials) disimpan di direktori terisolasi: `backend/storage/whatsapp_sessions/{tenantId}/`.
* Pemutusan sesi, kegagalan jaringan, atau pemblokiran nomor pada Tenant A **DILARANG KERAS** mempengaruhi koneksi atau antrean pesan Tenant B.
* Setiap pengiriman pesan wajib mengikat `tenantId` pengirim dan divalidasi dengan status langganan/kuota Add-on tenant bersangkutan.

### B. Modular Optional Add-on (Feature-Gated)
* Modul WhatsApp dikontrol oleh `FeatureService` (`featureKey: 'crm_whatsapp'`).
* **Paket Starter**: Fitur non-aktif (dapat dibeli sebagai Add-On terpisah).
* **Paket Pro & Enterprise**: Fitur aktif dengan alokasi kuota bulanan.
* Jika Add-On tidak aktif, UI WhatsApp di Back-Office menampilkan halaman penawaran aktivasi (*Add-On Marketplace Showcase*) dan semua endpoint API menolak eksekusi dengan HTTP 403 `ADDON_INACTIVE`.

### C. Kustomisasi Bebas oleh Klien (Tenant-Controlled Templates)
* Klien bebas menyesuaikan redaksi pesan dengan variabel dinamis:
  * `{storeName}`, `{customerName}`, `{customerPhone}`
  * `{orderNumber}`, `{totalAmount}`, `{paymentMethod}`, `{invoiceUrl}`
  * `{tableNo}`, `{bookingDate}`, `{bookingTime}` (Khusus Kafe)
  * `{vehiclePlate}`, `{vehicleModel}`, `{mechanicName}`, `{workOrderNo}` (Khusus Bengkel)
  * `{shelfNumber}`, `{laundryWeight}`, `{perfumeVariant}` (Khusus Laundry)
  * `{deliveryOrderNo}`, `{driverName}`, `{dueDate}` (Khusus Retail/Bangunan)

### D. Keselarasan dengan Migrasi MVP (Zero Session Loss)
* Saat tenant bermigrasi antar vertikal (`businessType` berubah, misal `CAFE` ➔ `BENGKEL`):
  * **Sesi WhatsApp**: Tetap aktif dan terhubung (tidak perlu scan QR ulang).
  * **Kontak CRM**: Data pelanggan di tabel `Customer` tetap dipertahankan.
  * **Template Otomatis**: Sistem otomatis mengaktifkan template default vertikal tujuan dan mengarsipkan template vertikal lama.

---

## 3. Desain Skema Database (Prisma)

```prisma
// Konfigurasi Gateway WhatsApp per Tenant
model TenantWhatsAppConfig {
  id               String    @id @default(uuid())
  tenantId         String    @unique
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  status           String    @default("DISCONNECTED") // DISCONNECTED, SCAN_QR, CONNECTED, SUSPENDED
  phoneConnected   String?
  qrCode           String?   @db.Text
  isAddonActive    Boolean   @default(false)
  monthlyQuota     Int       @default(500)
  usedThisMonth    Int       @default(0)
  lastResetQuotaAt DateTime  @default(now())
  lastConnectedAt  DateTime?
  autoSendReceipt  Boolean   @default(true)
  autoSendReminder Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([tenantId])
}

// Master Template Pesan Kustom per Tenant & Vertikal
model WhatsAppTemplate {
  id           String    @id @default(uuid())
  tenantId     String
  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  vertical     String    // CAFE, BENGKEL, RETAIL, LAUNDRY, UNIVERSAL
  triggerKey   String    // RECEIPT, RESERVATION_CONFIRM, SPK_CREATED, SPK_DONE, OIL_REMINDER, LAUNDRY_READY, AR_DUE
  title        String
  templateBody String    @db.Text
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([tenantId, triggerKey])
  @@index([tenantId, vertical])
}

// Log & Audit Trail Pesan Terkirim
model WhatsAppLog {
  id             String    @id @default(uuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  recipientPhone String
  recipientName  String?
  triggerKey     String?
  messageBody    String    @db.Text
  status         String    @default("PENDING") // PENDING, SENT, FAILED
  errorMessage   String?
  referenceId    String?   // OrderNumber, WorkOrderNo, ReservationId
  sentAt         DateTime?
  createdAt      DateTime  @default(now())

  @@index([tenantId, createdAt])
  @@index([tenantId, status])
}
```

---

## 4. Rincian Pemicu Notifikasi (Trigger Matrix per Vertikal)

### Vertikal 1: Kafe & Resto (F&B)
1. **`RECEIPT` (Struk Pembayaran Digital)**:
   * Terkirim otomatis saat kasir menyelesaikan pembayaran (`status: Paid`).
   * Berisi ringkasan pesanan, subtotal, diskon, pajak, total bayar, dan link nota web.
2. **`RESERVATION_CONFIRM` (Konfirmasi Booking Meja)**:
   * Terkirim saat reservasi dengan DP berhasil dicatat.
   * Berisi nomor meja, tanggal & jam kedatangan, jumlah tamu, dan sisa tagihan.
3. **`LOYALTY_POINT` (Pemberitahuan Poin Member)**:
   * Terkirim saat pelanggan mendapatkan poin baru atau menukarkan poin reward.

### Vertikal 2: Bengkel Motor & Mobil
1. **`SPK_CREATED` (Penerimaan Kendaraan & Estimasi)**:
   * Terkirim saat mekanik/SA membuat SPK baru.
   * Berisi nomor polisi, keluhan, estimasi pengerjaan, dan estimasi biaya awal.
2. **`SPK_PROGRESS` (Konfirmasi Penggantian Sparepart)**:
   * Terkirim jika saat dibongkar ditemukan kerusakan part tambahan dan membutuhkan persetujuan owner.
3. **`SPK_DONE` (Unit Selesai & Siap Diambil)**:
   * Terkirim saat status SPK diubah menjadi `Selesai`.
   * Berisi total faktur akhir, rincian jasa & sparepart, dan link invoice PDF resmi.
4. **`OIL_REMINDER` (Pengingat Servis / Ganti Oli Berkala)**:
   * Terjadwal otomatis (cron job) 3 bulan atau estimasi 3.000 km setelah tanggal pengerjaan servis terakhir.

### Vertikal 3: Retail, Toko Grosir & Bangunan
1. **`DELIVERY_ORDER` (Surat Jalan Armada Berangkat)**:
   * Terkirim saat sopir membawa muatan keluar dari gudang toko material/grosir.
2. **`AR_DUE` (Pengingat Piutang Jatuh Tempo)**:
   * Terkirim otomatis H-3 sebelum tanggal jatuh tempo bon tempo kontraktor.

### Vertikal 4: Laundry Kiloan & Satuan
1. **`LAUNDRY_RECEIVED` (Nota Drop-off Cucian Masuk)**:
   * Terkirim saat kasir menimbang cucian (berat kg, parfum dipilih, estimasi tgl selesai).
2. **`LAUNDRY_READY` (Cucian Bersih & Siap Diambil)**:
   * Terkirim saat cucian selesai disetrika dan disimpan di nomor rak tertentu.

---

## 5. Alur Migrasi MVP (Vertical Transition Integration)

Ketika tenant menggunakan wizard **Migrasi Vertikal** (`POST /api/tenant/vertical-migration`):
```
[User Memilih Migrasi: Kafe -> Bengkel]
                 │
                 ▼
[1. Validasi Autentikasi Owner & Password Guard]
                 │
                 ▼
[2. Kunci & Pertahankan TenantWhatsAppConfig]
   -> Session Baileys TIDAK DIPUTUSKAN.
   -> Nomor WA bisnis tetap terhubung.
                 │
                 ▼
[3. Adaptasi Template Otomatis (Template Adapter)]
   -> Template Kafe (RECEIPT, RESERVATION) di-set isActive: false
   -> Template Bengkel (SPK_CREATED, SPK_DONE, OIL_REMINDER) diinisialisasi
                 │
                 ▼
[4. Hubungkan Kontak CRM]
   -> Database Customer tetap utuh dengan nomor WA yang tersimpan.
                 │
                 ▼
[5. Logging Perubahan ke AuditLogger]
   -> Log dicatat: "Tenant migrated from CAFE to BENGKEL. WhatsApp CRM adapted."
```
