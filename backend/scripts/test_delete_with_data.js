const { PrismaClient } = require('@prisma/client');
const { deleteTenantSafely } = require('./safe_delete_tenant');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tenant.findFirst({ where: { slug: 'senjacafe356' } });
  if (!t) return console.log('not found');
  console.log('Testing delete on:', t.slug, t.id);
  try {
    await prisma.$transaction(async (tx) => {
      await deleteTenantSafely(tx, t.id);
    });
    console.log('SUCCESSFULLY DELETED TENANT WITH DATA:', t.slug);
  } catch (err) {
    console.error('ERROR DETAIL:', err);
  }
}

main().finally(() => prisma.$disconnect());
