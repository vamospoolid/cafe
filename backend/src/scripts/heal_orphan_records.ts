import prisma from '../db';

async function main() {
  console.log('=== HEALING ORPHAN BUSINESS RECORDS ===\n');

  const tenantArg = process.argv.find(arg => arg.startsWith('--tenantId='));
  const targetTenantId = tenantArg ? tenantArg.split('=')[1] : process.env.TARGET_TENANT_ID;

  if (!targetTenantId) {
    console.error('❌ GAGAL: Script ini memerlukan parameter --tenantId=<target-tenant-id> demi keamanan isolasi multi-tenant.');
    process.exit(1);
  }

  const outletArg = process.argv.find(arg => arg.startsWith('--outletId='));
  const targetOutletId = outletArg ? outletArg.split('=')[1] : null;

  // 1. Products
  const prodResult = await prisma.product.updateMany({
    where: { tenantId: null },
    data: { tenantId: targetTenantId }
  });
  console.log(`Updated ${prodResult.count} orphan product(s) to tenant ${targetTenantId}`);

  // 2. Orders & OrderItems
  const orderResult = await prisma.order.updateMany({
    where: { tenantId: null },
    data: { tenantId: targetTenantId, ...(targetOutletId ? { outletId: targetOutletId } : {}) }
  });
  console.log(`Updated ${orderResult.count} orphan order(s) to tenant ${targetTenantId}`);

  const orderItemResult = await prisma.orderItem.updateMany({
    where: { tenantId: null },
    data: { tenantId: targetTenantId, ...(targetOutletId ? { outletId: targetOutletId } : {}) }
  });
  console.log(`Updated ${orderItemItemResult(orderItemResult)} orphan orderItem(s)`);

  // 3. Shifts
  const shiftResult = await prisma.shift.updateMany({
    where: { tenantId: null },
    data: { tenantId: targetTenantId, ...(targetOutletId ? { outletId: targetOutletId } : {}) }
  });
  console.log(`Updated ${shiftResult.count} orphan shift(s) to tenant ${targetTenantId}`);

  // 4. CashFlows
  const cashResult = await prisma.cashFlow.updateMany({
    where: { tenantId: null },
    data: { tenantId: targetTenantId, ...(targetOutletId ? { outletId: targetOutletId } : {}) }
  });
  console.log(`Updated ${cashResult.count} orphan cashFlow(s) to tenant ${targetTenantId}`);

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
