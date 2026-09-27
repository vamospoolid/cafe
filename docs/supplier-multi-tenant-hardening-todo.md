# TODO List: Penguatan Keamanan & Independensi Multi-Tenant Supplier (Supplier Hardening)

Dokumen pelacakan komprehensif untuk penguatan isolasi antar-tenant pada entitas **Supplier**, eliminasi celah *Nested Foreign Key Injection* pada Bahan Baku & Gudang, penyeragaman pembacaan konteks tenant, serta penanganan referensi data terhapus.

---

## 📋 DAFTAR FASE & ITEM TUGAS

### Fase 1: Standarisasi Konteks Tenant & Perbaikan Rute Supplier Utama
- [x] **1.1. Penyeragaman Context Extraction di `POST /api/suppliers`**
  - Mengganti `(req as any).user?.tenantId` dengan `getTenantId(req)!` di [`backend/src/routes/suppliers.ts`](file:///c:/ADATA/codepos/backend/src/routes/suppliers.ts).
  - Memastikan platform admin / impersonasi token dengan header `x-tenant-id` tidak menghasilkan record supplier liar (`tenantId: null`).
- [x] **1.2. Proteksi & Audit Relasi pada Soft-Delete Supplier (`DELETE /api/suppliers/:id`)**
  - Tambahkan pengecekan jumlah bahan baku aktif (`Ingredient`) yang masih menautkan supplier tersebut.
  - Dokumentasikan status referensi agar integritas data katalog bahan baku tetap terjaga saat supplier masuk ke keranjang sampah.
  - Catat log audit ke `AuditLogger` saat supplier dipindahkan ke Recycle Bin.

### Fase 2: Eliminasi Celah *Nested Foreign Key Injection* di Bahan Baku & Gudang
- [x] **2.1. Validasi Kepemilikan Supplier di `POST /api/ingredients`**
  - Pastikan input `supplierId` divalidasi kepemilikannya terhadap `tenantId` aktif dan berstatus `deletedAt: null` di [`backend/src/routes/ingredients.ts`](file:///c:/ADATA/codepos/backend/src/routes/ingredients.ts).
  - Tolak request (HTTP 400) jika supplier milik tenant lain atau sudah dihapus.
- [x] **2.2. Validasi Kepemilikan Supplier di `PUT /api/ingredients/:id`**
  - Terapkan validasi `supplierId` yang sama saat pengeditan bahan baku.
- [x] **2.3. Validasi Kepemilikan Supplier di Inbound Gudang (`POST /api/warehouse/inbound`)**
  - Validasi kepemilikan `supplierId` terhadap `tenantId` aktif di [`backend/src/routes/warehouse.ts`](file:///c:/ADATA/codepos/backend/src/routes/warehouse.ts).
  - Cegah pencatatan faktur barang masuk ke supplier silang antar-tenant.

### Fase 3: Skrip Uji Verifikasi Otomatis (Automated Penetration & Security Tests)
- [x] **3.1. Pembuatan Skrip Uji Integrasi & Keamanan Multi-Tenant**
  - Buat skrip uji [`backend/scripts/test_supplier_tenant_hardening.js`](file:///c:/ADATA/codepos/backend/scripts/test_supplier_tenant_hardening.js).
  - Kasus Uji 1: Pembuatan supplier mandiri di Tenant A & Tenant B dengan nama identik (memastikan tidak terjadi tabrakan unik global).
  - Kasus Uji 2: Pengujian *Direct IDOR* (`GET`, `PUT`, `DELETE` supplier Tenant A oleh Tenant B ditolak 404/Forbidden).
  - Kasus Uji 3: Pengujian *Nested Foreign Key Injection* (Tenant B mencoba membuat bahan baku dengan `supplierId` Tenant A -> harus ditolak 400).
  - Kasus Uji 4: Pengujian *Nested Foreign Key Injection* pada Inbound Gudang (Tenant B mencoba inbound dengan `supplierId` Tenant A -> harus ditolak 400).
  - Kasus Uji 5: Pemulihan dan penghapusan permanen di Recycle Bin terisolasi penuh per tenant.
  - Kasus Uji 6: Pencegahan penautan supplier yang sudah berstatus soft-delete ke bahan baku baru.
- [x] **3.2. Eksekusi & Validasi Hasil Pengujian**
  - Jalankan skrip uji dan pastikan seluruh skenario lolos (PASS 6/6 - 100%).

---

## 🛡️ MATRIKS VERIFIKASI KEAMANAN

| Vektor Serangan / Titik Celah | Sebelum Hardening | Target Setelah Hardening | Status |
| :--- | :--- | :--- | :--- |
| **Nested Supplier Injection di Ingredient** | ⚠️ Terbuka: ID supplier Tenant A bisa ditautkan ke Ingredient Tenant B | 🔒 Dicegat: Validasi `findFirst({ id, tenantId, deletedAt: null })` -> HTTP 400 | ✅ VERIFIED & SECURED |
| **Nested Supplier Injection di Warehouse Inbound** | ⚠️ Terbuka: Inbound gudang Tenant B bisa mengaitkan supplier Tenant A | 🔒 Dicegat: Validasi `findFirst({ id, tenantId, deletedAt: null })` -> HTTP 400 | ✅ VERIFIED & SECURED |
| **Inconsistent `tenantId` di `POST /api/suppliers`** | ⚠️ Rawan: Menggunakan `req.user?.tenantId`, mengabaikan `x-tenant-id` | 🔒 Aman: Menggunakan `getTenantId(req)!` yang fail-closed | ✅ VERIFIED & SECURED |
| **Soft Delete Supplier dengan Bahan Baku Terhubung** | ⚠️ Unhandled: Bahan baku tetap menunjuk supplier di sampah | 🔒 Aman: Deteksi dependensi & informasi jelas via `activeIngredientsCount` | ✅ VERIFIED & SECURED |
