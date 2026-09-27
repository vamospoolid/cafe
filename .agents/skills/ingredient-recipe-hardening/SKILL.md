---
name: ingredient-recipe-hardening
description: >
  Standar arsitektur, pola perbaikan, dan pencegahan regresi untuk keamanan
  multi-tenant di modul Bahan Baku (Ingredients), Resep (Recipes), Waste/Loss,
  dan Analitik Staf CodePOS. Mencakup pencegahan sabotase pemotongan stok,
  pencurian resep lintas tenant, kebocoran data staf, dan IDOR pada nested
  foreign key injection.
---

# Ingredient & Recipe Hardening — CodePOS SaaS

## 1. Konteks & Latar Belakang

Modul bahan baku (ingredients) adalah inti dari operasional dapur dan finansial tenant.
Setiap celah isolasi di sini berpotensi:

| Celah | Dampak Bisnis |
|---|---|
| IDOR di `/loss` | Staff/hacker bisa menggerus stok bahan baku *tenant lain* tanpa jejak |
| Bocornya `user.findMany()` global | Nama, role, aktivitas staf tenant A terlihat oleh tenant B |
| Resep tanpa scoping tenantId | Tenant B bisa membaca HPP & komposisi resep rahasia tenant A |
| Nested FK injection di PUT /recipes | Bahan baku milik tenant lain bisa disuntikkan ke resep tenant sendiri |

---

## 2. Pola Anti-IDOR di Module Ingredients

### SALAH — findUnique tanpa tenantId (celah IDOR)
```typescript
// POST /loss — berbahaya! Siapapun bisa potong stok tenant lain
const ing = await tx.ingredient.findUnique({ where: { id: Number(ingredientId) } });
```

### BENAR — findFirst dengan double-key validation
```typescript
// WAJIB: validasi kepemilikan ingredient ke tenantId sebelum mutasi
const ing = await tx.ingredient.findFirst({
  where: { id: Number(ingredientId), tenantId, deletedAt: null }
});
if (!ing) throw new Error('Bahan baku tidak ditemukan atau bukan milik tenant ini');
```

Aturan Wajib: Setiap mutasi stok (decrement/increment) HARUS diawali findFirst
dengan `{ id, tenantId }` bukan findUnique dengan `{ id }` saja.

---

## 3. Pola Anti-Kebocoran Staff Analytics

### SALAH — findMany user global (bocor semua tenant)
```typescript
// Ini mengekspos nama, role, dan status SELURUH user di semua tenant
const allUsers = await prisma.user.findMany({
  select: { id: true, name: true, role: true, username: true, status: true }
});
```

### BENAR — filter melalui relasi memberships
```typescript
// Hanya ambil user yang memiliki membership di tenant ini
const allUsers = await prisma.user.findMany({
  where: {
    memberships: { some: { tenantId } }
  },
  select: { id: true, name: true, role: true, username: true, status: true }
});
```

Kenapa via memberships? Satu user bisa memiliki akun di banyak tenant.
Filter langsung `{ tenantId }` pada tabel User tidak valid karena User tidak punya kolom tenantId.
Relasi yang benar adalah `UserMembership` (atau `TenantMembership`).

---

## 4. Hardening Resep (recipes.ts) — 3 Lapis Validasi

### Lapis 1: Validasi kepemilikan Product
```typescript
const product = await prisma.product.findFirst({
  where: { id: Number(productId), tenantId }
});
if (!product) {
  return res.status(404).json({ error: 'Produk tidak ditemukan atau bukan milik tenant ini' });
}
```

### Lapis 2: Validasi kepemilikan setiap Ingredient (Anti Nested FK Injection)
```typescript
if (items.length > 0) {
  const ingredientIds = items.map((i: any) => Number(i.ingredientId));
  const ownedIngredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds }, tenantId, deletedAt: null },
    select: { id: true }
  });
  const ownedIds = new Set(ownedIngredients.map(i => i.id));
  const foreignIds = ingredientIds.filter(id => !ownedIds.has(id));
  if (foreignIds.length > 0) {
    return res.status(403).json({
      error: 'Beberapa bahan baku bukan milik tenant ini',
      code: 'INGREDIENT_TENANT_MISMATCH',
      foreignIds
    });
  }
}
```

### Lapis 3: IDOR DELETE melalui relasi (bukan direct ID delete)
```typescript
// SALAH: langsung delete tanpa validasi kepemilikan
await prisma.recipeItem.delete({ where: { id: Number(id) } });

// BENAR: cek kepemilikan melalui product -> tenantId
const recipeItem = await prisma.recipeItem.findFirst({
  where: { id: Number(id), product: { tenantId } },
  include: { product: { select: { tenantId: true } } }
});
if (!recipeItem) {
  return res.status(404).json({ error: 'Item resep tidak ditemukan atau bukan milik tenant ini' });
}
await prisma.recipeItem.delete({ where: { id: Number(id) } });
```

---

## 5. Router-Level Fail-Closed Guard

Semua router di modul ingredients, recipes, waste WAJIB memiliki guard ini:

```typescript
// Fail-closed: tolak semua request tanpa tenant context
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
```

---

## 6. Pola getTenantId yang Benar

```typescript
function getTenantId(req: Request): string | undefined {
  const user = (req as any).user;
  // Prioritas: JWT token > TenantContext middleware > header X-Tenant-Id
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
}
```

JANGAN tambahkan `req.query.tenantId` sebagai fallback pada endpoint mutasi (POST/PUT/DELETE).
Query params mudah dimanipulasi oleh klien dan tidak merupakan sumber kebenaran.

---

## 7. Pola Fail-Open yang WAJIB Dihindari

Ini adalah pola paling berbahaya karena terlihat aman tapi sebenarnya bocor:

### BERBAHAYA: `if (tenantId)` pada where condition
```typescript
// FAIL-OPEN! Jika tenantId = null/undefined, query berjalan TANPA filter tenant
// dan mengembalikan data dari SEMUA tenant!
const whereCondition: any = {};
if (tenantId) {
  whereCondition.tenantId = tenantId;
}
const data = await prisma.wasteLog.findMany({ where: whereCondition });
```

### AMAN: Fail-closed dengan early return
```typescript
// Fail-closed: tolak request tanpa tenant context sebelum query
if (!tenantId) {
  return res.status(400).json({ error: 'Tenant context tidak tersedia.', code: 'MISSING_TENANT_CONTEXT' });
}
const data = await prisma.wasteLog.findMany({ where: { tenantId } });
```

### BERBAHAYA: `tenantId || undefined` pada where prisma
```typescript
// Jika tenantId undefined, prisma MENGABAIKAN filter ini -> bocor ke semua tenant
const logs = await prisma.ingredientLog.findMany({
  where: { tenantId: tenantId || undefined }
});
```

### AMAN: Gunakan tenantId langsung setelah validasi
```typescript
// Setelah fail-closed guard di atas, tenantId dijamin ada
const tenantId = getTenantId(req)!; // Non-null assertion aman setelah guard
const logs = await prisma.ingredientLog.findMany({ where: { tenantId } });
```

---

## 8. Checklist Audit Setiap Endpoint Baru

Sebelum merge endpoint baru di modul ingredients/recipes/waste, pastikan:

- [ ] `getTenantId(req)` dipanggil dan divalidasi fail-closed
- [ ] TIDAK ADA pola `if (tenantId) { where.tenantId = tenantId }` — ini fail-open!
- [ ] TIDAK ADA pola `tenantId || undefined` pada Prisma where condition — ini fail-open!
- [ ] Setiap `findUnique({ where: { id } })` diganti `findFirst({ where: { id, tenantId } })`
- [ ] Setiap DELETE memvalidasi kepemilikan sebelum eksekusi
- [ ] Setiap `user.findMany()` difilter via `memberships: { some: { tenantId } }`
- [ ] Setiap PUT yang menerima FK dari klien (ingredientId, productId, dll) divalidasi kepemilikan
- [ ] Response tidak mengekspos field sensitif tenant lain (buyPrice, HPP, stok)

---

## 9. Matriks Kerentanan yang Sudah Ditutup

| ID | Endpoint | Jenis Celah | Status |
|---|---|---|---|
| ING-001 | `POST /ingredients/loss` | IDOR — sabotase pemotongan stok | FIXED |
| ING-002 | `GET /ingredients/staff-activity-analytics` | Kebocoran data staf lintas tenant | FIXED |
| ING-003 | `GET /ingredients/yield-analytics` | Fail-open: `tenantId \|\| undefined` di Prisma where | FIXED |
| ING-004 | `GET /ingredients/analytics/daily-usage` | Fail-closed missing: `user?.tenantId` tanpa fallback | FIXED |
| REC-001 | `GET /recipes/product/:productId` | Pencurian resep — akses tanpa validasi tenant | FIXED |
| REC-002 | `PUT /recipes/product/:productId` | Pencurian resep + Nested FK injection | FIXED |
| REC-003 | `DELETE /recipes/:id` | IDOR delete item resep tenant lain | FIXED |
| WST-001 | `GET /waste/analytics` | Fail-open: `if (tenantId)` — bocor data semua tenant | FIXED |
| SUP-001 | Supplier endpoints | Context extraction + AuditLogger | FIXED (sesi sebelumnya) |
| WH-001 | Warehouse inbound | outletId invalid arg + tenantId scoping | FIXED (sesi sebelumnya) |

---

## 9. Referensi Arsitektur

- `c:/ADATA/codepos/backend/src/routes/ingredients.ts` — Route utama bahan baku
- `c:/ADATA/codepos/backend/src/routes/recipes.ts` — Route resep produk
- `c:/ADATA/codepos/backend/src/routes/waste.ts` — Route pencatatan waste/susut
- `c:/ADATA/codepos/backend/src/routes/suppliers.ts` — Route supplier (sudah di-hardened)
- `c:/ADATA/codepos/backend/src/utils/tenantContext.ts` — TenantContext utility
- `c:/ADATA/codepos/backend/src/services/AuditLogger.ts` — Audit trail service
