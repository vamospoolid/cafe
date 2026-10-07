const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slugs = ['kopinusa', 'jakartamotor', 'laundry1', 'sewabajubodo', 'sabarjaya'];
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
    include: {
      users: { select: { id: true, username: true, role: true } },
      _count: { select: { products: true, orders: true, tables: true, ingredients: true } }
    }
  });

  console.log(JSON.stringify(tenants, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
