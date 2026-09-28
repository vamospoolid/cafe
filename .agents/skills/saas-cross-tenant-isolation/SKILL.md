---
name: saas-cross-tenant-isolation
description: >
  Standar arsitektur & pola perbaikan menyeluruh untuk isolasi data antar tenant di CodePOS SaaS.
  Mencakup 5 kategori pola kebocoran:
  1. WebSocket/Real-Time Broadcast Leaks (io.emit vs emitToTenant)
  2. Root Middleware & Route Hardcoded Fallback (tenant-default-muki)
  3. Fail-Open Query & Missing Tenant Scoping (orders, cashflow, attendance, debts, dll)
  4. Global Data Leaks via OR tenantId null
  5. IDOR (Insecure Direct Object Reference) pada detail & mutasi objek
---

# SKILL: SaaS Cross-Tenant Data & Real-Time Isolation

## Latar Belakang & Prinsip Utama
Dalam arsitektur SaaS multi-tenant dengan single database shared schema:
- **Setiap tenant adalah entitas independen dan terisolasi total.**
- **Prinsip Fail-Closed**: Setiap query, mutasi, atau broadcast event WAJIB membawa `tenantId`. Jika context tenant kosong/hilang, sistem **HARUS MENOLAK** (HTTP 400 `MISSING_TENANT_CONTEXT`), BUKAN melakukan full-table scan atau fallback ke tenant default.
- **Prinsip Room Isolation**: Setiap event Socket.IO hanya boleh dikirim ke room tenant spesifik (`tenant:${tenantId}`) menggunakan `emitToTenant()`, TIDAK PERNAH menggunakan `io.emit()`.

---

## 🔴 POLA 1: WebSocket / Real-Time Leakage (io.emit vs emitToTenant)

### Masalah
Menggunakan `io.emit(event, data)` akan mengirimkan payload pesan ke **seluruh socket klien yang sedang terhubung di server tanpa memandang tenant**.
Akibatnya:
- Notifikasi order baru, status meja, dan KDS dapur kafe A muncul di layar kasir kafe B.
- Mutasi stok gudang dan pencatatan limbah (waste) kafe A ter-broadcast ke kafe B.

### Pola Salah (BOCOR):
```typescript
// BERBAHAYA: Broadcast ke semua browser di server
io.emit('warehouse:stock_updated', { type: 'INBOUND', data: inbound });
io.emit('order:paid', { tableId });
io.emit('product:sold_out', { soldOutProducts });
```

### Pola Benar (TERISOLASI):
```typescript
import { emitToTenant } from '../index';

// AMAN: Hanya klien dalam room tenant terkait yang menerima event
if (tenantId) {
  emitToTenant(tenantId, 'warehouse:stock_updated', { type: 'INBOUND', data: inbound });
  emitToTenant(tenantId, 'order:paid', { tableId });
  emitToTenant(tenantId, 'product:sold_out', { soldOutProducts });
}
```

---

## 🔴 POLA 2: Root Middleware & Route Hardcoded Fallback

### Masalah
Menuliskan fallback seperti `req.user?.tenantId || 'tenant-default-muki'` menyebabkan pengguna dengan token yang tidak lengkap atau akun tanpa membership secara otomatis mengakses data tenant default (MUKI RAMEN).

### Pola Salah:
```typescript
// authMiddleware.ts
req.user = {
  ...
  tenantId: activeTenantId || 'tenant-default-muki' // ❌ SUMBER KEBOCORAN UTAMA
};

// users.ts / vouchers.ts / settings.ts
const tenantId = req.user?.tenantId || 'tenant-default-muki'; // ❌
```

### Pola Benar:
```typescript
// authMiddleware.ts
req.user = {
  ...
  tenantId: activeTenantId || undefined
};

// Route handler: fail-closed guard
const tenantId = req.user?.tenantId;
if (!tenantId) {
  return res.status(400).json({
    error: 'Tenant context tidak tersedia. Silakan login ulang.',
    code: 'MISSING_TENANT_CONTEXT'
  });
}
```

---

## 🔴 POLA 3: Query "Fail-Open" (Full Table Scan)

### Masalah
Query database yang membungkus `tenantId` dengan conditional `if (tenantId)` atau `...(tenantId ? { tenantId } : {})` tanpa memastikan `tenantId` ada.
Jika `tenantId` undefined, query tidak memiliki filter tenant dan mengekspos data seluruh tenant.

### Pola Salah:
```typescript
// orders.ts / cashflow.ts
const whereCondition: any = {};
if (tenantId) {
  whereCondition.tenantId = tenantId; // ❌ Jika tenantId kosong, query mencari {} (SEMUA DATA)
}
const orders = await prisma.order.findMany({ where: whereCondition });

// attendance.ts / employeeLoans.ts / reservations.ts
function tenantWhere(tenantId: string | undefined) {
  return tenantId ? { tenantId } : {}; // ❌ Return {} = full scan
}
```

### Pola Benar:
```typescript
// 1. Router-level fail-closed guard:
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({
      error: 'Tenant context tidak tersedia. Silakan login ulang.',
      code: 'MISSING_TENANT_CONTEXT'
    });
  }
  next();
});

// 2. Helper tenantWhere yang melempar error:
function tenantWhere(tenantId: string | undefined): { tenantId: string } {
  if (!tenantId) throw new Error('MISSING_TENANT_ID: Query requires tenant context');
  return { tenantId };
}
```

---

## 🔴 POLA 4: Global Data Sharing via `OR: [{ tenantId }, { tenantId: null }]`

### Masalah
Menyertakan `{ tenantId: null }` dalam klausa `OR` membuka data global atau data tanpa pemilik ke semua tenant.

### Pola Salah:
```typescript
where: {
  deletedAt: null,
  ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {})
}
```

### Pola Benar:
```typescript
where: {
  deletedAt: null,
  tenantId
}
```

---

## 🔴 POLA 5: Insecure Direct Object Reference (IDOR)

### Masalah
Mencari atau memutasi objek hanya berdasarkan `id` numerik tanpa memverifikasi kepemilikan `tenantId`.

### Pola Salah:
```typescript
router.get('/:id', authenticateToken, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } }); // ❌ Bisa intip tenant lain
});
```

### Pola Benar:
```typescript
router.get('/:id', authenticateToken, async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

  const order = await prisma.order.findFirst({
    where: {
      id: Number(req.params.id),
      tenantId
    }
  });
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
});
```

---

## 📋 Checklist Verifikasi Standar Hardening

1. **Audit Socket.IO**: Pastikan TIDAK ADA `io.emit(...)` di seluruh `backend/src/routes/*.ts`. Semuanya wajib menggunakan `emitToTenant(tenantId, ...)`.
2. **Audit Fallback String**: Pastikan `grep -r "tenant-default-muki"` di `backend/src` tidak ditemukan lagi di handler ataupun middleware otentikasi.
3. **Fail-Closed Guarantee**: Request ke endpoint data tenant tanpa header `x-tenant-id` atau token JWT valid wajib menghasilkan status HTTP `400` atau `401`, bukan data acak atau data global.
4. **Zero Null Leak**: Pastikan tabel-tabel utama (`Order`, `CashFlow`, `Product`, `Ingredient`, `Customer`, `User`, `Table`, `Shift`, `Attendance`) terisi `tenantId` yang valid dan query selalu mensyaratkan `tenantId`.
