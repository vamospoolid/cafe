---
name: laundry-vertical-hardening
description: >
  Standar arsitektur, isolasi data multi-tenant, dan panduan pengembangan
  vertikal Jasa Laundry Kiloan & Satuan di CodePOS.
  Mencakup: Input Timbangan Desimal (Kg), Layanan Satuan, Tier Kecepatan SLA
  (Reguler/Kilat/Express), Pilihan Varian Parfum, Kanban Status Cucian,
  Manajemen Nomor Rak Simpan, Dual-Payment (Bayar di Muka vs Bayar Saat Ambil),
  Integrasi Notifikasi WhatsApp Otomatis, Dual-Core Inventory Bahan Baku (Deterjen/Parfum),
  Petty Cash Operasional Khusus Laundry, Eliminasi Kebocoran Istilah F&B/Bengkel,
  Laporan Finansial & Tonase, serta Apps Staff PWA Dinamis Laundry.
---

# Standar Arsitektur & Panduan Vertikal: Jasa Laundry Kiloan & Satuan

## 1. Latar Belakang & Karakteristik Unik Bisnis Laundry

Vertikal Jasa Laundry memiliki alur operasional, siklus transaksi, dan kebutuhan UX yang sangat kontras dengan Kafe (F&B), Bengkel Otomotif, maupun Toko Retail/Bangunan:

| Parameter Operasional | Kafe (F&B) | Bengkel Otomotif | Retail / Bangunan | **Laundry Kiloan & Satuan** |
| :--- | :--- | :--- | :--- | :--- |
| **Pemicu Transaksi** | Pesan menu makanan/minuman | SPK kendaraan masuk | Scan barcode kasir | **Drop-off pakaian/cucian kotor** |
| **Satuan Pengukuran** | Pcs / Porsi | Jasa flat + Suku Cadang | Multi-UOM (Dus, Sak, Pcs) | **Desimal Kg (Timbangan) & Satuan (Pcs/Meter)** |
| **Waktu Pembayaran** | Bayar langsung / Open bill | Bayar saat servis tuntas | Kasir tunai / Bon Tempo | **Dual-Mode: Bayar di Awal (Lunas) vs Bayar Saat Ambil** |
| **Siklus Pengerjaan** | Antrian Dapur $\to$ Saji | Antrian Pit $\to$ Servis | Bawa langsung / Surat Jalan | **Terima $\to$ Cuci $\to$ Kering $\to$ Setrika $\to$ Siap Ambil** |
| **Manajemen Lokasi** | Nomor Meja | Pit / Stall Servis | Nomor Rak Gudang | **Nomor Keranjang Masuk & Nomor Rak Simpan** |
| **Bahan Baku Operasional** | Daging, susu, sirup (`Ingredient`) | Oli, busi, kampas (`Product`) | Semen, beras (`Product`) | **Deterjen, softener, parfum, plastik (`Ingredient`)** |
| **Notifikasi Pelanggan** | Pager tamu / Panggil nama | WA estimasi & selesai servis | SMS / WA tagihan tempo | **WA Nota Diterima & "Cucian Siap Diambil di Rak"** |

---

## 2. Prinsip Arsitektur: Zero Domain Leakage & Reusability

### Aturan #1: Zero Domain Leakage (Eliminasi Istilah F&B & Bengkel)
* **DILARANG** menampilkan istilah seperti `Meja`, `Dapur`, `Barista`, `KDS`, `Resep Makanan`, `Nopol`, `Odometer`, `Mekanik`, atau `Surat Jalan` pada tenant bertipe `LAUNDRY`.
* Seluruh kamus antarmuka wajib mengacu pada terminologi laundry:
  * `Order` $\rightarrow$ **Nota Cuci**
  * `Table / Pit` $\rightarrow$ **Nomor Rak Simpan / Keranjang**
  * `Item / Product` $\rightarrow$ **Layanan Cuci (Kiloan / Satuan)**
  * `Customer` $\rightarrow$ **Pelanggan**
  * `Mechanic / Chef` $\rightarrow$ **Operator Cuci & Setrika**
  * `WIP / Kitchen` $\rightarrow$ **Ruang Cuci & Setrika (Status Board)**

### Aturan #2: Reusability Core Engine CodePOS
* **Dual-Core Inventory Engine:** Laundry menggunakan tabel `Ingredient` untuk bahan kimia & operasional (Deterjen literan, Softener, Parfum, Plastik jinjing, Gas LPG). Jangan membuat tabel inventori baru.
* **Customer & Debt Ledger Engine:** Modul piutang digunakan untuk mencatat cucian yang selesai/diambil namun belum lunas.
* **WhatsApp Notification Engine:** Mengadaptasi layanan WhatsApp service yang sudah matang di modul Bengkel dengan template pesan laundry.

---

## 3. Desain Model Data & Status Pipeline (Prisma)

### A. Siklus Transaksi: Model `LaundryOrder`
```prisma
model LaundryOrder {
  id              String        @id @default(uuid())
  tenantId        String
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  outletId        String?
  outlet          Outlet?       @relation(fields: [outletId], references: [id], onDelete: SetNull)

  orderNumber     String        // Auto-generated: "LD-202609-0001"
  customerId      Int?
  customer        Customer?     @relation(fields: [customerId], references: [id])
  customerName    String
  customerPhone   String?

  // Spesifikasi Order
  serviceCategory String        @default("KILOAN") // KILOAN | SATUAN | CAMPURAN
  serviceSpeed    String        @default("REGULAR") // REGULAR | KILAT_24H | EXPRESS_6H
  perfumeVariant  String?       // "Akasia", "Sakura", "Ocean Fresh", dll
  rackLocation    String?       // e.g. "Rak B-04", "Hanger H-02"
  itemCountNotes  String?       // e.g. "15 potong pakaian, 2 sprei"
  specialNotes    String?       // e.g. "Baju putih pisahkan, noda kerah"

  // State Machine Cucian
  status          String        @default("RECEIVED")
  // RECEIVED -> WASHING -> DRYING -> IRONING -> READY -> COMPLETED (or CANCELLED)

  // Finansial
  subtotal        Float         @default(0)
  speedSurcharge  Float         @default(0)
  discount        Float         @default(0)
  totalAmount     Float         @default(0)
  paidAmount      Float         @default(0)
  paymentStatus   String        @default("UNPAID") // UNPAID | PARTIAL | PAID
  paymentMethod   String?       // CASH | QRIS | TRANSFER

  // Operator Tracking (Komisi)
  washerUserId    Int?
  ironerUserId    Int?

  // Notifikasi WhatsApp
  notifReceivedSent Boolean     @default(false)
  notifReadySent    Boolean     @default(false)

  estimatedDoneAt DateTime?
  readyAt         DateTime?
  completedAt     DateTime?

  items           LaundryOrderItem[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([tenantId, orderNumber])
  @@index([tenantId, status])
  @@index([tenantId, paymentStatus])
}

model LaundryOrderItem {
  id             Int          @id @default(autoincrement())
  orderId        String
  order          LaundryOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  serviceName    String       // e.g. "Cuci Kering Setrika", "Bedcover King", "Jas Pria"
  unitType       String       // "KG" | "PCS" | "METER"
  qty            Float        // Mendukung desimal untuk kg (e.g. 3.45)
  pricePerUnit   Float
  subtotal       Float
  notes          String?
}
```

---

## 4. Standar Modul Kasir Drop-off & Pickup (POS)

1. **Input Timbangan Desimal Akurat:**
   * Field `qty` mendukung nilai pecahan desimal (contoh: `2.65` kg).
   * Nilai subtotal dihitung otomatis: `Math.round(qty * pricePerUnit)`.
2. **Pilihan SLA Cepat:**
   * Tombol radio: `Reguler (2 Hari)`, `Kilat (24 Jam)`, `Express (6 Jam)`.
   * Penambahan surcharge otomatis ke total nota.
3. **Pilihan Varian Parfum:**
   * Dropdown/chips aroma dari master settings tenant (`Akasia`, `Sakura`, `Downy`, `Snappy`, `Tanpa Parfum`).
4. **Alur Pembayaran Fleksibel (Dual-Payment Mode):**
   * `[Bayar Sekarang (Lunas)]`: Mencatat pemasukan di kasir/shift saat ini, `paymentStatus = "PAID"`.
   * `[Bayar Nanti Saat Ambil]`: Nota diterbitkan tanpa penerimaan uang, `paymentStatus = "UNPAID"`. Uang ditagih saat cucian diambil di kasir.
5. **Cetak Struk Thermal (58mm/80mm):**
   * Memuat: Nomor Nota, Nama & Kontak Pelanggan, Berat/Pcs, Varian Parfum, Estimasi Selesai, Status Bayar (LUNAS / BELUM LUNAS), dan Disclaimer Syarat & Ketentuan Laundry.

---

## 5. Arus Kas (Petty Cash) & Bahan Baku Laundry

### A. Kamus Pengeluaran Kas Kecil Laundry
Kategori Petty Cash pada tenant laundry dikunci pada:
* `Bahan Kimia & Sabun` (Beli deterjen curah, softener, parfum, penghilang noda).
* `Kemasan & Plastik` (Plastik kiloan, plastik bedcover, lakban, tag pin).
* `Operasional Listrik, Air & Gas` (Token listrik PLN, air tandon, isi ulang tabung gas LPG dryer).
* `Perawatan Mesin & Alat` (Servis mesin cuci, ganti v-belt, perbaikan setrika uap boiler).
* `Transportasi & Delivery` (Bensin motor kurir jemput-antar).
* `Gaji & Kasbon Operator` (Komisi setrika/cuci harian atau mingguan).

### B. Quick Preset Buttons:
* `[Isi Gas LPG Dryer]`
* `[Beli Token Listrik]`
* `[Beli Bensin Delivery]`
* `[Beli Plastik Jinjing]`

### C. Bahan Baku & Supplier
* Bahan Baku dicatat pada tabel `Ingredient` (Liter / Kg / Roll / Tabung).
* Modul Supplier digunakan untuk mendata distributor deterjen curah, supplier plastik, dan agen gas.

---

## 6. Apps Staff PWA Dinamis (Laundry Edition)

Pada rute `/staff`, antarmuka operator cuci & setrika disesuaikan secara dinamis:

### A. SOP Opening Checklist Laundry:
1. `Cek Ketersediaan Air Tandon & Tekanan Pompa Otomatis`
2. `Periksa Stok Deterjen Cair, Softener & Parfum Siap Pakai`
3. `Cek Saluran Pembuangan & Bersihkan Filter Serat Mesin Dryer`
4. `Periksa Tabung Gas Mesin Pengering & Regulator Aman`
5. `Hitung Kas Awal / Modal Uang Kembalian Kasir`
6. `Nyalakan Komputer POS, Timbangan & Printer Thermal`

### B. SOP Closing Checklist Laundry:
1. `Kuras & Bersihkan Kantong Filter Mesin Cuci & Pengering`
2. `Matikan Kran Air Utama & Cabut Selang Gas LPG Dryer`
3. `Pastikan Semua Cucian Bersih Sudah Berada di Rak Simpan`
4. `Rekonsiliasi Kas Laci Kasir & Tutup Shift Harian`
5. `Matikan Semua Mesin, Setrika Uap, Lampu & Kunci Outlet`

### C. Alur Operasional Staf:
* **Tab Siap Cuci:** Daftar keranjang masuk. Operator menekan `[Mulai Cuci]`.
* **Tab Siap Setrika:** Cucian kering menunggu setrika. Operator menekan `[Mulai Setrika]`.
* **Tab Packing & Masuk Rak:** Operator memasukkan nomor rak (contoh: `Rak B-04`) dan klik `[Selesai & Kirim Notif WA]`. Sistem langsung mengirimkan notifikasi ke pelanggan secara otomatis.
