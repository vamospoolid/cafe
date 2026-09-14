const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const storeLatitude = -3.4026521;
  const storeLongitude = 119.2137757;
  const gpsRadiusMeters = 300;

  const existing = await prisma.settings.findFirst();
  if (existing) {
    const updated = await prisma.settings.update({
      where: { id: existing.id },
      data: {
        storeLatitude,
        storeLongitude,
        gpsRadiusMeters,
        enableGpsValidation: true
      }
    });
    console.log('✅ Settings updated successfully:', updated);
  } else {
    const created = await prisma.settings.create({
      data: {
        storeLatitude,
        storeLongitude,
        gpsRadiusMeters,
        enableGpsValidation: true
      }
    });
    console.log('✅ Settings created successfully:', created);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
