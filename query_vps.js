const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };
const cmd = `cd /var/www/poscafe/backend && cat << 'EOF' > query.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  console.log('---USERS---');
  console.log(await prisma.user.findMany({ select: { id: true, username: true } }));
  console.log('---TABLES---');
  console.log(await prisma.table.findMany({ select: { id: true, tableNo: true } }));
  console.log('---CUSTOMERS---');
  console.log(await prisma.customer.findMany({ select: { id: true, name: true } }));
}
run().catch(console.error).finally(() => prisma.$disconnect());
EOF
node query.js
`;
const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
