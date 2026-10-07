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
echo "=== 1. VERIFY POSCAFE BACKEND RECENT LOGS ==="
pm2 logs poscafe-backend --lines 30 --nostream

echo "=== 2. VERIFY CODENUSA BACKEND RECENT LOGS ==="
pm2 logs codenusa-backend --lines 30 --nostream

echo "=== 3. TEST LOCAL HTTP STATUS FOR MUKIRAMEN ==="
curl -I http://127.0.0.1:5000/
curl -I http://127.0.0.1:5001/
`;

  conn.exec(testScript, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
