# ✅ TODO LIST — MVP Bengkel Vertical CodePOS

> **Target**: 4 Minggu | **Total task**: ~80 item  
> Selesaikan Week 1 sebelum lanjut Week 2, dst.

---

## WEEK 1 — Database & Foundation La### W1-A: Database Migration
- [x] W1-A-1  schema.prisma — Tambah businessType String @default("CAFE") di Tenant
- [x] W1-A-2  schema.prisma — Tambah 3-tier pricing di Product: sellPriceRetail, sellPriceMitra, sellPriceGrosir, minQtyGrosir
- [x] W1-A-3  schema.prisma — Tambah priceTier + creditLimit di Customer
- [x] W1-A-4  schema.prisma — Tambah relasi bengkel ke Tenant (workOrders, serviceTypes, vehicles, dll)
- [x] W1-A-5  schema.prisma — Model Vehicle (plateNumber, brand, model, vehicleType, year, color)
- [x] W1-A-6  schema.prisma — Model ServiceType (nama jasa, priceRetail/Mitra/Grosir, vehicleType)
- [x] W1-A-7  schema.prisma — Model WorkOrder (SPK) + semua field + status + WA notif flags
- [x] W1-A-8  schema.prisma — Model WorkOrderService (jasa + mechanicId)
- [x] W1-A-9  schema.prisma — Model WorkOrderPart (sparepart + stockDeducted flag)
- [x] W1-A-10 schema.prisma — Model WorkOrderReturn + WorkOrderReturnItem
- [x] W1-A-11 schema.prisma — Model MechanicProfile (commissionType, commissionRate, pendingCommission)
- [x] W1-A-12 schema.prisma — Model CommissionPayout (per period)
- [x] W1-A-13 schema.prisma — Model WorkOrderInvoice + WorkOrderInvoiceItem
- [x] W1-A-14 Jalankan: npx prisma db push & generate
- [x] W1-A-15 Verifikasi migration: semua tabel baru terbentuk di database

### W1-B: Seed Data Bengkel
- [x] W1-B-1  Buat backend/prisma/seed_bengkel_defaults.ts — kategori sparepart default
- [x] W1-B-2  Seed ServiceType default (Tune Up Motor 85K, Tune Up Mobil 175K, Ganti Oli Motor 45K, dll)
- [x] W1-B-3  Register seed di seed.ts — panggil seedBengkelDefaults saat businessType === BENGKEL

### W1-C: Backend Middleware
- [x] W1-C-1  Buat backend/src/middlewares/requireBusinessType.ts
- [x] W1-C-2  Buat folder backend/src/routes/bengkel/
- [x] W1-C-3  Buat backend/src/routes/bengkel/index.ts — triple guard: requireAuth + requireTenant + requireBusinessType
- [x] W1-C-4  Register di main router: app.use('/api/bengkel', bengkelRouter)

### W1-D: Frontend Foundation
- [x] W1-D-1  Buat frontend/src/context/VerticalContext.tsx — BusinessType, VerticalProfile, useVertical()
- [x] W1-D-2  Update POSContext.tsx — tambah businessType ke User type, populate dari settings
- [x] W1-D-3  Update App.tsx — wrap dengan VerticalProvider
- [x] W1-D-4  Buat frontend/src/components/VerticalGuard.tsx
- [x] W1-D-5  Buat folder frontend/src/verticals/bengkel/
- [x] W1-D-6  Refactor sidebar — navigation dari VerticalProfile (isBengkel guard)

---

## WEEK 2 — Backend Routes Bengkel

### W2-A: ServiceType Routes
- [x] W2-A-1  GET /bengkel/service-types (list, filter vehicleType)
- [x] W2-A-2  POST /bengkel/service-types (create)
- [x] W2-A-3  PATCH /bengkel/service-types/:id (update, double-validate tenantId)
- [x] W2-A-4  DELETE /bengkel/service-types/:id (soft delete)

### W2-B: Vehicle Routes
- [x] W2-B-1  GET /bengkel/vehicles (list + search by plate/customer)
- [x] W2-B-2  POST /bengkel/vehicles (create, normalize plateNumber uppercase)
- [x] W2-B-3  PATCH /bengkel/vehicles/:id (update)
- [x] W2-B-4  GET /bengkel/vehicles/history/:plate (riwayat servis per plat)
- [x] W2-B-5  GET /bengkel/vehicles/:id (detail + list SPK)

### W2-C: WorkOrder (SPK) Routes
- [x] W2-C-1  Helper: generateSpkNumber(tenantId) — format SPK-YYYYMM-0001
- [x] W2-C-2  Helper: resolvePriceTier(product, tier) — UMUM|MITRA|GROSIR fallback
- [x] W2-C-3  GET /bengkel/work-orders (list, filter status/date/mechanic/plat)
- [x] W2-C-4  POST /bengkel/work-orders (create SPK, auto spkNumber, set priceTier dari customer)
- [x] W2-C-5  GET /bengkel/work-orders/:id (detail + services + parts)
- [x] W2-C-6  PATCH /bengkel/work-orders/:id/status (state machine validation, trigger commission/WA)
- [x] W2-C-7  POST /bengkel/work-orders/:id/services (tambah jasa, resolve harga tier)
- [x] W2-C-8  DELETE /bengkel/work-orders/:id/services/:sid (hapus jasa)
- [x] W2-C-9  POST /bengkel/work-orders/:id/parts (tambah sparepart + deductStock)
- [x] W2-C-10 DELETE /bengkel/work-orders/:id/parts/:pid (hapus + restore stock)
- [x] W2-C-11 POST /bengkel/work-orders/:id/cancel (restoreStockOnCancel)
- [x] W2-C-12 POST /bengkel/work-orders/:id/pay (bayar, partial -> create Debt, trigger komisi)
- [x] W2-C-13 Fungsi calculateAndCreditCommissions(workOrderId, tenantId)
- [x] W2-C-14 Socket.IO emit spk:status_updated ke tenant:tenantId saat status berubah

### W2-D: Mechanic & Commission Routes
- [x] W2-D-1  GET /bengkel/mechanics (list user + MechanicProfile)
- [x] W2-D-2  POST /bengkel/mechanics/profile (create/update MechanicProfile)
- [x] W2-D-3  PATCH /bengkel/mechanics/profile (update commissionRate)
- [x] W2-D-4  GET /bengkel/mechanics/payouts (riwayat + pending)
- [x] W2-D-5  POST /bengkel/mechanics/payout (bayar komisi, update pending/paid)
- [x] W2-D-6  GET /bengkel/mechanics (rekap semua mekanik)

### W2-E: Invoice Routes
- [x] W2-E-1  GET /bengkel/invoices (list + filter status)
- [x] W2-E-2  POST /bengkel/invoices (create dari beberapa spkId)
- [x] W2-E-3  GET /bengkel/invoices/:id (detail)
- [x] W2-E-4  PATCH /bengkel/invoices/:id/status (SENT, PAID, VOID)
- [x] W2-E-5  Invoice PDF A4 printable layout & formal preview

### W2-F: Test Scripts
- [x] W2-F-1  test_bengkel_vertical.ts — tenant A tidak bisa akses SPK tenant B (Anti-IDOR PASS)
- [x] W2-F-2  test_bengkel_vertical.ts — cafe tenant akses /bengkel/* guard PASS
- [x] W2-F-3  test_bengkel_vertical.ts — cancel SPK -> stok kembali PASS
- [x] W2-F-4  test_bengkel_vertical.ts — SPK paid -> komisi dihitung benar PASS

---

## WEEK 3 — Frontend Bengkel

### W3-A: POS Bengkel (Kasir)
- [x] W3-A-1  Buat BengkelRoutes.tsx — lazy-loaded router bengkel
- [x] W3-A-2  Buat POSBengkel.tsx — layout: sidebar + grid + cart panel
- [x] W3-A-3  Tab toggle [SUKU CADANG] / [LAYANAN JASA]
- [x] W3-A-4  Product grid SUKU CADANG: card putih, nama, kode, stock badge, harga UMUM
- [x] W3-A-5  Product grid LAYANAN JASA: filter by vehicleType, tarif per tier
- [x] W3-A-6  Cart: tier selector [UMUM][MITRA][GROSIR] -> harga update otomatis
- [x] W3-A-7  Cart: input "No. Polisi" (auto-search) + "Nama Pelanggan"
- [x] W3-A-8  Cart: qty controls, subtotal, tombol PROSES PEMBAYARAN purple gradient

### W3-B: SPK / Work Order
- [x] W3-B-1  Buat WorkOrderForm.tsx — form buat SPK (plat, jenis, merk, km, keluhan)
- [x] W3-B-2  WorkOrderForm: auto-lookup customer+vehicle saat input plat
- [x] W3-B-3  WorkOrderForm: section tambah jasa -> pilih ServiceType + mekanik
- [x] W3-B-4  WorkOrderForm: section tambah sparepart -> search product + qty
- [x] W3-B-5  WorkOrderForm: detail SPK, update status, cashier payment modal

### W3-C: Status Board
- [x] W3-C-1  Buat StatusBoard.tsx — kanban 5 kolom: PENDING|IN_PROGRESS|WAITING_PARTS|DONE|PAID
- [x] W3-C-2  Card SPK: plat, merk/model, mekanik, pekerjaan, quick-update status
- [x] W3-C-3  Subscribe Socket.IO spk:status_updated -> pindah card real-time
- [x] W3-C-4  Badge status warna & transition

### W3-D: Vehicle History
- [x] W3-D-1  Buat VehicleHistory.tsx — search by plat -> timeline servis
- [x] W3-D-2  Stats: total kunjungan, plat, jenis kendaraan, customer WhatsApp
- [x] W3-D-3  Table riwayat: tanggal, no SPK, jasa, sparepart, mekanik, total

### W3-E: Mekanik & Komisi
- [x] W3-E-1  Buat MechanicList.tsx — list mekanik, commission rate, pending
- [x] W3-E-2  Stats komisi: belum dicairkan vs sudah dibayar
- [x] W3-E-3  Modal konfirmasi bayar komisi: jumlah, metode, catatan

### W3-F: Katalog Jasa
- [x] W3-F-1  Buat ServiceTypeManager.tsx — CRUD jasa, filter vehicleType
- [x] W3-F-2  Form jasa: nama, vehicleType, harga UMUM/MITRA/GROSIR

### W3-G: Invoice Manager
- [x] W3-G-1  Buat InvoiceManager.tsx — list invoice + status badge
- [x] W3-G-2  Form buat invoice: pilih customer, pilih SPK (multi), dueDate, NPWP
- [x] W3-G-3  Detail invoice: summary SPK, pajak PPN 11%, total, cetak format A4 formal

---

## WEEK 4 — Polish, WA, Testing & Deploy

### W4-A: WhatsApp Notifikasi (Fonnte)
- [x] W4-A-1  Buat backend/src/services/WANotifService.ts — sendSPKReceived() + sendSPKDone()
- [x] W4-A-2  Integrasi Fonnte API (env: FONNTE_TOKEN)
- [x] W4-A-3  Trigger sendSPKDone saat status -> DONE, set notifDoneSent: true
- [x] W4-A-4  Trigger sendSPKReceived saat SPK dibuat (jika ada phone), set notifReceivedSent: true
- [x] W4-A-5  Tambah FONNTE_TOKEN ke .env + dokumentasi (.env.example)

### W4-B: Invoice PDF A4
- [x] W4-B-1  Di pdfGenerator.ts — tambah function generateWorkOrderInvoicePDF()
- [x] W4-B-2  Template PDF: header bengkel, section kepada (NPWP), table SPK, subtotal+PPN, status watermark
- [x] W4-B-3  Wire up button Download PDF di InvoiceManager.tsx

### W4-C: Label Sparepart & Multi-Tier Pricing (Update)
- [x] W4-C-1  ProductView.tsx — saat bengkel, tampilkan 3 tingkat harga (Retail, Mitra, Grosir)
- [x] W4-C-2  ProductModal.tsx — saat bengkel, tampilkan input 3 tingkat harga (Retail/Umum, Mitra, Grosir + Min Qty)
- [x] W4-C-3  backend/src/routes/products.ts — simpan dan update sellPriceRetail, sellPriceMitra, sellPriceGrosir, minQtyGrosir

### W4-D: Onboarding & APK
- [x] W4-D-1  Update registrasi (TenantRegisterWizard.tsx) — tambah opsi jenis usaha "Bengkel & Servis"
- [x] W4-D-2  backend/src/routes/auth.ts (register-tenant) — terima businessType ('BENGKEL'), seed kategori bengkel & master jasa servis otomatis
- [x] W4-D-3  Verifikasi APK universal & adaptasi layout kasir / bengkel

### W4-E: Testing End-to-End
- [x] W4-E-1  Jalankan test_bengkel_vertical.ts (Isolasi & Guard) -> PASS (100%)
- [x] W4-E-2  Vertical Route Guard -> 403 / 404 isolasi cafe vs bengkel -> PASS
- [x] W4-E-3  SPK cancel stock auto-restore -> stok kembali sempurna -> PASS
- [x] W4-E-4  Perhitungan komisi mekanik -> komisi pending terakumulasi akurat -> PASS
- [x] W4-E-5  Anti-IDOR cross-tenant access check -> PASS

### W4-F: Dokumentasi
- [x] W4-F-1  SKILL.md di .agents/skills/bengkel-vertical-hardening/
- [x] W4-F-2  Dokumentasi backend/.env.example untuk FONNTE_TOKEN
- [x] W4-F-3  Checklist todo di docs/bengkel-vertical-todo.md

---

## WEEK 4+ — Integrasi Finansial, Pelaporan & Struk Thermal (Completed)

### W4-G: Modul Laporan Bengkel & Evaluasi Mekanik
- [x] W4-G-1  Backend `GET /api/bengkel/reports/summary` (Omzet Jasa vs Parts, Margin HPP, Beban Komisi, Fast Moving Spareparts, B2B Invoices)
- [x] W4-G-2  Frontend Dashboard Laporan Bengkel (`frontend/src/verticals/bengkel/BengkelReports.tsx`)
- [x] W4-G-3  Evaluasi Mekanik privat owner (Omzet Jasa yang dihasilkan & akumulasi komisi)
- [x] W4-G-4  Peringatan Suku Cadang Kritis / Fast Moving (stok <= minStock warning badge)
- [x] W4-G-5  Sidebar navigation: Tambah "Laporan Bengkel" dengan guard `isBengkel`

### W4-H: Struk Kasir Thermal 58mm/80mm
- [x] W4-H-1  Komponen `WorkOrderReceiptPrinter.tsx` — layout thermal 58mm/80mm siap print
- [x] W4-H-2  Format struk bengkel: No. Polisi, Odometer, Mekanik, rincian Jasa & Suku Cadang
- [x] W4-H-3  Klausul Garansi Servis 7 Hari Kerja di footer struk
- [x] W4-H-4  Integrasi tombol "Cetak Struk Kasir" di `WorkOrderForm.tsx` & popup sukses pembayaran `POSBengkel.tsx`

### W4-I: Sinkronisasi Arus Kas & Rekonsiliasi Shift Laci Kasir
- [x] W4-I-1  Pembayaran SPK kasir otomatis mencatat `CashFlow` `type: 'Pemasukan'`
- [x] W4-I-2  Kategori `PENJUALAN_SPK - Tunai` masuk perhitungan fisik laci kasir (`expectedCash` & `saldoSistem`)
- [x] W4-I-3  Kategori `PENJUALAN_SPK - Non-Tunai` otomatis dipisahkan dari kas fisik dan masuk ke saldo elektronik (`expectedNonCash` & `saldoElektronik`)
- [x] W4-I-4  Automated Test Suite `backend/test_bengkel_vertical.js` (5/5 PASS - 100%)

---

## Summary

| Phase | Tasks | Status | Focus |
|-------|-------|--------|-------|
| Week 1 | 22 | 100% | Database + Foundation |
| Week 2 | 25 | 100% | Backend Routes |
| Week 3 | 17 | 100% | Frontend UI |
| Week 4 | 16 | 100% | WA + PDF + Testing |
| Week 4+ | 13 | 100% | Laporan, Struk Thermal, Arus Kas |
| **Total** | **93** | **100%** | **Bengkel Vertical Siap Produksi** |

## File yang TIDAK BOLEH Diubah saat Develop Bengkel

- frontend/src/verticals/cafe/*
- backend/src/routes/orders.ts
- backend/src/routes/kds.ts
- backend/src/routes/tables.ts

