import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing old data for clean slate...');
  await prisma.recipeItem.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.ingredientLog.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.debtPayment.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.pointLog.deleteMany();
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

  console.log('🌱 Seeding fresh production data...');

  // 1. Setup Default Settings
  const defaultShifts = JSON.stringify([
    { id: '1', name: 'Shift Pagi', start: '08:00', end: '16:00', lateTolerance: 15 },
    { id: '2', name: 'Shift Siang / Sore', start: '15:00', end: '23:00', lateTolerance: 15 },
    { id: '3', name: 'Full Day', start: '09:00', end: '21:00', lateTolerance: 15 }
  ]);

  const setting = await prisma.settings.create({
    data: {
      storeName: 'SOL CAFE & EATERY',
      phone: '0812-3456-7890',
      address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
      taxRate: 11, // PPN 11%
      serviceCharge: 5, // Service Charge 5%
      includeTax: false,
      receiptHeader: 'SOL CAFE & EATERY\nGood Vibe, Great Taste\nIG: @solcafe.id',
      receiptFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar.\nWiFi: SolCafe_Guest / solcafe2026',
      bankName: 'BCA',
      accountNumber: '8830-1928-11',
      accountName: 'SOL CAFE INDONESIA',
      enableDrinkCustomization: true,
      loyaltyEnabled: true,
      loyaltyEarnPerAmount: 10000,
      loyaltyPointValue: 100,
      loyaltySilverThreshold: 1000000,
      loyaltyGoldThreshold: 3000000,
      loyaltySilverMultiplier: 1.2,
      loyaltyGoldMultiplier: 1.5,
      ingredientTrackingEnabled: true,
      enableKDS: true,
      autoCompleteKDSOnPay: false,
      storeLatitude: -6.229728,
      storeLongitude: 106.807464,
      gpsRadiusMeters: 150,
      enableGpsValidation: true,
      enableCameraPhoto: true,
      workShifts: defaultShifts,
      enableZeroLateBonus: true,
      zeroLateBonusAmount: 250000,
      zeroLateMinAttendance: 20,
      zeroLateMaxLateAllowed: 0,
      enableLatePenalty: true,
      latePenaltyType: 'FLAT',
      latePenaltyAmount: 15000,
      enableAlphaPenalty: true,
      alphaPenaltyAmount: 75000,
    },
  });
  console.log('✅ Created Settings:', setting.storeName);

  // 2. Setup Users / Staff
  const defaultPassword = await bcrypt.hash('123456', 10);
  const kasirPassword = await bcrypt.hash('kasir123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      username: 'admin',
      passwordHash: defaultPassword,
      pin: '123456',
      role: 'Admin',
      permissions: JSON.stringify({
        canVoid: true,
        canDiscount: true,
        canEditMenu: true,
        canViewReports: true,
        canManageStaff: true,
        canManageInventory: true,
      }),
      status: 'Aktif',
    },
  });

  const kasir = await prisma.user.create({
    data: {
      name: 'Dimas Aditya (Kasir)',
      username: 'kasir',
      passwordHash: kasirPassword,
      pin: '112233',
      role: 'Kasir',
      permissions: JSON.stringify({
        canVoid: false,
        canDiscount: true,
        canEditMenu: false,
        canViewReports: false,
      }),
      status: 'Aktif',
    },
  });

  const waiter = await prisma.user.create({
    data: {
      name: 'Budi Santoso (Waiter)',
      username: 'waiter',
      passwordHash: defaultPassword,
      pin: '223344',
      role: 'Waiter',
      permissions: JSON.stringify({
        canVoid: false,
        canDiscount: false,
        canEditMenu: false,
        canViewReports: false,
      }),
      status: 'Aktif',
    },
  });

  const barista = await prisma.user.create({
    data: {
      name: 'Rian Pratama (Barista & Dapur)',
      username: 'dapur',
      passwordHash: defaultPassword,
      pin: '334455',
      role: 'Dapur',
      permissions: JSON.stringify({
        canVoid: false,
        canDiscount: false,
        canEditMenu: false,
        canViewReports: false,
      }),
      status: 'Aktif',
    },
  });
  console.log('✅ Created Users:', admin.username, kasir.username, waiter.username, barista.username);

  // 3. Setup Categories & Sub-Categories
  // Category 1: Salties (Food / Kitchen)
  const catSalties = await prisma.category.create({
    data: { name: 'Salties (Food)', printerTarget: 'KITCHEN' },
  });
  const subSando = await prisma.category.create({
    data: { name: 'Sando & Sandwich', parentId: catSalties.id, printerTarget: 'KITCHEN' },
  });
  const subPastrySavory = await prisma.category.create({
    data: { name: 'Savory Pastry', parentId: catSalties.id, printerTarget: 'KITCHEN' },
  });
  const subMains = await prisma.category.create({
    data: { name: 'Main Course', parentId: catSalties.id, printerTarget: 'KITCHEN' },
  });

  // Category 2: Sweeties (Dessert / Showcase)
  const catSweeties = await prisma.category.create({
    data: { name: 'Sweeties (Dessert)', printerTarget: 'BAR' },
  });
  const subTart = await prisma.category.create({
    data: { name: 'Tarts & Pies', parentId: catSweeties.id, printerTarget: 'BAR' },
  });
  const subCroissant = await prisma.category.create({
    data: { name: 'Pastries & Croissant', parentId: catSweeties.id, printerTarget: 'BAR' },
  });

  // Category 3: Bevvies (Drinks / Bar)
  const catBevvies = await prisma.category.create({
    data: { name: 'Bevvies (Drinks)', printerTarget: 'BAR' },
  });
  const subCoffee = await prisma.category.create({
    data: { name: 'Espresso Based', parentId: catBevvies.id, printerTarget: 'BAR' },
  });
  const subManualBrew = await prisma.category.create({
    data: { name: 'Manual Brew', parentId: catBevvies.id, printerTarget: 'BAR' },
  });
  const subNonCoffee = await prisma.category.create({
    data: { name: 'Non-Coffee & Matcha', parentId: catBevvies.id, printerTarget: 'BAR' },
  });
  console.log('✅ Created Categories & Hierarchy');

  // 4. Setup Suppliers
  const supCoffee = await prisma.supplier.create({
    data: {
      name: 'PT Sumber Kopi Nusantara',
      contact: 'Pak Hendra (Roastery)',
      phone: '0813-8899-0011',
      address: 'Bandung, Jawa Barat',
      notes: 'Suplier biji kopi arabika & robusta fresh roast',
    },
  });

  const supFresh = await prisma.supplier.create({
    data: {
      name: 'Fresh Farm & Dairy Jakarta',
      contact: 'Ibu Ratna',
      phone: '0812-9988-7766',
      address: 'Pasar Minggu, Jakarta Selatan',
      notes: 'Suplier daging, sayuran segar, telur & fresh milk',
    },
  });

  const supPackaging = await prisma.supplier.create({
    data: {
      name: 'EcoPack Mandiri',
      contact: 'Sales Office',
      phone: '0811-2233-4455',
      address: 'Cengkareng, Jakarta Barat',
      notes: 'Suplier cup sablon, tutup, straw & takeaway box',
    },
  });
  console.log('✅ Created Suppliers');

  // 5. Setup Ingredients (Bahan Baku)
  // DRINK
  const ingCoffeeBeans = await prisma.ingredient.create({
    data: {
      name: 'Biji Kopi House Blend (Arabica/Robusta)',
      category: 'DRINK',
      subCategory: 'Biji Kopi (Beans)',
      unit: 'gram',
      stock: 10000, // 10 kg
      minStock: 2000,
      buyPrice: 180, // Rp 180 / gram (Rp 180.000 / kg)
      supplierId: supCoffee.id,
    },
  });

  const ingFreshMilk = await prisma.ingredient.create({
    data: {
      name: 'Fresh Milk Pasteurisasi',
      category: 'DRINK',
      subCategory: 'Susu & Dairy',
      unit: 'ml',
      stock: 20000, // 20 Liter
      minStock: 5000,
      buyPrice: 20, // Rp 20 / ml (Rp 20.000 / Liter)
      supplierId: supFresh.id,
    },
  });

  const ingMatchaPowder = await prisma.ingredient.create({
    data: {
      name: 'Matcha Uji Ceremonial Grade',
      category: 'DRINK',
      subCategory: 'Teh & Powder',
      unit: 'gram',
      stock: 1000, // 1 kg
      minStock: 200,
      buyPrice: 650, // Rp 650 / gram
      supplierId: supCoffee.id,
    },
  });

  const ingSugarSyrup = await prisma.ingredient.create({
    data: {
      name: 'Simple Sugar Syrup',
      category: 'DRINK',
      subCategory: 'Sirup & Puree',
      unit: 'ml',
      stock: 5000,
      minStock: 1000,
      buyPrice: 15,
      supplierId: supCoffee.id,
    },
  });

  // FOOD
  const ingTuna = await prisma.ingredient.create({
    data: {
      name: 'Tuna Fillet Canned / Fresh',
      category: 'FOOD',
      subCategory: 'Daging & Seafood',
      unit: 'gram',
      stock: 4000, // 4 kg
      minStock: 1000,
      buyPrice: 120, // Rp 120 / gram
      supplierId: supFresh.id,
    },
  });

  const ingToastBread = await prisma.ingredient.create({
    data: {
      name: 'Brioche / Sourdough Slice',
      category: 'FOOD',
      subCategory: 'Tepung & Mie',
      unit: 'lembar',
      stock: 100,
      minStock: 20,
      buyPrice: 3500, // Rp 3.500 / slice
      supplierId: supFresh.id,
    },
  });

  const ingCheese = await prisma.ingredient.create({
    data: {
      name: 'Mozzarella & Cheddar Shredded',
      category: 'FOOD',
      subCategory: 'Dairy & Telur',
      unit: 'gram',
      stock: 3000,
      minStock: 500,
      buyPrice: 150, // Rp 150 / gram
      supplierId: supFresh.id,
    },
  });

  const ingEggs = await prisma.ingredient.create({
    data: {
      name: 'Telur Ayam Omega',
      category: 'FOOD',
      subCategory: 'Dairy & Telur',
      unit: 'butir',
      stock: 120,
      minStock: 30,
      buyPrice: 2500,
      supplierId: supFresh.id,
    },
  });

  // PACKAGING
  const ingCupHot = await prisma.ingredient.create({
    data: {
      name: 'Paper Cup 8oz Hot + Lid',
      category: 'PACKAGING',
      subCategory: 'Cup & Tutup',
      unit: 'pcs',
      stock: 500,
      minStock: 100,
      buyPrice: 1200,
      supplierId: supPackaging.id,
    },
  });

  const ingCupIced = await prisma.ingredient.create({
    data: {
      name: 'Plastic Cup 16oz Sol Cafe + Seal',
      category: 'PACKAGING',
      subCategory: 'Cup & Tutup',
      unit: 'pcs',
      stock: 1000,
      minStock: 200,
      buyPrice: 950,
      supplierId: supPackaging.id,
    },
  });

  const ingPaperBox = await prisma.ingredient.create({
    data: {
      name: 'Takeaway Food Box Kraft Sol Cafe',
      category: 'PACKAGING',
      subCategory: 'Paper Box',
      unit: 'pcs',
      stock: 400,
      minStock: 80,
      buyPrice: 2200,
      supplierId: supPackaging.id,
    },
  });
  console.log('✅ Created Ingredients (Raw Materials)');

  // 6. Setup Products (Menu)
  // --- Salties Products ---
  const prodTunaMelt = await prisma.product.create({
    data: {
      name: 'Tuna Melt Sando',
      categoryId: catSalties.id,
      subCategoryId: subSando.id,
      buyPrice: 22000,
      sellPrice: 60000,
      stock: 50,
      minStock: 5,
      barcode: 'SALT-001',
      imageUrl: '/images/tuna_melt_sando.png',
    },
  });

  const prodTamago = await prisma.product.create({
    data: {
      name: 'Tamago Sando',
      categoryId: catSalties.id,
      subCategoryId: subSando.id,
      buyPrice: 15000,
      sellPrice: 50000,
      stock: 45,
      minStock: 5,
      barcode: 'SALT-002',
      imageUrl: '/images/tamago_sando.png',
    },
  });

  const prodQuiche = await prisma.product.create({
    data: {
      name: 'Mushroom Quiche',
      categoryId: catSalties.id,
      subCategoryId: subPastrySavory.id,
      buyPrice: 12000,
      sellPrice: 35000,
      stock: 30,
      minStock: 5,
      barcode: 'SALT-003',
      imageUrl: '/images/mushroom_quiche.png',
    },
  });

  const prodPasta = await prisma.product.create({
    data: {
      name: 'Creamy Truffle Pasta',
      categoryId: catSalties.id,
      subCategoryId: subMains.id,
      buyPrice: 28000,
      sellPrice: 75000,
      stock: 30,
      minStock: 5,
      barcode: 'SALT-004',
      imageUrl: '/images/tuna_melt_sando.png',
    },
  });

  // --- Sweeties Products ---
  const prodChocoTart = await prisma.product.create({
    data: {
      name: 'Choco Sabayon Tart',
      categoryId: catSweeties.id,
      subCategoryId: subTart.id,
      buyPrice: 15000,
      sellPrice: 38000,
      stock: 25,
      minStock: 5,
      barcode: 'SWEET-001',
      imageUrl: '/images/croissant.png',
    },
  });

  const prodAppleTart = await prisma.product.create({
    data: {
      name: 'Apple Crumble Tart',
      categoryId: catSweeties.id,
      subCategoryId: subTart.id,
      buyPrice: 15000,
      sellPrice: 38000,
      stock: 25,
      minStock: 5,
      barcode: 'SWEET-002',
      imageUrl: '/images/apple_crumble_tart.png',
    },
  });

  const prodCroissant = await prisma.product.create({
    data: {
      name: 'Butter Croissant French Style',
      categoryId: catSweeties.id,
      subCategoryId: subCroissant.id,
      buyPrice: 10000,
      sellPrice: 28000,
      stock: 35,
      minStock: 5,
      barcode: 'SWEET-003',
      imageUrl: '/images/croissant.png',
    },
  });

  // --- Bevvies Products ---
  const prodSolSignature = await prisma.product.create({
    data: {
      name: "SOL's Signature Iced Coffee",
      categoryId: catBevvies.id,
      subCategoryId: subCoffee.id,
      buyPrice: 12000,
      sellPrice: 42000,
      stock: 100,
      minStock: 10,
      barcode: 'BEV-001',
      imageUrl: '/images/sol_signature.png',
    },
  });

  const prodLatte = await prisma.product.create({
    data: {
      name: 'Caffe Latte (Hot/Iced)',
      categoryId: catBevvies.id,
      subCategoryId: subCoffee.id,
      buyPrice: 10000,
      sellPrice: 38000,
      stock: 100,
      minStock: 10,
      barcode: 'BEV-002',
      imageUrl: '/images/es_kopi_susu.png',
    },
  });

  const prodCappuccino = await prisma.product.create({
    data: {
      name: 'Cappuccino',
      categoryId: catBevvies.id,
      subCategoryId: subCoffee.id,
      buyPrice: 10000,
      sellPrice: 38000,
      stock: 100,
      minStock: 10,
      barcode: 'BEV-003',
      imageUrl: '/images/es_kopi_susu.png',
    },
  });

  const prodAerocano = await prisma.product.create({
    data: {
      name: 'Aerocano Foam Black',
      categoryId: catBevvies.id,
      subCategoryId: subCoffee.id,
      buyPrice: 6000,
      sellPrice: 34000,
      stock: 100,
      minStock: 10,
      barcode: 'BEV-004',
      imageUrl: '/images/es_kopi_susu.png',
    },
  });

  const prodMatchaLatte = await prisma.product.create({
    data: {
      name: 'Kyoto Matcha Latte',
      categoryId: catBevvies.id,
      subCategoryId: subNonCoffee.id,
      buyPrice: 16000,
      sellPrice: 48000,
      stock: 60,
      minStock: 10,
      barcode: 'BEV-005',
      imageUrl: '/images/matcha_latte.png',
    },
  });

  const prodMatchaCloud = await prisma.product.create({
    data: {
      name: 'Matcha Cloud Cream',
      categoryId: catBevvies.id,
      subCategoryId: subNonCoffee.id,
      buyPrice: 18000,
      sellPrice: 52000,
      stock: 50,
      minStock: 10,
      barcode: 'BEV-006',
      imageUrl: '/images/matcha_cloud.png',
    },
  });

  const prodV60 = await prisma.product.create({
    data: {
      name: 'V60 Single Origin Filter',
      categoryId: catBevvies.id,
      subCategoryId: subManualBrew.id,
      buyPrice: 12000,
      sellPrice: 45000,
      stock: 50,
      minStock: 10,
      barcode: 'BEV-007',
      imageUrl: '/images/es_kopi_susu.png',
    },
  });
  console.log('✅ Created Menu Products');

  // 7. Setup Recipes (Hubungan Produk -> Bahan Baku)
  // Caffe Latte = 18g Biji Kopi + 180ml Susu + 1 Cup Iced
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodLatte.id, ingredientId: ingCoffeeBeans.id, qtyPerServing: 18 },
      { productId: prodLatte.id, ingredientId: ingFreshMilk.id, qtyPerServing: 180 },
      { productId: prodLatte.id, ingredientId: ingCupIced.id, qtyPerServing: 1 },
    ],
  });

  // Kyoto Matcha Latte = 15g Matcha Powder + 180ml Susu + 20ml Sugar Syrup + 1 Cup Iced
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodMatchaLatte.id, ingredientId: ingMatchaPowder.id, qtyPerServing: 15 },
      { productId: prodMatchaLatte.id, ingredientId: ingFreshMilk.id, qtyPerServing: 180 },
      { productId: prodMatchaLatte.id, ingredientId: ingSugarSyrup.id, qtyPerServing: 20 },
      { productId: prodMatchaLatte.id, ingredientId: ingCupIced.id, qtyPerServing: 1 },
    ],
  });

  // Tuna Melt Sando = 2 slice Roti + 80g Tuna + 40g Keju + 1 Paper Box
  await prisma.recipeItem.createMany({
    data: [
      { productId: prodTunaMelt.id, ingredientId: ingToastBread.id, qtyPerServing: 2 },
      { productId: prodTunaMelt.id, ingredientId: ingTuna.id, qtyPerServing: 80 },
      { productId: prodTunaMelt.id, ingredientId: ingCheese.id, qtyPerServing: 40 },
      { productId: prodTunaMelt.id, ingredientId: ingPaperBox.id, qtyPerServing: 1 },
    ],
  });
  console.log('✅ Created Product Recipes');

  // 8. Setup Tables with 2D Visual Map Coordinates
  await prisma.table.createMany({
    data: [
      { tableNo: 'A1', name: 'Indoor Depan Jendela', capacity: 2, posX: 15, posY: 20, shape: 'square' },
      { tableNo: 'A2', name: 'Indoor Depan Jendela', capacity: 2, posX: 35, posY: 20, shape: 'square' },
      { tableNo: 'A3', name: 'Indoor Sofa Tengah', capacity: 4, posX: 55, posY: 20, shape: 'square' },
      { tableNo: 'A4', name: 'Indoor Sofa Tengah', capacity: 4, posX: 75, posY: 20, shape: 'square' },

      { tableNo: 'B1', name: 'Outdoor Smoking Area', capacity: 4, posX: 15, posY: 60, shape: 'circle' },
      { tableNo: 'B2', name: 'Outdoor Smoking Area', capacity: 4, posX: 35, posY: 60, shape: 'circle' },
      { tableNo: 'B3', name: 'Outdoor Garden Table', capacity: 6, posX: 55, posY: 60, shape: 'circle' },

      { tableNo: 'VIP-1', name: 'VIP Room Magnolia', capacity: 8, posX: 78, posY: 55, shape: 'square' },
      { tableNo: 'VIP-2', name: 'VIP Room Private Mezzanine', capacity: 10, posX: 78, posY: 78, shape: 'square' },
    ],
  });
  console.log('✅ Created Tables with Layout Positions');

  // 9. Setup Sample Customers / Member Loyalty
  const cust1 = await prisma.customer.create({
    data: {
      name: 'Alif Pratama',
      phone: '081299112233',
      email: 'alif@example.com',
      points: 1500,
      tier: 'Gold',
      totalSpent: 3500000,
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      name: 'Nadia Salsabila',
      phone: '081388445566',
      email: 'nadia@example.com',
      points: 420,
      tier: 'Silver',
      totalSpent: 1250000,
    },
  });

  const cust3 = await prisma.customer.create({
    data: {
      name: 'Reza Rahardian',
      phone: '085711223344',
      email: 'reza@example.com',
      points: 50,
      tier: 'Bronze',
      totalSpent: 280000,
    },
  });
  console.log('✅ Created Sample Customers:', cust1.name, cust2.name, cust3.name);

  console.log('✨ All seed data created successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

