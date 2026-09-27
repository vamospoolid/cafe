const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      isPlatformAdmin: true,
      phone: true,
      email: true
    }
  });
  console.log('=== USERS IN DATABASE ===');
  console.table(users);
}

showUsers().catch(console.error).finally(() => prisma.$disconnect());
