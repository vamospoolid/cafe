const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeSuperAdmin() {
  const result = await prisma.user.updateMany({
    where: {
      username: { in: ['admin', 'ahmad'] }
    },
    data: {
      isPlatformAdmin: true,
      role: 'OWNER'
    }
  });

  console.log(`✅ Berhasil mengaktifkan SuperAdmin Developer untuk ${result.count} akun:`);
  const superUsers = await prisma.user.findMany({
    where: { isPlatformAdmin: true },
    select: { id: true, username: true, role: true, isPlatformAdmin: true }
  });
  console.table(superUsers);
}

makeSuperAdmin()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
