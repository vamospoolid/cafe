import prisma from '../db';

async function main() {
  console.log('=== HEALING ORPHAN BUSINESS RECORDS ===\n');

  const defaultTenantId = 'tenant-default-muki';
  const defaultOutletId = 'outlet-default-muki-01';

  // 1. Products
  const prodResult = await prisma.product.updateMany({
    where: { tenantId: null },
    data: { tenantId: defaultTenantId }
  });
  console.log(`Updated ${prodResult.count} orphan product(s) to tenant ${defaultTenantId}`);

  // 2. Orders & OrderItems
  const orderResult = await prisma.order.updateMany({
    where: { tenantId: null },
    data: { tenantId: defaultTenantId, outletId: defaultOutletId }
  });
  console.log(`Updated ${orderResult.count} orphan order(s) to tenant ${defaultTenantId}`);

  const orderItemResult = await prisma.orderItem.updateMany({
    where: { tenantId: null },
    data: { tenantId: defaultTenantId, outletId: defaultOutletId }
  });
  console.log(`Updated ${orderItemItemResult(orderItemResult)} orphan orderItem(s)`);

  // 3. Shifts
  const shiftResult = await prisma.shift.updateMany({
    where: { tenantId: null },
    data: { tenantId: defaultTenantId, outletId: defaultOutletId }
  });
  console.log(`Updated ${shiftResult.count} orphan shift(s) to tenant ${defaultTenantId}`);

  // 4. CashFlows
  const cashResult = await prisma.cashFlow.updateMany({
    where: { tenantId: null },
    data: { tenantId: defaultTenantId, outletId: defaultOutletId }
  });
  console.log(`Updated ${cashResult.count} orphan cashFlow(s) to tenant ${defaultTenantId}`);

  // Verification
  const remaining = {
    products: await prisma.product.count({ where: { tenantId: null } }),
    orders: await prisma.order.count({ where: { tenantId: null } }),
    categories: await prisma.category.count({ where: { tenantId: null } }),
    shifts: await prisma.shift.count({ where: { tenantId: null } }),
    cashFlows: await prisma.cashFlow.count({ where: { tenantId: null } })
  };
  console.log('\nRemaining orphans after healing:', remaining);
}

function orderItemItemResult(res: any) {
  return res.count;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
