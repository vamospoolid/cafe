const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };

const commands = [
    { label: '=== NGINX CONFIG TEST ===', cmd: 'nginx -t' },
    { label: '=== NGINX RUNNING STATUS ===', cmd: 'systemctl is-active nginx' },
    { label: '=== BACKEND INTERNAL PORT CHECK ===', cmd: 'curl -s http://127.0.0.1:5000/api/health' },
    { label: '=== BACKEND VIA NGINX PROXY CHECK ===', cmd: 'curl -s -H "Host: cafe.codenusa.id" http://127.0.0.1/api/health' }
];

const conn = new Client();
conn.on('ready', async () => {
    console.log('✅ Connected to VPS to run final health check...\n');
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
    console.error('❌ SSH Error:', err);
}).connect(config);
