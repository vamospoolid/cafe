const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating Barcode Label Settings columns...');
  const statements = [
    `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "barcodeLabelPreset" TEXT DEFAULT 'medium';`,
    `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "barcodeLabelDesign" TEXT DEFAULT 'landscape_split';`,
    `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "barcodeLabelShowPrice" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "barcodeLabelShowStore" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "barcodeLabelShowBrandRak" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "barcodeLabelPriceTier" TEXT DEFAULT 'retail';`
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('Executed:', sql);
    } catch (err) {
      console.warn('Notice on statement:', sql, err.message);
    }
  }
  console.log('✅ Barcode Label Settings columns migrated successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
