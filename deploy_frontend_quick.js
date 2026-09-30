const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };
// PENTING: codenusa.id → /var/www/codenusa (branch: saas)
const cmd = `cd /var/www/codenusa && git checkout -- frontend/package* && git pull origin saas && cd frontend && npm run build && echo "=== FRONTEND DEPLOYED ==="`;
const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
