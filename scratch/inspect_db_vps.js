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
  async function check() {
    const orders = await prisma.order.findMany({ take: 5, orderBy: { id: 'desc' }, include: { items: true } });
    const logs = await prisma.ingredientLog.findMany({ take: 10, orderBy: { id: 'desc' } });
    const recipes = await prisma.recipeItem.findMany({ take: 10 });
    const products = await prisma.product.findMany({ take: 5, select: { id: true, name: true, stock: true } });
    const settings = await prisma.settings.findFirst();
    console.log('=== LATEST ORDERS ===', JSON.stringify(orders, null, 2));
    console.log('=== INGREDIENT LOGS ===', JSON.stringify(logs, null, 2));
    console.log('=== RECIPES COUNT ===', recipes.length);
    console.log('=== SETTINGS ingredientTrackingEnabled ===', settings?.ingredientTrackingEnabled);
  }
  check().then(() => prisma.\\$disconnect());
  "
  `;
  conn.exec(query, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(sshConfig);
