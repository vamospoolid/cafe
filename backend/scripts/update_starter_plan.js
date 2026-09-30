const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('🚀 Updating STARTER Plan in Database...');

  // 1. Ensure inventory.advanced feature exists
  let advFeature = await prisma.feature.findUnique({
    where: { key: 'inventory.advanced' }
  });

  if (!advFeature) {
    advFeature = await prisma.feature.create({
      data: {
        key: 'inventory.advanced',
        name: 'Resep (BOM) & Inventaris Bahan Baku',
        module: 'OPERATIONS',
        description: 'Bill of Materials resep otomatis potong stok bahan mentah saat menu terjual',
        isCore: false,
        status: 'ACTIVE'
      }
    });
    console.log('✅ Created feature inventory.advanced');
  }

  // 2. Update STARTER plan attributes
  const starterPlan = await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {
      name: 'Paket Starter (UMKM)',
      description: 'Cocok untuk kedai / kafe pemula: 1 Cabang, 2 User/Staf, Kasir POS, Bahan Baku & Resep, Manajemen Meja, Reservasi, dan Layar Dapur (KDS).',
      maxOutlets: 1,
      maxUsers: 2,
      maxProducts: 50
    },
    create: {
      code: 'STARTER',
      name: 'Paket Starter (UMKM)',
      description: 'Cocok untuk kedai / kafe pemula: 1 Cabang, 2 User/Staf, Kasir POS, Bahan Baku & Resep, Manajemen Meja, Reservasi, dan Layar Dapur (KDS).',
      priceMonthly: 79000,
      priceYearly: 790000,
      maxOutlets: 1,
      maxUsers: 2,
      maxProducts: 50,
      isActive: true
    }
  });

  console.log(`✅ Plan STARTER updated: maxOutlets=${starterPlan.maxOutlets}, maxUsers=${starterPlan.maxUsers}, maxProducts=${starterPlan.maxProducts}`);

  // 3. Attach inventory.advanced to STARTER plan
  await prisma.planFeature.upsert({
    where: {
      planId_featureId: {
        planId: starterPlan.id,
        featureId: advFeature.id
      }
    },
    update: {},
    create: {
      planId: starterPlan.id,
      featureId: advFeature.id
    }
  });

  console.log('✅ Attached inventory.advanced to Plan STARTER');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
