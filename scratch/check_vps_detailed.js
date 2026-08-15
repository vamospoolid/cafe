const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== PM2 STATUS ==="
pm2 status
echo ""
echo "=== PORT 5000 LISTENERS ==="
ss -tulnp | grep 5000 || echo "Port 5000 is not being listened to"
echo ""
echo "=== NGINX STATUS ==="
systemctl status nginx --no-pager || echo "Failed to get Nginx status"
echo ""
echo "=== NGINX ERROR LOG ==="
tail -n 20 /var/log/nginx/error.log || echo "No nginx error log found"
echo ""
echo "=== DISK AND MEMORY ==="
df -h
echo ""
free -m
echo ""
echo "=== RECENT PM2 PROCESS LOGS ==="
pm2 logs poscafe-backend --lines 20 --nostream
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Connected. Running diagnostics...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nFinished. Exit code:', code);
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('SSH Connection failed:', err.message);
}).connect(config);
