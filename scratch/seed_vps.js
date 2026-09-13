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

echo "=== 2. Running Prisma DB Seed on VPS ==="
cd /var/www/poscafe/backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss
npx prisma db seed

echo "=== 3. Restarting Backend PM2 Service ==="
pm2 restart poscafe-backend
pm2 status

echo "=== ✅ Seed VPS Completed Successfully ==="
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS (cafe.codenusa.id). Executing seed database...');
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Execution error:', err);
            conn.end();
            return;
        }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nSeed process exited with code:', code);
            conn.end();
        });
    });
}).connect(config);
