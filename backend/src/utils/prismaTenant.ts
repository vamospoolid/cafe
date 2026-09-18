import { PrismaClient, Prisma } from '@prisma/client';
import { TenantContext } from './tenantContext';

const TENANT_SCOPED_MODELS = new Set([
  'category',
  'product',
  'table',
  'reservation',
  'customer',
  'pointLog',
  'order',
  'orderItem',
  'cashFlow',
  'attendance',
  'settings',
  'shift',
  'supplier',
  'ingredient',
  'recipeItem',
  'ingredientLog',
  'purchaseOrder',
  'purchaseOrderItem',
  'debt',
  'debtPayment',
  'leaveRequest',
  'shiftHandover',
  'kitchenChecklist',
  'warehouseInbound',
  'warehouseInboundItem',
  'warehouseRequisition',
  'warehouseRequisitionItem',
  'ownerFundTransaction',
  'warehouseSale',
  'warehouseSaleItem',
  'employeeLoan',
  'employeeLoanPayment',
  'tenantPaymentConfig',
  'auditLog',
  'usageRecord',
  'subscription',
  'invoice',
  'paymentTransaction',
  'tenantFeature'
]);

export function createTenantPrismaClient(basePrisma: PrismaClient = new PrismaClient()) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const modelKey = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';
          
          // Jika bukan model yang memiliki tenantId atau operasi platform admin bypass, jalankan query langsung
          if (!TENANT_SCOPED_MODELS.has(modelKey) || TenantContext.isPlatformAdmin()) {
            return query(args);
          }

          const currentTenantId = TenantContext.getTenantId();

          // 1. Injeksi tenantId pada query pembacaan (findUnique, findFirst, findMany, count, aggregate)
          if (
            operation === 'findMany' ||
            operation === 'findFirst' ||
            operation === 'count' ||
            operation === 'aggregate' ||
            operation === 'groupBy'
          ) {
            args.where = {
              ...(args.where || {}),
              tenantId: currentTenantId
            };
          }

          // 2. Injeksi tenantId pada query pembuatan data (create, createMany)
          if (operation === 'create' && args.data) {
            args.data = {
              ...args.data,
              tenantId: (args.data as any).tenantId || currentTenantId
            };
          }

          if (operation === 'createMany' && args.data) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({
                ...item,
                tenantId: item.tenantId || currentTenantId
              }));
            }
          }

          // 3. Injeksi tenantId pada operasi update & delete
          if (operation === 'updateMany' || operation === 'deleteMany') {
            args.where = {
              ...(args.where || {}),
              tenantId: currentTenantId
            };
          }

          return query(args);
        }
      }
    }
  });
}

/**
 * Executes an interactive transaction with PostgreSQL session-level Row Level Security (RLS) enforcement.
 * Sets `SET LOCAL app.current_tenant_id = '<tenantId>'` within the transaction lifecycle.
 */
export async function withTenantRLS<T>(
  tenantId: string | null | undefined,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  prismaClient: PrismaClient = new PrismaClient()
): Promise<T> {
  const effectiveTenantId = tenantId || TenantContext.getTenantId() || 'PLATFORM_SUPERADMIN';
  const cleanTenantId = effectiveTenantId.replace(/'/g, "''");

  return prismaClient.$transaction(async (tx) => {
    // Switch to application role to enforce RLS policies strictly
    try {
      await tx.$executeRawUnsafe(`SET ROLE codepos_app;`);
    } catch (_) {}
    
    // Set PostgreSQL transaction-scoped session variable for RLS policies
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${cleanTenantId}';`);
    return callback(tx);
  });
}

// Global scoped Prisma instance
export const tenantPrisma = createTenantPrismaClient();
