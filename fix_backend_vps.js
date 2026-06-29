const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
cd /var/www/poscafe/backend
npx tsc
pm2 stop poscafe-backend || true
pm2 delete poscafe-backend || true
PORT=5000 pm2 start dist/src/index.js --name poscafe-backend
pm2 save
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Fixing backend...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('Fixed backend with code:', code);
            conn.end();
        });
    });
}).connect(config);
