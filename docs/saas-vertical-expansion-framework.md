# Panduan Perancangan Arsitektur Ekspansi Vertikal & Multi-Outlet CodePOS
*SaaS Core-Engine & Vertical Adapter Pattern (Zero-Revamp Framework)*

Dokumen ini adalah **standar resmi dan cetak biru (blueprint)** ketika CodePOS akan berekspansi ke unit usaha baru (seperti **Laundry**, **Cuci Mobil / Car Wash**, **Pet Shop & Grooming**, **Apotek / Klinik**, dll). 

Prinsip utamanya: **"Memaksimalkan modul yang sudah teruji, mengadaptasi parameter dan kamus, tanpa merombak atau menulis ulang UX dasar (Zero-Revamp of Existing Core Features)"**.

---

## 1. Arsitektur Multi-Bisnis & Multi-Outlet

Sistem CodePOS memiliki hirarki 2 tingkat kendali terpusat:

```
                  ┌───────────────────────────────┐
                  │      AKUN OWNER / PENGGUNA    │
                  │   (1 Email & 1 Kredensial)    │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌─────────────────────────┐                     ┌─────────────────────────┐
│ UNIT USAHA A (KAFE)     │                     │ UNIT USAHA B (LAUNDRY)  │
│ Tenant ID: tnt_cafe_01  │                     │ Tenant ID: tnt_lnd_01   │
└────────────┬────────────┘                     └────────────┬────────────┘
             │                                               │
     ┌───────┴───────┐                               ┌───────┴───────┐
     ▼               ▼                               ▼               ▼
┌─────────┐     ┌─────────┐                     ┌─────────┐     ┌─────────┐
│ Outlet  │     │ Outlet  │                     │ Drop-   │     │ Workshop│
│ Pusat   │     │ Cabang  │                     │ Point A │     │ Pusat   │
└─────────┘     └─────────┘                     └─────────┘     └─────────┘
```

### Tingkat Kontrol:
1. **Multi-Unit Usaha (Lintas Vertikal):**
   - Pemilik beralih antara Kafe, Bengkel, Retail, dan Laundry secara instan via `TenantOutletSwitcher` di header aplikasi.
   - Token berganti secara aman dan cache IndexedDB dibersihkan secara atomik (`clearCatalogCache()`) untuk mencegah kontaminasi data antar bisnis.
2. **Multi-Cabang (Dalam 1 Unit Usaha):**
   - Setiap transaksi (`Order`, `LaundryOrder`, `WorkOrder`), pergerakan kas (`CashFlow`), dan absensi (`Attendance`) terikat ke `tenantId` dan `outletId`.
   - Staf di Cabang A terisolasi dan hanya melihat operasional Cabang A.
   - Owner memiliki akses ke seluruh cabang.
3. **Consolidated Multi-Outlet Dashboard (Dashboard Gabungan Eksekutif):**
   - Menampilkan total omset agregat (Cabang 1 + Cabang 2 + Cabang 3) dalam 1 layar grafik.
   - Membandingkan performa antar cabang (Top vs Underperforming Outlet).
   - Pengelolaan distribusi bahan baku antar gudang cabang (*Warehouse Transfer Requisition*).

---

## 2. Framework 7 Dimensi Pencocokan Vertikal (Alignment Checklist)

Gunakan 7 pertanyaan standar ini untuk membedah setiap unit bisnis baru sebelum menulis kode:

### 1. Kamus & Terminologi Bisnis (`useVertical`)
- **Pertanyaan:** Apa panggilan untuk Pelanggan, Unit Kerja, Staf, dan Dokumen Transaksi?
- **Contoh Laundry:**
  - Pelanggan ➔ *Pelanggan Cucian*
  - Meja/Stall ➔ *Mesin Cuci / Nomor Rak Simpan*
  - Barista/Mekanik ➔ *Operator Cuci / Operator Setrika*
  - Struk ➔ *Nota Tanda Terima Cucian*

### 2. Karakteristik Katalog & Input Kasir (Catalog & UOM)
- **Pertanyaan:** Apakah menjual barang fisik, jasa murni, atau kombinasi? Bagaimana satuan hitungnya?
- **Pencocokan Modul:**
  - Menggunakan layout kasir POS yang sudah ada.
  - Jika butuh timbangan, aktifkan keypad desimal (`Kg`) dan tombol cepat (`+0.5kg`, `+1kg`, `+2kg`).
  - Jika butuh varian (misal wangi parfum / tingkat keharuman), aktifkan selector varian.

### 3. Dual-Core Inventori & Bahan Habis Pakai (Ingredients & Chemical)
- **Pertanyaan:** Bahan baku apa yang otomatis berkurang saat jasa dikerjakan?
- **Pencocokan Modul:**
  - Menggunakan modul `IngredientView` & tabel `Ingredient`.
  - Daftarkan formula: Misal 1 Kg Cuci memotong 20ml Deterjen Cair + 15ml Softener + 1 Lembar Plastik Packing.
  - Stok otomatis terpotong saat status cucian masuk ke mesin cuci.

### 4. Alur Pembayaran Kasir (Payment Cycle)
- **Pertanyaan:** Kapan pembayaran dilakukan oleh pelanggan?
- **Pencocokan Modul:**
  - Menggunakan mesin pembayaran kasir (`CashFlow` & shift kasir).
  - Aktifkan toggle **Dual-Payment**: *Bayar Lunas di Muka (Drop-off)*, *Bayar DP*, atau *Bayar Nanti Saat Ambil (Pickup)*.
  - Sisa tagihan otomatis dihitung saat serah terima barang.

### 5. Alur Kerja Staf & Pipeline Operasional (PWA Staf)
- **Pertanyaan:** Bagaimana urutan pengerjaan pesanan dari masuk hingga selesai?
- **Pencocokan Modul:**
  - Menggunakan PWA Staf & Kanban Board Engine yang sudah ada.
  - Daftarkan tahapan status ke Kanban:
    - *Kafe:* Masuk ➔ Dimasak ➔ Siap Saji.
    - *Bengkel:* Antre ➔ Servis ➔ QC ➔ Siap Ambil.
    - *Laundry:* Timbang ➔ Cuci ➔ Kering ➔ Setrika ➔ Masuk Rak ➔ Selesai.

### 6. Kas Kecil Operasional Harian (Petty Cash)
- **Pertanyaan:** Biaya darurat apa yang sering dikeluarkan staf dari laci kasir?
- **Pencocokan Modul:**
  - Menggunakan modul Arus Kas / Pengeluaran Toko (`CashFlowView`).
  - Konfigurasi kategori otomatis: beli deterjen darurat di warung tetangga, isi ulang gas uap, tali rafia, atau plastik darurat.

### 7. Laporan Kunci Eksekutif (Owner's Decision Metrics)
- **Pertanyaan:** Angka dan grafik apa yang paling dicari pemilik usaha setiap pagi/malam?
- **Pencocokan Modul:**
  - Menggunakan engine grafik, summary cards, dan PDF exporter yang sudah ada.
  - **Laundry:** Total Tonase (Kg), Rasio Kiloan vs Satuan, Aging Rak (Cucian tertahan >7 hari dengan tombol WhatsApp Reminder), dan Efisiensi Chemical.

---

## 3. Prosedur Pembuatan Implementation Plan & Todo List

Setiap ada inisiasi unit usaha baru:
1. Buat dokumen rencana di `docs/{nama_vertikal}-saas-architecture-todo.md`.
2. Susun Todo List dalam format Sprint 1 s/d Sprint 5 berdasarkan 6 Pilar SaaS.
3. Pastikan tidak ada kode yang merombak file shared inti tanpa pengaman kondisi `useVertical()`.
4. Jalankan validasi `tsc -b && vite build` di setiap akhir sprint untuk menjamin zero-regression.
