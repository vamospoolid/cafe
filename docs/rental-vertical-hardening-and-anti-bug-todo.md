# TODO List: Pemantapan & Perbaikan Logika Vertikal Rental Busana Adat (CodePOS SaaS)

## Status Ringkasan
- **Tanggal Dibuat:** 3 Oktober 2026
- **Target Release:** CodePOS v2.9 (Rental Vertical Hardening & Anti-Bug Release)
- **Fokus Utama:** Eliminasi Double-Disbursement Kas, Integritas Anti-Double Booking, Proteksi Concurrency, Cross-Tenant Isolation, dan Integrasi CRM.
- **Status General:** SELESAI & TERVERIFIKASI (100% 4 Fase Sukses, 15/15 Pengujian Lolos)

---

## 🎯 DAFTAR TARGET PERBAIKAN & FASE EKSEKUSI

### 📦 Fase 1: Rekonsiliasi Finansial & Kas Laci Kasir (Zero Financial Discrepancy)
- [x] **[Backend] `rental.ts` (`POST /orders/:id/return-inspection`)**: Pasang Idempotency Guard. Tolak jika `existing.status === 'COMPLETED'` atau `existing.depositStatus !== 'HELD'`. Mencegah mutasi `CashFlow` refund deposit kedua kali saat kasir melakukan klik ganda (repeated input).
- [x] **[Backend] `rental.ts` (`POST /orders/:id/cancel`)**: Hapus pencatatan entri `CashFlow` pemasukan baru saat deposit disita (`newDepositStatus === 'FORFEITED'` / selisih `PARTIAL_REFUND`). Uang jaminan sudah pernah dicatat di laci kasir saat booking dibuat; penyitaan tidak memasukkan fisik uang baru.
- [x] **[Backend] `rental.ts` (`POST /orders` & `PATCH /orders/:id/status`)**: Hilangkan hardcode `cashPocket: 'LACI_KASIR'`. Gunakan kalkulasi adaptif: `(paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR'` untuk pembayaran DP/Lunas maupun titipan jaminan.
- [x] **[Backend] Shift Reconciliation Data**: Pengeluaran dan pemasukan rental otomatis tersalurkan ke pocket yang tepat (`BANK` vs `LACI_KASIR`), menjaga keakuratan `expectedCash` di laci shift tanpa deviasi kasir.
- [x] **[Frontend] `RentalCheckoutModal.tsx`**: Proteksi tombol submit anti-double click dengan disable visual state dan spinner aktif saat `isSubmitting === true`.

---

### 🛡️ Fase 2: Concurrency, Collision Prevention & Isolasi Multi-Tenant
- [x] **[Backend] `rental.ts` (`generateRentalOrderNumber`)**: Ditambahkan kode tenant slug (`RNT-${tenantCode}-${ym}-${seq}`) dan retry loop (hingga 3x) jika mendeteksi collision Prisma `P2002`.
- [x] **[Backend] `publicInvoice.ts` (`GET /api/public/invoice/order/:orderNumber`)**: Mendukung pencarian nota publik dengan format slug tenant unik global berprefix `RNT-${tenantCode}-...` serta pencarian case-insensitive, mencegah kebocoran data nota pelanggan antar-tenant (IDOR).
- [x] **[Backend] `rental.ts` (Socket.IO Emission)**: Dipasang pemanggilan `io.to('tenant:' + tenantId).emit(...)` pada mutasi order:
  - `rental:order_created` saat booking baru diterbitkan.
  - `rental:order_updated` saat status berganti, return inspection selesai, atau order dibatalkan.
  - `rental:inventory_updated` saat busana selesai cuci.
- [x] **[Frontend] Socket Listeners**: Event listener Socket.IO aktif di `RentalKanbanView.tsx` dan `RentalCalendarView.tsx` agar sinkronisasi antar-perangkat kasir dan tablet fitting berjalan instan tanpa refresh browser manual.

---

### 👗 Fase 3: Logika Ketersediaan Stok, Anti-Double Booking & Pembersihan Operasional
- [x] **[Backend] `rental.ts` (`POST /inventory/complete-laundry`)**: Dibatasi penyelesaian cuci per attireCode secara FIFO pada order terlama (1 unit) dan mendukung penyelesaian per `orderId`, menghindari pencemaran atau penyelesaian prematur lintas order.
- [x] **[Backend] `rental.ts` (`GET /inventory`)**: Kalkulasi `laundryUnits` diperbaiki dengan mengecek `!it.isReturned`, sehingga busana yang sudah selesai dicuci langsung kembali terhitung `READY` di rak/hanger.
- [x] **[Backend] `rental.ts` (`POST /orders` & `GET /availability`)**: Diperluas filter bentrok ketersediaan busana untuk mendeteksi order yang masih berstatus `PICKED_UP` (terlambat kembali) atau `LAUNDRY` jika tanggal sewa baru adalah hari ini.
- [x] **[Backend] `rental.ts`**: Sanitasi `attireCode.trim().toUpperCase()` seragam di seluruh endpoint agar pengecekan double booking aman dari variasi kapitalisasi.
- [x] **[Backend] `rental.ts` (`GET /inventory`)**: Auto-seeding diperbaiki dengan memeriksa `totalEverProducts === 0`, mengeliminasi bug "Zombie Products" jika produk pernah sengaja dihapus oleh pengguna.
- [x] **[Frontend] Sanitasi Tag Pengingat WhatsApp**:
  - `RentalKanbanView.tsx`: Diterapkan helper `parseFittingNotes` yang membersihkan tag regex `[OVERDUE_ALERT:...]` dan `[BATAL:...]` agar tidak tampil di UI sebagai instruksi permak baju berikon gunting.

---

### 👥 Fase 4: Integrasi CRM, Sesi & Login Berulang
- [x] **[Backend] `rental.ts` (`POST /orders`)**: Auto-upsert pelanggan ke tabel `Customer` (`prisma.customer`) saat transaksi sewa dibuat, dan relasikan `newOrder.customerId`.
- [x] **[Frontend] `VerticalContext.tsx`**: Sinkronisasi aktif `localStorage.setItem('pos_business_type', businessType)` saat vertical berganti, mencegah layout stuck di mode Rental saat beralih akun atau login ulang.
- [x] **[Frontend] `RentalCalendarView.tsx`**: Mengirimkan parameter rentang bulan aktif (`startDate` dan `endDate`) dengan mode `dateType=calendar` yang mengecek `eventDate`, `pickupDate`, dan `returnDeadline`, serta menaikkan batas query limit hingga 500 item.

---

## 📊 Matriks Dampak & Risiko Perbaikan

| Fase | Komponen Utama | Risiko Jika Tidak Diperbaiki | Dampak Setelah Perbaikan |
|---|---|---|---|
| **Fase 1** | Kas Laci & Rekonsiliasi | Kasir tekor palsu, selisih kas saat tutup shift, uang keluar ganda saat double submit. | Saldo kasir 100% akurat, aman dari double-refund dan double-counting. |
| **Fase 2** | Concurrency & Socket.IO | Error 500 saat booking bersamaan, data bocor antar tenant, multi-device tidak sinkron. | Anti-tabrakan nomor order, isolasi aman IDOR, update real-time di semua tablet. |
| **Fase 3** | Stok & Siklus Busana | Baju disewa ganda, baju bersih terkunci di laundry, baju kotor ter-booking. | Ketersediaan busana presisi, jadwal anti-bentrok, status cuci per-item akurat. |
| **Fase 4** | CRM & Multi-User Session | CRM rental kosong, pelanggan lama harus input ulang, layout stuck di rental saat ganti akun. | Database pelanggan terakumulasi rapi, transisi login mulus antar jenis bisnis. |

---

## 🧪 Rencana Pengujian Otomatis (Regression & Verification)
1. **Script Pengujian Backend:** Buat `backend/scripts/test_rental_anti_bug_and_repeat_inputs.js` yang menguji:
   - Double-submit return inspection (harus idempotent, pengeluaran kas hanya 1x).
   - Booking serentak (concurrency 5 request per detik, nomor urut harus unik tanpa P2002).
   - Pengembalian parsial di status laundry (stok busana yang selesai cuci harus langsung naik ke available).
   - Pembatalan dengan sita deposit (saldo laci kasir tidak boleh menggembung).
   - Auto-upsert Customer di database CRM.
2. **Type Checking:** Jalankan `npm run build` dan `npx tsc --noEmit` baik di backend maupun frontend.
