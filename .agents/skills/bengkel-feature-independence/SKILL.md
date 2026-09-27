---
name: bengkel-feature-independence
description: >
  Standar isolasi fitur Bengkel vs Kafe di CodePOS: Dashboard, CRM, Laporan,
  dan Pengaturan. Skill ini wajib dibaca sebelum menyentuh komponen shared
  (Dashboard, Reports, CRM, Settings) yang saat ini masih 100% berorientasi
  cafe. Mencakup: pola VerticalContext switch, guard module per businessType,
  pemisahan stat card, laporan finansial bengkel-only, CRM terminologi bengkel,
  dan pengaturan yang relevan per vertikal.
---

# Panduan Feature Independence: Bengkel vs Kafe

## 1. Latar Belakang & Masalah

CodePOS awalnya dibangun murni untuk **Kafe**. Ketika vertikal **Bengkel** ditambahkan,
beberapa modul shared masih hardcode terminologi/logika kafe:

| Modul | Masalah |
|-------|---------|
| Dashboard | Stat cards: "Total Menu", "HPP", "Pesanan Hari Ini" — tidak relevan untuk bengkel |
| CRM | Kolom "Riwayat Pesanan" vs "Riwayat Servis Kendaraan" |
| Laporan | Revenue chart berbasis `Order` (cafe), bukan `WorkOrder` (bengkel) |
| Pengaturan | Tab: "KDS", "Menu Kategori", "Struk Thermal" — bengkel tidak pakai KDS |
| AI Profit Advisor | Didesain untuk analisis F&B/menu, tidak relevan untuk sparepart |

---

## 2. Prinsip Isolasi — WAJIB Dipatuhi

### Aturan #1: Zero Hardcode businessType di Shared Component
JANGAN lakukan ini di komponen shared (`Dashboard.tsx`, `Reports.tsx`, dll):
```tsx
// SALAH — Spaghetti code, sulit scale ke vertikal ke-3
if (businessType === 'BENGKEL') {
  return <BengkelDashboard />
} else {
  return <CafeDashboard />
}
```

Lakukan ini — gunakan `VerticalContext` profile:
```tsx
// BENAR — config driven, extensible
const { statCards, reportModules, navigationItems } = useVerticalProfile()
return <Dashboard stats={statCards} />
```

### Aturan #2: Data Stat Card Harus dari Source yang Tepat
- Bengkel stat card WAJIB query dari `WorkOrder`, bukan dari `Order`
- Jangan passing cafe-data ke bengkel dashboard meski field namanya sama

### Aturan #3: Komponen Vertical-Specific di Folder Vertical
```
frontend/src/verticals/bengkel/
├── BengkelDashboardStats.tsx   <- stat cards bengkel
├── BengkelReportCharts.tsx     <- chart laporan bengkel  
├── BengkelCRMColumns.tsx       <- kolom tabel CRM bengkel
└── BengkelSettingsTabs.tsx     <- tab pengaturan bengkel
```

---

## 3. Dashboard — Isolasi Stat Cards & Grafik

### Stat Cards Kafe (JANGAN tampil di Bengkel)
- Total Menu Aktif
- HPP / Food Cost
- Table Turnover
- Pesanan Hari Ini
- Pendapatan Kafe

### Stat Cards Bengkel (WAJIB tampil di Bengkel)
- Total SPK Aktif (status: IN_PROGRESS + WAITING_PARTS)
- SPK Selesai Hari Ini (status: DONE + PAID)
- Sparepart Stok Menipis (stock < minStock)
- Total Aset Sparepart (value: stock x sellPrice)
- Komisi Mekanik Pending

### Pola Implementasi Dashboard Stat Cards

```tsx
// frontend/src/verticals/bengkel/BengkelDashboardStats.tsx
export function BengkelDashboardStats() {
  const { data } = useQuery({ queryKey: ['bengkel-stats'], queryFn: fetchBengkelStats })
  // fetchBengkelStats -> GET /api/bengkel/reports/dashboard-stats
  
  return (
    <div className="stat-grid">
      <StatCard label="SPK Aktif" value={data?.activeSpk} icon="wrench" />
      <StatCard label="Selesai Hari Ini" value={data?.doneToday} icon="check" />
      <StatCard label="Stok Menipis" value={data?.lowStockCount} icon="warning" color="warning" />
      <StatCard label="Aset Sparepart" value={formatRupiah(data?.stockAssetValue)} icon="box" />
      <StatCard label="Komisi Pending" value={formatRupiah(data?.pendingCommission)} icon="money" />
    </div>
  )
}
```

### Backend Endpoint Stat Cards Bengkel

```typescript
// backend/src/routes/bengkel/reports.ts (tambah endpoint baru)
router.get('/dashboard-stats', async (req, res) => {
  const tenantId = req.tenantId

  const [activeSpk, doneToday, products, mechanics] = await Promise.all([
    prisma.workOrder.count({
      where: { tenantId, status: { in: ['IN_PROGRESS', 'WAITING_PARTS', 'ASSIGNED'] } }
    }),
    prisma.workOrder.count({
      where: { tenantId, status: { in: ['DONE', 'PAID'] }, updatedAt: { gte: startOfDay() } }
    }),
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { stock: true, minStock: true, sellPrice: true }
    }),
    prisma.mechanicProfile.aggregate({
      where: { tenantId },
      _sum: { pendingCommission: true }
    })
  ])

  const lowStockCount = products.filter(p => p.minStock && p.stock <= p.minStock).length
  const stockAssetValue = products.reduce((sum, p) => sum + p.stock * p.sellPrice, 0)

  res.json({ activeSpk, doneToday, lowStockCount, stockAssetValue,
    pendingCommission: mechanics._sum.pendingCommission ?? 0 })
})
```

---

## 4. CRM — Isolasi Riwayat & Terminologi

### Yang Berbeda di CRM Bengkel vs Kafe

| Aspek | Kafe | Bengkel |
|-------|------|---------|
| Tab Riwayat | "Riwayat Pesanan" | "Riwayat Servis" |
| Kolom tabel | Menu, Qty, Total | Plat Nomor, Kendaraan, Jenis Servis |
| Filter | Tanggal Order | Tanggal Servis, Mekanik |
| Loyalty | Poin dari pembelian | Poin dari servis (opsional) |
| Export | Riwayat Transaksi Kafe | Riwayat Servis Kendaraan |

### Pola Implementasi — Conditional Column di CRM

```tsx
const { isBengkel } = useVertical()

const historyColumns = isBengkel ? [
  { key: 'spkNumber', label: 'No. SPK' },
  { key: 'vehiclePlate', label: 'Plat Nomor' },
  { key: 'serviceType', label: 'Jenis Servis' },
  { key: 'mechanic', label: 'Mekanik' },
  { key: 'totalCost', label: 'Total Biaya' },
  { key: 'date', label: 'Tanggal Servis' },
] : [
  { key: 'orderNumber', label: 'No. Order' },
  { key: 'items', label: 'Menu yang Dipesan' },
  { key: 'total', label: 'Total' },
  { key: 'date', label: 'Tanggal' },
]
```

### Backend: Endpoint Riwayat Servis per Customer

```typescript
// backend/src/routes/bengkel/
router.get('/customers/:customerId/service-history', async (req, res) => {
  const { customerId } = req.params
  const tenantId = req.tenantId

  const history = await prisma.workOrder.findMany({
    where: { tenantId, customerId },
    include: {
      services: { include: { serviceType: true, mechanic: { select: { name: true } } } },
      parts: { include: { product: { select: { name: true } } } },
      vehicle: true
    },
    orderBy: { createdAt: 'desc' }
  })

  res.json(history)
})
```

---

## 5. Laporan — Pemisahan Data Source

### Laporan Kafe (JANGAN di Bengkel)
- Sales by Menu Item -> dari `OrderItem`
- Table Utilization -> dari `Table` + `Order`
- Food Cost (HPP) Report -> dari `Recipe` + `Ingredient`
- Kitchen Performance -> dari `KitchenOrder`

### Laporan Bengkel (WAJIB)
- Revenue SPK per Periode -> dari `WorkOrder` (PAID)
- Top Jenis Servis -> dari `WorkOrderService` GROUP BY serviceType
- Top Mekanik (Omzet & Komisi) -> dari `WorkOrderService` + `MechanicProfile`
- Top Sparepart Terjual -> dari `WorkOrderPart` GROUP BY productId
- Stok Sparepart Saat Ini -> dari `Product` (bengkel)
- Arus Kas -> dari `CashFlow` (category: PENJUALAN_SPK)

### Guard di Komponen Laporan

```tsx
const { isBengkel } = useVertical()

const availableTabs = isBengkel ? [
  { key: 'spk-revenue', label: 'Omzet SPK' },
  { key: 'mechanic-performance', label: 'Kinerja Mekanik' },
  { key: 'sparepart-sales', label: 'Penjualan Sparepart' },
  { key: 'stock-report', label: 'Laporan Stok' },
  { key: 'cashflow', label: 'Arus Kas' },
] : [
  { key: 'daily-sales', label: 'Penjualan Harian' },
  { key: 'menu-performance', label: 'Kinerja Menu' },
  { key: 'food-cost', label: 'HPP & Food Cost' },
  { key: 'cashflow', label: 'Arus Kas' },
]
```

---

## 6. Pengaturan (Settings) — Tab yang Relevan per Vertikal

### Tab Settings Kafe (JANGAN muncul di Bengkel)
- KDS (Kitchen Display System) — tidak ada dapur di bengkel
- Menu Kategori — bengkel pakai kategori sparepart
- Table Management — tidak ada meja di bengkel

### Tab Settings yang SAMA (muncul di kedua vertikal)
- Profil Outlet — nama bengkel, alamat, logo, telepon
- Karyawan & Peran — staff, kasir, owner, manajer
- Shift Kerja — jam buka-tutup, shift kasir
- Metode Pembayaran — tunai, QRIS, transfer, debit
- Notifikasi WhatsApp — template pesan
- Printer Struk — 58mm / 80mm thermal

### Tab Settings KHUSUS Bengkel
- Data Mekanik -> redirect ke `/bengkel/mekanik`
- Jenis Servis & Jasa -> redirect ke `/bengkel/jenis-servis`
- Garansi Servis -> konfigurasi template garansi di struk
- Template WhatsApp SPK -> pesan terima kendaraan + selesai servis

### Pola Implementasi — Settings Tab Guard

```tsx
const { isBengkel } = useVertical()

const settingsTabs = [
  { key: 'profile', label: 'Profil Outlet', show: true },
  { key: 'employees', label: 'Karyawan & Peran', show: true },
  { key: 'shifts', label: 'Shift Kerja', show: true },
  { key: 'payment', label: 'Metode Pembayaran', show: true },
  { key: 'whatsapp', label: 'Notifikasi WhatsApp', show: true },
  { key: 'printer', label: 'Printer Struk', show: true },
  // Hanya Kafe
  { key: 'kds', label: 'KDS', show: !isBengkel },
  { key: 'tables', label: 'Manajemen Meja', show: !isBengkel },
  { key: 'menu-category', label: 'Kategori Menu', show: !isBengkel },
  // Hanya Bengkel
  { key: 'mechanics', label: 'Data Mekanik', show: isBengkel },
  { key: 'service-types', label: 'Jenis Servis', show: isBengkel },
  { key: 'warranty', label: 'Garansi Servis', show: isBengkel },
  { key: 'wa-spk-templates', label: 'Template WA SPK', show: isBengkel },
].filter(t => t.show)
```

---

## 7. Sidebar Navigation — Pola Final

```typescript
// Gunakan ini di Layout.tsx / Sidebar
const { isBengkel } = useVertical()

const navItems = isBengkel ? bengkelNav : cafeNav

const bengkelNav = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/pos', label: 'Kasir', icon: 'ShoppingCart' },
  { path: '/bengkel/spk', label: 'SPK & Work Order', icon: 'Wrench' },
  { path: '/bengkel/status-board', label: 'Status Board', icon: 'Kanban' },
  { path: '/produk', label: 'Sparepart & Stok', icon: 'Package' },
  { path: '/bengkel/kendaraan', label: 'Kendaraan', icon: 'Car' },
  { path: '/bengkel/mekanik', label: 'Mekanik', icon: 'UserCog' },
  { path: '/gudang', label: 'Gudang', icon: 'Warehouse' },
  { path: '/pelanggan', label: 'Pelanggan (CRM)', icon: 'Users' },
  { path: '/bengkel/laporan', label: 'Laporan Bengkel', icon: 'BarChart' },
  { path: '/pengaturan', label: 'Pengaturan', icon: 'Settings' },
]
```

---

## 8. Checklist Sebelum Commit

### Perubahan di Shared Component (Dashboard, CRM, Settings, Reports)
- [ ] Menggunakan `useVertical()` / `isBengkel` dari `VerticalContext`
- [ ] Tidak ada hardcode string kafe tanpa guard
- [ ] Stat card bengkel query dari `WorkOrder`, bukan dari `Order`
- [ ] Tab/kolom yang tidak relevan tersembunyi via `isBengkel` flag
- [ ] Tidak ada import langsung dari `verticals/cafe/`

### Perubahan Backend
- [ ] Endpoint stats bengkel ada di `backend/src/routes/bengkel/`
- [ ] Route diproteksi `requireBusinessType('BENGKEL')`
- [ ] Query selalu pakai `tenantId: req.tenantId`

### Dilarang
- [ ] Mengubah query kafe yang sudah ada untuk accommodate bengkel
- [ ] Membuat satu endpoint untuk dua vertikal sekaligus
- [ ] Meletakkan komponen bengkel di luar `verticals/bengkel/`

---

## 9. Prioritas Eksekusi

| Prioritas | Modul | Effort | Impact |
|-----------|-------|--------|--------|
| P1 (Merah) | Dashboard Stat Cards | Sedang | Tinggi — terlihat langsung |
| P1 (Merah) | Sidebar Navigation | Rendah | Tinggi — orientasi user |
| P2 (Kuning) | Laporan Bengkel | Tinggi | Tinggi — data driven |
| P2 (Kuning) | Settings Tab Guard | Rendah | Sedang — kebersihan UX |
| P3 (Hijau) | CRM Riwayat Servis | Sedang | Sedang — customer insight |
