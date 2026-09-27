---
name: bengkel-vertical-hardening
description: >
  Standar arsitektur, isolasi data multi-tenant, aturan Zero Spaghetti Code,
  dan panduan pengembangan fitur untuk vertikal Bengkel Motor & Mobil di CodePOS.
  Wajib dibaca sebelum menyentuh file apapun yang berkaitan dengan bengkel vertical.
  Mencakup: VerticalContext, businessType guard, WorkOrder/SPK patterns, 3-tier pricing,
  komisi mekanik, Vehicle History, WhatsApp notif, dan Invoice PDF A4.
---

# Panduan & Standar Bengkel Vertical Hardening

## 1. Prinsip Utama — WAJIB Dipatuhi

### Zero Cross-Tenant Leak

Data bengkel tidak boleh terlihat oleh tenant lain, termasuk sesama tenant bengkel.

**Aturan wajib:**
1. Setiap model baru WAJIB punya `tenantId` — tidak ada pengecualian.
2. Setiap query WAJIB di-scope `tenantId` dari middleware, bukan dari parameter URL.
3. Double-validate ID ownership — tidak cukup hanya filter `where: { id }`, harus `where: { id, tenantId }`.

```typescript
// SALAH — rentan IDOR
const spk = await prisma.workOrder.findUnique({ where: { id: req.params.id } })

// BENAR — isolasi terjaga
const spk = await prisma.workOrder.findUnique({
  where: { id: req.params.id, tenantId: req.tenantId }
})
if (!spk) return res.status(404).json({ error: 'Not found' })
```

### Zero Spaghetti Code

Fitur bengkel TIDAK boleh menyebar ke seluruh codebase.

**Aturan wajib:**
1. Semua **backend routes bengkel** ada di `backend/src/routes/bengkel/`
2. Semua **frontend components bengkel** ada di `frontend/src/verticals/bengkel/`
3. Tidak ada `if (businessType === 'BENGKEL')` di luar `VerticalContext` dan `App.tsx`
4. Shared components TIDAK dimodifikasi untuk bengkel — buat wrapper di `verticals/bengkel/`

### businessType adalah KUNCI GEMBOK

- `businessType` di-set SEKALI saat registrasi
- Hanya Platform Admin yang bisa mengubahnya
- Backend WAJIB protect semua route bengkel dengan `requireBusinessType('BENGKEL')`
- Frontend tidak perlu cek ulang — `VerticalContext` sudah handle

---

## 2. Struktur Folder Wajib

```
backend/src/routes/
├── bengkel/                 ← SEMUA route bengkel di sini
│   ├── index.ts            ← mount + requireBusinessType guard
│   ├── workOrders.ts
│   ├── serviceTypes.ts
│   ├── vehicles.ts
│   ├── mechanics.ts
│   └── invoices.ts

frontend/src/
├── verticals/
│   ├── bengkel/            ← SEMUA komponen bengkel di sini
│   │   ├── BengkelRoutes.tsx
│   │   ├── POSBengkel.tsx
│   │   ├── WorkOrderForm.tsx
│   │   ├── StatusBoard.tsx
│   │   ├── VehicleHistory.tsx
│   │   ├── MechanicList.tsx
│   │   ├── CommissionDashboard.tsx
│   │   ├── ServiceTypeManager.tsx
│   │   └── InvoiceManager.tsx
│   └── cafe/               ← JANGAN sentuh saat develop bengkel
│
├── context/
│   └── VerticalContext.tsx ← satu-satunya tempat businessType logic
└── components/
    └── VerticalGuard.tsx   ← guard per vertical
```

---

## 3. Backend Patterns

### Route Guard — Wajib di setiap bengkel route

```typescript
// backend/src/routes/bengkel/index.ts
router.use(requireAuth)
router.use(requireTenant)
router.use(requireBusinessType('BENGKEL'))  // ← wajib ada
```

### WorkOrder State Machine

Status transitions yang valid:
```
PENDING → ASSIGNED → IN_PROGRESS → WAITING_PARTS → DONE → PAID → DELIVERED
CANCELLED (dari: PENDING | ASSIGNED | IN_PROGRESS | WAITING_PARTS)
```

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:       ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:      ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:   ['WAITING_PARTS', 'DONE', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  DONE:          ['PAID'],
  PAID:          ['DELIVERED'],
}
```

### Stock Auto-Deduct & Auto-Restore

```typescript
// Deduct saat part ditambahkan ke SPK
async function deductStock(productId: number, qty: number, tenantId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId, tenantId } })
  if (!product || product.stock < qty) throw new Error('Stok tidak mencukupi')
  await prisma.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } })
}

// Restore saat SPK DIBATALKAN
async function restoreStockOnCancel(workOrderId: string, tenantId: string) {
  const parts = await prisma.workOrderPart.findMany({
    where: { workOrderId, tenantId, stockDeducted: true }
  })
  for (const part of parts) {
    if (!part.productId) continue
    await prisma.product.update({ where: { id: part.productId }, data: { stock: { increment: part.qty } } })
    await prisma.workOrderPart.update({ where: { id: part.id }, data: { stockDeducted: false } })
  }
}
```

### 3-Tier Price Resolution

```typescript
export function resolvePriceTier(
  product: { sellPrice: number; sellPriceRetail?: number | null; sellPriceMitra?: number | null; sellPriceGrosir?: number | null },
  tier: 'UMUM' | 'MITRA' | 'GROSIR'
): number {
  if (tier === 'GROSIR' && product.sellPriceGrosir != null) return product.sellPriceGrosir
  if (tier === 'MITRA' && product.sellPriceMitra != null) return product.sellPriceMitra
  return product.sellPriceRetail ?? product.sellPrice
}
```

### Komisi Auto-Calculate (saat SPK PAID, bukan saat item ditambah)

```typescript
async function calculateAndCreditCommissions(workOrderId: string, tenantId: string) {
  const services = await prisma.workOrderService.findMany({ where: { workOrderId, tenantId } })
  for (const service of services) {
    if (!service.mechanicId) continue
    const profile = await prisma.mechanicProfile.findFirst({ where: { userId: service.mechanicId, tenantId } })
    if (!profile || profile.commissionType === 'NONE') continue
    const commission = service.subtotal * profile.commissionRate
    await prisma.mechanicProfile.update({ where: { id: profile.id }, data: { pendingCommission: { increment: commission } } })
  }
}
```

### SPK Number Generation

```typescript
async function generateSpkNumber(tenantId: string): Promise<string> {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const last = await prisma.workOrder.findFirst({
    where: { tenantId, spkNumber: { startsWith: `SPK-${ym}-` } },
    orderBy: { spkNumber: 'desc' }
  })
  const seq = last ? parseInt(last.spkNumber.split('-')[2]) + 1 : 1
  return `SPK-${ym}-${String(seq).padStart(4, '0')}`
}
```

---

## 4. Frontend Patterns

### VerticalContext

```typescript
const { businessType, orderTerm, navigation } = useVertical()
// orderTerm: "Pesanan" (cafe) | "SPK" (bengkel)
```

### VerticalGuard

```typescript
<VerticalGuard allow="BENGKEL">
  <StatusBoard />
</VerticalGuard>

<VerticalGuard allow="BENGKEL" fallback={<Navigate to="/dashboard" />}>
  <WorkOrderForm />
</VerticalGuard>
```

### Lazy Loading — Wajib

```typescript
const BengkelRoutes = lazy(() => import('./verticals/bengkel/BengkelRoutes'))
// Browser cafe TIDAK akan download bundle bengkel
```

### Price Tier di Cart

```typescript
const [priceTier, setPriceTier] = useState<'UMUM' | 'MITRA' | 'GROSIR'>('UMUM')

// Auto-set dari customer tier saat dipilih
useEffect(() => {
  if (selectedCustomer?.priceTier) setPriceTier(selectedCustomer.priceTier as any)
}, [selectedCustomer])
```

### Socket.IO — Prefix event dengan `spk:` (hindari collision dengan cafe `order:`)

```typescript
// Backend emit
io.to(`tenant:${tenantId}`).emit('spk:status_updated', { spkId, status })

// Frontend subscribe
socket.on('spk:status_updated', ({ spkId, status }) => { /* update kanban */ })
```

---

## 5. Security Checklist

Sebelum commit kode bengkel baru:

### Backend
- [ ] Route ada di `backend/src/routes/bengkel/`
- [ ] `requireBusinessType('BENGKEL')` dipasang di `bengkel/index.ts`
- [ ] Setiap query pakai `tenantId: req.tenantId`
- [ ] ID param divalidasi dengan `{ id, tenantId }` sekaligus
- [ ] Tidak ada fail-open query: `where: tenantId ? { tenantId } : {}`
- [ ] Stock deduct menggunakan Prisma transaction jika concurrent

### Frontend
- [ ] Komponen ada di `verticals/bengkel/`
- [ ] Tidak ada `if (businessType)` di komponen shared
- [ ] Route bengkel di-lazy-load
- [ ] `VerticalGuard` digunakan di semua route bengkel
- [ ] Price tier di-resolve dari server, bukan hanya client

### Socket.IO
- [ ] Emit pakai `io.to('tenant:${tenantId}')` — tidak pakai `io.emit()`
- [ ] Event name diprefix `spk:` bukan `order:`

---

## 6. Model Baru — Semua Wajib tenantId

| Model | tenantId | Double-validate | Keterangan |
|-------|----------|-----------------|------------|
| `WorkOrder` | Wajib | `{ id, tenantId }` | SPK transaksi bengkel |
| `WorkOrderService` | Wajib | via workOrder ownership | Jasa mekanik di SPK |
| `WorkOrderPart` | Wajib | via workOrder ownership | Sparepart di SPK |
| `WorkOrderReturn` | Wajib | via workOrder ownership | Retur part / pembatalan SPK |
| `Vehicle` | Wajib | `{ id, tenantId }` | Data kendaraan pelanggan |
| `ServiceType` | Wajib | `{ id, tenantId }` | Master tarif jasa servis |
| `MechanicProfile` | Wajib | `{ userId, tenantId }` | Profil & komisi mekanik |
| `CommissionPayout` | Wajib | `{ id, tenantId }` | Riwayat pencairan komisi |
| `WorkOrderInvoice` | Wajib | `{ id, tenantId }` | Faktur tagihan B2B |
| `PartRequest` | Wajib | `{ id, tenantId }` | Buku Permintaan Part Kosong / Defecta |

---

## 7. Standar Pengadaan Suku Cadang & Buku Permintaan (Defecta)

### Isolasi Pengadaan Suku Cadang vs Bahan Baku Kafe
- Bengkel **DILARANG** menggunakan tabel `Ingredient` dan `RecipeItem`.
- Suku cadang bengkel 100% menggunakan model `Product` dengan field khusus: `brand`, `vehicleType`, `storageLocation`, dan `sellPriceRetail/Mitra/Grosir`.
- Bahan baku (`Ingredient`) hanya untuk tenant `CAFE`. Route pengadaan bengkel **TIDAK** menyentuh modul bahan baku.

### Alur Belanja: Grosir Tempo vs Belanja Tunai (Makassar)
1. **Grosir Tempo**:
   - Dibuat via `PurchaseOrder` dengan flag `purchaseType: 'GROSIR_TEMPO'` dan tanggal jatuh tempo `dueDate`.
   - Otomatis mencatat kewajiban ke tabel `Debt` (Hutang Usaha).
   - Saat pembayaran tempo lunas, dicatat di `CashFlow` kategori `PENGELUARAN_OPERASIONAL`.
2. **Belanja Tunai Langsung (Contoh: Trip Makassar)**:
   - Dibuat via `PurchaseOrder` dengan flag `purchaseType: 'TUNAI_LANGSUNG'`.
   - Mengeluarkan dana kas harian toko (`CashFlow` kategori `PENGELUARAN_STOK`).
   - Didukung oleh **Lembar Rekomendasi Belanja Mobile** (PDF/Web Checklist) yang menggabungkan:
     - Barang dengan `Product.stock <= Product.minStock`
     - Catatan permintaan konsumen yang masih aktif (`PartRequest.status = 'PENDING'`)

### Buku Catatan Permintaan Barang (`PartRequest`)
- Entri cepat dapat dilakukan dari POS Kasir maupun Dashboard tanpa keluar layar.
- **Korelasi Data**:
  - Jika part sudah terdaftar di sistem tapi stok 0: field `productId` diisi, menampilkan harga modal terakhir dan lokasi rak lama.
  - Jika part belum pernah ada (barang baru): `productId = null`, menyimpan nama, brand, dan jenis kendaraan.
- **1-Klik Konversi**: Saat barang tiba dari belanja, sistem menyediakan tombol konversi otomatis menjadi master `Product` baru tanpa mengetik ulang.
- **Lifecycle Status**:
  `PENDING` → `IN_PURCHASE_LIST` → `PURCHASED` → `CANCELLED`

---

## 8. Fitur MVP vs Fase 2

### MVP (implementasi sekarang)
- SPK / Work Order (CRUD + status flow)
- Jasa Motor/Mobil — ServiceType catalog
- Sparepart — 3-tier price (Umum/Mitra/Grosir) + Brand & StorageLocation
- Buku Catatan Permintaan Part Kosong / Defecta (`PartRequest`)
- Lembar Belanja Gabungan (Stok Minimum + Permintaan Konsumen) per Brand & Kategori
- Pengadaan via PO (Grosir Tempo $\rightarrow$ Debt, Tunai $\rightarrow$ CashFlow)
- Pilih Mekanik per jasa di SPK
- Komisi mekanik otomatis + dashboard
- Vehicle History per plat nomor
- Status Board real-time (Socket.IO)
- WA Notifikasi (received + done) via Fonnte
- Struk Kasir Thermal 58mm/80mm (`WorkOrderReceiptPrinter.tsx`)
- Laporan Keuangan Bengkel (`/bengkel/laporan` & `GET /api/bengkel/reports/summary`)
- Sinkronisasi Arus Kas (`CashFlow` `type: 'Pemasukan'`, `PENJUALAN_SPK - Tunai` & `PENJUALAN_SPK - Non-Tunai`)
- Label Sparepart (reuse existing, harga UMUM saja)
- Invoice PDF A4 Formal (multi-SPK)
- SPK Cancel + stok kembali otomatis
- Bayar sebagian SPK → auto Piutang (existing Debt system)
- Integrasi Backup JSON & Tenant Reset untuk entitas bengkel

### Fase 2 (JANGAN implementasi di MVP)
- Label SPK (tempel di kendaraan)
- Reminder servis otomatis (km-based scheduled WA)
- Retur sparepart ke supplier
- Refund jasa (komplain customer)
- Booking servis online
- Garansi sparepart tracking

---

## 9. Standar Struk & Pelaporan Finansial Bengkel

1. **Konsumen Harian / Walk-In**: Wajib menggunakan Struk Kasir Thermal (58mm/80mm) via `WorkOrderReceiptPrinter.tsx`. JANGAN berikan Invoice A4 untuk transaksi harian bengkel.
2. **Mitra Perusahaan / Instansi (B2B)**: Gunakan Faktur/Invoice A4 formal via `InvoiceManager.tsx` dan `generateWorkOrderInvoicePDF()`.
3. **Pencatatan Arus Kas Shift**:
   - Pembayaran SPK Kasir Tunai dicatat ke `CashFlow` dengan `category: 'PENJUALAN_SPK - Tunai'` (masuk laci fisik kasir).
   - Pembayaran Non-Tunai (QRIS/Transfer/Debit) dicatat dengan `category: 'PENJUALAN_SPK - Non-Tunai'` (masuk saldo elektronik, tidak menggelembungkan uang fisik di laci).
4. **Evaluasi Mekanik**:
   - Omzet Jasa & akumulasi komisi diakses melalui Dashboard Laporan Bengkel dan bersifat privat untuk Owner / Manajer.

---

---

## 11. Standar Faktur Masuk Supplier & Hutang Usaha Tempo (Net 14 / Net 30)

1. **Penerimaan Barang Suku Cadang**:
   - Suku cadang masuk dicatat melalui `SupplierInvoice` (bukan PO bahan baku kafe).
   - Saat nota disimpan, stok katalog produk (`Product.stock`) otomatis bertambah di dalam transaksi atomik.
   - HPP suku cadang (`Product.buyPrice`) dihitung ulang menggunakan rumus *Weighted Moving Average*.
2. **Integritas Arus Kas (Cash Flow Integrity)**:
   - Pencatatan nota tempo (`NET_7`, `NET_14`, `NET_30`, `NET_60`, `CUSTOM`) **TIDAK** memotong kas saat nota dibuat.
   - Arus kas keluar (`CashFlow: Pengeluaran`) hanya dicatat saat pelunasan/cicilan dilakukan via `POST /api/bengkel/supplier-invoices/:id/payments`.
3. **Paritas Disaster Recovery & Tenant Reset**:
   - Entitas `SupplierInvoice`, `SupplierInvoiceItem`, dan `SupplierInvoicePayment` wajib terdaftar di `BackupService.ts`, `database.ts`, dan `tenantReset.ts`.



