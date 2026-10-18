const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('echo "=== RELEASE DIR ==="; ls -lh /var/www/codenusa/release/; echo "=== DIST DOWNLOADS ==="; ls -lh /var/www/codenusa/frontend/dist/downloads/ 2>/dev/null || true', (err, stream) => {
    stream.pipe(process.stdout);
    stream.on('close', () => c.end());
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
});
