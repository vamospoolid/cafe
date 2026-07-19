const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
cd /var/www/poscafe/backend
echo "=== DATABASE PUSH ==="
npx prisma db push --accept-data-loss
echo "=== SEEDING TABLES ==="
npx ts-node prisma/seed.ts || node dist/prisma/seed.js || echo "Seed skipped"
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Fixing VPS database schema and tables...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nFinished with code:', code);
            conn.end();
        });
    });
}).connect(config);
