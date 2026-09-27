# SaaS Architecture Breakdown & Master Todo List: Vertikal Laundry CodePOS

## 1. Landasan & Prinsip Arsitektur SaaS CodePOS

Pengembangan vertikal Laundry Kiloan & Satuan wajib berpegang teguh pada **6 Pilar Arsitektur Multi-Tenant & Multi-Outlet SaaS CodePOS** dengan prinsip utama: **"Core-Engine & Vertical Adapter Pattern" (Memaksimalkan modul yang sudah ada, tanpa merombak atau menulis ulang UX dasar)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   6 PILAR ARSITEKTUR SAAS CODEPOS                      │
├────────────────────────────────────────────────────────────────────────┤
│ PILAR 1: ISOLASI KETAT MULTI-TENANT & ZERO IDOR                        │
│ - Setiap kueri Prisma WAJIB memiliki `where: { tenantId }`.            │
│ - WebSocket real-time WAJIB menggunakan `emitToTenant(io, tenantId)`. │
│ - Cache offline Dexie IndexedDB wajib terisolasi per tenantId.        │
│                                                                        │
│ PILAR 2: ZERO DOMAIN LEAKAGE & VERTICAL ISOLATION                     │
│ - Tenant bertipe `LAUNDRY` DILARANG melihat istilah/fitur Kafe         │
│   (Meja, KDS Dapur, Waiter) atau Bengkel (SPK, Nopol, Mekanik).       │
│ - UI & navigasi beradaptasi otomatis via `VerticalContext`.            │
│                                                                        │
│ PILAR 3: INTEGRITAS KEUANGAN DUAL-PAYMENT & ARUS KAS                   │
│ - Drop-off bayar di muka (Lunas/DP) vs Bayar saat ambil cucian.        │
│ - Pembayaran dicatat atomik ke tabel `CashFlow` (Laci Kasir).          │
│ - Bahan kimia & kemasan terintegrasi ke dual-core engine `Ingredient`. │
│                                                                        │
│ PILAR 4: LIFECYCLE, ONBOARDING & DISASTER RECOVERY                     │
│ - Registrasi baru otomatis provisioning starter pack vertikal Laundry. │
│ - Ekspor/impor backup JSON dan reset toko simetris multi-vertikal.     │
│                                                                        │
│ PILAR 5: USER EXPERIENCE & HARDWARE KASIR KHUSUS                       │
│ - Kasir timbangan desimal (Kg) & pemilihan aroma parfum.               │
│ - Kanban alur kerja cucian (Cuci ─> Kering ─> Setrika ─> Rak Simpan).  │
│ - Struk thermal ber-QR Code dengan klausul Syarat & Ketentuan (S&K).   │
│                                                                        │
│ PILAR 6: MULTI-OUTLET HIERARCHY & CONSOLIDATED DASHBOARD               │
│ - 1 Akun Owner mengontrol banyak cabang & jenis bisnis via Switcher.   │
│ - Database tabel `Outlet` tersambung ke seluruh order, kas, & absen.   │
│ - Consolidated All-in-One Dashboard untuk memantau performa agregat    │
│   seluruh cabang/drop-point dalam satu layar eksekutif.                │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 1.1. Kerangka 7 Dimensi Pencocokan Vertikal (Zero-Revamp Framework)

Setiap pengembangan unit bisnis baru (termasuk Laundry) diturunkan dari 7 dimensi pencocokan berbasis modul yang sudah kita bangun:

1. **Terminologi & Kamus (`useVertical`):** Adaptasi label pelanggan (*Pelanggan Cucian*), unit kerja (*Mesin/Rak Simpan*), dan staf (*Operator Cuci/Setrika*).
2. **Katalog & UOM Kasir:** Adaptasi input desimal timbangan (`Kg`) dan varian parfum pada panel kasir POS yang sudah ada.
3. **Dual-Core Inventori:** Bahan kimia operasional (deterjen, softener, plastik) dicatat pada `Ingredient` dan otomatis terpotong saat cucian diproses.
4. **Alur Pembayaran Kasir:** Toggle Dual-Payment (Bayar Lunas di Muka, DP, atau Bayar Saat Ambil) terhubung langsung ke mesin kasir & laci kas (`CashFlow`).
5. **Alur Kerja PWA Staf:** Memanfaatkan pipeline Kanban Board yang sama (*Cuci ➔ Kering ➔ Setrika ➔ Masuk Rak ➔ Selesai*) tanpa membuat aplikasi mobile baru.
6. **Kas Kecil Operasional (Petty Cash):** Pencatatan kulakan darurat (beli pewangi warung, tali, gas uap) menggunakan modul arus kas yang sudah ada.
7. **Laporan Kunci Pemilik:** Menampilkan metrik eksekutif spesifik (*Tonase Kg*, *Aging Rak Piutang*, dan *Efisiensi Chemical*) pada layout grafik & PDF yang sudah ada.

---AR 5: USER EXPERIENCE & HARDWARE KASIR KHUSUS                       │
│ - Kasir timbangan desimal (Kg) & pemilihan aroma parfum.               │
│ - Kanban alur kerja cucian (Cuci ─> Kering ─> Setrika ─> Rak Simpan).  │
│ - Struk thermal ber-QR Code dengan klausul Syarat & Ketentuan (S&K).   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Todo List Implementasi (Berbasis Pilar SaaS)

### 📌 PILAR 1: Multi-Tenant Scoping, Real-Time & Offline Isolation

- [x] **1.1. Audit & Pengetatan Tenant Scoping di Backend (`backend/src/routes/laundry.ts`)**
  - [x] Pastikan seluruh endpoint (`GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id/status`, `PATCH /orders/:id/ready`, `POST /orders/:id/pickup`) memiliki validasi `where: { id, tenantId }` untuk membasmi potensi Insecure Direct Object Reference (IDOR).
  - [x] Pastikan penomoran nota cuci `LD-YYYYMM-XXXX` unik per-tenant (`@@unique([tenantId, orderNumber])`).
- [x] **1.2. Isolasi Real-Time WebSocket (Socket.IO)**
  - [x] Tambahkan room-based event:
    - `emitToTenant(io, tenantId, 'laundry:order-created', order)`
    - `emitToTenant(io, tenantId, 'laundry:status-changed', order)`
    - `emitToTenant(io, tenantId, 'laundry:order-ready', order)`
  - [x] **DILARANG** menggunakan global broadcast `io.emit()` yang dapat membocorkan notifikasi antar pemilik laundry.
- [x] **1.3. Partisi Storage Offline Browser (`frontend/src/db/offlineDb.ts`)**
  - [x] Pastikan cache layanan/katalog laundry difilter dengan `where('tenantId').equals(tenantId)`.
  - [x] Saat tenant logout atau beralih cabang (`TenantOutletSwitcher`), lakukan `offlineDb.clearCatalogCache()` untuk mencegah kontaminasi cache lokal.

---

### 📌 PILAR 2: Zero Domain Leakage & Dynamic Vertical Shell

- [x] **2.1. Adaptor Vertical Context (`frontend/src/context/VerticalContext.tsx`)**
  - [x] Tambahkan helper boolean `isLaundry: businessType === 'LAUNDRY'`.
  - [x] Perbarui kamus terminologi:
    - `orderTerm`: "Nota Cuci"
    - `itemTerm`: "Layanan Cuci"
    - `tableTerm`: "Nomor Rak / Keranjang"
    - `customerTerm`: "Pelanggan"
- [x] **2.2. Guarding Menu Navigasi (`frontend/src/components/Layout.tsx`)**
  - [x] Sembunyikan elemen F&B saat `isLaundry === true`:
    - Menu *Meja / Denah Meja* (`/meja`)
    - Menu *KDS Dapur* (`/kds`)
    - Menu *Reservasi Tamu* (`/reservasi`)
    - Fitur *Split Bill*
  - [x] Tampilkan navigasi vertikal Laundry:
    - *Kasir Laundry (Drop-off & Serah Terima)* $\to$ `/pos`
    - *Papan Status Cucian (Kanban)* $\to$ `/laundry-kanban`
    - *Bahan Kimia & Parfum* $\to$ `/bahan-baku`
    - *Buku Pelanggan & WA* $\to$ `/crm`
    - *Laporan Laundry & Tonase* $\to$ `/laporan`
- [x] **2.3. Routing Adaptif (`frontend/src/App.tsx`)**
  - [x] Pada `POSViewAdaptive`:
    ```tsx
    if (isLaundry) return <POSLaundry />;
    ```
  - [x] Daftarkan rute khusus `/laundry-kanban` mengarah ke `<LaundryKanbanView />`.

---

### 📌 PILAR 3: Integritas Finansial Dual-Payment & Arus Kas

- [x] **3.1. Mesin Dual-Payment Drop-off vs Pickup**
  - [x] **Opsi A: Bayar Lunas di Muka (Drop-off)**:
    - Nilai `paidAmount` = `totalAmount`, `paymentStatus` = `'PAID'`.
    - Buat mutasi kredit di tabel `CashFlow` laci kasir (`category: 'Pendapatan Laundry'`, `cashPocket: 'LACI_KASIR'`).
  - [x] **Opsi B: Bayar Nanti Saat Ambil (Unpaid / DP)**:
    - Nilai `paidAmount` < `totalAmount`, `paymentStatus` = `'UNPAID'` atau `'PARTIAL'`.
    - Hanya catat uang muka (jika ada) ke `CashFlow`. Sisa tagihan menjadi piutang nota cuci.
- [x] **3.2. Rekonsiliasi Pelunasan Saat Pengambilan (`/api/laundry/orders/:id/pickup`)**
  - [x] Saat pakaian diserahkan ke pelanggan, jika masih ada sisa tagihan, kasir menerima pembayaran pelunasan.
  - [x] Catat transaksi pelunasan ke `CashFlow` laci kasir shift aktif secara transaksional (`prisma.$transaction`).
  - [x] Update status order menjadi `COMPLETED` dan `paymentStatus` = `'PAID'`.
- [x] **3.3. Integrasi Bahan Baku Kimia Operasional (`Ingredient` Dual-Core Engine)**
  - [x] **Pemotongan Otomatis Konsumsi Kimia per-Tahap Alur Kerja (`backend/src/routes/laundry.ts`)**:
    - Tahap `WASHING`: Otomatis memotong stok deterjen cair (20 ml/kg) dan softener (15 ml/kg) ke tabel `Ingredient` serta mencatat riwayat pemakaian ke `IngredientLog` (`[WASHING]`).
    - Tahap `IRONING` / `READY`: Otomatis memotong bibit parfum semprot (10 ml/kg, dicocokkan berdasarkan `order.perfumeVariant`) dan plastik kemasan (1 pack per 5 kg) ke `IngredientLog` (`[FINISHING]`).
    - **Proteksi Idempotensi**: Menjamin tidak terjadi double deduction jika status diubah berulang kali.
  - [x] **Auto-Provisioning Starter Pack Kimia Laundry (`backend/src/routes/ingredients.ts`)**:
    - Jika tenant bertipe `LAUNDRY` membuka modul `/api/ingredients` dengan stok kosong (0 item), sistem secara otomatis menginisialisasi 6 starter pack: Deterjen Konsentrat 50L, Softener 30L, 3 Varian Parfum (Sakura, Akasia, Ocean) @15L, dan Plastik Jinjing HD 50 pack.
  - [x] **Adaptasi Terminologi Bebas Kebocoran F&B (`frontend/src/components/IngredientView.tsx`)**:
    - Header & Title adaptif: *"Bahan Kimia & Parfum Laundry"* dengan subtitle pemakaian deterjen, softener, dan kemasan.
    - Kategori adaptif: `🧪 Deterjen & Kimia` (FOOD), `🌸 Parfum & Pewangi` (DRINK), dan `📦 Kemasan & Hanger` (PACKAGING).
    - Adaptasi label 9 Tab Bento Grid & Mobile Slider (Operator Cuci/Setrika alih-alih Staf Dapur, Tumpahan Kimia alih-alih Bahan Basi).

---

### 📌 PILAR 4: Lifecycle Tenant, Onboarding & Disaster Recovery

- [x] **4.1. Starter Provisioning Tenant Laundry Baru (`backend/src/routes/auth.ts`)**
  - [x] Tambahkan inisialisasi otomatis pada registrasi tenant dengan `businessType === 'LAUNDRY'`:
    - **Kategori Bawaan**:
      - *Cuci Kiloan Reguler*
      - *Cuci Kilat / Express*
      - *Cuci Satuan & Bedcover*
      - *Dry Clean & Perawatan Sepatu*
    - **Paket Layanan Bawaan**:
      - Cuci Kering Setrika (Reguler 2-3 Hari) — Rp 7.000 / Kg
      - Cuci Lipat Kering (Tanpa Setrika) — Rp 5.000 / Kg
      - Setrika Rapi Saja — Rp 4.500 / Kg
      - Cuci Kering Setrika (Kilat 24 Jam) — Rp 10.000 / Kg
      - Bedcover King Size — Rp 25.000 / Pcs
      - Jas Pria / Blazer — Rp 30.000 / Pcs
      - Cuci Sepatu Sneakers — Rp 35.000 / Pcs
    - **Master Nomor Rak Simpan Awal**:
      - `RAK-A1`, `RAK-A2`, `RAK-B1`, `RAK-B2`, `HANGER-01`
    - **Bahan Kimia Awal (`Ingredient`)**:
      - Deterjen Cair Super (Liter), Pewangi Sakura (Liter), Softener Soft Blue (Liter), Kantong Plastik Jinjing Size L (Pack).
- [x] **4.2. Simetri Disaster Recovery & Backup JSON (`backend/src/routes/database.ts`)**
  - [x] Masukkan `LaundryOrder` dan `LaundryOrderItem` pada kueri ekspor JSON per-tenant (`where: { tenantId }`).
  - [x] Tambahkan restore simetris tabel laundry secara transaksional (*foreign key safe*).
- [x] **4.3. Reset Transaksi Aman (`backend/src/routes/tenantReset.ts`)**
  - [x] Pastikan endpoint `POST /api/tenant-reset/transactions` menghapus `LaundryOrderItem` dan `LaundryOrder` yang dimiliki oleh `tenantId` tanpa merusak master data.

---

### 📌 PILAR 5: Frontend Kasir Timbangan, Kanban & Hardware Struk

- [x] **5.1. Komponen Kasir Drop-off (`frontend/src/verticals/laundry/POSLaundry.tsx`)**
  - [x] Layar input timbangan berat desimal (tombol cepat `+0.5 kg`, `+1 kg`, `+2 kg`, `+3 kg`, `+5 kg` dan keypad desimal responsif).
  - [x] Pemilih Tier Kecepatan SLA (Reguler, Kilat 24 Jam, Express 6 Jam) dengan perhitungan otomatis tanggal/jam estimasi selesai.
  - [x] Pemilih Varian Aroma Parfum (Akasia, Sakura, Ocean Fresh, Snappy, Lavender, Non-Parfum).
  - [x] Kolom jumlah helai pakaian (item count notes) dan catatan pakaian luntur/cacat awal.
  - [x] Tombol alih Bayar Sekarang (Lunas/DP) vs Bayar Saat Ambil.
- [x] **5.2. Papan Status Pengerjaan & Alokasi Rak (`frontend/src/verticals/laundry/LaundryKanbanView.tsx`)**
  - [x] Kolom alur: `RECEIVED` $\to$ `WASHING` $\to$ `DRYING` $\to$ `IRONING` $\to$ `READY` $\to$ `COMPLETED`.
  - [x] Modal Pengepakan Selesai: input/pilih Nomor Rak Simpan $\to$ tombol pemicu WhatsApp otomatis *"Cucian Anda siap diambil di Rak..."*.
  - [x] Modal Serah Terima Cucian (Pickup Modal): pencarian cepat nota cuci $\to$ kalkulasi sisa bayar $\to$ kasir pelunasan $\to$ cetak tanda terima lunas.
- [x] **5.3. Cetak Struk Thermal Nota Cuci (58mm/80mm)**
  - [x] Desain struk kasir laundry:
    - Header outlet & kontak.
    - Barcode / QR Code nomor nota untuk scan cepat saat serah terima.
    - Berat (Kg) / Jumlah Pcs, Layanan, Pilihan Parfum, dan Jumlah Potong.
    - Status Finansial: Total, Terbayar, **Sisa Tagihan (Belum Lunas)**.
    - Klausul Syarat & Ketentuan (S&K) Standar Laundry (Anti klaim sengketa).
- [x] **5.4. Laporan Performa & Analisis Tonase Eksekutif (`frontend/src/verticals/laundry/LaundryReports.tsx`)**
  - [x] Tampilan ringkasan statistik harian & bulanan:
    - Total Tonase (Kg cucian masuk).
    - Total Pcs layanan satuan.
    - Rasio omzet Kiloan vs Satuan vs Biaya Express.
    - **Aging Rack & Bad Debt Heatmap**: 5 tingkat risiko (0-3 hari, 4-7 hari, 8-14 hari, 15-30 hari, >30 hari) lengkap dengan tombol 1-Click WhatsApp Reminder penagihan ramah/formal.
    - **Margin Matrix**: Perbandingan unit ekonomi volume kiloan vs margin tinggi cuci satuan (bedcover/sepatu/jas).
    - **Efisiensi Chemical**: Estimasi konsumsi liter deterjen & parfum teoritis vs stok riil gudang bahan baku.
    - **At-Risk Churn Guard**: Deteksi pelanggan yang tidak datang >14 hari dengan tombol 1-Click WhatsApp voucher sapaan kangen.

---

### 📌 PILAR 6: Multi-Outlet Hierarchy & Consolidated Dashboard

- [x] **6.1. Router Manajemen Cabang Outlet (`backend/src/routes/outlets.ts`)**
  - [x] `GET /api/outlets`: Mengambil daftar outlet milik tenant dengan auto-provisioning outlet utama jika belum ada.
  - [x] `POST /api/outlets`: Pendaftaran cabang baru (Nama, Kode, Alamat, Telepon, Radius GPS) oleh Owner/Admin lengkap dengan audit log.
  - [x] `PUT /api/outlets/:id`: Memperbarui data cabang dan radius koordinat GPS.
- [x] **6.2. Endpoint Agregasi Konsolidasi Multi-Outlet (`GET /api/outlets/consolidated-summary`)**
  - [x] Agregasi omset gabungan seluruh cabang (`Order`, `LaundryOrder`, `WorkOrder`) difilter per rentang tanggal.
  - [x] Agregasi beban kas operasional (`CashFlow`) per cabang untuk menghitung laba bersih gabungan.
  - [x] Peringkat performa cabang (Top-performing outlet) dan persentase kontribusi omset per cabang.
- [x] **6.3. Komponen Dashboard Konsolidasi Cabang (`frontend/src/components/ConsolidatedOutletDashboard.tsx`)**
  - [x] 4 Kartu Metrik Eksekutif: Omset Gabungan, Total Transaksi, Beban Operasional, Laba Bersih.
  - [x] Kartu Highlight Cabang Performa Tertinggi.
  - [x] Tabel/Daftar Peringkat Performa Outlet dengan bar kontribusi omset dan tombol instan *Masuk ke Cabang*.
  - [x] Modal pendaftaran cabang/drop-point baru untuk Owner.
- [x] **6.4. Tab Switcher Laporan Adaptif (`frontend/src/components/ReportViewAdaptive.tsx`)**
  - [x] Tab switch cepat di modul Laporan: `[📊 Laporan Vertikal]` vs `[🏢 Konsolidasi Cabang]`.

