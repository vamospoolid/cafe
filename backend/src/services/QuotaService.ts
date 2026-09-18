import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const maxOutlets = tenant.plan?.maxOutlets ?? 1;
    const maxUsers = tenant.plan?.maxUsers ?? 3;
    const maxProducts = tenant.plan?.maxProducts ?? 100;

    const usedOutlets = tenant._count.outlets;
    const usedUsers = tenant._count.memberships;
    const usedProducts = tenant._count.products;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      planCode: tenant.plan?.code || 'STARTER',
      planName: tenant.plan?.name || 'Paket Starter',
      quotas: {
        outlets: {
          used: usedOutlets,
          max: maxOutlets,
          remaining: Math.max(0, maxOutlets - usedOutlets),
          isExceeded: usedOutlets >= maxOutlets
        },
        users: {
          used: usedUsers,
          max: maxUsers,
          remaining: Math.max(0, maxUsers - usedUsers),
          isExceeded: usedUsers >= maxUsers
        },
        products: {
          used: usedProducts,
          max: maxProducts,
          remaining: Math.max(0, maxProducts - usedProducts),
          isExceeded: usedProducts >= maxProducts
        }
      }
    };
  }

  /**
   * Validasi kuota penambahan Cabang / Outlet
   */
  public async canCreateOutlet(tenantId: string): Promise<QuotaCheckResult> {
    const data = await this.getUsageAndLimits(tenantId);
    const { used, max, isExceeded } = data.quotas.outlets;
    return {
      allowed: !isExceeded,
      current: used,
      max,
      resource: 'outlet',
      message: isExceeded ? `Batas maksimal cabang (${max} outlet) telah tercapai.` : undefined
    };
  }

  /**
   * Validasi kuota penambahan Akun Staff / Karyawan
   */
  public async canCreateUser(tenantId: string): Promise<QuotaCheckResult> {
    const data = await this.getUsageAndLimits(tenantId);
    const { used, max, isExceeded } = data.quotas.users;
    return {
      allowed: !isExceeded,
      current: used,
      max,
      resource: 'user',
      message: isExceeded ? `Batas maksimal staff (${max} akun) telah tercapai.` : undefined
    };
  }

  /**
   * Validasi kuota penambahan Menu / Produk
   */
  public async canCreateProduct(tenantId: string): Promise<QuotaCheckResult> {
    const data = await this.getUsageAndLimits(tenantId);
    const { used, max, isExceeded } = data.quotas.products;
    return {
      allowed: !isExceeded,
      current: used,
      max,
      resource: 'product',
      message: isExceeded ? `Batas maksimal menu (${max} produk) telah tercapai.` : undefined
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
