const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };

const cmd = `
cd /var/www/poscafe
git reset --hard HEAD
git pull origin main

echo "=== BUILDING FRONTEND ==="
cd /var/www/poscafe/frontend
npm run build

echo "=== DEPLOY COMPLETE ==="
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('🔗 Connected to VPS. Deploying frontend fix...\n');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log(`\n✅ VPS Frontend deploy finished (code: ${code})`);
      conn.end();
    });
  });
}).on('error', err => console.error('❌ SSH error:', err.message)).connect(config);
