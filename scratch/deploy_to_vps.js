const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== 1. Pulling latest code on VPS ==="
cd /var/www/poscafe
git fetch origin main
git reset --hard origin/main

echo "=== 2. Updating Backend dependencies & Prisma ==="
cd /var/www/poscafe/backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss

echo "=== 3. Compiling Backend TypeScript ==="
npx tsc

echo "=== 4. Restarting PM2 Backend Service ==="
pm2 restart poscafe-backend || pm2 start dist/index.js --name poscafe-backend
pm2 save

echo "=== 5. Updating Frontend dependencies & Building ==="
cd /var/www/poscafe/frontend
npm install
npm run build

echo "=== 6. Checking PM2 & Nginx Status ==="
pm2 status
nginx -t && systemctl reload nginx
echo "=== VPS Deployment Successfully Finished ==="
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS (cafe.codenusa.id). Executing deployment pipeline...');
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Execution error:', err);
            conn.end();
            return;
        }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nDeployment process exited with code:', code);
            conn.end();
        });
    });
}).connect(config);
