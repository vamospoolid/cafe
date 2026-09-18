import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FeatureService {
  private static instance: FeatureService;

  // Cache in-memory sederhana untuk performa tinggi (TTL 60 detik)
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
    } else {
      this.cache.clear();
    }
  }

  /**
   * Mengambil semua feature key yang aktif untuk tenant tertentu
   */
  public async getTenantFeatures(tenantId: string): Promise<string[]> {
    if (!tenantId) return [];

    const now = Date.now();
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiry > now) {
      return Array.from(cached.features);
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

    // Simpan ke cache selama 60 detik
    this.cache.set(tenantId, {
      features: enabledKeys,
      expiry: now + 60 * 1000
    });

    return Array.from(enabledKeys);
  }

  /**
   * Mengecek apakah fitur tertentu aktif untuk tenant
   */
  public async isEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    if (!tenantId || !featureKey) return false;

    const enabledFeatures = await this.getTenantFeatures(tenantId);
    return enabledFeatures.includes(featureKey);
  }

  /**
   * Mendapatkan detail plan dan kuota tenant
   */
  public async getTenantPlanAndLimits(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
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

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      status: tenant.status,
      plan: tenant.plan || {
        code: 'STARTER',
        name: 'Paket Starter Default',
        maxOutlets: 1,
        maxUsers: 3,
        maxProducts: 100
      },
      usage: {
        outlets: tenant._count.outlets,
        users: tenant._count.memberships,
        products: tenant._count.products
      },
      limits: {
        maxOutlets: tenant.plan?.maxOutlets ?? 1,
        maxUsers: tenant.plan?.maxUsers ?? 3,
        maxProducts: tenant.plan?.maxProducts ?? 100
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
