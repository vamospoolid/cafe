---
name: pos-category-catalog-hardening
description: >
  Standar arsitektur, pola perbaikan, dan pencegahan regresi untuk manajemen katalog & kategori menu
  multi-tenant di CodePOS. Mencakup pencegahan orphaned subcategory products saat soft-delete,
  eliminasi IDOR pada Recycle Bin (restore & purge), mitigasi Foreign Key crash P2003,
  sinkronisasi real-time via Socket.IO, resiliensi cache offline IndexedDB (Dexie),
  routing stasiun dapur KDS (stationTarget), dan filter isActive multi-channel.
---

# SKILL: POS Category & Catalog Hardening

Standar operasional dan pedoman teknis untuk memastikan sistem kategori dan katalog produk multi-tenant di CodePOS bekerja dengan aman, konsisten, cepat, dan terbebas dari celah keamanan maupun regresi sistem.

---

## 1. Pencegahan Orphaned References pada Cascade Hierarchy Kategori

### Masalah Teknis
Kategori memiliki struktur bertingkat (*Parent-Child / Sub-kategori*):
```
[Category Induk: Minuman] (id: 10)
  ├── [Sub-Category: Kopi] (id: 25, parentId: 10)
  └── [Sub-Category: Teh]  (id: 26, parentId: 10)
```
Sebuah produk dapat mengaitkan `categoryId: 10` dan `subCategoryId: 25`.
Jika validasi penghapusan kategori induk hanya memeriksa `OR: [{ categoryId: 10 }, { subCategoryId: 10 }]`, sistem **gagal mendeteksi** produk yang terhubung ke `subCategoryId: 25`. Akibatnya, kategori 10 dan 25 di-soft-delete, sementara produk tetap aktif dan mengarah ke sub-kategori yang sudah mati (*orphaned foreign key reference*).

### Pola Implementasi Aman (Cascade Check)
Sebelum melakukan soft-delete kategori induk:
1. Kumpulkan seluruh ID anak sub-kategori milik tenant tersebut.
2. Periksa apakah ada produk aktif yang mengaitkan ID induk **atau** salah satu ID anak.
3. Tolak penghapusan secara *fail-closed* jika masih ada produk aktif yang bergantung.

```typescript
// 1. Ambil seluruh ID sub-kategori turunan milik tenant ini
const childCategories = await prisma.category.findMany({
  where: { parentId: categoryId, tenantId, deletedAt: null },
  select: { id: true, name: true }
});
const allTargetIds = [categoryId, ...childCategories.map(c => c.id)];

// 2. Periksa produk yang masih menggunakan kategori induk maupun sub-kategori turunan
const activeProductsCount = await prisma.product.count({
  where: {
    tenantId,
    deletedAt: null,
    OR: [
      { categoryId: { in: allTargetIds } },
      { subCategoryId: { in: allTargetIds } }
    ]
  }
});

if (activeProductsCount > 0) {
  return res.status(400).json({
    error: `Tidak dapat menghapus kategori karena masih digunakan oleh ${activeProductsCount} produk aktif (termasuk pada sub-kategori). Harap pindahkan produk terlebih dahulu.`,
    code: 'CATEGORY_HAS_ACTIVE_PRODUCTS'
  });
}

// 3. Soft delete kategori induk dan seluruh anak secara atomik
await prisma.$transaction([
  prisma.category.updateMany({
    where: { id: categoryId, tenantId },
    data: { deletedAt: new Date() }
  }),
  prisma.category.updateMany({
    where: { parentId: categoryId, tenantId, deletedAt: null },
    data: { deletedAt: new Date() }
  })
]);
```

---

## 2. Eliminasi IDOR & FK Crash (P2003) pada Recycle Bin (Restore & Purge)

### 2.1 Anti-IDOR pada Restore
Dilarang keras menggunakan `findUnique({ where: { id } })` atau `update({ where: { id } })` tanpa validasi `tenantId`.
Setiap entitas yang dipulihkan wajib diverifikasi kepemilikannya terhadap `tenantId` yang login:

```typescript
// ✅ AMAN: Wajib memverifikasi tenantId
const cat = await prisma.category.findFirst({
  where: { id: numericId, tenantId, deletedAt: { not: null } }
});
if (!cat) {
  return res.status(404).json({ error: 'Kategori tidak ditemukan di keranjang sampah outlet Anda.' });
}

// Restore kategori dan anak sub-kategori milik tenant tersebut
await prisma.$transaction([
  prisma.category.updateMany({
    where: { id: numericId, tenantId },
    data: { deletedAt: null }
  }),
  prisma.category.updateMany({
    where: { parentId: numericId, tenantId },
    data: { deletedAt: null }
  })
]);
```

### 2.2 Pencegahan Crash Foreign Key (P2003) pada Hard-Delete (Purge)
Saat Owner melakukan *Purge* (hapus permanen dari database), PostgreSQL/Prisma akan melempar error `P2003 (Foreign key constraint violation)` jika ada entitas lain yang masih mereferensikan ID tersebut (misal `Product.categoryId` atau `Product.subCategoryId`).

**Pola Penanganan Purge yang Aman**:
1. Pastikan entitas milik `tenantId` aktif.
2. Putuskan (*detach*) atau bersihkan referensi foreign key pada produk yang ada di recycle bin (atau tolak jika produk masih ada):
```typescript
case 'CATEGORY': {
  const cat = await tx.category.findFirst({
    where: { id: numericId, tenantId }
  });
  if (!cat) throw new Error('Kategori tidak ditemukan atau Anda tidak memiliki akses');
  purgedName = cat.name;

  const childCats = await tx.category.findMany({
    where: { parentId: numericId, tenantId },
    select: { id: true }
  });
  const allCatIds = [numericId, ...childCats.map(c => c.id)];

  // Periksa apakah masih ada produk aktif
  const referencingProducts = await tx.product.count({
    where: {
      tenantId,
      deletedAt: null,
      OR: [{ categoryId: { in: allCatIds } }, { subCategoryId: { in: allCatIds } }]
    }
  });
  if (referencingProducts > 0) {
    throw new Error(`Kategori tidak dapat dimusnahkan karena masih ditautkan oleh ${referencingProducts} produk.`);
  }

  // Bersihkan referensi sub-kategori pada produk terhapus (set null)
  await tx.product.updateMany({
    where: { tenantId, subCategoryId: { in: allCatIds } },
    data: { subCategoryId: null }
  });

  // Hapus permanen sub-kategori lalu kategori induk
  await tx.category.deleteMany({ where: { parentId: numericId, tenantId } });
  await tx.category.deleteMany({ where: { id: numericId, tenantId } });
  break;
}
```

---

## 3. Sinkronisasi Real-Time Multi-Device via Tenant-Scoped Socket.IO

### Masalah Teknis
Ketika Owner menambahkan kategori baru atau mengatur ulang urutan (*reorder*), kasir POS atau tablet KDS tidak tahu adanya perubahan kecuali me-refresh halaman browser secara manual.

### Standar Broadcast Aman:
1. **Gunakan `emitToTenant`**, JANGAN PERNAH `io.emit()` global:
   ```typescript
   import { emitToTenant } from '../services/socketService';
   // atau
   io.to(`tenant:${tenantId}`).emit('categories:updated', {
     action: 'REORDER', // CREATE | UPDATE | DELETE | APPLY_PRESET
     timestamp: new Date().toISOString()
   });
   ```
2. **Debounce pada Frontend**:
   Di sisi frontend (`POSView.tsx`, `KDSView.tsx`), tangkap event dengan debounce minimal 300ms agar tidak terjadi *infinite loop fetch* atau *render storm* ketika ada batch updates:
   ```typescript
   useEffect(() => {
     if (!socket) return;
     const handleCategoryUpdate = () => {
       fetchCategories();
     };
     socket.on('categories:updated', handleCategoryUpdate);
     return () => {
       socket.off('categories:updated', handleCategoryUpdate);
     };
   }, [socket]);
   ```

---

## 4. Resiliensi Mode Offline & IndexedDB (Dexie)

### Masalah Teknis
Saat online, backend menyusun kategori dengan `orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]`.
Saat offline, Dexie `.toArray()` mengembalikan array berdasarkan urutan Primary Key ID numerik bawaan browser, sehingga urutan tab kategori di kasir menjadi berantakan saat internet terputus.

### Standar Hardening Dexie:
1. **Lengkapi Interface `CachedCategory`**:
   ```typescript
   export interface CachedCategory {
     id: number;
     name: string;
     icon?: string;
     color?: string;
     sortOrder?: number;
     stationTarget?: string;
     isActive?: boolean;
     subCategories?: any[];
     tenantId?: string;
   }
   ```
2. **Deterministic Offline Sorting**:
   Pada fungsi `getCachedCategories()`, selalu terapkan fallback sorting identik dengan backend:
   ```typescript
   async getCachedCategories(): Promise<CachedCategory[]> {
     const list = await this.cachedCategories.toArray();
     return list.sort((a, b) => {
       const orderA = a.sortOrder ?? 0;
       const orderB = b.sortOrder ?? 0;
       if (orderA !== orderB) return orderA - orderB;
       return (a.name || '').localeCompare(b.name || '');
     });
   }
   ```

---

## 5. Kitchen Display System (KDS) Station-Based Routing

### Masalah Teknis
KDS saat ini memfilter item pesanan berdasarkan `categoryId` tunggal. Jika sebuah kafe memiliki stasiun **BAR**, barista harus bolak-balik mengganti filter antara *Espresso*, *Manual Brew*, dan *Tea*.

### Standar Arsitektur:
1. **Dua Mode Filter KDS**:
   - Mode Stasiun Utama: Berdasarkan `stationTarget` (`ALL`, `KITCHEN`, `BAR`, `GRILL`, `DESSERT`).
   - Mode Kategori Spesifik: Berdasarkan `categoryId`.
2. **Hierarki Penentuan Stasiun Produk**:
   Untuk menentukan apakah sebuah item pesanan harus muncul di KDS:
   ```typescript
   const getProductStation = (item: any, categoryMap: Map<number, any>): string => {
     // 1. Cek dari kategori produk
     const cat = categoryMap.get(item.product?.categoryId);
     if (cat?.stationTarget) return cat.stationTarget;
     
     // 2. Fallback ke printerTarget legacy
     if (cat?.printerTarget === 'BAR') return 'BAR';
     if (cat?.printerTarget === 'NONE') return 'NONE';
     
     // 3. Default ke KITCHEN
     return 'KITCHEN';
   };
   ```

---

## 6. Multi-Channel Enforcement Status `isActive`

### Kebijakan Akses Status Kategori:
1. **Channel Pelanggan (Dine-in QR Menu)**:
   - Wajib memfilter `isActive: true` dan `deletedAt: null`.
   - Kategori yang non-aktif tidak boleh diakses oleh pelanggan.
2. **Channel Kasir (POS View)**:
   - Default hanya menampilkan `isActive: true`.
   - Menghindari kasir menjual item dari kategori yang sedang dinonaktifkan (misal: menu musiman).
3. **Channel Manajemen (Settings / ProductView)**:
   - Menampilkan seluruh kategori (aktif maupun non-aktif) dengan penanda badge status (*Aktif* / *Non-aktif*).
   - Mendukung parameter kueri `includeInactive=true`.

---

## 7. Checklist Verifikasi Anti-Regresi

Sebelum mempublikasikan perubahan pada modul kategori dan katalog, pastikan seluruh item berikut lulus uji:

- [ ] **Cascade Child Check**: Menghapus kategori induk yang anak sub-kategorinya memiliki produk aktif harus melempar error 400.
- [ ] **Cross-Tenant Purge Check**: Memanggil `/api/recycle-bin/purge/CATEGORY/:id` dengan ID milik tenant lain harus mengembalikan 404 / 403, bukan menghapus data.
- [ ] **Offline Sort Consistency**: Matikan koneksi jaringan di DevTools (Network Offline), muat ulang tab POS, pastikan tab kategori tetap berurutan sesuai `sortOrder`.
- [ ] **Dual-Station Routing**: Pesanan yang berisi makanan (*KITCHEN*) dan kopi (*BAR*) terpisah rapi saat filter stasiun KDS diubah.
- [ ] **Zero Foreign Key Crash**: Menghapus permanen kategori yang tidak memiliki produk tidak boleh memicu Prisma P2003 error.
- [ ] **Type Compatibility**: Backward-compatible dengan field legacy `printerTarget` sehingga integrasi hardware thermal printer lama tetap mencetak tanpa kendala.
