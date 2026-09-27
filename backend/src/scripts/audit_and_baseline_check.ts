import prisma from '../db';

async function main() {
  console.log('=== AUDIT & BASELINE VERIFICATION ===\n');

  // 1. Check _prisma_migrations table
  try {
    const migrations: any[] = await prisma.$queryRaw`
      SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count 
      FROM "_prisma_migrations" 
      ORDER BY started_at ASC;
    `;
    console.log(`Found ${migrations.length} recorded migration(s) in _prisma_migrations:`);
    migrations.forEach(m => {
      console.log(` - ${m.migration_name} (Applied: ${m.finished_at ? 'YES' : 'NO'}, Steps: ${m.applied_steps_count})`);
    });
  } catch (err: any) {
    console.log('Notice: _prisma_migrations table check error or table does not exist:', err.message);
  }

  // 2. MIG-02: Check Orphan Records (tenantId IS NULL)
  console.log('\n--- Auditing Orphan Business Entities (tenantId IS NULL) ---');

  const orphanProducts = await prisma.product.count({ where: { tenantId: null } });
  console.log(`Orphan Products (tenantId null): ${orphanProducts}`);

  const orphanOrders = await prisma.order.count({ where: { tenantId: null } });
  console.log(`Orphan Orders (tenantId null): ${orphanOrders}`);

  const orphanCategories = await prisma.category.count({ where: { tenantId: null } });
  console.log(`Orphan Categories (tenantId null): ${orphanCategories}`);

  const orphanCustomers = await prisma.customer.count({ where: { tenantId: null } });
  console.log(`Orphan Customers (tenantId null): ${orphanCustomers}`);

  const orphanTables = await prisma.table.count({ where: { tenantId: null } });
  console.log(`Orphan Tables (tenantId null): ${orphanTables}`);

  const orphanShifts = await prisma.shift.count({ where: { tenantId: null } });
  console.log(`Orphan Shifts (tenantId null): ${orphanShifts}`);

  const orphanCashFlows = await prisma.cashFlow.count({ where: { tenantId: null } });
  console.log(`Orphan CashFlows (tenantId null): ${orphanCashFlows}`);

  // List existing tenants
  console.log('\n--- Active Tenants in Database ---');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, businessType: true, status: true }
  });
  console.log(`Found ${tenants.length} tenant(s):`);
  tenants.forEach(t => console.log(` - [${t.businessType}] ${t.name} (slug: ${t.slug}, id: ${t.id}, status: ${t.status})`));

  console.log('\n=== AUDIT VERIFICATION COMPLETE ===');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
