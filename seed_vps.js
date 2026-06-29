const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = 'cd /var/www/poscafe/backend && npx prisma db seed';

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected, running seed...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('Seed finished with code:', code);
            conn.end();
        });
    });
}).connect(config);
