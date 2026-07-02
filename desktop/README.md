# SOL CAFE POS — Electron Desktop App

Aplikasi desktop kasir SOL CAFE dengan **raw ESC/POS thermal printing** langsung ke printer USB.

## Arsitektur

```
┌─────────────────────────────────────────────┐
│              Electron Window                │
│  ┌───────────────────────────────────────┐  │
│  │     cafe.codenusa.id (WebView)        │  │
│  │                                       │  │
│  │  Klik "Cetak Struk" ──► preload.js    │  │
│  │                           │           │  │
│  └───────────────────────────┼───────────┘  │
│                              │ IPC          │
│  main.js ◄───────────────────┘              │
│     │                                       │
│  printer.js                                 │
│     │                                       │
│     ├── buildReceipt()  → Buffer ESC/POS    │
│     ├── buildKitchen()  → Buffer ESC/POS    │
│     │                                       │
│     └── sendToWindowsPrinter()              │
│            │                                │
│            ▼                                │
│     copy /b receipt.bin \\localhost\POS80    │
└─────────────────────────────────────────────┘
                    │
                    ▼
           🖨️ Printer Thermal
           (Iware XS 80 BT / USB)
```

## File Structure

```
desktop/
├── package.json      # Konfigurasi Electron + electron-builder
├── main.js           # Main process: window + IPC handlers
├── preload.js        # Bridge: expose printer API ke web
├── printer.js        # ESC/POS builder + raw USB print
├── .gitignore
└── assets/
    └── icon.png      # (tambahkan icon aplikasi di sini)
```

## Alur Cetak (Prioritas)

```
handleDirectPrint()
  │
  ├─ 1. Electron? → window.electronPOS.printer.printReceipt()
  │     → Raw ESC/POS ke USB → TAJAM, INSTAN, SILENT
  │
  ├─ 2. Mobile Bluetooth? → printBluetoothReceipt()
  │     → ESC/POS via Bluetooth
  │
  ├─ 3. Network IP? → POST /api/printer/receipt
  │     → ESC/POS via TCP/IP port 9100
  │
  └─ 4. Fallback → window.print()
        → Browser dialog → bitmap (kurang tajam)
```

## Cara Menjalankan

### Prasyarat
- **Node.js 18+** terinstal di komputer kasir Windows
- **Printer thermal 80mm** terhubung via USB (misalnya Iware XS 80 BT)

### Install & Run

```bash
# 1. Masuk ke folder desktop
cd desktop

# 2. Install dependencies
npm install

# 3. Jalankan aplikasi
npm start

# 4. Jalankan dengan DevTools (development)
npm start -- --dev
```

### Build Installer (.exe)

```bash
# Build installer NSIS
npm run build

# Atau build portable (tanpa install)
npm run build:portable
```

Hasil build ada di folder `desktop/dist/`.

## Konfigurasi Printer

Secara default, aplikasi mengirim ke printer bernama **`POS80 Printer`** (sesuai nama printer Windows Anda).

Untuk mengubah, panggil dari console browser di dalam Electron:
```javascript
window.electronPOS.printer.setPrinter('NamaPrinterAnda')
```

## Metode Pengiriman ke Printer (Fallback)

`printer.js` menggunakan 3 metode berurutan:

1. **Windows Share** — `copy /b file.bin \\localhost\POS80 Printer`
2. **PowerShell Port** — Tulis langsung ke port USB via WMI
3. **Print Command** — `print /d:"\\localhost\POS80 Printer" file.bin`

Jika metode pertama gagal, otomatis coba metode berikutnya.
