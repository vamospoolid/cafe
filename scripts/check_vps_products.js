const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /var/www/poscafe/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const count = await p.product.count({ where: { tenantId: 'tenant-vamos-pool', deletedAt: null } });
  const prods = await p.product.findMany({
    where: { tenantId: 'tenant-vamos-pool', deletedAt: null },
    select: { id: true, name: true, sellPrice: true, buyPrice: true, imageUrl: true },
    take: 5
  });
  console.log('TOTAL_PRODUCTS:' + count);
  console.log('SAMPLE_PRODUCTS:' + JSON.stringify(prods));
  await p.\\$disconnect();
}
run();
"`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' });
