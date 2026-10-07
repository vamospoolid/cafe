const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tenant.findFirst({ where: { slug: 'nikeardilla' } });
  if (!t) return console.log('not found');
  console.log('Testing direct prisma.tenant.delete on:', t.slug, t.id);
  try {
    const res = await prisma.tenant.delete({ where: { id: t.id } });
    console.log('DIRECT DELETE SUCCESSFUL!');
  } catch (err) {
    console.error('DIRECT DELETE ERROR:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
