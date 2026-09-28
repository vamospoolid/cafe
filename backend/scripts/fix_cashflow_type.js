const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const countIn = await prisma.cashFlow.updateMany({
    where: { type: 'IN' },
    data: { type: 'Pemasukan' }
  });
  console.log('Fixed IN to Pemasukan:', countIn.count);

  const countOut = await prisma.cashFlow.updateMany({
    where: { type: 'OUT' },
    data: { type: 'Pengeluaran' }
  });
  console.log('Fixed OUT to Pengeluaran:', countOut.count);

  await prisma.$disconnect();
}

main().catch(console.error);
