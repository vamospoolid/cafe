---
name: ingredient-management
description: >-
  Standard Operating Procedures (SOP), design architecture, and calculation rules
  for POS MUKI RAMEN inventory management, Food Waste (Stock Loss), and BOM Menu Capacity.
---

# Ingredient & Kitchen Inventory Management Skill

This skill defines the architectural standards, UI layout guidelines, and business logic formulas for the **Manajemen Bahan Baku (`/bahan-baku`)** module in MUKI RAMEN POS.

---

## 1. Bento Tab Navigation Architecture (9 Tabs)

The module is structured into 9 modular tabs organized in a 3x3 Bento grid:
1. `master` - **Master Bahan**: Katalog & Stok Fisik.
2. `daily_usage` - **Konsumsi Harian**: Daily Usage & COGS.
3. `loss` - **Waste & Kerugian HPP**: Bahan Basi & Waste Ratio.
4. `staff_activity` - **Analisis Staf Dapur**: Audit & Akuntabilitas Tim.
5. `movements` - **Kartu Stok & Alur**: Mutasi & Log Distribusi.
6. `shopping` - **Analisis Belanja**: Stok Minim & Forecast Pengadaan.
7. `forecast` - **Kapasitas Menu (BOM)**: Resep & Yield Menu Real-Time.
8. `opname` - **Audit Opname Fisik**: Rekonsiliasi Stok Riil vs Sistem.
9. `yield` - **Tingkat Keberhasilan**: Yield & Efisiensi Resep.

**Rule**: The top action bar must transition cleanly into the 9 Bento Tabs without redundant colliding headers.

---

## 2. Food Waste & Kerugian HPP (Tab `loss`) Layout Standards

### Desktop Layout (3-Column Bento Grid `lg:grid-cols-3`):
1. **Column 1 (~33%): Top 5 Item Penyumbang Kerugian**
   - Ranks 1 to 5 with rank badges.
   - Item name + Blue badge `Bahan` or Purple badge `Menu`.
   - Subtext of discarded quantity and total loss in bold red `Rp X.XXX`.
2. **Column 2 (~33%): Distribusi Alasan Kerugian**
   - Horizontal progress bar (`h-2 bg-amber-400 rounded-full`).
   - Shows reason label, total cost, incident count, and `% total HPP loss`.
3. **Column 3 (~33%): SOP Pengendalian Waste (Dark Card)**
   - Dark background: `bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl`.
   - Headline: *"Cegah Kebocoran Biaya Dapur"*.
   - Two stacked full-width action buttons:
     - Crimson button (`bg-rose-600`): `+ Catat Bahan Terbuang` (opens modal with `targetType: 'INGREDIENT'`).
     - Warm amber button (`bg-amber-600`): `+ Catat Menu / Porsi Rusak` (opens modal with `targetType: 'PRODUCT'`).

### Audit Log Table:
- Columns: `WAKTU` | `TIPE` | `NAMA ITEM` | `JUMLAH RUSAK` | `KERUGIAN HPP (RP)` | `ALASAN & CATATAN` | `DICATAT OLEH` | `AKSI`.
- `AKSI` includes a trash delete button allowing authorized staff to void erroneous entries and automatically restore inventory stock.

---

## 3. Kapasitas Menu & Bottleneck (BOM) (Tab `forecast`) Standards

### Formulas:
1. **Max Portions for Product**:
   $$\text{MaxPortions} = \min_{r \in \text{recipes}} \left\lfloor \frac{\text{stock}_r}{\text{qtyPerServing}_r} \right\rfloor$$
2. **Bottleneck Ingredient**:
   The constituent ingredient in the recipe that yields the lowest $\text{MaxPortions}$.
3. **Profit Margin Calculation**:
   $$\text{Margin \%} = \frac{\text{SellPrice} - \text{HPP}}{\text{SellPrice}} \times 100\%$$

### Visual Card Elements:
- **Card Header**:
  - Thumbnail photo (`w-12 h-12 rounded-xl object-cover`).
  - Category badge (e.g. `BEVVIES (DRINKS)`, `SWEETIES (DESSERT)`).
  - Product Name and Selling Price (`Jual: Rp X.XXX`).
  - Status pill: `● Aman` ($>15$ portions), `● Kritis` ($1-15$ portions), `● Habis` ($0$ or negative).
- **Metrics Box**:
  - `KAPASITAS SAJI`: Big bold portion count.
  - `HPP / PORSI`: Emerald bold currency + green pill `+X% Margin`.
- **Status Alert**:
  - If Aman: Green check + `Seluruh stok bahan baku mencukupi dengan optimal`.
  - If Kritis/Habis: Yellow/Red alert box highlighting `Bahan Pembatas: [Ingredient Name]` and remaining deficit.
- **Accordion Footer**:
  - Expandable toggle `Komposisi Resep (X Bahan)` revealing exact grams per serving.
