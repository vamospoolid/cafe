const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const testScript = `
echo "=== 1. Checking poscafe-backend logs ==="
pm2 logs poscafe-backend --lines 20 --nostream

echo "=== 2. Testing curl localhost:5000/api/health or /api/auth/login ==="
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5000/api/settings

echo "=== 3. Testing curl app.mukiramen.id ==="
curl -s -k -o /dev/null -w "%{http_code}\n" https://app.mukiramen.id/

echo "=== 4. Testing codenusa-backend logs ==="
pm2 logs codenusa-backend --lines 20 --nostream
`;

  conn.exec(testScript, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
