const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Memperbarui Pengaturan Toko MUKI RAMEN di Database...');
  
  const updateData = {
    storeName: 'MUKI RAMEN',
    address: 'Jl. Kesadaran No. 3, Sidorejo, Kec. Wonomulyo, Kabupaten Polewali Mandar, Sulawesi Barat 91352',
    phone: '081298765432',
    logoUrl: '/logo-muki-ramen.png',
    receiptHeader: 'MUKI RAMEN - Japanese Ramen Bar\nJl. Kesadaran No. 3, Wonomulyo, Polman',
    receiptFooter: 'Arigatou Gozaimasu!\nTerima Kasih Atas Kunjungan Anda',
    storeLatitude: -3.4026521,
    storeLongitude: 119.2137757,
    gpsRadiusMeters: 200,
  };

  const existing = await prisma.settings.findFirst();
  if (existing) {
    const updated = await prisma.settings.update({
      where: { id: existing.id },
      data: updateData
    });
    console.log('✅ Berhasil memperbarui settings (ID: ' + updated.id + '):', updated.storeName, updated.address);
  } else {
    const created = await prisma.settings.create({
      data: updateData
    });
    console.log('✅ Berhasil membuat settings baru (ID: ' + created.id + '):', created.storeName, created.address);
  }
}

main()
  .catch(e => {
    console.error('❌ Error updating settings:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
