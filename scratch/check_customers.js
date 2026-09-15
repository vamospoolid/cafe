const { Client } = require('c:/ADATA/pooos/node_modules/ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const cmd = `node -e '
const { PrismaClient } = require("/var/www/poscafe/backend/node_modules/@prisma/client");
const prisma = new PrismaClient();
prisma.customer.findMany({ include: { debts: true } }).then(c => {
  console.log("CUSTOMERS_COUNT:", c.length);
  c.forEach(x => console.log(x.id, x.name, x.tier, x.points, x.totalSpent));
}).finally(() => prisma.$disconnect());
'`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
