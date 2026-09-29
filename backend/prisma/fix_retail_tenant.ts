import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRetailTenants() {
  console.log('🔄 Memeriksa & menyelaraskan tenant Retail/Sembako...');

  // 1. Cari tenant tokomatahari atau sabarjaya
  const retailTenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { contains: 'matahari' } },
        { name: { contains: 'matahari', mode: 'insensitive' } },
        { slug: 'sabarjaya' },
        { name: { contains: 'sabar', mode: 'insensitive' } }
      ]
    },
    include: {
      settings: true,
      categories: true,
      products: true
    }
  });

  for (const t of retailTenants) {
    console.log(`-> Menyelaraskan tenant ${t.name} (${t.slug}) ke RETAIL...`);

    // Update Tenant
    await prisma.tenant.update({
      where: { id: t.id },
      data: { businessType: 'RETAIL' }
    });

    // Update Settings
    await prisma.settings.updateMany({
      where: { tenantId: t.id },
      data: {
        receiptHeader: `TOKO GROSIR & RETAIL\n${t.name}`,
        storeName: t.name
      }
    });

    // Periksa apakah sudah punya kategori sembako
    let sembakoCat = await prisma.category.findFirst({
      where: { tenantId: t.id, name: { contains: 'Sembako', mode: 'insensitive' } }
    });

    if (!sembakoCat) {
      sembakoCat = await prisma.category.create({
        data: { tenantId: t.id, name: 'Sembako & Beras', icon: '🌾', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
      });
      const bumbuCat = await prisma.category.create({
        data: { tenantId: t.id, name: 'Minyak & Bumbu Dapur', icon: '🍳', sortOrder: 2, printerTarget: 'NONE', stationTarget: 'NONE' }
      });
      const snackCat = await prisma.category.create({
        data: { tenantId: t.id, name: 'Minuman & Snack', icon: '☕', sortOrder: 3, printerTarget: 'NONE', stationTarget: 'NONE' }
      });

      // Buat produk sembako jika belum ada produk milik tenant ini
      const prodCount = await prisma.product.count({ where: { tenantId: t.id, deletedAt: null } });
      if (prodCount === 0) {
        await prisma.product.createMany({
          data: [
            { tenantId: t.id, categoryId: sembakoCat.id, name: 'Beras Premium 5 Kg', barcode: '899100100001', buyPrice: 65000, sellPrice: 74000, sellPriceRetail: 74000, sellPriceGrosir: 71000, minQtyGrosir: 5, stock: 50, status: 'Aktif' },
            { tenantId: t.id, categoryId: bumbuCat.id, name: 'Minyak Goreng 2 Liter', barcode: '899100100002', buyPrice: 32000, sellPrice: 36500, sellPriceRetail: 36500, sellPriceGrosir: 35000, minQtyGrosir: 6, stock: 40, status: 'Aktif' },
            { tenantId: t.id, categoryId: sembakoCat.id, name: 'Gula Pasir Kristal 1 Kg', barcode: '899100100003', buyPrice: 15500, sellPrice: 17500, sellPriceRetail: 17500, sellPriceGrosir: 16500, minQtyGrosir: 10, stock: 60, status: 'Aktif' },
            { tenantId: t.id, categoryId: sembakoCat.id, name: 'Telur Ayam Ras 1 Kg', barcode: '899100100004', buyPrice: 25000, sellPrice: 28500, sellPriceRetail: 28500, sellPriceGrosir: 27000, minQtyGrosir: 5, stock: 35, status: 'Aktif' },
            { tenantId: t.id, categoryId: snackCat.id, name: 'Kopi Kapal Api Renceng (10 sachet)', barcode: '899100100005', buyPrice: 12000, sellPrice: 14500, sellPriceRetail: 14500, sellPriceGrosir: 13500, minQtyGrosir: 10, stock: 80, status: 'Aktif' },
            { tenantId: t.id, categoryId: snackCat.id, name: 'Indomie Goreng (Dus/40pcs)', barcode: '899100100006', buyPrice: 108000, sellPrice: 118000, sellPriceRetail: 118000, sellPriceGrosir: 115000, minQtyGrosir: 3, stock: 25, status: 'Aktif' }
          ]
        });
      }
    }
    console.log(`✔ Tenant ${t.name} berhasil diselaraskan ke RETAIL.`);
  }

  // 2. Bengkel jakartamotor juga pastikan BENGKEL
  const bengkelTenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { contains: 'bengkel' } },
        { slug: 'jakartamotor' },
        { name: { contains: 'motor', mode: 'insensitive' } }
      ]
    }
  });

  for (const b of bengkelTenants) {
    await prisma.tenant.update({ where: { id: b.id }, data: { businessType: 'BENGKEL' } });
  }

  console.log('✔ Penyelarasan profil vertikal tenant selesai.');
}

fixRetailTenants().catch(console.error).finally(() => process.exit(0));
