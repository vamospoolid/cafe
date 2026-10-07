const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const q = `
echo "=== 1. STATUS PM2 UNTUK BENGKEL & VAMOS ==="
pm2 status bengkel-backend vamos-backend vamos-dashboard vamos-ea

echo "=== 2. NGINX CONFIG BENGKEL & VAMOS ==="
echo "--- /etc/nginx/sites-available/bengkel ---"
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/bengkel || true
echo "--- /etc/nginx/sites-available/vamos* ---"
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/vamos || true
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/vamospool_landing || true

echo "=== 3. DIREKTORI & LAST MODIFIED ==="
stat -c "%y %n" /var/www/bengkel
stat -c "%y %n" /var/www/vamos
stat -c "%y %n" /etc/nginx/sites-available/bengkel
stat -c "%y %n" /etc/nginx/sites-available/vamos

echo "=== 4. CURL TEST VAMOS & BENGKEL DOMAINS ==="
echo "vamospool.id:"
curl -s -k -I https://vamospool.id/ | head -n 5 || true
echo "bengkel.codenusa.id:"
curl -s -k -I https://bengkel.codenusa.id/ | head -n 5 || true

echo "=== 5. DATABASE BENGKEL & VAMOS ==="
grep DATABASE_URL /var/www/bengkel/backend/.env 2>/dev/null || grep DATABASE_URL /var/www/bengkel/.env 2>/dev/null || true
grep DATABASE_URL /var/www/vamos/backend/.env 2>/dev/null || grep DATABASE_URL /var/www/vamos/.env 2>/dev/null || true
`;

  conn.exec(q, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
