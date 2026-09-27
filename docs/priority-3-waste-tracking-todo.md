# Prioritas 3: Waste & Spoilage Tracking (Pencatat Bahan Baku Basi/Rusak & HPP Loss)

## 📋 Ringkasan & Tujuan
Fitur pencatatan dan analisis **Food Waste & Spoilage** untuk mencegah kebocoran HPP restoran/kafe dengan mencatat bahan baku mentah yang busuk/kadaluarsa serta menu masakan yang gosong/salah buat, menghitung nilai rupiah kerugian HPP riil, dan menyajikan analisis rasio waste terhadap omset penjualan.

---

## 📋 Status & Progres Todo List

- [x] **Fase 1: Database Model & Schema Enhancement (Waste Management)**
  - [x] Tambahkan model `WasteLog` di `schema.prisma` (support waste bahan baku mentah & porsi masakan jadi, rincian alasan, HPP loss cost, user snapshot, dan tenant scoping).
  - [x] Update relasi di `Tenant`, `Outlet`, `Ingredient`, `Product`, dan `User`.
  - [x] Sinkronisasi database menggunakan Prisma (`npx prisma db push --accept-data-loss; npx prisma generate`).

- [x] **Fase 2: Backend Waste Management & Analytics Engine**
  - [x] Buat router `backend/src/routes/waste.ts` untuk manajemen waste terdedikasi.
  - [x] Endpoint `POST /api/waste`: Pencatatan waste bahan/menu, kalkulasi HPP loss otomatis, pemotongan stok/resep riil, dan trigger audit log & socket event.
  - [x] Endpoint `GET /api/waste/analytics`: Hitung total kerugian HPP, rasio waste terhadap omset penjualan (Waste-to-Sales Ratio), breakdown per alasan (Busuk, Gosong, Expired, Trimming), dan top 5 item paling boros.
  - [x] Endpoint `GET /api/waste/logs`: Riwayat log waste dengan pagination, filter rentang tanggal, filter kategori, dan filter alasan.
  - [x] Endpoint `DELETE /api/waste/:id`: Pembatalan / rollback log waste oleh Supervisor.
  - [x] Registrasikan router `/api/waste` ke `backend/src/index.ts`.

- [x] **Fase 3: Kitchen Quick-Action Waste Logger Modal (Frontend UI)**
  - [x] Buat komponen `WasteLogModal.tsx` dengan antarmuka cepat & touch-friendly untuk staf dapur / barista.
  - [x] Tab selector: "Bahan Baku Mentah" vs "Menu Porsi Masakan Jadi".
  - [x] Stepper input kuantitas (+0.1, +0.5, +1, +5) dengan label satuan dinamis (kg, gr, porsi, pcs, ml).
  - [x] Quick chip pilihan alasan: Basi/Busuk, Kadaluarsa, Gosong/Overcooked, Salah Masak, Tumpah/Jatuh, Trimming, Sisa Tutup Toko.
  - [x] Live preview estimasi kerugian HPP (Rp) sebelum submit.

- [x] **Fase 4: Waste & Spoilage Analytics Hub (Frontend Dashboard)**
  - [x] Buat / integrasikan antarmuka Waste Hub di `IngredientView.tsx` dan modul laporan.
  - [x] Tampilkan 4 KPI Cards: Total Kerugian HPP (Rp), Rasio Food Waste vs Omset (%), Total Insiden Waste, dan Item Paling Bocor.
  - [x] Grafik visualisasi distribusi alasan waste dan top 5 item kerugian terbesar.
  - [x] Tabel interaktif riwayat waste dengan filter tanggal & pencarian.
  - [x] Fitur Export PDF Laporan Audit Waste & Kerugian HPP.

- [x] **Fase 5: Pengujian & Validasi End-to-End**
  - [x] Buat script pengujian simulasi `backend/test_waste_tracking.js` (uji waste bahan mentah, waste menu masakan, kalkulasi HPP, analitik rasio, dan audit log).
  - [x] Validasi build TypeScript frontend (`npm run build` / `npx tsc --noEmit`) & backend (`npx tsc --noEmit`).
