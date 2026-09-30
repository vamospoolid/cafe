const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };

const cmd = `
cd /var/www/poscafe
git reset --hard HEAD
git pull origin main

echo "=== SYNCING PRISMA DATABASE SCHEMA ==="
cd /var/www/poscafe/backend
npx prisma db push --skip-generate || true
npx prisma generate || true

echo "=== BUILDING BACKEND ==="
cd /var/www/poscafe/backend
npm run build
pm2 restart all || pm2 restart poscafe-backend

echo "=== BUILDING FRONTEND ==="
cd /var/www/poscafe/frontend
npm run build

echo "=== ENSURING UPLOADS PERMISSIONS ==="
chmod -R 777 /var/www/poscafe/backend/uploads

echo "=== DEPLOY COMPLETE ==="
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('🔗 Connected to VPS. Deploying...\n');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log(`\n✅ VPS Deploy finished (code: ${code})`);
      conn.end();
    });
  });
}).on('error', err => console.error('❌ SSH error:', err.message)).connect(config);
