# TODO List: Pemantapan Vertikal Ritel, Toko Grosir & Toko Bangunan (CodePOS SaaS)

## Status Ringkasan
- **Tanggal Dibuat:** 26 September 2026
- **Target Release:** CodePOS v2.8 (Retail Hardening Release)
- **Status General:** SELESAI (5/5 Fase Rampung)

---

## Fase 1: Multi-UOM Stock Deduction Engine — SELESAI
- [x] [Backend] orders.ts: Simpan uomName, uomRatio, priceTierName di OrderItem.
- [x] [Backend] orders.ts: Pemotongan stok = item.qty * (uomRatio || 1) di POST /, /sync, /sync-offline.
- [x] [Backend] orders.ts: Void/cancel mengembalikan stok berdasar uomRatio.
- [x] [Frontend] POSRetail.tsx & RetailCheckoutModal.tsx: metadata UOM disertakan saat checkout.
- [x] [Verification] tsc --noEmit: Pass (Exit Code 0).

---

## Fase 2: Enforcement Limit Kredit Bon Kontraktor — SELESAI
- [x] [Backend] orders.ts & retail.ts: Validasi BON/TEMPO/PIUTANG vs creditLimit & isCreditBlocked.
- [x] [Backend] PIN override via overridePin / x-owner-pin header.
- [x] [Frontend] RetailCheckoutModal.tsx: Indikator plafon & form PIN otorisasi.
- [x] [Verification] tsc --noEmit: Pass (Exit Code 0).

---

## Fase 3: Delivery Order & PDF Surat Jalan A4 — SELESAI
- [x] [Frontend] deliveryOrderPdfGenerator.ts: PDF A4 kop surat dinamis, 3 blok tanda tangan.
- [x] [Frontend] DeliveryOrderPrintModal.tsx & DeliveryOrdersView.tsx: Form input & cetak.
- [x] [Verification] tsc --noEmit: Pass (Exit Code 0).

---

## Fase 4: Keyboard-First POS & Scanner Resiliency — SELESAI
- [x] [Frontend] POSRetail.tsx: Shortcut F1-F10, Keyboard Shortcut Bar visual.
- [x] [Frontend] hardwareBarcodeListener.ts: Burst detection <50ms scanner USB.
- [x] [Verification] tsc --noEmit: Pass (Exit Code 0).

---

## Fase 5: Paritas Backup & Reset Multi-Tenant — SELESAI
- [x] [Backend] database.ts: exportPrismaJsonBackup + info endpoint mencakup productUOM, productPriceTier, deliveryOrder, deliveryOrderItem.
- [x] [Backend] tenantReset.ts POST /transactions: hapus DeliveryOrderItem->DeliveryOrder.
- [x] [Backend] tenantReset.ts POST /full: hapus ProductUOM & ProductPriceTier sebelum Product.
- [x] [Backend] tenantReset.ts POST /restore/execute FULL_OVERWRITE: hapus retail entities.
- [x] [Verification] tsc --noEmit --skipLibCheck: Pass (Exit Code 0).

---

## Summary

| Fase | Deskripsi | Status |
|------|-----------|--------|
| 1 | Multi-UOM Stock Deduction Engine | SELESAI |
| 2 | Credit Limit Enforcement Bon Kontraktor | SELESAI |
| 3 | Delivery Order & PDF Surat Jalan A4 | SELESAI |
| 4 | Keyboard-First POS & Scanner Resiliency | SELESAI |
| 5 | Paritas Backup & Reset Multi-Tenant | SELESAI |

CodePOS Retail Hardening v2.8 - Seluruh 5 Fase Rampung
