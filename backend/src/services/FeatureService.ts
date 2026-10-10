import prisma from '../db';
import { cacheService } from './CacheService';
import { StandaloneConfig } from '../utils/standaloneConfig';

export class FeatureService {
  private static instance: FeatureService;

  // L1 In-memory micro-cache (TTL 60 detik)
  private cache = new Map<string, { features: Set<string>; expiry: number }>();

  public static getInstance(): FeatureService {
    if (!FeatureService.instance) {
      FeatureService.instance = new FeatureService();
    }
    return FeatureService.instance;
  }

  public clearCache(tenantId?: string) {
    if (tenantId) {
      this.cache.delete(tenantId);
      cacheService.del(`cache:features:${tenantId}`).catch(() => {});
    } else {
      this.cache.clear();
      cacheService.clearAll().catch(() => {});
    }
  }

  /**
   * Mengambil semua feature key yang aktif untuk tenant tertentu
   */
  public async getTenantFeatures(tenantId: string): Promise<string[]> {
    if (StandaloneConfig.isStandalone()) {
      // 100% Unlocked untuk mode Standalone Beli-Putus
      return [
        'pos.cashier', 'pos.kds', 'pos.tables', 'pos.reservations',
        'inventory.basic', 'inventory.advanced', 'warehouse.management',
        'bengkel.workorders', 'bengkel.mechanics', 'bengkel.pricing',
        'retail.barcode', 'retail.uom', 'retail.delivery',
        'laundry.scale', 'laundry.perfume', 'rental.booking',
        'crm.loyalty', 'crm.whatsapp', 'reports.financial', 'reports.export',
        'employees.attendance', 'employees.payroll'
      ];
    }

    if (!tenantId) return [];

    const now = Date.now();
    // L1: In-memory micro-cache check
    const memCached = this.cache.get(tenantId);
    if (memCached && memCached.expiry > now) {
      return Array.from(memCached.features);
    }

    // L2: Distributed Redis Cache check
    const redisCached = await cacheService.get<string[]>(`cache:features:${tenantId}`);
    if (redisCached && Array.isArray(redisCached)) {
      this.cache.set(tenantId, {
        features: new Set(redisCached),
        expiry: now + 60 * 1000
      });
      return redisCached;
    }

    // 1. Ambil data tenant beserta plan dan overrides
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true
              }
            }
          }
        },
        featureOverrides: {
          include: {
            feature: true
          }
        }
      }
    });

    if (!tenant) {
      // Fallback: ambil semua fitur bertipe isCore
      const coreFeatures = await prisma.feature.findMany({
        where: { isCore: true, status: 'ACTIVE' },
        select: { key: true }
      });
      return coreFeatures.map((f: { key: string }) => f.key);
    }

    const enabledKeys = new Set<string>();

    // 2. Tambahkan semua fitur isCore yang aktif
    const coreFeatures = await prisma.feature.findMany({
      where: { isCore: true, status: 'ACTIVE' },
      select: { key: true }
    });
    coreFeatures.forEach((f: { key: string }) => enabledKeys.add(f.key));

    // 3. Tambahkan fitur dari Plan tenant jika status tenant aktif
    if (tenant.plan && (tenant.status === 'ACTIVE' || tenant.status === 'TRIAL')) {
      for (const pf of tenant.plan.features) {
        if (pf.feature && pf.feature.status === 'ACTIVE') {
          enabledKeys.add(pf.feature.key);
        }
      }
    }

    // 4. Terapkan Tenant Overrides (Add-on Grants / Revokes)
    if (tenant.featureOverrides && tenant.featureOverrides.length > 0) {
      const currentDate = new Date();
      for (const override of tenant.featureOverrides) {
        if (override.expiresAt && override.expiresAt < currentDate) {
          // Add-on sudah kedaluwarsa, abaikan
          continue;
        }

        if (override.isEnabled) {
          enabledKeys.add(override.feature.key);
        } else {
          // Explicitly revoked
          enabledKeys.delete(override.feature.key);
        }
      }
    }

    // Simpan ke L1 cache (60 detik) dan L2 Redis (15 menit)
    const featureArray = Array.from(enabledKeys);
    this.cache.set(tenantId, {
      features: enabledKeys,
      expiry: now + 60 * 1000
    });
    cacheService.set(`cache:features:${tenantId}`, featureArray, 900).catch(() => {});

    return featureArray;
  }

  /**
   * Mengecek apakah fitur tertentu aktif untuk tenant
   */
  public async isEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    if (StandaloneConfig.isStandalone()) return true;
    if (!tenantId || !featureKey) return false;

    const enabledFeatures = await this.getTenantFeatures(tenantId);
    return enabledFeatures.includes(featureKey);
  }

  /**
   * Mendapatkan detail plan dan kuota tenant
   */
  public async getTenantPlanAndLimits(tenantId: string) {
    if (StandaloneConfig.isStandalone()) {
      return {
        tenantId: StandaloneConfig.getTenantId(),
        tenantName: `CodePOS Standalone (${StandaloneConfig.getVertical()})`,
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: null,
        subscriptionStatus: 'LIFETIME_ONE_TIME',
        plan: {
          code: 'STANDALONE_PRO',
          name: 'Lisensi Permanen Beli-Putus',
          maxOutlets: 999,
          maxUsers: 999,
          maxProducts: 999999
        },
        usage: {
          outlets: 1,
          users: 1,
          products: 0
        },
        limits: {
          maxOutlets: 999,
          maxUsers: 999,
          maxProducts: 999999
        }
      };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: {
          orderBy: { currentPeriodEnd: 'desc' },
          take: 1
        },
        _count: {
          select: {
            outlets: true,
            memberships: true,
            products: true
          }
        }
      }
    });

    if (!tenant) return null;

    const latestSub = tenant.subscriptions[0];

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      currentPeriodEnd: latestSub?.currentPeriodEnd || null,
      subscriptionStatus: latestSub?.status || null,
      plan: tenant.plan || {
        code: 'STARTER',
        name: 'Paket Starter Default',
        maxOutlets: 1,
        maxUsers: 2,
        maxProducts: 50
      },
      usage: {
        outlets: tenant._count.outlets,
        users: tenant._count.memberships,
        products: tenant._count.products
      },
      limits: {
        maxOutlets: tenant.plan?.maxOutlets ?? 1,
        maxUsers: tenant.plan?.maxUsers ?? 2,
        maxProducts: tenant.plan?.maxProducts ?? 50
      }
    };
  }

  /**
   * Mengambil semua daftar fitur di sistem
   */
  public async getAllFeatures() {
    return prisma.feature.findMany({
      orderBy: [
        { module: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Mengambil semua daftar SaaS plan yang tersedia
   */
  public async getAllPlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      include: {
        features: {
          include: {
            feature: true
          }
        }
      },
      orderBy: { priceMonthly: 'asc' }
    });
  }

  /**
   * Memberikan akses Add-on fitur khusus ke tenant (Override Grant)
   */
  public async grantTenantFeature(tenantId: string, featureKey: string, expiresAt?: Date) {
    const feature = await prisma.feature.findUnique({ where: { key: featureKey } });
    if (!feature) throw new Error(`Feature with key '${featureKey}' not found.`);

    await prisma.tenantFeature.upsert({
      where: {
        tenantId_featureId: {
          tenantId,
          featureId: feature.id
        }
      },
      update: {
        isEnabled: true,
        expiresAt: expiresAt || null
      },
      create: {
        tenantId,
        featureId: feature.id,
        isEnabled: true,
        expiresAt: expiresAt || null
      }
    });

    this.clearCache(tenantId);
  }

  /**
   * Mencabut akses fitur khusus dari tenant (Override Revoke)
   */
  public async revokeTenantFeature(tenantId: string, featureKey: string) {
    const feature = await prisma.feature.findUnique({ where: { key: featureKey } });
    if (!feature) throw new Error(`Feature with key '${featureKey}' not found.`);

    await prisma.tenantFeature.upsert({
      where: {
        tenantId_featureId: {
          tenantId,
          featureId: feature.id
        }
      },
      update: {
        isEnabled: false
      },
      create: {
        tenantId,
        featureId: feature.id,
        isEnabled: false
      }
    });

    this.clearCache(tenantId);
  }
}

export const featureService = FeatureService.getInstance();
