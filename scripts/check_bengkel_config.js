const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/nginx/sites-available/bengkel 2>/dev/null; echo "=== CAFE ==="; cat /etc/nginx/sites-available/cafe.codenusa.id 2>/dev/null', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out.trim());
      conn.end();
    });
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 10000
});
