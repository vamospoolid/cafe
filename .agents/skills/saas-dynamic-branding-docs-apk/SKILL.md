---
name: saas-dynamic-branding-docs-apk
description: Standar arsitektur & operasional integrasi identitas tenant SaaS hulu-ke-hilir: sinkronisasi profil dari onboarding AI Google Maps, isolasi murni dokumen resmi (PDF, Excel, Struk Thermal), dan kompilasi otomatis Android APK berlogo kustom.
---

# Skill: SaaS Dynamic Multi-Tenant Branding, Document Generation & Mobile APK Synthesis

Panduan standar untuk memastikan seluruh identitas dan aset branding tenant (*Nama Usaha*, *Alamat Lengkap*, *No. Telepon*, *Logo Toko*, dan *Titik Koordinat GPS*) mengalir secara utuh dan independen dari tahap pendaftaran hingga dokumen operasional dan aplikasi mobile.

---

## 🎯 1. Arsitektur Alur Data Identitas (End-to-End Data Chain)

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. HULU: ONBOARDING CEPAT VIA GOOGLE MAPS & AI (Platform Admin)       │
├────────────────────────────────────────────────────────────────────────┤
│ Input: URL Google Maps ──► URL Redirect Resolver                       │
│ Extracted Attributes:                                                  │
│   • Store Name & Suggested Slug                                        │
│   • Alamat Resmi & No. WhatsApp                                        │
│   • GPS Coordinates (Latitude, Longitude, Radius Geofencing)           │
│   • OG Image / Logo Resmi                                              │
│   ▼                                                                    │
│ Atomic Database Provisioning:                                          │
│   • Tenant (name, slug, logoUrl, status)                               │
│   • Outlet (name, code, address, phone, latitude, longitude)           │
│   • Settings (storeName, address, phone, logoUrl, receiptHeader/Footer)│
└────────────────────────────────────────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ 2. DOKUMEN RESMI & STRUK KASIR       │ │ 3. MOBILE WHITE-LABEL & APK BUILD    │
├──────────────────────────────────────┤ ├──────────────────────────────────────┤
│ Generator: `pdfGenerator.ts` & Excel │ │ Generator: `generate_branded_apk.js` │
│ • Kop surat PDF resmi berlogo tenant │ │ • Query Settings scoped by tenant.id │
│ • Alamat pemesan di Purchase Order   │ │ • Download remote logoUrl jika perlu │
│ • File Excel dinamis per slug tenant │ │ • Resize 5 Mipmap Android + Splash   │
│ • Struk thermal kasir & WhatsApp     │ │ • Injeksi nama toko ke strings.xml   │
│ • ZERO fallback ke brand Muki Ramen  │ │ • Output: [slug]-pos-cashier.apk     │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```

---

## 🛠️ 2. Aturan Emas Arsitektur (*Golden Rules*)

### Rule 1: Zero Hardcoded Brand Default in Fallbacks
- Dilarang keras menggunakan `'MUKI RAMEN'`, `'/logo-muki-ramen.png'`, atau alamat Sidorejo Wonomulyo sebagai nilai fallback di komponen manapun.
- Pola Fallback yang Sah:
  ```typescript
  // BENAR: Dinamis berjenjang
  const storeName = settings?.storeName || tenant?.name || 'KAFE & RESTORAN';
  const address = settings?.address || tenant?.address || '';
  const phone = settings?.phone || tenant?.phone || '';
  const logoUrl = settings?.logoUrl || tenant?.logoUrl || null;
  ```

### Rule 2: Dynamic Document Header & Monogram Fallback
- Jika tenant belum memiliki logo (`!logoUrl`), dokumen PDF tidak boleh memaksakan logo mangkok ramen.
- Gunakan monogram tipografi berbingkai elegan atau bar aksen warna netral:
  ```typescript
  if (logoBase64) {
    pdfDoc.addImage(logoBase64, 'PNG', margin, 11, 14, 14);
  } else {
    // Elegant accent monogram fallback
    pdfDoc.setFillColor(79, 70, 229); // Brand Indigo Accent
    pdfDoc.roundedRect(margin, 11, 14, 14, 2, 2, 'F');
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFontSize(10);
    pdfDoc.text(storeName.slice(0, 2).toUpperCase(), margin + 3.5, 20);
  }
  ```

### Rule 3: Dynamic Excel File Naming & Department Labels
- Nama file ekspor Excel wajib menyertakan slug tenant dinamis:
  ```typescript
  const filePrefix = (settings?.storeName || 'Laporan')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  XLSX.writeFile(wb, `${filePrefix}_penjualan_${sDate}_${eDate}.xlsx`);
  ```
- Pembagian laba bagi hasil (*profit sharing*) tidak boleh berlabel `'Muki Ramen (Food)'` / `'Muki Drink (Bar)'`, melainkan `'Divisi Makanan (Kitchen)'` / `'Divisi Minuman (Bar)'`.

### Rule 4: APK Generator Query Wajib Scoped `tenantId`
- Pada `scripts/generate_branded_apk.js`:
  ```javascript
  // SALAH (Mengambil baris pertama di tabel database)
  const settings = await prisma.settings.findFirst();

  // BENAR (Terkunci pada tenant yang sedang dibuild)
  const settings = await prisma.settings.findFirst({
    where: { tenantId: tenant.id }
  });
  ```
- Jika `settings.logoUrl` berupa URL internet (`http://` atau `https://`), engine APK wajib mengunduh file tersebut sementara untuk dijadikan sumber pemotongan icon Mipmaps.

### Rule 5: Auto-Create Settings dari Data Pendaftaran
- Saat tenant baru pertama kali mengakses endpoint `GET /api/settings`, jika record belum ada, buatkan otomatis berdasarkan data entitas `Tenant` yang sudah ada di database, bukan hardcoded data dummy.

---

## 📋 3. Checklist Verifikasi & Testing
1. **Audit Statis String Muki**: Memastikan tidak ada sisa `'MUKI RAMEN'` atau `'Jl. Kesadaran'` di `pdfGenerator.ts`, `excelGenerator.ts`, dan `ReceiptPrinter.tsx`.
2. **Uji Cetak PDF Tenant Asing**: Men-generate PDF untuk tenant tanpa logo $\rightarrow$ hasil bersih tanpa logo ramen dan beralamat sesuai profil tenant.
3. **Uji Ekspor Excel**: Men-generate file Excel $\rightarrow$ nama file dan header kolom sesuai nama usaha tenant aktif.
4. **Uji APK Build Scoping**: Menjalankan build APK untuk slug tenant lain $\rightarrow$ script membaca logo dan nama usaha tenant target, bukan Muki Ramen.
