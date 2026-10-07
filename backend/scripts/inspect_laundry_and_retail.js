const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [laundry, retail] = await Promise.all([
    prisma.tenant.findUnique({
      where: { slug: 'laundry1' },
      include: {
        settings: true,
        outlets: true,
        categories: true,
        products: true,
        tables: true,
        ingredients: true,
        suppliers: true,
        customers: true,
        laundryOrders: { include: { items: true } }
      }
    }),
    prisma.tenant.findUnique({
      where: { slug: 'sabarjaya' },
      include: {
        settings: true,
        outlets: true,
        categories: true,
        products: true,
        suppliers: true,
        customers: true,
        orders: true
      }
    })
  ]);

  console.log('=== LAUNDRY TENANT ===');
  if (laundry) {
    console.log({
      id: laundry.id,
      name: laundry.name,
      businessType: laundry.businessType,
      categories: laundry.categories.map(c => c.name),
      products: laundry.products.map(p => ({ id: p.id, name: p.name, price: p.sellPrice, img: p.imageUrl })),
      tables: laundry.tables.map(t => t.tableNo),
      ingredients: laundry.ingredients.map(i => ({ name: i.name, stock: i.stock, unit: i.unit })),
      suppliers: laundry.suppliers.map(s => s.name),
      customers: laundry.customers.map(c => c.name),
      laundryOrders: laundry.laundryOrders.length
    });
  } else {
    console.log('Laundry not found!');
  }

  console.log('\n=== RETAIL TENANT ===');
  if (retail) {
    console.log({
      id: retail.id,
      name: retail.name,
      businessType: retail.businessType,
      categories: retail.categories.map(c => c.name),
      productsCount: retail.products.length,
      firstProducts: retail.products.slice(0, 3).map(p => ({ name: p.name, sellPrice: p.sellPrice, img: p.imageUrl })),
      suppliers: retail.suppliers.map(s => s.name),
      customers: retail.customers.map(c => c.name)
    });
  } else {
    console.log('Retail not found!');
  }
}

main().finally(() => prisma.$disconnect());
