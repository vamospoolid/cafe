const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `cd /var/www/poscafe/backend && cat << 'EOF' > add_diana.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const existing = await prisma.customer.findUnique({
    where: { phone: '08123456789' }
  });
  if (existing) {
    console.log('Customer Diana already exists');
    return;
  }
  const customer = await prisma.customer.create({
    data: {
      name: 'Diana',
      phone: '08123456789',
      points: 150,
      tier: 'Silver',
      totalSpent: 1500000
    }
  });
  console.log('Successfully created customer:', customer);
}

run().catch(console.error).finally(() => prisma.$disconnect());
EOF
node add_diana.js
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected. Inserting mock customer Diana...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => conn.end());
    });
}).connect(config);
