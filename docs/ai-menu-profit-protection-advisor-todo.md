# Master Todo: AI Menu Engineering & Profit Protection Advisor (Tanpa Merusak Psikologi Pelanggan)

Dokumen master todo untuk implementasi fitur **AI Menu Engineering & Profit Protection Advisor** berbasis Gemini 1.5 Flash dan analisis matematis Boston Consulting Group (BCG) Matrix untuk mengoptimalkan margin laba F&B tanpa menaikkan harga jual secara sembarangan yang berisiko mengusir pelanggan setia.

---

## 🎯 Prinsip & Standar Keamanan Sistem
1. **Advisory & Zero Blind-Mutation**: AI **TIDAK PERNAH** mengubah harga atau data menu secara sepihak/otomatis. Sistem hanya menyajikan kartu rekomendasi strategis, dan keputusan akhir 100% di tangan Owner.
2. **5 Taktik Pelindung Margin (Customer-Safe)**:
   - Taktik 1: *Portion & Cost Control* (Harga tetap sama, optimasi takaran resep bahan).
   - Taktik 2: *Strategic Bundling / Combo* (Paket hemat menu laris + menu margin tebal).
   - Taktik 3: *Add-On & Modifier Monetization* (Menu utama murah, laba dari topping/upgrade).
   - Taktik 4: *Decoy Menu Effect* (Menu umpan ukuran besar/signature).
   - Taktik 5: *Multi-Channel Differentiation* (Dine-in tetap harga lama, delivery ojol disesuaikan komisi).
3. **Strict Multi-Tenant Independence**: Hanya membaca data produk, resep, dan penjualan milik `tenantId` yang sedang login. Prompt AI 100% terisolasi tanpa kebocoran data antar-tenant.
4. **Resilient Dual-Engine (AI + Rule-Based Mathematical Fallback)**: Jika API Key Gemini belum dipasang, habis kuota, atau server Google offline, sistem otomatis menghitung matriks BCG dan menyajikan rekomendasi berbasis aturan industri F&B standar tanpa error.

---

## 📋 Checklist Eksekusi Step-by-Step

### 🧠 FASE 1: Core Mathematical Engine & BCG Matrix Calculator
- [x] **1.1** Buat `backend/src/services/AiMenuOptimizerService.ts`:
  - Hitung Food Cost per produk: `(HPP Resep / Harga Jual) * 100`.
  - Agregasi volume penjualan 30 hari terakhir dari tabel `OrderItem`.
  - Klasifikasi produk ke dalam 4 kuadran Menu Engineering:
    - 🌟 **Stars**: Penjualan Tinggi + Margin Tinggi (Food Cost <= 32%).
    - 🐴 **Plowhorses**: Penjualan Tinggi + Margin Tipis (Food Cost > 35%).
    - ❓ **Puzzles**: Penjualan Rendah + Margin Tinggi.
    - 🐕 **Dogs**: Penjualan Rendah + Margin Tipis.
  - Hitung Rata-rata Food Cost Keseluruhan Restoran (% Health Indicator).

---

### 🤖 FASE 2: Gemini 1.5 Flash Prompting & Dual-Engine Fallback
- [x] **2.1** Integrasikan pemanggilan Gemini 1.5 Flash Vision/Text di `AiMenuOptimizerService.ts`:
  - Masukkan data ringkasan kuadran menu tenant (tanpa identitas sensitif).
  - Format respon JSON terstruktur:
    - `overallHealthScore`: Skor kesehatan menu (0-100).
    - `totalPotentialProfitMonthly`: Estimasi kenaikan laba bulanan (Rp).
    - `strategies`: Array kartu taktik dengan klasifikasi `riskLevel` ('ZERO_RISK', 'LOW_RISK', 'MEDIUM_RISK'), judul taktik, menu target, penjelasan psikologis, dan aksi yang disarankan.
- [x] **2.2** Buat **Mathematical Fallback Generator**:
  - Jika Gemini offline/error, generate rekomendasi otomatis berbasis template logika BCG yang valid.

---

### 🌐 FASE 3: Backend API Endpoints
- [x] **3.1** Tambahkan endpoint `GET /api/analytics/ai-menu-advisor` di `backend/src/routes/analytics.ts`:
  - Dilengkapi fail-closed tenant scoping `requireTenantId()`.
  - Caching hasil analisis via `cacheService` (TTL 1 jam) agar tidak boros kuota token AI saat dibuka berkali-kali.
- [x] **3.2** Dukung force refresh query parameter `?refresh=true` untuk invalidasi cache analitik sesuai permintaan Owner.

---

### 🎨 FASE 4: Frontend UI (Interactive AI Advisor Modal)
- [x] **4.1** Buat komponen `frontend/src/components/AiMenuOptimizerModal.tsx`:
  - **Header & Health Gauge**: Menampilkan Skor Kesehatan Menu (% Rata-rata Food Cost).
  - **Kuadran Matrix BCG Tabs**: Star, Plowhorse, Puzzle, Dog dengan badge jumlah menu.
  - **Kartu Rekomendasi AI**:
    - Badge Risiko Hijau/Kuning: *"Risiko Pelanggan: 0% (Optimasi Takaran)"*, *"Risiko: Sangat Rendah (Paket Combo)"*.
    - Rincian kalkulasi: Estimasi tambahan laba per bulan (+Rp X.XXX.XXX).
  - Tombol aksi: "Segarkan Analisis AI" & "Terapkan Ide Bundling".
- [x] **4.2** Tambahkan tombol trigger *"✨ AI Profit & Menu Advisor"* di toolbar atas `ProductView.tsx` dan `ReportView.tsx`.

---

### 🧪 FASE 5: Pengujian, Validasi & Observabilitas
- [x] **5.1** Buat script pengujian automated `backend/scripts/test_ai_menu_advisor.js`:
  - Uji kalkulasi Food Cost & klasifikasi 4 kuadran BCG (Stars, Plowhorses, Puzzles, Dogs) -> 20/20 PASS.
  - Uji pemanggilan service (Gemini + fallback rule-based) -> PASS.
  - Uji strict tenant isolation (Tenant A tidak bisa membaca menu Tenant B) -> PASS.
  - Uji caching analitik & parameter `?refresh=true` -> PASS.
- [x] **5.2** Uji build TypeScript backend (`npx tsc --noEmit` & `npm run build`) & frontend (`npm run build`) -> PASS (0 errors).
- [x] **5.3** Uji regresi keamanan Phase 10 IDOR (6/6 PASS), BullMQ background queues (15/15 PASS), dan Redis cache (18/18 PASS).
