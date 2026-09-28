# Roadmap & TODO List: Apps Staff Multi-Vertikal, Owner Approval & Food Waste Hardening

Dokumen ini memuat daftar tugas (*Implementation TODO Checklist*) terperinci untuk mentransformasikan **Apps Staff PWA ([StaffPWAView.tsx](file:///c:/ADATA/codepos/frontend/src/components/StaffPWAView.tsx))** dari status *Cafe-Centric* menjadi platform *Multi-Tenant SaaS Multi-Vertical* yang mendukung penuh model bisnis **Kafe (`CAFE`)**, **Bengkel (`BENGKEL`)**, dan **Retail/Toko Bangunan (`RETAIL`)**, serta menghadirkan kapabilitas **Owner Quick-Approval** di smartphone.

---

## 📊 Ringkasan Status Progres

| Fase | Deskripsi Area | Target File | Status |
| :--- | :--- | :--- | :--- |
| **Fase 1** | Eliminasi Domain Leak F&B & SOP Checklists Dinamis | `StaffPWAView.tsx` | ✅ COMPLETED |
| **Fase 2** | Dual-Core Inventory Adapter (Ingredients vs Products) | `StaffPWAView.tsx`, `warehouse.ts` | ✅ COMPLETED |
| **Fase 3** | Unifikasi Pencatatan Food Waste ke Engine Modern | `StaffPWAView.tsx`, `waste.ts` | ✅ COMPLETED |
| **Fase 4** | Owner Mobile Quick-Approval Hub (Cuti & Kasbon) | `StaffPWAView.tsx`, `attendance.ts`, `employeeLoans.ts` | ✅ COMPLETED |
| **Fase 5** | Ekstensi Vertikal Khusus (Bengkel SPK/Komisi & Retail DO) | `StaffPWAView.tsx`, `workOrders.ts` | ✅ COMPLETED |
| **Fase 6** | Pengujian Multi-Tenant, Migrasi Vertikal & Zero-Error Build | `StaffPWAView.tsx`, build verification | ✅ COMPLETED |

---

## 📌 Rincian Checklist Tugas per Fase

### Fase 1: Eliminasi Domain Leak F&B & SOP Checklists Dinamis
- [x] Buat kamus SOP terisolasi `VERTICAL_SOP_PRESETS` di `StaffPWAView.tsx` untuk `CAFE`, `BENGKEL`, dan `RETAIL`:
  - [x] **Kafe**: Kalibrasi grinder, chiller susu, sanitasi steam wand, kas laci, backflush espresso.
  - [x] **Bengkel**: Tekanan kompresor, kalibrasi kunci torsi, stok oli & part cepat, APD majun, kunci toolbox, kuras oli bekas B3.
  - [x] **Retail**: Cek price tag rak, lorong bebas halangan palet, display fast-moving, kas laci, tutup terpal barang luar, armada pick-up.
- [x] Hubungkan state SOP ke `settings.businessType` sehingga otomatis berganti saat login tanpa hardcoded teks kafe.
- [x] Perluas pengenalan peran (*Role & Persona*):
  - [x] Tambahkan palet avatar & badge untuk `Mekanik`, `Kepala Bengkel`, `Service Advisor` (Bengkel).
  - [x] Tambahkan palet avatar & badge untuk `Helper Toko`, `Staf Gudang`, `Driver Armada` (Retail).
- [x] Bersihkan label glitch dobel plus `+ +` pada seluruh tombol aksi di Apps Staff.

### Fase 2: Dual-Core Inventory Adapter di Apps Staff
- [x] Ubah logika pengambilan stok pada Tab "Stok":
  - [x] Jika `settings.businessType === 'CAFE'`: Panggil `/api/ingredients` (tabel Bahan Mentah Resep Dapur).
  - [x] Jika `settings.businessType === 'BENGKEL'` atau `'RETAIL'`: Panggil `/api/products` (tabel Suku Cadang, Oli, Beras, Semen, Cat).
- [x] Buat fungsi normalisasi data stok (`UnifiedStockItem`) agar struktur kartu stok seragam:
  - `{ id, name, stock, unit, minStock, buyPrice, category, location }`.
- [x] Tampilkan informasi lokasi rak/lorong gudang (`item.itemLocation`) pada mode Retail/Bengkel.
- [x] Sediakan filter kategori yang adaptif per vertikal (misal: Suku Cadang/Oli vs Sembako/Material vs Food/Drink).

### Fase 3: Unifikasi Pencatatan Food Waste & Kerugian HPP
- [x] Migrasikan handler `handleSubmitStockLoss` di `StaffPWAView.tsx`:
  - [x] Ganti target URL dari `/api/ingredients/loss` ke endpoint resmi **`POST /api/waste`**.
- [x] Tambahkan selektor tipe waste di modal Apps Staff:
  - [x] Tab 1: **Bahan Mentah** (`type: 'INGREDIENT'`).
  - [x] Tab 2: **Menu Masakan Jadi / Porsi Rusak** (`type: 'PRODUCT'`).
- [x] Integrasikan kamera PWA / WebRTC untuk menangkap **Foto Bukti Fisik** bahan busuk atau masakan gosong (`photoUrl`).
- [x] Tampilkan **Live Preview Kerugian HPP (Rp)** secara real-time berdasarkan kuantitas yang diinput staf.
- [x] Perluas pilihan alasan limbah dapur sesuai standar audit resto: *Gosong/Overcooked, Salah Buat Dapur, Trimming Kulit/Lemak, Basi/Busuk, Kadaluarsa, Tumpah, Sisa Tutup Toko*.

### Fase 4: Owner Mobile Quick-Approval Hub (Cuti & Kasbon)
- [x] Tambahkan deteksi hak akses Owner/Manager di Apps Staff:
  - `const isOwnerOrAdmin = ['owner', 'admin', 'manager'].includes(user?.role?.toLowerCase());`
- [x] Buat antarmuka **"Pusat Persetujuan (Quick-Approval Center)"** yang hanya muncul untuk Owner/Manager:
  - [x] **Badge Notifikasi Real-time**: Jumlah pengajuan izin sakit dan kasbon yang berstatus `Pending`.
  - [x] **Persetujuan Pengajuan Cuti / Izin Staf**:
    - Tampilkan nama staf, tanggal, alasan, dan tombol buka foto surat dokter.
    - Tombol aksi 1-klik: `✓ Setujui` (PATCH `/api/attendance/leaves/:id/status` status `Approved`) dan `✕ Tolak`.
  - [x] **Persetujuan Kasbon / Pinjaman Staf**:
    - Tampilkan nama staf, nominal kasbon, alasan pengajuan.
    - Tombol aksi 1-klik: `✓ Cairkan via Kas Owner` (POST `/api/employee-loans/:id/approve` source `KAS_OWNER`) dan `✕ Tolak`.
- [x] Pastikan isolasi tenant fail-closed pada seluruh endpoint approval.

### Fase 5: Ekstensi Fungsional Spesifik Vertikal
- [x] **Vertikal Bengkel (Mode Mekanik)**:
  - [x] Tab Khusus **"SPK Saya"**: Mengambil daftar work order pit yang ditugaskan ke ID mekanik login (`GET /api/bengkel/work-orders?boardOnly=true`).
  - [x] Tombol status progres pengerjaan servis: `Mulai Dikerjakan` -> `Menunggu Part` -> `Selesai Servis`.
  - [x] Widget **"Komisi Saya Hari Ini"**: Estimasi perolehan komisi jasa servis shift berjalan.
- [x] **Vertikal Retail & Toko Bangunan (Mode Helper & Driver)**:
  - [x] Fitur **"Cek Harga & Lokasi Rak"**: Integrasi barcode scanner via kamera smartphone helper toko.
  - [x] Tab Khusus **"Pengiriman Armada (DO)"**: Display lokasi rak dan informasi multi-satuan barang.

### Fase 6: Pengujian Multi-Tenant, Migrasi Vertikal & Zero-Error Build
- [x] Validasi isolasi multi-tenant:
  - [x] Pastikan mekanik Tenant A tidak bisa melihat SPK atau stok Tenant B.
  - [x] Pastikan approval Owner Tenant A tidak memengaruhi data Tenant B.
- [x] Uji transisi migrasi profil vertikal:
  - [x] Ubah profil tenant dari `CAFE` ke `BENGKEL` -> pastikan SOP otomatis berganti ke SOP bengkel dan tab stok berganti ke katalog produk tanpa cache tersangkut.
- [x] Validasi kompilasi kode:
  - [x] Frontend: `npm run build` / `npx tsc --noEmit` dengan **Zero Errors**.
  - [x] Backend: Integrasi endpoint teruji.
