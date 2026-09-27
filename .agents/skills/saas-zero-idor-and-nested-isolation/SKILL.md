---
name: saas-zero-idor-and-nested-isolation
description: >
  Standar arsitektur & pola pencegahan Insecure Direct Object Reference (IDOR),
  eliminasi kueri fail-open ...(tenantId ? { tenantId } : {}), validasi kepemilikan
  relasi bersarang (nested foreign key injection), dan pembatasan hak akses role OWNER.
---

# SKILL: SaaS Zero-IDOR & Nested FK Multi-Tenant Hardening

## 1. Prinsip Zero-IDOR (Insecure Direct Object Reference)
Dalam arsitektur SaaS multi-tenant dengan *shared schema*:
1. **Tidak Ada Kueri By-ID Tunggal**: Kueri `findUnique({ where: { id } })` atau `findFirst({ where: { id } })` pada entitas tenant **HARUS DIHILANGKAN**. Seluruh pencarian detail, mutasi (`UPDATE`/`DELETE`/`VOID`), dan pembacaan objek WAJIB menyertakan `tenantId`:
   ```typescript
   // ❌ RENTAN IDOR (Tenant B bisa membaca/menghapus milik Tenant A)
   const order = await prisma.order.findUnique({ where: { id } });

   // ✅ AMAN (Terkunci ke tenant yang bersangkutan)
   const order = await prisma.order.findFirst({
     where: { id, tenantId }
   });
   ```

2. **Haramkan Pola Kueri Fail-Open `...(tenantId ? { tenantId } : {})`**:
   Pola spread kondisional `...(tenantId ? { tenantId } : {})` sangat berbahaya karena jika `tenantId` bernilai `undefined` atau `null` (misalnya token tanpa tenant atau bypass context), kueri menciut menjadi `{ id }` tanpa filter tenant!
   ```typescript
   // ❌ FAIL-OPEN (Bila tenantId undefined, filter tenant hilang!)
   where: { id, ...(tenantId ? { tenantId } : {}) }

   // ✅ FAIL-CLOSED (Wajib tenantId ada, jika kosong tolak di awal)
   if (!tenantId) {
     return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
   }
   where: { id, tenantId }
   ```

---

## 2. Pencegahan Nested Foreign Key Injection (Relasi Bersarang)
Saat client membuat pesanan (`POST /api/orders`) atau faktur (`POST /api/purchase-orders`), payload menyertakan foreign key ke entitas lain:
- `productIds`: ID produk makanan/minuman
- `tableId`: ID meja fisik
- `voucherId`: ID kupon diskon
- `customerId`: ID pelanggan loyalty
- `supplierId`: ID supplier bahan

### Aturan Wajib:
Sebelum data induk disimpan, seluruh relasi bersarang WAJIB divalidasi kepemilikannya ke `tenantId` aktif:
```typescript
// 1. Validasi Produk
const products = await tx.product.findMany({
  where: { id: { in: productIds }, tenantId }
});
if (products.length !== productIds.length) {
  throw new Error('Satu atau lebih produk tidak ditemukan atau bukan milik tenant ini');
}

// 2. Validasi Meja
if (tableId) {
  const table = await tx.table.findFirst({ where: { id: Number(tableId), tenantId } });
  if (!table) throw new Error('Meja tidak valid atau bukan milik tenant ini');
}

// 3. Validasi Voucher Promo
if (voucherId) {
  const voucher = await tx.voucher.findFirst({ where: { id: Number(voucherId), tenantId, status: 'Aktif' } });
  if (!voucher) throw new Error('Voucher tidak valid atau bukan milik tenant ini');
}
```

---

## 3. Pembatasan Hak Akses Role OWNER (Tenant Owner vs Platform Admin)
Pengguna dengan `role: 'OWNER'` adalah pemilik kafe/restoran lokal pada tenant bersangkutan, **BUKAN** superadmin platform SaaS:
- `user.role === 'OWNER'`: Wajib terkunci ketat pada `tenantId` miliknya sendiri.
- `user.isPlatformAdmin === true`: Satu-satunya akun yang memiliki otorisasi cross-tenant untuk audit SaaS global.
- Jangan pernah menggabungkan:
  ```typescript
  // ❌ SALAH (Pemilik Kafe B bisa mengedit produk Kafe A!)
  const isSuperOrOwner = user?.role === 'OWNER' || user?.isPlatformAdmin;
  const tenantCondition = !isSuperOrOwner ? { tenantId } : {};

  // ✅ BENAR (Pemilik Kafe B tetap terisolasi ke kafenya sendiri)
  const isPlatformSuperAdmin = Boolean(user?.isPlatformAdmin);
  const tenantCondition = !isPlatformSuperAdmin ? { tenantId } : {};
  ```

---

## 4. Proteksi Endpoint Publik (Public QR Meja)
Endpoint `GET /api/tables/public/:id` yang diakses oleh pelanggan via scan QR:
- Wajib menyertakan parameter `tenant` (slug) atau `tenantId`.
- Kueri meja wajib memverifikasi bahwa meja ber-ID tersebut memang berada di bawah naungan tenant yang dimaksud:
  ```typescript
  const table = await prisma.table.findFirst({
    where: { id: numId, tenantId }
  });
  if (!table) return res.status(404).json({ error: 'Meja tidak ditemukan di restoran ini' });
  ```
