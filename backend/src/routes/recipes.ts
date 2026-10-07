import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Helper to get tenant ID (fail-closed: returns undefined if unavailable)
function getTenantId(req: Request): string | undefined {
  const user = (req as any).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
}

// Router-level fail-closed guard: semua endpoint recipes membutuhkan tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({
      error: 'Tenant context tidak tersedia. Silakan login ulang.',
      code: 'MISSING_TENANT_CONTEXT'
    });
  }
  next();
});

// GET resep untuk satu produk (beserta kalkulasi HPP)
// SECURITY: Validasi kepemilikan product ke tenantId — mencegah pencurian resep lintas tenant
router.get('/product/:productId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { productId } = req.params;

    // Validasi kepemilikan product sebelum membaca resep
    const product = await prisma.product.findFirst({
      where: { id: Number(productId), tenantId }
    });
    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan atau bukan milik tenant ini' });
    }

    const recipes = await prisma.recipeItem.findMany({
      where: { productId: Number(productId) },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, buyPrice: true, stock: true }
        }
      }
    });

    // Kalkulasi HPP otomatis dari resep
    const hppOtomatis = recipes.reduce((sum, r) => {
      return sum + (r.ingredient.buyPrice * r.qtyPerServing);
    }, 0);

    res.json({ recipes, hppOtomatis });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil resep produk' });
  }
});

// PUT simpan/update semua resep untuk satu produk (replace all)
// SECURITY: Validasi kepemilikan product DAN setiap ingredient ke tenantId
// Mencegah: (1) overwrite resep tenant lain, (2) injeksi ingredient lintas tenant ke dalam resep
router.put('/product/:productId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { productId } = req.params;
    const { items } = req.body;
    // items: Array<{ ingredientId: number, qtyPerServing: number }>

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Format items tidak valid' });
    }

    // Validasi kepemilikan product sebelum modifikasi resep
    const product = await prisma.product.findFirst({
      where: { id: Number(productId), tenantId }
    });
    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan atau bukan milik tenant ini' });
    }

    // Validasi setiap ingredientId milik tenantId yang sama — mencegah nested FK injection
    if (items.length > 0) {
      const ingredientIds = items.map((i: any) => Number(i.ingredientId));
      const ownedIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, tenantId, deletedAt: null },
        select: { id: true }
      });
      const ownedIds = new Set(ownedIngredients.map(i => i.id));
      const foreignIds = ingredientIds.filter(id => !ownedIds.has(id));
      if (foreignIds.length > 0) {
        return res.status(403).json({
          error: 'Beberapa bahan baku bukan milik tenant ini',
          code: 'INGREDIENT_TENANT_MISMATCH',
          foreignIds
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Hapus semua resep lama
      await tx.recipeItem.deleteMany({ where: { productId: Number(productId) } });

      // Buat resep baru (terikat ke tenantId)
      if (items.length > 0) {
        await tx.recipeItem.createMany({
          data: items.map((item: any) => ({
            tenantId,
            productId: Number(productId),
            ingredientId: Number(item.ingredientId),
            qtyPerServing: Number(item.qtyPerServing)
          }))
        });
      }

      // Hitung dan update buyPrice produk berdasarkan HPP resep
      const newRecipes = await tx.recipeItem.findMany({
        where: { productId: Number(productId) },
        include: { ingredient: { select: { buyPrice: true } } }
      });

      const hppOtomatis = newRecipes.reduce((sum, r) => {
        return sum + (r.ingredient.buyPrice * r.qtyPerServing);
      }, 0);

      // Update buyPrice produk jika ada resep (HPP otomatis)
      if (newRecipes.length > 0) {
        await tx.product.update({
          where: { id: Number(productId) },
          data: { buyPrice: hppOtomatis }
        });
      }

      return newRecipes;
    });

    res.json({ message: 'Resep berhasil disimpan', recipes: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menyimpan resep' });
  }
});

// DELETE satu baris resep
// SECURITY: Validasi bahwa recipeItem milik tenant yang meminta — mencegah IDOR delete
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { id } = req.params;

    // Verifikasi kepemilikan melalui relasi product -> tenantId
    const recipeItem = await prisma.recipeItem.findFirst({
      where: {
        id: Number(id),
        product: { tenantId }
      },
      include: { product: { select: { tenantId: true } } }
    });
    if (!recipeItem) {
      return res.status(404).json({ error: 'Item resep tidak ditemukan atau bukan milik tenant ini' });
    }

    await prisma.recipeItem.delete({ where: { id: Number(id) } });
    res.json({ message: 'Bahan resep berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus bahan resep' });
  }
});

/**
 * POST /api/recipes/ai-suggest
 * Menghasilkan rekomendasi komposisi bahan baku (BOM) berdasarkan nama produk
 * Menggunakan Gemini 1.5 Flash dengan Fallback Rule-Based Engine
 */
router.post('/ai-suggest', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { productName, category = 'DRINK' } = req.body;

    if (!productName || typeof productName !== 'string') {
      return res.status(400).json({ error: 'Nama produk (productName) wajib diisi' });
    }

    // Ambil seluruh bahan baku aktif milik tenant ini untuk pencocokan
    const availableIngredients = await prisma.ingredient.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, unit: true, buyPrice: true, category: true }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    let source: 'GEMINI_AI' | 'RULE_BASED_ENGINE' = 'RULE_BASED_ENGINE';
    let suggestedItems: any[] = [];
    let explanation = '';

    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const systemPrompt = `You are an expert F&B Chef, Barista, and Laundry Operational Consultant in Indonesia.
The business owner wants a standard recipe (Bill of Materials) for product: "${productName}" (category: ${category}).
Recommend standard operational ingredient portions per 1 serving / 1 unit.

Available Ingredients already in tenant's inventory:
${JSON.stringify(availableIngredients.map(i => ({ id: i.id, name: i.name, unit: i.unit })))}

Instructions:
1. Prioritize matching ingredients with the available ingredients above (use exact id if matched).
2. If an essential ingredient is missing, set ingredientId to null and suggest appropriate name and unit (gram, ml, buah, or pcs).
3. Return STRICTLY JSON with this schema, no markdown wrapping, no extra text:
{
  "explanation": "Ringkasan takaran formula produk",
  "suggestedItems": [
    {
      "ingredientId": 10,
      "ingredientName": "Biji Kopi Espresso Blend",
      "qtyPerServing": 18,
      "unit": "gram"
    }
  ]
}`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed.suggestedItems) && parsed.suggestedItems.length > 0) {
              suggestedItems = parsed.suggestedItems;
              explanation = parsed.explanation || `Rekomendasi takaran standar untuk ${productName}`;
              source = 'GEMINI_AI';
            }
          }
        }
      } catch (geminiErr: any) {
        console.warn('[AI Recipe] Gemini call failed, using rule-based fallback:', geminiErr.message);
      }
    }

    // Fallback Rule-Based Engine jika Gemini offline / kuota habis / error
    if (suggestedItems.length === 0) {
      const pLower = productName.toLowerCase();
      const fallbackList: any[] = [];

      // Helper pencari bahan di inventory tenant
      const findIng = (keywords: string[]) => {
        return availableIngredients.find(i => 
          keywords.some(k => i.name.toLowerCase().includes(k))
        );
      };

      // 1. Minuman Kopi / Coffee
      if (pLower.includes('kopi') || pLower.includes('coffee') || pLower.includes('espresso') || pLower.includes('latte') || pLower.includes('cappuccino') || pLower.includes('americano') || pLower.includes('macchiato')) {
        explanation = 'Formula standar racikan espresso based 16oz';
        const coffeeBean = findIng(['kopi', 'espresso', 'bean']);
        fallbackList.push({
          ingredientId: coffeeBean?.id || null,
          ingredientName: coffeeBean?.name || 'Biji Kopi Espresso Blend',
          qtyPerServing: pLower.includes('double') ? 36 : 18,
          unit: coffeeBean?.unit || 'gram'
        });

        if (pLower.includes('latte') || pLower.includes('cappuccino') || pLower.includes('susu') || pLower.includes('macchiato')) {
          const milk = findIng(['susu', 'fresh milk', 'uht']);
          fallbackList.push({
            ingredientId: milk?.id || null,
            ingredientName: milk?.name || 'Susu UHT Fresh Milk',
            qtyPerServing: 120,
            unit: milk?.unit || 'ml'
          });
        }

        if (pLower.includes('aren')) {
          const aren = findIng(['aren', 'palm sugar']);
          fallbackList.push({
            ingredientId: aren?.id || null,
            ingredientName: aren?.name || 'Gula Aren Cair Organik',
            qtyPerServing: 25,
            unit: aren?.unit || 'ml'
          });
        } else if (pLower.includes('caramel') || pLower.includes('karamel')) {
          const car = findIng(['caramel', 'karamel']);
          fallbackList.push({
            ingredientId: car?.id || null,
            ingredientName: car?.name || 'Sirup Caramel',
            qtyPerServing: 20,
            unit: car?.unit || 'ml'
          });
        } else if (pLower.includes('vanilla') || pLower.includes('vanila')) {
          const van = findIng(['vanilla', 'vanila']);
          fallbackList.push({
            ingredientId: van?.id || null,
            ingredientName: van?.name || 'Sirup Vanilla',
            qtyPerServing: 20,
            unit: van?.unit || 'ml'
          });
        }

        const cup = findIng(['cup', 'gelas']);
        if (cup) {
          fallbackList.push({
            ingredientId: cup.id,
            ingredientName: cup.name,
            qtyPerServing: 1,
            unit: cup.unit
          });
        }
      }
      // 2. Matcha / Teh / Cokelat
      else if (pLower.includes('matcha') || pLower.includes('green tea')) {
        explanation = 'Formula takaran minuman matcha latte 16oz';
        const matcha = findIng(['matcha', 'green tea']);
        const milk = findIng(['susu', 'fresh milk', 'uht']);
        const cup = findIng(['cup', 'gelas']);
        fallbackList.push({
          ingredientId: matcha?.id || null,
          ingredientName: matcha?.name || 'Bubuk Matcha Premium',
          qtyPerServing: 25,
          unit: matcha?.unit || 'gram'
        });
        if (milk) fallbackList.push({ ingredientId: milk.id, ingredientName: milk.name, qtyPerServing: 120, unit: milk.unit });
        if (cup) fallbackList.push({ ingredientId: cup.id, ingredientName: cup.name, qtyPerServing: 1, unit: cup.unit });
      }
      else if (pLower.includes('cokelat') || pLower.includes('chocolate') || pLower.includes('choco')) {
        explanation = 'Formula takaran minuman dark chocolate 16oz';
        const choco = findIng(['cokelat', 'chocolate', 'cocoa']);
        const milk = findIng(['susu', 'fresh milk', 'uht']);
        const cup = findIng(['cup', 'gelas']);
        fallbackList.push({
          ingredientId: choco?.id || null,
          ingredientName: choco?.name || 'Bubuk Cokelat Murni (Dark Cocoa)',
          qtyPerServing: 30,
          unit: choco?.unit || 'gram'
        });
        if (milk) fallbackList.push({ ingredientId: milk.id, ingredientName: milk.name, qtyPerServing: 120, unit: milk.unit });
        if (cup) fallbackList.push({ ingredientId: cup.id, ingredientName: cup.name, qtyPerServing: 1, unit: cup.unit });
      }
      // 3. Bakery / Roti / Cake
      else if (pLower.includes('croissant') || pLower.includes('roti') || pLower.includes('bread') || pLower.includes('cake') || pLower.includes('bolu') || pLower.includes('pastry')) {
        explanation = 'Estimasi formula adonan per porsi bakery';
        const flour = findIng(['terigu', 'tepung']);
        const butter = findIng(['butter', 'mentega', 'margarin']);
        const egg = findIng(['telur']);
        const sugar = findIng(['gula']);
        if (flour) fallbackList.push({ ingredientId: flour.id, ingredientName: flour.name, qtyPerServing: 80, unit: flour.unit });
        if (butter) fallbackList.push({ ingredientId: butter.id, ingredientName: butter.name, qtyPerServing: 30, unit: butter.unit });
        if (egg) fallbackList.push({ ingredientId: egg.id, ingredientName: egg.name, qtyPerServing: 1, unit: egg.unit });
        if (sugar) fallbackList.push({ ingredientId: sugar.id, ingredientName: sugar.name, qtyPerServing: 20, unit: sugar.unit });
      }
      // 4. Jasa Laundry Kiloan / Satuan
      else if (pLower.includes('cuci') || pLower.includes('laundry') || pLower.includes('setrika') || pLower.includes('kilo') || pLower.includes('bed cover') || pLower.includes('jas')) {
        explanation = 'Takaran konsumsi bahan kimia laundry per 1 Kg / 1 Unit';
        const det = findIng(['deterjen', 'detergent']);
        const sof = findIng(['pelembut', 'softener']);
        const par = findIng(['parfum']);
        const pla = findIng(['plastik']);
        if (det) fallbackList.push({ ingredientId: det.id, ingredientName: det.name, qtyPerServing: 25, unit: det.unit });
        if (sof) fallbackList.push({ ingredientId: sof.id, ingredientName: sof.name, qtyPerServing: 15, unit: sof.unit });
        if (par) fallbackList.push({ ingredientId: par.id, ingredientName: par.name, qtyPerServing: 8, unit: par.unit });
        if (pla) fallbackList.push({ ingredientId: pla.id, ingredientName: pla.name, qtyPerServing: 1, unit: pla.unit });
      }

      suggestedItems = fallbackList;
      source = 'RULE_BASED_ENGINE';
    }

    // Kaitkan harga beli & kalkulasi estimasi HPP
    const itemsWithCost = suggestedItems.map(item => {
      const match = availableIngredients.find(i => 
        (item.ingredientId && i.id === item.ingredientId) || 
        i.name.trim().toLowerCase() === item.ingredientName.trim().toLowerCase()
      );

      const effectiveId = match ? match.id : item.ingredientId;
      const effectiveName = match ? match.name : item.ingredientName;
      const effectiveUnit = match ? match.unit : item.unit;
      const buyPrice = match ? match.buyPrice : 0;
      const costEstimate = buyPrice * (item.qtyPerServing || 1);

      return {
        ingredientId: effectiveId,
        ingredientName: effectiveName,
        qtyPerServing: item.qtyPerServing || 1,
        unit: effectiveUnit,
        buyPrice,
        costEstimate,
        inInventory: !!match
      };
    });

    const totalEstimatedHpp = itemsWithCost.reduce((sum, item) => sum + item.costEstimate, 0);

    return res.json({
      success: true,
      source,
      productName,
      explanation: explanation || `Rekomendasi resep untuk ${productName}`,
      suggestedItems: itemsWithCost,
      totalEstimatedHpp
    });
  } catch (error: any) {
    console.error('[AI Recipe Suggestion Error]', error);
    return res.status(500).json({ error: error.message || 'Gagal menghasilkan rekomendasi resep' });
  }
});

export default router;
