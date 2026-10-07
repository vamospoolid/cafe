const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      businessType: true,
      _count: {
        select: {
          products: true,
          orders: true,
          tables: true,
          ingredients: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('TOTAL TENANTS:', tenants.length);
  tenants.forEach((t, i) => {
    console.log(`${i + 1}. [${t.businessType}] ${t.name} (slug: ${t.slug}, id: ${t.id}) | Products: ${t._count.products}, Orders: ${t._count.orders}, Tables: ${t._count.tables}, Ingredients: ${t._count.ingredients}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
