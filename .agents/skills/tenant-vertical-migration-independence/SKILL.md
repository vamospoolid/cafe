---
name: tenant-vertical-migration-independence
description: >
  Standar arsitektur, isolasi multi-tenant, migrasi data lintas tenant,
  transisi vertikal (Kafe ke Bengkel & sebaliknya), eliminasi kebocoran cache
  lokal Dexie IndexedDB, backup/reset simetris, standardisasi redaksi terminologi,
  serta penguatan UX switching & onboarding.
---

# Standar Arsitektur Migrasi & Independensi Multi-Tenant serta Vertikal (Kafe vs Bengkel)

## 1. Latar Belakang & Masalah Arsitektur Utama

CodePOS beroperasi sebagai platform B2B Multi-Tenant SaaS yang melayani berbagai jenis vertikal bisnis (`businessType`: `CAFE`, `BENGKEL`, `RETAIL`, `LAUNDRY`). Berdasarkan audit mendalam, ditemukan 5 titik kelemahan sistemik yang mengancam isolasi data dan fleksibilitas migrasi:

```
┌────────────────────────────────────────────────────────────────────────┐
│             5 TITIK KERENTANAN ISOLASI & MIGRASI DATA                 │
├────────────────────────────────────────────────────────────────────────┤
│ 1. LEAKAGE OFFLINE STORAGE (Dexie IndexedDB):                          │
│    - getCachedProducts(), getCachedCategories() membaca seluruh data   │
│      tanpa scoping tenantId aktif.                                     │
│    - Pending offline orders berisiko tersinkron ke tenant yang salah   │
│      saat user berganti tenant di device yang sama.                   │
│                                                                        │
│ 2. ASIMETRI BACKUP & DISASTER RECOVERY:                                │
│    - Endpoint /api/database/backup hanya mengekspor tabel F&B          │
│    - Data WorkOrder, Kendaraan, Mekanik, Komisi Bengkel 100% HILANG    │
│      jika tenant Bengkel melakukan backup.                             │
│                                                                        │
│ 3. ASIMETRI RESET TRANSAKSI & FACTORY RESET:                           │
│    - /api/tenant-reset/transactions tidak menyentuh WorkOrder/SPK.     │
│    - /api/tenant-reset/full memicu error relasi foreign key pada part  │
│      bengkel dan hanya memiliki template awal F&B/Kafe.                │
│                                                                        │
│ 4. KETIADAAN ENGINE MIGRASI VERTIKAL (Kafe <-> Bengkel):               │
│    - Kolom businessType terkunci mati di tabel Tenant.                  │
│    - Tidak ada prosedur resmi jika tenant pivot usaha atau salah input │
│      saat registrasi awal.                                             │
│                                                                        │
│ 5. KEBOCORAN REDAKSI & UX BIAS KAFE:                                   │
│    - Seed kategori bengkel masih printerTarget: 'KITCHEN'.             │
│    - Password default QuickProvision kopi12345 & preset hanya F&B.     │
│    - Switcher tenant tidak menampilkan badge jenis vertikal outlet.    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prinsip Arsitektur Wajib (Zero Contamination)

### Aturan #1: Partisi Ketat Storage Lokal Browser (Dexie IndexedDB)
* Setiap pembacaan data cache offline (`cachedProducts`, `cachedCategories`, `cachedTables`, `cachedSettings`) **WAJIB** menyertakan filter `tenantId`.
* Saat pengguna beralih tenant (`switch-tenant`) atau logout, tabel cache offline katalog **WAJIB dibersihkan secara atomik** sebelum konteks baru dimuat.
* **Pre-Switch Offline Guard**: Jika tabel `pendingOrders` masih menyimpan transaksi offline yang belum tersinkronisasi, sistem **DILARANG** melakukan switch tanpa konfirmasi eksplisit dari pengguna.

### Aturan #2: Paritas Skema Backup & Reset Multi-Vertikal
* File snapshot backup JSON dan mekanisme restore **WAJIB simetris** mendukung seluruh entitas dari seluruh vertikal:
  * **Kafe**: `Order`, `OrderItem`, `Table`, `Ingredient`, `RecipeItem`, `KitchenChecklist`
  * **Bengkel**: `WorkOrder`, `WorkOrderPart`, `WorkOrderService`, `WorkOrderReturn`, `WorkOrderInvoice`, `Vehicle`, `ServiceType`, `MechanicProfile`, `CommissionPayout`
* Modul Reset Toko **WAJIB** mengenali jenis usaha tenant aktif (`businessType`). Reset transaksi pada tenant bengkel harus menghapus SPK & komisi, bukan hanya pesanan kasir F&B.

### Aturan #3: Dua Model Transisi Vertikal Resmi
Ketika pemilik bisnis memerlukan perubahan jenis vertikal:
1. **Model A: Clean Pivot / Re-branding (Migrasi Vertikal)**
   * Dijalankan melalui wizard terpandu dengan konfirmasi kata sandi owner.
   * Transaksi vertikal lama diarsipkan (`status: ARCHIVED`).
   * Master data lama dinonaktifkan/dibersihkan, lalu master data vertikal baru diinisialisasi secara atomik.
2. **Model B: Multi-Unit Expansion (Buka Cabang Beda Vertikal)**
   * Sistem mengarahkan owner untuk membuat **Tenant Baru** (bukan mengganti tenant lama).
   * User owner yang sama terhubung via `TenantMembership` terpisah sehingga kedua bisnis tetap berdiri independen tanpa percampuran pembukuan finansial.

---

## 3. Spesifikasi Perbaikan Backend

### A. Skema Ekspor Backup Simetris (`backend/src/routes/database.ts`)

Pada fungsi `exportPrismaJsonBackup`, tambahkan kueri untuk entitas bengkel:

```typescript
// Query simetris multi-vertikal
const [
  // Core & Kafe
  categories, products, tables, reservations, customers, pointLogs,
  orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
  ingredients, recipeItems, ingredientLogs, purchaseOrders,
  debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
  // Bengkel Vertical Entities
  workOrders, workOrderParts, workOrderServices, workOrderInvoices,
  vehicles, serviceTypes, mechanicProfiles, commissionPayouts
] = await Promise.all([
  prisma.category.findMany({ where: whereTenant }),
  prisma.product.findMany({ where: whereTenant }),
  prisma.table.findMany({ where: whereTenant }),
  prisma.reservation.findMany({ where: whereTenant }),
  prisma.customer.findMany({ where: whereTenant }),
  prisma.pointLog.findMany({ where: whereTenant }),
  prisma.order.findMany({ where: whereTenant }),
  prisma.orderItem.findMany({ where: isPlatformAdmin ? {} : { order: { tenantId: tenantId! } } }),
  prisma.cashFlow.findMany({ where: whereTenant }),
  prisma.attendance.findMany({ where: whereTenant }),
  prisma.settings.findMany({ where: whereTenant }),
  prisma.shift.findMany({ where: whereTenant }),
  prisma.supplier.findMany({ where: whereTenant }),
  prisma.ingredient.findMany({ where: whereTenant }),
  prisma.recipeItem.findMany({ where: isPlatformAdmin ? {} : { ingredient: { tenantId: tenantId! } } }),
  prisma.ingredientLog.findMany({ where: whereTenant }),
  prisma.purchaseOrder.findMany({ where: whereTenant }),
  prisma.debt.findMany({ where: whereTenant }),
  prisma.debtPayment.findMany({ where: whereTenant }),
  prisma.leaveRequest.findMany({ where: whereTenant }),
  prisma.shiftHandover.findMany({ where: whereTenant }),
  prisma.kitchenChecklist.findMany({ where: whereTenant }),
  // Bengkel
  prisma.workOrder.findMany({ where: whereTenant }),
  prisma.workOrderPart.findMany({ where: whereTenant }),
  prisma.workOrderService.findMany({ where: whereTenant }),
  prisma.workOrderInvoice.findMany({ where: whereTenant }),
  prisma.vehicle.findMany({ where: whereTenant }),
  prisma.serviceType.findMany({ where: whereTenant }),
  prisma.mechanicProfile.findMany({ where: whereTenant }),
  prisma.commissionPayout.findMany({ where: whereTenant })
]);
```

### B. Reset Transaksi & Factory Reset Simetris (`backend/src/routes/tenantReset.ts`)

Perbarui transaksi reset agar membersihkan entitas bengkel secara aman:

```typescript
// Di dalam POST /api/tenant-reset/transactions:
const tenantCondition = { tenantId };

// Bersihkan entitas bengkel
await tx.commissionPayout.deleteMany({ where: tenantCondition });
await tx.workOrderInvoice.deleteMany({ where: tenantCondition });
await tx.workOrderReturnItem.deleteMany({ where: { return: { tenantId } } });
await tx.workOrderReturn.deleteMany({ where: tenantCondition });
await tx.workOrderPart.deleteMany({ where: tenantCondition });
await tx.workOrderService.deleteMany({ where: tenantCondition });
const deletedWorkOrders = await tx.workOrder.deleteMany({ where: tenantCondition });

// Reset pending commission pada profil mekanik
await tx.mechanicProfile.updateMany({
  where: tenantCondition,
  data: { pendingCommission: 0 }
});
```

Dan sediakan template awal khusus bengkel pada `STARTER_TEMPLATES`:
* `BENGKEL_MOTOR_UMUM`
* `BENGKEL_MOBIL_DAN_AC`
* `TOKO_BAN_DAN_PELUMAS`

### C. Eliminasi Redaksi & Kategori Bawaan Bengkel (`backend/src/routes/auth.ts`)

Ganti inisialisasi kategori awal bengkel saat pendaftaran:
```typescript
// SALAH:
{ tenantId: tenant.id, name: 'Oli & Pelumas Mesin', printerTarget: 'KITCHEN' }

// BENAR:
{ tenantId: tenant.id, name: 'Oli & Pelumas Mesin', printerTarget: 'NONE' },
{ tenantId: tenant.id, name: 'Suku Cadang Fast Moving', printerTarget: 'NONE' },
{ tenantId: tenant.id, name: 'Ban & Kaki-Kaki', printerTarget: 'NONE' },
{ tenantId: tenant.id, name: 'Aki & Kelistrikan', printerTarget: 'NONE' }
```

---

## 4. Spesifikasi Perbaikan Frontend & UX

### A. Partisi Tenant pada Dexie DB (`frontend/src/db/offlineDb.ts`)

```typescript
// getCachedProducts WAJIB menerima atau mendeteksi tenantId aktif
async getCachedProducts(tenantId?: string): Promise<CachedProduct[]> {
  let collection = this.cachedProducts.toCollection();
  if (tenantId) {
    collection = this.cachedProducts.where('tenantId').equals(tenantId);
  }
  const list = await collection.toArray();
  return list.map(p => ({
    ...p,
    price: Number(p.sellPrice ?? p.price ?? 0),
    sellPrice: Number(p.sellPrice ?? p.price ?? 0)
  }));
}
```

### B. Penguatan Switch Tenant UX (`frontend/src/components/TenantOutletSwitcher.tsx`)

1. **Badge Vertikal Visual**:
   * Kafe: Lencana oranye / kopi (`Kafe & Resto`)
   * Bengkel: Lencana biru / obeng (`Bengkel`)
   * Retail: Lencana ungu / keranjang (`Retail`)
2. **Pre-Switch Offline Verification**:
   ```typescript
   const pendingCount = await offlineDb.getAllPendingOrdersCount();
   if (pendingCount > 0) {
     const confirmSwitch = window.confirm(
       `Peringatan: Ada ${pendingCount} pesanan offline yang belum tersinkronisasi. Beralih bisnis sekarang berisiko menunda sinkronisasi. Lanjutkan?`
     );
     if (!confirmSwitch) return;
   }
   ```
3. **Pembersihan Cache Sebelum Reload**:
   ```typescript
   await offlineDb.cachedProducts.clear();
   await offlineDb.cachedCategories.clear();
   await offlineDb.cachedTables.clear();
   ```

### C. Vertikal Support pada Quick Provisioning (`frontend/src/components/QuickProvisionModal.tsx`)

1. Tambahkan pemilih vertikal pada Step 1:
   * Pilihan: **Kafe / Kedai Kopi / Resto** vs **Bengkel Motor / Mobil**
2. Jika memilih Bengkel:
   * Sembunyikan istilah "Menu", ganti dengan "Suku Cadang & Jasa Servis".
   * Sediakan preset otomotif (Oli mesin, servis karbu/injeksi, kampas rem, ban).
   * Ubah password default dari `kopi12345` menjadi password aman acak (contoh: `Bengkel2026!`).
   * Sembunyikan toggle pembuatan gambar makanan AI, ganti dengan template kartu jasa.

---

## 5. Matriks Standardisasi Redaksi & Terminologi

Gunakan tabel ini sebagai acuan copywriting di seluruh antarmuka dan API:

| Konteks Penggunaan | Terminologi Kafe | Terminologi Bengkel | Terminologi Netral / SaaS |
|---|---|---|---|
| **Pusat Transaksi** | Pesanan / Order Kasir | SPK / Work Order Pit | Transaksi Operasional |
| **Katalog Penjualan** | Daftar Menu Makanan & Minuman | Suku Cadang, Pelumas & Jasa | Katalog Produk & Layanan |
| **Stok & HPP** | Bahan Baku (gram/ml) & Resep | Stok Sparepart (Pcs) & Harga Beli | Inventaris & Beban Pokok |
| **Pemberian Layanan** | Nomor Meja / Area Dine-In | Pit / Stall Servis & Nomor Polisi | Posisi / Lokasi Layanan |
| **Pekerja Teknis** | Koki, Barista, Waiter | Mekanik, Teknisi, Toolman | Staf Pelaksana / Karyawan |
| **Dokumen Struk** | Struk Meja & Tiket Dapur (KOT) | Struk Kasir & Lembar Kerja SPK | Bukti Transaksi Resmi |
| **Notifikasi Reset** | "Menu & resep tetap aman" | "Sparepart & jasa tetap aman" | "Master data produk tetap aman" |
| **Arus Kas Belanja** | Belanja Bahan Pangan / Sayur | Belanja Sparepart / Drum Oli | Belanja Pasokan Operasional |

---

## 6. Protokol Validasi & Pengujian

Sebelum merilis perubahan terkait multi-tenant dan migrasi:
1. **Uji Isolasi Dexie**: Login ke Tenant A (Kafe), unduh katalog offline. Logout dan login ke Tenant B (Bengkel). Matikan koneksi internet. Pastikan katalog Kafe tidak muncul di POS Bengkel.
2. **Uji Backup Bengkel**: Buat SPK dan input mekanik di Tenant Bengkel. Ekspor backup JSON. Buka file JSON dan pastikan objek `workOrders`, `vehicles`, dan `mechanicProfiles` terisi dengan benar.
3. **Uji Reset Transaksi Bengkel**: Eksekusi reset transaksi pada Tenant Bengkel. Pastikan `workOrder` terhapus, komisi mekanik kembali ke nol, namun master data `product` sparepart dan `serviceType` tidak terhapus.
4. **Uji Pendaftaran Cepat**: Lakukan provisioning tenant Bengkel via wizard baru. Pastikan tidak ada kategori dengan `printerTarget: 'KITCHEN'`.
