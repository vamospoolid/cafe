# 🚀 TODO LIST: SAAS LANDING PAGE & GROWTH CONVERSION ENGINE

Dokumen ini adalah roadmap eksekusi perancangan, penyempurnaan estetika, fitur interaktif, dan optimalisasi konversi (*conversion rate optimization*) pada Landing Page SaaS Codenusa POS.

---

## 📌 Phase 1: Visual Design System & Hero Showcase
- [x] **1.1. Visual Polish & Glow Aesthetics**:
  - [x] Tambahkan animated background mesh gradient & glowing ambient backdrop.
  - [x] Sempurnakan floating badge dengan micro-animation (*pulse, shimmer, sparkle*).
- [x] **1.2. High-Impact Value Proposition**:
  - [x] Tampilkan headline dan sub-headline yang memikat pemilik bisnis F&B / kafe.
  - [x] Pasang visual mockups tablet POS kasir dan KDS dapur interaktif.
- [x] **1.3. Quick Action CTAs**:
  - [x] Tombol CTA utama: "Coba Gratis 14 Hari" (Membuka Onboarding Wizard).
  - [x] Tombol CTA sekunder: "Lihat Demo Interaktif" & "Masuk ke Kasir".

---

## 📌 Phase 2: Interactive Product Simulator (Live Experience)
- [x] **2.1. Tabbed Feature Switcher**:
  - [x] **Tab POS Kasir**: Keranjang belanja interaktif (+/- qty, total realtime, pilihan meja, & simulasi QRIS Midtrans popup).
  - [x] **Tab Kitchen Display System (KDS)**: Tiket pesanan real-time dengan timer memasak & transisi status (`Cooking` -> `Ready` -> `Served`).
  - [x] **Tab Resep & Supply Chain**: Progress bar gramatur bahan baku terpotong dan transfer gudang pusat.
  - [x] **Tab Blind Z-Report & HR**: Rekonsiliasi kasir tanpa intip saldo dan formula bagi hasil mitra.
- [x] **2.2. Interactive Device Mockup Frame**:
  - [x] Frame tablet & monitor dapur responsif dengan indikator koneksi online/offline.

---

## 📌 Phase 3: Hardware Freedom & Ecosystem Showcase
- [x] **3.1. Grid Perangkat Kompatibel**:
  - [x] Kartu interaktif: Printer Thermal Bluetooth/USB/LAN, Tablet Android & iPad, Laci Kasir RJ-11, Dual-Screen Display.
- [x] **3.2. PWA & Mobile Kasir Guide**:
  - [x] Modal panduan cara install aplikasi PWA di Android & iOS Safari tanpa biaya App Store.

---

## 📌 Phase 4: Interactive Business ROI & Profit Calculator
- [x] **4.1. Real-Time Sliders**:
  - [x] Slider jumlah transaksi harian (30 - 800 order/hari).
  - [x] Slider rata-rata nilai belanja per tamu (Rp 15.000 - Rp 200.000).
- [x] **4.2. Metric Output Display**:
  - [x] Jam kerja kasir yang dihemat per bulan (+XX jam).
  - [x] Nilai rupiah pencegahan bahan baku terbuang (*food waste reduction*).
  - [x] Estimasi penambahan profit bersih bulanan.

---

## 📌 Phase 5: Transparent SaaS Pricing Table & Billing Toggle
- [x] **5.1. Dynamic Billing Switch**:
  - [x] Toggle Bulanan vs Tahunan dengan badge diskon hemat 20%.
- [x] **5.2. Tier Pricing Cards**:
  - [x] **Starter Plan** (Single Outlet / UMKM).
  - [x] **Growth Plan** (Paling Populer - Multi-Outlet & KDS).
  - [x] **Business Plan** (Terlengkap - Central Warehouse & Resep HPP).
- [x] **5.3. One-Click Plan Selection & Full Feature Matrix**:
  - [x] Tombol "Pilih Paket" otomatis membuka Onboarding Wizard dengan `planCode` terpilih.
  - [x] Modal matriks tabel perbandingan fitur lengkap antar paket.

---

## 📌 Phase 6: Social Proof, Testimonials & Trust Badges
- [x] **6.1. Client Testimonial Cards**:
  - [x] Ulasan dari pemilik Muki Ramen (4 cabang), Senja Coffee Roastery, dan Artisan Bistro.
- [x] **6.2. Platform Reliability Badges**:
  - [x] 99.99% Uptime Cloud, Midtrans Level 2 BYOK Direct Settlement, Enkripsi AES-256.

---

## 📌 Phase 7: Customer Support Integration & FAQ Accordion
- [x] **7.1. Integrated Floating CS Widget**:
  - [x] Akses langsung WhatsApp Support 24/7 dengan pesan otomatis terformat.
  - [x] Form kirim tiket helpdesk resmi (`POST /api/support/tickets`).
- [x] **7.2. Searchable FAQ Accordion**:
  - [x] Jawaban seputar mode offline, rekening pencairan QRIS, setup hardware printer, dan migrasi data.

---

## 📌 Phase 8: SEO Optimization & Production Verification
- [x] **8.1. Meta Tags & OpenGraph**:
  - [x] Title, meta description, keywords, dan OpenGraph preview di `index.html`.
- [x] **8.2. Build & Performance Testing**:
  - [x] `npm run build` lolos 0 error (✓ built in 4.19s).
