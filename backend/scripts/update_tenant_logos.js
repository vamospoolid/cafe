const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LOGO_MAPPING = {
  kopinusa: {
    logoUrl: '/logo-kopinusa.png',
    storeName: 'KOPINUSA CAFE'
  },
  jakartamotor: {
    logoUrl: '/logo-jakartamotor.png',
    storeName: 'Jakarta Motor Workshop'
  },
  sabarjaya: {
    logoUrl: '/logo-sabarjaya.png',
    storeName: 'Sabar Jaya Grosir & Sembako'
  },
  laundry1: {
    logoUrl: '/logo-laundry.png',
    storeName: 'FreshClean Laundry & Care'
  },
  sewabajubodo: {
    logoUrl: '/logo-rental.png',
    storeName: 'Sanggar Busana Adat Bugis'
  }
};

async function main() {
  console.log('=== MEMPERBARUI LOGO 5 UNIT USAHA CODEPOS SAAS ===\n');

  for (const [slug, conf] of Object.entries(LOGO_MAPPING)) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      console.warn(`⚠️ Tenant dengan slug "${slug}" tidak ditemukan.`);
      continue;
    }

    // Update Tenant
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logoUrl: conf.logoUrl }
    });

    // Update or Create Settings
    const settings = await prisma.settings.findFirst({ where: { tenantId: tenant.id } });
    if (settings) {
      await prisma.settings.update({
        where: { id: settings.id },
        data: {
          logoUrl: conf.logoUrl,
          storeName: conf.storeName
        }
      });
    } else {
      await prisma.settings.create({
        data: {
          tenantId: tenant.id,
          storeName: conf.storeName,
          logoUrl: conf.logoUrl
        }
      });
    }

    console.log(`✅ [${tenant.businessType}] ${conf.storeName} (${slug}) -> Logo: ${conf.logoUrl}`);
  }

  console.log('\n🎉 Seluruh 5 unit usaha berhasil diperbarui dengan logo resmi!');
}

main()
  .catch(err => {
    console.error('❌ Error updating logos:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
