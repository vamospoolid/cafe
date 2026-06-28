import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data for clean slate...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.cashFlow.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.table.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding new data...');

  // 1. Setup Default Settings
  const setting = await prisma.settings.create({
    data: {
      storeName: 'SOL CAFE',
      phone: '081234567890',
      address: 'Jl. Senopati No. 45, Jakarta Selatan',
      taxRate: 11, // PPN 11%
      serviceCharge: 5, // Service Charge 5%
      receiptHeader: 'SOL CAFE - Good Vibe, Great Taste',
      receiptFooter: 'Terima kasih atas kunjungan Anda!\nFollow us on Instagram: @sol.cafe',
    },
  });
  console.log('Created Setting:', setting.storeName);

  // 2. Setup Superadmin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      username: 'admin',
      passwordHash: passwordHash,
      role: 'Admin',
      permissions: JSON.stringify({
        canVoid: true,
        canDiscount: true,
        canEditMenu: true,
        canViewReports: true,
      }),
      status: 'Aktif',
    },
  });
  console.log('Created Admin User:', admin.username);

  // Setup Kasir User
  const kasirPassword = await bcrypt.hash('kasir123', 10);
  const kasir = await prisma.user.create({
    data: {
      name: 'Dimas (Kasir)',
      username: 'kasir',
      passwordHash: kasirPassword,
      role: 'Kasir',
      permissions: JSON.stringify({
        canVoid: false,
        canDiscount: false,
        canEditMenu: false,
        canViewReports: false,
      }),
      status: 'Aktif',
    },
  });
  console.log('Created Kasir User:', kasir.username);

  // 3. Setup Categories
  const catSalties = await prisma.category.create({ data: { name: 'Salties' } });
  const catSweeties = await prisma.category.create({ data: { name: 'Sweeties' } });
  const catBevvies = await prisma.category.create({ data: { name: 'Bevvies' } });
  console.log('Created Categories:', catSalties.name, catSweeties.name, catBevvies.name);

  // 4. Setup Products
  // Category: Salties
  await prisma.product.create({
    data: {
      name: 'Tuna Melt Sando',
      categoryId: catSalties.id,
      buyPrice: 35000,
      sellPrice: 60000,
      stock: 50,
      barcode: 'SALT-001',
      imageUrl: '/images/tuna_melt_sando.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Tamago Sando',
      categoryId: catSalties.id,
      buyPrice: 25000,
      sellPrice: 50000,
      stock: 50,
      barcode: 'SALT-002',
      imageUrl: '/images/tamago_sando.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Mushroom Quiche',
      categoryId: catSalties.id,
      buyPrice: 12000,
      sellPrice: 25000,
      stock: 50,
      barcode: 'SALT-003',
      imageUrl: '/images/mushroom_quiche.png',
    }
  });

  // Category: Sweeties
  await prisma.product.create({
    data: {
      name: 'Choco Sabayon Tart',
      categoryId: catSweeties.id,
      buyPrice: 15000,
      sellPrice: 30000,
      stock: 40,
      barcode: 'SWEET-001',
      imageUrl: '/images/croissant.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Apple Crumble Tart',
      categoryId: catSweeties.id,
      buyPrice: 15000,
      sellPrice: 30000,
      stock: 40,
      barcode: 'SWEET-002',
      imageUrl: '/images/apple_crumble_tart.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Vanilla Craque',
      categoryId: catSweeties.id,
      buyPrice: 12000,
      sellPrice: 25000,
      stock: 40,
      barcode: 'SWEET-003',
      imageUrl: '/images/croissant.png',
    }
  });

  // Category: Bevvies
  await prisma.product.create({
    data: {
      name: "SOL's Signature",
      categoryId: catBevvies.id,
      buyPrice: 18000,
      sellPrice: 40000,
      stock: 100,
      barcode: 'BEV-001',
      imageUrl: '/images/sol_signature.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Aerocano',
      categoryId: catBevvies.id,
      buyPrice: 10000,
      sellPrice: 32000,
      stock: 100,
      barcode: 'BEV-002',
      imageUrl: '/images/es_kopi_susu.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Latte',
      categoryId: catBevvies.id,
      buyPrice: 12000,
      sellPrice: 35000,
      stock: 100,
      barcode: 'BEV-003',
      imageUrl: '/images/es_kopi_susu.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Mocha',
      categoryId: catBevvies.id,
      buyPrice: 15000,
      sellPrice: 40000,
      stock: 100,
      barcode: 'BEV-004',
      imageUrl: '/images/es_kopi_susu.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Cappuccino',
      categoryId: catBevvies.id,
      buyPrice: 15000,
      sellPrice: 40000,
      stock: 100,
      barcode: 'BEV-005',
      imageUrl: '/images/es_kopi_susu.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Matcha Latte',
      categoryId: catBevvies.id,
      buyPrice: 20000,
      sellPrice: 45000,
      stock: 100,
      barcode: 'BEV-006',
      imageUrl: '/images/matcha_latte.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Matcha Tonic',
      categoryId: catBevvies.id,
      buyPrice: 20000,
      sellPrice: 45000,
      stock: 100,
      barcode: 'BEV-007',
      imageUrl: '/images/matcha_latte.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Matcha Cloud',
      categoryId: catBevvies.id,
      buyPrice: 20000,
      sellPrice: 45000,
      stock: 100,
      barcode: 'BEV-008',
      imageUrl: '/images/matcha_cloud.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'Chocolate (Iced/Hot)',
      categoryId: catBevvies.id,
      buyPrice: 15000,
      sellPrice: 35000,
      stock: 100,
      barcode: 'BEV-009',
      imageUrl: '/images/es_kopi_susu.png',
    }
  });

  await prisma.product.create({
    data: {
      name: 'V60 Filter',
      categoryId: catBevvies.id,
      buyPrice: 15000,
      sellPrice: 40000,
      stock: 100,
      barcode: 'BEV-010',
      imageUrl: '/images/es_kopi_susu.png',
    }
  });

  console.log('Created Products');

  // 5. Setup Tables
  await prisma.table.createMany({
    data: [
      { tableNo: 'A1', capacity: 2 },
      { tableNo: 'A2', capacity: 4 },
      { tableNo: 'B1', capacity: 4 },
      { tableNo: 'B2', capacity: 4 },
      { tableNo: 'VIP-1', capacity: 6 },
      { tableNo: 'VIP-2', capacity: 8 },
    ]
  });
  console.log('Created Tables');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
