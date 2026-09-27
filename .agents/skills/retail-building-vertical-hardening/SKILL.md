---
name: retail-building-vertical-hardening
description: >
  Standar arsitektur, isolasi data multi-tenant, dan panduan pengembangan
  vertikal Ritel, Toko Grosir, dan Toko Bangunan (Material) di CodePOS.
  Mencakup: Multi-Satuan Bertingkat (UOM Conversion), Tiered/Wholesale Pricing
  (Ecer vs Grosir vs Kontraktor), UX Kasir Cepat Barcode & Keyboard-First,
  Manajemen Surat Jalan (Delivery Order) & Armada Pengiriman, Plafon Kredit
  Bon Kontraktor (AR Ledger), Lokasi Rak/Gudang, serta adaptasi kamus
  terminologi dan laporan finansial per vertikal.
---

# Panduan Vertikal: Toko Grosir & Toko Bangunan (Material)

## 1. Latar Belakang & Karakteristik Unik Bisnis

Toko Grosir (FMCG/Sembako) dan Toko Bangunan (Material) memiliki alur operasional dan kebutuhan UX yang sangat kontras dengan Kafe (F&B) maupun Bengkel Otomotif:

| Karakteristik | Kafe (F&B) | Bengkel Otomotif | Toko Grosir / Toko Bangunan |
|---|---|---|---|
| **Intensitas Kasir** | Sentuh layar santai, visual foto menu | Form SPK, no. polisi, keluhan | **Kasir kilat, Barcode laser, Keyboard-First (tanpa mouse)** |
| **Satuan Barang** | Single UOM (Porsi / Cup / Pack) | Single UOM (Pcs / Botol / Liter) | **Multi-Satuan Bertingkat (Sak, Truk, Dus, Biji, Meter, Kg)** |
| **Struktur Harga** | Harga tetap / Promo katalog | 3-Tier bengkel (Umum/Bengkel/Grosir) | **Harga Volume/Grosir Bertingkat & Harga Kontraktor/Langganan** |
| **Penyerahan Barang** | Langsung dimeja / take-away | Terpasang langsung di kendaraan | **Sebagian dibawa kasir, sebagian dikirim via Armada (Pick-up/Truk)** |
| **Sistem Pembayaran** | Tunai / QRIS / EDC seketika | Tunai / Transfer saat motor selesai | **Campuran: Tunai langsung & Piutang Bon Proyek (Net-14 / Net-30)** |
| **Dokumen Fisik** | Struk thermal 58/80mm, Tiket dapur | SPK Servis & Invoice A4 rincian jasa | **Faktur Nota Penjualan & Surat Jalan (Delivery Order) rangkap** |

---

## 2. Prinsip Arsitektur: Reusability & Zero Spaghetti

### Aturan #1: Jangan Buat Mesin Kasir / Inventori Baru dari Nol
Manfaatkan Core Engine CodePOS yang sudah teruji:
- **Inventory Engine**: Stok tetap dipotong pada satuan terkecil (*Base Unit*).
- **Checkout & Cart Engine**: Kalkulasi PPN, diskon bertingkat, dan split-payment.
- **Supplier & Procurement Engine**: Modul faktur pembelian tempo (Net-30) yang dibuat untuk Bengkel langsung digunakan untuk pembelian semen/besi dari distributor.
- **Customer Debt Ledger**: Pembukuan piutang tempo digunakan untuk Bon Proyek Mandor/Kontraktor.

### Aturan #2: Gunakan Capability Flags (Bukan `if retail` bercabang-cabang)
Gunakan pendekatan matrix kapabilitas di `VerticalContext`:
```typescript
export const CAPABILITIES = {
  hasMultiUom: true,           // Konversi satuan bertingkat (Dus -> Pcs, Truk -> Sak)
  hasWholesalePricing: true,   // Harga grosir otomatis sesuai kuantitas
  hasDeliveryOrder: true,       // Surat jalan dan status armada pengiriman
  hasCreditLimit: true,         // Plafon maksimal piutang bon kontraktor
  hasItemLocation: true,        // Label lokasi rak / lorong gudang
  barcodeFirstUX: true,         // Fokus input barcode scanner & shortcut keyboard
  hasDiningTables: false,       // Nonaktifkan meja kafe
  hasVehicles: false,           // Nonaktifkan nopol kendaraan & mekanik
};
```

---

## 3. Desain Skema Database & Relasi (Prisma)

### A. Multi-Satuan Bertingkat (Product UOM Conversion)
Satu produk memiliki 1 satuan dasar (*Base Unit*) untuk pencatatan stok fisik, dan banyak satuan jual (*Sales UOM*):
```prisma
model ProductUOM {
  id              String   @id @default(cuid())
  tenantId        String
  productId       String
  unitName        String   // "DUS", "SAK", "TRUK", "LUSIN", "BATANG"
  conversionRatio Decimal  // Pengali ke base unit (misal 1 DUS = 24 PCS -> ratio = 24)
  barcode         String?  // Barcode khusus untuk kemasan dus/karton
  priceSell       Decimal  // Harga jual untuk satuan ini
  isDefaultSale   Boolean  @default(false)
  createdAt       DateTime @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([tenantId, productId, unitName])
  @@index([tenantId, barcode])
}
```

### B. Tiered / Wholesale Pricing (Harga Bertingkat Berdasarkan Volume)
Harga otomatis turun jika pembeli mengambil kuantitas banyak:
```prisma
model ProductPriceTier {
  id         String   @id @default(cuid())
  tenantId   String
  productId  String
  minQty     Int      // Contoh: Beli >= 10 sak
  tierName   String   // "Eceran", "Grosir Kecil", "Grosir Partai / Kontraktor"
  unitPrice  Decimal  // Harga khusus per unit
  customerCategory String? // null = umum, "KONTRAKTOR", "TOKO_CABANG"

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([tenantId, productId])
}
```

### C. Manajemen Surat Jalan (Delivery Order / DO) & Armada
Pemisahan antara transaksi kasir dengan realisasi pengiriman barang fisik:
```prisma
model DeliveryOrder {
  id            String         @id @default(cuid())
  tenantId      String
  doNumber      String         // DO-202610-0001
  orderId       String
  driverName    String?        // Nama sopir / helper
  vehiclePlate  String?        // Plat armada pick-up/truk
  shippingAddress String
  status        DeliveryStatus @default(PENDING) // PENDING, LOADING, IN_TRANSIT, DELIVERED, CANCELLED
  recipientName String?        // Yang menerima di lokasi proyek
  deliveredAt   DateTime?
  notes         String?
  items         DeliveryOrderItem[]

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order  Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([tenantId, status])
}

model DeliveryOrderItem {
  id              String        @id @default(cuid())
  deliveryOrderId String
  orderItemId     String
  qtyShipped      Decimal
  unitName        String        // "SAK", "TRUK", "BATANG"

  deliveryOrder DeliveryOrder @relation(fields: [deliveryOrderId], references: [id], onDelete: Cascade)
}

enum DeliveryStatus {
  PENDING
  LOADING
  IN_TRANSIT
  DELIVERED
  CANCELLED
}
```

### D. Plafon Piutang Kontraktor (Credit Limit Enforcement)
Pada model `Customer`:
- `creditLimit`: Batas nominal bon (misal: Rp 20.000.000).
- `currentDebt`: Total tagihan piutang aktif yang belum lunas.
- `isCreditBlocked`: Status blokir otomatis jika sudah melewati limit atau menunggak > 30 hari.

---

## 4. Standar UX Kasir Cepat (Keyboard-First POS)

Kasir grosir & toko bangunan mengutamakan kecepatan entri tanpa perlu meraih mouse:

### A. Peta Shortcut Keyboard Standar
| Tombol | Fungsi | Deskripsi |
|---|---|---|
| `F1` | **Fokus Scan / Cari** | Kursor langsung melompat ke input barcode/nama barang |
| `F2` | **Ganti Satuan (UOM)** | Membuka dropdown cepat satuan (Biji ➔ Dus ➔ Truk) |
| `F3` | **Pilih Pelanggan** | Cari nama kontraktor/toko untuk memuat harga khusus & bon |
| `F4` | **Tahan / Pending Nota** | Parkir transaksi berjalan jika pembeli masih menambah semen |
| `F8` | **Centang Opsi Kirim (DO)** | Membuka form alamat proyek & pilihan armada pengiriman |
| `F9` | **Bayar Tunai Pas** | Checkout instan tanpa popup nominal kembalian |
| `F10` | **Modal Pembayaran Lengkap** | Buka pilihan DP, Cicilan, Bon Tempo, Transfer, atau EDC |
| `Enter` | **Cetak & Transaksi Baru** | Cetak faktur + surat jalan, siap scan transaksi berikutnya |

### B. Tampilan Keranjang (Data-Grid Kompak)
- Tidak menggunakan kartu/foto makanan besar yang menghabiskan layar.
- Menggunakan tabel padat (*dense data grid*) yang menampilkan:
  - `Kode / Barcode`
  - `Nama Barang + Lokasi Rak (misal: Rak B-04 / Los Barat)`
  - `Satuan (Pcs/Dus)`
  - `Qty`
  - `Harga Satuan`
  - `Diskon`
  - `Subtotal`

---

## 5. Kamus Terminologi (Label Adaptation)

Pastikan label di seluruh antarmuka beradaptasi secara otomatis ketika tenant bertipe Ritel/Grosir/Bangunan:

| Kode Token | Kafe (F&B) | Bengkel Otomotif | Toko Bangunan / Grosir |
|---|---|---|---|
| `catalog_title` | Daftar Menu | Katalog Sparepart & Jasa | Katalog Barang & Material |
| `item_label` | Menu / Hidangan | Sparepart / Suku Cadang | Produk / Material |
| `unit_label` | Porsi / Cup | Pcs / Liter | Satuan (Sak, Dus, Pcs, Truk) |
| `worker_label` | Barista / Koki | Mekanik / Teknisi | Helper / Sales / Sopir Armada |
| `transaction_doc` | Bill / Struk Meja | Estimasi / SPK Servis | Faktur Penjualan / Nota Bon |
| `delivery_doc` | Tiket Pesanan Dapur | Memo Perbaikan Mesin | Surat Jalan (Delivery Order) |
| `debt_label` | Piutang Event / Katering | Piutang Servis Armada | Piutang Bon Proyek / Kontraktor |
| `location_label` | Meja / Lantai | Stall / Pit Servis | Rak / Los Gudang |

---

## 6. Laporan Khusus Vertikal Ritel / Bangunan

Laporan umum (Omzet Kas, Laba Rugi, Rekap Pajak) tetap memakai modul shared CodePOS. Tambahkan tab analitik khusus untuk vertikal ini:

1. **Laporan Aging Piutang Bon Kontraktor (AR Aging Report)**:
   - Pengelompokan umur hutang pelanggan: *0-14 Hari*, *15-30 Hari*, *31-60 Hari*, dan *> 60 Hari (Macet)*.
   - Tombol kirim rekapan rincian nota bon langsung ke WhatsApp kontraktor/mandor.
2. **Laporan Performa Pengiriman Armada**:
   - Total DO yang terkirim per sopir/armada pick-up.
   - Pelacakan barang yang masih dalam status *IN_TRANSIT*.
3. **Laporan Barang Slow Moving vs Dead Stock**:
   - Material yang memakan tempat gudang tetapi tidak bergerak > 90 hari (misal: varian cat tertentu atau keramik tipe lama).

---

## 7. Struktur Direktori Rekomendasi

Letakkan seluruh komponen UX spesifik pada foldernya sendiri:
```
frontend/src/verticals/retail/
├── RetailCashierView.tsx        <- Layar kasir cepat keyboard-first
├── RetailCartTable.tsx          <- Tabel belanja padat dengan pemilih UOM
├── RetailCustomerPicker.tsx     <- Picker pelanggan dengan info limit kredit & sisa bon
├── RetailDeliveryModal.tsx      <- Input alamat kirim, sopir & surat jalan
├── RetailProductUomManager.tsx  <- Modal kelola konversi satuan & harga grosir
└── print/
    ├── DeliveryOrderPdfA4.tsx   <- Template Surat Jalan resmi tanda tangan penerima
    └── RetailInvoiceA4.tsx      <- Faktur tagihan tempo / nota lunas
```

---

## 8. Checklist Validasi & Quality Assurance

Sebelum merilis fitur vertikal Ritel / Bangunan ke produksi:
- [ ] **Multi-Tenant Scoping**: Pastikan semua query `ProductUOM` dan `DeliveryOrder` wajib menyertakan filter `tenantId`.
- [ ] **Stok Terpotong Tepat**: Penjualan 2 DUS (konversi 1 DUS = 24 PCS) harus memotong stok di database tepat 48 PCS.
- [ ] **Pencegahan Bon Melebihi Plafon**: Jika sisa limit kontraktor Rp 1.000.000, transaksi bon Rp 1.500.000 wajib meminta otorisasi PIN Owner atau ditolak sistem.
- [ ] **Bebas Istilah Kafe/Bengkel**: Pastikan tidak ada kata "Meja", "Dapur", "Nopol", atau "Mekanik" yang bocor di layar kasir, struk cetak, maupun laporan ritel.
- [ ] **Barcode Scanner Resilient**: Scanner USB barcode yang menembakkan karakter cepat + `Enter` tidak boleh menyebabkan halaman refresh atau submit form ganda (*double checkout prevention*).
