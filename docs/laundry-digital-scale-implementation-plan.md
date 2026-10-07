# Rencana Implementasi & Panduan Arsitektur: Konektivitas Timbangan Digital Real-Time (CodePOS Laundry)

Dokumen ini merinci cetak biru teknis (*technical blueprint*) untuk menghubungkan perangkat keras timbangan digital komersial (Sayaki, CAS, Matrix, Yaohua, dll.) secara langsung ke antarmuka kasir **CodePOS Laundry** menggunakan teknologi **Web Serial API** (Zero-Installation / Native Browser).

---

## 1. Arsitektur Konektivitas & Alur Data

```
┌─────────────────────────────────┐
│ Timbangan Digital (RS-232 / USB)│
│  Sayaki / CAS / Matrix / Sonic  │
└────────────────┬────────────────┘
                 │ (Kabel USB-Serial FTDI/CH340: 9600 8-N-1)
                 ▼
┌─────────────────────────────────┐
│     Sistem Operasi (Windows)    │
│       Virtual COM Port (COM3)   │
└────────────────┬────────────────┘
                 │ (navigator.serial Stream)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ CodePOS Frontend (Web Application)                          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ digitalScaleDriver.ts (Core Engine)                     │ │
│ │  • Web Serial Connection Manager (requestPort / open)   │ │
│ │  • TextDecoderStream & Line Buffer Chunking             │ │
│ │  • Multi-Protocol Regex Parser (CAS, Sayaki, Matrix)    │ │
│ │  • Jitter Filter & Stable State Detector (ST vs US)     │ │
│ │  • Virtual Scale Simulator (untuk testing tanpa alat)   │ │
│ └────────────────────────────┬────────────────────────────┘ │
│                              │ Event Callback (weight, isStable)
│                              ▼                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ POSLaundry.tsx (UI Tactile Widget)                      │ │
│ │  • LED LCD Display update otomatis desimal Kg           │ │
│ │  • Indikator Status: [TERHUBUNG COM3] / [MANUAL]        │ │
│ │  • Auto-Lock on Stable + Audio Beep Konfirmasi          │ │
│ │  • Tombol Tare / Zeroing & Quick Presets                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Spesifikasi Modul yang Akan Dibangun

### A. Modul 1: `digitalScaleDriver.ts` (`src/utils/digitalScaleDriver.ts`)
* **Fungsi**: Mesin pembaca serial port berbasis Chromium Web Serial API.
* **Fitur Utama**:
  1. `connect(baudRate, dataBits, stopBits, parity)`: Membuka dialog izin browser dan memulai thread pembacaan stream.
  2. `autoReconnect()`: Memeriksa `navigator.serial.getPorts()` untuk menghubungkan kembali timbangan tanpa memunculkan dialog berulang saat browser di-refresh.
  3. `parseScaleString(raw)`: Parser universal untuk membaca frame:
     - CAS / Sayaki: `ST,GS,+004.25kg\r\n`
     - Matrix / Sonic: `wn004.250kg\r\n`
     - Generic ASCII: `=04.25kg\r\n` atau `4.25 KG`
  4. `Stable Lock Filter`: Mendeteksi stabilitas timbangan (`isStable`). Jika nilai berat konstan selama $\ge 600$ ms, picu event `onStableLock`.
  5. `Virtual Simulator Mode`: Generator bobot simulasi untuk kebutuhan demo, staging, atau pengujian otomatis ketika laptop pengembang tidak terhubung fisik ke timbangan.

### B. Modul 2: `DigitalScaleModal.tsx` (`src/verticals/laundry/DigitalScaleModal.tsx`)
* **Fungsi**: Modal kalibrasi & diagnostik hardware timbangan.
* **Fitur Utama**:
  1. **Serial Monitor Live Log**: Menampilkan byte ASCII mentah yang masuk dari timbangan secara real-time (sangat membantu teknisi outlet saat troubleshooting).
  2. **Pengaturan Port**: Dropdown Baud Rate (`9600`, `4800`, `2400`, `115200`), Parity (`none`, `even`, `odd`), dan Preset Merek Timbangan.
  3. **Simulator Switch**: Toggle mengaktifkan mode simulasi virtual (slider 0 s/d 25 kg) untuk pelatihan kasir baru.

### C. Modul 3: Integrasi Widget LCD di `POSLaundry.tsx`
* **Lokasi**: Bagian Digital Scale LED Housing di `POSLaundry.tsx`.
* **Fitur UX Baru**:
  1. **Hardware Connection Badge**:
     - `● USB TERHUBUNG (9600 bps)` (Hijau)
     - `○ MODE MANUAL / DISCONNECTED` (Abu-abu)
  2. **Tombol Interaktif**:
     - `[Hubungkan Timbangan USB]`
     - `[Kalibrasi / Serial Log]`
  3. **Auto-Lock Visual & Audio Cue**:
     - Saat beban diletakkan dan stabil: Angka berkedip hijau lembut, muncul badge `TERKUNCI`, dan terdengar nada *beep* singkat (via Web Audio API bawaan tanpa dependensi audio eksternal).
     - Tombol override manual tetap tersedia kapan saja jika kasir ingin mengedit manual.

---

## 3. Rencana Kerja (Actionable TODO List)

### Tahap 1: Core Engine & Multi-Protocol Parser
- [ ] **TODO 1.1**: Buat file `frontend/src/utils/digitalScaleDriver.ts`.
- [ ] **TODO 1.2**: Implementasikan class `DigitalScaleDriver` dengan Web Serial API (`navigator.serial.requestPort()` & `port.open()`).
- [ ] **TODO 1.3**: Buat parser regex universal multi-merek (CAS, Sayaki A12, Matrix, Yaohua, Sonic, ASCII standard).
- [ ] **TODO 1.4**: Implementasikan deteksi stabilitas (*anti-jitter debounce*) dan event listener `onReading` & `onStableLock`.
- [ ] **TODO 1.5**: Implementasikan mode simulasi virtual (`DigitalScaleDriver.simulateWeight()`) untuk testing tanpa perangkat keras fisik.

### Tahap 2: Modal Konfigurasi & Serial Terminal Monitor
- [ ] **TODO 2.1**: Buat komponen `DigitalScaleModal.tsx` di `frontend/src/verticals/laundry/`.
- [ ] **TODO 2.2**: Pasang tab **Terminal Log** untuk memantau aliran raw string dari port serial secara real-time.
- [ ] **TODO 2.3**: Buat form preset konfigurasi: Baud Rate, Parity, Format Timbangan, dan ambang batas stabilitas (ms).
- [ ] **TODO 2.4**: Simpan preferensi baud rate di `localStorage` agar persisten per perangkat kasir.

### Tahap 3: Penyempurnaan Widget LCD & Interaktivitas di `POSLaundry.tsx`
- [ ] **TODO 3.1**: Hubungkan instance `DigitalScaleDriver` ke state `scaleWeight` di `POSLaundry.tsx`.
- [ ] **TODO 3.2**: Tambahkan badge status koneksi serial dan tombol koneksi `[Hubungkan Timbangan]` pada header LCD box.
- [ ] **TODO 3.3**: Tambahkan Web Audio API Synthesizer (suara *beep* frekuensi 880Hz selama 100ms) saat timbangan mengunci bobot stabil.
- [ ] **TODO 3.4**: Pastikan mode input manual (ketik angka dan tombol preset chip `+0.5`, `3 Kg`, `5 Kg`) tetap berfungsi fleksibel sebagai fallback jika kabel timbangan dilepas.

### Tahap 4: Pengujian & Validasi
- [ ] **TODO 4.1**: Uji kompilasi TypeScript `npm run build` untuk memastikan tidak ada kesalahan tipe.
- [ ] **TODO 4.2**: Uji coba simulasi penimbangan virtual di browser (bobot berubah otomatis, auto-calculate subtotal kiloan, dan stable lock audio).
- [ ] **TODO 4.3**: Buat dokumentasi panduan teknisi untuk outlet kasir laundry mengenai cara menyambungkan kabel USB-RS232 di Windows (Device Manager COM Port).
