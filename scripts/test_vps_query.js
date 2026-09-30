const { Client } = require('ssh2');

const script = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = '2026-09-29T00:00:00.000Z';
  const endDate = '2026-09-29T23:59:59.999Z';
  
  const s = new Date(startDate);
  const e = new Date(endDate);
  
  console.log('Date range:', s.toISOString(), 'to', e.toISOString());
  
  const logs = await prisma.ingredientLog.findMany({
    where: {
      createdAt: { gte: s, lte: e },
      type: { in: ['Produksi', 'Rusak', 'Penyesuaian'] },
      change: { lt: 0 }
    },
    include: {
      ingredient: true
    }
  });
  console.log('Logs count:', logs.length);
  console.log('Logs:', JSON.stringify(logs, null, 2));

  // Also check movements
  const movements = await prisma.ingredientLog.findMany({
    where: {
      createdAt: { gte: s, lte: e }
    },
    include: {
      ingredient: true
    }
  });
  console.log('Movements count:', movements.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/var/www/poscafe/backend/test_query.js');
    stream.on('close', () => {
      conn.exec('NODE_PATH=/var/www/poscafe/backend/node_modules node /var/www/poscafe/backend/test_query.js && rm -f /var/www/poscafe/backend/test_query.js', { cwd: '/var/www/poscafe/backend' }, (err2, execStream) => {
        if (err2) throw err2;
        execStream.on('data', d => process.stdout.write(d));
        execStream.stderr.on('data', d => process.stderr.write(d));
        execStream.on('close', () => conn.end());
      });
    });
    stream.end(script);
  });
}).connect({ host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' });
