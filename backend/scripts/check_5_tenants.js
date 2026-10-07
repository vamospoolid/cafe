const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      users: { select: { id: true, username: true, role: true } },
      _count: { select: { products: true, orders: true, tables: true, ingredients: true } }
    },
    orderBy: { businessType: 'asc' }
  });

  console.log('=== 5 TENANT RESMI CODEPOS SAAS LOKAL ===');
  tenants.forEach(t => {
    console.log(`\n📌 [${t.businessType}] ${t.name} (slug: ${t.slug})`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Katalog: ${t._count.products} Produk | ${t._count.tables} Meja | ${t._count.ingredients} Bahan Baku`);
    console.log(`   Pengguna: ${t.users.map(u => `${u.username} (${u.role})`).join(', ') || 'Belum ada user'}`);
  });
}

main().finally(() => prisma.$disconnect());
