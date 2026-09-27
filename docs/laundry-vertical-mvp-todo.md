# Todo & Implementation Checklist: MVP Vertikal Jasa Laundry Kiloan & Satuan

Dokumen ini merangkum rencana implementasi vertikal Jasa Laundry Kiloan & Satuan di CodePOS berdasarkan arsitektur pada `.agents/skills/laundry-vertical-hardening/SKILL.md`.

---

## Progress Checklist

### Fase 1: Backend Data Parity & Migration Hardening
- [ ] **1.1. Simetri Backup & Restore (`backend/src/routes/database.ts`)**:
  - Masukkan `LaundryOrder` & `LaundryOrderItem` pada ekspor JSON backup multi-tenant.
  - Tambahkan penanganan impor restore simetris tabel laundry.
- [ ] **1.2. Reset Transaksi Aman (`backend/src/routes/tenantReset.ts`)**:
  - Tambahkan pembersihan tabel `LaundryOrderItem` & `LaundryOrder` pada endpoint reset transaksi tenant.
- [ ] **1.3. Template Starter Onboarding Tenant Laundry (`backend/src/routes/auth.ts`)**:
  - Tambahkan blok `else if (businessType === 'LAUNDRY')` saat registrasi:
    - Kategori: Cuci Kiloan Reguler, Cuci Kilat/Express, Cuci Satuan & Bedcover, Dry Clean.
    - Layanan bawaan (Cuci Kering Setrika, Cuci Lipat, Setrika Saja, Bedcover King, Jas, Sepatu).
    - Inisialisasi rak simpan bawaan (`RAK-A1`, `RAK-A2`, `RAK-B1`, `RAK-B2`, `HANGER-01`).
    - Inisialisasi bahan kimia bawaan (`Ingredient`: Deterjen Cair, Pewangi Sakura, Softener, Plastik Jinjing).

### Fase 2: Navigasi Shell & Eliminasi Istilah Kafe
- [ ] **2.1. Adaptor Vertical Context (`frontend/src/context/VerticalContext.tsx`)**:
  - Ekspos flag boolean `isLaundry: businessType === 'LAUNDRY'`.
  - Pastikan terminologi laundry aktif (`orderTerm`: 'Nota Cuci', `itemTerm`: 'Paket Layanan', `tableTerm`: 'Rak Simpan', `customerTerm`: 'Pelanggan').
- [ ] **2.2. Penyesuaian Menu & Sidebar (`frontend/src/components/Layout.tsx`)**:
  - Sembunyikan modul Kafe (Meja, KDS Dapur, Reservasi, Split Bill).
  - Tampilkan menu Laundry: POS Kasir Laundry (`/pos`), Papan Status Cucian (`/laundry-kanban`), Bahan Kimia (`/bahan-baku`), CRM Pelanggan (`/crm`), Laporan Laundry (`/laporan`).
- [ ] **2.3. Routing Adaptif (`frontend/src/App.tsx`)**:
  - Integrasikan `POSLaundry` ke dalam `POSViewAdaptive`.
  - Daftarkan rute `/laundry-kanban` ke `<LaundryKanbanView />`.

### Fase 3: Antarmuka Kasir Drop-off (`POSLaundry.tsx`)
- [ ] **3.1. Input Timbangan Desimal Cepat**:
  - Keypad numerik desimal dan tombol pintas (+0.5 kg, +1 kg, +2 kg, +3 kg, +5 kg).
- [ ] **3.2. Katalog Layanan Kiloan & Satuan**:
  - Pemilihan layanan cepat dengan harga per unit (Kg / Pcs).
  - Tier kecepatan SLA: Reguler (2-3 hari), Kilat (24 jam), Super Express (6 jam) dengan kalkulasi tanggal estimasi selesai otomatis.
- [ ] **3.3. Preferensi Parfum & Fisik Pakaian**:
  - Dropdown varian aroma parfum (Akasia, Sakura, Ocean Fresh, Snappy, Lavender, Non-Parfum).
  - Kolom rincian jumlah potong pakaian dan catatan noda / pakaian luntur.
- [ ] **3.4. Dual-Payment Engine**:
  - Opsi: Bayar di Awal (Lunas/DP) vs Bayar Saat Ambil (Unpaid).
  - Integrasi pencatatan uang masuk ke `CashFlow` laci kasir jika pembayaran diterima di muka.
- [ ] **3.5. Struk Kasir Thermal Nota Cuci**:
  - Cetak struk 58mm/80mm dengan Barcode/QR, rincian potong pakaian, aroma parfum, status pembayaran, dan Syarat & Ketentuan (S&K) anti sengketa laundry.

### Fase 4: Papan Status Cucian & Rak Simpan (`LaundryKanbanView.tsx`)
- [ ] **4.1. Visual Kanban Alur Kerja Cucian**:
  - Kolom: `RECEIVED` $\to$ `WASHING` $\to$ `DRYING` $\to$ `IRONING` $\to$ `READY` $\to$ `COMPLETED`.
  - Pencatatan operator mesin cuci (`washerUserId`) & operator setrika (`ironerUserId`).
- [ ] **4.2. Modal Packing Selesai & Alokasi Nomor Rak**:
  - Dialog input/pilih nomor rak saat status diubah ke `READY`.
  - Pemicu pengiriman WhatsApp otomatis bahwa pakaian telah siap diambil di rak.
- [ ] **4.3. Modal Serah Terima & Pelunasan Cucian (Pickup Modal)**:
  - Pencarian nota berdasarkan nomor nota / scan QR / nama pelanggan.
  - Deteksi status pembayaran: jika belum lunas, buka modal pelunasan $\to$ cetak struk lunas $\to$ catat ke laci kasir $\to$ ubah status menjadi `COMPLETED`.

### Fase 5: Laporan Tonase & Pengaturan Vertikal
- [ ] **5.1. Dashboard & Laporan Laundry**:
  - Tampilan statistik tonase harian/bulanan (Kg), total Pcs, omzet, antrian aktif, dan buku piutang nota cuci belum lunas.
- [ ] **5.2. Pengaturan Khusus Laundry**:
  - Konfigurasi varian parfum dan biaya surcharge express.
  - Template teks S&K pada struk kasir.
