# Checklist & TODO: Phase 9 — SaaS Dynamic Multi-Tenant Branding, Reports & APK Synthesis

Dokumen ini memuat daftar tugas terperinci untuk membersihkan seluruh sisa kebocoran identitas dan branding (nama toko, alamat, logo, struk, ekspor PDF/Excel, dan kompilasi APK):
1. **Sektor Backend Settings**: Auto-seed dari profil `Tenant` saat onboarding / first access.
2. **Sektor Pelaporan Dokumen PDF**: Mengganti 15+ fungsi `pdfGenerator.ts` agar 100% dinamis berjenjang (*zero fallback to Muki Ramen*).
3. **Sektor Ekspor Excel**: Menghapus seluruh nama file hardcoded dan label divisi Muki Ramen pada `excelGenerator.ts`.
4. **Sektor Struk Kasir & Printer**: Menghapus fallback hardcoded pada `ReceiptPrinter.tsx` dan `printerBluetooth.ts`.
5. **Sektor Mobile White-Label APK**: Memperbaiki `generate_branded_apk.js` agar membaca settings per tenant dan mendukung unduh logo remote.

---

## Status: ✅ COMPLETED — Seluruh Tugas Selesai, Terverifikasi 100% (43/43 Tests Passing)

---

## 📌 Checklist Tugas - Phase 9

### 1. Backend Settings & Onboarding Harmonization
- [x] `backend/src/routes/settings.ts`:
  - [x] L50-65 (`GET /public`): Hapus fallback `storeName || 'MUKI RAMEN'` dan logo `/logo-muki-ramen.png` (Ganti default netral `CodePOS Platform` & `/logo.png`).
  - [x] L81-98 (`GET /` auto-create): Auto-create settings mengambil data riil dari `tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })` & `outlet`. Zero Sulbar/Muki fallback.
- [x] `backend/src/routes/fastProvisioning.ts`:
  - [x] Hasil resolve Google Maps (`name`, `address`, `latitude`, `longitude`, `logoUrl`, `phone`) langsung terinjeksi ke `Settings` dan `Outlet` saat atomic execute `/execute`.
- [x] `backend/src/routes/manifest.ts`:
  - [x] Menghapus kebocoran icon `/logo-muki-ramen.png` pada PWA manifest icons array. Menggunakan dynamic `logoUrl`.

### 2. Sektor Pelaporan PDF (`frontend/src/utils/pdfGenerator.ts`)
- [x] Ganti seluruh fallback logo hardcoded (16 kemunculan) dengan dynamic monogram inisial nama toko atau accent bar netral.
- [x] Ganti seluruh fallback nama toko hardcoded:
  - [x] `settings?.storeName || 'MUKI RAMEN'` $\rightarrow$ `settings?.storeName || 'KAFE & RESTORAN'`
- [x] Ganti seluruh fallback alamat Sidorejo Wonomulyo Sulbar $\rightarrow$ `settings?.address || ''`
- [x] Ganti tanda tangan statis `Owner Muki Ramen` $\rightarrow$ `Owner ${storeName}` di seluruh laporan (Laba Rugi, Buku Kas, Matriks Bonus, Stok Gudang, Inbound, PO, dan Shift Settlement).
- [x] Perbaiki nama file download PDF agar menyertakan slug/nama tenant aktif (`Laporan_Bagi_Hasil_[Store]`, `Matriks_Bonus_[Store]`, `Laporan_Stok_Gudang_[Store]`).

### 3. Sektor Ekspor Excel (`frontend/src/utils/excelGenerator.ts`)
- [x] Ganti nama toko dan alamat hardcoded di seluruh sheet header.
- [x] Ubah nama file ekspor agar dinamis berdasarkan slug/nama tenant (`Laporan_Bagi_Hasil_[StoreName]_[Dates].xlsx`, dll).
- [x] Netralisasi label divisi bagi hasil:
  - [x] `'Muki Ramen (Food)'` $\rightarrow$ `'Divisi Makanan (Kitchen)'`
  - [x] `'Muki Drink (Bar)'` $\rightarrow$ `'Divisi Minuman (Bar)'`
  - [x] `'Hak PJ Muki Ramen'` $\rightarrow$ `'Hak Pengelola Dapur'`
  - [x] `'Hak PJ Muki Drink'` $\rightarrow$ `'Hak Pengelola Bar'`

### 4. Sektor Struk Kasir Layar & Printer Thermal
- [x] `frontend/src/components/ReceiptPrinter.tsx`: Netralisasi `{storeSettings?.storeName || 'KAFE & RESTORAN'}`.
- [x] `frontend/src/utils/printerBluetooth.ts`: Netralisasi header dan nama toko printer bluetooth.
- [x] `frontend/src/components/CheckoutModal.tsx`: Netralisasi Bluetooth receipt header `posContext?.settings?.storeName || 'KAFE & RESTORAN'`.
- [x] `frontend/src/components/PrintQRModal.tsx` & `SplitPrintModal.tsx`: Netralisasi nama toko pada cetak QR meja dan split thermal.
- [x] `frontend/src/components/WarehouseView.tsx`: Netralisasi subtitle dan PDF export params.
- [x] `frontend/src/components/ReportView.tsx`: Netralisasi seluruh tab akuntansi, bagi hasil divisi, dan parameter ekspor.
- [x] `frontend/src/components/SettingsView.tsx`: Default state kosong, netralisasi placeholder URL, wifi, footer, dan label bagi hasil.
- [x] `frontend/src/components/DineInView.tsx`: Self-Order QR customer interface mengambil branding dinamis (`storeBranding.storeName`).
- [x] `frontend/src/components/Layout.tsx`: Sidebar logo default `/logo.png`, storeName default `CodePOS`.

### 5. Sektor Kompilasi APK Android Branded (`scripts/generate_branded_apk.js`)
- [x] Kunci query settings per tenant: `where: { tenantId: tenant.id }` (mencegah APK tenant lain tertimpa pengaturan tenant pertama di database).
- [x] Helper pengunduhan logo remote: Mengunduh logo eksternal (`http://` atau `https://` dari Google Maps) ke file sementara `release/temp_logo_${slug}.png` sebelum pemrosesan Mipmaps.
- [x] Default logo fallback netral (`android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`).

### 6. Automated Testing & Verifikasi Regresi
- [x] Buat file test `backend/scripts/test_phase9_branding_docs_and_apk.js`:
  1. Static Code Audit: 0 kata 'logo-muki-ramen', 'Jl. Kesadaran', atau 'Muki_Ramen' di laporan PDF & Excel.
  2. Dynamic Public Settings: GET /api/settings/public netral tanpa hardcoded Muki fallback.
  3. Auto-seed Settings: Tenant baru meng-generate settings dengan nama & logo riil tenant.
  4. Excel Department Labels: Divisi Makanan & Minuman 100% netral SaaS.
  5. APK Resolver: Memverifikasi `resolveTenantInfo('vamos')` terisolasi ketat ke tenant target.
- [x] Jalankan test suite Phase 9: **5/5 PASSED**.
- [x] Jalankan regresi lengkap Phase 1-8: **38/38 PASSED**.
- [x] Total Target Gabungan: **43/43 PASSED (100%)**.
