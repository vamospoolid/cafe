const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: { contains: 'sembako', mode: 'insensitive' } },
        { name: { contains: 'sembako', mode: 'insensitive' } }
      ]
    }
  });
  console.log('TENANT:', JSON.stringify(tenant, null, 2));
  if (tenant) {
    const users = await prisma.user.findMany({
      where: { tenantMemberships: { some: { tenantId: tenant.id } } },
      select: { username: true, role: true, status: true }
    });
    console.log('USERS:', JSON.stringify(users, null, 2));
    const prodCount = await prisma.product.count({ where: { tenantId: tenant.id } });
    const prodCountActive = await prisma.product.count({ where: { tenantId: tenant.id, isDeleted: false } });
    console.log('TOTAL PRODUCTS:', prodCount, '| ACTIVE:', prodCountActive);
    const prods = await prisma.product.findMany({
      where: { tenantId: tenant.id },
      select: { name: true, isDeleted: true, status: true, createdAt: true }
    });
    console.log('PRODUCTS:', JSON.stringify(prods, null, 2));
  } else {
    const all = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true, businessType: true, status: true } });
    console.log('ALL TENANTS:', JSON.stringify(all, null, 2));
  }
  await prisma.$disconnect();
}
main().catch(console.error);
