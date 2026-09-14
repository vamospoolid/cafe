const { Client } = require('ssh2');

const sshConfig = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const query = `
  cd /var/www/poscafe/backend
  node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  async function test() {
    const startDate = '2026-09-14T00:00:00.000Z';
    const endDate = '2026-09-14T23:59:59.999Z';
    const category = 'ALL';
    const type = 'ALL';

    const s = new Date(startDate);
    const e = new Date(endDate);
    const dateFilter = { gte: s, lte: e };

    const typeWhere = { in: ['Produksi', 'Rusak', 'Penyesuaian'] };

    try {
      const logs = await prisma.ingredientLog.findMany({
        where: {
          createdAt: dateFilter,
          type: typeWhere,
          change: { lt: 0 }
        },
        include: {
          ingredient: {
            include: { supplier: true }
          },
          user: {
            select: { id: true, name: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('LOGS FOUND:', logs.length);
    } catch (err) {
      console.error('ERROR ON PRISMA QUERY:', err);
    }
  }
  test().then(() => prisma.\\$disconnect());
  "
  `;
  conn.exec(query, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(sshConfig);
