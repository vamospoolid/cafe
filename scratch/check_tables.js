const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.table.findMany();
  console.log('TABLE RECORDS:', tables);
  
  const totalTables = await prisma.table.count();
  console.log('TOTAL TABLES COUNT:', totalTables);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
