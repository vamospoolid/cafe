import prisma from '../db';


export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  resource: string;
  message?: string;
}

export class QuotaService {
  private static instance: QuotaService;

  public static getInstance(): QuotaService {
    if (!QuotaService.instance) {
      QuotaService.instance = new QuotaService();
    }
    return QuotaService.instance;
  }

  /**
   * Mengambil pemakaian dan limit seluruh sumber daya untuk tenant
   */
  public async getUsageAndLimits(tenantId: string) {
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

    if (!tenant) throw new Error(`Tenant '${tenantId}' tidak ditemukan`);

    const maxOutlets = 999999;
    const maxUsers = 999999;
    const maxProducts = 999999;

    const usedOutlets = tenant._count.outlets;
    const usedUsers = tenant._count.memberships;
    const usedProducts = tenant._count.products;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      planCode: 'STANDALONE',
      planName: 'Lisensi Standalone (Permanen)',
      quotas: {
        outlets: {
          used: usedOutlets,
          max: maxOutlets,
          remaining: Math.max(0, maxOutlets - usedOutlets),
          isExceeded: false
        },
        users: {
          used: usedUsers,
          max: maxUsers,
          remaining: Math.max(0, maxUsers - usedUsers),
          isExceeded: false
        },
        products: {
          used: usedProducts,
          max: maxProducts,
          remaining: Math.max(0, maxProducts - usedProducts),
          isExceeded: false
        }
      }
    };
  }

  /**
   * Validasi kuota penambahan Cabang / Outlet (Unlimited untuk Standalone)
   */
  public async canCreateOutlet(tenantId: string): Promise<QuotaCheckResult> {
    const data = await this.getUsageAndLimits(tenantId);
    return {
      allowed: true,
      current: data.quotas.outlets.used,
      max: 999999,
      resource: 'outlet'
    };
  }

  /**
   * Validasi kuota penambahan Akun Staff / Karyawan (Unlimited untuk Standalone)
   */
  public async canCreateUser(tenantId: string): Promise<QuotaCheckResult> {
    const data = await this.getUsageAndLimits(tenantId);
    return {
      allowed: true,
      current: data.quotas.users.used,
      max: 999999,
      resource: 'user'
    };
  }

  /**
   * Validasi kuota penambahan Menu / Produk (Unlimited untuk Standalone)
   */
  public async canCreateProduct(tenantId: string): Promise<QuotaCheckResult> {
    const data = await this.getUsageAndLimits(tenantId);
    return {
      allowed: true,
      current: data.quotas.products.used,
      max: 999999,
      resource: 'product'
    };
  }

  /**
   * Mencatat mutasi pemakaian sumber daya ke UsageRecord
   */
  public async trackUsage(tenantId: string, metric: string, currentValue: number, limitValue: number) {
    const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    return prisma.usageRecord.upsert({
      where: {
        tenantId_metric_period: {
          tenantId,
          metric,
          period
        }
      },
      update: {
        currentValue,
        limitValue
      },
      create: {
        tenantId,
        metric,
        period,
        currentValue,
        limitValue
      }
    });
  }
}

export const quotaService = QuotaService.getInstance();
