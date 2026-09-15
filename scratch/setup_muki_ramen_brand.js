const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

async function main() {
  const src = 'C:/Users/Balanipastudio/.gemini/antigravity-ide/brain/efe86e8e-17ba-45a7-8783-e7c1ab824761/.user_uploaded/media_1789514724019.jpg';
  
  if (!fs.existsSync(src)) {
    console.error('Source file not found:', src);
    process.exit(1);
  }

  const targets = [
    path.join(__dirname, '../frontend/public/logo-muki-ramen.png'),
    path.join(__dirname, '../frontend/public/logo-muki-ramen.jpg'),
    path.join(__dirname, '../frontend/public/logo-sol-cafe.png'),
    path.join(__dirname, '../frontend/public/favicon.png'),
    path.join(__dirname, '../desktop/assets/icon.png')
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
    console.log('✅ Copied to:', target);
  }

  // Update Settings in Prisma
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.settings.findFirst();
    const updateData = {
      storeName: 'MUKI RAMEN',
      address: 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Kabupaten Polewali Mandar, Sulawesi Barat 91352',
      phone: '081298765432',
      logoUrl: '/logo-muki-ramen.png',
      receiptHeader: 'MUKI RAMEN\nJl. Kesadaran No. 3, Wonomulyo, Polman',
      receiptFooter: 'Arigatou Gozaimasu!\nTerima Kasih Atas Kunjungan Anda',
      storeLatitude: -3.4026521,
      storeLongitude: 119.2137757,
      gpsRadiusMeters: 200,
    };

    if (existing) {
      const updated = await prisma.settings.update({
        where: { id: existing.id },
        data: updateData
      });
      console.log('✅ Updated Settings in DB:', updated);
    } else {
      const created = await prisma.settings.create({
        data: updateData
      });
      console.log('✅ Created Settings in DB:', created);
    }
  } catch (err) {
    console.error('⚠️ DB Update note (server might be remote or offline):', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
