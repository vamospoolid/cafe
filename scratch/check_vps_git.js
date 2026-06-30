const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== VPS Git Status ==="
cd /var/www/poscafe && git status
echo "=== VPS Git Log ==="
cd /var/www/poscafe && git log -n 3
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nCommand finished with code:', code);
            conn.end();
        });
    });
}).connect(config);
