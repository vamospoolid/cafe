# TODO: Faktur Pembelian Sparepart Masuk & Buku Hutang Tempo Supplier (Net 30)

Dokumen rencana kerja teknis untuk implementasi sistem penerimaan nota barang masuk, manajemen hutang usaha tempo (*Accounts Payable* Net 14/Net 30), kalkulasi HPP *Moving Average*, serta integrasi arus kas pelunasan nota untuk Bengkel CodePOS.

---

## Prinsip Kunci Arsitektur
1. **Zero Cross-Tenant Leak**: Seluruh data faktur, rincian barang, dan pembayaran hutang wajib memuat `tenantId` dan dicek kepemilikannya (`where: { id, tenantId }`).
2. **Zero Spaghetti Code**: Logika backend berada terisolasi di `backend/src/routes/bengkel/supplierInvoices.ts`. Komponen frontend berada di `frontend/src/verticals/bengkel/`.
3. **Integritas Arus Kas (Cash Flow)**: Nota tempo tidak memotong kas laci saat dibuat. Arus kas keluar (`CashFlow`) hanya dicatat saat dilakukan pembayaran cicilan/pelunasan nota.
4. **Stok & HPP Real-Time**: Barang masuk otomatis menambah stok katalog produk (`Product.stock`), dan harga beli baru dihitung dengan formula *Weighted Moving Average*.
5. **Paritas Backup & Reset**: Seluruh model baru didaftarkan ke `BackupService.ts`, `database.ts`, dan `tenantReset.ts`.

---

## Fase 1: Skema Prisma & Model Database
- [x] **1.1. Penambahan Model di `schema.prisma`**
  - Model `SupplierInvoice` (Faktur supplier, termin TOP, due date, status, remainingAmount).
  - Model `SupplierInvoiceItem` (Rincian suku cadang, qty masuk, harga beli satuan).
  - Model `SupplierInvoicePayment` (Riwayat cicilan/pelunasan nota, metode pembayaran, ref transfer).
- [x] **1.2. Eksekusi Sinkronisasi Database**
  - Jalankan `npx prisma db push` dan `npx prisma generate` (Client v5.22.0 terintegrasi).

---

## Fase 2: Backend REST Controller (`supplierInvoices.ts`)
- [x] **2.1. Controller Faktur Supplier (`backend/src/routes/bengkel/supplierInvoices.ts`)**
  - `GET /api/bengkel/supplier-invoices`: Ambil daftar nota masuk (filter status, search, rentang tanggal).
  - `POST /api/bengkel/supplier-invoices`: Simpan nota masuk:
    - Atomik transaksi: tambah stok produk & kalkulasi ulang HPP Moving Average.
    - Hitung otomatis tanggal jatuh tempo berdasarkan termin (Net 7, Net 14, Net 30, dll).
  - `POST /api/bengkel/supplier-invoices/:id/payments`: Catat pembayaran/cicilan nota:
    - Update `paidAmount`, `remainingAmount`, `status` (`PARTIAL` / `PAID`).
    - Buat baris `CashFlow: Pengeluaran` (Kategori: "Pembayaran Hutang Supplier").
  - `GET /api/bengkel/supplier-invoices/summary`: Ringkasan hutang aktif, mendekati jatuh tempo ($\le 7$ hari), dan overdue.
- [x] **2.2. Registrasi Route di `backend/src/routes/bengkel/index.ts`**
  - Proteksi dengan `requireBusinessType('BENGKEL')`.

---

## Fase 3: Paritas Backup & Tenant Reset
- [x] **3.1. Registrasi ke `BackupService.ts` & `database.ts`**
  - Sertakan `supplierInvoices`, `supplierInvoiceItems`, dan `supplierInvoicePayments` dalam ekspor JSON dan info count.
- [x] **3.2. Pembersihan di `tenantReset.ts`**
  - Hapus data faktur pembelian dan riwayat pembayaran pada transaksi reset tenant.

---

## Fase 4: Antarmuka Frontend (UI/UX)
- [x] **4.1. Modal Form Input Faktur Masuk (`SupplierInvoiceModal.tsx`)**
  - Input No. Nota Fisik, Supplier, Tanggal Nota, Termin Pembayaran (COD / Net 14 / Net 30 / Custom).
  - Dynamic Item Table: Pilih sparepart, isi Qty masuk, dan Harga Beli satuan.
- [x] **4.2. Modal Pembayaran / Pelunasan Hutang (`SupplierPaymentModal.tsx`)**
  - Input nominal bayar, metode bayar (Transfer Bank / Kas Laci), catatan & no referensi.
- [x] **4.3. Tab Faktur Masuk & Hutang Tempo di `BengkelProcurementView.tsx`**
  - Tab ke-3: **"🧾 Faktur Masuk & Hutang Tempo (Net 30)"**.
  - Metric Card: Total Hutang Aktif, Nota Overdue, Jatuh Tempo Minggu Ini, Terbayar Bulan Ini.
  - Tabel Daftar Nota dengan badge countdown hari dan tombol aksi Bayar.
- [x] **4.4. Pembaruan Kartu Supplier di `SupplierView.tsx`**
  - Tampilkan saldo hutang aktif per supplier dan jumlah nota tempo berjalan.

---

## Fase 5: Pengujian & Validasi
- [x] **5.1. Skrip Pengujian Otomatis (`test_bengkel_supplier_invoices.js`)**
  - Uji penambahan stok & recalculation HPP Moving Average: PASS (15 pcs, HPP Rp 43.333).
  - Uji isolasi data antar-tenant & pencegahan IDOR: PASS.
  - Uji pencatatan Arus Kas saat pembayaran nota: PASS (Rp 0 saat tempo, Rp 200.000 saat cicil).
  - Uji paritas reset tenant: PASS.
- [x] **5.2. Build Check Frontend & Backend**
  - `npm run build` frontend: 100% SUCCESS (`✓ built in 5.91s`).
  - `tsc --noEmit` backend: 100% SUCCESS (`Exit code 0`).
