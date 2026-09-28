# Prioritas 4: Advanced POS Customizations & Hospitality Enhancements

Dokumen todo list untuk pengembangan fitur kustomisasi tingkat lanjut: WhatsApp E-Receipt, Multi-Printer Routing, CRM Loyalty & Voucher Diskon, serta Kitchen Display System (KDS) Audio Alert.

---

## 📋 Master Todo List

### 📲 Modul 1: Struk Digital via WhatsApp (Paperless E-Receipt)
- [x] **1.1** Buat helper `frontend/src/utils/receiptFormatter.ts` untuk format teks struk WhatsApp (emoji, detail item, nota, subtotal, diskon, pajak, kontak kafe).
- [x] **1.2** Tambahkan tombol aksi **"Kirim WhatsApp"** di modal sukses pembayaran `CheckoutModal.tsx`.
- [x] **1.3** Tambahkan tombol aksi **"Kirim Struk WA"** di modal detail pesanan `OrderDetailModal.tsx` & riwayat transaksi.
- [x] **1.4** Validasi otomatis format nomor HP (konversi otomatis `08xx` -> `628xx`).

---

### 🖨️ Modul 2: Multi-Printer Routing & Visual Live Receipt Designer
- [x] **2.1** Modifikasi `ReceiptPrinter.tsx` untuk mendukung filtering item berdasarkan kategori produk (`kitchen` = hanya makanan/kitchen, `bar` = hanya minuman/bar, `receipt` = semua item).
- [x] **2.2** Perbarui `SettingsView.tsx` dengan visual **Live Receipt Previewer** (simulasi cetak kertas thermal 58mm & 80mm).
- [x] **2.3** Tambahkan form konfigurasi struk: catatan password Wi-Fi, pilihan 58mm/80mm, dan toggle cetak info kasir / meja.
- [x] **2.4** Simpan preferensi multi-printer & konfigurasi struk ke model `Settings` di backend dan cache lokal.

---

### 🎁 Modul 3: CRM Loyalty, Penukaran Poin & Kupon Promo (Vouchers)
- [x] **3.1** Update skema database di `schema.prisma`:
  - Model `Voucher` (`code`, `tenantId`, `type`, `amount`, `minSpend`, `maxDiscount`, `validFrom`, `validUntil`, `maxUsage`, `usedCount`, `status`).
  - Relasi `voucherId` dan `pointsUsed` pada model `Order`.
  - Jalankan `npx prisma db push` dan `npx prisma generate`.
- [x] **3.2** Buat router backend `backend/src/routes/vouchers.ts`:
  - `GET /api/vouchers` (daftar kupon promo per tenant).
  - `POST /api/vouchers` (buat kupon baru).
  - `POST /api/vouchers/validate` (validasi kupon di kasir saat checkout).
  - `PUT /api/vouchers/:id` (ubah status kupon).
  - `DELETE /api/vouchers/:id` (hapus kupon).
- [x] **3.3** Daftarkan router `/api/vouchers` di `backend/src/index.ts`.
- [x] **3.4** Modifikasi `CheckoutModal.tsx`:
  - Input kode promo / voucher dengan tombol "Pakai" dan kalkulasi diskon otomatis.
  - Opsi penukaran poin member terpilih (potongan nominal saldo poin ke subtotal).
- [x] **3.5** Integrasikan tab manajemen kupon promo di `CRMView.tsx`.

---

### 🍳 Modul 4: KDS Kitchen Audio Chime & Visual Aging Timers
- [x] **4.1** Buat audio synthesizer mandiri (Web Audio API `AudioContext`) di `KDSView.tsx` tanpa dependensi file eksternal untuk bunyi denting lonceng (kitchen chime bell) saat pesanan baru masuk dari kasir/pelayan.
- [x] **4.2** Tambahkan visual status timer dinamis pada kartu tiket pesanan dapur:
  - 🟢 **Hijau**: < 7 menit (dalam batas wajar).
  - 🟡 **Kuning**: 7 - 15 menit (perlu atensi koki).
  - 🔴 **Merah Berkedip**: > 15 menit (terlambat / mendesak disajikan).
- [x] **4.3** Tambahkan toggle mute / aktifkan audio alert di toolbar atas KDS.

---

### 🧪 Modul 5: Validasi & Testing
- [x] **5.1** Verifikasi build TypeScript backend (`npx tsc --noEmit`) -> 0 errors.
- [x] **5.2** Verifikasi build bundle frontend (`npm run build`) -> 0 errors.
- [x] **5.3** Uji coba transaksi kasir dengan voucher promo dan penukaran poin.
- [x] **5.4** Uji coba generate struk WhatsApp langsung.
- [x] **5.5** Uji coba denting lonceng KDS saat pesanan baru masuk.
