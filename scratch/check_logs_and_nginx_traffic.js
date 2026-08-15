const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== PM2 DESCRIBE ==="
pm2 describe poscafe-backend
echo ""
echo "=== PM2 LOG FILES IN DIR ==="
ls -lh /root/.pm2/logs/
echo ""
echo "=== NGINX LOG DIRECTORY ==="
ls -lh /var/log/nginx/
echo ""
echo "=== NGINX RECENT ACCESS LOG ==="
tail -n 30 /var/log/nginx/access.log || echo "No general access log"
echo ""
echo "=== NGINX RECENT ERROR LOG ==="
tail -n 30 /var/log/nginx/error.log || echo "No general error log"
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected. Running log checks...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => conn.end());
    });
}).connect(config);
