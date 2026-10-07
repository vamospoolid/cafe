const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const script = `
set -e
echo "=== 1. Updating /etc/nginx/sites-available/cafe.codenusa.id to Codenusa SaaS (5001) ==="
sed -i 's|/var/www/poscafe/frontend/dist|/var/www/codenusa/frontend/dist|g' /etc/nginx/sites-available/cafe.codenusa.id
sed -i 's|/var/www/poscafe/backend/uploads|/var/www/codenusa/backend/uploads|g' /etc/nginx/sites-available/cafe.codenusa.id
sed -i 's|http://127.0.0.1:5000|http://127.0.0.1:5001|g' /etc/nginx/sites-available/cafe.codenusa.id

echo "=== 2. Testing Nginx config ==="
nginx -t

echo "=== 3. Reloading Nginx ==="
systemctl reload nginx
echo "✅ Nginx reloaded successfully!"
`;

  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
