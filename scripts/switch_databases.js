const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const switchScript = `
set -e
echo "=== 1. Updating /var/www/poscafe/backend/.env to mukiramen_db ==="
sed -i 's|localhost:5432/poscafe_standalone_db|localhost:5432/mukiramen_db|g' /var/www/poscafe/backend/.env
cat /var/www/poscafe/backend/.env | grep DATABASE_URL

echo "=== 2. Updating /var/www/codenusa/backend/.env to poscafe_db ==="
sed -i 's|localhost:5432/poscafe_standalone_db|localhost:5432/poscafe_db|g' /var/www/codenusa/backend/.env
cat /var/www/codenusa/backend/.env | grep DATABASE_URL

echo "=== 3. Restarting PM2 processes ==="
pm2 restart poscafe-backend
pm2 restart codenusa-backend

echo "=== 4. Checking status after restart ==="
sleep 2
pm2 status poscafe-backend
pm2 status codenusa-backend
`;

  conn.exec(switchScript, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
