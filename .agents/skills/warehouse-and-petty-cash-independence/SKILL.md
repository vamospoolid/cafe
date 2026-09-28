---
name: warehouse-and-petty-cash-independence
description: >
  Standar arsitektur, isolasi data multi-tenant, dan independensi fungsional modul
  Gudang (Warehouse/Inventory) & Arus Kas (Petty Cash) di seluruh MVP vertikal CodePOS
  (Kafe, Retail/Sembako, Bengkel, dan Laundry). Menjamin eliminasi kebocoran domain Kafe
  (dapur, resep, bahan baku), pemisahan dual-core inventory (Ingredient vs Product),
  serta sinkronisasi kulakan darurat dan pencatatan kas kecil sesuai profil bisnis.
---

# Standar Arsitektur Independensi Gudang & Arus Kas Multi-Vertikal

## 1. Latar Belakang & Analisis Masalah Sistemik

CodePOS dirancang sebagai platform SaaS multi-vertikal yang mendukung:
- **`CAFE`**: Kafe, Restoran, Coffee Shop, Bakery.
- **`RETAIL`**: Toko Sembako, Toko Kelontong, Minimarket, Grosir, Toko Bahan Bangunan.
- **`BENGKEL`**: Bengkel Motor, Bengkel Mobil, Toko Ban & Variasi.
- **`LAUNDRY`**: Jasa Laundry Kiloan & Satuan.

Berdasarkan audit operasional di tenant `sembako` dan `bengkel`, ditemukan **2 anomali arsitektur mendasar**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│         2 ANOMALI SISTEMIK PADA GUDANG & ARUS KAS MULTI-VERTIKAL           │
├────────────────────────────────────────────────────────────────────────────┤
│ 1. KEBOCORAN DOMAIN PADA MODUL ARUS KAS (PETTY CASH):                      │
│    • Kategori belanja di-hardcode ke F&B: Makanan, Minuman, Kemasan Cup.   │
│    • Pengeluaran toko Sembako/Bengkel terpaksa masuk ke 'Lainnya' karena    │
│      tidak tersedia kategori 'Kulakan Dagangan', 'Kresek', atau 'Part'.    │
│    • Modal Catat Kas memunculkan dropdown bahan makanan ('Daging & Telur') │
│      dan membaca tabel Ingredient (resep kafe), bukan katalog barang toko. │
│                                                                            │
│ 2. KEBOCORAN DOMAIN & DATA DISCONNECT PADA GUDANG (WAREHOUSE):             │
│    • Modal Transfer menginstruksikan 'Distribusi Bahan ke Dapur' dengan     │
│      placeholder 'Restock kuah ramen' pada toko sembako / kelontong!       │
│    • Modal Inbound menginstruksikan '+ + Tambah Bahan Baku'.               │
│    • Backend (/api/warehouse/stock) 100% membaca tabel prisma.ingredient.  │
│      Akibatnya tenant Retail & Bengkel yang menyimpan stok di              │
│      prisma.product mendapati tabel gudang KOSONG ("Tidak ada produk")     │
│      dan total valuasi aset Rp 0!                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prinsip Arsitektur Wajib (Zero Domain Leakage)

### Aturan #1: Dual-Core Inventory Engine (Ingredient vs Product)
* **Vertikal `CAFE` (Mode Resep & BOM):**
  * Gudang mengelola **Bahan Baku Mentah (`Ingredient`)**: Tepung, Daging, Sirup, Biji Kopi.
  * Mutasi adalah **Distribusi ke Dapur/Bar Outlet**: Mengurangi `ingredient.warehouseStock` dan menambah `ingredient.stock` dapur.
  * Penjualan POS memotong stok dapur via relasi `RecipeItem`.
* **Vertikal `RETAIL` & `BENGKEL` (Mode Barang Jadi / Dagangan):**
  * Gudang mengelola **Barang Dagangan / Suku Cadang (`Product`)**: Beras, Minyak Goreng, Busi, Ban, Oli.
  * Mutasi adalah **Pindah ke Display / Etalase (Retail)** atau **Pengeluaran ke Pit Servis (Bengkel)**.
  * Inbound kulakan langsung meningkatkan stok aset produk (`product.stock` / `product.warehouseStock`).
  * Backend API `/api/warehouse/*` **WAJIB mendeteksi `tenant.businessType`**:
    * Jika `CAFE` $\rightarrow$ Query `prisma.ingredient`
    * Jika `RETAIL` atau `BENGKEL` $\rightarrow$ Query `prisma.product`

### Aturan #2: Dynamic Vertical Dictionary untuk Petty Cash
Setiap vertikal bisnis memiliki kamus kategori dan preset pengeluaran kas kecil tersendiri:
1. **Kafe (`CAFE`):**
   * Kategori: Bahan Makanan, Bahan Minuman, Kemasan & Packaging, Operasional Kafe, SDM Barista/Kitchen, Lainnya.
   * Presets: Token Listrik, Es Batu Kristal, Gas LPG, Susu Fresh, Air Galon, Bensin Kurir.
2. **Retail & Sembako (`RETAIL`):**
   * Kategori: Kulakan / Stok Dagangan Cepat, Plastik Kresek & Perlengkapan, Operasional Toko, Bensin Armada Kurir, Gaji & Helper Toko, Aset / Lainnya.
   * Presets: Token Listrik Toko, Kantong Kresek, Lakban & Nota, Bensin Motor/Pickup, Air Kasir, Retribusi Pasar.
3. **Bengkel Motor & Mobil (`BENGKEL`):**
   * Kategori: Suku Cadang & Sparepart, Oli & Cairan Kimia, Toolkit & Kompresor, Operasional Bengkel, SDM & Komisi Mekanik, Aset / Fasilitas Pit.
   * Presets: Token Listrik 3-Phase, Busi Cepat, Bensin Ambil Part, Selang Kompresor, Sabun Cuci Motor/Mobil, Retribusi Pit.
4. **Laundry (`LAUNDRY`):**
   * Kategori: Bahan Kimia & Deterjen, Plastik Packing & Hanger, Operasional Listrik & Gas Dryer, Transport Jemput-Antar, Gaji Operator, Perawatan Mesin.
   * Presets: Token Listrik, Gas LPG Dryer, Parfum Laundry, Deterjen Cair, Plastik Kiloan.

### Aturan #3: Eliminasi Glitch Redaksi Dobel Plus (`+ +`)
* Seluruh tombol aksi di header maupun modal yang memiliki ikon `<Plus />` **DILARANG** diawali karakter plus manual pada teks labelnya (contoh terlarang: `<Plus /> + Catat Kas` $\rightarrow$ hasil render: `+ + Catat Kas`).
* Teks label **WAJIB** berupa kata kerja / benda bersih: `Catat Kas`, `Kulakan / Belanja Stok`, `Tambah Barang`.

---

## 3. Matriks Terminologi Antarmuka Gudang per Vertikal

| Elemen UI | Vertikal `CAFE` | Vertikal `RETAIL` | Vertikal `BENGKEL` |
|---|---|---|---|
| **Judul Halaman** | Gudang Persediaan Bahan | Gudang & Inventaris Toko | Gudang & Rak Sparepart |
| **Subtitle Halaman** | Pencatatan aset bahan baku & distribusi dapur | Pencatatan aset barang, rak gudang, & kulakan | Pencatatan suku cadang, rak depo, & pasokan |
| **Tombol Inbound** | Belanja Bahan Masuk | Kulakan / Belanja Stok | Belanja Suku Cadang |
| **Tombol Mutasi** | Kirim ke Dapur | Transfer ke Display / Etalase | Pengeluaran ke Pit Servis |
| **Modal Mutasi: Judul** | Distribusi Bahan ke Dapur | Pindah Stok ke Display / Etalase | Pengeluaran Part ke Pit Servis |
| **Modal Mutasi: Subtitle** | Stok gudang berkurang, siap dimasak di dapur | Pindah stok gudang ke rak display kasir | Ambil part gudang untuk pengerjaan servis pit |
| **Modal Mutasi: Placeholder** | Contoh: Persiapan shift siang / restock ramen | Contoh: Restock rak sembako depan / display promo | Contoh: Persiapan pit servis motor matic harian |
| **Modal Mutasi: Tombol Submit** | Kirim ke Dapur (1-Klik) | Pindah ke Display (1-Klik) | Keluarkan ke Pit (1-Klik) |
| **Modal Inbound: Section** | Daftar Bahan Baku Grosir yang Masuk | Daftar Barang Kulakan yang Masuk | Daftar Suku Cadang yang Masuk |
| **Modal Inbound: Tombol Tambah** | Tambah Bahan Baku | Tambah Barang Dagangan | Tambah Suku Cadang |
| **Pesan Stok Kosong** | Tidak ada bahan baku ditemukan. | Tidak ada produk retail ditemukan. | Tidak ada suku cadang ditemukan. |

---

## 4. Standar Mutasi Data (Backend & Database)

### 1. Inbound Kulakan Stok (Penerimaan Pasokan)
* Saat pasokan diterima dengan status sukses:
  * Pada Kafe: Nilai `warehouseStock` pada `Ingredient` bertambah.
  * Pada Retail/Bengkel: Nilai `stock` pada `Product` bertambah (dengan konversi rasio grosir jika input menggunakan satuan karton/dus).
  * Catat transaksi di `WarehouseInbound` & `WarehouseInboundItem`.
  * Jika sumber dana `KAS_OPERASIONAL`: Otomatis buat entri `CashFlow` bertipe `Pengeluaran` dengan kategori `Kulakan / Belanja Stok` agar buku kas sinkron secara atomik.

### 2. Mutasi Antar-Lokasi (Transfer)
* Saat barang ditransfer:
  * Pada Kafe: `ingredient.warehouseStock` berkurang, `ingredient.stock` dapur bertambah.
  * Pada Retail: Catat log mutasi etalase (dan jika menggunakan multi-gudang, kurangi stok gudang cadangan dan tambahkan stok rak kasir).
  * Pada Bengkel: Catat log mutasi pengeluaran ke pit servis mekanik.
  * Catat transaksi di `WarehouseRequisition` & `WarehouseRequisitionItem`.

---

## 5. Checklist Validasi & Uji Bebas Kebocoran

1. **Uji Vertikal Sembako / Retail:**
   * Buka `/kas` $\rightarrow$ Verifikasi tidak ada kategori 'Makanan'/'Minuman'/'Kemasan'; verifikasi muncul kategori 'Kulakan', 'Kresek', 'Operasional Toko'.
   * Klik tombol 'Catat Kas' $\rightarrow$ Verifikasi judul tombol tidak dobel plus (`+ +`); verifikasi pilihan master membaca produk dagangan, bukan resep kuah/daging.
   * Buka `/gudang` $\rightarrow$ Verifikasi tabel menampilkan daftar produk sembako (bukan tabel kosong Rp 0).
   * Klik 'Transfer ke Display / Etalase' $\rightarrow$ Verifikasi modal berjudul "Pindah Stok ke Display / Etalase", tanpa teks "dapur" atau "kuah ramen".
2. **Uji Vertikal Bengkel:**
   * Buka `/kas` $\rightarrow$ Verifikasi muncul kategori 'Suku Cadang', 'Oli & Kimia', 'Toolkit Pit'.
   * Buka `/gudang` $\rightarrow$ Verifikasi modal transfer berjudul "Pengeluaran Part ke Pit Servis".
3. **Uji Vertikal Kafe:**
   * Buka `/kas` & `/gudang` $\rightarrow$ Verifikasi alur bahan baku dapur dan resep tetap bekerja 100% tanpa regresi.
