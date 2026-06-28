const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get or create category
  let category = await prisma.category.findFirst({ where: { name: 'Minuman' } });
  if (!category) category = await prisma.category.create({ data: { name: 'Minuman', color: 'blue' } });

  let catMakanan = await prisma.category.findFirst({ where: { name: 'Makanan' } });
  if (!catMakanan) catMakanan = await prisma.category.create({ data: { name: 'Makanan', color: 'green' } });

  const products = [
    {
      name: 'Es Kopi Susu Aren',
      buyPrice: 10000,
      sellPrice: 18000,
      stock: 100,
      minStock: 10,
      categoryId: category.id,
      status: 'Aktif',
      imageUrl: '/images/es_kopi_susu.png'
    },
    {
      name: 'Nasi Goreng Spesial',
      buyPrice: 15000,
      sellPrice: 28000,
      stock: 50,
      minStock: 5,
      categoryId: catMakanan.id,
      status: 'Aktif',
      imageUrl: '/images/nasi_goreng.png'
    },
    {
      name: 'Matcha Latte',
      buyPrice: 12000,
      sellPrice: 24000,
      stock: 50,
      minStock: 5,
      categoryId: category.id,
      status: 'Aktif',
      imageUrl: '/images/matcha_latte.png'
    },
    {
      name: 'Butter Croissant',
      buyPrice: 8000,
      sellPrice: 20000,
      stock: 30,
      minStock: 5,
      categoryId: catMakanan.id,
      status: 'Aktif',
      imageUrl: '/images/croissant.png'
    }
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.product.create({ data: p });
    }
  }
  console.log('Database seeded with new product images.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
