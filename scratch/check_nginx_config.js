const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== NGINX CONFIG TEST ==="
nginx -t
echo ""
echo "=== SITES-ENABLED ==="
ls -l /etc/nginx/sites-enabled/
echo ""
echo "=== CAT CAFE.CODENUSA.ID CONFIG ==="
cat /etc/nginx/sites-enabled/cafe.codenusa.id || echo "Config cafe.codenusa.id not found in sites-enabled"
echo ""
echo "=== CURL TEST ON LOCALPORT 5000 ==="
curl -i http://127.0.0.1:5000/api/auth/login || echo "Failed to curl localhost:5000"
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected. Getting Nginx configuration...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => conn.end());
    });
}).connect(config);
