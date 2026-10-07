import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'kopinusa' } });
  if (!tenant) {
    console.error('Tenant kopinusa tidak ditemukan');
    return;
  }

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    include: {
      category: true,
      recipes: {
        include: { ingredient: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`\n========================================================================================`);
  console.log(`📊 AUDIT HPP & BILL OF MATERIALS (BOM) — KOPINUSA CAFE [Total: ${products.length} Menu]`);
  console.log(`========================================================================================`);
  console.log(
    'No'.padEnd(4) +
    'Nama Menu'.padEnd(36) +
    'Kategori'.padEnd(16) +
    'HPP (BOM)'.padEnd(14) +
    'Harga Jual'.padEnd(14) +
    'Margin (%)'.padEnd(12) +
    'Jml Bahan'
  );
  console.log('─'.repeat(102));

  let totalMargin = 0;
  products.forEach((p, idx) => {
    const hpp = p.recipes.reduce((sum, r) => sum + (r.qtyPerServing * r.ingredient.buyPrice), 0);
    const margin = p.sellPrice > 0 ? ((p.sellPrice - hpp) / p.sellPrice * 100) : 0;
    totalMargin += margin;

    console.log(
      `${idx + 1}.`.padEnd(4) +
      p.name.padEnd(36) +
      (p.category?.name || '-').padEnd(16) +
      `Rp ${hpp.toLocaleString('id-ID')}`.padEnd(14) +
      `Rp ${p.sellPrice.toLocaleString('id-ID')}`.padEnd(14) +
      `${margin.toFixed(1)}%`.padEnd(12) +
      `${p.recipes.length} bahan`
    );

    // Rincian komposisi bahan
    p.recipes.forEach(r => {
      const subtotal = r.qtyPerServing * r.ingredient.buyPrice;
      console.log(
        `     └─ ${r.ingredient.name}: ${r.qtyPerServing} ${r.ingredient.unit} @ Rp ${r.ingredient.buyPrice.toLocaleString('id-ID')}/${r.ingredient.unit} = Rp ${subtotal.toLocaleString('id-ID')}`
      );
    });
  });

  console.log('─'.repeat(102));
  console.log(`📈 Rata-rata Gross Margin Seluruh Menu: ${(totalMargin / products.length).toFixed(1)}%`);
  console.log(`========================================================================================\n`);

  const ingredients = await prisma.ingredient.findMany({
    where: { tenantId: tenant.id },
    include: { supplier: true },
    orderBy: { category: 'asc' }
  });
  console.log(`🧂 TOTAL BAHAN BAKU: ${ingredients.length} items`);
  ingredients.forEach(i => {
    console.log(`   - [${i.category}] ${i.name.padEnd(45)}: Stok ${i.stock} ${i.unit} | Beli: Rp ${i.buyPrice.toLocaleString('id-ID')}/${i.unit} (${i.supplier?.name || '-'})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
