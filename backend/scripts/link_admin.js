const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!admin) {
    console.log('No admin user');
    return;
  }

  const tenants = await prisma.tenant.findMany({ where: { status: 'ACTIVE' } });
  console.log('Found tenants:', tenants.map(t => t.slug));

  const kopinusa = tenants.find(t => t.slug === 'kopinusa') || tenants[0];

  // Update admin user default tenantId to kopinusa
  await prisma.user.update({
    where: { id: admin.id },
    data: { tenantId: kopinusa.id }
  });

  // Create membership for all tenants
  for (const t of tenants) {
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: admin.id, tenantId: t.id } },
      create: { userId: admin.id, tenantId: t.id, status: 'ACTIVE' },
      update: { status: 'ACTIVE' }
    });
  }

  console.log('Admin user successfully linked to all tenants! Default tenant:', kopinusa.name);
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
