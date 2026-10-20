const { Client } = require('ssh2');

const scriptOnRemote = `
const { PrismaClient } = require('@prisma/client');
const { ImageCacheService } = require('./dist/src/services/ImageCacheService');
const { cacheService } = require('./dist/src/services/CacheService');
const p = new PrismaClient();

async function run() {
  try {
    const names = ['Tofu Krispi', 'Gyoza Saus Mentai', 'Dimsum Original', 'Dimsum Spicy Cheese'];
    await p.product.updateMany({
      where: { tenantId: 'tenant-vamos-pool', name: { in: names } },
      data: { imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=500&auto=format&fit=crop' }
    });
    console.log('Updated 4 snack products with valid dimsum photo.');
    await cacheService.invalidateTenant('tenant-vamos-pool');
    await cacheService.bumpTenantCatalogVersion('tenant-vamos-pool');
    const res = await ImageCacheService.cacheProductImages('tenant-vamos-pool');
    console.log('Cache result:', JSON.stringify(res));
    await p.$disconnect();
  } catch (err) {
    console.error('Error during cache run:', err);
  }
}
run().then(() => process.exit(0));
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to VPS. Caching remaining 4 images...');
  conn.exec(`cat << 'EOF' > /var/www/poscafe/backend/trigger_cache.js
${scriptOnRemote}
EOF
cd /var/www/poscafe/backend && node trigger_cache.js
rm -f /var/www/poscafe/backend/trigger_cache.js
`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log('\nFinished with code:', code);
      conn.end();
    });
  });
}).connect({ host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' });
