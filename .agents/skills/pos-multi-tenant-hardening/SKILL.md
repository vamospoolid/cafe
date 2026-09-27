---
name: pos-multi-tenant-hardening
description: Panduan arsitektur, aturan keamanan multi-tenant, penanganan konkurensi tinggi (high concurrency), manajemen koneksi database, dan isolasi real-time Socket.IO untuk sistem POS multi-kafe.
---

# Panduan & Standar Pengerasan Multi-Tenant & Konkurensi POS (Multi-Tenant Hardening)

Dokumen ini adalah standar operasional dan panduan arsitektur untuk memastikan sistem Point of Sale (POS) dan Kitchen Display System (KDS) mampu melayani banyak kafe/tenant (10+ hingga ratusan) secara bersamaan pada kondisi transaksi padat (*peak hours*) tanpa kebocoran data (*data leak*), benturan nomor transaksi (*race condition*), stok minus (*overselling*), atau gangguan stabilitas server.

---

## 1. Prinsip Utama: Arsitektur Multi-Tenant

Setiap entitas bisnis di sistem (kecuali master konfigurasi platform global) terikat pada **`tenantId`** dan jika relevan **`outletId`**.

### Model yang Wajib Terisolasi:
- **Transaksi & Kasir**: `Order`, `OrderItem`, `Shift`, `CashFlow`, `Debt`, `DebtPayment`
- **Operasional Dapur & Meja**: `Table`, `Reservation`, `KitchenChecklist`, `ShiftHandover`
- **Inventori & Resep**: `Product`, `Category`, `Ingredient`, `IngredientLog`, `RecipeItem`, `WasteLog`, `Supplier`, `PurchaseOrder`
- **Pelanggan & Promo**: `Customer`, `PointLog`, `Voucher`
- **Karyawan & Konfigurasi**: `Settings`, `Attendance`, `EmployeeLoan`

---

## 2. Standar Manajemen Koneksi Database (Prisma Singleton)

### ⛔ Larangan Keras:
**DILARANG KERAS** menulis `const prisma = new PrismaClient();` di dalam file router, controller, middleware, ataupun service!
*Setiap instansiasi `new PrismaClient()` membuka koneksi pool baru ke PostgreSQL (10-20 koneksi). Jika terdapat 30+ file route, server akan membuka ratusan koneksi dan menyebabkan database crash (`FATAL: too many connections`).*

### ✅ Standar yang Benar:
Gunakan satu file instansiasi terpusat di `backend/src/db.ts`:

```typescript
// backend/src/db.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = global.prismaGlobal || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export default prisma;
```

Semua file router/service wajib mengimpor dari file tersebut:
```typescript
import prisma from '../db';
```

---

## 3. Aturan Query & Isolasi Data (`tenantId`)

### 3.1. Pembacaan Data (`findMany`, `findFirst`, `count`)
Setiap query pembacaan data wajib menyertakan `tenantId`:

```typescript
// ❌ SALAH: Mengambil data tanpa batas tenant
const orders = await prisma.order.findMany({
  where: { status: 'Paid' }
});

// ✅ BENAR: Terikat ke tenant user yang sedang login
const tenantId = req.user?.tenantId;
const orders = await prisma.order.findMany({
  where: { 
    tenantId,
    status: 'Paid',
    deletedAt: null 
  }
});
```

### 3.2. Pembuatan Data Baru (`create`)
Setiap pembuatan data baru wajib menyematkan `tenantId` dan `outletId`:

```typescript
// ✅ BENAR: Selalu simpan tenantId & outletId
const order = await tx.order.create({
  data: {
    tenantId,
    outletId: req.user?.outletId || null,
    orderNumber,
    // ...field lainnya
  }
});
```

### 3.3. Endpoint Publik (QR Dine-In / Self-Order)
Endpoint yang diakses tanpa login (misal tamu scan QR meja) wajib menerima parameter identitas tenant (berupa `tenantSlug` atau `tenantId`):

```typescript
// GET /api/products/public?tenant=mukiramen&table=5
router.get('/public', async (req: Request, res: Response) => {
  const { tenant: tenantSlug } = req.query;
  const tenant = await prisma.tenant.findUnique({ where: { slug: String(tenantSlug) } });
  if (!tenant) return res.status(404).json({ error: 'Kafe tidak ditemukan' });

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, status: 'Aktif', deletedAt: null }
  });
  res.json(products);
});
```

---

## 4. Pencegahan Race Condition & Benturan Transaksi

### 4.1. Pembuatan Nomor Order yang Aman (Thread-Safe Order Number)
Format nomor transaksi harus menyertakan kode unik tenant/outlet untuk menghindari tabrakan antar-kafe:
- **Format**: `ORD-{TENANT_CODE}-{YYYYMMDD}-{COUNTER}`
  - Contoh: `ORD-MUK-20260920-0001`
- **Mekanisme Pembangkitan**:
  Gunakan tabel `Counter` atau atomic increment berbasis transaksi:
  ```sql
  INSERT INTO "OrderCounter" ("tenantId", "date", "sequence")
  VALUES ($1, $2, 1)
  ON CONFLICT ("tenantId", "date")
  DO UPDATE SET "sequence" = "OrderCounter"."sequence" + 1
  RETURNING "sequence";
  ```
  *Hindari `findFirst` lalu `+1` karena 2 kasir yang klik bersamaan akan menghasilkan nomor yang identik.*

### 4.2. Pengurangan Stok Atomik (Anti-Overselling)
Jangan lakukan validasi stok dan pemotongan stok di dua langkah terpisah jika tidak dikunci:

```typescript
// ❌ SALAH: Read-then-write rentan race condition
const prod = await tx.product.findUnique({ where: { id } });
if (prod.stock < qty) throw new Error('Habis');
await tx.product.update({ where: { id }, data: { stock: { decrement: qty } } });

// ✅ BENAR: Atomic check & update langsung di SQL
const updated = await tx.$executeRaw`
  UPDATE "Product"
  SET "stock" = "stock" - ${qty}
  WHERE "id" = ${productId} AND "stock" >= ${qty}
`;
if (updated === 0) {
  throw new Error(`Stok menu "${item.name}" tidak mencukupi untuk jumlah yang diminta.`);
}
```

Hal yang sama berlaku untuk bahan baku resep:
```typescript
const updatedIng = await tx.$executeRaw`
  UPDATE "Ingredient"
  SET "stock" = "stock" - ${usedQty}
  WHERE "id" = ${recipe.ingredientId} AND "stock" >= ${usedQty}
`;
```

---

## 5. Isolasi Real-Time Notifikasi (Socket.IO Room Scoping)

### ⛔ Larangan Keras:
**DILARANG KERAS** memanggil `io.emit(...)` untuk event bisnis operasional kafe (seperti pesanan baru, perubahan status dapur, tutup shift, buka meja).
*`io.emit` akan membunyikan alarm dan mengirim data pesanan ke seluruh kafe yang terhubung ke server.*

### ✅ Standar yang Benar:
Semua broadcast harus dikirim ke kamar (Room) kafe yang bersangkutan:

```typescript
import { emitToTenant, emitToOutlet } from '../index';

// ✅ Kirim hanya ke perangkat kafe terkait
emitToTenant(tenantId, 'order:new', {
  orderId: order.id,
  orderNumber: order.orderNumber,
  tableNo: order.table?.tableNo
});

// ✅ Untuk perubahan spesifik outlet (KDS Dapur / Bar)
emitToOutlet(outletId, 'kds:ticket_updated', { orderId: order.id, status: 'Cooking' });
```

Pada sisi koneksi socket (`io.on('connection')`), pastikan socket bergabung ke room berdasarkan token autentikasi atau handshake:
`socket.join(`tenant:${tenantId}`);`
`socket.join(`outlet:${outletId}`);`

---

## 6. Integritas Rekonsiliasi Kasir & Shift (Z-Report / X-Report)

1. **Pengecekan Shift Aktif Kasir**:
   Wajib memfilter berdasarkan `tenantId` dan `userId` (atau outlet):
   ```typescript
   const activeShift = await prisma.shift.findFirst({
     where: { 
       tenantId,
       userId,
       status: 'Open' 
     }
   });
   ```
2. **Kalkulasi Saldo Akhir Sistem**:
   Semua query `order`, `cashFlow`, dan `debtPayment` pada saat tutup shift WAJIB menyertakan `tenantId`:
   ```typescript
   const orders = await prisma.order.findMany({
     where: {
       tenantId,
       status: 'Paid',
       OR: [
         { paidAt: { gte: shift.waktuBuka, lte: waktuTutup } },
         { paidAt: null, createdAt: { gte: shift.waktuBuka, lte: waktuTutup } }
       ]
     }
   });
   ```

---

## 7. Keamanan Otentikasi: PIN & GPS

1. **Ganti Kasir Cepat (`/switch-pin`)**:
   Pencarian PIN wajib dibatasi pada keanggotaan tenant yang sedang aktif:
   ```typescript
   const user = await prisma.user.findFirst({
     where: {
       pin,
       status: 'Aktif',
       memberships: { some: { tenantId, status: 'ACTIVE' } }
     }
   });
   ```
2. **Geofencing GPS Absensi**:
   Koordinat toko (`storeLatitude`, `storeLongitude`, `gpsRadiusMeters`) wajib dibaca dari `Settings` milik `tenantId` pengguna, bukan `findFirst()` acak.

---

## 8. Checklist Verifikasi (Definition of Done)

Sebelum kode di-merge atau dirilis ke produksi:
- [ ] Tidak ada `new PrismaClient()` selain di file `src/db.ts`.
- [ ] Semua query `Order`, `Shift`, `Product`, `Category`, `Customer`, `Settings`, dll. memiliki filter `tenantId`.
- [ ] Tidak ada `io.emit()` telanjang untuk event tenant; semua memakai `emitToTenant` atau `emitToOutlet`.
- [ ] Generator nomor order menggunakan identifier tenant/outlet.
- [ ] Pengurangan stok memiliki proteksi nilai minus (*stock guard*).
- [ ] Build backend (`npx tsc --noEmit`) dan build frontend (`npm run build`) lolos dengan 0 error.
