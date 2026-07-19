const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = 'cp /var/www/poscafe/backend/prisma/dev.db /var/www/poscafe/backend/prisma/dev.db.bak && echo "=== Database backup created successfully on VPS ==="';

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Creating backup of SQLite database...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('Completed with code:', code);
            conn.end();
        });
    });
}).connect(config);
