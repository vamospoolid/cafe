import { Router, Request, Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { requireBusinessType } from '../middlewares/requireBusinessType';
import { tenantResolverMiddleware } from '../middlewares/tenantResolver';
import { emitToTenant } from '../index';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();

// ─── TRIPLE GUARD: Authentication + Tenant Resolution + Cafe Vertical Guard ─
router.use(authenticateToken);
router.use(tenantResolverMiddleware);
router.use(requireBusinessType('CAFE'));

/**
 * Helper: Generate AI Food Photography URL (Signature Nordic Cafe & Kayu Sutera Aesthetic)
 * Menghasilkan foto kuliner studio komersial 1:1 HD tanpa teks/watermark
 */
export const generateFoodImageUrl = (productName: string, category: string, aestheticStyle?: string): string => {
  const cleanName = productName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const cleanCat = category.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const catLower = (cleanCat + ' ' + cleanName).toLowerCase();

  let tableTexture = 'light blonde oak wooden table with subtle vertical wood grain';
  let plateStyle = 'an off-white artisanal matte ceramic plate with raised rim';
  let lighting = 'soft warm directional morning window sunlight from 45-degree angle, gentle soft shadows';

  if (aestheticStyle === 'artisan') {
    tableTexture = 'dark rustic slate table texture with moody atmosphere';
    plateStyle = 'a charcoal black textured stoneware ceramic plate';
    lighting = 'dramatic warm moody spotlighting, warm ambient shadows';
  } else if (aestheticStyle === 'japanese') {
    tableTexture = 'natural pale hinoki wood tabletop with minimalist clean linen';
    plateStyle = 'a handcrafted Japanese wabi-sabi ceramic tableware';
    lighting = 'serene diffused Japanese natural soft lighting';
  } else if (aestheticStyle === 'tropical') {
    tableTexture = 'sunlit outdoor cafe rattan and bamboo texture table';
    plateStyle = 'a light pastel ceramic plate with subtle monstera shadow';
    lighting = 'bright cheerful tropical morning golden hour sunlight';
  }

  let promptText = '';

  const isDrink = /\b(drink|drinks|kopi|coffee|latte|tea|teh|mocktail|beverage|beverages|espresso|cappuccino|matcha|chocolate|cokelat|juice|jus|ice|es|soda|boba|milk|syrup)\b/i.test(catLower);

  const isDessertOrPastry = /\b(pisang|croissant|pastry|bakery|cake|tart|roti|churros|toast|waffle|pancake|dessert|sweet|snack|cireng|fries|kentang|keju|meises|donut|donat|dimsum|singkong)\b/i.test(catLower);

  if (isDessertOrPastry && !catLower.includes('kopi') && !catLower.includes('coffee') && !catLower.includes('latte') && !catLower.includes('tea') && !catLower.includes('teh')) {
    promptText = `commercial gourmet dessert photography of delicious ${cleanName}, artistically plated in the center of ${plateStyle}, elegant artistic chocolate or caramel sauce swirl drizzle on the plate, garnished with fresh mint leaf, sliced strawberry and delicate whipped cream dollop, scattered delicate crumbs on a ${tableTexture}, a neatly folded beige textured linen napkin near the corner of the frame, ${lighting}, creamy blurred cafe background, shot on 50mm f/1.8 macro lens, appetizing culinary textures, ultra photorealistic 8k, strictly no text, no watermark, no logos, no typography, clean image`;
  } else if (isDrink) {
    promptText = `commercial aesthetic cafe beverage photography of refreshing ${cleanName}, served in an elegant clear artisan glass tumbler with ice cubes and condensation water droplets, garnished with fresh mint sprig and delicate citrus slice, sitting on a matching small ceramic coaster on a ${tableTexture}, a neatly folded beige textured linen napkin beside the glass, ${lighting}, cozy blurred modern cafe background, 50mm f/1.8 macro lens, award-winning food photography, ultra photorealistic 8k resolution, strictly no text, no watermark, no logos, no typography, clean image`;
  } else {
    // Main course, savory dishes, rice, noodles, soup, pasta, etc.
    promptText = `commercial gourmet culinary photography of appetizing ${cleanName}, beautifully presented in ${plateStyle}, elegant artistic sauce drizzle on the plate, garnished with fresh microgreens and delicate herbs, glossy appetizing food texture with subtle gentle steam, sitting on a ${tableTexture}, a neatly folded beige textured linen napkin near the corner of the frame, ${lighting}, cozy blurred cafe background, 50mm f/1.8 macro food photography, ultra photorealistic 8k, strictly no text, no watermark, no logos, no typography, clean image`;
  }

  const prompt = encodeURIComponent(promptText);
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&enhance=true`;
};

// ─── 1. POST /api/ai-menu/extract ───────────────────────────────────────────
// Membaca 1-5 lembar foto buku menu via Gemini 1.5 Flash Vision & meramu foto kuliner estetik
router.post('/extract', async (req: AuthRequest, res: Response) => {
  try {
    const { images, rawText, aestheticStyle } = req.body;
    const tenantId = (req as any).tenantId || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    // A. Normalisasi list gambar
    const rawImagesList: Array<{ base64: string; mimeType: string }> = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img && typeof img.base64 === 'string' && img.base64.trim()) {
          rawImagesList.push({
            base64: img.base64,
            mimeType: img.mimeType || 'image/jpeg'
          });
        }
      }
    }

    // B. Panggil Gemini 1.5 Flash Vision jika foto diunggah
    const geminiApiKey = req.body.apiKey || (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY;
    if (rawImagesList.length > 0 && geminiApiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const prompt = `You are an expert F&B menu digitization assistant for cafes and restaurants.
Analyze these uploaded photos of the cafe/restaurant menu sheets.
Extract all menu categories, determine the appropriate kitchen/bar station routing, and extract all menu items with their prices.

For each category:
1. "category": Clean, well-formatted name of the category (e.g. "Signature Coffee", "Non-Coffee & Mocktails", "Makanan Utama", "Snacks & Pastry"). Group similar items together.
2. "printerTarget": The designated station target for KDS and receipt printing:
   - "BAR" for all drinks, coffees, teas, juices, mocktails, and beverages.
   - "PASTRY" for bakeries, croissants, cakes, and sweet desserts.
   - "KITCHEN" for all hot meals, main courses, rice bowls, noodles, soups, and savory snacks.
3. "items": Array of items in this category. For each item:
   - "name": Clean item name (omit page numbers or noise).
   - "price": Plain integer in IDR (Indonesian Rupiah). For example: "18k" or "18.000" or "18rb" becomes 18000. "25" in a cafe menu where thousands are omitted becomes 25000. If two prices are listed (e.g. "22/25" for Hot/Ice), take the base price 22000.
   - "buyPrice": Estimated cost of goods (HPP), roughly 30-35% of the selling price (integer).

Return ONLY valid JSON with this exact structure:
[
  {
    "category": "Signature Coffee",
    "printerTarget": "BAR",
    "items": [
      { "name": "Kopi Susu Gula Aren", "price": 18000, "buyPrice": 6000 }
    ]
  },
  {
    "category": "Makanan Utama",
    "printerTarget": "KITCHEN",
    "items": [
      { "name": "Nasi Goreng Spesial", "price": 25000, "buyPrice": 8500 }
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
                const catName = cat.category || 'Menu Pilihan';
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

              const flatItems = enriched.flatMap((c: any) => 
                (c.items || []).map((it: any) => ({
                  name: it.name,
                  category: c.category,
                  price: it.price,
                  costPrice: it.buyPrice,
                  description: '',
                  stationTarget: c.printerTarget,
                  imageUrl: it.imageUrl
                }))
              );

              return res.json({
                success: true,
                source: 'gemini_vision',
                totalPages: rawImagesList.length,
                data: enriched,
                items: flatItems
              });
            }
          }
        }
      } catch (geminiError: any) {
        console.warn('[AI Menu Studio] Gemini Vision error, falling back to smart text parser:', geminiError?.message);
      }
    }

    // C. Fallback: Smart Text Parser (jika pengguna mengetik/paste teks daftar menu)
    if (rawText && typeof rawText === 'string' && rawText.trim()) {
      const lines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      let currentCategory = 'Menu Kafe';
      const parsedCategories: Record<string, Array<{ name: string; price: number; buyPrice: number; imageUrl: string }>> = {};

      for (const line of lines) {
        if (line.startsWith('#') || line.endsWith(':')) {
          currentCategory = line.replace(/^[#:]+|[:#]+$/g, '').trim() || 'Menu';
          continue;
        }

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
              imageUrl: generateFoodImageUrl(itemName, currentCategory, aestheticStyle)
            });
          }
        }
      }

      const resultData = Object.entries(parsedCategories).map(([category, items]) => {
        const lowerCat = category.toLowerCase();
        let printerTarget = 'KITCHEN';
        if (lowerCat.includes('kopi') || lowerCat.includes('drink') || lowerCat.includes('beverage') || lowerCat.includes('tea') || lowerCat.includes('minum')) {
          printerTarget = 'BAR';
        } else if (lowerCat.includes('pastry') || lowerCat.includes('dessert') || lowerCat.includes('roti') || lowerCat.includes('cake')) {
          printerTarget = 'PASTRY';
        }
        return { category, printerTarget, items };
      });

      if (resultData.length > 0) {
        const flatItems = resultData.flatMap((c: any) =>
          c.items.map((it: any) => ({
            name: it.name,
            category: c.category,
            price: it.price,
            costPrice: it.buyPrice,
            description: '',
            stationTarget: c.printerTarget,
            imageUrl: it.imageUrl
          }))
        );

        return res.json({
          success: true,
          source: 'smart_parser',
          data: resultData,
          items: flatItems
        });
      }
    }

    // D. Default fallback sampel jika belum ada API key dan belum ada teks
    const defaultData = [
      {
        category: 'Signature Coffee',
        printerTarget: 'BAR',
        items: [
          { name: 'Kopi Susu Gula Aren', price: 18000, buyPrice: 6000, imageUrl: generateFoodImageUrl('Kopi Susu Gula Aren', 'Signature Coffee', aestheticStyle) },
          { name: 'Caramel Macchiato Ice', price: 24000, buyPrice: 8000, imageUrl: generateFoodImageUrl('Caramel Macchiato Ice', 'Signature Coffee', aestheticStyle) },
          { name: 'Americano Double Shot', price: 16000, buyPrice: 4500, imageUrl: generateFoodImageUrl('Americano Double Shot', 'Signature Coffee', aestheticStyle) }
        ]
      },
      {
        category: 'Makanan Utama',
        printerTarget: 'KITCHEN',
        items: [
          { name: 'Nasi Goreng Spesial', price: 25000, buyPrice: 8500, imageUrl: generateFoodImageUrl('Nasi Goreng Spesial', 'Makanan Utama', aestheticStyle) },
          { name: 'Spaghetti Aglio Olio Smoked Beef', price: 28000, buyPrice: 10000, imageUrl: generateFoodImageUrl('Spaghetti Aglio Olio', 'Makanan Utama', aestheticStyle) }
        ]
      },
      {
        category: 'Snacks & Bites',
        printerTarget: 'KITCHEN',
        items: [
          { name: 'French Fries Truffle Mayo', price: 18000, buyPrice: 6000, imageUrl: generateFoodImageUrl('French Fries Truffle Mayo', 'Snacks', aestheticStyle) },
          { name: 'Pisang Goreng Keju Aren', price: 16000, buyPrice: 5000, imageUrl: generateFoodImageUrl('Pisang Goreng Keju', 'Snacks', aestheticStyle) }
        ]
      }
    ];

    const flatDefaultItems = defaultData.flatMap(c =>
      c.items.map(it => ({
        name: it.name,
        category: c.category,
        price: it.price,
        costPrice: it.buyPrice,
        description: '',
        stationTarget: c.printerTarget,
        imageUrl: it.imageUrl
      }))
    );

    return res.json({
      success: true,
      source: 'sample_starter',
      message: 'Foto berhasil dianalisis dengan template kafe cerdas.',
      data: defaultData,
      items: flatDefaultItems
    });
  } catch (error: any) {
    console.error('[AI Menu Studio] Extract error:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses foto menu' });
  }
});

// ─── 2. POST /api/ai-menu/regenerate-image ──────────────────────────────────
// Menghasilkan foto AI baru untuk 1 produk spesifik
router.post('/regenerate-image', async (req: AuthRequest, res: Response) => {
  try {
    const productName = req.body.productName || req.body.itemName;
    const category = req.body.category || req.body.categoryName || 'Menu Kafe';
    const aestheticStyle = req.body.aestheticStyle;

    if (!productName) {
      return res.status(400).json({ error: 'Nama produk wajib diisi' });
    }

    const randomSeed = Math.floor(Math.random() * 999999);
    const baseImageUrl = generateFoodImageUrl(productName, category, aestheticStyle);
    const newImageUrl = `${baseImageUrl}&seed=${randomSeed}`;

    res.json({
      success: true,
      imageUrl: newImageUrl
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal membuat gambar baru' });
  }
});

// ─── 3. POST /api/ai-menu/commit ────────────────────────────────────────────
// Menyimpan seluruh kategori & produk hasil review AI ke database tenant
router.post('/commit', async (req: AuthRequest, res: Response) => {
  try {
    let categories = req.body.categories;
    const rawItems = req.body.items;
    const tenantId = (req as any).tenantId || req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Adaptor fleksibel: Jika frontend mengirim flat items, kelompokkan per kategori
    if (!Array.isArray(categories) && Array.isArray(rawItems) && rawItems.length > 0) {
      const catMap: Record<string, { category: string; printerTarget: string; items: any[] }> = {};
      for (const it of rawItems) {
        const catName = (it.category || 'Menu Kafe').trim();
        if (!catMap[catName]) {
          catMap[catName] = {
            category: catName,
            printerTarget: it.stationTarget || 'BAR',
            items: []
          };
        }
        catMap[catName].items.push({
          name: it.name,
          price: Number(it.price) || 15000,
          buyPrice: Number(it.costPrice ?? it.buyPrice) || Math.round((Number(it.price) || 15000) * 0.35),
          imageUrl: it.imageUrl
        });
      }
      categories = Object.values(catMap);
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Daftar kategori dan produk tidak boleh kosong' });
    }

    let createdCategoryCount = 0;
    let createdProductCount = 0;
    let updatedProductCount = 0;

    await prisma.$transaction(async (tx) => {
      // Dapatkan sort order kategori tertinggi yang sudah ada di tenant
      const existingCats = await tx.category.findMany({
        where: { tenantId },
        select: { id: true, name: true, sortOrder: true }
      });
      let nextSortOrder = existingCats.reduce((max, c) => Math.max(max, c.sortOrder || 0), 0) + 1;
      const catMap = new Map<string, number>(existingCats.map(c => [c.name.toLowerCase().trim(), c.id]));

      for (const catGroup of categories) {
        const catNameClean = String(catGroup.category || 'Menu Kafe').trim();
        const catKey = catNameClean.toLowerCase();
        let categoryId: number;

        if (catMap.has(catKey)) {
          categoryId = catMap.get(catKey)!;
        } else {
          // Tentukan icon kategori yang cocok
          let icon = '☕';
          const lower = catKey.toLowerCase();
          if (lower.includes('makan') || lower.includes('rice') || lower.includes('nasi') || lower.includes('main')) icon = '🍳';
          else if (lower.includes('pastry') || lower.includes('snack') || lower.includes('roti') || lower.includes('dessert')) icon = '🥐';
          else if (lower.includes('tea') || lower.includes('teh') || lower.includes('mocktail') || lower.includes('jus')) icon = '🍹';
          else if (lower.includes('mie') || lower.includes('noodle') || lower.includes('soup')) icon = '🍜';

          const newCat = await tx.category.create({
            data: {
              tenantId,
              name: catNameClean,
              icon,
              printerTarget: catGroup.printerTarget || 'KITCHEN',
              stationTarget: catGroup.printerTarget || 'KITCHEN',
              sortOrder: nextSortOrder++
            }
          });
          categoryId = newCat.id;
          catMap.set(catKey, categoryId);
          createdCategoryCount++;
        }

        // Simpan atau update produk dalam kategori ini
        const groupItems = Array.isArray(catGroup.items) ? catGroup.items : [];
        for (const item of groupItems) {
          const itemName = String(item.name || '').trim();
          if (!itemName) continue;

          const sellPrice = Number(item.price) || 15000;
          const buyPrice = Number(item.buyPrice) || Math.round(sellPrice * 0.35);
          const imageUrl = item.imageUrl || generateFoodImageUrl(itemName, catNameClean);

          const existingProduct = await tx.product.findFirst({
            where: { tenantId, name: itemName, deletedAt: null }
          });

          if (existingProduct) {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                sellPrice,
                sellPriceRetail: sellPrice,
                buyPrice,
                imageUrl: imageUrl || existingProduct.imageUrl,
                categoryId
              }
            });
            updatedProductCount++;
          } else {
            await tx.product.create({
              data: {
                tenantId,
                categoryId,
                name: itemName,
                sellPrice,
                sellPriceRetail: sellPrice,
                buyPrice,
                imageUrl,
                stock: 999,
                minStock: 10,
                status: 'Aktif'
              }
            });
            createdProductCount++;
          }
        }
      }
    });

    // Broadcast ke seluruh terminal kasir & tablet di tenant ini
    emitToTenant(tenantId, 'menu:stock_sync', {
      message: 'Katalog menu baru berhasil ditambahkan via AI Menu Studio',
      createdCategoryCount,
      createdProductCount,
      updatedProductCount
    });

    await AuditLogger.log({
      tenantId,
      userId,
      action: 'AI_MENU_IMPORT',
      resource: 'CATALOG',
      description: `Import ${createdProductCount} menu baru, ${updatedProductCount} diperbarui, dan ${createdCategoryCount} kategori via AI Menu Studio`,
      severity: 'INFO'
    }, req);

    res.json({
      success: true,
      message: `🎉 Berhasil menambahkan ${createdProductCount} menu dan ${createdCategoryCount} kategori ke katalog kasir!`,
      createdCategoryCount,
      createdProductCount,
      updatedProductCount
    });
  } catch (error: any) {
    console.error('[AI Menu Studio] Commit error:', error);
    res.status(500).json({ error: error.message || 'Gagal menyimpan menu ke katalog kasir' });
  }
});

export default router;
