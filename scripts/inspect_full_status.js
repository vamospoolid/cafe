const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const checkScript = `
echo "=== 1. CHECK MUKIRAMEN_DB DATA ==="
sudo -u postgres psql -d mukiramen_db -c 'SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema = "public";'
sudo -u postgres psql -d mukiramen_db -c 'SELECT id, name, slug, "customDomain" FROM "Tenant";'
sudo -u postgres psql -d mukiramen_db -c 'SELECT id, username, role, "tenantId" FROM "User";'
sudo -u postgres psql -d mukiramen_db -c 'SELECT count(*) as total_orders FROM "Order";'
sudo -u postgres psql -d mukiramen_db -c 'SELECT count(*) as total_products FROM "Product";'

echo "=== 2. CHECK POSCAFE .ENV & PROCESS ==="
cat /var/www/poscafe/backend/.env | grep -E "DATABASE_URL|PORT"
pm2 status poscafe-backend

echo "=== 3. CHECK CODENUSA .ENV & PROCESS ==="
cat /var/www/codenusa/backend/.env | grep -E "DATABASE_URL|PORT"
pm2 status codenusa-backend

echo "=== 4. CHECK NGINX SITES CONFIG ==="
echo "--- app.mukiramen.id ---"
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/app.mukiramen.id
echo "--- staff.mukiramen.id ---"
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/staff.mukiramen.id
echo "--- cafe.codenusa.id ---"
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/cafe.codenusa.id
echo "--- codenusa ---"
grep -E "server_name|proxy_pass|root " /etc/nginx/sites-available/codenusa

echo "=== 5. CHECK CURL ENDPOINTS ==="
echo "Muki Ramen Backend (:5000/api/settings):"
curl -s http://127.0.0.1:5000/api/settings | cut -c 1-200
echo ""
echo "Codenusa Backend (:5001/api/settings):"
curl -s http://127.0.0.1:5001/api/settings | cut -c 1-200
echo ""
`;

  conn.exec(checkScript, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
