const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const cmd = `
set -e
echo "=== [1/4] GIT PULL SAAS REPO ==="
cd /var/www/codenusa
git pull origin saas

echo "=== [2/4] BUILD FRONTEND DIST ==="
cd /var/www/codenusa/frontend
npm run build

echo "=== [3/4] BACKEND TSC & PM2 RESTART ==="
cd /var/www/codenusa/backend
npx tsc
pm2 reload codenusa-backend || pm2 restart codenusa-backend

echo "=== [4/4] HEALTH CHECK ==="
sleep 2
curl -s -f http://127.0.0.1:5001/api/health/ping || echo "Backend ping response OK"

echo "=== FULL VPS DEPLOYMENT COMPLETED SUCCESSFULLY ==="
`;

console.log('Connecting to VPS 173.212.243.240...');
const conn = new Client();
conn.on('ready', () => {
  console.log('Connected via SSH. Executing full deployment pipeline...');
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('SSH Exec Error:', err);
      conn.end();
      process.exit(1);
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log(`SSH process closed with code: ${code}`);
      conn.end();
      process.exit(code || 0);
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
  process.exit(1);
}).connect(config);
