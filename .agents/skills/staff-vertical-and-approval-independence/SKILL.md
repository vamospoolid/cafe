---
name: staff-vertical-and-approval-independence
description: >
  Standar arsitektur, isolasi multi-tenant SaaS, independensi vertikal (Kafe, Bengkel,
  Retail/Bangunan), eliminasi kebocoran domain F&B pada Apps Staff PWA, penyelarasan
  Dual-Core Inventory (Ingredient vs Product), unifikasi pencatatan Food Waste (/api/waste),
  serta otorisasi Quick Approval Owner/Manager pada perangkat mobile.
---

# Standar Arsitektur Apps Staff Multi-Vertikal & Owner Approval

## 1. Konteks & Latar Belakang

Apps Staff ([StaffPWAView.tsx](file:///c:/ADATA/codepos/frontend/src/components/StaffPWAView.tsx), rute `/staff` dan `/dapur-app`) adalah antarmuka mandiri PWA (*Employee Self-Service & Operasional Lapangan*) yang diakses oleh staf operasional (cook, barista, kasir, mekanik, helper toko, driver armada) melalui smartphone atau tablet.

Dalam arsitektur SaaS multi-tenant CodePOS dengan multi-vertikal (`CAFE`, `RETAIL`, `BENGKEL`, `LAUNDRY`), ditemukan **4 anomali sistemik**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 4 ANOMALI SISTEMIK PADA APPS STAFF (PWA)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. KEBOCORAN DOMAIN KAFE (SOP CHECKLIST & TERMINOLOGI):                     │
│    • Mekanik bengkel & helper toko bangunan dipaksa mencentang:             │
│      "Kalibrasi Grinder & Cek Rasa Espresso", "Periksa Chiller Susu",       │
│      "Backflush Mesin Espresso".                                            │
│                                                                             │
│ 2. DUAL-CORE INVENTORY DISCONNECT (TAB STOK KOSONG):                        │
│    • Tab Stok di Apps Staff 100% memanggil `/api/ingredients`.              │
│    • Tenant Retail & Bengkel menyimpan stok di tabel `Product`              │
│      (busi, oli, semen, beras), bukan `Ingredient` (resep dapur).           │
│    • Dampak: Tab stok di tenant non-kafe KOSONG (0 item) & form lapor rusak │
│      gagal total.                                                           │
│                                                                             │
│ 3. DISINKRONISASI KITCHEN WASTE:                                            │
│    • Form "Lapor Basi / Rusak" menembak ke legacy `/api/ingredients/loss`.  │
│    • Tidak menulis ke tabel `WasteLog` sehingga TIDAK MUNCUL di Dashboard   │
│      KPI Food Waste & Analitik Rasio Kerugian HPP (/api/waste/analytics).   │
│    • Belum mendukung waste masakan jadi/gosong (Product dishes) & foto.     │
│                                                                             │
│ 4. KETIADAAN QUICK APPROVAL UNTUK OWNER DI MOBILE:                          │
│    • Owner yang login di smartphone via `/staff` tidak memiliki akses       │
│      menyetujui Izin Cuti & Kasbon staf. Harus buka desktop/laptop kasir.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prinsip Arsitektur: Zero Spaghetti & Capability-Driven

### Aturan #1: Single PWA Engine, Dynamic Vertical Adapter
**DILARANG** menduplikasi file PWA menjadi `StaffCafeView.tsx`, `StaffBengkelView.tsx`, `StaffRetailView.tsx`.
Gunakan pola **Dynamic Vertical Adapter** di dalam [StaffPWAView.tsx](file:///c:/ADATA/codepos/frontend/src/components/StaffPWAView.tsx) yang membaca profil vertikal dari `settings?.businessType`:

```typescript
// Pattern Benar: Adapter berbasis businessType
const verticalConfig = getStaffVerticalProfile(settings?.businessType || 'CAFE');
```

### Aturan #2: Strict Multi-Tenant Scoping (Zero Cross-Tenant Leaks)
Setiap mutasi dan pengambilan data di Apps Staff WAJIB mematuhi isolasi tenant fail-closed:
1. Header `Authorization: Bearer <token>` wajib menyertakan validasi tenant context di backend.
2. Tidak boleh ada fallback fail-open `...(tenantId ? { tenantId } : {})`.
3. Verifikasi kepemilikan item secara double-key: `{ id: itemId, tenantId }`.

---

## 3. Eliminasi Kebocoran Domain: SOP Dinamis per Vertikal

SOP Opening & Closing wajib menggunakan kamus terisolasi sesuai profil bisnis:

```typescript
export const VERTICAL_SOP_PRESETS: Record<string, { opening: SOPCheckItem[]; closing: SOPCheckItem[] }> = {
  CAFE: {
    opening: [
      { id: 'c_op1', text: 'Kalibrasi Grinder & Cek Rasa Espresso (Dose & Yield)', category: 'bar' },
      { id: 'c_op2', text: 'Periksa Suhu Chiller / Kulkas Susu (< 4°C)', category: 'chiller' },
      { id: 'c_op3', text: 'Cek Kesiapan Bahan Baku & Stock Susu Segar', category: 'bar' },
      { id: 'c_op4', text: 'Sanitasi Meja Bar, Portafilter & Steam Wand', category: 'clean' },
      { id: 'c_op5', text: 'Hitung Modal Kas Awal di Laci Kasir', category: 'cash' },
      { id: 'c_op6', text: 'Nyalakan POS & Pastikan Kertas Thermal Siap', category: 'cash' }
    ],
    closing: [
      { id: 'c_cl1', text: 'Backflush & Chemical Cleaning Mesin Espresso', category: 'bar' },
      { id: 'c_cl2', text: 'Bersihkan & Kosongkan Hopper Grinder Kopi', category: 'bar' },
      { id: 'c_cl3', text: 'Simpan Semua Bahan Sisa ke Dalam Chiller', category: 'chiller' },
      { id: 'c_cl4', text: 'Sapu, Pel Lantai & Buang Sampah Bar/Dapur', category: 'clean' },
      { id: 'c_cl5', text: 'Rekonsiliasi Kas Laci & Tutup Shift Kasir', category: 'cash' },
      { id: 'c_cl6', text: 'Matikan Mesin, AC, Lampu & Kunci Pintu', category: 'clean' }
    ]
  },
  BENGKEL: {
    opening: [
      { id: 'b_op1', text: 'Cek Tekanan Angin Kompresor & Kuras Tabung Air', category: 'bar' },
      { id: 'b_op2', text: 'Kalibrasi Kunci Torsi & Cek Kelengkapan Kunci Pit', category: 'bar' },
      { id: 'b_op3', text: 'Periksa Stok Oli Mesin & Fast-Moving Parts', category: 'chiller' },
      { id: 'b_op4', text: 'Kesiapan Sarung Tangan, Masker & Kain Majun Bersih', category: 'clean' },
      { id: 'b_op5', text: 'Hitung Kas Awal / Modal Uang Kembalian Kasir', category: 'cash' },
      { id: 'b_op6', text: 'Nyalakan POS Bengkel & Printer SPK/Invoice A4', category: 'cash' }
    ],
    closing: [
      { id: 'b_cl1', text: 'Kunci & Rapikan Seluruh Kotak Toolkit Mekanik', category: 'bar' },
      { id: 'b_cl2', text: 'Kuras Udara Kompresor & Matikan MCB Listrik 3-Phase', category: 'bar' },
      { id: 'b_cl3', text: 'Tuang Bak Tampung Oli Bekas ke Drum Limbah B3', category: 'chiller' },
      { id: 'b_cl4', text: 'Sapu, Degrease Lantai Pit dari Ceceran Oli & Gemuk', category: 'clean' },
      { id: 'b_cl5', text: 'Rekonsiliasi Kas Laci & Catat Kasbon/Bon Part', category: 'cash' },
      { id: 'b_cl6', text: 'Gembok Pintu Rolling Door Pit & Gerbang Bengkel', category: 'clean' }
    ]
  },
  RETAIL: {
    opening: [
      { id: 'r_op1', text: 'Cek Label Harga di Rak (Price Tag & Promo Rak Depan)', category: 'bar' },
      { id: 'r_op2', text: 'Pastikan Lorong Toko Bebas Halangan Dus/Palet', category: 'clean' },
      { id: 'r_op3', text: 'Display Penuh Barang Fast-Moving / Sembako / Semen', category: 'bar' },
      { id: 'r_op4', text: 'Hitung Kas Awal / Modal Uang Pas di Laci Kasir', category: 'cash' },
      { id: 'r_op5', text: 'Nyalakan POS, Barcode Scanner & Kertas Struk', category: 'cash' },
      { id: 'r_op6', text: 'Cek Kesiapan Armada Pick-Up / Kendaraan Kirim', category: 'chiller' }
    ],
    closing: [
      { id: 'r_cl1', text: 'Tutup Terpal / Amankan Barang Display di Luar Toko', category: 'bar' },
      { id: 'r_cl2', text: 'Sapu Lorong & Rapikan Barang Rak yang Berantakan', category: 'clean' },
      { id: 'r_cl3', text: 'Catat Barang Display yang Menipis untuk Kulakan Besok', category: 'chiller' },
      { id: 'r_cl4', text: 'Rekonsiliasi Kas Laci, Edc & Tutup Shift Kasir', category: 'cash' },
      { id: 'r_cl5', text: 'Parkir Armada Kirim di Garasi & Kunci Setir', category: 'clean' },
      { id: 'r_cl6', text: 'Matikan Lampu Display, AC & Gembok Rolling Door', category: 'clean' }
    ]
  }
};
```

---

## 4. Dual-Core Inventory di Apps Staff

Tab Stok wajib mengambil data berdasarkan arsitektur model bisnis tenant:

```typescript
const fetchInventoryStock = async () => {
  const isCafe = (settings?.businessType || 'CAFE') === 'CAFE';
  const endpoint = isCafe ? '/api/ingredients' : '/api/products';
  
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) {
    const rawData = await res.json();
    // Normalize data agar seragam: { id, name, stock, unit, minStock, buyPrice, category }
    setStockItems(normalizeStockData(rawData, isCafe));
  }
};
```

- **Jika Kafe**: Kelola `Ingredient` (resep & bahan baku).
- **Jika Bengkel**: Kelola `Product` (suku cadang, oli, busi).
- **Jika Retail**: Kelola `Product` (sembako, semen, cat, paku).

---

## 5. Sinkronisasi Food Waste & Spoilage Tracking

Tombol "Lapor Basi / Rusak" di Apps Staff **WAJIB** dialihkan dari endpoint legacy `/api/ingredients/loss` ke endpoint modern **`POST /api/waste`**.

### Standar Payload Waste
```typescript
interface WastePayload {
  type: 'INGREDIENT' | 'PRODUCT'; // Mendukung bahan mentah atau menu jadi rusak/gosong
  ingredientId?: number;
  productId?: number;
  qty: number;
  reason: string;
  notes?: string;
  photoUrl?: string; // Kompresi via WebRTC/Kamera HP
}
```

### Manfaat Integrasi:
1. Terhubung langsung ke tabel `WasteLog` & Audit Log.
2. Otomatis masuk ke kalkulasi Dashboard KPI Food Waste (`/api/waste/analytics`).
3. Jika menu masakan jadi (`type: 'PRODUCT'`) rusak, sistem otomatis memotong stok bahan baku dari komposisi resep secara proporsional.

---

## 6. Owner Quick-Approval Mobile Hub

Jika akun yang login di smartphone adalah `owner`, `admin`, atau `manager`:
Apps Staff wajib menampilkan **Quick-Approval Center**:

```
┌─────────────────────────────────────────────────────────────┐
│ 🛡️ PUSAT PERSETUJUAN OWNER (MOBILE)                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Pengajuan Cuti / Izin Menunggu (Count: 2)                │
│    [Budi - Sakit Flu 2 Hari]                                │
│    [✓ Setujui]  [✕ Tolak]  [Lihat Surat Dokter]             │
│                                                             │
│ 2. Pengajuan Kasbon Staf Menunggu (Count: 1)                │
│    [Agus (Mekanik) - Rp 250.000 (Servis Motor)]            │
│    [✓ Cairkan via Kas Owner] [✕ Tolak]                      │
└─────────────────────────────────────────────────────────────┘
```

- Endpoint Izin: `PATCH /api/attendance/leaves/:id/status`
- Endpoint Kasbon: `POST /api/employee-loans/:id/approve`

---

## 7. Ekstensi Vertikal Khusus (Spesifik Domain)

### A. Vertikal Bengkel (Mode Mekanik)
- **Tab Antrean SPK Saya**: Mengambil data `/api/bengkel/work-orders?mechanicId=myId`.
  - No. Polisi, Merk/Tipe, Keluhan Pelanggan.
  - Aksi: `Mulai Servis` -> `Menunggu Part` -> `Selesai`.
- **Live Commission Tracker**:
  - Menghitung total jasa servis yang diselesaikan mekanik pada shift berjalan dan estimasi rupiah komisi yang diperoleh.

### B. Vertikal Retail & Toko Bangunan (Mode Helper & Driver)
- **Tab Barcode Price & Bin Checker**:
  - Scan barcode produk menggunakan kamera HP.
  - Menampilkan stok, lokasi rak/lorong gudang, dan harga bertingkat (Eceran vs Grosir).
- **Tab Pengiriman Armada (Delivery Order)**:
  - Khusus staf ber-role `driver` / `kurir`.
  - Menampilkan rute pengiriman DO hari ini dan tombol konfirmasi pengantaran + foto serah terima di lokasi proyek mandor.

---

## 8. Panduan Migrasi & Transisi Vertikal

Ketika sebuah tenant berpindah vertikal (misal dari `CAFE` ke `BENGKEL` via SaaS Superadmin):
1. **Invalidasi Cache Lokal**: Hapus cache IndexedDB/LocalStorage yang menyimpan state SOP lama.
2. **Preset Refresh**: Saat user login kembali, Apps Staff membaca `settings.businessType` baru dan otomatis memuat SOP & konfigurasi vertikal baru tanpa reload manual.
3. **Graceful Fallback**: Jika suatu endpoint vertikal belum aktif, render *empty state* yang ramah pengguna, bukan halaman crash/blank putih.
