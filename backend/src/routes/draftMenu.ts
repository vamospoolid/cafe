import { Router, Request, Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest, requirePermission } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';
import { AuditLogger } from '../services/AuditLogger';
import { cacheService } from '../services/CacheService';
import { invalidateTenantCache } from '../middlewares/tenantResolver';
import { emitToTenant } from '../index';
import { ImageCacheService } from '../services/ImageCacheService';
import {
  generateBengkelImageUrl,
  generateRetailImageUrl,
  generateLaundryImageUrl
} from './fastProvisioning';

const router = Router();

// Router-level fail-closed guard: all draft menu operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const user = (req as AuthRequest).user;
  const tenantId = user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
  }
  (req as any).tenantId = tenantId;
  next();
});

export type FoodPhotoStyle = 'CAFE_WARM' | 'GOURMET_STUDIO' | 'COMMERCIAL_VIBRANT' | 'TRADITIONAL_RUSTIC';

/**
 * Professional Studio Food Photography Prompt Builder
 * Menghasilkan URL foto beresolusi tinggi dengan simulasi pencahayaan studio,
 * lensa macro 50mm f/1.8, dan plating mewah standar Michelin / Commercial Menu.
 */
export const generateProfessionalFoodImageUrl = (
  productName: string,
  category: string,
  options?: {
    style?: FoodPhotoStyle;
    seed?: number;
    customInstruction?: string;
  }
): string => {
  const cleanName = productName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanCat = category.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const catLower = (cleanCat + ' ' + cleanName).toLowerCase();
  const style = options?.style || 'CAFE_WARM';
  const seed = options?.seed ?? Math.floor(Math.random() * 1000000);
  const customExtra = options?.customInstruction ? `, ${options.customInstruction.trim()}` : '';

  const isDrink = /\b(drink|drinks|kopi|coffee|latte|tea|teh|mocktail|beverage|beverages|espresso|cappuccino|matcha|chocolate|cokelat|juice|jus|ice|es|soda|boba)\b/i.test(catLower);
  const isDessertOrPastry = /\b(pisang|croissant|pastry|bakery|cake|tart|roti|churros|toast|waffle|pancake|dessert|sweet|snack|cireng|fries|kentang|keju|meises|donut|donat)\b/i.test(catLower);

  let prompt = '';

  if (style === 'GOURMET_STUDIO') {
    if (isDrink) {
      prompt = `award-winning commercial mixology cocktail photography of ${cleanName}, served in an artisanal crystal cut glassware with clear sculpted ice block, sophisticated botanical garnish, subtle mist condensation, dark matte slate tabletop, moody luxury lounge studio rim lighting, 85mm f/1.4 lens, 8k hyperrealistic, clean commercial ad`;
    } else {
      prompt = `Michelin-star culinary gourmet photography of ${cleanName}, artistically plated on a handcrafted dark matte ceramic dish, delicate organic microgreens and edible flower garnish, glossy reduction glaze sauce drizzle, dramatic directional softbox studio rim lighting, shallow depth of field, 50mm f/1.2 macro lens, mouthwatering textures, 8k hyperrealistic, no text, no watermark`;
    }
  } else if (style === 'COMMERCIAL_VIBRANT') {
    if (isDrink) {
      prompt = `vibrant commercial advertising photography of refreshing iced ${cleanName}, vibrant saturated colors, glistening ice cubes, crisp water splash droplets, bright clean modern studio lighting, punchy high contrast, perfect for food delivery app menu, photorealistic 8k, ultra sharp`;
    } else {
      prompt = `vibrant commercial food catalog photography of appetizing ${cleanName}, beautifully arranged, bright clean studio tabletop, vivid appetizing colors, golden hour fill light, crisp commercial advertising shot, ultra detailed food styling, 8k photorealistic, no text, no watermark`;
    }
  } else if (style === 'TRADITIONAL_RUSTIC') {
    if (isDrink) {
      prompt = `artisanal heritage cafe photography of authentic ${cleanName}, vintage ceramic cup on woven rattan coaster, authentic rustic Indonesian warung aesthetic, warm amber lantern glow, gentle steam, 8k ultra realistic`;
    } else {
      prompt = `authentic artisanal Indonesian culinary photography of ${cleanName}, served in traditional terracotta clay plate lined with fresh banana leaf, crispy golden fried shallot garnish, fresh red chili accent, subtle natural steam rising, rustic dark wooden table background, warm directional golden morning sunlight, 8k realistic`;
    }
  } else {
    // CAFE_WARM (Default Signature Aesthetic - Kayu Sutera)
    if (isDrink) {
      prompt = `commercial aesthetic cafe beverage photography of refreshing ${cleanName}, served in an elegant clear artisan glass tumbler with crystal clear ice cubes and cold condensation droplets, garnished with fresh mint sprig and citrus slice, matching ceramic coaster on light blonde oak wooden table, neatly folded linen napkin, soft warm 45-degree morning sunlight, creamy blurred cafe background, 50mm f/1.8 macro lens, 8k photorealistic, no text, no watermark`;
    } else if (isDessertOrPastry) {
      prompt = `commercial gourmet pastry photography of delicious ${cleanName}, plated on an off-white artisanal matte ceramic plate with raised rim, artistic chocolate sauce drizzle, fresh mint leaf and strawberry slice garnish, light blonde oak table, beige linen napkin, soft warm directional morning daylight, 50mm f/1.8 macro, 8k photorealistic, no text, no watermark`;
    } else {
      prompt = `commercial gourmet culinary photography of appetizing ${cleanName}, beautifully presented in an off-white artisanal matte ceramic plate with raised rim, artistic sauce drizzle, fresh herb garnish, appetizing culinary texture with gentle steam, light blonde oak wooden table, folded beige linen napkin, soft directional morning sunlight, 50mm f/1.8 macro, 8k photorealistic, no text, no watermark`;
    }
  }

  const fullPrompt = encodeURIComponent(prompt + customExtra);
  return `https://image.pollinations.ai/prompt/${fullPrompt}?width=512&height=512&seed=${seed}&nologo=true&enhance=true&model=flux`;
};

/**
 * POST /api/draft-menu/extract-image
 * Menerima 1 atau banyak gambar lembaran menu (base64)
 * Mengekstrak Kategori, Nama Menu, dan Harga Jual menggunakan Gemini 1.5 Flash Vision
 * Memasangkan Foto Standard Estetik secara otomatis
 */
router.post('/extract-image', requirePermission('products.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { images, imageBase64, mimeType, businessType = 'CAFE', photoStyle = 'CAFE_WARM' } = req.body;

    // Kumpulkan daftar gambar
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

    if (rawImagesList.length === 0) {
      return res.status(400).json({ error: 'Harap sertakan minimal 1 file gambar atau foto menu.' });
    }

    const isBengkel = businessType === 'BENGKEL';
    const isRetail = businessType === 'RETAIL';
    const isLaundry = businessType === 'LAUNDRY';

    const getImageForProduct = (name: string, category: string, seed?: number) => {
      if (isBengkel) return generateBengkelImageUrl(name, category);
      if (isRetail) return generateRetailImageUrl(name, category);
      if (isLaundry) return generateLaundryImageUrl(name, category);
      return generateProfessionalFoodImageUrl(name, category, { style: photoStyle as FoodPhotoStyle, seed });
    };

    const geminiApiKey = (req.body.geminiApiKey as string)?.trim() || process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.status(400).json({
        error: 'Kunci API Gemini (GEMINI_API_KEY) belum diisi. Silakan masukkan Kunci API Gemini lewat tombol pengaturan di halaman ini atau tambahkan di file .env VPS.',
        code: 'MISSING_GEMINI_KEY'
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`;
    const prompt = `You are an expert F&B and retail menu digitization assistant.
Analyze these uploaded photos/images of the store's physical menu board, menu book, or price list sheets.
Extract all menu categories, determine station routing, and extract all individual products/items.

For each category:
1. "category": Clean, well-formatted name of the category (e.g. "Signature Coffee", "Non-Coffee", "Makanan Utama", "Cemilan & Snack"). Group similar items together.
2. "printerTarget": Station target for kitchen display:
   - "BAR" for beverages, coffees, teas, juices, mocktails.
   - "PASTRY" for bakeries, toasts, cakes, sweet desserts.
   - "KITCHEN" for main courses, rice dishes, noodles, fried snacks, savory food.
   - "NONE" for retail goods, laundry, or workshop items.
3. "items": Array of items. For each item:
   - "name": Clean item name (omit page numbers, price tags, or decorative characters).
   - "price": Plain integer in IDR (Indonesian Rupiah). For example: "18k", "18.000", "18rb" becomes 18000. "25" on a cafe menu becomes 25000.
   - "buyPrice": Estimated Cost of Goods (HPP), calculate as 30% to 35% of the selling price (integer).

Return ONLY strictly valid JSON with this exact structure:
[
  {
    "category": "Kopi & Minuman",
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

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[DraftMenu] Gemini Vision error response:', errText);
      return res.status(502).json({
        error: 'Gagal memproses gambar dengan Gemini AI Vision. Pastikan foto menu cukup jelas dan terbaca.'
      });
    }

    const geminiData = await geminiRes.json();
    const rawResponseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawResponseText) {
      return res.status(422).json({
        error: 'AI tidak mendeteksi teks daftar menu pada foto yang di-upload. Coba gunakan foto dengan pencahayaan yang lebih terang.'
      });
    }

    let cleanJson = rawResponseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('[DraftMenu] JSON parse error:', parseErr, rawResponseText);
      return res.status(422).json({ error: 'Gagal menguraikan struktur data menu dari foto.' });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return res.status(422).json({ error: 'Tidak ada item menu yang ditemukan dalam gambar.' });
    }

    // Perkaya dengan standard image estetik dan default HPP
    const enrichedCategories = parsed.map((cat: any) => {
      const catName = String(cat.category || 'Menu Utama').trim();
      const lowerCat = catName.toLowerCase();
      let defaultTarget = 'KITCHEN';
      if (lowerCat.includes('drink') || lowerCat.includes('kopi') || lowerCat.includes('coffee') || lowerCat.includes('tea') || lowerCat.includes('beverage') || lowerCat.includes('jus')) {
        defaultTarget = 'BAR';
      } else if (lowerCat.includes('pastry') || lowerCat.includes('bakery') || lowerCat.includes('cake') || lowerCat.includes('dessert') || lowerCat.includes('croissant')) {
        defaultTarget = 'PASTRY';
      }

      const printerTarget = cat.printerTarget || (isBengkel || isRetail || isLaundry ? 'NONE' : defaultTarget);

      const items = (cat.items || []).map((item: any, idx: number) => {
        const itemName = String(item.name || `Item ${idx + 1}`).trim();
        const price = Number(item.price) || 15000;
        const buyPrice = Number(item.buyPrice) || Math.round(price * 0.35);

        return {
          id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: itemName,
          price,
          buyPrice,
          imageUrl: getImageForProduct(itemName, catName, idx * 777),
          stock: 100,
          minStock: 5,
          status: 'Aktif'
        };
      });

      return {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        category: catName,
        printerTarget,
        items
      };
    });

    return res.json({
      success: true,
      totalPagesScanned: rawImagesList.length,
      categories: enrichedCategories
    });
  } catch (error: any) {
    console.error('[DraftMenu] extract-image error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem saat mengekstrak menu: ' + (error?.message || 'Unknown error') });
  }
});

/**
 * POST /api/draft-menu/generate-image-variations
 * Studio Foto AI: Menghasilkan beberapa alternatif variasi foto kuliner profesional
 * dengan gaya studio (Gourmet, Warm Cafe, Commercial, Rustic) dan seed berbeda.
 */
router.post('/generate-image-variations', requirePermission('products.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, style = 'CAFE_WARM', customInstruction, businessType = 'CAFE' } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Nama menu wajib diisi untuk generate gambar.' });
    }

    const catName = category || 'Menu';

    const isBengkel = businessType === 'BENGKEL';
    const isRetail = businessType === 'RETAIL';
    const isLaundry = businessType === 'LAUNDRY';

    if (isBengkel) {
      return res.json({
        success: true,
        variations: [
          { seed: 101, url: generateBengkelImageUrl(name, catName), label: 'Studio Workshop 1' },
          { seed: 202, url: generateBengkelImageUrl(name, catName) + '&seed=202', label: 'Studio Workshop 2' }
        ]
      });
    }

    if (isRetail) {
      return res.json({
        success: true,
        variations: [
          { seed: 301, url: generateRetailImageUrl(name, catName), label: 'Rak Retail Modern' },
          { seed: 302, url: generateRetailImageUrl(name, catName) + '&seed=302', label: 'Display Kemasan' }
        ]
      });
    }

    if (isLaundry) {
      return res.json({
        success: true,
        variations: [
          { seed: 401, url: generateLaundryImageUrl(name, catName), label: 'Laundry Bersih' },
          { seed: 402, url: generateLaundryImageUrl(name, catName) + '&seed=402', label: 'Tekstil Lipat Rapi' }
        ]
      });
    }

    // Generate 4 variasi foto kuliner profesional dengan gaya studio berbeda
    const variations = [
      {
        seed: Math.floor(Math.random() * 899999) + 100000,
        style: 'CAFE_WARM',
        label: '☕ Kafe & Kayu Alami (Warm Aesthetic)',
        url: generateProfessionalFoodImageUrl(name, catName, { style: 'CAFE_WARM', seed: 112233, customInstruction })
      },
      {
        seed: Math.floor(Math.random() * 899999) + 100000,
        style: 'GOURMET_STUDIO',
        label: '🍽️ Fine Dining Gourmet (Michelin Plating)',
        url: generateProfessionalFoodImageUrl(name, catName, { style: 'GOURMET_STUDIO', seed: 445566, customInstruction })
      },
      {
        seed: Math.floor(Math.random() * 899999) + 100000,
        style: 'COMMERCIAL_VIBRANT',
        label: '📸 Katalog Segar & Terang (Food Delivery)',
        url: generateProfessionalFoodImageUrl(name, catName, { style: 'COMMERCIAL_VIBRANT', seed: 778899, customInstruction })
      },
      {
        seed: Math.floor(Math.random() * 899999) + 100000,
        style: 'TRADITIONAL_RUSTIC',
        label: '🌶️ Tradisional & Daun Pisang (Rustic Warung)',
        url: generateProfessionalFoodImageUrl(name, catName, { style: 'TRADITIONAL_RUSTIC', seed: 991122, customInstruction })
      }
    ];

    return res.json({
      success: true,
      productName: name,
      category: catName,
      variations
    });
  } catch (err: any) {
    console.error('[DraftMenu] generate-image-variations error:', err);
    return res.status(500).json({ error: 'Gagal men-generate variasi foto: ' + (err?.message || 'Unknown error') });
  }
});

/**
 * POST /api/draft-menu/commit
 * Menyimpan seluruh kategori dan produk draft hasil review ke database tenant
 * serta men-trigger caching gambar ke storage lokal server di background
 */
router.post('/commit', requirePermission('products.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = req.user?.id;
    const { categories, mode = 'APPEND' } = req.body;

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Data draft menu kosong atau tidak valid.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Jika mode REPLACE, nonaktifkan atau soft-delete produk lama yang bukan bagian dari order aktif
      if (mode === 'REPLACE') {
        await tx.product.updateMany({
          where: { tenantId, deletedAt: null },
          data: { deletedAt: new Date(), status: 'Nonaktif' }
        });
      }

      let createdCategoriesCount = 0;
      let createdProductsCount = 0;

      for (const catData of categories) {
        const categoryName = String(catData.category || 'Menu Umum').trim();
        if (!categoryName) continue;

        // Cari atau buat Kategori
        let category = await tx.category.findFirst({
          where: {
            tenantId,
            name: categoryName,
            deletedAt: null
          }
        });

        if (!category) {
          category = await tx.category.create({
            data: {
              name: categoryName,
              tenantId,
              stationTarget: catData.printerTarget || 'KITCHEN'
            }
          });
          createdCategoriesCount++;
        }

        // Simpan setiap produk
        const items = Array.isArray(catData.items) ? catData.items : [];
        for (const item of items) {
          const itemName = String(item.name || '').trim();
          if (!itemName) continue;

          const sellPrice = Number(item.price) || 0;
          const buyPrice = Number(item.buyPrice) || 0;
          const stock = Number(item.stock) || 100;
          const minStock = Number(item.minStock) || 5;
          const imageUrl = item.imageUrl || null;

          // Buat produk baru
          await tx.product.create({
            data: {
              name: itemName,
              price: sellPrice,
              sellPrice,
              buyPrice,
              stock,
              minStock,
              imageUrl,
              status: item.status || 'Aktif',
              categoryId: category.id,
              tenantId
            }
          });

          createdProductsCount++;
        }
      }

      return { createdCategoriesCount, createdProductsCount };
    });

    // Invalidate cache dan kirim notifikasi WebSocket sinkronisasi
    try {
      invalidateTenantCache(tenantId);
      await cacheService.invalidateTenant(tenantId);
      await cacheService.bumpTenantCatalogVersion(tenantId);
      emitToTenant(tenantId, 'TENANT_CATALOG_SYNC', {
        tenantId,
        timestamp: new Date().toISOString(),
        message: `${result.createdProductsCount} menu baru berhasil ditambahkan dari upload draft menu.`
      });
    } catch (cacheErr) {
      console.warn('[DraftMenu] Cache invalidation warning:', cacheErr);
    }

    // Trigger local image caching job di background (agar gambar tersimpan di disk lokal server /uploads/products/ dan 100% offline-ready)
    try {
      ImageCacheService.cacheProductImages(tenantId).catch((cacheErr) => {
        console.warn('[DraftMenu] Background image cache warning:', cacheErr);
      });
    } catch (_) {}

    // Catat ke Audit Log
    await AuditLogger.log({
      tenantId,
      action: 'DRAFT_MENU_COMMIT',
      resource: 'PRODUCT',
      description: `Menambahkan ${result.createdProductsCount} produk baru ke ${result.createdCategoriesCount} kategori dari Draft Menu AI Vision.`,
      newValue: {
        totalProducts: result.createdProductsCount,
        totalCategories: result.createdCategoriesCount,
        mode
      },
      severity: 'INFO'
    }, req);

    return res.json({
      success: true,
      message: `Berhasil menambahkan ${result.createdProductsCount} menu ke katalog toko Anda!`,
      data: result
    });
  } catch (error: any) {
    console.error('[DraftMenu] commit error:', error);
    return res.status(500).json({ error: 'Gagal menyimpan draft menu ke katalog: ' + (error?.message || 'Unknown error') });
  }
});

export default router;
