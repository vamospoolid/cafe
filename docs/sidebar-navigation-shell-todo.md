# Master Todo List: Sidebar Layout & Navigation Shell (SaaS Developer Control Plane)

Dokumen acuan teknis dan checklist pengembangan/penyempurnaan modul **Sidebar Layout & Navigation Shell** pada portal pengembang SaaS (`/platform-admin`). Dokumen ini mencakup arsitektur shell, 7 modul navigasi, real-time counters, adaptasi mobile/tablet, serta standardisasi UX/UI premium.

---

## 📋 Daftar Pekerjaan (Master Tasks)

### 🧱 Modul 1: Layout Core & Container Architecture (Shell Foundation)
- [x] **1.1** Komponen modular terpisah `PlatformAdminSidebar.tsx` dengan layout flex-col vertikal (`w-full lg:w-72 shrink-0`).
- [x] **1.2** Standar visual *Indigo Glassmorphism* (`bg-white/90 backdrop-blur-xl border-slate-200/90 rounded-3xl`).
- [x] **1.3** Header indikator runtime master (`Node.js v20` dengan green pulsing indicator).
- [x] **1.4** Fitur Collapsible/Mini-Sidebar (opsi mode sempit/ikon saja untuk memaksimalkan ruang kerja tabel tenant).
- [x] **1.5** Sinkronisasi state URL browser via Search Params (`/platform-admin?tab=overview`) agar tab aktif tidak hilang saat di-refresh.

---

### 🧭 Modul 2: Integrasi 7 Modul Navigasi & Viewport Switcher
- [x] **2.1** Tab **Financial & MRR** (`overview`):
  - Integrasi icon `TrendingUp` & emerald gradient active state.
  - Viewport: Chart MRR/ARR, breakdown paket, dan konversi langganan.
- [x] **2.2** Tab **Direktori Tenant** (`tenants`):
  - Integrasi icon `Building2` & indigo gradient active state.
  - Viewport: Katalog mitra usaha, search filter, drawer detail tenant, dan fitur impersonation.
- [x] **2.3** Tab **Paket & Fitur** (`plans`):
  - Integrasi icon `Sliders` & violet gradient active state.
  - Viewport: Live configurator tier, edit limit kuota, dan matriks fitur on/off.
- [x] **2.4** Tab **Tagihan & Invoice** (`invoices`):
  - Integrasi icon `CreditCard` & sky/blue gradient active state.
  - Viewport: Verifikasi 1-klik transfer manual & status settlement Midtrans.
- [x] **2.5** Tab **Database & Backup** (`database`):
  - Integrasi icon `Database` & purple/indigo gradient active state.
  - Viewport: Health pool PostgreSQL, metrik baris tabel, dan pemicu safe backup `.sql`.
- [x] **2.6** Tab **Broadcast Siaran** (`warnings`):
  - Integrasi icon `AlertTriangle` & amber/orange gradient active state.
  - Viewport: Pengirim pesan darurat/pemeliharaan ke kasir tenant.
- [x] **2.7** Tab **Audit Security Log** (`logs`):
  - Integrasi icon `ShieldCheck` & teal/emerald gradient active state.
  - Viewport: Rekaman audit trail aksi administratif developer.

---

### ⚡ Modul 3: Dynamic Badges & Real-Time Telemetry
- [x] **3.1** Counter dinamis jumlah total tenant aktif pada item menu Direktori Tenant.
- [x] **3.2** Pulsing alert badge merah (`bg-rose-500 animate-pulse`) pada menu Tagihan jika ada invoice *UNPAID*.
- [x] **3.3** Warning badge (`bg-amber-500`) pada menu Broadcast jika terdapat siaran pengumuman aktif.
- [x] **3.4** Sinkronisasi real-time telemetry counter via periodic silent polling (30 detik).
- [ ] **3.5** Indikator notifikasi suara halus (subtle chime) saat invoice baru berstatus menunggu verifikasi.

---

### 🎨 Modul 4: UX Enhancements, Micro-Interactions & Accessibility
- [x] **4.1** Animasi transisi panah `ChevronRight` (muncul dan bergeser saat hover).
- [x] **4.2** Aksen ikon interaktif (hover scale-up `group-hover:scale-105` dan dynamic background).
- [x] **4.3** Kartu status keamanan di bawah sidebar (*RLS Multi-Tenant: Active Gate*).
- [x] **4.4** Aksesibilitas Keyboard Navigasi & Shortcut:
  - Shortcut angka cepat (`Alt + 1` s.d. `Alt + 7`) untuk berpindah tab tanpa mouse.
  - Shortcut toggle mini-sidebar (`Alt + B`).
- [x] **4.5** Tooltip informatif pada mode mini-sidebar dan title deskripsi sub-menu.

---

### 📱 Modul 5: Responsive & Mobile Drawer Adaptations
- [x] **5.1** Layout responsif dasar: beralih dari satu kolom ke side-by-side pada breakpoint `lg` (1024px).
- [x] **5.2** Mobile Sliding Drawer / Bottom Sheet untuk layar smartphone/tablet (`< 1024px`) dengan trigger tombol hamburger mengambang (*floating pill*).
- [x] **5.3** Backdrop overlay click-to-close pada drawer navigasi mobile.
- [x] **5.4** Dynamic Breadcrumb bar & Quick Telemetry Refresh button.

---

### 🛡️ Modul 6: Security, Role Guards & Breadcrumbs
- [x] **6.1** Proteksi akses `isPlatformAdmin: true` pada seluruh router backend `/api/platform-admin/*`.
- [x] **6.2** Penolakan otomatis (403 Forbidden) bagi role kasir/manager biasa yang mencoba memanggil telemetri developer.
- [x] **6.3** Breadcrumb dinamis di atas konten aktif (`Platform Admin > [Active Tab Title] > Live Workspace`).
- [x] **6.4** Quick Exit / Back Shortcut: Tombol kembali instan ke POS Kasir atau Dashboard Tenant dengan indikator sesi yang jelas.

---

### 🧪 Modul 7: Quality Assurance & Validasi Build
- [x] **7.1** Kompilasi TypeScript Frontend (`npx tsc --noEmit`) -> 0 errors.
- [x] **7.2** Uji isolasi keamanan developer via script automated `test_phase1_isolation.js` -> 100% Passed.
- [x] **7.3** Pengujian performa render & sinkronisasi URL search params (`?tab=...`).
- [ ] **7.4** Uji kompatibilitas cross-browser (Chrome, Firefox, Safari, Edge) untuk efek glassmorphism backdrop-blur.
