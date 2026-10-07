const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      businessType: true,
      logoUrl: true,
      settings: {
        select: {
          id: true,
          storeName: true,
          logoUrl: true
        }
      }
    },
    orderBy: { businessType: 'asc' }
  });

  console.log(JSON.stringify(tenants, null, 2));
}

main().finally(() => prisma.$disconnect());
