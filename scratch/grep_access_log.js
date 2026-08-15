const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== SEARCH FOR CAFE.CODENUSA.ID IN ACCESS.LOG ==="
grep "cafe.codenusa.id" /var/log/nginx/access.log | tail -n 30 || echo "No matches in active access.log"
echo ""
echo "=== SEARCH FOR /var/www/poscafe IN NGINX ACCESS ==="
grep -a "/var/www/poscafe" /var/log/nginx/access.log | tail -n 10 || true
echo ""
echo "=== SEARCH FOR ANY GET REQUEST ON POSCAFE FRONTEND ==="
grep -i -E "GET /(index.html|assets/|logo-sol-cafe)" /var/log/nginx/access.log | tail -n 20 || echo "No asset requests found"
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected. Grepping logs...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => conn.end());
    });
}).connect(config);
