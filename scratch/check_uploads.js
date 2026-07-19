const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== Backend Root Contents ==="
ls -la /var/www/poscafe/backend
echo "=== Backend Dist Contents ==="
ls -la /var/www/poscafe/backend/dist || echo "No dist"
echo "=== Checking Uploads folder in root ==="
ls -la /var/www/poscafe/backend/uploads || echo "No uploads in root"
echo "=== Checking Uploads folder in dist ==="
ls -la /var/www/poscafe/backend/dist/uploads || echo "No uploads in dist"
`;

const conn = new Client();
conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            conn.end();
        });
    });
}).connect(config);
