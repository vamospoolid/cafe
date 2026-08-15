const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const commands = [
    { label: '=== PM2 PROCESSES ===', cmd: 'pm2 list' },
    { label: '=== NGINX STATUS ===', cmd: 'systemctl status nginx --no-pager' },
    { label: '=== DISK SPACE ===', cmd: 'df -h /' },
    { label: '=== MEMORY INFO ===', cmd: 'free -m' },
    { label: '=== PORT 5000 / BACKEND BINDING ===', cmd: 'ss -tulpn | grep 5000 || netstat -tulnp | grep 5000 || echo "Port 5000 not bound"' },
    { label: '=== BACKEND HEALTH CHECK (INTERNAL CURL) ===', cmd: 'curl -i -s http://127.0.0.1:5000/api/auth/me || curl -i -s http://127.0.0.1:5000/api/ || curl -i -s http://127.0.0.1:5000/' }
];

const conn = new Client();

conn.on('ready', async () => {
    console.log('✅ Connected to VPS via SSH!\n');
    
    for (const item of commands) {
        console.log(`\n\x1b[36m${item.label}\x1b[0m`);
        await new Promise((resolve) => {
            conn.exec(item.cmd, (err, stream) => {
                if (err) {
                    console.error(`Error executing ${item.cmd}:`, err);
                    resolve();
                    return;
                }
                stream.on('data', (d) => process.stdout.write(d));
                stream.stderr.on('data', (d) => process.stderr.write(d));
                stream.on('close', () => resolve());
            });
        });
    }
    
    conn.end();
}).on('error', (err) => {
    console.error('❌ SSH Connection Error:', err);
}).connect(config);
