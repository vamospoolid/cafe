import prisma from '../db';
import { cacheService } from './CacheService';

export interface ProductMenuMetric {
  id: number;
  name: string;
  categoryName?: string;
  sellPrice: number;
  hpp: number;
  foodCostPercent: number;
  grossMargin: number;
  soldQty30d: number;
  revenue30d: number;
  profitContribution30d: number;
  quadrant: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';
}

export interface StrategyCard {
  id: string;
  tacticType: 'PORTION_OPTIMIZATION' | 'SMART_BUNDLING' | 'ADDON_MONETIZATION' | 'DECOY_MENU' | 'CHANNEL_PRICING';
  title: string;
  strategyName?: string;
  targetProductName: string;
  targetProducts?: string[];
  riskLevel: 'ZERO_RISK' | 'LOW_RISK' | 'MEDIUM_RISK';
  riskLabel: string;
  currentHpp: number;
  currentSellPrice: number;
  suggestedAction: string;
  actionableStep?: string;
  psychologicalReason: string;
  psychologicalRationale?: string;
  estimatedMonthlyGain: number;
}

export interface AiMenuAnalysisResult {
  tenantId: string;
  generatedAt: string;
  source: 'GEMINI_AI' | 'RULE_BASED_ENGINE';
  summary: {
    totalActiveProducts: number;
    overallFoodCostPercent: number;
    healthScore: number;
    healthStatus: 'HEALTHY' | 'MODERATE' | 'NEEDS_ATTENTION';
    estimatedMonthlyGainPotential: number;
  };
  overallHealthScore: number;
  overallFoodCostPercentage: number;
  totalPotentialProfitMonthly: number;
  executiveSummary: string;
  metrics: {
    totalProductsAnalyzed: number;
    avgFoodCost: number;
    totalMonthlyVolume: number;
  };
  quadrants: {
    stars: ProductMenuMetric[];
    plowhorses: ProductMenuMetric[];
    puzzles: ProductMenuMetric[];
    dogs: ProductMenuMetric[];
  };
  strategies: StrategyCard[];
}

export class AiMenuOptimizerService {
  private static instance: AiMenuOptimizerService;

  public static getInstance(): AiMenuOptimizerService {
    if (!AiMenuOptimizerService.instance) {
      AiMenuOptimizerService.instance = new AiMenuOptimizerService();
    }
    return AiMenuOptimizerService.instance;
  }

  /**
   * Run complete Menu Engineering analysis with BCG matrix & customer-safe Gemini AI strategies.
   */
  public async analyzeMenu(tenantId: string, forceRefresh = false): Promise<AiMenuAnalysisResult> {
    if (!tenantId) {
      throw new Error('Tenant context required for menu analysis');
    }

    const cacheKey = `cache:ai_menu_advisor:${tenantId}`;

    if (!forceRefresh) {
      const cached = await cacheService.get<AiMenuAnalysisResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 1. Fetch all active products for tenant with recipes and ingredients
    const products = await prisma.product.findMany({
      where: { tenantId, deletedAt: null, status: 'Aktif' },
      include: {
        category: { select: { name: true } },
        recipes: {
          include: {
            ingredient: { select: { id: true, name: true, buyPrice: true, unit: true } }
          }
        }
      }
    });

    if (products.length === 0) {
      const emptyResult: AiMenuAnalysisResult = {
        tenantId,
        generatedAt: new Date().toISOString(),
        source: 'RULE_BASED_ENGINE',
        summary: {
          totalActiveProducts: 0,
          overallFoodCostPercent: 0,
          healthScore: 100,
          healthStatus: 'HEALTHY',
          estimatedMonthlyGainPotential: 0
        },
        overallHealthScore: 100,
        overallFoodCostPercentage: 0,
        totalPotentialProfitMonthly: 0,
        executiveSummary: 'Belum ada produk aktif untuk dianalisis. Tambahkan produk ke katalog Anda terlebih dahulu.',
        metrics: {
          totalProductsAnalyzed: 0,
          avgFoodCost: 0,
          totalMonthlyVolume: 0
        },
        quadrants: { stars: [], plowhorses: [], puzzles: [], dogs: [] },
        strategies: []
      };
      return emptyResult;
    }

    // 2. Fetch 30-day sales volume per product
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        tenantId,
        order: {
          status: 'Paid',
          createdAt: { gte: thirtyDaysAgo }
        }
      },
      select: {
        productId: true,
        qty: true,
        price: true,
        subtotal: true
      }
    });

    const salesMap = new Map<number, { qty: number; revenue: number }>();
    for (const itm of orderItems) {
      const current = salesMap.get(itm.productId) || { qty: 0, revenue: 0 };
      salesMap.set(itm.productId, {
        qty: current.qty + Number(itm.qty || 1),
        revenue: current.revenue + Number(itm.subtotal || 0)
      });
    }

    // 3. Compute HPP, Food Cost %, Margin for each product
    let totalRevenue = 0;
    let totalHppCost = 0;
    let totalQty = 0;

    const metricsList: ProductMenuMetric[] = products.map((prod) => {
      let realHpp = Number(prod.buyPrice) || 0;

      // If recipe items exist, compute sum of ingredient costs
      if (prod.recipes && prod.recipes.length > 0) {
        const recipeHpp = prod.recipes.reduce((sum, r) => {
          const ingPrice = Number(r.ingredient?.buyPrice || 0);
          const qtyUsed = Number(r.qtyPerServing || 0);
          return sum + (ingPrice * qtyUsed);
        }, 0);
        if (recipeHpp > 0) realHpp = recipeHpp;
      }

      const sellPrice = Number(prod.sellPrice) || 0;
      const foodCostPercent = sellPrice > 0 ? Math.round((realHpp / sellPrice) * 1000) / 10 : 0;
      const grossMargin = sellPrice - realHpp;

      const sales = salesMap.get(prod.id) || { qty: 0, revenue: 0 };
      const soldQty30d = sales.qty;
      const revenue30d = sales.revenue;
      const profitContribution30d = grossMargin * soldQty30d;

      totalRevenue += revenue30d;
      totalHppCost += (realHpp * soldQty30d);
      totalQty += soldQty30d;

      return {
        id: prod.id,
        name: prod.name,
        categoryName: prod.category?.name,
        sellPrice,
        hpp: Math.round(realHpp),
        foodCostPercent,
        grossMargin: Math.round(grossMargin),
        soldQty30d,
        revenue30d,
        profitContribution30d: Math.round(profitContribution30d),
        quadrant: 'STAR' as const // temporary placeholder
      };
    });

    // 4. Calculate Average Thresholds for BCG Quadrants
    const avgSoldQty = metricsList.length > 0 ? Math.max(1, Math.round(totalQty / metricsList.length)) : 1;
    const TARGET_FOOD_COST_PERCENT = 35; // Standard F&B benchmark: Food cost <= 35% is profitable

    const stars: ProductMenuMetric[] = [];
    const plowhorses: ProductMenuMetric[] = [];
    const puzzles: ProductMenuMetric[] = [];
    const dogs: ProductMenuMetric[] = [];

    metricsList.forEach((m) => {
      const isHighVolume = m.soldQty30d >= avgSoldQty;
      const isHealthyMargin = m.foodCostPercent <= TARGET_FOOD_COST_PERCENT;

      if (isHighVolume && isHealthyMargin) {
        m.quadrant = 'STAR';
        stars.push(m);
      } else if (isHighVolume && !isHealthyMargin) {
        m.quadrant = 'PLOWHORSE';
        plowhorses.push(m);
      } else if (!isHighVolume && isHealthyMargin) {
        m.quadrant = 'PUZZLE';
        puzzles.push(m);
      } else {
        m.quadrant = 'DOG';
        dogs.push(m);
      }
    });

    // 5. Calculate Store-Wide Food Cost % & Health Score
    const overallFoodCostPercent = totalRevenue > 0
      ? Math.round((totalHppCost / totalRevenue) * 1000) / 10
      : (metricsList.reduce((sum, m) => sum + m.foodCostPercent, 0) / (metricsList.length || 1));

    let healthScore = 100;
    if (overallFoodCostPercent > 35) {
      healthScore -= Math.min(40, (overallFoodCostPercent - 35) * 3);
    }
    if (dogs.length > stars.length) {
      healthScore -= 15;
    }
    healthScore = Math.max(30, Math.min(100, Math.round(healthScore)));

    const healthStatus: 'HEALTHY' | 'MODERATE' | 'NEEDS_ATTENTION' =
      healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'MODERATE' : 'NEEDS_ATTENTION';

    // 6. Generate Strategies: Try Gemini AI first, fallback to Rule-Based Engine
    let strategies: StrategyCard[] = [];
    let source: 'GEMINI_AI' | 'RULE_BASED_ENGINE' = 'RULE_BASED_ENGINE';

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        strategies = await this.generateGeminiStrategies(geminiKey, {
          overallFoodCostPercent,
          stars,
          plowhorses,
          puzzles,
          dogs
        });
        source = 'GEMINI_AI';
      } catch (geminiErr: any) {
        console.warn('[AiMenuOptimizer] Gemini call failed, using rule-based fallback:', geminiErr.message);
        strategies = this.generateRuleBasedStrategies(plowhorses, puzzles, stars, dogs);
      }
    } else {
      strategies = this.generateRuleBasedStrategies(plowhorses, puzzles, stars, dogs);
    }

    const totalPotentialMonthlyGain = strategies.reduce((sum, s) => sum + (s.estimatedMonthlyGain || 0), 0);

    const result: AiMenuAnalysisResult = {
      tenantId,
      generatedAt: new Date().toISOString(),
      source,
      summary: {
        totalActiveProducts: products.length,
        overallFoodCostPercent,
        healthScore,
        healthStatus,
        estimatedMonthlyGainPotential: totalPotentialMonthlyGain
      },
      overallHealthScore: healthScore,
      overallFoodCostPercentage: overallFoodCostPercent,
      totalPotentialProfitMonthly: totalPotentialMonthlyGain,
      executiveSummary: healthScore >= 80 
        ? `Portofolio menu Anda berada dalam kondisi prima dengan rata-rata Food Cost ${overallFoodCostPercent}%. Lindungi menu Star dan optimalkan Plowhorses untuk mendongkrak profit bulanan hingga +Rp ${totalPotentialMonthlyGain.toLocaleString('id-ID')}.`
        : `Ditemukan potensi peningkatan margin signifikan. Rata-rata Food Cost saat ini ${overallFoodCostPercent}%. Terapkan takaran standar pada menu Plowhorses untuk mengamankan tambahan laba +Rp ${totalPotentialMonthlyGain.toLocaleString('id-ID')} per bulan tanpa menaikkan harga jual.`,
      metrics: {
        totalProductsAnalyzed: products.length,
        avgFoodCost: overallFoodCostPercent,
        totalMonthlyVolume: totalQty
      },
      quadrants: {
        stars: stars.sort((a, b) => b.revenue30d - a.revenue30d),
        plowhorses: plowhorses.sort((a, b) => b.soldQty30d - a.soldQty30d),
        puzzles: puzzles.sort((a, b) => a.foodCostPercent - b.foodCostPercent),
        dogs: dogs.sort((a, b) => b.foodCostPercent - a.foodCostPercent)
      },
      strategies: strategies.map(s => ({
        ...s,
        strategyName: s.strategyName || s.title,
        actionableStep: s.actionableStep || s.suggestedAction,
        psychologicalRationale: s.psychologicalRationale || s.psychologicalReason,
        targetProducts: s.targetProducts || [s.targetProductName]
      }))
    };

    // Cache result for 1 hour (3600 seconds)
    await cacheService.set(cacheKey, result, 3600);

    return result;
  }

  /**
   * Gemini 1.5 Flash Call with strict F&B Menu Engineering & Customer-Safe System Prompt
   */
  private async generateGeminiStrategies(
    apiKey: string,
    context: {
      overallFoodCostPercent: number;
      stars: ProductMenuMetric[];
      plowhorses: ProductMenuMetric[];
      puzzles: ProductMenuMetric[];
      dogs: ProductMenuMetric[];
    }
  ): Promise<StrategyCard[]> {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Anda adalah Konsultan Bisnis F&B & Menu Engineering Specialist kelas dunia.
Berikut adalah data menu restoran/kafe kami:
- Rata-rata Food Cost Keseluruhan: ${context.overallFoodCostPercent}% (Target Sehat <= 35%)
- Kategori PLOWHORSE (Laris tapi Food Cost Boros > 35%): ${JSON.stringify(context.plowhorses.slice(0, 5).map(p => ({ name: p.name, hpp: p.hpp, sellPrice: p.sellPrice, foodCost: `${p.foodCostPercent}%`, sold: p.soldQty30d })))}
- Kategori PUZZLE (Margin Tebal tapi Kurang Laris): ${JSON.stringify(context.puzzles.slice(0, 5).map(p => ({ name: p.name, hpp: p.hpp, sellPrice: p.sellPrice, foodCost: `${p.foodCostPercent}%`, sold: p.soldQty30d })))}
- Kategori STAR (Sangat Laris & Margin Sehat): ${JSON.stringify(context.stars.slice(0, 3).map(p => ({ name: p.name, sellPrice: p.sellPrice, sold: p.soldQty30d })))}

ATURAN BISNIS MUTLAK:
Owner TIDAK BOLEH sembarangan menaikkan harga jual menu favorit karena takut pelanggan setia kabur.
Gunakan 4 Taktik Pelindung Margin Aman Pelanggan:
1. PORTION_OPTIMIZATION (Risiko: ZERO_RISK) -> Pertahankan harga jual, efisiensikan gramasi/takaran resep bahan baku.
2. SMART_BUNDLING (Risiko: LOW_RISK) -> Gabungkan menu Star/Plowhorse yang laris dengan menu Puzzle margin tebal sebagai paket hemat (Combo).
3. ADDON_MONETIZATION (Risiko: ZERO_RISK) -> Harga menu utama tetap murah, keuntungan diambil dari variasi tambahan (+Oatmilk, +Extra Shot, +Topping).
4. DECOY_MENU (Risiko: LOW_RISK) -> Buat opsi ukuran besar (1 Liter/Signature) agar menu reguler terlihat terjangkau.

Kembalikan respon HANYA dalam format JSON valid tanpa tanda markdown (Array of StrategyCard):
[
  {
    "id": "strat_1",
    "tacticType": "PORTION_OPTIMIZATION",
    "title": "Efisiensi Takaran Resep Tanpa Mengubah Harga",
    "targetProductName": "Nama Menu",
    "riskLevel": "ZERO_RISK",
    "riskLabel": "Risiko Pelanggan: 0% (Harga Tetap)",
    "currentHpp": 10000,
    "currentSellPrice": 22000,
    "suggestedAction": "Kurangi takaran syrup/susu 15% tanpa mengubah rasa...",
    "psychologicalReason": "Pelanggan tidak merasakan perbedaan rasa, namun HPP turun...",
    "estimatedMonthlyGain": 750000
  }
]`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    };

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promptPayload)
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Gemini');

    const parsed: StrategyCard[] = JSON.parse(rawText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid JSON format from Gemini');
    }

    return parsed;
  }

  /**
   * Resilient Rule-Based Mathematical Fallback Generator (When Gemini is offline/absent)
   */
  public generateRuleBasedStrategies(
    plowhorses: ProductMenuMetric[],
    puzzles: ProductMenuMetric[],
    stars: ProductMenuMetric[],
    dogs: ProductMenuMetric[]
  ): StrategyCard[] {
    const cards: StrategyCard[] = [];

    // Strategy 1: Portion & Recipe Optimization for top Plowhorses (0% Customer Risk)
    if (plowhorses.length > 0) {
      const target = plowhorses[0];
      const monthlySold = Math.max(10, target.soldQty30d);
      const hppReduction = Math.round(target.hpp * 0.12); // Assume 12% recipe trimming
      const monthlyGain = hppReduction * monthlySold;

      cards.push({
        id: 'strat_portion_1',
        tacticType: 'PORTION_OPTIMIZATION',
        title: `Optimasi Takaran Resep: ${target.name}`,
        targetProductName: target.name,
        riskLevel: 'ZERO_RISK',
        riskLabel: 'Risiko Pelanggan: 0% (Harga Tetap Sama)',
        currentHpp: target.hpp,
        currentSellPrice: target.sellPrice,
        suggestedAction: `Pertahankan harga jual Rp ${target.sellPrice.toLocaleString('id-ID')}. Sesuaikan gramasi takaran bahan resep sebesar 10-15% (contoh: kurangi syrup/bumbu utama sedikit atau gunakan teknik frothing susu lebih tebal). HPP terpotong ~Rp ${hppReduction.toLocaleString('id-ID')} per porsi.`,
        psychologicalReason: 'Pelanggan tidak akan merasa dirugikan karena harga tidak naik dan volume sajian fisik tetap penuh, namun margin keuntungan Anda langsung meningkat.',
        estimatedMonthlyGain: monthlyGain
      });
    }

    // Strategy 2: Smart Bundling / Combo Pairing (Star/Plowhorse + Puzzle)
    if (puzzles.length > 0 && (stars.length > 0 || plowhorses.length > 0)) {
      const anchor = stars[0] || plowhorses[0];
      const companion = puzzles[0];
      const bundlePrice = Math.round((anchor.sellPrice + companion.sellPrice) * 0.88 / 1000) * 1000;
      const combinedHpp = anchor.hpp + companion.hpp;
      const profitPerBundle = bundlePrice - combinedHpp;
      const estimatedBundlesSold = Math.max(20, Math.round(anchor.soldQty30d * 0.3));
      const monthlyGain = profitPerBundle * estimatedBundlesSold;

      cards.push({
        id: 'strat_bundle_1',
        tacticType: 'SMART_BUNDLING',
        title: `Paket Hemat Kombo: "${anchor.name} + ${companion.name}"`,
        targetProductName: `${anchor.name} + ${companion.name}`,
        riskLevel: 'LOW_RISK',
        riskLabel: 'Risiko Pelanggan: Sangat Rendah (Pelanggan Senang Hemat)',
        currentHpp: combinedHpp,
        currentSellPrice: anchor.sellPrice + companion.sellPrice,
        suggestedAction: `Buat menu paket baru seharga Rp ${bundlePrice.toLocaleString('id-ID')} (Hemat Rp ${(anchor.sellPrice + companion.sellPrice - bundlePrice).toLocaleString('id-ID')}). Pajang di kasir sebagai rekomendasi utama.`,
        psychologicalReason: `Menu "${companion.name}" jarang laku padahal marginnya sangat tebal (${100 - companion.foodCostPercent}%). Menyatukannya dengan menu favorit "${anchor.name}" mendongkrak omset kasir dan average ticket size.`,
        estimatedMonthlyGain: monthlyGain
      });
    }

    // Strategy 3: Add-on & Upselling Monetization
    if (stars.length > 0) {
      const star = stars[0];
      cards.push({
        id: 'strat_addon_1',
        tacticType: 'ADDON_MONETIZATION',
        title: `Monetisasi Add-On & Topping pada ${star.name}`,
        targetProductName: star.name,
        riskLevel: 'ZERO_RISK',
        riskLabel: 'Risiko Pelanggan: 0% (Harga Dasar Tidak Berubah)',
        currentHpp: star.hpp,
        currentSellPrice: star.sellPrice,
        suggestedAction: `Kunci harga dasar ${star.name} tetap Rp ${star.sellPrice.toLocaleString('id-ID')}. Tambahkan opsi modifier di POS kasir: Upgrade Susu Oatmilk (+Rp 6.000), Extra Shot (+Rp 5.000), atau Topping Khusus (+Rp 4.000).`,
        psychologicalReason: 'Pelanggan hanya menghafal harga menu dasar. Mereka rela membayar Rp 4.000 - Rp 6.000 ekstra untuk personalisasi minuman/makanan tanpa merasa kemahalan.',
        estimatedMonthlyGain: Math.round(star.soldQty30d * 0.25 * 3500)
      });
    }

    // Strategy 4: Decoy Menu (Menu Umpan)
    if (plowhorses.length > 1 || stars.length > 0) {
      const popularItem = stars[0] || plowhorses[0];
      const signaturePrice = Math.round(popularItem.sellPrice * 1.35 / 1000) * 1000;

      cards.push({
        id: 'strat_decoy_1',
        tacticType: 'DECOY_MENU',
        title: `Penerapan Decoy Menu: Ukuran Jumbo / Signature Blend`,
        targetProductName: popularItem.name,
        riskLevel: 'LOW_RISK',
        riskLabel: 'Risiko Pelanggan: Rendah (Menaikkan Nilai Persepsi)',
        currentHpp: popularItem.hpp,
        currentSellPrice: popularItem.sellPrice,
        suggestedAction: `Luncurkan varian "${popularItem.name} Double Shot / 1 Liter" seharga Rp ${signaturePrice.toLocaleString('id-ID')}.`,
        psychologicalReason: `Kehadiran menu Rp ${signaturePrice.toLocaleString('id-ID')} membuat harga menu reguler (Rp ${popularItem.sellPrice.toLocaleString('id-ID')}) terlihat jauh lebih murah dan ramah kantong.`,
        estimatedMonthlyGain: Math.round(popularItem.soldQty30d * 0.15 * (signaturePrice - popularItem.sellPrice))
      });
    }

    return cards;
  }
}

export const aiMenuOptimizerService = AiMenuOptimizerService.getInstance();
