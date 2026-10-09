import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { ImageCacheService } from '../services/ImageCacheService';

const router = Router();

// ─── Preset Templates for Instant 1-Click Menu Setup ────────────────────────
const PRESET_TEMPLATES: Record<string, Array<{ category: string; printerTarget?: string; items: Array<{ name: string; price: number; buyPrice?: number }> }>> = {
  coffee_shop: [
    {
      category: 'Signature Coffee',
      printerTarget: 'BAR',
      items: [
        { name: 'Kopi Susu Gula Aren', price: 18000, buyPrice: 6500 },
        { name: 'Caramel Macchiato Ice', price: 24000, buyPrice: 8500 },
        { name: 'Vanilla Cream Latte', price: 22000, buyPrice: 7500 },
        { name: 'Americano Double Shot', price: 16000, buyPrice: 4000 },
        { name: 'Spanish Latte Dolce', price: 23000, buyPrice: 8000 }
      ]
    },
    {
      category: 'Non-Coffee & Mocktails',
      printerTarget: 'BAR',
      items: [
        { name: 'Matcha Green Tea Latte', price: 22000, buyPrice: 7500 },
        { name: 'Dark Chocolate Hazelnut', price: 20000, buyPrice: 6800 },
        { name: 'Berry Hibiscus Mocktail', price: 23000, buyPrice: 7000 },
        { name: 'Lychee Tea with Jelly', price: 18000, buyPrice: 5000 }
      ]
    },
    {
      category: 'Pastry & Light Bites',
      printerTarget: 'PASTRY',
      items: [
        { name: 'Butter Croissant French', price: 20000, buyPrice: 9000 },
        { name: 'French Fries Truffle Mayo', price: 18000, buyPrice: 6000 },
        { name: 'Churros with Chocolate Dip', price: 17000, buyPrice: 5500 },
        { name: 'Cireng Salju Rujak', price: 14000, buyPrice: 4500 }
      ]
    },
    {
      category: 'Main Course & Rice Bowl',
      printerTarget: 'KITCHEN',
      items: [
        { name: 'Nasi Gila Senopati', price: 28000, buyPrice: 11000 },
        { name: 'Rice Bowl Beef Teriyaki', price: 32000, buyPrice: 13500 },
        { name: 'Spaghetti Aglio Olio Smoked Beef', price: 30000, buyPrice: 12000 }
      ]
    }
  ],
  warmindo: [
    {
      category: 'Aneka Mie & Rebus',
      printerTarget: 'KITCHEN',
      items: [
        { name: 'Indomie Goreng Telur Kornet', price: 16000, buyPrice: 6000 },
        { name: 'Indomie Kuah Soto Spesial', price: 15000, buyPrice: 5500 },
        { name: 'Indomie Nyemek Pedas Mampus', price: 18000, buyPrice: 7000 }
      ]
    },
    {
      category: 'Nasi & Makanan Berat',
      printerTarget: 'KITCHEN',
      items: [
        { name: 'Nasi Telur Pontianak Krispi', price: 14000, buyPrice: 4500 },
        { name: 'Nasi Goreng Spesial Warmindo', price: 20000, buyPrice: 7500 },
        { name: 'Nasi Ayam Geprek Sambal Bawang', price: 22000, buyPrice: 9000 }
      ]
    },
    {
      category: 'Minuman Segar',
      printerTarget: 'BAR',
      items: [
        { name: 'Es Teh Manis Jumbo', price: 5000, buyPrice: 1500 },
        { name: 'Nutrisari Jeruk Peras', price: 6000, buyPrice: 2000 },
        { name: 'Kopi Hitam Tubruk', price: 5000, buyPrice: 1500 },
        { name: 'Kopi Good Day Cappuccino Cincau', price: 8000, buyPrice: 3000 }
      ]
    }
  ],
  resto_nusantara: [
    {
      category: 'Ayam & Bebek',
      printerTarget: 'KITCHEN',
      items: [
        { name: 'Ayam Bakar Madu Solo', price: 28000, buyPrice: 11000 },
        { name: 'Ayam Goreng Lengkuas', price: 26000, buyPrice: 10500 },
        { name: 'Bebek Goreng Sambal Korek', price: 38000, buyPrice: 17000 }
      ]
    },
    {
      category: 'Sup & Kuah',
      printerTarget: 'KITCHEN',
      items: [
        { name: 'Sop Buntut Sapi Kuah Gurih', price: 55000, buyPrice: 24000 },
        { name: 'Soto Betawi Daging Santan', price: 36000, buyPrice: 14000 },
        { name: 'Sayur Asem Jakarta', price: 12000, buyPrice: 4000 }
      ]
    },
    {
      category: 'Minuman Tradisional',
      printerTarget: 'BAR',
      items: [
        { name: 'Es Kelapa Muda Jeruk', price: 16000, buyPrice: 5000 },
        { name: 'Es Cendol Durian Legit', price: 22000, buyPrice: 8000 },
        { name: 'Wedang Jahe Sereh Hangat', price: 12000, buyPrice: 3500 }
      ]
    }
  ],
  bengkel_motor: [
    {
      category: 'Jasa Servis Motor',
      printerTarget: 'NONE',
      items: [
        { name: 'Servis Ringan / Tune Up Bebek & Matic', price: 45000, buyPrice: 0 },
        { name: 'Servis CVT & Pembersihan Belt', price: 35000, buyPrice: 0 },
        { name: 'Jasa Ganti Oli Mesin & Gardan', price: 15000, buyPrice: 0 },
        { name: 'Servis Injeksi / Throttle Body Cleaner', price: 50000, buyPrice: 10000 },
        { name: 'Ganti Kampas Rem Depan / Belakang', price: 20000, buyPrice: 0 }
      ]
    },
    {
      category: 'Oli & Pelumas Motor',
      printerTarget: 'NONE',
      items: [
        { name: 'Oli Mesin MPX2 0.8L Matic', price: 55000, buyPrice: 42000 },
        { name: 'Oli Mesin Yamalube Silver 0.8L', price: 50000, buyPrice: 38000 },
        { name: 'Oli Gardan / Gear Oil 120ml', price: 18000, buyPrice: 12000 },
        { name: 'Oli Samping 2T Wangi 0.7L', price: 45000, buyPrice: 33000 }
      ]
    },
    {
      category: 'Sparepart Fast Moving Motor',
      printerTarget: 'NONE',
      items: [
        { name: 'Busi Standar Denso U24EPR9', price: 25000, buyPrice: 16000 },
        { name: 'Kampas Rem Depan Honda Beat/Vario', price: 45000, buyPrice: 28000 },
        { name: 'Roller Set Standar Beat FI', price: 65000, buyPrice: 45000 },
        { name: 'V-Belt Kit Honda Scoopy / Beat', price: 145000, buyPrice: 110000 },
        { name: 'Air Radiator Coolant 1L', price: 25000, buyPrice: 15000 }
      ]
    }
  ],
  bengkel_mobil: [
    {
      category: 'Jasa Servis Mobil',
      printerTarget: 'NONE',
      items: [
        { name: 'Tune Up Mesin Bensin 4 Silinder', price: 250000, buyPrice: 35000 },
        { name: 'Servis Rem 4 Roda (Brake Cleaner)', price: 175000, buyPrice: 25000 },
        { name: 'Flushing Minyak Rem & Bleeding', price: 150000, buyPrice: 40000 },
        { name: 'Jasa Ganti Oli Mesin & Filter', price: 50000, buyPrice: 0 },
        { name: 'Servis AC Ringan (Cuci Evaporator + Fogging)', price: 300000, buyPrice: 50000 }
      ]
    },
    {
      category: 'Oli & Cairan Mobil',
      printerTarget: 'NONE',
      items: [
        { name: 'Oli Mesin Shell Helix HX6 10W-40 (4L)', price: 360000, buyPrice: 280000 },
        { name: 'Oli Mesin Mobil1 5W-30 Full Synthetic (4L)', price: 650000, buyPrice: 520000 },
        { name: 'Radiator Coolant Prestone 4L', price: 110000, buyPrice: 80000 },
        { name: 'Brake Fluid DOT 4 (1L)', price: 85000, buyPrice: 60000 }
      ]
    },
    {
      category: 'Sparepart Fast Moving Mobil',
      printerTarget: 'NONE',
      items: [
        { name: 'Filter Oli Toyota Avanza / Xenia', price: 45000, buyPrice: 28000 },
        { name: 'Filter Udara Avanza / Rush', price: 85000, buyPrice: 55000 },
        { name: 'Filter AC Kabin Karbon', price: 75000, buyPrice: 45000 },
        { name: 'Busi Iridium Set (4 Pcs)', price: 380000, buyPrice: 290000 }
      ]
    }
  ],
  retail_grosir: [
    {
      category: 'Sembako & Minyak Goreng',
      printerTarget: 'NONE',
      items: [
        { name: 'Minyak Goreng Sania Pouch 2L', price: 36500, buyPrice: 32000 },
        { name: 'Beras Ramos Super 5kg', price: 72000, buyPrice: 65000 },
        { name: 'Gula Pasir Gulaku Kuning 1kg', price: 17500, buyPrice: 15200 },
        { name: 'Tepung Terigu Segitiga Biru 1kg', price: 13000, buyPrice: 10800 },
        { name: 'Telur Ayam Ras Segar 1kg', price: 28000, buyPrice: 24500 }
      ]
    },
    {
      category: 'Mie & Makanan Instan',
      printerTarget: 'NONE',
      items: [
        { name: 'Indomie Goreng Spesial (Karton / 40 Pcs)', price: 112000, buyPrice: 103000 },
        { name: 'Indomie Kuah Ayam Bawang (Karton / 40 Pcs)', price: 108000, buyPrice: 99000 },
        { name: 'Mie Sedap Goreng (Karton / 40 Pcs)', price: 110000, buyPrice: 101000 },
        { name: 'Sarden ABC Saus Tomat 425g', price: 23500, buyPrice: 19500 }
      ]
    },
    {
      category: 'Minuman Kemasan & Karton',
      printerTarget: 'NONE',
      items: [
        { name: 'Teh Pucuk Harum 350ml (Dus / 24 Btl)', price: 62000, buyPrice: 54000 },
        { name: 'Aqua Air Mineral 600ml (Dus / 24 Btl)', price: 48000, buyPrice: 41000 },
        { name: 'Kopi Kapal Api Spesial Mix (Renceng / 10 Sachet)', price: 14500, buyPrice: 12200 },
        { name: 'Le Minerale Galon 15L', price: 20000, buyPrice: 16500 }
      ]
    },
    {
      category: 'Sabun & Kebersihan Rumah',
      printerTarget: 'NONE',
      items: [
        { name: 'Deterjen Rinso Molto Anti Noda 770g', price: 21500, buyPrice: 17800 },
        { name: 'Sabun Cuci Piring Sunlight Jeruk Nipis 650ml', price: 14000, buyPrice: 11500 },
        { name: 'Deterjen Daia Putih 850g', price: 18500, buyPrice: 15200 },
        { name: 'Pembersih Lantai So Klin 780ml', price: 12500, buyPrice: 9800 }
      ]
    },
    {
      category: 'Rokok & Tembakau',
      printerTarget: 'NONE',
      items: [
        { name: 'Sampoerna A Mild 16 (Pres / Slop)', price: 340000, buyPrice: 325000 },
        { name: 'Djarum Super 12 (Pres / Slop)', price: 235000, buyPrice: 224000 },
        { name: 'Gudang Garam Surya 16 (Pres / Slop)', price: 335000, buyPrice: 320000 }
      ]
    }
  ],
  laundry_kiloan: [
    {
      category: 'Cuci Kiloan Reguler',
      printerTarget: 'NONE',
      items: [
        { name: 'Cuci Kering Setrika (Reguler)', price: 7000, buyPrice: 2000 },
        { name: 'Cuci Lipat Kering (Non Setrika)', price: 5000, buyPrice: 1500 },
        { name: 'Setrika Rapi Saja', price: 4500, buyPrice: 1200 },
        { name: 'Cuci Basah Bersih', price: 3500, buyPrice: 1000 }
      ]
    },
    {
      category: 'Cuci Kilat & Express',
      printerTarget: 'NONE',
      items: [
        { name: 'Cuci Kering Setrika (Kilat 24 Jam)', price: 10000, buyPrice: 2500 },
        { name: 'Cuci Express 6 Jam', price: 15000, buyPrice: 3500 }
      ]
    },
    {
      category: 'Cuci Satuan & Bedcover',
      printerTarget: 'NONE',
      items: [
        { name: 'Bedcover King / Jumbo', price: 25000, buyPrice: 6000 },
        { name: 'Bedcover Single / Sedang', price: 20000, buyPrice: 5000 },
        { name: 'Selimut Tebal / Fleece', price: 15000, buyPrice: 4000 },
        { name: 'Sprei Set + Sarung Bantal', price: 12000, buyPrice: 3000 }
      ]
    },
    {
      category: 'Dry Clean & Perawatan Sepatu',
      printerTarget: 'NONE',
      items: [
        { name: 'Jas Pria / Blazer Kerja', price: 30000, buyPrice: 7000 },
        { name: 'Gamis / Gaun Panjang', price: 25000, buyPrice: 6000 },
        { name: 'Sepatu Sneakers / Canvas', price: 35000, buyPrice: 8000 },
        { name: 'Tas Ransel / Backpack', price: 25000, buyPrice: 6000 }
      ]
    }
  ]
};

// ─── Helper: Generate AI Food Photography URL (Signature Kayu Sutera Aesthetic) ───
// Visual Signature: Light blonde oak table with vertical wood grain, off-white matte artisanal ceramic
// plate with raised rim, elegant sauce swirl drizzle, mint leaf/fruit garnish, neatly folded beige textured
// linen napkin, soft 45° directional natural morning sunlight, creamy cafe bokeh, shot on 50mm f/1.8 macro lens.
// Strictly no text, no watermark, no logos.
export const generateFoodImageUrl = (productName: string, category: string): string => {
  const cleanName = productName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanCat = category.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const catLower = (cleanCat + ' ' + cleanName).toLowerCase();

  let promptText = '';

  const isDrink = /\b(drink|drinks|kopi|coffee|latte|tea|teh|mocktail|beverage|beverages|espresso|cappuccino|matcha|chocolate|cokelat|juice|jus|ice|es)\b/i.test(catLower);

  const isDessertOrPastry = /\b(pisang|croissant|pastry|bakery|cake|tart|roti|churros|toast|waffle|pancake|dessert|sweet|snack|cireng|fries|kentang|keju|meises|donut|donat)\b/i.test(catLower);

  if (isDessertOrPastry && !catLower.includes('kopi') && !catLower.includes('coffee') && !catLower.includes('latte') && !catLower.includes('tea') && !catLower.includes('teh')) {
    promptText = `commercial gourmet dessert photography of delicious ${cleanName}, artistically plated in the center of an off-white artisanal matte ceramic plate with raised rim, elegant artistic chocolate or caramel sauce swirl drizzle on the plate, garnished with fresh mint leaf, sliced strawberry and delicate whipped cream dollop, scattered delicate crumbs on a light blonde oak wooden table with subtle vertical wood grain, a neatly folded beige textured linen napkin near the corner of the frame, soft warm directional morning window sunlight from 45-degree angle, gentle soft shadows, creamy blurred cafe background, shot on 50mm f/1.8 macro lens, appetizing culinary textures, ultra photorealistic 8k, strictly no text, no watermark, no logos, no typography, clean image`;
  } else if (isDrink) {
    promptText = `commercial aesthetic cafe beverage photography of refreshing ${cleanName}, served in an elegant clear artisan glass tumbler with ice cubes and condensation water droplets, garnished with fresh mint sprig and delicate citrus slice, sitting on a matching small ceramic coaster on a light blonde oak wooden table with subtle vertical wood grain, a neatly folded beige textured linen napkin beside the glass, soft warm morning window daylight from 45-degree angle, gentle soft shadows, cozy blurred modern cafe background, 50mm f/1.8 macro lens, award-winning food photography, ultra photorealistic 8k resolution, strictly no text, no watermark, no logos, no typography, clean image`;
  } else {
    // Main course, savory dishes, rice, noodles, soup, etc.
    promptText = `commercial gourmet culinary photography of appetizing ${cleanName}, beautifully presented in an off-white artisanal matte ceramic plate with raised rim, elegant artistic sauce drizzle on the plate, garnished with fresh microgreens and delicate herbs, glossy appetizing food texture with subtle gentle steam, sitting on a light blonde oak wooden table with subtle vertical wood grain, a neatly folded beige textured linen napkin near the corner of the frame, soft directional natural morning window daylight from 45-degree angle, gentle soft shadows, cozy blurred cafe background, 50mm f/1.8 macro food photography, ultra photorealistic 8k, strictly no text, no watermark, no logos, no typography, clean image`;
  }

  const prompt = encodeURIComponent(promptText);
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&enhance=true`;
};

// ─── Helper: Generate AI Automotive & Workshop Product Photography URL ────────
export const generateBengkelImageUrl = (productName: string, category: string): string => {
  const cleanName = productName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanCat = category.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const promptText = `professional commercial automotive workshop photography of ${cleanName}, category ${cleanCat}, automotive spare parts and tools, clean metallic mechanical aesthetic, organized modern garage workbench background with precision tools, studio rim lighting, ultra photorealistic 4k, strictly no text, no watermark, no logos`;
  const prompt = encodeURIComponent(promptText);
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&enhance=true`;
};

// ─── Helper: Generate AI Retail & FMCG Product Photography URL ────────────────
export const generateRetailImageUrl = (productName: string, category: string): string => {
  const cleanName = productName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanCat = category.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const promptText = `commercial retail studio product photography of ${cleanName}, consumer packaged goods, category ${cleanCat}, neatly displayed on a clean illuminated modern supermarket shelf, crisp commercial studio lighting, vibrant packaging colors, ultra photorealistic 4k, strictly no watermark, no extraneous text`;
  const prompt = encodeURIComponent(promptText);
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&enhance=true`;
};

// ─── Helper: Generate AI Laundry Service & Care Product Photography URL ────────
export const generateLaundryImageUrl = (productName: string, category: string): string => {
  const cleanName = productName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanCat = category.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const promptText = `commercial professional laundry service photography of ${cleanName}, category ${cleanCat}, crisp freshly laundered and neatly folded textiles, bright clean pastel modern laundry room with modern washing machines and soft natural daylight, ultra photorealistic 4k, clean hygienic atmosphere, strictly no text, no watermark, no logos`;
  const prompt = encodeURIComponent(promptText);
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&enhance=true`;
};

// ─── 1. POST /resolve-gmaps ────────────────────────────────────────────────
router.post('/resolve-gmaps', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL Google Maps wajib diisi' });
    }

    const trimmedUrl = url.trim();
    let finalUrl = trimmedUrl;
    let htmlContent = '';

    // Fetch and follow redirects
    try {
      const response = await fetch(trimmedUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      finalUrl = response.url || trimmedUrl;
      htmlContent = await response.text();
    } catch (fetchErr: any) {
      console.warn('[GMaps Resolver] Direct fetch error, fallback to URL parsing:', fetchErr?.message);
    }

    let latitude = -6.200000;
    let longitude = 106.816666;
    let name = '';
    let address = '';
    let logoUrl = '';

    // 1. Extract GPS from URL Coordinates regex
    const coordsMatch1 = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const coordsMatch2 = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const coordsMatch3 = finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const coordsMatch4 = finalUrl.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (coordsMatch1) {
      latitude = parseFloat(coordsMatch1[1]);
      longitude = parseFloat(coordsMatch1[2]);
    } else if (coordsMatch2) {
      latitude = parseFloat(coordsMatch2[1]);
      longitude = parseFloat(coordsMatch2[2]);
    } else if (coordsMatch3) {
      latitude = parseFloat(coordsMatch3[1]);
      longitude = parseFloat(coordsMatch3[2]);
    } else if (coordsMatch4) {
      latitude = parseFloat(coordsMatch4[1]);
      longitude = parseFloat(coordsMatch4[2]);
    }

    // 2. Extract Place Name
    const placeMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch && placeMatch[1]) {
      name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }

    if (!name && htmlContent) {
      const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        name = titleMatch[1].replace(/\s*-\s*Google Maps/i, '').replace(/\s*·\s*Google Maps/i, '').trim();
      }
    }

    // 3. Extract OpenGraph Image (Logo / Store Photo)
    if (htmlContent) {
      const ogImageMatch = htmlContent.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                           htmlContent.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
      if (ogImageMatch && ogImageMatch[1]) {
        logoUrl = ogImageMatch[1];
      }

      const ogDescMatch = htmlContent.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                          htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      if (ogDescMatch && ogDescMatch[1]) {
        address = ogDescMatch[1].trim();
      }
    }

    // Suggested Slug
    const suggestedSlug = (name || 'kafe-baru')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16) || 'kafe' + Math.floor(100 + Math.random() * 900);

    return res.json({
      success: true,
      data: {
        name: name || 'Kafe Mitra CodePOS',
        suggestedSlug,
        address: address || 'Alamat Lokasi Terdaftar di Google Maps',
        latitude,
        longitude,
        logoUrl: logoUrl || '',
        canonicalUrl: finalUrl
      }
    });
  } catch (error: any) {
    console.error('[QuickProvision] resolve-gmaps error:', error);
    return res.status(500).json({ error: 'Gagal mengurai Link Google Maps: ' + (error?.message || 'Unknown error') });
  }
});

// ─── 2. POST /ai-extract-menu ──────────────────────────────────────────────
router.post('/ai-extract-menu', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { imageBase64, mimeType, images, presetTemplate, rawText, businessType = 'CAFE' } = req.body;
    const isBengkel = businessType === 'BENGKEL' || (presetTemplate && presetTemplate.startsWith('bengkel_'));
    const isRetail = businessType === 'RETAIL' || (presetTemplate && presetTemplate.startsWith('retail_'));
    const isLaundry = businessType === 'LAUNDRY' || (presetTemplate && presetTemplate.startsWith('laundry_'));

    // 1. If preset template requested
    if (presetTemplate && PRESET_TEMPLATES[presetTemplate]) {
      const templateData = PRESET_TEMPLATES[presetTemplate].map(cat => ({
        category: cat.category,
        printerTarget: cat.printerTarget || ((isBengkel || isRetail || isLaundry) ? 'NONE' : 'KITCHEN'),
        items: cat.items.map(item => ({
          name: item.name,
          price: item.price,
          buyPrice: item.buyPrice || Math.round(item.price * 0.35),
          imageUrl: isBengkel
            ? generateBengkelImageUrl(item.name, cat.category)
            : (isRetail 
                ? generateRetailImageUrl(item.name, cat.category) 
                : (isLaundry 
                    ? generateLaundryImageUrl(item.name, cat.category) 
                    : generateFoodImageUrl(item.name, cat.category)))
        }))
      }));

      return res.json({
        success: true,
        source: 'preset',
        data: templateData
      });
    }

    // 2. Collect all valid images (support both multi-image 'images' array and legacy single 'imageBase64')
    const rawImagesList: Array<{ base64: string; mimeType: string; name?: string }> = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img && typeof img.base64 === 'string' && img.base64.trim()) {
          rawImagesList.push({
            base64: img.base64,
            mimeType: img.mimeType || 'image/jpeg',
            name: img.name
          });
        }
      }
    } else if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.trim()) {
      rawImagesList.push({
        base64: imageBase64,
        mimeType: mimeType || 'image/jpeg'
      });
    }

    // 3. If images provided and Gemini API key is configured
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (rawImagesList.length > 0 && geminiApiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const prompt = `You are an expert F&B menu digitization assistant.
Analyze these uploaded photos of the cafe/restaurant menu sheets (which may include separate pages/sheets for beverages/drinks, food/meals/rice, and desserts/pastries/snacks).
Extract all menu categories, determine the appropriate kitchen/bar station routing, and extract all products/items.

For each category:
1. "category": The clean, well-formatted name of the category (e.g. "Signature Coffee", "Non-Coffee & Mocktails", "Makanan Utama", "Snacks & Pastry"). Group similar items together. Avoid duplicate categories across pages.
2. "printerTarget": The designated station target for KDS and receipt printing:
   - "BAR" for all drinks, coffees, teas, juices, mocktails, and beverages.
   - "PASTRY" for bakeries, croissants, cakes, and sweet desserts.
   - "KITCHEN" for all hot meals, main courses, rice bowls, noodles, soups, and savory snacks.
3. "items": Array of items in this category. For each item:
   - "name": Clean item name (omit page numbers, noise, or watermarks).
   - "price": Plain integer in IDR (Indonesian Rupiah). For example: "18k" or "18.000" or "18rb" becomes 18000. "25" in a cafe menu where thousands are omitted becomes 25000.
   - "buyPrice": Estimated cost of goods (HPP), roughly 30-35% of the selling price (integer).

Return ONLY valid JSON with this exact structure:
[
  {
    "category": "Signature Coffee",
    "printerTarget": "BAR",
    "items": [
      { "name": "Kopi Susu Gula Aren", "price": 18000, "buyPrice": 6500 }
    ]
  },
  {
    "category": "Makanan Utama",
    "printerTarget": "KITCHEN",
    "items": [
      { "name": "Nasi Goreng Spesial", "price": 25000, "buyPrice": 9000 }
    ]
  }
]`;

        const parts: any[] = [{ text: prompt }];
        for (const img of rawImagesList) {
          const cleanBase64 = img.base64.replace(/^data:image\/[a-z]+;base64,/, '');
          parts.push({
            inline_data: {
              mime_type: img.mimeType || 'image/jpeg',
              data: cleanBase64
            }
          });
        }

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawResponseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawResponseText) {
            const parsed = JSON.parse(rawResponseText);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const enriched = parsed.map((cat: any) => {
                const catName = cat.category || 'Menu Utama';
                const lowerCat = catName.toLowerCase();
                let defaultTarget = 'KITCHEN';
                if (lowerCat.includes('drink') || lowerCat.includes('kopi') || lowerCat.includes('coffee') || lowerCat.includes('tea') || lowerCat.includes('beverage') || lowerCat.includes('jus')) {
                  defaultTarget = 'BAR';
                } else if (lowerCat.includes('pastry') || lowerCat.includes('bakery') || lowerCat.includes('cake') || lowerCat.includes('dessert') || lowerCat.includes('croissant')) {
                  defaultTarget = 'PASTRY';
                }
                const printerTarget = cat.printerTarget || defaultTarget;

                return {
                  category: catName,
                  printerTarget,
                  items: (cat.items || []).map((item: any) => ({
                    name: item.name,
                    price: Number(item.price) || 15000,
                    buyPrice: Number(item.buyPrice) || Math.round((Number(item.price) || 15000) * 0.35),
                    imageUrl: generateFoodImageUrl(item.name, catName)
                  }))
                };
              });

              return res.json({
                success: true,
                source: 'gemini_vision',
                totalPages: rawImagesList.length,
                data: enriched
              });
            }
          }
        }
      } catch (geminiError: any) {
        console.warn('[AI Extract Menu] Gemini Vision error, falling back to smart parser:', geminiError?.message);
      }
    }

    // 4. Fallback Smart Text Parser
    if (rawText) {
      const lines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      let currentCategory = 'Menu Pilihan';
      const parsedCategories: Record<string, Array<{ name: string; price: number; buyPrice: number; imageUrl: string }>> = {};

      for (const line of lines) {
        if (line.startsWith('#') || line.endsWith(':')) {
          currentCategory = line.replace(/^[#:]+|[:#]+$/g, '').trim() || 'Menu';
          continue;
        }

        // Match "Kopi Susu 18000" or "Kopi Susu - 18k" or "Kopi Susu ... 18.000"
        const priceMatch = line.match(/(.*?)(?:[-:.]|\s+)+(\d+(?:[.,]\d+)?\s*(?:k|rb|000)?)\s*$/i);
        if (priceMatch) {
          const itemName = priceMatch[1].replace(/^[0-9.\-\s]+/, '').trim();
          let rawPriceStr = priceMatch[2].toLowerCase().replace(/[,.]/g, '').trim();
          let price = 15000;

          if (rawPriceStr.endsWith('k') || rawPriceStr.endsWith('rb')) {
            price = parseFloat(rawPriceStr) * 1000;
          } else {
            const num = parseFloat(rawPriceStr);
            price = num < 100 ? num * 1000 : num;
          }

          if (itemName) {
            if (!parsedCategories[currentCategory]) parsedCategories[currentCategory] = [];
            parsedCategories[currentCategory].push({
              name: itemName,
              price,
              buyPrice: Math.round(price * 0.35),
              imageUrl: generateFoodImageUrl(itemName, currentCategory)
            });
          }
        }
      }

      const result = Object.entries(parsedCategories).map(([category, items]) => {
        const lowerCat = category.toLowerCase();
        const printerTarget = (lowerCat.includes('kopi') || lowerCat.includes('drink') || lowerCat.includes('tea') || lowerCat.includes('coffee')) ? 'BAR' :
                              (lowerCat.includes('pastry') || lowerCat.includes('cake') || lowerCat.includes('roti')) ? 'PASTRY' : 'KITCHEN';
        return {
          category,
          printerTarget,
          items
        };
      });

      if (result.length > 0) {
        return res.json({
          success: true,
          source: 'text_parser',
          data: result
        });
      }
    }

    // Default fallback to Preset according to businessType
    const fallbackTemplateKey = isBengkel ? 'bengkel_motor' : (isRetail ? 'retail_grosir' : 'coffee_shop');
    const chosenTemplate = PRESET_TEMPLATES[fallbackTemplateKey] || PRESET_TEMPLATES.coffee_shop;
    const defaultData = chosenTemplate.map(cat => ({
      category: cat.category,
      printerTarget: cat.printerTarget || ((isBengkel || isRetail) ? 'NONE' : 'BAR'),
      items: cat.items.map(item => ({
        name: item.name,
        price: item.price,
        buyPrice: item.buyPrice || Math.round(item.price * 0.35),
        imageUrl: isBengkel
          ? generateBengkelImageUrl(item.name, cat.category)
          : (isRetail ? generateRetailImageUrl(item.name, cat.category) : generateFoodImageUrl(item.name, cat.category))
      }))
    }));

    return res.json({
      success: true,
      source: 'default_template',
      data: defaultData
    });
  } catch (error: any) {
    console.error('[QuickProvision] ai-extract-menu error:', error);
    return res.status(500).json({ error: 'Gagal mengekstrak menu: ' + (error?.message || 'Unknown error') });
  }
});

// ─── 3. POST /generate-product-image ───────────────────────────────────────
router.post('/generate-product-image', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { productName, categoryName, businessType } = req.body;
    if (!productName) {
      return res.status(400).json({ error: 'Nama produk wajib diisi' });
    }

    const imageUrl = businessType === 'BENGKEL'
      ? generateBengkelImageUrl(productName, categoryName || 'Otomotif')
      : (businessType === 'RETAIL'
        ? generateRetailImageUrl(productName, categoryName || 'Sembako Retail')
        : (businessType === 'LAUNDRY'
          ? generateLaundryImageUrl(productName, categoryName || 'Laundry & Care')
          : generateFoodImageUrl(productName, categoryName || 'Culinary')));
    return res.json({
      success: true,
      imageUrl
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal generate gambar: ' + (error?.message || 'Unknown error') });
  }
});

// ─── 4. POST /execute (Atomic Tenant Provisioning) ─────────────────────────
router.post('/execute', authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      tenantName,
      slug,
      ownerName,
      username,
      password,
      whatsappPhone,
      planCode = 'GROWTH',
      address,
      latitude,
      longitude,
      logoUrl,
      menuData = [],
      businessType = 'CAFE'
    } = req.body;

    const finalBusinessType = businessType === 'BENGKEL' ? 'BENGKEL' : (businessType === 'RETAIL' ? 'RETAIL' : (businessType === 'LAUNDRY' ? 'LAUNDRY' : (businessType === 'RENTAL' ? 'RENTAL' : 'CAFE')));

    // Validation
    if (!tenantName || !slug || !username || !password) {
      return res.status(400).json({ error: 'Data wajib: Nama Bisnis, Slug Subdomain, Username, dan Password' });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const cleanUsername = username.trim().toLowerCase();

    // Check reserved slugs
    const reservedSlugs = ['admin', 'api', 'app', 'www', 'mail', 'blog', 'demo', 'test', 'dev', 'staging', 'platform', 'pos', 'cafe', 'codenusa', 'bengkel', 'bengkel-motor', 'posbengkel', 'bengkel-app'];
    if (reservedSlugs.includes(cleanSlug)) {
      return res.status(400).json({ error: `Subdomain / Slug '${cleanSlug}' adalah nama reserved sistem dan tidak dapat digunakan.` });
    }

    // Check slug collision
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: cleanSlug },
          { name: { equals: tenantName.trim(), mode: 'insensitive' } }
        ]
      }
    });

    if (existingTenant) {
      return res.status(400).json({ error: `Subdomain / Slug '${cleanSlug}' atau nama bisnis sudah terdaftar di sistem.` });
    }

    // Check username collision
    const existingUser = await prisma.user.findFirst({
      where: { username: cleanUsername }
    });

    if (existingUser) {
      return res.status(400).json({ error: `Username '${cleanUsername}' sudah dipakai akun lain.` });
    }

    // Find SaaS Plan
    const targetPlan = await prisma.plan.findUnique({
      where: { code: planCode.toUpperCase() }
    }) || await prisma.plan.findFirst({
      where: { code: 'GROWTH' }
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const latVal = typeof latitude === 'number' ? latitude : parseFloat(latitude) || -6.200000;
    const lngVal = typeof longitude === 'number' ? longitude : parseFloat(longitude) || 106.816666;

    // Run Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName.trim(),
          slug: cleanSlug,
          businessType: finalBusinessType,
          logoUrl: logoUrl?.trim() ? logoUrl.trim() : '/logo.png',
          status: 'ACTIVE',
          planId: targetPlan?.id,
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days active
        }
      });

      // 2. Create Subscription
      if (targetPlan) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: targetPlan.id,
            amount: targetPlan.priceMonthly || 0,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startDate: new Date(),
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      }

      // 3. Create Default Outlet
      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: `${tenantName.trim()} - Main Outlet`,
          code: 'OUT-01',
          address: address || 'Alamat Belum Diatur',
          phone: whatsappPhone || undefined,
          latitude: latVal,
          longitude: lngVal,
          gpsRadiusMeters: 100,
          status: 'ACTIVE'
        }
      });

      // 4. Create Owner User
      const user = await tx.user.create({
        data: {
          name: ownerName || tenantName.trim() + ' Owner',
          username: cleanUsername,
          passwordHash,
          pin: '123456',
          role: 'OWNER',
          permissions: JSON.stringify(['*'])
        }
      });

      // 5. Create Tenant Membership
      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          status: 'ACTIVE',
          pin: '123456'
        }
      });

      // 6. Create Settings
      await tx.settings.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          storeName: tenantName.trim(),
          phone: whatsappPhone || '',
          address: address || '',
          logoUrl: logoUrl?.trim() ? logoUrl.trim() : '/logo.png',
          receiptHeader: `Selamat Datang di ${tenantName.trim()}`,
          receiptFooter: finalBusinessType === 'BENGKEL'
            ? 'Garansi servis & suku cadang berlaku sesuai ketentuan nota.'
            : (finalBusinessType === 'RETAIL'
              ? 'Barang yang sudah dibeli dapat ditukar maksimal 2x24 jam dengan nota resmi.'
              : (finalBusinessType === 'LAUNDRY'
                ? 'Nota laundry wajib dibawa saat pengambilan cucian. Klaim maksimal 1x24 jam setelah serah terima.'
                : (finalBusinessType === 'RENTAL'
                  ? 'Maksimal masa sewa 3 hari kerja. Kembalikan busana & aksesoris dalam keadaan baik. Terima kasih!'
                  : 'Terima kasih atas kunjungan Anda!'))),
          storeLatitude: latVal,
          storeLongitude: lngVal,
          gpsRadiusMeters: 100,
          enableGpsValidation: true,
          enableCameraPhoto: true,
          ingredientTrackingEnabled: (finalBusinessType === 'BENGKEL' || finalBusinessType === 'RETAIL' || finalBusinessType === 'RENTAL') ? false : (planCode === 'GROWTH' || planCode === 'BUSINESS' || planCode === 'ENTERPRISE'),
          taxRate: 0,
          serviceCharge: 0
        }
      });

      // 7. Create Default Tables (Kafe), Service Pits (Bengkel), Shelves/Racks (Retail), Laundry Shelves (Laundry), or Fitting Rooms (Rental)
      const tableData = finalBusinessType === 'BENGKEL'
        ? [
            { tableNo: 'PIT-01', name: 'Pit 01 (Servis Ringan / Fast)', capacity: 1 },
            { tableNo: 'PIT-02', name: 'Pit 02 (Tune Up & CVT)', capacity: 1 },
            { tableNo: 'PIT-03', name: 'Pit 03 (Bongkar Mesin / Heavy)', capacity: 1 },
            { tableNo: 'PIT-04', name: 'Pit 04 (Cuci & Finishing)', capacity: 1 }
          ]
        : (finalBusinessType === 'RETAIL'
          ? [
              { tableNo: 'RAK-01', name: 'Rak Depan (Sembako & Beras)', capacity: 1 },
              { tableNo: 'RAK-02', name: 'Rak Tengah (Makanan & Snack)', capacity: 1 },
              { tableNo: 'RAK-03', name: 'Rak Samping (Minuman & Kopi)', capacity: 1 },
              { tableNo: 'GDG-01', name: 'Gudang Belakang (Karton & Bal)', capacity: 1 }
            ]
          : (finalBusinessType === 'LAUNDRY'
            ? [
                { tableNo: 'RAK-A1', name: 'Rak A1 (Cucian Siap Ambil)', capacity: 1 },
                { tableNo: 'RAK-A2', name: 'Rak A2 (Cucian Siap Ambil)', capacity: 1 },
                { tableNo: 'RAK-B1', name: 'Rak B1 (Cucian Siap Ambil)', capacity: 1 },
                { tableNo: 'RAK-B2', name: 'Rak B2 (Cucian Siap Ambil)', capacity: 1 },
                { tableNo: 'HANGER-01', name: 'Gantungan Jas & Bedcover', capacity: 1 }
              ]
            : (finalBusinessType === 'RENTAL'
              ? [
                  { tableNo: 'FIT-01', name: 'Kamar Pas / Fitting Room 1', capacity: 2 },
                  { tableNo: 'FIT-02', name: 'Kamar Pas / Fitting Room 2', capacity: 2 },
                  { tableNo: 'MAN-01', name: 'Display Manekin Utama', capacity: 1 },
                  { tableNo: 'HNG-01', name: 'Rak Gantung Siap Sewa', capacity: 10 },
                  { tableNo: 'AKS-01', name: 'Etalase Aksesoris Adat', capacity: 20 }
                ]
              : [
                  { tableNo: '01', name: 'Area Indoor (2 Org)', capacity: 2 },
                  { tableNo: '02', name: 'Area Indoor (4 Org)', capacity: 4 },
                  { tableNo: '03', name: 'Area Indoor (4 Org)', capacity: 4 },
                  { tableNo: '04', name: 'Area Outdoor (4 Org)', capacity: 4 },
                  { tableNo: '05', name: 'Sofa VIP (6 Org)', capacity: 6 }
                ])));

      for (const t of tableData) {
        await tx.table.create({
          data: {
            tenantId: tenant.id,
            outletId: outlet.id,
            tableNo: t.tableNo,
            name: t.name,
            capacity: t.capacity,
            status: 'Aktif'
          }
        });
      }

      // 7b. If Laundry, seed default chemical inventory & packaging
      if (finalBusinessType === 'LAUNDRY') {
        await tx.ingredient.createMany({
          data: [
            { tenantId: tenant.id, name: 'Deterjen Cair Konsentrat Super', unit: 'liter', stock: 50, minStock: 10, buyPrice: 12000 },
            { tenantId: tenant.id, name: 'Pewangi Parfum Sakura', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
            { tenantId: tenant.id, name: 'Pewangi Parfum Akasia', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
            { tenantId: tenant.id, name: 'Softener / Pelembut Blue Fresh', unit: 'liter', stock: 30, minStock: 5, buyPrice: 15000 },
            { tenantId: tenant.id, name: 'Plastik Jinjing HD Size L', unit: 'pack', stock: 50, minStock: 10, buyPrice: 18000 }
          ]
        });
      }

      // 8. Create Categories & Products with AI Images
      let totalProductsCreated = 0;
      if (Array.isArray(menuData) && menuData.length > 0) {
        for (const catGroup of menuData) {
          if (!catGroup.category || !Array.isArray(catGroup.items) || catGroup.items.length === 0) continue;

          const lowerCatName = catGroup.category.toLowerCase();
          const targetStation = (finalBusinessType === 'BENGKEL' || finalBusinessType === 'RETAIL' || finalBusinessType === 'LAUNDRY')
            ? 'NONE'
            : (catGroup.printerTarget || 
              (lowerCatName.includes('drink') || lowerCatName.includes('kopi') || lowerCatName.includes('coffee') || lowerCatName.includes('tea') || lowerCatName.includes('jus') ? 'BAR' :
               lowerCatName.includes('pastry') || lowerCatName.includes('bakery') || lowerCatName.includes('cake') || lowerCatName.includes('croissant') ? 'PASTRY' : 'KITCHEN'));

          const createdCategory = await tx.category.create({
            data: {
              tenantId: tenant.id,
              name: catGroup.category.trim(),
              printerTarget: targetStation
            }
          });

          for (const item of catGroup.items) {
            if (!item.name) continue;
            const sellPrice = Number(item.price) || 15000;
            const buyPrice = Number(item.buyPrice) || Math.round(sellPrice * 0.35);
            const itemImageUrl = item.imageUrl || (finalBusinessType === 'BENGKEL'
              ? generateBengkelImageUrl(item.name, catGroup.category)
              : (finalBusinessType === 'RETAIL'
                ? generateRetailImageUrl(item.name, catGroup.category)
                : (finalBusinessType === 'LAUNDRY'
                  ? generateLaundryImageUrl(item.name, catGroup.category)
                  : generateFoodImageUrl(item.name, catGroup.category))));

            const catUpper = (catGroup.category || '').toUpperCase();
            const isKg = finalBusinessType === 'LAUNDRY' && (catUpper.includes('KILO') || catUpper.includes('KILAT') || catUpper.includes('REGULER') || catUpper.includes('EXPRESS'));

            await tx.product.create({
              data: {
                tenantId: tenant.id,
                name: item.name.trim(),
                categoryId: createdCategory.id,
                sellPrice,
                buyPrice,
                baseUom: isKg ? 'Kg' : 'Pcs',
                stock: 999, // Opening stock
                minStock: 5,
                imageUrl: itemImageUrl,
                status: 'Aktif'
              }
            });
            totalProductsCreated++;
          }
        }
      }

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        slug: tenant.slug,
        businessType: tenant.businessType,
        outletId: outlet.id,
        userId: user.id,
        username: user.username,
        totalProductsCreated
      };
    });

    // Generate WhatsApp Welcome Kit
    // In dev: req.headers.host = "localhost:5000" (backend) — must resolve to frontend port
    // Priority: FRONTEND_URL env var → x-forwarded-host header → replace :5000 with :5173 in dev
    const rawHost = req.headers['x-forwarded-host'] as string || req.headers.host || 'localhost:5173';
    const protocol = req.protocol || 'https';
    const FRONTEND_URL = process.env.FRONTEND_URL;

    let hostDomain: string;
    if (FRONTEND_URL) {
      // Production / staging: FRONTEND_URL=https://pos.codenusa.id
      hostDomain = FRONTEND_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    } else if (rawHost.includes(':5000')) {
      // Local dev: backend is on 5000, frontend is on 5173
      hostDomain = rawHost.replace(':5000', ':5173');
    } else {
      hostDomain = rawHost;
    }

    const loginLink = `${FRONTEND_URL ? FRONTEND_URL.split('://')[0] : protocol}://${hostDomain}/login?tenant=${result.slug}`;

    const whatsappMessage = finalBusinessType === 'BENGKEL'
      ? `*SELAMAT DATANG DI CODEPOS BENGKEL!* 🔧\n\nHalo *${ownerName || tenantName}*,\nAkun sistem POS & Manajemen Bengkel Anda untuk *${tenantName}* telah berhasil diaktifkan dengan paket *${planCode}*.\n\n📱 *Akses Login Sistem:*\n• *Link Portal:* ${loginLink}\n• *Username:* \`${cleanUsername}\`\n• *Password:* \`${password}\`\n• *Kode Outlet:* \`OUT-01\`\n\n✨ *Apa yang sudah siap untuk Anda:*\n✅ ${result.totalProductsCreated} Jasa Servis & Suku Cadang siap pakai\n✅ Daftar Pit / Stall Pengerjaan Bengkel\n✅ Modul Work Order (SPK), Riwayat Kendaraan Pelanggan, Komisi Mekanik, dan Kasir POS\n\nSilakan langsung login dan coba buka Surat Perintah Kerja (SPK) atau lakukan transaksi pertama Anda! Jika ada kendala, tim support CodePOS siap membantu 24/7.`
      : (finalBusinessType === 'RETAIL'
        ? `*SELAMAT DATANG DI CODEPOS TOKO GROSIR & RETAIL!* 🛒\n\nHalo *${ownerName || tenantName}*,\nAkun sistem POS & Manajemen Toko Grosir Anda untuk *${tenantName}* telah berhasil diaktifkan dengan paket *${planCode}*.\n\n📱 *Akses Login Sistem:*\n• *Link Portal:* ${loginLink}\n• *Username:* \`${cleanUsername}\`\n• *Password:* \`${password}\`\n• *Kode Outlet:* \`OUT-01\`\n\n✨ *Apa yang sudah siap untuk Anda:*\n✅ ${result.totalProductsCreated} Produk Sembako & Barang Dagang siap jual\n✅ Pemetaan Rak Depan, Rak Tengah, & Gudang Karton\n✅ Modul Kasir Cepat Barcode Laser, Manajemen Multi-Satuan Dus/Bal, dan Buku Bon Pelanggan\n\nSilakan langsung login dan coba lakukan transaksi pertama Anda! Jika ada kendala, tim support CodePOS siap membantu 24/7.`
        : `*SELAMAT DATANG DI CODEPOS!* 🎉\n\nHalo *${ownerName || tenantName}*,\nAkun sistem POS & Manajemen Kafe Anda untuk *${tenantName}* telah berhasil diaktifkan dengan paket *${planCode}*.\n\n📱 *Akses Login Sistem:*\n• *Link Portal:* ${loginLink}\n• *Username:* \`${cleanUsername}\`\n• *Password:* \`${password}\`\n• *Kode Outlet:* \`OUT-01\`\n\n✨ *Apa yang sudah siap untuk Anda:*\n✅ ${result.totalProductsCreated} Menu Produk lengkap dengan foto estetik kuliner\n✅ Peta Nomor Meja Kasir (Indoor & VIP Sofa)\n✅ Modul Kasir POS Cepat, Kitchen Display (KDS), dan Absensi GPS Geofencing\n\nSilakan langsung login dan coba lakukan transaksi pertama Anda! Jika ada kendala, tim support CodePOS siap membantu 24/7.`);

    // Audit Logging
    AuditLogger.log({
      tenantId: result.tenantId,
      userId: (req as any).user?.id,
      userName: (req as any).user?.username || 'PlatformAdmin',
      action: 'TENANT_QUICK_PROVISION_AI',
      resource: 'PLATFORM_ADMIN',
      resourceId: result.tenantId,
      description: `Fast onboarded tenant '${result.tenantName}' with ${result.totalProductsCreated} AI menus and GMaps sync.`,
      severity: 'INFO',
      ipAddress: req.ip
    });

    // Trigger background image downloader to store images locally
    ImageCacheService.cacheProductImages(result.tenantId);

    return res.json({
      success: true,
      data: {
        ...result,
        loginLink,
        whatsappMessage,
        whatsappUrl: whatsappPhone ? `https://api.whatsapp.com/send?phone=${whatsappPhone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(whatsappMessage)}` : null
      }
    });
  } catch (error: any) {
    console.error('[QuickProvision] execute error:', error);
    return res.status(500).json({ error: 'Gagal melakukan provisioning tenant: ' + (error?.message || 'Unknown error') });
  }
});

export default router;
