# Implementation Plan: Dual Bluetooth Printer (Kasir & Dapur) untuk CodePOS SaaS Multi-Tenant

Dokumen ini adalah **Rencana Implementasi & Standar Arsitektur Resmi** untuk mengintegrasikan fitur **Dual Bluetooth Thermal Printer (1 Printer Struk Kasir + 1 Printer Tiket Dapur)** ke dalam ekosistem platform SaaS multi-tenant **CodePOS** (`c:\ADATA\codepos`).

---

## 1. Ringkasan & Ruang Lingkup (Scope of Work)

### 1.1 Tujuan
Memungkinkan 1 tablet / HP Android kasir untuk mengontrol **2 unit printer termal Bluetooth** secara bersamaan:
1. **Printer Struk Kasir:** Mencetak nota belanja konsumen lengkap dengan rincian harga, PPN, diskon, dan QRIS.
2. **Printer Tiket Dapur / Koki:** Mencetak tiket pesanan makanan langsung ke bagian dapur tanpa mencantumkan harga dan dengan teks nomor meja yang tebal/besar.

### 1.2 Masalah yang Diselesaikan
* **Hardware Socket Collision di Android (SPP / RFCOMM):** Android native Bluetooth serial hanya mengizinkan 1 koneksi RFCOMM aktif pada satu waktu. Jika berpindah printer tanpa multiplexing soket, koneksi terputus dan aplikasi freeze/crash.
* **Hilangnya Pairing Saat Logout:** Di versi sebelumnya, `localStorage.removeItem('bluetooth_printer_*')` dipanggil saat kasir logout, menyebabkan kasir harus pairing ulang setiap pergantian shift.
* **Penyaringan Perangkat Unpaired:** Perangkat bluetooth thermal baru yang belum di-pair di level Android OS tidak muncul pada scan biasa.
* **Fallback Otomatis:** Jika merchant hanya membeli 1 printer (atau printer dapur kehabisan kertas/mati), pesanan dapur otomatis dicetak ke printer kasir tanpa error.

---

## 2. Rincian Tahapan Implementasi (Implementation Phases)

### Tahap 1: Persistensi Hardware Binding (Logout Non-Destructive)
* **File Target:** `frontend/src/context/POSContext.tsx`
* **Tindakan:**
  * Hapus baris pembersihan `bluetooth_printer_*` dan `pos_device_paired` pada fungsi `logout()`.
  * Konfigurasi hardware fisik tablet kasir harus tetap tersimpan meskipun kasir berganti shift atau logout akun.

### Tahap 2: Core Engine Dual Role & Sequential Socket Multiplexing
* **File Target:** `frontend/src/utils/printerBluetooth.ts`
* **Tindakan:**
  * Tambahkan tipe `PrinterRole = 'cashier' | 'kitchen'`.
  * Buat getter/setter independen:
    * `getSavedBluetoothPrinter(role)`
    * `saveSavedBluetoothPrinter(role, info)`
    * `clearSavedBluetoothPrinter(role)`
  * Implementasikan arsitektur **Sequential Socket Multiplexing** di `printRawBytes(bytes, role)`:
    * Lacak `currentConnectedMac`.
    * Jika `targetMac !== currentConnectedMac` dan soket sedang aktif, putus soket lama dengan jeda stabilisasi (250ms), lalu hubungkan ke `targetMac`.
    * Mekanisme *Auto-Retry 1x* jika pengiriman buffer byte awal mengalami gangguan.
  * Tambahkan fungsi pencarian perangkat baru: `discoverUnpairedBluetoothDevices()`.
  * Format tiket dapur ESC/POS: `printBluetoothKitchenTicket(order, target, settings)` dengan format tabel item, catatan masak (*notes*), dan nomor meja tebal.

### Tahap 3: Desain Ulang Antarmuka Pengaturan Printer
* **File Target:** `frontend/src/components/settings/SettingsBluetoothPrinter.tsx`
* **Tindakan:**
  * Tab Selector: `[ 💳 Printer Struk Kasir ]` & `[ 🍜 Printer Tiket Dapur ]`.
  * Kartu status visual terpisah dengan indikator status dot hijau/oranye.
  * Tombol 1-tap instan pada daftar scan: `[ + Set Kasir ]` dan `[ + Set Dapur ]`.
  * Tombol `[ Cari Perangkat Baru ]` (BLE & Unpaired scan).
  * Tombol `Tes Cetak Kasir` dan `Tes Cetak Dapur`.

### Tahap 4: Integrasi POS Flow & Checkout Modal
* **File Target:** `frontend/src/components/CheckoutModal.tsx`
* **Tindakan:**
  * Arahkan `handleDirectPrint(id)` ke role `'cashier'`.
  * Arahkan `handlePrintSpecificTarget(id, 'kitchen')` ke role `'kitchen'` dengan fallback otomatis ke `'cashier'`.
  * Tampilkan badge status kesiapan kedua printer pada modal selesai pembayaran.
  * Hubungkan hook auto-print: saat transaksi selesai, cetak struk kasir lalu cetak tiket dapur secara berurutan.

### Tahap 5: Kompatibilitas Multi-Vertikal SaaS (Kafe, Bengkel, Retail, Laundry)
* Standarisasi peran printer:
  * **Kafe / Resto:** Kasir (Nota) vs Dapur (Tiket Koki).
  * **Bengkel:** Kasir (Invoice Jasa & Sparepart) vs Dapur/Workshop (Work Order / SPK Mekanik).
  * **Retail / Toko:** Kasir (Struk Belanja) vs Gudang (Surat Jalan / Packing Slip).
  * **Laundry:** Kasir (Nota Konsumen) vs Workshop (Tiket Spk Cuci / Tempelan Plastik).

### Tahap 6: Build & Validasi
* Jalankan `npm run build` di `c:\ADATA\codepos\frontend` untuk memastikan zero type-error.
* Verifikasi persistensi dan switching soket.

---

## 3. Matriks Penyimpanan LocalStorage

| Kunci LocalStorage | Tipe Data | Kegunaan |
| :--- | :--- | :--- |
| `bluetooth_cashier_printer_mac` | String (MAC/UUID) | MAC Address Printer Struk Kasir |
| `bluetooth_cashier_printer_name` | String | Nama Bluetooth Printer Kasir |
| `bluetooth_cashier_printer_type` | String | `BLUETOOTH_CLASSIC` / `WEB_BLUETOOTH` |
| `bluetooth_kitchen_printer_mac` | String (MAC/UUID) | MAC Address Printer Tiket Dapur |
| `bluetooth_kitchen_printer_name` | String | Nama Bluetooth Printer Dapur |
| `bluetooth_kitchen_printer_type` | String | `BLUETOOTH_CLASSIC` / `WEB_BLUETOOTH` |
| `bluetooth_printer_mac` *(legacy)* | String | Kompatibilitas mundur modul legacy |
| `printer_paper_width` | String | `58mm` atau `80mm` |
